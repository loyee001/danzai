import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {AVATARS,DEFAULT_AVATAR,getAvatar} from '../dist/avatars.js';
import {Renderer} from '../dist/render.js';

test('eight original avatar descriptions are stable and have distinct costume geometry',()=>{
 assert.ok(AVATARS.length>=8);assert.equal(new Set(AVATARS.map(a=>a.id)).size,AVATARS.length);assert.equal(new Set(AVATARS.map(a=>a.hat)).size,AVATARS.length);
 for(const a of AVATARS){assert.ok(a.name&&a.icon);assert.match(a.color,/^#[a-f\d]{6}$/i);assert.match(a.accent,/^#[a-f\d]{6}$/i);assert.equal(getAvatar(a.id),a);}
 assert.equal(getAvatar('missing').id,DEFAULT_AVATAR);
 const renderer=Object.create(Renderer.prototype);renderer.character=renderer.makeEgg();renderer.makeWeapons();renderer.makePlayerShield();const signatures=new Set();
 for(const avatar of AVATARS){renderer.setAvatar(avatar.id);const pieces=[];renderer.avatarShell.traverse(o=>{if(o.isMesh)pieces.push([o.geometry.type,...o.position.toArray(),...o.scale.toArray()]);});signatures.add(JSON.stringify(pieces));}
 assert.equal(signatures.size,AVATARS.length);
});

test('switching avatar preserves the live player, weapons and shield and releases costume geometry',()=>{
 const renderer=Object.create(Renderer.prototype);renderer.character=renderer.makeEgg();renderer.character.position.set(3,2,-8);renderer.makeWeapons();renderer.makePlayerShield();renderer.scene=new T.Scene();renderer.makeGadgets();
 const gadgets=renderer.gadgetModels,grappleLine=renderer.grappleLine;
 assert.deepEqual([...gadgets.keys()].sort(),['crate','fish','grapple','jetpack']);assert(gadgets.get('crate').children.length>0,'held crate has its own visible geometry');assert(gadgets.get('fish').children.length>0,'held fish is a real three-dimensional item');
 const player=renderer.character,body=renderer.eggBody,weapon=renderer.weaponPivot,models=renderer.weaponModels,shield=renderer.playerShield,arc=renderer.swordArc;
 renderer.setAvatar('space');let released=0;renderer.avatarShell.traverse(o=>{if(o.geometry?.type==='TorusGeometry')o.geometry.addEventListener('dispose',()=>released++);});renderer.setAvatar('bunny');
 assert.equal(renderer.character,player);assert.equal(renderer.eggBody,body);assert.equal(renderer.weaponPivot,weapon);assert.equal(renderer.weaponModels,models);assert.equal(weapon.parent,body);assert.equal(renderer.playerShield,shield);assert.equal(shield.parent,player);assert.equal(renderer.swordArc,arc);assert.equal(renderer.gadgetModels,gadgets);assert.equal(renderer.grappleLine,grappleLine);assert.equal(gadgets.get('jetpack').parent,body);assert.deepEqual(player.position.toArray(),[3,2,-8]);assert.ok(released>0);
 assert.equal(renderer.setAvatar('invalid').id,DEFAULT_AVATAR);assert.equal(renderer.leftArm.parent,renderer.avatarShell);assert.equal(renderer.rightFoot.parent,renderer.avatarShell);
});

function makeRenderer(){
 const renderer=Object.create(Renderer.prototype);renderer.scene=new T.Scene();renderer.scene.background=new T.Color('#80d4ff');renderer.scene.fog=new T.Fog('#bdeaff',100,300);renderer.stage=new T.Group();renderer.scene.add(renderer.stage);renderer.camera=new T.PerspectiveCamera();renderer.character=renderer.makeEgg();renderer.makeWeapons();renderer.makePlayerShield();renderer.makeGadgets();renderer.monsterMeshes=new Map();renderer.particles=[];return renderer;
}
function withCanvas(fn){
 const previous=globalThis.document;globalThis.document={createElement(type){assert.equal(type,'canvas');const context=new Proxy({},{get:(target,key)=>target[key]??(()=>{})});return {getContext:()=>context};}};
 try{return fn();}finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
const gadgetGame=()=>({time:0,player:{x:0,y:0,z:0},gadgets:{selected:'jetpack',inventory:{jetpack:0,crate:0,grapple:0,fish:0},crates:[],jetpack:null,grapple:null,fishSwing:0},gadgetPickups:[]});

test('empty gadget inventories show no held item, while active flight, pull and fish swing stay visible',()=>{
 const renderer=makeRenderer(),game=gadgetGame();renderer.drawGadgets(game);assert([...renderer.gadgetModels.values()].every(m=>!m.visible));
 game.gadgets.selected='fish';game.gadgets.inventory.fish=1;renderer.drawGadgets(game);assert(renderer.gadgetModels.get('fish').visible);game.gadgets.inventory.fish=0;game.gadgets.fishSwing=.42;renderer.drawGadgets(game);assert(renderer.gadgetModels.get('fish').visible);const initial=renderer.gadgetModels.get('fish').rotation.toArray();game.gadgets.fishSwing=.21;game.time=.21;renderer.drawGadgets(game);assert.notDeepEqual(renderer.gadgetModels.get('fish').rotation.toArray(),initial);
 const frozen=renderer.gadgetModels.get('fish').rotation.toArray();renderer.drawGadgets(game);assert.deepEqual(renderer.gadgetModels.get('fish').rotation.toArray(),frozen);game.gadgets.fishSwing=0;renderer.drawGadgets(game);assert(!renderer.gadgetModels.get('fish').visible);
 game.gadgets.jetpack={remaining:1};game.gadgets.grapple={remaining:1,anchor:{x:4,y:4,z:4}};renderer.drawGadgets(game);assert(renderer.gadgetModels.get('jetpack').visible);assert(renderer.gadgetModels.get('grapple').visible);assert(renderer.grappleLine.visible);assert(renderer.grappleLock.visible);
});

test('four pickup models hover above their real floors, reuse labels, hide when collected and release resources on removal',()=>withCanvas(()=>{
 const renderer=makeRenderer(),game=gadgetGame();game.gadgetPickups=['jetpack','crate','grapple','fish'].map((gadget,i)=>({id:gadget,gadget,x:i*4,y:2,z:8,amount:i+1,available:true}));renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.size,4);
 for(const [i,pickup]of game.gadgetPickups.entries()){const view=renderer.gadgetPickupMeshes.get(pickup.id);assert(view.root.visible);assert.deepEqual(view.root.position.toArray(),[i*4,2,-8]);assert.equal(view.icon.position.y,.65);assert(view.icon.children.length>0);assert(view.captionText.endsWith('+'+(i+1)));}
 const fish=renderer.gadgetPickupMeshes.get('fish'),texture=fish.caption.material.map;game.time=.1;renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.get('fish'),fish);assert.equal(fish.caption.material.map,texture,'label texture is not rebuilt each frame');game.gadgetPickups[3].available=false;renderer.drawGadgets(game);assert(!fish.root.visible);game.gadgetPickups[3].available=true;renderer.drawGadgets(game);assert(fish.root.visible);
 let geometryDisposed=0,textureDisposed=0;fish.icon.traverse(o=>{if(o.geometry?.type==='ExtrudeGeometry')o.geometry.addEventListener('dispose',()=>geometryDisposed++);});texture.addEventListener('dispose',()=>textureDisposed++);game.gadgetPickups.pop();renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.size,3);assert.equal(fish.root.parent,null);assert.equal(geometryDisposed,1);assert.equal(textureDisposed,1);
 const crate=renderer.gadgetPickupMeshes.get('crate');let instanceDisposed=0;crate.icon.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>instanceDisposed++);});renderer.load({mode:'challenge',spawn:{x:0,z:0},platforms:[],walls:[],hazards:[],portals:[],monsters:[],beans:[]});assert.equal(instanceDisposed,3);assert.equal(renderer.gadgetPickupMeshes.size,0);assert.equal(renderer.grappleLine.visible,false);assert.equal(renderer.grappleLock.visible,false);
}));

test('a fish-defeated enemy flies away from its actual position and disappears without moving its collision state',()=>withCanvas(()=>{
 const renderer=makeRenderer(),monster={id:7,type:'slime',x:8,y:0,z:5,hp:0,maxHp:2,rank:'normal',defeated:true,fishKnockback:{x:1,z:0}},game={monsters:[monster]};renderer.drawMonsters(game,.1,0);
 const view=renderer.monsterMeshes.get(7);assert(view.root.visible);assert(Math.abs(view.root.position.x-8.9)<1e-9);assert.equal(view.root.position.z,-5);assert(view.actor.position.y>0);assert(view.actor.rotation.x>0);assert(!view.health.visible);assert(!view.status.visible);assert.deepEqual({x:monster.x,y:monster.y,z:monster.z},{x:8,y:0,z:5});
 renderer.drawMonsters(game,.81,.81);assert(!view.root.visible);assert(renderer.particles.length<=180);
}));

test('airborne placed crates retain their physical box bounds while lightweight cyan markers animate and dispose',()=>{
 const renderer=makeRenderer(),game=gadgetGame(),crate={id:'crate-air',x:4,y:3,z:8,w:2,d:2,h:1.25,airborne:true};game.gadgets.crates=[crate];renderer.drawGadgets(game);
 const view=renderer.crateMeshes.get(crate.id),effect=view.root.userData.floatEffect;assert.equal(view.airborne,true);assert(effect);assert.equal(view.root.getObjectByName('air-crate-float').children.length,3);assert.deepEqual(view.root.position.toArray(),[4,3,-8]);view.root.updateMatrixWorld(true);
 const bodyBounds=new T.Box3().setFromObject(view.root.children[0]),size=bodyBounds.getSize(new T.Vector3());assert.deepEqual(size.toArray(),[2,1.25,2]);assert.equal(bodyBounds.min.y,3);assert.equal(bodyBounds.max.y,4.25);assert.equal(effect.halo.material.color.getHexString(),'7bf3ff');
 const originalOpacity=effect.halo.material.opacity;game.time=.3;renderer.drawGadgets(game);assert.notEqual(effect.halo.material.opacity,originalOpacity);const frozen=effect.halo.material.opacity;renderer.drawGadgets(game);assert.equal(effect.halo.material.opacity,frozen);assert.deepEqual(view.root.position.toArray(),[4,3,-8],'hover feedback must not move the solid body');
 const geometries=new Set(),materials=new Set();let geometryDisposed=0,materialDisposed=0,instancesDisposed=0;view.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material?.isMeshBasicMaterial)materials.add(o.material);if(o.isInstancedMesh)o.addEventListener('dispose',()=>instancesDisposed++);});for(const g of geometries)g.addEventListener('dispose',()=>geometryDisposed++);for(const m of materials)m.addEventListener('dispose',()=>materialDisposed++);
 crate.airborne=false;renderer.drawGadgets(game);assert.equal(view.root.parent,null);assert.equal(geometryDisposed,geometries.size);assert.equal(materialDisposed,materials.size);assert.equal(instancesDisposed,3);const ordinary=renderer.crateMeshes.get(crate.id);assert.notEqual(ordinary,view);assert(!ordinary.root.userData.floatEffect);game.gadgets.crates=[];renderer.drawGadgets(game);assert.equal(ordinary.root.parent,null);assert.equal(renderer.crateMeshes.size,0);
});

test('legacy route signs are not rendered while collapse cracks and countdowns keep working',()=>withCanvas(()=>{
 const renderer=makeRenderer(),floor={id:0,x:0,z:0,y:0,w:8,d:8,type:'plain'},trap={id:1,x:7,z:0,y:.2,w:3,d:3,type:'collapse',decoy:true};
 const sign={id:'fork-sign',x:4.5,z:1,y:0,text:'近路？先看裂纹',color:'#fff1ba'},level={mode:'challenge',spawn:{x:0,z:0},platforms:[floor,trap],walls:[],hazards:[],portals:[],monsters:[],beans:[],signs:[sign]};
 renderer.load(level);const platform=renderer.platformMeshes.get(trap.id);assert.equal(renderer.routeSignMeshes.size,0);assert.equal(renderer.stage.getObjectByName('route-sign'),undefined);assert(platform.getObjectByName('collapse-cracks').children.length>=2);
 const game={level,time:0,collapse:new Map(),surface:()=>true};renderer.drawPlatforms(game);assert(platform.visible);game.time=3.1;game.collapse.set(trap.id,0);renderer.drawPlatforms(game);const view=platform.userData.collapseView;assert(view.caption.visible);game.time=5.01;game.surface=q=>q.id!==trap.id;renderer.drawPlatforms(game);assert(!platform.visible);
 let disposed=0;view.caption.material.map.addEventListener('dispose',()=>disposed++);renderer.load({...level,platforms:[],signs:[]});assert.equal(renderer.routeSignMeshes.size,0);assert.equal(disposed,1);
}));

test('challenge airCrate platforms render as wooden landing boxes at baseY and keep their top aligned after every draw',()=>{
 const renderer=makeRenderer(),platforms=[{id:0,x:0,z:0,y:0,w:8,d:8,type:'plain'},{id:1,x:6,z:8,y:5,baseY:3.75,w:2,d:2,h:1.25,type:'airCrate'},{id:2,x:10,z:14,y:8,w:2,d:2,h:1.25,type:'airCrate'}],level={mode:'challenge',spawn:{x:0,z:0},platforms,walls:[],hazards:[],portals:[],monsters:[],beans:[]};renderer.load(level);
 assert.equal(renderer.platformMeshes.size,3);for(const p of platforms.slice(1)){const root=renderer.platformMeshes.get(p.id);assert(root.userData.floatEffect);assert.equal(root.children[0].geometry.type,'BoxGeometry');assert.equal(root.children[0].material.color.getHexString(),'d3a167');assert.equal(root.position.y,p.y-p.h);assert.equal(root.children.filter(o=>o.isSprite).length,0,'many air boxes must not create large floating labels');}
 const game={level,time:.2,collapse:new Map(),surface:()=>true};renderer.drawPlatforms(game);for(const p of platforms.slice(1)){const root=renderer.platformMeshes.get(p.id);root.updateMatrixWorld(true);assert.equal(new T.Box3().setFromObject(root.children[0]).max.y,p.y,'rendered landing surface matches physics top');assert.deepEqual(root.position.toArray(),[p.x,p.y-p.h,-p.z]);}
 let disposedGeometry=0,disposedMaterial=0,disposedInstances=0;const root=renderer.platformMeshes.get(1),geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material?.isMeshBasicMaterial)materials.add(o.material);if(o.isInstancedMesh)o.addEventListener('dispose',()=>disposedInstances++);});for(const g of geometries)g.addEventListener('dispose',()=>disposedGeometry++);for(const m of materials)m.addEventListener('dispose',()=>disposedMaterial++);renderer.load({...level,platforms:[]});assert.equal(disposedGeometry,geometries.size);assert.equal(disposedMaterial,materials.size);assert.equal(disposedInstances,3);assert.equal(renderer.platformMeshes.size,0);
});

test('world rewards reuse gadget geometry with a golden ring and rebuild only when their reward amount or marker changes',()=>withCanvas(()=>{
 const renderer=makeRenderer(),game=gadgetGame(),pickup={id:'reward-box',gadget:'crate',amount:1,x:3,y:0,z:5,available:true};game.gadgetPickups=[pickup];renderer.drawGadgets(game);const normal=renderer.gadgetPickupMeshes.get(pickup.id);let disposed=0;normal.caption.material.map.addEventListener('dispose',()=>disposed++);pickup.reward=true;pickup.amount=2;renderer.drawGadgets(game);const reward=renderer.gadgetPickupMeshes.get(pickup.id);assert.notEqual(reward,normal);assert.equal(normal.root.parent,null);assert.equal(disposed,1);assert.equal(reward.captionText,'通关奖励 · 垫脚箱 +2');assert.equal(reward.ring.material.color.getHexString(),'ffd15d');assert(reward.icon.children.length>0);assert.equal(game.gadgets.inventory.crate,0,'rendering a world reward never grants it directly');renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.get(pickup.id),reward);pickup.available=false;renderer.drawGadgets(game);assert(!reward.root.visible);pickup.available=true;pickup.amount=4;renderer.drawGadgets(game);assert.equal(renderer.gadgetPickupMeshes.get(pickup.id).captionText,'通关奖励 · 垫脚箱 +4');
}));
