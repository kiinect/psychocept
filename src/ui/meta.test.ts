import { describe, expect, it } from 'vitest';
import { gameRewards, powerButtonState, supportedPowers } from './meta';
import { freshProfile, xpForRound } from '../meta';

describe('game rewards', () => {
  it('sums only played rounds with map and hero multipliers and awards first win and ranks', () => {
    const p = freshProfile();
    const r = gameRewards(p, { map: 'x', difficulty: 'easy', mapDifficulty: 2, won: true, startRound: 3, completedRound: 20, hero: 'Quincy' });
    expect(r.xp).toBe(Array.from({ length: 18 }, (_, i) => xpForRound(i + 3, { mapDifficulty: 2, hero: 'Quincy' })).reduce((a, b) => a + b, 0));
    expect(r.profile.stats.gamesWon).toBe(1);
    expect(r.mm).toBe(r.profile.mm);
    expect(r.levelUps.length).toBeGreaterThan(0);
  });
  it('gives no win money or unplayed XP on immediate defeat', () => {
    const r = gameRewards(freshProfile(), { map: 'x', difficulty: 'hard', mapDifficulty: 0, won: false, startRound: 3, completedRound: 2 });
    expect(r.xp).toBe(0); expect(r.mm).toBe(0);
  });
});
describe('power buttons', () => {
  it('requires inventory, implementation, and enabled rules', () => {
    expect(powerButtonState(0, true, false).disabled).toBe(true);
    expect(powerButtonState(2, false, false).disabled).toBe(true);
    expect(powerButtonState(2, true, true).disabled).toBe(true);
    expect(powerButtonState(2, true, false).disabled).toBe(false);
  });
});

it('detects both instant and placed powers via the sim API', () => {
  const supported = supportedPowers(['cash_drop', 'road_spikes', 'pontoon', 'banana_farmer', 'tech_bot', 'missing']);
  expect([...supported]).toEqual(['cash_drop', 'road_spikes', 'pontoon', 'banana_farmer']);
});

it('awards only additional endless XP without recording another game or win', () => {
  const first = gameRewards(freshProfile(), { map: 'x', difficulty: 'easy', mapDifficulty: 0, won: true, startRound: 1, completedRound: 40 });
  const endless = gameRewards(first.profile, { map: 'x', difficulty: 'easy', mapDifficulty: 0, won: false, startRound: 41, completedRound: 41, recorded: true });
  expect(endless.profile.stats).toEqual(first.profile.stats);
  expect(endless.profile.wins).toEqual(first.profile.wins);
  expect(endless.xp).toBe(xpForRound(41));
});

import { initialFlow, transition } from './flow';
it('opens Powers and returns to menu, and resumes a saved run from menu only', () => {
  const menu = transition(initialFlow(''), { type: 'start' });
  expect(transition(transition(menu, { type: 'powers' }), { type: 'back' })).toEqual(menu);
  expect(transition(menu, { type: 'loadRun' }).screen).toBe('game');
  const splash = initialFlow('');
  expect(transition(splash, { type: 'loadRun' })).toBe(splash);
});
