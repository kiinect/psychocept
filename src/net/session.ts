// Co-op session over the room relay (relay/): lobby, start, then host-clocked lockstep frames.
// The host's browser is the authority for time and command order; every peer runs the same Sim.
import { createGame, modeById, MODES } from '../modes/modes';
import { MAPS } from '../maps/maps';
import type { Sim } from '../sim';
import { Lockstep, simHash, type Frame, type Scheduled } from './lockstep';
import type { Command } from './commands';

/** Relay base URL: set VITE_RELAY_URL at build time (wss://mpt-relay.<you>.workers.dev); local wrangler dev otherwise. */
export const RELAY_URL: string = (import.meta.env?.VITE_RELAY_URL as string | undefined) || (import.meta.env?.DEV ? 'ws://localhost:8787' : '');
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 6 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
export const validCode = (c: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(c.toUpperCase());

export interface Player { id: string; name: string; ready: boolean }
export interface LobbyState { players: Player[]; map: string; mode: string; split: boolean }
type Msg =
  | { t: 'hi'; name: string } | { t: 'lobby'; lobby: LobbyState } | { t: 'ready'; ready: boolean }
  | { t: 'start'; lobby: LobbyState } | { t: 'cmd'; cmd: Command } | { t: 'f'; f: Frame }
  | { t: 'speed'; speed: number } | { t: 'snap'; tick: number; state: unknown } | { t: 'hash'; tick: number; h: number };

export class Session {
  ws?: WebSocket; id = ''; code = ''; host = false; status: 'idle' | 'connecting' | 'lobby' | 'game' | 'closed' = 'idle'; error = '';
  lobby: LobbyState = { players: [], map: 'monkey_meadow', mode: 'easy', split: true };
  sim?: Sim; lock?: Lockstep; me = 0; speed = 1; desync = false;
  private snaps: { tick: number; state: unknown }[] = []; private hashes: { tick: number; h: number }[] = [];
  /** UI hooks. */
  onChange: () => void = () => {}; onStart: (sim: Sim) => void = () => {}; onEffect: (s: Scheduled, ok: boolean) => void = () => {};
  constructor(public name: string, private url = RELAY_URL) {}

  create() { this.host = true; this.code = newCode(); this.open(); }
  join(code: string) { this.host = false; this.code = code.toUpperCase(); this.open(); }
  private open() {
    this.status = 'connecting'; this.error = ''; this.onChange();
    let ws: WebSocket;
    if (!this.url) return this.fail('Co-op is not set up on this site yet.');
    try { ws = new WebSocket(`${this.url.replace(/\/$/, '')}/room/${this.code}`); } catch { return this.fail('Could not reach the co-op server.'); }
    this.ws = ws;
    ws.onmessage = e => { try { this.handle(JSON.parse(String(e.data))); } catch { /* ignore malformed */ } };
    ws.onclose = () => { if (this.status !== 'closed') this.fail(this.status === 'connecting' ? 'Room not found or full.' : 'Disconnected from the match.'); };
    ws.onerror = () => { /* onclose follows */ };
  }
  private fail(msg: string) { this.error = msg; this.status = 'closed'; this.onChange(); }
  leave() { this.status = 'closed'; this.ws?.close(); this.onChange(); }
  private send(m: Msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  private handle(raw: { sys?: string; id?: string; peers?: string[]; from?: string; data?: Msg }) {
    if (raw.sys === 'hello') {
      this.id = raw.id!;
      if (this.host && raw.peers?.length) { this.ws?.close(); this.status = 'closed'; this.code = newCode(); return this.open(); } // code taken: pick another
      if (!this.host && !raw.peers?.length) { this.leave(); return this.fail('No match with that code.'); }
      this.status = 'lobby';
      if (this.host) { this.lobby.players = [{ id: this.id, name: this.name, ready: true }]; this.broadcastLobby(); }
      else this.send({ t: 'hi', name: this.name });
      return this.onChange();
    }
    if (raw.sys === 'leave') {
      if (this.host) { if (this.status === 'lobby') { this.lobby.players = this.lobby.players.filter(p => p.id !== raw.id); this.broadcastLobby(); } }
      else if (raw.id === this.lobby.players[0]?.id) this.fail('The host left the match.');
      return this.onChange();
    }
    const from = raw.from!, m = raw.data; if (!m || typeof m !== 'object') return;
    if (this.host) {
      if (m.t === 'hi' && this.status === 'lobby' && this.lobby.players.length < 4 && !this.lobby.players.some(p => p.id === from)) {
        this.lobby.players.push({ id: from, name: String(m.name).slice(0, 16) || 'Monkey', ready: false }); this.broadcastLobby();
      } else if (m.t === 'ready') { const p = this.lobby.players.find(x => x.id === from); if (p) { p.ready = !!m.ready; this.broadcastLobby(); } }
      else if (m.t === 'cmd' && this.lock) this.lock.submit(this.lobby.players.findIndex(p => p.id === from), m.cmd);
      else if (m.t === 'speed') this.speed = [1, 2, 3].includes(m.speed) ? m.speed : 1;
    } else if (from === this.lobby.players[0]?.id || m.t === 'lobby' || m.t === 'start') {
      if (m.t === 'lobby') this.lobby = m.lobby;
      else if (m.t === 'start') this.begin(m.lobby);
      else if (m.t === 'f') this.lock?.receive(m.f);
      else if (m.t === 'snap') this.snaps.push({ tick: m.tick, state: m.state });
      else if (m.t === 'hash') this.hashes.push(m);
      else if (m.t === 'speed') this.speed = m.speed;
    }
    this.onChange();
  }
  private broadcastLobby() { this.send({ t: 'lobby', lobby: this.lobby }); this.onChange(); }

  // ----- lobby (host) -----
  configure(c: Partial<Omit<LobbyState, 'players'>>) {
    if (!this.host || this.status !== 'lobby') return;
    if (c.map && MAPS[c.map]) this.lobby.map = c.map;
    if (c.mode && MODES.some(m => m.id === c.mode)) this.lobby.mode = c.mode;
    if (c.split !== undefined) this.lobby.split = c.split;
    this.broadcastLobby();
  }
  setReady(ready: boolean) { if (this.host) return; this.send({ t: 'ready', ready }); }
  get canStart() { return this.host && this.status === 'lobby' && this.lobby.players.length >= 1 && this.lobby.players.every(p => p.ready); }
  start() { if (!this.canStart) return; this.send({ t: 'start', lobby: this.lobby }); this.begin(this.lobby); }
  private begin(lobby: LobbyState) {
    this.lobby = lobby; this.status = 'game';
    // uncertain: Monkey Knowledge is off in co-op so every peer simulates identical rules.
    const sim = createGame(lobby.map, modeById(lobby.mode).id, []);
    sim.setPlayers(lobby.players.length, lobby.split);
    this.me = Math.max(0, lobby.players.findIndex(p => p.id === this.id)); sim.actor = this.me;
    this.sim = sim; this.lock = new Lockstep(sim, this.host, (s, ok) => this.onEffect(s, ok));
    this.onStart(sim); this.onChange();
  }

  // ----- in game -----
  act(cmd: Command) { if (!this.lock) return; if (this.host) this.lock.submit(this.me, cmd); else this.send({ t: 'cmd', cmd }); }
  requestSpeed(speed: number) { if (this.host) this.speed = speed; else this.send({ t: 'speed', speed }); }
  private out: Frame = { to: 0, cmds: [] }; private lastSend = 0; private after: Msg[] = [];
  private flush() { if (this.out.to || this.out.cmds.length) this.send({ t: 'f', f: this.out }); this.out = { to: 0, cmds: [] }; for (const m of this.after) this.send(m); this.after = []; this.lastSend = performance.now(); }
  /** Per animation frame with `steps` ticks of game time. Host: simulate and batch frames (~20/s, keeps relay traffic in the free tier).
   * Clients: replay ticks at the same pace, catching up if they fall behind. */
  frame(steps: number) {
    const lock = this.lock, sim = this.sim; if (!lock || !sim || this.status !== 'game') return 0;
    if (this.host) {
      if (steps <= 0) return 0;
      const roundBefore = sim.roundActive, f = lock.advance(steps);
      this.out.to = f.to; this.out.cmds.push(...f.cmds);
      const n = lock.pump();
      if (sim.tick % 120 < n) this.after.push({ t: 'hash', tick: sim.tick, h: simHash(sim) });
      if (roundBefore && !sim.roundActive) { this.after.push({ t: 'snap', tick: sim.tick, state: sim.saveState() }); this.flush(); } // round-end resync
      else if (performance.now() - this.lastSend >= 50) this.flush();
      return n;
    }
    const lag = lock.target - sim.tick; let budget = steps + (lag > 8 ? lag - 4 : 0), n = 0;
    while (sim.tick < lock.target && budget > 0 && !sim.gameOver) {
      const stop = Math.min(lock.target, sim.tick + budget, ...this.snaps.map(s => s.tick).filter(t => t > sim.tick));
      const before = lock.target; lock.target = stop; const k = lock.pump(); lock.target = before; n += k; budget -= k;
      const snap = this.snaps.find(s => s.tick === sim.tick);
      if (snap) { sim.loadState(snap.state); sim.actor = this.me; this.desync = false; this.snaps = this.snaps.filter(s => s.tick > sim.tick); }
      const h = this.hashes.find(x => x.tick === sim.tick); if (h) this.desync = h.h !== simHash(sim);
      this.hashes = this.hashes.filter(x => x.tick > sim.tick);
      if (!k) break;
    }
    return n;
  }
}
