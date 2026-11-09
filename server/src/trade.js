// Giao dịch giữa người chơi (chỉ server có tài khoản): Chợ (treo bán lấy bạc) và Giao dịch trực tiếp 1-1.
// Vật phẩm giao dịch được: trang bị trong túi ('it') và đồng hành / pet ('u'), cộng thêm bạc ('s').
//
// Đồ luôn đi theo một chiều: máy người chơi bỏ đồ ra khỏi bản lưu và gửi lên ("ký gửi", có mã n),
// server giữ, rồi chuyển vào Hòm thư của người nhận; máy người nhận lấy đồ từ hòm thư vào bản lưu rồi báo đã nhận.
// Mỗi lần ký gửi có kết quả {t:'xr', n, ok}: ok=1 server đã giữ đồ (máy xóa bản ký gửi), ok=0 trả đồ lại cho máy.
// Kết quả được ghi lại trong kho (xn:<tài khoản>) để máy mất kết nối giữa chừng hỏi lại bằng xchk mà không mất hay nhân đôi đồ.
//
//  client -> server
//   {t:'mlist', k?, q?, o?}       xem chợ: k 'it' | 'u' (lọc loại), q tìm theo tên, o vị trí trang
//   {t:'mmine'}                   các món mình đang treo bán
//   {t:'msell', n, k, d, p}       treo bán (ký gửi): d vật phẩm / đồng hành, p giá bạc
//   {t:'mbuy', n, id, p}          mua món id với giá p (ký gửi p bạc); đồ vào hòm thư, bạc (trừ phí) vào hòm thư người bán
//   {t:'mcancel', id}             gỡ món đang bán, đồ về hòm thư
//   {t:'tinv', to} / {t:'tans', from, ok}   mời giao dịch trực tiếp / trả lời
//   {t:'toff', its:[{k,d}], s}    đặt đồ + bạc định đưa (chỉ để xem, chưa trừ); đổi lời đề nghị thì bỏ khóa của cả hai
//   {t:'tlock'}                   khóa lời đề nghị;  {t:'tok', n, its, s}  xác nhận cuối (ký gửi đúng lời đề nghị đã khóa)
//   {t:'tcancel'}
//   {t:'mack', ids}               đã lấy các thư ids vào bản lưu
//   {t:'xchk', ns}                hỏi kết quả các lần ký gửi chưa có trả lời (sau khi nối lại)
//  server -> client
//   {t:'mkt', k, q, o, tot, list:[{id, k, d, p, sn, at, mine}]}   {t:'mmine', list}
//   {t:'xr', n, ok, m?}           kết quả ký gửi
//   {t:'mail', list:[{id, k, d?, s?, m, at}]}   hòm thư (cả danh sách)
//   {t:'tinv', from}              có người mời giao dịch
//   {t:'trade', w, me:{its,s,lock,ok}, them:{its,s,lock,ok}} | {t:'trade', w:null}
//   {t:'note', ch:'trade', m}
const BAD = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
const clean = (s, n) => String(s || '').replace(BAD, '').replace(/\s+/g, ' ').trim().slice(0, n);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
export const TRD = {
  maxObj: 4096,        // một vật phẩm / đồng hành tối đa bấy nhiêu ký tự JSON
  maxSell: 8,          // mỗi người treo bán tối đa
  maxMarket: 600,      // cả chợ tối đa
  maxPrice: 9999999, minPrice: 1,
  fee: 0.05,           // phí chợ (bạc biến mất khỏi game)
  days: 3,             // treo quá bấy nhiêu ngày thì đồ tự về hòm thư người bán
  page: 30, tradeItems: 6, invMs: 60e3, nonces: 120, maxSilver: 99999999,
};
const N_RE = /^[a-z0-9]{6,24}$/;
const SLOTS = new Set(['w', 'a', 't', 'b']);

// kiểm tra vật phẩm / đồng hành gửi lên: trả bản sạch hoặc null
export function checkObj(k, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  let js; try { js = JSON.stringify(d); } catch { return null; }
  if (js.length > TRD.maxObj) return null;
  const o = JSON.parse(js);
  if (k === 'it') {
    if (!SLOTS.has(o.s) || typeof o.n !== 'string' || !clean(o.n, 40) || typeof o.v !== 'number' || !isFinite(o.v)) return null;
    return o;
  }
  if (k === 'u') {
    if (typeof o.id !== 'string' || !/^[a-z0-9_]{2,24}$/.test(o.id) || o.id === 'diep' || typeof o.lv !== 'number' || !(o.lv >= 1)) return null;
    if (typeof o.name !== 'string' || !clean(o.name, 40)) return null;
    return o;
  }
  return null;
}
const objName = (k, d) => clean(k === 'u' ? d.name : d.n, 40);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export class Trade {
  constructor(hub) {
    this.hub = hub; this.q = Promise.resolve();
    this.trades = new Map(); // tài khoản -> phiên giao dịch (cả hai người cùng trỏ vào một object)
    this.inv = new Map();    // tài khoản được mời -> {from, at}
  }
  st() { return this.hub.store; }
  // mọi thao tác đọc rồi ghi kho chạy lần lượt để hai lệnh không chen nhau (ví dụ hai người cùng mua một món)
  serial(fn) { const p = this.q.then(fn, fn); this.q = p.catch(() => {}); return p; }
  online(u) { for (const p of this.hub.peers.values()) if (p.ok && p.acc && p.acc.u === u) return p; return null; }
  out(peer, o) { if (peer) this.hub.out(peer, o); }
  note(peer, m) { this.out(peer, { t: 'note', ch: 'trade', m }); }

  static TYPES = new Set(['mlist', 'mmine', 'msell', 'mbuy', 'mcancel', 'tinv', 'tans', 'toff', 'tlock', 'tok', 'tcancel', 'mack', 'xchk']);
  handle(peer, m) {
    if (!peer.acc || !this.st()) return;
    switch (m.t) {
      case 'tinv': return this.tinv(peer, m);
      case 'tans': return this.tans(peer, m);
      case 'toff': return this.toff(peer, m);
      case 'tlock': return this.tlock(peer);
      case 'tcancel': return void this.serial(() => this.tcancel(peer, 'Đã hủy giao dịch.'));
      default: return void this.serial(() => this[m.t](peer, m)).catch(e => console.error('trade', m.t, e));
    }
  }

  // ---------- kết quả ký gửi (chống mất / nhân đôi đồ khi rớt mạng) ----------
  async xget(u) { return (await this.st().get('xn:' + u)) || {}; }
  async xset(u, n, ok) {
    const x = await this.xget(u); x[n] = ok ? 1 : 0;
    const ks = Object.keys(x); for (const k of ks.slice(0, Math.max(0, ks.length - TRD.nonces))) delete x[k];
    await this.st().put('xn:' + u, x);
  }
  async xr(u, n, ok, m) { await this.xset(u, n, ok); this.out(this.online(u), { t: 'xr', n, ok: ok ? 1 : 0, m: m || undefined }); }
  async xchk(peer, m) {
    const ns = Array.isArray(m.ns) ? m.ns.filter(n => typeof n === 'string' && N_RE.test(n)).slice(0, 40) : [];
    const x = await this.xget(peer.acc.u), T = this.trades.get(peer.acc.u);
    for (const n of ns) {
      if (n in x) { this.out(peer, { t: 'xr', n, ok: x[n] }); continue; }
      if (T && T[T.a === peer.acc.u ? 'A' : 'B'].n === n) continue; // đang chờ người kia xác nhận
      await this.xr(peer.acc.u, n, false); // server chưa từng nhận: trả đồ lại cho máy
    }
  }
  async seen(peer, n) { // mã ký gửi đã dùng rồi thì chỉ gửi lại kết quả cũ
    const x = await this.xget(peer.acc.u);
    if (n in x) { this.out(peer, { t: 'xr', n, ok: x[n] }); return true; }
    return false;
  }

  // ---------- hòm thư (mb:<tài khoản>) ----------
  async mail(u, e) {
    const L = (await this.st().get('mb:' + u)) || [];
    L.push({ id: 'm' + rid(), at: Date.now(), ...e });
    await this.st().put('mb:' + u, L);
    const p = this.online(u); if (p) this.out(p, { t: 'mail', list: L });
  }
  async mack(peer, m) {
    const ids = new Set(Array.isArray(m.ids) ? m.ids.filter(x => typeof x === 'string').slice(0, 200) : []);
    if (!ids.size) return;
    const L = (await this.st().get('mb:' + peer.acc.u)) || [], R = L.filter(e => !ids.has(e.id));
    if (R.length !== L.length) { if (R.length) await this.st().put('mb:' + peer.acc.u, R); else await this.st().delete('mb:' + peer.acc.u); }
  }
  async login(peer) {
    if (!this.st()) return;
    await this.serial(async () => {
      await this.sweep();
      this.out(peer, { t: 'mail', list: (await this.st().get('mb:' + peer.acc.u)) || [] });
    });
  }

  // ---------- chợ: ml:<mã> món hàng, mli danh sách tóm tắt [{id,u,sn,k,p,at,nm}] ----------
  async idx() { return (await this.st().get('mli')) || []; }
  // món treo quá hạn: trả về hòm thư người bán
  async sweep() {
    const I = await this.idx(), lim = Date.now() - TRD.days * 864e5, old = I.filter(e => e.at < lim);
    if (!old.length) return;
    await this.st().put('mli', I.filter(e => e.at >= lim));
    for (const e of old) {
      const L = await this.st().get('ml:' + e.id); await this.st().delete('ml:' + e.id);
      if (L) await this.mail(e.u, { k: L.k, d: L.d, m: 'Hết hạn treo bán ở Chợ, trả lại ' + e.nm + '.' });
    }
  }
  async mlist(peer, m) {
    await this.sweep();
    const k = m.k === 'it' || m.k === 'u' ? m.k : '', q = fold(clean(m.q, 24)), o = Math.max(0, m.o | 0);
    const I = (await this.idx()).filter(e => (!k || e.k === k) && (!q || fold(e.nm).includes(q))).sort((a, b) => b.at - a.at);
    const list = [];
    for (const e of I.slice(o, o + TRD.page)) {
      const L = await this.st().get('ml:' + e.id); if (!L) continue;
      list.push({ id: e.id, k: e.k, d: L.d, p: e.p, sn: e.sn, at: e.at, mine: e.u === peer.acc.u ? 1 : 0 });
    }
    this.out(peer, { t: 'mkt', k, q: clean(m.q, 24), o, tot: I.length, list });
  }
  async mmine(peer) {
    const I = (await this.idx()).filter(e => e.u === peer.acc.u), list = [];
    for (const e of I) { const L = await this.st().get('ml:' + e.id); if (L) list.push({ id: e.id, k: e.k, d: L.d, p: e.p, at: e.at, exp: e.at + TRD.days * 864e5 }); }
    this.out(peer, { t: 'mmine', list });
  }
  async msell(peer, m) {
    const n = String(m.n || ''); if (!N_RE.test(n)) return;
    if (await this.seen(peer, n)) return;
    const u = peer.acc.u, k = m.k, d = checkObj(k, m.d), p = Math.floor(+m.p);
    if (!d) return this.xr(u, n, false, 'Món này không bán được.');
    if (!(p >= TRD.minPrice && p <= TRD.maxPrice)) return this.xr(u, n, false, 'Giá bán từ ' + TRD.minPrice + ' đến ' + TRD.maxPrice + ' bạc.');
    const I = await this.idx();
    if (I.filter(e => e.u === u).length >= TRD.maxSell) return this.xr(u, n, false, 'Mỗi người treo bán tối đa ' + TRD.maxSell + ' món cùng lúc.');
    if (I.length >= TRD.maxMarket) return this.xr(u, n, false, 'Chợ đã đầy hàng, thử lại sau.');
    const at = Date.now(), nm = objName(k, d);
    await this.st().put('ml:' + n, { k, d });
    I.push({ id: n, u, sn: peer.acc.n, k, p, at, nm }); await this.st().put('mli', I);
    await this.xr(u, n, true);
    this.note(peer, 'Đã treo bán ' + nm + ' giá ' + p + ' bạc. Sau ' + TRD.days + ' ngày chưa ai mua thì đồ về Hòm thư.');
  }
  async mbuy(peer, m) {
    const n = String(m.n || ''); if (!N_RE.test(n)) return;
    if (await this.seen(peer, n)) return;
    const u = peer.acc.u, I = await this.idx(), i = I.findIndex(e => e.id === m.id), e = I[i];
    if (!e) return this.xr(u, n, false, 'Món này vừa được bán hoặc đã gỡ khỏi chợ.');
    if (e.u === u) return this.xr(u, n, false, 'Không mua được món của chính mình. Muốn lấy lại thì bấm Gỡ.');
    if ((m.p | 0) !== e.p) return this.xr(u, n, false, 'Giá đã đổi, xem lại chợ.');
    const L = await this.st().get('ml:' + e.id);
    I.splice(i, 1); await this.st().put('mli', I); await this.st().delete('ml:' + e.id);
    if (!L) return this.xr(u, n, false, 'Món này không còn nữa.');
    await this.xr(u, n, true);
    const got = e.p - Math.floor(e.p * TRD.fee);
    await this.mail(u, { k: L.k, d: L.d, m: 'Mua ở Chợ: ' + e.nm + ' của ' + e.sn + ' (' + e.p + ' bạc).' });
    await this.mail(e.u, { k: 's', s: got, m: peer.acc.n + ' đã mua ' + e.nm + ': +' + got + ' bạc (giá ' + e.p + ', phí chợ ' + Math.round(TRD.fee * 100) + '%).' });
    this.note(this.online(e.u), peer.acc.n + ' đã mua ' + e.nm + '. Bạc nằm trong Hòm thư.');
  }
  async mcancel(peer, m) {
    const I = await this.idx(), i = I.findIndex(e => e.id === m.id && e.u === peer.acc.u), e = I[i];
    if (!e) { this.note(peer, 'Món này đã được bán hoặc đã gỡ.'); return this.mmine(peer); }
    const L = await this.st().get('ml:' + e.id);
    I.splice(i, 1); await this.st().put('mli', I); await this.st().delete('ml:' + e.id);
    if (L) await this.mail(peer.acc.u, { k: L.k, d: L.d, m: 'Gỡ khỏi Chợ: ' + e.nm + '.' });
    await this.mmine(peer);
  }

  // ---------- giao dịch trực tiếp (chỉ trong bộ nhớ, cả hai phải online) ----------
  side(T, u) { return T.a === u ? T.A : T.B; }
  other(T, u) { return T.a === u ? T.B : T.A; }
  tstate(T) {
    const view = S => ({ its: S.its, s: S.s, lock: S.lock ? 1 : 0, ok: S.n ? 1 : 0 });
    for (const [u, w] of [[T.a, T.bn], [T.b, T.an]]) this.out(this.online(u), { t: 'trade', w, me: view(this.side(T, u)), them: view(this.other(T, u)) });
  }
  tinv(peer, m) {
    const to = this.online(String(m.to || '').toLowerCase().trim());
    if (!to) return this.note(peer, 'Người chơi ' + clean(m.to, 18) + ' không online.');
    if (to === peer) return;
    if (this.trades.has(peer.acc.u)) return this.note(peer, 'Thầy đang giao dịch rồi. Hủy giao dịch cũ trước.');
    if (this.trades.has(to.acc.u)) return this.note(peer, to.acc.n + ' đang giao dịch với người khác.');
    this.inv.set(to.acc.u, { from: peer.acc.u, at: Date.now() });
    this.out(to, { t: 'tinv', from: peer.acc.n });
    this.note(peer, 'Đã mời ' + to.acc.n + ' giao dịch. Chờ người đó đồng ý.');
  }
  tans(peer, m) {
    const I = this.inv.get(peer.acc.u); this.inv.delete(peer.acc.u);
    const from = I && this.online(I.from);
    if (!I || !from || Date.now() - I.at > TRD.invMs || String(m.from || '').toLowerCase() !== I.from) return this.note(peer, 'Lời mời giao dịch đã hết hạn.');
    if (!m.ok) return this.note(from, peer.acc.n + ' từ chối giao dịch.');
    if (this.trades.has(peer.acc.u) || this.trades.has(from.acc.u)) return this.note(peer, 'Một trong hai người đang giao dịch với người khác.');
    const S = () => ({ its: [], s: 0, lock: false, n: null, sent: null });
    const T = { a: from.acc.u, an: from.acc.n, b: peer.acc.u, bn: peer.acc.n, A: S(), B: S(), at: Date.now() };
    this.trades.set(T.a, T); this.trades.set(T.b, T);
    this.tstate(T);
    this.note(from, peer.acc.n + ' đồng ý giao dịch.');
  }
  toff(peer, m) {
    const T = this.trades.get(peer.acc.u); if (!T) return;
    const me = this.side(T, peer.acc.u), op = this.other(T, peer.acc.u);
    if (me.n || op.n) return this.note(peer, 'Đã có người xác nhận, không đổi được nữa. Hủy giao dịch nếu muốn làm lại.');
    const raw = Array.isArray(m.its) ? m.its.slice(0, TRD.tradeItems) : [], its = [];
    for (const x of raw) { const d = x && checkObj(x.k, x.d); if (d) its.push({ k: x.k, d }); }
    const s = Math.max(0, Math.min(TRD.maxSilver, Math.floor(+m.s) || 0));
    me.its = its; me.s = s; me.lock = false; op.lock = false; // đổi lời đề nghị: cả hai phải khóa lại
    this.tstate(T);
  }
  tlock(peer) {
    const T = this.trades.get(peer.acc.u); if (!T) return;
    const me = this.side(T, peer.acc.u); if (me.n) return;
    me.lock = true; this.tstate(T);
  }
  async tok(peer, m) {
    const n = String(m.n || ''); if (!N_RE.test(n)) return;
    if (await this.seen(peer, n)) return;
    const u = peer.acc.u, T = this.trades.get(u);
    if (!T) return this.xr(u, n, false, 'Giao dịch đã kết thúc.');
    const me = this.side(T, u), op = this.other(T, u);
    if (!me.lock || !op.lock) return this.xr(u, n, false, 'Cả hai cần khóa lời đề nghị trước khi xác nhận.');
    if (me.n) return this.xr(u, n, false, 'Thầy đã xác nhận rồi.');
    // đồ máy gửi lên phải đúng lời đề nghị đã khóa (người kia đã nhìn thấy)
    const sent = { its: (Array.isArray(m.its) ? m.its : []).map(x => ({ k: x && x.k, d: x && checkObj(x.k, x.d) })), s: Math.floor(+m.s) || 0 };
    if (JSON.stringify(sent) !== JSON.stringify({ its: me.its, s: me.s })) return this.xr(u, n, false, 'Đồ xác nhận khác lời đề nghị, giao dịch bị hủy.').then(() => this.tcancel(peer, 'Giao dịch bị hủy.'));
    me.n = n; me.sent = sent;
    if (!op.n) { this.tstate(T); return; }
    // cả hai đã xác nhận: chuyển đồ vào hòm thư của nhau
    this.tend(T);
    const fin = async (from, to, S, fromN) => {
      await this.xr(from, S.n, true);
      for (const x of S.sent.its) await this.mail(to, { k: x.k, d: x.d, m: 'Giao dịch với ' + fromN + ': nhận ' + objName(x.k, x.d) + '.' });
      if (S.sent.s > 0) await this.mail(to, { k: 's', s: S.sent.s, m: 'Giao dịch với ' + fromN + ': nhận ' + S.sent.s + ' bạc.' });
    };
    await fin(T.a, T.b, T.A, T.an); await fin(T.b, T.a, T.B, T.bn);
    for (const x of [T.a, T.b]) { const p = this.online(x); this.out(p, { t: 'trade', w: null }); this.note(p, 'Giao dịch xong! Đồ nhận được nằm trong Hòm thư.'); }
  }
  tend(T) { if (this.trades.get(T.a) === T) this.trades.delete(T.a); if (this.trades.get(T.b) === T) this.trades.delete(T.b); }
  async tcancel(peer, why) {
    const T = this.trades.get(peer.acc.u); if (!T) return this.out(peer, { t: 'trade', w: null });
    this.tend(T);
    for (const [u, S] of [[T.a, T.A], [T.b, T.B]]) {
      if (S.n) await this.xr(u, S.n, false); // đã ký gửi lúc xác nhận: trả lại
      const p = this.online(u); this.out(p, { t: 'trade', w: null }); if (p) this.note(p, p === peer ? why : peer.acc.n + ' đã hủy giao dịch.');
    }
  }

  // người chơi thoát: hủy giao dịch đang dở (đồ đã ký gửi được trả lại khi máy đó nối lại)
  async gone(peer) {
    if (!peer.acc) return;
    this.inv.delete(peer.acc.u);
    if (this.trades.has(peer.acc.u)) await this.serial(() => this.tcancel(peer, 'Giao dịch bị hủy vì mất kết nối.'));
  }
}
