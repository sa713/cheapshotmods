import {closeSync, fchmodSync, fstatSync, lstatSync, openSync, unlinkSync} from 'node:fs';

export async function backupToFile(db: {backup(path: string): Promise<unknown>}, target: string) {
  // Exclusive creation prevents overwriting an existing target, including a
  // symlink. Permissions are private before SQLite opens the destination.
  const fd=openSync(target,'wx',0o600), created=fstatSync(fd);
  let complete=false;
  try {
    fchmodSync(fd,0o600);
    await db.backup(target);
    complete=true;
  } finally {
    closeSync(fd);
    if (!complete) {
      // Remove only the file this operation created, never a replaced path.
      try {const current=lstatSync(target);if(current.dev===created.dev&&current.ino===created.ino)unlinkSync(target);}
      catch (e) {if (!(e && typeof e==='object' && 'code' in e && e.code==='ENOENT')) throw e;}
    }
  }
}
