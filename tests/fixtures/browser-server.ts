// Test runner only: not copied into the production image, no test routes in app.
import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {randomUUID} from 'node:crypto';
import {app} from '../../apps/server/src/app.js';
import {issuer,sha256,type Transport} from '../../apps/server/src/auth.js';
import {Store} from '../../apps/server/src/store.js';
import {config} from '../helpers.js';
import {seedLegacy} from './legacy-v2.js';

const directory=process.env.CHM_BROWSER_DIR!;mkdirSync(directory,{recursive:true});
const pair=await generateKeyPair('RS256'),jwks=createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:'browser-fixture',alg:'RS256'}]});
const codes=new Map<string,{id:string;nonce:string;challenge:string}>();
const remote:Transport={jwks,exchange:async(code,verifier)=>{
  const c=codes.get(code);codes.delete(code);
  if (!c || sha256(verifier)!==c.challenge) throw new Error('Fixture PKCE mismatch');
  const now=Math.floor(Date.now()/1000);
  return new SignJWT({id:c.id,sub:'different-sub-'+c.id,nonce:c.nonce,iss:issuer,aud:config.clientId,iat:now,exp:now+600}).setProtectedHeader({alg:'RS256',kid:'browser-fixture'}).sign(pair.privateKey);
}};
let store=new Store(directory+'/browser.sqlite');
let server=await app(store,{...config,baseUrl:'http://localhost:3100',trustProxy:true},remote);
await server.listen({port:3100,host:'127.0.0.1'});
const provider=createServer((req,res)=>{void(async()=>{
  const url=new URL(req.url!,'http://localhost:3101');
  if(url.pathname==='/health'){res.end('ok');return;}
  if(url.pathname==='/restart'&&req.method==='POST'){
    await server.close();store.close();
    if(url.searchParams.get('legacy')==='1')seedLegacy(directory+'/browser.sqlite',true);
    store=new Store(directory+'/browser.sqlite');
    server=await app(store,{...config,baseUrl:'http://localhost:3100',trustProxy:true},remote);await server.listen({port:3100,host:'127.0.0.1'});res.end('ok');return;
  }
  if(url.pathname!=='/authorize'){res.writeHead(404);res.end();return;}
  const code=randomUUID();
  codes.set(code,{id:url.searchParams.get('fixture_id')??'111',nonce:url.searchParams.get('nonce')!,challenge:url.searchParams.get('code_challenge')!});
  const callback=new URL('http://localhost:3100/auth/oidc/callback');
  callback.search=new URLSearchParams({state:url.searchParams.get('state')!,code,iss:issuer,session_state:'additional-fixture-field'}).toString();
  res.writeHead(302,{location:callback.toString()});res.end();
})().catch(()=>{res.writeHead(500);res.end('fixture failed');});});
provider.listen(3101,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{provider.close();void server.close().finally(()=>{store.close();process.exit(0);});});
