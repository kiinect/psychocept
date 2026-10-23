// Per-map ground dressing painted over the noise base (before tufts, water, path).
import { type Ctx, type Rng, css, mix, lit, drk, pick, laneDist, inWater, free, vnoise } from './util';
import type { MapDef } from './maps';
import type { Theme } from './paint';

const W = 960, H = 540;
const dot = (c: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fill(); };
const jag = (c: Ctx, r: Rng, x: number, y: number, ang: number, len: number, col: string, w: number) => {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
  for (let d = 0; d < len; d += 6) { ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * 6; y += Math.sin(ang) * 6; c.lineTo(x, y); }
  c.stroke();
};
const soft = (c: Ctx, x: number, y: number, rad: number, col: number, a: number) => {
  const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, css(col, a)); g.addColorStop(1, css(col, 0));
  c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};

export function stumpGround(c: Ctx, r: Rng, _m: MapDef, T: Theme) {
  const cx = 480, cy = 270, rx = 440, ry = 250;
  // roots reaching over the grass
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283 + 0.3 + r() * 0.2, sx = cx + Math.cos(a) * rx * 0.9, sy = cy + Math.sin(a) * ry * 0.9, ex = cx + Math.cos(a + 0.12) * rx * 1.55, ey = cy + Math.sin(a + 0.12) * ry * 1.7;
    for (const [w, col] of [[30, 0x2f1f12], [24, 0x6b4526], [14, 0x8d6137], [5, 0xa87a48]] as const) {
      c.strokeStyle = css(col); c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx, sy);
      c.quadraticCurveTo((sx + ex) / 2 + 40 * (r() - 0.5), (sy + ey) / 2 + 40 * (r() - 0.5), ex, ey); c.stroke();
    }
  }
  c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
  c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 24; c.shadowOffsetY = 14;
  c.fillStyle = css(0x4e341e); c.beginPath(); c.arc(0, 0, rx + 10, 0, 7); c.fill(); c.shadowColor = 'transparent';
  // bark ridges
  for (let a = 0; a < 6.283; a += 0.035) { const L = 8 + r() * 10; c.strokeStyle = css(pick(r, [0x3c2814, 0x5c3d22, 0x6b4a2a]), 0.8); c.lineWidth = 3; c.beginPath(); c.moveTo(Math.cos(a) * (rx + 10), Math.sin(a) * (rx + 10)); c.lineTo(Math.cos(a) * (rx - L + 4), Math.sin(a) * (rx - L + 4)); c.stroke(); }
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, css(0xe6bd82)); g.addColorStop(0.7, css(0xd2a468)); g.addColorStop(1, css(0xb98650));
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx - 12, 0, 7); c.fill();
  for (let k = 1; k < 30; k++) {
    const rr = (rx - 14) * (k / 30) + (r() - 0.5) * 2; c.strokeStyle = css(k % 3 ? 0x9a6a38 : 0x7a4f28, k % 3 ? 0.28 : 0.4); c.lineWidth = k % 3 ? 1.6 : 3;
    c.beginPath(); for (let a = 0; a <= 6.4; a += 0.2) { const q = rr + Math.sin(a * 3 + k) * 2.2 + Math.sin(a * 7 + k * 2) * 1; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.stroke();
  }
  for (let i = 0; i < 9; i++) { const a = r() * 6.283; c.strokeStyle = css(0x6a4524, 0.5); c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * rx * (0.5 + r() * 0.45), Math.sin(a) * rx * (0.5 + r() * 0.45)); c.stroke(); }
  c.restore();
  void T;
}

export function townGround(c: Ctx, r: Rng, m: MapDef) {
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = css(0x6c6a63, 0.55);
  c.lineWidth = 122; for (const l of m.lanes) { c.beginPath(); l.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
  c.strokeStyle = css(0x908c82); c.lineWidth = 110;
  for (const l of m.lanes) { c.beginPath(); l.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H, d = laneDist(m, x, y); if (d > 52 || d < 20) continue;
    const base = pick(r, [0xa8a49a, 0x9a968c, 0xb6b2a6, 0x8c887e]), rx = 5 + r() * 3, ry = rx * 0.78;
    dot(c, x, y + 1, rx + 1, ry + 1, css(0x4f4c46, 0.8)); dot(c, x, y, rx, ry, css(base)); dot(c, x - 1, y - 1.5, rx * 0.6, ry * 0.5, css(lit(base, 0.3), 0.7));
  }
  // ruts of bright paving flowers
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; if (laneDist(m, x, y) < 62 && laneDist(m, x, y) > 50) dot(c, x, y, 2, 2, css(pick(r, [0xffffff, 0xffd84a, 0xff8ab0]))); }
}

export function cubismGround(c: Ctx, r: Rng, m: MapDef) {
  const pal = [0x7fa3bb, 0x6f94ad, 0x8db4c8, 0x7ba0a8, 0x9ab4c4, 0x7690b8];
  for (let y = 0; y < H; y += 30) for (let x = 0; x < W; x += 30) {
    const col = pick(r, pal) as number; c.fillStyle = css(col); c.fillRect(x, y, 30, 30);
    c.fillStyle = css(0xffffff, 0.2); c.fillRect(x, y, 30, 2); c.fillRect(x, y, 2, 30);
    c.fillStyle = css(0x203050, 0.22); c.fillRect(x, y + 28, 30, 2); c.fillRect(x + 28, y, 2, 30);
  }
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = r() * H, s = 40 + r() * 90, col = pick(r, [0xe85d75, 0xf2c14e, 0x5dc0e8, 0xb48be8, 0x7bd88f, 0xffffff]);
    c.fillStyle = css(col, 0.13); c.beginPath(); c.moveTo(x, y); c.lineTo(x + s, y + (r() - 0.5) * s); c.lineTo(x + s * r(), y + s); c.closePath(); c.fill();
    c.strokeStyle = css(0x20305a, 0.12); c.lineWidth = 2; c.stroke();
  }
  void m;
}

export function forestGround(c: Ctx, r: Rng, m: MapDef) {
  for (let i = 0; i < 14; i++) soft(c, r() * W, r() * H, 70 + r() * 60, 0x0c2a14, 0.28);
  for (let i = 0; i < 1500; i++) {
    const x = r() * W, y = r() * H; if (laneDist(m, x, y) < 24) continue;
    dot(c, x, y, 2.5 + r() * 2, 1.4 + r(), css(pick(r, [0x8a5a2a, 0xb07a30, 0x6a4a22, 0xc89a40, 0x5f7a2e]), 0.55), r() * 3);
  }
  for (let i = 0; i < 70; i++) { // ferns
    const x = r() * W, y = r() * H; if (laneDist(m, x, y) < 34 || inWater(m, x, y, 10)) continue;
    c.strokeStyle = css(pick(r, [0x4ea04a, 0x68b85a]), 0.85); c.lineWidth = 2; c.lineCap = 'round';
    for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7 - 4, x + Math.cos(a) * 13, y + Math.sin(a) * 13); c.stroke(); }
  }
  for (let i = 0; i < 16; i++) soft(c, r() * W, r() * H, 50 + r() * 40, 0xf4ffb0, 0.1);
}

export function scrapGround(c: Ctx, r: Rng, m: MapDef) {
  for (let i = 0; i < 9; i++) soft(c, r() * W, r() * H, 40 + r() * 40, 0x1c1814, 0.4);
  for (let i = 0; i < 3200; i++) { const x = r() * W, y = r() * H; dot(c, x, y, 1 + r() * 1.5, 1 + r(), css(pick(r, [0x4d4438, 0xb0a48a, 0x6f6454, 0xc4b89c]), 0.55)); }
  for (let i = 0; i < 18; i++) { // rusty sheets
    const x = r() * W, y = r() * H; if (laneDist(m, x, y) < 40) continue;
    const w = 30 + r() * 30, h = 20 + r() * 20, col = pick(r, [0x9a5a34, 0x7d7f86, 0x6c8a96, 0xa8693c, 0x8a8c92]);
    c.save(); c.translate(x, y); c.rotate(r() * 6.28); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    c.fillStyle = css(col); c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = css(lit(col, 0.25), 0.7); c.fillRect(-w / 2, -h / 2, w, 3);
    c.fillStyle = css(0x4a2a14, 0.35); for (let k = 0; k < 4; k++) c.fillRect(-w / 2 + r() * w * 0.8, -h / 2 + r() * h * 0.8, 6 + r() * 8, 3 + r() * 6);
    c.fillStyle = css(0x222222, 0.7); for (const [px, py] of [[-w / 2 + 4, -h / 2 + 4], [w / 2 - 4, -h / 2 + 4], [-w / 2 + 4, h / 2 - 4], [w / 2 - 4, h / 2 - 4]]) dot(c, px, py, 1.4, 1.4, 'rgba(30,30,30,.8)');
    c.restore();
  }
  for (const l of m.lanes) for (let i = 1; i < l.length; i++) for (const off of [-9, 9]) { // tyre tracks beside lanes
    const a = l[i - 1], b = l[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    c.strokeStyle = css(0x2a241c, 0.18); c.lineWidth = 3; c.setLineDash([14, 5]); c.beginPath(); c.moveTo(a.x + nx * (off * 4.6), a.y + ny * (off * 4.6)); c.lineTo(b.x + nx * (off * 4.6), b.y + ny * (off * 4.6)); c.stroke(); c.setLineDash([]);
  }
}

export function cornGround(c: Ctx, r: Rng, m: MapDef) {
  for (let y = 4; y < H; y += 12) {
    c.fillStyle = css(0x5a3c1c, 0.28); c.fillRect(0, y + 5, W, 3);
    c.fillStyle = css(0xd8b070, 0.22); c.fillRect(0, y, W, 2);
  }
  const stalk = (x: number, y: number) => {
    const g = pick(r, [0x7aa83a, 0x8fba44, 0x6b9a34]);
    c.fillStyle = 'rgba(40,24,8,.25)'; c.beginPath(); c.ellipse(x + 1, y + 5, 8, 3, 0, 0, 7); c.fill();
    c.lineCap = 'round'; c.lineWidth = 2.4;
    for (const a of [-2.6, -2.0, -1.1, -0.5, -1.57]) { c.strokeStyle = css(a === -1.57 ? 0xe0c05a : g); c.beginPath(); c.moveTo(x, y + 2); c.quadraticCurveTo(x + Math.cos(a) * 6, y - 5 + Math.sin(a) * 4, x + Math.cos(a) * 10, y + Math.sin(a) * 11); c.stroke(); }
    dot(c, x, y - 3, 2, 3.4, css(0xf2d75a));
  };
  for (let y = 10; y < H; y += 24) for (let x = 6 + (y % 48 ? 0 : 5); x < W; x += 12) if (free(m, x, y, 38)) stalk(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2);
}

export function sandGround(c: Ctx, r: Rng, m: MapDef, T: Theme) {
  for (let i = 0; i < 160; i++) {
    const x = r() * W, y = r() * H; if (inWater(m, x, y, 4)) continue;
    c.strokeStyle = css(r() < 0.5 ? 0xb89a58 : 0xffffff, 0.16); c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 18, y);
    c.quadraticCurveTo(x - 6, y - 5, x, y); c.quadraticCurveTo(x + 6, y + 5, x + 18, y); c.stroke();
  }
  for (let i = 0; i < 2000; i++) { const x = r() * W, y = r() * H; dot(c, x, y, 1, 1, css(pick(r, [0x9a7c40, 0xfff6d8, 0xc8a860]), 0.4)); }
  for (let i = 0; i < 26; i++) { // shells
    const x = r() * W, y = r() * H; if (!free(m, x, y, 30)) continue;
    dot(c, x, y, 3, 2.4, css(pick(r, [0xfff0e0, 0xf6b8c0, 0xffd9a0]))); c.strokeStyle = 'rgba(120,80,60,.4)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x, y + 2); c.stroke();
  }
  void T;
}

export function castleGround(c: Ctx, r: Rng, m: MapDef) {
  const S = 48;
  for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
    const v = vnoise(x / 60, y / 60, 9), col = mix(0x40414f, 0x5a5b6e, v * 0.7 + r() * 0.3);
    c.fillStyle = css(col); c.fillRect(x, y, S, S);
    c.fillStyle = css(0xffffff, 0.07); c.fillRect(x + 2, y + 2, S - 4, 3); c.fillRect(x + 2, y + 2, 3, S - 4);
    c.fillStyle = css(0x000000, 0.35); c.fillRect(x, y + S - 2, S, 2); c.fillRect(x + S - 2, y, 2, S);
  }
  for (let i = 0; i < 40; i++) jag(c, r, r() * W, r() * H, r() * 6.28, 20 + r() * 40, 'rgba(10,10,20,.5)', 1.5);
  for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H; if (laneDist(m, x, y) > 30) soft(c, x, y, 16 + r() * 18, 0x4f8a3a, 0.35); }
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H; if (free(m, x, y, 30)) dot(c, x, y, 2 + r() * 3, 1.5 + r() * 2, css(0x7a7c90, 0.9), r() * 3); }
  for (const [tx, ty] of [[40, 40], [920, 40], [40, 500], [920, 500], [480, 24]]) { // torch glows
    soft(c, tx, ty, 70, 0xff9a30, 0.32); dot(c, tx, ty, 5, 5, css(0xffd060)); dot(c, tx, ty, 2.6, 2.6, css(0xffffff, 0.9));
  }
}

export function ravineGround(c: Ctx, r: Rng, m: MapDef, T: Theme) {
  for (let i = 0; i < 170; i++) { // angular rock slabs
    const x = r() * W, y = r() * H, s = 22 + r() * 44, n = 5 + Math.floor(r() * 2), a0 = r() * 6.28, col = mix(T.ground[0], T.ground[2], r());
    c.beginPath(); for (let k = 0; k < n; k++) { const a = a0 + (k / n) * 6.283, q = s * (0.7 + r() * 0.5); c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q * 0.7); } c.closePath();
    c.fillStyle = css(col, 0.55); c.fill(); c.strokeStyle = css(0x2a2018, 0.3); c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = css(0xffffff, 0.12); c.lineWidth = 2; c.beginPath(); c.moveTo(x - s * 0.6, y - s * 0.2); c.lineTo(x, y - s * 0.55); c.stroke();
  }
  for (let i = 0; i < 40; i++) jag(c, r, r() * W, r() * H, r() * 6.28, 30 + r() * 50, 'rgba(30,20,10,.45)', 1.6);
  // cliff shadow along water edge
  for (const w of m.water) { c.strokeStyle = 'rgba(30,20,10,.35)'; c.lineWidth = 16; c.strokeRect(w.x - 8, w.y - 8, w.width + 16, w.height + 16); }
}
