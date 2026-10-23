import { profileSlot, settingsSlot, runSlot, defaultSettings, restoreSim, type Profile } from '../meta/profile';
import { contextSlot, validRunContext } from '../meta/run-context';
import { MAPS } from '../maps/maps';
import { createGame, MODES } from '../modes/modes';
import { memoryKV, type Slot } from './store';

export interface Envelope { v: number; data: unknown }
export interface SaveCodec { decode(raw: unknown): Envelope | null; meaningful(data: unknown): boolean }
const object = (r: any) => !!r && typeof r === 'object' && !Array.isArray(r);
const nonnegative = (n: any) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
function codec<T>(s: Slot<T>, valid: (raw: any) => boolean, meaningful: (data: T) => boolean): SaveCodec {
  return { decode(raw: any) {
    try { return object(raw) && valid(raw.data) ? s.decode(raw) : null; } catch { return null; }
  }, meaningful: data => meaningful(data as T) };
}
function validProfile(p: any) {
  return object(p) && nonnegative(p.xp) && nonnegative(p.mm ?? p.money)
    && (p.rank === undefined || nonnegative(p.rank))
    && (p.powers === undefined || object(p.powers) && Object.values(p.powers).every(nonnegative))
    && ['wins', 'achievements', 'mk'].every(k => p[k] === undefined || Array.isArray(p[k]) && p[k].every((s: any) => typeof s === 'string'))
    && (p.stats === undefined || object(p.stats) && Object.values(p.stats).every(nonnegative));
}
function validSettings(s: any) {
  return object(s) && Object.keys(defaultSettings()).every(k => s[k] === undefined ||
    (k === 'volume' || k === 'music' ? nonnegative(s[k]) && s[k] <= 1 : typeof s[k] === 'boolean'));
}
function validRun(r: any) {
  if (r === null) return true;
  if (!object(r) || !MAPS[r.map] || !['easy', 'medium', 'hard', 'impoppable'].includes(r.difficulty)
    || !['round', 'cash', 'lives', 'savedAt'].every(k => nonnegative(r[k])) || !Array.isArray(r.towers)) return false;
  if (!r.towers.every((t: any) => object(t) && typeof t.type === 'string' && Number.isFinite(t.x) && Number.isFinite(t.y)
    && Array.isArray(t.tiers) && t.tiers.length === 3 && t.tiers.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 5))) return false;
  const mode = r.mode ?? r.difficulty;
  return MODES.some(m => m.id === mode) && restoreSim(createGame(r.map, mode), r);
}
const profileMeaningful = (p: Profile) => p.xp > 0 || p.mm > 0 || p.wins.length > 0 || p.mk.length > 0
  || p.achievements.length > 0 || Object.values(p.powers).some(n => n > 0) || Object.values(p.stats).some(n => n > 0);
export const saveCodecs: Record<string, SaveCodec> = {
  'mpt.profile': codec(profileSlot(memoryKV()), validProfile, profileMeaningful),
  'mpt.settings': codec(settingsSlot(memoryKV()), validSettings, s => JSON.stringify(s) !== JSON.stringify(defaultSettings())),
  'mpt.run': codec(runSlot(memoryKV()), validRun, r => r !== null),
  'mpt.run.ui': codec(contextSlot(memoryKV()), r => r === null || validRunContext(r), r => r !== null),
};
