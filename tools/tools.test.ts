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
