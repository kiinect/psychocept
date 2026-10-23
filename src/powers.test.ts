import { expect, test } from 'vitest';
import { Sim, STANDARD_RULES, type Bloon } from './sim';
import { POWER_BY_ID } from './meta/powers';
import { createGame } from './modes/modes';
const path = [{ x: 0, y: 150 }, { x: 960, y: 150 }];
const water = [{ x: 60, y: 300, width: 200, height: 150 }];
const sim = () => { const s = new Sim(path, 'medium', water); s.cash = 1e6; return s; };
const bloon = (id: number, type: string, dist: number, extra: Partial<Bloon> = {}): Bloon => ({ id, type, dist, hp: type === 'moab' ? 200 : 1, ...extra });

test('every implemented power id exists in the meta table; unimplemented ones are refused', () => {
  const s = sim();
  for (const id of ['super_monkey_storm', 'monkey_boost', 'thrive', 'time_stop', 'cash_drop', 'road_spikes', 'glue_trap', 'moab_mine', 'camo_trap',
    'banana_farmer', 'banana_farmer_pro', 'pontoon', 'portable_lake', 'energizing_totem']) expect(POWER_BY_ID[id], id).toBeDefined();
  expect(s.canUsePower('tech_bot', { x: 300, y: 250 })).toBe(false);
  expect(s.powerNeedsPoint('road_spikes')).toBe(true); expect(s.powerNeedsPoint('cash_drop')).toBe(false);
  const chimps = createGame('monkey_meadow', 'chimps'); expect(chimps.canUsePower('cash_drop')).toBe(false);
});

test('Super Monkey Storm deals 4000 (5000 upgraded) to every bloon', () => {
  const s = sim(); s.bloons.push(bloon(1, 'red', 100), bloon(2, 'zomg', 400, { hp: 9000 }));
  expect(s.usePower('super_monkey_storm')).toBe(true);
  expect(s.bloons.find(b => b.id === 2)!.hp).toBe(5000); expect(s.bloons.some(b => b.id === 1)).toBe(false);
  const u = sim(); u.bloons.push(bloon(3, 'zomg', 400, { hp: 9000 })); u.usePower('super_monkey_storm', undefined, true);
  expect(u.bloons[0].hp).toBe(4000);
});

test('Monkey Boost doubles and Time Stop slows attack speed; Time Stop slows bloons', () => {
  const shots = (power?: string) => {
    const s = sim(); s.addTower(300, 120, 'dart'); if (power) s.usePower(power);
    s.bloons.push(bloon(1, 'red', 300, { hp: 1e9, stunnedUntil: 1e9 } as Partial<Bloon>));
    for (let i = 0; i < 600; i++) s.step(); return s.towers[0].shots;
  };
  const base = shots(), boost = shots('monkey_boost'), stop = shots('time_stop');
  expect(boost).toBeGreaterThan(base * 1.8); expect(stop).toBeLessThan(base * 0.7);
  const s = sim(), t = sim(); t.usePower('time_stop');
  for (const x of [s, t]) { x.bloons.push(bloon(1, 'red', 0)); for (let i = 0; i < 60; i++) x.step(); }
  expect(t.bloons[0].dist).toBeCloseTo(s.bloons[0].dist * 0.1, 1);
});

test('Thrive boosts income for this and the next round only; Cash Drop pays 2500', () => {
  const s = sim(); const c0 = s.cash; expect(s.usePower('cash_drop')).toBe(true); expect(s.cash - c0).toBe(2500);
  s.usePower('thrive'); s.round = 0; const c1 = s.cash; s.earnIncome(100); expect(s.cash - c1).toBeCloseTo(125);
  s.round = 2; const c2 = s.cash; s.earnIncome(100); expect(s.cash - c2).toBe(100);
});

test('traps: road spikes pop up to 20, glue slows non-MOABs, MOAB mine hits MOABs, camo trap strips camo; lane-aware', () => {
  const s = sim(); expect(s.canUsePower('road_spikes', { x: 300, y: 400 })).toBe(false);
  expect(s.usePower('road_spikes', { x: 300, y: 152 })).toBe(true);
  for (let i = 0; i < 25; i++) s.bloons.push(bloon(i + 1, 'red', 300));
  s.step(); expect(s.bloons.length).toBe(5); expect(s.powerTraps).toHaveLength(0);
  const g = sim(); g.usePower('glue_trap', { x: 300, y: 150 }); g.usePower('moab_mine', { x: 500, y: 150 }); g.usePower('camo_trap', { x: 700, y: 150 });
  const red = bloon(1, 'red', 300), moab = bloon(2, 'moab', 500), camo = bloon(3, 'red', 700, { camo: true }); g.bloons.push(red, moab, camo);
  g.step(); expect(red.glue?.stats.slow).toBe(0.5); expect(g.bloons).not.toContain(moab); expect(camo.camo).toBe(false);
  const two = createGame('town_center', 'medium'); const p = two.posAt(200, 1);
  two.usePower('road_spikes', p); expect(two.powerTraps[0].lane).toBe(1);
  const other = bloon(9, 'red', two.powerTraps[0].dist, { lane: 0 }); two.bloons.push(other); two.step(); expect(two.bloons).toContain(other);
});

test('pontoon hosts land towers on water, portable lake hosts water towers on land', () => {
  const s = sim();
  expect(s.canPlace(160, 375, 'dart')).toBe(false);
  expect(s.usePower('pontoon', { x: 160, y: 375 })).toBe(true); expect(s.canPlace(160, 375, 'dart')).toBe(true);
  expect(s.canPlace(500, 300, 'sub')).toBe(false);
  expect(s.canUsePower('portable_lake', { x: 500, y: 150 })).toBe(false); // on the track
  expect(s.usePower('portable_lake', { x: 500, y: 300 })).toBe(true); expect(s.canPlace(500, 300, 'sub')).toBe(true);
  expect(s.canPlace(500, 300, 'dart')).toBe(false);
});

test('Banana Farmer collects bananas in range; Energizing Totem speeds towers and expires after 5 rounds', () => {
  const s = sim(); s.addTower(400, 250, 'farm'); s.usePower('banana_farmer', { x: 600, y: 250 });
  s.collectibles.push({ x: 620, y: 260, owner: s.towers[0], value: 20, until: Infinity }); const c0 = s.cash;
  s.step(); expect(s.collectibles).toHaveLength(0); expect(s.cash - c0).toBe(20);
  const t = sim(); t.usePower('energizing_totem', { x: 300, y: 250 }); expect(t.powerUnits).toHaveLength(1);
  for (let r = 0; r < 6; r++) { t.startRound([{ type: 'red', n: 1, gap: 1 }]); t.spawnQ = []; t.bloons = []; t.step(); }
  expect(t.powerUnits).toHaveLength(0);
  void STANDARD_RULES;
});

test('storm and MOAB mine stop at the outer MOAB layer; mine re-arms after 1s and keeps upgraded damage', () => {
  const s = sim(); s.bloons.push(bloon(1, 'moab', 400)); s.usePower('super_monkey_storm');
  expect(s.bloons.filter(b => b.type === 'ceramic')).toHaveLength(4);
  expect(s.bloons.every(b => b.hp > 0 && b.hp === (b.type === 'ceramic' ? 10 : b.hp))).toBe(true);
  const m = sim(); m.usePower('moab_mine', { x: 500, y: 150 }, true);
  const zomg = bloon(2, 'zomg', 500, { hp: 20000, stunnedUntil: 1e9 } as Partial<Bloon>); m.bloons.push(zomg);
  m.step(); expect(zomg.hp).toBe(20000 - 6250);
  m.step(); expect(zomg.hp).toBe(20000 - 6250);
  for (let i = 0; i < 60; i++) m.step(); expect(zomg.hp).toBe(20000 - 12500);
});

test('upgraded glue trap glues MOABs but not BADs; Time Stop slows BADs to 30%', () => {
  const g = sim(); g.usePower('glue_trap', { x: 500, y: 150 }, true);
  const moab = bloon(1, 'moab', 500), bad = bloon(2, 'bad', 500, { hp: 20000 }); g.bloons.push(moab, bad); g.step();
  expect(moab.glue).toBeDefined(); expect(bad.glue).toBeUndefined();
  const s = sim(), t = sim(); t.usePower('time_stop');
  for (const x of [s, t]) { x.bloons.push(bloon(1, 'bad', 0, { hp: 20000 })); for (let i = 0; i < 60; i++) x.step(); }
  expect(t.bloons[0].dist).toBeCloseTo(s.bloons[0].dist * 0.3, 1);
});

test('Thrive covers the current and next round, shows a badge, and skips IMF loan principal', () => {
  const s = sim(); s.startRound([{ type: 'red', n: 1, gap: 1 }]); const r = s.round; s.usePower('thrive');
  expect(s.activePowers.map(p => p.id)).toContain('thrive');
  for (const [round, gain] of [[r, 125], [r + 1, 125], [r + 2, 100]] as const) { s.round = round; const c = s.cash; s.earnIncome(100); expect(s.cash - c).toBeCloseTo(gain); }
  s.round = r + 1; s.spawnQ = []; s.bloons = []; s.step();
  expect(s.activePowers.map(p => p.id)).not.toContain('thrive');
  const l = sim(); l.addTower(100, 250, 'farm'); for (let i = 0; i < 4; i++) l.upgrade(0, 1);
  l.startRound([{ type: 'red', n: 1, gap: 1 }]); l.usePower('thrive'); const t = l.towers[0]; l.tick = t.abilityReady; const c = l.cash;
  expect(l.activate(0)).toBe(true); expect(l.cash - c).toBe(t.debt);
});

test('Energizing Totem speeds towers in range only and lasts exactly five rounds counting the current one', () => {
  const shots = (tx: number) => {
    const s = sim(); s.addTower(tx, 120, 'dart'); expect(s.usePower('energizing_totem', { x: 300, y: 90 })).toBe(true);
    s.bloons.push(bloon(1, 'red', tx, { hp: 1e9, stunnedUntil: 1e9 } as Partial<Bloon>)); for (let i = 0; i < 600; i++) s.step(); return s.towers[0].shots;
  };
  const near = shots(300), far = shots(700); expect(near).toBeGreaterThan(far * 1.25);
  const t = sim(); t.startRound([{ type: 'red', n: 1, gap: 1 }]); t.usePower('energizing_totem', { x: 300, y: 250 });
  const finish = () => { t.spawnQ = []; t.bloons = []; t.step(); };
  finish(); for (let r = 0; r < 3; r++) { t.startRound([{ type: 'red', n: 1, gap: 1 }]); finish(); }
  expect(t.powerUnits).toHaveLength(1); // 4 rounds done
  t.startRound([{ type: 'red', n: 1, gap: 1 }]); finish(); expect(t.powerUnits).toHaveLength(0);
});

test('power units validate their own footprint: no track, blocked areas, hero overlap, or off-board pontoons', () => {
  const s = sim(); s.placeHero(400, 250, 'quincy');
  expect(s.canUsePower('energizing_totem', { x: 400, y: 252 })).toBe(false);
  expect(s.canPlaceHero(300, 250, 'quincy', true)).toBe(true); s.usePower('energizing_totem', { x: 300, y: 250 });
  expect(s.canPlaceHero(300, 250, 'quincy', true)).toBe(false);
  expect(s.canUsePower('banana_farmer', { x: 300, y: 177 })).toBe(false); // 8-radius unit touches the track buffer, a dart (6) would not
});
