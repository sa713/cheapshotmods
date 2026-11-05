import {Store} from '/app/apps/server/dist/store.js';
import {backupToFile} from '/app/apps/server/dist/backup-file.js';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
const mode=process.argv[2];
if(mode==='http') {
  const origin=process.env.PUBLIC_BASE_URL,base='http://localhost:3000',expected=JSON.parse(readFileSync('/data/expected.json','utf8'));
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/version').then(r=>r.json())).version,process.env.BUILD_SHA);
  assert.equal((await fetch(base+'/api/state')).status,401);
  const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:111})});
  const check=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  params.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest()).update(check).digest('hex'));
  const login=await fetch(base+'/auth/mini',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({initData:params.toString()})});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],csrf=(await login.json()).csrf;
  const headers={origin,cookie,'x-csrf-token':csrf,'content-type':'application/json'};
  const get=path=>fetch(base+path,{headers}).then(async r=>{assert.equal(r.status,200);return r.json();});
  assert.deepEqual({state:await get('/api/state'),original:(await get('/api/inventory?scope=original')).items,work:(await get('/api/inventory?scope=work')).items},expected);
  const send=async action=>{const state=await get('/api/state');const r=await fetch(base+'/api/commands',{method:'POST',headers,body:JSON.stringify({key:randomUUID(),revision:state.revision,experiment:state.experiment,action})});assert.equal(r.status,200);return r.json();};
  const undone=await send({type:'undo'});assert.equal(undone.spent,'0');assert.equal(undone.level,'9007199254740993');assert.equal(undone.equipment[0].quantity,'3');
  assert.equal((await send({type:'craft',items:[{id:undone.equipment[0].id,quantity:'3',worn:'3'}]})).spent,'84');
  console.log(JSON.stringify({mode,result:'passed',transport:'HTTP server on restored volume'}));
} else {
const store=new Store('/data/cheapshot.sqlite');
const owner='111';
const command=action=>{const s=store.summary(owner);return store.command(owner,{key:randomUUID(),revision:s.revision,experiment:s.experiment,action});};
try {
  if (mode==='seed') {
    const id=command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'6'}).createdId;
    command({type:'level',value:'9007199254740993'});
    command({type:'equip',items:[{id,quantity:'3'}]});
    command({type:'craft',items:[{id,quantity:'3',worn:'3'}]});
    const snapshot={state:store.summary(owner),original:store.inventory(owner,'original'),work:store.inventory(owner,'work')};
    writeFileSync('/data/expected.json',JSON.stringify(snapshot),{mode:0o600});writeFileSync('/backup/expected.json',JSON.stringify(snapshot),{mode:0o600});
    await backupToFile(store.db,'/backup/cheapshot.sqlite');assert.equal(statSync('/backup/cheapshot.sqlite').mode&0o777,0o600);
    assert.equal(snapshot.state.spent,'84');
  } else {
    const expected=JSON.parse(readFileSync('/data/expected.json','utf8'));
    assert.deepEqual({state:store.summary(owner),original:store.inventory(owner,'original'),work:store.inventory(owner,'work')},expected);
    const undone=command({type:'undo'});assert.equal(undone.spent,'0');assert.equal(undone.level,'9007199254740993');assert.equal(undone.equipment[0].quantity,'3');
    const id=undone.equipment[0].id;assert.equal(command({type:'craft',items:[{id,quantity:'3',worn:'3'}]}).spent,'84');
  }
  console.log(JSON.stringify({mode,result:'passed'}));
} finally {store.close();}
}
