// Original shop/spell mechanics from the supplied hero level descriptions.
import type { Pt, Sim, Tower } from './sim';
import { baseStats, type TowerStats } from './towers/types';
export interface ShopItem { id: string; name: string; level: number; cost: number; stock: number; restock: number; rounds: number }
// uncertain: the supplied table gives unlocks/effects but omits item prices, stock counts and some restock periods.
// These explicit local balance values are used consistently by the UI and simulation.
const item = (id: string, name: string, level: number, cost: number, rounds = 0, stock = 2, restock = 3): ShopItem => ({ id, name, level, cost, stock, restock, rounds });
export const HERO_ITEMS: ShopItem[] = [
  item('turret', 'Shooty Turret', 1, 250), item('nails', 'Stack of Old Nails', 1, 50),
  item('idol', 'Creepy Idol', 1, 100, 4), item('pickles', 'Jar of Pickles', 1, 100, 8),
  item('figure', 'Rare Quincy Action Figure', 2, 700, 0, 1, 99),
  item('invisibility', 'See Invisibility Potion', 3, 200, 5), item('glue', 'Tube of Amaz-o-Glue', 4, 100, 4),
  item('stone', 'Sharpening Stone', 5, 200, 10), item('cape', "Worn Hero's Cape", 6, 1500),
  item('blade', 'Blade Trap', 7, 650), item('fire', "Gerry's Fire", 8, 600, 5),
  item('fertilizer', 'Fertilizer', 9, 300, 4, 1, 3), item('rabbit', 'Pet Rabbit', 10, 1500, 0, 4, 99),
  item('rejuv', 'Rejuv Potion', 11, 2000), item('genie', 'Genie Bottle', 12, 2000, 2),
  item('paragon', 'Paragon Power Totem', 20, 26000),
];
export interface HeroSpell { id: string; name: string; level: number; mana: number; cooldown: number; duration: number }
const spell = (id: string, name: string, level: number, mana: number, cooldown: number, duration = 10): HeroSpell => ({ id, name, level, mana, cooldown, duration });
// uncertain: Corvus has no numeric effect table in this dataset; mana/cooldowns are explicit original balance defaults.
export const HERO_SPELLS = [
  spell('spear', 'Spear', 1, 20, 5), spell('nourishment', 'Nourishment', 1, 0, 30, 0), spell('repel', 'Repel', 1, 30, 15),
  spell('echo', 'Echo', 3, 40, 20), spell('haste', 'Haste', 3, 30, 15),
  spell('barrier', 'Soul Barrier', 4, 50, 30, 20), spell('trample', 'Trample', 4, 40, 15),
  spell('frostbound', 'Frostbound', 5, 40, 20), spell('aggression', 'Aggression', 5, 30, 15), spell('vision', 'Vision', 5, 20, 20),
  spell('ember', 'Ember', 6, 40, 20), spell('ancestral', 'Ancestral Might', 7, 100, 45), spell('malevolence', 'Malevolence', 7, 60, 20),
  spell('storm', 'Storm', 8, 80, 25), spell('recovery', 'Recovery', 10, 50, 30), spell('overload', 'Overload', 13, 200, 60, 0),
];
export interface HeroAsset extends Pt { id: string; round: number; expires: number; next: number; hp: number; value: number; tower?: Tower }
export interface HeroExtras { purchases: Record<string, { count: number; round: number }>; assets: HeroAsset[]; spellReady: Record<string, number>; paragonPower: number }
export const newExtras = (): HeroExtras => ({ purchases: {}, assets: [], spellReady: {}, paragonPower: 0 });
export function itemStock(s: Sim, id: string) {
  const h = s.hero, def = HERO_ITEMS.find(i => i.id === id); if (!h || h.kind !== 'geraldo' || !def || h.level < def.level) return 0;
  const used = h.purchases[id]; if (!used) return def.stock;
  return Math.min(def.stock, def.stock - used.count + Math.floor((s.round - used.round) / def.restock));
}
export function buyItem(s: Sim, id: string, point?: Pt, towerIndex?: number) {
  const h = s.hero, def = HERO_ITEMS.find(i => i.id === id);
  if (!h || !def || s.gameOver || itemStock(s, id) < 1 || s.cash < s.price(def.cost)) return false;
  const target = s.towers[towerIndex ?? -1];
  if (['pickles', 'invisibility', 'stone', 'cape', 'fire', 'fertilizer'].includes(id) && !target) return false;
  if (id === 'stone' && target.damageType !== 'sharp') return false;
  if (id === 'cape' && (target.type !== 'dart' || Math.max(...target.tiers) > 2)) return false;
  // Farms and Paragons are not part of this repository's tower catalog. Fertilizer requires an income producer.
  if (id === 'fertilizer' && !target.income) return false;
  const p = point ?? s.nearestTrack(h);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 960 || p.y < 0 || p.y > 540) return false;
  if (id === 'rabbit' && h.assets.filter(a => a.id === 'rabbit').length >= 4) return false;
  const stock = itemStock(s, id);
  h.purchases[id] = { count: def.stock - stock + 1, round: s.round }; s.cash -= s.price(def.cost);
  if (id === 'rejuv') {
    for (const t of s.towers) t.abilityReady = s.tick;
    for (const a of Object.keys(h.ready)) h.ready[a] = s.tick;
    if (s.difficulty !== 'impoppable') s.lives += 50;
    return true;
  }
  const rounds = id === 'invisibility' && h.level >= 14 ? 10 : def.rounds;
  h.assets.push({ ...p, id, round: s.round, expires: rounds ? s.round + rounds : Infinity, next: s.tick,
    hp: id === 'glue' ? 100 : id === 'nails' ? 10 : id === 'barrier' ? 100 : 1, value: s.price(def.cost), tower: target });
  if (id === 'paragon') h.paragonPower += 2000;
  return true;
}
export function sellFigure(s: Sim) {
  const h = s.hero; if (!h || s.gameOver) return false;
  const a = h.assets.find(a => a.id === 'figure'); if (!a) return false;
  s.cash += Math.floor(a.value); h.assets.splice(h.assets.indexOf(a), 1); return true;
}
export function castSpell(s: Sim, id: string) {
  const h = s.hero, d = HERO_SPELLS.find(d => d.id === id);
  if (!h || h.kind !== 'corvus' || !d || s.gameOver || h.level < d.level || h.mana < d.mana || s.tick < (h.spellReady[id] ?? 0)) return false;
  if (id === 'nourishment' && h.mana <= 0) return false;
  h.mana -= d.mana; h.spellReady[id] = s.tick + d.cooldown * 60; h.until[id] = s.tick + d.duration * 60;
  if (id === 'nourishment') { const mana = h.mana; h.mana = 0; s.grantHeroXP(mana * 4); s.cash += mana * (h.level === 20 ? 3 : h.level >= 15 ? 2 : 1); }
  if (id === 'recovery') h.mana = Math.min(800, h.mana + 100);
  if (id === 'overload') s.heroBurst(h, 2000, baseStats({ damage: h.level === 20 ? 1000 : 400, damageType: 'normal', pierce: 500, camo: true, frozen: true }));
  if (id === 'barrier') h.assets.push({ ...h, id: 'barrier', round: s.round, expires: Infinity, next: s.tick + d.duration * 60, hp: h.level >= 17 ? 200 : h.level >= 9 ? 100 : 50, value: 0 });
  return true;
}
export function extraWeapon(s: Sim, tower: Tower, stats: TowerStats) {
  const h = s.hero; if (!h) return;
  for (const a of h.assets) if (a.tower === tower && s.round < a.expires) {
    if (a.id === 'invisibility') { stats.camo = true; if (h.level >= 14) stats.range *= 1.2; if (h.level >= 19) stats.camoBonus++; }
    if (a.id === 'stone') { stats.pierce += h.level >= 15 ? 2 : 1; if (h.level >= 15) stats.damage++; }
    if (a.id === 'pickles') { stats.damage += h.level >= 16 ? 2 : 1; stats.cooldown *= 1.25; }
    if (a.id === 'cape') { stats.cooldown = Math.min(stats.cooldown, 0.06); stats.range = Math.max(stats.range, 50); }
    if (a.id === 'fertilizer') stats.income *= 1.2;
  }
}
export function updateExtras(s: Sim) {
  const h = s.hero; if (!h) return;
  for (const a of h.assets) {
    if (a.id === 'barrier') continue;
    if (a.expires <= s.round || a.hp <= 0 || s.tick < a.next) continue;
    a.next = s.tick + (a.id === 'genie' ? 6 : a.id === 'fire' ? 6 : a.id === 'rabbit' ? 12 : 60);
    const targets = s.bloons.filter(b => Math.hypot(s.posOf(b).x - a.x, s.posOf(b).y - a.y) < (a.id === 'genie' ? 2000 : a.id === 'turret' ? 60 : 30));
    const stats = baseStats({ damageType: 'normal', camo: a.id === 'nails' || a.id === 'genie', pierce: 20 });
    if (a.id === 'turret') { stats.damageType = 'sharp'; stats.damage = h.level >= 13 ? 6 : 2; }
    else if (a.id === 'nails') { stats.damage = h.level >= 13 ? 6 : 1; stats.pierce = a.hp; }
    else if (a.id === 'glue') { stats.damage = 0; stats.kind = 'glue'; stats.glueDuration = 24; stats.slow = 0.5; stats.moabSlow = h.level >= 17 ? 0.5 : 1; }
    else if (a.id === 'idol') { for (const b of targets) if (!['bad', 'zomg', 'ddt'].includes(b.type)) { b.dist = Math.max(0, b.dist - (h.level >= 18 ? 60 : 20)); b.stunnedUntil = s.tick + 60; } continue; }
    else if (a.id === 'blade') { stats.damageType = 'sharp'; stats.pierce = 200; stats.damage = h.level >= 15 ? 2 : 1; }
    else if (a.id === 'fire') { stats.damageType = 'fire'; stats.damage = h.level >= 16 ? 2 : 1; stats.burnDamage = stats.damage; stats.burnDuration = 3; stats.burnInterval = 1.5; }
    else if (a.id === 'genie') { stats.damageType = 'plasma'; stats.damage = h.level >= 18 ? 30 : 15; stats.pierce = 30; }
    else if (a.id === 'rabbit') { if (h.assets.filter(a => a.id === 'rabbit').length < 4 || h.assets.find(a => a.id === 'rabbit') !== a) continue; stats.damage = 10; }
    else continue;
    for (const b of targets.slice(0, stats.pierce)) s.heroHit(b, stats, a);
    if (['nails', 'glue', 'blade'].includes(a.id)) a.hp -= targets.length;
  }
  h.assets = h.assets.filter(a => a.expires > s.round && a.hp > 0 && (a.id !== 'barrier' || a.next > s.tick));
}
