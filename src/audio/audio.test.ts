import { expect, test } from 'vitest';
import { Sim, ROUNDS } from '../sim';
import { TOWERS } from '../towers';
import { AudioObserver } from './observe';
import { readSettings } from './settings';

const make = () => new Sim([{ x: 0, y: 100 }, { x: 960, y: 100 }]);
test('each tower and all ninety upgrades produce an attack cue headlessly', () => {
  for (const type of Object.keys(TOWERS) as (keyof typeof TOWERS)[]) {
    for (let path = 0; path < 3; path++) for (let tier = 0; tier <= 5; tier++) {
      const s = make(); s.cash = 1e7; s.addTower(100, 115, type);
      for (let i = 0; i < tier; i++) s.upgrade(0, path);
      const observer = new AudioObserver(); observer.update(s);
      s.bloons.push({ id: 999, type: 'ceramic', dist: 100, hp: 10000 });
      s.step();
      expect(observer.update(s)).toContain(`attack:${type}`);
      expect(observer.update(s)).toEqual([]);
    }
  }
});
test('placement, upgrade, sale, ability and round transitions fire once', () => {
  const s = make(), o = new AudioObserver(); o.update(s); s.cash = 1e7;
  s.addTower(100, 115, 'bomb'); expect(o.update(s)).toContain('placement');
  s.upgrade(0, 1); expect(o.update(s)).toContain('upgrade');
  s.upgrade(0, 1); s.upgrade(0, 1); s.upgrade(0, 1); o.update(s);
  s.towers[0].abilityReady = 0;
  s.bloons.push({ id: 99, type: 'moab', dist: 100, hp: 200 });
  expect(s.activate(0)).toBe(true); expect(o.update(s)).toContain('ability');
  s.sell(0); expect(o.update(s)).toContain('sell');
  s.startRound([{ type: 'red', n: 1, gap: 1 }]); expect(o.update(s)).toContain('roundStart');
  s.bloons = []; s.spawnQ = []; s.step(); expect(o.update(s)).toContain('roundEnd');
});
test('damage and ceramic removal cue pops while leaks do not', () => {
  const s = make(), o = new AudioObserver();
  s.bloons.push({ id: 1, type: 'ceramic', hp: 10, dist: 0 }); o.update(s);
  s.bloons[0].hp--; expect(o.update(s)).toEqual(['pop', 'ceramic']);
  s.bloons = []; expect(o.update(s)).toContain('ceramic');
  s.bloons.push({ id: 2, type: 'red', hp: 1, dist: 0 }); o.update(s);
  s.bloons = []; s.lives--; expect(o.update(s)).toEqual([]);
});
test('defeat, final victory, and replacement simulations reset correctly', () => {
  const s = make(), o = new AudioObserver(); o.update(s);
  s.lives = 0; expect(o.update(s)).toContain('defeat'); expect(o.update(s)).toEqual([]);
  const fresh = make(); expect(o.update(fresh)).toEqual([]);
  fresh.round = ROUNDS.length; fresh.roundActive = true; o.update(fresh);
  fresh.roundActive = false; expect(o.update(fresh)).toContain('victory');
});
test('settings tolerate malformed storage and clamp volumes', () => {
  expect(readSettings('bad')).toEqual({ sfx: 0.65, music: 0.25, muted: false });
  expect(readSettings('{"sfx":9,"music":-1,"muted":true}')).toEqual({ sfx: 1, music: 0, muted: true });
});
test('pop income catches a bloon born and destroyed between frames without mistaking round rewards', () => {
  const s = make(), o = new AudioObserver(); o.update(s);
  s.cash++; expect(o.update(s)).toEqual(['pop']);
  s.round = 1; s.roundActive = true; o.update(s);
  s.roundActive = false; s.cash += 101;
  expect(o.update(s)).toEqual(['roundEnd']);
});
