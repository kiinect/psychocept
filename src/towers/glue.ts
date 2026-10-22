import { ability, baseStats, tierTable, type TowerDefinition } from './types';
const base = baseStats({ kind: 'glue', damageType: 'acid', range: 46, damage: 0, cooldown: 1, projectileSpeed: 300, lifespan: 0.43, slow: 0.5, glueDuration: 11, moabTargetable: false, lead: true, frozen: true });
const tier = tierTable(base);
export const glue: TowerDefinition = {
  name: 'Glue Gunner', cost: 225, footprint: 6, color: 0xeed34e, base,
  paths: [
    [
      tier('Glue Soak', 200, { glueLayers: 100 }),
      tier('Corrosive Glue', 300, { glueLayers: 100, dotDamage: 1, dotInterval: 2, moabTargetable: true }),
      tier('Bloon Dissolver', 2000, { glueLayers: 100, dotDamage: 1, dotInterval: 0.5, dotCeramicBonus: 2, moabTargetable: true, pierce: 2, cooldown: 0.5, glueLevel: 3 }),
      tier('Bloon Liquefier', 5000, { glueLayers: 100, dotDamage: 1, dotInterval: 0.1, dotCeramicBonus: 2, moabTargetable: true, pierce: 2, cooldown: 0.5, glueLevel: 4, puddleDamage: 4 }),
      tier('The Bloon Solver', 22500, { glueLayers: 100, dotDamage: 1, dotInterval: 0.1, dotCeramicBonus: 9, dotMoabBonus: 4, moabTargetable: true, pierce: 4, cooldown: 0.25, glueLevel: 6, puddleDamage: 15, projectiles: 2, spread: 10, radius: 12 }),
    ],
    [
      tier('Bigger Globs', 100, { pierce: 2 }),
      // uncertain: splatter radius is absent; use 12 units like Relentless Glue's splat.
      tier('Glue Splatter', 650, { pierce: 5, radius: 12 }),
      tier('Glue Hose', 1950, { pierce: 5, radius: 12, cooldown: 0.34, range: 58 }),
      tier('Glue Strike', 4500, { ability: ability('glue', 40, 13.333, 11), pierce: 5, radius: 12, cooldown: 0.34, range: 58 }),
      tier('Glue Storm', 16000, { ability: ability('glue', 40, 13.333, 20), pierce: 5, radius: 12, cooldown: 0.34, range: 58 }),
    ],
    [
      tier('Stickier Glue', 280, { glueDuration: 18 }),
      tier('Stronger Glue', 400, { glueDuration: 18, slow: 0.25 }),
      tier('MOAB Glue', 3600, { glueDuration: 18, slow: 0.25, moabTargetable: true, moabDuration: 9, moabSlow: 0.625, glueLevel: 5 }),
      tier('Relentless Glue', 4000, { glueDuration: 18, slow: 0.25, moabTargetable: true, moabDuration: 12, moabSlow: 0.625, glueLevel: 7, stun: 1, moabStun: 0.25 }),
      tier('Super Glue', 24000, { glueDuration: 18, slow: 0, moabTargetable: true, moabDuration: 13.5, moabSlow: 0, glueLevel: 8, stun: 1, moabStun: 0.25, pierce: 6, damage: 1, dotMoabBonus: 30, dotInterval: 0.95 }),
    ],
  ],
};
