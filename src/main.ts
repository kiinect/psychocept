import { PARAGONS } from './towers/paragons';
import { Application, Container, Graphics } from 'pixi.js';
import { buildTextures } from './art';
import { createSpriteScene } from './render/pixi-scene';
import { DT, roundGroups } from './sim';
import { TOWERS, canUpgrade, type TowerKind } from './towers';
import { fitWorld, worldPoint } from './viewport';
import './style.css';
import { initAudio } from './audio';
import { MAPS, TIERS } from './maps/maps';
import { drawScene } from './maps/art';
import { createGame } from './modes/modes';
import { showScreen, type CoopView } from './screens/screens';
import { initialFlow, transition, type FlowEvent } from './ui/flow';
import { controlVisibility } from './ui/controls';
import { priceBadge, upgradeState } from './ui/state';
import { portrait } from './ui/icons';
import { upgradeDescription, upgradeRowState } from './ui/upgrade';
import { CATEGORY } from './modes/modes';
import { activeKnowledge, unlockKnowledge, respecKnowledge, settingsSlot, profileSlot, runSlot, snapshotSim, restoreSim, purchasePower, usePower, POWERS, POWER_BY_ID, type Settings } from './meta';
import { contextSlot } from './meta/run-context';
import { defaultKV } from './storage/store';
import { saveCodecs } from './storage/save-codecs';
import { SaveSync } from './storage/cloud-sync';
import { configuredClient, SupabaseStore } from './storage/supabase';
import { Accounts, SupabaseAuth } from './storage/accounts';
import { mountAccount } from './screens/account';
import { gameRewards, powerButtonState, supportedPowers, type Rewards } from './ui/meta';
import { modeById } from './modes/modes';
import { heroControls } from './hero-ui';
import { execute, type Command } from './net/commands';
import { Session, validCode } from './net/session';
import { HEROES, heroStats, type HeroKind } from './heroes';

let flow = initialFlow(location.search);
let mapId = flow.map, modeId = flow.mode, ended = false;
const client = configuredClient((import.meta as ImportMeta & { env: Record<string, string | undefined> }).env);
const saves = new SaveSync(defaultKV(), new SupabaseStore(client), saveCodecs);
// Auth tokens are memory-only. Start with the guest workspace; account caches stay private.
await saves.connect(null);
const accounts = new Accounts(client ? new SupabaseAuth(client) : null, user => saves.connect(user), () => flow.screen === 'menu');
const profileStore = profileSlot(saves), settingsStore = settingsSlot(saves), runStore = runSlot(saves);
let profile = profileStore.load(), savedSettings = settingsStore.load();
const supported = supportedPowers(POWERS.map(p => p.id));
const contextStore = contextSlot(saves);
let rewardedRound = modeById(modeId).startRound - 1, recorded = false;
let rewards: Rewards | undefined;
let placingPower: string | null = null;
let showRange = savedSettings.showRange, reducedMotion = savedSettings.reducedMotion;
let autoplay = savedSettings.autoplay, category: 'Monkeys' | 'Powers' = 'Monkeys', heroTools = false;
let pointer: { x: number; y: number } | null = null;
let sim = createGame(mapId, modeId, activeKnowledge(profile));
let selected = -1, placing: TowerKind | null = null, speed = 1, aiming = false;
let placingHero: HeroKind | null = null;
if (savedSettings.fastForward) speed = 3;
const root = document.getElementById('app')!;
root.innerHTML = `
  <main>
  <section id="field" aria-label="Tower defense map"></section>
  <header><div class="resources"><output id="lives" aria-label="Lives"></output><output id="cash" aria-label="Cash"></output></div><output id="active-powers" aria-label="Active powers"></output>
    <div class="round-box"><output id="hud" aria-label="Round"></output><button id="settings" aria-label="Pause and settings">⚙</button></div><div id="players" aria-label="Co-op players" hidden></div><button id="menu" class="sr-only" aria-label="Pause game">Ⅱ</button></header>
  <p id="hint" role="status">Buy a monkey, then choose a spot on the map.</p>
  <aside aria-label="Tower shop">
    <div class="side-title" id="side-title">Monkeys</div><div class="name-plate" id="side-name" aria-live="polite">Monkeys</div>
    <div id="shop-content" class="side-scroll" tabindex="0" aria-label="Scroll for more monkeys"><div id="shop" aria-label="Tower shop"></div><div id="powers" class="power-list" hidden></div><p id="powers-empty" hidden>No powers owned. Buy powers from the main menu.</p></div>
    <label for="tower-select" class="sr-only">Select a tower</label><select id="tower-select" class="sr-only"><option value="-1">No towers placed</option></select>
    <div class="side-mini"><button id="speed">×1</button><button id="autoplay" aria-pressed="false">Auto: Off</button></div>
    <div class="round-controls"><button id="powers-toggle" aria-pressed="false" aria-label="Powers">⚡</button><button id="start" aria-label="Start round 1">▶</button></div>
  </aside>
  <section id="inspector" aria-label="Upgrade and hero panel" hidden>
    <div class="insp-head"><h2 id="tower-title">Dart Monkey</h2><output id="pops"></output><button id="close-inspector" aria-label="Close upgrade panel">✕</button></div>
    <section id="details" hidden>
      <div class="insp-portrait"><div id="tower-portrait"></div><button id="ability" class="ability" hidden>Activate ability</button>
        <div class="targeting"><button id="target-prev" aria-label="Previous targeting mode">◀</button><button id="target">First</button><button id="target-next" aria-label="Next targeting mode">▶</button></div></div>
      <div class="insp-extra"><button id="aim" hidden>Set target on map</button><div id="target-point" hidden><label for="aim-x">Target X</label><input id="aim-x" type="number" min="0" max="300"><label for="aim-y">Target Y</label><input id="aim-y" type="number" min="0" max="230"><button id="apply-aim">Apply target coordinates</button></div><button id="collect" hidden>Collect bank</button>
        <div id="support-controls" hidden><label for="support-ally">Support target / beast to merge</label><select id="support-ally"></select><button id="support-target" hidden>Choose buff target</button><label for="merge-path" id="merge-label" hidden>Beast path</label><select id="merge-path" hidden><option value="0">Water beast</option><option value="1">Land beast</option><option value="2">Bird</option></select><button id="merge" hidden>Merge chosen beast into this handler</button></div>
        <p id="paragon-info" hidden></p><div id="paragon-controls" hidden><button id="paragon-open" class="paragon">Upgrade to Paragon</button></div></div>
      <div id="upgrades"></div>
      <div class="sell-row"><output id="sell-value"></output><button id="sell">Sell</button></div>
    </section>
    <div id="hero-host"></div></section>
  <dialog id="paragon-dialog" aria-labelledby="paragon-title"><h2 id="paragon-title">Upgrade to Paragon</h2><p id="paragon-text"></p>
    <label for="paragon-investment">Boost your Paragon with more in-game cash</label><input id="paragon-investment" type="range" min="0" step="500" value="0"><output id="paragon-total"></output>
    <div class="dialog-actions"><button id="paragon-cancel">Cancel</button><button id="paragon" class="go">Do it</button></div></dialog>
  </main>`;
const accountUI = mountAccount(root, accounts, saves);
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/** Co-op session while a co-op game runs (null in single player). */
let net: Session | null = null;
/** Every player action goes through here: run now in single player, send to the host in co-op. Co-op returns true = sent. */
function act(cmd: Command): boolean { if (net) { net.act(cmd); return true; } return execute(sim, 0, cmd); }
const mine = (i: number) => !net || (sim.towers[i]?.player ?? 0) === net.me;
const hud = element<HTMLOutputElement>('hud');
const field = element<HTMLElement>('field');
const hint = element<HTMLParagraphElement>('hint');
const shop = element<HTMLElement>('shop');
// Shop order like the game: Primary, Military, Magic, Support (hero tile goes first).
const SHOP_ORDER = ['primary', 'military', 'magic', 'support'];
const shopButtons = (Object.keys(TOWERS) as TowerKind[]).sort((a, b) => SHOP_ORDER.indexOf(CATEGORY[a] ?? 'support') - SHOP_ORDER.indexOf(CATEGORY[b] ?? 'support')).map(type => {
  const button = document.createElement('button');
  button.addEventListener('click', () => {
    placingPower = null; placingHero = null; heroUI.cancel(); aiming = false; heroTools = false; selected = -1; placing = placing === type ? null : type;
    hint.textContent = placing ? `Click on ${TOWERS[type].waterOnly ? 'water' : 'grass'} to place your ${TOWERS[type].name}. Escape cancels.` : 'Placement cancelled.';
    refresh();
  });
  button.className = 'tower-card'; button.dataset.cat = CATEGORY[type] ?? 'support';
  button.addEventListener('pointerenter', () => { element('side-name').textContent = TOWERS[type].name; });
  button.addEventListener('pointerleave', () => { element('side-name').textContent = sideName(); });
  shop.appendChild(button); return { type, button, key: '' };
});
const heroTile = document.createElement('button'); heroTile.id = 'hero-tile'; heroTile.className = 'tower-card'; heroTile.dataset.cat = 'hero';
heroTile.addEventListener('click', () => { placingPower = null; placing = null; aiming = false; selected = -1; heroTools = !heroTools; refresh(); });
shop.prepend(heroTile);
function sideName() { const t = sim.towers[selected]; return t ? (t.degree ? PARAGONS[t.type]!.name : TOWERS[t.type].name) : heroTools ? HEROES[sim.hero?.kind ?? flow.hero].name : category === 'Powers' ? 'Powers' : 'Monkeys'; }
const heroUI = heroControls(element<HTMLElement>('hero-host'), () => sim, () => selected, kind => {
  placingPower = null; placingHero = kind; placing = null; aiming = false; if (kind) { heroTools = false; selected = -1; } refresh();
}, message => { hint.textContent = message; });
const start = element<HTMLButtonElement>('start');
const towerSelect = element<HTMLSelectElement>('tower-select');
const details = element<HTMLElement>('details');
const target = element<HTMLButtonElement>('target');
const abilityButton = element<HTMLButtonElement>('ability');
abilityButton.addEventListener('click', () => { act({ k: 'ability', i: selected }); refresh(); });
const aim = element<HTMLButtonElement>('aim');
const aimX = element<HTMLInputElement>('aim-x'), aimY = element<HTMLInputElement>('aim-y');
aim.addEventListener('click', () => {
  placingPower = null; placing = null; aiming = !aiming;
  hint.textContent = aiming ? 'Click the map to set the target, or enter coordinates below. Escape cancels.' : 'Target selection cancelled.';
  refresh();
});
element<HTMLButtonElement>('apply-aim').addEventListener('click', () => {
  if (act({ k: 'aim', i: selected, x: aimX.valueAsNumber, y: aimY.valueAsNumber })) {
    aiming = false; hint.textContent = 'Target point updated.'; refresh();
  } else hint.textContent = `Use coordinates within the map: X 0–${sim.width}, Y 0–${sim.height}.`;
});
const sell = element<HTMLButtonElement>('sell');
const upgrades = element<HTMLElement>('upgrades');
const upgradeRows = [0, 1, 2].map(path => {
  const row = document.createElement('div'); row.className = 'up-row';
  row.innerHTML = '<span class="pips v" aria-hidden="true"></span><div class="up-cur"><b></b><small></small></div><button class="up-next"></button><div class="up-closed" hidden>🔒 Path closed</div>';
  const button = row.querySelector<HTMLButtonElement>('.up-next')!;
  button.addEventListener('click', () => { const tower = sim.towers[selected]; act({ k: 'upgrade', i: selected, path }); selected = sim.towers.indexOf(tower); refresh(); });
  upgrades.appendChild(row); return { row, button };
});
const upgradeButtons = upgradeRows.map(r => r.button);
const allySelect=element<HTMLSelectElement>('support-ally');
element('merge-path').onchange = () => refresh();
element('paragon-investment').oninput = () => refresh();
const paragonDialog = element<HTMLDialogElement>('paragon-dialog');
element('paragon-open').onclick = () => { (element<HTMLInputElement>('paragon-investment')).value = '0'; refresh(); paragonDialog.showModal(); };
element('paragon-cancel').onclick = () => paragonDialog.close();
element<HTMLButtonElement>('collect').addEventListener('click',()=>{act({k:'collect',i:selected});refresh();});
element<HTMLButtonElement>('support-target').addEventListener('click',()=>{if(act({k:'support',i:selected,target:Number(allySelect.value)}))hint.textContent='Buff target selected.';refresh();});
element<HTMLButtonElement>('merge').addEventListener('click',()=>{hint.textContent=act({k:'merge',src:Number(allySelect.value),dst:selected,path:Number(element<HTMLSelectElement>('merge-path').value)})?'Beast power merged.':'Choose an unmerged handler with a beast on the same path.';refresh();});
element<HTMLButtonElement>('paragon').addEventListener('click',()=>{const tower=sim.towers[selected];if(act({k:'paragon',i:selected,invest:Number(element<HTMLInputElement>('paragon-investment').value)})){selected=sim.towers.indexOf(tower);hint.textContent='Paragon created.';}paragonDialog.close();refresh();});
const app = new Application();
await app.init({ width: 960, height: 540, background: '#182b21', antialias: true });
field.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', 'Map: buy a monkey and click to place it; use Select a tower to manage monkeys');
const bg = new Container(), g = new Graphics();
const { container: entities, adapter: scene } = createSpriteScene(buildTextures(app.renderer));
app.stage.addChild(bg, entities, g);
function resizeMap() {
  const width = Math.max(1, field.clientWidth), height = Math.max(1, field.clientHeight);
  app.renderer.resize(width, height);
  const fit = fitWorld(width, height, sim.width, sim.height);
  app.stage.scale.set(fit.scale); app.stage.position.set(fit.x, fit.y);
}
new ResizeObserver(resizeMap).observe(field);
resizeMap();
function beginRound() { if (flow.screen !== 'game') return; if (sim.roundActive) cycleSpeed(); else if (!sim.gameOver && !sim.won) act({ k: 'round' }); refresh(); }
start.addEventListener('click', beginRound);
function cycleSpeed() { if (net) { net.requestSpeed(net.speed % 3 + 1); return; } speed = speed % 3 + 1; element<HTMLButtonElement>('speed').textContent = `×${speed}`; }
element<HTMLButtonElement>('speed').addEventListener('click', cycleSpeed);
element<HTMLButtonElement>('autoplay').addEventListener('click', () => { autoplay = !autoplay; refresh(); });
element('powers-toggle').onclick = () => { placingPower = null; category = category === 'Powers' ? 'Monkeys' : 'Powers'; refresh(); };
element('close-inspector').onclick = () => { selected = -1; heroTools = false; refresh(); };
target.addEventListener('click', () => { act({ k: 'target', i: selected, dir: 1 }); refresh(); });
element('target-next').onclick = () => target.click();
element('target-prev').onclick = () => { act({ k: 'target', i: selected, dir: -1 }); refresh(); };
sell.addEventListener('click', () => { if (act({ k: 'sell', i: selected })) selected = -1; refresh(); });
towerSelect.addEventListener('change', () => { selected = Number(towerSelect.value); placingPower = null; placing = null; aiming = false; heroTools = false; refresh(); });
function newGame(map: string, mode: string) {
  runStore.clear(); contextStore.clear();
  rewards = undefined; recorded = false; rewardedRound = modeById(mode).startRound - 1;
  speed = savedSettings.fastForward ? 3 : 1; autoplay = savedSettings.autoplay;
  placingPower = null;
  mapId = map; modeId = mode; scene.reset(); sim = createGame(map, mode, activeKnowledge(profile)); drawScene(bg, MAPS[map]); resizeMap();
  placingHero = null; heroUI.cancel(); selected = -1; placing = null; aiming = false; acc = 0; ended = false; pointer = null; heroTools = false;
  element<HTMLSelectElement>('hero-select').value = flow.hero;
  refresh();
}
// Detach audio's existing controls so the settings screen can reuse every control.
initAudio(sim);
const audioPanel = root.querySelector<HTMLElement>('aside fieldset') ?? undefined;
audioPanel?.remove();
// Reuse audio's public DOM controls without changing the audio lane.
function syncAudio() {
  for (const [label, value, key] of [['Sound effects volume', savedSettings.volume, 'volume'], ['Music volume', savedSettings.music, 'music']] as const) {
    const input = audioPanel?.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    if (!input) continue;
    // Apply cloud/guest audio to the audio listeners without recording a new user edit.
    input.oninput = null;
    input.value = String(Math.round(value * 100)); input.dispatchEvent(new Event('input'));
    input.oninput = () => changeSetting(key, Number(input.value) / 100);
  }
}
function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  savedSettings = { ...savedSettings, [key]: value }; settingsStore.save(savedSettings);
  showRange = savedSettings.showRange; reducedMotion = savedSettings.reducedMotion;
  root.classList.toggle('reduced-motion', reducedMotion);
}
syncAudio();
// ----- co-op -----
let session: Session | null = null, coopReady = false;
let coopName = (() => { try { return localStorage.getItem('mpt.name') || 'Monkey'; } catch { return 'Monkey'; } })();
function coopView(): CoopView {
  const S = session;
  return { name: coopName, code: S?.code ?? '', status: S?.status ?? 'idle', error: S?.error ?? '', host: !!S?.host, myId: S?.id ?? '',
    lobby: S?.lobby ?? { players: [], map: flow.map, mode: 'easy', split: true }, canStart: !!S?.canStart, ready: coopReady,
    setName: n => { coopName = n; try { localStorage.setItem('mpt.name', n); } catch { /* private mode */ } },
    create: () => startSession(x => x.create()),
    join: code => { if (validCode(code)) startSession(x => x.join(code)); else { const x = new Session(coopName); x.error = 'Codes are 6 letters or digits.'; x.status = 'closed'; session = x; renderScreen(); } },
    leave: () => { const was = session; session = null; net = null; was?.leave(); if (flow.screen === 'lobby') send({ type: 'back' }); else renderScreen(); },
    setReady: r => { coopReady = r; session?.setReady(r); renderScreen(); },
    configure: c => session?.configure(c), start: () => session?.start() };
}
function startSession(go: (s: Session) => void) {
  session?.leave(); const S = new Session(coopName); session = S; coopReady = false;
  S.onChange = () => {
    if (session !== S) return;
    if (S.status === 'lobby' && flow.screen === 'social') send({ type: 'lobby' });
    else if (S.status === 'closed' && flow.screen === 'lobby') send({ type: 'back' });
    else if (S.status === 'closed' && net === S) { hint.textContent = S.error || 'Disconnected.'; net = null; }
    else if (flow.screen === 'social' || flow.screen === 'lobby') renderScreen();
  };
  S.onStart = coopSim => { net = S; startCoopGame(coopSim); send({ type: 'mpStart' }); };
  S.onEffect = (c, ok) => {
    if (c.p !== S.me) return;
    if (ok && c.cmd.k === 'power') { profile = usePower(profile, c.cmd.id) ?? profile; profileStore.save(profile); }
    if (ok && c.cmd.k === 'place') { selected = sim.towers.length - 1; hint.textContent = 'Monkey placed.'; }
    if (!ok) hint.textContent = 'That action could not be done (not enough cash, not your monkey, or out of your zone).';
  };
  go(S); renderScreen();
}
function startCoopGame(coopSim: typeof sim) {
  rewards = undefined; recorded = false; mapId = net!.lobby.map; modeId = net!.lobby.mode; rewardedRound = modeById(modeId).startRound - 1;
  scene.reset(); sim = coopSim; drawScene(bg, MAPS[mapId]); resizeMap();
  placingPower = null; placingHero = null; heroUI.cancel(); selected = -1; placing = null; aiming = false; acc = 0; ended = false; pointer = null; heroTools = false; category = 'Monkeys';
  hint.textContent = `Co-op on ${MAPS[mapId].name}. You are P${net!.me + 1}.`;
}
function renderScreen() {
  showScreen(root, flow, send, sim.round, {
    profile, settings: savedSettings, hasRun: !!runStore.load(), rewards, supported,
    change: changeSetting,
    buy: id => { if (!supported.has(id)) return; profile = purchasePower(profile, id); profileStore.save(profile); renderScreen(); },
    coop: coopView(),
    account: { open: () => accountUI.open(), label: accounts.user ? 'Your account' : 'Sign in · cloud saves' },
    knowledge: {
      learn: name => { profile = unlockKnowledge(profile, name); profileStore.save(profile); renderScreen(); },
      respec: () => { profile = respecKnowledge(profile); profileStore.save(profile); renderScreen(); },
      toggle: on => { profile = { ...profile, mkOn: on }; profileStore.save(profile); renderScreen(); },
    },
  }, audioPanel);
  root.querySelector<HTMLElement>('main')!.inert = flow.screen !== 'game';
  root.querySelector<HTMLElement>('header')!.inert = flow.screen !== 'game';
  if (flow.screen === 'game') start.focus();
  void accounts.resume();
}
function consumePower(id: string, point?: { x: number; y: number }) {
  if (!(profile.powers[id] > 0) || !sim.canUsePower(id, point)) return false;
  if (net) { net.act({ k: 'power', id, ...point }); placingPower = null; hint.textContent = `${POWER_BY_ID[id].name} sent.`; return true; } // inventory drops when it lands (onEffect)
  if (!act({ k: 'power', id, ...point })) return false;
  profile = usePower(profile, id)!; profileStore.save(profile);
  placingPower = null; hint.textContent = `${POWER_BY_ID[id].name} used.`; return true;
}
const powerButtons = POWERS.map(p => {
  const button = document.createElement('button');
  button.onclick = () => {
    placing = null; placingHero = null; heroUI.cancel(); aiming = false; selected = -1;
    if (sim.powerNeedsPoint(p.id)) { placingPower = p.id; hint.textContent = `Place ${p.name} on the ${p.kind === 'trap' ? 'track' : 'map'}. Escape cancels.`; }
    else consumePower(p.id);
    refresh();
  };
  element('powers').append(button); return { p, button };
});
function saveRun(completedRound = sim.round) {
  if (sim.gameOver || sim.won) return;
  const snapshot = snapshotSim(sim, mapId, Date.now());
  snapshot.round = completedRound;
  runStore.save(snapshot);
  contextStore.save({ mode: modeId, hero: flow.hero, savedAt: snapshot.savedAt, rewardedRound, recorded });
  void saves.flush();
}
function loadRun() {
  const snapshot = runStore.load(), context = contextStore.load();
  if (!snapshot || !MAPS[snapshot.map]) return false;
  const matching = context?.savedAt === snapshot.savedAt ? context : null;
  const mode = matching?.mode ?? snapshot.difficulty;
  const restored = createGame(snapshot.map, mode, activeKnowledge(profile));
  if (!restoreSim(restored, snapshot)) { hint.textContent = 'Saved run could not be restored.'; return false; }
  scene.reset(); sim = restored; mapId = snapshot.map; modeId = mode;
  flow = { ...flow, map: mapId, mode, difficulty: sim.difficulty, hero: matching?.hero ?? flow.hero };
  rewardedRound = matching?.rewardedRound ?? modeById(mode).startRound - 1; recorded = matching?.recorded ?? false;
  ended = false; rewards = undefined; selected = -1; heroTools = false; pointer = null; acc = 0;
  speed = savedSettings.fastForward ? 3 : 1; autoplay = savedSettings.autoplay;
  element<HTMLSelectElement>('hero-select').value = flow.hero;
  drawScene(bg, MAPS[mapId]); return true;
}
function send(event: FlowEvent) {
  if (event.type === 'loadRun' && (flow.screen !== 'menu' || !loadRun())) return;
  const before = flow;
  flow = transition(flow, event);
  if (flow === before) return;
  if (net && (event.type === 'restart' || event.type === 'continue')) { flow = before; return; } // co-op games can't be restarted locally
  if (event.type === 'home' && session) { session.leave(); session = null; net = null; }
  if (event.type === 'restart' || event.type === 'hero') newGame(flow.map, flow.mode);
  if (event.type === 'continue') { sim.rules.winRound = Infinity; sim.won = false; ended = false; }
  if (flow.screen !== 'game') { placingPower = null; placing = null; placingHero = null; aiming = false; heroUI.cancel(); acc = 0; }
  renderScreen(); refresh();
}
element<HTMLButtonElement>('menu').addEventListener('click', () => send({ type: 'pause' }));
element<HTMLButtonElement>('settings').addEventListener('click', () => { send({ type: 'pause' }); send({ type: 'settings' }); });
const shopKeys: Record<string, string> = { q: 'dart', w: 'boomerang', e: 'bomb', r: 'tack', t: 'ice', y: 'glue', z: 'sniper', x: 'sub', c: 'buccaneer', v: 'ace', b: 'heli', n: 'mortar', m: 'dartling', a: 'wizard', s: 'super', d: 'ninja', f: 'alchemist', g: 'druid', j: 'farm', k: 'spike', l: 'village', i: 'engineer' };
addEventListener('keydown', e => {
  if (element<HTMLDialogElement>('account-dialog').open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (flow.screen !== 'game') { send({ type: 'back' }); return; }
    if (placingPower || placing || placingHero || aiming) { placingPower = null; placingHero = null; heroUI.cancel(); placing = null; aiming = false; pointer = null; }
    else if (selected >= 0 || heroTools) { selected = -1; heroTools = false; }
    else send({ type: 'pause' });
    refresh(); return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (flow.screen === 'splash' && (e.key === 'Enter' || e.code === 'Space')) { e.preventDefault(); send({ type: 'start' }); return; }
  // Keep keyboard focus inside the active overlay.
  if (flow.screen !== 'game') {
    if (e.key === 'Tab') {
      const controls = [...root.querySelectorAll<HTMLElement>('#overlay button, #overlay input, #overlay select')].filter(x => !(x as HTMLButtonElement).disabled);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); beginRound(); }
  const path = [',', '.', '/'].indexOf(e.key);
  if (path >= 0 && selected >= 0) { e.preventDefault(); upgradeButtons[path].click(); }
  if (e.key === 'Backspace' && selected >= 0) { e.preventDefault(); sell.click(); }
  if (e.key === 'Tab' && selected >= 0 && !e.shiftKey && (e.target === app.canvas || e.target === document.body || e.target === target)) { e.preventDefault(); target.click(); }
  if (e.key.toLowerCase() === 'u') { category = 'Monkeys'; heroTools = true; refresh(); element<HTMLButtonElement>('hero-place').click(); }
  const kind = shopKeys[e.key.toLowerCase()];
  const card = shopButtons.find(b => b.type === kind);
  if (card && !card.button.disabled && (!sim.rules.allowed || sim.rules.allowed(card.type))) { category = 'Monkeys'; refresh(); card.button.scrollIntoView({ block: 'nearest' }); card.button.click(); }
});
function mapPointer(e: PointerEvent) {
  const rect = app.canvas.getBoundingClientRect();
  return worldPoint((e.clientX - rect.left) * app.screen.width / rect.width, (e.clientY - rect.top) * app.screen.height / rect.height, app.screen.width, app.screen.height, sim.width, sim.height);
}
app.canvas.tabIndex = 0;
app.canvas.addEventListener('pointermove', e => { pointer = mapPointer(e); });
app.canvas.addEventListener('pointerleave', () => { pointer = null; });
app.canvas.addEventListener('pointerdown', e => {
  if (flow.screen !== 'game') return;
  app.canvas.focus();
  const { x, y } = mapPointer(e);
  if (x < 0 || y < 0 || x > sim.width || y > sim.height) return;
  if (placingPower) {
    if (!consumePower(placingPower, { x, y })) hint.textContent = 'Choose a valid power location. No power consumed.';
    refresh(); return;
  }
  if (aiming) {
    if (act({ k: 'aim', i: selected, x, y })) { aiming = false; hint.textContent = 'Target point updated.'; }
    refresh(); return;
  }
  if (placingHero) {
    if (sim.placeHero(x, y, placingHero)) { placingHero = null; heroUI.cancel(); hint.textContent = 'Hero placed. Gain XP by completing rounds.'; }
    else hint.textContent = 'Choose a valid location clear of the track, water restrictions, and towers.';
    refresh(); return;
  }
  if(!placing && sim.collectibles.some(b=>Math.hypot(x-b.x,y-b.y)<=(b.owner.tiers[2]>=1?75:50)) && act({k:'collectAt',x,y})){refresh();return;}
  const hit = sim.towers.findIndex(t => Math.hypot(t.x - x, t.y - y) < 16);
  if (hit >= 0) { selected = hit; heroTools = false; placing = null; }
  else if (placing) {
    if (!sim.canPlace(x, y, placing)) hint.textContent = `Choose ${TOWERS[placing].waterOnly ? 'water' : 'grass'}, clear of the track and other towers.`;
    else if (net) { act({ k: 'place', x, y, kind: placing }); placing = null; hint.textContent = 'Placing monkey…'; }
    else if (act({ k: 'place', x, y, kind: placing })) { selected = sim.towers.length - 1; heroTools = false; placing = null; hint.textContent = 'Monkey placed. Select upgrades below.'; }
  } else selected = -1;
  refresh();
});
let lastOptions: string | null = null, lastAim = '';
drawScene(bg, MAPS[mapId] ?? MAPS.monkey_meadow);
function refresh() {
  heroUI.refresh();
  element('powers').hidden = category !== 'Powers';
  element('shop').hidden = category === 'Powers';
  element('powers-empty').hidden = category !== 'Powers' || POWERS.some(p => (profile.powers[p.id] ?? 0) > 0);
  powerButtons.forEach(({ p, button }) => {
    const count = profile.powers[p.id] ?? 0;
    const state = powerButtonState(count, supported.has(p.id), sim.gameOver || !!sim.rules.noPowers);
    button.hidden = count < 1;
    button.disabled = state.disabled;
    const html = `<span>${p.name}</span><b>${count}</b>`; if (button.innerHTML !== html) button.innerHTML = html;
    button.title = state.reason || p.text; button.className = 'hex';
    button.setAttribute('aria-pressed', String(placingPower === p.id));
  });
  element('active-powers').textContent = sim.activePowers.map(p => `${POWER_BY_ID[p.id]?.name ?? p.id}${Number.isFinite(p.until) ? ` ${Math.ceil((p.until - sim.tick) / 60)}s` : ''}`).join(' · ');
  hud.textContent = `Round ${sim.round}/${Number.isFinite(sim.rules.winRound) ? sim.rules.winRound : '∞'}`;
  element('lives').textContent = sim.lives.toLocaleString();
  element('cash').textContent = `$${Math.floor(sim.cash).toLocaleString()}`;
  element('autoplay').textContent = `Auto: ${autoplay ? 'On' : 'Off'}`;
  element('autoplay').setAttribute('aria-pressed', String(autoplay));
  element('speed').setAttribute('aria-label', `Speed ×${speed}`);
  element('speed').textContent = `×${speed}`;
  element('side-title').textContent = category === 'Powers' ? 'Powers' : 'Monkeys';
  element('powers-toggle').setAttribute('aria-pressed', String(category === 'Powers'));
  if (!element('side-name').matches(':hover') && !shop.matches(':hover')) element('side-name').textContent = sideName();
  const heroKind = sim.hero?.kind ?? flow.hero, heroCost = sim.hero ? 'Placed' : '$' + HEROES[heroKind].cost[sim.difficulty].toLocaleString();
  const heroKey = heroKind + heroCost;
  if (heroTile.dataset.key !== heroKey) { heroTile.innerHTML = `${portrait('hero', HEROES[heroKind].name, HEROES[heroKind].color)}<b>${HEROES[heroKind].name}</b><span class="price">${heroCost}</span>`; heroTile.dataset.key = heroKey; }
  heroTile.setAttribute('aria-pressed', String(heroTools)); heroTile.classList.toggle('placed', !!sim.hero);
  heroTile.hidden = !!net; // uncertain: heroes are single-player only for now (one shared hero would desync)
  const players = element('players'); players.hidden = !net;
  if (net) {
    const html = net.lobby.players.map((p, i) => `<span class="pchip p${i + 1}${i === net!.me ? ' me' : ''}"><b>P${i + 1}</b>${p.name} <em>$${Math.floor(sim.wallets[i] ?? 0).toLocaleString()}</em>${i !== net!.me ? `<button data-give="${i}" aria-label="Give $100 to ${p.name}">+$100</button>` : ''}</span>`).join('') + (net.desync ? '<span class="pchip warn">resync at round end</span>' : '');
    if (players.dataset.html !== html) { players.innerHTML = html; players.dataset.html = html; players.querySelectorAll<HTMLButtonElement>('[data-give]').forEach(b => b.onclick = () => act({ k: 'give', to: Number(b.dataset.give), amount: 100 })); }
  }
  element('hero-host').hidden = !heroTools;
  element('inspector').hidden = selected < 0 && !heroTools;
  root.classList.toggle('insp-left', !element('inspector').hidden && !element('inspector').classList.contains('dock-right'));
  root.classList.toggle('powers-open', category === 'Powers');
  element('inspector').classList.toggle('dock-right', (sim.towers[selected]?.x ?? sim.width) < sim.width / 2);
  shopButtons.forEach(card => {
    const { type, button } = card, state = priceBadge(sim.shopPrice(type), sim.cash, sim.gameOver);
    const key = `${state.label}:${placing === type}`;
    if (key !== card.key) { button.innerHTML = `${portrait('tower', type, TOWERS[type].color)}<b>${TOWERS[type].name}</b><span class="price">${state.label}</span>`; card.key = key; }
    button.hidden = !!sim.rules.allowed && !sim.rules.allowed(type);
    button.disabled = state.disabled;
    button.classList.toggle('unaffordable', state.unaffordable);
    button.title = `${TOWERS[type].name} · ${state.label}${state.need ? ' · ' + state.need : ''}`;
    button.setAttribute('aria-pressed', String(placing === type));
  });
  field.classList.toggle('placing', placingPower !== null || placing !== null || placingHero !== null || aiming);
  start.disabled = sim.gameOver || !sim.roundActive && !roundGroups(sim.round + 1).length || sim.won && sim.round >= sim.rules.winRound;
  start.textContent = sim.gameOver ? '■' : sim.roundActive ? '»' : '▶';
  start.setAttribute('aria-label', sim.roundActive ? 'Fast forward round' : `Start round ${sim.round + 1}`);
  const options = sim.towers.map((t, i) => `<option value="${i}">${t.degree?PARAGONS[t.type]!.name:TOWERS[t.type].name} ${i + 1} · ${t.degree?'Degree '+t.degree:t.tiers.join('-')}</option>`).join('');
  if (options !== lastOptions) { towerSelect.innerHTML = '<option value="-1">Select a tower</option>' + options; lastOptions = options; }
  towerSelect.value = String(selected);
  const t = sim.towers[selected]; details.hidden = !t || heroTools;
  if (!t) return;
  element<HTMLElement>('tower-title').textContent = t.degree ? `${PARAGONS[t.type]!.name} · Degree ${t.degree}` : TOWERS[t.type].name;
  const portraitKey = t.type;
  if (element('tower-portrait').dataset.kind !== portraitKey) { element('tower-portrait').innerHTML = portrait('tower', t.type, TOWERS[t.type].color); element('tower-portrait').dataset.kind = portraitKey; }
  element('pops').textContent = `✹ ${Math.floor(t.paragonPops ?? 0).toLocaleString()} pops`;
  const controls = controlVisibility(sim, selected);
  aim.hidden = !controls.aim;
  aim.textContent = t.type === 'super' ? 'Set Darkshift destination' : t.type === 'mermonkey' ? 'Place melody totem' : 'Set target on map';
  aim.disabled = sim.gameOver;
  aim.setAttribute('aria-pressed', String(aiming));
  element<HTMLElement>('target-point').hidden = aim.hidden;
  const aimKey = `${selected}:${t.targetPoint.x}:${t.targetPoint.y}`;
  if (aimKey !== lastAim) {
    aimX.value = String(Math.round(t.targetPoint.x)); aimY.value = String(Math.round(t.targetPoint.y)); lastAim = aimKey;
  }
  abilityButton.hidden = !t.ability;
  abilityButton.disabled = sim.gameOver || t.ability?.kind === 'stub' || sim.tick < t.abilityReady;
  abilityButton.textContent = t.ability?.kind === 'stub' ? 'Ability not implemented' : sim.tick < t.abilityReady ? `Ability · ${Math.ceil((t.abilityReady - sim.tick) / 60)}s` : 'Activate ability';
  target.textContent = t.targeting; target.disabled = sim.gameOver;
  element<HTMLButtonElement>('target-prev').disabled = sim.gameOver;
  element<HTMLButtonElement>('target-next').disabled = sim.gameOver;
  element('sell-value').textContent = `$${sim.sellValue(t).toLocaleString()}`; sell.textContent = 'Sell'; sell.disabled = sim.gameOver || sim.rules.noSell || !mine(selected);
  const collect = element<HTMLButtonElement>('collect'); collect.hidden = !controls.collect;
  collect.textContent = t.type === 'farm' && t.tiers[1] >= 3 ? `Collect bank · $${(t.bank ?? 0).toFixed(0)}` : t.type === 'engineer' ? 'Collect trap' : 'Collect bananas';
  element('support-controls').hidden = !controls.support && !controls.merge;
  const mergePath = element<HTMLSelectElement>('merge-path');
  [...mergePath.options].forEach((option, path) => { option.disabled = !controls.mergePaths[path].length; });
  if (mergePath.selectedOptions[0]?.disabled) mergePath.value = String(controls.mergePaths.findIndex(a => a.length));
  const allyIndices = controls.support ? controls.supportAllies : controls.mergePaths[Number(mergePath.value)] ?? [];
  const allies = allyIndices.map(i => `<option value="${i}">${TOWERS[sim.towers[i].type].name} ${i + 1} · ${sim.towers[i].tiers.join('-')}</option>`).join('');
  if (allySelect.innerHTML !== allies) { const value = allySelect.value; allySelect.innerHTML = allies; if ([...allySelect.options].some(o => o.value === value)) allySelect.value = value; }
  element('support-target').hidden = !controls.support;
  for (const id of ['merge', 'merge-path', 'merge-label']) element(id).hidden = !controls.merge;
  const paragon = PARAGONS[t.type]; element('paragon-controls').hidden = !controls.paragon;
  element('paragon-info').hidden = !controls.paragonHint;
  element('paragon-info').textContent = 'Paragon: needs 5-x-x, x-5-x, x-x-5';
  if (paragon) {
    const base = sim.price(paragon.cost), invest = element<HTMLInputElement>('paragon-investment');
    invest.max = String(Math.max(0, Math.floor(sim.cash - base)));
    element('paragon-text').textContent = `This creates ${paragon.name}. All other ${TOWERS[t.type].name}s are absorbed, feeding its power.`;
    element('paragon-total').textContent = `$${(base + Number(invest.value)).toLocaleString()}`;
    element<HTMLButtonElement>('paragon-open').textContent = `Upgrade to Paragon · $${base.toLocaleString()}`;
    element<HTMLButtonElement>('paragon').disabled = !controls.paragon || sim.cash < base + Number(invest.value);
  }
  upgradeRows.forEach(({ row, button }, path) => {
    const tiers = TOWERS[t.type].paths[path], owned = t.tiers[path], next = tiers[owned];
    const open = canUpgrade(t.tiers, path), allowed = sim.canUpgradeTower(selected, path);
    const cost = next ? sim.upgradePrice(selected, path) : 0, state = upgradeState(!!next, allowed, cost, sim.cash, sim.gameOver);
    const rowState = upgradeRowState(owned, !!next, open), closed = rowState === 'closed' && !t.degree, capped = rowState !== 'buy';
    row.classList.toggle('closed', closed); row.querySelector<HTMLElement>('.up-closed')!.hidden = !closed;
    const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < owned ? 'owned' : ''}"></i>`).reverse().join('');
    const pipEl = row.querySelector<HTMLElement>('.pips')!; if (pipEl.innerHTML !== pips) { pipEl.innerHTML = pips; pipEl.setAttribute('aria-label', `${owned} of 5 tiers`); }
    row.querySelector('.up-cur b')!.textContent = owned ? tiers[owned - 1].name : '';
    row.querySelector('.up-cur small')!.textContent = owned ? 'Owned' : 'Not upgraded';
    const html = !capped && next ? `<b>${next.name}</b><span class="price">$${cost.toLocaleString()}</span>${state.reason ? `<small>${state.reason}</small>` : ''}` : '<b>Max upgrades</b>';
    if (button.innerHTML !== html) button.innerHTML = html;
    button.disabled = state.disabled || capped || !mine(selected); button.classList.toggle('max', capped); button.classList.toggle('broke', !capped && sim.cash < cost);
    button.title = next ? upgradeDescription(owned ? tiers[owned - 1].stats : TOWERS[t.type].base, next.stats) : 'Path complete';
  });
}
let acc = 0;
refresh();
root.classList.toggle('reduced-motion', reducedMotion);
renderScreen();
saves.onChange = () => accountUI.update();
saves.onApply = keys => {
  if (keys.includes('mpt.profile')) profile = profileStore.load();
  if (keys.includes('mpt.settings')) { savedSettings = settingsStore.load(); showRange = savedSettings.showRange; reducedMotion = savedSettings.reducedMotion; root.classList.toggle('reduced-motion', reducedMotion); syncAudio(); }
  if (flow.screen !== 'game') renderScreen();
  refresh();
};
accounts.onChange = () => { accountUI.update(); const button = root.querySelector('#account-open'); if (button) button.textContent = accounts.user ? 'Your account' : 'Sign in · cloud saves'; };
void accounts.start();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void saves.flush(); });
addEventListener('pagehide', () => { void saves.flush(); });
addEventListener('online', () => { void saves.flush(); });
app.ticker.add(t => {
  if (flow.screen !== 'game' && !net) return;
  if (net) {
    // Co-op: the host's clock drives everyone (pausing doesn't stop a shared game).
    if (net.host && autoplay && !sim.roundActive && !sim.gameOver && !sim.won && flow.screen === 'game') act({ k: 'round' });
    acc = Math.min(acc + Math.min(t.deltaMS / 1000, 0.25) * net.speed, 0.75);
    const steps = Math.floor(acc / DT); acc -= steps * DT; net.frame(steps);
  } else {
  if (autoplay && !sim.roundActive && !sim.gameOver && !sim.won) beginRound();
  acc = Math.min(acc + Math.min(t.deltaMS / 1000, 0.25) * speed, 0.75);
  }
  while (!net && acc >= DT) {
    const active = sim.roundActive, round = sim.round;
    sim.step(); acc -= DT;
    if (active && !sim.gameOver && (!sim.roundActive || sim.round > round)) saveRun(round);
    if (sim.gameOver || sim.won) break;
  }
  initAudio(sim);
  g.clear();
  if (net && sim.mapSplit) {
    const n = sim.wallets.length, w = sim.width / n;
    for (let z = 0; z < n; z++) if (z !== net.me) g.rect(z * w, 0, w, sim.height).fill({ color: 0x000000, alpha: 0.22 });
    for (let z = 1; z < n; z++) g.moveTo(z * w, 0).lineTo(z * w, sim.height).stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
  }
  const chosen = sim.towers[selected];
  if (!ended && (sim.gameOver || sim.won)) {
    ended = true; const won = sim.won && !sim.gameOver;
    const completedRound = won || !sim.roundActive && !sim.gameOver ? sim.round : sim.round - 1;
    rewards = gameRewards(profile, { map: mapId, difficulty: sim.difficulty, mapDifficulty: Math.max(0, TIERS.indexOf(MAPS[mapId].tier)), won, recorded, startRound: rewardedRound + 1, completedRound, hero: HEROES[sim.hero?.kind ?? flow.hero].name, pops: sim.towers.reduce((n, t) => n + (t.paragonPops ?? 0), 0) });
    profile = rewards.profile; profileStore.save(profile);
    rewardedRound = completedRound; recorded = true;
    runStore.clear(); contextStore.clear();
    void saves.flush();
    send({ type: won ? 'victory' : 'defeat' });
  }
  if (chosen && sim.canSetTarget(chosen)) {
    const p = chosen.targetPoint; g.circle(p.x, p.y, 8).stroke({ color: 0xffdf66, width: 2 });
    g.moveTo(p.x - 12, p.y).lineTo(p.x + 12, p.y).moveTo(p.x, p.y - 12).lineTo(p.x, p.y + 12).stroke({ color: 0xffdf66, width: 1 });
  }
  scene.update(sim, t.deltaMS / 1000, selected, showRange && chosen ? sim.effectiveStats(chosen).range : 0, !reducedMotion);
  if (pointer && placingPower) {
    g.circle(pointer.x, pointer.y, 14).stroke({ color: sim.canUsePower(placingPower, pointer) ? 0x66ff88 : 0xff5544, width: 3 });
  }
  if (pointer && (placing || placingHero)) {
    const valid = placing ? sim.canPlace(pointer.x, pointer.y, placing) && sim.cash >= sim.shopPrice(placing) : sim.canPlaceHero(pointer.x, pointer.y, placingHero!) && sim.cash >= HEROES[placingHero!].cost[sim.difficulty];
    const range = placing ? TOWERS[placing].base.range : heroStats(placingHero!, 1).range;
    scene.placement(placing ? 'tower' : 'hero', placing ?? placingHero!, pointer, showRange ? range : 0, valid);
  }
  else scene.placement('tower', 'dart', null, 0, false);
  refresh();
});
