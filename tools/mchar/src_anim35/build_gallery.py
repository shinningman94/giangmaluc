import json, base64
od='anim35_out'
chars=[]
for cid in ("kiem_tien_nam","du_hiep_nu"):
    meta=json.load(open(f"{od}/{cid}/animations.json",encoding="utf-8"))
    anims=[]
    for a in meta["animations"]:
        src='data:image/png;base64,'+base64.b64encode(open(f"{od}/{cid}/{a['sheet_alpha']}",'rb').read()).decode()
        anims.append({**{k:a[k] for k in ("id","name_vi","direction","frames","fps","loop")},"src":src})
    chars.append({"id":cid,"name":meta["character"]["name_vi"],"anims":anims})
html=r'''<title>Kho Hoạt Ảnh Cổ Trang</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Be+Vietnam+Pro:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: header + filter bar, then a dense grid of animation cards (pixel canvases on chroma green) */
:root{--bg:#eceff4;--panel:#fff;--ink:#1a1d29;--muted:#5f6577;--line:#d6dbe5;--accent:#0f766e;--accent-soft:#d5efec;--chroma:#00ff00;
  --display:"Baloo 2","Trebuchet MS",system-ui,sans-serif;--body:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#12141c;--panel:#1b1e29;--ink:#e9ebf2;--muted:#9aa1b4;--line:#2d3140;--accent:#3ec1b2;--accent-soft:#163b38;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#12141c;--panel:#1b1e29;--ink:#e9ebf2;--muted:#9aa1b4;--line:#2d3140;--accent:#3ec1b2;--accent-soft:#163b38;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:14.5px;line-height:1.5}
[hidden]{display:none!important}
.wrap{max-width:1240px;margin:0 auto;padding-block:18px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:16px}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:8px 20px}
h1{font-family:var(--display);font-weight:800;font-size:clamp(28px,4.6vw,42px);line-height:1;margin:0;text-wrap:balance}
.sub{margin:6px 0 0;color:var(--muted);max-width:66ch}
.spec{font-family:var(--mono);font-size:12px;color:var(--muted);text-align:right;line-height:1.7}
.bar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.seg{display:inline-flex;border:1.5px solid var(--line);border-radius:10px;overflow:hidden}
.seg button{font:inherit;font-size:13.5px;font-weight:600;padding:6px 14px;border:0;background:var(--panel);color:var(--ink);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--accent);color:#fff}
.lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600}
.ctl{display:flex;gap:8px;align-items:center}
.ctl input{accent-color:var(--accent)}
.btn{font:inherit;font-size:13.5px;padding:6px 12px;border-radius:9px;border:1.5px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:grid;min-width:0}
.card canvas{width:100%;aspect-ratio:1;display:block;image-rendering:pixelated;background:var(--chroma)}
.card.alpha canvas{background:repeating-conic-gradient(#cfd3dc 0 25%,#f2f3f7 0 50%) 0 0/16px 16px}
.meta{padding:8px 10px 10px;display:grid;gap:2px}
.meta b{font-size:13.5px;font-weight:600;line-height:1.3}
.meta span{font-family:var(--mono);font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.num{font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:600}
</style>
<div class="wrap">
  <header>
    <div><h1>Kho Hoạt Ảnh Cổ Trang</h1>
    <p class="sub">35 hoạt ảnh pixel art cho mỗi nhân vật, 4 hướng, nền xanh chroma. Mỗi thẻ là một dải sprite đang chạy ở đúng tốc độ khung của nó.</p></div>
    <div class="spec">35 hoạt ảnh × 2 nhân vật<br>khung 256×256 · 4–16 khung / hoạt ảnh<br>PNG nền xanh + PNG trong suốt + GIF</div>
  </header>
  <div class="bar">
    <span class="lbl">Nhân vật</span><div class="seg" id="chars"></div>
    <span class="lbl">Hướng</span><div class="seg" id="dirs"></div>
    <label class="ctl" for="spd"><span class="lbl">Tốc độ</span><input id="spd" type="range" min="0.25" max="2" step="0.25" value="1"></label>
    <button class="btn" id="bgb" type="button">Nền: xanh chroma</button>
  </div>
  <div class="grid" id="grid"></div>
</div>
<script>
const D=/*DATA*/null;
const DIRS=["tất cả","xuống","lên","trái","phải","nằm"];
const st={c:0,dir:"tất cả",spd:1,alpha:false};
const $=id=>document.getElementById(id);
let cards=[];
function seg(el,items,get,set){el.innerHTML='';items.forEach((it,i)=>{const b=document.createElement('button');b.type='button';b.textContent=it.label;b.onclick=()=>{set(it.v);render();};el.append(b);it.btn=b;});
  return ()=>items.forEach(it=>it.btn.setAttribute('aria-pressed',get()===it.v));}
const syncC=seg($('chars'),D.map((c,i)=>({label:c.name,v:i})),()=>st.c,v=>st.c=v);
const syncD=seg($('dirs'),DIRS.map(d=>({label:d,v:d})),()=>st.dir,v=>st.dir=v);
function render(){
  syncC(); syncD();
  const g=$('grid'); g.innerHTML=''; cards=[];
  D[st.c].anims.forEach((a,i)=>{
    if(st.dir!=="tất cả" && a.direction!==st.dir) return;
    const card=document.createElement('article'); card.className='card'+(st.alpha?' alpha':'');
    const cv=document.createElement('canvas'); cv.width=256; cv.height=256; card.append(cv);
    const meta=document.createElement('div'); meta.className='meta';
    meta.innerHTML=`<span class="num">${String(i+1).padStart(2,'0')}</span><b>${a.name_vi}</b><span>${a.id} · ${a.frames} khung · ${a.fps} fps${a.loop?' · lặp':''}</span>`;
    card.append(meta); g.append(card);
    const im=new Image(); im.src=a.src;
    cards.push({cv,a,im,t:Math.random()*0.3});
  });
}
let last=0;
function tick(ts){const dt=Math.min(0.1,(ts-(last||ts))/1000); last=ts;
  for(const c of cards){ if(!c.im.complete) continue; c.t+=dt*st.spd;
    const n=c.a.frames, dur=n/c.a.fps; let k=Math.floor(c.t*c.a.fps);
    if(c.a.loop) k%=n; else { const cyc=dur+0.8; k=Math.min(n-1,Math.floor((c.t%cyc)*c.a.fps)); }
    const ctx=c.cv.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,256,256); ctx.drawImage(c.im,k*256,0,256,256,0,0,256,256); }
  requestAnimationFrame(tick);}
$('spd').oninput=e=>st.spd=+e.target.value;
$('bgb').onclick=()=>{st.alpha=!st.alpha; $('bgb').textContent='Nền: '+(st.alpha?'trong suốt':'xanh chroma'); document.querySelectorAll('.card').forEach(c=>c.classList.toggle('alpha',st.alpha));};
render(); requestAnimationFrame(tick);
</script>
'''
open('kho-hoat-anh.html','w',encoding='utf-8').write(html.replace('/*DATA*/null',json.dumps(chars,ensure_ascii=False)))
