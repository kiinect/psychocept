import { test, expect } from 'vitest';
import * as M from './index';
import { Sim } from '../sim';

test('round XP formula matches wiki anchors', () => {
  expect([M.roundXp(1), M.roundXp(20), M.roundXp(21), M.roundXp(50), M.roundXp(51), M.roundXp(52)]).toEqual([40, 420, 460, 1620, 1710, 1800]);
});
test('xp modifiers: map difficulty, freeplay, hero', () => {
  expect(M.xpForRound(10, { mapDifficulty: 3 })).toBe(Math.floor(220 * 1.3));
  expect(M.xpForRound(10, { freeplay: true })).toBe(66);
  expect(M.xpForRound(110, { freeplay: true })).toBe(Math.floor(M.roundXp(110) * 0.1));
  expect(M.xpForRound(10, { hero: 'Adora', freeplay: true })).toBe(Math.floor(220 * 1.71));
  expect(M.heroXpMultiplier('Quincy')).toBe(1); expect(M.heroXpMultiplier('Sauda')).toBe(1.425); expect(M.heroXpMultiplier('Nobody')).toBe(1);
});
test('ranks and level-ups', () => {
  expect(M.rankForXp(0)).toBe(1); expect(M.rankForXp(479)).toBe(1); expect(M.rankForXp(480)).toBe(2); expect(M.rankForXp(1e12)).toBe(M.MAX_RANK);
  const r = M.addXp(400, 1200); expect(r.levelUps).toEqual([2, 3]); expect(r.rank).toBe(3);
  expect(M.rankProgress(500)).toEqual({ rank: 2, into: 20, need: 620 });
  expect(M.splitTowerXp(100, [300, 100])).toEqual([75, 25]);
});
test('sell value is 70%', () => { expect(M.sellValue(340)).toBe(238); });

test('powers: all 44 defined, unique ids, costs from wiki', () => {
  expect(M.POWERS.length).toBe(44);
  expect(new Set(M.POWERS.map(p => p.id)).size).toBe(44);
  expect(M.POWER_BY_ID.super_monkey_storm.cost).toBe(100);
  expect(M.POWER_BY_ID.cave_monkey.name).toBe('Cave Monkey');
  expect(M.POWERS.filter(p => p.kind !== 'unimplemented').length).toBe(19);
  expect(M.stormHit(300, false)).toBe(300); expect(M.stormHit(1e6, true)).toBe(5000);
  expect(M.thriveMult({ startRound: 5, upgraded: false }, 6)).toBe(1.25);
  expect(M.thriveMult({ startRound: 5, upgraded: true }, 7)).toBe(1);
  expect(M.boostCooldown(1, true)).toBe(0.5);
});

test('profile: xp level-ups pay MM, first win pays triple, powers buy/use', () => {
  let p = M.freshProfile();
  const g = M.grantXp(p, 1200); expect(g.profile.rank).toBe(3); expect(g.profile.mm).toBe(50);
  const w1 = M.recordGame(g.profile, { map: 'a', difficulty: 'easy', won: true, round: 40 });
  const w2 = M.recordGame(w1.profile, { map: 'a', difficulty: 'easy', won: true, round: 40 });
  expect(w1.mmGained).toBe(3 * w2.mmGained);
  const rich = { ...w2.profile, mm: 500 }; p = M.purchasePower(rich, 'cash_drop', 1); expect(p.powers.cash_drop).toBe(1); expect(p.mm).toBe(300);
  expect(M.purchasePower({ ...p, mm: 0 }, 'cash_drop').powers.cash_drop).toBe(1);
  expect(M.usePower(p, 'cash_drop')!.powers.cash_drop).toBe(0); expect(M.usePower(M.freshProfile(), 'cash_drop')).toBeUndefined();
});

test('storage: roundtrip, migration, corruption, blocked storage', () => {
  const kv = M.memoryKV(), s = M.profileSlot(kv);
  expect(s.load()).toEqual(M.freshProfile());
  s.save({ ...M.freshProfile(), mm: 77 }); expect(s.load().mm).toBe(77);
  kv.setItem('mpt.profile', JSON.stringify({ v: 1, data: { money: 12, xp: 5 } })); expect(s.load().mm).toBe(12);
  kv.setItem('mpt.profile', JSON.stringify({ v: 99, data: {} })); expect(s.load()).toEqual(M.freshProfile());
  kv.setItem('mpt.profile', '{nope'); expect(s.load()).toEqual(M.freshProfile());
  kv.setItem('mpt.profile', JSON.stringify({ v: 2, data: { mm: -5, xp: 'x', powers: { a: 2, b: -1 } } })); expect(s.load().mm).toBe(0);
  expect(s.load().powers).toEqual({ a: 2 });
  const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const b = M.settingsSlot(blocked); expect(b.load()).toEqual(M.defaultSettings()); expect(b.save(M.defaultSettings())).toBe(false);
  expect(M.speedMultiplier({ ...M.defaultSettings(), fastForward: true })).toBe(3);
});

test('run snapshot survives save and restores a Sim', () => {
  const path = [{ x: 0, y: 100 }, { x: 900, y: 100 }];
  const a = new Sim(path, 'hard'); a.cash = 1e6; a.addTower(100, 200); a.addTower(300, 200, 'bomb'); a.upgrade(0, 0); a.upgrade(0, 1); a.cycleTargeting(0);
  a.cash = 333; a.lives = 42; a.round = 17;
  const kv = M.memoryKV(), rs = M.runSlot(kv);
  expect(rs.save(M.snapshotSim(a, 'm1', 5))).toBe(true);
  const snap = rs.load()!; const b = new Sim(path, 'hard');
  expect(M.restoreSim(b, snap)).toBe(true);
  expect(b.towers.map(t => [t.type, t.tiers, t.cost, t.targeting])).toEqual(a.towers.map(t => [t.type, t.tiers, t.cost, t.targeting]));
  expect([b.cash, b.lives, b.round]).toEqual([333, 42, 17]);
  expect(M.restoreSim(new Sim(path, 'easy'), snap)).toBe(false);
  kv.setItem('mpt.run', JSON.stringify({ v: 1, data: { map: 1 } })); expect(rs.load()).toBeNull();
});
