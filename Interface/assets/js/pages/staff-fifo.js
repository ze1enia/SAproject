/* FIFO Procedures (Staff, UC-08) - approved requests -> pick plan (oldest batch first) -> confirm -> pick sheet */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;

    SA.pages['fifo-procedures'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', requests: [], selected: null, plan: null, sheet: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() {
            var all = await SA.api('/staff/requests?branch=' + encodeURIComponent(state.branch) + '&status=Approved');
            state.requests = all;
            if (state.selected && !all.some(function (r) { return r.request_id === state.selected && !r.picked; })) { state.selected = null; state.plan = null; }
        }

        function draw() {
            var ready = state.requests.filter(function (r) { return !r.picked; });
            var done = state.requests.filter(function (r) { return r.picked; });
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar">' + S.branchBar(state.list, state.branch) + '<span class="cell-muted">FIFO: take from the batch that expires first, then the one received first</span></div>' +
                (state.requests.length ? '<div class="split"><section>' +
                    '<div class="panel"><h3>Ready to prepare <span class="tab-count" style="background:var(--caramel-soft);color:var(--brown)">' + ready.length + '</span></h3>' +
                    (ready.length ? '<div class="picker-list" style="max-height:none">' + ready.map(function (r) {
                        var units = r.items.reduce(function (s, i) { return s + i.requested_quantity; }, 0);
                        return '<button type="button" class="picker-item' + (r.request_id === state.selected ? ' is-selected' : '') + '" data-req="' + esc(r.request_id) + '">' +
                            '<span class="name">' + esc(r.request_id) + '</span><span class="meta">' + esc(r.request_date) + ' · ' + r.items.length + ' items · ' + UI.int(units) + ' units</span>' +
                            '<span class="price">' + UI.badge('good', 'Approved') + '</span></button>';
                    }).join('') + '</div>' : '<p class="cell-muted" style="margin:0;font-size:13px">ไม่มีคำขอที่รอจัดเตรียม — อนุมัติคำขอได้ที่ Stock Request Review</p>') + '</div>' +
                    (done.length ? '<div class="panel"><h3>Prepared</h3><ul class="history-list">' + done.map(function (r) { return '<li><span>' + esc(r.request_id) + ' <span class="cell-muted">· ' + esc(r.request_date) + '</span></span>' + UI.badge('muted', 'Picked') + '</li>'; }).join('') + '</ul></div>' : '') +
                    '</section><aside class="sticky-panel" id="ff-panel"></aside></div>'
                    : S.noData(state.list, state.branch));

            S.onBranch(async function (b) { state.branch = b; state.selected = null; state.plan = null; state.sheet = null; await load(); if (SA.route() === route) draw(); });
            main.querySelectorAll('[data-req]').forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-req')); }); });
            drawPanel();
        }

        async function select(id) {
            state.selected = id; state.sheet = null; state.plan = null;
            main.querySelectorAll('[data-req]').forEach(function (b) { b.classList.toggle('is-selected', b.getAttribute('data-req') === id); });
            drawPanel(true);
            try {
                var plan = await SA.api('/staff/requests/' + encodeURIComponent(id) + '/fifo-plan?branch=' + encodeURIComponent(state.branch));
                if (SA.route() !== route || state.selected !== id) return;
                state.plan = plan; drawPanel();
            } catch (err) { document.getElementById('ff-panel').innerHTML = '<div class="panel"><p class="error-message">' + esc(err.message) + '</p></div>'; }
        }

        function allocChips(allocs) {
            return '<div class="alloc-list">' + allocs.map(function (a) {
                return '<span class="alloc-chip" data-tip="' + esc('Batch ' + a.batch_id + ' · received ' + String(a.received_at).split(' ')[0] + ' · ' + a.remaining_after + ' left after') + '">' + esc(a.batch_id) + ' ×' + a.take +
                    '<small>' + (a.expiry_date ? 'exp ' + esc(a.expiry_date) : 'no expiry') + '</small></span>';
            }).join('') + '</div>';
        }

        function drawPanel(loading) {
            var panel = document.getElementById('ff-panel');
            if (!panel) return;
            if (state.sheet) { panel.innerHTML = sheetHTML(state.sheet); bindSheet(); return; }
            if (!state.selected) { panel.innerHTML = '<div class="panel"><h3>FIFO plan</h3>' + UI.emptyState('เลือกคำขอที่อนุมัติแล้วเพื่อดูแผนตัดสต็อก') + '</div>'; return; }
            if (loading || !state.plan) { panel.innerHTML = '<div class="panel"><h3>' + esc(state.selected) + '</h3><p class="loading">กำลังคำนวณแผน FIFO...</p></div>'; return; }

            var p = state.plan, s = p.summary;
            panel.innerHTML = '<div class="panel"><h3>FIFO plan · ' + esc(p.request_id) + '</h3>' +
                '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product · pick from batch</th><th class="num">Requested</th></tr></thead><tbody>' +
                p.items.map(function (i) {
                    // batches go under the product name so the plan fits the narrow side panel
                    return '<tr><td>' + esc(i.product_name) + '<span class="sub">' + esc(i.product_id) + '</span>' +
                        (i.allocations.length ? allocChips(i.allocations) : '') +
                        (i.shortage ? '<div style="margin-top:6px">' + UI.badge(i.picked ? 'warn' : 'bad', (i.picked ? 'Short ' : 'No stock · short ') + i.shortage) + '</div>' : '') + '</td>' +
                        '<td class="num"><b>' + i.requested + '</b> ' + esc(i.unit) + '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="table-note"><b>' + UI.int(s.units) + '</b> units from ' + s.items + ' items' + (s.short_items ? ' · <b style="color:var(--bad-fg)">' + s.short_items + ' item(s) short of stock — only the available quantity will be picked</b>' : '') + '</p>' +
                '<div class="toolbar" style="margin:14px 0 0"><button type="button" class="btn btn-primary" id="ff-confirm"' + (s.units ? '' : ' disabled') + '>ยืนยันการจัดเตรียมสินค้า</button></div></div>';
            document.getElementById('ff-confirm').addEventListener('click', confirmPick);
        }

        async function confirmPick() {
            var p = state.plan;
            var ok = await UI.confirm({ title: 'ยืนยันการจัดเตรียมสินค้า', message: 'ตัดสต็อก <b>' + UI.int(p.summary.units) + '</b> หน่วยตามลำดับ FIFO สำหรับคำขอ <b>' + esc(p.request_id) + '</b> ?<br>การตัดสต็อกไม่สามารถย้อนกลับได้จากหน้านี้', confirmLabel: 'ยืนยันและตัดสต็อก' });
            if (!ok) return;
            var btn = document.getElementById('ff-confirm'); btn.disabled = true;
            try {
                var done = await SA.api('/staff/requests/' + encodeURIComponent(p.request_id) + '/fifo-confirm', { method: 'POST', body: { branch: state.branch } });
                UI.toast('บันทึกการจัดเตรียมสินค้าตามแผน FIFO สำเร็จ');
                state.sheet = done;
                await load();
                if (SA.route() === route) { draw(); }
            } catch (err) { btn.disabled = false; UI.toast(err.message, 'bad'); }
        }

        function sheetHTML(d) {
            return '<div class="pick-sheet"><h3>Pick list · ' + esc(d.request_id) + '</h3>' +
                '<p class="pick-meta">' + esc(SA.branchName(state.list, state.branch)) + ' · prepared ' + esc(d.confirmed_at) + ' · ' + esc(SA.user().username || '') + '</p>' +
                '<table class="data-table"><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th class="num">Qty</th></tr></thead><tbody>' +
                d.items.map(function (i) {
                    return i.allocations.map(function (a, idx) {
                        return '<tr><td>' + (idx === 0 ? '<span class="strong">' + esc(i.product_name) + '</span><span class="sub">' + esc(i.product_id) + '</span>' : '') + '</td><td>' + esc(a.batch_id) + '</td><td>' + esc(a.expiry_date || '—') + '</td><td class="num"><b>' + a.take + '</b> ' + esc(i.unit) + '</td></tr>';
                    }).join('') + (i.shortage ? '<tr><td colspan="4" class="cell-muted">' + esc(i.product_name) + ': short ' + i.shortage + ' (not available)</td></tr>' : '');
                }).join('') + '</tbody></table>' +
                '<div class="toolbar" style="margin:14px 0 0"><button type="button" class="btn btn-primary" id="ff-print">Print pick list</button><button type="button" class="btn btn-ghost" id="ff-done">Done</button></div></div>';
        }

        function bindSheet() {
            document.getElementById('ff-print').addEventListener('click', function () { window.print(); });
            document.getElementById('ff-done').addEventListener('click', function () { state.sheet = null; state.selected = null; state.plan = null; draw(); });
        }
    };
})();
