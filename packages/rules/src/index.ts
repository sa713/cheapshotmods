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
export function record(value: unknown): Record<string, unknown> {
  requireThat(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  requireThat(Object.keys(value).every(k => allowed.includes(k)), 'UNKNOWN_FIELD');
}
export interface Mod { kind: Kind; tier: number; value: string }
export interface Group extends Mod { id: string; quantity: string }
export interface Equipped { id: string; quantity: string }
export interface Selection extends Equipped { worn: string }
export function mod(value: unknown): Mod {
  const r = record(value);
  requireThat(kinds.includes(r.kind as Kind) && Number.isInteger(r.tier) && Number(r.tier) >= 1 && Number(r.tier) <= 6, 'INVALID_MOD');
  integer(r.value);
  if (r.tier === 1 && r.kind !== '💚') {
    requireThat(r.kind === '🅾' ? ['10','11','12'].includes(String(r.value)) : r.value === '8', 'INVALID_MOD');
  }
  return {kind: r.kind as Kind, tier: r.tier as number, value: r.value as string};
}
const prices: Record<Kind, readonly string[]> = {
  '🅾':['84','252','756','2268','6804'], '💢':['66','198','594','1782','5346'],
  '💚':['54','162','486','1458','4374'], '🧿':['72','216','648','1944','5832']
};
export function craft(input: Mod[]): {result: Mod; price: string} {
  requireThat(input.length === 3, 'SELECT_THREE');
  const first = mod(input[0]);
  requireThat(first.tier < 6 && input.every(m => { mod(m); return m.kind === first.kind && m.tier === first.tier; }), 'INCOMPATIBLE_MODS');
  return {result:{kind:first.kind,tier:first.tier+1,value:((input.reduce((s,m)=>s+integer(m.value),0n)+1n)/2n).toString()},price:prices[first.kind][first.tier-1]!};
}
export function stats(level: string, equipped: {kind: Kind; value: string; quantity: string}[]) {
  let damage = 0n, health = 0n, count = 0n;
  for (const m of equipped) {
    const n = integer(m.quantity); count += n;
    if (m.kind === '💚') health += integer(m.value)*n;
    else damage += integer(m.value)*n;
  }
  requireThat(count <= 100n, 'EQUIPMENT_LIMIT');
  const l = integer(level);
  return {damage:((l*(100n+damage)+99n)/100n).toString(),health:((l*(100n+health)+99n)/100n).toString()};
}
