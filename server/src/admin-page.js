// Trang quản trị /admin (một trang HTML tự chứa, gọi /admin/api/* bằng mã ADMIN_KEY). Xem admin.js.
export const ADMIN_PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:">
<meta name="robots" content="noindex">
<title>Quản trị Giáng Ma Sư</title>
<style>
:root{--bg:#14101c;--pn:#1f1930;--ln:#3b2f4a;--tx:#f1e6c8;--mu:#a99cba;--ac:#e0b84a;--rd:#d0503c;--gr:#4caf70}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--ln);flex-wrap:wrap}
header h1{font-size:18px;margin:0;color:var(--ac)}header .st{color:var(--mu);font-size:14px}header .sp{flex:1}
main{max-width:1100px;margin:0 auto;padding:16px;display:grid;gap:16px;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}
@media (max-width:820px){main{grid-template-columns:minmax(0,1fr)}}
section{background:var(--pn);border:1px solid var(--ln);border-radius:8px;padding:14px;min-width:0}
h2{font-size:15px;margin:0 0 10px;color:var(--ac)}
input,select,textarea,button{font:inherit;color:var(--tx);background:#2a2240;border:1px solid #5a4a6a;border-radius:6px;padding:6px 10px}
textarea{width:100%;min-height:70px;resize:vertical}input{min-width:0}
button{cursor:pointer;background:#3a2e58}button:hover{border-color:var(--ac)}button.pri{background:#6a4a1a;border-color:var(--ac)}button.dng{background:#5a1f1a;border-color:var(--rd)}
button:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:6px 0}.row>input[type=text],.row>input:not([type]){flex:1}
.g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.g label{display:flex;flex-direction:column;font-size:13px;color:var(--mu);gap:3px}
@media (max-width:480px){.g{grid-template-columns:repeat(2,minmax(0,1fr))}}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 6px;border-bottom:1px solid var(--ln);font-size:14px}th{color:var(--mu);font-weight:500}
tr.u{cursor:pointer}tr.u:hover td{background:#2a2240}tr.sel td{background:#33284c}
.tag{display:inline-block;font-size:12px;padding:0 6px;border-radius:9px;border:1px solid}.on{color:var(--gr);border-color:var(--gr)}.ban{color:var(--rd);border-color:var(--rd)}
.mu{color:var(--mu)}.msg{min-height:20px;font-size:14px;margin-top:6px}.msg.e{color:#ff8a7a}.msg.o{color:#8fe0a8}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0 0 10px}dt{color:var(--mu)}dd{margin:0}
.log p{margin:4px 0;font-size:13px}.log b{color:var(--mu);font-weight:400}
#login{max-width:420px;margin:12vh auto;padding:0 16px}#login section{padding:20px}
.wide{grid-column:1/-1}
</style></head><body>
<div id="login"><section><h2>Quản trị Giáng Ma Sư</h2>
<p class="mu">Nhập mã quản trị (ADMIN_KEY đã đặt trong Cloudflare).</p>
<div class="row"><input id="key" type="password" autocomplete="current-password" placeholder="Mã quản trị"><button class="pri" id="go">Vào</button></div>
<label class="mu"><input type="checkbox" id="keep"> Nhớ trên máy này</label>
<div class="msg e" id="lmsg"></div></section></div>
<div id="app" hidden>
<header><h1>Quản trị Giáng Ma Sư</h1><span class="st" id="stats"></span><span class="sp"></span><button id="out">Thoát</button></header>
<main>
<section><h2>Người chơi</h2>
<div class="row"><input id="q" placeholder="Tìm theo tên tài khoản"><button id="find">Tìm</button></div>
<table><thead><tr><th>Tài khoản</th><th>Tạo lúc</th><th>Trạng thái</th></tr></thead><tbody id="list"></tbody></table>
<div class="row"><button id="prev">‹ Trước</button><span class="mu" id="pg"></span><button id="next">Sau ›</button></div>
</section>
<section id="det"><h2>Chi tiết</h2><p class="mu" id="hint">Chọn một người chơi bên trái.</p>
<div id="dbody" hidden>
<dl id="info"></dl>
<h2>Khóa nick</h2>
<div class="row"><select id="days"><option value="1">1 ngày</option><option value="3">3 ngày</option><option value="7" selected>7 ngày</option><option value="30">30 ngày</option><option value="0">Vĩnh viễn</option></select>
<input id="why" maxlength="160" placeholder="Lý do (người chơi sẽ thấy)"></div>
<div class="row"><button class="dng" id="ban">Khóa</button><button id="unban">Mở khóa</button><button id="kick">Đẩy khỏi game</button></div>
<div class="msg" id="umsg"></div>
</div></section>
<section class="wide"><h2>Gửi thư và quà</h2>
<div class="row"><label><input type="radio" name="to" value="one" checked> Người đang chọn: <b id="toOne">(chưa chọn)</b></label></div>
<div class="row"><label><input type="radio" name="to" value="list"> Danh sách tên:</label><input id="toList" placeholder="ten1, ten2, ten3"></div>
<div class="row"><label><input type="radio" name="to" value="all"> Tất cả người chơi</label></div>
<textarea id="m" maxlength="300" placeholder="Lời nhắn (hiện trong Hòm thư của người chơi)"></textarea>
<div class="g"><label>Bạc<input id="s" type="number" min="0" value="0"></label><label>Thuốc máu<input id="hp" type="number" min="0" value="0"></label><label>Thuốc linh lực<input id="mp" type="number" min="0" value="0"></label><label>Công đức<input id="mer" type="number" min="0" value="0"></label></div>
<div class="row"><button class="pri" id="send">Gửi</button><span class="mu">Quà vào Hòm thư, tự cộng khi người chơi vào game và ở trên bản đồ.</span></div>
<div class="msg" id="mmsg"></div>
</section>
<section class="wide log"><h2>Nhật ký quản trị</h2><div id="log"></div></section>
</main></div>
<script>
(()=>{const $=s=>document.querySelector(s);let KEY='',O=0,TOT=0,SEL=null;
const LS={get(k){try{return localStorage.getItem(k)||sessionStorage.getItem(k)||'';}catch(e){return '';}},set(k,v,keep){try{(keep?localStorage:sessionStorage).setItem(k,v);}catch(e){}},del(k){try{localStorage.removeItem(k);sessionStorage.removeItem(k);}catch(e){}}};
const dt=t=>t?new Date(t).toLocaleString('vi-VN'):'';
async function api(p,body){const r=await fetch('/admin/api/'+p,{method:body?'POST':'GET',headers:{authorization:'Bearer '+KEY,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  let j={};try{j=await r.json();}catch(e){}if(!r.ok)throw Object.assign(new Error(j.err||('Lỗi '+r.status)),{st:r.status});return j;}
const msg=(el,t,ok)=>{el.textContent=t||'';el.className='msg '+(ok?'o':'e');};
const tag=(t,c)=>{const s=document.createElement('span');s.className='tag '+c;s.textContent=t;return s;};
function status(u){const f=document.createDocumentFragment();if(u.ban)f.append(tag(u.ban.until?'Khóa đến '+dt(u.ban.until):'Khóa vĩnh viễn','ban'),' ');if(u.on)f.append(tag('Online','on'));if(!u.ban&&!u.on)f.append(document.createTextNode('—'));return f;}
async function enter(k,keep){KEY=k;try{await stats();}catch(e){KEY='';msg($('#lmsg'),e.message);return;}LS.set('gms-adm',k,keep);$('#login').hidden=true;$('#app').hidden=false;find();loadLog();}
async function stats(){const s=await api('stats');$('#stats').textContent=s.users+' tài khoản · '+s.online+' đang kết nối';}
async function find(){const q=$('#q').value.trim();try{const r=await api('users?q='+encodeURIComponent(q)+'&o='+O);TOT=r.tot;const tb=$('#list');tb.textContent='';
  for(const u of r.list){const tr=document.createElement('tr');tr.className='u'+(SEL===u.u?' sel':'');const a=document.createElement('td');a.textContent=u.n;const b=document.createElement('td');b.textContent=dt(u.at);b.className='mu';const c=document.createElement('td');c.append(status(u));tr.append(a,b,c);tr.onclick=()=>pick(u.u);tb.append(tr);}
  if(!r.list.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=3;td.className='mu';td.textContent='Không thấy ai.';tr.append(td);tb.append(tr);}
  $('#pg').textContent=TOT?(O+1)+'–'+Math.min(TOT,O+50)+' / '+TOT:'';$('#prev').disabled=O<=0;$('#next').disabled=O+50>=TOT;}catch(e){out(e);}}
async function pick(u){SEL=u;$('#toOne').textContent=u;[...document.querySelectorAll('#list tr')].forEach(tr=>tr.classList.toggle('sel',tr.firstChild&&tr.firstChild.textContent.toLowerCase()===u));
  try{const d=await api('user?u='+encodeURIComponent(u));const I=$('#info');I.textContent='';$('#hint').hidden=true;$('#dbody').hidden=false;$('#toOne').textContent=d.n;
    const add=(k,v)=>{const a=document.createElement('dt');a.textContent=k;const b=document.createElement('dd');if(v instanceof Node)b.append(v);else b.textContent=v;I.append(a,b);};
    add('Tài khoản',d.n+(d.g?' (Google)':''));add('Tạo lúc',dt(d.at));add('Trạng thái',status(d));
    if(d.ban&&d.ban.why)add('Lý do khóa',d.ban.why);
    if(d.game){add('Nhân vật',(d.game.hn||'Minh Dạ')+' · cấp '+d.game.lv);add('Bạc',d.game.silver.toLocaleString('vi-VN'));add('Công đức',d.game.merit.toLocaleString('vi-VN'));add('Thuốc',d.game.hp+' máu · '+d.game.mp+' linh lực');add('Đồng hành',d.game.party+' trong đội · '+d.game.box+' trong tháp');}
    else add('Bản lưu','chưa có');
    if(d.saveAt)add('Lưu gần nhất',dt(d.saveAt)+' ('+d.saveKB+' KB)');add('Hòm thư',d.mail+' thư chưa nhận');msg($('#umsg'),'');}catch(e){out(e);}}
function out(e){if(e.st===401){LS.del('gms-adm');location.reload();return;}alert(e.message);}
async function act(p,body,ok){try{await api(p,body);msg($('#umsg'),ok,true);await pick(SEL);find();stats();loadLog();}catch(e){if(e.st===401)return out(e);msg($('#umsg'),e.message);}}
async function loadLog(){try{const r=await api('log');const L=$('#log');L.textContent='';if(!r.list.length){L.textContent='Chưa có.';return;}
  for(const x of r.list){const p=document.createElement('p');const b=document.createElement('b');b.textContent=dt(x.at)+'  ';p.append(b,document.createTextNode(x.t));L.append(p);}}catch(e){}}
$('#go').onclick=()=>enter($('#key').value.trim(),$('#keep').checked);$('#key').onkeydown=e=>{if(e.key==='Enter')$('#go').click();};
$('#out').onclick=()=>{LS.del('gms-adm');location.reload();};
$('#find').onclick=()=>{O=0;find();};$('#q').onkeydown=e=>{if(e.key==='Enter')$('#find').click();};
$('#prev').onclick=()=>{O=Math.max(0,O-50);find();};$('#next').onclick=()=>{O+=50;find();};
$('#ban').onclick=()=>{if(!SEL)return;const d=+$('#days').value;if(!confirm('Khóa '+SEL+(d?' '+d+' ngày':' vĩnh viễn')+'?'))return;act('ban',{u:SEL,days:d,why:$('#why').value},'Đã khóa.');};
$('#unban').onclick=()=>SEL&&act('unban',{u:SEL},'Đã mở khóa.');
$('#kick').onclick=()=>SEL&&act('kick',{u:SEL},'Đã đẩy khỏi game (nếu đang online).');
$('#send').onclick=async()=>{const w=document.querySelector('input[name=to]:checked').value;const to=w==='all'?'*':w==='list'?$('#toList').value:SEL;
  if(!to){msg($('#mmsg'),'Chưa chọn người nhận');return;}
  const b={to,m:$('#m').value,s:$('#s').value,hp:$('#hp').value,mp:$('#mp').value,mer:$('#mer').value};
  if(w==='all'&&!confirm('Gửi thư này cho TẤT CẢ người chơi?'))return;
  $('#send').disabled=true;try{const r=await api('mail',b);msg($('#mmsg'),'Đã gửi cho '+r.sent+' người.',true);loadLog();if(SEL)pick(SEL);}catch(e){if(e.st===401)return out(e);msg($('#mmsg'),e.message);}$('#send').disabled=false;};
const k=LS.get('gms-adm');if(k)enter(k,!!localStorage.getItem('gms-adm'));})();
</script></body></html>`;
