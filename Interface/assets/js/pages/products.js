/* Product & Category (UC-14) - list, search, add / edit, soft delete + category overview */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    SA.pages['product-category'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { tab: 'products', categories: [], products: [], search: '', category: '', status: '' };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.categories = await SA.api('/products/categories');
        if (SA.route() !== route) return;

        await loadProducts();
        if (SA.route() !== route) return;
        draw();

        async function loadProducts() {
            var q = [];
            if (state.search) q.push('search=' + encodeURIComponent(state.search));
            if (state.category) q.push('category=' + encodeURIComponent(state.category));
            if (state.status) q.push('status=' + encodeURIComponent(state.status));
            state.products = await SA.api('/products' + (q.length ? '?' + q.join('&') : ''));
        }

        function draw() {
            var tabs = UI.tabs([
                { id: 'products', label: 'Products', count: state.products.length },
                { id: 'categories', label: 'Categories', count: state.categories.length }
            ], state.tab);

            main.innerHTML = SA.pageHeader(title) + tabs.html + '<div id="pc-body"></div>';
            tabs.bind(main, function (id) { state.tab = id; draw(); });
            (state.tab === 'products' ? drawProducts : drawCategories)(document.getElementById('pc-body'));
        }

        /* ------------------------------------------------------- products */

        function drawProducts(body) {
            body.innerHTML =
                '<div class="toolbar">' +
                    '<div class="grow"><input type="search" id="pc-search" class="search-input" placeholder="Search name, ID or barcode..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="pc-category" class="select" aria-label="Category"><option value="">All categories</option>' + categoryOptions(state.category) + '</select>' +
                    '<select id="pc-status" class="select" aria-label="Status">' +
                        '<option value="">All status</option>' +
                        '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>Active</option>' +
                        '<option value="inactive"' + (state.status === 'inactive' ? ' selected' : '') + '>Inactive</option>' +
                    '</select>' +
                    '<button type="button" class="btn btn-primary" id="pc-new">+ New product</button>' +
                '</div>' +
                (state.products.length ? productTable() : UI.emptyState('ไม่พบสินค้าที่ค้นหา', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง')) +
                '<p class="table-note">การลบสินค้าเป็นการปิดการใช้งาน (Inactive) เพื่อเก็บประวัติการสั่งซื้อและสต็อกไว้</p>';

            var refresh = async function () { await loadProducts(); if (SA.route() === route) draw(); };
            var searchInput = document.getElementById('pc-search');
            searchInput.addEventListener('input', UI.debounce(function () { state.search = searchInput.value.trim(); refresh().then(keepFocus); }, 250));
            document.getElementById('pc-category').addEventListener('change', function (e) { state.category = e.target.value; refresh(); });
            document.getElementById('pc-status').addEventListener('change', function (e) { state.status = e.target.value; refresh(); });
            document.getElementById('pc-new').addEventListener('click', function () { openForm(null); });

            body.querySelectorAll('[data-edit]').forEach(function (b) {
                b.addEventListener('click', function () { openForm(findProduct(b.getAttribute('data-edit'))); });
            });
            body.querySelectorAll('[data-delete]').forEach(function (b) {
                b.addEventListener('click', function () { removeProduct(findProduct(b.getAttribute('data-delete'))); });
            });
            body.querySelectorAll('[data-restore]').forEach(function (b) {
                b.addEventListener('click', function () { restoreProduct(findProduct(b.getAttribute('data-restore'))); });
            });
        }

        function keepFocus() {
            var el = document.getElementById('pc-search');
            if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }

        function findProduct(id) { return state.products.filter(function (p) { return p.product_id === id; })[0]; }

        function categoryOptions(selected) {
            return state.categories.map(function (c) {
                return '<option value="' + esc(c.category_id) + '"' + (c.category_id === selected ? ' selected' : '') + '>' + esc(c.category_name) + '</option>';
            }).join('');
        }

        function productTable() {
            return '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>ID</th><th>Product</th><th>Category</th><th>Unit</th><th class="num">Cost</th><th class="num">Price</th><th class="num">Margin</th><th>Status</th><th class="actions">Actions</th></tr></thead><tbody>' +
                state.products.map(function (p) {
                    var margin = p.selling_price ? ((p.selling_price - p.cost_price) / p.selling_price) * 100 : 0;
                    var active = p.product_status === 'active';
                    return '<tr class="' + (active ? '' : 'is-inactive') + '">' +
                        '<td>' + esc(p.product_id) + '</td>' +
                        '<td><span class="strong">' + esc(p.product_name) + '</span>' + (p.barcode ? '<span class="sub">' + esc(p.barcode) + '</span>' : '') + '</td>' +
                        '<td class="cell-muted">' + esc(p.category_name) + '</td>' +
                        '<td class="cell-muted">' + esc(p.unit) + '</td>' +
                        '<td class="num">' + UI.money(p.cost_price) + '</td>' +
                        '<td class="num"><b>' + UI.money(p.selling_price) + '</b></td>' +
                        '<td class="num">' + margin.toFixed(0) + '%</td>' +
                        '<td>' + (active ? UI.badge('good', 'Active') : UI.badge('muted', 'Inactive')) + '</td>' +
                        '<td class="actions"><span class="row-actions">' +
                            '<button type="button" class="link-button" data-edit="' + esc(p.product_id) + '">Edit</button>' +
                            (active
                                ? '<button type="button" class="link-button is-danger" data-delete="' + esc(p.product_id) + '">Delete</button>'
                                : '<button type="button" class="link-button" data-restore="' + esc(p.product_id) + '">Restore</button>') +
                        '</span></td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        /* ------------------------------------------------------ add / edit */

        function openForm(product) {
            var isEdit = !!product;
            var p = product || { product_name: '', category_id: state.category || '', barcode: '', unit: '', cost_price: '', selling_price: '', product_status: 'active' };

            var m = UI.modal({
                title: isEdit ? 'Edit product · ' + p.product_id : 'New product',
                wide: true,
                body:
                    '<form id="pf" novalidate class="form-grid">' +
                        field('product_name', 'Product name', '<input class="input" name="product_name" value="' + esc(p.product_name) + '" autocomplete="off" required>', true, 'full') +
                        field('category_id', 'Category', '<select class="select input" name="category_id" required><option value="">— Select category —</option>' + categoryOptions(p.category_id) + '</select>', true) +
                        field('unit', 'Unit', '<input class="input" name="unit" value="' + esc(p.unit) + '" placeholder="pack, bottle, kg..." autocomplete="off" required>', true) +
                        field('cost_price', 'Cost price', '<div class="input-prefix"><span>฿</span><input class="input" name="cost_price" inputmode="decimal" value="' + esc(p.cost_price) + '" required></div>', true) +
                        field('selling_price', 'Selling price', '<div class="input-prefix"><span>฿</span><input class="input" name="selling_price" inputmode="decimal" value="' + esc(p.selling_price) + '" required></div>', true) +
                        field('barcode', 'Barcode', '<input class="input" name="barcode" value="' + esc(p.barcode) + '" autocomplete="off">', false, 'full', 'Optional') +
                    '</form>',
                actions: [
                    { label: 'ยกเลิก', kind: 'ghost' },
                    { label: isEdit ? 'บันทึกการแก้ไข' : 'บันทึกสินค้าใหม่', kind: 'primary', onClick: function (modal) { submit(modal, isEdit ? p : null); } }
                ]
            });
            m.el.querySelector('#pf').addEventListener('submit', function (e) { e.preventDefault(); });
        }

        function field(name, label, control, required, extraClass, hint) {
            control = control.replace('name="' + name + '"', 'id="pf-' + name + '" name="' + name + '"');
            return '<div class="field ' + (extraClass || '') + '" data-field="' + name + '"><label for="pf-' + name + '">' + esc(label) + (required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' +
                control + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '<p class="field-error" hidden></p></div>';
        }

        function validate(form) {
            var errors = {};
            var v = function (n) { return String(form.elements[n].value || '').trim(); };
            if (!v('product_name')) errors.product_name = 'กรุณาระบุชื่อสินค้า';
            if (!v('category_id')) errors.category_id = 'กรุณาเลือกหมวดหมู่';
            if (!v('unit')) errors.unit = 'กรุณาระบุหน่วยนับ';
            ['cost_price', 'selling_price'].forEach(function (n) {
                var num = Number(v(n));
                if (!v(n) || !isFinite(num) || num <= 0) errors[n] = 'ต้องเป็นตัวเลขที่มากกว่า 0';
            });
            form.querySelectorAll('[data-field]').forEach(function (f) {
                var name = f.getAttribute('data-field'), msg = errors[name];
                var err = f.querySelector('.field-error');
                err.hidden = !msg; err.textContent = msg || '';
                var control = form.elements[name];
                if (control) control.setAttribute('aria-invalid', msg ? 'true' : 'false');
            });
            return errors;
        }

        async function submit(modal, existing) {
            var form = modal.el.querySelector('#pf');
            var errors = validate(form);
            var firstBad = Object.keys(errors)[0];
            if (firstBad) { modal.error('ข้อมูลที่กรอกมาไม่ถูกต้อง'); form.elements[firstBad].focus(); return; }
            modal.error('');

            var payload = {};
            ['product_name', 'category_id', 'unit', 'cost_price', 'selling_price', 'barcode'].forEach(function (n) { payload[n] = form.elements[n].value.trim(); });

            modal.setBusy(true);
            try {
                if (existing) {
                    payload.product_status = existing.product_status;
                    await SA.api('/products/' + encodeURIComponent(existing.product_id), { method: 'PUT', body: payload });
                } else {
                    await SA.api('/products', { method: 'POST', body: payload });
                }
                modal.close();
                UI.toast(existing ? 'บันทึกการแก้ไขเรียบร้อยแล้ว' : 'เพิ่มสินค้าเรียบร้อยแล้ว');
                state.categories = await SA.api('/products/categories');
                await loadProducts();
                if (SA.route() === route) draw();
            } catch (err) {
                modal.setBusy(false);
                modal.error(err.message);
            }
        }

        async function removeProduct(p) {
            var ok = await UI.confirm({
                title: 'ลบสินค้า',
                message: 'ปิดการใช้งาน <b>' + esc(p.product_name) + '</b> (' + esc(p.product_id) + ') ?<br>สินค้าจะไม่แสดงในรายการสั่งซื้อและป้ายราคา แต่ประวัติเดิมยังอยู่ และกู้คืนได้ภายหลัง',
                confirmLabel: 'ลบสินค้า',
                danger: true
            });
            if (!ok) return;
            try {
                await SA.api('/products/' + encodeURIComponent(p.product_id), { method: 'DELETE' });
                UI.toast('ปิดการใช้งานสินค้าเรียบร้อยแล้ว');
                await loadProducts();
                if (SA.route() === route) draw();
            } catch (err) { UI.toast(err.message, 'bad'); }
        }

        async function restoreProduct(p) {
            try {
                await SA.api('/products/' + encodeURIComponent(p.product_id), {
                    method: 'PUT',
                    body: { product_name: p.product_name, category_id: p.category_id, unit: p.unit, cost_price: p.cost_price, selling_price: p.selling_price, barcode: p.barcode, product_status: 'active' }
                });
                UI.toast('เปิดใช้งานสินค้าอีกครั้งแล้ว');
                await loadProducts();
                if (SA.route() === route) draw();
            } catch (err) { UI.toast(err.message, 'bad'); }
        }

        /* ------------------------------------------------------ categories */

        function drawCategories(body) {
            var max = Math.max.apply(null, state.categories.map(function (c) { return c.product_count; }).concat(1));
            body.innerHTML = '<div class="card-grid">' + state.categories.map(function (c) {
                return '<article class="info-card" data-tip="' + esc(c.category_name + ': ' + c.product_count + ' products (' + c.active_count + ' active)') + '">' +
                    '<h4>' + esc(c.category_name) + '</h4>' +
                    '<p>' + esc(c.description) + '</p>' +
                    '<div class="cell-bar"><span class="bar-track"><span class="bar" style="width:' + (c.product_count ? Math.max(6, (c.product_count / max) * 100) : 0) + '%"></span></span><b>' + c.product_count + '</b></div>' +
                    '<div class="card-foot"><span class="cell-muted">' + esc(c.category_id) + '</span>' +
                        '<button type="button" class="link-button" data-cat="' + esc(c.category_id) + '">View products →</button></div>' +
                '</article>';
            }).join('') + '</div>';

            body.querySelectorAll('[data-cat]').forEach(function (b) {
                b.addEventListener('click', async function () {
                    state.category = b.getAttribute('data-cat'); state.tab = 'products';
                    await loadProducts();
                    if (SA.route() === route) draw();
                });
            });
        }
    };
})();
