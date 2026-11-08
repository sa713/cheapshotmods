import {createHmac,randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import type {Config} from '../apps/server/src/auth.js';
export const config: Config={baseUrl:'http://localhost:3000',sessionSecret:'isolated-fixture-session-secret-32-characters',botToken:'fixture-bot-token',clientId:'fixture-client',clientSecret:'fixture-client-secret',version:'a'.repeat(40)};
export function initData(id: number|string=111, date=Math.floor(Date.now()/1000), extra: Record<string,string>={}) {
  const p=new URLSearchParams({auth_date:String(date),user:JSON.stringify({id,first_name:'Fixture'}),query_id:randomUUID(),...extra});
  const check=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const secret=createHmac('sha256','WebAppData').update(config.botToken!).digest();
  p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString();
}
export function command(store: Store, action: Record<string,unknown>, owner='111') {
  const s=store.summary(owner); return store.command(owner,{key:randomUUID(),revision:s.revision,experiment:s.experiment,action});
}
export function add(store: Store,quantity='6',kind='🅾',tier=1,value='10',owner='111') {
  return command(store,{type:'original.put',kind,tier,value,quantity,...(['💢','🧿'].includes(kind)?{crit:'0'}:{})},owner).createdId!;
}
export const choice=(id:string,quantity='3',worn='0')=>({id,quantity,worn});
