export const kinds = ['🅾', '💢', '💚', '🧿'] as const;
export type Kind = typeof kinds[number];
export class DomainError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function requireThat(ok: unknown, code = 'INVALID_COMMAND', status = 400): asserts ok {
  if (!ok) throw new DomainError(code, status);
}
export function integer(value: unknown, zero = false): bigint {
  requireThat(typeof value === 'string' && (zero ? /^(0|[1-9][0-9]*)$/ : /^[1-9][0-9]*$/).test(value), 'INVALID_INTEGER');
  return BigInt(value);
}
export const MAX_INPUT_INTEGER_DIGITS = 128;
export function boundedInteger(value: unknown, zero = false, digits = MAX_INPUT_INTEGER_DIGITS): bigint {
  requireThat(typeof value === 'string', 'INVALID_INTEGER');
  requireThat(value.length <= digits, digits===128?'INTEGER_TOO_LONG':digits===256?'POOL_INTEGER_TOO_LONG':'CRIT_TOO_LONG');
  return integer(value, zero);
}
export const inputInteger = boundedInteger;
export function record(value: unknown): Record<string, unknown> {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  requireThat(Object.keys(value).every(k => allowed.includes(k)), 'UNKNOWN_FIELD');
}
export function canonicalKind(value: unknown): Kind {
  const kind = value === '🅾️' ? '🅾' : value === '🌸' ? '💚' : value;
  requireThat(kinds.includes(kind as Kind), 'INVALID_MOD'); return kind as Kind;
}
export function displayKind(kind: Kind): string { return kind === '🅾' ? '🅾️' : kind === '💚' ? '🌸' : kind; }
export function hasCrit(kind: Kind) { return kind === '💢' || kind === '🧿'; }
// Integer thousandths, never a floating point conversion. Empty legacy crit is unknown.
export function parseCrit(value: unknown): string {
  requireThat(typeof value === 'string' && value.length <= 132, 'INVALID_CRIT');
  requireThat(/^(0|[1-9][0-9]*)([.,][0-9]+)?$/.test(value), 'INVALID_CRIT');
  const [whole, fraction = ''] = value.split(/[.,]/);
  requireThat(whole!.length <= MAX_INPUT_INTEGER_DIGITS, 'INTEGER_TOO_LONG');
  return (BigInt(whole!) * 1000n + BigInt((fraction + '000').slice(0,3)) + (/[1-9]/.test(fraction.slice(3)) ? 1n : 0n)).toString();
}
export function formatCrit(value: string | null | undefined): string {
  if (value == null) return 'неизвестен';
  const n = integer(value,true); return `${n / 1000n},${(n % 1000n).toString().padStart(3,'0')}`;
}
export interface Mod { kind: Kind; tier: number; value: string; crit?: string | null }
export interface Group extends Mod { id: string; quantity: string }
export interface Equipped { id: string; quantity: string }
export interface Selection extends Equipped { worn: string }
export function mod(value: unknown): Mod {
  const r = record(value), kind = canonicalKind(r.kind);
  requireThat(Number.isInteger(r.tier) && Number(r.tier) >= 1 && Number(r.tier) <= 6, 'INVALID_MOD');
  integer(r.value);
  if (r.tier === 1 && kind !== '💚') requireThat(kind === '🅾' ? ['10','11','12'].includes(String(r.value)) : r.value === '8', 'INVALID_MOD');
  const crit = hasCrit(kind) && r.crit != null ? integer(r.crit,true).toString() : null;
  requireThat(hasCrit(kind) || r.crit == null, 'INVALID_CRIT');
  return {kind,tier:r.tier as number,value:r.value as string,crit};
}
export function modKey(m: Mod) { return JSON.stringify([m.kind,m.tier,m.value,m.crit ?? null]); }
const prices: Record<Kind, readonly string[]> = {
  '🅾':['84','252','756','2268','6804'], '💢':['66','198','594','1782','5346'],
  '💚':['54','162','486','1458','4374'], '🧿':['72','216','648','1944','5832']
};
export function craft(input: Mod[]): {result: Mod; price: string} {
  requireThat(input.length === 3, 'SELECT_THREE');
  const normalized = input.map(mod), first = normalized[0]!;
  requireThat(first.tier < 6 && normalized.every(m => m.kind === first.kind && m.tier === first.tier), 'INCOMPATIBLE_MODS');
  const crit = hasCrit(first.kind) && normalized.every(m=>m.crit != null)
    ? ((normalized.reduce((s,m)=>s+integer(m.crit,true),0n)+1n)/2n).toString() : null;
  return {result:{kind:first.kind,tier:first.tier+1,value:((normalized.reduce((s,m)=>s+integer(m.value),0n)+1n)/2n).toString(),crit},price:prices[first.kind][first.tier-1]!};
}
export function stats(level: string, equipped: {kind: Kind; value: string; quantity: string; crit?: string|null}[]) {
  let damage = 0n, health = 0n, count = 0n, crit = 0n, critIncomplete = false;
  for (const m of equipped) {
    const n = integer(m.quantity); count += n;
    if (m.kind === '💚') health += integer(m.value)*n; else damage += integer(m.value)*n;
    if (hasCrit(m.kind)) { if (m.crit == null) critIncomplete = true; else crit += 3n*n*integer(m.crit,true); }
  }
  requireThat(count <= 100n, 'EQUIPMENT_LIMIT');
  const l = integer(level);
  return {damage:((l*(100n+damage)+99n)/100n).toString(),health:((l*(100n+health)+99n)/100n).toString(),crit:critIncomplete?null:crit.toString(),critIncomplete};
}
export * from './batch.js';
