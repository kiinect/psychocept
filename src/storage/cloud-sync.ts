import type { KV } from './store';
import type { SaveCodec } from './save-codecs';

export interface CloudRow { slot_key: string; version: number; data: unknown; deleted: boolean; updated_at: string }
export interface CloudStore {
  read(user: string): Promise<CloudRow[]>;
  /** Atomic compare-and-upsert. False means another device changed the row. */
  write(user: string, row: CloudRow, expected: string | null): Promise<boolean>;
}
interface RecordValue { raw: string | null; at: number; base?: string | null; remoteAt?: string }
interface Cache { owner: string; spaces: Record<string, Record<string, RecordValue>> }
export interface SaveConflict { key: string; deviceAt: number; cloudAt: number; device: string | null; cloud: string | null; remoteAt: string }
export type SaveStatus = 'guest' | 'saving' | 'saved' | 'offline' | 'conflict' | 'error';
const CACHE_KEY = 'mpt.sync.v1';
/** jsonb may reorder object keys; object order must not create a false conflict. */
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

/** Synchronous local KV with a durable, account-scoped cloud mirror. No gameplay awaits it. */
export class SaveSync implements KV {
  status: SaveStatus = 'guest';
  conflicts: SaveConflict[] = [];
  onChange = () => {};
  onApply = (_keys: string[]) => {};
  private cache: Cache = { owner: 'guest', spaces: { guest: {} } };
  private user: string | null = null;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private busy?: Promise<void>;
  private retry = 1000;
  private disposed = false;
  private storageFailed = false;
  private invalid = new Set<string>();
  constructor(private local: KV, private cloud: CloudStore, private codecs: Record<string, SaveCodec>, private delay = 3000) {
    try {
      const saved = JSON.parse(local.getItem(CACHE_KEY) ?? 'null');
      if (saved && typeof saved.owner === 'string' && saved.spaces && Object.hasOwn(saved.spaces, saved.owner)) {
        for (const records of Object.values(saved.spaces) as any[]) {
          if (!records || typeof records !== 'object') throw Error('cache');
          for (const [key, r] of Object.entries(records) as [string, any][]) {
            if (!Object.hasOwn(codecs, key) || !r || !Number.isFinite(r.at) || r.at < 0
              || r.raw !== null && typeof r.raw !== 'string'
              || r.base !== undefined && r.base !== null && typeof r.base !== 'string') throw Error('cache');
          }
        }
        this.cache = saved;
      }
    } catch { /* Legacy/corrupt metadata: original local slots remain authoritative. */ }
    // Recover writes that reached localStorage before a metadata/quota failure or tab close.
    for (const key of Object.keys(codecs)) {
      const raw = local.getItem(key), record = this.records[key];
      if (!record && raw !== null) this.records[key] = { raw: this.normalize(key, raw), at: 0 };
      else if (record && this.normalize(key, raw) !== record.raw) this.records[key] = { ...record, raw: this.normalize(key, raw), at: Date.now() };
    }
  }
  private get records() { return this.cache.spaces[this.cache.owner]; }
  private normalize(key: string, raw: string | null): string | null {
    if (raw === null) return null;
    try { const env = this.codecs[key].decode(JSON.parse(raw)); return env ? canonical(env) : raw; } catch { return raw; }
  }
  getItem(key: string) { return this.local.getItem(key); }
  setItem(key: string, value: string) {
    this.local.setItem(key, value); // Local-first, including when offline or signed out.
    if (Object.hasOwn(this.codecs, key)) this.changed(key, this.normalize(key, value));
  }
  removeItem(key: string) {
    this.local.removeItem(key);
    if (Object.hasOwn(this.codecs, key)) this.changed(key, null);
  }
  private changed(key: string, raw: string | null) {
    const old = this.records[key];
    if (old?.raw === raw) return;
    this.records[key] = { ...old, raw, at: Math.max(Date.now(), (old?.at ?? 0) + 1) };
    this.conflicts = this.conflicts.filter(c => c.key !== key);
    this.persist(); this.setStatus(this.user ? 'saving' : 'guest'); this.schedule(this.delay);
  }
  private persist() {
    try { this.local.setItem(CACHE_KEY, JSON.stringify(this.cache)); this.storageFailed = false; }
    catch { this.storageFailed = true; }
  }
  private setStatus(status: SaveStatus) {
    this.status = this.storageFailed ? 'error' : status;
    this.onChange();
  }
  private schedule(ms: number) {
    clearTimeout(this.timer);
    if (this.user && !this.disposed) this.timer = setTimeout(() => { void this.flush(); }, ms);
  }
  async connect(user: string | null) {
    if (user === this.user && (user === null && this.cache.owner === 'guest' || user !== null)) return;
    this.generation++; this.user = user; clearTimeout(this.timer); this.conflicts = []; this.invalid.clear(); this.retry = 1000;
    const owner = user ?? 'guest';
    if (owner !== this.cache.owner) {
      if (!Object.hasOwn(this.cache.spaces, owner)) {
        // Only guest progress may seed a new account. Other accounts have private caches.
        this.cache.spaces[owner] = user && this.cache.owner === 'guest'
          ? Object.fromEntries(Object.entries(this.records).map(([k, r]) => [k, { raw: r.raw, at: r.at }])) : {};
      }
      const previous = this.cache.owner;
      try {
        for (const key of Object.keys(this.codecs)) {
          const raw = this.cache.spaces[owner][key]?.raw;
          if (raw === undefined || raw === null) this.local.removeItem(key); else this.local.setItem(key, raw);
        }
      } catch {
        // Do not upload data if the visible workspace could not be switched safely.
        this.user = null; this.cache.owner = previous; this.storageFailed = true; this.setStatus('error'); return;
      }
      this.cache.owner = owner; this.persist(); this.onApply(Object.keys(this.codecs));
    }
    this.setStatus(user ? 'saving' : 'guest');
    if (user) await this.flush();
  }
  private meaningful(key: string, r: RecordValue) {
    if (r.raw === null) return r.at > 0; // An intentional clear must not be undone silently.
    try { return this.codecs[key].meaningful(JSON.parse(r.raw).data); } catch { return true; }
  }
  private apply(key: string, r: RecordValue) {
    const changed = this.normalize(key, this.local.getItem(key)) !== r.raw;
    if (r.raw === null) this.local.removeItem(key); else this.local.setItem(key, r.raw);
    this.records[key] = r; this.persist(); if (changed) this.onApply([key]);
  }
  async resolve(key: string, choice: 'device' | 'cloud') {
    const c = this.conflicts.find(c => c.key === key); if (!c || !this.user) return;
    if (this.records[key]?.raw !== c.device) { await this.flush(); return; }
    if (choice === 'cloud') this.apply(key, { raw: c.cloud, at: c.cloudAt, base: c.cloud, remoteAt: c.remoteAt });
    else this.records[key] = { ...this.records[key], base: c.cloud, remoteAt: c.remoteAt, at: Math.max(Date.now(), c.cloudAt + 1, this.records[key].at) };
    this.conflicts = this.conflicts.filter(c => c.key !== key); this.persist(); await this.flush();
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (!this.user || this.disposed) return Promise.resolve();
    if (this.busy) return this.busy;
    const generation = this.generation, user = this.user;
    const current = () => generation === this.generation && !this.disposed;
    const task = this.synchronize(user, current).catch(() => {
      if (current()) { this.setStatus('offline'); this.schedule(this.retry); this.retry = Math.min(this.retry * 2, 30_000); }
    });
    this.busy = task;
    void task.finally(() => {
      this.busy = undefined;
      if (!current() && this.user && !this.disposed) this.schedule(0);
    });
    return task;
  }
  private async synchronize(user: string, current: () => boolean) {
    const rows = await this.cloud.read(user); if (!current()) return;
    this.invalid.clear();
    const remote = new Map<string, { raw: string | null; at: number; stamp: string }>();
    for (const row of rows) {
      const key = row.slot_key; if (!Object.hasOwn(this.codecs, key)) continue;
      const at = Date.parse(row.updated_at);
      const env = row.deleted ? null : this.codecs[key].decode({ v: row.version, data: row.data });
      if (!Number.isFinite(at) || at < 0 || typeof row.deleted !== 'boolean' || !row.deleted && !env || row.deleted && row.data !== null) {
        this.invalid.add(key); continue;
      }
      remote.set(key, { raw: env ? canonical(env) : null, at, stamp: row.updated_at });
    }
    this.conflicts = [];
    let pending = false;
    for (const key of Object.keys(this.codecs)) {
      if (!current()) return;
      if (this.invalid.has(key)) continue;
      const cloud = remote.get(key); let local = this.records[key];
      if (!local && !cloud) continue;
      if (cloud) {
        if (!local || local.raw === cloud.raw || local.base !== undefined && local.raw === local.base) {
          this.apply(key, { raw: cloud.raw, at: cloud.at, base: cloud.raw, remoteAt: cloud.stamp }); continue;
        }
        if (local.base !== cloud.raw) {
          if (this.meaningful(key, local) && this.meaningful(key, { raw: cloud.raw, at: cloud.at }) || local.at === cloud.at) {
            this.conflicts.push({ key, device: local.raw, deviceAt: local.at, cloud: cloud.raw, cloudAt: cloud.at, remoteAt: cloud.stamp }); continue;
          }
          if (cloud.at > local.at) { this.apply(key, { raw: cloud.raw, at: cloud.at, base: cloud.raw, remoteAt: cloud.stamp }); continue; }
        }
      }
      local = this.records[key];
      if (!local) continue;
      let env;
      try { env = local.raw === null ? null : this.codecs[key].decode(JSON.parse(local.raw)); } catch { env = null; }
      if (local.raw !== null && !env) { this.invalid.add(key); continue; }
      const stamp = new Date(Math.max(local.at, cloud?.at ? cloud.at + 1 : 0, 1)).toISOString();
      const raw = local.raw;
      const accepted = await this.cloud.write(user, { slot_key: key, version: env?.v ?? 1, data: env?.data ?? null, deleted: raw === null, updated_at: stamp }, cloud?.stamp ?? null);
      if (!current()) return;
      if (accepted) {
        // A later local edit remains dirty even if this older request succeeds.
        this.records[key] = { ...this.records[key], base: raw, remoteAt: stamp };
        pending ||= this.records[key].raw !== raw; this.persist();
      } else pending = true;
    }
    this.persist(); this.retry = 1000;
    this.setStatus(this.conflicts.length ? 'conflict' : this.invalid.size ? 'error' : pending ? 'saving' : 'saved');
    if (pending) this.schedule(this.delay);
  }
  dispose() { this.disposed = true; this.generation++; clearTimeout(this.timer); }
}
