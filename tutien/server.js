// Server nhiều người chơi, không cần cài thêm gì:  node tutien/server.js [cổng]
// Vừa phát file game (http://localhost:8790) vừa chạy thế giới chung qua WebSocket (/ws).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { World } = require('./sim.js');
const PORT = +process.argv[2] || +process.env.PORT || 8790;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const socks = new Map(); let nid = 1;

function frame(str) {
  const b = Buffer.from(str), n = b.length;
  const h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const x = Buffer.alloc(10); x[0] = 0x81; x[1] = 127; x.writeBigUInt64BE(BigInt(n), 2); return x; })();
  return Buffer.concat([h, b]);
}
const world = new World((id, msg) => { const s = socks.get(id); if (s && !s.destroyed) s.write(frame(JSON.stringify(msg))); });

const srv = http.createServer((req, res) => {
  let f = req.url.split('?')[0]; if (f === '/') f = '/index.html';
  if (!/^\/[\w.-]+$/.test(f) || !MIME[path.extname(f)]) { res.writeHead(404); return res.end('404'); }
  fs.readFile(path.join(__dirname, f), (e, d) => { if (e) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'content-type': MIME[path.extname(f)], 'cache-control': 'no-cache' }); res.end(d); });
});
srv.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || req.url.split('?')[0] !== '/ws' || socks.size >= 300) return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
    crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64') + '\r\n\r\n');
  const id = nid++; let buf = Buffer.alloc(0), joined = false;
  socks.set(id, sock);
  const bye = () => { if (socks.delete(id) && joined) world.leave(id); sock.destroy(); };
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (buf.length > 65536) return bye();
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 15, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) return bye();
      if (!masked) return bye();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8) return bye();
      if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
      if (op !== 1) continue;
      let msg; try { msg = JSON.parse(data.toString()); } catch { continue; }
      if (!joined) { if (msg && msg.t === 'join') { joined = true; world.join(id, msg); } } else world.recv(id, msg);
    }
  });
  sock.on('close', bye); sock.on('error', bye);
});
let last = Date.now();
setInterval(() => { const now = Date.now(); world.tick(Math.min(0.1, (now - last) / 1000)); last = now; }, 50);
srv.listen(PORT, () => console.log(`Tu Tiên server: http://localhost:${PORT}`));
