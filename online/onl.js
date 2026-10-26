/* ================= BẢN ONLINE (v1.0) =================
   Chạy trong artifact claude.ai: dùng capability `room` (ai đang mở trang lúc này).
   Mọi tín hiệu đi qua presence (ai cũng gửi được, kể cả khách được mời chỉ xem):
   - sảnh: vị trí trên bản đồ, tên, cấp, hạng PvP, câu chat cuối (say.i tăng dần), lời thách đấu (du)
   - phòng riêng 'duel-<mã>': trạng thái võ sĩ đang ra sân, đạn vừa bắn, danh sách đòn trúng (bên đánh tự tính sát thương)
   Không có room (mở file thường, app Android) thì game chạy như bản một người. */
let onlUIq=0;
const ONL={room:null,user:null,me:null,ok:false,err:'',nm:'',peers:new Map(),chat:[],unread:0,sayI:0,sayT:'',sayAt:0,
  duel:null,inv:null,lastSend:0,lastJ:'',tab:0,open:false,ui:null,conn:false};
try{ONL.nm=(localStorage.getItem('gms-onl-nm')||'').slice(0,18);}catch(_){}
function onlNick(){return ONL.nm||'Pháp Sư';}
function onlPvp(){const P=G&&(G.pvp||(G.pvp={w:0,l:0,rp:1000}));return P||{w:0,l:0,rp:1000};}
function onlFree(){return G&&scene==='map'&&!busy&&!DLG&&!CH&&!MENU;}
const ONL_BAD=new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]','g');
function onlClean(t){return String(t||'').replace(ONL_BAD,'').trim();}
/* server riêng (build_online.py --server wss://...) thay cho kênh room của claude.ai; để trống thì dùng claude.ai */
const ONL_SERVER='';
/* bộ chuyển: WebSocket tới server riêng nhưng có cùng kiểu gọi như room của claude.ai (presence, onPeers, join...) */
function onlWsRoom(url){const rooms=new Map(),cls=[];let ws=null,you=null,conn=false,wait=1000,pingT=null;
  let dev='';try{dev=localStorage.getItem('gms-dev')||'';if(!dev){dev='d'+Math.random().toString(36).slice(2,12)+Date.now().toString(36);localStorage.setItem('gms-dev',dev);}}catch(_){dev='d'+Math.random().toString(36).slice(2,12);}
  const tx=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));};
  const setConn=c=>{if(c===conn)return;conn=c;for(const f of cls)try{f(c);}catch(e){console.error(e);}};
  function mk(name){const R={name,others:new Map(),mine:{},ls:[],snap:Object.freeze([]),dirty:false,tm:null,ready:false,wq:[]};
    R.build=()=>{const a=[];if(you)a.push({peer:you,sameTab:true,isMe:true,kind:'viewer',guest:false,by:null,presence:R.mine,updatedAt:Date.now()});
      for(const[k,p]of R.others)a.push({peer:k,sameTab:false,isMe:false,kind:'viewer',guest:false,by:null,presence:p,updatedAt:Date.now()});R.snap=Object.freeze(a);
      for(const f of R.ls)try{f({peers:R.snap,joined:[],left:[],updated:[]});}catch(e){console.error(e);}};
    R.flush=()=>{R.tm=null;if(!R.dirty||!conn||!R.ready)return;R.dirty=false;tx({t:'p',r:name,p:R.mine});};
    R.api={name,presence(patch){for(const k in patch){if(patch[k]===null)delete R.mine[k];else R.mine[k]=patch[k];}R.mine={...R.mine};R.dirty=true;if(!R.tm)R.tm=setTimeout(R.flush,33);return Promise.resolve();},
      peers:()=>R.snap,onPeers(f){R.ls.push(f);setTimeout(()=>f({peers:R.snap,joined:R.snap,left:[],updated:[]}),0);return()=>{R.ls=R.ls.filter(x=>x!==f);};},
      connected:()=>conn,onConnection(f){cls.push(f);setTimeout(()=>f(conn),0);return()=>{};},emit:()=>Promise.resolve(),on:()=>()=>{},
      join:n=>join(n),leave(){rooms.delete(name);tx({t:'leave',r:name});R.ls=[];return Promise.resolve();}};
    return R;}
  function join(n){if(rooms.has(n))return Promise.resolve(rooms.get(n).api);if(!conn)return Promise.reject({code:'upstream_error'});
    const R=mk(n);rooms.set(n,R);tx({t:'join',r:n});return new Promise((res,rej)=>{R.wq.push(res);setTimeout(()=>{if(!R.ready){rooms.delete(n);rej({code:'upstream_error'});}},8000);});}
  function connect(){try{ws=new WebSocket(url);}catch(e){setTimeout(connect,wait);return;}
    ws.onopen=()=>{wait=1000;tx({t:'hello',id:dev,v:1});clearInterval(pingT);pingT=setInterval(()=>tx({t:'ping'}),25000);};
    ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch(_){return;}
      if(m.t==='welcome'){you=m.you;for(const[n,R]of rooms){R.others.clear();R.ready=false;if(n)tx({t:'join',r:n});}setConn(true);return;}
      const R=rooms.get(typeof m.r==='string'?m.r:'');if(!R)return;
      if(m.t==='peers'){R.others.clear();for(const q of m.list||[])if(q.peer!==you)R.others.set(q.peer,Object.freeze(q.p||{}));R.ready=true;R.dirty=true;R.flush();R.build();const w=R.wq;R.wq=[];w.forEach(f=>f(R.api));}
      else if(m.t==='up'&&m.peer!==you){R.others.set(m.peer,Object.freeze(m.p||{}));R.build();}
      else if(m.t==='gone'){R.others.delete(m.peer);R.build();}};
    ws.onclose=()=>{clearInterval(pingT);setConn(false);for(const R of rooms.values()){R.others.clear();R.ready=false;R.build();}
      for(const[n]of[...rooms])if(n)rooms.delete(n);setTimeout(connect,wait);wait=Math.min(15000,wait*2);};
    ws.onerror=()=>{};}
  const L=mk('');rooms.set('',L);connect();return L.api;}
/* ONL_DUAL: app thường có thêm nút 'Chơi online' ở màn hình đầu; ONLM bật khi người chơi chọn chế độ online */
const ONL_DUAL=false;let ONLM=!ONL_DUAL;const ONL_KEY='giang-ma-su-online-v1';
async function onlConnect(){if(onlConnect.d)return;onlConnect.d=1;try{
  const SRV=ONL_SERVER==='same'?(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws':ONL_SERVER;
  if(SRV&&/^wss?:\/\/[^/]/.test(SRV)){ONL.room=null;ONL.top=SRV.replace(/^ws/,'http').replace(/\/ws$/,'/top');const room=onlWsRoom(SRV);let user=null;
    if(window.claude&&typeof window.claude.use==='function'){try{user=await Promise.race([window.claude.use('user'),new Promise(r=>setTimeout(()=>r(null),3000))]);}catch(_){}}
    ONL.user=user;ONL.room=room;room.onConnection(c=>{ONL.conn=c;ONL.err=c?'':'Đang nối lại server...';onlUI();});room.onPeers(onlPeers);
    if(!ONL.nm&&user){try{const v=await user.me();ONL.nm=onlClean(v&&v.name).slice(0,18);}catch(_){}}
    if(!ONL.nm){ONL.nm='Pháp Sư '+ri(100,999);try{localStorage.setItem('gms-onl-nm',ONL.nm);}catch(_){}}onlUI();return;}
  if(!window.claude||typeof window.claude.use!=='function'){ONL.err='Bản online chỉ chạy khi mở trên claude.ai';onlUI();return;}
  const[room,user]=await Promise.all([window.claude.use('room'),window.claude.use('user')]);ONL.user=user;
  if(!room){ONL.err='Không kết nối được phòng chơi chung';onlUI();return;}
  ONL.room=room;
  room.onConnection(c=>{ONL.conn=c;onlUI();},e=>{ONL.err='Mất kết nối ('+e.code+')';ONL.conn=false;onlUI();});
  room.onPeers(onlPeers,e=>{ONL.err='Mất kết nối ('+e.code+')';onlUI();});
  if(!ONL.nm&&user){try{const v=await user.me();ONL.nm=onlClean(v&&v.name).slice(0,18);}catch(_){}}
  if(!ONL.nm)ONL.nm='Pháp Sư '+ri(100,999);
  onlUI();
}catch(e){console.error(e);ONL.err='Lỗi kết nối';onlUI();}}
if(ONLM)onlConnect();
function onlTitleItems(a){if(ONL_DUAL&&!ONLM&&ONL_SERVER)a.push({l:'Chơi online',f:onlEnter});}
/* vào chế độ online: bản lưu riêng, bản đồ chung, nối server */
function onlEnter(){if(!ONL_SERVER){toast('Bản này chưa có địa chỉ server online');return;}ONLM=true;KEY=ONL_KEY;SAVED=loadSave();onlConnect();if(SAVED)continueGame();else startNew();}
function onlLeaveMode(){try{save();}catch(_){}location.reload();}

/* ---------- sảnh: người chơi khác ---------- */
function onlPeers(ch){
  for(const p of ch.peers){if(p.sameTab){ONL.me=p.peer;break;}}
  const live=new Set();
  for(const p of ch.peers){if(p.sameTab||p.kind!=='viewer')continue;const s=p.presence||{};live.add(p.peer);
    let r=ONL.peers.get(p.peer);const fresh=!r;
    if(!r){r={peer:p.peer,x:+s.x||0,y:+s.y||0,sayI:0,sayT:'',sayAt:0};ONL.peers.set(p.peer,r);}
    r.nm=onlClean(s.nm).slice(0,18)||'Pháp Sư';r.guest=p.guest;r.tx=+s.x||0;r.ty=+s.y||0;r.f=s.f<0?-1:1;r.m=!!s.m;r.lv=s.lv|0;r.sc=String(s.sc||'');
    r.rp=s.rp|0||1000;r.w=s.w|0;r.l=s.l|0;r.on=s.sc&&s.sc!=='title';
    if(fresh||Math.abs(r.tx-r.x)>96||Math.abs(r.ty-r.y)>96){r.x=r.tx;r.y=r.ty;}
    const sy=s.say&&typeof s.say==='object'?s.say:null;
    if(fresh)r.sayI=0;
    if(sy&&typeof sy.i==='number'&&sy.i!==r.sayI){const t=onlClean(sy.t).slice(0,120);
      if(t&&(!fresh||Date.now()-(+sy.at||0)<15000)){r.sayT=t;r.sayAt=performance.now();onlAddChat(r.nm,t,false);}
      r.sayI=sy.i;}
    onlDuelSignal(r,s.du);}
  for(const k of[...ONL.peers.keys()])if(!live.has(k)){const r=ONL.peers.get(k);ONL.peers.delete(k);
    if(ONL.inv&&ONL.inv.from===k){ONL.inv=null;}
    if(ONL.duel&&ONL.duel.to===k&&ONL.duel.st==='ask'){ONL.duel=null;toast(r.nm+' đã rời game');}}
  onlUI();}
function onlAddChat(nm,t,me){ONL.chat.push({nm,t,me,at:Date.now()});if(ONL.chat.length>80)ONL.chat.shift();if(!me&&!(ONL.open&&ONL.tab===0))ONL.unread++;onlFeed(nm,t,me);onlUI(1);}
function onlSay(t){t=onlClean(t).slice(0,120);if(!t)return;const now=performance.now();if(now-ONL.sayAt<900){toast('Gõ chậm thôi thầy ơi');return;}
  ONL.sayI++;ONL.sayT=t;ONL.sayAt=now;onlAddChat(onlNick(),t,true);onlSend(true);}
/* gửi presence sảnh: tối đa 8 lần/giây, chỉ khi có thay đổi */
function onlSend(force){if(!ONL.room)return;const now=performance.now();if(!force&&now-ONL.lastSend<125)return;
  const P=onlPvp(),d=G?diep():null;
  const o={v:1,nm:onlNick(),sc:!G||scene==='title'?'title':AR&&AR.pvp?'pvp':scene==='arena'?'arena':scene==='battle'?'battle':scene==='map'?'map':'menu'};
  if(G&&o.sc!=='title'){o.x=Math.round(PL.px);o.y=Math.round(PL.py);o.f=PL.face<0?-1:1;o.m=PL.moving?1:0;o.lv=d?d.lv:1;o.rp=P.rp;o.w=P.w;o.l=P.l;}
  if(ONL.sayI)o.say={i:ONL.sayI,t:ONL.sayT,at:Date.now()-Math.round(now-ONL.sayAt)};
  const D=ONL.duel;o.du=D&&D.st==='ask'?{to:D.to,n:D.n,st:'ask'}:D&&D.role==='b'?{to:D.to,n:D.n,st:'ok'}:ONL.inv&&ONL.inv.no?{to:ONL.inv.from,n:ONL.inv.n,st:'no'}:null;
  const j=JSON.stringify(o);if(j===ONL.lastJ&&!force)return;ONL.lastJ=j;ONL.lastSend=now;ONL.room.presence(o).catch(()=>{});}

/* ---------- vẽ người chơi khác trên bản đồ ---------- */
function onlDrawRow(y,camX,camY){if(!ONLM||!ONL.peers.size||!ANIM.diep)return;
  for(const r of ONL.peers.values()){if(!r.on||r.sc==='title')continue;if(Math.floor((r.y+8)/TS)!==y)continue;
    const hx=Math.round(r.x-camX),hy=Math.round(r.y-camY);if(hx<-40||hy<-60||hx>W+40||hy>H+40)continue;
    const tx=clamp(Math.round((r.x+8)/TS),0,MW-1),ty=clamp(Math.round((r.y+8)/TS),0,MH-1);if(!seen[ty*MW+tx])continue;
    c.globalAlpha=.3;rect(hx+4,hy+14,8,2,'#000');c.globalAlpha=1;
    const HF=heroMapFrame(r.mv?'w'+(Math.floor(time/110)%4):'w0',r.f<0);c.globalAlpha=r.sc==='map'?1:.55;c.drawImage(HF.img,hx+8-HF.ox,hy+15-HF.oy,HF.w,HF.h);c.globalAlpha=1;
    const top=hy+15-HF.oy-2,tag=r.nm+(r.sc==='battle'||r.sc==='arena'||r.sc==='pvp'?' ⚔':'');
    txt(tag,hx+8,top-8,{size:7,align:'center',color:r.sc==='pvp'?'#ffb070':'#9fe8ff',outline:'#120d18'});
    if(r.sayT&&performance.now()-r.sayAt<6000){const L=wrap(r.sayT,90,7).slice(0,3),w=Math.min(96,Math.max(...L.map(l=>tw(l,7)))+8),h=L.length*8+4,bx=Math.round(hx+8-w/2),by=top-10-h;
      c.globalAlpha=.92;rect(bx,by,w,h,'#fff8e8');rect(bx,by+h,w,1,'#5a4a3a');rect(hx+7,by+h,3,2,'#fff8e8');c.globalAlpha=1;L.forEach((l,i)=>txt(l,hx+8,by+2+i*8,{size:7,align:'center',color:'#2a1a10'}));}}
  /* bong bóng chat của chính mình */
  if(ONL.sayT&&performance.now()-ONL.sayAt<6000&&Math.floor((PL.py+8)/TS)===y&&ONL.room){const hx=Math.round(PL.px-camX),hy=Math.round(PL.py-camY),L=wrap(ONL.sayT,90,7).slice(0,3),w=Math.min(96,Math.max(...L.map(l=>tw(l,7)))+8),h=L.length*8+4,bx=Math.round(hx+8-w/2),by=hy-34-h;
    c.globalAlpha=.92;rect(bx,by,w,h,'#e8fff0');rect(hx+7,by+h,3,2,'#e8fff0');c.globalAlpha=1;L.forEach((l,i)=>txt(l,hx+8,by+2+i*8,{size:7,align:'center',color:'#10301a'}));}}
function onlTick(dt){if(!ONLM){if(ONL.ui)onlUIFrame();return;}
  for(const r of ONL.peers.values()){const k=Math.min(1,dt/110);r.x+=(r.tx-r.x)*k;r.y+=(r.ty-r.y)*k;r.mv=r.m||Math.abs(r.tx-r.x)+Math.abs(r.ty-r.y)>1.5;}
  if(ONL.room){onlSend(false);if(AR&&AR.pvp)onlDuelSend();}
  const D=ONL.duel;if(D){if(D.st==='ask'&&performance.now()-D.t0>30000){toast('Không ai nhận lời thách đấu');ONL.duel=null;onlUI();}
    if(D.st==='go'&&onlFree()){D.st='run';run(onlDuelFlow);}}
  onlUIFrame();}
function onlTitle(){if(!ONLM)return;txt(ONL.room?'BẢN ONLINE · '+(ONL.peers.size+1)+' người đang chơi':'BẢN ONLINE · chưa kết nối',W/2,PORT?71:60,{size:9,align:'center',color:'#9fe8ff',outline:'#120d18'});}

/* ---------- thách đấu ---------- */
function onlChallenge(peer){const r=ONL.peers.get(peer);if(!r)return;if(!onlFree()){toast('Đang bận, ra bản đồ rồi hãy thách đấu');return;}
  if(ONL.duel){toast('Thầy đang có một lời thách đấu');return;}
  const C=G.party.concat(G.box||[]).filter(u=>u.id!=='diep');if(!C.length){toast('Cần ít nhất 1 đồng hành mới đấu được');return;}
  ONL.duel={n:Math.random().toString(36).slice(2,10),to:peer,nm:r.nm,rp:r.rp,st:'ask',t0:performance.now()};onlSend(true);toast('Đã gửi lời thách đấu tới '+r.nm);onlUI();}
function onlDuelSignal(r,du){const me=ONL.me;if(!me)return;const ok=du&&typeof du==='object'&&du.to===me&&typeof du.n==='string';
  const D=ONL.duel;
  if(D&&D.st==='ask'&&D.to===r.peer&&ok&&du.n===D.n){
    if(du.st==='ok'){D.st='go';D.role='a';toast(r.nm+' nhận lời! Ra bản đồ để vào trận');onlUI();}
    else if(du.st==='no'){ONL.duel=null;toast(r.nm+' từ chối thách đấu');onlUI();}}
  if(ok&&du.st==='ask'){if(!ONL.inv||ONL.inv.n!==du.n){if(ONL.duel&&ONL.duel.st!=='ask')return;ONL.inv={from:r.peer,n:du.n,nm:r.nm,rp:r.rp,t0:performance.now()};sfx('enc');onlUI();}}
  else if(ONL.inv&&ONL.inv.from===r.peer&&!ONL.inv.no&&!(ok&&du.n===ONL.inv.n)){ONL.inv=null;onlUI();}}
function onlAccept(){const I=ONL.inv;if(!I)return;if(!onlFree()){toast('Xong việc đang làm rồi hãy nhận');return;}
  const C=G.party.concat(G.box||[]).filter(u=>u.id!=='diep');if(!C.length){toast('Cần ít nhất 1 đồng hành mới đấu được');return;}
  ONL.duel={n:I.n,to:I.from,nm:I.nm,rp:I.rp,st:'ok',role:'b',t0:performance.now()};ONL.inv=null;onlSend(true);ONL.duel.st2='ok';
  setTimeout(()=>{if(ONL.duel&&ONL.duel.n===I.n&&ONL.duel.st==='ok')ONL.duel.st='go';},250);onlClose();onlUI();}
function onlDecline(){const I=ONL.inv;if(!I)return;I.no=1;onlSend(true);setTimeout(()=>{if(ONL.inv===I){ONL.inv=null;onlSend(true);onlUI();}},2500);onlUI();}

/* ---------- trận PvP ---------- */
function onlWaitFoe(D,pred,ms,msg){return new Promise(res=>{const t0=performance.now();D.waitMsg=msg;
  const iv=setInterval(()=>{const p=onlFoe(D);if(p&&pred(p.presence)){clearInterval(iv);D.waitMsg='';res(p);}
    else if(D.cancel||performance.now()-t0>ms){clearInterval(iv);D.waitMsg='';res(null);}},120);});}
function onlFoe(D){if(!D.r)return null;return D.r.peers().find(p=>!p.sameTab&&p.kind==='viewer')||null;}
async function onlDuelFlow(){const D=ONL.duel;if(!D)return;
  try{D.r=await ONL.room.join('duel-'+D.n);}catch(e){toast('Không vào được phòng đấu');ONL.duel=null;onlSend(true);return;}
  onlSend(true);
  const C=G.party.concat(G.box||[]).filter(u=>u.id!=='diep');let sel;
  if(C.length>=3){await say(['Trận thách đấu với '+D.nm+'. Chọn 3 đồng hành ra sân (đối thủ cũng đang chọn).'],'Đấu Trường');
    sel=await new Promise(res=>{ARS={C,sel:ARLAST.filter(u=>C.includes(u)).slice(0,3),col:0,i:0,sc:0,res,prev:scene};scene='arsel';});
    if(sel)ARLAST=sel.slice();}
  else{sel=C.slice(0,3);await say(['Thầy chưa đủ 3 đồng hành, '+sel.map(u=>u.name).join(', ')+' sẽ ra sân.'],'Đấu Trường');}
  if(!sel){await onlDuelEnd(D);toast('Đã hủy trận');return;}
  const P=onlPvp();
  await D.r.presence({rdy:1,nm:onlNick(),rp:P.rp,tm:sel.map(u=>({id:u.id,n:u.name,lv:u.lv}))}).catch(()=>{});
  const foe=await onlWaitFoe(D,s=>s&&s.rdy&&Array.isArray(s.tm),90000,'Đang chờ '+D.nm+' chọn đội...');
  if(!foe){await onlDuelEnd(D);await say(D.cancel?'Đã hủy trận.':D.nm+' không vào trận. Trận bị hủy.','Đấu Trường');return;}
  const fs=foe.presence,te=fs.tm.slice(0,3).map(t=>{const id=SPECIES[t&&t.id]?t.id:'den_long';return{id,name:onlClean(t.n).slice(0,24)||SPECIES[id].name,lv:clamp(t.lv|0,1,LVMAX)};});
  if(!te.length){await onlDuelEnd(D);return;}
  D.foeRp=fs.rp|0||D.rp||1000;
  const ta=sel.map(u=>({...u,b:{}}));scene='trans';sfx('enc');held.length=0;await tween(450,t=>{stripes=t;});
  setLand(true);await new Promise(r=>setTimeout(r,350));const L=arLay();
  AR={L,ta,sa:sel,te,ai:0,ei:0,kills:0,a:null,e:null,pj:[],pops:[],fx:[],rg:[],sl:[],shk:0,sha:0,flash:0,phase:'ready',pt:1800,t:0,hold:null,res:null,foe:D.nm+' (người chơi)',iq:.5,
    pvp:{D,hi:0,hits:[],pi:0,pjs:[],seenHit:0,seenPj:0,lastSend:0,lost:0,eix:0,out:0,eKo:-1}};
  AR.a=arFighter(ta[0],'a',sel[0]);AR.e=onlStubFighter(te[0]);
  scene='arena';await tween(350,t=>{stripes=1-t;});
  const win=await new Promise(r=>{AR.res=r;});const kills=AR.kills,quit=AR.quit,left=AR.pvp.left;if(!win)AR.pvp.out=1;AR.pvp.lastSend=0;onlDuelSend();
  scene='trans';await tween(350,t=>{stripes=t;});AR=null;AJ.on=false;setLand(false);await new Promise(r=>setTimeout(r,300));scene='map';await tween(350,t=>{stripes=1-t;});
  await onlDuelEnd(D);
  const E=arElo(P.rp,D.foeRp),d=Math.max(6,Math.round(32*Math.abs((win?1:0)-E)));
  if(win){P.w++;P.rp+=d;const avg=Math.round(sel.reduce((s,u)=>s+u.lv,0)/sel.length),sv=gainSilver(rv(20+avg*2));for(const u of sel)await expTo(u,rv(Math.round(expNeed(u.lv)*.2)),true);
    blogAdd('Thắng '+D.nm+' (người chơi) · +'+d+' điểm PvP');sfx('got');
    await say([(left?D.nm+' rời trận. ':'')+'Thầy thắng '+D.nm+'! Nhận '+sv+' bạc, đồng hành ra sân nhận kinh nghiệm.','+'+d+' điểm PvP → '+P.rp+' ('+arRank(P.rp)+') · '+P.w+' thắng / '+P.l+' thua.'],'Đấu Trường');}
  else{P.l++;P.rp=Math.max(600,P.rp-d);for(const u of sel)await expTo(u,rv(Math.round(expNeed(u.lv)*.05*(1+kills))),true);
    blogAdd('Thua '+D.nm+' (người chơi) · -'+d+' điểm PvP');
    await say([(quit?'Thầy bỏ cuộc. ':'')+'Thua '+D.nm+', hạ được '+kills+'/'+te.length+' đồng hành của đối thủ.','-'+d+' điểm PvP → '+P.rp+' ('+arRank(P.rp)+') · '+P.w+' thắng / '+P.l+' thua.'],'Đấu Trường');}
  save();onlSend(true);}
async function onlDuelEnd(D){if(D.r){try{await D.r.leave();}catch(_){}D.r=null;}if(ONL.duel===D)ONL.duel=null;onlSend(true);onlUI();}
/* hiệu ứng sàn đấu (bản 12.4+ có arFx*); bản cũ không có thì bỏ qua */
const ONL_HY=typeof arFxHit==='function'?11:16,ONL_HR=typeof arFxHit==='function'?11:15;
function onlFx(k,...a){try{if(k==='hit'&&typeof arFxHit==='function')arFxHit(...a);else if(k==='ko'&&typeof arFxKO==='function')arFxKO(...a);
  else if(k==='slash'&&typeof arFxSlash==='function')arFxSlash(...a);else if(k==='trail'&&typeof arFxTrail==='function')arFxTrail(...a);else if(k==='upd'&&typeof arFxUpdate==='function')arFxUpdate(...a);}catch(e){}}
function onlStubFighter(t){const u=makeUnit(t.id,t.lv);u.name=t.name;const f=arFighter(u,'e');f.net=1;return f;}
/* bên đánh tự tính sát thương rồi gửi đi; bên bị đánh trừ máu khi nhận */
function onlHurtRemote(a,b,x,o){const P=AR.pvp;if(AR.phase!=='fight')return;if(b.inv>0){if(!b.mp0){b.mp0=1;arPop(b.x,b.y-21,'NÉ','#c8f0ff');}return;}const r=arDmg(a,b,x);const h={i:++P.hi,d:r.d,c:r.cr?1:0,s:o.stun&&R()<.6?1:0,w:o.slow?1:0};
  P.hits.push(h);if(P.hits.length>12)P.hits.shift();b.hurt=220;sfx(r.cr?'crit':'hit');arPop(b.x,b.y-28,(r.cr?'!':'')+r.d,r.cr?'#ffe060':'#ffffff');onlFx('hit',a,b,o,r.cr);
  if(o.drain){const v=Math.round(r.d*.5);a.hp=Math.min(a.mhp,a.hp+v);arPop(a.x,a.y-30,'+'+v,'#80ff90');}}
function onlTakeHit(h){const A=AR,b=A.a;if(!b||b.hp<=0||A.phase!=='fight')return;if(b.inv>0)return;const d=clamp(h.d|0,0,99999);
  b.hp=Math.max(0,b.hp-d);b.hurt=220;b.x=clamp(b.x-(A.e&&A.e.x>b.x?1:-1)*5,A.L.F.x+10,A.L.F.x+A.L.F.w-10);
  arPop(b.x,b.y-28,(h.c?'!':'')+d,h.c?'#ffe060':'#ff8080');sfx(h.c?'crit':'hit');if(A.e)onlFx('hit',A.e,b,{},!!h.c);
  if(h.s){b.stun=900;arPop(b.x,b.y-36,'CHOÁNG','#ffe060');}if(h.w){b.slow=2500;arPop(b.x,b.y-36,'CHẬM','#90ff90');}
  if(b.hp<=0){b.act={k:'down',t:1e9};sfx('fail');onlFx('ko',b);}}
function onlDuelSend(){const A=AR,P=A.pvp,D=P.D;if(!D.r)return;const now=performance.now();if(now-P.lastSend<60)return;P.lastSend=now;
  const F=A.L.F,f=A.a,q=v=>Math.round(v*1000)/1000;
  const o={ix:A.ai,out:P.out||(A.phase==='end'&&!A.win)?1:0,ph:A.phase};
  if(f)Object.assign(o,{id:f.id,n:f.name,lv:f.lv,hp:Math.ceil(f.hp),mhp:f.mhp,mp:Math.round(f.mp),mmp:f.mmp,def:f.def,x:q((f.x-F.x)/F.w),y:q((f.y-F.y)/F.h),f:f.face,mv:f.mv?1:0,
    k:f.act?f.act.k:'',sh:f.shield>0?1:0,bf:f.buff>0?1:0,st:f.stun>0?1:0,iv:f.inv>0?1:0});
  o.hits=P.hits;o.pj=P.pjs;D.r.presence(o).catch(()=>{});}
function onlArUpdate(dt){const A=AR,P=A.pvp,F=A.L.F;A.t+=dt;if(A.fx)onlFx('upd',dt);A.pops.forEach(p=>{p.life-=dt;p.y-=dt*.02;});A.pops=A.pops.filter(p=>p.life>0);
  /* đối thủ */
  const foe=onlFoe(P.D),s=foe&&foe.presence;
  if(!foe){P.lost+=dt;if(P.lost>6000&&A.phase!=='end'){P.left=1;A.kills=A.te.length;arEnd(true);}}else P.lost=0;
  if(s&&typeof s.ix==='number'){
    if(s.ix>P.eix&&s.ix<A.te.length){P.eix=s.ix;A.ei=s.ix;A.kills=s.ix;const t=A.te[s.ix];A.e=onlStubFighter({id:SPECIES[s.id]?s.id:t.id,name:t.name,lv:t.lv});}
    const e=A.e;if(e&&typeof s.x==='number'){const tx=F.x+(1-clamp(s.x,0,1))*F.w,ty=F.y+clamp(+s.y||0,0,1)*F.h;
      if(e.nx===undefined){e.x=tx;e.y=ty;}e.nx=1;const k=Math.min(1,dt/70);e.x+=(tx-e.x)*k;e.y+=(ty-e.y)*k;e.face=-(s.f<0?-1:1);
      if(typeof s.hp==='number'){if(s.hp<e.hp-.5&&!e.hurt)e.hurt=160;e.hp=clamp(s.hp,0,1e6);}if(s.mhp>0)e.mhp=s.mhp;if(typeof s.mp==='number')e.mp=s.mp;if(s.mmp>0)e.mmp=s.mmp;if(s.def>=0)e.def=s.def;
      e.inv=s.iv?200:0;if(!s.iv)e.mp0=0;else if(e.gh&&(!e.gh.length||e.gh[e.gh.length-1].life<215))e.gh.push({x:e.x,y:e.y,life:260});e.shield=s.sh?500:0;e.buff=s.bf?500:0;e.stun=s.st?200:0;e.mv=s.mv?1:0;const nk=s.k?String(s.k).slice(0,12):'';if(nk==='sweep'&&e.lastK!=='sweep')onlFx('slash',e);e.lastK=nk;e.act=e.hp<=0?{k:'down',t:1e9}:nk?{k:nk,t:200}:null;
      if(e.hp<=0&&P.eKo!==P.eix){P.eKo=P.eix;arPop(e.x,e.y-40,e.name+' bị hạ!','#ffe070');sfx('fail');onlFx('ko',e);}}
    if(Array.isArray(s.hits))for(const h of s.hits){if(!h||typeof h.i!=='number'||h.i<=P.seenHit)continue;P.seenHit=h.i;onlTakeHit(h);}
    if(Array.isArray(s.pj))for(const p of s.pj){if(!p||typeof p.i!=='number'||p.i<=P.seenPj)continue;P.seenPj=p.i;
      A.pj.push({x:F.x+(1-clamp(+p.x||0,0,1))*F.w,y:F.y+clamp(+p.y||0,-.5,1.5)*F.h,vx:-(+p.vx||0)*F.w,vy:(+p.vy||0)*F.h,side:'e',ghost:1,col:/^#[0-9a-f]{6}$/i.test(p.c)?p.c:'#ffd060',r:clamp(+p.r||3,2,6),life:1500,el:/^[a-z]{1,12}$/.test(p.el)?p.el:'spirit',sk:p.sk?1:0});}
    if(s.out&&A.phase!=='end'){A.kills=A.te.length;arEnd(true);}}
  if(A.phase==='ready'){A.pt-=dt;if(A.pt<=0){A.phase='fight';sfx('enc');}}
  for(const f of[A.a,A.e])if(f)arTick(f,dt);
  if(A.phase!=='fight')return;const a=A.a,e=A.e;
  let vx=AJ.on?AJ.vx:0,vy=AJ.on?AJ.vy:0;if(held.includes('left'))vx-=1;if(held.includes('right'))vx+=1;if(held.includes('up'))vy-=1;if(held.includes('down'))vy+=1;
  if(!a.dash){arMove(a,vx,vy,dt);if(Math.abs(vx)>.2)a.face=vx>0?1:-1;else if(!a.mv&&e)a.face=e.x>=a.x?1:-1;}
  if(A.hold)arAttack(a);
  for(const p of A.pj){if(p.side==='a'&&!p.nid){p.nid=++P.pi;P.pjs.push({i:p.nid,x:Math.round((p.x-F.x)/F.w*1000)/1000,y:Math.round((p.y-F.y)/F.h*1000)/1000,vx:Math.round(p.vx/F.w*1000)/1000,vy:Math.round(p.vy/F.h*1000)/1000,c:p.col,r:p.r,el:p.el||'',sk:p.sk?1:0});if(P.pjs.length>6)P.pjs.shift();}
    p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.life-=dt;onlFx('trail',p,dt);const t=p.side==='a'?e:a;
    if(t&&t.hp>0&&Math.abs(p.x-t.x)<11&&Math.abs(p.y-(t.y-ONL_HY))<ONL_HR){p.life=0;if(!p.ghost)arHurt(p.f,t,p.x2,p);}
    if(p.x<F.x-10||p.x>F.x+F.w+10)p.life=0;}
  A.pj=A.pj.filter(p=>p.life>0);
  if(a.hp<=0&&!a.gone){a.gone=1;A.phase='ko';A.pt=1300;A.ko=a;}}
function onlArNext(){const A=AR,P=A.pvp,L=A.L.F;A.ko=null;A.ai++;if(A.rg)A.rg.length=0;
  if(A.ai>=A.ta.length){A.ai=A.ta.length-1;P.out=1;onlDuelSend();P.lastSend=0;return arEnd(false);}
  A.a=arFighter(A.ta[A.ai],'a',A.sa[A.ai]);A.a.x=L.x+L.w*.2;A.a.y=A.e?A.e.y:A.a.y;A.phase='ready';A.pt=900;}

/* ---------- giao diện HTML phủ lên canvas (chat, danh sách người chơi, lời mời) ---------- */
function onlBuildUI(){if(ONL.ui)return ONL.ui;const st=document.createElement('style');st.textContent=`
#onlBtn{position:fixed;right:8px;top:80px;z-index:20;font:18px var(--font);color:#e8f8ff;background:#1d2a4acc;border:1px solid #6a8ad0;border-radius:6px;padding:3px 10px;cursor:pointer;display:none}
#onlBtn b{display:inline-block;min-width:16px;margin-left:4px;padding:0 4px;border-radius:8px;background:#c03030;color:#fff;font-weight:normal}
#onlFeed{position:fixed;left:8px;bottom:40px;z-index:19;max-width:min(70vw,360px);pointer-events:none;display:flex;flex-direction:column;gap:2px}
#onlFeed div{font:17px var(--font);color:#fff0c8;background:#0c0818c0;padding:1px 6px;border-radius:4px;transition:opacity .6s;overflow-wrap:anywhere}
#onlFeed i{font-style:normal;color:#9fe8ff}
#onlPanel{position:fixed;z-index:30;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,440px);height:min(84dvh,560px);display:none;flex-direction:column;background:#151022f2;border:2px solid #f0d890;border-radius:6px;color:#f1e6c8;font:18px var(--font);user-select:text;-webkit-user-select:text;touch-action:auto}
#onlPanel header{display:flex;gap:4px;padding:6px;border-bottom:1px solid #3b2f4a}
#onlPanel header button,#onlPanel .b{font:18px var(--font);color:#f1e6c8;background:#2c2440;border:1px solid #5a4a6a;border-radius:4px;padding:2px 10px;cursor:pointer}
#onlPanel header button.on{background:#7a2a22;border-color:#f0d890;color:#fff}
#onlPanel header .x{margin-left:auto}
#onlBody{flex:1;overflow:auto;padding:6px 8px;overscroll-behavior:contain}
#onlBody p{margin:0 0 3px;overflow-wrap:anywhere}#onlBody p i{font-style:normal;color:#9fe8ff}#onlBody p.me i{color:#a8f0b0}
#onlBody .row{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #2a2236}#onlBody .row span{flex:1;min-width:0}#onlBody .row small{display:block;color:#a397b6;font-size:16px}
#onlPanel footer{display:flex;gap:4px;padding:6px;border-top:1px solid #3b2f4a}
#onlPanel input{flex:1;min-width:0;font:18px var(--font);color:#fff;background:#0c0a18;border:1px solid #5a4a6a;border-radius:4px;padding:3px 6px}
#onlPanel .note{color:#a397b6;font-size:16px;margin:4px 0}
#onlInv{position:fixed;z-index:31;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);display:none;gap:6px;align-items:center;background:#3a1a1af2;border:2px solid #f0d890;border-radius:6px;padding:6px 10px;color:#fff0c8;font:18px var(--font);max-width:94vw;flex-wrap:wrap;justify-content:center}
#onlInv button{font:18px var(--font);border-radius:4px;padding:2px 12px;cursor:pointer;border:1px solid #f0d890}
#onlInv .ok{background:#c0602a;color:#fff}#onlInv .no{background:#2c2440;color:#f1e6c8}
#onlWait{position:fixed;z-index:31;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);display:none;gap:8px;align-items:center;background:#151022f0;border:1px solid #f0d890;border-radius:6px;padding:4px 10px;color:#fff0c8;font:18px var(--font)}
#onlWait button{font:17px var(--font);background:#2c2440;color:#f1e6c8;border:1px solid #5a4a6a;border-radius:4px;cursor:pointer}`;
  document.head.appendChild(st);const d=document.createElement('div');d.innerHTML=`<button id="onlBtn" type="button">🌐 <span>…</span></button><div id="onlFeed"></div>
<div id="onlPanel" role="dialog" aria-label="Chơi online"><header><button data-t="0">Trò chuyện</button><button data-t="1">Người chơi</button><button data-t="3">Xếp hạng</button><button data-t="2">Tên</button><button class="x" aria-label="Đóng">✕</button></header><div id="onlBody"></div><footer></footer></div>
<div id="onlInv"><span></span><button class="ok" type="button">Nhận</button><button class="no" type="button">Từ chối</button></div><div id="onlWait"><span></span><button type="button">Hủy</button></div>`;
  document.body.appendChild(d);const $=s=>d.querySelector(s);
  const U={btn:$('#onlBtn'),feed:$('#onlFeed'),panel:$('#onlPanel'),body:$('#onlBody'),foot:$('#onlPanel footer'),inv:$('#onlInv'),wait:$('#onlWait')};
  for(const el of[U.panel,U.inv,U.wait,U.btn])for(const ev of['keydown','keyup','pointerdown','touchstart','wheel'])el.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
  U.btn.onclick=()=>{audio();onlOpen(ONL.unread?0:ONL.tab);};
  U.panel.querySelector('.x').onclick=onlClose;U.panel.querySelectorAll('header [data-t]').forEach(b=>b.onclick=()=>onlOpen(+b.dataset.t));
  U.inv.querySelector('.ok').onclick=()=>{audio();onlAccept();};U.inv.querySelector('.no').onclick=onlDecline;
  U.wait.querySelector('button').onclick=()=>{if(ONL.duel)ONL.duel.cancel=1;};
  ONL.ui=U;return U;}
function onlOpen(t){if(scene!=='map'&&scene!=='title'){toast('Ra bản đồ rồi mở bảng online');return;}const U=onlBuildUI();ONL.tab=t|0;ONL.open=true;U.panel.style.display='flex';if(ONL.tab===0)ONL.unread=0;held.length=0;onlRender();}
function onlClose(){ONL.open=false;if(ONL.ui)ONL.ui.panel.style.display='none';try{cv.focus();}catch(_){}}
function onlFeed(nm,t,me){if(ONL.open&&ONL.tab===0)return;const U=onlBuildUI(),el=document.createElement('div');const i=document.createElement('i');i.textContent=nm+': ';el.appendChild(i);el.appendChild(document.createTextNode(t));
  U.feed.appendChild(el);while(U.feed.children.length>3)U.feed.firstChild.remove();setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),700);},6000);}
function onlUI(){onlUIq=1;}
function onlStatus(r){return r.sc==='battle'?'đang đánh quái':r.sc==='arena'?'ở đấu trường':r.sc==='pvp'?'đang đấu PvP':r.sc==='menu'?'đang xem menu':r.sc==='title'?'ở màn hình chờ':'trên bản đồ';}
function onlRender(){const U=onlBuildUI();if(!ONL.open)return;U.panel.querySelectorAll('header [data-t]').forEach(b=>b.classList.toggle('on',+b.dataset.t===ONL.tab));
  const B=U.body,Ft=U.foot;const keepScroll=ONL.tab===0&&B.scrollTop+B.clientHeight>=B.scrollHeight-8;B.textContent='';Ft.textContent='';
  const note=t=>{const p=document.createElement('p');p.className='note';p.textContent=t;B.appendChild(p);};
  if(!ONL.room){note(ONL.err||'Đang kết nối...');note('Bản online cần mở trên claude.ai. Bạn bè được chủ game chia sẻ link artifact là vào chơi cùng được.');}
  if(ONL.tab===0){if(!ONL.chat.length)note('Chưa có tin nhắn. Mọi người đang mở game đều thấy tin nhắn của thầy, và câu chat hiện trên đầu nhân vật.');
    for(const m of ONL.chat){const p=document.createElement('p');if(m.me)p.className='me';const i=document.createElement('i');i.textContent=m.nm+': ';p.appendChild(i);p.appendChild(document.createTextNode(m.t));B.appendChild(p);}
    if(keepScroll||1)B.scrollTop=B.scrollHeight;
    const inp=document.createElement('input');inp.maxLength=120;inp.placeholder=ONL.room?'Nhập tin nhắn...':'Chưa kết nối';inp.disabled=!ONL.room;inp.enterKeyHint='send';
    const sb=document.createElement('button');sb.className='b';sb.textContent='Gửi';sb.disabled=!ONL.room;
    const send=()=>{if(!inp.value.trim())return;onlSay(inp.value);inp.value='';inp.focus();};sb.onclick=send;inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send();}});
    Ft.appendChild(inp);Ft.appendChild(sb);if(ONL.inpFocus!==false)setTimeout(()=>{if(ONL.open&&ONL.tab===0&&matchMedia('(pointer:fine)').matches)inp.focus();},0);}
  else if(ONL.tab===1){const L=[...ONL.peers.values()].sort((p,q)=>(q.rp||0)-(p.rp||0));const P=G?onlPvp():null;
    note('Thầy: '+onlNick()+(P?' · PvP '+arRank(P.rp)+' ('+P.rp+' điểm, '+P.w+'T/'+P.l+'B)':'')+(ONL.room?'':' · offline'));
    if(!L.length&&ONL.room)note('Chưa có ai khác đang mở game. Chia sẻ link artifact cho bạn bè để cùng chơi.');
    for(const r of L){const row=document.createElement('div');row.className='row';const sp=document.createElement('span');sp.textContent=r.nm+(r.guest?' (khách)':'');const sm=document.createElement('small');
      const dist=G&&r.on?Math.round((Math.abs(r.tx-PL.px)+Math.abs(r.ty-PL.py))/TS):null;
      sm.textContent=(r.on?'Lv '+r.lv+' · '+arRank(r.rp)+' ('+r.rp+') · ':'')+onlStatus(r)+(dist!==null?' · cách '+dist+' ô':'');sp.appendChild(sm);row.appendChild(sp);
      const b=document.createElement('button');b.className='b';const mine=ONL.duel&&ONL.duel.to===r.peer;b.textContent=mine?'Đang chờ...':'Thách đấu';
      b.disabled=!!ONL.duel||!G||r.sc!=='map'||!onlFree();b.onclick=()=>{onlChallenge(r.peer);onlRender();};row.appendChild(b);B.appendChild(row);}
    note('Thách đấu: mỗi bên chọn 3 đồng hành, ra sân lần lượt 1 chọi 1 như Đấu Trường. Thắng được bạc, kinh nghiệm và điểm PvP.');}
  else if(ONL.tab===3){if(!ONL.top){note('Bảng xếp hạng toàn server chỉ có khi chơi bằng server riêng.');return;}
    if(!ONL.topD||Date.now()-ONL.topAt>20000){ONL.topAt=Date.now();note('Đang tải...');fetch(ONL.top).then(r=>r.json()).then(d=>{ONL.topD=Array.isArray(d)?d:[];onlUI();}).catch(()=>{ONL.topD=[];onlUI();});if(!ONL.topD)return;}
    note('Bảng xếp hạng PvP toàn server (cập nhật khi người chơi online).');
    ONL.topD.slice(0,50).forEach((r,i)=>{const row=document.createElement('div');row.className='row';const sp=document.createElement('span');sp.textContent=(i+1)+'. '+onlClean(r.nm).slice(0,18);
      const sm=document.createElement('small');sm.textContent='Lv '+(r.lv|0)+' · '+arRank(r.rp|0)+' ('+(r.rp|0)+' điểm) · '+(r.w|0)+'T/'+(r.l|0)+'B';sp.appendChild(sm);row.appendChild(sp);B.appendChild(row);});
    if(!ONL.topD.length)note('Chưa có ai trên bảng. Thắng hoặc thua một trận PvP là có tên.');}
  else{note('Tên hiện trên đầu nhân vật và trong chat (tối đa 18 ký tự).');const inp=document.createElement('input');inp.maxLength=18;inp.value=onlNick();const sb=document.createElement('button');sb.className='b';sb.textContent='Lưu tên';
    sb.onclick=()=>{const v=onlClean(inp.value).slice(0,18);if(!v)return;ONL.nm=v;try{localStorage.setItem('gms-onl-nm',v);}catch(_){}onlSend(true);toast('Đã đổi tên: '+v);onlOpen(1);};
    inp.addEventListener('keydown',e=>{if(e.key==='Enter')sb.onclick();});Ft.appendChild(inp);Ft.appendChild(sb);
    if(ONL_DUAL){note('Chế độ online dùng bản lưu riêng. Về chế độ một người thì game tải lại, tiến trình online vẫn được lưu.');const q=document.createElement('button');q.className='b';q.textContent='Về chế độ một người';q.onclick=onlLeaveMode;B.appendChild(q);}}}
let onlLastVis='',onlLastRender=0,onlRectK='';
function onlUIFrame(){if(!ONLM){if(ONL.ui){ONL.ui.btn.style.display='none';ONL.ui.feed.style.display='none';}return;}const U=onlBuildUI();const showBtn=(scene==='map'||scene==='title')&&!ONL.open;
  const n=ONL.room?ONL.peers.size+1:0,lab=(ONL.room?(ONL.conn?n+' online':'đang nối...'):'offline')+'|'+ONL.unread+'|'+showBtn;
  if(lab!==onlLastVis){onlLastVis=lab;U.btn.style.display=showBtn?'block':'none';U.btn.firstElementChild.textContent=ONL.room?(ONL.conn?n+' online':'đang nối...'):'offline';
    let bd=U.btn.querySelector('b');if(ONL.unread){if(!bd){bd=document.createElement('b');U.btn.appendChild(bd);}bd.textContent=String(Math.min(99,ONL.unread));}else if(bd)bd.remove();}
  U.feed.style.display=scene==='map'&&!DLG&&!CH?'flex':'none';
  if(scene==='map'||scene==='title'){const r=cv.getBoundingClientRect(),k=r.width/W,key=[r.left,r.top,r.width,r.height,PORT,scene].join();
    if(key!==onlRectK){onlRectK=key;U.btn.style.right=Math.round(innerWidth-r.right+4*k)+'px';U.btn.style.top=Math.round(r.top+(scene==='title'?6:62)*k)+'px';
      U.feed.style.left=Math.round(r.left+4*k)+'px';U.feed.style.bottom=Math.round(innerHeight-r.top-(H-(PORT?26:6))*k)+'px';}}
  if(ONL.open&&scene!=='map'&&scene!=='title')onlClose();
  const I=ONL.inv,showInv=!!I&&!I.no&&G&&scene!=='arena'&&scene!=='arsel';U.inv.style.display=showInv?'flex':'none';
  if(showInv){const t=I.nm+' thách đấu thầy!'+(onlFree()?'':' (xong việc đang làm rồi nhận)');if(U.inv.firstElementChild.textContent!==t)U.inv.firstElementChild.textContent=t;}
  if(I&&performance.now()-I.t0>45000&&!I.no){ONL.inv=null;}
  const D=ONL.duel,wm=D&&D.waitMsg?D.waitMsg:D&&D.st==='ask'?'Chờ '+D.nm+' nhận lời...':D&&D.st==='go'?'Ra bản đồ để vào trận với '+D.nm:'';U.wait.style.display=wm&&scene!=='arena'&&scene!=='arsel'&&!DLG?'flex':'none';
  if(wm&&U.wait.firstElementChild.textContent!==wm)U.wait.firstElementChild.textContent=wm;U.wait.querySelector('button').style.display=D&&(D.waitMsg||D.st==='ask')?'':'none';
  if(D&&D.st==='ask')U.wait.querySelector('button').onclick=()=>{ONL.duel=null;onlSend(true);onlUI();};else U.wait.querySelector('button').onclick=()=>{if(ONL.duel)ONL.duel.cancel=1;};
  const now=performance.now();if(ONL.open&&onlUIq&&now-onlLastRender>400){onlUIq=0;onlLastRender=now;const a=document.activeElement,keep=a&&a.tagName==='INPUT'?{v:a.value,s:a.selectionStart}:null;ONL.inpFocus=!!keep;onlRender();
    if(keep){const ni=ONL.ui.foot.querySelector('input');if(ni){ni.value=keep.v;ni.focus();try{ni.setSelectionRange(keep.s,keep.s);}catch(_){}}}}}
window.__onl={ONL,onlSay,onlOpen,onlClose,onlChallenge,onlAccept,onlDecline,get AR(){return AR},onlFree,dodge:()=>typeof arDodgeP==='function'&&arDodgeP()};
