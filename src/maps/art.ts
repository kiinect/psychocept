// Map art entry points: the painted background (Pixi sprite in the game, image in map-select cards) with a flat
// polygon fallback when there is no DOM (tests, headless tools).
import { Sprite, Texture, type Container } from 'pixi.js';
import { nestedAreas } from '../sim';
import type { MapDef } from './maps';
import { MARGIN, mapCanvas } from './paint';

const tex = new Map<string, Texture>(), thumbs = new Map<string, string>();
const FILL = { water: '#3da5d9', land: '#7cc35a', blocked: '#2f6a2a' } as const;
const pts = (poly: { x: number; y: number }[]) => poly.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** World-space rectangle the painted background covers (play area plus margin), in map units. */
export const sceneRect = (m: MapDef) => ({ x: -MARGIN.x, y: -MARGIN.y, w: m.width + 2 * MARGIN.x, h: m.height + 2 * MARGIN.y });

/** Put the painted background into `layer` (cached texture per map). Without a DOM the layer is left empty. */
export function drawScene(layer: Container, map: MapDef) {
  layer.removeChildren();
  const cv = mapCanvas(map); if (!cv) return;
  let t = tex.get(map.id); if (!t) tex.set(map.id, t = Texture.from(cv));
  const r = sceneRect(map), s = new Sprite(t);
  s.x = r.x; s.y = r.y; s.width = r.w; s.height = r.h; layer.addChild(s);
}

/** Map-select thumbnail: the painted map cropped to the play area, or flat polygons without a DOM. */
export function sceneSvg(map: MapDef): string {
  const view = `0 0 ${map.width} ${map.height}`;
  const cv = mapCanvas(map, 0.35);
  if (cv) {
    let u = thumbs.get(map.id); if (!u) thumbs.set(map.id, u = cv.toDataURL('image/jpeg', 0.82));
    const r = sceneRect(map);
    return `<svg viewBox="${view}" aria-hidden="true"><image href="${u}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" preserveAspectRatio="none"/></svg>`;
  }
  const body = [...nestedAreas(map)].reverse().map(a => `<polygon points="${pts(a.poly)}" fill="${FILL[a.kind]}"/>`).join('')
    + map.track.map(t => `<polygon points="${pts(t)}" fill="#c9a36b" stroke="#5a4a32" stroke-width="1"/>`).join('');
  return `<svg viewBox="${view}" aria-hidden="true"><rect x="0" y="0" width="${map.width}" height="${map.height}" fill="${FILL.land}"/>${body}</svg>`;
}
