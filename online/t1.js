const {chromium}=require('playwright');const fs=require('fs');
const SP=process.env.SP,mock=fs.readFileSync(SP+'/t/mock.js','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clear=async p=>{for(let i=0;i<200;i++){const b=await p.evaluate(()=>{const v=__vps;if(v.DLG||v.CH){v.press('a');return 1}return v.busy?1:0});if(!b)return;await sleep(60);}};
(async()=>{const br=await chromium.launch();const ctx=await br.newContext();
  const mk=async(name,vp)=>{const p=await ctx.newPage({viewport:vp});await p.setViewportSize(vp);p.on('pageerror',e=>console.log(name,'ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log(name,'console',m.text())});
    await p.addInitScript(`window.__mockName=${JSON.stringify(name)};`+mock);await p.goto('http://localhost:8765/index.html');return p;};
  const A=await mk('An',{width:400,height:800}),B=await mk('Bình',{width:960,height:640});
  await sleep(2500);
  await A.screenshot({path:SP+'/t/a_title.png'});
  // vào game
  for(const p of[A,B]){await p.evaluate(()=>{window.__spd=1;});
    for(let i=0;i<300;i++){const st=await p.evaluate(()=>{const v=window.__vps;if(v.scene==='title'){v.press('a');return 't';}if(v.DLG||v.CH){v.press('a');return 'd';}return v.scene+(v.busy?'b':'');});if(st==='map')break;await sleep(60);}}
  console.log('scenes',await A.evaluate(()=>__vps.scene),await B.evaluate(()=>__vps.scene));
  // cho đồng hành
  await A.evaluate(()=>{const v=__vps;['den_long','kappa','ho_ly'].forEach(id=>v.G.party.push(v.makeUnit(id,8)));});
  await B.evaluate(()=>{const v=__vps;['kappa','ho_ly'].forEach(id=>v.G.party.push(v.makeUnit(id,8)));});
  await sleep(1500);
  console.log('A sees',await A.evaluate(()=>[...__onl.ONL.peers.values()].map(r=>[r.nm,r.tx,r.ty,r.sc,r.lv])), 'me pos',await A.evaluate(()=>[__vps.PL.px,__vps.PL.py]));
  console.log('B sees',await B.evaluate(()=>[...__onl.ONL.peers.values()].map(r=>[r.nm,r.tx,r.ty,r.sc])));
  // B đi cạnh A cho dễ thấy: dịch B tới gần A
  await B.evaluate(()=>{});
  await A.evaluate(()=>__onl.onlSay('Chào cả nhà, đi săn ma không?'));
  await sleep(800);
  console.log('B chat',await B.evaluate(()=>__onl.ONL.chat.map(m=>m.nm+': '+m.t)));
  await clear(A);await clear(B);await A.evaluate(()=>__onl.onlSay('Lần hai nè'));await sleep(500);await B.screenshot({path:SP+'/t/b_map.png'});await A.screenshot({path:SP+'/t/a_map.png'});
  await A.evaluate(()=>__onl.onlOpen(1));await sleep(600);await A.screenshot({path:SP+'/t/a_panel.png'});
  await clear(A);await clear(B);await A.evaluate(()=>{const k=[...__onl.ONL.peers.keys()][0];__onl.onlClose();__onl.onlChallenge(k);});
  console.log('dbg',await A.evaluate(()=>({d:__onl.ONL.duel,free:__onl.onlFree(),me:__onl.ONL.me,busy:__vps.busy,DLG:!!__vps.DLG,CH:!!__vps.CH,MENU:!!__vps.MENU})));await sleep(800);console.log('Bme',await B.evaluate(()=>__onl.ONL.me), await B.evaluate(()=>[...__onl.ONL.peers.values()].map(r=>r.peer)));await B.screenshot({path:SP+'/t/b_inv.png'});
  console.log('B inv',await B.evaluate(()=>__onl.ONL.inv&&__onl.ONL.inv.nm));
  await B.evaluate(()=>__onl.onlAccept());
  await sleep(1500);
  // A: chọn đội (3 đồng hành) ; B: 2 đồng hành, qua thoại
  for(let i=0;i<60;i++){const s=await A.evaluate(()=>{const v=__vps;if(v.DLG){v.press('a');return 'dlg'}if(v.scene==='arsel'){const S=__ar.ARS;if(S.sel.length<3){S.sel=S.C.slice(0,3);}v.press('right');v.press('a');return 'sel'}return v.scene});
    const t=await B.evaluate(()=>{const v=__vps;if(v.DLG){v.press('a');return 'dlg'}return v.scene});if(s==='arena'&&t==='arena')break;await sleep(150);}
  console.log('arena?',await A.evaluate(()=>__vps.scene),await B.evaluate(()=>__vps.scene));
  await sleep(2200);await A.screenshot({path:SP+'/t/a_arena.png'});await B.screenshot({path:SP+'/t/b_arena.png'});
  // A đánh: đặt võ sĩ A sát đối thủ rồi đánh liên tục
  for(let i=0;i<400;i++){const r=await A.evaluate(()=>{const A=__onl.AR;if(!A)return 'none';if(A.phase==='fight'&&A.a&&A.e){A.a.x=A.e.x-14;A.a.y=A.e.y;A.a.face=1;A.a.cd.a=0;__vps.press('a');}return A.phase+' a'+Math.round(A.a.hp)+' e'+Math.round(A.e.hp)+' ei'+A.ei;});
    if(i%40===0){console.log(i,r,'| B:',await B.evaluate(()=>{const A=__onl.AR;return A?A.phase+' a'+Math.round(A.a.hp)+'/'+A.a.mhp+' ai'+A.ai:'none'}));}
    if(r.startsWith('end'))break;await sleep(100);}
  await sleep(1500);await A.screenshot({path:SP+'/t/a_end.png'});await B.screenshot({path:SP+'/t/b_end.png'});
  for(let i=0;i<60;i++){for(const p of[A,B])await p.evaluate(()=>{const v=__vps;if(v.scene==='arena')v.press('a');else if(v.DLG)v.press('a');});await sleep(150);}
  console.log('pvp A',await A.evaluate(()=>__vps.G.pvp),'B',await B.evaluate(()=>__vps.G.pvp),await A.evaluate(()=>__vps.scene),await B.evaluate(()=>__vps.scene));
  await br.close();})();
