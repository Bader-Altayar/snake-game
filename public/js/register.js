const form = document.getElementById('registerForm');
const errorEl = document.getElementById('formError');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const body = {
    username: form.username.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
  };

  try {
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Registration failed.';
      return;
    }

    // Registration also logs the new user in (server regenerates the
    // session), so we can go straight to the game.
    window.location.href = '/game';
  } catch (err) {
    errorEl.textContent = 'Network error, please try again.';
  }
});
