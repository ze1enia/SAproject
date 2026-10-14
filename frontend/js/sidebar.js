(function () {
    'use strict';
 
    var API_ROOT = window.SA_API_ROOT; // set by js/config.js
    var SESSION_KEY = 'sa_session';
 
    var state = { session: null, menu: null, current: null };
    var sidebarEl, mainEl;
 
    /* -------------------------------------------------------------- helpers */
 
    function loadSession() {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; }
        catch (err) { return null; }
    }
 
    function logout() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = 'login.html';
    }
 
    function escapeHTML(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
 
    // fetch with the login token; logs out automatically if the token is rejected
    async function api(path) {
        var res = await fetch(API_ROOT + path, {
            headers: { Authorization: 'Bearer ' + state.session.token }
        });
        if (res.status === 401 || res.status === 403) {
            var body401 = await res.json().catch(function () { return {}; });
            // 403 from authorize() = wrong role, not an expired token
            if (res.status === 401 || /token/i.test(body401.message || '')) {
                logout();
            }
            throw new Error(body401.message || 'Access denied');
        }
        var body = await res.json();
        if (!res.ok || !body.success) {
            throw new Error(body.message || 'Request failed');
        }
        return body.data;
    }
 
    function pageHeader(title, extraHTML) {
        return '<div class="content-header"><h2>' + escapeHTML(title) + '</h2>' + (extraHTML || '') + '</div>';
    }
 
    /* -------------------------------------------------------------- sidebar */
 
    function renderSidebar() {
        var user = state.session.user || {};
        var name = user.username || 'User';
        var branch = user.branch && !/^ALL(-ACCESS)?$/i.test(user.branch) ? user.branch : 'All branches';
 
        var items = state.menu.items.map(function (item) {
            return (
                '<a href="#' + escapeHTML(item.id) + '" class="menu-item" data-menu="' + escapeHTML(item.id) + '" title="' + escapeHTML(item.label) + '">' +
                    '<span class="menu-icon" aria-hidden="true">' + escapeHTML(item.icon || '•') + '</span>' +
                    '<span class="menu-label">' + escapeHTML(item.label) + '</span>' +
                '</a>'
            );
        }).join('');
 
        sidebarEl.innerHTML =
            '<div class="profile">' +
                '<div class="avatar" aria-hidden="true">' + escapeHTML(name.charAt(0).toUpperCase()) + '</div>' +
                '<div class="profile-text">' +
                    '<h2>' + escapeHTML(name) + '</h2>' +
                    '<p>' + escapeHTML(state.menu.roleLabel) + ' · ' + escapeHTML(branch) + '</p>' +
                '</div>' +
            '</div>' +
            '<nav class="sidebar-menu">' + items + '</nav>' +
            '<div class="sidebar-footer">' +
                '<button type="button" class="logout-button" id="logout-button">' +
                    '<span class="menu-icon" aria-hidden="true">↪</span><span class="menu-label">Log out</span>' +
                '</button>' +
            '</div>';
 
        document.getElementById('logout-button').addEventListener('click', logout);
    }
 
    function setActive(menuId) {
        var links = sidebarEl.querySelectorAll('.menu-item');
        links.forEach(function (link) {
            var on = link.getAttribute('data-menu') === menuId;
            link.classList.toggle('active', on);
            if (on) {
                link.setAttribute('aria-current', 'page');
                // keep the active pill visible in the horizontal mobile menu
                // (scroll only the menu strip, never the page)
                var nav = link.parentNode;
                if (nav.scrollWidth > nav.clientWidth) {
                    nav.scrollLeft = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
                }
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }
 
    /* -------------------------------------------------------------- routing */
 
    // "#branch/B001" -> { id: 'branch', param: 'B001' }
    function routeFromHash() {
        var parts = window.location.hash.replace(/^#/, '').split('/');
        var id = decodeURIComponent(parts[0] || '');
        var known = state.menu.items.some(function (item) { return item.id === id; });
        if (!known) return { id: state.menu.items[0].id, param: null };
        return { id: id, param: parts[1] ? decodeURIComponent(parts[1]) : null };
    }

    async function loadPage(route) {
        var menuId = route.id;
        state.current = menuId;
        state.route = window.location.hash;
        setActive(menuId);
 
        var item = state.menu.items.find(function (i) { return i.id === menuId; });
        var title = item ? item.label : menuId;
        document.title = title + ' — JAEWAEW SHOP';
 
        mainEl.innerHTML = '<p class="loading">กำลังโหลดข้อมูล...</p>';
 
        var render = PAGES[menuId] || renderComingSoon;
        try {
            await render(title, route.param);
        } catch (err) {
            // ignore results of a page the user has already left
            if (state.current !== menuId) return;
            mainEl.innerHTML = pageHeader(title) +
                '<p class="error-message">ไม่สามารถโหลดข้อมูลได้: ' + escapeHTML(err.message) + '</p>';
        }
        mainEl.focus({ preventScroll: true });
    }
 
    /* ---------------------------------------------------------------- pages */
 
    function renderComingSoon(title) {
        mainEl.innerHTML = pageHeader(title) +
            '<div class="empty-state"><p>หน้านี้กำลังอยู่ระหว่างการพัฒนา</p></div>';
    }
 
    async function renderBranchPage(title, branchId) {
        if (branchId) return renderBranchDashboard(branchId);

        mainEl.innerHTML = pageHeader(title,
            '<input type="search" id="branch-search" class="search-input" placeholder="Search for branches..." aria-label="Search branches">') +
            '<div class="table-scroll">' +
                '<table class="data-table">' +
                    '<thead><tr><th>ID</th><th>Branch name</th><th>Address</th><th>Action</th></tr></thead>' +
                    '<tbody id="branch-table-body"><tr><td colspan="4" class="loading">กำลังโหลดข้อมูล...</td></tr></tbody>' +
                '</table>' +
            '</div>';
 
        var tbody = document.getElementById('branch-table-body');
        var search = document.getElementById('branch-search');
        var heading = mainEl.querySelector('.content-header h2');
        var timer = null;

        function setCount(n) {
            var chip = heading.querySelector('.count-chip') || heading.appendChild(document.createElement('span'));
            chip.className = 'count-chip';
            chip.textContent = n + (n === 1 ? ' branch' : ' branches');
        }

 
        async function load(keyword) {
            var query = keyword ? '?search=' + encodeURIComponent(keyword) : '';
            var branches = await api('/branches' + query);
            if (state.current !== 'branch') return;
            setCount(branches.length);
 
            if (!branches.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-row">ไม่พบสาขาที่ค้นหา</td></tr>';
                return;
            }
            tbody.innerHTML = branches.map(function (b) {
                return '<tr>' +
                    '<td>' + escapeHTML(b.branch_id) + '</td>' +
                    '<td>' + escapeHTML(b.branch_name) + '</td>' +
                    '<td class="cell-muted">' + escapeHTML(b.address) + '</td>' +
                    '<td><button type="button" class="table-button" data-view="' + escapeHTML(b.branch_id) + '">VIEW</button></td>' +
                '</tr>';
            }).join('');
        }
 
        search.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                load(search.value.trim()).catch(function (err) {
                    tbody.innerHTML = '<tr><td colspan="4" class="error-message">' + escapeHTML(err.message) + '</td></tr>';
                });
            }, 250);
        });
 
        tbody.addEventListener('click', function (e) {
            var button = e.target.closest('[data-view]');
            if (!button) return;
            window.location.hash = 'branch/' + encodeURIComponent(button.getAttribute('data-view'));
        });
 
        await load('');
    }
 
    // Branch dashboard shown after pressing VIEW: photo + address card, then panels
    async function renderBranchDashboard(branchId) {
        var route = state.route;
        var b = await api('/branches/' + encodeURIComponent(branchId));
        if (state.route !== route) return;

        document.title = 'Branch - ' + b.branch_name + ' — JAEWAEW SHOP';
        mainEl.innerHTML =
            '<div class="content-header branch-header">' +
                '<h2>Branch -&nbsp; ' + escapeHTML(b.branch_name) + '</h2>' +
                '<a href="#branch" class="close-button" aria-label="Back to branch list">×</a>' +
            '</div>' +
            '<div class="branch-grid">' +
                '<article class="branch-card branch-hero">' +
                    '<img src="elements/branches/' + encodeURIComponent(b.branch_id) + '.jpg" alt="">' +
                    '<div class="branch-hero-info">' +
                        '<span class="branch-code">' + escapeHTML(b.branch_id) + '</span>' +
                        '<p>' + escapeHTML(b.address || '-') + '</p>' +
                    '</div>' +
                '</article>' +
                metricCard('low-stock', 'Low stock', 'สินค้าใกล้หมด') +
                metricCard('fifo', 'FIFO batches', 'ล็อตที่ต้องใช้ก่อน') +
                metricCard('requests', 'Pending requests', 'คำขอเบิกรออนุมัติ') +
                metricCard('arrivals', 'Pending arrivals', 'สินค้ารอรับเข้า') +
                metricCard('inspections', 'Pending inspections', 'รอตรวจรับคุณภาพ') +
            '</div>';

        // no photo for this branch yet -> fall back to the textured background
        var img = mainEl.querySelector('.branch-hero img');
        img.addEventListener('error', function () {
            img.closest('.branch-hero').classList.add('no-photo');
            img.remove();
        });

        try {
            var summary = await api('/branches/' + encodeURIComponent(branchId) + '/summary');
            if (state.route !== route) return;
            renderSummary(summary);
        } catch (err) {
            if (state.route !== route) return;
            mainEl.querySelectorAll('.metric-body').forEach(function (body) {
                body.innerHTML = '<p class="error-message">' + escapeHTML(err.message) + '</p>';
            });
        }
    }

    /* ------------------------------------------------------- summary cards */

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var REQUEST_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

    function metricCard(key, title, subtitle) {
        return '<article class="branch-card metric-card" data-metric="' + key + '">' +
            '<header class="metric-head">' +
                '<div><h3>' + escapeHTML(title) + '</h3><p>' + escapeHTML(subtitle) + '</p></div>' +
                '<strong class="metric-value">–</strong>' +
            '</header>' +
            '<div class="metric-body"><p class="loading">กำลังโหลด...</p></div>' +
        '</article>';
    }

    function fillCard(key, value, bodyHTML) {
        var card = mainEl.querySelector('[data-metric="' + key + '"]');
        if (!card) return;
        card.querySelector('.metric-value').textContent = value;
        card.querySelector('.metric-body').innerHTML = bodyHTML;
        card.classList.toggle('is-clear', value === 0);
    }

    function emptyNote(text) {
        return '<p class="metric-empty"><span aria-hidden="true">✓</span> ' + escapeHTML(text) + '</p>';
    }

    // horizontal bars: rows of { label, value, tip, accent }
    function barList(rows, max) {
        return '<ul class="bar-list">' + rows.map(function (r) {
            var pct = max > 0 && r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0;
            return '<li data-tip="' + escapeHTML(r.tip) + '">' +
                '<span class="bar-label">' + escapeHTML(r.label) + '</span>' +
                '<span class="bar-track"><span class="bar' + (r.accent ? ' accent' : '') + '" style="width:' + pct + '%"></span></span>' +
                '<span class="bar-value">' + r.value + '</span>' +
            '</li>';
        }).join('') + '</ul>';
    }

    // vertical columns: { label, value, tip, accent }
    function columnChart(cols) {
        var max = Math.max.apply(null, cols.map(function (c) { return c.value; }).concat(1));
        return '<div class="column-chart" role="img" aria-label="' +
                escapeHTML(cols.map(function (c) { return c.label + ': ' + c.value; }).join(', ')) + '">' +
            cols.map(function (c) {
                return '<div class="column" data-tip="' + escapeHTML(c.tip) + '">' +
                    '<span class="column-value">' + c.value + '</span>' +
                    '<span class="column-bar' + (c.accent ? ' accent' : '') + '" style="height:' + Math.max(3, (c.value / max) * 100) + '%"></span>' +
                    '<span class="column-label">' + escapeHTML(c.label) + '</span>' +
                '</div>';
            }).join('') +
        '</div>';
    }

    function arrivalList(items) {
        return '<ul class="metric-list">' + items.map(function (a) {
            return '<li><strong>' + escapeHTML(a.arrival_id) + '</strong>' +
                '<span>' + escapeHTML(a.purchase_order_id) + ' · ' + escapeHTML(String(a.arrival_date || '').split(' ')[0]) + '</span></li>';
        }).join('') + '</ul>';
    }

    function renderSummary(s) {
        // 1. low stock: lowest items first, scale = threshold
        var low = s.lowStock;
        var shown = low.items.slice(0, 5);
        fillCard('low-stock', low.count, low.count
            ? barList(shown.map(function (i) {
                return { label: i.product_name, value: i.quantity, accent: true,
                         tip: i.product_name + ' (' + i.product_id + '): ' + i.quantity + ' left' };
              }), low.threshold) +
              (low.count > shown.length ? '<p class="metric-more">+' + (low.count - shown.length) + ' more</p>' : '')
            : emptyNote('ทุกสินค้ามีมากกว่า ' + low.threshold + ' ชิ้น'));

        // 2. FIFO: batches per expiry month; this & next month are highlighted
        var now = new Date();
        var soon = now.getFullYear() * 12 + now.getMonth() + 1;
        var fifo = s.fifoBatches;
        fillCard('fifo', fifo.count, fifo.count
            ? columnChart(fifo.byExpiryMonth.map(function (m) {
                if (m.month === 'none') {
                    return { label: 'None', value: m.count, tip: m.count + ' batches with no expiry date' };
                }
                var y = Number(m.month.slice(0, 4)), mo = Number(m.month.slice(5)) - 1;
                var name = MONTHS[mo] + ' ' + String(y).slice(2);
                return { label: name, value: m.count, accent: y * 12 + mo <= soon,
                         tip: m.count + ' batches expire in ' + MONTHS[mo] + ' ' + y };
              })) + (fifo.nextExpiry ? '<p class="metric-more">Next expiry ' + escapeHTML(fifo.nextExpiry) + '</p>' : '')
            : emptyNote('ไม่มีล็อตคงเหลือ'));

        // 3. requests: every status as context, Pending highlighted
        var req = s.pendingRequests;
        var statuses = REQUEST_STATUSES.concat(Object.keys(req.byStatus).filter(function (k) {
            return REQUEST_STATUSES.indexOf(k) === -1;
        }));
        fillCard('requests', req.count, req.total
            ? barList(statuses.map(function (st) {
                var n = req.byStatus[st] || 0;
                return { label: st, value: n, accent: st === 'Pending', tip: n + ' ' + st.toLowerCase() + ' of ' + req.total + ' requests' };
              }), Math.max.apply(null, statuses.map(function (st) { return req.byStatus[st] || 0; })))
            : emptyNote('ยังไม่มีคำขอเบิก'));

        // 4-5. tiny counts -> number + list
        fillCard('arrivals', s.pendingArrivals.count, s.pendingArrivals.count
            ? arrivalList(s.pendingArrivals.items) : emptyNote('ไม่มีรอบที่ส่งไม่ครบ'));
        fillCard('inspections', s.pendingInspections.count, s.pendingInspections.count
            ? arrivalList(s.pendingInspections.items) : emptyNote('ตรวจรับครบทุกรอบแล้ว'));
    }

    // one shared tooltip for every [data-tip] mark
    function initTooltip() {
        var tip = document.createElement('div');
        tip.className = 'chart-tip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);

        mainEl.addEventListener('mousemove', function (e) {
            var mark = e.target.closest('[data-tip]');
            if (!mark) { tip.classList.remove('show'); return; }
            tip.textContent = mark.getAttribute('data-tip');
            tip.classList.add('show');
            var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
            var y = e.clientY - tip.offsetHeight - 12;
            tip.style.transform = 'translate(' + x + 'px,' + (y < 8 ? e.clientY + 18 : y) + 'px)';
        });
        mainEl.addEventListener('mouseleave', function () { tip.classList.remove('show'); });
    }
 
    // menu id -> page renderer. Items without an entry show "coming soon".
    var PAGES = {
        'branch': renderBranchPage
    };
 
    /* ----------------------------------------------------------------- init */
 
    async function init() {
        sidebarEl = document.getElementById('sidebar');
        mainEl = document.getElementById('main-content');
 
        state.session = loadSession();
        if (!state.session || !state.session.token) {
            logout();
            return;
        }
 
        try {
            state.menu = await api('/menu');
        } catch (err) {
            mainEl.innerHTML = '<p class="error-message">ไม่สามารถโหลดเมนูได้: ' + escapeHTML(err.message) + '</p>';
            return;
        }
 
        renderSidebar();
        initTooltip();
        window.addEventListener('hashchange', function () { loadPage(routeFromHash()); });
        loadPage(routeFromHash());
    }
 
    document.addEventListener('DOMContentLoaded', init);
})();
 