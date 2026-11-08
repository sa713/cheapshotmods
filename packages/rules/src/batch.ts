import {boundedInteger, canonicalKind, craft, inputInteger, keys, modKey, record, requireThat, type Group, type Kind, type Mod} from './index.js';
export interface FuseRequest {kind: Kind; targetTier: number; count: string; items: {id:string;quantity:string;worn:string}[]}
export interface FuseChoice extends Group {equipped: string}
export interface Run extends Mod {quantity: string}
export interface FusePlan {
  kind: Kind; targetTier:number; count:string; price:string;
  selected: {id:string;allowed:string;allowWorn:string;used:string;worn:string;unused:string;remaining:string}[];
  steps: {fromTier:number;toTier:number;count:string;unitPrice:string;price:string;inputs:Run[];outputs:Run[]}[];
  outputs:Run[];
}
// Bounds constrain request/plan complexity, never the number of physical units.
export const MAX_FUSE_GROUPS = 1000, MAX_FUSE_RUNS = 10000;
export function fuseRequest(raw: unknown): FuseRequest {
  const r=record(raw); keys(r,['kind','targetTier','count','items']);
  const kind=canonicalKind(r.kind); inputInteger(r.count);
  requireThat(Number.isInteger(r.targetTier)&&Number(r.targetTier)>=2&&Number(r.targetTier)<=6,'INVALID_TARGET');
  requireThat(Array.isArray(r.items)&&r.items.length>0,'INVALID_SELECTION');
  requireThat(r.items.length<=MAX_FUSE_GROUPS,'FUSE_POOL_TOO_LARGE');
  const seen=new Set<string>();
  const items=r.items.map(raw=>{const i=record(raw);keys(i,['id','quantity','worn']);
    requireThat(typeof i.id==='string'&&!seen.has(i.id),'INVALID_SELECTION');seen.add(i.id);
    const quantity=boundedInteger(i.quantity,false,256), worn=boundedInteger(i.worn,true,256);
    requireThat(worn<=quantity,'INVALID_SELECTION');return {id:i.id,quantity:quantity.toString(),worn:worn.toString()};});
  return {kind,targetTier:r.targetTier as number,count:r.count as string,items};
}
interface QueueRun {m:Mod;n:bigint;source?:string}
export function planFuse(request: FuseRequest, choices: FuseChoice[]): FusePlan {
  const queues:QueueRun[][]=Array.from({length:7},()=>[]), used=new Map<string,bigint>();
  const selected=request.items.map(s=>{
    const g=choices.find(g=>g.id===s.id);requireThat(g,'GROUP_NOT_FOUND',404);
    requireThat(g.kind===request.kind&&g.tier<request.targetTier,'INCOMPATIBLE_MODS');
    const allowed=BigInt(s.quantity), allowWorn=BigInt(s.worn), stock=BigInt(g.quantity), equipped=BigInt(g.equipped);
    // Worn is a permission cap; every available free unit precedes worn units.
    requireThat(allowed<=stock&&allowWorn<=equipped&&allowed<=stock-equipped+allowWorn,'INSUFFICIENT_MODS');
    queues[g.tier]!.push({m:g,n:allowed,source:g.id});
    return {s,g,allowed,allowWorn,free:stock-equipped};
  });
  const steps=new Map<number,FusePlan['steps'][number]>();let price=0n, segments=0;
  function appendRun(list:Run[],m:Mod,n:bigint) {
    if (!n) return; const last=list.at(-1);
    if(last&&modKey(last)===modKey(m)) last.quantity=(BigInt(last.quantity)+n).toString();
    else {requireThat(++segments<=MAX_FUSE_RUNS,'FUSE_PLAN_TOO_COMPLEX');list.push({...m,quantity:n.toString()});}
  }
  function available(t:number) {return queues[t]!.reduce((s,r)=>s+r.n,0n);}
  function ensure(t:number,n:bigint) {
    const missing=n-available(t);if(missing<=0n)return;
    requireThat(t>1,'INSUFFICIENT_MODS');generate(t,missing);
  }
  function generate(t:number,n:bigint) {
    ensure(t-1,n*3n);
    let remaining=n*3n;const carry:Mod[]=[];
    const step=steps.get(t)??{fromTier:t-1,toTier:t,count:'0',unitPrice:'0',price:'0',inputs:[],outputs:[]};
    steps.set(t,step);
    function emit(inputs:Mod[],copies:bigint) {
      const result=craft(inputs); const cost=BigInt(result.price)*copies;
      price+=cost;step.unitPrice=result.price;step.count=(BigInt(step.count)+copies).toString();step.price=(BigInt(step.price)+cost).toString();
      appendRun(step.outputs,result.result,copies);
      const q=queues[t]!,last=q.at(-1);
      if(last&&!last.source&&modKey(last.m)===modKey(result.result))last.n+=copies;
      else {requireThat(++segments<=MAX_FUSE_RUNS,'FUSE_PLAN_TOO_COMPLEX');q.push({m:result.result,n:copies});}
    }
    while(remaining>0n) {
      const r=queues[t-1]![0]!;let take=r.n<remaining?r.n:remaining;
      r.n-=take;remaining-=take;if(!r.n)queues[t-1]!.shift();
      if(r.source)used.set(r.source,(used.get(r.source)??0n)+take);
      appendRun(step.inputs,r.m,take);
      while(carry.length&&take>0n) {carry.push(r.m);take--;if(carry.length===3){emit(carry,1n);carry.length=0;}}
      if(take>=3n){emit([r.m,r.m,r.m],take/3n);take%=3n;}
      while(take-->0n)carry.push(r.m);
    }
    requireThat(!carry.length,'INCONSISTENT_FUSE');
  }
  generate(request.targetTier,BigInt(request.count));
  const outputs:Run[]=[];
  for(const r of queues[request.targetTier]!) {
    const same=outputs.find(o=>modKey(o)===modKey(r.m));
    if(same)same.quantity=(BigInt(same.quantity)+r.n).toString();else outputs.push({...r.m,quantity:r.n.toString()});
  }
  return {kind:request.kind,targetTier:request.targetTier,count:request.count,price:price.toString(),
    selected:selected.map(({s,g,allowed,allowWorn,free})=>{const n=used.get(g.id)??0n,w=n>free?n-free:0n;
      requireThat(w<=allowWorn,'INSUFFICIENT_MODS');
      return {id:g.id,allowed:s.quantity,allowWorn:s.worn,used:n.toString(),worn:w.toString(),unused:(allowed-n).toString(),remaining:(BigInt(g.quantity)-n).toString()};}),
    steps:[...steps.values()].sort((a,b)=>a.fromTier-b.fromTier),outputs};
}
