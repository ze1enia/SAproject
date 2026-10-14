/* Expiry Check (Staff, UC-11) - find batches near / past expiry and record the check result */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;
    var CRITERIA = [['expired', 'Already expired'], ['7', 'Within 7 days'], ['15', 'Within 15 days'], ['30', 'Within 30 days'], ['all', 'All with expiry date']];

    SA.pages['expiry-check'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', days: '30', category: '', categories: [], data: null, picked: {} };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        state.categories = await SA.api('/staff/categories');
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var q = '?branch=' + encodeURIComponent(state.branch) + '&days=' + state.days + (state.category ? '&category=' + encodeURIComponent(state.category) : '');
            state.data = await SA.api('/staff/expiry' + q);
            var ids = {}; state.data.items.forEach(function (i) { ids[i.batch_id] = true; });
            Object.keys(state.picked).forEach(function (id) { if (!ids[id]) delete state.picked[id]; });
        }

        function suggest(i) { return i.state === 'expired' ? 'Expired' : i.state === 'soon' ? 'Near Expiry' : 'Normal'; }

        function draw() {
            var items = state.data.items;
            var expired = items.filter(function (i) { return i.state === 'expired'; }).length, soon = items.filter(function (i) { return i.state === 'soon'; }).length;
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) +
                    '<select id="ex-days" class="select" aria-label="Expiry criteria">' + CRITERIA.map(function (c) { return '<option value="' + c[0] + '"' + (state.days === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select>' +
                    '<select id="ex-cat" class="select" aria-label="Category"><option value="">All categories</option>' + state.categories.map(function (c) { return '<option value="' + esc(c.category_id) + '"' + (state.category === c.category_id ? ' selected' : '') + '>' + esc(c.category_name) + '</option>'; }).join('') + '</select></div>' +
                '<div class="stat-row">' + UI.statTile('Batches found', UI.int(items.length)) + UI.statTile('Expired', UI.int(expired), null, expired ? 'bad' : '') + UI.statTile('Expiring ≤ 30 days', UI.int(soon), null, soon ? 'warn' : '') + '</div>' +
                (items.length ? table(items) : UI.emptyState('ไม่พบล็อตสินค้าตามเงื่อนไข', 'ลองขยายช่วงวันหมดอายุหรือเปลี่ยนหมวดหมู่')) +
                '<div class="submit-bar" id="ex-bar"></div>';

            S.onBranch(async function (b) { state.branch = b; state.picked = {}; await load(); if (SA.route() === route) draw(); });
            document.getElementById('ex-days').addEventListener('change', async function (e) { state.days = e.target.value; await load(); if (SA.route() === route) draw(); });
            document.getElementById('ex-cat').addEventListener('change', async function (e) { state.category = e.target.value; await load(); if (SA.route() === route) draw(); });

            var all = document.getElementById('ex-all');
            if (all) all.addEventListener('change', function () {
                items.forEach(function (i) { if (all.checked) state.picked[i.batch_id] = state.picked[i.batch_id] || suggest(i); else delete state.picked[i.batch_id]; });
                draw();
            });
            main.querySelectorAll('[data-pick]').forEach(function (c) {
                c.addEventListener('change', function () {
                    var id = c.getAttribute('data-pick'), item = items.filter(function (i) { return i.batch_id === id; })[0];
                    if (c.checked) state.picked[id] = state.picked[id] || suggest(item); else delete state.picked[id];
                    draw();
                });
            });
            main.querySelectorAll('[data-status]').forEach(function (sel) { sel.addEventListener('change', function () { state.picked[sel.getAttribute('data-status')] = sel.value; }); });
            drawBar();
        }

        function table(items) {
            var allOn = items.every(function (i) { return state.picked[i.batch_id]; });
            return '<div class="table-scroll"><table class="data-table"><thead><tr><th class="check-cell"><input type="checkbox" id="ex-all" aria-label="Select all"' + (allOn ? ' checked' : '') + '></th><th>Batch</th><th>Product</th><th>Expiry</th><th class="num">Remaining</th><th>Last check</th><th>Result of this check</th></tr></thead><tbody>' +
                items.map(function (i) {
                    var on = state.picked[i.batch_id];
                    var days = i.state === 'expired' ? UI.badge('bad', 'Expired ' + Math.abs(i.days_left) + 'd ago') : i.days_left === 0 ? UI.badge('warn', 'Today') : i.state === 'soon' ? UI.badge('warn', i.days_left + ' days left') : '<span class="cell-muted">' + i.days_left + ' days</span>';
                    return '<tr class="' + (on ? 'is-checked' : '') + '"><td class="check-cell"><input type="checkbox" data-pick="' + esc(i.batch_id) + '" aria-label="Select ' + esc(i.batch_id) + '"' + (on ? ' checked' : '') + '></td>' +
                        '<td class="strong">' + esc(i.batch_id) + '</td><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.category_name) + '</span></td>' +
                        '<td>' + esc(i.expiry_date) + '<span class="sub">' + days + '</span></td><td class="num">' + UI.int(i.quantity_remaining) + ' ' + esc(i.unit) + '</td>' +
                        '<td class="cell-muted">' + (i.last_status ? esc(i.last_status) + '<span class="sub">' + esc(i.last_checked_at) + '</span>' : '—') + '</td>' +
                        '<td>' + (on ? '<select class="select" data-status="' + esc(i.batch_id) + '" aria-label="Status of ' + esc(i.batch_id) + '">' + state.data.statuses.map(function (s) { return '<option' + (on === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' : '<span class="cell-muted">tick to check</span>') + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        function drawBar() {
            var n = Object.keys(state.picked).length, bar = document.getElementById('ex-bar');
            bar.innerHTML = '<span class="summary"><b>' + n + '</b> batches selected</span>' +
                '<input class="input" id="ex-note" placeholder="Note (optional)" aria-label="Note" style="max-width:260px">' +
                '<button type="button" class="btn btn-primary" id="ex-save">บันทึกผลการตรวจสอบ</button>';
            document.getElementById('ex-save').addEventListener('click', save);
        }

        async function save() {
            var ids = Object.keys(state.picked);
            if (!ids.length) { UI.toast('โปรดเลือกรายการสินค้าที่ต้องการบันทึก', 'bad'); return; }
            var btn = document.getElementById('ex-save'); btn.disabled = true;
            try {
                await SA.api('/staff/expiry', { method: 'POST', body: { branch: state.branch, note: document.getElementById('ex-note').value.trim(), checks: ids.map(function (id) { return { batch_id: id, status: state.picked[id] }; }) } });
                UI.toast('บันทึกผลการตรวจสอบสินค้าหมดอายุสำเร็จ');
                state.picked = {};
                await load();
                if (SA.route() === route) draw();
            } catch (err) { btn.disabled = false; UI.toast(err.message, 'bad'); }
        }
    };
})();
