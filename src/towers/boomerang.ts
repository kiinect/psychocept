import { ability, baseStats, tierTable, type TowerDefinition } from './types';
const base = baseStats({ kind: 'boomerang', range: 43, cooldown: 1.2, pierce: 4, projectileSpeed: 175, lifespan: 5 });
const tier = tierTable(base);
export const boomerang: TowerDefinition = {
  name: 'Boomerang Monkey', cost: 315, footprint: 7, color: 0xe39931, base,
  paths: [
    [
      tier('Improved Rangs', 200, { pierce: 8 }),
      tier('Glaives', 280, { pierce: 13 }),
      tier('Glaive Ricochet', 600, { pierce: 15, bounceRange: 80, projectileSpeed: 220 }),
      tier('M.O.A.R. Glaives', 2000, { pierce: 60, cooldown: 0.4, bounceRange: 180, projectileSpeed: 300 }),
      tier('Glaive Lord', 32500, { pierce: 60, damage: 6, ceramicBonus: 10, cooldown: 0.4, bounceRange: 2000, projectileSpeed: 300, rehit: 0.6, orbit: 30, dotDamage: 100, dotInterval: 1 }),
    ],
    [
      tier('Faster Throwing', 175, { cooldown: 0.9 }),
      // uncertain: prose labels the total multiplier inconsistently; use 50% of base.
      tier('Faster Rangs', 250, { cooldown: 0.6, projectileSpeed: 227.5 }),
      tier('Bionic Boomerang', 1250, { cooldown: 0.15, projectileSpeed: 227.5, moabBonus: 1 }),
      tier('Turbo Charge', 4200, { ability: ability('boost', 45, 15, 10, 1, 5), cooldown: 0.15, projectileSpeed: 227.5, moabBonus: 1 }),
      tier('Perma Charge', 35000, { ability: ability('boost', 45, 15, 15, 10), cooldown: 0.03, damage: 4, projectileSpeed: 227.5, moabBonus: 1 }),
    ],
    [
      tier('Long Range Rangs', 100, { range: 57.19 }),
      tier('Red Hot Rangs', 300, { range: 57.19, damage: 2, damageType: 'normal', lead: true, frozen: true }),
      tier('Kylie Boomerang', 1300, { range: 57.19, damage: 2, damageType: 'normal', lead: true, frozen: true, pierce: 18, rehit: 0.3 }),
      tier('MOAB Press', 2700, { secondaryCooldown: 10, heavyPierce: 200, range: 57.19, damage: 2, damageType: 'normal', lead: true, frozen: true, pierce: 18, rehit: 0.1 }),
      tier('MOAB Domination', 50000, { secondaryCooldown: 4, heavyPierce: 300, heavyDamage: 24, heavyRadius: 50, heavyBurn: 50, range: 57.19, damage: 12, damageType: 'normal', lead: true, frozen: true, pierce: 54, cooldown: 0.6, rehit: 0.1 }),
    ],
  ],
};
