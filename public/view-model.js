import {VAULT_STAGES} from './progression.js';

// Shared items appear once, under the first vault in which they can be found.
export function catalogSections(items,filter='all'){
 const selected=items.filter(p=>filter==='all'||(filter==='common'?p.rarity==='common':filter==='rare'?p.rarity!=='common':p.rarity===filter));
 return VAULT_STAGES.map(stage=>({key:stage.key,label:stage.label,items:selected.filter(p=>p.vaults[0]===stage.key).sort((a,b)=>a.value-b.value||a.name.localeCompare(b.name,'ja'))})).filter(section=>section.items.length);
}
export function rankPlayers(players){
 const sorted=players.map((p,index)=>({id:p.id,name:p.name,bot:p.bot,score:p.score,gain:p.gain,index})).sort((a,b)=>b.score-a.score||a.index-b.index);
 let previousScore,previousRank=0;
 return sorted.map((p,index)=>{const rank=index>0&&p.score===previousScore?previousRank:index+1;previousScore=p.score;previousRank=rank;const {index:originalIndex,...entry}=p;return {...entry,rank};});
}
export function outsideBounds(rect,x,y){return x<rect.left||x>rect.right||y<rect.top||y>rect.bottom;}
