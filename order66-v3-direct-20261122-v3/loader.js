/* ORDER66 V3 | stable CODE-slot entrypoint | source d472e6f99e67d7703b29025d57aad08c6fa9d107 */
(async function(root){
  'use strict';
  const role=root?.character?.name;
  if(!['Rentaro','Souji','Hibari','Harutora'].includes(role))return;
  if(root.__O66_DIRECT_LOADING||root.__POGI_V3_DIRECT_STATUS?.active||root.__POGI_V3_DIRECT_STATUS?.starting)return;
  root.__O66_DIRECT_LOADING=true;
  const status={role,phase:'FETCH',at:Date.now(),error:null,deliveryCommit:'81ac8f0b08082550b985bdb62b162f0c004e5642'};
  root.__O66_DIRECT_LOAD_STATUS=status;
  try{
    const res=await root.fetch('https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/81ac8f0b08082550b985bdb62b162f0c004e5642/order66-v3-direct-20261127/combat-recovery-fix.js',{cache:'no-store',mode:'cors'});
    if(!res.ok)throw Error('O66_BUNDLE_HTTP_'+res.status);
    const source=await res.text();
    if(!source.startsWith('/* ORDER66 V3 DIRECT | exact source d472e6f99e67d7703b29025d57aad08c6fa9d107 | 120 modules */'))throw Error('O66_BUNDLE_IDENTITY_MISMATCH');
    status.phase='EVAL';
    (0,eval)(source);
    status.phase='BOOT_REQUESTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e?.message||e);
    try{root.game_log?.('O66 '+role+' loader: '+status.error)}catch(_){}
  }finally{root.__O66_DIRECT_LOADING=false}
})(globalThis);
