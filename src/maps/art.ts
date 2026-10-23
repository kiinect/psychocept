// Original cartoon map art as a flat shape list, rendered by PixiJS (game) and SVG (map-select thumbnails).
import { Texture, type Graphics } from 'pixi.js';
import type { MapDef } from './maps';
import { mapCanvas } from './paint';

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: number; rx?: number; stroke?: number; sw?: number; a?: number }
  | { t: 'circle'; x: number; y: number; r: number; fill: number; a?: number }
  | { t: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: number; a?: number }
  | { t: 'line'; pts: number[]; w: number; color: number };

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

export function scene(map: MapDef): Shape[] {
  const s: Shape[] = [{ t: 'rect', x: 0, y: 0, w: 960, h: 540, fill: 0x62b946 }];
  for (let y = 0; y < 540; y += 60) s.push({ t: 'rect', x: 0, y, w: 960, h: 30, fill: 0x6cc24e });
  for (const l of map.lanes) {
    const pts = l.flatMap(p => [p.x, p.y]);
    s.push({ t: 'line', pts, w: 52, color: 0x8a6a3c }, { t: 'line', pts, w: 44, color: 0xd9b36f }, { t: 'line', pts, w: 26, color: 0xe6c685 });
  }
  for (const w of map.water) s.push(
    { t: 'rect', x: w.x - 6, y: w.y - 6, w: w.width + 12, h: w.height + 12, fill: 0xe9d9a0, rx: 22 },
    { t: 'rect', x: w.x, y: w.y, w: w.width, h: w.height, fill: 0x3da5d9, rx: 16 },
    { t: 'rect', x: w.x + 8, y: w.y + 8, w: w.width - 16, h: w.height - 16, fill: 0x56bde8, rx: 12, a: 0.6 });
  for (const w of map.water) for (let x = w.x + 24; x < w.x + w.width - 20; x += 46) for (let y = w.y + 22; y < w.y + w.height - 14; y += 40)
    s.push({ t: 'line', pts: [x - 8, y, x - 3, y - 3, x + 3, y + 3, x + 8, y], w: 2, color: 0xd5f1fb });
  for (const d of map.deco) {
    if (d.kind === 'tree') s.push({ t: 'ellipse', x: d.x + 4, y: d.y + 18, rx: 20, ry: 7, fill: 0x3f8a2c, a: 0.5 }, { t: 'rect', x: d.x - 4, y: d.y + 2, w: 8, h: 16, fill: 0x7a4a24 },
      { t: 'circle', x: d.x, y: d.y - 4, r: 19, fill: 0x2f8f3a }, { t: 'circle', x: d.x - 7, y: d.y - 8, r: 11, fill: 0x45b04a }, { t: 'circle', x: d.x + 8, y: d.y - 2, r: 9, fill: 0x45b04a });
    else if (d.kind === 'rock') s.push({ t: 'ellipse', x: d.x, y: d.y + 3, rx: 13, ry: 9, fill: 0x7b8088 }, { t: 'ellipse', x: d.x - 2, y: d.y, rx: 10, ry: 7, fill: 0xa4a9b0 });
    else if (d.kind === 'bush') s.push({ t: 'circle', x: d.x, y: d.y, r: 11, fill: 0x3d9d3f }, { t: 'circle', x: d.x + 6, y: d.y + 2, r: 8, fill: 0x56b955 });
    else s.push({ t: 'circle', x: d.x, y: d.y, r: 4, fill: 0xffe14d }, { t: 'circle', x: d.x, y: d.y, r: 1.6, fill: 0xf08a24 });
  }
  return s;
}

const tex = new Map<string, Texture>(), thumbs = new Map<string, string>();

/** Painted background (cached texture, rendered once per map); falls back to the flat shape list without a DOM. */
export function drawScene(g: Graphics, map: MapDef) {
  g.clear();
  const cv = mapCanvas(map);
  if (cv) {
    let t = tex.get(map.id); if (!t) tex.set(map.id, t = Texture.from(cv));
    g.rect(0, 0, 960, 540).fill({ texture: t }); return;
  }
  for (const s of scene(map)) {
    if (s.t === 'rect') { (s.rx ? g.roundRect(s.x, s.y, s.w, s.h, s.rx) : g.rect(s.x, s.y, s.w, s.h)).fill({ color: s.fill, alpha: s.a ?? 1 }); }
    else if (s.t === 'circle') g.circle(s.x, s.y, s.r).fill({ color: s.fill, alpha: s.a ?? 1 });
    else if (s.t === 'ellipse') g.ellipse(s.x, s.y, s.rx, s.ry).fill({ color: s.fill, alpha: s.a ?? 1 });
    else g.poly(s.pts, false).stroke({ width: s.w, color: s.color, join: 'round', cap: 'round' });
  }
}

export function sceneSvg(map: MapDef): string {
  const cv = mapCanvas(map, 0.5);
  if (cv) {
    let u = thumbs.get(map.id); if (!u) thumbs.set(map.id, u = cv.toDataURL('image/jpeg', 0.82));
    return `<svg viewBox="0 0 960 540" aria-hidden="true"><image href="${u}" width="960" height="540"/></svg>`;
  }
  const body = scene(map).map(s => {
    const o = 'a' in s && s.a !== undefined ? ` opacity="${s.a}"` : '';
    if (s.t === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx ?? 0}" fill="${hex(s.fill)}"${o}/>`;
    if (s.t === 'circle') return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${hex(s.fill)}"${o}/>`;
    if (s.t === 'ellipse') return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="${hex(s.fill)}"${o}/>`;
    return `<polyline points="${s.pts.join(' ')}" fill="none" stroke="${hex(s.color)}" stroke-width="${s.w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 960 540" aria-hidden="true">${body}</svg>`;
}
