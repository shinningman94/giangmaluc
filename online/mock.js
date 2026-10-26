// giả lập window.claude.use('room'|'user') giữa các tab cùng origin bằng BroadcastChannel
(()=>{const bc=new BroadcastChannel('mockroom');const me='p'+Math.random().toString(36).slice(2,8);
function mkRoom(name){const R={name,pres:{},peers:new Map(),ls:[],cs:[],left:false};
  const snap=()=>{const arr=[{peer:me,by:null,isMe:true,sameTab:true,kind:'viewer',guest:false,presence:Object.freeze({...R.pres}),updatedAt:Date.now()}];
    for(const[k,v]of R.peers)arr.push({peer:k,by:null,isMe:false,sameTab:false,kind:'viewer',guest:false,presence:v.p,updatedAt:v.t});return Object.freeze(arr);};
  let cur=snap();const fire=()=>{cur=snap();for(const f of R.ls)f({peers:cur,joined:[],left:[],updated:[]});};
  const send=()=>{if(!R.left)bc.postMessage({t:'p',room:name,peer:me,p:R.pres});};
  R.api={name,presence(patch){for(const k in patch){if(patch[k]===null)delete R.pres[k];else R.pres[k]=patch[k];}if(JSON.stringify(R.pres).length>4096)return Promise.reject({code:'invalid_argument'});send();fire();return Promise.resolve();},
    peers(){return cur;},onPeers(f){R.ls.push(f);setTimeout(()=>f({peers:cur,joined:cur,left:[],updated:[]}),0);return()=>{};},
    connected(){return true},onConnection(f){setTimeout(()=>f(true),0);return()=>{}},emit(){return Promise.resolve()},on(){return()=>{}},
    leave(){R.left=true;bc.postMessage({t:'l',room:name,peer:me});rooms.delete(name);return Promise.resolve();},
    join(n){if(rooms.has(n))return Promise.resolve(rooms.get(n).api);const r=mkRoom(n);rooms.set(n,r);r.api.presence({});bc.postMessage({t:'hello',room:n,peer:me});return Promise.resolve(r.api);}};
  R.on=m=>{if(m.t==='p'){R.peers.set(m.peer,{p:Object.freeze(m.p),t:Date.now()});fire();}else if(m.t==='l'){R.peers.delete(m.peer);fire();}else if(m.t==='hello')send();};
  setInterval(()=>{send();let ch=0;for(const[k,v]of R.peers)if(Date.now()-v.t>3500){R.peers.delete(k);ch=1;}if(ch)fire();},1000);
  return R;}
const rooms=new Map();const lobby=mkRoom('');rooms.set('',lobby);
bc.onmessage=e=>{const m=e.data;const r=rooms.get(m.room);if(r&&!r.left)r.on(m);};
bc.postMessage({t:'hello',room:'',peer:me});
window.claude={use(n){if(n==='room')return Promise.resolve(lobby.api);if(n==='user')return Promise.resolve({me:async()=>({name:window.__mockName||'Tester',id:me}),id:async()=>me});return Promise.resolve(null);}};
})();
