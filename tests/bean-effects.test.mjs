import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';

const positive=(id,x,value=5)=>({id,x,z:0,y:1.2,radius:1.2,value});
const negative=(id,x,value=-10)=>({id,x,z:0,y:1.25,radius:1.25,effect:'subtract',value});
const zero=(id,x)=>({id,x,z:0,y:1.45,radius:1.45,effect:'zero',value:0});
const fixture=(beans,extra={})=>({id:1,code:'EFFECTS',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,w:120,d:40,y:0,type:'plain',checkpoint:false}],walls:[],hazards:[],portals:[],monsters:[],shields:[],beans,totalBeans:beans.length,totalScore:beans.reduce((s,b)=>s+Math.max(b.value,0),0),penaltyTotal:beans.reduce((s,b)=>s+Math.max(-b.value,0),0),requiredScore:200,bounds:{minX:-60,maxX:60,minZ:-20,maxZ:20},...extra});
const tick=(g,seconds,input={x:0,z:0})=>{for(let i=0;i<seconds*120;i++)g.step(1/120,input);};
const moveUntil=(g,predicate,x=1,seconds=12)=>{for(let i=0;i<seconds*120&&!predicate()&&g.status==='playing';i++)g.step(1/120,{x,z:0});assert.ok(predicate(),'real movement reaches the intended contact');};
const collect=(g,id,x=1)=>moveUntil(g,()=>g.collected.has(id),x);
const beanEvents=g=>g.events.filter(e=>e.type==='bean');

test('negative beans subtract 10 and 100, allow a negative balance and cannot trigger twice',()=>{
 const g=new Game(fixture([positive(0,0),negative(1,6),negative(2,12,-100)]));g.start();tick(g,.05);assert.equal(g.score,5);
 collect(g,1);assert.equal(g.score,-5);assert.equal(g.snapshot().score,-5);assert.equal(g.snapshot().progress,0);tick(g,.4);assert.equal(g.score,-5);
 moveUntil(g,()=>g.player.x>=8.5);moveUntil(g,()=>g.player.x<3,-1);assert.equal(g.score,-5,'walking back through the spent bean is harmless');
 collect(g,2);assert.equal(g.score,-105);tick(g,.4);assert.equal(g.score,-105);assert.equal(g.collected.size,3);assert.equal(g.snapshot().totalScore,5,'map capacity counts positive points only');assert.equal(g.snapshot().totalBeans,3);
 assert.deepEqual(beanEvents(g).map(e=>e.delta),[5,-10,-100]);assert.equal(beanEvents(g).reduce((s,e)=>s+e.delta,0),g.score);
});

test('zero clears a negative score, restores positive beans and permits collecting them again to win',()=>{
 const g=new Game(fixture([positive(0,0),negative(1,6),zero(2,12),positive(3,18,10)],{requiredScore:15}));g.start();tick(g,.05);collect(g,1);assert.equal(g.score,-5);collect(g,2);assert.equal(g.score,0);assert.equal(g.status,'playing');
 assert.equal(g.collected.has(0),false,'the eaten positive bean reappears');assert.equal(g.collected.has(1),true,'the negative bean stays spent');assert.equal(g.collected.has(2),true,'the zero bean stays spent');assert.equal(g.collected.has(3),false);
 assert.equal(g.snapshot().beans,3,'pickup count includes the earlier positive bean');assert.equal(g.snapshot().collectedBeans,2);assert.equal(g.snapshot().beansRemaining,2);
 const reset=beanEvents(g).find(e=>e.id===2);assert.deepEqual(reset.resetPositiveBeans,[0]);assert.equal(reset.beforeScore,-5);assert.equal(reset.delta,5,'clearing a negative balance raises it to zero');assert.equal(reset.score,0);
 collect(g,0,-1);assert.equal(g.score,5);collect(g,3);assert.equal(g.score,15);assert.equal(g.status,'won');assert.equal(g.events.filter(e=>e.type==='win').length,1);assert.equal(g.snapshot().beans,5);assert.equal(g.snapshot().collectedBeans,4);assert.equal(g.snapshot().beansRemaining,0);
 assert.equal(beanEvents(g).filter(e=>e.id===0).length,2);assert.equal(beanEvents(g).filter(e=>e.id===1).length,1);assert.equal(beanEvents(g).filter(e=>e.id===2).length,1);assert.equal(beanEvents(g).reduce((s,e)=>s+e.delta,0),15);
});

test('pause, teleport and manual return preserve spent traps; restart restores all beans and scores',()=>{
 const g=new Game(fixture([positive(0,0),negative(1,6),zero(2,42)],{portals:[{id:0,x:18,z:0,y:0,radius:1,target:1,platformId:0,label:'A'},{id:1,x:36,z:0,y:0,radius:1,target:0,platformId:0,label:'A'}]}));g.start();tick(g,.05);collect(g,1);assert.equal(g.score,-5);
 g.pause();const frozen=g.snapshot();tick(g,3,{x:1,z:0});assert.deepEqual(g.snapshot(),frozen);g.start();moveUntil(g,()=>g.portalUses===1);assert.equal(g.score,-5,'portal travel preserves a negative balance');assert.equal(g.collected.has(1),true);
 g.respawn();assert.equal(g.score,-5,'manual R preserves a negative balance');tick(g,.05);assert.equal(g.score,-5);moveUntil(g,()=>g.portalUses===2);assert.equal(g.score,-5);collect(g,2);assert.equal(g.score,0);assert.equal(g.collected.has(0),false);assert.equal(g.collected.has(1),true);assert.equal(g.collected.has(2),true);
 g.respawn();assert.equal(g.score,0);assert.equal(g.collected.has(1),true);assert.equal(g.collected.has(2),true);tick(g,.05);assert.equal(g.score,5);moveUntil(g,()=>g.player.x>44);assert.equal(g.score,5,'spent subtract and zero beans do not fire after R and portal travel');
 g.restart();assert.equal(g.score,0);assert.equal(g.collected.size,0);assert.equal(g.beanPickups,0);assert.equal(g.time,0);tick(g,.05);assert.equal(g.score,5);collect(g,1);assert.equal(g.score,-5,'a new run can trigger the same negative bean again');collect(g,2);assert.equal(g.score,0);assert.equal(g.collected.has(0),false);
});

test('falling off a real platform preserves negative balances and spent subtract or zero beans',()=>{
 for(const includeZero of [false,true]){
  const g=new Game(fixture([positive(0,-8),negative(1,0,-100),...(includeZero?[zero(2,8)]:[])],{spawn:{x:-8,z:0,y:0},platforms:[{id:0,x:0,z:0,w:24,d:12,y:0,type:'plain',checkpoint:false}]}));g.start();tick(g,.05);collect(g,1);assert.equal(g.score,-95);if(includeZero)collect(g,2);const before=includeZero?0:-95;
  moveUntil(g,()=>g.falls===1);assert.equal(g.score,before);assert.equal(g.collected.has(1),true);if(includeZero)assert.equal(g.collected.has(2),true);
  for(let i=0;i<240&&g.respawnDelay>0;i++)g.step(1/120);assert.equal(g.respawnDelay,0);assert.equal(g.player.x,-8);assert.equal(g.score,before);moveUntil(g,()=>g.player.x>10);assert.equal(g.score,includeZero?5:-95);assert.equal(beanEvents(g).filter(e=>e.id===1).length,1);if(includeZero)assert.equal(beanEvents(g).filter(e=>e.id===2).length,1);
 }
});

const permutations=items=>items.length?items.flatMap((item,i)=>permutations(items.filter((_,j)=>i!==j)).map(rest=>[item,...rest])):[[]];
test('overlapping contacts apply positive then subtract then zero regardless of array order and never win early',()=>{
 for(const includeZero of [false,true])for(const order of permutations([positive(1,0,10),negative(2,0),...(includeZero?[zero(3,0)]:[])].map(b=>({...b,radius:1,y:1})))){
  const g=new Game(fixture([positive(0,-6),...order],{spawn:{x:-6,z:0,y:0},requiredScore:12}));g.start();tick(g,.05);assert.equal(g.score,5);collect(g,2);assert.equal(g.score,includeZero?0:5);assert.equal(g.status,'playing');assert.equal(g.events.filter(e=>e.type==='win').length,0);
  assert.deepEqual(beanEvents(g).slice(1).map(e=>e.id),includeZero?[1,2,3]:[1,2]);assert.deepEqual(beanEvents(g).slice(1).map(e=>e.delta),includeZero?[10,-10,-5]:[10,-10]);
  if(includeZero){assert.equal(g.collected.has(0),false);assert.equal(g.collected.has(1),false);assert.equal(g.collected.has(2),true);assert.equal(g.collected.has(3),true);g.step(1/120);assert.equal(g.score,10,'a restored overlapping positive bean is available on the following step');assert.equal(g.status,'playing');}
 }
});

test('a player shield cannot block negative or zero beans and is not consumed by them',()=>{
 const g=new Game(fixture([positive(0,0),negative(1,6),zero(2,12)],{shields:[{id:0,x:0,z:0,y:.8,respawn:100}]}));g.start();tick(g,.05);assert.equal(g.player.shield,1);assert.equal(g.score,5);collect(g,1);assert.equal(g.score,-5);assert.equal(g.player.shield,1);assert.equal(g.player.health,3);collect(g,2);assert.equal(g.score,0);assert.equal(g.player.shield,1);assert.equal(g.player.health,3);assert.equal(g.shieldsUsed,0);
});
