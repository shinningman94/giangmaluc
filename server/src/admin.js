// Quản trị server (chỉ chủ game): tìm người chơi, khóa / mở khóa nick, đá khỏi game, gửi thư và quà vào Hòm thư.
// Bật bằng biến bí mật ADMIN_KEY (Cloudflare: Workers > game > Settings > Variables and Secrets, loại Secret).
// Không có ADMIN_KEY thì mọi đường /admin/api/* trả 404. Trang quản trị: /admin (admin-page.js).
//
// HTTP (header  authorization: Bearer <ADMIN_KEY>)
//   GET  /admin/api/stats                       {online, users}
//   GET  /admin/api/users?q=&o=                 tìm theo tên (q rỗng = tất cả), 50 người mỗi trang từ vị trí o
//   GET  /admin/api/user?u=                     chi tiết một người (cấp, bạc, công đức, thuốc đọc từ bản lưu)
//   POST /admin/api/ban    {u, days, why}       days 0 = vĩnh viễn; người đang online bị đẩy ra ngay
//   POST /admin/api/unban  {u}
//   POST /admin/api/kick   {u}                  đẩy ra khỏi game (không khóa)
//   POST /admin/api/mail   {to, m, s, hp, mp, mer}   to: 'tên' | ['tên', ...] | '*' (mọi tài khoản)
//                                               thư vào Hòm thư (mb:<tên>) dạng {k:'g', d:{s,hp,mp,mer}, m}; máy người chơi tự cộng quà
//   GET  /admin/api/log                         100 việc quản trị gần nhất
import { same, banOf } from './accounts.js';

const BAD = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
const clean = (s, n) => String(s || '').replace(BAD, '').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(+v) || 0));
export const ADM = { page: 50, maxTo: 5000, maxS: 10000000, maxPill: 999, maxMer: 1000000, msg: 300, tries: 10 };

export class Admin {
  // hub: Hub (để biết ai online, đẩy người ra, gửi Hòm thư qua hub.trade); store cần thêm list(prefix) -> [khóa]
  constructor(hub, store, key) { this.hub = hub; this.store = store; this.key = String(key || ''); this.fails = new Map(); }
  on() { return this.key.length >= 12; }

  async http(method, path, auth, body, ip, query) {
    if (!this.on()) return { status: 404, body: { err: 'Server chưa bật quản trị (thiếu ADMIN_KEY)' } };
    const k = ip || '?', f = this.fails.get(k), now = Date.now();
    if (f && f.n >= ADM.tries && now - f.t < 600e3) return { status: 429, body: { err: 'Sai mã quá nhiều lần, đợi 10 phút' } };
    if (!same((auth || '').replace(/^Bearer\s+/i, ''), this.key)) {
      this.fails.set(k, { n: (f && now - f.t < 600e3 ? f.n : 0) + 1, t: now }); if (this.fails.size > 2000) this.fails.clear();
      return { status: 401, body: { err: 'Sai mã quản trị' } };
    }
    this.fails.delete(k);
    const q = query || new URLSearchParams(), b = body || {};
    const want = m => method === m;
    try {
      switch (path) {
        case '/admin/api/stats': return ok({ online: this.hub.online(), users: (await this.users()).length });
        case '/admin/api/users': return ok(await this.find(q.get('q') || '', +q.get('o') || 0));
        case '/admin/api/user': return this.user(q.get('u'));
        case '/admin/api/log': return ok({ list: (await this.store.get('adm:log')) || [] });
        case '/admin/api/ban': return want('POST') ? this.ban(b.u, b.days, b.why) : bad('POST');
        case '/admin/api/unban': return want('POST') ? this.unban(b.u) : bad('POST');
        case '/admin/api/kick': return want('POST') ? this.kickU(b.u) : bad('POST');
        case '/admin/api/mail': return want('POST') ? this.mail(b) : bad('POST');
      }
    } catch (e) { return { status: 500, body: { err: String(e && e.message || e) } }; }
    return { status: 404, body: { err: 'Không có' } };
  }

  async users() { return (await this.store.list('u:')).map(x => x.slice(2)); }
  async rec(u) { u = String(u || '').trim().toLowerCase(); return /^[a-z0-9_]{1,24}$/.test(u) ? { u, r: await this.store.get('u:' + u) } : { u, r: null }; }
  row(u, r) { const b = banOf(r); return { u, n: r.n, at: r.at || 0, on: this.hub.isOn(u), ban: b, g: !!r.g }; }

  async find(q, o) {
    q = q.trim().toLowerCase();
    let L = await this.users(); if (q) L = L.filter(u => u.includes(q));
    L.sort(); const tot = L.length, page = L.slice(Math.max(0, o), Math.max(0, o) + ADM.page);
    const list = [];
    for (const u of page) { const r = await this.store.get('u:' + u); if (r) list.push(this.row(u, r)); }
    return { tot, o, list };
  }

  async user(u) {
    const { u: k, r } = await this.rec(u); if (!r) return { status: 404, body: { err: 'Không có tài khoản ' + u } };
    const out = this.row(k, r), sv = await this.store.get('s:' + k);
    out.saveAt = sv && sv.at || 0; out.saveKB = sv && sv.d ? Math.round(sv.d.length / 1024) : 0;
    try { // đọc vài số trong bản lưu của game (chỉ để xem)
      const G = sv && sv.d ? JSON.parse(sv.d).G : null;
      if (G) { const h = (G.party || []).find(x => x && x.id === 'diep'); out.game = { hn: G.hn || '', lv: h ? h.lv | 0 : 0, silver: G.silver | 0, merit: G.merit | 0, hp: G.pill ? G.pill.hp | 0 : 0, mp: G.pill ? G.pill.mp | 0 : 0, party: (G.party || []).length, box: (G.box || []).length, nan: G.nan | 0 }; }
    } catch { out.game = null; }
    out.mail = ((await this.store.get('mb:' + k)) || []).length;
    out.banLog = r.ban || null;
    return ok(out);
  }

  async ban(u, days, why) {
    const { u: k, r } = await this.rec(u); if (!r) return { status: 404, body: { err: 'Không có tài khoản ' + u } };
    days = Math.max(0, Math.min(36500, +days || 0)); why = clean(why, 160);
    r.ban = { until: days ? Date.now() + days * 864e5 : 0, why, at: Date.now() };
    await this.store.put('u:' + k, r);
    const n = this.hub.kick(k, { t: 'err', m: 'ban', why, until: r.ban.until });
    await this.log('Khóa ' + r.n + (days ? ' ' + days + ' ngày' : ' vĩnh viễn') + (why ? ': ' + why : '') + (n ? ' (đã đẩy ra)' : ''));
    return ok({ ban: banOf(r), kicked: n });
  }
  async unban(u) {
    const { u: k, r } = await this.rec(u); if (!r) return { status: 404, body: { err: 'Không có tài khoản ' + u } };
    delete r.ban; await this.store.put('u:' + k, r);
    await this.log('Mở khóa ' + r.n);
    return ok({ ban: null });
  }
  async kickU(u) {
    const { u: k, r } = await this.rec(u); if (!r) return { status: 404, body: { err: 'Không có tài khoản ' + u } };
    const n = this.hub.kick(k, { t: 'err', m: 'kick' });
    await this.log('Đẩy ' + r.n + ' khỏi game' + (n ? '' : ' (không online)'));
    return ok({ kicked: n });
  }

  async mail(b) {
    const m = clean(b.m, ADM.msg);
    const d = { s: int(b.s, ADM.maxS), hp: int(b.hp, ADM.maxPill), mp: int(b.mp, ADM.maxPill), mer: int(b.mer, ADM.maxMer) };
    for (const x of Object.keys(d)) if (!d[x]) delete d[x];
    if (!m && !Object.keys(d).length) return { status: 400, body: { err: 'Thư trống: viết lời nhắn hoặc thêm quà' } };
    let to;
    if (b.to === '*') to = await this.users();
    else { to = []; for (const u of (Array.isArray(b.to) ? b.to : String(b.to || '').split(/[\s,;]+/)).slice(0, ADM.maxTo)) { const { u: k, r } = await this.rec(u); if (!u) continue; if (!r) return { status: 404, body: { err: 'Không có tài khoản ' + u } }; to.push(k); } }
    to = [...new Set(to)]; if (!to.length) return { status: 400, body: { err: 'Chưa chọn người nhận' } };
    const T = this.hub.trade;
    await T.serial(async () => { for (const u of to) await T.mail(u, { k: 'g', d, m: m || 'Quà của Ban quản trị', from: 'Ban quản trị' }); });
    const gift = [d.s && d.s + ' bạc', d.hp && d.hp + ' thuốc máu', d.mp && d.mp + ' thuốc linh lực', d.mer && d.mer + ' công đức'].filter(Boolean).join(', ');
    await this.log('Gửi thư ' + (b.to === '*' ? 'mọi người (' + to.length + ')' : to.join(', ')) + (gift ? ' kèm ' + gift : '') + (m ? ': ' + m.slice(0, 80) : ''));
    return ok({ sent: to.length });
  }

  async log(t) {
    const L = (await this.store.get('adm:log')) || [];
    L.unshift({ at: Date.now(), t }); L.length = Math.min(L.length, 100);
    await this.store.put('adm:log', L);
  }
}
const ok = body => ({ status: 200, body });
const bad = m => ({ status: 405, body: { err: m } });
