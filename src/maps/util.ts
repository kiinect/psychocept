import type { MapDef } from './maps';
export type Ctx = CanvasRenderingContext2D;
export type Rng = () => number;
export const css = (c: number, a = 1) => `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`;
export const mix = (a: number, b: number, t: number) => {
  const m = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
export const lit = (c: number, t: number) => mix(c, 0xffffff, t), drk = (c: number, t: number) => mix(c, 0, t);
export const pick = <T,>(r: Rng, a: T[]) => a[Math.floor(r() * a.length)];

export function hash(x: number, y: number, s: number) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s: number) => vnoise(x, y, s) * 0.5 + vnoise(x * 2, y * 2, s + 1) * 0.25 + vnoise(x * 4, y * 4, s + 2) * 0.15 + vnoise(x * 8, y * 8, s + 3) * 0.1;

export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
export const laneDist = (m: MapDef, x: number, y: number) => {
  let d = 1e9;
  for (const l of m.lanes) for (let i = 1; i < l.length; i++) d = Math.min(d, segDist(x, y, l[i - 1].x, l[i - 1].y, l[i].x, l[i].y));
  return d;
};
export const inWater = (m: MapDef, x: number, y: number, p = 0) => m.water.some(w => x > w.x - p && x < w.x + w.width + p && y > w.y - p && y < w.y + w.height + p);
export const free = (m: MapDef, x: number, y: number, pad = 30) => laneDist(m, x, y) > pad && !inWater(m, x, y, 8);

