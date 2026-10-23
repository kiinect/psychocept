// Regression tests for .tasks/REVIEW-FINDINGS.md (gpt-6.1-sol review of the 432fee7 merge).
import { expect, test } from 'vitest';
import { Sim, STANDARD_RULES, type Bloon } from './sim';
import { createGame } from './modes/modes';
import { heroTowerWeapon } from './hero-runtime';
import { TOWERS } from './towers';
const path = [{ x: 0, y: 150 }, { x: 960, y: 150 }];
const water = [{ x: 60, y: 160, width: 160, height: 120 }];
const deflation = () => { const s = new Sim(path, 'medium', water); s.rules = { ...STANDARD_RULES, cashMult: 0, incomeMult: 0 }; s.cash = 1e6; return s; };
const red = (id: number, dist: number, lane?: number): Bloon => ({ id, type: 'red', dist, hp: 1, lane });
const finishRound = (s: Sim) => { expect(s.startRound([{ type: 'red', n: 1, gap: 1 }])).toBe(true); s.spawnQ = []; s.step(); };
const any = (s: Sim) => s as any; // private members under test

test('bananas and bank withdrawals respect incomeMult', () => {
  const s = deflation(); s.addTower(100, 120, 'farm'); const farm = s.towers[0], c0 = s.cash;
  s.collectibles.push({ x: 100, y: 120, owner: farm, value: 500, until: Infinity });
  expect(s.collectAt({ x: 100, y: 120 })).toBe(true);
  farm.bank = 1000; s.collect(0);
  expect(s.cash).toBe(c0);
});

test('hero round income respects incomeMult', () => {
  const s = deflation(); s.placeHero(100, 121, 'benjamin'); s.hero!.stats.income = 300; const c0 = s.cash;
  finishRound(s);
  expect(s.roundActive).toBe(false); expect(s.cash).toBe(c0);
});

test('heroDestroy, hooks and Trojan bonuses pay nothing in Deflation', () => {
  const s = deflation(); s.placeHero(100, 121, 'benjamin'); const c0 = s.cash;
  const a = red(1, 300); s.bloons.push(a); s.heroDestroy(a);
  const t = red(2, 300); t.trojan = true; s.bloons.push(t); s.heroHit(t, { ...TOWERS.dart.base, damage: 5, pierce: 5 }, { x: 300, y: 150 });
  expect(s.bloons).toHaveLength(0);
  s.addTower(140, 220, 'buccaneer'); for (let i = 0; i < 4; i++) s.upgrade(0, 1);
  expect(s.cash).toBe(c0 - s.towers[0].cost);
  s.bloons.push({ id: 3, type: 'moab', dist: 300, hp: 200 }); const c1 = s.cash;
  expect(s.activate(0)).toBe(true); expect(s.bloons).toHaveLength(0);
  expect(s.cash).toBe(c1);
});

test('road items only hit bloons on their own lane', () => {
  const s = createGame('town_center', 'medium'); s.cash = 1e6; s.addTower(480, 270, 'spike'); const owner = s.towers[0];
  any(s).roadItem(owner, { ...owner, damage: 1, pierce: 10 }, 200, 'spike', 100);
  const other = red(1, 200, 1), own = red(2, 200, 0); s.bloons.push(other, own);
  any(s).runRoadItems();
  expect(s.bloons).toContain(other); expect(s.bloons).not.toContain(own);
});

test('undead keep the lane of the bloon they were aimed at', () => {
  const s = createGame('town_center', 'medium'); s.cash = 1e6; s.addTower(480, 270, 'wizard');
  for (let i = 0; i < 4; i++) s.upgrade(0, 2);
  const w = s.towers[0]; w.range = 2000; w.graveyard = 10;
  s.bloons.push({ ...red(1, 100, 1), hp: 1e6, type: 'ceramic' } as Bloon);
  for (let i = 0; i < 120 && !any(s).undead.length; i++) s.step();
  expect(any(s).undead[0]?.lane).toBe(1);
});

test('Apopalypse keeps going when bloons were cleared before the last spawn', () => {
  const s = createGame('monkey_meadow', 'apopalypse'); s.startRound([{ type: 'red', n: 1, gap: 1 }]); const r = s.round;
  s.bloons = []; s.spawnQ = []; s.step();
  expect(s.round).toBe(r + 1); expect(s.roundActive).toBe(true);
});

test('Apopalypse pays round-end income when the next round starts with bloons alive', () => {
  const s = createGame('monkey_meadow', 'apopalypse'); s.startRound([{ type: 'red', n: 1, gap: 1 }]); const r = s.round;
  s.spawnQ = []; s.bloons.push(red(99, 0)); const c0 = s.cash; s.step();
  expect(s.round).toBe(r + 1); expect(s.cash).toBe(c0 + 100 + r);
});

test('round bonus repays an IMF loan like any other income', () => {
  // uncertain: wiki says the loan is repaid from "income"; we include the round bonus.
  const s = new Sim(path, 'medium', water); s.cash = 1e6; s.addTower(100, 120, 'farm'); s.towers[0].debt = 1000; const c0 = s.cash;
  finishRound(s);
  expect(s.towers[0].debt).toBeLessThan(1000); expect(s.cash).toBeLessThan(c0 + 100 + s.round + s.roundIncome(s.towers[0]));
});

test('engineer foam falls back to a reachable lane', () => {
  const s = createGame('town_center', 'medium'); s.cash = 1e7; const sim = any(s);
  // Place where lane 1 is far: aim the target point at lane 1 but give the engineer a short range near lane 0 only.
  const p0 = s.posAt(200, 0); s.addTower(p0.x, p0.y + 25, 'engineer');
  if (!s.towers.length) s.addTower(p0.x, p0.y - 25, 'engineer');
  for (let i = 0; i < 3; i++) s.upgrade(0, 1);
  const e = s.towers[0]; e.targetPoint = s.posAt(200, 1);
  expect(sim.nearestLane(e.targetPoint)).toBe(1);
  expect(sim.nearTrack(e, s.effectiveStats(e).range, 1)).toHaveLength(0); // old code only tried lane 1
  for (let i = 0; i < 300 && !s.roadItems.length; i++) s.step();
  expect(s.roadItems.some(i => i.kind === 'foam')).toBe(true);
});

test('paragons ignore hero and magic buffs', () => {
  const s = new Sim(path, 'medium', water); s.cash = 1e7; s.placeHero(100, 121, 'striker'); s.grantHeroXP(1e9);
  s.addTower(110, 100, 'bomb'); const p = s.towers[0]; p.degree = 1;
  const base = s.effectiveStats(p);
  expect(heroTowerWeapon(s, p, base)).toEqual(base);
  s.addTower(140, 100, 'alchemist'); p.brew = { source: s.towers[1], until: Infinity, shots: 99, level: 4 } as any;
  expect(any(s).magicBuffs(p, { ...base })).toEqual(base);
});

test('shopPrice quotes a lone village discount and Rosalia without villages', () => {
  const s = new Sim(path, 'medium', water); s.cash = 1e7; s.addTower(300, 100, 'village'); s.upgrade(0, 2);
  expect(s.shopPrice('boomerang')).toBeLessThan(s.price(TOWERS.boomerang.cost));
  const r = new Sim(path, 'medium', water); r.cash = 1e7; r.placeHero(100, 121, 'rosalia'); r.grantHeroXP(1e9);
  expect(r.shopPrice('ace')).toBeLessThan(r.price(TOWERS.ace.cost));
});

test('Supply Drop cash respects incomeMult', () => {
  const s = deflation(); s.addTower(400, 300, 'sniper'); for (let i = 0; i < 4; i++) s.upgrade(0, 1);
  const t = s.towers[0]; s.tick = t.abilityReady; const c0 = s.cash;
  expect(s.activate(0)).toBe(true); expect(s.cash).toBe(c0);
});
