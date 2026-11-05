import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import serveStatic from '@fastify/static';
import { resolve } from 'node:path';
import { DomainError, keys, record, requireThat } from '@chm/rules';
import { Auth, miniIdentity, type Config, type Transport } from './auth.js';
import { Store } from './store.js';

export async function app(store: Store, config: Config, remote?: Transport) {
  const f=Fastify({logger:false,bodyLimit:1024*1024,requestTimeout:15000}), auth=new Auth(store,config,remote);
  const secure=new URL(config.baseUrl).protocol==='https:';
  await f.register(cookie);
  f.addHook('onSend',async(_req,reply,payload)=>{
    reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','no-referrer');
    reply.header('content-security-policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; base-uri 'none'; form-action 'self'");
    return payload;
  });
  f.setErrorHandler((e,_req,reply)=>{
    const clientStatus=e && typeof e==='object' && 'statusCode' in e && typeof e.statusCode==='number' && Number.isInteger(e.statusCode) && e.statusCode>=400 && e.statusCode<500 ? e.statusCode : undefined;
    const status=e instanceof DomainError ? e.status : clientStatus??500;
    const publicCode=status===413?'REQUEST_TOO_LARGE':status===415?'UNSUPPORTED_MEDIA_TYPE':status<500?'INVALID_REQUEST':'SERVER_ERROR';
    reply.code(status).send({error:e instanceof DomainError ? e.code : publicCode});
  });
  function setSession(reply: import('fastify').FastifyReply, raw: string) {
    reply.setCookie('chm_session',raw,{path:'/',httpOnly:true,secure,sameSite:'lax',maxAge:43200});
  }
  function origin(req: import('fastify').FastifyRequest) { requireThat(req.headers.origin===config.baseUrl,'ORIGIN_REJECTED',403); }
  function session(req: import('fastify').FastifyRequest, mutate=false) {
    requireThat(config.botToken || (config.clientId && config.clientSecret),'UNAUTHORIZED',401);
    const raw=req.cookies.chm_session, s=raw?store.session(auth.hash(raw),Math.floor(Date.now()/1000)):undefined;
    requireThat(s?.owner,'UNAUTHORIZED',401);
    if (mutate) { origin(req); requireThat(req.headers['x-csrf-token']===s.csrf,'CSRF_REJECTED',403); }
    return s as typeof s & {owner:string};
  }
  f.get('/health',async(_req,reply)=>{ try { store.health(); return {status:'ok'}; } catch { return reply.code(503).send({status:'unavailable'}); } });
  f.get('/version',async()=>({version:config.version}));
  f.get('/api/config',async()=>({oidc:!!(config.clientId&&config.clientSecret),mini:!!config.botToken}));
  f.get('/api/session',async req=>({csrf:session(req).csrf}));
  f.get('/api/state',async req=>store.summary(session(req).owner));
  f.get('/api/inventory',async req=>{
    const q=record(req.query); keys(q,['scope','after','limit']);
    requireThat(typeof q.scope==='string' && (q.after===undefined || typeof q.after==='string'));
    requireThat(q.limit===undefined || typeof q.limit==='string' && /^[1-9][0-9]{0,2}$/.test(q.limit));
    return {items:store.inventory(session(req).owner,q.scope,q.after as string|undefined,q.limit===undefined?100:Number(q.limit))};
  });
  f.post('/api/commands',async req=>store.command(session(req,true).owner,req.body));
  f.post('/auth/logout',async(req,reply)=>{
    const s=session(req,true); store.db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);
    reply.clearCookie('chm_session',{path:'/',httpOnly:true,secure,sameSite:'lax'}); return {ok:true};
  });
  f.get('/auth/oidc/start',async(req,reply)=>{
    const result=auth.start(req.cookies.chm_session); setSession(reply,result.raw); return reply.redirect(result.url);
  });
  f.get('/auth/oidc/callback',async(req,reply)=>{
    const q=record(req.query); keys(q,['code','state']);
    const result=await auth.callback(req.cookies.chm_session??'',q.state,q.code); setSession(reply,result.raw); return reply.redirect('/');
  });
  f.post('/auth/mini',async(req,reply)=>{
    origin(req); requireThat(config.botToken,'LOGIN_UNAVAILABLE',503);
    const body=record(req.body); keys(body,['initData']);
    const owner=miniIdentity(body.initData,config.botToken), result=auth.create(owner,req.cookies.chm_session);
    setSession(reply,result.raw); return {csrf:result.csrf};
  });
  await f.register(serveStatic,{root:resolve('apps/web/dist'),wildcard:false});
  return f;
}
