import { expect, test } from 'vitest';
import { Sim } from './sim';
import { TOWERS, type TowerKind } from './towers';
const military = ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'] as TowerKind[];
const water = [{ x: 60, y: 160, width: 200, height: 120 }];
for (const type of military) for (let path = 0; path < 3; path++) for (let tier = 1; tier <= 5; tier++) {
  test(`${type} ${path + 1}/${tier} purchases and damages a headless target`, () => {
    const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }], 'medium', water);
    s.cash = 1e7;
    expect(s.placeTower(100, type === 'sub' || type === 'buccaneer' ? 185 : 115, type)).toBe(true);
    for (let n = 0; n < tier; n++) expect(s.upgrade(0, path)).toBe(true);
    s.setTarget(0, { x: 110, y: 150 });
    const b = { id: 999, type: 'moab', dist: 110, hp: 1e6, stunnedUntil: 10000 };
    s.bloons.push(b);
    for (let n = 0; n < 1800; n++) s.step();
    expect(b.hp).toBeLessThan(1e6);
    expect(TOWERS[type].paths[path]).toHaveLength(5);
  });
}
test('placement requires the entire water footprint and keeps land towers out', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }], 'medium', water);
  s.cash = 1e6;
  expect(s.canPlace(100, 200, 'sub')).toBe(true);
  expect(s.canPlace(100, 200, 'buccaneer')).toBe(true);
  expect(s.canPlace(61, 200, 'sub')).toBe(false);
  expect(s.canPlace(100, 100, 'sub')).toBe(false);
  expect(s.canPlace(100, 200, 'dart')).toBe(false);
  expect(s.canPlace(59, 200, 'dart')).toBe(false);
});
test('mortar targets stay fixed and heli moves toward the chosen point', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }]); s.cash = 1e6;
  s.placeTower(100, 100, 'mortar'); s.placeTower(300, 100, 'heli');
  expect(s.setTarget(0, { x: 500, y: 200 })).toBe(true);
  expect(s.setTarget(1, { x: 500, y: 200 })).toBe(true);
  expect(s.setTarget(1, { x: NaN, y: 200 })).toBe(false);
  for (let n = 0; n < 60; n++) s.step();
  expect(s.towers[0].targetPoint).toEqual({ x: 500, y: 200 });
  expect(s.towers[0].x).toBe(100);
  expect(s.towers[1].flight.x).toBeGreaterThan(300);
  expect(s.towers[1].x).toBe(300);
});

function abilitySim(type: 'heli' | 'dartling', tier: number) {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }]); s.cash = 1e7;
  s.placeTower(100, 100, type);
  for (let n = 0; n < tier; n++) s.upgrade(0, 1);
  return s;
}
test('Support Chinook Reposition and Supply Crate move towers and grant supplies', () => {
  const s = abilitySim('heli', 4); s.placeTower(300, 100, 'dart');
  s.tick = s.towers[0].abilityReady;
  expect(s.relocate(0, 1, { x: 400, y: 100 })).toBe(true);
  expect(s.towers[1].x).toBe(400);
  expect(s.relocate(0, 1, { x: 500, y: 100 })).toBe(false);
  const cash = s.cash, lives = s.lives;
  expect(s.activate(0)).toBe(true);
  expect(s.cash - cash).toBe(1800); expect(s.lives - lives).toBe(10);
  expect(s.activate(0)).toBe(false);
});
test('Special Poperations deploys a temporary Monkey Marine', () => {
  const s = abilitySim('heli', 5); s.setTarget(0, { x: 500, y: 60 });
  s.tick = s.towers[0].abilityReady;
  const cash = s.cash, lives = s.lives;
  expect(s.activate(0)).toBe(true);
  expect(s.cash - cash).toBe(4500); expect(s.lives - lives).toBe(25);
  expect(s.sentries).toHaveLength(1);
  expect(s.sentries[0]).toMatchObject({ x: 500, y: 60, until: s.tick + 1800,
    stats: { damage: 6, pierce: 20, range: 50, camo: true, damageType: 'normal' } });
  const target = { id: 999, type: 'ddt', dist: 500, hp: 10000, stunnedUntil: s.tick + 2000 };
  s.bloons.push(target); s.step(); expect(target.hp).toBe(9994);
  s.tick += 1800; s.step(); expect(s.sentries).toHaveLength(0);
});
for (const tier of [4, 5]) test(`${tier === 5 ? 'M.A.D Rocket Storm launches enhanced' : 'Rocket Storm launches timed'} missile waves`, () => {
  const s = abilitySim('dartling', tier), t = s.towers[0];
  expect(s.activate(0)).toBe(false); s.tick = t.abilityReady;
  t.cd = 1e6;
  s.bloons.push({ id: 999, type: 'zomg', dist: 200, hp: 1e7, stunnedUntil: s.tick + 10000 });
  expect(s.activate(0)).toBe(true); expect(s.activate(0)).toBe(false);
  s.step();
  expect(s.darts).toHaveLength(10);
  expect(s.darts[0]).toMatchObject({ damage: 5, pierce: tier === 5 ? 18 : 8,
    moabBonus: tier === 5 ? 250 : 0, ceramicBonus: tier === 5 ? 5 : 1 });
  for (let n = 0; n < 480; n++) s.step();
  expect(s.bloons[0].hp).toBeLessThan(1e7 - (tier === 5 ? 200 : 0));
  expect(t.abilityNext).toBe(t.abilityUntil);
});
test('relocation rejects invalid placements and heavy towers without consuming readiness', () => {
  const s = abilitySim('heli', 4); s.placeTower(300, 100, 'dart');
  expect(s.relocate(0, 1, { x: 400, y: 100 })).toBe(false);
  s.tick = 900;
  for (const point of [{ x: NaN, y: 100 }, { x: 400, y: 20 }, { x: 100, y: 100 }])
    expect(s.relocate(0, 1, point)).toBe(false);
  expect(s.relocate(0, 0, { x: 400, y: 100 })).toBe(false);
  expect(s.relocate(0, 1, { x: 300, y: 100 })).toBe(true); // ignores its own footprint
  s.lives = 0; expect(s.relocate(0, 1, { x: 400, y: 100 })).toBe(false);
});
for (const tier of [4, 5]) test(`heli ${tier} crate respects income multiplier and game over`, () => {
  const s = abilitySim('heli', tier); s.rules.incomeMult = 0.25;
  s.tick = s.towers[0].abilityReady;
  const cash = s.cash;
  expect(s.activate(0)).toBe(true);
  expect(s.cash - cash).toBe((tier === 5 ? 4500 : 1800) * 0.25);
  s.tick += 1500;
  if (tier === 5) { const cash = s.cash; expect(s.activate(0)).toBe(true); expect(s.cash).toBe(cash); }
  s.lives = 0; s.tick += 10000;
  expect(s.activate(0)).toBe(false);
});
test('Rocket Storm emits exactly fifteen waves and stops after expiration', () => {
  const s = abilitySim('dartling', 4), t = s.towers[0];
  s.tick = t.abilityReady; t.cd = 1e6;
  s.bloons.push({ id: 999, type: 'moab', dist: 800, hp: 1e7, stunnedUntil: s.tick + 10000 });
  s.activate(0); let missiles = 0;
  for (let n = 0; n < 500; n++) { s.step(); missiles += s.darts.length; s.darts = []; }
  expect(missiles).toBe(150);
  s.lives = 0; s.tick = t.abilityReady;
  expect(s.activate(0)).toBe(false);
});
test('supply drop adds cash and enforces its cooldown', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }]); s.cash = 1e6;
  s.placeTower(100, 100, 'sniper'); for (let n = 0; n < 4; n++) s.upgrade(0, 1);
  const cash = s.cash;
  expect(s.activate(0)).toBe(true); expect(s.cash - cash).toBe(1100);
  expect(s.activate(0)).toBe(false);
  for (let n = 0; n < 5400; n++) s.step();
  expect(s.activate(0)).toBe(true);
});
test('first strike waits for initial cooldown, then damages the strongest camo bloon', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }], 'medium', water); s.cash = 1e6;
  s.placeTower(100, 200, 'sub'); for (let n = 0; n < 4; n++) s.upgrade(0, 1);
  expect(s.activate(0)).toBe(false);
  s.tick = 1200;
  const b = { id: 999, type: 'zomg', dist: 500, hp: 100000, camo: true };
  s.bloons.push(b);
  expect(s.activate(0)).toBe(true); expect(b.hp).toBe(89650);
  expect(s.activate(0)).toBe(false);
});
test('Tsar Bomba damages and stuns camo survivors across the map', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }]); s.cash = 1e6;
  s.placeTower(100, 100, 'ace'); for (let n = 0; n < 5; n++) s.upgrade(0, 1);
  const b = { id: 999, type: 'zomg', dist: 800, hp: 100000, camo: true, stunnedUntil: 0 };
  s.bloons.push(b); s.tick = s.towers[0].abilityReady;
  expect(s.activate(0)).toBe(true); expect(b.hp).toBe(94000); expect(b.stunnedUntil).toBe(s.tick + 480);
});
test('Pop and Awe also affects bloons arriving during its duration', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }]); s.cash = 1e6;
  s.placeTower(100, 100, 'mortar'); for (let n = 0; n < 5; n++) s.upgrade(0, 1);
  s.activate(0); s.step();
  const b = { id: 999, type: 'moab', dist: 800, hp: 1000, camo: true, stunnedUntil: 0 };
  s.bloons.push(b); for (let n = 0; n < 60; n++) s.step();
  expect(b.hp).toBe(980); expect(b.stunnedUntil).toBeGreaterThan(s.tick);
});
test('Pirate Lord hooks ZOMGs but never BADs', () => {
  const s = new Sim([{ x: 0, y: 20 }, { x: 960, y: 20 }], 'medium', water); s.cash = 1e6;
  s.placeTower(100, 200, 'buccaneer'); for (let n = 0; n < 5; n++) s.upgrade(0, 1);
  s.bloons.push({ id: 998, type: 'zomg', dist: 500, hp: 4000 }, { id: 999, type: 'bad', dist: 500, hp: 20000 });
  expect(s.activate(0)).toBe(true); expect(s.bloons.map(b => b.type)).toEqual(['bad']);
});

test('military costs and upgrade names match the local wiki', async () => {
  // Data is a test oracle only; simulation tables remain hand-coded.
  const files = import.meta.glob('../data/wiki/towers/*.json', { eager: true, import: 'default' }) as Record<string, { data: { costMedium: number; paths: Record<string, { name: string; cost: number }[]> } }>;
  for (const type of military) {
    const wiki = files[`../data/wiki/towers/${type}.json`].data;
    expect(TOWERS[type].cost).toBe(wiki.costMedium);
    TOWERS[type].paths.forEach((path, i) => path.forEach((tier, n) => {
      const expected = wiki.paths[String(i + 1)][n];
      expect({ name: tier.name, cost: tier.cost }).toEqual({ name: expected.name, cost: expected.cost });
    }));
  }
});
test('default pond supports water placements and lies off the track', async () => {
  const { DEFAULT_MAP } = await import('./map');
  const s = new Sim(DEFAULT_MAP.path, 'medium', DEFAULT_MAP.water);
  const w = DEFAULT_MAP.water[0], x = w.x + w.width / 2, y = w.y + w.height / 2;
  expect(s.canPlace(x, y, 'sub')).toBe(true);
  expect(s.canPlace(x, y, 'buccaneer')).toBe(true);
  expect(s.canPlace(x, y, 'heli')).toBe(false);
});
test('military simulation is reproducible including scatter and flight', () => {
  function run() {
    const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }]); s.cash = 1e6;
    s.placeTower(100, 110, 'mortar'); s.setTarget(0, { x: 110, y: 150 });
    s.placeTower(300, 100, 'ace');
    s.startRound([{ type: 'ceramic', n: 10, gap: 0.5 }]);
    for (let n = 0; n < 600; n++) s.step();
    return JSON.stringify({ towers: s.towers, bloons: s.bloons, cash: s.cash, lives: s.lives });
  }
  expect(run()).toBe(run());
});
test('manual aim hits only the chosen mortar point', () => {
  const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }]); s.cash = 1e6;
  s.placeTower(100, 110, 'mortar');
  s.setTarget(0, { x: 800, y: 150 });
  const near = { id: 998, type: 'moab', dist: 100, hp: 1000, stunnedUntil: 1000 };
  const aimed = { id: 999, type: 'moab', dist: 800, hp: 1000, stunnedUntil: 1000 };
  s.bloons.push(near, aimed); s.step();
  expect(near.hp).toBe(1000); expect(aimed.hp).toBe(998);
});
test('camo detection is granted by the specified military tiers', () => {
  const detecting = { sniper: [1, 1], sub: [0, 3], buccaneer: [2, 2], ace: [1, 2], heli: [1, 2], mortar: [2, 1], dartling: [1, 1] } as const;
  for (const type of military) {
    const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }]); s.cash = 1e6;
    s.addTower(100, 110, type);
    const [path, count] = detecting[type as keyof typeof detecting];
    for (let n = 0; n < count; n++) s.upgrade(0, path);
    if (type === 'sub') expect(s.towers[0].strip).toBe(true);
    else expect(s.towers[0].camo).toBe(true);
  }
});
