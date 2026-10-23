import { Application, Graphics } from 'pixi.js';
import { Sim, DT, roundGroups, type Difficulty } from './sim';
import { canUpgrade, TOWERS, type TowerKind } from './towers';
import { fitWorld, worldPoint } from './viewport';
import './style.css';
import { heroControls } from './hero-ui';
import { HEROES, type HeroKind } from './heroes';
import { DEFAULT_MAP } from './map';

const { path, water } = DEFAULT_MAP;
let sim = new Sim(path, 'medium', water);
let selected = -1, placing: TowerKind | null = null, speed = 1, aiming = false;
let placingHero: HeroKind | null = null;
const root = document.getElementById('app')!;
root.innerHTML = `
  <header><h1>Monkey Pop TD</h1><output id="hud" aria-label="Game status"></output></header>
  <main><section id="field" aria-label="Tower defense map"></section>
  <aside aria-label="Tower controls">
    <label for="difficulty">Difficulty</label>
    <select id="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option><option value="impoppable">Impoppable</option></select>
    <div id="shop" aria-label="Tower shop"></div>
    <p id="hint" role="status">Buy a monkey, then choose a spot on the map.</p>
    <label for="tower-select">Select a tower</label><select id="tower-select"><option value="-1">No towers placed</option></select>
    <section id="details" hidden><h2 id="tower-title">Dart Monkey</h2>
      <button id="aim" hidden>Set target on map</button><div id="target-point" hidden><label for="aim-x">Target X</label><input id="aim-x" type="number" min="0" max="960"><label for="aim-y">Target Y</label><input id="aim-y" type="number" min="0" max="540"><button id="apply-aim">Apply target coordinates</button></div><button id="target">Target: First</button><button id="ability" hidden>Activate ability</button><div id="upgrades"></div><button id="sell">Sell</button>
    </section>
    <div class="round-controls"><button id="start">Start round 1</button><button id="speed">Speed ×1</button></div>
  </aside></main>`;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hud = element<HTMLOutputElement>('hud');
const field = element<HTMLElement>('field');
const hint = element<HTMLParagraphElement>('hint');
const shop = element<HTMLElement>('shop');
const shopButtons = (Object.keys(TOWERS) as TowerKind[]).map(type => {
  const button = document.createElement('button');
  button.addEventListener('click', () => {
    placingHero = null; heroUI.cancel(); aiming = false; placing = placing === type ? null : type;
    hint.textContent = placing ? `Click on ${TOWERS[type].waterOnly ? 'water' : 'grass'} to place your ${TOWERS[type].name}. Escape cancels.` : 'Placement cancelled.';
    refresh();
  });
  shop.appendChild(button); return { type, button };
});
const heroUI = heroControls(root.querySelector('aside')!, () => sim, () => selected, kind => {
  placingHero = kind; placing = null; aiming = false; refresh();
}, message => { hint.textContent = message; });
const start = element<HTMLButtonElement>('start');
const towerSelect = element<HTMLSelectElement>('tower-select');
const difficulty = element<HTMLSelectElement>('difficulty');
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
  button.addEventListener('click', () => { sim.upgrade(selected, path); refresh(); });
  upgrades.appendChild(button); return button;
});
const app = new Application();
await app.init({ width: 960, height: 540, background: '#182b21', antialias: true });
field.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', 'Map: buy a monkey and click to place it; use Select a tower to manage monkeys');
const g = new Graphics(); app.stage.addChild(g);
function resizeMap() {
  const width = Math.max(1, field.clientWidth), height = Math.max(1, field.clientHeight);
  app.renderer.resize(width, height);
  const fit = fitWorld(width, height);
  app.stage.scale.set(fit.scale); app.stage.position.set(fit.x, fit.y);
}
new ResizeObserver(resizeMap).observe(field);
resizeMap();
function beginRound() { sim.startRound(roundGroups(sim.round + 1)); refresh(); }
start.addEventListener('click', beginRound);
element<HTMLButtonElement>('speed').addEventListener('click', e => {
  speed = speed % 3 + 1; (e.currentTarget as HTMLButtonElement).textContent = `Speed ×${speed}`;
});
target.addEventListener('click', () => { sim.cycleTargeting(selected); refresh(); });
sell.addEventListener('click', () => { if (sim.sell(selected)) selected = -1; refresh(); });
towerSelect.addEventListener('change', () => { selected = Number(towerSelect.value); placing = null; aiming = false; refresh(); });
difficulty.addEventListener('change', () => {
  sim = new Sim(path, difficulty.value as Difficulty, water); placingHero = null; heroUI.cancel(); selected = -1; placing = null; aiming = false; acc = 0; refresh();
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { placingHero = null; heroUI.cancel(); placing = null; aiming = false; refresh(); }
  if (e.code === 'Space' && (e.target === document.body || e.target === app.canvas)) { e.preventDefault(); beginRound(); }
});
app.canvas.addEventListener('pointerdown', e => {
  const rect = app.canvas.getBoundingClientRect();
  const { x, y } = worldPoint((e.clientX - rect.left) * app.screen.width / rect.width,
    (e.clientY - rect.top) * app.screen.height / rect.height, app.screen.width, app.screen.height);
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
  const hit = sim.towers.findIndex(t => Math.hypot(t.x - x, t.y - y) < 16);
  if (hit >= 0) { selected = hit; placing = null; }
  else if (placing) {
    if (!sim.canPlace(x, y, placing)) hint.textContent = `Choose ${TOWERS[placing].waterOnly ? 'water' : 'grass'}, clear of the track and other towers.`;
    else if (sim.placeTower(x, y, placing)) { selected = sim.towers.length - 1; placing = null; hint.textContent = 'Monkey placed. Select upgrades below.'; }
  } else selected = -1;
  refresh();
});
let lastOptions = '', lastAim = '';
function refresh() {
  heroUI.refresh();
  hud.textContent = `$${sim.cash.toFixed(0)} · Lives ${sim.lives} · Round ${sim.round}${sim.gameOver ? ' · Game over' : ''}`;
  shopButtons.forEach(({ type, button }) => {
    button.textContent = `${placing === type ? 'Cancel' : TOWERS[type].name} · $${sim.price(TOWERS[type].cost)}`;
    button.disabled = sim.gameOver || (placing !== type && sim.cash < sim.price(TOWERS[type].cost));
    button.setAttribute('aria-pressed', String(placing === type));
  });
  field.classList.toggle('placing', placing !== null || placingHero !== null || aiming);
  difficulty.disabled = sim.roundActive || !!sim.hero || sim.towers.length > 0 || sim.round > (sim.difficulty === 'impoppable' ? 5 : 0);
  start.disabled = sim.roundActive || sim.gameOver || !roundGroups(sim.round + 1).length;
  start.textContent = sim.gameOver ? 'Game over' : sim.roundActive ? `Round ${sim.round} running` : `Start round ${sim.round + 1}`;
  const options = sim.towers.map((t, i) => `<option value="${i}">${TOWERS[t.type].name} ${i + 1} · ${t.tiers.join('-')}</option>`).join('');
  if (options !== lastOptions) { towerSelect.innerHTML = '<option value="-1">Select a tower</option>' + options; lastOptions = options; }
  towerSelect.value = String(selected);
  const t = sim.towers[selected]; details.hidden = !t;
  if (!t) return;
  element<HTMLElement>('tower-title').textContent = `${TOWERS[t.type].name} · ${t.tiers.join('-')}`;
  aim.hidden = !['mortar', 'heli', 'dartling', 'ace'].includes(t.type);
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
  sell.textContent = `Sell · $${Math.floor(t.cost * 70 / 100)}`; sell.disabled = sim.gameOver;
  upgradeButtons.forEach((button, path) => {
    const next = TOWERS[t.type].paths[path][t.tiers[path]];
    const allowed = canUpgrade(t.tiers, path);
    button.textContent = next ? `Path ${path + 1}: ${next.name} · $${sim.towerPrice(t.type, next.cost, t, t.tiers[path] + 1)}${allowed ? '' : ' · Locked'}` : `Path ${path + 1}: ${TOWERS[t.type].paths[path][4].name} · Max`;
    button.disabled = sim.gameOver || !allowed || !next || sim.cash < sim.towerPrice(t.type, next.cost, t, t.tiers[path] + 1);
  });
}
const COL: Record<string, number> = { red: 0xee3333, blue: 0x3399ff, green: 0x33cc33, yellow: 0xeeee33, pink: 0xff88bb, black: 0x222222, white: 0xeeeeee, purple: 0x9933cc, lead: 0x888899, zebra: 0xcccccc, rainbow: 0xff9900, ceramic: 0xbb8855, moab: 0x3366cc };
let acc = 0;
refresh();
app.ticker.add(t => {
  acc = Math.min(acc + Math.min(t.deltaMS / 1000, 0.25) * speed, 0.75);
  while (acc >= DT) { sim.step(); acc -= DT; }
  g.clear().rect(0, 0, 960, 540).fill(0x4a8f3c).poly(path.flatMap(p => [p.x, p.y]), false).stroke({ width: 40, color: 0xc9a66b });
  const chosen = sim.towers[selected];
  for (const w of water) g.rect(w.x, w.y, w.width, w.height).fill(0x388fc1).stroke({ color: 0x92d3ee, width: 2 });
  if (chosen && ['mortar', 'heli', 'dartling', 'ace'].includes(chosen.type)) {
    const p = chosen.targetPoint; g.circle(p.x, p.y, 8).stroke({ color: 0xffdf66, width: 2 });
    g.moveTo(p.x - 12, p.y).lineTo(p.x + 12, p.y).moveTo(p.x, p.y - 12).lineTo(p.x, p.y + 12).stroke({ color: 0xffdf66, width: 1 });
  }
  if (chosen && chosen.range < 1000) g.circle(chosen.x, chosen.y, chosen.range).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
  for (const b of sim.bloons) {
    const p = sim.posAt(b.dist); g.ellipse(p.x, p.y, 7, 9).fill(COL[b.type] ?? 0x888888);
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
  for (const d of sim.darts) g.circle(d.x, d.y, d.kind === 'bomb' || d.kind === 'boomerang' || d.bounce ? 5 : 2).fill(d.kind === 'glue' ? 0xeed34e : d.kind === 'bomb' ? 0x222222 : 0xffffff);
  for (const e of sim.effects) g.circle(e.x, e.y, e.radius).stroke({ color: e.kind === 'ice' ? 0xbbeeff : 0xffdd77, width: 2, alpha: e.life / 0.2 });
  refresh();
});
