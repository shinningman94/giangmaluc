#!/usr/bin/env python3
"""Đóng gói vua-phap-su.html thành bản web (PWA) trong web/ và chép sang app Android."""
import pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent
WEB = ROOT / 'web'
ASSETS = ROOT / 'android' / 'app' / 'src' / 'main' / 'assets'
VERSION = 178

src = (ROOT / 'vua-phap-su.html').read_text(encoding='utf-8')
# Chế độ online gộp vào app: thêm nút "Chơi online" ở màn hình đầu (chế độ một người giữ nguyên).
# Địa chỉ server lấy từ biến môi trường ONLINE_SERVER hoặc file online/server.txt (wss://.../ws).
if (ROOT / 'online' / 'build_online.py').exists():
    import os, sys
    sys.path.insert(0, str(ROOT / 'online'))
    import build_online
    srv = os.environ.get('ONLINE_SERVER', '').strip()
    if not srv and (ROOT / 'online' / 'server.txt').exists():
        srv = (ROOT / 'online' / 'server.txt').read_text(encoding='utf-8').strip()
    src = build_online.build(srv, dual=True)
    print('online:', srv or '(chưa có địa chỉ server)')
title = re.search(r'<title>.*?</title>', src).group(0)
body = src.replace(title, '', 1)
body = re.sub(r'<link rel="(preconnect|stylesheet)"[^>]*>\n?', '', body)
body = re.sub(r'<meta name="viewport"[^>]*>\n?', '', body)
body = re.sub(r'<meta charset[^>]*>\n?', '', body)

FONTS = """@font-face{font-family:'VT323';font-style:normal;font-weight:400;font-display:swap;src:url(vt323-vietnamese.woff2) format('woff2');unicode-range:U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB}
@font-face{font-family:'VT323';font-style:normal;font-weight:400;font-display:swap;src:url(vt323-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'VT323';font-style:normal;font-weight:400;font-display:swap;src:url(vt323-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}"""

html = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#120d18">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
{title}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-192.png">
<style>{FONTS}
html,body{{margin:0}}</style>
</head>
<body>
{body}
<script>if('serviceWorker' in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js');</script>
</body>
</html>
"""
(WEB / 'index.html').write_text(html, encoding='utf-8')

# v9.1: ảnh của game nằm trong img/ (tách khỏi html cho nhẹ, đỡ giật)
IMG = sorted(p.name for p in (ROOT / 'img').glob('*.*'))
shutil.rmtree(WEB / 'img', ignore_errors=True)
shutil.copytree(ROOT / 'img', WEB / 'img')
files = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
         'vt323-latin.woff2', 'vt323-latin-ext.woff2', 'vt323-vietnamese.woff2'] + ['img/' + n for n in IMG]
(WEB / 'sw.js').write_text(f"""const CACHE='vua-phap-su-v{VERSION}';
const FILES={files!r};
self.addEventListener('install',e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();}});
self.addEventListener('fetch',e=>{{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));}});
""", encoding='utf-8')

(WEB / 'manifest.webmanifest').write_text("""{
  "name": "Giáng Ma Sư: Hàng Ma Ký",
  "short_name": "Giáng Ma Sư",
  "lang": "vi",
  "start_url": "./",
  "scope": "./",
  "display": "fullscreen",
  "orientation": "portrait",
  "background_color": "#120d18",
  "theme_color": "#120d18",
  "icons": [
    {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
  ]
}
""", encoding='utf-8')

ASSETS.mkdir(parents=True, exist_ok=True)
for f in ['index.html', 'vt323-latin.woff2', 'vt323-latin-ext.woff2', 'vt323-vietnamese.woff2']:
    shutil.copy(WEB / f, ASSETS / f)
shutil.rmtree(ASSETS / 'img', ignore_errors=True)
shutil.copytree(WEB / 'img', ASSETS / 'img')
print('OK: web/ và android/app/src/main/assets/ đã được cập nhật')
