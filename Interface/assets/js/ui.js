/* Small UI toolkit shared by the Owner pages (assets/js/pages/*.js).
 * Loaded after sidebar.js; everything hangs off window.SAUI.
 */
(function () {
    'use strict';

    var esc = function (v) { return window.SA.escapeHTML(v); };

    var numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var intFormat = new Intl.NumberFormat('en-US');

    function money(value) { return '฿' + numberFormat.format(Number(value) || 0); }
    function int(value) { return intFormat.format(Number(value) || 0); }

    function debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments, self = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(self, args); }, ms);
        };
    }

    // last branch picked in any branch dropdown (shared by Stock / Request / Delivery / Sales / Budget)
    function branchPref(value) {
        try {
            if (value === undefined) return sessionStorage.getItem('sa_branch') || 'B001';
            sessionStorage.setItem('sa_branch', value);
        } catch (err) { return 'B001'; }
        return value;
    }

    /* ---------------------------------------------------------------- badges */

    // Status is never colour-only: every kind has its own symbol + the label text.
    var BADGE_ICON = { good: '✓', warn: '!', bad: '✕', info: '●', muted: '–' };
    function badge(kind, text) {
        return '<span class="badge badge-' + kind + '"><span aria-hidden="true">' + (BADGE_ICON[kind] || '•') + '</span> ' + esc(text) + '</span>';
    }

    /* ------------------------------------------------------------ small blocks */

    function statTile(label, value, note, tone) {
        return '<div class="stat-tile' + (tone ? ' tone-' + tone : '') + '">' +
            '<span class="stat-label">' + esc(label) + '</span>' +
            '<strong class="stat-value">' + value + '</strong>' +
            (note ? '<span class="stat-note">' + esc(note) + '</span>' : '') +
        '</div>';
    }

    function emptyState(text, hint) {
        return '<div class="empty-state"><p>' + esc(text) + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</p></div>';
    }

    // segmented tab bar; returns { html, bind(root, onChange) }
    function tabs(items, activeId) {
        var html = '<div class="tab-bar" role="tablist">' + items.map(function (t) {
            var on = t.id === activeId;
            return '<button type="button" role="tab" class="tab' + (on ? ' active' : '') + '" data-tab="' + esc(t.id) + '" aria-selected="' + on + '">' +
                esc(t.label) + (t.count !== undefined ? ' <span class="tab-count">' + esc(t.count) + '</span>' : '') + '</button>';
        }).join('') + '</div>';
        return {
            html: html,
            bind: function (root, onChange) {
                root.querySelectorAll('[data-tab]').forEach(function (btn) {
                    btn.addEventListener('click', function () { onChange(btn.getAttribute('data-tab')); });
                });
            }
        };
    }

    /* ----------------------------------------------------------------- toast */

    var toastTimer;
    function toast(message, kind) {
        var el = document.getElementById('sa-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sa-toast';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            document.body.appendChild(el);
        }
        el.className = 'toast toast-' + (kind || 'good');
        el.innerHTML = '<span aria-hidden="true">' + (kind === 'bad' ? '✕' : '✓') + '</span> ' + esc(message);
        // restart the transition
        void el.offsetWidth;
        el.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
    }

    /* ----------------------------------------------------------------- modal */

    // modal({ title, body (html), actions: [{ label, kind, onClick(modal) }], wide })
    function modal(options) {
        var previouslyFocused = document.activeElement;
        var backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.innerHTML =
            '<div class="modal' + (options.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
                '<header class="modal-head">' +
                    '<h3 id="modal-title">' + esc(options.title) + '</h3>' +
                    '<button type="button" class="modal-x" aria-label="Close">×</button>' +
                '</header>' +
                '<div class="modal-body">' + options.body + '</div>' +
                '<footer class="modal-foot"></footer>' +
            '</div>';
        document.body.appendChild(backdrop);
        document.body.classList.add('modal-open');

        var box = backdrop.querySelector('.modal');
        var foot = backdrop.querySelector('.modal-foot');
        var api = {
            el: box,
            body: backdrop.querySelector('.modal-body'),
            close: close,
            setBusy: function (busy) {
                foot.querySelectorAll('button').forEach(function (b) { b.disabled = busy; });
            },
            // inline error under the form (keeps the dialog open so nothing typed is lost)
            error: function (message) {
                var box = api.body.querySelector('.form-error');
                if (!box) {
                    box = document.createElement('p');
                    box.className = 'form-error';
                    box.setAttribute('role', 'alert');
                    api.body.appendChild(box);
                }
                box.textContent = message || '';
                box.hidden = !message;
            }
        };

        (options.actions || []).forEach(function (action) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-' + (action.kind || 'ghost');
            btn.textContent = action.label;
            btn.addEventListener('click', function () { action.onClick ? action.onClick(api) : close(); });
            foot.appendChild(btn);
        });

        function onKey(e) {
            if (e.key === 'Escape') { close(); return; }
            if (e.key !== 'Tab') return;
            var f = box.querySelectorAll('button, input, select, textarea, a[href]');
            var focusable = Array.prototype.filter.call(f, function (n) { return !n.disabled && n.offsetParent !== null; });
            if (!focusable.length) return;
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }

        function close() {
            document.removeEventListener('keydown', onKey);
            backdrop.remove();
            document.body.classList.remove('modal-open');
            if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
            if (options.onClose) options.onClose();
        }

        backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
        backdrop.querySelector('.modal-x').addEventListener('click', close);
        document.addEventListener('keydown', onKey);

        var autofocus = box.querySelector('[autofocus], input:not([type=hidden]), select, textarea') || box.querySelector('.btn');
        if (autofocus) autofocus.focus();
        if (options.onOpen) options.onOpen(api);
        return api;
    }

    // confirm({ title, message, confirmLabel, danger }) -> Promise<boolean>
    function confirmDialog(options) {
        return new Promise(function (resolve) {
            var settled = false;
            function done(value, m) { if (settled) return; settled = true; resolve(value); if (m) m.close(); }
            modal({
                title: options.title,
                body: '<p class="confirm-text">' + options.message + '</p>',
                onClose: function () { done(false); },
                actions: [
                    { label: options.cancelLabel || 'ยกเลิก', kind: 'ghost', onClick: function (m) { done(false, m); } },
                    { label: options.confirmLabel || 'ยืนยัน', kind: options.danger ? 'danger' : 'primary', onClick: function (m) { done(true, m); } }
                ]
            });
        });
    }

    window.SAUI = {
        money: money, int: int, debounce: debounce, branchPref: branchPref, badge: badge, statTile: statTile,
        emptyState: emptyState, tabs: tabs, toast: toast, modal: modal, confirm: confirmDialog
    };
})();
