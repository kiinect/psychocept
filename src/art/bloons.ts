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
  // string + knot
  c.beginPath(); c.moveTo(32, 66); c.quadraticCurveTo(26, 71, 33, 75); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
  poly(c, [32, 60, 25, 69, 39, 69], mix(col, -0.15), 2.8);
  bodyPath(c); fs(c, glossy(c, 32, 30, 32, col), 3.2);
  c.save(); bodyPath(c); c.clip();
  if (id === 'zebra') { for (let i = -2; i < 6; i++) { c.beginPath(); c.moveTo(i * 13 - 8, 0); c.lineTo(i * 13 + 2, 0); c.lineTo(i * 13 + 22, 70); c.lineTo(i * 13 + 12, 70); c.fillStyle = INK; c.fill(); } }
  if (id === 'rainbow') { ['#ff3b3b', '#ffa51f', '#ffe21f', '#3fc43f', '#2f8cf0', '#9a4fe0'].forEach((k, i) => { c.fillStyle = k; c.fillRect(0, 2 + i * 10.5, 64, 10.5); }); }
  if (id === 'lead') { for (const y of [18, 34, 50]) { c.fillStyle = 'rgba(40,46,64,.55)'; c.fillRect(0, y, 64, 3.5); } }
  if (id === 'ceramic' || id === 'super_ceramic') {
    c.strokeStyle = INK; c.lineWidth = 2; c.beginPath();
    c.moveTo(34, 8); c.lineTo(28, 20); c.lineTo(38, 28); c.lineTo(30, 40); c.moveTo(18, 22); c.lineTo(26, 28); c.moveTo(46, 36); c.lineTo(38, 40); c.stroke();
    if (id === 'super_ceramic') { c.strokeStyle = '#ffd23c'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, 30); c.lineTo(58, 30); c.stroke(); }
  }
  // soft bottom shade for volume
  const sh = c.createLinearGradient(0, 30, 0, 64); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(20,10,40,.28)'); c.fillStyle = sh; c.fillRect(0, 30, 64, 40);
  c.restore();
  bodyPath(c); c.strokeStyle = INK; c.lineWidth = 3.2; c.lineJoin = 'round'; c.stroke();
  if (id === 'lead') for (const [x, y] of [[14, 20], [50, 20], [12, 36], [52, 36]]) ball(c, x, y, 1.8, '#d8deea', 1);
  shine(c, 21, 17, 4.5, 9, 0.5, 0.75); shine(c, 25, 29, 1.8, 2.4, 0.5, 0.6);
}

/** Overlays share the balloon silhouette; stack on top of the base sprite. */
export function drawOverlay(c: Ctx, kind: string): void {
  if (kind === 'camo') {
    c.save(); bodyPath(c); c.clip(); const r = rng(11);
    for (let i = 0; i < 12; i++) { c.fillStyle = ['rgba(72,98,40,.72)', 'rgba(110,86,48,.7)', 'rgba(40,60,30,.7)'][i % 3]; c.beginPath(); c.ellipse(8 + r() * 48, 6 + r() * 56, 5 + r() * 7, 3 + r() * 5, r() * 3, 0, 7); c.fill(); }
    c.restore(); bodyPath(c); c.strokeStyle = INK; c.lineWidth = 3.2; c.stroke(); shine(c, 21, 17, 4, 8, 0.5, 0.5);
  } else if (kind === 'regrow') {
    bodyPath(c); c.strokeStyle = '#ff5ad0'; c.lineWidth = 2.6; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]);
    star(c, 48, 14, 6, 2.6, 4, '#ff9be8', 1.6); star(c, 14, 42, 4.5, 2, 4, '#ff9be8', 1.4);
  } else {
    bodyPath(c); c.strokeStyle = INK; c.lineWidth = 8; c.stroke(); c.strokeStyle = lin(c, 0, 0, 64, 64, '#fff2a8', '#b8862a') as unknown as string; c.lineWidth = 4.6; c.stroke();
    for (const [x, y] of [[32, 4], [11, 20], [53, 20], [16, 42], [48, 42]]) ball(c, x, y, 2.6, '#ffe48a', 1.4);
  }
}

// ---- blimps ----
export function drawBlimp(c: Ctx, id: string): void {
  const [W, Hh] = BLIMP_SIZE[id]; const cx = W / 2 + 4, cy = Hh / 2 - 2;
  const rx = W / 2 - 20, ry = Hh / 2 - 16;
  const base: Record<string, string> = { moab: '#2f86ec', bfb: '#e8403a', zomg: '#4ac04a', ddt: '#3a3a4a', bad: '#a43ad0' };
  const col = base[id];
  // tail fins
  poly(c, [cx - rx + 8, cy, cx - rx - 14, cy - ry - 10, cx - rx + 18, cy - ry + 4], mix(col, -0.2), 3);
  poly(c, [cx - rx + 8, cy, cx - rx - 14, cy + ry + 10, cx - rx + 18, cy + ry - 4], mix(col, -0.2), 3);
  // body
  ell(c, cx, cy, rx, ry, glossy(c, cx - rx * 0.2, cy - ry * 0.5, rx, col), 4);
  c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.clip();
  c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(cx - rx, cy - 3, rx * 2, 8);
  c.fillStyle = mix(col, -0.3); c.fillRect(cx + rx * 0.35, cy - ry, 6, ry * 2); c.fillRect(cx - rx * 0.2, cy - ry, 6, ry * 2);
  if (id === 'ddt') { const r = rng(5); for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? 'rgba(80,110,50,.8)' : 'rgba(110,84,48,.8)'; c.beginPath(); c.ellipse(cx - rx + r() * rx * 2, cy - ry + r() * ry * 2, 7 + r() * 8, 4 + r() * 5, r() * 3, 0, 7); c.fill(); } }
  c.restore();
  ell(c, cx, cy, rx, ry, 'rgba(0,0,0,0)', 4);
  shine(c, cx - rx * 0.35, cy - ry * 0.5, rx * 0.35, ry * 0.12, -0.12, 0.55);
  // gondola & emblem
  rr(c, cx - 14, cy + ry - 4, 28, 12, 5, '#6a748c', 3);
  star(c, cx + rx * 0.62, cy, ry * 0.32, ry * 0.15, 5, '#fff', 2);
  if (id === 'zomg' || id === 'bad') { // turrets
    for (const x of [-0.4, 0.15]) { ball(c, cx + rx * x, cy - ry + 2, 8, '#7a8396', 2.5); bar(c, cx + rx * x, cy - ry + 2, cx + rx * x + 12, cy - ry - 5, '#4a5266', 4); }
  }
  if (id === 'bfb') for (const y of [-0.45, 0.45]) ball(c, cx + rx * 0.2, cy + ry * y, 5, '#ffd23c', 2);
  if (id === 'ddt') { ell(c, cx + rx * 0.5, cy - 3, 11, 5, '#7fd8ff', 2); poly(c, [cx - 10, cy - 6, cx - 34, cy - ry - 10, cx - 20, cy - 2], mix(col, 0.1), 3); }
  if (id === 'bad') {
    for (let i = 0; i < 6; i++) poly(c, [cx - rx + i * 24 + 6, cy - ry + 4, cx - rx + i * 24 + 14, cy - ry - 14, cx - rx + i * 24 + 22, cy - ry + 4], '#ffd23c', 3);
    ell(c, cx + rx * 0.55, cy - 4, 12, 7, '#ff3a8a', 2.5);
  }
}
