export function initShields(game,level){
  game.player.shield=0;game.shieldsCollected=0;game.shieldsUsed=0;
  game.shieldPickups=(level.shields||[]).map(p=>({...p,respawn:p.respawn??100,available:true,respawnAt:0}));
}

export function refreshShields(game){
  for(const pickup of game.shieldPickups){
    if(!pickup.available&&game.time+1e-8>=pickup.respawnAt){
      pickup.available=true;pickup.respawnAt=0;game.emit('shieldReady',{id:pickup.id});
    }
  }
}

export function collectShield(game){
  const p=game.player;
  if(p.shield||p.health<=0)return;
  const pickup=game.shieldPickups.find(s=>s.available&&Math.hypot(p.x-s.x,p.z-s.z)<.95&&Math.abs(p.y+.75-s.y)<1.6);
  if(!pickup)return;
  p.shield=1;pickup.available=false;pickup.respawnAt=game.time+pickup.respawn;game.shieldsCollected++;
  game.emit('shieldCollected',{id:pickup.id,x:p.x,z:p.z});
}

export function consumeShield(game){
  if(!game.player.shield)return false;
  game.player.shield=0;game.player.invuln=.65;game.shieldsUsed++;
  game.emit('shieldUsed',{x:game.player.x,z:game.player.z});
  return true;
}
