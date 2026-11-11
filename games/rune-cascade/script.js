/* Rune Cascade - match-3 puzzle with cascades and special runes. Vanilla JS, offline. */
(() => {
'use strict';
// ===== constants =====
const N = 8, C = 40, OY = 40, W = N * C, H = OY + N * C, KEY = 'rune-cascade-best', MKEY = 'rune-cascade-mute';
const COL = ['#ff4fa3', '#7c5cff', '#29e3d0', '#ffc94a', '#ff8a3d', '#5aa9ff'];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
// ===== state =====
let g, phase = 'idle', timer = 0, sel = null, cur = {r: 4, c: 4}, drag = null, cascade = 0, lastSwap = [], score, shown, base, goal, level, moves, best = 0, parts, pops, shake, mode = 'start', last = 0, muted = false, ac = null, hintT = 0;
try { best = +localStorage.getItem(KEY) || 0; muted = localStorage.getItem(MKEY) === '1'; } catch (e) {}
// ===== helpers =====
const rnd = (a, b) => a + Math.random() * (b - a);
function beep(f, d, type = 'sine', v = .06) {
  if (muted || !ac) return;
  try { const o = ac.createOscillator(), x = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + d); x.gain.setValueAtTime(v, t); x.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(x); x.connect(ac.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
function burst(x, y, c, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), s = rnd(40, 160); parts.push({x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(.3, .7), c}); } }
function pop(t, x, y, c) { pops.push({t, x, y, life: 1, c: c || '#ffc94a'}); }
const mk = (r, c, t) => ({t: t === undefined ? Math.floor(Math.random() * 6) : t, x: c * C, y: r * C, s: 1, sp: null, dying: false});
// ===== game logic =====
function fill() {
  g = [];
  for (let r = 0; r < N; r++) { g.push([]); for (let c = 0; c < N; c++) { let t; do t = Math.floor(Math.random() * 6); while ((c > 1 && g[r][c - 1].t === t && g[r][c - 2].t === t) || (r > 1 && g[r - 1][c].t === t && g[r - 2][c].t === t)); g[r].push(mk(r, c, t)); } }
}
function reset() {
  fill(); score = 0; shown = 0; level = 1; moves = 20; base = 0; goal = 500; parts = []; pops = []; shake = 0; phase = 'idle'; sel = null; cascade = 0; hintT = 0;
  if (!hasMove()) fill();
}
function findRuns() {
  const runs = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N;) { const t = g[r][c] && g[r][c].t; let k = c; while (k < N && g[r][k] && g[r][k].t === t) k++; if (k - c >= 3) runs.push({d: 'h', cells: Array.from({length: k - c}, (_, i) => [r, c + i])}); c = k; }
  for (let c = 0; c < N; c++) for (let r = 0; r < N;) { const t = g[r][c] && g[r][c].t; let k = r; while (k < N && g[k][c] && g[k][c].t === t) k++; if (k - r >= 3) runs.push({d: 'v', cells: Array.from({length: k - r}, (_, i) => [r + i, c])}); r = k; }
  return runs;
}
function hasMove() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue; const a = g[r][c], b = g[r2][c2]; g[r][c] = b; g[r2][c2] = a; const ok = findRuns().length > 0; g[r][c] = a; g[r2][c2] = b; if (ok) return true;
  }
  return false;
}
function swap(r1, c1, r2, c2) {
  if (mode !== 'play' || phase !== 'idle' || moves <= 0) return;
  if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1 || r2 < 0 || c2 < 0 || r2 >= N || c2 >= N) return;
  const a = g[r1][c1]; g[r1][c1] = g[r2][c2]; g[r2][c2] = a; lastSwap = [[r1, c1], [r2, c2]]; phase = 'swap'; sel = null; beep(400, .08, 'triangle');
}
function settled() { for (const row of g) for (const q of row) if (q && (Math.abs(q.x - q.cx) > 1 || Math.abs(q.y - q.cy) > 1)) return false; return true; }
function resolve() {
  const runs = findRuns();
  if (!runs.length) { cascade = 0; phase = 'idle'; hintT = 0; afterTurn(); return; }
  const set = new Set(), made = [];
  for (const run of runs) {
    run.cells.forEach(p => set.add(p[0] + ',' + p[1]));
    if (run.cells.length >= 4) { const sw = run.cells.find(p => lastSwap.some(s => s[0] === p[0] && s[1] === p[1])) || run.cells[Math.floor(run.cells.length / 2)]; made.push({r: sw[0], c: sw[1], sp: run.cells.length >= 5 ? 'b' : (run.d === 'h' ? 'v' : 'h')}); }
  }
  let grow = true;
  while (grow) { grow = false; for (const k of [...set]) { const [r, c] = k.split(',').map(Number), q = g[r][c]; if (!q || !q.sp) continue; const add = (rr, cc) => { if (rr >= 0 && cc >= 0 && rr < N && cc < N && !set.has(rr + ',' + cc)) { set.add(rr + ',' + cc); grow = true; } };
    if (q.sp === 'h') for (let i = 0; i < N; i++) add(r, i); else if (q.sp === 'v') for (let i = 0; i < N; i++) add(i, c); else for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) add(r + i, c + j); } }
  made.forEach(m => { set.delete(m.r + ',' + m.c); g[m.r][m.c].sp = m.sp; g[m.r][m.c].s = 1.3; });
  cascade++; const pts = set.size * 10 * cascade; score += pts;
  set.forEach(k => { const [r, c] = k.split(',').map(Number), q = g[r][c]; q.dying = true; burst(c * C + 20, OY + r * C + 20, COL[q.t], 6); });
  const m = [...set][0].split(',').map(Number); pop('+' + pts, m[1] * C + 20, OY + m[0] * C);
  if (cascade >= 2) pop('Cascade x' + cascade + '!', W / 2, OY + 130, '#29e3d0'); if (made.length) pop('Special rune!', W / 2, OY + 170, '#ff4fa3');
  shake = Math.min(8, 2 + set.size / 3); beep(300 + cascade * 70, .2, 'sine', .08); phase = 'clear'; timer = .16;
}
function gravity() {
  for (let c = 0; c < N; c++) { const col = []; for (let r = N - 1; r >= 0; r--) if (g[r][c] && !g[r][c].dying) col.push(g[r][c]); const miss = N - col.length;
    for (let r = N - 1, i = 0; r >= 0; r--, i++) { if (i < col.length) g[r][c] = col[i]; else { g[r][c] = mk(r, c); g[r][c].y = (r - miss - 1) * C; } } }
  phase = 'fall';
}
function afterTurn() {
  if (score >= goal) { level++; const bonus = moves * 50; score += bonus; pop('Level ' + level + '! +' + bonus + ' bonus', W / 2, OY + 100, '#ff4fa3'); beep(660, .4, 'square', .05); moves = 20; base = score; goal = score + 300 + level * 250; burst(W / 2, H / 2, '#ffc94a', 40); }
  else if (moves <= 0) { end(); return; }
  if (!hasMove()) { fill(); pop('Shuffle!', W / 2, OY + 150, '#ffc94a'); if (!hasMove()) fill(); }
}
function end() {
  mode = 'over'; if (score > best) { best = score; try { localStorage.setItem(KEY, best); } catch (e) {} }
  showOv('Out of Moves', score >= best && score > 0 ? 'New best score! Level ' + level : 'You reached level ' + level + '.', 'Play Again'); beep(150, .6, 'sawtooth', .07);
}
function update(dt) {
  shake = Math.max(0, shake - dt * 25); hintT += dt;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const q = g[r][c]; if (!q) continue; q.cx = c * C; q.cy = r * C;
    const mv = (a, b) => { const d = b - a, s = Math.max(Math.abs(d) * dt * 14, 260 * dt); return Math.abs(d) <= s ? b : a + Math.sign(d) * s; }; q.x = mv(q.x, q.cx); q.y = mv(q.y, q.cy); q.s += ((q.dying ? 0 : 1) - q.s) * Math.min(1, dt * 14); }
  if (phase === 'swap' && settled()) { if (findRuns().length) { moves--; cascade = 0; resolve(); } else { const [a, b] = lastSwap, t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t; phase = 'back'; beep(150, .15, 'sawtooth', .04); } }
  else if (phase === 'back' && settled()) phase = 'idle';
  else if (phase === 'clear') { timer -= dt; if (timer <= 0) gravity(); }
  else if (phase === 'fall' && settled()) resolve();
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }); parts = parts.filter(p => p.life > 0);
  pops.forEach(p => { p.y -= 28 * dt; p.life -= dt * .8; }); pops = pops.filter(p => p.life > 0);
}
// ===== rendering =====
function shape(t, r) {
  ctx.beginPath();
  if (t === 0) ctx.arc(0, 0, r, 0, 6.283);
  else if (t === 1) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); }
  else if (t === 2) { ctx.moveTo(0, -r); ctx.lineTo(r, r * .8); ctx.lineTo(-r, r * .8); }
  else if (t === 3) ctx.roundRect ? ctx.roundRect(-r * .85, -r * .85, r * 1.7, r * 1.7, 5) : ctx.rect(-r * .85, -r * .85, r * 1.7, r * 1.7);
  else if (t === 4) for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos(i * 1.047) * r, Math.sin(i * 1.047) * r);
  else for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .5 : r * 1.05, a = i * .628 - 1.57; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
}
function render() {
  const sx = shake ? rnd(-shake, shake) / 2 : 0, sy = shake ? rnd(-shake, shake) / 2 : 0; ctx.save(); ctx.translate(sx, sy);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0f45'); bg.addColorStop(1, '#0d0830'); ctx.fillStyle = bg; ctx.fillRect(-20, -20, W + 40, H + 40);
  const p = Math.max(0, Math.min(1, (score - base) / (goal - base))); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(10, 14, W - 20, 12);
  const pg = ctx.createLinearGradient(0, 0, W, 0); pg.addColorStop(0, '#ff4fa3'); pg.addColorStop(.55, '#7c5cff'); pg.addColorStop(1, '#29e3d0'); ctx.fillStyle = pg; ctx.fillRect(10, 14, (W - 20) * p, 12);
  ctx.fillStyle = '#b4abdc'; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('GOAL ' + goal, W / 2, 36);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)'; ctx.fillRect(c * C, OY + r * C, C, C); }
  const hint = hintT > 6 && phase === 'idle' ? Math.floor(performance.now() / 400) % 2 : 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const q = g[r][c]; if (!q) continue; const R = 15 * q.s * (sel && sel.r === r && sel.c === c ? 1.15 : 1); if (R < .5) continue;
    ctx.save(); ctx.translate(q.x + 20, OY + q.y + 20); ctx.shadowColor = COL[q.t]; ctx.shadowBlur = q.sp ? 18 : 8; const gr = ctx.createRadialGradient(-R * .3, -R * .35, 1, 0, 0, R * 1.1); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, COL[q.t]); gr.addColorStop(1, 'rgba(10,6,32,.85)');
    ctx.fillStyle = gr; shape(q.t, R); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (q.sp) { ctx.fillStyle = '#fff'; ctx.font = '800 14px system-ui'; ctx.fillText(q.sp === 'h' ? '↔' : q.sp === 'v' ? '↕' : '✸', 0, 5); } ctx.restore(); }
  if (mode === 'play') { ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.strokeRect(cur.c * C + 2, OY + cur.r * C + 2, C - 4, C - 4); }
  if (hint) ctx.fillStyle = 'rgba(255,255,255,.0)';
  parts.forEach(q => { ctx.globalAlpha = Math.max(0, q.life * 2); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 3, 3); }); ctx.globalAlpha = 1;
  ctx.font = '800 18px system-ui'; pops.forEach(q => { ctx.globalAlpha = Math.min(1, q.life * 1.5); ctx.fillStyle = q.c; ctx.fillText(q.t, q.x, q.y); }); ctx.globalAlpha = 1; ctx.restore();
}
function hud() {
  shown += (score - shown) * .2; if (Math.abs(score - shown) < 1) shown = score;
  $('score').textContent = Math.round(shown); $('best').textContent = Math.max(best, score); $('level').textContent = level; $('lives').textContent = moves;
}
function fit() {
  const r = $('wrap').getBoundingClientRect(), s = Math.min(r.width / W, r.height / H), d = Math.min(window.devicePixelRatio || 1, 2);
  if (s <= 0) return; cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d); ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
// ===== UI =====
function showOv(t, s, b) { $('ovT').textContent = t; $('ovS').textContent = s; $('ovSc').textContent = score; $('ovB').textContent = best; $('playBtn').textContent = b; $('ov').classList.remove('hide'); }
function start() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume(); if (mode !== 'pause') reset(); mode = 'play'; drag = null; $('ov').classList.add('hide'); beep(520, .15, 'triangle');
}
function pause() { if (mode === 'play') { mode = 'pause'; drag = null; showOv('Paused', 'Take a breath.', 'Resume'); } }
function setMute() { $('muteBtn').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem(MKEY, muted ? '1' : '0'); } catch (e) {} }
// ===== input =====
function cellAt(e) { const r = cv.getBoundingClientRect(); return {c: Math.floor((e.clientX - r.left) / r.width * W / C), r: Math.floor(((e.clientY - r.top) / r.height * H - OY) / C), x: e.clientX, y: e.clientY}; }
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play' || phase !== 'idle') return; const p = cellAt(e); if (p.r < 0 || p.r >= N || p.c < 0 || p.c >= N) return; cur = {r: p.r, c: p.c};
  if (sel && Math.abs(sel.r - p.r) + Math.abs(sel.c - p.c) === 1) { swap(sel.r, sel.c, p.r, p.c); return; }
  sel = {r: p.r, c: p.c}; drag = p; beep(500, .05, 'triangle', .04);
});
cv.addEventListener('pointermove', e => {
  if (!drag || mode !== 'play') return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 16) { const h = Math.abs(dx) > Math.abs(dy); swap(drag.r, drag.c, drag.r + (h ? 0 : Math.sign(dy)), drag.c + (h ? Math.sign(dx) : 0)); drag = null; }
});
addEventListener('pointerup', () => { drag = null; });
addEventListener('keydown', e => {
  const k = e.key; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (k === 'm' || k === 'M') { muted = !muted; setMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { mode === 'play' ? pause() : mode === 'pause' && start(); return; }
  if (mode !== 'play') { if (k === 'Enter' || k === ' ') start(); return; }
  const d = {ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0]}[k];
  if (d) { if (sel) swap(cur.r, cur.c, cur.r + d[0], cur.c + d[1]); else { cur.r = Math.max(0, Math.min(N - 1, cur.r + d[0])); cur.c = Math.max(0, Math.min(N - 1, cur.c + d[1])); } }
  else if (k === ' ' || k === 'Enter') sel = sel ? null : {r: cur.r, c: cur.c};
});
$('playBtn').onclick = start; $('pauseBtn').onclick = pause; $('muteBtn').onclick = () => { muted = !muted; setMute(); };
document.addEventListener('visibilitychange', () => document.hidden && pause()); addEventListener('blur', pause);
addEventListener('resize', fit); if (window.ResizeObserver) new ResizeObserver(fit).observe($('wrap'));
// ===== loop =====
function loop(t) {
  const dt = Math.min(.033, (t - last) / 1000 || 0); last = t;
  if (mode === 'play') update(dt); else if (mode === 'over') parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
  render(); hud(); requestAnimationFrame(loop);
}
reset(); g.forEach((row, r) => row.forEach((q, c) => { q.cx = c * C; q.cy = r * C; })); setMute(); fit(); showOv('Rune Cascade', 'Swap neighbouring runes to match 3 or more. Reach each level\'s goal before your moves run out!', 'Play');
requestAnimationFrame(loop);
})();
