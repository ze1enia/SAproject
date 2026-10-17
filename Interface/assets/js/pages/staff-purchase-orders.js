/* Purchase Orders (Staff, UC-09) - create orders, send them to the supplier, follow the status */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;
    var ORDER = { Draft: ['muted', 'Draft'], Sent: ['info', 'Sent'], PartiallyReceived: ['warn', 'Partially received'], Received: ['good', 'Received'], Cancelled: ['bad', 'Cancelled'] };
    function orderBadge(s) { var m = ORDER[s] || ['muted', s]; return UI.badge(m[0], m[1]); }

    SA.pages['purchase-orders'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', status: '', search: '', data: null, selected: null, detail: null, form: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var q = ['branch=' + encodeURIComponent(state.branch)];
            if (state.status) q.push('status=' + encodeURIComponent(state.status));
            if (state.search) q.push('search=' + encodeURIComponent(state.search));
            state.data = await SA.api('/staff/purchase-orders?' + q.join('&'));
        }

        function draw() {
            var s = state.data.summary;
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) +
                    '<div class="grow"><input type="search" id="po-search" class="search-input" placeholder="Search purchase order ID..." aria-label="Search purchase order" value="' + esc(state.search) + '"></div>' +
                    '<select id="po-status" class="select" aria-label="Status"><option value="">All status</option>' + Object.keys(ORDER).map(function (k) { return '<option value="' + k + '"' + (state.status === k ? ' selected' : '') + '>' + esc(ORDER[k][1]) + '</option>'; }).join('') + '</select>' +
                    '<button type="button" class="btn btn-primary" id="po-new">+ New purchase order</button></div>' +
                '<div class="stat-row">' + UI.statTile('Purchase orders', UI.int(s.orders)) + UI.statTile('Waiting for delivery', UI.int(s.waiting), 'sent, not arrived', s.waiting ? 'rust' : '') +
                    UI.statTile('Partially received', UI.int(s.partial), null, s.partial ? 'warn' : '') + UI.statTile('Received', UI.int(s.received)) + '</div>' +
                '<div class="split"><section id="po-table"></section><aside class="sticky-panel" id="po-panel" aria-live="polite"></aside></div>';

            S.onBranch(async function (b) { state.branch = b; state.selected = null; state.detail = null; await load(); if (SA.route() === route) draw(); });
            var input = document.getElementById('po-search');
            input.addEventListener('input', UI.debounce(async function () { state.search = input.value.trim(); await load(); if (SA.route() !== route) return; draw(); var el = document.getElementById('po-search'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250));
            document.getElementById('po-status').addEventListener('change', async function (e) { state.status = e.target.value; await load(); if (SA.route() === route) draw(); });
            document.getElementById('po-new').addEventListener('click', openForm);
            drawTable();
            drawPanel();
        }

        function drawTable() {
            var items = state.data.items, target = document.getElementById('po-table');
            if (!items.length) { target.innerHTML = state.search ? UI.emptyState('ไม่พบรหัสใบสั่งซื้อที่ระบุ') : S.noData(state.list, state.branch); return; }
            target.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>' +
                items.map(function (o) {
                    return '<tr class="is-clickable' + (o.purchase_order_id === state.selected ? ' is-selected' : '') + '" tabindex="0" data-po="' + esc(o.purchase_order_id) + '"><td><span class="strong">' + esc(o.purchase_order_id) + '</span><span class="sub">' + esc(String(o.order_date).split(' ')[0]) + '</span></td>' +
                        '<td>' + esc(o.supplier_name) + '</td><td>' + orderBadge(o.order_status) + '</td><td class="num">' + UI.money(o.total_amount) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
            target.querySelectorAll('[data-po]').forEach(function (row) {
                var open = function () { select(row.getAttribute('data-po')); };
                row.addEventListener('click', open);
                row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
            });
        }

        async function select(id) {
            state.selected = id; state.detail = null; drawTable(); drawPanel(true);
            try {
                var d = await SA.api('/staff/purchase-orders/' + encodeURIComponent(id));
                if (SA.route() !== route || state.selected !== id) return;
                state.detail = d; drawPanel();
                if (window.innerWidth <= 1000) document.getElementById('po-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) { document.getElementById('po-panel').innerHTML = '<div class="panel"><p class="error-message">' + esc(err.message) + '</p></div>'; }
        }

        function drawPanel(loading) {
            var panel = document.getElementById('po-panel');
            if (!state.selected) { panel.innerHTML = '<div class="panel"><h3>Order details</h3>' + UI.emptyState('เลือกใบสั่งซื้อเพื่อดูรายละเอียดและอัปเดตสถานะ') + '</div>'; return; }
            if (loading || !state.detail) { panel.innerHTML = '<div class="panel"><h3>' + esc(state.selected) + '</h3><p class="loading">กำลังโหลดข้อมูล...</p></div>'; return; }
            var d = state.detail;
            var actions = d.order_status === 'Draft' ? '<button type="button" class="btn btn-primary" data-set="Sent">ส่งใบสั่งซื้อให้ Supplier</button><button type="button" class="btn btn-ghost" data-set="Cancelled">ยกเลิกใบสั่งซื้อ</button>'
                : d.order_status === 'Sent' ? '<a class="btn btn-primary" href="#stock-arrival" style="text-decoration:none">รับสินค้าเข้า</a><button type="button" class="btn btn-ghost" data-set="Cancelled">ยกเลิกใบสั่งซื้อ</button>'
                : d.order_status === 'PartiallyReceived' ? '<a class="btn btn-primary" href="#stock-arrival" style="text-decoration:none">รับสินค้าส่วนที่เหลือ</a>' : '';
            panel.innerHTML =
                '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px"><h3 style="margin:0">' + esc(d.purchase_order_id) + '</h3>' + orderBadge(d.order_status) + '</div>' +
                    '<dl class="kv"><dt>Supplier</dt><dd>' + esc(d.supplier.supplier_name) + '</dd><dt>Contact</dt><dd>' + esc(d.supplier.contact_person) + ' · ' + esc(d.supplier.phone) + '</dd><dt>Created</dt><dd>' + esc(d.order_date) + (d.created_by ? ' · ' + esc(d.created_by) : '') + '</dd>' +
                    (d.arrival ? '<dt>Arrival</dt><dd>' + esc(d.arrival.arrival_date) + ' · ' + esc(d.arrival.delivery_status) + '</dd>' : '') + '</dl>' +
                    (actions ? '<div class="toolbar" style="margin:14px 0 0">' + actions + '</div>' : '') + '</div>' +
                '<div class="panel"><h3>Items</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line</th></tr></thead><tbody>' +
                    d.items.map(function (i) { return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span></td><td class="num">' + i.ordered_quantity + '</td><td class="num">' + UI.money(i.unit_cost) + '</td><td class="num"><b>' + UI.money(i.ordered_quantity * i.unit_cost) + '</b></td></tr>'; }).join('') +
                    '</tbody></table></div><p class="table-note">Total ' + UI.money(d.total_amount) + '</p></div>';
            panel.querySelectorAll('[data-set]').forEach(function (b) { b.addEventListener('click', function () { setStatus(b.getAttribute('data-set')); }); });
        }

        async function setStatus(status) {
            var d = state.detail;
            var ok = await UI.confirm({
                title: status === 'Sent' ? 'ส่งใบสั่งซื้อ' : 'ยกเลิกใบสั่งซื้อ',
                message: status === 'Sent' ? 'ส่งใบสั่งซื้อ <b>' + esc(d.purchase_order_id) + '</b> ให้ ' + esc(d.supplier.supplier_name) + ' ? หลังส่งแล้วจะแก้รายการสินค้าไม่ได้'
                    : 'ยกเลิกใบสั่งซื้อ <b>' + esc(d.purchase_order_id) + '</b> ?',
                confirmLabel: status === 'Sent' ? 'ส่งใบสั่งซื้อ' : 'ยกเลิกใบสั่งซื้อ', danger: status === 'Cancelled'
            });
            if (!ok) return;
            try {
                await SA.api('/staff/purchase-orders/' + encodeURIComponent(d.purchase_order_id) + '/status', { method: 'PUT', body: { status: status } });
                UI.toast('บันทึกและอัปเดตสถานะการจัดซื้อสำเร็จ');
                await load();
                if (SA.route() !== route) return;
                var keep = state.selected; draw(); state.selected = null; await select(keep);
            } catch (err) { UI.toast(err.message, 'bad'); }
        }

        /* ------------------------------------------------------ new order */

        async function openForm() {
            if (!state.form) state.form = await SA.api('/staff/purchase-orders/form-data?branch=' + encodeURIComponent(state.branch));
            var f = state.form, rows = [{ product_id: '', ordered_quantity: '', unit_cost: '' }];

            var m = UI.modal({
                title: 'New purchase order · ' + SA.branchName(state.list, state.branch), wide: true,
                body: '<form id="pf" novalidate>' +
                    '<div class="form-grid" style="margin-bottom:14px">' +
                        '<div class="field" data-field="supplier_id"><label for="pf-supplier">Supplier <span class="req" aria-hidden="true">*</span></label><select class="select input" id="pf-supplier"><option value="">— Select supplier —</option>' + f.suppliers.map(function (s) { return '<option value="' + esc(s.supplier_id) + '">' + esc(s.supplier_name) + '</option>'; }).join('') + '</select><p class="field-error" hidden></p></div>' +
                        '<div class="field"><label for="pf-request">From approved request <span class="cell-muted" style="font-weight:normal">(optional)</span></label><select class="select input" id="pf-request"><option value="">— None —</option>' + f.approved_requests.map(function (r) { return '<option value="' + esc(r.request_id) + '">' + esc(r.request_id + ' · ' + r.request_date + ' · ' + r.items.length + ' items') + '</option>'; }).join('') + '</select></div></div>' +
                    '<div class="item-head"><span>Product</span><span>Qty</span><span>Unit cost</span><span></span></div><div class="item-rows" id="pf-rows"></div>' +
                    '<p class="field-error" id="pf-items-error" hidden style="margin-top:8px"></p>' +
                    '<div class="toolbar" style="margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" id="pf-add">+ Add item</button></div>' +
                    '<div class="total-line"><span>Total</span><b id="pf-total">฿0.00</b></div></form>',
                actions: [{ label: 'ยกเลิก', kind: 'ghost' }, { label: 'สร้างใบสั่งซื้อ', kind: 'primary', onClick: function (modal) { submit(modal); } }]
            });

            function productOptions(sel) { return '<option value="">— Select product —</option>' + f.products.map(function (p) { return '<option value="' + esc(p.product_id) + '"' + (p.product_id === sel ? ' selected' : '') + '>' + esc(p.product_name + ' (' + p.product_id + ')') + '</option>'; }).join(''); }

            function drawRows() {
                var box = m.el.querySelector('#pf-rows');
                box.innerHTML = rows.map(function (r, i) {
                    return '<div class="item-row"><select class="select input" data-i="' + i + '" data-k="product_id" aria-label="Product">' + productOptions(r.product_id) + '</select>' +
                        '<input class="input" data-i="' + i + '" data-k="ordered_quantity" inputmode="numeric" value="' + esc(r.ordered_quantity) + '" aria-label="Quantity" placeholder="0">' +
                        '<input class="input" data-i="' + i + '" data-k="unit_cost" inputmode="decimal" value="' + esc(r.unit_cost) + '" aria-label="Unit cost" placeholder="0.00">' +
                        '<button type="button" class="icon-btn" data-rm="' + i + '" aria-label="Remove item"' + (rows.length === 1 ? ' disabled' : '') + '>×</button></div>';
                }).join('');
                box.querySelectorAll('[data-k]').forEach(function (el) {
                    el.addEventListener('input', function () { rows[+el.dataset.i][el.dataset.k] = el.value; total(); });
                    el.addEventListener('change', function () {
                        var r = rows[+el.dataset.i];
                        r[el.dataset.k] = el.value;
                        if (el.dataset.k === 'product_id') {   // default the cost from the product
                            var p = f.products.filter(function (x) { return x.product_id === el.value; })[0];
                            if (p && !r.unit_cost) { r.unit_cost = String(p.cost_price); box.querySelector('[data-i="' + el.dataset.i + '"][data-k="unit_cost"]').value = r.unit_cost; }
                        }
                        total();
                    });
                });
                box.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { rows.splice(+b.dataset.rm, 1); drawRows(); total(); }); });
            }
            function total() {
                var sum = rows.reduce(function (s, r) { return s + (Number(r.ordered_quantity) || 0) * (Number(r.unit_cost) || 0); }, 0);
                m.el.querySelector('#pf-total').textContent = UI.money(sum);
            }
            drawRows();

            m.el.querySelector('#pf-add').addEventListener('click', function () { rows.push({ product_id: '', ordered_quantity: '', unit_cost: '' }); drawRows(); });
            m.el.querySelector('#pf-request').addEventListener('change', function (e) {
                var req = f.approved_requests.filter(function (r) { return r.request_id === e.target.value; })[0];
                if (!req) return;
                rows = req.items.map(function (i) {
                    var p = f.products.filter(function (x) { return x.product_id === i.product_id; })[0];
                    return { product_id: i.product_id, ordered_quantity: String(i.quantity), unit_cost: p ? String(p.cost_price) : '' };
                });
                drawRows(); total();
            });

            async function submit(modal) {
                var supplier = m.el.querySelector('#pf-supplier'), sErr = m.el.querySelector('[data-field=supplier_id] .field-error'), iErr = m.el.querySelector('#pf-items-error');
                var errors = 0; sErr.hidden = true; iErr.hidden = true;
                if (!supplier.value) { sErr.hidden = false; sErr.textContent = 'กรุณาเลือก Supplier'; supplier.setAttribute('aria-invalid', 'true'); errors++; }
                var seen = {}, msg = '';
                rows.forEach(function (r) {
                    if (msg) return;
                    var q = Number(r.ordered_quantity), c = Number(r.unit_cost);
                    if (!r.product_id) msg = 'กรุณาเลือกสินค้าให้ครบทุกแถว';
                    else if (seen[r.product_id]) msg = 'ไม่สามารถเลือกสินค้ารหัสเดิมซ้ำในใบสั่งซื้อเดียวกันได้';
                    else if (!Number.isInteger(q) || q <= 0) msg = 'จำนวนที่สั่งต้องเป็นจำนวนเต็มที่มากกว่า 0';
                    else if (!isFinite(c) || c <= 0) msg = 'ราคาต่อหน่วยต้องเป็นตัวเลขที่มากกว่า 0';
                    seen[r.product_id] = true;
                });
                if (msg) { iErr.hidden = false; iErr.textContent = msg; errors++; }
                if (errors) return;

                modal.setBusy(true);
                try {
                    var res = await SA.api('/staff/purchase-orders', { method: 'POST', body: { branch: state.branch, supplier_id: supplier.value, request_id: m.el.querySelector('#pf-request').value || null,
                        items: rows.map(function (r) { return { product_id: r.product_id, ordered_quantity: Number(r.ordered_quantity), unit_cost: Number(r.unit_cost) }; }) } });
                    modal.close(); state.form = null;
                    UI.toast('สร้างใบสั่งซื้อ ' + res.purchase_order_id + ' เรียบร้อยแล้ว');
                    await load();
                    if (SA.route() !== route) return;
                    draw(); state.selected = null; await select(res.purchase_order_id);
                } catch (err) { modal.setBusy(false); modal.error(err.message); }
            }
        }
    };
})();
