import './screens.css';
import { MAPS, TIERS } from '../maps/maps';
import { sceneSvg } from '../maps/art';
import { MODES } from '../modes/modes';
import { HEROES, type HeroKind } from '../heroes';
import { POWERS, rankProgress, levelUpMM, type Profile, type Settings } from '../meta';
import type { Rewards } from '../ui/meta';
import { portrait } from '../ui/icons';
import type { Flow, FlowEvent } from '../ui/flow';

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const closeOverlay = (root: HTMLElement) => root.querySelector('#overlay')?.remove();
const button = (action: string, label: string, cls = '') => `<button class="${cls}" data-action="${action}">${label}</button>`;

/** Screens own only DOM; navigation and the running simulation stay in main. */
export interface ScreenMeta {
  profile: Profile; settings: Settings; hasRun: boolean; rewards?: Rewards;
  supported: Set<string>; buy: (id: string) => void;
  change: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}
export function showScreen(root: HTMLElement, flow: Flow, send: (event: FlowEvent) => void, round: number, meta: ScreenMeta, audio?: HTMLElement) {
  closeOverlay(root);
  if (flow.screen === 'game') return;
  const o = document.createElement('section'); o.id = 'overlay'; o.className = `overlay screen-${flow.screen}`;
  o.setAttribute('aria-label', `${flow.screen} screen`);
  const back = button('back', '← Back', 'back');
  let title = '', content = '';
  switch (flow.screen) {
    case 'splash': title = 'Monkey Pop TD'; content = `<p class="eyebrow">ORIGINAL TOWER DEFENSE</p><div class="splash-art">${portrait('tower', 'dart', 0xa96935)}${portrait('tower', 'boomerang', 0xb37639)}${portrait('tower', 'wizard', 0x388cb5)}</div><p>Build your team. Defend every lane.</p>${button('start', 'Tap to start', 'big play')}`; break;
    case 'menu': {
      const p = meta.profile, progress = rankProgress(p.xp); title = 'Monkey Pop TD';
      content = `<output class="profile">★ Rank ${p.rank} <span>XP ${p.xp.toLocaleString()} <progress aria-label="Rank XP" value="${progress.into}" max="${Math.max(1, progress.need)}"></progress></span> <b>Monkey Money ${p.mm.toLocaleString()}</b></output><div class="menu-actions">${button('play', '▶ Play', 'big play')}${meta.hasRun ? button('loadRun', 'Continue saved run', 'play') : ''}${button('heroes', 'Heroes')}${button('powers', 'Powers')}${button('settings', '⚙ Settings')}</div>`; break;
    }
    case 'powers': title = 'Powers'; content = `<p>Monkey Money ${meta.profile.mm.toLocaleString()}</p><div class="cards power-store">${POWERS.map(p => `<article><h2>${esc(p.name)}</h2><p>${esc(p.text)}</p><p>Owned: ${meta.profile.powers[p.id] ?? 0}</p><button data-buy="${p.id}" ${!meta.supported.has(p.id) || meta.profile.mm < p.cost ? 'disabled' : ''}>${meta.supported.has(p.id) ? `Buy · ${p.cost} MM` : 'Not implemented'}</button></article>`).join('')}</div>`; break;
    case 'maps': title = 'Choose your map'; content = `<div class="tier-tabs" aria-label="Map tiers">${TIERS.map((t, i) => `<button data-tier="${t}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div><div class="carousel" id="map-cards"></div><p>Swipe or scroll to explore maps</p>`; break;
    case 'difficulty': title = MAPS[flow.map].name; content = `<p>Choose a difficulty</p><div class="cards difficulties">${(['easy', 'medium', 'hard', 'impoppable'] as const).map((d, i) => `<button data-difficulty="${d}"><strong>${['Easy', 'Medium', 'Hard', 'Impoppable'][i]}</strong><small>${['40 rounds · Relaxed start', '60 rounds · A balanced challenge', '80 rounds · A tougher defense', '100 rounds · One life'][i]}</small></button>`).join('')}</div>`; break;
    case 'modes': title = `${MAPS[flow.map].name} · ${flow.difficulty}`; content = `<p>Choose a mode</p><div class="cards modes">${MODES.filter(m => m.difficulty === flow.difficulty || m.sandbox).map(m => `<button data-mode="${m.id}"><strong>${esc(m.name)}</strong><small>${esc(m.blurb)}</small></button>`).join('')}</div>`; break;
    case 'hero': case 'heroes': title = flow.screen === 'hero' ? 'Choose your hero' : 'Meet the heroes'; content = `<p>${flow.screen === 'hero' ? 'Pick a hero, then place them from the Hero shop in battle.' : 'Every hero is available in this build.'}</p><div class="carousel heroes">${(Object.keys(HEROES) as HeroKind[]).map(k => {
      const h = HEROES[k]; return `<article class="hero-card">${portrait('hero', h.name, h.color)}<h2>${esc(h.name)}</h2><p>${esc(h.levels[0].description)}</p><small>Available · $${h.cost[flow.difficulty]}</small>${flow.screen === 'hero' ? `<button data-hero="${k}">Choose ${esc(h.name)}</button>` : ''}</article>`;
    }).join('')}</div>`; break;
    case 'pause': title = 'Game paused'; content = `<p>Round ${round} · ${esc(MAPS[flow.map].name)}</p><div class="menu-actions">${button('resume', '▶ Resume', 'play')}${button('restart', 'Restart')}${button('home', 'Home')}${button('settings', 'Settings')}</div>`; break;
    case 'settings': title = 'Settings'; content = `<div id="audio-settings"></div><label class="setting"><input id="fast-forward" type="checkbox" ${meta.settings.fastForward ? 'checked' : ''}> Fast-forward default</label><label class="setting"><input id="default-autoplay" type="checkbox" ${meta.settings.autoplay ? 'checked' : ''}> Autoplay default</label><label class="setting"><input id="show-range" type="checkbox" ${meta.settings.showRange ? 'checked' : ''}> Show tower range</label><label class="setting"><input id="reduce-motion" type="checkbox" ${meta.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label><p>Space: start / speed · Escape: back / pause<br>Comma / period / slash: upgrade · Backspace: sell</p>`; break;
    case 'victory': case 'defeat': title = flow.screen === 'victory' ? 'Victory!' : 'Defeat'; content = `<p class="result">Round reached <strong>${round}</strong></p><div class="rewards" role="status">${meta.rewards ? `<p>XP gained: ${meta.rewards.xp.toLocaleString()} · MM gained: ${meta.rewards.mm.toLocaleString()}</p>${meta.rewards.levelUps.map(rank => `<p class="rank-toast">★ Rank up! ${rank} · +${levelUpMM(rank)} MM</p>`).join('')}` : ''}</div><div class="menu-actions">${flow.screen === 'victory' ? button('continue', 'Keep playing · Endless', 'play') : ''}${button('restart', 'Restart')}${button('home', 'Home')}</div>`; break;
  }
  o.innerHTML = `<div class="screen-panel">${flow.screen === 'splash' ? '' : back}<h1>${esc(title)}</h1>${content}</div>`;
  root.appendChild(o);
  o.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.onclick = () => send({ type: b.dataset.action as 'back' }));
  const bind = (selector: string, action: (b: HTMLButtonElement) => FlowEvent) => o.querySelectorAll<HTMLButtonElement>(selector).forEach(b => b.onclick = () => send(action(b)));
  bind('[data-difficulty]', b => ({ type: 'difficulty', id: b.dataset.difficulty as Flow['difficulty'] }));
  bind('[data-mode]', b => ({ type: 'mode', id: b.dataset.mode! }));
  bind('[data-hero]', b => ({ type: 'hero', id: b.dataset.hero as HeroKind }));
  o.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => meta.buy(b.dataset.buy!));
  if (flow.screen === 'maps') {
    const renderMaps = (tier: string) => {
      o.querySelector('#map-cards')!.innerHTML = Object.values(MAPS).filter(m => m.tier === tier).map(m => `<button class="map-card" data-map="${m.id}">${sceneSvg(m)}<strong>${esc(m.name)}</strong><small>${m.lanes.length} lane${m.lanes.length > 1 ? 's' : ''}${m.water.length ? ' · Water' : ''}</small></button>`).join('');
      bind('[data-map]', b => ({ type: 'map', id: b.dataset.map! }));
      o.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tier === tier)));
    };
    o.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach(b => b.onclick = () => renderMaps(b.dataset.tier!));
    renderMaps(MAPS[flow.map].tier);
  }
  if (flow.screen === 'settings') {
    if (audio) o.querySelector('#audio-settings')!.appendChild(audio);
    for (const [id, key] of [['show-range', 'showRange'], ['reduce-motion', 'reducedMotion'], ['fast-forward', 'fastForward'], ['default-autoplay', 'autoplay']] as const) {
      const input = o.querySelector<HTMLInputElement>(`#${id}`)!; input.onchange = () => meta.change(key, input.checked);
    }
  }
  if (flow.screen === 'splash') o.onclick = () => send({ type: 'start' });
  o.querySelector<HTMLButtonElement>(flow.screen === 'hero' ? '[data-hero]' : 'button')?.focus();
}
