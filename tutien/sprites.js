// Bộ vẽ nhân vật pixel chibi (tu tiên) bằng code: nam/nữ, 5 cảnh giới, 4 hướng, đứng/đi/đánh/ngồi thiền.
// Mỗi bộ phận vẽ lên một lớp riêng rồi ghép lại kèm viền tối theo màu bộ phận (kiểu pixel art).
(function (root) {
  const W = 40, H = 56, CX = 20;
  const REALMS = [
    { id: 1, name: 'Luyện Khí', aura: '#9aa7b8', robe: '#5d6f92', trim: '#e6ebf2', belt: '#8f4f30', pants: '#eadfc6', shoe: '#2b2b3b', long: false },
    { id: 2, name: 'Trúc Cơ', aura: '#58c7b5', robe: '#30508a', trim: '#eab23a', belt: '#eab23a', pants: '#f1efe8', shoe: '#c9962c', long: true, panel: '#f1efe8', jade: '#59d6c0' },
    { id: 3, name: 'Kết Đan', aura: '#e0a050', robe: '#f3f1ec', trim: '#b9323c', belt: '#b9323c', pants: '#f3f1ec', shoe: '#34303c', long: true, cloud: '#c9c6d2', pin: '#d9dbe6' },
    { id: 4, name: 'Nguyên Anh', aura: '#9a86e8', robe: '#4d3d74', trim: '#bdb8dc', belt: '#2b2340', pants: '#eeeaf4', shoe: '#2a2436', long: true, mantle: '#33284f', jade: '#62d8c8', cloud: '#6a5a96', pin: '#bfe9e2' },
    { id: 5, name: 'Hóa Thần', aura: '#ffd56a', robe: '#f7e8b4', trim: '#f0a81e', belt: '#f0a81e', pants: '#fbf5dc', shoe: '#e9b93a', long: true, panel: '#fffaf0', cloud: '#eccb72', crown: '#f6b92a', ribbon: '#ffe9a6' },
  ];
  const SKIN = '#f6d2b4', SKIN_S = '#dfa98a', HAIR = '#34384f', HAIR_L = '#6a7aa8', EYE = '#221c2c', INK = '#1a1522';

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
  const dk = (c, t = 0.25) => mix(c, INK, t), lt = (c, t = 0.3) => mix(c, '#ffffff', t);

  class Layer {
    constructor() { this.d = new Array(W * H).fill(null); }
    p(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < W && y >= 0 && y < H) this.d[y * W + x] = c; return this; }
    r(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); return this; }
    el(cx, cy, rx, ry, c, y0 = -99, y1 = 99) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        if (y < y0 || y > y1) continue;
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.p(x, y, c);
        }
      }
      return this;
    }
    // hình thang đối xứng quanh cx: từ y0 (rộng w0) đến y1 (rộng w1)
    trap(cx, y0, y1, w0, w1, c) {
      for (let y = y0; y <= y1; y++) { const w = Math.round(w0 + (w1 - w0) * (y - y0) / Math.max(1, y1 - y0)); this.r(Math.round(cx - w / 2), y, w, 1, c); }
      return this;
    }
    has(x, y) { return x >= 0 && x < W && y >= 0 && y < H && this.d[y * W + x] != null; }
    // đổ bóng: các điểm ở mép phải/dưới của lớp tối đi
    shade(c, right = true) {
      const out = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (this.has(x, y) && (!this.has(x + (right ? 1 : -1), y) || !this.has(x, y + 1))) out.push([x, y]);
      for (const [x, y] of out) this.d[y * W + x] = c;
      return this;
    }
  }
  function put(main, L, oc) {
    if (oc) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (L.has(x, y)) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!L.has(x + dx, y + dy)) main.p(x + dx, y + dy, oc);
    }
    for (let i = 0; i < W * H; i++) if (L.d[i] != null) main.d[i] = L.d[i];
  }

  function pose(o) {
    const f = o.f | 0, a = o.anim;
    const P = { bob: 0, drop: 0, ll: 0, lr: 0, stride: 0, swing: 0, atk: 0, sit: false };
    if (a === 'idle') P.bob = f % 2;
    if (a === 'walk') { P.bob = f % 2 ? 0 : 1; P.ll = f % 4 === 1 ? 2 : 0; P.lr = f % 4 === 3 ? 2 : 0; P.stride = [0, 3, 0, -3][f % 4]; P.swing = [0, 1, 0, -1][f % 4]; }
    if (a === 'atk') { P.atk = [1, 2, 2, 1][f % 4]; P.stride = 2; }
    if (a === 'sit') { P.sit = true; P.drop = 4; P.bob = f % 2; }
    return P;
  }

  // ---------- đầu ----------
  function head(main, o, R, P, yo) {
    const g = o.g, dir = o.dir, hy = 15 + yo;                       // tâm đầu
    const side = dir >= 2, back = dir === 1;
    const hairO = dk(HAIR, 0.62);
    const tie = R.id === 1 ? (g ? '#c0392b' : '#3b4a6b') : R.id === 2 ? '#c0392b' : R.id === 3 ? (R.pin) : R.id === 4 ? R.pin : R.crown;
    // tóc sau lưng (vẽ trước thân khi nhìn từ trước / ngang; nhìn từ sau thì vẽ sau cùng)
    const tail = new Layer();
    if (g) {
      if (side) { for (let i = 0; i < 20; i++) { const w = i < 4 ? 4 : i < 14 ? 5 : 3, sx = Math.round(Math.sin(i / 3.2) * 1.2); tail.r(9 + sx - (i > 6 ? 1 : 0), hy - 6 + i, w, 1, i % 5 === 2 ? HAIR_L : HAIR); } }
      else { const x0 = back ? CX - 3 : CX + 7, n = back ? 23 : 29; for (let i = 0; i < n; i++) { const w = i < 3 ? 5 : i < n - 6 ? 6 : i < n - 2 ? 4 : 2, sx = Math.round(Math.sin(i / 3.4) * 1.5); tail.r(x0 + sx, hy - 8 + i, w, 1, HAIR); if (i % 4 === 1) tail.p(x0 + sx + 3, hy - 8 + i, HAIR_L); } }
    }
    const face = new Layer(), hair = new Layer(), top = new Layer();
    if (!side) {
      face.el(CX - 0.5, hy, 8, 7, SKIN);
      face.p(CX - 9, hy + 1, SKIN).p(CX - 9, hy + 2, SKIN_S).p(CX + 8, hy + 1, SKIN).p(CX + 8, hy + 2, SKIN_S);  // tai
      if (!back) {
        for (const ex of [CX - 6, CX + 3]) {
          face.r(ex, hy, 2, 3, EYE).p(ex, hy, '#ffffff').p(ex + 1, hy + 2, '#6b5a7a');
          face.r(ex - (ex < CX ? 0 : 0), hy - 2, 2, 1, HAIR);                                         // lông mày
        }
        face.p(CX - 7, hy + 3, '#f0a9a0').p(CX + 6, hy + 3, '#f0a9a0');                               // má hồng
        face.r(CX - 1, hy + 4, 2, 1, '#b8705e');                                                      // miệng
        face.r(CX - 4, hy + 6, 7, 1, SKIN_S);
      }
      // mái tóc
      if (back) { hair.el(CX - 0.5, hy - 0.5, 9, 8, HAIR); hair.r(CX - 6, hy + 6, 11, 2, HAIR); for (let i = 0; i < 4; i++) hair.p(CX - 5 + i * 3, hy + 8, HAIR); hair.r(CX - 6, hy - 6, 4, 1, HAIR_L).r(CX - 7, hy - 5, 2, 1, HAIR_L).p(CX - 8, hy - 3, HAIR_L).r(CX + 2, hy - 7, 2, 1, HAIR_L); }
      else {
        hair.el(CX - 0.5, hy - 2, 9, 7, HAIR, -99, hy - 3);
        const fr = [3, 2, 3, 1, 2, 3, 2, 1, 2, 3, 1, 2, 3, 2, 3, 2];                                 // mái lởm chởm
        for (let i = 0; i < 16; i++) hair.r(CX - 8 + i, hy - 3, 1, fr[i], HAIR);
        hair.r(CX - 9, hy - 3, 2, g ? 9 : 6, HAIR).r(CX + 7, hy - 3, 2, g ? 9 : 6, HAIR);            // tóc mai
        hair.r(CX - 5, hy - 7, 4, 1, HAIR_L).r(CX - 6, hy - 6, 2, 1, HAIR_L).p(CX + 3, hy - 6, HAIR_L).p(CX + 4, hy - 5, HAIR_L);
      }
      if (!g) { hair.p(CX - 10, hy - 4, HAIR).p(CX - 11, hy - 5, HAIR).p(CX + 9, hy - 5, HAIR).p(CX + 10, hy - 6, HAIR).p(CX - 9, hy - 7, HAIR).p(CX + 8, hy - 8, HAIR); }
      // búi tóc / đuôi ngựa
      if (!g) { top.el(CX - 0.5, hy - 11, 2.6, 2.6, HAIR); top.p(CX - 1, hy - 12, HAIR_L); top.r(CX - 3, hy - 9, 5, 1, tie); top.p(CX + 3, hy - 12, HAIR).p(CX - 4, hy - 11, HAIR); }
      else { top.el(CX + (back ? -1 : 1), hy - 10, 3, 2.6, HAIR); top.r(CX + (back ? -3 : -1), hy - 8, 5, 1, tie); top.p(CX + (back ? -2 : 2), hy - 11, HAIR_L); }
    } else {
      // nhìn ngang, mặt quay sang phải
      face.el(CX + 0.5, hy, 7.5, 7, SKIN);
            face.r(CX + 3, hy, 2, 3, EYE).p(CX + 3, hy, '#ffffff').r(CX + 3, hy - 2, 3, 1, HAIR);
      face.p(CX + 2, hy + 3, '#f0a9a0').p(CX + 6, hy + 4, '#b8705e');
      face.p(CX - 2, hy + 1, SKIN_S).p(CX - 2, hy + 2, SKIN_S);                                      // tai
      hair.el(CX - 1, hy - 1.5, 8.5, 7.5, HAIR, -99, hy - 3);
      hair.el(CX - 5.5, hy, 4.5, 7.5, HAIR, hy - 3, hy + (g ? 8 : 6));
      const fr = [4, 3, 2, 3, 1, 2, 2, 1, 1];
      for (let i = 0; i < 9; i++) hair.r(CX - 1 + i, hy - 3, 1, fr[i], HAIR);
      hair.r(CX - 5, hy - 7, 4, 1, HAIR_L).p(CX - 6, hy - 6, HAIR_L).r(CX - 7, hy - 1, 1, 4, HAIR_L);
      if (!g) { hair.p(CX - 10, hy - 3, HAIR).p(CX - 11, hy - 4, HAIR).p(CX - 10, hy + 3, HAIR).p(CX - 9, hy + 6, HAIR); top.el(CX - 2, hy - 11, 2.6, 2.6, HAIR); top.r(CX - 4, hy - 9, 5, 1, tie); top.p(CX - 5, hy - 12, HAIR); }
      else { top.el(CX - 4, hy - 10, 3, 2.6, HAIR); top.r(CX - 6, hy - 8, 5, 1, tie); }
    }
    // trang sức theo cảnh giới
    const orn = new Layer();
    const ox = side ? CX - (g ? 4 : 2) : CX - 0.5 + (g ? (back ? -1 : 1) : 0);
    if (R.crown) { orn.r(ox - 3, hy - 9 - (g ? 0 : 0), 7, 2, R.crown); orn.p(ox - 3, hy - 10, R.crown).p(ox, hy - 11, R.crown).p(ox, hy - 10, R.crown).p(ox + 3, hy - 10, R.crown); orn.p(ox, hy - 9, '#e0453a'); }
    else if (R.pin && R.id >= 3) { orn.r(ox - 4, hy - 11, 9, 1, R.pin); orn.p(ox + 5, hy - 12, R.pin); if (g) orn.p(ox - 5, hy - 8, '#e06a7a').p(ox - 5, hy - 7, R.pin); }
    return {
      under() { if (g && !back) put(main, tail, hairO); },
      over() {
        put(main, face, dk(SKIN_S, 0.45)); put(main, hair, hairO); put(main, top, hairO); put(main, orn, dk(tie || '#888888', 0.5));
        if (g && back) put(main, tail, hairO);
      },
    };
  }

  // ---------- thân ----------
  function body(main, o, R, P, yo) {
    const dir = o.dir, side = dir >= 2, back = dir === 1;
    const robeS = dk(R.robe, 0.22), by = 24 + yo;                   // vai
    const feet = 52;
    const hem = (R.long ? 48 : 41) + (P.sit ? 0 : 0);
    const legs = new Layer(), robe = new Layer(), det = new Layer();
    const wrap = R.id === 1 ? R.belt : dk(R.pants, 0.15);
    if (!side) {
      const sp = P.sit ? 3 : 0;
      for (const [lx, lift] of [[CX - 5 - sp, P.ll], [CX + 1 + sp, P.lr]]) {
        legs.r(lx, 40, 4, feet - 3 - 40 - lift, R.pants); legs.r(lx + 3, 40, 1, feet - 3 - 40 - lift, dk(R.pants, 0.18));
        legs.r(lx, feet - 5 - lift, 4, 2, wrap);
        legs.r(lx - (lx < CX ? 1 : 0), feet - 3 - lift, 5, 2, R.shoe); legs.r(lx - (lx < CX ? 1 : 0), feet - 2 - lift, 5, 1, dk(R.shoe, 0.3));
      }
      robe.trap(CX - 0.5, by, by + 7, 11, 11, R.robe);
      robe.trap(CX - 0.5, by + 8, hem + (P.sit ? 0 : 0), 11, R.long ? 15 : 14 + (P.sit ? 3 : 0), R.robe);
      robe.shade(robeS);
      if (R.long && !back && R.panel) det.trap(CX - 0.5, by + 10, hem - 1, 2, 4, R.panel);
      if (R.long) { for (let y = by + 10; y <= hem; y++) { const w = Math.round(11 + 4 * (y - by - 8) / (hem - by - 8)); det.p(Math.round(CX - 0.5 - w / 2), y, R.trim); det.p(Math.round(CX - 0.5 - w / 2) + w - 1, y, R.trim); } for (let x = 0; x < W; x++) if (robe.has(x, hem) && !det.has(x, hem)) det.p(x, hem, R.trim); }
      if (R.cloud) { const c = R.cloud; for (const [x, y] of [[CX - 5, by + 15], [CX - 4, by + 14], [CX - 3, by + 15], [CX + 3, by + 18], [CX + 4, by + 17], [CX + 5, by + 18], [CX - 4, by + 20], [CX - 3, by + 21]]) if (robe.has(x, y) && robe.has(x + 1, y) && robe.has(x - 1, y)) det.p(x, y, c); }
      if (!back) {
        // cổ chéo
        det.r(CX - 2, by - 1, 3, 2, SKIN_S);
        for (let i = 0; i < 6; i++) det.p(CX + 2 - i, by + i, R.trim);
        for (let i = 0; i < 3; i++) det.p(CX - 3 + i, by + i, R.trim);
        if (R.id === 1) for (let i = 0; i < 5; i++) det.p(CX + 1 - i, by + i + 1, dk(R.trim, 0.2));
      } else det.r(CX - 3, by, 5, 1, R.trim);
      det.r(CX - 6, by + 7, 11, 2, R.belt); det.r(CX - 6, by + 8, 11, 1, dk(R.belt, 0.25));
      if (!back) { det.r(CX - 1, by + 6, 2, 3, lt(R.belt, 0.15)); det.r(CX - 2, by + 9, 1, R.long ? 7 : 5, R.belt); det.r(CX, by + 9, 1, R.long ? 5 : 4, dk(R.belt, 0.2)); if (R.jade) det.r(CX + 2, by + 10, 2, 2, R.jade).p(CX + 2, by + 12, R.jade).p(CX + 2, by + 9, dk(R.jade, 0.3)); }
      if (R.mantle) { det.trap(CX - 0.5, by - 1, by + 2, 13, 15, R.mantle); det.r(CX - 7, by + 2, 15, 1, R.trim); if (!back) det.r(CX - 2, by - 1, 3, 2, SKIN_S); }
    } else {
      const s = P.sit ? 0 : P.stride;
      for (const [lx, lift, far] of [[CX - 2 - s, 0, true], [CX - 1 + s, 0, false]]) {
        const pc = far ? dk(R.pants, 0.2) : R.pants;
        legs.r(lx, 40, 4, feet - 3 - 40 - lift, pc); legs.r(lx, feet - 5 - lift, 4, 2, far ? dk(wrap, 0.2) : wrap);
        legs.r(lx, feet - 3 - lift, 6, 2, R.shoe); legs.r(lx, feet - 2 - lift, 6, 1, dk(R.shoe, 0.3));
      }
      robe.trap(CX, by, by + 7, 9, 9, R.robe);
      robe.trap(CX, by + 8, hem, 9, R.long ? 13 : 12, R.robe);
      robe.shade(robeS, false);
      if (R.long) { for (let x = 0; x < W; x++) if (robe.has(x, hem)) det.p(x, hem, R.trim); for (let y = by + 10; y <= hem; y++) for (let x = W - 1; x >= 0; x--) if (robe.has(x, y)) { det.p(x, y, R.panel || R.trim); if (R.panel) det.p(x - 1, y, R.trim); break; } }
      if (R.cloud) for (const [x, y] of [[CX - 2, by + 15], [CX - 1, by + 14], [CX, by + 15], [CX - 3, by + 19], [CX - 2, by + 20]]) det.p(x, y, R.cloud);
      det.r(CX + 2, by, 2, 1, R.trim).p(CX + 3, by + 1, R.trim).p(CX + 2, by + 2, R.trim).r(CX + 2, by - 1, 2, 1, SKIN_S);
      det.r(CX - 4, by + 7, 9, 2, R.belt); det.r(CX - 4, by + 8, 9, 1, dk(R.belt, 0.25));
      det.r(CX + 3, by + 9, 1, R.long ? 6 : 4, R.belt); if (R.jade) det.r(CX + 1, by + 10, 2, 3, R.jade);
      if (R.mantle) { det.trap(CX, by - 1, by + 2, 10, 12, R.mantle); det.r(CX - 6, by + 2, 12, 1, R.trim); }
    }
    put(main, legs, dk(R.pants, 0.6)); put(main, robe, dk(R.robe, 0.55));
    for (let i = 0; i < W * H; i++) if (det.d[i] != null) main.d[i] = det.d[i];
  }

  // ---------- tay ----------
  function arms(main, o, R, P, yo, which) {
    const dir = o.dir, side = dir >= 2, back = dir === 1, by = 24 + yo;
    const oc = dk(R.robe, 0.55), cuff = R.id === 1 ? R.trim : R.trim, slv = R.mantle && false ? R.mantle : R.robe;
    const mk = (fn) => { const L = new Layer(); fn(L); put(main, L, oc); };
    const hand = (L, x, y, w = 3, h = 2) => { L.r(x, y, w, h, SKIN); L.r(x, y + h - 1, w, 1, SKIN_S); };
    if (!side) {
      if (which !== 'front') return;
      const sw = P.swing;
      if (P.sit) {
        mk(L => { L.r(CX - 9, by, 3, 6, slv).r(CX - 8, by + 5, 5, 3, slv).r(CX - 8, by + 7, 5, 1, cuff); L.r(CX + 5, by, 3, 6, slv).r(CX + 2, by + 5, 5, 3, slv).r(CX + 2, by + 7, 5, 1, cuff); L.shade(dk(slv, 0.22)); if (!back) hand(L, CX - 3, by + 6, 5, 2); });
        return;
      }
      if (P.atk && !back) {
        mk(L => { L.r(CX - 9, by, 3, 7, slv).r(CX - 9, by + 4, 5, 3, slv).shade(dk(slv, 0.22)); hand(L, CX - 5, by + 4, 3, 3); });
        const up = P.atk === 2 ? 0 : 3;
        mk(L => { L.r(CX + 5, by, 4, 4, slv).r(CX + 6, by - 4 + up, 5, 5, slv).shade(dk(slv, 0.22)); L.r(CX + 6, by - 4 + up, 5, 1, cuff); L.r(CX + 6, by - 9 + up, 5, 5, SKIN).r(CX + 6, by - 5 + up, 5, 1, SKIN_S).p(CX + 8, by - 8 + up, SKIN_S).p(CX + 8, by - 7 + up, SKIN_S); });
        return;
      }
      for (const [x, d] of [[CX - 9, sw], [CX + 5, -sw]]) mk(L => {
        const up = P.atk && back ? (x > CX ? -5 : 0) : 0;
        L.r(x, by, 3, 6 + d + up, slv).r(x - (x < CX ? 1 : 0), by + 5 + d + up, 4, 3, slv).shade(dk(slv, 0.22), x > CX);
        L.r(x - (x < CX ? 1 : 0), by + 7 + d + up, 4, 1, cuff); hand(L, x + (x < CX ? 0 : 0), by + 8 + d + up, 3, 2);
      });
    } else {
      const sw = P.sit ? 0 : P.swing * 2;
      if (which === 'back') {
        if (P.atk) mk(L => { L.r(CX - 5, by + 1, 5, 4, dk(slv, 0.2)); hand(L, CX - 7, by + 1, 3, 3); });
        else if (!P.sit) mk(L => { L.r(CX - 1 - sw, by + 1, 3, 7, dk(slv, 0.25)); hand(L, CX - 1 - sw, by + 8, 3, 2); });
        return;
      }
      if (P.sit) { mk(L => { L.r(CX - 2, by, 4, 6, slv).r(CX - 1, by + 5, 6, 3, slv).shade(dk(slv, 0.22), false); L.r(CX + 4, by + 5, 1, 3, cuff); hand(L, CX + 5, by + 5, 3, 3); }); return; }
      if (P.atk) {
        const ex = P.atk === 2 ? 4 : 0;
        mk(L => { L.r(CX - 2, by, 5, 4, slv).r(CX + 2, by, 4 + ex, 4, slv).shade(dk(slv, 0.22), false); L.r(CX + 5 + ex, by, 1, 4, cuff); L.r(CX + 6 + ex, by, 4, 4, SKIN).r(CX + 6 + ex, by + 3, 4, 1, SKIN_S).p(CX + 9 + ex, by + 1, SKIN_S); });
        return;
      }
      mk(L => { L.r(CX - 2 + sw, by, 4, 6, slv).r(CX - 2 + sw, by + 5, 5, 3, slv).shade(dk(slv, 0.22), false); L.r(CX - 2 + sw, by + 7, 5, 1, cuff); hand(L, CX - 1 + sw, by + 8, 3, 2); });
    }
  }

  function ribbons(main, o, R, t) {
    if (!R.ribbon) return;
    const L = new Layer();
    for (let i = 0; i < 26; i++) {
      const a = i / 25, y = 22 + a * 26;
      const x1 = CX - 0.5 - 9 - Math.sin(a * 5 + t * 1.6) * 3 - a * 2, x2 = CX - 0.5 + 9 + Math.sin(a * 5 + t * 1.6 + 1) * 3 + a * 2;
      L.p(x1, y, R.trim).p(x1 + 1, y, R.ribbon); L.p(x2, y, R.trim).p(x2 - 1, y, R.ribbon);
    }
    put(main, L, null);
  }

  function build(o) {
    const R = REALMS[Math.max(1, Math.min(5, o.realm)) - 1], P = pose(o), main = new Layer();
    const yo = P.drop + P.bob;
    ribbons(main, o, R, o.f || 0);
    const hd = head(main, o, R, P, P.drop + (o.anim === 'walk' ? P.bob : P.bob));
    hd.under();
    arms(main, o, R, P, yo, 'back');
    body(main, o, R, P, yo);
    arms(main, o, R, P, yo, 'front');
    hd.over();
    return main;
  }

  // ---------- yêu thú ----------
  const MOBS = {
    lang: { name: 'Yêu Lang', c: '#7d8696', c2: '#d7dbe2', eye: '#ff5a4a', kind: 'beast' },
    ho: { name: 'Hỏa Hồ', c: '#d9642a', c2: '#fbe6c8', eye: '#ffe36a', kind: 'beast', tail: true },
    linh: { name: 'U Linh', c: '#5fd0d8', c2: '#e6ffff', eye: '#143a4a', kind: 'wisp' },
    ma: { name: 'Huyết Ma', c: '#a8324a', c2: '#ffb0a0', eye: '#fff2a0', kind: 'wisp', horn: true },
    thach: { name: 'Thạch Quái', c: '#8a7a6a', c2: '#c9bba6', eye: '#7af0ff', kind: 'golem' },
    vuong: { name: 'Hắc Lang Vương', c: '#3a3550', c2: '#9a8fd0', eye: '#ff3ad0', kind: 'beast', tail: true, boss: true },
  };
  function buildMob(type, f) {
    const m = MOBS[type] || MOBS.lang, main = new Layer(), L = new Layer(), b = f % 2;
    const oc = dk(m.c, 0.6);
    if (m.kind === 'beast') {
      const y = 34 + b;
      if (m.tail) { L.el(8, y - 3, 4, 3, m.c); L.p(5, y - 4, m.c2).p(5, y - 3, m.c2).p(6, y - 5, m.c2); } else L.r(8, y - 2, 3, 2, m.c).p(7, y - 3, m.c);
      L.el(18, y, 9, 5, m.c);
      L.r(11 + (b ? 1 : 0), y + 4, 3, 7 - b, m.c).r(22 - (b ? 1 : 0), y + 4, 3, 7 - b, m.c);
      L.r(15, y + 4, 2, 6, dk(m.c, 0.25)).r(25, y + 4, 2, 6, dk(m.c, 0.25));
      L.el(28, y - 3, 5, 4.5, m.c); L.r(31, y - 2, 4, 3, m.c2).p(35, y - 2, INK);
      L.p(25, y - 8, m.c).p(26, y - 9, m.c).p(26, y - 8, m.c).p(29, y - 8, m.c).p(30, y - 9, m.c).p(30, y - 8, m.c);
      L.r(29, y - 4, 2, 2, m.eye).r(14, y + 2, 9, 2, m.c2);
      L.p(32, y + 1, '#ffffff').p(34, y + 1, '#ffffff');
    } else if (m.kind === 'wisp') {
      const y = 30 - b * 2;
      L.el(20, y, 8, 8, m.c); L.el(20, y + 2, 5, 4, m.c2);
      for (let i = 0; i < 4; i++) L.r(14 + i * 4, y + 7, 2, 3 + ((i + b) % 2) * 2, m.c);
      L.r(16, y - 2, 2, 3, m.eye).r(22, y - 2, 2, 3, m.eye); L.r(18, y + 3, 4, 1, m.eye);
      if (m.horn) L.p(14, y - 8, m.c2).p(13, y - 9, m.c2).p(26, y - 8, m.c2).p(27, y - 9, m.c2);
    } else {
      const y = 28 + b;
      L.r(12, y, 16, 14, m.c).r(14, y - 6, 12, 7, m.c).r(7, y + 1, 5, 11, m.c).r(28, y + 1, 5, 11, m.c).r(13, y + 14, 5, 6 - b, m.c).r(22, y + 14, 5, 6 - b, m.c);
      L.shade(dk(m.c, 0.25)); L.r(16, y - 4, 3, 2, m.eye).r(21, y - 4, 3, 2, m.eye);
      L.r(14, y + 3, 4, 1, m.c2).r(20, y + 7, 5, 1, m.c2).p(16, y + 9, m.c2).p(9, y + 4, m.c2);
    }
    put(main, L, oc);
    return main;
  }

  // ---------- xuất ra canvas ----------
  const cache = new Map();
  function toCanvas(L, flip) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), im = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = L.d[y * W + (flip ? W - 1 - x : x)]; if (!v) continue;
      const [r, gg, b] = hex(v), i = (y * W + x) * 4; im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }
  // dir: 0 xuống (nhìn thẳng), 1 lên (nhìn từ sau), 2 trái, 3 phải
  function frame(o) {
    const n = o.anim === 'idle' || o.anim === 'sit' ? 2 : 4;
    const f = o.realm >= 5 ? (o.f | 0) % 8 : (o.f | 0) % n;
    const k = [o.g, o.realm, o.dir, o.anim, f].join('|');
    let c = cache.get(k);
    if (!c) { c = toCanvas(build({ g: o.g, realm: o.realm, dir: o.dir, anim: o.anim, f }), o.dir === 2); cache.set(k, c); }
    return c;
  }
  function mob(type, f, flip) {
    const k = 'm|' + type + '|' + (f % 2) + '|' + (flip ? 1 : 0);
    let c = cache.get(k);
    if (!c) { c = toCanvas(buildMob(type, f), flip); cache.set(k, c); }
    return c;
  }
  root.Sprites = { W, H, REALMS, MOBS, frame, mob };
})(typeof window !== 'undefined' ? window : globalThis);
