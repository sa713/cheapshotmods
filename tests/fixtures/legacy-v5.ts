import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export function seedV5(path:string){
  const f=JSON.parse(readFileSync(new URL('./v5-mixed-history.json',import.meta.url),'utf8'));
  const db=new Database(path);db.pragma('foreign_keys=OFF');db.exec(f.ddl.join(';'));
  for(const [name,rows] of Object.entries(f.tables) as [string,Record<string,unknown>[]][]){for(const row of rows){const cols=Object.keys(row);db.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c] as never));}}
  assert.deepEqual(db.pragma('foreign_key_check'),[]);db.pragma('user_version=5');db.close();return f;
}
