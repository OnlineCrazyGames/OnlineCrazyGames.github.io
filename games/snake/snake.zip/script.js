const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const startPanel = document.getElementById('startPanel');
const overPanel = document.getElementById('overPanel');
const finalScoreEl = document.getElementById('finalScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

let config = {
  grid: 20,
  canvasSize: 320,
  initialTickRate: 6,
  minTickRate: 3,
  scorePerFood: 10,
  colors: {
    background: '#1f2833',
    snakeHead: '#66fcf1',
    snakeBody: '#45a29e',
    food: '#ff0055',
    hud: '#66fcf1'
  },
  startSnake: [
    { x: 10, y: 15 },
    { x: 10, y: 16 },
    { x: 10, y: 17 }
  ],
  startDir: { x: 0, y: -1 }
};

fetch('game.json')
  .then(response => {
    if (!response.ok) throw new Error('Could not load game.json');
    return response.json();
  })
  .then(data => {
    config = data;
    canvas.width = config.canvasSize;
    canvas.height = config.canvasSize;
  })
  .catch(error => {
    console.warn('Using default config:', error.message);
    canvas.width = config.canvasSize;
    canvas.height = config.canvasSize;
  });

const GRID = config.grid;
const TILE = canvas.width / GRID;

let best = localStorage.getItem('snake_best') || 0;
bestEl.textContent = 'Best ' + best;

let running = false;
let snake = [];
let dir = { x: 0, y: 0 };
let nextDir = { x: 0, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let tick = 0;
let tickRate = config.initialTickRate;
let gameOver = false;

function reset() {
  snake = config.startSnake.map(seg => ({ x: seg.x, y: seg.y }));
  dir = { x: config.startDir.x, y: config.startDir.y };
  nextDir = { x: config.startDir.x, y: config.startDir.y };
  score = 0;
  tick = 0;
  tickRate = config.initialTickRate;
  gameOver = false;
  scoreEl.textContent = 'Score 0';
  placeFood();
  running = true;
  overPanel.classList.remove('show');
  startPanel.classList.add('hide');
  requestAnimationFrame(loop);
}

function placeFood() {
  let valid = false;
  while (!valid) {
    food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    valid = !snake.some(seg => seg.x === food.x && seg.y === food.y);
  }
}

function draw() {
  ctx.fillStyle = config.colors.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = config.colors.food;
  ctx.beginPath();
  ctx.arc(food.x * TILE + TILE / 2, food.y * TILE + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? config.colors.snakeHead : config.colors.snakeBody;
    ctx.shadowColor = i === 0
      ? 'rgba(102,252,241,0.6)'
      : 'rgba(69,162,158,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillRect(seg.x * TILE + 1, seg.y * TILE + 1, TILE - 2, TILE - 2);
    ctx.shadowBlur = 0;
  });
}

function update() {
  if (!running || gameOver) return;

  dir = nextDir;

  tick++;
  if (tick < tickRate) return;
  tick = 0;

  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
    endGame();
    return;
  }

  if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += config.scorePerFood;
    scoreEl.textContent = 'Score ' + score;
    if (tickRate > config.minTickRate) tickRate--;
    placeFood();
  } else {
    snake.pop();
  }
}

function loop() {
  update();
  draw();
  if (running) requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem('snake_best', best);
    bestEl.textContent = 'Best ' + best;
  }
  finalScoreEl.textContent = 'Score ' + score;
  overPanel.classList.add('show');
  startPanel.classList.remove('hide');
}

function setDir(dx, dy) {
  if (dx === -dir.x && dy === -dir.y) return;
  nextDir = { x: dx, y: dy };
}

startBtn.addEventListener('click', () => { startPanel.classList.add('hide'); reset(); });
restartBtn.addEventListener('click', () => { overPanel.classList.remove('show'); reset(); });

window.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); setDir(0, -1); break;
    case 'ArrowDown':  e.preventDefault(); setDir(0, 1); break;
    case 'ArrowLeft':  e.preventDefault(); setDir(-1, 0); break;
    case 'ArrowRight': e.preventDefault(); setDir(1, 0); break;
  }
});

document.getElementById('btnUp').addEventListener('click', () => setDir(0, -1));
document.getElementById('btnDown').addEventListener('click', () => setDir(0, 1));
document.getElementById('btnLeft').addEventListener('click', () => setDir(-1, 0));
document.getElementById('btnRight').addEventListener('click', () => setDir(1, 0));

let touchStart = null;
canvas.addEventListener('touchstart', e => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
canvas.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > Math.abs(dy)) {
    setDir(dx > 0 ? 1 : -1, 0);
  } else if (Math.abs(dy) > 0) {
    setDir(0, dy > 0 ? 1 : -1);
  }
}, { passive: true });
