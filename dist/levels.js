import {tierMonster} from './enemies.js';

export const TOTAL_LEVELS=1000;
export const WORLDS = [
 {name:'云朵游乐场',subtitle:'第一步，也可以很了不起',color:'#b39af2',accent:'#ffe19a',sky:'#dfedf9',mechanics:['plain','gap','boost','bumper'],names:['你好，蛋仔！','跳过小缺口','滚起来吧','向前飞扑','跳扑接力','拐个小弯','会动的糖果','别被弹走','空中小旅行','新手毕业礼']},
 {name:'糖果断桥',subtitle:'看好落点，再勇敢起跳',color:'#f3a4c8',accent:'#fee3a1',sky:'#f5e5f0',mechanics:['gap','narrow','stairs','collapse'],names:['糖豆石墩','大小落点','左右横跳','奶油小阶梯','高低错落','曲奇近路','七彩折线','停一下再跳','最后一跃','断桥冒险家']},
 {name:'云端班车',subtitle:'等一等，你的云朵就来了',color:'#92d2e6',accent:'#c9b5fa',sky:'#e1effb',mechanics:['moving','gap','narrow','gate'],names:['第一班云朵','左右换乘','慢车快车','追上小岛','逆向班车','小心站台','云朵红绿灯','高空转乘','错峰出发','云端换乘王']},
 {name:'摇摆工厂',subtitle:'找到节奏，空档就是机会',color:'#b5a0f0',accent:'#ffd086',sky:'#e7e9f7',mechanics:['sweeper','pendulum','bumper','gap'],names:['转呀转','反向双杆','旋转木糖','钟摆时间','左右夹击','横杆后有坑','喘口气小岛','绕圈也能赢','小心回马锤','摇摆大合奏']},
 {name:'饼干危桥',subtitle:'脚下会碎，别停太久',color:'#e4b28d',accent:'#ffdab2',sky:'#f3e9e2',mechanics:['collapse','gap','moving','sweeper'],names:['会碎的饼干','一口气通过','之字曲奇','安全小岛','近路的代价','拐弯别犹豫','夹心断桥','跳上云朵','饼干跳跳乐','脆脆大逃亡']},
 {name:'风力快递',subtitle:'顺风借力，逆风也别放弃',color:'#81d6ca',accent:'#ffee9f',sky:'#dff3f1',mechanics:['conveyor','wind','boost','gap'],names:['顺风包裹','逆行传送带','横着运快递','交替流水线','侧风小径','乘风一跃','顶风前进','快递飞扑','风中休息站','极速送达']},
 {name:'节拍闸门',subtitle:'红灯停一停，绿灯冲过去',color:'#faaba8',accent:'#aacce8',sky:'#f7e8e5',mechanics:['gate','pusher','sweeper','narrow'],names:['等绿灯','双门同拍','错拍节奏','三道门','调皮推推手','左右来一下','门前有缺口','转角别着急','最后一道门','节拍大师']},
 {name:'冰淇淋山',subtitle:'冰面会打滑，提前松开方向',color:'#9cd7ed',accent:'#e5c6fa',sky:'#e8f1fb',mechanics:['ice','bounce','moving','wind'],names:['滑滑冰面','冰弯刹车','冰山蛇形道','蹦一下','跳上棉花糖','连续弹跳','冰面起飞','空中避让','冷静落地','冰山飞行员']},
 {name:'调皮机关城',subtitle:'路有小心思，你有大智慧',color:'#ba9bdc',accent:'#a6e7d0',sky:'#eee7f8',mechanics:['switch','collapse','gate','pusher','moving'],names:['按钮开桥','先去找按钮','绕路也是路','暂停的机关','真假双桥','看着近的路','等等再过去','高台小机关','终点前转弯','机智小蛋仔']},
 {name:'冠军挑战赛',subtitle:'把学会的每一招，都用上吧',color:'#f0c969',accent:'#b5a0ef',sky:'#f6eddf',mechanics:['sweeper','moving','collapse','wind','gate','ice','bounce','conveyor','pusher','switch'],names:['断桥有节拍','流水线摆锤','会转的班车','冰弯推推手','碎桥起大风','空中换乘','开门大作战','花式接力','最后的试炼','冠军，向前冲！']}
];
export const CELL=3.4;
export const MAP_STYLES=['圆环草坪','花田广场','阳光椭圆','四叶花园','八角乐园','草坡露台','彩虹野餐地','风车草场','海湾草岛','冠军大广场'];
export const MECHANIC_HINTS={sweeper:'旋转横杆：跳起来躲开，也可以从旁边绕过。',pendulum:'摆锤：观察节奏，从空档穿过。',bumper:'弹弹球：会把你撞开，可以绕行。',gate:'节拍门：红灯停，绿灯行，也可以绕开。',pusher:'推板：等它收回再通过。',ice:'冰面：提前减速。',wind:'风场：朝反方向调整移动。',conveyor:'传送带：看箭头，也能逆向走。',collapse:'裂纹地板：踩上后很快会消失。',bounce:'弹跳垫：踩上自动弹起，空中可以飞扑。'};
const BEAN_RADIUS={1:1,5:1.2,10:1.4,100:1.7,500:2,1000:2.2};
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const distance=(a,b={x:0,z:0})=>Math.hypot(a.x-b.x,a.z-b.z);
const cellKey=(x,z)=>`${x},${z}`;

function isGrass(x,z,half,style){
 const ax=Math.abs(x),az=Math.abs(z),core=Math.floor(half*.67);
 if(ax<=core&&az<=core)return true;
 if(ax>half||az>half)return false;
 switch(style){
  case 0:return x*x+z*z<=half*half;
  case 1:return ax+az<=half*1.65;
  case 2:return (x/half)**2+(z/(half*.88))**2<=1;
  case 3:return Math.min((x-half*.35)**2+z*z,(x+half*.35)**2+z*z,x*x+(z-half*.35)**2,x*x+(z+half*.35)**2)<=(half*.75)**2;
  case 4:return ax+az<=half*1.55;
  case 5:return az<=half-(ax>half*.78?2:0);
  case 6:return !(ax>half*.72&&az>half*.72);
  case 7:return x*x+z*z<=(half*.9)**2||ax<=half*.32||az<=half*.32;
  case 8:return !(ax>half*.7&&az>half*.52&&az<half*.76);
  default:return az<=half-ax*.22;
 }
}
function enemyTierFor(id,index){
 const highest=Math.ceil(id/10);
 if(index===0||highest===1)return highest;
 if(index%2===1)return Math.max(1,Math.floor(highest/2)-((id+index)%3));
 return Math.max(1,highest-1-((id+index)%Math.min(5,highest-1)));
}
function makeMonsters(id,platforms,portals,clearing){
 const checkpoints=platforms.filter(p=>p.checkpoint);
 const safe=platforms.filter(p=>p.type==='plain'&&distance(p)>=CELL*2.5&&distance(p,clearing)>clearing.radius+2&&checkpoints.every(c=>distance(p,c)>=4.6)&&portals.every(c=>distance(p,c)>=4.6));
 const cells=new Map(safe.map(p=>[cellKey(p.cx,p.cz),p]));
 const used=new Set(),monsters=[],count=id<=100?3+Math.floor((id-1)/20):Math.min(10,5+Math.floor((id-101)/150));
 const rank=p=>(Math.imul(p.id+1,73856093)^Math.imul(id,19349663))>>>0;
 const routeFrom=(start,length)=>{
  const route=[start],seen=new Set([start.id]);
  while(route.length<length){const p=route.at(-1),next=DIRECTIONS.map(([dx,dz])=>cells.get(cellKey(p.cx+dx,p.cz+dz))).filter(q=>q&&!used.has(q.id)&&!seen.has(q.id)).sort((a,b)=>rank(a)-rank(b))[0];if(!next)break;route.push(next);seen.add(next.id);}
  return route.length>=3?route:null;
 };
 for(let index=0;index<count;index++){
  const starts=safe.filter(p=>!used.has(p.id)&&monsters.every(m=>distance(p,m)>=CELL*4));
  starts.sort(index?(a,b)=>Math.min(...monsters.map(m=>distance(b,m)))-Math.min(...monsters.map(m=>distance(a,m)))||rank(a)-rank(b):(a,b)=>distance(a,{x:10.2,z:3.4})-distance(b,{x:10.2,z:3.4})||rank(a)-rank(b));
  let route;
  for(const start of starts){route=routeFrom(start,3+(id+index)%4);if(route)break;}
  if(!route)throw new Error(`地图 ${id} 缺少安全巡逻区`);
  route.forEach(p=>used.add(p.id));const start=route[0],type=index%2?'beetle':'slime';
  const base={id:index,type,x:start.x,z:start.z,y:0,hp:type==='slime'?2:3,speed:type==='slime'?2:1.7,chaseSpeed:type==='slime'?3.3:2.8,patrol:route.map(p=>({x:p.x,z:p.z}))};
  monsters.push(tierMonster(base,enemyTierFor(id,index)));
 }
 return monsters;
}
function beanPattern(x,z,style,span){
 const radius=Math.hypot(x,z),angle=Math.atan2(z,x);
 switch(style){
  case 0:return Math.abs(radius-span*.54);
  case 1:return Math.min(...[[-.5,-.4],[.5,-.4],[-.5,.4],[.5,.4]].map(([a,b])=>Math.hypot(x-a*span,z-b*span)));
  case 2:return Math.abs(z-x*.35);
  case 3:return Math.abs(Math.sin(angle*2))*span*.25;
  case 4:return Math.min(Math.abs(radius-span*.35),Math.abs(radius-span*.75));
  case 5:return Math.abs(z-Math.sin(x/span*5)*span*.3);
  case 6:return (Math.abs(Math.round(x/CELL/2))+Math.abs(Math.round(z/CELL/2)))%3*CELL;
  case 7:return Math.abs(Math.sin(angle*4+radius/span))*span*.25;
  case 8:return Math.abs(Math.abs(x)-span*.55);
  default:return Math.abs(Math.sin(angle*5))*span*.2+Math.abs(radius-span*.6)*.25;
 }
}
function makeBeans(id,platforms,portals,clearing,shields,style,r){
 const first=platforms.find(p=>Math.abs(p.x+CELL)<.01&&Math.abs(p.z-CELL*2)<.01);
 const span=Math.max(...platforms.map(p=>Math.abs(p.x)));
 const lattice=platforms.filter(p=>p.type==='plain'&&Math.abs(Math.round(p.x/CELL))%2===1&&Math.abs(Math.round(p.z/CELL))%2===0&&distance(p)>=CELL*1.8&&distance(p,clearing)>clearing.radius+2.3&&portals.every(q=>distance(p,q)>4.6)&&shields.every(q=>distance(p,q)>3.2));
 const ranked=lattice.filter(p=>p!==first).map(p=>({p,score:beanPattern(p.x,p.z,style,span)+r()*span*.65})).sort((a,b)=>a.score-b.score||a.p.id-b.p.id).map(entry=>entry.p);
 const requiredScore=id+11,premium=id>100?598:0,count=Math.max(28,Math.ceil((requiredScore+80-premium)/3.5));
 if(ranked.length+1<count)throw new Error(`地图 ${id} 的豆子位置不足`);
 const beans=[first,...ranked.slice(0,count-1)].map((p,index)=>({id:index,x:p.x,z:p.z,y:1,cx:p.cx,cz:p.cz,value:1,radius:1}));
 const far=[...beans.slice(1)].sort((a,b)=>distance(b)-distance(a)||a.id-b.id);
 for(const bean of far.slice(0,Math.max(3,Math.floor(count*.16))))bean.value=10;
 const fives=beans.slice(1).filter(bean=>bean.value===1).sort((a,b)=>((a.id*17+id)%count)-((b.id*17+id)%count));
 for(const bean of fives.slice(0,Math.max(4,Math.floor(count*.3))))bean.value=5;
 if(id>100){
  const eligible=[...beans.slice(1)].sort((a,b)=>distance(b)-distance(a)||a.id-b.id),fiveHundred=eligible[0];
  const closer=eligible.filter(bean=>bean!==fiveHundred&&distance(bean)<distance(fiveHundred)-.01);
  const hundred=(closer.length?closer:eligible.slice(1)).sort((a,b)=>Math.min(distance(b),distance(b,fiveHundred))-Math.min(distance(a),distance(a,fiveHundred))||a.id-b.id)[0];
  fiveHundred.value=500;hundred.value=100;
 }
 let totalScore=beans.reduce((sum,bean)=>sum+bean.value,0);
 for(const bean of [...beans.slice(1)].reverse()){
  if(totalScore>=requiredScore+64)break;
  if(bean.value===1){bean.value=5;totalScore+=4;}else if(bean.value===5){bean.value=10;totalScore+=5;}
 }
 if(totalScore<requiredScore+24)throw new Error(`地图 ${id} 的积分不足`);
 for(const bean of beans){bean.radius=BEAN_RADIUS[bean.value];bean.y=bean.radius;}
 return {beans,totalScore};
}
function makeTrapBeans(id,beans,platforms,portals,clearing,shields,penaltyTotal){
 const cells=new Map(platforms.map(p=>[cellKey(p.cx,p.cz),p]));
 const checkpoints=platforms.filter(p=>p.checkpoint),mechanics=platforms.filter(p=>!['plain','checkpoint'].includes(p.type));
 const first=beans[0],lineLength=first.x**2+first.z**2;
 const corridorDistance=p=>{const t=Math.max(0,Math.min(1,(p.x*first.x+p.z*first.z)/lineLength));return Math.hypot(p.x-first.x*t,p.z-first.z*t);};
 const traps=[],specs=[{effect:'subtract',value:-penaltyTotal,radius:penaltyTotal===100?1.7:1.25,target:{x:13.6+((id-1)%3)*3.4,z:17}},{effect:'zero',value:0,radius:1.45,target:{x:27.2,z:20.4+((id-1)%3)*3.4}}];
 for(const spec of specs){
  const safe=platforms.filter(p=>p.type==='plain'&&distance(p)>=10&&corridorDistance(p)>spec.radius+3.4&&distance(p,clearing)>clearing.radius+spec.radius+2&&portals.every(q=>distance(p,q)>spec.radius+4.6)&&checkpoints.every(q=>distance(p,q)>spec.radius+5.2)&&shields.every(q=>distance(p,q)>spec.radius+4.6)&&mechanics.every(q=>distance(p,q)>spec.radius+CELL*1.5)&&DIRECTIONS.every(([dx,dz])=>cells.get(cellKey(p.cx+dx,p.cz+dz))?.type==='plain'));
  const available=safe.filter(p=>[...beans,...traps].every(bean=>distance(p,bean)>=Math.max(6.8-1e-6,spec.radius+bean.radius+.86+.4)));
  const lattice=available.filter(p=>Math.abs(Math.round(p.x/CELL))%2===1&&Math.abs(Math.round(p.z/CELL))%2===0);
  const chosen=(lattice.length?lattice:available).sort((a,b)=>distance(a,spec.target)-distance(b,spec.target)||a.id-b.id)[0];
  if(!chosen)throw new Error(`地图 ${id} 缺少安全的陷阱豆位置`);
  traps.push({id:beans.length+traps.length,x:chosen.x,z:chosen.z,y:spec.radius,cx:chosen.cx,cz:chosen.cz,effect:spec.effect,value:spec.value,radius:spec.radius});
 }
 return traps;
}
function applyBeanRefresh(id,positiveBeans){
 if(id>=501){
  const thousand=positiveBeans.filter(bean=>bean.value===1&&bean.id!==0).sort((a,b)=>distance(b)-distance(a)||a.id-b.id)[0];
  if(!thousand)throw new Error(`地图 ${id} 缺少 1000 分豆的位置`);
  thousand.value=1000;thousand.radius=BEAN_RADIUS[1000];thousand.y=thousand.radius;
 }
 for(const bean of positiveBeans)bean.respawn=30;
 return positiveBeans.reduce((sum,bean)=>sum+bean.value,0);
}
export function mapCode(id){if(!Number.isInteger(id)||id<1||id>TOTAL_LEVELS)throw Error(`地图编号应为1–${TOTAL_LEVELS}`);return `DZ-${String(id).padStart(3,'0')}`;}
export function parseMapCode(value){if(typeof value!=='string')throw Error('请输入地图码，例如 DZ-001');const text=value.trim().toUpperCase();const match=/^(?:DZ[- ]?)?(\d{1,4})$/.exec(text);const id=match?Number(match[1]):0;if(id<1||id>TOTAL_LEVELS)throw Error(`地图码不存在，请输入 DZ-001 至 DZ-${TOTAL_LEVELS}`);return id;}
export function makeLevel(id){
 const code=mapCode(id),style=(id-1)%10,wi=Math.floor((id-1)/10)%10,chapter=Math.floor((id-1)/100),world=WORLDS[wi],r=random(18731+id*7919);
 const size=31+2*Math.floor((id-1)/250),mid=(size-1)/2,half=mid-1;
 const grid=Array.from({length:size},(_,z)=>Array.from({length:size},(_,x)=>Number(isGrass(x-mid,z-mid,half,style))));
 const platforms=[];
 for(let cz=0;cz<size;cz++)for(let cx=0;cx<size;cx++)if(grid[cz][cx])platforms.push({id:platforms.length,cx,cz,x:(cx-mid)*CELL,z:(cz-mid)*CELL,y:0,w:CELL+.012,d:CELL+.012,type:'plain',checkpoint:false,phase:r()*Math.PI*2,speed:1,dir:r()<.5?-1:1,axis:r()<.5?'x':'z'});
 const shift=((id-1)%5-2)*.7,clearing={x:-14+shift,z:24+chapter*.45,radius:13};
 const landmarks=[{id:'chef',type:'chef',x:-18+shift,z:clearing.z,y:0,scale:1,clearance:9},{id:'pot',type:'pot',x:-8+shift,z:clearing.z-3,y:0,scale:1,clearance:5}];
 const spawnPlatform=platforms.find(p=>p.x===0&&p.z===0),checkpoints=[spawnPlatform],portals=[],hazards=[];
 const nearest=(x,z,allowed=()=>true)=>platforms.filter(allowed).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)||a.id-b.id)[0];
 for(const [x,z]of [[-half*CELL*.57,-CELL*3],[half*CELL*.57,CELL*3]])checkpoints.push(nearest(x,z,p=>distance(p,clearing)>clearing.radius+5));
 for(const p of checkpoints){p.type='checkpoint';p.checkpoint=true;}
 const portalTargets=[[-CELL*4,0],[half*CELL*.68,half*CELL*.68],[-half*CELL*.68,half*CELL*.68],[half*CELL*.68,-half*CELL*.68]];
 for(const [index,[x,z]]of portalTargets.entries()){
  const p=nearest(x,z,p=>!p.checkpoint&&distance(p)>=CELL*3&&distance(p,clearing)>clearing.radius+5&&portals.every(q=>distance(p,q)>CELL*4));
  portals.push({id:index,pair:Math.floor(index/2),target:index%2?index-1:index+1,x:p.x,z:p.z,y:0,platformId:p.id,color:index<2?'#8454ef':'#21b6d8',label:index<2?'A':'B',radius:1});
 }
 const shields=[{id:0,x:CELL,z:0,y:.7,respawn:100}];
 const hazardTypes=['bumper','sweeper','bounce','ice','conveyor','pendulum','pusher'];
 const hazardCount=4+Math.min(4,chapter);
 for(let index=0;index<hazardCount;index++){
  const angle=(index/hazardCount)*Math.PI*2+id*.31,radius=CELL*(half*.55+(index%2)*.12*half);
  const p=nearest(Math.cos(angle)*radius,Math.sin(angle)*radius,p=>p.type==='plain'&&distance(p)>CELL*4&&distance(p,clearing)>clearing.radius+4&&checkpoints.every(q=>distance(p,q)>6)&&portals.every(q=>distance(p,q)>6));
  if(!p)continue;
  const type=hazardTypes[(id+index*2)%hazardTypes.length];p.type=type;
  if(['bumper','sweeper','pendulum','pusher'].includes(type))hazards.push({id:hazards.length,type,x:p.x,z:p.z,y:0,w:2.8,phase:r()*Math.PI*2,speed:.7+chapter*.025,range:.85,radius:.65,axis:index%2?'x':'z'});
 }
 const {beans:positiveBeans,totalScore}=makeBeans(id,platforms,portals,clearing,shields,style,r);
 const monsters=makeMonsters(id,platforms,portals,clearing),enemyTier=Math.ceil(id/10);
 const penaltyTotal=id>100&&totalScore-100>=id+11?100:10;
 const beans=[...positiveBeans,...makeTrapBeans(id,positiveBeans,platforms,portals,clearing,shields,penaltyTotal)];
 // Upgrade only after traps are fixed so their position and penalty stay unchanged.
 const refreshTotalScore=applyBeanRefresh(id,positiveBeans);
 const grassColors=['#83cc62','#8ed36d','#93d46a','#80c95e','#8bd373','#95d875','#82cd68','#8bd16a','#79c96c','#93d86d'];
 const patches=Array.from({length:5},(_,index)=>{const angle=index*Math.PI*.4+style*.21;return {x:Math.cos(angle)*half*CELL*.6,z:Math.sin(angle)*half*CELL*.6,radius:5+(id+index)%4,color:index%2?'#a3dc7f':'#6ebd54'};});
 const arena={open:true,style,name:MAP_STYLES[style],grassColor:grassColors[style],edgeColor:'#518a40',chefClearing:clearing,patches};
 return {id,code,chapter,worldIndex:wi,world,title:`${MAP_STYLES[style]} · ${id}`,layout:MAP_STYLES[style],size,cellSize:CELL,grid,platforms,walls:[],beans,hazards,portals,monsters,enemyTier,shields,signs:[],landmarks,arena,requiredScore:id+11,totalBeans:beans.length,totalScore:refreshTotalScore,penaltyTotal,spawn:{x:0,z:0,y:0},spawnPlatform:spawnPlatform.id,bounds:{minX:-size*CELL/2,maxX:size*CELL/2,minZ:-size*CELL/2,maxZ:size*CELL/2},difficulty:Math.min(5,1+Math.floor(id/220)),hint:`在开阔草地自由探索，收集豆子达到 ${id+11} 分就过关。${id>=501?'豆子有 1、5、10、100、500 和 1000 分。':id>100?'豆子有 1、5、10、100 和 500 分。':'豆子有 1、5 和 10 分。'}正分豆吃掉后 30 秒刷新，暂停时不计时。小心扣 ${penaltyTotal} 分豆；×0 豆会清空积分，并让已吃的正分豆重新出现。每颗陷阱豆每局只触发一次，可以绕行。绕开小片机关区域，A 门和 B 门分别成对传送。`,mechanics:[...new Set(platforms.filter(p=>!['plain','checkpoint'].includes(p.type)).map(p=>p.type))]};
}
const levelCache=new Map(),LEVEL_CACHE_LIMIT=32;
function cachedLevel(id){
 let level=levelCache.get(id);
 if(level)levelCache.delete(id);else level=makeLevel(id);
 levelCache.set(id,level);
 if(levelCache.size>LEVEL_CACHE_LIMIT)levelCache.delete(levelCache.keys().next().value);
 return level;
}
export const LEVELS=new Array(TOTAL_LEVELS);
for(let index=0;index<TOTAL_LEVELS;index++)Object.defineProperty(LEVELS,index,{enumerable:true,get:()=>cachedLevel(index+1)});
