import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {grantItems,solidCrates} from '../dist/gadgets.js';
const DT=1/120;
const floor=(id,x=0,z=0,y=0,w=80,d=80,type='plain',extra={})=>({id,x,z,y,w,d,type,checkpoint:false,...extra});
const fixture=extra=>({id:1,code:'AIR-CRATE',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[floor(0)],walls:[],hazards:[],beans:[],portals:[],monsters:[],shields:[],gadgetPickups:[],totalBeans:0,totalScore:0,requiredScore:100,bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},...extra});
const start=extra=>{const g=new Game(fixture(extra));g.start();grantItems(g,{crate:3,jetpack:1,grapple:1});return g;};
const tick=(g,t,input={x:0,z:0})=>{for(let i=0;i<Math.ceil(t/DT);i++)g.step(DT,input);};
function jump(g,t=.22,input={x:0,z:0}){assert(g.action('jump'));tick(g,t,input);assert.equal(g.player.ground,null);}
function moveTo(g,target,limit=2000){for(let i=0;i<limit;i++){const dx=target.x-g.player.x,dz=target.z-g.player.z;if(Math.hypot(dx,dz)<.08){tick(g,.15);return true;}g.step(DT,{x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))});if(g.respawnDelay)return false;}return false;}
const position=g=>({x:g.player.x,y:g.player.y,z:g.player.z});

for(const phase of ['rising','falling'])test(`an airborne crate catches a ${phase} player without teleporting and remains a stable platform`,()=>{
 const g=start();jump(g,phase==='rising'?.22:.6);assert(phase==='rising'?g.player.vy>0:g.player.vy<0);const before=position(g);assert(g.action('crate'));const box=g.gadgets.crates[0];
 assert.deepEqual(position(g),before);assert.equal(box.airborne,true);assert.equal(box.platformId,null);assert.equal(box.y+box.h,before.y);assert.equal(box.x,before.x);assert.equal(box.z,before.z);assert.equal(g.player.ground,box.id);assert.equal(g.player.vy,0);assert.equal(g.player.airDive,false);assert.equal(g.gadgets.inventory.crate,2);assert.equal(g.events.findLast(e=>e.type==='gadgetStart').airborne,true);
 tick(g,1);assert.equal(g.player.y,before.y);assert.equal(g.player.ground,box.id);assert.equal(g.falls,0);const snap=g.snapshot();snap.gadgets.crates[0].airborne=false;assert.equal(box.airborne,true);
});

test('jumping again from the caught box reaches a higher absolute peak and lands back on it',()=>{
 const g=start();jump(g);assert(g.action('crate'));const box=g.gadgets.crates[0],base=g.player.y;assert(g.action('jump'));let peak=base;for(let i=0;i<135;i++){g.step(DT);peak=Math.max(peak,g.player.y);}assert(peak>base+2.1);assert(peak>3.7);assert.equal(g.player.ground,box.id);assert.equal(g.player.y,box.y+box.h);
});

test('an in-flight dive can place a box which cancels momentum and restores the next jump',()=>{
 const g=start();jump(g);assert(g.action('dive'));tick(g,.04);assert(g.player.dive>0);assert(g.player.vz>0&&g.player.z>0);const before=position(g);assert(g.action('crate'));assert.deepEqual(position(g),before);assert.equal(g.player.dive,0);assert.equal(g.player.roll,0);assert.equal(g.player.vx,0);assert.equal(g.player.vz,0);assert.equal(g.player.airDive,false);tick(g,.3);assert.deepEqual(position(g),before);assert(g.action('jump'));tick(g,.12);assert(g.player.y>before.y+.9);
});

test('placing under a jetpack stops its lift only on success and emits the crate interruption reason',()=>{
 const g=start();assert(g.action('jetpack'));tick(g,.4);const before=position(g);assert(g.action('crate'));assert.deepEqual(position(g),before);assert.equal(g.gadgets.jetpack,null);assert.equal(g.gadgets.inventory.jetpack,0);assert(g.events.some(e=>e.type==='gadgetEnd'&&e.gadget==='jetpack'&&e.reason==='crate'));tick(g,1);assert.deepEqual(position(g),before);
 const blocked=start({walls:[{x:1.1,z:0,w:.5,d:12,h:20}]});assert(blocked.action('jetpack'));tick(blocked,.4);const jet=blocked.gadgets.jetpack,inventory=blocked.gadgets.inventory.crate;assert.equal(blocked.action('crate'),false);assert.equal(blocked.gadgets.inventory.crate,inventory);assert.equal(blocked.gadgets.jetpack,jet);assert(!blocked.events.some(e=>e.type==='gadgetEnd'&&e.reason==='crate'));const y=blocked.player.y;tick(blocked,.2);assert(blocked.player.y>y+1);
});

test('a crate interrupts a continuous grapple at the current feet and the rope does not pull it away',()=>{
 const g=start({platforms:[floor(0,0,0,0,8,8),floor(1,18,0,1,8,8)],grappleAnchors:[{id:'target',x:18,z:0,y:4.5,platformId:1}]});tick(g,.02,{x:1,z:0});tick(g,.12);assert(g.action('grapple'));tick(g,.28);assert(g.gadgets.grapple);assert(g.player.x>.1);const before=position(g);assert(g.action('crate'));assert.deepEqual(position(g),before);assert.equal(g.gadgets.grapple,null);assert.equal(g.gadgets.inventory.grapple,0);assert(g.events.some(e=>e.type==='gadgetEnd'&&e.gadget==='grapple'&&e.reason==='crate'));tick(g,1);assert.deepEqual(position(g),before);assert.equal(g.player.ground,g.gadgets.crates[0].id);
 const rejected=start({platforms:[floor(0,0,0,0,8,8),floor(1,18,0,1,8,8)],grappleAnchors:[{id:'target',x:18,z:0,y:4.5,platformId:1}],exitPortal:{x:0,z:0,y:0,radius:1.2}});tick(rejected,.02,{x:1,z:0});tick(rejected,.12);assert(rejected.action('grapple'));tick(rejected,.18);const hook=rejected.gadgets.grapple;assert(hook);assert.equal(rejected.action('crate'),false);assert.equal(rejected.gadgets.grapple,hook);assert.equal(rejected.gadgets.inventory.crate,3);const x=rejected.player.x;tick(rejected,.1);assert(rejected.player.x>x+.1,'failed box placement must keep pulling');
});

test('wall tops and portal volumes reject a foot box without spending',()=>{
 const cases=[{walls:[{x:1.1,z:0,w:.5,d:12,h:4}]},{portals:[{id:0,target:99,x:0,z:0,y:0,radius:1.2}]},{exitPortal:{x:0,z:0,y:0,radius:1.2}},{monsters:[{id:0,type:'beetle',x:1.5,z:0,y:0,hp:10,speed:0,chaseSpeed:0,patrol:[{x:1.5,z:0}]}]},{hazards:[{type:'gate',x:.9,z:0,y:0,w:10,axis:'x',phase:1,speed:0}]}];
 for(const spec of cases){const g=start(spec);jump(g);const y=g.player.y;assert(g.player.ground===null);assert.equal(g.action('crate'),false);assert.equal(g.player.y,y);assert.equal(g.gadgets.inventory.crate,3);assert.equal(g.gadgets.crates.length,0);}
 const wallTop=start({spawn:{x:0,z:0,y:3},platforms:[floor(0,0,0,3)],walls:[{x:1.1,z:0,w:.5,d:12,h:3.6}]});jump(wallTop,.2);assert(wallTop.player.y>3.6);assert(wallTop.player.y-1.25<3.6);assert.equal(wallTop.action('crate'),false,'player is above wall but new box would intersect its top');assert.equal(wallTop.gadgets.inventory.crate,3);
});

test('a high foot box can bridge above lava but a low box intersecting lava cannot be placed',()=>{
 const extra={mode:'challenge',challenge:{id:'lava-fixture',name:'fixture'},finishPortal:{x:50,z:50,y:0,radius:1},exitPortal:{x:-50,z:-50,y:0,radius:1},platforms:[floor(0,0,0,0,4,4)],lavaZones:[{id:'lava',x:0,z:0,y:-.35,w:60,d:60}]};
 const low=start(extra);jump(low,.05);assert.equal(low.action('crate'),false);assert.equal(low.gadgets.inventory.crate,3);assert.equal(low.falls,0);
 const high=start(extra);jump(high,.32,{x:0,z:1});assert(high.player.z>1.5);assert(high.player.y-1.25>-.13);assert(high.action('crate'));const box=high.gadgets.crates[0];assert(box.y>-.13);tick(high,.7);assert.equal(high.falls,0);assert.equal(high.player.ground,box.id);assert.equal(high.player.y,box.y+box.h);
});

test('falling below the map floor or a jump too low for a full box cannot be rescued',()=>{
 const g=start({platforms:[floor(0,0,0,0,4,4)]});for(let i=0;i<200&&g.player.y>-.5;i++)g.step(DT,{x:0,z:1});assert(g.player.y<0&&g.player.y>-1);assert.equal(g.action('crate'),false);assert.equal(g.gadgets.inventory.crate,3);for(let i=0;i<30&&g.player.y>-1.2;i++)g.step(DT,{x:0,z:1});assert(g.player.y<-1);assert.equal(g.action('crate'),false);assert.equal(g.gadgets.crates.length,0);
 const justJumped=start();jump(justJumped,.06);assert(justJumped.player.y>.3&&justJumped.player.y<1.25);assert.equal(justJumped.action('crate'),false);assert.equal(justJumped.gadgets.inventory.crate,3);
});

test('nine jump-and-crate steps climb past three layers, exhaust inventory and still enforce nine active boxes',()=>{
 const g=start();grantItems(g,{crate:6});let previous=0;for(let i=0;i<9;i++){jump(g);assert(g.action('crate'));const box=g.gadgets.crates[i];assert.equal(box.airborne,true);assert.equal(box.platformId,null);assert.equal(box.stackLevel,1);assert(g.player.y>previous+1.5);previous=g.player.y;tick(g,.02);assert.equal(g.player.ground,box.id);}
 assert.equal(g.gadgets.crates.length,9);assert.equal(g.gadgets.inventory.crate,0);assert(g.player.y>14);jump(g);assert.equal(g.action('crate'),false);grantItems(g,{crate:1});assert.equal(g.action('crate'),false);assert.equal(g.gadgets.inventory.crate,1);assert.equal(g.gadgets.crates.length,9);
});

test('pause preserves a suspended box while reset and death clear it without refunding inventory',()=>{
 const paused=start();jump(paused);paused.pause();const before=paused.snapshot();assert.equal(paused.action('crate'),false);tick(paused,1);assert.deepEqual(paused.snapshot(),before);paused.start();assert(paused.action('crate'));paused.pause();const caught=paused.snapshot();tick(paused,1);assert.deepEqual(paused.snapshot(),caught);paused.start();assert(paused.requestReset());assert.equal(paused.gadgets.crates.length,0);assert.equal(paused.gadgets.inventory.crate,2);assert.equal(paused.player.y,0);
 const died=start();jump(died);assert(died.action('crate'));died.fail();assert.equal(died.gadgets.crates.length,0);assert.equal(died.gadgets.inventory.crate,2);assert.equal(died.action('crate'),false);tick(died,.8);assert.equal(died.player.y,0);assert.equal(died.gadgets.inventory.crate,2);
});

test('static air crates expose top surfaces, solid sides and undersides and count as the first stack layer',()=>{
 const platform=floor(1,0,2.3,1.25,2,2,'airCrate',{h:1.25,baseY:0});const g=start({platforms:[floor(0),platform]});const solid=solidCrates(g).find(c=>c.id===1);assert.equal(solid.y,0);assert.equal(solid.h,1.25);tick(g,.6,{x:0,z:1});assert(g.player.z<=.88);assert.equal(g.player.y,0);assert(g.action('jump'));for(let i=0;i<200&&g.player.ground!==1;i++)g.step(DT,{x:0,z:Math.max(-1,Math.min(1,(2.3-g.player.z)*2))});assert.equal(g.player.ground,1);assert.equal(g.player.y,1.25);
 const stack=start({platforms:[floor(0),platform]});assert(stack.action('crate'));assert.equal(stack.gadgets.crates[0].platformId,1);assert.equal(stack.gadgets.crates[0].stackLevel,2);assert(stack.action('crate'));assert.equal(stack.gadgets.crates[1].stackLevel,3);assert.equal(stack.action('crate'),false);assert.equal(stack.gadgets.inventory.crate,1);
 const ceiling=start({platforms:[floor(0),floor(1,0,0,3.25,2,2,'airCrate',{h:1.25,baseY:2})]});assert(ceiling.action('jump'));let peak=0;for(let i=0;i<100;i++){ceiling.step(DT);peak=Math.max(peak,ceiling.player.y);}assert(peak<=.4+1e-6);assert.equal(ceiling.player.y,0);
});

test('a whole foot box cannot overlap the edge of an elevated floor even when the player fits beside it',()=>{
 const g=start({platforms:[floor(0),floor(1,1.8,0,1.4,2,8)]});jump(g);assert(g.player.x+.43<.8,'player is outside the raised floor footprint');const before=position(g);assert(g.player.y-1.25<1.4&&g.player.y>.8,'box would cross the raised floor slab');assert.equal(g.action('crate'),false);assert.equal(g.gadgets.inventory.crate,3);assert.equal(g.gadgets.crates.length,0);assert.deepEqual(position(g),before);
});

test('a normal descent below a high takeoff ledge can still be caught above lower safe ground',()=>{
 const g=start({spawn:{x:-3,z:0,y:4},platforms:[floor(0,-3,0,4,4,8),floor(1,4,0,0,8,8)]});
 for(let i=0;i<500;i++){g.step(DT,{x:1,z:0});if(g.player.ground===null&&g.player.vy<0&&g.player.y<3&&g.player.x>.1)break;}
 assert.equal(g.player.ground,null);assert(g.player.vy<0);assert(g.player.y<3&&g.player.y>1.25);const before=position(g);assert(g.action('crate'),'a lower landing is not rejected solely because takeoff was higher');assert.deepEqual(position(g),before);tick(g,.8);assert.equal(g.player.y,before.y);assert.equal(g.player.ground,g.gadgets.crates[0].id);assert.equal(g.falls,0);
});
