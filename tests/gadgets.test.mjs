import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {GADGETS,grantItems,useGadget,gadgetAction,resetGadgetEffects,snapshotGadgets} from '../dist/gadgets.js';
const DT=1/120;
const floor=(id,x=0,z=0,y=0,w=80,d=80)=>({id,x,z,y,w,d,type:'plain',checkpoint:false});
const fixture=(extra={})=>({id:1,code:'GADGET',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[floor(0)],walls:[],hazards:[],beans:[],portals:[],monsters:[],shields:[],totalBeans:0,totalScore:0,requiredScore:100,bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},...extra});
const tick=(g,t,input={x:0,z:0})=>{for(let i=0;i<t/DT;i++)g.step(DT,input);};
const start=extra=>{const g=new Game(fixture(extra));g.start();return g;};
const faceRight=g=>{tick(g,.02,{x:1,z:0});tick(g,.12);};
const enemy=(id,x,z,hp=30,extra={})=>({id,type:'beetle',x,z,y:0,hp,speed:2,chaseSpeed:2,patrol:[{x,z},{x,z:z+5}],...extra});
const islands=(extra={})=>({platforms:[floor(0,0,0,0,8,8),floor(1,18,0,2,8,8)],grappleAnchors:[{id:'landing',x:18,y:5.5,z:0,platformId:1}],...extra});

test('gadgets start with three each, grants obey caps and public snapshots cannot mutate live inventory or targets',()=>{
 const g=start();assert.deepEqual(g.gadgets.inventory,{jetpack:3,electricBox:3,grapple:3});assert.equal(gadgetAction(g,'not-a-gadget'),undefined);assert.equal(useGadget(g,'not-a-gadget'),false);for(const name of ['constructor','toString','__proto__']){assert.equal(gadgetAction(g,name),undefined);assert.equal(useGadget(g,name),false);}
 assert.deepEqual(grantItems(g,{jetpack:100,electricBox:1.9,grapple:-2}),{jetpack:6,electricBox:1,grapple:0});assert.deepEqual(g.gadgets.inventory,{jetpack:9,electricBox:4,grapple:3});assert.deepEqual(grantItems(g,{jetpack:NaN,electricBox:Infinity}),{jetpack:0,electricBox:0,grapple:0});
 const copy=snapshotGadgets(g);copy.inventory.jetpack=0;assert.equal(g.gadgets.inventory.jetpack,9);assert.equal(copy.limits.grapple,9);
});

test('an exhausted inventory rejects activation and a capped reward grants another real use',()=>{
 const g=start();for(let i=0;i<3;i++){assert(g.action('jetpack'));resetGadgetEffects(g);}assert.equal(g.gadgets.inventory.jetpack,0);assert.equal(g.action('jetpack'),false);assert.equal(g.gadgets.jetpack,null);assert.equal(grantItems(g,{jetpack:1}).jetpack,1);assert(g.action('jetpack'));assert.equal(g.gadgets.inventory.jetpack,0);tick(g,.2);assert(g.player.y>1);
});

test('jetpack consumes once, rises and moves under real input for five seconds without exceeding its ceiling',()=>{
 const g=start();assert(g.action('jetpack'));assert.equal(g.gadgets.inventory.jetpack,2);assert.equal(g.action('jetpack'),false);assert.equal(g.gadgets.inventory.jetpack,2);const cap=g.gadgets.jetpack.maxY;let peak=0;
 for(let i=0;i<599;i++){g.step(DT,{x:1,z:0});peak=Math.max(peak,g.player.y);assert(g.player.y<=cap+1e-6);}assert(g.gadgets.jetpack);assert(g.player.x>30);assert(peak>10);assert(g.player.y>10);
 tick(g,.03);assert.equal(g.gadgets.jetpack,null);const y=g.player.y;tick(g,.6);assert(g.player.y<y-1);assert.equal(g.gadgets.inventory.jetpack,2);
});

test('jetpack and electric timers freeze with pause and cannot be activated while waiting or paused',()=>{
 const ready=new Game(fixture());assert.equal(ready.action('jetpack'),false);ready.start();assert(ready.action('electricBox'));assert(ready.action('jetpack'));tick(ready,.3);ready.pause();const before=ready.snapshot();tick(ready,2,{x:1,z:0});assert.deepEqual(ready.snapshot(),before);assert.equal(ready.action('grapple'),false);ready.start();tick(ready,.1);assert(ready.gadgets.jetpack.remaining<before.gadgets.jetpack.remaining);
});

test('jetpack movement remains blocked by a tall wall and lava still causes physical failure',()=>{
 const wall=start({walls:[{x:3,z:0,w:1,d:80,h:20}]});assert(wall.action('jetpack'));tick(wall,2,{x:1,z:0});assert(wall.player.x<2.08);assert(wall.player.y>5);assert.equal(wall.falls,0);
 const lava=start({mode:'challenge',challenge:{id:'fixture',name:'fixture'},finishPortal:{x:50,z:50,y:0,radius:1},exitPortal:{x:-50,z:-50,y:0,radius:1},lavaZones:[{id:'raised-lava',x:6,z:0,y:5,w:6,d:10}]});assert(lava.action('jetpack'));for(let i=0;i<240&&!lava.falls;i++)lava.step(DT,{x:1,z:0});assert.equal(lava.falls,1);assert(lava.respawnDelay>0);assert.equal(lava.gadgets.jetpack,null);assert.equal(lava.gadgets.inventory.jetpack,2);
});

test('an electric box stuns moving enemies and deals eight spaced pulses over its eight-second lifetime without score',()=>{
 const g=start({monsters:[enemy(0,0,5)]});assert(g.action('electricBox'));assert.equal(g.gadgets.inventory.electricBox,2);const startZ=g.monsters[0].z;tick(g,.1);assert.equal(g.monsters[0].hp,29);assert(g.monsters[0].stun>0);tick(g,7.8);assert.equal(g.monsters[0].z,startZ);assert.equal(g.monsters[0].hp,22);assert.equal(g.score,0);assert.equal(g.defeatedMonsters,0);
 tick(g,.5);assert.equal(g.gadgets.electricBoxes.length,0);assert(g.monsters[0].z>startZ);assert.equal(g.events.filter(e=>e.type==='monsterHit'&&e.source==='electricBox').length,8);
});

test('electric damage uses armor first, records a defeat once and never damages through walls or outside its radius',()=>{
 const g=start({walls:[{x:1,z:5,w:.3,d:8,h:4}],monsters:[enemy(0,0,5,3,{shieldHP:2,shieldMax:2}),enemy(1,2,5,3),enemy(2,-12,5,3)]});assert(g.action('electricBox'));tick(g,.1);assert.equal(g.monsters[0].shieldHP,1);assert.equal(g.monsters[0].hp,3);tick(g,4.1);assert.equal(g.monsters[0].hp,0);assert.equal(g.monsters[0].defeated,true);assert.equal(g.defeatedMonsters,1);assert.equal(g.monsters[1].hp,3);assert.equal(g.monsters[2].hp,3);assert.equal(g.score,0);tick(g,1);assert.equal(g.defeatedMonsters,1);
});

test('electric placement requires safe ground, rejects blocked throws and works across tiled grass seams',()=>{
 const air=start();air.action('jump');tick(air,.1);assert.equal(air.action('electricBox'),false);assert.equal(air.gadgets.inventory.electricBox,3);
 const wall=start({platforms:[floor(0,0,0,0,8,8)],walls:[{x:0,z:1,w:8,d:.4,h:4}]});assert.equal(wall.action('electricBox'),false);assert.equal(wall.gadgets.inventory.electricBox,3);
 const grass=new Game(makeLevel(1));grass.start();assert(grass.action('electricBox'),'front placement finds a neighboring plain tile rather than rejecting a seam');assert.equal(grass.gadgets.electricBoxes.length,1);assert.equal(grass.score,0);
});

test('grapple locks a legal elevated landing and pulls continuously before normal landing',()=>{
 const g=start(islands());faceRight(g);const before={x:g.player.x,y:g.player.y,z:g.player.z};assert(g.action('grapple'));assert.equal(g.player.x,before.x,'activation itself does not teleport');assert.equal(g.gadgets.inventory.grapple,2);assert.deepEqual(g.gadgets.grapple.target,{x:18,y:2.08,z:0,platformId:1});assert.equal(g.gadgets.grapple.anchor.y,5.5);
 const snap=g.snapshot();snap.gadgets.grapple.target.x=500;assert.equal(g.gadgets.grapple.target.x,18);let previous={...g.player},steps=0;
 for(;steps<600&&(g.gadgets.grapple||g.player.ground!==1);steps++){g.step(DT);const moved=Math.hypot(g.player.x-previous.x,g.player.y-previous.y,g.player.z-previous.z);assert(moved<=GADGETS.grapple.speed*DT+.01,`continuous step ${moved}`);previous={...g.player};assert.equal(g.falls,0);}
 assert(steps>60&&steps<600);assert.equal(g.gadgets.grapple,null);assert.equal(g.player.ground,1);assert(Math.hypot(g.player.x-18,g.player.z)<.2);assert.equal(g.player.y,2);
});

test('grapple fails without inventory loss when every forward landing is void, lava, blocked or out of range',()=>{
 const cases=[{platforms:[floor(0,0,0,0,8,8)]},islands({walls:[{x:8,z:0,w:1,d:40,h:15}]}),islands({lavaZones:[{x:18,z:0,y:2,w:8,d:8}]}),{platforms:[floor(0,0,0,0,8,8),floor(1,45,0,0,8,8)],grappleAnchors:[{id:'far',x:45,y:3.5,z:0,platformId:1}]}];
 for(const spec of cases){const g=start(spec);faceRight(g);assert.equal(g.action('grapple'),false);assert.equal(g.gadgets.inventory.grapple,3);assert.equal(g.gadgets.grapple,null);}
});

test('grapple can be interrupted without another charge and the player falls naturally onto the original floor',()=>{
 const g=start(islands());faceRight(g);assert(g.action('grapple'));tick(g,.18);assert(g.player.y>1);assert(g.player.x<3.4);const x=g.player.x;assert(g.action('grapple'));assert.equal(g.gadgets.inventory.grapple,2);assert.equal(g.gadgets.grapple,null);tick(g,1);assert.equal(g.player.ground,0);assert.equal(g.player.y,0);assert(Math.abs(g.player.x-x)<.01);
});

test('a gate closing during the pull interrupts the grapple before the solid barrier',()=>{
 const g=start(islands({platforms:[floor(0,0,0,0,8,8),floor(1,18,0,0,8,8)],hazards:[{type:'gate',x:8,z:0,y:0,w:25,axis:'x',phase:1,speed:3}],grappleAnchors:[{id:'landing',x:18,y:3.5,z:0,platformId:1}]}));faceRight(g);g.level.hazards[0].phase=1-3*g.time;assert(g.action('grapple'));for(let i=0;i<180&&g.gadgets.grapple;i++)g.step(DT);assert.equal(g.gadgets.grapple,null);assert(g.player.x<7);assert.equal(g.gadgets.inventory.grapple,2);assert(g.events.some(e=>e.type==='gadgetEnd'&&e.gadget==='grapple'&&e.reason==='blocked'));
});

test('death and manual returns clear temporary effects without refunding charges, while a new map starts fresh',()=>{
 const g=start();assert(g.action('electricBox'));assert(g.action('jetpack'));g.respawn();assert.deepEqual(g.gadgets.inventory,{jetpack:2,electricBox:2,grapple:3});assert.equal(g.gadgets.jetpack,null);assert.equal(g.gadgets.electricBoxes.length,0);faceRight(g);assert(g.action('grapple'));g.fail();assert.equal(g.gadgets.grapple,null);assert.equal(g.gadgets.inventory.grapple,2);tick(g,.8);assert.deepEqual(g.gadgets.inventory,{jetpack:2,electricBox:2,grapple:2});resetGadgetEffects(g);assert.deepEqual(g.gadgets.inventory,{jetpack:2,electricBox:2,grapple:2});g.load(fixture({id:2}));assert.deepEqual(g.gadgets.inventory,{jetpack:3,electricBox:3,grapple:3});
});

test('a real enemy knockout immediately clears flight and boxes while preserving spent inventory',()=>{
 const g=start({spawn:{x:-8,z:0,y:0},monsters:[enemy(0,0,0,10,{speed:0,chaseSpeed:0})]});assert(g.action('electricBox'));for(let i=0;i<300&&g.player.x<-1.7;i++)g.step(DT,{x:1,z:0});tick(g,.2);assert.equal(g.player.invuln,0);assert.equal(g.player.health,3);g.player.health=1;assert(g.action('jetpack'));
 for(let i=0;i<120&&!g.respawnDelay;i++)g.step(DT,{x:1,z:0});assert.equal(g.combatRespawns,1);assert(g.respawnDelay>0);assert.equal(g.gadgets.jetpack,null);assert.equal(g.gadgets.electricBoxes.length,0);assert.deepEqual(g.gadgets.inventory,{jetpack:2,electricBox:2,grapple:3});tick(g,.9);assert.equal(g.player.health,3);assert.deepEqual(g.gadgets.inventory,{jetpack:2,electricBox:2,grapple:3});
});
