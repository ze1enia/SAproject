/* Shared authentication helper for the login and welcome pages. */
(function () {
    'use strict';

    // Pages are normally served by the Express app itself, so the API lives on the
    // same origin. When a page is opened straight from disk (file://) fall back to
    // the default backend port.
    // js/config.js decides where the backend is
    var API_BASE = window.SA_API_ROOT + '/auth';

    var SESSION_KEY = 'sa_session';

    var session = {
        save: function (data) {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        },
        load: function () {
            try {
                return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
            } catch (err) {
                return null;
            }
        },
        clear: function () {
            sessionStorage.removeItem(SESSION_KEY);
        }
    };

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = (value === null || value === undefined || value === '') ? '-' : value;
        }
    }

    /* ---------------------------------------------------------------- login */

    function initLoginPage() {
        var form = document.getElementById('loginForm');
        if (!form) {
            return;
        }

        var usernameInput = document.getElementById('username');
        var passwordInput = document.getElementById('password');
        var statusMsg = document.getElementById('statusMsg');
        var submitButton = document.getElementById('loginButton');

        function showMessage(text, type) {
            if (!statusMsg) {
                return;
            }
            statusMsg.textContent = text;
            statusMsg.className = 'status-message' + (type ? ' ' + type : '');
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            var username = usernameInput ? usernameInput.value.trim() : '';
            var password = passwordInput ? passwordInput.value : '';

            if (!username || !password) {
                showMessage('Please enter your username and password.', 'error');
                return;
            }

            if (submitButton) {
                submitButton.disabled = true;
            }
            showMessage('Checking...', '');

            try {
                var res = await fetch(API_BASE + '/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username, password: password })
                });
                var body = await res.json();

                if (res.ok && body.success) {
                    session.save({ token: body.data.token, user: body.data.user });
                    showMessage('Login successful', 'success');
                    window.location.href = 'welcome.html';
                } else {
                    showMessage(body.message || 'Incorrect username or password.', 'error');
                }
            } catch (err) {
                showMessage('Cannot connect to the server.', 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });
    }

    /* -------------------------------------------------------------- welcome */

    function renderUser(user) {
        if (!user) {
            return;
        }
        setText('user-name', user.username);
        setText('user-id', user.userId);
        setText('user-role', user.role);
        setText('user-branch', user.branch);
    }

    function logout() {
        session.clear();
        window.location.href = 'login.html';
    }

    async function initWelcomePage() {
        var page = document.querySelector('.welcome-page');
        if (!page) {
            return;
        }

        var current = session.load();
        if (!current || !current.token) {
            logout();
            return;
        }

        // Show what we already know straight away, then confirm against the server.
        renderUser(current.user);

        var continueButton = document.querySelector('.continue-button');
        if (continueButton) {
            continueButton.addEventListener('click', function () {
                window.location.href = 'branch-owner.html';
            });
        }

        var closeButton = document.querySelector('.close-button');
        if (closeButton) {
            closeButton.addEventListener('click', logout);
        }

        try {
            var res = await fetch(API_BASE + '/me', {
                headers: { Authorization: 'Bearer ' + current.token }
            });

            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }

            var body = await res.json();
            if (res.ok && body.success && body.data && body.data.user) {
                renderUser(body.data.user);
                session.save({ token: current.token, user: body.data.user });
            }
        } catch (err) {
            // Server unreachable: keep showing the details captured at login time.
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initLoginPage();
        initWelcomePage();
    });
})();
