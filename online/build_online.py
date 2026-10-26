#!/usr/bin/env python3
"""Tạo bản online từ bản offline.

  python3 build_online.py [thư_mục_ra] [--server URL] [--dual]

  --server wss://ten.workers.dev/ws : nối tới server riêng (web thường, PWA, app Android)
  --server same                     : server là chính trang đang mở (bản do Worker phục vụ)
  (không có --server)               : dùng kênh room của claude.ai (bản artifact)
  --dual                            : giữ nguyên chế độ một người, thêm nút "Chơi online" ở màn hình đầu
                                      (build.py dùng chế độ này cho app Android và bản web)

Đọc ../vua-phap-su.html (không sửa nó), ghi <thư_mục_ra>/index.html. Ảnh dùng chung img/ của bản offline."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = 12345  # mọi người chơi online chung một bản đồ


def build(server='', dual=False, src_path=None):
    s = open(src_path or os.path.join(HERE, '..', 'vua-phap-su.html'), encoding='utf8').read()
    onl = open(os.path.join(HERE, 'onl.js'), encoding='utf8').read()

    def sub(text, a, b):
        assert text.count(a) == 1, 'không tìm thấy (hoặc trùng): ' + a[:70]
        return text.replace(a, b)

    onl = sub(onl, "const ONL_SERVER='';", 'const ONL_SERVER=%s;' % json.dumps(server))
    onl = sub(onl, 'const ONL_DUAL=false;', 'const ONL_DUAL=%s;' % ('true' if dual else 'false'))

    def rep(a, b):
        nonlocal s
        s = sub(s, a, b)

    if not dual:
        rep('<title>Giáng Ma Sư</title>', '<title>Giáng Ma Sư Online</title>')
        rep("const KEY='vua-phap-su-save-v2';", "let KEY='giang-ma-su-online-v1';")
    else:
        rep("const KEY='vua-phap-su-save-v2';", "let KEY='vua-phap-su-save-v2';")
    rep('function newGame(){const seed=ri(1,99999);', 'function newGame(){const seed=ONLM?%d:ri(1,99999);' % SEED)
    rep("if(SAVED)a.unshift({l:'Tiếp tục',f:continueGame});return a;}",
        "if(SAVED)a.unshift({l:'Tiếp tục',f:continueGame});onlTitleItems(a);return a;}")
    rep('function arHurt(a,b,x,o={}){if(b.hp<=0)return;',
        "function arHurt(a,b,x,o={}){if(b.hp<=0)return;if(AR.pvp&&b.side==='e')return onlHurtRemote(a,b,x,o);")
    rep('function arUpdate(dt){const A=AR;if(!A||DLG||CH)return;',
        'function arUpdate(dt){const A=AR;if(A&&A.pvp)return onlArUpdate(dt);if(!A||DLG||CH)return;')
    rep('function arNext(){const A=AR,f=A.ko;', 'function arNext(){if(AR.pvp)return onlArNext();const A=AR,f=A.ko;')
    rep('function arQuit(){const A=AR;if(!A)return;', 'function arQuit(){const A=AR;if(!A)return;if(A.pvp)A.pvp.out=1;')
    # màn hình đầu ngang: 3 nút (Tiếp tục, Bắt đầu, Chơi online) thì dời lên cho khỏi đè dòng chữ cuối
    rep("const it=titleItems();it.forEach((o,i)=>{const y=108+i*16;", "const it=titleItems();it.forEach((o,i)=>{const y=(it.length>2?94:108)+i*16;")
    rep('drawRunner(y,camX,camY);', 'drawRunner(y,camX,camY);onlDrawRow(y,camX,camY);')
    rep('updateMap(dt);\n', 'updateMap(dt);onlTick(dt);\n')
    rep("if(scene==='title')drawTitle();", "if(scene==='title'){drawTitle();onlTitle();}")
    rep("[{t:'Tìm trận xếp hạng'},{t:'Bảng xếp hạng'},{t:'Cách chơi'},{t:'Rời đấu trường',def:1}]);",
        "[{t:'Tìm trận xếp hạng'},{t:'Bảng xếp hạng'},{t:'Cách chơi'},...(ONLM?[{t:'Thách đấu người chơi online'}]:[]),{t:'Rời đấu trường',def:1}]);")
    rep('if(i===0)await arenaPick();', 'if(ONLM&&i===3){onlOpen(1);return;}if(i===0)await arenaPick();')
    # đặt tên nhân vật khi bắt đầu chơi online; mọi chữ "Minh Dạ" hiện ra được thay bằng tên đó
    rep('async function startNew(){newGame();',
        "async function startNew(){let hn;if(ONLM&&!(hn=await onlHeroAsk(onlHeroDef())))return;newGame();if(hn)onlHeroSet(hn);")
    rep('async function continueGame(){applySave(SAVED);', 'async function continueGame(){applySave(SAVED);if(ONLM)await onlHeroFix();')
    rep('function txt(s,x,y,o={}){', 'function txt(s,x,y,o={}){s=onlHN(s);')
    rep('function wrap(s,maxW,size){', 'function wrap(s,maxW,size){s=onlHN(s);')
    # lời thoại hiện dần từng chữ: thay trước để không lộ nửa chữ "Minh D"
    rep('DLG={lines:Array.isArray(lines)?lines:[lines],', 'DLG={lines:(Array.isArray(lines)?lines:[lines]).map(onlHN),')
    rep('/* ---------- main loop ---------- */', onl + '\n/* ---------- main loop ---------- */')
    return s


if __name__ == '__main__':
    args = sys.argv[1:]
    server = ''
    if '--server' in args:
        i = args.index('--server'); server = args[i + 1]; del args[i:i + 2]
    dual = '--dual' in args
    args = [a for a in args if a != '--dual']
    out = args[0] if args else HERE
    html = build(server, dual)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf8').write(html)
    print('ok', os.path.join(out, 'index.html'), len(html))
