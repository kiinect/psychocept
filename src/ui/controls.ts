import type { Sim } from '../sim';
import { PARAGONS } from '../towers/paragons';

/** Read-only counterparts of the sim's action guards; never probe by mutating it. */
export function controlVisibility(sim: Sim, index: number) {
  const t = sim.towers[index];
  const live = !!t && !sim.gameOver;
  const support = live && t.type === 'engineer' && (t.tiers[1] >= 4 || !!t.degree);
  const mergePaths = [0, 1, 2].map(path => live && t.type === 'beast' && !t.mergedInto && t.tiers[path] > 0
    ? sim.towers.flatMap((a, i) => a !== t && a.type === 'beast' && !a.mergedInto && !a.merges?.length && a.tiers[path] > 0 ? [i] : []) : []);
  const supportAllies = support ? sim.towers.flatMap((a, i) => a !== t ? [i] : []) : [];
  const paragon = live && sim.canMakeParagon(index);
  return {
    aim: !!t && sim.canSetTarget(t),
    support: supportAllies.length > 0, supportAllies,
    merge: mergePaths.some(allies => allies.length > 0), mergePaths,
    collect: live && ((t.bank ?? 0) > 0 || sim.collectibles.some(a => a.owner === t) || sim.roadItems.some(a => a.owner === t && a.kind === 'trap' && a.stored > 0)),
    paragon,
    paragonHint: !!t && !t.degree && !!PARAGONS[t.type] && t.tiers.includes(5) && !paragon,
  };
}
