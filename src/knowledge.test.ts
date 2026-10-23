import { expect, test } from 'vitest';
import { KNOWLEDGE, KNOWLEDGE_BY_NAME, SIMULATED, TREES, hasUpgrade } from './knowledge';
import { Sim } from './sim';
import { createGame } from './modes/modes';
import { TOWERS, type TowerKind } from './towers';
import * as M from './meta';

const path = [{ x: 0, y: 150 }, { x: 960, y: 150 }];
const water = [{ x: 60, y: 300, width: 200, height: 150 }];
const sim = (...mk: string[]) => { const s = new Sim(path, 'medium', water); s.cash = 1e7; s.knowledge = new Set(mk); return s; };
const tower = (s: Sim, type: TowerKind, buys: [number, number][] = [], x = 400, y = 250) => {
  s.addTower(x, y, type); const i = s.towers.length - 1;
  for (const [p, n] of buys) for (let k = 0; k < n; k++) expect(s.upgrade(i, p), `${type} path ${p}`).toBe(true);
  return s.towers[i];
};

test('knowledge data: six trees, 134 points, simulated names exist, rows gate by tree points', () => {
  expect(KNOWLEDGE).toHaveLength(134);
  expect(new Set(KNOWLEDGE.map(k => k.tree))).toEqual(new Set(TREES));
  for (const n of SIMULATED) expect(KNOWLEDGE_BY_NAME[n], n).toBeDefined();
  expect(SIMULATED.size).toBeGreaterThanOrEqual(75);
  expect(KNOWLEDGE.filter(k => k.points === 0 && k.prereq.length === 0).length).toBe(18); // row 1: three roots per tree
});

test('stat knowledge changes the right towers only', () => {
  const cases: [string, TowerKind, [number, number][], (a: any, b: any) => boolean][] = [
    ['Extra Dart Pops', 'dart', [], (a, b) => b.pierce === a.pierce + 1],
    ['Fast Tack Attacks', 'tack', [], (a, b) => b.cooldown < a.cooldown],
    ['Hard Tacks', 'tack', [], (_a, b) => b.frozen],
    ['Fast Glue', 'glue', [], (a, b) => b.cooldown < a.cooldown],
    ['Naval Upgrades', 'sub', [], (a, b) => b.pierce === a.pierce + 1],
    ['Gun Coolant', 'ace', [], (a, b) => b.cooldown < a.cooldown],
    ['Hot Magic', 'wizard', [], (_a, b) => b.frozen],
    ['One More Spike', 'spike', [], (a, b) => b.pierce === a.pierce + 1],
    ['Fraggy Frags', 'bomb', [[2, 2]], (a, b) => b.frags === a.frags + 2],
    ['Veteran Monkey Training', 'sniper', [], (a, b) => Math.abs(b.cooldown - a.cooldown * 0.97) < 1e-9],
  ];
  for (const [mk, type, buys, ok] of cases) {
    const off = sim(), on = sim(mk), a = off.effectiveStats(tower(off, type, buys)), b = on.effectiveStats(tower(on, type, buys));
    expect(ok(a, b), mk).toBe(true);
    if (type !== 'sniper') { const other = sim(mk); const d = other.effectiveStats(tower(other, 'boomerang')), e = sim().effectiveStats(tower(sim(), 'boomerang')); expect(d.pierce, `${mk} leaks`).toBe(e.pierce); }
  }
  const s = sim('Poppy Blades'); const blade = tower(s, 'tack', [[1, 3]]); expect(hasUpgrade(blade, 'Blade Shooter')).toBe(true);
});

test('price knowledge: flat cuts, first-of-type discounts, one free tower, better sell deals', () => {
  const base = sim(), cut = sim("Cheap 'Rangs");
  expect(base.shopPrice('boomerang') - cut.shopPrice('boomerang')).toBe(base.price(50));
  const conscript = sim('Military Conscription'); const first = conscript.shopPrice('sniper');
  expect(first).toBeLessThan(base.shopPrice('sniper')); tower(conscript, 'sniper'); expect(conscript.shopPrice('ace')).toBe(base.shopPrice('ace'));
  const farm = sim('Farm Subsidy'); expect(farm.shopPrice('farm')).toBe(base.price(TOWERS.farm.cost - 100)); tower(farm, 'farm'); expect(farm.shopPrice('farm')).toBe(base.shopPrice('farm'));
  const free = sim('Bonus Monkey!', 'Bonus Glue Gunner'), c0 = free.cash;
  expect(free.shopPrice('dart')).toBe(0); tower(free, 'dart'); expect(free.cash).toBe(c0);
  expect(free.shopPrice('glue')).toBeGreaterThan(0); // only one free tower per game
  const sell = sim('Better Sell Deals'), t = tower(sell, 'dart'); expect(sell.sellValue(t)).toBe(Math.floor(t.cost * 0.75));
  const c = sim('Budget Clusters'), b = tower(c, 'bomb', [[2, 2]]), b0 = tower(base, 'bomb', [[2, 2]], 500, 250);
  expect(base.upgradePrice(base.towers.indexOf(b0), 2) - c.upgradePrice(c.towers.indexOf(b), 2)).toBe(base.price(100));
});

test('powers, heroes and economy knowledge', () => {
  const s = sim('Powerful Monkey Storm'); s.bloons.push({ id: 1, type: 'zomg', dist: 300, hp: 9000 }); s.usePower('super_monkey_storm'); expect(s.bloons[0].hp).toBe(4000);
  const h = sim('Hero Favors', 'Empowered Heroes'), c0 = h.cash; expect(h.placeHero(100, 121, 'quincy')).toBe(true);
  expect(c0 - h.cash).toBe(Math.round(540 * 0.9)); expect(h.hero!.level).toBe(3);
  const loan = sim('Backroom Deals'); const f = tower(loan, 'farm', [[1, 4]], 400, 260); loan.startRound([{ type: 'red', n: 1, gap: 1 }]); loan.tick = f.abilityReady; const l0 = loan.cash;
  expect(loan.activate(loan.towers.indexOf(f))).toBe(true); expect(loan.cash - l0).toBe(10000);
  expect(createGame('monkey_meadow', 'medium', ['More Cash']).cash - createGame('monkey_meadow', 'medium').cash).toBe(200);
  expect(createGame('monkey_meadow', 'chimps', ['More Cash', 'Extra Dart Pops']).knowledge.size).toBe(0);
});

test('profile: points from rank 30, prerequisites, tree points, MM rows, respec, toggle, MM bonuses', () => {
  let p = { ...M.freshProfile(), rank: 29, mm: 5000 };
  expect(M.knowledgeBlock(p, 'Fast Tack Attacks')).toMatch(/rank 30/);
  p = { ...p, rank: 60 }; expect(M.knowledgeAvailable(p)).toBe(31);
  expect(M.knowledgeBlock(p, 'Hard Tacks')).toMatch(/Requires Fast Tack Attacks/);
  p = M.unlockKnowledge(p, 'Fast Tack Attacks'); expect(M.knowledgeState(p, 'Hard Tacks')).toBe('available');
  const deep = KNOWLEDGE.find(k => k.tree === 'primary' && k.points >= 5)!;
  expect(M.knowledgeBlock(p, deep.name)).not.toBe('');
  const paid = KNOWLEDGE.find(k => k.mm > 0)!; expect(paid.mm).toBeGreaterThanOrEqual(250);
  p = M.unlockKnowledge(p, 'Hard Tacks'); expect(p.mk).toEqual(['Fast Tack Attacks', 'Hard Tacks']);
  expect(M.activeKnowledge({ ...p, mkOn: false })).toEqual([]);
  const r = M.respecKnowledge(p); expect(r.mk).toEqual([]); expect(r.mm).toBe(p.mm - 2000);
  const mm = { ...M.freshProfile(), mk: ["Mo' Monkey Money", 'Cheaper Lakes'] };
  expect(M.recordGame(mm, { map: 'm', difficulty: 'easy', won: true, round: 40 }).mmGained).toBe(Math.round(M.recordGame(M.freshProfile(), { map: 'm', difficulty: 'easy', won: true, round: 40 }).mmGained * 1.1));
  expect(M.powerPrice(mm, 'portable_lake')).toBe(40);
});
