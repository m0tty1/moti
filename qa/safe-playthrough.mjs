// QA-only preload. Run with: PORT=4186 node --import ./qa/safe-playthrough.mjs server.mjs
// Keeps every draw common treasure and CPUs inside, so all three visual stages
// can be inspected through real UI actions. Never loaded by the normal server.
import {createRequire,syncBuiltinESMExports} from 'node:module';
const require=createRequire(import.meta.url);
const crypto=require('node:crypto');
const nativeRandomInt=crypto.randomInt;
crypto.randomInt=(...args)=>args.length===1&&args[0]===10000?9999:nativeRandomInt(...args);
syncBuiltinESMExports();
Math.random=()=>.999;
