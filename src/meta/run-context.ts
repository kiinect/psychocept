import { slot, type KV } from '../storage/store';
import { HEROES, type HeroKind } from '../heroes';
import { MODES } from '../modes/modes';

export interface RunContext { mode: string; hero: HeroKind; savedAt: number; rewardedRound: number; recorded: boolean }
export function validRunContext(r: any): r is RunContext {
  return !!r && MODES.some(m => m.id === r.mode) && !!HEROES[r.hero as HeroKind]
    && Number.isFinite(r.savedAt) && r.savedAt >= 0 && Number.isInteger(r.rewardedRound) && r.rewardedRound >= 0 && typeof r.recorded === 'boolean';
}
export const contextSlot = (kv?: KV) => slot<RunContext | null>('mpt.run.ui', [], () => null, r => validRunContext(r) ? r : null, kv);
