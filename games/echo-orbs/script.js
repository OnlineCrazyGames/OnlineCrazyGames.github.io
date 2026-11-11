/* Echo Orbs - memory sequence game. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const W = 300, H = 320, OY = 40, CS = 90, KEY = 'echo-orbs-best', MKEY = 'echo-orbs-mute';
const COL = ['#ff4fa3', '#7c5cff', '#29e3d0', '#ffc94a', '#ff8a3d', '#5aa9ff', '#9be15d', '#e86bff', '#ff6b6b'];
const NOTE = [262, 294, 330, 392, 440, 523, 587, 659, 784];
const ORDER = [4, 0, 8, 2, 6, 1, 7, 3, 5];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let seq, phase, st, sidx, ipos, tmr, lit, litT, score, shown, best = 0, level, lives, peeks, combo, mult, parts, pops, shake, wait, mode = 'start', last = 0, muted = false, ac = null;
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
const active = () => ORDER.slice(0, Math.min(9, 3 + Math.floor(level / 3)));
const speed = () => Math.max(.28, .7 - level * .025);
function beep(f, d, type = 'sine', v = .09) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
const pos = i => ({x: (i % 3) * CS + CS / 2, y: OY + Math.floor(i / 3) * CS + CS / 2});
function burst(i, n) { const p = pos(i); for (let k = 0; k < n; k++) { const a = rnd(0, 6.28), s = rnd(40, 160); parts.push({x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c: COL[i]}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
function flashOrb(i, d) { lit = i; litT = d; beep(NOTE[i], d, 'sine'); }
// ===== game logic =====
function reset() {
  level = 1; lives = 3; peeks = 2; score = 0; shown = 0; combo = 0; mult = 1; parts = []; pops = []; shake = 0; lit = -1; litT = 0;
  seq = []; const a = active(); for (let i = 0; i < 3; i++) seq.push(a[Math.floor(Math.random() * a.length)]);
  beginShow();
}
function beginShow() { phase = 'ready'; wait = .9; sidx = 0; st = 0; }
function press(i) {
  if (mode !== 'play' || phase !== 'input' || !active().includes(i)) return;
  if (i === seq[ipos]) {
    const fast = Math.max(0, Math.round(tmr * 2)), p = (10 + fast) * mult; score += p; combo++; const nm = Math.min(5, 1 + Math.floor(combo / 10));
    if (nm > mult) pop('Combo x' + nm + '!', W / 2, 24, '#29e3d0'); mult = nm; flashOrb(i, .25); burst(i, 8); pop('+' + p, pos(i).x, pos(i).y - 30, '#29e3d0'); ipos++; tmr = 5;
    if (ipos >= seq.length) {
      const b = 50 * level; score += b; level++; pop('Level ' + level + '! +' + b, W / 2, 24, '#ff4fa3'); beep(880, .3, 'triangle', .07);
      if (level % 5 === 0) { peeks++; pop('+1 Peek', W / 2, 60, '#ffc94a'); }
      const a = active(); seq.push(a[Math.floor(Math.random() * a.length)]); phase = 'ready'; wait = 1.1; sidx = 0; st = 0;
    }
  } else miss('Wrong!');
}
function miss(msg) {
  lives--; combo = 0; mult = 1; shake = 10; pop(msg, W / 2, 24, '#ff4fa3'); beep(110, .5, 'sawtooth', .08);
  if (lives <= 0) { end(); return; } beginShow(); wait = 1.2;
}
function peek() { if (mode === 'play' && phase === 'input' && peeks > 0) { peeks--; pop('Peek!', W / 2, 24, '#ffc94a'); beginShow(); } }
function update(dt) {
  shake = Math.max(0, shake - dt * 30); litT -= dt; if (litT <= 0) lit = -1;
  if (phase === 'ready') { wait -= dt; if (wait <= 0) { phase = 'show'; st = 0; sidx = 0; flashOrb(seq[0], speed() * .6); } }
  else if (phase === 'show') { st += dt; if (st >= speed()) { st = 0; sidx++; if (sidx >= seq.length) { phase = 'input'; ipos = 0; tmr = 5; } else flashOrb(seq[sidx], speed() * .6); } }
  else if (phase === 'input') { tmr -= dt; if (tmr <= 0) miss('Too slow!'); }
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 20 * dt; p.life -= dt * .8; }); pops = pops.filter(p => p.life > 0);
}
function end() {
  mode = 'over'; if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Game Over', score >= best && score > 0 ? 'New best score! Level ' + level : 'You reached level ' + level + '.', 'Play Again');
}
// ===== rendering =====
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0; ctx.save(); ctx.translate(sx, sy);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0f45'); bg.addColorStop(1, '#0d0830'); ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
  const act = active(); ctx.textAlign = 'center';
  ctx.fillStyle = '#b4abdc'; ctx.font = '700 12px system-ui'; ctx.fillText(phase === 'input' ? 'YOUR TURN  ' + ipos + '/' + seq.length : phase === 'show' ? 'WATCH…' : 'GET READY', W / 2, 40 - 8);
  if (phase === 'input') { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(20, 6, W - 40, 5); ctx.fillStyle = tmr < 1.5 ? '#ff4fa3' : '#29e3d0'; ctx.fillRect(20, 6, (W - 40) * Math.max(0, tmr / 5), 5); }
  for (let i = 0; i < 9; i++) {
    const p = pos(i), on = act.includes(i), l = lit === i, R = (l ? 40 : 34) + (l ? 0 : Math.sin(performance.now() / 600 + i) * 0.8);
    ctx.save(); ctx.translate(p.x, p.y);
    if (!on) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 6.283); ctx.fill(); ctx.restore(); continue; }
    ctx.shadowColor = COL[i]; ctx.shadowBlur = l ? 40 : 8; const g = ctx.createRadialGradient(-R * .3, -R * .35, 2, 0, 0, R);
    g.addColorStop(0, l ? '#fff' : 'rgba(255,255,255,.55)'); g.addColorStop(.45, l ? COL[i] : COL[i] + '99'); g.addColorStop(1, l ? COL[i] : 'rgba(20,10,60,.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = l ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = l ? 3 : 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '700 11px system-ui'; ctx.fillText(i + 1, 0, R - 8); ctx.restore();
  }
  parts.forEach(q => { ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); }); ctx.globalAlpha = 1;
  ctx.font = '800 18px system-ui'; pops.forEach(q => { ctx.globalAlpha = Math.min(1, q.life * 1.5); ctx.fillStyle = q.c; ctx.fillText(q.t, q.x, q.y); }); ctx.globalAlpha = 1; ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = level; $('lives').textContent = '❤'.repeat(Math.max(0, lives)) + ' 👁' + peeks;
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
function pause() { if (mode === 'play') { mode = 'pause'; showOv('Paused', 'Your sequence is safe.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = ((e.clientY - r.top) / r.height * H) - OY; if (y < 0) return; press(Math.floor(y / CS) * 3 + Math.floor(x / CS)); });
addEventListener('keydown', e => {
  const k = e.key; if (k === ' ') e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (k >= '1' && k <= '9') press(+k - 1); else if (k === 'h' || k === 'H') peek();
});
$('bd').addEventListener('pointerdown', e => { e.preventDefault(); peek(); });
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Echo Orbs', 'Watch the orbs light up, then repeat the sequence from memory.', 'Play');
requestAnimationFrame(loop);
})();
