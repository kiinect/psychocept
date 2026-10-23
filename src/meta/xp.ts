import metaJson from '../../data/wiki/meta.json';

const X = metaJson.data.xp;
/** [rank, totalXpAtRank, xpToNext] rows from the wiki table. uncertain: max rank not confirmed. */
export const RANK_TABLE = X.rank_table.rows as number[][];
export const MAX_RANK = RANK_TABLE[RANK_TABLE.length - 1][0];

/** Hero XP multipliers, keyed by lowercase hero name (wiki table). */
export const HERO_XP_MULT: Record<string, number> = {};
for (const [mult, names] of Object.entries(X.hero_xp_multiplier)) for (const n of names as string[]) HERO_XP_MULT[n.toLowerCase()] = Number(mult);
export const heroXpMultiplier = (hero: string) => HERO_XP_MULT[hero.toLowerCase()] ?? 1;

/** Base XP awarded for finishing round r. uncertain: formula is wiki prose. */
export function roundXp(r: number): number {
  if (r < 1) return 0;
  if (r <= 20) return 40 + 20 * (r - 1);
  if (r <= 50) return 460 + 40 * (r - 21);
  return 1710 + 90 * (r - 51);
}

/** Map difficulty index: 0 Beginner, 1 Intermediate, 2 Advanced, 3 Expert; +10% per step. */
export const mapDifficultyBonus = (idx: number) => 1 + 0.1 * Math.max(0, Math.min(3, idx));

export interface XpOpts { mapDifficulty?: number; freeplay?: boolean; hero?: string }
/** XP for completing round r (before splitting among towers). Freeplay: 30%, 10% past round 100 (heroes exempt). */
export function xpForRound(r: number, o: XpOpts = {}): number {
  let x = roundXp(r) * mapDifficultyBonus(o.mapDifficulty ?? 0);
  if (o.freeplay && !o.hero) x *= r > 100 ? 0.1 : 0.3;
  if (o.hero) x *= heroXpMultiplier(o.hero);
  return Math.floor(x);
}

/** Split round XP across towers proportional to cash spent. Per-tower floor values in input order. */
export function splitTowerXp(xp: number, spent: number[]): number[] {
  const total = spent.reduce((a, b) => a + b, 0);
  return spent.map(s => (total ? Math.floor(xp * s / total) : 0));
}

/** Rank for a lifetime XP total, capped at MAX_RANK. */
export function rankForXp(xp: number): number {
  let lo = 0, hi = RANK_TABLE.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (RANK_TABLE[mid][1] <= xp) lo = mid; else hi = mid - 1; }
  return RANK_TABLE[lo][0];
}

export interface RankProgress { rank: number; into: number; need: number }
export function rankProgress(xp: number): RankProgress {
  const rank = rankForXp(xp), row = RANK_TABLE[rank - 1];
  return { rank, into: xp - row[1], need: row[2] };
}

/** Add XP; returns new total plus every rank gained (for level-up popups). */
export function addXp(total: number, gained: number): { xp: number; rank: number; levelUps: number[] } {
  const before = rankForXp(total), xp = total + Math.max(0, Math.floor(gained)), rank = rankForXp(xp);
  const levelUps: number[] = []; for (let r = before + 1; r <= rank; r++) levelUps.push(r);
  return { xp, rank, levelUps };
}

/** Monkey Money for a level-up. uncertain: wiki gives no formula; original estimate. */
export const levelUpMM = (rank: number) => (rank % 10 === 0 ? 100 : rank % 5 === 0 ? 50 : 25);

/** Monkey Money for winning a map. uncertain: wiki gives no formula; original estimate. */
export function winMM(difficulty: 'easy' | 'medium' | 'hard' | 'impoppable', mapDifficulty = 0, firstTime = false): number {
  const base = { easy: 20, medium: 30, hard: 40, impoppable: 60 }[difficulty] + 10 * mapDifficulty;
  return base * (firstTime ? 3 : 1);
}

/** Sell value: 70% of total spend, floored (BTD6 rule from meta.json). */
export const sellValue = (spent: number, rate = metaJson.data.sell.sellback_rate_btd6) => Math.floor(spent * Math.round(rate * 100) / 100 + 1e-9);
