/* v16.51: nét vẽ anime cel-shaded, độ phân giải gấp đôi (MCX.k=2), mỗi tấm chỉ giữ phần có hình (MCX.r: x,y,w,h,ox,oy từng khung).
   v16.50: Tạo nhân vật cổ trang (người chơi gửi 2 gói: 35 hoạt ảnh + bộ phận ghép). Mỗi bộ phận là một tấm img/mc_<id>.png
   9 cột x 6 hàng khung 232x244 theo MCX.anims (đứng/đi/chém nhìn phải, trúng đòn, chiến thắng, đứng chính diện, ôm quyền).
   G.look={v:2,g,s,e,h,c,o,m}: giới tính, da, mắt, kiểu tóc, màu tóc, bộ đồ, đội mũ. Ghép các lớp theo thứ tự [layer,order] thành ANIM.diep mới. */
const MC={img:{},cache:{},orig:null};
function mcNorm(l){const n=(v,m,d)=>Number.isInteger(v)&&v>=0&&v<m?v:d;l=l&&typeof l==='object'?l:{};const g=n(l.g,2,0),D=mcDef(g);
  return{v:2,g,s:n(l.s,MCX.skins.length,D.s),e:n(l.e,MCX.eyes.length,D.e),h:n(l.h,MCX.hair.length,D.h),c:n(l.c,MCX.hc.length,D.c),o:n(l.o,MCX.sets.length,D.o),m:l.m===0?0:1};}
function mcDef(g){return g?{v:2,g:1,s:0,e:0,h:3,c:0,o:1,m:1}:{v:2,g:0,s:0,e:0,h:1,c:3,o:7,m:1};}
function mcKey(l){l=mcNorm(l);return''+l.g+l.s+l.e+l.h+l.c+l.o+l.m;}
function mcFromKey(k){k=String(k||'');if(!/^\d{7}$/.test(k))return null;const d=[...k].map(Number);return mcNorm({g:d[0],s:d[1],e:d[2],h:d[3],c:d[4],o:d[5],m:d[6]});}
/* danh sách lớp: [layer,order,src,vũ khí?] đã sắp xếp */
function mcLayers(l){l=mcNorm(l);const g=l.g?'nu':'nam',P=MCX.parts,S=MCX.sets[l.o],sk=MCX.skins[l.s][0],L=[];
  const res=b=>P[b+'__'+g]?b+'__'+g:P[b]?b:null;
  const add=(b,w)=>{const p=res(b);if(!p)return;const e=P[p];if(e[2])L.push([e[0],e[1],p,w]);if(e.length>3)L.push([e[3],e[4],p+'_s',w]);};
  for(const b of['body_'+sk,'arms_'+sk,'hands_'+sk,'face_binh_thuong_'+MCX.eyes[l.e][0]])add(b,0);
  const hs=MCX.hair[l.h][0],hc=MCX.hc[l.c][0];add('hair_'+hs+'_'+hc+'_back',0);add('hair_'+hs+'_'+hc+'_front',0);
  for(const sl in S[2]){if(sl==='weapon')continue;if(sl==='hat'&&!l.m)continue;add(S[2][sl],0);}
  add(S[2].weapon||'kiem_ngoc',1);
  return L.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);}
function mcImg(p){if(MC.img[p])return MC.img[p];return MC.img[p]=new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src='img/mc_'+p+'.png';});}
/* khung ghép (chỉ các khung cần, idx = danh sách số khung) */
async function mcBuild(l,idx){const L=mcLayers(l),ims=await Promise.all(L.map(x=>mcImg(x[2]))),fw=MCX.fw,fh=MCX.fh,fr=[],cmb=new Set();
  for(const a of MCX.anims)if(a[5])for(let i=0;i<a[2];i++)cmb.add(a[1]+i);
  const all=idx||Array.from({length:MCX.anims.reduce((s,a)=>s+a[2],0)},(_,i)=>i);
  for(const k of all){const cv=document.createElement('canvas');cv.width=fw;cv.height=fh;const x=cv.getContext('2d');
    L.forEach((ly,j)=>{if(ly[3]&&!cmb.has(k))return;const im=ims[j];if(im){const r=mcRect(ly[2],k);if(r)x.drawImage(im,r[0],r[1],r[2],r[3],r[4],r[5],r[2],r[3]);}});fr[k]=cv;}
  return fr;}
const MCRC={};
function mcRect(p,k){let R=MCRC[p];if(!R){const t=(MCX.r[p]||'').split(';');R=MCRC[p]=t.map(q=>q?q.split(',').map(Number):null);}return R[k]||null;}
const MCA=Object.fromEntries(MCX.anims.map(a=>[a[0],Array.from({length:a[2]},(_,i)=>a[1]+i)]));
/* bộ hình dạng ANIM cho Minh Dạ: cùng tên tư thế với hình cũ, thêm seq để động tác chạy nhiều khung */
function mcAnim(fr,l){const A=MCA,h=MCX.fh,K=MCX.k||1,box=[60*K,24*K,100*K,h-26*K];
  return{n:fr.length,w:MCX.fw,h,box,sc:63.5/219/K,hmk:31.75/219/K,fr,mc:mcKey(l),iseq:A.cho_phai,
    pose:{idle:A.cho_phai[0],ready:A.chem_phai[0],guard:A.chem_phai[0],turn:A.cho_phai[3],raise:A.chien_thang[2],breath:A.chien_thang[2],halo:A.chien_thang[4],
      dash:A.chem_phai[3],sweep:A.chem_phai[4],throw:A.chem_phai[4],spin:A.chem_phai[5],shock:A.trung_don[1],hit:A.trung_don[1],down:A.trung_don[5],rec:A.trung_don[0],
      back:A.cho_phai[0],front:A.cho_xuong[0],w0:A.di_phai[0],w1:A.di_phai[2],w2:A.di_phai[4],w3:A.di_phai[6]},
    seq:{dash:A.chem_phai.slice(0,5),sweep:A.chem_phai,throw:A.chem_phai,spin:A.chem_phai,raise:A.chien_thang.slice(0,4),halo:A.chien_thang,breath:A.chien_thang.slice(0,5),
      hit:A.trung_don.slice(0,3),shock:A.trung_don.slice(0,3),down:A.trung_don,ready:[A.chem_phai[0]],guard:[A.chem_phai[0]]}};}
function mcStill(a){const f=a.fr[a.pose.front],K=MCX.k||1,[bx,by,bw,bh]=[44*K,8*K,128*K,MCX.fh-8*K];
  const s=document.createElement('canvas'),k=a.sc;s.width=Math.round(bw*k);s.height=Math.round(bh*k);const x=s.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(f,bx,by,bw,bh,0,0,s.width,s.height);
  return s;}
/* đặt hình cho nhân vật chính; l không phải v2 thì dùng lại cách cũ (Minh Dạ gốc hoặc tạo hình 16.42) */
async function heroLook(l){if(!ANIM.diep)return;if(!MC.orig)MC.orig={a:ANIM.diep,s:SPR.diep};
  if(!l||l.v!==2){ANIM.diep=MC.orig.a;SPR.diep=MC.orig.s;try{lookApply(l);}catch(e){}mcMini();return;}
  const k=mcKey(l);let A=MC.cache[k];if(!A){const fr=await mcBuild(l);A=mcAnim(fr,l);A.still=mcStill(A);for(const o of Object.keys(MC.cache)){for(const f of MC.cache[o].fr){if(f){flipC.delete(f);whiteC.delete(f);}}delete MC.cache[o];}MC.cache[k]=A;}
  ANIM.diep=A;SPR.diep=A.still;mcMini();}
function mcMini(){for(const k in MINI)if(k==='diep'||k.indexOf('diep')===0)delete MINI[k];}
/* người chơi khác (bản online): chỉ ghép 4 khung đi, có cache */
const MCP={};
function mcPeerAnim(k){if(!k)return null;if(MCP[k])return MCP[k].a||null;const l=mcFromKey(k);if(!l)return null;MCP[k]={a:null};const A=MCA;
  mcBuild(l,[A.di_phai[0],A.di_phai[2],A.di_phai[4],A.di_phai[6]]).then(fr=>{const a=mcAnim(fr,l);MCP[k].a=a;});return null;}
/* tên nhân vật (cả bản offline): thay chữ Minh Dạ trong lời thoại bằng G.hn */
function hnSub(s){return typeof G!=='undefined'&&G&&G.hn&&typeof s==='string'&&s.indexOf('Minh Dạ')>=0?s.split('Minh Dạ').join(G.hn):s;}
function mcClean(s){return String(s||'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim();}
let MCNAME='';/* tên gợi ý (bản online đặt bằng tên tài khoản) */
function mcSetLook(lk){G.look=mcNorm(lk);if(lk.name){G.hn=lk.name;for(const u of(G.party||[]).concat(G.box||[]))if(u&&u.id==='diep')u.name=lk.name;}}
/* màn tạo nhân vật */
let MCUI=0;
function mcCss(){if(MCUI)return;MCUI=1;const st=document.createElement('style');st.textContent=`
#mcCr{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 25%,#2e2040f0,#0b0812f8);font:18px var(--font);color:#f1e6c8;touch-action:auto}
#mcCr .bx{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:flex-start;justify-content:center;width:min(96vw,820px);max-height:96dvh;overflow:auto;padding:10px 12px;box-sizing:border-box;background:#151022f4;border:2px solid #f0d890;border-radius:8px;overscroll-behavior:contain}
#mcCr h3{flex-basis:100%;margin:0;text-align:center;font-weight:normal;font-size:26px;color:#ffe8a0;text-shadow:0 2px 0 #5a1a18}
#mcCr .pv{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:5px}
#mcCr canvas{width:232px;height:244px;background:radial-gradient(circle at 50% 78%,#46345e,#120c1c 72%);border:1px solid #5a4a6a;border-radius:6px;cursor:pointer}
#mcCr .an{display:flex;flex-wrap:wrap;gap:3px;justify-content:center;max-width:250px}
#mcCr .op{flex:1 1 320px;min-width:270px;display:flex;flex-direction:column;gap:6px}
#mcCr .rw b{display:block;font-weight:normal;color:#ffd27a;margin-bottom:2px}
#mcCr .ch{display:flex;flex-wrap:wrap;gap:4px}
#mcCr button{font:18px var(--font);color:#f1e6c8;background:#2c2440;border:1px solid #5a4a6a;border-radius:4px;padding:2px 9px;cursor:pointer;line-height:1.15}
#mcCr .an button{font-size:16px;padding:1px 6px}
#mcCr button.on{background:#7a2a22;border-color:#f0d890;color:#fff}
#mcCr .sw{width:28px;height:28px;padding:0;border-radius:50%;border:2px solid #5a4a6a}#mcCr .sw.on{border-color:#ffe8a0;box-shadow:0 0 0 2px #7a2a22}
#mcCr input{font:20px var(--font);width:100%;box-sizing:border-box;padding:3px 8px;color:#fff8e0;background:#0e0a16;border:1px solid #8a7a5a;border-radius:4px;user-select:text;-webkit-user-select:text}
#mcCr .err{color:#ff8a7a;min-height:1em;margin:0;font-size:16px}
#mcCr .ft{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}#mcCr .ft .go{background:#2a6a3a;border-color:#a8f0b0;font-size:20px;padding:3px 16px}
#mcCr .ld{color:#a397b6;font-size:15px}
@media (max-height:460px){#mcCr canvas{width:174px;height:183px}#mcCr h3{font-size:22px}}`;document.head.appendChild(st);}
function mcAsk(cur,canBack=true){mcCss();held.length=0;let L=cur&&cur.v===2?mcNorm(cur):mcDef(0);
  let name=(G&&G.hn)||MCNAME||'';
  return new Promise(done=>{const d=document.createElement('div');d.id='mcCr';
    d.innerHTML=`<div class="bx"><h3>Tạo nhân vật</h3><div class="pv"><canvas width="${MCX.fw}" height="${MCX.fh}"></canvas><div class="an"></div><span class="ld"></span></div><div class="op"></div></div>`;document.body.appendChild(d);
    for(const ev of['keydown','keyup','pointerdown','touchstart','wheel'])d.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
    const op=d.querySelector('.op'),an=d.querySelector('.an'),ld=d.querySelector('.ld'),pc=d.querySelector('canvas'),px=pc.getContext('2d');
    let alive=true,fr=null,ver=0,anim=-1,t0=performance.now();
    const AN=[['Tự động',-1],['Đứng','cho_xuong'],['Ôm quyền','om_quyen'],['Đi','di_phai'],['Chém','chem_phai'],['Trúng đòn','trung_don'],['Chiến thắng','chien_thang']];
    const AUTO=['cho_xuong','om_quyen','cho_phai','di_phai','chem_phai','chien_thang'];
    const rebuild=()=>{const v=++ver;ld.textContent='Đang tải hình...';mcBuild(L).then(f=>{if(v!==ver||!alive)return;fr=f;ld.textContent='';});};
    const btn=(t,on,f,cls,sw)=>{const b=document.createElement('button');b.type='button';if(cls)b.className=cls;if(on)b.classList.add('on');if(sw){b.style.background=sw;b.title=t;}else b.textContent=t;
      b.onclick=()=>{try{sfx('sel');}catch(e){}f();draw();};return b;};
    const row=(lab,items)=>{const r=document.createElement('div');r.className='rw';const h=document.createElement('b');h.textContent=lab;r.appendChild(h);const c=document.createElement('div');c.className='ch';items.forEach(b=>c.appendChild(b));r.appendChild(c);op.appendChild(r);};
    const set=(k,v)=>{L[k]=v;rebuild();};
    const draw=()=>{op.innerHTML='';an.innerHTML='';
      AN.forEach(([n,id])=>an.appendChild(btn(n,anim===id,()=>{anim=id;t0=performance.now();})));
      const nr=document.createElement('div');nr.className='rw';const nb=document.createElement('b');nb.textContent='Tên nhân vật';const inp=document.createElement('input');inp.maxLength=12;inp.spellcheck=false;inp.value=name;inp.placeholder='2-12 ký tự';
      inp.oninput=()=>{name=inp.value;err.textContent='';};const err=document.createElement('p');err.className='err';nr.append(nb,inp,err);op.appendChild(nr);
      row('Giới tính',['Nam','Nữ'].map((n,i)=>btn(n,L.g===i,()=>{if(L.g!==i){const D=mcDef(i);L={...L,g:i,h:D.h,o:D.o,c:D.c};rebuild();}})));
      row('Trang phục',MCX.sets.map((s,i)=>btn(s[1],L.o===i,()=>set('o',i))));
      row('Kiểu tóc',MCX.hair.map((h,i)=>btn(h[1],L.h===i,()=>set('h',i))));
      row('Màu tóc',MCX.hc.map((h,i)=>btn(h[1],L.c===i,()=>set('c',i),'sw',h[2])));
      row('Màu mắt',MCX.eyes.map((h,i)=>btn(h[1],L.e===i,()=>set('e',i),'sw',h[2])));
      row('Làn da',MCX.skins.map((h,i)=>btn(h[1],L.s===i,()=>set('s',i),'sw',h[2])));
      row('Mũ, trang sức đầu',['Đội','Bỏ'].map((n,i)=>btn(n,L.m===1-i,()=>set('m',1-i))));
      const ft=document.createElement('div');ft.className='ft';
      ft.appendChild(btn('Bắt đầu ▸',0,()=>{const n=mcClean(name);if([...n].length<2||[...n].length>12){err.textContent='Tên dài 2-12 ký tự';inp.focus();return;}try{sfx('ok');}catch(e){}close({...L,name:n});},'go'));
      ft.appendChild(btn('Ngẫu nhiên',0,()=>{const r=n=>Math.floor(Math.random()*n);L={v:2,g:L.g,s:r(MCX.skins.length),e:r(MCX.eyes.length),h:r(MCX.hair.length),c:r(MCX.hc.length),o:r(MCX.sets.length),m:Math.random()<.7?1:0};rebuild();}));
      if(canBack)ft.appendChild(btn('Quay lại',0,()=>close(null)));op.appendChild(ft);};
    const close=v=>{alive=false;d.remove();try{cv.focus();}catch(_){}done(v);};
    pc.onclick=()=>{const i=AN.findIndex(a=>a[1]===anim);anim=AN[(i+1)%AN.length][1];t0=performance.now();draw();};
    const tick=now=>{if(!alive)return;px.clearRect(0,0,pc.width,pc.height);px.fillStyle='#0007';px.beginPath();px.ellipse(MCX.fw/2,MCX.fh-6*(MCX.k||1),40*(MCX.k||1),7*(MCX.k||1),0,0,7);px.fill();
      if(fr){let id=anim,e=now-t0;if(id===-1){id=AUTO[Math.floor(e/2400)%AUTO.length];e%=2400;}const a=MCX.anims.find(x=>x[0]===id),n=a[2],i=a[4]?Math.floor(e/1000*a[3])%n:Math.min(n-1,Math.floor(e/1000*a[3])%(n+6));
        px.imageSmoothingEnabled=true;px.drawImage(fr[a[1]+Math.min(i,n-1)],0,0);}
      requestAnimationFrame(tick);};
    d.addEventListener('keydown',e=>{if(e.key==='Escape'&&canBack)close(null);});
    draw();rebuild();requestAnimationFrame(tick);});}
window.__mc={mcAsk,heroLook,mcBuild,mcLayers,mcKey,mcPeerAnim};
