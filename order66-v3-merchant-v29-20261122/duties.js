/* ORDER66 V3 MERCHANT DUTIES — Rentaro-only session controller.
 * GitHub-first source. No fighter launch/add-party, no smart_move, no paid services.
 * Patrol calls separately pinned, live-tested v26 ONE-CYCLE runner; stops on failure.
 */
(function(root){
'use strict';
const host=root.parent||root,c=root.character,now=()=>Date.now();
const OWNER='ORDER66_MERCHANT_DUTIES_V29';
const IDLE={map:'main',x:-300,y:-100};
const ANCHOR={map:'main',x:25.55,y:-30.92};
const MAIN_TOWN={map:'main',x:0,y:0};
const BANK_ENTRY={map:'main',x:168,y:-134};
const WAIT_STAND_MS=180000,WAIT_PICKUP_MS=18000,WAIT_BETWEEN_MS=500;
const FREE_SLOTS_BANK=5,DEPOSIT_AT_GOLD=60000000,RETAIN_GOLD=50000000;
const PARTY_NAMES=new Set(['Hibari','Harutora','Souji']);
const BANKABLE_ITEMS0=new Set(['ascale','bfur','bwing','cscale','dstones','essenceoffrost','essenceoffire','essenceofgreed','feather0','funtoken','gem1','gemfragment','leather','lotusf','mistletoe','monstertoken','ornament','pleather','pvptoken','rattail','seashell','smush','spidersilk','snakefang','stormfeather','svenom','talkingskull','voidthread']);
const MAX_BANK_ITEMS_PER_TRIP=8;
const previousMerchant=host.__O66_MERCHANT_DUTIES;
const state={version:29,owner:OWNER,phase:'STARTING',active:true,startedAt:now(),updatedAt:now(),stopRequested:false,patrolCycles:Number(previousMerchant?.patrolCycles||0),standOpens:Number(previousMerchant?.standOpens||0),bankVisits:Number(previousMerchant?.bankVisits||0),bankGoldDeposited:Number(previousMerchant?.bankGoldDeposited||0),itemsStored:Number(previousMerchant?.itemsStored||0),partyPickups:Number(previousMerchant?.partyPickups||0),scares:Number(previousMerchant?.scares||0),potions:Number(previousMerchant?.potions||0),lastError:null,events:[],standUntil:null,partyDisabled:false,partyLaunchDisabled:true,shopAutoSalesDisabled:true,scoutRoute:'v29',minGoldToDeposit:DEPOSIT_AT_GOLD,retainGold:RETAIN_GOLD};
if(host.__O66_MERCHANT_DUTIES?.active||host.__O66_MERCHANT_DUTIES_V1?.active){return;}
host.__O66_MERCHANT_DUTIES=state;
host.__O66_MERCHANT_DUTIES_V1=state;
const delay=ms=>new Promise(resolve=>root.setTimeout(resolve,ms));
const pos=()=>({map:c.map,x:Number(c.real_x??c.x),y:Number(c.real_y??c.y)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const freeSlots=()=>Array.isArray(c.items)?c.items.filter(x=>!x).length:0;
const gold=()=>Math.floor(Number(c.gold)||0);
const valid=()=>c&&c.name==='Rentaro'&&c.ctype==='merchant'&&!c.rip&&c.hp>0;
const gameSocket=()=>!!(root.socket?.connected||host.socket?.connected);
function log(message){state.events.push({at:now(),phase:state.phase,message:String(message).slice(0,150)});if(state.events.length>30)state.events.shift();}
function report(phase){
 if(phase)state.phase=phase;
 state.updatedAt=now();
 const p=pos();
 Object.assign(state,{map:p.map,x:p.x,y:p.y,hp:c.hp,maxHp:c.max_hp,mp:c.mp,gold:gold(),freeSlots:freeSlots(),standOpen:!!c.stand,partyNames:partyCurrent(),runnerPhase:host.__O66_V29_STATUS?.phase||null,runnerStep:host.__O66_V29_STATUS?.step||null});
 try{host.document.title=('ORDER66_DUTIES_'+state.phase+'_C'+state.patrolCycles+'_BANK'+state.bankVisits+'_G'+Math.round(state.gold/1000000)+'M_'+p.map+'_'+Math.round(p.x)+','+Math.round(p.y)+'_HP'+c.hp).slice(0,207)}catch(_){}
 try{host.localStorage.setItem('O66_MERCHANT_DUTIES_LAST',JSON.stringify(state))}catch(_){}
}
function assertHealthy(map){
 if(!state.active||state.stopRequested||host.__O66_MERCHANT_DUTIES_STOP)throw Error('STOP_REQUESTED');
 if(!valid())throw Error('RENTARO_NOT_SAFE_OR_NOT_ALIVE');
 if(map&&c.map!==map)throw Error('WRONG_MAP_EXPECT_'+map+'_ACTUAL_'+c.map);
 if(!gameSocket())throw Error('GAME_SOCKET_DISCONNECTED');
 if(c.hp<Math.max(500,c.max_hp*.3))throw Error('LOW_HP_STOP');
}
function partyCurrent(){
 const known=[];
 const p=host.party||{};
 for(const k of Object.keys(p))if(PARTY_NAMES.has(k))known.push(k);
 return known;
}
function canMoveTo(target){
 const p=pos();
 if(target.map!==p.map)return false;
 try{return !!root.can_move({map:p.map,x:p.x,y:p.y,going_x:target.x,going_y:target.y,base:c.base})}catch(_){return false}
}
async function nativeMoveTo(target,label){
 assertHealthy(target.map);
 if(distance(pos(),target)<6)return;
 if(!canMoveTo(target))throw Error('FIXED_LEG_BLOCKED_'+label+'_'+Math.round(pos().x)+','+Math.round(pos().y)+'_TO_'+target.x+','+target.y);
 const maxMs=Math.max(12000,Math.min(80000,Math.ceil(distance(pos(),target)/Math.max(35,c.speed||55)*3800)+12000)),deadline=now()+maxMs;
 try{const r=root.move(target.x,target.y);if(r?.catch)r.catch(()=>{});}catch(e){throw Error('MOVE_ERROR_'+label+'_'+String(e?.message||e))}
 let last=pos(),progress=now();
 while(now()<deadline){
  await delay(160);assertHealthy(target.map);
  const p=pos();
  if(distance(p,target)<6)return;
  if(distance(p,last)>4){last=p;progress=now()}
  if(now()-progress>10500)throw Error('MOVE_STALLED_'+label);
 }
 throw Error('MOVE_TIMEOUT_'+label);
}
async function closeStand(){
 if(!c.stand)return;
 if(typeof root.close_stand==='function'){await Promise.resolve(root.close_stand())}
 else if(typeof host.close_merchant==='function'){await Promise.resolve(host.close_merchant())}
 else throw Error('STAND_CLOSE_UNAVAILABLE');
 const end=now()+5000;
 while(c.stand&&now()<end)await delay(160);
 if(c.stand)throw Error('STAND_CLOSE_NOT_CONFIRMED');
 log('STAND_CLOSED');
}
async function atStand(){
 assertHealthy('main');
 if(distance(pos(),IDLE)>16){
  await closeStand();
  if(canMoveTo(IDLE)){await nativeMoveTo(IDLE,'IDLE_DIRECT')}
  else{
   // Fixed known Main-town anchors only; do not search or SmartMove.
   if(canMoveTo(ANCHOR))await nativeMoveTo(ANCHOR,'MAIN_ANCHOR');
   if(!canMoveTo(IDLE))throw Error('NO_FIXED_STAND_CORRIDOR');
   await nativeMoveTo(IDLE,'IDLE_FROM_ANCHOR');
  }
 }
 assertHealthy('main');
 if(!c.stand){
  if(typeof root.open_stand==='function')await Promise.resolve(root.open_stand());
  else if(typeof host.open_merchant==='function'){
   const slot=c.items.findIndex(x=>x?.name==='stand0');if(slot<0)throw Error('STAND_ITEM_MISSING');
   await Promise.resolve(host.open_merchant(slot));
  }else throw Error('STAND_OPEN_UNAVAILABLE');
  const deadline=now()+6500;
  while(!c.stand&&now()<deadline)await delay(180);
  if(!c.stand)throw Error('STAND_OPEN_NOT_CONFIRMED');
  state.standOpens++;log('STAND_OPENED');
 }
 report('STAND');
}
async function moveTownToBank(){
 assertHealthy('main');await closeStand();
 // Stand-to-bank joins are deliberately fixed and fail closed on live can_move.
 const route=[ANCHOR,MAIN_TOWN,BANK_ENTRY];
 for(const wp of route){
  if(distance(pos(),wp)<10)continue;
  if(!canMoveTo(wp)){
   // Short-cut to the next verified anchor when currently safe; never search.
   if(wp===ANCHOR&&canMoveTo(MAIN_TOWN))continue;
   if(wp===MAIN_TOWN&&canMoveTo(BANK_ENTRY))continue;
   throw Error('BANK_FIXED_CORRIDOR_BLOCKED_'+wp.x+','+wp.y);
  }
  await nativeMoveTo(wp,'BANK_MAIN_LEG');
 }
 const p=pos();
 if(distance(p,BANK_ENTRY)>18)throw Error('BANK_DOOR_NOT_REACHED');
}
async function changeMap(target,spawn,label){
 const from=c.map;
 if(typeof root.transport!=='function')throw Error('TRANSPORT_UNAVAILABLE');
 const out=root.transport(target,spawn);if(out?.catch)out.catch(()=>{});
 const deadline=now()+14000;
 while(now()<deadline){
  await delay(200);assertHealthy();
  if(c.map===target){log('TRANSPORT_'+from+'_TO_'+target);return;}
  if(c.map!==from)throw Error('UNEXPECTED_BANK_TRANSPORT_MAP_'+c.map);
 }
 throw Error('BANK_TRANSPORT_TIMEOUT_'+label);
}
function approvedItems(){
 const rows=[];
 for(let i=0;i<(c.items||[]).length;i++){
  const item=c.items[i];
  if(item&&BANKABLE_ITEMS0.has(item.name)&&item.p==null&&Number(item.level||0)===0)rows.push({i,name:item.name});
 }
 return rows;
}
function needsBank(){
 const items=approvedItems();
 return gold()>=DEPOSIT_AT_GOLD||(freeSlots()<=FREE_SLOTS_BANK&&items.length>0);
}
async function bankTrip(){
 assertHealthy('main');report('BANK_TRAVEL');
 await moveTownToBank();
 await changeMap('bank',0,'ENTER');
 state.bankVisits++;report('BANK');
 if(gold()>=DEPOSIT_AT_GOLD){
  const amount=Math.max(0,gold()-RETAIN_GOLD);
  const before=gold();
  if(amount>0){
   if(typeof root.bank_deposit!=='function')throw Error('BANK_DEPOSIT_UNAVAILABLE');
   const req=root.bank_deposit(amount);if(req?.catch)req.catch(()=>{});
   const deadline=now()+6000;
   while(now()<deadline&&gold()===before)await delay(250);
   const changed=before-gold();
   if(changed!==amount)throw Error('BANK_GOLD_CHANGE_NOT_PROVEN_'+changed+'_WANT_'+amount);
   state.bankGoldDeposited+=changed;log('BANK_GOLD_'+changed);
  }
 }
 const items=approvedItems();
 if(items.length&&c.bank?.items0&&Array.isArray(c.bank.items0)){
  for(const item of items.slice(0,MAX_BANK_ITEMS_PER_TRIP)){
   const pack=c.bank.items0;
   const slot=pack.findIndex(x=>x==null);
   if(slot<0){log('ITEMS0_FULL_STOP_STORING');break;}
   const old=c.items[item.i];
   if(old?.name!==item.name)continue;
   if(typeof root.bank_store!=='function')throw Error('BANK_STORE_UNAVAILABLE');
   const req=root.bank_store(item.i,'items0',slot);if(req?.catch)req.catch(()=>{});
   const deadline=now()+6500;
   while(now()<deadline&&c.items[item.i]?.name===item.name)await delay(220);
   if(c.items[item.i]?.name===item.name)throw Error('BANK_ITEM_STORE_NOT_CONFIRMED_'+item.name);
   state.itemsStored++;log('BANK_ITEM_'+item.name);
   await delay(420);
  }
 }else if(items.length)log('BANK_ITEM_PACK_NOT_LOADED_KEEP_INVENTORY');
 await changeMap('main',3,'EXIT');
 report('BANK_RETURN');
 // Bank exit main spawn #3, use verified fixed Main-town anchors.
 if(canMoveTo(ANCHOR))await nativeMoveTo(ANCHOR,'BANK_EXIT_TO_ANCHOR');
 else if(canMoveTo(MAIN_TOWN))await nativeMoveTo(MAIN_TOWN,'BANK_EXIT_TO_TOWN');
 else throw Error('BANK_EXIT_NO_SAFE_ROUTE');
 await atStand();
}
function nearbyExistingParty(){
 if(c.map!=='main')return null;
 const names=partyCurrent();if(!names.length)return null;
 const p=pos();
 for(const name of names){
  const entity=typeof root.get_player==='function'?root.get_player(name):host.entities?.[name];
  if(!entity||entity.rip||entity.map!=='main')continue;
  const x=Number(entity.real_x??entity.x),y=Number(entity.real_y??entity.y);
  if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  if(Math.hypot(p.x-x,p.y-y)<=220)return{name,x,y};
 }
 return null;
}
async function pickupExistingParty(){
 const friend=nearbyExistingParty();
 if(!friend)return false;
 assertHealthy('main');
 report('PARTY_PICKUP');
 log('EXISTING_PARTY_VISIBLE_'+friend.name);
 await closeStand();
 const p=pos(),aim={map:'main',x:friend.x-22,y:friend.y};
 if(Math.hypot(p.x-friend.x,p.y-friend.y)>70){
  if(canMoveTo(aim))await nativeMoveTo(aim,'VISIBLE_PARTY_PICKUP');
  else{log('PARTY_NOT_SAFE_TO_APPROACH');await atStand();return false;}
 }
 const before={gold:gold(),freeSlots:freeSlots()};
 const until=now()+WAIT_PICKUP_MS;
 while(now()<until){assertHealthy('main');report('PARTY_HANDOFF_WAIT');await delay(1500);}
 state.partyPickups++;log('PARTY_HANDOFF_WINDOW_'+friend.name+'_GOLD_DELTA_'+(gold()-before.gold)+'_FREE_SLOTS_DELTA_'+(freeSlots()-before.freeSlots));
 await atStand();return true;
}
async function merchantHealth(){
 if(c.hp>=c.max_hp-200)return;
 if(typeof root.use_hp_or_mp==='function')try{await Promise.resolve(root.use_hp_or_mp());state.potions++}catch(e){log('POTION_ERROR_'+String(e.message||e))}
}
async function merchantMluck(){
 if(!root.can_use?.('mluck'))return;
 if(c.s?.mluck?.ms>120000)return;
 try{const out=root.use_skill('mluck',c);if(out?.catch)out.catch(()=>{});log('SELF_MLUCK')}catch(e){log('MLUCK_ERROR_'+String(e.message||e))}
}
async function patrolOnce(){
 assertHealthy('main');
 if(!host.__O66_V29_PACKAGE||host.__O66_V29_PACKAGE.cycle?.length!==995||
  host.__O66_V29_PACKAGE.name!=='ORDER66_RENTARO_MERCHANT_FULL_CIRCUIT_V29'||
  host.__O66_V29_PREFLIGHT?.badCount!==0||host.__O66_V29_PREFLIGHT?.warningCount!==0||host.__O66_V29_PREFLIGHT?.hash!=='936cf089b4eba278df09638b5b2bd70aed447e2a97d13f03d5c9d4b711f0b7bf')throw Error('PINNED_V29_PATROL_UNAVAILABLE');
 if(typeof host.__O66_V29_RUNNER_SOURCE!=='string'||host.__O66_V29_RUNNER_SOURCE.length<10000)throw Error('PINNED_V29_RUNNER_MISSING');
 if(host.__O66_V29_STATUS?.active)throw Error('PATROL_ALREADY_ACTIVE');
 await closeStand();
 state.phase='PATROL';report('PATROL');
 log('PATROL_STARTED_'+(state.patrolCycles+1));
 host.__O66_V29_STOP=false;
 root.eval(host.__O66_V29_RUNNER_SOURCE);
 let startSeen=false,lastStep=-1,lastProgress=now();
 const deadline=now()+22*60000;
 while(now()<deadline){
  await delay(950);assertHealthy();
  const p=host.__O66_V29_STATUS;
  if(!p){if(!startSeen&&now()-lastProgress>6000)throw Error('PATROL_NO_STATUS');continue}
  startSeen=true;
  if(p.phase==='HALTED')throw Error('PATROL_HALTED_'+p.error);
  if(p.phase==='COMPLETE'){
   if(p.cycle!==1||p.step!==995||p.totalSteps!==995||p.error||p.position?.map!=='main'||
      p.transports!==19||p.townStopsCompleted!==14||
      p.greenScorpionVisits!==1||p.halloweenScorpionVisits!==1)
     throw Error('PATROL_COMPLETION_RECEIPT_INVALID');
   state.patrolCycles++;log('PATROL_COMPLETE_995');report('PATROL_COMPLETE');
   return;
  }
  if(p.phase!=='RUNNING')throw Error('PATROL_WRONG_PHASE_'+p.phase);
  if(p.step!==lastStep){lastStep=p.step;lastProgress=now();}
  if(now()-lastProgress>75000)throw Error('PATROL_NO_STEP_PROGRESS_75S');
  if(now()-state.updatedAt>5000)report('PATROL');
 }
 throw Error('PATROL_22_MIN_TIMEOUT');
}
async function start(){
 let phase='START';
 try{
  if(!valid()||c.map!=='main'||!gameSocket())throw Error('START_REQUIRES_SAFE_MAIN_MERCHANT');
  if(host.__O66_MERCHANT_STATUS?.active||host.__O66_V26_STATUS?.active||host.__O66_V27_STATUS?.active||host.__O66_V28_STATUS?.active||host.__O66_V29_STATUS?.active||host.__O66_MERCHANT_RESUME_STATUS?.active||host.__O66_MERCHANT_RESUME2_STATUS?.active)throw Error('OTHER_ROUTE_RUNNING');
  if(typeof root.can_move!=='function'||typeof root.move!=='function'||typeof root.transport!=='function')throw Error('MOVEMENT_APIS_UNAVAILABLE');
  if(c.slots?.orb?.name!=='jacko')log('JACKO_ORB_NOT_EQUIPPED_SCARE_DEFERRED');
  state.active=true;
  report('STARTING');
  await atStand();
  while(state.active&&!state.stopRequested){
   assertHealthy();report('STAND');
   await merchantHealth();
   await merchantMluck();
   if(needsBank()){log('BANK_TRIGGER');await bankTrip();}
   else if(freeSlots()<=FREE_SLOTS_BANK&&approvedItems().length===0){log('INVENTORY_PRESSURE_HOLD_UNCLASSIFIED_ITEMS');}
   const friend=nearbyExistingParty();
   if(friend){await pickupExistingParty();if(needsBank())await bankTrip();}
   const until=now()+WAIT_STAND_MS;state.standUntil=until;report('STAND');
   while(now()<until){
    await delay(3500);assertHealthy('main');await merchantHealth();
    if(needsBank()||nearbyExistingParty())break;
    report('STAND');
   }
   if(needsBank()||nearbyExistingParty())continue;
   await patrolOnce();
   await atStand();
   await delay(WAIT_BETWEEN_MS);
  }
 }catch(e){
  state.lastError=String(e?.message||e);
  state.active=false;state.stopRequested=true;
  log('HALTED_'+state.lastError);
  try{root.stop?.('move')}catch(_){}
  report('HALTED');
  return;
 }
 state.active=false;report('STOPPED');
}
host.__O66_MERCHANT_DUTIES_STOP=false;
host.__O66_MERCHANT_DUTIES_CONTROL={stop(){host.__O66_MERCHANT_DUTIES_STOP=true;state.stopRequested=true;host.__O66_V29_STOP=true;log('MANUAL_STOP');return true},status(){return JSON.parse(JSON.stringify(state))}};
log('BOOTSTAPPED_MERCHANT_STAND_PATROL_BANK_NO_PARTY_LAUNCH');
start();
})(globalThis);
