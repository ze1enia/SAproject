/* Manage Stock (Staff) - check the branch stock and correct it to match the real count */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;

    var MODES = [
        { id: 'set', label: 'Set counted quantity', hint: 'Type what is really on the shelf' },
        { id: 'add', label: 'Add stock', hint: 'Found extra units' },
        { id: 'remove', label: 'Remove stock', hint: 'Lost / used / wrong entry' },
        { id: 'damage', label: 'Damaged', hint: 'Write off broken units' }
    ];

    SA.pages['manage-stock'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', search: '', level: 'all', data: null, history: [] };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);

        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var q = '?branch=' + encodeURIComponent(state.branch);
            var res = await Promise.all([SA.api('/staff/stocks' + q), SA.api('/staff/stocks/adjustments' + q)]);
            state.data = res[0]; state.history = res[1];
        }

        function draw() {
            var s = state.data.summary;
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) +
                    '<div class="grow"><input type="search" id="ms-search" class="search-input" placeholder="Search product or ID..." aria-label="Search products" value="' + esc(state.search) + '"></div>' +
                    '<select id="ms-level" class="select" aria-label="Stock level">' +
                        opt('all', 'All levels') + opt('low', 'Low stock') + opt('out', 'Out of stock') + opt('ok', 'In stock') + '</select>' +
                '</div>' +
                (s.products ? '<div class="stat-row">' +
                    UI.statTile('Products', UI.int(s.products)) +
                    UI.statTile('Units on hand', UI.int(s.units), UI.int(s.reserved) + ' reserved') +
                    UI.statTile('Low stock', UI.int(s.low), '≤ ' + state.data.threshold + ' units', s.low ? 'warn' : '') +
                    UI.statTile('Out of stock', UI.int(s.out), null, s.out ? 'bad' : '') + '</div>' : '') +
                '<div id="ms-table"></div>' +
                '<div class="panel" style="margin-top:20px"><h3>Recent adjustments</h3><div id="ms-history"></div></div>';

            S.onBranch(async function (b) { state.branch = b; state.search = ''; state.level = 'all'; await load(); if (SA.route() === route) draw(); });
            var input = document.getElementById('ms-search');
            input.addEventListener('input', UI.debounce(function () { state.search = input.value.trim().toLowerCase(); drawTable(); }, 150));
            document.getElementById('ms-level').addEventListener('change', function (e) { state.level = e.target.value; drawTable(); });
            drawTable();
            drawHistory();
        }

        function opt(v, label) { return '<option value="' + v + '"' + (state.level === v ? ' selected' : '') + '>' + esc(label) + '</option>'; }

        function drawTable() {
            var target = document.getElementById('ms-table');
            if (!state.data.summary.products) { target.innerHTML = S.noData(state.list, state.branch); return; }
            var term = state.search;
            var rows = state.data.items.filter(function (i) {
                return (state.level === 'all' || i.status === state.level) && (!term || i.product_name.toLowerCase().indexOf(term) !== -1 || i.product_id.toLowerCase().indexOf(term) !== -1);
            });
            if (!rows.length) { target.innerHTML = UI.emptyState('ไม่พบสินค้าที่ค้นหา'); return; }
            var max = Math.max.apply(null, state.data.items.map(function (i) { return i.quantity_on_hand; }).concat(1));

            target.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>Product</th><th>On hand</th><th class="num">Reserved</th><th class="num">Available</th><th>Status</th><th class="actions">Action</th></tr></thead><tbody>' +
                rows.map(function (i) {
                    var pct = Math.max(i.quantity_on_hand ? 3 : 0, (i.quantity_on_hand / max) * 100);
                    var badge = i.status === 'out' ? UI.badge('bad', 'Out of stock') : i.status === 'low' ? UI.badge('warn', 'Low stock') : UI.badge('good', 'In stock');
                    return '<tr><td><span class="strong">' + esc(i.product_name) + '</span><span class="sub">' + esc(i.product_id) + ' · ' + esc(i.category_name) + '</span></td>' +
                        '<td data-tip="' + esc(i.quantity_on_hand + ' ' + i.unit + ' on hand') + '"><span class="cell-bar"><span class="bar-track"><span class="bar' + (i.status !== 'ok' ? ' accent' : '') + '" style="width:' + pct + '%"></span></span><b>' + UI.int(i.quantity_on_hand) + '</b></span></td>' +
                        '<td class="num">' + UI.int(i.quantity_reserved) + '</td>' +
                        '<td class="num"><b>' + UI.int(i.available) + '</b> <span class="cell-muted">' + esc(i.unit) + '</span></td>' +
                        '<td>' + badge + '</td>' +
                        '<td class="actions"><button type="button" class="btn btn-ghost btn-sm" data-adjust="' + esc(i.product_id) + '">Adjust</button></td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="table-note">Showing ' + rows.length + ' of ' + state.data.items.length + ' products</p>';
            target.querySelectorAll('[data-adjust]').forEach(function (b) {
                b.addEventListener('click', function () { openAdjust(state.data.items.filter(function (i) { return i.product_id === b.getAttribute('data-adjust'); })[0]); });
            });
        }

        function drawHistory() {
            var el = document.getElementById('ms-history');
            el.innerHTML = state.history.length ? '<ul class="history-list">' + state.history.map(function (h) {
                var diff = h.quantity_after - h.quantity_before;
                return '<li><span>' + esc(h.product_name) + ' <span class="cell-muted">· ' + esc(h.adjust_type) + '</span></span>' +
                    '<span class="delta ' + (diff > 0 ? 'amount-in' : 'amount-out') + '">' + (diff > 0 ? '▲ +' : '▼ ') + diff + ' (' + h.quantity_before + ' → ' + h.quantity_after + ')</span>' +
                    '<span class="when">' + esc(h.reason) + ' · ' + esc(h.created_at) + ' · ' + esc(h.created_by || '—') + '</span></li>';
            }).join('') + '</ul>' : '<p class="cell-muted" style="margin:0;font-size:13px">ยังไม่มีประวัติการปรับปรุงสต็อกของสาขานี้</p>';
        }

        /* ------------------------------------------------------------ adjust */

        function openAdjust(item) {
            var m = UI.modal({
                title: 'Adjust stock · ' + item.product_name,
                body:
                    '<p class="cell-muted" style="margin:0 0 12px;font-size:13px">' + esc(item.product_id) + ' · ' + esc(SA.branchName(state.list, state.branch)) + ' · currently <b>' + item.quantity_on_hand + '</b> ' + esc(item.unit) + ' on hand</p>' +
                    '<form id="af" novalidate>' +
                        '<fieldset style="border:0;padding:0;margin:0 0 14px"><legend class="label" style="font-size:13px;font-weight:700;color:var(--coffee);margin-bottom:6px">What do you want to do?</legend><div class="mode-grid">' +
                            MODES.map(function (md, i) {
                                return '<label class="mode-card"><input type="radio" name="mode" value="' + md.id + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(md.label) + '<small>' + esc(md.hint) + '</small></span></label>';
                            }).join('') + '</div></fieldset>' +
                        '<div class="field" data-field="quantity" style="margin-bottom:12px"><label for="af-qty" id="af-qty-label">Counted quantity</label>' +
                            '<input class="input" id="af-qty" name="quantity" inputmode="numeric" autocomplete="off"><p class="field-error" hidden></p></div>' +
                        '<div class="change-preview" id="af-preview" aria-live="polite"></div>' +
                        '<div class="field" data-field="reason" style="margin-top:14px"><label for="af-reason">Reason <span class="req" aria-hidden="true">*</span></label>' +
                            '<textarea class="textarea" id="af-reason" name="reason" placeholder="เช่น นับสต็อกประจำสัปดาห์ / สินค้าแตกระหว่างขนย้าย"></textarea><p class="field-error" hidden></p></div>' +
                    '</form>',
                actions: [{ label: 'ยกเลิก', kind: 'ghost' }, { label: 'บันทึกการปรับปรุง', kind: 'primary', onClick: function (modal) { submit(modal, item); } }]
            });

            var form = m.el.querySelector('#af');
            form.addEventListener('submit', function (e) { e.preventDefault(); });
            var update = function () { preview(form, item); };
            form.addEventListener('input', update);
            form.addEventListener('change', update);
            update();
        }

        function currentMode(form) { return form.elements.mode.value; }

        function target(form, item) {
            var n = Number(form.elements.quantity.value);
            if (form.elements.quantity.value.trim() === '' || !Number.isInteger(n) || n < 0) return null;
            var mode = currentMode(form);
            return mode === 'set' ? n : mode === 'add' ? item.quantity_on_hand + n : item.quantity_on_hand - n;
        }

        function preview(form, item) {
            var mode = currentMode(form);
            document.getElementById('af-qty-label').textContent = mode === 'set' ? 'Counted quantity' : mode === 'add' ? 'Quantity to add' : mode === 'remove' ? 'Quantity to remove' : 'Quantity damaged';
            var after = target(form, item), box = document.getElementById('af-preview');
            if (after === null) { box.innerHTML = '<small>Enter a quantity to see the new stock level</small>'; return; }
            var diff = after - item.quantity_on_hand;
            box.innerHTML = '<span><small>Now</small>' + item.quantity_on_hand + '</span><span class="arrow" aria-hidden="true">→</span>' +
                '<span class="' + (after < 0 ? 'delta-down' : '') + '"><small>New stock</small>' + after + '</span>' +
                '<span class="' + (diff > 0 ? 'delta-up' : diff < 0 ? 'delta-down' : '') + '"><small>Change</small>' + (diff > 0 ? '+' : '') + diff + '</span>';
        }

        async function submit(modal, item) {
            var form = modal.el.querySelector('#af');
            var errors = {};
            var qty = form.elements.quantity.value.trim(), n = Number(qty), mode = currentMode(form);
            if (qty === '' || !Number.isInteger(n) || n < 0 || (mode !== 'set' && n === 0)) errors.quantity = mode === 'set' ? 'จำนวนนับจริงต้องเป็นจำนวนเต็ม 0 ขึ้นไป' : 'จำนวนต้องเป็นจำนวนเต็มที่มากกว่า 0';
            else if (target(form, item) < 0) errors.quantity = 'จำนวนที่ลดมากกว่าสต็อกคงเหลือ (' + item.quantity_on_hand + ')';
            else if (target(form, item) === item.quantity_on_hand) errors.quantity = 'จำนวนใหม่เท่ากับสต็อกปัจจุบัน ไม่มีการเปลี่ยนแปลง';
            if (!form.elements.reason.value.trim()) errors.reason = 'กรุณาระบุเหตุผลในการปรับปรุงสต็อก';

            form.querySelectorAll('[data-field]').forEach(function (f) {
                var name = f.getAttribute('data-field'), err = f.querySelector('.field-error');
                err.hidden = !errors[name]; err.textContent = errors[name] || '';
                form.elements[name].setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
            });
            var first = Object.keys(errors)[0];
            if (first) { form.elements[first].focus(); return; }

            modal.setBusy(true);
            try {
                await SA.api('/staff/stocks/adjust', { method: 'POST', body: { branch: state.branch, product_id: item.product_id, mode: mode, quantity: n, reason: form.elements.reason.value.trim() } });
                modal.close();
                UI.toast('บันทึกการปรับปรุงสต็อกเรียบร้อยแล้ว');
                await load();
                if (SA.route() === route) draw();
            } catch (err) { modal.setBusy(false); modal.error(err.message); }
        }
    };
})();
