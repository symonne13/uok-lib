const API = 'http://localhost:5000/api';

function showAlert(msg, type = 'error') {
  const el = document.getElementById('signup-alert');
  el.innerHTML = `<div class="alert alert-${type}">
    <span>${type === 'success' ? '✅' : '❌'}</span> ${msg}
  </div>`;
}

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name       = document.getElementById('username').value.trim();
  const reg_number = document.getElementById('reg_number').value.trim();
  const email      = document.getElementById('email').value.trim();
  const password   = document.getElementById('password').value;

  // Basic validation
  if (!name || !reg_number || !email || !password) {
    return showAlert('All fields are required.');
  }
  if (password.length < 6) {
    return showAlert('Password must be at least 6 characters.');
  }

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, reg_number, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      showAlert('Account created successfully! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'login.html', 1500);
    } else {
      showAlert(data.message || 'Registration failed.');
    }
  } catch (err) {
    showAlert('Could not connect to server. Please try again.');
  }
});