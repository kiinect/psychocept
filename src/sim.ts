// Fixed-step (60 Hz), deterministic and independent of rendering.
import bloonJson from '../data/wiki/bloons.json';
import roundJson from '../data/wiki/rounds.json';
import modeJson from '../data/wiki/modes.json';
import { BASE, DART_TIERS, canUpgrade, dartStats, type DartStats, type Tiers } from './towers/dart';
export { canUpgrade } from './towers/dart';
export const DT = 1 / 60;
export interface Pt { x: number; y: number }
export interface BloonDef { hp: number; speed: number; rbe: number; kids: string[]; immunities: string[]; fortifiedHp: number; fortifiedRbe: number; popCash: number; fortifiable: boolean }
export const BLOONS: Record<string, BloonDef> = {};
for (const [id, b] of Object.entries(bloonJson.data.bloons)) {
  const fortified = b as typeof b & { hp_fortified?: number; rbe_fortified?: number };
  BLOONS[id] = { hp: b.hp, speed: b.speed_px_per_s, rbe: b.rbe, kids: b.children.flatMap(c => Array<string>(c.count).fill(c.id)), immunities: b.immunities,
    fortifiedHp: fortified.hp_fortified ?? b.hp, fortifiedRbe: fortified.rbe_fortified ?? b.rbe, popCash: b.pop_cash, fortifiable: b.fortifiable };
}
export interface Group { type: string; count: number; camo?: boolean; regrow?: boolean; fortified?: boolean }
export const ROUNDS: { groups: Group[] }[] = roundJson.data.rounds;
const SPACING = roundJson.data.default_spacing as Record<string, unknown>;
export interface SpawnGroup { type: string; n: number; gap: number; camo?: boolean; regrow?: boolean; fortified?: boolean }
export const roundGroups = (r: number): SpawnGroup[] => (ROUNDS[r - 1]?.groups ?? []).map(g => ({ ...g, n: g.count, gap: typeof SPACING[g.type] === 'number' ? SPACING[g.type] as number : 0.5 }));
export interface Bloon { id: number; type: string; dist: number; hp: number; camo?: boolean; fortified?: boolean; regrow?: boolean }
export const TARGETING = ['First', 'Last', 'Close', 'Strong'] as const;
export type Targeting = typeof TARGETING[number];
export interface Tower extends Pt, DartStats { tiers: Tiers; cd: number; cost: number; targeting: Targeting; shots: number }
export interface Dart extends Pt, DartStats { vx: number; vy: number; life: number; hit: Set<number> }
export type Difficulty = keyof typeof modeJson.data.difficulties;
export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function popCashMultiplier(round: number) {
  let factor = 1;
  for (const [start, percent] of Object.entries(roundJson.data.cash_per_pop_tax_percent_from_round)) if (round >= Number(start)) factor = percent / 100;
  return factor;
}
export class Sim {
  bloons: Bloon[] = []; towers: Tower[] = []; darts: Dart[] = [];
  cash: number; lives: number; round = 0; tick = 0; nextId = 1; rng = mulberry32(1);
  roundActive = false;
  spawnQ: (Omit<Bloon, 'id' | 'hp' | 'dist'> & { at: number })[] = [];
  private len: number[] = [];
  constructor(public path: Pt[], public difficulty: Difficulty = 'medium') {
    const mode = modeJson.data.difficulties[difficulty];
    this.cash = 'starting_cash' in mode ? mode.starting_cash : 650; this.lives = mode.lives;
    this.round = 'start_round' in mode ? mode.start_round - 1 : 0;
    let s = 0; this.len = [0];
    for (let i = 1; i < path.length; i++) { s += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); this.len.push(s); }
  }
  get gameOver() { return this.lives <= 0; }
  get pathLen() { return this.len[this.len.length - 1]; }
  price(cost: number) { return Math.ceil(cost * modeJson.data.difficulties[this.difficulty].tower_cost_mult / 5 - 1e-10) * 5; }
  posAt(d: number): Pt {
    const L = this.len; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1), a = this.path[i - 1], b = this.path[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  addTower(x: number, y: number) {
    const cost = this.price(200);
    if (this.gameOver || this.cash < cost || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.cash -= cost;
    this.towers.push({ ...BASE, x, y, tiers: [0, 0, 0], cd: 0, cost, targeting: 'First', shots: 0 }); return true;
  }
  upgrade(towerIdx: number, path: number) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !canUpgrade(t.tiers, path)) return false;
    const cost = this.price(DART_TIERS[path][t.tiers[path]].cost);
    if (this.cash < cost) return false;
    this.cash -= cost; t.cost += cost; t.tiers[path]++; Object.assign(t, dartStats(t.tiers)); return true;
  }
  sell(towerIdx: number) {
    const t = this.towers[towerIdx]; if (this.gameOver || !t) return false;
    this.cash += Math.floor(t.cost * 70 / 100); this.towers.splice(towerIdx, 1); return true;
  }
  cycleTargeting(towerIdx: number) {
    const t = this.towers[towerIdx]; if (t) t.targeting = TARGETING[(TARGETING.indexOf(t.targeting) + 1) % TARGETING.length];
  }
  startRound(groups = roundGroups(this.round + 1)) {
    if (this.gameOver || this.roundActive || !groups.length) return false;
    this.round++; this.roundActive = true; let time = 0;
    for (const g of groups) for (let i = 0; i < g.n; i++) {
      this.spawnQ.push({ at: this.tick + Math.round(time * 60), type: g.type, camo: g.camo, fortified: g.fortified, regrow: g.regrow }); time += g.gap;
    }
    return true;
  }
  private makeBloon(type: string, dist: number, flags: Pick<Bloon, 'camo' | 'fortified' | 'regrow'>): Bloon {
    const def = BLOONS[type];
    const fortified = Boolean(flags.fortified && def.fortifiable);
    return { id: this.nextId++, type, dist, hp: fortified ? def.fortifiedHp : def.hp, fortified, regrow: flags.regrow, camo: flags.camo || type === 'ddt' };
  }
  private canHit(b: Bloon, d: DartStats) {
    return (!(b.camo || b.type === 'ddt') || d.camo) && (!BLOONS[b.type].immunities.includes('sharp') || d.lead);
  }
  // Remaining damage carries through children, charging each destroyed layer only once.
  private damage(b: Bloon, amount: number, d: Dart) {
    if (!this.canHit(b, d)) return;
    if (amount < b.hp) { b.hp -= amount; return; }
    const remaining = amount - b.hp;
    this.cash += BLOONS[b.type].popCash * popCashMultiplier(this.round);
    this.bloons.splice(this.bloons.indexOf(b), 1);
    for (const type of BLOONS[b.type].kids) {
      const child = this.makeBloon(type, b.dist, b); this.bloons.push(child); d.hit.add(child.id);
      if (remaining > 0) this.damage(child, remaining, d);
    }
  }
  step() {
    if (this.gameOver) return;
    this.tick++;
    this.spawnQ = this.spawnQ.filter(s => s.at > this.tick ? true : (this.bloons.push(this.makeBloon(s.type, 0, s)), false));
    for (let i = this.bloons.length - 1; i >= 0; i--) {
      const b = this.bloons[i]; b.dist += BLOONS[b.type].speed * DT;
      if (b.dist >= this.pathLen) {
        const def = BLOONS[b.type]; this.lives = Math.max(0, this.lives - ((b.fortified ? def.fortifiedRbe : def.rbe) - ((b.fortified ? def.fortifiedHp : def.hp) - b.hp)));
        this.bloons.splice(i, 1);
      }
    }
    if (this.gameOver) { this.roundActive = false; return; }
    for (const t of this.towers) {
      t.cd -= DT; if (t.cd > 0) continue;
      const targets = this.bloons.filter(b => (!b.camo || t.camo) && (b.type !== 'ddt' || t.camo) && Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y) <= t.range);
      const distance = (b: Bloon) => Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y);
      targets.sort((a, b) => t.targeting === 'Last' ? a.dist - b.dist : t.targeting === 'Close' ? distance(a) - distance(b) : t.targeting === 'Strong' ? BLOONS[b.type].rbe - BLOONS[a.type].rbe || b.dist - a.dist : b.dist - a.dist);
      if (!targets.length) continue;
      const p = this.posAt(targets[0].dist); t.cd = t.cooldown; t.shots++;
      const angle = Math.atan2(p.y - t.y, p.x - t.x);
      for (let n = 0; n < t.projectiles; n++) {
        const aim = angle + (n - (t.projectiles - 1) / 2) * t.spread * Math.PI / 180;
        const offset = t.projectiles === 2 ? (n === 0 ? -3 : 3) : 0;
        this.darts.push({ ...t, x: t.x - Math.sin(angle) * offset, y: t.y + Math.cos(angle) * offset,
          damage: t.critEvery && t.shots % t.critEvery === 0 ? t.critDamage : t.damage,
          vx: Math.cos(aim) * t.projectileSpeed, vy: Math.sin(aim) * t.projectileSpeed, life: t.lifespan, hit: new Set() });
      }
    }
    for (let j = this.darts.length - 1; j >= 0; j--) {
      const d = this.darts[j]; d.x += d.vx * DT; d.y += d.vy * DT; d.life -= DT;
      for (const b of [...this.bloons]) {
        if (d.pierce <= 0) break;
        if (d.hit.has(b.id) || !this.bloons.includes(b) || !this.canHit(b, d)) continue;
        const p = this.posAt(b.dist);
        if (Math.hypot(p.x - d.x, p.y - d.y) < 10) {
          d.hit.add(b.id); d.pierce--;
          const amount = d.damage + (b.type.includes('ceramic') ? d.ceramicBonus : 0) + (b.fortified ? d.fortifiedBonus : 0) + (b.type === 'lead' ? d.leadBonus : 0);
          if (d.knockback && !['moab', 'bfb', 'zomg', 'ddt', 'bad'].includes(b.type)) b.dist = Math.max(0, b.dist - BLOONS[b.type].speed * DT * (['lead', 'ceramic'].includes(b.type) ? 2 : 4));
          this.damage(b, amount, d);
        }
      }
      if (d.pierce <= 0 || d.life <= 0) this.darts.splice(j, 1);
    }
    if (this.roundActive && !this.spawnQ.length && !this.bloons.length) {
      this.cash += 100 + this.round; this.roundActive = false; this.darts = [];
    }
  }
}
