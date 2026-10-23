import type { SupabaseClient } from '@supabase/supabase-js';
export interface AccountUser { id: string; email?: string }
export interface AccountAuth {
  current(): Promise<AccountUser | null>;
  subscribe(fn: (user: AccountUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AccountUser | null>;
  signUp(email: string, password: string): Promise<AccountUser | null>;
  signOut(): Promise<void>;
}
export class SupabaseAuth implements AccountAuth {
  constructor(private client: SupabaseClient) {}
  async current() { const { data, error } = await this.client.auth.getSession(); if (error) throw error; return data.session?.user ?? null; }
  subscribe(fn: (user: AccountUser | null) => void) {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // Defer all database work beyond the auth callback/SDK lock.
      const timer = setTimeout(() => { timers.delete(timer); fn(session?.user ?? null); }, 0); timers.add(timer);
    });
    return () => { data.subscription.unsubscribe(); timers.forEach(clearTimeout); };
  }
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error; return data.user;
  }
  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error; return data.session?.user ?? null;
  }
  async signOut() { const { error } = await this.client.auth.signOut({ scope: 'local' }); if (error) throw error; }
}
export class Accounts {
  user: AccountUser | null = null;
  busy = false;
  message = '';
  onChange = () => {};
  private connected: string | null | undefined;
  private revision = 0;
  private unsubscribe = () => {};
  constructor(readonly auth: AccountAuth | null, private connect: (user: string | null) => Promise<void>, private atMenu: () => boolean) {}
  get configured() { return this.auth !== null; }
  async start() {
    if (!this.auth) return;
    this.unsubscribe = this.auth.subscribe(user => { this.revision++; void this.accept(user); });
    const revision = this.revision;
    try { const user = await this.auth.current(); if (revision === this.revision) await this.accept(user); }
    catch { this.message = 'Could not restore your sign-in. You can keep playing as guest.'; this.onChange(); }
  }
  private async accept(user: AccountUser | null) { this.user = user; await this.resume(); this.onChange(); }
  async resume() {
    const id = this.user?.id ?? null;
    if (!this.atMenu() || this.connected === id) return;
    this.connected = id; await this.connect(id);
  }
  async submit(mode: 'signin' | 'signup', email: string, password: string) {
    if (!this.auth || this.busy) return;
    this.busy = true; this.message = ''; this.onChange();
    try {
      const user = await (mode === 'signup' ? this.auth.signUp(email, password) : this.auth.signIn(email, password));
      if (user) { await this.accept(user); this.message = 'Signed in. Your progress saves automatically.'; }
      else this.message = 'Check your email to confirm your account, then sign in. Your progress stays on this device.';
    } catch (error) { this.message = authMessage(error); }
    finally { this.busy = false; this.onChange(); }
  }
  async signOut() {
    if (!this.auth || this.busy) return;
    this.busy = true; this.message = ''; this.onChange();
    try { await this.auth.signOut(); await this.accept(null); this.message = 'Signed out. Guest progress is back on this device.'; }
    catch (error) { this.message = authMessage(error); }
    finally { this.busy = false; this.onChange(); }
  }
  dispose() { this.unsubscribe(); }
}
function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'invalid_credentials') return 'Email or password is incorrect.';
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.';
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') return 'Too many attempts. Please wait a moment and try again.';
  return 'Could not connect to your account. Please try again. Your local progress is safe.';
}
