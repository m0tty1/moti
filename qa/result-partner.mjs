// UI QA partner: stays for one draw, then escapes. Host remains controlled in UI.
const code=process.argv[2];
if(!/^\d{4}$/.test(code||''))throw new Error('Pass a 4-digit lobby room code.');
const base=`http://localhost:4173/api/rooms/${code}`;
const joined=await fetch(`${base}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'検証パートナー'})});
if(!joined.ok)throw new Error('Could not join the QA lobby.');
const session=await joined.json(),headers={Authorization:`Bearer ${session.token}`,'Content-Type':'application/json'};
console.log('QA partner joined.');
const control=new AbortController(),timeout=setTimeout(()=>control.abort(),180000);
try{
 const response=await fetch(`${base}/events`,{headers,signal:control.signal});const decoder=new TextDecoder();let buffer='',submitted='';
 for await(const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let boundary;
  while((boundary=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(!event.startsWith('data: '))continue;const state=JSON.parse(event.slice(6));
   if(state.phase==='finished'){console.log('QA partner completed 5 rounds.');control.abort();break;}
   const me=state.players.find(p=>p.id===session.id),key=`${state.round}:${state.turn}`;
   if(state.phase==='choosing'&&me?.active&&!me.choice&&key!==submitted){submitted=key;const choice=state.turn===1?'stay':'escape';const result=await fetch(`${base}/action`,{method:'POST',headers,body:JSON.stringify({type:'choice',choice,round:state.round,turn:state.turn})});if(!result.ok)throw new Error('QA choice rejected.');}
  }
 }
}catch(error){if(error.name!=='AbortError')throw error;}finally{clearTimeout(timeout);}
