import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CloudStore, CloudRow } from './cloud-sync';

export function configuredClient(env: Record<string, string | undefined>): SupabaseClient | null {
  const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || key.startsWith('sb_secret_')) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null;
    if (key.split('.').length === 3) {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') return null;
    }
    // Static hosting has no server for HttpOnly sessions. Keep credentials in memory;
    // never persist auth tokens alongside game saves. Refresh requires signing in again.
    return createClient(url, key, { auth: { persistSession: false, detectSessionInUrl: true } });
  } catch { return null; }
}
export class SupabaseStore implements CloudStore {
  constructor(private client: SupabaseClient | null) {}
  async read(user: string): Promise<CloudRow[]> {
    if (!this.client) throw Error('Cloud saves are not configured');
    const { data, error } = await this.client.from('saves').select('slot_key,data,version,deleted,updated_at').eq('user_id', user).abortSignal(AbortSignal.timeout(10_000));
    if (error) throw error;
    return data ?? [];
  }
  async write(user: string, row: CloudRow, expected: string | null): Promise<boolean> {
    if (!this.client) throw Error('Cloud saves are not configured');
    const { data, error } = await this.client.rpc('put_save', {
      p_user_id: user, p_slot_key: row.slot_key, p_data: row.data, p_version: row.version,
      p_deleted: row.deleted, p_updated_at: row.updated_at, p_expected_at: expected,
    }).abortSignal(AbortSignal.timeout(10_000));
    if (error) throw error;
    return data === true;
  }
}
