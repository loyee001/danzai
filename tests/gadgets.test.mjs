import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {GADGETS,grantItems,useGadget,gadgetAction,resetGadgetEffects,snapshotGadgets,replenishGadgetPickups} from '../dist/gadgets.js';
const DT=1/120;
const floor=(id,x=0,z=0,y=0,w=80,d=80)=>({id,x,z,y,w,d,type:'plain',checkpoint:false});
const fixture=(extra={})=>({id:1,code:'GADGET',spawn:{x:0,z:0,y:0},spawnPlatform:0,platforms:[floor(0)],walls:[],hazards:[],beans:[],portals:[],monsters:[],shields:[],gadgetPickups:[],totalBeans:0,totalScore:0,requiredScore:100,bounds:{minX:-60,maxX:60,minZ:-60,maxZ:60},...extra});
const tick=(g,t,input={x:0,z:0})=>{for(let i=0;i<t/DT;i++)g.step(DT,input);};
const start=extra=>{const g=new Game(fixture(extra));g.start();grantItems(g,{jetpack:3,crate:3,grapple:3});return g;};
const faceRight=g=>{tick(g,.02,{x:1,z:0});tick(g,.12);};
const enemy=(id,x,z,hp=30,extra={})=>({id,type:'beetle',x,z,y:0,hp,speed:2,chaseSpeed:2,patrol:[{x,z},{x,z:z+5}],...extra});
const islands=(extra={})=>({platforms:[floor(0,0,0,0,8,8),floor(1,18,0,2,8,8)],grappleAnchors:[{id:'landing',x:18,y:5.5,z:0,platformId:1}],...extra});

test('all four gadgets start empty, explicit grants obey caps and snapshots are isolated',()=>{
 const g=new Game(fixture());g.start();assert.deepEqual(g.gadgets.inventory,{jetpack:0,crate:0,grapple:0,fish:0});for(const spec of Object.values(GADGETS))assert.equal(spec.initial,0);
 assert.equal(gadgetAction(g,'not-a-gadget'),undefined);assert.equal(useGadget(g,'not-a-gadget'),false);for(const name of ['constructor','toString','__proto__']){assert.equal(gadgetAction(g,name),undefined);assert.equal(useGadget(g,name),false);}
 for(const key of Object.keys(GADGETS))assert.equal(g.action(key),false,'empty inventory cannot use a gadget');
 assert.deepEqual(grantItems(g,{jetpack:100,crate:1.9,grapple:-2,fish:2}),{jetpack:9,crate:1,grapple:0,fish:2});assert.deepEqual(g.gadgets.inventory,{jetpack:9,crate:1,grapple:0,fish:2});assert.deepEqual(grantItems(g,{jetpack:NaN,crate:Infinity}),{jetpack:0,crate:0,grapple:0,fish:0});
 const copy=snapshotGadgets(g);copy.inventory.jetpack=0;assert.equal(g.gadgets.inventory.jetpack,9);assert.equal(copy.limits.fish,9);
});

test('an exhausted inventory rejects activation and a capped reward grants another real use',()=>{
 const g=start();for(let i=0;i<3;i++){assert(g.action('jetpack'));resetGadgetEffects(g);}assert.equal(g.gadgets.inventory.jetpack,0);assert.equal(g.action('jetpack'),false);assert.equal(g.gadgets.jetpack,null);assert.equal(grantItems(g,{jetpack:1}).jetpack,1);assert(g.action('jetpack'));assert.equal(g.gadgets.inventory.jetpack,0);tick(g,.2);assert(g.player.y>1);
});

test('jetpack consumes once, rises and moves under real input for five seconds without exceeding its ceiling',()=>{
 const g=start();assert(g.action('jetpack'));assert.equal(g.gadgets.inventory.jetpack,2);assert.equal(g.action('jetpack'),false);assert.equal(g.gadgets.inventory.jetpack,2);const cap=g.gadgets.jetpack.maxY;let peak=0;
 for(let i=0;i<599;i++){g.step(DT,{x:1,z:0});peak=Math.max(peak,g.player.y);assert(g.player.y<=cap+1e-6);}assert(g.gadgets.jetpack);assert(g.player.x>30);assert(peak>10);assert(g.player.y>10);
 tick(g,.03);assert.equal(g.gadgets.jetpack,null);const y=g.player.y;tick(g,.6);assert(g.player.y<y-1);assert.equal(g.gadgets.inventory.jetpack,2);
});

test('jetpack time and placed crates freeze with pause and actions reject waiting or paused games',()=>{
 const ready=new Game(fixture());assert.equal(ready.action('jetpack'),false);ready.start();grantItems(ready,{crate:1,jetpack:1});assert(ready.action('crate'));assert(ready.action('jetpack'));tick(ready,.3);ready.pause();const before=ready.snapshot();tick(ready,2,{x:1,z:0});assert.deepEqual(ready.snapshot(),before);assert.equal(ready.action('grapple'),false);ready.start();tick(ready,.1);assert(ready.gadgets.jetpack.remaining<before.gadgets.jetpack.remaining);
});

test('jetpack movement remains blocked by a tall wall and lava still causes physical failure',()=>{
 const wall=start({walls:[{x:3,z:0,w:1,d:80,h:20}]});assert(wall.action('jetpack'));tick(wall,2,{x:1,z:0});assert(wall.player.x<2.08);assert(wall.player.y>5);assert.equal(wall.falls,0);
 const lava=start({mode:'challenge',challenge:{id:'fixture',name:'fixture'},finishPortal:{x:50,z:50,y:0,radius:1},exitPortal:{x:-50,z:-50,y:0,radius:1},lavaZones:[{id:'raised-lava',x:6,z:0,y:5,w:6,d:10}]});assert(lava.action('jetpack'));for(let i=0;i<240&&!lava.falls;i++)lava.step(DT,{x:1,z:0});assert.equal(lava.falls,1);assert(lava.respawnDelay>0);assert.equal(lava.gadgets.jetpack,null);assert.equal(lava.gadgets.inventory.jetpack,2);
});

function moveTo(game,target,limit=1200){
 for(let i=0;i<limit;i++){
  const dx=target.x-game.player.x,dz=target.z-game.player.z;
  if(Math.hypot(dx,dz)<.08){tick(game,.12);return true;}
  game.step(DT,{x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))});
  if(game.respawnDelay)return false;
 }
 return false;
}
function jumpOnto(game,crate){
 assert(game.action('jump'));
 for(let i=0;i<360;i++){
  const dx=crate.x-game.player.x,dz=crate.z-game.player.z;
  game.step(DT,{x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))});
  if(game.player.ground===crate.id){tick(game,.15);return true;}
  if(game.respawnDelay)return false;
 }
 return false;
}

test('a crate costs one item and physically blocks walking, supports a jump and raises the next jump',()=>{
 const g=start();assert(g.action('crate'));assert.equal(g.gadgets.inventory.crate,2);assert.equal(g.gadgets.crates.length,1);
 const crate=g.gadgets.crates[0];assert.match(crate.id,/^crate-\d+$/);assert.equal(crate.y,0);assert.equal(crate.w,2);assert.equal(crate.d,2);assert.equal(crate.h,1.25);assert.equal(crate.platformId,0);
 tick(g,1,{x:0,z:1});assert(g.player.z<=crate.z-crate.d/2-.42,'solid front face blocks forward motion');assert.equal(g.player.y,0);
 assert(jumpOnto(g,crate),'actual jump reaches the crate top');assert.equal(g.player.y,1.25);assert.equal(g.player.ground,crate.id);
 tick(g,.5);assert.equal(g.player.y,1.25);assert.equal(g.player.ground,crate.id,'standing is stable');
 assert(g.action('jump'));let peak=g.player.y;for(let i=0;i<130;i++){g.step(DT);peak=Math.max(peak,g.player.y);}assert(peak>3.2,'jumping from the box gains its physical height');assert.equal(g.player.ground,crate.id);assert.equal(g.gadgets.inventory.crate,2);
 const snapshot=g.snapshot();snapshot.gadgets.crates[0].y=99;assert.equal(crate.y,0,'snapshot boxes cannot mutate collision data');
});

test('repeated placement stacks three supported layers and a fourth layer is rejected without a charge',()=>{
 const g=start();grantItems(g,{crate:6});for(let i=0;i<3;i++)assert(g.action('crate'));
 const crates=g.gadgets.crates;assert.equal(crates.length,3);assert.deepEqual(crates.map(c=>c.y),[0,1.25,2.5]);assert.equal(new Set(crates.map(c=>c.id)).size,3);
 assert(crates.every(c=>c.x===crates[0].x&&c.z===crates[0].z));assert.deepEqual(crates.map(c=>c.platformId),[0,crates[0].id,crates[1].id]);
 const before=g.gadgets.inventory.crate,starts=g.events.filter(e=>e.type==='gadgetStart').length;assert.equal(g.action('crate'),false);assert.equal(g.gadgets.inventory.crate,before);assert.equal(g.gadgets.crates.length,3);assert.equal(g.events.filter(e=>e.type==='gadgetStart').length,starts);
});

test('standing on a crate can place another safe box without lifting or embedding the player',()=>{
 const g=start();assert(g.action('crate'));const first=g.gadgets.crates[0];assert(jumpOnto(g,first));
 const before={x:g.player.x,y:g.player.y,z:g.player.z};assert(g.action('crate'));assert.equal(g.gadgets.inventory.crate,1);assert.equal(g.gadgets.crates.length,2);
 assert.deepEqual({x:g.player.x,y:g.player.y,z:g.player.z},before,'placing never teleports or lifts the player');
 const box=g.gadgets.crates[1],overlapXZ=Math.abs(g.player.x-box.x)<box.w/2+.43&&Math.abs(g.player.z-box.z)<box.d/2+.43;
 assert(!overlapXZ||g.player.y>=box.y+box.h||g.player.y+1.6<=box.y,'new box does not enclose the player');tick(g,.3);assert.equal(g.player.ground,first.id);
});

test('placed crates have no damage, stun pulses or eight-second expiry',()=>{
 const g=start({monsters:[enemy(0,3.7,2.3,30,{speed:0,chaseSpeed:0,shieldHP:2,shieldMax:2})]});assert(g.action('crate'));const before=JSON.stringify(g.gadgets.crates);tick(g,10);
 assert.equal(JSON.stringify(g.gadgets.crates),before);assert.equal(g.monsters[0].hp,30);assert.equal(g.monsters[0].shieldHP,2);assert.equal(g.monsters[0].stun,0);assert.notEqual(g.monsters[0].state,'stunned');assert.equal(g.score,0);assert.equal(g.defeatedMonsters,0);assert.equal(g.gadgets.inventory.crate,2);
 assert(!g.events.some(e=>e.type==='gadgetPulse'||e.type==='monsterHit'||e.type==='monsterDefeated'));
});

test('a solid crate blocks bubbles and melee hits aimed at a nearby enemy behind it',()=>{
 for(const weapon of ['launcher','sword']){
  const g=start({monsters:[enemy(0,0,4.1,30,{speed:0,chaseSpeed:0})]});assert(g.action('crate'));tick(g,1,{x:0,z:1});assert(Math.hypot(g.player.x,g.player.z-4.1)<3.8);
  g.setWeapon(weapon);for(let i=0;i<4;i++)assert(g.action('attack'));tick(g,.5);assert.equal(g.monsters[0].hp,30,`${weapon} cannot pass through a crate`);assert.equal(g.projectiles.length,0);assert.equal(g.defeatedMonsters,0);
 }
});

test('a pursuing monster stops before a crate rather than walking through its solid footprint',()=>{
 const g=start({spawn:{x:-8,z:0,y:0},monsters:[enemy(0,0,16,30,{patrol:[{x:0,z:16},{x:0,z:-4}]})]});assert(moveTo(g,{x:0,z:0}));tick(g,.02,{x:0,z:1});tick(g,.12);assert(g.action('crate'));const box=g.gadgets.crates[0],before=g.monsters[0].z;
 tick(g,10);assert(g.monsters[0].z<before,'monster actually approaches along its route');assert(g.monsters[0].z>=box.z+box.d/2+.34,'monster remains outside the far box face');assert.equal(g.player.health,3);assert.equal(g.combatRespawns,0);
});

test('a player standing on the crate top is above a nearby ground monster contact hit',()=>{
 const g=start({spawn:{x:-8,z:0,y:0},monsters:[enemy(0,0,4.15,30,{speed:0,chaseSpeed:0})]});assert(moveTo(g,{x:0,z:0}));tick(g,.02,{x:0,z:1});tick(g,.12);assert(g.action('crate'));const box=g.gadgets.crates[0];assert(jumpOnto(g,box));assert(moveTo(g,{x:box.x,z:box.z+.96}));tick(g,2);
 assert.equal(g.player.ground,box.id);assert.equal(g.player.y,1.25);assert(Math.hypot(g.player.x-g.monsters[0].x,g.player.z-g.monsters[0].z)<1.03);assert.equal(g.player.invuln,0);assert.equal(g.player.health,3);assert(!g.events.some(e=>e.type==='damage'));
});

test('crate placement rejects air, walls, lava and unsupported footprints without spending, but spans grass seams',()=>{
 const air=start();air.action('jump');tick(air,.1);assert.equal(air.action('crate'),false);assert.equal(air.gadgets.inventory.crate,3);
 const cases=[
  {walls:[{x:0,z:1,w:80,d:.4,h:4}]},
  {lavaZones:[{id:'no-box',x:0,z:3,y:0,w:12,d:4}]},
  {platforms:[floor(0,0,0,0,4,2)]},
  {hazards:[{type:'gate',x:0,z:2.3,y:0,w:12,axis:'z',phase:1,speed:0}]},
  {portals:[{id:0,target:1,x:0,z:2.3,y:0,radius:1.2,platformId:0},{id:1,target:0,x:18,z:0,y:0,radius:1.2,platformId:0}]},
  {challengePortals:[{id:'challenge-test',challengeId:'lava',x:0,z:2.3,y:0,radius:1.4}]},
  {exitPortal:{id:'exit',x:0,z:2.3,y:0,radius:1.25}},
  {finishPortal:{id:'finish',x:0,z:2.3,y:0,radius:1.5}},
  {monsters:[enemy(0,0,2.3,30,{speed:0,chaseSpeed:0})]},
  {platforms:[floor(0,0,0,0,2,.5),floor(1,0,1.2,0,2,2)]}
 ];
 for(const spec of cases){const g=start(spec);assert.equal(g.action('crate'),false,`unsafe placement: ${JSON.stringify(spec)}`);assert.equal(g.gadgets.inventory.crate,3);assert.equal(g.gadgets.crates.length,0);assert(!g.events.some(e=>e.type==='gadgetStart'));}
 const grass=new Game(makeLevel(1));grass.start();grantItems(grass,{crate:1});assert(grass.action('crate'),'box footprint can span adjacent grass tiles');assert.equal(grass.gadgets.crates.length,1);assert.equal(grass.score,0);
});

test('nine placed boxes remain the active cap even after inventory is replenished',()=>{
 const g=start();grantItems(g,{crate:6});
 for(const x of [0,8,16]){if(x){assert(moveTo(g,{x,z:0}));tick(g,.02,{x:0,z:1});tick(g,.12);}for(let i=0;i<3;i++)assert(g.action('crate'));}
 assert.equal(g.gadgets.crates.length,9);assert.equal(g.gadgets.inventory.crate,0);grantItems(g,{crate:1});assert(moveTo(g,{x:24,z:0}));tick(g,.02,{x:0,z:1});tick(g,.12);assert.equal(g.action('crate'),false);assert.equal(g.gadgets.inventory.crate,1);assert.equal(g.gadgets.crates.length,9);
});

test('walking through a paired portal clears placed boxes without returning inventory',()=>{
 const g=start({portals:[{id:0,target:1,x:0,z:8,y:0,radius:1.2,platformId:0},{id:1,target:0,x:18,z:0,y:0,radius:1.2,platformId:0}]});assert(g.action('crate'));assert(moveTo(g,{x:4,z:0}));assert(moveTo(g,{x:4,z:8}));
 for(let i=0;i<300&&!g.portalUses;i++)g.step(DT,{x:-1,z:0});assert.equal(g.portalUses,1);assert.equal(g.gadgets.crates.length,0);assert.equal(g.gadgets.inventory.crate,2);assert(Math.hypot(g.player.x-18,g.player.z)<.2);
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

test('death and manual returns clear temporary effects without refunding charges, while a new map starts empty',()=>{
 const g=start();assert(g.action('crate'));assert(g.action('jetpack'));g.respawn();assert.deepEqual(g.gadgets.inventory,{jetpack:2,crate:2,grapple:3,fish:0});assert.equal(g.gadgets.jetpack,null);assert.equal(g.gadgets.crates.length,0);faceRight(g);assert(g.action('grapple'));g.fail();assert.equal(g.gadgets.grapple,null);assert.equal(g.gadgets.inventory.grapple,2);tick(g,.8);assert.deepEqual(g.gadgets.inventory,{jetpack:2,crate:2,grapple:2,fish:0});resetGadgetEffects(g);assert.deepEqual(g.gadgets.inventory,{jetpack:2,crate:2,grapple:2,fish:0});g.load(fixture({id:2}));assert.deepEqual(g.gadgets.inventory,{jetpack:0,crate:0,grapple:0,fish:0});
});

test('a real enemy knockout immediately clears flight and boxes while preserving spent inventory',()=>{
 const g=start({spawn:{x:-8,z:0,y:0},monsters:[enemy(0,0,0,10,{speed:0,chaseSpeed:0})]});assert(g.action('crate'));for(let i=0;i<300&&g.player.x<-1.7;i++)g.step(DT,{x:1,z:0});tick(g,.2);assert.equal(g.player.invuln,0);assert.equal(g.player.health,3);g.player.health=1;assert(g.action('jetpack'));
 for(let i=0;i<120&&!g.respawnDelay;i++)g.step(DT,{x:1,z:0});assert.equal(g.combatRespawns,1);assert(g.respawnDelay>0);assert.equal(g.gadgets.jetpack,null);assert.equal(g.gadgets.crates.length,0);assert.deepEqual(g.gadgets.inventory,{jetpack:2,crate:2,grapple:3,fish:0});tick(g,.9);assert.equal(g.player.health,3);assert.deepEqual(g.gadgets.inventory,{jetpack:2,crate:2,grapple:3,fish:0});
});

const emptyGame=extra=>{const g=new Game(fixture(extra));g.start();return g;};
const pickup=(id,gadget,x,z=0,amount=1,y=0)=>({id,gadget,x,y,z,amount});

test('walking to all four world supplies adds inventory exactly once and emits actual collected amounts',()=>{
 const source=Object.keys(GADGETS).map((key,i)=>pickup(`supply-${key}`,key,(i+1)*3));
 const g=emptyGame({gadgetPickups:source});tick(g,.5);assert(Object.values(g.gadgets.inventory).every(n=>n===0));
 for(const [i,key]of Object.keys(GADGETS).entries()){assert(moveTo(g,{x:(i+1)*3,z:0}));assert.equal(g.gadgets.inventory[key],1);assert.equal(g.gadgetPickups[i].available,false);}
 assert(moveTo(g,{x:0,z:0}));assert.deepEqual(g.gadgets.inventory,{jetpack:1,crate:1,grapple:1,fish:1});
 const events=g.events.filter(e=>e.type==='gadgetCollected');assert.equal(events.length,4);assert.deepEqual(events.map(e=>[e.gadget,e.amount,e.x,e.y,e.z]),source.map(p=>[p.gadget,1,p.x,p.y,p.z]));
 assert(source.every(p=>p.available===undefined),'level supply data stays immutable');const snap=g.snapshot();snap.gadgetPickups[0].available=true;assert.equal(g.gadgetPickups[0].available,false);
});

test('full bags leave a supply visible, pause cannot collect and replenishing changes the map without directly awarding items',()=>{
 const g=emptyGame({gadgetPickups:[pickup('fish','fish',3)]});grantItems(g,{fish:9});assert(moveTo(g,{x:3,z:0}));assert.equal(g.gadgetPickups[0].available,true);assert.equal(g.events.filter(e=>e.type==='gadgetCollected').length,0);
 g.pause();assert.equal(g.action('fish'),false);tick(g,1);assert.equal(g.gadgetPickups[0].available,true);g.start();assert(g.action('fish'));tick(g,DT);assert.equal(g.gadgets.inventory.fish,9);assert.equal(g.gadgetPickups[0].available,false);
 const inventory={...g.gadgets.inventory};assert.equal(replenishGadgetPickups(g),1);assert.deepEqual(g.gadgets.inventory,inventory);assert.equal(g.gadgetPickups[0].available,true);assert.equal(g.replenishGadgetPickups(),0);tick(g,.2);assert.equal(g.gadgetPickups[0].available,true,'full inventory still cannot consume restored supply');
 assert(g.action('fish'));g.pause();tick(g,1);assert.equal(g.gadgets.inventory.fish,8);assert.equal(g.gadgetPickups[0].available,true);g.start();tick(g,DT);assert.equal(g.gadgets.inventory.fish,9);assert.equal(g.gadgetPickups[0].available,false);
});

test('a supply above the player is collected only after an actual jump reaches its height range',()=>{
 const g=emptyGame({gadgetPickups:[pickup('high','jetpack',3,0,1,3.4)]});assert(moveTo(g,{x:3,z:0}));tick(g,.3);assert.equal(g.gadgets.inventory.jetpack,0);assert(g.action('jump'));
 for(let i=0;i<120&&!g.gadgets.inventory.jetpack;i++)g.step(DT);assert.equal(g.gadgets.inventory.jetpack,1);assert(g.player.y>2.1);
});

test('a picked-up fish is consumed by one real action, defeats a nearby shielded enemy and never adds bean score',()=>{
 const g=emptyGame({gadgetPickups:[pickup('fish','fish',2)],monsters:[enemy(0,8,0,1000,{speed:0,chaseSpeed:0,shieldHP:2,shieldMax:2})]});assert.equal(g.action('fish'),false);assert(moveTo(g,{x:4.3,z:0}));assert.equal(g.gadgets.inventory.fish,1);assert(g.action('fish'));assert.equal(g.gadgets.inventory.fish,0);assert.equal(g.action('fish'),false);assert.equal(g.monsters[0].defeated,true);assert.equal(g.monsters[0].hp,0);assert.equal(g.monsters[0].shieldHP,0);assert.equal(g.defeatedMonsters,1);assert.equal(g.score,0);assert.equal(g.gadgets.fishSwing,.42);
 g.pause();tick(g,1);assert.equal(g.gadgets.fishSwing,.42);g.start();tick(g,.43);assert.equal(g.gadgets.fishSwing,0);assert.equal(g.events.filter(e=>e.type==='gadgetStart'&&e.gadget==='fish').length,1);
});

test('ordinary map supplies are deterministic, safe, off spawn and put every gadget near the start',()=>{
 for(const id of [1,100,101,1000]){
  const g=new Game(makeLevel(id)),other=new Game(makeLevel(id));assert.deepEqual(g.gadgetPickups,other.gadgetPickups);assert(g.gadgetPickups.length>=8);
  for(const type of Object.keys(GADGETS)){const nearby=g.gadgetPickups.find(p=>p.gadget===type&&Math.hypot(p.x-g.level.spawn.x,p.z-g.level.spawn.z)<=12);assert(nearby,`${id} has a nearby ${type}`);}
  for(const p of g.gadgetPickups){assert(Math.hypot(p.x-g.level.spawn.x,p.z-g.level.spawn.z)>=2.4);const support=g.level.platforms.find(q=>q.id===p.platformId);assert(['plain','checkpoint'].includes(support.type));assert.equal(p.y,support.y);assert((g.level.challengePortals||[]).every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=q.radius+1.5));assert((g.level.portals||[]).every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=q.radius+1.5));}
  g.start();tick(g,.2);assert(Object.values(g.gadgets.inventory).every(n=>n===0));
 }
});
