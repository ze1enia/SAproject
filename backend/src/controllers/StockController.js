const { StockService } = require('../services/StockService');
const { handle, ApiError, toDataBranchId } = require('../utils/apiHelpers');

const service = new StockService();

const requireBranch = (req) => {
    if (!toDataBranchId(req.query.branch)) throw new ApiError(400, 'กรุณาเลือกสาขา');
    return req.query.branch;
};

const StockController = {
    getOverview: handle((req) => service.overview(requireBranch(req), { search: req.query.search })),
    getBatches: handle((req) => service.batches(requireBranch(req)))
};

module.exports = { StockController };
