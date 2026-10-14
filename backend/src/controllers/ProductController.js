const { ProductService } = require('../services/ProductService');
const { handle, created, ok, ApiError } = require('../utils/apiHelpers');

const service = new ProductService();

const ProductController = {
    getCategories: handle(() => service.listCategories()),

    getProducts: handle((req) => service.listProducts(req.query)),

    getProductById: handle(async (req) => {
        const product = await service.getProduct(req.params.id);
        if (!product) {
            throw new ApiError(404, `ไม่พบสินค้ารหัส ${req.params.id}`);
        }
        return product;
    }),

    createProduct: handle(async (req) => created(await service.createProduct(req.body), 'เพิ่มสินค้าเรียบร้อยแล้ว')),

    updateProduct: handle(async (req) =>
        ok(await service.updateProduct(req.params.id, { ...req.body, __userId: req.user.userId }), 'บันทึกการแก้ไขเรียบร้อยแล้ว')),

    // soft delete (product_status = inactive)
    deleteProduct: handle(async (req) => ok(await service.deactivateProduct(req.params.id), 'ปิดการใช้งานสินค้าเรียบร้อยแล้ว')),

    updatePrice: handle(async (req) =>
        ok(await service.updatePrice(req.params.id, req.body.selling_price, req.user.userId), 'ปรับปรุงป้ายราคาสำเร็จ')),

    getPriceHistory: handle((req) => service.priceHistory({ productId: req.query.product_id, limit: req.query.limit }))
};

module.exports = { ProductController };
