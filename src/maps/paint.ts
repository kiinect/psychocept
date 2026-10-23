// Painterly canvas renderer for map backgrounds (original, code-drawn). Browser only; rendered once per map and cached.
// Drawn from the real layout polygons (MapDef): ground, water, land, road, and no-build scenery chosen by area name.
import { inPoly, mulberry32, nestedAreas, type Pt } from '../sim';
import type { MapDef } from './maps';
import { type Ctx, type Rng, css, mix, lit, drk, pick, fbm, vnoise } from './util';
import { drawDeco } from './deco';

type PathStyle = 'stone' | 'cobble' | 'plank' | 'dirt' | 'tile';
export interface Theme {
  ground: [number, number, number]; patch?: number;
  path: { edge: number; base: number; inner: number; stones: number[]; style: PathStyle };
  water: { deep: number; shallow: number; foam: number; shore: number; sea?: boolean; pads?: boolean };
  tree: 'oak' | 'mushroom' | 'palm' | 'pine' | 'cube' | 'tire' | 'hay' | 'column' | 'logs' | 'dead' | 'planter';
  rock: 'rock' | 'barrel' | 'crate' | 'coral' | 'prism';
  flowers: number; tufts: number; tuftC: [number, number]; tint?: [number, number];
  /** Forest floor under tree scenery. */
  floor: number;
}
const meadowWater = { deep: 0x2a86c4, shallow: 0x4ec0e8, foam: 0xeaffff, shore: 0xd8c486, pads: true };
const meadow: Theme = {
  ground: [0x4e9e3a, 0x63b947, 0x86d05a], patch: 0xa6e06a, floor: 0x2f6a2a,
  path: { edge: 0x5a5148, base: 0xa89a82, inner: 0xc9bc9f, stones: [0xd8ccb0, 0xc7b99b, 0xbfb08e, 0xe0d6bc, 0xb5a785], style: 'stone' },
  water: meadowWater, tree: 'oak', rock: 'rock', flowers: 90, tufts: 700, tuftC: [0x3c8a2c, 0x9be062],
};
const THEMES: Record<string, Theme> = {
  monkey_meadow: meadow,
  tree_stump: {
    ...meadow, ground: [0x3f8a35, 0x56a640, 0x74c04e], tree: 'oak', flowers: 40,
    path: { edge: 0x4a3422, base: 0x9c7a52, inner: 0xbf9a68, stones: [0xc8a572, 0xb89462, 0xd3b283, 0xa98655], style: 'stone' },
  },
  town_center: {
    ...meadow, ground: [0x58a04a, 0x6dba58, 0x8bd16c], tree: 'oak', rock: 'barrel', flowers: 50,
    path: { edge: 0x464a56, base: 0x8a8f9c, inner: 0xaab0bc, stones: [0xbcc2cc, 0xa3a9b6, 0xc9ced8, 0x959bab], style: 'cobble' },
  },
  in_the_loop: { ...meadow, ground: [0x5ba33d, 0x73bd49, 0x97d65a], patch: 0xcbe670, flowers: 120 },
  cubism: {
    ground: [0x6c8fa8, 0x7fa3bb, 0x95b9cd], floor: 0x4a6a80, path: { edge: 0x3d3a55, base: 0xd9a35a, inner: 0xf0c479, stones: [0xf3cf88, 0xe6b862, 0xf7dc9f, 0xd9a350], style: 'tile' },
    water: meadowWater, tree: 'cube', rock: 'prism', flowers: 0, tufts: 0, tuftC: [0, 0],
  },
  logs: {
    ground: [0x2f6b34, 0x3f8040, 0x59a04b], patch: 0x6a9a3c, floor: 0x234f27, path: { edge: 0x3a2a1c, base: 0x8c6a43, inner: 0xad8657, stones: [0xb08c5c, 0x9c7a4c, 0xbf9a68], style: 'dirt' },
    water: { deep: 0x1f6f78, shallow: 0x3da79a, foam: 0xdaf7ea, shore: 0x6b5a34, pads: true }, tree: 'pine', rock: 'rock', flowers: 24, tufts: 800, tuftC: [0x24592b, 0x6bb55a],
  },
  scrapyard: {
    ground: [0x6e6354, 0x857964, 0x9c9078], floor: 0x5a5046, path: { edge: 0x2b2b30, base: 0x55565e, inner: 0x6d6f79, stones: [0x7b7e89, 0x666872, 0x8c909b, 0x5a5c66], style: 'tile' },
    water: meadowWater, tree: 'tire', rock: 'crate', flowers: 0, tufts: 160, tuftC: [0x5d6b3a, 0x8a9a52],
  },
  cornfield: {
    ground: [0x8a6a3e, 0xa27c48, 0xb8925a], floor: 0x6a4e2a, path: { edge: 0x4a3418, base: 0xc9a468, inner: 0xe0be82, stones: [0xe6c78c, 0xd3b073, 0xedd199], style: 'dirt' },
    water: meadowWater, tree: 'hay', rock: 'rock', flowers: 0, tufts: 60, tuftC: [0x7a8a3a, 0xa8b85a],
  },
  spice_islands: {
    ground: [0xe0c88a, 0xecd9a0, 0xf6e8b8], patch: 0xfff3cf, floor: 0xc8ae72, path: { edge: 0x5e3d20, base: 0x9a6a3c, inner: 0xb98a55, stones: [0xc79a62, 0xad7c48, 0xd5aa72], style: 'plank' },
    water: { deep: 0x0f78b8, shallow: 0x3fd0d8, foam: 0xffffff, shore: 0xf3e2a8, sea: true }, tree: 'palm', rock: 'rock', flowers: 18, tufts: 160, tuftC: [0x4f9a3c, 0x8bd25a],
  },
  sunken_columns: {
    ground: [0xc2b283, 0xd2c496, 0xe2d6aa], patch: 0xeee4bd, floor: 0xa89a70, path: { edge: 0x4a4a4e, base: 0x9a9a9a, inner: 0xbbbbb8, stones: [0xcfcfca, 0xb5b5b0, 0xdedcd4, 0xa4a4a0], style: 'stone' },
    water: { deep: 0x1a6fb4, shallow: 0x36b7d6, foam: 0xf0ffff, shore: 0xcdbf8b, sea: true }, tree: 'column', rock: 'coral', flowers: 0, tufts: 110, tuftC: [0x3f8f6a, 0x7bcf8a], tint: [0x2a9ab8, 0.06],
  },
  dark_castle: {
    ground: [0x3a3b4a, 0x4a4b5c, 0x5c5d70], patch: 0x6c6e84, floor: 0x26262f, path: { edge: 0x15151c, base: 0x6a5d52, inner: 0x85776a, stones: [0x95867a, 0x7a6d62, 0xa3948a, 0x6c6056], style: 'stone' },
    water: { deep: 0x1a2e5a, shallow: 0x2f5a96, foam: 0xa8c4e8, shore: 0x2a2a34 }, tree: 'dead', rock: 'rock', flowers: 0, tufts: 80, tuftC: [0x2f4a30, 0x4f7a46], tint: [0x201040, 0.16],
  },
  ravine: {
    ground: [0x7d6a56, 0x93806a, 0xab977e], patch: 0xbfab92, floor: 0x5c4c3c, path: { edge: 0x3b3128, base: 0xa89572, inner: 0xc4b08a, stones: [0xd0bd96, 0xb8a47e, 0xddcaa4], style: 'stone' },
    water: { deep: 0x1d7a86, shallow: 0x44b8b0, foam: 0xeafffa, shore: 0x6a5a48 }, tree: 'pine', rock: 'rock', flowers: 8, tufts: 200, tuftC: [0x4a6a3a, 0x7a9a52],
  },
};

/** Paint pixels per world unit (BTD6 units) at scale 1, and the painted margin around the play area (letterbox fill). */
export const PX = 3.2, MARGIN = { x: 70, y: 12 };
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fill(); };
const trace = (c: Ctx, poly: Pt[]) => { c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p.x * PX, p.y * PX) : c.moveTo(p.x * PX, p.y * PX))); c.closePath(); };
const bbox = (poly: Pt[]) => {
  const xs = poly.map(p => p.x * PX), ys = poly.map(p => p.y * PX);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
/** Long axis of a polygon (for fences, bridges, roof ridges): angle and centre in px. */
function axis(poly: Pt[]) {
  const ps = poly.map(p => ({ x: p.x * PX, y: p.y * PX })), cx = ps.reduce((a, p) => a + p.x, 0) / ps.length, cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
  let sxx = 0, syy = 0, sxy = 0; for (const p of ps) { sxx += (p.x - cx) ** 2; syy += (p.y - cy) ** 2; sxy += (p.x - cx) * (p.y - cy); }
  return { cx, cy, ang: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

function groundCanvas(T: Theme, seed: number, w: number, h: number) {
  const lw = Math.ceil(w / 4), lh = Math.ceil(h / 4), cv = document.createElement('canvas'); cv.width = lw; cv.height = lh;
  const x = cv.getContext('2d')!, im = x.createImageData(lw, lh), [g0, g1, g2] = T.ground;
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const wx = i * 4, wy = j * 4, f = fbm(wx / 90, wy / 90, seed), t = Math.max(0, Math.min(1, (f - 0.28) / 0.42));
    let col = t < 0.5 ? mix(g0, g1, t * 2) : mix(g1, g2, (t - 0.5) * 2);
    if (T.patch !== undefined) { const p = Math.max(0, Math.min(1, (vnoise(wx / 150, wy / 150, seed + 7) - 0.52) * 5)); col = mix(col, T.patch, p * 0.55); }
    const k = (j * lw + i) * 4; im.data[k] = col >> 16; im.data[k + 1] = (col >> 8) & 255; im.data[k + 2] = col & 255; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0); return cv;
}

function tuft(c: Ctx, x: number, y: number, cols: [number, number], r: Rng) {
  c.lineCap = 'round'; const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const a = -1.57 + (k - n / 2) * 0.35 + (r() - 0.5) * 0.2, L = 5 + r() * 5;
    c.strokeStyle = css(k % 2 ? cols[1] : cols[0], 0.9); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.6, x + Math.cos(a) * L + 1.5, y + Math.sin(a) * L); c.stroke();
  }
}
function flower(c: Ctx, x: number, y: number, r: Rng) {
  const col = pick(r, [0xffffff, 0xffe14d, 0xff7aa8, 0xb48be8, 0xff9a4a, 0x7ac8ff]);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; ell(c, x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.9, 1.9, css(col)); }
  ell(c, x, y, 1.4, 1.4, css(0xf08a24));
}

function paintWater(c: Ctx, poly: Pt[], T: Theme, r: Rng) {
  const wt = T.water, b = bbox(poly);
  if (!wt.sea) { c.lineJoin = 'round'; trace(c, poly); c.strokeStyle = css(drk(wt.shore, 0.25), 0.55); c.lineWidth = 20; c.stroke(); c.strokeStyle = css(wt.shore); c.lineWidth = 12; c.stroke(); }
  c.save(); trace(c, poly); c.clip();
  const g = c.createLinearGradient(b.x0, b.y0, b.x0 + (b.x1 - b.x0) * 0.3, b.y1); g.addColorStop(0, css(wt.shallow)); g.addColorStop(0.55, css(wt.deep)); g.addColorStop(1, css(drk(wt.deep, 0.25)));
  c.fillStyle = g; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  trace(c, poly); c.strokeStyle = css(wt.shallow, 0.55); c.lineWidth = 30; c.stroke();
  const area = (b.x1 - b.x0) * (b.y1 - b.y0);
  for (let i = 0; i < Math.min(900, area / 900); i++) ell(c, b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 6 + r() * 14, 2 + r() * 4, css(lit(wt.shallow, 0.5), 0.1 + r() * 0.1), r() * 0.3);
  c.lineCap = 'round'; c.lineWidth = 1.8;
  for (let py = b.y0 + 14; py < b.y1 - 6; py += wt.sea ? 22 : 26) for (let px = b.x0 + 14 + ((py * 7) % 30); px < b.x1 - 14; px += wt.sea ? 54 : 46) {
    const o = (r() - 0.5) * 10; c.strokeStyle = css(0xffffff, 0.3); c.beginPath(); c.moveTo(px - 11 + o, py); c.quadraticCurveTo(px - 5 + o, py - 4, px + o, py); c.quadraticCurveTo(px + 5 + o, py + 4, px + 11 + o, py); c.stroke();
  }
  trace(c, poly); c.strokeStyle = css(wt.foam, 0.85); c.lineWidth = 5; c.stroke();
  c.setLineDash([3, 8]); c.lineWidth = 3; c.strokeStyle = css(wt.foam, 0.5); trace(c, poly); c.lineWidth = 14; c.stroke(); c.setLineDash([]);
  c.restore();
  if (wt.pads) for (let i = 0; i < Math.min(14, area / 9000); i++) {
    const px = b.x0 + r() * (b.x1 - b.x0), py = b.y0 + r() * (b.y1 - b.y0), s = 6 + r() * 4, a = r() * 6.28;
    if (!inPoly({ x: px / PX, y: py / PX }, poly)) continue;
    ell(c, px + 1.5, py + 2, s, s * 0.85, 'rgba(0,30,40,.3)');
    c.fillStyle = css(pick(r, [0x3f9a4a, 0x4fb056, 0x2f8040])); c.beginPath(); c.moveTo(px, py); c.arc(px, py, s, a + 0.35, a + 6.283 - 0.1); c.closePath(); c.fill();
  }
}

/** Road: all outlines first, then all fills, then paving clipped to the union, so overlapping track pieces show no seams. */
function paintTrack(c: Ctx, m: MapDef, T: Theme, r: Rng) {
  const P = T.path; c.lineJoin = 'round';
  for (const t of m.track) { c.save(); c.translate(0, 5); trace(c, t); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(); c.restore(); }
  for (const t of m.track) { trace(c, t); c.strokeStyle = css(P.edge); c.lineWidth = 9; c.stroke(); }
  for (const t of m.track) { trace(c, t); c.strokeStyle = css(drk(P.base, 0.15)); c.lineWidth = 4; c.stroke(); }
  for (const t of m.track) { trace(c, t); c.fillStyle = css(P.base); c.fill(); }
  c.save(); c.beginPath();
  for (const t of m.track) t.forEach((p, i) => (i ? c.lineTo(p.x * PX, p.y * PX) : c.moveTo(p.x * PX, p.y * PX)));
  c.clip('nonzero');
  const all = m.track.flat(), b = bbox(all);
  if (P.style === 'plank') {
    // planks run across the lanes
    for (const l of m.lanes) for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], q = l[i], dx = (q.x - a.x) * PX, dy = (q.y - a.y) * PX, L = Math.hypot(dx, dy); if (L < 0.01) continue;
      c.save(); c.translate(a.x * PX, a.y * PX); c.rotate(Math.atan2(dy, dx));
      for (let t = 0; t < L; t += 8) { const col = pick(r, P.stones); c.fillStyle = css(drk(col, 0.45)); c.fillRect(t, -40, 8.2, 80); c.fillStyle = css(col); c.fillRect(t + 0.6, -40, 6.8, 80); }
      c.restore();
    }
  } else if (P.style === 'dirt') {
    for (let i = 0; i < (b.x1 - b.x0) * (b.y1 - b.y0) / 40; i++) ell(c, b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 1 + r() * 2.2, 0.8 + r(), css(pick(r, P.stones.concat([drk(P.base, 0.3)])), 0.55), r() * 3);
    for (const l of m.lanes) for (const o of [-10, 10]) { c.strokeStyle = css(drk(P.base, 0.22), 0.35); c.lineWidth = 4; c.beginPath(); l.forEach((p, i) => { const q = l[Math.min(l.length - 1, i + 1)], pp = l[Math.max(0, i - 1)], dx = q.x - pp.x, dy = q.y - pp.y, n = Math.hypot(dx, dy) || 1; const x = p.x * PX - dy / n * o, y = p.y * PX + dx / n * o; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
  } else {
    const step = P.style === 'cobble' ? 9 : P.style === 'tile' ? 15 : 18, rowH = P.style === 'cobble' ? 8 : P.style === 'tile' ? 15 : 12;
    for (let y = b.y0, row = 0; y < b.y1 + rowH; y += rowH, row++) for (let x = b.x0 - step + ((row % 2) * step) / 2; x < b.x1 + step; x += step) {
      const col = pick(r, P.stones);
      if (P.style === 'cobble') { ell(c, x, y + 0.8, step * 0.55, rowH * 0.55, css(drk(col, 0.5), 0.8)); ell(c, x, y, step * 0.48, rowH * 0.46, css(col)); ell(c, x - 1, y - 1, step * 0.26, rowH * 0.18, css(lit(col, 0.4), 0.7)); }
      else if (P.style === 'tile') { c.fillStyle = css(drk(col, 0.4)); c.fillRect(x - step / 2 + 0.3, y - rowH / 2 + 0.3, step - 0.6, rowH - 0.6); c.fillStyle = css(col); c.fillRect(x - step / 2 + 1.4, y - rowH / 2 + 1.4, step - 2.8, rowH - 2.8); c.fillStyle = css(lit(col, 0.4), 0.7); c.fillRect(x - step / 2 + 1.4, y - rowH / 2 + 1.4, step - 2.8, 1.6); }
      else { const w2 = step * (0.86 + r() * 0.1) - 1.5; c.fillStyle = css(drk(col, 0.45), 0.9); c.beginPath(); c.roundRect(x - w2 / 2, y - rowH / 2 + 0.5, w2, rowH - 1, 3); c.fill(); c.fillStyle = css(col); c.beginPath(); c.roundRect(x - w2 / 2 + 0.8, y - rowH / 2 + 0.8, w2 - 1.8, rowH - 2.6, 2.6); c.fill(); c.fillStyle = css(lit(col, 0.45), 0.6); c.fillRect(x - w2 / 2 + 2, y - rowH / 2 + 1.6, w2 - 5, 1.6); }
    }
  }
  c.restore();
}

type Classify = (p: Pt) => { kind: 'water' | 'land' | 'blocked'; index: number } | undefined;
/** Scatter points over a polygon on a jittered grid, keeping those this polygon owns (nested areas win) and clear of the road. */
function scatter(m: MapDef, poly: Pt[], own: (p: Pt) => boolean, step: number, r: Rng, roadPad: number) {
  const b = bbox(poly), out: { x: number; y: number }[] = [];
  for (let y = b.y0; y <= b.y1; y += step * 0.86) for (let x = b.x0 + (((y / step) | 0) % 2) * step * 0.5; x <= b.x1; x += step) {
    const px = x + (r() - 0.5) * step * 0.7, py = y + (r() - 0.5) * step * 0.7, w = { x: px / PX, y: py / PX };
    if (!inPoly(w, poly) || !own(w) || nearTrack(m, w, roadPad / PX)) continue;
    out.push({ x: px, y: py });
  }
  return out.sort((a, q) => a.y - q.y);
}
function nearTrack(m: MapDef, p: Pt, pad: number) {
  for (const t of m.track) {
    if (inPoly(p, t)) return true;
    for (let i = 0, j = t.length - 1; i < t.length; j = i++) {
      const a = t[j], q = t[i], dx = q.x - a.x, dy = q.y - a.y, k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy) < pad) return true;
    }
  }
  return false;
}

function stoneBlocks(c: Ctx, poly: Pt[], base: number, r: Rng, bw = 22, bh = 12) {
  const b = bbox(poly); c.save(); trace(c, poly); c.clip(); c.fillStyle = css(drk(base, 0.35)); c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  for (let y = b.y0, row = 0; y < b.y1; y += bh, row++) for (let x = b.x0 - (row % 2) * bw / 2; x < b.x1; x += bw) {
    const col = mix(base, pick(r, [0xffffff, 0x000000, base]), 0.08 + r() * 0.1); c.fillStyle = css(col); c.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    c.fillStyle = css(lit(col, 0.25), 0.6); c.fillRect(x + 1, y + 1, bw - 2, 1.5);
  }
  c.restore(); trace(c, poly); c.strokeStyle = css(drk(base, 0.55)); c.lineWidth = 3; c.stroke();
}
function metalPlate(c: Ctx, poly: Pt[], r: Rng) {
  const b = bbox(poly); c.save(); trace(c, poly); c.clip();
  c.fillStyle = css(0x7e848c); c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  for (let y = b.y0; y < b.y1; y += 26) for (let x = b.x0; x < b.x1; x += 34) {
    c.fillStyle = css(mix(0x8d939b, 0x6a7078, r() * 0.5)); c.fillRect(x + 1.5, y + 1.5, 31, 23);
    for (const [ox, oy] of [[4, 4], [29, 4], [4, 21], [29, 21]]) ell(c, x + ox, y + oy, 1.4, 1.4, css(0xb8bec6));
  }
  c.restore(); trace(c, poly); c.strokeStyle = css(0x2e3238); c.lineWidth = 3; c.stroke();
}
function woodRings(c: Ctx, poly: Pt[]) {
  const { cx, cy } = axis(poly), b = bbox(poly), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
  c.save(); trace(c, poly); c.clip();
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, css(0xe8c48a)); g.addColorStop(1, css(0xc89a5c)); c.fillStyle = g; c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  c.strokeStyle = css(0xa87a42, 0.55); c.lineWidth = 2; for (let q = 10; q < R; q += 11) { c.beginPath(); c.ellipse(cx, cy, q, q * 0.92, 0, 0, 7); c.stroke(); }
  c.restore(); trace(c, poly); c.strokeStyle = css(0x5a3a1c); c.lineWidth = 10; c.stroke(); c.strokeStyle = css(0x8a5a2c); c.lineWidth = 4; c.stroke();
}
function roof(c: Ctx, poly: Pt[], col: number) {
  const { cx, cy, ang } = axis(poly), b = bbox(poly);
  c.save(); c.translate(5, 7); trace(c, poly); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); c.restore();
  c.save(); trace(c, poly); c.clip(); c.fillStyle = css(col); c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  c.translate(cx, cy); c.rotate(ang); const R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  c.fillStyle = css(drk(col, 0.18)); c.fillRect(-R, 0, 2 * R, R); // shaded half
  c.strokeStyle = css(drk(col, 0.35), 0.6); c.lineWidth = 1.4; for (let q = -R; q < R; q += 7) { c.beginPath(); c.moveTo(-R, q); c.lineTo(R, q); c.stroke(); }
  c.strokeStyle = css(lit(col, 0.3)); c.lineWidth = 3; c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.stroke();
  c.restore(); trace(c, poly); c.strokeStyle = css(drk(col, 0.55)); c.lineWidth = 3; c.stroke();
}
function planks(c: Ctx, poly: Pt[], col: number, r: Rng) {
  const { cx, cy, ang } = axis(poly), b = bbox(poly), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
  c.save(); c.translate(4, 6); trace(c, poly); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill(); c.restore();
  c.save(); trace(c, poly); c.clip(); c.translate(cx, cy); c.rotate(ang);
  for (let t = -R; t < R; t += 9) { const k = mix(col, pick(r, [0xffffff, 0]), r() * 0.15); c.fillStyle = css(drk(k, 0.45)); c.fillRect(t, -R, 9, 2 * R); c.fillStyle = css(k); c.fillRect(t + 0.8, -R, 7.4, 2 * R); }
  c.restore(); trace(c, poly); c.strokeStyle = css(drk(col, 0.6)); c.lineWidth = 4; c.stroke();
}
function fence(c: Ctx, poly: Pt[], T: Theme) {
  const { cx, cy, ang } = axis(poly), b = bbox(poly), L = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
  c.save(); c.translate(cx, cy); c.rotate(ang);
  for (const [w, col] of [[6, 0x3a2614], [3, 0xb07a44]] as const) for (const o of [-3, 3]) { c.strokeStyle = css(col); c.lineWidth = w; c.beginPath(); c.moveTo(-L, o); c.lineTo(L, o); c.stroke(); }
  for (let t = -L; t <= L; t += 16) { c.fillStyle = css(0x3a2614); c.fillRect(t - 3, -6, 6, 12); c.fillStyle = css(0xc8925a); c.fillRect(t - 2, -5, 4, 10); }
  c.restore(); void T;
}
function corn(c: Ctx, m: MapDef, poly: Pt[], own: (p: Pt) => boolean, r: Rng) {
  c.save(); trace(c, poly); c.clip(); const b = bbox(poly);
  c.fillStyle = css(0x5a4220); c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  for (let y = b.y0 + 4; y < b.y1; y += 11) {
    c.strokeStyle = css(0x3e2c14, 0.6); c.lineWidth = 3; c.beginPath(); c.moveTo(b.x0, y + 4); c.lineTo(b.x1, y + 4); c.stroke();
    for (let x = b.x0 + (r() * 6); x < b.x1; x += 7 + r() * 2) {
      const w = { x: x / PX, y: y / PX }; if (!own(w) || nearTrack(m, w, 0.5)) continue;
      for (let k = 0; k < 3; k++) { const a = -1.9 + k * 0.6 + (r() - 0.5) * 0.3; c.strokeStyle = css(pick(r, [0x3f8a2a, 0x5aa83a, 0x78c048])); c.lineWidth = 2.2; c.beginPath(); c.moveTo(x, y + 4); c.quadraticCurveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 6, x + Math.cos(a) * 9, y + Math.sin(a) * 9 + 1); c.stroke(); }
      if (r() < 0.35) ell(c, x + 1, y - 1, 1.6, 3, css(0xf2c84a));
    }
  }
  c.restore(); trace(c, poly); c.strokeStyle = css(0x3a2a12, 0.6); c.lineWidth = 2; c.stroke();
}
function cars(c: Ctx, pts: { x: number; y: number }[], r: Rng) {
  for (const p of pts) {
    if (r() < 0.45) { drawDeco(c, { ...p, r: 12, kind: 'rock' }, { rock: 'crate' } as Theme, r); continue; }
    const col = pick(r, [0xa8523a, 0x4a7a9a, 0x7a8a4a, 0x9a8a6a]), a = (r() - 0.5) * 1.2;
    c.save(); c.translate(p.x, p.y); c.rotate(a); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-15, -7, 34, 20);
    c.fillStyle = css(drk(col, 0.4)); c.beginPath(); c.roundRect(-17, -10, 34, 20, 5); c.fill(); c.fillStyle = css(col); c.beginPath(); c.roundRect(-16, -9, 32, 18, 4); c.fill();
    c.fillStyle = css(0x9ac8d8, 0.85); c.fillRect(-6, -7, 12, 14); c.fillStyle = css(0x2a2a30); c.fillRect(-14, -11, 6, 3); c.fillRect(8, -11, 6, 3); c.fillRect(-14, 8, 6, 3); c.fillRect(8, 8, 6, 3);
    c.restore();
  }
}

type Scenery = 'stump' | 'trees' | 'corn' | 'fence' | 'wall' | 'roof' | 'bridge' | 'cars' | 'metal' | 'logs' | 'stone' | 'palms' | 'roots' | 'crates' | 'bushes';
export function sceneryFor(name: string, mapId: string): Scenery {
  const n = name.toLowerCase();
  if (/roof/.test(n)) return 'roof';
  if (/house|townhall/.test(n)) return 'wall';
  if (/fence/.test(n)) return 'fence';
  if (/corn/.test(n)) return 'corn';
  if (/bridge/.test(n)) return 'bridge';
  if (/car/.test(n)) return 'cars';
  if (/crusher|platform/.test(n)) return 'metal';
  if (/log/.test(n)) return 'logs';
  if (/castle/.test(n) || mapId === 'sunken_columns' && /blocking|nonplace/.test(n)) return 'stone';
  if (/palm/.test(n)) return 'palms';
  if (/root/.test(n)) return 'roots';
  if (/stump/.test(n)) return 'stump';
  if (/wheelbarrow|blocking1$|^blocking$/.test(n) && mapId === 'scrapyard' || /wheelbarrow/.test(n)) return 'crates';
  if (/cacti/.test(n)) return 'bushes';
  return 'trees';
}

function paintBlocked(c: Ctx, m: MapDef, i: number, own: (p: Pt) => boolean, T: Theme, r: Rng) {
  const poly = m.blocked[i], kind = sceneryFor(m.blockedNames[i] ?? '', m.id);
  const under = (col: number, a = 1) => { c.save(); trace(c, poly); c.clip(); c.fillStyle = css(col, a); const b = bbox(poly); c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); c.restore(); };
  if (kind === 'roof') return roof(c, poly, pick(r, [0xc8503a, 0x3a6aa8, 0x8a4a8a, 0x2f8a6a]));
  if (kind === 'stump') return woodRings(c, poly);
  if (kind === 'wall') { under(0xe8dcc0); trace(c, poly); c.strokeStyle = css(0x6a5a44); c.lineWidth = 4; c.stroke(); return; }
  if (kind === 'fence') return fence(c, poly, T);
  if (kind === 'corn') return corn(c, m, poly, own, r);
  if (kind === 'bridge') return planks(c, poly, 0x9a6a3a, r);
  if (kind === 'metal') return metalPlate(c, poly, r);
  if (kind === 'stone') return stoneBlocks(c, poly, m.id === 'dark_castle' ? 0x6a6878 : 0xd8d2bc, r);
  if (kind === 'roots') { under(T.floor, 0.6); c.lineCap = 'round'; for (const p of scatter(m, poly, own, 26, r, 2)) for (let k = 0; k < 3; k++) { const a = r() * 6.28; c.strokeStyle = css(0x5a3a1c); c.lineWidth = 6; c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 6, p.x + Math.cos(a + 0.4) * 22, p.y + Math.sin(a + 0.4) * 16); c.stroke(); } return; }
  const spots = scatter(m, poly, own, 30, r, 6);
  // thin strips (map borders) hold no grid points: line them with trees along their long axis instead of a bare floor stripe
  if (spots.length < 3) {
    const { cx, cy, ang } = axis(poly), b = bbox(poly), L = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2;
    for (let t = -L; t <= L; t += 26) { const x = cx + Math.cos(ang) * t, y = cy + Math.sin(ang) * t; if (own({ x: x / PX, y: y / PX })) spots.push({ x, y }); }
    spots.sort((a, q) => a.y - q.y);
  } else under(T.floor, kind === 'trees' || kind === 'palms' ? 0.55 : 0.35);
  if (kind === 'cars') return cars(c, scatter(m, poly, own, 40, r, 6), r);
  if (kind === 'logs') { for (const p of scatter(m, poly, own, 30, r, 4)) drawDeco(c, { ...p, r: 20, kind: 'tree' }, { ...T, tree: 'logs' }, r); return; }
  if (kind === 'crates') { for (const p of scatter(m, poly, own, 26, r, 4)) drawDeco(c, { ...p, r: 12, kind: 'rock' }, { ...T, rock: 'crate' }, r); return; }
  if (kind === 'bushes') { for (const p of scatter(m, poly, own, 24, r, 4)) drawDeco(c, { ...p, r: 11, kind: 'bush' }, T, r); return; }
  const treeT = kind === 'palms' ? { ...T, tree: 'palm' as const } : T;
  for (const p of spots) {
    const roll = r();
    if (roll < 0.08) drawDeco(c, { ...p, r: 12, kind: 'rock' }, T, r);
    else if (roll < 0.18) drawDeco(c, { ...p, r: 11, kind: 'bush' }, T, r);
    else { c.save(); c.translate(p.x, p.y); c.scale(1.35, 1.35); drawDeco(c, { x: 0, y: 0, r: 20, kind: 'tree' }, treeT, r); c.restore(); }
  }
}

function paintLand(c: Ctx, m: MapDef, i: number, ground: HTMLCanvasElement, T: Theme, r: Rng, ox: number, oy: number) {
  const poly = m.land[i], n = (m.landNames[i] ?? '').toLowerCase();
  if (/stump/.test(n)) return woodRings(c, poly);
  if (/castle/.test(n)) return stoneBlocks(c, poly, 0x7a7888, r, 26, 14);
  if (/platform|middleland/.test(n)) return metalPlate(c, poly, r);
  if (/box/.test(n)) return planks(c, poly, 0xb88a52, r);
  if (m.water.length) { c.lineJoin = 'round'; trace(c, poly); c.strokeStyle = css(drk(T.water.shore, 0.2), 0.6); c.lineWidth = 16; c.stroke(); c.strokeStyle = css(T.water.shore); c.lineWidth = 9; c.stroke(); }
  c.save(); trace(c, poly); c.clip(); c.drawImage(ground, -ox, -oy, ground.width * 4, ground.height * 4); c.restore();
}

function seedOf(id: string) { let h = 99; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
/** Painted canvas size in px at scale 1 (play area plus margin). */
export const paintSize = (m: MapDef) => ({ w: (m.width + 2 * MARGIN.x) * PX, h: (m.height + 2 * MARGIN.y) * PX });

function renderMap(m: MapDef, S: number): HTMLCanvasElement {
  const T = THEMES[m.id] ?? meadow, seed = seedOf(m.id), r = mulberry32(seed), { w, h } = paintSize(m);
  const ox = MARGIN.x * PX, oy = MARGIN.y * PX;
  const cv = document.createElement('canvas'); cv.width = Math.round(w * S); cv.height = Math.round(h * S);
  const c = cv.getContext('2d')!; c.scale(S, S);
  const ground = groundCanvas(T, seed & 255, w, h);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(ground, 0, 0, w, h);
  c.translate(ox, oy);
  const areas = nestedAreas(m), owner = (p: Pt) => areas.find(a => inPoly(p, a.poly));
  const owns = (kind: string, index: number) => (p: Pt) => { const a = owner(p); return !!a && a.kind === kind && a.index === index; };
  const free = (p: Pt) => !owner(p) || owner(p)!.kind === 'land';
  // big areas first so nested (smaller) ones paint over them, matching the sim's smallest-wins rule
  const bySize = [...areas].reverse();
  for (const a of bySize) if (a.kind === 'water') paintWater(c, a.poly, T, r); else if (a.kind === 'land') paintLand(c, m, a.index, ground, T, r, ox, oy);
  for (let i = 0; i < T.tufts * 1.6; i++) { const x = (r() * (m.width + 2 * MARGIN.x) - MARGIN.x) * PX, y = (r() * (m.height + 2 * MARGIN.y) - MARGIN.y) * PX, p = { x: x / PX, y: y / PX }; if (free(p) && !nearTrack(m, p, 3)) tuft(c, x, y, T.tuftC, r); }
  for (let i = 0; i < T.flowers * 1.6; i++) { const x = (r() * (m.width + 2 * MARGIN.x) - MARGIN.x) * PX, y = (r() * (m.height + 2 * MARGIN.y) - MARGIN.y) * PX, p = { x: x / PX, y: y / PX }; if (free(p) && !nearTrack(m, p, 4)) for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) flower(c, x + (r() - 0.5) * 12, y + (r() - 0.5) * 10, r); }
  paintTrack(c, m, T, r);
  for (const a of bySize) if (a.kind === 'blocked') paintBlocked(c, m, a.index, owns('blocked', a.index), T, r);
    // land nested inside no-build (stump top, castle walls, ravine plateaus) wins: repaint it over the scenery
    else if (a.kind === 'land' && areas.some(o => o.kind === 'blocked' && inPoly(a.poly[0], o.poly) && bySize.indexOf(o) < bySize.indexOf(a))) paintLand(c, m, a.index, ground, T, r, ox, oy);
  // vignette + tint over everything, centred on the play area
  c.setTransform(S, 0, 0, S, 0, 0);
  if (T.tint) { c.fillStyle = css(T.tint[0], T.tint[1]); c.fillRect(0, 0, w, h); }
  const g = c.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.62); g.addColorStop(0, 'rgba(10,20,10,0)'); g.addColorStop(1, 'rgba(8,10,24,.45)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  return cv;
}

const cache = new Map<string, HTMLCanvasElement>();
/** Cached render of a map (play area + margin) at `scale` x paint size; null outside the browser. */
export function mapCanvas(map: MapDef, scale = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = map.id + '@' + scale; let cv = cache.get(key);
  if (!cv) { cv = renderMap(map, scale); cache.set(key, cv); }
  return cv;
}
