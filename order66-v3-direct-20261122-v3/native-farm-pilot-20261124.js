/* Order66 native farm pilot, 2026-11-24.
 * Source-owned in PogiBrain; delivery copy on public GitHub.
 * No movement. The PogiPath v65 convoy owns movement until arrival;
 * Warrior protects group, Mage only attacks mobs targeting tank,
 * Priest remains heal-first via its independent native heartbeat.
 */
(function(root){
'use strict';
const name=String(root?.character?.name||'');
if(!['Souji','Hibari','Harutora'].includes(name))return;
if(root.__O66_NATIVE_FARM_PILOT?.active===true)return;
const FARM={map:'halloween',x:-495.5,y:685.5};
const GROUP=new Set(['Rentaro','Souji','Hibari','Harutora']);
const ROLE_TANK='Hibari',ROLE_HEAL='Souji';
const now=()=>Date.now();
const distance=(a,b)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));
const pos=x=>({map:x?.map,x:Number(x?.real_x??x?.x),y:Number(x?.real_y??x?.y)});
const c=()=>root.character;
const alive=x=>!!x&&x.rip!==true&&x.dead!==true&&Number(x.hp)>0;
const entities=()=>Object.values(root.parent?.entities||root.entities||{}).filter(Boolean);
const player=n=>{
  if(n===name)return c();
  try{return root.get_player?.(n)||root.parent?.entities?.[n]||null;}catch(_){return null}
};
const metric=(a,b)=>distance(pos(a),pos(b));
const visible=n=>{const x=player(n);return alive(x)&&x.map===c()?.map&&
   String(x.in??c()?.in??'')===String(c()?.in??'')?x:null;};
const state={name,active:true,start:now(),phase:'READY',ticks:0,
  attacks:0,taunts:0,potions:0,townEscapes:0,errors:0,lastError:null,
  lastAction:null,lastTarget:null,priestDistance:null,warriorDistance:null,
  session:'ORDER66_NATIVE_FARM_PILOT_20261124'};
let busy=false,lastAttack=0,lastTaunt=0,lastPotion=0,lastTown=0,timer=null;
function ready(){
 const heal=visible(ROLE_HEAL),tank=visible(ROLE_TANK);
 state.priestDistance=heal?Math.round(metric(c(),heal)):null;
 state.warriorDistance=tank?Math.round(metric(c(),tank)):null;
 if(!heal||!tank)return false;
 if(metric(heal,tank)>80)return false;
 if(name==='Harutora'&&metric(c(),tank)>105)return false;
 if(name==='Hibari'&&metric(c(),heal)>80)return false;
 return true;
}
function safeFarm(){
 return c()?.map==='halloween'&&distance(pos(c()),FARM)<185;
}
function enemies(){
 const rows=entities().filter(e=>e.type==='monster'&&!e.dead&&!e.rip&&
   Number(e.hp)>0&&e.map!==false);
 rows.sort((a,b)=>metric(c(),a)-metric(c(),b));
 return rows;
}
async function selfHeal(){
 if(!alive(c())||now()-lastPotion<2300||c().hp/c().max_hp>=.77)return;
 lastPotion=now();
 try{const v=root.use_hp_or_mp?.();if(v?.then)await v;state.potions++}
 catch(e){state.errors++;state.lastError='POTION_'+String(e?.message||e)}
}
async function escapeIfCritical(){
 if(!alive(c())||c().map!=='halloween'||
   c().hp/c().max_hp>.33||now()-lastTown<20000)return false;
 lastTown=now();
 try{
  const p=typeof root.town==='function'?root.town():root.use_skill?.('use_town');
  if(p?.then)await p;
  state.townEscapes++;state.lastAction='CRITICAL_HP_NATIVE_TOWN';
 }catch(e){state.errors++;state.lastError='TOWN_'+String(e?.message||e)}
 return true;
}
async function execute(){
 if(!state.active||busy)return;
 busy=true;state.ticks++;
 try{
  const self=c();
  if(!alive(self)){state.phase='DEAD_AUTO_RESPAWN_OWNED_SEPARATELY';return}
  await selfHeal();
  if(await escapeIfCritical()){state.phase='EMERGENCY_TOWN';return}
  if(name==='Souji'){
    state.phase='HEAL_FIRST';
    if(root.__POGI_V3_PRIEST_HEAL?.status?.()?.running!==true){
      state.lastError='SOUJI_NATIVE_HEAL_OWNER_NOT_RUNNING';state.errors++;
    }
    return;
  }
  const healNear=ready();
  if(!safeFarm()){state.phase='WAIT_SAVED_ROUTE_ARRIVAL';return}
  const mobs=enemies();
  if(name==='Hibari'){
    // Rescue Mage or Priest even if separated; do not taunt
    // unrelated bosses or steal another player's farming targets.
    const rescue=mobs.find(e=>['Souji','Harutora'].includes(String(e.target||''))&&
      metric(self,e)<=Number(root.G?.skills?.taunt?.range||200));
    if(rescue&&now()-lastTaunt>700&&root.can_use?.('taunt')===true){
      lastTaunt=now();
      try{await root.use_skill('taunt',rescue);state.taunts++;
        state.lastAction='HEALER_MAGE_RESCUE_TAUNT';state.lastTarget=rescue.id||null;
      }catch(e){state.errors++;state.lastError='TAUNT_'+String(e?.message||e)}
    }
  }
  if(!healNear){state.phase='WAIT_HEALER_WITHIN_80';return}
  const maxRange=Number(self.range||50);
  const target=mobs.find(e=>{
   if(metric(self,e)>maxRange+3)return false;
   if(e.mtype!=='xscorpion'&&e.mtype!=='minimush')return false;
   if(name==='Harutora')return String(e.target||'')==='Hibari';
   return e.mtype==='xscorpion'&&
     (!e.target||String(e.target)==='Hibari')||
     String(e.target||'')==='Hibari';
  });
  if(!target){state.phase='WAIT_TANKED_FARM_TARGET';return}
  if(now()-lastAttack<Math.max(220,1000/Math.max(.6,Number(self.frequency)||1)))return;
  if(root.can_attack?.(target)===false)return;
  lastAttack=now();
  try{
   const result=root.attack(target);
   if(result?.then)await result;
   state.attacks++;state.phase='FARMING';
   state.lastAction='NATIVE_BASIC_ATTACK';state.lastTarget=target.id||null;
  }catch(e){state.errors++;state.lastError='ATTACK_'+String(e?.message||e)}
 }finally{busy=false}
}
timer=root.setInterval(()=>{void execute().catch(e=>{
 state.errors++;state.lastError='PILOT_TICK_'+String(e?.message||e);
})},420);
const api={active:true,role:name,status(){return {...state,active:api.active}},
 stop(){api.active=false;state.active=false;root.clearInterval(timer);
  return{ok:true,role:name,stopped:true}}};
root.__O66_NATIVE_FARM_PILOT=api;
try{root.game_log?.('O66 '+name+' tank/heal-first farm pilot loaded')}catch(_){}
})(globalThis);
