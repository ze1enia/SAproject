/* Product Status (Staff) - mark one or many products as available (active) or unavailable (inactive) */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    SA.pages['product-status'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { categories: [], products: [], search: '', category: '', status: '', selected: {} };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
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
            var ids = {}; state.products.forEach(function (p) { ids[p.product_id] = true; });
            Object.keys(state.selected).forEach(function (id) { if (!ids[id]) delete state.selected[id]; });
        }

        function chosen() { return Object.keys(state.selected); }

        function draw() {
            var active = state.products.filter(function (p) { return p.product_status === 'Active'; }).length;
            main.innerHTML = SA.pageHeader(title) +
                '<div class="stat-row">' + UI.statTile('Products shown', UI.int(state.products.length)) +
                    UI.statTile('Active', UI.int(active), 'available for sale / ordering') +
                    UI.statTile('Inactive', UI.int(state.products.length - active), 'hidden from ordering', state.products.length - active ? 'warn' : '') + '</div>' +
                '<div class="toolbar">' +
                    '<div class="grow"><input type="search" id="ps-search" class="search-input" placeholder="Search name, ID or barcode..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="ps-cat" class="select" aria-label="Category"><option value="">All categories</option>' +
                        state.categories.map(function (c) { return '<option value="' + esc(c.category_id) + '"' + (c.category_id === state.category ? ' selected' : '') + '>' + esc(c.category_name) + '</option>'; }).join('') + '</select>' +
                    '<select id="ps-status" class="select" aria-label="Status"><option value="">All status</option>' +
                        '<option value="Active"' + (state.status === 'Active' ? ' selected' : '') + '>Active</option><option value="Inactive"' + (state.status === 'Inactive' ? ' selected' : '') + '>Inactive</option></select>' +
                '</div>' +
                (state.products.length ? table() : UI.emptyState('ไม่พบสินค้าที่ค้นหา')) +
                '<div class="submit-bar" id="ps-bar"></div>';

            var input = document.getElementById('ps-search');
            input.addEventListener('input', UI.debounce(async function () {
                state.search = input.value.trim(); await load();
                if (SA.route() !== route) return;
                draw(); var el = document.getElementById('ps-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
            }, 250));
            document.getElementById('ps-cat').addEventListener('change', async function (e) { state.category = e.target.value; await load(); if (SA.route() === route) draw(); });
            document.getElementById('ps-status').addEventListener('change', async function (e) { state.status = e.target.value; await load(); if (SA.route() === route) draw(); });

            var all = document.getElementById('ps-all');
            if (all) all.addEventListener('change', function () {
                state.products.forEach(function (p) { if (all.checked) state.selected[p.product_id] = true; else delete state.selected[p.product_id]; });
                main.querySelectorAll('[data-pick]').forEach(function (c) { c.checked = all.checked; c.closest('tr').classList.toggle('is-checked', all.checked); });
                drawBar();
            });
            main.querySelectorAll('[data-pick]').forEach(function (c) {
                c.addEventListener('change', function () {
                    var id = c.getAttribute('data-pick');
                    if (c.checked) state.selected[id] = true; else delete state.selected[id];
                    c.closest('tr').classList.toggle('is-checked', c.checked);
                    drawBar();
                });
            });
            drawBar();
        }

        function table() {
            var allOn = state.products.every(function (p) { return state.selected[p.product_id]; });
            return '<div class="table-scroll"><table class="data-table"><thead><tr><th class="check-cell"><input type="checkbox" id="ps-all" aria-label="Select all shown"' + (allOn ? ' checked' : '') + '></th><th>Product</th><th>Category</th><th>Status</th></tr></thead><tbody>' +
                state.products.map(function (p) {
                    var on = !!state.selected[p.product_id];
                    return '<tr class="' + (on ? 'is-checked ' : '') + (p.product_status === 'Active' ? '' : 'is-inactive') + '"><td class="check-cell"><input type="checkbox" data-pick="' + esc(p.product_id) + '" aria-label="Select ' + esc(p.product_name) + '"' + (on ? ' checked' : '') + '></td>' +
                        '<td><span class="strong">' + esc(p.product_name) + '</span><span class="sub">' + esc(p.product_id) + '</span></td>' +
                        '<td class="cell-muted">' + esc(p.category_name) + '</td>' +
                        '<td>' + (p.product_status === 'Active' ? UI.badge('good', 'Active · พร้อมใช้งาน') : UI.badge('muted', 'Inactive · ไม่พร้อมใช้งาน')) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        function drawBar() {
            var n = chosen().length, bar = document.getElementById('ps-bar');
            bar.innerHTML = '<span class="summary"><b>' + n + '</b> selected</span>' +
                '<button type="button" class="btn btn-ghost" id="ps-inactive"' + (n ? '' : ' disabled') + '>ตั้งเป็นไม่พร้อมใช้งาน</button>' +
                '<button type="button" class="btn btn-primary" id="ps-active"' + (n ? '' : ' disabled') + '>ตั้งเป็นพร้อมใช้งาน</button>';
            document.getElementById('ps-inactive').addEventListener('click', function () { apply('Inactive'); });
            document.getElementById('ps-active').addEventListener('click', function () { apply('Active'); });
        }

        async function apply(status) {
            var ids = chosen();
            if (!ids.length) { UI.toast('โปรดเลือกสินค้าอย่างน้อย 1 รายการ', 'bad'); return; }
            var label = status === 'Active' ? 'พร้อมใช้งาน (Active)' : 'ไม่พร้อมใช้งาน (Inactive)';
            var ok = await UI.confirm({ title: 'อัปเดตสถานะสินค้า', message: 'ตั้งสถานะสินค้า <b>' + ids.length + '</b> รายการเป็น <b>' + label + '</b> ?' +
                (status === 'Inactive' ? '<br>สินค้าจะไม่แสดงในใบสั่งซื้อและคำขอ Stock' : ''), confirmLabel: 'อัปเดตสถานะ', danger: status === 'Inactive' });
            if (!ok) return;
            try {
                await SA.api('/staff/products/status', { method: 'PUT', body: { product_ids: ids, status: status } });
                UI.toast('อัปเดตสถานะสินค้าเรียบร้อยแล้ว');
                state.selected = {};
                await load();
                if (SA.route() === route) draw();
            } catch (err) { UI.toast(err.message, 'bad'); }
        }
    };
})();
