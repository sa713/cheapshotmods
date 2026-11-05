import {Store} from '/app/apps/server/dist/store.js';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const mode=process.argv[2];
const store=new Store(mode==='restore'?'/data/snapshot.sqlite':'/data/cheapshot.sqlite');
const owner='111';
const command=action=>{const s=store.summary(owner);return store.command(owner,{key:randomUUID(),revision:s.revision,experiment:s.experiment,action});};
try {
  if (mode==='seed') {
    const id=command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'6'}).createdId;
    command({type:'level',value:'9007199254740993'});
    command({type:'equip',items:[{id,quantity:'3'}]});
    command({type:'craft',items:[{id,quantity:'3',worn:'3'}]});
    const snapshot={state:store.summary(owner),original:store.inventory(owner,'original'),work:store.inventory(owner,'work')};
    writeFileSync('/data/expected.json',JSON.stringify(snapshot));writeFileSync('/backup/expected.json',JSON.stringify(snapshot));
    await store.db.backup('/backup/snapshot.sqlite');
    assert.equal(snapshot.state.spent,'84');
  } else {
    const expected=JSON.parse(readFileSync('/data/expected.json','utf8'));
    assert.deepEqual({state:store.summary(owner),original:store.inventory(owner,'original'),work:store.inventory(owner,'work')},expected);
    const undone=command({type:'undo'});assert.equal(undone.spent,'0');assert.equal(undone.level,'9007199254740993');assert.equal(undone.equipment[0].quantity,'3');
    const id=undone.equipment[0].id;assert.equal(command({type:'craft',items:[{id,quantity:'3',worn:'3'}]}).spent,'84');
  }
  console.log(JSON.stringify({mode,result:'passed'}));
} finally {store.close();}
