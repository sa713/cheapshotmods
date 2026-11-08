import {randomUUID} from 'node:crypto';
import {integer,modKey,requireThat,type Mod} from '@chm/rules';
export interface Range {origin:string;start:string;quantity:string}
export interface Piece extends Mod,Range {born:string}
export interface LotUndo {inputs:Piece[];outputs:{origin:string;quantity:string}[];worn:Range[]}
const end=(r:Range)=>BigInt(r.start)+BigInt(r.quantity);
function intersection(a:Range,b:Range):Range|undefined {
  if(a.origin!==b.origin)return;
  const start=BigInt(a.start)>BigInt(b.start)?BigInt(a.start):BigInt(b.start), stop=end(a)<end(b)?end(a):end(b);
  if(stop>start)return {origin:a.origin,start:start.toString(),quantity:(stop-start).toString()};
}
function subtract(a:Range,b:Range):Range[] {
  const i=intersection(a,b);if(!i)return [a];const out:Range[]=[];
  if(BigInt(a.start)<BigInt(i.start))out.push({...a,quantity:(BigInt(i.start)-BigInt(a.start)).toString()});
  if(end(i)<end(a))out.push({...a,start:end(i).toString(),quantity:(end(a)-end(i)).toString()});return out;
}
export class Lots {
  constructor(public pieces:Piece[]=[],public worn:Range[]=[]) {this.validate();}
  clone() {return new Lots(structuredClone(this.pieces),structuredClone(this.worn));}
  validate() {
    const origins=new Map<string,Piece[]>();
    for(const p of this.pieces){integer(p.quantity);integer(p.start,true);BigInt(p.born);const rows=origins.get(p.origin)??[];
      requireThat(rows.every(r=>!intersection(r,p)),'INCONSISTENT_MOD_HISTORY',503);rows.push(p);origins.set(p.origin,rows);}
    let total=0n;const seen:Range[]=[];
    for(const w of this.worn){integer(w.quantity);integer(w.start,true);total+=BigInt(w.quantity);
      requireThat(seen.every(r=>!intersection(r,w)),'INCONSISTENT_MOD_HISTORY',503);seen.push(w);
      const covered=this.pieces.reduce((s,p)=>s+BigInt(intersection(p,w)?.quantity??'0'),0n);
      requireThat(covered===BigInt(w.quantity),'INCONSISTENT_MOD_HISTORY',503);}
    requireThat(total<=100n,'EQUIPMENT_LIMIT');
  }
  add(m:Mod,n:bigint,born:string,origin=randomUUID()) {
    requireThat(n>0n);const p:Piece={...m,origin,start:'0',quantity:n.toString(),born};this.pieces.push(p);return p;
  }
  restore(pieces:Piece[]) {this.pieces.push(...structuredClone(pieces));this.compact();this.validate();}
  ordered(key:string) {return this.pieces.filter(p=>modKey(p)===key).sort((a,b)=>{
    const born=BigInt(a.born)-BigInt(b.born);if(born)return born<0n?-1:1;
    return a.origin.localeCompare(b.origin)||(BigInt(a.start)<BigInt(b.start)?-1:1);});}
  segments(p:Piece) {
    const worn=this.worn.map(w=>intersection(p,w)).filter((w):w is Range=>!!w).sort((a,b)=>BigInt(a.start)<BigInt(b.start)?-1:1);
    let free:Range[]=[p];for(const w of worn)free=free.flatMap(f=>subtract(f,w));
    return {free,worn};
  }
  wornCount(key:string) {return this.pieces.filter(p=>modKey(p)===key).reduce((s,p)=>s+this.segments(p).worn.reduce((n,w)=>n+BigInt(w.quantity),0n),0n);}
  take(key:string,quantity:bigint,worn:bigint):Piece[] {
    requireThat(quantity>=worn&&worn>=0n,'INVALID_SELECTION');
    const selected:Piece[]=[];
    for(const [mode,needed] of [['free',quantity-worn],['worn',worn]] as const){let remaining=needed;
      for(const p of this.ordered(key)){for(const range of this.segments(p)[mode]){
        if(!remaining)break;const n=BigInt(range.quantity)<remaining?BigInt(range.quantity):remaining;
        selected.push({...p,start:range.start,quantity:n.toString()});remaining-=n;
      }if(!remaining)break;}
      requireThat(remaining===0n,'INSUFFICIENT_MODS');
    }
    for(const range of selected){this.pieces=this.pieces.flatMap(p=>subtract(p,range).map(r=>({...p,...r})));
      this.worn=this.worn.flatMap(w=>subtract(w,range));}
    this.compact();return selected;
  }
  equip(items:{key:string;quantity:bigint}[]) {
    this.worn=[];let total=0n;
    for(const {key,quantity} of items){total+=quantity;requireThat(total<=100n,'EQUIPMENT_LIMIT');let n=quantity;
      for(const p of this.ordered(key)){if(!n)break;const take=BigInt(p.quantity)<n?BigInt(p.quantity):n;
        this.worn.push({origin:p.origin,start:p.start,quantity:take.toString()});n-=take;}
      requireThat(!n,'INSUFFICIENT_MODS');}
    this.validate();
  }
  removeOutputs(outputs:LotUndo['outputs']) {
    for(const output of outputs){const rows=this.pieces.filter(p=>p.origin===output.origin);
      requireThat(rows.reduce((n,p)=>n+BigInt(p.quantity),0n)===BigInt(output.quantity),'INCONSISTENT_MOD_HISTORY',503);
      this.pieces=this.pieces.filter(p=>p.origin!==output.origin);this.worn=this.worn.filter(w=>w.origin!==output.origin);}
  }
  totals() {const result=new Map<string,{m:Mod;quantity:bigint}>();
    for(const p of this.pieces){const k=modKey(p),r=result.get(k);if(r)r.quantity+=BigInt(p.quantity);else result.set(k,{m:{kind:p.kind,tier:p.tier,value:p.value,crit:p.crit??null},quantity:BigInt(p.quantity)});}return result;}
  compact() {
    const rows=[...this.pieces].sort((a,b)=>a.origin.localeCompare(b.origin)||(BigInt(a.start)<BigInt(b.start)?-1:1));
    this.pieces=[];
    for(const p of rows){const last=this.pieces.at(-1);if(last&&last.origin===p.origin&&end(last)===BigInt(p.start)&&modKey(last)===modKey(p))last.quantity=(BigInt(last.quantity)+BigInt(p.quantity)).toString();else this.pieces.push(p);}
  }
}
