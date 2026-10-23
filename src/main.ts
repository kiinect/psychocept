import { PARAGONS } from './towers/paragons';
import { Application, Graphics } from 'pixi.js';
import { DT, roundGroups } from './sim';
import { TOWERS, type TowerKind } from './towers';
import { fitWorld, worldPoint } from './viewport';
import './style.css';
import { initAudio } from './audio';
import { MAPS } from './maps/maps';
import { drawScene } from './maps/art';
import { createGame } from './modes/modes';
import { showScreen } from './screens/screens';
import { initialFlow, transition, type FlowEvent } from './ui/flow';
import { priceBadge, upgradeState } from './ui/state';
import { portrait } from './ui/icons';
import { upgradeDescription } from './ui/upgrade';
import { CATEGORY } from './modes/modes';
import { settingsSlot } from './meta';
import { heroControls } from './hero-ui';
import { HEROES, heroStats, type HeroKind } from './heroes';

let flow = initialFlow(location.search);
let mapId = flow.map, modeId = flow.mode, ended = false;
const savedSettings = settingsSlot().load();
let showRange = savedSettings.showRange, reducedMotion = savedSettings.reducedMotion;
let autoplay = savedSettings.autoplay, category = 'Primary', heroTools = false;
let pointer: { x: number; y: number } | null = null;
let sim = createGame(mapId, modeId);
let selected = -1, placing: TowerKind | null = null, speed = 1, aiming = false;
let placingHero: HeroKind | null = null;
if (savedSettings.fastForward) speed = 3;
const root = document.getElementById('app')!;
root.innerHTML = `
  <header><div class="resources"><output id="lives" aria-label="Lives"></output><output id="cash" aria-label="Cash"></output></div><output id="hud" aria-label="Round"></output><button id="settings" aria-label="Settings">⚙</button><button id="menu" aria-label="Pause game">Ⅱ</button></header>
  <main><section id="field" aria-label="Tower defense map"></section>
  <aside aria-label="Tower shop"><button id="collapse" aria-expanded="true">Shop ▾</button><div id="shop-content"><nav id="categories" aria-label="Tower categories"></nav>
    <div id="shop" aria-label="Tower shop"></div>
    <p id="hint" role="status">Buy a monkey, then choose a spot on the map.</p>
    <label for="tower-select">Select a tower</label><select id="tower-select"><option value="-1">No towers placed</option></select>
    </div></aside><section id="inspector" aria-label="Upgrade and hero panel" hidden><button id="close-inspector" aria-label="Close upgrade panel">× Close</button><section id="details" hidden><div id="tower-portrait"></div><h2 id="tower-title">Dart Monkey</h2><output id="pops"></output>
      <button id="aim" hidden>Set target on map</button><div id="target-point" hidden><label for="aim-x">Target X</label><input id="aim-x" type="number" min="0" max="960"><label for="aim-y">Target Y</label><input id="aim-y" type="number" min="0" max="540"><button id="apply-aim">Apply target coordinates</button></div><button id="target">Target: First</button><button id="ability" hidden>Activate ability</button><div id="upgrades"></div><button id="collect" hidden>Collect bank</button>
      <div id="support-controls" hidden><label for="support-ally">Support target / beast to merge</label><select id="support-ally"></select><button id="support-target" hidden>Choose buff target</button><label for="merge-path" id="merge-label" hidden>Beast path</label><select id="merge-path" hidden><option value="0">Water beast</option><option value="1">Land beast</option><option value="2">Bird</option></select><button id="merge" hidden>Merge chosen beast into this handler</button></div>
      <div id="paragon-controls" hidden><p id="paragon-info"></p><label for="paragon-investment">Extra paragon investment</label><input id="paragon-investment" type="number" min="0" step="1000" value="0"><button id="paragon">Create paragon</button></div><button id="sell">Sell</button>
    </section>
    <div id="hero-host"></div></section><div class="round-controls"><button id="start" aria-label="Start round 1">▶</button><button id="speed">×1</button><button id="autoplay" aria-pressed="false">Auto: Off</button></div></main>`;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hud = element<HTMLOutputElement>('hud');
const field = element<HTMLElement>('field');
const hint = element<HTMLParagraphElement>('hint');
const shop = element<HTMLElement>('shop');
const shopButtons = (Object.keys(TOWERS) as TowerKind[]).map(type => {
  const button = document.createElement('button');
  button.addEventListener('click', () => {
    placingHero = null; heroUI.cancel(); aiming = false; heroTools = false; selected = -1; placing = placing === type ? null : type;
    hint.textContent = placing ? `Click on ${TOWERS[type].waterOnly ? 'water' : 'grass'} to place your ${TOWERS[type].name}. Escape cancels.` : 'Placement cancelled.';
    refresh();
  });
  button.className = 'tower-card';
  shop.appendChild(button); return { type, button, key: '' };
});
const heroUI = heroControls(element<HTMLElement>('hero-host'), () => sim, () => selected, kind => {
  placingHero = kind; placing = null; aiming = false; if (kind) { heroTools = false; selected = -1; } refresh();
}, message => { hint.textContent = message; });
const start = element<HTMLButtonElement>('start');
const towerSelect = element<HTMLSelectElement>('tower-select');
const details = element<HTMLElement>('details');
const target = element<HTMLButtonElement>('target');
const abilityButton = element<HTMLButtonElement>('ability');
abilityButton.addEventListener('click', () => { sim.activate(selected); refresh(); });
const aim = element<HTMLButtonElement>('aim');
const aimX = element<HTMLInputElement>('aim-x'), aimY = element<HTMLInputElement>('aim-y');
aim.addEventListener('click', () => {
  placing = null; aiming = !aiming;
  hint.textContent = aiming ? 'Click the map to set the target, or enter coordinates below. Escape cancels.' : 'Target selection cancelled.';
  refresh();
});
element<HTMLButtonElement>('apply-aim').addEventListener('click', () => {
  if (sim.setTarget(selected, { x: aimX.valueAsNumber, y: aimY.valueAsNumber })) {
    aiming = false; hint.textContent = 'Target point updated.'; refresh();
  } else hint.textContent = 'Use coordinates within the map: X 0–960, Y 0–540.';
});
const sell = element<HTMLButtonElement>('sell');
const upgrades = element<HTMLElement>('upgrades');
const upgradeButtons = [0, 1, 2].map(path => {
  const button = document.createElement('button');
  button.addEventListener('click', () => { const tower = sim.towers[selected]; sim.upgrade(selected, path); selected = sim.towers.indexOf(tower); refresh(); });
  upgrades.appendChild(button); return button;
});
const allySelect=element<HTMLSelectElement>('support-ally');
element<HTMLButtonElement>('collect').addEventListener('click',()=>{sim.collect(selected);refresh();});
element<HTMLButtonElement>('support-target').addEventListener('click',()=>{if(sim.setSupportTarget(selected,Number(allySelect.value)))hint.textContent='Buff target selected.';refresh();});
element<HTMLButtonElement>('merge').addEventListener('click',()=>{hint.textContent=sim.mergeBeast(Number(allySelect.value),selected,Number(element<HTMLSelectElement>('merge-path').value))?'Beast power merged.':'Choose an unmerged handler with a beast on the same path.';refresh();});
element<HTMLButtonElement>('paragon').addEventListener('click',()=>{const tower=sim.towers[selected];if(sim.makeParagon(selected,Number(element<HTMLInputElement>('paragon-investment').value))){selected=sim.towers.indexOf(tower);hint.textContent='Paragon created.';}refresh();});
const app = new Application();
await app.init({ width: 960, height: 540, background: '#182b21', antialias: true });
field.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', 'Map: buy a monkey and click to place it; use Select a tower to manage monkeys');
const bg = new Graphics(), g = new Graphics(); app.stage.addChild(bg, g);
function resizeMap() {
  const width = Math.max(1, field.clientWidth), height = Math.max(1, field.clientHeight);
  app.renderer.resize(width, height);
  const fit = fitWorld(width, height);
  app.stage.scale.set(fit.scale); app.stage.position.set(fit.x, fit.y);
}
new ResizeObserver(resizeMap).observe(field);
resizeMap();
function beginRound() { if (flow.screen !== 'game') return; if (sim.roundActive) cycleSpeed(); else if (!sim.gameOver && !sim.won) sim.startRound(roundGroups(sim.round + 1)); refresh(); }
start.addEventListener('click', beginRound);
function cycleSpeed() { speed = speed % 3 + 1; element<HTMLButtonElement>('speed').textContent = `×${speed}`; }
element<HTMLButtonElement>('speed').addEventListener('click', cycleSpeed);
element<HTMLButtonElement>('autoplay').addEventListener('click', () => { autoplay = !autoplay; refresh(); });
for (const name of ['Primary', 'Military', 'Magic', 'Support', 'Hero']) {
  const b = document.createElement('button'); b.textContent = name;
  b.onclick = () => { category = name; heroTools = name === 'Hero'; refresh(); };
  element('categories').appendChild(b);
}
element('collapse').onclick = () => { const content = element('shop-content'); content.hidden = !content.hidden; root.classList.toggle('shop-collapsed', content.hidden); element('collapse').setAttribute('aria-expanded', String(!content.hidden)); element('collapse').textContent = content.hidden ? 'Shop ▸' : 'Shop ▾'; };
element('close-inspector').onclick = () => { selected = -1; heroTools = false; refresh(); };
target.addEventListener('click', () => { sim.cycleTargeting(selected); refresh(); });
sell.addEventListener('click', () => { if (sim.sell(selected)) selected = -1; refresh(); });
towerSelect.addEventListener('change', () => { selected = Number(towerSelect.value); placing = null; aiming = false; heroTools = false; refresh(); });
function newGame(map: string, mode: string) {
  mapId = map; modeId = mode; sim = createGame(map, mode); drawScene(bg, MAPS[map]);
  placingHero = null; heroUI.cancel(); selected = -1; placing = null; aiming = false; acc = 0; ended = false; pointer = null; heroTools = false;
  element<HTMLSelectElement>('hero-select').value = flow.hero;
  refresh();
}
// Detach audio's existing controls so the settings screen can reuse every control.
initAudio(sim);
const audioPanel = root.querySelector<HTMLElement>('aside fieldset') ?? undefined;
audioPanel?.remove();
function renderScreen() {
  showScreen(root, flow, send, sim.round, { range: showRange, motion: reducedMotion, change: (key, value) => {
    if (key === 'range') showRange = value; else reducedMotion = value;
    root.classList.toggle('reduced-motion', reducedMotion);
  } }, audioPanel);
  root.querySelector<HTMLElement>('main')!.inert = flow.screen !== 'game';
  root.querySelector<HTMLElement>('header')!.inert = flow.screen !== 'game';
  if (flow.screen === 'game') start.focus();
}
function send(event: FlowEvent) {
  const before = flow;
  flow = transition(flow, event);
  if (flow === before) return;
  if (event.type === 'restart' || event.type === 'hero') newGame(flow.map, flow.mode);
  if (event.type === 'continue') { sim.rules.winRound = Infinity; sim.won = false; ended = false; }
  if (flow.screen !== 'game') { placing = null; placingHero = null; aiming = false; heroUI.cancel(); acc = 0; }
  renderScreen(); refresh();
}
element<HTMLButtonElement>('menu').addEventListener('click', () => send({ type: 'pause' }));
element<HTMLButtonElement>('settings').addEventListener('click', () => { send({ type: 'pause' }); send({ type: 'settings' }); });
const shopKeys: Record<string, string> = { q: 'dart', w: 'boomerang', e: 'bomb', r: 'tack', t: 'ice', y: 'glue', z: 'sniper', x: 'sub', c: 'buccaneer', v: 'ace', b: 'heli', n: 'mortar', m: 'dartling', a: 'wizard', s: 'super', d: 'ninja', f: 'alchemist', g: 'druid', j: 'farm', k: 'spike', l: 'village', i: 'engineer' };
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (flow.screen !== 'game') { send({ type: 'back' }); return; }
    if (placing || placingHero || aiming) { placingHero = null; heroUI.cancel(); placing = null; aiming = false; pointer = null; }
    else if (selected >= 0 || heroTools) { selected = -1; heroTools = false; }
    else send({ type: 'pause' });
    refresh(); return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
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
  if (e.key.toLowerCase() === 'u') { category = 'Hero'; heroTools = true; refresh(); element<HTMLButtonElement>('hero-place').click(); }
  const kind = shopKeys[e.key.toLowerCase()];
  const card = shopButtons.find(b => b.type === kind);
  if (card && !card.button.disabled && (!sim.rules.allowed || sim.rules.allowed(card.type))) { category = (CATEGORY[kind] ?? 'support').replace(/^./, c => c.toUpperCase()); refresh(); card.button.click(); }
});
function mapPointer(e: PointerEvent) {
  const rect = app.canvas.getBoundingClientRect();
  return worldPoint((e.clientX - rect.left) * app.screen.width / rect.width, (e.clientY - rect.top) * app.screen.height / rect.height, app.screen.width, app.screen.height);
}
app.canvas.tabIndex = 0;
app.canvas.addEventListener('pointermove', e => { pointer = mapPointer(e); });
app.canvas.addEventListener('pointerleave', () => { pointer = null; });
app.canvas.addEventListener('pointerdown', e => {
  if (flow.screen !== 'game') return;
  app.canvas.focus();
  const { x, y } = mapPointer(e);
  if (x < 0 || y < 0 || x > 960 || y > 540) return;
  if (aiming) {
    if (sim.setTarget(selected, { x, y })) { aiming = false; hint.textContent = 'Target point updated.'; }
    refresh(); return;
  }
  if (placingHero) {
    if (sim.placeHero(x, y, placingHero)) { placingHero = null; heroUI.cancel(); hint.textContent = 'Hero placed. Gain XP by completing rounds.'; }
    else hint.textContent = 'Choose a valid location clear of the track, water restrictions, and towers.';
    refresh(); return;
  }
  if(!placing && sim.collectAt({x,y})){refresh();return;}
  const hit = sim.towers.findIndex(t => Math.hypot(t.x - x, t.y - y) < 16);
  if (hit >= 0) { selected = hit; heroTools = false; placing = null; }
  else if (placing) {
    if (!sim.canPlace(x, y, placing)) hint.textContent = `Choose ${TOWERS[placing].waterOnly ? 'water' : 'grass'}, clear of the track and other towers.`;
    else if (sim.placeTower(x, y, placing)) { selected = sim.towers.length - 1; heroTools = false; placing = null; hint.textContent = 'Monkey placed. Select upgrades below.'; }
  } else selected = -1;
  refresh();
});
let lastOptions: string | null = null, lastAim = '';
drawScene(bg, MAPS[mapId] ?? MAPS.monkey_meadow);
function refresh() {
  heroUI.refresh();
  hud.textContent = `Round ${sim.round}/${Number.isFinite(sim.rules.winRound) ? sim.rules.winRound : '∞'}`;
  element('lives').textContent = `♥ ${sim.lives.toLocaleString()}`;
  element('cash').textContent = `$ ${Math.floor(sim.cash).toLocaleString()}`;
  element('autoplay').textContent = `Auto: ${autoplay ? 'On' : 'Off'}`;
  element('autoplay').setAttribute('aria-pressed', String(autoplay));
  element('speed').setAttribute('aria-label', `Speed ×${speed}`);
  element('speed').textContent = `×${speed}`;
  element('categories').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.textContent === category)));
  element('hero-host').hidden = !heroTools;
  element('inspector').hidden = selected < 0 && !heroTools;
  element('inspector').classList.toggle('dock-right', (sim.towers[selected]?.x ?? 960) < 480);
  shopButtons.forEach(card => {
    const { type, button } = card, state = priceBadge(sim.shopPrice(type), sim.cash, sim.gameOver);
    const key = `${state.label}:${placing === type}`;
    if (key !== card.key) { button.innerHTML = `${portrait('tower', type, TOWERS[type].color)}<b>${TOWERS[type].name}</b><span class="price">${state.label}</span>`; card.key = key; }
    button.hidden = (CATEGORY[type] ?? 'support') !== category.toLowerCase() || !!sim.rules.allowed && !sim.rules.allowed(type);
    button.disabled = state.disabled;
    button.classList.toggle('unaffordable', state.unaffordable);
    button.setAttribute('aria-pressed', String(placing === type));
  });
  field.classList.toggle('placing', placing !== null || placingHero !== null || aiming);
  start.disabled = sim.gameOver || !sim.roundActive && !roundGroups(sim.round + 1).length || sim.won && sim.round >= sim.rules.winRound;
  start.textContent = sim.gameOver ? '■' : sim.roundActive ? '»' : '▶';
  start.setAttribute('aria-label', sim.roundActive ? 'Fast forward round' : `Start round ${sim.round + 1}`);
  const options = sim.towers.map((t, i) => `<option value="${i}">${t.degree?PARAGONS[t.type]!.name:TOWERS[t.type].name} ${i + 1} · ${t.degree?'Degree '+t.degree:t.tiers.join('-')}</option>`).join('');
  if (options !== lastOptions) { towerSelect.innerHTML = '<option value="-1">Select a tower</option>' + options; lastOptions = options; }
  towerSelect.value = String(selected);
  const t = sim.towers[selected]; details.hidden = !t || heroTools;
  if (!t) return;
  element<HTMLElement>('tower-title').textContent = `${t.degree?PARAGONS[t.type]!.name:TOWERS[t.type].name} · ${t.degree?'Degree '+t.degree:t.tiers.join('-')}`;
  const portraitKey = t.type;
  if (element('tower-portrait').dataset.kind !== portraitKey) { element('tower-portrait').innerHTML = portrait('tower', t.type, TOWERS[t.type].color); element('tower-portrait').dataset.kind = portraitKey; }
  element('pops').textContent = `Pops: ${Math.floor(t.paragonPops ?? 0).toLocaleString()}`;
  aim.hidden = !sim.canSetTarget(t);
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
  target.textContent = `Target: ${t.targeting}`; target.disabled = sim.gameOver;
  sell.textContent = `Sell · $${sim.sellValue(t)}`; sell.disabled = sim.gameOver || sim.rules.noSell;
  const collect=element<HTMLButtonElement>('collect');collect.hidden=t.type!=='farm' && !(t.type==='engineer' && t.tiers[2]>=4);collect.textContent=t.type==='farm' && t.tiers[1]>=3?`Collect bank · $${(t.bank??0).toFixed(0)}`:t.type==='engineer'?'Collect trap':'Collect bananas';collect.disabled=sim.gameOver;
  element<HTMLElement>('support-controls').hidden=t.type!=='beast' && !(t.type==='engineer' && (t.tiers[1]>=4 || t.degree));
  const allies=sim.towers.map((a,i)=>a!==t && (t.type!=='beast' || a.type==='beast')?`<option value="${i}">${TOWERS[a.type].name} ${i+1} · ${a.tiers.join('-')}</option>`:'').join('');
  if(allySelect.innerHTML!==allies){const value=allySelect.value;allySelect.innerHTML=allies;if([...allySelect.options].some(o=>o.value===value))allySelect.value=value;}
  element<HTMLElement>('support-target').hidden=t.type!=='engineer';
  for(const id of ['merge','merge-path','merge-label'])element<HTMLElement>(id).hidden=t.type!=='beast';
  const paragon=PARAGONS[t.type];element<HTMLElement>('paragon-controls').hidden=!paragon || !!t.degree;
  if(paragon){element<HTMLElement>('paragon-info').textContent=`${paragon.name}: requires all three tier 5 paths; absorbs all ${TOWERS[t.type].name} towers.`;const button=element<HTMLButtonElement>('paragon');button.textContent=`Create ${paragon.name} · $${sim.price(paragon.cost)}`;button.disabled=!sim.canMakeParagon(selected) || sim.cash<sim.price(paragon.cost)+Number(element<HTMLInputElement>('paragon-investment').value);}
  upgradeButtons.forEach((button, path) => {
    const next = TOWERS[t.type].paths[path][t.tiers[path]];
    const allowed = sim.canUpgradeTower(selected,path);
    const cost = next ? sim.upgradePrice(selected, path) : 0;
    const state = upgradeState(!!next, allowed, cost, sim.cash, sim.gameOver);
    const desc = next ? upgradeDescription(t.tiers[path] ? TOWERS[t.type].paths[path][t.tiers[path] - 1].stats : TOWERS[t.type].base, next.stats) : 'Path complete';
    const html = `<span>Path ${path + 1}</span><span class="pips" aria-label="${t.tiers[path]} of 5 tiers">${Array.from({ length: 5 }, (_, i) => `<i class="${i < t.tiers[path] ? 'owned' : ''}"></i>`).join('')}</span><b>${next?.name ?? TOWERS[t.type].paths[path][4].name}</b><small>${desc}</small><span class="price">${next ? '$' + cost : ''} ${state.reason}</span>`;
    if (button.innerHTML !== html) button.innerHTML = html;
    button.disabled = state.disabled;
    button.title = t.tiers[path] ? `Owned: ${TOWERS[t.type].paths[path].slice(0, t.tiers[path]).map(x => x.name).join(', ')}` : 'No upgrades owned';

  });
}
const COL: Record<string, number> = { red: 0xee3333, blue: 0x3399ff, green: 0x33cc33, yellow: 0xeeee33, pink: 0xff88bb, black: 0x222222, white: 0xeeeeee, purple: 0x9933cc, lead: 0x888899, zebra: 0xcccccc, rainbow: 0xff9900, ceramic: 0xbb8855, moab: 0x3366cc };
let acc = 0;
refresh();
root.classList.toggle('reduced-motion', reducedMotion);
renderScreen();
app.ticker.add(t => {
  if (flow.screen !== 'game') return;
  if (autoplay && !sim.roundActive && !sim.gameOver && !sim.won) beginRound();
  acc = Math.min(acc + Math.min(t.deltaMS / 1000, 0.25) * speed, 0.75);
  while (acc >= DT) { sim.step(); acc -= DT; }
  initAudio(sim);
  g.clear();
  const chosen = sim.towers[selected];
  if (!ended && (sim.gameOver || sim.won)) {
    ended = true; const won = sim.won && !sim.gameOver;
    send({ type: won ? 'victory' : 'defeat' });
  }
  if (chosen && sim.canSetTarget(chosen)) {
    const p = chosen.targetPoint; g.circle(p.x, p.y, 8).stroke({ color: 0xffdf66, width: 2 });
    g.moveTo(p.x - 12, p.y).lineTo(p.x + 12, p.y).moveTo(p.x, p.y - 12).lineTo(p.x, p.y + 12).stroke({ color: 0xffdf66, width: 1 });
  }
  if (showRange && chosen && sim.effectiveStats(chosen).range < 1000) g.circle(chosen.x, chosen.y, sim.effectiveStats(chosen).range).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
  if (pointer && (placing || placingHero)) {
    const valid = placing ? sim.canPlace(pointer.x, pointer.y, placing) && sim.cash >= sim.shopPrice(placing) : sim.canPlaceHero(pointer.x, pointer.y, placingHero!) && sim.cash >= HEROES[placingHero!].cost[sim.difficulty];
    const range = placing ? TOWERS[placing].base.range : heroStats(placingHero!, 1).range;
    const color = valid ? 0x9affb0 : 0xff3d46;
    g.circle(pointer.x, pointer.y, Math.min(range, 1000)).fill({ color, alpha: 0.15 }).stroke({ color, width: 2 });
    g.circle(pointer.x, pointer.y, 13).fill({ color, alpha: 0.65 }).stroke({ color: 0x152b32, width: 3 });
  }
  for (const b of sim.bloons) {
    const p = sim.posOf(b); g.ellipse(p.x, p.y, 7, 9).fill(COL[b.type] ?? 0x888888);
    if ((b.frozenUntil ?? 0) > sim.tick) g.ellipse(p.x, p.y, 8, 10).stroke({ color: 0xbbf4ff, width: 2 });
    if (b.glue) g.circle(p.x, p.y + 4, 5).fill({ color: 0xeed34e, alpha: 0.7 });
    if (b.camo) g.circle(p.x - 2, p.y - 2, 3).fill(0x33552b);
    if (b.fortified) g.circle(p.x, p.y, 9).stroke({ color: 0x66432b, width: 2 });
  }
  for (const tower of sim.towers) {
    const t = tower.type === 'ace' || tower.type === 'heli' ? { ...tower, ...tower.flight } : tower;
    if (t !== tower) g.rect(tower.x - 10, tower.y - 10, 20, 20).fill(0x596253);
    g.circle(t.x - 10, t.y, 5).circle(t.x + 10, t.y, 5).fill(0x674020);
    g.circle(t.x, t.y, 12).fill(TOWERS[t.type].color).circle(t.x, t.y + 3, 7).fill(0xe2b67b);
    g.circle(t.x - 4, t.y - 2, 2).circle(t.x + 4, t.y - 2, 2).fill(0x201a16);
    if (tower === chosen) g.circle(t.x, t.y, 16).stroke({ width: 2, color: 0xffdf66 });
  }
  if (sim.hero) {
    const h = sim.hero;
    g.poly([h.x, h.y - 13, h.x + 12, h.y, h.x, h.y + 13, h.x - 12, h.y], true).fill(HEROES[h.kind].color).stroke({ color: 0xffdf66, width: 2 });
    g.circle(h.x - 4, h.y - 1, 2).circle(h.x + 4, h.y - 1, 2).fill(0x172b21);
    for (const asset of h.assets) if (!asset.tower) g.rect(asset.x - 4, asset.y - 4, 8, 8).fill(0xeed34e);
    for (const zone of h.zones) g.circle(zone.point.x, zone.point.y, 9).stroke({ color: 0x9ef2cc, width: 2 });
  }
  for(const banana of sim.collectibles)g.ellipse(banana.x,banana.y,6,3).fill(0xffdf55).stroke({color:0x765714,width:1});
  for(const item of sim.roadItems){const p=sim.posAt(item.dist);g.rect(p.x-4,p.y-4,8,8).fill(item.kind==='foam'?0xeaf5f4:item.kind==='trap'?0xa66b32:0xc6d1db);}
  for(const sentry of sim.sentries)g.rect(sentry.x-5,sentry.y-5,10,10).fill(0xd3b463).stroke({color:0x302a20,width:2});
  for(const tower of sim.towers)if(tower.degree)g.circle(tower.x,tower.y,15).stroke({color:0xd990ff,width:3});
  for (const d of sim.darts) g.circle(d.x, d.y, d.kind === 'bomb' || d.kind === 'boomerang' || d.bounce ? 5 : 2).fill(d.kind === 'glue' ? 0xeed34e : d.kind === 'bomb' ? 0x222222 : 0xffffff);
  for (const e of sim.effects) g.circle(e.x, e.y, e.radius).stroke({ color: e.kind === 'ice' ? 0xbbeeff : 0xffdd77, width: 2, alpha: e.life / 0.2 });
  refresh();
});
