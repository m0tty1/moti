import test from 'node:test';
import assert from 'node:assert/strict';
import {perceptualGain} from './public/audio-level.js';

test('音量バーは10%と90%で明確な音量差を作る',()=>{
 assert.equal(perceptualGain(0),0);
 assert.ok(Math.abs(perceptualGain(.1)-.01)<1e-12);
 assert.ok(Math.abs(perceptualGain(.9)-.81)<1e-12);
 assert.ok(perceptualGain(.9)/perceptualGain(.1)>80);
 assert.equal(perceptualGain(1),1);
});
