import { HEROES, HERO_NAMES, heroAbilities, heroLevelXP, type HeroKind } from './heroes';
import { HERO_ITEMS, HERO_SPELLS, itemStock } from './hero-extras';
import type { Sim } from './sim';
export function heroControls(parent: HTMLElement, getSim: () => Sim, getTower: () => number,
  place: (kind: HeroKind | null) => void, hint: (message: string) => void) {
  const panel = document.createElement('section'); panel.setAttribute('aria-label', 'Hero controls');
  panel.innerHTML = `<h2>Hero</h2><label for="hero-select">Choose one hero per game</label><select id="hero-select"></select>
    <button id="hero-place">Place hero</button><output id="hero-status" aria-live="polite"></output>
    <div id="hero-details" hidden><p id="hero-level"></p><p id="hero-effect"></p><button id="hero-target">Target: First</button>
    <details><summary>Ability and item target</summary><p>Enter map coordinates. Tower items and Blood Sacrifice use the selected tower.</p>
    <label for="hero-x">Target X</label><input id="hero-x" type="number" min="0" max="300" value="150">
    <label for="hero-y">Target Y</label><input id="hero-y" type="number" min="0" max="230" value="115"></details>
    <div id="hero-abilities" aria-label="Hero abilities"></div><div id="hero-extras" aria-label="Shop and spellbook"></div></div>`;
  parent.appendChild(panel);
  const el = <T extends HTMLElement>(id: string) => panel.querySelector<T>(`#${id}`)!;
  const select = el<HTMLSelectElement>('hero-select'), buy = el<HTMLButtonElement>('hero-place');
  for (const kind of Object.keys(HERO_NAMES) as HeroKind[]) {
    const option = document.createElement('option'); option.value = kind; option.textContent = HEROES[kind].name; select.appendChild(option);
  }
  let placing: HeroKind | null = null, lastHero: object | null = null, abilityKey = '', extrasKey = '';
  const target = () => ({ x: el<HTMLInputElement>('hero-x').valueAsNumber, y: el<HTMLInputElement>('hero-y').valueAsNumber });
  buy.addEventListener('click', () => {
    placing = placing ? null : select.value as HeroKind; place(placing);
    hint(placing ? `Place ${HEROES[placing].name} on ${HEROES[placing].waterOnly ? 'water' : 'clear ground'}. Escape cancels.` : 'Hero placement cancelled.'); refresh();
  });
  select.addEventListener('change', () => { placing = null; place(null); refresh(); });
  el<HTMLButtonElement>('hero-target').addEventListener('click', () => { getSim().cycleHeroTargeting(); refresh(); });
  function refresh() {
    const s = getSim(), h = s.hero, kind = h?.kind ?? select.value as HeroKind;
    if (h !== lastHero) {
      el<HTMLElement>('hero-abilities').replaceChildren(); el<HTMLElement>('hero-extras').replaceChildren();
      abilityKey = extrasKey = ''; placing = null; lastHero = h;
      if (h) { const p = s.nearestTrack(h); el<HTMLInputElement>('hero-x').value = String(Math.round(p.x)); el<HTMLInputElement>('hero-y').value = String(Math.round(p.y)); }
    }
    select.disabled = !!h || s.gameOver;
    buy.disabled = !!h || s.gameOver || s.cash < HEROES[kind].cost[s.difficulty];
    buy.textContent = h ? `${HEROES[kind].name} placed` : `${placing ? 'Cancel placement' : 'Place hero'} · $${HEROES[kind].cost[s.difficulty]}`;
    buy.setAttribute('aria-pressed', String(placing !== null));
    el<HTMLElement>('hero-details').hidden = !h;
    el<HTMLElement>('hero-status').textContent = h ? `${HEROES[kind].name} · Level ${h.level}${h.level < 20 ? ` · XP ${Math.floor(h.xp)}/${heroLevelXP(kind, h.level + 1)}` : ' · Max level'}` : 'Hero XP is earned at the end of each completed round.';
    if (!h) return;
    el<HTMLElement>('hero-level').textContent = `Level ${h.level}: ${HEROES[kind].levels[h.level - 1].description}`;
    el<HTMLElement>('hero-effect').textContent = HEROES[kind].levels[h.level - 1].effect;
    const targetButton = el<HTMLButtonElement>('hero-target'); targetButton.textContent = `Target: ${h.targeting}`; targetButton.disabled = s.gameOver;
    const abilities = heroAbilities(kind, 20).map(a => heroAbilities(kind, h.level).find(current => current.id === a.id) ?? a);
    const key = `${kind}:${h.level}:${abilities.map(a => `${a.id}:${Math.ceil(Math.max(0, (h.ready[a.id] ?? 0) - s.tick) / 60)}`).join(',')}:${s.gameOver}`;
    if (key !== abilityKey) {
      abilityKey = key; const container = el<HTMLElement>('hero-abilities');
      for (const a of abilities) {
        if (a.id === 'shop') continue;
        const existing = container.querySelector<HTMLButtonElement>(`[data-ability="${a.id}"]`);
        const button = existing ?? document.createElement('button'), locked = h.level < a.level;
        button.dataset.ability = a.id;
        const seconds = Math.ceil(Math.max(0, (h.ready[a.id] ?? 0) - s.tick) / 60);
        button.textContent = `${a.name}${locked ? ` · Level ${a.level}` : seconds ? ` · ${seconds}s` : ''}`;
        button.disabled = s.gameOver || locked || seconds > 0;
        if (!existing) button.addEventListener('click', () => {
          const targeted = ['walk', 'reposition', 'mine', 'cocktail', 'brambles', 'trees', 'leap', 'focus'].includes(a.id);
          const ok = getSim().activateHero(a.id, targeted ? target() : undefined, getTower());
          hint(ok ? `${a.name} activated.` : `${a.name} needs a valid target, location, or sufficient lives.`); refresh();
        }); if (!existing) container.appendChild(button);
      }
    }
    const extraKey = `${kind}:${h.level}:${Math.floor(h.mana)}:${Math.floor(s.cash)}:${s.round}:${Math.floor(s.tick / 60)}:${s.gameOver}`;
    if (extraKey !== extrasKey) {
      extrasKey = extraKey; const container = el<HTMLElement>('hero-extras');
      if (kind === 'geraldo') {
        let title = container.querySelector('h3'); if (!title) { title = document.createElement('h3'); container.appendChild(title); } title.textContent = "Geraldo's Shop";
        for (const item of HERO_ITEMS) {
          const stock = itemStock(s, item.id), existing = container.querySelector<HTMLButtonElement>(`[data-item="${item.id}"]`), button = existing ?? document.createElement('button'); button.dataset.item = item.id;
          button.textContent = `${item.name} · ${h.level < item.level ? `Level ${item.level}` : `$${s.price(item.cost)} · ${stock} in stock`}`;
          button.disabled = s.gameOver || !stock || s.cash < s.price(item.cost);
          if (!existing) button.addEventListener('click', () => { const ok = getSim().buyHeroItem(item.id, target(), getTower()); hint(ok ? `${item.name} purchased.` : 'Choose a valid location or compatible tower.'); refresh(); }); if (!existing) container.appendChild(button);
        }
        if (h.assets.some(a => a.id === 'figure')) { const button = container.querySelector<HTMLButtonElement>('[data-figure]') ?? document.createElement('button'); button.dataset.figure = 'true'; button.textContent = 'Sell Quincy figure'; button.disabled = s.gameOver; button.onclick = () => { getSim().sellHeroFigure(); refresh(); }; container.appendChild(button); } else container.querySelector('[data-figure]')?.remove();
      }
      if (kind === 'corvus') {
        let title = container.querySelector('h3'); if (!title) { title = document.createElement('h3'); container.appendChild(title); } title.textContent = `Spellbook · ${Math.floor(h.mana)}/800 mana`;
        for (const spell of HERO_SPELLS) {
          const existing = container.querySelector<HTMLButtonElement>(`[data-spell="${spell.id}"]`), button = existing ?? document.createElement('button'); button.dataset.spell = spell.id;
          const seconds = Math.ceil(Math.max(0, (h.spellReady[spell.id] ?? 0) - s.tick) / 60);
          button.textContent = `${spell.name} · ${h.level < spell.level ? `Level ${spell.level}` : seconds ? `${seconds}s` : `${spell.mana} mana`}`;
          button.disabled = s.gameOver || h.level < spell.level || h.mana < spell.mana || seconds > 0;
          button.onclick = () => { getSim().castHeroSpell(spell.id); refresh(); }; if (!existing) container.appendChild(button);
        }
      }
    }
  }
  return { refresh, cancel: () => { placing = null; } };
}
