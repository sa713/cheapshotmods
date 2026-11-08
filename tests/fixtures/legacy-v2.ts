import Database from 'better-sqlite3';
import {readFileSync,rmSync} from 'node:fs';

export type LegacyRow = Record<string,string|number|null>;
export const legacy = JSON.parse(readFileSync(new URL('./v2-mod-stacks.json',import.meta.url),'utf8')) as {
  version: number; ids: Record<string,string>; tables: Record<string,LegacyRow[]>;
};

// Isolated synthetic data emitted by the real pre-fix Store. Never use this
// test helper or its destructive replacement mode against a live database.
export function seedLegacy(path:string,replace=false) {
  if (replace) for (const suffix of ['', '-wal', '-shm']) rmSync(path+suffix,{force:true});
  const db=new Database(path);
  db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
  db.exec(`
    CREATE TABLE players(owner TEXT PRIMARY KEY,revision TEXT NOT NULL,level TEXT NOT NULL,experiment TEXT NOT NULL,started INTEGER NOT NULL,spent TEXT NOT NULL,equipment TEXT NOT NULL);
    CREATE TABLE groups(owner TEXT NOT NULL REFERENCES players(owner),scope TEXT NOT NULL CHECK(scope IN ('original','work')),id TEXT NOT NULL,kind TEXT NOT NULL,tier INTEGER NOT NULL,value TEXT NOT NULL,quantity TEXT NOT NULL,PRIMARY KEY(owner,scope,id));
    CREATE TABLE history(seq INTEGER PRIMARY KEY,owner TEXT NOT NULL REFERENCES players(owner),body TEXT NOT NULL);
    CREATE INDEX history_owner ON history(owner,seq);
    CREATE TABLE commands(owner TEXT NOT NULL REFERENCES players(owner),key TEXT NOT NULL,payload TEXT NOT NULL,result TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(owner,key));
    CREATE INDEX command_expiry ON commands(created) WHERE result<>'';
    CREATE TABLE sessions(hash TEXT PRIMARY KEY,owner TEXT REFERENCES players(owner),csrf TEXT NOT NULL,expires INTEGER NOT NULL,flow TEXT);
    CREATE INDEX session_expiry ON sessions(expires);
    CREATE TABLE oidc_codes(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
    PRAGMA user_version=2;
  `);
  db.transaction(()=>{
    for (const [table,rows] of Object.entries(legacy.tables)) for (const row of rows) {
      const columns=Object.keys(row);
      db.prepare('INSERT INTO '+table+' ('+columns.join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').run(...Object.values(row));
    }
  }).immediate();
  db.close();
}
