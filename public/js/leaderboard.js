// Populates any #leaderboardBody table on the page from the public
// GET /api/scores endpoint. Shared by index.html and game.html.
async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/scores');
    const rows = await res.json();

    if (!res.ok) throw new Error(rows.error || 'Failed to load leaderboard');

    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted">No scores yet -- be the first!</td></tr>';
      return;
    }

    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      const rank = document.createElement('td');
      const name = document.createElement('td');
      const score = document.createElement('td');
      rank.textContent = String(i + 1);
      name.textContent = row.username;
      score.textContent = row.best_score;
      tr.append(rank, name, score);
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="error">${err.message}</td></tr>`;
  }
}

loadLeaderboard();
