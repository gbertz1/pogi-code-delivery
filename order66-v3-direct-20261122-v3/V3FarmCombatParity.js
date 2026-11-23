'use strict';
// V3-native port of V2 working farm-combat behavior. No V2 imports,
// smart_move, external supervision, Bridge, or new Priest healing timers.
const FARM={map:'halloween',x:-495.5,y:685.5};
const PROTECTED=new Set(['Souji','Harutora']);
const BOSSES=new Set(['icegolem','phoenix','skeletor','mvampire','jr','greenjr','goldenbat',
  'franky','pinkgoblin','snowman','wabbit','slenderman','mrgreen','mrpumpkin',
  'cutebee','fvampire','grinch','dragold','tiger','pinkgoo']);
const distance=(a,b)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));
function planFarmOrbit({role,position,center=FARM,contact=false,ready=false,
  farmState='FARM',phase='COMBAT',direction=1}={}){
 if(!['Hibari','Harutora'].includes(role)||!position||!center||ready!==true||
   farmState!=='FARM'||!['POSITION','COMBAT','ORBIT'].includes(phase)||
   position.map!==center.map||!Number.isFinite(Number(position.x))||
   !Number.isFinite(Number(position.y))||distance(position,center)>180)
   return{eligible:false,reason:'NOT_ACTIVE_FARM_FORMATION'};
 const angle=Math.atan2(position.y-center.y,position.x-center.x)+
   (Math.PI/6)*(Number(direction)<0?-1:1);
 const radius=role==='Hibari'?(contact?65:40):97.5;
 return{eligible:true,angle,radius,reason:role==='Hibari'?
  'WARRIOR_V2_WHIRLPOOL_30DEG':'MAGE_V2_INDEPENDENT_OUTER_ORBIT',
  target:{x:center.x+radius*Math.cos(angle),y:center.y+radius*Math.sin(angle)}};
}
function selectFarmTaunt({entities=[],position,mp=0,ready=false,range=200,cost=40}={}){
 if(!position||Number(mp)<Number(cost))return null;
 const rows=[];
 for(const row of entities){
  if(!row||row.type!=='monster'||row.dead||row.rip)continue;
  const d=distance(position,row);
  if(!Number.isFinite(d)||d>range)continue;
  const mtype=String(row.mtype||''),victim=String(row.target||'');
  const rescue=PROTECTED.has(victim);
  const boss=BOSSES.has(mtype);
  if(boss&&!rescue)continue; // event+regular bosses: rescue only
  if(mtype!=='xscorpion'&&!rescue)continue;
  // Normal farm pulls require Souji. Protect Souji/Mage even while apart.
  if(!rescue&&ready!==true)continue;
  if(victim==='Hibari')continue;
  if(!rescue&&victim&&victim!=='Rentaro')continue; // do not steal foreign mobs
  rows.push({entity:row,d,priority:rescue?0:(!victim?1:2),victim,
   reason:rescue?'PROTECTED_PARTY_RESCUE':'FARM_PACK_CLAIM'});
 }
 rows.sort((a,b)=>a.priority-b.priority||a.d-b.d);
 return rows[0]||null;
}
function selectWeakFarmTarget({entities=[],position,role='Hibari',attackRange=90}={}){
 if(!position)return null;
 let rows=entities.filter(e=>e&&e.type==='monster'&&e.mtype==='xscorpion'&&
  !e.dead&&!e.rip&&e.visible!==false&&Number(e.hp)>0);
 if(role==='Souji')rows=rows.filter(e=>e.target==='Hibari'); // heal-first, DPS only on tanked mobs
 const score=e=>Number(e.hp||0);
 rows.sort((a,b)=>{
  const ea=a.target==='Hibari'?0:1,eb=b.target==='Hibari'?0:1;
  return ea-eb||score(a)-score(b)||distance(position,a)-distance(position,b);
 });
 return rows[0]||null;
}
function installV3FarmCombatParity({root=globalThis,runtime,now=Date.now}={}){
 const role=String(root?.character?.name||'');
 if(!['Hibari','Harutora'].includes(role))return{ok:true,skipped:true,role};
 if(!runtime?.stateCoordinator||!runtime?.services?.PartyCoordination)
  return{ok:false,error:'V3_PARITY_RUNTIME_REQUIRED',role};
 const previous=root.__O66_V3_FARM_COMBAT_PARITY;
 if(previous?.active===true)return{ok:true,alreadyRunning:true,status:previous.status()};
 const party=runtime.services.PartyCoordination;
 const state={role,active:true,startedAt:Number(now()),orbitMoves:0,taunts:0,
  agitate:0,warcry:0,hardshell:0,energizes:0,cbursts:0,zaps:0,
  lastAction:null,lastError:null,lastTarget:null};
 const timers=[],zapped=new Set();
 let busyTaunt=false,busySupport=false,busyMage=false,lastOrbit=0,lastSupport=0;
 const self=()=>root.character;
 const entities=()=>Object.values(root.parent?.entities||root.entities||{}).filter(Boolean);
 const stateNow=()=>runtime.stateCoordinator.status()?.current||'IDLE';
 const farmStatus=()=>runtime.services.Farm?.getStatus?.()||{};
 const pos=()=>({map:self()?.map,
   x:Number(self()?.real_x??self()?.x),y:Number(self()?.real_y??self()?.y)});
 const ready=()=>{
  const required=role==='Hibari'?['Souji']:['Hibari','Souji'];
  try{return party.ready(required,{anchor:role,maxDistance:190}).ok===true;}catch{return false;}
 };
 function cooldown(skill){
  try{if(typeof root.is_on_cooldown==='function')return !!root.is_on_cooldown(skill);}catch{}
  return false;
 }
 function canUse(skill){
  try{if(typeof root.can_use==='function')return root.can_use(skill)===true;}catch{}
  return !cooldown(skill);
 }
 function skillCost(skill,defaultCost=0){
  return Number(root.G?.skills?.[skill]?.mp??defaultCost);
 }
 function gameDist(a,b){
  try{if(typeof root.distance==='function')return Number(root.distance(a,b))}catch{}
  return distance(a,b);
 }
 async function cast(skill,target,extra){
  try{
   const out=target===undefined?root.use_skill(skill):extra===undefined?
     root.use_skill(skill,target):root.use_skill(skill,target,extra);
   await Promise.resolve(out);state.lastAction=skill;state.lastError=null;
   return true;
  }catch(e){state.lastError=String(e?.reason||e?.message||e);return false;}
 }
 function orbit(){
  if(!state.active||stateNow()!=='FARM'||!ready())return;
  const s=farmStatus(),current=self();
  if(!current||current.rip||current.dead)return;
  const here=pos();
  const visible=entities().filter(e=>e?.type==='monster'&&e.mtype==='xscorpion'&&!e.dead);
  const attackR=Number(current.range||90);
  const contact=visible.some(e=>gameDist(current,e)<=attackR);
  const plan=planFarmOrbit({role,position:here,contact,ready:true,
    farmState:stateNow(),phase:s.phase});
  if(!plan.eligible||Number(now())-lastOrbit<200)return;
  lastOrbit=Number(now());
  // V2's proven orbit owns farm movement; V3 movement/route states are excluded.
  try{
   const p=root.move(plan.target.x,plan.target.y);
   if(p&&typeof p.catch==='function')p.catch(()=>{});
   state.orbitMoves++;state.lastAction=plan.reason;
  }catch(e){state.lastError=String(e?.message||e);}
 }
 async function taunt(){
  if(!state.active||role!=='Hibari'||busyTaunt)return;
  const current=self();
  if(!current||current.rip||current.dead||!canUse('taunt'))return;
  const spot=pos(),inFarm=spot.map===FARM.map&&distance(spot,FARM)<200;
  const list=entities().filter(e=>e.type==='monster'&&!e.dead&&!e.rip&&
    (PROTECTED.has(String(e.target||''))||
      inFarm&&stateNow()==='FARM'&&e.mtype==='xscorpion'));
  const pick=selectFarmTaunt({entities:list,position:spot,mp:current.mp,
    ready:inFarm&&ready(),range:Number(root.G?.skills?.taunt?.range||200),
    cost:skillCost('taunt',40)});
  if(!pick||(!PROTECTED.has(pick.victim)&&stateNow()!=='FARM'))return;
  busyTaunt=true;
  try{
   if(await cast('taunt',pick.entity)){
    state.taunts++;state.lastTarget=String(pick.entity.id||'');
   }
  }finally{busyTaunt=false;}
 }
 async function warriorSupport(){
  if(!state.active||role!=='Hibari'||busySupport||stateNow()!=='FARM'||!ready())return;
  const c=self(),p=pos();
  if(!c||c.rip||p.map!==FARM.map||distance(p,FARM)>180)return;
  if(Number(now())-lastSupport<350)return;
  lastSupport=Number(now());busySupport=true;
  try{
   const nearby=entities().filter(m=>m?.type==='monster'&&!m.dead&&!m.rip&&
     gameDist(c,m)<=Number(root.G?.skills?.agitate?.range||320));
   const scorp=nearby.filter(m=>m.mtype==='xscorpion'&&
     (!m.target||['Rentaro','Souji','Harutora','Hibari'].includes(String(m.target))));
   const loose=scorp.filter(m=>m.target!=='Hibari');
   if(c.level>=68&&scorp.length>=2&&loose.length>=2&&
     scorp.length===nearby.length&&canUse('agitate')&&
     c.mp-skillCost('agitate',420)>=Math.max(300,c.max_mp*0.30)){
    if(await cast('agitate'))state.agitate++;
    return;
   }
   if(c.level>=70&&!c.s?.warcry&&canUse('warcry')&&
     c.mp-skillCost('warcry',100)>c.max_mp*.40){
    if(await cast('warcry'))state.warcry++;
    return;
   }
   const physical=nearby.some(m=>m.target==='Hibari'&&
     (m.damage_type==='physical'||m.damage_type==null));
   if(c.level>=60&&physical&&c.hp/c.max_hp<=.65&&canUse('hardshell')&&
     c.mp>=skillCost('hardshell',480)){
    if(await cast('hardshell'))state.hardshell++;
   }
  }finally{busySupport=false;}
 }
 async function mageSupport(){
  if(!state.active||role!=='Harutora'||busyMage||stateNow()!=='FARM'||!ready())return;
  const c=self(),p=pos();
  if(!c||c.rip||p.map!==FARM.map||distance(p,FARM)>210)return;
  busyMage=true;
  try{
   const tank=root.parent?.entities?.Hibari;
   if(tank&&!tank.dead&&c.mp>c.max_mp*.65&&
      tank.mp<tank.max_mp*.5&&gameDist(c,tank)<=320&&
      canUse('energize')){
     const transfer=Math.min(700,Math.floor((c.mp-c.max_mp*.45)/1.2),
       Math.max(0,tank.max_mp-tank.mp));
     if(transfer>120&&await cast('energize','Hibari',transfer)){
      state.energizes++;return;
     }
   }
   // Anti-KS zap is only active with a visible outsider <= 50 of farm.
   // Bosses never get a farm zap, one zap per xscorpion.
   const outsiders=entities().filter(e=>e?.type==='character'&&
     !['Rentaro','Souji','Hibari','Harutora'].includes(String(e.name||e.id||''))&&
     e.rip!==true&&distance({x:Number(e.real_x??e.x),y:Number(e.real_y??e.y)},FARM)<=50);
   const ring=Object.values(c.slots||{}).some(x=>x?.name==='zapper');
   if(outsiders.length&&ring&&canUse('zapperzap')&&
     c.mp-skillCost('zapperzap',140)>=c.max_mp*.5){
     for(const mob of entities()){
      if(mob?.mtype!=='xscorpion'||mob.dead||mob.target!=='Hibari'||zapped.has(String(mob.id)))continue;
      if(!outsiders.some(o=>String(o.target||'')===String(mob.id)))continue;
      if(gameDist(c,mob)>Number(root.G?.skills?.zapperzap?.range||260))continue;
      if(await cast('zapperzap',mob)){zapped.add(String(mob.id));state.zaps++;}
      return;
     }
   }
   // Dynamic V3 MageController mana planner: secured Burst before Cburst.
   const target=selectWeakFarmTarget({entities:entities(),position:p,role});
   if(!target||!canUse('cburst')||!tank||target.target!=='Hibari')return;
   const planner=runtime.services.MageCombat;
   if(!planner?.plan)return;
   const maxRange=Number(root.G?.skills?.cburst?.range||320);
   const inRange=gameDist(c,target)<=maxRange;
   if(!inRange)return;
   const out=planner.plan({target:String(target.id),targetHp:Number(target.hp||0),
     mp:Number(c.mp||0),maxMp:Number(c.max_mp||0),level:Number(c.level||0),
     cburstCooldownReady:true,cburstInRange:inRange,
     burstCooldownReady:canUse('burst'),burstInRange:gameDist(c,target)<=
       Number(root.G?.skills?.burst?.range||120),
     isBoss:false,warriorHasAggro:true,warriorCanTauntTarget:gameDist(tank,target)<=200,
     otherThreatsOnMage:false,partyAssembled:true});
   const action=out?.action;
   if(!action?.eligible||!action.payload||!action.skill)return;
   if(action.skill==='cburst'){
    if(await cast('cburst',action.payload.target))state.cbursts++;
   }else if(action.skill==='burst'){
    if(await cast('burst',target))state.cbursts++;
   }
  }finally{busyMage=false;}
 }
 timers.push(root.setInterval(()=>{try{orbit()}catch(e){state.lastError=String(e)}},250));
 if(role==='Hibari'){
  timers.push(root.setInterval(()=>{void taunt().catch(()=>{})},150));
  timers.push(root.setInterval(()=>{void warriorSupport().catch(()=>{})},450));
 }else{
  timers.push(root.setInterval(()=>{void mageSupport().catch(()=>{})},350));
 }
 function status(){return{...state,timers:timers.length,active:state.active};}
 const api={active:true,role,status,stop(){
  state.active=false;api.active=false;for(const id of timers)root.clearInterval(id);
  return status();
 }};
 root.__O66_V3_FARM_COMBAT_PARITY=api;
 return{ok:true,role,status:status()};
}
module.exports={FARM,PROTECTED,BOSSES,planFarmOrbit,selectFarmTaunt,
 selectWeakFarmTarget,installV3FarmCombatParity};
