/* ORDER66 V3 | stable CODE-slot entrypoint | V76 route overlay */
(async function(root){
  'use strict';
  const role=root?.character?.name;
  if(!['Rentaro','Souji','Hibari','Harutora'].includes(role))return;
  if(root.__O66_DIRECT_LOADING||root.__POGI_V3_DIRECT_STATUS?.active||root.__POGI_V3_DIRECT_STATUS?.starting)return;
  root.__O66_DIRECT_LOADING=true;
  const status={role,phase:'FETCH',at:Date.now(),error:null,deliveryCommit:'6e0c83dc434dd25fd8cf6f2ddc7dddd6192000c8'};
  root.__O66_DIRECT_LOAD_STATUS=status;
  try{
    const res=await root.fetch('https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/6e0c83dc434dd25fd8cf6f2ddc7dddd6192000c8/order66-v3-direct-20261127/pogipath-v76-catalog-fix.js',{cache:'no-store',mode:'cors'});
    if(!res.ok)throw Error('O66_BUNDLE_HTTP_'+res.status);
    const source=await res.text();
    if(!source.startsWith('/* ORDER66 V3 DIRECT | V76 catalog fix 89feee0cd296c054fe3fd86e9d185f397c28d761 | 120 modules */'))throw Error('O66_BUNDLE_IDENTITY_MISMATCH');
    status.phase='EVAL';
    (0,eval)(source);
    status.phase='BOOT_REQUESTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e?.message||e);
    try{root.game_log?.('O66 '+role+' loader: '+status.error)}catch(_){}
  }finally{root.__O66_DIRECT_LOADING=false}
})(globalThis);
