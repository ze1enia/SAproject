// Sidebar menu per role. Keys match users.role_id (upper-cased).
const MENU_CONFIG = {
    OWNER: {
        roleLabel: 'Owner',
        items: [
            { id: 'branch', label: 'Branch Menu', icon: '⌂' },
            { id: 'product-category', label: 'Product & Category', icon: '▤' },
            { id: 'stock-overview', label: 'Stock Overview', icon: '▥' },
            { id: 'price-tag', label: 'Price Tag', icon: '฿' },
            { id: 'stock-request', label: 'Stock Request', icon: '⇄' },
            { id: 'supplier-claim', label: 'Supplier / Claim', icon: '✉' },
            { id: 'delivery-status', label: 'Delivery Status', icon: '➜' },
            { id: 'sales-report', label: 'Sales Report', icon: '▦' },
            { id: 'budget', label: 'Budget', icon: '◔' }
        ]
    },
    STAFF: {
        roleLabel: 'Staff',
        items: [
            { id: 'manage-stock', label: 'Manage Stock', icon: '▤' },
            { id: 'product-info', label: 'Product Info', icon: 'ⓘ' },
            { id: 'product-status', label: 'Product Status', icon: '◉' },
            { id: 'category', label: 'Category', icon: '▦' },
            { id: 'stock-request-review', label: 'Stock Request Review', icon: '⇄' },
            { id: 'fifo-procedures', label: 'FIFO Procedures', icon: '⇣' },
            { id: 'expiry-check', label: 'Expiry Check', icon: '◷' },
            { id: 'purchase-orders', label: 'Purchase Orders', icon: '✎' },
            { id: 'stock-arrival', label: 'Stock Arrival', icon: '⬇' },
            { id: 'quality-check', label: 'Quality Check', icon: '✓' }
        ]
    }
};

const getMenuForRole = (role) =>
    MENU_CONFIG[String(role || '').toUpperCase()] || MENU_CONFIG.STAFF;

module.exports = { MENU_CONFIG, getMenuForRole };
