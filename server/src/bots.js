// 5 người chơi máy (bot) sống trên server: có tài khoản thật, đi lại trên bản đồ, trò chuyện, nhận lời thách đấu
// và có tên trên bảng xếp hạng. Bot chỉ chạy khi có người chơi thật đang online.
// Trên máy người chơi, bot trông như người thật; presence có thêm bot:1 để game biết tự đánh trận với AI
// (trận đấu bot chạy trên máy người chơi bằng AI đấu trường, kết quả gửi lên server bằng {t:'botres'}).
import { BOT_PATHS } from './botpaths.js';

const TS = 16, STEP_MS = 140, TICK = 250;
export const BOT_DEFS = [
  { u: 'LongVu_88', hn: 'Long Vũ', lv: 18, rp: 1180, w: 23, l: 17 },
  { u: 'HoaMai2k', hn: 'Hoa Mai', lv: 9, rp: 1020, w: 6, l: 8 },
  { u: 'TieuPhong', hn: 'Tiêu Phong', lv: 31, rp: 1390, w: 51, l: 22 },
  { u: 'BachLien', hn: 'Bạch Liên', lv: 24, rp: 1250, w: 30, l: 21 },
  { u: 'ThienAn99', hn: 'Thiên Ân', lv: 13, rp: 1090, w: 11, l: 12 },
];
const IDLE = [
  'Có ai đi săn ma ở Rừng Âm U không?', 'Ma Đèn Lồng đêm nay ra nhiều quá', 'Ai biết chỗ mua Hồi Hồn Đan rẻ không?',
  'Vừa thu phục được một con ngon lành', 'Đấu Trường hôm nay đông ghê', 'Ai muốn đấu thử thì thách mình nhé',
  'Lên cấp rồi, vui quá', 'Trấn Ma Ti ở đây hồi máu nhanh thật', 'Kiếp nạn này khó quá trời', 'Đi ngang qua thôi, chào cả nhà',
  'Ai còn bùa Định Vị Phù không?', 'Đêm nay trăng đẹp, săn ma thôi', 'Đội mình thiếu một con hệ hỏa',
];
const GREET = ['Chào {n}!', 'Chào {n}, mới vào à?', 'Hello {n}', '{n} ơi, chơi vui nhé', 'Xin chào {n}'];
const REPLY = ['Chào bạn!', 'Mình đây', 'Ừ, có gì không?', 'Haha đúng rồi', 'Cùng đi săn ma không?', 'Thách đấu mình đi', 'Mình đang luyện cấp', 'Ok bạn'];
const WIN = ['GG, trận hay!', 'Lần sau mình sẽ phục thù', 'Bạn mạnh thật', 'Thua tâm phục khẩu phục'];
const LOSE = ['GG! Luyện thêm rồi đấu lại nhé', 'Trận hay, cảm ơn bạn', 'Hên thôi haha', 'Thắng rồi!'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export class Bots {
  constructor(hub, defs = BOT_DEFS) {
    this.hub = hub; this.timer = null; this.ready = null;
    this.list = defs.map((d, i) => {
      const path = (BOT_PATHS[i % BOT_PATHS.length] || [[415, 487]]).map(([x, y]) => [x * TS, y * TS]);
      const k = Math.floor(Math.random() * path.length);
      return { ...d, i, path, k, dir: 1, x: path[k][0], y: path[k][1], f: 1, mv: 0, wait: rnd(0, 4000), say: null, sayI: 0, nextSay: rnd(30e3, 120e3), busy: 0,
        peer: { id: 'b' + i + Math.random().toString(36).slice(2, 6), sock: null, bot: true, dev: 'a:' + d.u.toLowerCase(), acc: { u: d.u.toLowerCase(), n: d.u }, pres: new Map(), rooms: new Set(), ok: true } };
    });
  }

  // tạo tài khoản thật cho bot (mật khẩu ngẫu nhiên, không ai đăng nhập được) và nạp thành tích đã lưu
  init() {
    return this.ready || (this.ready = (async () => {
      const st = this.hub.store, auth = this.hub.auth;
      for (const b of this.list) {
        if (auth && !(await st.get('u:' + b.u.toLowerCase()))) { try { await auth.register(b.u, crypto.getRandomValues(new Uint8Array(18)).join('x')); } catch {} }
        const s = st && await st.get('bot:' + b.u); if (s) Object.assign(b, { lv: s.lv, rp: s.rp, w: s.w, l: s.l });
      }
    })().catch(() => {}));
  }

  real() { let n = 0; for (const p of this.hub.peers.values()) if (p.ok) n++; return n; }
  start() {
    if (this.timer) return;
    this.init().then(() => {
      if (this.timer || !this.real()) return;
      for (const b of this.list) { this.hub.join(b.peer, ''); this.push(b, true); this.hub.rank(b.peer.dev, this.pres(b)); }
      let last = Date.now();
      this.timer = setInterval(() => { const now = Date.now(); this.tick(now - last, now); last = now; }, TICK);
    });
  }
  stop() {
    if (!this.timer) return; clearInterval(this.timer); this.timer = null;
    for (const b of this.list) this.hub.leave(b.peer, '');
    this.save();
  }
  async save() { const st = this.hub.store; if (!st) return; for (const b of this.list) await st.put('bot:' + b.u, { lv: b.lv, rp: b.rp, w: b.w, l: b.l }); }

  pres(b) {
    const p = { v: 1, nm: b.u, hn: b.hn, sc: b.busy ? 'pvp' : 'map', x: Math.round(b.x), y: Math.round(b.y), f: b.f, m: b.mv, lv: b.lv, rp: b.rp, w: b.w, l: b.l, bot: 1, du: null };
    if (b.say) p.say = b.say;
    return p;
  }
  push(b, force) {
    const p = this.pres(b), js = JSON.stringify(p);
    if (!force && js === b.lastJ) return; b.lastJ = js;
    b.peer.pres.set('', p);
    this.hub.cast('', JSON.stringify({ t: 'up', r: '', peer: b.peer.id, p }), null);
  }
  talk(b, t) { b.say = { i: ++b.sayI, t: String(t).slice(0, 120), at: Date.now() }; this.push(b, true); }
  later(ms, fn) { setTimeout(() => { if (this.timer) fn(); }, ms); }

  tick(dt, now) {
    if (!this.real()) return this.stop();
    for (const b of this.list) {
      if (b.busy && now > b.busy) b.busy = 0;
      if ((b.nextSay -= dt) <= 0) { b.nextSay = rnd(90e3, 240e3); if (!b.busy) this.talk(b, pick(IDLE)); }
      b.mv = 0;
      if (b.busy) { this.push(b); continue; }
      if (b.wait > 0) { b.wait -= dt; this.push(b); continue; }
      let left = dt * TS / STEP_MS;
      while (left > 0) {
        let n = b.k + b.dir;
        if (n < 0 || n >= b.path.length) { b.dir = -b.dir; b.wait = rnd(6000, 15000); break; }
        const [tx, ty] = b.path[n], dx = tx - b.x, dy = ty - b.y, d = Math.abs(dx) + Math.abs(dy);
        if (dx) b.f = dx < 0 ? -1 : 1;
        if (d <= left) { b.x = tx; b.y = ty; b.k = n; left -= d; if (Math.random() < 0.12) { b.wait = rnd(1500, 6000); break; } }
        else { b.x += Math.sign(dx) * Math.min(left, Math.abs(dx)); b.y += Math.sign(dy) * Math.min(left, Math.abs(dy)); left = 0; }
        b.mv = 1;
      }
      this.push(b);
    }
  }

  // có người chơi thật vào sảnh: một bot chào
  greet(peer) {
    this.init().then(() => setTimeout(() => {
      const p = peer.pres.get('') || {}, n = p.hn || (peer.acc && peer.acc.n); const b = pick(this.list);
      if (n && this.timer && peer.rooms.has('') && !b.busy) this.talk(b, pick(GREET).replace('{n}', n));
    }, rnd(3000, 8000)));
  }
  // người chơi chat: bot được gọi tên (hoặc lời chào chung) thì trả lời
  chat(peer, text) {
    if (!this.timer) return;
    const t = fold(text), p = peer.pres.get('') || {}, nm = p.hn || (peer.acc ? peer.acc.n : 'bạn');
    let b = this.list.find(x => t.includes(fold(x.hn)) || t.includes(fold(x.u)));
    if (!b && /\b(chao|hello|hi|xin chao|co ai)\b/.test(t) && Math.random() < 0.6) b = pick(this.list);
    if (!b || b.busy) return;
    this.later(rnd(1800, 4500), () => this.talk(b, Math.random() < 0.5 ? pick(REPLY) : nm + ' ơi, ' + pick(REPLY).toLowerCase()));
  }
  // người đang đấu với bot thoát game: bot hết bận
  gone(peer) { for (const b of this.list) if (b.foe === peer.id) { b.busy = 0; b.foe = null; this.push(b, true); } }
  byPeer(id) { return this.list.find(b => b.peer.id === id); }
  // người chơi bắt đầu đánh với bot (trận chạy trên máy người chơi)
  duel(peer, id) { const b = this.byPeer(id); if (!b || b.busy) return false; b.busy = Date.now() + 180e3; b.foe = peer.id; this.push(b, true); return true; }
  // kết quả trận: win = người chơi thắng
  result(peer, id, win, cancel) {
    const b = this.byPeer(id); if (!b || b.foe !== peer.id) return;
    b.busy = 0; b.foe = null;
    if (cancel) { this.push(b, true); return; }
    const d = Math.round(rnd(10, 22));
    if (win) { b.l++; b.rp = Math.max(700, b.rp - d); } else { b.w++; b.rp += d; }
    if (Math.random() < 0.25) b.lv = Math.min(100, b.lv + 1);
    this.later(rnd(1200, 3000), () => this.talk(b, pick(win ? WIN : LOSE)));
    this.hub.rank(b.peer.dev, this.pres(b)); this.save();
  }
}
