// Room relay for Monkey Pop TD co-op. GET /room/<CODE> upgrades to a WebSocket in that room's Durable Object.
// The relay is dumb on purpose: it tags each message with the sender id and forwards it to everyone else in the room.
// Game rules and the clock live in the host player's browser.
import { DurableObject } from 'cloudflare:workers';

interface Env { ROOMS: DurableObjectNamespace<Room>; ALLOWED_ORIGINS: string }
const MAX_PLAYERS = 4, MAX_MESSAGE = 512 * 1024, CODE = /^[A-Z2-9]{6}$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url), m = url.pathname.match(/^\/room\/([A-Za-z0-9]{6})$/);
    if (url.pathname === '/' || url.pathname === '/health') return new Response('mpt-relay ok');
    if (!m) return new Response('not found', { status: 404 });
    const origin = req.headers.get('Origin') ?? '';
    if (!env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin)) return new Response('origin not allowed', { status: 403 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const code = m[1].toUpperCase(); if (!CODE.test(code)) return new Response('bad code', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
  },
};

export class Room extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const peers = this.ctx.getWebSockets();
    if (peers.length >= MAX_PLAYERS) return new Response('room full', { status: 409 });
    const pair = new WebSocketPair(), id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(pair[1], [id]); // hibernation API: the object can sleep between messages
    pair[1].send(JSON.stringify({ sys: 'hello', id, peers: peers.map(w => this.ctx.getTags(w)[0]) }));
    for (const w of peers) w.send(JSON.stringify({ sys: 'join', id }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== 'string' || msg.length > MAX_MESSAGE) return;
    try { JSON.parse(msg); } catch { return; }
    const from = this.ctx.getTags(ws)[0], out = `{"from":"${from}","data":${msg}}`;
    for (const w of this.ctx.getWebSockets()) if (w !== ws) try { w.send(out); } catch { /* peer gone */ }
  }
  async webSocketClose(ws: WebSocket) { this.left(ws); }
  async webSocketError(ws: WebSocket) { this.left(ws); }
  private left(ws: WebSocket) {
    const id = this.ctx.getTags(ws)[0];
    for (const w of this.ctx.getWebSockets()) if (w !== ws) try { w.send(JSON.stringify({ sys: 'leave', id })); } catch { /* peer gone */ }
  }
}
