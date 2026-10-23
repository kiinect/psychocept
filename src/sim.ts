import { PARAGONS } from './towers/paragons';
// Fixed-step (60 Hz), deterministic and independent of rendering.
import bloonJson from '../data/wiki/bloons.json';
import roundJson from '../data/wiki/rounds.json';
import modeJson from '../data/wiki/modes.json';
import { TOWERS, canUpgrade, resultingStats, type TowerKind } from './towers';
import { type TowerStats, type Tiers } from './towers/types';
import { endlessGroups } from './modes/endless';
import { POWER_BY_ID } from './meta/powers';
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
export const roundGroups = (r: number): SpawnGroup[] => (ROUNDS[r - 1]?.groups ?? endlessGroups(r, ROUNDS)).map(g => ({ ...g, n: g.count, gap: typeof SPACING[g.type] === 'number' ? SPACING[g.type] as number : 0.5 }));
export interface GlueStatus { until: number; next: number; stats: TowerStats; layers: number }
export interface DamageStatus { until: number; next: number; interval: number; damage: number; stats: TowerStats }
export interface Bloon { goldUntil?: number; concoction?: TowerStats; stickyUntil?: number; noChildren?: boolean; trojan?: boolean; cashMult?: number; burn?: DamageStatus; freezeLayers?: number; slowUntil?: number; icicle?: { until: number; next: number; stats: TowerStats }; shardStats?: TowerStats; frozenUntil?: number; stunnedUntil?: number; slow?: number; glue?: GlueStatus; brittleUntil?: number; brittle?: number; id: number; type: string; dist: number; hp: number; camo?: boolean; fortified?: boolean; regrow?: boolean; lane?: number; regrowMax?: string; regrowAt?: number; spd?: number }
export const TARGETING = ['First', 'Last', 'Close', 'Strong'] as const;
export type Targeting = typeof TARGETING[number];
export interface Tower extends Pt, TowerStats { farmAccounted?: number; farmCreated?: number; farmNext?: number; bank?: number; debt?: number; ultra?: number; overclockUntil?: number; supportTarget?: Tower; mergedInto?: Tower; merges?: Tower[]; degree?: number; paragonPops?: number; opolisIncome?: number; freeDarts?: number; roundUses?: number; magicNext?: Record<string, number>; magicActs?: number; graveyard?: number; abilityUses?: number; purchaseLives?: number; oakLives?: number; wrathDamage?: number; lastDamage?: number; blackHoleUntil?: number; blackHoleReady?: number; blackHoleUses?: number; brew?: { source: Tower; until: number; shots: number; level: number }; dip?: { source: Tower; shots: number }; transformedUntil?: number;  aimAngle: number; targetPoint: Pt; flight: Pt; rotorReady: number; type: TowerKind; tiers: Tiers; cd: number; cost: number; targeting: Targeting; shots: number; abilityReady: number; abilityUntil: number; abilityNext: number; secondaryReady: number; orbitReady: number; blitzRound: number; buffUntil: number }
export interface Collectible extends Pt { owner:Tower; value:number; until:number }
export interface RoadItem { owner:Tower; dist:number; until:number; round:number; carry:number; pierce:number; stats:TowerStats; kind: 'spike' | 'foam' | 'trap'; stored:number; lane:number; fragment?:boolean; hit:Set<number> }
export interface Sentry extends Pt { owner:Tower; until:number; next:number; stats:TowerStats; variant:number }
export interface Dart extends Pt, TowerStats {
  vx: number; vy: number; life: number; hit: Set<number>;
  heavy?: boolean; owner?: Tower; age?: number; lastHit?: Map<number, number>; target?: Pt;
}
export interface Effect extends Pt { radius: number; life: number; kind: string }
export type Difficulty = keyof typeof modeJson.data.difficulties;
export interface Circle extends Pt { r: number }
// Mode rules (see modes/modes.ts); defaults = standard play.
const MOAB_CLASS = ['moab', 'bfb', 'zomg', 'ddt', 'bad'];
/** Freeplay MOAB-class HP multiplier: +2%/round 81-100, +5% 101-124, +15% 125-150 (fits wiki RBE r81-140 exactly). */
export function moabHpMult(round: number) {
  // uncertain: brackets past 150 (+35% to 250, +100% to 300, +150% to 400, +250% to 500, +500% after) are from memory, unverified by rounds.json.
  const steps: [number, number][] = [[100, 0.02], [124, 0.05], [150, 0.15], [250, 0.35], [300, 1], [400, 1.5], [500, 2.5], [Infinity, 5]];
  let m = 1, from = 80;
  for (const [to, k] of steps) { if (round <= from) break; m += (Math.min(round, to) - from) * k; from = to; }
  return m;
}
/** From round 81 ordinary bloons release a single child (the last listed, so Zebras drop White); MOAB-class keep their full payload. */
export const kidsAt = (type: string, round: number) => round > 80 && !MOAB_CLASS.includes(type) ? BLOONS[type].kids.slice(-1) : BLOONS[type].kids;
/** Spawn HP of one layer: fortified, MOAB-class freeplay ramp (times the mode's moabHpMult), r81+ super ceramics. Shared by makeBloon and bloonRbe. */
export function bloonHp(type: string, fortified: boolean, round: number, modeMoabMult = 1) {
  const d = BLOONS[type], f = fortified && d.fortifiable;
  if (MOAB_CLASS.includes(type)) return (f ? d.fortifiedHp : d.hp) * modeMoabMult * moabHpMult(round);
  if (type === 'ceramic' && round > 80) return f ? 120 : 60;
  return f ? d.fortifiedHp : d.hp;
}
/** Super ceramics pay $87 so a single-child chain still totals the 95 pops of a full ceramic. */
export const layerPopCash = (type: string, round: number) => type === 'ceramic' && round > 80 ? 87 : BLOONS[type].popCash;
/** Layer-by-layer RBE with the sim's own HP rules (fortified is inherited by children, as in makeBloon). */
export function bloonRbe(type: string, fortified: boolean, round: number): number {
  return bloonHp(type, fortified, round) + kidsAt(type, round).reduce((a, k) => a + bloonRbe(k, fortified, round), 0);
}
/** Powers with a sim effect; the rest of POWER_BY_ID are greyed out by canUsePower. */
const POWER_IMPL = new Set(['super_monkey_storm', 'monkey_boost', 'thrive', 'time_stop', 'cash_drop', 'road_spikes', 'glue_trap', 'moab_mine', 'camo_trap',
  'banana_farmer', 'banana_farmer_pro', 'pontoon', 'portable_lake', 'energizing_totem']);
// uncertain: footprints and Banana Farmer Pro range are not in the wiki prose; pontoon fits a Banana Farm (footprint 30).
const POWER_UNIT_R: Record<string, number> = { pontoon: 32, portable_lake: 14, banana_farmer: 8, banana_farmer_pro: 8, energizing_totem: 8 };
export interface PowerTrap { id: string; lane: number; dist: number; left: number; upgraded: boolean; hit: Map<number, number> }
export interface PowerUnit extends Pt { id: string; r: number; range: number; untilRound: number }
/** Between-rounds state a run save keeps (bloons, projectiles and timed zones are mid-round only). */
const SAVE_FIELDS = ['cash', 'lives', 'round', 'tick', 'nextId', 'won', 'laneRR', 'towers', 'hero', 'heroPlaced', 'roadItems', 'sentries',
  'collectibles', 'powerUnits', 'powerTraps', 'activePowers', 'thrive'] as const;
/** JSON-safe encoding: tower references become {$t:index}, Sets/Maps/Infinity get tags, so links (merges, brew sources, owners) survive. */
function encodeState(v: unknown, towers: unknown[], top = false): unknown {
  if (typeof v === 'number' && !Number.isFinite(v)) return { $num: String(v) };
  if (v === null || typeof v !== 'object') return v;
  const i = top ? -1 : towers.indexOf(v);
  if (i >= 0) return { $t: i };
  if (v instanceof Set) return { $set: [...v].map(x => encodeState(x, towers)) };
  if (v instanceof Map) return { $map: [...v].map(([k, x]) => [k, encodeState(x, towers)]) };
  if (Array.isArray(v)) return v.map(x => encodeState(x, towers));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeState(x, towers)]));
}
function decodeState(v: any, towers: object[]): any {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => decodeState(x, towers));
  if ('$num' in v) return Number(v.$num);
  if ('$t' in v) { if (!towers[v.$t]) throw new Error('bad tower ref'); return towers[v.$t]; }
  if ('$set' in v) return new Set(v.$set.map((x: unknown) => decodeState(x, towers)));
  if ('$map' in v) return new Map(v.$map.map(([k, x]: [unknown, unknown]) => [k, decodeState(x, towers)]));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeState(x, towers)]));
}
export interface Rules { cashMult: number; incomeMult: number; noSell: boolean; noPowers?: boolean; moabHpMult: number; winRound: number; auto: boolean; allowed?: (k: string) => boolean }
export const STANDARD_RULES: Rules = { cashMult: 1, incomeMult: 1, noSell: false, moabHpMult: 1, winRound: Infinity, auto: false };
// regrow restores along single-child chains only (blue->red etc.), reverse-derived from bloons.json.
const REGROW_PARENT: Record<string, string> = {};
for (const [id, d] of Object.entries(BLOONS)) if (d.kids.length === 1) REGROW_PARENT[d.kids[0]] ??= id;
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
  collectibles:Collectible[]=[];
  roadItems: RoadItem[] = []; sentries: Sentry[] = []; roundStartTick=0; modeId?: string;
  activePowers: { id: string; until: number }[] = []; powerTraps: PowerTrap[] = []; powerUnits: PowerUnit[] = [];
  thrive = { untilRound: -1, mult: 1 };
  cash: number; lives: number; round = 0; tick = 0; nextId = 1; rng = mulberry32(1);
  roundActive = false; won = false; rules: Rules = { ...STANDARD_RULES };
  lanes: Pt[][]; private lens: number[][] = []; laneRR = 0;
  hero: Hero | null = null;
  heroPlaced = false;
  private delayed: { at: number; target: Bloon; stats: TowerStats; damage: number; splash: number; radius: number; pierce: number }[] = [];
  private zones: (Pt & { until: number; next: number; interval: number; radius: number; stats: TowerStats; hit?: Set<number> })[] = [];
  private undead: { dist: number; lane: number; life: number; stats: TowerStats; hit: Set<number> }[] = [];
  private puddles: (Pt & { until: number; next: number; stats: TowerStats })[] = [];
  spawnQ: (Omit<Bloon, 'id' | 'hp' | 'dist'> & { at: number })[] = [];
  constructor(public path: Pt[], public difficulty: Difficulty = 'medium', public water: Rect[] = [], lanes?: Pt[][], public blocked: Circle[] = []) {
    this.lanes = lanes ?? [path];
    const mode = modeJson.data.difficulties[difficulty];
    this.cash = 'starting_cash' in mode ? mode.starting_cash : 650; this.lives = mode.lives;
    this.round = 'start_round' in mode ? mode.start_round - 1 : 0;
    for (const l of this.lanes) {
      let s = 0; const len = [0];
      for (let i = 1; i < l.length; i++) { s += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y); len.push(s); }
      this.lens.push(len);
    }
  }
  get gameOver() { return this.lives <= 0; }
  get pathLen() { return this.laneLen(0); }
  laneLen(lane = 0) { const l = this.lens[lane] ?? this.lens[0]; return l[l.length - 1]; }
  posOf(b: Bloon) { return this.posAt(b.dist, b.lane); }
  price(cost: number) { return Math.ceil(cost * modeJson.data.difficulties[this.difficulty].tower_cost_mult / 5 - 1e-10) * 5; }
  posAt(d: number, lane = 0): Pt {
    const L = this.lens[lane] ?? this.lens[0], path = this.lanes[lane] ?? this.lanes[0]; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1), a = path[i - 1], b = path[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  // One pipeline: hero discount x village discount (point given) x difficulty price().
  towerPrice(type: TowerKind, cost: number, point?: Pt, tier = 0) {
    const h = this.hero;
    const discount = h?.kind === 'rosalia' && h.level >= 6 && ['ace', 'heli'].includes(type) && !!point && Math.hypot(point.x - h.home.x, point.y - h.home.y) <= 60 ? 0.9
      : h?.kind === 'silas' && h.level >= 13 && type === 'ice' && tier === 5 ? 0.75 : 1;
    return this.price(cost * discount * (point && tier <= 3 ? 1 - this.discount(point) : 1));
  }
  canPlace(x: number, y: number, type: TowerKind = 'dart', ignore?: Tower) {
    const r = TOWERS[type].footprint;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < r || y < r || x > 960 - r || y > 540 - r) return false;
    const contained = this.water.some(w => x - r >= w.x && x + r <= w.x + w.width && y - r >= w.y && y + r <= w.y + w.height);
    const overlaps = this.water.some(w => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.width)),
      y - Math.max(w.y, Math.min(y, w.y + w.height))) < r);
    const abyssLand = type !== 'mermonkey' && this.towers.some(t => t.type === 'mermonkey' && t.tiers[0] === 5 && Math.hypot(t.x-x,t.y-y) <= 32);
    const onUnit = (id: string) => this.powerUnits.some(u => u.id === id && Math.hypot(u.x - x, u.y - y) + r <= u.r);
    if (TOWERS[type].waterOnly ? !contained && !abyssLand && !onUnit('portable_lake') : overlaps && !onUnit('pontoon')) return false;
    if (this.powerUnits.some(u => u.id !== 'pontoon' && (u.id !== 'portable_lake' || !TOWERS[type].waterOnly) && Math.hypot(u.x - x, u.y - y) < u.r + r)) return false;
    if (this.hero && Math.hypot(this.hero.x - x, this.hero.y - y) < HEROES[this.hero.kind].footprint + r) return false;
    if (this.towers.some(t => t !== ignore && !t.mergedInto && Math.hypot(t.x - x, t.y - y) < TOWERS[t.type].footprint + r)) return false;
    if (this.blocked.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r)) return false;
    return this.offTrack(x, y, r);
  }
  private offTrack(x: number, y: number, r: number) {
    return !this.lanes.some(path => path.slice(1).some((b, i) => {
      const a = path[i], dx = b.x - a.x, dy = b.y - a.y;
      const along = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a.x - along * dx, y - a.y - along * dy) < 20 + r;
    }));
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
    if (this.powerUnits.some(u => Math.hypot(u.x - x, u.y - y) < u.r + r)) return false;
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
    if (cash) this.payoutWhole(b);
    this.effect(this.posOf(b), 12, 'hero');
  }
  // Low-level setup API remains compatible; interactive purchases use placeTower.
  addTower(x: number, y: number, type: TowerKind = 'dart') {
    const def = TOWERS[type], cost = type === 'dart' && this.freeDartSource() ? 0 : this.towerPrice(type, def.cost, { x, y });
    if (this.gameOver || this.cash < cost || this.rules.allowed && !this.rules.allowed(type) || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if(type === 'dart' && cost === 0) this.freeDartSource()!.freeDarts!--;
    this.cash -= cost;
    this.towers.push({ ...def.base, type, x, y, aimAngle: -Math.PI / 2, targetPoint: { x, y: Math.max(0, y - 40) }, flight: { x, y }, rotorReady: 0, tiers: [0, 0, 0], cd: 0, cost, targeting: type === 'ice' || type === 'tack' ? 'Close' : 'First', shots: 0, abilityReady: 0, abilityUntil: 0, abilityNext: 0, secondaryReady: 0, orbitReady: 0, blitzRound: -1, buffUntil: 0, purchaseLives: this.lives }); return true;
  }
  placeTower(x: number, y: number, type: TowerKind) {
    return this.canPlace(x, y, type) && this.addTower(x, y, type);
  }
  upgrade(towerIdx: number, path: number) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || t.degree || t.mergedInto || !canUpgrade(t.tiers, path) || !this.supportUpgradeAllowed(t,path)) return false;
    const cost = this.upgradePrice(towerIdx,path);
    if (this.cash < cost) return false;
    if(t.type==='village' && path===2 && t.tiers[2]===4) {
      const farms=this.opolisFarms(t);
      // uncertain: local formula is garbled; use its explicit max(200,200*floor(value/2000))+1000.
      t.opolisIncome=Math.max(200,200*Math.floor(farms.reduce((sum,f)=>sum+f.cost,0)/2000))+1000;
      this.towers=this.towers.filter(a=>!farms.includes(a));
    }
    this.cash -= cost; t.cost += cost; t.tiers[path]++;
    if(t.type === 'super' && path === 0 && t.tiers[0] >= 4) {
      // uncertain: the wiki omits numeric category bonuses; sacrifice is modeled with the unsacrificed weapon stats.
      this.towers = this.towers.filter(ally => ally === t || Math.hypot(ally.x-t.x,ally.y-t.y) > t.range);
    }
    if(t.type === 'druid' && path === 1 && t.tiers[1] === 2) t.oakLives=this.lives;
    if(t.type === 'druid' && path === 2 && t.tiers[2] === 2) t.purchaseLives=this.lives;
    const hadAbility = t.ability;
    Object.assign(t, resultingStats(TOWERS[t.type], t.tiers));
    if(t.type==='engineer' && path===1 && t.tiers[1]===5)t.abilityReady=this.tick;
    if (t.ability && !hadAbility) t.abilityReady = this.tick + t.ability.initial * 60;
    if (t.type === 'heli' && path === 1 && t.tiers[1] === 4) {
      t.magicNext ??= {};
      t.magicNext.relocate = this.tick + 15 * 60;
      t.magicNext.crate = this.tick + 90 * 60;
    }
    return true;
  }
  setTarget(towerIdx: number, p: Pt) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !this.canSetTarget(t) ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 960 || p.y < 0 || p.y > 540) return false;
    if((t.type==='engineer' || t.type==='spike') && Math.hypot(p.x-t.x,p.y-t.y)>this.effectiveStats(t).range)return false;
    if(t.type === 'mermonkey') {
      if(this.tick < (t.magicNext?.totem ?? 0) || t.tiers[2] < 5 && Math.hypot(p.x-t.x,p.y-t.y)>t.range*1.35) return false;
      t.magicNext ??= {};t.magicNext.totem=this.tick+360;
    }
    t.targetPoint = { ...p }; return true;
  }
  canSetTarget(t: Tower) {
    return t.type==='spike' && t.tiers[2]>=2 || t.type==='engineer' && (t.tiers[1]>=3 || t.tiers[2]>=4) || t.type==='beast' && t.tiers[2]>0 || ['mortar','heli','dartling','ace'].includes(t.type) || t.type === 'super' && t.tiers[2] >= 3 || t.type === 'mermonkey' && t.tiers[2] >= 4;
  }
  relocate(heliIdx: number, towerIdx: number, point: Pt) {
    const heli = this.towers[heliIdx], tower = this.towers[towerIdx];
    if (this.gameOver || !heli || heli.type !== 'heli' || heli.tiers[1] < 4 || !tower || tower === heli ||
      tower.degree || tower.mergedInto || tower.type === 'super' && tower.tiers[0] >= 4 ||
      this.tick < (heli.magicNext?.relocate ?? 0) || !this.canPlace(point.x, point.y, tower.type, tower)) return false;
    tower.x = point.x; tower.y = point.y;
    heli.magicNext ??= {};
    // uncertain: tier-5 redeploy cooldown is unspecified locally; retain Chinook's 45s.
    heli.magicNext.relocate = this.tick + 45 * 60;
    this.effect(point, 15, 'reposition');
    return true;
  }
  activate(towerIdx: number) {
    const t = this.towers[towerIdx], a = t?.ability;
    if (this.gameOver || !t || !a || this.tick < t.abilityReady) return false;
    if (!this.activateSupport(t)) return false;
    if (a.kind === 'stub' || t.abilityUntil > this.tick) return false;
    if(a.kind === 'darkshift') {
      const p=t.targetPoint;
      if(t.tiers[2]===3 && Math.hypot(p.x-t.x,p.y-t.y)>t.range || !this.canPlace(p.x,p.y,t.type,t))return false;
      t.x=p.x;t.y=p.y;this.effect(p,15,'darkshift');
    }
    if (a.kind === 'vines') {
      const targets = this.magicTargets(t, 2000).filter(b => !this.isMoab(b));
      if (!targets.length) return false;
      for (const b of targets.slice(0, a.count)) this.vine(t, b);
    }
    if (a.kind === 'annihilate') {
      t.abilityUses = (t.abilityUses ?? 0) + 1;
      this.burst(t, this.source(t, { damage: a.damage * (t.abilityUses % 3 === 0 ? 1.5 : 1),
        damageType: 'normal', frozen: true, camo: true, pierce: a.count, moabBonus: 0, camoBonus: 0 }), a.pierce);
    }
    if (a.kind === 'transform') {
      t.transformedUntil = this.tick + a.duration * 60;
      const allies = this.towers.filter(ally => ally !== t && ['dart','boomerang','ninja','druid','wizard','alchemist'].includes(ally.type))
        .sort((x, y) => Math.hypot(x.x-t.x,x.y-t.y)-Math.hypot(y.x-t.x,y.y-t.y));
      for (const ally of allies.slice(0, a.count)) ally.transformedUntil = t.transformedUntil;
    }
    if (a.kind === 'icejet' && t.tiers[1] === 5) {
      this.burst(t, this.source(t, { damage:70, damageType:'frigid', camo:true, pierce:1e6, moabBonus:0 }), 2000);
      for (const b of this.bloons) if (b.type !== 'bad') { b.slow=0.5; b.slowUntil=this.tick+480; }
    }
    if (a.kind === 'chinook' || a.kind === 'marine') {
      t.magicNext ??= {};
      // The single activate entry point deploys the Marine and collects ready crates.
      // uncertain: crate flight/collection is instantaneous in this headless ability API.
      if (this.tick >= (t.magicNext.crate ?? (a.kind === 'marine' ? t.abilityReady : 0))) {
        this.earnIncome(a.damage);
        this.lives += t.tiers[1] === 5 ? 25 : 10;
        t.magicNext.crate = this.tick + 90 * 60;
      }
      if (a.kind === 'marine') {
        // uncertain: prose disagrees between 0.04s and 0.06s; use 0.04s Marine gun.
        this.sentries.push({ ...t.targetPoint, owner: t, until: this.tick + 30 * 60, next: this.tick,
          variant: 0, stats: { ...TOWERS.dart.base, damage: 6, pierce: 20, cooldown: 0.04,
            range: 50, damageType: 'normal', camo: true, lead: true, frozen: true } });
      }
    }
    if (a.kind === 'cash') this.earnIncome(a.damage);
    if (a.kind === 'blast') {
      this.burst({ x: 480, y: 270 }, this.source(t, { damage: a.damage, damageType: 'normal', camo: true,
        frozen: true, pierce: a.count, moabBonus: 0, ceramicBonus: 0, fortifiedBonus: 0, leadBonus: 0, camoBonus: t.tiers[1] === 5 ? a.damage : 0, stun: a.duration, moabStun: a.duration }), 2000);
    }
    if (a.kind === 'strike') {
      const target = [...this.bloons].sort((a, b) => BLOONS[b.type].rbe - BLOONS[a.type].rbe)[0];
      if (!target) return false;
      const p = this.posOf(target);
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
        this.effect(this.posOf(b), 20, 'hook');
        // uncertain: use RBE for total hooked layer cash; pop income tax still applies.
        this.payoutWhole(b, a.count > 1 ? 2 : 1);
      }
      if (!used) return false;
    }
    if (a.kind === 'missile') {
      const target = this.bloons.filter(b => this.isMoab(b) && (!(b.camo || b.type === 'ddt' && b.camo !== false) || t.camo))
        .sort((a, b) => BLOONS[b.type].rbe - BLOONS[a.type].rbe)[0];
      if (!target) return false;
      this.applyHit(target, this.source(t, { damage: a.damage, damageType: 'normal', moabBonus: 0 }));
      this.effect(this.posOf(target), 16, 'bomb');
    }
    const energizer = this.towers.some(ally => ally.type === 'sub' && ally.tiers[0] === 5);
    const reactor = this.towers.some(ally => ally.type === 'sub' && ally.tiers[0] >= 4);
    const cooldownMult = energizer ? TOWERS[t.type].waterOnly ? 0.6 : 0.8 : reactor && TOWERS[t.type].waterOnly ? 0.85 : 1;
    t.abilityReady = this.tick + a.cooldown * cooldownMult * this.villageAbilityMult(t) * 60;
    t.abilityUntil = this.tick + a.duration * 60; t.abilityNext = this.tick;
    if (a.kind === 'snow' && t.tiers[1] === 5) {
      for (const ally of this.towers) if (ally.type === 'ice') ally.buffUntil = this.tick + 600;
    }
    if (a.kind === 'snow' || a.kind === 'glue') this.globalAbility(t);
    return true;
  }
  private source(t: TowerStats & Pt, stats: Partial<TowerStats> = {}): Dart {
    const actual=this.towers.includes(t as Tower)?t as Tower:undefined;
    const buffed=actual?this.effectiveStats(actual):t;
    const result:Dart={ ...buffed, ...stats, owner:actual, vx: 0, vy: 0, life: 0, hit: new Set() };
    if(actual && !actual.degree && this.villages(actual).some(v=>v.tiers[1]>=3)){result.damageType='normal';result.frozen=true;result.lead=true;}
    return result;
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
    if (t.ability.kind === 'rocketstorm') {
      const a = t.ability, mad = t.tiers[1] === 5;
      const targets = this.bloons.filter(b => this.canHit(b, t)).sort((x, y) =>
        BLOONS[y.type].rbe - BLOONS[x.type].rbe || y.dist - x.dist);
      // uncertain: wiki describes aimed cones; task requires strongest/first targeting.
      // Use 15 waves over 7.5s (overview); popology rounds the duration to 8s.
      for (let n = 0; n < a.count; n++) {
        const target = targets[n % Math.max(1, targets.length)];
        if (!target) continue;
        const p = this.posOf(target), angle = Math.atan2(p.y - t.y, p.x - t.x);
        this.darts.push({ ...this.source(t, { kind: 'bomb', damageType: 'normal', damage: a.damage,
          moabBonus: mad ? 250 : 0, ceramicBonus: mad ? 5 : 1, burnDamage: 0,
          pierce: a.pierce + (t.tiers[2] >= 2 ? 2 : 0), radius: mad ? 12 : 8 }),
          vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350, life: 3, target: { ...p } });
      }
      t.abilityNext += 30;
    }
    if (t.ability.kind === 'phoenix') {
      const target = this.magicTargets({ ...t, camo:true }, 2000)[0];
      if (target) this.burst(this.posOf(target), this.source(t, {damage:t.ability.damage, damageType:'fire',
        camo:true, frozen:true, pierce:t.ability.pierce, moabBonus:0, burnDamage:0}), 15);
      // uncertain: phoenix orbit is visual only; its two flames resolve as one impact per 0.1s.
      t.abilityNext = this.tick + 6;
      if (t.tiers[1] === 5 && this.magicDue(t,'phoenixMeteor',1)) {
        for (let n=0;n<8;n++) {
          const b=this.bloons[n % Math.max(1,this.bloons.length)];
          if (b) this.burst(this.posOf(b), this.source(t,{damage:50,damageType:'normal',camo:true,pierce:300,moabBonus:0}),30);
        }
      }
    }
    if (t.ability.kind === 'sabotage') {
      for (const b of this.bloons) if (b.type !== 'bad') {b.slow=0.5;b.slowUntil=t.abilityUntil;}
      t.abilityNext=this.tick+1;
    }
    if (t.ability.kind === 'icejet') {
      const target=this.magicTargets({...t,camo:true},2000)[0];
      if(target) {
        const p=this.posOf(target), angle=Math.atan2(p.y-t.y,p.x-t.x);
        // uncertain: Ice Jet fire interval and speed are absent; use 0.1s and 300 units/s.
        this.darts.push({...this.source(t), damage:t.ability.damage, damageType:'frigid', radius:0, moabBonus:0,
          pierce:t.ability.pierce,freezeDuration:3,freezeLayers:3,bounce:true,life:3,camo:true,
          vx:Math.cos(angle)*300,vy:Math.sin(angle)*300});
      }
      t.abilityNext=this.tick+6;
    }
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
    const t = this.towers[towerIdx]; if (this.gameOver || !t || this.rules.noSell) return false;
    this.collect(towerIdx);
    this.cash += this.sellValue(t); this.towers.splice(towerIdx, 1);
    for(const ally of this.towers)if(ally.mergedInto===t)ally.mergedInto=undefined;
    this.roadItems=this.roadItems.filter(i=>i.owner!==t);this.sentries=this.sentries.filter(i=>i.owner!==t);return true;
  }
  cycleTargeting(towerIdx: number) {
    const t = this.towers[towerIdx]; if (t) t.targeting = TARGETING[(TARGETING.indexOf(t.targeting) + 1) % TARGETING.length];
  }
  startRound(groups = roundGroups(this.round + 1)) {
    if (this.gameOver || this.roundActive || !groups.length) return false;
    this.round++; this.roundActive = true; this.roundStartTick=this.tick; for(const t of this.towers){t.roundUses=0;t.farmAccounted=0;t.farmCreated=0;t.farmNext=this.tick;} let time = 0;
    for (const g of groups) for (let i = 0; i < g.n; i++) {
      this.spawnQ.push({ at: this.tick + Math.round(time * 60), lane: this.laneRR++ % this.lanes.length, type: g.type, camo: g.camo, fortified: g.fortified, regrow: g.regrow }); time += g.gap;
    }
    return true;
  }
  private makeBloon(type: string, dist: number, flags: Pick<Bloon, 'camo' | 'fortified' | 'regrow' | 'lane' | 'regrowMax'>): Bloon {
    const def = BLOONS[type];
    const fortified = Boolean(flags.fortified && def.fortifiable);
    const hp = bloonHp(type, fortified, this.round, this.rules.moabHpMult);
    // uncertain: the MOAB speed ramp is hand-tuned (HP ramp matches wiki RBE).
    const spd = this.isMoab({ type } as Bloon) ? 1 + Math.min(Math.max(0, this.round - 80), 60) * 0.005 : 1;
    return { id: this.nextId++, type, dist, hp, fortified, regrow: flags.regrow, camo: flags.camo || type === 'ddt', lane: flags.lane, spd,
      regrowMax: flags.regrow ? flags.regrowMax ?? type : undefined };
  }
  private isMoab(b: Bloon) { return MOAB_CLASS.includes(b.type); }
  private canHit(b: Bloon, d: TowerStats) {
    if ((b.camo || b.type === 'ddt' && b.camo !== false) && !d.camo) return false;
    if (this.isMoab(b) && !d.moabTargetable) return false;
    if(d.universal)return true;
    const h = this.hero, gold = (b.goldUntil ?? 0) > this.tick;
    const blackVulnerable = h?.kind === 'striker' && h.level >= 5 && (h.level >= 19 || (b.id + Math.floor(this.tick / 60)) % 2 === 0);
    const whiteVulnerable = h?.kind === 'silas' && h.level >= 5 && (h.level >= 13 || (b.id + Math.floor(this.tick / 60)) % 2 === 0);
    const immune = gold ? [] : BLOONS[b.type].immunities.filter(immunity => !(blackVulnerable && immunity === 'explosion') && !(whiteVulnerable && ['freeze', 'cold(most ice)', 'cold'].includes(immunity)));
    const purpleVulnerable = h?.kind === 'ezili' && (h.until.heartstopper ?? 0) > this.tick;
    if (d.damageType === 'frigid' && !gold && !whiteVulnerable && (b.type === 'white' || b.type === 'zebra')) return false;
    if ((d.damageType === 'energy' || d.damageType === 'plasma' || d.damageType === 'frigid') && b.type === 'purple' && !gold && !purpleVulnerable) return false;
    const brittle = (b.brittleUntil ?? 0) > this.tick;
    if ((b.frozenUntil ?? 0) > this.tick && !d.frozen && !d.refreeze && !brittle) return false;
    if (d.damageType === 'cold' && immune.includes('freeze')) return false;
    if (d.damageType === 'cold' && immune.includes('cold(most ice)') && !d.lead && !brittle) return false;
    if ((d.damageType === 'sharp' || d.damageType === 'shatter') && immune.includes(d.damageType) && !d.lead && !brittle) return false;
    return purpleVulnerable && b.type === 'purple' || !immune.includes(d.damageType) || d.damageType === 'energy' && b.type === 'lead' && d.lead || (d.damageType === 'sharp' || d.damageType === 'shatter') && (d.lead || brittle);
  }
  private effect(p: Pt, radius: number, kind: string) {
    this.effects.push({ ...p, radius, kind, life: 0.2 });
  }
  private applyHit(b: Bloon, d: Dart) {
    if (!this.canHit(b, d) || !this.bloons.includes(b)) return;
    const moab = this.isMoab(b);
    const wasFrozen = (b.frozenUntil ?? 0) > this.tick;
    const vulnerability = (b.brittleUntil ?? 0) > this.tick ? b.brittle ?? 0 : 0;
    if (d.stripCamo) b.camo = false;
    if (d.stripRegrow) b.regrow = false;
    if (d.strip) { b.camo = false; b.regrow = false; }
    if (d.brittle) { b.brittle = d.brittle; b.brittleUntil = this.tick + d.brittleDuration * 60; }
    if (b.type !== 'bad') {
      const stun = moab ? d.moabStun : d.kind === 'glue' ? 0 : d.stun;
      if (stun) b.stunnedUntil = this.tick + stun * 60;
      if (!moab && d.freezeDuration && (!BLOONS[b.type].immunities.includes('freeze') || this.hero?.kind === 'silas' && this.hero.level >= 13)) {
        b.freezeLayers = d.freezeLayers; b.frozenUntil = this.tick + d.freezeDuration * (b.type.includes('ceramic') && d.auraSlow === 1 ? 0.5 : 1) * 60;
      }
      if (moab && d.moabSlow < 1 && d.kind !== 'glue') b.slow = d.moabSlow;
      if (d.afterSlow < 1 && !moab) { b.slow = d.afterSlow; b.slowUntil = this.tick + 600; }
      if (d.knockback && d.owner?.type !== 'ninja' && (!moab || d.kind === 'boomerang' || d.moabStun)) b.dist = Math.max(0, b.dist - (moab ? 5 : 20));
    }
    if (d.owner?.type === 'ninja' && d.owner.tiers[1] >= 1 && !moab && this.rng() < 0.3) {
      // uncertain: base shuriken chance is absent; use the documented Flash Bomb chance.
      b.dist = Math.max(0, b.dist - (b.type.includes('ceramic') ? 62.5 : 125));
    }
    if (d.impale && moab && b.type !== 'bad') {
      b.slow = (b.type === 'zomg' ? 2.25 : 5) / BLOONS[b.type].speed;
      b.slowUntil = this.tick + d.freezeDuration * 60;
    }
    if (d.icicles && this.rng() < 0.25) b.icicle = { until: this.tick + d.freezeDuration * 60, next: this.tick + 12, stats: { ...d } };
    if (d.defortify && b.fortified && !(d.owner?.type === 'alchemist' && moab) && (['lead', 'ceramic', 'moab', 'bfb'].includes(b.type) || d.burnMoab >= 100 && b.type === 'ddt')) {
      b.fortified = false; b.hp = Math.min(b.hp, BLOONS[b.type].hp);
    }
    if (d.burnDamage) b.burn = { until: this.tick + d.burnDuration * 60,
      next: b.burn?.next ?? this.tick + d.burnInterval * 60, interval: d.burnInterval * 60,
      damage: d.burnDamage + (moab ? d.burnMoab : 0), stats: { ...d, damageType: d.damageType === 'normal' ? 'normal' : d.damageType === 'acid' ? 'acid' : 'fire', frozen: true } };
    if (d.shards) b.shardStats = { ...d };
    if (d.orbit && moab && !b.burn) {
      b.burn = { until: this.tick + 600, next: this.tick + 60, interval: 60, damage: 100, stats: { ...d, damageType: 'normal', frozen: true } };
    }
    if (d.kind === 'glue' && (!b.glue || b.glue.stats.glueLevel <= d.glueLevel)) {
      b.glue = { until: this.tick + (moab ? d.moabDuration || d.glueDuration : d.glueDuration) * 60,
        next: b.glue ? Math.min(b.glue.next, this.tick + d.dotInterval * 60) : this.tick + d.dotInterval * 60, stats: { ...d }, layers: d.glueLayers };
    }
    const ninjaBonus = d.owner?.type === 'ninja' && d.owner.tiers[2] >= 3 &&
      (Math.max(b.stunnedUntil ?? 0, b.stickyUntil ?? 0) > this.tick) ? d.owner.tiers[2] === 5 ? 19 : 4 : 0;
    const frozenBonus = d.owner?.type === 'mermonkey' && d.owner.tiers[1] >= 3 && wasFrozen ? d.owner.tiers[1] === 5 ? 7.5 : d.owner.tiers[1] === 4 ? 4 : 2 : 0;
    const amount = d.damage + ninjaBonus + frozenBonus + (moab ? d.moabBonus : 0) + (b.type.includes('ceramic') ? d.ceramicBonus : 0) +
      (b.fortified ? d.fortifiedBonus : 0) + (b.type === 'lead' ? d.leadBonus : 0) +
      vulnerability + (b.camo ? d.camoBonus : 0);
    if (d.owner?.type === 'alchemist' && d.owner.tiers[2] >= 3 && b.type === 'lead' && amount >= b.hp) this.cash += 50;
    if (d.owner?.type === 'druid' && amount > 0) {
      const real = this.towers.find(t => t.type === 'druid' && t.x === d.owner!.x && t.y === d.owner!.y);
      if (real) { real.wrathDamage=(real.wrathDamage ?? 0)+amount; real.lastDamage=this.tick; }
    }
    if (amount > 0) this.damage(b, amount, { ...d, frozen: true });
  }
  private burst(p: Pt, d: Dart, radius: number) {
    this.effect(p, radius, d.kind);
    let pierce = d.pierce;
    for (const b of [...this.bloons]) {
      if (pierce <= 0) break;
      const bp = this.posOf(b);
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
        const b = this.bloons.find(b => !hit.has(b.id) && this.canHit(b, t) && Math.hypot(this.posOf(b).x - point.x, this.posOf(b).y - point.y) < (n ? t.bounceRange : 1));
        if (!b) break;
        point = this.posOf(b); hit.add(b.id);
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
      const aim = t.kind === 'tack' || t.radial ? n * Math.PI * 2 / t.projectiles + (t.degree && t.type==='tack'?this.tick*0.03:0) : angle + (n - (t.projectiles - 1) / 2) * t.spread * Math.PI / 180 + (t.accuracy ? (this.rng() - 0.5) * t.accuracy * Math.PI / 180 : 0);
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
    if(d.owner) {const owner=this.towers.find(t=>t.type===d.owner!.type && t.x===d.owner!.x && t.y===d.owner!.y);if(owner)owner.paragonPops=(owner.paragonPops??0)+Math.min(amount,b.hp);}
    if (amount < b.hp) { b.hp -= amount; return; }
    const remaining = amount - b.hp;
    this.credit(layerPopCash(b.type, this.round) * popCashMultiplier(this.round) * this.rules.cashMult * (b.cashMult ?? 1) * (((b.goldUntil ?? 0) > this.tick ? 2 : 1) + d.popCashBonus));
    if (this.isMoab(b)) this.effect(this.posOf(b), b.type === 'moab' ? 24 : 36, 'blimp');
    for(const t of this.towers) if(t.type==='wizard' && t.tiers[2]>=4 && Math.hypot(this.posOf(b).x-t.x,this.posOf(b).y-t.y)<=t.range)
      t.graveyard=Math.min(t.tiers[2]===5?3000:500,(t.graveyard ?? 0)+1);
    if (b.trojan) {
      let layers = 0, type = b.type;
      while (BLOONS[type].kids.length) { layers++; type = BLOONS[type].kids[0]; }
      this.credit(((this.hero?.level ?? 0) >= 16 ? 3 + 2 * layers : 2 + layers) * this.rules.cashMult);
    }
    if(b.concoction) {
      // uncertain: wiki omits the explosion health fraction; use 10% of the unmodified layer HP.
      const stats=b.concoction;b.concoction=undefined;
      this.burst(this.posOf(b),{...this.source({...stats,...this.posOf(b)},{damage:BLOONS[b.type].hp*0.1,pierce:50,damageType:'normal',moabBonus:0}),hit:new Set([b.id])},40);
    }
    this.bloons.splice(this.bloons.indexOf(b), 1);
    if (b.shardStats && d.owner?.type !== 'sniper') this.shards(b, b.shardStats);
    if (!BLOONS[b.type].kids.length && b.glue?.stats.puddleDamage) {
      const p = this.posOf(b);
      this.puddles.push({ ...p, until: this.tick + 7.7 * 60, next: this.tick, stats: b.glue.stats });
    }
    if (b.glue?.stats.stun) {
      const stats = b.glue.stats, p = this.posOf(b);
      let pierce = stats.pierce >= 6 ? 11 : 6;
      for (const other of this.bloons) {
        if (pierce <= 0) break;
        if (other.type !== 'bad' && Math.hypot(this.posOf(other).x - p.x, this.posOf(other).y - p.y) <= 12) {
          other.stunnedUntil = this.tick + (this.isMoab(other) ? other.type === 'ddt' ? 0.2 : 0.25 : 1) * 60; pierce--;
        }
      }
    }
    for (const type of b.noChildren ? [] : kidsAt(b.type, this.round)) {
      const child = this.makeBloon(type, b.dist, b); child.cashMult = b.cashMult;
      if (!this.isMoab(child)) child.goldUntil=b.goldUntil;
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
    const p = this.posOf(b);
    for (let n = 0; n < stats.shards; n++) {
      const angle = n * 2 * Math.PI / stats.shards;
      this.darts.push({ ...this.source({ ...stats, ...p }), kind: 'projectile', damageType: 'shatter',
        damage: stats.shardDamage, pierce: stats.shardPierce, radius: 0, freezeDuration: 0, shards: 0, life: 0.3,
        hit: new Set([b.id]), vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200 });
    }
  }
  private magicDue(t: Tower, name: string, seconds: number) {
    t.magicNext ??= {};
    if(this.tick < (t.magicNext[name] ?? 0)) return false;
    t.magicNext[name]=this.tick+seconds*60; t.magicActs=(t.magicActs??0)+1; return true;
  }
  private magicTargets(t: Tower, range: number) {
    const targets=this.bloons.filter(b=>this.canHit(b,t) && Math.hypot(this.posOf(b).x-t.x,this.posOf(b).y-t.y)<=range+7);
    const distance=(b:Bloon)=>Math.hypot(this.posOf(b).x-t.x,this.posOf(b).y-t.y);
    return targets.sort((a,b)=>t.targeting==='Strong'? BLOONS[b.type].rbe-BLOONS[a.type].rbe || b.dist-a.dist:
      t.targeting==='Close'?distance(a)-distance(b):t.targeting==='Last'?a.dist-b.dist:b.dist-a.dist);
  }
  private vine(t: Tower, b: Bloon) {
    const p=this.posOf(b);
    // Vines consume the whole ordinary bloon without spawning children, awarding its remaining RBE.
    this.payoutWhole(b);
    this.bloons.splice(this.bloons.indexOf(b),1);
    const tier=t.tiers[1];
    this.zones.push({...p,until:this.tick+(tier===3?4.5:t.tiers[2]?12:9)*60,next:this.tick,
      interval:tier===5?0.1:tier===4?0.2:0.3,radius:10,
      stats:{...t,damage:tier===5?5:tier===4?2:1,pierce:tier===3?20:30,projectiles:1,
        damageType:t.tiers[0]?'normal':'sharp',radius:0,stripRegrow:true}});
  }
  private magicBuffs(t: Tower, weapon: Tower): Tower {
    if(t.degree)return weapon; // paragons reject ordinary buffs (see effectiveStats)
    if(t.brew && (!this.towers.includes(t.brew.source) || this.tick>=t.brew.until || t.shots>=t.brew.shots)) t.brew=undefined;
    if(t.brew) {
      const stronger=t.brew.level>=4;
      weapon.damage++;weapon.pierce+=stronger?3:2;weapon.range*=stronger?1.15:1.1;weapon.cooldown*=stronger?0.85:0.9;
    }
    if(t.dip && (!this.towers.includes(t.dip.source) || t.dip.shots<=0))t.dip=undefined;
    if(t.dip) {weapon.lead=true;weapon.ceramicBonus++;weapon.moabBonus++;weapon.leadBonus++;}
    if((t.transformedUntil ?? 0)>this.tick) Object.assign(weapon,{damage:3,pierce:6,range:72,cooldown:0.03,damageType:'energy',
      kind:'projectile',radius:0,projectiles:1,burnDamage:0,projectileSpeed:500,lifespan:1,moabBonus:0});
    if(t.type==='druid' && t.tiers[1]>=2) weapon.pierce*=1+Math.min(1,Math.max(0,this.lives-(t.oakLives ?? this.lives))*0.01);
    if(t.type==='druid' && t.tiers[2]>=2) {
      const lost=Math.max(0,(t.purchaseLives ?? this.lives)-this.lives);
      weapon.cooldown/=1+Math.min(0.5,0.1+lost*0.01);
      if(t.tiers[2]>=3) {
        if(this.tick-(t.lastDamage ?? 0)>120)t.wrathDamage=0;
        weapon.cooldown/=1+Math.min(1,Math.floor((t.wrathDamage ?? 0)/10)*0.05);
      }
      if(t.tiers[2]===5)weapon.damage+=Math.min(30,Math.floor(this.bloons.reduce((sum,b)=>sum+BLOONS[b.type].rbe,0)/3000));
    }
    const nearby=this.towers.filter(a=>a!==t && Math.hypot(a.x-t.x,a.y-t.y)<=a.range);
    if(t.type==='ninja') {
      const stacks=Math.min(20,nearby.filter(a=>a.type==='ninja' && a.tiers[1]>=3).length);
      weapon.cooldown*=Math.max(1/5.3,0.92**stacks);weapon.pierce*=1+0.08*stacks;
      if(nearby.some(a=>a.type==='ninja' && a.tiers[1]===5))weapon.moabBonus+=2;
    }
    if(t.type==='druid') {
      const stacks=Math.min(5,nearby.filter(a=>a.type==='druid' && a.tiers[2]>=4).length);
      weapon.cooldown/=1+stacks*0.15;weapon.pierce*=1+stacks*0.15;
    }
    const abyss=Math.max(0,...nearby.filter(a=>a.type==='mermonkey' && a.tiers[0]>=3).map(a=>a.tiers[0]===5?0.4:a.tiers[0]===4?0.2:0.1));
    weapon.pierce*=1+abyss;
    if(['wizard','super','ninja','alchemist','druid','mermonkey'].includes(t.type) && this.towers.some(a=>a!==t && a.type==='mermonkey' && a.tiers[2]===5 && (Math.hypot(a.x-t.x,a.y-t.y)<=a.range || a.magicNext?.totem!==undefined && Math.hypot(a.targetPoint.x-t.x,a.targetPoint.y-t.y)<=a.range)))weapon.pierce+=3;
    if(t.type==='mermonkey') {
      weapon.range*=1.35;
      if(t.tiers[2]>=2)weapon.range*=1+Math.min(10,this.towers.filter(a=>a.type==='mermonkey').length)*0.075;
    }
    return weapon;
  }
  private magicAttack(t: Tower, weapon: Tower) {
    if(t.degree)return;
    if ((t.transformedUntil ?? 0)>this.tick) return;
    const [a,b,c]=t.tiers;
    const targets=this.magicTargets(weapon,weapon.range), target=targets[0];
    const burst=(bloon:Bloon,stats:Partial<TowerStats>,radius=20)=>this.burst(this.posOf(bloon),this.source(weapon,stats),radius);
    if(t.type==='alchemist') {
      const speed=c?0.8:1;
      const allies=this.towers.filter(ally=>ally!==t && ally.type!=='alchemist' && Math.hypot(ally.x-t.x,ally.y-t.y)<=t.range)
        .sort((x,y)=>Math.hypot(x.x-t.x,x.y-t.y)-Math.hypot(y.x-t.x,y.y-t.y));
      if(a>=2 && allies.length && this.magicDue(t,'dip',10*speed)) {
        const ally=allies.find(ally=>!ally.dip || ally.dip.shots<10) ?? allies[0];
        ally.dip={source:t,shots:a===5?Infinity:Math.min(30,(ally.dip?.shots ?? 0)+(b>=2?12:10))};
      }
      if(a>=3 && allies.some(ally=>!ally.brew) && this.magicDue(t,'brew',8*speed)) {
        const ally=allies.find(ally=>!ally.brew)!;
        ally.brew={source:t,level:a,until:a===5?Infinity:this.tick+((a>=4?12:5)+(b>=2?1:0))*60,
          shots:a===5?Infinity:ally.shots+(a>=4?40:25)+(b>=2?15:0)};
      }
      if((t.transformedUntil ?? 0)>this.tick)return;
      if(b>=3 && this.magicDue(t,'concoction',6*speed)) {
        const moab=this.magicTargets({...weapon,range:67.5},67.5).find(b=>this.isMoab(b));
        if(moab)moab.concoction={...weapon};
      }
      if(c>=2 && this.magicDue(t,'acidPool',t.cooldown*5)) {
        const p=target?this.posOf(target):this.posAt(Math.min(this.pathLen,Math.max(0,t.x)));
        // uncertain: use closest horizontal path distance when no target is available.
        this.zones.push({...p,until:this.tick+6.95*60,next:this.tick,interval:1,radius:10,hit:new Set(),stats:{...weapon,damage:1,pierce:5}});
      }
      if(c>=4 && this.magicDue(t,'gold',2)) for(const bloon of targets.slice(0,15))if(bloon.type!=='bad')bloon.goldUntil=this.tick+840;
      if(c===5 && this.magicDue(t,'shrink',10)) {
        let budget=200;
        for(const bloon of this.magicTargets(weapon,2000).sort((x,y)=>BLOONS[y.type].rbe-BLOONS[x.type].rbe)) {
          if(bloon.type==='bad')continue;
          const cost=({moab:20,bfb:50,ddt:50,zomg:100} as Record<string,number>)[bloon.type] ?? 1;
          if(cost>budget)continue;budget-=cost;bloon.type='red';bloon.hp=1;bloon.fortified=false;bloon.concoction=undefined;
        }
      }
    }
    if(t.type==='wizard') {
      if((c>=3 || a===5) && this.magicDue(t,'shimmer',c===5 || a===5?1:2))
        this.burst(t,this.source(weapon,{damage:0,moabBonus:0,camoBonus:0,damageType:'normal',camo:true,stripCamo:true,pierce:500}),75);
      if(b>=1 && target && this.magicDue(t,'fireball',b>=3?1.1:2.2))burst(target,{damage:b===5?9:b>=3?3:a>=2?2:1,damageType:'fire',
        pierce:15+(c?5:0),moabBonus:a===5?24:a>=4?6:0,burnDamage:0},20);
      if(b>=2 && target && this.magicDue(t,'wall',b===5?3.25:b>=3?4.5:6.5))this.zones.push({...this.posOf(target),until:this.tick+(a?6.5:4.5)*60,next:this.tick,
        interval:b>=3?0.1:0.15,radius:12,stats:{...weapon,damage:b===5?5:1,damageType:'fire',pierce:(b>=3?20:10)+(c?5:0),moabBonus:a===5?6:a>=4?2:0,burnDamage:0}});
      if(a===5 && target && this.magicDue(t,'breath',0.0675))burst(target,{damage:2,damageType:'fire',pierce:3,moabBonus:8},20);
      if(b===5 && target && this.magicDue(t,'permanentPhoenix',0.1))burst(target,{damage:5,damageType:'fire',pierce:8,moabBonus:0},20);
      if(c>=4 && (t.graveyard ?? 0)>0 && this.magicDue(t,'undead',c===5?0.275:1.1)) {
        const units=t.graveyard ?? 0,large=c===5 && units>=20, cost=large?units>=2100?50:20:1;
        t.graveyard=units-cost;
        const globalBonus=this.towers.some(t=>t.type==='wizard' && t.tiers[2]===5)?3:0;
        const lane=target?.lane ?? 0;
        this.undead.push({dist:Math.min(this.laneLen(lane),(target?.dist ?? Math.min(this.laneLen(lane),t.x))+40),lane,life:a?6:3,hit:new Set(),
          stats:{...weapon,damage:(large?cost===50?100:40:2)+globalBonus+Math.min(10,Math.floor(units/(c===5?300:200))),damageType:'normal',pierce:large?cost===50?50:20:10,moabBonus:0,burnDamage:0,camo:true}});
      }
    }
    if(t.type==='ninja') {
      if(c>=2 && this.magicDue(t,'caltrops',3.9)) {
        const p=target?this.posOf(target):this.posAt(Math.min(this.pathLen,t.x));
        this.darts.push({...this.source({...weapon,...p},{damage:c===5?5:1,pierce:6,radius:0,ceramicBonus:c===5?5:0}),vx:0,vy:0,life:35});
      }
      if(c>=3 && target && this.magicDue(t,'flash',t.cooldown*4))burst(target,{damage:c===5?10:3,damageType:'explosion',pierce:30,stun:1.3,moabStun:c===5?0.325:0},40);
      if(c>=4 && this.magicDue(t,'sticky',c===5?2.25:4.5)) {
        const moab=this.magicTargets({...weapon,damageType:'normal'},c===5?2000:weapon.range).find(b=>this.isMoab(b));
        if(moab && (moab.stickyUntil ?? 0)<=this.tick) {
          moab.stickyUntil=this.tick+180;
          this.delayed.push({at:this.tick+177,target:moab,stats:{...weapon,stun:0,moabStun:c===5?1:0},damage:c===5?3000:450,splash:c===5?600:100,radius:40,pierce:10});
        }
      }
    }
    if(t.type==='druid') {
      if(a>=2 && target && this.magicDue(t,'lightning',a===5?1.15:2.3)) {
        let point=this.posOf(target);const hit=new Set<number>();
        for(let n=0;n<31;n++) {
          const next=this.bloons.find(b=>!hit.has(b.id) && this.canHit(b,{...weapon,damageType:'plasma'}) && Math.hypot(this.posOf(b).x-point.x,this.posOf(b).y-point.y)<=86);
          if(!next)break;hit.add(next.id);point=this.posOf(next);
          this.applyHit(next,{...this.source(weapon,{damage:a===5?30:a>=4?3:2,damageType:'plasma'}),owner:t});
        }
      }
      if(a>=3 && target && this.magicDue(t,'tornado',a===5?4:2.5)) {
        for(const bloon of targets.slice(0,a===5?200:a===4?60:35))if(bloon.type!=='bad' && (!this.isMoab(bloon)||a===5)) {
          // uncertain: deterministic midpoint of documented blowback distance ranges.
          bloon.dist=Math.max(0,bloon.dist-(a===5?bloon.type==='zomg'?125:250:a===4?200:150));bloon.glue=undefined;bloon.frozenUntil=0;
          if(a===5)this.applyHit(bloon,this.source(weapon,{damage:100,damageType:'normal'}));
        }
      }
      // uncertain: ball travel is folded into periodic lightning pulses near its target.
      if(a>=4 && target && this.magicDue(t,'ball',0.35))burst(target,{damage:a===5?10:3,damageType:'plasma',pierce:31,freezeDuration:4.5,freezeLayers:4},86);
      if(b>=3 && this.magicDue(t,'vine',b===5?0.3:2.6)) {
        const ordinary=this.magicTargets(weapon,2000).find(b=>!this.isMoab(b) && !b.camo);
        if(ordinary)this.vine(weapon,ordinary);
      }
      if(b===5 && this.magicDue(t,'forest',0.5))for(const bloon of [...this.bloons]) {
        const distance=Math.hypot(this.posOf(bloon).x-t.x,this.posOf(bloon).y-t.y);
        const grown=(this.tick-(t.magicNext?.forestStart ?? this.tick))*DT*3;
        t.magicNext!.forestStart ??= this.tick;
        if(distance>grown)continue;
        this.applyHit(bloon,this.source(weapon,{damage:distance<=50?4:distance<=100?3:2,damageType:'normal',camo:true,moabBonus:distance<=50?26:distance<=100?12:8,ceramicBonus:distance<=50?26:distance<=100?12:8}));
      }
    }
    if(t.type==='mermonkey') {
      if(a>=3 && target && this.magicDue(t,'tentacles',a===5?1.5:a===4?2.5:3))this.burst(t,this.source(weapon,{damage:a===5?32:a===4?12:8,pierce:a===5?50:a===4?25:15,
        ceramicBonus:a>=4?6:0,damageType:'shatter',radius:0}),weapon.range);
      if(c>=3 && this.magicDue(t,'trance',c===5?3:12)) {
        let budget=(c>=4?12:6)+(b?2:0);
        const origin=c>=4 && t.magicNext?.totem !== undefined ? t.targetPoint : t;
        const entranced=this.magicTargets({...weapon,...origin},weapon.range);
        for(const bloon of entranced) {
          const moab=this.isMoab(bloon),cost=moab?bloon.type==='ddt'?4:3:bloon.type==='ceramic' && c===3?2:1;
          if(cost>budget || moab && (c===3 || c===4 && !['moab','ddt'].includes(bloon.type)))continue;
          budget-=cost;bloon.camo=false;
          const dot=bloon.burn;
          if(dot) {const damage=Math.min(c===5?10000:c===4?125:50,Math.ceil(Math.max(0,dot.until-this.tick)/dot.interval)*dot.damage);bloon.burn=undefined;
            this.applyHit(bloon,this.source(weapon,{damage,damageType:'normal',camo:true,moabBonus:0}));}
          // uncertain: trance orbit renders as a stationary hold, retaining original track progress.
          if(bloon.type!=='bad')bloon.stunnedUntil=this.tick+360;
        }
      }
    }
  }
  private secondary(t: Tower) {
    if (t.orbit && this.tick >= t.orbitReady) {
      t.orbitReady = this.tick + 3;
      this.burst(t, this.source(t, { kind: 'ring', damageType: 'normal', camo: true, frozen: true, damage: 4, ceramicBonus: 4, pierce: 200 }), t.orbit);
    }
    if (!t.secondaryCooldown || this.tick < t.secondaryReady) return;
    const target = this.bloons.find(b => this.canHit(b, t) && (t.meteor || this.isMoab(b)) &&
      (t.meteor || Math.hypot(this.posOf(b).x - t.x, this.posOf(b).y - t.y) <= t.range));
    if (!target) return;
    t.secondaryReady = this.tick + t.secondaryCooldown * 60;
    if (t.meteor && ['sub', 'ace', 'heli', 'buccaneer'].includes(t.type)) {
      // uncertain: consolidate auxiliary missiles/aircraft into one periodic blast;
      // omitted projectile travel and separate weapon targeting use the shared target above.
      const normal = t.type === 'ace' && t.tiers[0] === 5;
      this.burst(this.posOf(target), this.source(t, { kind: 'bomb', damage: t.meteor,
        damageType: normal ? 'normal' : 'explosion', pierce: 40, moabBonus: 0, ceramicBonus: 0,
        radius: 0, shards: 0, rotor: 0 }), 35);
    } else if (t.meteor) {
      this.applyHit(target, this.source(t, { kind: 'projectile', damageType: 'normal', damage: t.meteor, moabBonus: 0 }));
      // uncertain: meteor blast radius/pierce are unspecified; use 30 units and 30 targets.
      this.burst(this.posOf(target), this.source(t, { damage: 5, damageType: 'explosion', pierce: 30 }), 30);
    } else {
      const p = this.posOf(target), angle = Math.atan2(p.y - t.y, p.x - t.x);
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
    if(this.towers.some(t=>t.type==='ninja' && t.degree) && this.isMoab(b) && b.type!=='bad') {b.hp*=0.75;b.slow=0.5;}
    for(const t of this.towers) if(!t.degree && t.type==='ninja' && t.tiers[1]===5 && this.tick<t.abilityUntil && this.isMoab(b)) b.hp*=0.75;
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
      const p = t.pursuit && first ? this.posOf(first) : t.targetPoint;
      const dx = p.x - t.flight.x, dy = p.y - t.flight.y, distance = Math.hypot(dx, dy);
      const amount = Math.min(distance, t.moveSpeed * DT);
      if (distance) { t.flight.x += dx / distance * amount; t.flight.y += dy / distance * amount; }
    }
  }
  private primary(t: {type:TowerKind}) { return ['dart','boomerang','bomb','tack','ice','glue'].includes(t.type); }
  private villageRange(t:Tower) { return t.range*(1+(t.ultra??0)*0.015)*((t.overclockUntil??0)>this.tick?1.1:1); }
  private villages(t:Pt) { return this.towers.filter(v=>v!==t && v.type==='village' && Math.hypot(v.x-t.x,v.y-t.y)<=this.villageRange(v)); }
  private freeDartSource() { return this.towers.find(t=>t.type==='village' && (t.freeDarts??0)>0); }
  private discount(p:Pt) {
    const villages=this.villages(p);
    return villages.some(v=>v.tiers[2]>=1)?0.1+Math.min(3,villages.filter(v=>v.tiers[2]>=2).length)*0.05:0;
  }
  shopPrice(type:TowerKind) {
    if(type==='dart' && this.freeDartSource())return 0;
    // Copies, not the village objects: villages(p) skips p itself, which hid a lone village's own discount.
    const points=[...this.towers.filter(t=>t.type==='village').map(v=>({x:v.x,y:v.y})),...(this.hero?.kind==='rosalia'?[{...this.hero.home}]:[])];
    return Math.min(this.towerPrice(type,TOWERS[type].cost),...points.map(p=>this.towerPrice(type,TOWERS[type].cost,p)));
  }
  canUpgradeTower(index:number,path:number) {const t=this.towers[index];return !!t && !t.degree && !t.mergedInto && canUpgrade(t.tiers,path) && this.supportUpgradeAllowed(t,path);}
  private opolisFarms(t:Tower) { return this.towers.filter(a=>a.type==='farm' && !a.tiers.includes(5) && Math.hypot(a.x-t.x,a.y-t.y)<=this.villageRange(t)); }
  upgradePrice(index:number,path:number) {
    const t=this.towers[index]; if(!t || !canUpgrade(t.tiers,path))return Infinity;
    if(t.type==='village' && path===2 && t.tiers[2]===4)return this.opolisFarms(t).length*5000;
    const tier=t.tiers[path]+1, villages=this.villages(t);
    if(this.primary(t) && villages.some(v=>v.tiers[0]>=4 && tier<=(v.tiers[0]===5?2:1)))return 0;
    return this.towerPrice(t.type,TOWERS[t.type].paths[path][tier-1].cost,t,tier);
  }
  sellValue(t:Tower) {return Math.floor(t.cost*(t.type==='farm' && t.tiers[2]>=2?80:70)/100);}
  private supportUpgradeAllowed(t:Tower,path:number) {
    if(t.type==='village' && path===2 && t.tiers[2]===4)return this.opolisFarms(t).length>0;
    if(t.type!=='beast')return true;
    if(path===0 && !this.water.some(w=>Math.hypot(t.x-Math.max(w.x,Math.min(t.x,w.x+w.width)),t.y-Math.max(w.y,Math.min(t.y,w.y+w.height)))<=60))return false;
    if(path===2 && !t.tiers[2] && this.nearTrack(t,60).length===0)return false;
    if(t.tiers[path]===4)return (t.merges??[]).filter(a=>this.towers.includes(a) && a.tiers[path]===4).length>=3;
    return true;
  }
  setSupportTarget(index:number,targetIndex:number) {
    const t=this.towers[index], target=this.towers[targetIndex];
    if(this.gameOver || !t || !target || t===target || t.type!=='engineer' || t.tiers[1]<4 && !t.degree)return false;
    t.supportTarget=target;return true;
  }
  mergeBeast(sourceIndex:number,targetIndex:number,path:number) {
    const source=this.towers[sourceIndex],target=this.towers[targetIndex];
    if(this.gameOver || !Number.isInteger(path) || path<0 || path>2 || !source || !target || source===target || source.type!=='beast' || target.type!=='beast' || source.mergedInto || target.mergedInto || source.merges?.length || source.tiers[path]<1 || target.tiers[path]<1)return false;
    source.mergedInto=target;target.merges??=[];target.merges.push(source);return true;
  }
  private beastPower(t:Tower,path:number) {
    const power=[0,1,3,8,16,36], cap=[0,1,6,24,64,132];
    return Math.min(cap[t.tiers[path]],power[t.tiers[path]]+(t.merges??[]).filter(a=>this.towers.includes(a)).reduce((sum,a)=>sum+power[a.tiers[path]],0));
  }
  private villageAbilityMult(t:Tower) {
    return this.primary(t) && this.villages(t).some(v=>v.tiers[0]===5)?0.75:this.primary(t) && this.villages(t).some(v=>v.tiers[0]>=4)?0.85:1;
  }
  effectiveStats(t:Tower):Tower {
    const weapon={...t}, villages=this.villages(t);
    if(t.degree) {
      // Paragons reject ordinary buffs; Ascended Shadow is the explicit camo exception.
      if(this.towers.some(a=>a.type==='ninja' && a.degree))weapon.camo=true;
      return weapon;
    }
    if(villages.some(v=>v.tiers[2]>=3))weapon.popCashBonus=0.5;
    if(villages.length)weapon.range*=1.1;
    if(villages.some(v=>v.tiers[0]>=2))weapon.cooldown*=0.85;
    if(villages.some(v=>v.tiers[1]>=2) || this.towers.some(a=>a.type==='ninja' && a.degree))weapon.camo=true;
    if(villages.some(v=>v.tiers[1]>=3)) {weapon.damageType='normal';weapon.lead=true;weapon.frozen=true;weapon.universal=true;}
    if(this.primary(t)) {
      const level=Math.max(0,...villages.map(v=>v.tiers[0]));
      if(level>=3){weapon.pierce+=level===5?3:1;weapon.range=weapon.range*1.1+(level>=4?5:0);weapon.projectileSpeed*=1.25;}
      if(this.towers.some(a=>a.type==='boomerang' && a.degree))weapon.cooldown*=0.9;
    }
    const arms=Math.max(1,...this.towers.filter(v=>v.type==='village' && v.ability?.kind==='arms' && v.abilityUntil>this.tick).map(v=>v.tiers[1]===5?2:1.5));
    weapon.cooldown/=arms;weapon.pierce*=arms;
    weapon.cooldown*=1-(t.ultra??0)*0.04;
    if((t.overclockUntil??0)>this.tick)weapon.cooldown*=0.6;
    if(t.type==='beast') {
      const path=t.tiers.findIndex(n=>n>2)>=0?t.tiers.findIndex(n=>n>2):t.tiers.findIndex(n=>n>0);
      if(path>=0) {
        const tier=t.tiers[path],min=[0,1,3,8,16,36][tier],max=[0,1,6,24,64,132][tier];
        const ratio=max===min?0:(this.beastPower(t,path)-min)/(max-min);
        const damageMax=[[1,4,36,90,1800],[1,4,16,60,2000],[1,2,3,6,90]][path][tier-1];
        const pierceMax=[[1,12,30,60,90],[5,20,26,45,83],[3,12,90,90,450]][path][tier-1];
        weapon.damage+=(damageMax-weapon.damage)*ratio;weapon.pierce+=(pierceMax-weapon.pierce)*ratio;
        weapon.cooldown*=1-ratio*0.3439;
      }
    }
    return weapon;
  }
  powerNeedsPoint(id:string) { const k=POWER_BY_ID[id]?.kind; return k==='trap' || k==='tower'; }
  powerActive(id:string) { return this.activePowers.some(p=>p.id===id && p.until>this.tick); }
  /** Closest track point within 20 units of p, on any lane. */
  private trackSpot(p:Pt) {
    let best:{lane:number;dist:number}|undefined,bestD=20;
    this.lanes.forEach((_,lane)=>{for(let dist=0;dist<=this.laneLen(lane);dist+=2){const q=this.posAt(dist,lane),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<=bestD){bestD=d;best={lane,dist};}}});
    return best;
  }
  canUsePower(id:string,point?:Pt) {
    if(this.gameOver || this.rules.noPowers || !POWER_IMPL.has(id))return false;
    if(!this.powerNeedsPoint(id))return true;
    if(!point || !Number.isFinite(point.x) || !Number.isFinite(point.y))return false;
    if(POWER_BY_ID[id].kind==='trap')return !!this.trackSpot(point);
    const r=POWER_UNIT_R[id],{x,y}=point,h=this.hero;
    if(x<r || y<r || x>960-r || y>540-r || !this.offTrack(x,y,r) || this.blocked.some(o=>Math.hypot(o.x-x,o.y-y)<o.r+r)
      || this.powerUnits.some(u=>Math.hypot(u.x-x,u.y-y)<u.r+r) || this.towers.some(t=>!t.mergedInto && Math.hypot(t.x-x,t.y-y)<TOWERS[t.type].footprint+r)
      || h && Math.hypot(h.x-x,h.y-y)<HEROES[h.kind].footprint+r)return false;
    if(id==='pontoon')return this.water.some(w=>x-r>=w.x && x+r<=w.x+w.width && y-r>=w.y && y+r<=w.y+w.height);
    return !this.water.some(w=>Math.hypot(x-Math.max(w.x,Math.min(x,w.x+w.width)),y-Math.max(w.y,Math.min(y,w.y+w.height)))<r);
  }
  /** Apply a power's sim effect. The caller (UI) owns the inventory and decrements it only when this returns true. */
  usePower(id:string,point?:Pt,upgraded=false) {
    if(!this.canUsePower(id,point))return false;
    const fx=POWER_BY_ID[id].fx,secs=(n:number)=>this.tick+n*60;
    if(id==='super_monkey_storm')for(const b of [...this.bloons])if(this.bloons.includes(b))this.powerHit(b,upgraded?fx.damageUpgraded:fx.damage);
    if(id==='monkey_boost' || id==='time_stop')this.activePowers.push({id,until:secs(upgraded?fx.durationUpgraded:fx.duration)});
    if(id==='thrive'){this.thrive={untilRound:this.round+1,mult:upgraded?fx.cashMultUpgraded:fx.cashMult};this.activePowers=this.activePowers.filter(p=>p.id!=='thrive');this.activePowers.push({id,until:Infinity});}
    if(id==='cash_drop')this.cash+=fx.cash; // uncertain: crate collection is instant; not income, so mode multipliers do not apply
    if(POWER_BY_ID[id].kind==='trap') {
      const spot=this.trackSpot(point!)!;
      const left=id==='road_spikes'?(upgraded?fx.popsUpgraded:fx.pops):id==='glue_trap'?fx.bloons:id==='moab_mine'?fx.targets:(upgraded?fx.bloonsUpgraded:fx.bloons);
      this.powerTraps.push({id,...spot,left,upgraded,hit:new Map()});
    }
    if(POWER_UNIT_R[id]) {
      const range=id==='energizing_totem'?fx.range:id==='banana_farmer'?(upgraded?fx.rangeUpgraded:fx.range):id==='banana_farmer_pro'?80:0;
      this.powerUnits.push({id,x:point!.x,y:point!.y,r:POWER_UNIT_R[id],range,untilRound:id==='energizing_totem'?this.round+fx.rounds-(this.roundActive?1:0):Infinity});
    }
    return true;
  }
  /** Power damage: hits frozen/lead/camo, and MOAB-class damage stops at the outer layer (no spill into children). */
  private powerHit(b:Bloon,damage:number) {
    this.applyHit(b,this.source({...TOWERS.dart.base,...this.posOf(b),damage:this.isMoab(b)?Math.min(damage,b.hp):damage,pierce:1,damageType:'normal',camo:true,frozen:true,lead:true}));
  }
  // ponytail: speed powers scale main attacks only; ability/secondary timers, hero attacks and aircraft movement ignore them.
  /** Attack-speed factor from powers: Monkey Boost x2, Time Stop x0.6, Energizing Totem cooldown x0.75. Paragons are exempt. */
  private powerAttackSpeed(t:Tower) {
    if(t.degree)return 1;
    const totem=this.powerUnits.some(u=>u.id==='energizing_totem' && Math.hypot(u.x-t.x,u.y-t.y)<=u.range);
    return (this.powerActive('monkey_boost')?POWER_BY_ID.monkey_boost.fx.speedMult:1)*(this.powerActive('time_stop')?POWER_BY_ID.time_stop.fx.towerSpeedMult:1)/(totem?POWER_BY_ID.energizing_totem.fx.cooldownMult:1);
  }
  private runPowers() {
    this.activePowers=this.activePowers.filter(p=>p.until>this.tick);
    for(const u of this.powerUnits)if(u.range && u.id!=='energizing_totem')for(const banana of [...this.collectibles])
      if(Math.hypot(u.x-banana.x,u.y-banana.y)<=u.range)this.collectBanana(banana);
    for(const trap of this.powerTraps)for(const b of [...this.bloons]) {
      if(trap.left<=0)break;
      const last=trap.hit.get(b.id);
      if(!this.bloons.includes(b) || (b.lane??0)!==trap.lane || Math.abs(b.dist-trap.dist)>10 || last!==undefined && (trap.id!=='moab_mine' || this.tick-last<POWER_BY_ID.moab_mine.fx.cooldown*60))continue;
      const moab=this.isMoab(b);
      if(trap.id==='road_spikes')this.powerHit(b,1);
      // uncertain: Supersize Glue Trap prose is cut off; upgraded glue also takes non-BAD MOABs.
      else if(trap.id==='glue_trap'){if(moab && (!trap.upgraded || b.type==='bad'))continue;b.glue={until:this.tick+POWER_BY_ID.glue_trap.fx.duration*60,next:Infinity,layers:99,stats:{...TOWERS.glue.base,slow:POWER_BY_ID.glue_trap.fx.slow,moabSlow:POWER_BY_ID.glue_trap.fx.slow,dotDamage:0,dotMoabBonus:0}};}
      else if(trap.id==='moab_mine'){if(!moab)continue;this.powerHit(b,trap.upgraded?POWER_BY_ID.moab_mine.fx.damageUpgraded:POWER_BY_ID.moab_mine.fx.damage);}
      else{if(!b.camo)continue;b.camo=false;}
      trap.hit.set(b.id,this.tick);trap.left--;
    }
    this.powerTraps=this.powerTraps.filter(t=>t.left>0);
  }
  collect(index:number) {
    const t=this.towers[index];if(this.gameOver || !t)return false;
    let collected=false;
    if((t.bank??0)>0){this.earnIncome(t.bank!);t.bank=0;collected=true;}
    for(const banana of [...this.collectibles])if(banana.owner===t){this.collectBanana(banana);collected=true;}
    for(const trap of [...this.roadItems])if(trap.owner===t && trap.kind==='trap' && trap.stored>0){this.credit(trap.stored*(t.tiers[2]===5?3:2)*popCashMultiplier(this.round)*this.rules.cashMult);this.roadItems.splice(this.roadItems.indexOf(trap),1);collected=true;}
    return collected;
  }
  collectAt(p:Pt) {
    if(this.gameOver || !Number.isFinite(p.x) || !Number.isFinite(p.y))return false;
    let collected=false;
    for(const banana of [...this.collectibles])if(Math.hypot(p.x-banana.x,p.y-banana.y)<=(banana.owner.tiers[2]>=1?75:50)){this.collectBanana(banana);collected=true;}
    return collected;
  }
  private collectBanana(banana:Collectible,fraction=1) {
    banana.owner.farmAccounted=(banana.owner.farmAccounted??0)+banana.value;
    this.earnIncome(banana.value*fraction);this.collectibles.splice(this.collectibles.indexOf(banana),1);
  }
  private runCollectibles() {
    for(const banana of [...this.collectibles]) {
      if(!this.towers.includes(banana.owner)){this.collectibles.splice(this.collectibles.indexOf(banana),1);continue;}
      const wallStreet=this.towers.some(t=>t.type==='farm' && t.tiers[2]===5 && Math.hypot(t.x-banana.x,t.y-banana.y)<=t.range);
      if(wallStreet)this.collectBanana(banana);
      else if(banana.until<=this.tick)this.collectBanana(banana,banana.owner.tiers[2]>=2?0.85:banana.owner.tiers[2]>=1?0.5:0);
    }
  }
  private credit(amount:number,thrive=true) {
    if(thrive && this.round<=this.thrive.untilRound)amount*=this.thrive.mult;
    // uncertain: the loan prose omits repayment fraction; half of subsequent income repays debt.
    let repayment=amount*0.5;
    for(const t of this.towers)if((t.debt??0)>0){const paid=Math.min(t.debt!,repayment);t.debt!-=paid;repayment-=paid;amount-=paid;}
    this.cash+=amount;
  }
  /** Income (round bonus, farms, banks, heroes): scaled once by the mode's incomeMult before loan repayment. */
  earnIncome(amount:number) { this.credit(amount*this.rules.incomeMult); }
  /** Whole-bloon payout (hooks, vines, hero kills): its RBE as pop cash, with mode, bloon and gold multipliers. */
  payoutWhole(b:Bloon,mult=1) { this.credit(BLOONS[b.type].rbe*popCashMultiplier(this.round)*mult*this.rules.cashMult*(b.cashMult??1)*((b.goldUntil??0)>this.tick?2:1)); }
  roundIncome(t:Tower) {
    let income=t.opolisIncome??t.income;
    if(t.type==='farm') {
      const [a,b,c]=t.tiers;
      if(b>=3)income=225+(a===1?100:a===2?200:0);
      else if(c>=3)income=(16+a*2)*(c>=4?70:20)*(b>=2?1.25:1)+(c===5?4000:0);
      else income=[80,120,160,320,1500,6000][a]*(b>=2?1.25:1);
      if(a===4 && this.towers.some(f=>f.type==='farm' && f.tiers[0]===5))income*=1.25;
    }
    if(t.type==='buccaneer' && t.tiers[2]>=3)income*=1+Math.min(1,this.towers.filter(f=>f.type==='farm' && f.tiers[2]>=4).length*0.1);
    if(this.villages(t).some(v=>v.tiers[2]>=4))income*=1.2;
    if(t.type==='farm')income/= (1-(t.ultra??0)*0.04)*((t.overclockUntil??0)>this.tick?0.6:1);
    return income;
  }
  private supportRoundEnd() {
    const suppress=this.towers.some(t=>t.degree && t.type==='druid' && t.abilityUntil>this.tick);
    for(const t of this.towers) {
      if(t.type==='farm' && t.tiers[1]>=3) {
        const cap=t.tiers[1]>=4?10000:7000;
        t.bank=Math.min(cap,((t.bank??0)+(suppress?0:this.roundIncome(t)))*1.15);
        if(t.tiers[2]>=2 && t.bank>=cap)this.collect(this.towers.indexOf(t));
      } else if(!suppress)this.earnIncome(Math.max(0,this.roundIncome(t)-(t.type==='farm'?(t.farmAccounted??0):0)));
      if(t.type==='farm' && t.tiers[2]===5)this.lives+=15;
      if(t.type==='village' && t.tiers[2]>=4)t.freeDarts=(t.freeDarts??0)+1;
      if(t.type==='engineer' && t.degree)t.cooldown/=1.3;
      if(t.type==='druid' && t.degree)this.lives++;
    }
    this.collectibles=[];
    this.roadItems=this.roadItems.filter(item=>this.round-item.round<item.carry || item.kind==='trap');
  }
  canMakeParagon(index:number) {
    const t=this.towers[index];if(this.gameOver || !t || t.degree || !t.tiers.includes(5) || !PARAGONS[t.type] || this.towers.some(a=>a.type===t.type && a.degree))return false;
    return [0,1,2].every(path=>this.towers.some(a=>a.type===t.type && !a.degree && a.tiers[path]===5));
  }
  makeParagon(index:number,investment=0) {
    const t=this.towers[index];if(!this.canMakeParagon(index) || !Number.isFinite(investment) || investment<0)return false;
    const def=PARAGONS[t.type]!,cost=this.price(def.cost)+investment;
    if(this.cash<cost)return false;
    const sacrifices=this.towers.filter(a=>a.type===t.type), value=sacrifices.reduce((sum,a)=>sum+a.cost,0),pops=sacrifices.reduce((sum,a)=>sum+(a.paragonPops??0),0);
    // uncertain: wiki omits degree power formula; use deterministic spending/pops with a hard 1..100 cap.
    const degree=Math.min(100,1+Math.floor(Math.sqrt((Math.max(0,value-50000)+investment)/1000+pops/1000)));
    this.cash-=cost;this.towers=this.towers.filter(a=>a.type!==t.type || a===t);
    this.paragonize(t,degree);t.cost=value+cost;
    this.roadItems=this.roadItems.filter(i=>!sacrifices.includes(i.owner));this.sentries=this.sentries.filter(i=>!sacrifices.includes(i.owner));
    return true;
  }
  saveState() {
    const out: Record<string, unknown> = {};
    for (const k of SAVE_FIELDS) out[k] = k === 'towers' ? this.towers.map(t => encodeState(t, this.towers, true)) : encodeState(this[k], this.towers);
    return out;
  }
  /** Load a saveState() result between rounds; leaves the Sim untouched and returns false if it does not decode. */
  loadState(state: any) {
    try {
      if (!state || !Array.isArray(state.towers)) return false;
      const towers = state.towers.map(() => ({})) as Tower[], decoded: Record<string, unknown> = {};
      state.towers.forEach((t: unknown, i: number) => Object.assign(towers[i], decodeState(t, towers)));
      for (const k of SAVE_FIELDS) if (k !== 'towers' && k in state) decoded[k] = decodeState(state[k], towers);
      if (!Number.isFinite(decoded.cash) || !Number.isFinite(decoded.lives) || !Number.isFinite(decoded.round)) return false;
      Object.assign(this, decoded, { towers, bloons: [], darts: [], spawnQ: [], roundActive: false });
      this.rng = mulberry32((this.tick + this.nextId) >>> 0); // uncertain: RNG position is not saved; reseed deterministically
      return true;
    } catch { return false; }
  }
  /** Turn t into its type's paragon at the given degree (used by makeParagon and run restore). */
  paragonize(t:Tower,degree:number) {
    Object.assign(t,PARAGONS[t.type]!.stats,{degree,tiers:[0,0,0],cd:0,magicNext:{},abilityReady:this.tick,abilityUntil:0});
    t.damage*=1+(degree-1)*0.05;t.pierce*=1+(degree-1)*0.025;t.cooldown/=1+(degree-1)*0.01;
  }
  private activateSupport(t:Tower) {
    const kind=t.ability?.kind;
    if(kind==='loan') {
      if(!this.roundActive || this.tick-this.roundStartTick>180*60 || (t.roundUses??0)>=2 || (t.debt??0)>0)return false;
      t.roundUses=(t.roundUses??0)+1;const cash=9000*(this.villages(t).some(v=>v.tiers[2]>=4)?1.2:1);
      this.credit(cash,false);if(t.tiers[1]===4)t.debt=cash;
    }
    if(kind==='arms') {
      const active=this.towers.filter(v=>v.type==='village' && v.ability?.kind==='arms' && v.abilityUntil>this.tick);
      if(active.some(v=>v.tiers[1]>=t.tiers[1]))return false;
      for(const v of active)v.abilityUntil=this.tick;
    }
    if(kind==='overclock') {
      const target=t.supportTarget && this.towers.includes(t.supportTarget)?t.supportTarget:this.towers.find(a=>a!==t && !a.degree && !a.mergedInto);
      if(!target || t.tiers[1]===5 && (t.roundUses??0)>=10)return false;
      target.overclockUntil=this.tick+(t.tiers[1]===5?60:60-Math.max(...target.tiers)*6)*60;
      if(t.tiers[1]===5)target.ultra=Math.min(10,(target.ultra??0)+1);
      t.roundUses=(t.roundUses??0)+1;
    }
    if(kind==='stomp') {
      const weapon=this.effectiveStats(t),a=t.ability!;
      this.burst(t,this.source(weapon,{damage:a.damage,pierce:a.count,stun:t.tiers[1]===5?12:6,moabStun:t.tiers[1]===5?4:2}),a.pierce);
    }
    if(kind==='storm')this.spikeStorm(t,this.effectiveStats(t));
    if(kind==='paragon') {
      if(t.type==='buccaneer') {
        const b=[...this.bloons].sort((a,b)=>BLOONS[b.type].rbe-BLOONS[a.type].rbe)[0];
        if(!b)return false;this.payoutWhole(b);this.bloons.splice(this.bloons.indexOf(b),1);
      } else if(t.type==='engineer') {
        this.sentries.push({...t.targetPoint,owner:t,until:Infinity,next:0,variant:0,stats:{...t,damage:300,range:2000,cooldown:0.1}});
        const target=t.supportTarget;if(target && this.towers.includes(target))target.overclockUntil=this.tick+(target.degree?15:60)*60;
      } else if(t.type==='spike')this.spikeStorm(t,t);
      else this.burst(t,this.source(t,{damage:t.ability!.damage,range:2000,pierce:1000,stun:t.type==='ice'?10:2,moabStun:t.type==='ice'?5:1,camo:true}),t.type==='ice'||t.type==='ace'||t.type==='sub'?2000:100);
    }
    return true;
  }
  private nearTrack(p:Pt,range:number,lane=0) {
    const distances:number[]=[];
    for(let dist=0;dist<=this.laneLen(lane);dist+=4){const point=this.posAt(dist,lane);if(Math.hypot(p.x-point.x,p.y-point.y)<=range)distances.push(dist);}
    return distances;
  }
  /** Lane whose track passes closest to p (road items go on the lane nearest their tower/target). */
  private nearestLane(p:Pt) {
    let best=0,bestD=Infinity;
    this.lanes.forEach((_,lane)=>{for(let dist=0;dist<=this.laneLen(lane);dist+=8){const q=this.posAt(dist,lane),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<bestD){bestD=d;best=lane;}}});
    return best;
  }
  private roadItem(t:Tower,stats:TowerStats,dist:number,kind:RoadItem['kind']='spike',life=stats.lifespan,carry=0,lane=0) {
    const item:RoadItem={owner:t,dist,kind,lane,until:this.tick+life*60,round:this.round,carry,pierce:stats.pierce,stats:{...stats,radius:0,projectileSpeed:0},stored:0,hit:new Set()};
    this.roadItems.push(item);return item;
  }
  private spikeStorm(t:Tower,weapon:Tower) {
    // uncertain: deploy all 204 deterministic seeded piles at activation rather than scheduling 4-pile clusters.
    const life=(t.tiers[1]===5?20:10)*(t.tiers[2]>=1?2:1);
    for(let n=0;n<204;n++){const lane=n%this.lanes.length;this.roadItem(t,weapon,this.rng()*this.laneLen(lane),'spike',life,t.tiers[1]===5?1:0,lane);}
  }
  private supportAttack(t:Tower,weapon:Tower) {
    if(t.degree) {
      if(t.type==='ninja')for(const b of this.bloons)if(b.type!=='bad'){b.slow=0.5;b.slowUntil=this.tick+2;}
      if((t.type==='druid'||t.type==='spike') && this.magicDue(t,'paragonTrack',0.5))for(const b of [...this.bloons])this.applyHit(b,this.source(weapon,{damage:50*(1+t.degree/20),camo:true,stripRegrow:t.type==='druid'}));
      if(t.type==='sniper' && this.roundActive && this.tick-this.roundStartTick>=10*60 && t.blitzRound!==this.round){t.blitzRound=this.round;this.earnIncome(20000);}
      if(t.type==='buccaneer' && this.magicDue(t,'autoHook',1)) {
        const b=this.bloons.find(b=>this.isMoab(b) && b.type!=='bad');if(b){this.payoutWhole(b);this.bloons.splice(this.bloons.indexOf(b),1);}
      }
      if(t.type==='druid'){weapon.damage*=1+Math.min(10,this.cash/100000);if(t.abilityUntil>this.tick){weapon.damage*=2;this.cash=Math.max(0,this.cash-10*DT);}}
      if(t.type!=='spike')return false;
    }
    if(t.type==='farm') {
      if(this.roundActive && t.tiers[1]<3 && t.tiers[2]<3) {
        const count=t.tiers[0]>=4?5:[4,6,8,16][t.tiers[0]];
        if((t.farmCreated??0)<count && this.tick>=(t.farmNext??0)) {
          // uncertain: wiki gives production per round without spawn timing; spread over 60s,
          // then settle any unproduced/uncollected income at round end as required by this task.
          const angle=this.rng()*Math.PI*2, distance=this.rng()*t.range;
          this.collectibles.push({owner:t,x:t.x+Math.cos(angle)*distance,y:t.y+Math.sin(angle)*distance,value:this.roundIncome(t)/count,until:this.tick+(t.tiers[1]>=1?30:15)*60});
          t.farmCreated=(t.farmCreated??0)+1;t.farmNext=this.tick+60/count*60;
        }
      }
      return true;
    }
    if(t.type==='village') {
      if(t.tiers[1]>=1)for(const b of this.bloons)if(Math.hypot(this.posOf(b).x-t.x,this.posOf(b).y-t.y)<=this.villageRange(t))b.regrow=false;
      if(t.tiers[0]===5 && this.magicDue(t,'ballista',2.5*weapon.cooldown)) {
        const target=this.magicTargets({...weapon,camo:true,damageType:'normal'},2000)[0];
        if(target)this.burst(this.posOf(target),this.source(weapon,{damage:10,ceramicBonus:270,moabBonus:270,pierce:100,damageType:'normal',camo:true}),90);
      }
      return true;
    }
    if(t.type==='spike') {
      if(t.tiers[1]===5 && this.roundActive && this.magicDue(t,'carpet',15))this.spikeStorm(t,weapon);
      let cooldown=weapon.cooldown;
      if(t.tiers[2]>=2 && this.roundActive && this.tick-this.roundStartTick<(t.tiers[2]===5?10:3)*60)cooldown/=4;
      if(this.magicDue(t,'pile',cooldown)) {
        const lane=this.nearestLane(t),distances=this.nearTrack(t,weapon.range,lane);
        if(distances.length){
          let dist=distances[Math.floor(this.rng()*distances.length)];
          if(t.tiers[2]>=2){const target=this.nearTrack(t.targetPoint,8,lane).filter(d=>distances.includes(d));dist=target[0]??distances[distances.length-1];}
          const carry=t.degree?5:t.tiers[2]>=3?t.tiers[2]-2:0;
          if(t.tiers[2]===5 && t.tiers[0]>=1)weapon.pierce=85;
          this.roadItem(t,weapon,dist,'spike',weapon.lifespan,carry,lane);t.shots++;
        }
      }
      return true;
    }
    if(t.type==='engineer') {
      const [a,b,c]=t.tiers;
      if(a>=1 && this.magicDue(t,'sentry',a>=2?5:10)) {
        const variant=(t.shots??0)%4;
        // uncertain: Expert per-type stats are omitted; original estimates preserve the four damage types.
        const damage=a===5?3:a===4?variant===0?4:2:1;
        const stats={...weapon,damage,range:(a===5?50:45)+(b?4:0),cooldown:a===5?0.06:a>=3?0.475:0.95,pierce:a===5?c?10:5:c?3:2,radius:a===4 && variant===1?20:0,damageType:a===5?'plasma' as const:a===4?(['normal','explosion','cold','energy'] as const)[variant]:weapon.damageType,stun:c>=2 && a>=3?1:0};
        this.sentries.push({x:t.x+Math.cos(this.tick)*12,y:t.y+Math.sin(this.tick)*12,owner:t,until:this.tick+(a>=2?30:25)*60,next:0,stats,variant});
      }
      if(b>=3 && this.magicDue(t,'foam',a>=2?1:2)) {
        // Nearest-to-target lane first, then any other lane the engineer can reach.
        const first=this.nearestLane(t.targetPoint),lanes=[first,...this.lanes.keys()].filter((l,i,a)=>a.indexOf(l)===i);
        let lane=first,dist:number|undefined;
        for(const l of lanes){
          const distances=this.nearTrack(t.targetPoint,weapon.range,l).sort((a,b)=>{const p=this.posAt(a,l),q=this.posAt(b,l);return Math.hypot(p.x-t.targetPoint.x,p.y-t.targetPoint.y)-Math.hypot(q.x-t.targetPoint.x,q.y-t.targetPoint.y);});
          const near=this.nearTrack(t,weapon.range,l);dist=distances.find(d=>near.includes(d))??near[0];
          if(dist!==undefined){lane=l;break;}
        }
        if(dist!==undefined)this.roadItem(t,{...weapon,damage:0,pierce:b===5?24:b===4?14:10,camo:true,stripCamo:true,stripRegrow:true,damageType:'normal'},dist,'foam',10,0,lane);
      }
      if(c>=4 && !this.roadItems.some(i=>i.owner===t && i.kind==='trap') && this.magicDue(t,'trap',c===5?4.6:a>=2?4.3:5)) {
        const lane=this.nearestLane(t),near=this.nearTrack(t,weapon.range,lane);if(near.length)this.roadItem(t,{...weapon,damage:0,damageType:'normal',lead:true,frozen:true,pierce:c===5?10000:500},near[Math.floor(near.length/2)],'trap',Infinity,0,lane);
      }
    }
    if(t.type==='beast') {
      if(this.magicDue(t,'beast',weapon.cooldown)) {
        const target=this.magicTargets(weapon,weapon.range)[0];
        if(target) {
          const bird=t.tiers[2]>0 && t.tiers[0]<3 && t.tiers[1]<3;
          if(bird && target.type!=='bad')target.dist=Math.max(0,target.dist-30);
          const bonus=t.tiers[1]>=3 && (target.stunnedUntil??0)>this.tick?weapon.damage*0.5:0;
          this.burst(this.posOf(target),this.source(weapon,{damage:weapon.damage+bonus}),weapon.radius);t.shots++;
        }
      }
      return true;
    }
    return false;
  }
  private runRoadItems() {
    for(const sentry of [...this.sentries]) {
      if(!this.towers.includes(sentry.owner) || sentry.until<=this.tick) {
        if(sentry.owner.tiers[0]===5)this.burst(sentry,this.source({...sentry.stats,...sentry},{damage:100,pierce:50,damageType:'normal'}),30);
        this.sentries.splice(this.sentries.indexOf(sentry),1);continue;
      }
      if(this.tick>=sentry.next) {
        const target=this.bloons.find(b=>this.canHit(b,sentry.stats) && Math.hypot(this.posOf(b).x-sentry.x,this.posOf(b).y-sentry.y)<=sentry.stats.range+7);
        if(target){this.burst(this.posOf(target),{...this.source({...sentry.stats,...sentry}),owner:sentry.owner},sentry.stats.radius||2);sentry.next=this.tick+sentry.stats.cooldown*60;}
      }
    }
    for(const item of [...this.roadItems]) {
      const owner=item.owner;
      if(!this.towers.includes(owner)) {this.roadItems.splice(this.roadItems.indexOf(item),1);continue;}
      if(item.until>this.tick)for(const b of [...this.bloons]) {
        if(item.pierce<=0 || (b.lane??0)!==item.lane || Math.abs(b.dist-item.dist)>10 || (item.kind!=='spike' && item.hit.has(b.id)) || !this.canHit(b,item.stats))continue;
        if(item.kind==='trap') {
          const rbe=b.fortified && owner.tiers[1]<2?BLOONS[b.type].fortifiedRbe:BLOONS[b.type].rbe;
          if(b.type==='bad' || this.isMoab(b) && owner.tiers[2]<5 || rbe>item.pierce)continue;
          if(owner.tiers[1]>=2)b.fortified=false;
          item.pierce-=rbe;item.stored+=rbe;this.bloons.splice(this.bloons.indexOf(b),1);
          this.effect(this.posAt(item.dist,item.lane),10,'trap');
        } else {
          item.hit.add(b.id);item.pierce--;this.applyHit(b,{...this.source({...item.stats,...this.posAt(item.dist,item.lane)}),owner});
          if(item.kind==='foam' && b.type==='lead')this.damage(b,b.hp,this.source({...item.stats,...this.posAt(item.dist,item.lane)},{damage:1}));
        }
      }
      if(item.kind==='trap' && item.stored>0 && (item.pierce<=0 || owner.tiers[1]>=1 || !this.bloons.length)) {
        this.credit(item.stored*(owner.tiers[2]===5?3:2)*popCashMultiplier(this.round)*this.rules.cashMult);item.pierce=0;
      }
      if(item.pierce<=0 || item.until<=this.tick) {
        if(item.kind==='spike' && (owner.tiers[0]>=4 || owner.degree)) {
          const superMine=owner.tiers[0]===5 || !!owner.degree,expired=item.until<=this.tick;
          this.burst(this.posAt(item.dist,item.lane),this.source({...item.stats,...this.posAt(item.dist,item.lane)},{damage:superMine?expired?1000:20:10,pierce:superMine && expired?60:30,damageType:'normal',ceramicBonus:superMine?expired?500:15:2,fortifiedBonus:superMine?expired?250:5:3,burnDamage:superMine?expired?2500:0:10,burnInterval:2,burnDuration:6.05}),superMine && expired?owner.tiers[2]?133:100:owner.tiers[2]?40:30);
          if(owner.degree && !item.fragment)for(let n=0;n<10;n++)this.roadItem(owner,{...item.stats,damage:100,pierce:20},Math.max(0,Math.min(this.laneLen(item.lane),item.dist+(n-5)*8)),'spike',60,1,item.lane).fragment=true;
        }
        this.roadItems.splice(this.roadItems.indexOf(item),1);
      }
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
    for (const event of this.delayed.filter(e=>e.at<=this.tick)) {
      if(!this.bloons.includes(event.target)) continue;
      const p=this.posOf(event.target);
      this.applyHit(event.target,this.source({...event.stats,...p},{damage:event.damage,moabBonus:0,damageType:'normal'}));
      this.burst(p,{...this.source({...event.stats,...p},{damage:event.splash,moabBonus:0,damageType:'normal',pierce:event.pierce}),hit:new Set([event.target.id])},event.radius);
    }
    this.delayed=this.delayed.filter(e=>e.at>this.tick);
    this.zones=this.zones.filter(z=>z.until>this.tick);
    for(const z of this.zones) if(this.tick>=z.next) {
      z.next=this.tick+z.interval*60;
      this.burst(z,{...this.source({...z.stats,...z}),hit:z.hit ?? new Set(),pierce:z.hit?Math.max(0,z.stats.pierce-z.hit.size):z.stats.pierce},z.radius);
    }
    for(const u of this.undead) {
      u.dist-=120*DT;u.life-=DT;
      const p=this.posAt(Math.max(0,u.dist),u.lane);
      this.burst(p,{...this.source({...u.stats,...p}),hit:u.hit,pierce:u.stats.pierce-u.hit.size},10);
    }
    this.undead=this.undead.filter(u=>u.life>0 && u.dist>=0 && u.hit.size<u.stats.pierce);
    this.spawnQ = this.spawnQ.filter(s => s.at > this.tick ? true : (this.spawn(s), false));
    for (const b of [...this.bloons]) {
      if (!this.bloons.includes(b)) continue;
      if (b.slowUntil !== undefined && b.slowUntil <= this.tick) { b.slow = undefined; b.slowUntil = undefined; }
      if (b.icicle && b.icicle.until > this.tick && b.icicle.next <= this.tick) {
        b.icicle.next = this.tick + 12;
        // uncertain: prose omits the attached icicle's radius; use 12 units.
        this.burst(this.posOf(b), { ...this.source({ ...b.icicle.stats, ...this.posOf(b) },
          { damageType: 'shatter', kind: 'projectile', damage: 6, pierce: 6, radius: 0, icicles: false, freezeDuration: 0, moabBonus: 0 }), hit: new Set([b.id]) }, 12);
        if (!this.bloons.includes(b)) continue;
      }
      if (b.burn && b.burn.until > this.tick && b.burn.next <= this.tick) {
        b.burn.next += b.burn.interval;
        this.damage(b, b.burn.damage, this.source({ ...b.burn.stats, ...this.posOf(b) }));
        if (!this.bloons.includes(b)) continue;
      }
      if (b.glue && b.glue.until <= this.tick) b.glue = undefined;
      if (b.glue && (b.glue.stats.dotDamage || this.isMoab(b) && b.glue.stats.dotMoabBonus) && b.glue.next <= this.tick) {
        const stats = b.glue.stats;
        b.glue.next += stats.dotInterval * 60;
        const damage = stats.dotDamage + (b.type.includes('ceramic') ? stats.dotCeramicBonus : 0) + (this.isMoab(b) ? stats.dotMoabBonus : 0);
        this.damage(b, damage, { ...stats, ...this.posOf(b), kind: 'projectile', damageType: stats.damageType === 'normal' ? 'normal' : 'acid', vx: 0, vy: 0, life: 0, hit: new Set() });
        if (!this.bloons.includes(b)) continue;
      }
      if (b.regrow && b.regrowMax && b.type !== b.regrowMax) {
        b.regrowAt ??= this.tick + 180; // uncertain: regrow period (s) not in data; 3 s per layer
        const up = REGROW_PARENT[b.type];
        if (up && this.tick >= b.regrowAt) { b.type = up; b.hp = BLOONS[up].hp; b.regrowAt = undefined; }
      }
      let slow = b.slow ?? 1;
      const hero = this.hero;
      if (hero?.kind === 'silas' && !['white', 'purple', 'zebra', 'bad'].includes(b.type) && Math.hypot(this.posOf(b).x - hero.x, this.posOf(b).y - hero.y) <= hero.stats.range) slow = Math.min(slow, this.isMoab(b) ? hero.stats.moabSlow : hero.stats.auraSlow);
      if (b.glue) slow = Math.min(slow, this.isMoab(b) ? b.glue.stats.moabSlow : b.glue.stats.slow);
      for (const t of this.towers) {
        if (t.auraSlow < 1 && this.canHit(b, t) && Math.hypot(this.posOf(b).x - t.x, this.posOf(b).y - t.y) <= t.range) slow = Math.min(slow, this.isMoab(b) ? t.moabSlow : t.auraSlow);
      }
      b.dist += BLOONS[b.type].speed * (b.spd ?? 1) * DT * (this.powerActive('time_stop') ? b.type === 'bad' ? POWER_BY_ID.time_stop.fx.bossSpeedMult : POWER_BY_ID.time_stop.fx.bloonSpeedMult : 1) * (b.type === 'bad' ? 1 : Math.max(b.frozenUntil ?? 0, b.stunnedUntil ?? 0) > this.tick ? 0 : slow);
      if (b.dist >= this.laneLen(b.lane)) {
        const blitz = this.towers.find(t => t.type === 'bomb' && t.tiers[2] === 5 && t.blitzRound !== this.round);
        if (blitz) {
          blitz.blitzRound = this.round;
          // uncertain: the passive's exact damage is absent; 2000 matches 'all but biggest'.
          this.burst(blitz, this.source(blitz, { damageType: 'normal', camo: true, damage: 2000, pierce: 1e6 }), 2000);
          if (!this.bloons.includes(b)) continue;
        }
        const legend=this.towers.find(t=>t.type==='super' && t.tiers[2]===5 && ((t.blackHoleUntil ?? 0)>this.tick || this.tick>=(t.blackHoleReady ?? 0) && (t.blackHoleUses ?? 0)<2));
        if(legend) {
          if((legend.blackHoleUntil ?? 0)<=this.tick) {legend.blackHoleUntil=this.tick+480;legend.blackHoleReady=this.tick+10800;legend.blackHoleUses=(legend.blackHoleUses ?? 0)+1;}
          this.bloons.splice(this.bloons.indexOf(b),1);continue;
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
      const origin = t.type === 'ace' || t.type === 'heli' ? t.flight : {x:t.x,y:t.y};
      if(t.mergedInto && !this.towers.includes(t.mergedInto))t.mergedInto=undefined;
      if(t.mergedInto)continue;
      const weapon = this.magicBuffs(t, { ...heroTowerWeapon(this, t, this.effectiveStats(t)), ...origin });
      if(this.supportAttack(t,weapon))continue;
      this.magicAttack(t, weapon);
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
      t.cd -= DT * this.powerAttackSpeed(t); if (t.cd > 0) continue;
      // Range intersects the bloon body (7 units), so short-range towers can reach from grass.
      const detected = (b: Bloon) => !(b.camo || b.type === 'ddt' && b.camo !== false) || weapon.camo || t.intel && this.towers.some(ally => ally.camo && Math.hypot(this.posOf(b).x - ally.x, this.posOf(b).y - ally.y) <= ally.range);
      const targets = this.bloons.filter(b => detected(b) && (Math.hypot(this.posOf(b).x - origin.x, this.posOf(b).y - origin.y) <= weapon.range + 7 ||
        t.intel && this.towers.some(ally => Math.hypot(this.posOf(b).x - ally.x, this.posOf(b).y - ally.y) <= ally.range && (!b.camo || ally.camo))));
      const distance = (b: Bloon) => Math.hypot(this.posOf(b).x - t.x, this.posOf(b).y - t.y);
      targets.sort((a, b) => t.targeting === 'Last' ? a.dist - b.dist : t.targeting === 'Close' ? distance(a) - distance(b) : t.targeting === 'Strong' ? BLOONS[b.type].rbe - BLOONS[a.type].rbe || b.dist - a.dist : b.dist - a.dist);
      const manual = t.type === 'mortar' || t.type === 'dartling';
      if (!targets.length && !manual && t.type !== 'ace') continue;
      const p = manual ? weapon.targetPoint : targets.length ? this.posOf(targets[0]) : t.targetPoint; t.cd = weapon.cooldown / (this.tick < t.buffUntil ? t.type === 'sniper' ? 4 : 1.5 : 1)
        * ((TOWERS[t.type].waterOnly || t.type === 'ace') && this.towers.some(ally => ally.type === 'buccaneer' && ally.tiers[0] === 5) ? 0.8 : 1)
        / (t.type === 'sniper' && t.tiers[2] === 5 ? 1 + Math.max(0, ...this.bloons.map(b => b.dist / this.pathLen)) : 1) / (this.tick < t.abilityUntil && t.ability?.kind === 'boost' ? t.ability.speed : 1); t.shots++;
      if (t.dip && t.dip.source.tiers[0] < 5) t.dip.shots--;
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
          const p = this.posOf(target), angle = Math.atan2(p.y - d.y, p.x - d.x);
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
      if(d.bounce && d.damageType==='frigid') {
        if(d.x+d.vx*DT<0 || d.x+d.vx*DT>960)d.vx*=-1;
        if(d.y+d.vy*DT<0 || d.y+d.vy*DT>540)d.vy*=-1;
      }
      if(d.owner?.type==='mermonkey' && d.owner.tiers[1]>=3) {
        const rate=d.owner.tiers[1]===5?1.125:d.owner.tiers[1]===4?0.75:0.5;
        d.damage=d.owner.damage*Math.min(3,1+d.age*rate);
      }
      d.x += d.vx * DT; d.y += d.vy * DT; d.life -= DT;
      let detonated = false;
      for (const b of [...this.bloons]) {
        if (d.pierce <= 0) break;
        const repeat = d.kind === 'boomerang' && this.tick - (d.lastHit?.get(b.id) ?? -Infinity) >= d.rehit * 60;
        if ((!repeat && d.hit.has(b.id)) || !this.bloons.includes(b)) continue;
        const p = this.posOf(b), dx = d.x - previous.x, dy = d.y - previous.y;
        const along = Math.max(0, Math.min(1, ((p.x - previous.x) * dx + (p.y - previous.y) * dy) / (dx * dx + dy * dy || 1)));
        if (Math.hypot(p.x - previous.x - dx * along, p.y - previous.y - dy * along) >= 10) continue;
        if (d.kind === 'bomb' || d.radius > 0 && d.kind !== 'boomerang') {
          if ((b.camo || b.type === 'ddt' && b.camo !== false) && !d.camo) continue;
          this.burst(p, d, d.radius); detonated = true;
          if (d.kind === 'bomb') this.bombChildren(p, d);
          break;
        }
        if (!this.canHit(b, d)) continue;
        d.hit.add(b.id); d.lastHit?.set(b.id, this.tick); d.pierce--;
        this.applyHit(b, d);
        if (d.bounceRange) {
          const next = this.bloons.find(other => !d.hit.has(other.id) && this.canHit(other, d) &&
            Math.hypot(this.posOf(other).x - d.x, this.posOf(other).y - d.y) <= d.bounceRange);
          if (next) {
            const point = this.posOf(next), angle = Math.atan2(point.y - d.y, point.x - d.x);
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
          if (Math.hypot(this.posOf(b).x - d.x, this.posOf(b).y - d.y) <= d.heavyRadius && this.canHit(b, d)) {
            b.burn = { until: this.tick + 240, next: this.tick + 60, interval: 60, damage: d.heavyBurn, stats: { ...d, damageType: 'normal', frozen: true } };
          }
        }
      }
      if (d.life <= 0 && d.owner?.type === 'mermonkey' && d.owner.tiers[1] >= 3 && d.damageType === 'frigid') {
        for (const sign of [-1,1]) this.darts.push({...d,owner:undefined,vx:-d.vy*sign,vy:d.vx*sign,life:0.5,pierce:25,hit:new Set(d.hit)});
      }
      if (detonated || d.pierce <= 0 || d.life <= 0) this.darts.splice(j, 1);
    }
    this.runRoadItems();this.runPowers();this.runCollectibles();
    const cleared = !this.bloons.length;
    // Apopalypse: the next round starts as soon as the last bloon is sent, so a round can end with bloons still alive.
    if (this.roundActive && !this.spawnQ.length && (cleared || this.rules.auto && this.round < this.rules.winRound)) {
      this.endRound(cleared);
      if (this.round >= this.rules.winRound) this.won = true; // only reachable once cleared
      else if (this.rules.auto) this.startRound();
    }
  }
  private endRound(cleared: boolean) {
    roundHero(this);
    this.powerUnits=this.powerUnits.filter(u=>u.untilRound>this.round);
    if(this.round>=this.thrive.untilRound)this.activePowers=this.activePowers.filter(p=>p.id!=='thrive');
    this.earnIncome(100 + this.round); this.supportRoundEnd();
    this.roundActive = false; if (cleared) this.darts = [];
    for(const t of this.towers) {
      t.blackHoleUses=0;t.wrathDamage=0;
      if(t.type==='druid' && t.tiers[1]>=4)this.lives+=t.tiers[1]===5?25:1;
    }
  }
}
