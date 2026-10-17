/* Daily Sales (UC-17) - summarize one day of orders for a branch and save it to sales_reports */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;
    var PAY_COLORS = ['#a6532b', '#127fb0', '#b98a52', '#6b5d52'];

    function isoToday() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function thaiDate(iso) { var p = String(iso).split('-'); return Number(p[2]) + '/' + Number(p[1]) + '/' + p[0]; }

    SA.pages['sales-summary'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { branches: [], branch: UI.branchPref(), date: isoToday(), data: null, saving: false };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        if (!state.branches.some(function (b) { return b.branch_id === state.branch; }) && state.branches.length) state.branch = state.branches[0].branch_id;
        await load();
        if (SA.route() !== route) return;

        main.innerHTML = SA.pageHeader(title) +
            '<div class="toolbar">' +
                '<label class="sr-only" for="ds-branch">Branch</label>' +
                '<select id="ds-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch) + '</select>' +
                '<label class="sr-only" for="ds-date">Date</label>' +
                '<input type="date" id="ds-date" class="select" aria-label="Sales date" value="' + state.date + '" max="' + isoToday() + '">' +
                '<button type="button" class="btn btn-ghost" id="ds-today">วันนี้</button>' +
                '<span class="toolbar-spacer"></span>' +
                '<span id="ds-save-wrap"></span>' +
            '</div>' +
            '<p class="field-error" id="ds-error" role="alert" hidden style="margin:-8px 0 14px"></p>' +
            '<div id="ds-body"></div>';

        document.getElementById('ds-branch').addEventListener('change', function (e) {
            state.branch = e.target.value; UI.branchPref(state.branch); refresh();
        });
        document.getElementById('ds-date').addEventListener('change', function (e) {
            if (!e.target.value) { e.target.value = state.date; return; }
            state.date = e.target.value; refresh();
        });
        document.getElementById('ds-today').addEventListener('click', function () {
            state.date = isoToday(); document.getElementById('ds-date').value = state.date; refresh();
        });
        draw();

        async function load() {
            state.data = await SA.api('/reports/sales/daily?branch=' + encodeURIComponent(state.branch) + '&date=' + state.date);
        }

        function showError(message) {
            var el = document.getElementById('ds-error');
            if (!el) return;
            el.hidden = !message;
            el.textContent = message || '';
        }

        async function refresh() {
            showError('');
            document.getElementById('ds-body').innerHTML = '<p class="loading">กำลังโหลดข้อมูล...</p>';
            try {
                await load();
                if (SA.route() === route) draw();
            } catch (err) {
                state.data = null;
                document.getElementById('ds-body').innerHTML = '';
                drawSave();
                showError(err.message);
            }
        }

        async function save() {
            if (state.saving) return;
            state.saving = true; drawSave();
            try {
                var body = { branch: state.branch, date: state.date };
                var res = await SA.api('/reports/sales/daily', { method: 'POST', body: body });
                if (SA.route() !== route) return;
                state.data = res;
                UI.toast(res.result === 'created' ? 'บันทึกสรุปยอดขายประจำวันเรียบร้อยแล้ว'
                    : res.result === 'updated' ? 'อัปเดตสรุปยอดขายตามยอดที่เพิ่มขึ้นเรียบร้อยแล้ว'
                    : 'สรุปยอดขายของวันนี้ถูกบันทึกไว้แล้ว ยอดขายไม่มีการเปลี่ยนแปลง');
                showError('');
            } catch (err) {
                showError(err.message);
            }
            state.saving = false;
            if (SA.route() === route) draw();
        }

        function drawSave() {
            var d = state.data, wrap = document.getElementById('ds-save-wrap');
            if (!wrap) return;
            if (!d || !d.has_orders) { wrap.innerHTML = ''; return; }
            var label = d.report_state === 'saved' ? 'บันทึกแล้ว' : d.report_state === 'outdated' ? 'อัปเดตสรุปยอดขาย' : 'บันทึกสรุปยอดขาย';
            wrap.innerHTML = '<button type="button" class="btn btn-primary" id="ds-save"' + (d.report_state === 'saved' || state.saving ? ' disabled' : '') + '>' + esc(state.saving ? 'กำลังบันทึก...' : label) + '</button>';
            var btn = document.getElementById('ds-save');
            if (btn) btn.addEventListener('click', save);
        }

        function reportNote(d) {
            var r = d.report;
            if (d.report_state === 'new') return UI.badge('warn', 'ยังไม่ได้บันทึกสรุปยอดขายของวันที่เลือก');
            if (d.report_state === 'outdated') {
                return UI.badge('info', 'มียอดขายเพิ่มขึ้นหลังบันทึกล่าสุด') +
                    ' <span class="cell-muted">' + esc(r.report_id) + ' บันทึกไว้ ' + UI.money(r.total_sales) + ' · ' + UI.int(r.total_transactions) + ' รายการ (' + esc(r.generated_at) + ')</span>';
            }
            return UI.badge('good', 'บันทึกแล้ว') + ' <span class="cell-muted">' + esc(r.report_id) + ' · ' + esc(r.generated_at) + '</span>';
        }

        function draw() {
            var d = state.data, body = document.getElementById('ds-body');
            drawSave();
            if (!d) { body.innerHTML = ''; return; }
            var branchName = SA.branchName(state.branches, d.branch_id);

            if (!d.has_orders) {
                var today = d.date === isoToday();
                body.innerHTML = UI.emptyState(
                    today ? 'ไม่พบรายการสั่งซื้อสำหรับสรุปยอดขายในวันนี้' : 'ไม่พบรายการสั่งซื้อสำหรับสรุปยอดขายในวันที่ ' + thaiDate(d.date),
                    'สาขา ' + branchName + ' ยังไม่มีรายการสั่งซื้อ ลองเลือกสาขาหรือวันที่อื่น');
                return;
            }

            var s = d.summary;
            body.innerHTML =
                '<p class="margin-note" style="margin:0 0 14px">' + reportNote(d) + '</p>' +
                '<div class="stat-row">' +
                    UI.statTile('Total sales', UI.money(s.total_sales), branchName + ' · ' + thaiDate(d.date), 'rust') +
                    UI.statTile('Transactions', UI.int(s.total_transactions), 'orders on this day') +
                    UI.statTile('Average ticket', UI.money(s.average_ticket), 'per order') +
                '</div>' +
                '<div class="split" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-bottom:22px">' +
                    bestSellers(d.best_sellers) + payments(d.payments) +
                '</div>' +
                orderList(d.orders);
        }

        function bestSellers(list) {
            var max = Math.max.apply(null, list.map(function (b) { return b.units; }).concat(1));
            return '<div class="chart-panel"><h3>สินค้าขายดี</h3><p class="chart-sub">Top ' + list.length + ' by units sold</p>' +
                '<ul class="bar-list">' + list.map(function (b) {
                    return '<li style="grid-template-columns:minmax(120px,40%) minmax(0,1fr) auto" data-tip="' + esc(b.product_name + ': ' + UI.int(b.units) + ' ' + b.unit + ' · ' + UI.money(b.revenue)) + '">' +
                        '<span class="bar-label" style="width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + esc(b.product_name) + '">' + esc(b.product_name) + '</span>' +
                        '<span class="bar-track"><span class="bar" style="width:' + Math.max(2, (b.units / max) * 100) + '%;background:' + PAY_COLORS[0] + '"></span></span>' +
                        '<span class="bar-value" style="width:auto;white-space:nowrap">' + UI.int(b.units) + ' <span class="cell-muted">' + esc(b.unit) + '</span></span></li>';
                }).join('') + '</ul></div>';
        }

        function payments(list) {
            var max = Math.max.apply(null, list.map(function (p) { return p.total; }).concat(1));
            return '<div class="chart-panel"><h3>ช่องทางชำระเงิน</h3><p class="chart-sub">Sales by payment method (฿)</p>' +
                '<ul class="bar-list">' + list.map(function (p, i) {
                    return '<li style="grid-template-columns:minmax(96px,32%) minmax(0,1fr) auto" data-tip="' + esc(p.payment_method + ': ' + UI.money(p.total) + ' · ' + p.transactions + ' orders · ' + p.share + '%') + '">' +
                        '<span class="bar-label" style="width:auto;white-space:nowrap">' + esc(p.payment_method) + '</span>' +
                        '<span class="bar-track"><span class="bar" style="width:' + Math.max(2, (p.total / max) * 100) + '%;background:' + PAY_COLORS[Math.min(i, PAY_COLORS.length - 1)] + '"></span></span>' +
                        '<span class="bar-value" style="width:auto;white-space:nowrap">' + UI.money(p.total) + ' <span class="cell-muted">' + p.share + '%</span></span></li>';
                }).join('') + '</ul></div>';
        }

        function orderList(orders) {
            return '<details class="order-details"><summary class="section-title" style="cursor:pointer;font-size:16px">รายการสั่งซื้อของวันนี้ <span class="cell-muted">(' + orders.length + ')</span></summary>' +
                '<div class="table-scroll"><table class="data-table"><thead><tr><th>Time</th><th>Order</th><th>Payment</th><th class="num">Amount</th></tr></thead><tbody>' +
                orders.map(function (o) {
                    return '<tr><td>' + esc(o.time) + '</td><td class="strong">' + esc(o.order_id) + '</td><td>' + esc(o.payment_method) + '</td><td class="num"><b>' + UI.money(o.total_amount) + '</b></td></tr>';
                }).join('') + '</tbody></table></div></details>';
        }
    };
})();
