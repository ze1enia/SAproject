/* Product Info (Staff) - read-only catalogue with stock, batches and price history */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;

    SA.pages['product-info'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', categories: [], products: [], search: '', category: '', status: '' };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        state.categories = await SA.api('/staff/categories');
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var q = [];
            if (state.search) q.push('search=' + encodeURIComponent(state.search));
            if (state.category) q.push('category=' + encodeURIComponent(state.category));
            if (state.status) q.push('status=' + encodeURIComponent(state.status));
            state.products = await SA.api('/staff/products' + (q.length ? '?' + q.join('&') : ''));
        }

        function draw() {
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) +
                    '<div class="grow"><input type="search" id="pi-search" class="search-input" placeholder="Search name, ID or barcode..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="pi-cat" class="select" aria-label="Category"><option value="">All categories</option>' +
                        state.categories.map(function (c) { return '<option value="' + esc(c.category_id) + '"' + (c.category_id === state.category ? ' selected' : '') + '>' + esc(c.category_name) + '</option>'; }).join('') + '</select>' +
                    '<select id="pi-status" class="select" aria-label="Status"><option value="">All status</option>' +
                        '<option value="Active"' + (state.status === 'Active' ? ' selected' : '') + '>Active</option><option value="Inactive"' + (state.status === 'Inactive' ? ' selected' : '') + '>Inactive</option></select>' +
                '</div>' +
                (state.products.length
                    ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Unit</th><th class="num">Price</th><th>Status</th><th class="actions">Detail</th></tr></thead><tbody>' +
                        state.products.map(function (p) {
                            return '<tr class="' + (p.product_status === 'Active' ? '' : 'is-inactive') + '"><td>' + esc(p.product_id) + '</td>' +
                                '<td><span class="strong">' + esc(p.product_name) + '</span>' + (p.barcode ? '<span class="sub">' + esc(p.barcode) + '</span>' : '') + '</td>' +
                                '<td class="cell-muted">' + esc(p.category_name) + '</td><td class="cell-muted">' + esc(p.unit) + '</td>' +
                                '<td class="num"><b>' + UI.money(p.selling_price) + '</b></td>' +
                                '<td>' + (p.product_status === 'Active' ? UI.badge('good', 'Active') : UI.badge('muted', 'Inactive')) + '</td>' +
                                '<td class="actions"><button type="button" class="link-button" data-detail="' + esc(p.product_id) + '">View</button></td></tr>';
                        }).join('') + '</tbody></table></div><p class="table-note">' + state.products.length + ' products · read-only</p>'
                    : UI.emptyState('ไม่พบสินค้าที่ค้นหา', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง'));

            S.onBranch(function (b) { state.branch = b; });
            var input = document.getElementById('pi-search');
            input.addEventListener('input', UI.debounce(async function () {
                state.search = input.value.trim(); await load();
                if (SA.route() !== route) return;
                draw(); var el = document.getElementById('pi-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
            }, 250));
            document.getElementById('pi-cat').addEventListener('change', async function (e) { state.category = e.target.value; await load(); if (SA.route() === route) draw(); });
            document.getElementById('pi-status').addEventListener('change', async function (e) { state.status = e.target.value; await load(); if (SA.route() === route) draw(); });
            main.querySelectorAll('[data-detail]').forEach(function (b) { b.addEventListener('click', function () { openDetail(b.getAttribute('data-detail')); }); });
        }

        async function openDetail(id) {
            var m = UI.modal({ title: 'Product · ' + id, wide: true, body: '<p class="loading">กำลังโหลดข้อมูล...</p>', actions: [{ label: 'ปิด', kind: 'ghost' }] });
            try {
                var d = await SA.api('/staff/products/' + encodeURIComponent(id) + '?branch=' + encodeURIComponent(state.branch));
                var p = d.product, margin = p.selling_price ? ((p.selling_price - p.cost_price) / p.selling_price) * 100 : 0;
                m.body.innerHTML =
                    '<div class="split" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px">' +
                        '<div><h3 style="margin:0 0 4px;font-size:20px">' + esc(p.product_name) + '</h3>' +
                            '<p class="cell-muted" style="margin:0 0 12px;font-size:13px">' + esc(p.category_name) + ' · ' + (p.product_status === 'Active' ? 'Active' : 'Inactive') + '</p>' +
                            '<dl class="kv"><dt>Unit</dt><dd>' + esc(p.unit) + '</dd><dt>Barcode</dt><dd>' + esc(p.barcode || '—') + '</dd>' +
                            '<dt>Cost</dt><dd>' + UI.money(p.cost_price) + '</dd><dt>Selling price</dt><dd>' + UI.money(p.selling_price) + ' <span class="cell-muted">(' + margin.toFixed(0) + '% margin)</span></dd></dl></div>' +
                        '<div class="panel"><h3>Stock · ' + esc(SA.branchName(state.list, state.branch)) + '</h3>' +
                            (d.stock ? '<dl class="kv"><dt>On hand</dt><dd>' + d.stock.on_hand + ' ' + esc(p.unit) + '</dd><dt>Reserved</dt><dd>' + d.stock.reserved + '</dd><dt>Available</dt><dd>' + (d.stock.on_hand - d.stock.reserved) + '</dd><dt>Updated</dt><dd>' + esc(d.stock.updated_at) + '</dd></dl>'
                                : '<p class="cell-muted" style="margin:0">ไม่มีสต็อกของสินค้านี้ในสาขา</p>') + '</div></div>' +
                    (d.batches.length ? '<h3 style="margin:18px 0 8px;font-size:15px">Batches</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Batch</th><th>Received</th><th>Expiry</th><th class="num">Remaining</th></tr></thead><tbody>' +
                        d.batches.map(function (b) { return '<tr><td class="strong">' + esc(b.batch_id) + '</td><td class="cell-muted">' + esc(String(b.received_at).split(' ')[0]) + '</td><td>' + esc(b.expiry_date || '—') + '</td><td class="num">' + b.quantity_remaining + ' / ' + b.quantity_received + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
                    (d.price_history.length ? '<h3 style="margin:18px 0 8px;font-size:15px">Price history</h3><ul class="history-list">' + d.price_history.map(function (h) {
                        return '<li><span>' + esc(h.changed_at) + ' · ' + esc(h.changed_by || '—') + '</span><span class="delta">' + UI.money(h.old_price) + ' → ' + UI.money(h.new_price) + '</span></li>'; }).join('') + '</ul>' : '');
            } catch (err) { m.body.innerHTML = '<p class="error-message">' + esc(err.message) + '</p>'; }
        }
    };
})();
