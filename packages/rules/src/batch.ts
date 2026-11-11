import {boundedInteger, canonicalKind, compareGroups, craft, familyKind, hasCrit, isRaw, inputInteger, keys, modKey, record, requireThat, type Group, type Kind, type Mod} from './index.js';
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
  requireThat(Number.isInteger(r.targetTier)&&Number(r.targetTier)>=1&&Number(r.targetTier)<=6,'INVALID_TARGET');
  requireThat(!isRaw(kind)&&(kind!=='💚'||r.targetTier!==1),'INVALID_TARGET');
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
    requireThat(familyKind(g.kind)===request.kind&&g.tier<request.targetTier,'INCOMPATIBLE_MODS');
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
    requireThat(t>0,'INSUFFICIENT_MODS');generate(t,missing);
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

// TASK-007 is a single-source contract. The legacy parser/planner above remains
// available for historical receipts/fixtures; new server commands enter here.
export interface HomogeneousFuseRequest {
  id:string; targetTier:number; includeWorn:boolean; quantity?:string; count?:string;
}
export interface HomogeneousFusePlan extends FusePlan {
  source:FuseChoice; available:string; permitted:string; inputPerResult:string;
  maxCount:string; shortfall:string; result:Mod;
}
export function homogeneousFuseRequest(raw:unknown):HomogeneousFuseRequest {
  const r=record(raw);keys(r,['id','targetTier','includeWorn','quantity','count']);
  requireThat(typeof r.id==='string'&&r.id.length>0,'INVALID_SELECTION');
  requireThat(Number.isInteger(r.targetTier)&&Number(r.targetTier)>=1&&Number(r.targetTier)<=6,'INVALID_TARGET');
  requireThat(typeof r.includeWorn==='boolean','INVALID_SELECTION');
  if(r.quantity!==undefined)boundedInteger(r.quantity,true,256);
  if(r.count!==undefined)boundedInteger(r.count,false,256);
  return {id:r.id,targetTier:r.targetTier as number,includeWorn:r.includeWorn,...(r.quantity!==undefined?{quantity:r.quantity as string}:{}),...(r.count!==undefined?{count:r.count as string}:{})};
}
export function parseAnyFuseRequest(raw:unknown):HomogeneousFuseRequest|FuseRequest|GreenFuseRequest {
  const r=record(raw);
  if(Object.hasOwn(r,'recipe'))return greenFuseRequest(raw);
  return Object.hasOwn(r,'id')?homogeneousFuseRequest(raw):fuseRequest(raw);
}
function singleSourcePlan(g:FuseChoice,targetTier:number,allowed:bigint,allowWorn:bigint,count?:string):HomogeneousFusePlan {
  requireThat(targetTier>g.tier&&targetTier<=6,'INVALID_TARGET');
  requireThat(!hasCrit(g.kind)||g.crit!=null,'CRIT_REQUIRED');
  const stock=BigInt(g.quantity),free=stock-BigInt(g.equipped),available=free+allowWorn;
  requireThat(allowed>=0n&&allowed<=available&&allowWorn<=BigInt(g.equipped),'INSUFFICIENT_MODS');
  const inputPerResult=3n**BigInt(targetTier-g.tier),max=allowed/inputPerResult,n=count===undefined?max:BigInt(count);
  requireThat(n>=(count===undefined?0n:1n)&&n<=max,'FUSE_COUNT_OUT_OF_RANGE');
  let result:Mod=g;for(let t=g.tier;t<targetTier;t++)result=craft([result,result,result]).result;
  const kind=familyKind(g.kind),plan:FusePlan=n>0n?planFuse({kind,targetTier,count:n.toString(),items:[{id:g.id,quantity:allowed.toString(),worn:allowWorn.toString()}]},[g]):{
    kind,targetTier,count:'0',price:'0',steps:[],outputs:[],selected:[{id:g.id,allowed:allowed.toString(),allowWorn:allowWorn.toString(),used:'0',worn:'0',unused:allowed.toString(),remaining:g.quantity}]
  };
  return {...plan,source:g,available:available.toString(),permitted:allowed.toString(),inputPerResult:inputPerResult.toString(),maxCount:max.toString(),shortfall:(max===0n?inputPerResult-allowed:0n).toString(),result};
}
export function planHomogeneousFuse(request:HomogeneousFuseRequest,g:FuseChoice):HomogeneousFusePlan {
  requireThat(request.id===g.id,'GROUP_NOT_FOUND',404);
  const worn=request.includeWorn?BigInt(g.equipped):0n,available=BigInt(g.quantity)-BigInt(g.equipped)+worn;
  return singleSourcePlan(g,request.targetTier,request.quantity===undefined?available:BigInt(request.quantity),worn,request.count);
}
export function planCompatibleFuse(request:FuseRequest,choices:FuseChoice[]):HomogeneousFusePlan {
  requireThat(request.items.length===1,'HOMOGENEOUS_GROUP_REQUIRED');
  const s=request.items[0]!,g=choices.find(g=>g.id===s.id);requireThat(g,'GROUP_NOT_FOUND',404);
  requireThat(familyKind(g.kind)===request.kind,'INCOMPATIBLE_MODS');
  return singleSourcePlan(g,request.targetTier,BigInt(s.quantity),BigInt(s.worn),request.count);
}

export const greenRecipes={
  'green-667':[{value:'6',perResult:'2'},{value:'7',perResult:'1'}],
  'green-788':[{value:'7',perResult:'1'},{value:'8',perResult:'2'}]
} as const;
export type GreenRecipe=keyof typeof greenRecipes;
export interface GreenFuseRequest {recipe:GreenRecipe;includeWorn:boolean;count?:string}
export interface GreenFusePlan extends FusePlan {
  recipe:GreenRecipe;maxCount:string;result:Mod;
  maxima:Record<GreenRecipe,string>;
  ingredients:{value:string;perResult:string;available:string;total:string;used:string;worn:string;remaining:string;shortfall:string}[];
}
export function greenFuseRequest(raw:unknown):GreenFuseRequest {
  const r=record(raw);keys(r,['recipe','includeWorn','count']);
  requireThat(typeof r.recipe==='string'&&Object.hasOwn(greenRecipes,r.recipe),'INVALID_RECIPE');
  requireThat(typeof r.includeWorn==='boolean','INVALID_SELECTION');
  if(r.count!==undefined)boundedInteger(r.count,false,256);
  return {recipe:r.recipe as GreenRecipe,includeWorn:r.includeWorn,...(r.count!==undefined?{count:r.count as string}:{})};
}
export function planGreenFuse(request:GreenFuseRequest,choices:FuseChoice[]):GreenFusePlan {
  const recipe=greenRecipes[request.recipe];
  const available=(value:string)=>choices.filter(g=>g.kind==='raw-green'&&g.tier===0&&g.value===value&&g.crit==null).reduce((q,g)=>q+BigInt(g.quantity)-(request.includeWorn?0n:BigInt(g.equipped)),0n);
  const q6=available('6'),q7=available('7'),q8=available('8'),min=(a:bigint,b:bigint)=>a<b?a:b;
  const maxima={'green-667':min(q6/2n,q7).toString(),'green-788':min(q7,q8/2n).toString()};
  const pools=recipe.map(ingredient=>{
    const groups=choices.filter(g=>g.kind==='raw-green'&&g.tier===0&&g.value===ingredient.value&&g.crit==null).sort(compareGroups);
    const total=groups.reduce((q,g)=>q+BigInt(g.quantity),0n),worn=groups.reduce((q,g)=>q+BigInt(g.equipped),0n);
    requireThat(worn<=total&&groups.every(g=>BigInt(g.equipped)>=0n&&BigInt(g.equipped)<=BigInt(g.quantity)),'INSUFFICIENT_MODS');
    const available=total-(request.includeWorn?0n:worn);
    return {...ingredient,groups,total,available};
  });
  const poolMaxima=pools.map(p=>p.available/BigInt(p.perResult)),max=poolMaxima.reduce((a,b)=>a<b?a:b);
  const n=request.count===undefined?max:BigInt(request.count);
  requireThat(n>=(request.count===undefined?0n:1n)&&n<=max,'FUSE_COUNT_OUT_OF_RANGE');
  const sample=recipe.flatMap(p=>Array.from({length:Number(p.perResult)},()=>({kind:'raw-green' as const,tier:0,value:p.value,crit:null})));
  const {result,price:unitPrice}=craft(sample),price=(BigInt(unitPrice)*n).toString();
  const selected:FusePlan['selected']=[],ingredients:GreenFusePlan['ingredients']=[];
  for(const p of pools){
    let remaining=n*BigInt(p.perResult),wornUsed=0n;
    const used=new Map<string,{free:bigint;worn:bigint}>();
    // Across even separate equal groups, consume every free unit before worn.
    for(const g of p.groups){const free=BigInt(g.quantity)-BigInt(g.equipped),take=free<remaining?free:remaining;used.set(g.id,{free:take,worn:0n});remaining-=take;}
    if(request.includeWorn)for(const g of p.groups){const wear=BigInt(g.equipped),take=wear<remaining?wear:remaining;used.get(g.id)!.worn=take;remaining-=take;wornUsed+=take;}
    requireThat(remaining===0n,'INSUFFICIENT_MODS');
    for(const g of p.groups){const u=used.get(g.id)!,amount=u.free+u.worn,allowWorn=request.includeWorn?BigInt(g.equipped):0n,allowed=BigInt(g.quantity)-BigInt(g.equipped)+allowWorn;
      selected.push({id:g.id,allowed:allowed.toString(),allowWorn:allowWorn.toString(),used:amount.toString(),worn:u.worn.toString(),unused:(allowed-amount).toString(),remaining:(BigInt(g.quantity)-amount).toString()});}
    const required=n*BigInt(p.perResult);
    ingredients.push({value:p.value,perResult:p.perResult,available:p.available.toString(),total:p.total.toString(),used:required.toString(),worn:wornUsed.toString(),remaining:(p.total-required).toString(),shortfall:(p.available<BigInt(p.perResult)?BigInt(p.perResult)-p.available:0n).toString()});
  }
  const outputs=n?[{...result,quantity:n.toString()}]:[];
  return {recipe:request.recipe,kind:'🅾',targetTier:1,count:n.toString(),maxCount:max.toString(),maxima,price,result,selected,ingredients,outputs,
    steps:n?[{fromTier:0,toTier:1,count:n.toString(),unitPrice,price,inputs:pools.map(p=>({kind:'raw-green',tier:0,value:p.value,crit:null,quantity:(n*BigInt(p.perResult)).toString()})),outputs}]:[]};
}
