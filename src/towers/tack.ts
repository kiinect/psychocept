import { ability, baseStats, tierTable, type TowerDefinition } from './types';
const base = baseStats({ kind: 'tack', range: 23, cooldown: 1.12, projectiles: 8, projectileSpeed: 160, lifespan: 0.2 });
const tier = tierTable(base);
export const tack: TowerDefinition = {
  name: 'Tack Shooter', cost: 260, footprint: 6, color: 0xc95590, base,
  paths: [
    [
      tier('Faster Shooting', 150, { cooldown: 0.84 }),
      tier('Even Faster Shooting', 220, { cooldown: 0.63 }),
      tier('Hot Shots', 600, { cooldown: 0.63, damage: 3, lead: true, frozen: true, damageType: 'normal' }),
      tier('Ring of Fire', 3500, { kind: 'ring', cooldown: 0.315, damage: 5, pierce: 30, lead: true, frozen: true, damageType: 'fire' }),
      // uncertain: meteor cadence is absent; use one meteor every 4s.
      tier('Inferno Ring', 45500, { meteor: 700, secondaryCooldown: 4, kind: 'ring', cooldown: 0.1, damage: 8, moabBonus: 4, pierce: 45, range: 34.5, lead: true, frozen: true, damageType: 'fire' }),
    ],
    [
      tier('Long Range Tacks', 100, { range: 26.91, projectileSpeed: 187.2, lifespan: 0.234 }),
      tier('Super Range Tacks', 225, { range: 30.82, pierce: 4, projectileSpeed: 187.2, lifespan: 0.2631096 }),
      tier('Blade Shooter', 550, { range: 46, pierce: 8, damageType: 'shatter', projectileSpeed: 187.2, lifespan: 0.2631096, frozen: true }),
      // uncertain: ability cooldown is absent; use 20s for both Maelstrom abilities.
      tier('Blade Maelstrom', 2700, { ability: ability('blades', 20, 0, 3, 2, 1, 2, 100), range: 46, pierce: 8, damage: 2, damageType: 'shatter', projectileSpeed: 187.2, lifespan: 0.2631096, frozen: true }),
      tier('Super Maelstrom', 15000, { ability: ability('blades', 20, 0, 9, 5, 1, 4, 300), range: 46, pierce: 8, damage: 5, ceramicBonus: 5, damageType: 'normal', lead: true, frozen: true, projectileSpeed: 187.2, lifespan: 0.2631096 }),
    ],
    [
      tier('More Tacks', 150, { projectiles: 10 }),
      tier('Even More Tacks', 150, { projectiles: 12 }),
      tier('Tack Sprayer', 450, { projectiles: 16, pierce: 2 }),
      tier('Overdrive', 3200, { projectiles: 16, pierce: 2, cooldown: 0.3733 }),
      tier('The Tack Zone', 20000, { projectiles: 32, pierce: 2, cooldown: 0.224, range: 30, moabBonus: 1 }),
    ],
  ],
};
