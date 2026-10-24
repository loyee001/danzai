import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,COLLAPSE_TIMING,collapsePhase} from '../dist/engine.js';
const DT=1/120;
const level=()=>({id:1,code:'COLLAPSE',spawn:{x:0,y:0,z:0},spawnPlatform:0,platforms:[{id:0,x:0,z:0,y:0,w:4,d:8,type:'collapse'},{id:1,x:6,z:0,y:0,w:8,d:8,type:'plain'}],walls:[],hazards:[],beans:[],portals:[],monsters:[],shields:[],gadgetPickups:[],totalBeans:0,totalScore:0,requiredScore:100,bounds:{minX:-20,maxX:20,minZ:-20,maxZ:20}});
const start=()=>{const g=new Game(level());g.start();g.step(DT);return g;};
function advance(g,seconds,input={x:0,z:0}){const end=g.time+seconds;while(g.time<end-1e-10)g.step(Math.min(DT,end-g.time),input);}
function walk(g,x){for(let i=0;i<1000;i++){const d=x-g.player.x;if(Math.abs(d)<.08){advance(g,.1);return;}g.step(DT,{x:Math.max(-1,Math.min(1,d*2)),z:0});}assert.fail('walk did not reach target');}

test('shared collapse phases turn fully red at three, disappear at five and recover at nine seconds',()=>{
 assert.deepEqual(COLLAPSE_TIMING,{warning:3,fall:5,recover:9});assert(Object.isFrozen(COLLAPSE_TIMING));const g=start(),p=g.level.platforms[0],at=g.collapse.get(p.id);assert(Number.isFinite(at));
 for(const [age,phase,visible,progress]of [[0,'warning',true,0],[1.5,'warning',true,.5],[2.999,'warning',true,2.999/3],[3,'danger',true,1],[4.999,'danger',true,1],[5,'gone',false,1],[8.999,'gone',false,1],[9,'idle',true,0]]){const state=collapsePhase(g,p,at+age);assert.equal(state.phase,phase);assert.equal(state.visible,visible);assert.equal(g.surface(p,at+age),visible);assert(Math.abs(state.progress-progress)<1e-8);if(age<5)assert(Math.abs(state.remaining-(5-age))<1e-8);if(age>=5&&age<9)assert(Math.abs(state.recoveryRemaining-(9-age))<1e-8);}
});

test('standing on a cracked floor cannot extend its real five-second support window',()=>{
 const g=start(),p=g.level.platforms[0],at=g.collapse.get(p.id);advance(g,4.9);assert.equal(g.player.ground,p.id);assert.equal(g.player.y,0);assert.equal(g.collapse.get(p.id),at);assert.equal(collapsePhase(g,p).phase,'danger');advance(g,.11);assert.equal(g.surface(p),false);assert.equal(g.player.ground,null);assert(g.player.y<0);assert.equal(g.events.filter(e=>e.type==='crack').length,1);
});

test('leaving and returning before disappearance keeps the original timer; recovery starts a fresh contact cycle',()=>{
 const g=start(),p=g.level.platforms[0],first=g.collapse.get(p.id);walk(g,5);walk(g,0);assert.equal(g.collapse.get(p.id),first);walk(g,5);advance(g,first+9.01-g.time);assert.equal(g.surface(p),true);assert.equal(g.collapse.has(p.id),false);assert.equal(collapsePhase(g,p).phase,'idle');walk(g,0);assert(g.collapse.get(p.id)>first+9);assert.equal(g.events.filter(e=>e.type==='crack').length,2);
});

test('pause freezes all collapse phases and a manual reset clears the warning state',()=>{
 const g=start(),p=g.level.platforms[0];advance(g,2);g.pause();const time=g.time,phase=collapsePhase(g,p);for(let i=0;i<1200;i++)g.step(DT);assert.equal(g.time,time);assert.deepEqual(collapsePhase(g,p),phase);g.start();assert(g.requestReset());assert.equal(g.collapse.size,0);assert.equal(collapsePhase(g,p).phase,'idle');g.step(DT);assert(g.collapse.get(p.id)>time);assert.equal(collapsePhase(g,p).progress,0);
});

test('ordinary death respawns with collapse warnings cleared rather than carrying a nearly expired floor',()=>{
 const g=start();advance(g,4);g.fail();while(g.respawnDelay>0)g.step(DT);assert.equal(g.collapse.size,0);assert.equal(g.player.y,0);assert.equal(g.player.ground,0);assert.equal(collapsePhase(g,g.level.platforms[0]).phase,'idle');
});
