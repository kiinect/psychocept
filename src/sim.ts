// Fixed-step (60 Hz), deterministic and independent of rendering.
import bloonJson from '../data/wiki/bloons.json';
import roundJson from '../data/wiki/rounds.json';
import modeJson from '../data/wiki/modes.json';
import { TOWERS, canUpgrade, resultingStats, type TowerKind } from './towers';
import { type TowerStats, type Tiers } from './towers/types';
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
export interface Bloon { goldUntil?: number; concoction?: TowerStats; stickyUntil?: number;  burn?: DamageStatus; freezeLayers?: number; slowUntil?: number; icicle?: { until: number; next: number; stats: TowerStats }; shardStats?: TowerStats; frozenUntil?: number; stunnedUntil?: number; slow?: number; glue?: GlueStatus; brittleUntil?: number; brittle?: number; id: number; type: string; dist: number; hp: number; camo?: boolean; fortified?: boolean; regrow?: boolean }
export const TARGETING = ['First', 'Last', 'Close', 'Strong'] as const;
export type Targeting = typeof TARGETING[number];
export interface Tower extends Pt, TowerStats { magicNext?: Record<string, number>; graveyard?: number; abilityUses?: number; purchaseLives?: number; oakLives?: number; wrathDamage?: number; lastDamage?: number; blackHoleUntil?: number; blackHoleReady?: number; blackHoleUses?: number; brew?: { source: Tower; until: number; shots: number; level: number }; dip?: { source: Tower; shots: number }; transformedUntil?: number;  aimAngle: number; targetPoint: Pt; flight: Pt; rotorReady: number; type: TowerKind; tiers: Tiers; cd: number; cost: number; targeting: Targeting; shots: number; abilityReady: number; abilityUntil: number; abilityNext: number; secondaryReady: number; orbitReady: number; blitzRound: number; buffUntil: number }
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
  private delayed: { at: number; target: Bloon; stats: TowerStats; damage: number; splash: number; radius: number; pierce: number }[] = [];
  private zones: (Pt & { until: number; next: number; interval: number; radius: number; stats: TowerStats; hit?: Set<number> })[] = [];
  private undead: { dist: number; life: number; stats: TowerStats; hit: Set<number> }[] = [];
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
  canPlace(x: number, y: number, type: TowerKind = 'dart', ignore?: Tower) {
    const r = TOWERS[type].footprint;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < r || y < r || x > 960 - r || y > 540 - r) return false;
    const contained = this.water.some(w => x - r >= w.x && x + r <= w.x + w.width && y - r >= w.y && y + r <= w.y + w.height);
    const overlaps = this.water.some(w => Math.hypot(x - Math.max(w.x, Math.min(x, w.x + w.width)),
      y - Math.max(w.y, Math.min(y, w.y + w.height))) < r);
    const abyssLand = type !== 'mermonkey' && this.towers.some(t => t.type === 'mermonkey' && t.tiers[0] === 5 && Math.hypot(t.x-x,t.y-y) <= 32);
    if (TOWERS[type].waterOnly ? !contained && !abyssLand : overlaps) return false;
    if (this.towers.some(t => t !== ignore && Math.hypot(t.x - x, t.y - y) < TOWERS[t.type].footprint + r)) return false;
    return !this.path.slice(1).some((b, i) => {
      const a = this.path[i], dx = b.x - a.x, dy = b.y - a.y;
      const along = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a.x - along * dx, y - a.y - along * dy) < 20 + r;
    });
  }
  // Low-level setup API remains compatible; interactive purchases use placeTower.
  addTower(x: number, y: number, type: TowerKind = 'dart') {
    const def = TOWERS[type], cost = this.price(def.cost);
    if (this.gameOver || this.cash < cost || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    this.cash -= cost;
    this.towers.push({ ...def.base, type, x, y, aimAngle: -Math.PI / 2, targetPoint: { x, y: Math.max(0, y - 40) }, flight: { x, y }, rotorReady: 0, tiers: [0, 0, 0], cd: 0, cost, targeting: type === 'ice' || type === 'tack' ? 'Close' : 'First', shots: 0, abilityReady: 0, abilityUntil: 0, abilityNext: 0, secondaryReady: 0, orbitReady: 0, blitzRound: -1, buffUntil: 0, purchaseLives: this.lives }); return true;
  }
  placeTower(x: number, y: number, type: TowerKind) {
    return this.canPlace(x, y, type) && this.addTower(x, y, type);
  }
  upgrade(towerIdx: number, path: number) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !canUpgrade(t.tiers, path)) return false;
    const cost = this.price(TOWERS[t.type].paths[path][t.tiers[path]].cost);
    if (this.cash < cost) return false;
    this.cash -= cost; t.cost += cost; t.tiers[path]++;
    if(t.type === 'super' && path === 0 && t.tiers[0] >= 4) {
      // uncertain: the wiki omits numeric category bonuses; sacrifice is modeled with the unsacrificed weapon stats.
      this.towers = this.towers.filter(ally => ally === t || Math.hypot(ally.x-t.x,ally.y-t.y) > t.range);
    }
    if(t.type === 'druid' && path === 1 && t.tiers[1] === 2) t.oakLives=this.lives;
    if(t.type === 'druid' && path === 2 && t.tiers[2] === 2) t.purchaseLives=this.lives;
    const hadAbility = t.ability;
    Object.assign(t, resultingStats(TOWERS[t.type], t.tiers));
    if (t.ability && !hadAbility) t.abilityReady = this.tick + t.ability.initial * 60;
    return true;
  }
  setTarget(towerIdx: number, p: Pt) {
    const t = this.towers[towerIdx];
    if (this.gameOver || !t || !this.canSetTarget(t) ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 960 || p.y < 0 || p.y > 540) return false;
    if(t.type === 'mermonkey') {
      if(this.tick < (t.magicNext?.totem ?? 0) || t.tiers[2] < 5 && Math.hypot(p.x-t.x,p.y-t.y)>t.range*1.35) return false;
      t.magicNext ??= {};t.magicNext.totem=this.tick+360;
    }
    t.targetPoint = { ...p }; return true;
  }
  canSetTarget(t: Tower) {
    return ['mortar','heli','dartling','ace'].includes(t.type) || t.type === 'super' && t.tiers[2] >= 3 || t.type === 'mermonkey' && t.tiers[2] >= 4;
  }
  activate(towerIdx: number) {
    const t = this.towers[towerIdx], a = t?.ability;
    if (this.gameOver || !t || !a || this.tick < t.abilityReady) return false;
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
      const target = this.bloons.filter(b => this.isMoab(b) && (!(b.camo || b.type === 'ddt' && b.camo !== false) || t.camo))
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
    if (t.ability.kind === 'phoenix') {
      const target = this.magicTargets({ ...t, camo:true }, 2000)[0];
      if (target) this.burst(this.posAt(target.dist), this.source(t, {damage:t.ability.damage, damageType:'fire',
        camo:true, frozen:true, pierce:t.ability.pierce, moabBonus:0, burnDamage:0}), 15);
      // uncertain: phoenix orbit is visual only; its two flames resolve as one impact per 0.1s.
      t.abilityNext = this.tick + 6;
      if (t.tiers[1] === 5 && this.magicDue(t,'phoenixMeteor',1)) {
        for (let n=0;n<8;n++) {
          const b=this.bloons[n % Math.max(1,this.bloons.length)];
          if (b) this.burst(this.posAt(b.dist), this.source(t,{damage:50,damageType:'normal',camo:true,pierce:300,moabBonus:0}),30);
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
        const p=this.posAt(target.dist), angle=Math.atan2(p.y-t.y,p.x-t.x);
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
    if ((b.camo || b.type === 'ddt' && b.camo !== false) && !d.camo) return false;
    if (this.isMoab(b) && !d.moabTargetable) return false;
    const gold = (b.goldUntil ?? 0) > this.tick;
    const immune = gold ? [] : BLOONS[b.type].immunities;
    if (d.damageType === 'frigid' && !gold && (b.type === 'white' || b.type === 'zebra')) return false;
    if ((d.damageType === 'energy' || d.damageType === 'plasma' || d.damageType === 'frigid') && b.type === 'purple' && !gold) return false;
    const brittle = (b.brittleUntil ?? 0) > this.tick;
    if ((b.frozenUntil ?? 0) > this.tick && !d.frozen && !d.refreeze && !brittle) return false;
    if (d.damageType === 'cold' && immune.includes('freeze')) return false;
    if (d.damageType === 'cold' && immune.includes('cold(most ice)') && !d.lead && !brittle) return false;
    if ((d.damageType === 'sharp' || d.damageType === 'shatter') && immune.includes(d.damageType) && !d.lead && !brittle) return false;
    return !immune.includes(d.damageType) || d.damageType === 'energy' && b.type === 'lead' && d.lead || (d.damageType === 'sharp' || d.damageType === 'shatter') && (d.lead || brittle);
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
      if (!moab && d.freezeDuration && !BLOONS[b.type].immunities.includes('freeze')) {
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
      damage: d.burnDamage + (moab ? d.burnMoab : 0), stats: { ...d, damageType: d.damageType === 'acid' ? 'acid' : 'fire', frozen: true } };
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
    this.cash += BLOONS[b.type].popCash * popCashMultiplier(this.round) * ((b.goldUntil ?? 0) > this.tick ? 2 : 1);
    for(const t of this.towers) if(t.type==='wizard' && t.tiers[2]>=4 && Math.hypot(this.posAt(b.dist).x-t.x,this.posAt(b.dist).y-t.y)<=t.range)
      t.graveyard=Math.min(t.tiers[2]===5?3000:500,(t.graveyard ?? 0)+1);
    if(b.concoction) {
      // uncertain: wiki omits the explosion health fraction; use 10% of the unmodified layer HP.
      const stats=b.concoction;b.concoction=undefined;
      this.burst(this.posAt(b.dist),{...this.source({...stats,...this.posAt(b.dist)},{damage:BLOONS[b.type].hp*0.1,pierce:50,damageType:'normal',moabBonus:0}),hit:new Set([b.id])},40);
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
    for (const type of BLOONS[b.type].kids) {
      const child = this.makeBloon(type, b.dist, b);
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
    const p = this.posAt(b.dist);
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
    t.magicNext[name]=this.tick+seconds*60; return true;
  }
  private magicTargets(t: Tower, range: number) {
    const targets=this.bloons.filter(b=>this.canHit(b,t) && Math.hypot(this.posAt(b.dist).x-t.x,this.posAt(b.dist).y-t.y)<=range+7);
    const distance=(b:Bloon)=>Math.hypot(this.posAt(b.dist).x-t.x,this.posAt(b.dist).y-t.y);
    return targets.sort((a,b)=>t.targeting==='Strong'? BLOONS[b.type].rbe-BLOONS[a.type].rbe || b.dist-a.dist:
      t.targeting==='Close'?distance(a)-distance(b):t.targeting==='Last'?a.dist-b.dist:b.dist-a.dist);
  }
  private vine(t: Tower, b: Bloon) {
    const p=this.posAt(b.dist);
    // Vines consume the whole ordinary bloon without spawning children, awarding its remaining RBE.
    this.cash+=BLOONS[b.type].rbe*popCashMultiplier(this.round);
    this.bloons.splice(this.bloons.indexOf(b),1);
    const tier=t.tiers[1];
    this.zones.push({...p,until:this.tick+(tier===3?4.5:t.tiers[2]?12:9)*60,next:this.tick,
      interval:tier===5?0.1:tier===4?0.2:0.3,radius:10,
      stats:{...t,damage:tier===5?5:tier===4?2:1,pierce:tier===3?20:30,projectiles:1,
        damageType:t.tiers[0]?'normal':'sharp',radius:0,stripRegrow:true}});
  }
  private magicBuffs(t: Tower, weapon: Tower): Tower {
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
    if ((t.transformedUntil ?? 0)>this.tick) return;
    const [a,b,c]=t.tiers;
    const targets=this.magicTargets(weapon,weapon.range), target=targets[0];
    const burst=(bloon:Bloon,stats:Partial<TowerStats>,radius=20)=>this.burst(this.posAt(bloon.dist),this.source(weapon,stats),radius);
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
        const p=target?this.posAt(target.dist):this.posAt(Math.min(this.pathLen,Math.max(0,t.x)));
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
      if(b>=2 && target && this.magicDue(t,'wall',b===5?3.25:b>=3?4.5:6.5))this.zones.push({...this.posAt(target.dist),until:this.tick+(a?6.5:4.5)*60,next:this.tick,
        interval:b>=3?0.1:0.15,radius:12,stats:{...weapon,damage:b===5?5:1,damageType:'fire',pierce:(b>=3?20:10)+(c?5:0),moabBonus:a===5?6:a>=4?2:0,burnDamage:0}});
      if(a===5 && target && this.magicDue(t,'breath',0.0675))burst(target,{damage:2,damageType:'fire',pierce:3,moabBonus:8},20);
      if(b===5 && target && this.magicDue(t,'permanentPhoenix',0.1))burst(target,{damage:5,damageType:'fire',pierce:8,moabBonus:0},20);
      if(c>=4 && (t.graveyard ?? 0)>0 && this.magicDue(t,'undead',c===5?0.275:1.1)) {
        const units=t.graveyard ?? 0,large=c===5 && units>=20, cost=large?units>=2100?50:20:1;
        t.graveyard=units-cost;
        const globalBonus=this.towers.some(t=>t.type==='wizard' && t.tiers[2]===5)?3:0;
        this.undead.push({dist:Math.min(this.pathLen,(target?.dist ?? Math.min(this.pathLen,t.x))+40),life:a?6:3,hit:new Set(),
          stats:{...weapon,damage:(large?cost===50?100:40:2)+globalBonus+Math.min(10,Math.floor(units/(c===5?300:200))),damageType:'normal',pierce:large?cost===50?50:20:10,moabBonus:0,burnDamage:0,camo:true}});
      }
    }
    if(t.type==='ninja') {
      if(c>=2 && this.magicDue(t,'caltrops',3.9)) {
        const p=target?this.posAt(target.dist):this.posAt(Math.min(this.pathLen,t.x));
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
        let point=this.posAt(target.dist);const hit=new Set<number>();
        for(let n=0;n<31;n++) {
          const next=this.bloons.find(b=>!hit.has(b.id) && this.canHit(b,{...weapon,damageType:'plasma'}) && Math.hypot(this.posAt(b.dist).x-point.x,this.posAt(b.dist).y-point.y)<=86);
          if(!next)break;hit.add(next.id);point=this.posAt(next.dist);
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
        const distance=Math.hypot(this.posAt(bloon.dist).x-t.x,this.posAt(bloon.dist).y-t.y);
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
    const b = this.makeBloon(s.type, 0, s); this.bloons.push(b);
    for(const t of this.towers) if(t.type==='ninja' && t.tiers[1]===5 && this.tick<t.abilityUntil && this.isMoab(b)) b.hp*=0.75;
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
    for (const event of this.delayed.filter(e=>e.at<=this.tick)) {
      if(!this.bloons.includes(event.target)) continue;
      const p=this.posAt(event.target.dist);
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
      this.burst(this.posAt(Math.max(0,u.dist)),{...this.source({...u.stats,...this.posAt(Math.max(0,u.dist))}),hit:u.hit,pierce:u.stats.pierce-u.hit.size},10);
    }
    this.undead=this.undead.filter(u=>u.life>0 && u.dist>=0 && u.hit.size<u.stats.pierce);
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
        const legend=this.towers.find(t=>t.type==='super' && t.tiers[2]===5 && ((t.blackHoleUntil ?? 0)>this.tick || this.tick>=(t.blackHoleReady ?? 0) && (t.blackHoleUses ?? 0)<2));
        if(legend) {
          if((legend.blackHoleUntil ?? 0)<=this.tick) {legend.blackHoleUntil=this.tick+480;legend.blackHoleReady=this.tick+10800;legend.blackHoleUses=(legend.blackHoleUses ?? 0)+1;}
          this.bloons.splice(this.bloons.indexOf(b),1);continue;
        }
        const def = BLOONS[b.type]; this.lives = Math.max(0, this.lives - ((b.fortified ? def.fortifiedRbe : def.rbe) - ((b.fortified ? def.fortifiedHp : def.hp) - b.hp)));
        for (const t of this.towers) if (t.type === 'sniper' && t.tiers[2] === 5 && this.tick >= t.abilityReady) {
          t.buffUntil = this.tick + 420; t.abilityReady = this.tick + 600;
        }
        this.bloons.splice(this.bloons.indexOf(b), 1);
      }
    }
    if (this.gameOver) { this.roundActive = false; return; }
    for (const t of this.towers) {
      this.moveAircraft(t);
      if (t.type === 'dartling') {
        const desired = Math.atan2(t.targetPoint.y - t.y, t.targetPoint.x - t.x);
        const delta = Math.atan2(Math.sin(desired - t.aimAngle), Math.cos(desired - t.aimAngle));
        const turn = t.rotationSpeed * Math.PI / 180 * DT;
        t.aimAngle += Math.max(-turn, Math.min(turn, delta));
      }
      const origin = t.type === 'ace' || t.type === 'heli' ? t.flight : t;
      const weapon = this.magicBuffs(t, { ...t, ...origin });
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
      t.cd -= DT; if (t.cd > 0) continue;
      // Range intersects the bloon body (7 units), so short-range towers can reach from grass.
      const detected = (b: Bloon) => !(b.camo || b.type === 'ddt' && b.camo !== false) || weapon.camo || t.intel && this.towers.some(ally => ally.camo && Math.hypot(this.posAt(b.dist).x - ally.x, this.posAt(b.dist).y - ally.y) <= ally.range);
      const targets = this.bloons.filter(b => detected(b) && (Math.hypot(this.posAt(b.dist).x - origin.x, this.posAt(b.dist).y - origin.y) <= weapon.range + 7 ||
        t.intel && this.towers.some(ally => Math.hypot(this.posAt(b.dist).x - ally.x, this.posAt(b.dist).y - ally.y) <= ally.range && (!b.camo || ally.camo))));
      const distance = (b: Bloon) => Math.hypot(this.posAt(b.dist).x - t.x, this.posAt(b.dist).y - t.y);
      targets.sort((a, b) => t.targeting === 'Last' ? a.dist - b.dist : t.targeting === 'Close' ? distance(a) - distance(b) : t.targeting === 'Strong' ? BLOONS[b.type].rbe - BLOONS[a.type].rbe || b.dist - a.dist : b.dist - a.dist);
      const manual = t.type === 'mortar' || t.type === 'dartling';
      if (!targets.length && !manual && t.type !== 'ace') continue;
      const p = manual ? t.targetPoint : targets.length ? this.posAt(targets[0].dist) : t.targetPoint; t.cd = weapon.cooldown / (this.tick < t.buffUntil ? t.type === 'sniper' ? 4 : 1.5 : 1)
        * ((TOWERS[t.type].waterOnly || t.type === 'ace') && this.towers.some(ally => ally.type === 'buccaneer' && ally.tiers[0] === 5) ? 0.8 : 1)
        / (t.type === 'sniper' && t.tiers[2] === 5 ? 1 + Math.max(0, ...this.bloons.map(b => b.dist / this.pathLen)) : 1) / (this.tick < t.abilityUntil && t.ability?.kind === 'boost' ? t.ability.speed : 1); t.shots++;
      if (t.dip && t.dip.source.tiers[0] < 5) t.dip.shots--;
      if (t.intel && targets[0] && detected(targets[0])) weapon.camo = true;
      const active = this.tick < t.abilityUntil && t.ability?.kind === 'boost';
      if (active && t.type === 'mortar') weapon.radius *= 1.15;
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
        const p = this.posAt(b.dist), dx = d.x - previous.x, dy = d.y - previous.y;
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
      if (d.life <= 0 && d.owner?.type === 'mermonkey' && d.owner.tiers[1] >= 3 && d.damageType === 'frigid') {
        for (const sign of [-1,1]) this.darts.push({...d,owner:undefined,vx:-d.vy*sign,vy:d.vx*sign,life:0.5,pierce:25,hit:new Set(d.hit)});
      }
      if (detonated || d.pierce <= 0 || d.life <= 0) this.darts.splice(j, 1);
    }
    if (this.roundActive && !this.spawnQ.length && !this.bloons.length) {
      this.cash += 100 + this.round + this.towers.reduce((sum, t) => sum + t.income, 0); this.roundActive = false; this.darts = [];
      for(const t of this.towers) {
        t.blackHoleUses=0;t.wrathDamage=0;
        if(t.type==='druid' && t.tiers[1]>=4)this.lives+=t.tiers[1]===5?25:1;
      }
    }
  }
}
