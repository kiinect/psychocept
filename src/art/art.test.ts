import { describe, expect, it } from 'vitest';
import { ALL_KEYS, manifest, spriteKey } from './index';
import { slug } from './misc';
import heroesJson from '../../data/wiki/heroes.json';
import bloonsJson from '../../data/wiki/bloons.json';

const towerFiles = Object.keys(import.meta.glob('../../data/wiki/towers/*.json')).map(f => f.split('/').pop()!);

const keys = new Set(ALL_KEYS());

// Records every canvas call so draw code is exercised headlessly (typos / bad calls throw).
function stub(): never {
  const fn: unknown = new Proxy(function () { /* */ }, {
    get: (_t, p) => (p === 'addColorStop' ? () => undefined : fn),
    set: () => true,
    apply: () => fn,
  });
  return fn as never;
}

describe('art atlas', () => {
  it('every tower id and tier variant resolves', () => {
    for (const f of towerFiles) {
      const id = f.replace('.json', '');
      expect(keys.has(spriteKey('tower', id)), id).toBe(true);
      for (let p = 0; p < 3; p++) for (let t = 1; t <= 5; t++) {
        const tiers = [0, 0, 0]; tiers[p] = t;
        expect(keys.has(spriteKey('tower', id, tiers)), `${id} ${p}${t}`).toBe(true);
      }
    }
  });
  it('every hero resolves', () => {
    const heroes = heroesJson.data as { name: string }[];
    expect(heroes).toHaveLength(18);
    for (const h of heroes) expect(keys.has(spriteKey('hero', slug(h.name))), h.name).toBe(true);
  });
  it('every bloon and overlay resolves', () => {
    for (const id of Object.keys(bloonsJson.data.bloons)) expect(keys.has(spriteKey('bloon', id)), id).toBe(true);
    for (const o of ['camo', 'regrow', 'fortified']) expect(keys.has(spriteKey('overlay', o))).toBe(true);
  });
  it('keys are unique and every draw function runs', () => {
    const items = manifest();
    expect(new Set(items.map(i => i.key)).size).toBe(items.length);
    for (const i of items) i.draw(stub());
  });
});
