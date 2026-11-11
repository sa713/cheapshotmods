import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import serveStatic from '@fastify/static';
import { resolve } from 'node:path';
import { DomainError, inputInteger, keys, record, requireThat } from '@chm/rules';
import { Auth, issuer, type Config, type Transport } from './auth.js';
import { Store } from './store.js';
import { LoginLimiter } from './login-limiter.js';

export async function app(store: Store, config: Config, remote?: Transport) {
  const f=Fastify({logger:false,bodyLimit:1024*1024,requestTimeout:15000,trustProxy:config.trustProxy?(_address,hop)=>hop===0:false}), auth=new Auth(store,config,remote), limiter=new LoginLimiter();
  store.maintain();
  const maintenance=setInterval(()=>{try { store.maintain(); } catch { console.error(JSON.stringify({event:'maintenance_failed'})); }},60000).unref();
  f.addHook('onClose',async()=>{clearInterval(maintenance);});
  const secure=new URL(config.baseUrl).protocol==='https:';
  await f.register(cookie);
  f.addHook('onSend',async(_req,reply,payload)=>{
    reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','no-referrer');
    reply.header('content-security-policy',"default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; base-uri 'none'; form-action 'self'");
    return payload;
  });
  f.setErrorHandler((e,req,reply)=>{
    const clientStatus=e && typeof e==='object' && 'statusCode' in e && typeof e.statusCode==='number' && Number.isInteger(e.statusCode) && e.statusCode>=400 && e.statusCode<500 ? e.statusCode : undefined;
    const status=e instanceof DomainError ? e.status : clientStatus??500;
    const publicCode=status===413?'REQUEST_TOO_LARGE':status===415?'UNSUPPORTED_MEDIA_TYPE':status<500?'INVALID_REQUEST':'SERVER_ERROR';
    if (status>=500) console.error(JSON.stringify({event:'request_failed',requestId:req.id,route:req.routeOptions.url??'unknown',status}));
    if (status===429) reply.header('retry-after','60');
    if (req.routeOptions.url==='/auth/oidc/callback' && req.headers.accept?.includes('text/html')) {
      reply.code(status).type('text/html; charset=utf-8').send('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход не выполнен</title><body><main><h1>Вход не выполнен</h1><p>Вход истёк или Telegram не подтвердил учётную запись. Попробуйте войти заново.</p><a href="/">Вернуться к входу</a></main></body></html>');return;
    }
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
    // Optional client precondition, never an identity credential. Stops an old
    // tab from reading a different account after a shared cookie is rotated.
    requireThat(req.headers['x-chm-account']===undefined || req.headers['x-chm-account']===auth.hash('account:'+s.owner),'SESSION_CHANGED',401);
    if (mutate) { origin(req); requireThat(req.headers['x-csrf-token']===s.csrf,'CSRF_REJECTED',403); }
    return s as typeof s & {owner:string};
  }
  f.get('/health',async(_req,reply)=>{ try { store.health(); return {status:'ok'}; } catch { return reply.code(503).send({status:'unavailable'}); } });
  f.get('/version',async()=>({version:config.version}));
  f.get('/api/config',async()=>({oidc:!!(config.clientId&&config.clientSecret),mini:!!config.botToken}));
  f.get('/api/session',async req=>{const s=session(req);return {csrf:s.csrf,account:auth.hash('account:'+s.owner)};});
  f.get('/api/state',async req=>store.db.transaction(()=>store.summary(session(req).owner))());
  f.get('/api/inventory',async req=>{
    const q=record(req.query); keys(q,['scope','after','limit','revision']);
    requireThat(typeof q.scope==='string' && (q.after===undefined || typeof q.after==='string'));
    requireThat(q.limit===undefined || typeof q.limit==='string' && /^[1-9][0-9]{0,2}$/.test(q.limit));
    if(q.revision!==undefined)inputInteger(q.revision,true);
    const owner=session(req).owner;
    return store.db.transaction(()=>{const revision=store.player(owner).revision;requireThat(q.revision===undefined||q.revision===revision,'REVISION_CONFLICT',409);
      return {revision,items:store.inventory(owner,q.scope as string,q.after as string|undefined,q.limit===undefined?100:Number(q.limit))};})();
  });
  f.post('/api/fuse-preview',async req=>store.preview(session(req,true).owner,req.body));
  f.post('/api/commands',async req=>store.command(session(req,true).owner,req.body));
  f.post('/auth/logout',async(req,reply)=>{
    const s=session(req,true); store.db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);
    reply.clearCookie('chm_session',{path:'/',httpOnly:true,secure,sameSite:'lax'}); return {ok:true};
  });
  f.get('/auth/oidc/start',async(req,reply)=>{
    limiter.check(req.ip);
    const result=auth.start(req.cookies.chm_session); setSession(reply,result.raw); return reply.redirect(result.url);
  });
  f.get('/auth/oidc/callback',async(req,reply)=>{
    limiter.check(req.ip);
    // OAuth allows extra response fields. Only consume scalar protocol fields;
    // never reflect provider text, codes or tokens into HTML/logs/redirects.
    const q=record(req.query);
    requireThat(q.iss===undefined || q.iss===issuer,'LOGIN_FAILED',401);
    if (q.error!==undefined) {
      requireThat(typeof q.error==='string' && q.code===undefined,'LOGIN_FAILED',401);
      auth.cancel(req.cookies.chm_session??'',q.state);
      return reply.redirect('/?login=cancelled');
    }
    try {
      const result=await auth.callback(req.cookies.chm_session??'',q.state,q.code); setSession(reply,result.raw); return reply.redirect('/');
    } catch (e) {
      // Bad callbacks still return an actual failure status to API clients.
      // The web client can recover through the static login page.
      if (e instanceof DomainError) throw e;
      throw new DomainError('LOGIN_FAILED',401);
    }
  });
  f.post('/auth/mini',async(req,reply)=>{
    limiter.check(req.ip);
    origin(req); requireThat(config.botToken,'LOGIN_UNAVAILABLE',503);
    const body=record(req.body); keys(body,['initData']);
    const result=auth.mini(body.initData,req.cookies.chm_session);
    if (!result.resumed) setSession(reply,result.raw); return {csrf:result.csrf};
  });
  await f.register(serveStatic,{root:resolve('apps/web/dist'),wildcard:false});
  return f;
}
