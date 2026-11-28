/* ORDER66 V3 | stable CODE-slot entrypoint | source 694b003e6bd0c2f9263fa192b64ece682f9eff13 */
(async function(root){
  'use strict';
  const role=root?.character?.name;
  if(!['Rentaro','Souji','Hibari','Harutora'].includes(role))return;
  if(root.__O66_DIRECT_LOADING||root.__POGI_V3_DIRECT_STATUS?.active||root.__POGI_V3_DIRECT_STATUS?.starting)return;
  root.__O66_DIRECT_LOADING=true;
  const status={role,phase:'FETCH',at:Date.now(),error:null,deliveryCommit:'5cf3292e99e25e8f0494e4f4c6df2cf35eeb2aab'};
  root.__O66_DIRECT_LOAD_STATUS=status;
  try{
    const res=await root.fetch('https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/5cf3292e99e25e8f0494e4f4c6df2cf35eeb2aab/order66-v3-direct-20261127/pogipath-v70-shared-inventory.js',{cache:'no-store',mode:'cors'});
    if(!res.ok)throw Error('O66_BUNDLE_HTTP_'+res.status);
    const source=await res.text();
    if(!source.startsWith('/* ORDER66 V3 DIRECT | exact source 694b003e6bd0c2f9263fa192b64ece682f9eff13 | 120 modules */'))throw Error('O66_BUNDLE_IDENTITY_MISMATCH');
    status.phase='EVAL';
    (0,eval)(source);
    status.phase='BOOT_REQUESTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e?.message||e);
    try{root.game_log?.('O66 '+role+' loader: '+status.error)}catch(_){}
  }finally{root.__O66_DIRECT_LOADING=false}
})(globalThis);
