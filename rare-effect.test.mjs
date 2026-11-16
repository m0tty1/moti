import test from 'node:test';
import assert from 'node:assert/strict';
import {rareEffectPlan,createRareEffect} from './public/rare-effect.js';
const rare={type:'treasure',id:'mona-lisa',item:'painting',rarity:'rare',name:'モナ・リザ',value:80};
const legendary={type:'treasure',id:'blue-diamond',item:'diamond',rarity:'legendary',name:'ブルーダイヤ',value:200};
function fixture(){
 const nodes=new Map(),root={hidden:true,dataset:{},style:{setProperty(){}},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);}};
 let now=0,next=0;const jobs=new Map(),all=[];
 const setTimer=(fn,delay)=>{const id=++next,job={id,fn,at:now+delay};jobs.set(id,job);all.push(job);return id;};
 const clearTimer=id=>jobs.delete(id);
 const advance=ms=>{const until=now+ms;while(true){const due=[...jobs.values()].filter(j=>j.at<=until).sort((a,b)=>a.at-b.at)[0];if(!due)break;now=due.at;jobs.delete(due.id);due.fn();}now=until;};
 return {root,nodes,setTimer,clearTimer,advance,all};
}
test('通常品と警報では暗転せず、レアと最高レアは同じ長さ',()=>{
 assert.equal(rareEffectPlan({...rare,rarity:'common'}),null);assert.equal(rareEffectPlan({type:'alarm',rarity:'rare'}),null);
 assert.equal(rareEffectPlan(rare).mode,'fullscreen');assert.equal(rareEffectPlan(legendary).totalMs,rareEffectPlan(rare).totalMs);
});
test('動きを減らす設定・他の画面・残り時間不足なら操作を妨げる暗転を省略',()=>{
 for(const options of [{reducedMotion:true},{obscured:true},{remainingMs:1000}])assert.equal(rareEffectPlan(rare,options).mode,'inline');
 for(const item of [rare,legendary])assert.ok(rareEffectPlan(item,{spectating:true}).totalMs+200<1700);
});
test('ぷちゅん→黒画面→お宝→復帰の順で進み、最後に一度だけ操作を返す',()=>{
 const f=fixture();let sound=0,stopped=0,revealed=0,done=0;const effect=createRareEffect({...f,playSound:()=>{sound++;return()=>stopped++;},onReveal:()=>revealed++});const plan=rareEffectPlan(rare);
 effect.play(rare,plan,()=>done++);assert.equal(f.root.hidden,false);assert.equal(f.root.dataset.phase,'cut');assert.equal(sound,1);
 f.advance(plan.cutMs);assert.equal(f.root.dataset.phase,'black');assert.equal(revealed,0);
 f.advance(plan.blackMs);assert.equal(f.root.dataset.phase,'reveal');assert.equal(revealed,1);assert.equal(done,0);assert.equal(f.nodes.get('.rare-effect-name').textContent,'モナ・リザ');
 f.advance(plan.revealMs);assert.equal(f.root.dataset.phase,'fade');f.advance(plan.fadeMs);assert.equal(f.root.hidden,true);assert.equal(done,1);assert.equal(stopped,1);f.advance(10000);assert.equal(done,1);
});
test('次のお宝やホーム復帰で取り消すと、古い演出が再表示・操作解除しない',()=>{
 const f=fixture();let oldDone=0,newDone=0,stopped=0;const effect=createRareEffect({...f,playSound:()=>()=>stopped++});
 effect.play(rare,rareEffectPlan(rare),()=>oldDone++);const stale=f.all.map(j=>j.fn);effect.cancel();assert.equal(f.root.hidden,true);assert.equal(stopped,1);
 effect.play(legendary,rareEffectPlan(legendary),()=>newDone++);stale.forEach(fn=>fn());assert.equal(f.root.dataset.phase,'cut');assert.equal(oldDone,0);assert.equal(newDone,0);f.advance(10000);assert.equal(newDone,1);assert.equal(oldDone,0);
});
test('短い強調表示でも指定音を使い、画面を黒くせず即座に操作を返す',()=>{
 const f=fixture();let sound=0,done=0;const effect=createRareEffect({...f,playSound:()=>{sound++;return()=>{};}});
 effect.play(rare,rareEffectPlan(rare,{reducedMotion:true}),()=>done++);assert.equal(sound,1);assert.equal(done,1);assert.equal(f.root.hidden,true);
});
