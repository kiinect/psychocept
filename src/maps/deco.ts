// No-build objects: visuals sized to match the blocking circles (tree r=20, rock r=12, bush r=11, flower r=4).
import { type Ctx, type Rng, css, lit, drk, pick } from './util';
import type { Deco } from './maps';
import type { Theme } from './paint';

const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fill(); };
const poly = (c: Ctx, pts: number[][], col: string) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
function shadow(c: Ctx, x: number, y: number, r: number, a = 0.38) {
  c.save(); c.translate(x + r * 0.22, y + r * 0.45); c.scale(1, 0.5);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.3); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.65, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 1.3, 0, 7); c.fill(); c.restore();
}
function blobs(c: Ctx, x: number, y: number, r: number, cols: [number, number, number], rnd: Rng, n = 6) {
  const ps = Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.283 + rnd(); return [x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.45, r * (0.5 + rnd() * 0.12)]; });
  c.lineWidth = 2; c.strokeStyle = css(drk(cols[0], 0.35));
  for (const [px, py, pr] of ps) { c.beginPath(); c.arc(px, py, pr, 0, 7); c.fillStyle = css(cols[0]); c.fill(); c.stroke(); }
  for (const [px, py, pr] of ps) { ell(c, px - pr * 0.12, py - pr * 0.16, pr * 0.8, pr * 0.74, css(cols[1])); }
  for (const [px, py, pr] of ps) { ell(c, px - pr * 0.28, py - pr * 0.36, pr * 0.45, pr * 0.38, css(cols[2], 0.9)); }
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = rnd() * r * 0.75; ell(c, x + Math.cos(a) * d - 2, y + Math.sin(a) * d * 0.9 - 4, 2.2, 1.6, css(lit(cols[2], 0.35), 0.8), rnd() * 3); }
}
const star = (c: Ctx, x: number, y: number, ro: number, ri: number, n: number, rot: number) => {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, q = i % 2 ? ri : ro; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath();
};

function tree(c: Ctx, x: number, y: number, T: Theme, r: Rng) {
  const k = T.tree; shadow(c, x, y, 20, k === 'cube' ? 0.3 : 0.4);
  if (k === 'oak') {
    const g = pick(r, [[0x2a7a35, 0x3f9a45, 0x6bc45a], [0x2f8038, 0x48a548, 0x78d060], [0x277336, 0x3a9444, 0x62bb55]]) as [number, number, number];
    ell(c, x + 1, y + 10, 5, 3, css(0x5a3418)); blobs(c, x, y - 2, 21, g, r, 6);
  } else if (k === 'mushroom') {
    const cap = pick(r, [0xd8473b, 0xe08a2e, 0x9b6ad0, 0x3fa6c8]);
    ell(c, x, y + 4, 8, 11, css(0xf4e8cf)); ell(c, x, y - 1, 20, 17, css(drk(cap, 0.35))); ell(c, x, y - 3, 19, 15, css(cap)); ell(c, x - 4, y - 8, 12, 7, css(lit(cap, 0.35), 0.8));
    for (const [dx, dy, s] of [[-8, -2, 3], [6, -6, 3.5], [9, 2, 2.4], [-1, 3, 2.6], [-5, -9, 2]]) ell(c, x + dx, y + dy, s, s * 0.8, css(0xfff6e0, 0.95));
  } else if (k === 'palm') {
    ell(c, x, y, 3, 3, css(0x5a3a1a));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + 0.2; c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = css(i % 2 ? 0x2f8f3a : 0x3fa844); c.strokeStyle = css(0x1d5f2a); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -9, 23, 0); c.quadraticCurveTo(10, 9, 0, 0); c.fill(); c.stroke();
      c.strokeStyle = css(0x9be062, 0.8); c.beginPath(); c.moveTo(1, 0); c.lineTo(21, 0); c.stroke(); c.restore();
    }
    ell(c, x - 1.5, y - 1, 2.8, 2.8, css(0x6b4a24)); ell(c, x + 2, y + 1.5, 2.8, 2.8, css(0x5a3a1a));
  } else if (k === 'pine') {
    for (const [s, col] of [[22, 0x1f4a2e], [17, 0x2b6a3c], [11, 0x3a8a4c], [5, 0x6bc47a]] as const) { star(c, x, y - 1, s, s * 0.62, 9, s); c.fillStyle = css(col); c.fill(); c.strokeStyle = css(drk(col, 0.4)); c.lineWidth = 1; c.stroke(); }
  } else if (k === 'cube') {
    const col = pick(r, [0xe85d75, 0x5dc0e8, 0xf2c14e, 0x7bd88f, 0xb48be8]), s = 19, h = s * 0.5;
    poly(c, [[x, y - s], [x + s * 0.87, y - h], [x, y], [x - s * 0.87, y - h]], css(lit(col, 0.35)));
    poly(c, [[x - s * 0.87, y - h], [x, y], [x, y + s], [x - s * 0.87, y + h]], css(drk(col, 0.1)));
    poly(c, [[x + s * 0.87, y - h], [x, y], [x, y + s], [x + s * 0.87, y + h]], css(drk(col, 0.4)));
    c.strokeStyle = css(0x20244a, 0.7); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.87, y - h); c.lineTo(x + s * 0.87, y + h); c.lineTo(x, y + s); c.lineTo(x - s * 0.87, y + h); c.lineTo(x - s * 0.87, y - h); c.closePath(); c.moveTo(x - s * 0.87, y - h); c.lineTo(x, y); c.lineTo(x + s * 0.87, y - h); c.moveTo(x, y); c.lineTo(x, y + s); c.stroke();
  } else if (k === 'tire') {
    for (const dy of [3, -3]) { ell(c, x, y + dy, 19, 17, css(0x16161a)); ell(c, x, y + dy - 1, 17, 15, css(0x2f2f36)); ell(c, x, y + dy - 1, 10, 9, css(0x14141a)); ell(c, x - 5, y + dy - 7, 8, 3, css(0x6a6a74, 0.5)); }
    ell(c, x, y - 4, 5, 4.5, css(0x777c88)); ell(c, x, y - 4, 2, 2, css(0x2a2a30));
  } else if (k === 'hay') {
    ell(c, x, y, 19, 18, css(0x9a6a1c)); ell(c, x, y - 1, 18, 17, css(0xe0b44a));
    c.strokeStyle = css(0xb88a2c, 0.8); c.lineWidth = 1.6; for (let q = 3; q < 17; q += 3.4) { c.beginPath(); c.arc(x, y - 1, q, 0.5, 5.4); c.stroke(); }
    c.strokeStyle = css(0xf8dc82, 0.9); c.lineWidth = 1.4; for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = r() * 14; c.beginPath(); c.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a + 0.5) * (d + 4), y + Math.sin(a + 0.5) * (d + 4)); c.stroke(); }
    c.strokeStyle = css(0x7a5a2a, 0.8); c.lineWidth = 2; c.beginPath(); c.moveTo(x - 17, y - 3); c.lineTo(x + 17, y - 3); c.stroke();
  } else if (k === 'column') {
    ell(c, x, y + 2, 20, 18, css(0x7c8486)); ell(c, x, y - 1, 19, 17, css(0xe8ecea));
    c.strokeStyle = css(0xb4bcba); c.lineWidth = 1.4; for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283; c.beginPath(); c.moveTo(x + Math.cos(a) * 7, y - 1 + Math.sin(a) * 6.5); c.lineTo(x + Math.cos(a) * 17, y - 1 + Math.sin(a) * 15.5); c.stroke(); }
    ell(c, x, y - 1, 7, 6.5, css(0x6a7a7a)); ell(c, x, y - 2, 5, 4.5, css(0x4a5a5e));
    ell(c, x + 8, y + 6, 6, 3.5, css(0x4a9a6a, 0.6)); ell(c, x - 9, y - 7, 5, 3, css(0x4a9a6a, 0.5));
    c.strokeStyle = css(0x5a6a68, 0.7); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 10, y - 12); c.lineTo(x + 6, y - 5); c.lineTo(x + 9, y); c.stroke();
  } else if (k === 'logs') {
    for (const [dx, dy] of [[-9.5, 6], [9.5, 6], [0, -8]]) {
      ell(c, x + dx, y + dy + 1.5, 11, 10, css(0x4a2e18)); ell(c, x + dx, y + dy, 10.5, 9.5, css(0x7a4a26)); ell(c, x + dx, y + dy, 8, 7.2, css(0xd8a866));
      c.strokeStyle = css(0xa87a3c, 0.8); c.lineWidth = 1; for (const q of [2.5, 4.8, 6.6]) { c.beginPath(); c.ellipse(x + dx, y + dy, q, q * 0.9, 0, 0, 7); c.stroke(); }
    }
  } else if (k === 'dead') {
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283 + r() * 0.5; let px = x, py = y, aa = a;
      for (const [w, col] of [[5, 0x14141c], [3, 0x4a4650]] as const) { c.strokeStyle = css(col); c.lineWidth = w; c.beginPath(); px = x; py = y; aa = a; c.moveTo(px, py); for (let s = 0; s < 3; s++) { aa += (r() - 0.5) * 0.9; px += Math.cos(aa) * 6.5; py += Math.sin(aa) * 6.2; c.lineTo(px, py); } c.stroke(); }
      c.strokeStyle = css(0x4a4650); c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(aa + 0.7) * 5, py + Math.sin(aa + 0.7) * 5); c.stroke();
    }
    ell(c, x, y, 5, 4.5, css(0x2a2830)); ell(c, x - 1, y - 1, 3, 2.5, css(0x6a6672));
  } else { // planter
    ell(c, x, y + 2, 20, 18, css(0x6a6e78)); ell(c, x, y, 19, 17, css(0xb8bcc6)); ell(c, x, y, 15, 13.5, css(0x4a3a2a));
    blobs(c, x, y - 2, 15, [0x2f8a3a, 0x48a848, 0x7ad060], r, 5);
    for (let i = 0; i < 6; i++) ell(c, x + (r() - 0.5) * 18, y + (r() - 0.5) * 14 - 3, 2, 2, css(pick(r, [0xff6a8a, 0xffd84a, 0xffffff])));
  }
}

function rock(c: Ctx, x: number, y: number, T: Theme, r: Rng) {
  const k = T.rock; shadow(c, x, y, 12, 0.4);
  if (k === 'barrel') {
    ell(c, x, y + 2, 12, 11, css(0x4a2e14)); ell(c, x, y, 11.5, 10.5, css(0x9a6a34)); ell(c, x, y, 8.5, 7.5, css(0xc08a4a));
    c.strokeStyle = css(0x4a2e14, 0.6); c.lineWidth = 1; for (const q of [-4, 0, 4]) { c.beginPath(); c.moveTo(x + q, y - 7); c.lineTo(x + q, y + 7); c.stroke(); }
    c.strokeStyle = css(0x555a64); c.lineWidth = 1.6; c.beginPath(); c.ellipse(x, y, 8.6, 7.6, 0, 0, 7); c.stroke(); ell(c, x - 3, y - 4, 4, 2, css(0xffffff, 0.3));
  } else if (k === 'crate') {
    c.save(); c.translate(x, y); c.rotate((r() - 0.5) * 0.6);
    const col = pick(r, [0x9a6a34, 0x6c8a96, 0xa8523a]); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-9, -7, 20, 20);
    c.fillStyle = css(drk(col, 0.4)); c.fillRect(-10, -10, 20, 20); c.fillStyle = css(col); c.fillRect(-8.5, -8.5, 17, 17);
    c.strokeStyle = css(drk(col, 0.4)); c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8.5, -8.5); c.lineTo(8.5, 8.5); c.moveTo(8.5, -8.5); c.lineTo(-8.5, 8.5); c.stroke(); c.fillStyle = css(lit(col, 0.3), 0.7); c.fillRect(-8.5, -8.5, 17, 2.5); c.restore();
  } else if (k === 'coral') {
    const col = pick(r, [0xf26a8a, 0xff9a4a, 0xb86ae0]);
    ell(c, x, y + 3, 9, 5, css(0x7a7060)); c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = -2.6 + i * 0.42; for (const [w, cc] of [[5, drk(col, 0.25)], [3, col]] as const) { c.strokeStyle = css(cc); c.lineWidth = w; c.beginPath(); c.moveTo(x, y + 3); c.quadraticCurveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 11, y + Math.sin(a) * 11); c.stroke(); } ell(c, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 2.2, 2.2, css(lit(col, 0.5))); }
  } else if (k === 'prism') {
    const col = pick(r, [0xb48be8, 0xe85d75, 0x5dc0e8, 0xf2c14e]);
    poly(c, [[x, y - 11], [x - 12, y + 7], [x, y + 11]], css(lit(col, 0.2))); poly(c, [[x, y - 11], [x + 12, y + 7], [x, y + 11]], css(drk(col, 0.35)));
    c.strokeStyle = css(0x20244a, 0.7); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y - 11); c.lineTo(x - 12, y + 7); c.lineTo(x, y + 11); c.lineTo(x + 12, y + 7); c.closePath(); c.moveTo(x, y - 11); c.lineTo(x, y + 11); c.stroke();
  } else {
    const base = T.ground[0] > 0x700000 && T.ground[0] < 0xa00000 ? 0x8a7e72 : 0x8e949c, n = 9, pts: number[][] = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + 0.3, q = 10.5 + r() * 2.2; pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q * 0.82]); }
    poly(c, pts.map(([px, py]) => [px + 1, py + 2.5]), css(drk(base, 0.5))); poly(c, pts, css(base));
    poly(c, pts.map(([px, py]) => [x + (px - x) * 0.82 - 1, y + (py - y) * 0.78 - 1.5]), css(lit(base, 0.22)));
    poly(c, pts.map(([px, py]) => [x + (px - x) * 0.46 - 2.5, y + (py - y) * 0.4 - 3]), css(lit(base, 0.5), 0.85));
    c.strokeStyle = css(drk(base, 0.55), 0.8); c.lineWidth = 1.4; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.stroke();
    c.strokeStyle = css(drk(base, 0.4), 0.7); c.lineWidth = 1; c.beginPath(); c.moveTo(x + 2, y - 2); c.lineTo(x + 5, y + 3); c.stroke();
    if (T.tufts > 100) ell(c, x - 5, y - 4, 4, 2.4, css(0x6aa84a, 0.85), -0.5);
  }
}

export function drawDeco(c: Ctx, d: Deco, T: Theme, r: Rng) {
  if (d.kind === 'tree') tree(c, d.x, d.y, T, r);
  else if (d.kind === 'rock') rock(c, d.x, d.y, T, r);
  else if (d.kind === 'bush') {
    shadow(c, d.x, d.y, 11, 0.3); blobs(c, d.x, d.y, 12, T.rock === 'barrel' || T.tree === 'oak' || T.tree === 'planter' ? [0x2f8a3a, 0x48a848, 0x7ad060] : [0x4a7a3a, 0x68a048, 0x98c868], r, 4);
    for (let i = 0; i < 3; i++) ell(c, d.x + (r() - 0.5) * 12, d.y + (r() - 0.5) * 8, 1.7, 1.7, css(pick(r, [0xe84a5a, 0xffd84a])));
  } else {
    const col = pick(r, [0xffe14d, 0xff7aa8, 0xffffff, 0xb48be8, 0xff9a4a]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; ell(c, d.x + Math.cos(a) * 2.8, d.y + Math.sin(a) * 2.8, 2.2, 2.2, css(col)); }
    ell(c, d.x, d.y, 1.8, 1.8, css(0xf08a24));
  }
}
