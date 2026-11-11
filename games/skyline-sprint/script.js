(() => {
'use strict';
/* ===== Skyline Sprint: original 3-lane endless runner ===== */
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
const rnd = (a, b) => a + Math.random() * (b - a), ri = n => Math.random() * n | 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const GOD = !!window.__GOD;

/* ---------- constants ---------- */
const F = 14, ZF = 130, LANE_M = 2.4, GRAV = 38, JUMP_V = 14.5;
const PW = { magnet: { i: '🧲', t: 9, n: 'Magnet' }, x2: { i: '✨', t: 10, n: '×2' } };

/* ---------- state ---------- */
let W = 0, H = 0, DPR = 1, cx = 0, horizonY = 0, groundY = 0, laneW = 0, S = 0, eyeH = 5;
let state = 'start', t = 0, dist = 0, speed = 22, scoreF = 0, coins = 0, best = 0, newBest = false;
let lane = 0, px = 0, py = 0, vy = 0, slideT = 0, slideQ = false, jumpBuf = 0, camX = 0;
let objs = [], bld = [], parts = [], edge = { '-1': -8, '1': -8 }, nextRow = 30;
let magnet = 0, x2 = 0, shield = false, invul = 0, combo = 0, comboT = 0, lastMs = 0;
let crashT = 0, shake = 0, dustT = 0, lastCoinSfx = 0, sky = null;
try { best = +localStorage.getItem('skyline-sprint-best') || 0; } catch (e) {}

/* ---------- sound ---------- */
let ac = null, muted = false;
try { muted = localStorage.getItem('skyline-sprint-mute') === '1'; } catch (e) {}
function audio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); return ac; } catch (e) { return null; } }
function tone(f, d, type = 'square', v = .05, slide = 0, when = 0) {
  if (muted) return; const a = audio(); if (!a) return;
  const s = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, s);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), s + d);
  g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(.0001, s + d);
  o.connect(g); g.connect(a.destination); o.start(s); o.stop(s + d);
}
function noise(d, v = .12, when = 0) {
  if (muted) return; const a = audio(); if (!a) return;
  const n = a.sampleRate * d | 0, b = a.createBuffer(1, n, a.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = b; g.gain.value = v;
  s.connect(g); g.connect(a.destination); s.start(a.currentTime + when);
}
const sfx = {
  lane: () => tone(260, .06, 'sine', .04, 120),
  jump: () => tone(360, .2, 'square', .035, 520),
  slide: () => noise(.25, .07),
  coin: n => { tone(880 + Math.min(n, 12) * 45, .09, 'triangle', .06); tone(1320 + Math.min(n, 12) * 45, .12, 'triangle', .05, 0, .05); },
  power: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .14, 'square', .045, 0, i * .06)),
  shield: () => { tone(300, .3, 'sawtooth', .06, -200); noise(.2, .08); },
  crash: () => { noise(.6, .25); tone(150, .5, 'sawtooth', .1, -110); },
  mile: () => [659, 880].forEach((f, i) => tone(f, .16, 'triangle', .06, 0, i * .09))
};

/* ---------- layout ---------- */
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect(); W = r.width; H = r.height;
  cv.width = W * DPR | 0; cv.height = H * DPR | 0; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx = W / 2; horizonY = H * .36; groundY = H * .87;
  laneW = Math.min(W * .27, H * .3); S = laneW / LANE_M; eyeH = (groundY - horizonY) / S;
  sky = null;
}
addEventListener('resize', resize);

const proj = (x, y, z) => {
  const p = F / (F + Math.max(z, -F + 1));
  return [cx + (x - camX) * laneW * p, horizonY + (groundY - horizonY) * p - y * S * p, p];
};

/* ---------- world generation ---------- */
function addBuilding(side, z) {
  const d = rnd(6, 12), h = rnd(5, 17), nz = 3, ny = Math.min(8, h / 2.2 | 0), win = [];
  for (let i = 0; i < nz * ny; i++) win.push(Math.random() < .55 ? ri(3) + 1 : 0);
  bld.push({ side, z, d, w: rnd(2.5, 4.5), h, hue: ri(4), win, nz, ny });
  return d;
}
function seedBuildings() {
  bld = []; edge = { '-1': -8, '1': -8 };
  [-1, 1].forEach(s => { while (edge[s] < ZF + 10) edge[s] += addBuilding(s, edge[s]) + rnd(.5, 3); });
}
function spawnRow() {
  const dif = Math.min(1, dist / 3000), free = ri(3) - 1;
  const z = ZF;
  if (Math.random() < .2) { // credit snake, no obstacles
    let l = free;
    for (let i = 0; i < 9; i++) { if (i % 3 === 0 && i) l = clamp(l + (Math.random() < .5 ? -1 : 1), -1, 1); objs.push({ k: 'coin', lane: l, z: z + i * 2.2, y: .8 }); }
    return;
  }
  for (let l = -1; l <= 1; l++) {
    if (l === free) {
      if (Math.random() < .65) for (let i = 0; i < 5; i++) objs.push({ k: 'coin', lane: l, z: z + i * 2.3, y: .8 });
      else if (Math.random() < .12) objs.push({ k: 'pow', kind: Math.random() < .4 ? 'shield' : (Math.random() < .5 ? 'magnet' : 'x2'), lane: l, z: z + 4, y: 1 });
      continue;
    }
    const r = Math.random();
    if (r < .18 + .1 * (1 - dif)) continue;
    let k = r < .55 ? 'bar' : r < .8 ? 'gate' : (dist > 250 ? 'truck' : 'bar');
    if (k === 'bar') { objs.push({ k, lane: l, z, len: .9 }); if (Math.random() < .6) for (let i = 0; i < 5; i++) objs.push({ k: 'coin', lane: l, z: z - 1.5 + i * 1.1, y: .8 + Math.sin(i / 4 * Math.PI) * 1.7 }); }
    else if (k === 'gate') objs.push({ k, lane: l, z, len: .6 });
    else objs.push({ k, lane: l, z, len: 6.5 });
  }
}

/* ---------- game flow ---------- */
function overlay(title, msg, btn, stats) {
  $('ovt').textContent = title; $('ovm').textContent = msg; $('play').textContent = btn;
  $('stats').innerHTML = stats ? stats.map(s => `<div><span>${s[0]}</span><b>${s[1]}</b></div>`).join('') : '';
  $('ov').classList.remove('hide');
}
function toast(s) { const el = $('toast'); el.textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function start() {
  audio(); objs = []; parts = []; dist = 0; speed = 22; scoreF = 0; coins = 0; newBest = false;
  lane = 0; px = 0; py = 0; vy = 0; slideT = 0; slideQ = false; jumpBuf = 0; camX = 0;
  magnet = 0; x2 = 0; shield = false; invul = 1.2; combo = 0; comboT = 0; lastMs = 0; crashT = 0; nextRow = 34; shake = 0;
  seedBuildings(); state = 'play'; $('ov').classList.add('hide');
}
function finish() {
  state = 'over'; const sc = Math.floor(scoreF);
  if (sc > best) { best = sc; newBest = true; try { localStorage.setItem('skyline-sprint-best', best); } catch (e) {} }
  overlay('Run Over', newBest ? '🏆 New best score!' : 'So close! Try again.', '↻ Run again',
    [['Score', sc.toLocaleString()], ['Distance', Math.floor(dist) + ' m'], ['Credits', coins], ['Best', best.toLocaleString()]]);
}
function pause() { if (state !== 'play') return; state = 'pause'; overlay('Paused', 'Catch your breath.', '▶ Resume'); }
function resume() { if (state === 'pause') { state = 'play'; $('ov').classList.add('hide'); } }
function crash() {
  if (GOD || invul > 0) return;
  state = 'crash'; crashT = 0; shake = 16; sfx.crash();
  for (let i = 0; i < 26; i++) parts.push({ x: cx + px * laneW, y: groundY - .8 * S, vx: rnd(-320, 320), vy: rnd(-420, -60), l: rnd(500, 900), c: ['#ff4fa3', '#29e3d0', '#ffc94a', '#7c5cff'][ri(4)], s: rnd(3, 7) });
}
function hit(o) {
  if (shield) { shield = false; o.dead = true; invul = 1; shake = 8; sfx.shield(); toast('Shield broken!'); return; }
  crash();
}
function collect(o) {
  o.dead = true;
  const [sx, sy] = proj(o.lane, o.y, o.z);
  if (o.k === 'coin') {
    coins++; combo++; comboT = 1.1; scoreF += 10 * (x2 > 0 ? 2 : 1);
    sfx.coin(combo);
    for (let i = 0; i < 5; i++) parts.push({ x: sx, y: sy, vx: rnd(-120, 120), vy: rnd(-160, 40), l: 380, c: '#ffd45a', s: 3 });
    if (combo && combo % 10 === 0) { scoreF += 50; toast('Combo ×' + combo + '  +50'); }
  } else {
    sfx.power();
    if (o.kind === 'shield') { shield = true; toast('Shield ready!'); }
    else { if (o.kind === 'magnet') magnet = PW.magnet.t; else x2 = PW.x2.t; toast(o.kind === 'magnet' ? 'Magnet!' : 'Score ×2!'); }
    for (let i = 0; i < 14; i++) parts.push({ x: sx, y: sy, vx: rnd(-220, 220), vy: rnd(-220, 120), l: 600, c: '#29e3d0', s: 4 });
  }
}
function jump() {
  if (state !== 'play') return;
  if (py <= .01) { vy = JUMP_V; py = .02; slideT = 0; slideQ = false; sfx.jump(); jumpBuf = 0; }
  else jumpBuf = .16;
}
function slide() {
  if (state !== 'play') return;
  if (py > .05) { vy = Math.min(vy, -20); slideQ = true; } else { slideT = .75; sfx.slide(); }
}
function steer(d) {
  if (state !== 'play') return; const n = clamp(lane + d, -1, 1);
  if (n !== lane) { lane = n; sfx.lane(); }
}

function update(dt) {
  t += dt;
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.l -= dt * 1000; });
  parts = parts.filter(p => p.l > 0);
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (state === 'start' || state === 'pause' || state === 'over') { if (state === 'start') idleWorld(dt); return; }
  if (state === 'crash') { crashT += dt; speed *= Math.pow(.015, dt); moveWorld(speed * dt); if (crashT > .9) finish(); return; }
  /* playing */
  speed += (Math.min(46, 22 + dist * .0075) - speed) * Math.min(1, dt * 2);
  const dz = speed * dt; dist += dz; scoreF += dz * (x2 > 0 ? 2 : 1);
  invul = Math.max(0, invul - dt); magnet = Math.max(0, magnet - dt); x2 = Math.max(0, x2 - dt);
  comboT -= dt; if (comboT <= 0) combo = 0;
  px += (lane - px) * Math.min(1, dt * 15);
  if (py > 0 || vy > 0) { vy -= GRAV * dt; py += vy * dt; if (py <= 0) { py = 0; vy = 0; if (slideQ) { slideQ = false; slideT = .75; sfx.slide(); } else for (let i = 0; i < 6; i++) parts.push({ x: cx + px * laneW + rnd(-20, 20), y: groundY, vx: rnd(-80, 80), vy: rnd(-90, -10), l: 300, c: 'rgba(255,255,255,.5)', s: 3 }); } }
  if (jumpBuf > 0) { jumpBuf -= dt; if (py <= .01) jump(); }
  if (slideT > 0) slideT -= dt;
  dustT -= dt; if (dustT <= 0 && py <= .01) { dustT = .07; parts.push({ x: cx + (px - camX) * laneW + rnd(-12, 12), y: groundY, vx: rnd(-50, 50), vy: rnd(-60, -10), l: 260, c: 'rgba(255,255,255,.35)', s: 3 }); }
  nextRow -= dz; if (nextRow <= 0) { spawnRow(); nextRow = Math.max(14, speed * (1.05 - .3 * Math.min(1, dist / 3000))); }
  moveWorld(dz);
  camX += (px * .5 - camX) * Math.min(1, dt * 6);
  for (const o of objs) {
    if (o.dead) continue;
    if (o.k === 'coin' || o.k === 'pow') {
      if (magnet > 0 && o.k === 'coin' && o.z < 30 && o.z > -2) { o.lane += (px - o.lane) * Math.min(1, dt * 7); o.y += (py + .85 - o.y) * Math.min(1, dt * 7); o.z -= dz * .6; }
      if (Math.abs(o.z) < 1.2 && Math.abs(o.lane - px) < .65 && Math.abs(o.y - (py + .85)) < 1.35) collect(o);
      continue;
    }
    if (o.z < .5 && o.z + o.len > -.5 && Math.abs(o.lane - px) < .52) {
      const blocks = o.k === 'bar' ? py < .95 : o.k === 'gate' ? !(slideT > 0 && py < .3) : true;
      if (blocks) { hit(o); if (state === 'crash') break; }
    }
  }
  const ms = Math.floor(dist / 500); if (ms > lastMs) { lastMs = ms; sfx.mile(); toast(ms * 500 + ' m!'); }
}
function moveWorld(dz) {
  objs.forEach(o => { o.z -= dz; });
  objs = objs.filter(o => !o.dead && o.z + (o.len || 0) > -8);
  bld.forEach(b => { b.z -= dz; }); bld = bld.filter(b => b.z + b.d > -10);
  [-1, 1].forEach(s => { edge[s] -= dz; while (edge[s] < ZF + 10) edge[s] += addBuilding(s, edge[s]) + rnd(.5, 3); });
}
function idleWorld(dt) { if (!bld.length) seedBuildings(); moveWorld(14 * dt); dist += 14 * dt; }

/* ---------- drawing ---------- */
function poly(pts, fill, alpha) { ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); }
function box(xl, xr, y0, y1, z0, z1, cF, cT, cS, a) {
  const f = [proj(xl, y0, z0), proj(xr, y0, z0), proj(xr, y1, z0), proj(xl, y1, z0)];
  const b = [proj(xl, y0, z1), proj(xr, y0, z1), proj(xr, y1, z1), proj(xl, y1, z1)];
  if ((xl + xr) / 2 < camX) poly([f[1], f[2], b[2], b[1]], cS, a); else poly([f[0], f[3], b[3], b[0]], cS, a);
  if (y1 < eyeH) poly([f[3], f[2], b[2], b[3]], cT, a);
  poly(f, cF, a);
  return f;
}
function stripes(f, c1, c2, n, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); f.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip();
  const x0 = f[0][0], x1 = f[1][0], yb = f[0][1], yt = f[3][1], w = (x1 - x0) / n;
  ctx.fillStyle = c1; ctx.fillRect(x0, yt, x1 - x0, yb - yt); ctx.fillStyle = c2;
  for (let i = -1; i < n; i += 2) { ctx.beginPath(); ctx.moveTo(x0 + i * w, yb); ctx.lineTo(x0 + (i + 1) * w, yb); ctx.lineTo(x0 + (i + 1) * w + (yt - yb) * -.5, yt); ctx.lineTo(x0 + i * w + (yt - yb) * -.5, yt); ctx.fill(); }
  ctx.restore();
}
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, '#07041a'); g.addColorStop(.55, '#2a1166'); g.addColorStop(1, '#ff5ab0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizonY + 2);
  if (!sky) { sky = { stars: Array.from({ length: 50 }, () => [Math.random() * W, Math.random() * horizonY * .75, Math.random() * 1.6 + .4, Math.random() * 6]), sk: [] }; let x = -20; while (x < W + 40) { const w = rnd(18, 48); sky.sk.push([x, w, rnd(10, horizonY * .3), Math.random() < .3]); x += w + rnd(0, 6); } }
  sky.stars.forEach(s => { ctx.globalAlpha = .4 + .5 * Math.sin(t * 2 + s[3]); ctx.fillStyle = '#fff'; ctx.fillRect(s[0], s[1], s[2], s[2]); });
  ctx.globalAlpha = 1;
  const r = Math.min(W * .22, H * .15), sx = cx - camX * 20, sy = horizonY - r * .3;
  const sg = ctx.createLinearGradient(0, sy - r, 0, sy + r); sg.addColorStop(0, '#ffe27a'); sg.addColorStop(1, '#ff4fa3');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a1670'; for (let i = 0; i < 5; i++) ctx.fillRect(sx - r, sy + r * (.05 + i * .17), r * 2, 2 + i * 1.6);
  const off = -camX * 14; ctx.fillStyle = '#1a0d45';
  sky.sk.forEach(b => { ctx.fillRect(b[0] + off, horizonY - b[2], b[1], b[2] + 2); if (b[3]) ctx.fillRect(b[0] + off + b[1] / 2 - 1, horizonY - b[2] - 12, 2, 12); });
}
function drawRoad() {
  const g = ctx.createLinearGradient(0, horizonY, 0, H); g.addColorStop(0, '#1b1050'); g.addColorStop(1, '#0c0726');
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, horizonY, W, H - horizonY);
  const L = proj(-1.5, 0, ZF), R = proj(1.5, 0, ZF), L0 = proj(-1.5, 0, -11), R0 = proj(1.5, 0, -11);
  const rg = ctx.createLinearGradient(0, horizonY, 0, H); rg.addColorStop(0, '#2c1b6e'); rg.addColorStop(1, '#171040');
  poly([L, R, R0, L0], rg, 1);
  const off = dist % 9;
  for (let z = -off - 9; z < ZF; z += 9) for (const x of [-.5, .5]) poly([proj(x - .04, 0, z), proj(x + .04, 0, z), proj(x + .04, 0, z + 4.5), proj(x - .04, 0, z + 4.5)], '#ffffff', clamp((ZF - z) / 40, 0, 1) * .4);
  const off2 = dist % 6; ctx.lineWidth = 1;
  for (let z = -off2; z < 70; z += 6) { const a = proj(-1.5, 0, z), b = proj(1.5, 0, z); ctx.globalAlpha = clamp((70 - z) / 70, 0, 1) * .12; ctx.strokeStyle = '#29e3d0'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const x of [-1.5, 1.5]) { const a = proj(x, 0, ZF), b = proj(x, 0, -11); ctx.lineWidth = 3; ctx.strokeStyle = x < 0 ? '#ff4fa3' : '#29e3d0'; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.shadowBlur = 0; }
}
const HUES = [['#2a1b74', '#3b2a99', '#1c1250'], ['#17315f', '#234a8c', '#10224a'], ['#4a1766', '#6a2491', '#32104a'], ['#17504f', '#228077', '#0f3736']];
const WIN = ['', '#ffc94a', '#29e3d0', '#ff4fa3'];
function drawBuilding(b) {
  const a = clamp((ZF - b.z) / 24, 0, 1), c = HUES[b.hue], x0 = b.side * 2.15, x1 = b.side * (2.15 + b.w);
  const xl = Math.min(x0, x1), xr = Math.max(x0, x1), z1 = b.z + b.d;
  box(xl, xr, 0, b.h, b.z, z1, c[0], c[1], c[2], a);
  // lit windows on the road-facing side
  for (let i = 0; i < b.nz; i++) for (let j = 0; j < b.ny; j++) {
    const w = b.win[i * b.ny + j]; if (!w) continue;
    const za = b.z + (i + .2) / b.nz * b.d, zb = b.z + (i + .75) / b.nz * b.d, ya = 1.1 + j * 2, yb = ya + 1.1;
    poly([proj(x0, ya, za), proj(x0, ya, zb), proj(x0, yb, zb), proj(x0, yb, za)], WIN[w], a * .85);
  }
  ctx.globalAlpha = a; const e = proj(x0, b.h, b.z), e2 = proj(x0, b.h, z1);
  ctx.strokeStyle = b.hue % 2 ? '#29e3d0' : '#ff4fa3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e2[0], e2[1]); ctx.stroke();
}
function drawObj(o) {
  const a = clamp((ZF - o.z) / 22, 0, 1);
  if (o.k === 'coin') {
    const [sx, sy, p] = proj(o.lane, o.y, o.z), r = .3 * S * p, sp = Math.abs(Math.cos(t * 6 + o.z * .5));
    ctx.globalAlpha = a; ctx.fillStyle = '#ffb81f'; ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(1, r * sp), r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(.5, r * sp * .65), r * .65, 0, 0, 7); ctx.fill();
  } else if (o.k === 'pow') {
    const [sx, sy, p] = proj(o.lane, o.y + Math.sin(t * 4) * .15, o.z), r = .5 * S * p;
    ctx.globalAlpha = a; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6); g.addColorStop(0, 'rgba(41,227,208,.9)'); g.addColorStop(1, 'rgba(41,227,208,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r * 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#12093a'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#29e3d0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = (r * 1.3) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(o.kind === 'shield' ? '🛡️' : o.kind === 'magnet' ? '🧲' : '✨', sx, sy + 1);
  } else if (o.k === 'bar') {
    const f = box(o.lane - .45, o.lane + .45, 0, 1, o.z, o.z + o.len, '#ffb81f', '#ffd66b', '#b57a00', a);
    stripes(f, '#ffb81f', '#2a1a05', 6, a);
    ctx.globalAlpha = a * .9; ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f[3][0], f[3][1]); ctx.lineTo(f[2][0], f[2][1]); ctx.stroke();
  } else if (o.k === 'gate') {
    const l = o.lane;
    box(l - .5, l - .36, 0, 3.4, o.z, o.z + o.len, '#7c5cff', '#a592ff', '#4b34b8', a);
    box(l + .36, l + .5, 0, 3.4, o.z, o.z + o.len, '#7c5cff', '#a592ff', '#4b34b8', a);
    const f = box(l - .5, l + .5, 1.15, 3.4, o.z, o.z + o.len, '#c2255f', '#ff6fa6', '#7d1240', a);
    const f2 = [f[0], f[1], proj(l + .5, 1.55, o.z), proj(l - .5, 1.55, o.z)]; stripes(f2, '#ff4fa3', '#220a28', 8, a);
    ctx.globalAlpha = a; ctx.fillStyle = '#ffe9f2'; ctx.font = 'bold ' + (.32 * S * f[0][2] * 0 + Math.max(6, (f[1][0] - f[0][0]) * .16)) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SLIDE ↓', (f[0][0] + f[1][0]) / 2, (f[2][1] + f2[2][1]) / 2 - 2);
  } else if (o.k === 'truck') {
    const l = o.lane, f = box(l - .46, l + .46, 0, 2.6, o.z, o.z + o.len, '#1fa89e', '#46e0d3', '#0f6a64', a);
    const w = [proj(l - .36, 1.5, o.z), proj(l + .36, 1.5, o.z), proj(l + .36, 2.25, o.z), proj(l - .36, 2.25, o.z)]; poly(w, '#0d0833', a);
    const wg = [proj(l - .36, 2.1, o.z), proj(l + .36, 2.1, o.z), proj(l + .36, 2.25, o.z), proj(l - .36, 2.25, o.z)]; poly(wg, '#29e3d0', a * .5);
    for (const sx of [-.32, .32]) { const q = proj(l + sx, .75, o.z); ctx.globalAlpha = a; ctx.fillStyle = '#fff6c2'; ctx.shadowColor = '#fff6c2'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(q[0], q[1], .09 * S * q[2], 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.globalAlpha = a; ctx.strokeStyle = '#a8fff6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f[3][0], f[3][1]); ctx.lineTo(f[2][0], f[2][1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function rr(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
function drawPlayer() {
  const [sx, , p] = proj(px, 0, 0), sy = groundY - py * S;
  ctx.globalAlpha = .35 * (1 - clamp(py / 4, 0, .6)); ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, groundY, .5 * S * (1 - py * .1), .13 * S, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (invul > 0 && state === 'play' && Math.floor(t * 20) % 2) ctx.globalAlpha = .45;
  ctx.save(); ctx.translate(sx, sy); ctx.scale(S, S);
  if (state === 'crash') { ctx.translate(0, -.85); ctx.rotate(crashT * 9); ctx.translate(0, .85); }
  const sl = slideT > 0 && py < .3; if (sl) ctx.scale(1.15, .55);
  const ph = t * 16, air = py > .05;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * .2, -.5); ctx.rotate(air ? (s > 0 ? .7 : -.25) : Math.sin(ph + (s > 0 ? Math.PI : 0)) * .6);
    rr(-.09, 0, .18, .42, .05, '#2b2470'); rr(-.12, .36, .24, .14, .05, s > 0 ? '#29e3d0' : '#ff4fa3'); ctx.restore();
  }
  ctx.strokeStyle = '#ff4fa3'; ctx.lineWidth = .11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-.18, -1.32);
  ctx.quadraticCurveTo(-.55, -1.2 + Math.sin(t * 12) * .08, -.85, -1.05 + Math.sin(t * 12 + 1) * .12); ctx.stroke();
  const bg = ctx.createLinearGradient(0, -1.3, 0, -.5); bg.addColorStop(0, '#8d6bff'); bg.addColorStop(1, '#4a34c2');
  rr(-.4, -1.32, .8, .82, .16, bg);
  const pg = ctx.createLinearGradient(0, -1.25, 0, -.6); pg.addColorStop(0, '#ff6fb0'); pg.addColorStop(1, '#c2255f');
  rr(-.3, -1.22, .6, .58, .1, pg); rr(-.22, -1.1, .44, .08, .04, '#ffe27a'); rr(-.22, -.95, .44, .05, .02, 'rgba(255,255,255,.5)');
  for (const s of [-1, 1]) { ctx.save(); ctx.translate(s * .46, -1.15); ctx.rotate(air ? -s * 1.1 : Math.sin(ph + (s > 0 ? 0 : Math.PI)) * .7); rr(-.07, 0, .14, .42, .06, '#d9d2ff'); ctx.restore(); }
  rr(-.3, -1.8, .6, .5, .2, '#ece8ff'); rr(-.3, -1.8, .6, .2, .2, '#7c5cff'); rr(-.05, -1.8, .1, .5, .03, '#29e3d0');
  for (const s of [-1, 1]) rr(s * .31 - .04, -1.62, .08, .16, .03, '#ff4fa3');
  ctx.strokeStyle = '#d9d2ff'; ctx.lineWidth = .05; ctx.beginPath(); ctx.moveTo(0, -1.8); ctx.lineTo(0, -2.02); ctx.stroke();
  ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ffc94a' : '#ff6fb0'; ctx.beginPath(); ctx.arc(0, -2.05, .07, 0, 7); ctx.fill();
  if (shield) { ctx.strokeStyle = 'rgba(41,227,208,.85)'; ctx.lineWidth = .06; ctx.fillStyle = 'rgba(41,227,208,.15)'; ctx.beginPath(); ctx.arc(0, -1, 1.15 + Math.sin(t * 8) * .05, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawSky(); drawRoad();
  const items = [];
  bld.forEach(b => items.push([b.z + b.d * .5, 0, b])); objs.forEach(o => { if (o.z < ZF + 10) items.push([o.z + (o.len || 0) * .5, o.k ? 1 : 0, o]); });
  if (state !== 'start') items.push([0, 2, null]);
  items.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, kind, o] of items) { if (kind === 2) drawPlayer(); else if (o.hue !== undefined) drawBuilding(o); else drawObj(o); }
  parts.forEach(p => { ctx.globalAlpha = clamp(p.l / 250, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); });
  ctx.globalAlpha = 1;
}
const cache = {};
function ui() {
  const v = { score: Math.floor(scoreF).toLocaleString(), coins, best: Math.max(best, Math.floor(scoreF)).toLocaleString() };
  for (const k in v) if (cache[k] !== v[k]) { cache[k] = v[k]; $(k).textContent = v[k]; }
  const arr = []; if (shield) arr.push(['🛡️', 'Shield', 1]); if (magnet > 0) arr.push(['🧲', 'Magnet', magnet / PW.magnet.t]); if (x2 > 0) arr.push(['✨', '×2', x2 / PW.x2.t]);
  const key = arr.map(a => a[0] + (a[2] * 20 | 0)).join(); if (cache.pw !== key) { cache.pw = key; $('powers').innerHTML = arr.map(a => `<div class="pw"><i>${a[0]}</i>${a[1]}<span class="bar"><u style="width:${a[2] * 100}%"></u></span></div>`).join(''); }
}

/* ---------- main loop ---------- */
let last = 0;
function frame(ts) { const dt = Math.min((ts - last) / 1000 || .016, .05); last = ts; update(dt); render(); ui(); requestAnimationFrame(frame); }

/* ---------- input ---------- */
const KM = { ArrowLeft: () => steer(-1), a: () => steer(-1), A: () => steer(-1), ArrowRight: () => steer(1), d: () => steer(1), D: () => steer(1),
  ArrowUp: jump, w: jump, W: jump, ' ': jump, ArrowDown: slide, s: slide, S: slide };
function toggleMute() { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; try { localStorage.setItem('skyline-sprint-mute', muted ? '1' : '0'); } catch (e) {} }
const togglePause = () => state === 'play' ? pause() : resume();
addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault();
  if (k === 'Enter' || (k === ' ' && (state === 'start' || state === 'over'))) { if (state === 'start' || state === 'over') start(); else if (state === 'pause') resume(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
  if (k === 'm' || k === 'M') { toggleMute(); return; }
  if (!e.repeat && KM[k]) KM[k]();
});
let sw = null;
cv.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, done: false }; });
cv.addEventListener('pointermove', e => {
  if (!sw || sw.done) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 26) return; sw.done = true;
  if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else slide();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => cv.addEventListener(ev, () => { sw = null; }));
addEventListener('blur', pause); document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('play').onclick = () => { if (state === 'pause') resume(); else start(); };
$('pbtn').onclick = togglePause; $('mute').onclick = toggleMute; $('mute').textContent = muted ? '🔇' : '🔊';
document.addEventListener('contextmenu', e => e.preventDefault());

resize(); seedBuildings(); overlay('Skyline Sprint', 'Run the neon skyline. Dodge, jump and slide as far as you can!', '▶ Play');
requestAnimationFrame(frame);
})();
