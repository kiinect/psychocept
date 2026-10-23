// DOM overlay screens: map select, mode select, victory/defeat.
import './screens.css';
import { MAPS, TIERS } from '../maps/maps';
import { sceneSvg } from '../maps/art';
import { MODES } from '../modes/modes';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
function overlay(root: HTMLElement, html: string) {
  root.querySelector('#overlay')?.remove();
  const o = document.createElement('div'); o.id = 'overlay'; o.className = 'overlay'; o.innerHTML = html;
  root.appendChild(o); return o;
}
export const closeOverlay = (root: HTMLElement) => root.querySelector('#overlay')?.remove();

export function showMapSelect(root: HTMLElement, onPick: (mapId: string) => void) {
  const o = overlay(root, `<h2>Choose a map</h2>` + TIERS.map(t => `<h3>${t}</h3><div class="cards">` +
    Object.values(MAPS).filter(m => m.tier === t).map(m => `<button class="card" data-map="${m.id}">${sceneSvg(m)}<b>${esc(m.name)}</b>` +
      `<small>${m.lanes.length > 1 ? m.lanes.length + ' lanes' : '1 lane'}${m.water.length ? ' · water' : ''}</small></button>`).join('') + '</div>').join(''));
  o.querySelectorAll<HTMLButtonElement>('[data-map]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.map!)));
}

export function showModeSelect(root: HTMLElement, mapId: string, onPick: (modeId: string) => void, onBack: () => void) {
  const o = overlay(root, `<h2>${esc(MAPS[mapId].name)}: choose a mode</h2><button id="back" class="back">Back to maps</button><div class="cards modes">` +
    MODES.map(m => `<button class="card mode" data-mode="${m.id}"><b>${esc(m.name)}</b><small>${esc(m.blurb)}</small></button>`).join('') + '</div>');
  o.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => onPick(b.dataset.mode!)));
  o.querySelector('#back')!.addEventListener('click', onBack);
}

export function showEnd(root: HTMLElement, won: boolean, round: number, actions: { again: () => void; menu: () => void; cont?: () => void }) {
  const o = overlay(root, `<div class="end ${won ? 'win' : 'lose'}"><h2>${won ? 'Victory!' : 'Defeat'}</h2>` +
    `<p>${won ? `You cleared round ${round}.` : `The bloons got through on round ${round}.`}</p>` +
    (won && actions.cont ? '<button id="cont">Keep playing (endless)</button>' : '') + '<button id="again">Play again</button><button id="menu">Back to maps</button></div>');
  o.querySelector('#again')!.addEventListener('click', actions.again);
  o.querySelector('#menu')!.addEventListener('click', actions.menu);
  o.querySelector('#cont')?.addEventListener('click', actions.cont!);
}
