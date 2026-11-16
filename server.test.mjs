import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('HTTP実対戦：2人・8人の順番制で5ラウンド完走、上限・認証・再戦', {timeout:45000},async()=>{
 const proc=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:'4184',VAULT_REVEAL_MS:'5'},stdio:['ignore','pipe','pipe']});
 try{
  await once(proc.stdout,'data');
  const request=async(path,data,token)=>{const res=await fetch(`http://localhost:4184${path}`,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json()};};
  for(const count of [2,8]){
   const created=await request('/api/rooms',{name:'host <script>'});assert.equal(created.status,201);assert.match(created.data.code,/^\d{4}$/);const host=created.data,players=[host],base=`/api/rooms/${host.code}`;
   for(let i=1;i<count;i++)players.push((await request(`${base}/join`,{name:`player${i}`})).data);
   if(count===8)assert.equal((await request(`${base}/join`,{name:'overflow'})).status,400);
   assert.equal((await request(base)).status,401);
   assert.equal((await request(`${base}/action`,{type:'start'},players[1].token)).status,403);
   for(let round=1;round<=5;round++){
    assert.equal((await request(`${base}/action`,{type:'start'},host.token)).status,200);
    const before=(await request(base,null,host.token)).data;assert.equal(before.round,round);
    let after=before,checkedWrongTurn=false;
    while(!['roundOver','finished'].includes(after.phase)){
     if(after.phase==='reveal'){await new Promise(r=>setTimeout(r,10));after=(await request(base,null,host.token)).data;continue;}
     const actor=players.find(candidate=>candidate.id===after.currentPlayerId);assert.ok(actor);
     if(!checkedWrongTurn){const wrong=players.find(candidate=>candidate.id!==after.currentPlayerId);assert.equal((await request(`${base}/action`,{type:'choice',choice:'escape',turn:after.turn,round},wrong.token)).status,400);checkedWrongTurn=true;}
     assert.equal((await request(`${base}/action`,{type:'choice',choice:'escape',turn:after.turn,round},actor.token)).status,200);
     after=(await request(base,null,host.token)).data;
    }
    assert.equal(after.phase,round===5?'finished':'roundOver');assert.ok(after.players.every(p=>p.score>0));assert.ok(after.players.every(p=>!('token'in p)));
   }
   assert.equal((await request(`${base}/action`,{type:'start'},host.token)).status,200);const again=(await request(base,null,host.token)).data;assert.equal(again.round,1);assert.ok(again.players.every(p=>p.score===0));
  }
  const page=await fetch('http://localhost:4184/');assert.equal(page.status,200);assert.match(await page.text(),/金庫ブレイク/);
  for(const path of ['/app.js','/style.css','/vault-scene.css','/launcher.css','/loot-catalog.js','/rare-effect.js','/rare-effect.css','/vendor/phaser.min.js','/assets/store.png','/assets/bank.png','/assets/grand-bank.png'])assert.equal((await fetch(`http://localhost:4184${path}`)).status,200);
  const sound=await fetch('http://localhost:4184/assets/puchun.mp3');assert.equal(sound.status,200);assert.equal(sound.headers.get('content-type'),'audio/mpeg');assert.ok((await sound.arrayBuffer()).byteLength>0);
 }finally{proc.kill();}
});
