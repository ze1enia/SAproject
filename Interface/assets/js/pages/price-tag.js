/* Price Tag (UC-15) - pick a product, see the shelf label, set a new selling price */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    SA.pages['price-tag'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { products: [], search: '', selected: null, history: [] };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        var loaded = await Promise.all([SA.api('/products?status=active'), SA.api('/products/price-history?limit=6')]);
        if (SA.route() !== route) return;
        state.products = loaded[0];
        state.history = loaded[1];

        main.innerHTML = SA.pageHeader(title) +
            '<div class="split">' +
                '<section aria-label="Products">' +
                    '<div class="toolbar"><div class="grow"><input type="search" id="pt-search" class="search-input" placeholder="Search product, ID or barcode..." aria-label="Search products"></div></div>' +
                    '<div class="picker-list" id="pt-list"></div>' +
                    '<p class="table-note" id="pt-count"></p>' +
                '</section>' +
                '<aside class="sticky-panel" id="pt-panel" aria-live="polite"></aside>' +
            '</div>';

        var search = document.getElementById('pt-search');
        search.addEventListener('input', UI.debounce(function () { state.search = search.value.trim().toLowerCase(); drawList(); }, 120));
        drawList();
        drawPanel();

        function drawList() {
            var rows = state.products.filter(function (p) {
                return !state.search || [p.product_name, p.product_id, p.barcode].some(function (v) { return String(v || '').toLowerCase().indexOf(state.search) !== -1; });
            });
            var list = document.getElementById('pt-list');
            list.innerHTML = rows.length ? rows.map(function (p) {
                return '<button type="button" class="picker-item' + (p.product_id === state.selected ? ' is-selected' : '') + '" data-id="' + esc(p.product_id) + '">' +
                    '<span class="name">' + esc(p.product_name) + '</span>' +
                    '<span class="meta">' + esc(p.product_id) + ' · ' + esc(p.category_name) + ' · cost ' + UI.money(p.cost_price) + '</span>' +
                    '<span class="price">' + UI.money(p.selling_price) + '</span></button>';
            }).join('') : '<div style="padding:18px">' + UI.emptyState('ไม่พบสินค้าที่ค้นหา') + '</div>';
            document.getElementById('pt-count').textContent = 'Showing ' + rows.length + ' of ' + state.products.length + ' active products';

            list.querySelectorAll('[data-id]').forEach(function (b) {
                b.addEventListener('click', function () { select(b.getAttribute('data-id')); });
            });
        }

        async function select(id) {
            state.selected = id;
            drawList();
            drawPanel();
            try {
                var history = await SA.api('/products/price-history?product_id=' + encodeURIComponent(id) + '&limit=6');
                if (SA.route() !== route || state.selected !== id) return;
                state.history = history;
                drawHistory();
            } catch (err) { /* history is a nicety - the form still works */ }
        }

        function current() { return state.products.filter(function (p) { return p.product_id === state.selected; })[0]; }

        function tagHTML(p, newPrice) {
            var shown = newPrice !== null ? newPrice : p.selling_price;
            return '<div class="price-tag' + (newPrice !== null ? ' is-preview' : '') + '" aria-label="Price tag preview">' +
                '<span class="pt-name">' + esc(p.product_name) + '</span>' +
                '<span class="pt-meta">' + esc(p.product_id) + ' · per ' + esc(p.unit) + '</span>' +
                '<span class="pt-price"><span>฿</span><strong>' + Number(shown).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong></span>' +
                (newPrice !== null ? '<span class="pt-old">was ' + UI.money(p.selling_price) + '</span>' : '') +
                '<span class="pt-barcode" aria-hidden="true"></span>' +
            '</div>';
        }

        function drawPanel() {
            var panel = document.getElementById('pt-panel');
            var p = current();
            if (!p) {
                panel.innerHTML = '<div class="panel"><h3>Price tag</h3>' + UI.emptyState('เลือกสินค้าจากรายการเพื่อปรับปรุงป้ายราคา') + '</div>' +
                    '<div class="panel"><h3>Recent changes</h3><div id="pt-history"></div></div>';
                drawHistory();
                return;
            }

            panel.innerHTML =
                '<div class="panel">' +
                    '<h3>Price tag</h3>' +
                    '<div id="pt-tag">' + tagHTML(p, null) + '</div>' +
                    '<form id="pt-form" novalidate style="margin-top:16px">' +
                        '<div class="field">' +
                            '<label for="pt-price">New selling price</label>' +
                            '<div class="input-prefix"><span>฿</span><input class="input" id="pt-price" inputmode="decimal" autocomplete="off" placeholder="' + esc(p.selling_price) + '"></div>' +
                            '<p class="margin-note" id="pt-margin">Cost ' + UI.money(p.cost_price) + ' · current margin <b>' + marginText(p.selling_price, p.cost_price) + '</b></p>' +
                            '<p class="field-error" id="pt-error" role="alert" hidden></p>' +
                        '</div>' +
                        '<div class="toolbar" style="margin:16px 0 0">' +
                            '<button type="submit" class="btn btn-primary" id="pt-save">ยืนยันการปรับปรุงป้ายราคา</button>' +
                            '<button type="button" class="btn btn-ghost" id="pt-cancel">ยกเลิก</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
                '<div class="panel"><h3>Recent changes</h3><div id="pt-history"></div></div>';
            drawHistory();

            var input = document.getElementById('pt-price');
            input.addEventListener('input', function () { preview(p); });
            document.getElementById('pt-cancel').addEventListener('click', function () { input.value = ''; showError(''); preview(p); input.focus(); });
            document.getElementById('pt-form').addEventListener('submit', function (e) { e.preventDefault(); save(p); });
        }

        function marginText(price, cost) { return price > 0 ? (((price - cost) / price) * 100).toFixed(0) + '%' : '–'; }

        function parsePrice() {
            var raw = document.getElementById('pt-price').value.trim();
            var n = Number(raw);
            return raw && isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
        }

        function showError(message) {
            var el = document.getElementById('pt-error'), input = document.getElementById('pt-price');
            el.hidden = !message; el.textContent = message || '';
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
        }

        function preview(p) {
            var price = parsePrice();
            var raw = document.getElementById('pt-price').value.trim();
            showError('');
            document.getElementById('pt-tag').innerHTML = tagHTML(p, price !== null && price !== p.selling_price ? price : null);
            var note = document.getElementById('pt-margin');
            if (price === null) {
                note.className = 'margin-note';
                note.innerHTML = 'Cost ' + UI.money(p.cost_price) + ' · current margin <b>' + marginText(p.selling_price, p.cost_price) + '</b>';
                return;
            }
            var low = price <= p.cost_price;
            note.className = 'margin-note' + (low ? ' is-low' : '');
            note.innerHTML = 'New margin <b>' + marginText(price, p.cost_price) + '</b>' + (low ? ' — ต่ำกว่าหรือเท่ากับต้นทุน ' + UI.money(p.cost_price) : ' · was ' + marginText(p.selling_price, p.cost_price));
            if (!raw) note.className = 'margin-note';
        }

        async function save(p) {
            var price = parsePrice();
            if (price === null) {
                showError('กรุณาระบุราคาขายที่ถูกต้อง (ต้องเป็นตัวเลขมากกว่า 0)');
                document.getElementById('pt-price').focus();
                return;
            }
            if (price === p.selling_price) { showError('ราคาใหม่เท่ากับราคาปัจจุบัน'); return; }

            var btn = document.getElementById('pt-save');
            btn.disabled = true;
            try {
                var updated = await SA.api('/products/' + encodeURIComponent(p.product_id) + '/price', { method: 'PUT', body: { selling_price: price } });
                p.selling_price = updated.selling_price;
                UI.toast('ปรับปรุงป้ายราคาสำเร็จ');
                state.history = await SA.api('/products/price-history?product_id=' + encodeURIComponent(p.product_id) + '&limit=6');
                if (SA.route() !== route) return;
                drawList();
                drawPanel();
            } catch (err) {
                btn.disabled = false;
                showError(err.message);
            }
        }

        function drawHistory() {
            var el = document.getElementById('pt-history');
            if (!el) return;
            el.innerHTML = state.history.length ? '<ul class="history-list">' + state.history.map(function (h) {
                var diff = h.new_price - h.old_price;
                return '<li><span>' + esc(h.product_name) + '</span>' +
                    '<span class="delta ' + (diff > 0 ? 'amount-out' : 'amount-in') + '" title="' + (diff > 0 ? 'Price up' : 'Price down') + '">' + (diff > 0 ? '▲' : '▼') + ' ' + UI.money(h.old_price) + ' → ' + UI.money(h.new_price) + '</span>' +
                    '<span class="when">' + esc(h.changed_at) + ' · ' + esc(h.changed_by || '—') + '</span></li>';
            }).join('') + '</ul>' : '<p class="cell-muted" style="margin:0;font-size:13px">ยังไม่มีประวัติการปรับราคา</p>';
        }
    };
})();
