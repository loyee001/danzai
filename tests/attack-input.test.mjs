import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttackInput,bindAttackButton,handleAttackKey} from '../dist/attack-input.js';
import {Game} from '../dist/engine.js';

const fixture=()=>({id:1,code:'INPUT',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:80,d:80,type:'plain'}],beans:[],totalBeans:0,totalScore:0,requiredScore:100,walls:[],hazards:[],portals:[],monsters:[],bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40}});
const game=()=>{const g=new Game(fixture());g.start();g.setWeapon('launcher');return g;};
const event=(type,properties={})=>Object.assign(new Event(type,{cancelable:true}),properties);
const pointer=(button,type,properties={})=>button.dispatchEvent(event(type,{button:0,pointerId:1,isPrimary:true,...properties}));
const key=(input,type,code='KeyF',repeat=false)=>handleAttackKey(event(type,{code,repeat}),input);
const advance=(g,input,seconds)=>{for(let elapsed=0;elapsed<seconds-1e-12;){const dt=Math.min(1/120,seconds-elapsed);input.tick(dt);g.step(dt);elapsed+=dt;}};
const setup=(options={})=>{const g=game(),input=createAttackInput(()=>g.action('attack'),options),button=new EventTarget();bindAttackButton(button,input);return {g,input,button};};
const tap=button=>{pointer(button,'pointerdown');pointer(button,'pointerup');pointer(button,'click',{detail:1});};

// All timing below is injected through tick(), while every shot uses the real Game action API.
test('one quick pointer tap fires immediately once and its following click cannot double-fire',()=>{
  const {g,input,button}=setup();pointer(button,'pointerdown');assert.equal(g.actionCounts.attack,1);assert.equal(g.projectiles.length,1);assert.equal(input.holding,true);
  advance(g,input,.12);pointer(button,'pointerup');pointer(button,'click',{detail:1});assert.equal(g.actionCounts.attack,1);assert.equal(input.holding,false);advance(g,input,1);assert.equal(g.actionCounts.attack,1);assert.equal(g.player.attackCd,0);
});

test('holding a pointer fires one additional real bubble at 0.3 seconds and another at 0.6',()=>{
  const {g,input,button}=setup();pointer(button,'pointerdown');advance(g,input,.299);assert.equal(g.actionCounts.attack,1);advance(g,input,.001);assert.equal(g.actionCounts.attack,2);assert.equal(g.projectiles.length,2);
  advance(g,input,.299);assert.equal(g.actionCounts.attack,2);advance(g,input,.001);assert.equal(g.actionCounts.attack,3);assert.equal(g.projectiles.length,3);assert.equal(g.player.attackCd,0);
  pointer(button,'pointerup');pointer(button,'click',{detail:1});advance(g,input,.6);assert.equal(g.actionCounts.attack,3);
});

test('release, cancellation, pointer leave and lost capture stop repetition without a late shot',()=>{
  for(const ending of ['pointerup','pointercancel','pointerleave','lostpointercapture']){
    const {g,input,button}=setup();pointer(button,'pointerdown');advance(g,input,.29);pointer(button,ending);pointer(button,'click',{detail:1});advance(g,input,.9);assert.equal(g.actionCounts.attack,1,ending);assert.equal(input.holding,false);
    pointer(button,'pointerdown');assert.equal(g.actionCounts.attack,2);advance(g,input,.29);assert.equal(g.actionCounts.attack,2,'a fresh hold cannot inherit the cancelled timer');pointer(button,'pointerup');pointer(button,'click',{detail:1});
  }
});

test('a cancelled touch cannot add a zero-detail pointer click while keyboard clicks remain available',()=>{
  const {g,input,button}=setup();pointer(button,'pointerdown',{pointerType:'touch'});advance(g,input,.29);pointer(button,'pointercancel',{pointerType:'touch'});pointer(button,'click',{pointerType:'touch',detail:0});advance(g,input,.6);assert.equal(g.actionCounts.attack,1);
  button.dispatchEvent(event('click',{button:0,pointerId:-1,pointerType:'',detail:0}));assert.equal(g.actionCounts.attack,2);assert.equal(input.holding,false);
});

test('ten distinct rapid taps and ten click-only activations are not throttled',()=>{
  const {g,input,button}=setup();for(let i=0;i<10;i++)tap(button);assert.equal(g.actionCounts.attack,10);assert.equal(g.projectiles.length,10);
  for(let i=0;i<10;i++)button.dispatchEvent(event('click',{button:0,detail:1}));assert.equal(g.actionCounts.attack,20);assert.equal(g.projectiles.length,20);assert.equal(g.player.attackCd,0);assert.equal(input.holding,false);
});

test('F and J repeat on the injected 0.3-second schedule while duplicate keydowns add no shots',()=>{
  const {g,input}=setup();assert.equal(key(input,'keydown'),true);assert.equal(g.actionCounts.attack,1);
  for(let i=0;i<10;i++)key(input,'keydown','KeyF',true);key(input,'keydown','KeyF',false);assert.equal(g.actionCounts.attack,1);
  advance(g,input,.299);assert.equal(g.actionCounts.attack,1);advance(g,input,.001);assert.equal(g.actionCounts.attack,2);advance(g,input,.3);assert.equal(g.actionCounts.attack,3);
  key(input,'keyup');advance(g,input,.6);assert.equal(g.actionCounts.attack,3);key(input,'keydown','KeyJ');assert.equal(g.actionCounts.attack,4);advance(g,input,.3);assert.equal(g.actionCounts.attack,5);key(input,'keyup','KeyJ');advance(g,input,.6);assert.equal(g.actionCounts.attack,5);
  const unrelated=event('keydown',{code:'KeyW'});assert.equal(handleAttackKey(unrelated,input),false);assert.equal(unrelated.defaultPrevented,false);
});

test('two held keys share one cadence and each new physical press still attacks immediately',()=>{
  const {g,input}=setup();key(input,'keydown','KeyF');advance(g,input,.1);key(input,'keydown','KeyJ');assert.equal(g.actionCounts.attack,2);advance(g,input,.299);assert.equal(g.actionCounts.attack,2);advance(g,input,.001);assert.equal(g.actionCounts.attack,3);
  key(input,'keyup','KeyF');assert.equal(input.holding,true);advance(g,input,.3);assert.equal(g.actionCounts.attack,4);key(input,'keyup','KeyJ');advance(g,input,.6);assert.equal(g.actionCounts.attack,4);
  key(input,'keydown','KeyJ');key(input,'keyup','KeyJ');assert.equal(g.actionCounts.attack,5);
});

test('secondary buttons and fingers are ignored while keyboard button activation fires once',()=>{
  const {g,input,button}=setup();pointer(button,'pointerdown',{button:2});pointer(button,'click',{button:2,detail:1});pointer(button,'pointerdown',{pointerId:2,isPrimary:false});pointer(button,'click',{pointerId:2,isPrimary:false,detail:1});assert.equal(g.actionCounts.attack,0);
  button.dispatchEvent(event('click',{button:0,detail:0}));assert.equal(g.actionCounts.attack,1);assert.equal(input.holding,false);advance(g,input,.6);assert.equal(g.actionCounts.attack,1);
});

test('two bound targets have distinct pointer sources but cannot multiply one primary hold',()=>{
  const {g,input,button}=setup(),scene=new EventTarget();bindAttackButton(scene,input);pointer(scene,'pointerdown');advance(g,input,.15);pointer(button,'pointerdown',{pointerId:2});pointer(button,'pointerup',{pointerId:2});pointer(button,'click',{pointerId:2,detail:1});assert.equal(g.actionCounts.attack,1);assert.equal(input.holding,true);
  advance(g,input,.15);assert.equal(g.actionCounts.attack,2);pointer(scene,'pointerup');pointer(scene,'click',{detail:1});assert.equal(input.holding,false);tap(button);assert.equal(g.actionCounts.attack,3);advance(g,input,.6);assert.equal(g.actionCounts.attack,3);
});

test('the same bubbled pointer and click events are handled once across nested bindings',()=>{
  const {g,input,button}=setup(),parent=new EventTarget();bindAttackButton(parent,input);
  const down=event('pointerdown',{button:0,pointerId:1,isPrimary:true});button.dispatchEvent(down);parent.dispatchEvent(down);assert.equal(g.actionCounts.attack,1);
  const up=event('pointerup',{button:0,pointerId:1});button.dispatchEvent(up);parent.dispatchEvent(up);
  const click=event('click',{button:0,pointerId:1,detail:1});button.dispatchEvent(click);parent.dispatchEvent(click);assert.equal(g.actionCounts.attack,1);
});

const documentButton=()=>{
  const view=new EventTarget(),doc=Object.assign(new EventTarget(),{defaultView:view,hidden:false}),button=Object.assign(new EventTarget(),{ownerDocument:doc}),captures=new Set();
  button.setPointerCapture=id=>captures.add(id);button.hasPointerCapture=id=>captures.has(id);button.releasePointerCapture=id=>captures.delete(id);return {view,doc,button,captures};
};

test('a non-primary attack touch works beside a held joystick while a second attack finger cannot add shots',()=>{
  const g=game(),input=createAttackInput(()=>g.action('attack')),{view,button,captures}=documentButton(),joystick=new EventTarget();bindAttackButton(button,input);
  pointer(joystick,'pointerdown',{pointerId:10,pointerType:'touch',isPrimary:true});assert.equal(g.actionCounts.attack,0);
  pointer(button,'pointerdown',{pointerId:11,pointerType:'touch',isPrimary:false});assert.equal(g.actionCounts.attack,1);assert.equal(input.holding,true);assert.equal(captures.has(11),true);advance(g,input,.3);assert.equal(g.actionCounts.attack,2);
  pointer(button,'pointerdown',{pointerId:12,pointerType:'touch',isPrimary:false});pointer(button,'pointerup',{pointerId:12,pointerType:'touch',isPrimary:false});pointer(button,'click',{pointerId:12,pointerType:'touch',isPrimary:false,detail:1});assert.equal(g.actionCounts.attack,2);assert.equal(input.holding,true);
  view.dispatchEvent(event('pointerup',{pointerId:10,pointerType:'touch',isPrimary:true}));assert.equal(input.holding,true,'releasing the joystick does not release the attack finger');advance(g,input,.3);assert.equal(g.actionCounts.attack,3);
  pointer(button,'pointerup',{pointerId:11,pointerType:'touch',isPrimary:false});pointer(button,'click',{pointerId:11,pointerType:'touch',isPrimary:false,detail:1});assert.equal(input.holding,false);assert.equal(captures.size,0);advance(g,input,.6);assert.equal(g.actionCounts.attack,3);
});

test('window release clears pointer capture even when the release occurs outside the target',()=>{
  const g=game(),input=createAttackInput(()=>g.action('attack')),{view,button,captures}=documentButton();bindAttackButton(button,input);pointer(button,'pointerdown');assert.equal(captures.has(1),true);advance(g,input,.29);view.dispatchEvent(event('pointerup',{pointerId:1}));assert.equal(captures.size,0);assert.equal(input.holding,false);advance(g,input,.9);assert.equal(g.actionCounts.attack,1);
});

test('blur, hidden documents and explicit pause cancellation clear every held source without catching up',()=>{
  for(const reason of ['blur','hidden','pause']){
    const g=game(),input=createAttackInput(()=>g.action('attack')),{view,doc,button,captures}=documentButton();bindAttackButton(button,input);pointer(button,'pointerdown');key(input,'keydown');advance(g,input,.29);assert.equal(g.actionCounts.attack,2);
    if(reason==='blur')view.dispatchEvent(event('blur'));else if(reason==='hidden'){doc.hidden=true;doc.dispatchEvent(event('visibilitychange'));}else{g.pause();input.clear();}
    assert.equal(input.holding,false);assert.equal(captures.size,0);advance(g,input,2);assert.equal(g.actionCounts.attack,2);pointer(button,'pointerup');pointer(button,'click',{detail:1});key(input,'keydown','KeyF',true);assert.equal(input.holding,false);assert.equal(g.actionCounts.attack,2);
    g.start();doc.hidden=false;key(input,'keyup');key(input,'keydown');assert.equal(g.actionCounts.attack,3,'resuming requires a new physical press');key(input,'keyup');
  }
});

test('a disabled state clears holding and re-enabling cannot resume an old gesture',()=>{
  let enabled=true;const {g,input,button}=setup({enabled:()=>enabled});pointer(button,'pointerdown');advance(g,input,.29);enabled=false;advance(g,input,.5);assert.equal(input.holding,false);assert.equal(g.actionCounts.attack,1);
  enabled=true;advance(g,input,.6);pointer(button,'pointerup');pointer(button,'click',{detail:1});assert.equal(g.actionCounts.attack,1);tap(button);assert.equal(g.actionCounts.attack,2);
});

test('unbinding releases a held pointer and removes its button and lifecycle listeners',()=>{
  const g=game(),input=createAttackInput(()=>g.action('attack')),{view,doc,button}=documentButton(),unbind=bindAttackButton(button,input);pointer(button,'pointerdown');advance(g,input,.29);unbind();assert.equal(input.holding,false);advance(g,input,.6);tap(button);assert.equal(g.actionCounts.attack,1);
  key(input,'keydown');view.dispatchEvent(event('blur'));doc.hidden=true;doc.dispatchEvent(event('visibilitychange'));assert.equal(input.holding,true,'disposed bindings no longer own lifecycle events');key(input,'keyup');
});

test('legacy callback overloads retain single-click and non-repeating key behavior',()=>{
  const g=game(),button=new EventTarget(),unbind=bindAttackButton(button,()=>g.action('attack'));pointer(button,'pointerdown');pointer(button,'pointerup');pointer(button,'click',{detail:1});assert.equal(g.actionCounts.attack,1);
  handleAttackKey(event('keydown',{code:'KeyF',repeat:false}),()=>g.action('attack'));handleAttackKey(event('keydown',{code:'KeyF',repeat:true}),()=>g.action('attack'));handleAttackKey(event('keyup',{code:'KeyF'}),()=>g.action('attack'));assert.equal(g.actionCounts.attack,2);unbind();pointer(button,'click',{detail:1});assert.equal(g.actionCounts.attack,2);
});
