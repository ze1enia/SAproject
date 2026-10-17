/* Sales Report (UC-16) - filter by branch and period, KPI tiles, chart and table */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // categorical order (rust, blue validated together); branch identity is also in the legend + tooltip
    var BRANCH_COLORS = ['#a6532b', '#127fb0', '#6b5d52', '#b98a52'];

    function parts(text) { var m = String(text || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? { d: +m[1], m: +m[2], y: +m[3] } : null; }
    function short(text) { var p = parts(text); return p ? p.d + ' ' + MONTHS[p.m - 1] : text; }
    function stamp(text) { var p = parts(text); return p ? p.y * 10000 + p.m * 100 + p.d : 0; }
    function compact(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(Math.round(n)); }

    SA.pages['sales-report'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { branches: [], branch: '', from: '', to: '', data: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        await load();
        if (SA.route() !== route) return;

        main.innerHTML = SA.pageHeader(title) +
            '<form class="toolbar" id="sr-filters" novalidate>' +
                '<select id="sl-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch, 'All branches') + '</select>' +
                '<label class="sr-only" for="sl-from">From</label><input type="date" id="sl-from" class="select" aria-label="From date">' +
                '<span class="cell-muted" aria-hidden="true">–</span>' +
                '<label class="sr-only" for="sl-to">To</label><input type="date" id="sl-to" class="select" aria-label="To date">' +
                '<button type="button" class="btn btn-ghost" id="sl-clear">ล้างเงื่อนไข</button>' +
            '</form>' +
            '<p class="field-error" id="sl-error" role="alert" hidden style="margin:-8px 0 14px"></p>' +
            '<div id="sl-body"></div>';

        document.getElementById('sl-branch').addEventListener('change', function (e) { state.branch = e.target.value; apply(); });
        document.getElementById('sl-from').addEventListener('change', function (e) { state.from = e.target.value; apply(); });
        document.getElementById('sl-to').addEventListener('change', function (e) { state.to = e.target.value; apply(); });
        document.getElementById('sl-clear').addEventListener('click', function () {
            state.branch = ''; state.from = ''; state.to = '';
            document.getElementById('sl-branch').value = ''; document.getElementById('sl-from').value = ''; document.getElementById('sl-to').value = '';
            apply();
        });
        document.getElementById('sr-filters').addEventListener('submit', function (e) { e.preventDefault(); });
        draw();

        async function load() {
            var q = [];
            if (state.branch) q.push('branch=' + encodeURIComponent(state.branch));
            if (state.from) q.push('from=' + state.from);
            if (state.to) q.push('to=' + state.to);
            state.data = await SA.api('/reports/sales' + (q.length ? '?' + q.join('&') : ''));
        }

        async function apply() {
            var err = document.getElementById('sl-error');
            if (state.from && state.to && state.from > state.to) {
                err.hidden = false;
                err.textContent = 'ช่วงเวลาที่เลือกไม่ถูกต้อง กรุณาตรวจสอบวันที่เริ่มต้นและสิ้นสุด';
                document.getElementById('sl-from').setAttribute('aria-invalid', 'true');
                return;
            }
            err.hidden = true;
            document.getElementById('sl-from').setAttribute('aria-invalid', 'false');
            try {
                await load();
                if (SA.route() === route) draw();
            } catch (e) { err.hidden = false; err.textContent = e.message; }
        }

        function draw() {
            var d = state.data, s = d.summary, body = document.getElementById('sl-body');
            if (!d.items.length) { body.innerHTML = UI.emptyState('ไม่พบรายงานยอดขายตามเงื่อนไขที่เลือก', 'ลองเปลี่ยนสาขาหรือช่วงเวลา หรือกด "ล้างเงื่อนไข"'); return; }

            body.innerHTML =
                '<div class="stat-row">' +
                    UI.statTile('Total sales', UI.money(s.total_sales), s.reports + ' reports', 'rust') +
                    UI.statTile('Transactions', UI.int(s.total_transactions)) +
                    UI.statTile('Average ticket', UI.money(s.average_ticket), 'per transaction') +
                '</div>' +
                chart(d.items) +
                '<div class="table-scroll"><table class="data-table"><thead><tr>' +
                    '<th>Report</th><th>Branch</th><th>Period</th><th class="num">Total sales</th><th class="num">Transactions</th><th class="num">Avg ticket</th><th>Generated</th></tr></thead><tbody>' +
                    d.items.map(function (r) {
                        return '<tr><td class="strong">' + esc(r.report_id) + '</td>' +
                            '<td>' + esc(SA.branchName(state.branches, r.branch_id)) + '</td>' +
                            '<td>' + esc(short(r.period_start)) + ' – ' + esc(short(r.period_end)) + ' <span class="cell-muted">' + (parts(r.period_end) || {}).y + '</span></td>' +
                            '<td class="num"><b>' + UI.money(r.total_sales) + '</b></td>' +
                            '<td class="num">' + UI.int(r.total_transactions) + '</td>' +
                            '<td class="num">' + UI.money(r.total_transactions ? r.total_sales / r.total_transactions : 0) + '</td>' +
                            '<td class="cell-muted">' + esc(r.generated_by || '—') + '<span class="sub">' + esc(r.generated_at) + '</span></td></tr>';
                    }).join('') + '</tbody></table></div>';
        }

        function chart(items) {
            var ordered = items.slice().sort(function (a, b) { return stamp(a.period_start) - stamp(b.period_start) || stamp(a.period_end) - stamp(b.period_end); });
            var branchIds = [];
            ordered.forEach(function (r) { var n = SA.branchNumber(r.branch_id); if (branchIds.indexOf(n) === -1) branchIds.push(n); });
            branchIds.sort(function (a, b) { return a - b; });
            var colorOf = function (r) { return BRANCH_COLORS[Math.min(branchIds.indexOf(SA.branchNumber(r.branch_id)), BRANCH_COLORS.length - 1)]; };
            var max = Math.max.apply(null, ordered.map(function (r) { return r.total_sales; }).concat(1));

            var legend = branchIds.length > 1
                ? '<p class="legend">' + branchIds.map(function (n, i) {
                    var name = SA.branchName(state.branches, 'B' + String(n).padStart(3, '0'));
                    return '<span><i style="background:' + BRANCH_COLORS[Math.min(i, BRANCH_COLORS.length - 1)] + '"></i>' + esc(name) + '</span>';
                }).join('') + '</p>' : '';

            return '<div class="chart-panel"><h3>Sales by report period</h3><p class="chart-sub">Total sales per report, oldest to newest (฿)</p>' + legend +
                '<div class="column-chart" role="img" aria-label="' + esc(ordered.map(function (r) { return short(r.period_start) + ' ' + UI.money(r.total_sales); }).join(', ')) + '">' +
                ordered.map(function (r) {
                    var branch = SA.branchName(state.branches, r.branch_id);
                    return '<div class="column" data-tip="' + esc(branch + ' · ' + short(r.period_start) + ' – ' + short(r.period_end) + ': ' + UI.money(r.total_sales) + ' (' + r.total_transactions + ' transactions)') + '">' +
                        '<span class="column-value">' + compact(r.total_sales) + '</span>' +
                        '<span class="column-bar" style="height:' + Math.max(3, (r.total_sales / max) * 100) + '%;background:' + colorOf(r) + '"></span>' +
                        '<span class="column-label">' + esc(short(r.period_start)) + '<br>' + (branchIds.length > 1 ? esc(branch) : '') + '</span></div>';
                }).join('') + '</div></div>';
        }
    };
})();
