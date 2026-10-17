/* Stock Arrival (Staff, UC-10) - record goods that arrived against a purchase order */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;

    SA.pages['stock-arrival'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', tab: 'waiting', data: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() { state.data = await SA.api('/staff/arrivals?branch=' + encodeURIComponent(state.branch)); }

        function draw() {
            var tabs = UI.tabs([{ id: 'waiting', label: 'Waiting for delivery', count: state.data.pending.length }, { id: 'history', label: 'Arrival history', count: state.data.history.length }], state.tab);
            main.innerHTML = SA.pageHeader(title) + '<div class="toolbar">' + S.branchBar(state.list, state.branch) + '</div>' + tabs.html + '<div id="sa-body"></div>';
            S.onBranch(async function (b) { state.branch = b; await load(); if (SA.route() === route) draw(); });
            tabs.bind(main, function (id) { state.tab = id; draw(); });
            var body = document.getElementById('sa-body');
            if (state.tab === 'waiting') drawWaiting(body); else drawHistory(body);
        }

        function drawWaiting(body) {
            var orders = state.data.pending;
            if (!orders.length) { body.innerHTML = UI.emptyState('ไม่มีใบสั่งซื้อที่รอรับสินค้า', 'ส่งใบสั่งซื้อให้ Supplier ที่หน้า Purchase Orders ก่อน'); return; }
            body.innerHTML = orders.map(function (o) {
                return '<article class="po-card"><div class="po-card-head"><div><h3>' + esc(o.purchase_order_id) + ' <span class="cell-muted" style="font-size:13px;font-weight:normal">· ' + esc(o.supplier_name) + ' · ordered ' + esc(String(o.order_date).split(' ')[0]) + '</span></h3></div>' +
                    '<div style="display:flex;gap:10px;align-items:center">' + (o.status === 'PartiallyReceived' ? UI.badge('warn', 'Partially received') : UI.badge('info', 'Sent')) +
                    '<button type="button" class="btn btn-primary btn-sm" data-receive="' + esc(o.purchase_order_id) + '">Receive goods</button></div></div>' +
                    '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Still to come</th></tr></thead><tbody>' +
                    o.items.map(function (i) {
                        return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span></td><td class="num">' + i.ordered + '</td><td class="num">' + i.received + '</td>' +
                            '<td class="num">' + (i.remaining ? '<b>' + i.remaining + '</b> ' + esc(i.unit) : UI.badge('good', 'Complete')) + '</td></tr>';
                    }).join('') + '</tbody></table></div></article>';
            }).join('');
            body.querySelectorAll('[data-receive]').forEach(function (b) {
                b.addEventListener('click', function () { openReceive(orders.filter(function (o) { return o.purchase_order_id === b.getAttribute('data-receive'); })[0]); });
            });
        }

        function drawHistory(body) {
            var rows = state.data.history;
            if (!rows.length) { body.innerHTML = UI.emptyState('ยังไม่มีประวัติการรับสินค้าของสาขานี้'); return; }
            body.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Arrival</th><th>Order</th><th>Status</th><th class="num">Units</th><th class="num">Rejected</th><th>Received by</th></tr></thead><tbody>' +
                rows.map(function (a) {
                    return '<tr><td><span class="strong">' + esc(a.arrival_id) + '</span><span class="sub">' + esc(a.arrival_date) + '</span></td><td>' + esc(a.purchase_order_id) + '</td>' +
                        '<td>' + (a.delivery_status === 'Received' ? UI.badge('good', 'Delivered') : UI.badge('warn', 'Partial delivery')) + '</td>' +
                        '<td class="num">' + UI.int(a.units) + '</td><td class="num">' + (a.rejected ? '<b class="amount-out">' + a.rejected + '</b>' : '0') + '</td><td class="cell-muted">' + esc(a.received_by || '—') + (a.notes ? '<span class="sub">' + esc(a.notes) + '</span>' : '') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        function openReceive(o) {
            var m = UI.modal({
                title: 'Receive goods · ' + o.purchase_order_id, wide: true,
                body: '<p class="cell-muted" style="margin:0 0 12px;font-size:13px">Enter what actually arrived. Rejected units stay out of stock and are flagged for the Owner after the quality check.</p>' +
                    '<div class="table-scroll"><table class="data-table receive-table"><thead><tr><th>Product</th><th class="num">Still to come</th><th class="num" style="width:96px">Received</th><th class="num" style="width:96px">Rejected</th><th style="width:150px">Expiry date</th></tr></thead><tbody>' +
                    o.items.map(function (i) {
                        return '<tr data-line="' + esc(i.purchase_order_item_id) + '"><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span></td><td class="num">' + i.remaining + ' ' + esc(i.unit) + '</td>' +
                            (i.remaining ? '<td><input class="input" data-f="received" inputmode="numeric" value="' + i.remaining + '" aria-label="Received ' + esc(i.product_name) + '"></td><td><input class="input" data-f="rejected" inputmode="numeric" value="0" aria-label="Rejected ' + esc(i.product_name) + '"></td><td><input class="input" type="date" data-f="expiry" aria-label="Expiry ' + esc(i.product_name) + '"></td>'
                                : '<td colspan="3" class="cell-muted">Already complete</td>') + '</tr>';
                    }).join('') + '</tbody></table></div>' +
                    '<div class="field" style="margin-top:14px"><label for="rc-notes">Notes</label><input class="input" id="rc-notes" placeholder="เช่น กล่องบุบ 1 ลัง / เลขพัสดุ"></div>',
                actions: [{ label: 'ยกเลิก', kind: 'ghost' }, { label: 'บันทึกการรับพัสดุ', kind: 'primary', onClick: function (modal) { submit(modal, o); } }]
            });
        }

        async function submit(modal, o) {
            var lines = [], problem = '';
            modal.el.querySelectorAll('[data-line]').forEach(function (tr) {
                var inputs = tr.querySelectorAll('[data-f]');
                if (!inputs.length || problem) return;
                var item = o.items.filter(function (i) { return i.purchase_order_item_id === tr.getAttribute('data-line'); })[0];
                var rec = Number(tr.querySelector('[data-f=received]').value || 0), rej = Number(tr.querySelector('[data-f=rejected]').value || 0);
                if (!Number.isInteger(rec) || rec < 0 || !Number.isInteger(rej) || rej < 0) problem = 'จำนวนรับและจำนวนที่ปฏิเสธต้องเป็นจำนวนเต็ม 0 ขึ้นไป';
                else if (rej > rec) problem = 'จำนวนที่ปฏิเสธต้องไม่มากกว่าจำนวนที่รับ (' + item.product_name + ')';
                else if (rec > item.remaining) problem = 'จำนวนที่รับเกินจำนวนที่ยังค้างรับ (' + item.remaining + ') ของ ' + item.product_name;
                if (rec > 0) lines.push({ purchase_order_item_id: item.purchase_order_item_id, quantity_received: rec, quantity_rejected: rej, expiry_date: tr.querySelector('[data-f=expiry]').value || '' });
            });
            if (!problem && !lines.length) problem = 'กรุณาระบุจำนวนที่รับอย่างน้อย 1 รายการ';
            if (problem) { modal.error(problem); return; }
            modal.error('');
            modal.setBusy(true);
            try {
                var res = await SA.api('/staff/arrivals', { method: 'POST', body: { branch: state.branch, purchase_order_id: o.purchase_order_id, notes: modal.el.querySelector('#rc-notes').value.trim(), items: lines } });
                modal.close();
                UI.toast('บันทึกการรับสินค้าสำเร็จ · เพิ่มสต็อก ' + res.units_added + ' หน่วย' + (res.units_rejected ? ' · ปฏิเสธ ' + res.units_rejected : ''));
                await load();
                if (SA.route() === route) draw();
            } catch (err) { modal.setBusy(false); modal.error(err.message); }
        }
    };
})();
