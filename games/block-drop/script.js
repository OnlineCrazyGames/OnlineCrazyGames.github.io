(() => {
'use strict';
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}
const COLS = 10, ROWS = 20, CS = 30, $ = id => document.getElementById(id);
const bc = $('board'), bx = bc.getContext('2d');
const hc = $('hold'), hx = hc.getContext('2d');
const nc = $('next'), nx = nc.getContext('2d');
bc.width = COLS * CS; bc.height = ROWS * CS;

const SH = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]]
};
const COL = { I:'#29e3d0', O:'#ffc94a', T:'#a77bff', S:'#5ef08a', Z:'#ff4f6d', J:'#4f8cff', L:'#ff9a3d' };
const TYPES = Object.keys(SH);
const KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[-1,-1],[1,-1]];
const rotCW  = m => m[0].map((_, i) => m.map(r => r[i]).reverse());
const rotCCW = m => m[0].map((_, i) => m.map(r => r[r.length - 1 - i]));
const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

let board = emptyBoard(), cur = null, hold = null, canHold = true, queue = [];
let score = 0, lines = 0, level = 1, combo = -1, best = 0, newBest = false;
let state = 'start', clearing = null, parts = [], held = {};
let dropT = 0, lockT = 0, resets = 0, shake = 0;
try { best = +localStorage.getItem('block-drop-best') || 0; } catch (e) {}

/* ---------- sound ---------- */
let ac = null, muted = false;
try { muted = localStorage.getItem('block-drop-mute') === '1'; } catch (e) {}
function tone(f, d, type = 'square', v = .05, slide = 0, when = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
const sfx = {
  move: () => tone(220, .04, 'square', .02),
  rot:  () => tone(330, .07, 'triangle', .05, 120),
  lock: () => tone(120, .1, 'sine', .14, -50),
  hard: () => tone(90, .16, 'sine', .2, -50),
  clear: n => { const N = [523, 659, 784, 1047]; for (let i = 0; i <= Math.min(n, 3); i++) tone(N[i], .2, 'triangle', .08, 0, i * .06); },
  up:   () => { [392, 523, 659, 784].forEach((f, i) => tone(f, .15, 'square', .05, 0, i * .07)); },
  over: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, .3, 'sawtooth', .06, -20, i * .18)); }
};

/* ---------- helpers ---------- */
function bagFill() { const a = [...TYPES]; for (let i = 6; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function hit(m, x, y) {
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) if (m[r][c]) {
    const nx = x + c, ny = y + r;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && board[ny][nx]) return true;
  }
  return false;
}
const grounded = () => hit(cur.m, cur.x, cur.y + 1);
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function overlay(title, msg, btn) { $('ovt').textContent = title; $('ovm').textContent = msg; $('play').textContent = btn; $('ov').classList.remove('hide'); }

/* ---------- game flow ---------- */
function spawn(t) {
  while (queue.length < 5) queue.push(...bagFill());
  t = t || queue.shift();
  while (queue.length < 5) queue.push(...bagFill());
  const m = SH[t].map(r => [...r]);
  cur = { t, m, x: (COLS - m[0].length) / 2 | 0, y: t === 'I' ? -1 : 0 };
  canHold = true; lockT = 0; resets = 0; dropT = 0;
  if (hit(cur.m, cur.x, cur.y)) gameOver();
}
function start() {
  board = emptyBoard(); queue = []; hold = null; score = 0; lines = 0; level = 1; combo = -1;
  clearing = null; parts = []; held = {}; newBest = false; state = 'play';
  $('ov').classList.add('hide'); spawn();
}
function gameOver() {
  state = 'over'; sfx.over(); held = {};
  if (score > best) { best = score; newBest = true; try { localStorage.setItem('block-drop-best', best); } catch (e) {} }
  overlay('Game Over', 'Score ' + score.toLocaleString() + (newBest ? '  ·  New best! 🏆' : ''), '↻ Play again');
}
function pause() { if (state !== 'play') return; state = 'pause'; held = {}; overlay('Paused', 'Take a breather.', '▶ Resume'); }
function resume() { if (state !== 'pause') return; state = 'play'; $('ov').classList.add('hide'); }

function moved() { if (grounded() && resets < 12) { lockT = 0; resets++; } }
function move(dx) { if (!cur || hit(cur.m, cur.x + dx, cur.y)) return; cur.x += dx; moved(); sfx.move(); }
function rotate(dir) {
  if (!cur || cur.t === 'O') return;
  const nm = dir > 0 ? rotCW(cur.m) : rotCCW(cur.m);
  for (const [kx, ky] of KICKS) if (!hit(nm, cur.x + kx, cur.y + ky)) { cur.m = nm; cur.x += kx; cur.y += ky; moved(); sfx.rot(); return; }
}
function hardDrop() {
  if (!cur) return; let n = 0;
  while (!grounded()) { cur.y++; n++; }
  score += 2 * n; shake = 7; sfx.hard(); lock();
}
function doHold() {
  if (!cur || !canHold) return;
  const t = cur.t;
  if (hold) { const h = hold; hold = t; spawn(h); } else { hold = t; spawn(); }
  canHold = false; sfx.rot();
}
function lock() {
  let out = false;
  cur.m.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return; const y = cur.y + r, x = cur.x + c;
    if (y < 0) out = true; else board[y][x] = COL[cur.t];
  }));
  sfx.lock();
  if (out) { cur = null; gameOver(); return; }
  const rows = []; board.forEach((r, i) => { if (r.every(Boolean)) rows.push(i); });
  cur = null;
  if (!rows.length) { combo = -1; spawn(); return; }
  const n = rows.length; combo++;
  score += [0, 100, 300, 500, 800][n] * level + (combo > 0 ? 50 * combo * level : 0);
  lines += n;
  rows.forEach(r => { for (let c = 0; c < COLS; c++) for (let k = 0; k < 2; k++)
    parts.push({ x: c * CS + CS / 2, y: r * CS + CS / 2, vx: (Math.random() - .5) * 360, vy: -Math.random() * 300, l: 500 + Math.random() * 400, c: board[r][c] }); });
  clearing = { rows, t: 0 };
  sfx.clear(n); toast(['', 'Single', 'Double', 'Triple', 'QUAD!'][n] + (combo > 0 ? '  ×' + (combo + 1) : ''));
  const old = level; level = Math.floor(lines / 10) + 1;
  if (level > old) setTimeout(() => { sfx.up(); toast('Level ' + level); }, 700);
}
function finishClear() {
  const rows = clearing.rows;
  board = board.filter((_, i) => !rows.includes(i));
  while (board.length < ROWS) board.unshift(Array(COLS).fill(0));
  clearing = null; spawn();
}
function das(k, fn, dt) {
  const h = held[k]; if (!h) return; h.t += dt;
  if (!h.s) { if (h.t >= 150) { h.s = true; h.t = 0; fn(); } }
  else if (h.t >= 45) { h.t -= 45; fn(); }
}
function update(dt) {
  for (const p of parts) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += 900 * dt / 1000; p.l -= dt; }
  parts = parts.filter(p => p.l > 0);
  if (state !== 'play') return;
  if (clearing) { clearing.t += dt; if (clearing.t >= 260) finishClear(); return; }
  if (!cur) return;
  das('l', () => move(-1), dt); das('r', () => move(1), dt);
  const gi = Math.max(60, 900 * Math.pow(.85, level - 1)), iv = held.d ? Math.min(40, gi) : gi;
  dropT += dt; let n = 0;
  while (dropT >= iv && n++ < 4) { dropT -= iv; if (!grounded()) { cur.y++; if (held.d) score++; } }
  if (grounded()) { lockT += dt; if (lockT >= (held.d ? 150 : 450)) lock(); } else lockT = 0;
}

/* ---------- rendering ---------- */
function cell(g, x, y, s, col, a = 1) {
  g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.roundRect(x + 1, y + 1, s - 2, s - 2, s * .2); g.fill();
  const gr = g.createLinearGradient(x, y, x, y + s);
  gr.addColorStop(0, 'rgba(255,255,255,.45)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = gr; g.fill(); g.globalAlpha = 1;
}
function mini(g, t, cx, cy, s, a) {
  const m = SH[t]; let x0 = 9, x1 = 0, y0 = 9, y1 = 0;
  m.forEach((r, j) => r.forEach((v, i) => { if (v) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); } }));
  const w = (x1 - x0 + 1) * s, h = (y1 - y0 + 1) * s;
  m.forEach((r, j) => r.forEach((v, i) => { if (v) cell(g, cx - w / 2 + (i - x0) * s, cy - h / 2 + (j - y0) * s, s, COL[t], a); }));
}
function render() {
  bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, bc.width, bc.height);
  if (shake > 0) { bx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake); shake = Math.max(0, shake - .6); }
  const g = bx.createLinearGradient(0, 0, 0, bc.height); g.addColorStop(0, '#150e3a'); g.addColorStop(1, '#0b0724');
  bx.fillStyle = g; bx.fillRect(-10, -10, bc.width + 20, bc.height + 20);
  bx.strokeStyle = 'rgba(255,255,255,.05)'; bx.lineWidth = 1; bx.beginPath();
  for (let i = 1; i < COLS; i++) { bx.moveTo(i * CS + .5, 0); bx.lineTo(i * CS + .5, bc.height); }
  for (let j = 1; j < ROWS; j++) { bx.moveTo(0, j * CS + .5); bx.lineTo(bc.width, j * CS + .5); }
  bx.stroke();
  board.forEach((row, r) => row.forEach((v, c) => { if (v) cell(bx, c * CS, r * CS, CS, v); }));
  if (cur && state !== 'over') {
    let gy = cur.y; while (!hit(cur.m, cur.x, gy + 1)) gy++;
    cur.m.forEach((row, r) => row.forEach((v, c) => { if (v) {
      cell(bx, (cur.x + c) * CS, (gy + r) * CS, CS, COL[cur.t], .22);
      if (cur.y + r >= 0) cell(bx, (cur.x + c) * CS, (cur.y + r) * CS, CS, COL[cur.t]);
    } }));
  }
  if (clearing) {
    bx.fillStyle = 'rgba(255,255,255,' + (.35 + .45 * Math.sin(clearing.t / 28)) + ')';
    clearing.rows.forEach(r => bx.fillRect(0, r * CS, bc.width, CS));
  }
  parts.forEach(p => { bx.globalAlpha = Math.min(1, p.l / 300); bx.fillStyle = p.c; bx.fillRect(p.x - 3, p.y - 3, 6, 6); });
  bx.globalAlpha = 1;
  // side panels
  const hz = nc.width > nc.height;
  hx.clearRect(0, 0, hc.width, hc.height);
  if (hold) mini(hx, hold, hc.width / 2, hc.height / 2, hz ? 14 : 20, canHold ? 1 : .35);
  nx.clearRect(0, 0, nc.width, nc.height);
  [0, 1, 2].forEach(i => { if (queue[i]) mini(nx, queue[i], hz ? 45 + i * 90 : nc.width / 2, hz ? nc.height / 2 : 40 + i * 80, hz ? 16 : 20, 1); });
}
const cache = {};
function ui() {
  const v = { score, lines, level, best: Math.max(best, score) };
  for (const k in v) if (cache[k] !== v[k]) { cache[k] = v[k]; $(k).textContent = v[k].toLocaleString(); }
}
function layout() {
  const hz = innerWidth < 700;
  nc.width = hz ? 270 : 100; nc.height = hz ? 64 : 240;
  hc.width = hz ? 72 : 100; hc.height = hz ? 64 : 80;
}
addEventListener('resize', layout); layout();

let last = 0;
function frame(ts) { const dt = Math.min(ts - last || 16, 50); last = ts; update(dt); render(); ui(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

/* ---------- input ---------- */
function press(a) {
  if (state !== 'play') return;
  if (a === 'l') { held.l = { t: 0, s: false }; delete held.r; move(-1); }
  else if (a === 'r') { held.r = { t: 0, s: false }; delete held.l; move(1); }
  else if (a === 'd') held.d = 1;
  else if (a === 'cw') rotate(1);
  else if (a === 'ccw') rotate(-1);
  else if (a === 'hard') hardDrop();
  else if (a === 'hold') doHold();
}
const release = a => { delete held[a]; };
const KM = { ArrowLeft:'l', a:'l', A:'l', ArrowRight:'r', d:'r', D:'r', ArrowDown:'d', s:'d', S:'d',
  ArrowUp:'cw', w:'cw', W:'cw', x:'cw', X:'cw', z:'ccw', Z:'ccw', ' ':'hard', c:'hold', C:'hold', Shift:'hold' };
function toggleMute() { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem('block-drop-mute', muted ? '1' : '0'); } catch (e) {} }
const togglePause = () => state === 'play' ? pause() : resume();

addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault();
  if (k === 'Enter' || (k === ' ' && (state === 'start' || state === 'over'))) {
    if (state === 'start' || state === 'over') start(); else if (state === 'pause') resume(); return;
  }
  if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
  if (k === 'm' || k === 'M') { toggleMute(); return; }
  const a = KM[k]; if (a && !e.repeat) press(a);
});
addEventListener('keyup', e => { const a = KM[e.key]; if (a) release(a); });
addEventListener('blur', () => { held = {}; pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

$('play').onclick = () => { if (state === 'pause') resume(); else start(); };
$('pbtn').onclick = togglePause;
$('mute').onclick = toggleMute;
$('mute').textContent = muted ? '🔇' : '🔊';
document.querySelectorAll('.pad button').forEach(b => {
  const a = b.dataset.a;
  b.addEventListener('pointerdown', e => { e.preventDefault(); press(a); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => release(a)));
});
document.addEventListener('contextmenu', e => e.preventDefault());
overlay('Block Drop', 'Stack the blocks, clear lines and chase the high score.', '▶ Play');
})();
