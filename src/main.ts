import { Application, Graphics } from 'pixi.js';
import { Sim, DT, roundGroups, type Difficulty } from './sim';
import { canUpgrade, DART_TIERS } from './towers/dart';
import './style.css';

const path = [{ x: 0, y: 150 }, { x: 700, y: 150 }, { x: 700, y: 450 }, { x: 200, y: 450 }, { x: 200, y: 300 }, { x: 960, y: 300 }];
let sim = new Sim(path);
let selected = -1, placing = false, speed = 1;
const root = document.getElementById('app')!;
root.innerHTML = `
  <header><h1>Monkey Pop TD</h1><output id="hud" aria-label="Game status"></output></header>
  <main><section id="field" aria-label="Tower defense map"></section>
  <aside aria-label="Tower controls">
    <label for="difficulty">Difficulty</label>
    <select id="difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option><option value="impoppable">Impoppable</option></select>
    <button id="shop">Dart Monkey · $200</button>
    <p id="hint" role="status">Buy a monkey, then choose a spot on the map.</p>
    <label for="tower-select">Select a tower</label><select id="tower-select"><option value="-1">No towers placed</option></select>
    <section id="details" hidden><h2 id="tower-title">Dart Monkey</h2>
      <button id="target">Target: First</button><div id="upgrades"></div><button id="sell">Sell</button>
    </section>
    <div class="round-controls"><button id="start">Start round 1</button><button id="speed">Speed ×1</button></div>
  </aside></main>`;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hud = element<HTMLOutputElement>('hud');
const field = element<HTMLElement>('field');
const hint = element<HTMLParagraphElement>('hint');
const shop = element<HTMLButtonElement>('shop');
const start = element<HTMLButtonElement>('start');
const towerSelect = element<HTMLSelectElement>('tower-select');
const difficulty = element<HTMLSelectElement>('difficulty');
const details = element<HTMLElement>('details');
const target = element<HTMLButtonElement>('target');
const sell = element<HTMLButtonElement>('sell');
const upgrades = element<HTMLElement>('upgrades');
const upgradeButtons = [0, 1, 2].map(path => {
  const button = document.createElement('button');
  button.addEventListener('click', () => { sim.upgrade(selected, path); refresh(); });
  upgrades.appendChild(button); return button;
});
const app = new Application();
await app.init({ width: 960, height: 540, background: '#4a8f3c', antialias: true });
field.appendChild(app.canvas);
app.canvas.setAttribute('aria-label', 'Map: buy a monkey and click to place it; use Select a tower to manage monkeys');
const g = new Graphics(); app.stage.addChild(g);
function beginRound() { sim.startRound(roundGroups(sim.round + 1)); refresh(); }
shop.addEventListener('click', () => {
  placing = !placing;
  hint.textContent = placing ? 'Click on grass to place your Dart Monkey. Escape cancels.' : 'Placement cancelled.';
  refresh();
});
start.addEventListener('click', beginRound);
element<HTMLButtonElement>('speed').addEventListener('click', e => {
  speed = speed % 3 + 1; (e.currentTarget as HTMLButtonElement).textContent = `Speed ×${speed}`;
});
target.addEventListener('click', () => { sim.cycleTargeting(selected); refresh(); });
sell.addEventListener('click', () => { if (sim.sell(selected)) selected = -1; refresh(); });
towerSelect.addEventListener('change', () => { selected = Number(towerSelect.value); placing = false; refresh(); });
difficulty.addEventListener('change', () => {
  sim = new Sim(path, difficulty.value as Difficulty); selected = -1; placing = false; acc = 0; refresh();
});
addEventListener('keydown', e => {
  if (e.key === 'Escape') { placing = false; refresh(); }
  if (e.code === 'Space' && (e.target === document.body || e.target === app.canvas)) { e.preventDefault(); beginRound(); }
});
function onTrack(x: number, y: number) {
  return path.slice(1).some((b, i) => {
    const a = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - a.x - dx * t, y - a.y - dy * t) < 30;
  });
}
app.canvas.addEventListener('pointerdown', e => {
  const rect = app.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * 960 / rect.width, y = (e.clientY - rect.top) * 540 / rect.height;
  const hit = sim.towers.findIndex(t => Math.hypot(t.x - x, t.y - y) < 16);
  if (hit >= 0) { selected = hit; placing = false; }
  else if (placing) {
    if (onTrack(x, y) || x < 14 || y < 14 || x > 946 || y > 526) hint.textContent = 'Choose a spot on grass, clear of the track.';
    else if (sim.addTower(x, y)) { selected = sim.towers.length - 1; placing = false; hint.textContent = 'Monkey placed. Select upgrades below.'; }
  } else selected = -1;
  refresh();
});
let lastOptions = '';
function refresh() {
  hud.textContent = `$${sim.cash.toFixed(0)} · Lives ${sim.lives} · Round ${sim.round}${sim.gameOver ? ' · Game over' : ''}`;
  shop.textContent = `${placing ? 'Cancel placement' : 'Dart Monkey'} · $${sim.price(200)}`;
  shop.disabled = sim.gameOver || (!placing && sim.cash < sim.price(200));
  shop.setAttribute('aria-pressed', String(placing));
  field.classList.toggle('placing', placing);
  difficulty.disabled = sim.roundActive || sim.towers.length > 0 || sim.round > (sim.difficulty === 'impoppable' ? 5 : 0);
  start.disabled = sim.roundActive || sim.gameOver || !roundGroups(sim.round + 1).length;
  start.textContent = sim.gameOver ? 'Game over' : sim.roundActive ? `Round ${sim.round} running` : `Start round ${sim.round + 1}`;
  const options = sim.towers.map((t, i) => `<option value="${i}">Monkey ${i + 1} · ${t.tiers.join('-')}</option>`).join('');
  if (options !== lastOptions) { towerSelect.innerHTML = '<option value="-1">Select a tower</option>' + options; lastOptions = options; }
  towerSelect.value = String(selected);
  const t = sim.towers[selected]; details.hidden = !t;
  if (!t) return;
  element<HTMLElement>('tower-title').textContent = `Dart Monkey · ${t.tiers.join('-')}`;
  target.textContent = `Target: ${t.targeting}`; target.disabled = sim.gameOver;
  sell.textContent = `Sell · $${Math.floor(t.cost * 70 / 100)}`; sell.disabled = sim.gameOver;
  upgradeButtons.forEach((button, path) => {
    const next = DART_TIERS[path][t.tiers[path]];
    const allowed = canUpgrade(t.tiers, path);
    button.textContent = next ? `Path ${path + 1}: ${next.name} · $${sim.price(next.cost)}${allowed ? '' : ' · Locked'}` : `Path ${path + 1}: ${DART_TIERS[path][4].name} · Max`;
    button.disabled = sim.gameOver || !allowed || !next || sim.cash < sim.price(next.cost);
  });
}
const COL: Record<string, number> = { red: 0xee3333, blue: 0x3399ff, green: 0x33cc33, yellow: 0xeeee33, pink: 0xff88bb, black: 0x222222, white: 0xeeeeee, purple: 0x9933cc, lead: 0x888899, zebra: 0xcccccc, rainbow: 0xff9900, ceramic: 0xbb8855, moab: 0x3366cc };
let acc = 0;
refresh();
app.ticker.add(t => {
  acc = Math.min(acc + Math.min(t.deltaMS / 1000, 0.25) * speed, 0.75);
  while (acc >= DT) { sim.step(); acc -= DT; }
  g.clear().poly(path.flatMap(p => [p.x, p.y]), false).stroke({ width: 40, color: 0xc9a66b });
  const chosen = sim.towers[selected];
  if (chosen) g.circle(chosen.x, chosen.y, chosen.range).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ color: 0xffffff, alpha: 0.7, width: 1 });
  for (const b of sim.bloons) {
    const p = sim.posAt(b.dist); g.ellipse(p.x, p.y, 7, 9).fill(COL[b.type] ?? 0x888888);
    if (b.camo) g.circle(p.x - 2, p.y - 2, 3).fill(0x33552b);
    if (b.fortified) g.circle(p.x, p.y, 9).stroke({ color: 0x66432b, width: 2 });
  }
  for (const t of sim.towers) {
    g.circle(t.x - 10, t.y, 5).circle(t.x + 10, t.y, 5).fill(0x674020);
    g.circle(t.x, t.y, 12).fill(0x8a5a2b).circle(t.x, t.y + 3, 7).fill(0xe2b67b);
    g.circle(t.x - 4, t.y - 2, 2).circle(t.x + 4, t.y - 2, 2).fill(0x201a16);
    if (t === chosen) g.circle(t.x, t.y, 16).stroke({ width: 2, color: 0xffdf66 });
  }
  for (const d of sim.darts) g.circle(d.x, d.y, d.bounce ? 5 : 2).fill(d.bounce ? 0x333333 : 0xffffff);
  refresh();
});
