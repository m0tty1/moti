import {artFor} from './loot-art.js';

export function rareEffectPlan(card,{spectating=false,reducedMotion=false,obscured=false,remainingMs=Infinity}={}){
 if(card?.type!=='treasure'||card.rarity!=='dpr')return null;
 const timing=spectating
  ?{cutMs:80,blackMs:500,revealMs:600,fadeMs:120}
  :{cutMs:140,blackMs:1060,revealMs:1250,fadeMs:220};
 const totalMs=Object.values(timing).reduce((a,b)=>a+b,0);
 return {...timing,totalMs,legendary:false,mode:reducedMotion||obscured||(!spectating&&remainingMs<totalMs+3000)?'inline':'fullscreen'};
}

export function createRareEffect({root,playSound=()=>{},onReveal=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
 let timers=[],generation=0,stopSound=null;
 const cancel=()=>{generation++;timers.forEach(clearTimer);timers=[];stopSound?.();stopSound=null;root.hidden=true;root.dataset.phase='idle';};
 const play=(card,plan,onDone)=>{
  cancel();if(!plan){onDone();return;}if(plan.mode!=='fullscreen'){stopSound=playSound();onReveal(card);onDone();return;}
  const current=generation;
  root.dataset.tier='rare';root.dataset.phase='cut';
  root.style.setProperty('--rare-cut',`${plan.cutMs}ms`);root.style.setProperty('--rare-fade',`${plan.fadeMs}ms`);
  root.querySelector('.rare-effect-art').innerHTML=artFor(card);root.querySelector('.rare-effect-name').textContent=card.name;
  root.querySelector('.rare-effect-value').textContent=`+${card.value} G`;
  root.querySelector('.rare-effect-tier').textContent='DPR DROP';
  root.querySelector('.rare-effect-caption').textContent='超低確率のDPRお宝を発見';
  root.hidden=false;stopSound=playSound();
  const later=(ms,fn)=>timers.push(setTimer(()=>{if(generation===current)fn();},ms));
  later(plan.cutMs,()=>{root.dataset.phase='black';});
  later(plan.cutMs+plan.blackMs,()=>{root.dataset.phase='reveal';onReveal(card);});
  later(plan.cutMs+plan.blackMs+plan.revealMs,()=>{root.dataset.phase='fade';});
  later(plan.totalMs,()=>{root.hidden=true;root.dataset.phase='idle';timers=[];stopSound?.();stopSound=null;onDone();});
 };
 return {play,cancel};
}
