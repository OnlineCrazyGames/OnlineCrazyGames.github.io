/* Star Forge - idle/incremental game with prestige. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const S = 300, SAVE = 'star-forge-save', KEY = 'star-forge-best', MKEY = 'star-forge-mute';
const GENS = [['Spark Drone', 15, .1], ['Dust Collector', 100, 1], ['Comet Miner', 1100, 8], ['Nova Forge', 12e3, 47], ['Pulsar Farm', 130e3, 260], ['Nebula Factory', 1.4e6, 1400], ['Quasar Core', 20e6, 7800], ['Galaxy Engine', 330e6, 44e3]];
const ACH = [[1e3, 't'], [1e5, 't'], [1e7, 't'], [1e9, 't'], [1e11, 't'], [1e13, 't'], [100, 'k'], [1000, 'k'], [10000, 'k']];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let d, mode = 'start', best = 0, muted = false, ac = null, last = 0, t = 0, comet = null, cometT = 40, frenzy = 0, floats = [], parts = [], pulse = 0, ascArm = 0, accUI = 0, saveT = 0, rows = [];
const fresh = () => ({sd: 0, run: 0, total: 0, gens: GENS.map(() => 0), touch: 0, boost: 0, light: 0, taps: 0, ach: 0, ts: Date.now()});
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
try { d = Object.assign(fresh(), JSON.parse(localStorage.getItem(SAVE))); if (d.gens.length !== GENS.length) d = fresh(); } catch (e) { d = fresh(); }
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
function fmt(n) { if (n < 1e3) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n) + ''; const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi']; let i = -1; while (n >= 1e3 && i < 5) { n /= 1e3; i++; } return n.toFixed(n < 10 ? 2 : 1) + u[i]; }
function beep(f, dur, type = 'sine', v = .06) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), g = ac.createGain(), x = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, x); o.frequency.exponentialRampToValueAtTime(f * 1.4, x + dur); g.gain.setValueAtTime(v, x); g.gain.exponentialRampToValueAtTime(.001, x + dur); o.connect(g); g.connect(ac.destination); o.start(x); o.stop(x + dur); } catch (e) {}
}
const cost = i => Math.floor(GENS[i][1] * Math.pow(1.15, d.gens[i]));
const mult = () => (1 + .05 * d.light) * (1 + .02 * d.ach) * Math.pow(2, d.boost) * (frenzy > 0 ? 7 : 1);
const cps = () => d.gens.reduce((s, n, i) => s + n * GENS[i][2], 0) * mult();
const clickVal = () => (1 + d.touch) * mult() + cps() * .02;
const touchCost = () => Math.floor(50 * Math.pow(2.6, d.touch)), boostCost = () => 5000 * Math.pow(20, d.boost);
const lightGain = () => Math.floor(Math.sqrt(d.run / 1e6));
function float(txt, x, y, c) { floats.push({txt, x, y, life: 1, c: c || '#ffc94a'}); }
function earn(n) { d.sd += n; d.run += n; d.total += n; if (d.run > best) { best = d.run; try { localStorage.setItem(KEY, best); } catch (e) {} } }
// ===== game logic =====
function tap(x, y) {
  if (mode !== 'play') return;
  if (comet && Math.hypot(x - comet.x, y - comet.y) < 34) { grab(); return; }
  const v = clickVal(); earn(v); d.taps++; pulse = 1; beep(500 + Math.random() * 200, .06, 'triangle', .04);
  float('+' + fmt(v), x + rnd(-20, 20), y - 10);
  for (let i = 0; i < 5; i++) { const a = rnd(0, 6.28); parts.push({x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: .5}); }
}
function grab() {
  comet = null; beep(900, .3, 'square', .05);
  if (Math.random() < .5) { const v = Math.max(100, cps() * 90); earn(v); float('Dust Rain +' + fmt(v), S / 2, 70, '#29e3d0'); }
  else { frenzy = 20; float('Frenzy x7!', S / 2, 70, '#ff4fa3'); }
}
function buy(i) {
  if (mode !== 'play') return; let c, ok = false;
  if (i < 8) { c = cost(i); if (d.sd >= c) { d.sd -= c; d.gens[i]++; ok = true; } }
  else if (i === 8) { c = touchCost(); if (d.sd >= c) { d.sd -= c; d.touch++; ok = true; } }
  else if (i === 9) { c = boostCost(); if (d.sd >= c) { d.sd -= c; d.boost++; ok = true; } }
  if (ok) { beep(440 + i * 40, .15, 'sine', .07); float(i < 8 ? GENS[i][0] + '!' : 'Upgraded!', S / 2, 250, '#7c5cff'); }
  else beep(120, .1, 'sawtooth', .03);
}
function ascend() {
  if (mode !== 'play' || lightGain() < 1) return;
  if (!ascArm) { ascArm = 3; return; }
  const g = lightGain(); d.light += g; Object.assign(d, {sd: 0, run: 0, gens: GENS.map(() => 0), touch: 0, boost: 0}); ascArm = 0;
  float('Ascended! +' + g + ' Light', S / 2, 120, '#ffc94a'); beep(300, .8, 'triangle', .08); save();
}
function checkAch() {
  let n = 0; for (const [v, k] of ACH) if ((k === 't' ? d.total : d.taps) >= v) n++;
  if (n > d.ach) { d.ach = n; float('Achievement ' + n + '/' + ACH.length + '!', S / 2, 95, '#ff4fa3'); beep(700, .4, 'triangle', .07); }
}
function update(dt) {
  earn(cps() * dt); checkAch(); t += dt; pulse = Math.max(0, pulse - dt * 4); frenzy = Math.max(0, frenzy - dt); ascArm = Math.max(0, ascArm - dt);
  cometT -= dt; if (cometT <= 0 && !comet) { comet = {x: -20, y: rnd(40, 200), vx: 40, vy: rnd(-5, 15), life: 9}; cometT = rnd(30, 60); }
  if (comet) { comet.x += comet.vx * dt; comet.y += comet.vy * dt; comet.life -= dt; if (comet.life <= 0 || comet.x > S + 20) comet = null; }
  floats.forEach(f => { f.y -= 35 * dt; f.life -= dt * .8; }); floats = floats.filter(f => f.life > 0);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  saveT += dt; if (saveT > 5) save();
}
function save() { saveT = 0; d.ts = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) {} }
// ===== rendering =====
function render() {
  const g = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * .75); g.addColorStop(0, '#241356'); g.addColorStop(1, '#0a0620');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 97 + t * (2 + i % 3)) % S, (i * 53) % S, 1.5, 1.5);
  const r = 62 + pulse * 8 + Math.sin(t * 2) * 2, a = frenzy > 0 ? '#ff4fa3' : '#ffc94a';
  ctx.save(); ctx.translate(S / 2, S / 2);
  for (let i = 0; i < Math.min(8, d.gens.reduce((s, n) => s + (n > 0), 0)); i++) { const an = t * (.4 + i * .1) + i * .8, or = 90 + i * 6; ctx.fillStyle = '#29e3d0'; ctx.beginPath(); ctx.arc(Math.cos(an) * or, Math.sin(an) * or * .45, 4, 0, 6.283); ctx.fill(); }
  const sg = ctx.createRadialGradient(-r * .3, -r * .3, 4, 0, 0, r); sg.addColorStop(0, '#fff6c9'); sg.addColorStop(.5, a); sg.addColorStop(1, '#b3541e');
  ctx.shadowColor = a; ctx.shadowBlur = 40; ctx.fillStyle = sg; ctx.beginPath();
  for (let i = 0; i < 16; i++) { const rr = i % 2 ? r * .78 : r; ctx.lineTo(Math.cos(i * .3927 + t * .3) * rr, Math.sin(i * .3927 + t * .3) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
  if (comet) { ctx.shadowColor = '#29e3d0'; ctx.shadowBlur = 20; ctx.fillStyle = '#bffff6'; ctx.beginPath(); ctx.arc(comet.x, comet.y, 12, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(41,227,208,.4)'; ctx.beginPath(); ctx.moveTo(comet.x, comet.y - 10); ctx.lineTo(comet.x - 50, comet.y); ctx.lineTo(comet.x, comet.y + 10); ctx.fill(); ctx.shadowBlur = 0; }
  ctx.textAlign = 'center'; ctx.font = '800 18px system-ui,sans-serif';
  floats.forEach(f => { ctx.globalAlpha = Math.min(1, f.life * 1.5); ctx.fillStyle = f.c; ctx.fillText(f.txt, f.x, f.y); }); ctx.globalAlpha = 1;
  if (frenzy > 0) { ctx.fillStyle = '#ff4fa3'; ctx.font = '700 13px system-ui'; ctx.fillText('FRENZY ' + Math.ceil(frenzy) + 's', S / 2, 24); }
}
function buildShop() {
  const sh = $('shop'); sh.textContent = '';
  const mk = (cls, fn) => { const b = document.createElement('button'); b.className = 'row ' + cls; b.onclick = fn; b.innerHTML = '<span></span><b></b>'; sh.appendChild(b); rows.push(b); };
  GENS.forEach((g, i) => mk('', () => buy(i))); mk('', () => buy(8)); mk('', () => buy(9)); mk('asc', ascend);
}
function hudRows() {
  GENS.forEach((g, i) => { const b = rows[i], c = cost(i); b.firstChild.innerHTML = (i + 1) + '. ' + g[0] + ' <em style="font-style:normal;color:#29e3d0">×' + d.gens[i] + '</em><small>' + fmt(g[2] * mult()) + '/s each</small>'; b.lastChild.textContent = fmt(c); b.classList.toggle('off', d.sd < c); b.classList.toggle('on', d.sd >= c); });
  const tc = touchCost(), bc = boostCost();
  rows[8].firstChild.innerHTML = 'Stellar Touch <em style="font-style:normal;color:#29e3d0">Lv' + d.touch + '</em><small>Stronger taps</small>'; rows[8].lastChild.textContent = fmt(tc); rows[8].classList.toggle('off', d.sd < tc);
  rows[9].firstChild.innerHTML = 'Cosmic Boost <em style="font-style:normal;color:#29e3d0">Lv' + d.boost + '</em><small>×2 all production</small>'; rows[9].lastChild.textContent = fmt(bc); rows[9].classList.toggle('off', d.sd < bc);
  const lg = lightGain(); rows[10].firstChild.innerHTML = ascArm ? 'Confirm Ascend?' : 'Ascend ✨<small>Reset for +' + lg + ' Light (+5% each)</small>'; rows[10].lastChild.textContent = lg < 1 ? 'need 1M' : '+' + lg; rows[10].classList.toggle('off', lg < 1);
}
function hud() { $('sd').textContent = fmt(d.sd); $('cps').textContent = fmt(cps()); $('light').textContent = d.light; $('best').textContent = fmt(best); }
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width, r.height) / S, dp = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return; cv.style.width = cv.style.height = S * s + 'px'; cv.width = cv.height = Math.round(S * s * dp); ctx.setTransform(cv.width / S, 0, 0, cv.height / S, 0, 0);
}
// ===== UI =====
function showOv(title, sub, b) { $('ovT').textContent = title; $('ovS').textContent = sub; $('ovSc').textContent = fmt(d.total); $('ovB').textContent = fmt(best); $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
  if (mode === 'start') { const away = Math.min(8 * 3600, (Date.now() - d.ts) / 1000); if (away > 60 && cps() > 0) { const v = cps() * away * .5; earn(v); float('Welcome back! +' + fmt(v), S / 2, 150, '#29e3d0'); } }
  mode = 'play'; $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; save(); showOv('Paused', 'Your galaxy is safe.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); tap((e.clientX - r.left) / r.width * S, (e.clientY - r.top) / r.height * S); });
addEventListener('keydown', e => {
  const k = e.key; if ([' ', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (k === ' ' && !e.repeat) tap(S / 2 + rnd(-30, 30), S / 2); else if (k >= '1' && k <= '8') buy(+k - 1);
});
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); save(); } }); addEventListener('blur', pause);
addEventListener('beforeunload', save); addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(ts) {
  const dt = Math.min(.1, (ts - last) / 1000 || 0); last = ts; if (mode === 'play') update(dt);
  render(); hud(); accUI += dt; if (accUI > .15) { accUI = 0; hudRows(); } requestAnimationFrame(loop);
}
buildShop(); setMute(); fit(); hudRows();
showOv('Star Forge', d.total > 0 ? 'Welcome back, forger. Your galaxy awaits.' : 'Tap the star, build machines, ascend for Light. Progress saves automatically.', d.total > 0 ? 'Continue' : 'Play');
requestAnimationFrame(loop);
})();
