import { ability, baseStats, tierTable, type TowerDefinition } from './types';
const base = baseStats({ kind: 'bomb', damageType: 'explosion', range: 40, cooldown: 1.5, pierce: 22, radius: 12, projectileSpeed: 180, lead: true, frozen: true });
const tier = tierTable(base);
export const bomb: TowerDefinition = {
  name: 'Bomb Shooter', cost: 375, footprint: 7, color: 0x353b46, base,
  paths: [
    [
      tier('Bigger Bombs', 250, { radius: 18, pierce: 28 }),
      tier('Heavy Bombs', 650, { radius: 18, pierce: 38, damage: 2 }),
      tier('Really Big Bombs', 1100, { radius: 27, pierce: 80, damage: 4, knockback: true }),
      tier('Bloon Impact', 2800, { radius: 27, pierce: 80, damage: 4, knockback: true, stun: 1.4, range: 43 }),
      tier('Bloon Crush', 55000, { radius: 27, pierce: 80, damage: 24, damageType: 'normal', knockback: true, stun: 1.4, moabStun: 2, range: 43 }),
    ],
    [
      tier('Faster Reload', 250, { cooldown: 1.125 }),
      tier('Missile Launcher', 400, { cooldown: 0.825, range: 44, projectileSpeed: 270 }),
      tier('MOAB Mauler', 1000, { cooldown: 0.825, range: 49, projectileSpeed: 270, moabBonus: 15 }),
      tier('MOAB Assassin', 3450, { ability: ability('missile', 30, 0, 0, 750), cooldown: 0.825, range: 54, projectileSpeed: 270, moabBonus: 30 }),
      tier('MOAB Eliminator', 26000, { ability: ability('missile', 10, 0, 0, 4500), cooldown: 0.825, range: 54, projectileSpeed: 270, moabBonus: 99 }),
    ],
    [
      tier('Extra Range', 200, { range: 52 }),
      tier('Frag Bombs', 300, { range: 54, frags: 8 }),
      tier('Cluster Bombs', 700, { range: 54, clusters: 8 }),
      tier('Recursive Cluster', 2500, { range: 54, damage: 2, clusters: 8, recursive: 2 }),
      tier('Bomb Blitz', 30000, { range: 54, damage: 5, clusters: 8, recursive: 1, cooldown: 0.9 }),
    ],
  ],
};
