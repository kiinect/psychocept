import { expect, it } from 'vitest';
import { Accounts, type AccountAuth, type AccountUser } from './accounts';

class FakeAuth implements AccountAuth {
  user: AccountUser | null = null; confirm = true; fail = false;
  listener = (_u: AccountUser | null) => {};
  async current() { return this.user; }
  subscribe(fn: (u: AccountUser | null) => void) { this.listener = fn; return () => {}; }
  async signIn() { if (this.fail) throw { code: 'invalid_credentials' }; return this.user = { id: 'a', email: 'player@players.psychocept.org' }; }
  async signUp() { return this.confirm ? null : this.signIn(); }
  async signOut() { this.user = null; }
}
it('reports a server configuration problem if username signup returns no session', async () => {
  const auth = new FakeAuth(), connected: (string | null)[] = [];
  const accounts = new Accounts(auth, async u => { connected.push(u); }, () => true);
  await accounts.start(); await accounts.submit('signup', 'player', 'password');
  expect(accounts.user).toBeNull(); expect(accounts.message).toContain('Account creation is unavailable'); expect(accounts.message).not.toContain('Check your email'); expect(connected).not.toContain('a');
});
it('connects on sign-in and restores guest state on sign-out', async () => {
  const auth = new FakeAuth(), connected: (string | null)[] = [];
  const accounts = new Accounts(auth, async u => { connected.push(u); }, () => true);
  await accounts.start(); await accounts.submit('signin', 'player', 'password');
  expect(accounts.user?.id).toBe('a'); expect(connected.at(-1)).toBe('a');
  await accounts.signOut(); expect(accounts.user).toBeNull(); expect(connected.at(-1)).toBeNull();
});
it('defers restored sessions until the menu and ignores duplicate auth events', async () => {
  const auth = new FakeAuth(); auth.user = { id: 'a' }; let menu = false;
  const connected: (string | null)[] = [];
  const accounts = new Accounts(auth, async u => { connected.push(u); }, () => menu);
  await accounts.start(); expect(connected).toHaveLength(0);
  menu = true; await accounts.resume(); auth.listener(auth.user); await accounts.resume();
  expect(connected).toEqual(['a']);
});
it('shows a useful generic auth error without exposing service internals', async () => {
  const auth = new FakeAuth(); auth.fail = true;
  const accounts = new Accounts(auth, async () => {}, () => true);
  await accounts.submit('signin', 'player', 'bad');
  expect(accounts.message).toBe('Username or password is incorrect.'); expect(accounts.busy).toBe(false);
});
it('connects a newly created username account immediately without email confirmation', async () => {
  const auth = new FakeAuth(); auth.confirm = false;
  const connected: (string | null)[] = [];
  const accounts = new Accounts(auth, async u => { connected.push(u); }, () => true);
  await accounts.submit('signup', 'player', 'password');
  expect(accounts.user?.id).toBe('a'); expect(connected).toEqual(['a']);
  expect(accounts.message).toContain('Signed in.');
});
it('reports a taken username without leaking service errors', async () => {
  const auth = new FakeAuth(); auth.signUp = async () => { throw { code: 'user_already_exists', message: 'private database information' }; };
  const accounts = new Accounts(auth, async () => {}, () => true);
  await accounts.submit('signup', 'player', 'password');
  expect(accounts.user).toBeNull(); expect(accounts.message).toBe('That username is already taken. Sign in or choose another.');
});
