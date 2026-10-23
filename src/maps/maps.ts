import mapJson from '../../data/maps.json';
import { mulberry32, type Circle, type Pt, type Rect } from '../sim';

export interface Deco extends Circle { kind: 'tree' | 'rock' | 'flower' | 'bush' }
export interface MapDef { id: string; name: string; tier: string; lanes: Pt[][]; water: Rect[]; blocked: Circle[]; deco: Deco[] }

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

// Trees/rocks are scattered deterministically per map id; trees and rocks double as no-build circles.
function scatter(id: string, lanes: Pt[][], water: Rect[]): Deco[] {
  let h = 7; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = mulberry32(h), out: Deco[] = [];
  const clear = (p: Pt, pad: number) => lanes.every(l => l.slice(1).every((b, i) => segDist(p, l[i], b) > 20 + pad)) &&
    water.every(w => p.x < w.x - pad || p.x > w.x + w.width + pad || p.y < w.y - pad || p.y > w.y + w.height + pad);
  for (let tries = 0; tries < 400 && out.length < 34; tries++) {
    const roll = rnd(), p = { x: 20 + rnd() * 920, y: 20 + rnd() * 500 };
    const kind: Deco['kind'] = out.length < 12 ? 'tree' : roll < 0.3 ? 'rock' : roll < 0.55 ? 'bush' : 'flower';
    const r = kind === 'tree' ? 20 : kind === 'rock' ? 12 : kind === 'bush' ? 11 : 4;
    if (clear(p, r + 16) && out.every(o => Math.hypot(o.x - p.x, o.y - p.y) > o.r + r + 14)) out.push({ ...p, r, kind });
  }
  return out;
}

export const MAPS: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(mapJson.maps)) {
  const lanes = (m.lanes as number[][][]).map(l => l.map(([x, y]) => ({ x, y })));
  const water = (m.water as number[][]).map(([x, y, width, height]) => ({ x, y, width, height }));
  const deco = scatter(id, lanes, water);
  MAPS[id] = { id, name: m.name, tier: m.tier, lanes, water, deco, blocked: deco.filter(d => d.kind === 'tree' || d.kind === 'rock') };
}
export const TIERS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
