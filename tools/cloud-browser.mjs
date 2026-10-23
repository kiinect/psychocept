// Playwright is installed outside the game repo; pass its module URL via PLAYWRIGHT_MODULE.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const screenshots = process.env.SCREENSHOT_DIR ?? '/tmp/btd6-cloud-browser';
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
function watch(page) { page.setDefaultTimeout(15_000); page.on('pageerror', e => errors.push(e.message)); }
const guest = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await guest.newPage(); watch(page);
await page.goto(process.env.GUEST_URL ?? 'http://127.0.0.1:5196');
await page.getByRole('button', { name: 'Tap to start', exact: true }).click();
await page.locator('#account-open').click();
assert.match(await page.locator('#account-intro').textContent(), /aren’t connected/);
assert.equal(await page.locator('#account-form').isVisible(), false);
await page.screenshot({ path: `${screenshots}/guest-account.png` });
await page.keyboard.press('Escape');
assert.equal(await page.locator('#account-dialog').isVisible(), false);
assert.equal(await page.evaluate(() => document.activeElement?.id), 'account-open');
await guest.close();
console.log('PASS guest fallback and modal focus');

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'player@players.psychocept.org', aud: 'authenticated', role: 'authenticated', created_at: '2026-10-23T00:00:00Z' };
let remote = [{ slot_key: 'mpt.profile', version: 2, data: { xp: 900, rank: 2, mm: 500 }, deleted: false, updated_at: '2026-10-23T00:00:00.000Z' }];
let writes = 0, offline = false, signup = 0;
await context.addInitScript(() => {
  // Fixture data only: no real sessions or credentials are accessed by this test.
  localStorage.setItem('mpt.profile', JSON.stringify({ v: 2, data: { xp: 5, rank: 1, mm: 10 } }));
});
const respond = async route => {
  const url = new URL(route.request().url()), request = route.request();
  const headers = { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
  if (offline) { await route.abort('internetdisconnected'); return; }
  let body;
  if (url.pathname.endsWith('/signup') || url.pathname.endsWith('/token')) {
    assert.equal(request.postDataJSON().email, user.email, 'canonical username is used for both auth actions');
    const duplicate = url.pathname.endsWith('/signup') && ++signup > 1;
    const wrongPassword = request.postDataJSON().password !== 'fake-test-password';
    if (duplicate || wrongPassword) {
      await route.fulfill({ status: 422, headers, body: JSON.stringify({ code: duplicate ? 'user_already_exists' : 'invalid_credentials', msg: 'Test auth error' }) }); return;
    }
    const jwt = [btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' })), 'testsignature'].join('.');
    body = { access_token: jwt, token_type: 'bearer', refresh_token: 'test-refresh', expires_in: 3600, user };
  } else if (url.pathname.endsWith('/logout')) body = {};
  else if (url.pathname.endsWith('/saves')) body = remote;
  else if (url.pathname.endsWith('/put_save')) {
    const input = request.postDataJSON(), old = remote.find(r => r.slot_key === input.p_slot_key);
    if ((old?.updated_at ?? null) !== input.p_expected_at) body = false;
    else {
      remote = remote.filter(r => r.slot_key !== input.p_slot_key);
      remote.push({ slot_key: input.p_slot_key, data: input.p_data, version: input.p_version, deleted: input.p_deleted, updated_at: input.p_updated_at }); writes++; body = true;
    }
  } else throw Error(`Unexpected fake request: ${url.pathname}`);
  await route.fulfill({ status: 200, headers, body: JSON.stringify(body) });
};
await context.route('https://cloud-test.supabase.co/**', respond);
const cloud = await context.newPage(); watch(cloud);
await cloud.goto(process.env.CLOUD_URL ?? 'http://127.0.0.1:5197');
await cloud.getByRole('button', { name: 'Tap to start', exact: true }).click(); await cloud.locator('#account-open').click();
await cloud.locator('#account-signup-mode').click();
await cloud.getByLabel('Username', { exact: true }).fill('PLAYER');
assert.equal(await cloud.getByText('No email needed.', { exact: false }).isVisible(), true);
await cloud.screenshot({ path: `${screenshots}/username-signup.png` });
await cloud.getByLabel('Password', { exact: true }).fill('fake-test-password');
await cloud.locator('#account-submit').click();
await cloud.getByRole('button', { name: 'Keep cloud', exact: true }).waitFor();
assert.equal(signup, 1);
assert.equal(await cloud.locator('#account-identity').textContent(), 'player');
assert.equal(await cloud.getByLabel('Password', { exact: true }).inputValue(), '');
assert.equal(remote.find(r => r.slot_key === 'mpt.profile')?.data.xp, 900, 'conflicting profile must remain untouched');
await cloud.screenshot({ path: `${screenshots}/save-conflict.png` });
await cloud.getByRole('button', { name: 'Keep cloud', exact: true }).click();
console.log('Cloud conflict choice submitted');
await cloud.waitForFunction(() => document.querySelector('#account-save-state')?.textContent === 'Cloud saved');
console.log('PASS cloud conflict and hydration');
await cloud.locator('#account-guest').click();
assert.equal(await cloud.locator('.rank-badge').textContent(), '2');
assert.match(await cloud.locator('.mm-pill').textContent(), /500/);
// A real settings interaction must write locally before the remote debounce fires.
await cloud.locator('.menu-row [data-action="settings"]').click();
const reduced = cloud.locator('#reduce-motion'); await reduced.check();
assert.equal(await cloud.evaluate(() => JSON.parse(localStorage.getItem('mpt.settings')).data.reducedMotion), true);
await cloud.waitForFunction(() => document.querySelector('#cloud-status')?.textContent === 'Cloud saved');
console.log('PASS settings autosave');
assert.equal(remote.find(r => r.slot_key === 'mpt.settings')?.data.reducedMotion, true);
// Exercise offline retry through the actual SDK and production UI.
offline = true; await reduced.uncheck();
await cloud.waitForFunction(() => document.querySelector('#cloud-status')?.textContent.includes('Offline'));
console.log('Offline state reached');
offline = false;
await cloud.waitForFunction(() => document.querySelector('#cloud-status')?.textContent === 'Cloud saved');
console.log('PASS offline retry');
assert.equal(remote.find(r => r.slot_key === 'mpt.settings')?.data.reducedMotion, false);
await cloud.locator('[data-action="back"]').click();
await cloud.locator('#account-open').click();
for (const width of [320, 768, 1024, 1440]) {
  await cloud.setViewportSize({ width, height: 900 });
  const box = await cloud.locator('#account-dialog').boundingBox();
  assert(box && box.x >= 0 && box.x + box.width <= width + 1, `dialog fits ${width}`);
  assert.equal(await cloud.locator('#account-dialog').evaluate(d => d.scrollWidth <= d.clientWidth), true);
  await cloud.screenshot({ path: `${screenshots}/account-${width}.png` });
}
await cloud.setViewportSize({ width: 1440, height: 900 });
await cloud.locator('#account-signout').click();
console.log('Signout submitted');
await cloud.waitForFunction(() => document.querySelector('#account-message')?.textContent.startsWith('Signed out'));
// A differently cased username must restore the same account after sign-out.
await cloud.getByLabel('Username', { exact: true }).fill('Player');
await cloud.getByLabel('Password', { exact: true }).fill('fake-test-password');
await cloud.locator('#account-submit').click();
await cloud.waitForFunction(() => document.querySelector('#account-message')?.textContent.includes('already taken')).catch(async error => {
  console.log({ signupRequests: signup, message: await cloud.locator('#account-message').textContent() }); throw error;
});
await cloud.locator('#account-signin-mode').click();
await cloud.getByLabel('Password', { exact: true }).fill('wrong-password'); await cloud.locator('#account-submit').click();
await cloud.waitForFunction(() => document.querySelector('#account-message')?.textContent === 'Username or password is incorrect.');
await cloud.getByLabel('Password', { exact: true }).fill('fake-test-password'); await cloud.locator('#account-submit').click();
await cloud.waitForFunction(() => document.querySelector('#account-message')?.textContent.startsWith('Signed in'));
assert.equal(await cloud.locator('#account-identity').textContent(), 'player');
await cloud.locator('#account-signout').click();
await cloud.waitForFunction(() => document.querySelector('#account-message')?.textContent.startsWith('Signed out'));
await cloud.locator('#account-guest').click();
assert.equal(await cloud.locator('.rank-badge').textContent(), '1');
assert.equal(await cloud.locator('.mm-pill').textContent(), '10');
// A clean device must hydrate older cloud preferences without creating local
// audio edits or showing a conflict with untouched defaults.
remote = remote.filter(r => r.slot_key !== 'mpt.settings');
remote.push({ slot_key: 'mpt.settings', version: 1, data: { volume: 0.8, music: 0.5, fastForward: false, autoplay: false, showRange: true, reducedMotion: true }, deleted: false, updated_at: new Date(Date.now() - 10000).toISOString() });
const fresh = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await fresh.route('https://cloud-test.supabase.co/**', respond);
const otherDevice = await fresh.newPage(); watch(otherDevice);
await otherDevice.goto(process.env.CLOUD_URL ?? 'http://127.0.0.1:5197');
await otherDevice.getByRole('button', { name: 'Tap to start', exact: true }).click(); await otherDevice.locator('#account-open').click();
await otherDevice.getByLabel('Username', { exact: true }).fill('Player'); await otherDevice.getByLabel('Password', { exact: true }).fill('fake-test-password'); await otherDevice.locator('#account-submit').click();
await otherDevice.waitForFunction(() => document.querySelector('#account-message')?.textContent.startsWith('Signed in'));
assert.equal(await otherDevice.evaluate(() => JSON.parse(localStorage.getItem('mpt.settings') ?? 'null')?.data.reducedMotion), true);
assert.equal(await otherDevice.locator('#account-conflicts').textContent(), '');
assert.equal(remote.find(r => r.slot_key === 'mpt.settings').data.reducedMotion, true);
await fresh.close();
console.log('PASS fresh browser restores cloud preferences without false conflicts or overwrites');
// Direct game links are an existing supported entry point. Keep this check focused on saves.
await cloud.goto((process.env.CLOUD_URL ?? 'http://127.0.0.1:5197') + '/?map=monkey_meadow&mode=easy');
await cloud.setViewportSize({ width: 960, height: 600 });
await cloud.locator('#speed').click(); await cloud.locator('#speed').click();
await cloud.locator('#start').click();
await cloud.screenshot({ path: `${screenshots}/guest-round.png` });
console.log('Guest round started');
await cloud.waitForFunction(() => {
  const run = JSON.parse(localStorage.getItem('mpt.run') ?? 'null'), ui = JSON.parse(localStorage.getItem('mpt.run.ui') ?? 'null');
  return run?.data.round >= 1 && ui?.data.savedAt === run.data.savedAt;
}, null, { timeout: 60_000 }).catch(async e => {
  await cloud.screenshot({ path: `${screenshots}/round-failure.png` });
  console.log(await cloud.evaluate(() => ({ hud: document.querySelector('#hud')?.textContent, lives: document.querySelector('#lives')?.textContent, run: localStorage.getItem('mpt.run'), ui: localStorage.getItem('mpt.run.ui') })));
  throw e;
});
await cloud.locator('#settings').click(); await cloud.locator('[data-action="back"]').click();
await cloud.locator('[data-action="home"]').click();
await cloud.locator('[data-action="loadRun"]').waitFor();
assert.equal(errors.length, 0, errors.join('\n'));
console.log(JSON.stringify({ result: 'PASS', checks: ['guest fallback', 'immediate username signup', 'duplicate username', 'wrong password', 'case-insensitive sign-in', 'conflict selection', 'cloud hydration', 'fresh browser preferences', 'settings autosave', 'offline retry', 'responsive dialog 320/768/1024/1440', 'sign-out isolation', 'guest round autosave and Continue', 'modal Escape/focus'], writes, pageErrors: errors }, null, 2));
await browser.close();
