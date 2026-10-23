import { test, expect } from 'vitest';
import { Sim, BLOONS, roundGroups } from './sim';
import { MAPS } from './maps/maps';
import { MODES, createGame } from './modes/modes';
import { spots } from './test-spots';
import { inPoly } from './sim';

const run = (s: Sim, ticks: number) => { for (let i = 0; i < ticks; i++) s.step(); };

test('12 real map layouts: lanes run along the track polygons, no-build and track areas reject towers', () => {
  expect(Object.keys(MAPS).length).toBe(12);
  for (const m of Object.values(MAPS)) {
    expect([m.width, m.height]).toEqual([300, 230]); expect(m.lanes.length).toBeGreaterThan(0);
    const s = createGame(m.id, 'medium');
    for (const lane of m.lanes) {
      const pts = lane.filter(p => p.x > 5 && p.y > 5 && p.x < m.width - 5 && p.y < m.height - 5);
      const onTrack = pts.filter(p => m.track.some(t => inPoly(p, t))).length / pts.length;
      expect(onTrack, `${m.id} lane on track`).toBeGreaterThan(0.85); // Dark Castle's exit runs under the castle, off the road polygon
      for (const p of pts.filter((_, i) => i % 7 === 0)) expect(s.canPlace(p.x, p.y, 'dart'), `${m.id} track`).toBe(false);
    }
    for (const b of m.blocked) { const c = b.find(p => inPoly(p, b)) ?? b.reduce((a, p) => ({ x: a.x + p.x / b.length, y: a.y + p.y / b.length }), { x: 0, y: 0 });
      if (inPoly(c, b) && s.groundAt(c) === 'blocked') expect(s.canPlace(c.x, c.y, 'dart'), `${m.id} no-build`).toBe(false); } // nested land can override
    expect(spots(s, 'dart', 3)).toHaveLength(3);
  }
  expect([MAPS.ravine.lanes.length, MAPS.dark_castle.lanes.length, MAPS.sunken_columns.lanes.length]).toEqual([4, 4, 2]);
});

test('multi-lane spawning alternates lanes and bloons follow their own lane', () => {
  const s = createGame('sunken_columns', 'medium');
  s.startRound([{ type: 'red', n: 4, gap: 0.1 }]); run(s, 60);
  expect(new Set(s.bloons.map(b => b.lane))).toEqual(new Set([0, 1]));
  const b1 = s.bloons.find(b => b.lane === 1)!, start = MAPS.sunken_columns.lanes[1][0];
  expect(Math.abs(s.posOf(b1).x - start.x)).toBeLessThan(15); // lane 1 enters at its own (right) column
});

test('water towers need water; land towers cannot sit on it', () => {
  const s = createGame('in_the_loop', 'medium'); const [w] = spots(s, 'sub');
  expect(MAPS.in_the_loop.water.some(p => inPoly(w, p))).toBe(true);
  expect(s.canPlace(w.x, w.y, 'dart')).toBe(false);
  const [l] = spots(s, 'dart'); expect(s.canPlace(l.x, l.y, 'sub')).toBe(false);
});

test('MOAB-class pop spawns children in the same lane; regrow restores layers', () => {
  const s = createGame('sunken_columns', 'medium');
  s.startRound([{ type: 'moab', n: 1, gap: 1 }, { type: 'moab', n: 1, gap: 1 }]); run(s, 90);
  const m = s.bloons.find(b => b.lane === 1)!;
  const [p] = spots(s); s.addTower(p.x, p.y);
  (s as any).damage(m, m.hp, { ...(s as any).source(s.towers[0]), moabTargetable: true, damageType: 'normal', camo: true });
  const kids = s.bloons.filter(b => b.type === 'ceramic' && b.lane === 1);
  expect(kids.length).toBe(BLOONS.moab.kids.length);
  const r = createGame('monkey_meadow', 'medium');
  r.startRound([{ type: 'blue', n: 1, gap: 1, regrow: true }]); run(r, 5);
  const b = r.bloons[0]; b.type = 'red'; b.hp = 1;
  run(r, 200); expect(b.type).toBe('blue');
});

test('mode rules', () => {
  const g = (id: string) => createGame('monkey_meadow', id);
  expect(g('primary_only').addTower(100, 100, 'sniper')).toBe(false);
  expect(g('primary_only').addTower(100, 100, 'dart')).toBe(true);
  expect(g('military_only').addTower(100, 100, 'dart')).toBe(false);
  const chimps = g('chimps'); chimps.addTower(100, 100, 'dart'); expect(chimps.sell(0)).toBe(false);
  expect(chimps.round).toBe(5); expect(chimps.lives).toBe(1);
  expect(g('deflation').cash).toBe(20000); expect(g('deflation').round).toBe(30);
  expect(g('sandbox').lives).toBeGreaterThan(1e8);
  expect(g('hard').round).toBe(2);
  const fin = (id: string) => { const s = g(id); s.addTower(300, 220); s.rules.winRound = s.round + 1; return s; };
  const full = fin('medium'); full.startRound([{ type: 'red', n: 1, gap: 1 }]); const c0 = full.cash; run(full, 8000);
  const half = fin('half_cash'); half.startRound([{ type: 'red', n: 1, gap: 1 }]); const h0 = half.cash; run(half, 8000);
  expect(half.cash - h0).toBeLessThan(full.cash - c0);
  const dfl = fin('deflation'); dfl.startRound([{ type: 'red', n: 1, gap: 1 }]); const d0 = dfl.cash; run(dfl, 8000);
  expect(dfl.cash).toBe(d0);
  expect(full.won).toBe(true);
  const dbl = g('double_hp_moabs'), std = g('medium');
  dbl.startRound([{ type: 'moab', n: 1, gap: 1 }]); std.startRound([{ type: 'moab', n: 1, gap: 1 }]); run(dbl, 70); run(std, 70);
  expect(dbl.bloons[0].hp).toBe(std.bloons[0].hp * 2);
});

test('reverse mode runs the lane backwards', () => {
  const s = createGame('monkey_meadow', 'reverse');
  s.startRound([{ type: 'red', n: 1, gap: 1 }]); run(s, 2);
  const end = MAPS.monkey_meadow.lanes[0].at(-1)!; // reverse enters where the normal lane exits
  expect(Math.hypot(s.posOf(s.bloons[0]).x - end.x, s.posOf(s.bloons[0]).y - end.y)).toBeLessThan(5);
});

test('apopalypse auto-starts the next round', () => {
  const s = createGame('monkey_meadow', 'apopalypse');
  s.startRound([{ type: 'red', n: 2, gap: 0.1 }]); const r = s.round; run(s, 60);
  expect(s.round).toBeGreaterThan(r);
});

test('every mode starts a round headless', () => {
  for (const m of MODES) {
    const s = createGame('cubism', m.id);
    expect(s.startRound(), m.id).toBe(true); run(s, 30);
    expect(s.bloons.length, m.id).toBeGreaterThan(0);
  }
});

test('endless rounds past 140 are deterministic, camo/regrow/fortified mix, and late MOABs are tougher', () => {
  expect(roundGroups(141).length).toBeGreaterThan(0);
  expect(JSON.stringify(roundGroups(200))).toBe(JSON.stringify(roundGroups(200)));
  const flags = Array.from({ length: 60 }, (_, i) => roundGroups(150 + i)).flat();
  expect(flags.some(g => g.camo) && flags.some(g => g.regrow) && flags.some(g => g.fortified)).toBe(true);
  const early = new Sim([{ x: 0, y: 0 }, { x: 999, y: 0 }]), late = new Sim([{ x: 0, y: 0 }, { x: 999, y: 0 }]);
  late.round = 120;
  early.startRound([{ type: 'bfb', n: 1, gap: 1 }]); late.startRound([{ type: 'bfb', n: 1, gap: 1 }]); run(early, 200); run(late, 200);
  expect(late.bloons[0].hp).toBeGreaterThan(early.bloons[0].hp);
});
