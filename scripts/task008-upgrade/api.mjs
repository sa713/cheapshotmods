import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync} from 'node:fs';
import Database from 'better-sqlite3';
const {fetch,URLSearchParams}=globalThis;
const legacyGroups=items=>items.map(g=>({id:g.id,kind:g.kind,tier:g.tier,value:g.value,quantity:g.quantity}));
const origin='https://fixture.invalid';
const base='http://localhost:3000';
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:Number('__OWNER__'),first_name:'Isolated migration fixture'})};
const secret=crypto.createHmac('sha256','WebAppData').update('legacy-fixture-bot-token').digest();
fields.hash=crypto.createHmac('sha256',secret).update(Object.keys(fields).sort().map(k=>k+'='+fields[k]).join('\n')).digest('hex');
(async()=>{
  const auth=await fetch(base+'/auth/mini',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({initData:new URLSearchParams(fields).toString()})});
  assert.equal(auth.status,200);
  const headers={origin,cookie:auth.headers.get('set-cookie').split(';')[0],'x-csrf-token':(await auth.json()).csrf,'content-type':'application/json'};
  const get=async path=>{const r=await fetch(base+path,{headers});assert.equal(r.status,200);return r.json();};
  const state=()=>get('/api/state');
  const inventory=async scope=>{let items=[],after='';for(;;){const page=(await get('/api/inventory?scope='+scope+'&limit=200&after='+encodeURIComponent(after))).items;items.push(...page);if(page.length<200)return items;after=page.at(-1).id;}};
  const command=async action=>{const s=await state(),payload={key:crypto.randomUUID(),revision:s.revision,experiment:s.experiment,action};const r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(r.status,200);return {payload,result:await r.json()};};
  const owner=String(JSON.parse(fields.user).id);
  const snapshot=async()=>{const db=new Database('/data/cheapshot.sqlite'),baselineGroups=db.pragma('user_version',{simple:true})===6?db.prepare('SELECT * FROM baseline_groups WHERE owner=? ORDER BY id').all(owner):undefined;db.close();return {state:await state(),original:await inventory('original'),work:await inventory('work'),...(baselineGroups?{baselineGroups}:{})};};

  async function rawScenarios(){
    const before=await snapshot();
    for(const [kind,,price] of [['raw-purple','🧿','144'],['raw-red','💢','132'],['raw-green','🅾','168']]){
      await command({type:'original.put',kind,tier:0,value:kind==='raw-green'?'8':'5',crit:kind==='raw-green'?null:'13',quantity:'9'});const id=(await inventory('work')).find(g=>g.kind===kind&&g.value===(kind==='raw-green'?'8':'5')).id;
      await command({type:'equip',items:[{id,quantity:'3'}]});
      const single=await command({type:'craft',items:[{id,quantity:'3',worn:'3'}]});assert.deepEqual(single.result.equipment,[]);assert.equal(single.result.lastCraft.output.value,kind==='raw-green'?'12':'8');
      await command({type:'undo'});assert.equal((await state()).equipment[0].quantity,'3');
      const result=await command({type:'fuse',fuse:{id,targetTier:2,includeWorn:true,quantity:'9'}});assert.equal(BigInt(result.result.spent)-BigInt(before.state.spent),BigInt(price));
      await command({type:'undo'});await command({type:'equip',items:before.state.equipment});
    }
    const green=await command({type:'original.put',kind:'raw-green',tier:0,value:'10',quantity:'729'});await command({type:'fuse',fuse:{id:green.result.createdId,targetTier:6,includeWorn:false,quantity:'729'}});assert.equal((await state()).lastCraft.output.value,'120');assert.equal((await state()).lastCraft.price,'40824');await command({type:'undo'});
    assert.equal((await state()).spent,before.state.spent);
  }


  async function homogeneousScenarios(){
    const before=await snapshot();await command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'20'});const g=(await inventory('work')).find(g=>g.kind==='🅾'&&g.tier===1&&g.value==='10');
    await command({type:'equip',items:[{id:g.id,quantity:'3'}]});
    const preview=async fuse=>{const s=await state(),r=await fetch(base+'/api/fuse-preview',{method:'POST',headers,body:JSON.stringify({revision:s.revision,experiment:s.experiment,fuse})});assert.equal(r.status,200);return r.json();};
    assert.equal((await preview({id:g.id,targetTier:3,includeWorn:false,quantity:'17'})).maxCount,'1');const plan=await preview({id:g.id,targetTier:3,includeWorn:true,quantity:'20'});assert.equal(plan.maxCount,'2');assert.equal(plan.price,'1008');
    const applied=await command({type:'fuse',fuse:{id:g.id,targetTier:3,includeWorn:true,quantity:'20',count:'2'}});assert.equal(applied.result.equipment[0].quantity,'2');await command({type:'undo'});assert.equal((await state()).equipment[0].quantity,'3');await command({type:'equip',items:before.state.equipment});assert.equal((await state()).spent,before.state.spent);
  }

  function grouped(items){const groups=new Map();for(const g of items){const key=JSON.stringify([g.kind,g.tier,g.value,g.crit??null]);groups.set(key,(groups.get(key)??0n)+BigInt(g.quantity));}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,n])=>[key,n.toString()]);}
  async function baselineScenarios(){
    assert.equal((await state()).baseline,null);
    await command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'20'});
    const before=await snapshot(),captureA=await command({type:'baseline.capture',replace:false}),a=await snapshot();
    assert.deepEqual({...a.state,baseline:before.state.baseline,revision:before.state.revision},before.state);assert.deepEqual(a.original,before.original);assert.deepEqual(a.work,before.work);
    assert.equal(a.state.baseline.quantity,a.original.reduce((n,g)=>n+BigInt(g.quantity),0n).toString());assert.equal(a.state.baseline.entries,String(a.original.length));assert.equal(a.baselineGroups.length,a.original.length);
    const source=a.work.find(g=>g.kind==='🅾'&&g.tier===1&&g.value==='10');
    await command({type:'fuse',fuse:{id:source.id,targetTier:3,includeWorn:true,quantity:'20',count:'2'}});
    assert.equal(BigInt((await state()).spent)-BigInt(a.state.spent),1008n);assert.deepEqual(await inventory('original'),a.original);assert.deepEqual((await snapshot()).baselineGroups,a.baselineGroups);
    await command({type:'level',value:'307'});const result=(await inventory('work')).find(g=>g.kind==='🅾'&&g.tier===3&&g.value==='23');await command({type:'equip',items:[{id:result.id,quantity:'1'}]});
    const row=a.original.find(g=>g.kind==='🅾'&&g.tier===1&&g.value==='10');await command({type:'original.put',id:row.id,kind:'🅾',tier:1,value:'11',quantity:'8'});await command({type:'original.put',kind:'💚',tier:6,value:'9007199254740993',quantity:'3'});
    const editable=await inventory('original');await command({type:'reset'});assert.deepEqual(grouped(await inventory('work')),grouped(editable));assert.deepEqual((await state()).baseline,a.state.baseline);assert.deepEqual((await snapshot()).baselineGroups,a.baselineGroups);
    const resetState=await state(),restoreA=await command({type:'baseline.restore'}),restored=await snapshot();assert.notEqual(restored.state.experiment,resetState.experiment);assert.equal(restored.state.level,'307');assert.equal(restored.state.spent,'0');assert.equal(restored.state.lastCraft,null);assert.deepEqual(restored.state.equipment,[]);assert.deepEqual(restored.original,a.original);assert.deepEqual(grouped(restored.work),grouped(a.original));assert.deepEqual(restored.baselineGroups,a.baselineGroups);assert.deepEqual(restored.state.baseline,a.state.baseline);
    const input=restored.work.find(g=>g.kind==='🅾'&&g.tier===1&&g.value==='10');await command({type:'fuse',fuse:{id:input.id,targetTier:2,includeWorn:false,quantity:'3',count:'1'}});const latest=await snapshot();
    for(const receipt of [captureA,restoreA]){const r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(receipt.payload)});assert.equal(r.status,200);assert.deepEqual(await r.json(),receipt.result);assert.deepEqual(await snapshot(),latest);}
  }

  const mode=process.argv[1];
  if(mode==='seed'){
    const current=new Database('/data/cheapshot.sqlite');
    if(current.pragma('user_version',{simple:true})===5){
      const fixture=JSON.parse(readFileSync('/tmp/schema5.json','utf8'));
      current.pragma('foreign_keys=OFF');current.transaction(()=>{for(const [name,rows] of Object.entries(fixture.tables)){if(['sessions','oidc_codes'].includes(name))continue;current.prepare('DELETE FROM '+name).run();for(const row of rows){const cols=Object.keys(row);current.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c]));}}})();assert.deepEqual(current.pragma('foreign_key_check'),[]);
      current.close();let homogeneousReceipt;
      if((await get('/version')).version==='f944acb6435a9671cef6db5fc500b79a71d21133'){const g=(await inventory('work')).find(g=>g.kind==='raw-purple');homogeneousReceipt=await command({type:'fuse',fuse:{id:g.id,targetTier:1,includeWorn:false,quantity:'3',count:'1'}});}
      const oldDb=new Database('/data/cheapshot.sqlite'),receipts=oldDb.prepare('SELECT * FROM commands ORDER BY owner,key').all();oldDb.close();process.stdout.write(JSON.stringify({...await snapshot(),receipt:fixture.receipt,expired:fixture.expired,receipts,schema:5,...(homogeneousReceipt?{homogeneousReceipt}:{})}));return;
    }current.close();
    const probe=new Database('/data/cheapshot.sqlite'),version=probe.pragma('user_version',{simple:true});
    if(version===4){
      // Frozen synthetic DB was generated by the unchanged canonical TASK-005 Store.
      const fixture=JSON.parse(readFileSync('/tmp/schema4.json','utf8'));
      probe.pragma('foreign_keys=OFF');probe.transaction(()=>{for(const [name,rows] of Object.entries(fixture.tables)){if(['sessions','oidc_codes'].includes(name))continue;probe.prepare('DELETE FROM '+name).run();for(const row of rows){const cols=Object.keys(row);probe.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c]));}}})();
      assert.deepEqual(probe.pragma('foreign_key_check'),[]);
      const receipts=probe.prepare('SELECT * FROM commands ORDER BY owner,key').all();probe.close();
      process.stdout.write(JSON.stringify({...await snapshot(),receipt:fixture.receipt,receipts,schema:4}));return;
    }probe.close();
    await command({type:'level',value:'200'});
    await command({type:'original.put',kind:'💢',tier:3,value:'18',quantity:'6'});
    const second=await command({type:'original.put',kind:'💢',tier:3,value:'18',quantity:'6'});
    for(let i=0;i<2;i++){
      const g=(await inventory('work')).find(g=>g.tier===3);
      await command({type:'craft',items:[{id:g.id,quantity:'3',worn:'0'}]});
    }
    const targets=(await inventory('work')).filter(g=>g.tier===4);assert.equal(targets.reduce((n,g)=>n+BigInt(g.quantity),0n),2n);
    await command({type:'equip',items:targets.map(g=>({id:g.id,quantity:g.quantity}))});
    const receipt=await command({type:'original.put',id:second.result.createdId,kind:'💚',tier:2,value:'100',quantity:'5'});
    const db=new Database('/data/cheapshot.sqlite');const schema=db.pragma('user_version',{simple:true});assert.ok(schema===2||schema===3);
    const receipts=db.prepare('SELECT * FROM commands ORDER BY owner,key').all();db.close();
    process.stdout.write(JSON.stringify({...await snapshot(),receipt,receipts,schema}));return;
  }
  if(mode==='migrated'){
    const previous=JSON.parse(process.argv[2]),s=await snapshot();
    assert.equal(s.state.revision,(BigInt(previous.state.revision)+(previous.schema>=4?0n:1n)).toString());
    if(previous.schema===5){
      assert.deepEqual(s,{state:{...previous.state,baseline:null},original:previous.original,work:previous.work,baselineGroups:[]});const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),6);assert.deepEqual(db.prepare('SELECT * FROM commands ORDER BY owner,key').all(),previous.receipts);db.close();
      const replay=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(previous.receipt.payload)});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),previous.receipt.result);
      let stateNow=await state();const rejected=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify({...previous.receipt.payload,key:crypto.randomUUID(),revision:stateNow.revision,experiment:stateNow.experiment})});assert.equal(rejected.status,400);assert.equal((await rejected.json()).error,'HOMOGENEOUS_GROUP_REQUIRED');
      const expired=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(previous.expired)});assert.equal(expired.status,410);
      if(previous.homogeneousReceipt){const replayMax=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(previous.homogeneousReceipt.payload)});assert.equal(replayMax.status,200);assert.deepEqual(await replayMax.json(),previous.homogeneousReceipt.result);await command({type:'undo'});}
      await rawScenarios();await command({type:'undo'});await command({type:'undo'});assert.equal((await state()).spent,'0');assert.equal((await inventory('work')).find(g=>g.kind==='raw-purple').quantity,'38');await command({type:'reset'});await homogeneousScenarios();await baselineScenarios();
      process.stdout.write(JSON.stringify({schema5_state_rows_receipts_preserved:'passed',task007_homogeneous_replay_undo:previous.homogeneousReceipt?'passed':'not_applicable',baseline_capture_restore_isolation:'passed',old_mixed_replay_new_mixed_reject:'passed',raw_equipment_single_batch_undo:'passed',all_old_undo_late_stock_reset:'passed',automatic_max_count_worn:'passed'}));return;
    }
    if(previous.schema===4){
      assert.deepEqual(s,{state:{...previous.state,baseline:null},original:previous.original,work:previous.work,baselineGroups:[]});
      const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),6);assert.deepEqual(db.prepare('SELECT * FROM commands ORDER BY owner,key').all(),previous.receipts);db.close();
      const replay=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(previous.receipt.payload)});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),previous.receipt.result);
      await rawScenarios();await command({type:'undo'});await command({type:'undo'});assert.equal((await state()).spent,'0');assert.equal((await inventory('work')).find(g=>g.tier===1).quantity,'29');await command({type:'reset'});await homogeneousScenarios();await baselineScenarios();
      process.stdout.write(JSON.stringify({schema4_state_rows_receipts_preserved:'passed',baseline_capture_restore_isolation:'passed',raw_equipment_single_batch_undo:'passed',all_old_undo_late_stock_reset:'passed'}));return;
    }
    for(const k of ['level','spent','experiment','started'])assert.deepEqual(s.state[k],previous.state[k]);
    assert.deepEqual(legacyGroups(s.original),previous.original);assert.equal(s.state.stats.damage,previous.state.stats.damage);assert.equal(s.state.stats.health,previous.state.stats.health);assert.equal(s.state.stats.crit,null);assert.equal(s.state.stats.critIncomplete,true);
    if(previous.schema===3)assert.deepEqual(legacyGroups(s.work),previous.work);
    const target=s.work.filter(g=>g.tier===4);assert.equal(target.length,1);assert.equal(target[0].quantity,'2');
    assert.deepEqual(s.state.equipment,[{id:target[0].id,quantity:'2'}]);
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),6);
    assert.deepEqual(db.prepare('SELECT * FROM commands ORDER BY owner,key').all(),previous.receipts);db.close();
    let r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(previous.receipt.payload)});assert.equal(r.status,200);assert.deepEqual(await r.json(),previous.receipt.result);
    r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify({...previous.receipt.payload,key:crypto.randomUUID()})});assert.equal(r.status,409);
    for(let i=0;i<2;i++){
      const g=(await inventory('work')).find(g=>g.tier===3);
      await command({type:'craft',items:[{id:g.id,quantity:'3',worn:'0'}]});
    }
    assert.equal((await inventory('work')).length,1);assert.equal((await inventory('work'))[0].quantity,'4');
    await command({type:'craft',items:[{id:target[0].id,quantity:'3',worn:'1'}]});
    await command({type:'undo'});assert.equal((await inventory('work'))[0].quantity,'4');
    for(let i=0;i<4;i++)await command({type:'undo'});
    const undone=await snapshot();assert.equal(undone.state.spent,'0');assert.equal(undone.state.equipment.length,0);
    assert.equal(undone.work.length,1);assert.equal(undone.work[0].quantity,'12');assert.equal(undone.work[0].kind,'💢');
    const input=undone.work[0];
    const unknownState=await state(),unknown=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify({key:crypto.randomUUID(),revision:unknownState.revision,experiment:unknownState.experiment,action:{type:'fuse',fuse:{id:input.id,targetTier:5,includeWorn:false}}})});assert.equal(unknown.status,400);assert.equal((await unknown.json()).error,'CRIT_REQUIRED');
    await command({type:'craft',items:[{id:input.id,quantity:'3',worn:'0'}]});
    let result=(await inventory('work')).find(g=>g.tier===4);assert.equal(result.crit,null);
    await command({type:'work.crit',id:result.id,quantity:'1',worn:'0',crit:'44'});
    await command({type:'original.put',kind:'💢',tier:4,value:result.value,quantity:'2',crit:'44'});
    await command({type:'undo'});
    assert.equal((await inventory('work')).find(g=>g.tier===4).quantity,'2');
    assert.equal((await inventory('work')).find(g=>g.tier===3).quantity,'12');
    await command({type:'work.crit',id:input.id,quantity:'12',worn:'0',crit:'15'});
    const known=(await inventory('work')).find(g=>g.tier===3);
    await command({type:'fuse',fuse:{id:known.id,targetTier:5,includeWorn:false}});
    result=(await inventory('work')).find(g=>g.tier===5&&g.crit==='35');assert.equal(result.crit,'35');
    await command({type:'equip',items:[{id:result.id,quantity:'1'}]});assert.equal((await state()).stats.crit,'105');
    await command({type:'undo'});await command({type:'reset'});const reset=await snapshot();
    assert.equal(reset.work.length,3);assert.equal(reset.work.find(g=>g.kind==='💚').quantity,'5');
    await rawScenarios();await homogeneousScenarios();await baselineScenarios();
    process.stdout.write(JSON.stringify({raw_equipment_single_batch_undo:'passed',migration:'passed',new_crafts_worn_and_all_legacy_undo:'passed',baseline_capture_restore_isolation:'passed',batch_refine_add_undo_known_crit:'passed',reset:'passed',receipts_and_stale_revision:'passed'}));return;
  }
  if(mode==='restarted'){
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),6);db.close();process.stdout.write(JSON.stringify({schema:6}));return;
  }
  if(mode==='snapshot'){process.stdout.write(JSON.stringify(await snapshot()));return;}
  if(mode==='change-after-backup'){
    const db=new Database('/data/cheapshot.sqlite'),receipt=db.prepare('SELECT payload,result FROM commands WHERE owner=?').all(owner).find(c=>{if(c.result==='')return false;const p=JSON.parse(c.payload);return p.action.type==='baseline.capture'&&!p.action.replace;});db.close();assert.ok(receipt);
    await command({type:'original.put',kind:'💚',tier:6,value:'9007199254740993',quantity:'5'});await command({type:'baseline.capture',replace:true});await command({type:'level',value:'777'});const latest=await snapshot();
    const replay=await fetch(base+'/api/commands',{method:'POST',headers,body:receipt.payload});assert.equal(replay.status,200);assert.deepEqual(await replay.json(),JSON.parse(receipt.result));assert.deepEqual(await snapshot(),latest);process.stdout.write('changed snapshot and state; old capture retry preserved both');return;
  }
  if(mode==='baseline-after-restore'){
    const checkpoint=JSON.parse(process.argv[2]);assert.deepEqual(await snapshot(),checkpoint);await command({type:'undo'});await command({type:'baseline.restore'});const restored=await snapshot();assert.deepEqual(restored.original,checkpoint.original);assert.deepEqual(restored.baselineGroups,checkpoint.baselineGroups);assert.deepEqual(restored.state.baseline,checkpoint.state.baseline);assert.equal(restored.state.spent,'0');assert.equal(restored.state.lastCraft,null);process.stdout.write('restored snapshot A and active undo; restart/full return passed');return;
  }
  if(mode==='check-checkpoint'){assert.deepEqual(await snapshot(),JSON.parse(process.argv[2]));process.stdout.write('restored state exact');return;}
  if(mode==='rollback'){
    const previous=JSON.parse(process.argv[2]),s=await snapshot();
    assert.deepEqual(s, {state:previous.state,original:previous.original,work:previous.work});
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),previous.schema);db.close();
    process.stdout.write('rollback exact predecessor state and schema passed');return;
  }
  throw Error('unknown phase');
})().catch(e=>{console.error(e);process.exit(1);});
