export class BranchController {
    constructor(service, elements) {
        this.service = service;
        this.elements = elements;
        this.selectedBranch = null;
    }

    async init() {
        this.bindEvents();
        await this.loadAndRenderBranches();
    }

    bindEvents() {
        this.elements.searchInput.addEventListener('input', async (e) => {
            const query = e.target.value;
            const results = await this.service.searchBranches(query);
            this.renderList(results);
        });
    }

    async loadAndRenderBranches() {
        const branches = await this.service.getAllBranches();
        this.renderList(branches);
    }

    handleSelectBranch(branch) {
        this.selectedBranch = branch;
        this.elements.selectedBranchText.textContent = `สาขาที่เลือก: ${branch.branch_name}`;
    }

    renderList(branches) {
        this.elements.branchContainer.innerHTML = '';

        if (branches.length === 0) {
            this.elements.branchContainer.innerHTML = '<p class="empty-msg">ไม่พบสาขาที่คุณค้นหา</p>';
            return;
        }

        branches.forEach(branch => {
            const card = document.createElement('div');
            const isSelected = this.selectedBranch?.branch_id === branch.branch_id;
            const isOpen = branch.isOpen();

            card.className = `branch-card ${isSelected ? 'active' : ''}`;
            
            card.innerHTML = `
                <div class="branch-header">
                    <h3>${branch.branch_name}</h3>
                    <span class="status ${isOpen ? 'open' : 'closed'}">
                        ${branch.getStatusText()}
                    </span>
                </div>
                <p>📍 ${branch.address}</p>
                <button class="select-btn" ${!isOpen ? 'disabled' : ''}>
                    ${isSelected ? 'เลือกอยู่' : 'เลือกสาขานี้'}
                </button>
            `;

            const selectBtn = card.querySelector('.select-btn');
            if (isOpen) {
                selectBtn.addEventListener('click', () => {
                    this.handleSelectBranch(branch);
                    this.renderList(branches);
                });
            }

            this.elements.branchContainer.appendChild(card);
        });
    }
}