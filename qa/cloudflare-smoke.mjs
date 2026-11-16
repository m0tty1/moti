import assert from 'node:assert/strict';
import WebSocket from 'ws';

const base=process.argv[2]||'http://127.0.0.1:8787';
const request=async(path,data,token)=>{
 const response=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const payload=await response.json();if(!response.ok)throw new Error(`${response.status}: ${payload.error}`);return payload;
};
const connect=session=>{
 const url=new URL(base);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=`/api/rooms/${session.code}/socket`;url.searchParams.set('token',session.token);
 const socket=new WebSocket(url),queue=[],waiters=[];
 socket.on('message',data=>{const state=JSON.parse(data);if(waiters.length)waiters.shift()(state);else queue.push(state);});
 const next=()=>queue.length?Promise.resolve(queue.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('WebSocket timeout')),5000);waiters.push(state=>{clearTimeout(timer);resolve(state);});});
 return {socket,next};
};

const health=await request('/healthz');assert.equal(health.ok,true);
assert.equal((await fetch(base+'/')).status,200);
const host=await request('/api/rooms',{name:'ホスト',bots:0});
const guest=await request(`/api/rooms/${host.code}/join`,{name:'ゲスト'});
const hostClient=connect(host),guestClient=connect(guest),hostSocket=hostClient.socket,guestSocket=guestClient.socket;
await Promise.all([new Promise(r=>hostSocket.once('open',r)),new Promise(r=>guestSocket.once('open',r))]);
const initial=await hostClient.next();assert.equal(initial.players.length,2);assert.equal(initial.phase,'lobby');
await request(`/api/rooms/${host.code}/action`,{type:'start'},host.token);
let state=await hostClient.next();while(state.phase!=='choosing')state=await hostClient.next();
assert.equal(state.round,1);assert.equal(state.turn,1);
await Promise.all([
 request(`/api/rooms/${host.code}/action`,{type:'choice',choice:'escape',turn:state.turn,round:state.round},host.token),
 request(`/api/rooms/${host.code}/action`,{type:'choice',choice:'escape',turn:state.turn,round:state.round},guest.token)
]);
for(let i=0;i<6;i++){state=await hostClient.next();if(state.phase==='roundOver')break;}
assert.equal(state.phase,'roundOver');assert.ok(state.players.every(person=>person.score>0));
hostSocket.close();guestSocket.close();
console.log(`Cloudflare smoke OK: ${host.code}, 2 players, WebSocket sync, round complete`);
