/** Versioned JSON slot over localStorage. Never throws; falls back to an in-memory map if storage is blocked. */
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const mem = new Map<string, string>();
const memKV: KV = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k) };
export function defaultKV(): KV {
  try { const s = (globalThis as any).localStorage as KV | undefined; if (s) { s.getItem('__probe'); return s; } } catch { /* blocked */ }
  return memKV;
}

export interface Slot<T> {
  load(): T; save(v: T): boolean; clear(): void;
}
/**
 * @param migrations migrations[n] upgrades a version-n payload to n+1; current version = migrations.length + 1.
 * @param validate normalises the final payload (fill defaults, drop junk); corrupt data yields fresh().
 */
export function slot<T>(key: string, migrations: ((old: any) => any)[], fresh: () => T, validate: (raw: any) => T, kv: KV = defaultKV()): Slot<T> {
  const cur = migrations.length + 1;
  return {
    load() {
      try {
        const s = kv.getItem(key); if (!s) return fresh();
        const env = JSON.parse(s); let v = Number(env?.v), data = env?.data;
        if (!Number.isInteger(v) || v < 1 || v > cur) return fresh();
        for (; v < cur; v++) data = migrations[v - 1](data);
        return validate(data);
      } catch { return fresh(); }
    },
    save(val) { try { kv.setItem(key, JSON.stringify({ v: cur, data: val })); return true; } catch { return false; } },
    clear() { try { kv.removeItem(key); } catch { /* ignore */ } },
  };
}
export const memoryKV = (): KV => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: k => void m.delete(k) }; };
