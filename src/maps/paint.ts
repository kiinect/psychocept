// Painterly canvas renderer for map backgrounds (original, code-drawn). Browser only; rendered once per map and cached.
import { mulberry32 } from '../sim';
import type { MapDef } from './maps';
import { type Ctx, type Rng, css, mix, lit, drk, pick, fbm, vnoise, segDist, laneDist, inWater, free } from './util';
import { stumpGround, townGround, cubismGround, forestGround, scrapGround, cornGround, sandGround, castleGround, ravineGround } from './ground';
import { drawDeco } from './deco';

type PathStyle = 'stone' | 'cobble' | 'plank' | 'dirt' | 'tile';
export interface Theme {
  ground: [number, number, number]; patch?: number;
  path: { edge: number; base: number; inner: number; stones: number[]; style: PathStyle };
  water: { deep: number; shallow: number; foam: number; shore: number; sea?: boolean; pads?: boolean };
  tree: 'oak' | 'mushroom' | 'palm' | 'pine' | 'cube' | 'tire' | 'hay' | 'column' | 'logs' | 'dead' | 'planter';
  rock: 'rock' | 'barrel' | 'crate' | 'coral' | 'prism';
  flowers: number; tufts: number; tuftC: [number, number]; tint?: [number, number];
  ground2?: (c: Ctx, r: Rng, m: MapDef, T: Theme) => void;
  skip?: (x: number, y: number) => boolean;
}
const meadowWater = { deep: 0x2a86c4, shallow: 0x4ec0e8, foam: 0xeaffff, shore: 0xd8c486, pads: true };
const meadow: Theme = {
  ground: [0x4e9e3a, 0x63b947, 0x86d05a], patch: 0xa6e06a,
  path: { edge: 0x5a5148, base: 0xa89a82, inner: 0xc9bc9f, stones: [0xd8ccb0, 0xc7b99b, 0xbfb08e, 0xe0d6bc, 0xb5a785], style: 'stone' },
  water: meadowWater, tree: 'oak', rock: 'rock', flowers: 70, tufts: 520, tuftC: [0x3c8a2c, 0x9be062],
};
const THEMES: Record<string, Theme> = {
  monkey_meadow: meadow,
  tree_stump: {
    ...meadow, ground: [0x3f8a35, 0x56a640, 0x74c04e], tree: 'mushroom', flowers: 24, ground2: stumpGround,
    skip: (x, y) => ((x - 480) / 440) ** 2 + ((y - 270) / 250) ** 2 < 1.05,
    path: { edge: 0x4a3422, base: 0x9c7a52, inner: 0xbf9a68, stones: [0xc8a572, 0xb89462, 0xd3b283, 0xa98655], style: 'stone' },
  },
  town_center: {
    ...meadow, ground: [0x58a04a, 0x6dba58, 0x8bd16c], tree: 'planter', rock: 'barrel', flowers: 40, ground2: townGround,
    path: { edge: 0x464a56, base: 0x8a8f9c, inner: 0xaab0bc, stones: [0xbcc2cc, 0xa3a9b6, 0xc9ced8, 0x959bab], style: 'cobble' },
  },
  in_the_loop: { ...meadow, ground: [0x5ba33d, 0x73bd49, 0x97d65a], patch: 0xcbe670, flowers: 90 },
  cubism: {
    ground: [0x6c8fa8, 0x7fa3bb, 0x95b9cd], path: { edge: 0x3d3a55, base: 0xd9a35a, inner: 0xf0c479, stones: [0xf3cf88, 0xe6b862, 0xf7dc9f, 0xd9a350], style: 'tile' },
    water: meadowWater, tree: 'cube', rock: 'prism', flowers: 0, tufts: 0, tuftC: [0, 0], ground2: cubismGround,
  },
  logs: {
    ground: [0x2f6b34, 0x3f8040, 0x59a04b], patch: 0x6a9a3c, path: { edge: 0x3a2a1c, base: 0x8c6a43, inner: 0xad8657, stones: [0xb08c5c, 0x9c7a4c, 0xbf9a68], style: 'dirt' },
    water: { deep: 0x1f6f78, shallow: 0x3da79a, foam: 0xdaf7ea, shore: 0x6b5a34, pads: true }, tree: 'logs', rock: 'rock', flowers: 18, tufts: 600, tuftC: [0x24592b, 0x6bb55a], ground2: forestGround,
  },
  scrapyard: {
    ground: [0x6e6354, 0x857964, 0x9c9078], path: { edge: 0x2b2b30, base: 0x55565e, inner: 0x6d6f79, stones: [0x7b7e89, 0x666872, 0x8c909b, 0x5a5c66], style: 'tile' },
    water: meadowWater, tree: 'tire', rock: 'crate', flowers: 0, tufts: 120, tuftC: [0x5d6b3a, 0x8a9a52], ground2: scrapGround,
  },
  cornfield: {
    ground: [0x8a6a3e, 0xa27c48, 0xb8925a], path: { edge: 0x4a3418, base: 0xc9a468, inner: 0xe0be82, stones: [0xe6c78c, 0xd3b073, 0xedd199], style: 'dirt' },
    water: meadowWater, tree: 'hay', rock: 'rock', flowers: 0, tufts: 0, tuftC: [0, 0], ground2: cornGround,
  },
  spice_islands: {
    ground: [0xe0c88a, 0xecd9a0, 0xf6e8b8], patch: 0xfff3cf, path: { edge: 0x5e3d20, base: 0x9a6a3c, inner: 0xb98a55, stones: [0xc79a62, 0xad7c48, 0xd5aa72], style: 'plank' },
    water: { deep: 0x0f78b8, shallow: 0x3fd0d8, foam: 0xffffff, shore: 0xf3e2a8, sea: true }, tree: 'palm', rock: 'rock', flowers: 14, tufts: 140, tuftC: [0x4f9a3c, 0x8bd25a], ground2: sandGround,
  },
  sunken_columns: {
    ground: [0xc2b283, 0xd2c496, 0xe2d6aa], patch: 0xeee4bd, path: { edge: 0x4a4a4e, base: 0x9a9a9a, inner: 0xbbbbb8, stones: [0xcfcfca, 0xb5b5b0, 0xdedcd4, 0xa4a4a0], style: 'stone' },
    water: { deep: 0x1a6fb4, shallow: 0x36b7d6, foam: 0xf0ffff, shore: 0xcdbf8b, sea: true }, tree: 'column', rock: 'coral', flowers: 0, tufts: 90, tuftC: [0x3f8f6a, 0x7bcf8a], tint: [0x2a9ab8, 0.07], ground2: sandGround,
  },
  dark_castle: {
    ground: [0x3a3b4a, 0x4a4b5c, 0x5c5d70], patch: 0x6c6e84, path: { edge: 0x15151c, base: 0x6a5d52, inner: 0x85776a, stones: [0x95867a, 0x7a6d62, 0xa3948a, 0x6c6056], style: 'stone' },
    water: { deep: 0x1a2e5a, shallow: 0x2f5a96, foam: 0xa8c4e8, shore: 0x2a2a34 }, tree: 'dead', rock: 'rock', flowers: 0, tufts: 60, tuftC: [0x2f4a30, 0x4f7a46], tint: [0x201040, 0.18], ground2: castleGround,
  },
  ravine: {
    ground: [0x7d6a56, 0x93806a, 0xab977e], patch: 0xbfab92, path: { edge: 0x3b3128, base: 0xa89572, inner: 0xc4b08a, stones: [0xd0bd96, 0xb8a47e, 0xddcaa4], style: 'stone' },
    water: { deep: 0x1d7a86, shallow: 0x44b8b0, foam: 0xeafffa, shore: 0x6a5a48 }, tree: 'pine', rock: 'rock', flowers: 6, tufts: 150, tuftC: [0x4a6a3a, 0x7a9a52], ground2: ravineGround,
  },
};

const W = 960, H = 540;
const ell = (c: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); c.fill(); };

function paintGround(c: Ctx, T: Theme, seed: number) {
  const lw = 240, lh = 135, cv = document.createElement('canvas'); cv.width = lw; cv.height = lh;
  const x = cv.getContext('2d')!, im = x.createImageData(lw, lh), [g0, g1, g2] = T.ground;
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const wx = i * 4, wy = j * 4, f = fbm(wx / 70, wy / 70, seed), t = Math.max(0, Math.min(1, (f - 0.28) / 0.42));
    let col = t < 0.5 ? mix(g0, g1, t * 2) : mix(g1, g2, (t - 0.5) * 2);
    if (T.patch !== undefined) { const p = Math.max(0, Math.min(1, (vnoise(wx / 120, wy / 120, seed + 7) - 0.52) * 5)); col = mix(col, T.patch, p * 0.55); }
    const k = (j * lw + i) * 4; im.data[k] = col >> 16; im.data[k + 1] = (col >> 8) & 255; im.data[k + 2] = col & 255; im.data[k + 3] = 255;
  }
  x.putImageData(im, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, W, H);
}

function brush(c: Ctx, T: Theme, r: Rng) {
  c.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, a = -0.5 + r() * 0.4, L = 6 + r() * 12, dark = r() < 0.5;
    c.strokeStyle = css(dark ? drk(T.ground[0], 0.2) : lit(T.ground[2], 0.25), 0.09 + r() * 0.08); c.lineWidth = 2 + r() * 3;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y - 3, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.3); c.stroke();
  }
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

function rrect(c: Ctx, x: number, y: number, w: number, h: number, rad: number | number[]) { c.beginPath(); c.roundRect(x, y, w, h, rad); }

function paintWater(c: Ctx, w: { x: number; y: number; width: number; height: number }, T: Theme, r: Rng) {
  const { x, y, width: ww, height: hh } = w, wt = T.water;
  const rad = (a: number, b: number) => [a, b].map(v => v), edge = (v: number, lim: number) => (v <= 0.5 || v >= lim - 0.5);
  const R = 18, rr = [edge(x, W) || edge(y, H) ? 0 : R, edge(x + ww, W) || edge(y, H) ? 0 : R, edge(x + ww, W) || edge(y + hh, H) ? 0 : R, edge(x, W) || edge(y + hh, H) ? 0 : R];
  void rad;
  if (!wt.sea) { // shore: wet bank + sand rim
    c.fillStyle = css(drk(wt.shore, 0.25), 0.55); rrect(c, x - 9, y - 9, ww + 18, hh + 18, R + 9); c.fill();
    c.fillStyle = css(wt.shore); rrect(c, x - 6, y - 6, ww + 12, hh + 12, R + 6); c.fill();
    for (let i = 0; i < ww / 5; i++) { const t = r() * (ww + hh) * 2, px = t < ww ? x + t : t < ww + hh ? x + ww + 4 : t < 2 * ww + hh ? x + ww - (t - ww - hh) : x - 4, py = t < ww ? y - 5 : t < ww + hh ? y + (t - ww) : t < 2 * ww + hh ? y + hh + 5 : y + hh - (t - 2 * ww - hh); ell(c, px + (r() - 0.5) * 6, py + (r() - 0.5) * 6, 2.5, 2, css(pick(r, [0x8a8a84, 0xb0aaa0, 0x6e6e68])), r() * 3); }
  }
  c.save(); rrect(c, x, y, ww, hh, rr); c.clip();
  const g = c.createLinearGradient(x, y, x + ww * 0.3, y + hh); g.addColorStop(0, css(wt.shallow)); g.addColorStop(0.55, css(wt.deep)); g.addColorStop(1, css(drk(wt.deep, 0.25)));
  c.fillStyle = g; c.fillRect(x, y, ww, hh);
  // shallows ring
  c.strokeStyle = css(wt.shallow, 0.55); c.lineWidth = 22; rrect(c, x, y, ww, hh, rr); c.stroke();
  c.strokeStyle = css(lit(wt.shallow, 0.4), 0.3); c.lineWidth = 8; rrect(c, x + 3, y + 3, ww - 6, hh - 6, rr); c.stroke();
  // light caustic blobs
  for (let i = 0; i < ww * hh / 900; i++) ell(c, x + r() * ww, y + r() * hh, 6 + r() * 14, 2 + r() * 4, css(lit(wt.shallow, 0.5), 0.1 + r() * 0.1), r() * 0.3);
  // wave ripples
  c.lineCap = 'round'; c.lineWidth = 1.8;
  for (let py = y + 14; py < y + hh - 6; py += wt.sea ? 22 : 26) for (let px = x + 14 + ((py * 7) % 30); px < x + ww - 14; px += wt.sea ? 54 : 46) {
    const o = (r() - 0.5) * 10; c.strokeStyle = css(0xffffff, 0.34); c.beginPath(); c.moveTo(px - 11 + o, py); c.quadraticCurveTo(px - 5 + o, py - 4, px + o, py); c.quadraticCurveTo(px + 5 + o, py + 4, px + 11 + o, py); c.stroke();
  }
  // foam rim
  c.strokeStyle = css(wt.foam, 0.85); c.lineWidth = 3; rrect(c, x + 1.5, y + 1.5, ww - 3, hh - 3, rr); c.stroke();
  c.setLineDash([3, 7]); c.lineWidth = 3; c.strokeStyle = css(wt.foam, 0.55); rrect(c, x + 7, y + 7, ww - 14, hh - 14, rr); c.stroke(); c.setLineDash([]);
  c.restore();
  if (wt.pads) for (let i = 0; i < Math.max(3, ww * hh / 4500); i++) {
    const px = x + 20 + r() * (ww - 40), py = y + 20 + r() * (hh - 40), s = 6 + r() * 4, a = r() * 6.28;
    ell(c, px + 1.5, py + 2, s, s * 0.85, 'rgba(0,30,40,.3)');
    c.fillStyle = css(pick(r, [0x3f9a4a, 0x4fb056, 0x2f8040])); c.beginPath(); c.moveTo(px, py); c.arc(px, py, s, a + 0.35, a + 6.283 - 0.1); c.closePath(); c.fill();
    c.strokeStyle = css(0x1f6a30, 0.7); c.lineWidth = 1; c.stroke(); ell(c, px - s * 0.2, py - s * 0.25, s * 0.45, s * 0.3, css(0x9be062, 0.5));
    if (r() < 0.4) { for (let k = 0; k < 5; k++) { const q = (k / 5) * 6.283; ell(c, px + Math.cos(q) * 2.4, py + Math.sin(q) * 2.4, 2, 1.4, css(0xffb0d0), q); } ell(c, px, py, 1.3, 1.3, css(0xffe14d)); }
  }
}

function paintPath(c: Ctx, m: MapDef, T: Theme, r: Rng) {
  const P = T.path;
  const trace = (l: { x: number; y: number }[]) => { c.beginPath(); l.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); };
  c.lineJoin = 'round'; c.lineCap = 'round';
  const stroke = (w: number, col: string, dy = 0) => { c.strokeStyle = col; c.lineWidth = w; c.save(); c.translate(0, dy); for (const l of m.lanes) { trace(l); c.stroke(); } c.restore(); };
  stroke(66, 'rgba(0,0,0,.14)', 4); stroke(60, 'rgba(0,0,0,.14)', 3);
  // pebble border
  for (const l of m.lanes) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (let t = 0; t < L; t += 7) for (const s of [-1, 1]) {
      const o = s * (27.5 + r() * 3), px = a.x + (dx / L) * t + nx * o + (r() - 0.5) * 3, py = a.y + (dy / L) * t + ny * o;
      if (laneDist(m, px, py) < 24.5) continue;
      const rr = 1.6 + r() * 2.2, col = pick(r, [0xb4aea2, 0x8e8a80, 0xcbc4b4, 0x9a9488, P.stones[0]]);
      ell(c, px + 0.8, py + 1.2, rr, rr * 0.85, 'rgba(0,0,0,.3)'); ell(c, px, py, rr, rr * 0.85, css(col)); ell(c, px - rr * 0.3, py - rr * 0.35, rr * 0.45, rr * 0.35, css(lit(col, 0.5), 0.8));
    }
  }
  stroke(55, css(P.edge)); stroke(51, css(drk(P.base, 0.2))); stroke(46, css(P.base)); stroke(40, css(P.inner));
  stroke(34, css(lit(P.inner, 0.06)));
  const clipPath = new Path2D(); // keep pavers inside the 40px band
  const isEdge = (p: { x: number; y: number }) => p.x <= 0 || p.x >= W || p.y <= 0 || p.y >= H;
  for (const l of m.lanes) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
    const s0 = isEdge(a) ? -14 : 17, s1 = isEdge(b) ? L + 14 : L - 17;
    const rowsN = P.style === 'cobble' ? 6 : P.style === 'plank' ? 1 : 3, rowW = 34 / rowsN;
    c.save(); c.translate(a.x, a.y); c.rotate(ang);
    if (P.style === 'plank') {
      for (let t = s0; t < s1; t += 7.5) {
        const col = pick(r, P.stones); c.fillStyle = css(drk(col, 0.45)); c.fillRect(t, -19, 7.6, 38); c.fillStyle = css(col); c.fillRect(t + 0.5, -18.5, 6.6, 37);
        c.fillStyle = css(lit(col, 0.25), 0.55); c.fillRect(t + 0.5, -18.5, 6.6, 2); c.strokeStyle = css(drk(col, 0.25), 0.5); c.lineWidth = 0.7; c.beginPath(); c.moveTo(t + 2 + r() * 3, -17); c.lineTo(t + 2 + r() * 3, 17); c.stroke();
        c.fillStyle = css(0x3a2a1a, 0.8); ell(c, t + 3.5, -15, 0.8, 0.8, css(0x2a1a0a)); ell(c, t + 3.5, 15, 0.8, 0.8, css(0x2a1a0a));
      }
    } else if (P.style === 'dirt') {
      for (const o of [-9, 9]) { c.strokeStyle = css(drk(P.base, 0.2), 0.45); c.lineWidth = 3.5; c.beginPath(); c.moveTo(s0, o); c.lineTo(s1, o); c.stroke(); }
      for (let t = s0; t < s1; t += 3) { const o = (r() - 0.5) * 36; ell(c, t, o, 1 + r() * 2, 0.8 + r(), css(pick(r, P.stones.concat([drk(P.base, 0.3)])), 0.6), r() * 3); }
    } else {
      const step = P.style === 'cobble' ? 8 : P.style === 'tile' ? 14 : 17;
      for (let row = 0; row < rowsN; row++) {
        const oy = -17 + rowW * (row + 0.5);
        for (let t = s0 + ((row % 2) * step) / 2; t < s1; t += step) {
          const col = pick(r, P.stones), px = t, py = oy + (r() - 0.5) * 0.8;
          if (P.style === 'cobble') { ell(c, px, py + 0.8, step * 0.55, rowW * 0.55, css(drk(col, 0.5), 0.8)); ell(c, px, py, step * 0.5, rowW * 0.48, css(col)); ell(c, px - 1, py - 1, step * 0.28, rowW * 0.2, css(lit(col, 0.4), 0.7)); }
          else if (P.style === 'tile') { c.fillStyle = css(drk(col, 0.4)); c.fillRect(px - step / 2 + 0.3, py - rowW / 2 + 0.3, step - 0.6, rowW - 0.6); c.fillStyle = css(col); c.fillRect(px - step / 2 + 1.2, py - rowW / 2 + 1.2, step - 2.4, rowW - 2.4); c.fillStyle = css(lit(col, 0.4), 0.7); c.fillRect(px - step / 2 + 1.2, py - rowW / 2 + 1.2, step - 2.4, 1.5); }
          else { const w2 = step * (0.86 + r() * 0.1) - 1.5; c.fillStyle = css(drk(col, 0.45), 0.9); rrect(c, px - w2 / 2, py - rowW / 2 + 0.4, w2, rowW - 0.8, 3); c.fill(); c.fillStyle = css(col); rrect(c, px - w2 / 2 + 0.7, py - rowW / 2 + 0.7, w2 - 1.6, rowW - 2.2, 2.6); c.fill(); c.fillStyle = css(lit(col, 0.45), 0.65); rrect(c, px - w2 / 2 + 2, py - rowW / 2 + 1.4, w2 - 5, 1.8, 1); c.fill(); }
        }
      }
    }
    c.restore(); void ux; void uy; void clipPath;
  }
  // corner plates
  if (P.style !== 'dirt' && P.style !== 'plank') for (const l of m.lanes) for (let i = 1; i < l.length - 1; i++) { const p = l[i]; c.fillStyle = css(drk(P.base, 0.25)); rrect(c, p.x - 19, p.y - 19, 38, 38, 5); c.fill(); for (const [ox, oy] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]]) { const col = pick(r, P.stones); c.fillStyle = css(col); rrect(c, p.x + ox - 8.5, p.y + oy - 8.5, 17, 17, P.style === 'tile' ? 1 : 4); c.fill(); c.fillStyle = css(lit(col, 0.45), 0.6); rrect(c, p.x + ox - 6, p.y + oy - 7, 12, 2, 1); c.fill(); } }
  if (P.style === 'plank') for (const l of m.lanes) for (let i = 1; i < l.length - 1; i++) { const p = l[i]; ell(c, p.x, p.y, 19, 19, css(pick(r, P.stones))); c.strokeStyle = css(drk(P.base, 0.3), 0.6); c.lineWidth = 1; for (let q = -12; q <= 12; q += 8) { c.beginPath(); c.moveTo(p.x - 18, p.y + q); c.lineTo(p.x + 18, p.y + q); c.stroke(); } }
  // soft inner light
  stroke(20, css(0xffffff, 0.06));
}

function vignette(c: Ctx, T: Theme) {
  if (T.tint) { c.fillStyle = css(T.tint[0], T.tint[1]); c.fillRect(0, 0, W, H); }
  const g = c.createRadialGradient(W / 2, H / 2, 230, W / 2, H / 2, 620); g.addColorStop(0, 'rgba(10,20,10,0)'); g.addColorStop(1, 'rgba(8,10,24,.5)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const s = c.createLinearGradient(0, 0, W, H); s.addColorStop(0, 'rgba(255,245,200,.1)'); s.addColorStop(0.5, 'rgba(255,245,200,0)'); s.addColorStop(1, 'rgba(0,0,30,.08)');
  c.fillStyle = s; c.fillRect(0, 0, W, H);
}

function seedOf(id: string) { let h = 99; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

function renderMap(map: MapDef, S: number): HTMLCanvasElement {
  const T = THEMES[map.id] ?? meadow, seed = seedOf(map.id), r = mulberry32(seed);
  const cv = document.createElement('canvas'); cv.width = Math.round(W * S); cv.height = Math.round(H * S);
  const c = cv.getContext('2d')!; c.scale(S, S);
  paintGround(c, T, seed & 255); brush(c, T, r); T.ground2?.(c, r, map, T);
  const ok = (x: number, y: number) => free(map, x, y, 31) && !T.skip?.(x, y);
  for (let i = 0; i < T.tufts; i++) { const x = r() * W, y = r() * H; if (ok(x, y)) tuft(c, x, y, T.tuftC, r); }
  for (let i = 0; i < T.flowers; i++) { const x = r() * W, y = r() * H; if (ok(x, y)) { const n = 1 + Math.floor(r() * 3); for (let k = 0; k < n; k++) flower(c, x + (r() - 0.5) * 12, y + (r() - 0.5) * 10, r); } }
  for (const w of map.water) paintWater(c, w, T, r);
  paintPath(c, map, T, r);
  for (const d of [...map.deco].sort((a, b) => a.y - b.y)) drawDeco(c, d, T, r);
  vignette(c, T);
  return cv;
}

const cache = new Map<string, HTMLCanvasElement>();
/** Cached full-res (devicePixelRatio, max 2x) render of a map; null outside the browser. */
export function mapCanvas(map: MapDef, scale = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1)): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const key = map.id + '@' + scale; let cv = cache.get(key);
  if (!cv) { cv = renderMap(map, scale); cache.set(key, cv); }
  return cv;
}
