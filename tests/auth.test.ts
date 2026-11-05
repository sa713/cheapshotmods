import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {app} from '../apps/server/src/app.js';
import {Auth,miniIdentity,oidcIdentity,issuer,sha256,type Transport} from '../apps/server/src/auth.js';
import {Store} from '../apps/server/src/store.js';
import {config,initData} from './helpers.js';
const pair=await generateKeyPair('RS256'), jwks=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'fixture',alg:'RS256'}]});
async function token(nonce:string, overrides: Record<string,unknown>={},privateKey=pair.privateKey) {
  const now=Math.floor(Date.now()/1000);
  return new SignJWT({id:111,nonce,sub:'deliberately-different-sub',iss:issuer,aud:config.clientId,iat:now,exp:now+600,...overrides}).setProtectedHeader({alg:'RS256',kid:'fixture'}).sign(privateKey);
}
test('OIDC real signature and every identity/claim validation',async()=>{
  const remote: Transport={jwks,exchange:async()=>{throw new Error('unused');}};
  assert.equal(await oidcIdentity(await token('nonce'),'nonce',config,remote),'111');
  for (const claims of [{iss:'https://evil.invalid'},{aud:'other-client'},{exp:1},{nonce:'wrong'},{iat:Math.floor(Date.now()/1000)+60},{id:undefined},{id:0},{id:9007199254740992},{sub:undefined},{exp:undefined},{iat:undefined}]) {
    await assert.rejects(()=>token('nonce',claims).then(t=>oidcIdentity(t,'nonce',config,remote)));
  }
  const other=await generateKeyPair('RS256');await assert.rejects(()=>token('nonce',{},other.privateKey).then(t=>oidcIdentity(t,'nonce',config,remote)));
});
test('Mini App signature, duplicate fields, missing identity and exact time boundaries',()=>{
  const now=1900000000;
  for (const date of [now-300,now,now+30]) assert.equal(miniIdentity(initData(111,date),config.botToken!,now),'111');
  for (const raw of [initData(111,now-301),initData(111,now+31),initData(111,now)+'&user=%7B%22id%22%3A222%7D',initData(111,now)+'&auth_date='+now,initData(111,now,{user:'{}'}),initData(111,now,{user:'null'}),'auth_date='+now+'&user=%7B%22id%22%3A111%7D']) assert.throws(()=>miniIdentity(raw,config.botToken!,now));
  const tampered=new URLSearchParams(initData(111,now));tampered.set('user',JSON.stringify({id:222}));assert.throws(()=>miniIdentity(tampered.toString(),config.botToken!,now));
  const missing=new URLSearchParams(initData(111,now));missing.delete('user');assert.throws(()=>miniIdentity(missing.toString(),config.botToken!,now));
  const badHash=new URLSearchParams(initData(111,now));badHash.set('hash','0'.repeat(64));assert.throws(()=>miniIdentity(badHash.toString(),config.botToken!,now));
});
test('OIDC callback binds session/state/nonce and PKCE; rotates session and shares Mini App aggregate',async()=>{
  const s=new Store(':memory:');let expectedChallenge='',nonce='',exchanges=0;
  const remote: Transport={jwks,exchange:async(code,verifier,c)=>{
    exchanges++;assert.equal(code,'single-code');assert.equal(c.clientId,config.clientId);
    if (sha256(verifier)!==expectedChallenge) throw new Error('PKCE rejected'); return token(nonce);
  }};
  const f=await app(s,config,remote);
  try {
    const start=await f.inject('/auth/oidc/start'), url=new URL(start.headers.location!);
    const old=start.cookies[0]!.value;expectedChallenge=url.searchParams.get('code_challenge')!;nonce=url.searchParams.get('nonce')!;
    assert.equal(url.searchParams.get('scope'),'openid profile');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    const state=url.searchParams.get('state')!, callback='/auth/oidc/callback?'+new URLSearchParams({state,code:'single-code'});
    assert.equal((await f.inject({url:callback,cookies:{chm_session:'forged'}})).statusCode,401);
    assert.equal((await f.inject({url:'/auth/oidc/callback?state=wrong&code=single-code',cookies:{chm_session:old}})).statusCode,401);
    const finish=await f.inject({url:callback,cookies:{chm_session:old}});assert.equal(finish.statusCode,302);const fresh=finish.cookies[0]!.value;
    assert.notEqual(fresh,old);assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:old}})).statusCode,401);
    assert.equal((await f.inject({url:callback,cookies:{chm_session:old}})).statusCode,401);assert.equal(exchanges,1);
    const viaOidc=(await f.inject({url:'/api/state',cookies:{chm_session:fresh}})).json();
    const mini=await f.inject({method:'POST',url:'/auth/mini',headers:{origin:config.baseUrl},payload:{initData:initData()}});
    assert.equal(mini.statusCode,200);const viaMini=(await f.inject({url:'/api/state',cookies:{chm_session:mini.cookies[0]!.value}})).json();assert.deepEqual(viaMini,viaOidc);
    const other=await f.inject({method:'POST',url:'/auth/mini',headers:{origin:config.baseUrl},payload:{initData:initData(222)}});
    assert.notEqual((await f.inject({url:'/api/state',cookies:{chm_session:other.cookies[0]!.value}})).json().experiment,viaMini.experiment);
    assert.equal((s.db.prepare('SELECT count(*) AS n FROM players').get() as {n:number}).n,2);
    // Reusing a code with a new otherwise valid state is refused before token exchange.
    const second=await f.inject('/auth/oidc/start'),secondUrl=new URL(second.headers.location!);
    assert.equal((await f.inject({url:'/auth/oidc/callback?'+new URLSearchParams({state:secondUrl.searchParams.get('state')!,code:'single-code'}),cookies:{chm_session:second.cookies[0]!.value}})).statusCode,401);assert.equal(exchanges,1);
  } finally {await f.close();s.close();}
});
test('wrong PKCE or nonce cannot create identity; one-time flow stays consumed on failure',async()=>{
  for (const mode of ['pkce','nonce']) {
    const s=new Store(':memory:');const auth=new Auth(s,config,{jwks,exchange:async()=>{if(mode==='pkce')throw new Error('PKCE rejected');return token('wrong-nonce');}});
    try {const start=auth.start(),url=new URL(start.url),state=url.searchParams.get('state');await assert.rejects(()=>auth.callback(start.raw,state,'code-'+mode));await assert.rejects(()=>auth.callback(start.raw,state,'code-'+mode));assert.equal((s.db.prepare('SELECT count(*) AS n FROM players').get() as {n:number}).n,0);}finally{s.close();}
  }
});
