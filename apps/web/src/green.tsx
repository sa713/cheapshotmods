import React,{useEffect,useRef,useState} from 'react';
import {boundedInteger,greenFuseRequest,type GreenFusePlan,type GreenFuseRequest,type GreenRecipe} from '@chm/rules';
import {Select} from './select.js';
const titles={'green-667':'6 + 6 + 7 → 🅾️ 1.0 / 10','green-788':'7 + 8 + 8 → 🅾️ 1.0 / 12'};
interface Props {
  revision:string;experiment:string;disabled:boolean;
  onPreview:(request:GreenFuseRequest)=>Promise<GreenFusePlan>;
  onCommit:(request:GreenFuseRequest)=>Promise<boolean>;
  onRefresh:()=>Promise<void>;
  onError:(error:unknown)=>void;errorText:(error:unknown)=>string;
}
export function GreenFuse({revision,experiment,disabled,onPreview,onCommit,onRefresh,onError,errorText}:Props){
  const [recipe,setRecipe]=useState<GreenRecipe>('green-667'),[includeWorn,setWorn]=useState(false),[count,setCount]=useState<string>();
  const [calculation,setCalculation]=useState<{basis:string;key:string;plan:GreenFusePlan}>(),[loading,setLoading]=useState(false),[serverError,setServerError]=useState<{message:string;stale:boolean}>(),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
  const basis=JSON.stringify([revision,experiment,recipe,includeWorn]),meta=calculation?.basis===basis?calculation.plan:undefined;
  const key=JSON.stringify([basis,count,disabled,attempt]),latest=useRef(key);latest.current=key;
  let request:GreenFuseRequest|undefined,inputError='';
  try{request=greenFuseRequest({recipe,includeWorn,...(count!==undefined?{count}:{})});if(count!==undefined&&meta&&BigInt(count)>BigInt(meta.maxCount))inputError='Допустимый максимум: '+meta.maxCount+'. Завершите ввод, чтобы привести число к максимуму.';}catch(e){inputError=errorText(e);}
  useEffect(()=>{setCount(undefined);setNotice('');},[basis]);
  useEffect(()=>{
    let active=true;setLoading(false);setServerError(undefined);
    if(disabled||!request||inputError)return;
    const snapshot=request;setLoading(true);
    const timer=setTimeout(()=>{void onPreview(snapshot).then(plan=>{if(active&&latest.current===key)setCalculation({basis,key,plan});}).catch(e=>{if(active&&latest.current===key){setServerError({message:errorText(e),stale:e instanceof Error&&e.message==='REVISION_CONFLICT'});onError(e);}}).finally(()=>{if(active&&latest.current===key)setLoading(false);});},120);
    return ()=>{active=false;clearTimeout(timer);};
  },[key,onPreview]);
  const plan=calculation?.key===key&&!disabled&&!inputError&&!serverError?calculation.plan:undefined,displayed=count??meta?.count??'';
  function finish(){if(!count||!meta||meta.maxCount==='0')return;try{if(boundedInteger(count,false,256)>BigInt(meta.maxCount)){setCount(meta.maxCount);setNotice('Количество уменьшено до максимума: '+meta.maxCount+'.');}}catch{/* Visible error keeps apply disabled. */}}
  return <section className="green-fuse" aria-label="Зелёные рецепты"><h3>Зелёные рецепты</h3><p className="note">Две фиксированные комбинации сырья. Запас берётся из всего эксперимента, включая незагруженные группы. Один результат стоит 28 💎.</p>
    <Select label="Зелёный рецепт" value={recipe} disabled={disabled} onChange={v=>setRecipe(v as GreenRecipe)} options={(Object.keys(titles) as GreenRecipe[]).map(value=>({value,label:titles[value]}))}/>
    <label className="checkbox-control"><input type="checkbox" aria-label="Включить надетое сырьё" checked={includeWorn} disabled={disabled} onChange={e=>setWorn(e.target.checked)}/>Включить надетое сырьё</label><p className="note">Свободные расходуются первыми. Результат не надевается автоматически.</p>
    <p className="batch-maximum exact" id="green-maximum" data-testid="green-maximum" aria-live="polite">Максимум рецепта: {meta?.maxCount??'—'}</p>
    {meta&&<p className="exact" data-testid="green-maxima">Максимумы сейчас: 6 + 6 + 7 — {meta.maxima['green-667']}; 7 + 8 + 8 — {meta.maxima['green-788']}. Запас 7 общий: после применения остатки пересчитываются.</p>}
    <label>Количество результатов рецепта<input aria-label="Количество результатов рецепта" aria-describedby="green-maximum" inputMode="numeric" value={displayed} disabled={disabled||!meta||meta.maxCount==='0'} aria-invalid={!!inputError} onChange={e=>{setCount(e.target.value);setNotice('');}} onBlur={finish} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();finish();}}}/></label><p className="full-number exact">Выбрано результатов рецепта: {displayed||'—'}</p>
    {notice&&<p className="soft-note" role="status">{notice}</p>}{inputError&&<p className="notice" role="alert">{inputError}</p>}{loading&&<p className="note" data-testid="green-loading">Рассчитываем зелёный рецепт…</p>}
    {serverError&&<div className="notice" role="alert"><p>{serverError.message}</p>{serverError.stale?<button className="secondary" disabled={disabled} onClick={()=>void onRefresh()}>Загрузить сохранённые данные</button>:<button className="secondary" disabled={disabled} onClick={()=>setAttempt(n=>n+1)}>Повторить расчёт рецепта</button>}</div>}
    {plan&&<div className="batch-preview" data-testid="green-preview"><h4>Предварительный расчёт</h4><p className="exact">{titles[recipe]} · Результатов: {plan.count}</p>
      {plan.ingredients.map(i=><div key={i.value}><p className="exact">Зелёный {i.value}: доступно {i.available} · расход {i.used} · с персонажа {i.worn} · остаток {i.remaining}</p>{i.shortfall!=='0'&&<p className="notice exact">Для одного результата не хватает сырья {i.value}: {i.shortfall}.</p>}</div>)}
      <p className="batch-total exact">Полная цена рецепта: {plan.price} 💎</p><p className="note">Одна операция и одна отмена. Исходный и зафиксированный наборы сохраняются.</p>
    </div>}
    <button disabled={disabled||loading||!plan||plan.count==='0'} onClick={()=>{if(request&&plan)void onCommit({...request,count:plan.count});}}>Применить зелёный рецепт</button>
  </section>;
}
