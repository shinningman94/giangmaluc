// Chạy server trên máy thường (thử nghiệm hoặc tự host): node src/node-server.js [cổng]
// Cần: npm install ws
import http from 'node:http';
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { Hub } from './hub.js';
import { Accounts } from './accounts.js';

const PORT = +process.argv[2] || +process.env.PORT || 8787;
const FILE = process.env.BOARD_FILE || 'board.json';
const store = {
  get: async k => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8'))[k]; } catch { return undefined; } },
  put: async (k, v) => { let o = {}; try { o = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {} o[k] = v; fs.writeFileSync(FILE, JSON.stringify(o)); },
  delete: async k => { let o = {}; try { o = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {} delete o[k]; fs.writeFileSync(FILE, JSON.stringify(o)); },
};
const acc = new Accounts(store, { google: process.env.GOOGLE_CLIENT_ID });
const hub = new Hub({ send: (ws, s) => ws.send(s), close: (ws, code, why) => ws.close(code || 1013, why || 'full'), store, auth: acc });
const H = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'content-type': 'application/json; charset=utf-8' };
const srv = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (req.method === 'OPTIONS') { res.writeHead(204, H); return res.end(); }
  if (path.startsWith('/auth/') || path === '/save') {
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 2e6) break; }
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch {}
    const r = await acc.http(req.method, path, req.headers.authorization, body, req.socket.remoteAddress);
    if (r) { res.writeHead(r.status, H); return res.end(JSON.stringify(r.body)); }
  }
  if (req.url.startsWith('/top')) { res.writeHead(200, H); return res.end(JSON.stringify(await hub.top(50))); }
  res.writeHead(200, H); res.end(JSON.stringify({ game: 'Giáng Ma Sư Online', online: hub.online() }));
});
const wss = new WebSocketServer({ server: srv, path: '/ws', maxPayload: 8192 });
wss.on('connection', ws => {
  hub.open(ws);
  ws.on('message', d => hub.message(ws, d.toString()));
  ws.on('close', () => hub.closed(ws)); ws.on('error', () => hub.closed(ws));
});
setInterval(() => hub.flush(), 15000);
srv.listen(PORT, () => console.log('Giáng Ma Sư server: http://localhost:' + PORT + '  ws://localhost:' + PORT + '/ws'));
