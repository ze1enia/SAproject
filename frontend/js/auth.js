const API_URL = 'http://localhost:5000/api/auth';
const statusMsg = document.getElementById('statusMsg');

//Login / Register
function switchTab(type) {
  statusMsg.textContent = '';
  if (type === 'login') {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
  } else {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('tabLogin').classList.remove('active');
    document.getElementById('tabRegister').classList.add('active');
  }
}

//Register Management
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  statusMsg.className = 'message';
  statusMsg.textContent = 'Processing...';

  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      statusMsg.className = 'message success';
      statusMsg.textContent = 'Registration successful! ';
      document.getElementById('registerForm').reset();
    } else {
      statusMsg.className = 'message error';
      statusMsg.textContent = data.message || 'There was an error signing up';
    }
  } catch (err) {
    statusMsg.className = 'message error';
    statusMsg.textContent = 'Can not connect to the server';
  }
});

//Login Management
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  statusMsg.className = 'message';
  statusMsg.textContent = 'Checking...';

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));

      statusMsg.className = 'message success';
      statusMsg.textContent = 'Login succesfully';

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    } else {
      statusMsg.className = 'message error';
      statusMsg.textContent = data.message || 'Email or password is incorrect';
    }
  } catch (err) {
    statusMsg.className = 'message error';
    statusMsg.textContent = 'Can not connect to the server';
  }
});