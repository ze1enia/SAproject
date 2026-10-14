/* Quality Check (Staff, UC-12) - record Good / No Good for goods that just arrived */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, S = window.SAStaff, esc = SA.escapeHTML;
    var RESULT = {
        Pass: { badge: 'good', label: 'Good', hint: 'ผ่าน — สินค้าพร้อมจำหน่าย' },
        PassWithRemarks: { badge: 'warn', label: 'Good with remarks', hint: 'ผ่าน แต่มีข้อสังเกต (ต้องใส่หมายเหตุ)' },
        Fail: { badge: 'bad', label: 'No Good', hint: 'ไม่ผ่าน — แจ้ง Owner เพื่อติดต่อ Supplier (ต้องใส่หมายเหตุ)' }
    };
    function resultBadge(r) { return r ? UI.badge(RESULT[r].badge, RESULT[r].label) : UI.badge('muted', 'Not inspected'); }

    SA.pages['quality-check'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { list: [], branch: '', tab: 'pending', data: null };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.list = await S.branches();
        if (SA.route() !== route) return;
        if (!state.list.length) { main.innerHTML = SA.pageHeader(title) + S.noAccess(); return; }
        state.branch = S.pick(state.list);
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() { state.data = await SA.api('/staff/quality?branch=' + encodeURIComponent(state.branch)); }

        function draw() {
            var pending = state.data.items.filter(function (i) { return !i.result; });
            var done = state.data.items.filter(function (i) { return i.result; });
            var tabs = UI.tabs([{ id: 'pending', label: 'To inspect', count: pending.length }, { id: 'done', label: 'Inspected', count: done.length }], state.tab);
            main.innerHTML = SA.pageHeader(title) + '<div class="toolbar">' + S.branchBar(state.list, state.branch) + '</div>' + tabs.html + '<div id="qc-body"></div>';
            S.onBranch(async function (b) { state.branch = b; await load(); if (SA.route() === route) draw(); });
            tabs.bind(main, function (id) { state.tab = id; draw(); });
            var body = document.getElementById('qc-body');
            if (!state.data.items.length) { body.innerHTML = S.noData(state.list, state.branch); return; }
            if (state.tab === 'pending') drawPending(body, pending); else drawDone(body, done);
        }

        function itemsTable(a) {
            return '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th class="num">Received</th><th class="num">Rejected</th></tr></thead><tbody>' +
                a.items.map(function (i) { return '<tr><td>' + esc(i.product_name) + '</td><td class="num">' + i.received + ' ' + esc(i.unit) + '</td><td class="num">' + (i.rejected ? '<b class="amount-out">' + i.rejected + '</b>' : '0') + '</td></tr>'; }).join('') + '</tbody></table></div>';
        }

        function drawPending(body, rows) {
            if (!rows.length) { body.innerHTML = UI.emptyState('ตรวจคุณภาพครบทุกรอบจัดส่งแล้ว'); return; }
            body.innerHTML = rows.map(function (a) {
                return '<article class="po-card"><div class="po-card-head"><div><h3>' + esc(a.arrival_id) + ' <span class="cell-muted" style="font-size:13px;font-weight:normal">· ' + esc(a.purchase_order_id) + ' · ' + esc(a.supplier_name) + ' · arrived ' + esc(String(a.arrival_date).split(' ')[0]) + '</span></h3></div>' +
                    '<div style="display:flex;gap:10px;align-items:center">' + (a.delivery_status === 'Partial' ? UI.badge('warn', 'Partial delivery') : '') + '<button type="button" class="btn btn-primary btn-sm" data-inspect="' + esc(a.arrival_id) + '">ตรวจรับสินค้า</button></div></div>' + itemsTable(a) + '</article>';
            }).join('');
            body.querySelectorAll('[data-inspect]').forEach(function (b) { b.addEventListener('click', function () { openForm(rows.filter(function (r) { return r.arrival_id === b.getAttribute('data-inspect'); })[0]); }); });
        }

        function drawDone(body, rows) {
            if (!rows.length) { body.innerHTML = UI.emptyState('ยังไม่มีรอบจัดส่งที่ตรวจคุณภาพแล้ว'); return; }
            body.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Arrival</th><th>Supplier</th><th>Result</th><th>Remarks</th><th>Inspected by</th></tr></thead><tbody>' +
                rows.map(function (a) {
                    return '<tr><td><span class="strong">' + esc(a.arrival_id) + '</span><span class="sub">' + esc(a.purchase_order_id) + ' · ' + UI.int(a.units) + ' units' + (a.rejected ? ' · ' + a.rejected + ' rejected' : '') + '</span></td><td>' + esc(a.supplier_name) + '</td><td>' + resultBadge(a.result) + '</td>' +
                        '<td class="cell-muted">' + esc(a.remarks || '—') + '</td><td class="cell-muted">' + esc(a.inspected_by || '—') + '<span class="sub">' + esc(a.inspection_date) + '</span></td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        function openForm(a) {
            var m = UI.modal({
                title: 'ตรวจรับสินค้า · ' + a.arrival_id, wide: true,
                body: itemsTable(a) +
                    '<form id="qf" novalidate style="margin-top:14px">' +
                        '<fieldset style="border:0;padding:0;margin:0 0 12px" data-field="result"><legend class="label" style="font-size:13px;font-weight:700;color:var(--coffee);margin-bottom:6px">Quality result <span class="req" aria-hidden="true">*</span></legend>' +
                        '<div class="mode-grid" style="grid-template-columns:1fr">' + Object.keys(RESULT).map(function (k) {
                            return '<label class="mode-card"><input type="radio" name="result" value="' + k + '"><span>' + esc(RESULT[k].label) + '<small>' + esc(RESULT[k].hint) + '</small></span></label>';
                        }).join('') + '</div><p class="field-error" hidden></p></fieldset>' +
                        '<div class="field" data-field="remarks"><label for="qf-remarks">Remarks</label><textarea class="textarea" id="qf-remarks" name="remarks" placeholder="เช่น บรรจุภัณฑ์เปียก 2 ลัง / จำนวนตรงตามใบส่งของ"></textarea><p class="field-error" hidden></p></div></form>',
                actions: [{ label: 'ยกเลิก', kind: 'ghost' }, { label: 'บันทึก', kind: 'primary', onClick: function (modal) { submit(modal, a); } }]
            });
            m.el.querySelector('#qf').addEventListener('submit', function (e) { e.preventDefault(); });
        }

        async function submit(modal, a) {
            var form = modal.el.querySelector('#qf'), result = (form.querySelector('input[name=result]:checked') || {}).value || '', remarks = form.elements.remarks.value.trim();
            var errors = {};
            if (!result) errors.result = 'โปรดเลือกผลการประเมินคุณภาพสินค้า';
            else if (result !== 'Pass' && !remarks) errors.remarks = 'กรุณาระบุหมายเหตุประกอบผลการตรวจ';
            form.querySelectorAll('[data-field]').forEach(function (f) { var e = f.querySelector('.field-error'), msg = errors[f.getAttribute('data-field')]; e.hidden = !msg; e.textContent = msg || ''; });
            if (Object.keys(errors).length) return;

            modal.setBusy(true);
            try {
                var res = await SA.api('/staff/quality', { method: 'POST', body: { arrival_id: a.arrival_id, result: result, remarks: remarks } });
                modal.close();
                UI.toast(res.owner_notified ? 'บันทึกผลการตรวจสอบคุณภาพเรียบร้อยแล้ว · แจ้ง Owner แล้ว' : 'บันทึกผลการตรวจสอบคุณภาพสินค้าเรียบร้อยแล้ว');
                await load();
                if (SA.route() === route) draw();
            } catch (err) { modal.setBusy(false); modal.error(err.message); }
        }
    };
})();
