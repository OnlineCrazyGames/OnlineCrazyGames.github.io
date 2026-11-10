const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const startPanel = document.getElementById('startPanel');
const pausePanel = document.getElementById('pausePanel');
const overPanel = document.getElementById('overPanel');
const finalScoreEl = document.getElementById('finalScore');
const newBestEl = document.getElementById('newBest');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const resumeBtn = document.getElementById('resumeBtn');

let config;

function defaultConfig() {
  return {
    grid: 20, canvasSize: 400, initialTickRate: 9, minTickRate: 3,
    scorePerFood: 10,
    colors: {
      background: '#07070a', panelBg: 'rgba(10, 10, 14, 0.72)',
      snakeHead: '#00f2ff', snakeBody: '#007a7a', snakeGlow: 'rgba(0,242,255,0.45)',
      food: '#ff0066', foodGlow: 'rgba(255,0,102,0.55)',
      hud: '#00f2ff', text: '#e8eaf2', muted: '#8a93a6', accent: '#7c3aed'
    },
    startSnake: [ {x:10,y:15},{x:10,y:16},{x:10,y:17} ], startDir: {x:0,y:-1 },
    particles: true, sounds: true
  };
}

fetch('game.json')
  .then(response => { if (!response.ok) throw new Error('Could not load game.json'); return response.json(); })
  .then(data => { config = data; init(); })
  .catch(error => { console.warn('Using default config:', error.message); config = defaultConfig(); init(); });

let GRID, TILE;
let best = parseInt(localStorage.getItem('snake_best') || '0', 10);
bestEl.textContent = best;

let running = false, paused = false, gameOver = false;
let snake = [], renderSnake = [], dir = { x: 0, y: 0 }, nextDir = { x: 0, y: 0 };
let food = { x: 0, y: 0 };
let score = 0, level = 1, tick = 0, tickRate;
let particles = [];
let foodPulse = 0;

let audioCtx = null;
let soundsReady = false;

function ensureAudio() {
  if (soundsReady || !config.sounds) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    soundsReady = true;
  } catch (e) {
    console.warn('Web Audio not available:', e.message);
  }
}

function playSound(kind) {
  if (!soundsReady || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  if (kind === 'start') {
    osc.type = 'square';
    [ [t, 220], [t + 0.07, 330], [t + 0.14, 440] ].forEach(([time, f]) => osc.frequency.setValueAtTime(f, time));
    gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.start(t); osc.stop(t + 0.18);
  } else if (kind === 'eat') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(1200, t + 0.09);
    gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t); osc.stop(t + 0.12);
  } else if (kind === 'over') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t); osc.frequency.linearRampToValueAtTime(60, t + 0.5);
    gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0.001, t + 0.5);
    osc.start(t); osc.stop(t + 0.5);
  }
}

function init() {
  canvas.width = config.canvasSize;
  canvas.height = config.canvasSize;
  GRID = config.grid;
  TILE = canvas.width / GRID;
  ensureAudio();
  reset();
  requestAnimationFrame(loop);
}

function reset() {
  snake = config.startSnake.map(seg => ({ x: seg.x, y: seg.y }));
  renderSnake = snake.map(seg => ({ x: seg.x, y: seg.y }));
  dir = { x: config.startDir.x, y: config.startDir.y };
  nextDir = { x: config.startDir.x, y: config.startDir.y };
  score = 0; level = 1; tick = 0; tickRate = config.initialTickRate;
  gameOver = false; paused = false; running = true;
  particles = [];
  foodPulse = 0;
  scoreEl.textContent = '0';
  levelEl.textContent = '1';
  newBestEl.classList.remove('show');
  placeFood();
  startPanel.classList.remove('show');
  pausePanel.classList.remove('show');
  overPanel.classList.remove('show');
  playSound('start');
}

function placeFood() {
  let valid = false;
  while (!valid) {
    food = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    valid = !snake.some(seg => seg.x === food.x && seg.y === food.y);
  }
}

function spawnParticles(cx, cy, color) {
  if (!config.particles) return;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const speed = 1.2 + Math.random() * 2.2;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color
    });
  }
}

function update() {
  if (!running || paused || gameOver) return;

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
    score += config.scorePerFood * level;
    scoreEl.textContent = score;
    const cx = food.x * TILE + TILE / 2;
    const cy = food.y * TILE + TILE / 2;
    spawnParticles(cx, cy, config.colors.food);
    foodPulse = 1.0;
    playSound('eat');
    placeFood();
    if (tickRate > config.minTickRate) tickRate--;
    level = 1 + Math.floor((score / config.scorePerFood) / 5);
    levelEl.textContent = level;
  } else {
    snake.pop();
  }

  renderSnake = renderSnake.slice(0, snake.length);
  renderSnake.forEach((seg, i) => {
    const target = snake[i];
    seg.x += (target.x - seg.x) * 0.42;
    seg.y += (target.y - seg.y) * 0.42;
  });
}

function draw() {
  const c = config.colors;
  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const pos = i * TILE;
    ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(canvas.width, pos); ctx.stroke();
  }

  foodPulse = Math.max(0, foodPulse - 0.04);
  const pulse = 1 + foodPulse * 0.35;
  const fx = food.x * TILE + TILE / 2;
  const fy = food.y * TILE + TILE / 2;
  ctx.shadowColor = c.foodGlow;
  ctx.shadowBlur = 16 * pulse;
  ctx.fillStyle = c.food;
  ctx.beginPath();
  ctx.arc(fx, fy, (TILE / 2 - 3) * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  renderSnake.forEach((seg, i) => {
    ctx.shadowColor = i === 0 ? c.snakeGlow : 'rgba(0,122,122,0.35)';
    ctx.shadowBlur = i === 0 ? 14 : 8;
    ctx.fillStyle = i === 0 ? c.snakeHead : c.snakeBody;
    const r = TILE - 2;
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    ctx.roundRect(seg.x * TILE + pad, seg.y * TILE + pad, r, r, i === 0 ? 4 : 3);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life -= 0.055;
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function loop() {
  update();
  draw();
  if (running) requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  playSound('over');
  if (score > best) {
    best = score;
    localStorage.setItem('snake_best', String(best));
    bestEl.textContent = best;
    newBestEl.classList.add('show');
  }
  finalScoreEl.textContent = score;
  overPanel.classList.add('show');
}

function setDir(dx, dy) {
  if (dx === -dir.x && dy === -dir.y) return;
  nextDir = { x: dx, y: dy };
}

startBtn.addEventListener('click', () => { startPanel.classList.remove('show'); reset(); });
restartBtn.addEventListener('click', () => { overPanel.classList.remove('show'); reset(); });
resumeBtn.addEventListener('click', () => { paused = false; pausePanel.classList.remove('show'); });

window.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); setDir(0, -1); break;
    case 'ArrowDown':  e.preventDefault(); setDir(0, 1); break;
    case 'ArrowLeft':  e.preventDefault(); setDir(-1, 0); break;
    case 'ArrowRight': e.preventDefault(); setDir(1, 0); break;
    case ' ': e.preventDefault(); paused = !paused; pausePanel.classList.toggle('show', paused); break;
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
  } else if (Math.abs(dy) > 10) {
    setDir(0, dy > 0 ? 1 : -1);
  }
}, { passive: true });
