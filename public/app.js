import { artFor } from './loot-art.js';
import { vaultStage,VAULT_STAGES } from './progression.js';
import {LOOT_CATALOG} from './loot-catalog.js';
import {catalogSections,rankPlayers,outsideBounds} from './view-model.js';
import {rareEffectPlan,createRareEffect} from './rare-effect.js';
const $=id=>document.getElementById(id);
// Reserve the dock's real height, including wrapped text and device safe areas.
new ResizeObserver(entries=>{document.body.style.setProperty('--decision-space',`${Math.ceil(entries[0].target.getBoundingClientRect().height)+16}px`);}).observe($('decision-dock'));
let state=null,session=null,events=null,reconnectTimer=null,busy=false,lastCard='',sound=true,audio=null,fx=null,toastTimer,opening=false,openingTimer,rareHighlightTimer;
let shownResultKey='';
let previewing=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rareFX=createRareEffect({root:$('rare-effect'),playSound:playRareSound,onReveal:()=>fx?.burst(false,true)});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
async function api(path,data,auth=false){const response=await fetch(path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${session.token}`}:{})},...(data?{body:JSON.stringify(data)}:{})});let payload;try{payload=await response.json();}catch{throw new Error('サーバーに接続できません。');}if(!response.ok)throw new Error(payload.error);return payload;}
async function perform(fn){if(busy)return;busy=true;document.querySelectorAll('#home button').forEach(b=>b.disabled=true);try{await fn();}catch(e){toast(e.message||'接続を確認してください。');}finally{busy=false;document.querySelectorAll('#home button').forEach(b=>b.disabled=false);}}
function beep(danger=false){if(!sound)return;try{audio||=new AudioContext();audio.resume();const t=audio.currentTime;for(let i=0;i<(danger?2:3);i++){const o=audio.createOscillator(),g=audio.createGain();o.type=danger?'triangle':'sine';o.frequency.value=danger?170-i*40:[523,659,784][i];g.gain.setValueAtTime(0,t+i*.07);g.gain.linearRampToValueAtTime(.05,t+i*.07+.01);g.gain.exponentialRampToValueAtTime(.001,t+i*.07+.18);o.connect(g);g.connect(audio.destination);o.start(t+i*.07);o.stop(t+i*.07+.2);}}catch{}}
function ratchet(duration=1600){if(!sound)return;try{audio||=new AudioContext();audio.resume();const t=audio.currentTime;for(let i=0;i<16;i++){const o=audio.createOscillator(),g=audio.createGain(),at=t+i*.06*duration/1600;o.type='triangle';o.frequency.value=700+(i%3)*170;g.gain.setValueAtTime(.027,at);g.gain.exponentialRampToValueAtTime(.001,at+.025);o.connect(g);g.connect(audio.destination);o.start(at);o.stop(at+.03);}}catch{}}
function playRareSound(){const clip=$('rare-sfx');if(!sound)return()=>{};clip.pause();clip.currentTime=0;clip.volume=.4;clip.play().catch(()=>{});return()=>{clip.pause();clip.currentTime=0;};}
function cancelOpening(){clearTimeout(openingTimer);clearTimeout(rareHighlightTimer);rareFX.cancel();previewing=false;opening=false;document.querySelector('.playfield').classList.remove('opening','rare-arrival','legendary-arrival');$('game').classList.remove('is-opening');}
function openVault(card,key,rare){
  cancelOpening();const field=document.querySelector('.playfield');$('card').classList.remove('flip');
  const spectating=!state.players.find(p=>p.id===state.you)?.active;
  const remaining=state.deadline?Math.max(0,state.deadline-Date.now()):Infinity;
  const duration=reduced?0:spectating?(rare?200:650):Math.min(1600,Math.max(0,remaining-4000));
  const finish=()=>{
    if(!state||lastCard!==key)return;opening=false;field.classList.remove('opening');$('game').classList.remove('is-opening');$('card').classList.add('flip');
    if(rare){field.classList.add('rare-arrival');rareHighlightTimer=setTimeout(()=>field.classList.remove('rare-arrival','legendary-arrival'),2200);}else{beep(card.type==='alarm');fx?.burst(card.type==='alarm',false);}
    queueMicrotask(()=>{if(state&&lastCard===key)render();});
  };
  const reveal=()=>{
    if(!state||lastCard!==key)return;field.classList.remove('opening');
    const plan=rareEffectPlan(card,{spectating,reducedMotion:reduced,obscured:!!document.querySelector('dialog[open]'),remainingMs:state.deadline?Math.max(0,state.deadline-Date.now()):Infinity});
    if(plan)rareFX.play(card,plan,finish);else finish();
  };
  opening=true;$('game').classList.add('is-opening');
  if(!duration){reveal();return;}
  field.style.setProperty('--unlock-duration',`${duration}ms`);field.style.setProperty('--dial-duration',`${Math.round(duration*.69)}ms`);
  void field.offsetWidth;field.classList.add('opening');ratchet(duration);
  openingTimer=setTimeout(reveal,duration);
}
function syncSoundUI(){$('sound').textContent=sound?'音 ON':'音 OFF';$('sound').setAttribute('aria-label',sound?'効果音をオフにする':'効果音をオンにする');$('effects-sound').textContent=sound?'効果音 ON':'効果音 OFF';$('effects-sound').setAttribute('aria-pressed',String(sound));}
syncSoundUI();
$('sound').onclick=()=>{sound=!sound;syncSoundUI();if(sound)beep();else $('rare-sfx').pause();};
$('help').onclick=()=>$('rules').showModal();$('close-help').onclick=()=>$('rules').close();
function renderCatalog(){const sections=catalogSections(LOOT_CATALOG,$('catalog-filter').value);$('catalog-grid').innerHTML=sections.map(section=>`<h3 class="catalog-section-heading">${section.label}<span>${section.items.length}種類</span></h3>${section.items.map(p=>`<article class="catalog-card ${p.rarity}"><div class="catalog-art" aria-hidden="true">${artFor(p)}</div><small>${p.rarity==='common'?'TREASURE':p.rarity==='legendary'?'LEGENDARY':'RARE'}</small><h3>${esc(p.name)}</h3><strong>${p.value}<span> G</span></strong><p>${p.vaults.map(key=>VAULT_STAGES.find(s=>s.key===key).label).join(' / ')}</p></article>`).join('')}`).join('');}
$('catalog-open').onclick=()=>{renderCatalog();$('catalog').showModal();};$('close-catalog').onclick=()=>$('catalog').close();$('catalog-filter').onchange=renderCatalog;
$('home-catalog').onclick=()=>$('catalog-open').click();$('home-help').onclick=()=>$('help').click();
$('home-effects').onclick=()=>$('effects').showModal();$('close-effects').onclick=()=>$('effects').close();$('effects-sound').onclick=()=>$('sound').click();
const effectCard=LOOT_CATALOG.find(p=>p.id==='mona-lisa');
$('effects').querySelector(':scope>p').textContent='ゲーム中に発生する特殊演出を紹介します。';
$('effects').querySelector('.effects-toolbar>span').textContent='「プチュン」音声付きで試せます';
$('effects').querySelector('.effect-previews').innerHTML=`<article class="effect-preview effect-intro"><div class="effect-symbol power-cut-symbol" aria-hidden="true"><i></i></div><span>SPECIAL EFFECT 01</span><h3>ぷちゅん暗転</h3><p>レアなお宝を引くと画面が一瞬消え、暗転のあとに金色の光と一緒にお宝が現れます。</p><button id="preview-puchun" class="primary">演出を試す →</button></article>`;
$('preview-puchun').onclick=()=>{const card={type:'treasure',...effectCard};previewing=true;$('effects').close();rareFX.play(card,rareEffectPlan(card,{reducedMotion:reduced}),finishPreview);};
function finishPreview(){previewing=false;if(document.body.dataset.screen==='home'&&!document.querySelector('dialog[open]'))$('effects').showModal();}
document.addEventListener('keydown',e=>{if(previewing&&e.key==='Escape'){e.preventDefault();rareFX.cancel();finishPreview();}});
$('close-results').onclick=()=>$('results').close();$('results-back').onclick=()=>$('results').close();
for(const dialog of document.querySelectorAll('dialog')){
 let startedOutside=false;
 dialog.addEventListener('pointerdown',e=>{startedOutside=e.target===dialog&&outsideBounds(dialog.getBoundingClientRect(),e.clientX,e.clientY);});
 dialog.addEventListener('click',e=>{if(startedOutside&&e.target===dialog&&outsideBounds(dialog.getBoundingClientRect(),e.clientX,e.clientY))dialog.close();startedOutside=false;});
 dialog.addEventListener('close',()=>{if(!previewing&&state&&['roundOver','finished'].includes(state.phase)&&!document.querySelector('dialog[open]'))render();});
}
function renderResults(){
 const s=state,done=s.phase==='finished',rows=rankPlayers(s.players),mine=rows.find(p=>p.id===s.you),leaders=rows.filter(p=>p.rank===1);
 $('results-title').textContent=done?'最終リザルト':`ラウンド ${s.round}/5 リザルト`;
 $('results-caption').textContent=done?'5ラウンドの合計Gで決定。':'現在の合計Gによる順位。';
 $('results-winner').innerHTML=`<span>${leaders.length>1?'同率1位':'1位'}</span><strong>${leaders.map(p=>esc(p.name)).join('・')}</strong><b>${rows[0].score}<small> G</small></b>`;
 $('results-personal').innerHTML=`<div><span>あなたの順位</span><strong>${mine.rank}<small>位</small></strong></div><div><span>合計獲得G</span><strong>${mine.score}<small>G</small></strong></div><div><span>今回獲得G</span><strong>+${mine.gain}<small>G</small></strong></div>`;
 $('results-rows').innerHTML=rows.map(p=>`<tr class="${p.id===s.you?'my-result':''}"><td><span class="rank-number rank-${p.rank}">${p.rank}</span><small>位</small></td><th scope="row">${esc(p.name)}${p.id===s.you?'<span class="you">自分</span>':p.bot?'<span class="you bot-tag">CPU</span>':''}</th><td>+${p.gain}<small> G</small></td><td><strong>${p.score}</strong><small> G</small></td></tr>`).join('');
 const next=$('results-next');next.hidden=s.host!==s.you;next.textContent=done?'もう一度プレイ →':'次のラウンドへ →';next.disabled=opening;
 next.onclick=()=>perform(async()=>{next.disabled=true;try{await action('start');$('results').close();}catch(e){next.disabled=false;throw e;}});
 $('results-host-note').hidden=s.host===s.you;
}
function showResults(){if(!state||!['roundOver','finished'].includes(state.phase))return;renderResults();if(!$('results').open)$('results').showModal();shownResultKey=`${state.code}:${state.round}:${state.phase}`;}
document.querySelector('.brand').onclick=e=>{e.preventDefault();cancelOpening();clearTimeout(reconnectTimer);events?.close();events=null;state=null;session=null;sessionStorage.removeItem('vault-session');history.replaceState(null,'','/');$('home').hidden=false;$('game').hidden=true;document.body.dataset.screen='home';$('connection').textContent='2–8 PLAYERS';};
const invited=new URL(location.href).searchParams.get('room');if(/^\d{4}$/.test(invited||''))$('code').value=invited;$('code').oninput=()=>{$('code').value=$('code').value.replace(/\D/g,'').slice(0,4);};$('name').value=localStorage.getItem('vault-name')||'';
async function enter(mode){const name=$('name').value.trim();if(!name){$('name').focus();throw new Error('名前を入力してください。');}localStorage.setItem('vault-name',name);
  if(mode==='join'){const code=$('code').value.trim();if(!/^\d{4}$/.test(code))throw new Error('数字4桁の部屋コードを入力してください。');session=await api(`/api/rooms/${code}/join`,{name});}
  else session=await api('/api/rooms',{name,bots:mode==='practice'?Number($('bots').value):0});
  sessionStorage.setItem('vault-session',JSON.stringify(session));connect();
}
$('create').onclick=()=>perform(()=>enter('create'));$('join').onclick=()=>perform(()=>enter('join'));$('practice').onclick=()=>perform(async()=>{await enter('practice');await action('start');});
$('code').addEventListener('input',()=>$('code').value=$('code').value.toUpperCase());
function connect(){
 clearTimeout(reconnectTimer);events?.close();$('home').hidden=true;$('game').hidden=false;document.body.dataset.screen='game';history.replaceState(null,'',`?room=${session.code}`);$('connection').textContent='接続中';
 const protocol=location.protocol==='https:'?'wss:':'ws:';events=new WebSocket(`${protocol}//${location.host}/api/rooms/${session.code}/socket?token=${encodeURIComponent(session.token)}`);
 events.onmessage=e=>{state=JSON.parse(e.data);$('connection').textContent='LIVE';render();};
 events.onclose=()=>{if(!session)return;$('connection').textContent='再接続中';reconnectTimer=setTimeout(connect,1500);};
 events.onerror=()=>events?.close();initCanvas();
}
async function action(type,choice){return api(`/api/rooms/${session.code}/action`,{type,choice,turn:state?.turn,round:state?.round},true);}
const copyInvite=async()=>{const url=`${location.origin}/?room=${session.code}`;try{await navigator.clipboard.writeText(url);toast(`部屋コード ${session.code} の招待リンクをコピーしました。`);}catch{prompt(`部屋コード ${session.code}：このリンクを仲間に送ってください。`,url);}};
$('invite').onclick=()=>perform(copyInvite);$('room-code').onclick=()=>perform(copyInvite);
function render(){
  if(!state)return;
  const s=state,me=s.players.find(p=>p.id===s.you),lobby=s.phase==='lobby',ended=['roundOver','finished'].includes(s.phase),done=s.phase==='finished';
  $('game-heading').textContent=lobby?'待機室':ended?'強盗結果':'強盗進行中';
  const stage=vaultStage(s.turn||1),field=document.querySelector('.playfield');
  field.dataset.vault=stage.key;
  field.dataset.idle=String(lobby);
  $('vault-route').innerHTML=VAULT_STAGES.map((v,i)=>`<div class="route-step ${i===stage.index?'current':i<stage.index?'cleared':'locked'}" ${i===stage.index?'aria-current="step"':''}><span>${i<stage.index?'✓':`0${i+1}`}</span><strong>${v.label}</strong><small>${i===stage.index?(v.total?`${stage.step} / ${v.total}`:`${stage.step}回目 / ∞`):(i<stage.index?'突破':`${v.start}回目〜`)}</small></div>`).join('');
  $('vault-zone').textContent=stage.zone;document.querySelector('.vault-stencil b').textContent=stage.label;
  $('room-label').textContent=`部屋 ${s.code}`;$('room-code').querySelector('strong').textContent=s.code;$('room-code').setAttribute('aria-label',`部屋コード ${s.code}。押すと招待リンクをコピー`);$('round').innerHTML=lobby?'<span class="round-label">開始待ち</span>':`<span class="round-label">ラウンド</span><strong>${s.round}</strong><small>/5</small>`;
  $('banked-gold').textContent=me.score;
  $('hud-name').textContent=me.name;
  $('depth').textContent=lobby?'小型金庫から探索開始':`${stage.label} / 探索 ${String(s.turn).padStart(2,'0')} 回目`;
  const lost=ended&&s.alarm>=3&&!me.gain;
  $('pot').textContent=lobby?0:me.active?s.pot:me.gain;$('pot-label').textContent=lobby?'お宝':lost?'失ったお宝':me.active?'未確保':'利確済み';
  if(lost)$('pot').textContent=s.pot;
  document.querySelector('.haul-panel').classList.toggle('lost',lost);document.querySelector('.playfield').classList.toggle('busted',s.alarm>=3);
  document.querySelector('.haul-panel').classList.toggle('secured',!me.active&&!lobby);
  $('event').textContent=s.event.replaceAll(' pt',' G');$('player-count').textContent=`${s.players.length}人 / 8人`;
  document.querySelector('.crew-panel').classList.toggle('crowded',s.players.length>4);
  const card=s.history.at(-1),key=`${s.code}:${s.round}:${s.history.length}:${s.phase==='lobby'}`;
  const rare=card?.type==='treasure'&&card.rarity!=='common';
  $('card-caption').textContent=lobby?'金庫は、まだ開いていない。':s.alarm>=3?'侵入を検知。金庫を封鎖。':rare?'厳重保管エリアで、レアなお宝を発見！':card?.type==='alarm'?'センサーに見つかった！':'金庫の奥から、お宝を発見。';
  $('card-value').textContent=card?`+${card.type==='alarm'?card.count:card.value}`:'?';$('card-kind').textContent=card?.type==='alarm'?'警報が増えた':card?'GOLD':'何が眠っている？';
  $('loot-name').textContent=card?.name||'未開封の金庫';$('loot-art').innerHTML=artFor(card);
  $('rarity').textContent=card?.type==='alarm'?'SECURITY ALERT':card?.rarity==='legendary'?'LEGENDARY LOOT':rare?'RARE TREASURE':card?'TREASURE FOUND':'SEALED';
  $('card').classList.toggle('alarm-card',card?.type==='alarm');
  $('card').classList.toggle('rare-card',rare&&card.rarity!=='legendary');$('card').classList.toggle('legendary-card',card?.rarity==='legendary');
  if(key!==lastCard){lastCard=key;if(card)openVault(card,key,rare);else cancelOpening();}
  $('lock-status').textContent=opening?'じりじり… ダイヤルを合わせている':lobby?'ダイヤルロック / 待機中':'カチッ。金庫を開けた。';
  const shownAlarm=opening&&card?.type==='alarm'?Math.max(0,s.alarm-card.count):s.alarm;
  $('alarm').innerHTML=[0,1,2].map(i=>`<div class="alarm-cell ${i<shownAlarm?'on':''}"><div class="alarm-lamp"></div><span>${i+1}</span></div>`).join('');
  $('alarm').setAttribute('aria-label',`警報${Math.min(3,shownAlarm)}個、3個でアウト`);$('alarm-count').textContent=Math.min(3,shownAlarm);
  $('security').classList.toggle('critical',shownAlarm>=2);$('security').classList.toggle('lockdown',shownAlarm>=3);
  $('security-note').textContent=shownAlarm>=3?'ロックダウン！ 未確保のお宝を失った':shownAlarm===2?'あと1個で封鎖。逃げるなら今。':'一度に1〜2個発生。合計3個で封鎖。';
  if(opening){$('event').textContent='ダイヤルを合わせている…';$('card-caption').textContent='じりじり… ダイヤルを回して解錠中';}
  $('loot-count').textContent=`${s.history.filter(c=>c.type==='treasure').length} ITEMS`;
  $('history').innerHTML=s.history.length?[...s.history].reverse().map(c=>`<div class="loot-row ${c.type==='alarm'?'danger':c.rarity!=='common'?'rare':''}"><div class="loot-thumb" aria-hidden="true">${artFor(c)}</div><div><strong>${esc(c.name)}</strong><small>探索 ${String(c.depth).padStart(2,'0')} ${c.rarity==='rare'?' / RARE':c.rarity==='legendary'?' / LEGENDARY':''}</small></div><b>+${c.type==='alarm'?c.count:c.value}${c.type==='alarm'?' 個':' G'}</b></div>`).join(''):'<p class="empty-loot">金庫を漁って、<br>最初のお宝を見つけよう。</p>';
  $('bonus-note').textContent=lost?'このラウンドは0 G。確保済みの合計点はそのまま。':me.active?'単独脱出なら、さらに +50 G':'このお宝はもう失わない。';
  const next=s.next;
  $('risk-alarm').innerHTML=!lobby&&!ended?`${next.alarmChance}<small>%</small>`:'—';
  $('risk-bust').innerHTML=!lobby&&!ended?`${Number(next.bustChance.toFixed(1))}<small>%</small>`:'—';
  const rareMin=next?.rareMinReward??65,rareMax=next?.rareMaxReward??70;
  $('risk-reward').innerHTML=!lobby&&!ended?`${next.minReward}–${next.maxReward}<small>G</small><span class="rare-hint">レア ${rareMin}〜${rareMax} G / お宝時 ${next.rareChance}%</span>`:'<small>探索で上昇</small>';
  const symbols=['♠','♣','♦','♥','✦','☾','✧','♢'];
  $('players').innerHTML=s.players.map((p,i)=>{let status=p.bot?'CPU / 待機中':'参加済み',kind='';if(!lobby){if(!p.active){status=p.gain?`脱出 +${p.gain} G`:'捕まった / 今回0 G';kind=p.gain?'safe':'failed';}else if(s.phase==='reveal'){status='探索を続行';kind='thinking';}else{status=p.ready?'選択済み ✓':'探索中';kind=p.ready?'ready':'thinking';}}return `<div class="crew-player ${p.id===s.you?'self':''}"><div class="avatar">${symbols[i]}</div><div class="player-detail"><div class="player-name">${esc(p.name)}${p.id===s.you?'<span class="you">自分</span>':''}${p.bot?'<span class="you bot-tag">CPU</span>':''}</div><div class="player-status ${kind}">${status}</div></div><div class="player-score"><strong>${p.score}</strong><small>G</small></div></div>`;}).join('');
  let actions='';
  if(lobby)actions=s.host===s.you?`<button class="primary" id="start" ${s.players.length<2?'disabled':''}>${s.players.length<2?'仲間の参加を待っています':'金庫を開ける →'}</button>`:'<div class="waiting">ホストの開始を待っています。</div>';
  else if(ended)actions=s.host===s.you?`<button class="primary" id="start">${done?'もう一度、盗みに行く ↗':'次の金庫へ →'}</button>`:'<div class="waiting">ホストが次のゲームを開始します。</div>';
  else if(s.phase==='reveal')actions='<div class="waiting">選択を公開。次のカードへ…</div>';
  else if(!me.active)actions='<div class="waiting">脱出成功。仲間の運命を見届けよう。</div>';
  else if(me.choice)actions=`<div class="waiting">${me.choice==='stay'?'続行':'脱出'}を選択済み。仲間の選択を待っています…</div>`;
  else actions=`<button class="primary stay" id="stay">さらに漁る ↗<small>もっと奥のお宝を狙う</small></button><button class="primary escape" id="escape">お宝を持って脱出 →<small>${s.pot} Gを確保 / 単独なら +50</small></button>`;
  $('actions').innerHTML=actions;
  if(opening)document.querySelectorAll('#actions button').forEach(b=>b.disabled=true);
  $('start')?.addEventListener('click',()=>perform(()=>action('start')));
  for(const choice of ['stay','escape'])$(choice)?.addEventListener('click',()=>perform(async()=>{document.querySelectorAll('#actions button').forEach(b=>b.disabled=true);try{await action('choice',choice);}catch(e){render();throw e;}}));
  if(ended){const ranked=rankPlayers(s.players),mine=ranked.find(p=>p.id===s.you);$('result').innerHTML=`<div class="result-box"><div class="result-inline-heading">${done?'最終結果':'ラウンド結果'}</div><p>あなたは <strong>${mine.rank}位</strong> / ${ranked.length}人</p><p>合計 <strong>${mine.score} G</strong> ・ 今回 +${mine.gain} G</p><button id="view-results" class="secondary">全員のリザルトを見る →</button></div>`;$('view-results').onclick=showResults;const key=`${s.code}:${s.round}:${s.phase}`;if(!opening&&shownResultKey!==key&&!document.querySelector('dialog[open]'))showResults();}else{$('result').innerHTML='';if($('results').open)$('results').close();}
  tick();
}
function tick(){if(!state)return;const seconds=Math.max(0,Math.ceil((state.deadline-Date.now())/1000));$('timer').textContent=state.phase==='choosing'?`${seconds}s`:'';}
setInterval(tick,250);
function initCanvas(){if(fx||!window.Phaser)return;const parent=$('canvas');
  class VaultScene extends Phaser.Scene{create(){fx=this;this.art=this.add.graphics();this.drawTable();this.scale.on('resize',()=>this.drawTable());}drawTable(){this.art.clear();}burst(danger,rare=false){if(reduced)return;for(let i=0;i<(rare?36:18);i++){const p=this.add.rectangle(this.scale.width/2,this.scale.height/2-10,danger?3:5,7,danger?0xee7468:0xe7c477);this.tweens.add({targets:p,x:p.x+Phaser.Math.Between(-170,170),y:p.y+Phaser.Math.Between(-130,120),angle:Phaser.Math.Between(-180,180),alpha:0,duration:850,onComplete:()=>p.destroy()});}}}
  new Phaser.Game({type:Phaser.CANVAS,parent:'canvas',transparent:true,scale:{mode:Phaser.Scale.RESIZE,width:parent.clientWidth,height:parent.clientHeight},scene:VaultScene,audio:{noAudio:true},banner:false});
}
try{const saved=JSON.parse(sessionStorage.getItem('vault-session'));if(saved&&(!invited||saved.code===invited)){session=saved;await api(`/api/rooms/${session.code}`,null,true);connect();}}catch{sessionStorage.removeItem('vault-session');}
