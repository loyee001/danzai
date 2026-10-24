import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../dist/engine.js';
import {makeLevel} from '../dist/levels.js';
import {CHALLENGES} from '../dist/challenges.js';
const DT=1/120;
const fixture=()=>({id:1,code:'RESET',spawn:{x:0,y:0,z:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:80,d:80,type:'plain'}],walls:[],hazards:[],beans:[],portals:[],monsters:[],shields:[],gadgetPickups:[],totalBeans:0,totalScore:0,requiredScore:100,bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40}});
const tick=(g,seconds,input={x:0,z:0})=>{for(let i=0;i<Math.ceil(seconds/DT);i++)g.step(DT,input);};
function moveTo(g,target,limit=2400){for(let i=0;i<limit;i++){const dx=target.x-g.player.x,dz=target.z-g.player.z;if(Math.hypot(dx,dz)<.08){tick(g,.12);return true;}g.step(DT,{x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))});if(g.respawnDelay)return false;}return false;}
function enter(g,id){const portal=g.level.challengePortals.find(p=>p.challengeId===id);for(let i=0;i<2400&&g.level.mode!=='challenge';i++){const dx=portal.x-g.player.x,dz=portal.z-g.player.z;g.step(DT,{x:Math.max(-1,Math.min(1,dx*2)),z:Math.max(-1,Math.min(1,dz*2))});}assert.equal(g.level.mode,'challenge');}

test('reset is a playing-only explicit action, returns to safety and cannot repeat during its ten seconds',()=>{
 const g=new Game(fixture());assert.equal(g.requestReset(),false);assert.equal(g.action('reset'),false);g.start();assert(moveTo(g,{x:6,z:0}));assert.equal(g.requestReset(),true);assert.equal(g.player.x,0);assert.equal(g.player.z,0);assert.equal(g.player.health,3);assert.equal(g.resetCooldown,10);assert.equal(g.snapshot().resetCooldown,10);assert.equal(g.action('reset'),false);
 tick(g,9.9);assert(g.resetCooldown>0);assert.equal(g.requestReset(),false);tick(g,.11);assert.equal(g.resetCooldown,0);assert.equal(g.action('reset'),true);assert.equal(g.resetCooldown,10);assert.equal(g.events.filter(e=>e.type==='reset').length,2);
});

test('pause freezes reset cooldown, death neither clears it nor blocks normal countdown and respawn delay rejects reset',()=>{
 const g=new Game(fixture());g.start();assert(g.requestReset());tick(g,2);const remaining=g.resetCooldown;g.pause();tick(g,20);assert.equal(g.resetCooldown,remaining);assert.equal(g.requestReset(),false);g.start();g.fail();assert.equal(g.resetCooldown,remaining);assert.equal(g.requestReset(),false);tick(g,.8);assert.equal(g.respawnDelay,0);assert(g.resetCooldown>remaining-.82&&g.resetCooldown<remaining-.78);assert.equal(g.requestReset(),false);
});

test('challenge entry, retry and exit share reset cooldown instead of restoring an older timer',()=>{
 const g=new Game({...makeLevel(1),beans:[],requiredScore:10000,gadgetPickups:[]});g.start();enter(g,'lava');assert(g.requestReset());tick(g,1);const beforeRetry=g.resetCooldown;assert(g.retryChallenge());assert.equal(g.resetCooldown,beforeRetry);tick(g,.2);const beforeExit=g.resetCooldown;assert(g.exitChallenge());assert.equal(g.resetCooldown,beforeExit);assert.equal(g.requestReset(),false);tick(g,g.resetCooldown+.02);assert.equal(g.resetCooldown,0);assert(g.requestReset());
});

test('choosing any of fifty challenges changes a gate without entering and is available while paused or ready',()=>{
 const g=new Game({...makeLevel(1),beans:[],requiredScore:10000,gadgetPickups:[]});const chosen=CHALLENGES.at(-1);assert(g.chooseChallenge(chosen.id));assert.equal(g.status,'ready');assert.equal(g.level.mode,'arena');assert.equal(g.level.challengePortals[0].challengeId,chosen.id);assert.equal(g.chooseChallenge('missing'),false);g.start();g.pause();assert(g.chooseChallenge(CHALLENGES[20].id));assert.equal(g.status,'paused');assert.equal(g.level.challengePortals[0].challengeId,CHALLENGES[20].id);assert(g.events.some(e=>e.type==='challengeSelected'&&e.challengeId===CHALLENGES[20].id));
});

test('selecting while standing in a different gate locks its replacement until the player walks outside',()=>{
 const g=new Game({...makeLevel(1),beans:[],requiredScore:10000,gadgetPickups:[]});g.start();enter(g,'lava');assert(g.exitChallenge());g.pause();const target=CHALLENGES.at(-1);assert(g.chooseChallenge(target.id));const locked=g._challengeEntryLock;assert(locked);g.start();tick(g,.3);assert.equal(g.level.mode,'arena','selection cannot silently enter a gate under the player');const portal=g.level.challengePortals.find(p=>p.id===locked);assert(moveTo(g,{x:portal.x-4,z:portal.z}));assert.equal(g._challengeEntryLock,null);enter(g,target.id);assert.equal(g.level.challenge.id,target.id);assert.equal(g.chooseChallenge('lava'),false);
});
