import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { memoryKV, slot } from './store';
import { SaveSync, type CloudStore, type CloudRow } from './cloud-sync';
import type { SaveCodec } from './save-codecs';

const key = 'test', envelope = (n: number) => JSON.stringify({ v: 1, data: { n } });
const codecs: Record<string, SaveCodec> = { test: { decode: (r: any) => r?.v === 1 && Number.isFinite(r?.data?.n) ? r : null, meaningful: (d: any) => d.n > 0 } };
const row = (n: number, at: number): CloudRow => ({ slot_key: key, version: 1, data: { n }, deleted: false, updated_at: new Date(at).toISOString() });
class FakeCloud implements CloudStore {
  rows = new Map<string, CloudRow>(); writes = 0; offline = false;
  async read(user: string) { if (this.offline) throw Error('offline'); return [...this.rows.entries()].filter(([k]) => k.startsWith(user + ':')).map(([, v]) => structuredClone(v)); }
  async write(user: string, r: CloudRow, expected: string | null) {
    if (this.offline) throw Error('offline');
    const k = user + ':' + r.slot_key;
    if ((this.rows.get(k)?.updated_at ?? null) !== expected) return false;
    this.rows.set(k, structuredClone(r)); this.writes++; return true;
  }
}
function setup() {
  const local = memoryKV(), remote = new FakeCloud();
  const sync = new SaveSync(local, remote, codecs);
  const save = slot(key, [], () => ({ n: 0 }), d => d, sync);
  return { local, remote, sync, save };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); });
afterEach(() => vi.useRealTimers());

it('keeps guest saves local and uploads existing progress on first sign-in', async () => {
  const { sync, save, remote, local } = setup(); save.save({ n: 5 });
  expect(JSON.parse(local.getItem(key)!)).toEqual({ v: 1, data: { n: 5 } });
  expect(remote.writes).toBe(0);
  await sync.connect('a');
  expect(remote.rows.get('a:test')?.data).toEqual({ n: 5 });
  expect(sync.status).toBe('saved');
});
it('debounces changes and immediately persists each local save', async () => {
  const { sync, save, remote } = setup(); await sync.connect('a');
  save.save({ n: 1 }); await vi.advanceTimersByTimeAsync(2000); save.save({ n: 2 });
  await vi.advanceTimersByTimeAsync(2999); expect(remote.writes).toBe(0);
  expect(save.load()).toEqual({ n: 2 });
  await vi.advanceTimersByTimeAsync(1); expect(remote.rows.get('a:test')?.data).toEqual({ n: 2 });
});
it('retries offline writes with backoff and preserves the queue across reload', async () => {
  const { sync, save, local, remote } = setup(); await sync.connect('a'); remote.offline = true;
  save.save({ n: 9 }); await sync.flush(); expect(sync.status).toBe('offline');
  sync.dispose(); const reloaded = new SaveSync(local, remote, codecs);
  await reloaded.connect('a'); remote.offline = false;
  await vi.advanceTimersByTimeAsync(1000);
  expect(remote.rows.get('a:test')?.data).toEqual({ n: 9 }); expect(reloaded.status).toBe('saved');
});
it('uses newer timestamps when one side has no meaningful progress', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 0 }); remote.rows.set('a:test', row(7, 200_000));
  await sync.connect('a'); expect(save.load()).toEqual({ n: 7 }); expect(sync.conflicts).toHaveLength(0);
});
it.each([50_000, 100_000, 200_000])('asks before overwriting two meaningful saves (cloud timestamp %i)', async at => {
  const { sync, save, remote } = setup(); save.save({ n: 3 }); remote.rows.set('a:test', row(7, at));
  await sync.connect('a'); expect(sync.status).toBe('conflict'); expect(remote.writes).toBe(0);
  expect(save.load()).toEqual({ n: 3 });
  await sync.resolve(key, 'cloud'); expect(save.load()).toEqual({ n: 7 });
});
it('keeps device progress when chosen explicitly', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 }); remote.rows.set('a:test', row(7, 200_000));
  await sync.connect('a'); await sync.resolve(key, 'device');
  expect(remote.rows.get('a:test')?.data).toEqual({ n: 3 }); expect(sync.status).toBe('saved');
});
it('does not ask on every normal autosave after synchronization', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 }); await sync.connect('a');
  save.save({ n: 4 }); await sync.flush();
  expect(sync.conflicts).toHaveLength(0); expect(remote.rows.get('a:test')?.data).toEqual({ n: 4 });
});
it('rejects malformed remote data and leaves local and remote progress intact', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 });
  remote.rows.set('a:test', { ...row(7, 200_000), data: 'broken' }); await sync.connect('a');
  expect(save.load()).toEqual({ n: 3 }); expect(remote.writes).toBe(0); expect(sync.status).toBe('error');
});
it('syncs tombstones so cleared runs do not return on another device', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 }); await sync.connect('a'); save.clear(); await sync.flush();
  expect(remote.rows.get('a:test')?.deleted).toBe(true);
  const second = new SaveSync(memoryKV(), remote, codecs); await second.connect('a');
  expect(second.getItem(key)).toBeNull();
});
it('restores guest progress on sign-out and isolates different accounts', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 }); await sync.connect('a');
  save.save({ n: 9 }); await sync.flush(); await sync.connect(null);
  expect(save.load()).toEqual({ n: 3 });
  await sync.connect('a'); expect(save.load()).toEqual({ n: 9 });
  await sync.connect('b'); expect(save.load()).toEqual({ n: 0 }); expect(remote.rows.has('b:test')).toBe(false);
  await sync.connect('a'); expect(save.load()).toEqual({ n: 9 });
});
it('does not acknowledge an older in-flight write over a newer local edit', async () => {
  const { sync, save, remote } = setup(); await sync.connect('a'); save.save({ n: 1 });
  const write = remote.write.bind(remote); let release!: () => void;
  remote.write = async (...args) => { await new Promise<void>(r => { release = r; }); return write(...args); };
  const pending = sync.flush(); await vi.advanceTimersByTimeAsync(0); save.save({ n: 2 }); release(); await pending;
  remote.write = write; await sync.flush();
  expect(remote.rows.get('a:test')?.data).toEqual({ n: 2 });
});
it('reconciles a concurrent cloud change after a conditional upsert loses a race', async () => {
  const { sync, save, remote } = setup(); await sync.connect('a'); save.save({ n: 3 });
  const write = remote.write.bind(remote); let raced = false;
  remote.write = async (...args) => { if (!raced) { raced = true; remote.rows.set('a:test', row(8, 200_000)); } return write(...args); };
  await sync.flush(); await sync.flush();
  expect(sync.status).toBe('conflict'); expect(remote.rows.get('a:test')?.data).toEqual({ n: 8 });
});
it('ignores stale hydration after signing out during a read', async () => {
  const { sync, save, remote } = setup(); save.save({ n: 3 });
  let release!: (rows: CloudRow[]) => void;
  remote.read = () => new Promise(r => { release = r; });
  const pending = sync.connect('a'); await sync.connect(null); release([row(9, 200_000)]); await pending;
  expect(save.load()).toEqual({ n: 3 }); expect(sync.status).toBe('guest');
});
it('reports a failed local write instead of continuing to claim the save succeeded', async () => {
  const kv = memoryKV(); let blocked = false;
  const local = { ...kv, setItem(k: string, v: string) { if (blocked) throw Error('quota'); kv.setItem(k, v); } };
  const sync = new SaveSync(local, new FakeCloud(), codecs), save = slot(key, [], () => ({ n: 0 }), d => d, sync);
  await sync.connect('a'); blocked = true;
  expect(save.save({ n: 3 })).toBe(false); expect(sync.status).toBe('error');
});
