// Monkey Knowledge screen: six trees, rows by required tree points, connector lines to prerequisites, detail panel.
import { KNOWLEDGE_BY_NAME, SIMULATED, TREES, type KnowledgeTree } from '../knowledge';
import { knowledgeAvailable, knowledgeBlock, knowledgeEarned, knowledgeState, treeKnowledge, treeSpent, type Profile } from '../meta';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const TITLE: Record<KnowledgeTree, string> = { primary: 'Primary', military: 'Military', magic: 'Magic', support: 'Support', heroes: 'Heroes', powers: 'Powers' };
const COL = 120, ROW = 96, LABEL = 120; // left gutter for the "Requires N points" row labels

/** Node grid for one tree: row = prerequisite depth, each row ordered by its parents' average column (fewer crossings). Pure (tested). */
export function treeLayout(tree: KnowledgeTree) {
  const nodes = treeKnowledge(tree), by = new Map(nodes.map(k => [k.name, k])), depth = new Map<string, number>();
  const d = (name: string, seen = new Set<string>()): number => {
    if (depth.has(name)) return depth.get(name)!;
    const ps = by.get(name)!.prereq.filter(p => by.has(p) && !seen.has(p));
    const v = ps.length ? 1 + Math.max(...ps.map(p => d(p, new Set([...seen, name])))) : 0; depth.set(name, v); return v;
  };
  nodes.forEach(k => d(k.name));
  const rows: string[][] = [];
  for (const k of nodes) (rows[depth.get(k.name)!] ??= []).push(k.name);
  const col = new Map<string, number>();
  rows.forEach((r, j) => {
    if (j) r.sort((a, b) => avg(a) - avg(b));
    r.forEach((n, i) => col.set(n, i - (r.length - 1) / 2));
    function avg(n: string) { const ps = by.get(n)!.prereq.filter(p => col.has(p)); return ps.length ? ps.reduce((s, p) => s + col.get(p)!, 0) / ps.length : 0; }
  });
  const width = Math.max(...rows.map(r => r.length)), pos: Record<string, { x: number; y: number }> = {};
  rows.forEach((r, j) => r.forEach(n => { pos[n] = { x: LABEL + (col.get(n)! + (width - 1) / 2) * COL + COL / 2, y: j * ROW + ROW / 2 }; }));
  const tiers = rows.map(r => Math.max(...r.map(n => by.get(n)!.points)));
  return { pos, w: LABEL + width * COL, h: rows.length * ROW, tiers };
}

export interface KnowledgeActions { learn: (name: string) => void; respec: () => void; toggle: (on: boolean) => void }

export function renderKnowledge(host: HTMLElement, p: Profile, a: KnowledgeActions, state: { tree: KnowledgeTree; pick?: string }) {
  const draw = () => {
    const { pos, w, h, tiers } = treeLayout(state.tree), pick = state.pick && KNOWLEDGE_BY_NAME[state.pick]?.tree === state.tree ? state.pick : undefined;
    const lines = treeKnowledge(state.tree).flatMap(k => k.prereq.filter(n => pos[n]).map(n =>
      `<line x1="${pos[n].x}" y1="${pos[n].y}" x2="${pos[k.name].x}" y2="${pos[k.name].y}" class="${p.mk.includes(n) ? 'lit' : ''}"/>`)).join('');
    const nodes = treeKnowledge(state.tree).map(k => {
      const st = knowledgeState(p, k.name), q = pos[k.name];
      return `<button class="mk-node ${st}${pick === k.name ? ' picked' : ''}${SIMULATED.has(k.name) ? '' : ' unsim'}" data-mk="${esc(k.name)}" style="left:${q.x}px;top:${q.y}px" aria-pressed="${pick === k.name}" aria-label="${esc(k.name)}: ${st}">`
        + `<span class="mk-icon">${esc(k.name.split(/\s+/).map(s => s[0]).join('').slice(0, 3))}</span><small>${esc(k.name)}</small></button>`;
    }).join('');
    const mmAt = (j: number) => Math.max(0, ...treeKnowledge(state.tree).filter(k => Math.abs(pos[k.name].y - (j * ROW + ROW / 2)) < 1).map(k => k.mm));
    const tierLabels = tiers.map((t, j) => t || mmAt(j) ? `<span class="mk-tier" style="top:${j * ROW + 6}px">${t ? `Requires ${t} points` : ''}${mmAt(j) ? `<em>${mmAt(j).toLocaleString()} MM</em>` : ''}</span><i class="mk-rule" style="top:${j * ROW + ROW / 2}px"></i>` : '').join('');
    const k = pick ? KNOWLEDGE_BY_NAME[pick] : undefined, block = k ? knowledgeBlock(p, k.name) : '';
    const i = TREES.indexOf(state.tree), prev = TREES[(i + 5) % 6], next = TREES[(i + 1) % 6];
    host.innerHTML = `<div class="mk-head"><button class="pg" data-tree="${prev}" aria-label="${TITLE[prev]} knowledge">◀</button><h1 class="plank">${TITLE[state.tree]} Knowledge</h1><button class="pg" data-tree="${next}" aria-label="${TITLE[next]} knowledge">▶</button></div>
      <p class="mk-stats"><b>${knowledgeAvailable(p)}</b> knowledge points left <small>(${knowledgeEarned(p)} earned at rank ${p.rank}, ${treeSpent(p, state.tree)} spent here)</small></p>
      <div class="mk-scroll" tabindex="0" aria-label="${TITLE[state.tree]} knowledge tree"><div class="mk-tree" style="width:${w}px;height:${h}px">
        <svg class="mk-lines" width="${w}" height="${h}" aria-hidden="true">${lines}</svg>${tierLabels}${nodes}</div></div>
      <div class="mk-detail" role="status">${k ? `<h2>${esc(k.name)}</h2><p>${esc(k.description)}</p>${k.note && k.note !== '-' ? `<p class="mk-note">${esc(k.note)}</p>` : ''}
        ${SIMULATED.has(k.name) ? '' : '<p class="mk-unsim">Shown for completeness: this effect is not simulated in Monkey Pop TD yet.</p>'}
        <button id="mk-learn" ${block ? 'disabled' : ''}>${block || `Learn · 1 point${k.mm ? ` + ${k.mm} MM` : ''}`}</button>` : '<p>Pick a knowledge point to see what it does.</p>'}</div>`;
    host.querySelectorAll<HTMLButtonElement>('[data-tree]').forEach(b => b.onclick = () => { state.tree = b.dataset.tree as KnowledgeTree; state.pick = undefined; draw(); });
    host.querySelectorAll<HTMLButtonElement>('[data-mk]').forEach(b => b.onclick = () => { state.pick = b.dataset.mk; draw(); });
    host.querySelector<HTMLButtonElement>('#mk-learn')?.addEventListener('click', () => a.learn(k!.name));
  };
  draw();
}
