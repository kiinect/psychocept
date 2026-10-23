// Menu screens as full-screen scenes laid out like BTD6 (owner's reference screenshots); original art and wording.
import './screens.css';
import { MAPS, TIERS } from '../maps/maps';
import { sceneSvg } from '../maps/art';
import { MODES } from '../modes/modes';
import { HEROES, type HeroKind } from '../heroes';
import { POWERS, powerPrice, rankProgress, levelUpMM, winMM, type Profile, type Settings } from '../meta';
import type { Rewards } from '../ui/meta';
import { portrait } from '../ui/icons';
import type { Flow, FlowEvent } from '../ui/flow';
import { renderKnowledge, type KnowledgeActions } from './knowledge';
import { KNOWLEDGE, TREES, type KnowledgeTree } from '../knowledge';
import type { Difficulty } from '../sim';
import type { LobbyState } from '../net/session';

/** What the co-op screens need from main's Session (kept as a plain view so screens stay DOM-only). */
export interface CoopView {
  name: string; code: string; status: 'idle' | 'connecting' | 'lobby' | 'game' | 'closed'; error: string; host: boolean; myId: string;
  lobby: LobbyState; canStart: boolean; ready: boolean;
  setName(n: string): void; create(): void; join(code: string): void; leave(): void; setReady(r: boolean): void;
  configure(c: Partial<Omit<LobbyState, 'players'>>): void; start(): void;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const closeOverlay = (root: HTMLElement) => root.querySelector('#overlay')?.remove();
const button = (action: string, label: string, cls = '') => `<button class="${cls}" data-action="${action}">${label}</button>`;
/** Big round menu button with an emblem and a caption under it. */
const round = (action: string, emblem: string, label: string, cls = '') => `<button class="round-btn ${cls}" data-action="${action}"><span class="emblem" aria-hidden="true">${emblem}</span><span class="cap">${label}</span></button>`;
const DIFF: Record<Difficulty, { name: string; blurb: string; emblem: string }> = {
  easy: { name: 'Easy', blurb: 'Monkeys cost less, bloons move a little slower, 200 lives. Beat round 40 for a bronze medal.', emblem: '🍼' },
  medium: { name: 'Medium', blurb: 'Normal prices and speed, 150 lives. Beat round 60 for a silver medal.', emblem: '⛑' },
  hard: { name: 'Hard', blurb: 'Monkeys cost more, you start at round 3, bloons are faster, 100 lives. Beat round 80 for a gold medal.', emblem: '☠' },
  impoppable: { name: 'Impoppable', blurb: 'Pricier monkeys, one life, rounds 6 to 100. Only for the bravest.', emblem: '💀' },
};
const TREE_NAME: Record<KnowledgeTree, string> = { primary: 'Primary', military: 'Military', magic: 'Magic', support: 'Support', heroes: 'Heroes', powers: 'Powers' };
const TREE_EMBLEM: Record<KnowledgeTree, string> = { primary: '🎯', military: '🎖', magic: '🔮', support: '🔧', heroes: '⭐', powers: '⚡' };

/** View state that survives re-renders (learning a point, buying a power, paging maps). */
const view: { tree: KnowledgeTree; pick?: string; mkTree: boolean; hero?: HeroKind; power?: string; mapPage: number; tier?: string } = { tree: 'primary', mkTree: false, mapPage: 0 };
export interface ScreenMeta {
  profile: Profile; settings: Settings; hasRun: boolean; rewards?: Rewards;
  supported: Set<string>; buy: (id: string) => void; knowledge: KnowledgeActions;
  change: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  coop: CoopView;
  account?: { open(): void; label: string };
}
const MAPS_PER_PAGE = 6;

export function showScreen(root: HTMLElement, flow: Flow, send: (event: FlowEvent) => void, roundNo: number, meta: ScreenMeta, audio?: HTMLElement) {
  closeOverlay(root);
  if (flow.screen === 'game') return;
  const p = meta.profile;
  const o = document.createElement('section'); o.id = 'overlay'; o.className = `overlay screen-${flow.screen}`;
  o.setAttribute('aria-label', `${flow.screen} screen`);
  const back = `<button class="back-btn" data-action="back" aria-label="Back">↩</button>`;
  const money = `<output class="mm-pill" aria-label="Monkey Money">${p.mm.toLocaleString()}</output>`;
  const plank = (t: string) => `<h1 class="plank">${esc(t)}</h1>`;
  let html = '';
  switch (flow.screen) {
    case 'splash':
      html = `<div class="splash"><h1 class="logo">Monkey Pop TD</h1><p class="eyebrow">ORIGINAL TOWER DEFENSE</p><div class="splash-art">${portrait('tower', 'dart', 0xa96935)}${portrait('tower', 'boomerang', 0xb37639)}${portrait('tower', 'wizard', 0x388cb5)}</div>${button('start', 'Tap to start', 'big play')}</div>`; break;
    case 'menu': {
      const prog = rankProgress(p.xp), hero = HEROES[flow.hero];
      html = `<div class="profile-card"><span class="rank-badge">${p.rank}</span><div><progress aria-label="Rank XP" value="${prog.into}" max="${Math.max(1, prog.need)}"></progress><small>${prog.into.toLocaleString()} / ${prog.need.toLocaleString()} XP</small><b>Monkey</b></div></div>${money}
        <button class="side-btn" data-action="settings" aria-label="Settings">⚙</button>
        ${meta.account ? `<button class="account-menu" id="account-open">${esc(meta.account.label)}</button>` : ''}
        <div class="menu-stage">${portrait('hero', hero.name, hero.color)}</div>
        ${meta.hasRun ? `<button class="continue-banner" data-action="loadRun"><span>💾</span><b>Continue saved game?</b></button>` : ''}
        <nav class="menu-row" aria-label="Main menu">${round('heroes', '⭐', 'Heroes')}${round('knowledge', '📘', 'Knowledge')}${round('play', '▶', 'Play', 'play-big')}${round('social', '🤝', 'Co-op')}${round('powers', '⚡', 'Powers')}${round('settings', '⚙', 'Settings')}</nav>`; break;
    }
    case 'maps': {
      const tier = view.tier && TIERS.includes(view.tier) ? view.tier : MAPS[flow.map].tier; view.tier = tier;
      const list = Object.values(MAPS).filter(m => m.tier === tier), pages = Math.max(1, Math.ceil(list.length / MAPS_PER_PAGE));
      view.mapPage = Math.min(view.mapPage, pages - 1);
      const page = list.slice(view.mapPage * MAPS_PER_PAGE, (view.mapPage + 1) * MAPS_PER_PAGE);
      const medal = (id: string) => (['easy', 'medium', 'hard', 'impoppable'] as const).filter(d => p.wins.includes(`${id}:${d}`)).map(d => `<i class="medal ${d}" title="${DIFF[d].name} medal"></i>`).join('');
      html = `${back}<div class="map-pager"><button class="pg prev" aria-label="Previous page" ${view.mapPage ? '' : 'disabled'}>◀</button>
        <div class="map-grid">${page.map(m => `<button class="map-card" data-map="${m.id}"><strong>${esc(m.name)}</strong>${sceneSvg(m)}<span class="medals">${medal(m.id)}</span></button>`).join('')}</div>
        <button class="pg next" aria-label="Next page" ${view.mapPage < pages - 1 ? '' : 'disabled'}>▶</button></div>
        <div class="dots">${Array.from({ length: pages }, (_, i) => `<i class="${i === view.mapPage ? 'on' : ''}"></i>`).join('')}</div>
        <nav class="tier-row" aria-label="Map difficulty">${TIERS.map(t => `<button class="round-btn tier ${t === tier ? 'on' : ''}" data-tier="${t}" aria-pressed="${t === tier}"><span class="emblem">${['🌱', '🌿', '🌋', '💀'][TIERS.indexOf(t)]}</span><span class="cap">${t}</span></button>`).join('')}</nav>`; break;
    }
    case 'difficulty': {
      const md = Math.max(0, TIERS.indexOf(MAPS[flow.map].tier));
      html = `${back}${plank(MAPS[flow.map].name)}<div class="diff-row">${(['easy', 'medium', 'hard', 'impoppable'] as const).map(d => `<button class="diff-pick" data-difficulty="${d}"><span class="emblem">${DIFF[d].emblem}</span><b>${DIFF[d].name}</b><small>Rewards</small><span class="reward">${winMM(d, md).toLocaleString()}</span></button>`).join('')}</div>`; break;
    }
    case 'modes': {
      const list = MODES.filter(m => m.difficulty === flow.difficulty || m.sandbox), std = list.find(m => m.id === flow.difficulty) ?? list[0], rest = list.filter(m => m !== std);
      const node = (m: typeof list[number], cls = '') => `<button class="mode-node ${cls}" data-mode="${m.id}"><span class="emblem">${m.sandbox ? '🏖' : m === std ? '▶' : m.chimps ? '🐒' : m.deflation ? '📉' : m.reverse ? '⏪' : m.apopalypse ? '☢' : m.only ? '🎯' : '★'}</span><b>${esc(m.sandbox ? 'Sandbox' : m === std ? 'Standard' : m.name)}</b><small>${esc(m.blurb)}</small></button>`;
      html = `${back}${plank(DIFF[flow.difficulty].name)}<p class="lede">${esc(DIFF[flow.difficulty].blurb)}</p><div class="mode-graph">${node(std, 'std')}<span class="chev" aria-hidden="true">❯</span><div class="mode-rest">${rest.map(m => node(m)).join('')}</div></div>`; break;
    }
    case 'hero': case 'heroes': {
      const kinds = Object.keys(HEROES) as HeroKind[], pick = view.hero && HEROES[view.hero] ? view.hero : flow.hero, h = HEROES[pick];
      html = `${back}<div class="hero-gallery"><div class="hero-grid" role="listbox" aria-label="Heroes">${kinds.map(k => `<button class="hero-tile ${k === pick ? 'on' : ''}" data-preview="${k}" role="option" aria-selected="${k === pick}" aria-label="${esc(HEROES[k].name)}">${portrait('hero', HEROES[k].name, HEROES[k].color)}</button>`).join('')}</div>
        <div class="hero-show"><h1 class="hero-name">${esc(h.name)}</h1><div class="hero-art">${portrait('hero', h.name, h.color)}</div>
          ${flow.screen === 'hero' ? `<button class="big play" data-hero="${pick}">Select ${esc(h.name)}</button>` : `<p class="selected">${pick === flow.hero ? 'Selected' : 'Available'}</p>`}
          <small class="cost">In-game cost: $${h.cost[flow.difficulty].toLocaleString()}</small>
          <ol class="hero-levels">${h.levels.slice(0, 3).map((l, i) => `<li><b>${i + 1}</b>${esc(l.description)}</li>`).join('')}</ol></div></div>`; break;
    }
    case 'knowledge': {
      if (!view.mkTree) {
        html = `${back}${plank('Monkey Knowledge')}${money}<div class="mk-cards">${TREES.map(t => `<button class="mk-card" data-mktree="${t}"><span class="emblem">${TREE_EMBLEM[t]}</span><b>${TREE_NAME[t]}</b><span class="count">${p.mk.filter(n => KNOWLEDGE.find(k => k.name === n)?.tree === t).length}/${KNOWLEDGE.filter(k => k.tree === t).length}</span></button>`).join('')}</div>
          <label class="mk-toggle"><input type="checkbox" id="mk-on" ${p.mkOn ? 'checked' : ''}> Enable Monkey Knowledge</label><button class="mk-respec" id="mk-respec">Respec all · 2,000</button>`;
      } else html = `<button class="back-btn" id="mk-up" aria-label="Back to knowledge trees">↩</button><div id="mk-host"></div>`;
      break;
    }
    case 'powers': {
      // Only powers that work in this game are sold (the wiki list also has event/collab items).
      const sold = POWERS.filter(x => meta.supported.has(x.id)), pick = sold.find(x => x.id === view.power) ?? sold[0];
      html = `${back}${money}<div class="store"><div class="hex-grid">${sold.map(x => `<button class="hex big-hex ${x === pick ? 'on' : ''}" data-power="${x.id}" aria-label="${esc(x.name)}"><span>${esc(x.name)}</span>${p.powers[x.id] ? `<b>${p.powers[x.id]}</b>` : ''}</button>`).join('')}</div>
        <article class="power-detail"><h2>${esc(pick.name)}</h2><p>${esc(pick.text)}</p><p class="owned">You have: ${p.powers[pick.id] ?? 0}</p>
        <button class="big play" data-buy="${pick.id}" ${!meta.supported.has(pick.id) || p.mm < powerPrice(p, pick.id) ? 'disabled' : ''}>${meta.supported.has(pick.id) ? `Add for ${powerPrice(p, pick.id).toLocaleString()}` : 'Not available yet'}</button></article></div>`; break;
    }
    case 'social': {
      const c = meta.coop;
      html = `${back}${plank('Play Social')}<div class="social"><label class="coop-name">Your name <input id="coop-name" maxlength="16" value="${esc(c.name)}"></label>
        <section class="social-box"><h2>Co-op</h2><div class="social-row">${round('', '🐵', 'Create match').replace('data-action=""', 'id="coop-create"')}
          <form id="coop-join" class="join"><label for="coop-code">Join with a code</label><input id="coop-code" maxlength="6" autocomplete="off" placeholder="ABC123" pattern="[A-Za-z2-9]{6}" required><button class="play">Join match</button></form></div>
          <p class="coop-status" role="status">${c.status === 'connecting' ? 'Connecting…' : esc(c.error)}</p></section></div>`; break;
    }
    case 'lobby': {
      const c = meta.coop, L = c.lobby, m = MAPS[L.map], mode = MODES.find(x => x.id === L.mode)!, diff = mode.difficulty;
      const modes = MODES.filter(x => x.difficulty === diff || x.sandbox), maps = Object.values(MAPS);
      const slot = (i: number) => { const pl = L.players[i]; return `<li class="slot p${i + 1}"><span class="pn">P${i + 1}</span>${pl ? `<b>${esc(pl.name)}${pl.id === c.myId ? ' (you)' : ''}</b><span class="rdy ${pl.ready ? 'on' : ''}">${pl.ready ? 'Ready' : 'Not ready'}</span>` : '<i>Waiting for player…</i>'}</li>`; };
      html = `<button class="back-btn" id="coop-leave" aria-label="Leave match">↩</button><div class="lobby"><div class="lobby-card">
        <div class="lobby-map"><strong>${esc(m.name)}</strong>${sceneSvg(m)}${c.host ? '<div class="map-arrows"><button class="pg" id="map-prev" aria-label="Previous map">◀</button><button class="pg" id="map-next" aria-label="Next map">▶</button></div>' : ''}</div>
        <div class="lobby-cfg"><h2 class="mode-band">${esc(mode.sandbox ? 'Sandbox' : mode.id === diff ? 'Standard' : mode.name)}</h2>
          <label>Difficulty <select id="coop-diff" ${c.host ? '' : 'disabled'}>${(['easy', 'medium', 'hard', 'impoppable'] as const).map(d => `<option value="${d}" ${d === diff ? 'selected' : ''}>${DIFF[d].name}</option>`).join('')}</select></label>
          <label>Game mode <select id="coop-mode" ${c.host ? '' : 'disabled'}>${modes.map(x => `<option value="${x.id}" ${x.id === L.mode ? 'selected' : ''}>${esc(x.sandbox ? 'Sandbox' : x.id === diff ? 'Standard' : x.name)}</option>`).join('')}</select></label>
          <label class="switch"><span>Map split</span><input id="coop-split" type="checkbox" role="switch" ${L.split ? 'checked' : ''} ${c.host ? '' : 'disabled'}></label>
          <div class="code-row"><span>Code</span><output id="coop-code-out">${esc(c.code)}</output><button id="coop-copy" aria-label="Copy code">⧉</button></div></div></div>
        <ol class="slots">${[0, 1, 2, 3].map(slot).join('')}</ol>
        <p class="coop-status" role="status">${esc(c.error || (c.host ? (c.canStart ? 'Everyone is ready.' : 'Waiting for players to be ready…') : 'Waiting for the host to start…'))}</p>
        <div class="lobby-actions">${c.host ? `<button class="big play" id="coop-start" ${c.canStart ? '' : 'disabled'}>Start!</button>` : `<button class="big play" id="coop-ready" aria-pressed="${c.ready}">${c.ready ? 'Not ready' : 'Ready!'}</button>`}</div></div>`;
      void maps; break;
    }
    case 'pause':
      html = `<div class="pause-box">${plank('Pause')}<div class="pause-panel"><h2>${esc(DIFF[flow.difficulty]?.name ?? '')} · Round ${roundNo}</h2>${settingsFields(meta.settings)}<div id="audio-settings"></div></div>
        <nav class="pause-row">${round('home', '🏠', 'Home')}${round('restart', '↻', 'Restart')}${round('resume', '➜', 'Continue', 'go')}</nav></div>`; break;
    case 'settings':
      html = `${back}${plank('Settings')}<div class="pause-panel wide">${settingsFields(meta.settings)}<div id="audio-settings"></div><p class="keys">Space: start / fast forward · Escape: back / pause · Comma / period / slash: upgrade · Backspace: sell · Tab: targeting</p></div>`; break;
    case 'victory': case 'defeat': {
      const won = flow.screen === 'victory', rw = meta.rewards;
      html = `<div class="pause-box">${plank(won ? 'Victory!' : 'Defeat')}<div class="pause-panel"><p class="result">Round <strong>${roundNo}</strong></p><div class="rewards" role="status">${rw ? `<p>+${rw.xp.toLocaleString()} XP · +${rw.mm.toLocaleString()} Monkey Money</p>${rw.levelUps.map(r => `<p class="rank-toast">★ Rank ${r}! +${levelUpMM(r)} Monkey Money</p>`).join('')}` : ''}</div></div>
        <nav class="pause-row">${round('home', '🏠', 'Home')}${round('restart', '↻', 'Restart')}${won ? round('continue', '∞', 'Freeplay', 'go') : ''}</nav></div>`; break;
    }
  }
  o.innerHTML = html;
  root.appendChild(o);
  o.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b => b.onclick = e => { e.stopPropagation(); send({ type: b.dataset.action as 'back' }); });
  const bind = (selector: string, action: (b: HTMLButtonElement) => FlowEvent) => o.querySelectorAll<HTMLButtonElement>(selector).forEach(b => b.onclick = () => send(action(b)));
  bind('[data-difficulty]', b => ({ type: 'difficulty', id: b.dataset.difficulty as Flow['difficulty'] }));
  bind('[data-mode]', b => ({ type: 'mode', id: b.dataset.mode! }));
  bind('[data-hero]', b => ({ type: 'hero', id: b.dataset.hero as HeroKind }));
  bind('[data-map]', b => ({ type: 'map', id: b.dataset.map! }));
  const redraw = () => showScreen(root, flow, send, roundNo, meta, audio);
  o.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => b.onclick = () => meta.buy(b.dataset.buy!));
  o.querySelectorAll<HTMLButtonElement>('[data-power]').forEach(b => b.onclick = () => { view.power = b.dataset.power; redraw(); });
  o.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach(b => b.onclick = () => { view.hero = b.dataset.preview as HeroKind; redraw(); });
  o.querySelectorAll<HTMLButtonElement>('[data-tier]').forEach(b => b.onclick = () => { view.tier = b.dataset.tier; view.mapPage = 0; redraw(); });
  o.querySelector<HTMLButtonElement>('.pg.prev')?.addEventListener('click', () => { view.mapPage--; redraw(); });
  o.querySelector<HTMLButtonElement>('.pg.next')?.addEventListener('click', () => { view.mapPage++; redraw(); });
  if (flow.screen === 'knowledge') {
    o.querySelectorAll<HTMLButtonElement>('[data-mktree]').forEach(b => b.onclick = () => { view.tree = b.dataset.mktree as KnowledgeTree; view.mkTree = true; view.pick = undefined; redraw(); });
    o.querySelector<HTMLButtonElement>('#mk-up')?.addEventListener('click', () => { view.mkTree = false; redraw(); });
    const on = o.querySelector<HTMLInputElement>('#mk-on'); if (on) on.onchange = () => meta.knowledge.toggle(on.checked);
    o.querySelector<HTMLButtonElement>('#mk-respec')?.addEventListener('click', () => meta.knowledge.respec());
    const host = o.querySelector<HTMLElement>('#mk-host'); if (host) renderKnowledge(host, p, meta.knowledge, view);
  }
  if (flow.screen === 'settings' || flow.screen === 'pause') {
    if (audio) o.querySelector('#audio-settings')!.appendChild(audio);
    for (const [id, key] of [['show-range', 'showRange'], ['reduce-motion', 'reducedMotion'], ['fast-forward', 'fastForward'], ['default-autoplay', 'autoplay']] as const) {
      const input = o.querySelector<HTMLInputElement>(`#${id}`); if (input) input.onchange = () => meta.change(key, input.checked);
    }
  }
  if (flow.screen === 'social' || flow.screen === 'lobby') bindCoop(o, meta.coop);
  o.querySelector('#account-open')?.addEventListener('click', () => meta.account?.open());
  if (flow.screen === 'splash') o.onclick = () => send({ type: 'start' });
  o.querySelector<HTMLButtonElement>(flow.screen === 'hero' ? '[data-hero]' : flow.screen === 'menu' ? '.play-big' : 'button:not(.back-btn)')?.focus();
}

function settingsFields(s: Settings) {
  const sw = (id: string, label: string, on: boolean) => `<label class="switch"><span>${label}</span><input id="${id}" type="checkbox" role="switch" ${on ? 'checked' : ''}></label>`;
  return `<div class="switches">${sw('default-autoplay', 'Auto start', s.autoplay)}${sw('fast-forward', 'Fast forward default', s.fastForward)}${sw('show-range', 'Show tower range', s.showRange)}${sw('reduce-motion', 'Reduce motion', s.reducedMotion)}</div>`;
}

function bindCoop(o: HTMLElement, c: CoopView) {
  const $ = <T extends HTMLElement>(sel: string) => o.querySelector<T>(sel);
  const name = $<HTMLInputElement>('#coop-name'); if (name) name.onchange = () => c.setName(name.value.trim() || 'Monkey');
  $<HTMLButtonElement>('#coop-create')?.addEventListener('click', () => c.create());
  $<HTMLFormElement>('#coop-join')?.addEventListener('submit', e => { e.preventDefault(); c.join($<HTMLInputElement>('#coop-code')!.value.trim().toUpperCase()); });
  $<HTMLButtonElement>('#coop-leave')?.addEventListener('click', () => c.leave());
  $<HTMLButtonElement>('#coop-start')?.addEventListener('click', () => c.start());
  $<HTMLButtonElement>('#coop-ready')?.addEventListener('click', () => c.setReady(!c.ready));
  $<HTMLButtonElement>('#coop-copy')?.addEventListener('click', () => { void navigator.clipboard?.writeText(c.code); });
  const ids = Object.keys(MAPS), cur = ids.indexOf(c.lobby.map);
  $<HTMLButtonElement>('#map-prev')?.addEventListener('click', () => c.configure({ map: ids[(cur + ids.length - 1) % ids.length] }));
  $<HTMLButtonElement>('#map-next')?.addEventListener('click', () => c.configure({ map: ids[(cur + 1) % ids.length] }));
  const diff = $<HTMLSelectElement>('#coop-diff'); if (diff) diff.onchange = () => c.configure({ mode: diff.value });
  const mode = $<HTMLSelectElement>('#coop-mode'); if (mode) mode.onchange = () => c.configure({ mode: mode.value });
  const split = $<HTMLInputElement>('#coop-split'); if (split) split.onchange = () => c.configure({ split: split.checked });
}
