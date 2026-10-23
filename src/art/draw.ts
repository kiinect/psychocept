// Original code-drawn cartoon primitives: thick ink outline + glossy gradients.
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export const INK = '#1b1233';

/** Lighten (t>0) or darken (t<0) a #rrggbb colour. */
export function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
/** Fill + thick ink stroke of the current path. */
export function fs(c: Ctx, fill: string | CanvasGradient, lw = 3): void {
  c.fillStyle = fill; c.fill();
  if (lw > 0) { c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
}
/** Glossy radial gradient (light top-left, dark rim). */
export function glossy(c: Ctx, x: number, y: number, r: number, col: string): CanvasGradient {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, mix(col, 0.6)); g.addColorStop(0.45, col); g.addColorStop(1, mix(col, -0.35));
  return g;
}
export function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, a: string, b: string): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g;
}
export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, lw = 3, rot = 0): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); fs(c, fill, lw);
}
/** Glossy-filled circle. */
export function ball(c: Ctx, x: number, y: number, r: number, col: string, lw = 3): void { ell(c, x, y, r, r, glossy(c, x, y, r, col), lw); }
export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, lw = 3): void {
  c.beginPath(); c.roundRect(x, y, w, h, r); fs(c, fill, lw);
}
export function poly(c: Ctx, p: number[], fill: string | CanvasGradient, lw = 3): void {
  c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); fs(c, fill, lw);
}
/** Thick inked line in a colour. */
export function bar(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, w: number): void {
  c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1);
  c.strokeStyle = INK; c.lineWidth = w + 5; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
/** Ink + colour stroke of the current path. */
export function inkStroke(c: Ctx, col: string, w: number): void {
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = w + 5; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke();
}
export function shine(c: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.6, a = 0.65): void {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fillStyle = `rgba(255,255,255,${a})`; c.fill();
}
export function star(c: Ctx, x: number, y: number, R: number, r: number, n: number, fill: string, lw = 2, rot = -Math.PI / 2): void {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const k = i % 2 ? r : R, a = rot + (i * Math.PI) / n; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
  c.closePath(); fs(c, fill, lw);
}
/** Deterministic pseudo-random for stable art. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
export function hash(s: string): number { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; return h; }
