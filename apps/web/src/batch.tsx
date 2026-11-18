import React,{useEffect,useRef,useState} from 'react';
import {boundedInteger,compareGroups,displayKind,displayTier,formatCrit,hasCrit,homogeneousFuseRequest,type Equipped,type Group,type HomogeneousFusePlan,type HomogeneousFuseRequest} from '@chm/rules';
import {ModIcon,ModTitle} from './presentation.js';
import {Choices,Select} from './select.js';
interface Props {
  groups:Group[]; equipment:Equipped[]; revision:string; disabled:boolean;
  onPreview:(request:HomogeneousFuseRequest)=>Promise<HomogeneousFusePlan>;
  onCommit:(request:HomogeneousFuseRequest)=>Promise<boolean>;
  onError:(error:unknown)=>void; errorText:(error:unknown)=>string; onRefine:(g:Group)=>void;
  preset?:{id:string;nonce:number};
}
export function BatchFuse({groups,equipment,revision,disabled,onPreview,onCommit,onError,errorText,onRefine,preset}:Props) {
  const [id,setId]=useState(''),[targetTier,setTarget]=useState(2),[includeWorn,setWorn]=useState(false);
  const [quantity,setQuantity]=useState<string>(),[count,setCount]=useState<string>();
  const [calculation,setCalculation]=useState<{basis:string;key:string;plan:HomogeneousFusePlan}>();
  const [loading,setLoading]=useState(false),[serverError,setServerError]=useState(''),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(0);
  const source=groups.find(g=>g.id===id),worn=BigInt(equipment.find(e=>e.id===id)?.quantity??'0');
  const available=source?(BigInt(source.quantity)-(includeWorn?0n:worn)).toString():'0';
  const targets=source?[1,2,3,4,5,6].filter(t=>t>source.tier):[];
  const unknown=source&&hasCrit(source.kind)&&source.crit==null;
  const basis=JSON.stringify([revision,source??null,targetTier,includeWorn,quantity,worn.toString()]);
  const meta=calculation?.basis===basis?calculation.plan:undefined;
  const key=JSON.stringify([basis,count,disabled,attempt]);
  const latest=useRef(key);latest.current=key;
  let request:HomogeneousFuseRequest|undefined,inputError='';
  if(source&&!targets.includes(targetTier))inputError='Уровень 6.0 — максимальный. Выберите группу с более низким уровнем.';
  else if(source&&!unknown){try {
    request=homogeneousFuseRequest({id,targetTier,includeWorn,...(quantity!==undefined?{quantity}:{}),...(count!==undefined?{count}:{})});
    if(quantity!==undefined&&BigInt(quantity)>BigInt(available))inputError='Разрешённое количество не может превышать доступный запас: '+available+'.';
    if(count!==undefined&&meta&&BigInt(count)>BigInt(meta.maxCount))inputError='Допустимый максимум: '+meta.maxCount+'. Завершите ввод, чтобы привести число к максимуму.';
  }catch(e){inputError=errorText(e);}}
  useEffect(()=>{setCount(undefined);setQuantity(undefined);setNotice('');},[revision]);
  useEffect(()=>{
    let active=true;setLoading(false);
    if(disabled)return;
    setServerError('');
    if(!request||inputError||unknown)return;
    const snapshot=request;setLoading(true);
    const timer=setTimeout(()=>{void onPreview(snapshot).then(plan=>{
      if(active&&latest.current===key)setCalculation({basis,key,plan});
    }).catch(error=>{if(active&&latest.current===key){setServerError(error instanceof Error&&error.message==='SERVER_ERROR'?'Ошибка сервера при расчёте. Повторите расчёт.':errorText(error));onError(error);}}).finally(()=>{
      if(active&&latest.current===key)setLoading(false);
    });},120);
    return ()=>{active=false;clearTimeout(timer);};
  },[key,onPreview]);
  const plan=calculation?.key===key&&!serverError&&!inputError&&!disabled?calculation.plan:undefined;
  const displayed=count??meta?.count??'';
  function resetCount(){setCount(undefined);setNotice('');}
  function choose(value:string){const g=groups.find(g=>g.id===value);setId(value);setTarget(g?Math.min(g.tier+1,6):2);setWorn(false);setQuantity(undefined);resetCount();}
  // Opening «Массовый фьюз» from a mod card preselects that group.
  useEffect(()=>{if(preset)choose(preset.id);},[preset?.nonce]);
  function finishCount(){
    if(!count||!meta||meta.maxCount==='0')return;
    try{const n=boundedInteger(count,false,256);if(n>BigInt(meta.maxCount)){setCount(meta.maxCount);setNotice('Допустимый максимум: '+meta.maxCount+'. Количество уменьшено до максимума.');}}catch{/* The visible input error remains; no command is sent. */}
  }
  return <section className="panel fuse-panel batch-fuse" aria-label="Пакетный фьюз">
    <p className="panel-intro">Одна группа одинаковых модов поднимается сразу на нужный уровень. Максимум и цена считаются автоматически; другие группы и готовые промежуточные моды не расходуются.</p>
    <Select label="Исходная группа" value={id} disabled={disabled} onChange={choose} options={[{value:'',label:'Выберите группу модов'},...[...groups].sort(compareGroups).map(g=>({value:g.id,label:displayKind(g.kind)+' '+displayTier(g)+' · +'+g.value+'%'+(hasCrit(g.kind)?' · крит '+formatCrit(g.crit):'')+' · ×'+g.quantity}))]}/>
    {!source&&<p className="hint">{id?'Группа сейчас не загружена или уже израсходована. Загрузите нужную страницу в эксперименте либо выберите другую.':'В списке — загруженные группы эксперимента. Группу можно выбрать и из карточки мода.'}</p>}
    {source&&<>
      <div className="source-card"><ModIcon kind={source.kind}/><ModTitle g={source} as="p"/><p className="exact source-stock">всего {source.quantity}<br/>надето {worn.toString()}</p></div>
      {targets.length?<Choices label="Целевой уровень" value={targets.includes(targetTier)?String(targetTier):''} disabled={disabled} onChange={t=>{setTarget(Number(t));resetCount();}} options={targets.map(t=>({value:String(t),label:t+'.0'}))}/>:<p className="fixed-param">Целевой уровень: выше 6.0 не крафтится.</p>}
      <label className="switch"><input type="checkbox" role="switch" aria-label="Включить надетые" checked={includeWorn} disabled={disabled} onChange={e=>{setWorn(e.target.checked);setQuantity(undefined);resetCount();}}/><span className="switch-track" aria-hidden="true"/><span>Включить надетые<small>Сначала расходуются ненадетые; опция касается только этой группы.</small></span></label>
      <div className="field-pair">
        <label className="field">Разрешено исходных<input inputMode="numeric" aria-label="Разрешено исходных" value={quantity??available} disabled={disabled} onChange={e=>{setQuantity(e.target.value);resetCount();}} autoComplete="off"/><span className="hint exact">доступно {available}</span>{(quantity??available).length>20&&<span className="full-number exact">{quantity??available}</span>}</label>
        <div className="field"><label htmlFor="batch-count">Количество результатов</label><div className="input-with-action"><input id="batch-count" inputMode="numeric" aria-label="Количество результатов" aria-describedby="batch-maximum" pattern="[1-9][0-9]*" value={displayed} disabled={disabled||!meta||meta.maxCount==='0'} aria-invalid={!!inputError} onChange={e=>{setCount(e.target.value);setNotice('');}} onBlur={finishCount} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();finishCount();}}} autoComplete="off"/><button type="button" className="secondary small" aria-label="Установить максимум" disabled={disabled||!meta||meta.maxCount==='0'||count===undefined} onClick={resetCount}>Макс</button></div>
          <span className="hint exact batch-maximum" id="batch-maximum" data-testid="batch-maximum" aria-live="polite">Максимум: {meta?.maxCount??'—'}</span>{displayed.length>20&&<span className="full-number exact">{displayed}</span>}</div>
      </div>
      {meta&&<p className="hint exact">На один результат нужно {meta.inputPerResult} исходных · разрешённый запас {meta.permitted}</p>}
      {notice&&<p className="banner info" role="status">{notice}</p>}
      {unknown&&<div className="banner warn" role="alert"><p>Крит этой группы неизвестен: сначала уточните его. Ноль автоматически не подставляется.</p><button className="secondary" disabled={disabled} onClick={()=>onRefine(source)}>Уточнить крит группы</button></div>}
      {inputError&&<p className="banner error" role="alert">{inputError}</p>}
      {serverError&&<div className="banner error" role="alert"><p>{serverError}</p><button className="secondary" disabled={disabled} onClick={()=>setAttempt(n=>n+1)}>Повторить расчёт</button></div>}
      <div className={'plan'+(loading?' is-loading':'')} aria-busy={loading}>
        {loading&&<p className="plan-loading" data-testid="batch-loading">Рассчитываем актуальный пакет…</p>}
        {plan&&<div className="plan-body" data-testid="batch-preview">
          {plan.maxCount==='0'?<p className="banner warn exact">Для одного мода {targetTier}.0 нужно {plan.inputPerResult} модов {displayTier(source)}, доступно {plan.permitted}. Не хватает: {plan.shortfall}.</p>:<>
            <div className="plan-result"><span className="plan-count exact">{plan.count} ×</span><ModIcon kind={plan.result.kind}/><span className="exact"><span className="sr-only">Результатов: {plan.count} · {displayKind(plan.result.kind)} </span>{displayTier(plan.result)} · +{plan.result.value}%{hasCrit(plan.result.kind)?' · Крит: '+formatCrit(plan.result.crit):''}</span></div>
            {plan.selected.map(s=><p className="plan-line exact" key={s.id}>Расход исходных: {s.used} · С персонажа: {s.worn} · Остаток: {s.remaining}</p>)}
            <details className="steps"><summary>Переходы · {plan.steps.length}</summary>{plan.steps.map(step=><div className="step" key={step.fromTier}><p className="exact"><b>{displayTier({tier:step.fromTier})} → {step.toTier}.0</b> · ×{step.count} · {step.price} 💎 <span className="muted">({step.unitPrice} 💎 за переход)</span></p>{step.outputs.map((o,i)=><p className="exact muted" key={i}>{displayKind(o.kind)} {displayTier(o)} · +{o.value}%{hasCrit(o.kind)?' · крит '+formatCrit(o.crit):''} · ×{o.quantity}</p>)}</div>)}</details>
          </>}
          <p className="plan-total exact">Полная цена: {plan.price} 💎</p>
        </div>}
        {!plan&&!loading&&!unknown&&!inputError&&!serverError&&<p className="hint">Расчёт появится автоматически.</p>}
      </div>
      <div className="apply-row"><p className="hint">Одна операция и одна отмена. Результат не надевается автоматически.</p><button className="primary" disabled={disabled||loading||!plan||plan.count==='0'} onClick={()=>{
        if(plan&&request)void onCommit({...request,quantity:plan.permitted,count:plan.count});
      }}>Применить пакет</button></div>
    </>}
  </section>;
}
