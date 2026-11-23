(function(w){
"use strict";
const host=w.parent;
const pack=host.__O66_V29_PACKAGE;
const c=w.character;
const dl=(ms)=>new Promise(ok=>w.setTimeout(ok,ms));
const now=()=>Date.now();
const loc=()=>({map:c.map,x:Number(c.real_x??c.x),y:Number(c.real_y??c.y)});
const dist=(a,b)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));
const stopReason=(x)=>{throw new Error(x)};
const potionCount=(id)=>(c?.items||[]).reduce((n,it)=>n+(it?.name===id?Number(it.q||1):0),0);
const state={phase:'STARTING',active:false,startedAt:now(),updatedAt:now(),cycle:0,maxCycles:1,step:0,totalSteps:0,
  route:'START',position:null,hp:null,mp:null,scares:0,hpMpPotions:0,townCasts:0,townStopsCompleted:0,transports:0,greenScorpionVisits:0,halloweenScorpionVisits:0,
  endedAt:null,error:null,events:[],earlyHandoffs:0,earlyHandoffChecks:0,earlyHandoffDenied:0,movementMode:'LOOKAHEAD_NO_STOP_ON_STRAIGHT',gameVersion:pack?.gameVersion,modelVersion:pack?.sourceVersion};
host.__O66_V29_STATUS=state;
let running=false,heartbeatId=null,potionBusy=false,scareBusy=false,lastPotionAt=0,lastScareAt=0,lastPush=0;
const fmt=(n)=>Math.round(Number(n)||0);
function event(text){
 const msg={at:now(),cycle:state.cycle,route:state.route,step:state.step,event:text};
 state.events.push(msg);
 if(state.events.length>24)state.events.shift();
}
function report(phase){
 if(phase)state.phase=phase;
 if(!c)return;
 const p=loc();
 Object.assign(state,{updatedAt:now(),position:p,hp:c.hp,mp:c.mp,active:running,
  scareReady:!!w.can_use?.('scare'),hpot1:potionCount('hpot1'),mpot1:potionCount('mpot1')});
 const msg='ORDER66_V29_'+state.phase+'_C'+state.cycle+'/1_'+state.route+'_S'+state.step+'/'+state.totalSteps+
  '_'+p.map+'_'+fmt(p.x)+','+fmt(p.y)+'_HP'+fmt(c.hp)+'_SCARE'+state.scares+'_POT'+state.hpMpPotions;
 try{host.document.title=msg.slice(0,215)}catch(_){}
 if(now()-lastPush>2000||phase){
  lastPush=now();
  try{host.localStorage.setItem('ORDER66_V29_LAST',JSON.stringify(state))}catch(_){}
 }
}
function monstersTargeting(){
 return Object.values(host.entities||{}).filter(e=>e?.type==='monster'&&!e.dead&&!e.rip&&(e.target===c.name||e.target===c.id));
}
async function maintenance(){
 if(!running||!c||c.rip)return;
 if(!scareBusy&&now()-lastScareAt>=900&&monstersTargeting().length>0&&w.can_use?.('scare')){
  scareBusy=true;lastScareAt=now();
  try{await Promise.resolve(w.use_skill('scare'));state.scares++;event('SCARE_CAST_TARGETED')}catch(e){event('SCARE_UNAVAILABLE:'+String(e?.message||e).slice(0,65))}
  finally{scareBusy=false}
 }
 if(!potionBusy&&now()-lastPotionAt>2150){
  const missingHp=c.max_hp-c.hp,missingMp=c.max_mp-c.mp;
  const needHp=missingHp>=200||c.hp/c.max_hp<0.86;
  const needMp=missingMp>=400&&c.mp/c.max_mp<0.72;
  if((needHp&&potionCount('hpot1')>0)||(needMp&&potionCount('mpot1')>0)){
   potionBusy=true;lastPotionAt=now();
   try{
    if(typeof w.use_hp_or_mp==='function')await Promise.resolve(w.use_hp_or_mp());
    else if(w.can_use?.('use_hp'))await Promise.resolve(w.use_skill('use_hp'));
    else throw Error('NO_POTION_API');
    state.hpMpPotions++;
    event('POTION_TRIGGER_HP'+fmt(c.hp)+'_MP'+fmt(c.mp));
   }catch(e){event('POTION_ATTEMPT_FAILED:'+String(e?.message||e).slice(0,65))}
   finally{potionBusy=false}
  }
 }
}
async function check(okMap){
 if(host.__O66_V29_STOP)stopReason('MANUAL_STOP_REQUESTED');
 if(!running)stopReason('RUNNER_NOT_ACTIVE');
 if(!c||c.name!=='Rentaro'||c.rip||c.hp<=0)stopReason('RENTARO_NOT_ALIVE');
 if(okMap&&c.map!==okMap)stopReason('UNEXPECTED_MAP_EXPECT_'+okMap+'_GOT_'+c.map);
 if(!(w.socket?.connected??host.socket?.connected)){
  event('SOCKET_DISCONNECTED_WAITING');
  const deadline=now()+22000;
  while(now()<deadline&&!(w.socket?.connected??host.socket?.connected))await dl(550);
  if(!(w.socket?.connected??host.socket?.connected))stopReason('CONNECTION_LOST_22_SECONDS');
 }
}
// The next move may be issued while still approaching the current waypoint, but
// only along an almost-straight, explicitly recorded fixed path. Never pre-advance
// at a corner, boss stop, door, Town, map transition, or route boundary.
function safeStraightContinuation(prev,current,next){
 if(!prev||!next||prev.op!=='move'||next.op!=='move'||current.op!=='move')return false;
 if(prev.map!==current.map||next.map!==current.map||prev.route!==current.route||next.route!==current.route)return false;
 const a={x:Number(prev.x),y:Number(prev.y)},b={x:Number(current.x),y:Number(current.y)},d={x:Number(next.x),y:Number(next.y)};
 const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-b.x,vy=d.y-b.y;
 const len1=Math.hypot(ux,uy),len2=Math.hypot(vx,vy);
 if(len1<14||len2<14||len1>115||len2>115)return false;
 const cosine=(ux*vx+uy*vy)/(len1*len2);
 const cross=Math.abs(ux*vy-uy*vx)/(len1*len2);
 return cosine>0.99939&&cross<0.03491; // <=2 degree heading change
}
async function movePoint(a,lookAhead=null){
 await check(a.map);
 const target={x:Number(a.x),y:Number(a.y)};
 if(!Number.isFinite(target.x)||!Number.isFinite(target.y))stopReason('NONFINITE_MOVE_POINT');
 if(dist(loc(),target)<3.8)return;
 const deadline=now()+Math.max(23000,Math.min(125000,dist(loc(),target)/Math.max(35,Number(c.speed)||55)*4000+14000));
 let attempts=0,level2DetourUsed=false;
 while(now()<deadline){
  await check(a.map);
  if(dist(loc(),target)<3.8)return;
  const here=loc();
  const direct=w.can_move?.({map:a.map,x:here.x,y:here.y,going_x:target.x,going_y:target.y,base:c.base});
  if(!direct&&!level2DetourUsed&&a.map==='level2'&&(a.route==='R15'||a.source==='O66V6-R15::1')&&Math.abs(target.x-31)<.1&&Math.abs(target.y-25)<.1){
   level2DetourUsed=true;
   event('VERIFIED_LEVEL2_CLEARANCE_DETOUR_30_41');
   await movePoint({op:'move',map:'level2',x:30,y:41,source:'ORDER66_LEVEL2_CLEARANCE_DETOUR_TEST'});
   continue;
  }
  if(!direct)
   stopReason('FIXED_LEG_BLOCKED_AT_'+fmt(here.x)+','+fmt(here.y)+'_TO_'+fmt(target.x)+','+fmt(target.y)+'_'+(a.source||''));
  if(++attempts>3)stopReason('TOO_MANY_SAME_LEG_RESTARTS');
  try{
   const res=w.move(target.x,target.y);
   if(res?.catch)res.catch(()=>{});
  }catch(e){stopReason('NATIVE_MOVE_ERROR_'+String(e?.message||e).slice(0,75))}
  let progress=now(),previous=loc();
  while(now()<deadline){
   await dl(135);
   await check(a.map);
   const p=loc();
   if(dist(p,target)<3.8)return;
   if(lookAhead&&dist(p,target)<17){
    state.earlyHandoffChecks++;
    // Unlike the previous unsafe long-jump experiment, verify live clearance
    // from the ACTUAL position to the immediately next original waypoint.
    // A blocked early handoff is only denied; continue the proven old leg.
    if(w.can_move?.({map:a.map,x:p.x,y:p.y,going_x:lookAhead.x,going_y:lookAhead.y,base:c.base})){
     state.earlyHandoffs++;
     return;
    }
    state.earlyHandoffDenied++;
   }
   if(dist(p,previous)>3.5){progress=now();previous=p}
   if(now()-progress>11000)break;
  }
  event('RETRY_FIXED_MOVE_'+(a.source||'')+'_ATTEMPT_'+attempts);
 }
 stopReason('FIXED_LEG_TIMEOUT_'+(a.source||'')+'_AT_'+fmt(c.x)+','+fmt(c.y));
}
async function teleportTown(a){
 await check(a.map);
 // Halloween south-island Town skill has failed LIVE twice (at -490,680 and -211,706).
 // At user-requested SAFE END move #25, try it only once for 5.5 seconds.
 // If refused/interrupted, WALK BACK along the exact pinned xscorpion approach legs
 // instead of standing still near dangerous mobs or performing blind long jumps.
 if(a.map==='halloween'&&a.source==='O66-V28-HALLOWEEN-XSCORP-RETURN-TOWN'){
  const landing=loc(),goal={x:-253.55556,y:680};
  if(dist(landing,goal)>7)stopReason('HALLOWEEN_SCORP_SAFE_END_NOT_REACHED');
  const approach=(pack.cycle||[]).filter(x=>x.op==='move'&&x.source==='O66-V28-HALLOWEEN-XSCORP');
  if(approach.length!==25||Math.abs(approach[24].x-goal.x)>.1||approach[24].y!==680)
   stopReason('HALLOWEEN_SCORP_REVERSE_CORRIDOR_CHANGED');
  if(w.can_use?.('use_town')){
   try{
    const request=w.use_skill('use_town');
    if(request?.catch)request.catch(e=>event('SCORP_TOWN_SKILL_DENIED_'+String(e?.message||e).slice(0,45)));
    event('SCORP_SAFE_END_TOWN_REQUESTED');
   }catch(e){event('SCORP_TOWN_CALL_ERROR_'+String(e?.message||e).slice(0,45))}
   const until=now()+5500;
   while(now()<until){
    await dl(220);await check('halloween');
    if(dist(loc(),{x:0,y:0})<45){
     state.townCasts++;state.townStopsCompleted++;event('SCORP_SAFE_END_TOWN_CONFIRMED');return;
    }
   }
  }
  event('SCORP_TOWN_FAILED_WALK_FIXED_RETURN');
  const reverse=approach.slice().reverse();
  for(let i=0;i<reverse.length;i++){
   await check('halloween');
   const wp=reverse[i];
   await movePoint({op:'move',map:'halloween',x:wp.x,y:wp.y,source:'O66-V29-SCORP_SAFE_REVERSE_'+i});
  }
  await movePoint({op:'move',map:'halloween',x:0,y:0,source:'O66-V29-SCORP_SAFE_RETURN_TOWN_CENTER'});
  await check('halloween');
  if(dist(loc(),{x:0,y:0})>10)stopReason('HALLOWEEN_SAFE_RETURN_TOWN_NOT_REACHED');
  state.townStopsCompleted++;
  event('SCORP_FIXED_RETURN_TOWN_COMPLETED');
  return;
 }
 const g=w.G||host.G;
 const sp=g?.maps?.[a.map]?.spawns?.[0];
 if(!sp)stopReason('UNKNOWN_TOWN_SPAWN_'+a.map);
 const aim={x:Number(sp[0]),y:Number(sp[1])};
 if(dist(loc(),aim)<36||(a.map==='main'&&(a.source==='NIGHT5_INITIAL_TOWN'||a.source==='O66-V26-FINAL-TOWN'||a.source==='O66-V26-ALIA-MAIN-TOWN'||a.source==='O66-V28-MAIN-EAST-RETURN-TOWN')&&dist(loc(),aim)<70)){
  state.townStopsCompleted++;event('TOWN_ALREADY_NEAR_SPAWN_'+a.map);return;
 }
 if(typeof w.use_skill!=='function')stopReason('TOWN_SKILL_API_MISSING');
 // Explicitly observe Town readiness. Never count a failed request as a cast.
 let ready=(typeof w.can_use!=='function')||w.can_use('use_town')!==false;
 const until=now()+2400;
 while(!ready&&now()<until){await dl(220);await check(a.map);ready=w.can_use('use_town')!==false}
 if(!ready)stopReason('TOWN_NOT_READY_'+a.map+'_AT_'+fmt(c.x)+','+fmt(c.y));
 try{
  const res=w.use_skill('use_town');
  if(res&&typeof res.then==='function')await res;
  event('TOWN_REQUESTED_'+a.map);
 }catch(e){stopReason('TOWN_SKILL_REJECTED_'+a.map+'_'+String(e?.message||e).slice(0,70))}
 const end=now()+19000;
 while(now()<end){
  await dl(220);
  await check(a.map);
  if(dist(loc(),aim)<50||(a.map==='main'&&(a.source==='NIGHT5_INITIAL_TOWN'||a.source==='O66-V26-FINAL-TOWN'||a.source==='O66-V26-ALIA-MAIN-TOWN'||a.source==='O66-V28-MAIN-EAST-RETURN-TOWN')&&dist(loc(),aim)<70)){
   state.townCasts++;state.townStopsCompleted++;event('TOWN_CONFIRMED_'+a.map);
   return;
  }
 }
 stopReason('TOWN_TIMEOUT_'+a.map+'_AT_'+fmt(c.x)+','+fmt(c.y));
}
async function transport(a){
 await check(a.map);
 await movePoint({op:'move',map:a.map,x:a.sourcePoint[0],y:a.sourcePoint[1],source:a.source+'_DOOR_APPROACH'});
 await check(a.map);
 if(typeof w.transport!=='function')stopReason('TRANSPORT_API_MISSING');
 async function invoke(){
  try{const res=w.transport(a.to,Number(a.spawn));if(res?.catch)res.catch(()=>{});event('TRANSPORT_'+a.map+'_TO_'+a.to+'_SPAWN_'+a.spawn)}
  catch(e){event('TRANSPORT_CALL_ERROR_'+String(e?.message||e).slice(0,80))}
  const end=now()+12500;
  while(now()<end){
   await dl(190);
   if(host.__O66_V29_STOP)stopReason('MANUAL_STOP_REQUESTED');
   if(c.rip)stopReason('DIED_DURING_TRANSPORT');
   if(c.map===a.to){state.transports++;report();return true}
   if(c.map!==a.map)stopReason('TRANSPORT_WRONG_MAP_'+c.map);
  }
  return false;
 }
 if(await invoke())return;
 // ONE verified direct approach to a marked door or transporter NPC, with no route search.
 const closer={x:Number(a.targetPoint[0]),y:Number(a.targetPoint[1])};
 if(dist(loc(),closer)<8)stopReason('TRANSPORT_FAILED_NEAR_EXIT_'+a.map+'_TO_'+a.to);
 const here=loc();
 if(!w.can_move?.({map:a.map,x:here.x,y:here.y,going_x:closer.x,going_y:closer.y,base:c.base}))
  stopReason('TRANSPORT_EXIT_APPROACH_BLOCKED_'+a.map+'_TO_'+a.to);
 await movePoint({op:'move',map:a.map,x:closer.x,y:closer.y,source:a.source+'_EXIT_CENTER'});
 if(await invoke())return;
 stopReason('TRANSPORT_TIMEOUT_'+a.map+'_TO_'+a.to);
}
async function perform(a){
 if(a.op==='move')return movePoint(a);
 if(a.op==='town')return teleportTown(a);
 if(a.op==='transport')return transport(a);
 stopReason('UNKNOWN_ACTION_'+a.op);
}
async function drive(){
 try{
  if(!pack||pack.name!=='ORDER66_RENTARO_MERCHANT_FULL_CIRCUIT_V29'||pack.cycleCount!==1||pack.cycle?.length!==995||pack.initial?.length!==0)
   stopReason('INVALID_PINNED_PACKAGE');
  if(pack.safety?.noSmartMove!==true||pack.sourceVersion!==29)stopReason('PACKAGE_VERSION_NOT_APPROVED');
  if(!c||c.name!=='Rentaro'||c.ctype!=='merchant'||c.rip||!(w.socket?.connected??host.socket?.connected))stopReason('RENTARO_NOT_READY');
  if(c.map!=='main')stopReason('RENTARO_NOT_ON_MAIN');
  if(c.hp<Math.max(600,c.max_hp*.5)||c.mp<c.max_mp*.4)stopReason('INSUFFICIENT_HEALTH_OR_MANA');
  if(c.slots?.orb?.name!=='jacko'||Number(c.slots?.orb?.level)<2||!w.can_use?.('scare'))stopReason('SCARE_ORB_NOT_READY');
  if(potionCount('hpot1')<50||potionCount('mpot1')<50)stopReason('INSUFFICIENT_POTIONS');
  if(typeof w.move!=='function'||typeof w.can_move!=='function'||typeof w.transport!=='function'||typeof w.use_skill!=='function')stopReason('GAME_API_NOT_READY');
  if(w.__O66_MOVE_ONLY_PLAYER?.active||w.__O66_PROTECTED_PATROL?.running||host.__O66_V29_STOP)
   stopReason('OTHER_ROUTE_OR_STOP_ACTIVE');
  if(host.__O66_V29_PREFLIGHT?.badCount!==0||host.__O66_V29_PREFLIGHT?.hash!=='936cf089b4eba278df09638b5b2bd70aed447e2a97d13f03d5c9d4b711f0b7bf')
   stopReason('LIVE_PREFLIGHT_MISSING_OR_FAILED');
  running=true;state.active=true;state.totalSteps=pack.cycle.length;
  event('ONE_CYCLE_TEST_STARTED');report('RUNNING');
  heartbeatId=w.setInterval(()=>{maintenance().catch(e=>event('MAINTENANCE_ERROR_'+String(e?.message||e).slice(0,70)));report()},600);
  for(let i=0;i<pack.initial.length;i++){
   state.cycle=0;state.route='TOWN_TO_MINCRAB';state.step=i+1;state.totalSteps=pack.initial.length;
   await check();await perform(pack.initial[i]);if(i%5===0)report();
  }
  for(let cycle=1;cycle<=1;cycle++){
   state.cycle=cycle;state.totalSteps=pack.cycle.length;
   event('CYCLE_START_'+cycle);
   for(let i=0;i<pack.cycle.length;i++){
    state.step=i+1;
    const a=pack.cycle[i];
    const route=a.route||(a.source||'').match(/O66V6-(R\d\d)/)?.[1]||state.route;
    state.route=route;
    const prev=i>0?pack.cycle[i-1]:null;
    const next=i+1<pack.cycle.length?pack.cycle[i+1]:null;
    const ahead=safeStraightContinuation(prev,a,next)?{x:Number(next.x),y:Number(next.y)}:null;
    await check();
    if(a.op==='move')await movePoint(a,ahead);
    else await perform(a);
    if(a.op==='move'&&a.source==='O66-V28-DESERT-GSCORP'&&Math.hypot(a.x-390,a.y+1420)<1){
     state.greenScorpionVisits++;event('GREEN_SCORP_DESERTLAND_VISITED');
    }
    if(a.op==='move'&&a.source==='O66-V28-HALLOWEEN-XSCORP'&&Math.hypot(a.x+253.55556,a.y-680)<1){
     state.halloweenScorpionVisits++;event('SCORPION_HALLOWEEN_ISLAND_VISITED');
    }
    if(i%6===0||a.op!=='move')report();
   }
   event('CYCLE_COMPLETE_'+cycle);
   report('RUNNING');
  }
  // v29 action #995 already uses Town in Main and ends the single complete circuit.
  if(c.map!=='main'||dist(loc(),{x:0,y:0})>=80)stopReason('FINAL_MAIN_TOWN_NOT_CONFIRMED');
  state.route='RETURN_TO_TOWN';
  try{w.stop?.('move')}catch(_){}
  running=false;
  if(heartbeatId)w.clearInterval(heartbeatId);
  state.endedAt=now();state.active=false;state.phase='COMPLETE';event('COMPLETED_ONE_CYCLE');
  report('COMPLETE');
 }catch(err){
  running=false;if(heartbeatId)w.clearInterval(heartbeatId);
  try{w.stop?.('move')}catch(_){}
  state.error=String(err?.message||err);
  state.endedAt=now();state.active=false;state.phase='HALTED';
  event('HALTED_'+state.error);
  report('HALTED');
 }
}
drive();
})(globalThis);
