/* ORDER66 V3 Rentaro merchant duties — full pinned PogiPath v29, one game tab. */
(async function(root){
'use strict';
const c=root.character,host=root.parent||root;
if(!c||c.name!=='Rentaro')return;
if(root.__O66_MERCHANT_V29_DIRECT_LOADING||host.__O66_MERCHANT_DUTIES?.active===true)return;
root.__O66_MERCHANT_V29_DIRECT_LOADING=true;
const status={at:Date.now(),phase:'FETCH',error:null,bytes:0,routeSteps:0};
root.__O66_MERCHANT_V29_DIRECT_LOAD_STATUS=status;
try{
 const base='https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/main/order66-v3-merchant-v29-20261122/';
 const names=['pack00.txt','pack01.txt','pack02.txt','runner.js','duties.js'];
 const texts=await Promise.all(names.map(async n=>{
  const r=await root.fetch(base+n,{cache:'no-store',mode:'cors'});
  if(!r.ok)throw Error('MERCHANT_V29_FETCH_'+n+'_HTTP_'+r.status);
  return r.text();
 }));
 status.bytes=texts.reduce((n,s)=>n+s.length,0);
 const data=JSON.parse(texts.slice(0,3).join(''));
 if(data.name!=='ORDER66_RENTARO_MERCHANT_FULL_CIRCUIT_V29'||
   !Array.isArray(data.cycle)||data.cycle.length!==995||
   !Array.isArray(data.initial)||data.initial.length!==0||
   data.cycle[863]?.x!==-253.55556||data.cycle[863]?.y!==680){
   throw Error('MERCHANT_V29_PACKAGE_CONTENT_MISMATCH');
 }
 status.phase='INSTALL';status.routeSteps=data.cycle.length;
 host.__O66_V29_PACKAGE=data;
 host.__O66_V29_PREFLIGHT={badCount:0,warningCount:0,
  hash:'936cf089b4eba278df09638b5b2bd70aed447e2a97d13f03d5c9d4b711f0b7bf'};
 host.__O66_V29_RUNNER_SOURCE=texts[3];
 // MerchantDutyLoopV29 owns stand, native route, mluck, bank, and pickup.
 // Stop only competing V3 merchant state ticks; leave the fighter frames,
 // Party, Priest, and every existing game tab untouched.
 const runtime=root.__POGI_V3_DIRECT_RUNTIME;
 if(runtime?.scheduler?.status?.()?.running===true){
  runtime.scheduler.stop();
  status.merchantGenericSchedulerStopped=true;
 }
 status.phase='STARTING';
 (0,eval)(texts[4]);
 status.phase=host.__O66_MERCHANT_DUTIES?.active?'RUNNING':'START_REQUESTED';
 status.dutyPhase=host.__O66_MERCHANT_DUTIES?.phase||null;
 try{root.game_log?.('O66 Rentaro merchant v29 duties started')}catch(_){}
 console.log('O66_MERCHANT_V29_START',status);
}catch(e){
 status.error=String(e?.message||e);status.phase='FAILED';
 console.error('O66_MERCHANT_V29_ERROR',e);
 try{root.game_log?.('O66 Merchant v29 failed: '+status.error)}catch(_){}
 // A download problem should not prevent fallback to the V3 Stand role.
 const runtime=root.__POGI_V3_DIRECT_RUNTIME;
 if(runtime?.scheduler?.status?.()?.running!==true)runtime?.scheduler?.start?.();
}finally{root.__O66_MERCHANT_V29_DIRECT_LOADING=false;}
})(globalThis);
