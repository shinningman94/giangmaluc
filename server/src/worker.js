// Cloudflare Worker: mọi kết nối đi vào một Durable Object "World" (một thế giới chung).
//   wss://<tên>.workers.dev/ws   kết nối chơi
//   https://<tên>.workers.dev/   trạng thái (số người online)
//   https://<tên>.workers.dev/top bảng xếp hạng PvP
import { Hub } from './hub.js';

const CORS = { 'access-control-allow-origin': '*', 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(req, env) {
    const id = env.WORLD.idFromName('world-1');
    return env.WORLD.get(id).fetch(req);
  },
};

export class World {
  constructor(state, env) {
    this.state = state;
    const store = { get: k => state.storage.get(k), put: (k, v) => state.storage.put(k, v) };
    this.hub = new Hub({ send: (ws, s) => ws.send(s), close: ws => { try { ws.close(1013, 'full'); } catch {} }, store });
    this.timer = null;
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('cần websocket', { status: 426 });
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      this.hub.open(server);
      server.addEventListener('message', e => this.hub.message(server, typeof e.data === 'string' ? e.data : ''));
      const bye = () => this.hub.closed(server);
      server.addEventListener('close', bye); server.addEventListener('error', bye);
      if (!this.timer) this.timer = setInterval(() => { this.hub.flush(); if (!this.hub.online()) { clearInterval(this.timer); this.timer = null; } }, 15000);
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/top') return new Response(JSON.stringify(await this.hub.top(50)), { headers: CORS });
    return new Response(JSON.stringify({ game: 'Giáng Ma Sư Online', online: this.hub.online() }), { headers: CORS });
  }
}
