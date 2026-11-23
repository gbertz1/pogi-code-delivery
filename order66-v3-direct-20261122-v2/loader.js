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
    const base='https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/main/order66-v3-direct-20261122-v2/';
    const texts=await Promise.all(Array.from({length:11},async(_,i)=>{
      const name='part'+String(i).padStart(2,'0')+'.txt';
      const res=await fetch(base+name,{mode:'cors',cache:'no-store'});
      if(!res.ok)throw Error('O66_PART_DOWNLOAD_'+name+'_HTTP_'+res.status);
      return res.text();
    }));
    status.phase='EVAL';
    (0,eval)(texts.join(''));
    status.phase='STARTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e&&e.message||e);
    try{root.game_log?.('O66 '+role+' direct failed: '+status.error);}catch(_){}
    console.error('O66_V3_DIRECT_LOADER_ERROR',role,e);
  }finally{root.__O66_DIRECT_LOADING=false;}
})(globalThis);
