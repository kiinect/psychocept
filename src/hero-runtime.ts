import { knowledgeHero } from './knowledge';
import { HEROES, heroStats, heroAbilities, heroLevelXP, heroRoundXP, type HeroKind, type HeroAbility } from './heroes';
import { BLOONS, TARGETING, type Sim, type Pt, type Bloon, type Targeting, type Tower } from './sim';
import { newExtras, extraWeapon, updateExtras, type HeroExtras } from './hero-extras';
import type { TowerStats } from './towers/types';
export interface Hero extends Pt, HeroExtras {
  home: Pt; kind: HeroKind; level: number; xp: number; stats: TowerStats; targeting: Targeting; cost: number;
  cd: number; shots: number; secondary: number; passive: number; mana: number; transformed: boolean;
  ready: Record<string, number>; until: Record<string, number>; next: Record<string, number>;
  point: Pt; buffs: { tower: Tower; until: number; damage: number; rest: number }[];
  zones: { id: string; point: Pt; until: number; round: number; next: number; remaining: number; ability: HeroAbility }[];
  pending: { at: number; bloon: Bloon; damage: number; destroy: boolean; kind?: 'kinetic' | 'squeeze'; initialHP?: number }[];
}
export const moab = (b: Bloon) => ['moab', 'bfb', 'zomg', 'ddt', 'bad'].includes(b.type);
export function newHero(kind: HeroKind, x: number, y: number, cost: number): Hero {
  return { ...newExtras(), home: { x, y }, kind, x, y, cost, level: 1, xp: 0, stats: heroStats(kind, 1), targeting: 'First', cd: 0,
    shots: 0, secondary: 0, passive: 0, mana: 100, transformed: false, ready: {}, until: {}, next: {},
    point: { x, y }, buffs: [], zones: [], pending: [] };
}
export function grantXP(s: Sim, amount: number) {
  if (s.knowledge.has('Self Taught Heroes')) amount *= 1.1;
  const h = s.hero; if (!h || s.gameOver || !Number.isFinite(amount) || amount < 0) return false;
  h.xp += amount;
  while (h.level < 20 && h.xp >= heroLevelXP(h.kind, h.level + 1)) {
    h.xp -= heroLevelXP(h.kind, ++h.level); h.stats = knowledgeHero(s, heroStats(h.kind, h.level));
    for (const a of heroAbilities(h.kind, h.level).filter(a => a.level === h.level)) h.ready[a.id] = s.tick + a.initial * 60;
  }
  if (h.level === 20) h.xp = 0;
  return true;
}
export function roundHero(s: Sim) {
  const h = s.hero; if (!h) return;
  s.payTo(0, () => s.earnIncome(h.stats.income)); // co-op: the hero belongs to player 1
  if (h.kind === 'benjamin' && h.level >= 4) {
    const full = s.difficulty === 'easy' ? 200 : s.difficulty === 'medium' ? 150 : s.difficulty === 'hard' ? 100 : 1;
    if (s.difficulty !== 'impoppable') s.lives = Math.max(s.lives, Math.min(full + (h.level >= 14 ? 100 : 0), s.lives + (h.level >= 14 ? 10 : 5)));
  }
  const ice = h.kind === 'silas' && h.level >= 8 ? Math.min(0.5, s.towers.filter(t => t.type === 'ice' && Math.max(...t.tiers) >= 3).length * 0.05) : 0;
  for (const asset of h.assets) if (asset.id === 'figure') asset.value *= 1.1; // uncertain: source specifies exponential growth without a rate.
  grantXP(s, heroRoundXP(s.round) * (1 + ice));
}
const active = (s: Sim, h: Hero, id: string) => (h.until[id] ?? 0) > s.tick;
export function heroTargets(s: Sim, h: Hero, range = h.stats.range) {
  const result = s.bloons.filter(b => (!(b.camo || b.type === 'ddt') || h.stats.camo || active(s, h, 'vision')) &&
    Math.hypot(s.posOf(b).x - h.x, s.posOf(b).y - h.y) <= range + 7);
  const dist = (b: Bloon) => Math.hypot(s.posOf(b).x - h.x, s.posOf(b).y - h.y);
  return result.sort((a, b) => h.targeting === 'Last' ? a.dist - b.dist : h.targeting === 'Close' ? dist(a) - dist(b) : h.targeting === 'Strong' ? BLOONS[b.type].rbe - BLOONS[a.type].rbe || b.dist - a.dist : b.dist - a.dist);
}
function hit(s: Sim, h: Hero, b: Bloon, patch: Partial<TowerStats> = {}) { s.heroHit(b, { ...h.stats, ...patch }, h); }
function blast(s: Sim, h: Hero, p: Pt, radius: number, patch: Partial<TowerStats> = {}) { s.heroBurst(p, radius, { ...h.stats, ...patch }); }
function normal(a: HeroAbility): Partial<TowerStats> { return { damage: a.damage, pierce: a.pierce, damageType: 'normal', camo: true, frozen: true, lead: true, moabBonus: 0, ceramicBonus: 0, burnDamage: 0, radius: 0 }; }
function eligiblePsi(h: Hero, b: Bloon) {
  return b.type !== 'bad' && (b.type !== 'lead' || h.level >= 6) && (b.type !== 'purple' || h.level >= 11) &&
    (!b.type.includes('ceramic') || h.level >= 7) && (!moab(b) || h.level >= ({ moab: 14, bfb: 16, ddt: 20, zomg: 20 }[b.type] ?? 99));
}
export function activateHero(s: Sim, id: string, point?: Pt, towerIndex?: number) {
  const h = s.hero; if (!h || s.gameOver) return false;
  const l = h.level;
  const a = heroAbilities(h.kind, h.level).find(a => a.id === id);
  if (!a || s.tick < (h.ready[id] ?? 0) || id === 'shop') return false;
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > s.width || point.y > s.height)) return false;
  const targets = heroTargets(s, h, a.radius === 2000 || id === 'kinetic' ? 2000 : Math.max(h.stats.range, a.radius));
  const p = point ?? (targets[0] ? s.posOf(targets[0]) : s.nearestTrack(h));
  if (id === 'totem' && s.lives <= (h.level >= 16 ? 1 : 10)) return false;
  if (id === 'sacrifice' && !s.towers[towerIndex ?? -1]) return false;
  if (id === 'walk' || id === 'reposition') {
    if (!point || !s.canPlaceHero(point.x, point.y, h.kind, true)) return false;
    h.x = point.x; h.y = point.y;
  }
  if (id === 'mine' && !s.water.some(w => p.x >= w.x && p.x <= w.x + w.width && p.y >= w.y && p.y <= w.y + w.height)) return false;
  if (['hex', 'squeeze', 'barrage'].includes(id) && !targets.some(b => moab(b) && (b.type !== 'bad' || id === 'barrage' || h.level === 20 && id === 'hex'))) return false;
  h.ready[id] = s.tick + a.cooldown * 60; h.until[id] = s.tick + a.duration * 60; h.next[id] = s.tick; h.point = { ...p };
  if (id === 'totem') s.lives -= h.level >= 16 ? 1 : 10;
  if (id === 'transform') { h.transformed = !h.transformed; for (let n = 0; n < a.count; n++) blast(s, h, h, a.radius, normal(a)); }
  if (id === 'reposition' && h.transformed) blast(s, h, h, a.radius, { ...normal(a), stun: 6, moabStun: 1.5 });
  if (id === 'sacrifice') {
    const t = s.towers[towerIndex!]; grantXP(s, t.cost * 4); s.towers.splice(towerIndex!, 1);
    // uncertain: level 7's source omits its buff formula; level 20 documents $100 per 1%.
    h.until.sacrifice = s.tick + (h.level === 20 ? 60 : 10) * 60; h.next.sacrifice = Math.min(h.level === 20 ? 0.5 : 0.25, t.cost / 10000);
  }
  if (id === 'biohack') {
    const allies = [...s.towers].sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, a.pierce);
    h.buffs = allies.map(tower => ({ tower, until: h.until[id], damage: a.damage, rest: h.until[id] + 120 }));
  }
  if (id === 'artillery') for (const t of s.towers) if (['bomb', 'mortar'].includes(t.type)) t.abilityReady = s.tick;
  if (id === 'heartstopper') for (const b of s.bloons) b.regrow = false;
  if (id === 'concussive') blast(s, h, p, a.radius, { ...normal(a), stun: a.duration, moabStun: a.duration / 2 });
  if (id === 'charge') for (let n = 0; n < a.count; n++) blast(s, h, h, 2000, normal(a));
  if (id === 'firestorm') {
    blast(s, h, h, 2000, { ...normal(a), damageType: h.level >= 16 ? 'normal' : 'fire', moabBonus: h.level === 20 ? 40 : 15,
      burnDamage: h.level === 20 ? 15 : h.level >= 16 ? 5 : 1, burnMoab: h.level === 20 ? 0 : 6.5, burnInterval: 0.5, burnDuration: a.duration });
    h.until.heat = s.tick + 480;
  }
  if (['harvest', 'ritual'].includes(id)) { blast(s, h, h, a.radius, normal(a)); h.mana = Math.min(800, h.mana + a.pierce); }
  if (id === 'scream') for (const b of s.bloons.slice(0, 2000)) if (eligiblePsi(h, b)) {
    if (h.level === 20 || s.rng() < 0.5) s.heroDestroy(b); else b.dist = Math.max(0, b.dist - 100 - 150 * s.rng());
  }
  if (id === 'squeeze') {
    for (const b of targets.filter(b => moab(b) && b.type !== 'bad' && Math.hypot(s.posOf(b).x - h.x, s.posOf(b).y - h.y) <= 42).slice(0, a.pierce)) {
      b.stunnedUntil = s.tick + 360; h.pending.push({ at: s.tick + 240, bloon: b, damage: b.hp, destroy: false, kind: 'squeeze' });
    }
    h.cd = 5;
  }
  if (id === 'hex') h.next.hexTarget = -1;
  if (['brambles', 'trees', 'mine', 'cocktail', 'leap'].includes(id)) {
    if (id === 'leap') blast(s, h, p, a.radius, { ...normal(a), moabBonus: h.level >= 12 ? 140 : 0 });
    h.zones.push({ id, point: { ...p }, until: s.tick + a.duration * 60, round: s.round, next: s.tick,
      remaining: id === 'trees' ? a.damage : a.pierce, ability: a });
  }
  if (id === 'kinetic') {
    const b = targets.find(moab);
    if (b) h.pending.push({ at: s.tick + 600, bloon: b, damage: a.damage, destroy: false, kind: 'kinetic', initialHP: b.hp });
    else h.zones.push({ id, point: p, until: s.tick + 3600, round: s.round, next: s.tick, remaining: 1, ability: a });
  }
  if (id === 'cascade' || id === 'burial') {
    const places = id === 'burial' ? [{ x: s.width / 2, y: s.height / 2 }] : [h, ...s.towers.filter(t => t.type === 'ice').sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, 9)];
    for (const p of places) {
      const near = s.bloons.filter(b => Math.hypot(s.posOf(b).x - p.x, s.posOf(b).y - p.y) <= (id === 'burial' ? 2000 : 47)).slice(0, a.pierce);
      for (const b of near) hit(s, h, b, { ...normal(a), damage: a.damage + ((b.frozenUntil ?? 0) > s.tick ? id === 'burial' ? l >= 15 ? 200 : 60 : l >= 15 ? 30 : 15 : 0),
        damageType: id === 'cascade' && ['lead', 'ddt'].includes(b.type) ? 'cold' : 'normal', freezeDuration: id === 'burial' ? 6 : 9, freezeLayers: 10, moabStun: id === 'burial' ? 3 : 0 });
    }
    if (id === 'burial') for (let distance = 0; distance < s.pathLen; distance += 25) {
      const p = s.posAt(distance); if (Math.hypot(p.x - h.x, p.y - h.y) <= h.stats.range) createWall(s, h, p);
    }
  }
  return true;
}
export function heroTowerWeapon(s: Sim, tower: Tower, base: Tower = tower): Tower {
  const h = s.hero; if (!h || tower.degree) return base; // paragons reject hero buffs
  const t = { ...base }, l = h.level, near = Math.hypot(t.x - h.x, t.y - h.y) <= h.stats.range;
  if (h.kind === 'etienne' && l >= 8) t.camo = true;
  if (h.kind === 'striker') {
    if (['bomb', 'mortar'].includes(t.type)) {
      if (l >= 4) t.cooldown *= l >= 18 ? 0.81 : 0.9;
      if (l >= 20 && active(s, h, 'artillery')) { t.damage *= 2; t.pierce *= 2; }
      if (t.type === 'mortar' && l >= 7) t.radius *= 1.1;
      if (t.type === 'mortar' && active(s, h, 'focus')) { t.impactSpread *= 0.7; t.targetPoint = h.point; }
    }
    if (near && l >= 8) { t.range *= 1.05; t.pierce *= 1.25; }
  }
  if (h.kind === 'gwen' && near && active(s, h, 'heat')) {
    t.lead = t.frozen = true; t.pierce++;
    if (l >= 17) { t.damage++; t.leadBonus += 2; }
  }
  if (h.kind === 'gwen' && l >= 5 && (t.type === 'tack' && t.tiers[0] >= 4 || t.type === 'mortar' && t.tiers[2] >= 3)) { t.cooldown *= l >= 18 ? 0.8 : 0.9; t.radius *= l >= 18 ? 1.2 : 1.1; }
  if (h.kind === 'pat' && Math.hypot(t.x - h.x, t.y - h.y) <= (l >= 14 ? 40 : 30) && active(s, h, 'roar')) t.damage += l >= 14 ? 3 : 1;
  if (h.kind === 'ezili' && near && active(s, h, 'totem')) { t.camo = true; t.pierce++; t.range *= 1.2; t.cooldown *= 0.85; t.projectileSpeed *= 1.25; }
  if (h.kind === 'brickell' && (t.type === 'sub' || t.type === 'buccaneer') && (near || l >= 19)) {
    if (l >= 4) t.pierce++;
    if (active(s, h, 'naval')) { t.cooldown *= l >= 16 ? 0.5 : 0.66; if (l >= 5) { t.pierce++; t.damageType = 'normal'; } if (l >= 8) t.camo = true; if (l >= 14) t.damage++; }
  }
  if (h.kind === 'silas' && t.type === 'ice') { if (l >= 8) t.range += 5; if (l >= 5) t.freezeDuration *= l === 20 ? 2.5 : 1.5; }
  if (h.kind === 'rosalia' && active(s, h, 'flight') && ['ace', 'heli'].includes(t.type) && Math.hypot(t.x - h.home.x, t.y - h.home.y) <= 60) t.moveSpeed *= 1.5; // uncertain: speed multiplier omitted.
  if (h.kind === 'dan' && near && active(s, h, 'rouser') && !h.transformed) { t.damage *= 1.5; t.cooldown *= 1.2; }
  for (const buff of h.buffs) if (buff.tower === tower && s.tick < buff.rest) {
    if (s.tick < buff.until) t.damage += buff.damage; else t.cooldown = 1e9;
  }
  extraWeapon(s, tower, t);
  return t;
}
export function updateHero(s: Sim) {
  const h = s.hero; if (!h) return;
  const l = h.level;
  updateExtras(s);
  if (h.kind === 'dan' && l >= 14 && (h.next.healLeft ?? 0) > 0 && s.tick >= (h.next.heal ?? 0) && s.difficulty !== 'impoppable') { s.lives++; h.next.healLeft--; h.next.heal = s.tick + 60; }
  if (h.kind === 'silas' && l >= 4 && s.tick >= h.passive) { createWall(s, h, s.nearestTrack(h)); h.passive = s.tick + (l === 20 ? 420 : 600); }
  const resolved = new Set<Hero['pending'][number]>();
  for (const p of h.pending) {
    const received = Math.max(0, (p.initialHP ?? p.bloon.hp) - p.bloon.hp);
    if (p.at > s.tick && !(p.kind === 'kinetic' && (!s.bloons.includes(p.bloon) || received >= (l === 20 ? 16000 : 6000)))) continue;
    resolved.add(p);
    if (p.kind === 'kinetic') {
      blast(s, h, s.posOf(p.bloon), 50, { damage: p.damage + Math.min(l === 20 ? 12000 : 4500, received), pierce: 500, damageType: 'normal', moabBonus: 0, camo: true });
    } else if (p.kind === 'squeeze' && s.bloons.includes(p.bloon)) {
      hit(s, h, p.bloon, { damage: p.bloon.hp, moabBonus: 0, ceramicBonus: 0, damageType: 'normal' });
      for (const b of s.bloons) if (Math.abs(b.dist - p.bloon.dist) < 10) b.stunnedUntil = s.tick + 120;
    } else if (p.destroy) {
      const present = s.bloons.includes(p.bloon); s.heroDestroy(p.bloon);
      if (present && h.kind === 'psi' && l >= 8) blast(s, h, s.posOf(p.bloon), l >= 19 ? 30 : 20, { damage: l >= 19 ? 10 : l >= 15 ? 3 : 1, pierce: 10, damageType: 'plasma', camo: true });
    } else if (s.bloons.includes(p.bloon)) hit(s, h, p.bloon, { damage: p.damage, damageType: 'normal', moabBonus: 0, camo: true });
  }
  h.pending = h.pending.filter(p => !resolved.has(p));
  h.buffs = h.buffs.filter(b => b.rest > s.tick);
  for (const z of h.zones) {
    if (s.tick < z.next || z.until <= s.tick || z.remaining <= 0) continue;
    const a = z.ability;
    const targets = s.bloons.filter(b => Math.hypot(s.posOf(b).x - z.point.x, s.posOf(b).y - z.point.y) <= (z.id === 'mine' ? 30 : a.radius) + 7);
    if (z.id === 'wall') {
      for (const b of targets) if (!['white', 'zebra', 'lead', 'ddt', 'bad', ...(l < 12 ? ['bfb', 'zomg'] : [])].includes(b.type)) {
        const cost = b.type === 'zomg' ? 30 : b.type === 'bfb' ? 15 : b.type === 'moab' ? l >= 12 ? 5 : 30 : 1;
        if (cost > z.remaining) continue;
        hit(s, h, b, { damage: l >= 18 ? 15 : l >= 16 ? 10 : l >= 12 ? 5 : 1, damageType: 'normal', freezeDuration: 3, freezeLayers: 10, moabStun: 1.5, knockback: true }); z.remaining -= cost;
      }
    } else if (z.id === 'fragment') {
      const p = { x: z.point.x + Math.cos(s.tick / 30) * a.radius, y: z.point.y + Math.sin(s.tick / 30) * a.radius };
      const nearby = s.bloons.filter(b => Math.hypot(s.posOf(b).x - p.x, s.posOf(b).y - p.y) <= 15);
      for (const b of nearby.slice(0, z.remaining)) {
        hit(s, h, b, { damage: 1 + ((b.frozenUntil ?? 0) > s.tick ? l >= 19 ? 8 : l >= 16 ? 6 : l >= 9 ? 3 : 1 : 0), damageType: 'cold' }); z.remaining--;
      }
    } else if (z.id === 'mine') {
      if (targets.some(moab)) { blast(s, h, z.point, a.radius, { ...normal(a), stun: l === 20 ? 10 : 5, moabStun: l === 20 ? 10 : 5 }); z.remaining = 0; }
    } else if (z.id === 'trees') {
      for (const b of targets) if (BLOONS[b.type].rbe <= z.remaining && b.type !== 'bad') { z.remaining -= BLOONS[b.type].rbe; s.payoutWhole(b, 2); s.heroDestroy(b, false); }
    } else if (z.id === 'kinetic') {
      const b = s.bloons.find(moab); if (b) { h.pending.push({ at: s.tick + 600, bloon: b, damage: a.damage, destroy: false, kind: 'kinetic', initialHP: b.hp }); z.remaining = 0; }
    } else {
      const damage = z.id === 'leap' ? l === 20 ? 6 : l >= 15 ? 4 : l >= 12 ? 3 : 2 : a.damage;
      blast(s, h, z.point, a.radius, { ...normal(a), damage, pierce: Math.min(z.remaining, a.pierce), damageType: z.id === 'brambles' && l < 16 ? 'sharp' : 'normal' });
      if (z.id === 'brambles') z.remaining -= targets.length;
    }
    z.next = s.tick + a.interval * 60;
  }
  h.zones = h.zones.filter(z => z.until > s.tick && z.remaining > 0 && s.round - z.round < (z.id === 'brambles' ? 6 : z.id === 'mine' ? 4 : z.id === 'kinetic' ? 2 : 99));
  for (const a of heroAbilities(h.kind, l)) {
    if (!active(s, h, a.id) || s.tick < (h.next[a.id] ?? 0)) continue;
    h.next[a.id] = s.tick + a.interval * 60;
    if (a.id === 'arrows') {
      for (const b of s.bloons) if (Math.hypot(s.posOf(b).x - h.point.x, s.posOf(b).y - h.point.y) <= 107 && s.rng() < (l >= 18 ? 0.075 : 0.05) * 3) hit(s, h, b, { ...normal(a), moabBonus: 6, ceramicBonus: l >= 18 ? 18 : 0 });
    }
    if (a.id === 'ball' || a.id === 'ucav' || a.id === 'scatter') blast(s, h, a.id === 'scatter' ? h.point : h, a.radius, { ...normal(a), damageType: a.id === 'ball' && l < 20 ? 'plasma' : a.id === 'scatter' ? 'explosion' : 'normal', fortifiedBonus: a.id === 'ball' ? a.damage : 0, stun: a.id === 'scatter' ? 1 : 0 });
    if (a.id === 'barrage') for (const b of heroTargets(s, h, 2000).filter(moab).slice(0, 10)) hit(s, h, b, normal(a));
    if (a.id === 'psychic') blast(s, h, h, a.radius, { ...normal(a), stun: 6, moabStun: 1.5 });
    if (a.id === 'hex') {
      const b = heroTargets(s, h, 2000).find(b => moab(b) && (b.type !== 'bad' || l === 20));
      if (b) { b.noChildren = true; hit(s, h, b, { ...normal(a), damage: (b.fortified ? BLOONS[b.type].fortifiedHp : BLOONS[b.type].hp) * (l === 20 ? 0.05 : 0.04) + 1 }); }
    }
  }
  if (h.kind === 'etienne' && l === 20 && !active(s, h, 'ucav') && s.tick % 12 === 0) blast(s, h, h, 2000, { damage: 2, pierce: 25, damageType: 'explosion', camo: true });
  if (h.kind === 'corvus') h.mana = Math.min(800, h.mana + (l >= 8 && h.mana < 200 ? 0.12 : 0.06));
  if (s.tick >= h.secondary) {
    h.secondary = s.tick + (h.kind === 'churchill' ? 6 : h.kind === 'brickell' ? (l >= 11 ? 150 : l >= 2 ? 168 : 180) / (active(s, h, 'chain') ? 2 : 1) : 60);
    const b = heroTargets(s, h)[0];
    if (b && h.kind === 'churchill' && l >= 5) hit(s, h, b, { damage: l >= 18 ? 10 : l >= 14 ? 8 : l >= 12 ? 6 : l >= 7 ? 4 : 2, damageType: 'sharp', pierce: 1, moabBonus: 0 });
    if (b && h.kind === 'brickell') blast(s, h, s.posOf(b), l >= 15 ? 30 : 20, { damage: l >= 17 ? 22 : l >= 12 ? 12 : l >= 9 ? 8 : l >= 6 ? 2 : 1, pierce: 20, strip: l >= 15, damageType: l >= 15 ? 'normal' : 'explosion' });
    if (b && h.kind === 'rosalia' && l >= 2) {
      const p = s.posOf(b), enhanced = h.shots > 0 && h.shots % 10 === 0;
      for (let n = 0; n < (enhanced ? l >= 15 ? 5 : 3 : 1); n++) blast(s, h, p, 15, { damage: l >= 8 ? 3 : 2, pierce: 10, ceramicBonus: l >= 15 ? 6 : 1, damageType: 'explosion' });
      // uncertain: cluster damage is absent; retain the main grenade's base damage.
      if (l >= 13) for (let n = 0; n < (l >= 19 ? 5 : 3); n++) blast(s, h, { x: p.x + Math.cos(n * 2) * 15, y: p.y + Math.sin(n * 2) * 15 }, 10, { damage: 3, pierce: 10, ceramicBonus: l >= 15 ? 4 : 0, damageType: 'explosion' });
    }
  }
  if (h.kind === 'obyn' && l >= 4 && s.tick >= h.passive) {
    h.passive = s.tick + (l >= 15 ? 720 : 1080);
    for (const b of heroTargets(s, h, 75)) if (b.type !== 'bad') { b.slow = moab(b) ? l >= 15 ? 0.7 : l >= 8 ? 0.8 : 0.85 : l >= 15 ? 0.4 : l >= 8 ? 0.6 : 0.7; b.slowUntil = s.tick + 900; }
  }
  h.cd -= 1 / 60; if (h.cd > 0) return;
  let stats = { ...h.stats };
  if (active(s, h, 'vision')) stats.camo = true;
  if (active(s, h, 'haste')) stats.cooldown *= l >= 8 ? 0.4 : 0.6;
  if (active(s, h, 'echo')) stats.projectiles *= 2;
  if (active(s, h, 'aggression')) stats.damage *= 2;
  if (active(s, h, 'ancestral')) stats.damage *= l === 20 ? 8 : l >= 13 ? 6 : 4;
  if (active(s, h, 'malevolence')) { stats.damage += l >= 14 ? 10 : 5; stats.ceramicBonus += 10; }
  if (active(s, h, 'spear')) { stats.damage += l >= 18 ? 8 : l >= 12 ? 5 : 2; stats.pierce += 10; }
  if (active(s, h, 'ember')) { stats.burnDamage = l >= 15 ? 8 : 3; stats.burnDuration = 3; stats.burnInterval = 0.5; }
  if (active(s, h, 'frostbound')) { stats.freezeDuration = l >= 11 ? 5 : 2; stats.moabStun = l >= 9 ? 1 : 0; }
  if (active(s, h, 'repel')) { stats.knockback = true; if (l >= 12) stats.moabStun = 0.1; }
  if (active(s, h, 'storm')) { stats.pierce += l >= 18 ? 40 : 20; stats.projectiles += 4; }
  if (active(s, h, 'trample')) { stats.damage += l >= 19 ? 20 : l >= 10 ? 10 : 5; stats.pierce += 20; }
  if (h.kind === 'corvus' && l >= 11) stats.damage += Math.floor(h.mana / 100);
  if (active(s, h, 'rapid')) stats.cooldown /= l >= 15 ? 4 : 3;
  if (active(s, h, 'light')) { stats.range *= 2; stats.pierce *= 2; stats.damageType = 'normal'; if (l >= 16) stats.damage *= 2; }
  if (active(s, h, 'armor')) { stats.damageType = 'normal'; stats.damage += l >= 17 ? 6 : l >= 13 ? 3 : 1; stats.ceramicBonus += l >= 17 ? 33 : l >= 13 ? 21 : 3; stats.moabBonus += stats.ceramicBonus; stats.projectiles += 2; }
  if (active(s, h, 'sacrifice')) { stats.range *= 1 + h.next.sacrifice; stats.cooldown *= 1 - h.next.sacrifice; }
  if (active(s, h, 'drones')) stats.projectiles += 4;
  if (active(s, h, 'naval')) stats.cooldown *= l >= 16 ? 0.5 : 0.66;
  if (active(s, h, 'frostbite')) { stats.damageType = 'normal'; stats.damage += (l === 20 ? 50 : l >= 15 ? 25 : l >= 9 ? 15 : 10) * Math.ceil((h.until.frostbite - s.tick) / 60); }
  if (active(s, h, 'roar')) stats.damage += l >= 14 ? 3 : 1;
  if (h.kind === 'dan' && h.transformed) { stats.damage *= 2; stats.pierce += 5; stats.cooldown = l >= 18 ? 0.35 : l >= 13 ? 0.5 : l >= 9 ? 0.75 : 1; }
  if (h.kind === 'dan' && active(s, h, 'rouser') && h.transformed) { stats.damage = 30; stats.pierce = 18; stats.cooldown = 0.1; stats.range = 2000; }
  if (h.kind === 'rosalia' && active(s, h, 'flight')) stats.range = 2000;
  if (h.kind === 'rosalia' && l >= 4) stats.cooldown /= 1 + Math.min(l >= 17 ? 0.6 : l >= 11 ? 0.4 : 0.25, heroTargets(s, h).length / 200);
  if (h.kind === 'dan' && l === 20 && s.bloons.length) { const progress = Math.max(...s.bloons.map(b => b.dist / s.pathLen)); stats.cooldown /= 1 + progress; stats.damage += Math.floor(s.bloons.reduce((n, b) => n + BLOONS[b.type].rbe, 0) / 100); }
  const targets = heroTargets(s, { ...h, stats });
  if (h.kind === 'psi') {
    const available = targets.filter(b => eligiblePsi(h, b) && !h.pending.some(p => p.bloon === b));
    for (const b of available.slice(0, stats.projectiles)) {
      b.stunnedUntil = s.tick + 1e7;
      // uncertain: vibration rates before level 2 are absent; use 0.2 seconds per layer.
      const delay = l >= 16 ? b.hp / 4 * 0.075 : l >= 14 ? b.hp / 4 * 0.1 : Math.min(BLOONS[b.type].rbe, 100) * (l >= 13 ? 0.1 : l >= 2 ? 0.15 : 0.2);
      h.pending.push({ at: s.tick + Math.ceil((stats.cooldown + delay) * 60), bloon: b, damage: 0, destroy: true });
    }
    if (l >= 4) for (const b of available.slice(0, stats.projectiles)) {
      const nearby = available.filter(other => other !== b && !moab(other) && !h.pending.some(p => p.bloon === other) && Math.abs(other.dist - b.dist) <= (l >= 18 ? 15 : 6)).slice(0, l >= 18 ? 5 : l >= 13 ? 3 : l >= 6 ? 2 : 1);
      for (const other of nearby) { other.stunnedUntil = s.tick + 1e7; h.pending.push({ at: s.tick + 60, bloon: other, damage: 0, destroy: true }); }
    }
    if (available.length) h.cd = stats.cooldown;
    return;
  }
  if (h.kind === 'benjamin') {
    h.cd = l >= 16 ? 3.5 : 6;
    if (l >= 7) { const b = targets.find(b => !moab(b) || ['moab', ...(l >= 18 ? ['bfb', 'ddt'] : [])].includes(b.type)); if (b) { b.noChildren = true; b.trojan = true; } }
    return;
  }
  if (h.kind === 'silas' && l >= 6) {
    // Advanced Intel is limited to Ice Monkey sight.
    for (const b of s.bloons) if (!targets.includes(b) && s.towers.some(t => t.type === 'ice' && Math.hypot(s.posOf(b).x - t.x, s.posOf(b).y - t.y) <= t.range)) targets.push(b);
  }
  if (!targets.length) return;
  h.cd = stats.cooldown; h.shots++;
  if (h.kind === 'gwen' && l >= 4 && h.shots % 40 === 0) { h.until.heat = s.tick + 480; blast(s, h, h, l >= 7 ? 46 : 38, { damage: l >= 18 ? 30 : l >= 15 ? 20 : l >= 12 ? 10 : 3, pierce: 100 }); }
  for (let n = 0; n < stats.projectiles; n++) {
    const b = targets[h.kind === 'etienne' ? n % targets.length : 0]; if (!s.bloons.includes(b)) continue;
    const attack = { ...stats };
    if (h.kind === 'sauda') {
      if ((b.stunnedUntil ?? 0) > s.tick || (b.frozenUntil ?? 0) > s.tick) attack.damage += moab(b) ? l >= 13 ? 21 : l >= 7 ? 20 : 0 : l >= 13 ? 3 : l >= 7 ? 2 : 0;
      if (l >= 11 && (b.glue || b.slow || b.burn)) attack.damage += moab(b) ? 10 : 2;
      if (l >= 19 && (b.camo || b.regrow || b.fortified)) attack.damage += moab(b) ? 10 : 2;
      if (l >= 9) { attack.burnDamage = 1; attack.burnMoab = 19; attack.burnInterval = 2; attack.burnDuration = 4; }
    }
    if (h.kind === 'silas') { attack.damage += (b.frozenUntil ?? 0) > s.tick ? l >= 18 ? 5 : 1 : 0; attack.freezeDuration = b.slow ? 3 : 0; b.slow = 0.85; b.slowUntil = s.tick + 180; }
    if (h.kind === 'pat' && l >= 5 && h.shots % 5 === 0 || h.kind === 'dan' && l >= 3 && h.shots % 4 === 0) attack.knockback = true;
    if (h.kind === 'corvus') { h.mana = Math.min(800, h.mana + 2); b.brittle = l >= 17 ? 2 : 1; b.brittleUntil = s.tick + 180; }
    if (attack.radius) blast(s, h, s.posOf(b), attack.radius, attack);
    else for (const other of targets.slice(0, attack.pierce)) hit(s, h, other, attack);
    if (h.kind === 'quincy' && l >= 7 && h.shots % (l >= 17 ? 2 : 3) === 0) blast(s, h, s.posOf(b), 25.7, { damage: 1, pierce: 10, damageType: 'explosion' });
    if (h.kind === 'dan' && !h.transformed && l >= 9 && (h.shots % 3 === 0 || l >= 18 && h.shots % 2 === 0)) {
      h.pending.push({ at: s.tick + 3, bloon: b, damage: attack.damage, destroy: false });
      if (l >= 13 && h.shots % 3 === 0) h.pending.push({ at: s.tick + 6, bloon: b, damage: attack.damage, destroy: false });
    }
    if (h.kind === 'dan' && h.transformed && h.shots % 3 === 0) blast(s, h, s.posOf(b), 60, { damage: l >= 6 ? 3 : l >= 4 ? 2 : 1, pierce: 15, damageType: 'energy' });
  }
}
export function cycleHeroTarget(s: Sim) {
  if (!s.hero || s.gameOver) return false;
  s.hero.targeting = TARGETING[(TARGETING.indexOf(s.hero.targeting) + 1) % TARGETING.length]; return true;
}

function createWall(s: Sim, h: Hero, point: Pt) {
  // uncertain: wall collision width is unspecified; use 12 units.
  h.zones.push({ id: 'wall', point, until: s.tick + (h.level >= 19 ? 30 : h.level >= 12 ? 20 : 15) * 60,
    round: s.round, next: s.tick, remaining: h.level >= 19 ? 60 : h.level >= 12 ? 30 : 15,
    ability: { id: 'wall', name: 'Ice Wall', level: 4, cooldown: 10, initial: 0, duration: 15, damage: 1, pierce: 15, radius: 12, interval: 0.1, count: 1 } });
}
export function heroTowerFired(s: Sim, t: Tower) {
  const h = s.hero; if (!h || h.kind !== 'silas' || h.level < 2 || t.type !== 'ice' || Math.hypot(t.x - h.x, t.y - h.y) > h.stats.range) return;
  const limit = h.level >= 17 && Math.max(...t.tiers) >= 3 ? 9 : h.level >= 14 && Math.max(...t.tiers) >= 2 ? 6 : 3;
  if (h.zones.filter(z => z.id === 'fragment' && z.point.x === t.x && z.point.y === t.y).length >= limit) return;
  h.zones.push({ id: 'fragment', point: { x: t.x, y: t.y }, until: s.tick + (h.level >= 17 ? 24 : h.level >= 14 ? 17 : 10) * 60,
    round: s.round, next: s.tick, remaining: h.level >= 16 ? 24 : h.level >= 9 ? 12 : 6,
    ability: { id: 'fragment', name: 'Ice Fragment', level: 2, cooldown: 0, initial: 0, duration: 10, damage: 1, pierce: 6, radius: t.range, interval: 1, count: 1 } });
}
export function heroLeak(s: Sim, b: Bloon, damage: number) {
  const h = s.hero; if (!h) return damage;
  for (const barrier of h.assets.filter(a => a.id === 'barrier' && a.next > s.tick)) { const blocked = Math.min(damage, barrier.hp); barrier.hp -= blocked; damage -= blocked; }
  if (h.kind === 'dan') {
    if (h.level >= 12 && s.tick >= (h.next.thinking ?? 0)) {
      h.next.thinking = s.tick + 3600;
      for (const other of [...s.bloons].sort((a, b) => b.dist - a.dist).slice(0, 40)) if (other.type !== 'bad') other.dist = Math.max(0, other.dist - 100);
      if (b.type !== 'bad') return -1;
      damage = Math.floor(damage / 2);
    }
    if (h.level >= 5 && !moab(b) && !['purple', 'lead'].includes(b.type) && s.tick >= (h.next.shield ?? 0)) {
      h.next.shield = s.tick + 720; damage = Math.floor(damage / 2);
      for (const other of s.bloons) if (other !== b && !moab(other) && other.dist > s.pathLen - 60) { other.dist -= 20; other.stunnedUntil = s.tick + 180; }
    }
    if (h.level >= 14) h.next.healLeft = Math.min(100, damage);
  }
  return damage;
}
