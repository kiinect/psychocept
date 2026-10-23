// Monkey Knowledge: data from data/wiki/knowledge.json (wiki tables), effects hand-coded here and hooked into the sim.
// Only knowledge listed in SIMULATED changes gameplay; the rest is shown in the tree as "not simulated yet".
import mkJson from '../data/wiki/knowledge.json';
import { TOWERS, type TowerKind } from './towers';
import type { TowerStats } from './towers/types';
import type { Sim, Tower } from './sim';

export type KnowledgeTree = 'primary' | 'military' | 'magic' | 'support' | 'heroes' | 'powers';
export interface Knowledge { tree: KnowledgeTree; name: string; prereq: string[]; points: number; mm: number; description: string; note: string }
export const KNOWLEDGE = mkJson as Knowledge[];
export const KNOWLEDGE_BY_NAME: Record<string, Knowledge> = Object.fromEntries(KNOWLEDGE.map(k => [k.name, k]));
export const TREES: KnowledgeTree[] = ['primary', 'military', 'magic', 'support', 'heroes', 'powers'];

const MILITARY: TowerKind[] = ['sniper', 'sub', 'buccaneer', 'ace', 'heli', 'mortar', 'dartling'];
const MAGIC: TowerKind[] = ['wizard', 'super', 'ninja', 'alchemist', 'druid', 'mermonkey'];

/** Has tower t bought the upgrade with this name on any path? */
export function hasUpgrade(t: { type: TowerKind; tiers: readonly number[] }, name: string) {
  return TOWERS[t.type].paths.some((p, i) => p.slice(0, t.tiers[i]).some(u => u.name === name));
}
const firstTierOf = (type: TowerKind, name: string) => {
  for (let p = 0; p < 3; p++) { const i = TOWERS[type].paths[p].findIndex(u => u.name === name); if (i >= 0) return { path: p, tier: i + 1 }; }
  return undefined;
};

type Mod = (w: TowerStats, t: Tower, s: Sim) => void;
// uncertain: the wiki gives no number for "longer"/"increased"/"slightly"; those use +25% lifespan, +10% range/radius.
const STAT: Record<string, Mod> = {
  'Fast Tack Attacks': (w, t) => { if (t.type === 'tack') w.cooldown /= 1.08; },
  'Increased Lifespan': (w, t) => { if (['dart', 'bomb', 'tack', 'glue'].includes(t.type)) w.lifespan *= 1.25; },
  'Extra Dart Pops': (w, t) => { if (t.type === 'dart') w.pierce += 1; },
  'Poppy Blades': (w, t) => { if (hasUpgrade(t, 'Blade Shooter')) w.pierce += 2; },
  'Hard Tacks': (w, t) => { if (t.type === 'tack') w.frozen = true; },
  'Fast Glue': (w, t) => { if (t.type === 'glue') w.cooldown /= 1.1; },
  'Fraggy Frags': (w, t) => { if (w.frags > 0 && t.type === 'bomb') w.frags += 2; },
  'Crossbow Reach': (w, t) => { if (hasUpgrade(t, 'Crossbow')) w.range *= 1.1; },
  'Big Inferno': (w, t) => { if (hasUpgrade(t, 'Inferno Ring')) w.radius += 3; },
  'Icy Chill': (w, t) => { if (t.type === 'ice') w.radius *= 1.1; },
  'More Splatty Glue': (w, t) => { if (hasUpgrade(t, 'Glue Splatter')) w.pierce = Math.max(w.pierce, 8); },
  'Force vs Force': (w, t) => { if (hasUpgrade(t, 'Juggernaut')) w.moabBonus += 2; },
  'Naval Upgrades': (w, t) => { if (t.type === 'buccaneer' || t.type === 'sub') w.pierce += 1; },
  'Airforce Upgrades': (w, t) => { if (t.type === 'ace' || t.type === 'heli') w.pierce += 1; },
  'Accelerated Aerodarts': (w, t) => { if (t.type === 'ace') w.projectileSpeed *= 1.25; },
  'Gun Coolant': (w, t) => { if (t.type === 'ace') w.cooldown /= 1.1; },
  'Flanking Maneuvers': (w, t) => { if (['sniper', 'sub', 'buccaneer'].includes(t.type) && t.targeting === 'Last') w.cooldown /= 1.1; },
  'SUPER Range': (w, t) => { if (hasUpgrade(t, 'Super Range')) w.range *= 1.1; },
  'Lingering Magic': (w, t) => { if (['wizard', 'super', 'ninja', 'druid'].includes(t.type)) w.lifespan *= 1.25; },
  'Hot Magic': (w, t) => { if (MAGIC.includes(t.type)) w.frozen = true; },
  'Speedy Brewing': (w, t) => { if (t.type === 'alchemist') w.cooldown *= 0.95; },
  'Strike Down The False': (w, t) => { if (hasUpgrade(t, 'Sun Avatar')) w.universal = true; },
  'Deadly Tranquility': (w, t) => { if (hasUpgrade(t, 'Bloonjitsu')) w.projectiles += 1; },
  'One More Spike': (w, t) => { if (t.type === 'spike') w.pierce += 1; },
  'Veteran Monkey Training': w => { w.cooldown *= 0.97; },
};
/** Flat base-price cuts (before the difficulty multiplier), keyed by knowledge: [tower, upgrade name or '' for the tower itself, amount]. */
const CUTS: Record<string, [TowerKind, string, number][]> = {
  "Cheap 'Rangs": [['boomerang', '', 50]], 'Budget Clusters': [['bomb', 'Cluster Bombs', 100]], 'Cheaper Solution': [['glue', 'Bloon Liquefier', 1000]],
  'Cheaper Maiming': [['sniper', 'Maim MOAB', 1000]], 'Budget Battery': [['mortar', 'Artillery Battery', 600]],
  'Hi-Value Mines': [['spike', 'Spiked Mines', 1500]], 'Magic Tricks': [['wizard', 'Guided Magic', 25], ['wizard', 'Intense Magic', 25]],
  'Cheaper Doubles': [['ninja', 'Double Shot', 100]], 'Warm Oak': [['druid', 'Heart of Oak', 100]],
};
/** Power id -> knowledge that upgrades it (the powers' `...Upgraded` effect numbers). */
export const POWER_KNOWLEDGE: Record<string, string> = {
  super_monkey_storm: 'Powerful Monkey Storm', monkey_boost: 'Longer Boosts', thrive: 'Supa-Thrive', time_stop: 'Longer Time Stop',
  road_spikes: 'Just One More', glue_trap: 'Supersize Glue Trap', moab_mine: 'Mauling MOAB Mines', camo_trap: 'Bigger Camo Trap', banana_farmer: 'Fit Farmers',
};
const HOOKED = ['More Cash', 'Bonus Monkey!', 'Bonus Glue Gunner', 'Better Sell Deals', 'Flat Pack Buildings', 'Advanced Logistics', 'Aeronautic Subsidy',
  'Military Conscription', 'First Last Line of Defense', 'Farm Subsidy', 'Hero Favors', 'Empowered Heroes', 'Self Taught Heroes', 'Quick Hands', 'Heroic Reach',
  'Big Bloon Blueprints', 'Weak Point', 'Global Ability Cooldowns', 'Faster Takedowns', 'To ARMS!', 'Charged Chinooks', 'Trade Agreements', 'Bigger Banks',
  'Backroom Deals', 'More Valuable Bananas', 'Healthy Bananas', 'Big Traps', 'Thicker Foams', 'Insider Trades', 'Inland Revenue Streams', 'Acid Stability',
  'Mo\' Monkey Money', 'Cheaper Lakes', 'Budget Pontoons', 'Budget Cash Drops'];
export const SIMULATED = new Set([...Object.keys(STAT), ...Object.keys(CUTS), ...Object.values(POWER_KNOWLEDGE), ...HOOKED].filter(n => KNOWLEDGE_BY_NAME[n]));

const has = (s: Sim, n: string) => s.knowledge.has(n);

/** Per-tick weapon modifiers (non-paragons). */
export function knowledgeWeapon(s: Sim, t: Tower, w: TowerStats) {
  if (!s.knowledge.size) return;
  for (const n of s.knowledge) STAT[n]?.(w, t, s);
}
/** Raw cost before difficulty pricing: flat cuts, percentage cuts, first-of-type discounts. `tier` 0 = buying the tower. */
export function knowledgeCost(s: Sim, type: TowerKind, cost: number, tier = 0, path = -1) {
  if (!s.knowledge.size) return cost;
  const name = tier > 0 && path >= 0 ? TOWERS[type].paths[path][tier - 1]?.name ?? '' : '';
  for (const [n, cuts] of Object.entries(CUTS)) if (has(s, n)) for (const [k, u, amt] of cuts) if (k === type && u === name) cost = Math.max(0, cost - amt);
  if (has(s, 'Flat Pack Buildings') && (type === 'farm' || type === 'village')) cost *= 0.98;
  if (tier === 0) {
    if (has(s, 'Advanced Logistics') && MILITARY.includes(type)) cost *= 0.95;
    const first = !s.purchased.has(type), firstMilitary = !MILITARY.some(k => s.purchased.has(k));
    if (has(s, 'Military Conscription') && MILITARY.includes(type) && firstMilitary) cost *= 2 / 3;
    if (has(s, 'First Last Line of Defense') && type === 'spike' && first) cost = Math.max(0, cost - 150);
    if (has(s, 'Farm Subsidy') && type === 'farm' && first) cost = Math.max(0, cost - 100);
  } else if (has(s, 'Aeronautic Subsidy') && type === 'ace' && tier === 5) cost *= 0.9;
  return cost;
}
/** Free first Dart Monkey (Bonus Monkey!) or Glue Gunner (Bonus Glue Gunner); only one free tower per game. */
export const freeTower = (s: Sim, type: TowerKind) => !s.freeTowerUsed && (type === 'dart' && has(s, 'Bonus Monkey!') || type === 'glue' && has(s, 'Bonus Glue Gunner'));
export const sellRate = (s: Sim, t: Tower) => (has(s, 'Better Sell Deals') ? 5 : 0) + (has(s, 'Flat Pack Buildings') && (t.type === 'farm' || t.type === 'village') ? 2 : 0);
/** Hero stat changes applied whenever a hero's stats are (re)computed. */
export function knowledgeHero<T extends TowerStats>(s: Sim, stats: T): T {
  if (has(s, 'Quick Hands')) stats.cooldown /= 1.04;
  if (has(s, 'Heroic Reach')) stats.range *= 1.05; // uncertain: "slightly increased range"
  if (has(s, 'Big Bloon Blueprints')) stats.moabBonus = (stats.moabBonus ?? 0) + 1;
  if (has(s, 'Weak Point')) { stats.ceramicBonus = (stats.ceramicBonus ?? 0) + 1; stats.fortifiedBonus = (stats.fortifiedBonus ?? 0) + 1; }
  return stats;
}
/** Ability cooldown multiplier / seconds off for tower t. */
export function knowledgeCooldown(s: Sim, t: Tower, seconds: number) {
  if (has(s, 'Faster Takedowns') && hasUpgrade(t, 'Monkey Pirates') /* its MOAB Takedown ability */) seconds -= 5;
  return Math.max(1, seconds * (has(s, 'Global Ability Cooldowns') ? 0.97 : 1));
}
export { has as hasKnowledge, firstTierOf };
