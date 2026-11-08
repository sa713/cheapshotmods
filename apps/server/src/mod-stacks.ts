import type Database from 'better-sqlite3';
import {craft, DomainError, integer, mod, requireThat, type Equipped, type Group} from '@chm/rules';

export interface Undo { consumed: Group[]; output: Group; equipment: Equipped[]; price: string }
const key = (g: Pick<Group,'kind'|'tier'|'value'>) => JSON.stringify([g.kind,g.tier,g.value]);

function group(g: Group) {
  mod(g); integer(g.quantity);
  requireThat(typeof g.id === 'string' && g.id.length > 0);
}
function equipment(value: unknown): Equipped[] {
  requireThat(Array.isArray(value));
  let count=0n;
  for (const e of value as Equipped[]) {
    requireThat(e && typeof e.id === 'string' && e.id.length > 0);
    count+=integer(e.quantity);
  }
  requireThat(count<=100n);
  return value as Equipped[];
}
function undo(body: string): Undo {
  const u=JSON.parse(body) as Undo;
  requireThat(u && Array.isArray(u.consumed) && u.consumed.length>=1 && u.consumed.length<=3);
  u.consumed.forEach(group); group(u.output); integer(u.price); equipment(u.equipment);
  requireThat(u.output.quantity==='1' && u.consumed.reduce((n,g)=>n+integer(g.quantity),0n)===3n);
  const calculated=craft(u.consumed.flatMap(g=>Array.from({length:Number(integer(g.quantity))},()=>g))).result;
  requireThat(key(calculated)===key(u.output));
  return u;
}
function combineEquipment(items: Equipped[], resolve: (id: string)=>string): Equipped[] {
  const totals=new Map<string,bigint>();
  for (const e of items) {
    const id=resolve(e.id); totals.set(id,(totals.get(id)??0n)+integer(e.quantity));
  }
  return [...totals].map(([id,quantity])=>({id,quantity:quantity.toString()}));
}

// Called inside one IMMEDIATE transaction. Old receipts and original input
// batches are deliberately untouched; only work/history references are folded.
export function migrateModStacks(db: Database.Database) {
  try {
    const players=db.prepare('SELECT owner,revision,equipment,spent FROM players').all() as {owner:string;revision:string;equipment:string;spent:string}[];
    for (const p of players) {
      const current=db.prepare("SELECT id,kind,tier,value,quantity FROM groups WHERE owner=? AND scope='work' ORDER BY id").all(p.owner) as Group[];
      const identity=new Map<string,string>(), canonical=new Map<string,string>(), active=new Set<string>();
      const register=(g:Group,present=false)=>{
        group(g); const k=key(g);
        requireThat(!identity.has(g.id)||identity.get(g.id)===k);
        identity.set(g.id,k);
        if (present || !active.has(k)) {
          const previous=canonical.get(k);
          if (!previous || g.id<previous) canonical.set(k,g.id);
        }
        if (present) active.add(k);
      };
      current.forEach(g=>register(g,true));
      for (const row of db.prepare('SELECT body FROM history WHERE owner=? ORDER BY seq').iterate(p.owner) as Iterable<{body:string}>) {
        const u=undo(row.body); u.consumed.forEach(g=>register(g)); register(u.output);
      }
      const resolve=(id:string)=>{
        const k=identity.get(id), id2=k===undefined?undefined:canonical.get(k);
        requireThat(id2!==undefined); return id2;
      };
      const combine=(groups:Group[])=>{
        const merged=new Map<string,Group>();
        for (const g of groups) {
          const id=resolve(g.id), previous=merged.get(id);
          merged.set(id,{...g,id,quantity:(integer(g.quantity)+BigInt(previous?.quantity??'0')).toString()});
        }
        return [...merged.values()];
      };
      const merged=combine(current), counts=new Map(merged.map(g=>[g.id,integer(g.quantity)]));
      const verifyEquipment=(items:Equipped[])=>{
        for (const e of items) requireThat(integer(e.quantity)<=(counts.get(e.id)??0n));
      };
      const equipped=combineEquipment(equipment(JSON.parse(p.equipment)),resolve);
      verifyEquipment(equipped);
      let spent=integer(p.spent,true);
      // Walk backwards to check that every retained undo remains executable.
      // This also checks references to groups absent from the current inventory.
      const latest=db.prepare('SELECT seq,body FROM history WHERE owner=? ORDER BY seq DESC LIMIT 100').safeIntegers();
      const older=db.prepare('SELECT seq,body FROM history WHERE owner=? AND seq<? ORDER BY seq DESC LIMIT 100').safeIntegers();
      type HistoryRow={seq:bigint;body:string};
      let batch=latest.all(p.owner) as HistoryRow[];
      // better-sqlite3 forbids writes while an iterator is active. Finish each
      // bounded read before updating, using the unchanged seq as a keyset cursor.
      while (batch.length) {
        for (const row of batch) {
          const u=undo(row.body), output={...u.output,id:resolve(u.output.id)}, consumed=combine(u.consumed);
          const snapshot=combineEquipment(u.equipment,resolve), n=counts.get(output.id)??0n;
          requireThat(n>=1n && spent>=integer(u.price));
          counts.set(output.id,n-1n); spent-=integer(u.price);
          for (const g of consumed) counts.set(g.id,(counts.get(g.id)??0n)+integer(g.quantity));
          verifyEquipment(snapshot);
          db.prepare('UPDATE history SET body=? WHERE owner=? AND seq=?').run(JSON.stringify({...u,consumed,output,equipment:snapshot}),p.owner,row.seq);
        }
        batch=older.all(p.owner,batch.at(-1)!.seq) as HistoryRow[];
      }
      requireThat(spent===0n);
      db.prepare("DELETE FROM groups WHERE owner=? AND scope='work'").run(p.owner);
      const insert=db.prepare("INSERT INTO groups(owner,scope,id,kind,tier,value,quantity) VALUES (?,'work',?,?,?,?,?)");
      for (const g of merged) insert.run(p.owner,g.id,g.kind,g.tier,g.value,g.quantity);
      db.prepare('UPDATE players SET revision=?,equipment=? WHERE owner=?').run((integer(p.revision,true)+1n).toString(),JSON.stringify(equipped),p.owner);
    }
    db.exec("CREATE UNIQUE INDEX groups_work_stack ON groups(owner,kind,tier,value) WHERE scope='work'; PRAGMA user_version=3;");
  } catch {
    // Do not echo database/history content or silently guess missing aliases.
    throw new DomainError('INCONSISTENT_MOD_HISTORY',503);
  }
}
