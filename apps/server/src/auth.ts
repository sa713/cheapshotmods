import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { DomainError, integer, record, requireThat } from '@chm/rules';
import type { Store } from './store.js';

export const issuer = 'https://oauth.telegram.org';
export const random = () => randomBytes(32).toString('base64url');
export const sha256 = (s: string) => createHash('sha256').update(s).digest('base64url');
export interface Config { baseUrl: string; sessionSecret: string; botToken?: string; clientId?: string; clientSecret?: string; version: string; trustProxy?: boolean }
export interface Transport {
  jwks: JWTVerifyGetKey;
  exchange: (code: string, verifier: string, config: Config) => Promise<string>;
}
export const transport: Transport = {
  jwks:createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'),{timeoutDuration:5000}),
  async exchange(code,verifier,c) {
    const response=await fetch(issuer+'/token', {method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic '+Buffer.from(c.clientId+':'+c.clientSecret).toString('base64')},body:new URLSearchParams({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:c.baseUrl+'/auth/oidc/callback'})});
    requireThat(response.ok,'LOGIN_FAILED',401);
    const body=record(await response.json()); requireThat(typeof body.id_token==='string','LOGIN_FAILED',401); return body.id_token;
  }
};
export function telegramId(value: unknown): string {
  if (typeof value === 'number') { requireThat(Number.isSafeInteger(value) && value>0,'INVALID_TELEGRAM_ID',401); return String(value); }
  integer(value); return value as string;
}
export function miniIdentity(raw: unknown, token: string, now = Math.floor(Date.now()/1000)): string {
  requireThat(typeof raw==='string' && raw.length<=16384,'INVALID_INIT_DATA',401);
  const params=new URLSearchParams(raw), seen=new Set<string>();
  for (const k of params.keys()) { requireThat(!seen.has(k),'INVALID_INIT_DATA',401); seen.add(k); }
  const hash=params.get('hash'); requireThat(hash && /^[0-9a-f]{64}$/.test(hash),'INVALID_INIT_DATA',401);
  params.delete('hash');
  const check=[...params.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const secret=createHmac('sha256','WebAppData').update(token).digest();
  const expected=createHmac('sha256',secret).update(check).digest();
  requireThat(timingSafeEqual(expected,Buffer.from(hash,'hex')),'INVALID_INIT_DATA',401);
  const date=params.get('auth_date'); requireThat(date && /^[0-9]+$/.test(date),'INVALID_INIT_DATA',401);
  const time=BigInt(date); requireThat(time>=BigInt(now-300) && time<=BigInt(now+30),'EXPIRED_INIT_DATA',401);
  try { return telegramId(record(JSON.parse(params.get('user')??'null')).id); }
  catch { throw new DomainError('INVALID_INIT_DATA',401); }
}
export async function oidcIdentity(token: string, nonce: string, c: Config, t: Transport, now = new Date()) {
  // Keep exp/nbf strict. jose maxTokenAge also forbids future iat, so enforce
  // our separate [-3600,+30] issued-at policy after cryptographic validation.
  const {payload}=await jwtVerify(token,t.jwks,{issuer,audience:c.clientId,algorithms:['RS256','ES256','EdDSA'],requiredClaims:['exp','iat','sub','nonce','id'],clockTolerance:0,currentDate:now});
  const seconds=Math.floor(now.getTime()/1000);
  requireThat(payload.nonce===nonce && typeof payload.iat==='number' && Number.isFinite(payload.iat) && payload.iat>=seconds-3600 && payload.iat<=seconds+30 && typeof payload.exp==='number' && payload.exp>seconds && payload.exp>payload.iat,'LOGIN_FAILED',401);
  return telegramId(payload.id);
}
interface Flow { state: string; nonce: string; verifier: string; expires: number }
export class Auth {
  constructor(readonly store: Store, readonly config: Config, readonly remote: Transport = transport) {}
  hash(raw: string) { return createHmac('sha256',this.config.sessionSecret).update(raw).digest('hex'); }
  create(owner: string|null, old?: string) {
    const raw=random(), csrf=random(), expires=Math.floor(Date.now()/1000)+(owner?43200:300);
    this.store.db.transaction(()=>{
      if (owner) this.store.player(owner);
      if (old) this.store.db.prepare('DELETE FROM sessions WHERE hash=?').run(this.hash(old));
      this.store.db.prepare('DELETE FROM sessions WHERE expires<=?').run(Math.floor(Date.now()/1000));
      this.store.db.prepare('INSERT INTO sessions VALUES (?,?,?,?,NULL)').run(this.hash(raw),owner,csrf,expires);
    }).immediate();
    return {raw,csrf};
  }
  cancel(raw: string, state: unknown) {
    requireThat(typeof state==='string','LOGIN_FAILED',401);
    const s=this.store.session(this.hash(raw),Math.floor(Date.now()/1000));
    requireThat(s?.flow,'LOGIN_FAILED',401);
    const flow=JSON.parse(s.flow) as Flow;
    requireThat(flow.state===state && flow.expires>Math.floor(Date.now()/1000),'LOGIN_FAILED',401);
    this.store.db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);
  }
  start(old?: string) {
    const c=this.config; requireThat(c.clientId && c.clientSecret,'LOGIN_UNAVAILABLE',503);
    const session=this.create(null,old), flow: Flow={state:random(),nonce:random(),verifier:random(),expires:Math.floor(Date.now()/1000)+300};
    this.store.db.prepare('UPDATE sessions SET flow=? WHERE hash=?').run(JSON.stringify(flow),this.hash(session.raw));
    const url=new URL(issuer+'/auth');
    url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.baseUrl+'/auth/oidc/callback',response_type:'code',scope:'openid profile',state:flow.state,nonce:flow.nonce,code_challenge:sha256(flow.verifier),code_challenge_method:'S256'}).toString();
    return {...session,url:url.toString()};
  }
  async callback(raw: string, state: unknown, code: unknown) {
    requireThat(typeof state==='string' && typeof code==='string' && code.length>0 && code.length<=4096,'LOGIN_FAILED',401);
    const now=Math.floor(Date.now()/1000);
    const flow=this.store.db.transaction(()=>{
      const s=this.store.session(this.hash(raw),now); requireThat(s?.flow,'LOGIN_FAILED',401);
      const f=JSON.parse(s.flow) as Flow;
      requireThat(f.expires>now && f.state===state,'LOGIN_FAILED',401);
      this.store.db.prepare('DELETE FROM oidc_codes WHERE expires<=?').run(now);
      requireThat(!this.store.db.prepare('SELECT hash FROM oidc_codes WHERE hash=?').get(sha256(code)), 'LOGIN_FAILED',401);
      this.store.db.prepare('INSERT INTO oidc_codes VALUES (?,?)').run(sha256(code),now+3600);
      this.store.db.prepare('UPDATE sessions SET flow=NULL WHERE hash=?').run(s.hash); return f;
    }).immediate();
    try {
      const token=await this.remote.exchange(code,flow.verifier,this.config);
      const owner=await oidcIdentity(token,flow.nonce,this.config,this.remote);
      return this.create(owner,raw);
    } catch { throw new DomainError('LOGIN_FAILED',401); }
  }
}
