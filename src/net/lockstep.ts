// Host-clocked lockstep. Every peer runs the same deterministic Sim; the host decides how far time advances and on which
// tick each player's command runs, and broadcasts that as frames. Clients never step past the last frame they received.
import { execute, validCommand, type Command } from './commands';
import type { Sim } from '../sim';

export interface Scheduled { tick: number; p: number; cmd: Command }
export interface Frame { to: number; cmds: Scheduled[] }

/** Cheap fingerprint for desync detection. */
export function simHash(s: Sim) {
  let h = s.tick * 31 + s.lives * 7 + s.round;
  for (const w of s.wallets) h = (h * 33 + Math.round(w)) | 0;
  for (const t of s.towers) h = (h * 33 + t.tiers[0] * 100 + t.tiers[1] * 10 + t.tiers[2] + Math.round(t.x * 10)) | 0;
  for (const b of s.bloons) h = (h * 33 + b.id + Math.round(b.hp)) | 0;
  return h >>> 0;
}

export class Lockstep {
  private pending: Scheduled[] = [];
  /** Highest tick this peer may simulate up to. */
  target = 0;
  constructor(public sim: Sim, public readonly host: boolean, private onEffect: (s: Scheduled, ok: boolean) => void = () => {}) { this.target = sim.tick; }

  /** Host: queue a player's command for the next tick it will simulate. */
  submit(p: number, cmd: unknown) {
    if (!this.host || !validCommand(cmd) || !Number.isInteger(p) || p < 0 || p >= this.sim.wallets.length) return;
    this.pending.push({ tick: Math.max(this.target, this.sim.tick) + 1, p, cmd });
  }
  /** Host: allow `steps` more ticks; returns the frame to broadcast (and applies it locally). */
  advance(steps: number): Frame {
    const frame: Frame = { to: Math.max(this.target, this.sim.tick) + Math.max(0, steps), cmds: this.pending };
    this.pending = [];
    this.receive(frame);
    return frame;
  }
  private queue: Scheduled[] = [];
  /** Any peer: accept a frame (host frames only; clients get them from the network). */
  receive(f: Frame) {
    if (!f || !Number.isFinite(f.to) || !Array.isArray(f.cmds)) return;
    for (const c of f.cmds) if (validCommand(c.cmd) && Number.isFinite(c.tick)) this.queue.push(c);
    this.queue.sort((a, b) => a.tick - b.tick);
    this.target = Math.max(this.target, f.to);
  }
  /** Simulate up to `target`, running each command right before its tick. Returns ticks stepped. */
  pump(maxSteps = Infinity) {
    let n = 0;
    while (this.sim.tick < this.target && n < maxSteps && !this.sim.gameOver) {
      const next = this.sim.tick + 1;
      while (this.queue.length && this.queue[0].tick <= next) { const c = this.queue.shift()!; this.onEffect(c, execute(this.sim, c.p, c.cmd)); }
      this.sim.step(); n++;
    }
    return n;
  }
}
