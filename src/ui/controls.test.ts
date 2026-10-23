import { expect, it } from 'vitest';
import { createGame } from '../modes/modes';
import { controlVisibility } from './controls';

it('hides special controls on a base dart and shows only eligible paragons', () => {
  const s = createGame('monkey_meadow', 'sandbox');
  s.placeTower(100, 100, 'dart');
  expect(controlVisibility(s, 0)).toMatchObject({ aim: false, support: false, merge: false, collect: false, paragon: false, paragonHint: false });
  s.towers[0].tiers = [5, 0, 0];
  expect(controlVisibility(s, 0)).toMatchObject({ paragon: false, paragonHint: true });
  s.placeTower(150, 100, 'dart'); s.towers[1].tiers = [0, 5, 0];
  s.placeTower(200, 100, 'dart'); s.towers[2].tiers = [0, 0, 5];
  expect(controlVisibility(s, 0)).toMatchObject({ paragon: true, paragonHint: false });
});

it('uses aim eligibility and actual collectable resources', () => {
  const s = createGame('monkey_meadow', 'sandbox');
  s.placeTower(100, 100, 'engineer');
  expect(controlVisibility(s, 0).aim).toBe(false);
  s.towers[0].tiers = [0, 3, 0];
  expect(controlVisibility(s, 0).aim).toBe(true);
  s.towers[0].bank = 10;
  expect(controlVisibility(s, 0).collect).toBe(true);
  s.lives = 0;
  expect(controlVisibility(s, 0)).toMatchObject({ collect: false, support: false, merge: false });
});

it('requires a valid ally for support and a shared beast path for merging', () => {
  const s = createGame('monkey_meadow', 'sandbox');
  s.placeTower(100, 100, 'engineer'); s.towers[0].tiers = [0, 4, 0];
  expect(controlVisibility(s, 0).support).toBe(false);
  s.placeTower(150, 100, 'beast');
  expect(controlVisibility(s, 0).support).toBe(true);
  s.placeTower(200, 100, 'beast');
  expect(controlVisibility(s, 1).merge).toBe(false);
  s.towers[1].tiers = [0, 1, 0]; s.towers[2].tiers = [0, 1, 0];
  expect(controlVisibility(s, 1).merge).toBe(true);
  s.towers[2].mergedInto = s.towers[1];
  expect(controlVisibility(s, 1).merge).toBe(false);
});
