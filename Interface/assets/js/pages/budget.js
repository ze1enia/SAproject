/* Budget (UC-18) - budgets per branch, usage meter, income vs expense, transactions */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    function statusBadge(status) { return status === 'Active' ? UI.badge('good', 'Active') : UI.badge('muted', status); }
    function meterClass(pct) { return pct >= 90 ? ' is-bad' : pct >= 70 ? ' is-warn' : ''; }
    function money(n) { return UI.money(n); }

    SA.pages['budget'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { branches: [], branch: '', budgets: [], selected: null, detail: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        await loadBudgets();
        if (SA.route() !== route) return;

        main.innerHTML = SA.pageHeader(title) +
            '<div class="toolbar"><select id="bg-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch, 'All branches') + '</select></div>' +
            '<div id="bg-cards"></div><div id="bg-detail"></div>';

        document.getElementById('bg-branch').addEventListener('change', async function (e) {
            state.branch = e.target.value; state.selected = null; state.detail = null;
            await loadBudgets();
            if (SA.route() !== route) return;
            drawCards();
            if (state.selected) await selectBudget(state.selected);
            else drawDetail();
        });

        drawCards();
        if (state.selected) await selectBudget(state.selected);

        async function loadBudgets() {
            state.budgets = await SA.api('/reports/budgets' + (state.branch ? '?branch=' + encodeURIComponent(state.branch) : ''));
            // open the first active budget by default
            var first = state.budgets.filter(function (b) { return b.budget_status === 'Active'; })[0] || state.budgets[0];
            state.selected = first ? first.budget_id : null;
        }

        function drawCards() {
            var target = document.getElementById('bg-cards');
            if (!state.budgets.length) { target.innerHTML = UI.emptyState('ไม่พบข้อมูลงบประมาณของสาขานี้'); document.getElementById('bg-detail').innerHTML = ''; return; }
            target.innerHTML = '<div class="card-grid" style="margin-bottom:22px">' + state.budgets.map(function (b) {
                return '<button type="button" class="budget-card' + (b.budget_id === state.selected ? ' is-selected' : '') + '" data-budget="' + esc(b.budget_id) + '" aria-pressed="' + (b.budget_id === state.selected) + '">' +
                    '<span class="bc-top"><span class="bc-id">' + esc(b.budget_id) + '<span class="bc-period">' + esc(SA.branchName(state.branches, b.branch_id)) + ' · ' + esc(b.period_start) + ' – ' + esc(b.period_end) + '</span></span>' + statusBadge(b.budget_status) + '</span>' +
                    '<span class="bc-amount">' + money(b.remaining) + '<small>remaining of ' + money(b.allocated_amount) + ' allocated</small></span>' +
                    '<span data-tip="' + esc(b.used_percent + '% of the budget spent (' + money(b.expense_total) + ')') + '"><span class="meter"><span class="meter-fill' + meterClass(b.used_percent) + '" style="width:' + Math.max(b.used_percent ? 2 : 0, Math.min(100, b.used_percent)) + '%"></span></span>' +
                    '<span class="meter-legend"><span>Spent ' + money(b.expense_total) + '</span><span>' + b.used_percent + '% used</span></span></span>' +
                '</button>';
            }).join('') + '</div>';

            target.querySelectorAll('[data-budget]').forEach(function (btn) {
                btn.addEventListener('click', function () { selectBudget(btn.getAttribute('data-budget')); });
            });
        }

        async function selectBudget(id) {
            state.selected = id;
            drawCards();
            document.getElementById('bg-detail').innerHTML = '<p class="loading">กำลังโหลดข้อมูล...</p>';
            try {
                var detail = await SA.api('/reports/budgets/' + encodeURIComponent(id));
                if (SA.route() !== route || state.selected !== id) return;
                state.detail = detail;
                drawDetail();
            } catch (err) {
                document.getElementById('bg-detail').innerHTML = '<p class="error-message">' + esc(err.message) + '</p>';
            }
        }

        function drawDetail() {
            var el = document.getElementById('bg-detail');
            var d = state.detail;
            if (!d) { el.innerHTML = ''; return; }
            var big = Math.max(d.income_total, d.expense_total, 1);

            el.innerHTML =
                '<h3 class="section-title">' + esc(d.budget_id) + ' · ' + esc(SA.branchName(state.branches, d.branch_id)) + ' <span class="cell-muted">' + esc(d.period_start) + ' – ' + esc(d.period_end) + '</span></h3>' +
                '<div class="stat-row">' +
                    UI.statTile('Allocated', money(d.allocated_amount)) +
                    UI.statTile('Expense', '<span class="amount-out">' + money(d.expense_total) + '</span>', d.used_percent + '% of budget') +
                    UI.statTile('Income', '<span class="amount-in">' + money(d.income_total) + '</span>') +
                    UI.statTile('Remaining', money(d.remaining), 'allocated − expense + income') +
                '</div>' +
                '<div class="chart-panel">' +
                    '<h3>Income vs expense</h3><p class="chart-sub">Money moving through this budget</p>' +
                    '<p class="legend"><span><i style="background:var(--income)"></i>Income</span><span><i style="background:var(--expense)"></i>Expense</span></p>' +
                    '<ul class="bar-list">' +
                        flowRow('Income', d.income_total, big, 'var(--income)') +
                        flowRow('Expense', d.expense_total, big, 'var(--expense)') +
                    '</ul></div>' +
                (d.transactions.length ? transactionTable(d.transactions) : UI.emptyState('ยังไม่มีรายการเคลื่อนไหวทางการเงินในงบประมาณนี้'));
        }

        function flowRow(label, value, max, color) {
            return '<li data-tip="' + esc(label + ': ' + money(value)) + '"><span class="bar-label">' + label + '</span>' +
                '<span class="bar-track"><span class="bar" style="width:' + (value ? Math.max(2, (value / max) * 100) : 0) + '%;background:' + color + '"></span></span>' +
                '<span class="bar-value" style="width:auto;white-space:nowrap">' + money(value) + '</span></li>';
        }

        function transactionTable(rows) {
            return '<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="num">Amount</th><th>Recorded by</th></tr></thead><tbody>' +
                rows.map(function (t) {
                    var income = t.transaction_type === 'Income';
                    return '<tr><td>' + esc(String(t.transaction_date).split(' ')[0]) + '<span class="sub">' + esc(String(t.transaction_date).split(' ')[1] || '') + '</span></td>' +
                        '<td>' + (income ? '<span class="badge badge-income"><span aria-hidden="true">▲</span> Income</span>' : '<span class="badge badge-expense"><span aria-hidden="true">▼</span> Expense</span>') + '</td>' +
                        '<td>' + esc(t.description) + '<span class="sub">' + esc(t.transaction_id) + '</span></td>' +
                        '<td class="num"><b class="' + (income ? 'amount-in' : 'amount-out') + '">' + (income ? '+' : '−') + money(t.amount) + '</b></td>' +
                        '<td class="cell-muted">' + esc(t.recorded_by || '—') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }
    };
})();
