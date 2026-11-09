// Cloudflare Worker: mọi kết nối đi vào một Durable Object "World" (một thế giới chung).
//   wss://<tên>.workers.dev/ws   kết nối chơi
//   https://<tên>.workers.dev/   trạng thái (số người online)
//   https://<tên>.workers.dev/top bảng xếp hạng PvP
//   /auth/register, /auth/login, /auth/logout, /auth/me, /save   tài khoản và bản lưu theo tài khoản
//   /auth/google, /auth/config   đăng nhập bằng Google (bật khi có biến GOOGLE_CLIENT_ID)
//   /admin, /admin/api/*         trang quản trị (bật khi có biến bí mật ADMIN_KEY), xem admin.js
import { Hub } from './hub.js';
import { Accounts } from './accounts.js';
import { allowOrigin } from './origin.js';
import { Admin } from './admin.js';
import { ADMIN_PAGE } from './admin-page.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(req, env) {
    const id = env.WORLD.idFromName('world-1');
    return env.WORLD.get(id).fetch(req);
  },
};

export class World {
  constructor(state, env) {
    this.state = state;
    const store = { get: k => state.storage.get(k), put: (k, v) => state.storage.put(k, v), delete: k => state.storage.delete(k), list: async p => [...(await state.storage.list({ prefix: p })).keys()] };
    this.allow = env.ALLOW_ORIGINS;
    this.acc = new Accounts(store, { google: env.GOOGLE_CLIENT_ID });
    this.hub = new Hub({ send: (ws, s) => ws.send(s), close: (ws, code, why) => { try { ws.close(code || 1013, why || 'full'); } catch {} }, store, auth: this.acc });
    this.admin = new Admin(this.hub, store, env.ADMIN_KEY);
    this.timer = null;
  }
  async fetch(req) {
    const url = new URL(req.url);
    // Chặn các trang web nhái (Origin lạ) trước khi làm bất cứ việc gì
    if (!allowOrigin(req.headers.get('Origin'), this.allow)) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 403 });
      return new Response(JSON.stringify({ err: 'origin' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }
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
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname.startsWith('/auth/') || url.pathname === '/save') {
      let body = null;
      if (req.method === 'POST' || req.method === 'PUT') { try { body = await req.json(); } catch { body = null; } }
      const r = await this.acc.http(req.method, url.pathname, req.headers.get('authorization'), body, req.headers.get('cf-connecting-ip'));
      if (r) return new Response(JSON.stringify(r.body), { status: r.status, headers: CORS });
    }
    if (url.pathname === '/admin' || url.pathname === '/admin/') return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' } });
    if (url.pathname.startsWith('/admin/api/')) {
      let body = null;
      if (req.method === 'POST') { try { body = await req.json(); } catch { body = null; } }
      const r = await this.admin.http(req.method, url.pathname, req.headers.get('authorization'), body, req.headers.get('cf-connecting-ip'), url.searchParams);
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/top') return new Response(JSON.stringify(await this.hub.top(50)), { headers: CORS });
    return new Response(JSON.stringify({ game: 'Giáng Ma Sư Online', online: this.hub.online() }), { headers: CORS });
  }
}
