const pool = require('../config/db');
const { ApiError, nextId, num, nowStamp, parseThaiDate } = require('../utils/apiHelpers');

let tableReady = false;

// Manage Stock keeps an audit trail of every manual change. The reason has no column in
// stock_movements, so adjustments get their own table (created on first use, TEXT columns like the rest).
async function ensureTable() {
    if (tableReady) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS stock_adjustments (
            adjustment_id TEXT, branch_id TEXT, product_id TEXT, adjust_type TEXT,
            quantity_before TEXT, quantity_after TEXT, reason TEXT, created_by TEXT, created_at TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    tableReady = true;
}

const MODES = { set: 'Set count', add: 'Add', remove: 'Remove', damage: 'Damaged' };

// oldest expiry first, batches without an expiry date last, then oldest received (FIFO)
function fifoOrder(batches) {
    const t = (b) => (parseThaiDate(b.expiry_date) ? parseThaiDate(b.expiry_date).getTime() : Infinity);
    const r = (b) => (parseThaiDate(b.received_at) ? parseThaiDate(b.received_at).getTime() : 0);
    return batches.slice().sort((a, b) => t(a) - t(b) || r(a) - r(b));
}

// take `quantity` units from the batches (already locked + FIFO ordered); returns the batches touched
async function consumeBatches(db, batches, quantity) {
    let left = quantity;
    const taken = [];
    for (const batch of batches) {
        if (left <= 0) break;
        const remaining = num(batch.quantity_remaining);
        const take = Math.min(remaining, left);
        if (take <= 0) continue;
        await db.query('UPDATE stock_batches SET quantity_remaining = ? WHERE batch_id = ?', [remaining - take, batch.batch_id]);
        taken.push({ batch, take });
        left -= take;
    }
    return { taken, short: left };
}

async function lockBatches(db, dataBranch, productId) {
    const [rows] = await db.query(
        `SELECT batch_id, received_at, expiry_date, quantity_received, quantity_remaining
         FROM stock_batches WHERE branch_id = ? AND product_id = ? AND CAST(quantity_remaining AS SIGNED) > 0 FOR UPDATE`,
        [dataBranch, productId]
    );
    return fifoOrder(rows);
}

async function addMovement(db, { branch, product, batch, type, change, reference, userId }) {
    const id = await nextId(db, 'stock_movements', 'movement_id', 'MOV', 5);
    await db.query(
        `INSERT INTO stock_movements (movement_id, branch_id, product_id, batch_id, movement_type, quantity_change, reference_id, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, branch, product, batch, type, change, reference, userId, nowStamp()]
    );
}

class StockAdjustService {
    // mode: set (counted quantity) | add | remove | damage
    async adjust(dataBranch, { product_id, mode, quantity, reason }, userId) {
        await ensureTable();
        if (!MODES[mode]) throw new ApiError(400, 'กรุณาเลือกประเภทการปรับปรุงสต็อก');
        const qty = Number(quantity);
        if (quantity === '' || quantity === null || quantity === undefined || !Number.isInteger(qty) || qty < 0 || (mode !== 'set' && qty === 0)) {
            throw new ApiError(400, mode === 'set' ? 'จำนวนนับจริงต้องเป็นจำนวนเต็ม 0 ขึ้นไป' : 'จำนวนต้องเป็นจำนวนเต็มที่มากกว่า 0');
        }
        if (!String(reason || '').trim()) throw new ApiError(400, 'กรุณาระบุเหตุผลในการปรับปรุงสต็อก');

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [products] = await connection.query('SELECT product_id FROM products WHERE product_id = ? LIMIT 1', [product_id]);
            if (!products[0]) throw new ApiError(404, 'ไม่พบสินค้าที่เลือก');

            const [stocks] = await connection.query(
                'SELECT quantity_on_hand FROM branch_stocks WHERE branch_id = ? AND product_id = ? FOR UPDATE', [dataBranch, product_id]
            );
            const before = stocks[0] ? num(stocks[0].quantity_on_hand) : 0;
            const after = mode === 'set' ? qty : mode === 'add' ? before + qty : before - qty;
            const delta = after - before;

            if (after < 0) throw new ApiError(400, `จำนวนที่ลดมากกว่าสต็อกคงเหลือ (${before})`);
            if (delta === 0) throw new ApiError(400, 'จำนวนใหม่เท่ากับสต็อกปัจจุบัน ไม่มีการเปลี่ยนแปลง');

            const adjustmentId = await nextId(connection, 'stock_adjustments', 'adjustment_id', 'ADJ', 4);
            const type = mode === 'damage' ? 'DAMAGE' : 'ADJUST';
            const ctx = { branch: dataBranch, product: product_id, reference: adjustmentId, userId };
            const batches = await lockBatches(connection, dataBranch, product_id);

            if (delta < 0) {
                // reduce: oldest batches first so stock and batches stay in step
                const { taken } = await consumeBatches(connection, batches, -delta);
                for (const t of taken) await addMovement(connection, { ...ctx, batch: t.batch.batch_id, type, change: -t.take });
            } else {
                // increase: put the units on the newest batch, or open a batch when the product has none
                let batchId;
                if (batches.length) {
                    const newest = batches.slice().sort((a, b) => (parseThaiDate(b.received_at) || 0) - (parseThaiDate(a.received_at) || 0))[0];
                    batchId = newest.batch_id;
                    await connection.query(
                        'UPDATE stock_batches SET quantity_remaining = ?, quantity_received = ? WHERE batch_id = ?',
                        [num(newest.quantity_remaining) + delta, num(newest.quantity_received) + delta, batchId]
                    );
                } else {
                    batchId = await nextId(connection, 'stock_batches', 'batch_id', 'BAT', 4);
                    await connection.query(
                        `INSERT INTO stock_batches (batch_id, branch_id, product_id, received_at, expiry_date, quantity_received, quantity_remaining)
                         VALUES (?, ?, ?, ?, '', ?, ?)`, [batchId, dataBranch, product_id, nowStamp(), delta, delta]
                    );
                }
                await addMovement(connection, { ...ctx, batch: batchId, type, change: delta });
            }

            if (stocks[0]) {
                await connection.query('UPDATE branch_stocks SET quantity_on_hand = ?, updated_at = ? WHERE branch_id = ? AND product_id = ?', [after, nowStamp(), dataBranch, product_id]);
            } else {
                await connection.query(
                    `INSERT INTO branch_stocks (branch_id, product_id, quantity_on_hand, quantity_reserved, updated_at) VALUES (?, ?, ?, 0, ?)`,
                    [dataBranch, product_id, after, nowStamp()]
                );
            }

            await connection.query(
                `INSERT INTO stock_adjustments (adjustment_id, branch_id, product_id, adjust_type, quantity_before, quantity_after, reason, created_by, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [adjustmentId, dataBranch, product_id, MODES[mode], before, after, String(reason).trim(), userId, nowStamp()]
            );

            await connection.commit();
            return { adjustment_id: adjustmentId, product_id, before, after, change: delta };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async history(dataBranch, limit = 8) {
        await ensureTable();
        const [rows] = await pool.query(
            `SELECT a.adjustment_id, a.product_id, p.product_name, a.adjust_type, a.quantity_before, a.quantity_after,
                    a.reason, u.username AS created_by, a.created_at
             FROM stock_adjustments a
             LEFT JOIN products p ON p.product_id = a.product_id
             LEFT JOIN users u ON u.user_id = a.created_by
             WHERE a.branch_id = ?
             ORDER BY CAST(SUBSTRING(a.adjustment_id, 4) AS UNSIGNED) DESC LIMIT ?`,
            [dataBranch, Number(limit)]
        );
        return rows.map((r) => ({ ...r, quantity_before: num(r.quantity_before), quantity_after: num(r.quantity_after) }));
    }
}

module.exports = { StockAdjustService, fifoOrder, consumeBatches, lockBatches, addMovement };
