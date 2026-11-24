/* ORDER66 V3 DIRECT | no Bridge or supervised admission | one game tab */
(async function(root){
  'use strict';
  const role=root?.character?.name;
  if(!['Rentaro','Souji','Hibari','Harutora'].includes(role))return;
  if(root.__O66_DIRECT_LOADING===true||root.__POGI_V3_DIRECT_STATUS?.active===true)return;
  root.__O66_DIRECT_LOADING=true;
  const status={role,phase:'FETCH',at:Date.now(),error:null};
  root.__O66_DIRECT_LOAD_STATUS=status;
  try{
    const base='https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/main/order66-v3-direct-20261122-v3/';
    const texts=await Promise.all(Array.from({length:12},async(_,i)=>{
      const name='part'+String(i).padStart(2,'0')+'.txt';
      const res=await fetch(base+name,{mode:'cors',cache:'no-store'});
      if(!res.ok)throw Error('O66_PART_DOWNLOAD_'+name+'_HTTP_'+res.status);
      return res.text();
    }));
    // ORDER66 2026-11-23 restart guard. The old Harutora orbit override
    // moved independently of Hibari/Souji and caused repeated deaths.
    // Retire it BEFORE evaluating this legacy bundle, until the repaired
    // GitHub-first V3 candidate replaces this entire delivery.
    if(role==='Harutora'){
      const guard={role:'Harutora',active:true,retired:true,
        status:()=>({role:'Harutora',active:false,retired:true}),
        stop:()=>({ok:true,retired:true})};
      root.__O66_V3_FARM_COMBAT_PARITY=guard;
      status.legacyMageOrbitDisabled=true;
    }
    status.phase='EVAL';
    (0,eval)(texts.join(''));
    status.phase='STARTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e&&e.message||e);
    try{root.game_log?.('O66 '+role+' direct failed: '+status.error);}catch(_){}
    console.error('O66_V3_DIRECT_LOADER_ERROR',role,e);
  }finally{root.__O66_DIRECT_LOADING=false;}
})(globalThis);
