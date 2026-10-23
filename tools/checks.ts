import { Sim, BLOONS, ROUNDS, type Pt } from '../src/sim';
import { TOWERS, type TowerKind } from '../src/towers';
import rounds from '../data/wiki/rounds.json';

export const PATH: Pt[] = [{ x: 0, y: 270 }, { x: 900, y: 270 }, { x: 900, y: 60 }, { x: 60, y: 60 }, { x: 60, y: 480 }, { x: 900, y: 480 }];

/** Fresh Sim with long path, huge cash and lives so nothing ends the run. */
export function bigSim(): Sim { const s = new Sim(PATH); s.cash = 1e12; s.lives = 1e9; return s; }

/** Push bloons spread along the path (bypasses the round spawner). */
export function fill(s: Sim, n: number, type = 'ceramic') {
  const hp = BLOONS[type].hp, L = s.pathLen;
  for (let i = 0; i < n; i++) s.bloons.push({ id: s.nextId++, type, dist: (i / n) * L * 0.9, hp });
}

export interface SweepRow { tower: string; path: number; tier: number; fired: boolean }
/** Buy every tower at every tier of every path (single-path 0..5) and check it fires, damages, or acts within 20 s. */
export function sweepTowers(seconds = 20): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const kind of Object.keys(TOWERS) as TowerKind[]) for (let path = 0; path < 3; path++) for (let tier = 0; tier <= 5; tier++) {
    if (tier === 0 && path > 0) continue;
    const s = bigSim();
    let ok = s.placeTower(450, 200, kind) || s.addTower(450, 200, kind);
    for (let n = 0; n < tier && ok; n++) ok = s.upgrade(0, path);
    let fired = false;
    if (ok) {
      fill(s, 40, 'ceramic'); fill(s, 4, 'moab');
      const hp0 = s.bloons.reduce((a, b) => a + b.hp, 0), t = s.towers[0];
      if (t.ability) s.tick = Math.max(s.tick, t.abilityReady), s.activate(0);
      for (let i = 0; i < seconds * 60 && !fired; i++) {
        s.step();
        fired = s.darts.length > 0 || s.effects.length > 0 || s.bloons.reduce((a, b) => a + b.hp, 0) < hp0 || s.bloons.some(b => b.glue || b.slow || b.freezeLayers || b.frozenUntil);
      }
    }
    rows.push({ tower: kind, path, tier, fired: ok && fired });
  }
  return rows;
}

export interface RbeRow { round: number; sim: number; wiki: number; ok: boolean }
/** Rounds above this use the wiki's HP-scaled RBE (MOAB-class scaling from r81), which the sim data does not model. */
export const RBE_STRICT_TO = 80;
/** Sum RBE of each round's groups (fortified bloons use fortifiedRbe) vs data/wiki/rounds.json rbe_scaled (base when no scaled). */
export function roundRbe(to = 140): RbeRow[] {
  const out: RbeRow[] = [];
  for (let r = 1; r <= to; r++) {
    const row: any = rounds.data.rounds[r - 1];
    const sim = ROUNDS[r - 1].groups.reduce((a, g) => a + g.count * (g.fortified ? BLOONS[g.type].fortifiedRbe : BLOONS[g.type].rbe), 0);
    const wiki = row.rbe_scaled ?? row.rbe_base;
    out.push({ round: r, sim, wiki, ok: sim === wiki });
  }
  return out;
}

/** Run a stress scenario; returns ms/tick stats. Keeps ~targetBloons alive by topping up. */
export function stress(seconds = 20, targetBloons = 1500) {
  const s = bigSim();
  const kinds = Object.keys(TOWERS) as TowerKind[];
  for (let i = 0; i < 30; i++) {
    const k = kinds[i % kinds.length], x = 80 + (i % 10) * 85, y = 150 + Math.floor(i / 10) * 110;
    if (s.placeTower(x, y, k)) for (let u = 0; u < 3; u++) s.upgrade(s.towers.length - 1, i % 3);
  }
  const types = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'lead', 'ceramic', 'rainbow', 'moab'];
  const top = () => { const need = targetBloons - s.bloons.length; for (let i = 0; i < need; i++) fill(s, 1, types[(s.nextId + i) % types.length]); };
  const times: number[] = [];
  const ticks = seconds * 60;
  for (let i = 0; i < ticks; i++) {
    if (i % 30 === 0) top(); // re-add near spawn so density stays ~constant
    for (const b of s.bloons) if (b.dist > s.pathLen * 0.9) b.dist = 0;
    const t0 = performance.now(); s.step(); times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { ticks, avgBloons: targetBloons, meanMs: mean, p95Ms: times[Math.floor(times.length * 0.95)], maxMs: times[times.length - 1] };
}
