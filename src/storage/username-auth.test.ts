import { expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAuth, accountName } from './accounts';

function fixture() {
  const requests: { path: string; body: any }[] = [];
  const user = { id: 'player-id', email: 'monkey_42@players.psychocept.org', aud: 'authenticated' };
  const token = [btoa('{"alg":"HS256"}'), btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })), 'test'].join('.');
  const client = createClient('https://example.supabase.co', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      requests.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ user, access_token: token, refresh_token: 'test', expires_in: 3600, token_type: 'bearer' }), { headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { auth: new SupabaseAuth(client), requests };
}

it('uses the same canonical username identity for signup and sign-in', async () => {
  const { auth, requests } = fixture();
  expect((await auth.signUp('  Monkey_42  ', 'test-password'))?.id).toBe('player-id');
  expect((await auth.signIn('MONKEY_42', 'test-password'))?.id).toBe('player-id');
  expect(requests.map(r => r.path)).toEqual(['/auth/v1/signup', '/auth/v1/token']);
  expect(requests.map(r => r.body.email)).toEqual(['monkey_42@players.psychocept.org', 'monkey_42@players.psychocept.org']);
  expect(requests[0].body).not.toHaveProperty('emailRedirectTo');
});

it.each(['ab', 'a'.repeat(25), 'player@example.com', 'monkey name', 'monkéy', 'Kaden', '<script>'])('rejects invalid username %s before contacting Auth', async username => {
  const { auth, requests } = fixture();
  await expect(auth.signUp(username, 'test-password')).rejects.toMatchObject({ code: 'invalid_username' });
  await expect(auth.signIn(username, 'test-password')).rejects.toMatchObject({ code: 'invalid_username' });
  expect(requests).toHaveLength(0);
});

it('rejects short signup passwords without changing a valid sign-in password', async () => {
  const { auth, requests } = fixture();
  await expect(auth.signUp('monkey_42', 'short')).rejects.toMatchObject({ code: 'weak_password' });
  expect(requests).toHaveLength(0);
  await auth.signIn('monkey_42', ' unchanged ');
  expect(requests[0].body.password).toBe(' unchanged ');
});

it('shows the canonical username without exposing the internal auth address', () => {
  expect(accountName({ id: 'a', email: 'monkey_42@players.psychocept.org' })).toBe('monkey_42');
  expect(accountName({ id: 'a', email: 'legacy@example.com' })).toBe('Player');
  expect(accountName({ id: 'a' })).toBe('Player');
});
