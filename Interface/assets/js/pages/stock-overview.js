/* Stock Overview (UC-03 / FIFO / expiry) - per-branch stock levels and FIFO batches */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    SA.pages['stock-overview'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { branches: [], branch: UI.branchPref(), tab: 'levels', search: '', level: 'all', expiry: 'all', stock: null, batches: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        if (SA.route() !== route) return;
        if (!state.branches.some(function (b) { return b.branch_id === state.branch; })) state.branch = state.branches[0].branch_id;

        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var q = '?branch=' + encodeURIComponent(state.branch);
            var results = await Promise.all([SA.api('/stocks/overview' + q), SA.api('/stocks/batches' + q)]);
            state.stock = results[0];
            state.batches = results[1];
        }

        function draw() {
            var tabs = UI.tabs([
                { id: 'levels', label: 'Stock levels', count: state.stock.summary.products },
                { id: 'fifo', label: 'FIFO & expiry', count: state.batches.summary.batches }
            ], state.tab);

            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' +
                    '<label class="sr-only" for="so-branch">Branch</label>' +
                    '<select id="so-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch) + '</select>' +
                '</div>' +
                tabs.html + '<div id="so-body"></div>';

            document.getElementById('so-branch').addEventListener('change', async function (e) {
                state.branch = e.target.value;
                UI.branchPref(state.branch);
                state.search = ''; state.level = 'all'; state.expiry = 'all';
                main.querySelector('#so-body').innerHTML = '<p class="loading">กำลังโหลดข้อมูล...</p>';
                await load();
                if (SA.route() === route) draw();
            });
            tabs.bind(main, function (id) { state.tab = id; draw(); });

            var body = document.getElementById('so-body');
            if (!state.stock.summary.products && !state.batches.summary.batches) {
                body.innerHTML = UI.emptyState('ยังไม่มีข้อมูลสต็อกของสาขานี้', 'สาขา ' + SA.branchName(state.branches, state.branch) + ' ยังไม่มีรายการสินค้าในระบบ');
                return;
            }
            (state.tab === 'levels' ? drawLevels : drawFifo)(body);
        }

        /* ------------------------------------------------------ stock levels */

        function levelBadge(status) {
            return status === 'out' ? UI.badge('bad', 'Out of stock') : status === 'low' ? UI.badge('warn', 'Low stock') : UI.badge('good', 'In stock');
        }

        function drawLevels(body) {
            var s = state.stock.summary;
            body.innerHTML =
                '<div class="stat-row">' +
                    UI.statTile('Products', UI.int(s.products), 'in this branch') +
                    UI.statTile('Units on hand', UI.int(s.units), UI.int(s.reserved) + ' reserved') +
                    UI.statTile('Low stock', UI.int(s.low), '≤ ' + state.stock.threshold + ' units', s.low ? 'warn' : '') +
                    UI.statTile('Out of stock', UI.int(s.out), null, s.out ? 'bad' : '') +
                '</div>' +
                '<div class="toolbar">' +
                    '<div class="grow"><input type="search" id="so-search" class="search-input" placeholder="Search product or ID..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="so-level" class="select" aria-label="Stock level">' +
                        option('all', 'All levels', state.level) + option('low', 'Low stock', state.level) + option('out', 'Out of stock', state.level) + option('ok', 'In stock', state.level) +
                    '</select>' +
                '</div><div id="so-table"></div>';

            var input = document.getElementById('so-search');
            input.addEventListener('input', UI.debounce(function () { state.search = input.value.trim(); drawLevelTable(); }, 150));
            document.getElementById('so-level').addEventListener('change', function (e) { state.level = e.target.value; drawLevelTable(); });
            drawLevelTable();
        }

        function drawLevelTable() {
            var term = state.search.toLowerCase();
            var rows = state.stock.items.filter(function (i) {
                return (state.level === 'all' || i.status === state.level) &&
                    (!term || i.product_name.toLowerCase().indexOf(term) !== -1 || i.product_id.toLowerCase().indexOf(term) !== -1);
            });
            var target = document.getElementById('so-table');
            if (!rows.length) { target.innerHTML = UI.emptyState('ไม่พบสินค้าที่ค้นหา'); return; }

            var max = Math.max.apply(null, state.stock.items.map(function (i) { return i.quantity_on_hand; }).concat(1));
            target.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>Product</th><th>Category</th><th>On hand</th><th class="num">Reserved</th><th class="num">Available</th><th>Next expiry</th><th>Status</th></tr></thead><tbody>' +
                rows.map(function (i) {
                    var pct = Math.max(i.quantity_on_hand ? 3 : 0, (i.quantity_on_hand / max) * 100);
                    return '<tr>' +
                        '<td><span class="strong">' + esc(i.product_name) + '</span><span class="sub">' + esc(i.product_id) + '</span></td>' +
                        '<td class="cell-muted">' + esc(i.category_name) + '</td>' +
                        '<td data-tip="' + esc(i.product_name + ': ' + i.quantity_on_hand + ' ' + i.unit + ' on hand') + '"><span class="cell-bar"><span class="bar-track"><span class="bar' + (i.status !== 'ok' ? ' accent' : '') + '" style="width:' + pct + '%"></span></span><b>' + UI.int(i.quantity_on_hand) + '</b></span></td>' +
                        '<td class="num">' + UI.int(i.quantity_reserved) + '</td>' +
                        '<td class="num"><b>' + UI.int(i.available) + '</b> <span class="cell-muted">' + esc(i.unit) + '</span></td>' +
                        '<td class="cell-muted">' + esc(i.next_expiry || '—') + '</td>' +
                        '<td>' + levelBadge(i.status) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="table-note">Showing ' + rows.length + ' of ' + state.stock.items.length + ' · updated ' + esc(state.stock.items[0].updated_at) + '</p>';
        }

        /* ------------------------------------------------------ FIFO & expiry */

        function expiryCell(i) {
            if (i.expiry_status === 'none') return UI.badge('muted', 'No expiry');
            if (i.expiry_status === 'expired') return UI.badge('bad', 'Expired');
            if (i.expiry_status === 'soon') return UI.badge('warn', i.days_to_expiry === 0 ? 'Today' : i.days_to_expiry + ' days left');
            return '<span class="cell-muted">' + i.days_to_expiry + ' days</span>';
        }

        function drawFifo(body) {
            var s = state.batches.summary;
            body.innerHTML =
                '<div class="stat-row">' +
                    UI.statTile('Batches in stock', UI.int(s.batches), 'oldest expiry first') +
                    UI.statTile('Expiring soon', UI.int(s.soon), '≤ ' + state.batches.soonDays + ' days', s.soon ? 'warn' : '') +
                    UI.statTile('Expired', UI.int(s.expired), null, s.expired ? 'bad' : '') +
                '</div>' +
                '<div class="toolbar">' +
                    '<select id="so-expiry" class="select" aria-label="Expiry filter">' +
                        option('all', 'All batches', state.expiry) + option('soon', 'Expiring soon', state.expiry) + option('expired', 'Expired', state.expiry) + option('none', 'No expiry date', state.expiry) +
                    '</select>' +
                    '<span class="cell-muted">FIFO: sell the batch at the top first</span>' +
                '</div><div id="so-table"></div>';
            document.getElementById('so-expiry').addEventListener('change', function (e) { state.expiry = e.target.value; drawFifoTable(); });
            drawFifoTable();
        }

        function drawFifoTable() {
            var rows = state.batches.items.filter(function (b) { return state.expiry === 'all' || b.expiry_status === state.expiry; });
            var target = document.getElementById('so-table');
            if (!rows.length) { target.innerHTML = UI.emptyState('ไม่พบล็อตสินค้าตามเงื่อนไข'); return; }

            target.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th class="num">#</th><th>Batch</th><th>Product</th><th>Received</th><th>Expiry</th><th>Remaining</th><th>Status</th></tr></thead><tbody>' +
                rows.map(function (b, idx) {
                    var pct = b.quantity_received ? (b.quantity_remaining / b.quantity_received) * 100 : 0;
                    return '<tr>' +
                        '<td class="num cell-muted">' + (idx + 1) + '</td>' +
                        '<td class="strong">' + esc(b.batch_id) + '</td>' +
                        '<td>' + esc(b.product_name) + '<span class="sub">' + esc(b.product_id) + '</span></td>' +
                        '<td class="cell-muted">' + esc(String(b.received_at || '').split(' ')[0]) + '</td>' +
                        '<td>' + esc(b.expiry_date || '—') + '</td>' +
                        '<td data-tip="' + esc(b.quantity_remaining + ' of ' + b.quantity_received + ' ' + b.unit + ' remaining') + '"><span class="cell-bar"><span class="bar-track"><span class="bar' + (b.expiry_status === 'soon' || b.expiry_status === 'expired' ? ' accent' : '') + '" style="width:' + pct + '%"></span></span><b>' + b.quantity_remaining + '/' + b.quantity_received + '</b></span></td>' +
                        '<td>' + expiryCell(b) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="table-note">Showing ' + rows.length + ' of ' + state.batches.items.length + ' batches</p>';
        }

        function option(value, label, current) {
            return '<option value="' + value + '"' + (value === current ? ' selected' : '') + '>' + esc(label) + '</option>';
        }
    };
})();
