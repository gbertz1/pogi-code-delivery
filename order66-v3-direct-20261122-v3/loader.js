/* ORDER66 V3 | stable CODE-slot entrypoint | source 0b59cfb7ec4d03d9f18a0a1de30c7f589391e9b9 */
(async function(root){
  'use strict';
  const role=root?.character?.name;
  if(!['Rentaro','Souji','Hibari','Harutora'].includes(role))return;
  if(root.__O66_DIRECT_LOADING||root.__POGI_V3_DIRECT_STATUS?.active||root.__POGI_V3_DIRECT_STATUS?.starting)return;
  root.__O66_DIRECT_LOADING=true;
  const status={role,phase:'FETCH',at:Date.now(),error:null,deliveryCommit:'7d7cbfb562d6e2fa64dde4bc41229652c1971edb'};
  root.__O66_DIRECT_LOAD_STATUS=status;
  try{
    const res=await root.fetch('https://raw.githubusercontent.com/gbertz1/pogi-code-delivery/7d7cbfb562d6e2fa64dde4bc41229652c1971edb/order66-v3-direct-20261127/heal-route-boss-return-fix.js',{cache:'no-store',mode:'cors'});
    if(!res.ok)throw Error('O66_BUNDLE_HTTP_'+res.status);
    const source=await res.text();
    if(!source.startsWith('/* ORDER66 V3 DIRECT | exact source 0b59cfb7ec4d03d9f18a0a1de30c7f589391e9b9 | 120 modules */'))throw Error('O66_BUNDLE_IDENTITY_MISMATCH');
    status.phase='EVAL';
    (0,eval)(source);
    status.phase='BOOT_REQUESTED';
  }catch(e){
    status.phase='FAILED';status.error=String(e?.message||e);
    try{root.game_log?.('O66 '+role+' loader: '+status.error)}catch(_){}
  }finally{root.__O66_DIRECT_LOADING=false}
})(globalThis);
