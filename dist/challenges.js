const THEMES=[
 {id:'lava',color:'#ff7853',grass:'#dd9c63',names:['别踩岩浆','熔河折返','火山石阵','赤焰回廊','熔岩终极跃'],instruction:'跳过岩浆，踩亮检查点，再走进金色终点门。'},
 {id:'clockwork',color:'#8f87ff',grass:'#a9a1db',names:['机关跳台','齿轮转角','钟摆工坊','节拍长廊','机关大合奏'],instruction:'看准旋转杆和节拍门的空隙；宽台侧边也有安全路线。'},
 {id:'sky',color:'#42cfee',grass:'#8dd9e8',names:['空中钩爪','云岛接力','彩虹天梯','风云渡口','天空远征'],instruction:'先拾取钩爪，再面朝下一岛抓点使用。空中垫箱 · 跳起按 X；左侧悬空木箱可落脚，再跳回检查点岛。'},
 {id:'garden',color:'#70bd71',grass:'#97d984',names:['花园曲径','花瓣折线','蘑菇小径','绿野回旋','花园巡游'],instruction:'沿左右交错的花园平台前进，先稳住落点，再继续跳跃。'},
 {id:'ice',color:'#73bbf3',grass:'#bae9ef',names:['冰晶小路','雪原弯道','蓝冰浮台','极光冰桥','雪山试炼'],instruction:'冰面刹车较慢，提早转向；在普通平台和检查点调整方向。'},
 {id:'wind',color:'#5ec2bc',grass:'#a2d9ba',names:['风车草坡','侧风走廊','微风折返','阵风山谷','风车大巡回'],instruction:'宽台上的风会横向推人；逆着风调整，再从边缘起跳。'},
 {id:'conveyor',color:'#e9bd4e',grass:'#ddce89',names:['搬运工厂','传送带弯道','双色流水线','搬运接力','工厂穿梭'],instruction:'传送带会推着你横移；选准出口方向，跳到下一块稳定平台。'},
 {id:'ruins',color:'#c58e6a',grass:'#cab08b',names:['古迹碎石','遗迹折桥','摇摇石径','荒原浮石','遗迹逃脱'],instruction:'裂纹平台踩上后会短暂消失，及时跳走；检查点始终稳定。'},
 {id:'bridges',color:'#a57bdc',grass:'#bba6dd',names:['云桥试航','短桥长渡','紫云交错','双桥接力','云桥终章'],instruction:'小缺口用跳跃，大缺口先拾取钩爪；抓点和检查点标出下一段方向。'},
 {id:'summit',color:'#df91b8',grass:'#e9b4cf',names:['登高练习','粉云阶梯','高塔折返','星光攀登','登顶五十关'],instruction:'沿逐渐升高的平台登顶，利用检查点休整；拾取的道具可帮助你前进。'}
];
export const CHALLENGES=Object.freeze(Array.from({length:50},(_,index)=>{
 const theme=THEMES[index%10],number=index+1,variant=Math.floor(index/10);
 return Object.freeze({number,id:index<3?['lava','platforms','grapple'][index]:`challenge-${String(number).padStart(2,'0')}`,name:theme.names[variant],theme:theme.id,color:theme.color,instruction:theme.instruction});
}));
const byId=new Map(CHALLENGES.map(c=>[c.id,c]));
const DEFAULT_ENTRANCES=['lava','platforms','grapple'];
const separation=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const round=n=>Math.round(n*1000)/1000;

export function withChallengePortals(level,{challengeIds}={}){
 if(level.mode==='challenge'||!level.arena?.open)return level;
 if(challengeIds===undefined&&level.challengePortals?.length===3&&level.challengePortals.every(p=>byId.has(p.challengeId)))return level;
 const ids=[];for(const id of (challengeIds??DEFAULT_ENTRANCES).slice(0,3)){if(!byId.has(id))throw new RangeError('未知闯关入口');if(!ids.includes(id))ids.push(id);}
 for(const id of DEFAULT_ENTRANCES)if(ids.length<3&&!ids.includes(id))ids.push(id);
 const selected=[],first=level.beans?.[0],mechanics=level.platforms.filter(p=>!['plain','checkpoint'].includes(p.type));
 const targets=[{x:-10.2,z:6.8},{x:0,z:13.6},{x:10.2,z:6.8}];
 for(const [index,id]of ids.entries()){
  const challenge=byId.get(id);
  const options=level.platforms.filter(p=>p.type==='plain'&&separation(p,level.spawn)>=6&&separation(p,level.spawn)<=22&&(level.beans||[]).every(b=>separation(p,b)>(b.radius??.6)+2)&&(!first||separation(p,first)>5)&&(level.portals||[]).every(q=>separation(p,q)>5)&&(level.shields||[]).every(q=>separation(p,q)>4)&&mechanics.every(q=>separation(p,q)>5)&&(level.monsters||[]).every(q=>separation(p,q)>4.6)&&selected.every(q=>separation(p,q)>6));
  const p=options.sort((a,b)=>separation(a,targets[index])-separation(b,targets[index])||a.id-b.id)[0];
  if(!p)continue;
  selected.push({id:`challenge-${challenge.id}`,challengeId:challenge.id,number:challenge.number,name:challenge.name,label:`闯关入口 · ${challenge.number}/50 ${challenge.name}`,x:p.x,z:p.z,y:p.y,radius:1.4,color:challenge.color,platformId:p.id});
 }
 return {...level,mode:'arena',challengePortals:selected};
}

export function makeChallenge(baseLevel,id){
 const definition=byId.get(id);if(!definition)throw new RangeError('未知闯关场景');
 const theme=THEMES[(definition.number-1)%10],variant=Math.floor((definition.number-1)/10);
 const platforms=[],hazards=[],grappleAnchors=[],gadgetPickups=[],routeSegments=[];
 const add=(x,z,y,w,d,type='plain',checkpoint=false,extra={})=>{const p={id:platforms.length,x:round(x),z:round(z),y:round(y),w,d,type:checkpoint?'checkpoint':type,checkpoint,phase:0,speed:.8,dir:1,axis:'z',...extra};platforms.push(p);return p;};
 if(id==='lava'){
  add(0,0,0,10,9,'plain',true);add(0,9,0,5.5,5.5);add(4,16,.3,5.5,5.5);add(-1,23,.6,7,6,'plain',true);
  add(-4,31,.6,5.5,5.5);add(2,38,1,5.5,5.5);add(0,46,1,7,6,'plain',true);add(0,55,1,10,8);
 }else if(id==='platforms'){
  add(0,0,0,10,9,'plain',true);add(0,8,.3,7,6);add(5,16,.8,6,6,'collapse');add(1,24,1,8,7,'plain',true);
  add(-5,33,1,7,6,'moving',false,{amp:1.2});add(0,42,1.2,8,7);add(4,50,1.2,7,6,'plain',true);add(0,59,1.2,10,8);
  hazards.push({id:0,type:'sweeper',x:0,z:8,y:.3,w:4.4,phase:0,speed:.8,range:0,radius:.5,axis:'z'},{id:1,type:'gate',x:0,z:42,y:1.2,w:5,phase:1,speed:.8,range:0,radius:.5,axis:'z'});
 }else if(id==='grapple'){
  add(0,0,0,11,10,'plain',true);add(0,18,1,8,8,'plain',true);add(7,36,2,8,8,'plain',true);add(-5,54,1,11,10);
 }else{
  const sky=theme.id==='sky',mixed=theme.id==='bridges',count=(sky?4:8)+variant+(definition.number%3);
  add(0,0,0,11,10,'plain',true);
  for(let i=1;i<count;i++){
   const last=i===count-1,prior=platforms.at(-1),wide=['ice','wind','conveyor','clockwork'].includes(theme.id);
   const w=last?11:sky||mixed?8.8:wide?10.2:7.2+(variant%2)*.6,d=last?8:sky?8:7;
   const long=sky||mixed&&i%2===0,gap=1.05+(variant%3)*.18;
   const x=round(Math.sin(i*(.82+variant*.13)+(definition.number%10)*.31)*(3.4+variant*.55));
   const z=prior.z+(long?18+(variant%3)*.7:(prior.d+d)/2+gap);
   const y=theme.id==='summit'?i*.5:sky?((i+variant)%3)*.65:round((Math.floor(i/3)%2)*.4+(variant%2)*.15);
   const sourceForGrapple=sky||mixed&&i%2===1;
   const checkpoint=!last&&(sourceForGrapple||i%3===0);
   let type='plain';if(!last&&!checkpoint){if(theme.id==='ice')type=i%2?'ice':'plain';if(theme.id==='wind'&&i%3===1)type='wind';if(theme.id==='conveyor'&&i%3===1)type='conveyor';if(theme.id==='ruins'&&i%3===1||theme.id==='clockwork'&&i%4===2)type='collapse';if(theme.id==='clockwork'&&i%4===0)type='moving';}
   const p=add(x,z,y,w,d,type,checkpoint,{phase:variant*.6+i*.27,speed:.65+variant*.06,amp:type==='moving'?.8:0,axis:'x',dir:i%2?1:-1});
   if(theme.id==='clockwork'&&!last&&!checkpoint&&i%4===1)hazards.push({id:hazards.length,type:i%8===1?'sweeper':'gate',x:p.x,z:p.z,y:p.y,w:4.4,phase:variant*.35,speed:.65+variant*.05,range:0,radius:.5,axis:'z'});
  }
 }
 for(let i=0;i<platforms.length-1;i++){
  const from=platforms[i],to=platforms[i+1],grapple=theme.id==='sky'||theme.id==='bridges'&&(i+1)%2===0;
  routeSegments.push({from:from.id,to:to.id,kind:grapple?'grapple':'jump'});
  if(grapple){from.checkpoint=true;from.type='checkpoint';gadgetPickups.push({id:`${id}-grapple-${i}`,x:round(from.x+1.8),z:from.z,y:from.y,gadget:'grapple',amount:1,platformId:from.id});}
 }
 for(const p of platforms)if(routeSegments.some(s=>s.kind==='grapple'&&s.to===p.id))grappleAnchors.push({id:`anchor-${p.id}`,x:p.x,z:p.z,y:p.y+3.5,platformId:p.id});
 // Optional tools are on safe platforms. The ordinary jump route never requires a paid refill.
 const optional=theme.id==='sky'?'fish':theme.id==='summit'?'jetpack':definition.number%2?'crate':'fish';
 gadgetPickups.push({id:`${id}-supply`,x:0,z:2.2,y:0,gadget:optional,amount:1,platformId:0});
 const primaryPlatforms=[...platforms],finish=primaryPlatforms.at(-1),optionalRoutes=[],decoyRoutes=[],shortcutRoutes=[],portals=[],signs=[],cellSize=3.4;
 if(theme.id==='sky'){
  const island=primaryPlatforms[1],height=variant*.15;
  const first=add(island.x-9.5,island.z-10.2,2.3+height,2,2,'airCrate',false,{h:1.25,baseY:round(1.05+height),optional:true});
  const second=add(island.x-6,island.z-5.7,3.1+height,2,2,'airCrate',false,{h:1.25,baseY:round(1.85+height),optional:true});
  for(const box of [first,second])grappleAnchors.push({id:`anchor-${box.id}`,x:box.x,z:box.z,y:box.y+3.5,platformId:box.id});
  optionalRoutes.push({id:'air-crate-detour',platformIds:[0,first.id,second.id,island.id]});
  const supplies=[{platform:primaryPlatforms[0],dx:-1.8,dz:1.5},{platform:primaryPlatforms[0],dx:2.8,dz:2.2},{platform:island,dx:-1.8,dz:1.7}];
  for(const [index,{platform,dx,dz}]of supplies.entries())gadgetPickups.push({id:`${id}-air-crate-${index}`,x:round(platform.x+dx),z:round(platform.z+dz),y:platform.y,gadget:'crate',amount:1,platformId:platform.id});
  // Keep the original finish as the final platform; optional boxes never enter the primary route.
  platforms.splice(platforms.indexOf(finish),1);platforms.push(finish);
 }
 // Short false trails branch away from stable checkpoints. They never replace a
 // primary landing or contain essential supplies, and every gap can be jumped back.
 const branches=1+(definition.number+variant)%2,checkpoints=primaryPlatforms.filter(p=>p.checkpoint&&p.id!==0&&p.id!==finish.id);
 for(let branch=0;branch<branches;branch++){
  const source=checkpoints[branch===0?0:checkpoints.length-1],side=theme.id==='sky'?1:source.x>=0?1:-1;
  const first=add(source.x+side*(source.w/2+3.6),source.z,source.y,4.2,4.2,'plain',false,{optional:true,decoy:true});
  const last=add(first.x+side*5.8,first.z+(branch?1.3:-1.3),source.y+.15,4.2,4.2,'collapse',false,{optional:true,decoy:true});
  if(branch)hazards.push({id:hazards.length,type:'sweeper',x:first.x,z:first.z,y:first.y,w:2.4,phase:variant*.45,speed:.55+variant*.04,range:0,radius:.5,axis:'z',optional:true,decoy:true});
  decoyRoutes.push({id:`decoy-${branch}`,platformIds:[source.id,first.id,last.id],returnPlatformId:source.id,deadEnd:true});
 }
 // A visible portal shortcut bypasses several original crossings. Its narrow
 // approach is optional; the original path and every required pickup stay intact.
 const source=primaryPlatforms[0],desiredIndex=Math.max(2,Math.floor((primaryPlatforms.length-1)*.55));
 const destination=checkpoints.filter(p=>p.id>=2).sort((a,b)=>Math.abs(a.id-desiredIndex)-Math.abs(b.id-desiredIndex)||a.id-b.id)[0];
 const useHook=['sky','bridges'].includes(theme.id),exitSide=theme.id==='sky'?-1:destination.x>=0?-1:1;
 const gateway=add(source.w/2+(useHook?8:3.4),2.8,.35,3.2,3.6,'plain',false,{optional:true,shortcut:true});
 const arrival=add(destination.x+exitSide*(destination.w/2+3.8),destination.z,destination.y,4.2,4.2,'plain',true,{optional:true,shortcut:true});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z,(a.y??0)-(b.y??0));
 let travelDistance=distance(source,gateway)+distance(arrival,destination);
 if(useHook){
  const pickup={id:`${id}-shortcut-grapple`,x:3,z:-2.2,y:source.y,gadget:'grapple',amount:1,platformId:source.id,shortcut:true};
  gadgetPickups.push(pickup);grappleAnchors.push({id:`anchor-${gateway.id}`,x:gateway.x,z:gateway.z,y:gateway.y+3.5,platformId:gateway.id,shortcut:true});
  travelDistance=distance(source,pickup)+distance(pickup,gateway)+distance(arrival,destination);
 }
 portals.push({id:'shortcut-entry',target:'shortcut-arrival',pair:'shortcut-main',x:gateway.x,z:gateway.z,y:gateway.y,radius:.95,color:'#63dfa0',label:'C',platformId:gateway.id,shortcut:true},
  {id:'shortcut-arrival',target:'shortcut-entry',pair:'shortcut-main',x:arrival.x,z:arrival.z,y:arrival.y,radius:.95,color:'#63dfa0',label:'C',platformId:arrival.id,shortcut:true});
 const mainDistance=primaryPlatforms.slice(1,destination.id+1).reduce((sum,p,index)=>sum+distance(primaryPlatforms[index],p),0);
 shortcutRoutes.push({id:'shortcut-main',from:source.id,to:destination.id,platformIds:[source.id,gateway.id,arrival.id,destination.id],portalIds:portals.map(p=>p.id),
  segments:[{from:source.id,to:gateway.id,kind:useHook?'grapple':'jump'},{from:gateway.id,to:arrival.id,kind:'portal'},{from:arrival.id,to:destination.id,kind:'jump'}],
  mainDistance:round(mainDistance),travelDistance:round(travelDistance),distanceRatio:round(travelDistance/mainDistance),skippedSegments:destination.id});
 // Appending optional trails must not change the finish/primary-route convention.
 platforms.splice(platforms.indexOf(finish),1);platforms.push(finish);
 const minX=Math.min(...platforms.map(p=>p.x-p.w/2))-10,maxX=Math.max(...platforms.map(p=>p.x+p.w/2))+10,minZ=-14,maxZ=finish.z+finish.d/2+10;
 const extent=Math.max(Math.abs(minX),Math.abs(maxX),Math.abs(minZ),Math.abs(maxZ)),size=Math.ceil(extent/cellSize)*2+3,mid=(size-1)/2;
 for(const p of platforms){p.cx=Math.round(p.x/cellSize+mid);p.cz=Math.round(p.z/cellSize+mid);}
 const grid=Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>Number(platforms.some(p=>Math.abs((x-mid)*cellSize-p.x)<=p.w/2&&Math.abs((z-mid)*cellSize-p.z)<=p.d/2))));
 const exitPortal={id:'challenge-exit',x:-3.5,z:-1.5,y:0,radius:1.25,color:'#7cc8ed',label:'退出闯关 · 返回草坪'};
 const finishPortal={id:'challenge-finish',x:finish.x,z:finish.z+1,y:finish.y,radius:1.5,color:'#ffd060',label:`第 ${definition.number} 关终点 · 返回草坪`};
 const routeWaypoints=primaryPlatforms.map(p=>{
  const h=hazards.find(h=>h.x===p.x&&h.z===p.z),offset=h?(h.type==='sweeper'?h.w/2+.6:h.w/2+.8):0;
  return {x:round(p.x+offset),z:p.z,y:p.y,platformId:p.id,checkpoint:p.checkpoint};
 });
 return {id:baseLevel.id,code:`${baseLevel.code} / ${definition.id}`,chapter:baseLevel.chapter??0,worldIndex:baseLevel.worldIndex??0,world:baseLevel.world,title:`第 ${definition.number} 关 · ${definition.name}`,layout:definition.name,mode:'challenge',challenge:{...definition,baseLevelId:baseLevel.id},size,cellSize,grid,platforms,walls:[],hazards,beans:[],totalBeans:0,totalScore:0,requiredScore:1,penaltyTotal:0,monsters:[],enemyTier:baseLevel.enemyTier??1,shields:[],portals,challengePortals:[],landmarks:[],signs,gadgetPickups,spawn:{x:0,z:0,y:0},spawnPlatform:0,arena:{open:false,grassColor:theme.grass,edgeColor:theme.color},lavaZones:[{id:'lava',x:(minX+maxX)/2,z:(minZ+maxZ)/2,y:-.35,w:maxX-minX,d:maxZ-minZ}],exitPortal,finishPortal,grappleAnchors,routeSegments,routeWaypoints,optionalRoutes,decoyRoutes,shortcutRoutes,bounds:{minX,maxX,minZ,maxZ},difficulty:Math.min(5,2+Math.floor(variant/2)),hint:definition.instruction,mechanics:[...new Set(['shortcut',...(theme.id==='sky'||theme.id==='bridges'?['grapple']:['lava']),...hazards.map(h=>h.type),...platforms.filter(p=>!['plain','checkpoint'].includes(p.type)).map(p=>p.type)])]};
}
