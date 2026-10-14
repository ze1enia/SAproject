/* Where the pages find the backend API.
 *
 * - Page served by Express (npm start)         -> same origin, any port
 * - Page opened via VS Code Live Server / file:// -> http://localhost:BACKEND_PORT
 *
 * Port 5000 is taken by AirPlay Receiver on macOS, so the backend runs on 5001
 * (set PORT=5001 in backend/.env).
 */
(function () {
    'use strict';

    var BACKEND_PORT = '5001';
    var STATIC_DEV_PORTS = ['5500', '5501']; // Live Server

    var isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
    var servedByBackend = isHttp && STATIC_DEV_PORTS.indexOf(window.location.port) === -1;

    window.SA_API_ROOT = (servedByBackend
        ? window.location.origin
        : 'http://localhost:' + BACKEND_PORT) + '/api';
})();
