/* Delivery Status (UC-19) - purchase orders, arrival status and supplier contact */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    var ORDER = { Draft: ['muted', 'Draft'], Sent: ['info', 'Sent'], PartiallyReceived: ['warn', 'Partially received'], Received: ['good', 'Received'], Cancelled: ['bad', 'Cancelled'] };
    var DELIVERY = { Partial: ['warn', 'Partial delivery'], Received: ['good', 'Delivered'] };

    function orderBadge(status) { var m = ORDER[status] || ['muted', status]; return UI.badge(m[0], m[1]); }
    function deliveryBadge(status) {
        if (!status) return UI.badge('muted', 'Not arrived');
        var m = DELIVERY[status] || ['info', status];
        return UI.badge(m[0], m[1]);
    }

    SA.pages['delivery-status'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { branches: [], branch: '', status: '', search: '', list: null, selected: null, detail: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        await loadList();
        if (SA.route() !== route) return;

        main.innerHTML = SA.pageHeader(title) +
            '<div id="ds-stats"></div>' +
            '<div class="toolbar">' +
                '<select id="ds-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch, 'All branches') + '</select>' +
                '<div class="grow"><input type="search" id="ds-search" class="search-input" placeholder="Search purchase order ID, e.g. PO0003..." aria-label="Search purchase order"></div>' +
                '<select id="ds-status" class="select" aria-label="Order status"><option value="">All status</option>' +
                    Object.keys(ORDER).map(function (s) { return '<option value="' + s + '">' + esc(ORDER[s][1]) + '</option>'; }).join('') + '</select>' +
            '</div>' +
            '<div class="split">' +
                '<section><div id="ds-table"></div></section>' +
                '<aside class="sticky-panel" id="ds-panel" aria-live="polite"></aside>' +
            '</div>';

        var refresh = async function () { await loadList(); if (SA.route() !== route) return; drawStats(); drawTable(); };
        document.getElementById('ds-branch').addEventListener('change', function (e) { state.branch = e.target.value; refresh(); });
        document.getElementById('ds-status').addEventListener('change', function (e) { state.status = e.target.value; refresh(); });
        document.getElementById('ds-search').addEventListener('input', UI.debounce(function (e) { state.search = e.target.value.trim(); refresh(); }, 250));

        drawStats();
        drawTable();
        drawPanel();

        async function loadList() {
            var q = [];
            if (state.branch) q.push('branch=' + encodeURIComponent(state.branch));
            if (state.status) q.push('status=' + encodeURIComponent(state.status));
            if (state.search) q.push('search=' + encodeURIComponent(state.search));
            state.list = await SA.api('/procurement/deliveries' + (q.length ? '?' + q.join('&') : ''));
        }

        function drawStats() {
            var s = state.list.summary;
            document.getElementById('ds-stats').innerHTML = '<div class="stat-row">' +
                UI.statTile('Purchase orders', UI.int(s.orders)) +
                UI.statTile('Waiting for delivery', UI.int(s.waiting), 'sent, not arrived yet', s.waiting ? 'rust' : '') +
                UI.statTile('Partial delivery', UI.int(s.partial), 'needs follow-up', s.partial ? 'warn' : '') +
                UI.statTile('Received', UI.int(s.received)) + '</div>';
        }

        function drawTable() {
            var items = state.list.items;
            var target = document.getElementById('ds-table');
            if (!items.length) {
                target.innerHTML = UI.emptyState(state.search ? 'ไม่พบรหัสใบสั่งซื้อที่ระบุ' : 'ไม่พบรายการจัดส่งสินค้าในสาขานี้');
                return;
            }
            target.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>' +
                items.map(function (o) {
                    return '<tr class="is-clickable' + (o.purchase_order_id === state.selected ? ' is-selected' : '') + '" tabindex="0" data-po="' + esc(o.purchase_order_id) + '" aria-label="View ' + esc(o.purchase_order_id) + '">' +
                        '<td><span class="strong">' + esc(o.purchase_order_id) + '</span><span class="sub">' + esc(String(o.order_date).split(' ')[0]) + ' · ' + esc(SA.branchName(state.branches, o.branch_id)) + '</span></td>' +
                        '<td>' + esc(o.supplier_name) + '</td>' +
                        '<td><span class="badge-stack">' + orderBadge(o.order_status) +
                            (['Draft', 'Cancelled'].indexOf(o.order_status) === -1 ? deliveryBadge(o.delivery_status) : '') + '</span>' +
                            (o.arrival_date ? '<span class="sub">arrived ' + esc(String(o.arrival_date).split(' ')[0]) + '</span>' : '') + '</td>' +
                        '<td class="num">' + UI.money(o.total_amount) + '</td></tr>';
                }).join('') + '</tbody></table></div>';

            target.querySelectorAll('[data-po]').forEach(function (row) {
                var open = function () { select(row.getAttribute('data-po')); };
                row.addEventListener('click', open);
                row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
            });
        }

        async function select(id) {
            state.selected = id;
            state.detail = null;
            drawTable();
            drawPanel(true);
            try {
                var detail = await SA.api('/procurement/deliveries/' + encodeURIComponent(id));
                if (SA.route() !== route || state.selected !== id) return;
                state.detail = detail;
                drawPanel();
                // single column on small screens: bring the details into view
                if (window.innerWidth <= 1000) document.getElementById('ds-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (err) {
                document.getElementById('ds-panel').innerHTML = '<div class="panel"><p class="error-message">' + esc(err.message) + '</p></div>';
            }
        }

        function drawPanel(loading) {
            var panel = document.getElementById('ds-panel');
            if (!state.selected) { panel.innerHTML = '<div class="panel"><h3>Delivery details</h3>' + UI.emptyState('เลือกใบสั่งซื้อเพื่อดูสถานะการจัดส่ง') + '</div>'; return; }
            if (loading || !state.detail) { panel.innerHTML = '<div class="panel"><h3>' + esc(state.selected) + '</h3><p class="loading">กำลังโหลดข้อมูล...</p></div>'; return; }

            var d = state.detail;
            panel.innerHTML =
                '<div class="panel">' +
                    '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px">' +
                        '<h3 style="margin:0">' + esc(d.purchase_order_id) + '</h3>' + orderBadge(d.order_status) + '</div>' +
                    timeline(d) +
                '</div>' +
                '<div class="panel"><h3>Items</h3>' + itemsTable(d) + '</div>' +
                '<div class="panel"><h3>Supplier</h3><dl class="kv">' +
                    '<dt>Name</dt><dd>' + esc(d.supplier.supplier_name) + '</dd>' +
                    '<dt>Contact</dt><dd>' + esc(d.supplier.contact_person) + '</dd>' +
                    '<dt>Phone</dt><dd><a href="tel:' + esc(d.supplier.phone) + '">' + esc(d.supplier.phone) + '</a></dd>' +
                    '<dt>Email</dt><dd><a href="mailto:' + esc(d.supplier.email) + '">' + esc(d.supplier.email) + '</a></dd>' +
                    (d.arrival && d.arrival.notes ? '<dt>Delivery note</dt><dd>' + esc(d.arrival.notes) + '</dd>' : '') +
                '</dl></div>';
        }

        function timeline(d) {
            var sentDone = ['Sent', 'PartiallyReceived', 'Received'].indexOf(d.order_status) !== -1;
            var cancelled = d.order_status === 'Cancelled';
            var arrived = !!d.arrival;
            var partial = arrived && d.arrival.delivery_status === 'Partial';

            var steps = [
                { s: 'done', t: 'Order created', sub: d.order_date + (d.created_by ? ' · ' + d.created_by : '') },
                cancelled ? { s: 'current', t: 'Order cancelled', sub: '' }
                          : { s: sentDone ? 'done' : 'current', t: 'Sent to supplier', sub: sentDone ? '' : 'Draft — not sent yet' },
                { s: arrived ? (partial ? 'current' : 'done') : (sentDone ? 'current' : 'todo'), t: partial ? 'Partial delivery received' : arrived ? 'Delivered' : 'Waiting for delivery',
                  sub: arrived ? d.arrival.arrival_date + (d.arrival.received_by ? ' · received by ' + d.arrival.received_by : '') : '' },
                { s: d.inspection ? 'done' : 'todo', t: d.inspection ? 'Quality checked · ' + d.inspection.result : 'Quality check',
                  sub: d.inspection ? d.inspection.inspection_date + (d.inspection.inspected_by ? ' · ' + d.inspection.inspected_by : '') : '' }
            ];
            return '<ol class="timeline">' + steps.map(function (st) {
                return '<li class="' + st.s + '"><span class="dot" aria-hidden="true">' + (st.s === 'done' ? '✓' : st.s === 'current' ? '●' : '') + '</span>' +
                    '<div><div class="t-title">' + esc(st.t) + '</div>' + (st.sub ? '<div class="t-sub">' + esc(st.sub) + '</div>' : '') + '</div></li>';
            }).join('') + '</ol>';
        }

        function itemsTable(d) {
            var totalOrdered = 0;
            var rows = d.items.map(function (i) {
                totalOrdered += i.ordered_quantity;
                var missing = i.quantity_received !== null && i.quantity_received < i.ordered_quantity;
                return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + ' · ' + UI.money(i.unit_cost) + ' / ' + esc(i.unit) + '</span></td>' +
                    '<td class="num">' + i.ordered_quantity + '</td>' +
                    '<td class="num">' + (i.quantity_received === null ? '—' : '<b' + (missing ? ' class="amount-out"' : '') + '>' + i.quantity_received + '</b>') + '</td>' +
                    '<td class="num">' + (i.quantity_rejected ? '<b class="amount-out">' + i.quantity_rejected + '</b>' : (i.quantity_rejected === null ? '—' : '0')) + '</td></tr>';
            }).join('');
            return '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Rejected</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
                '<p class="table-note">Total ' + UI.money(d.total_amount) + '</p>';
        }
    };
})();
