import { Sim, STANDARD_RULES, type Difficulty, type Rules } from '../sim';
import { MAPS } from '../maps/maps';

export type Category = 'primary' | 'military' | 'magic';
// Tower category by kind (magic kinds listed for when the towers lane lands them).
export const CATEGORY: Record<string, Category> = {
  dart: 'primary', boomerang: 'primary', bomb: 'primary', tack: 'primary', ice: 'primary', glue: 'primary',
  sniper: 'military', sub: 'military', buccaneer: 'military', ace: 'military', heli: 'military', mortar: 'military', dartling: 'military',
  wizard: 'magic', ninja: 'magic', super: 'magic', alchemist: 'magic', druid: 'magic', mermonkey: 'magic',
};
export interface ModeDef {
  id: string; name: string; difficulty: Difficulty; startRound: number; winRound: number; blurb: string;
  only?: Category; cash?: number; lives?: number; deflation?: boolean; halfCash?: boolean; reverse?: boolean; apopalypse?: boolean;
  doubleMoab?: boolean; chimps?: boolean; sandbox?: boolean;
}
// uncertain: wiki gives win rounds only for Impoppable/CHIMPS (100) and start rounds 3/6/31; the rest use BTD6 conventions.
export const MODES: ModeDef[] = [
  { id: 'easy', name: 'Easy', difficulty: 'easy', startRound: 1, winRound: 40, blurb: 'Rounds 1-40' },
  { id: 'medium', name: 'Medium', difficulty: 'medium', startRound: 1, winRound: 60, blurb: 'Rounds 1-60' },
  { id: 'hard', name: 'Hard', difficulty: 'hard', startRound: 3, winRound: 80, blurb: 'Rounds 3-80' },
  { id: 'impoppable', name: 'Impoppable', difficulty: 'impoppable', startRound: 6, winRound: 100, blurb: 'Rounds 6-100, 1 life' },
  { id: 'primary_only', name: 'Primary Only', difficulty: 'easy', startRound: 1, winRound: 40, only: 'primary', blurb: 'Primary monkeys only' },
  { id: 'military_only', name: 'Military Only', difficulty: 'medium', startRound: 1, winRound: 60, only: 'military', blurb: 'Military monkeys only' },
  { id: 'magic_only', name: 'Magic Only', difficulty: 'hard', startRound: 3, winRound: 80, only: 'magic', blurb: 'Magic monkeys only' },
  { id: 'deflation', name: 'Deflation', difficulty: 'medium', startRound: 31, winRound: 60, cash: 20000, deflation: true, blurb: '$20000, no income' },
  { id: 'half_cash', name: 'Half Cash', difficulty: 'hard', startRound: 3, winRound: 80, halfCash: true, blurb: 'All income halved' },
  { id: 'reverse', name: 'Reverse', difficulty: 'medium', startRound: 1, winRound: 60, reverse: true, blurb: 'Bloons run the track backwards' },
  { id: 'apopalypse', name: 'Apopalypse', difficulty: 'hard', startRound: 3, winRound: 80, apopalypse: true, blurb: 'No breaks between rounds' },
  { id: 'double_hp_moabs', name: 'Double HP MOABs', difficulty: 'hard', startRound: 3, winRound: 80, doubleMoab: true, blurb: 'MOAB-class HP x2' },
  { id: 'chimps', name: 'CHIMPS', difficulty: 'impoppable', startRound: 6, winRound: 100, chimps: true, blurb: 'No income, no selling' },
  { id: 'sandbox', name: 'Sandbox', difficulty: 'medium', startRound: 1, winRound: Infinity, cash: 9999999, lives: 999999999, sandbox: true, blurb: 'Unlimited cash and lives' },
];
export const modeById = (id: string) => MODES.find(m => m.id === id) ?? MODES[1];

export function rulesFor(m: ModeDef): Rules {
  const r: Rules = { ...STANDARD_RULES, winRound: m.winRound, auto: !!m.apopalypse };
  if (m.halfCash) { r.cashMult = 0.5; r.incomeMult = 0.5; }
  if (m.deflation) { r.cashMult = 0; r.incomeMult = 0; }
  if (m.chimps) { r.incomeMult = 0; r.noSell = true; } // uncertain: pop cash kept; only round/other income removed
  if (m.doubleMoab) r.moabHpMult = 2;
  if (m.only) { const c = m.only; r.allowed = k => CATEGORY[k] === c; }
  return r;
}

export function createGame(mapId: string, modeId: string): Sim {
  const map = MAPS[mapId] ?? MAPS.monkey_meadow, m = modeById(modeId);
  const lanes = map.lanes.map(l => m.reverse ? [...l].reverse() : l);
  const sim = new Sim(lanes[0], m.difficulty, map.water, lanes, map.blocked);
  sim.rules = rulesFor(m);
  sim.round = m.startRound - 1;
  if (m.cash !== undefined) sim.cash = m.cash;
  if (m.lives !== undefined) sim.lives = m.lives;
  return sim;
}
