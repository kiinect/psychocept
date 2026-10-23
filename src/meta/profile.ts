import { slot, defaultKV, type KV, type Slot } from '../storage/store';
import { addXp, levelUpMM, winMM } from './xp';
import { buyPower } from './powers';
import type { Sim, Difficulty, Targeting, PowerUnit } from '../sim';
import { heroStats, HEROES, type HeroKind } from '../heroes';
import type { TowerKind } from '../towers';

// ---------- Profile ----------
export interface Profile {
  xp: number; rank: number; mm: number;
  powers: Record<string, number>;          // owned power counts by id
  wins: string[];                          // "map:difficulty" keys already completed (first-win bonus)
  stats: { gamesPlayed: number; gamesWon: number; bestRound: number; pops: number };
  achievements: string[];
}
const num = (x: any, d = 0) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d);
export const freshProfile = (): Profile => ({ xp: 0, rank: 1, mm: 0, powers: {}, wins: [], stats: { gamesPlayed: 0, gamesWon: 0, bestRound: 0, pops: 0 }, achievements: [] });
function validateProfile(r: any): Profile {
  const f = freshProfile(), p = r && typeof r === 'object' ? r : {};
  const powers: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.powers ?? {})) if (num(v) > 0) powers[k] = Math.floor(num(v));
  const s = p.stats ?? {};
  return { xp: Math.floor(num(p.xp)), rank: Math.max(1, Math.floor(num(p.rank, 1))), mm: Math.floor(num(p.mm)), powers,
    wins: Array.isArray(p.wins) ? p.wins.filter((x: any) => typeof x === 'string') : [],
    stats: { gamesPlayed: num(s.gamesPlayed), gamesWon: num(s.gamesWon), bestRound: num(s.bestRound), pops: num(s.pops) },
    achievements: Array.isArray(p.achievements) ? p.achievements.filter((x: any) => typeof x === 'string') : f.achievements };
}
// v1 -> v2 example: v1 stored `money` instead of `mm`.
export const PROFILE_MIGRATIONS = [(o: any) => (o && 'money' in o && !('mm' in o) ? { ...o, mm: o.money } : o)];
export const profileSlot = (kv?: KV): Slot<Profile> => slot('mpt.profile', PROFILE_MIGRATIONS, freshProfile, validateProfile, kv ?? defaultKV());

/** Pure: add XP to profile, pay level-up MM. */
export function grantXp(p: Profile, xp: number): { profile: Profile; levelUps: number[] } {
  const r = addXp(p.xp, xp);
  return { profile: { ...p, xp: r.xp, rank: r.rank, mm: p.mm + r.levelUps.reduce((a, l) => a + levelUpMM(l), 0) }, levelUps: r.levelUps };
}
/** Pure: record a finished game. Awards win MM (3x on first win of map+difficulty). */
export function recordGame(p: Profile, o: { map: string; difficulty: Difficulty; mapDifficulty?: number; won: boolean; round: number; pops?: number }): { profile: Profile; mmGained: number } {
  const key = `${o.map}:${o.difficulty}`, first = o.won && !p.wins.includes(key);
  const mmGained = o.won ? winMM(o.difficulty, o.mapDifficulty ?? 0, first) : 0;
  return { mmGained, profile: { ...p, mm: p.mm + mmGained, wins: first ? [...p.wins, key] : p.wins,
    stats: { gamesPlayed: p.stats.gamesPlayed + 1, gamesWon: p.stats.gamesWon + (o.won ? 1 : 0), bestRound: Math.max(p.stats.bestRound, o.round), pops: p.stats.pops + (o.pops ?? 0) } } };
}
/** Pure: buy `count` of a power with MM. Returns the same profile if unaffordable. */
export function purchasePower(p: Profile, id: string, count = 1): Profile {
  const mm = buyPower(p.mm, id, count); if (mm === undefined) return p;
  return { ...p, mm, powers: { ...p.powers, [id]: (p.powers[id] ?? 0) + count } };
}
/** Pure: consume one owned power. */
export function usePower(p: Profile, id: string): Profile | undefined {
  const n = p.powers[id] ?? 0; if (n < 1) return undefined;
  return { ...p, powers: { ...p.powers, [id]: n - 1 } };
}

// ---------- Settings ----------
export interface Settings { volume: number; music: number; fastForward: boolean; autoplay: boolean; showRange: boolean; reducedMotion: boolean }
export const defaultSettings = (): Settings => ({ volume: 0.8, music: 0.5, fastForward: false, autoplay: false, showRange: true, reducedMotion: false });
const unit = (x: any, d: number) => (typeof x === 'number' && x >= 0 && x <= 1 ? x : d);
const bool = (x: any, d: boolean) => (typeof x === 'boolean' ? x : d);
function validateSettings(r: any): Settings {
  const d = defaultSettings(), s = r && typeof r === 'object' ? r : {};
  return { volume: unit(s.volume, d.volume), music: unit(s.music, d.music), fastForward: bool(s.fastForward, d.fastForward), autoplay: bool(s.autoplay, d.autoplay), showRange: bool(s.showRange, d.showRange), reducedMotion: bool(s.reducedMotion, d.reducedMotion) };
}
export const settingsSlot = (kv?: KV): Slot<Settings> => slot('mpt.settings', [], defaultSettings, validateSettings, kv ?? defaultKV());
/** Fast-forward multiplier on sim steps per frame (3x per wiki). */
export const speedMultiplier = (s: Settings) => (s.fastForward ? 3 : 1);

// ---------- Mid-game save ----------
export interface RunSnapshot {
  map: string; difficulty: Difficulty; round: number; cash: number; lives: number;
  /** Mode id: rebuild the Sim with createGame(map, mode) before restoreSim. */
  mode?: string;
  towers: { type: TowerKind; x: number; y: number; tiers: [number, number, number]; targeting: Targeting; degree?: number; cost?: number; bank?: number }[];
  hero?: { kind: HeroKind; x: number; y: number; level: number; xp: number };
  /** untilRound null = permanent (JSON has no Infinity). */
  powerUnits?: (Omit<PowerUnit, 'untilRound'> & { untilRound: number | null })[];
  savedAt: number;
}
/** Capture a between-rounds snapshot from a Sim (public fields only). Mid-round state (bloons, projectiles) is not saved. */
export function snapshotSim(sim: Sim, map: string, now = 0): RunSnapshot {
  const h = sim.hero;
  return { map, mode: sim.modeId, difficulty: sim.difficulty, round: sim.round, cash: sim.cash, lives: sim.lives, savedAt: now,
    towers: sim.towers.filter(t => !t.mergedInto).map(t => ({ type: t.type, x: t.x, y: t.y, tiers: [...t.tiers] as [number, number, number], targeting: t.targeting,
      degree: t.degree, cost: t.cost, bank: t.bank })),
    hero: h ? { kind: h.kind, x: h.x, y: h.y, level: h.level, xp: h.xp } : undefined,
    powerUnits: sim.powerUnits.map(u => ({ ...u, untilRound: Number.isFinite(u.untilRound) ? u.untilRound : null })) };
}
/** Rebuild towers/cash/lives/round into a fresh Sim (built with the same map path + difficulty). Returns false on failure. */
export function restoreSim(sim: Sim, snap: RunSnapshot): boolean {
  if (sim.difficulty !== snap.difficulty) return false;
  sim.cash = 1e12;
  for (const t of snap.towers) {
    if (!sim.addTower(t.x, t.y, t.type)) return false;
    const tw = sim.towers[sim.towers.length - 1];
    for (let path = 0; path < 3; path++) for (let n = 0; n < t.tiers[path]; n++) if (!sim.upgrade(sim.towers.length - 1, path)) return false;
    if (t.degree) sim.paragonize(tw, t.degree);
    tw.targeting = t.targeting; if (t.cost !== undefined) tw.cost = t.cost; if (t.bank) tw.bank = t.bank;
  }
  const h = snap.hero;
  if (h) {
    if (!sim.placeHero(h.x, h.y, h.kind)) return false;
    Object.assign(sim.hero!, { level: h.level, xp: h.xp, stats: heroStats(h.kind, h.level) });
  }
  sim.powerUnits = (snap.powerUnits ?? []).map(u => ({ ...u, untilRound: u.untilRound ?? Infinity }));
  sim.cash = snap.cash; sim.lives = snap.lives; sim.round = snap.round; return true;
}
function validateRun(r: any): RunSnapshot | null {
  if (!r || typeof r !== 'object' || typeof r.map !== 'string' || !Array.isArray(r.towers)) return null;
  if (!['easy', 'medium', 'hard', 'impoppable'].includes(r.difficulty)) return null;
  const h = r.hero, units = Array.isArray(r.powerUnits) ? r.powerUnits : [];
  return { map: r.map, mode: typeof r.mode === 'string' ? r.mode : undefined, difficulty: r.difficulty,
    hero: h && HEROES[h.kind as HeroKind] && Number.isFinite(h.x) && Number.isFinite(h.y) ? { kind: h.kind, x: h.x, y: h.y, level: Math.max(1, Math.min(20, Math.floor(num(h.level, 1)))), xp: num(h.xp) } : undefined,
    powerUnits: units.filter((u: any) => u && typeof u.id === 'string' && Number.isFinite(u.x) && Number.isFinite(u.y))
      .map((u: any) => ({ id: u.id, x: u.x, y: u.y, r: num(u.r, 8), range: num(u.range), untilRound: Number.isFinite(u.untilRound) ? u.untilRound : null })), round: Math.floor(num(r.round)), cash: Math.floor(num(r.cash)), lives: Math.floor(num(r.lives, 1)), savedAt: num(r.savedAt),
    towers: r.towers.filter((t: any) => t && typeof t.type === 'string' && Number.isFinite(t.x) && Number.isFinite(t.y) && Array.isArray(t.tiers)).map((t: any) => ({ type: t.type, x: t.x, y: t.y, tiers: [0, 1, 2].map(i => Math.floor(num(t.tiers[i]))) as [number, number, number], targeting: t.targeting ?? 'First',
      degree: Number.isFinite(t.degree) ? Math.max(1, Math.min(100, Math.floor(t.degree))) : undefined, cost: Number.isFinite(t.cost) ? t.cost : undefined, bank: Number.isFinite(t.bank) ? t.bank : undefined })) };
}
export const runSlot = (kv?: KV): Slot<RunSnapshot | null> => slot('mpt.run', [], () => null, validateRun, kv ?? defaultKV());
