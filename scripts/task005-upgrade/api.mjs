import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
const {fetch,URLSearchParams}=globalThis;
const legacyGroups=items=>items.map(g=>({id:g.id,kind:g.kind,tier:g.tier,value:g.value,quantity:g.quantity}));
const origin='https://fixture.invalid';
const base='http://localhost:3000';
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:444,first_name:'Isolated migration fixture'})};
const secret=crypto.createHmac('sha256','WebAppData').update('legacy-fixture-bot-token').digest();
fields.hash=crypto.createHmac('sha256',secret).update(Object.keys(fields).sort().map(k=>k+'='+fields[k]).join('\n')).digest('hex');
(async()=>{
  const auth=await fetch(base+'/auth/mini',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({initData:new URLSearchParams(fields).toString()})});
  assert.equal(auth.status,200);
  const headers={origin,cookie:auth.headers.get('set-cookie').split(';')[0],'x-csrf-token':(await auth.json()).csrf,'content-type':'application/json'};
  const get=async path=>{const r=await fetch(base+path,{headers});assert.equal(r.status,200);return r.json();};
  const state=()=>get('/api/state');
  const inventory=async scope=>(await get('/api/inventory?scope='+scope)).items;
  const command=async action=>{const s=await state(),payload={key:crypto.randomUUID(),revision:s.revision,experiment:s.experiment,action};const r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(r.status,200);return {payload,result:await r.json()};};
  const snapshot=async()=>({state:await state(),original:await inventory('original'),work:await inventory('work')});
  const mode=process.argv[1];
  if(mode==='seed'){
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
    assert.equal(s.state.revision,(BigInt(previous.state.revision)+1n).toString());
    for(const k of ['level','spent','experiment','started'])assert.deepEqual(s.state[k],previous.state[k]);
    assert.deepEqual(legacyGroups(s.original),previous.original);assert.equal(s.state.stats.damage,previous.state.stats.damage);assert.equal(s.state.stats.health,previous.state.stats.health);assert.equal(s.state.stats.crit,null);assert.equal(s.state.stats.critIncomplete,true);
    if(previous.schema===3)assert.deepEqual(legacyGroups(s.work),previous.work);
    const target=s.work.filter(g=>g.tier===4);assert.equal(target.length,1);assert.equal(target[0].quantity,'2');
    assert.deepEqual(s.state.equipment,[{id:target[0].id,quantity:'2'}]);
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),4);
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
    await command({type:'fuse',fuse:{kind:'💢',targetTier:5,count:'1',items:[{id:input.id,quantity:'12',worn:'0'}]}});
    let result=(await inventory('work')).find(g=>g.tier===5);assert.equal(result.crit,null);
    await command({type:'work.crit',id:result.id,quantity:'1',worn:'0',crit:'44'});
    await command({type:'original.put',kind:'💢',tier:5,value:result.value,quantity:'2',crit:'44'});
    await command({type:'undo'});
    assert.equal((await inventory('work')).find(g=>g.tier===5).quantity,'2');
    assert.equal((await inventory('work')).find(g=>g.tier===3).quantity,'12');
    await command({type:'work.crit',id:input.id,quantity:'12',worn:'0',crit:'15'});
    const known=(await inventory('work')).find(g=>g.tier===3);
    await command({type:'fuse',fuse:{kind:'💢',targetTier:5,count:'1',items:[{id:known.id,quantity:'12',worn:'0'}]}});
    result=(await inventory('work')).find(g=>g.tier===5&&g.crit==='35');assert.equal(result.crit,'35');
    await command({type:'equip',items:[{id:result.id,quantity:'1'}]});assert.equal((await state()).stats.crit,'105');
    await command({type:'undo'});await command({type:'reset'});const reset=await snapshot();
    assert.equal(reset.work.length,3);assert.equal(reset.work.find(g=>g.kind==='💚').quantity,'5');
    process.stdout.write(JSON.stringify({migration:'passed',new_crafts_worn_and_all_legacy_undo:'passed',batch_refine_add_undo_known_crit:'passed',reset:'passed',receipts_and_stale_revision:'passed'}));return;
  }
  if(mode==='restarted'){
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),4);db.close();process.stdout.write(JSON.stringify({schema:4}));return;
  }
  if(mode==='snapshot'){process.stdout.write(JSON.stringify(await snapshot()));return;}
  if(mode==='change-after-backup'){await command({type:'level',value:'777'});process.stdout.write('changed');return;}
  if(mode==='check-checkpoint'){assert.deepEqual(await snapshot(),JSON.parse(process.argv[2]));process.stdout.write('restored state exact');return;}
  if(mode==='rollback'){
    const previous=JSON.parse(process.argv[2]),s=await snapshot();
    assert.deepEqual(s, {state:previous.state,original:previous.original,work:previous.work});
    const db=new Database('/data/cheapshot.sqlite');assert.equal(db.pragma('user_version',{simple:true}),previous.schema);db.close();
    process.stdout.write('rollback exact predecessor state and schema passed');return;
  }
  throw Error('unknown phase');
})().catch(e=>{console.error(e);process.exit(1);});
