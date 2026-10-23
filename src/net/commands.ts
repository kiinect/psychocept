// Player actions as data, so co-op peers can run the same action on the same tick. Single player runs them directly.
import type { Sim } from '../sim';
import type { TowerKind } from '../towers';

export type Command =
  | { k: 'place'; x: number; y: number; kind: TowerKind }
  | { k: 'upgrade'; i: number; path: number }
  | { k: 'sell'; i: number }
  | { k: 'target'; i: number; dir: 1 | -1 }
  | { k: 'ability'; i: number }
  | { k: 'aim'; i: number; x: number; y: number }
  | { k: 'round' }
  | { k: 'paragon'; i: number; invest: number }
  | { k: 'collect'; i: number }
  | { k: 'collectAt'; x: number; y: number }
  | { k: 'support'; i: number; target: number }
  | { k: 'merge'; src: number; dst: number; path: number }
  | { k: 'power'; id: string; x?: number; y?: number }
  | { k: 'give'; to: number; amount: number };

const finite = (...n: unknown[]) => n.every(v => typeof v === 'number' && Number.isFinite(v));
/** Shape check for commands arriving from the network (untrusted peers). */
export function validCommand(c: unknown): c is Command {
  if (!c || typeof c !== 'object') return false;
  const m = c as Record<string, unknown>;
  switch (m.k) {
    case 'place': return finite(m.x, m.y) && typeof m.kind === 'string';
    case 'upgrade': return finite(m.i, m.path);
    case 'sell': case 'ability': case 'collect': return finite(m.i);
    case 'target': return finite(m.i) && (m.dir === 1 || m.dir === -1);
    case 'aim': return finite(m.i, m.x, m.y);
    case 'round': return true;
    case 'paragon': return finite(m.i, m.invest);
    case 'collectAt': return finite(m.x, m.y);
    case 'support': return finite(m.i, m.target);
    case 'merge': return finite(m.src, m.dst, m.path);
    case 'power': return typeof m.id === 'string' && (m.x === undefined || finite(m.x, m.y));
    case 'give': return finite(m.to, m.amount);
    default: return false;
  }
}

/** Run `cmd` as `player`. Co-op rule: players may only change their own towers. Returns whether it took effect. */
export function execute(sim: Sim, player: number, cmd: Command): boolean {
  const prev = sim.actor; sim.actor = player;
  try {
    const mine = (i: number) => { const t = sim.towers[i]; return !!t && (sim.wallets.length < 2 || (t.player ?? 0) === player); };
    switch (cmd.k) {
      case 'place': return sim.placeTower(cmd.x, cmd.y, cmd.kind);
      case 'upgrade': return mine(cmd.i) && sim.upgrade(cmd.i, cmd.path);
      case 'sell': return mine(cmd.i) && sim.sell(cmd.i);
      case 'target': {
        if (!mine(cmd.i)) return false;
        if (cmd.dir === 1) { sim.cycleTargeting(cmd.i); return true; }
        const t = sim.towers[cmd.i], start = t.targeting; let before = start;
        for (let n = 0; n < 20; n++) { sim.cycleTargeting(cmd.i); if (t.targeting === start) break; before = t.targeting; }
        t.targeting = before; return true;
      }
      case 'ability': return mine(cmd.i) && sim.activate(cmd.i);
      case 'aim': return mine(cmd.i) && sim.setTarget(cmd.i, { x: cmd.x, y: cmd.y });
      case 'round': return !sim.roundActive && sim.startRound();
      case 'paragon': return mine(cmd.i) && sim.makeParagon(cmd.i, cmd.invest);
      case 'collect': return mine(cmd.i) && sim.collect(cmd.i);
      case 'collectAt': return sim.collectAt({ x: cmd.x, y: cmd.y });
      case 'support': return mine(cmd.i) && sim.setSupportTarget(cmd.i, cmd.target);
      case 'merge': return mine(cmd.dst) && mine(cmd.src) && sim.mergeBeast(cmd.src, cmd.dst, cmd.path);
      case 'power': return sim.usePower(cmd.id, cmd.x === undefined ? undefined : { x: cmd.x, y: cmd.y! });
      case 'give': return sim.give(cmd.to, cmd.amount);
    }
  } finally { sim.actor = prev; }
}
