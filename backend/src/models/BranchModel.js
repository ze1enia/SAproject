export class BranchModel {
    constructor({ branch_id, branch_name, address, branch_status }) {
        this.branch_id = branch_id;
        this.branch_name = branch_name;
        this.address = address;
        this.branch_status = branch_status;
    }

    isOpen() {
        return this.branch_status === 'OPEN' || 
               this.branch_status === 'active' || 
               this.branch_status === true;
    }

    getStatusText() {
        return this.isOpen() ? 'เปิดบริการ' : 'ปิดบริการ';
    }
}