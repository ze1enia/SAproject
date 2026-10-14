/* Stock Request Review (Staff) - UC-05 check, UC-06 approve, UC-07 cancel with feedback */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;
    var BADGE = { Pending: 'warn', Approved: 'good', Cancelled: 'bad' };

    SA.pages['stock-request-review'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', status: 'Pending', requests: [], open: {} };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() { state.requests = await SA.api('/staff/requests?branch=' + encodeURIComponent(state.branch)); }

        function count(status) { return state.requests.filter(function (r) { return r.status === status; }).length; }

        function draw() {
            var shown = state.requests.filter(function (r) { return !state.status || r.status === state.status; });
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) +
                    '<select id="rr-status" class="select" aria-label="Status">' + ['Pending', 'Approved', 'Cancelled', ''].map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + (s || 'All status') + '</option>'; }).join('') + '</select></div>' +
                '<div class="stat-row">' + UI.statTile('Waiting for review', UI.int(count('Pending')), 'Pending', count('Pending') ? 'rust' : '') +
                    UI.statTile('Approved', UI.int(count('Approved'))) + UI.statTile('Cancelled', UI.int(count('Cancelled'))) + '</div>' +
                (state.requests.length ? (shown.length ? shown.map(card).join('') : UI.emptyState('ไม่มีคำขอสถานะนี้')) : S.noData(state.list, state.branch));

            S.onBranch(async function (b) { state.branch = b; await load(); if (SA.route() === route) draw(); });
            document.getElementById('rr-status').addEventListener('change', function (e) { state.status = e.target.value; draw(); });
            main.querySelectorAll('.request-head').forEach(function (h) {
                h.addEventListener('click', function () {
                    var c = h.parentNode, open = c.classList.toggle('open');
                    state.open[c.getAttribute('data-request')] = open; h.setAttribute('aria-expanded', open);
                });
            });
            main.querySelectorAll('[data-approve]').forEach(function (b) { b.addEventListener('click', function () { approve(find(b.getAttribute('data-approve'))); }); });
            main.querySelectorAll('[data-cancel]').forEach(function (b) { b.addEventListener('click', function () { cancel(find(b.getAttribute('data-cancel'))); }); });
        }

        function find(id) { return state.requests.filter(function (r) { return r.request_id === id; })[0]; }

        function card(r) {
            var units = r.items.reduce(function (s, i) { return s + i.requested_quantity; }, 0);
            var short = r.items.filter(function (i) { return i.current_stock < i.requested_quantity; }).length;
            var open = state.open[r.request_id] !== undefined ? state.open[r.request_id] : r.status === 'Pending';
            return '<article class="request-card' + (open ? ' open' : '') + '" data-request="' + esc(r.request_id) + '">' +
                '<button type="button" class="request-head" aria-expanded="' + open + '">' +
                    '<span class="rid">' + esc(r.request_id) + '</span>' +
                    '<span>' + esc(r.request_date) + ' <span class="muted">· requested by ' + esc(r.requested_by || '—') + '</span></span>' +
                    '<span>' + UI.badge(BADGE[r.status] || 'muted', r.status) + '</span><span class="chev" aria-hidden="true">▸</span>' +
                    '<span class="muted" style="grid-column:2 / -1">' + r.items.length + ' items · ' + UI.int(units) + ' units' + (r.status === 'Pending' && short ? ' · <b style="color:var(--bad-fg)">' + short + ' item' + (short > 1 ? 's' : '') + ' above current stock</b>' : '') + '</span></button>' +
                '<div class="request-body">' +
                    '<div class="table-scroll" style="margin-top:12px"><table class="data-table"><thead><tr><th>Product</th><th class="num">Requested</th><th class="num">In stock now</th><th>Check</th></tr></thead><tbody>' +
                    r.items.map(function (i) {
                        var enough = i.current_stock >= i.requested_quantity;
                        return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span></td><td class="num"><b>' + UI.int(i.requested_quantity) + '</b> ' + esc(i.unit) + '</td><td class="num">' + UI.int(i.current_stock) + '</td>' +
                            '<td>' + (enough ? UI.badge('good', 'Enough stock') : UI.badge('warn', 'Short ' + (i.requested_quantity - i.current_stock))) + '</td></tr>';
                    }).join('') + '</tbody></table></div>' +
                    (r.feedback ? '<p class="feedback"><b>' + (r.status === 'Pending' ? 'Note' : 'Feedback' + (r.reviewed_by ? ' · ' + esc(r.reviewed_by) : '') + (r.reviewed_at ? ' · ' + esc(r.reviewed_at) : '')) + '</b>' + esc(r.feedback) + '</p>' : '') +
                    (r.status === 'Pending'
                        ? '<div class="toolbar" style="margin:14px 0 0"><button type="button" class="btn btn-primary" data-approve="' + esc(r.request_id) + '">อนุมัติคำขอ</button><button type="button" class="btn btn-ghost" data-cancel="' + esc(r.request_id) + '">ไม่อนุมัติ / ยกเลิก</button></div>'
                        : r.status === 'Approved' ? '<p class="table-note">' + (r.picked ? '✓ จัดเตรียมสินค้าตามแผน FIFO แล้ว' : 'ขั้นตอนต่อไป: <a href="#fifo-procedures">FIFO Procedures</a> เพื่อตัดสต็อกตามล็อต') + '</p>' : '') +
                '</div></article>';
        }

        async function approve(r) {
            var short = r.items.filter(function (i) { return i.current_stock < i.requested_quantity; });
            var ok = await UI.confirm({
                title: 'อนุมัติคำขอ ' + r.request_id,
                message: 'อนุมัติคำขอ <b>' + esc(r.request_id) + '</b> (' + r.items.length + ' รายการ)?' + (short.length ? '<br><span style="color:var(--bad-fg)">มี ' + short.length + ' รายการที่สต็อกปัจจุบันน้อยกว่าจำนวนที่ขอ</span>' : ''),
                confirmLabel: 'อนุมัติคำขอ'
            });
            if (!ok) return;
            try {
                await SA.api('/staff/requests/' + encodeURIComponent(r.request_id) + '/approve', { method: 'POST', body: { branch: state.branch } });
                UI.toast('อนุมัติคำขอเรียบร้อยแล้ว');
                state.open[r.request_id] = true;
                await load();
                if (SA.route() === route) draw();
            } catch (err) { UI.toast(err.message, 'bad'); await load(); if (SA.route() === route) draw(); }
        }

        function cancel(r) {
            UI.modal({
                title: 'ยกเลิกคำขอ ' + r.request_id,
                body: '<p class="cell-muted" style="margin:0 0 12px;font-size:13px">เหตุผลจะแสดงให้ Owner เห็นทันทีในหน้าคำขอ Stock</p>' +
                    '<div class="field" data-field="reason"><label for="cr-reason">Reason / Feedback <span class="req" aria-hidden="true">*</span></label>' +
                    '<textarea class="textarea" id="cr-reason" placeholder="เช่น สินค้าตัวนี้เลิกจำหน่าย / ขอซ้ำกับคำขอก่อนหน้า"></textarea><p class="field-error" hidden></p></div>',
                actions: [{ label: 'กลับ', kind: 'ghost' }, { label: 'ยืนยันการยกเลิก', kind: 'danger', onClick: async function (modal) {
                    var box = modal.el.querySelector('#cr-reason'), err = modal.el.querySelector('.field-error'), reason = box.value.trim();
                    if (!reason) { err.hidden = false; err.textContent = 'โปรดระบุเหตุผลในการยกเลิกคำขอ'; box.setAttribute('aria-invalid', 'true'); box.focus(); return; }
                    modal.setBusy(true);
                    try {
                        await SA.api('/staff/requests/' + encodeURIComponent(r.request_id) + '/cancel', { method: 'POST', body: { branch: state.branch, reason: reason } });
                        modal.close(); UI.toast('ดำเนินการยกเลิกคำขอเรียบร้อยแล้ว');
                        await load(); if (SA.route() === route) draw();
                    } catch (e) { modal.setBusy(false); modal.error(e.message); }
                } }]
            });
        }
    };
})();
