import type Database from 'better-sqlite3';
import {craft,DomainError,integer,mod,modKey,requireThat,type Equipped,type Group} from '@chm/rules';
import {Lots,type LotUndo,type Piece} from './lots.js';
import type {Undo} from './mod-stacks.js';
export interface History extends Undo {type?:'single'|'batch';outputs?:Group[];plan?:unknown;ledger:LotUndo}
export function migrateCrit(db:Database.Database,bump:boolean,phase?:(phase:string)=>void) {
  try {
    db.exec(`ALTER TABLE groups ADD COLUMN crit TEXT NOT NULL DEFAULT '';
      ALTER TABLE players ADD COLUMN worn_ranges TEXT NOT NULL DEFAULT '[]';
      CREATE TABLE work_lots(owner TEXT NOT NULL REFERENCES players(owner),origin TEXT NOT NULL,start TEXT NOT NULL,quantity TEXT NOT NULL,born TEXT NOT NULL,kind TEXT NOT NULL,tier INTEGER NOT NULL,value TEXT NOT NULL,crit TEXT NOT NULL,PRIMARY KEY(owner,origin,start));
      DROP INDEX groups_work_stack;
      CREATE UNIQUE INDEX groups_work_stack ON groups(owner,kind,tier,value,crit) WHERE scope='work';`);
    const players=db.prepare('SELECT owner,revision,equipment,spent FROM players').all() as {owner:string;revision:string;equipment:string;spent:string}[];
    for(const p of players){
      const current=db.prepare("SELECT id,kind,tier,value,quantity,NULL AS crit FROM groups WHERE owner=? AND scope='work' ORDER BY id").all(p.owner) as Group[];
      const history=db.prepare('SELECT seq,body FROM history WHERE owner=? ORDER BY seq').safeIntegers().all(p.owner) as {seq:bigint;body:string}[];
      const descriptors=new Map<string,Group>(), totals=new Map<string,{m:Group;n:bigint}>();
      const register=(g:Group)=>{mod(g);integer(g.quantity);requireThat(typeof g.id==='string');const old=descriptors.get(g.id);
        requireThat(!old||modKey(old)===modKey(g));descriptors.set(g.id,{...g,crit:null});};
      const change=(g:Group,n:bigint)=>{const k=modKey(g),old=totals.get(k),next=(old?.n??0n)+n;requireThat(next>=0n);totals.set(k,{m:g,n:next});};
      current.forEach(g=>{register(g);change(g,BigInt(g.quantity));});
      const entries=history.map(row=>{const u=JSON.parse(row.body) as Undo;
        requireThat(Array.isArray(u.consumed)&&u.consumed.length>0&&u.consumed.length<=3&&u.output.quantity==='1');
        u.consumed.forEach(register);register(u.output);requireThat(u.consumed.reduce((n,g)=>n+integer(g.quantity),0n)===3n);
        const calculated=craft(u.consumed.flatMap(g=>Array.from({length:Number(g.quantity)},()=>g)));
        requireThat(modKey(calculated.result)===modKey(u.output)&&calculated.price===u.price);
        requireThat(Array.isArray(u.equipment));return {...row,u};});
      function equipment(items:Equipped[],lots:Lots){const seen=new Set<string>();lots.equip(items.map(e=>{
        requireThat(!seen.has(e.id));seen.add(e.id);const g=descriptors.get(e.id);requireThat(g);return {key:modKey(g),quantity:integer(e.quantity)};}));}
      let spent=integer(p.spent,true);
      for(const {u} of [...entries].reverse()){change(u.output,-1n);for(const g of u.consumed)change(g,integer(g.quantity));spent-=integer(u.price);requireThat(spent>=0n);}
      requireThat(spent===0n);
      const max=entries.at(-1)?.seq??0n, lots=new Lots();
      for(const {m,n} of totals.values())if(n)lots.add({...m,crit:null},n,(-max-2n).toString());
      for(const {seq,u} of entries){equipment(u.equipment,lots);const worn=structuredClone(lots.worn),inputs:Piece[]=[];
        for(const g of u.consumed){const n=integer(g.quantity),key=modKey(g),stock=lots.totals().get(key)?.quantity??0n,free=stock-lots.wornCount(key);
          inputs.push(...lots.take(key,n,n>free?n-free:0n));}
        const output=lots.add({...u.output,crit:null},1n,(seq-max-1n).toString());
        const ledger:LotUndo={inputs,outputs:[{origin:output.origin,quantity:'1'}],worn};
        db.prepare('UPDATE history SET body=? WHERE owner=? AND seq=?').run(JSON.stringify({...u,consumed:u.consumed.map(g=>({...g,crit:null})),output:{...u.output,crit:null},type:'single',ledger}),p.owner,seq);
      }
      const expected=new Map(current.map(g=>[modKey(g),BigInt(g.quantity)])),actual=lots.totals();
      requireThat(actual.size===expected.size&&[...actual].every(([k,v])=>expected.get(k)===v.quantity));
      equipment(JSON.parse(p.equipment) as Equipped[],lots);lots.validate();
      const insert=db.prepare('INSERT INTO work_lots VALUES (?,?,?,?,?,?,?,?,?)');
      for(const piece of lots.pieces)insert.run(p.owner,piece.origin,piece.start,piece.quantity,piece.born,piece.kind,piece.tier,piece.value,piece.crit??'');
      db.prepare('UPDATE players SET revision=?,worn_ranges=? WHERE owner=?').run(bump?(BigInt(p.revision)+1n).toString():p.revision,JSON.stringify(lots.worn),p.owner);
    }
    phase?.('migration');db.pragma('user_version=4');
  }catch(error){if(error instanceof DomainError)throw error;throw new DomainError('INCONSISTENT_MOD_HISTORY',503);}
}
