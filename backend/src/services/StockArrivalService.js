const pool = require('../config/db');
const { ApiError, nextId, num, nowStamp, isoToThaiDate, parseThaiDate } = require('../utils/apiHelpers');
const { addMovement } = require('./StockAdjustService');

const RESULTS = ['Pass', 'PassWithRemarks', 'Fail'];

class StockArrivalService {
    // purchase orders that are waiting for goods, with how much of each line is still to come
    async pending(dataBranch) {
        const [orders] = await pool.query(
            `SELECT po.purchase_order_id, po.order_date, po.status, po.total_amount, s.supplier_name
             FROM purchase_orders po LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id COLLATE utf8mb4_general_ci
             WHERE po.branch_id = ? AND po.status IN ('Sent', 'PartiallyReceived')
             ORDER BY CAST(SUBSTRING(po.purchase_order_id, 3) AS UNSIGNED) DESC`, [dataBranch]
        );
        if (!orders.length) return [];

        const ids = orders.map((o) => o.purchase_order_id);
        const [items] = await pool.query(
            `SELECT poi.purchase_order_id, poi.purchase_order_item_id, poi.product_id, p.product_name, p.unit,
                    CAST(poi.ordered_quantity AS UNSIGNED) AS ordered,
                    COALESCE((SELECT SUM(CAST(ai.quantity_received AS UNSIGNED)) FROM stock_arrival_items ai WHERE ai.purchase_order_item_id = poi.purchase_order_item_id), 0) AS received
             FROM purchase_order_items poi LEFT JOIN products p ON p.product_id = poi.product_id
             WHERE poi.purchase_order_id IN (?) ORDER BY poi.purchase_order_item_id`, [ids]
        );
        return orders.map((o) => ({
            ...o, total_amount: num(o.total_amount),
            items: items.filter((i) => i.purchase_order_id === o.purchase_order_id)
                .map((i) => ({ ...i, ordered: num(i.ordered), received: num(i.received), remaining: Math.max(0, num(i.ordered) - num(i.received)) }))
        }));
    }

    async history(dataBranch, limit = 12) {
        const [rows] = await pool.query(
            `SELECT sa.arrival_id, sa.purchase_order_id, sa.arrival_date, sa.delivery_status, sa.notes, u.username AS received_by,
                    (SELECT COALESCE(SUM(CAST(ai.quantity_received AS UNSIGNED)), 0) FROM stock_arrival_items ai WHERE ai.arrival_id = sa.arrival_id) AS units,
                    (SELECT COALESCE(SUM(CAST(ai.quantity_rejected AS UNSIGNED)), 0) FROM stock_arrival_items ai WHERE ai.arrival_id = sa.arrival_id) AS rejected
             FROM stock_arrivals sa
             JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id
             LEFT JOIN users u ON u.user_id = sa.received_by
             WHERE po.branch_id = ?
             ORDER BY CAST(SUBSTRING(sa.arrival_id, 4) AS UNSIGNED) DESC LIMIT ?`, [dataBranch, Number(limit)]
        );
        return rows.map((r) => ({ ...r, units: num(r.units), rejected: num(r.rejected) }));
    }

    // UC-10: record the arrival, open one batch per accepted line and add it to the branch stock
    async receive(dataBranch, body, userId) {
        const lines = Array.isArray(body.items) ? body.items : [];
        if (!body.purchase_order_id) throw new ApiError(400, 'กรุณาเลือกใบสั่งซื้อที่สินค้ามาถึง');

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [pos] = await connection.query('SELECT * FROM purchase_orders WHERE purchase_order_id = ? FOR UPDATE', [body.purchase_order_id]);
            const po = pos[0];
            if (!po) throw new ApiError(404, 'ไม่พบรหัสใบสั่งซื้อที่ระบุ');
            if (po.branch_id !== dataBranch) throw new ApiError(403, 'ใบสั่งซื้อนี้ไม่ใช่ของสาขาที่เลือก');
            if (!['Sent', 'PartiallyReceived'].includes(po.status)) throw new ApiError(409, `ใบสั่งซื้อสถานะ ${po.status} รับสินค้าไม่ได้ (ต้องเป็น Sent หรือ PartiallyReceived)`);

            const [poItems] = await connection.query(
                `SELECT poi.purchase_order_item_id, poi.product_id, CAST(poi.ordered_quantity AS UNSIGNED) AS ordered,
                        COALESCE((SELECT SUM(CAST(ai.quantity_received AS UNSIGNED)) FROM stock_arrival_items ai WHERE ai.purchase_order_item_id = poi.purchase_order_item_id), 0) AS received
                 FROM purchase_order_items poi WHERE poi.purchase_order_id = ?`, [po.purchase_order_id]
            );
            const byId = new Map(poItems.map((i) => [i.purchase_order_item_id, { ...i, ordered: num(i.ordered), received: num(i.received) }]));

            const today = new Date(); today.setHours(0, 0, 0, 0);
            const receipts = [];
            for (const line of lines) {
                const item = byId.get(line.purchase_order_item_id);
                if (!item) throw new ApiError(400, 'พบรายการสินค้าที่ไม่อยู่ในใบสั่งซื้อนี้');
                const received = Number(line.quantity_received || 0);
                const rejected = Number(line.quantity_rejected || 0);
                if (!Number.isInteger(received) || received < 0 || !Number.isInteger(rejected) || rejected < 0) throw new ApiError(400, 'จำนวนรับและจำนวนที่ปฏิเสธต้องเป็นจำนวนเต็ม 0 ขึ้นไป');
                if (rejected > received) throw new ApiError(400, 'จำนวนที่ปฏิเสธต้องไม่มากกว่าจำนวนที่รับ');
                if (received > item.ordered - item.received) throw new ApiError(400, `จำนวนที่รับเกินจำนวนที่ยังค้างรับ (${item.ordered - item.received}) ของ ${item.product_id}`);
                if (received === 0) continue;

                let expiry = '';
                if (line.expiry_date) {
                    const thai = isoToThaiDate(line.expiry_date);
                    if (!thai || parseThaiDate(thai) < today) throw new ApiError(400, 'วันหมดอายุไม่ถูกต้อง (ต้องไม่เป็นวันที่ผ่านมาแล้ว)');
                    expiry = thai;
                }
                receipts.push({ item, received, rejected, accepted: received - rejected, expiry });
            }
            if (!receipts.length) throw new ApiError(400, 'กรุณาระบุจำนวนที่รับอย่างน้อย 1 รายการ');

            const arrivalId = await nextId(connection, 'stock_arrivals', 'arrival_id', 'ARR', 4);
            let itemNo = Number((await nextId(connection, 'stock_arrival_items', 'arrival_item_id', 'ARI', 4)).slice(3));
            let batchNo = Number((await nextId(connection, 'stock_batches', 'batch_id', 'BAT', 4)).slice(3));

            // full delivery only if every line of the order has now been received in full
            const receivedNow = new Map(receipts.map((r) => [r.item.purchase_order_item_id, r.received]));
            const complete = poItems.every((i) => {
                const it = byId.get(i.purchase_order_item_id);
                return it.received + (receivedNow.get(i.purchase_order_item_id) || 0) >= it.ordered;
            });

            await connection.query(
                `INSERT INTO stock_arrivals (arrival_id, purchase_order_id, received_by, arrival_date, delivery_status, notes) VALUES (?, ?, ?, ?, ?, ?)`,
                [arrivalId, po.purchase_order_id, userId, nowStamp(), complete ? 'Received' : 'Partial', String(body.notes || '').trim()]
            );

            for (const r of receipts) {
                let batchId = null;
                if (r.accepted > 0) {
                    batchId = 'BAT' + String(batchNo++).padStart(4, '0');
                    await connection.query(
                        `INSERT INTO stock_batches (batch_id, branch_id, product_id, received_at, expiry_date, quantity_received, quantity_remaining) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [batchId, dataBranch, r.item.product_id, nowStamp(), r.expiry, r.accepted, r.accepted]
                    );
                    const [stock] = await connection.query('SELECT quantity_on_hand FROM branch_stocks WHERE branch_id = ? AND product_id = ? FOR UPDATE', [dataBranch, r.item.product_id]);
                    if (stock[0]) {
                        await connection.query('UPDATE branch_stocks SET quantity_on_hand = ?, updated_at = ? WHERE branch_id = ? AND product_id = ?', [num(stock[0].quantity_on_hand) + r.accepted, nowStamp(), dataBranch, r.item.product_id]);
                    } else {
                        await connection.query('INSERT INTO branch_stocks (branch_id, product_id, quantity_on_hand, quantity_reserved, updated_at) VALUES (?, ?, ?, 0, ?)', [dataBranch, r.item.product_id, r.accepted, nowStamp()]);
                    }
                    await addMovement(connection, { branch: dataBranch, product: r.item.product_id, batch: batchId, type: 'RECEIVE', change: r.accepted, reference: po.purchase_order_id, userId });
                }
                await connection.query(
                    `INSERT INTO stock_arrival_items (arrival_item_id, arrival_id, purchase_order_item_id, quantity_received, quantity_rejected, batch_id) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['ARI' + String(itemNo++).padStart(4, '0'), arrivalId, r.item.purchase_order_item_id, r.received, r.rejected, batchId]
                );
            }

            const newStatus = complete ? 'Received' : 'PartiallyReceived';
            await connection.query('UPDATE purchase_orders SET status = ? WHERE purchase_order_id = ?', [newStatus, po.purchase_order_id]);

            await connection.commit();
            return {
                arrival_id: arrivalId, purchase_order_id: po.purchase_order_id, delivery_status: complete ? 'Received' : 'Partial', order_status: newStatus,
                units_added: receipts.reduce((s, r) => s + r.accepted, 0), units_rejected: receipts.reduce((s, r) => s + r.rejected, 0)
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // ---- UC-12 quality check ------------------------------------------------------
    async qualityList(dataBranch) {
        const [rows] = await pool.query(
            `SELECT sa.arrival_id, sa.purchase_order_id, sa.arrival_date, sa.delivery_status, s.supplier_name,
                    qi.inspection_id, qi.result, qi.remarks, qi.inspection_date, u.username AS inspected_by,
                    (SELECT COALESCE(SUM(CAST(ai.quantity_received AS UNSIGNED)), 0) FROM stock_arrival_items ai WHERE ai.arrival_id = sa.arrival_id) AS units,
                    (SELECT COALESCE(SUM(CAST(ai.quantity_rejected AS UNSIGNED)), 0) FROM stock_arrival_items ai WHERE ai.arrival_id = sa.arrival_id) AS rejected
             FROM stock_arrivals sa
             JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id
             LEFT JOIN suppliers s ON s.supplier_id = po.supplier_id COLLATE utf8mb4_general_ci
             LEFT JOIN quality_inspections qi ON qi.arrival_id = sa.arrival_id
             LEFT JOIN users u ON u.user_id = qi.inspected_by
             WHERE po.branch_id = ?
             ORDER BY CAST(SUBSTRING(sa.arrival_id, 4) AS UNSIGNED) DESC`, [dataBranch]
        );
        const ids = rows.map((r) => r.arrival_id);
        const [items] = ids.length
            ? await pool.query(
                `SELECT ai.arrival_id, p.product_name, p.unit, CAST(ai.quantity_received AS UNSIGNED) AS received, CAST(ai.quantity_rejected AS UNSIGNED) AS rejected
                 FROM stock_arrival_items ai
                 JOIN purchase_order_items poi ON poi.purchase_order_item_id = ai.purchase_order_item_id
                 LEFT JOIN products p ON p.product_id = poi.product_id WHERE ai.arrival_id IN (?) ORDER BY ai.arrival_item_id`, [ids])
            : [[]];
        return {
            results: RESULTS,
            items: rows.map((r) => ({
                ...r, units: num(r.units), rejected: num(r.rejected),
                items: items.filter((i) => i.arrival_id === r.arrival_id).map((i) => ({ ...i, received: num(i.received), rejected: num(i.rejected) }))
            }))
        };
    }

    async arrivalBranch(arrivalId) {
        const [rows] = await pool.query('SELECT po.branch_id FROM stock_arrivals sa JOIN purchase_orders po ON po.purchase_order_id = sa.purchase_order_id WHERE sa.arrival_id = ?', [arrivalId]);
        if (!rows[0]) throw new ApiError(404, 'ไม่พบรอบจัดส่งที่เลือก');
        return rows[0].branch_id;
    }

    async inspect({ arrival_id, result, remarks }, userId) {
        if (!RESULTS.includes(result)) throw new ApiError(400, 'โปรดเลือกผลการประเมินคุณภาพสินค้า');
        if (result !== 'Pass' && !String(remarks || '').trim()) throw new ApiError(400, 'กรุณาระบุหมายเหตุประกอบผลการตรวจ');
        const [done] = await pool.query('SELECT 1 FROM quality_inspections WHERE arrival_id = ? LIMIT 1', [arrival_id]);
        if (done.length) throw new ApiError(409, 'รอบจัดส่งนี้ตรวจสอบคุณภาพไปแล้ว');

        const id = await nextId(pool, 'quality_inspections', 'inspection_id', 'QIN', 4);
        await pool.query(
            'INSERT INTO quality_inspections (inspection_id, arrival_id, inspected_by, inspection_date, result, remarks) VALUES (?, ?, ?, ?, ?, ?)',
            [id, arrival_id, userId, nowStamp(), result, String(remarks || '').trim()]
        );
        // a "Fail" (or remarks) shows up for the Owner in Supplier / Claim -> QC issues
        return { inspection_id: id, arrival_id, result, owner_notified: result !== 'Pass' };
    }
}

module.exports = { StockArrivalService };
