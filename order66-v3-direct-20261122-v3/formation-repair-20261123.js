/* ORDER66 V3 live fighter formation repair. Native move/skills only.
 * Replaces the old Souji FARM movement with healer-first following.
 * No extra game tab, smart_move, Bridge, browser restart, or path edit.
 */
(function(root){
'use strict';
const role=String(root?.character?.name||'');
if(!['Souji','Hibari','Harutora'].includes(role))return;
if(root.__O66_V3_FORMATION_REPAIR?.active===true)return;
const SAFE={map:'halloween',x:-253.55556,y:680},FARM={map:'halloween',x:-495.5,y:685.5};
const MIN_HEALER_RANGE=88,MIN_WARRIOR_RANGE=110;
const state={role,active:true,startedAt:Date.now(),ticks:0,attempts:0,moves:0,
  attacksHeld:0,skillsHeld:0,moveErrors:0,lastError:null,lastAction:null,lastMoveAt:0,
  lastDistance:null,partyReady:false,priestSeen:false,warriorSeen:false};
let busy=false,timer=null,priorAttack=null,priorSkill=null;
const here=()=>root.character;
const dist=(a,b)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));
const valid=x=>x&&x.rip!==true&&x.dead!==true&&
  Number.isFinite(Number(x.hp))&&Number(x.hp)>0;
function visible(name){
 try{const p=root.get_player?.(name)||root.parent?.entities?.[name];
  return valid(p)&&p.map===here()?.map&&
    String(p.in??p.instance??here()?.in??here()?.instance??'')===
    String(here()?.in??here()?.instance??'')?p:null;
 }catch(_){return null;}
}
function memberPosition(p){
 return{map:p.map,x:Number(p.real_x??p.x),y:Number(p.real_y??p.y)};
}
function inCorridor(p){
 return p?.map==='halloween'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=-545&&p.x<=-215&&p.y>=630&&p.y<=740;
}
function formationReady(){
 const c=here();
 if(!valid(c))return false;
 const priest=role==='Souji'?c:visible('Souji'),warrior=role==='Hibari'?c:visible('Hibari');
 state.priestSeen=!!priest;state.warriorSeen=!!warrior;
 if(!priest||!warrior)return false;
 const cp=memberPosition(c),pp=memberPosition(priest),wp=memberPosition(warrior);
 if(!Number.isFinite(cp.x)||!Number.isFinite(pp.x)||!Number.isFinite(wp.x))
   return false;
 const close=dist(pp,wp)<=MIN_HEALER_RANGE;
 const mageClose=role!=='Harutora'||dist(cp,wp)<=MIN_WARRIOR_RANGE;
 state.lastDistance=dist(pp,wp);
 state.partyReady=close&&mageClose;
 return state.partyReady;
}
function allowedMove(from,to){
 if(!inCorridor(from)||!inCorridor(to))return false;
 if(typeof root.can_move==='function'){
  try{return root.can_move({map:from.map,x:from.x,y:from.y,
    going_x:to.x,going_y:to.y,base:root.character?.base})===true;}catch(_){return false}
 }
 if(typeof root.can_move_to==='function'){
  try{return root.can_move_to(to.x,to.y)===true}catch(_){return false}
 }
 return false;
}
function moveTowards(goal,reason){
 const p=memberPosition(here());
 if(!inCorridor(p)||!inCorridor(goal)||busy)return false;
 const d=dist(p,goal);
 if(d<13||Date.now()-state.lastMoveAt<2400)return false;
 const ratio=Math.min(1,Math.min(105,d)/d);
 const to={map:p.map,x:p.x+(goal.x-p.x)*ratio,
   y:p.y+(goal.y-p.y)*ratio};
 if(!allowedMove(p,to)){state.moveErrors++;state.lastError='NATIVE_CORRIDOR_BLOCKED_'+reason;return false;}
 busy=true;state.lastMoveAt=Date.now();state.attempts++;
 try{
  const out=root.move(to.x,to.y);
  if(out?.catch)out.catch(e=>{state.lastError=String(e?.message||e)});
  state.moves++;state.lastAction=reason;state.lastError=null;
  return true;
 }catch(e){state.lastError=String(e?.message||e);return false}
 finally{busy=false}
}
function healerFollow(){
 // If core V3 boot finishes after this small first-on layer, retire only
 // the competing Priest FARM scheduler then; NEVER stop the healer pulse.
 const farmScheduler=root.__POGI_V3_DIRECT_RUNTIME?.scheduler;
 if(farmScheduler?.status?.()?.running===true){
   farmScheduler.stop();state.priestFarmSchedulerStopped=true;
 }
 const c=here();
 if(!valid(c)||c.map!=='halloween')return;
 const warrior=visible('Hibari');
 if(!warrior){
   // Missing warrior: Souji returns to exact Rentaro Halloween SAFE END.
   moveTowards(SAFE,'PRIEST_WAIT_WARRIOR_SAFE_END');return;
 }
 const p=memberPosition(c),w=memberPosition(warrior);
 if(!inCorridor(p)||!inCorridor(w))return;
 const d=dist(p,w);
 if(d>MIN_HEALER_RANGE){
   // Move to ~42px behind Hibari towards SAFE END; within direct heal range.
   const dx=p.x-w.x,dy=p.y-w.y,scale=Math.max(.00001,d);
   const goal={map:'halloween',x:w.x+42*dx/scale,y:w.y+42*dy/scale};
   moveTowards(goal,'PRIEST_CLOSE_TO_HIBARI');
 }
}
function outOfFormation(){
 return !formationReady();
}
const combatSkill=new Set(['cleave','stomp','agitate','cburst','burst',
 'zapperzap','supershot','fireball','light','3shot','5shot']);
if(role==='Souji'){
  // The independent V3-native Priest healing heartbeat remains running.
  // Stop only the old FARM scheduler which kept sending Souji to SAFE END
  // while Hibari was fighting and which could attack instead of healing.
  const s=root.__POGI_V3_DIRECT_RUNTIME?.scheduler;
  if(s?.status?.()?.running===true){s.stop();state.priestFarmSchedulerStopped=true;}
  state.healHeartbeatRunning=root.__POGI_V3_PRIEST_HEAL?.status?.()?.running===true;
}else{
  if(typeof root.attack==='function'){
   priorAttack=root.attack;
   root.attack=function(...args){
     if(outOfFormation()){
       state.attacksHeld++;state.lastAction='WAIT_SOUJI_BEFORE_ATTACK';
       return Promise.resolve({failed:true,reason:'ORDER66_WAIT_FOR_HEALER_FORMATION'});
     }
     return priorAttack.apply(this,args);
   };
  }
  if(typeof root.use_skill==='function'){
   priorSkill=root.use_skill;
   root.use_skill=function(name,...args){
     if(combatSkill.has(String(name||''))&&outOfFormation()){
       state.skillsHeld++;state.lastAction='WAIT_SOUJI_BEFORE_SKILL';
       return Promise.resolve({failed:true,reason:'ORDER66_WAIT_FOR_HEALER_FORMATION'});
     }
     return priorSkill.call(this,name,...args);
   };
  }
}
function tick(){
 if(!state.active)return;
 state.ticks++;
 if(role==='Souji')healerFollow();
 else if(role==='Harutora'){
  // Mage does not move into scorpions while Hibari is absent.
  // If both remain visible but Souji is regrouping, keep position.
  if(!visible('Hibari'))moveTowards(SAFE,'MAGE_WAIT_HIBARI_SAFE_END');
  else formationReady();
 }else formationReady();
}
timer=root.setInterval(()=>{try{tick()}catch(e){state.lastError=String(e?.message||e)}},700);
tick();
const api={
  role,active:true,
  status(){return{...state,active:api.active,
    healerRunning:role==='Souji'?root.__POGI_V3_PRIEST_HEAL?.status?.()?.running:undefined}},
  stop(){
    state.active=false;api.active=false;
    root.clearInterval(timer);
    if(priorAttack&&root.attack!==priorAttack)root.attack=priorAttack;
    if(priorSkill&&root.use_skill!==priorSkill)root.use_skill=priorSkill;
    return{ok:true,stopped:true};
  }
};
root.__O66_V3_FORMATION_REPAIR=api;
try{root.game_log?.('O66 V3 '+role+' formation corrected')}catch(_){}
})(globalThis);
