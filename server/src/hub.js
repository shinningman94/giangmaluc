// Lõi server Giáng Ma Sư Online: không phụ thuộc nền tảng (dùng chung cho Cloudflare Worker và Node).
// Mỗi kết nối = một "peer". Peer ở trong các phòng: '' là sảnh (cả thế giới), 'duel-xxx' là phòng đấu.
// Mỗi peer có một object presence riêng ở mỗi phòng; server phát lại cho những người cùng phòng.
//
// Giao thức (JSON):
//  client -> server
//   {t:'hello', id, v, tok}       id: mã thiết bị ngẫu nhiên lưu ở máy; tok: phiên đăng nhập (bắt buộc khi server có tài khoản)
//   {t:'p', r, p}                 đặt presence (cả object) ở phòng r ('' = sảnh)
//   {t:'join', r} / {t:'leave', r}
//   {t:'ping'}
//   {t:'botduel', b} / {t:'botres', b, win}   bắt đầu / kết thúc trận với bot b (mã peer của bot), xem bots.js
//  server -> client
//   {t:'welcome', you, n}         you: mã peer của mình
//   {t:'peers', r, list:[{peer,p}]}  ảnh chụp cả phòng (khi vào phòng)
//   {t:'up', r, peer, p}          một người đổi presence
//   {t:'gone', r, peer}           một người rời phòng
//   {t:'auth', u}                 đăng nhập xong (u: tên tài khoản), lúc này mới vào sảnh
//   {t:'err', m}                  m: 'auth' phiên hết hạn / 'dup' tài khoản vừa vào từ máy khác (server đóng kết nối)

export const LIMITS = { maxPeers: 400, maxRoomsPerPeer: 8, maxPresence: 4096, maxMsgPerSec: 45, maxDuelRoom: 4 };
const ROOM_RE = /^duel-[a-z0-9]{4,16}$/;
const ID_RE = /^[a-zA-Z0-9_-]{6,40}$/;
const BAD = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
import { Bots } from './bots.js';
const clean = (s, n) => String(s || '').replace(BAD, '').trim().slice(0, n);

export class Hub {
  // send(sock, string), close(sock, code, reason) do nơi gọi cung cấp; store: {get(k), put(k,v)} hoặc null
  // auth: Accounts (accounts.js) thì bắt buộc đăng nhập mới vào sảnh, tên hiển thị là tên tài khoản
  constructor({ send, close, store, auth = null, bots = true }) {
    this.send = send; this.close = close; this.store = store; this.auth = auth;
    this.peers = new Map();   // sock -> peer
    this.rooms = new Map();   // name -> Map(peerId -> peer)
    this.seq = 0;
    this.board = null; this.boardDirty = false;
    this.bots = bots ? new Bots(this) : null;
  }
  online() { return this.peers.size; }

  open(sock) {
    if (this.peers.size >= LIMITS.maxPeers) { this.send(sock, JSON.stringify({ t: 'err', m: 'full' })); this.close(sock, 1013, 'full'); return; }
    const peer = { id: 'p' + (++this.seq).toString(36) + Math.random().toString(36).slice(2, 6), sock, dev: null, pres: new Map(), rooms: new Set(), tb: 0, tn: 0, ok: !this.auth, acc: null, q: null };
    this.peers.set(sock, peer);
    this.out(peer, { t: 'welcome', you: peer.id, n: this.peers.size });
    if (peer.ok) { this.join(peer, ''); if (this.bots) this.bots.start(); }
  }

  message(sock, raw) {
    const peer = this.peers.get(sock); if (!peer) return;
    const now = Date.now();
    if (now - peer.tb > 1000) { peer.tb = now; peer.tn = 0; }
    if (++peer.tn > LIMITS.maxMsgPerSec) return; // gửi quá nhanh: bỏ qua
    if (typeof raw !== 'string' || raw.length > LIMITS.maxPresence + 200) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ping') return this.out(peer, { t: 'pong' });
    if (m.t === 'hello') {
      if (!this.auth) { if (ID_RE.test(m.id || '')) peer.dev = m.id; return; }
      if (peer.ok || peer.q) return;
      peer.q = [];
      this.auth.verify(m.tok).then(a => this.authed(peer, a), () => this.authed(peer, null));
      return;
    }
    if (!peer.ok) { if (peer.q && peer.q.length < 40) peer.q.push(raw); return; } // chờ xác minh phiên xong
    const r = typeof m.r === 'string' ? m.r : '';
    if (r !== '' && !ROOM_RE.test(r)) return;
    if (m.t === 'join') return this.join(peer, r);
    if (m.t === 'leave') return r ? this.leave(peer, r) : undefined;
    if (m.t === 'botduel' && this.bots && typeof m.b === 'string') return void this.bots.duel(peer, m.b);
    if (m.t === 'botres' && this.bots && typeof m.b === 'string') return void this.bots.result(peer, m.b, !!m.win, !!m.cancel);
    if (m.t === 'p') {
      if (!peer.rooms.has(r) || !m.p || typeof m.p !== 'object' || Array.isArray(m.p)) return;
      const p = m.p; if (peer.acc) p.nm = peer.acc.n; else if (typeof p.nm === 'string') p.nm = clean(p.nm, 18);
      const js = JSON.stringify(p); if (js.length > LIMITS.maxPresence) return;
      peer.pres.set(r, p);
      this.cast(r, JSON.stringify({ t: 'up', r, peer: peer.id, p }), peer);
      if (r === '' && peer.dev && typeof p.rp === 'number') this.rank(peer.dev, p);
      if (r === '' && this.bots) { // lời chat mới (bỏ qua câu cũ còn trong presence lúc mới vào)
        const si = p.say && typeof p.say.t === 'string' ? p.say.i : null;
        if (!('sayI' in peer)) peer.sayI = si; else if (si !== null && si !== peer.sayI) { peer.sayI = si; this.bots.chat(peer, p.say.t); }
      }
    }
  }

  authed(peer, a) {
    if (!this.peers.has(peer.sock)) return;
    if (!a) { this.out(peer, { t: 'err', m: 'auth' }); this.close(peer.sock, 4001, 'auth'); return; }
    // một tài khoản chỉ chơi ở một nơi: máy vào sau đẩy máy trước ra (tránh hai máy ghi đè bản lưu của nhau)
    for (const q of this.peers.values()) if (q !== peer && q.acc && q.acc.u === a.u) { this.out(q, { t: 'err', m: 'dup' }); this.close(q.sock, 4002, 'dup'); this.closed(q.sock); }
    peer.acc = a; peer.dev = 'a:' + a.u; peer.ok = true;
    this.out(peer, { t: 'auth', u: a.n });
    this.join(peer, '');
    if (this.bots) { this.bots.start(); this.bots.greet(peer); }
    const q = peer.q; peer.q = null;
    for (const raw of q) this.message(peer.sock, raw);
  }

  join(peer, r) {
    if (peer.rooms.has(r)) return;
    if (peer.rooms.size >= LIMITS.maxRoomsPerPeer) return this.out(peer, { t: 'err', m: 'rooms' });
    let room = this.rooms.get(r); if (!room) { room = new Map(); this.rooms.set(r, room); }
    if (r && room.size >= LIMITS.maxDuelRoom) return this.out(peer, { t: 'err', m: 'room full' });
    room.set(peer.id, peer); peer.rooms.add(r); peer.pres.set(r, {});
    this.out(peer, { t: 'peers', r, list: [...room.values()].map(q => ({ peer: q.id, p: q.pres.get(r) || {} })) });
    this.cast(r, JSON.stringify({ t: 'up', r, peer: peer.id, p: {} }), peer);
  }
  leave(peer, r) {
    const room = this.rooms.get(r); if (!room || !room.has(peer.id)) return;
    room.delete(peer.id); peer.rooms.delete(r); peer.pres.delete(r);
    if (!room.size && r) this.rooms.delete(r);
    this.cast(r, JSON.stringify({ t: 'gone', r, peer: peer.id }), null);
  }
  closed(sock) {
    const peer = this.peers.get(sock); if (!peer) return;
    for (const r of [...peer.rooms]) this.leave(peer, r);
    this.peers.delete(sock);
    if (this.bots) this.bots.gone(peer);
  }

  out(peer, o) { if (!peer.sock) return; try { this.send(peer.sock, JSON.stringify(o)); } catch { this.closed(peer.sock); } }
  cast(r, s, except) {
    const room = this.rooms.get(r); if (!room) return;
    for (const q of room.values()) if (q !== except && q.sock) { try { this.send(q.sock, s); } catch { /* đóng sau */ } }
  }

  // ---- bảng xếp hạng PvP (số liệu do máy người chơi gửi lên) ----
  loadBoard() { return this.boardP || (this.boardP = (async () => { this.board = (this.store && await this.store.get('board')) || {}; return this.board; })()); }
  async rank(dev, p) {
    const b = await this.loadBoard(); const w = p.w | 0, l = p.l | 0;
    if (!w && !l && !b[dev]) return;
    const o = b[dev];
    const hn = clean(p.hn, 12);
    if (o && o.rp === (p.rp | 0) && o.w === w && o.l === l && o.nm === p.nm && (o.hn || '') === hn) return;
    b[dev] = { nm: clean(p.nm, 18) || 'Pháp Sư', hn, rp: p.rp | 0, w, l, lv: p.lv | 0, at: Date.now() };
    const keys = Object.keys(b); if (keys.length > 2000) { keys.sort((x, y) => b[x].at - b[y].at).slice(0, keys.length - 2000).forEach(k => delete b[k]); }
    this.boardDirty = true;
  }
  async flush() { if (this.boardDirty && this.store) { this.boardDirty = false; await this.store.put('board', this.board); } }
  async top(n = 50) {
    const b = await this.loadBoard();
    return Object.values(b).sort((x, y) => y.rp - x.rp).slice(0, n).map(({ nm, hn, rp, w, l, lv }) => ({ nm, hn: hn || '', rp, w, l, lv }));
  }
}
