const pool = require('../config/db');
const { ApiError, num, nowStamp } = require('../utils/apiHelpers');
const { fifoOrder, consumeBatches, lockBatches, addMovement } = require('./StockAdjustService');

class StockRequestReviewService {
    // UC-05: requests of the branch with their items and the stock the branch has right now (Q5.1 / Q5.2)
    async list(dataBranch, status) {
        const [requests] = await pool.query(
            `SELECT sr.request_id, sr.branch_id, sr.request_date, sr.status, sr.feedback, sr.reviewed_at,
                    ru.username AS requested_by, vu.username AS reviewed_by
             FROM stock_requests sr
             LEFT JOIN users ru ON ru.user_id = sr.requested_by
             LEFT JOIN users vu ON vu.user_id = sr.reviewed_by
             WHERE sr.branch_id = ? ${status ? 'AND sr.status = ?' : ''}
             ORDER BY CAST(SUBSTRING(sr.request_id, 4) AS UNSIGNED) DESC`,
            status ? [dataBranch, status] : [dataBranch]
        );
        if (!requests.length) return [];

        const ids = requests.map((r) => r.request_id);
        const [items] = await pool.query(
            `SELECT i.request_id, i.product_id, p.product_name, p.unit, CAST(i.requested_quantity AS UNSIGNED) AS requested_quantity,
                    CAST(bs.quantity_on_hand AS SIGNED) AS current_stock
             FROM stock_request_items i
             LEFT JOIN products p ON p.product_id = i.product_id
             LEFT JOIN branch_stocks bs ON bs.product_id = i.product_id AND bs.branch_id = ?
             WHERE i.request_id IN (?) ORDER BY i.request_item_id`, [dataBranch, ids]
        );
        const [picked] = await pool.query(`SELECT DISTINCT reference_id FROM stock_movements WHERE movement_type = 'OUT' AND reference_id IN (?)`, [ids]);
        const pickedSet = new Set(picked.map((p) => p.reference_id));

        return requests.map((r) => ({
            ...r,
            picked: pickedSet.has(r.request_id),
            items: items.filter((i) => i.request_id === r.request_id).map((i) => ({ ...i, current_stock: i.current_stock === null ? 0 : Number(i.current_stock) }))
        }));
    }

    async load(requestId, db = pool, lock = false) {
        const [rows] = await db.query(`SELECT * FROM stock_requests WHERE request_id = ? LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`, [requestId]);
        if (!rows[0]) throw new ApiError(404, `ไม่พบคำขอรหัส ${requestId}`);
        return rows[0];
    }

    // UC-06 - Q6.3: only a Pending request of this branch can be approved
    async approve(requestId, dataBranch, note, userId) {
        const [result] = await pool.query(
            `UPDATE stock_requests SET status = 'Approved', reviewed_by = ?, reviewed_at = ?, feedback = ?
             WHERE request_id = ? AND branch_id = ? AND status = 'Pending'`,
            [userId, nowStamp(), String(note || '').trim() || 'Approved', requestId, dataBranch]
        );
        if (!result.affectedRows) {
            const request = await this.load(requestId);
            throw new ApiError(409, request.branch_id !== dataBranch ? 'คำขอนี้ไม่ใช่ของสาขาที่เลือก' : `คำขอนี้อยู่ในสถานะ ${request.status} จึงอนุมัติไม่ได้`);
        }
        return { request_id: requestId, status: 'Approved' };
    }

    // UC-07: cancel with a reason that the Owner sees on the request
    async cancel(requestId, dataBranch, reason, userId) {
        if (!String(reason || '').trim()) throw new ApiError(400, 'โปรดระบุเหตุผลในการยกเลิกคำขอ');
        const [result] = await pool.query(
            `UPDATE stock_requests SET status = 'Cancelled', reviewed_by = ?, reviewed_at = ?, feedback = ?
             WHERE request_id = ? AND branch_id = ? AND status = 'Pending'`,
            [userId, nowStamp(), String(reason).trim(), requestId, dataBranch]
        );
        if (!result.affectedRows) {
            const request = await this.load(requestId);
            throw new ApiError(409, request.branch_id !== dataBranch ? 'คำขอนี้ไม่ใช่ของสาขาที่เลือก' : `คำขอนี้อยู่ในสถานะ ${request.status} จึงยกเลิกไม่ได้`);
        }
        return { request_id: requestId, status: 'Cancelled' };
    }

    // ---- UC-08 FIFO ---------------------------------------------------------------
    // Plan: for each requested item take from the batches that expire first / arrived first.
    async plan(requestId, dataBranch, db = pool, lock = false) {
        const request = await this.load(requestId, db, lock);
        if (request.branch_id !== dataBranch) throw new ApiError(403, 'คำขอนี้ไม่ใช่ของสาขาที่เลือก');
        if (request.status !== 'Approved') throw new ApiError(409, 'ต้องอนุมัติคำขอก่อนจึงจะจัดเตรียมสินค้าได้');
        const [done] = await db.query(`SELECT 1 FROM stock_movements WHERE movement_type = 'OUT' AND reference_id = ? LIMIT 1`, [requestId]);
        if (done.length) throw new ApiError(409, 'คำขอนี้จัดเตรียมสินค้าตามแผน FIFO ไปแล้ว');

        const [items] = await db.query(
            `SELECT i.product_id, p.product_name, p.unit, CAST(i.requested_quantity AS UNSIGNED) AS requested
             FROM stock_request_items i LEFT JOIN products p ON p.product_id = i.product_id
             WHERE i.request_id = ? ORDER BY i.request_item_id`, [requestId]
        );

        const plan = [];
        for (const item of items) {
            const [rows] = await db.query(
                `SELECT batch_id, received_at, expiry_date, quantity_received, quantity_remaining FROM stock_batches
                 WHERE branch_id = ? AND product_id = ? AND CAST(quantity_remaining AS SIGNED) > 0 ${lock ? 'FOR UPDATE' : ''}`,
                [dataBranch, item.product_id]
            );
            let left = num(item.requested);
            const allocations = [];
            for (const batch of fifoOrder(rows)) {
                if (left <= 0) break;
                const take = Math.min(num(batch.quantity_remaining), left);
                allocations.push({ batch_id: batch.batch_id, received_at: batch.received_at, expiry_date: batch.expiry_date || null, take, remaining_after: num(batch.quantity_remaining) - take });
                left -= take;
            }
            plan.push({ ...item, requested: num(item.requested), picked: num(item.requested) - left, shortage: left, allocations });
        }
        return {
            request_id: requestId,
            branch_id: dataBranch,
            items: plan,
            summary: { items: plan.length, units: plan.reduce((s, i) => s + i.picked, 0), short_items: plan.filter((i) => i.shortage > 0).length }
        };
    }

    // confirm: cut the batches in FIFO order and log one OUT movement per batch (reference = request id)
    async confirm(requestId, dataBranch, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const plan = await this.plan(requestId, dataBranch, connection, true);
            if (!plan.summary.units) throw new ApiError(400, 'ไม่มีสต็อกเพียงพอสำหรับจัดเตรียมสินค้าตามคำขอนี้');

            for (const item of plan.items) {
                if (!item.picked) continue;
                const batches = await lockBatches(connection, dataBranch, item.product_id);
                const { taken } = await consumeBatches(connection, batches, item.picked);
                for (const t of taken) {
                    await addMovement(connection, { branch: dataBranch, product: item.product_id, batch: t.batch.batch_id, type: 'OUT', change: -t.take, reference: requestId, userId });
                }
                await connection.query(
                    'UPDATE branch_stocks SET quantity_on_hand = CAST(quantity_on_hand AS SIGNED) - ?, updated_at = ? WHERE branch_id = ? AND product_id = ?',
                    [item.picked, nowStamp(), dataBranch, item.product_id]
                );
            }
            await connection.commit();
            return { ...plan, confirmed_at: nowStamp() };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = { StockRequestReviewService };
