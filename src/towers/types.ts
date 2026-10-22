// World units and seconds. Tier entries are resulting stats, not incremental patches.
export type AttackKind = 'projectile' | 'boomerang' | 'bomb' | 'tack' | 'ice' | 'glue' | 'ring';
export type DamageType = 'sharp' | 'explosion' | 'cold' | 'fire' | 'normal' | 'shatter' | 'acid';
export interface Ability {
  kind: 'boost' | 'missile' | 'blades' | 'snow' | 'glue';
  cooldown: number; initial: number; duration: number;
  damage: number; speed: number; count: number; pierce: number;
}
export function ability(kind: Ability['kind'], cooldown: number, initial: number, duration: number,
  damage = 0, speed = 1, count = 0, pierce = 0): Ability {
  return { kind, cooldown, initial, duration, damage, speed, count, pierce };
}
export type Tiers = [number, number, number];
export interface TowerStats {
  ability: Ability | null; secondaryCooldown: number; heavyPierce: number; heavyDamage: number;
  heavyRadius: number; heavyBurn: number; meteor: number; globalFreeze: number;
  shards: number; shardDamage: number; shardPierce: number; soak: number;
  icicles: boolean; impale: boolean; freezeLayers: number;
  kind: AttackKind; damageType: DamageType; radius: number; moabBonus: number;
  freezeDuration: number; moabTargetable: boolean; slow: number; glueDuration: number;
  dotDamage: number; dotInterval: number; dotCeramicBonus: number; dotMoabBonus: number;
  glueLayers: number; moabSlow: number; moabDuration: number; stun: number; moabStun: number;
  brittle: number; brittleDuration: number; strip: boolean; auraSlow: number; refreeze: boolean;
  afterSlow: number; rehit: number; bounceRange: number; orbit: number; clusters: number;
  frags: number; recursive: number; puddleDamage: number; glueLevel: number;
  damage: number; pierce: number; cooldown: number; range: number;
  projectileSpeed: number; lifespan: number; camo: boolean; lead: boolean;
  frozen: boolean; projectiles: number; spread: number; critEvery: number; critDamage: number;
  ceramicBonus: number; fortifiedBonus: number; leadBonus: number;
  bounce: boolean; knockback: boolean; split: boolean; fanClub: number;
}

export const DEFAULT_STATS: TowerStats = {
  ability: null, secondaryCooldown: 0, heavyPierce: 0, heavyDamage: 0, heavyRadius: 0,
  heavyBurn: 0, meteor: 0, globalFreeze: 0, shards: 0, shardDamage: 0, shardPierce: 0,
  soak: 0, icicles: false, impale: false, freezeLayers: 0,
  kind: 'projectile', damageType: 'sharp', radius: 0, moabBonus: 0,
  freezeDuration: 0, moabTargetable: true, slow: 1, glueDuration: 0,
  dotDamage: 0, dotInterval: 2, dotCeramicBonus: 0, dotMoabBonus: 0,
  glueLayers: 3, moabSlow: 1, moabDuration: 0, stun: 0, moabStun: 0,
  brittle: 0, brittleDuration: 0, strip: false, auraSlow: 1, refreeze: false,
  afterSlow: 1, rehit: 0.3, bounceRange: 0, orbit: 0, clusters: 0, frags: 0,
  recursive: 0, puddleDamage: 0, glueLevel: 1,
  damage: 1, pierce: 1, cooldown: 1, range: 40, projectileSpeed: 300,
  lifespan: 1, camo: false, lead: false, frozen: false, projectiles: 1, spread: 0,
  critEvery: 0, critDamage: 0, ceramicBonus: 0, fortifiedBonus: 0, leadBonus: 0,
  bounce: false, knockback: false, split: false, fanClub: 0,
};
export interface TowerTier { name: string; cost: number; stats: Readonly<TowerStats> }
export interface TowerDefinition {
  name: string; cost: number; footprint: number; color: number;
  base: Readonly<TowerStats>; paths: readonly (readonly TowerTier[])[];
  stats?: (tiers: Tiers) => TowerStats;
}
export const baseStats = (stats: Partial<TowerStats>): TowerStats => ({ ...DEFAULT_STATS, ...stats });
export const tierTable = (base: TowerStats) => (name: string, cost: number, stats: Partial<TowerStats>): TowerTier =>
  ({ name, cost, stats: { ...base, ...stats } });
export function canUpgrade(tiers: Tiers, path: number): boolean {
  if (!Number.isInteger(path) || path < 0 || path > 2) return false;
  const next = [...tiers]; next[path]++;
  return next.every(n => n >= 0 && n <= 5) && next.filter(n => n > 0).length <= 2 && next.filter(n => n > 2).length <= 1;
}

export function resultingStats(def: TowerDefinition, tiers: Tiers): TowerStats {
  if (def.stats) return def.stats(tiers);
  const main = tiers.findIndex(n => n > 2);
  const primary = main < 0 ? tiers.findIndex(n => n > 0) : main;
  const stats = { ...(primary < 0 ? def.base : def.paths[primary][tiers[primary] - 1].stats) };
  // Low crosspaths contribute their final delta once; multiplicative speed keeps fast paths useful.
  tiers.forEach((n, path) => {
    if (!n || path === primary) return;
    const cross = def.paths[path][n - 1].stats;
    for (const key of Object.keys(cross) as (keyof TowerStats)[]) {
      const value = cross[key], original = def.base[key];
      if (value === original) continue;
      if (typeof value === 'boolean') Object.assign(stats, { [key]: value });
      else if (typeof value === 'number' && typeof original === 'number') {
        Object.assign(stats, { [key]: key === 'cooldown' || key === 'projectileSpeed' || key === 'lifespan'
          ? stats[key] as number * value / (original || 1) : (stats[key] as number) + value - original });
      }
    }
  });
  if (stats.kind === 'ring') {
    stats.damage += tiers[2];
    if (tiers[1] === 2) stats.pierce = Math.max(stats.pierce, 45);
  }
  return stats;
}
