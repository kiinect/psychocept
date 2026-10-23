import { expect, it } from 'vitest';
import { createGame } from '../modes/modes';
import { controlVisibility } from './controls';
import { spots } from '../test-spots';

it('hides special controls on a base dart and shows only eligible paragons', () => {
  const s = createGame('monkey_meadow', 'sandbox'); const [a, b, c] = spots(s, 'dart', 3);
  s.placeTower(a.x, a.y, 'dart');
  expect(controlVisibility(s, 0)).toMatchObject({ aim: false, support: false, merge: false, collect: false, paragon: false, paragonHint: false });
  s.towers[0].tiers = [5, 0, 0];
  expect(controlVisibility(s, 0)).toMatchObject({ paragon: false, paragonHint: true });
  s.placeTower(b.x, b.y, 'dart'); s.towers[1].tiers = [0, 5, 0];
  s.placeTower(c.x, c.y, 'dart'); s.towers[2].tiers = [0, 0, 5];
  expect(controlVisibility(s, 0)).toMatchObject({ paragon: true, paragonHint: false });
});

it('uses aim eligibility and actual collectable resources', () => {
  const s = createGame('monkey_meadow', 'sandbox'); const [e] = spots(s, 'engineer');
  s.placeTower(e.x, e.y, 'engineer');
  expect(controlVisibility(s, 0).aim).toBe(false);
  s.towers[0].tiers = [0, 3, 0];
  expect(controlVisibility(s, 0).aim).toBe(true);
  s.towers[0].bank = 10;
  expect(controlVisibility(s, 0).collect).toBe(true);
  s.lives = 0;
  expect(controlVisibility(s, 0)).toMatchObject({ collect: false, support: false, merge: false });
});

it('requires a valid ally for support and a shared beast path for merging', () => {
  const s = createGame('monkey_meadow', 'sandbox'); const [e, b1, b2] = spots(s, 'beast', 3);
  s.placeTower(e.x, e.y, 'engineer'); s.towers[0].tiers = [0, 4, 0];
  expect(controlVisibility(s, 0).support).toBe(false);
  s.placeTower(b1.x, b1.y, 'beast');
  expect(controlVisibility(s, 0).support).toBe(true);
  s.placeTower(b2.x, b2.y, 'beast');
  expect(controlVisibility(s, 1).merge).toBe(false);
  s.towers[1].tiers = [0, 1, 0]; s.towers[2].tiers = [0, 1, 0];
  expect(controlVisibility(s, 1).merge).toBe(true);
  s.towers[2].mergedInto = s.towers[1];
  expect(controlVisibility(s, 1).merge).toBe(false);
});
