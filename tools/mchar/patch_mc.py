#!/usr/bin/env python3
"""v16.50 tạo nhân vật cổ trang: chèn mc_index.js + mchar.js và móc vào vua-phap-su.html. Dùng: patch_mc.py in.html out.html"""
import sys, pathlib
D = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
assert 'function mcAsk' not in src, 'đã vá rồi'
mod = (D / 'mc_index.js').read_text(encoding='utf-8') + (D / 'mchar.js').read_text(encoding='utf-8')
def rep(a, b, n=1):
    global src
    assert src.count(a) == n, (a[:70], src.count(a))
    src = src.replace(a, b)
A = 'async function startNew(){newGame();'
rep(A, mod + A)
rep("const LK=await lookAsk(null,true);if(!LK){G=null;scene='title';return;}G.look=LK;lookApply(LK);",
    "const LK=await mcAsk(null,true);if(!LK){G=null;scene='title';return;}mcSetLook(LK);await heroLook(G.look);")
rep('async function continueGame(){applySave(SAVED);', 'async function continueGame(){applySave(SAVED);')
rep('lookApply(G.look);await gameLoad();', 'await heroLook(G.look);await gameLoad();')
rep("function lookBoot(){try{if(SAVED&&SAVED.G&&SAVED.G.look)lookApply(SAVED.G.look);}catch(e){}",
    "function lookBoot(){try{if(SAVED&&SAVED.G&&SAVED.G.look)heroLook(SAVED.G.look);}catch(e){}")
rep("const lk=await lookAsk(G.look,true);if(lk){G.look=lk;lookApply(lk);save();toast('Đã đổi tạo hình');}",
    "const lk=await mcAsk(G.look,true);if(lk){mcSetLook(lk);await heroLook(G.look);save();toast('Đã đổi tạo hình');}")
rep("d:'Đổi giới tính, kiểu tóc, màu tóc và trang phục của nhân vật.'", "d:'Đổi tên, giới tính, kiểu tóc, màu tóc, màu mắt, làn da và trang phục của nhân vật.'")
rep("SAVED=null;scene='title';G=null;lookApply(null);", "SAVED=null;scene='title';G=null;heroLook(null);")
rep('function txt(s,x,y,o={}){', 'function txt(s,x,y,o={}){s=hnSub(s);')
rep('function wrap(s,maxW,size){', 'function wrap(s,maxW,size){s=hnSub(s);')
rep('function say(lines,speaker){return new Promise(', 'function say(lines,speaker){lines=Array.isArray(lines)?lines.map(hnSub):hnSub(lines);return new Promise(')
rep('function heroMapFrame(k,fl){const a=ANIM.diep,f=a.fr[a.pose[k]],img=fl?flip(f):f,[bx,by,bw,bh]=a.box;\n  return{img,w:a.w*HMK,h:a.h*HMK,ox:(fl?a.w-bx-bw/2:bx+bw/2)*HMK,oy:(by+bh)*HMK};}',
    'function heroMapFrame(k,fl,A){const a=A||ANIM.diep,f=a.fr[a.pose[k]],img=fl?flip(f):f,[bx,by,bw,bh]=a.box,K=a.hmk||HMK;\n  return{img,w:a.w*K,h:a.h*K,ox:(fl?a.w-bx-bw/2:bx+bw/2)*K,oy:(by+bh)*K};}')
rep('if(nativeLeft(a,i))fl=!fl;const f=a.fr[i]', 'if(a.iseq&&!(p&&time<p.until))i=a.iseq[Math.floor(time/170)%a.iseq.length];/* v16.50: nhân vật cổ trang thở khi đứng */if(nativeLeft(a,i))fl=!fl;const f=a.fr[i]')
# hình gốc của Minh Dạ cho tạo hình 16.42 (ANIM.diep có thể đang là nhân vật cổ trang)
rep('function lookClasses(){if(LOOKCLS)return LOOKCLS;const a=ANIM.diep,', 'function lookClasses(){if(LOOKCLS)return LOOKCLS;const a=(typeof MC!=="undefined"&&MC.orig&&MC.orig.a)||ANIM.diep,')
rep('const key=lookKey(l);if(LOOKS[key])return LOOKS[key];const a=ANIM.diep;', 'const key=lookKey(l);if(LOOKS[key])return LOOKS[key];const a=(typeof MC!=="undefined"&&MC.orig&&MC.orig.a)||ANIM.diep;')
pathlib.Path(sys.argv[2]).write_text(src, encoding='utf-8')
print('ok', len(src))
