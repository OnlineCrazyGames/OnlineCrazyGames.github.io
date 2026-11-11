/* Aether Guard - tower defense. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const C = 40, COLS = 8, ROWS = 12, W = C * COLS, H = C * ROWS, KEY = 'aether-guard-best', MKEY = 'aether-guard-mute';
const WP = [[-1, 1], [6, 1], [6, 4], [1, 4], [1, 7], [6, 7], [6, 10], [3, 10], [3, 12]].map(p => [p[0] * C + C / 2, p[1] * C + C / 2]);
const TW = [{n: 'Bolt', c: 50, r: 90, d: 8, f: .45, col: '#29e3d0'}, {n: 'Frost', c: 70, r: 80, d: 3, f: .8, col: '#7c5cff'}, {n: 'Cannon', c: 100, r: 100, d: 28, f: 1.5, col: '#ffc94a'}];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let towers, en, shots, parts, pops, queue, wave, score, shown, best = 0, lives, gold, sel = 0, selT = null, nt, wt, combo, comboT, shake, cur = {c: 2, r: 2}, mode = 'start', last = 0, muted = false, ac = null, blocked = new Set();
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
// mark path cells as unbuildable
for (let i = 0; i < WP.length - 1; i++) { const a = WP[i], b = WP[i + 1], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10); for (let k = 0; k <= n; k++) blocked.add(Math.floor((a[0] + (b[0] - a[0]) * k / n) / C) + ',' + Math.floor((a[1] + (b[1] - a[1]) * k / n) / C)); }
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
function beep(f, d, type = 'sine', v = .05) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * .7), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(30, 150); parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
const st = t => { const b = TW[t.t], m = t.lv - 1; return {d: b.d * (1 + .6 * m), r: b.r + 10 * m, f: b.f}; };
const upCost = t => Math.round(TW[t.t].c * .8 * t.lv);
// ===== game logic =====
function reset() { towers = []; en = []; shots = []; parts = []; pops = []; queue = []; wave = 0; score = 0; shown = 0; lives = 10; gold = 150; selT = null; nt = 12; wt = 0; combo = 0; comboT = 0; shake = 0; }
function startWave() {
  if (mode !== 'play' || queue.length || en.length) return;
  gold += Math.floor(nt); wave++; pop('Wave ' + wave, W / 2, 200, '#ff4fa3'); beep(500, .3, 'square', .04); wt = 0; nt = 0;
  const n = 6 + Math.floor(wave * 1.6), hp = 1 + wave * .22;
  for (let i = 0; i < n; i++) { const r = Math.random(), t = wave > 2 && r < .2 ? 'tank' : wave > 1 && r < .5 ? 'run' : 'grunt'; queue.push({t, hp, at: .5 + i * .8}); }
  if (wave % 10 === 0) queue.push({t: 'boss', hp, at: 1});
}
function spawn(q) {
  const T = {grunt: [22, 50, 10, 7], run: [14, 95, 8, 6], tank: [90, 35, 20, 11], boss: [450, 30, 150, 18]}[q.t];
  en.push({t: q.t, x: WP[0][0], y: WP[0][1], i: 1, hp: T[0] * q.hp, mhp: T[0] * q.hp, v: T[1], g: T[2], r: T[3], slow: 0});
}
function place(c, r) {
  if (mode !== 'play' || c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
  const ex = towers.find(t => t.c === c && t.r === r);
  if (ex) { selT = ex; if (ex.lv >= 3) return pop('Max level', ex.c * C + 20, ex.r * C, '#b4abdc'); const u = upCost(ex); if (gold >= u) { gold -= u; ex.lv++; burst(c * C + 20, r * C + 20, TW[ex.t].col, 14); beep(700, .2, 'triangle', .06); } else pop('Need ' + u, c * C + 20, r * C, '#ff4fa3'); return; }
  if (blocked.has(c + ',' + r)) return; const b = TW[sel];
  if (gold < b.c) { pop('Need ' + b.c, c * C + 20, r * C, '#ff4fa3'); beep(120, .1, 'sawtooth', .03); return; }
  gold -= b.c; selT = {t: sel, c, r, lv: 1, cd: 0, a: 0}; towers.push(selT); burst(c * C + 20, r * C + 20, b.col, 12); beep(440, .15, 'sine', .07);
}
function sell() { if (mode !== 'play' || !selT) return; const v = Math.floor(TW[selT.t].c * .6 * (1 + (selT.lv - 1) * .8)); gold += v; towers = towers.filter(t => t !== selT); pop('+' + v + ' gold', selT.c * C + 20, selT.r * C); selT = null; beep(300, .15, 'triangle', .05); }
function die(e) {
  e.hp = -1; gold += e.g; comboT = 1.5; combo++; const m = Math.min(5, 1 + Math.floor(combo / 5)); const p = e.g * 2 * m; score += p; if (combo % 5 === 0) pop('Combo x' + m + '!', W / 2, 160, '#29e3d0');
  pop('+' + e.g, e.x, e.y - 12, '#ffc94a'); burst(e.x, e.y, '#ff4fa3', e.t === 'boss' ? 40 : 8); shake = e.t === 'boss' ? 10 : 0; beep(260, .12, 'sawtooth', .04);
}
function hit(e, d, slow) { e.hp -= d; if (slow) e.slow = 1.5; if (e.hp <= 0 && e.hp > -1) die(e); }
function update(dt) {
  wt += dt; comboT -= dt; if (comboT <= 0) combo = 0; shake = Math.max(0, shake - dt * 25);
  while (queue.length && queue[0].at <= wt) spawn(queue.shift());
  if (!queue.length && !en.length && wave > 0 && nt === 0) { nt = 10; gold += 20 + wave * 3; score += wave * 50; pop('Wave clear! +' + (20 + wave * 3), W / 2, 220, '#29e3d0'); }
  if (!queue.length && !en.length) { nt -= dt; if (nt <= 0) startWave(); }
  for (const e of en) {
    e.slow = Math.max(0, e.slow - dt); let mv = e.v * (e.slow > 0 ? .55 : 1) * dt;
    while (mv > 0 && e.i < WP.length) { const p = WP[e.i], d = Math.hypot(p[0] - e.x, p[1] - e.y); if (d <= mv) { e.x = p[0]; e.y = p[1]; e.i++; mv -= d; } else { e.x += (p[0] - e.x) / d * mv; e.y += (p[1] - e.y) / d * mv; mv = 0; } }
    if (e.i >= WP.length && e.hp > 0) { e.hp = -1; lives -= e.t === 'boss' ? 5 : 1; shake = 10; beep(120, .4, 'sawtooth', .08); pop('Core hit!', W / 2, H - 60, '#ff4fa3'); if (lives <= 0) { lives = 0; end(); } }
  }
  en = en.filter(e => e.hp > 0);
  for (const t of towers) {
    const s = st(t), x = t.c * C + 20, y = t.r * C + 20; t.cd -= dt;
    let tg = null, bp = -1; for (const e of en) if (Math.hypot(e.x - x, e.y - y) <= s.r && e.i + 0 > bp) { tg = e; bp = e.i; }
    if (tg) { t.a = Math.atan2(tg.y - y, tg.x - x); if (t.cd <= 0) { t.cd = s.f; shots.push({x, y, tg, d: s.d, t: t.t}); beep(t.t === 2 ? 150 : 800, .07, 'square', .02); } }
  }
  for (const s of shots) {
    if (s.tg.hp <= 0 && s.t !== 2) { s.dead = 1; continue; } const dx = s.tg.x - s.x, dy = s.tg.y - s.y, d = Math.hypot(dx, dy), mv = 420 * dt;
    if (d <= mv + 6) { s.dead = 1; if (s.t === 2) { burst(s.tg.x, s.tg.y, '#ffc94a', 12); en.forEach(e => { if (Math.hypot(e.x - s.tg.x, e.y - s.tg.y) < 42) hit(e, s.d); }); } else hit(s.tg, s.d, s.t === 1); } else { s.x += dx / d * mv; s.y += dy / d * mv; }
  }
  shots = shots.filter(s => !s.dead); en = en.filter(e => e.hp > 0);
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 28 * dt; p.life -= dt * .9; }); pops = pops.filter(p => p.life > 0);
}
function end() {
  mode = 'over'; if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Core Destroyed', score >= best && score > 0 ? 'New best score! Wave ' + wave : 'You survived to wave ' + wave + '.', 'Play Again');
}
// ===== rendering =====
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0; ctx.save(); ctx.translate(sx, sy);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0f45'); g.addColorStop(1, '#0d0830'); ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * C, 0); ctx.lineTo(i * C, H); ctx.stroke(); } for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * C); ctx.lineTo(W, i * C); ctx.stroke(); }
  ctx.lineCap = ctx.lineJoin = 'round'; const path = () => { ctx.beginPath(); WP.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
  ctx.strokeStyle = 'rgba(124,92,255,.25)'; ctx.lineWidth = 32; path(); ctx.stroke(); ctx.strokeStyle = 'rgba(41,227,208,.35)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); path(); ctx.stroke(); ctx.setLineDash([]);
  ctx.shadowColor = '#29e3d0'; ctx.shadowBlur = 20; const cg = ctx.createRadialGradient(W / 2 - 4, H - 24, 2, W / 2, H - 20, 18); cg.addColorStop(0, '#fff'); cg.addColorStop(1, '#29e3d0'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(W / 2 - 20 + 20, H - 20, 16, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
  if (mode === 'play' && !blocked.has(cur.c + ',' + cur.r)) { ctx.strokeStyle = TW[sel].col; ctx.lineWidth = 2; ctx.strokeRect(cur.c * C + 3, cur.r * C + 3, C - 6, C - 6); }
  for (const t of towers) {
    const x = t.c * C + 20, y = t.r * C + 20, b = TW[t.t]; if (t === selT) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, st(t).r, 0, 6.283); ctx.stroke(); }
    ctx.save(); ctx.translate(x, y); ctx.shadowColor = b.col; ctx.shadowBlur = 12; const tg = ctx.createRadialGradient(-4, -4, 2, 0, 0, 15); tg.addColorStop(0, '#fff'); tg.addColorStop(1, b.col); ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    ctx.rotate(t.a); ctx.fillStyle = '#0a0620'; ctx.fillRect(2, -3, 16, 6); ctx.rotate(-t.a); ctx.fillStyle = '#fff'; for (let i = 0; i < t.lv; i++) ctx.fillRect(-9 + i * 7, 9, 4, 3); ctx.restore();
  }
  for (const e of en) { ctx.save(); ctx.translate(e.x, e.y); ctx.shadowColor = '#ff4fa3'; ctx.shadowBlur = 10; const eg = ctx.createRadialGradient(-e.r * .3, -e.r * .3, 1, 0, 0, e.r); eg.addColorStop(0, e.slow > 0 ? '#cbbdff' : '#ff9ccc'); eg.addColorStop(1, e.t === 'tank' || e.t === 'boss' ? '#6a1740' : '#c02a72'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(-e.r * .4, -e.r * .2, e.r * .25, e.r * .25); ctx.fillRect(e.r * .15, -e.r * .2, e.r * .25, e.r * .25);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-e.r, -e.r - 6, e.r * 2, 3); ctx.fillStyle = '#29e3d0'; ctx.fillRect(-e.r, -e.r - 6, e.r * 2 * Math.max(0, e.hp / e.mhp), 3); ctx.restore(); }
  for (const s of shots) { ctx.fillStyle = TW[s.t].col; ctx.shadowColor = TW[s.t].col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(s.x, s.y, s.t === 2 ? 5 : 3, 0, 6.283); ctx.fill(); } ctx.shadowBlur = 0;
  parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 3, 3); }); ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.font = '800 17px system-ui,sans-serif'; pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 1.5); ctx.fillStyle = p.c; ctx.fillText(p.t, p.x, p.y); }); ctx.globalAlpha = 1;
  if (mode === 'play' && !queue.length && !en.length && nt > 0) { ctx.fillStyle = 'rgba(245,242,255,.8)'; ctx.font = '700 14px system-ui'; ctx.fillText('Next wave in ' + Math.ceil(nt) + 's', W / 2, H - 50); }
  ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = wave; $('lives').textContent = '❤' + lives + ' 🪙' + gold;
  [0, 1, 2].forEach(i => { $('t' + i).classList.toggle('sel', sel === i); $('t' + i).classList.toggle('off', gold < TW[i].c); }); $('sell').classList.toggle('off', !selT);
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
function pause() { if (mode === 'play') { mode = 'pause'; showOv('Paused', 'Plan your defences.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
function cell(e) { const r = cv.getBoundingClientRect(); return {c: Math.floor((e.clientX - r.left) / r.width * COLS), r: Math.floor((e.clientY - r.top) / r.height * ROWS)}; }
cv.addEventListener('pointermove', e => { cur = cell(e); }); cv.addEventListener('pointerdown', e => { cur = cell(e); place(cur.c, cur.r); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); const c = cell(e); selT = towers.find(t => t.c === c.c && t.r === c.r) || null; sell(); });
addEventListener('keydown', e => {
  const k = e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  if (k === 'ArrowLeft') cur.c = Math.max(0, cur.c - 1); else if (k === 'ArrowRight') cur.c = Math.min(COLS - 1, cur.c + 1); else if (k === 'ArrowUp') cur.r = Math.max(0, cur.r - 1); else if (k === 'ArrowDown') cur.r = Math.min(ROWS - 1, cur.r + 1);
  else if (k === 'Enter') place(cur.c, cur.r); else if (k >= '1' && k <= '3') sel = +k - 1; else if (k === 's' || k === 'S') { selT = towers.find(t => t.c === cur.c && t.r === cur.r) || selT; sell(); } else if (k === 'n' || k === 'N') startWave();
});
[0, 1, 2].forEach(i => $('t' + i).addEventListener('pointerdown', e => { e.preventDefault(); sel = i; }));
$('sell').addEventListener('pointerdown', e => { e.preventDefault(); sell(); }); $('go').addEventListener('pointerdown', e => { e.preventDefault(); startWave(); });
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  render(); hud(); requestAnimationFrame(loop);
}
reset(); setMute(); fit(); showOv('Aether Guard', 'Build towers along the path and protect the core from endless waves.', 'Play');
requestAnimationFrame(loop);
})();
