/* Neon Viper 3D - perspective snake game. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const W = 420, H = 380, N = 13, CELL = 30, TOP = 36, HB = 300, KEY = 'neon-viper-best', MKEY = 'neon-viper-mute';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let segs, prev, dir, queue, acc, food, bonus, rocks, score, shown, best = 0, level, eaten, combo, eatT, parts, pops, shake, mode = 'start', last = 0, muted = false, ac = null, grow, swipe = null, tt = 0;
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
const step = () => Math.max(.075, .2 - level * .012);
function beep(f, d, type = 'sine', v = .07) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
// perspective projection: grid (x,y,z) -> screen [X,Y,scale]
function P(x, y, z) { const d = y / N, s = .55 + .45 * d; return [W / 2 + (x - N / 2) * CELL * s, TOP + HB * (.55 * d + .225 * d * d) / .775 - z * CELL * s, s]; }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
function burst(gx, gy, c, n) { for (let i = 0; i < n; i++) parts.push({x: gx, y: gy, z: .4, vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(1, 5), life: rnd(.4, .9), c}); }
const taken = (x, y) => segs.some(s => s.x === x && s.y === y) || rocks.some(r => r.x === x && r.y === y) || (food && food.x === x && food.y === y) || (bonus && bonus.x === x && bonus.y === y);
function freeCell(minDist) { for (let k = 0; k < 200; k++) { const x = Math.floor(rnd(0, N)), y = Math.floor(rnd(0, N)); if (!taken(x, y) && Math.abs(x - segs[0].x) + Math.abs(y - segs[0].y) >= (minDist || 0)) return {x, y}; } return {x: 0, y: 0}; }
// ===== game logic =====
function reset() {
  const m = Math.floor(N / 2); segs = [{x: m, y: m}, {x: m - 1, y: m}, {x: m - 2, y: m}]; prev = segs.map(s => ({...s})); dir = {x: 1, y: 0}; queue = []; acc = 0; rocks = []; food = null; bonus = null;
  score = 0; shown = 0; level = 1; eaten = 0; combo = 0; eatT = -99; parts = []; pops = []; shake = 0; grow = 0; food = freeCell(3);
}
function turn(dx, dy) { if (mode !== 'play') return; const l = queue.length ? queue[queue.length - 1] : dir; if ((l.x === -dx && l.y === -dy) || (l.x === dx && l.y === dy)) return; if (queue.length < 2) queue.push({x: dx, y: dy}); }
function advance() {
  prev = segs.map(s => ({...s})); if (queue.length) dir = queue.shift();
  const h = {x: segs[0].x + dir.x, y: segs[0].y + dir.y};
  const body = grow > 0 ? segs : segs.slice(0, -1);
  if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || body.some(s => s.x === h.x && s.y === h.y) || rocks.some(r => r.x === h.x && r.y === h.y)) { die(); return; }
  segs.unshift(h); if (grow > 0) grow--; else segs.pop();
  if (food && h.x === food.x && h.y === food.y) eat(false); else if (bonus && h.x === bonus.x && h.y === bonus.y) eat(true);
}
function eat(b) {
  const now = tt; combo = now - eatT < 3.5 ? combo + 1 : 1; eatT = now; const mult = Math.min(5, combo), pts = 10 * mult * (b ? 5 : 1); score += pts; grow += b ? 3 : 1; eaten++;
  const f = b ? bonus : food; burst(f.x + .5, f.y + .5, b ? '#ffc94a' : '#29e3d0', 16); pop('+' + pts, W / 2 + (f.x - N / 2) * 25, 110 + f.y * 10, b ? '#ffc94a' : '#29e3d0'); if (combo >= 3) pop('Combo x' + mult + '!', W / 2, 30, '#ff4fa3');
  beep(500 + combo * 40, .12, 'sine', .08);
  if (b) bonus = null; else { food = freeCell(); if (!bonus && Math.random() < .2) bonus = Object.assign(freeCell(), {t: 7}); }
  if (!b && eaten % 5 === 0) { level++; pop('Level ' + level, W / 2, 60, '#ff4fa3'); beep(700, .3, 'square', .05); for (let i = 0; i < 2 && rocks.length < 12; i++) rocks.push(freeCell(4)); }
}
function die() { shake = 14; beep(110, .6, 'sawtooth', .09); burst(segs[0].x + .5, segs[0].y + .5, '#ff4fa3', 30); end(); }
function end() {
  mode = 'over'; if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Game Over', score >= best && score > 0 ? 'New best score!' : 'Length ' + segs.length + ' · Level ' + level, 'Play Again');
}
function update(dt) {
  tt += dt; shake = Math.max(0, shake - dt * 30); acc += dt; const s = step();
  while (acc >= s && mode === 'play') { acc -= s; advance(); }
  if (bonus) { bonus.t -= dt; if (bonus.t <= 0) bonus = null; }
  fx(dt);
}
function fx(dt) {
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 9 * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 22 * dt; p.life -= dt * .8; }); pops = pops.filter(p => p.life > 0);
}
// ===== rendering =====
function quad(a, b, c, d, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); }
function sphere(x, y, z, r, c1, c2) {
  const f = P(x, y, 0), p = P(x, y, z), R = CELL * p[2] * r;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(f[0], f[1], R, R * .45, 0, 0, 6.283); ctx.fill();
  const g = ctx.createRadialGradient(p[0] - R * .35, p[1] - R * .4, R * .1, p[0], p[1], R); g.addColorStop(0, '#fff'); g.addColorStop(.35, c1); g.addColorStop(1, c2);
  ctx.shadowColor = c1; ctx.shadowBlur = 10; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], R, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; return [p[0], p[1], R];
}
function drawBoard() {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0f45'); bg.addColorStop(1, '#0a0620'); ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) quad(P(x, y, 0), P(x + 1, y, 0), P(x + 1, y + 1, 0), P(x, y + 1, 0), (x + y) % 2 ? 'rgba(124,92,255,.22)' : 'rgba(41,227,208,.10)');
  const wall = (a, b, c, d) => quad(P(a[0], a[1], 0), P(b[0], b[1], 0), P(c[0], c[1], .45), P(d[0], d[1], .45), 'rgba(255,79,163,.35)');
  wall([0, 0], [0, N], [0, N], [0, 0]); wall([N, 0], [N, N], [N, N], [N, 0]); wall([0, 0], [N, 0], [N, 0], [0, 0]);
  ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = 2; ctx.shadowColor = '#ff4fa3'; ctx.shadowBlur = 10; ctx.beginPath(); const a = P(0, N, .45), b = P(0, 0, .45), c = P(N, 0, .45), d = P(N, N, .45); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); ctx.shadowBlur = 0;
}
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0; ctx.save(); ctx.translate(sx, sy); drawBoard();
  const items = [], al = Math.min(1, acc / step());
  rocks.forEach(r => items.push({y: r.y + .5, f: () => { const b = P(r.x + .5, r.y + .5, 0), t = P(r.x + .5, r.y + .5, 1.1), w = CELL * b[2] * .42; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b[0], b[1], w, w * .45, 0, 0, 6.283); ctx.fill();
    const g = ctx.createLinearGradient(0, t[1], 0, b[1]); g.addColorStop(0, '#ffb3dc'); g.addColorStop(1, '#8a1d56'); ctx.fillStyle = g; ctx.shadowColor = '#ff4fa3'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(t[0], t[1]); ctx.lineTo(b[0] + w, b[1]); ctx.lineTo(b[0] - w, b[1]); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; } }));
  const gem = (o, c1, c2, big) => items.push({y: o.y + .5, f: () => { const z = .55 + Math.sin(tt * 4) * .08, f = P(o.x + .5, o.y + .5, 0), p = P(o.x + .5, o.y + .5, z), R = CELL * p[2] * (big ? .42 : .34);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(f[0], f[1], R * .8, R * .35, 0, 0, 6.283); ctx.fill(); ctx.shadowColor = c1; ctx.shadowBlur = 18; const g = ctx.createLinearGradient(0, p[1] - R, 0, p[1] + R); g.addColorStop(0, '#fff'); g.addColorStop(.4, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p[0], p[1] - R * 1.2); ctx.lineTo(p[0] + R, p[1]); ctx.lineTo(p[0], p[1] + R * 1.2); ctx.lineTo(p[0] - R, p[1]); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; } });
  if (food) gem(food, '#29e3d0', '#0b6b72', false); if (bonus) gem(bonus, '#ffc94a', '#a0640a', true);
  const pts = segs.map((s, k) => { const p = prev[k] || prev[k - 1] || s; return {x: p.x + (s.x - p.x) * (mode === 'play' ? al : 1), y: p.y + (s.y - p.y) * (mode === 'play' ? al : 1)}; });
  for (let k = pts.length - 1; k >= 0; k--) {
    const q = pts[k], t = k / Math.max(1, pts.length - 1), c1 = `hsl(${170 + t * 130},90%,60%)`, c2 = `hsl(${170 + t * 130},80%,28%)`;
    if (k < pts.length - 1) { const n = pts[k + 1]; items.push({y: (q.y + n.y) / 2 + .5, f: () => sphere((q.x + n.x) / 2 + .5, (q.y + n.y) / 2 + .5, .45, .36, c1, c2)}); }
    items.push({y: q.y + .5 + (k === 0 ? .01 : 0), f: () => { const r = sphere(q.x + .5, q.y + .5, .45, k === 0 ? .46 : .4 - t * .06, c1, c2); if (k === 0) { const R = r[2];
      for (const sd of [-1, 1]) { const ex = r[0] + (dir.x * .42 - dir.y * .38 * sd) * R, ey = r[1] + (dir.y * .3 + dir.x * .3 * sd) * R * .8 - R * .12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, R * .24, 0, 6.283); ctx.fill(); ctx.fillStyle = '#0a0620'; ctx.beginPath(); ctx.arc(ex + dir.x * R * .07, ey + dir.y * R * .05, R * .12, 0, 6.283); ctx.fill(); } } }});
  }
  items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  parts.forEach(p => { const q = P(p.x, p.y, Math.max(0, p.z)); ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(q[0], q[1], 3 * q[2], 3 * q[2]); }); ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = '800 20px system-ui,sans-serif'; pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillText(p.t, p.x, p.y); }); ctx.globalAlpha = 1; ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = level; $('lives').textContent = segs.length;
}
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), d = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return; cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d); ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// ===== UI =====
function showOv(t, s, b) { $('ovT').textContent = t; $('ovS').textContent = s; $('ovSc').textContent = score; $('ovB').textContent = best; $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume(); if (mode !== 'pause') reset(); mode = 'play'; $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; showOv('Paused', 'Catch your breath.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
addEventListener('keydown', e => {
  const k = e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  const l = k.toLowerCase(); if (k === 'ArrowLeft' || l === 'a') turn(-1, 0); else if (k === 'ArrowRight' || l === 'd') turn(1, 0); else if (k === 'ArrowUp' || l === 'w') turn(0, -1); else if (k === 'ArrowDown' || l === 's') turn(0, 1);
});
cv.addEventListener('pointerdown', e => { swipe = {x: e.clientX, y: e.clientY}; });
cv.addEventListener('pointermove', e => { if (!swipe) return; const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; if (Math.hypot(dx, dy) > 22) { Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy)); swipe = {x: e.clientX, y: e.clientY}; } });
addEventListener('pointerup', () => { swipe = null; });
[['bl', -1, 0], ['br', 1, 0], ['bu', 0, -1], ['bdn', 0, 1]].forEach(([id, x, y]) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); turn(x, y); }));
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t; if (mode === 'play') update(dt); else if (mode === 'over') fx(dt);
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Neon Viper 3D', 'Glide through the neon arena, eat gems and avoid crystals, walls and your own tail.', 'Play');
requestAnimationFrame(loop);
})();
