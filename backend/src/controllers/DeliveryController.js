const { DeliveryService } = require('../services/DeliveryService');
const { handle, created } = require('../utils/apiHelpers');

const service = new DeliveryService();

const DeliveryController = {
    getDeliveries: handle((req) => service.list(req.query)),
    getDeliveryById: handle((req) => service.detail(req.params.id)),

    getSuppliers: handle(() => service.listSuppliers()),
    getQcIssues: handle((req) => service.qcIssues(req.query)),
    getClaims: handle((req) => service.listClaims(req.query)),
    createClaim: handle(async (req) =>
        created(await service.createClaim(req.body, req.user.userId), 'ส่งคำร้องติดต่อ Supplier เรียบร้อยแล้ว'))
};

module.exports = { DeliveryController };
