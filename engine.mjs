import {lootPool,lootRange} from './public/loot-catalog.js';
import {alarmChanceAtDepth} from './public/progression.js';

function randomInt(max){
  const limit=0x100000000-(0x100000000%max),value=new Uint32Array(1);
  do crypto.getRandomValues(value);while(value[0]>=limit);
  return value[0]%max;
}
const randomUUID=()=>crypto.randomUUID();

export function player(name, bot=false) {
  return { id:randomUUID(), token:randomUUID(), name:name.trim().slice(0,16)||'怪盗', bot, score:0, pot:0, lost:0, active:true, choice:null, gain:0, escapeLocked:false, escapeBonusBlocked:false, nextLootMultiplier:1, alarmCancel:0, alarmReroll:0, growthBonus:0, bustShield:0, protected:false };
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
  room.players.forEach(p=>{p.active=true;p.choice=null;p.gain=0;p.pot=0;p.lost=0;p.escapeLocked=false;p.escapeBonusBlocked=false;p.nextLootMultiplier=1;p.alarmCancel=0;p.alarmReroll=0;p.growthBonus=0;p.bustShield=0;p.protected=false;});
  draw(room,rng);
}
export function currentPlayer(room){return room.players[room.actorIndex]||null;}
function nextPlayerIndex(room){
  for(let offset=1;offset<=room.players.length;offset++){const index=(room.actorIndex+offset+room.players.length)%room.players.length;if(room.players[index].active)return index;}
  return -1;
}
export function draw(room, rng=randomInt) {
  room.actorIndex=nextPlayerIndex(room);const actor=currentPlayer(room);if(!actor){finishRound(room,'全員が脱出。お宝を確保した！');return;}
  room.turn++;let rolled=rollLoot(room.turn,rng),notes=[];
  if(rolled.type==='alarm'&&actor.alarmReroll>0){actor.alarmReroll--;rolled=rollLoot(room.turn,rng);notes.push('ボードゲームで警報を引き直した');}
  if(rolled.type==='alarm'&&actor.alarmCancel>0){actor.alarmCancel--;rolled={...rolled,count:0,name:'見破った警報センサー',cancelled:true};notes.push('ゴールデンメガネで警報を無効化');}
  const card={...rolled,ownerId:actor.id,ownerName:actor.name};
  if(card.type==='treasure'){
    if(card.effectKey==='double-or-zero'){card.baseValue=card.value;card.value=rng(2)===0?0:card.value*2;notes.push(card.value?`大当たり！ ${card.value} G`:'ハズレ。0 G');}
    if(actor.nextLootMultiplier<1){card.baseValue=card.baseValue??card.value;card.value=Math.floor(card.value*actor.nextLootMultiplier);actor.nextLootMultiplier=1;notes.push(`バーガー効果で半額の${card.value} G`);}
    actor.pot+=card.value;
    switch(card.effectKey){
      case 'forced-stay':actor.escapeLocked=true;notes.push('頭のネジが飛び、この手番は脱出不能');break;
      case 'pot-minus-50':{const loss=Math.min(50,actor.pot);actor.pot-=loss;card.effectLoss=loss;notes.push(`悪臭で未確保G −${loss}`);break;}
      case 'no-escape-bonus':actor.escapeBonusBlocked=true;notes.push('このラウンドの脱出ボーナスが0 G');break;
      case 'pot-minus-30pct':{const loss=Math.ceil(actor.pot*.3);actor.pot-=loss;card.effectLoss=loss;notes.push(`音声流出で未確保G −${loss}`);break;}
      case 'next-loot-half':actor.nextLootMultiplier=.5;notes.push('次に得るお宝が半額');break;
      case 'cancel-alarm':actor.alarmCancel++;notes.push('次の警報を一度だけ無効化');break;
      case 'reroll-alarm':actor.alarmReroll++;notes.push('次の警報を一度だけ引き直す');break;
      case 'stay-growth':actor.growthBonus+=20;notes.push(`探索続行ごとに +${actor.growthBonus} G`);break;
      case 'bust-shield':actor.bustShield++;notes.push('封鎖時に未確保Gを一度だけ保護');break;
    }
  }
  if(notes.length)card.effectText=notes.join(' / ');
  room.history.push(card);
  if(card.type==='alarm')room.alarm+=card.count;
  if(room.alarm>=3){const protectedNames=[];room.players.filter(p=>p.active).forEach(p=>{if(p.bustShield>0){p.bustShield--;p.protected=true;p.gain+=p.pot;p.score+=p.pot;p.pot=0;protectedNames.push(p.name);}else{p.lost=p.pot;p.pot=0;}p.active=false;p.choice=null;});finishRound(room,`警報 +${card.count}！ 共通警報が3個に達し、金庫を封鎖。${protectedNames.length?` ${protectedNames.join('、')}は結婚指輪で未確保Gを守った。`:''}`);return;}
  room.phase='choosing';room.deadline=Date.now()+20000;
  room.players.forEach(p=>p.choice=null);
  const effect=card.effectText?`《${card.effectText}》`:'';
  room.event=card.type==='alarm'?(card.cancelled?`${actor.name}が警報を無効化！ 共通警報 ${room.alarm}/3。${effect}`:`${actor.name}が警報 +${card.count}！ 共通警報 ${room.alarm}/3。${effect}`):`${actor.name}が${card.rarity==='dpr'?'DPR発見！ ':card.rarity==='kids-rare'?'Kids Rare発見！ ':card.rarity!=='common'?'レア発見！ ':''}${card.name} +${card.value} G ${effect}`;
}
export function finishRound(room,message) {
  room.phase=room.round>=5?'finished':'roundOver'; room.deadline=null; room.event=message;
}
export function resolve(room) {
  const actor=currentPlayer(room);
  if(room.phase!=='choosing'||!actor?.active||!actor.choice) return false;
  const forced=actor.escapeLocked&&actor.choice==='escape',escaping=actor.choice==='escape'&&!forced;
  actor.escapeLocked=false;
  let bonus=0,growth=0;
  if(escaping){bonus=actor.escapeBonusBlocked?0:50;const secured=actor.pot+bonus;actor.gain+=secured;actor.score+=secured;actor.pot=0;actor.active=false;}
  else if(actor.growthBonus){growth=actor.growthBonus;actor.pot+=growth;}
  room.phase='reveal';room.deadline=null;
  room.event=escaping?`${actor.name}が脱出！ 脱出ボーナス +${bonus} G`:forced?`${actor.name}は頭のネジが飛び、脱出できず探索続行。${growth?` 結晶 +${growth} G。`:''}`:`${actor.name}は探索を続行。${growth?` 結晶 +${growth} G。`:''} 次の人のターンへ…`;
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
