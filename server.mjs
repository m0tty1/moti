import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve as pathResolve } from 'node:path';
import { randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { newRoom, player, startRound, resolve, advance, view, riskProfile } from './engine.mjs';

const rooms=new Map(), streams=new Map(), root=fileURLToPath(new URL('./public/',import.meta.url));
const port=Number(process.env.PORT||4173);
const clients=room=>streams.get(room.code)||new Set();
function send(stream,data){if(typeof stream.res.send==='function')stream.res.send(data);else stream.res.write(`data: ${data}\n\n`);}
function emit(room){room.revision++;for(const s of clients(room))send(s,JSON.stringify(view(room,s.id)));}
function schedule(room){
  clearTimeout(room.clock);
  if(room.phase!=='choosing')return;
  const next=riskProfile(room.turn+1,room.alarm);
  const escapeChance=Math.min(.9,.025+next.bustChance*.015+Math.min(.24,room.pot/1800));
  for(const p of room.players.filter(p=>p.bot&&p.active&&!p.choice))p.choice=Math.random()<escapeChance?'escape':'stay';
  if(resolve(room)){emit(room);room.clock=setTimeout(()=>{advance(room);emit(room);schedule(room);},1700);return;}
  room.clock=setTimeout(()=>{for(const p of room.players.filter(p=>p.active&&!p.choice))p.choice='escape';schedule(room);},Math.max(0,room.deadline-Date.now()));
}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)fail('入力が長すぎます。',413);}try{return JSON.parse(raw||'{}');}catch{fail('入力形式を確認してください。');}}
function authenticate(room,token){const p=room.players.find(p=>p.token===token);if(!p)fail('入室し直してください。',401);return p;}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{ok:true});
    if(req.method==='POST'&&url.pathname==='/api/rooms'){
      if(rooms.size>=500)fail('部屋が混み合っています。',503);
      const b=await body(req);if(typeof b.name!=='string'||!b.name.trim())fail('名前を入力してください。');
      const bots=Number(b.bots||0);if(!Number.isInteger(bots)||bots<0||bots>7)fail('CPU人数を確認してください。');
      let code;do{code=String(randomInt(10000)).padStart(4,'0');}while(rooms.has(code));
      const room=newRoom(code,b.name,bots);room.touched=Date.now();rooms.set(code,room);
      return json(res,201,{code,token:room.players[0].token,id:room.host});
    }
    const match=url.pathname.match(/^\/api\/rooms\/(\d{4})(?:\/(join|events|action))?$/);
    if(match){
      const room=rooms.get(match[1]);if(!room)fail('部屋が見つかりません。コードを確認してください。',404);room.touched=Date.now();
      if(match[2]==='join'&&req.method==='POST'){
        const b=await body(req);if(room.phase!=='lobby')fail('この部屋は対戦中です。');if(room.players.length>=8)fail('満員です。');if(typeof b.name!=='string'||!b.name.trim())fail('名前を入力してください。');
        const p=player(b.name);room.players.push(p);emit(room);return json(res,200,{code:room.code,token:p.token,id:p.id});
      }
      const token=req.headers.authorization?.replace(/^Bearer /,'')||url.searchParams.get('token');const p=authenticate(room,token);
      if(match[2]==='events'&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(view(room,p.id))}\n\n`);
        if(!streams.has(room.code))streams.set(room.code,new Set());const stream={res,id:p.id};streams.get(room.code).add(stream);
        const ping=setInterval(()=>res.write(': ping\n\n'),15000);req.on('close',()=>{clearInterval(ping);streams.get(room.code)?.delete(stream);});return;
      }
      if(match[2]==='action'&&req.method==='POST'){
        const b=await body(req);
        if(b.type==='start'){
          if(p.id!==room.host)fail('ホストが開始します。',403);if(!['lobby','roundOver','finished'].includes(room.phase))fail('現在のラウンドを終えてください。');if(room.players.length<2)fail('2人以上で開始できます。');
          if(room.phase==='finished'){room.round=0;room.players.forEach(p=>p.score=0);}startRound(room);emit(room);schedule(room);
        }else if(b.type==='choice'){
          if(room.phase!=='choosing'||!p.active||p.choice||b.turn!==room.turn||b.round!==room.round)fail('この選択は受付終了です。');if(!['stay','escape'].includes(b.choice))fail('選択を確認してください。');
          p.choice=b.choice;emit(room);schedule(room);
        }else fail('操作を確認してください。');
        return json(res,200,{ok:true});
      }
      if(req.method==='GET'&&!match[2])return json(res,200,view(room,p.id));
      fail('操作が見つかりません。',404);
    }
    if(req.method!=='GET')fail('操作が見つかりません。',404);
    const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');const path=pathResolve(join(root,requested));
    if(!path.startsWith(pathResolve(root)+ '\\')&&!path.startsWith(pathResolve(root)+'/'))fail('見つかりません。',404);
    let data;try{data=await readFile(path);}catch{fail('見つかりません。',404);}
    res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'})[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'接続エラー。もう一度お試しください。'});else res.end();}
});
const cleanup=setInterval(()=>{for(const [code,room]of rooms)if(!clients(room).size&&Date.now()-room.touched>6*3600000){clearTimeout(room.clock);rooms.delete(code);streams.delete(code);}},60000);cleanup.unref();
const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{
  try{
    const url=new URL(req.url,'http://localhost'),match=url.pathname.match(/^\/api\/rooms\/(\d{4})\/socket$/);
    if(!match)throw new Error('not found');
    const room=rooms.get(match[1]);if(!room)throw new Error('room not found');
    const p=authenticate(room,url.searchParams.get('token'));
    wss.handleUpgrade(req,socket,head,ws=>{
      if(!streams.has(room.code))streams.set(room.code,new Set());const stream={res:ws,id:p.id};streams.get(room.code).add(stream);
      ws.send(JSON.stringify(view(room,p.id)));ws.on('close',()=>streams.get(room.code)?.delete(stream));
    });
  }catch{socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');socket.destroy();}
});
server.listen(port,'0.0.0.0',()=>console.log(`VAULT BREAK → http://localhost:${port}`));
