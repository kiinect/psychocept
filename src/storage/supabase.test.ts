import { expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseStore, configuredClient } from './supabase';

it('stays disabled without public configuration and rejects privileged keys', () => {
  expect(configuredClient({})).toBeNull();
  expect(configuredClient({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_secret_do-not-use' })).toBeNull();
});
it('sends owner-scoped reads and conditional writes through the actual SDK', async () => {
  const requests: { url: string; body: any }[] = [];
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = String(input); requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(JSON.stringify(url.includes('/rpc/') ? true : []), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const store = new SupabaseStore(client); await store.read('owner');
  const r = { slot_key: 'mpt.profile', version: 2, data: { xp: 10 }, deleted: false, updated_at: '2026-10-23T00:00:00.000Z' };
  expect(await store.write('owner', r, null)).toBe(true);
  expect(requests[0].url).toContain('user_id=eq.owner');
  expect(requests[1].body).toMatchObject({ p_user_id: 'owner', p_slot_key: 'mpt.profile', p_expected_at: null, p_data: { xp: 10 } });
});
it('propagates a database rejection so the queue can retry', async () => {
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false }, global: { fetch: async () => new Response(JSON.stringify({ message: 'denied' }), { status: 403 }) },
  });
  await expect(new SupabaseStore(client).read('owner')).rejects.toBeDefined();
});
