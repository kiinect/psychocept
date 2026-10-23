import { TOWER_W } from './scene';
import { describe, expect, it } from 'vitest';
import { ALL_KEYS } from '../art';
import { HEROES, type HeroKind } from '../heroes';
import { DEFAULT_STATS, type AttackKind } from '../towers/types';
import { TOWERS, type TowerKind } from '../towers';
import { Sim } from '../sim';
import { SceneAdapter, type Visual } from './scene';

function harness() {
  let created = 0;
  const visuals: Visual[] = [];
  const scene = new SceneAdapter(() => {
    created++;
    const v = { x: 0, y: 0, rotation: 0, alpha: 1, visible: false, tint: 0xffffff,
      width: 1, height: 1, texture: '', text: '', scale: { set() {} } };
    visuals.push(v); return v;
  }, key => key);
  return { scene, visuals, created: () => created };
}
const sim = () => new Sim([{ x: 0, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }]);

describe('sprite scene', () => {
  it('keeps 1000 bloons bounded and creates nothing after warmup, including churn', () => {
    const h = harness(), s = sim();
    s.bloons = Array.from({ length: 1000 }, (_, id) => ({ id, type: 'moab', hp: 200, dist: id % 800, camo: true, fortified: true, regrow: true }));
    h.scene.update(s, 1 / 60);
    const warm = h.created();
    const start = performance.now();
    for (let frame = 0; frame < 600; frame++) {
      for (const b of s.bloons) { b.dist = (b.dist + 1) % 800; b.id += 1000; }
      h.scene.update(s, 1 / 60);
    }
    const msPerFrame = (performance.now() - start) / 600;
    expect(msPerFrame).toBeLessThan(1000 / 60);
    expect(h.created()).toBe(warm);
    s.bloons.length = 0; h.scene.update(s, 0);
    expect(h.visuals.filter(v => v.visible)).toHaveLength(0);
    expect(warm).toBeLessThanOrEqual(4003);
    console.info(`1000-bloon adapter: ${msPerFrame.toFixed(2)} ms/frame`);
  });

  it('uses path direction, overlays, and HP damage tint, resetting reused sprites', () => {
    const h = harness(), s = sim();
    s.bloons.push({ id: 1, type: 'moab', hp: 50, dist: 600, camo: true, fortified: true, regrow: true });
    h.scene.update(s, 0);
    const b = h.visuals.find(v => v.texture === 'bloon/moab')!;
    expect(b.rotation).toBeCloseTo(Math.PI / 2);
    expect(b.tint).not.toBe(0xffffff);
    expect(h.visuals.filter(v => v.visible && String(v.texture).startsWith('overlay/'))).toHaveLength(3);
    s.bloons[0] = { id: 2, type: 'red', hp: 1, dist: 0 };
    h.scene.update(s, 0);
    expect(b.texture).toBe('bloon/red'); expect(b.tint).toBe(0xffffff);
    expect(b.rotation).toBe(0);
    expect(h.visuals.filter(v => v.visible && String(v.texture).startsWith('overlay/'))).toHaveLength(0);
  });

  it('uses tower tiers and sim aim, punches only on a shot, and reuses sprites on reset', () => {
    const h = harness(), s = sim(); s.cash = 10000; s.placeTower(200, 250, 'dart');
    const tower = s.towers[0]; tower.tiers = [0, 2, 3]; tower.aimAngle = 1;
    h.scene.update(s, 0);
    const v = h.visuals.find(v => v.texture === 'tower/dart/p3t3')!;
    expect(v.rotation).toBe(1); expect(v.width).toBe(TOWER_W);
    tower.shots++; h.scene.update(s, 0);
    expect(v.width).toBeLessThan(TOWER_W);
    h.scene.update(s, 0.2); expect(v.width).toBe(TOWER_W);
    const warm = h.created(); h.scene.reset(); h.scene.update(s, 0);
    expect(h.created()).toBe(warm);
  });

  it('faces a detectable nearby target when the sim does not update aimAngle', () => {
    const h = harness(), s = sim(); s.cash = 10000; s.placeTower(200, 250, 'dart');
    s.bloons.push({ id: 1, type: 'red', hp: 1, dist: 200, camo: true });
    s.towers[0].range = 200;
    h.scene.update(s, 0);
    const v = h.visuals.find(v => v.texture === 'tower/dart')!;
    expect(v.rotation).toBe(-Math.PI / 2);
    s.bloons[0].camo = false; s.bloons[0].dist = 250;
    h.scene.update(s, 0);
    expect(v.rotation).toBeCloseTo(Math.atan2(-150, 50));
  });

  it('resolves every tower, hero, projectile and placement texture from the actual atlas', () => {
    const keys = new Set(ALL_KEYS()), s = sim();
    const adapter = new SceneAdapter(() => {
      return { x: 0, y: 0, rotation: 0, alpha: 1, visible: false, tint: 0xffffff, width: 1, height: 1, texture: '' };
    }, key => { expect(keys.has(key), key).toBe(true); return key; });
    s.cash = 1e9;
    for (const kind of Object.keys(TOWERS) as TowerKind[]) {
      s.towers.length = 0; expect(s.placeTower(200, 250, 'dart')).toBe(true);
      s.towers[0].type = kind;
      for (let path = 0; path < 3; path++) for (let tier = 0; tier <= 5; tier++) {
        s.towers[0].tiers = [0, 0, 0]; s.towers[0].tiers[path] = tier;
        adapter.update(s, 0);
      }
      adapter.placement('tower', kind, { x: 200, y: 250 }, 40, true);
      s.darts = (['projectile', 'bomb', 'boomerang', 'tack', 'ice', 'glue', 'ring'] as AttackKind[]).map(attack => ({
        ...DEFAULT_STATS, kind: attack, x: 200, y: 250, vx: 1, vy: 0, life: 1, owner: s.towers[0], hit: new Set<number>(),
      }));
      s.effects = ['bomb', 'ice', 'glue'].map(kind => ({ kind, x: 200, y: 250, radius: 20, life: 0.2 }));
      adapter.update(s, 0);
    }
    s.towers.length = 0;
    for (const kind of Object.keys(HEROES) as HeroKind[]) {
      const other = sim(); other.cash = 1e9;
      // Place at a universally valid dry point; water-only heroes use a water rectangle.
      other.water = [{ x: 100, y: 200, width: 300, height: 200 }];
      const water = HEROES[kind].waterOnly;
      expect(other.placeHero(water ? 200 : 700, 250, kind)).toBe(true);
      adapter.update(other, 0);
      adapter.placement('hero', kind, { x: 200, y: 250 }, 40, false);
    }

  });

  it('returns projectile slots to the pool and reuses them without retaining old rotations', () => {
    const h = harness(), s = sim();
    const dart = { ...DEFAULT_STATS, x: 12, y: 34, vx: 0, vy: 1, life: 1, hit: new Set<number>() };
    s.darts.push(dart); h.scene.update(s, 0);
    const v = h.visuals.find(v => v.texture === 'proj/dart')!;
    expect(v.rotation).toBe(Math.PI / 2); expect(v.x).toBe(12);
    const warm = h.created(); s.darts.length = 0; h.scene.update(s, 0); expect(v.visible).toBe(false);
    dart.vx = 1; dart.vy = 0; s.darts.push(dart); h.scene.update(s, 0);
    expect(v.rotation).toBe(0); expect(v.visible).toBe(true); expect(h.created()).toBe(warm);
  });

  it('bounds pop and number pools during mass pops and reuses them after warmup', () => {
    const h = harness(), s = sim();
    const wave = () => {
      s.bloons = Array.from({ length: 1000 }, (_, id) => ({ id, type: 'red', hp: 1, dist: id % 800 }));
      h.scene.update(s, 0);
      for (const b of s.bloons) b.hp = 0;
      s.bloons.length = 0; s.cash += 1000; h.scene.update(s, 0);
    };
    wave(); const warm = h.created();
    for (let i = 0; i < 10; i++) { h.scene.update(s, 1); wave(); }
    expect(h.created()).toBe(warm);
    expect(warm).toBe(4003 + 256 + 64);
    expect(h.visuals.filter(v => v.visible && String(v.texture).startsWith('fx/'))).toHaveLength(256);
    h.scene.reset(); expect(h.visuals.some(v => v.visible)).toBe(false);
  });

  it('plays eight pop steps from atlas frames and expires pooled cash text', () => {
    const h = harness(), s = sim();
    s.bloons.push({ id: 1, type: 'red', hp: 1, dist: 20 }); h.scene.update(s, 0);
    s.bloons[0].hp = 0; s.bloons.length = 0; s.cash += 1;
    h.scene.update(s, 0);
    const pop = h.visuals.find(v => v.visible && v.texture === 'fx/pop/0')!;
    expect(pop).toBeDefined();
    for (let i = 1; i < 8; i++) { h.scene.update(s, 1 / 30); expect(pop.visible).toBe(true); }
    h.scene.update(s, 1 / 30); expect(pop.visible).toBe(false);
    expect(h.visuals.some(v => v.visible && v.text === '+1')).toBe(true);
    h.scene.update(s, 1); expect(h.visuals.some(v => v.visible && v.text === '+1')).toBe(false);
  });
});
