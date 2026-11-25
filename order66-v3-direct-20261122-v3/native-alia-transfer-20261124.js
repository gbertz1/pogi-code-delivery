/* ORDER66 — optional MAIN TOWN -> Alia -> Desertland transporter connector.
 * This is NOT an edit of Rentaro's main route. All 21 Main legs passed
 * live Adventure Land can_move checks on 2026-11-24. One-time staged transfer.
 * Green scorpion farming resumes separately only after a Desertland check.
 */
(async function(top){
'use strict';
if(top.__O66_ALIA_TRANSFER?.active)throw Error('ALREADY_RUNNING_TRANSFER');
const P=[
 [0,0],[24,-24],[24,-48],[48,-72],[24,-96],[24,-120],
 [48,-144],[48,-168],[48,-192],[48,-216],[48,-240],
 [48,-264],[48,-288],[48,-312],[48,-336],[24,-360],
 [0,-384],[-24,-384],[-48,-384],[-72,-384],[-85,-389]
];
const names=['Hibari','Souji','Harutora'];
const g=n=>top.document.getElementById('ichar'+n.toLowerCase())
 ?.contentWindow?.document?.getElementById('maincode')?.contentWindow;
const w=Object.fromEntries(names.map(n=>[n,g(n)]));
const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pos=f=>({map:f.character.map,
 x:Number(f.character.real_x??f.character.x),
 y:Number(f.character.real_y??f.character.y)});
const wait=ms=>new Promise(r=>top.setTimeout(r,ms));
const state={active:true,phase:'PREFLIGHT',source:'POGIPATH_V65_OPTIONAL_ALIA_CONNECTOR',
 sourceStatus:'SEPARATE_FROM_MAIN_ROUTES',started:Date.now(),
 steps:0,moves:0,transports:0,last:null,error:null};
const log=(phase,rest={})=>{
 state.phase=phase;state.last={at:Date.now(),...rest};
 top.console.log('O66_ALIA_TRANSFER',JSON.stringify({phase,...rest}));
};
function healthy(map){
 for(const n of names){
  const f=w[n],c=f?.character;
  if(!c||c.rip||c.dead||c.map!==map||!(c.hp>0))
    throw Error('PARTY_NOT_ALIVE_ON_'+map+'_'+n);
  if(c.hp/c.max_hp<.65)throw Error('PARTY_HP_TOO_LOW_'+n);
  const party=Object.keys(f.get_party?.()||{});
  if(!names.every(q=>party.includes(q)))throw Error('PARTY_DISBANDED_'+n);
  if(f.__POGI_V3_DIRECT_RUNTIME?.scheduler?.status?.()?.running)
    throw Error('UNVERIFIED_OLD_FARM_SCHEDULER_'+n);
 }
 if(w.Souji.__POGI_V3_PRIEST_HEAL?.status?.()?.running!==true)
  throw Error('HEALER_NOT_RUNNING');
}
async function arrival(n,aim,map,timeout=11000){
 const until=Date.now()+timeout;
 while(Date.now()<until){
  const at=pos(w[n]);
  if(at.map===map&&d(at,aim)<10)return true;
  await wait(150);
 }
 throw Error('NATIVE_ARRIVAL_NOT_PROVEN_'+n+'_'+map);
}
async function move(n,goal){
 const f=w[n],from=pos(f),to={map:from.map,x:goal[0],y:goal[1]};
 if(d(from,to)<9)return;
 // First waypoint may be ~65-80px from one random Town landing.
 // Do a short native-verified join toward it, never a long blind move.
 if(state.steps===0&&d(from,to)>65&&d(from,to)<100){
   const len=d(from,to);
   const mid={x:from.x+(to.x-from.x)*Math.min(35,len/2)/len,
     y:from.y+(to.y-from.y)*Math.min(35,len/2)/len};
   if(f.can_move?.({map:'main',x:from.x,y:from.y,
       going_x:mid.x,going_y:mid.y,base:f.character.base})!==true)
     throw Error('TOWN_JOIN_NATIVE_COLLISION_DENIED_'+n);
   const r=f.move(mid.x,mid.y);if(r?.catch)r.catch(()=>{});
   await arrival(n,mid,'main');
   return move(n,goal);
 }
 if(d(from,to)>65)throw Error('OPTIONAL_SEGMENT_TOO_LONG_'+n);
 if(f.can_move?.({map:from.map,x:from.x,y:from.y,
   going_x:to.x,going_y:to.y,base:f.character.base})!==true)
   throw Error('NATIVE_COLLISION_DENIED_'+n+'_STEP'+state.steps);
 const req=f.move(to.x,to.y);if(req?.catch)req.catch(()=>{});
 await arrival(n,to,from.map);
 state.moves++;
}
async function nativeTown(n){
 const f=w[n],at=pos(f),center={x:0,y:0};
 if(at.map!=='main')throw Error('MAIN_REQUIRED');
 if(d(at,center)>75){
   const result=typeof f.town==='function'?f.town():f.use_skill?.('use_town');
   if(result?.then)await result;
   // Actual native game Town landings may be 60px from map origin;
   // a successful cast is not evidence of exactly x=0,y=0.
   const end=Date.now()+16000;
   while(Date.now()<end&&d(pos(f),center)>75)await wait(160);
   if(d(pos(f),center)>75)throw Error('NATIVE_TOWN_SPAWN_NOT_REACHED_'+n);
 }
 // Native Town can land at any verified point within the center's
 // arrival circle. Do NOT force all characters to exact (0,0):
 // Hibari's (37,-15) landing did not complete move(0,0).
 // The OPTIONAL connector joins each landing directly at P[1].
 const land=pos(f);
 if(d(land,center)>75)throw Error('NATIVE_TOWN_NOT_WITHIN_CENTER_'+n);
}
async function transport(n){
 const f=w[n],at=pos(f),npc={x:-83,y:-441};
 if(at.map!=='main'||d(at,npc)>100)throw Error('NOT_AT_MAIN_ALIA_'+n);
 if(f.G?.npcs?.transporter?.places?.desertland!==1||
   !Array.isArray(f.G?.maps?.desertland?.spawns?.[1]))
    throw Error('GAME_TRANSPORTER_REFERENCE_MISMATCH');
 const result=f.transport('desertland',1);
 if(result?.catch)result.catch(()=>{});
 const until=Date.now()+15000;
 while(Date.now()<until){
  const p=pos(f);
  if(p.map==='desertland'&&d(p,{x:10,y:-386})<75){
   state.transports++;return;
  }
  if(p.map!=='main'&&p.map!=='desertland')throw Error('UNEXPECTED_TRANSPORT_'+n+'_'+p.map);
  await wait(200);
 }
 throw Error('DESERTLAND_ARRIVAL_NOT_CONFIRMED_'+n);
}
top.__O66_ALIA_TRANSFER={state,stop(){state.active=false}};
try{
 healthy('main');
 log('TOWN');
 for(const n of ['Souji','Hibari','Harutora'])await nativeTown(n);
 healthy('main');
 log('ALONG_OPTIONAL_CONNECTOR',{legs:P.length-1});
 for(const goal of P.slice(1)){
  if(!state.active)throw Error('USER_STOPPED_TRANSFER');
  healthy('main');
  for(const n of names)await move(n,goal);
  state.steps++;
  if(state.steps%5===0)log('MAIN_PROGRESS',{steps:state.steps,at:goal});
 }
 log('TRANSPORTER');
 for(const n of ['Souji','Hibari','Harutora'])
   await transport(n);
 healthy('desertland');
 state.active=false;
 log('DESERTLAND_SAFE_STAGE',{steps:state.steps,transports:state.transports,
  positions:Object.fromEntries(names.map(n=>[n,pos(w[n])]))});
}catch(e){
 state.error=String(e?.message||e);state.active=false;
 log('HALTED',{reason:state.error,positions:Object.fromEntries(
  names.map(n=>[n,w[n]?pos(w[n]):null]))});
}
})(globalThis);
