import {lootPool,lootRange} from './public/loot-catalog.js';
import {alarmChanceAtDepth} from './public/progression.js';

function randomInt(max){
  const limit=0x100000000-(0x100000000%max),value=new Uint32Array(1);
  do crypto.getRandomValues(value);while(value[0]>=limit);
  return value[0]%max;
}
const randomUUID=()=>crypto.randomUUID();

export function player(name, bot=false) {
  return { id:randomUUID(), token:randomUUID(), name:name.trim().slice(0,16)||'怪盗', bot, score:0, pot:0, lost:0, active:true, choice:null, gain:0 };
}
export function newRoom(code, name, bots=0) {
  const host=player(name);
  return { code, host:host.id, players:[host,...Array.from({length:bots},(_,i)=>player(['キツネ','クロウ','ミント','ルビー','ノヴァ','ジャック','モカ'][i],true))], phase:'lobby', round:0, turn:0, actorIndex:-1, alarm:0, history:[], event:'仲間がそろったら、金庫を開けよう。', deadline:null, revision:0 };
}
export function riskProfile(depth, alarm=0) {
  const alarmChance=alarmChanceAtDepth(depth);
  const rareChance=Math.min(30,2+(depth-1)*3);
  const kidsRareChance=.5;
  const dprChance=depth>=16 ? .1 : 0;
  const fatalWeight=alarm>=2?100:alarm===1?35:0;
  return {depth,alarmChance,rareChance,kidsRareChance,dprChance,...lootRange(depth),bustChance:Math.round(alarmChance*fatalWeight)/100};
}
export function rollLoot(depth, rng=randomInt) {
  const risk=riskProfile(depth);
  if(rng(10000)<risk.alarmChance*100){
    const count=rng(100)<65?1:2;
    return {type:'alarm',count,value:0,name:count===2?'二重センサー':'警報センサー',depth};
  }
  const dpr=rng(10000)<risk.dprChance*100;
  if(dpr){const pool=lootPool(depth,'dpr');return {type:'treasure',...pool[rng(pool.length)],depth};}
  const kidsRare=rng(10000)<risk.kidsRareChance*100;
  if(kidsRare){const pool=lootPool(depth,'kids-rare');return {type:'treasure',...pool[rng(pool.length)],depth};}
  const rare=rng(10000)<risk.rareChance*100;
  const pool=lootPool(depth,rare?'rare':'common');
  return {type:'treasure',...pool[rng(pool.length)],depth};
}
export function startRound(room, rng=randomInt) {
  room.round++; room.turn=0; room.actorIndex=-1; room.alarm=0; room.history=[];
  room.players.forEach(p=>{p.active=true;p.choice=null;p.gain=0;p.pot=0;p.lost=0;});
  draw(room,rng);
}
export function currentPlayer(room){return room.players[room.actorIndex]||null;}
function nextPlayerIndex(room){
  for(let offset=1;offset<=room.players.length;offset++){const index=(room.actorIndex+offset+room.players.length)%room.players.length;if(room.players[index].active)return index;}
  return -1;
}
export function draw(room, rng=randomInt) {
  room.actorIndex=nextPlayerIndex(room);const actor=currentPlayer(room);if(!actor){finishRound(room,'全員が脱出。お宝を確保した！');return;}
  room.turn++; const card={...rollLoot(room.turn,rng),ownerId:actor.id,ownerName:actor.name};
  room.history.push(card);
  if(card.type==='alarm') room.alarm+=card.count; else actor.pot+=card.value;
  if(room.alarm>=3){room.players.filter(p=>p.active).forEach(p=>{p.lost=p.pot;p.pot=0;p.active=false;p.choice=null;});finishRound(room,`警報 +${card.count}！ 共通警報が3個に達し、残った全員の未確保お宝を失った。`);return;}
  room.phase='choosing';room.deadline=Date.now()+20000;
  room.players.forEach(p=>p.choice=null);
  room.event=card.type==='alarm'?`${actor.name}が警報 +${card.count}！ 共通警報 ${room.alarm}/3。`:`${actor.name}が${card.rarity==='dpr'?'DPR発見！ ':card.rarity==='kids-rare'?'Kids Rare発見！ ':card.rarity!=='common'?'レア発見！ ':''}${card.name} +${card.value} G`;
}
export function finishRound(room,message) {
  room.phase=room.round>=5?'finished':'roundOver'; room.deadline=null; room.event=message;
}
export function resolve(room) {
  const actor=currentPlayer(room);
  if(room.phase!=='choosing'||!actor?.active||!actor.choice) return false;
  const escaping=actor.choice==='escape';
  if(escaping){const secured=actor.pot+50;actor.gain+=secured;actor.score+=secured;actor.pot=0;actor.active=false;}
  room.phase='reveal';room.deadline=null;
  room.event=escaping?`${actor.name}が脱出！ 脱出ボーナス +50 G`:`${actor.name}は探索を続行。次の人のターンへ…`;
  return true;
}
export function advance(room, rng=randomInt) {
  if(room.phase!=='reveal')return;
  if(room.players.every(p=>!p.active))finishRound(room,'全員が脱出。お宝を確保した！');else draw(room,rng);
}
export function view(room,id) {
  const me=room.players.find(p=>p.id===id),actor=currentPlayer(room);
  return {code:room.code,host:room.host,phase:room.phase,round:room.round,turn:room.turn,alarm:room.alarm,pot:me?.pot||0,currentPot:actor?.pot||0,currentPlayerId:actor?.id||null,currentPlayerName:actor?.name||null,history:room.history,event:room.event,deadline:room.deadline,revision:room.revision,you:id,next:riskProfile(room.turn+1,room.alarm),
    players:room.players.map(({token,choice,...p})=>({...p,ready:!!choice,choice:room.phase==='reveal'||p.id===id?choice:null}))};
}
