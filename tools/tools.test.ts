import { test, expect } from 'vitest';
import { sweepTowers, roundRbe, RBE_STRICT_TO, stress } from './checks';

test('every registered tower/tier is purchasable and fires', () => {
  const bad = sweepTowers(20).filter(r => !r.fired);
  expect(bad).toEqual([]);
});
test(`round RBE 1-${RBE_STRICT_TO} matches data/wiki/rounds.json`, () => {
  expect(roundRbe(RBE_STRICT_TO).filter(r => !r.ok)).toEqual([]);
});
test('1500-bloon stress runs and stays finite', () => {
  const r = stress(2, 1500); // short; CI machines vary so no timing assert
  expect(r.meanMs).toBeGreaterThan(0); expect(Number.isFinite(r.maxMs)).toBe(true);
});
test('live sim spawns with the RBE rules: freeplay HP ramp, mode multiplier, single children, super ceramic cash', async () => {
  const { Sim, BLOONS, moabHpMult, STANDARD_RULES } = await import('../src/sim');
  const { TOWERS } = await import('../src/towers');
  [[80, 1], [100, 1.4], [124, 2.6], [125, 2.75], [140, 5]].forEach(([r, m]) => expect(moabHpMult(r)).toBeCloseTo(m));
  const spawn = (round: number, type: string, fortified = false, mult = 1) => {
    const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }]); s.round = round - 1; s.rules = { ...STANDARD_RULES, moabHpMult: mult };
    s.startRound([{ type, n: 1, gap: 1, fortified }]); s.step(); return s;
  };
  expect(spawn(125, 'moab').bloons[0].hp).toBeCloseTo(550);
  expect(spawn(140, 'bfb', true).bloons[0].hp).toBeCloseTo(BLOONS.bfb.fortifiedHp * 5);
  expect(spawn(140, 'moab', false, 2).bloons[0].hp).toBeCloseTo(2000);
  expect(spawn(90, 'ceramic', true).bloons[0].hp).toBe(120);
  const pop = (type: string) => { const s = spawn(90, 'red'); s.bloons = [{ id: 1, type, dist: 300, hp: 1 }]; const c = s.cash;
    s.heroHit(s.bloons[0], { ...TOWERS.dart.base, damage: 1, pierce: 1 }, { x: 300, y: 150 }); return { kids: s.bloons.map(b => b.type), cash: s.cash - c }; };
  expect(pop('ceramic').kids).toEqual(['rainbow']); expect(pop('zebra').kids).toEqual(['white']);
  expect(pop('ceramic').cash).toBeCloseTo(87 * pop('red').cash);
});
