/* Shared by the Staff pages: only the branches in the user's access list can be picked. */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;
    var cache = null;

    window.SAStaff = {
        // [{ branch_id, branch_name }] the signed-in Staff member may work in
        branches: function () {
            if (!cache) {
                cache = Promise.all([SA.api('/staff/branches'), SA.branches()]).then(function (res) {
                    return res[1].filter(function (b) { return res[0].indexOf(b.branch_id) !== -1; });
                }).catch(function (err) { cache = null; throw err; });
            }
            return cache;
        },

        // remembered branch if it is still allowed, otherwise the first allowed one
        pick: function (list) {
            var pref = UI.branchPref();
            return list.some(function (b) { return b.branch_id === pref; }) ? pref : (list[0] ? list[0].branch_id : '');
        },

        // dropdown when there is a choice, a fixed chip when there is only one branch
        branchBar: function (list, current) {
            if (list.length > 1) {
                return '<select id="st-branch" class="select" aria-label="Branch">' + SA.branchOptions(list, current) + '</select>';
            }
            var b = list[0];
            return '<span class="branch-chip" title="Your branch">' + esc(b.branch_id + ' · ' + b.branch_name) + '</span>';
        },

        // call after the toolbar is in the DOM; fn(branchId) runs when the Staff member switches branch
        onBranch: function (fn) {
            var el = document.getElementById('st-branch');
            if (el) el.addEventListener('change', function () { UI.branchPref(el.value); fn(el.value); });
        },

        noAccess: function () {
            return UI.emptyState('บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าถึงสาขาใด', 'ติดต่อ Owner เพื่อกำหนดสาขาในตาราง user_branch_access');
        },

        noData: function (list, branchId) {
            return UI.emptyState('ยังไม่มีข้อมูลของสาขานี้', 'สาขา ' + SA.branchName(list, branchId) + ' ยังไม่มีรายการในระบบ');
        },

        // plain-text label for a row's branch
        name: function (list, id) { return SA.branchName(list, id); }
    };
})();
