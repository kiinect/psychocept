import type { TowerStats } from '../towers/types';
/** Summarise the actual tier data rather than inventing upgrade effects. */
export function upgradeDescription(before: Readonly<TowerStats>, after: Readonly<TowerStats>): string {
  const labels: Partial<Record<keyof TowerStats, string>> = { damage: 'Damage', pierce: 'Pierce', range: 'Range', cooldown: 'Attack interval', projectiles: 'Projectiles', camo: 'Camo detection', lead: 'Lead popping', frozen: 'Frozen popping', income: 'Income', moabBonus: 'MOAB bonus', ceramicBonus: 'Ceramic bonus', ability: 'Ability' };
  const changes = (Object.keys(labels) as (keyof TowerStats)[]).filter(k => before[k] !== after[k]).map(k => `${labels[k]}: ${typeof after[k] === 'object' ? after[k] ? 'unlocked' : 'none' : typeof after[k] === 'boolean' ? after[k] ? 'yes' : 'no' : after[k]}`);
  if (!changes.length) {
    for (const k of Object.keys(after) as (keyof TowerStats)[]) {
      if (before[k] === after[k] || typeof after[k] === 'object') continue;
      const label = k.replace(/[A-Z]/g, c => ' ' + c.toLowerCase());
      changes.push(`${label}: ${after[k]}`);
    }
  }
  return changes.slice(0, 3).join(' · ') || 'Retains the current weapon stats.';
}
