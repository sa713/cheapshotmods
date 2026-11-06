import { existsSync } from 'node:fs';
import { Store } from './store.js';
import { backupToFile } from './backup-file.js';
import { validateDatabasePath } from './database-path.js';
const [source,target]=process.argv.slice(2);
if (source===undefined || target===undefined) throw new Error('Usage: npm run backup -- SOURCE NEW_TARGET (target must not exist)');
validateDatabasePath(source);
validateDatabasePath(target);
if (existsSync(target)) throw new Error('Target already exists');
if (!existsSync(source)) throw new Error('Source does not exist');
const store=new Store(source);
try { await backupToFile(store.db,target); } finally { store.close(); }
