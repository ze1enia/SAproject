/* Stock Request (UC-04) - Owner sends a request to the branch's Staff, then follows its status.
 * Uses the stock-request API (controllers/stockRequestController.js). */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;
    var LOW = 15;

    var STATUS = { Pending: 'warn', Approved: 'good', Cancelled: 'bad' };
    function statusBadge(status) { return UI.badge(STATUS[status] || 'muted', status); }

    SA.pages['stock-request'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = {
            tab: 'new', branches: [], branch: UI.branchPref(),
            products: [], qty: {}, search: '', stockFilter: 'all',
            requests: [], historyBranch: '', historyStatus: '', open: {}
        };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        if (SA.route() !== route) return;
        if (!state.branches.some(function (b) { return b.branch_id === state.branch; })) state.branch = state.branches[0].branch_id;

        await Promise.all([loadProducts(), loadHistory()]);
        if (SA.route() !== route) return;
        draw();

        async function loadProducts() { state.products = await SA.api('/stock-requests/products?branch_id=' + encodeURIComponent(state.branch)); }
        async function loadHistory() {
            var q = [];
            if (state.historyBranch) q.push('branch_id=' + encodeURIComponent(state.historyBranch));
            if (state.historyStatus) q.push('status=' + encodeURIComponent(state.historyStatus));
            state.requests = await SA.api('/stock-requests' + (q.length ? '?' + q.join('&') : ''));
        }

        function draw() {
            var tabs = UI.tabs([
                { id: 'new', label: 'New request' },
                { id: 'history', label: 'History', count: state.requests.length }
            ], state.tab);
            main.innerHTML = SA.pageHeader(title) + tabs.html + '<div id="sr-body"></div>';
            tabs.bind(main, function (id) { state.tab = id; draw(); });
            (state.tab === 'new' ? drawNew : drawHistory)(document.getElementById('sr-body'));
        }

        /* ---------------------------------------------------------- new request */

        function picked() {
            return Object.keys(state.qty).filter(function (id) { return state.qty[id] > 0; });
        }

        function drawNew(body) {
            body.innerHTML =
                '<div class="toolbar">' +
                    '<label class="sr-only" for="sr-branch">Branch</label>' +
                    '<select id="sr-branch" class="select" aria-label="Request for branch">' + SA.branchOptions(state.branches, state.branch) + '</select>' +
                    '<div class="grow"><input type="search" id="sr-search" class="search-input" placeholder="Search product or ID..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="sr-filter" class="select" aria-label="Stock filter">' +
                        '<option value="all"' + (state.stockFilter === 'all' ? ' selected' : '') + '>All products</option>' +
                        '<option value="low"' + (state.stockFilter === 'low' ? ' selected' : '') + '>Low stock (≤ ' + LOW + ')</option>' +
                        '<option value="picked"' + (state.stockFilter === 'picked' ? ' selected' : '') + '>Selected only</option>' +
                    '</select>' +
                '</div>' +
                '<div id="sr-table"></div>' +
                '<div class="submit-bar" id="sr-bar"></div>';

            document.getElementById('sr-branch').addEventListener('change', async function (e) {
                if (picked().length) {
                    var ok = await UI.confirm({ title: 'เปลี่ยนสาขา', message: 'รายการที่เลือกไว้จะถูกล้าง เพราะสต็อกของแต่ละสาขาไม่เหมือนกัน ต้องการเปลี่ยนสาขาหรือไม่?', confirmLabel: 'เปลี่ยนสาขา' });
                    if (!ok) { e.target.value = state.branch; return; }
                }
                state.branch = e.target.value; UI.branchPref(state.branch); state.qty = {};
                await loadProducts();
                if (SA.route() === route) draw();
            });
            var search = document.getElementById('sr-search');
            search.addEventListener('input', UI.debounce(function () { state.search = search.value.trim().toLowerCase(); drawTable(); }, 150));
            document.getElementById('sr-filter').addEventListener('change', function (e) { state.stockFilter = e.target.value; drawTable(); });
            drawTable();
            drawBar();
        }

        function visibleProducts() {
            return state.products.filter(function (p) {
                var stock = p.current_stock === null ? 0 : Number(p.current_stock);
                if (state.stockFilter === 'low' && stock > LOW) return false;
                if (state.stockFilter === 'picked' && !(state.qty[p.product_id] > 0)) return false;
                return !state.search || p.product_name.toLowerCase().indexOf(state.search) !== -1 || p.product_id.toLowerCase().indexOf(state.search) !== -1;
            });
        }

        function drawTable() {
            var rows = visibleProducts();
            var target = document.getElementById('sr-table');
            if (!rows.length) { target.innerHTML = UI.emptyState(state.stockFilter === 'picked' ? 'ยังไม่ได้เลือกสินค้า' : 'ไม่พบสินค้าที่ค้นหา'); return; }

            target.innerHTML = '<div class="table-scroll"><table class="data-table req-table">' +
                '<thead><tr><th>Product</th><th>Category</th><th class="num">In stock</th><th class="center">Quantity to request</th></tr></thead><tbody>' +
                rows.map(function (p) {
                    var stock = p.current_stock === null ? 0 : Number(p.current_stock);
                    var qty = state.qty[p.product_id] || 0;
                    return '<tr class="' + (qty > 0 ? 'has-qty' : '') + '" data-row="' + esc(p.product_id) + '">' +
                        '<td><span class="strong">' + esc(p.product_name) + '</span><span class="sub">' + esc(p.product_id) + '</span></td>' +
                        '<td class="cell-muted">' + esc(p.category_name) + '</td>' +
                        '<td class="num">' + UI.int(stock) + ' <span class="cell-muted">' + esc(p.unit) + '</span> ' + (stock <= LOW ? UI.badge(stock === 0 ? 'bad' : 'warn', stock === 0 ? 'Out' : 'Low') : '') + '</td>' +
                        '<td class="center"><span class="stepper">' +
                            '<button type="button" data-dec="' + esc(p.product_id) + '" aria-label="Decrease ' + esc(p.product_name) + '">−</button>' +
                            '<input type="number" min="0" step="1" inputmode="numeric" value="' + (qty || '') + '" placeholder="0" data-qty="' + esc(p.product_id) + '" aria-label="Quantity of ' + esc(p.product_name) + '">' +
                            '<button type="button" data-inc="' + esc(p.product_id) + '" aria-label="Increase ' + esc(p.product_name) + '">+</button>' +
                        '</span></td></tr>';
                }).join('') + '</tbody></table></div>';

            target.querySelectorAll('[data-inc]').forEach(function (b) { b.addEventListener('click', function () { bump(b.getAttribute('data-inc'), 1, true); }); });
            target.querySelectorAll('[data-dec]').forEach(function (b) { b.addEventListener('click', function () { bump(b.getAttribute('data-dec'), -1, true); }); });
            target.querySelectorAll('[data-qty]').forEach(function (input) {
                input.addEventListener('input', function () {
                    var n = Math.floor(Number(input.value));
                    setQty(input.getAttribute('data-qty'), isFinite(n) && n > 0 ? n : 0, false);
                });
            });
        }

        function bump(id, delta, redraw) { setQty(id, Math.max(0, (state.qty[id] || 0) + delta), redraw); }

        function setQty(id, n, redraw) {
            if (n > 0) state.qty[id] = n; else delete state.qty[id];
            var row = document.querySelector('[data-row="' + id + '"]');
            if (row) {
                row.classList.toggle('has-qty', n > 0);
                var input = row.querySelector('[data-qty]');
                if (redraw) input.value = n || '';
            }
            drawBar();
        }

        function drawBar() {
            var ids = picked();
            var total = ids.reduce(function (sum, id) { return sum + state.qty[id]; }, 0);
            var bar = document.getElementById('sr-bar');
            bar.innerHTML =
                '<span class="summary"><b>' + ids.length + '</b> items · <b>' + UI.int(total) + '</b> units for ' + esc(SA.branchName(state.branches, state.branch)) + '</span>' +
                '<button type="button" class="btn btn-ghost" id="sr-clear"' + (ids.length ? '' : ' disabled') + '>ล้างรายการ</button>' +
                '<button type="button" class="btn btn-primary" id="sr-submit"' + (ids.length ? '' : ' disabled') + '>ส่งคำขอ Stock</button>';
            document.getElementById('sr-clear').addEventListener('click', function () { state.qty = {}; drawTable(); drawBar(); });
            document.getElementById('sr-submit').addEventListener('click', review);
        }

        function review() {
            var ids = picked();
            if (!ids.length) { UI.toast('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ', 'bad'); return; }
            var names = {};
            state.products.forEach(function (p) { names[p.product_id] = p; });
            UI.modal({
                title: 'ยืนยันคำขอ Stock',
                body: '<p class="confirm-text" style="margin-bottom:12px">ส่งคำขอไปยังสาขา <b>' + esc(SA.branchName(state.branches, state.branch)) + '</b> — Staff จะตรวจสอบและอนุมัติ</p>' +
                    '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th class="num">Quantity</th></tr></thead><tbody>' +
                    ids.map(function (id) { return '<tr><td>' + esc(names[id].product_name) + '<span class="sub">' + esc(id) + '</span></td><td class="num"><b>' + state.qty[id] + '</b> ' + esc(names[id].unit) + '</td></tr>'; }).join('') +
                    '</tbody></table></div>',
                actions: [
                    { label: 'กลับไปแก้ไข', kind: 'ghost' },
                    { label: 'ยืนยันคำสั่งซื้อ', kind: 'primary', onClick: function (modal) { send(modal, ids); } }
                ]
            });
        }

        async function send(modal, ids) {
            modal.setBusy(true);
            try {
                var created = await SA.api('/stock-requests', {
                    method: 'POST',
                    body: { branch_id: state.branch, items: ids.map(function (id) { return { product_id: id, requested_quantity: state.qty[id] }; }) }
                });
                modal.close();
                UI.toast('Submit Completed · ' + created.request_id);
                state.qty = {};
                state.historyBranch = ''; state.historyStatus = '';
                await loadHistory();
                state.open = {}; state.open[created.request_id] = true;
                state.tab = 'history';
                if (SA.route() === route) draw();
            } catch (err) {
                modal.setBusy(false);
                modal.error(err.message);
            }
        }

        /* -------------------------------------------------------------- history */

        function drawHistory(body) {
            body.innerHTML =
                '<div class="toolbar">' +
                    '<select id="sh-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.historyBranch, 'All branches') + '</select>' +
                    '<select id="sh-status" class="select" aria-label="Status">' +
                        ['', 'Pending', 'Approved', 'Cancelled'].map(function (s) { return '<option value="' + s + '"' + (s === state.historyStatus ? ' selected' : '') + '>' + (s || 'All status') + '</option>'; }).join('') +
                    '</select>' +
                '</div>' +
                (state.requests.length ? state.requests.map(requestCard).join('') : UI.emptyState('ยังไม่มีคำขอ Stock'));

            document.getElementById('sh-branch').addEventListener('change', async function (e) { state.historyBranch = e.target.value; await loadHistory(); if (SA.route() === route) draw(); });
            document.getElementById('sh-status').addEventListener('change', async function (e) { state.historyStatus = e.target.value; await loadHistory(); if (SA.route() === route) draw(); });
            body.querySelectorAll('.request-head').forEach(function (h) {
                h.addEventListener('click', function () {
                    var card = h.parentNode, id = card.getAttribute('data-request');
                    var open = card.classList.toggle('open');
                    state.open[id] = open;
                    h.setAttribute('aria-expanded', open);
                });
            });
        }

        function requestCard(r) {
            var units = r.items.reduce(function (sum, i) { return sum + Number(i.requested_quantity); }, 0);
            var open = !!state.open[r.request_id];
            return '<article class="request-card' + (open ? ' open' : '') + '" data-request="' + esc(r.request_id) + '">' +
                '<button type="button" class="request-head" aria-expanded="' + open + '">' +
                    '<span class="rid">' + esc(r.request_id) + '</span>' +
                    '<span>' + esc(SA.branchName(state.branches, r.branch_id)) + ' <span class="muted">· ' + esc(r.request_date) + ' · by ' + esc(r.requested_by || '—') + '</span></span>' +
                    '<span>' + statusBadge(r.status) + '</span>' +
                    '<span class="chev" aria-hidden="true">▸</span>' +
                    '<span class="muted" style="grid-column:2 / -1">' + r.items.length + ' items · ' + UI.int(units) + ' units</span>' +
                '</button>' +
                '<div class="request-body">' +
                    '<div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>Product</th><th class="num">Requested</th></tr></thead><tbody>' +
                    r.items.map(function (i) { return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span></td><td class="num"><b>' + UI.int(i.requested_quantity) + '</b> ' + esc(i.unit) + '</td></tr>'; }).join('') +
                    '</tbody></table></div>' +
                    (r.feedback ? '<p class="feedback"><b>Staff feedback' + (r.reviewed_by ? ' · ' + esc(r.reviewed_by) : '') + (r.reviewed_at ? ' · ' + esc(r.reviewed_at) : '') + '</b>' + esc(r.feedback) + '</p>' : '') +
                '</div></article>';
        }
    };
})();
