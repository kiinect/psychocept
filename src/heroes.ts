// Original numeric transcription of data/wiki/heroes.json; world units and seconds.
import wiki from '../data/wiki/heroes.json';
import meta from '../data/wiki/meta.json';
import { baseStats, type TowerStats } from './towers/types';
export const HERO_NAMES = {
  quincy: 'Quincy', gwen: 'Gwendolin', striker: 'Striker Jones', obyn: 'Obyn Greenfoot',
  churchill: 'Captain Churchill', benjamin: 'Benjamin', ezili: 'Ezili', pat: 'Pat Fusty',
  adora: 'Adora', brickell: 'Admiral Brickell', etienne: 'Etienne', sauda: 'Sauda', psi: 'Psi',
  geraldo: 'Geraldo', corvus: 'Corvus', rosalia: 'Rosalia', silas: 'Silas', dan: "Dan D'Monke",
} as const;
export type HeroKind = keyof typeof HERO_NAMES;
export interface HeroAbility {
  id: string; name: string; level: number; cooldown: number; initial: number; duration: number;
  damage: number; pierce: number; radius: number; interval: number; count: number;
}
const a = (id: string, name: string, level: number, cooldown: number, duration = 0,
  damage = 0, pierce = 1e6, radius = 2000, interval = 1, count = 1): HeroAbility =>
  ({ id, name, level, cooldown, initial: 0, duration, damage, pierce, radius, interval, count });
export interface HeroDefinition {
  name: string; cost: { easy: number; medium: number; hard: number; impoppable: number };
  footprint: number; waterOnly: boolean; amphibious: boolean; color: number;
  levels: { description: string; effect: string }[]; xpMultiplier: number;
}
export const HEROES = {} as Record<HeroKind, HeroDefinition>;
for (const kind of Object.keys(HERO_NAMES) as HeroKind[]) {
  const source = wiki.data.find(h => h.name === HERO_NAMES[kind])!;
  const multipliers = meta.data.xp.hero_xp_multiplier;
  // uncertain: Rosalia and Dan are absent from meta's multiplier groups; their supplied unlock tables use 1.425.
  const multiplier = Number(Object.entries(multipliers).find(([, names]) => (names as string[]).includes(source.name))?.[0] ?? 1.425);
  HEROES[kind] = { name: source.name, cost: source.base_cost, footprint: kind === 'churchill' ? 14 : 8,
    // uncertain: hero footprints are absent from the source; use 8 units (14 for the tank).
    waterOnly: kind === 'brickell', amphibious: kind === 'pat', color: 0x36bda8,
    levels: source.levels.map(l => ({ description: l.description || l.effect || `Level ${l.level}: improvements unspecified in the supplied table.`, effect: l.effect })), xpMultiplier: multiplier };
}
// The supplied formula explicitly calls r21=460 and r51=1710, defining the boundaries.
export function heroRoundXP(round: number) {
  if (!Number.isInteger(round) || round < 1) return 0;
  return round <= 20 ? 40 + 20 * (round - 1) : round <= 50 ? 420 + 40 * (round - 20) : 1620 + 90 * (round - 50);
}
const XP = [0, 180, 460, 1000, 1860, 3280, 5180, 8320, 9380, 13620, 16380, 14400, 16650, 14940, 16380, 17820, 19260, 20700, 16470, 17280];
export const heroLevelXP = (kind: HeroKind, level: number) => level <= 1 || level > 20 ? 0 : Math.round(XP[level - 1] * HEROES[kind].xpMultiplier);
type Changes = Partial<TowerStats>;
// Entries are patches applied at their numbered level. Unlisted levels improve abilities/passives.
const STATS: Record<HeroKind, Record<number, Changes>> = {
  quincy: { 1: { range: 50, cooldown: 0.95, pierce: 3, bounceRange: 50 }, 2: { pierce: 4 }, 4: { range: 52 }, 5: { camo: true }, 6: { projectiles: 2 }, 8: { moabBonus: 2 }, 9: { pierce: 6 }, 11: { cooldown: 0.6 }, 12: { pierce: 7 }, 13: { range: 54 }, 14: { moabBonus: 3 }, 16: { cooldown: 0.4 }, 18: { cooldown: 0.25 }, 19: { projectiles: 3, pierce: 9 },
    // uncertain: level 20 says faster without a number; use a 20% cooldown reduction.
    20: { cooldown: 0.2 } },
  gwen: { 1: { range: 38, cooldown: 0.5, pierce: 2, damageType: 'fire', frozen: true, lead: true }, 2: { pierce: 3 }, 5: { pierce: 4 }, 6: { burnDamage: 1, burnInterval: 1.5, burnDuration: 3 }, 8: { projectiles: 2 }, 9: { damage: 2, burnDamage: 2 }, 10: { burnDamage: 3 }, 11: { range: 41, burnDamage: 4 }, 12: { cooldown: 0.4, burnDamage: 5 }, 13: { pierce: 8, burnDamage: 6 }, 14: { burnDamage: 7 }, 15: { cooldown: 0.3, burnDamage: 8 }, 16: { damageType: 'normal', burnDamage: 9 }, 17: { burnDamage: 10 }, 18: { cooldown: 0.15, burnDamage: 11 }, 19: { projectiles: 3, burnDamage: 12 }, 20: { burnDamage: 13 } },
  striker: { 1: { range: 55, cooldown: 1.2, damage: 2, pierce: 10, radius: 15, damageType: 'explosion', knockback: true }, 2: { radius: 19 }, 6: { pierce: 20, radius: 28.5 }, 7: { damage: 4 }, 9: { cooldown: 1 }, 11: { cooldown: 0.8 }, 12: { range: 58, damage: 6 }, 13: { cooldown: 0.6 }, 16: { cooldown: 0.45 }, 17: { range: 60, damage: 8 }, 19: { cooldown: 0.3 } },
  obyn: { 1: { range: 43, cooldown: 1.35, damage: 2, pierce: 4, damageType: 'plasma', homing: true, lead: true, frozen: true }, 5: { cooldown: 1.1 }, 6: { pierce: 9 }, 9: { damage: 4 }, 12: { cooldown: 0.8 }, 13: { pierce: 14 }, 14: { damage: 6 }, 17: { cooldown: 0.5 }, 19: { damage: 8 } },
  churchill: { 1: { range: 65, cooldown: 1.5, damage: 3, pierce: 12, radius: 18, damageType: 'explosion', projectiles: 3 }, 2: { pierce: 15 }, 4: { range: 75 }, 6: { camo: true }, 7: { damage: 6, projectiles: 4 }, 8: { cooldown: 1.2 }, 9: { projectiles: 5 }, 11: { pierce: 20 }, 12: { damage: 9, projectiles: 6 }, 14: { damage: 12 }, 15: { fortifiedBonus: 4, camoBonus: 4, leadBonus: 4 }, 16: { cooldown: 0.9 }, 18: { damage: 15 }, 19: { projectiles: 7 }, 20: { damage: 20 } },
  benjamin: { 1: { damage: 0, range: 20, income: 90 }, 2: { income: 140 }, 8: { income: 250 }, 11: { income: 1000 }, 15: { income: 2500 }, 17: { income: 5000 }, 18: { camo: true } },
  ezili: { 1: { range: 40, cooldown: 1.2, radius: 8, pierce: 5, damageType: 'plasma', camo: true, lead: true, frozen: true, burnDamage: 2, burnInterval: 2.5, burnDuration: 2.6 }, 2: { range: 43 }, 5: { cooldown: 1 }, 6: { moabBonus: 19, burnMoab: 28 }, 8: { burnInterval: 1.8, burnDuration: 5.5 }, 9: { strip: true, defortify: true }, 11: { range: 45 }, 12: { moabBonus: 29 }, 13: { radius: 11, pierce: 15 }, 14: { burnInterval: 1, burnDuration: 4.05 }, 15: { range: 47, burnDuration: 6.05 }, 17: { radius: 13, pierce: 25 }, 18: { cooldown: 0.8 }, 19: { burnDamage: 6, burnMoab: 25 }, 20: { moabBonus: 49 } },
  pat: { 1: { range: 24, cooldown: 1.1, damage: 3, ceramicBonus: 2, pierce: 10, radius: 8, damageType: 'normal', lead: true, frozen: true }, 2: { radius: 13 }, 4: { cooldown: 0.9 }, 6: { stun: 0.2, radius: 20 }, 7: { damage: 4, pierce: 20 }, 8: { cooldown: 0.75 }, 9: { range: 27 }, 11: { damage: 5 }, 12: { cooldown: 0.65 }, 13: { stun: 0.5, moabStun: 0.2 }, 16: { range: 29, damage: 7, ceramicBonus: 5 }, 17: { cooldown: 0.55 }, 18: { pierce: 30 }, 19: { damage: 10, ceramicBonus: 7 } },
  adora: { 1: { range: 45, damageType: 'plasma', pierce: 5, lead: true, frozen: true, homing: true }, 2: { range: 49 }, 4: { projectiles: 2 }, 5: { pierce: 8 }, 6: { projectiles: 3 }, 8: { projectiles: 4 }, 9: { range: 54, fortifiedBonus: 1 }, 11: { cooldown: 0.85 }, 12: { projectiles: 5 }, 13: { pierce: 11, fortifiedBonus: 2 }, 14: { projectiles: 6 }, 15: { damage: 2 }, 17: { cooldown: 0.7 }, 18: { projectiles: 8 }, 19: { range: 59, fortifiedBonus: 3 } },
  // uncertain: missing base pistol/mine numbers are inferred from the later explicit changes.
  brickell: { 1: { range: 50, damage: 3, cooldown: 0.8 }, 2: { cooldown: 0.65 }, 6: { damage: 6 }, 7: { camo: true }, 12: { damage: 12, cooldown: 0.35 }, 15: { damage: 18 }, 17: { damage: 40 } },
  // uncertain: initial drone cooldown inferred from level 5's explicit multiplier.
  etienne: { 1: { range: 55, pierce: 2, cooldown: 0.7 }, 2: { range: 60 }, 4: { pierce: 3 }, 5: { camo: true, cooldown: 0.55 }, 7: { projectiles: 2 }, 9: { damage: 2 }, 11: { projectiles: 3 }, 12: { pierce: 6 }, 14: { damage: 3 }, 16: { pierce: 9, range: 80 }, 18: { damage: 4 }, 19: { projectiles: 4 } },
  sauda: { 1: { range: 23, cooldown: 0.4, pierce: 3, camo: true, ceramicBonus: 1, moabBonus: 1 }, 2: { pierce: 4 }, 4: { damage: 2, ceramicBonus: 2, moabBonus: 2 }, 5: { cooldown: 0.32 }, 6: { pierce: 6, range: 26 }, 7: { frozen: true }, 8: { cooldown: 0.25 }, 9: { damage: 3, ceramicBonus: 3, moabBonus: 3 }, 13: { lead: true }, 14: { cooldown: 0.16 }, 15: { range: 29, pierce: 8 }, 17: { damage: 4, ceramicBonus: 4, moabBonus: 4 }, 18: { cooldown: 0.1 } },
  psi: { 1: { range: 2000, camo: true, damageType: 'normal' }, 5: { cooldown: 0.85 }, 6: { lead: true }, 9: { projectiles: 2 }, 17: { projectiles: 3 } },
  // uncertain: Geraldo's base numbers are only mentioned retrospectively at level 19.
  geraldo: { 1: { range: 35, damage: 3, pierce: 20, radius: 10, damageType: 'plasma' }, 9: { radius: 13 }, 19: { cooldown: 0.8, damage: 4, range: 38, pierce: 25 } },
  // uncertain: Corvus/Silas descriptions omit most numeric stats; these explicit balance defaults avoid parsing prose as code.
  corvus: { 1: { range: 2000, damage: 2, pierce: 3, cooldown: 0.8, damageType: 'plasma' }, 2: { pierce: 5 }, 4: { damage: 3 }, 6: { damage: 4 }, 9: { damage: 5, moabBonus: 5 }, 14: { damage: 7 }, 16: { damage: 9 }, 20: { damage: 12, moabBonus: 12 } },
  rosalia: { 1: { range: 40, damage: 3, pierce: 3, damageType: 'energy' }, 5: { damage: 5 }, 8: { moabBonus: 5 }, 12: { damage: 10, moabBonus: 10 }, 13: { damageType: 'plasma' }, 15: { moabBonus: 30 }, 19: { damage: 15, moabBonus: 45 } },
  silas: { 1: { range: 45, damage: 1, pierce: 6, cooldown: 1, camo: true, damageType: 'cold', frozen: true, auraSlow: 0.85, bounceRange: 40 }, 11: { auraSlow: 0.8, moabSlow: 0.9 }, 13: { damageType: 'normal' }, 18: { auraSlow: 0.7, moabSlow: 0.85 } },
  // uncertain: Dan's initial melee range is unspecified; use 28 units.
  dan: { 1: { range: 28, damage: 1, pierce: 4, cooldown: 0.5 }, 2: { pierce: 6 }, 4: { damage: 2 }, 6: { damage: 3 },
    // uncertain: prose-only increases at 11, 15, 16 and 19 have no numbers.
    11: { range: 32, pierce: 9 }, 15: { pierce: 15 }, 16: { damage: 6 }, 19: { range: 36 } },
};
export function heroStats(kind: HeroKind, level: number): TowerStats {
  const stats = baseStats({ projectileSpeed: 400, lifespan: 2 });
  for (let n = 1; n <= Math.min(20, level); n++) Object.assign(stats, STATS[kind][n]);
  return stats;
}
const abilityCache = new Map<string, HeroAbility[]>();
export function heroAbilities(kind: HeroKind, l: number): HeroAbility[] {
  const key = `${kind}:${l}`, cached = abilityCache.get(key);
  if (cached) return cached;
  const table: Record<HeroKind, HeroAbility[]> = {
    quincy: [{ ...a('rapid', 'Rapid Shot', 3, l >= 15 ? 45 : 60, l >= 13 ? 12 : 8), initial: 16.7 }, a('arrows', 'Storm of Arrows', 10, l >= 18 ? 55 : 60, 3, l === 20 ? 12 : 6, 1e6, 100, 0.05)],
    gwen: [a('cocktail', 'Cocktail of Fire', 3, 30, 12, l === 20 ? 5 : l >= 14 ? 2 : 1, l >= 11 ? 60 : l >= 7 ? 40 : 20, 25, l >= 7 ? 0.1 : 0.2), a('firestorm', 'Firestorm', 10, 60, l >= 16 ? 10.4 : 8, l === 20 ? 10 : 5)],
    striker: [a('concussive', 'Concussive Shell', 3, l >= 15 ? 11 : 16, l >= 14 ? 6 : l >= 9 ? 4 : 1, l >= 9 ? 12 : 2, l >= 9 ? 48 : 36, l >= 14 ? 40.5 : 27), a('focus', 'Target Focus', 7, 45, 15), a('artillery', 'Artillery Command', 10, 80, 10)],
    obyn: [a('brambles', 'Brambles', 3, 30, 120, 1, l >= 16 ? 500 : l >= 7 ? 100 : 50, 12), a('trees', 'Wall of Trees', 10, l === 20 ? 75 : 90, 120, l === 20 ? 7500 : 2500, 1e6, 20)],
    churchill: [a('armor', 'Armor Piercing Shells', 3, 30, 10), a('barrage', 'MOAB Barrage', 10, l === 20 ? 30 : 60, 8, l === 20 ? 1000 : l >= 17 ? 500 : l >= 13 ? 250 : 200, 10, 2000, 0.5)],
    benjamin: [a('biohack', 'Biohack', 3, 30, l >= 19 ? 9 : l >= 13 ? 8 : 6, l >= 19 ? 3 : l >= 13 ? 2 : 1, l >= 13 ? 6 : 4), a('syphon', 'Syphon Funding', 10, 65, l === 20 ? 20 : 10)],
    ezili: [a('heartstopper', 'Heartstopper', 3, l >= 12 ? 40 : 45, l >= 12 ? 20 : 10), a('totem', 'Sacrificial Totem', 7, 60, l >= 16 ? 60 : 30), a('hex', 'MOAB Hex', 10, l === 20 ? 40 : 60, 25)],
    pat: [a('roar', 'Rallying Roar', 3, l === 20 ? 30 : 45, l >= 14 ? 10 : 8, l >= 14 ? 3 : 1, 1e6, l >= 14 ? 40 : 30), a('squeeze', 'Big Squeeze', 10, 20, 4, 0, l === 20 ? 4 : 1, 35)],
    adora: [a('light', 'The Long Arm of Light', 3, 45, l >= 16 ? 15 : 10), a('sacrifice', 'Blood Sacrifice', 7, 10), a('ball', 'Ball of Light', 10, 60, 12, l === 20 ? 20 : l >= 15 ? 5 : 3, l >= 13 ? 11 : 8, 2000, 0.05)],
    brickell: [a('naval', 'Naval Tactics', 3, 50, l >= 14 ? 12 : 9), a('chain', 'Blast Chain', 7, 45, 10), a('mine', 'Mega Mine', 10, l >= 18 ? 40 : l >= 13 ? 50 : 60, l >= 18 ? 150 : 120, l === 20 ? 11000 : 4000, l === 20 ? 150 : 100, l === 20 ? 120 : 100)],
    etienne: [a('drones', 'Drone Swarm', 3, l >= 16 ? 50 : l >= 6 ? 55 : 70, 20), a('ucav', 'UCAV', 10, l >= 13 ? 75 : 90, l >= 15 ? 20 : 18, l === 20 ? 10 : l >= 17 ? 7 : l >= 15 ? 4 : 2, l >= 15 ? 30 : 25, 2000, 0.2)],
    sauda: [a('leap', 'Leaping Sword', 3, 30, 5, l === 20 ? 400 : l >= 15 ? 80 : l >= 12 ? 40 : 20, l === 20 ? 70 : 50, 20, 0.1), a('charge', 'Sword Charge', 10, 45, 0, l === 20 ? 220 : l >= 16 ? 60 : 30, l === 20 ? 1400 : 400, 2000, 1, l === 20 ? 3 : l >= 14 ? 2 : 1)],
    psi: [a('psychic', 'Psychic Blast', 3, 40, l >= 12 ? 4.1 : l >= 7 ? 2.1 : 0.1, 0, 200, 60, 2), a('scream', 'Psionic Scream', 10, 60)],
    geraldo: [a('shop', "Geraldo's Shop", 1, 0)],
    corvus: [a('harvest', 'Soul Harvest', 3, 30, 0, 20, 30, 60), a('walk', 'Spirit Walk', 7, 30), a('ritual', 'Dark Ritual', 10, 60, 0, 100, 200, 100)],
    rosalia: [a('scatter', 'Scatter Missile', 3, l >= 16 ? 30 : 45, l === 20 ? 7.5 : l >= 9 ? 7.5 : 5, l >= 14 ? 10 : 5, 50, 40, l === 20 ? 1 / 12 : 0.25), a('flight', 'Flight Boost', 7, l >= 18 ? 25 : 45, 10), a('kinetic', 'Kinetic Charge', 10, l >= 16 ? 45 : 75, 10, l === 20 ? 4000 : 1500, 500, 50)],
    silas: [a('frostbite', 'Frostbite', 3, 30, l >= 15 ? 12 : 8), a('cascade', 'Frozen Cascade', 7, l >= 15 ? 45 : 60, 0, 20, 45, 40), a('burial', 'Frozen Burial', 10, l >= 15 ? 75 : 90, 0, 0)],
    dan: [a('transform', 'Transform', 3, 15, l >= 17 ? 15 : 9, l >= 4 ? 2 : 1, 15, 80, 1, 5), a('reposition', 'Reposition / Volant Strike', 7, l >= 17 ? 15 : 30, 0, 75, 35, 40), a('rouser', 'Rabble Rouser / Berserk Frenzy', 10, l >= 17 ? 45 : 60, 10)],
  };
  // uncertain: sources omit cooldowns/durations for several abilities; explicit defaults above are shared balance assumptions.
  const result = table[kind].filter(a => l >= a.level); abilityCache.set(key, result); return result;
}
