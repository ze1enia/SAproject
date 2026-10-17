/* Supplier / Claim (UC-12 results -> UC-13 Contact Supplier) */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    function qcBadge(result) {
        if (result === 'Pass') return UI.badge('good', 'Pass');
        if (result === 'PassWithRemarks') return UI.badge('warn', 'Pass with remarks');
        if (!result) return UI.badge('muted', 'Not inspected');
        return UI.badge('bad', result);
    }

    SA.pages['supplier-claim'] = async function (title) {
        var main = SA.main();
        var route = SA.route();
        var state = { tab: 'issues', branches: [], branch: '', issues: null, claims: [], suppliers: [] };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        state.branches = await SA.branches();
        await loadAll();
        if (SA.route() !== route) return;
        draw();

        async function loadAll() {
            var q = state.branch ? '?branch=' + encodeURIComponent(state.branch) : '';
            var res = await Promise.all([SA.api('/procurement/claims/issues' + q), SA.api('/procurement/claims' + q), SA.api('/procurement/suppliers')]);
            state.issues = res[0]; state.claims = res[1]; state.suppliers = res[2];
        }

        function draw() {
            var openIssues = state.issues.items.filter(function (i) { return !i.claim_count; }).length;
            var tabs = UI.tabs([
                { id: 'issues', label: 'QC issues', count: openIssues },
                { id: 'claims', label: 'Claims', count: state.claims.length },
                { id: 'suppliers', label: 'Suppliers', count: state.suppliers.length }
            ], state.tab);

            main.innerHTML = SA.pageHeader(title) + tabs.html +
                (state.tab !== 'suppliers'
                    ? '<div class="toolbar"><select id="sc-branch" class="select" aria-label="Branch">' + SA.branchOptions(state.branches, state.branch, 'All branches') + '</select></div>'
                    : '') +
                '<div id="sc-body"></div>';
            tabs.bind(main, function (id) { state.tab = id; draw(); });
            var branchSel = document.getElementById('sc-branch');
            if (branchSel) branchSel.addEventListener('change', async function (e) { state.branch = e.target.value; await loadAll(); if (SA.route() === route) draw(); });

            var body = document.getElementById('sc-body');
            ({ issues: drawIssues, claims: drawClaims, suppliers: drawSuppliers })[state.tab](body);
        }

        /* ---------------------------------------------------------- QC issues */

        function drawIssues(body) {
            var items = state.issues.items;
            if (!items.length) { body.innerHTML = UI.emptyState('ไม่มีสินค้าที่ไม่ผ่านการตรวจสอบคุณภาพ', 'ทุกรอบจัดส่งผ่านการตรวจรับแล้ว'); return; }

            body.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>Arrival</th><th>Supplier</th><th>Quality check</th><th>Problem</th><th>Claims</th><th class="actions">Action</th></tr></thead><tbody>' +
                items.map(function (i) {
                    var rejected = i.rejected_units
                        ? '<b>' + i.rejected_units + '</b> rejected' + (i.rejected_items.length ? '<span class="sub">' + i.rejected_items.map(function (r) { return esc(r.product_name) + ' ×' + r.quantity_rejected; }).join(', ') + '</span>' : '')
                        : '<span class="cell-muted">—</span>';
                    return '<tr>' +
                        '<td><span class="strong">' + esc(i.arrival_id) + '</span><span class="sub">' + esc(i.purchase_order_id) + ' · ' + esc(String(i.arrival_date).split(' ')[0]) + ' · ' + esc(SA.branchName(state.branches, i.branch_id)) + '</span></td>' +
                        '<td>' + esc(i.supplier_name) + '<span class="sub">' + esc(i.contact_person) + ' · ' + esc(i.phone) + '</span></td>' +
                        '<td>' + qcBadge(i.inspection_result) + (i.inspection_remarks ? '<span class="sub">' + esc(i.inspection_remarks) + '</span>' : '') + '</td>' +
                        '<td>' + rejected + '</td>' +
                        '<td>' + (i.claim_count ? UI.badge('info', i.claim_count + (i.claim_count > 1 ? ' claims' : ' claim')) : '<span class="cell-muted">None yet</span>') + '</td>' +
                        '<td class="actions"><button type="button" class="btn btn-primary btn-sm" data-contact="' + esc(i.arrival_id) + '">ติดต่อ Supplier</button></td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="table-note">แสดงรอบจัดส่งที่มีสินค้าถูกปฏิเสธหรือผลตรวจไม่ใช่ "Pass" — กด "ติดต่อ Supplier" เพื่อออก Claim Ticket</p>';

            body.querySelectorAll('[data-contact]').forEach(function (b) {
                b.addEventListener('click', function () {
                    openClaimForm(items.filter(function (i) { return i.arrival_id === b.getAttribute('data-contact'); })[0]);
                });
            });
        }

        function openClaimForm(issue) {
            UI.modal({
                title: 'ติดต่อ Supplier · ' + issue.arrival_id,
                wide: true,
                body:
                    '<div class="panel" style="margin-bottom:16px"><dl class="kv">' +
                        '<dt>Supplier</dt><dd>' + esc(issue.supplier_name) + '</dd>' +
                        '<dt>Contact</dt><dd>' + esc(issue.contact_person) + ' · <a href="tel:' + esc(issue.phone) + '">' + esc(issue.phone) + '</a>' + (issue.email ? ' · <a href="mailto:' + esc(issue.email) + '">' + esc(issue.email) + '</a>' : '') + '</dd>' +
                        '<dt>Order</dt><dd>' + esc(issue.purchase_order_id) + ' · arrived ' + esc(String(issue.arrival_date).split(' ')[0]) + '</dd>' +
                        '<dt>QC result</dt><dd>' + qcBadge(issue.inspection_result) + (issue.rejected_units ? ' · ' + issue.rejected_units + ' units rejected' : '') + '</dd>' +
                    '</dl></div>' +
                    '<form id="cf" novalidate class="form-grid">' +
                        '<div class="field full" data-field="issue_type"><label for="cf-issue">Problem type <span class="req" aria-hidden="true">*</span></label>' +
                            '<select class="select input" id="cf-issue" name="issue_type"><option value="">— Select problem —</option>' +
                                state.issues.issueTypes.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select>' +
                            '<p class="field-error" hidden></p></div>' +
                        '<div class="field full" data-field="details"><label for="cf-details">Details <span class="req" aria-hidden="true">*</span></label>' +
                            '<textarea class="textarea" id="cf-details" name="details" placeholder="อธิบายปัญหาที่พบ เช่น กล่องบุบ 2 ลัง สินค้าขาด 3 ชิ้น"></textarea>' +
                            '<p class="field-error" hidden></p></div>' +
                    '</form>',
                actions: [
                    { label: 'ยกเลิก', kind: 'ghost' },
                    { label: 'ยืนยัน', kind: 'primary', onClick: function (modal) { submitClaim(modal, issue); } }
                ]
            });
        }

        async function submitClaim(modal, issue) {
            var form = modal.el.querySelector('#cf');
            var issueType = form.elements.issue_type.value;
            var details = form.elements.details.value.trim();
            var errors = {};
            if (!issueType) errors.issue_type = 'กรุณาเลือกหัวข้อปัญหา';
            if (!details) errors.details = 'กรุณาระบุรายละเอียดปัญหาที่พบ';
            form.querySelectorAll('[data-field]').forEach(function (f) {
                var name = f.getAttribute('data-field'), err = f.querySelector('.field-error');
                err.hidden = !errors[name]; err.textContent = errors[name] || '';
                form.elements[name].setAttribute('aria-invalid', errors[name] ? 'true' : 'false');
            });
            if (Object.keys(errors).length) { form.elements[Object.keys(errors)[0]].focus(); return; }

            modal.setBusy(true);
            try {
                var claim = await SA.api('/procurement/claims', { method: 'POST', body: { arrival_id: issue.arrival_id, issue_type: issueType, details: details } });
                // success view: show the reference number (UC-13 step 5)
                modal.body.innerHTML =
                    '<div style="text-align:center;padding:10px 0 4px">' +
                        '<p class="confirm-text" style="margin:0 0 6px">ส่งคำร้องติดต่อ Supplier เรียบร้อยแล้ว</p>' +
                        '<p class="cell-muted" style="margin:0 0 4px;font-size:12px">รหัสอ้างอิงคำร้อง</p>' +
                        '<strong style="font-size:34px;letter-spacing:1px">' + esc(claim.claim_id) + '</strong>' +
                    '</div>';
                var foot = modal.el.querySelector('.modal-foot');
                foot.innerHTML = '<button type="button" class="btn btn-primary" id="cf-done">ปิด</button>';
                foot.querySelector('#cf-done').addEventListener('click', modal.close);
                state.tab = 'claims';
                await loadAll();
                if (SA.route() === route) draw();
            } catch (err) {
                modal.setBusy(false);
                modal.error(err.message);
            }
        }

        /* --------------------------------------------------------------- claims */

        function drawClaims(body) {
            if (!state.claims.length) { body.innerHTML = UI.emptyState('ยังไม่มีคำร้องที่ส่งถึง Supplier'); return; }
            body.innerHTML = '<div class="table-scroll"><table class="data-table">' +
                '<thead><tr><th>Ticket</th><th>Supplier</th><th>Order</th><th>Problem</th><th>Status</th></tr></thead><tbody>' +
                state.claims.map(function (c) {
                    return '<tr>' +
                        '<td><span class="strong">' + esc(c.claim_id) + '</span><span class="sub">' + esc(c.created_at) + ' · ' + esc(c.created_by || '—') + '</span></td>' +
                        '<td>' + esc(c.supplier_name) + '</td>' +
                        '<td class="cell-muted">' + esc(c.purchase_order_id) + '<span class="sub">' + esc(c.arrival_id) + '</span></td>' +
                        '<td><span class="strong">' + esc(c.issue_type) + '</span><span class="sub">' + esc(c.details) + '</span></td>' +
                        '<td>' + (c.claim_status === 'Open' ? UI.badge('warn', 'Open') : UI.badge('good', c.claim_status)) + '</td></tr>';
                }).join('') + '</tbody></table></div>';
        }

        /* ------------------------------------------------------------ suppliers */

        function drawSuppliers(body) {
            body.innerHTML = '<div class="card-grid">' + state.suppliers.map(function (s) {
                return '<article class="info-card">' +
                    '<h4>' + esc(s.supplier_name) + '</h4>' +
                    '<dl class="kv" style="font-size:13px">' +
                        '<dt>Contact</dt><dd>' + esc(s.contact_person) + '</dd>' +
                        '<dt>Phone</dt><dd><a href="tel:' + esc(s.phone) + '">' + esc(s.phone) + '</a></dd>' +
                        '<dt>Email</dt><dd><a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></dd>' +
                        '<dt>Address</dt><dd>' + esc(s.address) + '</dd>' +
                    '</dl>' +
                    '<div class="card-foot"><span class="cell-muted">' + esc(s.supplier_id) + '</span><span>' + s.order_count + ' purchase orders</span></div>' +
                '</article>';
            }).join('') + '</div>';
        }
    };
})();
