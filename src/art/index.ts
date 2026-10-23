// Art lane entry: code-drawn sprite atlas. `buildTextures(renderer)` once at startup, then `spriteFor(kind,id,tier?)`.
import { Rectangle, Texture, type Renderer } from 'pixi.js';
import type { Ctx } from './draw';
import { BALLOON_H, BALLOON_IDS, BALLOON_W, BLIMP_IDS, BLIMP_SIZE, BLOON_OVERLAYS, drawBalloon, drawBlimp, drawOverlay } from './bloons';
import {
  FX_FRAMES, FX_SIZE, HERO_IDS, PROJ_IDS, RING_IDS, UI_BUTTONS, UI_ICONS, UI_PANELS, UI_PIPS,
  drawButton, drawFx, drawHero, drawIcon, drawPanel, drawProj, drawRing, drawUiMisc,
} from './misc';
import { TOWER_IDS, TOWER_SIZE, drawTower } from './towers';

export { BALLOON_IDS, BLIMP_IDS, HERO_IDS, TOWER_IDS, PROJ_IDS };
export { slug as heroId } from './misc';
export { PANEL_SLICE } from './misc';
export type SpriteKind = 'tower' | 'hero' | 'bloon' | 'overlay' | 'proj' | 'fx' | 'ring' | 'ui';

/**
 * Canonical key. `tier` for towers is a [p1,p2,p3] tier triple (dominant path chosen) or a plain number
 * (= that tier on path 1); 0/undefined = base sprite. For fx it is the animation frame.
 * ui ids: panel_<wood|blue|parchment>, btn_<colour>[_down], icon_<name>, pip_on, pip_off, tab, tab_sel, bar.
 */
export function spriteKey(kind: SpriteKind, id: string, tier?: number | readonly number[]): string {
  if (kind === 'tower') {
    const t = typeof tier === 'number' ? [tier, 0, 0] : tier ?? [0, 0, 0];
    const top = Math.max(...t, 0);
    return top === 0 ? `tower/${id}` : `tower/${id}/p${t.indexOf(top) + 1}t${top}`;
  }
  if (kind === 'fx') return `fx/${id}/${typeof tier === 'number' ? tier : 0}`;
  return `${kind}/${id}`;
}

interface Item { key: string; w: number; h: number; draw: (c: Ctx) => void }

/** Every sprite the atlas contains (pure, no canvas needed). */
export function manifest(): Item[] {
  const out: Item[] = [];
  const add = (key: string, w: number, h: number, draw: (c: Ctx) => void) => out.push({ key, w, h, draw });
  for (const id of TOWER_IDS) {
    add(`tower/${id}`, TOWER_SIZE, TOWER_SIZE, c => drawTower(c, id));
    for (let p = 0; p < 3; p++) for (let t = 1; t <= 5; t++) add(`tower/${id}/p${p + 1}t${t}`, TOWER_SIZE, TOWER_SIZE, c => drawTower(c, id, p, t));
  }
  for (const id of HERO_IDS) add(`hero/${id}`, 96, 96, c => drawHero(c, id));
  for (const id of BALLOON_IDS) add(`bloon/${id}`, BALLOON_W, BALLOON_H, c => drawBalloon(c, id));
  for (const id of BLIMP_IDS) add(`bloon/${id}`, BLIMP_SIZE[id][0], BLIMP_SIZE[id][1], c => drawBlimp(c, id));
  for (const id of BLOON_OVERLAYS) add(`overlay/${id}`, BALLOON_W, BALLOON_H, c => drawOverlay(c, id));
  for (const id of PROJ_IDS) add(`proj/${id}`, 32, 32, c => drawProj(c, id));
  for (const k of Object.keys(FX_FRAMES)) for (let f = 0; f < FX_FRAMES[k]; f++) add(`fx/${k}/${f}`, FX_SIZE[k], FX_SIZE[k], c => drawFx(c, k, f));
  for (const id of RING_IDS) add(`ring/${id}`, 256, 256, c => drawRing(c, id));
  for (const k of UI_PANELS) add(`ui/panel_${k}`, 96, 96, c => drawPanel(c, k));
  for (const k of UI_BUTTONS) { add(`ui/btn_${k}`, 96, 44, c => drawButton(c, k, false)); add(`ui/btn_${k}_down`, 96, 44, c => drawButton(c, k, true)); }
  for (const k of UI_ICONS) add(`ui/icon_${k}`, 32, 32, c => drawIcon(c, k));
  for (const k of UI_PIPS) add(`ui/${k}`, k.startsWith('tab') ? 80 : k === 'bar' ? 96 : 20, k.startsWith('tab') ? 40 : k === 'bar' ? 24 : 20, c => drawUiMisc(c, k));
  return out;
}

export const ALL_KEYS = (): string[] => manifest().map(i => i.key);
export interface Frame { x: number; y: number; w: number; h: number }

/** Shelf-pack + draw everything to one canvas (also used by preview.html). */
export function renderAtlas(width = 2048): { canvas: HTMLCanvasElement; frames: Record<string, Frame> } {
  const items = manifest().sort((a, b) => b.h - a.h || b.w - a.w), pad = 2;
  const frames: Record<string, Frame> = {};
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    if (x + it.w + pad > width) { x = 0; y += rowH + pad; rowH = 0; }
    frames[it.key] = { x, y, w: it.w, h: it.h }; x += it.w + pad; rowH = Math.max(rowH, it.h);
  }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = y + rowH + pad;
  const c = canvas.getContext('2d')!;
  for (const it of items) { const f = frames[it.key]; c.save(); c.translate(f.x, f.y); c.beginPath(); c.rect(0, 0, f.w, f.h); c.clip(); it.draw(c); c.restore(); }
  return { canvas, frames };
}

export type Atlas = Record<string, Texture>;
let current: Atlas = {};

/** Draw all sprites once and return the keyed texture atlas. `renderer` is accepted for API symmetry (upload happens lazily). */
export function buildTextures(_renderer?: Renderer): Atlas {
  const { canvas, frames } = renderAtlas();
  const base = Texture.from(canvas);
  const atlas: Atlas = {};
  for (const k in frames) { const f = frames[k]; atlas[k] = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) }); }
  return (current = atlas);
}

/** Texture for a sprite from the last `buildTextures` call. */
export function spriteFor(kind: SpriteKind, id: string, tier?: number | readonly number[]): Texture {
  const t = current[spriteKey(kind, id, tier)];
  if (!t) throw new Error(`no sprite ${spriteKey(kind, id, tier)}`);
  return t;
}
