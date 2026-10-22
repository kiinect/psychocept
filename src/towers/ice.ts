import { ability, baseStats, tierTable, type TowerDefinition } from './types';
const base = baseStats({ kind: 'ice', damageType: 'cold', range: 20, radius: 20, cooldown: 2.4, pierce: 40, freezeDuration: 1.5, freezeLayers: 2, moabTargetable: false });
const tier = tierTable(base);
export const ice: TowerDefinition = {
  name: 'Ice Monkey', cost: 400, footprint: 6, color: 0x88ddff, base,
  paths: [
    [
      tier('Permafrost', 150, { afterSlow: 0.5 }),
      tier('Cold Snap', 350, { afterSlow: 0.5, lead: true, camo: true }),
      tier('Ice Shards', 1500, { afterSlow: 0.5, lead: true, camo: true, range: 25, strip: true, shards: 3, shardDamage: 2, shardPierce: 3, soak: 2 }),
      tier('Embrittlement', 2300, { afterSlow: 0.5, lead: true, camo: true, range: 25, strip: true, shards: 3, shardDamage: 2, shardPierce: 3, soak: 3, moabTargetable: true, brittle: 1, brittleDuration: 2 }),
      tier('Super Brittle', 28000, { afterSlow: 0.5, lead: true, camo: true, range: 25, strip: true, shards: 6, shardDamage: 5, shardPierce: 3, soak: 6, moabTargetable: true, brittle: 4, brittleDuration: 3, cooldown: 1.56, damageType: 'normal', damage: 5, ceramicBonus: 5 }),
    ],
    [
      tier('Enhanced Freeze', 200, { freezeDuration: 1.75, cooldown: 1.8 }),
      tier('Deep Freeze', 300, { freezeLayers: 3, freezeDuration: 2.2, cooldown: 1.8, pierce: 45 }),
      tier('Arctic Wind', 2750, { freezeLayers: 3, freezeDuration: 2.2, cooldown: 1.8, pierce: 45, auraSlow: 0.4 }),
      tier('Snowstorm', 4750, { freezeLayers: 3, ability: ability('snow', 40, 0, 6, 1), freezeDuration: 2.2, cooldown: 1.8, pierce: 45, auraSlow: 0.4, range: 30 }),
      tier('Absolute Zero', 21000, { freezeLayers: 8, globalFreeze: 0.6, ability: ability('snow', 25, 0, 6, 1, 1.5), freezeDuration: 2.2, cooldown: 1.8, pierce: 300, auraSlow: 0.6, range: 40, moabTargetable: true, moabSlow: 0.3 }),
    ],
    [
      tier('Larger Radius', 150, { range: 27 }),
      tier('Re-Freeze', 200, { range: 27, refreeze: true, frozen: true }),
      // uncertain: Cryo projectile speed/lifetime are unspecified; use 300 units/s and 1s.
      tier('Cryo Cannon', 1900, { kind: 'projectile', freezeLayers: 3, range: 46, radius: 20, cooldown: 1.2, refreeze: true, frozen: true }),
      tier('Icicles', 2750, { icicles: true, kind: 'projectile', freezeLayers: 3, range: 46, radius: 20, cooldown: 0.75, damage: 2, moabBonus: 8, moabTargetable: true, refreeze: true, frozen: true }),
      tier('Icicle Impale', 30000, { icicles: true, kind: 'projectile', freezeLayers: 3, range: 46, radius: 20, cooldown: 0.75, damage: 2, moabBonus: 48, moabTargetable: true, refreeze: true, frozen: true, damageType: 'shatter', impale: true }),
    ],
  ],
};
