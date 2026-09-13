const form = document.getElementById('loginForm');
const errorEl = document.getElementById('formError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const body = {
    username: form.username.value.trim(),
    password: form.password.value,
  };

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Login failed.';
      return;
    }

    window.location.href = '/game';
  } catch (err) {
    errorEl.textContent = 'Network error, please try again.';
  }
});
