import {lootPool,lootRange} from './public/loot-catalog.js';
import {alarmChanceAtDepth} from './public/progression.js';

function randomInt(max){
  const limit=0x100000000-(0x100000000%max),value=new Uint32Array(1);
  do crypto.getRandomValues(value);while(value[0]>=limit);
  return value[0]%max;
}
const randomUUID=()=>crypto.randomUUID();

export function player(name, bot=false) {
  return { id:randomUUID(), token:randomUUID(), name:name.trim().slice(0,16)||'怪盗', bot, score:0, active:true, choice:null, gain:0 };
}
export function newRoom(code, name, bots=0) {
  const host=player(name);
  return { code, host:host.id, players:[host,...Array.from({length:bots},(_,i)=>player(['キツネ','クロウ','ミント','ルビー','ノヴァ','ジャック','モカ'][i],true))], phase:'lobby', round:0, turn:0, alarm:0, pot:0, history:[], event:'仲間がそろったら、金庫を開けよう。', deadline:null, revision:0 };
}
export function riskProfile(depth, alarm=0) {
  const alarmChance=alarmChanceAtDepth(depth);
  const rareChance=Math.min(30,2+(depth-1)*3);
  const fatalWeight=alarm>=2?100:alarm===1?35:0;
  return {depth,alarmChance,rareChance,...lootRange(depth),bustChance:Math.round(alarmChance*fatalWeight)/100};
}
export function rollLoot(depth, rng=randomInt) {
  const risk=riskProfile(depth);
  if(rng(10000)<risk.alarmChance*100){
    const count=rng(100)<65?1:2;
    return {type:'alarm',count,value:0,name:count===2?'二重センサー':'警報センサー',depth};
  }
  const rare=rng(10000)<risk.rareChance*100;
  const pool=lootPool(depth,rare);
  return {type:'treasure',...pool[rng(pool.length)],depth};
}
export function startRound(room, rng=randomInt) {
  room.round++; room.turn=0; room.alarm=0; room.pot=0; room.history=[];
  room.players.forEach(p=>{p.active=true;p.choice=null;p.gain=0;});
  draw(room,rng);
}
export function draw(room, rng=randomInt) {
  room.turn++; const card=rollLoot(room.turn,rng);
  room.history.push(card);
  if(card.type==='alarm') room.alarm+=card.count; else room.pot+=card.value;
  if(room.alarm>=3){room.players.forEach(p=>{p.active=false;p.choice=null;});finishRound(room,`警報 +${card.count}！ 合計3個以上で金庫が封鎖された。未確保のお宝を失った。`);return;}
  room.phase='choosing';room.deadline=Date.now()+20000;
  room.players.forEach(p=>p.choice=null);
  room.event=card.type==='alarm'?`警報 +${card.count}！ 合計 ${room.alarm}/3。まだ漁る？`:`${card.rarity!=='common'?'レア発見！ ':''}${card.name} +${card.value} G`;
}
export function finishRound(room,message) {
  room.phase=room.round>=5?'finished':'roundOver'; room.deadline=null; room.event=message;
}
export function resolve(room) {
  const active=room.players.filter(p=>p.active);
  if(room.phase!=='choosing'||active.some(p=>!p.choice)) return false;
  const escaping=active.filter(p=>p.choice==='escape');
  const bonus=escaping.length===1?50:0;
  escaping.forEach(p=>{p.gain=room.pot+bonus;p.score+=p.gain;p.active=false;});
  room.phase='reveal';room.deadline=null;
  room.event=escaping.length?`${escaping.map(p=>p.name).join('・')}が脱出！${bonus?' 単独ボーナス +50！':''}`:'全員が続行。次のカードを開ける…';
  return true;
}
export function advance(room, rng=randomInt) {
  if(room.phase!=='reveal')return;
  if(room.players.every(p=>!p.active))finishRound(room,'全員が脱出。お宝を確保した！');else draw(room,rng);
}
export function view(room,id) {
  return {code:room.code,host:room.host,phase:room.phase,round:room.round,turn:room.turn,alarm:room.alarm,pot:room.pot,history:room.history,event:room.event,deadline:room.deadline,revision:room.revision,you:id,next:riskProfile(room.turn+1,room.alarm),
    players:room.players.map(({token,choice,...p})=>({...p,ready:!!choice,choice:room.phase==='reveal'||p.id===id?choice:null}))};
}
