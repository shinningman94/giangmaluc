// Chat theo kênh cho server có tài khoản: nhắn riêng, tổ đội (chỉ trong phiên chơi) và bang hội (lưu theo tài khoản).
// Trò chuyện chung vẫn đi qua presence ở sảnh (say), xem hub.js.
//
//  client -> server
//   {t:'dm', to, m}               nhắn riêng cho người chơi tên tài khoản `to` (phải đang online)
//   {t:'pinv', to}                mời vào tổ đội;  {t:'pans', from, ok} trả lời lời mời;  {t:'pleave'} rời đội
//   {t:'pmsg', m}                 chat tổ đội
//   {t:'gcreate', n} / {t:'gjoin', n} / {t:'gleave'} / {t:'glist'}   lập / vào / rời / xem danh sách bang hội
//   {t:'gmsg', m}                 chat bang hội
//  server -> client
//   {t:'cm', ch:'dm'|'party'|'guild', from, to?, m, at}   một tin nhắn (ch:'dm' cũng gửi lại cho người gửi)
//   {t:'note', ch, m}             thông báo của hệ thống trong kênh đó (ví dụ "X đã vào tổ đội")
//   {t:'party', lead, mem:[n]} | {t:'party', mem:null}
//   {t:'pinv', from}              có người mời vào tổ đội
//   {t:'guild', g:{n, lead, mem:[{n,on}]}} | {t:'guild', g:null}
//   {t:'glist', list:[{n, c}]}
const BAD = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
const clean = (s, n) => String(s || '').replace(BAD, '').replace(/\s+/g, ' ').trim().slice(0, n);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
export const SOC = { partyMax: 4, guildMax: 30, invMs: 60e3, chatGapMs: 600, listMax: 40 };

export class Social {
  constructor(hub) {
    this.hub = hub; this.parties = new Map(); this.pseq = 0; this.inv = new Map(); this.q = Promise.resolve();
  }
  st() { return this.hub.store; }
  // các thao tác bang hội đọc rồi ghi kho: xếp hàng để hai lệnh không chen nhau
  serial(fn) { const p = this.q.then(fn, fn); this.q = p.catch(() => {}); return p; }
  online(u) { for (const p of this.hub.peers.values()) if (p.ok && p.acc && p.acc.u === u) return p; return null; }
  byName(n) { return this.online(String(n || '').toLowerCase().trim()); }
  out(peer, o) { this.hub.out(peer, o); }
  note(peer, ch, m) { this.out(peer, { t: 'note', ch, m }); }
  text(peer, m) {
    const t = clean(m, 120); if (!t) return '';
    const now = Date.now(); if (now - (peer.chatAt || 0) < SOC.chatGapMs) return ''; peer.chatAt = now; return t;
  }

  handle(peer, m) {
    if (!peer.acc) return;
    switch (m.t) {
      case 'dm': return this.dm(peer, m);
      case 'pinv': return this.pinv(peer, m);
      case 'pans': return this.pans(peer, m);
      case 'pleave': return this.pleave(peer, true);
      case 'pmsg': return this.pmsg(peer, m);
      case 'gcreate': return void this.serial(() => this.gcreate(peer, m));
      case 'gjoin': return void this.serial(() => this.gjoin(peer, m));
      case 'gleave': return void this.serial(() => this.gleave(peer));
      case 'glist': return void this.glist(peer);
      case 'gmsg': return void this.gmsg(peer, m);
    }
  }
  static TYPES = new Set(['dm', 'pinv', 'pans', 'pleave', 'pmsg', 'gcreate', 'gjoin', 'gleave', 'glist', 'gmsg']);

  // ---------- nhắn riêng ----------
  dm(peer, m) {
    const to = this.byName(m.to);
    if (!to) return this.note(peer, 'dm', 'Người chơi ' + clean(m.to, 18) + ' không online.');
    if (to === peer) return;
    const t = this.text(peer, m.m); if (!t) return;
    const o = { t: 'cm', ch: 'dm', from: peer.acc.n, to: to.acc.n, m: t, at: Date.now() };
    this.out(to, o); this.out(peer, o);
  }

  // ---------- tổ đội (chỉ trong bộ nhớ, rời game là rời đội) ----------
  party(peer) { return peer.party ? this.parties.get(peer.party) : null; }
  pstate(P) {
    const mem = P.mem.map(u => { const p = this.online(u); return p ? p.acc.n : u; });
    const lead = mem[P.mem.indexOf(P.lead)];
    for (const u of P.mem) { const p = this.online(u); if (p) this.out(p, { t: 'party', lead, mem }); }
  }
  pcast(P, o, skip) { for (const u of P.mem) { const p = this.online(u); if (p && p !== skip) this.out(p, o); } }
  pinv(peer, m) {
    const to = this.byName(m.to);
    if (!to) return this.note(peer, 'party', 'Người chơi ' + clean(m.to, 18) + ' không online.');
    if (to === peer) return;
    const P = this.party(peer);
    if (P && P.mem.length >= SOC.partyMax) return this.note(peer, 'party', 'Tổ đội đã đủ ' + SOC.partyMax + ' người.');
    if (this.party(to)) return this.note(peer, 'party', to.acc.n + ' đang ở trong một tổ đội khác.');
    this.inv.set(to.acc.u, { from: peer.acc.u, at: Date.now() });
    this.out(to, { t: 'pinv', from: peer.acc.n });
    this.note(peer, 'party', 'Đã mời ' + to.acc.n + ' vào tổ đội.');
  }
  pans(peer, m) {
    const I = this.inv.get(peer.acc.u); this.inv.delete(peer.acc.u);
    const from = I && this.online(I.from);
    if (!I || !from || Date.now() - I.at > SOC.invMs || String(m.from || '').toLowerCase() !== I.from) return this.note(peer, 'party', 'Lời mời đã hết hạn.');
    if (!m.ok) return this.note(from, 'party', peer.acc.n + ' từ chối vào tổ đội.');
    if (this.party(peer)) return this.note(peer, 'party', 'Thầy đang ở trong một tổ đội rồi.');
    let P = this.party(from);
    if (!P) { P = { id: 'q' + (++this.pseq), lead: from.acc.u, mem: [from.acc.u] }; this.parties.set(P.id, P); from.party = P.id; }
    if (P.mem.length >= SOC.partyMax) return this.note(peer, 'party', 'Tổ đội đã đủ người.');
    P.mem.push(peer.acc.u); peer.party = P.id;
    this.pstate(P); this.pcast(P, { t: 'note', ch: 'party', m: peer.acc.n + ' đã vào tổ đội.' });
  }
  pleave(peer, say) {
    const P = this.party(peer); peer.party = null; if (!P) return say && this.out(peer, { t: 'party', mem: null });
    P.mem = P.mem.filter(u => u !== peer.acc.u);
    this.out(peer, { t: 'party', mem: null });
    if (P.mem.length <= 1) {
      this.parties.delete(P.id);
      for (const u of P.mem) { const p = this.online(u); if (p) { p.party = null; this.out(p, { t: 'party', mem: null }); this.note(p, 'party', peer.acc.n + ' đã rời đội, tổ đội giải tán.'); } }
      return;
    }
    if (P.lead === peer.acc.u) P.lead = P.mem[0];
    this.pstate(P); this.pcast(P, { t: 'note', ch: 'party', m: peer.acc.n + ' đã rời tổ đội.' });
  }
  pmsg(peer, m) {
    const P = this.party(peer); if (!P) return this.note(peer, 'party', 'Thầy chưa ở trong tổ đội nào.');
    const t = this.text(peer, m.m); if (!t) return;
    this.pcast(P, { t: 'cm', ch: 'party', from: peer.acc.n, m: t, at: Date.now() });
  }

  // ---------- bang hội (lưu trong kho: g:<mã> bang, ug:<tài khoản> mã bang, gl danh sách mã) ----------
  async gget(id) { return id && this.st() ? await this.st().get('g:' + id) : null; }
  async gput(id, g) { if (this.st()) await this.st().put('g:' + id, g); }
  async gstate(g, only) {
    const mem = g.mem.map(x => ({ n: x.n, on: !!this.online(x.u) }));
    const lead = (g.mem.find(x => x.u === g.lead) || {}).n || '';
    const o = { t: 'guild', g: { n: g.n, lead, mem } };
    if (only) return this.out(only, o);
    for (const x of g.mem) { const p = this.online(x.u); if (p) this.out(p, o); }
  }
  gcast(g, o) { for (const x of g.mem) { const p = this.online(x.u); if (p) this.out(p, o); } }
  async login(peer) { // vừa đăng nhập: nạp bang của tài khoản
    if (!this.st()) return;
    const id = await this.st().get('ug:' + peer.acc.u); const g = await this.gget(id);
    if (g && g.mem.some(x => x.u === peer.acc.u)) { peer.guild = id; await this.gstate(g); }
    else { peer.guild = null; this.out(peer, { t: 'guild', g: null }); }
  }
  async gcreate(peer, m) {
    if (!this.st()) return;
    if (peer.guild) return this.note(peer, 'guild', 'Thầy đang ở trong một bang hội rồi.');
    const n = clean(m.n, 16), id = fold(n);
    if ([...n].length < 2 || !/[\p{L}\p{N}]/u.test(n)) return this.note(peer, 'guild', 'Tên bang hội cần 2 đến 16 ký tự.');
    if (await this.gget(id)) return this.note(peer, 'guild', 'Đã có bang hội tên ' + n + '. Chọn tên khác hoặc gia nhập bang đó.');
    const g = { n, lead: peer.acc.u, mem: [{ u: peer.acc.u, n: peer.acc.n }], at: Date.now() };
    await this.gput(id, g); await this.st().put('ug:' + peer.acc.u, id);
    const gl = (await this.st().get('gl')) || []; if (!gl.includes(id)) { gl.push(id); await this.st().put('gl', gl); }
    peer.guild = id; await this.gstate(g); this.note(peer, 'guild', 'Đã lập bang hội ' + n + '. Thầy là bang chủ.');
  }
  async gjoin(peer, m) {
    if (!this.st()) return;
    if (peer.guild) return this.note(peer, 'guild', 'Thầy đang ở trong một bang hội rồi.');
    const id = fold(clean(m.n, 16)), g = await this.gget(id);
    if (!g) return this.note(peer, 'guild', 'Không có bang hội tên ' + clean(m.n, 16) + '.');
    if (g.mem.length >= SOC.guildMax) return this.note(peer, 'guild', 'Bang ' + g.n + ' đã đủ ' + SOC.guildMax + ' thành viên.');
    g.mem.push({ u: peer.acc.u, n: peer.acc.n }); await this.gput(id, g); await this.st().put('ug:' + peer.acc.u, id);
    peer.guild = id; await this.gstate(g); this.gcast(g, { t: 'note', ch: 'guild', m: peer.acc.n + ' đã gia nhập bang ' + g.n + '.' });
  }
  async gleave(peer) {
    if (!this.st()) return;
    const id = peer.guild, g = await this.gget(id); peer.guild = null;
    await this.st().delete('ug:' + peer.acc.u);
    this.out(peer, { t: 'guild', g: null });
    if (!g) return;
    g.mem = g.mem.filter(x => x.u !== peer.acc.u);
    this.note(peer, 'guild', 'Thầy đã rời bang ' + g.n + '.');
    if (!g.mem.length) {
      await this.st().delete('g:' + id);
      const gl = ((await this.st().get('gl')) || []).filter(x => x !== id); await this.st().put('gl', gl); return;
    }
    if (g.lead === peer.acc.u) g.lead = g.mem[0].u;
    await this.gput(id, g); await this.gstate(g); this.gcast(g, { t: 'note', ch: 'guild', m: peer.acc.n + ' đã rời bang.' });
  }
  async glist(peer) {
    if (!this.st()) return this.out(peer, { t: 'glist', list: [] });
    const gl = (await this.st().get('gl')) || [], list = [];
    for (const id of gl.slice(-200)) { const g = await this.gget(id); if (g) list.push({ n: g.n, c: g.mem.length }); }
    list.sort((a, b) => b.c - a.c); this.out(peer, { t: 'glist', list: list.slice(0, SOC.listMax) });
  }
  async gmsg(peer, m) {
    const g = await this.gget(peer.guild); if (!g) return this.note(peer, 'guild', 'Thầy chưa ở trong bang hội nào.');
    const t = this.text(peer, m.m); if (!t) return;
    this.gcast(g, { t: 'cm', ch: 'guild', from: peer.acc.n, m: t, at: Date.now() });
  }

  // người chơi thoát: rời tổ đội, báo bang là đã offline
  async gone(peer) {
    if (!peer.acc) return;
    this.inv.delete(peer.acc.u);
    if (peer.party) this.pleave(peer, false);
    if (peer.guild) { const g = await this.gget(peer.guild); if (g) await this.gstate(g); }
  }
}
