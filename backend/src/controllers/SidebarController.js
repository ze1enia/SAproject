import { MENU_CONFIG } from '../config/menuConfig.js';
import { BranchController } from './BranchController.js';
import { BranchService } from '../services/BranchService.js';

export class SidebarController {
    // รับ userData จากการ Login เข้ามา
    constructor(userData, sidebarSelector, mainContentId) {
        this.user = userData;
        this.role = (userData?.role || 'STAFF').toUpperCase();
        this.config = MENU_CONFIG[this.role] || MENU_CONFIG.STAFF;
        
        this.sidebarContainer = document.querySelector(sidebarSelector);
        this.mainContent = document.getElementById(mainContentId);
        this.branchService = new BranchService();
    }

    init() {
        this.renderSidebar();
        this.bindEvents();
        
        if (this.config.items.length > 0) {
            this.loadPage(this.config.items[0].id);
        }
    }

    renderSidebar() {
        const menuButtonsHTML = this.config.items.map((item, index) => `
            <button class="menu-item ${index === 0 ? 'active' : ''}" data-menu="${item.id}">
                ${item.label}
            </button>
        `).join('');

        // ดึงชื่อผู้ใช้จาก this.user.name มาใส่ตรง <h2> แบบ Dynamic
        this.sidebarContainer.innerHTML = `
            <div class="sidebar-header">
                <h2>${this.user.name || 'User'}</h2>
                <span>${this.config.roleLabel}</span>
            </div>
            <nav class="sidebar-menu">
                ${menuButtonsHTML}
            </nav>
        `;
    }

    bindEvents() {
        const menuItems = this.sidebarContainer.querySelectorAll('.menu-item');
        
        menuItems.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetMenu = e.currentTarget.getAttribute('data-menu');
                menuItems.forEach(btn => btn.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.loadPage(targetMenu);
            });
        });
    }

    async loadPage(menuKey) {
        this.mainContent.innerHTML = '<p class="loading">กำลังโหลดข้อมูล...</p>';

        switch (menuKey) {
            case 'branch':
                await this.renderBranchView();
                break;
            default:
                const menuItem = this.config.items.find(item => item.id === menuKey);
                const title = menuItem ? menuItem.label : menuKey;
                this.mainContent.innerHTML = `<h2>${title}</h2><p>หน้านี้กำลังอยู่ระหว่างการพัฒนา</p>`;
                break;
        }
    }

    async renderBranchView() {
        this.mainContent.innerHTML = `
            <div class="branch-page-header">
                <h2>Branch Menu</h2>
                <div class="search-bar-container">
                    <input type="text" id="branch-search-input" placeholder="Search for branches...">
                </div>
            </div>
            <table class="branch-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Branch name</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="branch-table-body"></tbody>
            </table>
        `;

        const elements = {
            searchInput: document.getElementById('branch-search-input'),
            tableBody: document.getElementById('branch-table-body')
        };

        const branchController = new BranchController(this.branchService, elements);
        await branchController.init();
    }
}