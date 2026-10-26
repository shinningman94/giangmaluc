// Tạo đường đi cho bot online (server/src/botpaths.js) từ bản đồ thật của game (seed online 12345).
// Chạy lại khi bản đồ đổi:  node online/tools/botpaths.js   (cần Python 3 và Playwright có Chromium)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..', '..');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-'));
  execFileSync('python3', [path.join(ROOT, 'online', 'build_online.py'), tmp]);
  let html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  const mark = '/* ---------- main loop ---------- */';
  if (html.split(mark).length !== 2) throw new Error('không tìm thấy main loop');
  html = html.replace(mark, 'window.__bp={newGame,blocked,get WD(){return WD},get MW(){return MW},get MH(){return MH},get RNODES(){return RNODES},TS};' + mark);
  fs.writeFileSync(path.join(tmp, 'index.html'), html);
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto('file://' + path.join(tmp, 'index.html')); await pg.waitForFunction(() => window.__bp);
  const out = await pg.evaluate(() => {
    const B = window.__bp; B.newGame(); const { MW, MH, RNODES } = B, WD = B.WD;
    const free = (x, y) => !B.blocked(x, y);
    const near = (x, y) => { for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (free(x + dx, y + dy)) return [x + dx, y + dy]; return null; };
    function bfs(a, b) {
      const prev = new Int32Array(MW * MH).fill(-1), s = a[1] * MW + a[0], t = b[1] * MW + b[0]; prev[s] = s; const q = [s];
      for (let i = 0; i < q.length; i++) { const c = q[i]; if (c === t) break; const x = c % MW, y = (c / MW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, n = ny * MW + nx; if (free(nx, ny) && prev[n] < 0) { prev[n] = c; q.push(n); } } }
      if (prev[t] < 0) return null; const p = []; for (let c = t; c !== s; c = prev[c]) p.push([c % MW, (c / MW) | 0]); p.push(a); return p.reverse();
    }
    // nén thành các điểm rẽ (đi thẳng giữa hai điểm liên tiếp)
    const turns = p => p.filter((c, i) => i === 0 || i === p.length - 1 || (p[i - 1][0] !== p[i + 1][0] && p[i - 1][1] !== p[i + 1][1]));
    const towns = WD.pois.filter(p => p.k === 'V' || p.k === 'T').map(p => near(p.x, p.y)).filter(Boolean);
    const start = near(RNODES[0].x, RNODES[0].y);
    const uniq = []; for (const t of [start, ...towns]) if (uniq.every(u => Math.hypot(u[0] - t[0], u[1] - t[1]) > 25)) uniq.push(t);
    const byDist = uniq.sort((p, q) => Math.hypot(p[0] - start[0], p[1] - start[1]) - Math.hypot(q[0] - start[0], q[1] - start[1]));
    function route(stops) { let all = []; for (let i = 0; i + 1 < stops.length; i++) { const p = bfs(stops[i], stops[i + 1]); if (!p) continue; all = all.concat(all.length ? p.slice(1) : p); } return turns(all); }
    const jitter = (c, r) => near(c[0] + Math.round((Math.random() * 2 - 1) * r), c[1] + Math.round((Math.random() * 2 - 1) * r)) || c;
    // 2 bot quanh làng đầu, 3 bot đi giữa các làng gần
    const R = [
      route([start, jitter(start, 9), jitter(start, 9), jitter(start, 9), jitter(start, 9), jitter(start, 9), start]),
      route([start, jitter(start, 14), jitter(start, 14), jitter(start, 14), jitter(start, 14), start]),
      route([start, byDist[3], start]),
      route([byDist[1], byDist[2], byDist[3], byDist[1]]),
      route([start, byDist[2], byDist[4], byDist[2], start]),
    ];
    return { start, routes: R, nTowns: uniq.length };
  });
  await b.close();
  const js = '// Tạo bởi online/tools/botpaths.js từ bản đồ online (seed 12345). Toạ độ ô (x, y); nhân 16 ra pixel.\n' +
    '// Mỗi đường là các điểm rẽ: giữa hai điểm liên tiếp bot đi thẳng hàng ngang hoặc dọc.\n' +
    'export const BOT_PATHS = ' + JSON.stringify(out.routes) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'server', 'src', 'botpaths.js'), js);
  console.log('ok', out.routes.map(r => r.length), 'start', out.start, 'towns', out.nTowns);
})();
