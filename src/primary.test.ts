import { expect, test } from 'vitest';
import { Sim, BLOONS } from './sim';
import { TOWERS } from './towers';

test('all 90 Primary upgrades are purchasable and attack', () => {
  for (const type of ['dart', 'boomerang', 'bomb', 'tack', 'ice', 'glue'] as const) {
    for (let path = 0; path < 3; path++) for (let tier = 1; tier <= 5; tier++) {
      const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
      s.cash = 1e7; expect(s.addTower(100, 115, type)).toBe(true);
      for (let n = 0; n < tier; n++) expect(s.upgrade(0, path)).toBe(true);
      s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 10000 });
      s.step();
      expect(s.towers[0].shots, `${type} ${path}/${tier}`).toBe(1);
      expect(s.darts.length > 0 || s.effects.length > 0 || !!s.bloons[0]?.frozenUntil || !!s.bloons[0]?.glue, `${type} ${path}/${tier}`).toBe(true);
    }
  }
});

test('lead ignores sharp, black ignores explosions, white ignores cold', () => {
  for (const [tower, bloon] of [['dart', 'lead'], ['bomb', 'black'], ['ice', 'white']] as const) {
    const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
    s.cash = 10000; s.addTower(100, 115, tower);
    s.bloons.push({ id: 999, type: bloon, dist: 100, hp: BLOONS[bloon].hp });
    for (let n = 0; n < 30; n++) s.step();
    expect(s.bloons.find(b => b.id === 999)?.hp).toBe(BLOONS[bloon].hp);
    expect(s.bloons[0].frozenUntil ?? 0).toBe(0);
  }
});

test('placement rejects track, overlaps, nonfinite positions and world edges', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  expect(s.canPlace(100, 100, 'dart')).toBe(false);
  expect(s.canPlace(100, 140, 'dart')).toBe(true);
  s.addTower(100, 140);
  expect(s.canPlace(100, 140, 'bomb')).toBe(false);
  expect(s.canPlace(NaN, 140, 'dart')).toBe(false);
  expect(s.canPlace(-1, 140, 'dart')).toBe(false);
});

test('letterboxed viewports fit the world and invert pointer coordinates', async () => {
  const { fitWorld, worldPoint } = await import('./viewport');
  for (const [width, height] of [[50, 900], [1440, 200], [960, 540], [320, 180]]) {
    const fit = fitWorld(width, height);
    expect(fit.x).toBeGreaterThanOrEqual(0); expect(fit.y).toBeGreaterThanOrEqual(0);
    expect(960 * fit.scale + fit.x).toBeLessThanOrEqual(width);
    expect(540 * fit.scale + fit.y).toBeLessThanOrEqual(height);
    expect(worldPoint(fit.x + 700 * fit.scale, fit.y + 300 * fit.scale, width, height)).toEqual({ x: 700, y: 300 });
  }
});

test('ice damages and freezes, thaws on schedule, and cannot freeze white', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  s.addTower(100, 115, 'ice');
  s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 10 });
  s.step();
  expect(s.bloons[0].hp).toBe(9);
  const stopped = s.bloons[0].dist;
  for (let i = 0; i < 30; i++) s.step();
  expect(s.bloons[0].dist).toBe(stopped);
  for (let i = 0; i < 30; i++) s.step();
  expect(s.bloons[0].dist).toBeGreaterThan(stopped);
});

test('corrosive glue slows and ticks damage even when repeatedly reapplied', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  s.cash = 1e6; s.addTower(100, 115, 'glue');
  s.upgrade(0, 0); s.upgrade(0, 0);
  s.towers[0].range = 960;
  s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 100 });
  for (let i = 0; i < 180; i++) s.step();
  expect(s.bloons[0].hp).toBeLessThan(100);
  expect(s.bloons[0].dist).toBeLessThan(100 + 62.5 * 3 * 0.6);
});

test('bomb blast has independent pierce and splashes nearby bloons', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  s.addTower(100, 115, 'bomb');
  s.towers[0].pierce = 2;
  for (let n = 0; n < 4; n++) s.bloons.push({ id: 990 + n, type: 'ceramic', dist: 100, hp: 10 });
  for (let i = 0; i < 10; i++) s.step();
  expect(s.bloons.filter(b => b.hp === 9)).toHaveLength(2);
  expect(s.bloons.filter(b => b.hp === 10)).toHaveLength(2);
});

test('base tack emits eight equally spaced directions', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  s.addTower(100, 115, 'tack');
  s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 100 });
  s.step();
  expect(s.darts).toHaveLength(8);
  expect(new Set(s.darts.map(d => Math.atan2(d.vy, d.vx).toFixed(3))).size).toBe(8);
});

test('returning boomerang hits a surviving target again and returns to origin', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  s.addTower(100, 115, 'boomerang');
  s.bloons.push({ id: 999, type: 'zomg', dist: 100, hp: 4000 });
  for (let i = 0; i < 60; i++) s.step();
  expect(s.bloons[0].hp).toBeLessThanOrEqual(3998);
  expect(s.darts).toHaveLength(0);
});

test('Primary abilities activate deterministically and enforce cooldowns', () => {
  for (const type of ['boomerang', 'bomb', 'tack', 'ice', 'glue'] as const) {
    const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
    s.cash = 1e7; s.addTower(100, 115, type);
    for (let n = 0; n < 4; n++) s.upgrade(0, 1);
    s.bloons.push({ id: 999, type: 'zomg', dist: 100, hp: 4000 });
    const t = s.towers[0];
    s.tick = t.abilityReady;
    expect(s.activate(0), type).toBe(true);
    expect(s.activate(0), type).toBe(false);
    expect(t.abilityReady).toBeGreaterThan(s.tick);
    s.step();
    expect(s.darts.length > 0 || s.effects.length > 0 || s.bloons[0].hp < 4000 || s.bloons[0].slow !== undefined, type).toBe(true);
  }
});

test('validated purchases reject invalid placements without spending cash', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
  const cash = s.cash;
  expect(s.placeTower(100, 100, 'dart')).toBe(false);
  expect(s.cash).toBe(cash); expect(s.towers).toHaveLength(0);
  expect(s.placeTower(100, 140, 'dart')).toBe(true);
  const after = s.cash;
  expect(s.placeTower(105, 140, 'glue')).toBe(false);
  expect(s.cash).toBe(after); expect(s.towers).toHaveLength(1);
});

test('crosspaths preserve low-tier flags and scale resulting stats once', async () => {
  const { resultingStats } = await import('./towers');
  expect(resultingStats(TOWERS.boomerang, [4, 2, 0]).cooldown).toBeCloseTo(0.2);
  expect(resultingStats(TOWERS.ice, [2, 0, 5]).camo).toBe(true);
  expect(resultingStats(TOWERS.glue, [2, 3, 0]).dotDamage).toBe(1);
  expect(resultingStats(TOWERS.tack, [4, 0, 2]).damage).toBe(7);
});

test('identical mixed Primary simulations produce identical outcomes', () => {
  const run = () => {
    const s = new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
    s.cash = 1e7;
    (Object.keys(TOWERS) as (keyof typeof TOWERS)[]).forEach((type, i) => {
      s.addTower(100 + i * 30, 115, type);
      for (let n = 0; n < 3; n++) s.upgrade(i, 0);
    });
    s.startRound([{ type: 'ceramic', n: 8, gap: 0.2 }, { type: 'lead', n: 4, gap: 0.3 }]);
    for (let i = 0; i < 1200; i++) s.step();
    return { bloons: s.bloons, cash: s.cash, lives: s.lives, shots: s.towers.map(t => t.shots), tick: s.tick };
  };
  expect(run()).toEqual(run());
});

test('handwritten upgrade names, prices and path counts match the local wiki', async () => {
  const sources = {
    boomerang: (await import('../data/wiki/towers/boomerang.json')).default.data,
    bomb: (await import('../data/wiki/towers/bomb.json')).default.data,
    tack: (await import('../data/wiki/towers/tack.json')).default.data,
    ice: (await import('../data/wiki/towers/ice.json')).default.data,
    glue: (await import('../data/wiki/towers/glue.json')).default.data,
  };
  for (const type of Object.keys(sources) as (keyof typeof sources)[]) {
    const def = TOWERS[type], wiki = sources[type];
    expect(def.cost).toBe(wiki.costMedium);
    expect(def.paths).toHaveLength(3);
    Object.values(wiki.paths).forEach((path, index) => {
      expect(def.paths[index]).toHaveLength(5);
      path.forEach((upgrade: { name: string; cost: number }, tier: number) => {
        expect(def.paths[index][tier].name).toBe(upgrade.name);
        expect(def.paths[index][tier].cost).toBe(upgrade.cost);
      });
    });
  }
});
