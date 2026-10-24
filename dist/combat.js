import {consumeShield} from './shields.js';
import {ENEMY_RANKS} from './enemies.js';
export const WEAPONS = {
  hammer: {name:'玩具锤', icon:'🔨', damage:2, range:3.1, cooldown:0, duration:.28, color:'#f8ba54'},
  launcher: {name:'泡泡发射器', icon:'◉', damage:1, range:24, cooldown:0, duration:.18, color:'#53bbec'},
  sword: {name:'能量剑', icon:'✦', damage:1, range:3.8, cooldown:0, duration:.2, color:'#b28bff'}
};
export const FISH_RANGE=4.2,FISH_SWING_DURATION=.42;

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function segmentBox(ax,az,bx,bz,box,padding=0){
  let start=0,end=1;
  for(const [origin,delta,min,max] of [[ax,bx-ax,box.x-box.w/2-padding,box.x+box.w/2+padding],[az,bz-az,box.z-box.d/2-padding,box.z+box.d/2+padding]]){
    if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;continue;}
    let near=(min-origin)/delta,far=(max-origin)/delta;
    if(near>far)[near,far]=[far,near];
    start=Math.max(start,near);end=Math.min(end,far);
    if(start>end)return false;
  }
  return true;
}

function blocked(game,from,to,padding=0,y=.8){
  for(const wall of game.level.walls||[]){
    if(y<wall.h&&(wall.y===undefined||y>=wall.y)&&segmentBox(from.x,from.z,to.x,to.z,wall,padding))return true;
  }
  for(const crate of game.gadgets?.crates||[]){
    if(y>=crate.y-1e-7&&y<crate.y+crate.h-1e-7&&segmentBox(from.x,from.z,to.x,to.z,crate,padding))return true;
  }
  for(const crate of game.level.platforms||[]){
    if(crate.type==='airCrate'&&y>=(crate.baseY??crate.y-(crate.h??1.25))-1e-7&&y<crate.y-1e-7&&segmentBox(from.x,from.z,to.x,to.z,crate,padding))return true;
  }
  for(const h of game.level.hazards||[]){
    if(h.type!=='gate'||Math.sin((game.time*h.speed+h.phase)*1.6)>.15||y>h.y+3.2)continue;
    const box={x:h.x,z:h.z,w:h.axis==='x'?.4:h.w,d:h.axis==='x'?h.w:.4};
    if(segmentBox(from.x,from.z,to.x,to.z,box,padding))return true;
  }
  return false;
}

function safe(game,point){
  if(distance(point,game.level.spawn)<4.6)return true;
  if(game.level.platforms.some(p=>p.checkpoint&&distance(point,p)<4.6))return true;
  return (game.level.portals||[]).some(p=>distance(point,p)<2.6);
}

function walkable(game,point){
  return !safe(game,point)&&game.level.platforms.some(p=>!['collapse','bounce'].includes(p.type)&&game.surface(p)&&Math.abs(point.x-p.x)<=p.w/2&&Math.abs(point.z-p.z)<=p.d/2);
}

export function initCombat(game,level){
  game.weapon=WEAPONS[game.weapon]?game.weapon:'hammer';
  game.defeatedMonsters=0;game.combatRespawns=0;game.projectiles=[];game.nextProjectileId=0;
  Object.assign(game.player,{health:3,maxHealth:3,attack:0,attackCd:0});
  game.monsters=(level.monsters||[]).map(spec=>{
    const rank=ENEMY_RANKS[spec.rank]?spec.rank:'normal',d=ENEMY_RANKS[rank],hp=spec.hp??((spec.type==='beetle'?3:2)+d.hpBonus);
    return {
      ...spec,rank,rankName:d.name,patrol:(spec.patrol||[{x:spec.x,z:spec.z}]).map(p=>({...p})),
      hp,maxHp:hp,speed:spec.speed??2*d.speedMultiplier,
      chaseSpeed:spec.chaseSpeed??(spec.speed===undefined?3.3*d.chaseMultiplier:spec.speed*1.5),
      contactDamage:spec.contactDamage??d.damage,shieldHP:spec.shieldHP??d.shield,shieldMax:spec.shieldMax??d.shield,
      state:'patrol',stun:0,hitFlash:0,defeated:false,faceX:0,faceZ:1,
      windup:0,dash:0,dashCooldown:2+(spec.id%3)*.5,chargeX:0,chargeZ:0,
      patrolIndex:0,patrolDirection:1,route:[],repath:0,provoked:0
    };
  });
  game.combatGrid=null;
  if(level.grid){
    const cell=level.cellSize,mid=(level.size-1)/2,nodes=new Map();
    for(const p of level.platforms){
      if(['collapse','bounce'].includes(p.type)||safe(game,p))continue;
      const cx=Math.round(p.x/cell+mid),cz=Math.round(p.z/cell+mid);
      nodes.set(`${cx},${cz}`,{x:p.x,z:p.z,cx,cz});
    }
    game.combatGrid={nodes,cell,mid};
  }
}

export function setWeapon(game,type){
  if(!WEAPONS[type]||game.status==='won'||game.respawnDelay)return false;
  game.weapon=type;game.player.attack=0;game.emit('weapon',{weapon:type});return true;
}

function hurtMonster(game,enemy,weapon,direction){
  if(enemy.defeated)return;
  const rank=ENEMY_RANKS[enemy.rank],shieldDamage=Math.min(enemy.shieldHP,weapon.damage),damage=weapon.damage-shieldDamage;
  enemy.shieldHP-=shieldDamage;enemy.hp=Math.max(0,enemy.hp-damage);enemy.hitFlash=.25;enemy.provoked=4;
  if(weapon.type==='hammer'||(!enemy.windup&&!enemy.dash)){
    enemy.stun=(weapon.type==='hammer'?.85:.25)*rank.stunScale;enemy.state='stunned';
    if(weapon.type==='hammer'){enemy.windup=0;enemy.dash=0;enemy.dashCooldown=Math.max(enemy.dashCooldown,1.8);}
  }
  const knock=(weapon.type==='hammer'?1.15:.3)*rank.knockScale;
  const target={x:enemy.x+direction.x*knock,z:enemy.z+direction.z*knock};
  if(walkable(game,target)&&!blocked(game,enemy,target,.35)){enemy.x=target.x;enemy.z=target.z;}
  game.emit('monsterHit',{id:enemy.id,x:enemy.x,z:enemy.z,damage,shieldDamage});
  if(enemy.hp===0){
    enemy.defeated=true;enemy.state='defeated';game.defeatedMonsters++;
    game.emit('monsterDefeated',{id:enemy.id,rank:enemy.rank,tier:enemy.tier,enemyName:enemy.enemyName,x:enemy.x,z:enemy.z});
  }
}

export function fishStrike(game){
  const p=game.player;if(p.health<=0)return false;
  const length=Math.hypot(p.faceX||0,p.faceZ||0),faceX=length>.001?p.faceX/length:0,faceZ=length>.001?p.faceZ/length:1;
  game.emit('fishStrike',{x:p.x,y:p.y??0,z:p.z,faceX,faceZ,range:FISH_RANGE});
  for(const enemy of game.monsters||[]){
    const d=distance(p,enemy),dot=d>.001?((enemy.x-p.x)*faceX+(enemy.z-p.z)*faceZ)/d:1;
    if(enemy.defeated||d>FISH_RANGE||dot<.1||Math.abs((p.y??0)-(enemy.y??0))>=2.3||blocked(game,p,enemy,0,(p.y??0)+.8))continue;
    const damage=enemy.hp,shieldDamage=enemy.shieldHP||0;
    enemy.hp=0;enemy.shieldHP=0;enemy.hitFlash=.6;enemy.stun=0;enemy.windup=0;enemy.dash=0;enemy.provoked=0;enemy.route=[];
    enemy.fishKnockback={x:d>.001?(enemy.x-p.x)/d:faceX,z:d>.001?(enemy.z-p.z)/d:faceZ};
    enemy.defeated=true;enemy.state='defeated';game.defeatedMonsters++;
    game.emit('monsterHit',{id:enemy.id,x:enemy.x,z:enemy.z,damage,shieldDamage,source:'fish'});
    game.emit('monsterDefeated',{id:enemy.id,rank:enemy.rank,tier:enemy.tier,enemyName:enemy.enemyName,x:enemy.x,z:enemy.z,source:'fish'});
  }
  return true;
}

export function attack(game){
  const p=game.player,weapon=WEAPONS[game.weapon];
  if(p.health<=0)return false;
  p.attack=weapon.duration;p.attackCd=0;game.actionCounts.attack++;
  const aimRange=game.weapon==='launcher'?14:weapon.range;
  const target=game.monsters.filter(m=>!m.defeated&&distance(p,m)<=aimRange&&Math.abs(p.y-(m.y||0))<2.3&&!blocked(game,p,m,0,p.y+.8)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(target){const d=distance(p,target);if(d>.001){p.faceX=(target.x-p.x)/d;p.faceZ=(target.z-p.z)/d;}}
  game.emit('attack',{weapon:game.weapon,x:p.x,z:p.z});
  if(game.weapon==='launcher'){
    const muzzle={x:p.x+p.faceX*.75,z:p.z+p.faceZ*.75};
    if(!blocked(game,p,muzzle,.2,p.y+.85))game.projectiles.push({id:game.nextProjectileId++,x:muzzle.x,z:muzzle.z,y:p.y+.85,vx:p.faceX*20,vz:p.faceZ*20,life:1.2,radius:.23,damage:weapon.damage});
    return true;
  }
  for(const enemy of game.monsters){
    const d=distance(p,enemy),facing=d<.01?1:((enemy.x-p.x)*p.faceX+(enemy.z-p.z)*p.faceZ)/d;
    if(!enemy.defeated&&d<=weapon.range&&facing>=-.1&&Math.abs(p.y-(enemy.y||0))<2.3&&!blocked(game,p,enemy,0,p.y+.8))hurtMonster(game,enemy,{...weapon,type:game.weapon},{x:p.faceX,z:p.faceZ});
  }
  return true;
}

function cellAt(grid,p){return `${Math.round(p.x/grid.cell+grid.mid)},${Math.round(p.z/grid.cell+grid.mid)}`;}

function routeToPlayer(game,enemy,goalPoint=game.player){
  const grid=game.combatGrid;
  if(!grid)return blocked(game,enemy,goalPoint,.4)?[]:[{x:goalPoint.x,z:goalPoint.z}];
  const start=cellAt(grid,enemy),goal=cellAt(grid,goalPoint);
  if(!grid.nodes.has(start)||!grid.nodes.has(goal))return [];
  if(start===goal)return [{x:goalPoint.x,z:goalPoint.z}];
  const queue=[start],parents=new Map([[start,null]]);
  for(let i=0;i<queue.length&&!parents.has(goal);i++){
    const node=grid.nodes.get(queue[i]);
    for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const key=`${node.cx+dx},${node.cz+dz}`;
      if(grid.nodes.has(key)&&!parents.has(key)){parents.set(key,queue[i]);queue.push(key);}
    }
  }
  if(!parents.has(goal))return [];
  const path=[];for(let key=goal;key!==start;key=parents.get(key))path.unshift(grid.nodes.get(key));
  return path;
}

function moveMonster(game,enemy,target,dt,speed){
  if(!target)return;
  const d=distance(enemy,target);if(d<.07)return;
  const travel=Math.min(d,dt*speed),dx=(target.x-enemy.x)/d,dz=(target.z-enemy.z)/d;
  const next={x:enemy.x+dx*travel,z:enemy.z+dz*travel};
  if(walkable(game,next)&&!blocked(game,enemy,next,.35)){enemy.x=next.x;enemy.z=next.z;enemy.faceX=dx;enemy.faceZ=dz;}
}

function patrol(game,enemy,dt){
  if(!enemy.patrol.length)return;
  let target=enemy.patrol[enemy.patrolIndex];
  if(distance(enemy,target)<.15&&enemy.patrol.length>1){
    if(enemy.patrolIndex===enemy.patrol.length-1)enemy.patrolDirection=-1;
    if(enemy.patrolIndex===0)enemy.patrolDirection=1;
    enemy.patrolIndex+=enemy.patrolDirection;target=enemy.patrol[enemy.patrolIndex];
  }
  // Chase may finish around a corner: return through the walkable grid rather than cutting through walls.
  if(blocked(game,enemy,target,.35)&&game.combatGrid){
    const route=routeToPlayer(game,enemy,target);
    moveMonster(game,enemy,route[0],dt,enemy.speed);return;
  }
  moveMonster(game,enemy,target,dt,enemy.speed);
}

function updateProjectiles(game,dt){
  game.projectiles=game.projectiles.filter(shot=>{
    shot.life-=dt;if(shot.life<=0)return false;
    const old={x:shot.x,z:shot.z},next={x:shot.x+shot.vx*dt,z:shot.z+shot.vz*dt};
    if(blocked(game,old,next,shot.radius,shot.y)){game.emit('projectilePop',{x:next.x,z:next.z,y:shot.y});return false;}
    let hit=null,first=Infinity;const dx=next.x-old.x,dz=next.z-old.z,length=dx*dx+dz*dz;
    for(const m of game.monsters){
      if(m.defeated||Math.abs(shot.y-((m.y||0)+.8))>1)continue;
      const t=length?clamp(((m.x-old.x)*dx+(m.z-old.z)*dz)/length,0,1):0;
      if(Math.hypot(old.x+dx*t-m.x,old.z+dz*t-m.z)<.65+shot.radius&&t<first){hit=m;first=t;}
    }
    if(hit){const speed=Math.hypot(shot.vx,shot.vz);hurtMonster(game,hit,{damage:shot.damage,type:'launcher'},{x:shot.vx/speed,z:shot.vz/speed});return false;}
    Object.assign(shot,next);return true;
  });
}

export function updateCombat(game,dt){
  updateProjectiles(game,dt);
  const p=game.player,playerSafe=safe(game,p);
  for(const enemy of game.monsters){
    enemy.hitFlash=Math.max(0,enemy.hitFlash-dt);enemy.stun=Math.max(0,enemy.stun-dt);enemy.provoked=Math.max(0,enemy.provoked-dt);
    if(enemy.defeated)continue;
    if(enemy.stun>0){enemy.state='stunned';continue;}
    const rank=ENEMY_RANKS[enemy.rank],d=distance(enemy,p),chase=!playerSafe&&p.y<2.4&&(d<(['chase','windup','dash'].includes(enemy.state)?rank.chaseRange:rank.detectRange)||enemy.provoked>0);
    enemy.dashCooldown=Math.max(0,enemy.dashCooldown-dt);
    if(enemy.windup>0){
      enemy.state='windup';enemy.windup=Math.max(0,enemy.windup-dt);
      if(!chase){enemy.windup=0;enemy.state='patrol';}
      else if(enemy.windup===0){enemy.dash=rank.dashDuration;enemy.state='dash';}
    }else if(enemy.dash>0){
      enemy.state='dash';enemy.dash=Math.max(0,enemy.dash-dt);
      const target={x:enemy.x+enemy.chargeX*rank.dashSpeed*dt,z:enemy.z+enemy.chargeZ*rank.dashSpeed*dt};
      if(!walkable(game,target)||blocked(game,enemy,target,.35)||playerSafe){enemy.dash=0;}
      else{enemy.x=target.x;enemy.z=target.z;}
      if(enemy.dash===0){enemy.state='chase';enemy.dashCooldown=rank.dashCooldown;enemy.route=[];enemy.repath=0;}
    }else if(chase){
      if(rank.windup&&enemy.dashCooldown<=0&&d>1.4&&d<8&&!blocked(game,enemy,p,.3)){
        enemy.windup=rank.windup;enemy.state='windup';enemy.chargeX=(p.x-enemy.x)/d;enemy.chargeZ=(p.z-enemy.z)/d;enemy.faceX=enemy.chargeX;enemy.faceZ=enemy.chargeZ;
        game.emit('enemyWarning',{id:enemy.id,rank:enemy.rank,tier:enemy.tier,enemyName:enemy.enemyName});
      }else{
        enemy.state='chase';enemy.repath-=dt;
        if(enemy.repath<=0||!enemy.route.length){enemy.route=routeToPlayer(game,enemy);enemy.repath=.35;}
        if(enemy.route.length&&distance(enemy,enemy.route[0])<.18)enemy.route.shift();
        moveMonster(game,enemy,enemy.route[0],dt,enemy.chaseSpeed);
      }
    }else{enemy.state='patrol';enemy.route=[];patrol(game,enemy,dt);}
    const contactRadius=1.03+(rank.scale-1)*.3;
    if(!playerSafe&&p.invuln<=0&&Math.abs(p.y-(enemy.y||0))<1.25&&distance(enemy,p)<contactRadius&&!blocked(game,enemy,p,0,p.y+.65)){
      if(consumeShield(game))continue;
      p.health=Math.max(0,p.health-enemy.contactDamage);p.invuln=1.2;
      const len=distance(enemy,p)||1,nx=(p.x-enemy.x)/len,nz=(p.z-enemy.z)/len;
      p.vx=nx*10;p.vz=nz*10;p.vy=4;p.ground=null;p.roll=0;p.dive=0;
      game.emit('damage',{health:p.health,id:enemy.id,rank:enemy.rank,damage:enemy.contactDamage});
      if(p.health===0){game.combatRespawns++;game.respawnDelay=.8;game.projectiles=[];game.emit('knockout');return;}
    }
  }
}
