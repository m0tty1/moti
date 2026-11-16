import test from 'node:test';
import assert from 'node:assert/strict';
import {newRoom,startRound,draw,resolve,advance,view,riskProfile,rollLoot} from './engine.mjs';
import {vaultStage} from './public/progression.js';
import {LOOT_CATALOG,lootPool} from './public/loot-catalog.js';
import {artFor} from './public/loot-art.js';
const safe=limit=>limit===10000?9999:0;
const sequence=values=>()=>values.shift();

test('単独脱出に50G、二重警報で封鎖されても確保済みの点は残る',()=>{
 const r=newRoom('1234','A',1);startRound(r,safe);r.players[0].pot=100;r.players[0].choice='escape';
 assert.ok(resolve(r));assert.equal(r.players[0].score,150);
 r.players[1].pot=90;r.alarm=1;advance(r,sequence([0,65]));assert.equal(r.alarm,3);assert.equal(r.phase,'roundOver');assert.equal(r.players[0].score,150);assert.equal(r.players[1].score,0);assert.equal(r.players[1].lost,90);
});
test('A→Bの順に手番が進み、お宝は手番の人だけに入る',()=>{const r=newRoom('1234','A',1);startRound(r,safe);assert.equal(r.players[r.actorIndex].name,'A');assert.ok(r.players[0].pot>0);assert.equal(r.players[1].pot,0);r.players[0].choice='stay';assert.ok(resolve(r));advance(r,safe);assert.equal(r.players[r.actorIndex].name,'キツネ');assert.ok(r.players[1].pot>0);});
test('手番中は現在プレイヤーと未確保Gを公開し、認証情報は公開しない',()=>{const r=newRoom('1234','A',1);startRound(r,safe);const v=view(r,r.players[1].id);assert.equal(v.currentPlayerId,r.players[0].id);assert.equal(v.players[0].pot,r.players[0].pot);assert.equal(v.pot,0);assert.ok(!JSON.stringify(v).includes(r.players[1].token));assert.deepEqual(v.next,riskProfile(2,0));});
test('2人と8人で5ラウンド完走、開始時に探索と警報をリセット',()=>{for(const bots of [1,7]){const r=newRoom('1234','A',bots);for(let round=1;round<=5;round++){startRound(r,safe);assert.equal(r.round,round);assert.equal(r.turn,1);assert.equal(r.alarm,0);while(r.phase==='choosing'){const actor=r.players[r.actorIndex];actor.choice='escape';assert.ok(resolve(r));advance(r,safe);}assert.equal(r.phase,round===5?'finished':'roundOver');assert.ok(r.players.every(p=>p.score>0&&!p.active));}}});
test('手番以外の選択では解決せず、二重解決しない',()=>{const r=newRoom('1234','A',1);startRound(r,safe);r.players[1].choice='escape';assert.equal(resolve(r),false);r.players[0].choice='escape';assert.equal(resolve(r),true);const score=r.players[0].score;assert.equal(resolve(r),false);assert.equal(r.players[0].score,score);});
test('警報は1個か2個のみ、初回に一発封鎖は発生しない',()=>{
 for(let roll=0;roll<100;roll++)assert.equal(rollLoot(1,sequence([0,roll])).count,roll<65?1:2);
 const r=newRoom('ABCDE','A',1);startRound(r,sequence([0,99]));assert.equal(r.phase,'choosing');assert.equal(r.alarm,2);assert.ok(r.players.every(p=>p.active&&p.score===0));
});
test('探索で警報率・通常報酬・レア率が増加し、上限を超えない',()=>{
 for(let d=1;d<=100;d++){const p=riskProfile(d),n=riskProfile(d+1);assert.ok(n.alarmChance>=p.alarmChance&&n.alarmChance<=70);assert.ok(n.minReward>=p.minReward&&n.maxReward<=70);assert.ok(n.rareChance>=p.rareChance&&n.rareChance<=30);}
 for(const [depth,chance]of [[1,1],[2,3],[10,19],[11,22],[15,34],[16,35],[17,36],[50,69],[51,70],[100,70]])assert.equal(riskProfile(depth).alarmChance,chance);
 for(let depth=2;depth<=50;depth++)assert.equal(riskProfile(depth).alarmChance-riskProfile(depth-1).alarmChance,vaultStage(depth).increase);
 const average=depth=>lootPool(depth).reduce((sum,item)=>sum+item.value,0)/lootPool(depth).length;
 assert.ok(average(11)>average(1));assert.ok(average(16)>average(11));
});
test('モナ・リザ80G、王家の冠120G、DPRのダイヤ200Gを固定金額で抽選',()=>{
 for(const [id,depth,value]of [['mona-lisa',16,80],['royal-crown',11,120]]){const pool=lootPool(depth,'rare'),index=pool.findIndex(p=>p.id===id);assert.ok(index>=0);const card=rollLoot(depth,sequence([9999,9999,0,index]));assert.equal(card.id,id);assert.equal(card.value,value);}
 const dpr=rollLoot(16,sequence([9999,0,0]));assert.equal(dpr.id,'blue-diamond');assert.equal(dpr.value,200);assert.equal(dpr.rarity,'dpr');
 let hits=0;for(let roll=0;roll<10000;roll++)if(rollLoot(16,sequence(roll<10?[9999,roll,0]:[9999,roll,9999,0])).rarity==='dpr')hits++;assert.equal(hits,10);
});
test('表示する警報率が抽選しきい値と一致し、即アウト率は警報数を反映',()=>{
 for(const depth of [1,6,12,25]){let alarms=0;for(let roll=0;roll<10000;roll++){let first=true;const c=rollLoot(depth,limit=>{if(first){first=false;return roll;}return limit===10000?9999:0;});if(c.type==='alarm')alarms++;}assert.equal(alarms/100,riskProfile(depth).alarmChance);}
 assert.equal(riskProfile(1,0).bustChance,0);assert.equal(riskProfile(1,1).bustChance,.35);assert.equal(riskProfile(1,2).bustChance,1);
 assert.equal(riskProfile(15).dprChance,0);assert.equal(riskProfile(16).dprChance,.1);
});
test('警報カードでも探索回数が進み、小型の通報率は2ポイントずつ上がる',()=>{const r=newRoom('ABCDE','A',1);startRound(r,safe);draw(r,sequence([0,0]));assert.equal(r.turn,2);assert.equal(r.alarm,1);assert.equal(view(r,r.host).next.alarmChance,5);});
test('小型10回、中型5回、16回目から大型を上限なく継続',()=>{
 for(const [d,key,step,total]of [[1,'small',1,10],[10,'small',10,10],[11,'medium',1,5],[15,'medium',5,5],[16,'large',1,null],[30,'large',15,null],[100,'large',85,null]]){const s=vaultStage(d);assert.equal(s.key,key);assert.equal(s.step,step);assert.equal(s.total,total);}
 const r=newRoom('ABCDE','A',1);startRound(r,safe);for(let d=2;d<=30;d++)draw(r,safe);assert.equal(vaultStage(r.turn).key,'large');startRound(r,safe);assert.equal(vaultStage(r.turn).key,'small');
});
test('金庫ごとの出現品を固定し、小型や中型から大型限定品を出さない',()=>{
 const small=new Set([...lootPool(1),...lootPool(1,'rare'),...lootPool(1,'dpr')].map(p=>p.id));assert.ok(small.has('banknotes')&&small.has('gold-bar'));assert.ok(!small.has('mona-lisa')&&!small.has('blue-diamond')&&!small.has('royal-crown'));
 const medium=new Set([...lootPool(11),...lootPool(11,'rare'),...lootPool(11,'dpr')].map(p=>p.id));assert.ok(medium.has('diamond-ring')&&medium.has('royal-crown'));assert.ok(!medium.has('mona-lisa')&&!medium.has('blue-diamond'));
 const large=new Set([...lootPool(16),...lootPool(16,'rare'),...lootPool(16,'dpr')].map(p=>p.id));assert.ok(large.has('mona-lisa')&&large.has('blue-diamond'));assert.ok(!large.has('loose-coins'));
 const all=new Set([...small,...medium,...large]);assert.equal(all.size,60);
 for(let depth=1;depth<=100;depth++)for(const tier of ['common','rare']){const pool=lootPool(depth,tier);assert.ok(pool.length>0);assert.ok(pool.every(p=>p.vaults.includes(vaultStage(depth).key)));}
});
test('60種類すべてが抽選可能で、個別のGが固定されている',()=>{
 assert.equal(LOOT_CATALOG.length,60);assert.equal(new Set(LOOT_CATALOG.map(p=>p.id)).size,60);assert.equal(new Set(LOOT_CATALOG.map(p=>p.name)).size,60);
 assert.equal(LOOT_CATALOG.filter(p=>p.rarity==='common').length,36);
 for(const item of LOOT_CATALOG){assert.ok(Number.isInteger(item.value)&&item.value>0);const tier=item.rarity==='common'?'common':item.rarity==='dpr'?'dpr':'rare';let checked=0;for(const depth of [item.minDepth,item.minDepth+1,item.minDepth+2]){const pool=lootPool(depth,tier),index=pool.findIndex(p=>p.id===item.id);if(index<0)continue;const rolls=tier==='dpr'?[9999,0,index]:tier==='rare'?[9999,9999,0,index]:[9999,9999,9999,index];const card=rollLoot(depth,sequence(rolls));assert.equal(card.id,item.id);assert.equal(card.value,item.value);checked++;}assert.ok(checked>0);}
});
test('60種類のお宝に別々のSVG絵があり、どの探索回でも金額範囲に収まる',()=>{
 assert.equal(new Set(LOOT_CATALOG.map(artFor)).size,60);
 for(let depth=1;depth<=100;depth++){const profile=riskProfile(depth);for(const item of lootPool(depth)){assert.ok(item.value>=profile.minReward&&item.value<=profile.maxReward);}for(const item of lootPool(depth,'rare')){assert.ok(item.value>=profile.rareMinReward&&item.value<=profile.rareMaxReward);}}
});
