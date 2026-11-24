/* ORDER66 Rentaro V3 Native Town Duties. Live route v64 is an UNVALIDATED
 * editable draft; old V29's Winterland Town endpoint killed Rentaro.
 * Restore real stand, mluck, bank, self-potions and scare independently
 * while refusing to traverse the superseded 995-action boss patrol.
 */
(function(root){
'use strict';
if(root?.character?.name!=='Rentaro')return;
const host=root.parent||root, c=root.character;
if(host.__O66_RENTARO_TOWN_SERVICE?.active===true)return;
const STAND={map:'main',x:-300,y:-100},ANCHOR={map:'main',x:25.55,y:-30.92},
      TOWN={map:'main',x:0,y:0},BANK={map:'main',x:168,y:-134};
const WAIT=ms=>new Promise(resolve=>root.setTimeout(resolve,ms));
const state={release:'ORDER66_NATIVE_TOWN_DUTIES_20261123',active:true,
  phase:'STARTING',patrol:'HELD_POGIPATH_V64_EDITABLE_UNVALIDATED',
  at:Date.now(),lastAt:Date.now(),x:null,y:null,map:null,
  standOpen:false,mlucks:0,scares:0,potions:0,bankVisits:0,
  bankDeposited:0,bankItemsStored:0,steps:0,errors:[],lastError:null};
let busy=false,lastMluck=0,lastScare=0,lastPotion=0,lastBankAttempt=0,
  watchdog=null,working=null,stopRequested=false,respawnSince=null,lastRespawn=0;
const pos=()=>({map:c.map,x:Number(c.real_x??c.x),y:Number(c.real_y??c.y)});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const live=()=>c.name==='Rentaro'&&!c.rip&&!c.dead&&c.hp>0;
function report(phase){
 if(phase)state.phase=phase;
 state.lastAt=Date.now();
 Object.assign(state,{...pos(),hp:c.hp,mp:c.mp,gold:c.gold,
  standOpen:!!c.stand,active:!stopRequested});
 try{host.document.title='ORDER66_RENTARO_'+state.phase+'_MAIN_'+
  Math.round(state.x)+','+Math.round(state.y)+'_HP'+c.hp}catch(_){}
 try{host.localStorage.setItem('O66_RENTARO_TOWN_SERVICE',JSON.stringify(state))}catch(_){}
}
function error(e){
 state.lastError=String(e?.message||e);
 state.errors.push({at:Date.now(),reason:state.lastError});
 if(state.errors.length>12)state.errors.shift();
}
function nativeClear(to){
 const p=pos();if(p.map!==to.map)return false;
 try{return root.can_move?.({map:p.map,x:p.x,y:p.y,
   going_x:to.x,going_y:to.y,base:c.base})===true}catch(_){return false}
}
async function moveTo(to,label){
 if(!live()||c.map!==to.map)throw Error('WRONG_MAP_OR_DEAD_'+label);
 if(dist(pos(),to)<=12)return;
 if(!nativeClear(to))throw Error('NATIVE_FIXED_LEG_BLOCKED_'+label);
 const result=root.move(to.x,to.y);if(result?.catch)result.catch(()=>{});
 const until=Date.now()+Math.max(12000,Math.min(40000,
   Math.ceil(dist(pos(),to)/Math.max(35,c.speed||55)*1600)+10000));
 while(Date.now()<until&&!stopRequested){
  if(!live()||c.map!==to.map)throw Error('DEATH_OR_MAP_CHANGED_'+label);
  if(dist(pos(),to)<=12){state.steps++;return;}
  await WAIT(180);
 }
 throw Error('NATIVE_LEG_TIMEOUT_'+label);
}
async function townNative(){
 if(c.map!=='main'||dist(pos(),TOWN)<=80)return true;
 if(root.can_use?.('use_town')===false)return false;
 let sent=false;
 try{
  if(typeof root.town==='function'){await Promise.resolve(root.town());sent=true}
  else if(typeof root.use_skill==='function'){await Promise.resolve(root.use_skill('use_town'));sent=true}
 }catch(e){error('TOWN_CAST_'+String(e?.message||e))}
 if(!sent)return false;
 const deadline=Date.now()+10000;
 while(Date.now()<deadline&&!stopRequested){
  if(c.map==='main'&&dist(pos(),TOWN)<75)return true;
  await WAIT(220);
 }
 return false;
}
async function closeStand(){
 if(!c.stand)return;
 const close=root.close_stand||host.close_merchant;
 if(typeof close!=='function')throw Error('CLOSE_STAND_UNAVAILABLE');
 await Promise.resolve(close.call(root));
 for(let i=0;i<25&&c.stand;i++)await WAIT(150);
 if(c.stand)throw Error('STAND_CLOSE_UNCONFIRMED');
}
async function openStand(){
 if(c.stand)return;
 if(typeof root.open_stand==='function')await Promise.resolve(root.open_stand());
 else{
  const index=c.items?.findIndex(it=>it?.name==='stand0');
  if(!(index>=0)||typeof host.open_merchant!=='function')
    throw Error('STAND_NATIVE_API_MISSING');
  await Promise.resolve(host.open_merchant(index));
 }
 for(let i=0;i<40&&!c.stand;i++)await WAIT(150);
 if(!c.stand)throw Error('STAND_OPEN_UNCONFIRMED');
}
async function atStand(){
 if(c.map!=='main')throw Error('MAIN_REQUIRED_FOR_STAND');
 report('TO_STAND');
 if(dist(pos(),STAND)>16){
  await closeStand();
  if(!nativeClear(STAND)){
   if(dist(pos(),TOWN)>90&&!(await townNative()))
     throw Error('MAIN_TOWN_NATIVE_CAST_FAILED');
   if(!nativeClear(STAND))await moveTo(ANCHOR,'TOWN_ANCHOR');
  }
  await moveTo(STAND,'VERIFIED_MAIN_STAND');
 }
 await openStand();
 report('STAND');
}
async function bankVisit(){
 if(c.map!=='main')return;
 const gold=Number(c.gold||0);
 const eligible=(c.items||[]).map((it,i)=>({it,i})).filter(
   ({it})=>it&&it.p==null&&Number(it.level||0)===0&&
   !it.l&&!it.locked&&
   ['ascale','bfur','bwing','cscale','dstones','essenceoffrost',
   'essenceoffire','gem1','gemfragment','leather','lotusf',
   'mistletoe','monstertoken','ornament','pleather','pvptoken',
   'rattail','seashell','smush','spidersilk','snakefang','svenom']
     .includes(it.name));
 const free=(c.items||[]).filter(it=>!it).length;
 if(gold<250000&&!(free<=5&&eligible.length))return;
 if(Date.now()-lastBankAttempt<300000)return;
 lastBankAttempt=Date.now();
 report('BANK_TRAVEL');
 await closeStand();
 if(dist(pos(),TOWN)>65&&!await townNative()){
   if(!nativeClear(ANCHOR))throw Error('BANK_TOWN_ANCHOR_BLOCKED');
   await moveTo(ANCHOR,'BANK_PRE_ANCHOR');
 }
 await moveTo(BANK,'BANK_MAIN_ENTRANCE');
 if(typeof root.transport!=='function')throw Error('BANK_TRANSPORT_UNAVAILABLE');
 await Promise.resolve(root.transport('bank',0));
 for(let i=0;i<55&&c.map!=='bank';i++)await WAIT(220);
 if(c.map!=='bank')throw Error('BANK_NOT_CONFIRMED');
 report('BANK');
 const retain=50000,deposit=Math.max(0,Number(c.gold||0)-retain);
 if(deposit>0){
  if(typeof root.bank_deposit!=='function')throw Error('BANK_DEPOSIT_UNAVAILABLE');
  const prev=Number(c.gold||0);
  await Promise.resolve(root.bank_deposit(deposit));
  for(let i=0;i<28&&Number(c.gold||0)===prev;i++)await WAIT(220);
  if(Number(c.gold||0)===prev)throw Error('BANK_GOLD_DEPOSIT_UNCONFIRMED');
  state.bankDeposited+=prev-Number(c.gold||0);
 }
 if(c.bank?.items0&&Array.isArray(c.bank.items0)){
  for(const {it,i} of eligible.slice(0,8)){
   const slot=c.bank.items0.findIndex(q=>!q);
   if(slot<0)break;
   if(c.items[i]?.name!==it.name)continue;
   if(typeof root.bank_store!=='function')break;
   await Promise.resolve(root.bank_store(i,'items0',slot));
   for(let n=0;n<24&&c.items[i]?.name===it.name;n++)await WAIT(200);
   if(c.items[i]?.name!==it.name)state.bankItemsStored++;
  }
 }
 state.bankVisits++;
 await Promise.resolve(root.transport('main',3));
 for(let i=0;i<55&&c.map!=='main';i++)await WAIT(220);
 if(c.map!=='main')throw Error('BANK_RETURN_UNCONFIRMED');
 report('BANK_RETURN');
}
async function defense(){
 if(stopRequested)return;
 if(!live()){
  if(c.rip===true&&typeof root.respawn==='function'){
   if(respawnSince==null)respawnSince=Date.now();
   if(Date.now()-respawnSince>3000&&Date.now()-lastRespawn>15000){
    lastRespawn=Date.now();try{await root.respawn()}catch(e){error(e)}
   }
  }
  return;
 }
 respawnSince=null;
 const threaten=Object.values(host.entities||{}).some(e=>e?.type==='monster'&&!e.dead&&
  (e.target===c.name||e.target===c.id));
 if(threaten&&Date.now()-lastScare>950&&root.can_use?.('scare')===true){
  lastScare=Date.now();
  try{await root.use_skill('scare');state.scares++}catch(e){error(e)}
 }
 if(c.max_hp-c.hp>200&&Date.now()-lastPotion>2150){
  lastPotion=Date.now();
  try{
   if(typeof root.use_hp_or_mp==='function')await root.use_hp_or_mp();
   else if(root.can_use?.('use_hp'))await root.use_skill('use_hp');
   state.potions++;
  }catch(e){error(e)}
 }
 if(Date.now()-lastMluck>10000&&root.can_use?.('mluck')===true&&
   !(c.s?.mluck?.ms>120000)){
  lastMluck=Date.now();
  try{await root.use_skill('mluck',c);state.mlucks++}catch(e){error(e)}
 }
}
async function work(){
 if(busy||stopRequested||!live())return;
 busy=true;
 try{
  if(c.map!=='main'&&c.map==='bank'){
    await Promise.resolve(root.transport('main',3));
    for(let i=0;i<55&&c.map!=='main';i++)await WAIT(200);
  }
  if(c.map!=='main')throw Error('TOWN_SERVICE_ONLY_MAIN_OR_BANK');
  if(!c.stand||dist(pos(),STAND)>16)await atStand();
  try{await bankVisit()}catch(e){error(e);report('BANK_DEFERRED')}
  if(c.map==='main'&&(!c.stand||dist(pos(),STAND)>16))
    await atStand();
  if(c.map==='main'&&c.stand)report('STAND');
 }catch(e){error(e);report('STAND_RETRY_DEFERRED')}
 finally{busy=false}
}
watchdog=root.setInterval(()=>{void defense().catch(error)},1150);
working=root.setInterval(()=>{void work().catch(error)},6500);
const api={role:'Rentaro',active:true,state,status(){return JSON.parse(JSON.stringify(state))},
 stop(){stopRequested=true;state.active=false;api.active=false;root.clearInterval(watchdog);
 root.clearInterval(working);report('STOPPED');return{ok:true}}};
host.__O66_RENTARO_TOWN_SERVICE=api;
void defense().catch(error);
void work().catch(error);
try{root.game_log?.('O66 Rentaro native stand/mluck/bank restored')}catch(_){}
})(globalThis);
