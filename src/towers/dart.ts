// Original numeric transcription of data/wiki/towers/dart.json. Paths are zero-based.
export type Tiers = [number, number, number];
export interface DartStats {
  damage: number; pierce: number; cooldown: number; range: number;
  projectileSpeed: number; lifespan: number; camo: boolean; lead: boolean;
  frozen: boolean; projectiles: number; spread: number; critEvery: number; critDamage: number;
  ceramicBonus: number; fortifiedBonus: number; leadBonus: number;
  bounce: boolean; knockback: boolean; split: boolean; fanClub: number;
}
export const BASE: DartStats = {
  damage: 1, pierce: 2, cooldown: 0.95, range: 32, projectileSpeed: 300,
  lifespan: 0.25, camo: false, lead: false, frozen: false, projectiles: 1, spread: 0,
  critEvery: 0, critDamage: 0, ceramicBonus: 0, fortifiedBonus: 0, leadBonus: 0,
  bounce: false, knockback: false, split: false, fanClub: 0,
};
export interface DartTier { name: string; cost: number; stats: Readonly<DartStats> }
const tier = (name: string, cost: number, stats: Partial<DartStats>): DartTier => ({ name, cost, stats: { ...BASE, ...stats } });
export const DART_TIERS: readonly (readonly DartTier[])[] = [
  [
    tier('Sharp Shots', 140, { pierce: 3 }),
    tier('Razor Sharp Shots', 200, { pierce: 5 }),
    tier('Spike-o-pult', 320, { damage: 2, pierce: 18, cooldown: 1.15, range: 36.8, projectileSpeed: 150, lifespan: 1, frozen: true, bounce: true }),
    // The prose gives no numeric speed/lifetime for Juggernaut; retain Spike-o-pult values.
    tier('Juggernaut', 1800, { damage: 2, pierce: 60, cooldown: 1, range: 36.8, projectileSpeed: 150, lifespan: 1, frozen: true, lead: true, bounce: true, knockback: true, ceramicBonus: 3, fortifiedBonus: 2 }),
    tier('Ultra-Juggernaut', 15000, { damage: 5, pierce: 210, cooldown: 1, range: 36.8, projectileSpeed: 150, lifespan: 1, frozen: true, lead: true, bounce: true, knockback: true, split: true, ceramicBonus: 8, fortifiedBonus: 5, leadBonus: 20 }),
  ],
  [
    tier('Quick Shots', 100, { cooldown: 0.8075 }),
    tier('Very Quick Shots', 190, { cooldown: 0.95 * 2 / 3 }),
    tier('Triple Shot', 450, { cooldown: 0.475, projectiles: 3, spread: 15 }),
    tier('Super Monkey Fan Club', 7200, { cooldown: 0.2375, projectiles: 3, spread: 15, fanClub: 10 }),
    tier('Plasma Monkey Fan Club', 45000, { cooldown: 0.2375, projectiles: 3, spread: 15, fanClub: 20 }),
  ],
  [
    tier('Long Range Darts', 90, { range: 40, lifespan: 0.3375 }),
    tier('Enhanced Eyesight', 200, { range: 48, lifespan: 0.3375, projectileSpeed: 350, camo: true }),
    tier('Crossbow', 575, { damage: 3, pierce: 5, range: 60, lifespan: 0.3375, projectileSpeed: 350, camo: true }),
    tier('Sharp Shooter', 2050, { damage: 6, pierce: 5, cooldown: 0.475, range: 60, lifespan: 0.3375, projectileSpeed: 350 * 4 / 3, camo: true, critEvery: 10, critDamage: 60 }),
    tier('Crossbow Master', 21500, { damage: 8, pierce: 8, cooldown: 0.475, range: 80, lifespan: 0.3375, projectileSpeed: 350 * 4 / 3, camo: true, lead: true, frozen: true, projectiles: 2, critEvery: 5, critDamage: 80 }),
  ],
];
export function canUpgrade(tiers: Tiers, path: number): boolean {
  if (!Number.isInteger(path) || path < 0 || path > 2) return false;
  const next = [...tiers]; next[path]++;
  return next.every(n => n >= 0 && n <= 5) && next.filter(n => n > 0).length <= 2 && next.filter(n => n > 2).length <= 1;
}
export function dartStats(tiers: Tiers): DartStats {
  const [a, b, c] = tiers;
  const main = a >= 3 ? 0 : c >= 3 ? 2 : b >= 3 ? 1 : -1;
  const stats = { ...(main < 0 ? BASE : DART_TIERS[main][(main === 0 ? a : main === 1 ? b : c) - 1].stats) };
  if (main !== 0 && a) stats.pierce += c === 5 ? 8 : c >= 3 ? (a === 1 ? 3 : 8) : (a === 1 ? 1 : 3);
  if (main !== 1 && b) stats.cooldown *= DART_TIERS[1][b - 1].stats.cooldown / BASE.cooldown;
  if (main !== 2 && c) {
    stats.range += c * 8; stats.lifespan *= 1.35;
    if (c === 2) { stats.camo = true; stats.projectileSpeed *= 7 / 6; }
  }
  return stats;
}
