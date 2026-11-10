/* Prism Rush - 5-lane neon dodger. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const W = 300, H = 520, LANES = 5, LW = W / LANES, PY = H - 90, KEY = 'prism-rush-best', MKEY = 'prism-rush-mute';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let ents, parts, pops, score, shown, best = 0, level, mode = 'start', lane, px, lives, shield, inv, combo, spawnT, time, shake, off, last = 0, muted = false, ac = null;
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
const laneX = l => l * LW + LW / 2;
function beep(f, d, type = 'sine', v = .08) {
  if (muted || !ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 1.5), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) {}
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(40, 200); parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .8), c}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
// ===== game logic =====
function reset() {
  ents = []; parts = []; pops = []; score = 0; shown = 0; level = 1; lane = 2; px = laneX(2); lives = 3; shield = false; inv = 0; combo = 0; spawnT = .5; time = 0; shake = 0; off = 0;
}
function move(d) { if (mode === 'play') { lane = Math.max(0, Math.min(LANES - 1, lane + d)); beep(400, .05, 'triangle', .04); } }
function spawnRow() {
  const safe = Math.floor(Math.random() * LANES), p = Math.min(.7, .3 + level * .05);
  for (let l = 0; l < LANES; l++) {
    if (l !== safe && Math.random() < p) ents.push({t: 'h', l, y: -30});
    else if (l === safe) { const r = Math.random(); if (r < .65) ents.push({t: 'g', l, y: -30}); else if (r < .7 && !shield) ents.push({t: 's', l, y: -30}); }
  }
}
function hit() {
  if (inv > 0) return;
  combo = 0; shake = 12; inv = 1.4; burst(px, PY, '#ff4fa3', 24);
  if (shield) { shield = false; pop('Shield broke!', W / 2, 200, '#ffc94a'); beep(200, .3, 'square', .06); return; }
  lives--; beep(120, .4, 'sawtooth', .08); pop('Ouch!', W / 2, 200, '#ff4fa3');
  if (lives <= 0) end();
}
function update(dt) {
  time += dt; px += (laneX(lane) - px) * Math.min(1, dt * 18); inv = Math.max(0, inv - dt); shake = Math.max(0, shake - dt * 30);
  const nl = 1 + Math.floor(time / 12); if (nl > level) { level = nl; pop('Level ' + level, W / 2, 170, '#ff4fa3'); beep(660, .3, 'square', .05); }
  const v = Math.min(520, 200 + level * 30); off = (off + v * dt) % 40; score += dt * 5 * level;
  spawnT -= dt; if (spawnT <= 0) { spawnRow(); spawnT = Math.max(.3, .8 - level * .045) * 200 / v * 1.4; }
  for (const e of ents) {
    e.y += v * dt;
    if (Math.abs(e.y - PY) < 26 && Math.abs(laneX(e.l) - px) < LW * .4 && !e.done) {
      e.done = true;
      if (e.t === 'h') hit();
      else if (e.t === 'g') { combo++; const p = 10 * Math.min(combo, 10); score += p; burst(laneX(e.l), PY, '#29e3d0', 10); pop('+' + p, laneX(e.l), PY - 30, '#29e3d0'); beep(600 + Math.min(combo, 10) * 50, .12, 'sine', .08); if (combo >= 3 && combo % 3 === 0) pop('Combo x' + combo + '!', W / 2, 140, '#ffc94a'); }
      else { shield = true; pop('Shield!', W / 2, 200, '#ffc94a'); beep(800, .25, 'triangle', .08); }
    }
  }
  ents = ents.filter(e => e.y < H + 40 && !(e.done && e.t !== 'h'));
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 30 * dt; p.life -= dt * .9; }); pops = pops.filter(p => p.life > 0);
  if (Math.random() < dt * 40) parts.push({x: px + rnd(-6, 6), y: PY + 22, vx: rnd(-20, 20), vy: rnd(60, 140), life: .35, c: '#7c5cff'});
}
function end() {
  mode = 'over'; score = Math.floor(score);
  if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Game Over', score >= best && score > 0 ? 'New best score!' : 'The crystals got you.', 'Play Again');
}
// ===== rendering =====
function grad(x0, y0, x1, y1, a, b) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function drawEnt(e) {
  const x = laneX(e.l), y = e.y; ctx.save(); ctx.translate(x, y);
  if (e.t === 'h') {
    ctx.shadowColor = '#ff4fa3'; ctx.shadowBlur = 16; ctx.fillStyle = grad(0, -24, 0, 24, '#ff7ac0', '#7c1d6f');
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(24, 0); ctx.lineTo(0, 26); ctx.lineTo(-24, 0); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-24, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  } else if (e.t === 'g') {
    ctx.shadowColor = '#29e3d0'; ctx.shadowBlur = 14; ctx.fillStyle = grad(0, -14, 0, 14, '#bffff6', '#16a89a');
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(11, -3); ctx.lineTo(0, 15); ctx.lineTo(-11, -3); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = '#ffc94a'; ctx.shadowBlur = 16; ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(255,201,74,.35)'; ctx.fill();
  }
  ctx.restore();
}
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0;
  ctx.save(); ctx.translate(sx, sy);
  ctx.fillStyle = grad(0, 0, 0, H, '#1a0f45', '#0d0830'); ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.strokeStyle = 'rgba(124,92,255,.25)'; ctx.lineWidth = 1;
  for (let l = 1; l < LANES; l++) { ctx.beginPath(); ctx.moveTo(l * LW, 0); ctx.lineTo(l * LW, H); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(41,227,208,.12)'; for (let y = -40 + off; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ents.forEach(drawEnt);
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.283); ctx.fill(); });
  ctx.globalAlpha = 1;
  if (mode !== 'over' && !(inv > 0 && Math.floor(performance.now() / 90) % 2)) {
    ctx.save(); ctx.translate(px, PY); ctx.shadowColor = '#29e3d0'; ctx.shadowBlur = 18; ctx.fillStyle = grad(0, -24, 0, 22, '#29e3d0', '#7c5cff');
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(18, 20); ctx.lineTo(0, 11); ctx.lineTo(-18, 20); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
    if (shield) { ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 32, 0, 6.283); ctx.stroke(); }
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.font = '800 22px system-ui,sans-serif';
  pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillText(p.t, p.x, p.y); });
  ctx.globalAlpha = 1; ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, Math.floor(score)); $('level').textContent = level;
  $('lives').textContent = '❤'.repeat(Math.max(0, lives)) || '–';
}
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), d = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return;
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// ===== UI =====
function showOv(t, s, b) { $('ovT').textContent = t; $('ovS').textContent = s; $('ovSc').textContent = Math.floor(score); $('ovB').textContent = best; $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
  if (mode !== 'pause') reset();
  mode = 'play'; $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; showOv('Paused', 'Take a breath.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); move((e.clientX - r.left) / r.width < .5 ? -1 : 1); });
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (e.repeat) return;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1); if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
});
$('bl').addEventListener('pointerdown', e => { e.preventDefault(); move(-1); });
$('br').addEventListener('pointerdown', e => { e.preventDefault(); move(1); });
$('playBtn').onclick = start; $('pauseBtn').onclick = pause;
$('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Prism Rush', 'Dodge the crystals, grab gems, chain combos!', 'Play');
requestAnimationFrame(loop);
})();
