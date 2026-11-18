import React,{useEffect,useRef,useState} from 'react';
import {boundedInteger,greenFuseRequest,type GreenFusePlan,type GreenFuseRequest,type GreenRecipe} from '@chm/rules';
import {Choices} from './select.js';
import {ModIcon} from './presentation.js';
const titles={'green-667':'6 + 6 + 7 → 🅾️ 1.0 / 10','green-788':'7 + 8 + 8 → 🅾️ 1.0 / 12'};
interface Props {
  revision:string;experiment:string;disabled:boolean;
  onPreview:(request:GreenFuseRequest)=>Promise<GreenFusePlan>;
  onCommit:(request:GreenFuseRequest)=>Promise<boolean>;
  onError:(error:unknown)=>void;errorText:(error:unknown)=>string;
}
export function GreenFuse({revision,experiment,disabled,onPreview,onCommit,onError,errorText}:Props){
  const [recipe,setRecipe]=useState<GreenRecipe>('green-667'),[includeWorn,setWorn]=useState(false),[count,setCount]=useState<string>();
  const [calculation,setCalculation]=useState<{basis:string;key:string;plan:GreenFusePlan}>(),[loading,setLoading]=useState(false),[serverError,setServerError]=useState(''),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
  const basis=JSON.stringify([revision,experiment,recipe,includeWorn]),meta=calculation?.basis===basis?calculation.plan:undefined;
  const key=JSON.stringify([basis,count,disabled,attempt]),latest=useRef(key);latest.current=key;
  let request:GreenFuseRequest|undefined,inputError='';
  try{request=greenFuseRequest({recipe,includeWorn,...(count!==undefined?{count}:{})});if(count!==undefined&&meta&&BigInt(count)>BigInt(meta.maxCount))inputError='Допустимый максимум: '+meta.maxCount+'. Завершите ввод, чтобы привести число к максимуму.';}catch(e){inputError=errorText(e);}
  useEffect(()=>{setCount(undefined);setNotice('');},[basis]);
  useEffect(()=>{
    let active=true;setLoading(false);setServerError('');
    if(disabled||!request||inputError)return;
    const snapshot=request;setLoading(true);
    const timer=setTimeout(()=>{void onPreview(snapshot).then(plan=>{if(active&&latest.current===key)setCalculation({basis,key,plan});}).catch(e=>{if(active&&latest.current===key){setServerError(errorText(e));onError(e);}}).finally(()=>{if(active&&latest.current===key)setLoading(false);});},120);
    return ()=>{active=false;clearTimeout(timer);};
  },[key,onPreview]);
  const plan=calculation?.key===key&&!disabled&&!inputError&&!serverError?calculation.plan:undefined,displayed=count??meta?.count??'';
  function finish(){if(!count||!meta||meta.maxCount==='0')return;try{if(boundedInteger(count,false,256)>BigInt(meta.maxCount)){setCount(meta.maxCount);setNotice('Количество уменьшено до максимума: '+meta.maxCount+'.');}}catch{/* Visible error keeps apply disabled. */}}
  return <section className="panel fuse-panel green-fuse" aria-label="Зелёные рецепты">
    <p className="panel-intro">Две фиксированные комбинации зелёного сырья. Запас берётся из всего эксперимента, включая незагруженные группы. Один результат стоит 28 💎.</p>
    <Choices label="Зелёный рецепт" value={recipe} disabled={disabled} onChange={v=>setRecipe(v as GreenRecipe)} options={(Object.keys(titles) as GreenRecipe[]).map(value=>({value,label:titles[value]+(meta?' · макс. '+meta.maxima[value]:'')}))}/>
    <label className="switch"><input type="checkbox" role="switch" aria-label="Включить надетое сырьё" checked={includeWorn} disabled={disabled} onChange={e=>setWorn(e.target.checked)}/><span className="switch-track" aria-hidden="true"/><span>Включить надетое сырьё<small>Свободные расходуются первыми. Результат не надевается автоматически.</small></span></label>
    <div className="field"><label htmlFor="green-count">Количество результатов рецепта</label><div className="input-with-action"><input id="green-count" aria-label="Количество результатов рецепта" aria-describedby="green-maximum" inputMode="numeric" value={displayed} disabled={disabled||!meta||meta.maxCount==='0'} aria-invalid={!!inputError} onChange={e=>{setCount(e.target.value);setNotice('');}} onBlur={finish} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();finish();}}} autoComplete="off"/><button type="button" className="secondary small" aria-label="Установить максимум рецепта" disabled={disabled||!meta||meta.maxCount==='0'||count===undefined} onClick={()=>{setCount(undefined);setNotice('');}}>Макс</button></div>
      <span className="hint exact batch-maximum" id="green-maximum" data-testid="green-maximum" aria-live="polite">Максимум рецепта: {meta?.maxCount??'—'}</span>{displayed.length>20&&<span className="full-number exact">{displayed}</span>}</div>
    {meta&&<p className="hint exact" data-testid="green-maxima">Максимумы сейчас: 6 + 6 + 7 — {meta.maxima['green-667']}; 7 + 8 + 8 — {meta.maxima['green-788']}. Запас 7 общий: после применения остатки пересчитываются.</p>}
    {notice&&<p className="banner info" role="status">{notice}</p>}{inputError&&<p className="banner error" role="alert">{inputError}</p>}
    {serverError&&<div className="banner error" role="alert"><p>{serverError}</p><button className="secondary" disabled={disabled} onClick={()=>setAttempt(n=>n+1)}>Повторить расчёт рецепта</button></div>}
    <div className={'plan'+(loading?' is-loading':'')} aria-busy={loading}>
      {loading&&<p className="plan-loading" data-testid="green-loading">Рассчитываем зелёный рецепт…</p>}
      {plan&&<div className="plan-body" data-testid="green-preview">
        <div className="plan-result"><span className="plan-count exact">{plan.count} ×</span><ModIcon kind="🅾"/><span className="exact">{titles[recipe]}<span className="sr-only"> · Результатов: {plan.count}</span></span></div>
        <table className="ingredients"><thead><tr><th scope="col">Сырьё</th><th scope="col">Доступно</th><th scope="col">Расход</th><th scope="col">С персонажа</th><th scope="col">Остаток</th></tr></thead>
          <tbody>{plan.ingredients.map(i=><tr key={i.value}><th scope="row">Зелёный {i.value}</th><td className="exact">{i.available}</td><td className="exact">{i.used}</td><td className="exact">{i.worn}</td><td className="exact">{i.remaining}</td></tr>)}</tbody></table>
        {plan.ingredients.filter(i=>i.shortfall!=='0').map(i=><p key={i.value} className="banner warn exact">Для одного результата не хватает сырья {i.value}: {i.shortfall}.</p>)}
        <p className="plan-total exact">Полная цена рецепта: {plan.price} 💎</p>
      </div>}
    </div>
    <div className="apply-row"><p className="hint">Одна операция и одна отмена. Исходный набор и точка возврата сохраняются.</p><button className="primary" disabled={disabled||loading||!plan||plan.count==='0'} onClick={()=>{if(request&&plan)void onCommit({...request,count:plan.count});}}>Применить зелёный рецепт</button></div>
  </section>;
}
