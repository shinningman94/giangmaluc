// Tài khoản người chơi: đăng ký, đăng nhập, phiên (token) và bản lưu tiến trình theo tài khoản.
// Không phụ thuộc nền tảng: dùng WebCrypto (có sẵn trên Cloudflare Workers và Node 20+).
// store: {get(k), put(k,v), delete(k)}
//   'u:<tên thường>' -> {n, s, h, at, tk:[token...]}   n: tên hiển thị, s/h: muối + băm PBKDF2 của mật khẩu
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
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

export class Accounts {
  constructor(store) { this.store = store; this.hits = new Map(); }

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
