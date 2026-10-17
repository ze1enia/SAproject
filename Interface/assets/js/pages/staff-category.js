/* Category (Staff) - add, rename and remove product categories */
(function () {
    'use strict';

    var SA = window.SA, UI = window.SAUI, esc = SA.escapeHTML;

    SA.pages['category'] = async function (title) {
        var main = SA.main(), route = SA.route();
        var state = { rows: [], search: '' };

        main.innerHTML = SA.pageHeader(title) + '<p class="loading">กำลังโหลดข้อมูล...</p>';
        await load();
        if (SA.route() !== route) return;
        draw();

        async function load() { state.rows = await SA.api('/staff/categories'); }

        function draw() {
            main.innerHTML = SA.pageHeader(title) +
                '<div class="toolbar"><div class="grow"><input type="search" id="ct-search" class="search-input" placeholder="Search category..." aria-label="Search categories" value="' + esc(state.search) + '"></div>' +
                    '<button type="button" class="btn btn-primary" id="ct-new">+ New category</button></div><div id="ct-table"></div>';
            var input = document.getElementById('ct-search');
            input.addEventListener('input', UI.debounce(function () { state.search = input.value.trim().toLowerCase(); drawTable(); }, 120));
            document.getElementById('ct-new').addEventListener('click', function () { openForm(null); });
            drawTable();
        }

        function drawTable() {
            var rows = state.rows.filter(function (c) { return !state.search || c.category_name.toLowerCase().indexOf(state.search) !== -1 || String(c.description || '').toLowerCase().indexOf(state.search) !== -1; });
            var target = document.getElementById('ct-table');
            if (!rows.length) { target.innerHTML = UI.emptyState('ไม่พบหมวดหมู่ที่ค้นหา'); return; }
            var max = Math.max.apply(null, state.rows.map(function (c) { return c.product_count; }).concat(1));
            target.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>ID</th><th>Category</th><th>Description</th><th>Products</th><th class="actions">Actions</th></tr></thead><tbody>' +
                rows.map(function (c) {
                    return '<tr><td>' + esc(c.category_id) + '</td><td class="strong">' + esc(c.category_name) + '</td><td class="cell-muted">' + esc(c.description) + '</td>' +
                        '<td data-tip="' + esc(c.product_count + ' products') + '"><span class="cell-bar"><span class="bar-track"><span class="bar" style="width:' + (c.product_count ? Math.max(6, (c.product_count / max) * 100) : 0) + '%"></span></span><b>' + c.product_count + '</b></span></td>' +
                        '<td class="actions"><span class="row-actions"><button type="button" class="link-button" data-edit="' + esc(c.category_id) + '">Edit</button>' +
                        '<button type="button" class="link-button is-danger" data-del="' + esc(c.category_id) + '">Delete</button></span></td></tr>';
                }).join('') + '</tbody></table></div><p class="table-note">ลบได้เฉพาะหมวดหมู่ที่ยังไม่มีสินค้า</p>';
            target.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openForm(find(b.getAttribute('data-edit'))); }); });
            target.querySelectorAll('[data-del]').forEach(function (b) { b.addEventListener('click', function () { remove(find(b.getAttribute('data-del'))); }); });
        }

        function find(id) { return state.rows.filter(function (c) { return c.category_id === id; })[0]; }

        function openForm(cat) {
            var c = cat || { category_name: '', description: '' };
            var m = UI.modal({
                title: cat ? 'Edit category · ' + cat.category_id : 'New category',
                body: '<form id="cf" novalidate>' +
                    '<div class="field" data-field="category_name" style="margin-bottom:12px"><label for="cf-name">Category name <span class="req" aria-hidden="true">*</span></label><input class="input" id="cf-name" name="category_name" value="' + esc(c.category_name) + '" autocomplete="off"><p class="field-error" hidden></p></div>' +
                    '<div class="field"><label for="cf-desc">Description</label><textarea class="textarea" id="cf-desc" name="description">' + esc(c.description) + '</textarea></div></form>',
                actions: [{ label: 'ยกเลิก', kind: 'ghost' }, { label: cat ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดหมู่', kind: 'primary', onClick: function (modal) { save(modal, cat); } }]
            });
            m.el.querySelector('#cf').addEventListener('submit', function (e) { e.preventDefault(); save(m, cat); });
        }

        async function save(modal, cat) {
            var form = modal.el.querySelector('#cf'), name = form.elements.category_name.value.trim();
            var err = form.querySelector('.field-error');
            if (!name) { err.hidden = false; err.textContent = 'กรุณาระบุชื่อหมวดหมู่'; form.elements.category_name.setAttribute('aria-invalid', 'true'); form.elements.category_name.focus(); return; }
            err.hidden = true;
            modal.setBusy(true);
            try {
                var body = { category_name: name, description: form.elements.description.value.trim() };
                if (cat) await SA.api('/staff/categories/' + encodeURIComponent(cat.category_id), { method: 'PUT', body: body });
                else await SA.api('/staff/categories', { method: 'POST', body: body });
                modal.close();
                UI.toast(cat ? 'บันทึกการแก้ไขเรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่เรียบร้อยแล้ว');
                await load();
                if (SA.route() === route) draw();
            } catch (e) { modal.setBusy(false); modal.error(e.message); }
        }

        async function remove(cat) {
            if (cat.product_count > 0) { UI.toast('ลบไม่ได้ เพราะยังมีสินค้า ' + cat.product_count + ' รายการในหมวดหมู่นี้', 'bad'); return; }
            var ok = await UI.confirm({ title: 'ลบหมวดหมู่', message: 'ลบหมวดหมู่ <b>' + esc(cat.category_name) + '</b> (' + esc(cat.category_id) + ') ?', confirmLabel: 'ลบหมวดหมู่', danger: true });
            if (!ok) return;
            try {
                await SA.api('/staff/categories/' + encodeURIComponent(cat.category_id), { method: 'DELETE' });
                UI.toast('ลบหมวดหมู่เรียบร้อยแล้ว');
                await load();
                if (SA.route() === route) draw();
            } catch (e) { UI.toast(e.message, 'bad'); }
        }
    };
})();
