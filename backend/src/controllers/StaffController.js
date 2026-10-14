const pool = require('../config/db');
const { handle, created, ok, ApiError, toDataBranchId, assertBranchAccess } = require('../utils/apiHelpers');
const { StockService } = require('../services/StockService');
const { StockAdjustService } = require('../services/StockAdjustService');
const { ProductService } = require('../services/ProductService');
const { CategoryService } = require('../services/CategoryService');
const { StockRequestReviewService } = require('../services/StockRequestReviewService');
const { DeliveryService } = require('../services/DeliveryService');
const { PurchaseOrderService } = require('../services/PurchaseOrderService');
const { StockArrivalService } = require('../services/StockArrivalService');
const { ExpiryCheckService } = require('../services/ExpiryCheckService');

const stock = new StockService();
const adjust = new StockAdjustService();
const products = new ProductService();
const categories = new CategoryService();
const review = new StockRequestReviewService();
const delivery = new DeliveryService();
const purchaseOrders = new PurchaseOrderService();
const arrivals = new StockArrivalService();
const expiry = new ExpiryCheckService();

// the branch the Staff member is working in (?branch=B003 / body.branch) - must be one they have access to
async function scope(req) {
    const branch = req.query.branch || (req.body && req.body.branch);
    const dataBranch = toDataBranchId(branch);
    if (!dataBranch) throw new ApiError(400, 'กรุณาเลือกสาขา');
    await assertBranchAccess(pool, req.user.userId, dataBranch);
    return { branch, dataBranch };
}

const StaffController = {
    // branches this user may work in
    getBranches: handle(async (req) => {
        const [rows] = await pool.query('SELECT branch_id FROM user_branch_access WHERE user_id = ? ORDER BY branch_id', [req.user.userId]);
        return rows.map((r) => r.branch_id);
    }),

    // Manage Stock
    getStock: handle(async (req) => { const s = await scope(req); return stock.overview(s.branch, { search: req.query.search }); }),
    adjustStock: handle(async (req) => { const s = await scope(req); return created(await adjust.adjust(s.dataBranch, req.body, req.user.userId), 'บันทึกการปรับปรุงสต็อกเรียบร้อยแล้ว'); }),
    getAdjustments: handle(async (req) => { const s = await scope(req); return adjust.history(s.dataBranch, req.query.limit); }),

    // Product Info / Product Status
    getProducts: handle((req) => products.listProducts(req.query)),
    getProductDetail: handle(async (req) => { const s = await scope(req); return products.detail(req.params.id, s.dataBranch); }),
    setProductStatus: handle(async (req) => ok(await products.setStatus(req.body.product_ids, req.body.status), 'อัปเดตสถานะสินค้าเรียบร้อยแล้ว')),

    // Category
    getCategories: handle(() => products.listCategories()),
    createCategory: handle(async (req) => created(await categories.create(req.body), 'เพิ่มหมวดหมู่เรียบร้อยแล้ว')),
    updateCategory: handle(async (req) => ok(await categories.update(req.params.id, req.body), 'บันทึกการแก้ไขเรียบร้อยแล้ว')),
    deleteCategory: handle(async (req) => ok(await categories.remove(req.params.id), 'ลบหมวดหมู่เรียบร้อยแล้ว')),

    // Stock Request Review + FIFO
    getRequests: handle(async (req) => { const s = await scope(req); return review.list(s.dataBranch, req.query.status); }),
    approveRequest: handle(async (req) => { const s = await scope(req); return ok(await review.approve(req.params.id, s.dataBranch, req.body.note, req.user.userId), 'อนุมัติคำขอเรียบร้อยแล้ว'); }),
    cancelRequest: handle(async (req) => { const s = await scope(req); return ok(await review.cancel(req.params.id, s.dataBranch, req.body.reason, req.user.userId), 'ดำเนินการยกเลิกคำขอเรียบร้อยแล้ว'); }),
    getFifoPlan: handle(async (req) => { const s = await scope(req); return review.plan(req.params.id, s.dataBranch); }),
    confirmFifo: handle(async (req) => { const s = await scope(req); return ok(await review.confirm(req.params.id, s.dataBranch, req.user.userId), 'บันทึกการจัดเตรียมสินค้าตามแผน FIFO สำเร็จ'); }),

    // Purchase Orders
    getPurchaseOrders: handle(async (req) => { const s = await scope(req); return delivery.list({ branch: s.branch, status: req.query.status, search: req.query.search }); }),
    getPurchaseOrder: handle(async (req) => {
        const detail = await delivery.detail(req.params.id);
        await assertBranchAccess(pool, req.user.userId, detail.branch_id);
        return detail;
    }),
    getPurchaseOrderForm: handle(async (req) => { const s = await scope(req); return purchaseOrders.formData(s.dataBranch); }),
    createPurchaseOrder: handle(async (req) => { const s = await scope(req); return created(await purchaseOrders.create(s.dataBranch, req.body, req.user.userId), 'สร้างใบสั่งซื้อเรียบร้อยแล้ว'); }),
    setPurchaseOrderStatus: handle(async (req) => ok(await purchaseOrders.setStatus(req.params.id, req.body.status, req.user.userId), 'บันทึกและอัปเดตสถานะการจัดซื้อสำเร็จ')),

    // Stock Arrival
    getPendingArrivals: handle(async (req) => { const s = await scope(req); return { pending: await arrivals.pending(s.dataBranch), history: await arrivals.history(s.dataBranch) }; }),
    receiveArrival: handle(async (req) => { const s = await scope(req); return created(await arrivals.receive(s.dataBranch, req.body, req.user.userId), 'บันทึกการรับสินค้าสำเร็จ'); }),

    // Quality Check
    getQuality: handle(async (req) => { const s = await scope(req); return arrivals.qualityList(s.dataBranch); }),
    inspectArrival: handle(async (req) => {
        await assertBranchAccess(pool, req.user.userId, await arrivals.arrivalBranch(req.body.arrival_id));
        return created(await arrivals.inspect(req.body, req.user.userId), 'บันทึกผลการตรวจสอบคุณภาพสินค้าเรียบร้อยแล้ว');
    }),

    // Expiry Check
    searchExpiry: handle(async (req) => { const s = await scope(req); return expiry.search(s.dataBranch, req.query); }),
    recordExpiry: handle(async (req) => { const s = await scope(req); return created(await expiry.record(s.dataBranch, req.body.checks, req.body.note, req.user.userId), 'บันทึกผลการตรวจสอบสินค้าหมดอายุสำเร็จ'); })
};

module.exports = { StaffController };
