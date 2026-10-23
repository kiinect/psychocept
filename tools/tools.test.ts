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
test('live sim spawns with the RBE rules: r100 MOAB HP ramp, r81+ single children', async () => {
  const { Sim, moabHpMult } = await import('../src/sim');
  [[80, 1], [100, 1.4], [124, 2.6], [125, 2.75], [140, 5]].forEach(([r, m]) => expect(moabHpMult(r)).toBeCloseTo(m));
  const s = new Sim([{ x: 0, y: 150 }, { x: 960, y: 150 }]); s.round = 99;
  s.startRound([{ type: 'moab', n: 1, gap: 1 }]); s.step();
  expect(s.bloons[0].hp).toBeCloseTo(280);
  s.bloons = [{ id: 1, type: 'ceramic', dist: 300, hp: 1 }];
  s.heroHit(s.bloons[0], { ...(await import('../src/towers')).TOWERS.dart.base, damage: 1, pierce: 1 }, { x: 300, y: 150 });
  expect(s.bloons.map(b => b.type)).toEqual(['rainbow']);
});
