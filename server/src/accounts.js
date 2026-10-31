// Tài khoản người chơi: đăng ký, đăng nhập, phiên (token) và bản lưu tiến trình theo tài khoản.
// Không phụ thuộc nền tảng: dùng WebCrypto (có sẵn trên Cloudflare Workers và Node 20+).
// store: {get(k), put(k,v), delete(k)}
//   'u:<tên thường>' -> {n, s, h, at, tk:[token...], g}  n: tên hiển thị, s/h: muối + băm PBKDF2 của mật khẩu, g: mã Google (sub) nếu đã liên kết
//   'g:<sub Google>' -> tên thường                        tài khoản Google nào ứng với tài khoản game nào
//   't:<token>'      -> {u, exp}                         u: tên thường
//   's:<tên thường>' -> {d, at}                          d: chuỗi bản lưu của game
export const ACC = { iter: 100000, tokenDays: 120, maxTokens: 5, maxSave: 1500000, perMin: 12 };
const NAME_RE = /^[a-zA-Z0-9_]{3,16}$/;
const te = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rand = n => hex(crypto.getRandomValues(new Uint8Array(n)));

async function hash(pw, salt) {
  const key = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt), iterations: ACC.iter }, key, 256));
}
function same(a, b) { if (typeof a !== 'string' || typeof b !== 'string') return false; if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

// ---- Đăng nhập bằng Google: kiểm chữ ký ID token (JWT RS256) bằng khóa công khai của Google ----
const G_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const G_ISS = ['accounts.google.com', 'https://accounts.google.com'];
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const jpart = s => JSON.parse(new TextDecoder().decode(b64u(s)));
// tên gợi ý cho tài khoản mới từ tên/email Google: bỏ dấu, chỉ giữ chữ, số, _
export function nameFrom(s) {
  s = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, c => c === 'đ' ? 'd' : 'D').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 13);
  return s.length >= 3 ? s : (s + 'phapsu').slice(0, 8);
}

export class Accounts {
  // opt.google: Client ID của Google (nhiều mã cách nhau bằng dấu phẩy); opt.fetch: thay fetch khi thử nghiệm
  constructor(store, opt = {}) {
    this.store = store; this.hits = new Map();
    this.gids = String(opt.google || '').split(',').map(x => x.trim()).filter(Boolean);
    this.fetch = opt.fetch || ((...a) => fetch(...a)); this.gkeys = null; this.gexp = 0;
  }

  async googleKeys(force) {
    if (!force && this.gkeys && Date.now() < this.gexp) return this.gkeys;
    const r = await this.fetch(G_CERTS);
    if (!r.ok) throw new Error('certs ' + r.status);
    const j = await r.json(), m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
    this.gkeys = j.keys || []; this.gexp = Date.now() + Math.min(+(m && m[1]) || 3600, 86400) * 1000;
    return this.gkeys;
  }

  // ID token -> {sub, email, name} hoặc null nếu sai chữ ký / hết hạn / không dành cho game này
  async googleVerify(cred) {
    if (!this.gids.length || typeof cred !== 'string' || cred.length > 4096) return null;
    const p = cred.split('.'); if (p.length !== 3) return null;
    let h, c; try { h = jpart(p[0]); c = jpart(p[1]); } catch { return null; }
    if (h.alg !== 'RS256' || !h.kid) return null;
    let jwk = (await this.googleKeys()).find(k => k.kid === h.kid);
    if (!jwk) jwk = (await this.googleKeys(true)).find(k => k.kid === h.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(p[2]), te.encode(p[0] + '.' + p[1]));
    const now = Date.now() / 1000;
    if (!ok || !G_ISS.includes(c.iss) || !this.gids.includes(c.aud) || !(c.exp > now) || (c.iat && c.iat > now + 300) || !c.sub) return null;
    return { sub: String(c.sub), email: c.email || '', name: c.given_name || c.name || '' };
  }

  // body {c: ID token, n?: tên tài khoản mới, u?/p?: tài khoản cũ để liên kết}
  async google(body) {
    body = body || {};
    let g; try { g = await this.googleVerify(body.c); } catch { return { err: 'Không kiểm tra được với Google, thử lại sau' }; }
    if (!g) return { err: 'Đăng nhập Google không hợp lệ hoặc đã hết hạn, bấm lại nút Google' };
    const gk = 'g:' + g.sub, have = await this.store.get(gk);
    if (have && await this.store.get('u:' + have)) return this.issue(have);
    if (body.u) { // liên kết với tài khoản đã có (cần đúng mật khẩu)
      const r = await this.login(body.u, body.p); if (r.err) return r;
      const u = String(body.u).trim().toLowerCase(), rec = await this.store.get('u:' + u);
      if (rec.g && rec.g !== g.sub) return { err: 'Tài khoản này đã liên kết với một tài khoản Google khác' };
      await this.logout(r.tok);
      rec.g = g.sub; await this.store.put('u:' + u, rec); await this.store.put(gk, u);
      return this.issue(u);
    }
    if (body.n) { // tạo tài khoản mới chỉ dùng Google (không có mật khẩu)
      const name = String(body.n).trim();
      if (!NAME_RE.test(name)) return { err: 'Tên đăng nhập 3-16 ký tự, chỉ chữ không dấu, số và _' };
      const key = 'u:' + name.toLowerCase();
      if (await this.store.get(key)) return { err: 'Tên này đã có người dùng' };
      await this.store.put(key, { n: name, at: Date.now(), tk: [], g: g.sub });
      await this.store.put(gk, name.toLowerCase());
      return this.issue(name.toLowerCase());
    }
    // lần đầu: hỏi người chơi chọn tên, gợi ý một tên còn trống
    const base = nameFrom(g.name || g.email.split('@')[0]);
    let sug = base;
    for (let i = 0; i < 20 && await this.store.get('u:' + sug.toLowerCase()); i++) sug = base.slice(0, 12) + (10 + Math.floor(Math.random() * 9990));
    return { need: 1, sug };
  }

  // chặn đoán mật khẩu: mỗi địa chỉ tối đa ACC.perMin lần đăng nhập/đăng ký mỗi phút
  limited(ip) {
    const now = Date.now(), k = ip || '?', h = this.hits.get(k);
    if (!h || now - h.t > 60000) { this.hits.set(k, { t: now, n: 1 }); if (this.hits.size > 5000) this.hits.clear(); return false; }
    return ++h.n > ACC.perMin;
  }

  async register(name, pw) {
    name = String(name || '').trim(); pw = String(pw || '');
    if (!NAME_RE.test(name)) return { err: 'Tên đăng nhập 3-16 ký tự, chỉ chữ không dấu, số và _' };
    if (pw.length < 6 || pw.length > 64) return { err: 'Mật khẩu 6-64 ký tự' };
    const key = 'u:' + name.toLowerCase();
    if (await this.store.get(key)) return { err: 'Tên này đã có người dùng' };
    const s = rand(16);
    await this.store.put(key, { n: name, s, h: await hash(pw, s), at: Date.now(), tk: [] });
    return this.issue(name.toLowerCase());
  }

  async login(name, pw) {
    name = String(name || '').trim(); pw = String(pw || '');
    const rec = NAME_RE.test(name) && await this.store.get('u:' + name.toLowerCase());
    // vẫn băm khi không có tài khoản để thời gian trả lời như nhau
    const h = await hash(pw, rec ? rec.s : 'x');
    if (!rec || !same(h, rec.h)) return { err: 'Sai tên đăng nhập hoặc mật khẩu' };
    return this.issue(name.toLowerCase());
  }

  async issue(u) {
    const rec = await this.store.get('u:' + u); if (!rec) return { err: 'Không có tài khoản' };
    const tok = rand(24);
    await this.store.put('t:' + tok, { u, exp: Date.now() + ACC.tokenDays * 864e5 });
    rec.tk = [...(rec.tk || []), tok];
    while (rec.tk.length > ACC.maxTokens) await this.store.delete('t:' + rec.tk.shift());
    await this.store.put('u:' + u, rec);
    return { tok, u: rec.n };
  }

  // token -> {u: tên thường, n: tên hiển thị} hoặc null
  async verify(tok) {
    if (typeof tok !== 'string' || !/^[0-9a-f]{48}$/.test(tok)) return null;
    const t = await this.store.get('t:' + tok);
    if (!t) return null;
    if (t.exp < Date.now()) { await this.store.delete('t:' + tok); return null; }
    const rec = await this.store.get('u:' + t.u);
    return rec ? { u: t.u, n: rec.n } : null;
  }

  async logout(tok) {
    const a = await this.verify(tok); if (!a) return { ok: true };
    await this.store.delete('t:' + tok);
    const rec = await this.store.get('u:' + a.u);
    if (rec) { rec.tk = (rec.tk || []).filter(x => x !== tok); await this.store.put('u:' + a.u, rec); }
    return { ok: true };
  }

  async getSave(tok) {
    const a = await this.verify(tok); if (!a) return null;
    return (await this.store.get('s:' + a.u)) || { d: null, at: 0 };
  }
  async putSave(tok, d) {
    const a = await this.verify(tok); if (!a) return null;
    if (typeof d !== 'string' || d.length > ACC.maxSave) return { err: 'Bản lưu quá lớn' };
    const at = Date.now();
    await this.store.put('s:' + a.u, { d, at });
    return { ok: true, at };
  }

  // xử lý chung cho các đường dẫn HTTP /auth/* và /save; trả {status, body} để Worker và Node cùng dùng
  async http(method, path, auth, body, ip) {
    const tok = (auth || '').replace(/^Bearer\s+/i, '');
    if (path === '/auth/register' || path === '/auth/login') {
      if (method !== 'POST') return { status: 405, body: { err: 'POST' } };
      if (this.limited(ip)) return { status: 429, body: { err: 'Thử quá nhiều lần, đợi một phút' } };
      const r = path === '/auth/register' ? await this.register(body && body.u, body && body.p) : await this.login(body && body.u, body && body.p);
      return { status: r.err ? 400 : 200, body: r };
    }
    if (path === '/auth/google') {
      if (method !== 'POST') return { status: 405, body: { err: 'POST' } };
      if (!this.gids.length) return { status: 404, body: { err: 'Server chưa bật đăng nhập Google' } };
      if (this.limited(ip)) return { status: 429, body: { err: 'Thử quá nhiều lần, đợi một phút' } };
      const r = await this.google(body);
      return { status: r.err ? 400 : 200, body: r };
    }
    if (path === '/auth/config') return { status: 200, body: { g: this.gids[0] || '' } };
    if (path === '/auth/logout') return { status: 200, body: await this.logout(tok) };
    if (path === '/auth/me') { const a = await this.verify(tok); return a ? { status: 200, body: { u: a.n } } : { status: 401, body: { err: 'auth' } }; }
    if (path === '/save') {
      if (method === 'GET') { const r = await this.getSave(tok); return r ? { status: 200, body: r } : { status: 401, body: { err: 'auth' } }; }
      if (method === 'PUT' || method === 'POST') {
        const r = await this.putSave(tok, body && body.d);
        return !r ? { status: 401, body: { err: 'auth' } } : { status: r.err ? 413 : 200, body: r };
      }
      return { status: 405, body: { err: 'GET/PUT' } };
    }
    return null;
  }
}
