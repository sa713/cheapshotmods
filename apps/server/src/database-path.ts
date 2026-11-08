// The native driver trims filenames. Reject aliases instead of silently
// opening another database or creating a filesystem path with different meaning.
export function validateDatabasePath(path: string, allowMemory = false): void {
  if (typeof path !== 'string' || path.length === 0 || path !== path.trim()) {
    throw new TypeError('Database path must be nonempty and must not have surrounding whitespace');
  }
  if (path === ':memory:' && !allowMemory) throw new TypeError('Database path must refer to a file');
}
