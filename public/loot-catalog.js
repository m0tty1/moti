// Values belong to each item. Depth changes the eligible pool, never its price.
import {vaultStage,VAULT_STAGES} from './progression.js';
const common=[
 ['loose-coins','小銭の山','coin',3,'#e4b76c'],
 ['old-coins','古い硬貨','coin',5,'#c4a286'],
 ['banknotes','紙幣','cash',5,'#a6c3a5'],
 ['coin-rolls','棒金','coin',6,'#d4d8df'],
 ['cash-bundle','札束','cash',10,'#a5c7a6'],
 ['cash-case','売上金の封筒','cash',15,'#d6c39b'],
 ['silver-ring','銀の指輪','ring',8,'#c7d5e4'],
 ['gold-ring','金の指輪','ring',12,'#f2ce76'],
 ['signet-ring','印台リング','ring',15,'#d3b488'],
 ['diamond-ring','ダイヤの指輪','ring',18,'#a2e7e7'],
 ['pearl-ring','真珠の指輪','ring',22,'#f4e7e1'],
 ['ruby-ring','ルビーの指輪','ring',28,'#ee6e84'],
 ['sapphire-ring','サファイアの指輪','ring',35,'#739ee9'],
 ['emerald-ring','エメラルドの指輪','ring',40,'#67d4ab'],
 ['silver-necklace','銀のネックレス','necklace',10,'#d6e3f0'],
 ['gold-necklace','黄金のネックレス','necklace',20,'#e8c775'],
 ['pearl-necklace','真珠のネックレス','necklace',26,'#f4e5df'],
 ['ruby-necklace','ルビーのネックレス','necklace',38,'#ef7293'],
 ['sapphire-necklace','青宝石のネックレス','necklace',45,'#719eef'],
 ['emerald-necklace','翠玉のネックレス','necklace',55,'#58d0a1'],
 ['silver-bar','銀の延べ棒','gold',8,'#c9d7e4'],
 ['gold-bar','金塊','gold',15,'#f4ce71'],
 ['gold-stack','積まれた金塊','gold',40,'#f4b84c'],
 ['platinum-bar','プラチナの延べ棒','gold',60,'#bcdfeb'],
 ['pocket-watch','懐中時計','watch',18,'#d5b67b'],
 ['luxury-watch','高級腕時計','watch',45,'#b7d0df'],
 ['silver-medal','銀のメダル','medal',12,'#c9d5e0'],
 ['gold-medal','金のメダル','medal',30,'#f1c773'],
 ['pearl-brooch','真珠のブローチ','brooch',24,'#efdfd0'],
 ['ruby-brooch','ルビーのブローチ','brooch',36,'#ef6e83'],
 ['gold-bracelet','金のブレスレット','bracelet',28,'#eec36e'],
 ['emerald-bracelet','翠玉のブレスレット','bracelet',42,'#62d1aa'],
 ['silver-pen','銀の万年筆','pen',14,'#c7d8e4'],
 ['gold-pen','金の万年筆','pen',34,'#efc66a'],
 ['silver-cup','銀の杯','goblet',16,'#c8d6df'],
 ['gold-chalice','黄金の聖杯','goblet',50,'#edc45f']
];
const rare=[
 ['mona-lisa','モナ・リザ','painting',80,'#dcc38a',1],
 ['rare-stamp','幻の切手','stamp',65,'#d9a2b1',1],
 ['commemorative-coin','記念金貨','coin',70,'#f6d589',1],
 ['antique-vase','古代の壺','vase',75,'#7bc7cf',2],
 ['pearl-tiara','真珠のティアラ','crown',85,'#f2e9e0',2],
 ['gold-mask','黄金の仮面','mask',90,'#f3cc70',3],
 ['royal-ring','王家の紋章リング','ring',95,'#bca4f0',3],
 ['starry-night','星月夜','painting',100,'#729cd2',3],
 ['jade-cabbage','翡翠の白菜','jade',110,'#8ed8a3',4],
 ['royal-crown','王家の冠','crown',120,'#f1cd71',3],
 ['antique-watch','王侯の懐中時計','watch',125,'#e5c597',4],
 ['ancient-scroll','古代の巻物','scroll',130,'#dac099',4],
 ['pearl-earring','真珠の耳飾りの少女','painting',140,'#8daed1',5],
 ['ruby-crown','紅玉の王冠','crown',150,'#ee7482',5],
 ['sapphire-scepter','青宝石の王笏','scepter',160,'#7eb2ec',6],
 ['star-ruby','スタールビー','gem',170,'#ed728e',6],
 ['treasure-chest','海賊の宝箱','chest',180,'#e7b969',7],
 ['imperial-crown','皇帝の宝冠','crown',190,'#c5a4ef',7],
 ['blue-diamond','ブルーダイヤ','diamond',200,'#81dcf0',5],
 ['fossil-amber','太古の琥珀','gem',90,'#efa74d',3],
 ['music-box','宮廷のオルゴール','musicbox',105,'#a4c4dd',4],
 ['rare-violin','名匠のバイオリン','violin',115,'#d9a16f',4],
 ['ancient-key','古王国の黄金鍵','key',135,'#f1c86c',5],
 ['imperial-egg','皇帝の宝飾卵','egg',155,'#a4c6ec',6]
];
const smallCommon=new Set(['loose-coins','old-coins','banknotes','coin-rolls','cash-bundle','cash-case','silver-ring','gold-ring','signet-ring','silver-necklace','silver-bar','gold-bar','silver-pen']);
const sharedWithMedium=new Set(['cash-case','gold-bar']);
const smallRare=new Set(['rare-stamp','commemorative-coin']);
const mediumRare=new Set(['antique-vase','pearl-tiara','royal-ring','royal-crown','antique-watch','fossil-amber','music-box']);
function assignVaults(entry){
 const vaults=entry.rarity==='common'
  ?[...(smallCommon.has(entry.id)?['small']:[]),...(!smallCommon.has(entry.id)||sharedWithMedium.has(entry.id)?['medium']:[]),...(entry.value>=34?['large']:[])]
  :smallRare.has(entry.id)?['small']:mediumRare.has(entry.id)?['medium']:['large'];
 const firstStart=Math.min(...vaults.map(key=>VAULT_STAGES.find(s=>s.key===key).start));
 return Object.freeze({...entry,vaults:Object.freeze(vaults),minDepth:Math.max(entry.minDepth,firstStart)});
}
export const LOOT_CATALOG=Object.freeze([
 ...common.map(([id,name,item,value,tint])=>assignVaults({id,name,item,value,tint,rarity:'common',minDepth:value<=15?1:value<=30?3:value<=45?6:9})),
 ...rare.map(([id,name,item,value,tint,minDepth])=>assignVaults({id,name,item,value,tint,minDepth,rarity:value>=160?'legendary':'rare'}))
]);
export function lootPool(depth,rare=false){
 const stage=vaultStage(depth);
 return LOOT_CATALOG.filter(p=>p.minDepth<=depth&&p.vaults.includes(stage.key)&&(rare?p.rarity!=='common':p.rarity==='common'));
}
export function lootRange(depth){
 const common=lootPool(depth),rare=lootPool(depth,true);
 return {minReward:Math.min(...common.map(p=>p.value)),maxReward:Math.max(...common.map(p=>p.value)),rareMinReward:Math.min(...rare.map(p=>p.value)),rareMaxReward:Math.max(...rare.map(p=>p.value))};
}
