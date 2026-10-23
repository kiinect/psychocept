// Balloons (64x76, body centred at 32,34) and MOAB-class blimps (facing +x).
import { type Ctx, INK, ball, bar, ell, fs, glossy, lin, mix, poly, rr, rng, shine, star } from './draw';

export const BALLOON_IDS = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'purple', 'lead', 'zebra', 'rainbow', 'ceramic', 'super_ceramic'] as const;
export const BLIMP_IDS = ['moab', 'bfb', 'zomg', 'ddt', 'bad'] as const;
export const BLOON_OVERLAYS = ['camo', 'regrow', 'fortified'] as const;
export const BALLOON_W = 64, BALLOON_H = 76;
export const BLIMP_SIZE: Record<string, [number, number]> = { moab: [150, 90], bfb: [164, 100], zomg: [180, 112], ddt: [140, 80], bad: [196, 130] };

const COLORS: Record<string, string> = {
  red: '#ee3b3b', blue: '#2f8cf0', green: '#3fc43f', yellow: '#ffd91f', pink: '#ff7ac8', black: '#2d2d3a', white: '#f1f4fa',
  purple: '#9a4fe0', lead: '#8e96a8', zebra: '#f1f4fa', rainbow: '#ff7a3a', ceramic: '#c8793a', super_ceramic: '#a8562a',
};

function bodyPath(c: Ctx): void {
  c.beginPath(); c.moveTo(32, 3);
  c.bezierCurveTo(62, 1, 68, 42, 32, 62); c.bezierCurveTo(-4, 42, 2, 1, 32, 3); c.closePath();
}
export function drawBalloon(c: Ctx, id: string): void {
  const col = COLORS[id] ?? '#ee3b3b';
  // curly string + knot
  c.beginPath(); c.moveTo(32, 66); c.bezierCurveTo(24, 69, 40, 71, 31, 75); c.strokeStyle = INK; c.lineWidth = 3.4; c.lineCap = 'round'; c.stroke();
  c.strokeStyle = '#f4f0e6'; c.lineWidth = 1.4; c.stroke();
  poly(c, [32, 59, 24, 69, 40, 69], mix(col, -0.1), 2.8); ell(c, 32, 69, 7.5, 2.6, mix(col, -0.2), 2.4);
  bodyPath(c); fs(c, glossy(c, 32, 30, 32, col), 3.4);
  c.save(); bodyPath(c); c.clip();
  if (id === 'zebra') { for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 13 - 8, 0); c.lineTo(i * 13 + 2, 0); c.lineTo(i * 13 + 22, 70); c.lineTo(i * 13 + 12, 70); c.fillStyle = INK; c.fill(); } }
  if (id === 'rainbow') { ['#ff3b3b', '#ffa51f', '#ffe21f', '#3fc43f', '#2f8cf0', '#9a4fe0'].forEach((k, i) => { c.fillStyle = k; c.fillRect(0, 2 + i * 10.5, 64, 10.5); }); }
  if (id === 'lead') { for (const y of [18, 34, 50]) { c.fillStyle = 'rgba(40,46,64,.6)'; c.fillRect(0, y, 64, 3.5); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, y - 1.5, 64, 1.5); } }
  if (id === 'ceramic' || id === 'super_ceramic') {
    c.strokeStyle = INK; c.lineWidth = 2.2; c.lineJoin = 'round'; c.beginPath();
    c.moveTo(34, 6); c.lineTo(28, 20); c.lineTo(38, 28); c.lineTo(30, 40); c.moveTo(18, 22); c.lineTo(26, 28); c.moveTo(46, 36); c.lineTo(38, 40); c.stroke();
    if (id === 'super_ceramic') { c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(4, 30); c.lineTo(60, 30); c.stroke(); c.strokeStyle = '#ffd23c'; c.lineWidth = 3.4; c.stroke(); }
  }
  const sh = c.createLinearGradient(0, 30, 0, 64); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,10,40,.32)'); c.fillStyle = sh; c.fillRect(0, 30, 64, 40);
  c.beginPath(); c.ellipse(32, 30, 27, 26, 0, -0.5, 1.0); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 3; c.stroke(); // rim light
  c.restore();
  bodyPath(c); c.strokeStyle = INK; c.lineWidth = 3.4; c.lineJoin = 'round'; c.stroke();
  if (id === 'lead') for (const [x, y] of [[14, 20], [50, 20], [12, 36], [52, 36]]) ball(c, x, y, 2, '#d8deea', 1.2);
  // strong specular: crescent + hot dot
  c.beginPath(); c.ellipse(32, 28, 21, 21, 0, Math.PI * 1.08, Math.PI * 1.48); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke();
  shine(c, 20, 15, 5, 9, 0.5, 0.9); shine(c, 25, 30, 2, 2.6, 0.5, 0.85);
}

/** Overlays share the balloon silhouette; stack on top of the base sprite. */
export function drawOverlay(c: Ctx, kind: string): void {
  if (kind === 'camo') {
    c.save(); bodyPath(c); c.clip(); const r = rng(11);
    for (let i = 0; i < 11; i++) {
      const x = 8 + r() * 48, y = 6 + r() * 54, rx = 5 + r() * 7, ry = 3 + r() * 5, rot = r() * 3;
      c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fillStyle = ['#56793a', '#7a5f38', '#32482a'][i % 3]; c.fill(); c.lineWidth = 1.6; c.strokeStyle = 'rgba(20,20,10,.7)'; c.stroke();
    }
    c.restore(); bodyPath(c); c.strokeStyle = INK; c.lineWidth = 3.4; c.stroke(); shine(c, 20, 15, 4.5, 8.5, 0.5, 0.65);
  } else if (kind === 'regrow') {
    bodyPath(c); c.strokeStyle = INK; c.lineWidth = 7; c.setLineDash([6, 4]); c.stroke(); c.strokeStyle = '#ff5ad0'; c.lineWidth = 3.6; c.stroke(); c.setLineDash([]);
    star(c, 49, 13, 7, 3, 4, '#ffd0f4', 1.8); star(c, 13, 44, 5, 2.2, 4, '#ffd0f4', 1.6);
    ball(c, 32, 34, 8, '#ff9be8', 2.2); bar(c, 32, 40, 32, 33, '#2f9a2f', 1.6); ell(c, 28, 31, 3.6, 2, '#6bdc4a', 1.4, -0.5); ell(c, 36, 30, 3.6, 2, '#6bdc4a', 1.4, 0.5);
  } else {
    bodyPath(c); c.strokeStyle = INK; c.lineWidth = 9; c.stroke(); c.strokeStyle = lin(c, 0, 0, 64, 64, '#fff2a8', '#b8862a') as unknown as string; c.lineWidth = 5.4; c.stroke();
    bodyPath(c); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.2; c.stroke();
    for (const [x, y] of [[32, 4], [11, 20], [53, 20], [16, 42], [48, 42], [32, 60]]) ball(c, x, y, 3, '#ffe48a', 1.6);
  }
}

// ---- blimps (facing +x) ----
function seams(c: Ctx, cx: number, cy: number, rx: number, ry: number, xs: number[], bulge: number): void {
  for (const f of xs) {
    const x = cx + rx * f, k = Math.sqrt(Math.max(0, 1 - f * f)) * ry;
    c.beginPath(); c.ellipse(x, cy, bulge, k, 0, -Math.PI / 2, Math.PI / 2); c.strokeStyle = 'rgba(15,10,40,.75)'; c.lineWidth = 2.6; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x - 2, cy, bulge, k, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    for (let i = -3; i <= 3; i++) { const y = cy + (i / 3.4) * k; c.beginPath(); c.arc(x + bulge + 2.5, y, 1.4, 0, 7); c.fillStyle = 'rgba(255,255,255,.65)'; c.fill(); }
  }
}
function hullClip(c: Ctx, cx: number, cy: number, rx: number, ry: number, fn: () => void): void {
  c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.clip(); fn(); c.restore();
}
function fin(c: Ctx, x: number, cy: number, ry: number, col: string, len = 22): void {
  for (const d of [-1, 1]) poly(c, [x + 12, cy + d * 4, x - len * 0.6, cy + d * (ry + len * 0.5), x + 24, cy + d * (ry - 6)], mix(col, -0.25), 3.2);
}
function turret(c: Ctx, x: number, y: number, r: number, col = '#7a8396'): void {
  bar(c, x, y, x + r * 1.7, y - r * 0.5, '#3a4157', r * 0.5); ball(c, x, y, r, col, 2.6); ell(c, x, y, r * 0.4, r * 0.4, INK, 0);
}
function gondola(c: Ctx, x: number, y: number, w = 30): void {
  rr(c, x - w / 2, y, w, 12, 5, lin(c, 0, y, 0, y + 12, '#8c96ae', '#4a526a'), 3);
  for (let i = 0; i < 3; i++) ball(c, x - w / 3 + i * (w / 3), y + 6, 2.2, '#bfeaff', 1);
}
export function drawBlimp(c: Ctx, id: string): void {
  const [W, Hh] = BLIMP_SIZE[id]; const cx = W / 2 + 2, cy = Hh / 2 - 3;
  const base: Record<string, string> = { moab: '#2f86ec', bfb: '#e8403a', zomg: '#6a9a3a', ddt: '#3b3b4c', bad: '#8a2ab8' };
  const col = base[id];
  if (id === 'moab') {
    const rx = W / 2 - 18, ry = Hh / 2 - 18; fin(c, cx - rx, cy, ry, col);
    ell(c, cx, cy, rx, ry, glossy(c, cx - rx * 0.2, cy - ry * 0.55, rx, col), 4.5);
    hullClip(c, cx, cy, rx, ry, () => { c.fillStyle = '#f4f8ff'; c.fillRect(cx - rx, cy - 4, rx * 2, 9); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(cx - rx, cy + ry * 0.5, rx * 2, ry); });
    seams(c, cx, cy, rx, ry, [-0.55, 0.0, 0.5], 4);
    ell(c, cx, cy, rx, ry, 'rgba(0,0,0,0)', 4.5); shine(c, cx - rx * 0.35, cy - ry * 0.55, rx * 0.4, ry * 0.12, -0.1, 0.7);
    gondola(c, cx + 2, cy + ry - 4); star(c, cx + rx * 0.62, cy, ry * 0.36, ry * 0.16, 5, '#ffd23c', 2.5);
  } else if (id === 'bfb') {
    const rx = W / 2 - 18, ry = Hh / 2 - 12; fin(c, cx - rx, cy, ry, col, 30);
    ell(c, cx, cy, rx, ry, glossy(c, cx - rx * 0.2, cy - ry * 0.55, rx, col), 5);
    hullClip(c, cx, cy, rx, ry, () => { c.fillStyle = '#ffd23c'; c.fillRect(cx - rx, cy - ry * 0.28, rx * 2, ry * 0.2); c.fillRect(cx - rx, cy + ry * 0.2, rx * 2, ry * 0.14); c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(cx - rx, cy + ry * 0.55, rx * 2, ry); });
    seams(c, cx, cy, rx, ry, [-0.65, -0.25, 0.2, 0.6], 5);
    ell(c, cx, cy, rx, ry, 'rgba(0,0,0,0)', 5); shine(c, cx - rx * 0.35, cy - ry * 0.6, rx * 0.4, ry * 0.12, -0.1, 0.65);
    for (const d of [-1, 1]) { ball(c, cx + rx * 0.35, cy + d * ry * 0.62, 7, '#ffd23c', 3); ell(c, cx + rx * 0.35, cy + d * ry * 0.62, 3, 3, INK, 0); }
    rr(c, cx + rx * 0.55, cy - 9, 16, 18, 5, '#2e3447', 3); ell(c, cx + rx * 0.7, cy, 3, 6, '#ff6a4a', 1.5);
    gondola(c, cx - 4, cy + ry - 4, 36);
  } else if (id === 'zomg') {
    const rx = W / 2 - 6, ry = Hh / 2 - 26;
    for (const d of [-1, 1]) poly(c, [cx - rx + 22, cy + d * 6, cx - rx - 2, cy + d * (ry + 18), cx - rx + 44, cy + d * (ry - 2)], '#3a4a2a', 3.5);
    for (const d of [-1, 1]) rr(c, cx - rx - 4, cy + d * 14 - 6, 14, 12, 3, '#2e3447', 3);
    ell(c, cx, cy, rx, ry, glossy(c, cx - rx * 0.2, cy - ry * 0.6, rx, col), 5);
    hullClip(c, cx, cy, rx, ry, () => {
      c.fillStyle = '#34402a'; c.fillRect(cx - rx, cy - ry * 0.34, rx * 2, ry * 0.68); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(cx - rx, cy - ry * 0.34, rx * 2, 3);
      const g = c.createLinearGradient(cx + rx * 0.62, 0, cx + rx, 0); g.addColorStop(0, '#2a2f3d'); g.addColorStop(1, '#4a5266'); c.fillStyle = g; c.fillRect(cx + rx * 0.62, cy - ry, rx, ry * 2);
    });
    seams(c, cx, cy, rx, ry, [-0.7, -0.4, -0.1, 0.2, 0.5, 0.62], 4);
    ell(c, cx, cy, rx, ry, 'rgba(0,0,0,0)', 5); shine(c, cx - rx * 0.3, cy - ry * 0.7, rx * 0.5, ry * 0.1, -0.05, 0.55);
    for (const f of [-0.45, 0.05, 0.4]) turret(c, cx + rx * f, cy - ry + 3, 8.5);
    turret(c, cx + rx * 0.2, cy + ry - 3, 7, '#6a7388');
    for (let i = 0; i < 4; i++) ell(c, cx + rx * 0.7 + i * 5, cy - 3 + (i % 2) * 6, 2, 3, '#ff3b3b', 1.2);
    ell(c, cx + rx * 0.82, cy, 6, 9, '#ff5a3a', 2.5);
    for (let i = 0; i < 4; i++) ball(c, cx - rx * 0.78, cy - 14 + i * 9, 3.6, '#2e3447', 2);
    gondola(c, cx - 8, cy + ry - 4, 34);
  } else if (id === 'ddt') {
    const rx = W / 2 - 8, ry = Hh / 2 - 22;
    poly(c, [cx - 6, cy - 2, cx - 36, cy - ry - 22, cx - 22, cy - 2], '#2a2a38', 3.5); poly(c, [cx - 6, cy + 2, cx - 36, cy + ry + 20, cx - 22, cy + 2], '#2a2a38', 3.5);
    poly(c, [cx - rx + 8, cy, cx - rx - 12, cy - 14, cx - rx + 22, cy - 6], '#2a2a38', 3); poly(c, [cx - rx + 8, cy, cx - rx - 12, cy + 14, cx - rx + 22, cy + 6], '#2a2a38', 3);
    c.beginPath(); c.moveTo(cx - rx, cy - ry * 0.6); c.quadraticCurveTo(cx - rx * 0.2, cy - ry * 1.5, cx + rx * 0.7, cy - ry * 0.5); c.lineTo(cx + rx + 6, cy); c.lineTo(cx + rx * 0.7, cy + ry * 0.5); c.quadraticCurveTo(cx - rx * 0.2, cy + ry * 1.4, cx - rx, cy + ry * 0.6); c.closePath();
    fs(c, glossy(c, cx, cy - ry * 0.6, rx, col), 4.5);
    c.save(); c.clip(); const r = rng(5);
    for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 7 + r() * 8, 4 + r() * 5, r() * 3, 0, 7); c.fillStyle = ['#56793a', '#7a5f38', '#32482a'][i % 3]; c.fill(); c.lineWidth = 1.4; c.strokeStyle = 'rgba(10,10,10,.6)'; c.stroke(); }
    c.fillStyle = '#ff4a3a'; c.fillRect(cx + rx * 0.5, cy - ry * 1.4, 12, ry * 3); c.restore();
    ell(c, cx + rx * 0.35, cy - 4, 12, 5.5, '#7fd8ff', 2.5); shine(c, cx + rx * 0.3, cy - 6, 5, 1.6, 0, 0.9);
    for (const d of [-1, 1]) { rr(c, cx - rx - 2, cy + d * 9 - 4, 14, 8, 3, '#2e3447', 2.5); ell(c, cx - rx - 4, cy + d * 9, 4, 5, '#ffb02e', 1.5); }
    shine(c, cx - rx * 0.2, cy - ry * 0.6, rx * 0.4, ry * 0.1, -0.1, 0.5);
  } else {
    const rx = W / 2 - 14, ry = Hh / 2 - 22;
    for (let i = 0; i < 7; i++) { const x = cx - rx * 0.8 + i * (rx * 1.5 / 6); poly(c, [x - 7, cy - ry + 6, x + 1, cy - ry - 14, x + 9, cy - ry + 6], '#d8c8e8', 3.2); poly(c, [x - 7, cy + ry - 6, x + 1, cy + ry + 14, x + 9, cy + ry - 6], '#d8c8e8', 3.2); }
    for (const d of [-1, 1]) poly(c, [cx - rx + 14, cy + d * 8, cx - rx - 10, cy + d * (ry + 8), cx - rx + 40, cy + d * (ry - 4)], '#4a1a68', 3.5);
    ell(c, cx, cy, rx, ry, glossy(c, cx - rx * 0.2, cy - ry * 0.6, rx, col), 5.5);
    hullClip(c, cx, cy, rx, ry, () => {
      for (const d of [-1, 1]) { c.fillStyle = '#2a1a3c'; c.fillRect(cx - rx, d < 0 ? cy - ry : cy + ry * 0.55, rx * 2, ry * 0.45); }
      c.fillStyle = '#ff3a8a'; c.fillRect(cx - rx, cy - 3, rx * 2, 6); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(cx - rx, cy - 3, rx * 2, 2);
    });
    seams(c, cx, cy, rx, ry, [-0.6, -0.2, 0.2], 5);
    ell(c, cx, cy, rx, ry, 'rgba(0,0,0,0)', 5.5); shine(c, cx - rx * 0.35, cy - ry * 0.62, rx * 0.4, ry * 0.1, -0.1, 0.55);
    rr(c, cx + rx * 0.4, cy - 20, rx * 0.5, 40, 8, lin(c, 0, cy - 20, 0, cy + 20, '#5a4a70', '#2a1f3a'), 3.5);
    poly(c, [cx + rx * 0.45, cy - 12, cx + rx * 0.62, cy - 6, cx + rx * 0.45, cy - 4], '#ff3a3a', 2); poly(c, [cx + rx * 0.85, cy - 12, cx + rx * 0.68, cy - 6, cx + rx * 0.85, cy - 4], '#ff3a3a', 2);
    for (let i = 0; i < 5; i++) poly(c, [cx + rx * 0.45 + i * rx * 0.1, cy + 6, cx + rx * 0.5 + i * rx * 0.1, cy + 16, cx + rx * 0.55 + i * rx * 0.1, cy + 6], '#f4f4f8', 1.6);
    turret(c, cx - rx * 0.4, cy - ry + 4, 10); turret(c, cx + rx * 0.05, cy - ry + 2, 10); turret(c, cx - rx * 0.2, cy + ry - 2, 9, '#6a7388');
    gondola(c, cx - 14, cy + ry - 5, 40);
  }
}
