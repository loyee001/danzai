import test from 'node:test';
import assert from 'node:assert/strict';
import {createResetInput} from '../dist/reset-input.js';

test('reset needs all three held keys in any order and never fires for one or two',()=>{
 for(const order of [['KeyR','KeyU','KeyO'],['KeyO','KeyR','KeyU'],['KeyU','KeyO','KeyR']]){
  let resets=0;const input=createResetInput(()=>resets++);
  input.keyDown({code:order[0]});input.keyDown({code:order[1]});assert.equal(resets,0);
  input.keyDown({code:order[2]});assert.equal(resets,1);
 }
});

test('separate key taps, key repeats and an already-held chord cannot repeat reset',()=>{
 let resets=0;const input=createResetInput(()=>resets++);
 for(const code of ['KeyR','KeyU','KeyO']){input.keyDown({code});input.keyUp({code});}assert.equal(resets,0);
 for(const code of ['KeyR','KeyU','KeyO'])input.keyDown({code});assert.equal(resets,1);
 for(let i=0;i<20;i++)input.keyDown({code:'KeyO',repeat:true});input.keyDown({code:'KeyR'});assert.equal(resets,1);
 input.keyUp({code:'KeyU'});input.keyDown({code:'KeyU'});assert.equal(resets,2);
});

test('clearing a chord on blur or dialog prevents stale keys from resetting later',()=>{
 let resets=0;const input=createResetInput(()=>resets++);
 input.keyDown({code:'KeyR'});input.keyDown({code:'KeyU'});input.clear();input.keyDown({code:'KeyO'});assert.equal(resets,0);
 assert.equal(input.keyDown({code:'KeyW'}),false);assert.equal(input.keyUp({code:'KeyW'}),false);
});
