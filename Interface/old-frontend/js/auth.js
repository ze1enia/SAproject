const API_URL = 'http://localhost:5000/api/auth';
const loginForm = document.getElementById('loginForm');
const statusMsg = document.getElementById('statusMsg');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusMsg.className = 'message';
  statusMsg.textContent = 'Checking...';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      statusMsg.className = 'message success';
      statusMsg.textContent = 'Login successful. Redirecting to the next page...';

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 800);
    } else {
      statusMsg.className = 'message error';
      statusMsg.textContent = data.message || 'Incorrect username or password.';
    }
  } catch (err) {
    statusMsg.className = 'message error';
    statusMsg.textContent = 'Unable to connect to the server.';
  }
});