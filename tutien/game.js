// Client: vẽ thế giới pixel, điều khiển, HUD; nối server qua WebSocket hoặc tự chạy thế giới khi chơi một mình.
(() => {
  const { T, TILE, MW, MH, CXT, CYT, SKILLS, REALM_NAMES } = Sim;
  const $ = id => document.getElementById(id);
  const art = $('art'), txt = $('txt'), A = art.getContext('2d'), X = txt.getContext('2d');
  const AT = TILE / 2;                                            // 1 ô = 24 điểm ảnh gốc
  let Z = 3, VW = 0, VH = 0, DPR = 1;
  function resize() {
    Z = Math.min(innerWidth, innerHeight) < 620 ? 2 : 3;
    VW = Math.ceil(innerWidth / Z); VH = Math.ceil(innerHeight / Z);
    art.width = VW; art.height = VH; art.style.transform = `scale(${Z})`;
    DPR = Math.min(2, devicePixelRatio || 1);
    txt.width = innerWidth * DPR; txt.height = innerHeight * DPR; txt.style.width = innerWidth + 'px'; txt.style.height = innerHeight + 'px';
    A.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize); resize();

  // ---------- màn hình bắt đầu ----------
  let save = {}; try { save = JSON.parse(localStorage.getItem('tutien_save') || '{}'); } catch { }
  let G = save.g ? 1 : 0;
  $('name').value = save.name || '';
  const picks = [...document.querySelectorAll('#pick button')];
  const setG = g => { G = g; picks.forEach(b => b.classList.toggle('on', +b.dataset.g === g)); };
  picks.forEach(b => b.onclick = () => setG(+b.dataset.g)); setG(G);
  Sprites.REALMS.forEach(r => { const d = document.createElement('div'); d.innerHTML = `<canvas class="px" width="40" height="56"></canvas>${r.name}`; $('realms').appendChild(d); });
  const rcv = [...document.querySelectorAll('#realms canvas')];
  let started = false;
  function startAnim(t) {
    if (started) return;
    const f = Math.floor(t / 260);
    picks.forEach((b, i) => { const c = b.querySelector('canvas').getContext('2d'); c.clearRect(0, 0, 40, 56); c.drawImage(Sprites.frame({ g: i, realm: save.realm || 1, dir: 0, anim: i === G ? 'walk' : 'idle', f }), 0, 0); });
    rcv.forEach((cv, i) => { const c = cv.getContext('2d'); c.clearRect(0, 0, 40, 56); c.drawImage(Sprites.frame({ g: G, realm: i + 1, dir: [0, 3, 1, 2][Math.floor(t / 1400) % 4], anim: 'idle', f }), 0, 0); });
    requestAnimationFrame(startAnim);
  }
  requestAnimationFrame(startAnim);

  // ---------- trạng thái ----------
  const map = Sim.makeMap();
  const me = { id: 0, x: CXT * TILE, y: CYT * TILE + 70, dir: 0, anim: 'idle', sit: false, dead: false, atkT: 0, realm: 1, lv: 1, exp: 0, need: 1, hp: 1, mhp: 1, atk: 0, gold: 0, ready: false };
  const others = new Map(), mobs = new Map(), fx = [], floats = [], bubbles = new Map();
  const cds = [0, 0, 0];
  let now = 0, local = null, ws = null, online = false, sendFn = () => { };

  function onMsg(d) {
    if (d.t === 'hi') { me.id = d.id; me.x = d.x; me.y = d.y; }
    else if (d.t === 'pos') { me.x = d.x; me.y = d.y; }
    else if (d.t === 'up') {
      Object.assign(me, d);
      localStorage.setItem('tutien_save', JSON.stringify({ name: me.name, g: me.g, realm: d.realm, lv: d.lv, exp: d.exp, gold: d.gold }));
      hud();
    } else if (d.t === 'st') {
      const seen = new Set();
      for (const [id, name, g, realm, lv, x, y, dir, anim, hp, mhp] of d.ps) {
        if (id === me.id) { me.dead = anim === 'dead'; if (me.dead) me.sit = false; if (hp !== me.hp) { me.hp = hp; me.mhp = mhp; hud(); } continue; }
        seen.add(id); let o = others.get(id); if (!o) { o = { x, y }; others.set(id, o); }
        Object.assign(o, { id, name, g, realm, lv, tx: x, ty: y, dir, anim, hp, mhp });
      }
      for (const id of others.keys()) if (!seen.has(id)) others.delete(id);
      const ms = new Set();
      for (const [id, type, x, y, hp, mhp, f] of d.ms) { ms.add(id); let m = mobs.get(id); if (!m) { m = { x, y }; mobs.set(id, m); } Object.assign(m, { id, type, tx: x, ty: y, hp, mhp, f }); }
      for (const id of mobs.keys()) if (!ms.has(id)) mobs.delete(id);
      $('net').textContent = (online ? 'Online · ' : 'Một mình · ') + d.ps.length + ' đạo hữu';
    } else if (d.t === 'dmg') floats.push({ x: d.x, y: d.y - 60, n: d.n, crit: d.crit, mine: !!d.p, t: now });
    else if (d.t === 'fx') fx.push(Object.assign({ t: now }, d));
    else if (d.t === 'sys') log(`<div class="s">${esc(d.m)}</div>`);
    else if (d.t === 'chat') { log(`<div><span class="n">${esc(d.n)}:</span> ${esc(d.m)}</div>`); bubbles.set(d.id, { m: d.m, t: now }); }
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function log(h) { const L = $('log'); L.insertAdjacentHTML('beforeend', h); while (L.children.length > 7) L.firstChild.remove(); const el = L.lastChild; setTimeout(() => el.style.opacity = .45, 9000); }
  function hud() {
    $('mname').textContent = me.name; $('mrealm').textContent = `${REALM_NAMES[me.realm - 1]} · tầng ${me.lv}`;
    $('hpb').style.width = Math.max(0, me.hp / me.mhp * 100) + '%'; $('hpt').textContent = `${Math.max(0, Math.round(me.hp))} / ${me.mhp}`;
    $('xpb').style.width = Math.min(100, me.exp / me.need * 100) + '%'; $('xpt').textContent = `Tu vi ${me.exp} / ${me.need}`;
    $('gold').textContent = `◆ ${me.gold} linh thạch`; $('atk').textContent = `Công ${me.atk}`;
    $('bt').style.display = me.ready ? 'block' : 'none';
    $('b2').disabled = me.realm < 2; $('dead').style.display = me.dead ? 'flex' : 'none';
  }

  function begin() {
    if (started) return; started = true;
    me.name = ($('name').value.trim() || 'Đạo Hữu ' + (100 + Math.floor(Math.random() * 900))).slice(0, 14); me.g = G;
    const join = { t: 'join', name: me.name, g: G, save };
    const goLocal = () => {
      if (local) return; online = false;
      local = new Sim.World((id, m) => onMsg(m)); sendFn = m => local.recv(1, m); local.join(1, join);
      log('<div class="s">Chưa nối được server: đang chơi một mình trên máy này.</div>');
    };
    const q = new URLSearchParams(location.search), url = q.get('server') || (/^https?:$/.test(location.protocol) && !q.has('offline') ? location.origin.replace(/^http/, 'ws') + '/ws' : '');
    if (!url) goLocal();
    else {
      let opened = false; const to = setTimeout(() => { if (!opened) { try { ws.close(); } catch { } goLocal(); } }, 3000);
      try {
        ws = new WebSocket(url);
        ws.onopen = () => { opened = true; online = true; clearTimeout(to); sendFn = m => ws.readyState === 1 && ws.send(JSON.stringify(m)); sendFn(join); };
        ws.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch { } };
        ws.onclose = () => { if (opened && !local) { others.clear(); mobs.clear(); save = JSON.parse(localStorage.getItem('tutien_save') || '{}'); join.save = save; log('<div class="s">Mất kết nối server.</div>'); goLocal(); } };
        ws.onerror = () => { if (!opened) { clearTimeout(to); goLocal(); } };
      } catch { clearTimeout(to); goLocal(); }
    }
    $('start').style.display = 'none'; $('hud').style.display = 'block';
    drawMini(); last = performance.now(); requestAnimationFrame(loop);
  }
  $('go').onclick = begin; $('name').onkeydown = e => { if (e.key === 'Enter') begin(); };

  // ---------- điều khiển ----------
  const keys = {}; let jx = 0, jy = 0;
  const chatOpen = () => $('chat').style.display === 'block';
  function toggleChat(send) {
    const c = $('chat'), i = $('ci');
    if (chatOpen()) { const m = i.value.trim(); if (send && m) sendFn({ t: 'chat', m }); i.value = ''; c.style.display = 'none'; i.blur(); }
    else { c.style.display = 'block'; i.focus(); }
  }
  addEventListener('keydown', e => {
    if (!started) return;
    if (e.key === 'Enter') { toggleChat(true); e.preventDefault(); return; }
    if (e.key === 'Escape' && chatOpen()) { toggleChat(false); return; }
    if (chatOpen()) return;
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === 'j' || k === ' ') act(0); if (k === 'k') act(1); if (k === 'l') act(2); if (k === 'm') sit();
    if (k === 'b' && me.ready) sendFn({ t: 'bt' });
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const joy = $('joy'), knob = joy.firstElementChild; let jid = null;
  const jmove = e => { const r = joy.getBoundingClientRect(); let dx = e.clientX - r.left - 60, dy = e.clientY - r.top - 60; const L = Math.hypot(dx, dy), m = Math.min(L, 46); if (L > 0) { dx = dx / L * m; dy = dy / L * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; jx = L > 8 ? dx / 46 : 0; jy = L > 8 ? dy / 46 : 0; };
  joy.onpointerdown = e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); };
  joy.onpointermove = e => { if (e.pointerId === jid) jmove(e); };
  joy.onpointerup = joy.onpointercancel = () => { jid = null; jx = jy = 0; knob.style.transform = ''; };
  const hold = (el, fn) => { let iv = 0; el.onpointerdown = e => { e.preventDefault(); fn(); iv = setInterval(fn, 120); }; el.onpointerup = el.onpointerleave = el.onpointercancel = () => clearInterval(iv); };
  hold($('b0'), () => act(0)); $('b1').onclick = () => act(1); $('b2').onclick = () => act(2); $('b3').onclick = sit; $('bc').onclick = () => toggleChat(true);
  $('bt').onclick = () => sendFn({ t: 'bt' });
  $('ci').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') toggleChat(true); if (e.key === 'Escape') toggleChat(false); };

  function sit() { if (me.dead) return; me.sit = !me.sit; sendFn({ t: 'sit', v: me.sit }); }
  function act(k) {
    if (me.dead || now < cds[k] || me.realm < SKILLS[k].realm) return;
    cds[k] = now + SKILLS[k].cd; me.sit = false; me.atkT = now + 0.35;
    let best = null, bd = k === 0 ? 110 : SKILLS[k].range;               // tự quay mặt về yêu thú gần nhất
    for (const m of mobs.values()) { const d = Math.hypot(m.x - me.x, m.y - me.y); if (d < bd) { bd = d; best = m; } }
    if (best) { const dx = best.x - me.x, dy = best.y - me.y; me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1); }
    sendFn({ t: 'mv', x: me.x, y: me.y, dir: me.dir, anim: 'idle' }); sendFn({ t: 'atk', k });
  }

  // ---------- ô nền ----------
  const tiles = {};
  function mkTile(key, fn, w = AT, h = AT) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); let s = 1; for (const ch of key) s = s * 31 + ch.charCodeAt(0); let q = s >>> 0; fn(g, () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }); tiles[key] = c; }
  const speck = (g, r, base, cols, n) => { g.fillStyle = base; g.fillRect(0, 0, AT, AT); for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(Math.floor(r() * AT), Math.floor(r() * AT), 1 + (r() < .3), 1); } };
  for (let v = 0; v < 3; v++) {
    mkTile('g' + v, (g, r) => { speck(g, r, '#5c9a54', ['#6fb060', '#4f8a4c', '#7dbb6a'], 16); for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 21), y = 2 + Math.floor(r() * 20); g.fillStyle = '#3f7a44'; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y, 1, 2); g.fillRect(x + 1, y - 1, 1, 2); } });
    mkTile('d' + v, (g, r) => { speck(g, r, '#3e6b5a', ['#4a7c66', '#33594e', '#58907a'], 16); for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 21), y = 2 + Math.floor(r() * 20); g.fillStyle = '#284a44'; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y, 1, 2); } });
    mkTile('a' + v, (g, r) => { speck(g, r, '#5a4a5e', ['#66546a', '#4c3e52', '#7a5a66'], 18); if (r() < .5) { g.fillStyle = '#c0503a'; g.fillRect(Math.floor(r() * 20), Math.floor(r() * 20), 2, 1); } });
    mkTile('p' + v, (g, r) => speck(g, r, '#c9a877', ['#d8ba8a', '#b8966a', '#a98860'], 20));
    mkTile('f' + v, (g, r) => { g.fillStyle = '#9d9aa8'; g.fillRect(0, 0, AT, AT); g.fillStyle = '#b4b1be'; g.fillRect(1, 1, 10, 10); g.fillRect(13, 1, 10, 10); g.fillRect(1, 13, 10, 10); g.fillRect(13, 13, 10, 10); for (let i = 0; i < 6; i++) { g.fillStyle = r() < .5 ? '#a6a3b2' : '#c2bfcb'; g.fillRect(Math.floor(r() * 22), Math.floor(r() * 22), 2, 1); } });
    mkTile('w' + v, (g, r) => { speck(g, r, '#3f7fb8', ['#4f93cc', '#356ea6'], 10); g.fillStyle = '#bfe4f5'; for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 18), 3 + Math.floor(r() * 18), 4, 1); });
  }
  mkTile('fl', (g, r) => { for (let i = 0; i < 4; i++) { const x = 2 + Math.floor(r() * 18), y = 2 + Math.floor(r() * 18), c = ['#f6e06a', '#f2a0c0', '#ffffff'][i % 3]; g.fillStyle = c; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 3); g.fillStyle = '#e08030'; g.fillRect(x + 1, y, 1, 1); } });
  const treeArt = (key, leaf, leaf2, dark) => mkTile(key, g => {
    g.fillStyle = '#00000040'; g.fillRect(6, 40, 20, 4); g.fillStyle = '#5a3d2a'; g.fillRect(13, 28, 6, 14); g.fillStyle = '#3f2a1e'; g.fillRect(17, 28, 2, 14);
    const blob = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x + 2, y, w - 4, h); g.fillRect(x, y + 2, w, h - 4); g.fillRect(x + 1, y + 1, w - 2, h - 2); };
    blob(2, 8, 28, 24, dark); blob(3, 7, 26, 22, leaf); blob(7, 2, 18, 14, dark); blob(8, 3, 16, 12, leaf); blob(10, 4, 8, 5, leaf2); blob(5, 12, 9, 6, leaf2); blob(19, 15, 7, 5, leaf2);
  }, 32, 44);
  treeArt('t1', '#3f8f4a', '#62b060', '#245c3a'); treeArt('t2', '#2f6e62', '#4a9080', '#1c4444'); treeArt('t3', '#7a3a4a', '#a8505a', '#4a2030');
  mkTile('rk', g => { g.fillStyle = '#00000040'; g.fillRect(3, 20, 20, 3); g.fillStyle = '#4a4656'; g.fillRect(3, 8, 18, 14); g.fillRect(6, 5, 12, 4); g.fillStyle = '#8a8698'; g.fillRect(4, 8, 15, 12); g.fillRect(7, 6, 9, 3); g.fillStyle = '#b3afc0'; g.fillRect(6, 8, 6, 4); g.fillRect(8, 6, 4, 2); g.fillStyle = '#6a6678'; g.fillRect(14, 13, 5, 7); }, 24, 24);
  const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  function drawMini() {
    const g = $('mm').getContext('2d'), col = { [T.GRASS]: '#5c9a54', [T.FLOWER]: '#6fb060', [T.PATH]: '#c9a877', [T.WATER]: '#3f7fb8', [T.TREE]: '#245c3a', [T.ROCK]: '#8a8698', [T.DARK]: '#3e6b5a', [T.ASH]: '#5a4a5e', [T.FLOOR]: '#b4b1be' };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { g.fillStyle = col[map.m[y * MW + x]]; g.fillRect(x, y, 1, 1); }
    miniBase = g.getImageData(0, 0, MW, MH);
  }
  let miniBase = null, miniT = 0;

  // ---------- vòng lặp ----------
  let last = 0, sendT = 0;
  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; now += dt;
    if (local) local.tick(dt);
    // di chuyển
    let dx = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0) + jx, dy = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0) + jy;
    const L = Math.hypot(dx, dy); let moving = false;
    if (L > 0.15 && !me.dead && !chatOpen()) {
      if (L > 1) { dx /= L; dy /= L; }
      const sp = 190 * dt, nx = me.x + dx * sp, ny = me.y + dy * sp;
      if (!Sim.blocked(map, nx + Math.sign(dx) * 12, me.y) && !Sim.blocked(map, nx + Math.sign(dx) * 12, me.y - 10)) me.x = nx;
      if (!Sim.blocked(map, me.x - 12, ny + (dy > 0 ? 4 : -12)) && !Sim.blocked(map, me.x + 12, ny + (dy > 0 ? 4 : -12))) me.y = ny;
      me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : (dy > 0 ? 0 : 1); moving = true;
      if (me.sit) { me.sit = false; }
    }
    me.anim = me.dead ? 'dead' : now < me.atkT ? 'atk' : moving ? 'walk' : me.sit ? 'sit' : 'idle';
    sendT += dt; if (sendT > 0.08) { sendT = 0; if (moving || me._was) sendFn({ t: 'mv', x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, anim: moving ? 'walk' : 'idle' }); me._was = moving; }
    const k = Math.min(1, dt * 12);
    for (const o of others.values()) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; }
    for (const m of mobs.values()) { m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; }
    draw();
    for (let i = 0; i < 3; i++) { const u = $('b' + i).querySelector('u'); u.style.height = Math.max(0, (cds[i] - now) / SKILLS[i].cd * 100) + '%'; }
    $('b3').style.borderColor = me.sit ? 'var(--jade)' : '';
    requestAnimationFrame(loop);
  }

  function draw() {
    const cx = Math.round(me.x / 2 - VW / 2), cy = Math.round(me.y / 2 - 14 - VH / 2);
    const x0 = Math.floor(cx / AT), y0 = Math.floor(cy / AT), x1 = x0 + Math.ceil(VW / AT) + 1, y1 = y0 + Math.ceil(VH / AT) + 3;
    A.fillStyle = '#14121c'; A.fillRect(0, 0, VW, VH);
    const wf = Math.floor(now * 1.5) % 3, objs = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0 - 1; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
      const i = ty * MW + tx, t = map.m[i], z = map.zone[i], h = hash(tx, ty), v = h % 3, px = tx * AT - cx, py = ty * AT - cy;
      const base = z === 0 ? 'f' : z === 1 ? 'g' : z === 2 ? 'd' : 'a';
      if (t === T.WATER) A.drawImage(tiles['w' + (v + wf) % 3], px, py);
      else if (t === T.PATH) A.drawImage(tiles['p' + v], px, py);
      else A.drawImage(tiles[base + v], px, py);
      if (t === T.FLOWER) A.drawImage(tiles.fl, px, py);
      if (t === T.TREE) objs.push({ y: ty * TILE + 40, im: tiles['t' + Math.max(1, z)], px: px - 4, py: py - 22 });
      if (t === T.ROCK) objs.push({ y: ty * TILE + 40, im: tiles.rk, px, py });
    }
    const f8 = Math.floor(now * 8);
    for (const m of mobs.values()) objs.push({ y: m.y, mob: m });
    for (const o of others.values()) objs.push({ y: o.y, pl: o });
    objs.push({ y: me.y, pl: me });
    objs.sort((a, b) => a.y - b.y);
    X.setTransform(DPR, 0, 0, DPR, 0, 0); X.clearRect(0, 0, innerWidth, innerHeight); X.textAlign = 'center'; X.lineJoin = 'round';
    const label = (s, wx, wy, col, size = 12, bold = true) => { const sx = (wx / 2 - cx) * Z, sy = (wy / 2 - cy) * Z; X.font = `${bold ? 700 : 500} ${size}px system-ui,sans-serif`; X.lineWidth = 3; X.strokeStyle = '#000c'; X.strokeText(s, sx, sy); X.fillStyle = col; X.fillText(s, sx, sy); };
    const hpbar = (wx, wy, r, col) => { const sx = Math.round(wx / 2 - cx) - 9, sy = Math.round(wy / 2 - cy); A.fillStyle = '#000b'; A.fillRect(sx - 1, sy - 1, 20, 4); A.fillStyle = col; A.fillRect(sx, sy, Math.max(0, Math.round(18 * r)), 2); };
    for (const o of objs) {
      if (o.im) { A.drawImage(o.im, o.px, o.py); continue; }
      if (o.mob) {
        const m = o.mob, big = Sim.MOB[m.type].boss ? 2 : 1, sx = Math.round(m.x / 2 - cx), sy = Math.round(m.y / 2 - cy);
        A.fillStyle = '#00000050'; A.fillRect(sx - 9 * big, sy - 2, 18 * big, 4);
        A.drawImage(Sprites.mob(m.type, Math.floor(now * 4 + m.id), m.f < 0), sx - 20 * big, sy - 46 * big, 40 * big, 56 * big);
        if (m.hp < m.mhp || big > 1) hpbar(m.x, m.y - 62 * big, m.hp / m.mhp, '#e0564a');
        label(Sprites.MOBS[m.type].name, m.x, m.y - 68 * big, big > 1 ? '#ff9ae0' : '#ffd0c0', big > 1 ? 13 : 10, big > 1);
        continue;
      }
      const p = o.pl, mine = p === me, sx = Math.round(p.x / 2 - cx), sy = Math.round(p.y / 2 - cy), R = Sprites.REALMS[p.realm - 1];
      // hào quang theo cảnh giới
      A.fillStyle = '#00000050'; A.fillRect(sx - 9, sy - 2, 18, 4); A.fillRect(sx - 7, sy - 3, 14, 6);
      if (p.realm > 1 || p.anim === 'sit') {
        const pul = 0.5 + Math.sin(now * 3 + p.id) * 0.2; A.globalAlpha = 0.22 + pul * 0.18; A.fillStyle = R.aura;
        A.fillRect(sx - 14, sy - 3, 28, 6); A.fillRect(sx - 11, sy - 5, 22, 10); A.globalAlpha = 1;
        for (let i = 0; i < 2 + p.realm; i++) { const ph = (now * 0.6 + i * 0.37 + p.id * 0.11) % 1; A.globalAlpha = 1 - ph; A.fillStyle = R.aura; A.fillRect(sx + Math.round(Math.sin(i * 2.4 + p.id) * 14), sy - Math.round(ph * 44), 1, 2); } A.globalAlpha = 1;
      }
      const dead = p.anim === 'dead'; if (dead) A.globalAlpha = 0.45;
      A.drawImage(Sprites.frame({ g: p.g, realm: p.realm, dir: p.dir, anim: dead ? 'sit' : p.anim, f: p.anim === 'atk' ? 1 + (f8 % 2) : p.anim === 'walk' ? f8 : Math.floor(now * 2.5) }), sx - 20, sy - 52);
      A.globalAlpha = 1;
      if (!mine) hpbar(p.x, p.y - 122, p.hp / p.mhp, '#5fd08a');
      label(p.name, p.x, p.y - 128, mine ? '#fff3c0' : '#ffffff', 12);
      label(`${REALM_NAMES[p.realm - 1]} ${p.lv}`, p.x, p.y - 144, R.aura, 10, false);
      const b = bubbles.get(p.id); if (b) { if (now - b.t > 5) bubbles.delete(p.id); else label(b.m.length > 32 ? b.m.slice(0, 31) + '…' : b.m, p.x, p.y - 162, '#ffffff', 13, false); }
    }
    // hiệu ứng
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], a = now - e.t, who = e.id === me.id ? me : others.get(e.id), ex = who ? who.x : e.x, ey = who ? who.y : e.y;
      const sx = Math.round((ex || 0) / 2 - cx), sy = Math.round((ey || 0) / 2 - cy);
      let life = 0.3;
      if (e.k === 'sk0') { const tx = Math.round(e.tx / 2 - cx), ty = Math.round(e.ty / 2 - cy), d = Math.hypot(tx - sx, ty - sy) || 1, ux = (tx - sx) / d, uy = (ty - sy) / d; A.fillStyle = '#ffffff'; A.globalAlpha = 1 - a / 0.2; for (let j = -3; j <= 3; j++) A.fillRect(Math.round(sx + ux * (14 + a * 60) - uy * j * 2.5 - Math.abs(j) * ux * 1.5), Math.round(sy - 14 + uy * (14 + a * 60) + ux * j * 2.5 - Math.abs(j) * uy * 1.5), 2, 2); life = 0.2; }
      else if (e.k === 'sk1') { life = 0.28; const q = Math.min(1, a / 0.22), bx = (e.x + (e.tx - e.x) * q) / 2 - cx, by = (e.y + (e.ty - e.y) * q) / 2 - cy - 16; A.fillStyle = '#8fe8ff'; A.fillRect(Math.round(bx) - 3, Math.round(by) - 2, 6, 4); A.fillRect(Math.round(bx) - 2, Math.round(by) - 3, 4, 6); A.fillStyle = '#ffffff'; A.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 2, 2); if (q >= 1) { A.globalAlpha = 0.7; A.fillStyle = '#8fe8ff'; A.fillRect(Math.round(bx) - 6, Math.round(by) - 1, 12, 2); A.fillRect(Math.round(bx) - 1, Math.round(by) - 6, 2, 12); } }
      else if (e.k === 'sk2') { life = 0.45; const r = 8 + a / life * 60; A.globalAlpha = 1 - a / life; A.fillStyle = '#ffd56a'; for (let j = 0; j < 40; j++) { const an = j / 40 * 6.283; A.fillRect(Math.round(e.x / 2 - cx + Math.cos(an) * r), Math.round(e.y / 2 - cy + Math.sin(an) * r * 0.55), 2, 2); } }
      else if (e.k === 'die') { life = 0.5; A.globalAlpha = 1 - a / life; A.fillStyle = '#e8e0ff'; for (let j = 0; j < 8; j++) { const an = j / 8 * 6.283; A.fillRect(Math.round(e.x / 2 - cx + Math.cos(an) * a * 40), Math.round(e.y / 2 - cy - 10 + Math.sin(an) * a * 28 - a * 20), 2, 2); } }
      else if (e.k === 'lv') { life = 0.9; A.globalAlpha = 0.6 * (1 - a / life); A.fillStyle = '#9ff0d8'; A.fillRect(sx - 9, sy - 60, 18, 60); A.globalAlpha = 1 - a / life; for (let j = 0; j < 6; j++) A.fillRect(sx - 12 + j * 5, sy - Math.round(a * 70) - (j % 3) * 8, 1, 4); }
      else if (e.k === 'bt') { life = 2.2; const q = a / life, R = who ? Sprites.REALMS[who.realm - 1].aura : '#ffd56a'; A.globalAlpha = 0.55 * (1 - q); A.fillStyle = R; A.fillRect(sx - 14, 0, 28, sy); A.fillStyle = '#ffffff'; A.fillRect(sx - 5, 0, 10, sy); A.globalAlpha = 1 - q; A.fillStyle = R; const r = 10 + q * 90; for (let j = 0; j < 60; j++) { const an = j / 60 * 6.283 + q * 3; A.fillRect(Math.round(sx + Math.cos(an) * r), Math.round(sy + Math.sin(an) * r * 0.5), 2, 2); } }
      A.globalAlpha = 1; if (a > life) fx.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) { const d = floats[i], a = now - d.t; if (a > 0.8) { floats.splice(i, 1); continue; } X.globalAlpha = 1 - Math.max(0, a - 0.5) / 0.3; label((d.mine ? '-' : '') + d.n + (d.crit ? '!' : ''), d.x, d.y - a * 70, d.mine ? '#ff6a5a' : d.crit ? '#ffd24a' : '#ffffff', d.crit ? 20 : 15); X.globalAlpha = 1; }
    // bản đồ nhỏ
    if (miniBase && now - miniT > 0.3) { miniT = now; const g = $('mm').getContext('2d'); g.putImageData(miniBase, 0, 0); g.fillStyle = '#ff5a4a'; for (const o of others.values()) g.fillRect(Math.floor(o.x / TILE) - 1, Math.floor(o.y / TILE) - 1, 2, 2); g.fillStyle = '#ffffff'; g.fillRect(Math.floor(me.x / TILE) - 1, Math.floor(me.y / TILE) - 1, 3, 3); }
  }
  window.__game = { me, mobs, others, act, begin, send: m => sendFn(m) };
})();
