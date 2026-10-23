import { expect, test } from 'vitest';
import { createGame } from '../modes/modes';
import { Lockstep, simHash, type Frame } from './lockstep';
import { execute, validCommand } from './commands';
import { spots } from '../test-spots';

const coop = (n = 2, split = false) => { const s = createGame('monkey_meadow', 'medium'); s.setPlayers(n, split); return s; };

test('host and client stay identical when fed the same frames, with commands from both players', () => {
  const a = coop(), b = coop(), host = new Lockstep(a, true), client = new Lockstep(b, false);
  const [p0, p1] = spots(a, 'dart', 2);
  const frames: Frame[] = [];
  host.submit(0, { k: 'place', x: p0.x, y: p0.y, kind: 'dart' });
  host.submit(1, { k: 'place', x: p1.x, y: p1.y, kind: 'dart' });
  host.submit(0, { k: 'round' });
  for (let i = 0; i < 40; i++) { frames.push(host.advance(3)); host.pump(); }
  host.submit(1, { k: 'upgrade', i: 1, path: 0 }); host.submit(1, { k: 'upgrade', i: 0, path: 0 }); // second one is not theirs
  for (let i = 0; i < 400; i++) { frames.push(host.advance(3)); host.pump(); }
  for (const f of frames) { client.receive(f); client.pump(); }
  expect(b.tick).toBe(a.tick); expect(simHash(b)).toBe(simHash(a));
  expect(a.towers.map(t => [t.player, t.tiers[0]])).toEqual([[0, 0], [1, 1]]);
  expect(a.wallets[0]).toBeGreaterThan(a.wallets[1]); // player 1 paid for an upgrade, both earned the same pop cash
});

test('co-op rules: own towers only, map split zones, giving cash, tower income to its owner', () => {
  const s = coop(2, true); const [left] = spots(s, 'dart', 1, { x: 40, y: 115 }), [right] = spots(Object.assign(s, { actor: 1 }), 'dart', 1, { x: 260, y: 115 }); s.actor = 0;
  expect(execute(s, 1, { k: 'place', x: left.x, y: left.y, kind: 'dart' })).toBe(false); // player 2 can't build in player 1's zone
  expect(execute(s, 0, { k: 'place', x: left.x, y: left.y, kind: 'dart' })).toBe(true);
  expect(execute(s, 1, { k: 'place', x: right.x, y: right.y, kind: 'dart' })).toBe(true);
  expect(execute(s, 1, { k: 'sell', i: 0 })).toBe(false);
  const w = [...s.wallets]; expect(execute(s, 0, { k: 'give', to: 1, amount: 100 })).toBe(true);
  expect(s.wallets).toEqual([w[0] - 100, w[1] + 100]);
  expect(execute(s, 0, { k: 'give', to: 1, amount: 1e9 })).toBe(false);
  const f = coop(2); f.wallets = [1e5, 1e5]; f.actor = 1; const [fp] = spots(f, 'farm', 1); f.actor = 0;
  expect(execute(f, 1, { k: 'place', x: fp.x, y: fp.y, kind: 'farm' })).toBe(true); const before = [...f.wallets];
  f.startRound([{ type: 'red', n: 1, gap: 1 }]); f.spawnQ = []; f.step();
  expect(f.wallets[1] - before[1]).toBeGreaterThan(f.wallets[0] - before[0]); // farm income only to its owner
});

test('network commands are validated', () => {
  expect(validCommand({ k: 'place', x: 1, y: 2, kind: 'dart' })).toBe(true);
  for (const bad of [null, {}, { k: 'place', x: 'a', y: 1 }, { k: 'give', to: 1 }, { k: 'nope' }, { k: 'target', i: 0, dir: 2 }]) expect(validCommand(bad)).toBe(false);
  const s = coop(), h = new Lockstep(s, true); h.submit(7, { k: 'round' }); h.submit(0, { k: 'evil' }); expect(h.advance(1).cmds).toHaveLength(0);
});
