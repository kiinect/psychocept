export interface Settings { sfx: number; music: number; muted: boolean }
export const SETTINGS_KEY = 'monkey-pop-audio-v1';
export function readSettings(raw: string | null): Settings {
  let value: Partial<Settings> = {};
  try { const parsed: unknown = JSON.parse(raw ?? '{}'); if (parsed && typeof parsed === 'object') value = parsed; } catch { /* Use defaults for corrupt storage. */ }
  const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  return { sfx: volume(value.sfx, 0.65), music: volume(value.music, 0.25), muted: value.muted === true };
}
