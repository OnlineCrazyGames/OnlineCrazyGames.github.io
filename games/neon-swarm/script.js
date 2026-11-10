/* Neon Swarm - wave-based arcade shooter. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const W = 360, H = 520, KEY = 'neon-swarm-best', MKEY = 'neon-swarm-mute';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let sh, bul, eb, en, pk, parts, pops, queue, wave, score, shown, best = 0, lives, wl, rapid, bombs, combo, comboT, mult, shake, flash, fireT, restT, wt, mode = 'start', last = 0, muted = false, ac = null, ptr = null, keys = {}, stars = [];
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
for (let i = 0; i < 50; i++) stars.push([Math.random() * W, Math.random() * H, Math.random() * 1.6 + .3]);
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
function beep(f, d, type = 'sine', v = .05) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * .6), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(40, 220); parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .8), c}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
// ===== game logic =====
function reset() {
  sh = {x: W / 2, y: H - 70, inv: 1, sd: false}; bul = []; eb = []; en = []; pk = []; parts = []; pops = []; queue = [];
  wave = 0; score = 0; shown = 0; lives = 3; wl = 1; rapid = 0; bombs = 1; combo = 0; comboT = 0; mult = 1; shake = 0; flash = 0; fireT = 0; restT = 1; wt = 0;
}
function nextWave() {
  wave++; pop('Wave ' + wave, W / 2, 180, '#ff4fa3'); beep(500, .3, 'square', .04); queue = [];
  if (wave % 5 === 0) queue.push({t: 'boss', at: .5});
  const n = 5 + wave * 2;
  for (let i = 0; i < n; i++) { const r = Math.random(); queue.push({t: wave > 2 && r < .2 ? 'diver' : wave > 1 && r < .45 ? 'shooter' : 'drone', at: 1 + i * Math.max(.3, .7 - wave * .03)}); }
  wt = 0;
}
function spawn(t) {
  const x = rnd(30, W - 30), s = 1 + wave * .04;
  if (t === 'drone') en.push({t, x, y: -20, x0: x, hp: 1, r: 14, v: 70 * s, ph: rnd(0, 6), pts: 10});
  else if (t === 'shooter') en.push({t, x, y: -20, hp: 2, r: 15, v: 60, ty: rnd(70, 170), dir: Math.random() < .5 ? -1 : 1, f: rnd(1, 2), pts: 25});
  else if (t === 'diver') en.push({t, x, y: -20, hp: 1, r: 13, v: 150 * s, pts: 20});
  else en.push({t, x: W / 2, y: -50, hp: 30 + wave * 6, hp0: 30 + wave * 6, r: 40, dir: 1, f: 1.5, ty: 100, pts: 500});
}
function shoot() {
  const p = [[0], [-6, 6], [-10, 0, 10], [-16, -6, 6, 16]][Math.min(wl, 4) - 1 > 2 ? 3 : wl - 1];
  p.forEach(o => bul.push({x: sh.x + o, y: sh.y - 16, vx: o * 9, vy: -540}));
  beep(700, .06, 'square', .02);
}
function kill(e) {
  e.hp = -1; comboT = 2; combo++; const m = Math.min(5, 1 + Math.floor(combo / 6));
  if (m > mult) pop('Combo x' + m + '!', W / 2, 140, '#29e3d0'); mult = m;
  const p = e.pts * mult; score += p; pop('+' + p, e.x, e.y - 14, '#29e3d0');
  burst(e.x, e.y, e.t === 'boss' ? '#ffc94a' : '#ff4fa3', e.t === 'boss' ? 50 : 12); shake = e.t === 'boss' ? 14 : 3; beep(220, .2, 'sawtooth', .05);
  if (e.t === 'boss' || Math.random() < .13) pk.push({x: e.x, y: e.y, k: e.t === 'boss' ? 'w' : 'wrsb'[Math.floor(rnd(0, 4))]});
}
function hurt() {
  if (sh.inv > 0) return; sh.inv = 1.5; shake = 12; burst(sh.x, sh.y, '#29e3d0', 24); eb = [];
  if (sh.sd) { sh.sd = false; pop('Shield!', W / 2, 220, '#ffc94a'); beep(200, .3, 'square', .06); return; }
  lives--; wl = Math.max(1, wl - 1); combo = 0; mult = 1; beep(100, .5, 'sawtooth', .08); if (lives <= 0) end();
}
function bomb() {
  if (mode !== 'play' || bombs < 1) return; bombs--; eb = []; flash = 1; shake = 14; beep(80, .6, 'sawtooth', .09);
  en.forEach(e => { e.hp -= 6; if (e.hp <= 0 && e.hp > -1) kill(e); });
}
function update(dt) {
  wt += dt; sh.inv = Math.max(0, sh.inv - dt); rapid = Math.max(0, rapid - dt); shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt * 2);
  comboT -= dt; if (comboT <= 0) { combo = 0; mult = 1; }
  const kx = (keys.ArrowRight || keys.d) - (keys.ArrowLeft || keys.a), ky = (keys.ArrowDown || keys.s) - (keys.ArrowUp || keys.w);
  if (kx || ky) { ptr = null; sh.x += kx * 290 * dt; sh.y += ky * 290 * dt; } else if (ptr) { sh.x += (ptr.x - sh.x) * Math.min(1, dt * 14); sh.y += (ptr.y - sh.y) * Math.min(1, dt * 14); }
  sh.x = Math.max(16, Math.min(W - 16, sh.x)); sh.y = Math.max(60, Math.min(H - 24, sh.y));
  fireT -= dt; if (fireT <= 0) { shoot(); fireT = rapid > 0 ? .11 : .22; }
  while (queue.length && queue[0].at <= wt) spawn(queue.shift().t);
  if (!queue.length && !en.length) { restT -= dt; if (restT <= 0) { nextWave(); restT = 2; } } else restT = 2;
  bul.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; }); bul = bul.filter(b => b.y > -10);
  eb.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; if (near(b, sh, 12)) { b.y = 9999; hurt(); } }); eb = eb.filter(b => b.y < H + 10 && b.x > -10 && b.x < W + 10);
  for (const e of en) {
    if (e.t === 'drone') { e.y += e.v * dt; e.ph += dt * 3; e.x = e.x0 + Math.sin(e.ph) * 40; }
    else if (e.t === 'diver') { e.y += e.v * dt; e.x += Math.sign(sh.x - e.x) * 50 * dt; }
    else { if (e.y < e.ty) e.y += 60 * dt; else { e.x += e.dir * (e.t === 'boss' ? 70 : 50) * dt; if (e.x < 30 || e.x > W - 30) e.dir *= -1; }
      e.f -= dt; if (e.f <= 0 && e.y >= e.ty - 5) { e.f = e.t === 'boss' ? 1.1 : Math.max(.9, 2 - wave * .08);
        if (e.t === 'boss') for (let i = -3; i <= 3; i++) eb.push({x: e.x, y: e.y + 30, vx: i * 45, vy: 170});
        else { const a = Math.atan2(sh.y - e.y, sh.x - e.x); eb.push({x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170}); } } }
    for (const b of bul) if (b.y > -9 && near(b, e, e.r + 4)) { b.y = -99; e.hp--; burst(b.x, b.y + 99, '#fff', 2); if (e.hp === 0) kill(e); }
    if (e.hp > 0 && near(e, sh, e.r + 10)) { if (e.t !== 'boss') { e.hp = 0; kill(e); } hurt(); }
  }
  en = en.filter(e => e.hp > 0 && e.y < H + 40);
  pk.forEach(p => { p.y += 80 * dt; if (near(p, sh, 24)) { p.y = 9999; beep(880, .2, 'triangle', .06);
    if (p.k === 'w') { wl = Math.min(4, wl + 1); pop('Weapon up!', sh.x, sh.y - 30); } else if (p.k === 'r') { rapid = 8; pop('Rapid fire!', sh.x, sh.y - 30, '#29e3d0'); } else if (p.k === 's') { sh.sd = true; pop('Shield!', sh.x, sh.y - 30, '#7c5cff'); } else { bombs = Math.min(3, bombs + 1); pop('+Bomb', sh.x, sh.y - 30, '#ff4fa3'); } } });
  pk = pk.filter(p => p.y < H + 20);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 30 * dt; p.life -= dt * .9; }); pops = pops.filter(p => p.life > 0);
}
function end() {
  mode = 'over'; if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Game Over', score >= best && score > 0 ? 'New best score!' : 'You reached wave ' + wave + '.', 'Play Again');
}
// ===== rendering =====
function lg(y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
function glow(c, b) { ctx.shadowColor = c; ctx.shadowBlur = b; }
function drawEnemy(e) {
  ctx.save(); ctx.translate(e.x, e.y); glow(e.t === 'diver' ? '#ffc94a' : e.t === 'shooter' ? '#7c5cff' : '#ff4fa3', 14);
  if (e.t === 'diver') { ctx.fillStyle = lg(-14, 14, '#ffe08a', '#c27a00'); ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(14, -12); ctx.lineTo(-14, -12); ctx.fill(); }
  else { const r = e.r; ctx.fillStyle = lg(-r, r, e.t === 'shooter' ? '#a48cff' : '#ff8ac4', e.t === 'shooter' ? '#35208a' : '#8a1d56'); ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(r, r * .5); ctx.lineTo(-r, r * .5); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * .3, 0, r * .18, 0, 6.283); ctx.arc(r * .3, 0, r * .18, 0, 6.283); ctx.fill(); }
  ctx.restore();
  if (e.t === 'boss') { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(60, 40, W - 120, 6); ctx.fillStyle = '#ff4fa3'; ctx.fillRect(60, 40, (W - 120) * Math.max(0, e.hp / e.hp0), 6); }
}
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0;
  ctx.save(); ctx.translate(sx, sy); ctx.fillStyle = lg(0, H, '#1a0f45', '#0a0620'); ctx.fillRect(-20, -20, W + 40, H + 40);
  const tt = performance.now() / 1000; ctx.fillStyle = 'rgba(255,255,255,.55)'; stars.forEach(s => ctx.fillRect(s[0], (s[1] + tt * 30 * s[2]) % H, s[2], s[2]));
  pk.forEach(p => { glow('#ffc94a', 12); ctx.fillStyle = {w: '#ffc94a', r: '#29e3d0', s: '#7c5cff', b: '#ff4fa3'}[p.k]; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#0a0620'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.k.toUpperCase(), p.x, p.y + 4); });
  en.forEach(drawEnemy);
  glow('#29e3d0', 10); ctx.fillStyle = '#b9fff6'; bul.forEach(b => ctx.fillRect(b.x - 2, b.y - 8, 4, 14));
  glow('#ff4fa3', 10); ctx.fillStyle = '#ff8ac4'; eb.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 6.283); ctx.fill(); }); ctx.shadowBlur = 0;
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
  if (mode !== 'over' && !(sh.inv > 0 && Math.floor(performance.now() / 90) % 2)) {
    ctx.save(); ctx.translate(sh.x, sh.y); glow('#29e3d0', 18); ctx.fillStyle = lg(-18, 18, '#29e3d0', '#7c5cff');
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, 16); ctx.lineTo(0, 8); ctx.lineTo(-16, 16); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(0, 20 + Math.random() * 8); ctx.lineTo(5, 12); ctx.fill();
    if (sh.sd) { ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.283); ctx.stroke(); } ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.font = '800 22px system-ui,sans-serif'; pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillText(p.t, p.x, p.y); });
  ctx.globalAlpha = 1; if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * .6})`; ctx.fillRect(-20, -20, W + 40, H + 40); } ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = Math.max(1, wave);
  $('lives').textContent = '❤'.repeat(Math.max(0, lives)) + ' 💣' + bombs;
}
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), d = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return; cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d); ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// ===== UI =====
function showOv(t, s, b) { $('ovT').textContent = t; $('ovS').textContent = s; $('ovSc').textContent = score; $('ovB').textContent = best; $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
  if (mode !== 'pause') reset(); mode = 'play'; keys = {}; $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; keys = {}; showOv('Paused', 'Take a breath.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
function aim(e) { const r = cv.getBoundingClientRect(); ptr = {x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H - (e.pointerType === 'touch' ? 50 : 0)}; }
cv.addEventListener('pointermove', e => { if (mode === 'play') aim(e); }); cv.addEventListener('pointerdown', e => { if (mode === 'play') aim(e); });
addEventListener('keydown', e => {
  const k = e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (k === ' ' && !e.repeat) bomb(); keys[k.length === 1 ? k.toLowerCase() : k] = 1;
});
addEventListener('keyup', e => { delete keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]; });
$('bd').addEventListener('pointerdown', e => { e.preventDefault(); bomb(); });
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Neon Swarm', 'Blast the swarm. Grab power-ups. Beat the bosses!', 'Play');
requestAnimationFrame(loop);
})();
