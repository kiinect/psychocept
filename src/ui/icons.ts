import { renderAtlas, heroId } from '../art';
import type { TowerKind } from '../towers';
const towerIds: Partial<Record<TowerKind, string>> = { wizard: 'wizard_monkey', super: 'super_monkey', ninja: 'ninja_monkey', farm: 'banana_farm', engineer: 'engineer_monkey', spike: 'spike_factory', village: 'monkey_village', beast: 'beast_handler' };
let atlas: ReturnType<typeof renderAtlas> | undefined;
const cache = new Map<string, string>();
export function icon(kind: 'tower' | 'hero', id: string): string {
  const key = `${kind}/${kind === 'tower' ? towerIds[id as TowerKind] ?? id : heroId(id)}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    atlas ??= renderAtlas();
    const frame = atlas.frames[key];
    if (!frame) return '';
    const canvas = document.createElement('canvas'); canvas.width = frame.w; canvas.height = frame.h;
    canvas.getContext('2d')!.drawImage(atlas.canvas, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    const url = canvas.toDataURL(); cache.set(key, url); return url;
  } catch { return ''; }
}
export function portrait(kind: 'tower' | 'hero', id: string, color: number): string {
  const url = icon(kind, id);
  return url ? `<img class="portrait" alt="" src="${url}">` : `<span class="portrait disc" style="background:#${color.toString(16).padStart(6, '0')}" aria-hidden="true"></span>`;
}
