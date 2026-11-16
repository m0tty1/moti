import test from 'node:test';
import assert from 'node:assert/strict';
import {LOOT_CATALOG} from './public/loot-catalog.js';
import {catalogSections,rankPlayers,outsideBounds,resultRevealDelay} from './public/view-model.js';

test('お宝は小型→中型→大型に並び、共有品を重複させず全70種類を掲載',()=>{
 const sections=catalogSections(LOOT_CATALOG);assert.deepEqual(sections.map(s=>s.key),['small','medium','large']);
 const all=sections.flatMap(s=>s.items);assert.equal(all.length,70);assert.equal(new Set(all.map(p=>p.id)).size,70);
 for(const section of sections){assert.ok(section.items.every(p=>p.vaults[0]===section.key));for(let i=1;i<section.items.length;i++)assert.ok(section.items[i].value>=section.items[i-1].value);}
 assert.equal(catalogSections(LOOT_CATALOG,'common').flatMap(s=>s.items).length,36);assert.equal(catalogSections(LOOT_CATALOG,'rare').flatMap(s=>s.items).length,23);assert.equal(catalogSections(LOOT_CATALOG,'kids-rare').flatMap(s=>s.items).length,10);
});
test('DPRフィルターは超低確率の対象だけを表示',()=>{const sections=catalogSections(LOOT_CATALOG,'dpr');assert.equal(sections.flatMap(section=>section.items).length,1);assert.equal(sections[0].items[0].id,'blue-diamond');});
test('合計Gで順位を付け、同点は同順位、元の参加者配列は変更しない',()=>{
 const players=[{id:'a',name:'A',score:20,gain:0},{id:'b',name:'B',score:100,gain:30},{id:'c',name:'C',score:100,gain:10},{id:'d',name:'D',score:0,gain:0}];
 const ranked=rankPlayers(players);assert.deepEqual(ranked.map(p=>p.id),['b','c','a','d']);assert.deepEqual(ranked.map(p=>p.rank),[1,1,3,4]);assert.deepEqual(players.map(p=>p.id),['a','b','c','d']);assert.equal(ranked[0].gain,30);
 assert.deepEqual(rankPlayers(players.map(p=>({...p,score:0}))).map(p=>p.rank),[1,1,1,1]);assert.deepEqual(rankPlayers([]),[]);
});
test('ダイアログの内側や境界では閉じず、外側だけを判定',()=>{
 const rect={left:100,right:400,top:100,bottom:600};for(const [x,y]of [[100,100],[400,600],[250,300]])assert.equal(outsideBounds(rect,x,y),false);
 for(const [x,y]of [[99,300],[401,300],[250,99],[250,601]])assert.equal(outsideBounds(rect,x,y),true);
});
test('3個目の警報で封鎖された時だけリザルトを2秒遅らせる',()=>{
 assert.equal(resultRevealDelay({phase:'roundOver',alarm:3}),2000);assert.equal(resultRevealDelay({phase:'finished',alarm:4}),2000);
 assert.equal(resultRevealDelay({phase:'roundOver',alarm:2}),0);assert.equal(resultRevealDelay({phase:'choosing',alarm:3}),0);
});
