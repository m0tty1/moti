// QA-only: force rare draws without changing production probabilities or items.
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {lootPool} from '../public/loot-catalog.js';
const require=createRequire(import.meta.url),crypto=require('node:crypto'),native=crypto.randomInt;
const high=lootPool(16,true),legendIndex=high.findIndex(p=>p.id==='blue-diamond');let roll=0;
crypto.randomInt=(...args)=>{
 if(args.length===1&&args[0]===10000)return ++roll%2?9999:0;
 if(args.length===1&&args[0]===high.length)return legendIndex;
 if(args.length===1&&[2,7].includes(args[0]))return 0;
 return native(...args);
};
syncBuiltinESMExports();Math.random=()=>.999;
