import { test, expect } from 'vitest';
import { Sim, ROUNDS, BLOONS } from './sim';
import rounds from '../data/wiki/rounds.json';

test('dart monkey pops early waves', () => {
  const s = new Sim([{ x: 0, y: 100 }, { x: 800, y: 100 }]);
  expect(s.addTower(400, 110)).toBe(true);
  s.startRound([{ type: 'red', n: 10, gap: 1.5 }]);
  for (let i = 0; i < 60 * 60; i++) s.step();
  expect(s.bloons.length).toBe(0); expect(s.lives).toBe(150);
});
test('every round group has a known bloon type', () => {
  for (const r of ROUNDS) for (const g of r.groups) expect(BLOONS[g.type], g.type).toBeDefined();
});
test('round RBE (base) matches table for rounds 1-80', () => {
  ROUNDS.slice(0, 80).forEach((r, i) => {
    const sum = r.groups.reduce((a, g) => a + g.count * BLOONS[g.type].rbe, 0); // ignores fortified
    const row: any = rounds.data.rounds[i];
    if (!r.groups.some(g => g.fortified)) expect(sum, `round ${i + 1}`).toBe(row.rbe_base);
  });
});

test('all fifteen Dart upgrades can be purchased and fire', () => {
  for (let path = 0; path < 3; path++) for (let tier = 1; tier <= 5; tier++) {
    const s = new Sim([{ x: 0, y: 100 }, { x: 1000, y: 100 }]);
    s.cash = 1000000; s.addTower(100, 110);
    for (let n = 0; n < tier; n++) expect(s.upgrade(0, path)).toBe(true);
    s.bloons.push({ id: 999, type: 'moab', dist: 120, hp: 200 });
    s.step();
    expect(s.darts.length, `path ${path}, tier ${tier}`).toBeGreaterThan(0);
  }
});

test('crosspaths allow 5/2/0 and reject third paths and two tier threes', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.cash = 1000000; s.addTower(100, 10);
  for (let n = 0; n < 5; n++) expect(s.upgrade(0, 0)).toBe(true);
  expect(s.upgrade(0, 0)).toBe(false);
  expect(s.upgrade(0, 1)).toBe(true); expect(s.upgrade(0, 1)).toBe(true);
  const cash = s.cash;
  expect(s.upgrade(0, 1)).toBe(false); expect(s.upgrade(0, 2)).toBe(false);
  expect(s.cash).toBe(cash);
});

test('selling refunds seventy percent of all actual spending once', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.addTower(100, 10); s.upgrade(0, 0);
  const cash = s.cash;
  expect(s.sell(0)).toBe(true); expect(s.cash - cash).toBe(238);
  expect(s.sell(0)).toBe(false);
});

test('round completion pays 100 plus round once and prevents overlapping rounds', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  expect(s.startRound([{ type: 'red', n: 1, gap: 1 }])).toBe(true);
  expect(s.startRound([])).toBe(false);
  for (let i = 0; i < 10; i++) s.step();
  expect(s.cash).toBe(751); expect(s.roundActive).toBe(false); expect(s.round).toBe(1);
});

test('difficulty costs round upward to five and modes set lives', () => {
  for (const [mode, cost, lives] of [['easy', 170, 200], ['medium', 200, 150], ['hard', 220, 100], ['impoppable', 240, 1]] as const) {
    const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }], mode);
    expect(s.lives).toBe(lives); expect(s.cash).toBe(650);
    expect(s.price(200)).toBe(cost); expect(s.price(90)).toBe(mode === 'easy' ? 80 : mode === 'hard' ? 100 : mode === 'impoppable' ? 110 : 90);
    s.addTower(100, 10); expect(s.cash).toBe(650 - cost);
  }
});

test('Very Quick Shots replaces the first speed multiplier, including crosspaths', async () => {
  const { dartStats } = await import('./towers/dart');
  expect(dartStats([0, 2, 0]).cooldown).toBeCloseTo(0.95 * 2 / 3);
  expect(dartStats([3, 2, 0]).cooldown).toBeCloseTo(1.15 * 2 / 3);
});

test('multi damage carries through layers and awards one dollar per layer', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.cash = 10000; s.addTower(100, 10);
  for (let i = 0; i < 3; i++) s.upgrade(0, 2);
  s.bloons.push({ id: 999, type: 'green', dist: 100, hp: 1 });
  const cash = s.cash;
  for (let i = 0; i < 5; i++) s.step();
  expect(s.bloons).toHaveLength(0); expect(s.cash - cash).toBe(3);
});

test('ceramic shell takes ten damage before spawning children', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.addTower(100, 10);
  s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 10 });
  for (let i = 0; i < 5; i++) s.step();
  expect(s.bloons[0].hp).toBe(9); expect(s.cash).toBe(450);
});

test('camo and sharp immunity protect bloons until appropriate upgrades', () => {
  for (const [type, camo, path, tier] of [['red', true, 2, 2], ['lead', false, 0, 4], ['ddt', true, 2, 5]] as const) {
    const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    s.cash = 100000; s.addTower(100, 10);
    s.bloons.push({ id: 999, type, dist: 100, hp: BLOONS[type].hp, camo });
    for (let i = 0; i < 5; i++) s.step();
    expect(s.bloons[0].hp).toBe(BLOONS[type].hp);
    for (let i = 0; i < tier; i++) s.upgrade(0, path);
    s.towers[0].cd = 0;
    for (let i = 0; i < 5; i++) s.step();
    expect(s.bloons.some(b => b.id === 999 && b.hp === BLOONS[type].hp)).toBe(false);
  }
});

test('tax applies at round boundaries only to pops', async () => {
  const { popCashMultiplier } = await import('./sim');
  for (const [round, factor] of [[50, 1], [51, 0.5], [61, 0.2], [86, 0.1], [101, 0.05], [121, 0.04], [141, 0.02]]) expect(popCashMultiplier(round)).toBe(factor);
});

test('leaking all lives ends the game and freezes simulation without a bonus', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1, y: 0 }], 'impoppable');
  s.startRound([{ type: 'red', n: 1, gap: 1 }]);
  for (let i = 0; i < 10; i++) s.step();
  expect(s.lives).toBe(0); expect(s.gameOver).toBe(true); expect(s.cash).toBe(650);
  const tick = s.tick; s.step(); expect(s.tick).toBe(tick);
  expect(s.startRound()).toBe(false); expect(s.addTower(100, 100)).toBe(false);
});

test('targeting modes select by path progress, distance, and strength', () => {
  for (const [mode, expected] of [['First', 1], ['Last', 3], ['Close', 2], ['Strong', 3]] as const) {
    const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    s.addTower(100, 50); s.towers[0].range = 100; s.towers[0].targeting = mode;
    s.bloons.push({ id: 1, type: 'red', dist: 120, hp: 1 }, { id: 2, type: 'red', dist: 100, hp: 1 }, { id: 3, type: 'moab', dist: 80, hp: 200 });
    s.step();
    const target = s.bloons.find(b => b.id === expected)!;
    const p = s.posAt(target.dist), d = s.darts[0];
    expect(Math.atan2(d.vy, d.vx)).toBeCloseTo(Math.atan2(p.y - 50, p.x - 100));
  }
});

test('upgrades deduct difficulty adjusted prices and reject unaffordable purchases', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }], 'hard');
  s.addTower(100, 10);
  expect(s.upgrade(0, 0)).toBe(true); expect(s.cash).toBe(275); // 650 - 220 - 155
  expect(s.upgrade(0, 0)).toBe(true); expect(s.cash).toBe(55);
  expect(s.upgrade(0, 0)).toBe(false); expect(s.cash).toBe(55);
  expect(s.towers[0].tiers).toEqual([2, 0, 0]);
});

test('base darts pierce two separate bloons', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.addTower(100, 20);
  s.bloons.push({ id: 998, type: 'red', dist: 100, hp: 1 }, { id: 999, type: 'red', dist: 100, hp: 1 });
  for (let i = 0; i < 5; i++) s.step();
  expect(s.bloons).toHaveLength(0); expect(s.cash).toBe(452);
});

test('spawn flags preserve camo and fortified HP without fortifying normal children', () => {
  const s = new Sim([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  s.startRound([{ type: 'lead', n: 1, gap: 1, camo: true, fortified: true }]);
  s.step(); expect(s.bloons[0]).toMatchObject({ hp: 4, camo: true, fortified: true });
  s.cash = 100000; s.addTower(0, 10);
  for (let i = 0; i < 5; i++) s.upgrade(0, 2);
  for (let i = 0; i < 5; i++) s.step();
  expect(s.bloons.every(b => !b.fortified && b.camo)).toBe(true);
});
