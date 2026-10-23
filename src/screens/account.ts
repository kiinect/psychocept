import './account.css';
import { accountName, type Accounts } from '../storage/accounts';
import type { SaveSync, SaveStatus } from '../storage/cloud-sync';

const statusText: Record<SaveStatus, string> = {
  guest: 'Guest · saved on this device', saved: 'Cloud saved', saving: 'Saving…',
  offline: 'Offline · saved on this device', conflict: 'Choose which save to keep', error: 'Cloud save needs attention · device save kept',
};
const names: Record<string, string> = { 'mpt.profile': 'Player progress', 'mpt.settings': 'Settings', 'mpt.run': 'Saved game', 'mpt.run.ui': 'Saved game rewards and hero' };
const date = (at: number) => at > 0 ? new Date(at).toLocaleString() : 'Date unknown';
function summary(raw: string | null) {
  if (raw === null) return 'Cleared save';
  try {
    const d = JSON.parse(raw).data;
    if (d === null) return 'No saved game';
    if ('xp' in d) return `Rank ${d.rank} · ${d.xp.toLocaleString()} XP · ${d.mm.toLocaleString()} Monkey Money`;
    if ('map' in d) return `${String(d.map).replace(/_/g, ' ')} · round ${d.round}`;
    if ('hero' in d) return `${d.hero} · rewards through round ${d.rewardedRound}`;
    return 'Your sound, display, and game preferences';
  } catch { return 'Device save'; }
}
/** Native modal supplies keyboard focus containment and Escape handling. */
export function mountAccount(root: HTMLElement, accounts: Accounts, sync: SaveSync) {
  const indicator = document.createElement('output'); indicator.id = 'cloud-status'; indicator.className = 'cloud-status';
  indicator.setAttribute('role', 'status'); indicator.setAttribute('aria-live', 'polite'); root.append(indicator);
  const dialog = document.createElement('dialog'); dialog.id = 'account-dialog'; dialog.className = 'account-dialog';
  dialog.setAttribute('aria-labelledby', 'account-title');
  dialog.innerHTML = `<div class="account-head"><h2 id="account-title">Your account</h2><button type="button" id="account-close" aria-label="Close account">✕</button></div>
    <p id="account-intro">Keep your progress across devices. You can always play as guest.</p>
    <p id="account-identity"></p><p id="account-save-state" role="status"></p>
    <section id="account-entry"><div class="account-tabs" aria-label="Account action"><button type="button" id="account-signin-mode" aria-pressed="true">Sign in</button><button type="button" id="account-signup-mode" aria-pressed="false">Create account</button></div>
    <form id="account-form"><label for="account-username">Username</label><input id="account-username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" aria-describedby="account-username-help" required>
      <p id="account-username-help" class="account-note">3–24 letters, numbers or underscores. Capitalization doesn’t matter.</p>
      <label for="account-password">Password</label><input id="account-password" type="password" autocomplete="current-password" required>
      <button class="play" id="account-submit">Sign in</button></form>
      <p id="account-recovery-note" class="account-note" hidden>No email needed. Keep your username and password safe: there is no email password recovery.</p>
      <p class="account-note">For your privacy, sign-in lasts until you refresh or close this page. Progress stays saved.</p></section>
    <p id="account-message" role="status" aria-live="polite"></p>
    <section id="account-conflicts" aria-label="Save conflicts"></section>
    <div class="account-actions"><button type="button" id="account-signout">Sign out</button><button type="button" id="account-guest">Play as guest</button><button type="button" id="account-retry">Retry cloud save</button></div>`;
  root.append(dialog);
  const $ = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  let mode: 'signin' | 'signup' = 'signin', conflictSignature = '';
  let opener: Element | null = null;
  const close = () => dialog.close();
  $('account-close').onclick = close; $('account-guest').onclick = close;
  dialog.addEventListener('close', () => { $('account-password').setAttribute('value', ''); ($('account-password') as HTMLInputElement).value = ''; if (opener?.isConnected) (opener as HTMLElement).focus(); });
  function setMode(next: typeof mode) {
    mode = next; const signup = mode === 'signup';
    $('account-signin-mode').setAttribute('aria-pressed', String(!signup)); $('account-signup-mode').setAttribute('aria-pressed', String(signup));
    const password = $<HTMLInputElement>('account-password'); password.autocomplete = signup ? 'new-password' : 'current-password'; password.minLength = signup ? 8 : 1;
    $('account-recovery-note').hidden = !signup;
    update();
  }
  $('account-signin-mode').onclick = () => setMode('signin'); $('account-signup-mode').onclick = () => setMode('signup');
  $('account-form').onsubmit = e => {
    e.preventDefault(); const password = $<HTMLInputElement>('account-password');
    void accounts.submit(mode, $<HTMLInputElement>('account-username').value, password.value).then(() => { password.value = ''; });
  };
  $('account-signout').onclick = () => { void accounts.signOut(); };
  $('account-retry').onclick = () => { void sync.flush(); };
  function update() {
    const signedIn = !!accounts.user, text = statusText[sync.status];
    if (indicator.textContent !== text) indicator.textContent = text;
    indicator.dataset.state = sync.status;
    $('account-entry').hidden = signedIn || !accounts.configured;
    $('account-intro').textContent = !accounts.configured ? 'Cloud saves aren’t connected yet. Your progress still saves on this device.'
      : signedIn ? 'Progress saves automatically. Your guest progress stays separate on this device.' : 'Keep your progress across devices. You can always play as guest.';
    $('account-identity').textContent = accounts.user ? accountName(accounts.user) : '';
    $('account-save-state').textContent = text;
    $('account-message').textContent = accounts.message;
    $('account-signout').hidden = !signedIn;
    $('account-guest').textContent = signedIn ? 'Back to menu' : 'Play as guest';
    $('account-retry').hidden = !signedIn || !['offline', 'error'].includes(sync.status);
    for (const id of ['account-submit', 'account-signout', 'account-signin-mode', 'account-signup-mode']) $<HTMLButtonElement>(id).disabled = accounts.busy;
    $('account-submit').textContent = accounts.busy ? 'Connecting…' : mode === 'signup' ? 'Create account' : 'Sign in';
    const signature = JSON.stringify(sync.conflicts);
    if (signature !== conflictSignature) {
      conflictSignature = signature; const host = $('account-conflicts'); host.replaceChildren();
      for (const conflict of sync.conflicts) {
        const section = document.createElement('section'); section.className = 'save-conflict';
        const title = document.createElement('h3'); title.textContent = names[conflict.key] ?? 'Save'; section.append(title);
        const explanation = document.createElement('p'); explanation.textContent = 'Both saves have different progress. Choose the one you want to keep.'; section.append(explanation);
        for (const choice of ['device', 'cloud'] as const) {
          const description = document.createElement('p');
          description.textContent = `${choice === 'device' ? 'This device' : 'Cloud'}: ${summary(choice === 'device' ? conflict.device : conflict.cloud)} · ${date(choice === 'device' ? conflict.deviceAt : conflict.cloudAt)}`;
          const button = document.createElement('button'); button.type = 'button'; button.textContent = choice === 'device' ? 'Keep this device' : 'Keep cloud';
          button.onclick = () => { void sync.resolve(conflict.key, choice).then(update); };
          section.append(description, button);
        }
        host.append(section);
      }
    }
  }
  update();
  return { update, open() { opener = document.activeElement; update(); dialog.showModal(); dialog.querySelector<HTMLInputElement>('#account-entry:not([hidden]) input')?.focus(); } };
}
