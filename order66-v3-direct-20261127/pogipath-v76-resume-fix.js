/* ORDER66 V3 DIRECT | V76 resume fix 067424f8d6e5749ace542e50f6cfa4d0b286d7be | 120 modules */
(function(root){"use strict";const defs={"adapters/adventureland/LiveAdapters.js":[function(require,module,exports){
'use strict';

const {createShopAdapter}=require('./ShopAdapter');
const {createVerifiedPartyRouteAdapter}=require('./VerifiedPartyRouteAdapter');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function fn(root,name){
  return root&&typeof root[name]==='function'?root[name].bind(root):null;
}

function character(root){
  return root&&root.character&&typeof root.character==='object'?root.character:null;
}

function resolveEntity(root,id){
  const key=String(id||'');
  if(!key)return null;
  try{
    const getter=fn(root,'get_entity');
    if(getter){
      const row=getter(key);
      if(row)return row;
    }
  }catch{}
  try{
    const player=fn(root,'get_player');
    if(player){
      const row=player(key);
      if(row)return row;
    }
  }catch{}
  try{
    if(root&&root.parent&&root.parent.entities&&root.parent.entities[key])return root.parent.entities[key];
  }catch{}
  try{
    if(root&&root.entities&&root.entities[key])return root.entities[key];
  }catch{}
  return null;
}

function makeMovement(root,{routeAuthority=null}={}){
  const routeDriver=createVerifiedPartyRouteAdapter({root,authority:routeAuthority});
  return{
    async move(target){
      const move=fn(root,'move');
      if(!move)return{ok:false,error:'MOVE_UNAVAILABLE'};
      if(!target||!Number.isFinite(Number(target.x))||!Number.isFinite(Number(target.y))){
        return{ok:false,error:'MOVE_TARGET_INVALID'};
      }
      const result=await move(Number(target.x),Number(target.y));
      return{ok:!(result&&result.failed===true),result:clone(result)};
    },
    async smartMove(){
      // Normal V3 runtime has NO SmartMove permission, including recovery.
      // One-shot coordinate capture is isolated in Order66RentaroNavigationTeacher.
      return{ok:false,error:'SMART_MOVE_BANNED_NORMAL_RUNTIME'};
    },
    followVerifiedRoute:routeDriver.followVerifiedRoute,
    routeSafetyStatus:routeDriver.status
  };
}

function makeCombat(root){
  return{
    async attack(id){
      const attack=fn(root,'attack');
      if(!attack)return{ok:false,error:'ATTACK_UNAVAILABLE'};
      const entity=resolveEntity(root,id);
      if(!entity)return{ok:false,error:'TARGET_NOT_VISIBLE',target:String(id||'')};
      const result=await attack(entity);
      return{ok:!(result&&result.failed===true),result:clone(result)};
    }
  };
}

function makeFighter(root){
  // Read-only collision verification for the V2 circle when the FARM
  // movement owner is active. Never assume a straight line is walkable.
  function canMoveFixed(target){
    const c=character(root);
    if(!c||c.rip||!target||target.map!==c.map||
       !Number.isFinite(Number(target.x))||!Number.isFinite(Number(target.y)))
      return false;
    const query={map:c.map,x:Number(c.real_x??c.x),y:Number(c.real_y??c.y),
      going_x:Number(target.x),going_y:Number(target.y),base:c.base};
    const check=fn(root,'can_move');
    if(check){try{return check(query)===true}catch{return false}}
    const canMoveTo=fn(root,'can_move_to');
    if(canMoveTo){try{return canMoveTo(query.going_x,query.going_y)===true}catch{return false}}
    return false;
  }
  function skillReady(name){
    const cooldown=fn(root,'is_on_cooldown');
    if(!cooldown)return null;
    try{return cooldown(String(name||''))!==true;}catch{return null;}
  }
  function canAttack(id){
    const checker=fn(root,'can_attack');
    const entity=resolveEntity(root,id);
    if(!entity)return false;
    if(checker){
      try{return checker(entity)===true;}catch{return false;}
    }
    const ready=skillReady('attack');
    return ready!==false;
  }
  return{
    entitiesSnapshot(){
      try{
        const rows=root&&root.parent&&root.parent.entities||root&&root.entities||{};
        return clone(rows||{});
      }catch{return{};}
    },
    partySnapshot(){
      const out={};
      const current=character(root);
      const getter=fn(root,'get_party');
      let rows={};
      try{rows=getter?getter()||{}:(root&&root.parent&&root.parent.party)||{};}catch{rows={};}
      for(const [name,cached] of Object.entries(rows||{})){
        // Party membership is NOT live combat proximity. In particular,
        // get_party() may still contain an offline/remote healer. Only a
        // native visible entity is adequate for an attack-readiness proof.
        const visible=resolveEntity(root,name);
        const row=visible||cached||{};
        const physical=!!visible&&visible.rip!==true&&visible.dead!==true;
        const selfMap=current?.map||null;
        const instance=current?.in??current?.instance??null;
        out[String(name)]={
          online:physical,
          reportedInParty:true,visible:physical,visibilityRequired:true,
          dead:row.dead===true,
          rip:row.rip===true,
          map:physical?String(row.map||selfMap||''):null,
          instance:physical?String(row.in??row.instance??instance??''):null,
          x:physical?(Number.isFinite(Number(row.real_x))?Number(row.real_x):(Number.isFinite(Number(row.x))?Number(row.x):null)):null,
          y:physical?(Number.isFinite(Number(row.real_y))?Number(row.real_y):(Number.isFinite(Number(row.y))?Number(row.y):null)):null,
          hp:Number(row.hp||0),
          max_hp:Number(row.max_hp||0),
          mp:Number(row.mp||0),
          max_mp:Number(row.max_mp||0),
          target:row.target==null?null:String(row.target)
        };
      }
      if(current&&current.name){
        out[String(current.name)]={
          online:true,visible:true,visibilityRequired:true,
          reportedInParty:true,dead:current.dead===true,rip:current.rip===true,
          map:current.map==null?null:String(current.map),
          instance:current.in==null?(current.instance==null?null:String(current.instance)):String(current.in),
          x:Number.isFinite(Number(current.real_x))?Number(current.real_x):(Number.isFinite(Number(current.x))?Number(current.x):null),
          y:Number.isFinite(Number(current.real_y))?Number(current.real_y):(Number.isFinite(Number(current.y))?Number(current.y):null),
          hp:Number(current.hp||0),max_hp:Number(current.max_hp||0),
          mp:Number(current.mp||0),max_mp:Number(current.max_mp||0),
          target:current.target==null?null:String(current.target)
        };
      }
      return out;
    },
    snapshot(targetId=null){
      const c=character(root);
      if(!c)return{ok:false,error:'CHARACTER_UNAVAILABLE'};
      const target=targetId==null?null:
        String(targetId)===String(root?.character?.name||'')?root.character:
        resolveEntity(root,targetId);
      let targetDistance=null;
      if(target){
        try{
          const distanceFn=fn(root,'distance');
          if(distanceFn)targetDistance=Number(distanceFn(c,target));
        }catch{}
        if(!Number.isFinite(targetDistance)){
          const cx=Number(c.real_x!==undefined?c.real_x:c.x),cy=Number(c.real_y!==undefined?c.real_y:c.y);
          const tx=Number(target.real_x!==undefined?target.real_x:target.x),ty=Number(target.real_y!==undefined?target.real_y:target.y);
          if([cx,cy,tx,ty].every(Number.isFinite))targetDistance=Math.hypot(cx-tx,cy-ty);
        }
      }
      return{
        ok:true,
        name:String(c.name||''),
        mp:Number(c.mp||0),
        maxMp:Number(c.max_mp||0),
        basicAttackMp:Number(c.mp_cost||0),
        hp:Number(c.hp||0),
        maxHp:Number(c.max_hp||0),
        hpRatio:Number(c.max_hp||0)>0?Number(c.hp||0)/Number(c.max_hp):0,
        level:Number(c.level||0),
        range:Number(c.range||0),
        sugarRushActive:!!(c.s&&c.s.sugarrush),
        equipment:clone(c.slots||{}),
        cleaveLoadoutReady:!!(
          c.slots&&c.slots.mainhand&&c.slots.mainhand.name==='bataxe'&&!c.slots.offhand
        ),
        sugarPrepLoadoutReady:!!(
          c.slots&&c.slots.mainhand&&c.slots.mainhand.name==='vhammer'&&
          c.slots.offhand&&c.slots.offhand.name==='ololipop'&&Number(c.slots.offhand.level||0)>=9
        ),
        sugarBurnLoadoutReady:!!(
          c.slots&&c.slots.mainhand&&c.slots.mainhand.name==='vhammer'&&
          c.slots.offhand&&c.slots.offhand.name==='vhammer'
        ),
        attackReady:target?canAttack(targetId):(skillReady('attack')===true),
        targetInAttackRange:target?canAttack(targetId):false,
        cleaveCooldownReady:skillReady('cleave')===true,
        stompCooldownReady:skillReady('stomp')===true,
        tauntCooldownReady:skillReady('taunt')===true,
        hardShellCooldownReady:skillReady('hardshell')===true,
        agitateCooldownReady:skillReady('agitate')===true,
        target:target?clone({
          id:target.id||targetId,
          mtype:target.mtype||null,
          target:target.target||null,
          distance:Number.isFinite(targetDistance)?targetDistance:null,
          map:target.map==null?null:String(target.map),
          instance:target.in==null?(target.instance==null?null:String(target.instance)):String(target.in),
          x:target.x,
          y:target.y
        }):null
      };
    },
    async use(name,targetId=null,extraArg=undefined){
      const use=fn(root,'use_skill');
      if(!use)return{ok:false,error:'USE_SKILL_UNAVAILABLE'};
      const skill=String(name||'');
      if(!skill)return{ok:false,error:'SKILL_REQUIRED'};
      // CBurst is a native [entity id, allocated MP] list, not a string.
      if(Array.isArray(targetId)&&skill!=='cburst')
        return{ok:false,error:'UNSUPPORTED_SKILL_LIST'};
      if(skill==='cburst'&&(!Array.isArray(targetId)||!targetId.length||
        targetId.some(row=>!Array.isArray(row)||row.length!==2||
          !row[0]||!Number.isFinite(Number(row[1]))||Number(row[1])<=0)))
        return{ok:false,error:'CBURST_TARGET_LIST_INVALID'};
      const target=targetId==null?null:Array.isArray(targetId)?
        targetId.map(([id,mp])=>[String(id),Number(mp)]):resolveEntity(root,targetId)||String(targetId);
      try{
        const result=targetId==null?await use(skill):
          extraArg===undefined?await use(skill,target):await use(skill,target,extraArg);
        return{ok:!(result&&(result.failed===true||result.ok===false||result.success===false)),result:clone(result)};
      }catch(error){
        return{ok:false,error:'USE_SKILL_FAILED',detail:String(error&&error.message||error)};
      }
    },
    ready:skillReady,
    canAttack,
    canMove:canMoveFixed
  };
}

function makeInventory(root){
  return{
    async snapshot(){
      const c=character(root);
      if(!c||!Array.isArray(c.items))throw new Error('CHARACTER_ITEMS_UNAVAILABLE');
      return c.items.map(clone);
    }
  };
}

function makeBank(root,{preserveBankStock=false}={}){
  return{
    async snapshot(){
      const c=character(root);
      if(!c||!c.bank||typeof c.bank!=='object')throw new Error('BANK_NOT_OPEN');
      return clone(c.bank);
    },
    async retrieve(pack,bankSlot,inventorySlot){
      if(preserveBankStock)return{ok:false,error:'BANK_STOCK_PRESERVED_NO_AUTO_WITHDRAWAL'};
      const retrieve=fn(root,'bank_retrieve');
      if(!retrieve)return{ok:false,error:'BANK_RETRIEVE_UNAVAILABLE'};
      const result=await retrieve(String(pack),Number(bankSlot),Number(inventorySlot));
      return{ok:!(result&&result.failed===true),result:clone(result)};
    },
    async store(inventorySlot,pack,bankSlot){
      if(preserveBankStock){const c=character(root),rows=c?.bank?.[String(pack)],item=c?.items?.[Number(inventorySlot)];if(!item||item.name==='jacko'||item.name==='pumpkinspice'||item.l||item.locked||!Array.isArray(rows)||!Number.isInteger(Number(bankSlot))||Number(bankSlot)<0||Number(bankSlot)>=rows.length||rows[Number(bankSlot)]!=null)return{ok:false,error:'BANK_STOCK_OR_CARRIED_GEAR_PROTECTED'};}
      const store=fn(root,'bank_store');
      if(!store)return{ok:false,error:'BANK_STORE_UNAVAILABLE'};
      const result=await store(Number(inventorySlot),String(pack),Number(bankSlot));
      return{ok:!(result&&result.failed===true),result:clone(result)};
    },
    itemMeta(name){
      try{
        const row=root&&root.G&&root.G.items&&root.G.items[String(name||'')];
        return row&&typeof row==='object'?clone(row):null;
      }catch{return null;}
    },
    currentMap(){
      const c=character(root);
      return c&&c.map?String(c.map):null;
    }
  };
}

function makeGearProduction(root){
  function ready(){
    return !!(
      fn(root,'buy')&&
      fn(root,'upgrade')&&
      fn(root,'compound')&&
      fn(root,'item_grade')
    );
  }
  return{
    ready,
    currentMap(){
      const c=character(root);
      return c&&c.map?String(c.map):null;
    },
    queueStatus(){
      const c=character(root),q=c&&c.q||{};
      const upgrade=!!q.upgrade,compound=!!q.compound,exchange=!!q.exchange;
      return{busy:upgrade||compound||exchange,upgrade,compound,exchange};
    },
    itemGrade(item){
      const grade=fn(root,'item_grade');
      if(!grade)return null;
      try{
        const value=Number(grade(clone(item)));
        return Number.isFinite(value)?value:null;
      }catch{return null;}
    },
    async buy(name,quantity=1){
      const buy=fn(root,'buy');
      if(!buy)return{ok:false,error:'BUY_UNAVAILABLE'};
      try{
        const result=await buy(String(name),Number(quantity)||1);
        return{ok:!(result&&result.failed===true),result:clone(result)};
      }catch(error){
        return{ok:false,error:'BUY_FAILED',detail:String(error&&error.message||error)};
      }
    },
    async upgrade(itemSlot,scrollSlot,offeringSlot=null){
      const upgrade=fn(root,'upgrade');
      if(!upgrade)return{ok:false,error:'UPGRADE_UNAVAILABLE'};
      try{
        const result=await upgrade(Number(itemSlot),Number(scrollSlot),offeringSlot==null?null:Number(offeringSlot));
        return{ok:!(result&&result.failed===true),result:clone(result)};
      }catch(error){
        return{ok:false,error:'UPGRADE_FAILED',detail:String(error&&error.message||error)};
      }
    },
    async compound(itemSlots,scrollSlot,offeringSlot=null){
      const compound=fn(root,'compound');
      if(!compound)return{ok:false,error:'COMPOUND_UNAVAILABLE'};
      const slots=(Array.isArray(itemSlots)?itemSlots:[]).map(Number);
      if(slots.length!==3||slots.some(x=>!Number.isInteger(x)||x<0))return{ok:false,error:'COMPOUND_SLOTS_INVALID'};
      try{
        const result=await compound(slots[0],slots[1],slots[2],Number(scrollSlot),offeringSlot==null?null:Number(offeringSlot));
        return{ok:!(result&&result.failed===true),result:clone(result)};
      }catch(error){
        return{ok:false,error:'COMPOUND_FAILED',detail:String(error&&error.message||error)};
      }
    }
  };
}

function makeGear(root){
  return{
    async inventory(){
      const c=character(root);
      if(!c||!Array.isArray(c.items))throw new Error('CHARACTER_ITEMS_UNAVAILABLE');
      return c.items.map(clone);
    },
    async equipment(){
      const c=character(root);
      if(!c||!c.slots||typeof c.slots!=='object')throw new Error('CHARACTER_SLOTS_UNAVAILABLE');
      return clone(c.slots);
    },
    async equip(slot,equipmentSlot=null){
      const equip=fn(root,'equip');
      if(!equip)return{ok:false,error:'EQUIP_UNAVAILABLE'};
      const index=Number(slot);
      if(!Number.isInteger(index)||index<0)return{ok:false,error:'EQUIP_SLOT_INVALID'};
      const result=equipmentSlot?await equip(index,String(equipmentSlot)):await equip(index);
      return{ok:!(result&&result.failed===true),result:clone(result)};
    },
    async unequip(equipmentSlot){
      const unequip=fn(root,'unequip');
      if(!unequip)return{ok:false,error:'UNEQUIP_UNAVAILABLE'};
      const slot=String(equipmentSlot||'');
      if(!slot)return{ok:false,error:'UNEQUIP_SLOT_INVALID'};
      const result=await unequip(slot);
      return{ok:!(result&&result.failed===true),result:clone(result)};
    }
  };
}

function standState(root){
  const c=character(root);
  return !!(c&&c.stand);
}

async function toggleStand(root,wantOpen){
  if(standState(root)===wantOpen)return{ok:true,already:true};
  const direct=wantOpen?(fn(root,'open_stand')||fn(root,'open_merchant')):(fn(root,'close_stand')||fn(root,'close_merchant'));
  if(direct){
    const result=await direct();
    return{ok:!(result&&result.failed===true),result:clone(result)};
  }
  const toggle=fn(root,'open_close_stand');
  if(!toggle)return{ok:false,error:wantOpen?'STAND_OPEN_UNAVAILABLE':'STAND_CLOSE_UNAVAILABLE'};
  const result=await toggle();
  return{ok:!(result&&result.failed===true),result:clone(result)};
}

function makeStand(root){
  return{
    async isOpen(){return standState(root);},
    async open(){return toggleStand(root,true);},
    async close(){return toggleStand(root,false);}
  };
}

function auditLiveAdapters(root){
  const c=character(root);
  const hooks={
    character:!!c,
    items:!!(c&&Array.isArray(c.items)),
    slots:!!(c&&c.slots&&typeof c.slots==='object'),
    move:!!fn(root,'move'),
    attack:!!fn(root,'attack'),
    use_skill:!!fn(root,'use_skill'),
    equip:!!fn(root,'equip'),
    unequip:!!fn(root,'unequip'),
    stand_control:!!(
      fn(root,'open_close_stand')||
      (fn(root,'open_stand')&&fn(root,'close_stand'))||
      (fn(root,'open_merchant')&&fn(root,'close_merchant'))
    )
  };
  const missing=Object.entries(hooks).filter(([,ok])=>!ok).map(([name])=>name);
  return{ok:missing.length===0,hooks,missing};
}

function createAdventureLandLiveAdapters(root=(typeof globalThis!=='undefined'?globalThis:{}),{
    routeAuthority=null,partySafetyTrust=null,mageRegroupAuthority=null,preserveBankStock=false
  }={}){
  const audit=auditLiveAdapters(root);
  return{
    audit,
    movement:makeMovement(root,{routeAuthority}),
    partySafetyTrust,
    mageRegroupAuthority,
    combat:makeCombat(root),
    inventory:makeInventory(root),
    fighter:makeFighter(root),
    bank:makeBank(root,{preserveBankStock}),
    gear:makeGear(root),
    gearProduction:makeGearProduction(root),
    stand:makeStand(root),
    shop:createShopAdapter(root,{publicOrigin:root&&root.__POGI_PUBLIC_ORIGIN||null})
  };
}

module.exports={
  createAdventureLandLiveAdapters,
  auditLiveAdapters,
  resolveEntity
};

},{"./ShopAdapter":"adapters/adventureland/ShopAdapter.js","./VerifiedPartyRouteAdapter":"adapters/adventureland/VerifiedPartyRouteAdapter.js"}],
"adapters/adventureland/ShopAdapter.js":[function(require,module,exports){
'use strict';

const {crewProtected}=require('../../organs/gear/GearRegistry');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function fn(root,name){return root&&typeof root[name]==='function'?root[name].bind(root):null;}
function character(root){return root&&root.character&&typeof root.character==='object'?root.character:null;}
function resultOk(result){return !(result&&result.failed===true);}
function merchantSnapshot(root){
  const rows=[];const entities=(root&&root.parent&&root.parent.entities)||(root&&root.entities)||{};
  for(const entity of Object.values(entities||{})){
    if(!entity||!entity.slots||!entity.id)continue;
    const hasTrade=Object.keys(entity.slots).some(x=>/^trade\d+$/i.test(x));
    if(hasTrade)rows.push(clone(entity));
  }
  return rows;
}
function origin(root,explicit){
  if(explicit)return String(explicit).replace(/\/$/,'');
  if(root&&root.__POGI_PUBLIC_ORIGIN)return String(root.__POGI_PUBLIC_ORIGIN).replace(/\/$/,'');
  return '';
}
function createShopAdapter(root=(typeof globalThis!=='undefined'?globalThis:{}),{publicOrigin=null}={}){
  return{
    standSlots(){const c=character(root);return clone(c&&c.slots||{});},
    visibleMerchants(){return merchantSnapshot(root);},
    visibleMerchant(id){const key=String(id||'');return merchantSnapshot(root).find(x=>String(x.id||x.name||'')===key)||null;},
    async tradeOffer(inventorySlot,tradeSlot,want,quantity=1){
      const call=fn(root,'trade_offer');if(!call)return{ok:false,error:'TRADE_OFFER_UNAVAILABLE'};
      try{const r=await call(Number(inventorySlot),String(tradeSlot),clone(want),Math.max(1,Number(quantity)||1));return{ok:resultOk(r),result:clone(r)};}catch(error){return{ok:false,error:'TRADE_OFFER_FAILED',detail:String(error&&error.message||error)};}
    },
    async tradeSwap(target,tradeSlot,inventorySlot){
      const call=fn(root,'trade_swap');if(!call)return{ok:false,error:'TRADE_SWAP_UNAVAILABLE'};
      try{const r=await call(target,String(tradeSlot),Number(inventorySlot));return{ok:resultOk(r),result:clone(r)};}catch(error){return{ok:false,error:'TRADE_SWAP_FAILED',detail:String(error&&error.message||error)};}
    },
    async listSale(inventorySlot,tradeSlot,price,quantity=1){
      const c=character(root),item=c?.items?.[Number(inventorySlot)];
      if(!item||String(c.map||'').startsWith('bank')||crewProtected(item,c.name)||Number(item.level||0)>0)return{ok:false,error:'PROTECTED_SHOP_ITEM'};
      const call=fn(root,'trade');if(!call)return{ok:false,error:'TRADE_LIST_UNAVAILABLE'};
      try{const r=await call(Number(inventorySlot),String(tradeSlot),Math.max(0,Number(price)||0),Math.max(1,Number(quantity)||1));return{ok:resultOk(r),result:clone(r)};}catch(error){return{ok:false,error:'TRADE_LIST_FAILED',detail:String(error&&error.message||error)};}
    },
    async removeListing(tradeSlot){
      const call=fn(root,'unequip');if(!call)return{ok:false,error:'TRADE_UNLIST_UNAVAILABLE'};
      try{const r=await call(String(tradeSlot));return{ok:resultOk(r),result:clone(r)};}catch(error){return{ok:false,error:'TRADE_UNLIST_FAILED',detail:String(error&&error.message||error)};}
    },
    async readConfig(){
      const base=origin(root,publicOrigin),fetchFn=root&&typeof root.fetch==='function'?root.fetch.bind(root):(typeof fetch==='function'?fetch:null);
      if(!base||!fetchFn)return{ok:false,error:'SHOP_CONFIG_ENDPOINT_UNAVAILABLE'};
      try{const r=await fetchFn(base+'/api/shop-config?t='+Date.now(),{cache:'no-store',mode:'cors'}),j=await r.json();return r.ok&&j&&j.ok?{ok:true,config:clone(j.config)}:{ok:false,error:j&&j.error||('HTTP_'+r.status)};}catch(error){return{ok:false,error:'SHOP_CONFIG_FETCH_FAILED',detail:String(error&&error.message||error)};}
    }
  };
}
module.exports={createShopAdapter,merchantSnapshot};

},{"../../organs/gear/GearRegistry":"organs/gear/GearRegistry.js"}],
"adapters/adventureland/VerifiedPartyRouteAdapter.js":[function(require,module,exports){
'use strict';
// ORDER66 V3 -- one approved, independently verified fixed route at a time.
// No smart_move, guesses, background retry, or unchecked door transport.
// An outside trusted Bridge authority MUST attest route and EVERY leg;
// this adapter refuses to execute without those callbacks and exact V3 pins.
const SHA=/^[a-f0-9]{40}$/, ID=/^[A-Za-z0-9_-]{12,80}$/;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<=r;
function createVerifiedPartyRouteAdapter({
  root,authority=null,now=Date.now,maxAgeMs=1200,maxLeg=180,
  arrivalTolerance=12
}={}){
  let active=false,attempts=0,lastReason='TRUSTED_FIXED_ROUTE_AUTHORITY_MISSING';
  const denied=reason=>{lastReason=reason;return{ok:false,error:reason}};
  function identity(){
    const c=root?.character,p=root?.__POGI_V3_SUPERVISED_APPROVAL,l=root?.__POGI_V3_LOADER_STATUS;
    if(!c||!['Hibari','Souji','Harutora'].includes(c.name)||c.rip===true||
       root?.socket?.connected!==true||!p||!l||p.character!==c.name||
       p.userPresent!==true||p.singleTab!==true||p.noRecovery!==true||
       p.sessionId!==l.sessionId&&l.sessionId!==undefined||
       !ID.test(p.sessionId||'')||!SHA.test(p.sourceCommit||'')||
       !SHA.test(p.releaseCommit||'')||
       p.sourceCommit!==l.sourceCommit||p.releaseCommit!==l.releaseCommit||
       l.role!==c.name||l.ok!==true||l.installed!==true||l.gameplayStarted!==true||
       !Number.isSafeInteger(p.expiresAt)||Number(now())>=p.expiresAt)
      return null;
    return{role:c.name,sessionId:p.sessionId,sourceCommit:p.sourceCommit,
      releaseCommit:p.releaseCommit,approvalExpiresAt:p.expiresAt};
  }
  function live(){
    const c=root?.character,x=c?.real_x??c?.x,y=c?.real_y??c?.y;
    if(!c||!finite(x)||!finite(y)||!c.map||c.rip===true||
       !finite(c.hp)||c.hp<=0||root?.socket?.connected!==true)return null;
    return{map:c.map,x,y,instance:c.in??c.instance??null,hp:c.hp};
  }
  function verifiedStamp(x,t){
    return Number.isSafeInteger(x?.observedAt)&&x.observedAt<=t&&t-x.observedAt<=maxAgeMs;
  }
  function approvedRoute(route,id,t){
    if(!route||route.routeKind!=='FIXED_LEGS'||route.verified!==true||
       !ID.test(route.routeId||'')||route.role!==id.role||
       route.sessionId!==id.sessionId||route.sourceCommit!==id.sourceCommit||
       route.releaseCommit!==id.releaseCommit||typeof route.destination!=='string'||
       !verifiedStamp(route,t)||!Array.isArray(route.legs)||
       route.legs.length===0||route.legs.length>48||
       !authority||typeof authority.verifyRoute!=='function'||
       typeof authority.verifyLeg!=='function'||
       typeof authority.readLegProof!=='function')return false;
    try{return authority.verifyRoute(route,{...id,at:t,root})===true}
    catch(_){return false}
  }
  async function followVerifiedRoute(route){
    if(active)return denied('ROUTE_ALREADY_RUNNING');
    const id=identity(),t=Number(now());
    if(!id)return denied('PINNED_LIVE_FIGHTER_APPROVAL_REQUIRED');
    if(!approvedRoute(route,id,t))return denied('INDEPENDENT_FIXED_ROUTE_PROOF_REQUIRED');
    active=true;attempts++;
    try{
      for(let i=0;i<route.legs.length;i++){
        const leg=route.legs[i],before=live(),stamp=Number(now());
        if(!before||!identity()||stamp>=id.approvalExpiresAt)
          return denied('ROLE_OR_APPROVAL_LOST');
        if(!leg||leg.index!==i||leg.map!==before.map||
           !leg.from||!leg.to||!finite(leg.from.x)||!finite(leg.from.y)||
           !finite(leg.to.x)||!finite(leg.to.y)||
           !near(before,leg.from,3))
          return denied('CURRENT_LEG_POSITION_OR_FRESHNESS_INVALID');
        // The planned route is immutable, but each leg needs a fresh,
        // independently sampled proof AFTER the previous leg's arrival.
        let proof=null,accepted=false;
        try{
          proof=await authority.readLegProof(route,{
            ...id,routeId:route.routeId,index:i,from:before,leg,at:stamp
          });
          accepted=proof?.source==='BRIDGE_INDEPENDENT_FIXED_LEG'&&
            proof?.routeId===route.routeId&&proof?.index===i&&
            proof?.map===leg.map&&proof?.kind===leg.kind&&
            proof?.sessionId===id.sessionId&&proof?.sourceCommit===id.sourceCommit&&
            proof?.releaseCommit===id.releaseCommit&&proof?.role===id.role&&
            verifiedStamp(proof,Number(now()))&&proof?.verified===true&&
            !!proof?.from&&!!proof?.to&&
            near(proof.from,leg.from,1)&&near(proof.to,leg.to,.01)&&
            authority.verifyLeg(proof,{...id,routeId:route.routeId,index:i,
              expectedLeg:leg,observedAt:stamp,from:before,root})===true;
        }catch(_){}
        if(!accepted)return denied('INDEPENDENT_LEG_PROOF_REQUIRED');
        const recheck=live();
        if(!recheck||recheck.map!==before.map||!near(recheck,before,1))
          return denied('LIVE_POSITION_CHANGED_DURING_PROOF');
        if(leg.kind==='MOVE'){
          if(leg.to.map!==leg.map||!near(leg.from,leg.to,maxLeg)||
             Math.hypot(leg.from.x-leg.to.x,leg.from.y-leg.to.y)<0.01||
             typeof root.can_move_to!=='function'||typeof root.move!=='function')
            return denied('DIRECT_MOVE_BOUNDS_OR_NATIVE_API_INVALID');
          let clear=false;
          try{clear=root.can_move_to(leg.to.x,leg.to.y)===true}catch(_){}
          if(!clear)return denied('NATIVE_COLLISION_BLOCKED');
          try{await root.move(leg.to.x,leg.to.y)}
          catch(_){return denied('DIRECT_MOVE_FAILED')}
          const after=live();
          if(!after||after.map!==leg.map||!near(after,leg.to,arrivalTolerance))
            return denied('DIRECT_MOVE_ARRIVAL_NOT_CONFIRMED');
        }else if(leg.kind==='DOOR'){
          if(!leg.to.map||leg.to.map!==leg.destinationMap||
             !Number.isInteger(leg.spawn)||leg.spawn<0||
             typeof root.transport!=='function')
            return denied('DOOR_DESTINATION_INVALID');
          const map=root.G?.maps?.[leg.map];
          const door=map?.doors?.find(d=>Array.isArray(d)&&
            d[4]===leg.destinationMap&&Number(d[5])===leg.spawn&&
            near({x:d[0],y:d[1]},before,32));
          const dest=root.G?.maps?.[leg.destinationMap]?.spawns?.[leg.spawn];
          if(!door||!Array.isArray(dest)||!finite(dest[0])||!finite(dest[1])||
             !near(leg.to,{x:dest[0],y:dest[1]},arrivalTolerance))
            return denied('NATIVE_DOOR_OR_SPAWN_UNVERIFIED');
          try{await root.transport(leg.destinationMap,leg.spawn)}
          catch(_){return denied('NATIVE_TRANSPORT_FAILED')}
          const after=live();
          if(!after||after.map!==leg.destinationMap||
             !near(after,{x:dest[0],y:dest[1]},arrivalTolerance))
            return denied('NATIVE_TRANSPORT_ARRIVAL_NOT_CONFIRMED');
        }else return denied('UNSUPPORTED_LEG_KIND');
      }
      const arrived=live();
      if(!arrived||arrived.map!==route.destination)
        return denied('ROUTE_FINAL_MAP_NOT_CONFIRMED');
      lastReason='ROUTE_ARRIVED_VERIFIED';
      return{ok:true,arrived:true,map:arrived.map,legCount:route.legs.length};
    }finally{active=false}
  }
  function status(){return Object.freeze({active,attempts,lastReason,
    trustedAuthorityConfigured:typeof authority?.verifyRoute==='function'&&
      typeof authority?.verifyLeg==='function'&&
      typeof authority?.readLegProof==='function',smartMoveAllowed:false})}
  return Object.freeze({followVerifiedRoute,status});
}
module.exports={createVerifiedPartyRouteAdapter};

},{}],
"adapters/alerts/BridgeAlertSink.js":[function(require,module,exports){
'use strict';

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createBridgeAlertSink({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  storage=(typeof globalThis!=='undefined'?globalThis.localStorage:null),
  key='Pogi_V3_Alert_Outbox_v1',
  maxRows=200,
  hookName='__POGI_V3_ALERT_SINK'
}={}){
  function read(){
    if(!storage || typeof storage.getItem!=='function') return [];
    try{
      const rows=JSON.parse(storage.getItem(key)||'[]');
      return Array.isArray(rows)?rows:[];
    }catch{return [];}
  }

  function write(rows){
    if(!storage || typeof storage.setItem!=='function') return false;
    storage.setItem(key,JSON.stringify(rows.slice(-Math.max(10,Number(maxRows)||200))));
    return true;
  }

  async function tryHook(alert){
    const hook=root&&root[hookName];
    if(typeof hook!=='function') return {delivered:false,reason:'BRIDGE_HOOK_NOT_INSTALLED'};
    try{
      const result=await hook(clone(alert));
      return {delivered:!(result&&result.ok===false),result:clone(result||{})};
    }catch(error){
      return {delivered:false,reason:String(error&&error.message||error)};
    }
  }

  return {
    name:'bridge-outbox',
    async deliver(alert){
      const rows=read();
      const row={
        id:String(alert.id),
        created_at:Number(alert.at||Date.now()),
        delivered_at:null,
        attempts:0,
        alert:clone(alert)
      };
      rows.push(row);
      const queued=write(rows);

      const delivery=await tryHook(alert);
      row.attempts++;
      if(delivery.delivered) row.delivered_at=Date.now();
      write(rows);
      return {ok:queued||delivery.delivered,queued,delivered:delivery.delivered,reason:delivery.reason||null};
    },

    async drain(){
      const rows=read();
      let delivered=0;
      for(const row of rows){
        if(row.delivered_at) continue;
        const result=await tryHook(row.alert);
        row.attempts=Number(row.attempts||0)+1;
        if(result.delivered){
          row.delivered_at=Date.now();
          delivered++;
        }
      }
      write(rows);
      return {ok:true,delivered,pending:rows.filter(row=>!row.delivered_at).length};
    },

    pending(){
      return read().filter(row=>!row.delivered_at).map(clone);
    },

    key,
    hookName
  };
}

module.exports={createBridgeAlertSink};

},{}],
"adapters/alerts/BrowserAlertSink.js":[function(require,module,exports){
'use strict';

function createBrowserAlertSink({root=(typeof globalThis!=='undefined'?globalThis:{}),consoleRef=console}={}){
  return {
    name:'browser',
    async deliver(alert){
      const prefix=alert.severity==='error'?'[V3 ALERT FAIL]':alert.severity==='success'?'[V3 ALERT PASS]':'[V3 ALERT]';
      try{
        if(consoleRef && typeof consoleRef[alert.severity==='error'?'error':'log']==='function'){
          consoleRef[alert.severity==='error'?'error':'log'](prefix,alert.title,alert.body);
        }
      }catch{}

      let gameLog=false;
      try{
        if(root && typeof root.game_log==='function'){
          root.game_log(alert.title+': '+alert.body);
          gameLog=true;
        }
      }catch{}

      let notification=false;
      let notificationReason=null;
      try{
        const NotificationCtor=root&&root.Notification;
        if(NotificationCtor && NotificationCtor.permission==='granted'){
          new NotificationCtor(alert.title,{body:alert.body,tag:alert.change_id||alert.id});
          notification=true;
        }else{
          notificationReason=NotificationCtor?'PERMISSION_NOT_GRANTED':'NOT_AVAILABLE';
        }
      }catch(error){
        notificationReason=String(error&&error.message||error);
      }

      return {ok:true,game_log:gameLog,browser_notification:notification,notification_reason:notificationReason};
    }
  };
}

module.exports={createBrowserAlertSink};

},{}],
"adapters/bridge/BridgeV3Contract.js":[function(require,module,exports){
'use strict';

const CONTRACT_VERSION=2;
const FRAME_KEY='__POGI_BRIDGE_FRAME_ID';
const ALERT_HOOK='__POGI_V3_ALERT_SINK';
const RECOVERY_HOOK='__POGI_V3_RECOVERY_SINK';
const BRIDGE_KEY='__POGI_V3_BRIDGE';

function readBridge(root=(typeof globalThis!=='undefined'?globalThis:{})){
  const bridge=root&&root[BRIDGE_KEY]&&typeof root[BRIDGE_KEY]==='object'?root[BRIDGE_KEY]:null;
  const frameId=String((bridge&&bridge.frame_id)||root&&root[FRAME_KEY]||'');
  const alertSink=root&&root[ALERT_HOOK];
  const recoverySink=root&&root[RECOVERY_HOOK];
  return{
    contract:CONTRACT_VERSION,
    available:!!bridge,
    frame_id:frameId||null,
    alert_sink:typeof alertSink==='function',
    recovery_sink:typeof recoverySink==='function',
    version:bridge&&bridge.version?String(bridge.version):null,
    character:bridge&&bridge.character?String(bridge.character):null,
    status:bridge&&typeof bridge.status==='function'?bridge.status:null
  };
}

function validateBridge(root,character,{requireRecovery=false}={}){
  const row=readBridge(root);
  const failures=[];
  if(!row.frame_id)failures.push('BRIDGE_FRAME_ID_MISSING');
  if(!row.alert_sink)failures.push('BRIDGE_ALERT_SINK_MISSING');
  if(requireRecovery&&!row.recovery_sink)failures.push('BRIDGE_RECOVERY_SINK_MISSING');
  if(row.character&&character&&row.character!==String(character))failures.push('BRIDGE_CHARACTER_MISMATCH');
  return{ok:failures.length===0,failures,bridge:row};
}

async function requestBridgeRecovery(root,request={}){
  const sink=root&&root[RECOVERY_HOOK];
  if(typeof sink!=='function'){
    return{ok:false,error:'BRIDGE_RECOVERY_SINK_MISSING',request};
  }
  try{
    const result=await sink(request);
    if(result&&result.ok===false)return result;
    return result&&typeof result==='object'?{ok:true,...result}:{ok:true,result};
  }catch(error){
    return{ok:false,error:String(error&&error.message||error),request};
  }
}

function createBridgeV3Adapter({
  frameId,
  character,
  deliverAlert,
  requestRecovery=null,
  status=()=>({ok:true}),
  version='2'
}={}){
  const fid=String(frameId||'');
  const who=String(character||'');
  if(!fid||!who)throw new Error('BRIDGE_V3_IDENTITY_REQUIRED');
  if(typeof deliverAlert!=='function')throw new Error('BRIDGE_V3_ALERT_DELIVERY_REQUIRED');
  return{
    install(root){
      if(!root)throw new Error('BRIDGE_V3_ROOT_REQUIRED');
      root[FRAME_KEY]=fid;
      root[ALERT_HOOK]=async alert=>deliverAlert(alert);
      if(typeof requestRecovery==='function')root[RECOVERY_HOOK]=async request=>requestRecovery(request);
      root[BRIDGE_KEY]={
        contract:CONTRACT_VERSION,
        version:String(version),
        frame_id:fid,
        character:who,
        status
      };
      return validateBridge(root,who);
    },
    uninstall(root){
      if(!root)return{ok:true};
      try{delete root[ALERT_HOOK];}catch{root[ALERT_HOOK]=null;}
      try{delete root[RECOVERY_HOOK];}catch{root[RECOVERY_HOOK]=null;}
      try{delete root[FRAME_KEY];}catch{root[FRAME_KEY]=null;}
      try{delete root[BRIDGE_KEY];}catch{root[BRIDGE_KEY]=null;}
      return{ok:true};
    }
  };
}

module.exports={
  CONTRACT_VERSION,FRAME_KEY,ALERT_HOOK,RECOVERY_HOOK,BRIDGE_KEY,
  readBridge,validateBridge,requestBridgeRecovery,createBridgeV3Adapter
};

},{}],
"adapters/pogipath/BankRouteModel.js":[function(require,module,exports){
'use strict';

const SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  path:'design/maps.js',
  blobSha:'78350dac1a18c4eb0e7c6f545ebf08bb3d6729e4'
});

const BANK_ROUTE_REVISION=1;

const BANK_ROUTE_MODEL=Object.freeze({
  schema:1,
  kind:'BANK_FLOOR_ROUTE_MODEL',
  activation:Object.freeze({mode:'SHADOW_ASSISTED',live:false}),
  source:SOURCE,
  maps:Object.freeze([
    Object.freeze({id:'bank',label:'Main Bank'}),
    Object.freeze({id:'bank_b',label:'Bank Basement'}),
    Object.freeze({id:'bank_u',label:'Upper Bank'})
  ]),
  nodes:Object.freeze([
    Object.freeze({id:'bank',map:'bank'}),
    Object.freeze({id:'bank_b',map:'bank_b'}),
    Object.freeze({id:'bank_u',map:'bank_u'})
  ]),
  edges:Object.freeze([
    Object.freeze({id:'bank->bank_b',from:'bank',to:'bank_b',type:'BANK_DOOR',enabled:true,locked:true}),
    Object.freeze({id:'bank_b->bank',from:'bank_b',to:'bank',type:'BANK_DOOR',enabled:true}),
    Object.freeze({id:'bank_b->bank_u',from:'bank_b',to:'bank_u',type:'BANK_DOOR',enabled:true,locked:true}),
    Object.freeze({id:'bank_u->bank_b',from:'bank_u',to:'bank_b',type:'BANK_DOOR',enabled:true})
  ])
});

const BANK_FLOORS=Object.freeze(BANK_ROUTE_MODEL.maps.map(x=>x.id));
const BANK_GRAPH=Object.freeze({
  bank:Object.freeze(['bank_b']),
  bank_b:Object.freeze(['bank','bank_u']),
  bank_u:Object.freeze(['bank_b'])
});

module.exports={SOURCE,BANK_ROUTE_REVISION,BANK_ROUTE_MODEL,BANK_FLOORS,BANK_GRAPH};

},{}],
"adapters/storage/LocalStorageChangeStore.js":[function(require,module,exports){
'use strict';

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createLocalStorageChangeStore({
  storage=(typeof globalThis!=='undefined' ? globalThis.localStorage : null),
  key='Pogi_V3_Change_Verification_v1'
}={}){
  if(!storage || typeof storage.getItem!=='function' || typeof storage.setItem!=='function'){
    throw new Error('LOCAL_STORAGE_REQUIRED');
  }

  return {
    async load(){
      const raw=storage.getItem(key);
      if(!raw) return null;
      try{return clone(JSON.parse(raw));}
      catch(error){
        throw new Error('CHANGE_STORE_INVALID_JSON');
      }
    },
    async save(state){
      storage.setItem(key,JSON.stringify(state));
      return true;
    },
    key
  };
}

module.exports={createLocalStorageChangeStore};

},{}],
"adapters/storage/LocalStorageKeyValueStore.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createLocalStorageKeyValueStore({storage=(typeof globalThis!=='undefined'?globalThis.localStorage:null),prefix='Pogi_V3_'}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('LOCAL_STORAGE_REQUIRED');
  const key=k=>prefix+String(k);
  return{
    async get(k){const raw=storage.getItem(key(k));if(raw==null)return null;try{return clone(JSON.parse(raw));}catch{return null;}},
    async set(k,v){storage.setItem(key(k),JSON.stringify(v));return true;},
    async delete(k){storage.removeItem(key(k));return true;}
  };
}

module.exports={createLocalStorageKeyValueStore};

},{}],
"bootstrap/Bootstrap.js":[function(require,module,exports){
'use strict';

const manifest=require('./Manifest');
const {createRuntimeEpoch}=require('../core/runtime/RuntimeEpoch');
const {createFrameLease}=require('../core/runtime/FrameLease');
const {createProductiveHeartbeat}=require('../core/health/ProductiveHeartbeat');
const {createLifecycleSupervisor}=require('../core/lifecycle/LifecycleSupervisor');
const {createModuleSupervisor}=require('../core/modules/ModuleSupervisor');
const {createRecoveryVerifier}=require('../core/recovery/RecoveryVerifier');
const {createRecoveryImageGuard}=require('../core/recovery/RecoveryImageGuard');
const {createDeploymentSafety}=require('../core/safety/DeploymentSafety');
const {createRecoveryCoordinator}=require('../core/recovery/RecoveryCoordinator');
const {createRecoveryExecutor}=require('../core/recovery/RecoveryExecutor');
const {createRuntimeProof}=require('../core/runtime/RuntimeProof');
const {createStaleCodeGuard}=require('../core/runtime/StaleCodeGuard');
const {createActivationGate}=require('../core/runtime/ActivationGate');
const {createCoreSupervisor}=require('../core/supervision/CoreSupervisor');
const {createLocalStorageKeyValueStore}=require('../adapters/storage/LocalStorageKeyValueStore');
const {createDefaultChangeVerificationRuntime}=require('../core/change-verification/createDefaultRuntime');

function defaultHooks(root){
  return{
    game:!!(root&&root.game),
    character:!!(root&&root.character),
    move:!!(root&&typeof root.move==='function'),
    smart_move:!!(root&&typeof root.smart_move==='function'),
    use_skill:!!(root&&typeof root.use_skill==='function')
  };
}

async function bootstrapV3({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  character,
  frameId,
  store,
  now=Date.now,
  hooks=defaultHooks,
  modules=[],
  activationMode='development',
  bootRequest=null,
  supervisorIntervalMs=5000,
  supervisorTimer={},
  directNativeMode=false
}={}){
  const characterName=String(character||(root.character&&root.character.name)||'');
  const frame=String(frameId||root.__POGI_BRIDGE_FRAME_ID||'');
  if(!manifest.required_characters.includes(characterName))throw new Error('V3_UNEXPECTED_CHARACTER:'+characterName);
  if(!frame)throw new Error('V3_FRAME_ID_REQUIRED');

  const staleGuard=createStaleCodeGuard({manifest,root,storage:root.localStorage,now});
  const activationGate=createActivationGate({manifest,staleGuard});
  const activation=activationGate.verify({
    mode:activationMode,
    root,
    character:characterName,
    frameId:frame,
    entrypoint:bootRequest&&bootRequest.entrypoint||manifest.entrypoint,
    build:bootRequest&&bootRequest.build||manifest.build
  });
  if(!activation.ok){
    return{ok:false,error:'V3_ACTIVATION_BLOCKED',activation};
  }

  const recoveryImageGuard=createRecoveryImageGuard({manifest});
  const recoveryImage=bootRequest&&bootRequest.recovery&&bootRequest.recovery.image||null;
  let recoveryIdentity=null;
  if(recoveryImage){
    const checked=recoveryImageGuard.verifyImage(recoveryImage);
    if(!checked.ok){
      return{ok:false,error:'V3_RECOVERY_IMAGE_BLOCKED',recovery:checked};
    }
    recoveryIdentity={snapshot_id:checked.snapshot_id,tree_hash:checked.tree_hash};
  }
  staleGuard.arm(recoveryIdentity);

  const kv=store||createLocalStorageKeyValueStore({storage:root.localStorage});
  const epoch=createRuntimeEpoch({build:manifest.build,character:characterName,frameId:frame,now});
  const lease=createFrameLease({store:kv,character:characterName,frameId:frame,epoch:epoch.epoch,now});
  const acquired=await lease.acquire();
  if(!acquired.ok)throw new Error(acquired.error);

  const heartbeat=createProductiveHeartbeat({characters:manifest.required_characters,now});
  const lifecycle=createLifecycleSupervisor({build:manifest.build,heartbeat,now});
  const recoveryVerifier=createRecoveryVerifier({
    requiredCharacters:manifest.required_characters,
    expectedBuild:manifest.build,
    expectedRecovery:recoveryIdentity
  });
  const deploymentSafety=createDeploymentSafety({affectedCharacters:manifest.required_characters,fighters:manifest.fighters,now});
  const recovery=createRecoveryCoordinator();
  const recoveryExecutor=createRecoveryExecutor({coordinator:recovery});
  if(directNativeMode||String(activationMode).toLowerCase()==='supervised'){
    recoveryExecutor.recover=async()=>({ok:false,executed:false,
      error:'V3_EXTERNAL_RECOVERY_DISABLED',action:'NONE'});
  }
  staleGuard.publishBootProof(epoch);

  const changes=createDefaultChangeVerificationRuntime({root,now,directNativeMode});
  await changes.start();

  const moduleSupervisor=createModuleSupervisor({
    now,
    onAlert:async event=>changes.alertManager.publish({
      id:'v3-module:'+String(event.module||'unknown')+':'+String(event.event||'event')+':'+String(Number(now())),
      kind:'V3_MODULE_SUPERVISION',
      event:String(event.event||event.kind||'MODULE_EVENT'),
      severity:event.critical===true?'error':'error',
      title:'V3 module '+String(event.event||'failure'),
      body:String(event.module||'unknown')+' | '+String(event.error||event.status||'module event'),
      module:event.module||null,
      requires_action:true,
      at:Number(now()),
      data:event
    })
  });

  const proof=createRuntimeProof({
    root,manifest,epoch,lifecycle,heartbeat,frameLease:lease,recoveryIdentity,now
  });

  lifecycle.advance(characterName,'HOOKS_READY',{hooks:hooks(root)});
  const hookState=hooks(root);
  if(Object.values(hookState).some(v=>v!==true)){
    lifecycle.fail(characterName,'REQUIRED_GAME_HOOK_MISSING');
    await proof.publish();
    return{
      ok:false,error:'REQUIRED_GAME_HOOK_MISSING',
      runtime:{
        manifest,epoch,lease,heartbeat,lifecycle,moduleSupervisor,recoveryVerifier,recoveryImageGuard,
        deploymentSafety,recovery,proof,changes
      }
    };
  }

  lifecycle.advance(characterName,'CONTROLLER_READY');
  heartbeat.controllerBeat(characterName,{source:'bootstrap'});

  for(const entry of modules){
    moduleSupervisor.register(entry.name,entry.module,{
      critical:entry.critical===true,
      version:entry.version||'1',
      dependencies:entry.dependencies||[],
      resources:entry.resources||[]
    });
  }
  const moduleStart=await moduleSupervisor.startAll({root,character:characterName,epoch});
  if(!moduleStart.core_ready){
    lifecycle.fail(characterName,'CRITICAL_CORE_MODULE_FAILED');
    await proof.publish();
    return{ok:false,error:'CRITICAL_CORE_MODULE_FAILED'};
  }

  lifecycle.advance(characterName,'ROLE_READY');

  const supervisor=createCoreSupervisor({
    character:characterName,
    lease,
    heartbeat,
    lifecycle,
    moduleSupervisor,
    proof,
    // P1 supervised runtime can report stalled progress but cannot execute Recovery.
    recovery:String(activationMode).toLowerCase()==='supervised'?null:recovery,
    recoveryExecutor:String(activationMode).toLowerCase()==='supervised'?null:recoveryExecutor,
    alertManager:changes.alertManager,
    now,
    intervalMs:supervisorIntervalMs,
    setIntervalFn:supervisorTimer.setIntervalFn||setInterval,
    clearIntervalFn:supervisorTimer.clearIntervalFn||clearInterval
  });

  const runtime={
    manifest,epoch,lease,heartbeat,lifecycle,moduleSupervisor,recoveryVerifier,recoveryImageGuard,
    recoveryIdentity,deploymentSafety,recovery,recoveryExecutor,proof,changes,staleGuard,activationGate,activation,supervisor,
    markProgress(kind,detail){
      heartbeat.progress(characterName,kind,detail);
      if(lifecycle.status(characterName).stage==='ROLE_READY')lifecycle.advance(characterName,'ACTIVE',{first_progress:kind});
      return proof.publish();
    },
    controllerBeat(detail){heartbeat.controllerBeat(characterName,detail);return proof.publish();},
    async shutdown(){
      supervisor.stop();
      await moduleSupervisor.stopAll({reason:'RUNTIME_SHUTDOWN'});
      proof.clear();
      return lease.release();
    }
  };

  root.__POGI_V3_RUNTIME=runtime;
  if(!directNativeMode)supervisor.start();
  await proof.publish();
  return{ok:true,runtime};
}

module.exports={bootstrapV3,defaultHooks};

},{"./Manifest":"bootstrap/Manifest.js","../core/runtime/RuntimeEpoch":"core/runtime/RuntimeEpoch.js","../core/runtime/FrameLease":"core/runtime/FrameLease.js","../core/health/ProductiveHeartbeat":"core/health/ProductiveHeartbeat.js","../core/lifecycle/LifecycleSupervisor":"core/lifecycle/LifecycleSupervisor.js","../core/modules/ModuleSupervisor":"core/modules/ModuleSupervisor.js","../core/recovery/RecoveryVerifier":"core/recovery/RecoveryVerifier.js","../core/recovery/RecoveryImageGuard":"core/recovery/RecoveryImageGuard.js","../core/safety/DeploymentSafety":"core/safety/DeploymentSafety.js","../core/recovery/RecoveryCoordinator":"core/recovery/RecoveryCoordinator.js","../core/recovery/RecoveryExecutor":"core/recovery/RecoveryExecutor.js","../core/runtime/RuntimeProof":"core/runtime/RuntimeProof.js","../core/runtime/StaleCodeGuard":"core/runtime/StaleCodeGuard.js","../core/runtime/ActivationGate":"core/runtime/ActivationGate.js","../core/supervision/CoreSupervisor":"core/supervision/CoreSupervisor.js","../adapters/storage/LocalStorageKeyValueStore":"adapters/storage/LocalStorageKeyValueStore.js","../core/change-verification/createDefaultRuntime":"core/change-verification/createDefaultRuntime.js"}],
"bootstrap/CharacterBootstrap.js":[function(require,module,exports){
'use strict';

const {bootstrapV3}=require('./Bootstrap');
const {createDefaultCatalog}=require('./DefaultCatalog');
const {createResourceArbiter}=require('../core/ownership/ResourceArbiter');
const {createStateEngine}=require('../core/state/StateEngine');
const {createStateCoordinator}=require('../core/state/StateCoordinator');
const {createDefaultStateHandlers}=require('./StateHandlers');
const {createRuntimeScheduler}=require('../core/scheduler/RuntimeScheduler');
const {createRoleDecider}=require('../core/scheduler/RoleDecider');
const {createReadinessAudit}=require('../core/health/ReadinessAudit');
const manifest=require('./Manifest');
const {createLocalStorageKeyValueStore}=require('../adapters/storage/LocalStorageKeyValueStore');
const {createBankRecoveryStore}=require('../core/recovery/BankRecoveryStore');
const {requestBridgeRecovery}=require('../adapters/bridge/BridgeV3Contract');
const {createP1SupervisedTickGate}=require('./P1SupervisedTickGate');
const {mainHierarchy,gameplayHierarchy,safetyHierarchy}=require('../states/StateRegistry');

async function bootstrapCharacterV3({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  character,
  frameId,
  adapters={},
  config={},
  eventHandlers={},
  restore={},
  now=Date.now,
  catalog=createDefaultCatalog(),
  arbiter=createResourceArbiter({now}),
  requireCompleteRole=false,
  activationMode='development',
  bootRequest=null,
  bootstrapOptions={}
}={}){
  const name=String(character||(root.character&&root.character.name)||'');
  if(!name)throw new Error('V3_CHARACTER_REQUIRED');

  const effectiveRestore={...(restore&&typeof restore==='object'?restore:{})};
  let bankRecoveryStore=null;
  let bankRecoveryLoad=null;
  if(name==='Rentaro'&&root&&root.localStorage){
    const kv=createLocalStorageKeyValueStore({storage:root.localStorage});
    bankRecoveryStore=createBankRecoveryStore({
      store:kv,
      character:name,
      build:manifest.build,
      now
    });
    bankRecoveryLoad=await bankRecoveryStore.load();
    if(effectiveRestore.Bank==null&&bankRecoveryLoad&&bankRecoveryLoad.ok===true&&bankRecoveryLoad.found===true){
      effectiveRestore.Bank=bankRecoveryLoad.session;
    }
  }

  const context={
    root,
    character:name,
    adapters,
    config,
    eventHandlers,
    restore:effectiveRestore,
    bankRecoveryStore,
    bankRecoveryLoad,
    now,
    arbiter,
    services:{}
  };

  const roleBuild=await catalog.buildRole(name,context,['CoreSupervisor']);
  if(!roleBuild.ok){
    return{ok:false,error:'ROLE_REQUIRED_MODULES_UNAVAILABLE',roleBuild};
  }
  if(requireCompleteRole&&roleBuild.missing_optional.length){
    return{ok:false,error:'ROLE_OPTIONAL_MODULES_INCOMPLETE',roleBuild};
  }

  const boot=await bootstrapV3({
    root,
    character:name,
    frameId,
    modules:roleBuild.entries,
    now,
    activationMode,
    bootRequest,
    ...bootstrapOptions,
    directNativeMode:config.nativeRouteMode===true
  });
  if(!boot.ok)return{...boot,roleBuild};

  boot.runtime.role={
    character:roleBuild.character,
    role:roleBuild.role,
    missing_optional:roleBuild.missing_optional.slice()
  };
  boot.runtime.services=roleBuild.services;
  boot.runtime.arbiter=arbiter;
  boot.runtime.moduleCatalog=catalog;
  boot.runtime.bankRecoveryStore=bankRecoveryStore;
  boot.runtime.bankRecoveryLoad=bankRecoveryLoad;
  boot.runtime.bankRecoveryStatus=()=>bankRecoveryStore?bankRecoveryStore.status():null;

  const stateEngine=createStateEngine({main:'IDLE',now});
  const stateCoordinator=createStateCoordinator({
    stateEngine,
    now,
    onProgress:async(kind,detail)=>boot.runtime.markProgress(kind,detail)
  });
  const stateHandlers=createDefaultStateHandlers(roleBuild.services);
  for(const [stateName,stateHandler] of Object.entries(stateHandlers)){
    stateCoordinator.register(stateName,stateHandler);
  }
  boot.runtime.stateEngine=Object.freeze({
    getStatus:stateEngine.getStatus,
    setSide:stateEngine.setSide,
    clearSide:stateEngine.clearSide
  });
  boot.runtime.stateCoordinator=stateCoordinator;
  boot.runtime.stateHandlers=stateHandlers;

  const control={
    pause:async(reason='MANUAL_PAUSE',options={})=>stateCoordinator.requestPause(
      String(reason||'MANUAL_PAUSE'),
      {finishBank:options&&options.finishBank!==false}
    ),
    resume:async()=>stateCoordinator.resumeAll(),
    status:()=>stateCoordinator.status(),
    hierarchy:()=>({
      main:mainHierarchy(),
      safety:safetyHierarchy(),
      gameplay:gameplayHierarchy()
    })
  };
  boot.runtime.control=control;
  if(root&&typeof root==='object'){
    root.pogi_v3_pause=control.pause;
    root.pogi_v3_resume=control.resume;
    root.pogi_v3_state_status=control.status;
    root.pogi_v3_state_hierarchy=control.hierarchy;

    const baseShutdown=boot.runtime.shutdown.bind(boot.runtime);
    boot.runtime.shutdown=async()=>{
      if(root.pogi_v3_pause===control.pause)delete root.pogi_v3_pause;
      if(root.pogi_v3_resume===control.resume)delete root.pogi_v3_resume;
      if(root.pogi_v3_state_status===control.status)delete root.pogi_v3_state_status;
      if(root.pogi_v3_state_hierarchy===control.hierarchy)delete root.pogi_v3_state_hierarchy;
      return baseShutdown();
    };
  }

  const baseDecider=createRoleDecider({
    character:roleBuild.character,
    role:roleBuild.role,
    services:roleBuild.services
  });
  // P1 user-present supervised farm session: Bank is not implemented by LiveAdapters.
  // Never fake Bank success or route a real Merchant into an unavailable BANK state.
  // All production modes retain their unchanged role decision policy.
  const decider=String(activationMode).toLowerCase()==='supervised'&&
    name==='Rentaro'&&!roleBuild.services.Bank
    ?async context=>{
      const decision=await baseDecider(context);
      if(decision&&decision.state==='BANK')return{
        state:'IDLE',reason:'P1_SUPERVISED_BANK_UNAVAILABLE_MANUAL_HOLD',
        deferred:decision
      };
      return decision;
    }:baseDecider;
  // In user-present P1 supervised farm mode, even a running CODE slot
  // cannot tick a fighter state without a separate verified party admission.
  // Production/development schedulers retain their existing behavior.
  const supervisedFighterTickGate=String(activationMode).toLowerCase()==='supervised'&&
    ['Souji','Hibari','Harutora'].includes(name)
    ?createP1SupervisedTickGate({
      root,role:name,now,
      verifyAdmission:adapters?.supervisedFarmAdmission&&
        typeof adapters.supervisedFarmAdmission.verify==='function'
        ?sample=>adapters.supervisedFarmAdmission.verify(sample):null
    }):null;
  // A deliberately blocked supervised FARM tick must be visible to Core
  // without being mistaken for a stalled state needing Recovery. No fake
  // progress is recorded; the proof still shows unproductive while held.
  if(supervisedFighterTickGate){
    boot.runtime.supervisor.setGameplayHold('P1_AWAITING_FARM_ADMISSION');
  }
  const scheduler=createRuntimeScheduler({
    coordinator:stateCoordinator,
    decide:decider,
    tickGate:supervisedFighterTickGate?()=>supervisedFighterTickGate.check():null,
    onTickGate:supervisedFighterTickGate?({allow,reason})=>
      boot.runtime.supervisor.setGameplayHold(allow?null:reason):null,
    alertManager:boot.runtime.changes&&boot.runtime.changes.alertManager||null,
    now
  });
  const readinessAudit=createReadinessAudit({manifest});

  async function requestExternalRecovery(scope,action,detail={}){
    const wasRunning=!!scheduler.status().running;
    if(wasRunning)scheduler.stop();
    const request={
      schema:1,
      brain:'V3',
      scope:String(scope),
      action:String(action),
      reason:String(detail.reason||'PRODUCTIVE_PROGRESS_STALE'),
      character:name,
      frame_id:String(frameId||boot.runtime.epoch&&boot.runtime.epoch.frame_id||''),
      epoch:String(boot.runtime.epoch&&boot.runtime.epoch.epoch||''),
      build:String(manifest.build),
      at:Number(now()),
      detail
    };
    const result=await requestBridgeRecovery(root,request);
    if(!result||result.ok===false){
      if(wasRunning)scheduler.start();
      return result;
    }
    boot.runtime.lifecycle.fail(name,'RECOVERY_HANDOFF_'+String(scope).toUpperCase());
    await boot.runtime.proof.publish();
    return result;
  }

  if(config.nativeRouteMode!==true)boot.runtime.recoveryExecutor
    .register('state',async detail=>{
      const current=stateCoordinator.status().current;
      if(current==='IDLE'){
        return{ok:true,deferred:true,reason:'NO_ACTIVE_STATE_TO_RECOVER',state:'IDLE'};
      }
      const wasRunning=!!scheduler.status().running;
      if(wasRunning)scheduler.stop();
      try{
        return await stateCoordinator.recoverCurrent({
          reason:String(detail&&detail.reason||'PRODUCTIVE_PROGRESS_STALE')
        });
      }finally{
        if(wasRunning)scheduler.start();
      }
    })
    .register('controller',detail=>requestExternalRecovery('controller','RESTART_V3_RUNTIME',detail))
    .register('frame',detail=>requestExternalRecovery('frame','RECREATE_CHARACTER_FRAME',detail))
    .register('browser',detail=>requestExternalRecovery('browser','RESTART_BROWSER_SESSION',detail));

  boot.runtime.scheduler=scheduler;
  boot.runtime.decider=decider;
  boot.runtime.readinessAudit=readinessAudit;
  boot.runtime.readiness=()=>readinessAudit.audit({
    character:roleBuild.character,
    role:roleBuild.role,
    moduleSupervisor:boot.runtime.moduleSupervisor,
    stateCoordinator,
    bridgeRoot:config.nativeRouteMode===true?null:root,
    activationMode
  });

  if(roleBuild.missing_optional.length&&boot.runtime.changes&&boot.runtime.changes.alertManager){
    await boot.runtime.changes.alertManager.publish({
      id:'v3-role-incomplete:'+name+':'+String(Number(now())),
      kind:'V3_ROLE_LOAD',
      event:'ROLE_OPTIONAL_MODULES_INCOMPLETE',
      severity:'info',
      title:'V3 role loaded with optional modules unavailable',
      body:name+' | '+roleBuild.missing_optional.join(', '),
      character:name,
      requires_action:false,
      at:Number(now()),
      data:{missing_optional:roleBuild.missing_optional.slice()}
    });
  }

  return{ok:true,runtime:boot.runtime,roleBuild};
}

module.exports={bootstrapCharacterV3};

},{"./Bootstrap":"bootstrap/Bootstrap.js","./DefaultCatalog":"bootstrap/DefaultCatalog.js","../core/ownership/ResourceArbiter":"core/ownership/ResourceArbiter.js","../core/state/StateEngine":"core/state/StateEngine.js","../core/state/StateCoordinator":"core/state/StateCoordinator.js","./StateHandlers":"bootstrap/StateHandlers.js","../core/scheduler/RuntimeScheduler":"core/scheduler/RuntimeScheduler.js","../core/scheduler/RoleDecider":"core/scheduler/RoleDecider.js","../core/health/ReadinessAudit":"core/health/ReadinessAudit.js","./Manifest":"bootstrap/Manifest.js","../adapters/storage/LocalStorageKeyValueStore":"adapters/storage/LocalStorageKeyValueStore.js","../core/recovery/BankRecoveryStore":"core/recovery/BankRecoveryStore.js","../adapters/bridge/BridgeV3Contract":"adapters/bridge/BridgeV3Contract.js","./P1SupervisedTickGate":"bootstrap/P1SupervisedTickGate.js","../states/StateRegistry":"states/StateRegistry.js"}],
"bootstrap/DefaultCatalog.js":[function(require,module,exports){
'use strict';

const {createModuleCatalog,lifecycleFacade}=require('../core/modules/ModuleCatalog');
const {createMovementService}=require('../ligaments/movement/MovementService');
const {createMerchantSharedRoutes}=require('../ligaments/movement/MerchantSharedRoutes');
const {createMerchantSharedRouteRunner}=require('../ligaments/movement/MerchantSharedRouteRunner');
const {createMerchantBossRouteGraph}=require('../ligaments/movement/MerchantBossRouteGraph');
const {createInventoryService}=require('../ligaments/inventory/InventoryService');
const {createFighterMerchantHandoff}=require('../ligaments/inventory/FighterMerchantHandoff');
const {createTargetingService}=require('../ligaments/targeting/TargetingService');
const {createPartyCoordinationService}=require('../ligaments/party/PartyCoordinationService');
const {createPriestSafeSpotHandshake}=require('../ligaments/party/PriestSafeSpotHandshake');
const {createCooldownService}=require('../ligaments/skills/CooldownService');
const {createMluckService}=require('../ligaments/skills/MluckService');
const {createGearService}=require('../ligaments/gear/GearService');
const RecipeIntelligence=require('../ligaments/crafting/RecipeIntelligence');
const {createCombatService}=require('../ligaments/combat/CombatService');
const {createFighterActionExecutor}=require('../ligaments/combat/FighterActionExecutor');
const {createFarmState}=require('../organs/farm/FarmState');
const {createStandState}=require('../organs/stand/StandState');
const {createBankState}=require('../organs/bank/BankState');
const {createMerchantCollectionVisit}=require('../organs/merchant/MerchantCollectionVisit');
const {createMerchantCircuit}=require('../organs/merchant/MerchantCircuit');
const {createBankNavigation}=require('../organs/bank/BankNavigation');
const {createBankTravelOps}=require('../organs/bank/BankTravelOps');
const {createNativeBankTravel}=require('../organs/bank/NativeBankTravel');
const {createNativeBankOps}=require('../organs/bank/NativeBankOps');
const {createGearHandoffService}=require('../ligaments/gear/GearHandoffService');
const {createGearHandoffPlanner}=require('../ligaments/gear/GearHandoffPlanner');
const {createShopLimb}=require('../ligaments/shop/ShopLimb');
const {createShopService}=require('../ligaments/shop/ShopService');
const {createShopBankHandoff}=require('../ligaments/shop/ShopBankHandoff');
const {createBankStoreOps}=require('../organs/bank/BankStoreOps');
const {createBankRetrieveOps}=require('../organs/bank/BankRetrieveOps');
const {createBankHandoffOps}=require('../organs/bank/BankHandoffOps');
const {createScanBossState}=require('../organs/bosses/ScanBossState');
const BossPolicy=require('../organs/bosses/BossPolicy');
const {createBossMissionCoordinator}=require('../organs/bosses/BossMissionCoordinator');
const {createMerchantBossScout}=require('../organs/bosses/MerchantBossScout');
const {createWorldBossState}=require('../organs/bosses/WorldBossState');
const {createEventState}=require('../organs/events/EventState');
const {createDefensivePvp}=require('../organs/pvp-defense/DefensivePvp');
const GearControlPlane=require('../organs/gear/GearControlPlane');
const {createGearProductionExecutor}=require('../organs/gear/GearProductionExecutor');
const {createMerchantController}=require('../characters/merchant/MerchantController');
const {createPriestController}=require('../characters/priest/PriestController');
const {createCasterActions}=require('../ligaments/combat/CasterActions');
const {createMageController}=require('../characters/mage/MageController');
const {createWarriorController}=require('../characters/warrior/WarriorController');
const {createWarriorV2Runtime}=require('../characters/warrior/WarriorV2Runtime');

function wrapped(service){
  return{service,module:lifecycleFacade(service)};
}

function resolveNativeHalloweenTownWait(root){
  const nativeSpawn=root?.G?.maps?.halloween?.spawns?.[0];
  if(Array.isArray(nativeSpawn)&&
    Number.isFinite(Number(nativeSpawn[0]))&&
    Number.isFinite(Number(nativeSpawn[1])))
    return{map:'halloween',x:Number(nativeSpawn[0]),y:Number(nativeSpawn[1]),radius:35};
  return{map:'halloween',x:0,y:0,radius:35};
}

function createDefaultCatalog(){
  const catalog=createModuleCatalog();

  catalog.register('Movement',{
    resources:['MOVEMENT'],
    available:ctx=>!!(ctx.arbiter&&ctx.adapters&&ctx.adapters.movement),
    factory:async ctx=>wrapped(createMovementService({arbiter:ctx.arbiter,adapter:ctx.adapters.movement}))
  });

  // All roles bind to Rentaro's single PogiPath route model, never a
  // private character route. No model = no assumed cross-map route.
  catalog.register('MerchantRoutes',{
    dependencies:['Movement'],
    factory:async ctx=>{
      const model=ctx.config?.merchantRouteModel;
      const network=model?createMerchantSharedRoutes({
        model,preferEditable:ctx.config?.merchantRoutePreferEditable!==false
      }):null;
      const bossGraph=network?createMerchantBossRouteGraph({network,model}):null;
      const runner=network?createMerchantSharedRouteRunner({
        root:ctx.root,network,movement:ctx.services.Movement,bossGraph
      }):null;
      const service=network?{
        identity:network.identity,section:network.section,plan:network.plan,portal:network.portal,
        status:()=>({...network.status(),connected:true,
          runner:runner.status(),bossGraph:bossGraph.status()}),
        followSection:index=>runner.followSection(index),
        followCircuitPoint:p=>runner.followCircuitPoint(p),
        followCircuitPortal:i=>runner.followCircuitPortal(i),
        followCircuitTown:i=>runner.followCircuitTown(i),
        followPortal:index=>runner.followPortal(index),
        castTown:index=>runner.castTown(index),
        followFarmApproach:()=>runner.followFarmApproach(),
        followItinerary:steps=>runner.followItinerary(steps),
        planBossRoute:to=>runner.planBossRoute(to),
        followBossRoute:to=>runner.followBossRoute(to)
      }:{
        identity(role){return{role,source:'POGIPATH_RENTARO_SHARED',connected:false};},
        section(){return{ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'};},
        plan(){return{ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'};},
        followSection:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        followPortal:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        castTown:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        followItinerary:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        followFarmApproach:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        planBossRoute:()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        followBossRoute:async()=>({ok:false,error:'SHARED_MERCHANT_MODEL_NOT_LOADED'}),
        status(){return{source:'POGIPATH_RENTARO_SHARED',connected:false,
          reason:'SHARED_MERCHANT_MODEL_NOT_LOADED'};}
      };
      return wrapped(service);
    }
  });

  catalog.register('MerchantCollection',{
    dependencies:['MerchantRoutes'],
    available:ctx=>ctx.character==='Rentaro',
    factory:async ctx=>wrapped(ctx.config?.merchantRouteModel&&ctx.root?.character?
      ([65,66,67,68,69,70].includes(ctx.config.merchantRouteModel.meta.version)?createMerchantCircuit:createMerchantCollectionVisit)({
        root:ctx.root,routes:ctx.services.MerchantRoutes,now:ctx.now||Date.now
      }):{
        due:()=>false,tick:async()=>({ok:true,skipped:true,reason:'NO_SAVED_ROUTE_MODEL'}),
        start:async()=>({ok:true,skipped:true}),stop:async()=>({ok:true}),
        status:()=>({enabled:false,reason:'NO_SAVED_ROUTE_MODEL'})
      })
  });

  catalog.register('Targeting',{
    factory:async ctx=>wrapped(createTargetingService({now:ctx.now||Date.now}))
  });

  catalog.register('PartyCoordination',{
    factory:async ctx=>wrapped(createPartyCoordinationService({now:ctx.now||Date.now,maxAgeMs:ctx.config&&ctx.config.partyMaxAgeMs||5000}))
  });

  // Present in both fighter graphs; absent Bridge trust leaves the service
  // inert, with no native CM listener and no fake Priest readiness receipt.
  catalog.register('PartySafeSpot',{
    factory:async ctx=>{
      const trust=ctx.adapters?.partySafetyTrust;
      const live=ctx.root?.character?.name===ctx.character&&
        trust&&typeof trust==='object'&&typeof ctx.root?.send_cm==='function'&&
        typeof ctx.root?.character?.on==='function';
      const service=live?createPriestSafeSpotHandshake({
        root:ctx.root,role:ctx.character,trust,now:ctx.now||Date.now
      }):{
        start:()=>({ok:true,inert:true}),stop:()=>({ok:true}),
        request:async()=>({ok:false,reason:'PRIEST_SIGNAL_TRUST_UNAVAILABLE'}),
        latest:()=>null,verify:()=>false,
        status:()=>({started:false,ready:false,reason:'TRUST_UNAVAILABLE'})
      };
      return wrapped(service);
    }
  });

  catalog.register('Cooldowns',{
    available:ctx=>!!ctx.arbiter,
    factory:async ctx=>wrapped(createCooldownService({now:ctx.now||Date.now,arbiter:ctx.arbiter}))
  });

  catalog.register('MerchantMluck',{
    available:ctx=>String(ctx.role||'').toUpperCase()==='MERCHANT'&&
      !!(ctx.adapters&&ctx.adapters.mluck&&typeof ctx.adapters.mluck.snapshot==='function'&&typeof ctx.adapters.mluck.cast==='function'),
    factory:async ctx=>wrapped(createMluckService({adapter:ctx.adapters.mluck,now:ctx.now||Date.now}))
  });

  catalog.register('Inventory',{
    resources:['INVENTORY'],
    available:ctx=>!!(ctx.adapters&&ctx.adapters.inventory&&typeof ctx.adapters.inventory.snapshot==='function'),
    factory:async ctx=>wrapped(createInventoryService({adapter:ctx.adapters.inventory,now:ctx.now||Date.now}))
  });

  catalog.register('MerchantHandoff',{
    available:ctx=>['Rentaro','Hibari','Souji','Harutora'].includes(ctx.character),
    factory:async ctx=>wrapped(ctx.root?.character&&typeof ctx.root?.get_player==='function'?
      createFighterMerchantHandoff({
        root:ctx.root,character:ctx.character,now:ctx.now||Date.now,inventoryService:ctx.services.Inventory||null
      }):{
        tick:async()=>({ok:true,skipped:true,reason:'FIGHTER_NOT_LIVE'}),
        status:()=>({enabled:false,reason:'FIGHTER_NOT_LIVE'})
      })
  });

  catalog.register('RecipeIntelligence',{
    factory:async()=>wrapped({
      ...RecipeIntelligence,
      health:async()=>({ok:true,source:'RecipeIntelligence',...RecipeIntelligence.stats()})
    })
  });

  catalog.register('BankNavigation',{
    factory:async()=>wrapped(createBankNavigation())
  });

  catalog.register('BankTravel',{
    dependencies:['Movement','BankNavigation','MerchantRoutes'],
    resources:['MOVEMENT'],
    available:ctx=>!!(
      ctx.adapters&&ctx.adapters.bank&&
      typeof ctx.adapters.bank.currentMap==='function'
    ),
    factory:async ctx=>wrapped(createBankTravelOps({
      movement:ctx.services.Movement,
      navigation:ctx.services.BankNavigation,
      adapter:ctx.adapters.bank,
      nativeTravel:ctx.root?.character?createNativeBankTravel({root:ctx.root,merchantRoutes:ctx.services.MerchantRoutes}):null,
      character:ctx.character,
      now:ctx.now||Date.now,
      maxRecoveryAttempts:3
    }))
  });

  catalog.register('Gear',{
    resources:['GEAR'],
    available:ctx=>!!(ctx.adapters&&ctx.adapters.gear),
    factory:async ctx=>wrapped(createGearService({
      adapter:ctx.adapters.gear,
      protectedItems:ctx.config&&ctx.config.protectedGear||[]
    }))
  });

  catalog.register('Combat',{
    dependencies:['Targeting'],
    resources:['COMBAT'],
    available:ctx=>!!(ctx.arbiter&&ctx.adapters&&ctx.adapters.combat),
    factory:async ctx=>wrapped(createCombatService({
      arbiter:ctx.arbiter,
      targeting:ctx.services.Targeting,
      adapter:ctx.adapters.combat
    }))
  });

  catalog.register('FighterActions',{
    dependencies:['Combat','Gear'],
    resources:['COMBAT','GEAR'],
    available:ctx=>!!(ctx.adapters&&ctx.adapters.fighter),
    factory:async ctx=>wrapped(createFighterActionExecutor({
      combat:ctx.services.Combat,
      gear:ctx.services.Gear,
      skills:ctx.adapters.fighter,
      combatOwner:'FARM'
    }))
  });

  catalog.register('Farm',{
    dependencies:['Targeting','PartyCoordination','Movement','Combat','MerchantRoutes'],
    resources:['MOVEMENT','COMBAT'],
    factory:async ctx=>{
      // The actual SAFE END belongs to Rentaro's shared PogiPath model.
      // Do not use the obsolete hard-coded (-144,802) fallback.
      // A PogiPath TOWN *cast point* is not necessarily a safe camp.
      // Live observation proved the old Halloween (-253.56,680) waypoint
      // can receive scorpion aggro and wipe the party; all three survived
      // at native Halloween Town (0,0). Waiting and regrouping use the
      // game's native Town spawn, not the Merchant's travel marker.
      // The pinned Merchant SECTION 23 stays unchanged for transit.
      const safeWaitPosition=resolveNativeHalloweenTownWait(ctx.root);
      const service=createFarmState({
        character:ctx.character,
        targeting:ctx.services.Targeting,
        party:ctx.services.PartyCoordination,
        movement:ctx.services.Movement,
        combat:ctx.services.Combat,
        controller:
          ctx.role==='WARRIOR'?ctx.services.WarriorCombat:
          ctx.role==='MAGE'?ctx.services.MageCombat:
          ctx.role==='PRIEST'?ctx.services.PriestCombat:null,
        actionExecutor:ctx.services.FighterActions||null,
        fighter:ctx.adapters&&ctx.adapters.fighter||null,
        root:ctx.root||null,
        partySafeSpotSignal:ctx.services.PartySafeSpot||null,
        mageRegroupAuthority:ctx.adapters&&ctx.adapters.mageRegroupAuthority||null,
        merchantRoutes:ctx.services.MerchantRoutes,
        priestHealingMonitor:ctx.root?.__POGI_V3_PRIEST_HEAL_OWNER||null,
        warriorV2Runtime:ctx.services.WarriorV2Runtime||null,
        casterActions:ctx.services.CasterActions||null,
        crewCodeActive:who=>{
          try{
            const states=ctx.root?.get_active_characters?.()||{};
            if(ctx.config?.nativeRouteMode===true){
              const main=ctx.root?.top?.get_active_characters?.()||{};
              return ['code','active','self'].includes(states[who])||['code','active','self'].includes(main[who]);
            }
            return states?.[who]==='code';
          }catch(_){return false}
        },
        config:{
          position:{map:'halloween',x:-495.5,y:685.5,radius:120},
          safeWaitPosition,
          merchantRouteEnforced:true,
          nativeRouteMode:ctx.config?.nativeRouteMode===true,
          // Rentaro's exact R18 route: Main section, native door,
          // Halloween Town, then the saved SAFE END section. Never
          // auto-cast Town at SAFE END or extrapolate into mob pack.
          merchantItinerariesByMap:{
            main:[{kind:'MAIN_TOWN',index:716},
              {kind:'SECTION',index:22},{kind:'PORTAL',index:838},
              {kind:'TOWN',index:839},{kind:'SECTION',index:23},
              {kind:'FARM_APPROACH'}],
            halloween:[{kind:'SECTION',index:23},{kind:'FARM_APPROACH'}]
          },
          ...(ctx.config&&ctx.config.farm||{})
        }
      });
      return{
        service,
        module:{
          start:async()=>({ok:true,initialized:true}),
          pause:async()=>service.pause(),
          resume:async()=>({ok:true,initialized:true}),
          health:async()=>service.health(),
          snapshot:async()=>service.snapshot(),
          restore:async value=>service.restore(value),
          stop:async()=>service.stop(),
          detach:async()=>service.stop()
        }
      };
    }
  });

  catalog.register('Stand',{
    resources:['STAND'],
    available:ctx=>!!(ctx.adapters&&ctx.adapters.stand),
    factory:async ctx=>{
      const service=createStandState({adapter:ctx.adapters.stand,now:ctx.now||Date.now});
      return{
        service,
        module:{
          start:async()=>service.initialize(),
          pause:async()=>service.pause(),
          resume:async()=>({ok:true,initialized:true}),
          health:async()=>service.health(),
          snapshot:async()=>service.snapshot(),
          restore:async value=>service.restore(value),
          stop:async()=>service.stop(),
          detach:async()=>service.stop()
        }
      };
    }
  });

  catalog.register('Shop',{
    dependencies:['Inventory','BankTravel'],
    resources:['SHOP'],
    available:ctx=>!!(
      ctx.adapters&&ctx.adapters.shop&&
      ctx.adapters.bank&&
      typeof ctx.adapters.bank.snapshot==='function'&&
      typeof ctx.adapters.bank.retrieve==='function'
    ),
    factory:async ctx=>{
      const limb=createShopLimb();
      const inventory=ctx.services.Inventory;
      const retrieveOps=createBankRetrieveOps({
        adapter:ctx.adapters.bank,
        inventory,
        travel:ctx.services.BankTravel
      });
      const service=createShopService({
        shop:limb,
        inventory,
        adapter:ctx.adapters.shop,
        bankSnapshot:async()=>ctx.adapters.bank.snapshot()
      });
      const bankHandoff=createShopBankHandoff({shop:limb,bankRetrieve:retrieveOps});
      service.bankHandoff=async()=>{
        await service.plan();
        return bankHandoff.handoff();
      };
      return wrapped(service);
    }
  });

  catalog.register('Bank',{
    dependencies:['Inventory','Movement','BankTravel'],
    resources:['MOVEMENT','INVENTORY','BANK_ACCESS'],
    available:ctx=>!!(ctx.adapters?.bankOps||(
      ctx.character==='Rentaro'&&ctx.adapters?.bank&&
      typeof ctx.root?.bank_store==='function'&&
      typeof ctx.root?.bank_deposit==='function'
    )),
    factory:async ctx=>{
      const base=ctx.adapters.bankOps||createNativeBankOps({
        root:ctx.root,bank:ctx.adapters.bank,travel:ctx.services.BankTravel,
        routes:ctx.services.MerchantRoutes,now:ctx.now||Date.now,keepGold:50000
      });
      const ops={};
      for(const name of ['enter','scan','apply_policy','organize','verify','publish','exit']){
        if(typeof base[name]==='function')ops[name]=base[name].bind(base);
      }
      ops.travel=ctx.services.BankTravel.travel;
      const gearOps=ctx.services.GearHandoff?createBankHandoffOps({gearHandoff:ctx.services.GearHandoff}):null;
      ops.handoff=async()=>{
        if(ctx.config?.preserveBankStock===true)return{ok:true,skipped:true,reason:'BANK_STOCK_PRESERVED'};
        const gearActive=ctx.services.GearHandoff&&typeof ctx.services.GearHandoff.status==='function'?ctx.services.GearHandoff.status():null;
        if(gearActive&&gearOps)return gearOps.handoff();
        if(ctx.services.Shop&&typeof ctx.services.Shop.bankHandoff==='function'){
          const shopResult=await ctx.services.Shop.bankHandoff();
          if(shopResult&&shopResult.skipped!==true)return shopResult;
        }
        if(gearOps)return gearOps.handoff();
        return{ok:true,skipped:true,reason:'NO_BANK_HANDOFF_WORK'};
      };
      return wrapped(createBankState({ops,initialSession:ctx.restore&&ctx.restore.Bank||null,recoveryStore:ctx.bankRecoveryStore||null}));
    }
  });

  catalog.register('ScanBoss',{
    factory:async ctx=>wrapped(createScanBossState({
      characterName:ctx.character,
      role:ctx.role,
      now:ctx.now||Date.now
    }))
  });

  catalog.register('BossScout',{
    factory:async ctx=>wrapped(createMerchantBossScout({
      root:ctx.root,character:ctx.character,
      fighter:ctx.adapters?.fighter||null,
      now:ctx.now||Date.now
    }))
  });

  catalog.register('Events',{
    resources:['MOVEMENT'],
    factory:async ctx=>wrapped(createEventState({
      handlers:ctx.eventHandlers||{},
      initialEnabled:ctx.config&&ctx.config.eventsEnabled||{},
      now:ctx.now||Date.now
    }))
  });

  catalog.register('PvpDefense',{
    resources:['COMBAT','MOVEMENT'],
    factory:async ctx=>wrapped(createDefensivePvp({
      whitelist:ctx.config&&ctx.config.pvpWhitelist||[],
      blacklist:ctx.config&&ctx.config.pvpBlacklist||[],
      now:ctx.now||Date.now
    }))
  });

  catalog.register('WorldBoss',{
    dependencies:['Targeting','Movement','Combat','MerchantRoutes','PartyCoordination'],
    resources:['MOVEMENT','COMBAT'],
    factory:async ctx=>{
      const missionConfig=ctx.config&&ctx.config.bossMission||{};
      const missions=createBossMissionCoordinator({
        root:ctx.root,
        characterName:ctx.character,
        role:ctx.role,
        now:ctx.now||Date.now,
        ttlMs:missionConfig.ttlMs,
        activationRadius:missionConfig.activationRadius,
        transport:ctx.adapters&&ctx.adapters.bossMission||null
      });
      const service=createWorldBossState({
        character:ctx.character,
        role:ctx.role,
        missions,
        targeting:ctx.services.Targeting,
        combat:ctx.services.Combat,
        movement:ctx.services.Movement,
        fighter:ctx.adapters&&ctx.adapters.fighter||null,
        gear:ctx.services.Gear||null,
        warriorV2Runtime:ctx.services.WarriorV2Runtime||null,
        casterActions:ctx.services.CasterActions||null,
        stand:ctx.services.Stand||null,
        root:ctx.root,
        merchantRoutes:ctx.services.MerchantRoutes||null,
        partyCoordination:ctx.services.PartyCoordination||null,
        priestCombat:ctx.services.PriestCombat||null,
        config:ctx.config&&ctx.config.worldBoss||{}
      });
      service.policy=BossPolicy;
      service.missions=missions;
      service.shouldActivate=input=>{
        const c=ctx.root?.character||{};
        return missions.shouldActivate({...input,
          entities:input?.entities||ctx.adapters?.fighter?.entitiesSnapshot?.()||{},
          serverStatus:input?.serverStatus||ctx.root?.parent?.S||ctx.root?.server?.status||{},
          position:input?.position||{map:c.map,x:c.real_x??c.x,y:c.real_y??c.y}});
      };
      service.missionStatus=missions.status;
      return{
        service,
        module:{
          start:async()=>({ok:true,initialized:true}),
          pause:async()=>service.pause(),
          resume:async()=>({ok:true,initialized:true}),
          health:async()=>service.health(),
          snapshot:async()=>service.snapshot(),
          restore:async value=>service.restore(value),
          stop:async()=>service.stop(),
          detach:async()=>service.stop()
        }
      };
    }
  });

  catalog.register('GearHandoff',{
    dependencies:['Inventory','BankTravel'],
    resources:['INVENTORY','BANK_ACCESS','GEAR'],
    available:ctx=>!!(
      ctx.adapters&&ctx.adapters.bank&&
      typeof ctx.adapters.bank.snapshot==='function'&&
      typeof ctx.adapters.bank.retrieve==='function'&&
      typeof ctx.adapters.bank.store==='function'
    ),
    factory:async ctx=>{
      const protectedSet=new Set((ctx.config&&ctx.config.protectedGear||[]).map(String));
      const inventory=ctx.services.Inventory;
      const isProtected=item=>protectedSet.has(String(item&&item.name||''))||protectedSet.has(inventory.identity(item));
      const planner=createGearHandoffPlanner({isProtected});
      const retrieveOps=createBankRetrieveOps({
        adapter:ctx.adapters.bank,
        inventory,
        travel:ctx.services.BankTravel
      });
      const storeOps=createBankStoreOps({
        adapter:ctx.adapters.bank,
        inventory,
        metaResolver:typeof ctx.adapters.bank.itemMeta==='function'?name=>ctx.adapters.bank.itemMeta(name):null,
        travel:ctx.services.BankTravel
      });
      return wrapped(createGearHandoffService({
        inventory,retrieveOps,storeOps,planner,controlPlane:GearControlPlane,
        executorReady:()=>!!(
          ctx.services.GearProduction&&
          typeof ctx.services.GearProduction.executionReady==='function'&&
          ctx.services.GearProduction.executionReady()===true
        ),
        now:ctx.now||Date.now
      }));
    }
  });

  catalog.register('GearProduction',{
    dependencies:['Inventory','Movement','GearHandoff'],
    resources:['MOVEMENT','INVENTORY','GEAR'],
    factory:async ctx=>wrapped(createGearProductionExecutor({
      inventory:ctx.services.Inventory,
      movement:ctx.services.Movement,
      handoff:ctx.services.GearHandoff,
      adapter:ctx.adapters&&ctx.adapters.gearProduction||null,
      policy:GearControlPlane,
      now:ctx.now||Date.now
    }))
  });

  catalog.register('MerchantController',{
    dependencies:['Inventory','GearHandoff'],
    factory:async ctx=>wrapped(createMerchantController({
      inventory:ctx.services.Inventory,
      gearHandoff:ctx.config?.preserveBankStock===true?null:ctx.services.GearHandoff,
      shop:ctx.config?.preserveBankStock===true?null:ctx.services.Shop,
      collection:ctx.services.MerchantCollection||null,
      character:ctx.character
    }))
  });

  catalog.register('PriestCombat',{
    dependencies:['PartyCoordination','Cooldowns'],
    factory:async ctx=>wrapped(createPriestController({
      party:ctx.services.PartyCoordination,
      cooldowns:ctx.services.Cooldowns,
      character:ctx.character
    }))
  });

  catalog.register('CasterActions',{
    dependencies:['Gear'],
    available:ctx=>['Harutora','Souji'].includes(ctx.character)&&ctx.root?.character?.name===ctx.character,
    factory:async ctx=>wrapped(createCasterActions({root:ctx.root,fighter:ctx.adapters?.fighter,gear:ctx.services.Gear,now:ctx.now||Date.now}))
  });

  catalog.register('MageCombat',{
    dependencies:['PartyCoordination'],
    factory:async ctx=>wrapped(createMageController({party:ctx.services.PartyCoordination,character:ctx.character}))
  });

  // One Warrior-owned V3 native heartbeat, no legacy duplicate intervals.
  // FarmState retains movement/combat control; this service owns potions,
  // scare/Town low-HP retreat, Taunt, buffs and Harutora Magiport consent.
  catalog.register('WarriorV2Runtime',{
    dependencies:['PartyCoordination'],
    available:ctx=>ctx.character==='Hibari'&&
      ctx.root?.character?.name==='Hibari'&&typeof ctx.root.use_skill==='function',
    factory:async ctx=>wrapped(createWarriorV2Runtime({
      root:ctx.root,
      gear:ctx.services.Gear||null,
      farmStatus:()=>ctx.services.Farm?.snapshot?.()||null,
      bossStatus:()=>ctx.services.WorldBoss?.getStatus?.()||null,
      now:ctx.now||Date.now
    }))
  });

  catalog.register('WarriorCombat',{
    dependencies:['PartyCoordination'],
    factory:async ctx=>wrapped(createWarriorController({party:ctx.services.PartyCoordination,character:ctx.character}))
  });

  return catalog;
}

module.exports={createDefaultCatalog,resolveNativeHalloweenTownWait};

},{"../core/modules/ModuleCatalog":"core/modules/ModuleCatalog.js","../ligaments/movement/MovementService":"ligaments/movement/MovementService.js","../ligaments/movement/MerchantSharedRoutes":"ligaments/movement/MerchantSharedRoutes.js","../ligaments/movement/MerchantSharedRouteRunner":"ligaments/movement/MerchantSharedRouteRunner.js","../ligaments/movement/MerchantBossRouteGraph":"ligaments/movement/MerchantBossRouteGraph.js","../ligaments/inventory/InventoryService":"ligaments/inventory/InventoryService.js","../ligaments/inventory/FighterMerchantHandoff":"ligaments/inventory/FighterMerchantHandoff.js","../ligaments/targeting/TargetingService":"ligaments/targeting/TargetingService.js","../ligaments/party/PartyCoordinationService":"ligaments/party/PartyCoordinationService.js","../ligaments/party/PriestSafeSpotHandshake":"ligaments/party/PriestSafeSpotHandshake.js","../ligaments/skills/CooldownService":"ligaments/skills/CooldownService.js","../ligaments/skills/MluckService":"ligaments/skills/MluckService.js","../ligaments/gear/GearService":"ligaments/gear/GearService.js","../ligaments/crafting/RecipeIntelligence":"ligaments/crafting/RecipeIntelligence.js","../ligaments/combat/CombatService":"ligaments/combat/CombatService.js","../ligaments/combat/FighterActionExecutor":"ligaments/combat/FighterActionExecutor.js","../organs/farm/FarmState":"organs/farm/FarmState.js","../organs/stand/StandState":"organs/stand/StandState.js","../organs/bank/BankState":"organs/bank/BankState.js","../organs/merchant/MerchantCollectionVisit":"organs/merchant/MerchantCollectionVisit.js","../organs/merchant/MerchantCircuit":"organs/merchant/MerchantCircuit.js","../organs/bank/BankNavigation":"organs/bank/BankNavigation.js","../organs/bank/BankTravelOps":"organs/bank/BankTravelOps.js","../organs/bank/NativeBankTravel":"organs/bank/NativeBankTravel.js","../organs/bank/NativeBankOps":"organs/bank/NativeBankOps.js","../ligaments/gear/GearHandoffService":"ligaments/gear/GearHandoffService.js","../ligaments/gear/GearHandoffPlanner":"ligaments/gear/GearHandoffPlanner.js","../ligaments/shop/ShopLimb":"ligaments/shop/ShopLimb.js","../ligaments/shop/ShopService":"ligaments/shop/ShopService.js","../ligaments/shop/ShopBankHandoff":"ligaments/shop/ShopBankHandoff.js","../organs/bank/BankStoreOps":"organs/bank/BankStoreOps.js","../organs/bank/BankRetrieveOps":"organs/bank/BankRetrieveOps.js","../organs/bank/BankHandoffOps":"organs/bank/BankHandoffOps.js","../organs/bosses/ScanBossState":"organs/bosses/ScanBossState.js","../organs/bosses/BossPolicy":"organs/bosses/BossPolicy.js","../organs/bosses/BossMissionCoordinator":"organs/bosses/BossMissionCoordinator.js","../organs/bosses/MerchantBossScout":"organs/bosses/MerchantBossScout.js","../organs/bosses/WorldBossState":"organs/bosses/WorldBossState.js","../organs/events/EventState":"organs/events/EventState.js","../organs/pvp-defense/DefensivePvp":"organs/pvp-defense/DefensivePvp.js","../organs/gear/GearControlPlane":"organs/gear/GearControlPlane.js","../organs/gear/GearProductionExecutor":"organs/gear/GearProductionExecutor.js","../characters/merchant/MerchantController":"characters/merchant/MerchantController.js","../characters/priest/PriestController":"characters/priest/PriestController.js","../ligaments/combat/CasterActions":"ligaments/combat/CasterActions.js","../characters/mage/MageController":"characters/mage/MageController.js","../characters/warrior/WarriorController":"characters/warrior/WarriorController.js","../characters/warrior/WarriorV2Runtime":"characters/warrior/WarriorV2Runtime.js"}],
"bootstrap/FighterAutoRespawn.js":[function(require,module,exports){
'use strict';

// Fighter-owned recovery from a GAME death. Independent of a paused or held
// combat scheduler: this must work even when FARM/WorldBoss stopped ticking.
// Does not relaunch Chrome, bypass party combat rules, or auto-attack.
const FIGHTERS=Object.freeze(['Souji','Hibari','Harutora']);
function createFighterAutoRespawn({
  root,
  character,
  now=Date.now,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval,
  intervalMs=700,
  respawnDelayMs=2500,
  retryCooldownMs=12000
}={}){
  const role=String(character||root?.character?.name||'');
  if(!FIGHTERS.includes(role)&&role!=='Rentaro')throw Error('V3_AUTO_RESPAWN_FIGHTER_ONLY');
  if(!root||typeof root.respawn!=='function')throw Error('V3_AUTO_RESPAWN_NATIVE_REQUIRED');
  let timer=null,inFlight=false,deadSince=null,lastAttemptAt=null;
  let respawnAttempts=0,respawnConfirmed=0,lastError=null,awaitingArrival=false;
  function dead(){
    const c=root.character||{};
    if(String(c.name||'')!==role)return false;
    // A game-native rip/dead flag is authoritative. Do not infer death
    // from missing HP or an incomplete character packet.
    return c.rip===true||c.dead===true;
  }
  function observeAlive(){
    const c=root.character||{};
    return c.name===role&&c.rip===false&&c.dead!==true&&
      Number.isFinite(Number(c.hp))&&Number(c.hp)>0;
  }
  async function tick(){
    if(inFlight)return{ok:true,skipped:true,reason:'RESPAWN_IN_FLIGHT'};
    const t=Number(now());
    if(!dead()){
      if(awaitingArrival&&observeAlive()){
        awaitingArrival=false;respawnConfirmed++;lastError=null;
      }
      deadSince=null;
      return{ok:true,alive:true,confirmed:respawnConfirmed};
    }
    if(deadSince===null)deadSince=t;
    if(t-deadSince<Math.max(0,Number(respawnDelayMs)||0))
      return{ok:true,waiting:true,reason:'DEATH_SETTLE_DELAY'};
    if(lastAttemptAt!==null&&t-lastAttemptAt<Math.max(2500,Number(retryCooldownMs)||12000))
      return{ok:true,waiting:true,reason:'RESPAWN_COOLDOWN'};
    lastAttemptAt=t;respawnAttempts++;inFlight=true;
    try{
      // Explicit game-native self-respawn only. The normal V3 First State
      // and healer/warrior readiness policies own all post-respawn movement.
      const result=await root.respawn();
      if(result?.failed===true||result?.ok===false){
        lastError=String(result?.error||result?.message||'NATIVE_RESPAWN_REJECTED');
        return{ok:false,error:lastError,attempt:respawnAttempts};
      }
      awaitingArrival=true;
      if(observeAlive()){
        awaitingArrival=false;respawnConfirmed++;lastError=null;
      }
      return{ok:true,action:'NATIVE_SELF_RESPAWN',attempt:respawnAttempts,
        confirmed:!awaitingArrival};
    }catch(error){
      lastError=String(error?.message||error);
      return{ok:false,error:lastError,attempt:respawnAttempts};
    }finally{inFlight=false;}
  }
  function start(){
    if(timer!==null)return{ok:true,alreadyStarted:true};
    timer=setIntervalFn(()=>{void tick().catch(error=>{
      lastError=String(error?.message||error);
    });},Math.max(250,Number(intervalMs)||700));
    return{ok:true,enabled:true,role};
  }
  function stop(){
    if(timer!==null)clearIntervalFn(timer);
    timer=null;
    return{ok:true,enabled:false,role};
  }
  function status(){return{
    role,enabled:timer!==null,dead:dead(),deadSince,lastAttemptAt,
    respawnAttempts,respawnConfirmed,awaitingArrival,inFlight,lastError
  };}
  return{start,stop,tick,status};
}
module.exports={FIGHTERS,createFighterAutoRespawn};

},{}],
"bootstrap/FighterFirstState.js":[function(require,module,exports){
'use strict';

// Fighter-owned FIRST STATE. One independent instance per CODE runner.
// Plans the first safe handoff; never launches characters, moves, fights,
// revives, or grants farm admission. An execution adapter must verify routes
// and game actions separately. Rentaro is not a fighter startup controller.
const FIGHTERS=Object.freeze(['Souji','Hibari','Harutora']);
const DEFAULT_WAIT=Object.freeze({map:'halloween',x:-144,y:802,radius:45});
const NEXT_STATES=new Set(['IDLE','EVENT','WORLD_BOSS','RETREAT','FARM']);
const finite=Number.isFinite;
function createFighterFirstState({
  role,now=Date.now,maxObservationAgeMs=3000,minHpRatio=0.75,
  partyRange=170,waitSpot=DEFAULT_WAIT,
  verifySafeLeg=null,verifyFarmAdmission=null
}={}){
  if(!FIGHTERS.includes(role))throw Error('FIGHTER_FIRST_STATE_ROLE_REQUIRED');
  if(!waitSpot||!waitSpot.map||!finite(waitSpot.x)||!finite(waitSpot.y)||
     !finite(waitSpot.radius)||waitSpot.radius<=0)throw Error('FIGHTER_FIRST_STATE_WAIT_SPOT_INVALID');
  let phase='BOOT',lastReason='NOT_OBSERVED',checks=0;
  const fresh=(o,t)=>o&&Number.isSafeInteger(o.observedAt)&&o.observedAt<=t&&
    t-o.observedAt<=maxObservationAgeMs;
  const position=o=>o&&typeof o.map==='string'&&finite(o.x)&&finite(o.y);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const atWait=o=>o.map===waitSpot.map&&distance(o,waitSpot)<=waitSpot.radius;
  const result=(kind,reason,extra={})=>{
    phase=kind;lastReason=reason;checks++;
    return Object.freeze({role,kind,reason,combatAuthorized:false,
      hasSideEffects:false,autoRetry:false,...extra});
  };
  function partyReady(self,party,t){
    if(!party||typeof party!=='object')return false;
    const required=role==='Harutora'?FIGHTERS:['Hibari','Souji'];
    return required.every(name=>{
      const p=name===role?self:party[name];
      return p&&p.role===name&&p.connected===true&&p.codeLoaded===true&&
        p.rip!==true&&finite(p.hp)&&finite(p.maxHp)&&p.maxHp>0&&
        p.hp/p.maxHp>=minHpRatio&&position(p)&&p.map===self.map&&
        fresh(p,t)&&distance(p,self)<=partyRange;
    });
  }
  function inspect({self,world,party,previousState='IDLE',safeLeg=null,
                     farmAdmission=null}={}){
    const t=Number(now());
    if(!Number.isSafeInteger(t)||!self||self.role!==role||
       self.connected!==true||self.codeLoaded!==true||
       !fresh(self,t)||!position(self))
      return result('WAIT_SELF','FIGHTER_FULL_LOGIN_AND_POSITION_REQUIRED');
    if(self.rip===true||!finite(self.hp)||self.hp<=0)
      return result('DEAD_HOLD','NO_AUTO_REVIVE_OR_COMBAT');
    if(!finite(self.maxHp)||self.maxHp<=0||self.hp>self.maxHp)
      return result('WAIT_SELF','FIGHTER_VITALS_UNKNOWN');
    if(!world||world.entityFeedKnown!==true||!fresh(world,t)||
       typeof world.nearFarmMob!=='boolean'||typeof world.bossActive!=='boolean')
      return result('WAIT_WORLD','FRESH_LOCAL_MONSTER_AND_BOSS_VIEW_REQUIRED');
    if(self.hp/self.maxHp<minHpRatio||self.targeted===true||world.damageRecent===true)
      return result('SAFETY_HOLD','LOW_HP_OR_UNDER_ATTACK');
    if(world.bossActive)
      return result('BOSS_HANDOFF','PRESERVE_EXISTING_BOSS_CONTROLLER');
    const ready=partyReady(self,party,t);
    if(world.nearFarmMob){
      // First State must not assume a path across maps, through monsters,
      // or past an unverified portal is safe.
      if(!atWait(self)){
        if(!safeLeg||safeLeg.verified!==true||
           safeLeg.source!=='V3_VERIFIED_SAFE_LEG'||
           !fresh(safeLeg,t)||safeLeg.role!==role||
           safeLeg.map!==self.map||!position(safeLeg.destination)||
           safeLeg.destination.map!==self.map||
           !finite(safeLeg.fromX)||!finite(safeLeg.fromY)||
           Math.hypot(safeLeg.fromX-self.x,safeLeg.fromY-self.y)>5||
           distance(self,safeLeg.destination)>180||
           safeLeg.collisionClear!==true||
           safeLeg.hostilesClear!==true||
           typeof verifySafeLeg!=='function'||
           verifySafeLeg(safeLeg,{role,self})!==true){
          return result('WAIT_SAFE_ROUTE','SAFE_WAIT_PATH_NOT_VERIFIED',
            {waitSpot:{...waitSpot}});
        }
        return result('SAFE_LEG_READY','ONE_VERIFIED_SAFE_LEG_AVAILABLE',
          {leg:{map:self.map,x:safeLeg.destination.x,y:safeLeg.destination.y},
           waitSpot:{...waitSpot}});
      }
      if(!ready)return result('WAIT_TEAM','SAFE_SPOT_WAIT_FOR_REQUIRED_FIGHTERS',
        {waitSpot:{...waitSpot}});
      // First State can finish at the wait spot, but a separate, verified
      // route and farm admission are required before any farming can start.
      return result('READY_FOR_FARM_ROUTE','TEAM_TOGETHER_AT_SAFE_WAIT',
        {nextState:'FARM_ROUTE',waitSpot:{...waitSpot}});
    }
    if(atWait(self)&&!ready)
      return result('WAIT_TEAM','WAIT_AT_STAGING_UNTIL_PARTY_READY',
        {waitSpot:{...waitSpot}});
    // Away from farm mobs: don't drag a healthy fighter away from its
    // existing task. FARM still requires separate runtime farm admission.
    const next=NEXT_STATES.has(previousState)?previousState:'IDLE';
    if(next==='FARM'){
      if(!ready||!farmAdmission||farmAdmission.verified!==true||
         farmAdmission.role!==role||!fresh(farmAdmission,t)||
         typeof verifyFarmAdmission!=='function'||
         verifyFarmAdmission(farmAdmission,{role,self,party})!==true)
        return result('WAIT_FARM_ADMISSION','FARM_RESUME_REQUIRES_FRESH_PARTY_PROOF');
    }
    return result('HANDOFF','RESUME_SAFE_PREVIOUS_TASK',{nextState:next});
  }
  function status(){return Object.freeze({role,phase,reason:lastReason,checks});}
  return Object.freeze({inspect,status});
}
module.exports={FIGHTERS,DEFAULT_WAIT,createFighterFirstState};

},{}],
"bootstrap/LiveBootstrap.js":[function(require,module,exports){
'use strict';

const {bootstrapCharacterV3}=require('./CharacterBootstrap');
const {createAdventureLandLiveAdapters,auditLiveAdapters}=require('../adapters/adventureland/LiveAdapters');
const {createMerchantSharedRoutes}=require('../ligaments/movement/MerchantSharedRoutes');
const {createFighterAutoRespawn}=require('./FighterAutoRespawn');
const {createCrewResources}=require('../ligaments/inventory/CrewResources');
const {createPriestAlwaysHeal}=require('./PriestAlwaysHeal');
const {createNativePartyReunion}=require('./NativePartyReunion');
// Immutable published copy of Rentaro's exact v59 PogiPath draft.
// Private PogiBrain is the source, public delivery is read-only transport.
// No PogiPath editor server CORS change and no Bridge dependency.
const SHARED_POGIPATH_MODEL=require('../navigation/PogiPathMerchantSharedRoutesV65.json');

async function obtainMerchantRouteModel(root,config={}){
  if(config.merchantRouteModel){
    const network=createMerchantSharedRoutes({model:config.merchantRouteModel});
    return{model:config.merchantRouteModel,source:network.status()};
  }
  if(!config.merchantRouteUrl){const model=SHARED_POGIPATH_MODEL;return{model,source:createMerchantSharedRoutes({model}).status()};}
  const top=(()=>{try{return root.top||root}catch(_){return root}})();
  const existing=top.__POGI_SHARED_MERCHANT_ROUTE_MODEL;
  if(existing){
    const network=createMerchantSharedRoutes({model:existing});
    return{model:existing,source:network.status(),cached:true};
  }
  const load=root.fetch||top.fetch;
  if(typeof load!=='function')
    return{model:null,source:{connected:false,error:'SHARED_MERCHANT_ROUTE_FETCH_UNAVAILABLE'}};
  try{
    const response=await load.call(root,config.merchantRouteUrl,
      {cache:'no-store',credentials:'omit'});
    if(!response||response.ok!==true)
      throw Error('MERCHANT_ROUTE_HTTP_'+String(response&&response.status||'UNKNOWN'));
    const payload=await response.json();
    const model=payload?.model||payload;
    const network=createMerchantSharedRoutes({model});
    // One immutable route revision for all four roles until the next startup.
    try{if(!top.__POGI_SHARED_MERCHANT_ROUTE_MODEL)
      top.__POGI_SHARED_MERCHANT_ROUTE_MODEL=model}catch(_){}
    return{model,source:network.status()};
  }catch(error){
    return{model:null,source:{connected:false,
      error:'MERCHANT_SHARED_ROUTE_LOAD_FAILED:'+String(error?.message||error)}};
  }
}


async function bootstrapCharacterFromAdventureLand({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  character,
  frameId,
  bankOps=null,
  config={},
  routeAuthority=null,
  partySafetyTrust=null,
  mageRegroupAuthority=null,
  eventHandlers={},
  restore={},
  now=Date.now,
  activationMode='development',
  requireCompleteRole=true,
  bootRequest=null,
  bootstrapOptions={}
}={}){
  // Retire the independent November-22 Mage combat-parity override.
  // Its orbit/timer hooks could keep acting on Harutora after the
  // warrior disappeared. The canonical V3 Farm/Mage controller owns combat.
  if(root?.character?.name==='Harutora'){
    try{
      const legacy=root.__O66_V3_FARM_COMBAT_PARITY;
      if(legacy?.role==='Harutora')legacy.stop?.();
      if(legacy?.role==='Harutora')delete root.__O66_V3_FARM_COMBAT_PARITY;
    }catch(_){}
  }
  const adapterAudit=auditLiveAdapters(root);
  if(!adapterAudit.ok){
    return{ok:false,error:'LIVE_ADAPTERS_INCOMPLETE',adapterAudit};
  }

  // Souji's first gameplay service: start healing BEFORE party reunion,
  // merchant-route downloading, and role bootstrap.
  // A stalled Farm or boss scheduler must not stop Souji's native heals.
  let priestHealing=null;
  if(String(character||root?.character?.name||'')==='Souji'&&
      root?.character?.name==='Souji'&&typeof root?.use_skill==='function'){
    priestHealing=createPriestAlwaysHeal({
      root,now,
      setIntervalFn:bootstrapOptions?.priestHealTimer?.setIntervalFn||setInterval,
      clearIntervalFn:bootstrapOptions?.priestHealTimer?.clearIntervalFn||clearInterval
    });
    // Stop prior owners before starting the new owner; never overlap timers.
    root.__POGI_V3_PRIEST_HEAL_OWNER?.stop?.();
    // Retire the older independent 2026-11-22 Priest heartbeat.
    try{
      const old=root.__POGI_V3_PRIEST_HEAL;
      if(old&&typeof old.stop==='function'&&
          old.status?.().running===true)old.stop();
    }catch(_){}
    root.__POGI_V3_PRIEST_HEAL_OWNER=priestHealing;
    priestHealing.start();
  }

  // Native party invitations begin with the character frame; a disbanded
  // party leaves Souji seeing ONLY his own HP regardless of heal priority.
  let partyReunion=null;
  const name=String(character||root?.character?.name||'');
  if(['Rentaro','Hibari','Souji','Harutora'].includes(name)&&
      root?.character?.name===name){
    partyReunion=createNativePartyReunion({root,role:name,now,
      setIntervalFn:bootstrapOptions?.partyTimer?.setIntervalFn||setInterval,
      clearIntervalFn:bootstrapOptions?.partyTimer?.clearIntervalFn||clearInterval});
    partyReunion.start();
  }

  // Hibari keeps his own emergency heartbeat; all other roles use the shared resource lane.
  let resources=null;
  if(['Rentaro','Souji','Harutora'].includes(name)&&root?.character?.name===name){
    root.__POGI_V3_CREW_RESOURCES?.stop?.();
    resources=createCrewResources({root,now,healer:()=>{
      const p=root.get_player?.('Souji'),c=root.character;
      return !!p&&!p.rip&&!p.dead&&p.hp>0&&p.mp>0&&(!p.map||p.map===c.map)&&
        Math.hypot(Number(p.real_x??p.x)-Number(c.real_x??c.x),Number(p.real_y??p.y)-Number(c.real_y??c.y))<=190;
    }});
    root.__POGI_V3_CREW_RESOURCES=resources;resources.start();
  }
  let merchantRouteSource;
  try{merchantRouteSource=await obtainMerchantRouteModel(root,config);}
  catch(error){
    partyReunion?.stop();
    resources?.stop();
    priestHealing?.stop();
    if(root.__POGI_V3_PRIEST_HEAL_OWNER===priestHealing)
      delete root.__POGI_V3_PRIEST_HEAL_OWNER;
    throw error;
  }
  const effectiveConfig={...config,
    merchantRouteModel:merchantRouteSource.model||config.merchantRouteModel||null};
  const adapters=createAdventureLandLiveAdapters(root,{
    routeAuthority,partySafetyTrust,mageRegroupAuthority,preserveBankStock:config.preserveBankStock===true
  });
  if(bankOps&&typeof bankOps==='object')adapters.bankOps=bankOps;

  let result;
  try{result=await bootstrapCharacterV3({
    root,
    character,
    frameId,
    adapters,
    config:effectiveConfig,
    eventHandlers,
    restore,
    now,
    requireCompleteRole,
    activationMode,
    bootRequest,
    bootstrapOptions
  });}
  catch(error){
    resources?.stop();
    priestHealing?.stop();
    if(root.__POGI_V3_PRIEST_HEAL_OWNER===priestHealing)
      delete root.__POGI_V3_PRIEST_HEAL_OWNER;
    throw error;
  }
  if(result?.ok!==true){
    partyReunion?.stop();
    resources?.stop();
    priestHealing?.stop();
    if(root.__POGI_V3_PRIEST_HEAL_OWNER===priestHealing)
      delete root.__POGI_V3_PRIEST_HEAL_OWNER;
  }
  if(result?.ok===true&&partyReunion){
    result.runtime.partyReunion=partyReunion;
    const previous=result.runtime.shutdown.bind(result.runtime);
    result.runtime.shutdown=async()=>{
      partyReunion.stop();
      return previous();
    };
  }
  if(result?.ok===true&&priestHealing){
    result.runtime.priestAlwaysHeal=priestHealing;
    const prior=result.runtime.shutdown.bind(result.runtime);
    result.runtime.shutdown=async()=>{
      priestHealing.stop();
      if(root.__POGI_V3_PRIEST_HEAL_OWNER===priestHealing)
        delete root.__POGI_V3_PRIEST_HEAL_OWNER;
      return prior();
    };
  }

  if(result?.ok===true&&resources){
    result.runtime.crewResources=resources;
    const prior=result.runtime.shutdown.bind(result.runtime);
    result.runtime.shutdown=async()=>{resources.stop();return prior();};
  }

  // Self-respawn is a fighter CODE-frame service, not a Farm/WorldBoss tick.
  // It survives combat-state pauses and cannot cause fighter attacks.
  if(result?.ok===true&&result.runtime&&
      ['Rentaro','Hibari','Harutora','Souji'].includes(String(character||root?.character?.name||''))&&
      typeof root?.respawn==='function'){
    const owner=createFighterAutoRespawn({
      root,character:character||root.character.name,now,
      setIntervalFn:bootstrapOptions?.autoRespawnTimer?.setIntervalFn||setInterval,
      clearIntervalFn:bootstrapOptions?.autoRespawnTimer?.clearIntervalFn||clearInterval
    });
    owner.start();
    result.runtime.autoRespawn=owner;
    const previousShutdown=result.runtime.shutdown.bind(result.runtime);
    result.runtime.shutdown=async()=>{
      owner.stop();
      return previousShutdown();
    };
  }

  return{
    ...result,
    adapterAudit,
    adaptersReady:true,
    bankOpsConnected:!!adapters.bankOps,
    merchantRouteSource:merchantRouteSource.source
  };
}

module.exports={bootstrapCharacterFromAdventureLand};

},{"./CharacterBootstrap":"bootstrap/CharacterBootstrap.js","../adapters/adventureland/LiveAdapters":"adapters/adventureland/LiveAdapters.js","../ligaments/movement/MerchantSharedRoutes":"ligaments/movement/MerchantSharedRoutes.js","./FighterAutoRespawn":"bootstrap/FighterAutoRespawn.js","../ligaments/inventory/CrewResources":"ligaments/inventory/CrewResources.js","./PriestAlwaysHeal":"bootstrap/PriestAlwaysHeal.js","./NativePartyReunion":"bootstrap/NativePartyReunion.js","../navigation/PogiPathMerchantSharedRoutesV65.json":"navigation/PogiPathMerchantSharedRoutesV65.json"}],
"bootstrap/Manifest.js":[function(require,module,exports){
'use strict';

const V3_SCHEMA=1;
const V3_BUILD='2026.10.08-v3-halloween-server-end-expiry-9';

const REQUIRED_CHARACTERS=Object.freeze(['Rentaro','Hibari','Souji','Harutora']);
const FIGHTERS=Object.freeze(['Hibari','Souji','Harutora']);

const RECOVERY_POLICY=Object.freeze({
  schema:1,
  brain:'V3',
  store:'order66-lkg-v3',
  generation_required:true,
  atomic_restore:true,
  promotion:'VERIFIED_CANDIDATE_ONLY',
  mixed_generation:'FAIL_CLOSED',
  restart_count:1,
  external_restore_ready:false,
  automatic_rollback_requires_production_identity:true,
  automatic_rollback_on_alignment_failure:'BLOCK_AND_ALERT',
  promotion_requires_post_write_alignment:true,
  recovery_hold_requires_expected_production:true,
  alignment_watchdog:true,
  alignment_watchdog_interval_ms:10000,
  event_boss_terminology:true,
  event_boss_warrior_rescue_taunt_only:true,
  event_boss_taunt_protected_targets:Object.freeze(['Harutora','Souji']),
  event_boss_proactive_taunt:false,
  event_boss_mage_zap_disabled:true,
  regular_boss_offense_requires_warrior_present:true,
  event_boss_offense_requires_warrior_first_hit:true,
  event_boss_first_hit_latched_for_mission:true,
  event_boss_first_hit_authority:'HIBARI_SUCCESSFUL_ATTACK',
  event_boss_first_hit_shared_mission:true,
  event_boss_same_identity_refresh_preserves_sequence:true,
  event_boss_first_hit_latched_for_mission:true,
  event_boss_first_hit_authority:'HIBARI_SUCCESSFUL_ATTACK',
  event_boss_first_hit_shared_mission:true,
  event_boss_same_identity_refresh_preserves_sequence:true,
  mrgreen_server_event_mage_owner:true,
  mrgreen_mage_rally_magiport:true,
  mrgreen_fighters_wait_for_mage_rally:true,
  mrpumpkin_server_event_mage_owner:true,
  mrpumpkin_server_event_durable_lock:true,
  mrpumpkin_mage_forced_magiport:false,
  halloween_server_event_end_clear:true,
  halloween_server_event_end_mechanism:'LEASE_EXPIRY_WHEN_NOT_REFRESHED',
  halloween_server_event_end_lease_ms:4000,
  halloween_server_event_local_visible_republish:true,
  mrgreen_server_event_end_clear:true,
  mrpumpkin_server_event_end_clear:true,
  anti_ks_owner_state:'FARM_MOB',
  anti_ks_foreign_party_arm_distance:50,
  anti_ks_world_boss_preempt:true,
  anti_ks_event_preempt:true,
  anti_ks_stale_claim_handoff_forbidden:true,
  anti_ks_boss_target_zap_forbidden:true,
  anti_ks_boss_target_taunt_forbidden:true,
  boss_rescue_taunt_independent_of_anti_ks:true,
  runtime_proof_fields:Object.freeze(['recovery_snapshot_id','recovery_tree_hash'])
});

const REQUIRED_EVENT_BOSS_POLICY=Object.freeze({
  event_boss_terminology:true,
  event_boss_warrior_rescue_taunt_only:true,
  event_boss_proactive_taunt:false,
  event_boss_mage_zap_disabled:true,
  regular_boss_offense_requires_warrior_present:true,
  event_boss_offense_requires_warrior_first_hit:true,
  mrgreen_server_event_mage_owner:true,
  mrgreen_mage_rally_magiport:true,
  mrgreen_fighters_wait_for_mage_rally:true,
  mrpumpkin_server_event_mage_owner:true,
  mrpumpkin_server_event_durable_lock:true,
  mrpumpkin_mage_forced_magiport:false,
  halloween_server_event_end_clear:true,
  halloween_server_event_end_mechanism:'LEASE_EXPIRY_WHEN_NOT_REFRESHED',
  halloween_server_event_end_lease_ms:4000,
  halloween_server_event_local_visible_republish:true,
  mrgreen_server_event_end_clear:true,
  mrpumpkin_server_event_end_clear:true,
  anti_ks_world_boss_preempt:true,
  anti_ks_event_preempt:true,
  anti_ks_boss_target_zap_forbidden:true,
  anti_ks_boss_target_taunt_forbidden:true,
  boss_rescue_taunt_independent_of_anti_ks:true
});
function assertEventBossPolicy(policy=RECOVERY_POLICY){
  for(const [key,expected] of Object.entries(REQUIRED_EVENT_BOSS_POLICY)){
    if(policy[key]!==expected)throw new Error('V3_EVENT_BOSS_POLICY_REGRESSION_'+key);
  }
  const targets=Array.isArray(policy.event_boss_taunt_protected_targets)
    ?Array.from(policy.event_boss_taunt_protected_targets)
    :[];
  if(JSON.stringify(targets)!==JSON.stringify(['Harutora','Souji'])){
    throw new Error('V3_EVENT_BOSS_POLICY_REGRESSION_event_boss_taunt_protected_targets');
  }
  return true;
}
assertEventBossPolicy();
const CORE_MODULES=Object.freeze([
  'RuntimeEpoch',
  'FrameLease',
  'LifecycleSupervisor',
  'ProductiveHeartbeat',
  'ModuleSupervisor',
  'RecoveryVerifier',
  'RecoveryImageGuard',
  'DeploymentSafety',
  'RecoveryCoordinator',
  'ChangeVerifier',
  'CoreSupervisor',
  'ModuleContract',
  'RoleManifest',
  'BridgeV3Contract',
  'ModuleCatalog',
  'StateCoordinator',
  'RuntimeScheduler',
  'ActivationGate',
  'ReadinessAudit'
]);

module.exports=Object.freeze({
  schema:V3_SCHEMA,
  build:V3_BUILD,
  root:'adventureland/v3',
  entrypoint:'adventureland/v3/bootstrap/Bootstrap.js',
  required_characters:REQUIRED_CHARACTERS,
  fighters:FIGHTERS,
  recovery_policy:RECOVERY_POLICY,
  core_modules:CORE_MODULES,
  production_selectable:false,
  allowed_dependency_roots:['adventureland/v3'],
  allowed_shared_files:[],
  forbidden_dependency_roots:['adventureland/v2','adventureland/pv2','adventureland/state-v2','api/current'],
  required_event_boss_policy:REQUIRED_EVENT_BOSS_POLICY,
  assert_event_boss_policy:assertEventBossPolicy
});

},{}],
"bootstrap/NativePartyReunion.js":[function(require,module,exports){
'use strict';

// Native, single-browser party reunion. Never moves, attacks, restarts a
// frame/browser, or sends an invitation outside the fixed Pogi Crew.
const CREW=Object.freeze(['Rentaro','Hibari','Souji','Harutora']);
const FIGHTERS=Object.freeze(['Souji','Hibari','Harutora']);
function createNativePartyReunion({
  root,role=String(root?.character?.name||''),now=Date.now,
  intervalMs=20000,inviteCooldownMs=30000,
  setIntervalFn=setInterval,clearIntervalFn=clearInterval
}={}){
  if(!CREW.includes(role)||root?.character?.name!==role)
    throw Error('NATIVE_PARTY_REUNION_ROLE_MISMATCH');
  let timer=null,priorInviteHandler=null,priorMagiportHandler=null,installed=false,
    lastInviteAt={},invites=0,accepts=0,lastError=null;
  const localName=name=>CREW.includes(String(name||''));
  function roster(){
    try{
      const rows=root.get_party?.()||root.parent?.party||{};
      return rows&&typeof rows==='object'?rows:{};
    }catch{return{};}
  }
  function online(){
    try{return root.get_active_characters?.()||{};}catch{return{};}
  }
  function alreadyGrouped(name,rows){
    return Object.prototype.hasOwnProperty.call(rows,name);
  }
  function rentaroUnavailable(){
    // Do not create a competing Hibari-led party while Rentaro is alive.
    // In the single-tab runner, the merchant native character is readable
    // through the top-level main CODE frame. Unknown status is not death.
    try{
      const merchant=root.top?.document?.getElementById?.('maincode')
        ?.contentWindow?.character;
      if(merchant?.name==='Rentaro')
        return merchant.rip===true||merchant.dead===true||
          (Number.isFinite(Number(merchant.hp))&&Number(merchant.hp)<=0);
    }catch(_){}
    const active=online();
    return !Object.prototype.hasOwnProperty.call(active,'Rentaro');
  }
  function canInvite(){
    if(root.character?.rip===true||root.character?.dead===true||
      Number(root.character?.hp||0)<=0)return false;
    if(typeof root.send_party_invite!=='function')return false;
    if(role==='Rentaro')return true;
    // If Rentaro is currently not in the party, an ungrouped Hibari can
    // gather Souji. Do not compete with an existing leader.
    if(role==='Hibari'){
      const rows=roster();
      const listed=Object.keys(rows).filter(localName);
      return rentaroUnavailable()&&!alreadyGrouped('Rentaro',rows)&&
        (listed.length<=1||listed.every(n=>['Hibari','Souji','Harutora'].includes(n)));
    }
    return false;
  }
  function targets(){
    const rows=roster(),active=online();
    if(role==='Rentaro'){
      return FIGHTERS.filter(n=>!alreadyGrouped(n,rows)&&
        (Object.prototype.hasOwnProperty.call(active,n)||active[n]==='code'));
    }
    if(role==='Hibari'){
      // Souji is first priority: a missing party roster prevents him from
      // reading Hibari's HP even while they occupy the same safe spot.
      return ['Souji','Harutora'].filter(n=>!alreadyGrouped(n,rows)&&
        Object.prototype.hasOwnProperty.call(active,n));
    }
    return[];
  }
  async function tick(){
    if(!canInvite())return{ok:true,skipped:true,reason:'NOT_NATIVE_PARTY_LEADER'};
    const t=Number(now()),pending=targets();
    if(!pending.length)return{ok:true,joined:true};
    // One native invite per tick, then 30s per specific target. No floods.
    const name=pending.find(n=>lastInviteAt[n]==null||t-lastInviteAt[n]>=inviteCooldownMs);
    if(!name)return{ok:true,skipped:true,reason:'INVITE_COOLDOWN'};
    lastInviteAt[name]=t;
    try{
      const out=await root.send_party_invite(name);
      if(out?.failed===true||out?.ok===false){
        lastError=String(out?.reason||out?.error||'NATIVE_INVITE_REJECTED');
        return{ok:false,error:lastError,target:name};
      }
      invites++;lastError=null;
      return{ok:true,invited:name,invites};
    }catch(e){
      lastError=String(e?.message||e);
      return{ok:false,error:lastError,target:name};
    }
  }
  function start(){
    if(timer!==null)return{ok:true,alreadyStarted:true};
    priorInviteHandler=root.on_party_invite;
    if(typeof root.accept_party_invite==='function'){
      const handler=function(from){
        const sender=String(from||'');
        // Only the two approved party leaders, never a random stranger.
        if(['Rentaro','Hibari'].includes(sender)&&sender!==role){
          try{
            const out=root.accept_party_invite(sender);
            if(out?.catch)out.catch(e=>{lastError=String(e?.message||e)});
            accepts++;
            return out;
          }catch(e){lastError=String(e?.message||e);return false;}
        }
        if(typeof priorInviteHandler==='function')return priorInviteHandler(from);
      };
      root.on_party_invite=handler;
      installed=true;
      api.handler=handler;
    }
    // The two fighters accept only their own crew Mage's native summon.
    // No Bridge or manually approved ticket; server cooldown/arrival still apply.
    if(['Souji','Hibari'].includes(role)&&typeof root.accept_magiport==='function'){
      priorMagiportHandler=root.on_magiport;
      api.magiportHandler=function(from){
        if(String(from||'')!=='Harutora')return;
        if(root.character?.rip||root.character?.dead)return;
        try{const out=root.accept_magiport('Harutora');out?.catch?.(e=>{lastError=String(e?.message||e)});return out}catch(e){lastError=String(e?.message||e)}
      };
      root.on_magiport=api.magiportHandler;
    }
    timer=setIntervalFn(()=>{void tick().catch(e=>{
      lastError=String(e?.message||e);
    });},Math.max(3000,Number(intervalMs)||20000));
    timer?.unref?.();
    // Rejoin promptly on character startup (but never while dead).
    void tick().catch(e=>{lastError=String(e?.message||e)});
    return{ok:true,enabled:true,role};
  }
  function stop(){
    if(timer!==null)clearIntervalFn(timer);
    timer=null;
    if(installed&&root.on_party_invite===api.handler)
      root.on_party_invite=priorInviteHandler;
    installed=false;
    if(api.magiportHandler&&root.on_magiport===api.magiportHandler)root.on_magiport=priorMagiportHandler;
    return{ok:true,enabled:false};
  }
  function status(){return{role,enabled:timer!==null,invites,accepts,
    lastError,partyMembers:Object.keys(roster()),lastInviteAt:{...lastInviteAt}};}
  const api={start,stop,tick,status,handler:null};
  return api;
}
module.exports={CREW,FIGHTERS,createNativePartyReunion};

},{}],
"bootstrap/Order66DirectLaunch.js":[function(require,module,exports){
'use strict';
// Canonical direct CODE-slot entrypoint; one runtime per role.
// Rentaro's saved CODE slot owns fighter launches. No V29 side-loader or
// temporary formation/combat timers; LiveBootstrap owns current V3 services.
const {bootstrapCharacterFromAdventureLand}=require('./LiveBootstrap');
const SHARED_ROUTE_VERSION=require('../navigation/PogiPathMerchantSharedRoutesV65.json').meta.version;
const ROLES=new Set(['Rentaro','Souji','Hibari','Harutora']);
async function launchOrder66Direct({root=globalThis,now=Date.now}={}){
 const role=root?.character?.name;
 if(!ROLES.has(role))return{ok:false,error:'O66_UNKNOWN_CHARACTER'};
 const prior=root.__POGI_V3_DIRECT_STATUS;
 if(prior?.active||prior?.starting)return{ok:true,alreadyRunning:true,status:prior};
 const status={role,starting:true,active:false,phase:'BOOTSTRAP',at:Number(now()),error:null};
 root.__POGI_V3_DIRECT_STATUS=status;
 try{
  const result=await bootstrapCharacterFromAdventureLand({
   root,character:role,frameId:'order66direct_'+role+'_'+Number(now()),
   activationMode:'development',requireCompleteRole:false,
   config:{nativeRouteMode:true,preserveBankStock:true},
   bootstrapOptions:{supervisorTimer:{setIntervalFn:()=>0,clearIntervalFn:()=>{}}}
  });
  if(!result?.ok||!result.runtime?.scheduler)
   throw Error(String(result?.error||'DIRECT_RUNTIME_NOT_CREATED'));
  const runtime=result.runtime;
  if(!runtime.services?.MerchantRoutes||result.merchantRouteSource?.modelVersion!==SHARED_ROUTE_VERSION)
   throw Error('DIRECT_SHARED_ROUTES_NOT_READY');
  if(role==='Rentaro'&&!runtime.services?.MerchantCollection)
   throw Error('DIRECT_MERCHANT_CIRCUIT_MISSING');
  if(role==='Souji'&&!runtime.priestAlwaysHeal)
   throw Error('DIRECT_PRIEST_HEAL_MISSING');
  if(role!=='Rentaro'&&!runtime.services?.Farm)
   throw Error('DIRECT_FARM_MISSING');
  if(runtime.changes?.alertManager)
   runtime.changes.alertManager.publish=async()=>({ok:true,disabled:'DIRECT_NO_SUPERVISION'});
  root.__POGI_V3_DIRECT_RUNTIME=runtime;
  runtime.scheduler.start();
  if(runtime.scheduler.status()?.running!==true)throw Error('DIRECT_SCHEDULER_NOT_RUNNING');
  Object.assign(status,{starting:false,active:true,phase:'RUNNING',routeSource:result.merchantRouteSource,missingOptional:result.roleBuild?.missing_optional||[]});
  try{root.game_log?.('O66 V3 '+role+' gameplay running')}catch(_){}
  return{ok:true,role,status};
 }catch(e){
  Object.assign(status,{starting:false,active:false,phase:'FAILED',error:String(e?.message||e)});
  try{root.game_log?.('O66 V3 '+role+' failed: '+status.error)}catch(_){}
  return{ok:false,role,error:status.error,status};
 }
}
module.exports={launchOrder66Direct};

},{"./LiveBootstrap":"bootstrap/LiveBootstrap.js","../navigation/PogiPathMerchantSharedRoutesV65.json":"navigation/PogiPathMerchantSharedRoutesV65.json"}],
"bootstrap/P1SupervisedTickGate.js":[function(require,module,exports){
'use strict';
// P1 only: mandatory supervised fighter gameplay gate. Pure read-only check.
// Must not accept a self-labelled admission: Bridge/First State supplies an
// independently validated verifier for the exact active session. No verifier
// means HOLD. Never moves, revives, starts CODE, fights, or restarts a frame.
const ROLES=new Set(['Souji','Hibari','Harutora']);
const HEX=/^[a-f0-9]{40}$/;
const SESSION=/^[A-Za-z0-9_-]{12,80}$/;
function createP1SupervisedTickGate({
  root,role,now=Date.now,verifyAdmission=null,maxAgeMs=3000
}={}){
  if(!ROLES.has(role))throw Error('P1_SUPERVISED_FIGHTER_REQUIRED');
  if(!root||typeof root!=='object')throw Error('P1_SUPERVISED_ROOT_REQUIRED');
  if(!Number.isFinite(maxAgeMs)||maxAgeMs<250||maxAgeMs>10000)throw Error('P1_SUPERVISED_FRESHNESS_INVALID');
  const hold=(reason)=>Object.freeze({allow:false,reason,progress:false,hasSideEffects:false});
  function check(){
    // The game's live frame must be valid before considering stored permits.
    const c=root.character;
    if(!c||c.name!==role)return hold('P1_ROLE_FRAME_MISSING');
    if(c.rip===true||typeof c.hp!=='number'||!Number.isFinite(c.hp)||c.hp<=0)
      return hold('P1_ZERO_HP_OR_RIP');
    if(root.socket?.connected!==true)return hold('P1_SOCKET_NOT_CONNECTED');
    const maxHp=c.max_hp;
    if(typeof maxHp!=='number'||!Number.isFinite(maxHp)||maxHp<=0||
      c.hp>maxHp||c.hp/maxHp<0.75)return hold('P1_HP_SAFETY_THRESHOLD_NOT_MET');
    if(c.map!=='halloween')return hold('P1_NOT_ON_APPROVED_FARM_MAP');
    const x=c.real_x??c.x,y=c.real_y??c.y;
    if(typeof x!=='number'||!Number.isFinite(x)||
      typeof y!=='number'||!Number.isFinite(y))return hold('P1_POSITION_NOT_NUMERIC');
    if(Math.hypot(x+495.5,y-685.5)>120)
      return hold('P1_NOT_AT_ATTESTED_XSCORPION_FARM');
    // A valid role's location alone does not grant any activity.
    if(typeof verifyAdmission!=='function')return hold('P1_INDEPENDENT_ADMISSION_VERIFIER_REQUIRED');
    const status=root.__POGI_V3_LOADER_STATUS;
    const ticket=root.__POGI_V3_SUPERVISED_APPROVAL;
    if(!status||status.role!==role||status.activationMode!=='supervised'||
      status.ok!==true||status.installed!==true||status.gameplayStarted!==true)
      return hold('P1_PINNED_SUPERVISED_LOADER_UNVERIFIED');
    const session=String(ticket?.sessionId||'');
    const sourceCommit=String(status.sourceCommit||'');
    const releaseCommit=String(status.releaseCommit||'');
    if(!SESSION.test(session)||!HEX.test(sourceCommit)||!HEX.test(releaseCommit)||
      ticket.character!==role||ticket.userPresent!==true||ticket.singleTab!==true||
      ticket.noRecovery!==true||ticket.sourceCommit!==sourceCommit||
      ticket.releaseCommit!==releaseCommit)
      return hold('P1_EXACT_SESSION_PINS_REQUIRED');
    const sample={
      sessionId:session,sourceCommit,releaseCommit,role,map:'halloween',
      x,y,hp:c.hp,maxHp,
      source:'V3_SUPERVISED_LIVE_FRAME',
      observedAt:Number(now())
    };
    // The independent approval must attest current full-party safety and
    // route completion, not merely repeat this read-only frame object.
    let admission=null;
    try{admission=verifyAdmission(Object.freeze(sample));}catch(_){admission=null;}
    const t=Number(now());
    // Refuse a Boolean, a Promise, an expired record, or a self-asserted
    // approved flag without a complete role/session/boss/route attestation.
    const approved=admission&&typeof admission==='object'&&
      typeof admission.then!=='function'&&
      admission.source==='P1_BRIDGE_FARM_ADMISSION'&&
      admission.verified===true&&
      SESSION.test(admission.handoffId||'')&&
      admission.sessionId===session&&
      admission.sourceCommit===sourceCommit&&
      admission.releaseCommit===releaseCommit&&
      admission.role===role&&
      admission.routeVerified===true&&
      admission.stagingSafe===true&&
      admission.bossClear===true&&
      admission.singleTab===true&&
      Array.isArray(admission.partyRoles)&&
      admission.partyRoles.length===(role==='Harutora'?3:2)&&
      (role==='Harutora'?['Souji','Hibari','Harutora']:['Souji','Hibari'])
        .every(r=>admission.partyRoles.includes(r))&&
      new Set(admission.partyRoles).size===admission.partyRoles.length&&
      Number.isSafeInteger(admission.observedAt)&&
      Number.isSafeInteger(admission.expiresAt)&&
      admission.observedAt<=t&&
      t-admission.observedAt<=maxAgeMs&&
      admission.expiresAt>=t&&
      admission.expiresAt<=t+maxAgeMs;
    // The verifier must not change frame position, health, socket, pins, or
    // loader while deciding; if it does, deny this tick and re-observe.
    const sameFrame=c===root.character&&root.socket?.connected===true&&
      c.rip!==true&&c.map==='halloween'&&
      (c.real_x??c.x)===x&&(c.real_y??c.y)===y&&c.hp===sample.hp&&
      c.max_hp===sample.maxHp&&
      root.__POGI_V3_LOADER_STATUS===status&&
      root.__POGI_V3_SUPERVISED_APPROVAL===ticket&&
      status.role===role&&status.activationMode==='supervised'&&
      status.ok===true&&status.installed===true&&
      status.gameplayStarted===true&&status.sourceCommit===sourceCommit&&
      status.releaseCommit===releaseCommit&&
      ticket.sessionId===session&&ticket.character===role&&
      ticket.userPresent===true&&ticket.singleTab===true&&
      ticket.noRecovery===true&&ticket.sourceCommit===sourceCommit&&
      ticket.releaseCommit===releaseCommit;
    return approved&&sameFrame?Object.freeze({allow:true,reason:'P1_INDEPENDENT_FARM_ADMISSION',progress:false,hasSideEffects:false}):
      hold('P1_FRESH_PARTY_FARM_ADMISSION_REQUIRED');
  }
  return Object.freeze({check});
}
module.exports={createP1SupervisedTickGate};

},{}],
"bootstrap/PriestAlwaysHeal.js":[function(require,module,exports){
'use strict';

// Dedicated first-on, fighter-frame Souji healer. Runs independently from
// FARM/WorldBoss ticks, including when the team is waiting for Hibari.
const {createPriestController}=require('../characters/priest/PriestController');

function createPriestAlwaysHeal({
  root,
  now=Date.now,
  intervalMs=350,
  healHoldMs=5000,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval
}={}){
  if(!root||root.character?.name!=='Souji'||typeof root.use_skill!=='function')
    throw Error('PRIEST_NATIVE_HEAL_FRAME_REQUIRED');
  let timer=null,busy=false,lastAttemptAt=null,lastSkill=null,lastTarget=null;
  let lastError=null,attempts=0,injured=[],holdUntil=0,lastPlan=null;

  function getVisible(name){
    if(name==='Souji')return root.character;
    for(const getter of [
      ()=>root.get_player?.(name),
      ()=>root.parent?.entities?.[name],
      ()=>root.get_entity?.(name)
    ]){
      try{const found=getter();if(found)return found;}catch(_){}
    }
    return null;
  }
  function snapshot(){
    let party={};
    try{party=root.get_party?.()||root.parent?.party||{}}catch(_){}
    const rows=[];
    for(const [name,cached] of Object.entries(party||{})){
      if(!name||!cached||typeof cached!=='object')continue;
      const visible=getVisible(name),row=visible||cached;
      const hp=Number(row.hp??cached.hp),max_hp=Number(row.max_hp??cached.max_hp);
      if(!Number.isFinite(hp)||!Number.isFinite(max_hp)||max_hp<=0)continue;
      const x=visible?(visible.real_x??visible.x):cached.x;
      const y=visible?(visible.real_y??visible.y):cached.y;
      rows.push({name,hp,max_hp,
        online:visible!==null||cached.online!==false,reportedInParty:true,
        visible:visible!==null,visibilityRequired:true,
        rip:row.rip===true||cached.rip===true,
        dead:row.dead===true||cached.dead===true,
        map:visible?.map??cached.map??null,
        instance:visible?.in??visible?.instance??cached.in??cached.instance??null,
        x:x==null?null:Number(x),y:y==null?null:Number(y)});
    }
    const self=root.character;
    const idx=rows.findIndex(m=>m.name==='Souji');
    const own={name:'Souji',hp:Number(self.hp||0),
      max_hp:Number(self.max_hp||0),online:true,visible:true,
      visibilityRequired:true,reportedInParty:true,rip:self.rip===true,
      dead:self.dead===true,map:self.map??null,
      instance:self.in??self.instance??null,
      x:Number(self.real_x??self.x),y:Number(self.real_y??self.y)};
    if(idx>=0)rows[idx]=own;
    else rows.push(own);
    return rows;
  }
  function ready(skill){
    try{
      if(root.is_on_cooldown?.(skill==='heal'?'attack':skill)===true)return false;
      if(skill==='heal'&&typeof root.heal==='function')return true;
      if(typeof root.can_use==='function')return root.can_use(skill)===true;
      return true;
    }catch(_){return false;}
  }
  let currentMembers=[];
  const controller=createPriestController({party:{status:()=>currentMembers.slice(),get:name=>currentMembers.find(m=>m.name===name)||null},cooldowns:{status:skill=>({ready:ready(skill)})},character:'Souji'});
  function status(){return{
    enabled:timer!==null,busy,lastAttemptAt,lastSkill,lastTarget,lastError,
    attempts,injured:injured.slice(),holdUntil,lastPlan
  };}
  function holdForHealing(){return Number(now())<holdUntil||busy;}
  async function tick(){
    if(busy)return{ok:true,skipped:true,reason:'HEAL_IN_FLIGHT'};
    if(root.character?.name!=='Souji'||root.character?.rip===true||
       root.character?.dead===true||Number(root.character?.hp||0)<=0)
      return{ok:true,skipped:true,reason:'PRIEST_NOT_ALIVE'};
    const members=snapshot();
    injured=members.filter(m=>m.dead!==true&&m.rip!==true&&
      m.hp<m.max_hp).map(m=>m.name);
    currentMembers=members;
    const plan=controller.plan({groupHealSplitDistance:50,healRange:190});
    if(plan?.action?.kind==='USE_SKILL'||plan?.reason==='PARTY_INJURED_HEAL_PENDING')
      holdUntil=Math.max(holdUntil,Number(now())+Math.max(0,healHoldMs));
    lastPlan=plan?.reason||null;
    const action=plan?.action;
    if(action?.kind!=='USE_SKILL'||!['heal','partyheal'].includes(action.skill))
      return{ok:true,pending:injured.length>0,reason:plan?.reason||'NO_HEAL_NEEDED'};
    if(lastAttemptAt!==null&&Number(now())-lastAttemptAt<250)
      return{ok:true,pending:true,reason:'HEAL_CAST_THROTTLED'};
    busy=true;attempts++;lastAttemptAt=Number(now());lastSkill=action.skill;
    lastTarget=action.target||null;
    try{
      const target=action.target?(getVisible(action.target)||action.target):null;
      // Adventure Land direct Heal is a native priest attack-action API.
      // use_skill('heal') is not the direct healing implementation.
      const out=action.skill==='heal'&&typeof root.heal==='function'?
        await root.heal(getVisible(action.target)):
        target===null?await root.use_skill(action.skill):await root.use_skill(action.skill,target);
      if(out?.failed===true||out?.ok===false||out?.success===false){
        lastError=String(out?.reason||out?.error||'NATIVE_HEAL_REJECTED');
        return{ok:false,error:lastError,skill:action.skill};
      }
      lastError=null;
      // Skill was requested; actual HP change is observed next tick.
      return{ok:true,requested:true,skill:action.skill,target:lastTarget,
        reason:plan.reason};
    }catch(error){
      lastError=String(error?.message||error);
      return{ok:false,error:lastError,skill:action.skill};
    }finally{busy=false;}
  }
  function start(){
    if(timer!==null)return{ok:true,alreadyStarted:true};
    timer=setIntervalFn(()=>{void tick().catch(e=>{
      lastError=String(e?.message||e);
    });},Math.max(200,Number(intervalMs)||350));
    timer?.unref?.(); // Node tests must not keep the process alive.
    // Begin healing as soon as the fighter frame is running; no Farm gate.
    void tick().catch(e=>{lastError=String(e?.message||e);});
    return{ok:true,enabled:true};
  }
  function stop(){
    if(timer!==null)clearIntervalFn(timer);
    timer=null;
    return{ok:true,enabled:false};
  }
  return{tick,start,stop,status,holdForHealing};
}
module.exports={createPriestAlwaysHeal};

},{"../characters/priest/PriestController":"characters/priest/PriestController.js"}],
"bootstrap/StateHandlers.js":[function(require,module,exports){
'use strict';

function createBankHandler(bank){
  if(!bank)return null;
  return{
    start:async()=>typeof bank.begin==='function'?bank.begin():({ok:true}),
    pause:async()=>({ok:true}),
    resume:async()=>({ok:true}),
    stop:async()=>({ok:true}),
    health:async()=>{
      const status=bank.getStatus();
      return{ok:!status.session.lastError,status};
    },
    snapshot:async()=>bank.getStatus().session,
    restore:async value=>bank.restore(value),
    run:async()=>{
      const runner=typeof bank.runStep==='function'?bank.runStep.bind(bank):bank.run.bind(bank);
      const out=await runner();
      return{
        ok:true,
        progress:out.advanced!==false,
        kind:'BANK_PROGRESS',
        complete:out.status==='COMPLETE',
        reason:out.status==='COMPLETE'?'BANK_COMPLETE':'BANK_PROGRESS',
        result:out
      };
    }
  };
}

function createStandHandler(stand,shop,{now=Date.now,minIntervalMs=5000}={}){
  if(!stand)return null;
  let lastShopRunAt=null;
  return{
    start:async meta=>stand.start(meta),
    pause:async meta=>stand.pause(meta),
    resume:async meta=>{
      const resumed=await stand.resume(meta);
      if(resumed&&resumed.ok===false)return resumed;
      return stand.start(meta);
    },
    stop:async meta=>stand.stop(meta),
    health:async()=>{
      const standHealth=await stand.health();
      const shopHealth=shop&&typeof shop.health==='function'?await shop.health():null;
      return{ok:standHealth&&standHealth.ok!==false&&(!shopHealth||shopHealth.ok!==false),stand:standHealth,shop:shopHealth};
    },
    snapshot:async()=>stand.snapshot(),
    restore:async value=>stand.restore(value),
    recover:async saved=>{
      if(!saved||saved.paused===true||saved.phase==='PAUSED')return{ok:true,deferred:true,reason:'STAND_WAS_PAUSED'};
      if(saved.phase==='OPEN')return stand.start({reason:'RECOVERY_REOPEN'});
      if(saved.phase==='CLOSED')return stand.stop({reason:'RECOVERY_KEEP_CLOSED'});
      return{ok:true,deferred:true,reason:'STAND_RECOVERY_NO_PHYSICAL_CHANGE'};
    },
    run:async()=>{
      if(!shop||typeof shop.execute!=='function')return{ok:true,progress:false,kind:'STAND_IDLE',reason:'SHOP_NOT_ATTACHED'};
      const ts=Number(now());
      if(lastShopRunAt!=null&&ts-lastShopRunAt<Math.max(0,Number(minIntervalMs)||0)){
        return{ok:true,progress:false,kind:'SHOP_STAND_THROTTLED',reason:'SHOP_STAND_THROTTLED'};
      }
      lastShopRunAt=ts;
      const out=await shop.execute({refresh:true});
      const r=out&&out.results||{};
      const actions=[...(r.cancelled||[]),...(r.external||[]),...(r.offers||[]),...(r.sales||[])];
      const successful=actions.filter(x=>x&&x.ok===true);
      const bankPull=Array.isArray(r.bankPull)?r.bankPull:[];
      const cleanIdleScan=!!(out&&out.ok!==false)&&actions.length===0&&bankPull.length===0;
      const progress=successful.length>0||cleanIdleScan;
      const reason=successful.length>0?'SHOP_STAND_PROGRESS':cleanIdleScan?'SHOP_STAND_SCAN_PROOF':'SHOP_STAND_IDLE';
      return{ok:out&&out.ok!==false,progress,kind:cleanIdleScan?'SHOP_STAND_SCAN_PROOF':'SHOP_STAND_TICK',complete:false,reason,result:out};
    }
  };
}

function createDefaultStateHandlers(services={}){
  const handlers={};
  if(services.Farm)handlers.FARM=services.Farm;
  if(services.WorldBoss&&typeof services.WorldBoss.tick==='function')handlers.WORLD_BOSS=services.WorldBoss;
  if(services.Stand)handlers.STAND=createStandHandler(services.Stand,services.Shop);
  if(services.Bank)handlers.BANK=createBankHandler(services.Bank);
  if(services.MerchantCollection)handlers.COLLECT=services.MerchantCollection;
  if(services.GearProduction&&typeof services.GearProduction.executionReady==='function'&&services.GearProduction.executionReady()===true)handlers.GEAR_PRODUCTION=services.GearProduction;
  return handlers;
}

module.exports={createBankHandler,createStandHandler,createDefaultStateHandlers};

},{}],
"characters/mage/MageController.js":[function(require,module,exports){
'use strict';

const {planMageManaAction,planSpawnClaimZap,planMagiport}=require('./Spells');

function createMageController({party,character='Harutora'}={}){
  if(!party||typeof party.ready!=='function')throw new Error('MAGE_PARTY_SERVICE_REQUIRED');
  const name=String(character||'Harutora');

  // Route-owner-only regroup. Summon living, online members who are OUTSIDE
  // the designated farm area only when the Mage is in an independently verified
  // safe staging spot. Do not use party presence alone as movement permission.
  function planRegroupSummon(ctx={}){
    if(ctx.routeAuthorized!==true||ctx.safeSpotVerified!==true||
       ctx.safeSpotClear!==true||ctx.magiportConsentExpected!==true||
       typeof party.get!=='function')return null;
    const safe=ctx.safeWaitPosition,area=ctx.farmArea;
    const mage=party.get(name);
    const validPoint=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&
      typeof p.map==='string'&&p.map.length>0;
    const nearby=(a,b,r)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y))<=r;
    if(!validPoint(safe)||!validPoint(area)||!validPoint(mage)||mage.online!==true||
       mage.dead===true||mage.rip===true||mage.map!==safe.map||
       safe.map!==area.map||!nearby(mage,safe,35))return null;
    const radius=Number(area.radius);
    if(!Number.isFinite(radius)||radius<35||radius>350)return null;
    for(const target of ['Hibari','Souji']){
      const member=party.get(target);
      if(!validPoint(member)||member.online!==true||member.dead===true||member.rip===true)
        continue; // Can't summon an offline or location-unknown fighter.
      if(member.map===area.map&&nearby(member,area,radius))continue;
      const spell=planMagiport({
        target,mp:Number(ctx.mp||0),cooldownReady:ctx.magiportCooldownReady===true,
        authorizedByRoute:true,consentExpected:true
      });
      if(!spell.eligible)return{ok:true,action:null,reason:'SUMMON_NOT_READY',target,planner:spell};
      return{ok:true,action:spell.payload,reason:'SUMMON_TO_VERIFIED_SAFE_FARM_SPOT',
        target,actionOwner:'ROUTE',planner:spell,combatPermission:false};
    }
    return null;
  }

  function plan(ctx={}){
    const ready=party.ready(['Hibari','Souji'],{anchor:name,maxDistance:190,sameMap:true,sameInstance:true});
    // Regroup takes precedence even when both allies happen to be close to
    // Harutora but standing OUTSIDE the designated farming area.
    const summon=planRegroupSummon(ctx);
    if(summon)return{...summon,details:ready};
    if(!ready.ok){
      return{ok:true,action:null,reason:'PARTY_NOT_READY',movement:'SAFE_WAIT',
        combatPermission:false,details:ready};
    }
    if(String(ctx.mainState||'')==='FARM_MOB'&&ctx.farmArea){
      const area=ctx.farmArea,radius=Number(area.radius);
      const inFarm=member=>{
        if(!member||member.online!==true||member.dead===true||member.rip===true||
           !area.map||member.map!==area.map||!Number.isFinite(radius)||radius<35||radius>350)return false;
        const p=[member.x,member.y,area.x,area.y].map(Number);
        return p.every(Number.isFinite)&&Math.hypot(p[0]-p[2],p[1]-p[3])<=radius;
      };
      if(typeof party.get!=='function'||!inFarm(party.get('Hibari'))||!inFarm(party.get('Souji'))){
        return{ok:true,action:null,reason:'MAGE_WAIT_TEAM_IN_DESIGNATED_FARM',
          movement:'SAFE_WAIT',combatPermission:false,details:ready};
      }
    }

    if(ctx.spawnClaim===true){
      const action=planSpawnClaimZap({...ctx,mageCombatReady:true});
      return{ok:true,action:action.eligible?action:null,planner:action,reason:action.eligible?'SPAWN_CLAIM':'SPAWN_CLAIM_BLOCKED'};
    }

    const action=planMageManaAction({...ctx,mageCombatReady:true});
    return{ok:true,action:action.eligible?action.selected:null,planner:action,reason:action.phase};
  }

  async function health(){
    const ready=party.ready(['Hibari','Souji'],{anchor:name,maxDistance:190});
    return{ok:true,combat_ready:ready.ok,details:ready};
  }

  return{plan,health,planRegroupSummon};
}

module.exports={createMageController};

},{"./Spells":"characters/mage/Spells.js"}],
"characters/mage/Spells.js":[function(require,module,exports){
'use strict';

const {SKILLS}=require('../../core/contracts/AdventureLandContract');

const MAGE_SPELLS=Object.freeze({
  BLINK:Object.freeze({skill:'blink',category:'UTILITY_HIGH',owner:'MAGE_SPELL_STATE',requiresActionOwner:'ROUTE',...SKILLS.blink,successProof:'SERVER_RESPONSE_AND_POSITION'}),
  MAGIPORT:Object.freeze({skill:'magiport',category:'UTILITY_HIGH',owner:'MAGE_SPELL_STATE',requiresActionOwner:'ROUTE',...SKILLS.magiport,successProof:'SERVER_RESPONSE_AND_TARGET_ARRIVAL'}),
  BURST:Object.freeze({skill:'burst',category:'ATTACK_FINISHER',owner:'MAGE_SPELL_STATE',...SKILLS.burst,successProof:'SERVER_RESPONSE'}),
  CBURST:Object.freeze({skill:'cburst',category:'ATTACK',owner:'MAGE_SPELL_STATE',...SKILLS.cburst,successProof:'SERVER_RESPONSE'}),
  ENERGIZE:Object.freeze({skill:'energize',category:'SUSTAIN',owner:'MAGE_SPELL_STATE',...SKILLS.energize,successProof:'SERVER_RESPONSE'}),
  REFLECTION:Object.freeze({skill:'reflection',category:'UTILITY_HIGH',owner:'MAGE_SPELL_STATE',...SKILLS.reflection,successProof:'SERVER_RESPONSE'}),
  ZAPPER:Object.freeze({skill:'zapperzap',category:'ATTACK',owner:'MAGE_SPELL_STATE',equipmentRequirement:'ZAPPER_RING',...SKILLS.zapperzap,successProof:'SERVER_RESPONSE'})
});
function blocked(spell,reason,extra={}){return{eligible:false,reason,owner:spell.owner,skill:spell.skill,...extra};}
function request(spell,payload,extra={}){return{eligible:true,reason:'READY',owner:spell.owner,category:spell.category,skill:spell.skill,successProof:spell.successProof,payload,...extra};}
function baseChecks(spell,{cooldownReady=false,mp=0,level=Infinity}={}){
  if(Number(level)<Number(spell.level||0))return blocked(spell,'LEVEL',{minimumLevel:spell.level});
  if(!cooldownReady)return blocked(spell,'COOLDOWN');
  if(Number.isFinite(Number(spell.mp))&&Number(mp)<Number(spell.mp))return blocked(spell,'MP',{requiredMp:spell.mp});
  return null;
}
function planBlink({x,y,mp=0,cooldownReady=false,level=Infinity,authorizedByRoute=false}={}){
  const s=MAGE_SPELLS.BLINK; const base=baseChecks(s,{cooldownReady,mp,level});if(base)return base;
  if(authorizedByRoute!==true)return blocked(s,'ROUTE_OWNER_REQUIRED');
  if(!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return blocked(s,'COORDINATES_INVALID');
  return request(s,{kind:'USE_SKILL',name:'blink',target:[Number(x),Number(y)]},{actionOwner:'ROUTE'});
}
function planMagiport({target,mp=0,cooldownReady=true,level=Infinity,authorizedByRoute=false,consentExpected=true}={}){
  const s=MAGE_SPELLS.MAGIPORT; const base=baseChecks(s,{cooldownReady,mp,level});if(base)return base;
  if(authorizedByRoute!==true)return blocked(s,'ROUTE_OWNER_REQUIRED');
  target=String(target||''); if(!target)return blocked(s,'TARGET_REQUIRED');
  if(s.requiresPveConsent&&consentExpected!==true)return blocked(s,'TARGET_CONSENT_REQUIRED');
  return request(s,{kind:'USE_SKILL',name:'magiport',target},{actionOwner:'ROUTE',requiresConsent:s.requiresPveConsent});
}
function planReflection({
  target,
  mp=0,
  cooldownReady=false,
  level=Infinity,
  inRange=false,
  threatDamageType='',
  threatHasMagicalAbility=false,
  defensivePvp=false
}={}){
  const s=MAGE_SPELLS.REFLECTION; const base=baseChecks(s,{cooldownReady,mp,level});if(base)return base;
  target=String(target||''); if(!target)return blocked(s,'TARGET_REQUIRED');

  const damageType=String(threatDamageType||'').toLowerCase();
  const magicalThreat=
    damageType==='magical' ||
    threatHasMagicalAbility===true;

  // Official server combat reflects only attacks whose defense path is
  // resistance (magical). Physical-only and pure PvE threats waste the cast.
  // Defensive PVP retains its independent emergency exception.
  if(defensivePvp!==true&&!magicalThreat){
    if(damageType==='physical')return blocked(s,'PHYSICAL_ONLY_THREAT');
    if(damageType==='pure')return blocked(s,'PURE_DAMAGE_THREAT');
    return blocked(s,'MAGICAL_THREAT_REQUIRED');
  }

  if(inRange!==true)return blocked(s,'RANGE');
  return request(s,{kind:'USE_SKILL',name:'reflection',target},{
    reflectionPolicy:'MAGICAL_OR_MIXED_MAGICAL_PVE',
    defensivePvp:defensivePvp===true,
    threatDamageType:damageType||null,
    threatHasMagicalAbility:threatHasMagicalAbility===true
  });
}
function planEnergize({target,amount,mp=0,cooldownReady=false,level=Infinity,inRange=false}={}){
  const s=MAGE_SPELLS.ENERGIZE; const base=baseChecks(s,{cooldownReady,mp,level});if(base)return base;
  target=String(target||''); amount=Number(amount);
  if(!target)return blocked(s,'TARGET_REQUIRED');
  if(inRange!==true)return blocked(s,'RANGE');
  if(!Number.isFinite(amount)||amount<=0)return blocked(s,'ENERGIZE_AMOUNT_INVALID');
  if(Number(mp)<amount)return blocked(s,'MP',{requiredMp:amount});
  return request(s,{kind:'USE_SKILL',name:'energize',target,extraArg:amount});
}
function planCBurst({targets=[],mp=0,cooldownReady=false,level=Infinity,mageCombatReady=false}={}){
  const s=MAGE_SPELLS.CBURST;
  if(mageCombatReady!==true)return blocked(s,'MAGE_PARTY_NOT_READY');
  const base=baseChecks(s,{cooldownReady,mp,level});if(base)return base;
  if(!Array.isArray(targets)||!targets.length)return blocked(s,'NO_TARGETS');
  const allocations=[]; let total=0;
  for(const row of targets){
    const id=String(row&&row.id||''); const amount=Number(row&&row.mp);
    if(!id||!Number.isFinite(amount)||amount<=0)return blocked(s,'TARGET_ALLOCATION_INVALID');
    if(row.inRange!==true)return blocked(s,'TARGET_OUT_OF_RANGE',{target:id});
    total+=amount; allocations.push([id,amount]);
  }
  const totalCost=total+Number(s.mp||0);
  if(totalCost>Number(mp))return blocked(s,'MP_ALLOCATION_EXCEEDS_AVAILABLE',{allocatedMp:total,totalMpCost:totalCost});
  return request(s,{kind:'USE_SKILL',name:'cburst',target:allocations},{allocatedMp:total,totalMpCost:totalCost,explicitTargets:true,rangeProofRequired:true});
}

const MAGE_MANA_POLICY=Object.freeze({
  autoSecuredManaBurst:true,
  manaBurstPriority:'BEFORE_CBURST',
  farmReserveMp:2400,
  bossAssemblyReserveMp:4000,
  bossCombatReserveMp:2400,
  farmStartRatio:0.78,
  farmMinSelectedMp:500,
  farmMaxSelectedMp:800,
  bossStartRatio:0.72,
  bossUncursedStartRatio:0.90,
  bossMinSelectedMp:700,
  bossMaxSelectedMp:900,
  bossCursedMinSelectedMp:800,
  bossCursedMaxSelectedMp:1200,
  minKillSelectedMp:100,
  lowRoll:0.90,
  cburstKillCushion:1.03,
  manaBurstSafety:0.95
});

function planDynamicCBurst({
  target,
  targetHp=0,
  mp=0,
  maxMp=0,
  cooldownReady=false,
  level=Infinity,
  inRange=false,
  isBoss=false,
  targetCursed=false,
  warriorHasAggro=false,
  partyAssembled=true,
  magicalDamageMultiplier=1,
  incomingDamageAmp=1,
  mageCombatReady=false,
  warriorCanTauntTarget=false
}={}){
  const s=MAGE_SPELLS.CBURST;
  if(mageCombatReady!==true)return blocked(s,'MAGE_PARTY_NOT_READY');
  const base=baseChecks(s,{cooldownReady,mp,level});
  if(base)return base;

  target=String(target||'');
  if(!target)return blocked(s,'TARGET_REQUIRED');
  if(inRange!==true)return blocked(s,'RANGE');

  if(isBoss!==true&&warriorCanTauntTarget!==true){
    return blocked(s,'TARGET_OUTSIDE_WARRIOR_TAUNT_SAFE_RANGE');
  }

  if(isBoss===true){
    if(partyAssembled!==true)return blocked(s,'BOSS_ASSEMBLY_REQUIRED',{reserveMp:MAGE_MANA_POLICY.bossAssemblyReserveMp});
  }

  const reserve=isBoss===true
    ? MAGE_MANA_POLICY.bossCombatReserveMp
    : MAGE_MANA_POLICY.farmReserveMp;
  const baseCost=Number(s.mp||0);
  const surplus=Math.floor(Number(mp)-reserve-baseCost);
  if(surplus<MAGE_MANA_POLICY.minKillSelectedMp){
    return blocked(s,'MANA_RESERVE',{reserveMp:reserve,availableSelectedMp:Math.max(0,surplus)});
  }

  const profile=isBoss===true
    ? (targetCursed===true
      ? {
          startRatio:MAGE_MANA_POLICY.bossStartRatio,
          minSelected:MAGE_MANA_POLICY.bossCursedMinSelectedMp,
          maxSelected:MAGE_MANA_POLICY.bossCursedMaxSelectedMp
        }
      : {
          startRatio:MAGE_MANA_POLICY.bossUncursedStartRatio,
          minSelected:MAGE_MANA_POLICY.bossMinSelectedMp,
          maxSelected:MAGE_MANA_POLICY.bossMaxSelectedMp
        })
    : {
        startRatio:MAGE_MANA_POLICY.farmStartRatio,
        minSelected:MAGE_MANA_POLICY.farmMinSelectedMp,
        maxSelected:MAGE_MANA_POLICY.farmMaxSelectedMp
      };

  const ratio=Math.max(0.0001,Number(s.ratio||0.5));
  const defenseMult=Math.max(0.05,Number(magicalDamageMultiplier)||1);
  const amp=Math.max(0.01,Number(incomingDamageAmp)||1);
  const perMp=ratio*MAGE_MANA_POLICY.lowRoll*defenseMult*amp;
  const hp=Math.max(0,Number(targetHp)||0);
  const killMp=hp>0
    ? Math.ceil((hp/perMp)*MAGE_MANA_POLICY.cburstKillCushion)
    : 0;
  const exactKill=
    killMp>=MAGE_MANA_POLICY.minKillSelectedMp &&
    killMp<=profile.maxSelected &&
    killMp<=surplus;

  let selectedMp=0;
  let allocationMode='HEALTHY_CHUNK';

  if(exactKill){
    selectedMp=killMp;
    allocationMode='EXACT_LOW_ROLL_KILL';
  }else{
    const ratioNow=Number(maxMp)>0?Number(mp)/Number(maxMp):0;
    if(ratioNow<profile.startRatio){
      return blocked(s,'WAIT_FOR_SURPLUS',{startRatio:profile.startRatio,currentRatio:ratioNow,reserveMp:reserve});
    }
    if(surplus<profile.minSelected){
      return blocked(s,'MANA_RESERVE',{reserveMp:reserve,requiredSelectedMp:profile.minSelected,availableSelectedMp:surplus});
    }
    selectedMp=Math.min(profile.maxSelected,surplus);
  }

  const planned=planCBurst({
    targets:[{id:target,mp:selectedMp,inRange:true}],
    mp:Number(mp),
    cooldownReady:true,
    level,
    mageCombatReady:true
  });
  if(!planned.eligible)return planned;

  return{
    ...planned,
    profile:'DYNAMIC_V7',
    allocationMode,
    selectedMp,
    reserveMp:reserve,
    isBoss:isBoss===true,
    targetCursed:targetCursed===true,
    warriorAggroRequired:false,
    lowRoll:MAGE_MANA_POLICY.lowRoll
  };
}

function planManaBurst({
  target,
  targetHp=0,
  mp=0,
  cooldownReady=false,
  inRange=false,
  isBoss=false,
  warriorHasAggro=false,
  otherThreatsOnMage=false,
  incomingDamageAmp=1,
  mageCombatReady=false
}={}){
  const s=MAGE_SPELLS.BURST;
  if(mageCombatReady!==true)return blocked(s,'MAGE_PARTY_NOT_READY');
  const base=baseChecks(s,{cooldownReady,mp,level:Infinity});
  if(base)return base;

  target=String(target||'');
  if(!target)return blocked(s,'TARGET_REQUIRED');
  if(isBoss!==true)return blocked(s,'BOSS_FINISHER_ONLY');
  if(otherThreatsOnMage===true)return blocked(s,'MAGE_UNDER_EXTRA_THREAT');
  if(inRange!==true)return blocked(s,'RANGE');
  if(Number(mp)<MAGE_MANA_POLICY.bossCombatReserveMp){
    return blocked(s,'MANA_RESERVE',{reserveMp:MAGE_MANA_POLICY.bossCombatReserveMp});
  }

  const amp=Math.max(0.01,Number(incomingDamageAmp)||1);
  const lowRollDamage=
    Number(mp)*
    Number(s.ratio||0.555)*
    MAGE_MANA_POLICY.lowRoll*
    amp;
  const securedHp=lowRollDamage*MAGE_MANA_POLICY.manaBurstSafety;

  if(Number(targetHp)>securedHp){
    return blocked(s,'NOT_SECURED_FINISHER',{securedHp,lowRollDamage});
  }

  return request(s,{kind:'USE_SKILL',name:'burst',target},{
    profile:'DYNAMIC_V7',
    policy:'WORLD_BOSS_PARTY_READY_FINISHER',
    consumesEntireCurrentMp:true,
    lowRollDamage,
    securedHp,
    safety:MAGE_MANA_POLICY.manaBurstSafety
  });
}


function planMageManaAction(input={}){
  if(input.mageCombatReady!==true){
    return{eligible:false,phase:'MAGE_PARTY_BLOCKED',priority:MAGE_MANA_POLICY.manaBurstPriority,reason:'MAGE_PARTY_NOT_READY'};
  }
  // Secured Mana Burst gets first look on bosses. This mirrors the intended
  // combat order without sharing V2 runtime code.
  if(MAGE_MANA_POLICY.autoSecuredManaBurst===true){
    const burst=planManaBurst({
      target:input.target,
      targetHp:Number(input.targetHp||0),
      mp:Number(input.mp||0),
      cooldownReady:input.burstCooldownReady===true,
      inRange:input.burstInRange===true,
      isBoss:input.isBoss===true,
      warriorHasAggro:input.warriorHasAggro===true,
      otherThreatsOnMage:input.otherThreatsOnMage===true,
      incomingDamageAmp:Number(input.incomingDamageAmp||1),
      mageCombatReady:true
    });

    if(burst.eligible){
      return{
        eligible:true,
        phase:'SECURED_MANA_BURST_FINISHER',
        priority:MAGE_MANA_POLICY.manaBurstPriority,
        selected:burst
      };
    }
  }

  const cburst=planDynamicCBurst({
    target:input.target,
    targetHp:Number(input.targetHp||0),
    mp:Number(input.mp||0),
    maxMp:Number(input.maxMp||0),
    cooldownReady:input.cburstCooldownReady===true,
    level:Number.isFinite(Number(input.level))?Number(input.level):Infinity,
    inRange:input.cburstInRange===true,
    isBoss:input.isBoss===true,
    targetCursed:input.targetCursed===true,
    warriorHasAggro:input.warriorHasAggro===true,
    partyAssembled:input.partyAssembled!==false,
    magicalDamageMultiplier:Number(input.magicalDamageMultiplier||1),
    incomingDamageAmp:Number(input.incomingDamageAmp||1),
    mageCombatReady:true,
    warriorCanTauntTarget:input.warriorCanTauntTarget===true
  });

  if(cburst.eligible){
    return{
      eligible:true,
      phase:'DYNAMIC_CBURST',
      priority:MAGE_MANA_POLICY.manaBurstPriority,
      selected:cburst
    };
  }

  return{
    eligible:false,
    phase:'NO_MANA_ATTACK',
    priority:MAGE_MANA_POLICY.manaBurstPriority,
    burstReason:MAGE_MANA_POLICY.autoSecuredManaBurst===true
      ? planManaBurst({
          target:input.target,
          targetHp:Number(input.targetHp||0),
          mp:Number(input.mp||0),
          cooldownReady:input.burstCooldownReady===true,
          inRange:input.burstInRange===true,
          isBoss:input.isBoss===true,
          warriorHasAggro:input.warriorHasAggro===true,
          otherThreatsOnMage:input.otherThreatsOnMage===true,
          incomingDamageAmp:Number(input.incomingDamageAmp||1),
          mageCombatReady:true
        }).reason
      : 'AUTO_BURST_DISABLED',
    cburstReason:cburst.reason
  };
}

function planSpawnClaimZap({
  target,
  mp=0,
  cooldownReady=false,
  inRange=false,
  zapperEquipped=false,
  targetIsMonster=true,
  cooperative=false,
  targetUnowned=false,
  claimAuthorized=false,
  observedOnEntitiesPacket=false,
  mageCombatReady=false,
  warriorCanTauntTarget=false,
  antiKsArmed=false,
  bossPriorityActive=false,
  targetIsBoss=false
}={}){
  const spell=MAGE_SPELLS.ZAPPER;
  if(targetIsBoss===true)return blocked(spell,'WORLD_BOSS_ZAP_DISABLED');
  if(bossPriorityActive===true)return blocked(spell,'BOSS_200_PRIORITY_ACTIVE');
  if(mageCombatReady!==true)return blocked(spell,'MAGE_PARTY_NOT_READY');
  if(antiKsArmed!==true)return blocked(spell,'ANTI_KS_NOT_ARMED');
  const base=baseChecks(spell,{cooldownReady,mp,level:Infinity});
  if(base)return base;

  target=String(target||'');
  if(!target)return blocked(spell,'TARGET_REQUIRED');
  if(targetIsMonster!==true)return blocked(spell,'MONSTER_TARGET_REQUIRED');
  if(cooperative===true)return blocked(spell,'COOPERATIVE_TARGET_SHARED_REWARDS');
  if(claimAuthorized!==true)return blocked(spell,'TARGET_CLAIM_AUTH_REQUIRED');
  if(observedOnEntitiesPacket!==true)return blocked(spell,'ENTITIES_PACKET_PROOF_REQUIRED');
  if(targetUnowned!==true)return blocked(spell,'UNOWNED_TARGET_REQUIRED');
  if(warriorCanTauntTarget!==true)return blocked(spell,'TARGET_OUTSIDE_WARRIOR_TAUNT_SAFE_RANGE');
  if(zapperEquipped!==true)return blocked(spell,'ZAPPER_PREARM_REQUIRED',{
    equipmentRequirement:spell.equipmentRequirement
  });
  if(inRange!==true)return blocked(spell,'RANGE');

  return request(spell,{kind:'USE_SKILL',name:'zapperzap',target},{
    authorizationOwner:'TARGET_CLAIM',
    purpose:'SPAWN_CLAIM',
    firstHitClaim:true,
    observedOnEntitiesPacket:true,
    targetUnownedRequired:true,
    warriorCanTauntTarget:true,
    noRingSwap:true,
    percentageManaReserve:false,
    requiredMp:Number(spell.mp||0),
    equipmentRequirement:spell.equipmentRequirement
  });
}

function planZapperZap({
  target,
  mp=0,
  maxMp=0,
  mpReserveRatio=0.50,
  cooldownReady=false,
  inRange=false,
  zapperEquipped=false,
  canSwapZapper=false,
  targetIsMonster=true,
  foreignPartyAiming=false,
  warriorHasAggro=false,
  alreadyZapped=false,
  cooperative=false,
  mageCombatReady=false,
  antiKsArmed=false,
  bossPriorityActive=false,
  targetIsBoss=false
}={}){
  const s=MAGE_SPELLS.ZAPPER;
  if(targetIsBoss===true)return blocked(s,'WORLD_BOSS_ZAP_DISABLED');
  if(bossPriorityActive===true)return blocked(s,'BOSS_200_PRIORITY_ACTIVE');
  if(mageCombatReady!==true)return blocked(s,'MAGE_PARTY_NOT_READY');
  if(antiKsArmed!==true)return blocked(s,'ANTI_KS_NOT_ARMED');
  const base=baseChecks(s,{cooldownReady,mp,level:Infinity});
  if(base)return base;

  target=String(target||'');
  if(!target)return blocked(s,'TARGET_REQUIRED');
  if(targetIsMonster!==true)return blocked(s,'MONSTER_TARGET_REQUIRED');
  if(cooperative===true)return blocked(s,'COOPERATIVE_TARGET_SHARED_REWARDS');
  if(warriorHasAggro!==true)return blocked(s,'WARRIOR_AGGRO_REQUIRED');
  if(foreignPartyAiming!==true)return blocked(s,'NO_FOREIGN_CONTEST');
  if(alreadyZapped===true)return blocked(s,'ALREADY_ZAPPED_THIS_MONSTER');

  const reserveRatio=Math.min(1,Math.max(0,Number(mpReserveRatio)||0));
  const reserve=Math.max(Number(s.mp||0),Math.floor(Math.max(0,Number(maxMp||0))*reserveRatio));
  if(Number(mp)-Number(s.mp||0)<reserve){
    return blocked(s,'MANA_RESERVE',{reserveMp:reserve,reserveRatio});
  }

  if(zapperEquipped!==true&&canSwapZapper!==true)return blocked(s,'ZAPPER_RING_UNAVAILABLE',{equipmentRequirement:s.equipmentRequirement});
  if(inRange!==true)return blocked(s,'RANGE');

  return request(s,{kind:'USE_SKILL',name:'zapperzap',target},{
    equipmentRequirement:s.equipmentRequirement,
    contestedTargetOnly:true,
    foreignExactTargetRequired:true,
    warriorAggroRequired:true,
    oneZapPerMonster:true,
    reserveMp:reserve,
    reserveRatio,
    temporaryRingSwap:zapperEquipped!==true,
    restoreDisplacedRing:zapperEquipped!==true
  });
}
module.exports={MAGE_SPELLS,MAGE_MANA_POLICY,planBlink,planMagiport,planReflection,planEnergize,planCBurst,planDynamicCBurst,planManaBurst,planMageManaAction,planSpawnClaimZap,planZapperZap};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js"}],
"characters/merchant/MerchantController.js":[function(require,module,exports){
'use strict';

const {priority}=require('../../states/StateRegistry');

function createMerchantController({inventory,gearHandoff=null,shop=null,collection=null,character='Rentaro'}={}){
  if(!inventory||typeof inventory.freeSlots!=='function')throw new Error('MERCHANT_INVENTORY_REQUIRED');
  const name=String(character||'Rentaro');

  async function choose(ctx={}){
    const candidates=[];
    if(ctx.emergency===true)candidates.push({state:'EMERGENCY',reason:'EMERGENCY'});
    if(ctx.pvpDefense===true)candidates.push({state:'PVP_DEFENSE',reason:'PVP_DEFENSE'});
    const halloween=String(ctx.halloweenEventBoss||ctx.eventBossMtype||'').toLowerCase();
    const seasonal=['mrpumpkin','mrgreen'].includes(halloween);
    const halloweenStand=false;
    if(halloweenStand){
      // In V3 WORLD_BOSS owns the route until the event ends. The mission
      // executes a safe stand hold rather than a combat/merchant boss chase.
      candidates.push({state:'WORLD_BOSS',reason:'HALLOWEEN_EVENT_STAND_HOLD',boss:halloween,
        destination:{map:'main',x:-300,y:-100},openStand:true,
        releaseWhen:'EVENT_DEFEATED',endGraceMs:3000});
    }
    if(ctx.worldBoss===true&&!seasonal&&!collection?.active?.())candidates.push({state:'WORLD_BOSS',reason:'WORLD_BOSS'});
    if(ctx.event===true&&!seasonal&&!collection?.active?.())candidates.push({state:'EVENT',reason:'EVENT'});

    if(collection?.active?.()&&!ctx.emergency&&!ctx.pvpDefense)return{ok:true,character:name,selected:{state:'COLLECT',reason:'MERCHANT_FULL_CIRCUIT_ACTIVE'},candidates};
    if(gearHandoff&&typeof gearHandoff.routingHint==='function'){
      const hint=gearHandoff.routingHint();
      if(hint&&hint.state==='BANK')candidates.push({state:'BANK',reason:hint.reason,workId:hint.workId||null});
      if(hint&&hint.state==='GEAR_PRODUCTION')candidates.push({state:'GEAR_PRODUCTION',reason:hint.reason,workId:hint.workId||null});
    }

    if(shop&&typeof shop.routingHint==='function'){
      if(typeof shop.plan==='function'){
        try{await shop.plan();}catch(error){}
      }
      const hint=shop.routingHint();
      if(hint&&hint.state==='BANK')candidates.push({state:'BANK',reason:hint.reason,shopPullCount:Number(hint.count||0)});
    }

    const free=await inventory.freeSlots();
    const bankThreshold=Number(ctx.bankFreeSlotThreshold??4);
    if(ctx.bankRequired===true||free<=bankThreshold)candidates.push({state:'BANK',reason:ctx.bankRequired===true?'BANK_REQUIRED':'INVENTORY_LOW',free_slots:free});
    if(collection&&typeof collection.due==='function'&&collection.due())candidates.push({state:'COLLECT',reason:'MERCHANT_ROUTINE_CIRCUIT_OR_COLLECTION'});
    if(ctx.gearProductionReady===true)candidates.push({state:'GEAR_PRODUCTION',reason:'GEAR_WORK_AVAILABLE'});
    if(ctx.standAllowed!==false)candidates.push({state:'STAND',reason:'IDLE_STAND'});
    candidates.push({state:'IDLE',reason:'FALLBACK'});

    candidates.sort((a,b)=>priority(b.state)-priority(a.state));
    return{ok:true,character:name,selected:candidates[0],candidates};
  }

  async function health(){return{ok:true,free_slots:await inventory.freeSlots()};}
  return{choose,health};
}

module.exports={createMerchantController};

},{"../../states/StateRegistry":"states/StateRegistry.js"}],
"characters/priest/PriestController.js":[function(require,module,exports){
'use strict';

function createPriestController({party,cooldowns,character='Souji'}={}){
  if(!party||!cooldowns)throw new Error('PRIEST_SERVICES_REQUIRED');
  const name=String(character||'Souji');

  const groupRecovery=new Set();
  function plan(ctx={}){
    const members=party.status();
    // Preserve reported party HP for remote group-heal planning, but never
    // count invisible party members as physically present for combat.
    const live=members.filter(m=>(m.online===true||m.reportedInParty===true)&&
      m.dead!==true&&m.rip!==true&&Number(m.max_hp)>0);
    if(!live.length)return{ok:true,action:null,reason:'NO_LIVE_PARTY'};

    live.sort((a,b)=>(Number(a.hp)/Number(a.max_hp))-(Number(b.hp)/Number(b.max_hp)));
    const lowest=live[0];
    const partyLow=live.filter(m=>Number(m.hp)/Number(m.max_hp)<0.72);
    const self=party.get(name)||live.find(m=>m.name===name)||null;
    const healRange=Math.min(190,Math.max(1,Number(ctx.healRange||190)));
    const canTarget=m=>{
      if(!self||m.name===name)return true;
      if(m.visible===false||(m.visibilityRequired===true&&m.visible!==true))
        return false;
      if(!self.map||!m.map)return true; // Unknown locality is not proof of separation.
      if(self.map!==m.map)return false;
      if(self.instance!==undefined&&m.instance!==undefined&&
         String(self.instance)!==String(m.instance))return false;
      const p=[self.x,self.y,m.x,m.y].map(Number);
      if(!p.every(Number.isFinite))return true; // Let game range checks decide. 
      return Math.hypot(p[0]-p[2],p[1]-p[3])<=healRange;
    };
    // ORDER66: A single injured party member at least 50 px from Souji
    // deserves a group-heal attempt even when Hibari or Souji is full HP.
    // The 50 px split rule is independent of ordinary heal targeting range.
    const splitDistance=Math.max(0,Number(ctx.groupHealSplitDistance??50));
    const splitFromPriest=m=>{
      if(!self||m.name===name)return false;
      if(m.visible===false||(m.visibilityRequired===true&&m.visible!==true))return true;
      if(self.map&&m.map&&self.map!==m.map)return true;
      if(self.instance!==undefined&&m.instance!==undefined&&
         String(self.instance)!==String(m.instance))return true;
      const values=[self.x,self.y,m.x,m.y];
      if(values.some(v=>v===null||v===undefined||!Number.isFinite(Number(v))))
        return !canTarget(m);
      return Math.hypot(Number(values[0])-Number(values[2]),
        Number(values[1])-Number(values[3]))>=splitDistance;
    };
    // Latch each qualifying member until full, even after crossing the threshold.
    for(const m of live){
      const hp=Number(m.hp)/Number(m.max_hp);
      if(hp>=1){groupRecovery.delete(m.name);continue;}
      if(m.name==='Rentaro'&&hp<.80)groupRecovery.add(m.name);
      if(['Hibari','Harutora'].includes(m.name)&&splitFromPriest(m)&&hp<.70)groupRecovery.add(m.name);
    }
    for(const who of groupRecovery)if(!live.some(m=>m.name===who))groupRecovery.delete(who);
    const pending=live.filter(m=>groupRecovery.has(m.name));
    const reachable=live.filter(m=>canTarget(m));
    const warrior=reachable.find(m=>m.name==='Hibari'&&Number(m.hp)/Number(m.max_hp)<=.50&&!splitFromPriest(m));
    const direct=m=>({ok:true,action:{kind:'USE_SKILL',skill:'heal',target:String(m.name),owner:'PRIEST_COMBAT'},reason:'LOWEST_REACHABLE_MEMBER'});
    if(warrior&&cooldowns.status('heal').ready)return direct(warrior);
    if(pending.length&&cooldowns.status('partyheal').ready)
      return{ok:true,action:{kind:'USE_SKILL',skill:'partyheal',owner:'PRIEST_COMBAT'},reason:'LATCHED_GROUP_HEAL_UNTIL_FULL',distantMembers:pending.map(m=>m.name)};
    const next=reachable.find(m=>Number(m.hp)<Number(m.max_hp));
    if(next&&cooldowns.status('heal').ready)return direct(next);
    // A heal on cooldown is not permission to attack while a party member is hurt.
    if(pending.length||reachable.some(m=>Number(m.hp)<Number(m.max_hp)))
      return{ok:true,action:null,reason:'PARTY_INJURED_HEAL_PENDING'};
    // Healing remains active even when waiting; offense requires a living,
    // nearby Hibari and can never replace urgent healing.
    const warriorReady=live.find(m=>m.name==='Hibari');
    if(ctx.frankyMummyTarget&&warriorReady&&warriorReady.online===true&&
       warriorReady.visible!==false&&canTarget(warriorReady)&&
       cooldowns.status('attack').ready!==false){
      return{ok:true,action:{kind:'ATTACK',target:String(ctx.frankyMummyTarget),owner:'PRIEST_COMBAT'},reason:'FRANKY_MUMMY_PRIORITY'};
    }
    return{ok:true,action:null,reason:'PARTY_STABLE'};
  }

  async function health(){
    const self=party.get(name);
    if(!self)return{ok:true,ready:false,reason:'PARTY_SNAPSHOT_PENDING',self:null};
    return{
      ok:true,
      ready:self.online===true&&self.dead!==true&&self.rip!==true,
      reason:self.online!==true?'OFFLINE':(self.dead===true||self.rip===true?'DEAD':'READY'),
      self
    };
  }

  return{plan,health};
}

module.exports={createPriestController};

},{}],
"characters/warrior/FarmRotation.js":[function(require,module,exports){
'use strict';

const {SKILLS}=require('../../core/contracts/AdventureLandContract');

const WARRIOR_FARM_ROTATION=Object.freeze({
  owner:'WARRIOR_FARM_ROTATION',
  phases:Object.freeze([
    'WAIT_HEALER',
    'ATTACK_HEARTBEAT',
    'CLEAVE_PREP',
    'CLEAVE_BURST',
    'SUGAR_PREP',
    'SUGAR_WAIT_PROC',
    'SUGAR_BURN',
    'LOADOUT_RECOVER'
  ]),
  cleave:Object.freeze({
    skill:'cleave',
    mp:Number(SKILLS.cleave&&SKILLS.cleave.mp||720),
    cooldown:Number(SKILLS.cleave&&SKILLS.cleave.cooldown||1200),
    minimumBurstCasts:2,
    maximumBurstCasts:3
  }),
  reserve:Object.freeze({
    tauntMp:Number(SKILLS.taunt&&SKILLS.taunt.mp||40),
    stompMp:Number(SKILLS.stomp&&SKILLS.stomp.mp||120),
    hardShellMp:Number(SKILLS.hardshell&&SKILLS.hardshell.mp||480),
    agitateMp:Number(SKILLS.agitate&&SKILLS.agitate.mp||420),
    attackBufferSwings:2,
    attackBufferMinimumMp:100
  }),
  loadouts:Object.freeze({
    CLEAVE:Object.freeze({
      name:'CLEAVE',
      clearSlots:Object.freeze(['offhand']),
      mainhand:Object.freeze({name:'bataxe',selection:'HIGHEST_LEVEL'}),
      offhand:null
    }),
    SUGAR_PREP:Object.freeze({
      name:'SUGAR_PREP',
      mainhand:Object.freeze({name:'vhammer',selection:'HIGHEST_LEVEL'}),
      offhand:Object.freeze({name:'ololipop',minLevel:9,selection:'HIGHEST_LEVEL'})
    }),
    SUGAR_BURN:Object.freeze({
      name:'SUGAR_BURN',
      mainhand:Object.freeze({name:'vhammer',selection:'HIGHEST_LEVEL'}),
      offhand:Object.freeze({name:'vhammer',selection:'HIGHEST_LEVEL',distinct:true})
    })
  })
});

function clampInt(value,min,max){
  const n=Math.floor(Number(value)||0);
  return Math.max(min,Math.min(max,n));
}

function calculateCleaveBudget({mp=0,basicAttackMp=0}={}){
  const p=WARRIOR_FARM_ROTATION;
  const attackBuffer=Math.max(
    p.reserve.attackBufferMinimumMp,
    Math.ceil(Math.max(0,Number(basicAttackMp)||0)*p.reserve.attackBufferSwings)
  );
  const safetySkills=
    p.reserve.tauntMp+
    p.reserve.stompMp+
    Math.max(p.reserve.hardShellMp,p.reserve.agitateMp);
  const reserveMp=safetySkills+attackBuffer;
  const spendableMp=Math.max(0,Math.floor(Number(mp)||0)-reserveMp);
  const safeCasts=clampInt(
    Math.floor(spendableMp/p.cleave.mp),
    0,
    p.cleave.maximumBurstCasts
  );
  return{reserveMp,attackBuffer,safetySkills,spendableMp,safeCasts};
}

function normalAttack({target,attackReady=false,inRange=false,healerReady=false}={}){
  target=String(target||'');
  if(healerReady!==true)return null;
  if(!target||attackReady!==true||inRange!==true)return null;
  return{
    kind:'ATTACK',
    target,
    owner:WARRIOR_FARM_ROTATION.owner,
    priority:'BASIC_ATTACK_HEARTBEAT'
  };
}

function planWarriorFarmRotation(input={}){
  const target=String(input.target||'');
  const healerReady=input.healerReady===true;
  const attack=normalAttack({...input,target,healerReady});
  const budget=calculateCleaveBudget(input);
  const phase=String(input.phase||'CLEAVE_PREP');
  const castsCompleted=clampInt(input.cleavesCompleted||0,0,WARRIOR_FARM_ROTATION.cleave.maximumBurstCasts);

  if(!healerReady){
    return{
      ok:true,phase:'WAIT_HEALER',nextPhase:'WAIT_HEALER',
      normalAttack:null,special:null,loadout:null,budget,
      reason:'SOUJI_REQUIRED_FOR_FARM_COMBAT'
    };
  }

  if(input.sugarRushActive===true){
    return{
      ok:true,phase:'SUGAR_BURN',nextPhase:'SUGAR_BURN',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.SUGAR_BURN,
      budget,reason:'SUGAR_RUSH_ACTIVE',
      resetCleaveBurst:false
    };
  }

  if(phase==='SUGAR_BURN'){
    return{
      ok:true,phase:'LOADOUT_RECOVER',nextPhase:'CLEAVE_PREP',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.SUGAR_PREP,
      budget,reason:'SUGAR_RUSH_ENDED',
      resetCleaveBurst:true
    };
  }

  if(phase==='SUGAR_PREP'||phase==='SUGAR_WAIT_PROC'||input.waitingForSugarProc===true){
    return{
      ok:true,phase:'SUGAR_WAIT_PROC',nextPhase:'SUGAR_WAIT_PROC',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.SUGAR_PREP,
      budget,reason:'BASIC_ATTACKS_PROC_SUGAR_RUSH',
      resetCleaveBurst:false
    };
  }

  const requestedTarget=clampInt(
    input.burstTargetCasts||budget.safeCasts,
    0,
    WARRIOR_FARM_ROTATION.cleave.maximumBurstCasts
  );
  const burstTarget=castsCompleted>0
    ? Math.max(castsCompleted,requestedTarget)
    : (budget.safeCasts>=WARRIOR_FARM_ROTATION.cleave.minimumBurstCasts
      ? Math.min(WARRIOR_FARM_ROTATION.cleave.maximumBurstCasts,budget.safeCasts)
      : 0);

  if(
    burstTarget<WARRIOR_FARM_ROTATION.cleave.minimumBurstCasts ||
    castsCompleted>=burstTarget ||
    budget.safeCasts<=0
  ){
    return{
      ok:true,phase:'SUGAR_PREP',nextPhase:'SUGAR_WAIT_PROC',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.SUGAR_PREP,
      budget,reason:castsCompleted>=burstTarget&&castsCompleted>0?'CLEAVE_BURST_COMPLETE':'CLEAVE_BUDGET_BELOW_TWO',
      burstTargetCasts:burstTarget,
      resetCleaveBurst:false
    };
  }

  if(input.cleaveLoadoutReady!==true){
    return{
      ok:true,phase:'CLEAVE_PREP',nextPhase:'CLEAVE_BURST',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.CLEAVE,
      budget,reason:'PREPARE_BAT_AXE',
      burstTargetCasts:burstTarget,
      resetCleaveBurst:false
    };
  }

  if(input.cleaveCooldownReady!==true){
    return{
      ok:true,phase:'CLEAVE_BURST',nextPhase:'CLEAVE_BURST',
      normalAttack:attack,special:null,
      loadout:WARRIOR_FARM_ROTATION.loadouts.CLEAVE,
      budget,reason:'CLEAVE_COOLDOWN_BASIC_ATTACK_CONTINUES',
      burstTargetCasts:burstTarget,
      resetCleaveBurst:false
    };
  }

  return{
    ok:true,phase:'CLEAVE_BURST',nextPhase:'CLEAVE_BURST',
    normalAttack:attack,
    special:{
      kind:'USE_SKILL',name:'cleave',target:null,
      owner:WARRIOR_FARM_ROTATION.owner,
      mp:WARRIOR_FARM_ROTATION.cleave.mp,
      successProof:'SERVER_RESPONSE'
    },
    loadout:WARRIOR_FARM_ROTATION.loadouts.CLEAVE,
    budget,
    reason:'CLEAVE_READY',
    burstTargetCasts:burstTarget,
    cleavesCompletedAfterSuccess:castsCompleted+1,
    executionOrder:attack?['ATTACK_IF_READY','CLEAVE']:['CLEAVE'],
    resetCleaveBurst:false
  };
}

module.exports={WARRIOR_FARM_ROTATION,calculateCleaveBudget,planWarriorFarmRotation};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js"}],
"characters/warrior/Spells.js":[function(require,module,exports){
'use strict';

const {SKILLS}=require('../../core/contracts/AdventureLandContract');

const OFFICIAL_STOMP=SKILLS.stomp;
const WARRIOR_SPELLS=Object.freeze({
  STOMP:Object.freeze({
    skill:'stomp',
    category:'UTILITY_HIGH',
    targetType:'SELF_AOE',
    equipmentRequirement:'STOMP',
    mp:OFFICIAL_STOMP.mp,
    range:OFFICIAL_STOMP.range,
    minimumLevel:OFFICIAL_STOMP.level,
    cooldown:OFFICIAL_STOMP.cooldown,
    duration:OFFICIAL_STOMP.duration,
    requiredWtype:OFFICIAL_STOMP.wtype,
    hpRatioTrigger:0.50,
    attackerTrigger:5,
    successProof:'SERVER_RESPONSE'
  }),
  TAUNT:Object.freeze({
    skill:'taunt',
    category:'UTILITY_HIGH',
    targetType:'HOSTILE_TARGET',
    mp:SKILLS.taunt.mp,
    range:SKILLS.taunt.range,
    cooldown:SKILLS.taunt.cooldown,
    successProof:'SERVER_RESPONSE'
  }),
  AGITATE:Object.freeze({skill:'agitate',category:'UTILITY_HIGH',targetType:'SELF_AOE',mp:SKILLS.agitate.mp,range:SKILLS.agitate.range,cooldown:SKILLS.agitate.cooldown,successProof:'SERVER_RESPONSE'})
});

function evaluateStomp({cooldownReady=false,mp=0,level=Infinity,mobsNear=0,attackers=0,hpRatio=1}={}){
  const spell=WARRIOR_SPELLS.STOMP;
  if(Number(level)<spell.minimumLevel)return{eligible:false,reason:'LEVEL',equipmentRequirement:spell.equipmentRequirement};
  if(!cooldownReady)return{eligible:false,reason:'COOLDOWN',equipmentRequirement:spell.equipmentRequirement};
  if(Number(mp)<spell.mp)return{eligible:false,reason:'MP',equipmentRequirement:spell.equipmentRequirement,requiredMp:spell.mp};
  if(Number(mobsNear)<=0)return{eligible:false,reason:'NO_TARGETS',equipmentRequirement:spell.equipmentRequirement};
  const emergency=Number(hpRatio)<=spell.hpRatioTrigger||Number(attackers)>=spell.attackerTrigger;
  if(!emergency)return{eligible:false,reason:'TRIGGER_NOT_MET',equipmentRequirement:spell.equipmentRequirement};
  return{
    eligible:true,reason:'EMERGENCY_STOMP',equipmentRequirement:spell.equipmentRequirement,
    request:{kind:'USE_SKILL',owner:'WARRIOR_SPELL_STATE',category:spell.category,
      skill:spell.skill,targetType:spell.targetType,successProof:spell.successProof,
      loadout:{name:'V2_STOMP',clearSlots:['offhand'],
        mainhand:{name:'wbasher',level:3},offhand:null},
      restoreAfter:true}
  };
}

function planPartyTaunt({
  target,
  mp=0,
  cooldownReady=false,
  inRange=false,
  partyEngaged=false,
  warriorHasAggro=false,
  targetIsMonster=true,
  targetingPartyMember=false,
  targetingPartyMemberName='',
  targetingForeignPlayer=false,
  claimHandoffAuthorized=false,
  antiKsReclaimAuthorized=false,
  targetIsBoss=false,
  targetIsMiniBoss=false,
  isFarmMob=false,
  healerReady=false,
  farmOwnershipAuthorized=false
}={}){
  const spell=WARRIOR_SPELLS.TAUNT;
  target=String(target||''); if(!target)return{eligible:false,reason:'TARGET_REQUIRED'};
  if(targetIsMonster!==true)return{eligible:false,reason:'MONSTER_TARGET_REQUIRED'};
  if(warriorHasAggro===true)return{eligible:false,reason:'ALREADY_TANKED'};
  const foreignReclaim=antiKsReclaimAuthorized===true&&targetingForeignPlayer===true&&targetIsBoss!==true;
  if(targetingForeignPlayer===true&&!foreignReclaim)return{eligible:false,reason:'FOREIGN_TARGET_NOT_TAUNTABLE'};
  if(antiKsReclaimAuthorized===true&&!foreignReclaim)return{eligible:false,reason:'ANTI_KS_FOREIGN_TARGET_REQUIRED'};
  const farmClaim=isFarmMob===true&&farmOwnershipAuthorized===true&&healerReady===true&&targetIsBoss!==true&&targetingForeignPlayer!==true;
  const protectedBossRescue=
    targetIsBoss===true &&
    ['Harutora','Souji'].includes(String(targetingPartyMemberName||''));
  const miniBossSight=targetIsBoss===true&&targetIsMiniBoss===true&&
    healerReady===true&&targetingForeignPlayer!==true;
  if(targetingPartyMember!==true&&!foreignReclaim&&!farmClaim&&!miniBossSight)
    return{eligible:false,reason:'FRIENDLY_AGGRO_REQUIRED'};

  if(targetIsBoss===true&&!protectedBossRescue&&!miniBossSight){
    return{eligible:false,reason:'BOSS_TAUNT_PROTECTED_PARTY_ONLY'};
  }

  if(claimHandoffAuthorized===true){
    if(String(targetingPartyMemberName||'')!=='Harutora'){
      return{eligible:false,reason:'CLAIM_OWNER_MISMATCH',expectedClaimOwner:'Harutora'};
    }
  }else if(partyEngaged!==true&&!protectedBossRescue&&!foreignReclaim&&!farmClaim&&!miniBossSight){
    return{eligible:false,reason:'PARTY_ENGAGEMENT_REQUIRED'};
  }

  if(!cooldownReady)return{eligible:false,reason:'COOLDOWN'};
  if(Number(mp)<spell.mp)return{eligible:false,reason:'MP',requiredMp:spell.mp};
  if(inRange!==true)return{eligible:false,reason:'RANGE'};

  return{
    eligible:true,
    reason:foreignReclaim
      ?'TAUNT_ANTI_KS_FOREIGN_RECLAIM'
      :(claimHandoffAuthorized===true
        ?'TAUNT_CONFIRMED_SPAWN_CLAIM'
         :(protectedBossRescue?'TAUNT_BOSS_PROTECTED_PARTY':(miniBossSight?'TAUNT_MINIBOSS_ON_SIGHT':(farmClaim?'TAUNT_FARM_OWNERSHIP':'TAUNT_PARTY_TARGET')))),
    request:{
      kind:'USE_SKILL',
      owner:'WARRIOR_SPELL_STATE',
      category:spell.category,
      skill:'taunt',
      target,
      successProof:spell.successProof,
      authorizationOwner:foreignReclaim?'ANTI_KS':(claimHandoffAuthorized===true?'TARGET_CLAIM':null),
      claimHandoffAuthorized:claimHandoffAuthorized===true,
      antiKsReclaimAuthorized:foreignReclaim
    }
  };
}

function planFarmAgitate({healerReady=false,isFarmMob=false,farmOwnershipAuthorized=false,agitateCooldownReady=false,mp=0,nearbyMobs=[]}={}){
  const spell=WARRIOR_SPELLS.AGITATE;
  if(healerReady!==true||isFarmMob!==true||farmOwnershipAuthorized!==true)return{eligible:false,reason:'FARM_HEALER_OR_AUTHORIZATION_REQUIRED'};
  // Agitate is indiscriminate: NEVER cast if its range contains outsiders, bosses,
  // non-hunt mobs, or a mob with unknown classification.
  if(!Array.isArray(nearbyMobs)||!nearbyMobs.length)return{eligible:false,reason:'NEARBY_MOBS_REQUIRED'};
  if(nearbyMobs.some(m=>!m||m.distance==null||!Number.isFinite(Number(m.distance))||Number(m.distance)<0))return{eligible:false,reason:'AGITATE_UNKNOWN_MOB_DISTANCE'};
  const inRange=nearbyMobs.filter(m=>Number(m.distance)<=spell.range);
  if(inRange.some(m=>m.isHuntMob!==true||m.isBoss===true||m.targetingForeignPlayer===true))return{eligible:false,reason:'AGITATE_UNSAFE_NEARBY_TARGET'};
  const loose=inRange.filter(m=>m.warriorHasAggro!==true);
  if(loose.length<2)return{eligible:false,reason:'PREFER_SINGLE_TAUNT'};
  if(!agitateCooldownReady)return{eligible:false,reason:'COOLDOWN'};
  if(Number(mp)<spell.mp)return{eligible:false,reason:'MP',requiredMp:spell.mp};
  return{eligible:true,reason:'AGITATE_FARM_MULTIPLE_LOOSE_MOBS',request:{kind:'USE_SKILL',owner:'WARRIOR_SPELL_STATE',category:spell.category,skill:'agitate',targetType:'SELF_AOE',successProof:spell.successProof}};
}

module.exports={WARRIOR_SPELLS,evaluateStomp,planPartyTaunt,planFarmAgitate};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js"}],
"characters/warrior/WarriorController.js":[function(require,module,exports){
'use strict';

const {evaluateStomp,planPartyTaunt,planFarmAgitate}=require('./Spells');
const {planWarriorFarmRotation}=require('./FarmRotation');

function createWarriorController({party,character='Hibari'}={}){
  if(!party||typeof party.get!=='function')throw new Error('WARRIOR_PARTY_SERVICE_REQUIRED');
  const name=String(character||'Hibari');

  function farmHealerReady(ctx={}){
    // ORDER66: Souji must be present for EVERY PvE pull/attack, including bosses.
    // Do not treat non-farm combat as exempt from the healer requirement.
    if(typeof party.ready==='function'){
      return party.ready(['Souji'],{
        anchor:name,
        maxDistance:Number(ctx.healerMaxDistance||190),
        sameMap:true,
        sameInstance:true
      });
    }
    const healer=party.get('Souji');
    const ok=!!(healer&&healer.online===true&&healer.dead!==true&&healer.rip!==true);
    return{ok,reason:ok?'READY':'SOUJI_NOT_READY',members:{Souji:healer||null}};
  }

  function plan(ctx={}){
    const healer=farmHealerReady(ctx);
    if(!healer.ok){
      const rotation=planWarriorFarmRotation({...ctx,healerReady:false});
      // Missing Souji => no normal attack, Cleave, Taunt, Stomp, boss pull,
      // or emergency-aggression exception. FarmState owns safe retreat.
      return{
        ok:true,action:null,actions:[],normalAttack:null,
        reason:'WARRIOR_FARM_REQUIRES_SOUJI',healer,rotation
      };
    }

    const rotation=planWarriorFarmRotation({...ctx,healerReady:true});
    const actions=[];
    if(rotation.normalAttack)actions.push(rotation.normalAttack);

    const farmMode=ctx.isFarmMob===true||String(ctx.mainState||'')==='FARM_MOB';
    // A running WarriorV2Runtime is the sole native Taunt/Agitate/buff
    // owner; FarmState still owns Stomp weapon swaps and DPS rotation.
    const auxiliaryOwned=ctx.v2UtilityOwned===true;
    const agitate=auxiliaryOwned?{eligible:false,reason:'V2_SINGLE_SKILL_OWNER'}:
      planFarmAgitate({...ctx,isFarmMob:farmMode,healerReady:healer.ok});
    // Rescue party members first. Farm ownership may claim even idle hunt mobs,
    // but only with nearby Souji and explicit validated hunt classification.
    const taunt=auxiliaryOwned?{eligible:false,reason:'V2_SINGLE_TAUNT_OWNER'}:planPartyTaunt({
      ...ctx,
      cooldownReady:ctx.tauntCooldownReady===true,
      inRange:ctx.tauntInRange===true,
      isFarmMob:farmMode&&ctx.targetIsHuntMob===true,
      farmOwnershipAuthorized:farmMode&&ctx.targetIsHuntMob===true&&ctx.farmOwnershipAuthorized===true,
      healerReady:healer.ok
    });
    // Farm emergency crowd control takes precedence over routine single-target
    // Taunt. Boss rescue stays separately protected by the existing boss rules.
    const stomp=evaluateStomp(ctx);
    if(stomp.eligible&&farmMode&&ctx.targetIsBoss!==true){
      actions.push(stomp.request);
      return{ok:true,action:stomp.request,actions,normalAttack:rotation.normalAttack,
        executionOrder:rotation.normalAttack?['BASIC_ATTACK','STOMP']:['STOMP'],
        reason:stomp.reason,healer,rotation,stomp,taunt};
    }
    if(taunt.eligible){
      actions.push(taunt.request);
      return{
        ok:true,action:taunt.request,actions,normalAttack:rotation.normalAttack,
        executionOrder:rotation.normalAttack?['BASIC_ATTACK','TAUNT']:['TAUNT'],
        reason:taunt.reason,healer,rotation
      };
    }

    if(stomp.eligible){
      actions.push(stomp.request);
      return{
        ok:true,action:stomp.request,actions,normalAttack:rotation.normalAttack,
        executionOrder:rotation.normalAttack?['BASIC_ATTACK','STOMP']:['STOMP'],
        reason:stomp.reason,healer,rotation
      };
    }

    if(agitate.eligible){
      actions.push(agitate.request);
      return{ok:true,action:agitate.request,actions,normalAttack:rotation.normalAttack,
        executionOrder:rotation.normalAttack?['BASIC_ATTACK','AGITATE']:['AGITATE'],
        reason:agitate.reason,healer,rotation,agitate,taunt};
    }

    if(rotation.special)actions.push(rotation.special);
    return{
      ok:true,
      action:rotation.special||null,
      actions,
      normalAttack:rotation.normalAttack,
      executionOrder:rotation.executionOrder||(
        rotation.normalAttack&&rotation.special?['BASIC_ATTACK','ROTATION_SKILL']:
        rotation.normalAttack?['BASIC_ATTACK']:
        rotation.special?['ROTATION_SKILL']:[]
      ),
      reason:rotation.reason||taunt.reason||stomp.reason||'NO_ACTION',
      healer,rotation,stomp,taunt
    };
  }

  async function health(){
    const self=party.get(name);
    if(!self)return{ok:true,ready:false,reason:'PARTY_SNAPSHOT_PENDING',self:null};
    return{
      ok:true,
      ready:self.online===true&&self.dead!==true&&self.rip!==true,
      reason:self.online!==true?'OFFLINE':(self.dead===true||self.rip===true?'DEAD':'READY'),
      self
    };
  }

  return{plan,health,farmHealerReady};
}

module.exports={createWarriorController};

},{"./Spells":"characters/warrior/Spells.js","./FarmRotation":"characters/warrior/FarmRotation.js"}],
"characters/warrior/WarriorV2Runtime.js":[function(require,module,exports){
'use strict';

// V3 Warrior-owned, ONE heartbeat for V2 defensive/taunt/potion/portal skills.
// FarmState owns attacks, circle movement and weapon swaps; WorldBoss owns
// boss attacks. This service never starts a second combat/movement scheduler.
const {snapshotMobs,selectTaunt,planV2Utilities}=require('./WarriorV2Tactics');
const {createCrewResources}=require('../../ligaments/inventory/CrewResources');
const {createWarriorV2Supplies}=require('./WarriorV2Supplies');
const {createWarriorV2Telemetry}=require('./WarriorV2Telemetry');
const {BOSS_MTYPES}=require('../../organs/bosses/ScanBossState');
const {evaluateAntiKsArm,nearestForeignPartyDistance}=require('../../core/policy/AntiKsPolicy');
function createWarriorV2Runtime({
 root,
 gear=null,
 farmStatus=()=>null,
 bossStatus=()=>null,
 now=Date.now,
 intervalMs=100,
 setIntervalFn=setInterval,
 clearIntervalFn=clearInterval
}={}){
 if(!root||root.character?.name!=='Hibari'||typeof root.use_skill!=='function')
  throw Error('V3_WARRIOR_RUNTIME_HIBARI_NATIVE_REQUIRED');
 let timer=null,busy=false,lastPotion=0,lastTaunt=0,lastUtility=0,
  previousMagiport=null,magiportHandler=null,lastTownAt=null,
  townEscapeConfirmed=false,priorOrb=null,lastJackoCheck=0;
 const resources=createCrewResources({root,now,healer,manageShop:true});
 const supplies=createWarriorV2Supplies({root,gear,now,manageRestock:false});
 const telemetry=createWarriorV2Telemetry({root,now});
 const state={version:3,role:'Hibari',ticks:0,potionsHp:0,potionsMp:0,
  taunts:0,agitate:0,warcry:0,hardshell:0,charge:0,scares:0,
  portals:0,townEscapes:0,criticalHold:false,lastSkill:null,
  lastError:null,lastReason:null,lastTarget:null};
 const c=()=>root.character;
 const valid=()=>!!c()&&c().rip!==true&&c().dead!==true&&Number(c().hp)>0;
 const ratio=()=>Number(c()?.hp||0)/Math.max(1,Number(c()?.max_hp||1));
 const timeout=()=>Number(now());
 const fn=n=>typeof root[n]==='function'?root[n].bind(root):null;
 const ready=n=>{
  try{return typeof root.can_use==='function'?root.can_use(n)===true:
    typeof root.is_on_cooldown==='function'?!root.is_on_cooldown(n):false}catch{return false}
 };
 function healer(){
  try{
   const p=root.get_player?.('Souji')||root.parent?.entities?.Souji;
   if(!p||p.rip||p.dead||!(Number(p.hp)>0)||
      (p.map&&p.map!==c().map)||String(p.in??c().in??'')!==String(c().in??''))
     return false;
   const x=Number(p.real_x??p.x),y=Number(p.real_y??p.y);
   const hx=Number(c().real_x??c().x),hy=Number(c().real_y??c().y);
   return [x,y,hx,hy].every(Number.isFinite)&&Math.hypot(x-hx,y-hy)<=190;
  }catch{return false}
 }
 function currentFarm(){
  try{
   const row=farmStatus()||{};
   const farm=row.farmPosition;
   const at=!!farm&&farm.map===c().map&&
     [farm.x,farm.y,c().real_x??c().x,c().real_y??c().y].every(
       v=>v!==null&&v!==undefined&&Number.isFinite(Number(v)))&&
     Math.hypot(Number(c().real_x??c().x)-Number(farm.x),
       Number(c().real_y??c().y)-Number(farm.y))<=
       Math.max(35,Number(farm.radius||120));
   return row.state==='FARM'&&row.paused!==true&&
     row.phase==='FARM_MOB'&&at;
  }catch{return false}
 }
 async function use(skill,target=null){
  try{
   const targetEntity=target&&root.parent?.entities?.[String(target)];
   const result=target===null?await root.use_skill(skill):
     await root.use_skill(skill,targetEntity||target);
   if(result?.failed===true||result?.ok===false||result?.success===false)
     throw Error(String(result?.message||result?.error||'NATIVE_SKILL_FAILED'));
   state.lastSkill=skill;state.lastTarget=target;state.lastError=null;
   return true;
  }catch(error){state.lastError=skill+':'+String(error?.message||error);return false}
 }
 function takePotion(){
  const skill=resources.tickPotion();
  if(skill)state[skill==='use_hp'?'potionsHp':'potionsMp']++;
 }
 function jackoStatus(){
  const equipped=c()?.slots?.orb?.name==='jacko';
  const slots=(c()?.items||[]).map((item,index)=>item?.name==='jacko'?index:-1).filter(i=>i>=0);
  return {equipped,inventorySlots:slots,available:equipped||slots.length>0};
 }
 async function criticalRecovery(){
  const hp=ratio();
  if(!state.criticalHold&&hp>.50)return false;
  if(state.criticalHold&&hp>=.85){
   state.criticalHold=false;townEscapeConfirmed=false;state.lastReason='HP_RECOVERED_85';
   if(priorOrb&&priorOrb.name!=='jacko'&&gear?.equipBest){
    try{await gear.equipBest('WARRIOR_RECOVERY',{name:priorOrb.name,level:priorOrb.level,slot:'orb'});}catch(_){}
   }
   priorOrb=null;return false;
  }
  if(!state.criticalHold){priorOrb=c()?.slots?.orb?{...c().slots.orb}:null;state.criticalHold=true;}
  state.lastReason='SCARE_HP_RECOVERY';
  const jacko=jackoStatus();state.jacko=jacko;
  if(!jacko.equipped&&jacko.available&&timeout()-lastJackoCheck>=750){
   lastJackoCheck=timeout();
   try{
    if(gear?.equipBest)await gear.equipBest('WARRIOR_RECOVERY',{name:'jacko',slot:'orb'});
    else if(typeof root.equip==='function')await root.equip(jacko.inventorySlots[0],'orb');
   }catch(e){state.lastError='JACKO_EQUIP:'+String(e?.message||e);}
  }
  state.jacko=jackoStatus();
  if(ready('scare')&&await use('scare'))state.scares++;
  if(ratio()<=.55&&ready('hardshell')&&await use('hardshell'))state.hardshell++;
  // Stay with Souji and recover. No automatic Town cast while recovering.
  return true;
 }
 function mobs(){
  try{return snapshotMobs({self:c(),entities:root.parent?.entities||{},
    farmMobTypes:farmStatus()?.configuredFarmMobTypes||['xscorpion'],
    bossTypes:BOSS_MTYPES});
  }catch{return[]}
 }
 async function tick(){
  if(busy)return{ok:true,reason:'WARRIOR_TICK_IN_FLIGHT'};
  busy=true;state.ticks++;
  try{
   if(!valid())return{ok:true,reason:'WAIT_RESPAWN'};
   // Potion recovery must remain available below the critical retreat threshold.
   takePotion();
   void resources.tickShop();
   if(await criticalRecovery())return{ok:true,reason:'SCARE_HP_RECOVERY'};
   // Same Warrior heartbeat: no duplicate loot/sell/buy/elixir timer.
   if(ratio()>.4){
     const work=supplies.tick();
     if(work?.catch)work.catch(e=>{state.lastError='SUPPLIES:'+String(e?.message||e)});
   }
   const farm=currentFarm(),near=mobs(),hp=ratio();
   for(const m of near)if(m.isBoss)
     telemetry.observeBoss({id:m.id,mtype:m.mtype,map:c().map});
   // Existing shared AntiKsPolicy exclusively owns the 50px check.
   // No second claim loop: this only influences the single Taunt decision.
   const snapshot=farmStatus()||{},farmSite=snapshot.farmPosition;
   const members=Object.keys(root.get_party?.()||{});
   const foreign=nearestForeignPartyDistance({entities:root.parent?.entities||{},
     partyNames:[...members,'Hibari','Harutora','Souji','Rentaro'],
     farm:farmSite,instance:c().in??c().instance});
   const bossActive=bossStatus()?.active===true;
   const configured=snapshot.configuredFarmMobTypes?.[0]||'xscorpion';
   const antiKs=evaluateAntiKsArm({mainState:farm?'FARM_MOB':'',
     inConfiguredFarmArea:farm,mobType:configured,
     configuredFarmMob:configured,foreignPartyDistanceToFarmArea:foreign,
     bossPriorityActive:bossActive});
   state.antiKsArmed=antiKs.armed===true;
   state.antiKsReason=antiKs.reason;
   // V2 priority: taunt Souji / Harutora immediately; then named mini
   // bosses on sight with healer; then loose configured farm spawns.
   if(hp>.65&&timeout()-lastTaunt>=150&&ready('taunt')){
    const plan=selectTaunt({mobs:near.filter(m=>m.targetingProtected||m.isMiniBoss||
      (farm&&m.isFarmMob)),healerReady:healer(),cooldownReady:true,
      mp:Number(c().mp||0),range:Number(root.G?.skills?.taunt?.range||200),
      antiKsArmed:antiKs.armed===true});
    if(plan.eligible&&await use('taunt',plan.target)){
     state.taunts++;lastTaunt=timeout();state.lastReason=plan.reason;return{ok:true,kind:'TAUNT',reason:plan.reason};
    }
   }
   if(timeout()-lastUtility<450)return{ok:true,reason:'UTILITY_TICK_WAIT'};
   lastUtility=timeout();
   const flags=Object.fromEntries(['stomp','hardshell','agitate','warcry','charge']
     .map(n=>[n,ready(n)]));
   flags.warcryMp=Number(root.G?.skills?.warcry?.mp||0);
   const util=planV2Utilities({healerReady:healer()&&hp>.65,isFarmMode:farm,
    atFarm:farm,level:Number(c().level||0),hpRatio:hp,
    mp:Number(c().mp||0),maxMp:Number(c().max_mp||1),
    skillsReady:flags,buffs:c().s||{},mobs:near,
    bossOrPortal:!farm});
   // Stomp's wbasher swap belongs to the single Farm/FighterAction executor.
   if(!util.action||util.action.skill==='stomp')return{ok:true,reason:util.reason};
   if(await use(util.action.skill)){
    const key=util.action.skill;
    if(Object.prototype.hasOwnProperty.call(state,key))state[key]++;
    state.lastReason=util.reason;
    return{ok:true,kind:'UTILITY',reason:util.reason};
   }
   return{ok:false,error:state.lastError};
  }finally{busy=false}
 }
 function start(){
  if(timer!==null)return{ok:true,already:true};
  // Hibari only: retire the old V2 potion/taunt/recovery timers before
  // opening the single new V3 native skill owner. Never touch Priest/Mage.
  try{
   const old=root.__O66_V3_FARM_COMBAT_PARITY;
   if(old?.role==='Hibari')old.stop?.();
  }catch(_){}
  try{
   const legacy=root.__POGI_PROTECTED_PARTY_FAST_TAUNT_317;
   legacy?.destroy?.();
   if(legacy?.timer)(root.clearInterval||clearIntervalFn)(legacy.timer);
  }catch(_){}
  try{
   const recovery=root.__POGI_WARRIOR_RECOVERY_SOURCE_GATE_316;
   if(recovery?.timer)(root.clearInterval||clearIntervalFn)(recovery.timer);
  }catch(_){}
  try{
   root.__health_status_generation=Number(root.__health_status_generation||0)+1;
   if(root.__health_status_timer)
     (root.clearTimeout||clearTimeout)(root.__health_status_timer);
  }catch(_){}
  telemetry.start();
  try{const j=jackoStatus();root.game_log?.('O66 Hibari Jacko: '+(j.equipped?'EQUIPPED':j.available?'INVENTORY slot '+j.inventorySlots.join(','):'MISSING'));}catch(_){}
  previousMagiport=root.on_magiport;
  magiportHandler=from=>{
   if(String(from||'')==='Harutora'&&valid()&&typeof root.accept_magiport==='function'){
    try{
     const result=root.accept_magiport('Harutora');
     if(result?.catch)result.catch(e=>{state.lastError='MAGIPORT:'+String(e?.message||e)});
     state.portals++;
     return result;
    }catch(e){state.lastError='MAGIPORT:'+String(e?.message||e);return false}
   }
   if(typeof previousMagiport==='function')return previousMagiport(from);
  };
  root.on_magiport=magiportHandler;
  timer=setIntervalFn(()=>{void tick().catch(e=>{
   state.lastError='TICK:'+String(e?.message||e);
  })},Math.max(80,Number(intervalMs)||100));
  return{ok:true,started:true};
 }
 function stop(){
  if(timer!==null)clearIntervalFn(timer);
  timer=null;
  if(root.on_magiport===magiportHandler)root.on_magiport=previousMagiport;
  telemetry.stop();
  return{ok:true,stopped:true};
 }
 function status(){return{...state,running:timer!==null,busy,
  healerNear:valid()?healer():false,jacko:jackoStatus(),resources:resources.status(),supplies:supplies.status(),
  dps:telemetry.snapshot()};}
 return{start,stop,tick,status,telemetry,supplies};
}
module.exports={createWarriorV2Runtime};

},{"./WarriorV2Tactics":"characters/warrior/WarriorV2Tactics.js","../../ligaments/inventory/CrewResources":"ligaments/inventory/CrewResources.js","./WarriorV2Supplies":"characters/warrior/WarriorV2Supplies.js","./WarriorV2Telemetry":"characters/warrior/WarriorV2Telemetry.js","../../organs/bosses/ScanBossState":"organs/bosses/ScanBossState.js","../../core/policy/AntiKsPolicy":"core/policy/AntiKsPolicy.js"}],
"characters/warrior/WarriorV2Supplies.js":[function(require,module,exports){
'use strict';

// Port of the V2 Hibari supply loop. No timers, no movement, no combat.
// Called only from the single WarriorV2Runtime heartbeat and shares V3
// GearService serialization for equipped Strength Elixir.
const SELL_NAMES=new Set([
 'glolipop','helmet','shoes','pants','gloves','coat','xmace',
 'hpamulet','hpbelt','ringsj','stinger','snowball','carrotsword',
 'slimestaff','spores','beewings','gslime','whiteegg','xmasshoes',
 'xmashat','warmscarf','xmaspants','rednose','xmassweater',
 'snowflakes','merry','crabclaw','cclaw','sstinger','carrot',
 'mushroomstaff','intamulet','dexamulet','stramulet','vitring',
 'pstem','smush','bcandle','bwing','phelmet','smoke','gphelmet',
 'wattire','wgloves','wshoes','wbreeches','wcap','frankypants',
 'mcape','quiver','cshell','gloves1','coat1','helmet1','pants1',
 'shoes1','rattail','frogt','eears','epyjamas','eslippers','ecape',
 'pmace','spear','basher','wbook0','harbringer','vitearring',
 'iceskates','bandages','t2bow','firecrackers','btusk','lantern',
 'skullamulet','talkingskull','hpants','wbasher'
]);
const KEEP_NAMES=new Set(['hpot1','mpot1','hpot0','mpot0','tracker','computer',
 'candypop','elixirstr0','vhammer','bataxe','basher','fireblade',
 'glolipop','ololipop']);
function total(items,name){
 return (Array.isArray(items)?items:[]).reduce((sum,item)=>sum+
   (item?.name===name?Math.max(1,Math.floor(Number(item.q)||1)):0),0);
}
function sellable(item){
 if(!item||!item.name||!SELL_NAMES.has(String(item.name)))return false;
 if(item.l===true||item.locked===true||item.p!=null)return false;
 if(Number(item.level||0)>0)return false;
 if(KEEP_NAMES.has(String(item.name)))return false;
 if(/scroll/i.test(String(item.name)))return false;
 // WBasher +3 and both +9 Fiery Blades can never be sold.
 return true;
}
function createWarriorV2Supplies({
 root,gear=null,now=Date.now,
 lootGapMs=550,shopGapMs=5000,elixirGapMs=10000,manageRestock=true
}={}){
 if(root?.character?.name!=='Hibari')throw Error('HIBARI_SUPPLIES_ONLY');
 const state={lootCalls:0,sales:0,boughtHp:0,boughtMp:0,elixirs:0,
   lastError:null,lastOperation:null,lastLootAt:null,lastShopAt:null,
   lastElixirAt:null};
 let busy=false;
 const c=()=>root.character;
 function ready(){return c()?.name==='Hibari'&&!c().rip&&Number(c().hp)>0}
 function status(){return{...state,busy};}
 async function native(name,args=[]){
  const fn=root?.[name];
  if(typeof fn!=='function')return{ok:false,error:'NATIVE_'+name.toUpperCase()+'_UNAVAILABLE'};
  try{
   const r=await fn.apply(root,args);
   if(r?.ok===false||r?.failed===true||r?.success===false)
    return{ok:false,error:'NATIVE_'+name.toUpperCase()+'_REJECTED'};
   return{ok:true,result:r};
  }catch(e){return{ok:false,error:String(e?.message||e)}}
 }
 async function tick(){
  if(busy||!ready())return{ok:true,skipped:true};
  busy=true;const t=Number(now());
  try{
   // V2 loot() is native and safe while standing still; no new movement.
   if(state.lastLootAt===null||t-state.lastLootAt>=lootGapMs){
    state.lastLootAt=t;
    const found=await native('loot');
    if(found.ok)state.lootCalls++;
   }
   const items=Array.isArray(c().items)?c().items:[];
   if(state.lastShopAt===null||t-state.lastShopAt>=shopGapMs){
    state.lastShopAt=t;
    // V2 buys only below 100 and tops the stack to 1000. If the native
    // shop API declines at this location we record the error, not travel.
    const buyer=typeof root.buy_with_gold==='function'?'buy_with_gold':'buy';
    if(manageRestock)for(const [item,field] of [['hpot1','boughtHp'],['mpot1','boughtMp']]){
     const count=total(items,item);
     if(count>=100)continue;
     const qty=Math.max(0,1000-count);
     const result=await native(buyer,[item,qty]);
     if(result.ok){state[field]+=qty;state.lastOperation='BUY_'+item;}
     else state.lastError='BUY_'+item+':'+result.error;
    }
    // V2 sell list synced to Rentaro; never sell gear needed for swaps,
    // locked, shiny, upgraded or KEEP items.
    const slot=items.findIndex(sellable);
    if(slot>=0){
     const item=items[slot];
     const before=String(item.name||'');
     // Re-check the live slot immediately before the mutation: a
     // concurrent GearService swap can change inventory positions.
     if(!sellable(c().items?.[slot])||c().items[slot]!==item)
       return{ok:true,skipped:true,reason:'INVENTORY_SLOT_CHANGED_BEFORE_SELL'};
     const result=await native('sell',[slot,9999]);
     if(result.ok){state.sales++;state.lastOperation='SELL_'+before;}
     else state.lastError='SELL_'+before+':'+result.error;
    }
   }
   if(state.lastElixirAt===null||t-state.lastElixirAt>=elixirGapMs){
    state.lastElixirAt=t;
    const worn=c().slots?.elixir;
    if(worn?.name!=='elixirstr0'&&items.some(x=>x?.name==='elixirstr0')){
     if(gear&&typeof gear.equipBest==='function'){
      const equipped=await gear.equipBest('HIBARI_V2_ELIXIR',
        {name:'elixirstr0',slot:'elixir',selection:'HIGHEST_LEVEL'});
      if(equipped?.ok===true&&equipped?.verified===true){
       state.elixirs++;state.lastOperation='EQUIP_ELIXIRSTR0';
      }else state.lastError='ELIXIR_GEAR_UNVERIFIED_'+String(equipped?.error||'');
     }else state.lastError='ELIXIR_GEAR_SERVICE_REQUIRED';
    }
   }
   return{ok:true,status:status()};
  }catch(e){state.lastError=String(e?.message||e);return{ok:false,error:state.lastError}}
  finally{busy=false}
 }
 return{tick,status,sellable,total};
}
module.exports={createWarriorV2Supplies,SELL_NAMES,KEEP_NAMES,sellable,total};

},{}],
"characters/warrior/WarriorV2Tactics.js":[function(require,module,exports){
'use strict';

// V3 pure Warrior decisions reconstructed from the canonical V2 Warrior.
// No timers, game API calls, map changes, or duplicated combat owners.
// The Farm / WorldBoss state grants the single COMBAT/MOVEMENT leases.
const V2_ORBIT=Object.freeze({radius:65,contactRadius:40,angle:Math.PI/6,tickMs:250});
const MINI_BOSSES=new Set(['phoenix','mvampire','fvampire','dragold']);
const PROTECTED=new Set(['Souji','Harutora']);
const dist=(a,b)=>{
 const ax=Number(a?.real_x??a?.x),ay=Number(a?.real_y??a?.y);
 const bx=Number(b?.real_x??b?.x),by=Number(b?.real_y??b?.y);
 return [ax,ay,bx,by].every(Number.isFinite)?Math.hypot(ax-bx,ay-by):Infinity;
};
const living=m=>!!(m&&m.type==='monster'&&m.dead!==true&&m.rip!==true&&Number(m.hp)>0);
const action=(skill,target=null)=>({kind:'USE_SKILL',skill,target,owner:'WARRIOR_V2_PARITY',
 successProof:'SERVER_RESPONSE'});
function snapshotMobs({self,entities={},farmMobTypes=['xscorpion'],bossTypes=[]}={}){
 const farm=new Set(farmMobTypes.map(String)),boss=new Set([...bossTypes,...MINI_BOSSES].map(String));
 return Object.values(entities||{}).filter(living).map(e=>{
  const d=dist(self,e),target=String(e.target||'');
  return{id:String(e.id||''),mtype:String(e.mtype||''),distance:d,target,
   isFarmMob:farm.has(String(e.mtype||'')),isBoss:boss.has(String(e.mtype||'')),
   isMiniBoss:MINI_BOSSES.has(String(e.mtype||'')),
   targetingProtected:PROTECTED.has(target),targetingWarrior:target==='Hibari',
   targetingForeignPlayer:!!target&&!PROTECTED.has(target)&&target!=='Hibari'&&target!=='Rentaro',
   damageType:String(e.damage_type||'physical')};
 }).filter(m=>m.id&&Number.isFinite(m.distance)).sort((a,b)=>a.distance-b.distance);
}
function selectTaunt({mobs=[],healerReady=false,cooldownReady=false,mp=0,range=200,antiKsArmed=false}={}){
 if(cooldownReady!==true||Number(mp)<40)return{eligible:false,reason:'TAUNT_COOLDOWN_OR_MP'};
 const close=mobs.filter(m=>m.distance<=Number(range)&&!m.targetingWarrior);
 // V2 fastest priority: save Mage and Priest regardless of whether the
 // Priest is currently within farming range. Rescue is NOT permission to attack.
 const rescue=close.find(m=>m.targetingProtected);
 if(rescue)return{eligible:true,reason:'RESCUE_SOUJI_OR_HARUTORA',target:rescue.id,
   request:action('taunt',rescue.id)};
 if(!healerReady)return{eligible:false,reason:'WAIT_SOUJI_NO_FARM_PULL'};
 // Reuse the V3 AntiKsPolicy's 50px authorization. This does NOT run
 // without a confirmed foreign party physically near the farm, does
 // not override the boss state, and never taunts unrelated mob types.
 if(antiKsArmed===true){
  const claim=close.find(m=>m.isFarmMob&&m.targetingForeignPlayer&&!m.isBoss);
  if(claim)return{eligible:true,reason:'ANTI_KS_AUTHORIZED_FOREIGN_RECLAIM',
    target:claim.id,request:action('taunt',claim.id)};
 }
 // Named mini-bosses get an on-sight taunt as requested. Never take a
 // foreign player's boss already targeted by another party.
 const mini=close.find(m=>m.isMiniBoss&&!m.targetingForeignPlayer);
 if(mini)return{eligible:true,reason:'MINI_BOSS_ON_SIGHT',target:mini.id,
   request:action('taunt',mini.id)};
 // V2 farm mob spawning: claim one loose mob per Taunt cooldown.
 // Never taunt non-farm entities or steal another player's mob.
 const loose=close.find(m=>m.isFarmMob&&!m.targetingForeignPlayer&&
   (!m.target||PROTECTED.has(m.target)||m.target==='Rentaro'));
 if(loose)return{eligible:true,reason:'FARM_SPAWN_OWNERSHIP',target:loose.id,
   request:action('taunt',loose.id)};
 return{eligible:false,reason:'NO_ELIGIBLE_TAUNT'};
}
function planOrbit({
 self,center,healerReady=false,underFarmAttack=false,
 atFarm=false,inBoss=false,inPortal=false,contact=false
}={}){
 if(inBoss||inPortal)return{ok:false,reason:'BOSS_OR_PORTAL_OWNS_MOVEMENT'};
 if(!atFarm||!center||!self||self.map!==center.map)
  return{ok:false,reason:'NOT_AT_APPROVED_FARM'};
 if(!healerReady&&!underFarmAttack)
  return{ok:false,reason:'WAIT_HEALER_NO_FARM_MOVEMENT'};
 const x=Number(self.real_x??self.x),y=Number(self.real_y??self.y);
 if(![x,y,Number(center.x),Number(center.y)].every(Number.isFinite))
  return{ok:false,reason:'COORDINATES_MISSING'};
 const theta=Math.atan2(y-Number(center.y),x-Number(center.x))+V2_ORBIT.angle;
 const radius=contact?V2_ORBIT.radius:V2_ORBIT.contactRadius;
 return{ok:true,source:'V2_HIBARI_WHIRLPOOL',radius,
  target:{map:center.map,x:Number(center.x)+radius*Math.cos(theta),
   y:Number(center.y)+radius*Math.sin(theta)}};
}
function planV2Utilities({
 healerReady=false,isFarmMode=true,atFarm=false,level=0,
 hpRatio=1,mp=0,maxMp=1,skillsReady={},buffs={},mobs=[],
 bossOrPortal=false
}={}){
 const farm=mobs.filter(m=>m.isFarmMob&&m.distance<=320);
 const physical=mobs.some(m=>m.targetingWarrior&&m.damageType!=='magical');
 const attackers=mobs.filter(m=>m.isFarmMob&&m.targetingWarrior&&m.distance<=400).length;
 if(hpRatio<.30)return{action:null,reason:'SCARE_AND_TOWN_RETREAT_REQUIRED'};
 if(healerReady&&isFarmMode&&atFarm&&level>=52&&skillsReady.stomp===true&&
   Number(mp)>=120&&farm.length>0&&(hpRatio<=.5||attackers>=5)){
  return{action:{...action('stomp'),loadout:{
    name:'V2_STOMP',clearSlots:['offhand'],mainhand:{name:'wbasher',level:3},offhand:null},
    restoreAfter:true},reason:'V2_EMERGENCY_BASHER_STOMP'};
 }
 if(level>=60&&hpRatio<=.55&&physical&&skillsReady.hardshell===true&&
    Number(mp)>=480)
   return{action:action('hardshell'),reason:'V2_HARDSHELL_PHYSICAL_DEFENSE'};
 if(healerReady&&isFarmMode&&atFarm&&level>=68&&skillsReady.agitate===true&&
   Number(mp)>=420&&Number(mp)-420>=Number(maxMp)*.2&&
   farm.length>=2&&farm.some(m=>!m.targetingWarrior)&&
   !mobs.some(m=>m.distance<=320&&(!m.isFarmMob||m.targetingForeignPlayer)))
   return{action:action('agitate'),reason:'V2_FARM_MASS_TAUNT'};
 if(level>=70&&!buffs.warcry&&skillsReady.warcry===true&&
   Number(mp)>=Number(maxMp)*.4+Number(skillsReady.warcryMp||0))
   return{action:action('warcry'),reason:'V2_WARCRY_BUFF'};
 if(skillsReady.charge===true&&(bossOrPortal||!farm.length)&&Number(mp)>=0)
   return{action:action('charge'),reason:'V2_CHARGE_TRAVEL_ONLY'};
 return{action:null,reason:'NO_UTILITY_DUE'};
}
module.exports={V2_ORBIT,MINI_BOSSES,PROTECTED,snapshotMobs,selectTaunt,planOrbit,planV2Utilities};

},{}],
"characters/warrior/WarriorV2Telemetry.js":[function(require,module,exports){
'use strict';

// Read-only V2 DPS + boss spawn tracking port. One target_hit listener,
// no combat, movement, network/HTTP, or second timer.
const {BOSS_MTYPES}=require('../../organs/bosses/ScanBossState');
const BOSS=new Set(BOSS_MTYPES.map(String));
const WINDOW_MS=10000,MAX_HITS=2500;
function createWarriorV2Telemetry({root,now=Date.now}={}){
 if(root?.character?.name!=='Hibari')throw Error('HIBARI_DPS_ONLY');
 const state={hits:[],damageTotal:0,lastHitAt:null,bossDamage:{},
  bossCycles:[],bossSight:{},lastError:null,attached:false};
 let listener=null;
 function prune(){
  const cutoff=Number(now())-WINDOW_MS;
  state.hits=state.hits.filter(x=>x[0]>=cutoff).slice(-MAX_HITS);
 }
 function onHit(data){
  const n=Number(data?.damage);
  if(!Number.isFinite(n)||n<=0)return;
  const amount=Math.min(1000000000,Math.round(n)),at=Number(now());
  state.damageTotal+=amount;state.lastHitAt=at;
  state.hits.push([at,amount]);prune();
  const id=String(data?.target||'');
  const source=root.parent?.entities?.[id];
  const mtype=String(data?.mtype||source?.mtype||'');
  if(BOSS.has(mtype)){
   state.bossDamage[id]=(state.bossDamage[id]||0)+amount;
   if(data.kill===true){
    // A local target_hit kill counts one boss cycle. Never infer kills
    // from a vanished mob (it may have teleported or despawned).
    if(!state.bossCycles.some(x=>x.id===id&&at-x.killedAt<10000)){
     state.bossCycles.push({id,mtype,killedAt:at,
      ownDamage:state.bossDamage[id]||0,configuredRespawnSec:
       Number.isFinite(Number(root.G?.monsters?.[mtype]?.respawn))?
       Number(root.G.monsters[mtype].respawn):null,seenAgainAt:null});
     state.bossCycles=state.bossCycles.slice(-50);
    }
   }
  }
 }
 function observeBoss({mtype,id,map}={}){
  if(!BOSS.has(String(mtype||''))||!id)return{ok:true,skipped:true};
  const key=String(id),at=Number(now());
  state.bossSight[key]={mtype:String(mtype),map:String(map||''),seenAt:at};
  const previous=[...state.bossCycles].reverse().find(x=>
   x.mtype===String(mtype)&&x.seenAgainAt===null&&
   at>x.killedAt+5000);
  if(previous)previous.seenAgainAt=at;
  return{ok:true,seen:true};
 }
 function snapshot(){
  prune();
  const damage=state.hits.reduce((sum,h)=>sum+h[1],0);
  return{role:'Hibari',dps10s:Math.round(damage/10),
   windowDamage:damage,damageTotal:state.damageTotal,
   lastHitAt:state.lastHitAt,bossDamage:{...state.bossDamage},
   bossCycles:state.bossCycles.map(x=>({...x})),
   bossSight:{...state.bossSight},listenerAttached:state.attached,
   lastError:state.lastError};
 }
 function start(){
  if(state.attached)return{ok:true,already:true};
  try{
   // If the old V2 external DPS reporter is still in this CODE frame,
   // retire its duplicate target_hit listener and HTTP reporting.
   root.__POGI_DPS_WATCH_V1?.destroy?.();
  }catch(e){state.lastError='LEGACY_DPS_STOP:'+String(e?.message||e)}
  if(typeof root.character.on!=='function')
   return{ok:false,error:'CHARACTER_TARGET_HIT_EVENT_UNAVAILABLE'};
  listener=onHit;
  root.character.on('target_hit',listener);
  state.attached=true;
  return{ok:true,attached:true};
 }
 function stop(){
  if(state.attached){
   const off=root.character.off||root.character.removeListener;
   if(typeof off==='function')off.call(root.character,'target_hit',listener);
  }
  listener=null;state.attached=false;
  return{ok:true,stopped:true};
 }
 return{start,stop,snapshot,observeBoss,onHit};
}
module.exports={createWarriorV2Telemetry,WINDOW_MS,BOSS};

},{"../../organs/bosses/ScanBossState":"organs/bosses/ScanBossState.js"}],
"core/alerts/AlertManager.js":[function(require,module,exports){
'use strict';

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createAlertManager({sinks=[],now=Date.now}={}){
  const activeSinks=Array.isArray(sinks)?sinks.filter(Boolean):[];

  async function publish(alert={}){
    const normalized={
      id:String(alert.id||('v3-alert-'+Number(now()))),
      kind:String(alert.kind||'V3_ALERT'),
      event:String(alert.event||'INFO'),
      severity:String(alert.severity||'info'),
      title:String(alert.title||'PogiBrain V3'),
      body:String(alert.body||''),
      at:Number(alert.at||now()),
      change_id:alert.change_id==null?null:String(alert.change_id),
      area:alert.area==null?null:String(alert.area),
      description:alert.description==null?null:String(alert.description),
      requires_action:!!alert.requires_action,
      data:clone(alert.data||{})
    };

    const deliveries=[];
    for(const sink of activeSinks){
      try{
        const result=await sink.deliver(clone(normalized));
        deliveries.push({sink:String(sink.name||'unnamed'),ok:!(result&&result.ok===false),result:clone(result||{})});
      }catch(error){
        deliveries.push({sink:String(sink.name||'unnamed'),ok:false,error:String(error&&error.message||error)});
      }
    }
    return {
      ok:deliveries.length===0 || deliveries.some(row=>row.ok),
      alert:normalized,
      deliveries
    };
  }

  return {publish};
}

module.exports={createAlertManager};

},{}],
"core/change-verification/ChangeVerifier.js":[function(require,module,exports){
'use strict';

const SCHEMA_VERSION = 1;
const FINAL_STATUSES = new Set(['VERIFIED','CODE_FAIL','LIVE_FAIL','CANCELLED','SUPERSEDED']);

function clone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value,max=240){
  return String(value == null ? '' : value).replace(/[\r\n]+/g,' ').trim().slice(0,max);
}

function deepMatch(expected,actual){
  if(expected === undefined) return true;
  if(expected === null || typeof expected !== 'object') return Object.is(actual,expected);
  if(Array.isArray(expected)){
    if(!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((value,index)=>deepMatch(value,actual[index]));
  }
  if(actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.keys(expected).every(key=>deepMatch(expected[key],actual[key]));
}

function blankState(now){
  return {
    schema:SCHEMA_VERSION,
    created_at:Number(now()),
    updated_at:Number(now()),
    changes:{}
  };
}

function normalizeLive(live){
  live = live && typeof live === 'object' ? live : {};
  const required = live.required !== false;
  return {
    required,
    signal:required ? text(live.signal,100) : null,
    waiting_for:required ? text(live.waitingFor || live.waiting_for || 'matching live proof',240) : null,
    trigger:required ? clone(live.trigger || {}) : null,
    expect:required ? clone(live.expect || {}) : null
  };
}

function createChangeVerifier({store,alertManager=null,now=Date.now}={}){
  if(!store || typeof store.load !== 'function' || typeof store.save !== 'function'){
    throw new Error('CHANGE_STORE_REQUIRED');
  }

  let statePromise = null;

  async function loadState(){
    if(!statePromise){
      statePromise = Promise.resolve(store.load()).then(raw=>{
        if(!raw || Number(raw.schema)!==SCHEMA_VERSION || !raw.changes || typeof raw.changes!=='object'){
          return blankState(now);
        }
        return clone(raw);
      });
    }
    return statePromise;
  }

  async function persist(state){
    state.updated_at = Number(now());
    await store.save(clone(state));
    return state;
  }

  async function publish(change,event,extra={}){
    if(!alertManager || typeof alertManager.publish!=='function') return null;
    const severity = /FAIL/.test(event) ? 'error' : (/PASS|VERIFIED/.test(event) ? 'success' : 'info');
    const title = event==='LIVE_PASS'
      ? 'V3 live verification PASS'
      : event==='LIVE_FAIL'
        ? 'V3 live verification FAIL'
        : event==='CODE_FAIL'
          ? 'V3 code test FAIL'
          : event==='VERIFIED'
            ? 'V3 change VERIFIED'
            : 'V3 live verification pending';
    const bodyParts = [change.id, change.area, change.description].filter(Boolean);
    if(event==='LIVE_PENDING' && change.live && change.live.waiting_for){
      bodyParts.push('Waiting for: '+change.live.waiting_for);
    }
    if(extra.detail) bodyParts.push(text(extra.detail,300));
    return alertManager.publish({
      id:change.id+':'+event+':'+String(Number(now())),
      kind:'V3_CHANGE_VERIFICATION',
      event,
      severity,
      title,
      body:bodyParts.join(' | '),
      change_id:change.id,
      area:change.area,
      description:change.description,
      at:Number(now()),
      requires_action:event==='CODE_FAIL'||event==='LIVE_FAIL',
      data:clone(extra)
    });
  }

  function requireChange(state,id){
    const key=text(id,100);
    const change=state.changes[key];
    if(!change) throw new Error('CHANGE_NOT_FOUND:'+key);
    return change;
  }

  async function registerChange(spec={}){
    const state=await loadState();
    const id=text(spec.id,100);
    if(!id) throw new Error('CHANGE_ID_REQUIRED');
    if(state.changes[id]) throw new Error('CHANGE_ALREADY_EXISTS:'+id);

    const live=normalizeLive(spec.live);
    if(live.required && !live.signal) throw new Error('LIVE_SIGNAL_REQUIRED');

    const createdAt=Number(now());
    state.changes[id]={
      id,
      area:text(spec.area || 'UNSPECIFIED',100),
      description:text(spec.description || id,300),
      source_ref:text(spec.sourceRef || spec.source_ref || '',160) || null,
      created_at:createdAt,
      updated_at:createdAt,
      status:'CREATED',
      code_test:{status:'PENDING',detail:null,at:null},
      live:{
        required:live.required,
        signal:live.signal,
        waiting_for:live.waiting_for,
        trigger:live.trigger,
        expect:live.expect,
        status:live.required ? 'WAITING_FOR_CODE_PASS' : 'NOT_REQUIRED',
        started_at:null,
        resolved_at:null,
        actual:null,
        detail:null
      },
      history:[{at:createdAt,status:'CREATED',detail:null}]
    };
    await persist(state);
    return clone(state.changes[id]);
  }

  async function markCodeTest(id,{passed,detail=null}={}){
    const state=await loadState();
    const change=requireChange(state,id);
    if(change.code_test.status!=='PENDING') throw new Error('CODE_TEST_ALREADY_RESOLVED:'+change.id);

    const at=Number(now());
    change.code_test={status:passed?'PASS':'FAIL',detail:text(detail,500)||null,at};
    change.updated_at=at;

    if(!passed){
      change.status='CODE_FAIL';
      change.live.status=change.live.required ? 'BLOCKED' : 'NOT_REQUIRED';
      change.history.push({at,status:'CODE_FAIL',detail:change.code_test.detail});
      await persist(state);
      await publish(change,'CODE_FAIL',{detail:change.code_test.detail});
      return clone(change);
    }

    if(!change.live.required){
      change.status='VERIFIED';
      change.history.push({at,status:'VERIFIED',detail:'CODE_PASS_LIVE_NOT_REQUIRED'});
      await persist(state);
      await publish(change,'VERIFIED',{detail:'Automated test passed; live verification not required.'});
      return clone(change);
    }

    change.status='LIVE_PENDING';
    change.live.status='PENDING';
    change.live.started_at=at;
    change.history.push({at,status:'LIVE_PENDING',detail:change.live.waiting_for});
    await persist(state);
    await publish(change,'LIVE_PENDING',{detail:'Automated test passed.'});
    return clone(change);
  }

  async function resolveLiveInternal(state,change,{passed,actual=null,detail=null}={}){
    if(change.status!=='LIVE_PENDING' || change.live.status!=='PENDING'){
      throw new Error('LIVE_NOT_PENDING:'+change.id);
    }
    const at=Number(now());
    change.live.status=passed?'PASS':'FAIL';
    change.live.resolved_at=at;
    change.live.actual=clone(actual);
    change.live.detail=text(detail,500)||null;
    change.status=passed?'VERIFIED':'LIVE_FAIL';
    change.updated_at=at;
    change.history.push({at,status:passed?'LIVE_PASS':'LIVE_FAIL',detail:change.live.detail});
    await persist(state);
    await publish(change,passed?'LIVE_PASS':'LIVE_FAIL',{detail:change.live.detail,actual:clone(actual)});
    return clone(change);
  }

  async function resolveLive(id,result={}){
    const state=await loadState();
    const change=requireChange(state,id);
    return resolveLiveInternal(state,change,result);
  }

  async function observe(signal,payload={}){
    const state=await loadState();
    const sig=text(signal,100);
    const matches=[];
    for(const change of Object.values(state.changes)){
      if(change.status!=='LIVE_PENDING' || change.live.status!=='PENDING') continue;
      if(change.live.signal!==sig) continue;
      if(!deepMatch(change.live.trigger || {},payload)) continue;
      const passed=deepMatch(change.live.expect || {},payload);
      const resolved=await resolveLiveInternal(state,change,{
        passed,
        actual:payload,
        detail:passed?'Live proof matched expected result.':'Live proof did not match expected result.'
      });
      matches.push(resolved);
    }
    return matches;
  }

  async function cancel(id,reason='CANCELLED'){
    const state=await loadState();
    const change=requireChange(state,id);
    if(FINAL_STATUSES.has(change.status)) return clone(change);
    const at=Number(now());
    change.status='CANCELLED';
    if(change.live.status==='PENDING') change.live.status='CANCELLED';
    change.updated_at=at;
    change.history.push({at,status:'CANCELLED',detail:text(reason,300)});
    await persist(state);
    return clone(change);
  }

  async function supersede(id,byId){
    const state=await loadState();
    const change=requireChange(state,id);
    const at=Number(now());
    change.status='SUPERSEDED';
    if(change.live.status==='PENDING') change.live.status='SUPERSEDED';
    change.superseded_by=text(byId,100)||null;
    change.updated_at=at;
    change.history.push({at,status:'SUPERSEDED',detail:change.superseded_by});
    await persist(state);
    return clone(change);
  }

  async function get(id){
    const state=await loadState();
    return clone(requireChange(state,id));
  }

  async function list({status=null}={}){
    const state=await loadState();
    return Object.values(state.changes)
      .filter(change=>!status || change.status===status)
      .sort((a,b)=>Number(b.created_at)-Number(a.created_at))
      .map(clone);
  }

  async function summary(){
    const rows=await list();
    const counts={};
    for(const row of rows) counts[row.status]=(counts[row.status]||0)+1;
    return {
      schema:SCHEMA_VERSION,
      total:rows.length,
      pending:rows.filter(row=>row.status==='LIVE_PENDING').map(row=>({
        id:row.id,
        area:row.area,
        description:row.description,
        waiting_for:row.live.waiting_for,
        since:row.live.started_at
      })),
      counts
    };
  }

  async function isComplete(id){
    const change=await get(id);
    return change.status==='VERIFIED';
  }

  return {
    registerChange,
    markCodeTest,
    observe,
    resolveLive,
    cancel,
    supersede,
    get,
    list,
    summary,
    isComplete
  };
}

module.exports={createChangeVerifier,deepMatch,SCHEMA_VERSION};

},{}],
"core/change-verification/createDefaultRuntime.js":[function(require,module,exports){
'use strict';

const {createChangeVerifier}=require('./ChangeVerifier');
const {createAlertManager}=require('../alerts/AlertManager');
const {createLocalStorageChangeStore}=require('../../adapters/storage/LocalStorageChangeStore');
const {createBrowserAlertSink}=require('../../adapters/alerts/BrowserAlertSink');
const {createBridgeAlertSink}=require('../../adapters/alerts/BridgeAlertSink');

function createDefaultChangeVerificationRuntime({root=(typeof globalThis!=='undefined'?globalThis:{}),now=Date.now,directNativeMode=false}={}){
  const store=createLocalStorageChangeStore({storage:root.localStorage});
  const browser=createBrowserAlertSink({root});
  const bridge=directNativeMode?null:createBridgeAlertSink({root,storage:root.localStorage});
  const alertManager=createAlertManager({sinks:directNativeMode?[]:[bridge,browser],now});
  const verifier=createChangeVerifier({store,alertManager,now});

  return {
    verifier,
    alertManager,
    alerts:{browser,bridge},
    async start(){
      if(bridge)await bridge.drain();
      return verifier.summary();
    }
  };
}

module.exports={createDefaultChangeVerificationRuntime};

},{"./ChangeVerifier":"core/change-verification/ChangeVerifier.js","../alerts/AlertManager":"core/alerts/AlertManager.js","../../adapters/storage/LocalStorageChangeStore":"adapters/storage/LocalStorageChangeStore.js","../../adapters/alerts/BrowserAlertSink":"adapters/alerts/BrowserAlertSink.js","../../adapters/alerts/BridgeAlertSink":"adapters/alerts/BridgeAlertSink.js"}],
"core/contracts/AdventureLandContract.js":[function(require,module,exports){
'use strict';

const OFFICIAL_SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  commit:'ddcf7222c3264f1404382e1ff5dea8e73f6cb4b4',
  files:Object.freeze({
    runner:'js/runner_functions.js',
    common:'js/old_common_functions.js',
    skills:'design/skills.js',
    items:'design/items.js'
  })
});

const BANK_PACK_SIZE=42;
const BANK_STORE_SCOPE='CURRENT_BANK_FLOOR_ONLY';
const TRANSPORT=Object.freeze({timeoutMs:20000,arrivalProof:'CHARACTER_MAP_EQUALS_DESTINATION'});
const DOUBLE_HANDED_WTYPES=Object.freeze(['axe','basher','great_staff']);
const COMBAT_OWNERSHIP=Object.freeze({
  sourceRepository:'kaansoral/adventureland_mongodb',
  sourceCommit:'90052162eb3ebda36c893e1eb4af643913c8f984',
  nonCooperativeRewardOwner:'MONSTER_TARGET',
  claimRule:'FIRST_HOSTILE_HIT_WHILE_UNCLAIMED',
  tauntRedirect:'SAME_PARTY_TARGET_ONLY',
  agitateRedirect:'SAME_PARTY_OR_UNCLAIMED_ONLY'
});

function bankPackFloor(pack){
  const match=/^items(\d+)$/.exec(String(pack||''));
  if(!match)return null;
  const n=Number(match[1]);
  if(n>=0&&n<=7)return'bank';
  if(n>=8&&n<=23)return'bank_b';
  if(n>=24&&n<=47)return'bank_u';
  return null;
}

function bankPacksForFloor(floor){
  const ranges={bank:[0,7],bank_b:[8,23],bank_u:[24,47]};
  const range=ranges[String(floor||'')];
  if(!range)return[];
  const out=[];
  for(let i=range[0];i<=range[1];i++)out.push('items'+i);
  return out;
}

function validBankSlot(slot){
  const n=Number(slot);
  return Number.isInteger(n)&&n>=0&&n<BANK_PACK_SIZE;
}

const ITEMS=Object.freeze({
  wbasher:Object.freeze({
    type:'weapon',
    wtype:'basher',
    tier:1,
    displayName:'Wooden Basher'
  })
});

const SKILLS=Object.freeze({
  cleave:Object.freeze({
    class:'warrior',wtype:Object.freeze(['axe','scythe']),range:160,level:52,mp:720,cooldown:1200,
    hostile:true,damageType:'physical',piercesImmunity:true,procs:true
  }),
  agitate:Object.freeze({
    class:'warrior',range:320,level:68,mp:420,cooldown:2200,
    hostile:true
  }),
  hardshell:Object.freeze({
    class:'warrior',level:60,mp:480,cooldown:16000
  }),
  stomp:Object.freeze({
    class:'warrior',wtype:'basher',range:400,level:52,mp:120,cooldown:24000,duration:3200,
    hostile:true,damageType:'physical'
  }),
  blink:Object.freeze({
    class:'mage',mp:1600,cooldown:1200,targetType:'COORDINATES'
  }),
  magiport:Object.freeze({
    class:'mage',mp:900,cooldown:0,targetType:'PLAYER',global:true,requiresPveConsent:true
  }),
  burst:Object.freeze({
    class:'mage',mp:0,ratio:0.555,cooldown:6000,useRange:true,
    hostile:true,damageType:'pure',targetType:'HOSTILE_TARGET',usesEntireCurrentMp:true
  }),
  cburst:Object.freeze({
    class:'mage',level:75,mp:80,ratio:0.5,cooldown:240,list:true,useRange:true,
    hostile:true,damageType:'magical',targetType:'TARGET_MP_LIST'
  }),
  energize:Object.freeze({
    class:'mage',range:320,level:20,cooldown:4000,targetType:'PLAYER',variableMp:true
  }),
  reflection:Object.freeze({
    class:'mage',mp:540,range:320,level:60,cooldown:30000,targetType:'PLAYER',
    reflectsDamageType:'magical',physicalOnlyUseful:false,pureUseful:false
  }),
  zapperzap:Object.freeze({
    item:'zapper',slots:Object.freeze(['ring1','ring2']),mp:140,range:420,cooldown:200,damage:200,
    targetType:'HOSTILE_TARGET',hostile:true,damageType:'magical'
  }),
  taunt:Object.freeze({
    class:'warrior',range:200,mp:40,cooldown:3000,damage:1,
    targetType:'HOSTILE_TARGET',hostile:true,piercesImmunity:true
  })
});

function isTwoHandedWtype(wtype){
  return DOUBLE_HANDED_WTYPES.includes(String(wtype||''));
}

module.exports={
  OFFICIAL_SOURCE,
  BANK_PACK_SIZE,
  BANK_STORE_SCOPE,
  TRANSPORT,
  DOUBLE_HANDED_WTYPES,
  COMBAT_OWNERSHIP,
  ITEMS,
  SKILLS,
  bankPackFloor,
  bankPacksForFloor,
  validBankSlot,
  isTwoHandedWtype
};

},{}],
"core/health/ProductiveHeartbeat.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createProductiveHeartbeat({characters=[],heartbeatTimeoutMs=15000,progressTimeoutMs=60000,now=Date.now}={}){
  const rows=Object.create(null);
  for(const name of characters) rows[name]={character:name,controller_at:null,progress_at:null,last_progress:null,progress_count:0};

  function ensure(character){
    const name=String(character||'');
    if(!rows[name])rows[name]={character:name,controller_at:null,progress_at:null,last_progress:null,progress_count:0};
    return rows[name];
  }

  function controllerBeat(character,detail=null){
    const row=ensure(character);
    row.controller_at=Number(now());
    row.controller_detail=clone(detail);
    return clone(row);
  }

  function progress(character,kind,detail=null){
    const row=ensure(character);
    const at=Number(now());
    row.controller_at=at;
    row.progress_at=at;
    row.progress_count++;
    row.last_progress={kind:String(kind||'PROGRESS'),detail:clone(detail),at};
    return clone(row);
  }

  // A supervised safety HOLD is not productive gameplay even when a recent
  // real action occurred before the HOLD. Preserve that action's timestamp
  // for diagnosis; never manufacture progress when the HOLD clears.
  function setProgressHold(character,reason=null){
    const row=ensure(character);
    row.progress_hold=typeof reason==='string'&&reason.trim()?reason.trim():null;
    return{character:row.character,held:row.progress_hold!==null,reason:row.progress_hold};
  }

  function status(character){
    const row=ensure(character),t=Number(now());
    const heartbeatAge=row.controller_at==null?Infinity:t-row.controller_at;
    const progressAge=row.progress_at==null?Infinity:t-row.progress_at;
    return Object.assign(clone(row),{
      heartbeat_age_ms:heartbeatAge,
      progress_age_ms:progressAge,
      controller_fresh:heartbeatAge<=heartbeatTimeoutMs,
      progress_held:row.progress_hold!=null,
      progress_hold_reason:row.progress_hold||null,
      productive:row.progress_hold==null&&progressAge<=progressTimeoutMs
    });
  }

  function all(){return Object.keys(rows).sort().map(status);}
  return{controllerBeat,progress,setProgressHold,status,all};
}

module.exports={createProductiveHeartbeat};

},{}],
"core/health/ReadinessAudit.js":[function(require,module,exports){
'use strict';

const {validateBridge}=require('../../adapters/bridge/BridgeV3Contract');

const DEFAULT_STATE_EXPECTATIONS=Object.freeze([
  'FARM','BANK','STAND','WORLD_BOSS','EVENT','PVP_DEFENSE','GEAR_PRODUCTION'
]);

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createReadinessAudit({manifest,stateExpectations=DEFAULT_STATE_EXPECTATIONS}={}){
  if(!manifest)throw new Error('READINESS_MANIFEST_REQUIRED');

  function audit({
    character,
    role,
    moduleSupervisor,
    stateCoordinator,
    bridgeRoot=null,
    activationMode='development'
  }={}){
    const modules=moduleSupervisor&&typeof moduleSupervisor.all==='function'?moduleSupervisor.all():[];
    const moduleMap=Object.fromEntries(modules.map(row=>[row.name,row]));
    const stateStatus=stateCoordinator&&typeof stateCoordinator.status==='function'?stateCoordinator.status():{registered:[]};
    const registered=new Set(stateStatus.registered||[]);

    const states={};
    for(const name of stateExpectations){
      const executable=registered.has(name);
      let status=executable?'EXECUTABLE':'NOT_REGISTERED';
      if(!executable){
        if(name==='WORLD_BOSS'&&moduleMap.WorldBoss)status='POLICY_READY_EXECUTOR_MISSING';
        else if(name==='EVENT'&&moduleMap.Events)status='POLICY_READY_EXECUTOR_MISSING';
        else if(name==='PVP_DEFENSE'&&moduleMap.PvpDefense)status='POLICY_READY_EXECUTOR_MISSING';
        else if(name==='GEAR_PRODUCTION'&&moduleMap.GearProduction)status='POLICY_READY_EXECUTOR_MISSING';
      }
      states[name]={status,executable};
    }

    const mode=String(activationMode||'development').toLowerCase();
    const bridge=bridgeRoot?validateBridge(bridgeRoot,character,{requireRecovery:mode==='live'}):{ok:false,failures:['BRIDGE_NOT_ATTACHED'],bridge:null};
    const coreReady=modules.every(row=>row.critical!==true||['READY','ATTACHED','PAUSED'].includes(row.status));
    const disabled=modules.filter(row=>row.status==='DISABLED'||row.status==='CORE_FAILED').map(row=>({name:row.name,status:row.status,error:row.error}));
    const missingExecutors=Object.entries(states).filter(([,row])=>row.status.includes('EXECUTOR_MISSING')).map(([name])=>name);

    const liveEligible=
      manifest.production_selectable===true &&
      bridge.ok===true &&
      coreReady &&
      disabled.length===0 &&
      missingExecutors.length===0;

    return{
      ok:coreReady,
      character:String(character||''),
      role:String(role||''),
      build:manifest.build,
      production_selectable:manifest.production_selectable===true,
      activation_mode:mode,
      core_ready:coreReady,
      bridge_ready:bridge.ok===true,
      bridge_failures:bridge.failures||[],
      modules:clone(modules),
      disabled_modules:disabled,
      states,
      missing_executors:missingExecutors,
      live_eligible:liveEligible,
      verdict:liveEligible?'LIVE_ELIGIBLE':'NOT_LIVE_ELIGIBLE'
    };
  }

  return{audit};
}

module.exports={createReadinessAudit,DEFAULT_STATE_EXPECTATIONS};

},{"../../adapters/bridge/BridgeV3Contract":"adapters/bridge/BridgeV3Contract.js"}],
"core/lifecycle/LifecycleSupervisor.js":[function(require,module,exports){
'use strict';

const ORDER=Object.freeze(['BOOT','HOOKS_READY','CONTROLLER_READY','ROLE_READY','ACTIVE']);
const RANK=new Map(ORDER.map((name,index)=>[name,index]));

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createLifecycleSupervisor({build,heartbeat,now=Date.now}={}){
  if(!heartbeat||typeof heartbeat.status!=='function')throw new Error('LIFECYCLE_HEARTBEAT_REQUIRED');
  const characters=Object.create(null);

  function ensure(character){
    const name=String(character||'');
    if(!characters[name])characters[name]={
      character:name,build:String(build||'UNKNOWN'),stage:'BOOT',stage_at:Number(now()),
      hooks_ready:false,controller_ready:false,role_ready:false,active:false,last_error:null
    };
    return characters[name];
  }

  function advance(character,next,detail=null){
    const row=ensure(character);
    const target=String(next||'');
    if(!RANK.has(target))return{ok:false,error:'INVALID_LIFECYCLE_STAGE'};
    if(RANK.get(target)<RANK.get(row.stage))return{ok:false,error:'LIFECYCLE_REGRESSION_BLOCKED',stage:row.stage};
    if(RANK.get(target)>RANK.get(row.stage)+1)return{ok:false,error:'LIFECYCLE_STAGE_SKIPPED',stage:row.stage,next:target};
    row.stage=target;row.stage_at=Number(now());row.last_detail=clone(detail);
    row.hooks_ready=RANK.get(target)>=RANK.get('HOOKS_READY');
    row.controller_ready=RANK.get(target)>=RANK.get('CONTROLLER_READY');
    row.role_ready=RANK.get(target)>=RANK.get('ROLE_READY');
    row.active=target==='ACTIVE';
    return{ok:true,status:status(character)};
  }

  function fail(character,error){
    const row=ensure(character);
    row.last_error=String(error&&error.message||error||'UNKNOWN');
    row.active=false;
    return status(character);
  }

  function status(character){
    const row=ensure(character);
    const hb=heartbeat.status(character);
    return Object.assign(clone(row),{
      heartbeat:hb,
      healthy:row.stage==='ACTIVE'&&hb.controller_fresh&&hb.productive&&!row.last_error
    });
  }

  function all(){return Object.keys(characters).sort().map(status);}
  return{advance,fail,status,all,stages:ORDER};
}

module.exports={createLifecycleSupervisor,STAGES:ORDER};

},{}],
"core/modules/ModuleCatalog.js":[function(require,module,exports){
'use strict';

const {getRoleManifest}=require('../../roles/RoleManifest');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createModuleCatalog(){
  const specs=new Map();

  function register(name,spec={}){
    const key=String(name||'');
    if(!key)throw new Error('CATALOG_MODULE_NAME_REQUIRED');
    if(specs.has(key))throw new Error('CATALOG_MODULE_DUPLICATE:'+key);
    if(typeof spec.factory!=='function')throw new Error('CATALOG_FACTORY_REQUIRED:'+key);
    specs.set(key,{
      name:key,
      version:String(spec.version||'1'),
      critical:spec.critical===true,
      dependencies:[...(spec.dependencies||[])].map(String),
      resources:[...(spec.resources||[])].map(String),
      factory:spec.factory,
      available:typeof spec.available==='function'?spec.available:()=>true
    });
    return api;
  }

  function has(name){return specs.has(String(name||''));}
  function describe(name){
    const row=specs.get(String(name||''));
    return row?clone({name:row.name,version:row.version,critical:row.critical,dependencies:row.dependencies,resources:row.resources}):null;
  }

  async function buildNames(names,context={},builtIn=[]){
    const built=new Map();
    const services=context.services&&typeof context.services==='object'?context.services:{};
    context.services=services;
    const errors=[];
    const visiting=new Set();
    const builtInSet=new Set((builtIn||[]).map(String));

    async function build(name){
      const key=String(name||'');
      if(builtInSet.has(key))return{ok:true,built_in:true,name:key};
      if(built.has(key))return{ok:true,entry:built.get(key)};
      const spec=specs.get(key);
      if(!spec)return{ok:false,error:'CATALOG_MODULE_NOT_FOUND',name:key};
      if(visiting.has(key))return{ok:false,error:'CATALOG_DEPENDENCY_CYCLE',name:key};
      if(spec.available(context)!==true)return{ok:false,error:'CATALOG_MODULE_UNAVAILABLE',name:key};

      visiting.add(key);
      for(const dep of spec.dependencies){
        const result=await build(dep);
        if(!result.ok){visiting.delete(key);return{ok:false,error:'CATALOG_DEPENDENCY_FAILED',name:key,dependency:dep,cause:result};}
      }

      let made;
      try{made=await spec.factory(context);}
      catch(error){visiting.delete(key);return{ok:false,error:'CATALOG_FACTORY_FAILED',name:key,detail:String(error&&error.message||error)};}
      if(!made){visiting.delete(key);return{ok:false,error:'CATALOG_FACTORY_EMPTY',name:key};}
      const module=made.module||made;
      const service=made.service||made.instance||module;
      services[key]=service;
      const entry={
        name:key,module,
        critical:spec.critical,
        version:spec.version,
        dependencies:spec.dependencies.slice(),
        resources:spec.resources.slice()
      };
      built.set(key,entry);
      visiting.delete(key);
      return{ok:true,entry};
    }

    for(const name of names||[]){
      const result=await build(name);
      if(!result.ok)errors.push(result);
    }
    return{
      ok:errors.length===0,
      entries:Array.from(built.values()),
      services,
      errors
    };
  }

  async function buildRole(character,context={},builtIn=['CoreSupervisor']){
    const role=getRoleManifest(character);
    context.character=role.character;
    context.role=role.role;
    const requested=[...role.required,...role.optional];
    const graph=await buildNames(requested,context,builtIn);
    const requiredErrors=graph.errors.filter(row=>role.required.includes(String(row.name||'')));
    const optionalErrors=graph.errors.filter(row=>role.optional.includes(String(row.name||'')));
    return{
      ok:requiredErrors.length===0,
      character:role.character,
      role:role.role,
      entries:graph.entries,
      services:graph.services,
      required_errors:requiredErrors,
      optional_errors:optionalErrors,
      missing_optional:optionalErrors.map(row=>String(row.name||'')).filter(Boolean)
    };
  }

  function list(){return Array.from(specs.keys()).sort().map(describe);}
  const api={register,has,describe,buildNames,buildRole,list};
  return api;
}

function lifecycleFacade(instance){
  return{
    attach:async ctx=>typeof instance.attach==='function'?instance.attach(ctx):{ok:true},
    start:async ctx=>typeof instance.start==='function'?instance.start(ctx):{ok:true},
    pause:async ctx=>typeof instance.pause==='function'?instance.pause(ctx):{ok:true},
    resume:async ctx=>typeof instance.resume==='function'?instance.resume(ctx):{ok:true},
    health:async ctx=>{
      if(typeof instance.health==='function')return instance.health(ctx);
      if(typeof instance.getStatus==='function')return{ok:true,status:instance.getStatus()};
      if(typeof instance.status==='function')return{ok:true,status:instance.status()};
      return{ok:true};
    },
    snapshot:async ctx=>{
      if(typeof instance.snapshot==='function')return instance.snapshot(ctx);
      if(typeof instance.getStatus==='function')return instance.getStatus();
      if(typeof instance.status==='function')return instance.status();
      return null;
    },
    restore:async(value,ctx)=>typeof instance.restore==='function'?instance.restore(value,ctx):{ok:true,ignored:true},
    stop:async ctx=>typeof instance.stop==='function'?instance.stop(ctx):{ok:true},
    detach:async ctx=>typeof instance.detach==='function'?instance.detach(ctx):{ok:true}
  };
}

module.exports={createModuleCatalog,lifecycleFacade};

},{"../../roles/RoleManifest":"roles/RoleManifest.js"}],
"core/modules/ModuleContract.js":[function(require,module,exports){
'use strict';

const HOOKS=Object.freeze(['attach','start','pause','resume','health','snapshot','restore','stop','detach']);

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function normalizeDescriptor(input={}){
  const name=String(input.name||'').trim();
  if(!name)throw new Error('MODULE_NAME_REQUIRED');
  return Object.freeze({
    schema:1,
    name,
    version:String(input.version||'1'),
    critical:input.critical===true,
    dependencies:Object.freeze([...(input.dependencies||[])].map(String)),
    resources:Object.freeze([...(input.resources||[])].map(String))
  });
}

function adaptModule(input={}){
  const descriptor=normalizeDescriptor(input.descriptor||input);
  const source=input.module||input;
  const hooks={};
  for(const hook of HOOKS){
    hooks[hook]=typeof source[hook]==='function'?source[hook].bind(source):null;
  }
  return Object.freeze({descriptor,hooks});
}

function validateDependencies(module,available=[]){
  const set=new Set((available||[]).map(String));
  const missing=module.descriptor.dependencies.filter(name=>!set.has(name));
  return{ok:missing.length===0,missing};
}

function publicModule(module){
  return{
    descriptor:clone(module.descriptor),
    hooks:Object.fromEntries(HOOKS.map(name=>[name,!!module.hooks[name]]))
  };
}

module.exports={HOOKS,normalizeDescriptor,adaptModule,validateDependencies,publicModule};

},{}],
"core/modules/ModuleSupervisor.js":[function(require,module,exports){
'use strict';

const {adaptModule,validateDependencies,publicModule}=require('./ModuleContract');

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createModuleSupervisor({now=Date.now,onAlert=null}={}){
  const modules=Object.create(null);

  async function emit(event,row,extra={}){
    if(!onAlert)return null;
    return onAlert({
      kind:'MODULE_'+event,
      event,
      module:row.name,
      critical:row.critical,
      status:row.status,
      error:row.error,
      at:Number(now()),
      ...clone(extra)
    });
  }

  function register(name,module,{critical=false,version='1',dependencies=[],resources=[]}={}){
    const key=String(name||'');
    if(!key)throw new Error('MODULE_NAME_REQUIRED');
    if(modules[key])throw new Error('MODULE_ALREADY_REGISTERED:'+key);
    const adapted=adaptModule({
      descriptor:{name:key,version,critical,dependencies,resources},
      module
    });
    modules[key]={
      name:key,
      adapted,
      critical:adapted.descriptor.critical,
      status:'REGISTERED',
      error:null,
      updated_at:Number(now()),
      failures:0,
      attached:false,
      started:false,
      paused:false,
      last_health:null,
      last_snapshot:null
    };
    return status(key);
  }

  function requireRow(name){
    const row=modules[String(name||'')];
    if(!row)throw new Error('MODULE_NOT_FOUND:'+name);
    return row;
  }

  function availableNames(){
    return Object.values(modules)
      .filter(row=>row.status!=='DETACHED')
      .map(row=>row.name);
  }

  async function callHook(row,hook,args=[],fallback=null){
    const fn=row.adapted.hooks[hook];
    if(!fn)return fallback;
    return fn(...args);
  }

  async function fail(row,error,event='FAILURE'){
    row.failures++;
    row.error=String(error&&error.message||error);
    row.updated_at=Number(now());
    row.status=row.critical?'CORE_FAILED':'DISABLED';
    row.started=false;
    row.paused=false;
    await emit(event,row);
    return{ok:false,module:status(row.name),error:row.error,core_ready:!row.critical};
  }

  async function attach(name,context={}){
    const row=requireRow(name);
    if(row.attached)return{ok:true,module:status(row.name),already_attached:true};
    const deps=validateDependencies(row.adapted,availableNames());
    if(!deps.ok)return fail(row,new Error('MODULE_DEPENDENCY_MISSING:'+deps.missing.join(',')),'ATTACH_FAILED');
    try{
      await callHook(row,'attach',[context]);
      row.attached=true;
      row.status='ATTACHED';
      row.error=null;
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'ATTACH_FAILED');}
  }

  async function start(name,context={}){
    const row=requireRow(name);
    if(!row.attached){
      const a=await attach(name,context);
      if(!a.ok)return a;
    }
    if(row.started&&!row.paused)return{ok:true,module:status(row.name),already_started:true};
    try{
      await callHook(row,'start',[context]);
      row.started=true;
      row.paused=false;
      row.status='READY';
      row.error=null;
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'START_FAILED');}
  }

  async function pause(name,context={}){
    const row=requireRow(name);
    if(!row.started)return{ok:false,error:'MODULE_NOT_STARTED',module:status(row.name)};
    if(row.paused)return{ok:true,module:status(row.name),already_paused:true};
    try{
      await callHook(row,'pause',[context]);
      row.paused=true;
      row.status='PAUSED';
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'PAUSE_FAILED');}
  }

  async function resume(name,context={}){
    const row=requireRow(name);
    if(!row.started)return{ok:false,error:'MODULE_NOT_STARTED',module:status(row.name)};
    if(!row.paused)return{ok:true,module:status(row.name),already_running:true};
    try{
      await callHook(row,'resume',[context]);
      row.paused=false;
      row.status='READY';
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'RESUME_FAILED');}
  }

  async function health(name,context={}){
    const row=requireRow(name);
    if(row.status==='DISABLED'||row.status==='CORE_FAILED'||row.status==='DETACHED'){
      return{ok:false,status:row.status,error:row.error,module:status(row.name)};
    }
    try{
      const result=await callHook(row,'health',[context],{ok:true,status:row.status});
      const normalized=result&&typeof result==='object'?result:{ok:result!==false};
      row.last_health=clone(normalized);
      row.updated_at=Number(now());
      if(normalized.ok===false){
        return fail(row,new Error(normalized.error||normalized.code||'MODULE_HEALTH_FAILED'),'HEALTH_FAILED');
      }
      return{ok:true,health:clone(normalized),module:status(row.name)};
    }catch(error){return fail(row,error,'HEALTH_FAILED');}
  }

  async function healthAll(context={}){
    const results=[];
    for(const name of Object.keys(modules)){
      const row=modules[name];
      if(row.status==='DETACHED')continue;
      results.push({name,result:await health(name,context)});
    }
    return{
      results,
      core_ready:results.every(entry=>entry.result.ok||modules[entry.name].critical===false)
    };
  }

  async function snapshot(name,context={}){
    const row=requireRow(name);
    try{
      const value=await callHook(row,'snapshot',[context],null);
      row.last_snapshot=clone(value);
      row.updated_at=Number(now());
      return{ok:true,snapshot:clone(value),module:status(row.name)};
    }catch(error){return fail(row,error,'SNAPSHOT_FAILED');}
  }

  async function restore(name,snapshotValue,context={}){
    const row=requireRow(name);
    try{
      await callHook(row,'restore',[clone(snapshotValue),context]);
      row.last_snapshot=clone(snapshotValue);
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'RESTORE_FAILED');}
  }

  async function stop(name,context={}){
    const row=requireRow(name);
    if(!row.started)return{ok:true,module:status(row.name),already_stopped:true};
    try{
      await callHook(row,'stop',[context]);
      row.started=false;
      row.paused=false;
      row.status=row.attached?'ATTACHED':'REGISTERED';
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'STOP_FAILED');}
  }

  async function detach(name,context={}){
    const row=requireRow(name);
    if(row.started){
      const stopped=await stop(name,context);
      if(!stopped.ok)return stopped;
    }
    if(!row.attached){
      row.status='DETACHED';
      return{ok:true,module:status(row.name),already_detached:true};
    }
    try{
      await callHook(row,'detach',[context]);
      row.attached=false;
      row.status='DETACHED';
      row.updated_at=Number(now());
      return{ok:true,module:status(row.name)};
    }catch(error){return fail(row,error,'DETACH_FAILED');}
  }

  async function restart(name,context={}){
    const row=requireRow(name);
    if(row.started){
      const s=await stop(name,context);
      if(!s.ok)return s;
    }
    return start(name,context);
  }

  async function startAll(context={}){
    const results=[];
    for(const name of Object.keys(modules))results.push(await start(name,context));
    return{results,core_ready:results.every(r=>r.ok||r.module.critical===false)};
  }

  async function stopAll(context={}){
    const results=[];
    for(const name of Object.keys(modules).reverse())results.push(await stop(name,context));
    return{results};
  }

  function status(name){
    const row=modules[String(name||'')];
    if(!row)return null;
    return{
      name:row.name,
      critical:row.critical,
      status:row.status,
      error:row.error,
      updated_at:row.updated_at,
      failures:row.failures,
      attached:row.attached,
      started:row.started,
      paused:row.paused,
      last_health:clone(row.last_health),
      last_snapshot:clone(row.last_snapshot),
      contract:publicModule(row.adapted)
    };
  }

  function all(){return Object.keys(modules).sort().map(status);}

  return{
    register,attach,start,startAll,pause,resume,health,healthAll,snapshot,restore,
    stop,stopAll,detach,restart,status,all
  };
}

module.exports={createModuleSupervisor};

},{"./ModuleContract":"core/modules/ModuleContract.js"}],
"core/ownership/ResourceArbiter.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createResourceArbiter({now=Date.now}={}){
  const resources=Object.create(null);

  function acquire(resource,owner,{priority=0,allowPreempt=true}={}){
    const key=String(resource||''),who=String(owner||'');
    if(!key||!who)return{ok:false,error:'RESOURCE_AND_OWNER_REQUIRED'};
    const current=resources[key];
    if(!current||current.owner===who){
      resources[key]={resource:key,owner:who,priority:Number(priority)||0,acquired_at:current?current.acquired_at:Number(now()),updated_at:Number(now())};
      return{ok:true,lease:clone(resources[key]),preempted:null};
    }
    const requested=Number(priority)||0;
    if(allowPreempt&&requested>Number(current.priority||0)){
      const preempted=clone(current);
      resources[key]={resource:key,owner:who,priority:requested,acquired_at:Number(now()),updated_at:Number(now())};
      return{ok:true,lease:clone(resources[key]),preempted};
    }
    return{ok:false,error:'RESOURCE_OWNED',owner:clone(current)};
  }

  function release(resource,owner){
    const key=String(resource||''),who=String(owner||'');
    const current=resources[key];
    if(!current)return{ok:true,released:false};
    if(current.owner!==who)return{ok:false,error:'RESOURCE_OWNER_MISMATCH',owner:clone(current)};
    delete resources[key];
    return{ok:true,released:true};
  }

  function owner(resource){return clone(resources[String(resource||'')]||null);}
  function all(){return Object.values(resources).map(clone);}
  return{acquire,release,owner,all};
}

module.exports={createResourceArbiter};

},{}],
"core/policy/AntiKsPolicy.js":[function(require,module,exports){
'use strict';

const ANTI_KS_POLICY=Object.freeze({
  owner:'ANTI_KS',
  foreignPartyArmDistance:50,
  scope:'CONFIGURED_FARM_AREA_ONLY',
  targetScope:'CONFIGURED_FARM_MOB_ONLY'
});

function evaluateAntiKsArm({
  mainState='',
  inConfiguredFarmArea=false,
  mobType='',
  configuredFarmMob='',
  foreignPartyDistanceToFarmArea=Infinity,
  bossPriorityActive=false
}={}){
  if(bossPriorityActive===true)return{armed:false,reason:'BOSS_200_PRIORITY_ACTIVE',...ANTI_KS_POLICY};
  if(String(mainState||'')!=='FARM_MOB')return{armed:false,reason:'NOT_FARM_STATE',...ANTI_KS_POLICY};
  if(inConfiguredFarmArea!==true)return{armed:false,reason:'OUTSIDE_CONFIGURED_FARM_AREA',...ANTI_KS_POLICY};
  if(!String(configuredFarmMob||'')||String(mobType||'')!==String(configuredFarmMob||'')){
    return{armed:false,reason:'NOT_CONFIGURED_FARM_MOB',...ANTI_KS_POLICY};
  }
  const distance=Number(foreignPartyDistanceToFarmArea);
  if(!Number.isFinite(distance))return{armed:false,reason:'NO_FOREIGN_PARTY_NEAR_FARM',...ANTI_KS_POLICY};
  if(distance>ANTI_KS_POLICY.foreignPartyArmDistance){
    return{armed:false,reason:'FOREIGN_PARTY_OUTSIDE_50',distance,...ANTI_KS_POLICY};
  }
  return{armed:true,reason:'FOREIGN_PARTY_WITHIN_50_OF_FARM',distance,...ANTI_KS_POLICY};
}

// Native visible-world evidence shared by the existing Mage and Warrior
// Anti-KS planners. The presence of a foreign party within 50 pixels of
// the configured farm point is required; we never guess from party lists.
function nearestForeignPartyDistance({entities={},partyNames=[],farm=null,instance=null}={}){
 if(!farm||!farm.map||![farm.x,farm.y].every(Number.isFinite))return Infinity;
 const party=new Set(partyNames.map(String));
 let nearest=Infinity;
 for(const [id,row] of Object.entries(entities||{})){
  if(!row||row.dead||row.rip||row.visible===false||row.npc===true)continue;
  const name=String(row.name||row.id||id);
  if(party.has(name))continue;
  // Only observed real players, never NPCs or monster entities.
  if(row.type!=='character'&&!row.ctype)continue;
  if(String(row.map||'')!==String(farm.map))continue;
  if(instance!=null&&row.in!=null&&String(row.in)!==String(instance))continue;
  const x=Number(row.real_x??row.x),y=Number(row.real_y??row.y);
  if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  nearest=Math.min(nearest,Math.hypot(x-Number(farm.x),y-Number(farm.y)));
 }
 return nearest;
}

module.exports={ANTI_KS_POLICY,evaluateAntiKsArm,nearestForeignPartyDistance};

},{}],
"core/policy/CharacterWhitelist.js":[function(require,module,exports){
'use strict';

const {CHARACTER_RULES}=require('../../organs/gear/GearRegistry');

const MERCHANT='Rentaro';
const MANUAL_AUTH='GILBERT_EXPLICIT';

function normalizeCharacter(name){return String(name||'').trim();}

function parseSelector(value){
  const raw=String(value||'').trim();
  const match=raw.match(/^([A-Za-z0-9_]+)(?:\s*\+(\d+))?$/);
  if(!match)return null;
  return Object.freeze({
    raw,
    name:match[1],
    level:match[2]==null?null:Number(match[2])
  });
}

function selectorsFor(character){
  const name=normalizeCharacter(character);
  const rule=CHARACTER_RULES[name];
  if(!rule)return[];
  return [...(rule.keep||[]),...(rule.loadout||[])]
    .map(parseSelector)
    .filter(Boolean);
}

function itemMatchesSelector(item,selector){
  if(!item||!selector)return false;
  if(String(item.name||'')!==selector.name)return false;
  if(selector.level==null)return true;
  return Number(item.level||0)===selector.level;
}

function protectionFor(character,item){
  const matches=selectorsFor(character).filter(selector=>itemMatchesSelector(item,selector));
  if(!matches.length)return{protected:false,character:normalizeCharacter(character)};
  return{
    protected:true,
    character:normalizeCharacter(character),
    reasons:matches.map(x=>x.raw),
    owner:'V3_CHARACTER_WHITELIST'
  };
}

function manualAuthorization(input={}){
  return !!(
    input.mode==='MANUAL_USER_COMMAND' &&
    input.authorization===MANUAL_AUTH &&
    String(input.requestedBy||'').trim().toLowerCase()==='gilbert'
  );
}

function planTransfer(input={}){
  const sender=normalizeCharacter(input.sender);
  const receiver=normalizeCharacter(input.receiver);
  const item=input.item||null;
  if(!sender)return{ok:false,error:'TRANSFER_SENDER_REQUIRED'};
  if(!receiver)return{ok:false,error:'TRANSFER_RECEIVER_REQUIRED'};
  if(!item||!item.name)return{ok:false,error:'TRANSFER_ITEM_REQUIRED'};

  const protection=protectionFor(sender,item);
  const toMerchant=receiver===MERCHANT&&sender!==MERCHANT;

  if(toMerchant&&protection.protected&&!manualAuthorization(input)){
    return{
      ok:false,
      error:'CHARACTER_WHITELIST_PROTECTED',
      reason:'NO_AUTOMATIC_TRANSFER_TO_MERCHANT',
      sender,
      receiver,
      selector:{name:String(item.name),level:Number(item.level||0)},
      protection
    };
  }

  if(toMerchant&&protection.protected){
    return{
      ok:true,
      allowed:true,
      manualOverride:true,
      audit:'GILBERT_EXPLICIT_TRANSFER',
      sender,
      receiver,
      selector:{name:String(item.name),level:Number(item.level||0)},
      relocateBeforeExecute:true,
      verifyReceiverAfter:true,
      sourceContract:'send_item(sender inventory slot -> receiver inventory)'
    };
  }

  return{
    ok:true,
    allowed:true,
    manualOverride:false,
    sender,
    receiver,
    selector:{name:String(item.name),level:Number(item.level||0)},
    relocateBeforeExecute:true,
    verifyReceiverAfter:true,
    sourceContract:'send_item(sender inventory slot -> receiver inventory)'
  };
}

function filterAutoTransfersToMerchant(character,items=[]){
  const sender=normalizeCharacter(character);
  return (Array.isArray(items)?items:[]).map((item,index)=>{
    const planned=planTransfer({sender,receiver:MERCHANT,item});
    return{
      index,
      item,
      transfer:planned.ok===true,
      blocked:planned.ok!==true,
      reason:planned.ok?'AUTO_TRANSFER_ALLOWED':planned.error
    };
  });
}

module.exports={
  MERCHANT,
  MANUAL_AUTH,
  parseSelector,
  selectorsFor,
  itemMatchesSelector,
  protectionFor,
  manualAuthorization,
  planTransfer,
  filterAutoTransfersToMerchant
};

},{"../../organs/gear/GearRegistry":"organs/gear/GearRegistry.js"}],
"core/policy/ExchangeApprovalPolicy.js":[function(require,module,exports){
'use strict';

const APPROVED_EXCHANGE_IDS=Object.freeze([
  'armorbox',
  'basketofeggs',
  'brownenvelope',
  'bugbountybox',
  'candy0',
  'candy1',
  'candycane',
  'gem0',
  'glitch',
  'greenenvelope',
  'leather',
  'mistletoe',
  'mysterybox',
  'ornament',
  'weaponbox'
]);

const APPROVED_SET=new Set(APPROVED_EXCHANGE_IDS);

function isApprovedExchangeId(itemId){
  return APPROVED_SET.has(String(itemId||''));
}

function isExchangeableMeta(meta){
  return !!(meta&&(meta.exchangeable===true||meta.exchange===true||Number(meta.e)>0));
}

function dispositionFor(item,meta){
  const id=String(item&&item.name||'');
  if(!id)return{action:'HOLD',reason:'ITEM_ID_REQUIRED'};
  if(!isExchangeableMeta(meta))return{action:'NOT_EXCHANGEABLE',reason:'META_NOT_EXCHANGEABLE'};
  if(isApprovedExchangeId(id))return{action:'EXCHANGE_APPROVED',reason:'USER_APPROVED_EXCHANGEABLE'};
  return{action:'KEEP_MERCHANT',reason:'UNAPPROVED_EXCHANGEABLE_REVIEW_REQUIRED'};
}

module.exports={APPROVED_EXCHANGE_IDS,isApprovedExchangeId,isExchangeableMeta,dispositionFor};

},{}],
"core/recovery/BankRecoveryStore.js":[function(require,module,exports){
'use strict';

const BANK_RECOVERY_SCHEMA=1;
const VALID_STEPS=Object.freeze(['ENTER','TRAVEL','SCAN','APPLY_POLICY','ORGANIZE','VERIFY','HANDOFF','PUBLISH','EXIT','COMPLETE']);

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function validateSessionShape(session){
  if(!session||typeof session!=='object')return{ok:false,error:'BANK_RECOVERY_SESSION_REQUIRED'};
  if(session.version!==3||session.state!=='BANK')return{ok:false,error:'BANK_RECOVERY_SESSION_IDENTITY_INVALID'};
  if(!VALID_STEPS.includes(String(session.step||'')))return{ok:false,error:'BANK_RECOVERY_STEP_INVALID'};
  if(!Array.isArray(session.completed)||!session.proofs||typeof session.proofs!=='object'){
    return{ok:false,error:'BANK_RECOVERY_SESSION_SHAPE_INVALID'};
  }
  return{ok:true};
}

function createBankRecoveryStore({
  store,
  character,
  build,
  now=Date.now
}={}){
  if(!store||typeof store.get!=='function'||typeof store.set!=='function'||typeof store.delete!=='function'){
    throw new Error('BANK_RECOVERY_STORE_REQUIRED');
  }
  const who=String(character||'');
  const buildId=String(build||'');
  if(!who||!buildId)throw new Error('BANK_RECOVERY_IDENTITY_REQUIRED');

  const key='bank_recovery:'+who;
  let lastLoad=null;
  let lastSave=null;

  async function save(session,{reason='CHECKPOINT'}={}){
    const valid=validateSessionShape(session);
    if(!valid.ok)return valid;
    const record={
      schema:BANK_RECOVERY_SCHEMA,
      version:'V3',
      build:buildId,
      character:who,
      reason:String(reason||'CHECKPOINT'),
      saved_at:Number(now()),
      step:String(session.step),
      completed:[...session.completed],
      session:clone(session)
    };
    await store.set(key,record);
    lastSave=clone(record);
    return{ok:true,record:clone(record)};
  }

  async function load(){
    const record=await store.get(key);
    if(record==null){
      lastLoad={ok:true,found:false,reason:'NO_CHECKPOINT'};
      return clone(lastLoad);
    }
    if(!record||record.schema!==BANK_RECOVERY_SCHEMA||record.version!=='V3'){
      lastLoad={ok:false,found:true,error:'BANK_RECOVERY_RECORD_INVALID'};
      return clone(lastLoad);
    }
    if(String(record.character||'')!==who){
      lastLoad={ok:false,found:true,error:'BANK_RECOVERY_CHARACTER_MISMATCH'};
      return clone(lastLoad);
    }
    if(String(record.build||'')!==buildId){
      lastLoad={
        ok:false,found:true,error:'BANK_RECOVERY_BUILD_MISMATCH',
        saved_build:String(record.build||''),expected_build:buildId
      };
      return clone(lastLoad);
    }
    const valid=validateSessionShape(record.session);
    if(!valid.ok){
      lastLoad={ok:false,found:true,error:valid.error};
      return clone(lastLoad);
    }
    lastLoad={
      ok:true,found:true,
      reason:String(record.reason||'CHECKPOINT'),
      saved_at:Number(record.saved_at||0),
      step:String(record.session.step),
      completed:[...record.session.completed],
      session:clone(record.session)
    };
    return clone(lastLoad);
  }

  async function clear({reason='CLEARED'}={}){
    await store.delete(key);
    lastSave={
      schema:BANK_RECOVERY_SCHEMA,
      version:'V3',
      build:buildId,
      character:who,
      reason:String(reason||'CLEARED'),
      cleared_at:Number(now()),
      cleared:true
    };
    return{ok:true};
  }

  function status(){
    return{
      key,
      character:who,
      build:buildId,
      last_load:clone(lastLoad),
      last_save:clone(lastSave)
    };
  }

  return{key,save,load,clear,status,validateSessionShape};
}

module.exports={BANK_RECOVERY_SCHEMA,VALID_STEPS,validateSessionShape,createBankRecoveryStore};

},{}],
"core/recovery/RecoveryCoordinator.js":[function(require,module,exports){
'use strict';

const DEFAULT_LIMITS=Object.freeze({movement:3,state:2,controller:2,frame:1,browser:1});
const DEFAULT_ESCALATION=Object.freeze({
  movement:'state',
  state:'controller',
  controller:'frame',
  frame:'browser',
  browser:null
});

function createRecoveryCoordinator({limits=DEFAULT_LIMITS,escalation=DEFAULT_ESCALATION}={}){
  const attempts=Object.create(null);

  function count(scope){return Number(attempts[String(scope||'unknown')]||0);}

  function request(scope){
    const key=String(scope||'unknown');
    const limit=Number(limits[key]??1);
    const next=count(key)+1;
    attempts[key]=next;
    if(next<=limit)return{ok:true,scope:key,attempt:next,limit,action:'RECOVER_SUBSYSTEM'};

    const nextScope=escalation[key]===undefined?(key==='browser'?null:'browser'):escalation[key];
    if(nextScope){
      return{ok:false,scope:key,attempt:next,limit,action:'ESCALATE',next_scope:String(nextScope)};
    }
    return{ok:false,scope:key,attempt:next,limit,action:'STOP_AND_ALERT'};
  }

  function reset(scope){
    if(scope)delete attempts[String(scope)];
    else for(const key of Object.keys(attempts))delete attempts[key];
  }

  function status(){
    return{
      attempts:Object.assign({},attempts),
      limits:Object.assign({},limits),
      escalation:Object.assign({},escalation)
    };
  }

  return{request,reset,status};
}

module.exports={createRecoveryCoordinator,DEFAULT_LIMITS,DEFAULT_ESCALATION};

},{}],
"core/recovery/RecoveryExecutor.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createRecoveryExecutor({coordinator,handlers={}}={}){
  if(!coordinator||typeof coordinator.request!=='function')throw new Error('RECOVERY_EXECUTOR_COORDINATOR_REQUIRED');

  const registered=new Map();
  for(const [scope,handler] of Object.entries(handlers||{})){
    if(typeof handler==='function')registered.set(String(scope),handler);
  }

  function register(scope,handler){
    const key=String(scope||'');
    if(!key)throw new Error('RECOVERY_SCOPE_REQUIRED');
    if(typeof handler!=='function')throw new Error('RECOVERY_HANDLER_REQUIRED:'+key);
    registered.set(key,handler);
    return api;
  }

  function unregister(scope){
    registered.delete(String(scope||''));
    return api;
  }

  async function recover(scope,context={},chain=[]){
    const key=String(scope||'unknown');
    if(chain.length>8)return{ok:false,scope:key,action:'STOP_AND_ALERT',error:'RECOVERY_ESCALATION_LOOP',chain:chain.slice()};

    const plan=coordinator.request(key);
    const nextChain=chain.concat([{scope:key,action:plan.action,attempt:plan.attempt,limit:plan.limit}]);

    if(plan.action==='RECOVER_SUBSYSTEM'){
      const handler=registered.get(key);
      if(!handler){
        return{
          ok:false,executed:false,scope:key,action:plan.action,
          error:'RECOVERY_HANDLER_MISSING:'+key,plan:clone(plan),chain:nextChain
        };
      }
      try{
        const result=await handler({...clone(context),scope:key,plan:clone(plan)});
        const ok=!(result&&result.ok===false);
        const deferred=!!(result&&result.deferred===true);
        if(deferred)coordinator.reset(key);
        return{
          ok,executed:true,deferred,scope:key,action:plan.action,
          result:clone(result),plan:clone(plan),chain:nextChain,
          error:ok?null:String(result&&result.error||'RECOVERY_HANDLER_FAILED')
        };
      }catch(error){
        return{
          ok:false,executed:true,scope:key,action:plan.action,
          error:String(error&&error.message||error),plan:clone(plan),chain:nextChain
        };
      }
    }

    if(plan.action==='ESCALATE'&&plan.next_scope){
      return recover(plan.next_scope,{...clone(context),escalated_from:key},nextChain);
    }

    return{
      ok:false,executed:false,scope:key,action:'STOP_AND_ALERT',
      error:'RECOVERY_EXHAUSTED:'+key,plan:clone(plan),chain:nextChain
    };
  }

  function reset(scope){coordinator.reset(scope);return status();}
  function status(){
    return{
      coordinator:coordinator.status(),
      handlers:Array.from(registered.keys()).sort()
    };
  }

  const api={register,unregister,recover,reset,status};
  return api;
}

module.exports={createRecoveryExecutor};

},{}],
"core/recovery/RecoveryImageGuard.js":[function(require,module,exports){
'use strict';

function clean(value){return String(value==null?'':value).trim();}
function isSha256(value){return /^[a-f0-9]{64}$/i.test(clean(value));}
function unique(values){return [...new Set(values)];}

function createRecoveryImageGuard({manifest}={}){
  if(!manifest)throw new Error('V3_RECOVERY_MANIFEST_REQUIRED');

  function verifyImage(image={}){
    const failures=[];
    const files=Array.isArray(image.files)?image.files:[];
    const snapshotId=clean(image.snapshot_id);
    const treeHash=clean(image.tree_hash);

    if(Number(image.schema)!==1)failures.push('RECOVERY_SCHEMA_INVALID');
    if(clean(image.brain)!=='V3')failures.push('RECOVERY_BRAIN_NOT_V3');
    if(clean(image.build)!==clean(manifest.build))failures.push('RECOVERY_BUILD_MISMATCH');
    if(clean(image.root)!==clean(manifest.root))failures.push('RECOVERY_ROOT_MISMATCH');
    if(!snapshotId)failures.push('RECOVERY_SNAPSHOT_ID_MISSING');
    if(!isSha256(treeHash))failures.push('RECOVERY_TREE_HASH_INVALID');
    if(!files.length)failures.push('RECOVERY_FILE_SET_EMPTY');

    const paths=[];
    for(const row of files){
      const p=clean(row&&row.path).replace(/\\/g,'/');
      paths.push(p);
      if(!p.startsWith(clean(manifest.root)+'/'))failures.push('RECOVERY_FILE_OUTSIDE_V3:'+p);
      if(!isSha256(row&&row.sha256))failures.push('RECOVERY_FILE_HASH_INVALID:'+p);
      if(!Number.isFinite(Number(row&&row.bytes))||Number(row&&row.bytes)<1)failures.push('RECOVERY_FILE_BYTES_INVALID:'+p);
    }
    if(unique(paths).length!==paths.length)failures.push('RECOVERY_DUPLICATE_PATH');
    if(!paths.includes(clean(manifest.entrypoint)))failures.push('RECOVERY_ENTRYPOINT_MISSING');
    if(!paths.includes(clean(manifest.root)+'/bootstrap/Manifest.js'))failures.push('RECOVERY_MANIFEST_FILE_MISSING');

    return{
      ok:failures.length===0,
      failures:unique(failures),
      snapshot_id:snapshotId||null,
      tree_hash:treeHash||null,
      build:clean(image.build)||null,
      files:files.length
    };
  }

  function verifyRuntimeProof(proof={},image={}){
    const checked=verifyImage(image);
    const failures=checked.failures.slice();
    if(clean(proof.version)!=='V3')failures.push('RUNTIME_NOT_V3');
    if(clean(proof.build)!==clean(image.build))failures.push('RUNTIME_RECOVERY_BUILD_MISMATCH');
    if(clean(proof.recovery_snapshot_id)!==clean(image.snapshot_id))failures.push('RUNTIME_RECOVERY_SNAPSHOT_MISMATCH');
    if(clean(proof.recovery_tree_hash)!==clean(image.tree_hash))failures.push('RUNTIME_RECOVERY_TREE_HASH_MISMATCH');
    return{ok:failures.length===0,failures:unique(failures)};
  }

  return{verifyImage,verifyRuntimeProof};
}

module.exports={createRecoveryImageGuard};

},{}],
"core/recovery/RecoveryVerifier.js":[function(require,module,exports){
'use strict';

function text(value){return String(value==null?'':value).trim();}
function normalizeRecovery(value){
  if(!value||typeof value!=='object')return null;
  const snapshotId=text(value.snapshot_id);
  const treeHash=text(value.tree_hash);
  if(!snapshotId&&!treeHash)return null;
  return{snapshot_id:snapshotId,tree_hash:treeHash};
}
function addFailure(row,reason){
  if(!row.failures.includes(reason))row.failures.push(reason);
  row.ok=false;
}

function createRecoveryVerifier({
  requiredCharacters=['Rentaro','Hibari','Souji','Harutora'],
  expectedBuild,
  expectedRecovery=null,
  maxHeartbeatAgeMs=15000,
  maxProgressAgeMs=60000,
  maxRuntimeProofAgeMs=15000,
  now=Date.now
}={}){
  const configuredRecovery=normalizeRecovery(expectedRecovery);

  function verifyCharacter(name,input={},recovery=configuredRecovery){
    const failures=[];
    if(input.online!==true)failures.push('OFFLINE');
    if(input.runtime_proof!==true)failures.push('RUNTIME_PROOF_MISSING');
    if(input.healthy!==true)failures.push('RUNTIME_NOT_HEALTHY');

    const explicitProofAge=input.runtime_proof_age_ms;
    const proofUpdatedAt=input.runtime_proof_updated_at??input.updated_at;
    let proofAge=Infinity;
    if(explicitProofAge!==null&&explicitProofAge!==undefined&&Number.isFinite(Number(explicitProofAge))){
      proofAge=Math.max(0,Number(explicitProofAge));
    }else if(proofUpdatedAt!==null&&proofUpdatedAt!==undefined&&Number.isFinite(Number(proofUpdatedAt))){
      proofAge=Math.max(0,Number(now())-Number(proofUpdatedAt));
    }
    if(proofAge>maxRuntimeProofAgeMs)failures.push('RUNTIME_PROOF_STALE');
    if(expectedBuild&&text(input.build)!==text(expectedBuild))failures.push('WRONG_BUILD');
    if(input.frame_lease!==true)failures.push('FRAME_LEASE_MISSING');
    if(input.lifecycle!=='ACTIVE')failures.push('LIFECYCLE_NOT_ACTIVE');

    const heartbeatKnown=input.heartbeat_age_ms!==null&&input.heartbeat_age_ms!==undefined;
    const progressKnown=input.progress_age_ms!==null&&input.progress_age_ms!==undefined;
    const heartbeatAge=Number(input.heartbeat_age_ms);
    const progressAge=Number(input.progress_age_ms);
    if(input.controller_fresh!==true||!heartbeatKnown||!Number.isFinite(heartbeatAge)||heartbeatAge>maxHeartbeatAgeMs){
      failures.push('CONTROLLER_HEARTBEAT_STALE');
    }
    if(input.productive!==true||!progressKnown||!Number.isFinite(progressAge)||progressAge>maxProgressAgeMs){
      failures.push('PRODUCTIVE_PROGRESS_STALE');
    }

    if(recovery){
      if(!text(input.recovery_snapshot_id))failures.push('RECOVERY_SNAPSHOT_ID_MISSING');
      else if(text(input.recovery_snapshot_id)!==recovery.snapshot_id)failures.push('WRONG_RECOVERY_SNAPSHOT');
      if(!text(input.recovery_tree_hash))failures.push('RECOVERY_TREE_HASH_MISSING');
      else if(text(input.recovery_tree_hash)!==recovery.tree_hash)failures.push('WRONG_RECOVERY_TREE_HASH');
    }

    return{character:name,ok:failures.length===0,failures};
  }

  function verify(snapshot={}){
    const characters={};
    const inputs=snapshot.characters||{};
    const requestedRecovery=normalizeRecovery(snapshot.expected_recovery)||configuredRecovery;
    const ids=new Set();
    const hashes=new Set();
    let idCount=0;
    let hashCount=0;
    let anyGeneration=false;

    for(const name of requiredCharacters){
      const input=inputs[name]||{};
      const id=text(input.recovery_snapshot_id);
      const hash=text(input.recovery_tree_hash);
      if(id||hash)anyGeneration=true;
      if(id){ids.add(id);idCount++;}
      if(hash){hashes.add(hash);hashCount++;}
      characters[name]=verifyCharacter(name,input,requestedRecovery);
    }

    const failures=[];
    if(anyGeneration){
      if(ids.size>1)failures.push('MIXED_RECOVERY_SNAPSHOT');
      if(hashes.size>1)failures.push('MIXED_RECOVERY_TREE_HASH');
      if(idCount!==requiredCharacters.length)failures.push('RECOVERY_SNAPSHOT_INCOMPLETE');
      if(hashCount!==requiredCharacters.length)failures.push('RECOVERY_TREE_HASH_INCOMPLETE');
      for(const name of requiredCharacters){
        const input=inputs[name]||{};
        if(!text(input.recovery_snapshot_id))addFailure(characters[name],'RECOVERY_SNAPSHOT_ID_MISSING');
        if(!text(input.recovery_tree_hash))addFailure(characters[name],'RECOVERY_TREE_HASH_MISSING');
      }
    }

    if(requestedRecovery){
      if(!requestedRecovery.snapshot_id)failures.push('EXPECTED_RECOVERY_SNAPSHOT_MISSING');
      if(!/^[a-f0-9]{64}$/i.test(requestedRecovery.tree_hash))failures.push('EXPECTED_RECOVERY_TREE_HASH_INVALID');
    }

    const ok=failures.length===0&&requiredCharacters.every(name=>characters[name].ok);
    return{
      ok,
      chrome_only_success:false,
      required_characters:requiredCharacters.slice(),
      expected_recovery:requestedRecovery,
      failures,
      characters,
      result:ok?'RECOVERY_VERIFIED':'RECOVERY_NOT_VERIFIED'
    };
  }

  return{verify,verifyCharacter};
}

module.exports={createRecoveryVerifier};

},{}],
"core/runtime/ActivationGate.js":[function(require,module,exports){
'use strict';

const {validateBridge}=require('../../adapters/bridge/BridgeV3Contract');

function createActivationGate({manifest,staleGuard}={}){
  if(!manifest)throw new Error('ACTIVATION_MANIFEST_REQUIRED');
  if(!staleGuard||typeof staleGuard.verifyEntrypoint!=='function')throw new Error('ACTIVATION_STALE_GUARD_REQUIRED');

  function verify({
    mode='development',
    root=(typeof globalThis!=='undefined'?globalThis:{}),
    character,
    frameId,
    entrypoint=manifest.entrypoint,
    build=manifest.build
  }={}){
    const kind=String(mode||'development').toLowerCase();
    const failures=[];

    const stale=staleGuard.verifyEntrypoint({entrypoint,build});
    failures.push(...stale.failures);

    if(!String(character||''))failures.push('CHARACTER_MISSING');
    if(!String(frameId||''))failures.push('FRAME_ID_MISSING');

    let bridge=null;
    if(kind==='shadow'||kind==='live'){
      bridge=validateBridge(root,character,{requireRecovery:kind==='live'});
      if(!bridge.ok)failures.push(...bridge.failures);
      if(bridge.bridge&&bridge.bridge.frame_id&&String(bridge.bridge.frame_id)!==String(frameId||''))failures.push('FRAME_ID_MISMATCH');
    }

    // Supervised P1 is a separate user-present test mode, NOT production/live.
    // The exact approved one-tab session must have been installed by its verified CODE runner.
    if(kind==='supervised'){
      const a=root&&root.__POGI_V3_SUPERVISED_APPROVAL;
      if(!a||a.userPresent!==true||a.singleTab!==true||a.noRecovery!==true||
        a.character!==character||!/^[A-Za-z0-9_-]{12,80}$/.test(a.sessionId||'')||
        !/^[a-f0-9]{40}$/.test(a.sourceCommit||'')||
        !/^[a-f0-9]{40}$/.test(a.releaseCommit||'')||
        !root.__POGI_V3_LOADER_STATUS||root.__POGI_V3_LOADER_STATUS.ok!==true||
        root.__POGI_V3_LOADER_STATUS.installed!==true||
        root.__POGI_V3_LOADER_STATUS.role!==character||
        root.__POGI_V3_LOADER_STATUS.sourceCommit!==a.sourceCommit||
        root.__POGI_V3_LOADER_STATUS.releaseCommit!==a.releaseCommit){
        failures.push('V3_SUPERVISED_VERIFIED_SESSION_REQUIRED');
      }
    }

    if(kind==='live'&&manifest.production_selectable!==true)failures.push('V3_PRODUCTION_DISABLED');
    if(kind==='live'&&(!manifest.recovery_policy||manifest.recovery_policy.external_restore_ready!==true)){
      failures.push('V3_RECOVERY_CONTROL_PLANE_NOT_READY');
    }
    if(kind==='live'&&manifest.recovery_policy){
      if(manifest.recovery_policy.automatic_rollback_requires_production_identity!==true){
        failures.push('V3_RECOVERY_PRODUCTION_IDENTITY_GUARD_NOT_READY');
      }
      if(manifest.recovery_policy.recovery_hold_requires_expected_production!==true){
        failures.push('V3_RECOVERY_HOLD_ALIGNMENT_GUARD_NOT_READY');
      }
      if(manifest.recovery_policy.alignment_watchdog!==true){
        failures.push('V3_RECOVERY_ALIGNMENT_WATCHDOG_NOT_READY');
      }
      if(manifest.recovery_policy.promotion_requires_post_write_alignment!==true){
        failures.push('V3_RECOVERY_POST_PROMOTION_ALIGNMENT_NOT_READY');
      }
    }
    if(!['development','shadow','live','supervised'].includes(kind))failures.push('ACTIVATION_MODE_INVALID');

    return{
      ok:failures.length===0,
      mode:kind,
      failures:[...new Set(failures)],
      control_enabled:kind==='live'&&failures.length===0,
      shadow_only:kind==='shadow',
      bridge:bridge&&bridge.bridge||null,
      build:manifest.build,
      entrypoint:manifest.entrypoint
    };
  }

  return{verify};
}

module.exports={createActivationGate};

},{"../../adapters/bridge/BridgeV3Contract":"adapters/bridge/BridgeV3Contract.js"}],
"core/runtime/FrameLease.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createFrameLease({store,character,frameId,epoch,ttlMs=15000,now=Date.now}={}){
  if(!store||typeof store.get!=='function'||typeof store.set!=='function'||typeof store.delete!=='function')throw new Error('FRAME_LEASE_STORE_REQUIRED');
  const name=String(character||'');
  const frame=String(frameId||'');
  const ep=String(epoch||'');
  if(!name||!frame||!ep)throw new Error('FRAME_LEASE_IDENTITY_REQUIRED');
  const key='v3:frame-lease:'+name;

  function mine(row){
    return !!row&&row.character===name&&row.frame_id===frame&&row.epoch===ep;
  }

  async function acquire(){
    const t=Number(now());
    const current=await store.get(key);
    if(current&&!mine(current)&&Number(current.expires_at||0)>t){
      return{ok:false,error:'FRAME_ALREADY_OWNED',owner:clone(current)};
    }
    const row={schema:1,character:name,frame_id:frame,epoch:ep,acquired_at:t,renewed_at:t,expires_at:t+ttlMs};
    await store.set(key,row);
    const proof=await store.get(key);
    return mine(proof)?{ok:true,lease:clone(proof)}:{ok:false,error:'FRAME_LEASE_RACE_LOST',owner:clone(proof)};
  }

  async function renew(){
    const t=Number(now());
    const current=await store.get(key);
    if(!mine(current))return{ok:false,error:'FRAME_LEASE_LOST',owner:clone(current)};
    current.renewed_at=t;
    current.expires_at=t+ttlMs;
    await store.set(key,current);
    return{ok:true,lease:clone(current)};
  }

  async function release(){
    const current=await store.get(key);
    if(!mine(current))return{ok:false,error:'FRAME_LEASE_NOT_OWNED',owner:clone(current)};
    await store.delete(key);
    return{ok:true};
  }

  async function status(){
    const current=await store.get(key);
    const t=Number(now());
    return{
      mine:mine(current)&&Number(current.expires_at||0)>t,
      expired:!!current&&Number(current.expires_at||0)<=t,
      lease:clone(current)
    };
  }

  return{acquire,renew,release,status,key};
}

module.exports={createFrameLease};

},{}],
"core/runtime/RuntimeEpoch.js":[function(require,module,exports){
'use strict';

function safeText(value,max=160){
  return String(value==null?'':value).replace(/[^A-Za-z0-9._:-]/g,'_').slice(0,max);
}

function createRuntimeEpoch({build,character,frameId,now=Date.now,nonce}={}){
  const b=safeText(build||'UNKNOWN');
  const c=safeText(character||'UNKNOWN');
  const f=safeText(frameId||'UNKNOWN');
  const n=safeText(nonce||Math.random().toString(36).slice(2,10));
  const startedAt=Number(now());
  return Object.freeze({
    schema:1,
    build:b,
    character:c,
    frame_id:f,
    started_at:startedAt,
    epoch:[b,c,f,startedAt,n].join(':')
  });
}

function sameBuild(a,b){
  return !!a&&!!b&&String(a.build)===String(b.build);
}

function sameEpoch(a,b){
  return !!a&&!!b&&String(a.epoch)===String(b.epoch);
}

module.exports={createRuntimeEpoch,sameBuild,sameEpoch};

},{}],
"core/runtime/RuntimeProof.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createRuntimeProof({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  manifest,
  epoch,
  lifecycle,
  heartbeat,
  frameLease,
  recoveryIdentity=null,
  now=Date.now
}={}){
  if(!manifest||!epoch)throw new Error('RUNTIME_PROOF_IDENTITY_REQUIRED');
  const KEY='__POGI_V3_RUNTIME_PROOF';
  const recovery=recoveryIdentity&&typeof recoveryIdentity==='object'?{
    snapshot_id:String(recoveryIdentity.snapshot_id||'').trim()||null,
    tree_hash:String(recoveryIdentity.tree_hash||'').trim()||null
  }:null;

  async function snapshot(){
    const life=lifecycle&&typeof lifecycle.status==='function'?lifecycle.status(epoch.character):null;
    const hb=heartbeat&&typeof heartbeat.status==='function'?heartbeat.status(epoch.character):null;
    const lease=frameLease&&typeof frameLease.status==='function'?await frameLease.status():null;
    return{
      schema:1,
      version:'V3',
      build:manifest.build,
      root:manifest.root,
      entrypoint:manifest.entrypoint,
      character:epoch.character,
      frame_id:epoch.frame_id,
      epoch:epoch.epoch,
      lifecycle:life&&life.stage||'BOOT',
      healthy:!!(life&&life.healthy),
      controller_fresh:!!(hb&&hb.controller_fresh),
      heartbeat_age_ms:hb&&Number.isFinite(Number(hb.heartbeat_age_ms))?Number(hb.heartbeat_age_ms):null,
      productive:!!(hb&&hb.productive),
      progress_held:!!(hb&&hb.progress_held),
      progress_hold_reason:hb&&hb.progress_hold_reason||null,
      progress_age_ms:hb&&Number.isFinite(Number(hb.progress_age_ms))?Number(hb.progress_age_ms):null,
      progress_count:hb&&Number.isFinite(Number(hb.progress_count))?Number(hb.progress_count):0,
      last_progress:hb&&hb.last_progress?clone(hb.last_progress):null,
      frame_lease:!!(lease&&lease.mine),
      recovery_snapshot_id:recovery&&recovery.snapshot_id||null,
      recovery_tree_hash:recovery&&recovery.tree_hash||null,
      updated_at:Number(now())
    };
  }

  async function publish(){
    const proof=await snapshot();
    root[KEY]=proof;
    return clone(proof);
  }

  function clear(){
    try{delete root[KEY];}catch{root[KEY]=null;}
  }

  return{publish,snapshot,clear,key:KEY};
}

module.exports={createRuntimeProof};

},{}],
"core/runtime/StaleCodeGuard.js":[function(require,module,exports){
'use strict';

function createStaleCodeGuard({manifest,root=(typeof globalThis!=='undefined'?globalThis:{}),storage=(typeof globalThis!=='undefined'?globalThis.localStorage:null),now=Date.now}={}){
  if(!manifest)throw new Error('STALE_CODE_MANIFEST_REQUIRED');
  const BUILD_KEY='Pogi_V3_Expected_Build_v1';
  const BOOT_KEY='Pogi_V3_Last_Boot_Proof_v1';
  const RECOVERY_KEY='Pogi_V3_Recovery_Generation_v1';

  function normalizeRecovery(input){
    if(!input||typeof input!=='object')return null;
    const snapshotId=String(input.snapshot_id||'').trim();
    const treeHash=String(input.tree_hash||'').trim();
    if(!snapshotId&&!treeHash)return null;
    if(!snapshotId||!/^[a-f0-9]{64}$/i.test(treeHash))throw new Error('V3_RECOVERY_GENERATION_INVALID');
    return{snapshot_id:snapshotId,tree_hash:treeHash};
  }

  function expectedRecovery(){
    if(!storage||typeof storage.getItem!=='function')return null;
    const raw=storage.getItem(RECOVERY_KEY);
    if(!raw)return null;
    try{return normalizeRecovery(JSON.parse(raw));}
    catch{return null;}
  }

  function arm(recovery){
    if(storage&&typeof storage.setItem==='function')storage.setItem(BUILD_KEY,String(manifest.build));
    const normalized=normalizeRecovery(recovery);
    if(storage){
      if(normalized&&typeof storage.setItem==='function')storage.setItem(RECOVERY_KEY,JSON.stringify(normalized));
      else if(typeof storage.removeItem==='function')storage.removeItem(RECOVERY_KEY);
    }
    return{ok:true,build:manifest.build,recovery:normalized};
  }

  function verifyEntrypoint({entrypoint,build}={}){
    const failures=[];
    if(String(entrypoint||'')!==String(manifest.entrypoint))failures.push('WRONG_ENTRYPOINT');
    if(String(build||'')!==String(manifest.build))failures.push('WRONG_BUILD');
    if(storage&&typeof storage.getItem==='function'){
      const expected=storage.getItem(BUILD_KEY);
      if(expected&&expected!==String(manifest.build))failures.push('STALE_EXPECTED_BUILD');
    }
    return{ok:failures.length===0,failures};
  }

  function publishBootProof(epoch){
    const recovery=expectedRecovery();
    const proof={
      schema:1,version:'V3',build:manifest.build,entrypoint:manifest.entrypoint,
      character:epoch&&epoch.character||null,frame_id:epoch&&epoch.frame_id||null,
      epoch:epoch&&epoch.epoch||null,at:Number(now()),
      recovery_snapshot_id:recovery&&recovery.snapshot_id||null,
      recovery_tree_hash:recovery&&recovery.tree_hash||null
    };
    root.__POGI_V3_BOOTSTRAP_PROOF=proof;
    if(storage&&typeof storage.setItem==='function')storage.setItem(BOOT_KEY,JSON.stringify(proof));
    return proof;
  }

  function readProof(){return root.__POGI_V3_BOOTSTRAP_PROOF||null;}

  return{arm,verifyEntrypoint,publishBootProof,readProof,expectedRecovery,BUILD_KEY,BOOT_KEY,RECOVERY_KEY};
}

module.exports={createStaleCodeGuard};

},{}],
"core/safety/DeploymentSafety.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createDeploymentSafety({affectedCharacters=['Rentaro','Hibari','Souji','Harutora'],fighters=['Hibari','Souji','Harutora'],now=Date.now}={}){
  const state={
    phase:'PREPARE',
    affected:affectedCharacters.slice(),
    characters:Object.fromEntries(affectedCharacters.map(name=>[name,{safe:false,offline:false,at:null}])),
    publish_allowed:false,
    last_error:null,
    updated_at:Number(now())
  };

  function recompute(){
    state.publish_allowed=state.affected.every(name=>{
      const row=state.characters[name];
      return row&&row.safe===true&&row.offline===true;
    });
    if(state.publish_allowed&&['PREPARE','RETREATING'].includes(state.phase))state.phase='OFFLINE_SAFE';
    state.updated_at=Number(now());
  }

  function begin(){state.phase='RETREATING';state.publish_allowed=false;state.last_error=null;state.updated_at=Number(now());return snapshot();}

  function report(character,{safe,offline}={}){
    const name=String(character||'');
    if(!state.characters[name])return{ok:false,error:'CHARACTER_NOT_AFFECTED'};
    state.characters[name]={safe:safe===true,offline:offline===true,at:Number(now())};
    recompute();
    return{ok:true,state:snapshot()};
  }

  function authorizePublish(){
    recompute();
    if(!state.publish_allowed)return{ok:false,error:'DEPLOYMENT_UNSAFE',state:snapshot()};
    state.phase='UPDATE_ALLOWED';state.updated_at=Number(now());
    return{ok:true,state:snapshot()};
  }

  function beginRestart(){
    if(state.phase!=='UPDATE_ALLOWED')return{ok:false,error:'UPDATE_NOT_AUTHORIZED'};
    state.phase='RESTARTING';state.publish_allowed=false;state.updated_at=Number(now());
    return{ok:true,state:snapshot()};
  }

  function beginVerify(){state.phase='VERIFYING';state.updated_at=Number(now());return snapshot();}

  function finish(result){
    if(result&&result.ok){state.phase='PASS';state.last_error=null;}
    else{state.phase='FAIL';state.last_error='RECOVERY_VERIFICATION_FAILED';}
    state.updated_at=Number(now());
    return snapshot();
  }

  function snapshot(){return clone(state);}
  return{begin,report,authorizePublish,beginRestart,beginVerify,finish,snapshot,fighters:fighters.slice()};
}

module.exports={createDeploymentSafety};

},{}],
"core/scheduler/RoleDecider.js":[function(require,module,exports){
'use strict';

function createRoleDecider({character,role,services={}}={}){
  const who=String(character||''),kind=String(role||'');

  return async function decide(ctx={}){
    // Rentaro is the scout, not a boss attacker. New sightings still publish
    // while the current boss mission is active, allowing a pending boss queue.
    if(kind==='MERCHANT'){
      try{services.BossScout?.observe?.(ctx);}catch(_){}
    }
    const worldBossService=services.WorldBoss;
    const bossGate=worldBossService&&typeof worldBossService.shouldActivate==='function'
      ?worldBossService.shouldActivate(ctx)
      :null;

    // Physical item/gold delivery runs only when Rentaro is truly nearby;
    // keep boss and emergency combat decision latency independent of sends.
    if(bossGate?.active!==true&&ctx.emergency!==true&&ctx.retreat!==true&&ctx.recovery!==true&&ctx.pvpDefense!==true){
      try{
        const handoff=services.MerchantHandoff?.tick?.();
        if(handoff&&typeof handoff.catch==='function')handoff.catch(()=>{});
      }catch(_){}
    }
    if(ctx.emergency===true)return{state:'EMERGENCY',reason:'EMERGENCY'};
    if(ctx.retreat===true)return{state:'RETREAT',reason:'RETREAT'};
    if(ctx.recovery===true)return{state:'RECOVERY',reason:'RECOVERY'};
    if(ctx.pvpDefense===true)return{state:'PVP_DEFENSE',reason:'PVP_DEFENSE'};
    if(kind!=='MERCHANT'&&(bossGate?bossGate.active===true:(ctx.worldBoss===true||(ctx.worldBoss&&typeof ctx.worldBoss==='object')))){
      return{state:'WORLD_BOSS',reason:bossGate&&bossGate.active===true?'SHARED_BOSS_MISSION':'WORLD_BOSS',detail:bossGate||null};
    }
    if(ctx.event===true&&kind!=='MERCHANT')return{state:'EVENT',reason:'EVENT'};

    if(kind==='MERCHANT'){
      const controller=services.MerchantController;
      if(controller&&typeof controller.choose==='function'){
        const result=await controller.choose(ctx);
        if(result&&result.selected)return{state:result.selected.state,reason:result.selected.reason,detail:result};
      }
      return{state:'IDLE',reason:'MERCHANT_NO_CONTROLLER'};
    }

    if(['MAGE','WARRIOR','PRIEST'].includes(kind)){
      return{state:'FARM',reason:'DEFAULT_FIGHTER_FARM',character:who};
    }

    return{state:'IDLE',reason:'UNKNOWN_ROLE'};
  };
}

module.exports={createRoleDecider};

},{}],
"core/scheduler/RuntimeScheduler.js":[function(require,module,exports){
'use strict';

const {canPreempt}=require('../../states/StateRegistry');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createRuntimeScheduler({
  coordinator,
  decide,
  alertManager=null,
  tickGate=null,
  onTickGate=null,
  now=Date.now,
  intervalMs=500,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval
}={}){
  if(!coordinator||typeof coordinator.tick!=='function'||typeof coordinator.request!=='function')throw new Error('RUNTIME_SCHEDULER_COORDINATOR_REQUIRED');
  if(typeof decide!=='function')throw new Error('RUNTIME_SCHEDULER_DECIDER_REQUIRED');

  let timer=null,running=false,ticking=false,tickCount=0,lastDecision=null,lastError=null;

  async function alert(event,detail){
    if(!alertManager||typeof alertManager.publish!=='function')return null;
    return alertManager.publish({
      id:'v3-scheduler:'+event+':'+String(Number(now())),
      kind:'V3_RUNTIME_SCHEDULER',
      event,
      severity:'error',
      title:'V3 scheduler '+event,
      body:String(detail||event),
      requires_action:true,
      at:Number(now())
    });
  }

  async function tick(ctx={}){
    if(ticking)return{ok:false,error:'SCHEDULER_TICK_BUSY'};
    ticking=true;
    try{
      tickCount++;
      // The supervised P1 gate is evaluated before role decisions, state
      // transitions, or handler ticks. A held tick has NO game side effects.
      if(tickGate){
        let admission;
        try{admission=await tickGate(ctx);}
        catch(error){
          const reason='P1_TICK_GATE_CHECK_FAILED';
          if(typeof onTickGate==='function')onTickGate({allow:false,reason});
          lastDecision={state:'HOLD',reason};
          lastError=reason;
          return{ok:true,held:true,reason,progress:false,tick:tickCount};
        }
        if(typeof onTickGate==='function')onTickGate({
          allow:admission?.allow===true,
          reason:admission?.allow===true?null:String(admission?.reason||'TICK_GATE_DENIED')
        });
        if(!admission||admission.allow!==true){
          lastDecision={state:'HOLD',reason:String(admission?.reason||'TICK_GATE_DENIED')};
          lastError=null;
          return{ok:true,held:true,reason:lastDecision.reason,progress:false,tick:tickCount};
        }
      }
      const before=coordinator.status();
      if(before.paused===true){
        const pausedResult=await coordinator.tick(ctx);
        lastError=null;
        return{ok:true,decision:null,state_result:pausedResult,tick:tickCount,paused:true};
      }

      const decision=await decide(ctx);
      lastDecision=clone(decision||null);

      if(decision&&decision.state){
        const desired=String(decision.state);
        const current=coordinator.status().current;
        if(current!==desired){
          if(current==='IDLE'||canPreempt(current,desired)){
            const requested=await coordinator.request(desired,{reason:String(decision.reason||'SCHEDULER')});
            if(!requested.ok&&requested.error!=='STATE_PRIORITY_BLOCKED'){
              lastError=requested.error;
              await alert('STATE_REQUEST_FAILED',requested.error+': '+desired);
              return{ok:false,error:requested.error,decision:clone(decision)};
            }
          }
        }
      }

      const result=await coordinator.tick(ctx);
      if(result&&result.ok===false){
        lastError=result.error||'STATE_TICK_FAILED';
        await alert('STATE_TICK_FAILED',lastError);
        return{ok:false,error:lastError,decision:clone(decision),state_result:result};
      }
      lastError=null;
      return{ok:true,decision:clone(decision),state_result:result,tick:tickCount};
    }catch(error){
      lastError=String(error&&error.message||error);
      await alert('SCHEDULER_ERROR',lastError);
      return{ok:false,error:lastError};
    }finally{ticking=false;}
  }

  function start(){
    if(running)return{ok:true,already_running:true};
    running=true;
    timer=setIntervalFn(()=>{void tick();},Math.max(100,Number(intervalMs)||500));
    return{ok:true,interval_ms:Math.max(100,Number(intervalMs)||500)};
  }
  function stop(){if(timer)clearIntervalFn(timer);timer=null;running=false;return{ok:true};}
  function status(){return{running,tick_count:tickCount,last_decision:clone(lastDecision),last_error:lastError};}
  return{tick,start,stop,status};
}

module.exports={createRuntimeScheduler};

},{"../../states/StateRegistry":"states/StateRegistry.js"}],
"core/state/StateCoordinator.js":[function(require,module,exports){
'use strict';

const {getState,isMainState,canPreempt}=require('../../states/StateRegistry');

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createStateCoordinator({stateEngine,onProgress=null,now=Date.now}={}){
  if(!stateEngine||typeof stateEngine.transitionMain!=='function'||typeof stateEngine.getStatus!=='function'){
    throw new Error('STATE_COORDINATOR_ENGINE_REQUIRED');
  }
  const handlers=new Map();
  const stack=[];
  let paused=false;
  let pauseReason=null;
  let pausePending=null;

  function register(name,handler={}){
    const key=String(name||'');
    if(!getState(key))throw new Error('STATE_NOT_REGISTERED:'+key);
    if(!isMainState(key))throw new Error('STATE_NOT_MAIN:'+key);
    if(handlers.has(key))throw new Error('STATE_HANDLER_DUPLICATE:'+key);
    handlers.set(key,handler||{});
    return api;
  }

  function current(){return String(stateEngine.getStatus().main||'IDLE');}
  function handler(name){return handlers.get(String(name||''))||null;}

  async function call(name,hook,...args){
    const h=handler(name);
    if(!h||typeof h[hook]!=='function')return null;
    return h[hook](...args);
  }

  async function snapshotHandler(name){
    const value=await call(name,'snapshot');
    return clone(value);
  }

  async function request(next,{reason='REQUESTED',allowSame=true}={}){
    const target=String(next||'');
    if(!getState(target))return{ok:false,error:'STATE_UNKNOWN',state:target};
    if(!isMainState(target))return{ok:false,error:'STATE_NOT_MAIN',state:target};
    if(paused)return{ok:false,error:'STATE_COORDINATOR_PAUSED'};
    const from=current();
    if(from===target)return allowSame?{ok:true,no_change:true,state:from}:{ok:false,error:'STATE_ALREADY_ACTIVE'};
    if(target!=='IDLE'&&!handler(target))return{ok:false,error:'STATE_HANDLER_UNAVAILABLE',state:target};

    if(from!=='IDLE'&&!canPreempt(from,target)){
      return{ok:false,error:'STATE_PRIORITY_BLOCKED',current:from,requested:target};
    }

    if(from!=='IDLE'){
      const saved=await snapshotHandler(from);
      await call(from,'pause',{reason:'PREEMPTED_BY_'+target});
      stack.push({state:from,reason:stateEngine.getStatus().mainReason,snapshot:saved,preempted_at:Number(now())});
    }

    const moved=stateEngine.transitionMain(target,{reason,resetSides:false});
    if(!moved.ok)return moved;
    await call(target,'start',{reason,from});
    return{ok:true,from,to:target,stack_depth:stack.length};
  }

  async function replace(next,{reason='REPLACED'}={}){
    const target=String(next||'');
    if(!getState(target))return{ok:false,error:'STATE_UNKNOWN',state:target};
    if(!isMainState(target))return{ok:false,error:'STATE_NOT_MAIN',state:target};
    if(paused)return{ok:false,error:'STATE_COORDINATOR_PAUSED'};
    if(target!=='IDLE'&&!handler(target))return{ok:false,error:'STATE_HANDLER_UNAVAILABLE',state:target};
    const from=current();
    if(from===target)return{ok:true,no_change:true,state:from};
    if(from!=='IDLE'&&!canPreempt(from,target)){
      return{ok:false,error:'STATE_PRIORITY_BLOCKED',current:from,requested:target};
    }
    if(from!=='IDLE')await call(from,'stop',{reason:'REPLACED_BY_'+target});
    stack.length=0;
    const moved=stateEngine.transitionMain(target,{reason,resetSides:false});
    if(!moved.ok)return moved;
    if(target!=='IDLE')await call(target,'start',{reason,from});
    return{ok:true,from,to:target};
  }

  async function applyPendingPause(completedState){
    if(!pausePending||String(pausePending.wait_for_state||'')!==String(completedState||''))return null;
    const pending=clone(pausePending);
    pausePending=null;
    const result=await pauseAll(pending.reason||'GRACEFUL_PAUSE');
    return{...result,graceful:true,completed_state:String(completedState||''),requested_at:pending.requested_at};
  }

  async function complete(name,{reason='COMPLETE'}={}){
    const key=String(name||'');
    const active=current();
    if(active!==key)return{ok:false,error:'STATE_NOT_ACTIVE',active,requested:key};
    await call(active,'stop',{reason});
    const previous=stack.pop()||null;
    let resumedState='IDLE';
    if(!previous){
      stateEngine.transitionMain('IDLE',{reason:'RESUME_FALLBACK_IDLE',resetSides:false});
    }else{
      stateEngine.transitionMain(previous.state,{reason:'RESUME_AFTER_'+active,resetSides:false});
      if(previous.snapshot!=null)await call(previous.state,'restore',clone(previous.snapshot),{reason:'RESUME_AFTER_'+active});
      const resumed=await call(previous.state,'resume',{reason:'RESUME_AFTER_'+active});
      if(resumed==null)await call(previous.state,'start',{reason:'RESUME_AFTER_'+active});
      resumedState=previous.state;
    }
    const gracefulPause=await applyPendingPause(active);
    return{
      ok:true,
      completed:active,
      resumed:resumedState,
      stack_depth:stack.length,
      graceful_pause:gracefulPause
    };
  }

  async function tick(ctx={}){
    if(paused)return{ok:true,progress:false,reason:'COORDINATOR_PAUSED'};
    const active=current();
    if(active==='IDLE')return{ok:true,progress:false,state:'IDLE'};
    const h=handler(active);
    if(!h)return{ok:false,error:'STATE_HANDLER_UNAVAILABLE',state:active};

    let result;
    if(typeof h.tick==='function')result=await h.tick(ctx);
    else if(typeof h.run==='function')result=await h.run(ctx);
    else if(typeof h.health==='function'){
      const health=await h.health(ctx);
      if(!health||health.ok===false)return{ok:false,error:health&&health.error||'STATE_HEALTH_FAILED',state:active,health};
      result={ok:true,progress:true,kind:active+'_HEALTH_PROOF',state:active,health};
    }else return{ok:true,progress:false,state:active,reason:'NO_TICK_HANDLER'};

    if(result&&result.progress===true&&onProgress){
      await onProgress(result.kind||active,result);
    }
    if(result&&result.complete===true){
      const done=await complete(active,{reason:result.reason||'STATE_COMPLETE'});
      return{...result,completion:done};
    }
    return result||{ok:true,progress:false,state:active};
  }

  async function recoverCurrent({reason='RECOVERY'}={}){
    if(paused)return{ok:false,error:'STATE_COORDINATOR_PAUSED'};
    const active=current();
    if(active==='IDLE')return{ok:true,no_change:true,state:'IDLE'};
    const h=handler(active);
    if(!h)return{ok:false,error:'STATE_HANDLER_UNAVAILABLE',state:active};

    const saved=await snapshotHandler(active);
    await call(active,'stop',{reason:'RECOVER_'+String(reason)});
    const moved=stateEngine.transitionMain(active,{reason:'RECOVER_'+String(reason),resetSides:false});
    if(!moved.ok)return moved;
    if(saved!=null)await call(active,'restore',clone(saved),{reason:'RECOVER_'+String(reason)});
    const recovered=await call(active,'recover',clone(saved),{reason:'RECOVER_'+String(reason),from:active});
    if(recovered&&recovered.ok===false){
      return{ok:false,error:recovered.error||'STATE_RECOVERY_HOOK_FAILED',state:active,recovery:recovered};
    }
    return{ok:true,state:active,recovered:true,snapshot_restored:saved!=null,recovery_hook:recovered!=null,stack_depth:stack.length};
  }

  async function pauseAll(reason='PAUSED'){
    if(paused)return{ok:false,error:'ALREADY_PAUSED'};
    pausePending=null;
    paused=true;pauseReason=String(reason);
    const active=current();
    if(active!=='IDLE')await call(active,'pause',{reason:pauseReason});
    const enginePause=stateEngine.pause(pauseReason);
    return{ok:enginePause.ok,state:active,reason:pauseReason};
  }

  async function requestPause(reason='MANUAL_PAUSE',{finishBank=true}={}){
    if(paused)return{ok:true,already_paused:true,state:current(),reason:pauseReason};
    if(pausePending)return{ok:true,pending:true,...clone(pausePending)};
    const active=current();
    if(finishBank!==false&&active==='BANK'){
      pausePending={
        reason:String(reason||'MANUAL_PAUSE'),
        wait_for_state:'BANK',
        requested_at:Number(now())
      };
      return{ok:true,pending:true,state:active,...clone(pausePending)};
    }
    return pauseAll(reason);
  }

  async function resumeAll(){
    if(!paused&&pausePending){
      const pending=clone(pausePending);
      pausePending=null;
      return{ok:true,cancelled_pending:true,pending};
    }
    if(!paused)return{ok:false,error:'NOT_PAUSED'};
    const engineResume=stateEngine.resume();
    if(!engineResume.ok)return engineResume;
    paused=false;
    const active=current();
    const reason=pauseReason;
    pauseReason=null;
    if(active!=='IDLE')await call(active,'resume',{reason:'RESUME_'+String(reason||'PAUSE')});
    return{ok:true,state:active};
  }

  function status(){
    return{
      current:current(),
      paused,
      pause_reason:pauseReason,
      pause_pending:clone(pausePending),
      stack:clone(stack),
      registered:Array.from(handlers.keys()).sort()
    };
  }

  const api={register,request,replace,complete,tick,recoverCurrent,pauseAll,requestPause,resumeAll,status};
  return api;
}

module.exports={createStateCoordinator};

},{"../../states/StateRegistry":"states/StateRegistry.js"}],
"core/state/StateEngine.js":[function(require,module,exports){
'use strict';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function createStateEngine({main='IDLE',now=Date.now}={}){
  const state={
    main:String(main),
    mainReason:'INITIAL',
    sides:{},
    paused:false,
    pauseReason:null,
    pauseSnapshot:null,
    revision:1,
    updatedAt:Number(now())
  };

  const snapshot=()=>clone(state);
  const bump=()=>{state.revision++;state.updatedAt=Number(now());};

  function transitionMain(next,{reason='UNSPECIFIED',resetSides=true}={}){
    if(state.paused)return{ok:false,error:'STATE_PAUSED'};
    next=String(next||'');
    if(!next)return{ok:false,error:'MAIN_STATE_REQUIRED'};
    state.main=next;
    state.mainReason=String(reason);
    if(resetSides)state.sides={};
    bump();
    return{ok:true,state:snapshot()};
  }

  function setSide(name,value,{owner,reason='UNSPECIFIED'}={}){
    if(state.paused)return{ok:false,error:'STATE_PAUSED'};
    name=String(name||'');
    owner=String(owner||'');
    if(!name)return{ok:false,error:'SIDE_STATE_REQUIRED'};
    if(!owner)return{ok:false,error:'SIDE_OWNER_REQUIRED'};
    if(state.sides[name]&&state.sides[name].owner!==owner){
      return{ok:false,error:'SIDE_OWNER_MISMATCH',owner:state.sides[name].owner};
    }
    state.sides[name]={value:clone(value),owner,reason:String(reason),at:Number(now())};
    bump();
    return{ok:true,side:clone(state.sides[name])};
  }

  function clearSide(name,{owner}={}){
    if(state.paused)return{ok:false,error:'STATE_PAUSED'};
    name=String(name||'');
    if(!state.sides[name])return{ok:true,removed:false};
    if(owner&&state.sides[name].owner!==String(owner))return{ok:false,error:'SIDE_OWNER_MISMATCH',owner:state.sides[name].owner};
    delete state.sides[name];
    bump();
    return{ok:true,removed:true};
  }

  function pause(reason='PAUSED'){
    if(state.paused)return{ok:false,error:'ALREADY_PAUSED'};
    state.pauseSnapshot={main:state.main,mainReason:state.mainReason,sides:clone(state.sides)};
    state.paused=true;
    state.pauseReason=String(reason);
    bump();
    return{ok:true,state:snapshot()};
  }

  function resume(){
    if(!state.paused||!state.pauseSnapshot)return{ok:false,error:'NOT_PAUSED'};
    const saved=clone(state.pauseSnapshot);
    state.main=saved.main;
    state.mainReason=saved.mainReason;
    state.sides=saved.sides;
    state.paused=false;
    state.pauseReason=null;
    state.pauseSnapshot=null;
    bump();
    return{ok:true,state:snapshot()};
  }

  return{transitionMain,setSide,clearSide,pause,resume,getStatus:snapshot};
}

module.exports={createStateEngine};

},{}],
"core/supervision/CoreSupervisor.js":[function(require,module,exports){
'use strict';

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}

function createCoreSupervisor({
  character,
  lease,
  heartbeat,
  lifecycle,
  moduleSupervisor,
  proof,
  recovery,
  recoveryExecutor=null,
  alertManager=null,
  now=Date.now,
  intervalMs=5000,
  recoveryRetryMs=15000,
  setIntervalFn=setInterval,
  clearIntervalFn=clearInterval
}={}){
  const name=String(character||'');
  if(!name)throw new Error('CORE_SUPERVISOR_CHARACTER_REQUIRED');
  if(!lease||typeof lease.renew!=='function')throw new Error('CORE_SUPERVISOR_LEASE_REQUIRED');
  if(!heartbeat||typeof heartbeat.controllerBeat!=='function')throw new Error('CORE_SUPERVISOR_HEARTBEAT_REQUIRED');
  if(!lifecycle||typeof lifecycle.status!=='function')throw new Error('CORE_SUPERVISOR_LIFECYCLE_REQUIRED');
  if(!proof||typeof proof.publish!=='function')throw new Error('CORE_SUPERVISOR_PROOF_REQUIRED');

  let timer=null;
  let running=false;
  let ticking=false;
  let tickCount=0;
  let lastTickAt=null;
  let lastError=null;
  let productivityAlerted=false;
  let lastRecoveryAt=null;
  let lastRecoveryResult=null;
  let gameplayHold=null;
  let gameplayHoldAlerted=null;

  // An explicit, supervised-only admission HOLD is not productive gameplay.
  // Keep the heartbeat unhealthy and continue lease/health/proof checks, but
  // never treat the deliberate safety hold as a reason to retry Recovery.
  function setGameplayHold(reason=null){
    const next=typeof reason==='string'&&reason.trim()?reason.trim():null;
    if(next!==gameplayHold)gameplayHoldAlerted=null;
    gameplayHold=next;
    // Propagate the HOLD to the heartbeat used by lifecycle and runtime
    // proof publication, not just the local supervisor display field.
    if(typeof heartbeat.setProgressHold==='function'){
      heartbeat.setProgressHold(name,gameplayHold);
    }
    return{held:gameplayHold!==null,reason:gameplayHold};
  }

  async function alert(event,severity,detail,data=null){
    if(!alertManager||typeof alertManager.publish!=='function')return null;
    return alertManager.publish({
      id:'v3-core:'+name+':'+event+':'+String(Number(now())),
      kind:'V3_CORE_SUPERVISION',
      event,
      severity,
      title:'V3 Core '+event,
      body:name+' | '+String(detail||event),
      character:name,
      requires_action:severity==='error',
      at:Number(now()),
      data:clone(data)
    });
  }

  function recoveryDue(){
    if(lastRecoveryAt==null)return true;
    return Number(now())-Number(lastRecoveryAt)>=Math.max(1000,Number(recoveryRetryMs)||15000);
  }

  async function runProgressRecovery(hb,life){
    let result=null;
    if(recoveryExecutor&&typeof recoveryExecutor.recover==='function'){
      result=await recoveryExecutor.recover('state',{
        reason:'PRODUCTIVE_PROGRESS_STALE',
        character:name,
        heartbeat:clone(hb),
        lifecycle:clone(life)
      });
    }else{
      const plan=recovery&&typeof recovery.request==='function'?recovery.request('state'):null;
      result=plan?{ok:plan.ok,executed:false,scope:'state',action:plan.action,plan}:null;
    }
    lastRecoveryAt=Number(now());
    lastRecoveryResult=clone(result);
    return result;
  }

  async function tick(){
    if(ticking)return{ok:false,error:'SUPERVISOR_TICK_BUSY'};
    ticking=true;
    try{
      tickCount++;
      lastTickAt=Number(now());

      const renewed=await lease.renew();
      if(!renewed.ok){
        lastError=renewed.error||'FRAME_LEASE_LOST';
        lifecycle.fail(name,lastError);
        await alert('FRAME_LEASE_LOST','error',lastError);
        await proof.publish();
        return{ok:false,error:lastError,action:'FAIL_CLOSED'};
      }

      heartbeat.controllerBeat(name,{source:'CoreSupervisor',tick:tickCount});

      let modules=null;
      if(moduleSupervisor&&typeof moduleSupervisor.healthAll==='function'){
        modules=await moduleSupervisor.healthAll({character:name});
      }

      const life=lifecycle.status(name);
      const hb=heartbeat.status(name);

      if(gameplayHold!==null){
        // Publish at most one actionable alert per hold reason. In
        // particular, no 15s STOP_AND_ALERT recovery-exhausted loops.
        if(gameplayHoldAlerted!==gameplayHold){
          await alert('SUPERVISED_GAMEPLAY_HELD','error',gameplayHold,
            {reason:gameplayHold,productive:false,recovery_disabled:true});
          gameplayHoldAlerted=gameplayHold;
        }
        productivityAlerted=false;
        lastRecoveryAt=null;
        lastRecoveryResult=null;
      }else if(life.stage==='ACTIVE'&&life.active===true&&!hb.productive){
        let rec=null;
        if(recoveryDue())rec=await runProgressRecovery(hb,life);

        if(rec&&rec.deferred===true){
          productivityAlerted=false;
        }else if(!productivityAlerted){
          productivityAlerted=true;
          await alert(
            'PRODUCTIVE_PROGRESS_STALE',
            'error',
            rec&&rec.action||'STATE_STALLED',
            {recovery:rec,heartbeat:hb,lifecycle:life}
          );
        }else if(rec&&rec.action==='STOP_AND_ALERT'){
          await alert('PRODUCTIVE_PROGRESS_RECOVERY_EXHAUSTED','error',rec.error||'RECOVERY_EXHAUSTED',{recovery:rec});
        }
      }else if(hb.productive){
        if(productivityAlerted||lastRecoveryAt!=null){
          if(recoveryExecutor&&typeof recoveryExecutor.reset==='function')recoveryExecutor.reset();
        }
        productivityAlerted=false;
        lastRecoveryAt=null;
        lastRecoveryResult=null;
      }

      const runtimeProof=await proof.publish();
      lastError=null;
      return{
        ok:true,
        tick:tickCount,
        lifecycle:life.stage,
        productive:hb.productive,
        gameplay_hold:gameplayHold,
        modules,
        recovery:lastRecoveryResult,
        runtime_proof:runtimeProof
      };
    }catch(error){
      lastError=String(error&&error.message||error);
      lifecycle.fail(name,lastError);
      await alert('SUPERVISOR_ERROR','error',lastError);
      try{await proof.publish();}catch{}
      return{ok:false,error:lastError,action:'FAIL_CLOSED'};
    }finally{
      ticking=false;
    }
  }

  function start(){
    if(running)return{ok:true,already_running:true};
    running=true;
    timer=setIntervalFn(()=>{void tick();},Math.max(1000,Number(intervalMs)||5000));
    return{ok:true,interval_ms:Math.max(1000,Number(intervalMs)||5000)};
  }

  function stop(){
    if(timer)clearIntervalFn(timer);
    timer=null;
    running=false;
    return{ok:true};
  }

  function status(){
    return{
      character:name,
      running,
      tick_count:tickCount,
      last_tick_at:lastTickAt,
      last_error:lastError,
      productivity_alerted:productivityAlerted,
      last_recovery_at:lastRecoveryAt,
      last_recovery_result:clone(lastRecoveryResult),
      gameplay_hold:gameplayHold,
      gameplay_hold_alerted:gameplayHoldAlerted
    };
  }

  return{start,stop,tick,status,setGameplayHold};
}

module.exports={createCoreSupervisor};

},{}],
"ligaments/combat/CasterActions.js":[function(require,module,exports){
'use strict';
const {planMageManaAction,planEnergize,planReflection}=require('../../characters/mage/Spells');
function dist(a,b){const p=[a?.real_x??a?.x,a?.real_y??a?.y,b?.real_x??b?.x,b?.real_y??b?.y];return p.every(v=>v!=null&&Number.isFinite(Number(v)))?Math.hypot(p[0]-p[2],p[1]-p[3]):Infinity}
function createCasterActions({root,fighter,gear,now=Date.now}={}){
 const c=()=>root?.character;
 const name=c()?.name;
 let lastBless=-Infinity;
 const stats={casts:{},gearSwaps:0,lastError:null};
 const ready=n=>fighter?.ready?.(n)===true;
 const nativeTarget=id=>root?.get_entity?.(id)||root?.get_player?.(id)||root?.parent?.entities?.[id];
 const rows=()=>root?.parent?.entities||{};
 const inRange=(e,s)=>{try{return typeof root.is_in_range==='function'?root.is_in_range(e,s)===true:dist(c(),e)<=Number(root.G?.skills?.[s]?.range||c()?.range||0)}catch{return false}};
 async function cast(skill,target=null,extraArg){
  const out=await fighter.use(skill,target,extraArg);
  if(out?.ok===true)stats.casts[skill]=(stats.casts[skill]||0)+1;
  else stats.lastError=out?.error||'CAST_REJECTED';
  return out;
 }
 async function equip(item,slot='mainhand',minLevel=0){
  if(c()?.slots?.[slot]?.name===item&&Number(c().slots[slot].level||0)>=minLevel)return true;
  if(!c()?.items?.some(i=>i?.name===item&&Number(i.level||0)>=minLevel)||!gear?.equipBest)return false;
  const r=await gear.equipBest('CASTER_GEAR',{name:item,slot,minLevel});
  if(r?.ok&&r.verified){stats.gearSwaps++;return true}return false;
 }
 async function travelGear(){if(name==='Harutora')await equip('broom')}
 async function upkeep(){
  if(!c()||c().rip)return;
  const elixir=name==='Harutora'?(c().items?.some(i=>i?.name==='pumpkinspice')?'pumpkinspice':'elixirint0'):'elixirint0';
  if(!c().slots?.elixir)await equip(elixir,'elixir');
 }
 async function tick({target,isBoss=false,partyReady=false,healingHold=()=>false}={}){
  if(!partyReady||!c()||c().rip||!fighter?.use||!target?.id)return null;
  if(name==='Souji'&&healingHold())return null;
  const e=nativeTarget(target.id)||target.entity;
  if(!e||e.dead||e.rip||!(Number(e.hp)>0))return null;
  const self=c(),mp=Number(self.mp||0),maxMp=Number(self.max_mp||0);
  const reserve=name==='Souji'?maxMp*.75:2400;
  if(name==='Souji'){
   if(healingHold())return null;
   if(self.level>=70&&!self.s?.darkblessing&&ready('darkblessing')&&now()-lastBless>=1500&&mp-Number(root.G?.skills?.darkblessing?.mp||0)>=reserve){
    lastBless=now();const out=await cast('darkblessing');return {skill:'darkblessing',...out};
   }
   if(isBoss&&!e.s?.cursed&&ready('curse')&&inRange(e,'curse')&&Number(e.hp)/Math.max(1,Number(e.max_hp||e.hp))>=.25&&mp-Number(root.G?.skills?.curse?.mp||400)>=reserve&&!healingHold()){
    const out=await cast('curse',target.id);return {skill:'curse',...out};
   }
   if(mp-Number(self.mp_cost||0)<reserve||healingHold())return {ok:true,hold:true,reason:'PRIEST_HEAL_RESERVE'};
   return null;
  }
  if(name!=='Harutora')return null;
  await equip('firestaff');
  const war=root.get_player?.('Hibari'),priest=root.get_player?.('Souji');
  const otherThreats=Object.values(rows()).some(m=>m?.type==='monster'&&!m.dead&&!m.rip&&m.target===name&&String(m.id)!==String(target.id));
  const range=Number(self.range||0);
  const curse=!!e.s?.cursed;
  const resist=Number(e.resistance||0)-Number(self.rpiercing||0);
  const mult=typeof root.damage_multiplier==='function'?Number(root.damage_multiplier(resist)):1;
  const mana=planMageManaAction({mageCombatReady:true,target:target.id,targetHp:Number(e.hp),mp,maxMp,level:self.level,isBoss,targetCursed:curse,partyAssembled:true,warriorHasAggro:e.target==='Hibari',warriorCanTauntTarget:dist(war,e)<=200,otherThreatsOnMage:otherThreats,magicalDamageMultiplier:mult,incomingDamageAmp:1,burstCooldownReady:ready('burst'),burstInRange:inRange(e,'burst'),cburstCooldownReady:ready('cburst'),cburstInRange:inRange(e,'cburst')});
  if(mana.eligible){const a=mana.selected.payload;const out=await cast(a.name,a.target,a.extraArg);return {skill:a.name,...out}}
  for(const member of [priest,war]){
   if(!member||member.rip||member.dead)continue;
   const threat=Object.values(rows()).find(m=>m?.type==='monster'&&!m.dead&&!m.rip&&m.target===member.name&&(m.damage_type==='magical'||root.G?.monsters?.[m.mtype]?.damage_type==='magical'));
   if(threat&&mp-540>=reserve){
    const p=planReflection({target:member.name,mp,level:self.level,cooldownReady:ready('reflection'),inRange:inRange(member,'reflection'),threatDamageType:'magical'});
    if(p.eligible){const out=await cast('reflection',member.name);return {skill:'reflection',...out}}
   }
   const amount=Math.min(500,Math.floor(Number(member.max_mp||0)-Number(member.mp||0)),Math.floor(mp-reserve));
   if(amount>=100&&Number(member.mp)<Number(member.max_mp)*.5){
    const p=planEnergize({target:member.name,amount,mp,level:self.level,cooldownReady:ready('energize'),inRange:inRange(member,'energize')});
    if(p.eligible){const out=await cast('energize',member.name,amount);return {skill:'energize',...out}}
   }
  }
  if(mp-Number(self.mp_cost||0)<reserve)return {ok:true,hold:true,reason:'MAGE_MANA_RESERVE'};
  return null;
 }
 return {tick,travelGear,upkeep,status:()=>JSON.parse(JSON.stringify(stats))};
}
module.exports={createCasterActions,dist};

},{"../../characters/mage/Spells":"characters/mage/Spells.js"}],
"ligaments/combat/CombatService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createCombatService({arbiter,targeting,adapter}={}){
  if(!arbiter||typeof arbiter.acquire!=='function')throw new Error('COMBAT_ARBITER_REQUIRED');
  if(!targeting||typeof targeting.authorize!=='function')throw new Error('COMBAT_TARGETING_REQUIRED');
  if(!adapter||typeof adapter.attack!=='function')throw new Error('COMBAT_ADAPTER_REQUIRED');

  function acquire(owner,{priority=0}={}){
    return arbiter.acquire('COMBAT',String(owner||''),{priority,allowPreempt:true});
  }
  function release(owner){return arbiter.release('COMBAT',String(owner||''));}
  function owner(){return arbiter.owner('COMBAT');}

  async function attack(requestOwner,targetId){
    const who=String(requestOwner||''),id=String(targetId||'');
    const current=owner();
    if(!current||current.owner!==who)return{ok:false,error:'COMBAT_NOT_OWNED',owner:current};
    const auth=targeting.authorize(who,id);
    if(!auth.ok)return{ok:false,error:auth.error,target:auth.target||null};
    const result=await adapter.attack(id);
    return{ok:!(result&&result.ok===false),result:clone(result),target:id};
  }

  return{acquire,release,owner,attack};
}

module.exports={createCombatService};

},{}],
"ligaments/combat/FighterActionExecutor.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createFighterActionExecutor({combat,gear,skills,combatOwner='FARM'}={}){
  if(!combat||typeof combat.attack!=='function')throw new Error('FIGHTER_ACTION_COMBAT_REQUIRED');
  if(!gear||typeof gear.equipLoadout!=='function')throw new Error('FIGHTER_ACTION_GEAR_REQUIRED');
  if(!skills||typeof skills.use!=='function')throw new Error('FIGHTER_ACTION_SKILLS_REQUIRED');

  async function doAttack(action,trace){
    const attacked=await combat.attack(combatOwner,String(action.target||''));
    trace.push({step:'ATTACK',target:String(action.target||''),result:clone(attacked)});
    return attacked;
  }

  async function execute(plan={}){
    const trace=[];
    const rotation=plan.rotation||null;
    const loadout=rotation&&rotation.loadout||null;
    const actions=(Array.isArray(plan.actions)?plan.actions:[]).filter(Boolean);
    const attacks=actions.filter(x=>x.kind==='ATTACK');
    const skillActions=actions.filter(x=>x.kind==='USE_SKILL');
    const cleaveHeartbeatFirst=!!(
      rotation &&
      ['CLEAVE_PREP','CLEAVE_BURST'].includes(String(rotation.phase||'')) &&
      attacks.length
    );

    // During the Cleave side of the cycle, preserve the normal-attack heartbeat
    // before spending time on a weapon transition. Sugar phases are the inverse:
    // gear first so the Lolipop can proc Sugar Rush or dual VHammers can burn it.
    if(cleaveHeartbeatFirst){
      for(const action of attacks){
        const attacked=await doAttack(action,trace);
        if(attacked&&attacked.ok===false&&['TARGET_NOT_VISIBLE','TARGET_NOT_AUTHORIZED','COMBAT_NOT_OWNED'].includes(attacked.error)){
          return{ok:false,error:attacked.error,trace};
        }
      }
    }

    if(loadout){
      const geared=await gear.equipLoadout('FIGHTER_ACTION',loadout);
      trace.push({step:'GEAR',result:clone(geared)});
      if(!geared||geared.ok!==true){
        return{ok:false,error:geared&&geared.error||'FIGHTER_GEAR_FAILED',trace};
      }
    }

    if(!cleaveHeartbeatFirst){
      for(const action of attacks){
        const attacked=await doAttack(action,trace);
        if(attacked&&attacked.ok===false&&['TARGET_NOT_VISIBLE','TARGET_NOT_AUTHORIZED','COMBAT_NOT_OWNED'].includes(attacked.error)){
          return{ok:false,error:attacked.error,trace};
        }
      }
    }

    for(const action of skillActions){
      const skill=String(action.skill||action.name||'');
      if(!skill)return{ok:false,error:'FIGHTER_SKILL_NAME_REQUIRED',trace};
      // V2 Hibari Stomp requires a +3 WBasher. The V3 Gear service
      // serializes each swap, verifies observed items, and restores the
      // rotation's Axe/Sugar/VHammer loadout before the next attack.
      if(action.loadout){
        const prepared=await gear.equipLoadout('FIGHTER_ACTION',action.loadout);
        trace.push({step:'SKILL_GEAR',skill,result:clone(prepared)});
        if(!prepared||prepared.ok!==true)
          return{ok:false,error:prepared?.error||'SKILL_GEAR_NOT_READY',skill,trace};
      }
      let used=null,restored=null;
      try{
        used=await skills.use(skill,action.target==null?null:String(action.target));
        trace.push({step:'SKILL',skill,target:action.target==null?null:String(action.target),result:clone(used)});
      }finally{
        if(action.restoreAfter===true&&loadout){
          restored=await gear.equipLoadout('FIGHTER_ACTION',loadout);
          trace.push({step:'RESTORE_GEAR',skill,result:clone(restored)});
        }
      }
      if(action.restoreAfter===true&&loadout&&(!restored||restored.ok!==true))
        return{ok:false,error:restored?.error||'RESTORE_AFTER_SKILL_FAILED',skill,trace};
      if(!used||used.ok!==true){
        return{ok:false,error:used&&used.error||'FIGHTER_SKILL_FAILED',skill,trace};
      }
    }

    return{
      ok:true,
      trace,
      attackCount:trace.filter(x=>x.step==='ATTACK'&&x.result&&x.result.ok===true).length,
      skills:trace.filter(x=>x.step==='SKILL'&&x.result&&x.result.ok===true).map(x=>x.skill),
      gearVerified:!loadout||trace.some(x=>x.step==='GEAR'&&x.result&&x.result.verified===true)
    };
  }

  return{execute};
}

module.exports={createFighterActionExecutor};

},{}],
"ligaments/crafting/RecipeIntelligence.js":[function(require,module,exports){
'use strict';

/*
 * V3 Recipe Intelligence
 *
 * Canonical recipe snapshot generated from:
 *   kaansoral/adventureland_mongodb/design/recipes.js
 * Source blob SHA: 656a57170596357e73c42c58a86fd6b4b2c901d7
 *
 * Pure data/intelligence only:
 * - no raw Adventure.Land actions
 * - no movement
 * - no bank mutation
 * - no automatic crafting
 */

const SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  path:'design/recipes.js',
  blobSha:'656a57170596357e73c42c58a86fd6b4b2c901d7'
});

const RECIPES={
  "djinncrown": {
    "output": "djinncrown",
    "outputData": null,
    "items": [
      {
        "quantity": 80,
        "item": "rimeglass",
        "level": null
      },
      {
        "quantity": 8,
        "item": "lspores",
        "level": null
      },
      {
        "quantity": 2,
        "item": "essenceoffrost",
        "level": null
      },
      {
        "quantity": 1,
        "item": "helmet",
        "level": 0
      }
    ],
    "cost": 400000,
    "quest": null
  },
  "covemantle": {
    "output": "covemantle",
    "outputData": null,
    "items": [
      {
        "quantity": 120,
        "item": "rimeglass",
        "level": null
      },
      {
        "quantity": 12,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 4,
        "item": "feather1",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cape",
        "level": 0
      }
    ],
    "cost": 400000,
    "quest": null
  },
  "stillwaterlens": {
    "output": "stillwaterlens",
    "outputData": null,
    "items": [
      {
        "quantity": 240,
        "item": "rimeglass",
        "level": null
      },
      {
        "quantity": 6,
        "item": "gemfragment",
        "level": null
      },
      {
        "quantity": 8,
        "item": "seashell",
        "level": null
      },
      {
        "quantity": 1,
        "item": "orbofint",
        "level": 0
      }
    ],
    "cost": 800000,
    "quest": null
  },
  "sixcake": {
    "output": "sixcake",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "slice_strawberry",
        "level": null
      },
      {
        "quantity": 1,
        "item": "slice_citrus",
        "level": null
      },
      {
        "quantity": 1,
        "item": "slice_honey",
        "level": null
      },
      {
        "quantity": 1,
        "item": "slice_mint",
        "level": null
      },
      {
        "quantity": 1,
        "item": "slice_blueberry",
        "level": null
      },
      {
        "quantity": 1,
        "item": "slice_nightberry",
        "level": null
      }
    ],
    "cost": 100000,
    "quest": "anniversary_baker"
  },
  "candleward": {
    "output": "candleward",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "shield",
        "level": 0
      },
      {
        "quantity": 3,
        "item": "bronzeingot",
        "level": null
      },
      {
        "quantity": 40,
        "item": "leather",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "guestbook": {
    "output": "guestbook",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "wbook0",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "ink",
        "level": null
      },
      {
        "quantity": 2,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 30,
        "item": "drapes",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "paradequiver": {
    "output": "paradequiver",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "quiver",
        "level": 0
      },
      {
        "quantity": 6,
        "item": "stormfeather",
        "level": null
      },
      {
        "quantity": 40,
        "item": "leather",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "homecominghelm": {
    "output": "homecominghelm",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "helmet1",
        "level": 0
      },
      {
        "quantity": 2,
        "item": "bronzeingot",
        "level": null
      },
      {
        "quantity": 20,
        "item": "drapes",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "homecomingcoat": {
    "output": "homecomingcoat",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "coat1",
        "level": 0
      },
      {
        "quantity": 3,
        "item": "bronzeingot",
        "level": null
      },
      {
        "quantity": 60,
        "item": "drapes",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "homecomingcape": {
    "output": "homecomingcape",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cape",
        "level": 0
      },
      {
        "quantity": 4,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 80,
        "item": "drapes",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": "anniversary_baker"
  },
  "reunionbow": {
    "output": "reunionbow",
    "outputData": null,
    "items": [
      {
        "quantity": 2,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "t2bow",
        "level": 0
      },
      {
        "quantity": 20,
        "item": "stormfeather",
        "level": null
      },
      {
        "quantity": 4,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 4000000,
    "quest": "anniversary_baker"
  },
  "keepsakependant": {
    "output": "keepsakependant",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      },
      {
        "quantity": 1,
        "item": "hpamulet",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "bronzeingot",
        "level": null
      },
      {
        "quantity": 20,
        "item": "drapes",
        "level": null
      }
    ],
    "cost": 1000000,
    "quest": "anniversary_baker"
  },
  "makeawishjar": {
    "output": "cxjar",
    "outputData": "makeawish",
    "items": [
      {
        "quantity": 1,
        "item": "sixcake",
        "level": null
      }
    ],
    "cost": 250000,
    "quest": "anniversary_baker"
  },
  "basketofeggs": {
    "output": "basketofeggs",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "egg0",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg1",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg2",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg3",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg4",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg5",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg6",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg7",
        "level": null
      },
      {
        "quantity": 1,
        "item": "egg8",
        "level": null
      }
    ],
    "cost": 100,
    "quest": null
  },
  "xbox": {
    "output": "xbox",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "x0",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x1",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x2",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x3",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x4",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x5",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x6",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x7",
        "level": null
      },
      {
        "quantity": 1,
        "item": "x8",
        "level": null
      }
    ],
    "cost": 1200,
    "quest": null
  },
  "carrotsword": {
    "output": "carrotsword",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": null
      },
      {
        "quantity": 1,
        "item": "carrot",
        "level": null
      }
    ],
    "cost": 500,
    "quest": null
  },
  "wblade": {
    "output": "wblade",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "stick",
        "level": 9
      },
      {
        "quantity": 1,
        "item": "blade",
        "level": 9
      },
      {
        "quantity": 800,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 24000000,
    "quest": null
  },
  "rod": {
    "output": "rod",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 1,
        "item": "spidersilk",
        "level": null
      }
    ],
    "cost": 100,
    "quest": null
  },
  "pickaxe": {
    "output": "pickaxe",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 1,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 1,
        "item": "blade",
        "level": null
      }
    ],
    "cost": 100,
    "quest": null
  },
  "stealthcape": {
    "output": "stealthcape",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bcape",
        "level": 7
      },
      {
        "quantity": 5,
        "item": "shadowstone",
        "level": null
      },
      {
        "quantity": 200,
        "item": "essenceofnature",
        "level": null
      },
      {
        "quantity": 1000,
        "item": "cscale",
        "level": null
      }
    ],
    "cost": 2000000,
    "quest": null
  },
  "cake": {
    "output": "cake",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "whiteegg",
        "level": null
      }
    ],
    "cost": 5,
    "quest": null
  },
  "bfangamulet": {
    "output": "bfangamulet",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bfang",
        "level": null
      },
      {
        "quantity": 5000,
        "item": "bwing",
        "level": null
      }
    ],
    "cost": 4000000,
    "quest": null
  },
  "wingedboots": {
    "output": "wingedboots",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "shoes",
        "level": null
      },
      {
        "quantity": 20,
        "item": "feather0",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "fierygloves": {
    "output": "fierygloves",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "gloves",
        "level": null
      },
      {
        "quantity": 20,
        "item": "feather0",
        "level": null
      },
      {
        "quantity": 2,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "fclaw": {
    "output": "fclaw",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "claw",
        "level": null
      },
      {
        "quantity": 2,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "fsword": {
    "output": "fsword",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": null
      },
      {
        "quantity": 2,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "froststaff": {
    "output": "froststaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 2,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "snowflakes": {
    "output": "snowflakes",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "throwingstars",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "frostbow": {
    "output": "frostbow",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      },
      {
        "quantity": 3,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 40000,
    "quest": null
  },
  "firebow": {
    "output": "firebow",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "fireblade": {
    "output": "fireblade",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "firestaff": {
    "output": "firestaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "firestars": {
    "output": "firestars",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "throwingstars",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "heartwood": {
    "output": "heartwood",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "woodensword",
        "level": 8
      },
      {
        "quantity": 1,
        "item": "nheart",
        "level": null
      }
    ],
    "cost": 120000000,
    "quest": null
  },
  "offeringx": {
    "output": "offeringx",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "offering",
        "level": null
      },
      {
        "quantity": 1200,
        "item": "essenceofnature",
        "level": null
      },
      {
        "quantity": 200,
        "item": "essenceoflife",
        "level": null
      },
      {
        "quantity": 1,
        "item": "essenceofgreed",
        "level": null
      }
    ],
    "cost": 32000000,
    "quest": null
  },
  "computer": {
    "output": "computer",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "networkcard",
        "level": null
      },
      {
        "quantity": 8,
        "item": "qubics",
        "level": null
      },
      {
        "quantity": 1,
        "item": "platinumnugget",
        "level": null
      },
      {
        "quantity": 12,
        "item": "goldnugget",
        "level": null
      },
      {
        "quantity": 100,
        "item": "electronics",
        "level": null
      }
    ],
    "cost": 120000000,
    "quest": null
  },
  "supercomputer": {
    "output": "supercomputer",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "computer",
        "level": null
      },
      {
        "quantity": 1,
        "item": "tracker",
        "level": null
      },
      {
        "quantity": 3,
        "item": "qubics",
        "level": null
      },
      {
        "quantity": 2000,
        "item": "electronics",
        "level": null
      }
    ],
    "cost": 4800000000,
    "quest": null
  },
  "dartgun": {
    "output": "dartgun",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": 9
      },
      {
        "quantity": 12,
        "item": "qubics",
        "level": null
      },
      {
        "quantity": 4,
        "item": "platinumnugget",
        "level": null
      },
      {
        "quantity": 20,
        "item": "goldnugget",
        "level": null
      }
    ],
    "cost": 32000000,
    "quest": null
  },
  "bronzeingot": {
    "output": "bronzeingot",
    "outputData": null,
    "items": [
      {
        "quantity": 16,
        "item": "bronzenugget",
        "level": null
      }
    ],
    "cost": 360000,
    "quest": null
  },
  "goldingot": {
    "output": "goldingot",
    "outputData": null,
    "items": [
      {
        "quantity": 12,
        "item": "goldnugget",
        "level": null
      }
    ],
    "cost": 3600000,
    "quest": null
  },
  "platinumingot": {
    "output": "platinumingot",
    "outputData": null,
    "items": [
      {
        "quantity": 8,
        "item": "platinumnugget",
        "level": null
      }
    ],
    "cost": 36000000,
    "quest": null
  },
  "candycanesword": {
    "output": "candycanesword",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": 7
      },
      {
        "quantity": 1,
        "item": "candycane",
        "level": null
      }
    ],
    "cost": 480000,
    "quest": null
  },
  "merry": {
    "output": "merry",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      },
      {
        "quantity": 1,
        "item": "candycane",
        "level": null
      },
      {
        "quantity": 1,
        "item": "mistletoe",
        "level": null
      }
    ],
    "cost": 480000,
    "quest": null
  },
  "harpybow": {
    "output": "harpybow",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "t2bow",
        "level": null
      },
      {
        "quantity": 100,
        "item": "feather1",
        "level": null
      }
    ],
    "cost": 1640000,
    "quest": null
  },
  "gstaff": {
    "output": "gstaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": 8
      },
      {
        "quantity": 1,
        "item": "essenceofgreed",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "pouchbow": {
    "output": "pouchbow",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      },
      {
        "quantity": 1,
        "item": "smoke",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "ornamentstaff": {
    "output": "ornamentstaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 1,
        "item": "ornament",
        "level": null
      },
      {
        "quantity": 20,
        "item": "confetti",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "charmer": {
    "output": "charmer",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "goldnugget",
        "level": null
      },
      {
        "quantity": 20,
        "item": "gem1",
        "level": null
      },
      {
        "quantity": 1,
        "item": "emptyheart",
        "level": null
      }
    ],
    "cost": 80000,
    "quest": null
  },
  "ctristone": {
    "output": "ctristone",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "strring",
        "level": null
      },
      {
        "quantity": 1,
        "item": "intring",
        "level": null
      },
      {
        "quantity": 1,
        "item": "dexring",
        "level": null
      },
      {
        "quantity": 10,
        "item": "vitscroll",
        "level": null
      }
    ],
    "cost": 20000,
    "quest": null
  },
  "cclaw": {
    "output": "cclaw",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "claw",
        "level": null
      },
      {
        "quantity": 1,
        "item": "crabclaw",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "slimestaff": {
    "output": "slimestaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 10,
        "item": "gslime",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "mushroomstaff": {
    "output": "mushroomstaff",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      },
      {
        "quantity": 2,
        "item": "smush",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "wcap": {
    "output": "wcap",
    "outputData": null,
    "items": [
      {
        "quantity": 50,
        "item": "beewings",
        "level": null
      },
      {
        "quantity": 3,
        "item": "gslime",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "wgloves": {
    "output": "wgloves",
    "outputData": null,
    "items": [
      {
        "quantity": 60,
        "item": "beewings",
        "level": null
      },
      {
        "quantity": 20,
        "item": "spores",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "vowkeepergloves": {
    "output": "vowkeepergloves",
    "outputData": null,
    "items": [
      {
        "quantity": 60,
        "item": "beewings",
        "level": null
      },
      {
        "quantity": 30,
        "item": "spores",
        "level": null
      },
      {
        "quantity": 2,
        "item": "crabclaw",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "wbreeches": {
    "output": "wbreeches",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "crabclaw",
        "level": null
      },
      {
        "quantity": 100,
        "item": "spores",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "wattire": {
    "output": "wattire",
    "outputData": null,
    "items": [
      {
        "quantity": 100,
        "item": "gslime",
        "level": null
      },
      {
        "quantity": 200,
        "item": "crabclaw",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "wshoes": {
    "output": "wshoes",
    "outputData": null,
    "items": [
      {
        "quantity": 5,
        "item": "frogt",
        "level": null
      },
      {
        "quantity": 500,
        "item": "beewings",
        "level": null
      },
      {
        "quantity": 100,
        "item": "crabclaw",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "quiver": {
    "output": "quiver",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "ascale",
        "level": null
      },
      {
        "quantity": 200,
        "item": "beewings",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "orbg": {
    "output": "orbg",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "ascale",
        "level": null
      },
      {
        "quantity": 1,
        "item": "pleather",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cscale",
        "level": null
      },
      {
        "quantity": 1,
        "item": "bfur",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "orba": {
    "output": "orba",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "orboffire",
        "level": null
      },
      {
        "quantity": 1,
        "item": "orboffrost",
        "level": null
      },
      {
        "quantity": 1,
        "item": "orbofplague",
        "level": null
      },
      {
        "quantity": 1,
        "item": "orbofresolve",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "armorring": {
    "output": "armorring",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "snakefang",
        "level": null
      },
      {
        "quantity": 1,
        "item": "lotusf",
        "level": null
      },
      {
        "quantity": 1,
        "item": "vitring",
        "level": 2
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "resistancering": {
    "output": "resistancering",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "ink",
        "level": null
      },
      {
        "quantity": 5,
        "item": "ascale",
        "level": null
      },
      {
        "quantity": 1,
        "item": "vitring",
        "level": 2
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "lbelt": {
    "output": "lbelt",
    "outputData": null,
    "items": [
      {
        "quantity": 100,
        "item": "bfur",
        "level": null
      },
      {
        "quantity": 1,
        "item": "hpbelt",
        "level": 2
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "stinger": {
    "output": "stinger",
    "outputData": null,
    "items": [
      {
        "quantity": 12,
        "item": "feather0",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "hbow": {
    "output": "hbow",
    "outputData": null,
    "items": [
      {
        "quantity": 40,
        "item": "dstones",
        "level": null
      },
      {
        "quantity": 2,
        "item": "pleather",
        "level": null
      },
      {
        "quantity": 1,
        "item": "feather0",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "mcollector"
  },
  "snakeoil": {
    "output": "snakeoil",
    "outputData": null,
    "items": [
      {
        "quantity": 40,
        "item": "dstones",
        "level": null
      },
      {
        "quantity": 9000,
        "item": "rattail",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "witch"
  },
  "elixirfires": {
    "output": "elixirfires",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "cshell",
        "level": null
      },
      {
        "quantity": 2000,
        "item": "hpot0",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "witch"
  },
  "elixirfzres": {
    "output": "elixirfzres",
    "outputData": null,
    "items": [
      {
        "quantity": 50,
        "item": "bfur",
        "level": null
      },
      {
        "quantity": 10,
        "item": "mpot0",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "witch"
  },
  "elixirpnres": {
    "output": "elixirpnres",
    "outputData": null,
    "items": [
      {
        "quantity": 500,
        "item": "bwing",
        "level": null
      },
      {
        "quantity": 1,
        "item": "hpot0",
        "level": null
      }
    ],
    "cost": 0,
    "quest": "witch"
  },
  "daggerofthedead": {
    "output": "daggerofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "wand",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "spearofthedead": {
    "output": "spearofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 2,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "spear",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "staffofthedead": {
    "output": "staffofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "staff",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "bowofthedead": {
    "output": "bowofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "swordofthedead": {
    "output": "swordofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "sword",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "bataxe": {
    "output": "bataxe",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "cryptkey",
        "level": null
      },
      {
        "quantity": 1,
        "item": "wbasher",
        "level": 7
      },
      {
        "quantity": 1,
        "item": "essenceoflife",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "maceofthedead": {
    "output": "maceofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "wbasher",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "pmaceofthedead": {
    "output": "pmaceofthedead",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mbones",
        "level": null
      },
      {
        "quantity": 1,
        "item": "pmace",
        "level": null
      }
    ],
    "cost": 24000,
    "quest": null
  },
  "weaver": {
    "output": "weaver",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": null
      },
      {
        "quantity": 30,
        "item": "cocoon",
        "level": null
      }
    ],
    "cost": 75000,
    "quest": null
  },
  "cocoon": {
    "output": "cocoon",
    "outputData": null,
    "items": [
      {
        "quantity": 1000,
        "item": "spidersilk",
        "level": null
      }
    ],
    "cost": 2500,
    "quest": null
  },
  "elixirint1": {
    "output": "elixirint1",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirint0",
        "level": null
      }
    ],
    "cost": 1000,
    "quest": null
  },
  "elixirdex1": {
    "output": "elixirdex1",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirdex0",
        "level": null
      }
    ],
    "cost": 1000,
    "quest": null
  },
  "elixirvit1": {
    "output": "elixirvit1",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirvit0",
        "level": null
      }
    ],
    "cost": 1000,
    "quest": null
  },
  "elixirstr1": {
    "output": "elixirstr1",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirstr0",
        "level": null
      }
    ],
    "cost": 1000,
    "quest": null
  },
  "elixirint2": {
    "output": "elixirint2",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirint1",
        "level": null
      }
    ],
    "cost": 2400,
    "quest": null
  },
  "elixirdex2": {
    "output": "elixirdex2",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirdex1",
        "level": null
      }
    ],
    "cost": 2400,
    "quest": null
  },
  "elixirvit2": {
    "output": "elixirvit2",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirvit1",
        "level": null
      }
    ],
    "cost": 2400,
    "quest": null
  },
  "elixirstr2": {
    "output": "elixirstr2",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "elixirstr1",
        "level": null
      }
    ],
    "cost": 2400,
    "quest": null
  },
  "threadneedle": {
    "output": "threadneedle",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": 5
      },
      {
        "quantity": 20,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 20,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "brinefang": {
    "output": "brinefang",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "blade",
        "level": 7
      },
      {
        "quantity": 120,
        "item": "reefglass",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cshell",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "molehook": {
    "output": "molehook",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "pickaxe",
        "level": 5
      },
      {
        "quantity": 40,
        "item": "gemfragment",
        "level": null
      },
      {
        "quantity": 2,
        "item": "bronzenugget",
        "level": null
      }
    ],
    "cost": 90000,
    "quest": null
  },
  "cinderwand": {
    "output": "cinderwand",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wand",
        "level": 7
      },
      {
        "quantity": 1,
        "item": "embercore",
        "level": null
      },
      {
        "quantity": 6,
        "item": "essenceoffire",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "pollenbow": {
    "output": "pollenbow",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "bow",
        "level": 7
      },
      {
        "quantity": 60,
        "item": "beewings",
        "level": null
      },
      {
        "quantity": 60,
        "item": "ashleaf",
        "level": null
      },
      {
        "quantity": 10,
        "item": "essenceofnature",
        "level": null
      }
    ],
    "cost": 90000,
    "quest": null
  },
  "rimeknuckles": {
    "output": "rimeknuckles",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "claw",
        "level": 7
      },
      {
        "quantity": 1,
        "item": "frostcore",
        "level": null
      },
      {
        "quantity": 12,
        "item": "bfur",
        "level": null
      },
      {
        "quantity": 4,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "lanternshield": {
    "output": "lanternshield",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "shield",
        "level": 6
      },
      {
        "quantity": 1,
        "item": "embercore",
        "level": null
      },
      {
        "quantity": 1,
        "item": "bronzeingot",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "turtleshard": {
    "output": "turtleshard",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wshield",
        "level": 6
      },
      {
        "quantity": 80,
        "item": "reefglass",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cshell",
        "level": null
      }
    ],
    "cost": 100000,
    "quest": null
  },
  "ratkingbuckler": {
    "output": "ratkingbuckler",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wshield",
        "level": 4
      },
      {
        "quantity": 30,
        "item": "rattail",
        "level": null
      },
      {
        "quantity": 20,
        "item": "ashleaf",
        "level": null
      },
      {
        "quantity": 1,
        "item": "bronzenugget",
        "level": null
      }
    ],
    "cost": 40000,
    "quest": null
  },
  "stormquiver": {
    "output": "stormquiver",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "alloyquiver",
        "level": 5
      },
      {
        "quantity": 80,
        "item": "stormfeather",
        "level": null
      },
      {
        "quantity": 8,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 500000,
    "quest": null
  },
  "thistlequiver": {
    "output": "thistlequiver",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "quiver",
        "level": 5
      },
      {
        "quantity": 10,
        "item": "pleather",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      },
      {
        "quantity": 5,
        "item": "essenceofnature",
        "level": null
      }
    ],
    "cost": 140000,
    "quest": null
  },
  "scribeorb": {
    "output": "scribeorb",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wbook0",
        "level": 3
      },
      {
        "quantity": 12,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 50,
        "item": "bwing",
        "level": null
      },
      {
        "quantity": 4,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 280000,
    "quest": null
  },
  "mossheart": {
    "output": "mossheart",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wbook0",
        "level": 4
      },
      {
        "quantity": 2,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 120,
        "item": "ashleaf",
        "level": null
      },
      {
        "quantity": 80,
        "item": "essenceofnature",
        "level": null
      }
    ],
    "cost": 800000,
    "quest": null
  },
  "emberseal": {
    "output": "emberseal",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "strring",
        "level": 2
      },
      {
        "quantity": 1,
        "item": "embercore",
        "level": null
      },
      {
        "quantity": 6,
        "item": "essenceoffire",
        "level": null
      }
    ],
    "cost": 300000,
    "quest": null
  },
  "glacierseal": {
    "output": "glacierseal",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "intring",
        "level": 2
      },
      {
        "quantity": 1,
        "item": "frostcore",
        "level": null
      },
      {
        "quantity": 6,
        "item": "essenceoffrost",
        "level": null
      }
    ],
    "cost": 300000,
    "quest": null
  },
  "venomband": {
    "output": "venomband",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "dexring",
        "level": 2
      },
      {
        "quantity": 1,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 12,
        "item": "poison",
        "level": null
      },
      {
        "quantity": 4,
        "item": "snakefang",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "saffronloop": {
    "output": "saffronloop",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "vitearring",
        "level": 2
      },
      {
        "quantity": 1,
        "item": "goldnugget",
        "level": null
      },
      {
        "quantity": 100,
        "item": "gemfragment",
        "level": null
      }
    ],
    "cost": 350000,
    "quest": null
  },
  "moonshardearring": {
    "output": "moonshardearring",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "intearring",
        "level": 2
      },
      {
        "quantity": 8,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 40,
        "item": "bwing",
        "level": null
      },
      {
        "quantity": 4,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "cloverstud": {
    "output": "cloverstud",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "vitearring",
        "level": 2
      },
      {
        "quantity": 1,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      },
      {
        "quantity": 40,
        "item": "spores",
        "level": null
      },
      {
        "quantity": 5,
        "item": "gslime",
        "level": null
      }
    ],
    "cost": 280000,
    "quest": null
  },
  "anchorbelt": {
    "output": "anchorbelt",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "hpbelt",
        "level": 2
      },
      {
        "quantity": 150,
        "item": "reefglass",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cshell",
        "level": null
      }
    ],
    "cost": 260000,
    "quest": null
  },
  "windbelt": {
    "output": "windbelt",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "dexbelt",
        "level": 2
      },
      {
        "quantity": 40,
        "item": "stormfeather",
        "level": null
      },
      {
        "quantity": 4,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 300000,
    "quest": null
  },
  "knifebelt": {
    "output": "knifebelt",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "dexbelt",
        "level": 2
      },
      {
        "quantity": 30,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 8,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 20,
        "item": "bwing",
        "level": null
      },
      {
        "quantity": 12,
        "item": "poison",
        "level": null
      }
    ],
    "cost": 350000,
    "quest": null
  },
  "gloampendant": {
    "output": "gloampendant",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "dexamulet",
        "level": 2
      },
      {
        "quantity": 30,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 80,
        "item": "bwing",
        "level": null
      },
      {
        "quantity": 6,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 6400000,
    "quest": null
  },
  "worldrootcrook": {
    "output": "worldrootcrook",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "harbringer",
        "level": 8
      },
      {
        "quantity": 1,
        "item": "sapstone",
        "level": null
      },
      {
        "quantity": 1,
        "item": "platinumingot",
        "level": null
      },
      {
        "quantity": 3,
        "item": "goldingot",
        "level": null
      },
      {
        "quantity": 4,
        "item": "ijx",
        "level": null
      },
      {
        "quantity": 12,
        "item": "ectoplasm",
        "level": null
      },
      {
        "quantity": 1,
        "item": "bcandle",
        "level": null
      }
    ],
    "cost": 250000000,
    "quest": null
  },
  "emberhood": {
    "output": "emberhood",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mmhat",
        "level": 5
      },
      {
        "quantity": 1,
        "item": "embercore",
        "level": null
      },
      {
        "quantity": 8,
        "item": "essenceoffire",
        "level": null
      },
      {
        "quantity": 20,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 400000,
    "quest": null
  },
  "bogcrown": {
    "output": "bogcrown",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "helmet",
        "level": 7
      },
      {
        "quantity": 1,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 12,
        "item": "poison",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 220000,
    "quest": null
  },
  "ratworkcoat": {
    "output": "ratworkcoat",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "coat",
        "level": 5
      },
      {
        "quantity": 30,
        "item": "rattail",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 75000,
    "quest": null
  },
  "reefvest": {
    "output": "reefvest",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "coat1",
        "level": 7
      },
      {
        "quantity": 200,
        "item": "reefglass",
        "level": null
      },
      {
        "quantity": 2,
        "item": "cshell",
        "level": null
      }
    ],
    "cost": 400000,
    "quest": null
  },
  "oathplate": {
    "output": "oathplate",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "coat1",
        "level": null
      },
      {
        "quantity": 4,
        "item": "pleather",
        "level": null
      },
      {
        "quantity": 2,
        "item": "ascale",
        "level": null
      },
      {
        "quantity": 20,
        "item": "spores",
        "level": null
      }
    ],
    "cost": 180000,
    "quest": null
  },
  "resolutesallet": {
    "output": "resolutesallet",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "helmet1",
        "level": 0
      },
      {
        "quantity": 12,
        "item": "dstones",
        "level": null
      },
      {
        "quantity": 4,
        "item": "rfangs",
        "level": null
      }
    ],
    "cost": 240000,
    "quest": null
  },
  "silkgrips": {
    "output": "silkgrips",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "gloves",
        "level": 5
      },
      {
        "quantity": 30,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 8,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 20,
        "item": "bwing",
        "level": null
      }
    ],
    "cost": 120000,
    "quest": null
  },
  "thundergrips": {
    "output": "thundergrips",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "mrngloves",
        "level": 6
      },
      {
        "quantity": 80,
        "item": "stormfeather",
        "level": null
      },
      {
        "quantity": 12,
        "item": "essenceofether",
        "level": null
      }
    ],
    "cost": 800000,
    "quest": null
  },
  "bogwalkers": {
    "output": "bogwalkers",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "shoes1",
        "level": 6
      },
      {
        "quantity": 1,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 12,
        "item": "poison",
        "level": null
      },
      {
        "quantity": 8,
        "item": "snakefang",
        "level": null
      }
    ],
    "cost": 260000,
    "quest": null
  },
  "cinderboots": {
    "output": "cinderboots",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "shoes1",
        "level": 6
      },
      {
        "quantity": 1,
        "item": "embercore",
        "level": null
      },
      {
        "quantity": 8,
        "item": "essenceoffire",
        "level": null
      },
      {
        "quantity": 20,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 280000,
    "quest": null
  },
  "rimeboots": {
    "output": "rimeboots",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "shoes1",
        "level": 6
      },
      {
        "quantity": 1,
        "item": "frostcore",
        "level": null
      },
      {
        "quantity": 8,
        "item": "essenceoffrost",
        "level": null
      },
      {
        "quantity": 12,
        "item": "bfur",
        "level": null
      }
    ],
    "cost": 280000,
    "quest": null
  },
  "reedpants": {
    "output": "reedpants",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "pants",
        "level": 6
      },
      {
        "quantity": 20,
        "item": "frogt",
        "level": null
      },
      {
        "quantity": 4,
        "item": "lotusf",
        "level": null
      },
      {
        "quantity": 40,
        "item": "ashleaf",
        "level": null
      }
    ],
    "cost": 100000,
    "quest": null
  },
  "beastmantle": {
    "output": "beastmantle",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "cape",
        "level": 7
      },
      {
        "quantity": 2,
        "item": "verdantcore",
        "level": null
      },
      {
        "quantity": 240,
        "item": "leather",
        "level": null
      }
    ],
    "cost": 1200000,
    "quest": null
  },
  "starcloak": {
    "output": "starcloak",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "cape",
        "level": 7
      },
      {
        "quantity": 40,
        "item": "voidthread",
        "level": null
      },
      {
        "quantity": 40,
        "item": "essenceofether",
        "level": null
      },
      {
        "quantity": 1,
        "item": "platinumnugget",
        "level": null
      }
    ],
    "cost": 1800000,
    "quest": null
  },
  "cave_locktooth": {
    "output": "cave_locktooth",
    "outputData": null,
    "items": [
      {
        "quantity": 6,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "blade",
        "level": 0
      },
      {
        "quantity": 2,
        "item": "reefglass",
        "level": null
      }
    ],
    "cost": 8000,
    "quest": null
  },
  "cave_counterweight": {
    "output": "cave_counterweight",
    "outputData": null,
    "items": [
      {
        "quantity": 8,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "wshield",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "dstones",
        "level": null
      }
    ],
    "cost": 12000,
    "quest": null
  },
  "cave_mothsteps": {
    "output": "cave_mothsteps",
    "outputData": null,
    "items": [
      {
        "quantity": 6,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "shoes",
        "level": 0
      },
      {
        "quantity": 2,
        "item": "beewings",
        "level": null
      }
    ],
    "cost": 12000,
    "quest": null
  },
  "cave_loaded_die": {
    "output": "cave_loaded_die",
    "outputData": null,
    "items": [
      {
        "quantity": 10,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 8,
        "item": "seashell",
        "level": null
      },
      {
        "quantity": 2,
        "item": "reefglass",
        "level": null
      }
    ],
    "cost": 16000,
    "quest": null
  },
  "cave_tunnelaxe": {
    "output": "cave_tunnelaxe",
    "outputData": null,
    "items": [
      {
        "quantity": 8,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "blade",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "wbasher",
        "level": 0
      }
    ],
    "cost": 12000,
    "quest": null
  },
  "cave_reedscythe": {
    "output": "cave_reedscythe",
    "outputData": null,
    "items": [
      {
        "quantity": 1,
        "item": "wbasher",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "blade",
        "level": 0
      },
      {
        "quantity": 1,
        "item": "spidersilk",
        "level": null
      }
    ],
    "cost": 500,
    "quest": null
  },
  "cave_deepaxe": {
    "output": "cave_deepaxe",
    "outputData": null,
    "items": [
      {
        "quantity": 400,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "cave_tunnelaxe",
        "level": 0
      },
      {
        "quantity": 10,
        "item": "gemfragment",
        "level": null
      },
      {
        "quantity": 20,
        "item": "leather",
        "level": null
      }
    ],
    "cost": 480000,
    "quest": null
  },
  "cave_ambercoat": {
    "output": "cave_ambercoat",
    "outputData": null,
    "items": [
      {
        "quantity": 300,
        "item": "cave_amber",
        "level": null
      },
      {
        "quantity": 1,
        "item": "coat",
        "level": 0
      },
      {
        "quantity": 30,
        "item": "spidersilk",
        "level": null
      },
      {
        "quantity": 20,
        "item": "cscale",
        "level": null
      }
    ],
    "cost": 360000,
    "quest": null
  }
};

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

const REVERSE=(()=>{
  const out={};
  for(const [recipeId,row] of Object.entries(RECIPES)){
    for(const ingredient of row.items){
      const id=String(ingredient.item||'');
      if(!id)continue;
      if(!out[id])out[id]=[];
      out[id].push(Object.freeze({
        recipeId,
        output:row.output,
        quantity:Number(ingredient.quantity||0),
        level:ingredient.level==null?null:Number(ingredient.level),
        cost:Number(row.cost||0),
        quest:row.quest||null
      }));
    }
  }
  for(const id of Object.keys(out))Object.freeze(out[id]);
  return Object.freeze(out);
})();

function recipe(recipeId){
  const row=RECIPES[String(recipeId||'')];
  return row?clone(row):null;
}

function recipesUsing(itemId){
  const rows=REVERSE[String(itemId||'')]||[];
  return rows.map(clone);
}

function isIngredient(itemId){
  return recipesUsing(itemId).length>0;
}

function requiresSpecificLevel(itemId){
  return recipesUsing(itemId).some(row=>row.level!=null);
}

function outputsUsing(itemId){
  return [...new Set(recipesUsing(itemId).map(row=>row.output))];
}

function ingredientIds(){
  return Object.keys(REVERSE).sort();
}

function recipeIds(){
  return Object.keys(RECIPES).sort();
}

function requirementSummary(itemId){
  const uses=recipesUsing(itemId);
  return{
    item:String(itemId||''),
    isIngredient:uses.length>0,
    recipes:uses,
    outputs:[...new Set(uses.map(x=>x.output))],
    exactLevels:[...new Set(uses.filter(x=>x.level!=null).map(x=>x.level))].sort((a,b)=>a-b)
  };
}

function countMatching(items,itemId,level){
  let total=0;
  for(const item of Array.isArray(items)?items:[]){
    if(!item||String(item.name||'')!==String(itemId||''))continue;
    if(level!=null&&Number(item.level||0)!==Number(level))continue;
    total+=Number(item.q||1);
  }
  return total;
}

function craftPlan(recipeId,{inventory=[],bank=[]}={}){
  const row=recipe(recipeId);
  if(!row)return{ok:false,error:'RECIPE_UNKNOWN',recipeId:String(recipeId||'')};
  const requirements=row.items.map(req=>{
    const inventoryQty=countMatching(inventory,req.item,req.level);
    const bankQty=countMatching(bank,req.item,req.level);
    const available=inventoryQty+bankQty;
    const required=Number(req.quantity||0);
    return{
      item:req.item,
      level:req.level,
      required,
      inventory:inventoryQty,
      bank:bankQty,
      available,
      missing:Math.max(0,required-available),
      ready:available>=required
    };
  });
  return{
    ok:true,
    recipeId:String(recipeId),
    output:row.output,
    outputData:row.outputData,
    cost:row.cost,
    quest:row.quest,
    ready:requirements.every(x=>x.ready),
    requirements
  };
}

function stats(){
  const leveled=Object.keys(REVERSE).filter(id=>requiresSpecificLevel(id));
  return{
    recipes:Object.keys(RECIPES).length,
    uniqueIngredients:Object.keys(REVERSE).length,
    leveledIngredientIds:leveled.length
  };
}

module.exports={
  SOURCE,RECIPES,recipe,recipesUsing,isIngredient,requiresSpecificLevel,
  outputsUsing,ingredientIds,recipeIds,requirementSummary,countMatching,craftPlan,stats
};

},{}],
"ligaments/gear/GearHandoffPlanner.js":[function(require,module,exports){
'use strict';

const {normalizeSnapshot}=require('../../organs/bank/BankOrganizer');
const {identity}=require('../inventory/InventoryService');
const policy=require('./GearHandoffPolicy');

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function sourceFrom(entry){
  return{
    pack:String(entry.pack),
    slot:Number(entry.slot),
    item:clone(entry.item),
    identity:identity(entry.item)
  };
}

function workId(operation,item,target,sources){
  const locs=(sources||[]).map(x=>x.pack+':'+x.slot+':'+x.identity).join(',');
  return['V3_GEAR_HANDOFF',operation,String(item||''),'T'+Number(target),locs].join('|');
}

function createGearHandoffPlanner({isProtected=null}={}){
  function plan(bankSnapshot){
    const entries=normalizeSnapshot(bankSnapshot);
    const work=[];
    const held=[];
    const waiting=[];
    const complete=[];
    const ignored=[];
    const compoundGroups=new Map();

    for(const entry of entries){
      const item=entry.item||{};
      const decision=policy.decision(item,{isProtected});
      const hasRule=!!decision.rule;

      if(!hasRule){
        if(decision.action==='KEEP')held.push({...sourceFrom(entry),reason:decision.reason});
        else ignored.push({...sourceFrom(entry),reason:decision.reason});
        continue;
      }

      if(Number(item.q||1)!==1){
        held.push({...sourceFrom(entry),reason:'STACKED_PRODUCTION_ITEM_UNSAFE',rule:clone(decision.rule)});
        continue;
      }

      if(decision.action==='KEEP'||decision.action==='HOLD'){
        held.push({...sourceFrom(entry),reason:decision.reason,rule:clone(decision.rule)});
        continue;
      }

      if(decision.action==='BANK'){
        complete.push({...sourceFrom(entry),reason:'TARGET_REACHED',target:Number(decision.target),rule:clone(decision.rule)});
        continue;
      }

      const source=sourceFrom(entry);
      const operation=String(decision.action||'').toUpperCase();
      const target=Number(decision.target);

      if(operation==='UPGRADE'){
        const sources=[source];
        work.push({
          id:workId(operation,item.name,target,sources),
          operation,item:String(item.name),level:Number(item.level||0),target,
          sources,rule:clone(decision.rule)
        });
        continue;
      }

      if(operation==='COMPOUND'){
        const key=[String(item.name),Number(item.level||0),String(item.p||''),String(item.stat_type||''),target].join('|');
        if(!compoundGroups.has(key))compoundGroups.set(key,{item:String(item.name),level:Number(item.level||0),target,rule:clone(decision.rule),sources:[]});
        compoundGroups.get(key).sources.push(source);
        continue;
      }

      held.push({...source,reason:'HANDOFF_OPERATION_UNSUPPORTED',rule:clone(decision.rule)});
    }

    for(const group of compoundGroups.values()){
      group.sources.sort((a,b)=>a.pack.localeCompare(b.pack)||a.slot-b.slot);
      let index=0;
      while(group.sources.length-index>=3){
        const sources=group.sources.slice(index,index+3);
        work.push({
          id:workId('COMPOUND',group.item,group.target,sources),
          operation:'COMPOUND',item:group.item,level:group.level,target:group.target,
          sources,rule:clone(group.rule)
        });
        index+=3;
      }
      const remaining=group.sources.slice(index);
      if(remaining.length){
        waiting.push({
          operation:'COMPOUND',item:group.item,level:group.level,target:group.target,
          have:remaining.length,need:3-remaining.length,sources:remaining,reason:'NEED_THREE_EXACT_MATCHES'
        });
      }
    }

    work.sort((a,b)=>
      a.operation.localeCompare(b.operation)||
      a.item.localeCompare(b.item)||
      a.level-b.level||
      a.sources[0].pack.localeCompare(b.sources[0].pack)||
      a.sources[0].slot-b.sources[0].slot
    );

    return{
      ok:true,
      work:clone(work),
      next:work.length?clone(work[0]):null,
      held:clone(held),
      waiting:clone(waiting),
      complete:clone(complete),
      ignored:clone(ignored),
      summary:{
        bankItems:entries.length,
        workUnits:work.length,
        held:held.length,
        waitingGroups:waiting.length,
        alreadyAtTarget:complete.length,
        ignored:ignored.length
      }
    };
  }

  return{plan};
}

module.exports={sourceFrom,workId,createGearHandoffPlanner};

},{"../../organs/bank/BankOrganizer":"organs/bank/BankOrganizer.js","../inventory/InventoryService":"ligaments/inventory/InventoryService.js","./GearHandoffPolicy":"ligaments/gear/GearHandoffPolicy.js"}],
"ligaments/gear/GearHandoffPolicy.js":[function(require,module,exports){
'use strict';

const registry=require('../../organs/gear/GearRegistry');
const exchangePolicy=require('../../organs/exchange/ExchangePolicy');

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function explicitRewardRule(itemId){
  const row=exchangePolicy.policyFor(String(itemId||''));
  if(!row||!['UPGRADE','COMPOUND'].includes(String(row.action||'').toUpperCase()))return null;
  const operation=String(row.action).toUpperCase();
  const target=Number(row.target);
  if(!Number.isInteger(target)||target<0)return null;
  const base=registry.PRODUCTION[String(itemId||'')];
  const compatibleBase=base&&String(base.operation||'').toUpperCase()===operation?base:null;
  return{
    operation,
    target,
    scroll:String(compatibleBase&&compatibleBase.scroll||'AUTO'),
    offering:String(compatibleBase&&compatibleBase.offering||'NONE'),
    after:'BANK',
    destination:'AUTO_POLICY',
    source:'USER_EXCHANGE_POLICY'
  };
}

function registryRule(itemId){
  const base=registry.PRODUCTION[String(itemId||'')];
  if(!base||base.enabled===false)return null;
  return{
    operation:String(base.operation||'').toUpperCase(),
    target:Number(base.target),
    scroll:String(base.scroll||'AUTO'),
    offering:String(base.offering||'NONE'),
    after:String(base.after||'BANK').toUpperCase(),
    destination:String(base.destination||'AUTO_POLICY').toUpperCase(),
    source:'GEAR_REGISTRY'
  };
}

function ruleFor(itemId){
  return clone(explicitRewardRule(itemId)||registryRule(itemId));
}

function protectedReason(item,{isProtected=null}={}){
  if(!item||!item.name)return'ITEM_INVALID';
  if(item.p==='shiny')return'SHINY_PROTECTED';
  if(item.l===true||item.locked===true)return'ITEM_LOCKED';
  if(typeof isProtected==='function'){
    try{if(isProtected(item)===true)return'EXTERNAL_PROTECTION';}
    catch{return'PROTECTION_CHECK_FAILED';}
  }
  return null;
}

function decision(item,options={}){
  const protection=protectedReason(item,options);
  if(protection)return{action:'KEEP',reason:protection,rule:null};
  const rule=ruleFor(item&&item.name);
  if(!rule)return{action:'HOLD',reason:'NO_GEAR_HANDOFF_RULE',rule:null};
  const level=Number(item&&item.level||0);
  if(level>=rule.target){
    return{action:'BANK',reason:'TARGET_REACHED',target:rule.target,rule};
  }
  return{action:rule.operation,reason:'GEAR_HANDOFF_REQUIRED',target:rule.target,rule};
}

module.exports={explicitRewardRule,registryRule,ruleFor,protectedReason,decision};

},{"../../organs/gear/GearRegistry":"organs/gear/GearRegistry.js","../../organs/exchange/ExchangePolicy":"organs/exchange/ExchangePolicy.js"}],
"ligaments/gear/GearHandoffService.js":[function(require,module,exports){
'use strict';

const GearControlPlane=require('../../organs/gear/GearControlPlane');

const OWNER_STAGE='GEAR_PRODUCTION';
const OWNER_RETURN='GEAR_HANDOFF_RETURN';
const VERSION=1;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function sourceKey(source){return String(source.pack)+':'+Number(source.slot)+':'+String(source.identity||'');}

function createSession(work,now){
  return{
    version:VERSION,
    state:'GEAR_HANDOFF',
    id:String(work.id),
    phase:'STAGING',
    work:clone(work),
    staged:[],
    outputs:[],
    deposits:[],
    job:null,
    lastError:null,
    createdAt:Number(now()),
    updatedAt:Number(now())
  };
}

function validateSession(session){
  if(!session||typeof session!=='object')throw new Error('GEAR_HANDOFF_SESSION_REQUIRED');
  if(session.version!==VERSION)throw new Error('GEAR_HANDOFF_SESSION_VERSION_INVALID');
  if(session.state!=='GEAR_HANDOFF')throw new Error('GEAR_HANDOFF_SESSION_STATE_INVALID');
  if(!session.id||!session.work||!Array.isArray(session.work.sources))throw new Error('GEAR_HANDOFF_SESSION_WORK_INVALID');
  if(!['STAGING','READY_FOR_GEAR','NEEDS_RESCAN','READY_FOR_BANK','COMPLETE','CANCELLED'].includes(session.phase)){
    throw new Error('GEAR_HANDOFF_PHASE_INVALID');
  }
  if(!Array.isArray(session.staged)||!Array.isArray(session.outputs)||!Array.isArray(session.deposits)){
    throw new Error('GEAR_HANDOFF_SESSION_LIST_INVALID');
  }
  return true;
}

function createGearHandoffService({
  inventory,
  retrieveOps,
  storeOps,
  planner,
  controlPlane=GearControlPlane,
  executorReady=false,
  now=Date.now
}={}){
  if(
    !inventory||
    typeof inventory.reserve!=='function'||
    typeof inventory.release!=='function'||
    typeof inventory.transferReservation!=='function'||
    typeof inventory.slot!=='function'||
    typeof inventory.identity!=='function'
  ){
    throw new Error('GEAR_HANDOFF_INVENTORY_REQUIRED');
  }
  if(!retrieveOps||typeof retrieveOps.retrieveExact!=='function')throw new Error('GEAR_HANDOFF_RETRIEVE_OPS_REQUIRED');
  if(!storeOps||typeof storeOps.storeExact!=='function')throw new Error('GEAR_HANDOFF_STORE_OPS_REQUIRED');
  if(!planner||typeof planner.plan!=='function')throw new Error('GEAR_HANDOFF_PLANNER_REQUIRED');
  if(!controlPlane||typeof controlPlane.buildJob!=='function')throw new Error('GEAR_HANDOFF_CONTROL_PLANE_REQUIRED');

  const canExecuteGear=typeof executorReady==='function'?executorReady:()=>executorReady===true;
  let active=null;
  const touch=()=>{if(active)active.updatedAt=Number(now());};
  const status=()=>active?clone(active):null;

  function ensureActive(workId=null){
    if(!active)return{ok:false,error:'GEAR_HANDOFF_NO_ACTIVE_SESSION'};
    if(workId!=null&&String(workId)!==String(active.id))return{ok:false,error:'GEAR_HANDOFF_SESSION_MISMATCH',active:active.id,requested:String(workId)};
    return{ok:true};
  }

  async function stageActive(){
    const checked=ensureActive();
    if(!checked.ok)return checked;
    if(active.phase==='READY_FOR_GEAR')return{ok:true,ready:true,job:clone(active.job),session:status()};
    if(active.phase!=='STAGING')return{ok:false,error:'GEAR_HANDOFF_NOT_STAGING',phase:active.phase,session:status()};

    const already=new Set(active.staged.map(x=>x.sourceKey));
    for(const source of active.work.sources){
      const key=sourceKey(source);
      if(already.has(key))continue;

      const proof=await retrieveOps.retrieveExact({
        pack:source.pack,
        slot:source.slot,
        expectedIdentity:source.identity
      });
      if(!proof||proof.ok!==true||proof.verified!==true){
        active.lastError={step:'RETRIEVE',sourceKey:key,error:proof&&proof.error||'BANK_RETRIEVE_UNPROVEN',proof:clone(proof)};
        touch();
        return{ok:false,error:'GEAR_HANDOFF_RETRIEVE_FAILED',detail:clone(active.lastError),session:status()};
      }
      if(String(proof.identity)!==String(source.identity)){
        active.lastError={step:'RETRIEVE_VERIFY',sourceKey:key,error:'GEAR_HANDOFF_RETRIEVED_IDENTITY_MISMATCH',expected:source.identity,actual:proof.identity};
        touch();
        return{ok:false,error:'GEAR_HANDOFF_RETRIEVED_IDENTITY_MISMATCH',detail:clone(active.lastError),session:status()};
      }

      const reserved=await inventory.reserve(proof.inventorySlot,OWNER_STAGE,{expected:source.identity});
      if(!reserved||reserved.ok!==true){
        active.lastError={step:'RESERVE',sourceKey:key,error:reserved&&reserved.error||'GEAR_HANDOFF_RESERVE_FAILED',inventorySlot:proof.inventorySlot};
        touch();
        return{ok:false,error:'GEAR_HANDOFF_RESERVE_FAILED',detail:clone(active.lastError),session:status()};
      }

      active.staged.push({
        sourceKey:key,
        source:clone(source),
        inventorySlot:Number(proof.inventorySlot),
        identity:String(source.identity),
        reservation:clone(reserved.reservation)
      });
      already.add(key);
      touch();
    }

    const built=controlPlane.buildJob({
      operation:active.work.operation,
      item:active.work.item,
      target:active.work.target,
      variant:'NORMAL',
      after:'BANK',
      destination:'AUTO_POLICY',
      scope:'BANK_HANDOFF',
      mode:active.work.operation==='COMPOUND'?'EXACT_THREE':'EXACT_ONE'
    });
    if(!built||built.ok!==true){
      active.lastError={step:'BUILD_JOB',error:built&&built.error||'GEAR_HANDOFF_JOB_REJECTED',detail:clone(built)};
      touch();
      return{ok:false,error:'GEAR_HANDOFF_JOB_REJECTED',detail:clone(active.lastError),session:status()};
    }

    active.job={
      ...clone(built.job),
      handoffId:active.id,
      stagedSlots:active.staged.map(x=>x.inventorySlot),
      stagedIdentities:active.staged.map(x=>x.identity),
      expectedInputCount:active.work.operation==='COMPOUND'?3:1
    };
    active.phase='READY_FOR_GEAR';
    active.lastError=null;
    touch();
    return{ok:true,ready:true,job:clone(active.job),session:status()};
  }

  async function stageNext(bankSnapshot){
    if(active&&active.phase!=='COMPLETE'&&active.phase!=='CANCELLED')return stageActive();
    const plan=planner.plan(bankSnapshot);
    if(!plan||plan.ok!==true)return{ok:false,error:'GEAR_HANDOFF_PLAN_FAILED',plan:clone(plan)};
    if(!plan.next){
      active=null;
      return{ok:true,no_work:true,plan:clone(plan),session:null};
    }
    active=createSession(plan.next,now);
    return stageActive();
  }

  async function stageNextFromBank(){
    if(typeof retrieveOps.snapshot!=='function')return{ok:false,error:'GEAR_HANDOFF_BANK_SNAPSHOT_UNAVAILABLE'};
    let snapshot;
    try{snapshot=await retrieveOps.snapshot();}
    catch(error){return{ok:false,error:'GEAR_HANDOFF_BANK_SNAPSHOT_FAILED',detail:String(error&&error.message||error)};}
    return stageNext(snapshot);
  }

  function executionReady(){return canExecuteGear()===true;}

  function routingHint(){
    if(!active)return{state:null,reason:'NO_ACTIVE_HANDOFF'};
    if(active.phase==='STAGING'||active.phase==='READY_FOR_BANK'||active.phase==='NEEDS_RESCAN'){
      return{state:'BANK',reason:'GEAR_HANDOFF_'+active.phase,workId:active.id};
    }
    if(active.phase==='READY_FOR_GEAR'){
      if(canExecuteGear()===true)return{state:'GEAR_PRODUCTION',reason:'GEAR_HANDOFF_READY_FOR_GEAR',workId:active.id};
      return{state:null,reason:'GEAR_EXECUTOR_REQUIRED',workId:active.id};
    }
    return{state:null,reason:'GEAR_HANDOFF_'+active.phase,workId:active.id};
  }

  async function acceptGearResult({workId,success,outputs=[],reason=null}={}){
    const checked=ensureActive(workId);
    if(!checked.ok)return checked;
    if(active.phase!=='READY_FOR_GEAR')return{ok:false,error:'GEAR_HANDOFF_NOT_READY_FOR_GEAR',phase:active.phase};

    if(success!==true){
      active.phase='NEEDS_RESCAN';
      active.lastError={step:'GEAR',error:'GEAR_ATTEMPT_NOT_SUCCESSFUL',reason:reason==null?null:String(reason)};
      touch();
      return{ok:true,needsRescan:true,session:status()};
    }

    const rows=Array.isArray(outputs)?outputs:[];
    if(!rows.length){
      active.lastError={step:'GEAR_VERIFY',error:'GEAR_SUCCESS_OUTPUT_REQUIRED'};
      touch();
      return{ok:false,error:'GEAR_SUCCESS_OUTPUT_REQUIRED',session:status()};
    }

    const verified=[];
    for(const row of rows){
      const slot=Number(row&&row.inventorySlot);
      if(!Number.isInteger(slot)||slot<0)return{ok:false,error:'GEAR_OUTPUT_SLOT_INVALID'};
      const current=await inventory.slot(slot);
      if(!current)return{ok:false,error:'GEAR_OUTPUT_NOT_FOUND',inventorySlot:slot};
      const actual=inventory.identity(current);
      const claimed=row.identity||inventory.identity(row.item);
      if(claimed&&String(claimed)!==String(actual)){
        return{ok:false,error:'GEAR_OUTPUT_IDENTITY_MISMATCH',inventorySlot:slot,claimed:String(claimed),actual:String(actual)};
      }
      verified.push({inventorySlot:slot,item:clone(current),identity:String(actual)});
    }

    const stagedBySlot=new Map(active.staged.map(row=>[Number(row.inventorySlot),row]));
    for(const row of verified){
      if(!stagedBySlot.has(Number(row.inventorySlot))){
        active.lastError={step:'GEAR_VERIFY',error:'GEAR_OUTPUT_SLOT_NOT_STAGED',inventorySlot:row.inventorySlot};
        touch();
        return{ok:false,error:'GEAR_OUTPUT_SLOT_NOT_STAGED',session:status()};
      }
    }

    const reservedOutputs=[];
    const outputSlots=new Set();
    for(const row of verified){
      const transferred=await inventory.transferReservation(
        row.inventorySlot,
        OWNER_STAGE,
        OWNER_RETURN,
        {expected:row.identity}
      );
      if(!transferred||transferred.ok!==true){
        active.phase='NEEDS_RESCAN';
        active.lastError={step:'RETURN_RESERVE_TRANSFER',error:transferred&&transferred.error||'GEAR_OUTPUT_RESERVATION_TRANSFER_FAILED',inventorySlot:row.inventorySlot};
        touch();
        return{ok:false,error:'GEAR_OUTPUT_RESERVATION_TRANSFER_FAILED',session:status()};
      }
      outputSlots.add(Number(row.inventorySlot));
      reservedOutputs.push({...row,reservation:clone(transferred.reservation)});
    }

    for(const row of active.staged){
      if(outputSlots.has(Number(row.inventorySlot)))continue;
      inventory.release(row.inventorySlot,OWNER_STAGE);
    }

    active.outputs=reservedOutputs;
    active.phase='READY_FOR_BANK';
    active.lastError=null;
    touch();
    return{ok:true,readyForBank:true,session:status()};
  }

  async function reconcileAfterGearFailure(workId){
    const checked=ensureActive(workId);
    if(!checked.ok)return checked;
    if(active.phase!=='NEEDS_RESCAN')return{ok:false,error:'GEAR_HANDOFF_RESCAN_NOT_REQUIRED',phase:active.phase,session:status()};

    const survivors=[];
    for(const row of active.staged){
      const current=await inventory.slot(row.inventorySlot);
      if(!current){
        inventory.release(row.inventorySlot,OWNER_STAGE);
        continue;
      }
      if(String(current.name||'')!==String(active.work.item||'')){
        active.lastError={
          step:'GEAR_FAILURE_RESCAN',
          error:'GEAR_FAILURE_SLOT_UNEXPECTED_ITEM',
          inventorySlot:row.inventorySlot,
          expectedItem:String(active.work.item||''),
          actualItem:String(current.name||'')
        };
        touch();
        return{ok:false,error:'GEAR_FAILURE_SLOT_UNEXPECTED_ITEM',detail:clone(active.lastError),session:status()};
      }
      const currentIdentity=inventory.identity(current);
      const transferred=await inventory.transferReservation(
        row.inventorySlot,
        OWNER_STAGE,
        OWNER_RETURN,
        {expected:currentIdentity}
      );
      if(!transferred||transferred.ok!==true){
        active.lastError={
          step:'GEAR_FAILURE_RESCAN',
          error:transferred&&transferred.error||'GEAR_FAILURE_SURVIVOR_RESERVATION_TRANSFER_FAILED',
          inventorySlot:row.inventorySlot
        };
        touch();
        return{ok:false,error:'GEAR_FAILURE_SURVIVOR_RESERVATION_TRANSFER_FAILED',detail:clone(active.lastError),session:status()};
      }
      survivors.push({
        inventorySlot:Number(row.inventorySlot),
        item:clone(current),
        identity:String(currentIdentity),
        reservation:clone(transferred.reservation)
      });
    }

    active.outputs=survivors;
    active.lastError=null;
    active.phase=survivors.length?'READY_FOR_BANK':'COMPLETE';
    touch();
    return{
      ok:true,
      reconciled:true,
      survivors:survivors.length,
      complete:active.phase==='COMPLETE',
      readyForBank:active.phase==='READY_FOR_BANK',
      session:status()
    };
  }

  async function returnToBank(workId){
    const checked=ensureActive(workId);
    if(!checked.ok)return checked;
    if(active.phase==='COMPLETE')return{ok:true,complete:true,session:status()};
    if(active.phase!=='READY_FOR_BANK')return{ok:false,error:'GEAR_HANDOFF_NOT_READY_FOR_BANK',phase:active.phase,session:status()};

    const depositedSlots=new Set(active.deposits.map(x=>Number(x.inventorySlot)));
    for(const output of active.outputs){
      if(depositedSlots.has(Number(output.inventorySlot)))continue;
      const proof=await storeOps.storeExact({
        inventorySlot:output.inventorySlot,
        expectedIdentity:output.identity,
        item:output.item
      });
      if(!proof||proof.ok!==true||proof.verified!==true){
        active.lastError={step:'BANK_RETURN',inventorySlot:output.inventorySlot,error:proof&&proof.error||'BANK_RETURN_UNPROVEN',proof:clone(proof)};
        touch();
        return{ok:false,error:'GEAR_HANDOFF_BANK_RETURN_FAILED',detail:clone(active.lastError),session:status()};
      }
      inventory.release(output.inventorySlot,OWNER_RETURN);
      active.deposits.push(clone(proof));
      depositedSlots.add(Number(output.inventorySlot));
      touch();
    }

    active.phase='COMPLETE';
    active.lastError=null;
    touch();
    return{ok:true,complete:true,session:status()};
  }

  function inspect(bankSnapshot){return planner.plan(bankSnapshot);}

  function restore(saved){
    const candidate=clone(saved);
    validateSession(candidate);
    active=candidate;
    return{ok:true,session:status()};
  }

  function cancel({workId,releaseReservations=false}={}){
    const checked=ensureActive(workId);
    if(!checked.ok)return checked;
    if(releaseReservations===true){
      for(const row of active.staged)inventory.release(row.inventorySlot,OWNER_STAGE);
      for(const row of active.outputs)inventory.release(row.inventorySlot,OWNER_RETURN);
    }
    active.phase='CANCELLED';
    active.lastError={step:'CANCEL',error:'MANUAL_CANCEL'};
    touch();
    return{ok:true,cancelled:true,session:status()};
  }

  async function health(){
    return{
      ok:true,
      active:!!active,
      phase:active&&active.phase||null,
      workId:active&&active.id||null,
      staged:active?active.staged.length:0,
      outputs:active?active.outputs.length:0,
      deposits:active?active.deposits.length:0,
      executor_ready:canExecuteGear()===true
    };
  }

  return{inspect,stageNext,stageNextFromBank,stageActive,executionReady,routingHint,acceptGearResult,reconcileAfterGearFailure,returnToBank,status,restore,cancel,health,validateSession};
}

module.exports={OWNER_STAGE,OWNER_RETURN,VERSION,sourceKey,createSession,validateSession,createGearHandoffService};

},{"../../organs/gear/GearControlPlane":"organs/gear/GearControlPlane.js"}],
"ligaments/gear/GearService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function gearIdentity(item){
  if(!item)return null;
  return [String(item.name||''),Number(item.level||0),item.p==null?'':String(item.p)].join('|');
}
function matches(item,request={}){
  if(!item||String(item.name||'')!==String(request.name||''))return false;
  if(request.level!=null&&Number(item.level||0)!==Number(request.level))return false;
  if(request.minLevel!=null&&Number(item.level||0)<Number(request.minLevel))return false;
  if(request.p!=null&&String(item.p||'')!==String(request.p))return false;
  return true;
}
const defaultSleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));

function createGearService({
  adapter,
  protectedItems=[],
  sleep=defaultSleep,
  settleMs=60,
  verifyIntervalMs=80,
  verifyAttempts=10
}={}){
  if(!adapter||typeof adapter.inventory!=='function'||typeof adapter.equipment!=='function')throw new Error('GEAR_ADAPTER_REQUIRED');
  const protectedSet=new Set((protectedItems||[]).map(String));
  let tail=Promise.resolve();

  function serialized(task){
    const run=tail.then(task,task);
    tail=run.catch(()=>{});
    return run;
  }

  async function locate(request={}){
    const items=await adapter.inventory();
    const rows=[];
    for(let slot=0;slot<items.length;slot++){
      const item=items[slot];
      if(matches(item,request))rows.push({slot,item:clone(item),identity:gearIdentity(item)});
    }
    if(!rows.length)return{ok:false,error:'GEAR_NOT_FOUND'};
    if(String(request.selection||'').toUpperCase()==='HIGHEST_LEVEL'){
      rows.sort((a,b)=>Number(b.item.level||0)-Number(a.item.level||0)||a.slot-b.slot);
    }
    return{ok:true,...rows[0]};
  }

  async function locateExact({name,level=0,p=null}={}){
    return locate({name,level,p});
  }

  function equippedMatch(equipment,request={}){
    if(request.slot){
      const item=equipment&&equipment[String(request.slot)];
      return matches(item,request)?{slot:String(request.slot),item:clone(item),identity:gearIdentity(item)}:null;
    }
    for(const [slot,item] of Object.entries(equipment||{})){
      if(matches(item,request))return{slot,item:clone(item),identity:gearIdentity(item)};
    }
    return null;
  }

  async function waitForEquipment(request,expectedIdentity=null){
    const attempts=Math.max(1,Number(verifyAttempts)||1);
    for(let attempt=1;attempt<=attempts;attempt++){
      const equipment=await adapter.equipment();
      const found=equippedMatch(equipment,request);
      if(found&&(!expectedIdentity||found.identity===expectedIdentity)){
        return{ok:true,verified:true,attempt,equipmentSlot:found.slot,item:found.item,identity:found.identity};
      }
      if(attempt<attempts)await sleep(verifyIntervalMs);
    }
    return{ok:false,error:'GEAR_EQUIP_NOT_VERIFIED',verified:false,attempts};
  }

  async function waitForEmpty(slot){
    const key=String(slot||'');
    const attempts=Math.max(1,Number(verifyAttempts)||1);
    for(let attempt=1;attempt<=attempts;attempt++){
      const equipment=await adapter.equipment();
      if(!equipment||!equipment[key])return{ok:true,verified:true,attempt,slot:key};
      if(attempt<attempts)await sleep(verifyIntervalMs);
    }
    return{ok:false,error:'GEAR_UNEQUIP_NOT_VERIFIED',slot:key,attempts};
  }

  async function clearSlotUnlocked(owner,slot){
    const key=String(slot||'');
    if(!key)return{ok:false,error:'GEAR_SLOT_REQUIRED'};
    const equipment=await adapter.equipment();
    if(!equipment||!equipment[key])return{ok:true,already:true,verified:true,slot:key,owner:String(owner||'')};
    if(typeof adapter.unequip!=='function')return{ok:false,error:'GEAR_UNEQUIP_UNSUPPORTED',slot:key};
    const result=await adapter.unequip(key);
    if(result&&result.ok===false)return{ok:false,error:result.error||'GEAR_UNEQUIP_FAILED',result:clone(result),slot:key};
    if(Number(settleMs)>0)await sleep(settleMs);
    const proof=await waitForEmpty(key);
    return{...proof,owner:String(owner||''),result:clone(result)};
  }

  async function equipRequestUnlocked(owner,request={}){
    if(!request||!request.name)return{ok:false,error:'GEAR_REQUEST_INVALID'};

    const beforeEquipment=await adapter.equipment();
    const already=equippedMatch(beforeEquipment,request);
    if(already){
      return{
        ok:true,verified:true,already:true,owner:String(owner||''),
        equipped:already.identity,equipmentSlot:already.slot,phase:'READY'
      };
    }

    const first=await locate(request);
    if(!first.ok)return first;

    // Real Adventure Land can move inventory slots between async operations.
    // Re-locate immediately before equip instead of trusting the earlier slot.
    const current=await locate(request);
    if(!current.ok)return{ok:false,error:'GEAR_CHANGED_BEFORE_EQUIP'};
    if(typeof adapter.equip!=='function')return{ok:false,error:'GEAR_EQUIP_UNSUPPORTED'};

    const result=await adapter.equip(current.slot,request.slot||null);
    if(result&&result.ok===false){
      return{ok:false,error:result.error||'GEAR_EQUIP_FAILED',result:clone(result),phase:'EQUIP'};
    }

    if(Number(settleMs)>0)await sleep(settleMs);
    const proof=await waitForEquipment(request,current.identity);
    if(!proof.ok){
      return{
        ...proof,
        owner:String(owner||''),
        expectedIdentity:current.identity,
        observedInventorySlot:current.slot,
        result:clone(result),
        phase:'VERIFY'
      };
    }

    return{
      ok:true,verified:true,owner:String(owner||''),result:clone(result),
      equipped:current.identity,equipmentSlot:proof.equipmentSlot,
      verifyAttempt:proof.attempt,phase:'READY'
    };
  }

  async function equipExact(owner,request={}){
    const exact={...request,level:request.level==null?0:request.level};
    return serialized(()=>equipRequestUnlocked(owner,exact));
  }

  async function equipBest(owner,request={}){
    return serialized(()=>equipRequestUnlocked(owner,{...request,selection:request.selection||'HIGHEST_LEVEL'}));
  }

  async function equipLoadout(owner,loadout={}){
    return serialized(async()=>{
      const trace=[];
      for(const slot of loadout.clearSlots||[]){
        const out=await clearSlotUnlocked(owner,slot);
        trace.push({phase:'CLEAR',slot,result:clone(out)});
        if(!out.ok)return{ok:false,error:out.error,owner:String(owner||''),loadout:String(loadout.name||''),trace};
      }
      for(const slot of ['mainhand','offhand']){
        const selector=loadout[slot];
        if(!selector)continue;
        const out=await equipRequestUnlocked(owner,{...selector,slot});
        trace.push({phase:'EQUIP',slot,result:clone(out)});
        if(!out.ok)return{ok:false,error:out.error,owner:String(owner||''),loadout:String(loadout.name||''),trace};
      }
      return{ok:true,verified:true,owner:String(owner||''),loadout:String(loadout.name||''),trace,phase:'READY'};
    });
  }

  function protectedIdentity(id){return protectedSet.has(String(id||''));}

  async function status(){
    return{
      inventory:(await adapter.inventory()).map(clone),
      equipment:clone(await adapter.equipment()),
      protected:Array.from(protectedSet).sort(),
      timing:{settleMs:Number(settleMs),verifyIntervalMs:Number(verifyIntervalMs),verifyAttempts:Number(verifyAttempts)}
    };
  }

  return{
    locate,locateExact,equipExact,equipBest,equipLoadout,
    protectedIdentity,status,gearIdentity,matches
  };
}

module.exports={createGearService,gearIdentity,matches};

},{}],
"ligaments/inventory/CrewResources.js":[function(require,module,exports){
'use strict';
// One resource policy per character; no combat or movement ownership here.
const CREW=new Set(['Rentaro','Hibari','Souji','Harutora']);
function count(items,name){return (items||[]).reduce((n,i)=>n+(i?.name===name?Math.max(1,Number(i.q)||1):0),0)}
function potion({name,hp,max_hp,mp,max_mp,healer=false}){
 if(!(max_hp>0&&max_mp>0))return null;
 const h=hp/max_hp,m=mp/max_mp,missing=max_mp-mp;
 if(name==='Hibari'||name==='Harutora'){
  if(h<=.75)return 'use_hp';
  if(missing>=500)return 'use_mp';
  return hp<max_hp&&h<=.90?'use_hp':null;
 }
 if(name==='Souji')return h<=.45?'use_hp':m<=.90?'use_mp':h<=.65?'use_hp':null;
 if(name==='Rentaro')return hp<max_hp?'use_hp':mp<max_mp?'use_mp':null;
 return null;
}
function createCrewResources({root,now=Date.now,healer=()=>false,managePotions=true,manageShop=true,setIntervalFn=setInterval,clearIntervalFn=clearInterval}={}){
 const name=root?.character?.name;
 if(!CREW.has(name))throw Error('CREW_RESOURCE_ROLE_REQUIRED');
 let timer=null,nextPotion=0,nextShop=0,shopBusy=false,active=false;
 const state={hp:0,mp:0,boughtHp:0,boughtMp:0,lastError:null};
 const alive=()=>root.character?.name===name&&!root.character.rip&&!root.character.dead&&root.character.hp>0;
 function ready(skill){try{return root.is_on_cooldown?.(skill)!==true&&root.is_on_cooldown?.('use_hp')!==true}catch{return false}}
 function tickPotion(){
  if(!managePotions||!alive()||now()<nextPotion)return null;
  const c=root.character,skill=potion({...c,name,healer:healer()});
  if(!skill||!ready(skill)||typeof root.use_skill!=='function')return null;
  const stock=skill==='use_hp'?['hpot1','hpot0']:['mpot1','mpot0'];
   if(Array.isArray(c.items)&&!stock.some(n=>count(c.items,n))){state.lastError='POTION_OUT_OF_STOCK:'+stock.join('/');return null;}
  nextPotion=now()+350;
  try{Promise.resolve(root.use_skill(skill)).then(r=>{
   if(r?.failed||r?.ok===false||r?.success===false)throw Error('POTION_REJECTED');
   state[skill==='use_hp'?'hp':'mp']++;
  }).catch(e=>{state.lastError=String(e?.message||e)});}
  catch(e){state.lastError=String(e?.message||e)}
  return skill;
 }
 async function tickShop(){
  if(!manageShop||!alive()||shopBusy||now()<nextShop)return;
  const c=root.character;
  if(!count(c.items,'computer')&&!c.slots?.computer)return;
  const buy=root.buy_with_gold||root.buy;if(typeof buy!=='function')return;
  nextShop=now()+5000;shopBusy=true;
  try{for(const [item,key] of [['hpot1','boughtHp'],['mpot1','boughtMp']]){
   if(!alive())break;
   const n=count(root.character.items,item);
   if(n>=100)continue;
   const r=await buy.call(root,item,1000-n);
   if(r?.failed||r?.ok===false||r?.success===false)throw Error('BUY_REJECTED:'+item);
   state[key]+=1000-n;
  }}catch(e){state.lastError=String(e?.message||e)}finally{shopBusy=false}
 }
 function tick(){tickPotion();void tickShop()}
 function start(){if(timer!==null)return;active=true;timer=setIntervalFn(tick,100);timer?.unref?.();tick()}
 function stop(){active=false;if(timer!==null)clearIntervalFn(timer);timer=null}
 return {start,stop,tick,tickPotion,tickShop,status:()=>({...state,active,shopBusy})};
}
module.exports={createCrewResources,potion,count};

},{}],
"ligaments/inventory/FighterMerchantHandoff.js":[function(require,module,exports){
'use strict';

// V2-compatible physical handoff owned by each fighter. Rentaro does not
// pull from remote inventories; the fighter must actually see him nearby.
const {SELL_ITEMS,SHARED_KEEP,sellDecision,transferDecision}=require('../../organs/gear/GearRegistry');
const FIGHTERS=new Set(['Hibari','Souji','Harutora','Rentaro']);
const DEFAULT_KEEP=new Set(SHARED_KEEP);
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function createFighterMerchantHandoff({root,character,now=Date.now,keep=null,inventoryService=null}={}){
  const name=String(character||root?.character?.name||'');
  if(!FIGHTERS.has(name))throw Error('CREW_INVENTORY_ROLE_REQUIRED');
  const keepNames=new Set((Array.isArray(keep)?keep:[]).map(String));
  const state={last_check:0,last_item_at:0,last_gold_at:0,
    item_attempts:0,gold_attempts:0,last_result:null,busy:false,saleRetryAt:0,lastSaleError:null};
  const keepGold=name==='Souji'?600000:750000;
  function nearMerchant(){
    const actor=root?.character||{};
    if(actor.rip===true||actor.dead===true)return null;
    const get=root?.get_player;
    if(typeof get!=='function')return null;
    let merchant;
    try{merchant=get('Rentaro')}catch(_){return null}
    if(!merchant||merchant.rip===true||merchant.dead===true)return null;
    const hereMap=String(actor.map||''),thereMap=String(merchant.map||hereMap);
    if(!hereMap||thereMap!==hereMap)return null;
    const i1=String(actor.in??actor.instance??'');
    const i2=String(merchant.in??merchant.instance??i1);
    if(i1!==i2)return null;
    const ax=finite(actor.real_x??actor.x),ay=finite(actor.real_y??actor.y);
    const mx=finite(merchant.real_x??merchant.x),my=finite(merchant.real_y??merchant.y);
    if([ax,ay,mx,my].some(v=>v===null))return null;
    const distance=Math.hypot(ax-mx,ay-my);
    return distance<=300?{distance,map:hereMap}:null;
  }
  function protectedItem(item){
    const actor=root?.character||{};
    return keepNames.has(String(item?.name||''))||!transferDecision(item,name,actor.items||[],actor.slots||{});
  }
  const reserved=slot=>(inventoryService?.reservationsStatus?.()||[]).some(r=>Number(r.slot)===slot);
  async function tick(){
    const t=Number(now());
    if(state.busy||t-state.last_check<750)return{ok:true,skipped:true,reason:'THROTTLED_OR_BUSY'};
    state.last_check=t;
    const actor=root?.character||{};
    if(actor.rip||actor.dead||!(actor.hp>0)||String(actor.map||'').startsWith('bank')||actor.q?.upgrade||actor.q?.compound||actor.q?.exchange||actor.stand)
      return{ok:true,skipped:true,reason:'INVENTORY_MAINTENANCE_PAUSED'};
    const merchant=name==='Rentaro'?null:nearMerchant();
    // This service is the ONLY native item/gold handoff owner.
    const sender=typeof root?.send_item==='function'?root.send_item.bind(root):null;
    const goldSender=typeof root?.send_gold==='function'?root.send_gold.bind(root):null;
    const socket=root?.parent?.socket;
    state.busy=true;
    try{
      // One disposition per item. Only carried inventory is eligible.
      const sell=typeof root.sell==='function'?root.sell.bind(root):typeof root.parent?.sell==='function'?root.parent.sell.bind(root.parent):null;
      if(sell&&t>=state.saleRetryAt&&t-state.last_item_at>=1000){
        const rows=actor.items||[];
        for(let slot=0;slot<rows.length;slot++){
          const item=rows[slot];
          if(reserved(slot)||keepNames.has(String(item?.name||''))||sellDecision(item,{character:name}).action!=='SELL')continue;
          state.last_item_at=t;
          const quantity=Math.max(1,Math.min(9999,Number(item.q||1)));
          try{
            const used=await sell(slot,quantity);
            if(used?.failed===true||used?.ok===false||used?.success===false)throw Error('NATIVE_SALE_REJECTED');
            state.lastSaleError=null;
            state.last_result={kind:'SALE_ATTEMPT',slot,item:item.name,quantity,at:t};
            return{ok:true,...state.last_result};
          }catch(error){
            // A rejected vendor sale must not block every subsequent handoff.
            state.lastSaleError=String(error?.message||error);
            state.saleRetryAt=t+10000;
            break;
          }
        }
      }
      if(!merchant)return{ok:true,skipped:true,reason:'RENTARO_NOT_PHYSICALLY_NEAR_OR_MERCHANT'};
      // Every visit includes a gold opportunity, not just items.
      if(t-state.last_gold_at>=8000&&finite(actor.gold)!==null&&Number(actor.gold)>=keepGold){
        const amount=Math.min(300000,Math.max(0,Math.floor(Number(actor.gold)-300000)));
        if(amount>0&&(goldSender||typeof socket?.emit==='function')){
          if(goldSender)await goldSender('Rentaro',amount);
          else socket.emit('send',{name:'Rentaro',gold:amount});
          state.last_gold_at=t;state.gold_attempts++;
          state.last_result={kind:'GOLD_ATTEMPT',amount,at:t,distance:merchant.distance};
          return{ok:true,kind:'GOLD_ATTEMPT',amount,awaitingInventoryProof:true};
        }
      }
      const inventory=Array.isArray(actor.items)?actor.items:[];
      if(t-state.last_item_at>=1000&&sender){
        for(let slot=0;slot<inventory.length;slot++){
          const item=inventory[slot];
          if(reserved(slot)||protectedItem(item))continue;
          const quantity=item?.q?Math.max(1,Math.floor(Number(item.q))):1;
          // Native V2 sends a single non-stackable weapon WITHOUT q; V3
          // passes quantity only for stackable items.
          const used=item?.q?await sender('Rentaro',slot,quantity):
            await sender('Rentaro',slot);
          if(used?.failed===true||used?.ok===false||used?.success===false)
            throw Error('NATIVE_SEND_ITEM_REJECTED');
          state.last_item_at=t;state.item_attempts++;
          state.last_result={kind:'ITEM_ATTEMPT',slot,
            item:String(item.name),quantity,at:t,distance:merchant.distance};
          return{ok:true,kind:'ITEM_ATTEMPT',slot,item:item.name,
            quantity,awaitingInventoryProof:true};
        }
      }
      return{ok:true,skipped:true,reason:'NO_ELIGIBLE_TRANSFER'};
    }catch(error){
      state.last_result={kind:'HANDOFF_ERROR',at:t,
        error:String(error?.message||error)};
      return{ok:false,error:state.last_result.error};
    }finally{state.busy=false}
  }
  function status(){return{character:name,keepGold,...state,near:name!=='Rentaro'&&!!nearMerchant(),sellList:[...SELL_ITEMS],sharedKeep:[...SHARED_KEEP]};}
  return{tick,status,nearMerchant,protectedItem};
}
module.exports={createFighterMerchantHandoff,DEFAULT_KEEP};

},{"../../organs/gear/GearRegistry":"organs/gear/GearRegistry.js"}],
"ligaments/inventory/InventoryService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function identity(item){
  if(!item)return null;
  return [
    String(item.name||''),
    Number.isFinite(Number(item.level))?Number(item.level):0,
    item.p==null?'':String(item.p),
    item.stat_type==null?'':String(item.stat_type)
  ].join('|');
}

function createInventoryService({adapter,now=Date.now}={}){
  if(!adapter||typeof adapter.snapshot!=='function')throw new Error('INVENTORY_ADAPTER_REQUIRED');
  const reservations=new Map();

  async function snapshot(){
    const items=await adapter.snapshot();
    if(!Array.isArray(items))throw new Error('INVENTORY_SNAPSHOT_INVALID');
    return items.map(clone);
  }

  async function slot(slotIndex){
    const items=await snapshot();
    return clone(items[Number(slotIndex)]||null);
  }

  async function find(name,{level=null,p=null}={}){
    const items=await snapshot();
    const target=String(name||'');
    const out=[];
    for(let i=0;i<items.length;i++){
      const item=items[i];
      if(!item||String(item.name||'')!==target)continue;
      if(level!=null&&Number(item.level||0)!==Number(level))continue;
      if(p!=null&&String(item.p||'')!==String(p))continue;
      out.push({slot:i,item:clone(item),identity:identity(item)});
    }
    return out;
  }

  async function freeSlots(){
    const items=await snapshot();
    return items.reduce((n,item)=>n+(item?0:1),0);
  }

  async function reserve(slotIndex,owner,{expected=null}={}){
    const idx=Number(slotIndex),who=String(owner||'');
    if(!Number.isInteger(idx)||idx<0||!who)return{ok:false,error:'INVENTORY_RESERVATION_INVALID'};
    const existing=reservations.get(idx);
    if(existing&&existing.owner!==who)return{ok:false,error:'INVENTORY_SLOT_RESERVED',reservation:clone(existing)};
    const item=await slot(idx);
    if(!item)return{ok:false,error:'INVENTORY_SLOT_EMPTY'};
    const actual=identity(item);
    if(expected&&actual!==String(expected))return{ok:false,error:'INVENTORY_IDENTITY_CHANGED',actual,expected:String(expected)};
    const row={slot:idx,owner:who,identity:actual,at:Number(now())};
    reservations.set(idx,row);
    return{ok:true,reservation:clone(row)};
  }

  function release(slotIndex,owner){
    const idx=Number(slotIndex),who=String(owner||'');
    const row=reservations.get(idx);
    if(!row)return{ok:true,released:false};
    if(row.owner!==who)return{ok:false,error:'INVENTORY_RESERVATION_OWNER_MISMATCH',reservation:clone(row)};
    reservations.delete(idx);
    return{ok:true,released:true};
  }

  async function transferReservation(slotIndex,fromOwner,toOwner,{expected=null}={}){
    const idx=Number(slotIndex),from=String(fromOwner||''),to=String(toOwner||'');
    if(!Number.isInteger(idx)||idx<0||!from||!to)return{ok:false,error:'INVENTORY_RESERVATION_TRANSFER_INVALID'};
    const row=reservations.get(idx);
    if(!row)return{ok:false,error:'INVENTORY_RESERVATION_REQUIRED'};
    if(row.owner!==from)return{ok:false,error:'INVENTORY_RESERVATION_OWNER_MISMATCH',reservation:clone(row)};
    const item=await slot(idx);
    if(!item)return{ok:false,error:'INVENTORY_SLOT_EMPTY'};
    const actual=identity(item);
    if(expected&&actual!==String(expected))return{ok:false,error:'INVENTORY_IDENTITY_CHANGED',actual,expected:String(expected)};
    const next={slot:idx,owner:to,identity:actual,at:Number(now()),transferred_from:from};
    reservations.set(idx,next);
    return{ok:true,reservation:clone(next),previous:clone(row)};
  }

  async function mutate(kind,{slot:slotIndex,owner,args=[]}={}){
    const idx=Number(slotIndex),who=String(owner||'');
    const row=reservations.get(idx);
    if(!row||row.owner!==who)return{ok:false,error:'INVENTORY_RESERVATION_REQUIRED'};
    const item=await slot(idx);
    const actual=identity(item);
    if(!item||actual!==row.identity)return{ok:false,error:'INVENTORY_IDENTITY_CHANGED',actual,expected:row.identity};
    const fn=adapter[String(kind||'')];
    if(typeof fn!=='function')return{ok:false,error:'INVENTORY_MUTATION_UNSUPPORTED',kind:String(kind||'')};
    const result=await fn(idx,...(Array.isArray(args)?args:[]));
    return{ok:!(result&&result.ok===false),result:clone(result),identity:row.identity};
  }

  function reservationsStatus(){return Array.from(reservations.values()).map(clone);}

  return{snapshot,slot,find,freeSlots,reserve,release,transferReservation,mutate,reservations:reservationsStatus,identity};
}

module.exports={createInventoryService,identity};

},{}],
"ligaments/movement/MerchantBossRouteGraph.js":[function(require,module,exports){
'use strict';
// A route graph made ONLY from the selected Rentaro PogiPath polylines,
// saved native Town casts and saved native doors. Optional future line colors
// become eligible when they are saved as map sections in the shared model.
// The executor must collision-check every MOVE and confirm every transition.
const SOURCE='POGIPATH_RENTARO_SHARED';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const dist=(a,b)=>Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y));
function createMerchantBossRouteGraph({network,model,maxLeg=30,junctionRadius=12,
  entryJoin=150,portalJoin=95,stageRadius=175,townCost=65}={}){
  if(!network||typeof network.section!=='function'||typeof network.portal!=='function'||
    !model?.meta?.pogiEditableTransitDraft)throw Error('MERCHANT_BOSS_GRAPH_MODEL_REQUIRED');
  const identity=network.identity('Harutora'),meta=model.meta,transit=meta.pogiEditableTransitDraft;
  if(identity.source!==SOURCE||identity.modelVersion!==meta.version)
    throw Error('MERCHANT_BOSS_GRAPH_VERSION_MISMATCH');
  const nodes=[],edges=[],byMap=new Map(),townLanding=new Map();
  const node=(map,x,y,section=null)=>{
    const id=nodes.length,at={id,map:String(map),x:Number(x),y:Number(y),section};
    nodes.push(at);edges.push([]);
    if(!byMap.has(at.map))byMap.set(at.map,[]);
    byMap.get(at.map).push(id);
    return id;
  };
  const add=(a,b,kind='MOVE',index=null,cost=null)=>{
    const w=cost===null?dist(nodes[a],nodes[b]):cost;
    if(!finite(w)||w<0)return;
    edges[a].push({to:b,kind,index,weight:w});
  };
  const sections=[];
  for(let i=0;i<network.status().sectionCount;i++){
    const s=network.section(i);
    if(!s.ok||s.points.length<2)continue;
    sections.push(i);
    let last=null;
    for(let j=0;j<s.points.length;j++){
      const current=s.points[j],prior=s.points[j-1];
      if(j===0){last=node(s.map,current.x,current.y,i);continue;}
      const d=dist(prior,current);
      const count=Math.max(1,Math.ceil(d/maxLeg));
      for(let k=1;k<=count;k++){
        const t=k/count,vertex=node(s.map,prior.x+(current.x-prior.x)*t,
          prior.y+(current.y-prior.y)*t,i);
        if(last!==null){add(last,vertex);add(vertex,last);}
        last=vertex;
      }
    }
  }
  const sectionNodes=nodes.length;
  // Crossings/branches are connected in either direction. This only connects
  // near portions of two actual saved Rentaro polylines, not arbitrary terrain.
  const cellSize=Math.max(12,junctionRadius),buckets=new Map();
  const key=(map,x,y)=>map+':'+x+':'+y;
  for(let id=0;id<sectionNodes;id++){
    const p=nodes[id],cx=Math.floor(p.x/cellSize),cy=Math.floor(p.y/cellSize);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const other of buckets.get(key(p.map,cx+dx,cy+dy))||[]){
        const q=nodes[other];
        if(q.section===p.section)continue;
        if(dist(p,q)<=junctionRadius){add(id,other);add(other,id);}
      }
    }
    const k=key(p.map,cx,cy);
    if(!buckets.has(k))buckets.set(k,[]);
    buckets.get(k).push(id);
  }
  const nearest=(map,p,limit,sectionOnly=false)=>{
    const all=byMap.get(map)||[],rows=[];
    for(const id of all){
      const at=nodes[id];
      if(sectionOnly&&at.section===null)continue;
      const d=dist(at,p);
      if(d<=limit)rows.push({id,d});
    }
    rows.sort((a,b)=>a.d-b.d||a.id-b.id);
    return rows;
  };
  const portals=[];
  for(const record of transit.portals||[]){
    if(record?.deletedInDraft===true)continue;
    const p=network.portal(record.index);
    if(!p.ok||p.doorKind!=='door')continue; // NPC transitions need a separate native executor
    const fromCandidates=nearest(p.map,{x:p.at[0],y:p.at[1]},portalJoin,true);
    const toCandidates=nearest(p.to,{x:p.arrival[0],y:p.arrival[1]},portalJoin,true);
    if(!fromCandidates.length||!toCandidates.length)continue;
    const a=node(p.map,p.at[0],p.at[1]);
    const b=node(p.to,p.arrival[0],p.arrival[1]);
    for(const v of fromCandidates.slice(0,5)){add(v.id,a);add(a,v.id);}
    for(const v of toCandidates.slice(0,5)){add(b,v.id);add(v.id,b);}
    add(a,b,'PORTAL',p.index,25);
    portals.push(p.index);
  }
  const towns=[];
  for(const record of transit.townCasts||[]){
    if(record?.deletedInDraft===true)continue;
    const t=network.town(record.index);
    if(!t.ok||townLanding.has(t.map))continue;
    const arrivals=nearest(t.map,{x:t.arrival[0],y:t.arrival[1]},entryJoin,true);
    if(!arrivals.length)continue;
    const landing=node(t.map,t.arrival[0],t.arrival[1]);
    for(const v of arrivals.slice(0,20)){
      add(landing,v.id);add(v.id,landing);
    }
    townLanding.set(t.map,{id:landing,index:t.index});
    towns.push(t.index);
  }
  for(const [map,landing] of townLanding){
    for(const id of byMap.get(map)||[]){
      if(id===landing.id)continue;
      add(id,landing.id,'TOWN',landing.index,townCost);
    }
  }
  // Dijkstra with binary heap; the graph is rebuilt only when the immutable
  // Merchant model changes. No runtime improvisation or auto route learning.
  function shortest({role='Harutora',from,to}={}){
    const who=network.identity(role);
    if(!from?.map||!to?.map||![from.x,from.y,to.x,to.y].every(x=>finite(Number(x))))
      return{ok:false,error:'MERCHANT_BOSS_POSITIONS_REQUIRED'};
    if(!byMap.has(from.map)||!byMap.has(to.map))
      return{ok:false,error:'MERCHANT_BOSS_MAP_NOT_IN_NETWORK'};
    const startCandidates=nearest(from.map,from,entryJoin,true);
    const desiredStageRadius=to.stageRadius==null?stageRadius:
      Math.max(8,Math.min(stageRadius,Number(to.stageRadius)||8));
    const endCandidates=nearest(to.map,to,desiredStageRadius,true);
    const originTown=townLanding.get(from.map);
    if(!startCandidates.length&&!originTown)
      return{ok:false,error:'MERCHANT_BOSS_ORIGIN_OFF_ROUTES'};
    if(!endCandidates.length)
      return{ok:false,error:'MERCHANT_BOSS_NEEDS_SAVED_OPTIONAL_LINE'};
    const start=nodes.length,finish=start+1,size=finish+1,side=new Map();
    side.set(start,[]);
    side.set(finish,[]);
    const launch=startCandidates.filter(v=>v.d<=45);
    const candidates=launch.length?launch:startCandidates.slice(0,8);
    for(const v of candidates)side.get(start).push({to:v.id,kind:'MOVE',index:null,weight:v.d});
    if(originTown)side.get(start).push({to:originTown.id,kind:'TOWN',index:originTown.index,weight:townCost});
    // Stop on a saved Merchant path within Mage's summon visibility distance.
    for(const v of endCandidates)side.set(v.id,[...(side.get(v.id)||[]),
      {to:finish,kind:'FINISH',index:null,weight:v.d*0.1}]);
    const heap=[],best=Array(size).fill(Infinity),previous=Array(size).fill(null);
    function push(id,w){let k=heap.length;heap.push({id,w});
      while(k>0){const p=(k-1)>>1;if(heap[p].w<=w)break;
        heap[k]=heap[p];k=p;}heap[k]={id,w};}
    function pop(){const first=heap[0],last=heap.pop();
      if(heap.length){let k=0;while(true){let c=k*2+1;if(c>=heap.length)break;
        if(c+1<heap.length&&heap[c+1].w<heap[c].w)c++;
        if(heap[c].w>=last.w)break;heap[k]=heap[c];k=c;}heap[k]=last;}
      return first;}
    best[start]=0;push(start,0);
    while(heap.length){
      const current=pop();
      if(current.w!==best[current.id])continue;
      if(current.id===finish)break;
      const next=[...(edges[current.id]||[]),...(side.get(current.id)||[])];
      for(const e of next){const w=current.w+e.weight;
        if(w>=best[e.to])continue;
        best[e.to]=w;previous[e.to]={from:current.id,edge:e};
        push(e.to,w);}
    }
    if(!finite(best[finish]))return{ok:false,error:'MERCHANT_BOSS_ROUTES_DISCONNECTED',
      fromMap:from.map,toMap:to.map};
    const chain=[],positions=new Map([[start,{map:from.map,x:Number(from.x),y:Number(from.y)}]]);
    for(let at=finish;at!==start;){
      const p=previous[at];if(!p)return{ok:false,error:'MERCHANT_BOSS_PATH_RECONSTRUCTION'};
      chain.push({from:p.from,to:at,...p.edge});at=p.from;
    }
    chain.reverse();const legs=[];let last={map:from.map,x:Number(from.x),y:Number(from.y)};
    for(const e of chain){
      if(e.kind==='FINISH')break;
      const dest=nodes[e.to];
      if(!dest)return{ok:false,error:'MERCHANT_BOSS_GRAPH_STEP_INVALID'};
      if(e.kind==='TOWN'||e.kind==='PORTAL'){
        legs.push({kind:e.kind,index:e.index,map:last.map,to:dest.map,
          x:dest.x,y:dest.y});
      }else if(e.kind==='MOVE'){
        if(last.map!==dest.map)return{ok:false,error:'MERCHANT_BOSS_MOVE_CROSSES_MAP'};
        const length=dist(last,dest),count=Math.max(1,Math.ceil(length/35));
        for(let k=1;k<=count;k++){
          const t=k/count;
          legs.push({kind:'MOVE',map:dest.map,
            x:Number((last.x+(dest.x-last.x)*t).toFixed(5)),
            y:Number((last.y+(dest.y-last.y)*t).toFixed(5))});
        }
      }
      last={map:dest.map,x:dest.x,y:dest.y};
    }
    if(legs.length>2000)return{ok:false,error:'MERCHANT_BOSS_ROUTE_EXCEEDS_LEG_BUDGET'};
    return{ok:true,source:SOURCE,routeId:who.routeId,modelVersion:who.modelVersion,
      role,cost:best[finish],legs,staging:last,bossDistance:dist(last,to),
      crossings:chain.filter(e=>e.kind==='PORTAL').map(e=>e.index),
      townCasts:chain.filter(e=>e.kind==='TOWN').map(e=>e.index),
      usedSavedMerchantNetwork:true,smartMove:false};
  }
  return Object.freeze({shortest,status:()=>({source:SOURCE,modelVersion:identity.modelVersion,
    sections,portals,towns,nodeCount:nodes.length})});
}
module.exports={createMerchantBossRouteGraph};

},{}],
"ligaments/movement/MerchantSharedRouteRunner.js":[function(require,module,exports){
'use strict';
// Bridge-independent live executor for one Rentaro PogiPath map SECTION.
// No smart_move, no unlisted shortcuts and no automatic Town/Magiport.
// Cross-map transitions must be explicitly sourced from Merchant portal data.
const ROLES=new Set(['Rentaro','Hibari','Souji','Harutora']);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=Number.isFinite;
function createMerchantSharedRouteRunner({
 root,network,movement,bossGraph=null,arrivalTolerance=12,arrivalTimeoutMs=6000,
 pollMs=125,now=Date.now,delay=ms=>new Promise(r=>setTimeout(r,ms))
}={}){
 if(!root||!network||typeof network.plan!=='function'||
    !movement||typeof movement.acquire!=='function'||typeof movement.move!=='function')
   throw Error('MERCHANT_SHARED_RUNNER_DEPENDENCIES_MISSING');
 if(arrivalTolerance<3||arrivalTolerance>20||
    arrivalTimeoutMs<250||arrivalTimeoutMs>15000||pollMs<10||pollMs>500)
   throw Error('MERCHANT_SHARED_RUNNER_BOUNDS_INVALID');
 let running=false,itineraryRunning=false,last=null;
 const nativeClear=(from,to)=>{
   if(!from||!to||from.map!==to.map)return false;
   if(typeof root.can_move_to==='function'){
     try{return root.can_move_to(to.x,to.y)===true}catch(_){return false}
   }
   if(typeof root.can_move==='function'){
     try{return root.can_move({
       map:from.map,x:from.x,y:from.y,going_x:to.x,going_y:to.y,
       base:root.character?.base
     })===true}catch(_){return false}
   }
   return false;
 };
 const live=()=>{
   const c=root.character,x=c?.real_x??c?.x,y=c?.real_y??c?.y;
   if(!c||!ROLES.has(c.name)||!c.map||!finite(x)||!finite(y)||
      c.rip===true||!(c.hp>0)||(root.parent?.socket||root.socket)?.connected!==true)return null;
   return{role:c.name,map:c.map,x,y};
 };
 async function arrived(point,timeoutMs=arrivalTimeoutMs,transition=false,tolerance=arrivalTolerance){
   const until=now()+timeoutMs;
   while(now()<=until){
     const at=live();
     if(!at||at.map!==point.map){if(!transition)return false;await delay(pollMs);continue;}
     if(dist(at,point)<=tolerance)return true;
     await delay(pollMs);
   }
   return false;
 }
 async function followSection(sectionIndex){
   if(running)return{ok:false,error:'MERCHANT_SHARED_ROUTE_ALREADY_RUNNING'};
   const here=live();
   if(!here)return{ok:false,error:'MERCHANT_SHARED_FIGHTER_NOT_LIVE'};
   const route=network.plan({role:here.role,sectionIndex,from:here});
   if(!route.ok)return route;
   if(route.source!=='POGIPATH_RENTARO_SHARED'||route.crossMap!==false||
      route.smartMove!==false||!Array.isArray(route.legs))
     return{ok:false,error:'MERCHANT_SHARED_ROUTE_SOURCE_NOT_VERIFIED'};
   if(route.legs.length>500)return{ok:false,error:'MERCHANT_SHARED_ROUTE_TOO_LONG'};
   const owner='MERCHANT_SHARED_ROUTE';
   const acquired=movement.acquire(owner,{priority:25});
   if(!acquired.ok)return{ok:false,error:'MERCHANT_SHARED_MOVEMENT_BUSY'};
   running=true;
   let steps=0;
   try{
     for(const leg of route.legs){
       const before=live();
       if(!before||before.role!==here.role||before.map!==route.from.map||
          leg.kind!=='MOVE'||leg.map!==before.map||!finite(leg.x)||!finite(leg.y))
         return last={ok:false,error:'MERCHANT_SHARED_ROUTE_LIVE_MISMATCH',steps};
       if(dist(before,leg)<=arrivalTolerance){steps++;continue;}
       if(!nativeClear(before,leg))
         return last={ok:false,error:'MERCHANT_SHARED_LEG_COLLISION_BLOCKED',steps,from:before,to:leg};
       const result=await movement.move(owner,{map:leg.map,x:leg.x,y:leg.y});
       if(result?.ok!==true)return last={ok:false,error:'MERCHANT_SHARED_NATIVE_MOVE_FAILED',steps};
       if(!await arrived(leg))
         return last={ok:false,error:'MERCHANT_SHARED_LEG_ARRIVAL_NOT_CONFIRMED',steps};
       steps++;
     }
     const final=live();
     if(!final||final.map!==route.destination.map||
        dist(final,route.destination)>arrivalTolerance)
       return last={ok:false,error:'MERCHANT_SHARED_DESTINATION_NOT_CONFIRMED',steps};
     return last={ok:true,source:route.source,routeId:route.routeId,
       modelVersion:route.modelVersion,role:here.role,sectionIndex,
       steps,arrived:true,map:final.map,position:{x:final.x,y:final.y},
       townMarker:route.townMarker,autoTownCast:false};
   }finally{running=false;movement.release(owner);}
 }
 async function followFarmApproach(){
   if(running)return{ok:false,error:'MERCHANT_SHARED_ROUTE_ALREADY_RUNNING'};
   const here=live();
   if(!here)return{ok:false,error:'MERCHANT_SHARED_FIGHTER_NOT_LIVE'};
   const route=network.planFarmApproach?.({role:here.role,from:here});
   if(!route?.ok)return route||{ok:false,error:'MERCHANT_SHARED_APPROACH_UNAVAILABLE'};
   if(route.source!=='POGIPATH_RENTARO_SHARED'||route.crossMap!==false||
      route.smartMove!==false||route.kind!=='SHARED_FARM_APPROACH'||
      !Array.isArray(route.legs)||route.legs.length>20)
     return{ok:false,error:'MERCHANT_FARM_APPROACH_SOURCE_NOT_VERIFIED'};
   const owner='MERCHANT_SHARED_ROUTE',lease=movement.acquire(owner,{priority:25});
   if(!lease.ok)return{ok:false,error:'MERCHANT_SHARED_MOVEMENT_BUSY'};
   running=true;let steps=0;
   try{
     for(const leg of route.legs){
       const before=live();
       if(!before||before.role!==here.role||before.map!=='halloween'||
          leg.map!==before.map||leg.kind!=='MOVE'||
          !finite(leg.x)||!finite(leg.y))
         return last={ok:false,error:'MERCHANT_FARM_APPROACH_LIVE_MISMATCH',steps};
       if(!nativeClear(before,leg))
         return last={ok:false,error:'MERCHANT_FARM_APPROACH_COLLISION_BLOCKED',steps};
       const moved=await movement.move(owner,{map:leg.map,x:leg.x,y:leg.y});
       if(moved?.ok!==true||!await arrived(leg))
         return last={ok:false,error:'MERCHANT_FARM_APPROACH_NOT_ARRIVED',steps};
       steps++;
     }
     return last={ok:true,source:route.source,routeId:route.routeId,
       kind:route.kind,steps,map:'halloween',arrived:true,
       position:route.destination,modelVersion:route.modelVersion};
   }finally{running=false;movement.release(owner);}
 }
 async function stageMainTown(index){
   if(running)return{ok:false,error:'MERCHANT_SHARED_ROUTE_ALREADY_RUNNING'};
   const here=live(),town=network.town?.(index);
   if(here?.map==='main'&&dist(here,{x:0,y:0})<=arrivalTolerance)return{ok:true,kind:'MAIN_TOWN',alreadyThere:true};
   if(!here||here.map!=='main'||!town?.ok||town.map!=='main'||
      town.source!=='POGIPATH_RENTARO_SHARED'||
      town.arrival[0]!==0||town.arrival[1]!==0||
      typeof root.town!=='function')
     return{ok:false,error:'MERCHANT_MAIN_TOWN_SOURCE_NOT_VERIFIED'};
   if(dist(here,{x:0,y:0})<=arrivalTolerance)
     return{ok:true,kind:'MAIN_TOWN',alreadyThere:true};
   running=true;
   try{
     await root.town();
     if(!await arrived({map:'main',x:0,y:0},12000,true,35))
       return last={ok:false,error:'MERCHANT_MAIN_TOWN_NOT_ARRIVED'};
     return last={ok:true,kind:'MAIN_TOWN',source:town.source,
       routeId:town.routeId,modelVersion:town.modelVersion};
   }catch(error){return last={ok:false,error:'MERCHANT_MAIN_TOWN_NATIVE_FAILED',
     detail:String(error?.message||error)}}
   finally{running=false;}
 }
 async function followPortal(index){
   if(running)return{ok:false,error:'MERCHANT_SHARED_ROUTE_ALREADY_RUNNING'};
   const here=live(),portal=network.portal?.(index);
   if(!here||!portal?.ok||portal.source!=='POGIPATH_RENTARO_SHARED'||
      here.map!==portal.map||
      dist(here,{x:portal.at[0],y:portal.at[1]})>40)
     return{ok:false,error:'MERCHANT_PORTAL_OR_POSITION_UNVERIFIED'};
   if(portal.doorKind!=='door'||
      typeof root.transport!=='function'||!root.G?.maps?.[portal.map])
     return{ok:false,error:'MERCHANT_PORTAL_NATIVE_DOOR_NOT_READY'};
   const mapDef=root.G.maps[portal.map],doors=mapDef.doors;
   const matching=Array.isArray(doors)?doors.filter(d=>Array.isArray(d)&&d[4]===portal.to&&Number(d[5])===portal.spawn):[];
   const marker={x:portal.at[0],y:portal.at[1]};
   // Merchant approach markers are walkable positions, not door sprites.
   // Match the actual destination/spawn pair first, then use the closest
   // native source spawn to disambiguate doors. Fighter behavior is unchanged.
   const score=d=>{const s=mapDef.spawns?.[d[6]];return Array.isArray(s)&&Number.isFinite(Number(s[0]))&&Number.isFinite(Number(s[1]))?dist({x:Number(s[0]),y:Number(s[1])},marker):Infinity};
   const ranked=matching.map(d=>({door:d,score:score(d)})).sort((a,b)=>a.score-b.score);
   const door=here.role==='Rentaro'?
     (ranked[0]&&ranked[0].score<=100&&(ranked.length===1||ranked[1].score-ranked[0].score>5)?ranked[0].door:null):
     matching.find(d=>dist({x:Number(d[0]),y:Number(d[1])},marker)<=45);
   if(!door)return{ok:false,error:'MERCHANT_PORTAL_DOOR_NOT_IN_NATIVE_MAP',detail:JSON.stringify({index,to:portal.to,spawn:portal.spawn,matching:Array.isArray(doors)?doors.filter(d=>d[4]===portal.to):[]})};
   if(here.role==='Rentaro'){
     const game=root.parent||root;
     const close=game.is_door_close,usable=game.can_use_door;
     if(typeof close==='function'&&typeof usable==='function'&&(!close.call(game,here.map,door,here.x,here.y)||!usable.call(game,here.map,door,here.x,here.y))){
       const spawn=root.G.maps[portal.map].spawns?.[door[6]];
       if(Array.isArray(spawn)&&finite(Number(spawn[0]))&&finite(Number(spawn[1]))&&dist(here,{x:Number(spawn[0]),y:Number(spawn[1])})<=100){
         const approach=await followCircuitPoint({map:here.map,x:Number(spawn[0]),y:Number(spawn[1])});
         if(!approach.ok)return approach;
       }
       const actual=live();
       if(!actual||!close.call(game,actual.map,door,actual.x,actual.y)||!usable.call(game,actual.map,door,actual.x,actual.y))return{ok:false,error:'MERCHANT_NATIVE_DOOR_NOT_USABLE',detail:JSON.stringify({index,actual,door,spawn})};
     }
   }
   running=true;
   try{
     let rejected=null;
     const pending=root.transport(portal.to,portal.spawn);
     Promise.resolve(pending).then(receipt=>{if(receipt?.failed===true||receipt?.success===false&&!receipt?.in_progress)rejected=String(receipt.reason||receipt.error||'rejected')},e=>{rejected=String(e?.reason||e?.message||e)});
     const until=now()+20000;
     while(now()<=until){
       if(live()?.map===portal.to)return last={ok:true,kind:'PORTAL',index,routeId:portal.routeId,modelVersion:portal.modelVersion,map:portal.to};
       if(rejected)return last={ok:false,error:'MERCHANT_NATIVE_DOOR_REJECTED',index,detail:rejected};
       await delay(pollMs);
     }
     return last={ok:false,error:'MERCHANT_PORTAL_ARRIVAL_NOT_CONFIRMED',index,detail:JSON.stringify({actual:live(),door,expected:portal.to})};
   }catch(error){return last={ok:false,error:'MERCHANT_NATIVE_DOOR_ERROR',
     detail:String(error?.message||error)}}
   finally{running=false;}
 }
 async function castTown(index){
   if(running)return{ok:false,error:'MERCHANT_SHARED_ROUTE_ALREADY_RUNNING'};
   const here=live(),town=network.town?.(index);
   if(!here||!town?.ok||here.map!==town.map||
      dist(here,{x:town.at[0],y:town.at[1]})>50||
      typeof root.town!=='function')
     return{ok:false,error:'MERCHANT_TOWN_MARKER_OR_POSITION_UNVERIFIED'};
   running=true;
   try{
     await root.town();
     if(!await arrived({map:town.map,x:town.arrival[0],y:town.arrival[1]},12000,true,35))
       return last={ok:false,error:'MERCHANT_TOWN_ARRIVAL_NOT_CONFIRMED'};
     return last={ok:true,kind:'TOWN',index,routeId:town.routeId,
       modelVersion:town.modelVersion,map:town.map};
   }catch(error){return last={ok:false,error:'MERCHANT_NATIVE_TOWN_ERROR',
     detail:String(error?.message||error)}}
   finally{running=false;}
 }
 async function followItinerary(steps){
   if(itineraryRunning)return{ok:false,error:'MERCHANT_ITINERARY_ALREADY_RUNNING'};
   if(!Array.isArray(steps)||steps.length<1||steps.length>16)
     return{ok:false,error:'MERCHANT_ITINERARY_INVALID'};
   itineraryRunning=true;
   try{
     const trace=[];
     for(const step of steps){
       const result=step?.kind==='SECTION'?
         await followSection(step.index):step?.kind==='PORTAL'?
         await followPortal(step.index):step?.kind==='TOWN'?
         await castTown(step.index):step?.kind==='MAIN_TOWN'?
         await stageMainTown(step.index):step?.kind==='FARM_APPROACH'?
         await followFarmApproach():{ok:false,error:'MERCHANT_ITINERARY_STEP_UNKNOWN'};
       trace.push({kind:step?.kind,index:step?.index,result});
       if(!result?.ok)return{ok:false,error:result?.error||'MERCHANT_ITINERARY_FAILED',trace};
     }
     return{ok:true,trace,role:live()?.role||null,source:'POGIPATH_RENTARO_SHARED'};
   }finally{itineraryRunning=false;}
 }
  // Shortest boss trip: exact saved Merchant graph legs, Town, and native doors.
  // No smart_move; no guessed cross-map jump. Failed native legs stop the trip.
  let bossRouteRunning=false,lastBossRoute=null;
  async function castTownAnywhere(index){
    if(running)return{ok:false,error:'MERCHANT_BOSS_TOWN_MOVEMENT_BUSY'};
    const before=live(),town=network.town?.(index);
    if(!before||!town?.ok||town.source!=='POGIPATH_RENTARO_SHARED'||
       before.map!==town.map||typeof root.town!=='function')
      return{ok:false,error:'MERCHANT_BOSS_TOWN_NOT_MAPPED'};
    running=true;
    try{
      await root.town();
      const point={map:town.map,x:town.arrival[0],y:town.arrival[1]};
      if(!await arrived(point,12000,true,35))
        return{ok:false,error:'MERCHANT_BOSS_TOWN_ARRIVAL_MISMATCH'};
      return{ok:true,kind:'TOWN',index,map:town.map};
    }catch(error){
      return{ok:false,error:'MERCHANT_BOSS_TOWN_FAILED',
        detail:String(error?.message||error)};
    }finally{running=false;}
  }
  async function bossMoveLeg(leg){
    if(running)return{ok:false,error:'MERCHANT_BOSS_MOVE_BUSY'};
    const here=live();
    if(!here||leg.kind!=='MOVE'||leg.map!==here.map||
       !finite(leg.x)||!finite(leg.y)||
       dist(here,leg)>72)
      return{ok:false,error:'MERCHANT_BOSS_MOVE_NOT_ON_SAVED_GRAPH'};
    if(dist(here,leg)<=arrivalTolerance)return{ok:true,kind:'MOVE',map:here.map};
    if(!nativeClear(here,leg))
      return{ok:false,error:'MERCHANT_BOSS_NATIVE_COLLISION_DENIED'};
    const owner='MERCHANT_SHARED_ROUTE',lease=movement.acquire(owner,{priority:25});
    if(!lease?.ok)return{ok:false,error:'MERCHANT_BOSS_MOVEMENT_BUSY'};
    running=true;
    try{
      const out=await movement.move(owner,{map:leg.map,x:leg.x,y:leg.y});
      if(!out?.ok||!await arrived(leg))
        return{ok:false,error:'MERCHANT_BOSS_MOVE_NOT_CONFIRMED'};
      return{ok:true,kind:'MOVE',map:here.map};
    }finally{running=false;movement.release(owner);}
  }
  function planBossRoute(to){
    const from=live();
    if(!from)return{ok:false,error:'MERCHANT_BOSS_FIGHTER_NOT_LIVE'};
    if(!bossGraph||typeof bossGraph.shortest!=='function')
      return{ok:false,error:'MERCHANT_BOSS_GRAPH_NOT_LOADED'};
    return bossGraph.shortest({role:from.role,from,to});
  }
  async function followBossRoute(to){
    if(bossRouteRunning||itineraryRunning||running)
      return{ok:false,error:'MERCHANT_BOSS_ROUTE_BUSY'};
    const plan=planBossRoute(to);
    if(!plan?.ok||plan.source!=='POGIPATH_RENTARO_SHARED'||plan.smartMove!==false||
       plan.modelVersion!==network.status().modelVersion||!Array.isArray(plan.legs)||
       plan.legs.length>2000)
      return plan?.ok?{ok:false,error:'MERCHANT_BOSS_GRAPH_UNTRUSTED'}:plan;
    bossRouteRunning=true;
    const trace=[];let count=0;
    try{
      for(const leg of plan.legs){
        const here=live();
        if(!here||here.map!==leg.map){
          lastBossRoute={ok:false,error:'MERCHANT_BOSS_POSITION_CHANGED',count,trace};
          return lastBossRoute;
        }
        const result=leg.kind==='MOVE'?await bossMoveLeg(leg):
          leg.kind==='PORTAL'?await followPortal(leg.index):
          leg.kind==='TOWN'?await castTownAnywhere(leg.index):
          {ok:false,error:'MERCHANT_BOSS_UNKNOWN_LEG'};
        if(!result?.ok){
          lastBossRoute={ok:false,error:result?.error||'MERCHANT_BOSS_STEP_FAILED',
            count,failed:leg,trace};
          return lastBossRoute;
        }
        trace.push({kind:leg.kind,index:leg.index??null,map:result.map});
        count++;
      }
      const final=live();
      if(!final||final.map!==plan.staging.map||
         dist(final,plan.staging)>arrivalTolerance){
        lastBossRoute={ok:false,error:'MERCHANT_BOSS_STAGE_NOT_CONFIRMED',count};
        return lastBossRoute;
      }
      lastBossRoute={ok:true,source:plan.source,routeId:plan.routeId,
        modelVersion:plan.modelVersion,role:plan.role,count,
        map:final.map,position:{x:final.x,y:final.y},
        bossDistance:plan.bossDistance,
        portalCount:plan.crossings.length,townCount:plan.townCasts.length};
      return lastBossRoute;
    }finally{bossRouteRunning=false;}
  }
 // Rentaro's circuit follows the edited main polyline in order, never Dijkstra shortcuts.
 let circuitPending=null;
 function canResumeCircuitPoint(point){
   const here=live();
   return !!here&&here.role==='Rentaro'&&here.map===point?.map&&finite(point.x)&&finite(point.y)&&
     dist(here,point)<=80&&(dist(here,point)<=5||nativeClear(here,point));
 }
 async function followCircuitPoint(point,{previous=null,next=null}={}){
   if(running||bossRouteRunning||itineraryRunning)return{ok:false,error:'MERCHANT_CIRCUIT_MOVEMENT_BUSY'};
   const here=live();
   if(!here||here.role!=='Rentaro'||here.map!==point?.map||!finite(point.x)||!finite(point.y))
     return{ok:false,error:'MERCHANT_CIRCUIT_POSITION_MISMATCH'};
   if(dist(here,point)<=5&&!next)return{ok:true,arrived:true};
   if(dist(here,point)>5&&!nativeClear(here,point))return{ok:false,error:'MERCHANT_CIRCUIT_LEG_BLOCKED',from:here,to:point};
   const owner='MERCHANT_SHARED_ROUTE',lease=movement.acquire(owner,{priority:25});
   if(!lease?.ok)return{ok:false,error:'MERCHANT_CIRCUIT_MOVEMENT_BUSY'};
   running=true;
   try{
     // Like the tested V29 runner, observe physical progress independently
     // of the native move promise; a pending promise must not freeze the circuit.
     let failed=null;
     const samePoint=(a,b)=>a&&b&&a.map===b.map&&Math.hypot(a.x-b.x,a.y-b.y)<0.01;
     const dispatch=p=>Promise.resolve(movement.move(owner,{map:p.map,x:p.x,y:p.y}));
     // The next tick adopts a move already dispatched at the previous waypoint.
     const actor=root.character;
     const adopted=samePoint(circuitPending,point)&&actor.moving===true&&
       Math.hypot(Number(actor.going_x)-point.x,Number(actor.going_y)-point.y)<=5;
     circuitPending=null;
     if(!adopted&&dist(here,point)>5)dispatch(point).then(r=>{if(r?.ok===false)failed=r.error||'MOVE_REJECTED'},e=>{failed=String(e?.reason||e?.message||e)});
     const nextValid=next?.map===point.map&&finite(next.x)&&finite(next.y)&&dist(point,next)>5;
     let straight=false;
     if(nextValid&&previous?.map===point.map){
       const ux=point.x-previous.x,uy=point.y-previous.y,vx=next.x-point.x,vy=next.y-point.y;
       const len1=Math.hypot(ux,uy),len2=Math.hypot(vx,vy);
       straight=len1>=14&&len2>=14&&len1<=115&&len2<=115&&
         (ux*vx+uy*vy)/(len1*len2)>0.99939;
     }
     function handoff(actual){
       if(!nextValid||!nativeClear(actual,next))return false;
       circuitPending={...next};
       dispatch(next).then(r=>{if(r?.ok===false&&samePoint(circuitPending,next))circuitPending=null;},()=>{if(samePoint(circuitPending,next))circuitPending=null;});
       return true;
     }
     const timeout=Math.max(arrivalTimeoutMs,Math.min(90000,Math.ceil(dist(here,point)/Math.max(20,Number(root.character.speed)||50)*2000)+6000));
     const until=now()+timeout;
     let lastPosition=here,progressAt=now();
     while(now()<=until){
       const actual=live();
       if(!actual||actual.map!==point.map)break;
       if(dist(actual,point)<=5)return{ok:true,arrived:true,lookahead:handoff(actual)};
       // Same 17px margin as the proven V29 lookahead. Never cut a corner.
       if(straight&&dist(actual,point)<17&&handoff(actual))return{ok:true,arrived:true,lookahead:true,earlyHandoff:true};
       if(dist(actual,lastPosition)>4){lastPosition=actual;progressAt=now();}
       if(failed||now()-progressAt>10500)break;
       await delay(pollMs);
     }
     return{ok:false,error:'MERCHANT_CIRCUIT_ARRIVAL_FAILED',detail:JSON.stringify({from:here,to:point,actual:live(),nativeError:failed})};
   }finally{running=false;movement.release(owner);}
 }
 async function followCircuitPortal(index){
   const here=live(),p=network.portal(index);
   if(!here||here.role!=='Rentaro'||!p?.ok||here.map!==p.map)return{ok:false,error:'MERCHANT_CIRCUIT_PORTAL_MISMATCH'};
   // Main section 0 ends 18px from cave portal #36. The recorded
   // approach is already in door range; do not force a move into the wall.
   if(p.doorKind==='door'&&dist(here,{x:p.at[0],y:p.at[1]})<=40){
     return followPortal(index);
   }
   const moved=await followCircuitPoint({map:p.map,x:p.at[0],y:p.at[1]});
   if(!moved.ok)return moved;
   if(p.doorKind==='door')return followPortal(index);
   if(p.doorKind!=='transporter_npc'||typeof root.transport!=='function')return{ok:false,error:'MERCHANT_CIRCUIT_TRANSPORT_UNAVAILABLE'};
   if(running)return{ok:false,error:'MERCHANT_CIRCUIT_MOVEMENT_BUSY'};
   running=true;
   try{
     await root.transport(p.to,p.spawn);
     return await arrived({map:p.to,x:p.arrival[0],y:p.arrival[1]},12000,true)?
       {ok:true,map:p.to}:{ok:false,error:'MERCHANT_CIRCUIT_TRANSPORT_ARRIVAL_FAILED'};
   }catch(error){return{ok:false,error:String(error?.message||error)};}
   finally{running=false;}
 }
 async function followCircuitTown(index){
   const here=live(),t=network.town(index);
   if(!here||here.role!=='Rentaro'||!t?.ok||here.map!==t.map)return{ok:false,error:'MERCHANT_CIRCUIT_TOWN_MISMATCH'};
   if(dist(here,{x:t.arrival[0],y:t.arrival[1]})<=arrivalTolerance)return{ok:true,alreadyThere:true};
   if(dist(here,{x:t.at[0],y:t.at[1]})>50)return{ok:false,error:'MERCHANT_CIRCUIT_TOWN_MARKER_NOT_REACHED'};
   return castTownAnywhere(index);
 }
 function status(){return{running,itineraryRunning,bossRouteRunning,last,lastBossRoute};}
 return Object.freeze({followSection,followPortal,castTown,stageMainTown,followFarmApproach,followItinerary,planBossRoute,followBossRoute,canResumeCircuitPoint,followCircuitPoint,followCircuitPortal,followCircuitTown,status});
}
module.exports={createMerchantSharedRouteRunner};

},{}],
"ligaments/movement/MerchantSharedRoutes.js":[function(require,module,exports){
'use strict';
// All four roles read the same Rentaro PogiPath route network. No character
// invents a second path, and a visual corner is never a cross-map teleport.
const ROLES=Object.freeze(['Rentaro','Souji','Hibari','Harutora']);
const SOURCE='POGIPATH_RENTARO_SHARED';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function createMerchantSharedRoutes({model,preferEditable=true,maxStep=35,maxJoin=45}={}){
 if(!model||typeof model!=='object'||!model.meta||!Number.isSafeInteger(model.meta.version))
   throw Error('MERCHANT_MODEL_VERSION_REQUIRED');
 if(!(maxStep>0&&maxStep<=100)||!(maxJoin>=0&&maxJoin<=100))
   throw Error('MERCHANT_ROUTE_STEP_OR_JOIN_INVALID');
 const meta=model.meta,original=meta.pogiMerchantCircuitV29;
 if(!original||original.tripId!==meta.pogiActiveCircuitTripId||
    !((Array.isArray(original.actions)&&original.actions.length>0)||
      (Number.isSafeInteger(original.actionCount)&&original.actionCount>0)))
   throw Error('MERCHANT_V29_SOURCE_NOT_PRESENT');
 const editableId=meta.pogiEditableCircuitRouteId;
 const custom=Array.isArray(meta.pogiCustomMapRoutes)?meta.pogiCustomMapRoutes:[];
 const draft=preferEditable&&custom.find(v=>v&&v.tripId===editableId&&
   Array.isArray(v.segments)&&v.segments.length>0);
 const fallback=custom.find(v=>v&&v.tripId===original.tripId&&
   Array.isArray(v.segments)&&v.segments.length>0);
 const chosen=draft||fallback;
 if(!chosen)throw Error('MERCHANT_ROUTE_SECTIONS_NOT_AVAILABLE');
 const isDraft=chosen===draft;
 const routeId=chosen.tripId,modelVersion=meta.version;
 const status=isDraft?'EDITABLE_DRAFT_REQUIRES_NATIVE_VALIDATION':'MERCHANT_ORIGINAL';
 const sections=chosen.segments.map((segment,index)=>{
   const map=String(segment?.map||'');
   const points=Array.isArray(segment?.points)?segment.points:[];
   const normalized=points.map(p=>({
     map:String(p?.map||map),x:Number(p?.x),y:Number(p?.y),
     kind:String(p?.kind||'MOVE')
   }));
   const valid=!!map&&normalized.every(p=>p.map===map&&finite(p.x)&&finite(p.y));
   return Object.freeze({index,map,points:Object.freeze(valid?normalized:[]),
     deleted:segment?.deletedInDraft===true||points.length===0,
     valid,sourceRouteId:routeId});
 });
 function identity(role){
   if(!ROLES.includes(role))throw Error('MERCHANT_SHARED_ROLE_UNKNOWN');
   return Object.freeze({role,source:SOURCE,routeId,modelVersion,
     originTripId:original.tripId,sourceHash:original.sourceModelHash||null,
     status,sharedFor:ROLES.slice()});
 }
 function section(index){
   if(!Number.isSafeInteger(index)||index<0||index>=sections.length)
     return{ok:false,error:'MERCHANT_SECTION_UNKNOWN'};
   const s=sections[index];
   if(!s.valid||s.deleted||s.points.length<2)
     return{ok:false,error:'MERCHANT_SECTION_DELETED_OR_EMPTY'};
   return{ok:true,index:s.index,map:s.map,points:clone(s.points)};
 }
 function plan({role,sectionIndex,from}={}){
   const who=identity(role);
   const s=section(sectionIndex);
   if(!s.ok)return s;
   if(!from||from.map!==s.map||!finite(Number(from.x))||!finite(Number(from.y)))
     return{ok:false,error:'MERCHANT_ROUTE_MAP_MISMATCH'};
   const start={map:s.map,x:Number(from.x),y:Number(from.y)};
   if(distance(start,s.points[0])>maxJoin)
     return{ok:false,error:'MERCHANT_ROUTE_START_NOT_JOINED'};
   const legs=[],positions=[start,...s.points];
   for(let i=1;i<positions.length;i++){
     const a=positions[i-1],b=positions[i],len=distance(a,b);
     if(len<0.01)continue;
     const count=Math.ceil(len/maxStep);
     for(let n=1;n<=count;n++){
       const t=n/count;
       const next={map:s.map,x:Number((a.x+(b.x-a.x)*t).toFixed(5)),
         y:Number((a.y+(b.y-a.y)*t).toFixed(5))};
       legs.push({kind:'MOVE',map:s.map,...next,corner:i,step:n,steps:count});
     }
   }
   return{ok:true,...who,sectionIndex,from:start,legs,
     destination:{...s.points[s.points.length-1]},
     townMarker:s.points[s.points.length-1].kind==='TOWN',
     crossMap:false,smartMove:false,validatedLive:false};
 }
 // Warrior/Priest/Mage need a short approach *after* the Merchant's
 // SAFE END/TOWN. Do not edit Rentaro's saved stop or blindly enter the pack.
 // The approach is deterministically anchored to the last saved PogiPath
 // point and stops at the OUTER edge of the scorpion farming area.
 function planFarmApproach({role,from,center={map:'halloween',x:-495.5,y:685.5},radius=110}={}){
   const identityInfo=identity(role);
   const s=section(23);
   if(!s.ok||s.map!=='halloween'||s.points.at(-1)?.kind!=='TOWN')
     return{ok:false,error:'MERCHANT_SAFE_END_ANCHOR_MISSING'};
   const anchor=s.points.at(-1);
   if(!from||from.map!==anchor.map||!finite(Number(from.x))||!finite(Number(from.y))||
      distance(from,anchor)>maxJoin)
     return{ok:false,error:'MERCHANT_FARM_APPROACH_NOT_AT_SAFE_END'};
   if(center?.map!=='halloween'||!finite(Number(center.x))||
      !finite(Number(center.y))||!finite(radius)||radius<95||radius>140)
     return{ok:false,error:'MERCHANT_FARM_APPROACH_BOUNDS_INVALID'};
   const d=distance(anchor,center);
   if(d<radius+35||d>400)return{ok:false,error:'MERCHANT_FARM_APPROACH_GEOMETRY_INVALID'};
   const end={map:'halloween',
     x:Number((center.x+(anchor.x-center.x)*radius/d).toFixed(5)),
     y:Number((center.y+(anchor.y-center.y)*radius/d).toFixed(5))};
   const legs=[],steps=Math.ceil(distance(from,end)/maxStep);
   for(let n=1;n<=steps;n++){
     const t=n/steps;
     legs.push({kind:'MOVE',map:'halloween',
       x:Number((Number(from.x)+(end.x-Number(from.x))*t).toFixed(5)),
       y:Number((Number(from.y)+(end.y-Number(from.y))*t).toFixed(5)),
       step:n,steps});
   }
   return{ok:true,...identityInfo,kind:'SHARED_FARM_APPROACH',
     sectionIndex:23,from:{map:'halloween',x:Number(from.x),y:Number(from.y)},
     destination:end,legs,crossMap:false,smartMove:false,
     sourceSafeEnd:clone(anchor),validatedLive:false};
 }
 // A Town uses Adventure Land use_town(); it is never a Mage Magiport.
 // Portals are separate named game-door / transporter transitions.
 const transit=meta.pogiEditableTransitDraft||{};
 function portal(index){
   const row=Array.isArray(transit.portals)?
     transit.portals.find(p=>p.index===index):null;
   if(!row||row.deletedInDraft===true||!row.map||!row.to||
      !Array.isArray(row.at)||!Array.isArray(row.arrival)||
      !row.at.every(finite)||!row.arrival.every(finite)||
      !Number.isSafeInteger(row.spawn))
     return{ok:false,error:'MERCHANT_SHARED_PORTAL_NOT_FOUND'};
   return{ok:true,source:SOURCE,routeId,modelVersion,kind:'PORTAL',
     index,map:String(row.map),to:String(row.to),at:clone(row.at),
     arrival:clone(row.arrival),spawn:row.spawn,
     doorKind:String(row.kind||'door')};
 }
 function town(index){
   const row=Array.isArray(transit.townCasts)?
     transit.townCasts.find(p=>p.index===index):null;
   if(!row||row.deletedInDraft===true||!row.map||
      !Array.isArray(row.at)||!row.at.every(finite)||
      !Array.isArray(row.arrival)||!row.arrival.every(finite))
     return{ok:false,error:'MERCHANT_SHARED_TOWN_NOT_FOUND'};
   return{ok:true,source:SOURCE,routeId,modelVersion,kind:'TOWN',
     index,map:String(row.map),at:clone(row.at),arrival:clone(row.arrival)};
 }

 function statusSnapshot(){
   return{source:SOURCE,routeId,modelVersion,status,sharedFor:ROLES.slice(),
     sectionCount:sections.length,available:sections.filter(s=>s.valid&&!s.deleted&&s.points.length>1).length,
     sourceHash:original.sourceModelHash||null};
 }
 return Object.freeze({identity,section,plan,planFarmApproach,portal,town,status:statusSnapshot,source:SOURCE,
   routeId,version:modelVersion});
}
module.exports={ROLES,SOURCE,createMerchantSharedRoutes};

},{}],
"ligaments/movement/MovementService.js":[function(require,module,exports){
'use strict';

function createMovementService({arbiter,adapter}={}){
  if(!arbiter||typeof arbiter.acquire!=='function')throw new Error('MOVEMENT_ARBITER_REQUIRED');
  if(!adapter||typeof adapter.move!=='function')throw new Error('MOVEMENT_ADAPTER_REQUIRED');

  function acquire(owner,{priority=0}={}){
    return arbiter.acquire('MOVEMENT',owner,{priority,allowPreempt:true});
  }

  function release(owner){return arbiter.release('MOVEMENT',owner);}

  function canMove(owner){
    const current=arbiter.owner('MOVEMENT');
    return !!current&&current.owner===String(owner||'');
  }

  async function move(owner,target,options={}){
    if(!canMove(owner)){
      return{ok:false,error:'MOVEMENT_NOT_OWNED',owner:arbiter.owner('MOVEMENT')};
    }
    const result=await adapter.move(target,options);
    return{ok:!(result&&result.ok===false),result};
  }

  async function smartMove(){
    // Explicit failure preserves the old method shape without native side effects.
    return{ok:false,error:'SMART_MOVE_BANNED_NORMAL_RUNTIME'};
  }

  async function followVerifiedRoute(owner,route){
    if(!canMove(owner))return{ok:false,error:'MOVEMENT_NOT_OWNED'};
    // An explicit authorization alone is not enough: the route itself must
    // be approved and have independently collision-verified fixed legs.
    if(!route||route.routeKind!=='FIXED_LEGS'||route.verified!==true||
       typeof route.destination!=='string'||!route.destination||
       !Array.isArray(route.legs)||route.legs.length<1)
      return{ok:false,error:'VERIFIED_FIXED_ROUTE_REQUIRED'};
    if(typeof adapter.followVerifiedRoute!=='function')
      return{ok:false,error:'VERIFIED_FIXED_ROUTE_ADAPTER_MISSING'};
    const result=await adapter.followVerifiedRoute(route);
    if(result?.ok!==true||result.arrived!==true||result.map!==route.destination)
      return{ok:false,error:'VERIFIED_ROUTE_ARRIVAL_NOT_PROVEN',result};
    return{ok:true,arrived:true,map:result.map,result};
  }

  return{acquire,release,canMove,move,smartMove,followVerifiedRoute,
    currentOwner:()=>arbiter.owner('MOVEMENT')};
}

module.exports={createMovementService};

},{}],
"ligaments/movement/RouteService.js":[function(require,module,exports){
'use strict';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const ACTIVE_STATES=new Set(['QUEUED','PLANNING','RUNNING','PAUSED','INTERRUPTED']);
const TERMINAL_STATES=new Set(['ARRIVED','FAILED','CANCELLED']);

function createRouteService({now=Date.now,maxRecoveryAttempts=3}={}){
  maxRecoveryAttempts=Number(maxRecoveryAttempts);
  if(!Number.isInteger(maxRecoveryAttempts)||maxRecoveryAttempts<1)throw new Error('ROUTE_MAX_RECOVERY_ATTEMPTS_INVALID');
  const models=new Map();
  let sourceRevision=null;
  const state={
    version:3,
    shadowOnly:true,
    characterRoutingConnected:false,
    status:null,
    routeOwner:null,
    character:null,
    destination:null,
    runtimeRevision:null,
    pendingRevision:null,
    currentEdge:null,
    currentCheckpoint:null,
    lastConfirmedPosition:null,
    recoveryAttempts:0,
    maxRecoveryAttempts,
    lastError:null,
    lastResult:null,
    lastReplanBoundary:null,
    edgeHistory:[],
    updatedAt:null
  };

  const active=()=>!!state.routeOwner&&ACTIVE_STATES.has(state.status);
  const snapshot=()=>clone(state);
  const touch=()=>{state.updatedAt=Number(now());};

  function observeModel({revision,model}={}){
    revision=Number(revision);
    if(!Number.isInteger(revision)||revision<1)return{ok:false,error:'REVISION_INVALID'};
    sourceRevision=revision;
    if(model&&typeof model==='object')models.set(revision,clone(model));else models.delete(revision);
    if(models.has(revision)){
      if(state.runtimeRevision==null){
        state.runtimeRevision=revision;
        state.pendingRevision=null;
      }else if(revision!==state.runtimeRevision){
        if(active())state.pendingRevision=revision;
        else{
          state.runtimeRevision=revision;
          state.pendingRevision=null;
        }
      }else state.pendingRevision=null;
    }else if(active()&&revision!==state.runtimeRevision){
      state.pendingRevision=revision;
    }
    touch();
    return{ok:models.has(revision),revision,runtimeRevision:state.runtimeRevision,pendingRevision:state.pendingRevision};
  }

  function request({owner,character,destination,resumeCheckpoint=null}={}){
    owner=String(owner||'');
    if(!owner)return{ok:false,error:'ROUTE_OWNER_REQUIRED'};
    if(destination==null)return{ok:false,error:'ROUTE_DESTINATION_REQUIRED'};
    if(active())return{ok:false,error:'ROUTE_OWNER_BUSY',routeOwner:state.routeOwner,status:state.status};
    const revision=state.runtimeRevision==null?sourceRevision:state.runtimeRevision;
    if(revision==null||!models.has(revision))return{ok:false,error:'NO_ACTIVE_ROUTE_MODEL'};
    state.routeOwner=owner;
    state.character=String(character||'');
    state.destination=clone(destination);
    state.status='PLANNING';
    state.runtimeRevision=revision;
    state.pendingRevision=null;
    state.currentEdge=null;
    state.currentCheckpoint=resumeCheckpoint;
    state.lastConfirmedPosition=null;
    state.recoveryAttempts=0;
    state.lastError=null;
    state.lastResult=null;
    state.lastReplanBoundary=null;
    state.edgeHistory=[];
    touch();
    return{ok:true,status:state.status,routeOwner:state.routeOwner,runtimeRevision:state.runtimeRevision,pendingRevision:null,shadowOnly:true,characterRoutingConnected:false};
  }

  function markEdgeStarted(edgeId){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    if(state.status==='PAUSED'||state.status==='INTERRUPTED')return{ok:false,error:'ROUTE_NOT_RUNNABLE',status:state.status};
    const id=String(edgeId||'');
    if(!id)return{ok:false,error:'EDGE_ID_REQUIRED'};
    state.currentEdge={edgeId:id,revision:state.runtimeRevision};
    state.edgeHistory.push(clone(state.currentEdge));
    state.status='RUNNING';
    touch();
    return{ok:true,status:state.status,edgeId:id,revision:state.runtimeRevision};
  }

  function markSafeCheckpoint(checkpointId,{position=null}={}){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    const checkpoint=String(checkpointId||'');
    if(!checkpoint)return{ok:false,error:'CHECKPOINT_ID_REQUIRED'};
    state.currentCheckpoint=checkpoint;
    state.currentEdge=null;
    if(position!=null)state.lastConfirmedPosition=clone(position);
    state.recoveryAttempts=0;
    touch();
    if(state.pendingRevision!=null){
      const next=state.pendingRevision;
      if(!models.has(next)){
        state.lastError='PENDING_REVISION_UNAVAILABLE';
        return{ok:false,error:state.lastError,runtimeRevision:state.runtimeRevision,pendingRevision:next};
      }
      const previous=state.runtimeRevision;
      state.runtimeRevision=next;
      state.pendingRevision=null;
      state.status='PLANNING';
      state.lastError=null;
      state.lastReplanBoundary={checkpointId:state.currentCheckpoint,fromRevision:previous,toRevision:next,at:Number(now())};
    }
    return{ok:true,status:state.status,runtimeRevision:state.runtimeRevision,pendingRevision:state.pendingRevision,checkpoint:state.currentCheckpoint};
  }

  function reportFailure(reason='ROUTE_FAILURE',detail=null){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    state.recoveryAttempts++;
    state.currentEdge=null;
    state.lastError=String(reason);
    if(state.recoveryAttempts<state.maxRecoveryAttempts){
      state.status='PLANNING';
      state.lastResult={
        type:'RECOVERY_REPLAN',
        reason:state.lastError,
        detail:clone(detail),
        attempt:state.recoveryAttempts,
        maxAttempts:state.maxRecoveryAttempts,
        destination:clone(state.destination),
        checkpoint:state.currentCheckpoint,
        at:Number(now())
      };
      touch();
      return{
        ok:true,status:state.status,retrying:true,reason:state.lastError,
        recoveryAttempts:state.recoveryAttempts,maxRecoveryAttempts:state.maxRecoveryAttempts,
        destination:clone(state.destination),checkpoint:state.currentCheckpoint
      };
    }
    state.status='FAILED';
    state.lastResult={
      type:'FAILED',
      reason:state.lastError,
      detail:clone(detail),
      attempt:state.recoveryAttempts,
      maxAttempts:state.maxRecoveryAttempts,
      destination:clone(state.destination),
      checkpoint:state.currentCheckpoint,
      at:Number(now())
    };
    touch();
    return{
      ok:true,status:state.status,retrying:false,reason:state.lastError,
      recoveryAttempts:state.recoveryAttempts,maxRecoveryAttempts:state.maxRecoveryAttempts,
      destination:clone(state.destination),checkpoint:state.currentCheckpoint
    };
  }

  function pause(reason='PAUSED'){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    if(state.status==='PAUSED')return{ok:false,error:'ALREADY_PAUSED'};
    state.status='PAUSED';
    state.lastError=String(reason);
    touch();
    return{ok:true,status:state.status,reason:state.lastError,checkpoint:state.currentCheckpoint,shadowOnly:true};
  }
  function interrupt(reason='INTERRUPTED'){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    state.status='INTERRUPTED';
    state.lastError=String(reason);
    touch();
    return{ok:true,status:state.status,reason:state.lastError,checkpoint:state.currentCheckpoint,shadowOnly:true};
  }
  function resume(){
    if(!state.routeOwner||!['PAUSED','INTERRUPTED'].includes(state.status))return{ok:false,error:'ROUTE_NOT_PAUSED_OR_INTERRUPTED'};
    if(state.runtimeRevision==null||!models.has(state.runtimeRevision))return{ok:false,error:'ROUTE_MODEL_UNAVAILABLE_FOR_RESUME',runtimeRevision:state.runtimeRevision};
    state.status='PLANNING';
    state.currentEdge=null;
    state.lastResult={type:'RESUME',checkpoint:state.currentCheckpoint,destination:clone(state.destination),at:Number(now())};
    touch();
    return{ok:true,status:state.status,checkpoint:state.currentCheckpoint,runtimeRevision:state.runtimeRevision,shadowOnly:true};
  }
  function arrive(proof={}){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    state.status='ARRIVED';
    state.currentEdge=null;
    state.lastError=null;
    state.lastResult={type:'ARRIVED',proof:clone(proof),at:Number(now())};
    touch();
    return{ok:true,status:state.status,proof:clone(proof),shadowOnly:true};
  }

  function fail(reason='FAILED',detail=null){
    if(!active())return{ok:false,error:'NO_ACTIVE_ROUTE'};
    state.status='FAILED';
    state.currentEdge=null;
    state.lastError=String(reason);
    state.lastResult={type:'FAILED',detail:clone(detail),destination:clone(state.destination),checkpoint:state.currentCheckpoint,at:Number(now())};
    touch();
    return{ok:true,status:state.status,reason:state.lastError,shadowOnly:true};
  }
  function cancel(reason='CANCELLED'){
    if(!state.routeOwner||TERMINAL_STATES.has(state.status))return{ok:false,error:'NO_ACTIVE_ROUTE'};
    state.status='CANCELLED';
    state.lastError=String(reason);
    state.currentEdge=null;
    state.lastResult={type:'CANCELLED',at:Number(now())};
    touch();
    return{ok:true,status:state.status,reason:state.lastError,shadowOnly:true};
  }

  function exportCheckpoint(){
    if(!state.routeOwner)return{ok:false,error:'NO_ROUTE_TO_CHECKPOINT'};
    return{ok:true,checkpoint:snapshot()};
  }

  function restore(checkpoint){
    const next=clone(checkpoint);
    if(!next||typeof next!=='object'||next.version!==3)return{ok:false,error:'ROUTE_CHECKPOINT_INVALID'};
    if(next.shadowOnly!==true||next.characterRoutingConnected!==false)return{ok:false,error:'ROUTE_CHECKPOINT_MODE_INVALID'};
    if(!next.routeOwner||next.destination==null)return{ok:false,error:'ROUTE_CHECKPOINT_INTENT_INVALID'};
    if(!ACTIVE_STATES.has(next.status))return{ok:false,error:'ROUTE_CHECKPOINT_NOT_RESUMABLE'};
    if(!Number.isInteger(Number(next.runtimeRevision))||!models.has(Number(next.runtimeRevision))){
      return{ok:false,error:'ROUTE_MODEL_UNAVAILABLE_FOR_RESTORE',runtimeRevision:next.runtimeRevision};
    }
    if(!Number.isInteger(Number(next.recoveryAttempts))||Number(next.recoveryAttempts)<0)return{ok:false,error:'ROUTE_CHECKPOINT_RECOVERY_INVALID'};
    const preserved={
      ...next,
      runtimeRevision:Number(next.runtimeRevision),
      pendingRevision:next.pendingRevision==null?null:Number(next.pendingRevision),
      recoveryAttempts:Number(next.recoveryAttempts),
      maxRecoveryAttempts
    };
    Object.assign(state,preserved);
    state.status='PLANNING';
    state.currentEdge=null;
    state.lastError='RESTORED_REPLAN_FROM_LIVE_POSITION';
    state.lastResult={type:'RESTORED',destination:clone(state.destination),checkpoint:state.currentCheckpoint,at:Number(now())};
    touch();
    return{ok:true,status:state.status,destination:clone(state.destination),checkpoint:state.currentCheckpoint,recoveryAttempts:state.recoveryAttempts};
  }

  return{
    observeModel,request,markEdgeStarted,markSafeCheckpoint,reportFailure,
    pause,interrupt,resume,arrive,fail,cancel,exportCheckpoint,restore,getStatus:snapshot
  };
}
module.exports={createRouteService,ACTIVE_STATES,TERMINAL_STATES};

},{}],
"ligaments/party/PartyCoordinationService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function distance(a,b){
  const ax=Number(a&&a.x),ay=Number(a&&a.y),bx=Number(b&&b.x),by=Number(b&&b.y);
  if(![ax,ay,bx,by].every(Number.isFinite))return Infinity;
  return Math.hypot(ax-bx,ay-by);
}

function createPartyCoordinationService({now=Date.now,maxAgeMs=5000}={}){
  const members=new Map();

  function update(name,snapshot={}){
    const key=String(name||'');
    if(!key)return{ok:false,error:'PARTY_MEMBER_REQUIRED'};
    const row={...clone(snapshot),name:key,updated_at:Number(now())};
    members.set(key,row);
    return{ok:true,member:clone(row)};
  }

  function get(name){return clone(members.get(String(name||''))||null);}

  function ready(required,{anchor=null,maxDistance=Infinity,sameMap=true,sameInstance=true}={}){
    const t=Number(now()),reasons=[],rows={};
    const anchorRow=anchor?members.get(String(anchor)):null;
    if(anchor){
      const key=String(anchor);
      if(!anchorRow)reasons.push(key+':ANCHOR_MISSING');
      else{
        if(t-Number(anchorRow.updated_at||0)>Number(maxAgeMs))reasons.push(key+':ANCHOR_STALE');
        if(anchorRow.online!==true)reasons.push(key+':ANCHOR_OFFLINE');
        if(anchorRow.dead===true||anchorRow.rip===true)reasons.push(key+':ANCHOR_DEAD');
        if(!anchorRow.map)reasons.push(key+':ANCHOR_MAP_UNKNOWN');
      }
    }
    for(const name of required||[]){
      const row=members.get(String(name));
      rows[name]=clone(row||null);
      if(!row){reasons.push(name+':MISSING');continue;}
      if(t-Number(row.updated_at||0)>Number(maxAgeMs))reasons.push(name+':STALE');
      if(row.online!==true)reasons.push(name+':OFFLINE');
      if(!row.map)reasons.push(name+':MAP_UNKNOWN');
      if(row.dead===true||row.rip===true)reasons.push(name+':DEAD');
      if(anchorRow&&sameMap&&String(row.map||'')!==String(anchorRow.map||''))reasons.push(name+':WRONG_MAP');
      if(anchorRow&&sameInstance&&String(row.instance||'')!==String(anchorRow.instance||''))reasons.push(name+':WRONG_INSTANCE');
      if(anchorRow&&Number.isFinite(Number(maxDistance))&&distance(anchorRow,row)>Number(maxDistance))reasons.push(name+':TOO_FAR');
    }
    return{ok:reasons.length===0,reasons,members:rows};
  }

  function status(){
    const t=Number(now());
    return Array.from(members.values()).map(row=>({...clone(row),age_ms:t-Number(row.updated_at||0)}));
  }

  return{update,get,ready,status,distance};
}

module.exports={createPartyCoordinationService,distance};

},{}],
"ligaments/party/PriestSafeSpotHandshake.js":[function(require,module,exports){
'use strict';
// ORDER66 V3: Souji->Hibari one-shot safe-spot challenge/response.
// Native Adventure Land character.on('cm') supplies the server sender name.
// A caller's {authenticated:true} flag is NEVER a credential. The consumer
// accepts only a same-session reply to its unpredictable pending challenge,
// after the emitter and receiver each consult separately supplied safety trust.
const {DEFAULT_WAIT}=require('../../bootstrap/FighterFirstState');
const SHA=/^[a-f0-9]{40}$/,ID=/^[A-Za-z0-9_-]{12,80}$/,NONCE=/^[a-f0-9]{32}$/;
function createPriestSafeSpotHandshake({
  root,role,trust=null,now=Date.now,waitSpot=DEFAULT_WAIT,maxAgeMs=5000
}={}){
 if(!['Souji','Hibari'].includes(role)||!root||!Number.isSafeInteger(maxAgeMs)||
    maxAgeMs<500||maxAgeMs>5000)throw Error('PRIEST_SAFE_SPOT_IDENTITY_REQUIRED');
 let started=false,closed=false,pending=null,receipt=null,lastReason='TRUST_NOT_CONNECTED';
 const seen=new Set();
 const stamp=()=>Number(now());
 const within=(c,spot=waitSpot,r=35)=>{
   const x=c?.real_x??c?.x,y=c?.real_y??c?.y;
   return c?.map===spot.map&&typeof x==='number'&&typeof y==='number'&&
     Number.isFinite(x)&&Number.isFinite(y)&&
     Math.hypot(x-spot.x,y-spot.y)<=r;
 };
 function pins(requireGameplay=true){
   const p=root.__POGI_V3_SUPERVISED_APPROVAL,l=root.__POGI_V3_LOADER_STATUS,
     c=root.character,t=stamp();
   if(!p||!l||c?.name!==role||root.socket?.connected!==true||c.rip===true||
      !Number.isFinite(c.hp)||c.hp<=0||p.character!==role||
      p.userPresent!==true||p.singleTab!==true||p.noRecovery!==true||
      p.sourceCommit!==l.sourceCommit||p.releaseCommit!==l.releaseCommit||
      l.role!==role||l.installed!==true||l.ok!==true||
      (requireGameplay&&l.gameplayStarted!==true)||
      !SHA.test(p.sourceCommit||'')||!SHA.test(p.releaseCommit||'')||
      !ID.test(p.sessionId||'')||!Number.isSafeInteger(p.expiresAt)||
      p.expiresAt<=t)return null;
   return{sessionId:p.sessionId,sourceCommit:p.sourceCommit,releaseCommit:p.releaseCommit};
 }
 const same=(m,id)=>m?.sessionId===id.sessionId&&
   m?.sourceCommit===id.sourceCommit&&m?.releaseCommit===id.releaseCommit;
 const fresh=(m)=>Number.isSafeInteger(m?.at)&&m.at<=stamp()+500&&
   stamp()-m.at>=0&&stamp()-m.at<=maxAgeMs;
 function areaClear(){
   const c=root.character;
   if(!within(c,waitSpot,waitSpot.radius||35))return false;
   let feed;
   try{feed=root.parent?.entities||root.entities}catch(_){return false}
   if(!feed||typeof feed!=='object')return false;
   for(const e of Object.values(feed)){
     if(!e||e.type!=='monster'||e.dead===true||e.rip===true)continue;
     if(e.map&&e.map!==c.map)continue;
     const x=e.real_x??e.x,y=e.real_y??e.y;
     if(!Number.isFinite(x)||!Number.isFinite(y)||
        e.target==='Souji'||Math.hypot(x-waitSpot.x,y-waitSpot.y)<125)return false;
   }
   return true;
 }
 async function onMessage(event){
   if(!started||closed)return;
   const id=pins(),m=event?.message;
   if(!id||!m||!same(m,id)||!fresh(m))return;
   if(role==='Souji'){
     if(event.name!=='Hibari'||m.kind!=='O66_SOUJI_SAFE_SPOT_CHALLENGE'||
        !NONCE.test(m.nonce||'')||seen.has(m.nonce)||
        typeof trust?.verifySoujiSafeSpot!=='function')return;
     if(!areaClear()){lastReason='SOUJI_NOT_AT_CLEAR_SAFE_SPOT';return;}
     const snap={map:root.character.map,x:root.character.real_x??root.character.x,
       y:root.character.real_y??root.character.y,hp:root.character.hp,
       observedAt:stamp(),role:'Souji'};
     let approved=false;
     try{approved=trust.verifySoujiSafeSpot(snap,{...id,challenge:m.nonce})===true}
     catch(_){}
     if(!approved){lastReason='SOUJI_INDEPENDENT_SAFE_SPOT_PROOF_REQUIRED';return;}
     if(seen.size>=40){lastReason='CHALLENGE_CAPACITY_HOLD';return;}
     seen.add(m.nonce);
     try{
       const response=await root.send_cm('Hibari',{
         kind:'O66_SOUJI_SAFE_SPOT_READY',...id,nonce:m.nonce,at:stamp(),
         map:waitSpot.map,x:snap.x,y:snap.y
       });
       if(!response?.receivers?.includes('Hibari'))lastReason='SAFE_SPOT_MESSAGE_UNDELIVERED';
       else lastReason='SOUJI_SAFE_SPOT_READY_SENT';
     }catch(_){lastReason='SAFE_SPOT_MESSAGE_SEND_FAILED'}
   }else{
     if(event.name!=='Souji'||m.kind!=='O66_SOUJI_SAFE_SPOT_READY'||
        !pending||m.nonce!==pending.nonce||!NONCE.test(m.nonce||'')||
        m.map!==waitSpot.map||!Number.isFinite(m.x)||!Number.isFinite(m.y)||
        Math.hypot(m.x-waitSpot.x,m.y-waitSpot.y)>waitSpot.radius||
        typeof trust?.verifyPriestReadyReply!=='function')return;
     let allowed=false;
     try{allowed=trust.verifyPriestReadyReply(m,{...id,challenge:pending.nonce,
       challengeAt:pending.at,receivedAt:stamp(),nativeSender:event.name})===true}catch(_){}
     if(!allowed){lastReason='PRIEST_READY_INDEPENDENT_PROOF_REQUIRED';return;}
     receipt=Object.freeze({kind:'SAFE_SPOT_READY',sender:'Souji',
       map:m.map,x:m.x,y:m.y,at:m.at,receivedAt:stamp(),nonce:m.nonce});
     pending=null;lastReason='SOUJI_SERVER_CM_AND_INDEPENDENT_PROOF_VERIFIED';
   }
 }
 function start(){
   if(started)return{ok:true,already:true};
   if(closed)return{ok:false,reason:'HANDSHAKE_STOPPED'};
   // Module startup precedes gameplay GO. We can subscribe to native CM
   // safely now, but never emit/accept a ready receipt until gameplayStarted.
   if(!pins(false)||typeof root.character?.on!=='function'||
      typeof root.send_cm!=='function'||!trust||
      (role==='Souji'&&typeof trust.verifySoujiSafeSpot!=='function')||
      (role==='Hibari'&&typeof trust.verifyPriestReadyReply!=='function')){
     return{ok:false,reason:'PARTY_SIGNAL_NATIVE_AND_TRUST_REQUIRED'};
   }
   started=true;
   root.character.on('cm',onMessage);
   lastReason='LISTENING_NATIVE_CM';
   return{ok:true};
 }
 async function request(){
   if(role!=='Hibari'||!started||closed||!pins())
     return{ok:false,reason:'HIBARI_PARTY_SIGNAL_NOT_READY'};
   if(receipt&&verify(receipt))return{ok:true,ready:true};
   if(pending)return{ok:true,pending:true};
   if(seen.size>0)return{ok:false,reason:'ONE_SHOT_CHALLENGE_ALREADY_USED'};
   const bytes=new Uint8Array(16);
   if(typeof root.crypto?.getRandomValues!=='function')
     return{ok:false,reason:'CRYPTO_RANDOM_UNAVAILABLE'};
   root.crypto.getRandomValues(bytes);
   const nonce=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
   if(!NONCE.test(nonce))return{ok:false,reason:'CHALLENGE_GENERATION_FAILED'};
   const id=pins();
   pending={nonce,at:stamp()};seen.add(nonce);
   try{
     const out=await root.send_cm('Souji',{
       kind:'O66_SOUJI_SAFE_SPOT_CHALLENGE',...id,nonce,at:pending.at
     });
     if(!out?.receivers?.includes('Souji')){
       lastReason='CHALLENGE_UNDELIVERED';return{ok:false,reason:lastReason};
     }
     lastReason='AWAIT_SOUJI_READY';
     return{ok:true,pending:true};
   }catch(_){lastReason='CHALLENGE_SEND_FAILED';return{ok:false,reason:lastReason}}
 }
 function latest(){return receipt&&verify(receipt)?receipt:null}
 function verify(value){
   return started&&!closed&&value===receipt&&receipt!==null&&
     !!pins()&&fresh(receipt)&&
     Number.isSafeInteger(receipt.receivedAt)&&
     stamp()>=receipt.receivedAt&&stamp()-receipt.receivedAt<=maxAgeMs;
 }
 function stop(){
   closed=true;started=false;pending=null;receipt=null;
   try{root.character?.off?.('cm',onMessage)}catch(_){}
   return{ok:true};
 }
 function status(){return Object.freeze({role,started,closed,pending:!!pending,
   ready:!!latest(),lastReason,autoRetry:false});}
 return Object.freeze({start,request,latest,verify,stop,status});
}
module.exports={createPriestSafeSpotHandshake};

},{"../../bootstrap/FighterFirstState":"bootstrap/FighterFirstState.js"}],
"ligaments/shop/ShopBankHandoff.js":[function(require,module,exports){
'use strict';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function createShopBankHandoff({shop,bankRetrieve}={}){
  if(!shop||typeof shop.status!=='function')throw new Error('SHOP_BANK_SHOP_REQUIRED');
  if(!bankRetrieve||typeof bankRetrieve.retrieveExact!=='function')throw new Error('SHOP_BANK_RETRIEVE_REQUIRED');
  async function handoff(){
    const status=shop.status(),requests=status&&status.plan&&status.plan.bankPull||[];
    if(!requests.length)return{ok:true,skipped:true,reason:'NO_SHOP_BANK_PULL'};
    const request=clone(requests[0]);
    const out=await bankRetrieve.retrieveExact({pack:request.source.pack,slot:request.source.slot,allowStack:true});
    if(!out||out.ok!==true)return{ok:false,error:'SHOP_BANK_PULL_FAILED',request,detail:clone(out)};
    return{ok:true,staged:true,reason:'SHOP_BANK_PULL_STAGED',request,result:clone(out)};
  }
  return{handoff};
}
module.exports={createShopBankHandoff};

},{}],
"ligaments/shop/ShopConfig.js":[function(require,module,exports){
'use strict';

const SLICE_FLAVORS=Object.freeze([
  'slice_strawberry','slice_citrus','slice_honey','slice_mint','slice_blueberry','slice_nightberry'
]);

const DEFAULT_SHOP_CONFIG=Object.freeze({
  schema:1,
  enabled:true,
  sales:Object.freeze([]),
  trade:Object.freeze({
    enabled:true,
    createOwnOffers:true,
    acceptExternal:true,
    offeredItem:'slice_blueberry',
    flavors:SLICE_FLAVORS,
    targetStart:20,
    targetStep:10,
    targetMax:null,
    minReceivePerBlueberry:1,
    maxOwnOffers:5,
    useBank:true
  })
});

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function int(v,fallback,min=0){const n=Math.floor(Number(v));return Number.isFinite(n)&&n>=min?n:fallback;}
function finite(v,fallback){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function text(v,max=80){return String(v==null?'':v).trim().slice(0,max);}

function normalizeSaleRule(row,index){
  row=row&&typeof row==='object'?row:{};
  const match=row.match&&typeof row.match==='object'?row.match:{};
  const name=text(match.name||row.name,80);
  return{
    id:text(row.id,80)||('sale-'+index),
    enabled:row.enabled!==false,
    match:{
      name:name||null,
      level:match.level==null?null:int(match.level,0,0),
      p:match.p==null?null:text(match.p,40),
      shiny:match.shiny===true
    },
    keep:int(row.keep,0,0),
    quantity:row.quantity==null?null:int(row.quantity,1,1),
    price:Math.max(0,finite(row.price,0)),
    useBank:row.useBank!==false
  };
}

function normalizeShopConfig(input={}){
  input=input&&typeof input==='object'?input:{};
  const trade=input.trade&&typeof input.trade==='object'?input.trade:{};
  const max=trade.targetMax==null||trade.targetMax===''?null:int(trade.targetMax,null,1);
  const flavors=Array.isArray(trade.flavors)?trade.flavors.map(x=>text(x,80)).filter(x=>SLICE_FLAVORS.includes(x)):SLICE_FLAVORS.slice();
  const unique=[...new Set(flavors)];
  const targetStart=int(trade.targetStart,20,1);
  const targetStep=int(trade.targetStep,10,1);
  return{
    schema:1,
    enabled:input.enabled!==false,
    sales:(Array.isArray(input.sales)?input.sales:[]).map(normalizeSaleRule).filter(x=>x.match.name||x.match.shiny),
    trade:{
      enabled:trade.enabled!==false,
      createOwnOffers:trade.createOwnOffers!==false,
      acceptExternal:trade.acceptExternal!==false,
      offeredItem:SLICE_FLAVORS.includes(text(trade.offeredItem,80))?text(trade.offeredItem,80):'slice_blueberry',
      flavors:unique.length?unique:SLICE_FLAVORS.slice(),
      targetStart,
      targetStep,
      targetMax:max!=null?Math.max(targetStart,max):null,
      minReceivePerBlueberry:Math.max(0.01,finite(trade.minReceivePerBlueberry,1)),
      maxOwnOffers:int(trade.maxOwnOffers,5,1),
      useBank:trade.useBank!==false
    }
  };
}

module.exports={SLICE_FLAVORS,DEFAULT_SHOP_CONFIG,normalizeShopConfig,normalizeSaleRule,clone};

},{}],
"ligaments/shop/ShopLimb.js":[function(require,module,exports){
'use strict';

const {normalizeShopConfig}=require('./ShopConfig');
const {createTradeLimb,sourceBankEntries}=require('./trade/TradeLimb');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function q(item){return Math.max(1,Math.floor(Number(item&&item.q||1)));}
function match(item,rule){
  if(!item||!rule||rule.enabled===false)return false;
  const m=rule.match||{};
  if(m.name&&item.name!==m.name)return false;
  if(m.level!=null&&Number(item.level||0)!==Number(m.level))return false;
  if(m.p!=null&&String(item.p||'')!==String(m.p))return false;
  if(m.shiny===true&&String(item.p||'').toLowerCase()!=='shiny')return false;
  return true;
}
function countMatches(inventory,bank,rule){
  let n=0;for(const item of inventory||[])if(match(item,rule))n+=q(item);
  for(const row of sourceBankEntries(bank))if(match(row.item,rule))n+=q(row.item);
  return n;
}

function createShopLimb({tradeLimb=createTradeLimb()}={}){
  let config=normalizeShopConfig({});
  let lastPlan=null;

  function setConfig(next){config=normalizeShopConfig(next);return clone(config);}
  function getConfig(){return clone(config);}
  function planSales(inventory,bank){
    const saleIntents=[],bankPull=[];
    for(const rule of config.sales){
      if(!rule.enabled)continue;
      const total=countMatches(inventory,bank,rule),available=Math.max(0,total-rule.keep);
      if(!available)continue;
      let remaining=rule.quantity==null?available:Math.min(available,rule.quantity);
      for(let slot=0;slot<(inventory||[]).length&&remaining>0;slot++){
        const item=inventory[slot];if(!match(item,rule))continue;
        const amount=Math.min(q(item),remaining);
        saleIntents.push({ruleId:rule.id,inventorySlot:slot,item:clone(item),quantity:amount,price:rule.price});
        remaining-=amount;
      }
      if(remaining>0&&rule.useBank){
        for(const row of sourceBankEntries(bank)){
          if(remaining<=0)break;if(!match(row.item,rule))continue;
          bankPull.push({kind:'SHOP_SALE',ruleId:rule.id,name:row.item.name,quantity:q(row.item),source:{pack:row.pack,slot:row.slot},reason:'SHOP_SALE_STAGING'});
          remaining-=q(row.item);
        }
      }
    }
    return{saleIntents,bankPull};
  }

  function plan({inventory=[],bank=null,visibleMerchants=[],standSlots={}}={}){
    const sales=planSales(inventory,bank);
    const trade=tradeLimb.plan({config,inventory,bank,visibleMerchants,standSlots});
    lastPlan={
      ok:true,enabled:config.enabled,
      sales:sales.saleIntents,
      trade,
      bankPull:[...sales.bankPull,...trade.bankPull],
      needsBank:[...sales.bankPull,...trade.bankPull].length>0
    };
    return clone(lastPlan);
  }

  function routingHint(){
    if(lastPlan&&lastPlan.needsBank)return{state:'BANK',reason:'SHOP_BANK_PULL_REQUIRED',count:lastPlan.bankPull.length};
    return null;
  }
  function status(){return{ok:true,config:getConfig(),plan:clone(lastPlan),trade:tradeLimb.snapshot()};}
  function snapshot(){return{version:1,config:getConfig(),trade:tradeLimb.snapshot()};}
  function restore(saved){if(!saved||saved.version!==1)throw new Error('SHOP_SNAPSHOT_INVALID');setConfig(saved.config||{});tradeLimb.restore(saved.trade||{version:1,target:config.trade.targetStart});return status();}
  return{setConfig,getConfig,plan,routingHint,status,snapshot,restore,match,countMatches};
}

module.exports={createShopLimb,match,countMatches};

},{"./ShopConfig":"ligaments/shop/ShopConfig.js","./trade/TradeLimb":"ligaments/shop/trade/TradeLimb.js"}],
"ligaments/shop/ShopService.js":[function(require,module,exports){
'use strict';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function createShopService({shop,inventory,adapter,bankSnapshot=null}={}){
  if(!shop||typeof shop.plan!=='function'||typeof shop.setConfig!=='function')throw new Error('SHOP_LIMB_REQUIRED');
  if(!inventory||typeof inventory.snapshot!=='function'||typeof inventory.reserve!=='function'||typeof inventory.release!=='function')throw new Error('SHOP_INVENTORY_REQUIRED');
  if(!adapter||typeof adapter.standSlots!=='function'||typeof adapter.visibleMerchants!=='function')throw new Error('SHOP_ADAPTER_REQUIRED');
  let last=null;
  let bankCache=null;
  let bankKnown=false;

  async function refreshConfig(){
    if(typeof adapter.readConfig!=='function')return{ok:true,skipped:true};
    const row=await adapter.readConfig();
    if(row&&row.ok===true&&row.config){shop.setConfig(row.config);return{ok:true,config:shop.getConfig()};}
    return row||{ok:false,error:'SHOP_CONFIG_READ_FAILED'};
  }
  async function bank(){
    try{
      const next=typeof bankSnapshot==='function'?await bankSnapshot():bankSnapshot;
      if(next&&typeof next==='object'){bankCache=clone(next);bankKnown=true;}
    }catch(error){}
    return clone(bankCache);
  }
  function needsBankKnowledge(){
    const c=shop.getConfig();
    return !!(c&&c.enabled&&((c.trade&&c.trade.enabled&&c.trade.useBank)||(c.sales||[]).some(x=>x&&x.enabled!==false&&x.useBank!==false)));
  }
  async function plan(){
    const items=await inventory.snapshot();
    const out=shop.plan({inventory:items,bank:await bank(),visibleMerchants:adapter.visibleMerchants(),standSlots:adapter.standSlots()});
    last=clone(out);return out;
  }
  async function findSpendable(name,quantity){
    const rows=await inventory.find(name);const need=Math.max(1,Number(quantity)||1);
    return rows.find(x=>Number(x.item&&x.item.q||1)>=need)||null;
  }
  async function withReservation(row,owner,fn){
    if(!row)return{ok:false,error:'SHOP_INVENTORY_ITEM_UNAVAILABLE'};
    const held=await inventory.reserve(row.slot,owner,{expected:row.identity});
    if(!held||held.ok!==true)return held||{ok:false,error:'SHOP_RESERVE_FAILED'};
    try{return await fn(row.slot,row.item);}finally{inventory.release(row.slot,owner);}
  }
  async function execute({refresh=true}={}){
    if(refresh)await refreshConfig();
    const work=await plan();
    const results={cancelled:[],external:[],offers:[],sales:[],bankPull:clone(work.bankPull)};

    for(const offer of work.trade.cancelOffers||[]){
      if(typeof adapter.removeListing!=='function'){results.cancelled.push({ok:false,error:'SHOP_UNLIST_UNAVAILABLE',offer});continue;}
      results.cancelled.push(await adapter.removeListing(offer.slot));
    }

    for(const trade of work.trade.externalTrades||[]){
      const row=await findSpendable(trade.give.name,trade.give.q);
      const target=typeof adapter.visibleMerchant==='function'?adapter.visibleMerchant(trade.targetId):null;
      if(!target){results.external.push({ok:false,error:'SHOP_TRADE_TARGET_NOT_VISIBLE',trade});continue;}
      results.external.push(await withReservation(row,'SHOP_TRADE_SWAP',slot=>adapter.tradeSwap(target,trade.slot,slot)));
    }

    for(const offer of work.trade.ownOffers||[]){
      const row=await findSpendable(offer.give.name,offer.give.q);
      results.offers.push(await withReservation(row,'SHOP_TRADE_OFFER',slot=>adapter.tradeOffer(slot,offer.slot,offer.want,offer.quantity)));
    }

    const occupied=new Set(Object.keys(adapter.standSlots()||{}));
    for(const offer of work.trade.ownOffers||[])occupied.add(offer.slot);
    const free=[];for(let i=48;i>=1;i--){const s='trade'+i;if(!occupied.has(s))free.push(s);}
    for(const sale of work.sales||[]){
      const tradeSlot=free.shift();if(!tradeSlot){results.sales.push({ok:false,error:'SHOP_NO_FREE_TRADE_SLOT',sale});break;}
      const item=await inventory.slot(sale.inventorySlot);
      const row=item?{slot:sale.inventorySlot,item,identity:inventory.identity(item)}:null;
      results.sales.push(await withReservation(row,'SHOP_SALE',slot=>adapter.listSale(slot,tradeSlot,sale.price,sale.quantity)));
    }
    last={...clone(work),execution:clone(results)};
    return{ok:true,plan:clone(work),results};
  }
  function routingHint(){
    const hint=shop.routingHint();if(hint)return hint;
    if(!bankKnown&&needsBankKnowledge())return{state:'BANK',reason:'SHOP_BANK_SCAN_REQUIRED',count:0};
    return null;
  }
  async function start(){await refreshConfig();try{await plan();}catch(error){}return{ok:true,bankKnown};}
  async function health(){return{ok:true,bankKnown,needsBankKnowledge:needsBankKnowledge(),routingHint:routingHint(),last:clone(last)};}
  function status(){return{ok:true,last:clone(last),shop:shop.status(),bankKnown,bankCache:clone(bankCache)};}
  function snapshot(){return{version:1,shop:shop.snapshot(),bankKnown,bankCache:clone(bankCache),last:clone(last)};}
  function restore(saved){
    if(!saved||saved.version!==1)throw new Error('SHOP_SERVICE_SNAPSHOT_INVALID');
    shop.restore(saved.shop);
    bankKnown=saved.bankKnown===true;
    bankCache=clone(saved.bankCache||null);
    last=clone(saved.last||null);
    return status();
  }
  return{start,health,refreshConfig,plan,execute,routingHint,status,snapshot,restore};
}

module.exports={createShopService};

},{}],
"ligaments/shop/trade/TradeLimb.js":[function(require,module,exports){
'use strict';

const {SLICE_FLAVORS,normalizeShopConfig}=require('../ShopConfig');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function qty(item){return Math.max(1,Math.floor(Number(item&&item.q||1)));}
function sourceBankEntries(snapshot){
  const source=snapshot&&snapshot.packs&&typeof snapshot.packs==='object'?snapshot.packs:snapshot;
  const out=[];
  for(const [pack,rows] of Object.entries(source||{})){
    if(!Array.isArray(rows))continue;
    for(let slot=0;slot<rows.length;slot++)if(rows[slot])out.push({pack,slot,item:rows[slot]});
  }
  return out;
}
function tradeSlotRows(standSlots){
  const out=[];
  for(const [slot,listing] of Object.entries(standSlots&&typeof standSlots==='object'?standSlots:{})){
    if(!/^trade\d+$/i.test(slot)||!listing)continue;
    out.push({slot,listing});
  }
  return out;
}
function countFlavors(items=[],bankSnapshot=null,flavors=SLICE_FLAVORS,standSlots=null){
  const counts=Object.fromEntries(flavors.map(x=>[x,0]));
  for(const item of items||[])if(item&&Object.prototype.hasOwnProperty.call(counts,item.name))counts[item.name]+=qty(item);
  for(const row of sourceBankEntries(bankSnapshot))if(row.item&&Object.prototype.hasOwnProperty.call(counts,row.item.name))counts[row.item.name]+=qty(row.item);
  for(const row of tradeSlotRows(standSlots))if(row.listing&&Object.prototype.hasOwnProperty.call(counts,row.listing.name))counts[row.listing.name]+=qty(row.listing);
  return counts;
}
function advanceTarget(current,counts,trade){
  let target=Math.max(Number(current||0),Number(trade.targetStart||20));
  const step=Math.max(1,Number(trade.targetStep||10));
  const max=trade.targetMax==null?null:Number(trade.targetMax);
  const all=()=>trade.flavors.every(name=>Number(counts[name]||0)>=target);
  let guard=0;
  while(all()&&guard++<10000){
    if(max!=null&&target>=max)break;
    const next=max==null?target+step:Math.min(max,target+step);
    if(next===target)break;
    target=next;
  }
  return target;
}
function inventoryQuantity(items,name){let n=0;for(const x of items||[])if(x&&x.name===name)n+=qty(x);return n;}
function bankSources(snapshot,name){return sourceBankEntries(snapshot).filter(x=>x.item&&x.item.name===name).map(clone);}
function freeTradeSlots(standSlots,max){
  const out=[];const slots=standSlots&&typeof standSlots==='object'?standSlots:{};
  for(let i=48;i>=1&&out.length<max;i--){const key='trade'+i;if(!slots[key])out.push(key);}
  return out;
}
function listingRows(merchants){
  const out=[];
  for(const merchant of merchants||[]){
    if(!merchant||!merchant.slots)continue;
    for(const [slot,listing] of Object.entries(merchant.slots)){
      if(!/^trade\d+$/i.test(slot)||!listing||!listing.want)continue;
      out.push({merchant,slot,listing});
    }
  }
  return out;
}
function existingOwnOffers(standSlots,offered,flavors){
  return tradeSlotRows(standSlots).filter(row=>{
    const l=row.listing,w=l&&l.want||{};
    return l&&String(l.name||'')===String(offered||'')&&flavors.includes(String(w.name||''))&&String(w.name||'')!==String(offered||'');
  }).map(row=>({
    slot:row.slot,
    give:{name:String(row.listing.name),q:qty(row.listing)},
    want:{name:String(row.listing.want.name),q:qty(row.listing.want)},
    rid:row.listing.rid||null
  })).sort((a,b)=>String(a.slot).localeCompare(String(b.slot),undefined,{numeric:true}));
}

function createTradeLimb({initialTarget=null}={}){
  let target=initialTarget==null?null:Number(initialTarget);

  function plan({config,inventory=[],bank=null,visibleMerchants=[],standSlots={}}={}){
    const shop=normalizeShopConfig(config),trade=shop.trade;
    const counts=countFlavors(inventory,bank,trade.flavors,standSlots);
    target=advanceTarget(target,counts,trade);
    const offered=trade.offeredItem;
    const surplus=Math.max(0,Number(counts[offered]||0)-target);
    const deficits={};
    for(const name of trade.flavors)deficits[name]=Math.max(0,target-Number(counts[name]||0));
    deficits[offered]=0;

    const remainingDeficits=clone(deficits);
    const existing=existingOwnOffers(standSlots,offered,trade.flavors);
    const keptOffers=[],cancelOffers=[];
    let committed=0;
    for(const offer of existing){
      const wanted=offer.want.name,give=Math.max(1,Number(offer.give.q||1)),receive=Math.max(1,Number(offer.want.q||1));
      const valid=shop.enabled&&trade.enabled&&trade.createOwnOffers&&
        keptOffers.length<trade.maxOwnOffers&&
        give<=Math.max(0,surplus-committed)&&
        Number(remainingDeficits[wanted]||0)>0;
      if(!valid){cancelOffers.push({...clone(offer),reason:'SHOP_OFFER_NO_LONGER_SAFE'});continue;}
      keptOffers.push(clone(offer));
      committed+=give;
      remainingDeficits[wanted]=Math.max(0,Number(remainingDeficits[wanted]||0)-receive);
    }

    let budget=Math.max(0,surplus-committed);
    const external=[];
    if(shop.enabled&&trade.enabled&&trade.acceptExternal&&budget>0){
      const rows=listingRows(visibleMerchants).filter(row=>{
        const l=row.listing,w=l.want||{};
        if(String(w.name||'')!==offered)return false;
        if(!trade.flavors.includes(String(l.name||''))||String(l.name||'')===offered)return false;
        if(Number(remainingDeficits[l.name]||0)<=0)return false;
        const give=Math.max(1,Number(w.q||1)),receive=Math.max(1,Number(l.q||1));
        return receive/give>=trade.minReceivePerBlueberry;
      }).sort((a,b)=>{
        const ar=Math.max(1,Number(a.listing.q||1))/Math.max(1,Number(a.listing.want&&a.listing.want.q||1));
        const br=Math.max(1,Number(b.listing.q||1))/Math.max(1,Number(b.listing.want&&b.listing.want.q||1));
        return br-ar||String(a.merchant.id||a.merchant.name||'').localeCompare(String(b.merchant.id||b.merchant.name||''));
      });
      for(const row of rows){
        const give=Math.max(1,Number(row.listing.want.q||1)),receive=Math.max(1,Number(row.listing.q||1));
        if(give>budget||receive>Number(remainingDeficits[row.listing.name]||0))continue;
        external.push({targetId:String(row.merchant.id||row.merchant.name||''),slot:row.slot,give:{name:offered,q:give},receive:{name:row.listing.name,q:receive},rid:row.listing.rid||null,reason:'EXTERNAL_SLICE_BALANCE'});
        budget-=give;remainingDeficits[row.listing.name]=Math.max(0,remainingDeficits[row.listing.name]-receive);
        if(budget<=0)break;
      }
    }

    const ownOffers=[];
    if(shop.enabled&&trade.enabled&&trade.createOwnOffers&&budget>0&&keptOffers.length<trade.maxOwnOffers){
      const slots=freeTradeSlots(standSlots,Math.max(0,trade.maxOwnOffers-keptOffers.length));
      const needed=trade.flavors.filter(name=>name!==offered&&remainingDeficits[name]>0).sort((a,b)=>remainingDeficits[b]-remainingDeficits[a]||a.localeCompare(b));
      for(let i=0;i<needed.length&&i<slots.length&&budget>0;i++){
        ownOffers.push({slot:slots[i],give:{name:offered,q:1},want:{name:needed[i],q:1},quantity:1,reason:'BALANCE_DEFICIT'});
        budget--;
        remainingDeficits[needed[i]]=Math.max(0,remainingDeficits[needed[i]]-1);
      }
    }

    const inventoryBlue=inventoryQuantity(inventory,offered);
    const requiredBlue=ownOffers.reduce((n,x)=>n+x.give.q,0)+external.reduce((n,x)=>n+x.give.q,0);
    const bankPull=[];
    if(trade.useBank&&requiredBlue>inventoryBlue){
      let remaining=requiredBlue-inventoryBlue;
      for(const src of bankSources(bank,offered)){
        if(remaining<=0)break;
        bankPull.push({kind:'SHOP_TRADE',name:offered,quantity:qty(src.item),source:{pack:src.pack,slot:src.slot},reason:'BLUEBERRY_TRADE_STAGING'});
        remaining-=qty(src.item);
      }
    }

    return{
      ok:true,target,counts,balanced:trade.flavors.every(x=>counts[x]>=target),surplus:{[offered]:surplus},deficits,
      remainingDeficits,keptOffers,cancelOffers,ownOffers,externalTrades:external,bankPull,
      committed:{[offered]:committed},
      settings:clone(trade)
    };
  }
  function snapshot(){return{version:1,target};}
  function restore(saved){if(!saved||saved.version!==1)throw new Error('SHOP_TRADE_SNAPSHOT_INVALID');target=Math.max(1,Number(saved.target||20));return snapshot();}
  return{plan,snapshot,restore,getTarget:()=>target};
}

module.exports={createTradeLimb,countFlavors,advanceTarget,sourceBankEntries,freeTradeSlots,listingRows,tradeSlotRows,existingOwnOffers};

},{"../ShopConfig":"ligaments/shop/ShopConfig.js"}],
"ligaments/skills/CooldownService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createCooldownService({now=Date.now,arbiter=null}={}){
  const skills=new Map();

  function observe(skill,{ready=null,readyAt=null}={}){
    const key=String(skill||'');
    if(!key)return{ok:false,error:'SKILL_REQUIRED'};
    const row=skills.get(key)||{skill:key,ready:null,ready_at:null,updated_at:null};
    if(ready!=null)row.ready=ready===true;
    if(readyAt!=null)row.ready_at=Number(readyAt);
    row.updated_at=Number(now());
    skills.set(key,row);
    return{ok:true,status:clone(row)};
  }

  function status(skill){
    const key=String(skill||''),row=skills.get(key);
    if(!row)return{skill:key,ready:false,reason:'UNKNOWN'};
    const t=Number(now());
    const timeReady=row.ready_at==null?true:t>=Number(row.ready_at);
    return{...clone(row),ready:row.ready===true&&timeReady};
  }

  function acquire(skill,owner,{priority=0}={}){
    const s=status(skill);
    if(!s.ready)return{ok:false,error:'SKILL_COOLDOWN',status:s};
    if(!arbiter)return{ok:true,lease:null};
    return arbiter.acquire('SKILL:'+String(skill),String(owner||''),{priority,allowPreempt:true});
  }

  function release(skill,owner){
    if(!arbiter)return{ok:true,released:false};
    return arbiter.release('SKILL:'+String(skill),String(owner||''));
  }

  function all(){return Array.from(skills.keys()).sort().map(status);}
  return{observe,status,acquire,release,all};
}

module.exports={createCooldownService};

},{}],
"ligaments/skills/MluckService.js":[function(require,module,exports){
'use strict';

// Version-neutral V3 Merchant skill lane. The Adventure.Land adapter owns
// actual native skill calls; this service handles policy and decisions only.
function createMluckService({adapter,now=Date.now,refreshBelowMs=15*60000,retryMs=5000}={}){
  if(!adapter||typeof adapter.snapshot!=='function'||typeof adapter.cast!=='function')throw Error('MLUCK_ADAPTER_REQUIRED');
  let lastAttempt={},lastCast=null,busy=false,casts=0;
  const names=['Hibari','Souji','Harutora'];
  function reason(row,crew,at){
    if(!row||row.visible===false||row.inRange===false||row.dead===true)return null;
    const buff=row.mluck||null,owner=String(buff&&buff.owner||'');
    if(!buff)return 'MISSING';
    if(owner==='Rentaro'&&Number(buff.remaining_ms)<=refreshBelowMs)return 'REFRESH';
    if(owner==='Rentaro')return null;
    if(crew)return 'RECLAIM_CREW';
    if(buff.strong===true)return null;
    if(!owner)return null;
    if(row.foreignOwnerOnline!==false)return null;
    return 'RECLAIM_ABSENT_MERCHANT';
  }
  async function tick(){
    if(busy)return{ok:true,cast:false,reason:'BUSY'};
    busy=true;
    try{
      const snapshot=await adapter.snapshot();
      if(!snapshot||snapshot.rip||snapshot.dead||snapshot.threatened||snapshot.cooldownReady===false)return{ok:true,cast:false,reason:'UNSAFE_OR_COOLDOWN'};
      const nowMs=Number(now());
      const peers=(Array.isArray(snapshot.nearby)?snapshot.nearby:[]).filter(Boolean);
      const own=peers.find(x=>x.name==='Rentaro')||snapshot.self||null;
      const ordered=[own,...names.map(n=>peers.find(x=>x.name===n)),...peers.filter(x=>!names.includes(x.name)&&x.name!=='Rentaro')].filter(Boolean);
      for(const item of ordered){
        const name=String(item.name||'');if(!name)continue;
        const why=reason(item,name==='Rentaro'||names.includes(name),nowMs);
        if(!why||nowMs-Number(lastAttempt[name]||0)<retryMs)continue;
        lastAttempt[name]=nowMs;
        const res=await adapter.cast('mluck',name);
        if(!res||res.ok===false)continue;
        casts++;lastCast={name,reason:why,at:nowMs};
        return{ok:true,cast:true,target:name,reason:why};
      }
      return{ok:true,cast:false,reason:'NO_ELIGIBLE_TARGET'};
    }finally{busy=false;}
  }
  function status(){return{casts,lastCast,busy,retryMs,refreshBelowMs,policy:'CREW_FIRST_COMMUNITY_IF_NEEDED_NO_CHASE'};}
  return{tick,status};
}
module.exports={createMluckService};

},{}],
"ligaments/targeting/TargetingService.js":[function(require,module,exports){
'use strict';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}

function createTargetingService({now=Date.now,leaseMs=3000}={}){
  let observed={};
  let lease=null;

  function observe(entities={}){
    observed={};
    for(const [id,value] of Object.entries(entities||{}))observed[String(id)]=clone(value);
    return{ok:true,count:Object.keys(observed).length};
  }

  function validTarget(entity){
    return !!entity&&entity.type==='monster'&&entity.dead!==true&&entity.rip!==true&&entity.visible!==false;
  }

  function select({predicate=()=>true,score=()=>0}={}){
    const rows=[];
    for(const [id,entity] of Object.entries(observed)){
      if(!validTarget(entity)||predicate(entity,id)!==true)continue;
      rows.push({id,entity:clone(entity),score:Number(score(entity,id))||0});
    }
    rows.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    return rows[0]||null;
  }

  function acquire(owner,targetId,{priority=0}={}){
    const who=String(owner||''),id=String(targetId||''),t=Number(now());
    if(!who||!id)return{ok:false,error:'TARGET_OWNER_AND_ID_REQUIRED'};
    const entity=observed[id];
    if(!validTarget(entity))return{ok:false,error:'TARGET_NOT_VISIBLE_OR_VALID'};
    if(lease&&lease.expires_at>t&&lease.owner!==who&&Number(priority)<=Number(lease.priority||0)){
      return{ok:false,error:'TARGET_OWNED',lease:clone(lease)};
    }
    const preempted=lease&&lease.expires_at>t?clone(lease):null;
    lease={owner:who,target_id:id,priority:Number(priority)||0,acquired_at:t,expires_at:t+Number(leaseMs)};
    return{ok:true,lease:clone(lease),preempted};
  }

  function renew(owner,targetId){
    const who=String(owner||''),id=String(targetId||''),t=Number(now());
    if(!lease||lease.owner!==who||lease.target_id!==id)return{ok:false,error:'TARGET_LEASE_NOT_OWNED'};
    if(!validTarget(observed[id]))return{ok:false,error:'TARGET_NOT_VISIBLE_OR_VALID'};
    lease.expires_at=t+Number(leaseMs);
    return{ok:true,lease:clone(lease)};
  }

  function authorize(owner,targetId){
    const t=Number(now()),who=String(owner||''),id=String(targetId||'');
    if(!lease||lease.expires_at<=t)return{ok:false,error:'TARGET_LEASE_EXPIRED'};
    if(lease.owner!==who||lease.target_id!==id)return{ok:false,error:'TARGET_LEASE_MISMATCH',lease:clone(lease)};
    if(!validTarget(observed[id]))return{ok:false,error:'TARGET_NOT_VISIBLE_OR_VALID'};
    return{ok:true,target:clone(observed[id]),lease:clone(lease)};
  }

  function release(owner){
    if(!lease)return{ok:true,released:false};
    if(lease.owner!==String(owner||''))return{ok:false,error:'TARGET_LEASE_OWNER_MISMATCH'};
    lease=null;
    return{ok:true,released:true};
  }

  function status(){return{lease:clone(lease),observed:Object.keys(observed).length};}
  return{observe,select,acquire,renew,authorize,release,status};
}

module.exports={createTargetingService};

},{}],
"navigation/PogiPathMerchantSharedRoutesV65.json":[function(require,module,exports){
module.exports={"meta":{"version":76,"pogiActiveCircuitTripId":"POGIMAP-RENTARO-ONE-CIRCUIT-V29-20261120","pogiEditableCircuitRouteId":"POGIMAP-RENTARO-V29-EDITABLE-20261121","pogiMerchantCircuitV29":{"tripId":"POGIMAP-RENTARO-ONE-CIRCUIT-V29-20261120","actionCount":995,"sourceModelHash":"2dc3472e38cb7136fd8459b9d538a6c2b0902eb4a4581cafd87bdc9b30616950"},"pogiCustomMapRoutes":[{"tripId":"POGIMAP-RENTARO-V29-EDITABLE-20261121","segments":[{"map":"main","deletedInDraft":false,"points":[{"map":"main","x":-90,"y":-87,"kind":"START"},{"map":"main","x":-170,"y":-87,"kind":"TURN"},{"map":"main","x":-263,"y":-85,"kind":"TURN"},{"map":"main","x":-317,"y":-55,"kind":"TURN"},{"map":"main","x":-352.31,"y":-8,"kind":"TURN"},{"map":"main","x":-908.05,"y":-7.36,"kind":"TURN"},{"map":"main","x":-1145,"y":-4,"kind":"TURN"},{"map":"main","x":-1168,"y":4,"kind":"TURN"},{"map":"main","x":-1169,"y":550,"kind":"TURN"},{"map":"main","x":-1084,"y":1027,"kind":"TURN"},{"map":"main","x":-965,"y":1588,"kind":"TURN"},{"map":"main","x":-675,"y":1472,"kind":"TURN"},{"map":"main","x":-260,"y":1466,"kind":"TURN"},{"map":"main","x":90,"y":1425,"kind":"TURN"},{"map":"main","x":143,"y":1405,"kind":"TURN"},{"map":"main","x":161,"y":1369,"kind":"END"}]},{"map":"cave","deletedInDraft":false,"points":[{"map":"cave","x":0.22,"y":-1.47,"kind":"START"},{"map":"cave","x":0.22,"y":-1.47,"kind":"TURN"},{"map":"cave","x":-3,"y":-197,"kind":"TURN"},{"map":"cave","x":585,"y":-187,"kind":"TURN"},{"map":"cave","x":589,"y":68,"kind":"TURN"},{"map":"cave","x":1087,"y":78,"kind":"TURN"},{"map":"cave","x":1117,"y":-13,"kind":"TURN"},{"map":"cave","x":1087,"y":-103,"kind":"MOVE"},{"map":"cave","x":1075,"y":-759,"kind":"MOVE"},{"map":"cave","x":974,"y":-740,"kind":"MOVE"},{"map":"cave","x":835,"y":-743,"kind":"MOVE"},{"map":"cave","x":741,"y":-821,"kind":"MOVE"},{"map":"cave","x":492,"y":-824,"kind":"MOVE"},{"map":"cave","x":324,"y":-1166,"kind":"MOVE"},{"map":"cave","x":-18,"y":-1175,"kind":"MOVE"}]},{"map":"cave","deletedInDraft":true,"points":[]},{"map":"cave","deletedInDraft":false,"points":[{"map":"cave","x":0,"y":0,"kind":"START"},{"map":"cave","x":0,"y":0,"kind":"END"}]},{"map":"main","deletedInDraft":false,"points":[{"map":"main","x":160,"y":1368,"kind":"START"},{"map":"main","x":163,"y":1388,"kind":"TURN"},{"map":"main","x":182,"y":1420,"kind":"TURN"},{"map":"main","x":537,"y":1753,"kind":"MOVE"},{"map":"main","x":663,"y":1699,"kind":"TURN"},{"map":"main","x":783,"y":1594,"kind":"TURN"},{"map":"main","x":774,"y":1415,"kind":"MOVE"},{"map":"main","x":653.31,"y":1193.76,"kind":"TURN"},{"map":"main","x":875.91,"y":1193.76,"kind":"TURN"},{"map":"main","x":908.03,"y":1187.76,"kind":"TURN"},{"map":"main","x":978.22,"y":1164.37,"kind":"TURN"},{"map":"main","x":978.66,"y":1092.43,"kind":"TURN"},{"map":"main","x":962.76,"y":1069.05,"kind":"TURN"},{"map":"main","x":938.14,"y":1036.23,"kind":"TURN"},{"map":"main","x":923.09,"y":1006.29,"kind":"TURN"},{"map":"main","x":863.02,"y":870.13,"kind":"TURN"},{"map":"main","x":878.21,"y":904.56,"kind":"TURN"},{"map":"main","x":923.09,"y":1006.29,"kind":"TURN"},{"map":"main","x":938.14,"y":1036.23,"kind":"TURN"},{"map":"main","x":962.76,"y":1069.05,"kind":"TURN"},{"map":"main","x":997.24,"y":1063.95,"kind":"TURN"},{"map":"main","x":1179.86,"y":1027.43,"kind":"TURN"},{"map":"main","x":1202.61,"y":1013.21,"kind":"TURN"},{"map":"main","x":1248,"y":733,"kind":"MOVE"},{"map":"main","x":1245,"y":442,"kind":"TURN"},{"map":"main","x":1223,"y":371,"kind":"MOVE"},{"map":"main","x":1143,"y":300,"kind":"MOVE"},{"map":"main","x":1148,"y":-42,"kind":"TURN"},{"map":"main","x":1179,"y":-128,"kind":"TURN"},{"map":"main","x":1200,"y":-186,"kind":"TURN"},{"map":"main","x":1526,"y":-10,"kind":"TURN"},{"map":"main","x":1711,"y":68,"kind":"TURN"},{"map":"main","x":1877,"y":74,"kind":"TURN"},{"map":"main","x":1928,"y":69,"kind":"TURN"},{"map":"main","x":1935,"y":14,"kind":"TURN"},{"map":"main","x":1937,"y":-12,"kind":"END"}]},{"map":"level1","deletedInDraft":false,"points":[{"map":"level1","x":0,"y":9,"kind":"START"},{"map":"level1","x":2,"y":13.56,"kind":"TURN"},{"map":"level1","x":79.49,"y":190.7,"kind":"TURN"},{"map":"level1","x":105,"y":222,"kind":"TURN"},{"map":"level1","x":115,"y":255,"kind":"TURN"},{"map":"level1","x":105,"y":291.93,"kind":"TURN"},{"map":"level1","x":105,"y":366.98,"kind":"TURN"},{"map":"level1","x":97.78,"y":400.86,"kind":"TURN"},{"map":"level1","x":68,"y":429,"kind":"TURN"},{"map":"level1","x":59,"y":463,"kind":"TURN"},{"map":"level1","x":60,"y":537.34,"kind":"TURN"},{"map":"level1","x":55.83,"y":572.34,"kind":"TURN"},{"map":"level1","x":47,"y":612,"kind":"TURN"},{"map":"level1","x":24,"y":634,"kind":"TURN"},{"map":"level1","x":-340,"y":636,"kind":"TURN"},{"map":"level1","x":-367,"y":627,"kind":"TURN"},{"map":"level1","x":-386,"y":612,"kind":"TURN"},{"map":"level1","x":-394.88,"y":584.98,"kind":"TURN"},{"map":"level1","x":-410,"y":472,"kind":"TURN"},{"map":"level1","x":-384,"y":459,"kind":"TURN"},{"map":"level1","x":-343,"y":469,"kind":"TURN"},{"map":"level1","x":-313,"y":533,"kind":"END"}]},{"map":"level2","deletedInDraft":false,"points":[{"map":"level2","x":-1,"y":-25,"kind":"START"},{"map":"level2","x":31,"y":12,"kind":"TURN"},{"map":"level2","x":42,"y":56,"kind":"MOVE"},{"map":"level2","x":81,"y":46,"kind":"END"}]},{"map":"spookytown","deletedInDraft":false,"points":[{"map":"spookytown","x":192,"y":-194,"kind":"START"},{"map":"spookytown","x":192,"y":-194,"kind":"TURN"},{"map":"spookytown","x":43.9,"y":-181.66,"kind":"TURN"},{"map":"spookytown","x":10.34,"y":-175.68,"kind":"TURN"},{"map":"spookytown","x":-6.39,"y":-142.21,"kind":"TURN"},{"map":"spookytown","x":-26.32,"y":-130.98,"kind":"TURN"},{"map":"spookytown","x":-18,"y":-109.67,"kind":"TURN"},{"map":"spookytown","x":-16.63,"y":-87.23,"kind":"TURN"},{"map":"spookytown","x":5.83,"y":-86.13,"kind":"TURN"},{"map":"spookytown","x":95.8,"y":-18.65,"kind":"TURN"},{"map":"spookytown","x":126.74,"y":-5.75,"kind":"TURN"},{"map":"spookytown","x":233.73,"y":29.91,"kind":"TURN"},{"map":"spookytown","x":304.73,"y":31,"kind":"TURN"},{"map":"spookytown","x":418,"y":30,"kind":"MOVE"},{"map":"spookytown","x":499,"y":35,"kind":"TURN"},{"map":"spookytown","x":416,"y":30,"kind":"TURN"},{"map":"spookytown","x":268.91,"y":31,"kind":"TURN"},{"map":"spookytown","x":233.73,"y":29.91,"kind":"TURN"},{"map":"spookytown","x":126.74,"y":-5.75,"kind":"TURN"},{"map":"spookytown","x":95.8,"y":-18.65,"kind":"TURN"},{"map":"spookytown","x":5.83,"y":-86.13,"kind":"TURN"},{"map":"spookytown","x":-16.63,"y":-87.23,"kind":"TURN"},{"map":"spookytown","x":-18,"y":-109.67,"kind":"TURN"},{"map":"spookytown","x":-26.32,"y":-130.98,"kind":"TURN"},{"map":"spookytown","x":-6.39,"y":-142.21,"kind":"TURN"},{"map":"spookytown","x":12.67,"y":-188.65,"kind":"TURN"},{"map":"spookytown","x":31.85,"y":-180,"kind":"TURN"},{"map":"spookytown","x":69.17,"y":-180,"kind":"TURN"},{"map":"spookytown","x":142.2,"y":-180,"kind":"END"}]},{"map":"level2","deletedInDraft":false,"points":[{"map":"level2","x":78,"y":49,"kind":"START"},{"map":"level2","x":42.14,"y":56,"kind":"TURN"},{"map":"level2","x":30,"y":12,"kind":"MOVE"},{"map":"level2","x":0,"y":-25,"kind":"END"}]},{"map":"level1","deletedInDraft":false,"points":[{"map":"level1","x":-329.8,"y":491.38,"kind":"START"},{"map":"level1","x":-335.14,"y":454.02,"kind":"TURN"},{"map":"level1","x":-356.07,"y":307.53,"kind":"TURN"},{"map":"level1","x":-400.93,"y":95.99,"kind":"TURN"},{"map":"level1","x":-408.8,"y":-44.93,"kind":"TURN"},{"map":"level1","x":-416.33,"y":-195.58,"kind":"END"}]},{"map":"halloween","deletedInDraft":false,"points":[{"map":"halloween","x":0,"y":0,"kind":"START"},{"map":"halloween","x":0,"y":0,"kind":"TURN"},{"map":"halloween","x":-400,"y":-224,"kind":"TURN"},{"map":"halloween","x":-550,"y":-452,"kind":"END"}]},{"map":"halloween","deletedInDraft":false,"points":[{"map":"halloween","x":0,"y":0,"kind":"START"},{"map":"halloween","x":0,"y":0,"kind":"TURN"},{"map":"halloween","x":32,"y":-72,"kind":"TURN"},{"map":"halloween","x":40,"y":-392,"kind":"TURN"},{"map":"halloween","x":120,"y":-520,"kind":"TURN"},{"map":"halloween","x":471,"y":-786.5,"kind":"TURN"},{"map":"halloween","x":498,"y":-803,"kind":"TURN"},{"map":"halloween","x":525,"y":-827.5,"kind":"TURN"},{"map":"halloween","x":552,"y":-848,"kind":"TURN"},{"map":"halloween","x":640,"y":-952,"kind":"TURN"},{"map":"halloween","x":696,"y":-952,"kind":"TURN"},{"map":"halloween","x":760,"y":-1000,"kind":"TURN"},{"map":"halloween","x":765,"y":-1016.13,"kind":"END"}]},{"map":"spookytown","deletedInDraft":false,"points":[{"map":"spookytown","x":0,"y":0,"kind":"START"},{"map":"spookytown","x":0,"y":0,"kind":"TURN"},{"map":"spookytown","x":-8,"y":424,"kind":"TURN"},{"map":"spookytown","x":-40,"y":448,"kind":"TURN"},{"map":"spookytown","x":-64,"y":600,"kind":"TURN"},{"map":"spookytown","x":-72,"y":624,"kind":"TURN"},{"map":"spookytown","x":-64,"y":648,"kind":"TURN"},{"map":"spookytown","x":64,"y":696,"kind":"TURN"},{"map":"spookytown","x":104,"y":824,"kind":"TURN"},{"map":"spookytown","x":136,"y":888,"kind":"TURN"},{"map":"spookytown","x":256,"y":1008,"kind":"TURN"},{"map":"spookytown","x":403,"y":1018,"kind":"TURN"},{"map":"spookytown","x":405,"y":1020,"kind":"END"}]},{"map":"spookytown","deletedInDraft":false,"points":[{"map":"spookytown","x":0,"y":0,"kind":"START"},{"map":"spookytown","x":0,"y":0,"kind":"TURN"},{"map":"spookytown","x":-463.66,"y":-25.61,"kind":"TURN"},{"map":"spookytown","x":-641.64,"y":-55.98,"kind":"TURN"},{"map":"spookytown","x":-704.44,"y":-93.67,"kind":"TURN"},{"map":"spookytown","x":-724.15,"y":-101.04,"kind":"TURN"},{"map":"spookytown","x":-716.46,"y":-120.62,"kind":"TURN"},{"map":"spookytown","x":-719,"y":-156,"kind":"END"}]},{"map":"spookytown","deletedInDraft":false,"points":[{"map":"spookytown","x":0,"y":0,"kind":"START"},{"map":"spookytown","x":-4.09,"y":-18.42,"kind":"TURN"},{"map":"spookytown","x":-20.37,"y":-91.68,"kind":"TURN"},{"map":"spookytown","x":-18,"y":-109.67,"kind":"TURN"},{"map":"spookytown","x":-26.32,"y":-130.98,"kind":"TURN"},{"map":"spookytown","x":-6.39,"y":-142.21,"kind":"TURN"},{"map":"spookytown","x":12.67,"y":-188.65,"kind":"TURN"},{"map":"spookytown","x":31.85,"y":-180,"kind":"TURN"},{"map":"spookytown","x":69.17,"y":-180,"kind":"TURN"},{"map":"spookytown","x":142.2,"y":-180,"kind":"END"}]},{"map":"level2","deletedInDraft":false,"points":[{"map":"level2","x":80,"y":48,"kind":"START"},{"map":"level2","x":42.14,"y":56,"kind":"TURN"},{"map":"level2","x":31,"y":25,"kind":"TURN"},{"map":"level2","x":7.37,"y":1.37,"kind":"TURN"},{"map":"level2","x":-6.1,"y":-5,"kind":"TURN"},{"map":"level2","x":-43.94,"y":-5,"kind":"TURN"},{"map":"level2","x":-76,"y":-19,"kind":"TURN"},{"map":"level2","x":-127,"y":-72,"kind":"TURN"},{"map":"level2","x":-315,"y":-75,"kind":"END"}]},{"map":"level2w","deletedInDraft":false,"points":[{"map":"level2w","x":26,"y":10,"kind":"START"},{"map":"level2w","x":-3,"y":8,"kind":"MOVE"},{"map":"level2w","x":-23,"y":1,"kind":"TURN"},{"map":"level2w","x":-54.76,"y":-19.31,"kind":"TURN"},{"map":"level2w","x":-70.06,"y":-48.66,"kind":"TURN"},{"map":"level2w","x":-84,"y":-83.5,"kind":"TURN"},{"map":"level2w","x":-96,"y":-126,"kind":"MOVE"},{"map":"level2w","x":-96,"y":-186,"kind":"END"}]},{"map":"level2n","deletedInDraft":false,"points":[{"map":"level2n","x":0.22,"y":-2.85,"kind":"START"},{"map":"level2n","x":3.11,"y":-40.37,"kind":"TURN"},{"map":"level2n","x":14.47,"y":-188.12,"kind":"TURN"},{"map":"level2n","x":4.86,"y":-215.29,"kind":"TURN"},{"map":"level2n","x":-4.6,"y":-252.6,"kind":"TURN"},{"map":"level2n","x":-10.82,"y":-289.93,"kind":"TURN"},{"map":"level2n","x":-22.76,"y":-320.17,"kind":"TURN"},{"map":"level2n","x":-84.06,"y":-361.04,"kind":"TURN"},{"map":"level2n","x":-105,"y":-384.33,"kind":"TURN"},{"map":"level2n","x":-105,"y":-630,"kind":"END"}]},{"map":"winterland","deletedInDraft":false,"points":[{"map":"winterland","x":4,"y":4,"kind":"START"},{"map":"winterland","x":3,"y":-723,"kind":"TURN"},{"map":"winterland","x":347.6,"y":-911.26,"kind":"TURN"},{"map":"winterland","x":633,"y":-912,"kind":"MOVE"},{"map":"winterland","x":767,"y":-947,"kind":"TURN"}]},{"map":"winterland","deletedInDraft":false,"points":[{"map":"winterland","x":0,"y":0,"kind":"START"},{"map":"winterland","x":0,"y":0,"kind":"TURN"},{"map":"winterland","x":-29.05,"y":-334.04,"kind":"TURN"},{"map":"winterland","x":-29.05,"y":-334.04,"kind":"END"}]},{"map":"desertland","deletedInDraft":false,"points":[{"map":"desertland","x":10,"y":-386,"kind":"START"},{"map":"desertland","x":33,"y":-397,"kind":"TURN"},{"map":"desertland","x":56,"y":-408,"kind":"TURN"},{"map":"desertland","x":192,"y":-1072,"kind":"TURN"},{"map":"desertland","x":192,"y":-1208,"kind":"TURN"},{"map":"desertland","x":390,"y":-1420,"kind":"END"}]},{"map":"desertland","deletedInDraft":false,"points":[{"map":"desertland","x":0,"y":0,"kind":"START"},{"map":"desertland","x":12.8,"y":-24,"kind":"TURN"},{"map":"desertland","x":64,"y":-120,"kind":"TURN"},{"map":"desertland","x":56,"y":-280,"kind":"TURN"},{"map":"desertland","x":10,"y":-386,"kind":"END"}]},{"map":"main","deletedInDraft":false,"points":[{"map":"main","x":0,"y":0,"kind":"START"},{"map":"main","x":0.8,"y":32,"kind":"TURN"},{"map":"main","x":16,"y":640,"kind":"TURN"},{"map":"main","x":312,"y":944,"kind":"TURN"},{"map":"main","x":752,"y":1216,"kind":"TURN"},{"map":"main","x":968,"y":1216,"kind":"TURN"},{"map":"main","x":992,"y":1152,"kind":"TURN"},{"map":"main","x":1040,"y":1048,"kind":"TURN"},{"map":"main","x":1208,"y":1016,"kind":"TURN"},{"map":"main","x":1216,"y":960,"kind":"TURN"},{"map":"main","x":1250,"y":595,"kind":"MOVE"},{"map":"main","x":1280,"y":320,"kind":"TURN"},{"map":"main","x":1496,"y":104,"kind":"TURN"},{"map":"main","x":1600,"y":-524,"kind":"END"}]},{"map":"halloween","deletedInDraft":false,"points":[{"map":"halloween","x":0,"y":0,"kind":"START"},{"map":"halloween","x":-0.66667,"y":30.66667,"kind":"TURN"},{"map":"halloween","x":-8,"y":368,"kind":"TURN"},{"map":"halloween","x":-200,"y":672,"kind":"TURN"},{"map":"halloween","x":-224,"y":680,"kind":"TURN"},{"map":"halloween","x":-253.55556,"y":680,"kind":"TOWN"}]},{"map":"halloween","deletedInDraft":false,"points":[{"map":"halloween","x":0,"y":0,"kind":"START"},{"map":"halloween","x":31.6,"y":-5.2,"kind":"TURN"},{"map":"halloween","x":632,"y":-104,"kind":"TURN"},{"map":"halloween","x":944,"y":-96,"kind":"TURN"},{"map":"halloween","x":1176,"y":-40,"kind":"TURN"},{"map":"halloween","x":1184,"y":-16,"kind":"TURN"},{"map":"halloween","x":1212,"y":101,"kind":"END"}]},{"map":"main","deletedInDraft":false,"points":[{"map":"main","x":0,"y":0,"kind":"START"},{"map":"main","x":-27.75,"y":28.37,"kind":"TURN"},{"map":"main","x":7.01,"y":397.32,"kind":"TURN"},{"map":"main","x":27.05,"y":437.09,"kind":"TURN"},{"map":"main","x":47.18,"y":457,"kind":"TURN"},{"map":"main","x":124.03,"y":457,"kind":"TURN"},{"map":"main","x":155.24,"y":440.86,"kind":"TURN"},{"map":"main","x":224.45,"y":401.31,"kind":"TURN"},{"map":"main","x":231,"y":398,"kind":"END"}]},{"map":"arena","deletedInDraft":false,"points":[{"map":"arena","x":151,"y":68,"kind":"START"},{"map":"arena","x":143,"y":26,"kind":"MOVE"},{"map":"arena","x":-133.4,"y":-206.71,"kind":"TURN"},{"map":"arena","x":-133.4,"y":-393.48,"kind":"TURN"},{"map":"arena","x":90,"y":-568,"kind":"END"}]}]}],"pogiEditableTransitDraft":{"sourceTripId":"POGIMAP-RENTARO-ONE-CIRCUIT-V29-20261120","editorRouteId":"POGIMAP-RENTARO-V29-EDITABLE-20261121","version":1,"mode":"DRAFT_ONLY_NOT_IN_GAME","status":"UNVALIDATED","townCasts":[{"index":81,"map":"cave","at":[851,-69],"arrival":[0,0],"route":"R06","reason":"v25 Town Cave and deep corridor","deletedInDraft":true,"requiresRouteRebuild":true},{"index":128,"map":"cave","at":[-21,-1173],"arrival":[0,0],"route":"R07","reason":"v25 Town Cave, exit to Main and Armadillo"},{"index":366,"map":"halloween","at":[-1071,-1485],"arrival":[0,0],"route":"R12","reason":"Forest entry -1071,-1485 -> Town center before Green JR"},{"index":394,"map":"halloween","at":[-553,-453],"arrival":[0,0],"route":"R13","reason":"Green JR -> Forest Town before portal to Spooky Town"},{"index":440,"map":"spookytown","at":[32,1404],"arrival":[0,0],"route":"R13","reason":"Spooky Town entry 32,1404 -> Town center before Mr Green"},{"index":488,"map":"spookytown","at":[402,1019],"arrival":[0,0],"route":"R14","reason":"V6 Town Spooky to JR"},{"index":516,"map":"spookytown","at":[-718,-157],"arrival":[0,0],"route":"R15","reason":"Town at JR to get near Level2 doorway"},{"index":650,"map":"winterland","at":[773,-950],"arrival":[0,0],"route":"R16","reason":"Winterland Town to Alia and main transporter"},{"index":700,"map":"desertland","at":[390,-1420],"arrival":[0,0],"route":"R17","reason":"Teleport from green scorpion farm back to Desertland Town; retain visit even if fighters offline"},{"index":716,"map":"main","at":[-85,-389],"arrival":[0,0],"route":"R16","reason":"Town on main after Alia to avoid walk back from spawn9"},{"index":839,"map":"halloween","at":[1212,101],"arrival":[0,0],"route":"R18","reason":"East entrance -> Halloween Town to reach scorpion island quickly"},{"index":865,"map":"halloween","at":[-253.55556,680],"arrival":[0,0],"route":"R18","reason":"Immediately cast Town at SAFE END move #25, avoiding the monster pack at old move #33"},{"index":910,"map":"main","at":[1600,-524],"arrival":[0,0],"route":"R18","reason":"Town on Main immediately after Halloween east exit, before arena"},{"index":995,"map":"main","at":[232,397],"arrival":[0,0],"route":"RETURN","reason":"final safe return to Main, do not repeat Mincrab"},{"index":10001,"map":"arena","at":[89,-568],"arrival":[0,0],"route":"USER_TOWN_D1","reason":"User-added Town (use_town), after move #961","draftOnly":true,"draftSequence":1,"afterActionIndex":961,"requiresRouteRebuild":true},{"index":10002,"map":"winterland","at":[-820,-1634],"arrival":[0,0],"route":"USER_TOWN_D2","reason":"User-added Town (use_town), after move #571","draftOnly":true,"draftSequence":2,"afterActionIndex":571,"requiresRouteRebuild":true},{"index":10003,"map":"bank","at":[0,-435.79],"arrival":[0,-37],"route":"USER_TOWN_D3","reason":"User-added Town before bank basement stairs. Town returns to bank spawn #0, not to the basement; bank route must be compiled and walked again to descend.","draftOnly":true,"draftSequence":3,"afterActionIndex":null,"beforeNativeDoor":{"from":"bank","to":"bank_b","spawn":0,"doorAt":[0.13,-444.39]},"standaloneMapTown":true,"requiresRouteRebuild":true}],"portals":[{"index":36,"route":"R05","map":"main","at":[160,1371],"to":"cave","arrival":[0,0],"kind":"door","spawn":0},{"index":129,"route":"R07","map":"cave","at":[0,1],"to":"main","arrival":[161,1372],"kind":"door","spawn":4},{"index":256,"route":"R11","map":"main","at":[1937,-12],"to":"level1","arrival":[0,9],"kind":"door","spawn":1},{"index":287,"route":"R11","map":"level1","at":[-313,533],"to":"level2","arrival":[1,-33],"kind":"door","spawn":1},{"index":290,"route":"R11","map":"level2","at":[79,43],"to":"spookytown","arrival":[192,-194],"kind":"door","spawn":2},{"index":342,"route":"R12","map":"spookytown","at":[142.2,-180],"to":"level2","arrival":[79,47],"kind":"door","spawn":5},{"index":345,"route":"R12","map":"level2","at":[-2,-33],"to":"level1","arrival":[-329.8,491.38],"kind":"door","spawn":4},{"index":365,"route":"R12","map":"level1","at":[-416.33,-195.58],"to":"halloween","arrival":[-1071,-1485],"kind":"door","spawn":3},{"index":439,"route":"R13","map":"halloween","at":[765,-1016.13],"to":"spookytown","arrival":[32,1404],"kind":"door","spawn":1},{"index":529,"route":"R15","map":"spookytown","at":[143,-180],"to":"level2","arrival":[78,46],"kind":"door","spawn":5},{"index":544,"route":"R15","map":"level2","at":[-315,-73],"to":"level2w","arrival":[18,9],"kind":"door","spawn":0},{"index":550,"route":"R15","map":"level2w","at":[-96,-190],"to":"level2n","arrival":[0.22,-2.85],"kind":"door","spawn":0},{"index":570,"route":"R15","map":"level2n","at":[-105,-630],"to":"winterland","arrival":[-2,-8],"kind":"door","spawn":4},{"index":662,"route":"R17","map":"winterland","at":[-29.05,-334.04],"to":"desertland","arrival":[10,-386],"kind":"transporter_npc","spawn":1},{"index":715,"route":"R17","map":"desertland","at":[10,-386],"to":"main","arrival":[-85,-389],"kind":"transporter_npc","spawn":9},{"index":838,"route":"R18","map":"main","at":[1600,-524],"to":"halloween","arrival":[1212,101],"kind":"door","spawn":4},{"index":909,"route":"R18","map":"halloween","at":[1212,101],"to":"main","arrival":[1600,-524],"kind":"door","spawn":15},{"index":930,"route":"R16","map":"main","at":[197,408],"to":"arena","arrival":[150,72],"kind":"door","spawn":0},{"index":994,"route":"RETURN","map":"arena","at":[151,74],"to":"main","arrival":[232,397],"kind":"door","spawn":6}],"guidance":"Town landing is fixed by the game. Door and Alia destination/arrival/spawn edits are proposals until validated. No live merchant changes."}}};

},{}],
"organs/bank/AccessoryOrganizer.js":[function(require,module,exports){
'use strict';

const {BANK_PACK_SIZE}=require('../../core/contracts/AdventureLandContract');
const {BANK_LAYOUT,ACCESSORY_TYPES,classifyItem,accessoryType}=require('./BankLayoutPolicy');

const TYPE_ORDER=Object.freeze([...ACCESSORY_TYPES,'other']);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function typeRank(type){const i=TYPE_ORDER.indexOf(type);return i<0?TYPE_ORDER.length:i;}
function stableItemKey(entry,options={}){
  const item=entry.item||{};
  const kind=accessoryType(item,options)||'other';
  return[
    String(typeRank(kind)).padStart(2,'0'),
    kind,
    String(item.name||''),
    String(999-Number(item.level||0)).padStart(3,'0'),
    String(item.p||''),
    String(entry.pack||''),
    String(entry.slot).padStart(3,'0')
  ].join('|');
}
function positionsForPacks(packs,reserved=new Set()){
  const out=[];
  for(const pack of packs)for(let slot=0;slot<BANK_PACK_SIZE;slot++)if(!reserved.has(pack+':'+slot))out.push({pack,slot});
  return out;
}
function createAccessoryOrganizer(options={}){
  function plan(entries,{reservedPositions=[]}={}){
    const reserved=reservedPositions instanceof Set?reservedPositions:new Set(Array.isArray(reservedPositions)?reservedPositions:[]);
    const rows=Array.isArray(entries)?entries:[];
    const selected=[];
    for(const entry of rows){
      if(!entry||!entry.item)continue;
      const decision=classifyItem(entry.item,options);
      if(decision.category!=='ACCESSORY_MAX'&&decision.category!=='ACCESSORIES')continue;
      selected.push({...entry,decision});
    }
    const placements=[],blocked=[];
    for(const category of ['ACCESSORY_MAX','ACCESSORIES']){
      const categoryRows=selected.filter(x=>x.decision.category===category).sort((a,b)=>stableItemKey(a,options).localeCompare(stableItemKey(b,options)));
      const positions=positionsForPacks(BANK_LAYOUT[category].packs,reserved);
      for(let i=0;i<categoryRows.length;i++){
        const entry=categoryRows[i],target=positions[i];
        if(!target){blocked.push({entry:clone(entry),category,error:'ACCESSORY_CATEGORY_CAPACITY_EXHAUSTED'});continue;}
        placements.push({entry:clone(entry),category,accessoryType:entry.decision.accessoryType||'other',target});
      }
    }
    const moves=placements.filter(x=>String(x.entry.pack)!==x.target.pack||Number(x.entry.slot)!==x.target.slot);
    return{ok:blocked.length===0,placements,moves,blocked,counts:{total:selected.length,high:selected.filter(x=>x.decision.category==='ACCESSORY_MAX').length,normal:selected.filter(x=>x.decision.category==='ACCESSORIES').length}};
  }
  return{plan};
}
module.exports={TYPE_ORDER,createAccessoryOrganizer};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js"}],
"organs/bank/BankDestinations.js":[function(require,module,exports){
'use strict';

const {bankPackFloor,bankPacksForFloor,validBankSlot}=require('../../core/contracts/AdventureLandContract');
const {BANK_LAYOUT}=require('./BankLayoutPolicy');

const row=(label,floor,packs,extra={})=>Object.freeze({label,floor,packs:Object.freeze([...packs]),...extra});
const policyOnly=(label,extra={})=>Object.freeze({label,policyRequired:true,...extra});
const DESTINATIONS=Object.freeze({
  AUTO_POLICY:policyOnly('Auto · Bank V3 policy'),
  MAIN:row('Main Bank','bank',bankPacksForFloor('bank')),
  BASEMENT:row('Basement Bank','bank_b',bankPacksForFloor('bank_b')),
  GENERAL:row('General · items0','bank',BANK_LAYOUT.GENERAL.packs),
  CRAFTABLES:row('Craftables · items1','bank',BANK_LAYOUT.CRAFTABLES.packs),
  OTHER:row('Other / fallback · items2','bank',BANK_LAYOUT.OTHER.packs),
  EXCHANGE:row('Exchangeables · items4–7','bank',BANK_LAYOUT.EXCHANGEABLES.packs),
  EXCHANGEABLES:row('Exchangeables · items4–7','bank',BANK_LAYOUT.EXCHANGEABLES.packs),
  KEYS:row('Keys · Basement · items8','bank_b',BANK_LAYOUT.KEYS.packs,{maxStack:50}),
  ACCESSORY_MAX:row('High / max accessories · items9–12','bank_b',BANK_LAYOUT.ACCESSORY_MAX.packs),
  ACCESSORIES:row('Accessories · items13–15','bank_b',BANK_LAYOUT.ACCESSORIES.packs),
  ARMOR:row('Armor · items16–19','bank_b',BANK_LAYOUT.ARMOR.packs),
  WEAPONS:row('Weapons · items20–23','bank_b',BANK_LAYOUT.WEAPONS.packs),
  EMERGENCY:row('Emergency overflow · Upper Bank · items45–47','bank_u',BANK_LAYOUT.EMERGENCY.packs,{emergency:true}),

  // Compatibility aliases. They no longer own their old dedicated packs.
  GABRIELLE:row('Legacy Gabrielle alias → General · items0','bank',BANK_LAYOUT.GENERAL.packs,{alias:'GENERAL'}),
  MATERIALS:row('Materials alias → Craftables · items1','bank',BANK_LAYOUT.CRAFTABLES.packs,{alias:'CRAFTABLES'}),
  POTIONS:row('Potions alias → General · items0','bank',BANK_LAYOUT.GENERAL.packs,{alias:'GENERAL'}),
  MISC:row('Misc alias → Other / fallback · items2','bank',BANK_LAYOUT.OTHER.packs,{alias:'OTHER'}),
  CHRISTIE:policyOnly('Legacy Christie lane retired · resolve by canonical item category',{deprecated:true}),
  GEAR:policyOnly('Legacy completed-gear lane retired · resolve by canonical item category',{deprecated:true})
});
function destination(name){return DESTINATIONS[String(name||'').toUpperCase()]||null;}
function openPackSet(openPacks){
  if(openPacks==null)return null;
  if(Array.isArray(openPacks))return new Set(openPacks.map(String));
  if(typeof openPacks==='object')return new Set(Object.keys(openPacks).filter(k=>openPacks[k]));
  return new Set();
}
function planStorage(name,{resolvedPack=null,policyResolved=false,currentMap=null,openPacks=null}={}){
  const key=String(name||'').toUpperCase(); const d=destination(key);
  if(!d)return{ok:false,error:'BANK_DESTINATION_UNKNOWN'};
  const pack=resolvedPack==null?null:String(resolvedPack);
  if(d.policyRequired&&(!pack||policyResolved!==true))return{ok:false,error:'BANK_POLICY_RESOLUTION_REQUIRED'};
  if(pack&&!bankPackFloor(pack))return{ok:false,error:'BANK_PACK_INVALID'};
  if(pack&&d.packs&&d.packs.length&&!d.packs.includes(pack))return{ok:false,error:'BANK_PACK_NOT_IN_DESTINATION',allowedPacks:[...d.packs]};
  const floor=d.floor||(pack?bankPackFloor(pack):null);
  if(!floor)return{ok:false,error:'BANK_FLOOR_UNRESOLVED'};
  if(pack&&bankPackFloor(pack)!==floor)return{ok:false,error:'BANK_FLOOR_MISMATCH',expectedFloor:floor,actualFloor:bankPackFloor(pack)};
  const selectedPack=pack||(d.packs&&d.packs.length===1?d.packs[0]:null);
  const open=openPackSet(openPacks);
  if(selectedPack&&open&&!open.has(selectedPack))return{ok:false,error:'BANK_PACK_NOT_OPEN',pack:selectedPack,floor};
  return{
    ok:true,destination:key,label:d.label,floor,
    allowedPacks:d.packs?[...d.packs]:pack?[pack]:[],
    pack:selectedPack,
    needsTravel:currentMap==null?null:String(currentMap)!==floor,
    deprecated:d.deprecated===true,
    alias:d.alias||null
  };
}
function validateResolvedDeposit(name,deposit={}){
  const planned=planStorage(name,{
    resolvedPack:deposit.pack,policyResolved:deposit.policyResolved===true,currentMap:deposit.map||null,openPacks:deposit.openPacks||null
  });
  if(!planned.ok)return planned;
  if(deposit.verified!==true)return{ok:false,error:'BANK_DEPOSIT_NOT_VERIFIED'};
  const slot=Number(deposit.slot);
  if(!validBankSlot(slot))return{ok:false,error:'BANK_SLOT_INVALID'};
  return{ok:true,destination:planned.destination,label:planned.label,pack:String(deposit.pack),slot,floor:planned.floor,verified:true,deprecated:planned.deprecated,alias:planned.alias};
}
module.exports={DESTINATIONS,destination,planStorage,validateResolvedDeposit};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js"}],
"organs/bank/BankHandoffOps.js":[function(require,module,exports){
'use strict';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function createBankHandoffOps({gearHandoff}={}){
  if(
    !gearHandoff||
    typeof gearHandoff.executionReady!=='function'||
    typeof gearHandoff.stageNextFromBank!=='function'||
    typeof gearHandoff.status!=='function'||
    typeof gearHandoff.returnToBank!=='function'||
    typeof gearHandoff.reconcileAfterGearFailure!=='function'
  ){
    throw new Error('BANK_HANDOFF_GEAR_SERVICE_REQUIRED');
  }

  async function returnReady(active){
    const returned=await gearHandoff.returnToBank(active.id);
    if(!returned||returned.ok!==true){
      return{ok:false,error:'BANK_GEAR_HANDOFF_RETURN_FAILED',detail:clone(returned)};
    }
    return{
      ok:true,
      returned:true,
      complete:returned.complete===true,
      reason:'GEAR_HANDOFF_RETURNED_TO_BANK',
      workId:active.id,
      phase:returned.session&&returned.session.phase||null,
      session:clone(returned.session||null)
    };
  }

  async function handoff(){
    let active=gearHandoff.status();

    if(active&&active.phase==='READY_FOR_BANK'){
      return returnReady(active);
    }

    if(active&&active.phase==='NEEDS_RESCAN'){
      const reconciled=await gearHandoff.reconcileAfterGearFailure(active.id);
      if(!reconciled||reconciled.ok!==true){
        return{ok:false,error:'BANK_GEAR_HANDOFF_RECONCILE_FAILED',detail:clone(reconciled)};
      }
      if(reconciled.complete===true){
        return{
          ok:true,
          reconciled:true,
          complete:true,
          reason:'GEAR_HANDOFF_FAILURE_NO_SURVIVORS',
          workId:active.id,
          session:clone(reconciled.session||null)
        };
      }
      active=gearHandoff.status();
      if(active&&active.phase==='READY_FOR_BANK')return returnReady(active);
      return{ok:false,error:'BANK_GEAR_HANDOFF_RECONCILE_STATE_INVALID',detail:clone(reconciled)};
    }

    if(active&&active.phase==='READY_FOR_GEAR'){
      return{
        ok:true,
        staged:true,
        waitingForGear:true,
        reason:gearHandoff.executionReady()===true?'GEAR_HANDOFF_AWAITING_EXECUTOR_RUN':'GEAR_EXECUTOR_LOST_AFTER_STAGE',
        workId:active.id,
        phase:active.phase
      };
    }

    if(active&&active.phase==='STAGING'&&gearHandoff.executionReady()!==true){
      return{
        ok:true,
        skipped:true,
        reason:'GEAR_EXECUTOR_LOST_DURING_STAGING',
        workId:active.id,
        phase:active.phase
      };
    }

    if(gearHandoff.executionReady()!==true){
      return{
        ok:true,
        skipped:true,
        reason:'GEAR_EXECUTOR_NOT_READY',
        handoff:clone(active)
      };
    }

    const staged=await gearHandoff.stageNextFromBank();
    if(!staged||staged.ok!==true){
      return{
        ok:false,
        error:'BANK_GEAR_HANDOFF_STAGE_FAILED',
        detail:clone(staged)
      };
    }

    if(staged.no_work===true){
      return{ok:true,skipped:true,reason:'NO_GEAR_HANDOFF_WORK',plan:clone(staged.plan||null)};
    }

    return{
      ok:true,
      staged:staged.ready===true,
      reason:staged.ready===true?'GEAR_HANDOFF_STAGED':'GEAR_HANDOFF_NO_STAGE',
      workId:staged.session&&staged.session.id||null,
      phase:staged.session&&staged.session.phase||null,
      job:clone(staged.job||null)
    };
  }

  return{handoff};
}

module.exports={createBankHandoffOps};

},{}],
"organs/bank/BankLayoutPolicy.js":[function(require,module,exports){
'use strict';

const {BANK_PACK_SIZE,bankPackFloor}=require('../../core/contracts/AdventureLandContract');
const {isApprovedExchangeId}=require('../../core/policy/ExchangeApprovalPolicy');
const {isScrollId}=require('../exchange/ExchangePolicy');
const RecipeIntelligence=require('../../ligaments/crafting/RecipeIntelligence');

const packs=(start,end)=>Object.freeze(Array.from({length:end-start+1},(_,i)=>'items'+(start+i)));
const BANK_LAYOUT=Object.freeze({
  GENERAL:Object.freeze({label:'General',packs:packs(0,0)}),
  CRAFTABLES:Object.freeze({label:'Craftables',packs:packs(1,1)}),
  OTHER:Object.freeze({label:'Other / fail-closed fallback',packs:packs(2,2)}),
  RETIRED_ACCESSORY:Object.freeze({label:'Retired accessory source pack',packs:packs(3,3),deposit:false,migrate:true}),
  EXCHANGEABLES:Object.freeze({label:'Exchangeables',packs:packs(4,7)}),
  KEYS:Object.freeze({label:'Keys',packs:packs(8,8),maxStack:50}),
  ACCESSORY_MAX:Object.freeze({label:'High / max-level accessories',packs:packs(9,12)}),
  ACCESSORIES:Object.freeze({label:'Accessories',packs:packs(13,15)}),
  ARMOR:Object.freeze({label:'Armor',packs:packs(16,19)}),
  WEAPONS:Object.freeze({label:'Weapons',packs:packs(20,23)}),
  EMERGENCY:Object.freeze({label:'Emergency overflow',packs:packs(45,47),emergency:true})
});

const ACCESSORY_TYPES=Object.freeze(['ring','earring','belt','amulet','orb']);
const ARMOR_TYPES=Object.freeze(['helmet','chest','pants','gloves','shoes','cape','shield','offhand','source','quiver','misc_offhand']);
const ACCESSORY_MAX_LEVELS=Object.freeze({ring:5,earring:3,belt:3,amulet:3,orb:3});
const KNOWN_KEY_NAMES=Object.freeze(['cryptkey','tombkey','frozenkey']);

function metadataFor(item,metaResolver){
  if(!item)return null;
  if(item.meta&&typeof item.meta==='object')return item.meta;
  if(typeof metaResolver==='function'){
    const row=metaResolver(String(item.name||''),item);
    if(row&&typeof row==='object')return row;
  }
  return null;
}
function normalizedType(meta){return String(meta&&meta.type||'').toLowerCase();}
function accessoryType(item,{metaResolver}={}){
  const meta=metadataFor(item,metaResolver),type=normalizedType(meta);
  if(ACCESSORY_TYPES.includes(type))return type;
  const explicit=String(item&&item.accessoryType||'').toLowerCase();
  if(ACCESSORY_TYPES.includes(explicit))return explicit;
  return null;
}
function isExchangeable(meta){return !!(meta&&(meta.exchangeable===true||meta.exchange===true||Number(meta.e)>0));}
function isCraftable(item,meta){
  const type=normalizedType(meta);
  if(type==='material'||!!(meta&&(meta.craftable===true||meta.crafting===true||meta.recipe===true)))return true;
  return !!(item&&item.name&&RecipeIntelligence.isIngredient(item.name));
}
function isKey(item,meta){
  const type=normalizedType(meta);
  if(type==='key')return true;
  return KNOWN_KEY_NAMES.includes(String(item&&item.name||'').toLowerCase());
}
function maxAccessoryLevel(kind,{maxAccessoryLevels=ACCESSORY_MAX_LEVELS,maxAccessoryLevelResolver=null,item=null,meta=null}={}){
  if(typeof maxAccessoryLevelResolver==='function'){
    const value=Number(maxAccessoryLevelResolver(kind,item,meta));
    if(Number.isFinite(value)&&value>=0)return value;
  }
  const value=Number(maxAccessoryLevels&&maxAccessoryLevels[kind]);
  return Number.isFinite(value)&&value>=0?value:null;
}
function classifyItem(item,options={}){
  if(!item||!item.name)return{category:'OTHER',reason:'ITEM_INVALID',meta:null,accessoryType:null};
  const meta=metadataFor(item,options.metaResolver),type=normalizedType(meta);
  if(isScrollId(item.name))return{category:'HOLD_MERCHANT',reason:'GLOBAL_SCROLL_KEEP',meta,accessoryType:null,deposit:false};
  if(isKey(item,meta))return{category:'KEYS',reason:'KEY',meta,accessoryType:null};
  if(isExchangeable(meta)){
    if(!isApprovedExchangeId(item.name)){
      return{category:'HOLD_MERCHANT',reason:'UNAPPROVED_EXCHANGEABLE_REVIEW_REQUIRED',meta,accessoryType:null,deposit:false};
    }
    return{category:'EXCHANGEABLES',reason:'EXCHANGEABLE_APPROVED',meta,accessoryType:null,deposit:true};
  }
  const acc=accessoryType(item,options);
  if(acc){
    const threshold=maxAccessoryLevel(acc,{...options,item,meta});
    const level=Number(item.level||0);
    return{category:threshold!=null&&level>=threshold?'ACCESSORY_MAX':'ACCESSORIES',reason:threshold!=null&&level>=threshold?'ACCESSORY_MAX_LEVEL':'ACCESSORY',meta,accessoryType:acc,maxLevel:threshold};
  }
  if(type==='weapon')return{category:'WEAPONS',reason:'WEAPON',meta,accessoryType:null};
  if(ARMOR_TYPES.includes(type))return{category:'ARMOR',reason:'ARMOR',meta,accessoryType:null};
  if(isCraftable(item,meta))return{category:'CRAFTABLES',reason:RecipeIntelligence.isIngredient(item.name)?'RECIPE_INGREDIENT':'CRAFTABLE',meta,accessoryType:null};
  if(meta)return{category:'GENERAL',reason:'KNOWN_GENERAL',meta,accessoryType:null};
  return{category:'OTHER',reason:'METADATA_UNKNOWN',meta:null,accessoryType:null};
}
function depositAllowed(item,options={}){
  const decision=classifyItem(item,options);
  return{ok:decision.deposit!==false,decision};
}
function destinationPacks(category){const row=BANK_LAYOUT[String(category||'').toUpperCase()];return row?[...row.packs]:[];}
function layoutForPack(pack){
  const target=String(pack||'');
  for(const [category,row] of Object.entries(BANK_LAYOUT))if(row.packs.includes(target))return{category,...row};
  return null;
}
function validateCanonicalLayout(){
  const used=new Set();
  for(const [category,row] of Object.entries(BANK_LAYOUT)){
    for(const pack of row.packs){
      if(!bankPackFloor(pack))throw new Error('BANK_LAYOUT_PACK_INVALID_'+category+'_'+pack);
      if(used.has(pack))throw new Error('BANK_LAYOUT_PACK_OVERLAP_'+pack);
      used.add(pack);
    }
  }
  for(let i=0;i<=23;i++)if(!used.has('items'+i))throw new Error('BANK_LAYOUT_PACK_UNASSIGNED_items'+i);
  if(BANK_PACK_SIZE!==42)throw new Error('BANK_LAYOUT_PACK_SIZE_UNEXPECTED');
  return true;
}
validateCanonicalLayout();

module.exports={BANK_LAYOUT,ACCESSORY_TYPES,ARMOR_TYPES,ACCESSORY_MAX_LEVELS,KNOWN_KEY_NAMES,metadataFor,accessoryType,classifyItem,depositAllowed,destinationPacks,layoutForPack,validateCanonicalLayout};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","../../core/policy/ExchangeApprovalPolicy":"core/policy/ExchangeApprovalPolicy.js","../exchange/ExchangePolicy":"organs/exchange/ExchangePolicy.js","../../ligaments/crafting/RecipeIntelligence":"ligaments/crafting/RecipeIntelligence.js"}],
"organs/bank/BankNavigation.js":[function(require,module,exports){
'use strict';

const {bankPackFloor}=require('../../core/contracts/AdventureLandContract');
const {BANK_LAYOUT,layoutForPack}=require('./BankLayoutPolicy');
const {destination}=require('./BankDestinations');

const FLOOR_LABELS=Object.freeze({
  bank:'Main Bank',
  bank_b:'Bank Basement',
  bank_u:'Upper Bank'
});

const CATEGORY_ALIASES=Object.freeze({
  EXCHANGE:'EXCHANGEABLES',
  MATERIALS:'CRAFTABLES',
  MISC:'OTHER',
  HIGH_ACCESSORIES:'ACCESSORY_MAX',
  MAX_ACCESSORIES:'ACCESSORY_MAX'
});

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function packNumber(pack){
  const m=/^items(\d+)$/.exec(String(pack||''));
  return m?Number(m[1]):null;
}
function normalizeCategory(value){
  const raw=String(value||'').trim().toUpperCase().replace(/[\s-]+/g,'_');
  return CATEGORY_ALIASES[raw]||raw;
}
function packDisplayName(pack){
  const id=String(pack||'');
  const row=layoutForPack(id);
  const n=packNumber(id);
  if(!row){
    const floor=bankPackFloor(id);
    if(!floor||n==null)return id||'Unknown pack';
    return FLOOR_LABELS[floor]+' Pack '+(n+1);
  }
  const index=row.packs.indexOf(id);
  if(row.packs.length===1)return row.label;
  return row.label+' '+(index+1);
}
function packDescriptor(pack){
  const id=String(pack||'');
  const floor=bankPackFloor(id);
  if(!floor)return{ok:false,error:'BANK_NAV_PACK_INVALID',pack:id||null};
  const layout=layoutForPack(id);
  return{
    ok:true,
    kind:'PACK',
    pack:id,
    packNumber:packNumber(id),
    floor,
    floorLabel:FLOOR_LABELS[floor]||floor,
    category:layout&&layout.category||null,
    categoryLabel:layout&&layout.label||null,
    label:packDisplayName(id),
    anchor:'pack-'+id,
    depositAllowed:layout?layout.deposit!==false:null,
    emergency:!!(layout&&layout.emergency)
  };
}
function canonicalCategory(value){
  const key=normalizeCategory(value);
  if(BANK_LAYOUT[key])return key;

  const d=destination(key);
  if(d&&d.alias&&BANK_LAYOUT[d.alias])return d.alias;
  if(d&&d.packs&&d.packs.length){
    const rows=d.packs.map(layoutForPack).filter(Boolean);
    const categories=[...new Set(rows.map(x=>x.category))];
    if(categories.length===1)return categories[0];
  }
  return null;
}
function categoryDescriptor(category,{selectedPack=null,currentMap=null}={}){
  const key=canonicalCategory(category);
  if(!key)return{ok:false,error:'BANK_NAV_CATEGORY_UNKNOWN',category:String(category||'')||null};
  const row=BANK_LAYOUT[key];
  const packs=[...row.packs];
  let pack=selectedPack==null?packs[0]:String(selectedPack);
  if(!packs.includes(pack)){
    return{
      ok:false,error:'BANK_NAV_PACK_NOT_IN_CATEGORY',
      category:key,requestedPack:pack,allowedPacks:packs
    };
  }
  const floor=bankPackFloor(pack);
  const floors=[...new Set(packs.map(bankPackFloor))];
  if(floors.length!==1)return{ok:false,error:'BANK_NAV_CATEGORY_CROSSES_FLOORS',category:key,floors};
  return{
    ok:true,
    kind:'CATEGORY',
    category:key,
    label:row.label,
    packs,
    selectedPack:pack,
    selectedPackLabel:packDisplayName(pack),
    floor,
    floorLabel:FLOOR_LABELS[floor]||floor,
    anchor:'pack-'+pack,
    needsTravel:currentMap==null?null:String(currentMap)!==floor,
    depositAllowed:row.deposit!==false,
    migrate:row.migrate===true,
    emergency:row.emergency===true
  };
}
function resolve(target,options={}){
  const raw=String(target||'').trim();
  if(!raw)return{ok:false,error:'BANK_NAV_TARGET_REQUIRED'};
  if(/^items\d+$/.test(raw)){
    const p=packDescriptor(raw);
    if(!p.ok)return p;
    return{
      ...p,
      needsTravel:options.currentMap==null?null:String(options.currentMap)!==p.floor
    };
  }

  const d=destination(raw);
  if(d&&d.policyRequired===true&&!d.alias){
    if(options.resolvedPack){
      const p=packDescriptor(options.resolvedPack);
      if(!p.ok)return p;
      return{
        ...p,
        kind:'POLICY_RESOLVED_PACK',
        requested:String(raw).toUpperCase(),
        needsTravel:options.currentMap==null?null:String(options.currentMap)!==p.floor
      };
    }
    return{
      ok:false,
      error:'BANK_NAV_POLICY_TARGET_REQUIRES_RESOLUTION',
      target:String(raw).toUpperCase()
    };
  }

  return categoryDescriptor(raw,{
    selectedPack:options.selectedPack||null,
    currentMap:options.currentMap||null
  });
}
function listCategories(){
  return Object.entries(BANK_LAYOUT).map(([category,row])=>({
    category,
    label:row.label,
    packs:[...row.packs],
    floor:row.packs.length?bankPackFloor(row.packs[0]):null,
    floorLabel:row.packs.length?FLOOR_LABELS[bankPackFloor(row.packs[0])]||bankPackFloor(row.packs[0]):null,
    depositAllowed:row.deposit!==false,
    migrate:row.migrate===true,
    emergency:row.emergency===true
  }));
}
function listPacks(){
  const out=[];
  for(let n=0;n<=47;n++){
    const pack='items'+n;
    out.push(packDescriptor(pack));
  }
  return out;
}
function createBankNavigation(){
  return{
    resolve,
    resolveCategory:categoryDescriptor,
    resolvePack:packDescriptor,
    listCategories,
    listPacks,
    packDisplayName,
    health:async()=>({ok:true,categories:listCategories().length,packs:48})
  };
}

module.exports={
  FLOOR_LABELS,CATEGORY_ALIASES,
  packNumber,normalizeCategory,packDisplayName,packDescriptor,
  canonicalCategory,categoryDescriptor,resolve,listCategories,listPacks,
  createBankNavigation
};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js","./BankDestinations":"organs/bank/BankDestinations.js"}],
"organs/bank/BankOrganizer.js":[function(require,module,exports){
'use strict';

const {BANK_PACK_SIZE}=require('../../core/contracts/AdventureLandContract');
const {BANK_LAYOUT,classifyItem}=require('./BankLayoutPolicy');
const {createAccessoryOrganizer}=require('./AccessoryOrganizer');

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const CATEGORY_ORDER=Object.freeze(['GENERAL','CRAFTABLES','OTHER','EXCHANGEABLES','KEYS','ACCESSORY_MAX','ACCESSORIES','ARMOR','WEAPONS']);

function normalizeSnapshot(snapshot){
  const source=snapshot&&snapshot.packs&&typeof snapshot.packs==='object'?snapshot.packs:snapshot&&snapshot.bank&&typeof snapshot.bank==='object'?snapshot.bank:snapshot;
  if(!source||typeof source!=='object')throw new Error('BANK_ORGANIZER_SNAPSHOT_REQUIRED');
  const out=[];
  for(const [pack,slots] of Object.entries(source)){
    if(!/^items\d+$/.test(pack)||!Array.isArray(slots))continue;
    for(let slot=0;slot<slots.length;slot++)if(slots[slot])out.push({pack,slot,item:clone(slots[slot])});
  }
  return out;
}
function positions(packs,reserved=new Set()){
  const out=[];
  for(const pack of packs)for(let slot=0;slot<BANK_PACK_SIZE;slot++)if(!reserved.has(pack+':'+slot))out.push({pack,slot});
  return out;
}
function sortKey(entry,category,options){
  const item=entry.item||{},decision=entry.decision||classifyItem(item,options);
  let group='';
  if(category==='ARMOR')group=String(decision.meta&&decision.meta.type||'');
  if(category==='WEAPONS')group=String(decision.meta&&decision.meta.wtype||decision.meta&&decision.meta.type||'weapon');
  return[group,String(item.name||''),String(999-Number(item.level||0)).padStart(3,'0'),String(item.p||''),String(entry.pack||''),String(entry.slot).padStart(3,'0')].join('|');
}
function createBankOrganizer({metaResolver,maxAccessoryLevels,maxAccessoryLevelResolver,isProtected=null}={}){
  const options={metaResolver,maxAccessoryLevels,maxAccessoryLevelResolver};
  const accessoryOrganizer=createAccessoryOrganizer(options);

  function plan(snapshot){
    const entries=normalizeSnapshot(snapshot),movable=[],held=[];
    for(const entry of entries){
      if(typeof isProtected==='function'&&isProtected(entry.item,entry)===true){held.push({...clone(entry),reason:'PROTECTED'});continue;}
      const decision=classifyItem(entry.item,options);
      if(decision&&decision.deposit===false){
        held.push({...clone(entry),decision:clone(decision),reason:decision.reason||'DEPOSIT_BLOCKED'});
        continue;
      }
      movable.push({...entry,decision});
    }
    const placements=[],blocked=[];
    const reservedPositions=new Set(held.map(x=>String(x.pack)+':'+Number(x.slot)));
    const accessoryPlan=accessoryOrganizer.plan(movable,{reservedPositions});
    placements.push(...accessoryPlan.placements.map(x=>({...x,reason:'ACCESSORY_GROUPED'})));
    blocked.push(...accessoryPlan.blocked);

    for(const category of CATEGORY_ORDER){
      if(category==='ACCESSORY_MAX'||category==='ACCESSORIES')continue;
      const rows=movable.filter(x=>x.decision.category===category).sort((a,b)=>sortKey(a,category,options).localeCompare(sortKey(b,category,options)));
      const targets=positions(BANK_LAYOUT[category].packs,reservedPositions);
      for(let i=0;i<rows.length;i++){
        const entry=rows[i],target=targets[i];
        if(!target){blocked.push({entry:clone(entry),category,error:'BANK_CATEGORY_CAPACITY_EXHAUSTED'});continue;}
        placements.push({entry:clone(entry),category,target,reason:entry.pack==='items3'?'MIGRATE_RETIRED_ITEMS3':'CANONICAL_LAYOUT'});
      }
    }

    const key=p=>p.target.pack+':'+p.target.slot;
    const seen=new Set();
    for(const p of placements){if(seen.has(key(p)))throw new Error('BANK_ORGANIZER_TARGET_COLLISION_'+key(p));seen.add(key(p));}
    placements.sort((a,b)=>CATEGORY_ORDER.indexOf(a.category)-CATEGORY_ORDER.indexOf(b.category)||a.target.pack.localeCompare(b.target.pack)||a.target.slot-b.target.slot);
    const moves=placements.filter(p=>String(p.entry.pack)!==p.target.pack||Number(p.entry.slot)!==p.target.slot);
    const stays=placements.filter(p=>String(p.entry.pack)===p.target.pack&&Number(p.entry.slot)===p.target.slot);
    const overflowRequests=blocked.map(row=>({category:row.category,item:clone(row.entry&&row.entry.item),from:row.entry?{pack:row.entry.pack,slot:row.entry.slot}:null,reason:row.error}));
    return{
      ok:blocked.length===0,
      planVersion:1,
      placements,moves,stays,held,blocked,overflowRequests,
      summary:{items:entries.length,movable:movable.length,moves:moves.length,stays:stays.length,held:held.length,blocked:blocked.length,items3Migrations:moves.filter(x=>x.entry.pack==='items3').length}
    };
  }

  async function organize(snapshot,{moveOps=null,verifyOps=null}={}){
    const planResult=plan(snapshot);
    if(!planResult.ok)return{ok:false,error:'BANK_ORGANIZER_CAPACITY_BLOCKED',plan:planResult};
    if(!moveOps)return{ok:true,planned:true,executed:false,plan:planResult};
    if(typeof moveOps.applyPlan!=='function')return{ok:false,error:'BANK_MOVE_OPS_CONTRACT_INVALID',plan:planResult};
    const moveProof=await moveOps.applyPlan(clone(planResult));
    if(!moveProof||moveProof.ok!==true)return{ok:false,error:'BANK_MOVE_OPS_FAILED',plan:planResult,moveProof:clone(moveProof)};
    if(verifyOps){
      if(typeof verifyOps.verifyPlan!=='function')return{ok:false,error:'BANK_VERIFY_OPS_CONTRACT_INVALID',plan:planResult,moveProof:clone(moveProof)};
      const verifyProof=await verifyOps.verifyPlan(clone(planResult),clone(moveProof));
      if(!verifyProof||verifyProof.ok!==true)return{ok:false,error:'BANK_ORGANIZER_VERIFY_FAILED',plan:planResult,moveProof:clone(moveProof),verifyProof:clone(verifyProof)};
      return{ok:true,planned:true,executed:true,verified:true,plan:planResult,moveProof:clone(moveProof),verifyProof:clone(verifyProof)};
    }
    return{ok:true,planned:true,executed:true,verified:false,plan:planResult,moveProof:clone(moveProof)};
  }

  return{plan,organize};
}

module.exports={CATEGORY_ORDER,normalizeSnapshot,createBankOrganizer};

},{"../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js","./AccessoryOrganizer":"organs/bank/AccessoryOrganizer.js"}],
"organs/bank/BankRetrieveOps.js":[function(require,module,exports){
'use strict';

const {identity}=require('../../ligaments/inventory/InventoryService');
const {bankPackFloor}=require('../../core/contracts/AdventureLandContract');

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function bankItem(snapshot,pack,slot){
  const source=snapshot&&snapshot.packs&&typeof snapshot.packs==='object'?snapshot.packs:snapshot;
  const slots=source&&source[String(pack||'')];
  return Array.isArray(slots)?clone(slots[Number(slot)]||null):null;
}

function firstFreeInventorySlot(items){
  if(!Array.isArray(items))return-1;
  for(let i=0;i<items.length;i++)if(!items[i])return i;
  return-1;
}

function createBankRetrieveOps({adapter,inventory,travel=null}={}){
  if(!adapter||typeof adapter.snapshot!=='function'||typeof adapter.retrieve!=='function')throw new Error('BANK_RETRIEVE_ADAPTER_REQUIRED');
  if(!inventory||typeof inventory.snapshot!=='function'||typeof inventory.slot!=='function')throw new Error('BANK_RETRIEVE_INVENTORY_REQUIRED');

  async function snapshot(){return clone(await adapter.snapshot());}

  async function retrieveExact({pack,slot,expectedIdentity,inventorySlot=null,allowStack=false}={}){
    const bankPack=String(pack||'');
    const bankSlot=Number(slot);
    if(!bankPack||!Number.isInteger(bankSlot)||bankSlot<0)return{ok:false,error:'BANK_RETRIEVE_SOURCE_INVALID'};

    const sourceFloor=bankPackFloor(bankPack);
    if(!sourceFloor)return{ok:false,error:'BANK_RETRIEVE_PACK_INVALID',pack:bankPack};
    if(travel&&typeof travel.toFloor==='function'){
      const moved=await travel.toFloor(sourceFloor,{reason:'BANK_RETRIEVE_EXACT',target:{pack:bankPack,slot:bankSlot}});
      if(!moved||moved.ok!==true){
        return{ok:false,error:'BANK_RETRIEVE_TRAVEL_FAILED',pack:bankPack,slot:bankSlot,targetFloor:sourceFloor,travel:clone(moved)};
      }
    }

    const beforeBank=await adapter.snapshot();
    const sourceItem=bankItem(beforeBank,bankPack,bankSlot);
    if(!sourceItem)return{ok:false,error:'BANK_RETRIEVE_SOURCE_EMPTY',pack:bankPack,slot:bankSlot};
    const actualIdentity=identity(sourceItem);
    if(expectedIdentity&&actualIdentity!==String(expectedIdentity)){
      return{ok:false,error:'BANK_RETRIEVE_IDENTITY_CHANGED',expected:String(expectedIdentity),actual:actualIdentity,pack:bankPack,slot:bankSlot};
    }
    if(Number(sourceItem.q||1)!==1&&allowStack!==true)return{ok:false,error:'BANK_RETRIEVE_STACK_UNSAFE',identity:actualIdentity};

    let target=inventorySlot==null?null:Number(inventorySlot);
    const items=await inventory.snapshot();
    if(target==null)target=firstFreeInventorySlot(items);
    if(!Number.isInteger(target)||target<0)return{ok:false,error:'BANK_RETRIEVE_NO_FREE_INVENTORY_SLOT'};
    if(items[target])return{ok:false,error:'BANK_RETRIEVE_TARGET_OCCUPIED',inventorySlot:target};

    const result=await adapter.retrieve(bankPack,bankSlot,target);
    if(result&&result.ok===false)return{ok:false,error:'BANK_RETRIEVE_NATIVE_FAILED',result:clone(result)};

    const received=await inventory.slot(target);
    const receivedIdentity=identity(received);
    if(!received||receivedIdentity!==actualIdentity){
      return{ok:false,error:'BANK_RETRIEVE_VERIFY_INVENTORY_FAILED',expected:actualIdentity,actual:receivedIdentity,inventorySlot:target};
    }

    const afterBank=await adapter.snapshot();
    const remaining=bankItem(afterBank,bankPack,bankSlot);
    if(remaining&&identity(remaining)===actualIdentity){
      return{ok:false,error:'BANK_RETRIEVE_VERIFY_SOURCE_NOT_CLEARED',identity:actualIdentity,pack:bankPack,slot:bankSlot};
    }

    return{
      ok:true,verified:true,
      source:{pack:bankPack,slot:bankSlot},
      inventorySlot:target,
      item:clone(received),
      quantity:Math.max(1,Number(received&&received.q||1)),
      identity:receivedIdentity,
      nativeResult:clone(result)
    };
  }

  return{snapshot,retrieveExact};
}

module.exports={bankItem,firstFreeInventorySlot,createBankRetrieveOps};

},{"../../ligaments/inventory/InventoryService":"ligaments/inventory/InventoryService.js","../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js"}],
"organs/bank/BankState.js":[function(require,module,exports){
'use strict';

const BANK_STEPS=Object.freeze(['ENTER','TRAVEL','SCAN','APPLY_POLICY','ORGANIZE','VERIFY','HANDOFF','PUBLISH','EXIT']);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function validateSession(session){
  if(!session||typeof session!=='object')throw new Error('BANK_SESSION_REQUIRED');
  if(session.version!==3)throw new Error('BANK_SESSION_VERSION_INVALID');
  if(session.state!=='BANK')throw new Error('BANK_SESSION_STATE_INVALID');
  const step=session.step;
  if(step!=='COMPLETE'&&!BANK_STEPS.includes(step))throw new Error('BANK_STEP_INVALID_'+String(step));
  if(!Array.isArray(session.completed))throw new Error('BANK_COMPLETED_INVALID');
  if(!session.proofs||typeof session.proofs!=='object')throw new Error('BANK_PROOFS_INVALID');

  const expectedCount=step==='COMPLETE'?BANK_STEPS.length:BANK_STEPS.indexOf(step);
  const expected=BANK_STEPS.slice(0,expectedCount);
  if(session.completed.length!==expected.length||session.completed.some((x,i)=>x!==expected[i])){
    throw new Error('BANK_COMPLETED_OUT_OF_ORDER');
  }
  for(const done of expected){
    const proof=session.proofs[done];
    if(!proof||proof.ok!==true)throw new Error('BANK_PROOF_MISSING_'+done);
  }
  return true;
}

function createBankState({ops,initialSession,recoveryStore=null}={}){
  if(!ops||typeof ops!=='object')throw new Error('BANK_OPS_REQUIRED');
  function newSession(){
    return{
      version:3,
      state:'BANK',
      step:'ENTER',
      completed:[],
      proofs:{},
      lastError:null
    };
  }
  let session=initialSession&&typeof initialSession==='object'?clone(initialSession):newSession();
  validateSession(session);

  async function checkpoint(reason){
    if(!recoveryStore||typeof recoveryStore.save!=='function')return{ok:true,skipped:true,reason:'RECOVERY_STORE_UNAVAILABLE'};
    const saved=await recoveryStore.save(session,{reason});
    if(!saved||saved.ok!==true){
      const error=saved&&saved.error||'BANK_RECOVERY_CHECKPOINT_FAILED';
      session.recoveryError=String(error);
      throw new Error(String(error));
    }
    session.recoveryError=null;
    return saved;
  }

  function status(){return{status:session.step==='COMPLETE'?'COMPLETE':'READY',session:clone(session)};}

  function begin(){
    validateSession(session);
    if(session.step!=='COMPLETE')return{ok:true,resumed:true,status:status()};
    session=newSession();
    return{ok:true,resumed:false,status:status()};
  }

  function advance(step,proof){
    const index=BANK_STEPS.indexOf(step);
    session.completed=[...(session.completed||[]),step];
    session.proofs={...(session.proofs||{}),[step]:clone(proof)};
    session.lastError=null;
    session.step=index===BANK_STEPS.length-1?'COMPLETE':BANK_STEPS[index+1];
    validateSession(session);
  }

  async function runStep(){
    validateSession(session);
    if(session.step==='COMPLETE')return{status:'COMPLETE',session:clone(session),advanced:false};
    const step=session.step;
    await checkpoint('BANK_RUN_START_'+String(step));
    const fn=ops[step.toLowerCase()];
    if(typeof fn!=='function'&&step!=='HANDOFF')throw new Error('BANK_STEP_OWNER_MISSING_'+step);
    try{
      const result=typeof fn==='function'
        ? await fn({step,session:clone(session)})
        : {ok:true,skipped:true,reason:'HANDOFF_OP_UNAVAILABLE'};
      if(!result||result.ok!==true||result.failed===true||result.success===false){
        throw new Error('BANK_STEP_NOT_PROVEN_'+step);
      }
      advance(step,result);
      await checkpoint('BANK_STEP_PROVEN_'+step);
      return{
        status:session.step==='COMPLETE'?'COMPLETE':'READY',
        session:clone(session),
        advanced:true,
        completed_step:step
      };
    }catch(error){
      session.lastError=String(error&&error.message||error);
      try{await checkpoint('BANK_STEP_FAILED_'+step);}
      catch(recoveryError){
        session.recoveryError=String(recoveryError&&recoveryError.message||recoveryError);
      }
      throw error;
    }
  }

  async function run(){
    let out={status:session.step==='COMPLETE'?'COMPLETE':'READY',session:clone(session),advanced:false};
    while(out.status!=='COMPLETE')out=await runStep();
    return out;
  }

  function restore(next){
    const candidate=clone(next);
    validateSession(candidate);
    session=candidate;
    return status();
  }

  return{begin,runStep,run,getStatus:status,restore};
}

module.exports={BANK_STEPS,validateSession,createBankState};

},{}],
"organs/bank/BankStoreOps.js":[function(require,module,exports){
'use strict';

const {identity}=require('../../ligaments/inventory/InventoryService');
const {classifyItem,destinationPacks}=require('./BankLayoutPolicy');
const {bankPackFloor}=require('../../core/contracts/AdventureLandContract');

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function snapshotPacks(snapshot){
  return snapshot&&snapshot.packs&&typeof snapshot.packs==='object'?snapshot.packs:snapshot;
}

function firstOpenFreeTarget(snapshot,packs){
  const source=snapshotPacks(snapshot);
  if(!source||typeof source!=='object')return null;
  for(const pack of packs||[]){
    const slots=source[pack];
    if(!Array.isArray(slots))continue;
    for(let slot=0;slot<slots.length;slot++)if(!slots[slot])return{pack,slot};
  }
  return null;
}

function createBankStoreOps({adapter,inventory,metaResolver=null,travel=null}={}){
  if(!adapter||typeof adapter.snapshot!=='function'||typeof adapter.store!=='function')throw new Error('BANK_STORE_ADAPTER_REQUIRED');
  if(!inventory||typeof inventory.slot!=='function')throw new Error('BANK_STORE_INVENTORY_REQUIRED');

  async function storeExact({inventorySlot,expectedIdentity,item=null}={}){
    const invSlot=Number(inventorySlot);
    if(!Number.isInteger(invSlot)||invSlot<0)return{ok:false,error:'BANK_STORE_INVENTORY_SLOT_INVALID'};

    const current=await inventory.slot(invSlot);
    if(!current)return{ok:false,error:'BANK_STORE_INVENTORY_EMPTY',inventorySlot:invSlot};
    const actualIdentity=identity(current);
    if(expectedIdentity&&actualIdentity!==String(expectedIdentity)){
      return{ok:false,error:'BANK_STORE_IDENTITY_CHANGED',expected:String(expectedIdentity),actual:actualIdentity,inventorySlot:invSlot};
    }

    const candidate=item||current;
    const decision=classifyItem(candidate,{metaResolver});
    if(decision.deposit===false){
      return{ok:false,error:'BANK_STORE_POLICY_BLOCKED',decision:clone(decision),identity:actualIdentity};
    }
    const packs=destinationPacks(decision.category);
    if(!packs.length)return{ok:false,error:'BANK_STORE_DESTINATION_UNRESOLVED',decision:clone(decision)};

    const targetFloor=bankPackFloor(packs[0]);
    if(!targetFloor)return{ok:false,error:'BANK_STORE_DESTINATION_FLOOR_INVALID',decision:clone(decision)};
    if(travel&&typeof travel.toFloor==='function'){
      const moved=await travel.toFloor(targetFloor,{reason:'BANK_STORE_EXACT',target:{category:decision.category,packs}});
      if(!moved||moved.ok!==true){
        return{ok:false,error:'BANK_STORE_TRAVEL_FAILED',category:decision.category,targetFloor,travel:clone(moved)};
      }
    }

    const before=await adapter.snapshot();
    const target=firstOpenFreeTarget(before,packs);
    if(!target){
      const first=packs[0]||null;
      return{
        ok:false,
        error:'BANK_STORE_TARGET_PACK_NOT_OPEN_OR_FULL',
        category:decision.category,
        allowedPacks:packs,
        targetFloor:first?bankPackFloor(first):null,
        needsTravel:true
      };
    }

    const result=await adapter.store(invSlot,target.pack,target.slot);
    if(result&&result.ok===false)return{ok:false,error:'BANK_STORE_NATIVE_FAILED',result:clone(result),target};

    const after=await adapter.snapshot();
    const source=snapshotPacks(after);
    const stored=source&&Array.isArray(source[target.pack])?source[target.pack][target.slot]||null:null;
    const storedIdentity=identity(stored);
    if(!stored||storedIdentity!==actualIdentity){
      return{ok:false,error:'BANK_STORE_VERIFY_TARGET_FAILED',expected:actualIdentity,actual:storedIdentity,target};
    }

    const remaining=await inventory.slot(invSlot);
    if(remaining&&identity(remaining)===actualIdentity){
      return{ok:false,error:'BANK_STORE_VERIFY_INVENTORY_NOT_CLEARED',identity:actualIdentity,inventorySlot:invSlot,target};
    }

    return{
      ok:true,verified:true,
      category:decision.category,
      reason:decision.reason,
      pack:target.pack,
      slot:target.slot,
      floor:bankPackFloor(target.pack),
      inventorySlot:invSlot,
      identity:storedIdentity,
      item:clone(stored),
      nativeResult:clone(result)
    };
  }

  return{storeExact};
}

module.exports={snapshotPacks,firstOpenFreeTarget,createBankStoreOps};

},{"../../ligaments/inventory/InventoryService":"ligaments/inventory/InventoryService.js","./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js","../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js"}],
"organs/bank/BankTravelOps.js":[function(require,module,exports){
'use strict';

const {createRouteService}=require('../../ligaments/movement/RouteService');
const {BANK_ROUTE_REVISION,BANK_ROUTE_MODEL,BANK_FLOORS,BANK_GRAPH}=require('../../adapters/pogipath/BankRouteModel');

const OWNER='BANK';
const PRIORITY=50;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function bankFloor(value){
  const id=String(value||'');
  return BANK_FLOORS.includes(id)?id:null;
}

function edgeFor(from,to){
  const id=String(from)+'->'+String(to);
  return BANK_ROUTE_MODEL.edges.find(x=>x.id===id)||null;
}

function shortestFloorPath(from,target){
  const to=bankFloor(target);
  if(!to)return{ok:false,error:'BANK_TRAVEL_TARGET_FLOOR_INVALID',target:String(target||'')||null};

  let start=bankFloor(from);
  const prefix=[];
  if(!start){
    prefix.push({
      id:'external->bank',
      from:String(from||'external')||'external',
      to:'bank',
      type:'SMART_MOVE_BANK_ENTRY',
      enabled:true
    });
    start='bank';
  }
  if(start===to)return{ok:true,from:String(from||''),target:to,hops:prefix};

  const queue=[[start,[]]],seen=new Set([start]);
  while(queue.length){
    const [node,path]=queue.shift();
    for(const next of BANK_GRAPH[node]||[]){
      if(seen.has(next))continue;
      const edge=edgeFor(node,next);
      if(!edge)continue;
      const nextPath=[...path,clone(edge)];
      if(next===to)return{ok:true,from:String(from||''),target:to,hops:[...prefix,...nextPath]};
      seen.add(next);
      queue.push([next,nextPath]);
    }
  }
  return{ok:false,error:'BANK_TRAVEL_PATH_UNAVAILABLE',from:String(from||''),target:to};
}

function createBankTravelOps({
  movement,
  navigation,
  adapter,
  routeService=null,
  nativeTravel=null,
  character='Rentaro',
  now=Date.now,
  maxRecoveryAttempts=3
}={}){
  if(!movement||typeof movement.acquire!=='function'||typeof movement.smartMove!=='function'||typeof movement.release!=='function'){
    throw new Error('BANK_TRAVEL_MOVEMENT_REQUIRED');
  }
  if(!navigation||typeof navigation.resolve!=='function')throw new Error('BANK_TRAVEL_NAVIGATION_REQUIRED');
  if(!adapter||typeof adapter.currentMap!=='function')throw new Error('BANK_TRAVEL_MAP_ADAPTER_REQUIRED');

  const route=routeService||createRouteService({now,maxRecoveryAttempts});
  const observed=route.observeModel({revision:BANK_ROUTE_REVISION,model:BANK_ROUTE_MODEL});
  if(!observed||observed.ok!==true)throw new Error('BANK_TRAVEL_ROUTE_MODEL_UNAVAILABLE');

  let lastResult=null;
  let attempts=0;

  function currentMap(){
    const map=adapter.currentMap();
    return map==null?null:String(map);
  }

  function resolveTarget(target,options={}){
    const floor=bankFloor(target);
    if(floor)return{ok:true,kind:'FLOOR',floor,label:floor};
    const descriptor=navigation.resolve(target,{
      selectedPack:options.selectedPack||null,
      resolvedPack:options.resolvedPack||null,
      currentMap:currentMap()
    });
    if(!descriptor||descriptor.ok!==true)return descriptor||{ok:false,error:'BANK_TRAVEL_TARGET_UNRESOLVED'};
    if(!bankFloor(descriptor.floor))return{ok:false,error:'BANK_TRAVEL_TARGET_FLOOR_INVALID',descriptor:clone(descriptor)};
    return{ok:true,kind:descriptor.kind,floor:descriptor.floor,descriptor:clone(descriptor)};
  }

  async function moveHop(edge,{reason}={}){
    const marked=route.markEdgeStarted(edge.id);
    if(!marked||marked.ok!==true)return{ok:false,error:marked&&marked.error||'BANK_ROUTE_EDGE_START_FAILED',edge:clone(edge)};

    let moved;
    if(nativeTravel&&typeof nativeTravel.toMap==='function'){
      // Real game: native doors and Merchant-saved map routes; never smart_move.
      moved=await nativeTravel.toMap(edge.to);
      if(!moved||moved.ok!==true){
        const recovery=route.reportFailure('BANK_NATIVE_ROUTE_FAILED',{edge,moved});
        return{ok:false,retrying:false,error:'BANK_NATIVE_ROUTE_FAILED',
          edge:clone(edge),movement:clone(moved),recovery:clone(recovery)};
      }
    }else{
      // Keep legacy isolated BankTravel mocks/test harness compatible.
      // In the real LiveAdapters.smartMove() is forbidden and this branch
      // cannot move a live character without the native route adapter.
      const lease=movement.acquire(OWNER,{priority:PRIORITY});
      if(!lease||lease.ok!==true){
        route.reportFailure('BANK_MOVEMENT_LEASE_FAILED',{edge,lease});
        return{ok:false,error:'BANK_MOVEMENT_LEASE_FAILED',edge:clone(edge),lease:clone(lease)};
      }
      try{
        moved=await movement.smartMove(OWNER,{map:edge.to},{
          source:'POGIPATH_BANK_TRAVEL',
          reason:String(reason||'BANK_TRAVEL'),
          expectedMap:edge.to
        });
      }finally{movement.release(OWNER);}
      if(!moved||moved.ok!==true){
        const recovery=route.reportFailure('BANK_SMART_MOVE_FAILED',{edge,moved});
        return{ok:false,retrying:!!(recovery&&recovery.retrying),
          error:'BANK_SMART_MOVE_FAILED',edge:clone(edge),
          movement:clone(moved),recovery:clone(recovery)};
      }
    }

    const actual=currentMap();
    if(actual!==edge.to){
      const recovery=route.reportFailure('BANK_ARRIVAL_PROOF_FAILED',{edge,expected:edge.to,actual});
      return{
        ok:false,
        retrying:!!(recovery&&recovery.retrying),
        error:'BANK_ARRIVAL_PROOF_FAILED',
        edge:clone(edge),
        expectedMap:edge.to,
        actualMap:actual,
        recovery:clone(recovery)
      };
    }

    const checkpoint=route.markSafeCheckpoint('bank-floor:'+edge.to,{position:{map:actual}});
    if(!checkpoint||checkpoint.ok!==true){
      return{ok:false,error:checkpoint&&checkpoint.error||'BANK_ROUTE_CHECKPOINT_FAILED',edge:clone(edge),checkpoint:clone(checkpoint)};
    }
    return{
      ok:true,
      edge:clone(edge),
      map:actual,
      checkpoint:clone(checkpoint)
    };
  }

  async function toFloor(targetFloor,{reason='BANK_TRAVEL',target=null}={}){
    const floor=bankFloor(targetFloor);
    if(!floor)return{ok:false,error:'BANK_TRAVEL_TARGET_FLOOR_INVALID',targetFloor:String(targetFloor||'')||null};

    attempts++;
    const start=currentMap();
    const requested=route.request({
      owner:OWNER,
      character:String(character||'Rentaro'),
      destination:{kind:'BANK_FLOOR',floor,target:clone(target)}
    });
    if(!requested||requested.ok!==true){
      lastResult={ok:false,error:requested&&requested.error||'BANK_ROUTE_REQUEST_FAILED',route:clone(requested)};
      return clone(lastResult);
    }

    if(start===floor){
      const arrived=route.arrive({
        requiredMap:floor,
        actualMap:start,
        alreadyThere:true,
        arrivalProof:'CHARACTER_MAP_EQUALS_DESTINATION'
      });
      lastResult={
        ok:true,
        alreadyThere:true,
        targetFloor:floor,
        startMap:start,
        finalMap:start,
        hops:[],
        hopCount:0,
        route:clone(route.getStatus()),
        arrival:clone(arrived),
        pogipath:{shadowOnly:true,characterRoutingConnected:false,movementExecutor:'MovementService'}
      };
      return clone(lastResult);
    }

    const completed=[];
    let guard=0;
    while(currentMap()!==floor){
      if(++guard>12){
        route.fail('BANK_TRAVEL_LOOP_GUARD',{targetFloor:floor,currentMap:currentMap()});
        lastResult={ok:false,error:'BANK_TRAVEL_LOOP_GUARD',targetFloor:floor,currentMap:currentMap(),hops:clone(completed)};
        return clone(lastResult);
      }

      const plan=shortestFloorPath(currentMap(),floor);
      if(!plan.ok){
        route.fail(plan.error,plan);
        lastResult={...clone(plan),hops:clone(completed),route:clone(route.getStatus())};
        return clone(lastResult);
      }
      if(!plan.hops.length)break;

      const hop=await moveHop(plan.hops[0],{reason});
      if(!hop.ok){
        if(hop.retrying===true)continue;
        lastResult={
          ok:false,
          error:hop.error,
          targetFloor:floor,
          startMap:start,
          currentMap:currentMap(),
          hops:clone(completed),
          failedHop:clone(hop),
          route:clone(route.getStatus())
        };
        return clone(lastResult);
      }
      completed.push(hop);
    }

    const finalMap=currentMap();
    if(finalMap!==floor){
      route.fail('BANK_FINAL_ARRIVAL_PROOF_FAILED',{expected:floor,actual:finalMap});
      lastResult={
        ok:false,error:'BANK_FINAL_ARRIVAL_PROOF_FAILED',
        expectedMap:floor,actualMap:finalMap,hops:clone(completed),route:clone(route.getStatus())
      };
      return clone(lastResult);
    }

    const arrived=route.arrive({
      requiredMap:floor,
      actualMap:finalMap,
      arrivalProof:'CHARACTER_MAP_EQUALS_DESTINATION',
      hopCount:completed.length
    });
    lastResult={
      ok:true,
      targetFloor:floor,
      startMap:start,
      finalMap,
      hops:clone(completed),
      hopCount:completed.length,
      route:clone(route.getStatus()),
      arrival:clone(arrived),
      pogipath:{shadowOnly:true,characterRoutingConnected:false,movementExecutor:'MovementService'}
    };
    return clone(lastResult);
  }

  async function travelTo(target,options={}){
    const resolved=resolveTarget(target,options);
    if(!resolved||resolved.ok!==true)return resolved||{ok:false,error:'BANK_TRAVEL_TARGET_UNRESOLVED'};
    const out=await toFloor(resolved.floor,{
      reason:options.reason||'BANK_TRAVEL',
      target:resolved.descriptor||{kind:resolved.kind,floor:resolved.floor}
    });
    return{...out,resolved:clone(resolved)};
  }

  async function toPack(pack,options={}){
    return travelTo(String(pack||''),{...options,reason:options.reason||'BANK_PACK_TRAVEL'});
  }

  async function travel({session}={}){
    const out=await travelTo('GENERAL',{reason:'BANK_STATE_TRAVEL'});
    if(!out||out.ok!==true)return out;
    return{
      ok:true,
      targetFloor:out.targetFloor,
      startMap:out.startMap,
      finalMap:out.finalMap,
      hopCount:out.hopCount,
      hops:clone(out.hops),
      arrival:clone(out.arrival),
      route:clone(out.route),
      pogipath:clone(out.pogipath),
      recoveryStep:session&&session.step||'TRAVEL'
    };
  }

  async function health(){
    return{
      ok:true,
      currentMap:currentMap(),
      attempts,
      lastResult:clone(lastResult),
      route:clone(route.getStatus()),
      model:{revision:BANK_ROUTE_REVISION,source:clone(BANK_ROUTE_MODEL.source)}
    };
  }

  function snapshot(){
    return{
      version:3,
      state:'BANK_TRAVEL',
      currentMap:currentMap(),
      attempts,
      lastResult:clone(lastResult),
      route:clone(route.getStatus())
    };
  }

  return{
    travel,travelTo,toFloor,toPack,resolveTarget,
    health,snapshot,routeStatus:()=>clone(route.getStatus())
  };
}

module.exports={OWNER,PRIORITY,bankFloor,edgeFor,shortestFloorPath,createBankTravelOps};

},{"../../ligaments/movement/RouteService":"ligaments/movement/RouteService.js","../../adapters/pogipath/BankRouteModel":"adapters/pogipath/BankRouteModel.js"}],
"organs/bank/NativeBankOps.js":[function(require,module,exports){
'use strict';

// Rentaro production bank operations: native bank_store/bank_deposit, actual
// inventory + bank snapshot verification, and canonical V3 storage categories.
// Never report a step proven just because a command was submitted.
const {classifyItem,destinationPacks}=require('./BankLayoutPolicy');
const {sellDecision}=require('../gear/GearRegistry');
const {bankPackFloor}=require('../../core/contracts/AdventureLandContract');
const {createNativeBankTravel}=require('./NativeBankTravel');
const PROTECTED=new Set([
  'anniversarygift','Slice_blueberry','wbasher','bataxe','vhammer',
  'hpot0','hpot1','mpot0','mpot1','tracker','computer',
  'zapper','ololipop','glolipop','elixirint0','elixirstr0',
  'elixirdex0','broom','jacko','pumpkinspice','supercomputer','stand0','stand1','stand2','angelwings','gcape'
]);
const same=(a,b)=>a&&b&&String(a.name)===String(b.name)&&
  Number(a.level||0)===Number(b.level||0)&&String(a.p||'')===String(b.p||'');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function createNativeBankOps({root,bank,travel,routes,now=Date.now,keepGold=50000}={}){
  if(!root||!bank||!travel)throw Error('NATIVE_BANK_OPS_DEPENDENCIES_REQUIRED');
  const nativeTravel=createNativeBankTravel({root,merchantRoutes:routes});
  const history={deposits:[],gold:0,skipped:[],last_at:null};
  function actor(){return root.character||{}}
  function isBank(){return ['bank','bank_b','bank_u'].includes(String(actor().map||''))}
  async function snapshot(){
    const snap=await bank.snapshot();
    return snap?.packs&&typeof snap.packs==='object'?snap.packs:snap;
  }
  function depositable(item){
    if(!item||!item.name)return false;
    if(item.l===true||item.locked===true||item.p==='s'||item.p==='shiny')return false;
    if(PROTECTED.has(String(item.name)))return false;
    if(sellDecision(item,{character:'Rentaro'}).action==='SELL')return false;
    if(String(item.name)==='wbasher'&&Number(item.level||0)>=3)return false;
    const decision=classifyItem(item,{metaResolver:name=>bank.itemMeta?.(name)||null});
    return decision&&decision.deposit!==false?decision:null;
  }
  function planCargo(){
    const items=Array.isArray(actor().items)?actor().items:[];
    const entries=[],held=[];
    for(let i=0;i<items.length;i++){
      const item=items[i];if(!item)continue;
      const decision=depositable(item);
      if(!decision){held.push({slot:i,name:item.name});continue}
      const packs=destinationPacks(decision.category);
      if(!packs.length){held.push({slot:i,name:item.name,reason:'DESTINATION_MISSING'});continue}
      entries.push({slot:i,name:String(item.name),level:Number(item.level||0),
        p:String(item.p||''),quantity:Math.max(1,Number(item.q||1)),
        category:decision.category,packs:[...packs]});
    }
    return{entries,held};
  }
  async function enter(){
    if(actor().name!=='Rentaro')return{ok:false,error:'BANK_RENTARO_ONLY'};
    if(typeof root.bank_store!=='function'||typeof root.bank_deposit!=='function')
      return{ok:false,error:'BANK_NATIVE_HOOKS_UNAVAILABLE'};
    return{ok:true,source:'NATIVE_BANK_STORE_DEPOSIT'};
  }
  async function scan(){
    if(!isBank())return{ok:false,error:'BANK_SCAN_NOT_IN_BANK'};
    const snap=await snapshot();
    const packs=Object.keys(snap||{}).filter(k=>/^items\d+$/.test(k));
    const inventory=Array.isArray(actor().items)?actor().items:[];
    return{ok:true,map:actor().map,openPacks:packs,
      inventorySlots:inventory.filter(Boolean).length,
      gold:Number(actor().gold||0)};
  }
  async function apply_policy(){
    const p=planCargo();
    return{ok:true,policy:'V3_NATIVE_INCOMING_DEPOSITS',
      plan:{entries:p.entries,held:p.held},pending:p.entries.length};
  }
  async function storeExact(entry){
    const current=actor().items?.[entry.slot];
    if(!current||!same(current,entry))
      return{ok:false,error:'BANK_INVENTORY_IDENTITY_CHANGED',slot:entry.slot};
    let capacity=false;
    for(const pack of entry.packs){
      const floor=bankPackFloor(pack);
      if(!floor)continue;
      const travelled=await travel.toFloor(floor,{reason:'BANK_STORE_INCOMING_NATIVE',target:{pack}});
      if(!travelled?.ok)return{ok:false,error:'BANK_STORE_FLOOR_TRAVEL_FAILED',
        floor,detail:travelled?.error};
      const packs=await snapshot(),items=packs?.[pack];
      if(!Array.isArray(items))continue;
      const slot=items.findIndex(v=>v==null);
      if(slot<0)continue;
      capacity=true;
      const result=await bank.store(entry.slot,pack,slot);
      if(result?.ok===false)return{ok:false,error:'BANK_NATIVE_STORE_REJECTED',
        pack,slot,result};
      const deadline=Date.now()+7000;
      while(Date.now()<deadline){
        const after=await snapshot();
        const recorded=after?.[pack]?.[slot];
        const bag=actor().items?.[entry.slot];
        if(same(recorded,entry)&&!same(bag,entry))
          return{ok:true,pack,slot,inventorySlot:entry.slot,item:entry.name,verified:true};
        await wait(170);
      }
      return{ok:false,error:'BANK_NATIVE_STORE_UNVERIFIED',pack,slot};
    }
    return{ok:false,error:capacity?'BANK_DEPOSIT_TARGET_NOT_VERIFIED':'BANK_CATEGORY_PACKS_FULL_OR_UNAVAILABLE',
      item:entry.name,category:entry.category};
  }
  async function organize({session}={}){
    const plan=session?.proofs?.APPLY_POLICY?.plan;
    if(!plan||!Array.isArray(plan.entries))return{ok:false,error:'BANK_POLICY_PLAN_REQUIRED'};
    history.deposits=[];history.skipped=[];history.gold=0;
    let count=0;
    for(const entry of plan.entries){
      const current=actor().items?.[entry.slot];
      if(!current||!same(current,entry)){history.skipped.push({entry:entry.name,reason:'CHANGED'});continue}
      const stored=await storeExact(entry);
      if(stored.ok){history.deposits.push(stored);count++}
      else{
        history.skipped.push({entry:entry.name,reason:stored.error});
        // A native rejection is a real failure; do not claim completed banking.
        if(!['BANK_CATEGORY_PACKS_FULL_OR_UNAVAILABLE'].includes(stored.error))
          return{ok:false,error:stored.error,stored:count,detail:stored};
      }
    }
    const floor=String(actor().map||'');
    if(floor!=='bank'){
      const back=await travel.toFloor('bank',{reason:'BANK_GOLD_DEPOSIT'});
      if(!back?.ok)return{ok:false,error:'BANK_RETURN_MAIN_FLOOR_FAILED',detail:back?.error};
    }
    const goldBefore=Number(actor().gold||0);
    const deposit=Math.max(0,Math.floor(goldBefore-Math.max(50000,Number(keepGold)||50000)));
    if(deposit>0){
      const beforeGold=Number(actor().gold||0);
      const nativeResult=await root.bank_deposit(deposit);
      if(nativeResult?.failed===true)return{ok:false,error:'BANK_NATIVE_GOLD_DEPOSIT_FAILED'};
      let verified=false;
      const until=Date.now()+7000;
      while(Date.now()<until){
        if(Number(actor().gold||0)<beforeGold){verified=true;break}
        await wait(180);
      }
      if(!verified)return{ok:false,error:'BANK_NATIVE_GOLD_DEPOSIT_UNVERIFIED'};
      history.gold+=beforeGold-Number(actor().gold||0);
    }
    history.last_at=Number(now());
    return{ok:true,verified:true,itemsStored:count,
      goldDeposited:history.gold,skipped:history.skipped.slice(),
      remainingEligible:planCargo().entries.length};
  }
  async function verify(){
    const currentGold=Number(actor().gold||0);
    if(currentGold>Math.max(50000,Number(keepGold)||50000)+1)
      return{ok:false,error:'BANK_GOLD_KEEP_THRESHOLD_EXCEEDED',carriedGold:currentGold};
    return{ok:true,verified:true,deposits:history.deposits.length,
      totalGoldDeposited:history.gold,remainingEligible:planCargo().entries.length};
  }
  async function publish(){
    const event={at:Number(now()),bankedItems:history.deposits.length,
      goldDeposited:history.gold,skipped:history.skipped.slice(),
      verified:true};
    try{root.__POGI_V3_LAST_BANK_EVENT=event}catch(_){}
    return{ok:true,event};
  }
  async function exit(){
    if(String(actor().map||'')!=='bank'){
      const back=await travel.toFloor('bank',{reason:'BANK_EXIT'});
      if(!back?.ok)return{ok:false,error:'BANK_EXIT_RETURN_BANK_FAILED'};
    }
    const left=await nativeTravel.toMap('main');
    if(!left?.ok)return{ok:false,error:'BANK_EXIT_NATIVE_DOOR_FAILED',detail:left?.error};
    if(typeof root.town==='function'){
      try{await root.town()}catch(_){}
    }
    return{ok:String(actor().map||'')==='main',map:actor().map,
      deposits:history.deposits.length,gold:history.gold};
  }
  return{enter,scan,apply_policy,organize,verify,publish,exit,
    status:()=>({...history,map:actor().map})};
}
module.exports={createNativeBankOps};

},{"./BankLayoutPolicy":"organs/bank/BankLayoutPolicy.js","../gear/GearRegistry":"organs/gear/GearRegistry.js","../../core/contracts/AdventureLandContract":"core/contracts/AdventureLandContract.js","./NativeBankTravel":"organs/bank/NativeBankTravel.js"}],
"organs/bank/NativeBankTravel.js":[function(require,module,exports){
'use strict';

// V3 bank door adapter. Adventure Land G.maps doors/spawns, not SmartMove,
// supply the bank-floor transitions. Rentaro's PogiPath handles the approach
// to Main; native move() + can_move_to() handle each final bank door leg.
const BANK_MAPS=new Set(['bank','bank_b','bank_u']);
const pos=c=>({x:Number(c?.real_x??c?.x),y:Number(c?.real_y??c?.y)});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function createNativeBankTravel({root,merchantRoutes=null}={}){
  if(!root)throw Error('NATIVE_BANK_ROOT_REQUIRED');
  function current(){return root.character||{};}
  function nativeDoor(map,target){
    const doors=root.G?.maps?.[map]?.doors||[];
    const row=doors.find(d=>Array.isArray(d)&&String(d[4])===String(target));
    if(!row)return null;
    return{map,at:{x:Number(row[0]),y:Number(row[1])},
      to:String(row[4]),spawn:Number(row[5])};
  }
  async function leg(to){
    const c=current(),here=pos(c);
    if(![here.x,here.y,to.x,to.y].every(Number.isFinite))
      return{ok:false,error:'BANK_NATIVE_POSITION_INVALID'};
    if(dist(here,to)<=26)return{ok:true,alreadyThere:true};
    if(typeof root.move!=='function'||typeof root.can_move_to!=='function')
      return{ok:false,error:'BANK_NATIVE_MOVE_HOOKS_MISSING'};
    const remaining=dist(here,to);
    const next={x:here.x+(to.x-here.x)*Math.min(30,remaining-18)/remaining,
      y:here.y+(to.y-here.y)*Math.min(30,remaining-18)/remaining};
    if(root.can_move_to(next.x,next.y)!==true)
      return{ok:false,error:'BANK_NATIVE_DOOR_COLLISION',next};
    const moved=await root.move(next.x,next.y);
    if(moved?.failed===true)return{ok:false,error:'BANK_NATIVE_MOVE_FAILED'};
    const until=Date.now()+6000;
    while(Date.now()<until){
      if(dist(pos(current()),next)<=9)return{ok:true};
      await delay(130);
    }
    return{ok:false,error:'BANK_NATIVE_STEP_TIMEOUT',next};
  }
  async function walkDoor(target){
    const before=String(current().map||'');
    const door=nativeDoor(before,target);
    if(!door)return{ok:false,error:'BANK_NATIVE_DOOR_NOT_IN_G',from:before,target};
    for(let i=0;i<150;i++){
      if(String(current().map||'')!==before)
        return{ok:false,error:'BANK_NATIVE_MAP_CHANGED_DURING_WALK'};
      if(dist(pos(current()),door.at)<=26)break;
      const moved=await leg(door.at);
      if(!moved.ok)return moved;
    }
    if(dist(pos(current()),door.at)>30)
      return{ok:false,error:'BANK_NATIVE_DOOR_APPROACH_UNFINISHED',from:before,target};
    if(typeof root.transport!=='function')
      return{ok:false,error:'BANK_NATIVE_TRANSPORT_UNAVAILABLE'};
    const outcome=await root.transport(door.to,door.spawn);
    if(outcome?.failed===true)return{ok:false,error:'BANK_NATIVE_TRANSPORT_FAILED'};
    const until=Date.now()+7000;
    while(Date.now()<until){
      if(String(current().map||'')===target)
        return{ok:true,from:before,to:target,spawn:door.spawn,verified:true};
      await delay(160);
    }
    return{ok:false,error:'BANK_NATIVE_DOOR_ARRIVAL_TIMEOUT',from:before,to:target};
  }
  async function toMap(target){
    const desired=String(target||'');
    if(!BANK_MAPS.has(desired)&&desired!=='main')
      return{ok:false,error:'BANK_UNSUPPORTED_DESTINATION',target:desired};
    let here=String(current().map||'');
    if(here===desired)return{ok:true,alreadyThere:true,map:here};
    if(!BANK_MAPS.has(here)&&here!=='main'){
      if(typeof merchantRoutes?.followBossRoute!=='function')
        return{ok:false,error:'BANK_SHARED_POGIPATH_UNAVAILABLE'};
      const destination={map:'main',x:0,y:0,stageRadius:35};
      const route=await merchantRoutes.followBossRoute(destination);
      if(!route?.ok)return{ok:false,error:'BANK_POGIPATH_MAIN_APPROACH_FAILED',detail:route?.error};
      here=String(current().map||'');
      if(here!=='main')return{ok:false,error:'BANK_POGIPATH_NOT_ON_MAIN',map:here};
    }
    if(here==='main')return walkDoor('bank');
    if(here==='bank_b'&&desired==='bank_u')return walkDoor('bank_u');
    if(here==='bank_u'&&desired==='bank_b')return walkDoor('bank_b');
    if(here==='bank_b'&&desired==='bank')return walkDoor('bank');
    if(here==='bank'&&desired==='bank_b')return walkDoor('bank_b');
    if(here==='bank'&&desired==='main')return walkDoor('main');
    return{ok:false,error:'BANK_NATIVE_REQUIRED_INTERMEDIATE_FLOOR',from:here,to:desired};
  }
  return{toMap,walkDoor,nativeDoor,status:()=>({currentMap:current().map,
    source:'NATIVE_G_MAPS_DOORS_MOVE_NO_SMART_MOVE'})};
}
module.exports={createNativeBankTravel};

},{}],
"organs/bosses/BossMissionCoordinator.js":[function(require,module,exports){
'use strict';

const {BOSS_MTYPES,EVENT_BOSS_MTYPES}=require('./ScanBossState');

const BUS_KEY='__POGI_V3_BOSS_MISSION_BUS_V1';
const BUS_SCHEMA=1;
const DEFAULT_TTL_MS=4000;
const DEFAULT_ACTIVATION_RADIUS=200;
const BOSS_SET=new Set(BOSS_MTYPES.map(String));
const EVENT_BOSS_SET=new Set(EVENT_BOSS_MTYPES.map(String));

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function finite(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function sharedRoot(root){
  const local=root&&typeof root==='object'?root:(typeof globalThis!=='undefined'?globalThis:{});
  try{
    if(local&&local.top&&typeof local.top==='object')return local.top;
  }catch(error){}
  return local;
}
function activeMonster(row){
  return !!row&&row.type==='monster'&&row.dead!==true&&row.rip!==true&&row.visible!==false;
}
function bossIdentity(row,id=''){
  if(!row||typeof row!=='object')return null;
  const mtype=String(row.mtype||row.type_name||'');
  if(!BOSS_SET.has(mtype))return null;
  return{
    boss_id:String(row.id||id||''),
    mtype,
    map:String(row.map||''),
    instance:String(row.in||row.instance||''),
    x:finite(row.real_x!==undefined?row.real_x:row.x),
    y:finite(row.real_y!==undefined?row.real_y:row.y),
    distance:finite(row.distance,Infinity)
  };
}

function createBossMissionCoordinator({
  root=(typeof globalThis!=='undefined'?globalThis:{}),
  characterName='',
  role='',
  now=Date.now,
  ttlMs=DEFAULT_TTL_MS,
  activationRadius=DEFAULT_ACTIVATION_RADIUS,
  transport=null
}={}){
  const character=String(characterName||'');
  const roleName=String(role||'');
  const frameRoot=sharedRoot(root);
  const leaseMs=Math.max(1000,Number(ttlMs)||DEFAULT_TTL_MS);
  const radius=Math.max(1,Number(activationRadius)||DEFAULT_ACTIVATION_RADIUS);
  let lastSeenSequence=0;
  let lastLocalObservation=null;

  function bus(){
    try{
      const existing=frameRoot[BUS_KEY];
      if(existing&&existing.schema===BUS_SCHEMA&&typeof existing==='object')return existing;
      const created={schema:BUS_SCHEMA,sequence:0,mission:null,pending:[],updated_at:0};
      frameRoot[BUS_KEY]=created;
      return created;
    }catch(error){
      return{schema:BUS_SCHEMA,sequence:0,mission:null,pending:[],updated_at:0,ephemeral:true};
    }
  }

  function validMission(mission){
    if(!mission||typeof mission!=='object')return false;
    const expires=Number(mission.lease_until||0);
    if(!Number.isFinite(expires)||expires<=Number(now()))return false;
    const mtype=String(mission.mtype||'');
    const id=String(mission.boss_id||'');
    if(!mtype&&!id)return false;
    if(mtype&&!BOSS_SET.has(mtype))return false;
    return true;
  }

  function readTransport(){
    if(!transport||typeof transport.read!=='function')return null;
    try{
      const value=transport.read();
      if(value&&typeof value.then==='function')return null;
      return validMission(value)?clone(value):null;
    }catch(error){return null;}
  }

  function writeTransport(mission){
    if(!transport||typeof transport.publish!=='function')return;
    try{
      const result=transport.publish(clone(mission));
      if(result&&typeof result.catch==='function')result.catch(()=>{});
    }catch(error){}
  }

  // Queue other Rentaro sightings while the crew works on one mission.
  // A queued boss is only advisory until it becomes a current mission.
  function promoteNext(row){
    const at=Number(now()),pending=Array.isArray(row.pending)?row.pending:[];
    row.pending=pending.filter(p=>p&&Number(p.expires_at)>at);
    while(row.pending.length){
      const next=row.pending.shift();
      const claimed={...clone(next.identity)};
      if(!claimed.mtype||!BOSS_SET.has(String(claimed.mtype)))continue;
      row.sequence=Math.max(Number(row.sequence||0),lastSeenSequence)+1;
      row.mission={schema:BUS_SCHEMA,sequence:row.sequence,state:'WORLD_BOSS',
        boss_id:String(claimed.boss_id||''),mtype:String(claimed.mtype),
        boss_class:EVENT_BOSS_SET.has(String(claimed.mtype))?'EVENT_BOSS':'REGULAR_BOSS',
        map:String(claimed.map||''),instance:String(claimed.instance||''),
        x:finite(claimed.x),y:finite(claimed.y),
        observed_by:'Rentaro',observed_role:'MERCHANT',
        observed_at:Number(next.observed_at),source:'MERCHANT_QUEUED_BOSS',
        reason:'NEXT_MERCHANT_BOSS',rally_mode:'DEFAULT',
        lease_until:at+Math.max(leaseMs,30000),
        warrior_started_boss_id:null,warrior_started_at:null,warrior_started_by:null};
      row.updated_at=at;
      lastSeenSequence=row.sequence;
      writeTransport(row.mission);
      return clone(row.mission);
    }
    return null;
  }
  function current(){
    const remote=readTransport();
    if(remote)return remote;
    const row=bus();
    if(!validMission(row.mission)){
      if(row.mission&&Number(row.mission.lease_until||0)<=Number(now()))row.mission=null;
      if(!row.mission)promoteNext(row);
      if(!validMission(row.mission))return null;
    }
    lastSeenSequence=Math.max(lastSeenSequence,Number(row.mission.sequence||0));
    return clone(row.mission);
  }
  function complete(sequence){
    const row=bus(),currentMission=validMission(row.mission)?row.mission:null;
    if(!currentMission||Number(currentMission.sequence)!==Number(sequence))
      return{ok:false,error:'BOSS_COMPLETE_SEQUENCE_MISMATCH'};
    const done=clone(currentMission);
    row.mission=null;row.updated_at=Number(now());
    row.last_completed={boss_id:done.boss_id,mtype:done.mtype,at:row.updated_at};
    const next=promoteNext(row);
    // Suppress stale in-tab remote transport reads after a completed fight.
    writeTransport(next);
    return{ok:true,completed:done,next:clone(next)};
  }
  function publish(identity,{source='LOCAL_VISIBLE',reason='BOSS_PRIORITY'}={}){
    if(!identity||typeof identity!=='object')return{ok:false,error:'BOSS_IDENTITY_REQUIRED'};
    const mtype=String(identity.mtype||'');
    const bossId=String(identity.boss_id||identity.id||'');
    if(mtype&&!BOSS_SET.has(mtype))return{ok:false,error:'BOSS_MTYPE_NOT_APPROVED',mtype};
    if(!mtype&&!bossId)return{ok:false,error:'BOSS_IDENTITY_REQUIRED'};
    const row=bus();
    const at=Number(now());
    const map=String(identity.map||'');
    const instance=String(identity.instance||identity.in||'');
    const previous=validMission(row.mission)?row.mission:null;
    // Ignore a brief stale sighting of the just-finished boss.
    if(row.last_completed?.boss_id&&
       String(row.last_completed.boss_id)===bossId&&
       at-Number(row.last_completed.at||0)<15000)
      return{ok:true,mission:current(),published:false,ignored:'RECENT_BOSS_COMPLETED'};
    // Merchant scouting never diverts an active boss. Save up to four unique
    // newer sightings for Harutora after the current fight.
    if(roleName==='MERCHANT'&&source==='VISIBLE_BOSS_200'&&previous&&
       ((bossId&&String(previous.boss_id||'')!==bossId)||
         (!bossId&&String(previous.mtype||'')!==mtype))){
      row.pending=Array.isArray(row.pending)?row.pending:[];
      const id=bossId||mtype+':'+map+':'+instance;
      const existing=row.pending.find(p=>p.id===id);
      const entry={id,identity:{...clone(identity),boss_id:bossId,mtype,
        map,instance},observed_at:at,expires_at:at+120000};
      if(existing)Object.assign(existing,entry);
      else row.pending.push(entry);
      row.pending=row.pending.slice(-4);
      return{ok:true,mission:clone(previous),published:false,queued:true};
    }

    const sameBoss=!!(
      previous &&
      (
        (bossId&&String(previous.boss_id||'')===bossId) ||
        (
          !bossId &&
          !String(previous.boss_id||'') &&
          String(previous.mtype||'')===mtype &&
          String(previous.map||'')===map &&
          String(previous.instance||'')===instance
        )
      )
    );
    const sequence=sameBoss
      ?Number(previous.sequence||row.sequence||lastSeenSequence||1)
      :Math.max(Number(row.sequence||0),lastSeenSequence)+1;
    const mission={
      schema:BUS_SCHEMA,
      sequence,
      state:'WORLD_BOSS',
      boss_id:bossId||null,
      mtype:mtype||null,
      boss_class:EVENT_BOSS_SET.has(mtype)?'EVENT_BOSS':'REGULAR_BOSS',
      map,
      instance,
      x:finite(identity.x),
      y:finite(identity.y),
      source:String(source||'LOCAL_VISIBLE'),
      reason:String(reason||'BOSS_PRIORITY'),
      rally_mode:String(identity.rally_mode||'DEFAULT'),
      observed_by:character||null,
      observed_role:roleName||null,
      observed_at:at,
      lease_until:sameBoss?Math.max(Number(previous.lease_until||0),at+leaseMs):at+leaseMs,
      warrior_started_boss_id:sameBoss?String(previous.warrior_started_boss_id||''):null,
      warrior_started_at:sameBoss?finite(previous.warrior_started_at):null,
      warrior_started_by:sameBoss?String(previous.warrior_started_by||''):null
    };
    row.schema=BUS_SCHEMA;
    row.sequence=sequence;
    row.mission=clone(mission);
    row.updated_at=at;
    lastSeenSequence=sequence;
    writeTransport(mission);
    return{ok:true,mission:clone(mission)};
  }

  function markWarriorStarted(targetId,mtype=''){
    const row=bus();
    const mission=validMission(row.mission)?row.mission:null;
    if(!mission)return{ok:false,error:'BOSS_MISSION_NOT_ACTIVE'};

    const id=String(targetId||'');
    const type=String(mtype||mission.mtype||'');
    const missionId=String(mission.boss_id||'');

    if(missionId&&id&&missionId!==id){
      return{ok:false,error:'BOSS_MISSION_ID_MISMATCH',mission:clone(mission)};
    }
    if(type&&mission.mtype&&String(mission.mtype)!==type){
      return{ok:false,error:'BOSS_MISSION_MTYPE_MISMATCH',mission:clone(mission)};
    }

    const at=Number(now());
    mission.warrior_started_boss_id=id||missionId||null;
    mission.warrior_started_at=at;
    mission.warrior_started_by='Hibari';
    mission.lease_until=Math.max(Number(mission.lease_until||0),at+leaseMs);
    row.mission=clone(mission);
    row.updated_at=at;
    writeTransport(mission);
    return{ok:true,mission:clone(mission)};
  }

  function explicitMission(ctx={}){
    const raw=ctx.bossMission&&typeof ctx.bossMission==='object'?ctx.bossMission:
      ctx.worldBoss&&typeof ctx.worldBoss==='object'?ctx.worldBoss:null;
    if(raw){
      const mtype=String(raw.mtype||raw.type||ctx.bossMtype||'');
      const bossId=String(raw.boss_id||raw.id||raw.target||ctx.bossTarget||ctx.bossId||'');
      if((mtype&&BOSS_SET.has(mtype))||bossId){
        return{
          boss_id:bossId,
          mtype:mtype&&BOSS_SET.has(mtype)?mtype:'',
          map:String(raw.map||ctx.map||''),
          instance:String(raw.instance||raw.in||ctx.instance||''),
          x:finite(raw.x),y:finite(raw.y)
        };
      }
    }
    if(ctx.worldBoss===true&&(ctx.bossTarget||ctx.bossId||ctx.bossMtype)){
      const mtype=String(ctx.bossMtype||'');
      return{
        boss_id:String(ctx.bossTarget||ctx.bossId||''),
        mtype:mtype&&BOSS_SET.has(mtype)?mtype:'',
        map:String(ctx.map||''),instance:String(ctx.instance||''),
        x:finite(ctx.bossX),y:finite(ctx.bossY)
      };
    }
    return null;
  }

  function serverHalloweenMission(ctx={}){
    if(roleName!=='MAGE')return null;
    const table=
      ctx.serverStatus&&typeof ctx.serverStatus==='object'?ctx.serverStatus:
      ctx.server&&ctx.server.status&&typeof ctx.server.status==='object'?ctx.server.status:
      ctx.parentS&&typeof ctx.parentS==='object'?ctx.parentS:
      root&&root.server&&root.server.status&&typeof root.server.status==='object'?root.server.status:
      root&&root.parent&&root.parent.S&&typeof root.parent.S==='object'?root.parent.S:
      root&&root.S&&typeof root.S==='object'?root.S:null;

    for(const mtype of ['mrgreen','mrpumpkin']){
      const row=table&&table[mtype];
      if(!row||typeof row!=='object')continue;
      if(row.live!==true||row.active===false||row.dead===true||row.ended===true)continue;
      const x=finite(row.real_x!==undefined?row.real_x:row.x);
      const y=finite(row.real_y!==undefined?row.real_y:row.y);
      return{
        boss_id:String(row.id||''),
        mtype,
        map:String(row.map||(mtype==='mrgreen'?'spookytown':'halloween')),
        instance:String(row.in||row.instance||''),
        x,y,
        rally_mode:mtype==='mrgreen'?'MAGE_MAGIPORT':'LOCAL_NO_FORCED_MAGIPORT'
      };
    }
    return null;
  }

  function visibleMission(ctx={}){
    const entities=ctx.entities&&typeof ctx.entities==='object'?ctx.entities:{};
    const rows=[];
    for(const [id,row] of Object.entries(entities)){
      if(!activeMonster(row))continue;
      const identity=bossIdentity(row,id);
      if(!identity)continue;
      const at=ctx.position||ctx.characterPosition||root?.character||{};
      if(!identity.map)identity.map=String(ctx.map||at.map||'');
      if(!Number.isFinite(identity.distance)&&
         identity.map===String(at.map||'')&&
         [identity.x,identity.y,Number(at.real_x??at.x),Number(at.real_y??at.y)].every(Number.isFinite))
        identity.distance=Math.hypot(identity.x-Number(at.real_x??at.x),
          identity.y-Number(at.real_y??at.y));
      if(identity.distance>radius)continue;
      rows.push(identity);
    }
    rows.sort((a,b)=>a.distance-b.distance||String(a.boss_id).localeCompare(String(b.boss_id)));
    return rows[0]||null;
  }

  function observe(ctx={}){
    const serverHalloween=serverHalloweenMission(ctx);
    if(serverHalloween){
      lastLocalObservation=clone(serverHalloween);
      const type=String(serverHalloween.mtype||'').toUpperCase();
      return publish(serverHalloween,{
        source:'SERVER_EVENT_'+type,
        reason:'EVENT_BOSS_SERVER_NOTIFICATION'
      });
    }

    const explicit=explicitMission(ctx);
    if(explicit){
      lastLocalObservation=clone(explicit);
      return publish(explicit,{source:'EXPLICIT_BOSS_MISSION',reason:'EXPLICIT_BOSS'});
    }
    const visible=visibleMission(ctx);
    if(visible){
      lastLocalObservation=clone(visible);
      return publish(visible,{source:'VISIBLE_BOSS_200',reason:'BOSS_WITHIN_200'});
    }
    return{ok:true,mission:current(),published:false};
  }

  function shouldActivate(ctx={}){
    const observed=observe(ctx);
    const mission=observed&&observed.mission&&validMission(observed.mission)?observed.mission:current();
    return{
      active:!!mission,
      mission:clone(mission),
      source:mission?String(mission.source||'SHARED_BUS'):null,
      lease_ms:mission?Math.max(0,Number(mission.lease_until)-Number(now())):0
    };
  }

  function status(){
    const mission=current();
    return{
      schema:BUS_SCHEMA,
      key:BUS_KEY,
      character,
      role:roleName,
      active:!!mission,
      mission:clone(mission),
      last_local_observation:clone(lastLocalObservation),
      ttl_ms:leaseMs,
      activation_radius:radius,
      transport:transport?'SHARED_FRAME_PLUS_ADAPTER':'SHARED_FRAME'
    };
  }

  async function health(){return{ok:true,...status()};}

  return{observe,shouldActivate,current,publish,complete,markWarriorStarted,status,health};
}

module.exports={
  BUS_KEY,
  BUS_SCHEMA,
  DEFAULT_TTL_MS,
  DEFAULT_ACTIVATION_RADIUS,
  createBossMissionCoordinator
};

},{"./ScanBossState":"organs/bosses/ScanBossState.js"}],
"organs/bosses/BossPolicy.js":[function(require,module,exports){
'use strict';

const OFFICIAL_SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  commit:'ddcf7222c3264f1404382e1ff5dea8e73f6cb4b4',
  monsters:'design/monsters.js',
  maps:'design/maps.js'
});

const SKELETOR=Object.freeze({
  mtype:'skeletor',
  displayName:'Skeletor',
  map:'arena',
  namedDestination:'skeletor',
  pvpMap:true,
  hp:80000,
  attack:1800,
  damageType:'physical',
  respawnMs:16*60*1000,
  spawnCenter:Object.freeze({x:380,y:-672}),
  firstRoutePolicy:'SMART_MOVE_NAMED_ONCE_THEN_LEARNED_ROUTE',
  postPvpPolicy:'RESUME_EXISTING_BOSS_IF_STILL_PRESENT'
});

function bossDefinition(mtype){
  return String(mtype||'')===SKELETOR.mtype?SKELETOR:null;
}
function travelIntent({mtype,hasNamedTeachingProof=false}={}){
  const boss=bossDefinition(mtype);
  if(!boss)return{ok:false,error:'BOSS_UNKNOWN'};
  if(!hasNamedTeachingProof){
    return{ok:true,kind:'SMART_MOVE_NAMED',target:boss.namedDestination,recordMovement:true,oneTime:true};
  }
  return{ok:true,kind:'LEARNED_ROUTE',target:{map:boss.map,...boss.spawnCenter},recordMovement:true};
}
function objectivePriority({pvpDefenseActive=false,bossVisible=false,bossAlive=false}={}){
  if(pvpDefenseActive)return{state:'PVP_DEFENSE',preempts:'BOSS'};
  if(bossVisible&&bossAlive)return{state:'BOSS_PVE',mtype:SKELETOR.mtype};
  return{state:'NORMAL_PVE'};
}

module.exports={OFFICIAL_SOURCE,SKELETOR,bossDefinition,travelIntent,objectivePriority};

},{}],
"organs/bosses/HalloweenSummonPolicy.js":[function(require,module,exports){
'use strict';
// Shared Halloween summon policy. Pure decisions: no movement ownership.
const WAVES=Object.freeze({mrpumpkin:Object.freeze({add:'jr',thresholds:[.75,.50,.25],count:5}),mrgreen:Object.freeze({add:'greenjr',thresholds:[.75,.50,.25],count:5})});
function decide({boss=null,entities=[],role='',warriorPresent=false,healerPresent=false,characterHpRatio=1,partyMinHpRatio=1}={}){
 const type=String(boss&&boss.mtype||'').toLowerCase();
 const wave=WAVES[type];
 if(!wave||!boss||boss.dead||boss.rip)return {active:false,reason:'NO_HALLOWEEN_BOSS'};
 const matching=(Array.isArray(entities)?entities:Object.values(entities||{})).filter(m=>m&&m.type==='monster'&&!m.dead&&!m.rip&&m.visible!==false&&String(m.mtype||'').toLowerCase()===wave.add);
 matching.sort((a,b)=>Number(a.hp||0)-Number(b.hp||0));
 const hp=Number(boss.hp||0),max=Number(boss.max_hp||0),ratio=max>0?hp/max:null;
 const next=ratio===null?null:wave.thresholds.find(t=>ratio>t)||null;
 const roleName=String(role).toLowerCase();
 if(roleName==='priest')return {active:true,phase:matching.length?'ADD_HEAL_LOCK':'BOSS_HEAL',healingPriority:true,attackAllowed:matching.length===0&&partyMinHpRatio>=.85,addType:wave.add,adds:matching.length,nextThreshold:next};
 if(!['warrior','mage'].includes(roleName))return {active:true,phase:'NO_COMBAT_OWNER',attackAllowed:false,addType:wave.add};
 if(!warriorPresent||!healerPresent||characterHpRatio<.45||partyMinHpRatio<.55)return {active:true,phase:'SAFETY_HOLD',attackAllowed:false,reason:'PARTY_SAFETY',addType:wave.add};
 return {active:true,phase:matching.length?'CLEAR_ADDS':'FIGHT_BOSS',attackAllowed:true,focusId:matching.length?matching[0].id||null:boss.id||null,focusType:matching.length?wave.add:type,addType:wave.add,adds:matching.length,nextThreshold:next};
}
module.exports={WAVES,decide};

},{}],
"organs/bosses/MerchantBossScout.js":[function(require,module,exports){
'use strict';
// Rentaro's detection-only role: publish observed bosses to the shared
// in-tab mission bus. Merchant keeps independent circuit/bank/stand ownership;
// Harutora remains the sole Mage rally/party summons owner.
const {createBossMissionCoordinator}=require('./BossMissionCoordinator');
function createMerchantBossScout({root,character='Rentaro',fighter=null,now=Date.now}={}){
  const missions=createBossMissionCoordinator({
    root,characterName:character,role:'MERCHANT',now,
    ttlMs:60000,activationRadius:200
  });
  const state={observations:0,last:null};
  function observe(ctx={}){
    const here=root?.character||{};
    const entities=ctx.entities||fighter?.entitiesSnapshot?.()||
      root?.parent?.entities||root?.entities||{};
    const pos=ctx.position||{map:here.map,x:here.real_x??here.x,
      y:here.real_y??here.y,instance:here.in??here.instance??''};
    const out=missions.observe({...ctx,entities,position:pos,map:pos.map});
    state.observations++;
    state.last=out?.mission?{
      sequence:out.mission.sequence,mtype:out.mission.mtype,
      boss_id:out.mission.boss_id,map:out.mission.map,
      x:out.mission.x,y:out.mission.y,source:out.mission.source
    }:null;
    return out;
  }
  return{observe,missions,status:()=>({...state,mission:missions.status()})};
}
module.exports={createMerchantBossScout};

},{"./BossMissionCoordinator":"organs/bosses/BossMissionCoordinator.js"}],
"organs/bosses/ScanBossState.js":[function(require,module,exports){
'use strict';

const OFFICIAL_SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  commit:'90052162eb3ebda36c893e1eb4af643913c8f984',
  runner:'js/runner_functions.js',
  monsters:'design/monsters.js'
});

const {decide:decideHalloweenSummons}=require('./HalloweenSummonPolicy');

const BOSS_MTYPES=Object.freeze([
  'phoenix','mvampire','jr','greenjr','goldenbat','franky','pinkgoblin',
  'snowman','wabbit','slenderman','mrgreen','mrpumpkin','cutebee','fvampire',
  'grinch','dragold','tiger','pinkgoo','icegolem','skeletor'
]);
const EVENT_BOSS_MTYPES=Object.freeze([
  'goldenbat','franky','pinkgoblin','snowman','wabbit','slenderman',
  'mrgreen','mrpumpkin','cutebee','grinch','dragold','tiger','pinkgoo','icegolem'
]);
const BOSS_SET=new Set(BOSS_MTYPES);
const EVENT_BOSS_SET=new Set(EVENT_BOSS_MTYPES);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function createScanBossState({characterName='',role='',now=Date.now,visibleTtlMs=45000,serverTtlMs=12000}={}){
  const name=String(characterName||'');
  const classRole=String(role||'').toLowerCase();
  const primaryScout=name==='Rentaro'||classRole==='merchant';
  const state={
    version:3,
    state:'SCAN_BOSS',
    runtimeConnected:false,
    character:name,
    role:String(role||''),
    primaryScout,
    priority:primaryScout?'PRIMARY':'SECONDARY',
    movementIndependent:true,
    actionOwner:false,
    detections:{},
    scans:0,
    lastScanAt:null,
    lastDetectionAt:null,
    lastError:null
  };

  const snapshot=()=>clone(state);
  const isBoss=mtype=>BOSS_SET.has(String(mtype||''));
  function activeStatus(row){
    if(!row||typeof row!=='object')return false;
    if(row.active===false||row.live===false||row.dead===true||row.ended===true)return false;
    return true;
  }
  function record(row){
    if(!row||!row.key)return;
    const at=Number(now());
    state.detections[row.key]=Object.assign({},state.detections[row.key]||{},clone(row),{lastSeenAt:at});
    state.lastDetectionAt=at;
  }
  function prune(){
    const at=Number(now());
    for(const key of Object.keys(state.detections)){
      const row=state.detections[key];
      const ttl=row&&row.source==='SERVER_STATUS'?Number(serverTtlMs):Number(visibleTtlMs);
      if(!row||at-Number(row.lastSeenAt||0)>ttl)delete state.detections[key];
    }
  }
  function observe({entities={},serverStatus={},map='',instance='',moving=false,smartMoving=false}={}){
    try{
      state.scans++;
      state.lastScanAt=Number(now());
      state.lastError=null;
      state.moving=!!moving;
      state.smartMoving=!!smartMoving;

      for(const id of Object.keys(entities||{})){
        const mob=entities[id];
        if(!mob||mob.type!=='monster'||mob.dead||mob.rip||mob.visible===false)continue;
        const mtype=String(mob.mtype||'');
        if(!isBoss(mtype))continue;
        record({
          key:'entity:'+String(mob.id||id),source:'VISIBLE_ENTITY',id:String(mob.id||id),mtype,
          map:String(map||mob.map||''),instance:String(instance||mob.in||''),
          x:Number(mob.real_x!==undefined?mob.real_x:mob.x||0),
          y:Number(mob.real_y!==undefined?mob.real_y:mob.y||0),
          hp:Number(mob.hp||0),maxHp:Number(mob.max_hp||0),
          target:mob.target==null?null:String(mob.target)
        });
      }

      for(const key of Object.keys(serverStatus||{})){
        const row=serverStatus[key];
        const mtype=isBoss(key)?String(key):String(row&&row.mtype||row&&row.type||'');
        if(!isBoss(mtype)||!activeStatus(row))continue;
        record({
          key:'server:'+mtype,source:'SERVER_STATUS',mtype,
          id:row&&row.id!=null?String(row.id):null,
          map:String(row&&row.map||''),
          x:Number(row&&row.x||0),y:Number(row&&row.y||0)
        });
      }
      prune();
      return{ok:true,status:snapshot()};
    }catch(error){
      state.lastError=String(error&&error.message||error);
      return{ok:false,error:state.lastError,status:snapshot()};
    }
  }
  function sideValue(){
    prune();
    return{
      phase:'SCANNING',
      primaryScout:state.primaryScout,
      priority:state.priority,
      movementIndependent:true,
      moving:!!state.moving,
      smartMoving:!!state.smartMoving,
      detections:Object.values(state.detections).map(clone),
      lastScanAt:state.lastScanAt,
      lastDetectionAt:state.lastDetectionAt,
      lastError:state.lastError
    };
  }
  function syncStateEngine(engine,{reason='BOSS_SCAN_OBSERVATION'}={}){
    if(!engine||typeof engine.setSide!=='function')return{ok:false,error:'STATE_ENGINE_REQUIRED'};
    return engine.setSide('SCAN_BOSS',sideValue(),{owner:'SCAN_BOSS',reason});
  }

  // V3 combat state may query this side-effect-free decision; SCAN_BOSS never attacks or moves.
  const halloweenDecision=(input={})=>decideHalloweenSummons(input);
  return{observe,sideValue,syncStateEngine,getStatus:snapshot,isBossMtype:isBoss,halloweenDecision};
}

module.exports={OFFICIAL_SOURCE,BOSS_MTYPES,EVENT_BOSS_MTYPES,createScanBossState};

},{"./HalloweenSummonPolicy":"organs/bosses/HalloweenSummonPolicy.js"}],
"organs/bosses/WorldBossState.js":[function(require,module,exports){
'use strict';

const {STATES}=require('../../states/StateRegistry');
const {EVENT_BOSS_MTYPES}=require('./ScanBossState');
const {planMagiport}=require('../../characters/mage/Spells');
const {planPartyTaunt}=require('../../characters/warrior/Spells');
const {decide:decideHalloweenSummons}=require('./HalloweenSummonPolicy');

const EVENT_BOSS_SET=new Set(EVENT_BOSS_MTYPES.map(String));

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function finite(value,fallback=null){const n=Number(value);return Number.isFinite(n)?n:fallback;}

function createWorldBossState({
  character='',
  role='',
  missions,
  targeting,
  combat,
  movement=null,
  fighter=null,
  gear=null,
  warriorV2Runtime=null,
  casterActions=null,
  stand=null,
  root=null,
  merchantRoutes=null,
  partyCoordination=null,
  priestCombat=null,
  config={}
}={}){
  if(!missions||typeof missions.shouldActivate!=='function')throw new Error('WORLD_BOSS_MISSIONS_REQUIRED');
  if(!targeting||typeof targeting.observe!=='function'||typeof targeting.acquire!=='function')throw new Error('WORLD_BOSS_TARGETING_REQUIRED');
  if(!combat||typeof combat.acquire!=='function'||typeof combat.attack!=='function')throw new Error('WORLD_BOSS_COMBAT_REQUIRED');

  const priority=Number(STATES.WORLD_BOSS.priority);
  const roleName=String(role||'').toUpperCase();
  const allowDirectApproach=config.allowDirectApproach===true;
  const state={
    version:1,
    state:'WORLD_BOSS',
    character:String(character||''),
    phase:'IDLE',
    active:false,
    target_id:null,
    mtype:null,
    mission_sequence:null,
    last_progress:null,
    last_error:null,
    event_boss_started_id:null,
    event_boss_started_sequence:null,
    event_boss_started_at:null,
    last_seen_at:null,
    last_seen_boss_id:null,
    last_route_sequence:null
  };

  function snapshot(){return clone(state);}
  function releaseOwners(){
    try{targeting.release('WORLD_BOSS');}catch(error){}
    try{combat.release('WORLD_BOSS');}catch(error){}
    try{if(movement&&typeof movement.release==='function')movement.release('WORLD_BOSS');}catch(error){}
  }
  async function start(){state.active=true;state.phase='LOCKED';state.last_error=null;return{ok:true,status:snapshot()};}
  async function pause(){releaseOwners();state.phase='PAUSED';return{ok:true,status:snapshot()};}
  async function resume(){state.active=true;state.phase='LOCKED';return{ok:true,status:snapshot()};}
  async function stop(){releaseOwners();state.active=false;state.phase='IDLE';state.target_id=null;state.event_boss_started_id=null;state.event_boss_started_sequence=null;state.event_boss_started_at=null;return{ok:true,status:snapshot()};}
  async function health(){return{ok:true,status:snapshot(),mission:missions.status?missions.status():null};}
  async function restore(saved){
    if(!saved||typeof saved!=='object')return{ok:false,error:'WORLD_BOSS_SNAPSHOT_REQUIRED'};
    Object.assign(state,clone(saved),{state:'WORLD_BOSS',character:String(character||state.character||'')});
    return{ok:true,status:snapshot()};
  }

  function partyRows(ctx={}){
    if(fighter&&typeof fighter.partySnapshot==='function'){
      try{return fighter.partySnapshot()||{};}catch(error){}
    }
    return ctx.party&&typeof ctx.party==='object'?ctx.party:{};
  }

  function targetPlace(mission,target){
    const entity=target&&target.entity||{};
    return{
      map:String(entity.map||mission&&mission.map||''),
      instance:String(entity.in||entity.instance||mission&&mission.instance||'')
    };
  }

  function memberAtBoss(member,mission,target){
    if(!member||member.dead===true||member.rip===true||member.online===false)return false;
    const place=targetPlace(mission,target);
    if(place.map&&String(member.map||'')!==place.map)return false;
    if(place.instance&&String(member.instance||'')!==place.instance)return false;
    // Matching maps is not a boss rally. Native party snapshots contain
    // visible character coordinates: demand proximity to the exact boss.
    const entity=target?.entity||{};
    const bx=finite(entity.real_x??entity.x,finite(mission?.x));
    const by=finite(entity.real_y??entity.y,finite(mission?.y));
    const mx=finite(member.x),my=finite(member.y);
    if(bx!==null&&by!==null){
      if(mx===null||my===null)return false;
      if(Math.hypot(mx-bx,my-by)>190)return false;
    }
    return true;
  }

  function warriorPresent(ctx,mission,target){
    if(roleName==='WARRIOR')return true;
    const rows=partyRows(ctx);
    return memberAtBoss(rows.Hibari,mission,target);
  }

  function warriorStarted(ctx,mission,target){
    if(!warriorPresent(ctx,mission,target))return false;
    const targetId=String(target&&target.id||'');
    const sequence=mission&&mission.sequence||null;

    // Shared mission authority written by Hibari after a successful attack.
    if(
      targetId &&
      String(mission&&mission.warrior_started_boss_id||'')===targetId
    ){
      state.event_boss_started_id=targetId;
      state.event_boss_started_sequence=sequence;
      state.event_boss_started_at=Number(mission.warrior_started_at||Date.now());
      return true;
    }

    if(
      targetId &&
      state.event_boss_started_id===targetId &&
      state.event_boss_started_sequence===sequence
    )return true;

    const entity=target&&target.entity||{};
    const rows=partyRows(ctx);
    const hibari=rows.Hibari||{};
    const started=!!(
      String(entity.target||'')==='Hibari' ||
      (targetId&&String(hibari.target||'')===targetId)
    );

    if(started&&targetId){
      state.event_boss_started_id=targetId;
      state.event_boss_started_sequence=sequence;
      state.event_boss_started_at=Date.now();
    }
    return started;
  }

  function externalAggroSafe(entity,ctx){
    // A confirmed outsider already holds aggro; join without waiting for
    // Hibari's first hit. He retains protected-party rescue Taunt authority.
    const name=String(entity&&entity.target||ctx&&ctx.bossAggroTarget||'');
    return !!name&&!['Harutora','Souji','Hibari','Rentaro'].includes(name);
  }

  function isEventBoss(mission,target){
    const mtype=String(
      mission&&mission.mtype ||
      target&&target.entity&&target.entity.mtype ||
      ''
    );
    return String(mission&&mission.boss_class||'')==='EVENT_BOSS'||EVENT_BOSS_SET.has(mtype);
  }

  function livePartyRows(ctx={}){
    return partyRows(ctx)||{};
  }
  async function priestHealFirst(ctx={}){
    // First-on Souji healer owns ALL combat-state healing, even during bosses.
    // If hurt members remain, the 5s heal hold overrides offensive spells.
    const healer=root?.__POGI_V3_PRIEST_HEAL_OWNER;
    if(roleName==='PRIEST'&&healer){
      const result=await healer.tick?.();
      if(healer.holdForHealing?.()===true)return{
        ok:true,progress:result?.requested===true,
        kind:'BOSS_PRIEST_HEAL_FIRST_HOLD',
        reason:result?.skill||result?.error||'HEAL_PRIORITY_5S'
      };
      return null;
    }
    if(roleName!=='PRIEST'||!priestCombat||typeof priestCombat.plan!=='function'||
       !fighter||typeof fighter.use!=='function')return null;
    const rows=livePartyRows(ctx);
    if(partyCoordination&&typeof partyCoordination.update==='function')
      for(const [name,row] of Object.entries(rows))
        if(row&&typeof row==='object')partyCoordination.update(name,row);
    const planned=priestCombat.plan(ctx);
    const action=planned?.action;
    if(action?.kind!=='USE_SKILL'||!['heal','partyheal'].includes(action.skill))
      return null; // Full party HP is checked by existing Souji policy.
    const out=await fighter.use(action.skill,
      action.skill==='heal'?action.target:undefined);
    if(!out?.ok)return{ok:false,error:out?.error||'BOSS_HEAL_REJECTED',
      skill:action.skill,priority:'HEAL_FIRST'};
    state.last_progress='PRIEST_'+action.skill.toUpperCase();
    return{ok:true,progress:true,kind:'BOSS_'+action.skill.toUpperCase(),
      skill:action.skill,reason:planned.reason,priority:'HEAL_FIRST'};
  }
  function healerAtBoss(ctx,mission,target){
    if(roleName==='PRIEST')return true;
    const rows=partyRows(ctx),healer=rows.Souji;
    const actor=fighter?.snapshot?.()||root?.character||{};
    const actorMap=String(root?.character?.map||actor.map||mission.map||'');
    if(!healer||healer.online!==true||healer.visible===false||
       healer.dead===true||healer.rip===true||!healer.map||
       healer.map!==actorMap)return false;
    const coord=root?.character||actor;
    const px=Number(coord.real_x??coord.x),py=Number(coord.real_y??coord.y);
    const hx=Number(healer.x),hy=Number(healer.y);
    if([px,py,hx,hy].every(Number.isFinite)&&Math.hypot(px-hx,py-hy)>190)
      return false;
    return true;
  }

  async function mageRally(ctx,mission,target){
    if(roleName!=='MAGE'||!fighter||typeof fighter.partySnapshot!=='function'||typeof fighter.use!=='function')return null;

    // Mr. Pumpkin's official server event is already local to our Halloween
    // farm. Keep the Event Boss mission/locks durable, but don't force a
    // Magiport rally. Mr. Green and normal remote boss missions retain rally.
    if(String(mission&&mission.rally_mode||'')==='LOCAL_NO_FORCED_MAGIPORT'){
      return null;
    }
    const rows=partyRows(ctx);
    for(const name of ['Souji','Hibari']){
      if(memberAtBoss(rows[name],mission,target))continue;
      if(rows[name]?.dead===true||rows[name]?.rip===true)continue;
      const active=root?.get_active_characters?.()||{};
      if(rows[name]?.online!==true&&!['active','code','self'].includes(active[name]))continue;

      const snap=typeof fighter.snapshot==='function'?fighter.snapshot():{};
      const cooldownReady=typeof fighter.ready==='function'?fighter.ready('magiport')!==false:true;
      const planned=planMagiport({
        target:name,
        mp:Number(snap&&snap.mp||0),
        cooldownReady,
        level:Number.isFinite(Number(snap&&snap.level))?Number(snap.level):Infinity,
        authorizedByRoute:true,
        consentExpected:true
      });
      if(!planned.eligible){
        return{
          ok:true,progress:false,
          reason:'BOSS_RALLY_'+name.toUpperCase()+'_'+String(planned.reason||'WAIT'),
          target:name
        };
      }

      const used=await fighter.use('magiport',name);
      if(!used||used.ok!==true){
        return{ok:false,error:used&&used.error||'BOSS_MAGIPORT_FAILED',target:name};
      }
      state.last_progress='MAGIPORT_'+name.toUpperCase();
      return{
        ok:true,progress:true,
        kind:isEventBoss(mission,target)?'EVENT_BOSS_MAGIPORT':'REGULAR_BOSS_MAGIPORT',
        target:name,
        boss:mission&&mission.mtype||null
      };
    }
    return null;
  }

  async function warriorRescueTaunt(ctx,mission,target){
    if(roleName!=='WARRIOR'||!fighter||typeof fighter.use!=='function')return null;
    // The V2 native Warrior service is the one Taunt owner, including
    // protected-party rescue and on-sight named mini bosses.
    if(warriorV2Runtime?.status?.()?.running===true)return null;
    const entity=target&&target.entity||{};
    const victim=String(entity.target||'');
    if(!['Harutora','Souji'].includes(victim))return null;

    const snap=typeof fighter.snapshot==='function'?fighter.snapshot(target.id):{};
    const distance=Number(snap&&snap.target&&snap.target.distance);
    const taunt=planPartyTaunt({
      target:target.id,
      mp:Number(snap&&snap.mp||0),
      cooldownReady:snap&&snap.tauntCooldownReady!==false,
      inRange:Number.isFinite(distance)?distance<=200:ctx.tauntInRange===true,
      partyEngaged:true,
      warriorHasAggro:false,
      targetIsMonster:true,
      targetingPartyMember:true,
      targetingPartyMemberName:victim,
      targetingForeignPlayer:false,
      claimHandoffAuthorized:false,
      targetIsBoss:true
    });
    if(!taunt.eligible)return null;

    const used=await fighter.use('taunt',target.id);
    if(!used||used.ok!==true)return{ok:false,error:used&&used.error||'BOSS_TAUNT_FAILED',target:target.id};
    state.last_progress='PROTECTED_PARTY_TAUNT';
    return{
      ok:true,progress:true,
      kind:isEventBoss(mission,target)?'EVENT_BOSS_PROTECTED_PARTY_TAUNT':'REGULAR_BOSS_PROTECTED_PARTY_TAUNT',
      target:target.id,
      victim
    };
  }

  function matchTarget(entities,mission){
    const rows=entities&&typeof entities==='object'?entities:{};
    const exact=String(mission&&mission.boss_id||'');
    const mtype=String(mission&&mission.mtype||'');
    const living=row=>row&&row.type==='monster'&&row.dead!==true&&row.rip!==true&&row.visible!==false&&(row.hp==null||Number(row.hp)>0);
    if(exact&&living(rows[exact]))return{id:exact,entity:rows[exact]};
    for(const [id,row] of Object.entries(rows)){
      if(!living(row))continue;
      if(mtype&&String(row.mtype||'')===mtype)return{id:String(id),entity:row};
    }
    return null;
  }

  async function approach(mission,target){
    if(!movement||typeof movement.move!=='function')return null;
    const entity=target?.entity||{};
    const map=String(entity.map||mission?.map||'');
    const x=finite(entity.real_x??entity.x,finite(mission?.x));
    const y=finite(entity.real_y??entity.y,finite(mission?.y));
    if(!map||!Number.isFinite(x)||!Number.isFinite(y))return null;
    const c=root?.character||{},cx=finite(c.real_x??c.x),cy=finite(c.real_y??c.y);
    const hereMap=String(c.map||'');
    const offset=hereMap===map&&cx!=null&&cy!=null?Math.hypot(x-cx,y-cy):Infinity;
    // Every fighter can use the existing saved route if Magiport is unavailable.
    // Combat admission still requires nearby teammates; route transit does not.
    if(['MAGE','PRIEST','WARRIOR'].includes(roleName)&&merchantRoutes?.followBossRoute){
      if(!Number.isFinite(offset)||offset>175){
        const destination={map,x,y};
        const plan=merchantRoutes.planBossRoute?.(destination);
        if(!plan?.ok)return{ok:true,progress:false,
          reason:plan?.error||'BOSS_ROUTE_NOT_SAVED'};
        if(plan.legs.length){
          if(roleName==='MAGE'&&casterActions)await casterActions.travelGear();
          const walked=await merchantRoutes.followBossRoute(destination);
          if(!walked?.ok)return{ok:false,
            error:walked?.error||'MERCHANT_BOSS_PATH_FAILED'};
          state.last_route_sequence=mission?.sequence||null;
          state.last_progress='MERCHANT_BOSS_ROUTE_ARRIVED';
          return{ok:true,progress:true,kind:'MAGE_MERCHANT_BOSS_ROUTE',
            portalCount:walked.portalCount,townCount:walked.townCount};
        }
      }
    }
    // Native short approach at the boss only; Mage remains at spell range.
    // Graph route owns cross-map travel, collision checks own final local legs.
    if(target&&hereMap===map&&cx!=null&&cy!=null&&
       offset>(roleName==='MAGE'?155:45)&&offset<=200&&
       typeof root?.can_move_to==='function'){
      if(roleName!=='PRIEST'&&!healerAtBoss({},mission,target))return null;
      const advance=Math.min(30,offset-(roleName==='MAGE'?155:45));
      const next={x:cx+(x-cx)*(advance/offset),y:cy+(y-cy)*(advance/offset)};
      let clear=false;
      try{clear=root.can_move_to(next.x,next.y)===true;}catch(_){}
      if(!clear)return{ok:true,progress:false,reason:'BOSS_FINAL_APPROACH_COLLISION'};
      const own=movement.acquire('WORLD_BOSS',{priority});
      if(!own?.ok)return{ok:true,progress:false,reason:'BOSS_FINAL_APPROACH_BUSY'};
      try{
        const moved=await movement.move('WORLD_BOSS',{x:next.x,y:next.y});
        if(!moved?.ok)return{ok:false,error:'BOSS_FINAL_NATIVE_MOVE_FAILED'};
        state.phase='APPROACH';state.last_progress='BOSS_FINAL_NATIVE_MOVE';
        return{ok:true,progress:true,kind:'BOSS_FINAL_NATIVE_MOVE'};
      }finally{movement.release('WORLD_BOSS');}
    }
    return null; // Never fall back to smart_move.
  }

  async function merchantHalloweenStand(ctx,mission){
    if(roleName!=='MERCHANT'||!['mrpumpkin','mrgreen'].includes(String(mission&&mission.mtype||'')))return null;
    const desired={map:'main',x:-300,y:-100};
    const pos=ctx.position||ctx.characterPosition||(fighter&&typeof fighter.snapshot==='function'?fighter.snapshot():null)||{};
    const map=String(pos.map||ctx.map||'');
    const x=finite(pos.x,finite(ctx.x)),y=finite(pos.y,finite(ctx.y));
    const arrived=map===desired.map&&x!=null&&y!=null&&Math.hypot(x-desired.x,y-desired.y)<=35;
    if(!arrived){
      if(!map||x==null||y==null)return{ok:true,progress:false,reason:'MERCHANT_EVENT_STAND_AWAIT_POSITION'};
      if(stand&&typeof stand.stop==='function')await stand.stop();
      if(!movement||typeof movement.acquire!=='function'||typeof movement.smartMove!=='function')
        return{ok:false,error:'MERCHANT_EVENT_STAND_MOVEMENT_UNAVAILABLE'};
      const own=movement.acquire('WORLD_BOSS',{priority});
      if(!own||own.ok===false)return{ok:true,progress:false,reason:'MERCHANT_EVENT_STAND_MOVEMENT_PREEMPTED'};
      if(ctx.moving===true)return{ok:true,progress:false,reason:'MERCHANT_EVENT_STAND_TRAVEL_IN_PROGRESS'};
      const moved=await movement.smartMove('WORLD_BOSS',desired);
      if(!moved||moved.ok===false)return{ok:false,error:moved&&moved.error||'MERCHANT_EVENT_STAND_TRAVEL_FAILED'};
      state.phase='MERCHANT_STAND_TRAVEL';state.last_progress='MERCHANT_STAND_TRAVEL';
      return{ok:true,progress:true,kind:'MERCHANT_EVENT_STAND_TRAVEL',boss:mission.mtype,target:desired};
    }
    try{movement&&movement.release&&movement.release('WORLD_BOSS');}catch(e){}
    if(!stand||typeof stand.start!=='function')return{ok:false,error:'MERCHANT_EVENT_STAND_ADAPTER_UNAVAILABLE'};
    const opened=await stand.start();
    if(!opened||opened.ok===false)return{ok:false,error:opened&&opened.error||'MERCHANT_EVENT_STAND_OPEN_FAILED'};
    state.phase='MERCHANT_STAND_HOLD';state.last_progress='MERCHANT_STAND_HELD';
    return{ok:true,progress:true,kind:'MERCHANT_EVENT_STAND_HOLD',boss:mission.mtype,stand_open:true};
  }

  // V2 pumpkin/greenjr spawn focus belongs to the SAME WorldBoss combat
  // owner. Existing HalloweenSummonPolicy chooses the next add. Do not
  // launch any independent Warrior add loop or change the boss mission.
  async function warriorHalloweenAdds(ctx,mission,target){
    if(roleName!=='WARRIOR'||!['mrpumpkin','mrgreen'].includes(String(mission?.mtype||'')))
      return null;
    const party=partyRows(ctx),self=root?.character||{};
    const ownHp=Number(self.hp||0)/Math.max(1,Number(self.max_hp||1));
    const ratios=Object.values(party).filter(p=>p&&Number(p.max_hp)>0)
      .map(p=>Number(p.hp||0)/Number(p.max_hp));
    const low=ratios.length?Math.min(...ratios):1;
    const rows=Object.values(ctx.entities||{}).filter(e=>e&&e.type==='monster'&&
      e.visible!==false&&!e.dead&&!e.rip&&(!e.map||e.map===target.entity?.map||
      e.map===mission?.map));
    const wave=decideHalloweenSummons({boss:target.entity,entities:rows,
      role:'warrior',warriorPresent:true,
      healerPresent:healerAtBoss(ctx,mission,target),
      characterHpRatio:ownHp,partyMinHpRatio:low});
    if(!wave.active||!wave.adds)return null;
    if(!wave.attackAllowed)return{ok:true,progress:false,reason:
      wave.reason||'HALLOWEEN_ADD_PARTY_SAFETY',status:snapshot()};
    const add=rows.find(e=>String(e.id||'')===String(wave.focusId||''));
    if(!add)return null;
    const id=String(add.id);
    if(add.inRange===false||add.attackable===false||
      (typeof fighter?.canAttack==='function'&&fighter.canAttack(id)!==true))
      return{ok:true,progress:false,reason:'HALLOWEEN_ADD_WAIT_IN_RANGE',
        add:id,boss:target.id,status:snapshot()};
    const owned=targeting.acquire('WORLD_BOSS',id,{priority});
    if(!owned?.ok)return{ok:true,progress:false,reason:
      owned?.error||'ADD_TARGET_PREEMPTED',status:snapshot()};
    const combatOwned=combat.acquire('WORLD_BOSS',{priority});
    if(!combatOwned?.ok)return{ok:true,progress:false,reason:
      combatOwned?.error||'ADD_COMBAT_PREEMPTED',status:snapshot()};
    const hit=await combat.attack('WORLD_BOSS',id);
    if(!hit?.ok)return{ok:false,error:hit?.error||'HALLOWEEN_ADD_ATTACK_FAILED',
      status:snapshot()};
    state.phase='CLEAR_HALLOWEEN_ADDS';
    state.last_progress='ADD_'+String(wave.addType||'');
    return{ok:true,progress:true,kind:'WARRIOR_HALLOWEEN_ADD_ATTACK',
      add:id,boss:target.id,mtype:wave.addType,status:snapshot()};
  }

  async function tick(ctx={}){
    const liveEntities=ctx.entities||fighter?.entitiesSnapshot?.()||{};
    const gameStatus=ctx.serverStatus||root?.parent?.S||root?.server?.status||{};
    const gameCtx={...ctx,entities:liveEntities,serverStatus:gameStatus,
      position:ctx.position||{map:root?.character?.map||'',
        x:root?.character?.real_x??root?.character?.x,
        y:root?.character?.real_y??root?.character?.y}};
    const gate=missions.shouldActivate(gameCtx);
    const mission=gate&&gate.mission||null;
    if(!gate||gate.active!==true||!mission){
      if(ctx.worldBoss===true){
        state.active=true;
        state.phase='LOCKED';
        state.target_id=null;
        return{ok:true,progress:false,reason:'WORLD_BOSS_SIGNAL_AWAITING_IDENTITY',status:snapshot()};
      }
      releaseOwners();
      state.phase='RELEASE';
      state.active=false;
      state.target_id=null;
      state.mtype=null;
      state.mission_sequence=null;
      state.event_boss_started_id=null;
      state.event_boss_started_sequence=null;
      state.event_boss_started_at=null;
      return{ok:true,progress:true,kind:'WORLD_BOSS_RELEASE',complete:true,reason:'BOSS_MISSION_EXPIRED',status:snapshot()};
    }

    state.active=true;
    state.phase='LOCKED';
    state.mtype=mission.mtype||null;
    if(
      state.mission_sequence!==null &&
      state.mission_sequence!==undefined &&
      state.mission_sequence!==(mission.sequence||null)
    ){
      state.event_boss_started_id=null;
      state.event_boss_started_sequence=null;
      state.event_boss_started_at=null;
    }
    state.mission_sequence=mission.sequence||null;
    if(roleName==='WARRIOR'&&warriorV2Runtime?.status?.()?.criticalHold===true){releaseOwners();return{ok:true,progress:false,reason:'WARRIOR_CRITICAL_RECOVERY',status:snapshot()};}
    const heal=await priestHealFirst(gameCtx);
    if(heal)return{...heal,status:snapshot()};
    const merchantStand=await merchantHalloweenStand(gameCtx,mission);
    if(merchantStand)return{...merchantStand,status:snapshot()};
    const entities=liveEntities;
    targeting.observe(entities);
    const target=matchTarget(entities,mission);
    if(!target){
      // On the actual boss map, disappearing after a confirmed sighting
      // releases combat back to Farm; no 60-second ghost hunt.
      const raw=mission.boss_id?entities[String(mission.boss_id)]:null;
      const explicitlyDead=!!raw&&(raw.dead===true||raw.rip===true||(raw.hp!=null&&Number(raw.hp)<=0));
      const eventStillLive=['mrgreen','mrpumpkin'].includes(String(mission.mtype||''))&&gameStatus?.[mission.mtype]?.live===true;
      // Explicit native death wins over a lagging server event-live flag.
      // Only use the disappearance grace when death has not been confirmed.
      if(explicitlyDead||(!eventStillLive&&state.last_seen_boss_id===String(mission.boss_id||'')&&state.last_seen_at!=null&&String(root?.character?.map||'')===String(mission.map||'')&&Date.now()-state.last_seen_at>=6000)){
         missions.complete?.(mission.sequence);
        releaseOwners();state.phase='RELEASE';state.active=false;
        state.last_seen_at=null;
        return{ok:true,complete:true,progress:true,
          kind:'WORLD_BOSS_RELEASE',reason:explicitlyDead?'BOSS_DEATH_CONFIRMED':'BOSS_GONE_AFTER_SIGHTING',
          status:snapshot()};
      }
      state.target_id=mission.boss_id||null;
      const moved=await approach(mission,null);
      if(moved)return{...moved,status:snapshot()};
      return{ok:true,progress:false,reason:'WORLD_BOSS_TARGET_NOT_VISIBLE',mission:clone(mission),status:snapshot()};
    }

    state.target_id=target.id;
    state.last_seen_at=Date.now();
    state.last_seen_boss_id=String(mission.boss_id||target.id);
    const entity=target.entity||{};

    const rally=await mageRally(gameCtx,mission,target);
    if(rally)return{...rally,status:snapshot()};

    if((roleName==='MAGE'||roleName==='PRIEST')&&!warriorPresent(ctx,mission,target)){
      return{
        ok:true,progress:false,
        reason:isEventBoss(mission,target)?'EVENT_BOSS_WAIT_WARRIOR_PRESENT':'REGULAR_BOSS_WAIT_WARRIOR_PRESENT',
        target:target.id,status:snapshot()
      };
    }

    if((roleName==='MAGE'||roleName==='PRIEST')&&isEventBoss(mission,target)&&!warriorStarted(ctx,mission,target)&&!externalAggroSafe(entity,ctx)){
      return{
        ok:true,progress:false,
        reason:'EVENT_BOSS_WAIT_WARRIOR_FIRST_HIT',
        target:target.id,status:snapshot()
      };
    }

    // All combat and boss Taunts require nearby living Souji. Harutora may
    // summon first, but no PvE pull begins without the healer.
    if(!healerAtBoss(gameCtx,mission,target)){
      releaseOwners();
      return{ok:true,progress:false,reason:'BOSS_WAIT_NEARBY_SOUJI',
        status:snapshot()};
    }
    const rescueTaunt=await warriorRescueTaunt(gameCtx,mission,target);
    if(rescueTaunt)return{...rescueTaunt,status:snapshot()};
    // Add focus is preemptive only within the pre-existing WORLD_BOSS
    // lease. Other roles continue their own existing priorities.
    const addAttack=await warriorHalloweenAdds(gameCtx,mission,target);
    if(addAttack)return addAttack;

    if(entity.attackable===false){
      return{ok:true,progress:false,reason:'WORLD_BOSS_TARGET_NOT_ATTACKABLE',target:target.id,status:snapshot()};
    }

    if(roleName==='WARRIOR'&&gear&&typeof gear.equipLoadout==='function'){
      const blades=await gear.equipLoadout('WORLD_BOSS',{
        name:'V2_BOSS_FIERY_BLADES',
        mainhand:{name:'fireblade',selection:'HIGHEST_LEVEL'},
        offhand:{name:'fireblade',selection:'HIGHEST_LEVEL',distinct:true}
      });
      if(!blades?.ok||blades.verified!==true)
        return{ok:true,progress:false,reason:'WARRIOR_BOSS_FIREBLADES_NOT_READY',
          gearError:blades?.error||'GEAR_NOT_VERIFIED',status:snapshot()};
    }

    const fighterAttackReady=
      fighter&&typeof fighter.canAttack==='function'
        ?fighter.canAttack(target.id)
        :true;
    const attackReady=
      ctx.attackReady!==false &&
      entity.inRange!==false &&
      fighterAttackReady!==false;
    if(!attackReady){
      const moved=await approach(mission,target);
      if(moved)return{...moved,status:snapshot()};
      return{ok:true,progress:false,reason:'WORLD_BOSS_ATTACK_NOT_READY',target:target.id,status:snapshot()};
    }

    const targetLease=targeting.acquire('WORLD_BOSS',target.id,{priority});
    if(!targetLease||targetLease.ok===false){
      return{ok:true,progress:false,reason:'WORLD_BOSS_TARGET_PREEMPTED',detail:clone(targetLease),status:snapshot()};
    }
    const combatLease=combat.acquire('WORLD_BOSS',{priority});
    if(!combatLease||combatLease.ok===false){
      return{ok:true,progress:false,reason:'WORLD_BOSS_COMBAT_PREEMPTED',detail:clone(combatLease),status:snapshot()};
    }

    if(casterActions){
      await casterActions.upkeep();
      const action=await casterActions.tick({target,isBoss:true,partyReady:true,healingHold:()=>root?.__POGI_V3_PRIEST_HEAL_OWNER?.holdForHealing?.()===true});
      if(action)return{ok:action.ok===true,progress:action.ok===true&&!action.hold,kind:'CASTER_BOSS_ACTION',...action,status:snapshot()};
    }
    const attacked=await combat.attack('WORLD_BOSS',target.id);
    if(!attacked||attacked.ok===false){
      const error=attacked&&attacked.error||'WORLD_BOSS_ATTACK_FAILED';
      if(['TARGET_LEASE_EXPIRED','TARGET_LEASE_MISMATCH','TARGET_NOT_VISIBLE_OR_VALID'].includes(error)){
        return{ok:true,progress:false,reason:error,target:target.id,status:snapshot()};
      }
      state.last_error=error;
      return{ok:false,error,target:target.id,status:snapshot()};
    }

    if(
      roleName==='WARRIOR' &&
      isEventBoss(mission,target) &&
      missions &&
      typeof missions.markWarriorStarted==='function' &&
      (state.event_boss_started_id!==String(target.id||'')||
       state.event_boss_started_sequence!==(mission?.sequence||null))
    ){
      const marked=missions.markWarriorStarted(target.id,mission&&mission.mtype||entity.mtype||'');
      if(marked&&marked.ok===true){
        state.event_boss_started_id=String(target.id||'');
        state.event_boss_started_sequence=mission?.sequence||null;
        state.event_boss_started_at=Date.now();
        // Existing BossMissionCoordinator publishes the authoritative
        // Warrior-started signal on the shared V3 boss bus. Do NOT also
        // broadcast a second native CM message: Mage/Priest already read
        // that mission and two channels could duplicate their actions.
      }
    }

    state.phase='COMBAT';
    state.last_error=null;
    state.last_progress='ATTACK';
    return{
      ok:true,
      progress:true,
      kind:isEventBoss(mission,target)?'EVENT_BOSS_ATTACK':'REGULAR_BOSS_ATTACK',
      target:target.id,
      mtype:state.mtype,
      mission_sequence:state.mission_sequence,
      status:snapshot()
    };
  }

  return{start,pause,resume,stop,health,snapshot,restore,tick,getStatus:snapshot};
}

module.exports={createWorldBossState};

},{"../../states/StateRegistry":"states/StateRegistry.js","./ScanBossState":"organs/bosses/ScanBossState.js","../../characters/mage/Spells":"characters/mage/Spells.js","../../characters/warrior/Spells":"characters/warrior/Spells.js","./HalloweenSummonPolicy":"organs/bosses/HalloweenSummonPolicy.js"}],
"organs/events/EventState.js":[function(require,module,exports){
'use strict';

const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

function activeFrom(handler,status,ctx){
  if(handler&&typeof handler.isActive==='function')return handler.isActive(status,ctx)===true;
  return !!(status&&status.active===true);
}

function createEventState({handlers={},initialEnabled={},now=Date.now}={}){
  const names=Object.keys(handlers);
  const state={
    version:3,
    runtimeConnected:false,
    selected:null,
    unknownActive:[],
    events:{},
    updatedAt:null
  };
  for(const name of names){
    state.events[name]={
      enabled:initialEnabled[name]!==false,
      seenActive:false,
      gameActive:false,
      phase:'INACTIVE',
      retired:false,
      retiredReason:null,
      lastRoundKey:null,
      lastCompletedRoundKey:null,
      lastProof:null,
      lastReason:null
    };
  }
  const touch=()=>{state.updatedAt=Number(now());};
  const snapshot=()=>clone(state);

  function enableEvent(name,{reason='MANUAL_REVIEW_APPROVED'}={}){
    const row=state.events[String(name||'')];
    if(!row)return{ok:false,error:'EVENT_HANDLER_UNKNOWN'};
    row.enabled=true;
    row.retired=false;
    row.retiredReason=null;
    row.lastReason=String(reason);
    touch();
    return{ok:true,event:String(name),enabled:true};
  }

  function disableEvent(name,{reason='MANUAL_DISABLED'}={}){
    const row=state.events[String(name||'')];
    if(!row)return{ok:false,error:'EVENT_HANDLER_UNKNOWN'};
    row.enabled=false;
    row.phase='INACTIVE';
    row.lastReason=String(reason);
    if(state.selected===name)state.selected=null;
    touch();
    return{ok:true,event:String(name),enabled:false};
  }

  function markComplete(name,{roundKey,proof=null}={}){
    const row=state.events[String(name||'')];
    if(!row)return{ok:false,error:'EVENT_HANDLER_UNKNOWN'};
    const key=String(roundKey||'');
    if(!key)return{ok:false,error:'EVENT_ROUND_KEY_REQUIRED'};
    row.lastCompletedRoundKey=key;
    row.lastProof=clone(proof);
    row.phase='COMPLETE';
    row.lastReason='ROUND_COMPLETE';
    touch();
    return{ok:true,event:String(name),roundKey:key};
  }

  function observe(ctx={}){
    const serverStatus=ctx.serverStatus&&typeof ctx.serverStatus==='object'?ctx.serverStatus:{};
    const definitions=ctx.eventDefinitions&&typeof ctx.eventDefinitions==='object'?ctx.eventDefinitions:{};
    const unknown=[];
    for(const name of Object.keys(definitions)){
      if(handlers[name])continue;
      const status=serverStatus[name];
      if(status&&status.active===true)unknown.push({name,status:clone(status)});
    }
    state.unknownActive=unknown;

    const candidates=[];
    for(const name of names){
      const handler=handlers[name];
      const row=state.events[name];
      const status=serverStatus[name];
      const gameActive=activeFrom(handler,status,ctx);
      const wasActive=row.gameActive===true;
      row.gameActive=gameActive;

      if(gameActive)row.seenActive=true;
      if(wasActive&&!gameActive&&handler.autoDisableOnEnd!==false){
        row.enabled=false;
        row.retired=true;
        row.retiredReason='EVENT_ENDED_REVIEW_REQUIRED';
        row.phase='INACTIVE';
        row.lastReason=row.retiredReason;
      }
      if(!row.enabled){
        row.phase='INACTIVE';
        continue;
      }
      if(!gameActive){
        row.phase='INACTIVE';
        row.lastReason='GAME_EVENT_INACTIVE';
        continue;
      }
      if(typeof handler.evaluate!=='function'){
        row.phase='UNSUPPORTED';
        row.lastReason='EVENT_EVALUATOR_MISSING';
        continue;
      }
      const result=handler.evaluate({...ctx,eventStatus:status,eventState:clone(row)})||{};
      row.phase=String(result.phase||'OBSERVING');
      row.lastReason=result.reason==null?null:String(result.reason);
      if(result.roundKey!=null)row.lastRoundKey=String(result.roundKey);
      if(result.preempt===true){
        candidates.push({
          name,
          priority:Number.isFinite(Number(handler.priority))?Number(handler.priority):0,
          result:clone(result)
        });
      }
    }

    candidates.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
    if(candidates.length>1&&candidates[0].priority===candidates[1].priority){
      state.selected=null;
      touch();
      return{
        ok:false,error:'EVENT_PRIORITY_AMBIGUOUS',events:[candidates[0].name,candidates[1].name],
        unknownActive:clone(state.unknownActive),status:snapshot()
      };
    }
    const selected=candidates[0]||null;
    state.selected=selected&&selected.name||null;
    touch();
    return{
      ok:true,
      selected:selected?{name:selected.name,priority:selected.priority,...selected.result}:null,
      unknownActive:clone(state.unknownActive),
      status:snapshot()
    };
  }

  return{observe,enableEvent,disableEvent,markComplete,getStatus:snapshot};
}

module.exports={createEventState};

},{}],
"organs/exchange/ExchangePolicy.js":[function(require,module,exports){
'use strict';

const {APPROVED_EXCHANGE_IDS,isExchangeableMeta}=require('../../core/policy/ExchangeApprovalPolicy');
const JackoRetentionPolicy=require('../gear/JackoRetentionPolicy');

/*
 * V3 Exchange Policy
 * Generated from the user's exported Pogi V3 Exchange Reward Checklist.
 * Source export: pogi-exchange-checklist-selections-v5.json
 *
 * Safety:
 * - This file is policy/planning only. It performs no raw Adventure.Land actions.
 * - Unknown items fail closed to HOLD.
 * - Any item id containing "scroll" is KEEP_MERCHANT regardless of stale list data.
 * - Conflicting user choices fail closed to HOLD until explicitly resolved.
 * - DEPOSIT means hand off to canonical Bank policy; this module never hardcodes a pack.
 */

const POLICY_VERSION='2026.09.30-user-export-v1';

const EXCHANGE_ITEMS=APPROVED_EXCHANGE_IDS;

const REWARD_POLICY=Object.freeze({
  "angelwings": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "armorbox": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "basher": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "basketofeggs": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "bataxe": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "bcape": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "broom": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "brownenvelope": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "bugbountybox": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "bunnyelixir": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "candy0": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "candy1": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "candycane": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "candycanesword": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "cape": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "carrotsword": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "cdragon": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "coat1": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "crossbow": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "cscroll1": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "cscroll3": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "dagger": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "dragondagger": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "ecape": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "eears": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "eggnog": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "epyjamas": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "eslippers": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "fireblade": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "firebow": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "firecrackers": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "firestaff": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "fury": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "gbow": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "gem0": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "glitch": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "gloves1": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "gphelmet": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "greenbomb": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "greenenvelope": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "hammer": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "handofmidas": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "harbringer": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "harmor": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "hboots": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "helmet1": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "hgloves": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "hhelmet": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "horsecapeg": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "hotchocolate": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "hpants": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "jacko": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "lantern": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "leather": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "lmace": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "mearring": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "merry": {"action":"SELL","reason":"USER_SELECTED_SELL"},
  "mistletoe": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "mittens": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "mshield": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "mysterybox": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "northstar": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "offering": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "oozingterror": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "orboftemporal": {
    "action": "COMPOUND",
    "target": 1,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "ornament": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "ornamentstaff": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "oxhelmet": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "pants1": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "phelmet": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "pinkie": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "pmace": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "pumpkinspice": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "rabbitsfoot": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "rapier": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "rednose": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "santasbelt": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "scroll1": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "scroll3": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "scroll4": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "seashell": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "shells": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "shoes1": {
    "action": "UPGRADE",
    "target": 6,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "skullamulet": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "smoke": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "snakeoil": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "snowball": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "snowflakes": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "spear": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "spookyamulet": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "starkillers": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "supermittens": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "swirlipop": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "sword": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "t2bow": {"action":"UPGRADE","target":7,"after":"DEPOSIT","reason":"USER_SELECTED_UPGRADE"},
  "t3bow": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "talkingskull": {
    "action": "COMPOUND",
    "target": 3,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_COMPOUND"
  },
  "throwingstars": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "vblood": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "vitscroll": {
    "action": "KEEP_MERCHANT",
    "reason": "GLOBAL_SCROLL_KEEP"
  },
  "warmscarf": {
    "action": "UPGRADE",
    "target": 7,
    "after": "DEPOSIT",
    "reason": "USER_SELECTED_UPGRADE"
  },
  "warpvest": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "weaponbox": {
    "action": "EXCHANGE",
    "reason": "USER_SELECTED_EXCHANGE"
  },
  "xarmor": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "xboots": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "xgloves": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "xhelmet": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  },
  "xmashat": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "xmaspants": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "xmasshoes": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "xmassweater": {
    "action": "SELL",
    "reason": "USER_SELECTED_SELL"
  },
  "xpants": {
    "action": "DEPOSIT",
    "reason": "USER_SELECTED_DEPOSIT"
  }
});

const META_REWARDS=Object.freeze([
  {"item":"xN","action":"META_ONLY"},
  {"item":"Gold","action":"META_ONLY"},
  {"item":"Basic Elixir pool","action":"META_ONLY"},
  {"item":"Gold","action":"META_ONLY"},
  {"item":"Gold","action":"META_ONLY"},
  {"item":"Armor-X pool","action":"META_ONLY"},
  {"item":"hairdo609","action":"META_ONLY"},
  {"item":"Gold","action":"META_ONLY"},
  {"item":"hat410","action":"META_ONLY"},
  {"item":"Weapon of the Dead pool","action":"META_ONLY"},
  {"item":"Armor-X pool","action":"META_ONLY"},
  {"item":"Gold","action":"META_ONLY"},
  {"item":"Armor-X pool","action":"META_ONLY"}
]);

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function isScrollId(itemId){return /scroll/i.test(String(itemId||''));}
function isExchangeableItem(item,metaResolver=null){
  if(!item||!item.name)return false;
  let meta=item.meta&&typeof item.meta==='object'?item.meta:null;
  if(!meta&&typeof metaResolver==='function'){
    try{meta=metaResolver(String(item.name||''),item)||null;}catch(e){meta=null;}
  }
  return isExchangeableMeta(meta);
}

function policyFor(itemId){
  const id=String(itemId||'');
  if(!id)return{action:'HOLD',reason:'ITEM_ID_REQUIRED'};
  if(isScrollId(id))return{action:'KEEP_MERCHANT',reason:'GLOBAL_SCROLL_KEEP'};
  if(id==='jacko')return{action:'HOLD',reason:'JACKO_REQUIRES_INVENTORY_GUARD'};
  const row=REWARD_POLICY[id];
  return row?clone(row):{action:'HOLD',reason:'UNLISTED_FAIL_CLOSED'};
}
function policyForItem(item={},options={}){
  const id=String(item&&item.name||item&&item.itemId||'');
  if(!id)return{action:'HOLD',reason:'ITEM_ID_REQUIRED'};
  if(isScrollId(id))return{action:'KEEP_MERCHANT',reason:'GLOBAL_SCROLL_KEEP'};
  if(id==='jacko'){
    const verdict=JackoRetentionPolicy.actionAllowed({character:options.character,inventory:options.inventory,index:options.index,action:'EXCHANGE'});
    return{action:'HOLD',reason:verdict.allowed?'JACKO_MANUAL_REVIEW_ONLY':verdict.reason};
  }
  const explicit=REWARD_POLICY[id];
  if(explicit)return clone(explicit);
  if(isExchangeableItem(item,options.metaResolver)){
    return{action:'KEEP_MERCHANT',reason:'UNAPPROVED_EXCHANGEABLE_REVIEW_REQUIRED'};
  }
  return{action:'HOLD',reason:'UNLISTED_FAIL_CLOSED'};
}
function shouldExchange(itemId){return policyFor(itemId).action==='EXCHANGE';}
function routeReward(item={},options={}){
  const id=String(item&&item.name||item&&item.itemId||'');
  const rule=policyForItem(item,options);
  return{
    ok:rule.action!=='HOLD',
    item:id||null,
    action:rule.action,
    target:rule.target==null?null:Number(rule.target),
    after:rule.after||null,
    reason:rule.reason||null,
    rule
  };
}
function unresolvedConflicts(){
  return Object.entries(REWARD_POLICY)
    .filter(([,row])=>row&&row.action==='HOLD'&&row.reason==='USER_POLICY_CONFLICT')
    .map(([itemId,row])=>({itemId,...clone(row)}));
}

module.exports={
  POLICY_VERSION,EXCHANGE_ITEMS,REWARD_POLICY,META_REWARDS,
  isScrollId,isExchangeableItem,policyFor,policyForItem,shouldExchange,routeReward,unresolvedConflicts
};

},{"../../core/policy/ExchangeApprovalPolicy":"core/policy/ExchangeApprovalPolicy.js","../gear/JackoRetentionPolicy":"organs/gear/JackoRetentionPolicy.js"}],
"organs/farm/FarmState.js":[function(require,module,exports){
'use strict';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const {planOrbit,snapshotMobs}=require('../../characters/warrior/WarriorV2Tactics');
const {evaluateAntiKsArm,nearestForeignPartyDistance}=require('../../core/policy/AntiKsPolicy');
const {planSpawnClaimZap}=require('../../characters/mage/Spells');

function resolveRequiredParty(character,config={}){
  const name=String(character||'');
  const byCharacter=config.requiredPartyByCharacter&&config.requiredPartyByCharacter[name];
  if(Array.isArray(byCharacter))return byCharacter.map(String);
  if(name==='Hibari')return['Souji'];
  if(name==='Harutora')return['Hibari','Souji'];
  if(name==='Souji')return['Hibari'];
  return (config.requiredParty||[]).map(String);
}

function defaultWarriorMiniState(){
  return{
    kind:'WARRIOR_FARM_ROTATION',
    phase:'CLEAVE_PREP',
    cleavesCompleted:0,
    burstTargetCasts:0,
    waitingForSugarProc:false,
    lastAction:null,
    lastSkill:null
  };
}

function createFarmState({
  character,
  targeting,
  party,
  movement,
  combat,
  controller=null,
  actionExecutor=null,
  fighter=null,
  root=null,
  partySafeSpotSignal=null,
  mageRegroupAuthority=null,
  merchantRoutes=null,
  priestHealingMonitor=null,
  warriorV2Runtime=null,
  casterActions=null,
  crewCodeActive=null,
  config={},
  priority=20
}={}){
  const name=String(character||'');
  if(!name||!targeting||!party||!movement||!combat)throw new Error('FARM_DEPENDENCIES_REQUIRED');
  const state={
    version:3,state:'FARM',character:name,phase:'STOPPED',paused:false,target_id:null,
    ticks:0,last_progress:null,last_error:null,farmEngaged:false,
    orbitMoves:0,lastOrbitAt:0,lastOrbitGoal:null,
    merchantRouteAttempt:null,
    lastMageSummonTarget:null,mageSummonIssuedAt:null,
    mini_state:name==='Hibari'?defaultWarriorMiniState():null,
    healer_retreat:name==='Hibari'?{
      active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null
    }:null,
    party_retreat:['Harutora','Souji'].includes(name)?{
      active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null
    }:null
  };

  const monsters=new Set((config.monsters||['xscorpion']).map(String));
  // A real native entities-packet listener is only added to Harutora's
  // existing FARM module; no polling, duplicate claim timer or false
  // observation proof. It is released when this Farm service stops.
  const magePacket={ids:new Set(),at:0,listener:null,attached:false};
  function packetListener(packet={}){
    const mobs=Array.isArray(packet.monsters)?packet.monsters:
      Object.values(packet.monsters||{});
    const ids=mobs.filter(m=>m&&m.id&&m.type!=='character')
      .map(m=>String(m.id));
    if(!ids.length)return;
    magePacket.ids=new Set(ids);
    magePacket.at=Date.now();
  }
  function attachMagePackets(){
    if(name!=='Harutora'||magePacket.attached)return;
    const sock=root?.parent?.socket;
    if(typeof sock?.on!=='function')return;
    sock.on('entities',packetListener);
    magePacket.listener=packetListener;magePacket.attached=true;
  }
  function detachMagePackets(){
    if(!magePacket.attached)return;
    const sock=root?.parent?.socket;
    const off=sock?.off||sock?.removeListener;
    if(typeof off==='function')off.call(sock,'entities',packetListener);
    magePacket.attached=false;magePacket.listener=null;
    magePacket.ids.clear();magePacket.at=0;
  }
  state.configuredFarmMobTypes=[...monsters];
  const required=resolveRequiredParty(name,config);
  const maxPartyDistance=Number(config.maxPartyDistance||190);
  const attackRange=Number(config.attackRange||320);
  const farmPosition=config.position?clone(config.position):null;
  // Expose exact configured farm coordinates so the Warrior utility owner
  // cannot Agitate from a stale phase after a boss or native Town escape.
  state.farmPosition=farmPosition?clone(farmPosition):null;
  const routeEnforced=config.merchantRouteEnforced===true;
  const nativeRoutes=config.nativeRouteMode===true&&routeEnforced;
  const liveCrew=who=>{try{return crewCodeActive?.(who)===true}catch(_){return false}};
  const aliveMember=who=>{const m=party.get?.(who);return m?.dead!==true&&m?.rip!==true&&(m?.online===true||liveCrew(who));};
  const summonAt={};
  const farmRadius=Math.max(35,Number(config.position?.radius||120));
  const fighterRetreatMainMap=String(config.fighterRetreatMainMap||config.warriorRetreatMainMap||'main');

  let orbitTimer=null,orbitEpoch=0;
  function orbitTick(){
    if(!nativeRoutes||name!=='Hibari'||state.paused||state.phase!=='FARM_MOB'||!state.stageReleased||!farmPosition)return false;
    const self=root?.character;
    if(!self||self.rip||self.dead||self.hp<=0||self.hp/self.max_hp<=.50||warriorV2Runtime?.status?.()?.criticalHold===true||self.map!==farmPosition.map)return false;
    const rows=fighter?.partySnapshot?.()||{},healer=rows.Souji;
    const sx=Number(self.real_x??self.x),sy=Number(self.real_y??self.y);
    if(!healer||healer.online!==true||healer.visible===false||healer.rip||healer.dead||healer.map!==self.map||String(healer.instance??self.in??'')!==String(self.in??self.instance??'')||![sx,sy,healer.x,healer.y].every(Number.isFinite)||Math.hypot(sx-healer.x,sy-healer.y)>maxPartyDistance)return false;
    const atFarm=Math.hypot(sx-farmPosition.x,sy-farmPosition.y)<=farmRadius;
    // Canonical V2 farmCircleMovementLoop (Hibari.js, v11 whirlpool):
    // use character.x/y, 30 degrees ahead, 65px when in contact and 40px
    // otherwise. The native move implementation calculates the legal path.
    const entities=root?.parent?.entities||root?.entities||{};
    const contact=Object.values(entities).some(m=>{
      if(!m||m.type!=='monster'||m.dead||m.rip||m.visible===false||!(Number(m.hp)>0)||!monsters.has(String(m.mtype)))return false;
      try{return typeof root.is_in_range==='function'?root.is_in_range(m)===true:Math.hypot(Number(m.real_x??m.x)-sx,Number(m.real_y??m.y)-sy)<=Number(self.range||0)}catch{return false}
    });
    const x=Number(self.x??sx),y=Number(self.y??sy);
    const goal=planOrbit({self:{map:self.map,x,y},center:farmPosition,healerReady:true,atFarm,contact});
    if(!goal.ok)return false;
    state.orbitRadius=goal.radius;state.orbitContact=contact;
    const lease=movement.acquire('FARM',{priority});if(!lease?.ok)return false;
    state.lastOrbitAt=Date.now();state.lastOrbitGoal=goal.target;state.orbitMoves++;
    const epoch=orbitEpoch;
    try{Promise.resolve(movement.move('FARM',goal.target)).then(out=>{if(epoch===orbitEpoch&&out?.ok===false)state.lastOrbitError=out.error||'ORBIT_MOVE_FAILED';},e=>{if(epoch===orbitEpoch)state.lastOrbitError=String(e?.message||e)});}catch(e){state.lastOrbitError=String(e?.message||e)}
    return true;
  }
  function startOrbit(){if(!nativeRoutes||name!=='Hibari'||!root||orbitTimer!==null||typeof setInterval!=='function')return;orbitTimer=setInterval(()=>{try{orbitTick()}catch(e){state.lastOrbitError=String(e?.message||e)}},250);orbitTimer?.unref?.();}
  function stopOrbit(){orbitEpoch++;if(orbitTimer!==null){clearInterval(orbitTimer);orbitTimer=null;}}
  function snapshot(){return clone(state);}
  async function start(){
    attachMagePackets();
    state.phase='ASSEMBLE';
    state.paused=false;
    state.last_error=null;
    state.farmEngaged=false;
    state.stageReleased=false;
    state.lastMageSummonTarget=null;state.mageSummonIssuedAt=null;
    state.merchantRouteAttempt=null;
    startOrbit();
    if(name==='Hibari'&&!state.mini_state)state.mini_state=defaultWarriorMiniState();
    if(name==='Hibari')state.healer_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
    if(['Harutora','Souji'].includes(name))state.party_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
    return{ok:true,status:snapshot()};
  }
  async function pause(){stopOrbit();state.paused=true;state.phase='PAUSED';movement.release('FARM');combat.release('FARM');return{ok:true,status:snapshot()};}
  async function resume(){state.paused=false;state.phase='ASSEMBLE';state.merchantRouteAttempt=null;state.stageReleased=false;startOrbit();return{ok:true,status:snapshot()};}
  async function stop(){stopOrbit();detachMagePackets();state.paused=false;state.phase='STOPPED';state.target_id=null;movement.release('FARM');combat.release('FARM');targeting.release('FARM');if(name==='Hibari')state.healer_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};if(['Harutora','Souji'].includes(name))state.party_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};return{ok:true,status:snapshot()};}
  async function health(){return{ok:state.last_error==null,status:snapshot()};}
  async function restore(saved){
    if(!saved||saved.version!==3||saved.state!=='FARM')throw new Error('FARM_SNAPSHOT_INVALID');
    Object.assign(state,clone(saved));
    if(name==='Hibari'&&!state.mini_state)state.mini_state=defaultWarriorMiniState();
    if(name==='Hibari'&&!state.healer_retreat)state.healer_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
    if(['Harutora','Souji'].includes(name)&&!state.party_retreat)state.party_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
    return{ok:true,status:snapshot()};
  }

  function resetWarriorHealerRetreat(){
    if(name!=='Hibari')return;
    state.healer_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
  }

  function resetFighterPartyRetreat(){
    if(name==='Hibari'){
      resetWarriorHealerRetreat();
      return;
    }
    if(['Harutora','Souji'].includes(name)){
      state.party_retreat={active:false,started_map:null,target_map:null,completed:false,last_reason:null,last_error:null};
    }
  }

  function fighterRetreatSlot(){
    if(name==='Hibari')return state.healer_retreat;
    if(['Harutora','Souji'].includes(name))return state.party_retreat;
    return null;
  }

  function setFighterRetreatSlot(value){
    if(name==='Hibari')state.healer_retreat=value;
    else if(['Harutora','Souji'].includes(name))state.party_retreat=value;
  }

  // Party-loss safety: stop every combat/target lease immediately. The
  // merchant/First State route authority must provide exact collision-verified
  // fixed legs; never replace a missing route with smart_move or a map guess.
  async function retreatFighterForPartyLoss(ready,ctx={}){
    if(!['Hibari','Harutora','Souji'].includes(name))return null;
    state.target_id=null;
    combat.release('FARM');
    targeting.release('FARM');

    const warrior=name==='Hibari';
    const self=typeof party.get==='function'?party.get(name):null;
    const currentMap=String(self&&self.map||'');
    const safe=warrior?{map:fighterRetreatMainMap}:config.safeWaitPosition;
    const targetMap=String(safe?.map||'');
    const prior=fighterRetreatSlot();
    const retreat=prior&&prior.active?prior:{
      active:true,started_map:currentMap||null,target_map:targetMap||null,
      completed:false,last_reason:'REQUIRED_PARTY_NOT_READY',last_error:null,
      awaitingPriestSignal:warrior&&state.farmEngaged===true
    };
    retreat.active=true;
    if(warrior&&state.farmEngaged===true)retreat.awaitingPriestSignal=true;
    setFighterRetreatSlot(retreat);
    movement.release('FARM');

    const waiter=warrior?'WARRIOR_WAIT_HEALER_SAFE':'FIGHTER_WAIT_PARTY_SAFE';
    const label=warrior?'SOUJI_NOT_READY':'REQUIRED_PARTY_NOT_READY';
    const hold=(reason,phase=warrior?'WAIT_HEALER_SAFE':'WAIT_PARTY_SAFE')=>{
      retreat.last_reason=reason;
      state.phase=phase;state.last_error=null;
      return{ok:true,progress:false,kind:waiter,reason,
        details:ready,retreat:clone(retreat),status:snapshot()};
    };
    if(!currentMap)return hold('SELF_LOCATION_UNKNOWN');
    if(!targetMap)return hold('VERIFIED_SAFE_WAIT_SPOT_REQUIRED');

    // Reached the safe destination; stay here with no attacks.
    if(currentMap===targetMap){
      if(warrior){
        retreat.completed=true;
        return hold(retreat.awaitingPriestSignal?'WAIT_SOUJI_SAFE_SPOT_MESSAGE':'WAIT_HEALER_NEARBY','WAIT_HEALER_TOWN');
      }
      const x=Number(self?.x),y=Number(self?.y);
      if(Number.isFinite(x)&&Number.isFinite(y)&&
         Number.isFinite(Number(safe?.x))&&Number.isFinite(Number(safe?.y))&&
         Math.hypot(x-Number(safe.x),y-Number(safe.y))<=Math.max(5,Number(safe.radius||35))){
        retreat.completed=true;
        return hold('WAIT_HIBARI_AT_SAFE_SPOT','WAIT_PARTY_SAFE');
      }
    }

    // The Mage and Priest use the same verified Merchant route graph as
    // everyone else. Previous code demanded tick-context flags that the
    // running scheduler never supplied, trapping a split Mage near mobs.
    // One graph attempt per party-loss episode: never silently retry forever.
    if((!warrior&&(currentMap===targetMap||nativeRoutes))&&
       Number.isFinite(Number(safe?.x))&&Number.isFinite(Number(safe?.y))&&
       typeof merchantRoutes?.planBossRoute==='function'&&
       typeof merchantRoutes?.followBossRoute==='function'){
      if(retreat.merchantRouteAttempted===true&&(!nativeRoutes||Date.now()<(retreat.retryAt||0)))
        return hold(retreat.last_error||'SAFE_WAIT_ROUTE_PREVIOUSLY_ATTEMPTED');
      retreat.merchantRouteAttempted=true;retreat.retryAt=Date.now()+5000;
      const goal={map:targetMap,x:Number(safe.x),y:Number(safe.y),
        stageRadius:Math.max(8,Math.min(35,Number(safe.radius||35)))};
      const plan=merchantRoutes.planBossRoute(goal);
      if(!plan?.ok||plan.smartMove!==false){
        retreat.last_error=String(plan?.error||'MERCHANT_SAFE_WAIT_GRAPH_UNAVAILABLE');
        return hold(retreat.last_error);
      }
      const walked=await merchantRoutes.followBossRoute(goal);
      if(walked?.ok===true){
        retreat.completed=true;retreat.last_error=null;
        state.phase='WAIT_PARTY_SAFE';
        state.last_progress='MERCHANT_SAFE_WAIT_RETREAT';
        return{ok:true,progress:true,kind:'FIGHTER_SAFE_WAIT_APPROACH',
          reason:'MERCHANT_VERIFIED_PARTY_LOSS_RETREAT',
          details:ready,retreat:clone(retreat),status:snapshot()};
      }
      retreat.last_error=String(walked?.error||'MERCHANT_SAFE_WAIT_MOVE_FAILED');
      return hold(retreat.last_error);
    }

    if(nativeRoutes){
      // Use the saved graph for the warrior's Town retreat; no Bridge ticket.
      if(warrior&&merchantRoutes?.followBossRoute){
        if(Date.now()<(retreat.retryAt||0))return hold(retreat.last_error||'TOWN_ROUTE_RETRY_DELAY');
        retreat.retryAt=Date.now()+5000;
        const walked=await merchantRoutes.followBossRoute({map:targetMap,x:0,y:0,stageRadius:25});
        if(walked?.ok){retreat.completed=true;state.last_progress='NATIVE_WARRIOR_TOWN_RETREAT';return hold('WAIT_HEALER_NEARBY','WAIT_HEALER_TOWN');}
        retreat.last_error=walked?.error||'NATIVE_TOWN_ROUTE_FAILED';return hold(retreat.last_error);
      }
      return hold('NATIVE_SAFE_ROUTE_UNAVAILABLE');
    }
    // Legacy callers with an explicit verified local move may still use it.
    if(!warrior&&currentMap===targetMap&&
       ctx.safeWaitRouteApproved===true&&ctx.safeWaitCollisionVerified===true&&
       typeof movement.move==='function'&&Number.isFinite(Number(safe.x))&&
       Number.isFinite(Number(safe.y))){
      const lease=movement.acquire('FARM',{priority});
      if(!lease.ok)return hold('SAFE_WAIT_MOVEMENT_PREEMPTED');
      const moved=await movement.move('FARM',{map:targetMap,x:Number(safe.x),y:Number(safe.y)});
      movement.release('FARM');
      if(moved?.ok===true){
        state.phase='WAIT_PARTY_SAFE';
        state.last_progress='SAFE_WAIT_APPROACH';
        return{ok:true,progress:true,kind:'FIGHTER_SAFE_WAIT_APPROACH',
          reason:label,details:ready,retreat:clone(retreat),status:snapshot()};
      }
      return hold('SAFE_WAIT_MOVE_FAILED');
    }

    // Cross-map retreat requires a previously validated fixed route adapter,
    // and an explicit authorization for THIS live movement. No smart_move.
    const approved=ctx.verifiedRetreatRouteApproved===true;
    const route=warrior?config.warriorTownRetreatRoute:config.safeWaitFixedRoute;
    if(!approved||!route||typeof movement.followVerifiedRoute!=='function')
      return hold('VERIFIED_RETREAT_ROUTE_REQUIRED',warrior?'RETREAT_HEALER_LOST':'WAIT_PARTY_SAFE');

    const lease=movement.acquire('FARM',{priority});
    if(!lease.ok)return hold('RETREAT_MOVEMENT_PREEMPTED');
    const moved=await movement.followVerifiedRoute('FARM',route);
    movement.release('FARM');
    if(moved?.ok!==true||moved.arrived!==true||moved.map!==targetMap)
      return hold('RETREAT_ARRIVAL_UNVERIFIED');
    retreat.completed=true;retreat.last_error=null;
    state.phase=warrior?'WAIT_HEALER_TOWN':'WAIT_PARTY_SAFE';
    state.last_progress='VERIFIED_PARTY_LOSS_RETREAT';
    return{ok:true,progress:true,kind:warrior?'WARRIOR_HEALER_RETREAT':'FIGHTER_PARTY_RETREAT',
      reason:label,details:ready,retreat:clone(retreat),status:snapshot()};
  }

  function trustedSoujiSafeSpotMessage(message){
    // No caller asserted "authenticated" flag can authorize a return.
    // Only the exact opaque receipt held by the native-CM verifier can pass.
    if(!message||message.sender!=='Souji'||message.kind!=='SAFE_SPOT_READY'||
       typeof partySafeSpotSignal?.verify!=='function'||
       typeof partySafeSpotSignal?.latest!=='function')return false;
    try{return partySafeSpotSignal.latest()===message&&
      partySafeSpotSignal.verify(message)===true}
    catch(_){return false}
  }

  async function tryWarriorFarmReturn(ctx,ready){
    if(name!=='Hibari'||state.healer_retreat?.active!==true)return null;
    const retreat=state.healer_retreat;
    // Returning from Town is a distinct state: do not send Hibari back to
    // Town while he is waiting for Souji to become locally visible.
    if(retreat.returningFarm===true){
      if(!ready.ok){
        state.phase='WAIT_SOUJI_NEAR_VERIFIED_SAFE_SPOT';
        state.target_id=null;combat.release('FARM');targeting.release('FARM');
        return{ok:true,progress:false,reason:'WAIT_SOUJI_NEAR_VERIFIED_SAFE_SPOT',status:snapshot()};
      }
      return null;
    }
    if(retreat.awaitingPriestSignal!==true)return null; // First login: both nearby may start normally.
    const self=typeof party.get==='function'?party.get(name):null;
    const hold=reason=>{
      state.phase='WAIT_PRIEST_READY_RETURN_ROUTE';
      state.target_id=null;combat.release('FARM');targeting.release('FARM');
      return{ok:true,progress:false,reason,status:snapshot()};
    };
    if(retreat.completed!==true||String(self?.map||'')!==fighterRetreatMainMap)
      return null;
    if(typeof partySafeSpotSignal?.request==='function'){
      try{await partySafeSpotSignal.request()}catch(_){} // never bypass hold
    }
    const msg=partySafeSpotSignal?.latest?.()||null;
    if(!trustedSoujiSafeSpotMessage(msg))return hold('WAIT_AUTHENTICATED_SOUJI_SAFE_SPOT_MESSAGE');
    const safe=ctx.priestSafeSpot||config.safeWaitPosition;
    if(!safe||String(safe.map||'')!==String(msg.map||'')||
       !Number.isFinite(Number(safe.x))||!Number.isFinite(Number(safe.y))||
       !Number.isFinite(Number(msg.x))||!Number.isFinite(Number(msg.y))||
       Math.hypot(Number(safe.x)-Number(msg.x),Number(safe.y)-Number(msg.y))>35)
      return hold('SOUJI_SAFE_SPOT_PROOF_MISMATCH');
    if(ctx.verifiedFarmReturnRouteApproved!==true||
       !config.warriorFarmReturnRoute||typeof movement.followVerifiedRoute!=='function')
      return hold('VERIFIED_FARM_RETURN_ROUTE_REQUIRED');
    const lease=movement.acquire('FARM',{priority});
    if(!lease.ok)return hold('FARM_RETURN_MOVEMENT_PREEMPTED');
    const moved=await movement.followVerifiedRoute('FARM',config.warriorFarmReturnRoute);
    movement.release('FARM');
    if(moved?.ok!==true||moved.arrived!==true||moved.map!==safe.map)
      return hold('FARM_RETURN_ARRIVAL_UNVERIFIED');
    retreat.returningFarm=true;
    retreat.awaitingPriestSignal=false;
    state.phase='WAIT_SOUJI_NEAR_VERIFIED_SAFE_SPOT';
    state.last_progress='VERIFIED_WARRIOR_FARM_RETURN';
    return{ok:true,progress:true,kind:'WARRIOR_VERIFIED_FARM_RETURN',
      reason:'WAIT_SOUJI_NEAR_VERIFIED_SAFE_SPOT',status:snapshot()};
  }

  function syncLiveParty(){
    if(!fighter||typeof fighter.partySnapshot!=='function'||typeof party.update!=='function')return;
    const rows=fighter.partySnapshot()||{};
    for(const [member,row] of Object.entries(rows))party.update(member,row||{});
  }

  function liveEntities(ctx){
    if(ctx&&ctx.entities&&typeof ctx.entities==='object')return ctx.entities;
    if(fighter&&typeof fighter.entitiesSnapshot==='function')return fighter.entitiesSnapshot()||{};
    return{};
  }

  function updateWarriorMini(rotation,execution){
    const mini=state.mini_state||defaultWarriorMiniState();
    if(rotation.resetCleaveBurst===true){
      mini.cleavesCompleted=0;
      mini.burstTargetCasts=0;
      mini.waitingForSugarProc=false;
    }
    if(Number.isFinite(Number(rotation.burstTargetCasts))&&Number(rotation.burstTargetCasts)>0){
      mini.burstTargetCasts=Number(rotation.burstTargetCasts);
    }
    if(
      Number.isFinite(Number(rotation.cleavesCompletedAfterSuccess))&&
      execution&&Array.isArray(execution.skills)&&execution.skills.includes('cleave')
    ){
      mini.cleavesCompleted=Number(rotation.cleavesCompletedAfterSuccess);
      mini.lastSkill='cleave';
    }
    mini.phase=String(rotation.nextPhase||rotation.phase||mini.phase||'CLEAVE_PREP');
    mini.waitingForSugarProc=mini.phase==='SUGAR_WAIT_PROC';
    mini.lastAction=rotation.reason||null;
    state.mini_state=mini;
  }

  async function tickWarrior(target){
    if(name!=='Hibari'||!controller||!actionExecutor||!fighter||typeof fighter.snapshot!=='function')return null;
    const live=fighter.snapshot(target.id);
    if(!live||live.ok!==true)return{ok:false,error:live&&live.error||'WARRIOR_LIVE_SNAPSHOT_FAILED'};

    const mini=state.mini_state||defaultWarriorMiniState();
    const rawNearby=fighter.entitiesSnapshot?.()||{};
    const self=party.get?.('Hibari')||{};
    const nearby=snapshotMobs({self,entities:rawNearby,farmMobTypes:[...monsters]});
    const farmNear=nearby.filter(m=>m.isFarmMob);
    const mobTarget=target.entity&&target.entity.target||live.target&&live.target.target||null;
    const plan=controller.plan({
      mainState:'FARM_MOB',
      isFarmMob:true,
      target:target.id,
      mp:Number(live.mp||0),
      maxMp:Number(live.maxMp||0),
      basicAttackMp:Number(live.basicAttackMp||0),
      level:Number(live.level||0),
      hpRatio:Number(live.hpRatio||0),
      attackReady:live.attackReady===true,
      inRange:live.targetInAttackRange===true,
      cleaveLoadoutReady:live.cleaveLoadoutReady===true,
      cleaveCooldownReady:live.cleaveCooldownReady===true,
      sugarRushActive:live.sugarRushActive===true,
      cooldownReady:live.stompCooldownReady===true,
      tauntCooldownReady:live.tauntCooldownReady===true,
      tauntInRange:Number(target.entity&&target.entity.distance)<=200,
      partyEngaged:!!mobTarget,
      targetIsMonster:true,
      targetingPartyMember:!!mobTarget,
      targetingPartyMemberName:String(mobTarget||''),
      targetingForeignPlayer:false,
      warriorHasAggro:String(mobTarget||'')===name,
      phase:mini.phase,
      cleavesCompleted:Number(mini.cleavesCompleted||0),
      burstTargetCasts:Number(mini.burstTargetCasts||0),
      waitingForSugarProc:mini.waitingForSugarProc===true,
      healerMaxDistance:maxPartyDistance,
      mobsNear:farmNear.filter(m=>m.distance<=400).length,
      attackers:farmNear.filter(m=>m.targetingWarrior&&m.distance<=400).length,
      nearbyMobs:nearby.map(m=>({distance:m.distance,isHuntMob:m.isFarmMob,
        isBoss:m.isBoss,targetingForeignPlayer:m.targetingForeignPlayer,
        warriorHasAggro:m.targetingWarrior})),
      targetIsHuntMob:monsters.has(String(target.entity?.mtype||'')),
      farmOwnershipAuthorized:true,
      v2UtilityOwned:warriorV2Runtime?.status?.()?.running===true,
      targetIsBoss:false
    });

    const executed=await actionExecutor.execute(plan);
    if(!executed||executed.ok!==true){
      return{ok:false,error:executed&&executed.error||'WARRIOR_ACTION_EXECUTION_FAILED',plan,execution:executed};
    }

    if(plan.rotation)updateWarriorMini(plan.rotation,executed);
    // V2 circle at the approved farm only: 65px, or 40px when
    // contact is lost, rotating 30 degrees per 250ms.
    if(!nativeRoutes&&plan.healer?.ok===true&&farmPosition&&
       Date.now()-Number(state.lastOrbitAt||0)>=250&&
       typeof fighter.canMove==='function'&&self.map===farmPosition.map){
      const rangeToFarm=Math.hypot(Number(self.x)-Number(farmPosition.x),
        Number(self.y)-Number(farmPosition.y));
      const goal=planOrbit({self,center:farmPosition,healerReady:true,
        atFarm:rangeToFarm<=farmRadius,
        contact:farmNear.some(m=>m.distance<=Math.max(12,Number(live.range||self.range||36)))});
      if(goal.ok&&fighter.canMove(goal.target)===true){
        const lease=movement.acquire('FARM',{priority});
        if(lease.ok){
          const moved=await movement.move('FARM',goal.target);
          if(moved?.ok===true){
            state.lastOrbitAt=Date.now();state.orbitMoves++;
            state.lastOrbitGoal=goal.target;
          }
        }
      }
    }
    if(Number(executed.attackCount||0)>0||(Array.isArray(executed.skills)&&executed.skills.length>0))
      state.farmEngaged=true;
    return{
      ok:true,
      progress:(Number(executed.attackCount||0)>0)||(Array.isArray(executed.skills)&&executed.skills.length>0),
      kind:'WARRIOR_FARM_ROTATION',
      plan,
      execution:executed,
      mini_state:clone(state.mini_state)
    };
  }

  // Mage owns regroup while waiting; a Magiport is a ROUTE action, never a
  // farm attack. The Bridge-supplied authority is independently injected at
  // bootstrap, NOT passed through an untrusted tick context.
  async function tryMageRegroup(ctx,ready){
    if(name!=='Harutora')return null;
    if(nativeRoutes){
      // A missing healer is never a combat permission. Magiport is optional:
      // prefer Souji, then Hibari; a failed/cooldown cast never stops walking.
      const self=party.get?.(name),safe=config.safeWaitPosition;
      if(!self||!safe||self.map!==safe.map||Math.hypot(self.x-safe.x,self.y-safe.y)>Math.max(10,safe.radius||35))return null;
      const threats=Object.values(fighter?.entitiesSnapshot?.()||{}).some(e=>e?.type==='monster'&&!e.rip&&!e.dead&&(e.target===name||e.target===root?.character?.id));
      if(threats||!fighter?.ready?.('magiport')||!fighter?.use)return null;
      for(const who of ['Souji','Hibari']){
        if(!aliveMember(who))continue;
        const row=party.get?.(who);
        if(row?.visible===true&&row.map===self.map&&Math.hypot(row.x-self.x,row.y-self.y)<=190)continue;
        if(Date.now()-(summonAt[who]||0)<15000)continue;
        summonAt[who]=Date.now();
        try{const out=await fighter.use('magiport',who);if(out?.ok){state.lastMageSummonTarget=who;state.mageSummonIssuedAt=Date.now();state.last_progress='NATIVE_MAGIPORT_SENT';}}catch(_){}
        break;
      }
      return null;
    }
    // A missing warrior means leave the mob pack by Rentaro's safe route
    // BEFORE considering an optional summon/wait. Boss rally is separate.
    if(!ready.ok&&typeof merchantRoutes?.followBossRoute==='function')return null;
    const area=config.mageFarmArea||config.position;
    const safe=config.safeWaitPosition;
    const hold=reason=>{
      state.target_id=null;combat.release('FARM');targeting.release('FARM');
      state.phase='MAGE_WAIT_SAFE_REGROUP';
      return{ok:true,progress:false,kind:'MAGE_SAFE_WAIT',reason,status:snapshot()};
    };
    if(!area||!safe||!area.map||!safe.map||
       !Number.isFinite(Number(area.x))||!Number.isFinite(Number(area.y))||
       !Number.isFinite(Number(safe.x))||!Number.isFinite(Number(safe.y)))
      return hold('MAGE_VERIFIED_FARM_AND_SAFE_SPOT_CONFIG_REQUIRED');
    const radius=Number(area.radius||120);
    if(!Number.isFinite(radius)||radius<35||radius>350)
      return hold('MAGE_FARM_RADIUS_INVALID');
    const get=typeof party.get==='function'?who=>party.get(who):()=>null;
    const self=get(name),warrior=get('Hibari'),priest=get('Souji');
    const inside=p=>!!p&&p.online===true&&p.dead!==true&&p.rip!==true&&
      p.map===area.map&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))&&
      Math.hypot(Number(p.x)-Number(area.x),Number(p.y)-Number(area.y))<=radius;
    if(ready.ok&&inside(self)&&inside(warrior)&&inside(priest)){
      // A previously issued one-shot summon is complete only after actual
      // verified arrival, not immediately after a native send receipt.
      state.lastMageSummonTarget=null;state.mageSummonIssuedAt=null;
      return null;
    }
    if(state.lastMageSummonTarget)
      return hold('MAGE_SUMMON_ALREADY_ATTEMPTED_AWAIT_ARRIVAL');
    // Never summon an offline fighter, or cast while the Mage has no
    // independently verified safe staging/safe target area.
    if(!mageRegroupAuthority||typeof mageRegroupAuthority.authorize!=='function'||
       typeof mageRegroupAuthority.verifyBeforeCast!=='function')return ready.ok?
      hold('MAGE_ROUTE_OWNED_SUMMON_AUTHORITY_REQUIRED'):null;
    if(!controller||typeof controller.plan!=='function'||
       !fighter||typeof fighter.use!=='function'||
       typeof fighter.snapshot!=='function')return hold('MAGE_SUMMON_EXECUTOR_UNAVAILABLE');
    const t=Date.now();
    let ticket=null;
    try{ticket=await mageRegroupAuthority.authorize({
      role:'Harutora',self,warrior,priest,
      safeWaitPosition:safe,farmArea:{...area,radius},at:t
    })}catch(_){}
    if(!ticket||ticket.source!=='INDEPENDENT_VERIFIED_MAGE_REGROUP'||
       ticket.verified!==true||ticket.role!=='Harutora'||
       !Number.isSafeInteger(ticket.observedAt)||!Number.isSafeInteger(ticket.expiresAt)||
       ticket.observedAt>t||t-ticket.observedAt>1200||
       ticket.expiresAt<t||ticket.expiresAt>t+3000)
      return ready.ok?hold('MAGE_FRESH_VERIFIED_SUMMON_TICKET_REQUIRED'):null;
    const live=fighter.snapshot();
    if(!live||live.ok!==true||!Number.isFinite(Number(live.mp))||
       typeof fighter.ready!=='function')return hold('MAGE_LIVE_MANA_UNKNOWN');
    const plan=controller.plan({
      mainState:'FARM_MOB',mp:Number(live.mp),
      magiportCooldownReady:fighter.ready('magiport')===true,
      routeAuthorized:true,safeSpotVerified:true,safeSpotClear:true,
      magiportConsentExpected:true,safeWaitPosition:safe,
      farmArea:{...area,radius}
    });
    if(plan.action?.name!=='magiport'||!['Hibari','Souji'].includes(plan.action.target))
      return ready.ok?hold('MAGE_WAIT_TEAM_INSIDE_FARM'):null;
    const target=plan.action.target;
    const selected=get(target),candidateSelf=get(name);
    if(!candidateSelf||candidateSelf.map!==safe.map||
       !Number.isFinite(Number(candidateSelf.x))||!Number.isFinite(Number(candidateSelf.y))||
       Math.hypot(Number(candidateSelf.x)-Number(safe.x),
         Number(candidateSelf.y)-Number(safe.y))>35)
      return hold('MAGE_NOT_AT_VERIFIED_SAFE_CAST_POINT');
    if(!selected||selected.online!==true||selected.dead===true||selected.rip===true||
       !selected.map||!Number.isFinite(Number(selected.x))||
       !Number.isFinite(Number(selected.y)))
      return hold('MAGE_SUMMON_TARGET_NOT_LIVE_AND_LOCATED');
    if(state.lastMageSummonTarget===target)
      return hold('MAGE_SUMMON_ALREADY_ATTEMPTED_AWAIT_ARRIVAL');
    let approved=false;
    try{approved=mageRegroupAuthority.verifyBeforeCast(ticket,{
      role:'Harutora',target,actualSelf:get(name),actualTarget:get(target),
      safeWaitPosition:safe,farmArea:{...area,radius},at:Date.now()
    })===true}catch(_){}
    if(!approved)return hold('MAGE_SUMMON_PRECAST_PROOF_REQUIRED');
    // One attempt per target; no auto retries or attack fallthrough.
    state.lastMageSummonTarget=target;state.mageSummonIssuedAt=Date.now();
    state.target_id=null;combat.release('FARM');targeting.release('FARM');
    let cast;
    try{cast=await fighter.use('magiport',target)}
    catch(_){cast={ok:false,error:'MAGE_MAGIPORT_NATIVE_ERROR'}}
    if(!cast||cast.ok!==true)return hold('MAGE_MAGIPORT_NOT_CONFIRMED');
    state.phase='WAIT_MAGIPORT_ARRIVAL';
    state.last_progress='MAGE_MAGIPORT_SENT';
    return{ok:true,progress:false,kind:'MAGE_SUMMON_SENT_AWAIT_ARRIVAL',
      target,reason:'AWAIT_SERVER_CONFIRMED_PARTY_ARRIVAL',status:snapshot()};
  }

  // Heals have priority and are independent of Hibari combat readiness.
  // Souji can heal at the safe wait, in Town, or while regrouping; no damage
  // skill, normal attack, or movement is issued from this helper.
  async function mageAntiKsZap(target,ctx={}){
    if(name!=='Harutora'||!target?.id||!target.entity||
       !fighter||typeof fighter.use!=='function')return null;
    const entity=target.entity;
    if(!monsters.has(String(entity.mtype||''))||entity.cooperative===true||
       !!entity.target)return null;
    const self=party.get?.('Harutora'),war=party.get?.('Hibari'),
      priest=party.get?.('Souji');
    if(!self||!war||!priest||war.dead||war.rip||priest.dead||priest.rip||
       self.map!==war.map||war.map!==priest.map)return null;
    const mobX=Number(entity.real_x??entity.x),
      mobY=Number(entity.real_y??entity.y);
    if(![mobX,mobY,war.x,war.y].every(Number.isFinite))return null;
    const warRange=Math.hypot(mobX-Number(war.x),mobY-Number(war.y));
    const foreign=nearestForeignPartyDistance({entities:liveEntities(ctx),
      partyNames:['Rentaro','Hibari','Harutora','Souji',
        ...Object.keys(root?.get_party?.()||{})],farm:farmPosition,
      instance:root?.character?.in??root?.character?.instance});
    const selfInFarm=self.map===farmPosition?.map&&
      Number.isFinite(Number(self.x))&&Number.isFinite(Number(self.y))&&
      Math.hypot(Number(self.x)-Number(farmPosition.x),
        Number(self.y)-Number(farmPosition.y))<=farmRadius;
    const arm=evaluateAntiKsArm({mainState:'FARM_MOB',
      inConfiguredFarmArea:selfInFarm,mobType:String(entity.mtype||''),
      configuredFarmMob:String(entity.mtype||''),
      foreignPartyDistanceToFarmArea:foreign,bossPriorityActive:false});
    if(!arm.armed)return null;
    // When Anti-KS is legitimately armed, the existing TARGET_CLAIM owner
    // must hold the unowned spawn. No generic Mage attack may race an
    // unavailable/late native entities packet or Zap proof.
    if(!magePacket.attached||Date.now()-magePacket.at>1500||
       !magePacket.ids.has(String(target.id))){
      state.phase='ANTI_KS_WAIT_SPAWN_PACKET';
      return{ok:true,progress:false,kind:'MAGE_ANTI_KS_CLAIM_WAIT',
        reason:'NATIVE_ENTITIES_PACKET_PROOF_REQUIRED',status:snapshot()};
    }
    const shot=fighter.snapshot?.(target.id)||{};
    const rings=shot.equipment||{};
    const zapper=Object.entries(rings).some(([slot,item])=>
      /^ring/.test(slot)&&item?.name==='zapper');
    const planned=planSpawnClaimZap({
      target:target.id,mp:Number(shot.mp||0),
      cooldownReady:fighter.ready?.('zapperzap')===true,
      inRange:shot.targetInAttackRange===true,
      zapperEquipped:zapper,targetIsMonster:true,
      cooperative:false,targetUnowned:true,claimAuthorized:true,
      observedOnEntitiesPacket:true,mageCombatReady:true,
      warriorCanTauntTarget:warRange<=190,
      antiKsArmed:true,bossPriorityActive:false,targetIsBoss:false});
    if(!planned.eligible){
      state.phase='ANTI_KS_WAIT_ZAP_READY';
      return{ok:true,progress:false,kind:'MAGE_ANTI_KS_CLAIM_WAIT',
        reason:planned.reason||'MAGE_ZAP_NOT_READY',status:snapshot()};
    }
    const used=await fighter.use('zapperzap',String(target.id));
    if(!used?.ok)return{ok:false,error:used?.error||'MAGE_CLAIM_ZAP_FAILED'};
    magePacket.ids.delete(String(target.id));
    state.last_progress='ANTI_KS_SPAWN_CLAIM_ZAP';
    state.phase='MAGE_SPAWN_CLAIM_ZAP';
    return{ok:true,progress:true,kind:'MAGE_ANTI_KS_CLAIM_ZAP',
      target:String(target.id),reason:arm.reason,status:snapshot()};
  }

  async function tickPriestHealing(){
    if(name==='Souji'&&priestHealingMonitor){
      // Timer heals even while FARM is paused; the FARM tick must never
      // race it with another attack or second native heal request.
      const native=await priestHealingMonitor.tick?.();
      if(priestHealingMonitor.holdForHealing?.()===true){
        state.target_id=null;
        combat.release('FARM');targeting.release('FARM');
        state.phase='PRIEST_HEAL_FIRST_HOLD';
        return{ok:true,progress:native?.requested===true,
          kind:'PRIEST_HEAL_FIRST_HOLD',
          reason:native?.skill||native?.error||'HEAL_PRIORITY_5S',
          status:snapshot()};
      }
      return null;
    }
    if(name!=='Souji'||!controller||typeof controller.plan!=='function'||
       !fighter||typeof fighter.use!=='function')return null;
    let planned;
    try{planned=controller.plan({mainState:'FARM_MOB'})}
    catch(_){return{ok:false,reason:'PRIEST_HEAL_PLANNER_FAILED'}}
    const action=planned?.action;
    if(action?.kind!=='USE_SKILL'||!['partyheal','heal'].includes(action.skill))return null;
    let result;
    try{result=await fighter.use(action.skill,action.target||null)}
    catch(_){result={ok:false,error:'PRIEST_NATIVE_HEAL_ERROR'}}
    if(!result||result.ok!==true)
      return{ok:false,reason:'PRIEST_HEAL_NOT_CONFIRMED'};
    state.last_progress='PRIEST_'+action.skill.toUpperCase();
    return{ok:true,progress:true,kind:'PRIEST_HEAL',
      skill:action.skill,target:action.target||null,status:snapshot()};
  }

  async function tick(ctx={}){
    state.ticks++;
    if(state.paused||state.phase==='STOPPED')return{ok:true,progress:false,status:snapshot()};

    syncLiveParty();
    if(name==='Hibari'&&(warriorV2Runtime?.status?.()?.criticalHold===true||(Number(root?.character?.hp)>0&&Number(root?.character?.hp)/Math.max(1,Number(root?.character?.max_hp))<=.50))){
      state.phase='WARRIOR_SCARE_RECOVERY_HOLD';state.target_id=null;
      combat.release('FARM');targeting.release('FARM');movement.release('FARM');
      return{ok:true,progress:false,reason:'WARRIOR_SCARE_RECOVERY',status:snapshot()};
    }
    const healing=await tickPriestHealing();
    const priestPosition=party.get?.(name);
    const warriorPosition=party.get?.('Hibari');
    // Follow the living Warrior within the existing farm area to keep Heal
    // in range. Native collision-checked short move, not another route.
    if(nativeRoutes&&state.stageReleased===true&&name==='Souji'&&priestPosition?.map===farmPosition?.map&&warriorPosition?.map===priestPosition.map&&warriorPosition.online===true&&warriorPosition.dead!==true&&warriorPosition.rip!==true){
      const dx=warriorPosition.x-priestPosition.x,dy=warriorPosition.y-priestPosition.y,d=Math.hypot(dx,dy);
      const wFarm=Math.hypot(warriorPosition.x-farmPosition.x,warriorPosition.y-farmPosition.y);
      if(d>105&&wFarm<=farmRadius+40&&typeof root?.can_move_to==='function'){
        const step=Math.min(35,d-80),goal={map:priestPosition.map,x:priestPosition.x+dx*step/d,y:priestPosition.y+dy*step/d};
        if(root.can_move_to(goal.x,goal.y)===true){
          const lease=movement.acquire('FARM',{priority});
          if(lease?.ok){try{const moved=await movement.move('FARM',goal);if(moved?.ok)return{ok:true,progress:true,kind:'PRIEST_FOLLOW_HIBARI',status:snapshot()};}finally{movement.release('FARM')}}
        }
      }
    }
    const priestTravel=nativeRoutes&&name==='Souji'&&farmPosition&&priestPosition&&
      (priestPosition.map!==farmPosition.map||Math.hypot(priestPosition.x-farmPosition.x,priestPosition.y-farmPosition.y)>farmRadius);
    // The independent healing timer remains active during route travel. A
    // remote injured teammate must not hold Souji permanently on another map.
    if(healing?.ok===true&&!priestTravel)return healing;
    if(healing?.ok===false&&!priestTravel)return{ok:true,progress:false,
      reason:healing.reason||'PRIEST_HEAL_FAILED_HOLD',status:snapshot()};
    const ready=party.ready(required,{anchor:name,maxDistance:maxPartyDistance});
    const mageRegroup=await tryMageRegroup(ctx,ready);
    if(mageRegroup)return mageRegroup;
    const returnHome=nativeRoutes?null:await tryWarriorFarmReturn(ctx,ready);
    if(returnHome)return returnHome;
    // During FIRST assembly, crew members often travel the identical
    // Merchant route at different speeds. Temporary distance separation
    // is not a healer disconnect: allow ROUTE movement, never combat,
    // when every required teammate is still online and alive. If a
    // teammate truly disconnects, continue the existing wait/retreat.
    const actor=party.get?.(name);
    const alreadyNearMobPack=!!(actor&&farmPosition&&
      actor.map===farmPosition.map&&
      [actor.x,actor.y].every(v=>v!==null&&v!==undefined&&
        Number.isFinite(Number(v)))&&
      Math.hypot(Number(actor.x)-Number(farmPosition.x),
        Number(actor.y)-Number(farmPosition.y))<=Math.max(180,farmRadius));
    const firstAssemblyTransit=routeEnforced&&(nativeRoutes||state.farmEngaged!==true)&&
      (nativeRoutes||!alreadyNearMobPack)&&
      required.every(who=>{
        if(nativeRoutes)return aliveMember(who);
        const member=party.get?.(who);
        // Visible player proof is still required for attack readiness, but
        // other CODE frames remain online while traveling on another map.
        if(member?.online===true&&member.dead!==true&&member.rip!==true)
          return true;
        try{return crewCodeActive?.(who)===true}catch(_){return false}
      });
    if(!ready.ok&&!firstAssemblyTransit){
      const fighterRetreat=await retreatFighterForPartyLoss(ready,ctx);
      if(fighterRetreat)return fighterRetreat;
      state.phase='ASSEMBLE';state.target_id=null;combat.release('FARM');targeting.release('FARM');
      return{ok:true,progress:false,reason:'PARTY_NOT_READY',details:ready,status:snapshot()};
    }
    if(!nativeRoutes&&name==='Hibari'&&state.healer_retreat?.active===true&&
       state.healer_retreat.awaitingPriestSignal===true){
      if(!trustedSoujiSafeSpotMessage(partySafeSpotSignal?.latest?.())){
        state.phase='WAIT_SOUJI_SAFE_SPOT_MESSAGE';
        state.target_id=null;combat.release('FARM');targeting.release('FARM');
        return{ok:true,progress:false,reason:'WAIT_AUTHENTICATED_SOUJI_SAFE_SPOT_MESSAGE',status:snapshot()};
      }
      // This releases only the post-loss hold; party.ready and farm-position
      // checks below still apply independently before any farming attack.
    }
    if(fighterRetreatSlot()&&fighterRetreatSlot().active===true)resetFighterPartyRetreat();

    // Never confuse 'FARM' scheduler activation with 'FARM_MOB'
    // admission. Every fighter must have Rentaro's actual PogiPath
    // route model and physically reach the designated farm area.
    if(routeEnforced){
      const shared=merchantRoutes?.status?.();
      if(!shared||shared.source!=='POGIPATH_RENTARO_SHARED'||
         !shared.routeId||!shared.modelVersion){
        state.phase='FARM_ROUTE';state.target_id=null;
        combat.release('FARM');targeting.release('FARM');
        return{ok:true,progress:false,reason:'MERCHANT_SHARED_ROUTE_NOT_LOADED',
          status:snapshot()};
      }
      const self=party.get?.(name);
      const savedStage=nativeRoutes?merchantRoutes?.section?.(23)?.points?.at(-1):null;
      const distanceFromStage=row=>row&&savedStage&&row.map===savedStage.map&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))?Math.hypot(Number(row.x)-Number(savedStage.x),Number(row.y)-Number(savedStage.y)):Infinity;
      const atStage=distanceFromStage(self)<=40;
      const memberAtStageOrFarm=who=>{const row=party.get?.(who);return row?.online===true&&row.visible!==false&&row.rip!==true&&row.dead!==true&&row.map===savedStage?.map&&(distanceFromStage(row)<=40||(Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))&&Math.hypot(Number(row.x)-farmPosition.x,Number(row.y)-farmPosition.y)<=farmRadius));};
      const physicallyAtFarm=row=>row&&row.map===farmPosition?.map&&Number.isFinite(Number(row.x))&&Number.isFinite(Number(row.y))&&Math.hypot(Number(row.x)-farmPosition.x,Number(row.y)-farmPosition.y)<=farmRadius;
      if(nativeRoutes&&ready.ok&&physicallyAtFarm(self)&&required.every(memberAtStageOrFarm))state.stageReleased=true;
      const staging=nativeRoutes&&state.stageReleased!==true;
      if(staging&&!savedStage){state.phase='WAIT_SAVED_SAFE_END';return{ok:true,progress:false,reason:'SAVED_SAFE_END_MISSING',status:snapshot()};}
      // Late mage may advance along the saved approach when both allies are
      // already physically in the farm. The final combat range gate remains.
      const mageJoinFarm=name==='Harutora'&&required.every(who=>memberAtStageOrFarm(who)&&physicallyAtFarm(party.get?.(who)));
      if(nativeRoutes&&atStage&&!mageJoinFarm&&(!ready.ok||!required.every(memberAtStageOrFarm))){
        state.stageReleased=false;state.phase='WAIT_TEAM_AT_SAFE_END';state.target_id=null;combat.release('FARM');targeting.release('FARM');movement.release('FARM');
        return{ok:true,progress:false,reason:'WAIT_TEAM_PHYSICALLY_AT_SAFE_END',details:ready,status:snapshot()};
      }
      // Rejoin the saved marker from the immediately adjacent approach corridor.
      // This avoids restarting a whole section from Town after a boss or heal step.
      if(staging&&!atStage&&distanceFromStage(self)<=100&&typeof root?.can_move_to==='function'&&root.can_move_to(savedStage.x,savedStage.y)===true){
        if(root.character?.moving===true||Date.now()-Number(state.stageMoveAt||0)<1000)return{ok:true,progress:false,reason:'REJOIN_SAVED_SAFE_END_IN_FLIGHT',status:snapshot()};
        const lease=movement.acquire('FARM',{priority});
        if(lease?.ok){state.stageMoveAt=Date.now();try{const moved=await movement.move('FARM',{map:savedStage.map,x:savedStage.x,y:savedStage.y});if(moved?.ok)return{ok:true,progress:true,kind:'REJOIN_SAVED_SAFE_END',status:snapshot()};}finally{movement.release('FARM')}}
      }
      const readySite=!staging&&self&&farmPosition&&self.map===farmPosition.map&&
        Number.isFinite(Number(self.x))&&Number.isFinite(Number(self.y))&&
        Math.hypot(Number(self.x)-Number(farmPosition.x),
          Number(self.y)-Number(farmPosition.y))<=farmRadius;
      if(!readySite){
        state.phase='FARM_ROUTE';state.target_id=null;
        combat.release('FARM');targeting.release('FARM');
        // Follow only the current Rentaro map-section, never an improvised
        // cross-map shortcut. One native attempt, no background retries.
        const chosen=config.merchantItinerariesByMap?.[self?.map];
        // If the character has already arrived at the saved SAFE END,
        // skip the section starting at Halloween Town (0,0); proceed
        // only on the deterministic Merchant-anchored farm extension.
        const safeEnd=self?.map==='halloween'?
          merchantRoutes?.section?.(23)?.points?.at(-1):null;
        const atSafeEnd=!!safeEnd&&Number.isFinite(Number(self?.x))&&
          Number.isFinite(Number(self?.y))&&
          Math.hypot(Number(self.x)-Number(safeEnd.x),
            Number(self.y)-Number(safeEnd.y))<=40;
        const itinerary=atSafeEnd?[{kind:'FARM_APPROACH'}]:nativeRoutes&&Array.isArray(chosen)?chosen.filter(step=>step.kind!=='FARM_APPROACH'):chosen;
        const sectionIndex=config.merchantSectionsByMap?.[self?.map];
        const hasItinerary=Array.isArray(itinerary)&&itinerary.length>0&&typeof merchantRoutes?.followItinerary==='function';
        // Main/Halloween's previously tested itinerary is the first choice.
        const useBossGraph=(!atSafeEnd)&&(!nativeRoutes||!hasItinerary)&&
          typeof merchantRoutes?.planBossRoute==='function'&&
          typeof merchantRoutes?.followBossRoute==='function';
        const useItinerary=hasItinerary&&!useBossGraph;
        if(atSafeEnd||useBossGraph||useItinerary||
           (Number.isSafeInteger(sectionIndex)&&
           typeof merchantRoutes?.followSection==='function')){
          const routeStep=atSafeEnd?'FARM_APPROACH':
            useBossGraph?'BOSS_GRAPH_TO_SAVED_FARM_END':
            useItinerary?'ITINERARY':sectionIndex;
          // Position is part of the one-attempt key: a real new Town
          // arrival may start a new trip; an unchanged failed trip does
          // not spin retry loops.
          const key=[shared.routeId,shared.modelVersion,self.map,routeStep,
            Math.round(Number(self.x)/35),Math.round(Number(self.y)/35)].join(':');
          if(state.merchantRouteAttempt?.key!==key||(nativeRoutes&&Date.now()>=(state.merchantRouteAttempt?.retryAt||0))){
            state.merchantRouteAttempt={key,ok:false,reason:'REQUESTED',retryAt:Date.now()+5000};
            // Returning from a cave/event boss uses the shortest connected
            // Rentaro graph, not the long merchant circuit or smart_move.
            const savedEnd=merchantRoutes?.section?.(23)?.points?.at(-1);
            const returnGoal=savedEnd?{map:savedEnd.map,
              x:savedEnd.x,y:savedEnd.y,stageRadius:nativeRoutes?15:32}:null;
            const bossPlan=useBossGraph&&returnGoal?
              merchantRoutes.planBossRoute(returnGoal):null;
            let walked=atSafeEnd?
              await merchantRoutes.followItinerary([{kind:'FARM_APPROACH'}]):
              useBossGraph&&bossPlan?.ok?
              await merchantRoutes.followBossRoute(returnGoal):
              useBossGraph?{ok:false,error:bossPlan?.error||
                'MERCHANT_FARM_RETURN_GRAPH_UNAVAILABLE'}:
              useItinerary?await merchantRoutes.followItinerary(itinerary):
              await merchantRoutes.followSection(sectionIndex);
            if(nativeRoutes&&!walked?.ok&&!atSafeEnd&&useItinerary&&returnGoal&&merchantRoutes?.planBossRoute?.(returnGoal)?.ok)
              walked=await merchantRoutes.followBossRoute(returnGoal);
            state.merchantRouteAttempt={
              key,ok:walked?.ok===true,retryAt:Date.now()+5000,
              reason:walked?.ok===true?'MERCHANT_ROUTE_ARRIVED':
                String(walked?.error||'MERCHANT_SHARED_ROUTE_FAILED'),
              sectionIndex:useItinerary?null:sectionIndex
            };
            if(walked?.ok===true){
              if(nativeRoutes&&atSafeEnd)state.stageReleased=true;
              state.last_progress=nativeRoutes&&!atSafeEnd?'MERCHANT_SAFE_END_ARRIVED':'MERCHANT_SHARED_ROUTE_ARRIVED';
              return{ok:true,progress:true,kind:'MERCHANT_SHARED_ROUTE_ARRIVED',
                routeId:shared.routeId,modelVersion:shared.modelVersion,
                status:snapshot()};
            }
          }
        }
        return{ok:true,progress:false,reason:'MERCHANT_SHARED_ROUTE_TO_FARM_REQUIRED',
          routeId:shared.routeId,modelVersion:shared.modelVersion,
          routeAttempt:clone(state.merchantRouteAttempt),status:snapshot()};
      }
    }

    // At the shared Merchant farm destination, do NOT start Warrior mob
    // rotation until Souji is physically nearby. The journey is
    // independent of its final combat admission.
    if(!ready.ok){
      if(nativeRoutes)state.stageReleased=false;
      state.phase='WAIT_TEAM_AT_FARM';state.target_id=null;
      combat.release('FARM');targeting.release('FARM');
      return{ok:true,progress:false,reason:'WAIT_TEAM_AT_MERCHANT_FARM_END',
        details:ready,status:snapshot()};
    }

    if(name==='Harutora'&&warriorPosition&&Number(warriorPosition.max_hp)>0&&Number(warriorPosition.hp)/Number(warriorPosition.max_hp)<=.65){
      state.phase='WAIT_WARRIOR_RECOVERY';state.target_id=null;combat.release('FARM');targeting.release('FARM');movement.release('FARM');
      return{ok:true,progress:false,reason:'WARRIOR_RECOVERY_NO_ADDITIONAL_AGGRO',status:snapshot()};
    }
    if(nativeRoutes&&name==='Hibari'){state.phase='FARM_MOB';if(Date.now()-state.lastOrbitAt>=250)orbitTick();}
    if(casterActions)await casterActions.upkeep();
    targeting.observe(liveEntities(ctx));
    let target=null;
    if(nativeRoutes&&name==='Hibari'){
      // V2 selects the weakest engaged mob on each combat pass; prefer an
      // in-range member of the same pool so a distant target cannot stall hits.
      const crew=new Set(['Rentaro','Hibari','Souji','Harutora']);
      const raw=liveEntities(ctx);
      const eligible=e=>e&&e.type==='monster'&&e.visible!==false&&!e.dead&&!e.rip&&Number(e.hp)>0&&monsters.has(String(e.mtype))&&e.cooperative!==true;
      const candidates=Object.entries(raw).filter(([,e])=>eligible(e));
      const engaged=candidates.filter(([,e])=>crew.has(String(e.target||'')));
      const pool=engaged.length?engaged:candidates.filter(([,e])=>!e.target);
      const actor=root?.character||{};
      const range=e=>{try{return typeof root.is_in_range==='function'?root.is_in_range(e)===true:Math.hypot(Number(e.real_x??e.x)-Number(actor.real_x??actor.x),Number(e.real_y??e.y)-Number(actor.real_y??actor.y))<=Number(actor.range||0)}catch{return false}};
      const close=pool.filter(([,e])=>range(e));
      const chosen=(close.length?close:pool).sort((a,b)=>Number(a[1].hp)-Number(b[1].hp)||Math.hypot(Number(a[1].x)-Number(actor.x),Number(a[1].y)-Number(actor.y))-Math.hypot(Number(b[1].x)-Number(actor.x),Number(b[1].y)-Number(actor.y)))[0];
      if(chosen&&targeting.acquire('FARM',chosen[0],{priority}).ok){state.target_id=chosen[0];target={id:chosen[0],entity:chosen[1]};}
      else{state.target_id=null;targeting.release('FARM');}
    }else if(state.target_id){
      const auth=targeting.authorize('FARM',state.target_id);
      if(auth.ok)target={id:state.target_id,entity:auth.target};
      else state.target_id=null;
    }
    if(!target&&!(nativeRoutes&&name==='Hibari')){
      const selected=targeting.select({
        predicate:e=>monsters.has(String(e.mtype||''))&&e.cooperative!==true,
        score:e=>['Harutora','Souji'].includes(name)&&Number.isFinite(Number(e.hp))?-Number(e.hp):-(Number(e.distance)||0)
      });
      if(selected){
        const lease=targeting.acquire('FARM',selected.id,{priority});
        if(lease.ok){state.target_id=selected.id;target=selected;}
      }
    }

    if(!target){
      state.phase=nativeRoutes&&name==='Hibari'?'FARM_MOB':'POSITION';
      if(!farmPosition){
        // A running scheduler is not a route. Only an explicitly configured
        // farm destination can transition a fighter from assembly to travel.
        return{ok:true,progress:false,reason:'FARM_DESTINATION_NOT_CONFIGURED',status:snapshot()};
      }
      if(nativeRoutes||ctx.atFarmPosition===true)return{ok:true,progress:false,reason:'NO_FARM_TARGET',status:snapshot()};
      if(ctx.farmRouteApproved!==true){
        return{ok:true,progress:false,reason:'FARM_REGROUP_ROUTE_NOT_VERIFIED',status:snapshot()};
      }
      // Never invoke a direct move into another map. Cross-map routing and
      // safe-zone attestation belong to First State, not this combat tick.
      const self=typeof party.get==='function'?party.get(name):null;
      if(!self||!self.map||!farmPosition.map||String(self.map)!==String(farmPosition.map)){
        return{ok:true,progress:false,reason:'FARM_REGROUP_ROUTE_NOT_VERIFIED',status:snapshot()};
      }
      const own=movement.acquire('FARM',{priority});
      if(own.ok){
        const moved=await movement.move('FARM',farmPosition);
        if(moved.ok){state.last_progress='MOVE_TO_FARM';return{ok:true,progress:true,kind:'FARM_MOVE',status:snapshot()};}
      }
      return{ok:true,progress:false,reason:'FARM_MOVE_NOT_AVAILABLE',status:snapshot()};
    }

    const distance=Number(target.entity&&target.entity.distance);
    if(Number.isFinite(distance)&&distance>attackRange){
      if(nativeRoutes&&name==='Hibari'){state.phase='FARM_MOB';state.target_id=null;targeting.release('FARM');return{ok:true,progress:false,reason:'WARRIOR_ORBIT_CONTINUES_NO_TARGET_CHASE',status:snapshot()};}
      state.phase='POSITION';
      const own=movement.acquire('FARM',{priority});
      if(own.ok&&target.entity&&Number.isFinite(Number(target.entity.x))&&Number.isFinite(Number(target.entity.y))){
        const goal={x:Number(target.entity.x),y:Number(target.entity.y)};
        if(nativeRoutes&&name==='Hibari'&&farmPosition&&Math.hypot(goal.x-farmPosition.x,goal.y-farmPosition.y)>farmRadius){movement.release('FARM');state.target_id=null;targeting.release('FARM');return{ok:true,progress:false,reason:'TARGET_OUTSIDE_FARM_AREA',status:snapshot()};}
        const moved=await movement.move('FARM',goal);
        if(moved.ok){state.last_progress='CLOSE_TARGET';return{ok:true,progress:true,kind:'FARM_MOVE',target:state.target_id,status:snapshot()};}
      }
      return{ok:true,progress:false,reason:'TARGET_OUT_OF_RANGE',status:snapshot()};
    }

    if(name==='Harutora'){
      const claim=await mageAntiKsZap(target,ctx);
      if(claim)return claim;
    }
    state.phase=name==='Hibari'?'FARM_MOB':'COMBAT';
    const own=combat.acquire('FARM',{priority});
    if(!own.ok)return{ok:true,progress:false,reason:'COMBAT_PREEMPTED',status:snapshot()};

    if(name==='Hibari'&&(!controller||!actionExecutor||!fighter||
       typeof fighter.snapshot!=='function')){
      state.target_id=null;combat.release('FARM');targeting.release('FARM');
      state.phase='FARM_MOB_WAIT_ROTATION';
      return{ok:true,progress:false,reason:'WARRIOR_MOB_ROTATION_DEPENDENCY_MISSING',
        status:snapshot()};
    }
    const warrior=await tickWarrior(target);
    if(warrior){
      if(!warrior.ok){
        state.last_error=warrior.error;
        return{ok:false,error:warrior.error,detail:warrior,status:snapshot()};
      }
      state.last_error=null;
      if(warrior.progress)state.last_progress='WARRIOR_MOB_ROTATION';
      return{...warrior,status:snapshot()};
    }

    if(casterActions){
      const action=await casterActions.tick({target,partyReady:ready.ok,healingHold:()=>priestHealingMonitor?.holdForHealing?.()===true});
      if(action)return{ok:action.ok===true,progress:action.ok===true&&!action.hold,kind:'CASTER_FARM_ACTION',...action,status:snapshot()};
    }
    const attacked=await combat.attack('FARM',state.target_id);
    if(!attacked.ok){
      state.last_error=attacked.error;
      return{ok:false,error:attacked.error,status:snapshot()};
    }
    state.last_error=null;
    state.last_progress='ATTACK';
    state.farmEngaged=true;
    return{ok:true,progress:true,kind:'FARM_ATTACK',target:state.target_id,status:snapshot()};
  }

  return{start,pause,resume,stop,health,snapshot,restore,tick,getStatus:snapshot};
}

module.exports={resolveRequiredParty,defaultWarriorMiniState,createFarmState};

},{"../../characters/warrior/WarriorV2Tactics":"characters/warrior/WarriorV2Tactics.js","../../core/policy/AntiKsPolicy":"core/policy/AntiKsPolicy.js","../../characters/mage/Spells":"characters/mage/Spells.js"}],
"organs/gear/GearControlPlane.js":[function(require,module,exports){
'use strict';

const registry=require('./GearRegistry');
const {destination,validateResolvedDeposit}=require('../bank/BankDestinations');
const characterWhitelist=require('../../core/policy/CharacterWhitelist');
const handoffPolicy=require('../../ligaments/gear/GearHandoffPolicy');

function quantityOf(value,id){
  if(Array.isArray(value))return value.reduce((n,x)=>n+quantityOf(x,id),0);
  if(!value||typeof value!=='object')return 0;
  if(value.name===id)return Number(value.q||1);
  return Object.values(value).reduce((n,x)=>n+quantityOf(x,id),0);
}
function sourceMaterial(id,{inventory=[],bank=[],npcStock={}}={}){
  id=String(id||'');
  if(!id||id==='NONE')return{ok:true,source:'NONE',item:id};
  if(quantityOf(inventory,id)>0)return{ok:true,source:'INVENTORY',item:id};
  if(quantityOf(bank,id)>0)return{ok:true,source:'BANK',item:id};
  const rule=registry.MATERIALS[id]; const npc=rule&&rule.npcFallback; const stock=npcStock&&npcStock[id];
  if(npc&&npc.verified===true&&stock&&stock.verified===true&&Number(stock.quantity||0)>0&&stock.npc===npc.npc){
    return{ok:true,source:'NPC',item:id,npc:npc.npc};
  }
  return{ok:false,error:'MATERIAL_UNAVAILABLE',item:id};
}
function productionRuleFor(operation,item,variant){
  if(!['UPGRADE','COMPOUND'].includes(operation))return{ok:true,rule:null};
  if(variant==='SHINY'){
    if(registry.SHINY.enabled!==true)return{ok:false,error:'SHINY_PROCESSING_DISABLED'};
    const shiny=registry.SHINY[item];
    if(!shiny||shiny.enabled===false||String(shiny.action||'').toUpperCase()!==operation)return{ok:false,error:'SHINY_PRODUCTION_RULE_UNAVAILABLE'};
    return{ok:true,rule:shiny};
  }
  if(variant!=='NORMAL')return{ok:false,error:'JOB_VARIANT_UNSAFE'};
  const rule=handoffPolicy.ruleFor(item);
  if(!rule)return{ok:false,error:'PRODUCTION_ITEM_NOT_WHITELISTED'};
  if(String(rule.operation||'').toUpperCase()!==operation)return{ok:false,error:'PRODUCTION_OPERATION_MISMATCH'};
  return{ok:true,rule};
}
function buildJob(input={}){
  const operation=String(input.operation||'').toUpperCase();
  if(!['UPGRADE','COMPOUND','EXCHANGE','BANK','SELL','KEEP'].includes(operation))return{ok:false,error:'JOB_OPERATION_INVALID'};
  const item=String(input.item||''); if(!item)return{ok:false,error:'JOB_ITEM_REQUIRED'};
  const variant=String(input.variant||'NORMAL').toUpperCase();
  const checked=productionRuleFor(operation,item,variant); if(!checked.ok)return checked;
  if(operation==='EXCHANGE'){
    const exchange=registry.EXCHANGE[item];
    if(!exchange||exchange.enabled!==true)return{ok:false,error:'EXCHANGE_ITEM_NOT_ENABLED'};
  }
  if(operation==='SELL'){
    const decision=registry.sellDecision({name:item,level:input.level,p:input.p});
    if(decision.action!=='SELL')return{ok:false,error:'SELL_POLICY_REJECTED',reason:decision.reason};
  }
  const rule=checked.rule;
  const target=input.target==null?(rule&&rule.target!=null?Number(rule.target):registry.DEFAULT_TARGETS[operation]):Number(input.target);
  if(['UPGRADE','COMPOUND'].includes(operation)&&(!Number.isInteger(target)||target<0))return{ok:false,error:'JOB_TARGET_INVALID'};
  const after=String(input.after||(rule&&rule.after)||'BANK').toUpperCase();
  if(!['BANK','KEEP','SELL'].includes(after))return{ok:false,error:'JOB_AFTER_INVALID'};
  const bankDestination=String(input.destination||(rule&&rule.destination)||'AUTO_POLICY').toUpperCase();
  if(after==='BANK'&&!destination(bankDestination))return{ok:false,error:'BANK_DESTINATION_UNKNOWN'};
  const scroll=String(input.scroll||(rule&&rule.scroll)||'AUTO');
  const offering=String(input.offering||(rule&&rule.offering)||'NONE');
  return{
    ok:true,
    job:{
      owner:'V3_GEAR_CONTROL_PLANE',
      operation,item,target:target==null?null:target,variant,
      scope:String(input.scope||'ACCOUNT_ALL').toUpperCase(),
      mode:String(input.mode||'ALL_MATCHING').toUpperCase(),
      scroll,offering,after,destination:bankDestination,
      sourceOrder:['INVENTORY','BANK','VERIFIED_NPC'],
      execution:'ONE_ITEM_THEN_RESCAN',
      itemResolution:'RELOCATE_IMMEDIATELY_BEFORE_EACH_MUTATION',
      runtimeConnected:false
    }
  };
}
function buildTransferJob(input={}){
  const planned=characterWhitelist.planTransfer({
    sender:input.sender,
    receiver:input.receiver,
    item:input.item,
    mode:input.mode,
    authorization:input.authorization,
    requestedBy:input.requestedBy
  });
  if(!planned.ok)return planned;
  return{
    ok:true,
    job:{
      owner:'V3_GEAR_CONTROL_PLANE',
      operation:'TRANSFER',
      sender:planned.sender,
      receiver:planned.receiver,
      selector:planned.selector,
      manualOverride:planned.manualOverride===true,
      audit:planned.audit||null,
      itemResolution:'RELOCATE_IMMEDIATELY_BEFORE_EACH_MUTATION',
      verifyReceiverAfter:true,
      sourceContract:planned.sourceContract,
      runtimeConnected:false
    }
  };
}

function normalizeAttempt(input={}){
  const result=input.result||{}; const operation=String(input.operation||'').toUpperCase(); const rollOperation=['UPGRADE','COMPOUND'].includes(operation);
  const base={item:String(input.item||''),operation,after:String(input.after||'BANK').toUpperCase(),destination:String(input.destination||'AUTO_POLICY').toUpperCase()};
  if(result.rejected===true)return{ok:true,attempt:{...base,status:'FAILED_TO_START',rolled:false,deposit:null,reason:String(result.reason||'REQUEST_REJECTED')}};
  if(result.success===false)return{ok:true,attempt:{...base,status:rollOperation?'ROLLED_FAILURE':'OPERATION_FAILURE',rolled:rollOperation,deposit:null,reason:String(result.reason||'OPERATION_FAILED')}};
  if(result.success!==true)return{ok:false,error:'ATTEMPT_RESULT_UNPROVEN'};
  if(base.after==='BANK'){
    const checked=validateResolvedDeposit(base.destination,input.resolvedDeposit||{});
    if(!checked.ok)return{ok:false,error:checked.error,detail:checked};
    return{ok:true,attempt:{...base,status:'SUCCESS',rolled:rollOperation,deposit:checked,reason:null}};
  }
  return{ok:true,attempt:{...base,status:'SUCCESS',rolled:rollOperation,deposit:null,reason:null}};
}
function summarizeAttempts(attempts=[]){
  const rows=(Array.isArray(attempts)?attempts:[]).filter(Boolean);
  const successful=rows.filter(x=>x.status==='SUCCESS').length;
  const failed=rows.filter(x=>['FAILED_TO_START','ROLLED_FAILURE','OPERATION_FAILURE'].includes(x.status)).length;
  const total=successful+failed;
  return{total,successful,failed,successRate:total?successful/total:0};
}
module.exports={quantityOf,sourceMaterial,buildJob,buildTransferJob,normalizeAttempt,summarizeAttempts};

},{"./GearRegistry":"organs/gear/GearRegistry.js","../bank/BankDestinations":"organs/bank/BankDestinations.js","../../core/policy/CharacterWhitelist":"core/policy/CharacterWhitelist.js","../../ligaments/gear/GearHandoffPolicy":"ligaments/gear/GearHandoffPolicy.js"}],
"organs/gear/GearProductionExecutor.js":[function(require,module,exports){
'use strict';

const GearControlPlane=require('./GearControlPlane');

const OWNER='GEAR_PRODUCTION';
const DEFAULT_PRIORITY=45;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function createGearProductionExecutor({
  inventory,
  movement,
  handoff,
  adapter=null,
  policy=GearControlPlane,
  priority=DEFAULT_PRIORITY,
  now=Date.now
}={}){
  if(!inventory||typeof inventory.find!=='function'||typeof inventory.slot!=='function'||typeof inventory.reserve!=='function'||typeof inventory.release!=='function'||typeof inventory.reservations!=='function'||typeof inventory.identity!=='function'){
    throw new Error('GEAR_EXECUTOR_INVENTORY_REQUIRED');
  }
  if(!movement||typeof movement.acquire!=='function'||typeof movement.smartMove!=='function'||typeof movement.release!=='function'){
    throw new Error('GEAR_EXECUTOR_MOVEMENT_REQUIRED');
  }
  if(!handoff||typeof handoff.status!=='function'||typeof handoff.acceptGearResult!=='function'){
    throw new Error('GEAR_EXECUTOR_HANDOFF_REQUIRED');
  }

  const state={
    version:3,
    state:'GEAR_PRODUCTION',
    phase:'STOPPED',
    paused:false,
    workId:null,
    operation:null,
    item:null,
    target:null,
    attempts:0,
    lastProgress:null,
    lastError:null,
    startedAt:null,
    updatedAt:Number(now())
  };

  function touch(){state.updatedAt=Number(now());}
  function snapshot(){return clone(state);}
  function executionReady(){
    return !!(
      adapter&&
      typeof adapter.ready==='function'&&adapter.ready()===true&&
      typeof adapter.itemGrade==='function'&&
      typeof adapter.queueStatus==='function'&&
      typeof adapter.buy==='function'&&
      typeof adapter.upgrade==='function'&&
      typeof adapter.compound==='function'
    );
  }

  async function start(){
    state.paused=false;
    state.phase='PRECHECK';
    state.lastError=null;
    state.startedAt=Number(now());
    touch();
    return{ok:true,status:snapshot(),executor_ready:executionReady()};
  }
  async function pause(){
    state.paused=true;
    state.phase='PAUSED';
    movement.release(OWNER);
    touch();
    return{ok:true,status:snapshot()};
  }
  async function resume(){
    state.paused=false;
    state.phase='PRECHECK';
    touch();
    return{ok:true,status:snapshot()};
  }
  async function stop(){
    movement.release(OWNER);
    state.paused=false;
    state.phase='STOPPED';
    touch();
    return{ok:true,status:snapshot()};
  }
  async function health(){
    return{
      ok:state.lastError==null,
      executor_ready:executionReady(),
      status:snapshot()
    };
  }
  async function restore(saved){
    if(!saved||saved.version!==3||saved.state!=='GEAR_PRODUCTION')throw new Error('GEAR_EXECUTOR_SNAPSHOT_INVALID');
    Object.assign(state,clone(saved));
    state.phase=state.phase==='STOPPED'?'STOPPED':'PRECHECK';
    state.paused=false;
    touch();
    return{ok:true,status:snapshot()};
  }

  function activeHandoff(){
    const active=handoff.status();
    if(!active)return{ok:false,error:'GEAR_HANDOFF_NOT_ACTIVE'};
    if(active.phase!=='READY_FOR_GEAR')return{ok:false,error:'GEAR_HANDOFF_NOT_READY',phase:active.phase,active};
    if(!active.job||!active.work)return{ok:false,error:'GEAR_HANDOFF_JOB_MISSING',active};
    return{ok:true,active};
  }

  function reservationsBySlot(){
    return new Map((inventory.reservations()||[]).map(row=>[Number(row.slot),row]));
  }

  async function verifyStaged(active){
    const job=active.job||{};
    const slots=(job.stagedSlots||[]).map(Number);
    const identities=(job.stagedIdentities||[]).map(String);
    const expected=Number(job.expectedInputCount||0);
    if(!slots.length||slots.length!==identities.length||slots.length!==expected){
      return{ok:false,error:'GEAR_STAGED_SLOT_CONTRACT_INVALID',slots,identities,expected};
    }
    const reservations=reservationsBySlot();
    const rows=[];
    for(let i=0;i<slots.length;i++){
      const slot=slots[i],expectedIdentity=identities[i];
      const reservation=reservations.get(slot);
      if(!reservation||reservation.owner!==OWNER){
        return{ok:false,error:'GEAR_STAGED_RESERVATION_MISSING',slot,reservation:clone(reservation||null)};
      }
      const item=await inventory.slot(slot);
      if(!item)return{ok:false,error:'GEAR_STAGED_ITEM_MISSING',slot};
      const actual=inventory.identity(item);
      if(actual!==expectedIdentity){
        return{ok:false,error:'GEAR_STAGED_IDENTITY_CHANGED',slot,expected:expectedIdentity,actual};
      }
      if(String(item.name||'')!==String(job.item||'')){
        return{ok:false,error:'GEAR_STAGED_ITEM_NAME_MISMATCH',slot,expected:String(job.item||''),actual:String(item.name||'')};
      }
      rows.push({slot,item:clone(item),identity:actual});
    }
    return{ok:true,rows};
  }

  function scrollName(job,item){
    const explicit=String(job.scroll||'AUTO');
    if(explicit!=='AUTO')return{ok:true,name:explicit};
    const grade=Number(adapter.itemGrade(item));
    if(!Number.isFinite(grade)||grade<0)return{ok:false,error:'GEAR_ITEM_GRADE_UNAVAILABLE'};
    const safeGrade=Math.max(0,Math.min(2,Math.trunc(grade)));
    return{ok:true,name:(job.operation==='COMPOUND'?'cscroll':'scroll')+safeGrade,grade:safeGrade};
  }

  async function reserveSupply(name){
    const id=String(name||'');
    if(!id||id==='NONE')return{ok:true,slot:null,name:id,reservation:null};
    let found=await inventory.find(id);
    if(!found.length)return{ok:false,error:'GEAR_SUPPLY_NOT_FOUND',item:id};
    const row=found[0];
    const reserved=await inventory.reserve(row.slot,OWNER,{expected:row.identity});
    if(!reserved||reserved.ok!==true)return{ok:false,error:reserved&&reserved.error||'GEAR_SUPPLY_RESERVE_FAILED',item:id,slot:row.slot};
    return{ok:true,slot:Number(row.slot),name:id,reservation:clone(reserved.reservation)};
  }

  async function ensureScroll(job,item){
    const named=scrollName(job,item);
    if(!named.ok)return named;
    let found=await inventory.find(named.name);
    if(!found.length){
      const bought=await adapter.buy(named.name,1);
      if(!bought||bought.ok!==true)return{ok:false,error:'GEAR_SCROLL_BUY_FAILED',scroll:named.name,detail:clone(bought)};
      found=await inventory.find(named.name);
      if(!found.length)return{ok:false,error:'GEAR_SCROLL_BUY_UNVERIFIED',scroll:named.name};
    }
    const row=found[0];
    const reserved=await inventory.reserve(row.slot,OWNER,{expected:row.identity});
    if(!reserved||reserved.ok!==true)return{ok:false,error:reserved&&reserved.error||'GEAR_SCROLL_RESERVE_FAILED',scroll:named.name,slot:row.slot};
    return{ok:true,name:named.name,slot:Number(row.slot),reservation:clone(reserved.reservation)};
  }

  async function finishAsFailure(active,reason,detail=null){
    state.lastError=null;
    state.lastProgress='GEAR_RESULT_NEEDS_RESCAN';
    state.phase='COMPLETE';
    touch();
    const accepted=await handoff.acceptGearResult({
      workId:active.id,
      success:false,
      reason:String(reason||'GEAR_OPERATION_FAILED')
    });
    if(!accepted||accepted.ok!==true){
      state.lastError=accepted&&accepted.error||'GEAR_HANDOFF_FAILURE_REPORT_FAILED';
      touch();
      return{ok:false,error:state.lastError,detail:clone(detail),status:snapshot()};
    }
    return{
      ok:true,
      progress:true,
      complete:true,
      kind:'GEAR_PRODUCTION_RESULT',
      reason:'GEAR_ATTEMPT_NEEDS_BANK_RESCAN',
      operation:active.job.operation,
      item:active.job.item,
      result:{success:false,reason:String(reason||'GEAR_OPERATION_FAILED'),detail:clone(detail)},
      status:snapshot()
    };
  }

  async function run(){
    state.attempts++;
    touch();
    if(state.paused)return{ok:true,progress:false,reason:'GEAR_EXECUTOR_PAUSED',status:snapshot()};
    if(!executionReady()){
      state.lastError='GEAR_EXECUTOR_NOT_READY';
      touch();
      return{ok:false,error:state.lastError,status:snapshot()};
    }

    const h=activeHandoff();
    if(!h.ok){
      state.lastError=h.error;
      touch();
      return{ok:false,error:h.error,phase:h.phase||null,status:snapshot()};
    }
    const active=h.active,job=active.job;
    state.workId=String(active.id);
    state.operation=String(job.operation||'');
    state.item=String(job.item||'');
    state.target=Number(job.target);
    state.phase='PRECHECK';
    state.lastError=null;
    touch();

    const queued=adapter.queueStatus();
    if(queued&&queued.busy===true){
      state.lastProgress='WAIT_QUEUE';
      touch();
      return{ok:true,progress:false,reason:'GEAR_NATIVE_QUEUE_BUSY',queue:clone(queued),status:snapshot()};
    }

    const staged=await verifyStaged(active);
    if(!staged.ok)return finishAsFailure(active,staged.error,staged);
    const beforeLevel=Number(staged.rows[0].item.level||0);
    if(beforeLevel>=Number(job.target)){
      const accepted=await handoff.acceptGearResult({
        workId:active.id,
        success:true,
        outputs:[{inventorySlot:staged.rows[0].slot,item:staged.rows[0].item,identity:staged.rows[0].identity}]
      });
      if(!accepted||accepted.ok!==true)return{ok:false,error:accepted&&accepted.error||'GEAR_ALREADY_TARGET_HANDOFF_FAILED',status:snapshot()};
      state.phase='COMPLETE';
      state.lastProgress='TARGET_ALREADY_REACHED';
      touch();
      return{ok:true,progress:true,complete:true,kind:'GEAR_PRODUCTION_RESULT',reason:'GEAR_TARGET_ALREADY_REACHED',status:snapshot()};
    }

    state.phase='TRAVEL';
    touch();
    const lease=movement.acquire(OWNER,{priority:Number(priority)||DEFAULT_PRIORITY});
    if(!lease||lease.ok!==true){
      state.lastProgress='WAIT_MOVEMENT';
      touch();
      return{ok:true,progress:false,reason:'GEAR_MOVEMENT_PREEMPTED',detail:clone(lease),status:snapshot()};
    }
    const moved=await movement.smartMove(OWNER,'upgrade');
    movement.release(OWNER);
    if(!moved||moved.ok!==true){
      state.lastError=moved&&moved.error||'GEAR_UPGRADE_TRAVEL_FAILED';
      touch();
      return{ok:false,error:state.lastError,detail:clone(moved),status:snapshot()};
    }

    state.phase='SUPPLIES';
    state.lastProgress='AT_UPGRADE_NPC';
    touch();

    const scroll=await ensureScroll(job,staged.rows[0].item);
    if(!scroll.ok)return finishAsFailure(active,scroll.error,scroll);

    let offering={ok:true,slot:null,name:'NONE'};
    if(String(job.offering||'NONE')!=='NONE'){
      offering=await reserveSupply(job.offering);
      if(!offering.ok){
        inventory.release(scroll.slot,OWNER);
        return finishAsFailure(active,offering.error,offering);
      }
    }

    const queuedAgain=adapter.queueStatus();
    if(queuedAgain&&queuedAgain.busy===true){
      inventory.release(scroll.slot,OWNER);
      if(offering.slot!=null)inventory.release(offering.slot,OWNER);
      state.lastProgress='WAIT_QUEUE_AFTER_SUPPLIES';
      touch();
      return{ok:true,progress:false,reason:'GEAR_NATIVE_QUEUE_BUSY',queue:clone(queuedAgain),status:snapshot()};
    }

    state.phase='EXECUTE';
    touch();
    let native;
    try{
      if(job.operation==='UPGRADE'){
        native=await adapter.upgrade(staged.rows[0].slot,scroll.slot,offering.slot);
      }else if(job.operation==='COMPOUND'){
        native=await adapter.compound(staged.rows.map(x=>x.slot),scroll.slot,offering.slot);
      }else{
        inventory.release(scroll.slot,OWNER);
        if(offering.slot!=null)inventory.release(offering.slot,OWNER);
        return finishAsFailure(active,'GEAR_OPERATION_UNSUPPORTED',{operation:job.operation});
      }
    }catch(error){
      inventory.release(scroll.slot,OWNER);
      if(offering.slot!=null)inventory.release(offering.slot,OWNER);
      return finishAsFailure(active,'GEAR_NATIVE_EXCEPTION',{message:String(error&&error.message||error)});
    }

    inventory.release(scroll.slot,OWNER);
    if(offering.slot!=null)inventory.release(offering.slot,OWNER);

    if(!native||native.ok!==true){
      return finishAsFailure(active,native&&native.error||'GEAR_NATIVE_CALL_FAILED',native);
    }
    const result=native.result&&typeof native.result==='object'?native.result:native;
    if(result.success!==true){
      return finishAsFailure(active,result.reason||'GEAR_ROLL_FAILED',result);
    }

    state.phase='VERIFY';
    touch();
    const outputs=[];
    if(job.operation==='UPGRADE'){
      const current=await inventory.slot(staged.rows[0].slot);
      if(current&&String(current.name||'')===String(job.item||'')){
        const level=Number(current.level||0);
        if(level>beforeLevel){
          outputs.push({inventorySlot:staged.rows[0].slot,item:clone(current),identity:inventory.identity(current)});
        }
      }
    }else{
      for(const row of staged.rows){
        const current=await inventory.slot(row.slot);
        if(current&&String(current.name||'')===String(job.item||'')){
          outputs.push({inventorySlot:row.slot,item:clone(current),identity:inventory.identity(current)});
        }
      }
      if(outputs.length===1&&Number(outputs[0].item.level||0)<=beforeLevel)outputs.length=0;
    }

    if(outputs.length!==1){
      return finishAsFailure(active,'GEAR_OUTPUT_VERIFY_FAILED',{operation:job.operation,outputs});
    }

    const accepted=await handoff.acceptGearResult({
      workId:active.id,
      success:true,
      outputs
    });
    if(!accepted||accepted.ok!==true){
      state.lastError=accepted&&accepted.error||'GEAR_HANDOFF_RESULT_REJECTED';
      touch();
      return{ok:false,error:state.lastError,detail:clone(accepted),status:snapshot()};
    }

    state.phase='COMPLETE';
    state.lastProgress='GEAR_ATTEMPT_VERIFIED';
    state.lastError=null;
    touch();
    return{
      ok:true,
      progress:true,
      complete:true,
      kind:'GEAR_PRODUCTION_RESULT',
      reason:'GEAR_ATTEMPT_VERIFIED',
      operation:job.operation,
      item:job.item,
      target:Number(job.target),
      output:clone(outputs[0]),
      native:clone(result),
      status:snapshot()
    };
  }

  return{
    policy,
    executionReady,
    start,pause,resume,stop,health,snapshot,restore,
    run,getStatus:snapshot
  };
}

module.exports={OWNER,DEFAULT_PRIORITY,createGearProductionExecutor};

},{"./GearControlPlane":"organs/gear/GearControlPlane.js"}],
"organs/gear/GearRegistry.js":[function(require,module,exports){
'use strict';

const JackoRetentionPolicy=require('./JackoRetentionPolicy');
const DEFAULT_TARGETS=Object.freeze({UPGRADE:7,COMPOUND:3});
const DEFAULT_SHINY_ENABLED=false;
const PRODUCTION=Object.freeze({
  fireblade:Object.freeze({operation:'UPGRADE',target:7,scroll:'AUTO',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'}),
  firestaff:Object.freeze({operation:'UPGRADE',target:7,scroll:'AUTO',offering:'offeringp',after:'BANK',destination:'AUTO_POLICY'}),
  bataxe:Object.freeze({operation:'UPGRADE',target:7,scroll:'scroll1',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'}),
  oozingterror:Object.freeze({operation:'UPGRADE',target:7,scroll:'AUTO',offering:'offering',after:'BANK',destination:'AUTO_POLICY',enabled:false}),
  dexring:Object.freeze({operation:'COMPOUND',target:3,scroll:'AUTO',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'}),
  intring:Object.freeze({operation:'COMPOUND',target:3,scroll:'AUTO',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'}),
  strring:Object.freeze({operation:'COMPOUND',target:3,scroll:'AUTO',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'}),
  wbook1:Object.freeze({operation:'COMPOUND',target:3,scroll:'cscroll1',offering:'NONE',after:'BANK',destination:'AUTO_POLICY'})
});
const SHINY=Object.freeze({
  enabled:DEFAULT_SHINY_ENABLED,
  fireblade:Object.freeze({action:'UPGRADE',target:7,scroll:'AUTO',offering:'offeringp',after:'BANK',destination:'CHRISTIE'}),
  firestaff:Object.freeze({action:'UPGRADE',target:7,scroll:'AUTO',offering:'NONE',after:'BANK',destination:'CHRISTIE',enabled:false})
});
const MATERIALS=Object.freeze({
  offeringp:Object.freeze({displayName:'Primling',npcFallback:null}),
  offering:Object.freeze({displayName:'Primordial Essence',npcFallback:Object.freeze({verified:true,npc:'Garwyn'})}),
  offeringx:Object.freeze({displayName:'Primordial X',npcFallback:null})
});
const EXCHANGE=Object.freeze({
  weaponbox:Object.freeze({enabled:true,outputs:Object.freeze({
    fireblade:Object.freeze({action:'UPGRADE',target:7}),
    bataxe:Object.freeze({action:'BANK',destination:'WEAPONS'}),
    spear:Object.freeze({action:'SELL'})
  })}),
  armorbox:Object.freeze({enabled:true,outputs:Object.freeze({
    gcape:Object.freeze({action:'UPGRADE',target:7}),
    hboots:Object.freeze({action:'BANK',destination:'GEAR'})
  })}),
  lostearring:Object.freeze({enabled:false,outputs:Object.freeze({lostearring:Object.freeze({action:'COMPOUND',target:3})})})
});
// Stable V2 Rentaro canonical sell whitelist; remove duplicate names.
const SELL_ITEMS=Object.freeze(["glolipop","helmet","shoes","pants","gloves","coat","xmace","hpamulet","hpbelt","ringsj","stinger","snowball","carrotsword","slimestaff","spores","beewings","gslime","whiteegg","xmasshoes","xmashat","warmscarf","xmaspants","rednose","xmassweater","snowflakes","merry","crabclaw","cclaw","sstinger","carrot","mushroomstaff","intamulet","dexamulet","stramulet","vitring","pstem","smush","bcandle","bwing","phelmet","smoke","gphelmet","wattire","wgloves","wshoes","wbreeches","wcap","frankypants","mcape","quiver","cshell","gloves1","coat1","helmet1","pants1","shoes1","rattail","frogt","eears","epyjamas","eslippers","ecape","pmace","spear","basher","wbook0","harbringer","vitearring","iceskates","bandages","t2bow","firecrackers","btusk","lantern","skullamulet","talkingskull","hpants","wbasher"]);
const SHARED_KEEP=Object.freeze(['hpot0','hpot1','mpot0','mpot1','tracker','computer','supercomputer','stand0','stand1','stand2','candypop','elixirint0','elixirstr0','elixirdex0','luckbooster','xpbooster','goldbooster','zapper','ololipop','broom','angelwings','gcape','jacko','pumpkinspice','xptome','quiver','firestaff','oozingterror','bataxe','vhammer','fireblade','basher','glolipop']);
const V2_BANK_BEFORE_SALE=new Set(['bwing','rattail','skullamulet','smush','talkingskull']);
function crewProtected(item,character){
 if(!item?.name||item.l||item.locked||item.p!=null)return true;
 const name=String(item.name),level=Number(item.level||0);
 if(!Number.isFinite(level)||level<0)return true;
 if(name==='jacko'||name==='pumpkinspice'||name==='wbasher'&&level>=3)return true;
 if(character==='Rentaro')return ['hpot0','hpot1','mpot0','mpot1','tracker','computer','supercomputer','stand0','stand1','stand2','broom','angelwings','gcape','luckbooster','xpbooster','goldbooster'].includes(name);
 return SHARED_KEEP.includes(name);
}
function transferDecision(item,character,inventory=[],slots={}){
 if(!item?.name||item.l||item.locked||item.p!=null||character==='Rentaro')return false;
 if(character==='Hibari'&&item.name==='fireblade'&&Number(item.level||0)<9){
  const high=[...inventory,...Object.values(slots||{})].filter(x=>x?.name==='fireblade'&&Number(x.level||0)>=9).length;
  return high>=2;
 }
 if(crewProtected(item,character)||Number(item.level||0)>0)return false;
 return sellDecision(item,{character}).action!=='SELL';
}
const CHARACTER_RULES=Object.freeze({
  Rentaro:Object.freeze({role:'Merchant',keep:Object.freeze(['hpot1','mpot1','tracker','computer']),loadout:Object.freeze(['broom','jacko +3'])}),
  Harutora:Object.freeze({role:'Mage',keep:Object.freeze(['hpot1','mpot1','tracker','computer','pumpkinspice','zapper']),loadout:Object.freeze(['broom','firestaff','angelwings','gcape'])}),
  Hibari:Object.freeze({role:'Warrior',keep:Object.freeze(['hpot1','mpot1','tracker','computer']),loadout:Object.freeze(['wbasher +3','vhammer','fireblade','bataxe'])}),
  Souji:Object.freeze({role:'Priest',keep:Object.freeze(['hpot1','mpot1','tracker','computer']),loadout:Object.freeze(['zapper'])})
});
function isShiny(item){return !!(item&&item.p==='shiny');}
function sellDecision(item,context={}){
  if(!item||!item.name)return{action:'HOLD',reason:'ITEM_INVALID'};
  const character=typeof context.character==='string'?context.character:context.character?.name||'Rentaro';
  if(crewProtected(item,character))return{action:'KEEP',reason:'CREW_PROTECTED'};
  if(V2_BANK_BEFORE_SALE.has(item.name))return{action:'HOLD',reason:'V2_BANK_BEFORE_SALE'};
  if(/scroll/i.test(item.name)||PRODUCTION[item.name]&&PRODUCTION[item.name].enabled!==false)return{action:'KEEP',reason:'PRODUCTION_OR_SCROLL'};
  const level=Number(item.level||0);
  if(level>0&&item.name!=='wbasher')return{action:'KEEP',reason:'UPGRADED_EQUIPMENT'};
  if(item.name==='wbasher'){
    if(level===3)return{action:'KEEP',reason:'WARRIOR_STOMP_RESERVED'};
    if(level<3)return{action:'SELL',reason:'WBASHER_BELOW_PLUS3'};
    return{action:'KEEP',reason:'WBASHER_ABOVE_PLUS3_SAFE_DEFAULT'};
  }
  if(SELL_ITEMS.includes(item.name))return{action:'SELL',reason:'SELL_REGISTRY'};
  return{action:'HOLD',reason:'NO_SELL_RULE'};
}
function productionDecision(item,{shinyEnabled=DEFAULT_SHINY_ENABLED,character=null,inventory=null,index=-1}={}){
  if(JackoRetentionPolicy.isJacko(item)){
    const verdict=JackoRetentionPolicy.actionAllowed({character,inventory,index,action:'UPGRADE'});
    return{action:'HOLD',reason:verdict.allowed?'JACKO_MANUAL_EXTRA_ONLY':verdict.reason};
  }
  if(!item||!item.name)return{action:'HOLD',reason:'ITEM_INVALID'};
  if(isShiny(item)&&shinyEnabled!==true)return{action:'KEEP',reason:'SHINY_PROTECTED'};
  const rule=PRODUCTION[item.name];
  if(!rule||rule.enabled===false)return{action:'HOLD',reason:'NO_ACTIVE_PRODUCTION_RULE'};
  const level=Number(item.level||0);
  if(level>=rule.target)return{action:rule.after||'BANK',reason:'TARGET_REACHED',destination:rule.destination||'AUTO_POLICY',rule};
  return{action:rule.operation,reason:'PRODUCTION_RULE',rule};
}
module.exports={JackoRetentionPolicy,DEFAULT_TARGETS,DEFAULT_SHINY_ENABLED,PRODUCTION,SHINY,MATERIALS,EXCHANGE,SELL_ITEMS,SHARED_KEEP,CHARACTER_RULES,isShiny,crewProtected,transferDecision,sellDecision,productionDecision};

},{"./JackoRetentionPolicy":"organs/gear/JackoRetentionPolicy.js"}],
"organs/gear/JackoRetentionPolicy.js":[function(require,module,exports){
'use strict';
/**
 * Jacko policy v1: non-merchant characters never sell/trash/deposit any jacko +1+.
 * Rentaro may work on EXTRA copies only. Until he possesses a +3, keep at least
 * one +2 in his actual carried inventory (not bank/equipped alone).
 * Protect one +3 as an emergency Scare orb once acquired.
 * Fail closed: caller must provide complete and current carried inventory.
 */
const nameOf=i=>String(i?.name||'');
const levelOf=i=>Number(i?.level||0);
const isJacko=i=>nameOf(i)==='jacko';
const isProtectedJacko=i=>isJacko(i)&&levelOf(i)>=1;
const isMerchant=c=>c?.name==='Rentaro'&&c?.ctype==='merchant';
const countAt=(items,level)=>items.filter(x=>isJacko(x)&&levelOf(x)===level).length;
const countHigh=(items,level)=>items.filter(x=>isJacko(x)&&levelOf(x)>=level).length;
function snapshot(character,inventory){
 const items=Array.isArray(inventory)?inventory:null;
 return {valid:!!character&&!!items,merchant:isMerchant(character),plus2:items?countAt(items,2):0,plus3:items?countHigh(items,3):0,inventory:items};
}
function actionAllowed({character,inventory,index,action}={}){
 const s=snapshot(character,inventory);
 if(!s.valid||!Number.isInteger(index)||index<0||index>=s.inventory.length)
  return {allowed:false,reason:'JACKO_POLICY_INCOMPLETE_INPUT'};
 const item=s.inventory[index],level=levelOf(item);
 if(!isJacko(item))return {allowed:true,reason:'NOT_JACKO'};
 if(!s.merchant){
  if(level>=1)return {allowed:false,reason:'NON_MERCHANT_JACKO_PLUS1_PROTECTED'};
  return {allowed:true,reason:'JACKO_LEVEL0_STANDARD_POLICY'};
 }
 const a=String(action||'').toUpperCase();
 if(!['SELL','TRASH','DEPOSIT','BANK','UPGRADE','COMPOUND','EXCHANGE'].includes(a))
  return {allowed:false,reason:'JACKO_ACTION_UNRECOGNIZED'};
 // The last +2 is a protected emergency orb until a +3 is carried.
 if(level===2&&s.plus3<1&&s.plus2<=1)
  return {allowed:false,reason:'RENTARO_LAST_PLUS2_RESERVED_UNTIL_PLUS3'};
 // Even with +3 available, reserve at least one +3 for Scare.
 if(level>=3&&s.plus3<=1)
  return {allowed:false,reason:'RENTARO_LAST_PLUS3_RESERVED_FOR_SCARE'};
 // An additional +2 may only be upgraded if a +2 remains carried or
 // a +3 has already replaced it. This is rechecked before each operation.
 if(a==='UPGRADE'&&level===2&&s.plus3<1&&s.plus2-1<1)
  return {allowed:false,reason:'UPGRADE_WOULD_CONSUME_LAST_PLUS2'};
 return {allowed:true,reason:'RENTARO_EXTRA_JACKO_PERMITTED'};
}
function checkUpgrade({character,inventory,index}={}){
 return actionAllowed({character,inventory,index,action:'UPGRADE'});
}
function classifyJacko({character,inventory,index}={}){
 const items=Array.isArray(inventory)?inventory:[];
 const item=items[index];
 if(!isJacko(item))return null;
 if(!isMerchant(character)&&levelOf(item)>=1)
  return {action:'KEEP',reason:'NON_MERCHANT_JACKO_PLUS1_PROTECTED'};
 const actions=['SELL','TRASH','DEPOSIT','UPGRADE'];
 const permissions=actions.map(action=>actionAllowed({character,inventory:items,index,action}));
 if(permissions.some(p=>!p.allowed))
  return {action:'KEEP',reason:permissions.find(p=>!p.allowed).reason};
 return {action:'KEEP',reason:'JACKO_DEFAULT_KEEP_MANUAL_EXTRA_PROCESS_ONLY'};
}
module.exports={isJacko,isProtectedJacko,isMerchant,snapshot,actionAllowed,checkUpgrade,classifyJacko};

},{}],
"organs/merchant/MerchantCircuit.js":[function(require,module,exports){
'use strict';
// Rentaro owns the ordered main circuit. Fighter availability never gates it.
// V65 sections are the editor's main polylines; optional lines are not imported.
const SEQUENCE=[
 ['SECTION',0],['PORTAL',36],['SECTION',1],['TOWN',128],['SECTION',3],['PORTAL',129],
 ['SECTION',4],['PORTAL',256],['SECTION',5],['PORTAL',287],['SECTION',6],['PORTAL',290],
 // Skip the seasonal Mr Pumpkin out-and-back; preserve the native doorway transit.
 ['SECTION_TRANSIT',7],['PORTAL',342],['SECTION',8],['PORTAL',345],['SECTION',9],['PORTAL',365],
 ['TOWN',366],['SECTION',10],['TOWN',394],['SECTION',11],['PORTAL',439],['TOWN',440],
 // Skip Mr Green out-and-back and retain the regular JR visit.
 ['SECTION',13],['TOWN',516],['SECTION',14],['PORTAL',529],['SECTION',15],['PORTAL',544],
 ['SECTION',16],['PORTAL',550],['SECTION',17],['PORTAL',570],['SECTION',18],['TOWN',650],
 ['SECTION',19],['PORTAL',662],['SECTION',20],['COLLECTION'],['TOWN',700],['SECTION',21],['PORTAL',715],
 ['TOWN',716],['SECTION',22],['PORTAL',838],['TOWN',839],['SECTION',23],['COLLECTION'],['TOWN',865],
 ['SECTION',24],['PORTAL',909],['TOWN',910],['SECTION',25],['PORTAL',930],
 ['SECTION',26],['TOWN',10001],['PORTAL',994],['TOWN',995],['STAND']
];
const STAND={map:'main',x:-300,y:-100};
function createMerchantCircuit({root,routes,now=Date.now,standMs=180000,dwellMs=20000}={}){
 if(!root||!routes||typeof routes.followCircuitPoint!=='function')throw Error('MERCHANT_CIRCUIT_DEPENDENCIES_REQUIRED');
 let cursor=0,pointIndex=0,phase='IDLE',cycles=0,nextAt=0,waitUntil=0,lastError=null,busy=false,rejoin=true,deadSeen=false,retryAt=0;
 const actor=()=>root.character||{};
 const alive=()=>actor().name==='Rentaro'&&!actor().rip&&!actor().dead&&actor().hp>0;
 const due=()=>phase==='RUNNING'||(Number(now())>=nextAt);
 const active=()=>phase==='RUNNING';
 const start=()=>{if(phase!=='RUNNING'){cursor=0;pointIndex=0;waitUntil=0;rejoin=true;phase='RUNNING';}return{ok:true};};
 const stop=()=>({ok:true});
 const status=()=>({phase,cursor,pointIndex,cycles,nextAt,waitUntil,lastError,rejoin,busy,routeVersion:routes.status?.().modelVersion});
 function reset(){cursor=0;pointIndex=0;waitUntil=0;rejoin=true;retryAt=0;}
 async function closeStand(){
   if(!actor().stand)return{ok:true};
   if(typeof root.close_stand==='function')await root.close_stand();
   else if(typeof root.parent?.close_merchant==='function')await root.parent.close_merchant();
   else return{ok:false,error:'MERCHANT_CIRCUIT_STAND_CLOSE_UNAVAILABLE'};
   return actor().stand?{ok:false,error:'MERCHANT_CIRCUIT_STAND_STILL_OPEN'}:{ok:true};
 }
 async function tick(){
   if(busy)return{ok:true,progress:false,reason:'MERCHANT_CIRCUIT_BUSY'};
   if(!alive()){deadSeen=true;return{ok:true,progress:false,reason:'MERCHANT_RESPAWN_PENDING'};}
   if(deadSeen){deadSeen=false;reset();phase='RUNNING';}
   if(phase!=='RUNNING'){if(!due())return{ok:true,complete:true,reason:'MERCHANT_CIRCUIT_STAND_WINDOW'};start();}
   if(Number(now())<retryAt)return{ok:true,progress:false,reason:'MERCHANT_CIRCUIT_RETRY_DELAY'};
   busy=true;
   try{
     let out;
     if(rejoin){
       out=await closeStand();if(!out.ok)return fail(out);
       // A reload in the middle of the circuit should rejoin its saved line.
       // Prefer the earliest matching forward section, never a blind map jump.
       const here={map:actor().map,x:actor().real_x??actor().x,y:actor().real_y??actor().y};
       if(here.map!=='main'&&typeof routes.canResumeCircuitPoint==='function'){
         for(let ci=0;ci<SEQUENCE.length;ci++){
           const [k,si]=SEQUENCE[ci];
           if(k!=='SECTION')continue;
           const s=routes.section(si);
           if(!s?.ok||s.map!==here.map)continue;
           for(let pi=1;pi<s.points.length;pi++){
             const a=s.points[pi-1],b=s.points[pi],dx=b.x-a.x,dy=b.y-a.y,L=dx*dx+dy*dy;
             if(!L)continue;
             const t=((here.x-a.x)*dx+(here.y-a.y)*dy)/L;
             if(t<0||t>1||Math.hypot(here.x-a.x-t*dx,here.y-a.y-t*dy)>15)continue;
             // Short join only; the real game must approve the next leg.
             if(!routes.canResumeCircuitPoint(b))continue;
             cursor=ci;pointIndex=pi;rejoin=false;lastError=null;
             return{ok:true,progress:true,kind:'MERCHANT_CIRCUIT_RESUME_LOCAL',cursor,pointIndex};
           }
         }
       }
       const p=routes.section(0)?.points?.[0];
       if(!p)return fail({error:'MERCHANT_CIRCUIT_FIRST_SECTION_MISSING'});
       if(actor().map!=='main'||Math.hypot((actor().real_x??actor().x)-p.x,(actor().real_y??actor().y)-p.y)>300){
         out=await routes.followBossRoute({...p,stageRadius:20});
         if(!out?.ok)return fail(out);
       }
       out=await routes.followCircuitPoint(p);
       if(!out?.ok)return fail(out);
       rejoin=false;lastError=null;return{ok:true,progress:true,kind:'MERCHANT_CIRCUIT_START'};
     }
     const [kind,index]=SEQUENCE[cursor]||[];
     if(kind==='SECTION'||kind==='SECTION_TRANSIT'){
       const section=routes.section(index);
       if(!section?.ok)return fail(section);
       const points=kind==='SECTION_TRANSIT'?[section.points[0],section.points.at(-1)]:section.points;
       const point=points[pointIndex];
       const next=SEQUENCE[cursor+1];
       const portal=next?.[0]==='PORTAL'?routes.portal?.(next[1]):null;
       const actorPosition={map:actor().map,x:actor().real_x??actor().x,y:actor().real_y??actor().y};
       // The final recorded waypoint is a door approach, not the door itself.
       // At the observed Cave stop (160,1381) the 5px waypoint tolerance
       // prevents advancing despite already being in native door range.
       if(pointIndex===points.length-1&&portal?.ok&&portal.doorKind==='door'&&actorPosition.map===point.map&&portal.map===point.map&&Math.hypot(actorPosition.x-point.x,actorPosition.y-point.y)<=15&&Math.hypot(actorPosition.x-portal.at[0],actorPosition.y-portal.at[1])<=40){
         out=await routes.followCircuitPortal(next[1]);
         if(!out?.ok)return fail(out);
         pointIndex=0;cursor+=2;lastError=null;
         return{ok:true,progress:true,kind:'MERCHANT_CIRCUIT_DOOR_HANDOFF',cursor,pointIndex};
       }
       out=await routes.followCircuitPoint(point,{previous:points[pointIndex-1]||null,next:points[pointIndex+1]||null});
       if(!out?.ok)return fail(out);
       pointIndex++;
       if(pointIndex>=points.length){pointIndex=0;cursor++;}
     }else if(kind==='PORTAL'){
       out=await routes.followCircuitPortal(index);if(!out?.ok)return fail(out);cursor++;
     }else if(kind==='TOWN'){
       out=await routes.followCircuitTown(index);if(!out?.ok)return fail(out);cursor++;
     }else if(kind==='COLLECTION'){
       if(!waitUntil)waitUntil=Number(now())+dwellMs;
       if(Number(now())<waitUntil)return{ok:true,progress:false,reason:'MERCHANT_CIRCUIT_COLLECTION_WINDOW'};
       waitUntil=0;cursor++;
     }else if(kind==='STAND'){
       out=await routes.followCircuitPoint(STAND);if(!out?.ok)return fail(out);
       cycles++;phase='DONE';nextAt=Number(now())+standMs;
       return{ok:true,progress:true,complete:true,kind:'MERCHANT_CIRCUIT_COMPLETE',cycles};
     }else return fail({error:'MERCHANT_CIRCUIT_STEP_UNKNOWN'});
     lastError=null;return{ok:true,progress:true,kind:'MERCHANT_CIRCUIT_PROGRESS',cursor,pointIndex};
   }catch(e){return fail({error:String(e?.message||e)});}
   finally{busy=false;}
 }
 function fail(out){
   const error=String(out?.error||'MERCHANT_CIRCUIT_STEP_FAILED')+(out?.detail?': '+out.detail:'');
   if(lastError!==error){try{root.game_log?.('O66 Rentaro route '+cursor+'/'+pointIndex+' '+error)}catch(_){}}
   lastError=error;retryAt=Number(now())+5000;
   if(!alive())deadSeen=true;return{ok:false,error:lastError,cursor,pointIndex};}
 return{due,active,start,stop,tick,run:tick,status,snapshot:status,health:async()=>({ok:true,status:status()}),
   pause:async()=>({ok:true}),resume:async()=>{reset();phase='RUNNING';return{ok:true};}};
}
module.exports={createMerchantCircuit,SEQUENCE};

},{}],
"organs/merchant/MerchantCollectionVisit.js":[function(require,module,exports){
'use strict';

// Rentaro's V2 20-second MOB_SERVICE converted to a native V3 state.
// Only Rentaro walks the saved shared PogiPath routes; the fighters perform
// their own physical item/gold transfers when they can see him nearby.
const FARM_SAFE_END=Object.freeze({map:'halloween',x:-253.55556,y:680,stageRadius:25});
const TOWN_STAND=Object.freeze({map:'main',x:-300,y:-100,stageRadius:35});
const FIGHTERS=Object.freeze(['Hibari','Souji','Harutora']);
function createMerchantCollectionVisit({root,routes,now=Date.now,
  intervalMs=240000,dwellMs=20000}={}){
  if(!routes||typeof routes.followBossRoute!=='function')
    throw Error('MERCHANT_COLLECTION_SHARED_POGIPATH_REQUIRED');
  let phase='IDLE',lastDoneAt=null,windowEnd=0,lastError=null;
  let visitCount=0,lastArrival=null,participants=[],travelBusy=false;
  let observedReceipts={items:0,gold:0,itemsByFighter:{},goldByFighter:{}};
  let receiptsAttached=false;
  function sender(event){
    return String(event?.from||event?.name||'');
  }
  function onItem(event){
    if(phase!=='WAIT'||!FIGHTERS.includes(sender(event)))return;
    const who=sender(event),count=Math.max(1,Number(event?.q||1));
    observedReceipts.items+=count;
    observedReceipts.itemsByFighter[who]=(observedReceipts.itemsByFighter[who]||0)+count;
  }
  function onGold(event){
    if(phase!=='WAIT'||!FIGHTERS.includes(sender(event)))return;
    const who=sender(event),amount=Math.max(0,Number(event?.gold??event?.amount??0));
    observedReceipts.gold+=amount;
    observedReceipts.goldByFighter[who]=(observedReceipts.goldByFighter[who]||0)+amount;
  }
  function attachReceipts(){
    if(receiptsAttached||typeof root?.character?.on!=='function')return;
    root.character.on('item_received',onItem);
    root.character.on('gold_received',onGold);
    receiptsAttached=true;
  }
  function detachReceipts(){
    if(!receiptsAttached)return;
    const off=root?.character?.off||root?.character?.removeListener;
    if(typeof off==='function'){
      try{off.call(root.character,'item_received',onItem);
          off.call(root.character,'gold_received',onGold);}catch(_){}
    }
    receiptsAttached=false;
  }
  function due(){
    return phase!=='IDLE'&&phase!=='DONE'||
      lastDoneAt===null||Number(now())-lastDoneAt>=Math.max(60000,Number(intervalMs)||240000);
  }
  function nearFighters(){
    const actor=root?.character||{},getter=root?.get_player;
    if(typeof getter!=='function')return [];
    const rows=[];
    for(const name of FIGHTERS){
      let member=null;try{member=getter(name)}catch(_){}
      if(!member||member.rip===true||member.dead===true||
         String(member.map||actor.map)!==String(actor.map||''))continue;
      const ax=Number(actor.real_x??actor.x),ay=Number(actor.real_y??actor.y);
      const fx=Number(member.real_x??member.x),fy=Number(member.real_y??member.y);
      if([ax,ay,fx,fy].every(Number.isFinite)&&Math.hypot(ax-fx,ay-fy)<=300)
        rows.push(name);
    }
    return rows;
  }
  function start(){
    if(phase==='IDLE'||phase==='DONE'){
      detachReceipts();phase='TRAVEL';windowEnd=0;lastError=null;participants=[];
      observedReceipts={items:0,gold:0,itemsByFighter:{},goldByFighter:{}};
    }
    return{ok:true,phase};
  }
  async function tick(){
    if(travelBusy)return{ok:true,progress:false,reason:'COLLECTION_TRAVEL_BUSY'};
    if(phase==='IDLE'||phase==='DONE')start();
    if(phase==='TRAVEL'){
      travelBusy=true;
      try{
        const moved=await routes.followBossRoute(FARM_SAFE_END);
        if(!moved||moved.ok!==true){
          lastError=moved?.error||'COLLECTION_SHARED_ROUTE_FAILED';
          return{ok:false,error:lastError,phase};
        }
        const c=root?.character||{};
        if(String(c.map||'')!==FARM_SAFE_END.map||
           Math.hypot(Number(c.real_x??c.x)-FARM_SAFE_END.x,
             Number(c.real_y??c.y)-FARM_SAFE_END.y)>35){
          return{ok:true,progress:false,reason:'COLLECTION_ARRIVAL_AWAITING_PROOF'};
        }
        phase='WAIT';attachReceipts();windowEnd=Number(now())+Math.max(5000,Number(dwellMs)||20000);
        lastArrival={map:String(c.map),x:Number(c.real_x??c.x),y:Number(c.real_y??c.y),at:Number(now())};
        return{ok:true,progress:true,kind:'MERCHANT_COLLECTION_VISIT_ARRIVED',
          participants:nearFighters(),windowEnd};
      }finally{travelBusy=false}
    }
    if(phase==='WAIT'){
      for(const name of nearFighters())if(!participants.includes(name))participants.push(name);
      if(Number(now())<windowEnd)return{ok:true,progress:false,
        reason:'MERCHANT_COLLECTION_20S_WINDOW',participants:[...participants],windowEnd};
      detachReceipts();phase='RETURN';
    }
    if(phase==='RETURN'){
      travelBusy=true;
      try{
        const moved=await routes.followBossRoute(TOWN_STAND);
        if(!moved||moved.ok!==true){
          lastError=moved?.error||'COLLECTION_RETURN_SHARED_ROUTE_FAILED';
          return{ok:false,error:lastError,phase};
        }
        const c=root?.character||{};
        if(String(c.map||'')!==TOWN_STAND.map||
           Math.hypot(Number(c.real_x??c.x)-TOWN_STAND.x,
             Number(c.real_y??c.y)-TOWN_STAND.y)>45)return{ok:true,progress:false,
          reason:'COLLECTION_TOWN_RETURN_AWAITING_PROOF'};
        phase='DONE';lastDoneAt=Number(now());visitCount++;
        return{ok:true,complete:true,progress:true,kind:'MERCHANT_COLLECTION_VISIT_COMPLETE',
          participants:[...participants],observedReceipts:{...observedReceipts},
          reason:'COLLECTION_VISIT_DONE'};
      }finally{travelBusy=false}
    }
    return{ok:true,complete:true,reason:'COLLECTION_NO_PENDING_WORK'};
  }
  function stop(){detachReceipts();if(phase==='DONE')phase='IDLE';return{ok:true,phase};}
  function status(){return{phase,due:due(),visitCount,lastDoneAt,
    windowEnd,lastError,lastArrival,participants:[...participants],travelBusy,
    observedReceipts:{...observedReceipts},receiptsAttached};}
  return{start,tick,run:tick,stop,health:async()=>({ok:true,status:status()}),
    snapshot:status,status,due,pause:async()=>({ok:true}),resume:async()=>({ok:true})};
}
module.exports={createMerchantCollectionVisit,FARM_SAFE_END,TOWN_STAND};

},{}],
"organs/pvp-defense/DefensivePvp.js":[function(require,module,exports){
'use strict';

const OFFICIAL_SOURCE=Object.freeze({
  repository:'kaansoral/adventureland_mongodb',
  commit:'ddcf7222c3264f1404382e1ff5dea8e73f6cb4b4',
  hitEvent:'docs/articles/events-game.html',
  hostileFilter:'js/runner_functions.js',
  skills:'design/skills.js'
});
const DEFAULT_CREW=Object.freeze(['Rentaro','Harutora','Hibari','Souji']);
const ROLE_THREAT=Object.freeze({priest:320,ranger:290,mage:270,rogue:250,warrior:210,merchant:90});

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function makeSet(values){return new Set((values||[]).map(String).filter(Boolean));}

function createDefensivePvp({crew=DEFAULT_CREW,whitelist=[],blacklist=[],now=Date.now,quietMs=7000}={}){
  const crewSet=makeSet(crew),white=makeSet(whitelist),black=makeSet(blacklist);
  for(const name of crewSet)white.add(name);
  const state={
    active:false,startedAt:null,lastAggressionAt:null,primary:null,victim:null,
    hostiles:{},groupKeys:{party:[],team:[]},sessionCount:0,lastEnd:null
  };
  function protectedEntity(entity){
    if(!entity)return true;
    const name=String(entity.name||entity.id||'');
    if(!name||crewSet.has(name)||white.has(name))return true;
    if(entity.sameParty===true||entity.sameTeam===true||entity.sameGuild===true||entity.ownerFriend===true)return true;
    return false;
  }
  function addHostile(entity,reason){
    if(!entity||protectedEntity(entity))return false;
    const name=String(entity.name||entity.id||'');if(!name)return false;
    const t=Number(now());
    const old=state.hostiles[name]||{};
    state.hostiles[name]={name,ctype:String(entity.ctype||old.ctype||''),firstAt:old.firstAt||t,lastAt:t,reason:String(reason||'DEFENSE')};
    return true;
  }
  function observeHit({actor,target,visiblePlayers=[]}={}){
    if(!actor||!target)return{ok:false,error:'HIT_INCOMPLETE'};
    const victim=String(target.name||target.id||target);
    if(!crewSet.has(victim))return{ok:true,triggered:false,reason:'TARGET_NOT_CREW'};
    if(protectedEntity(actor))return{ok:true,triggered:false,reason:'ACTOR_PROTECTED'};
    const t=Number(now());
    if(!state.active){
      state.active=true;state.startedAt=t;state.sessionCount++;state.hostiles={};state.groupKeys={party:[],team:[]};
      state.primary=String(actor.name||actor.id||'');
    }
    state.lastAggressionAt=t;state.victim=victim;
    addHostile(actor,'DIRECT_AGGRESSOR');
    const party=String(actor.party||''),team=String(actor.team||'');
    if(party&&!state.groupKeys.party.includes(party))state.groupKeys.party.push(party);
    if(team&&!state.groupKeys.team.includes(team))state.groupKeys.team.push(team);
    for(const e of visiblePlayers){
      if(!e)continue;
      if((party&&String(e.party||'')===party)||(team&&String(e.team||'')===team))addHostile(e,'AGGRESSOR_GROUP');
    }
    return{ok:true,triggered:true,session:status()};
  }
  function refreshVisibleGroups(visiblePlayers=[]){
    if(!state.active)return{ok:true,added:[]};
    const added=[];
    // Refresh party/team keys from proven hostiles first. This catches metadata
    // that becomes visible after the original hit event.
    for(const e of visiblePlayers){
      const name=String(e&&e.name||e&&e.id||'');
      if(!name||!state.hostiles[name])continue;
      const party=String(e.party||''),team=String(e.team||'');
      if(party&&!state.groupKeys.party.includes(party))state.groupKeys.party.push(party);
      if(team&&!state.groupKeys.team.includes(team))state.groupKeys.team.push(team);
    }
    // Then admit any visible member of an aggressor party/team. Protected
    // entities are still rejected by addHostile, so whitelist/crew/friends win.
    for(const e of visiblePlayers){
      if(!e)continue;
      const party=String(e.party||''),team=String(e.team||'');
      const grouped=(party&&state.groupKeys.party.includes(party))||(team&&state.groupKeys.team.includes(team));
      if(!grouped)continue;
      const name=String(e.name||e.id||'');
      const existed=!!state.hostiles[name];
      if(addHostile(e,'AGGRESSOR_GROUP_LATE_VISIBLE')&&!existed)added.push(name);
    }
    return{ok:true,added};
  }
  function score(entity){
    const name=String(entity&&entity.name||entity&&entity.id||'');
    let value=ROLE_THREAT[String(entity&&entity.ctype||'')]||120;
    if(name===state.primary)value+=700;
    if(black.has(name))value+=450;
    if(entity&&entity.targetsCrew===true)value+=420;
    if(entity&&entity.targetsVulnerableCrew===true)value+=120;
    const hp=Number(entity&&entity.hp),max=Number(entity&&entity.max_hp);
    if(Number.isFinite(hp)&&Number.isFinite(max)&&max>0)value+=Math.round((1-Math.max(0,Math.min(1,hp/max)))*220);
    const d=Number(entity&&entity.distance);
    if(Number.isFinite(d))value-=Math.round(d*0.12);
    return value;
  }
  function chooseFocus(visiblePlayers=[]){
    refreshVisibleGroups(visiblePlayers);
    const eligible=visiblePlayers.filter(e=>{
      const name=String(e&&e.name||e&&e.id||'');
      return !!state.hostiles[name]&&!protectedEntity(e)&&e.dead!==true&&e.rip!==true;
    });
    eligible.sort((a,b)=>score(b)-score(a)||String(a.name||a.id||'').localeCompare(String(b.name||b.id||'')));
    return eligible.length?clone(eligible[0]):null;
  }
  function authorizeHostileAction(entity){
    if(!state.active)return{ok:false,reason:'NO_DEFENSE_SESSION'};
    if(protectedEntity(entity))return{ok:false,reason:'PROTECTED'};
    const name=String(entity&&entity.name||entity&&entity.id||'');
    if(!state.hostiles[name])return{ok:false,reason:'NOT_PROVEN_HOSTILE'};
    return{ok:true};
  }
  function authorizeAoe(visiblePlayers=[],radius=400){
    if(!state.active)return{ok:false,reason:'NO_DEFENSE_SESSION'};
    refreshVisibleGroups(visiblePlayers);
    for(const e of visiblePlayers){
      if(!e||Number(e.distance)>Number(radius))continue;
      if(protectedEntity(e))continue;
      const name=String(e.name||e.id||'');
      if(!state.hostiles[name])return{ok:false,reason:'NEUTRAL_IN_AOE',neutral:name};
    }
    return{ok:true};
  }
  function planRoleActions({role,focus,visiblePlayers=[],hpRatio=1,mp=0,cooldowns={}}={}){
    refreshVisibleGroups(visiblePlayers);
    const auth=authorizeHostileAction(focus);
    if(!auth.ok)return[];
    const hostileCount=Object.keys(state.hostiles).length;
    const actions=[];
    if(role==='warrior'){
      if(cooldowns.warcry===true)actions.push({skill:'warcry',kind:'BUFF_GROUP'});
      if((hostileCount>=2||Number(hpRatio)<0.70)&&cooldowns.hardshell===true)actions.push({skill:'hardshell',kind:'DEFENSE'});
      if(cooldowns.taunt===true)actions.push({skill:'taunt',target:String(focus.name||focus.id),kind:'CONTROL'});
      if(cooldowns.stomp===true&&hostileCount>=2&&authorizeAoe(visiblePlayers,400).ok)actions.push({skill:'stomp',kind:'AOE_CONTROL',requiresEquipment:'wbasher+3'});
    }else if(role==='mage'){
      if(cooldowns.reflection===true&&state.victim)actions.push({skill:'reflection',target:state.victim,kind:'DEFENSE'});
      if(cooldowns.cburst===true&&Number(mp)>3320)actions.push({skill:'cburst',target:String(focus.name||focus.id),maxAllocatedMp:Math.min(650,Number(mp)-3200),kind:'FOCUS_DAMAGE'});
    }else if(role==='priest'){
      if(cooldowns.partyheal===true)actions.push({skill:'partyheal',kind:'SUSTAIN'});
      if(cooldowns.darkblessing===true)actions.push({skill:'darkblessing',kind:'BUFF_GROUP'});
      if(cooldowns.curse===true)actions.push({skill:'curse',target:String(focus.name||focus.id),kind:'DEBUFF'});
    }
    actions.push({kind:'BASIC_ATTACK',target:String(focus.name||focus.id)});
    return actions;
  }
  function endIfQuiet(visiblePlayers=[]){
    if(!state.active)return{ok:true,ended:false};
    refreshVisibleGroups(visiblePlayers);
    const alive=visiblePlayers.some(e=>{
      const name=String(e&&e.name||e&&e.id||'');
      return !!state.hostiles[name]&&!protectedEntity(e)&&e.dead!==true&&e.rip!==true;
    });
    if(alive)return{ok:true,ended:false};
    if(Number(now())-Number(state.lastAggressionAt||0)<Number(quietMs))return{ok:true,ended:false};
    state.lastEnd={at:Number(now()),reason:'HOSTILES_GONE',durationMs:Number(now())-Number(state.startedAt||now())};
    state.active=false;state.primary=null;state.victim=null;state.hostiles={};state.groupKeys={party:[],team:[]};
    return{ok:true,ended:true,resume:'EXISTING_BOSS_OR_PVE',lastEnd:clone(state.lastEnd)};
  }
  function whitelistAdd(name){name=String(name||'');if(!name)return false;white.add(name);black.delete(name);return true;}
  function whitelistRemove(name){name=String(name||'');if(crewSet.has(name))return false;return white.delete(name);}
  function blacklistAdd(name){name=String(name||'');if(!name||white.has(name)||crewSet.has(name))return false;black.add(name);return true;}
  function blacklistRemove(name){return black.delete(String(name||''));}
  function status(){return{...clone(state),defensiveOnly:true,whitelist:Array.from(white).sort(),blacklist:Array.from(black).sort(),officialSource:OFFICIAL_SOURCE};}
  return{observeHit,refreshVisibleGroups,chooseFocus,authorizeHostileAction,authorizeAoe,planRoleActions,endIfQuiet,whitelistAdd,whitelistRemove,blacklistAdd,blacklistRemove,status};
}

module.exports={OFFICIAL_SOURCE,DEFAULT_CREW,ROLE_THREAT,createDefensivePvp};

},{}],
"organs/stand/StandState.js":[function(require,module,exports){
'use strict';

const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function createStandState({adapter,now=Date.now}={}){
  if(!adapter||typeof adapter.isOpen!=='function'||typeof adapter.open!=='function'||typeof adapter.close!=='function')throw new Error('STAND_ADAPTER_REQUIRED');
  const state={version:3,state:'STAND',phase:'CLOSED',paused:false,opened_at:null,last_error:null};

  const snapshot=()=>clone(state);
  // Startup observation is read-only. A merchant's stand may already be
  // physically open when V3 attaches; assuming CLOSED until an explicit
  // STAND action causes false STAND_STATE_MISMATCH alerts in BANK/IDLE.
  async function initialize(){
    const open=await adapter.isOpen();
    state.phase=state.paused?'PAUSED':open?'OPEN':'CLOSED';
    state.last_error=null;
    return{ok:true,initialized:true,observedOpen:open,status:snapshot()};
  }
  async function sync(){
    const open=await adapter.isOpen();
    state.phase=open?'OPEN':'CLOSED';
    return open;
  }
  async function start(){
    if(state.paused)return{ok:false,error:'STAND_PAUSED'};
    if(await sync())return{ok:true,status:snapshot(),already_open:true};
    const r=await adapter.open();
    if(r&&r.ok===false){state.last_error=r.error||'STAND_OPEN_FAILED';return{ok:false,error:state.last_error};}
    state.phase='OPEN';state.opened_at=Number(now());state.last_error=null;
    return{ok:true,status:snapshot()};
  }
  async function pause(){
    state.paused=true;
    if(await adapter.isOpen())await adapter.close();
    state.phase='PAUSED';
    return{ok:true,status:snapshot()};
  }
  async function resume(){state.paused=false;state.phase='CLOSED';return{ok:true,status:snapshot()};}
  async function stop(){
    if(await adapter.isOpen())await adapter.close();
    state.phase='CLOSED';state.paused=false;
    return{ok:true,status:snapshot()};
  }
  async function health(){
    const open=await adapter.isOpen();
    const expected=state.phase==='OPEN';
    if(expected!==open)return{ok:false,error:'STAND_STATE_MISMATCH',expected,actual:open,status:snapshot()};
    return{ok:true,status:snapshot()};
  }
  async function restore(saved){
    if(!saved||saved.version!==3||saved.state!=='STAND')throw new Error('STAND_SNAPSHOT_INVALID');
    Object.assign(state,clone(saved));
    return{ok:true,status:snapshot()};
  }

  return{initialize,start,pause,resume,stop,health,snapshot,restore,getStatus:snapshot};
}

module.exports={createStandState};

},{}],
"roles/RoleManifest.js":[function(require,module,exports){
'use strict';

const ROLE_MANIFESTS=Object.freeze({
  Rentaro:Object.freeze({
    character:'Rentaro',
    role:'MERCHANT',
    required:Object.freeze(['CoreSupervisor']),
    optional:Object.freeze(['MerchantRoutes','MerchantCollection','Gear','Inventory','MerchantHandoff','RecipeIntelligence','BankNavigation','BankTravel','GearHandoff','GearProduction','Shop','Bank','Stand','ScanBoss','BossScout','Events','PvpDefense','MerchantController'])
  }),
  Harutora:Object.freeze({
    character:'Harutora',
    role:'MAGE',
    required:Object.freeze(['CoreSupervisor']),
    optional:Object.freeze(['MerchantRoutes','Gear','PartyCoordination','Targeting','MageCombat','CasterActions','FighterActions','MerchantHandoff','Farm','WorldBoss','ScanBoss','Events','PvpDefense'])
  }),
  Hibari:Object.freeze({
    character:'Hibari',
    role:'WARRIOR',
    required:Object.freeze(['CoreSupervisor']),
    optional:Object.freeze(['MerchantRoutes','Gear','PartyCoordination','PartySafeSpot','Targeting','WarriorCombat','WarriorV2Runtime','FighterActions','MerchantHandoff','Farm','WorldBoss','ScanBoss','Events','PvpDefense'])
  }),
  Souji:Object.freeze({
    character:'Souji',
    role:'PRIEST',
    required:Object.freeze(['CoreSupervisor']),
    optional:Object.freeze(['MerchantRoutes','Gear','PartyCoordination','PartySafeSpot','Targeting','PriestCombat','CasterActions','FighterActions','MerchantHandoff','Farm','WorldBoss','ScanBoss','Events','PvpDefense'])
  })
});

function getRoleManifest(character){
  const row=ROLE_MANIFESTS[String(character||'')];
  if(!row)throw new Error('ROLE_MANIFEST_NOT_FOUND:'+String(character||''));
  return row;
}

function validateRoleManifest(manifest){
  if(!manifest||typeof manifest!=='object')return{ok:false,error:'ROLE_MANIFEST_REQUIRED'};
  if(!manifest.character||!manifest.role)return{ok:false,error:'ROLE_IDENTITY_REQUIRED'};
  if(!Array.isArray(manifest.required)||!Array.isArray(manifest.optional))return{ok:false,error:'ROLE_MODULE_LIST_REQUIRED'};
  const all=[...manifest.required,...manifest.optional];
  const dup=all.find((name,index)=>all.indexOf(name)!==index);
  if(dup)return{ok:false,error:'ROLE_MODULE_DUPLICATE',module:dup};
  return{ok:true};
}

function resolveRoleModules(character,catalog={}){
  const manifest=getRoleManifest(character);
  const required=[],optional=[],missingRequired=[],missingOptional=[];
  for(const name of manifest.required){
    if(catalog[name])required.push({name,module:catalog[name]});
    else missingRequired.push(name);
  }
  for(const name of manifest.optional){
    if(catalog[name])optional.push({name,module:catalog[name]});
    else missingOptional.push(name);
  }
  return{
    ok:missingRequired.length===0,
    character:manifest.character,
    role:manifest.role,
    required,
    optional,
    missing_required:missingRequired,
    missing_optional:missingOptional
  };
}

module.exports={ROLE_MANIFESTS,getRoleManifest,validateRoleManifest,resolveRoleModules};

},{}],
"states/StateRegistry.js":[function(require,module,exports){
'use strict';

const SAFETY_HIERARCHY=Object.freeze([
  'EMERGENCY',
  'RETREAT',
  'RECOVERY',
  'PVP_DEFENSE'
]);

const GAMEPLAY_HIERARCHY=Object.freeze([
  'WORLD_BOSS',
  'EVENT',
  'BANK',
  'GEAR_PRODUCTION',
  'COLLECT',
  'STAND',
  'FARM',
  'IDLE'
]);

const MAIN_HIERARCHY=Object.freeze([
  ...SAFETY_HIERARCHY,
  ...GAMEPLAY_HIERARCHY
]);

const STATES=Object.freeze({
  EMERGENCY:Object.freeze({priority:100,kind:'core',tier:'SAFETY',main:true,movement_owner:'EMERGENCY'}),
  RETREAT:Object.freeze({priority:95,kind:'core',tier:'SAFETY',main:true,movement_owner:'RETREAT'}),
  RECOVERY:Object.freeze({priority:90,kind:'core',tier:'SAFETY',main:true,movement_owner:'RECOVERY'}),
  PVP_DEFENSE:Object.freeze({priority:80,kind:'organ',tier:'SAFETY',main:true,movement_owner:'PVP_DEFENSE'}),
  WORLD_BOSS:Object.freeze({priority:70,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'WORLD_BOSS'}),
  EVENT:Object.freeze({priority:60,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'EVENT'}),
  BANK:Object.freeze({priority:50,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'BANK'}),
  GEAR_PRODUCTION:Object.freeze({priority:45,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'GEAR_PRODUCTION'}),
  COLLECT:Object.freeze({priority:42,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'COLLECT'}),
  STAND:Object.freeze({priority:40,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:null}),
  SCAN_BOSS:Object.freeze({priority:35,kind:'side',tier:'OBSERVATION',main:false,movement_owner:null}),
  FARM:Object.freeze({priority:20,kind:'organ',tier:'GAMEPLAY',main:true,movement_owner:'FARM'}),
  IDLE:Object.freeze({priority:0,kind:'core',tier:'GAMEPLAY',main:true,movement_owner:null})
});

function getState(name){return STATES[String(name||'')]||null;}
function priority(name){const row=getState(name);return row?row.priority:-1;}
function isMainState(name){const row=getState(name);return !!(row&&row.main===true);}
function canPreempt(current,next){
  if(!isMainState(next))return false;
  if(String(current||'')==='IDLE')return String(next||'')!=='IDLE';
  if(!isMainState(current))return false;
  return priority(next)>priority(current);
}
function list(){return Object.entries(STATES).map(([name,value])=>({name,...value}));}
function mainHierarchy(){return MAIN_HIERARCHY.slice();}
function gameplayHierarchy(){return GAMEPLAY_HIERARCHY.slice();}
function safetyHierarchy(){return SAFETY_HIERARCHY.slice();}

module.exports={
  STATES,
  SAFETY_HIERARCHY,
  GAMEPLAY_HIERARCHY,
  MAIN_HIERARCHY,
  getState,
  priority,
  isMainState,
  canPreempt,
  list,
  mainHierarchy,
  gameplayHierarchy,
  safetyHierarchy
};

},{}]},cache=Object.create(null);function load(id){if(cache[id])return cache[id].exports;const d=defs[id];if(!d)throw Error("MODULE_NOT_FOUND:"+id);const m={exports:{}};cache[id]=m;d[0](x=>{if(!Object.prototype.hasOwnProperty.call(d[1],x))throw Error("DEPENDENCY_NOT_FOUND:"+id+":"+x);return load(d[1][x]);},m,m.exports);return m.exports;}root.__O66_DIRECT_BUNDLE_INFO={sourceCommit:"694b003e6bd0c2f9263fa192b64ece682f9eff13",routeOverlayCommit:"067424f8d6e5749ace542e50f6cfa4d0b286d7be",routeVersion:76,modules:Object.keys(defs).length,loadedAt:Date.now(),role:root.character?.name};void load("bootstrap/Order66DirectLaunch.js").launchOrder66Direct({root}).then(r=>{root.__O66_DIRECT_LAST_RESULT=r;}).catch(e=>{root.__O66_DIRECT_LAST_RESULT={ok:false,error:String(e?.message||e)};});})(globalThis);
