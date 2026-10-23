import { grantXp, recordGame, xpForRound, type Profile } from '../meta';
import { Sim, type Difficulty } from '../sim';

export interface RewardInput {
  map: string; difficulty: Difficulty; mapDifficulty: number; won: boolean;
  startRound: number; completedRound: number; hero?: string; pops?: number; recorded?: boolean;
}
export function gameRewards(profile: Profile, o: RewardInput) {
  let xp = 0;
  for (let r = o.startRound; r <= o.completedRound; r++) xp += xpForRound(r, { mapDifficulty: o.mapDifficulty, hero: o.hero });
  const recorded = o.recorded ? { profile } : recordGame(profile, { ...o, round: o.completedRound });
  const granted = grantXp(recorded.profile, xp);
  return { profile: granted.profile, xp, mm: granted.profile.mm - profile.mm, levelUps: granted.levelUps };
}
export type Rewards = ReturnType<typeof gameRewards>;
export function powerButtonState(owned: number, implemented: boolean, blocked: boolean) {
  return { disabled: owned < 1 || !implemented || blocked, reason: !implemented ? 'Not implemented' : blocked ? 'Unavailable' : owned < 1 ? 'None owned' : '' };
}
/** Probe the public API on an empty fixture, so placement requirements do not look like missing effects. */
export function supportedPowers(ids: readonly string[]): Set<string> {
  const probe = new Sim([{ x: 0, y: 300 }, { x: 960, y: 300 }], 'medium', [{ x: 450, y: 30, width: 200, height: 200 }]);
  return new Set(ids.filter(id => [undefined, { x: 100, y: 300 }, { x: 100, y: 100 }, { x: 550, y: 100 }].some(p => probe.canUsePower(id, p))));
}
