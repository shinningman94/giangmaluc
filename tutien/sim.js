// Lõi thế giới dùng chung: chạy trên server (node server.js) hoặc ngay trong trình duyệt khi chơi một mình.
(function (root) {
  const TILE = 48, MW = 96, MH = 72, CXT = 48, CYT = 36;       // làng ở giữa bản đồ
  const T = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, DARK: 5, ASH: 6, FLOOR: 7, FLOWER: 8 };
  const REALM_NAMES = ['Luyện Khí', 'Trúc Cơ', 'Kết Đan', 'Nguyên Anh', 'Hóa Thần'];
  const MOB = {
    lang: { hp: 60, atk: 8, exp: 12, spd: 95, zone: 1 },
    linh: { hp: 45, atk: 11, exp: 14, spd: 70, zone: 1 },
    ho: { hp: 260, atk: 30, exp: 60, spd: 110, zone: 2 },
    thach: { hp: 520, atk: 42, exp: 95, spd: 55, zone: 2 },
    ma: { hp: 1500, atk: 95, exp: 320, spd: 100, zone: 3 },
    vuong: { hp: 9000, atk: 190, exp: 3000, spd: 120, zone: 3, boss: true },
  };
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  function makeMap(seed = 7) {
    const r = rng(seed), m = new Uint8Array(MW * MH), zone = new Uint8Array(MW * MH);
    const noise = (x, y) => Math.sin(x * 0.31 + seed) * Math.cos(y * 0.27 - seed) + Math.sin((x + y) * 0.13) * 0.7;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const d = Math.hypot((x - CXT) / 1.25, y - CYT), i = y * MW + x;
      const z = d < 7 ? 0 : d < 17 ? 1 : d < 28 ? 2 : 3;
      zone[i] = z;
      let t = z === 0 ? T.FLOOR : z === 1 ? T.GRASS : z === 2 ? T.DARK : T.ASH;
      const n = noise(x, y), q = r();
      if (z > 0) {
        if (n > 1.25 && d > 9) t = T.WATER;
        else if (q < (z === 1 ? 0.07 : 0.11)) t = T.TREE;
        else if (q < (z === 1 ? 0.09 : 0.15)) t = T.ROCK;
        else if (z === 1 && q < 0.14) t = T.FLOWER;
      }
      if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) t = T.TREE;
      m[i] = t;
    }
    // đường mòn từ làng ra bốn hướng
    for (let k = -1; k <= 0; k++) {
      for (let x = 2; x < MW - 2; x++) m[(CYT + k) * MW + x] = zone[(CYT + k) * MW + x] ? T.PATH : T.FLOOR;
      for (let y = 2; y < MH - 2; y++) m[y * MW + CXT + k] = zone[y * MW + CXT + k] ? T.PATH : T.FLOOR;
    }
    return { m, zone, seed };
  }
  const solid = t => t === T.WATER || t === T.TREE || t === T.ROCK;
  function blocked(map, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return true;
    return solid(map.m[ty * MW + tx]);
  }
  function zoneAt(map, x, y) { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return tx < 0 || ty < 0 || tx >= MW || ty >= MH ? 3 : map.zone[ty * MW + tx]; }

  // ---- chỉ số theo tu vi ----
  const total = p => (p.realm - 1) * 9 + p.lv;                       // tổng số tầng đã tu
  const needExp = p => Math.round(40 * Math.pow(total(p), 1.7));
  function stats(p) { const L = total(p); p.mhp = 80 + L * 26 + (p.realm - 1) * 160; p.atk = 9 + L * 4 + (p.realm - 1) * 14; }
  const SKILLS = [
    { name: 'Quyền', cd: 0.45, mul: 1, range: 78, realm: 1 },
    { name: 'Khí Đạn', cd: 2.2, mul: 2, range: 300, realm: 1 },
    { name: 'Chấn Địa', cd: 7, mul: 2.6, range: 135, realm: 2 },
  ];

  class World {
    constructor(send) {
      this.send = send; this.map = makeMap(); this.players = new Map(); this.mobs = []; this.t = 0; this.acc = 0; this.nid = 1;
      const r = rng(99);
      const spawn = (type, n) => {
        for (let k = 0; k < n; k++) for (let tries = 0; tries < 200; tries++) {
          const tx = 2 + Math.floor(r() * (MW - 4)), ty = 2 + Math.floor(r() * (MH - 4)), i = ty * MW + tx;
          if (this.map.zone[i] !== MOB[type].zone || solid(this.map.m[i])) continue;
          if (MOB[type].boss && Math.hypot(tx - CXT, ty - CYT) < 31) continue;
          const x = tx * TILE + 24, y = ty * TILE + 24;
          this.mobs.push({ id: this.nid++, type, x, y, hx: x, hy: y, hp: MOB[type].hp, mhp: MOB[type].hp, tg: 0, cd: 0, dead: 0, wx: x, wy: y, wt: 0, f: 1 });
          break;
        }
      };
      spawn('lang', 34); spawn('linh', 26); spawn('ho', 34); spawn('thach', 22); spawn('ma', 30); spawn('vuong', 2);
    }
    join(id, d) {
      const s = d.save || {};
      const p = {
        id, name: String(d.name || 'Vô Danh').slice(0, 14), g: d.g ? 1 : 0,
        realm: Math.max(1, Math.min(5, s.realm | 0 || 1)), lv: Math.max(1, Math.min(9, s.lv | 0 || 1)), exp: Math.max(0, +s.exp || 0), gold: Math.max(0, s.gold | 0),
        x: CXT * TILE + (Math.random() * 120 - 60), y: CYT * TILE + 60 + Math.random() * 60, dir: 0, anim: 'idle', sit: false, dead: 0, cds: [0, 0, 0], kills: 0,
      };
      stats(p); p.hp = p.mhp;
      this.players.set(id, p);
      this.send(id, { t: 'hi', id, seed: this.map.seed, x: p.x, y: p.y });
      this.up(p);
      this.all({ t: 'sys', m: `${p.name} (${REALM_NAMES[p.realm - 1]}) đã vào thế giới.` });
    }
    leave(id) { const p = this.players.get(id); if (!p) return; this.players.delete(id); this.all({ t: 'sys', m: `${p.name} đã rời đi.` }); }
    all(msg) { for (const id of this.players.keys()) this.send(id, msg); }
    up(p) { this.send(p.id, { t: 'up', realm: p.realm, lv: p.lv, exp: Math.round(p.exp), need: needExp(p), hp: Math.round(p.hp), mhp: p.mhp, atk: p.atk, gold: p.gold, ready: this.ready(p) }); }
    ready(p) { return p.lv === 9 && p.exp >= needExp(p) && p.realm < 5; }
    gain(p, n) {
      p.exp += n; let ch = false;
      while (p.lv < 9 && p.exp >= needExp(p)) { p.exp -= needExp(p); p.lv++; stats(p); p.hp = p.mhp; ch = true; this.all({ t: 'fx', k: 'lv', id: p.id }); this.send(p.id, { t: 'sys', m: `Tu vi tăng tiến: ${REALM_NAMES[p.realm - 1]} tầng ${p.lv}!` }); }
      if (p.lv === 9) p.exp = Math.min(p.exp, needExp(p));
      return ch;
    }
    recv(id, d) {
      const p = this.players.get(id); if (!p || !d) return;
      if (d.t === 'mv' && !p.dead) {
        const x = +d.x, y = +d.y; if (!isFinite(x) || !isFinite(y)) return;
        if (Math.hypot(x - p.x, y - p.y) < 260 && !blocked(this.map, x, y)) { p.x = x; p.y = y; } else this.send(id, { t: 'pos', x: p.x, y: p.y });
        p.dir = d.dir & 3; p.anim = d.anim === 'walk' ? 'walk' : 'idle'; if (p.anim === 'walk') p.sit = false;
      } else if (d.t === 'sit' && !p.dead) p.sit = !!d.v;
      else if (d.t === 'atk' && !p.dead) this.attack(p, d.k | 0);
      else if (d.t === 'chat') { const m = String(d.m || '').slice(0, 120).trim(); if (m) this.all({ t: 'chat', id, n: p.name, m }); }
      else if (d.t === 'bt' && this.ready(p)) {
        p.realm++; p.lv = 1; p.exp = 0; stats(p); p.hp = p.mhp; this.up(p);
        this.all({ t: 'fx', k: 'bt', id: p.id }); this.all({ t: 'sys', m: `⚡ ${p.name} đột phá thành công, bước vào ${REALM_NAMES[p.realm - 1]}!` });
      }
    }
    attack(p, k) {
      const s = SKILLS[k]; if (!s || p.realm < s.realm || p.cds[k] > this.t) return;
      p.cds[k] = this.t + s.cd; p.sit = false; p.atkT = this.t + 0.35;
      const dv = [[0, 1], [0, -1], [-1, 0], [1, 0]][p.dir];
      let hits = [];
      if (k === 0) hits = this.mobs.filter(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < s.range && ((m.x - p.x) * dv[0] + (m.y - p.y) * dv[1] > -18));
      else if (k === 1) { let best = null, bd = s.range; for (const m of this.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } } if (best) hits = [best]; }
      else hits = this.mobs.filter(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) < s.range);
      const tg = hits[0];
      this.all({ t: 'fx', k: 'sk' + k, id: p.id, x: p.x, y: p.y, tx: tg ? tg.x : p.x + dv[0] * 200, ty: tg ? tg.y : p.y + dv[1] * 200 });
      for (const m of hits) {
        const crit = Math.random() < 0.15, n = Math.round(p.atk * s.mul * (0.85 + Math.random() * 0.3) * (crit ? 1.8 : 1));
        m.hp -= n; m.tg = p.id; this.all({ t: 'dmg', m: m.id, n, crit, x: m.x, y: m.y });
        if (m.hp <= 0) {
          m.dead = this.t + (MOB[m.type].boss ? 60 : 9); m.tg = 0;
          const g = 1 + Math.floor(MOB[m.type].exp / 10); p.gold += g; p.kills++;
          this.gain(p, MOB[m.type].exp); this.up(p);
          this.all({ t: 'fx', k: 'die', x: m.x, y: m.y });
          if (MOB[m.type].boss) this.all({ t: 'sys', m: `🏆 ${p.name} đã hạ Hắc Lang Vương!` });
        }
      }
    }
    tick(dt) {
      this.t += dt;
      for (const p of this.players.values()) {
        if (p.dead) { if (this.t > p.dead) { p.dead = 0; p.hp = p.mhp; p.x = CXT * TILE; p.y = CYT * TILE + 70; this.send(p.id, { t: 'pos', x: p.x, y: p.y }); this.up(p); } continue; }
        const safe = zoneAt(this.map, p.x, p.y) === 0;
        if (p.sit) {                                                    // ngồi thiền: hồi máu và tăng tu vi chậm
          p.hp = Math.min(p.mhp, p.hp + p.mhp * 0.08 * dt);
          p.medT = (p.medT || 0) + dt;
          if (p.medT >= 1) { p.medT = 0; this.gain(p, 1 + total(p) * 0.6); this.up(p); }
        } else if (safe && p.hp < p.mhp) { p.hp = Math.min(p.mhp, p.hp + p.mhp * 0.04 * dt); p.reT = (p.reT || 0) + dt; if (p.reT > 1) { p.reT = 0; this.up(p); } }
      }
      for (const m of this.mobs) {
        const d = MOB[m.type];
        if (m.dead) { if (this.t > m.dead) { m.dead = 0; m.hp = m.mhp; m.x = m.hx; m.y = m.hy; } continue; }
        let tg = m.tg && this.players.get(m.tg);
        if (tg && (tg.dead || zoneAt(this.map, tg.x, tg.y) === 0 || Math.hypot(m.x - m.hx, m.y - m.hy) > 420)) { tg = null; m.tg = 0; }
        if (!tg) for (const p of this.players.values()) if (!p.dead && Math.hypot(p.x - m.x, p.y - m.y) < (d.boss ? 260 : 150) && zoneAt(this.map, p.x, p.y) > 0) { tg = p; m.tg = p.id; break; }
        let gx, gy, spd = d.spd;
        if (tg) {
          const dist = Math.hypot(tg.x - m.x, tg.y - m.y);
          if (dist < 46) {
            if (this.t > m.cd) {
              m.cd = this.t + 1.2; const n = Math.round(d.atk * (0.8 + Math.random() * 0.4));
              tg.hp -= n; tg.sit = false; this.all({ t: 'dmg', p: tg.id, n, x: tg.x, y: tg.y });
              if (tg.hp <= 0) { tg.hp = 0; tg.dead = this.t + 4; m.tg = 0; this.all({ t: 'sys', m: `${tg.name} bị ${m.type === 'vuong' ? 'Hắc Lang Vương' : 'yêu thú'} đánh trọng thương, về làng dưỡng thương.` }); }
              this.up(tg);
            }
            continue;
          }
          gx = tg.x; gy = tg.y;
        } else {
          if (m.hp < m.mhp) m.hp = Math.min(m.mhp, m.hp + m.mhp * 0.1 * dt);
          if (this.t > m.wt) { m.wt = this.t + 2 + Math.random() * 4; m.wx = m.hx + (Math.random() * 2 - 1) * 110; m.wy = m.hy + (Math.random() * 2 - 1) * 110; }
          gx = m.wx; gy = m.wy; spd *= 0.4;
        }
        const dx = gx - m.x, dy = gy - m.y, L = Math.hypot(dx, dy);
        if (L > 4) {
          const sx = dx / L * spd * dt, sy = dy / L * spd * dt;
          if (!blocked(this.map, m.x + sx, m.y) && zoneAt(this.map, m.x + sx, m.y) > 0) m.x += sx;
          if (!blocked(this.map, m.x, m.y + sy) && zoneAt(this.map, m.x, m.y + sy) > 0) m.y += sy;
          if (Math.abs(dx) > 2) m.f = dx > 0 ? 1 : -1;
        }
      }
      this.acc += dt;
      if (this.acc >= 0.1) { this.acc = 0; this.snapshot(); }
    }
    snapshot() {
      const ps = []; for (const p of this.players.values()) ps.push([p.id, p.name, p.g, p.realm, p.lv, Math.round(p.x), Math.round(p.y), p.dir, p.dead ? 'dead' : p.sit ? 'sit' : this.t < (p.atkT || 0) ? 'atk' : p.anim, Math.round(p.hp), p.mhp]);
      for (const p of this.players.values()) {
        const ms = [];
        for (const m of this.mobs) if (!m.dead && Math.abs(m.x - p.x) < 900 && Math.abs(m.y - p.y) < 900) ms.push([m.id, m.type, Math.round(m.x), Math.round(m.y), Math.round(m.hp), m.mhp, m.f]);
        this.send(p.id, { t: 'st', ps, ms });
      }
    }
  }
  const api = { World, makeMap, blocked, zoneAt, solid, T, TILE, MW, MH, CXT, CYT, MOB, SKILLS, REALM_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
