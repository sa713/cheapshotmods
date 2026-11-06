import {closeSync, fchmodSync, fstatSync, lstatSync, openSync, unlinkSync} from 'node:fs';
import { validateDatabasePath } from './database-path.js';

export async function backupToFile(db: {backup(path: string): Promise<unknown>}, target: string) {
  validateDatabasePath(target);
  // Exclusive creation prevents overwriting an existing target, including a
  // symlink. Permissions are private before SQLite opens the destination.
  const fd=openSync(target,'wx',0o600), created=fstatSync(fd);
  try {
    fchmodSync(fd,0o600);
    await db.backup(target);
  } catch (error) {
    // Remove only the file this operation created, never a replaced path.
    try {const current=lstatSync(target);if(current.dev===created.dev&&current.ino===created.ino)unlinkSync(target);}
    catch (cleanup) {if (!(cleanup && typeof cleanup==='object' && 'code' in cleanup && cleanup.code==='ENOENT'))throw new AggregateError([error,cleanup],'Backup and cleanup failed',{cause:cleanup});}
    throw error;
  } finally {closeSync(fd);}
}
