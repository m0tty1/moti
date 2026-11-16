import {newRoom,player,startRound,resolve,advance,view,riskProfile} from '../engine.mjs';

const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const error=(message,status=400)=>json({error:message},status);
async function readBody(request){
 const text=await request.text();if(text.length>4096)throw Object.assign(new Error('入力が長すぎます。'),{status:413});
 try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('入力形式を確認してください。'),{status:400});}
}
function roomCode(){const bytes=new Uint8Array(5);crypto.getRandomValues(bytes);return [...bytes].map(n=>CODE_CHARS[n%CODE_CHARS.length]).join('');}

export default {
 async fetch(request,env){
  try{
   const url=new URL(request.url);
   if(request.method==='GET'&&url.pathname==='/healthz')return json({ok:true,runtime:'cloudflare-workers'});
   if(request.method==='POST'&&url.pathname==='/api/rooms'){
    const body=await readBody(request);if(typeof body.name!=='string'||!body.name.trim())return error('名前を入力してください。');
    const bots=Number(body.bots||0);if(!Number.isInteger(bots)||bots<0||bots>7)return error('CPU人数を確認してください。');
    for(let attempt=0;attempt<8;attempt++){
     const code=roomCode(),stub=env.ROOMS.get(env.ROOMS.idFromName(code));
     const response=await stub.fetch(new Request(`https://room.internal/create`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,name:body.name,bots})}));
     if(response.status!==409)return response;
    }
    return error('部屋を作成できません。もう一度お試しください。',503);
   }
   const match=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{5})(?:\/(join|socket|action))?$/);
   if(match){const stub=env.ROOMS.get(env.ROOMS.idFromName(match[1]));return stub.fetch(request);}
   if(url.pathname.startsWith('/api/'))return error('操作が見つかりません。',404);
   return env.ASSETS.fetch(request);
  }catch(cause){return error(cause.status?cause.message:'接続エラー。もう一度お試しください。',cause.status||500);}
 }
};

export class VaultRoom {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room')||null;});}
 authenticate(request,url){
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||url.searchParams.get('token');
  const person=this.room?.players.find(p=>p.token===token);if(!person)throw Object.assign(new Error('入室し直してください。'),{status:401});return person;
 }
 async save(){if(this.room)await this.ctx.storage.put('room',this.room);}
 async emit(){
  this.room.revision++;await this.save();
  for(const socket of this.ctx.getWebSockets()){
   try{const attachment=socket.deserializeAttachment();socket.send(JSON.stringify(view(this.room,attachment.id)));}catch{}
  }
 }
 async schedule(){
  if(this.room.phase!=='choosing')return;
  const next=riskProfile(this.room.turn+1,this.room.alarm),escapeChance=Math.min(.9,.025+next.bustChance*.015+Math.min(.24,this.room.pot/1800));
  for(const p of this.room.players.filter(p=>p.bot&&p.active&&!p.choice))p.choice=Math.random()<escapeChance?'escape':'stay';
  if(resolve(this.room)){await this.emit();await this.ctx.storage.setAlarm(Date.now()+1700);return;}
  await this.save();await this.ctx.storage.setAlarm(this.room.deadline);
 }
 async alarm(){
  if(!this.room)return;
  if(this.room.phase==='reveal'){advance(this.room);await this.emit();await this.schedule();return;}
  if(this.room.phase==='choosing'){
   if(Date.now()+50<this.room.deadline){await this.ctx.storage.setAlarm(this.room.deadline);return;}
   for(const p of this.room.players.filter(p=>p.active&&!p.choice))p.choice='escape';await this.schedule();
  }
 }
 async fetch(request){
  try{
   const url=new URL(request.url);
   if(url.pathname==='/create'&&request.method==='POST'){
    if(this.room)return error('部屋コードが重複しました。',409);
    const body=await readBody(request);this.room=newRoom(body.code,body.name,body.bots);this.room.touched=Date.now();await this.save();
    return json({code:this.room.code,token:this.room.players[0].token,id:this.room.host},201);
   }
   if(!this.room)return error('部屋が見つかりません。コードを確認してください。',404);
   this.room.touched=Date.now();
   if(url.pathname.endsWith('/join')&&request.method==='POST'){
    const body=await readBody(request);if(this.room.phase!=='lobby')return error('この部屋は対戦中です。');if(this.room.players.length>=8)return error('満員です。');if(typeof body.name!=='string'||!body.name.trim())return error('名前を入力してください。');
    const person=player(body.name);this.room.players.push(person);await this.emit();return json({code:this.room.code,token:person.token,id:person.id});
   }
   const person=this.authenticate(request,url);
   if(url.pathname.endsWith('/socket')&&request.headers.get('Upgrade')?.toLowerCase()==='websocket'){
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.serializeAttachment({id:person.id});this.ctx.acceptWebSocket(server);server.send(JSON.stringify(view(this.room,person.id)));return new Response(null,{status:101,webSocket:client});
   }
   if(url.pathname.endsWith('/action')&&request.method==='POST'){
    const body=await readBody(request);
    if(body.type==='start'){
     if(person.id!==this.room.host)return error('ホストが開始します。',403);if(!['lobby','roundOver','finished'].includes(this.room.phase))return error('現在のラウンドを終えてください。');if(this.room.players.length<2)return error('2人以上で開始できます。');
     if(this.room.phase==='finished'){this.room.round=0;this.room.players.forEach(p=>p.score=0);}startRound(this.room);await this.emit();await this.schedule();
    }else if(body.type==='choice'){
     if(this.room.phase!=='choosing'||!person.active||person.choice||body.turn!==this.room.turn||body.round!==this.room.round)return error('この選択は受付終了です。');if(!['stay','escape'].includes(body.choice))return error('選択を確認してください。');
     person.choice=body.choice;await this.emit();await this.schedule();
    }else return error('操作を確認してください。');
    return json({ok:true});
   }
   if(request.method==='GET'&&!/\/(join|socket|action)$/.test(url.pathname))return json(view(this.room,person.id));
   return error('操作が見つかりません。',404);
  }catch(cause){return error(cause.status?cause.message:'接続エラー。もう一度お試しください。',cause.status||500);}
 }
 webSocketClose(){/* Hibernation API removes closed sockets automatically. */}
 webSocketError(){/* The browser reconnects automatically. */}
}
