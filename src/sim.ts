// Fixed-step (60 Hz), deterministic and independent of rendering.
import bloonJson from '../data/wiki/bloons.json';
import roundJson from '../data/wiki/rounds.json';
import modeJson from '../data/wiki/modes.json';
import { TOWERS, canUpgrade, resultingStats, type TowerKind } from './towers';
import { type TowerStats, type Tiers } from './towers/types';
import { buyItem, castSpell, sellFigure } from './hero-extras';
import { HEROES, type HeroKind } from './heroes';
import { newHero, grantXP, roundHero, updateHero, activateHero, cycleHeroTarget, heroTowerWeapon, heroTowerFired, heroLeak, type Hero } from './hero-runtime';
export { canUpgrade } from './towers';
export const DT = 1 / 60;
export interface Rect { x: number; y: number; width: number; height: number }
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
export interface GlueStatus { until: number; next: number; stats: TowerStats; layers: number }
export interface DamageStatus { until: number; next: number; interval: number; damage: number; stats: TowerStats }
export interface Bloon { noChildren?: boolean; trojan?: boolean; cashMult?: number; burn?: DamageStatus; freezeLayers?: number; slowUntil?: number; icicle?: { until: number; next: number; stats: TowerStats }; shardStats?: TowerStats; frozenUntil?: number; stunnedUntil?: number; slow?: number; glue?: GlueStatus; brittleUntil?: number; brittle?: number; id: number; type: string; dist: number; hp: number; camo?: boolean; fortified?: boolean; regrow?: boolean }
export const TARGETING = ['First', 'Last', 'Close', 'Strong'] as const;
export type Targeting = typeof TARGETING[number];
export interface Tower extends Pt, TowerStats { aimAngle: number; targetPoint: Pt; flight: Pt; rotorReady: number; type: TowerKind; tiers: Tiers; cd: number; cost: number; targeting: Targeting; shots: number; abilityReady: number; abilityUntil: number; abilityNext: number; secondaryReady: number; orbitReady: number; blitzRound: number; buffUntil: number }
export interface Dart extends Pt, TowerStats {
  vx: number; vy: number; life: number; hit: Set<number>;
  heavy?: boolean; owner?: Tower; age?: number; lastHit?: Map<number, number>; target?: Pt;
}
export interface Effect extends Pt { radius: number; life: number; kind: string }
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
  bloons: Bloon[] = []; towers: Tower[] = []; darts: Dart[] = []; effects: Effect[] = [];
  cash: number; lives: number; round = 0; tick = 0; nextId = 1; rng = mulberry32(1);
  roundActive = false;
  hero: Hero | null = null;
  private heroPlaced = false;
  private puddles: (Pt & { until: number; next: number; stats: TowerStats })[] = [];
  spawnQ: (Omit<Bloon, 'id' | 'hp' | 'dist'> & { at: number })[] = [];
  private len: number[] = [];
  constructor(public path: Pt[], public difficulty: Difficulty = 'medium', public water: Rect[] = []) {
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
  towerPrice(type: TowerKind, cost: number, point: Pt, tier = 0) {
    const h = this.hero;
    const discount = h?.kind === 'rosalia' && h.level >= 6 && ['ace', 'heli'].includes(type) && Math.hypot(point.x - h.home.x, point.y - h.home.y) <= 60 ? 0.9
      : h?.kind === 'silas' && h.level >= 13 && type === 'ice' && tier === 5 ? 0.75 : 1;
    return this.price(cost * discount);
  }
  canPlace(x: number, y: number, type: TowerKind = 'dart') {
    const r = TOWERS[type].footprint;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < r || y < r || x > 960 - r || y > 540 - r) return false;
    const contained = this.water.some(w => x - r >= w.x && x + r <= w.x + w.width && y - r >= w.y && y + r <= w.y + w.height);
    const overlaps = this.water.some(w => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.width)),
      y - Math.max(w.y, Math.min(y, w.y + w.height))) < r);
    if (TOWERS[type].waterOnly ? !contained : overlaps) return false;
    if (this.hero && Math.hypot(this.hero.x - x, this.hero.y - y) < HEROES[this.hero.kind].footprint + r) return false;
    if (this.towers.some(t => Math.hypot(t.x - x, t.y - y) < TOWERS[t.type].footprint + r)) return false;
    return !this.path.slice(1).some((b, i) => {
      const a = this.path[i], dx = b.x - a.x, dy = b.y - a.y;
      const along = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a.x - along * dx, y - a.y - along * dy) < 20 + r;
    });
  }
  nearestTrack(p: Pt): Pt {
    let best = this.path[0], distance = Infinity;
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1], b = this.path[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < distance) { best = q; distance = d; }
    }
    return { ...best };
  }
  canPlaceHero(x: number, y: number, kind: HeroKind, moving = false) {
    if (!HEROES[kind] || this.gameOver || !moving && this.heroPlaced) return false;
    const def = HEROES[kind], r = def.footprint;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < r || y < r || x > 960 - r || y > 540 - r) return false;
    const contained = this.water.some(w => x - r >= w.x && x + r <= w.x + w.width && y - r >= w.y && y + r <= w.y + w.height);
    const overlaps = this.water.some(w => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.width)), y - Math.max(w.y, Math.min(y, w.y + w.height))) < r);
    if (def.waterOnly ? !contained : !def.amphibious && overlaps) return false;
    if (this.towers.some(t => Math.hypot(t.x - x, t.y - y) < TOWERS[t.type].footprint + r)) return false;
    const p = this.nearestTrack({ x, y });
    return Math.hypot(p.x - x, p.y - y) >= 20 + r;
  }
  placeHero(x: number, y: number, kind: HeroKind) {
    if (!this.canPlaceHero(x, y, kind) || this.cash < HEROES[kind].cost[this.difficulty]) return false;
    const cost = HEROES[kind].cost[this.difficulty]; this.cash -= cost;
    this.hero = newHero(kind, x, y, cost); this.heroPlaced = true; return true;
  }
  buyHeroItem(id: string, point?: Pt, towerIndex?: number) { return buyItem(this, id, point, towerIndex); }
  castHeroSpell(id: string) { return castSpell(this, id); }
  sellHeroFigure() { return sellFigure(this); }
  grantHeroXP(amount: number) { return grantXP(this, amount); }
  activateHero(id: string, point?: Pt, towerIndex?: number) { return activateHero(this, id, point, towerIndex); }
  cycleHeroTargeting() { return cycleHeroTarget(this); }
  heroHit(b: Bloon, stats: TowerStats, origin: Pt) { this.applyHit(b, this.source({ ...stats, ...origin })); }
  heroBurst(p: Pt, radius: number, stats: TowerStats) { this.burst(p, this.source({ ...stats, ...p }), radius); }
  heroDestroy(b: Bloon, cash = true) {
    if (!this.bloons.includes(b)) return;
    this.bloons.splice(this.bloons.indexOf(b), 1);
    if (cash) this.cash += BLOONS[b.type].rbe * popCashMultiplier(this.round);
    this.effect(this.posAt(b.dist), 12, 'hero');
  }
  // Low-level setup API remains compatible; interactive purchases use placeTower.
  addTower(x: number, y: number, type: TowerKind = 'dart') {
    const def = TOWERS[type], cost = this.towerPrice(type, def.cost, { x, y });
    if (this.gameOver || this.cash < cost || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.cash -= cost;
    this.towers.push({ ...def.base, type, x, y, aimAngle: -Math.PI / 2, targetPoint: { x, y: Math.max(0, y - 40) }, flight: { x, y }, rotorReady: 0, tiers: [0, 0, 0], cd: 0, cost, targeting: type === 'ice' || type === 'tack' ? 'Close' : 'First', shots: 0, abilityReady: 0, abilityUntil: 0, abilityNext: 0, secondaryReady: 0, orbitReady: 0, blitzRound: -1, buffUntil: 0 }); return true;
  }
  placeTower(x: number, y: number, type: TowerKind) {
    return this.canPlace(x, y, type) && this.addTower(x, y, type);
  }
  upgrade(towerIdx: number, path: number) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !canUpgrade(t.tiers, path)) return false;
    const cost = this.towerPrice(t.type, TOWERS[t.type].paths[path][t.tiers[path]].cost, t, t.tiers[path] + 1);
    if (this.cash < cost) return false;
    this.cash -= cost; t.cost += cost; t.tiers[path]++;
    const hadAbility = t.ability;
    Object.assign(t, resultingStats(TOWERS[t.type], t.tiers));
    if (t.ability && !hadAbility) t.abilityReady = this.tick + t.ability.initial * 60;
    return true;
  }
  setTarget(towerIdx: number, p: Pt) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !['mortar', 'heli', 'dartling', 'ace'].includes(t.type) ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 960 || p.y < 0 || p.y > 540) return false;
    t.targetPoint = { ...p }; return true;
  }
  activate(towerIdx: number) {
    const t = this.towers[towerIdx], a = t?.ability;
    if (this.gameOver || !t || !a || this.tick < t.abilityReady) return false;
    if (a.kind === 'stub') return false;
    if (a.kind === 'cash') this.cash += a.damage;
    if (a.kind === 'blast') {
      this.burst({ x: 480, y: 270 }, this.source(t, { damage: a.damage, damageType: 'normal', camo: true,
        frozen: true, pierce: a.count, moabBonus: 0, ceramicBonus: 0, fortifiedBonus: 0, leadBonus: 0, camoBonus: t.tiers[1] === 5 ? a.damage : 0, stun: a.duration, moabStun: a.duration }), 2000);
    }
    if (a.kind === 'strike') {
      const target = [...this.bloons].sort((a, b) => BLOONS[b.type].rbe - BLOONS[a.type].rbe)[0];
      if (!target) return false;
      const p = this.posAt(target.dist);
      this.applyHit(target, this.source(t, { damage: a.damage, damageType: 'normal', camo: true, frozen: true, moabBonus: 0 }));
      this.burst(p, this.source(t, { damage: a.pierce, damageType: 'normal', camo: true, frozen: true, pierce: a.count }), 65);
    }
    if (a.kind === 'hook') {
      let hooks = a.count, used = false;
      const targets = this.bloons.filter(b => ['moab', 'bfb', 'ddt', ...(a.count > 1 ? ['zomg'] : [])].includes(b.type) && (!b.camo || t.camo))
        .sort((a, b) => BLOONS[b.type].rbe - BLOONS[a.type].rbe);
      for (const b of targets) {
        const cost = b.type === 'zomg' ? 3 : 1;
        if (cost > hooks) continue;
        hooks -= cost; used = true;
        this.bloons.splice(this.bloons.indexOf(b), 1);
        this.effect(this.posAt(b.dist), 20, 'hook');
        // uncertain: use RBE for total hooked layer cash; pop income tax still applies.
        this.cash += BLOONS[b.type].rbe * popCashMultiplier(this.round) * (a.count > 1 ? 2 : 1);
      }
      if (!used) return false;
    }
    if (a.kind === 'missile') {
      const target = this.bloons.filter(b => this.isMoab(b) && (!(b.camo || b.type === 'ddt') || t.camo))
        .sort((a, b) => BLOONS[b.type].rbe - BLOONS[a.type].rbe)[0];
      if (!target) return false;
      this.applyHit(target, this.source(t, { damage: a.damage, damageType: 'normal', moabBonus: 0 }));
      this.effect(this.posAt(target.dist), 16, 'bomb');
    }
    const energizer = this.towers.some(ally => ally.type === 'sub' && ally.tiers[0] === 5);
    const reactor = this.towers.some(ally => ally.type === 'sub' && ally.tiers[0] >= 4);
    const cooldownMult = energizer ? TOWERS[t.type].waterOnly ? 0.6 : 0.8 : reactor && TOWERS[t.type].waterOnly ? 0.85 : 1;
    t.abilityReady = this.tick + a.cooldown * cooldownMult * 60;
    t.abilityUntil = this.tick + a.duration * 60; t.abilityNext = this.tick;
    if (a.kind === 'snow' && t.tiers[1] === 5) {
      for (const ally of this.towers) if (ally.type === 'ice') ally.buffUntil = this.tick + 600;
    }
    if (a.kind === 'snow' || a.kind === 'glue') this.globalAbility(t);
    return true;
  }
  private source(t: TowerStats & Pt, stats: Partial<TowerStats> = {}): Dart {
    return { ...t, ...stats, vx: 0, vy: 0, life: 0, hit: new Set() };
  }
  private globalAbility(t: Tower) {
    if (t.ability?.kind === 'glue') {
      const d = this.source(t, { camo: true, moabTargetable: true, brittle: 2, brittleDuration: 11, glueLayers: 6 });
      this.burst(t, { ...d, pierce: 1e6 }, 2000);
    } else if (t.ability?.kind === 'snow') {
      const d = this.source(t, { camo: true, moabTargetable: true, damageType: 'normal', damage: 1, freezeDuration: 0, frozen: true });
      for (const b of [...this.bloons]) {
        this.applyHit(b, d);
        if (b.type !== 'bad') {
          if (this.isMoab(b)) { b.slow = 0.5; b.slowUntil = this.tick + t.ability.duration * 60; }
          else b.stunnedUntil = this.tick + (BLOONS[b.type].immunities.includes('freeze') && t.tiers[1] < 5 ? 0.5 : t.ability.duration) * 60;
        }
      }
    }
  }
  private runAbility(t: Tower) {
    if (!t.ability || this.tick >= t.abilityUntil || this.tick < t.abilityNext) return;
    if (t.ability.kind === 'glue' && t.tiers[1] === 5) {
      this.globalAbility(t); t.abilityNext = this.tick + 60;
    }
    if (t.ability.kind === 'awe') {
      this.burst({ x: 480, y: 270 }, this.source(t, { damage: t.ability.damage, damageType: 'normal',
        camo: true, frozen: true, pierce: 1e6, moabBonus: 0, ceramicBonus: 0, fortifiedBonus: 0, leadBonus: 0, stun: 1.1, moabStun: 1.1 }), 2000);
      t.abilityNext = this.tick + 60;
    }
    if (t.ability.kind === 'blades') {
      const a = t.ability;
      for (let n = 0; n < a.count; n++) {
        const angle = this.tick * 0.3 + n * 2 * Math.PI / a.count;
        this.darts.push({ ...this.source(t), kind: 'projectile', damage: a.damage, pierce: a.pierce, radius: 0,
          ceramicBonus: t.tiers[1] === 5 ? 8 : 0, life: 3, vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200 });
      }
      t.abilityNext = this.tick + 3;
    }
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
  private isMoab(b: Bloon) { return ['moab', 'bfb', 'zomg', 'ddt', 'bad'].includes(b.type); }
  private canHit(b: Bloon, d: TowerStats) {
    if ((b.camo || b.type === 'ddt') && !d.camo) return false;
    if (this.isMoab(b) && !d.moabTargetable) return false;
    const h = this.hero;
    const blackVulnerable = h?.kind === 'striker' && h.level >= 5 && (h.level >= 19 || (b.id + Math.floor(this.tick / 60)) % 2 === 0);
    const whiteVulnerable = h?.kind === 'silas' && h.level >= 5 && (h.level >= 13 || (b.id + Math.floor(this.tick / 60)) % 2 === 0);
    const immune = BLOONS[b.type].immunities.filter(immunity => !(blackVulnerable && immunity === 'explosion') && !(whiteVulnerable && ['freeze', 'cold(most ice)', 'cold'].includes(immunity)));
    const purpleVulnerable = h?.kind === 'ezili' && (h.until.heartstopper ?? 0) > this.tick;
    if ((d.damageType === 'energy' || d.damageType === 'plasma') && b.type === 'purple' && !purpleVulnerable) return false;
    const brittle = (b.brittleUntil ?? 0) > this.tick;
    if ((b.frozenUntil ?? 0) > this.tick && !d.frozen && !d.refreeze && !brittle) return false;
    if (d.damageType === 'cold' && immune.includes('freeze')) return false;
    if (d.damageType === 'cold' && immune.includes('cold(most ice)') && !d.lead && !brittle) return false;
    if ((d.damageType === 'sharp' || d.damageType === 'shatter') && immune.includes(d.damageType) && !d.lead && !brittle) return false;
    return purpleVulnerable && b.type === 'purple' || !immune.includes(d.damageType) || (d.damageType === 'sharp' || d.damageType === 'shatter') && (d.lead || brittle);
  }
  private effect(p: Pt, radius: number, kind: string) {
    this.effects.push({ ...p, radius, kind, life: 0.2 });
  }
  private applyHit(b: Bloon, d: Dart) {
    if (!this.canHit(b, d) || !this.bloons.includes(b)) return;
    const moab = this.isMoab(b);
    const vulnerability = (b.brittleUntil ?? 0) > this.tick ? b.brittle ?? 0 : 0;
    if (d.strip) { b.camo = false; b.regrow = false; }
    if (d.brittle) { b.brittle = d.brittle; b.brittleUntil = this.tick + d.brittleDuration * 60; }
    if (b.type !== 'bad') {
      const stun = moab ? d.moabStun : d.kind === 'glue' ? 0 : d.stun;
      if (stun) b.stunnedUntil = this.tick + stun * 60;
      if (!moab && d.freezeDuration && (!BLOONS[b.type].immunities.includes('freeze') || this.hero?.kind === 'silas' && this.hero.level >= 13)) {
        b.freezeLayers = d.freezeLayers; b.frozenUntil = this.tick + d.freezeDuration * (b.type.includes('ceramic') && d.auraSlow === 1 ? 0.5 : 1) * 60;
      }
      if (moab && d.moabSlow < 1 && d.kind !== 'glue') b.slow = d.moabSlow;
      if (d.afterSlow < 1) b.slow = d.afterSlow;
      if (d.knockback && (!moab || d.kind === 'boomerang' || d.moabStun)) b.dist = Math.max(0, b.dist - (moab ? 5 : 20));
    }
    if (d.impale && moab && b.type !== 'bad') {
      b.slow = (b.type === 'zomg' ? 2.25 : 5) / BLOONS[b.type].speed;
      b.slowUntil = this.tick + d.freezeDuration * 60;
    }
    if (d.icicles && this.rng() < 0.25) b.icicle = { until: this.tick + d.freezeDuration * 60, next: this.tick + 12, stats: { ...d } };
    if (d.defortify && b.fortified && (['lead', 'ceramic', 'moab', 'bfb'].includes(b.type) || d.burnMoab >= 100 && b.type === 'ddt')) {
      b.fortified = false; b.hp = Math.min(b.hp, BLOONS[b.type].hp);
    }
    if (d.burnDamage) b.burn = { until: this.tick + d.burnDuration * 60,
      next: b.burn?.next ?? this.tick + d.burnInterval * 60, interval: d.burnInterval * 60,
      damage: d.burnDamage + (moab ? d.burnMoab : 0), stats: { ...d, damageType: 'fire', frozen: true } };
    if (d.shards) b.shardStats = { ...d };
    if (d.orbit && moab && !b.burn) {
      b.burn = { until: this.tick + 600, next: this.tick + 60, interval: 60, damage: 100, stats: { ...d, damageType: 'normal', frozen: true } };
    }
    if (d.kind === 'glue' && (!b.glue || b.glue.stats.glueLevel <= d.glueLevel)) {
      b.glue = { until: this.tick + (moab ? d.moabDuration || d.glueDuration : d.glueDuration) * 60,
        next: b.glue ? Math.min(b.glue.next, this.tick + d.dotInterval * 60) : this.tick + d.dotInterval * 60, stats: { ...d }, layers: d.glueLayers };
    }
    const amount = d.damage + (moab ? d.moabBonus : 0) + (b.type.includes('ceramic') ? d.ceramicBonus : 0) +
      (b.fortified ? d.fortifiedBonus : 0) + (b.type === 'lead' ? d.leadBonus : 0) +
      vulnerability + (b.camo ? d.camoBonus : 0);
    if (amount > 0) this.damage(b, amount, { ...d, frozen: true });
  }
  private burst(p: Pt, d: Dart, radius: number) {
    this.effect(p, radius, d.kind);
    let pierce = d.pierce;
    for (const b of [...this.bloons]) {
      if (pierce <= 0) break;
      const bp = this.posAt(b.dist);
      if (!d.hit.has(b.id) && Math.hypot(bp.x - p.x, bp.y - p.y) <= radius + 7 && this.canHit(b, d)) {
        d.hit.add(b.id); this.applyHit(b, d); pierce--;
      }
    }
  }
  private fire(t: Tower, p: Pt) {
    if (t.type === 'sniper') {
      let point = p;
      const hit = new Set<number>();
      for (let n = 0; n < t.pierce; n++) {
        const b = this.bloons.find(b => !hit.has(b.id) && this.canHit(b, t) && Math.hypot(this.posAt(b.dist).x - point.x, this.posAt(b.dist).y - point.y) < (n ? t.bounceRange : 1));
        if (!b) break;
        point = this.posAt(b.dist); hit.add(b.id);
        this.applyHit(b, { ...this.source(t), owner: t }); this.effect(point, 3, 'sniper');
        if (t.shards) this.shards(b, { ...t, shards: 5 });
        if (!t.bounceRange) break;
      }
      return;
    }
    if (t.type === 'mortar') {
      // uncertain: mortar flight time is unspecified; resolve impact immediately with seeded scatter.
      const angle = this.rng() * Math.PI * 2, distance = Math.sqrt(this.rng()) * t.impactSpread;
      p = { x: p.x + Math.cos(angle) * distance, y: p.y + Math.sin(angle) * distance };
      this.burst(p, this.source(t), t.radius);
      if (t.puddleDamage) this.puddles.push({ ...p, until: this.tick + 270, next: this.tick, stats: { ...t } });
      return;
    }
    if (t.kind === 'ice' || t.kind === 'ring') {
      this.burst(t, { ...t, vx: 0, vy: 0, life: 0, hit: new Set() }, t.range); return;
    }
    const angle = t.type === 'dartling' ? t.aimAngle : Math.atan2(p.y - t.y, p.x - t.x);
    for (let n = 0; n < t.projectiles; n++) {
      const aim = t.kind === 'tack' || t.radial ? n * Math.PI * 2 / t.projectiles : angle + (n - (t.projectiles - 1) / 2) * t.spread * Math.PI / 180 + (t.accuracy ? (this.rng() - 0.5) * t.accuracy * Math.PI / 180 : 0);
      const offset = t.projectiles === 2 ? (n === 0 ? -3 : 3) : 0;
      this.darts.push({ ...t, x: t.x - Math.sin(angle) * offset, y: t.y + Math.cos(angle) * offset,
        damage: t.critEvery && t.shots % t.critEvery === 0 ? t.critDamage : t.damage,
        vx: Math.cos(aim) * t.projectileSpeed, vy: Math.sin(aim) * t.projectileSpeed, life: t.lifespan,
        hit: new Set(), owner: t, age: 0, lastHit: new Map(), target: p });
    }
  }
  // Remaining damage carries through children, charging each destroyed layer only once.
  private damage(b: Bloon, amount: number, d: Dart) {
    if (!this.canHit(b, d)) return;
    if (amount < b.hp) { b.hp -= amount; return; }
    const remaining = amount - b.hp;
    this.cash += BLOONS[b.type].popCash * popCashMultiplier(this.round) * (b.cashMult ?? 1);
    if (b.trojan) {
      let layers = 0, type = b.type;
      while (BLOONS[type].kids.length) { layers++; type = BLOONS[type].kids[0]; }
      this.cash += (this.hero?.level ?? 0) >= 16 ? 3 + 2 * layers : 2 + layers;
    }
    this.bloons.splice(this.bloons.indexOf(b), 1);
    if (b.shardStats && d.owner?.type !== 'sniper') this.shards(b, b.shardStats);
    if (!BLOONS[b.type].kids.length && b.glue?.stats.puddleDamage) {
      const p = this.posAt(b.dist);
      this.puddles.push({ ...p, until: this.tick + 7.7 * 60, next: this.tick, stats: b.glue.stats });
    }
    if (b.glue?.stats.stun) {
      const stats = b.glue.stats, p = this.posAt(b.dist);
      let pierce = stats.pierce >= 6 ? 11 : 6;
      for (const other of this.bloons) {
        if (pierce <= 0) break;
        if (other.type !== 'bad' && Math.hypot(this.posAt(other.dist).x - p.x, this.posAt(other.dist).y - p.y) <= 12) {
          other.stunnedUntil = this.tick + (this.isMoab(other) ? other.type === 'ddt' ? 0.2 : 0.25 : 1) * 60; pierce--;
        }
      }
    }
    for (const type of b.noChildren ? [] : BLOONS[b.type].kids) {
      const child = this.makeBloon(type, b.dist, b); child.cashMult = b.cashMult;
      if (b.glue && b.glue.layers > 1 && !this.isMoab(child)) child.glue = { ...b.glue, layers: b.glue.layers - 1 };
      if ((b.freezeLayers ?? 0) > 1 && !BLOONS[child.type].immunities.includes('freeze')) {
        child.freezeLayers = b.freezeLayers! - 1; child.frozenUntil = b.frozenUntil; child.slow = b.slow;
      }
      if (b.shardStats && b.shardStats.soak > 1) child.shardStats = { ...b.shardStats, soak: b.shardStats.soak - 1 };
      this.bloons.push(child); d.hit.add(child.id);
      if (remaining > 0) this.damage(child, remaining, d);
    }
  }
  private shards(b: Bloon, stats: TowerStats) {
    const p = this.posAt(b.dist);
    for (let n = 0; n < stats.shards; n++) {
      const angle = n * 2 * Math.PI / stats.shards;
      this.darts.push({ ...this.source({ ...stats, ...p }), kind: 'projectile', damageType: 'shatter',
        damage: stats.shardDamage, pierce: stats.shardPierce, radius: 0, freezeDuration: 0, shards: 0, life: 0.3,
        hit: new Set([b.id]), vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200 });
    }
  }
  private secondary(t: Tower) {
    if (t.orbit && this.tick >= t.orbitReady) {
      t.orbitReady = this.tick + 3;
      this.burst(t, this.source(t, { kind: 'ring', damageType: 'normal', camo: true, frozen: true, damage: 4, ceramicBonus: 4, pierce: 200 }), t.orbit);
    }
    if (!t.secondaryCooldown || this.tick < t.secondaryReady) return;
    const target = this.bloons.find(b => this.canHit(b, t) && (t.meteor || this.isMoab(b)) &&
      (t.meteor || Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y) <= t.range));
    if (!target) return;
    t.secondaryReady = this.tick + t.secondaryCooldown * 60;
    if (t.meteor && ['sub', 'ace', 'heli', 'buccaneer'].includes(t.type)) {
      // uncertain: consolidate auxiliary missiles/aircraft into one periodic blast;
      // omitted projectile travel and separate weapon targeting use the shared target above.
      const normal = t.type === 'ace' && t.tiers[0] === 5;
      this.burst(this.posAt(target.dist), this.source(t, { kind: 'bomb', damage: t.meteor,
        damageType: normal ? 'normal' : 'explosion', pierce: 40, moabBonus: 0, ceramicBonus: 0,
        radius: 0, shards: 0, rotor: 0 }), 35);
    } else if (t.meteor) {
      this.applyHit(target, this.source(t, { kind: 'projectile', damageType: 'normal', damage: t.meteor, moabBonus: 0 }));
      // uncertain: meteor blast radius/pierce are unspecified; use 30 units and 30 targets.
      this.burst(this.posAt(target.dist), this.source(t, { damage: 5, damageType: 'explosion', pierce: 30 }), 30);
    } else {
      const p = this.posAt(target.dist), angle = Math.atan2(p.y - t.y, p.x - t.x);
      this.darts.push({ ...this.source(t), kind: 'boomerang', heavy: true, owner: t, age: 0,
        damage: t.damage, moabBonus: t.heavyDamage, knockback: true, moabStun: t.tiers[2] === 5 ? 0.25 : 0, pierce: t.heavyPierce + (t.tiers[0] ? 100 : 0),
        lastHit: new Map(), rehit: 0.1, vx: Math.cos(angle) * t.projectileSpeed, vy: Math.sin(angle) * t.projectileSpeed, life: 1 });
    }
  }
  private bombChildren(p: Pt, d: Dart) {
    if (d.frags) {
      const top = d.owner?.tiers[0] ?? 0, middle = d.owner?.tiers[1] ?? 0;
      const count = top >= 4 ? 16 : top === 3 ? 12 : d.frags;
      for (let n = 0; n < count; n++) {
        const angle = n * 2 * Math.PI / count;
        this.darts.push({ ...d, ...p, kind: 'projectile', damageType: top === 5 ? 'normal' : 'sharp',
          damage: top === 5 ? 36 : top >= 3 ? 6 : 1, pierce: top === 5 ? 21 : top >= 3 ? top : 2,
          lead: top === 5, frozen: top === 5, moabBonus: middle === 5 ? 29 : middle === 4 ? 9 : middle === 3 ? 4 : 0, radius: 0,
          vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200, life: 0.2, hit: new Set(d.hit) });
      }
    }
    for (let n = 0; n < d.clusters; n++) {
      const angle = n * 2 * Math.PI / d.clusters;
      const center = { x: p.x + Math.cos(angle) * 15, y: p.y + Math.sin(angle) * 15 };
      this.burst(center, { ...d, pierce: 8, hit: new Set(d.hit) }, 15);
      if (d.recursive && d.owner && d.owner.shots % d.recursive === 0) {
        this.burst(center, { ...d, damage: Math.max(2, d.damage), pierce: 32, hit: new Set() }, 30);
      }
    }
  }
  private spawn(s: Omit<Bloon, 'id' | 'hp' | 'dist'>) {
    const h = this.hero;
    if (h?.kind === 'benjamin' && h.level >= 6) this.cash += h.level >= 12 ? 2 : 1;
    let type = s.type;
    if (h?.kind === 'benjamin' && (h.until.syphon ?? 0) > this.tick && !['bad', ...(h.level < 18 ? ['ddt'] : [])].includes(type)) type = BLOONS[type].kids[0] ?? type;
    const b = this.makeBloon(type, 0, s);
    if (h?.kind === 'benjamin' && (h.until.syphon ?? 0) > this.tick && type !== s.type) b.cashMult = h.level === 20 ? 3 : 2;
    this.bloons.push(b);
    if (this.isMoab(b)) for (const t of this.towers) if (t.entryDamage) {
      this.applyHit(b, this.source(t, { damage: t.entryDamage, damageType: 'normal', camo: true, frozen: true, moabBonus: 0 }));
    }
  }
  private moveAircraft(t: Tower) {
    if (t.type === 'ace') {
      // uncertain: default orbit radius is absent; use the documented Centered Path radius.
      const center = t.tiers[2] >= 2 ? t.targetPoint : t;
      const angle = this.tick * DT * t.moveSpeed / 90;
      t.flight = { x: Math.max(0, Math.min(960, center.x + Math.cos(angle) * 90)),
        y: Math.max(0, Math.min(540, center.y + Math.sin(angle) * 90)) };
    } else if (t.type === 'heli') {
      const first = [...this.bloons].sort((a, b) => b.dist - a.dist)[0];
      const p = t.pursuit && first ? this.posAt(first.dist) : t.targetPoint;
      const dx = p.x - t.flight.x, dy = p.y - t.flight.y, distance = Math.hypot(dx, dy);
      const amount = Math.min(distance, t.moveSpeed * DT);
      if (distance) { t.flight.x += dx / distance * amount; t.flight.y += dy / distance * amount; }
    }
  }
  step() {
    if (this.gameOver) return;
    this.tick++;
    this.effects = this.effects.filter(e => (e.life -= DT) > 0);
    this.puddles = this.puddles.filter(p => p.until > this.tick);
    for (const p of this.puddles) if (this.tick >= p.next) {
      p.next = this.tick + 6;
      this.burst(p, this.source({ ...p.stats, ...p }, { kind: 'projectile', damage: p.stats.puddleDamage, pierce: 3 }), 12);
    }
    this.spawnQ = this.spawnQ.filter(s => s.at > this.tick ? true : (this.spawn(s), false));
    for (const b of [...this.bloons]) {
      if (!this.bloons.includes(b)) continue;
      if (b.slowUntil !== undefined && b.slowUntil <= this.tick) { b.slow = undefined; b.slowUntil = undefined; }
      if (b.icicle && b.icicle.until > this.tick && b.icicle.next <= this.tick) {
        b.icicle.next = this.tick + 12;
        // uncertain: prose omits the attached icicle's radius; use 12 units.
        this.burst(this.posAt(b.dist), { ...this.source({ ...b.icicle.stats, ...this.posAt(b.dist) },
          { damageType: 'shatter', kind: 'projectile', damage: 6, pierce: 6, radius: 0, icicles: false, freezeDuration: 0, moabBonus: 0 }), hit: new Set([b.id]) }, 12);
        if (!this.bloons.includes(b)) continue;
      }
      if (b.burn && b.burn.until > this.tick && b.burn.next <= this.tick) {
        b.burn.next += b.burn.interval;
        this.damage(b, b.burn.damage, this.source({ ...b.burn.stats, ...this.posAt(b.dist) }));
        if (!this.bloons.includes(b)) continue;
      }
      if (b.glue && b.glue.until <= this.tick) b.glue = undefined;
      if (b.glue && (b.glue.stats.dotDamage || this.isMoab(b) && b.glue.stats.dotMoabBonus) && b.glue.next <= this.tick) {
        const stats = b.glue.stats;
        b.glue.next += stats.dotInterval * 60;
        const damage = stats.dotDamage + (b.type.includes('ceramic') ? stats.dotCeramicBonus : 0) + (this.isMoab(b) ? stats.dotMoabBonus : 0);
        this.damage(b, damage, { ...stats, ...this.posAt(b.dist), kind: 'projectile', damageType: 'acid', vx: 0, vy: 0, life: 0, hit: new Set() });
        if (!this.bloons.includes(b)) continue;
      }
      let slow = b.slow ?? 1;
      const hero = this.hero;
      if (hero?.kind === 'silas' && !['white', 'purple', 'zebra', 'bad'].includes(b.type) && Math.hypot(this.posAt(b.dist).x - hero.x, this.posAt(b.dist).y - hero.y) <= hero.stats.range) slow = Math.min(slow, this.isMoab(b) ? hero.stats.moabSlow : hero.stats.auraSlow);
      if (b.glue) slow = Math.min(slow, this.isMoab(b) ? b.glue.stats.moabSlow : b.glue.stats.slow);
      for (const t of this.towers) {
        if (t.auraSlow < 1 && this.canHit(b, t) && Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y) <= t.range) slow = Math.min(slow, this.isMoab(b) ? t.moabSlow : t.auraSlow);
      }
      b.dist += BLOONS[b.type].speed * DT * (b.type === 'bad' ? 1 : Math.max(b.frozenUntil ?? 0, b.stunnedUntil ?? 0) > this.tick ? 0 : slow);
      if (b.dist >= this.pathLen) {
        const blitz = this.towers.find(t => t.type === 'bomb' && t.tiers[2] === 5 && t.blitzRound !== this.round);
        if (blitz) {
          blitz.blitzRound = this.round;
          // uncertain: the passive's exact damage is absent; 2000 matches 'all but biggest'.
          this.burst(blitz, this.source(blitz, { damageType: 'normal', camo: true, damage: 2000, pierce: 1e6 }), 2000);
          if (!this.bloons.includes(b)) continue;
        }
        const def = BLOONS[b.type];
        const leak = heroLeak(this, b, (b.fortified ? def.fortifiedRbe : def.rbe) - ((b.fortified ? def.fortifiedHp : def.hp) - b.hp));
        if (leak < 0) continue;
        this.lives = Math.max(0, this.lives - leak);
        for (const t of this.towers) if (t.type === 'sniper' && t.tiers[2] === 5 && this.tick >= t.abilityReady) {
          t.buffUntil = this.tick + 420; t.abilityReady = this.tick + 600;
        }
        this.bloons.splice(this.bloons.indexOf(b), 1);
      }
    }
    if (this.gameOver) { this.roundActive = false; return; }
    updateHero(this);
    for (const t of this.towers) {
      this.moveAircraft(t);
      if (t.type === 'dartling') {
        const desired = Math.atan2(t.targetPoint.y - t.y, t.targetPoint.x - t.x);
        const delta = Math.atan2(Math.sin(desired - t.aimAngle), Math.cos(desired - t.aimAngle));
        const turn = t.rotationSpeed * Math.PI / 180 * DT;
        t.aimAngle += Math.max(-turn, Math.min(turn, delta));
      }
      const origin = t.type === 'ace' || t.type === 'heli' ? t.flight : t;
      const weapon = { ...heroTowerWeapon(this, t), x: origin.x, y: origin.y };
      if (t.type === 'sub' && t.tiers[2] !== 5 && this.towers.some(ally => ally.type === 'sub' && ally.tiers[2] === 5 && Math.hypot(t.x - ally.x, t.y - ally.y) <= ally.range)) {
        weapon.damage *= 2; weapon.moabBonus *= 2; weapon.fortifiedBonus *= 2; weapon.pierce += 4;
      }
      if (t.type === 'buccaneer' && t.tiers[2] >= 3) weapon.damage *= this.cash >= 50000 && t.tiers[2] >= 4 ? 3 : this.cash >= 10000 ? 2 : 1;
      this.runAbility(t); this.secondary(weapon);
      if (t.type === 'sub' && t.tiers[0] >= 3 && this.tick >= weapon.orbitReady) {
        weapon.orbitReady = this.tick + 81;
        this.burst(origin, this.source(weapon, { damage: 0, moabBonus: 0, ceramicBonus: 0,
          damageType: 'normal', strip: true, camo: true, pierce: 100 }), t.range);
      }
      // Secondary timer state belongs to the stationary placement, not the transient weapon origin.
      t.secondaryReady = weapon.secondaryReady; t.orbitReady = weapon.orbitReady;
      if (t.rotor && this.tick >= t.rotorReady) {
        t.rotorReady = this.tick + 27;
        this.burst(origin, this.source(weapon, { damage: t.rotor, damageType: 'normal', pierce: 10, frozen: true }), 35);
      }
      if (weapon.cooldown >= 1e8) { t.cd = Math.min(t.cd, DT); continue; }
      t.cd -= DT; if (t.cd > 0) continue;
      // Range intersects the bloon body (7 units), so short-range towers can reach from grass.
      const detected = (b: Bloon) => !(b.camo || b.type === 'ddt') || weapon.camo || t.intel && this.towers.some(ally => ally.camo && Math.hypot(this.posAt(b.dist).x - ally.x, this.posAt(b.dist).y - ally.y) <= ally.range);
      const targets = this.bloons.filter(b => detected(b) && (Math.hypot(this.posAt(b.dist).x - origin.x, this.posAt(b.dist).y - origin.y) <= weapon.range + 7 ||
        t.intel && this.towers.some(ally => Math.hypot(this.posAt(b.dist).x - ally.x, this.posAt(b.dist).y - ally.y) <= ally.range && (!b.camo || ally.camo))));
      const distance = (b: Bloon) => Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y);
      targets.sort((a, b) => t.targeting === 'Last' ? a.dist - b.dist : t.targeting === 'Close' ? distance(a) - distance(b) : t.targeting === 'Strong' ? BLOONS[b.type].rbe - BLOONS[a.type].rbe || b.dist - a.dist : b.dist - a.dist);
      const manual = t.type === 'mortar' || t.type === 'dartling';
      if (!targets.length && !manual && t.type !== 'ace') continue;
      const p = manual ? weapon.targetPoint : targets.length ? this.posAt(targets[0].dist) : t.targetPoint; t.cd = weapon.cooldown / (this.tick < t.buffUntil ? t.type === 'sniper' ? 4 : 1.5 : 1)
        * ((TOWERS[t.type].waterOnly || t.type === 'ace') && this.towers.some(ally => ally.type === 'buccaneer' && ally.tiers[0] === 5) ? 0.8 : 1)
        / (t.type === 'sniper' && t.tiers[2] === 5 ? 1 + Math.max(0, ...this.bloons.map(b => b.dist / this.pathLen)) : 1) / (this.tick < t.abilityUntil && t.ability?.kind === 'boost' ? t.ability.speed : 1); t.shots++;
      if (t.intel && targets[0] && detected(targets[0])) weapon.camo = true;
      const active = this.tick < t.abilityUntil && t.ability?.kind === 'boost';
      if (active && t.type === 'mortar') weapon.radius *= 1.15;
      heroTowerFired(this, t);
      this.fire({ ...weapon, shots: t.shots, damage: weapon.damage + (active ? t.ability!.damage : 0) }, p);
      if (t.globalFreeze) {
        this.burst(t, this.source(t, { kind: 'ice', pierce: 1e6, freezeDuration: t.globalFreeze, damage: 1, ceramicBonus: 3, moabTargetable: false }), 2000);
      }
    }
    for (let j = this.darts.length - 1; j >= 0; j--) {
      const d = this.darts[j]; d.age = (d.age ?? 0) + DT;
      const previous = { x: d.x, y: d.y };
      if (d.homing) {
        const target = this.bloons.find(b => !d.hit.has(b.id) && this.canHit(b, d));
        if (target) {
          const p = this.posAt(target.dist), angle = Math.atan2(p.y - d.y, p.x - d.x);
          d.vx = Math.cos(angle) * d.projectileSpeed; d.vy = Math.sin(angle) * d.projectileSpeed;
        }
      }
      if (d.kind === 'boomerang' && d.owner) {
        // The returning leg homes to its origin; per-target timers allow repeated Kylie hits.
        const returning = d.age > Math.min(d.lifespan / 2, d.range / d.projectileSpeed);
        if (returning && !d.bounceRange) {
          const angle = Math.atan2(d.owner.y - d.y, d.owner.x - d.x);
          d.vx = Math.cos(angle) * d.projectileSpeed; d.vy = Math.sin(angle) * d.projectileSpeed;
          if (Math.hypot(d.x - d.owner.x, d.y - d.owner.y) < 4) d.life = 0;
        }
      }
      d.x += d.vx * DT; d.y += d.vy * DT; d.life -= DT;
      let detonated = false;
      for (const b of [...this.bloons]) {
        if (d.pierce <= 0) break;
        const repeat = d.kind === 'boomerang' && this.tick - (d.lastHit?.get(b.id) ?? -Infinity) >= d.rehit * 60;
        if ((!repeat && d.hit.has(b.id)) || !this.bloons.includes(b)) continue;
        const p = this.posAt(b.dist), dx = d.x - previous.x, dy = d.y - previous.y;
        const along = Math.max(0, Math.min(1, ((p.x - previous.x) * dx + (p.y - previous.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(p.x - previous.x - dx * along, p.y - previous.y - dy * along) >= 10) continue;
        if (d.kind === 'bomb' || d.radius > 0 && d.kind !== 'boomerang') {
          if ((b.camo || b.type === 'ddt') && !d.camo) continue;
          this.burst(p, d, d.radius); detonated = true;
          if (d.kind === 'bomb') this.bombChildren(p, d);
          break;
        }
        if (!this.canHit(b, d)) continue;
        d.hit.add(b.id); d.lastHit?.set(b.id, this.tick); d.pierce--;
        this.applyHit(b, d);
        if (d.bounceRange) {
          const next = this.bloons.find(other => !d.hit.has(other.id) && this.canHit(other, d) &&
            Math.hypot(this.posAt(other.dist).x - d.x, this.posAt(other.dist).y - d.y) <= d.bounceRange);
          if (next) {
            const point = this.posAt(next.dist), angle = Math.atan2(point.y - d.y, point.x - d.x);
            d.vx = Math.cos(angle) * d.projectileSpeed; d.vy = Math.sin(angle) * d.projectileSpeed;
          }
        }
      }
      if (d.kind === 'bomb' && !detonated && d.target && Math.hypot(d.x - d.target.x, d.y - d.target.y) < 4) {
        this.burst(d.target, d, d.radius); this.bombChildren(d.target, d); detonated = true;
      }
      if (d.heavy && d.heavyRadius && (d.life <= 0 || d.pierce <= 0)) {
        this.burst(d, { ...d, kind: 'bomb', damageType: 'explosion', damage: 100, pierce: 40, hit: new Set() }, d.heavyRadius);
        for (const b of this.bloons) {
          if (Math.hypot(this.posAt(b.dist).x - d.x, this.posAt(b.dist).y - d.y) <= d.heavyRadius && this.canHit(b, d)) {
            b.burn = { until: this.tick + 240, next: this.tick + 60, interval: 60, damage: d.heavyBurn, stats: { ...d, damageType: 'normal', frozen: true } };
          }
        }
      }
      if (detonated || d.pierce <= 0 || d.life <= 0) this.darts.splice(j, 1);
    }
    if (this.roundActive && !this.spawnQ.length && !this.bloons.length) {
      roundHero(this);
      this.cash += 100 + this.round + this.towers.reduce((sum, t) => sum + t.income, 0); this.roundActive = false; this.darts = [];
    }
  }
}
