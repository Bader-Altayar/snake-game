const GRID_SIZE = 20; // cells per side
const CELL_PX = 20; // canvas is GRID_SIZE * CELL_PX = 400px
const TICK_MS = 110;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const gameOverMsg = document.getElementById('gameOverMsg');
const newGameBtn = document.getElementById('newGameBtn');
const whoamiEl = document.getElementById('whoami');
const logoutBtn = document.getElementById('logoutBtn');

let snake, direction, nextDirection, food, score, tickHandle, isRunning;

function randomCell() {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
}

function placeFood() {
  let cell;
  do {
    cell = randomCell();
  } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
  return cell;
}

function resetGame() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  score = 0;
  food = placeFood();
  scoreEl.textContent = '0';
  gameOverMsg.textContent = '';
  isRunning = true;
}

function draw() {
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(food.x * CELL_PX, food.y * CELL_PX, CELL_PX - 1, CELL_PX - 1);

  snake.forEach((segment, i) => {
    ctx.fillStyle = i === 0 ? '#22c55e' : '#16a34a';
    ctx.fillRect(segment.x * CELL_PX, segment.y * CELL_PX, CELL_PX - 1, CELL_PX - 1);
  });
}

function step() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  const hitWall = head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);

  if (hitWall || hitSelf) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = String(score);
    food = placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function startLoop() {
  clearInterval(tickHandle);
  tickHandle = setInterval(step, TICK_MS);
}

async function endGame() {
  isRunning = false;
  clearInterval(tickHandle);
  gameOverMsg.textContent = `Game over! Final score: ${score}`;

  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
    if (res.status === 401) {
      // Session expired mid-game -- send the player back to log in.
      window.location.href = '/login.html';
      return;
    }
    if (typeof loadLeaderboard === 'function') loadLeaderboard();
  } catch (err) {
    // Non-fatal: the player still sees their score on screen even if the
    // save request failed (e.g. network blip).
    console.error('Failed to save score', err);
  }
}

const KEY_MAP = {
  ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
};

document.addEventListener('keydown', (e) => {
  const wanted = KEY_MAP[e.key];
  if (!wanted || !isRunning) return;
  // Prevent an instant 180-degree turn into your own neck.
  if (wanted.x === -direction.x && wanted.y === -direction.y) return;
  nextDirection = wanted;
  e.preventDefault();
});

newGameBtn.addEventListener('click', () => {
  resetGame();
  draw();
  startLoop();
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

async function loadWhoami() {
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) return;
    const data = await res.json();
    whoamiEl.textContent = `Playing as ${data.username}`;
  } catch (err) {
    // Non-fatal: the greeting is cosmetic.
  }
}

loadWhoami();
resetGame();
draw();
startLoop();
