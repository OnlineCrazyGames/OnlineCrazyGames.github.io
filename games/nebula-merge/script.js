/* Nebula Merge - physics orb-fusion game. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const W = 360, H = 520, LINE = 96, G = 1500, MAXL = 9, KEY = 'nebula-merge-best', MKEY = 'nebula-merge-mute';
const HUES = [340, 20, 45, 130, 170, 195, 225, 265, 295, 48];
const rad = l => 14 + l * 7;
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), nxc = $('nx').getContext('2d');
// ===== state =====
let orbs, parts, pops, score, shown, best = 0, level, mode = 'start', cur, nextL, cd, shake, combo, comboT, overT, aimX = W / 2, muted = false, last = 0, held = {l: 0, r: 0}, ac = null, stars = [];
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
for (let i = 0; i < 40; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.5 + .3]);
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = () => Math.floor(Math.random() * (Math.min(4, Math.floor((level - 1) / 2) + 1) + 1));
function beep(f, d, type = 'sine', v = .08) {
  if (muted || !ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
function burst(x, y, h, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(40, 220); parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.4, .9), h, max: .9}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
// ===== game logic =====
function reset() {
  orbs = []; parts = []; pops = []; score = 0; shown = 0; level = 1; cd = 0; shake = 0; combo = 0; comboT = 0; overT = 0;
  nextL = pick(); spawnCur();
}
function spawnCur() { cur = {l: nextL, x: aimX}; nextL = pick(); drawNext(); }
function drop() {
  if (mode !== 'play' || !cur || cd > 0) return;
  const r = rad(cur.l);
  orbs.push({x: Math.max(r, Math.min(W - r, cur.x)), y: LINE - 40, vx: 0, vy: 0, l: cur.l, r, age: 0, s: 1, dead: false});
  beep(300, .1, 'triangle'); cur = null; cd = .5;
}
function merge(a, b) {
  a.dead = b.dead = true;
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, l = a.l + 1;
  comboT > 0 ? combo++ : combo = 1; comboT = 1.3;
  const pts = (a.l + 1) * (a.l + 2) * 2 * combo;
  score += l > MAXL ? 1000 : pts;
  burst(x, y, HUES[a.l], 12 + a.l * 3); shake = Math.min(10, 2 + a.l);
  pop('+' + (l > MAXL ? 1000 : pts), x, y - a.r);
  if (combo > 1) pop('Combo x' + combo + '!', W / 2, 150 + combo * 4, '#29e3d0');
  beep(260 + a.l * 55 + combo * 20, .22, 'sine', .1);
  if (l > MAXL) { pop('SUPERNOVA!', W / 2, 220, '#ff4fa3'); burst(x, y, 48, 60); shake = 14; return; }
  orbs.push({x, y, vx: 0, vy: 0, l, r: rad(l), age: 0, s: .6, dead: false});
  const nl = 1 + Math.floor(score / 500);
  if (nl > level) { level = nl; pop('Level ' + level, W / 2, 180, '#ff4fa3'); beep(660, .3, 'square', .05); }
}
function physics(h) {
  for (const o of orbs) {
    o.vy += G * h; o.x += o.vx * h; o.y += o.vy * h; o.vx *= .997; o.age += h; if (o.s < 1) o.s = Math.min(1, o.s + h * 4);
    if (o.x < o.r) { o.x = o.r; o.vx *= -.3; } if (o.x > W - o.r) { o.x = W - o.r; o.vx *= -.3; }
    if (o.y > H - o.r) { o.y = H - o.r; o.vy *= -.15; o.vx *= .92; }
  }
  const todo = [];
  for (let i = 0; i < orbs.length; i++) for (let j = i + 1; j < orbs.length; j++) {
    const a = orbs[i], b = orbs[j]; if (a.dead || b.dead) continue;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, m = a.r + b.r;
    if (d >= m) continue;
    if (a.l === b.l && !todo.some(p => p[0] === a || p[1] === b || p[0] === b || p[1] === a)) { todo.push([a, b]); continue; }
    dx /= d; dy /= d; const ma = a.r * a.r, mb = b.r * b.r, o = m - d;
    a.x -= dx * o * mb / (ma + mb); a.y -= dy * o * mb / (ma + mb); b.x += dx * o * ma / (ma + mb); b.y += dy * o * ma / (ma + mb);
    const vn = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
    if (vn < 0) { const j2 = -1.15 * vn / (1 / ma + 1 / mb); a.vx -= j2 * dx / ma; a.vy -= j2 * dy / ma; b.vx += j2 * dx / mb; b.vy += j2 * dy / mb; }
  }
  for (const p of todo) merge(p[0], p[1]);
}
function update(dt) {
  if (cd > 0) { cd -= dt; if (cd <= 0 && !cur) spawnCur(); }
  if (cur) { cur.x += (held.r - held.l) * 260 * dt; cur.x = Math.max(rad(cur.l), Math.min(W - rad(cur.l), cur.x)); aimX = cur.x; }
  for (let k = 0; k < 3; k++) physics(dt / 3);
  orbs = orbs.filter(o => !o.dead); comboT -= dt; shake = Math.max(0, shake - dt * 30);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 30 * dt; p.life -= dt * .8; }); pops = pops.filter(p => p.life > 0);
  if (orbs.some(o => o.age > 1.2 && o.y - o.r < LINE)) overT += dt; else overT = Math.max(0, overT - dt);
  if (overT > 2.2) end();
}
function end() {
  mode = 'over'; beep(150, .6, 'sawtooth', .08);
  if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Game Over', score > 0 && score >= best ? 'New best score!' : 'The nebula overflowed.', 'Play Again');
}
// ===== rendering =====
function drawOrb(c, x, y, r, l, s = 1) {
  r *= s; const h = HUES[l], g = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  g.addColorStop(0, `hsl(${h},95%,85%)`); g.addColorStop(.55, `hsl(${h},85%,60%)`); g.addColorStop(1, `hsl(${h},80%,38%)`);
  c.shadowColor = `hsla(${h},100%,60%,.7)`; c.shadowBlur = r * .5; c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(20,10,50,.75)'; for (const sx of [-1, 1]) { c.beginPath(); c.arc(x + sx * r * .28, y + r * .1, r * .1, 0, 6.283); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x - r * .4, y - r * .5, r * .12, 0, 6.283); c.fill();
}
function drawNext() { nxc.clearRect(0, 0, 64, 64); drawOrb(nxc, 32, 32, 8 + nextL * 3.4, nextL); }
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0;
  ctx.save(); ctx.translate(sx, sy);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0f45'); bg.addColorStop(1, '#0d0830');
  ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; stars.forEach(s => ctx.fillRect(s[0], s[1], s[2], s[2]));
  const warn = overT > 0 && Math.floor(performance.now() / 150) % 2;
  ctx.setLineDash([8, 8]); ctx.strokeStyle = warn ? '#ff4fa3' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, LINE); ctx.lineTo(W, LINE); ctx.stroke(); ctx.setLineDash([]);
  if (cur && mode === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(cur.x, 50); ctx.lineTo(cur.x, H); ctx.stroke();
    drawOrb(ctx, cur.x, 44, rad(cur.l), cur.l);
  }
  orbs.forEach(o => drawOrb(ctx, o.x, o.y, o.r, o.l, o.s));
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = `hsl(${p.h},100%,70%)`; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.283); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = '800 22px system-ui,sans-serif';
  pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillText(p.t, p.x, p.y); });
  ctx.globalAlpha = 1; ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = level;
}
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), d = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return;
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// ===== UI =====
function showOv(t, s, b) { $('ovT').textContent = t; $('ovS').textContent = s; $('ovSc').textContent = score; $('ovB').textContent = best; $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
  if (mode === 'pause') { mode = 'play'; } else { reset(); mode = 'play'; }
  $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; held.l = held.r = 0; showOv('Paused', 'Take a breath.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
function aim(e) { const r = cv.getBoundingClientRect(); aimX = (e.clientX - r.left) / r.width * W; if (cur) cur.x = Math.max(rad(cur.l), Math.min(W - rad(cur.l), aimX)); }
cv.addEventListener('pointermove', e => { if (mode === 'play') aim(e); });
cv.addEventListener('pointerdown', e => { if (mode === 'play') aim(e); });
cv.addEventListener('pointerup', e => { if (mode === 'play') { aim(e); drop(); } });
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (k === 'ArrowLeft' || k === 'a') held.l = 1; if (k === 'ArrowRight' || k === 'd') held.r = 1;
  if ((k === ' ' || k === 'ArrowDown') && !e.repeat) drop();
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') held.l = 0; if (e.key === 'ArrowRight' || e.key === 'd') held.r = 0; });
const hold = (id, k) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); held[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => held[k] = 0)); };
hold('bl', 'l'); hold('br', 'r'); $('bd').addEventListener('pointerdown', e => { e.preventDefault(); drop(); });
$('playBtn').onclick = start; $('pauseBtn').onclick = () => mode === 'play' ? pause() : null;
$('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') { parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); }
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Nebula Merge', 'Fuse matching orbs. Chain combos. Reach the golden supernova!', 'Play');
requestAnimationFrame(loop);
})();
