import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateDatabasePath } from './database-path.js';
import { craft, integer, inputInteger, keys, mod, record, requireThat, stats, type Equipped, type Group, type Mod } from '@chm/rules';
import {migrateModStacks, type Undo} from './mod-stacks.js';

interface Player { owner: string; revision: string; level: string; experiment: string; started: number; spent: string; equipment: string }
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
  constructor(path: string, private afterMods?: () => void) {
    validateDatabasePath(path, true);
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON'); this.db.pragma('busy_timeout = 5000');
    try {
      const version = this.db.pragma('user_version', {simple:true});
      requireThat(version === 0 || version === 1 || version === 2 || version === 3, 'UNKNOWN_DATABASE_VERSION', 503);
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
      if (version !== 3) this.db.transaction(()=>{
        if (this.db.pragma('user_version',{simple:true})!==3) migrateModStacks(this.db);
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
    this.sql('INSERT OR IGNORE INTO players VALUES (?, ?, ?, ?, 0, ?, ?)').run(owner,'0','1',randomUUID(),'0','[]');
    return this.sql('SELECT * FROM players WHERE owner=?').get(owner) as Player;
  }
  group(owner: string, scope: string, id: unknown): Group {
    requireThat(typeof id === 'string', 'INVALID_GROUP');
    const g = this.sql('SELECT id,kind,tier,value,quantity FROM groups WHERE owner=? AND scope=? AND id=?').get(owner,scope,id) as Group | undefined;
    requireThat(g, 'GROUP_NOT_FOUND', 404); return g;
  }
  put(owner: string, scope: string, g: Group) {
    this.sql('INSERT INTO groups VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner,scope,id) DO UPDATE SET kind=excluded.kind,tier=excluded.tier,value=excluded.value,quantity=excluded.quantity').run(owner,scope,g.id,g.kind,g.tier,g.value,g.quantity);
  }
  quantity(owner: string, id: string, quantity: bigint) {
    if (quantity === 0n) this.sql("DELETE FROM groups WHERE owner=? AND scope='work' AND id=?").run(owner,id);
    else this.sql("UPDATE groups SET quantity=? WHERE owner=? AND scope='work' AND id=?").run(quantity.toString(),owner,id);
  }
  private workStack(owner:string, m:Mod) {
    return this.sql("SELECT id,kind,tier,value,quantity FROM groups WHERE owner=? AND scope='work' AND kind=? AND tier=? AND value=?").get(owner,m.kind,m.tier,m.value) as Group|undefined;
  }
  private adjustWork(owner:string, m:Mod, delta:bigint, preferredId?:string): string {
    const current=this.workStack(owner,m), quantity=BigInt(current?.quantity??'0')+delta;
    requireThat(quantity>=0n,'INCONSISTENT_MOD_HISTORY',503);
    if (current) {this.quantity(owner,current.id,quantity);return current.id;}
    requireThat(quantity>0n,'INCONSISTENT_MOD_HISTORY',503);
    const occupied=preferredId && this.sql("SELECT 1 FROM groups WHERE owner=? AND scope='work' AND id=?").get(owner,preferredId);
    const id=preferredId&&!occupied?preferredId:randomUUID();
    this.put(owner,'work',{...m,id,quantity:quantity.toString()});return id;
  }
  inventory(owner: string, scope: string, after = '', limit = 100) {
    requireThat(['original','work'].includes(scope) && Number.isInteger(limit) && limit >= 1 && limit <= 200, 'INVALID_PAGE');
    return this.sql('SELECT id,kind,tier,value,quantity FROM groups WHERE owner=? AND scope=? AND id>? ORDER BY id LIMIT ?').all(owner,scope,after,limit) as Group[];
  }
  summary(owner: string) {
    const p = this.player(owner), equipment = JSON.parse(p.equipment) as Equipped[];
    const items = equipment.map(e=>({...this.group(owner,'work',e.id),quantity:e.quantity}));
    const last = this.sql('SELECT body FROM history WHERE owner=? ORDER BY seq DESC LIMIT 1').get(owner) as {body:string}|undefined;
    return {revision:p.revision,level:p.level,experiment:p.experiment,started:!!p.started,spent:p.spent,equipment,equippedMods:items,stats:stats(p.level,items),lastCraft:last ? JSON.parse(last.body) as Undo : null};
  }
  copyOriginal(owner: string) {
    this.sql("DELETE FROM groups WHERE owner=? AND scope='work'").run(owner);
    const originals=this.sql("SELECT id,kind,tier,value,quantity FROM groups WHERE owner=? AND scope='original' ORDER BY id").all(owner) as Group[];
    for (const g of originals) this.adjustWork(owner,g,integer(g.quantity),g.id);
  }
  command(owner: string, raw: unknown) {
    const c = record(raw); keys(c,['key','revision','experiment','action']);
    requireThat(typeof c.key === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(c.key), 'INVALID_KEY');
    inputInteger(c.revision,true); requireThat(typeof c.experiment === 'string');
    const a = record(c.action); requireThat(typeof a.type === 'string');
    // Reject resource-heavy numeric fields before canonicalization or writes.
    if (a.type==='level') inputInteger(a.value);
    if (a.type==='original.put') { inputInteger(a.value); inputInteger(a.quantity); }
    if ((a.type==='equip'||a.type==='craft')&&Array.isArray(a.items)) for (const raw of a.items) {
      const item=record(raw); inputInteger(item.quantity);
      if (a.type==='craft') inputInteger(item.worn,true);
    }
    const payload = canonical(c);
    return this.db.transaction(()=>{
      const p = this.player(owner);
      const previous = this.sql('SELECT payload,result FROM commands WHERE owner=? AND key=?').get(owner,c.key as string) as {payload:string;result:string}|undefined;
      if (previous) {
        const expected=previous.result==='' ? createHash('sha256').update(payload).digest('hex') : payload;
        requireThat(previous.payload === expected, 'KEY_REUSED',409);
        requireThat(previous.result!=='','COMMAND_EXPIRED',410);
        return JSON.parse(previous.result) as ReturnType<Store['summary']> & {createdId?:string};
      }
      requireThat(p.revision === c.revision && p.experiment === c.experiment, 'REVISION_CONFLICT',409);
      let equipment = JSON.parse(p.equipment) as Equipped[];
      let createdId: string | undefined;
      switch (a.type) {
        case 'original.put': {
          keys(a,['type','id','kind','tier','value','quantity']);
          inputInteger(a.value); inputInteger(a.quantity); const m = mod(a);
          const previous=a.id!==undefined?this.group(owner,'original',a.id):undefined;
          const id = a.id as string | undefined ?? randomUUID();
          const group={...m,id,quantity:a.quantity as string};
          this.put(owner,'original',group); createdId = id;
          if (!p.started) {
            if (previous && (previous.kind!==m.kind || previous.tier!==m.tier || previous.value!==m.value)) {
              this.adjustWork(owner,previous,-integer(previous.quantity));
              this.adjustWork(owner,m,integer(group.quantity),id);
            } else this.adjustWork(owner,m,integer(group.quantity)-BigInt(previous?.quantity??'0'),id);
          }
          break;
        }
        case 'original.delete': {
          keys(a,['type','id']); const previous=this.group(owner,'original',a.id);
          this.sql("DELETE FROM groups WHERE owner=? AND scope='original' AND id=?").run(owner,a.id as string);
          if (!p.started) this.adjustWork(owner,previous,-integer(previous.quantity));
          break;
        }
        case 'level': keys(a,['type','value']); inputInteger(a.value); p.level = a.value as string; break;
        case 'reset':
          keys(a,['type']); this.copyOriginal(owner); equipment=[]; p.spent='0'; p.started=1; p.experiment=randomUUID();
          this.sql('DELETE FROM history WHERE owner=?').run(owner); break;
        case 'equip': {
          keys(a,['type','items']); requireThat(Array.isArray(a.items) && a.items.length <= 100, 'EQUIPMENT_LIMIT');
          const seen = new Set<string>(); let total = 0n;
          equipment = a.items.map(raw=>{
            const e = record(raw); keys(e,['id','quantity']); const g = this.group(owner,'work',e.id), count=inputInteger(e.quantity);
            requireThat(!seen.has(g.id) && count <= integer(g.quantity), 'INSUFFICIENT_MODS');
            seen.add(g.id); total += count; return {id:g.id,quantity:count.toString()};
          });
          requireThat(total <= 100n, 'EQUIPMENT_LIMIT'); p.started=1; break;
        }
        case 'craft': {
          keys(a,['type','items']); requireThat(Array.isArray(a.items) && a.items.length >= 1 && a.items.length <= 3, 'SELECT_THREE');
          const consumed: Group[] = [], seen = new Set<string>(), inputs: Group[] = [];
          const before = structuredClone(equipment);
          for (const raw of a.items) {
            const s = record(raw); keys(s,['id','quantity','worn']);
            const g = this.group(owner,'work',s.id), n=inputInteger(s.quantity), worn=inputInteger(s.worn,true);
            requireThat(!seen.has(g.id) && n <= 3n && worn <= n, 'INVALID_SELECTION'); seen.add(g.id);
            const e = equipment.find(e=>e.id===g.id), equipped=BigInt(e?.quantity??'0');
            requireThat(worn <= equipped && n-worn <= integer(g.quantity)-equipped, 'INSUFFICIENT_MODS');
            consumed.push({...g,quantity:n.toString()});
            for (let i=0n;i<n;i++) inputs.push(g);
            this.quantity(owner,g.id,integer(g.quantity)-n);
            if (e) e.quantity=(equipped-worn).toString();
          }
          const {result,price} = craft(inputs), id=this.adjustWork(owner,result,1n), output = {...result,id,quantity:'1'};
          this.afterMods?.();
          const undo: Undo = {consumed,output,equipment:before,price};
          this.sql('INSERT INTO history(owner,body) VALUES (?,?)').run(owner,JSON.stringify(undo));
          p.spent=(BigInt(p.spent)+BigInt(price)).toString(); equipment=equipment.filter(e=>e.quantity!=='0'); p.started=1; createdId=output.id;
          break;
        }
        case 'undo': {
          keys(a,['type']);
          const row = this.sql('SELECT seq,body FROM history WHERE owner=? ORDER BY seq DESC LIMIT 1').safeIntegers().get(owner) as {seq:bigint;body:string}|undefined;
          requireThat(row,'NOTHING_TO_UNDO',409); const undo=JSON.parse(row.body) as Undo;
          const output=this.group(owner,'work',undo.output.id);
          this.quantity(owner,output.id,integer(output.quantity)-1n);
          for (const g of undo.consumed) {
            const current = this.sql("SELECT quantity FROM groups WHERE owner=? AND scope='work' AND id=?").get(owner,g.id) as {quantity:string}|undefined;
            this.put(owner,'work',{...g,quantity:(BigInt(current?.quantity??'0')+BigInt(g.quantity)).toString()});
          }
          equipment=undo.equipment; p.spent=(BigInt(p.spent)-BigInt(undo.price)).toString();
          this.sql('DELETE FROM history WHERE seq=? AND owner=?').run(row.seq,owner); break;
        }
        default: requireThat(false,'UNKNOWN_COMMAND');
      }
      p.revision=(BigInt(p.revision)+1n).toString();
      this.sql('UPDATE players SET revision=?,level=?,experiment=?,started=?,spent=?,equipment=? WHERE owner=?').run(p.revision,p.level,p.experiment,p.started,p.spent,JSON.stringify(equipment),owner);
      const result = {...this.summary(owner),...(createdId ? {createdId} : {})};
      this.sql('INSERT INTO commands(owner,key,payload,result,created) VALUES (?,?,?,?,?)').run(owner,c.key as string,payload,JSON.stringify(result),Math.floor(Date.now()/1000));
      return result;
    }).immediate();
  }
  session(hash: string, now: number): Session | undefined {
    return this.sql('SELECT * FROM sessions WHERE hash=? AND expires>?').get(hash,now) as Session | undefined;
  }
  health() { this.sql('SELECT count(*) FROM players').get(); }
}
