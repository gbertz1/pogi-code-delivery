/* ORDER66 — Halloween v65 PogiPath native convoy, one shot, no smart_move.
 * Source: PogiPath editor API model.meta.version 65, section 23.
 * This does NOT activate merchant patrol, edit main routes, or attack mobs.
 * Warrior leads, Priest stays close and keeps independent healing running.
 */
(async function(top){
'use strict';
const request=top.__O66_NATIVE_CONVOY_REQUEST||{target:'PRESTAGE'};
const target=String(request.target||'PRESTAGE');
const saved={
 PRESTAGE:[[0,0],[-0.66667,30.66667],[-8,368],[-200,672]],
 OUTER_FARM:[[-200,672],[-224,680],[-253.55556,680],[-386,683]]
};
if(!saved[target])throw Error('O66_CONVOY_UNKNOWN_STAGE');
if(top.__O66_NATIVE_CONVOY?.active)throw Error('O66_CONVOY_ALREADY_RUNNING');
const root=n=>top.document.getElementById('ichar'+n.toLowerCase())
  ?.contentWindow?.document?.getElementById('maincode')?.contentWindow;
const fighters=Object.fromEntries(['Hibari','Souji','Harutora'].map(n=>[n,root(n)]));
const names=Object.keys(fighters);
const pos=w=>({map:w.character.map,x:Number(w.character.real_x??w.character.x),
 y:Number(w.character.real_y??w.character.y)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wait=ms=>new Promise(ok=>top.setTimeout(ok,ms));
const state={active:true,phase:'PREFLIGHT',target,modelVersion:65,
 source:'POGIPATH_RENTARO_EDITABLE_SECTION_23',began:Date.now(),steps:0,
 moves:0,stopped:false,error:null,last:null,events:[],finish:null};
const report=(phase,details={})=>{
 state.phase=phase;state.last={at:Date.now(),...details};
 state.events.push({phase,at:Date.now(),...details});
 if(state.events.length>18)state.events.shift();
 top.console.log('O66_NATIVE_CONVOY',JSON.stringify({phase,...details}));
};
function healthy(){
 for(const n of names){
  const w=fighters[n],c=w?.character;
  if(!w||!c||c.rip||c.dead||c.map!=='halloween'||!(c.hp>0))
   throw Error('O66_CONVOY_NOT_LIVE_'+n);
  if(c.hp/c.max_hp<(n==='Souji'?.58:.53))
   throw Error('O66_CONVOY_HP_LOW_'+n);
  const party=Object.keys(w.get_party?.()||{});
  if(!names.every(x=>party.includes(x)))throw Error('O66_CONVOY_PARTY_SPLIT_'+n);
  const sched=w.__POGI_V3_DIRECT_RUNTIME?.scheduler?.status?.();
  if(sched?.running===true)throw Error('O66_CONVOY_OLD_SCHEDULER_ACTIVE_'+n);
 }
 if(fighters.Souji.__POGI_V3_PRIEST_HEAL?.status?.()?.running!==true)
  throw Error('O66_CONVOY_PRIEST_HEAL_OFF');
}
function collision(w,to){
 const p=pos(w),c=w.character;
 if(p.map!=='halloween')return false;
 return w.can_move?.({map:p.map,x:p.x,y:p.y,
   going_x:to.x,going_y:to.y,base:c.base})===true;
}
async function moveOne(n,to){
 const w=fighters[n],from=pos(w);
 if(distance(from,to)<7)return;
 if(distance(from,to)>60)throw Error('O66_CONVOY_LEG_OVER_60_'+n);
 if(!collision(w,to))throw Error('O66_CONVOY_NATIVE_BLOCKED_'+n);
 const answer=w.move(to.x,to.y);
 if(answer?.catch)answer.catch(e=>{state.error='MOVE_REJECT_'+n+'_'+String(e?.message||e)});
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  if(state.stopped)throw Error('O66_CONVOY_CANCELLED');
  healthy();
  if(distance(pos(w),to)<9){state.moves++;return;}
  await wait(130);
 }
 throw Error('O66_CONVOY_NOT_ARRIVED_'+n+'_'+state.steps);
}
function legs(pts,step=24){
 const out=[];
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i];
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const count=Math.ceil(d/step);
  for(let j=1;j<=count;j++)out.push({map:'halloween',
   x:a[0]+(b[0]-a[0])*j/count,y:a[1]+(b[1]-a[1])*j/count});
 }
 return out;
}
const controller={state,stop(){state.stopped=true;return{ok:true}}};
top.__O66_NATIVE_CONVOY=controller;
try{
 healthy();
 const start={map:'halloween',x:saved[target][0][0],y:saved[target][0][1]};
 for(const n of names){
  const d=distance(pos(fighters[n]),start);
  if(d>55)throw Error('O66_CONVOY_START_NOT_CONNECTED_'+n+'_'+Math.round(d));
 }
 report('STAGING');
 // Souji starts from the Mage's native Magiport landing (+20,-30);
 // verify the short local join before any path advancement.
 for(const n of ['Souji','Harutora','Hibari'])await moveOne(n,start);
 const route=legs(saved[target]);
 if(route.length>45)throw Error('O66_CONVOY_LEG_COUNT_UNEXPECTED');
 report('WALKING',{legs:route.length});
 for(const waypoint of route){
  if(state.stopped)throw Error('O66_CONVOY_CANCELLED');
  healthy();
  // All three stay within ONE 24px leg of each other, no blind long hops.
  for(const n of ['Hibari','Souji','Harutora'])
    await moveOne(n,waypoint);
  state.steps++;
  if(state.steps%5===0)
    report('PROGRESS',{step:state.steps,at:[Math.round(waypoint.x),Math.round(waypoint.y)]});
 }
 state.finish=Date.now();state.active=false;
 report('COMPLETE',{target,steps:state.steps,moves:state.moves,
  positions:Object.fromEntries(names.map(n=>[n,pos(fighters[n])]))});
}catch(error){
 state.error=String(error?.message||error);state.active=false;
 report('HALTED',{error:state.error,step:state.steps,
  positions:Object.fromEntries(names.map(n=>[n,fighters[n]?pos(fighters[n]):null]))});
}
})(globalThis);
