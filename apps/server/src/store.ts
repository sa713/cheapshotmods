import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateDatabasePath } from './database-path.js';
import { boundedInteger, craft, fuseRequest, hasCrit, integer, inputInteger, keys, mod, modKey, planFuse, record, requireThat, stats, type Equipped, type Group, type Mod } from '@chm/rules';
import {migrateModStacks} from './mod-stacks.js';
import {migrateCrit,type History} from './crit-migration.js';
import {Lots,type Piece,type Range} from './lots.js';

interface Player { owner: string; revision: string; level: string; experiment: string; started: number; spent: string; equipment: string; worn_ranges:string }
export interface Session { hash: string; owner: string | null; csrf: string; expires: number; flow: string | null }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
export class Store {
  readonly db: Database.Database;
  private statements = new Map<string, Database.Statement>();
  private sql(query: string): Database.Statement {
    let statement=this.statements.get(query);
    if (!statement) { statement=this.db.prepare(query); this.statements.set(query,statement); }
    return statement;
  }
  constructor(path: string, private afterMods?: (phase?:string) => void) {
    validateDatabasePath(path, true);
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    try {
      const version = this.db.pragma('user_version', {simple:true});
      requireThat([0,1,2,3,4,5].includes(Number(version)), 'UNKNOWN_DATABASE_VERSION', 503);
      this.db.transaction(()=>{
      if (version === 0) this.db.transaction(()=>this.db.exec(`
        CREATE TABLE players(owner TEXT PRIMARY KEY, revision TEXT NOT NULL, level TEXT NOT NULL, experiment TEXT NOT NULL, started INTEGER NOT NULL, spent TEXT NOT NULL, equipment TEXT NOT NULL);
        CREATE TABLE groups(owner TEXT NOT NULL REFERENCES players(owner), scope TEXT NOT NULL CHECK(scope IN ('original','work')), id TEXT NOT NULL, kind TEXT NOT NULL, tier INTEGER NOT NULL, value TEXT NOT NULL, quantity TEXT NOT NULL, PRIMARY KEY(owner,scope,id));
        CREATE TABLE history(seq INTEGER PRIMARY KEY, owner TEXT NOT NULL REFERENCES players(owner), body TEXT NOT NULL);
        CREATE INDEX history_owner ON history(owner,seq);
        CREATE TABLE commands(owner TEXT NOT NULL REFERENCES players(owner), key TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(owner,key));
        CREATE TABLE sessions(hash TEXT PRIMARY KEY, owner TEXT REFERENCES players(owner), csrf TEXT NOT NULL, expires INTEGER NOT NULL, flow TEXT);
        CREATE INDEX session_expiry ON sessions(expires);
        CREATE TABLE oidc_codes(hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);
        PRAGMA user_version = 1;
      `)).immediate();
      if (version === 0 || version === 1) this.db.transaction(()=>this.db.exec(`
        ALTER TABLE commands ADD COLUMN created INTEGER NOT NULL DEFAULT 0;
        UPDATE commands SET created=unixepoch();
        CREATE INDEX command_expiry ON commands(created) WHERE result<>'';
        PRAGMA user_version = 2;
      `)).immediate();
      if (Number(version) < 3) this.db.transaction(()=>{
        if (this.db.pragma('user_version',{simple:true})!==3) migrateModStacks(this.db);
      }).immediate();
      if (Number(version)<4) migrateCrit(this.db,version===3,phase=>{if(Number(version)>0&&this.afterMods&&this.afterMods.length>0)this.afterMods(phase);});
      if (Number(version)<5) {
        if(Number(version)>0&&this.afterMods&&this.afterMods.length>0)this.afterMods('raw-migration');
        this.db.pragma('user_version=5');
      }
      }).immediate();
    } catch(error) {this.db.close();throw error;}
  }
  // Results last 30 days. Compact permanent receipts prevent an old key from
  // ever applying twice, including after reset, restore and session rotation.
  maintain(now = Math.floor(Date.now()/1000)) {
    this.db.transaction(()=>{
      this.sql('DELETE FROM sessions WHERE expires<=?').run(now);
      this.sql('DELETE FROM oidc_codes WHERE expires<=?').run(now);
      const old=this.sql("SELECT owner,key,payload FROM commands WHERE result<>'' AND created<? LIMIT 500").all(now-30*86400) as {owner:string;key:string;payload:string}[];
      for (const c of old) this.sql("UPDATE commands SET payload=?,result='' WHERE owner=? AND key=?").run(createHash('sha256').update(c.payload).digest('hex'),c.owner,c.key);
    }).immediate();
  }
  close() { this.db.close(); }
  player(owner: string): Player {
    this.sql('INSERT OR IGNORE INTO players(owner,revision,level,experiment,started,spent,equipment) VALUES (?,?,?,?,0,?,?)').run(owner,'0','1',randomUUID(),'0','[]');
    return this.sql('SELECT * FROM players WHERE owner=?').get(owner) as Player;
  }
  group(owner:string,scope:string,id:unknown):Group {
    requireThat(typeof id==='string','INVALID_GROUP');
    const g=this.sql("SELECT id,kind,tier,value,quantity,NULLIF(crit,'') AS crit FROM groups WHERE owner=? AND scope=? AND id=?").get(owner,scope,id) as Group|undefined;
    requireThat(g,'GROUP_NOT_FOUND',404);return g;
  }
  put(owner:string,scope:string,g:Group) {
    this.sql('INSERT INTO groups(owner,scope,id,kind,tier,value,quantity,crit) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,scope,id) DO UPDATE SET kind=excluded.kind,tier=excluded.tier,value=excluded.value,quantity=excluded.quantity,crit=excluded.crit').run(owner,scope,g.id,g.kind,g.tier,g.value,g.quantity,g.crit??'');
  }
  inventory(owner:string,scope:string,after='',limit=100) {
    requireThat(['original','work'].includes(scope)&&Number.isInteger(limit)&&limit>=1&&limit<=200,'INVALID_PAGE');
    return this.sql("SELECT id,kind,tier,value,quantity,NULLIF(crit,'') AS crit FROM groups WHERE owner=? AND scope=? AND id>? ORDER BY id LIMIT ?").all(owner,scope,after,limit) as Group[];
  }
  private all(owner:string,scope:string) {return this.sql("SELECT id,kind,tier,value,quantity,NULLIF(crit,'') AS crit FROM groups WHERE owner=? AND scope=? ORDER BY id").all(owner,scope) as Group[];}
  private lots(p:Player) {return new Lots(this.sql("SELECT origin,start,quantity,born,kind,tier,value,NULLIF(crit,'') AS crit FROM work_lots WHERE owner=?").all(p.owner) as Piece[],JSON.parse(p.worn_ranges) as Range[]);}
  private saveLots(p:Player,lots:Lots,preferred:Group[]=[]) {
    lots.compact();lots.validate();const previous=this.all(p.owner,'work'),totals=lots.totals(),groups:Group[]=[],occupied=new Set<string>();
    const originals=this.all(p.owner,'original'),ids=new Map<string,string>(),preferredByKey=new Map<string,Group>();
    for(const g of [...preferred,...originals])if(!preferredByKey.has(modKey(g)))preferredByKey.set(modKey(g),g);
    for(const g of previous)if(totals.has(modKey(g))){ids.set(modKey(g),g.id);occupied.add(g.id);}
    for(const [key,{m,quantity}] of totals){let id=ids.get(key);
      if(!id){const candidate=preferredByKey.get(key);id=candidate&&!occupied.has(candidate.id)?candidate.id:randomUUID();}
      occupied.add(id);groups.push({...m,id,quantity:quantity.toString()});}
    const nextById=new Map(groups.map(g=>[g.id,g]));
    for(const g of previous)if(!nextById.has(g.id))this.sql("DELETE FROM groups WHERE owner=? AND scope='work' AND id=?").run(p.owner,g.id);
    const beforeById=new Map(previous.map(g=>[g.id,g]));
    for(const g of groups){const old=beforeById.get(g.id);if(!old||modKey(g)!==modKey(old)||g.quantity!==old.quantity)this.put(p.owner,'work',g);}
    const wornByKey=new Map<string,bigint>();
    if(lots.worn.length)for(const piece of lots.pieces){const key=modKey(piece),n=lots.segments(piece).worn.reduce((s,w)=>s+BigInt(w.quantity),0n);if(n)wornByKey.set(key,(wornByKey.get(key)??0n)+n);}
    const equipment:Equipped[]=groups.flatMap(g=>{const n=wornByKey.get(modKey(g))??0n;return n?[{id:g.id,quantity:n.toString()}]:[];});
    this.sql('DELETE FROM work_lots WHERE owner=?').run(p.owner);
    for(const piece of lots.pieces)this.sql('INSERT INTO work_lots VALUES (?,?,?,?,?,?,?,?,?)').run(p.owner,piece.origin,piece.start,piece.quantity,piece.born,piece.kind,piece.tier,piece.value,piece.crit??'');
    p.equipment=JSON.stringify(equipment);p.worn_ranges=JSON.stringify(lots.worn);return groups;
  }
  private appendStock(p:Player,g:Group,n:bigint) {
    const old=this.sql("SELECT id,kind,tier,value,quantity,NULLIF(crit,'') AS crit FROM groups WHERE owner=? AND scope='work' AND kind=? AND tier=? AND value=? AND crit=?").get(p.owner,g.kind,g.tier,g.value,g.crit??'') as Group|undefined;
    const occupied=this.sql("SELECT 1 FROM groups WHERE owner=? AND scope='work' AND id=?").get(p.owner,g.id);
    this.put(p.owner,'work',{...g,id:old?.id??(occupied?randomUUID():g.id),quantity:(BigInt(old?.quantity??'0')+n).toString()});
    this.sql('INSERT INTO work_lots VALUES (?,?,?,?,?,?,?,?,?)').run(p.owner,randomUUID(),'0',n.toString(),p.revision,g.kind,g.tier,g.value,g.crit??'');
  }
  private originalLots(p:Player) {const lots=new Lots();for(const g of this.all(p.owner,'original'))lots.add(g,integer(g.quantity),p.revision);return lots;}
  summary(owner:string) {
    const p=this.player(owner),equipment=JSON.parse(p.equipment) as Equipped[];
    const items=equipment.map(e=>({...this.group(owner,'work',e.id),quantity:e.quantity}));
    const last=this.sql('SELECT body FROM history WHERE owner=? ORDER BY seq DESC LIMIT 1').get(owner) as {body:string}|undefined;
    return {revision:p.revision,level:p.level,experiment:p.experiment,started:!!p.started,spent:p.spent,equipment,equippedMods:items,stats:stats(p.level,items),lastCraft:last?JSON.parse(last.body) as History:null};
  }
  preview(owner:string,raw:unknown) {
    const c=record(raw);keys(c,['revision','experiment','fuse']);inputInteger(c.revision,true);
    return this.db.transaction(()=>{const p=this.sql('SELECT * FROM players WHERE owner=?').get(owner) as Player|undefined;
      requireThat(p&&p.revision===c.revision&&p.experiment===c.experiment,'REVISION_CONFLICT',409);
      return this.fusePlan(p,c.fuse);
    })();
  }
  private fusePlan(p:Player,raw:unknown) {
    const request=fuseRequest(raw),equipment=JSON.parse(p.equipment) as Equipped[];
    return planFuse(request,request.items.map(s=>({...this.group(p.owner,'work',s.id),equipped:equipment.find(e=>e.id===s.id)?.quantity??'0'})));
  }
  command(owner:string,raw:unknown) {
    const c=record(raw);keys(c,['key','revision','experiment','action']);
    requireThat(typeof c.key==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(c.key),'INVALID_KEY');
    inputInteger(c.revision,true);requireThat(typeof c.experiment==='string');
    const a=record(c.action);requireThat(typeof a.type==='string');
    // Bound raw numeric fields before canonicalization; semantic changes are
    // validated after permanent receipt lookup so old exact retries still work.
    if(a.type==='level')inputInteger(a.value);
    if(a.type==='original.put'){inputInteger(a.value);inputInteger(a.quantity);if(a.crit!=null)boundedInteger(a.crit,true,131);}
    if(a.type==='fuse')fuseRequest(a.fuse);
    if(['equip','craft'].includes(a.type)&&Array.isArray(a.items))for(const raw of a.items){const i=record(raw);inputInteger(i.quantity);if(a.type==='craft')inputInteger(i.worn,true);}
    if(a.type==='work.crit'||a.type==='original.crit'){boundedInteger(a.quantity,false,256);boundedInteger(a.crit,true,131);if(a.type==='work.crit')boundedInteger(a.worn,true,256);}
    const payload=canonical(c);
    return this.db.transaction(()=>{
      const p=this.player(owner),previous=this.sql('SELECT payload,result FROM commands WHERE owner=? AND key=?').get(owner,c.key as string) as {payload:string;result:string}|undefined;
      if(previous){const expected=previous.result===''?createHash('sha256').update(payload).digest('hex'):payload;
        requireThat(previous.payload===expected,'KEY_REUSED',409);requireThat(previous.result!=='','COMMAND_EXPIRED',410);
        return JSON.parse(previous.result) as ReturnType<Store['summary']>&{createdId?:string};}
      requireThat(p.revision===c.revision&&p.experiment===c.experiment,'REVISION_CONFLICT',409);
      const save=!(a.type==='level'||(p.started&&['original.put','original.delete','original.crit'].includes(a.type as string)));
      let lots=save&&a.type!=='reset'?this.lots(p):new Lots(),createdId:string|undefined,history:History|undefined;let restoreIds:Group[]=[];
      switch(a.type){
        case 'original.put':{
          keys(a,['type','id','kind','tier','value','quantity','crit']);const old=a.id!==undefined?this.group(owner,'original',a.id):undefined,m=mod(a);
          requireThat(!hasCrit(m.kind)||m.crit!=null||(old&&modKey(old)===modKey(m)),'CRIT_REQUIRED');
          const id=old?.id??randomUUID(),g={...m,id,quantity:a.quantity as string};this.put(owner,'original',g);createdId=id;
          if(!p.started)lots=this.originalLots(p);
          else if(!old||modKey(old)===modKey(g)){const delta=integer(g.quantity)-BigInt(old?.quantity??'0');if(delta>0n)this.appendStock(p,g,delta);}
          break;
        }
        case 'original.delete':{
          keys(a,['type','id']);this.group(owner,'original',a.id);this.sql("DELETE FROM groups WHERE owner=? AND scope='original' AND id=?").run(owner,a.id as string);
          if(!p.started)lots=this.originalLots(p);break;
        }
        case 'original.crit':{
          keys(a,['type','id','quantity','crit']);const g=this.group(owner,'original',a.id),n=boundedInteger(a.quantity,false,256);
          requireThat(hasCrit(g.kind)&&g.crit==null,'CRIT_ALREADY_KNOWN');requireThat(n<=integer(g.quantity),'INSUFFICIENT_MODS');
          const known={...g,crit:a.crit as string,quantity:n.toString()};
          if(n===integer(g.quantity)){this.put(owner,'original',known);createdId=g.id;}
          else{this.put(owner,'original',{...g,quantity:(integer(g.quantity)-n).toString()});createdId=randomUUID();this.put(owner,'original',{...known,id:createdId});}
          if(!p.started)lots=this.originalLots(p);break;
        }
        case 'work.crit':{
          keys(a,['type','id','quantity','worn','crit']);const g=this.group(owner,'work',a.id);
          requireThat(hasCrit(g.kind)&&g.crit==null,'CRIT_ALREADY_KNOWN');const wear=structuredClone(lots.worn);
          const pieces=lots.take(modKey(g),boundedInteger(a.quantity,false,256),boundedInteger(a.worn,true,256));
          lots.restore(pieces.map(piece=>({...piece,crit:a.crit as string})));lots.worn=wear;p.started=1;break;
        }
        case 'level':keys(a,['type','value']);p.level=a.value as string;break;
        case 'reset':keys(a,['type']);lots=this.originalLots(p);p.spent='0';p.started=1;p.experiment=randomUUID();this.sql('DELETE FROM history WHERE owner=?').run(owner);break;
        case 'equip':{
          keys(a,['type','items']);requireThat(Array.isArray(a.items)&&a.items.length<=100,'EQUIPMENT_LIMIT');const seen=new Set<string>();
          lots.equip(a.items.map(raw=>{const e=record(raw);keys(e,['id','quantity']);const g=this.group(owner,'work',e.id);requireThat(!seen.has(g.id),'INSUFFICIENT_MODS');seen.add(g.id);return {key:modKey(g),quantity:boundedInteger(e.quantity,false,256)};}));p.started=1;break;
        }
        case 'craft':{
          keys(a,['type','items']);requireThat(Array.isArray(a.items)&&a.items.length>0&&a.items.length<=3,'SELECT_THREE');
          const consumed:Group[]=[],inputs:Mod[]=[],pieces:Piece[]=[],seen=new Set<string>(),worn=structuredClone(lots.worn),equipment=JSON.parse(p.equipment) as Equipped[];
          for(const raw of a.items){const s=record(raw);keys(s,['id','quantity','worn']);const g=this.group(owner,'work',s.id),n=boundedInteger(s.quantity,false,256),wear=boundedInteger(s.worn,true,256);
            requireThat(!seen.has(g.id)&&n<=3n&&wear<=n,'INVALID_SELECTION');seen.add(g.id);consumed.push({...g,quantity:n.toString()});
            for(let i=0n;i<n;i++)inputs.push(g);pieces.push(...lots.take(modKey(g),n,wear));}
          const {result,price}=craft(inputs),output=lots.add(result,1n,p.revision);
          history={type:'single',consumed,output:{...result,id:'',quantity:'1'},equipment,price,ledger:{inputs:pieces,outputs:[{origin:output.origin,quantity:'1'}],worn}};
          p.spent=(BigInt(p.spent)+BigInt(price)).toString();p.started=1;break;
        }
        case 'fuse':{
          keys(a,['type','fuse']);const plan=this.fusePlan(p,a.fuse);this.afterMods?.('plan');const worn=structuredClone(lots.worn),equipment=JSON.parse(p.equipment) as Equipped[],pieces:Piece[]=[],consumed:Group[]=[];
          for(const s of plan.selected)if(s.used!=='0'){const g=this.group(owner,'work',s.id);pieces.push(...lots.take(modKey(g),BigInt(s.used),BigInt(s.worn)));consumed.push({...g,quantity:s.used});}
          const outputs=plan.outputs.map(o=>lots.add(o,integer(o.quantity),p.revision));this.afterMods?.('intermediate');
          history={type:'batch',consumed,output:{...plan.outputs[0]!,id:'',quantity:plan.outputs[0]!.quantity},outputs:plan.outputs.map(o=>({...o,id:''})),equipment,price:plan.price,plan,
            ledger:{inputs:pieces,outputs:outputs.map(o=>({origin:o.origin,quantity:o.quantity})),worn}};
          p.spent=(BigInt(p.spent)+BigInt(plan.price)).toString();p.started=1;break;
        }
        case 'undo':{
          keys(a,['type']);const row=this.sql('SELECT seq,body FROM history WHERE owner=? ORDER BY seq DESC LIMIT 1').safeIntegers().get(owner) as {seq:bigint;body:string}|undefined;
          requireThat(row,'NOTHING_TO_UNDO',409);const u=JSON.parse(row.body) as History;restoreIds=u.consumed;
          requireThat(u.ledger,'INCONSISTENT_MOD_HISTORY',503);lots.removeOutputs(u.ledger.outputs);lots.restore(u.ledger.inputs);lots.worn=structuredClone(u.ledger.worn);lots.validate();
          requireThat(BigInt(p.spent)>=BigInt(u.price),'INCONSISTENT_MOD_HISTORY',503);p.spent=(BigInt(p.spent)-BigInt(u.price)).toString();
          this.sql('DELETE FROM history WHERE seq=? AND owner=?').run(row.seq,owner);break;
        }
        default:requireThat(false,'UNKNOWN_COMMAND');
      }
      const groups=save?this.saveLots(p,lots,restoreIds):[];
      if(history){const resolve=(g:Group)=>({...g,id:groups.find(x=>modKey(x)===modKey(g))!.id});history.output=resolve(history.output);if(history.outputs)history.outputs=history.outputs.map(resolve);
        createdId=history.output.id;this.afterMods?.();this.sql('INSERT INTO history(owner,body) VALUES (?,?)').run(owner,JSON.stringify(history));this.afterMods?.('history');}
      p.revision=(BigInt(p.revision)+1n).toString();
      this.sql('UPDATE players SET revision=?,level=?,experiment=?,started=?,spent=?,equipment=?,worn_ranges=? WHERE owner=?').run(p.revision,p.level,p.experiment,p.started,p.spent,p.equipment,p.worn_ranges,owner);
      const result={...this.summary(owner),...(createdId?{createdId}:{})};
      this.sql('INSERT INTO commands(owner,key,payload,result,created) VALUES (?,?,?,?,?)').run(owner,c.key as string,payload,JSON.stringify(result),Math.floor(Date.now()/1000));this.afterMods?.('receipt');return result;
    }).immediate();
  }
  session(hash:string,now:number):Session|undefined {return this.sql('SELECT * FROM sessions WHERE hash=? AND expires>?').get(hash,now) as Session|undefined;}
  health(){this.sql('SELECT count(*) FROM players').get();}
}
