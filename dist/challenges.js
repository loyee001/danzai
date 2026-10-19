export const CHALLENGES=Object.freeze([
 {id:'lava',name:'别踩岩浆',color:'#ff7853',instruction:'跳过岩浆，踩上发光检查点，再进入金色终点门。'},
 {id:'platforms',name:'机关跳台',color:'#8f87ff',instruction:'观察旋转杆和节拍门，跳过会碎的平台，走到终点。'},
 {id:'grapple',name:'空中钩爪',color:'#42cfee',instruction:'面朝下一座岛的发光抓点，使用钩爪跨越大缺口。'}
]);
const separation=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function withChallengePortals(level){
 if(level.mode==='challenge'||!level.arena?.open)return level;
 if(level.challengePortals?.length===CHALLENGES.length)return level;
 const selected=[],first=level.beans?.[0],mechanics=level.platforms.filter(p=>!['plain','checkpoint'].includes(p.type));
 const targets=[{x:-10.2,z:6.8},{x:0,z:13.6},{x:10.2,z:6.8}];
 for(const [index,challenge]of CHALLENGES.entries()){
  const options=level.platforms.filter(p=>p.type==='plain'&&separation(p,level.spawn)>=6&&separation(p,level.spawn)<=22&&(level.beans||[]).every(b=>separation(p,b)>(b.radius??.6)+2)&&(!first||separation(p,first)>5)&&(level.portals||[]).every(q=>separation(p,q)>5)&&(level.shields||[]).every(q=>separation(p,q)>4)&&mechanics.every(q=>separation(p,q)>5)&&(level.monsters||[]).every(q=>separation(p,q)>4.6)&&selected.every(q=>separation(p,q)>6));
  const p=options.sort((a,b)=>separation(a,targets[index])-separation(b,targets[index])||a.id-b.id)[0];
  if(!p)continue;
  selected.push({id:`challenge-${challenge.id}`,challengeId:challenge.id,name:challenge.name,label:`闯关入口 · ${challenge.name}`,x:p.x,z:p.z,y:p.y,radius:1.4,color:challenge.color,platformId:p.id});
 }
 return {...level,mode:'arena',challengePortals:selected};
}

export function makeChallenge(baseLevel,id){
 const definition=CHALLENGES.find(c=>c.id===id);if(!definition)throw new RangeError('未知闯关场景');
 const platforms=[],hazards=[],grappleAnchors=[];
 const add=(x,z,y,w,d,type='plain',checkpoint=false,extra={})=>{const p={id:platforms.length,x,z,y,w,d,type:checkpoint?'checkpoint':type,checkpoint,phase:0,speed:.8,dir:1,axis:'z',...extra};platforms.push(p);return p;};
 if(id==='lava'){
  add(0,0,0,10,9,'plain',true);add(0,9,0,5.5,5.5);add(4,16,.3,5.5,5.5);add(-1,23,.6,7,6,'plain',true);
  add(-4,31,.6,5.5,5.5);add(2,38,1,5.5,5.5);add(0,46,1,7,6,'plain',true);add(0,55,1,10,8);
 }else if(id==='platforms'){
  add(0,0,0,10,9,'plain',true);add(0,8,.3,7,6);add(5,16,.8,6,6,'collapse');add(1,24,1,8,7,'plain',true);
  add(-5,33,1,7,6,'moving',false,{amp:1.2});add(0,42,1.2,8,7);add(4,50,1.2,7,6,'plain',true);add(0,59,1.2,10,8);
  hazards.push({id:0,type:'sweeper',x:0,z:8,y:.3,w:4.4,phase:0,speed:.8,range:0,radius:.5,axis:'z'},{id:1,type:'gate',x:0,z:42,y:1.2,w:5,phase:1,speed:.8,range:0,radius:.5,axis:'z'});
 }else{
  add(0,0,0,11,10,'plain',true);add(0,18,1,8,8,'plain',true);add(7,36,2,8,8,'plain',true);add(-5,54,1,11,10);
  for(const p of platforms)grappleAnchors.push({id:`anchor-${p.id}`,x:p.x,z:p.z,y:p.y+3.5,platformId:p.id});
 }
 const finish=platforms.at(-1),size=id==='grapple'?53:43,cellSize=3.4,mid=(size-1)/2;
 for(const p of platforms){p.cx=Math.round(p.x/cellSize+mid);p.cz=Math.round(p.z/cellSize+mid);}
 const grid=Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>Number(platforms.some(p=>Math.abs((x-mid)*cellSize-p.x)<=p.w/2&&Math.abs((z-mid)*cellSize-p.z)<=p.d/2))));
 const exitPortal={id:'challenge-exit',x:-3.5,z:-1.5,y:0,radius:1.25,color:'#7cc8ed',label:'退出闯关 · 返回草坪'};
 const finishPortal={id:'challenge-finish',x:finish.x,z:finish.z+1,y:finish.y,radius:1.5,color:'#ffd060',label:'终点 · 返回草坪'};
 return {id:baseLevel.id,code:`${baseLevel.code} / ${definition.id}`,chapter:baseLevel.chapter??0,worldIndex:baseLevel.worldIndex??0,world:baseLevel.world,title:definition.name,layout:definition.name,mode:'challenge',challenge:{...definition,baseLevelId:baseLevel.id},size,cellSize,grid,platforms,walls:[],hazards,beans:[],totalBeans:0,totalScore:0,requiredScore:1,penaltyTotal:0,monsters:[],enemyTier:baseLevel.enemyTier??1,shields:[],portals:[],challengePortals:[],landmarks:[],signs:[],spawn:{x:0,z:0,y:0},spawnPlatform:0,arena:{open:false,grassColor:'#99d679',edgeColor:'#5d584d'},lavaZones:[{id:'lava',x:0,z:finish.z/2,y:-.35,w:64,d:finish.z+24}],exitPortal,finishPortal,grappleAnchors,routeWaypoints:platforms.map(p=>({x:p.x,z:p.z,y:p.y,platformId:p.id,checkpoint:p.checkpoint})),bounds:{minX:-34,maxX:34,minZ:-14,maxZ:finish.z+14},difficulty:id==='lava'?2:3,hint:definition.instruction,mechanics:id==='platforms'?['sweeper','collapse','moving','gate']:id==='grapple'?['grapple']:['lava']};
}
