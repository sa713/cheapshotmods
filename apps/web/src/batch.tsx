import React,{useEffect,useRef,useState} from 'react';
import {boundedInteger,displayKind,displayTier,formatCrit,hasCrit,homogeneousFuseRequest,type Equipped,type Group,type HomogeneousFusePlan,type HomogeneousFuseRequest} from '@chm/rules';
import {ModCardTitle} from './presentation.js';
interface Props {
  groups:Group[]; equipment:Equipped[]; revision:string; disabled:boolean;
  onPreview:(request:HomogeneousFuseRequest)=>Promise<HomogeneousFusePlan>;
  onCommit:(request:HomogeneousFuseRequest)=>Promise<boolean>;
  onError:(error:unknown)=>void; errorText:(error:unknown)=>string; onRefine:(g:Group)=>void;
}
export function BatchFuse({groups,equipment,revision,disabled,onPreview,onCommit,onError,errorText,onRefine}:Props) {
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
  function finishCount(){
    if(!count||!meta||meta.maxCount==='0')return;
    try{const n=boundedInteger(count,false,256);if(n>BigInt(meta.maxCount)){setCount(meta.maxCount);setNotice('Допустимый максимум: '+meta.maxCount+'. Количество уменьшено до максимума.');}}catch{/* The visible input error remains; no command is sent. */}
  }
  return <section className="section-card batch-fuse" aria-label="Пакетный фьюз">
    <p className="eyebrow">ОДНА ГРУППА · АВТОМАТИЧЕСКИЙ МАКСИМУМ</p><h2>Массовый фьюз</h2>
    <p className="note">Выберите одинаковые исходные моды и цель. Максимум и стоимость появятся автоматически. Другие группы и готовые промежуточные моды не расходуются.</p>
    <label>Исходная группа<select aria-label="Исходная группа" value={id} disabled={disabled} onChange={e=>{
      const g=groups.find(g=>g.id===e.target.value);setId(e.target.value);setTarget(g?Math.min(g.tier+1,6):2);setWorn(false);setQuantity(undefined);resetCount();
    }}><option value="">Выберите группу модов</option>{groups.map(g=><option key={g.id} value={g.id}>{displayKind(g.kind)} · {displayTier(g)} · +{g.value}%{hasCrit(g.kind)?' · крит '+formatCrit(g.crit):''} · ×{g.quantity}</option>)}</select></label>
    <p className="note">В списке — загруженные группы. Остальные доступны через «Загрузить ещё группы» в инвентаре.</p>
    {!source&&<p className="soft-note">{id?'Группа сейчас не загружена или уже израсходована. Загрузите нужную страницу либо выберите другую.':'Выберите исходную группу для автоматического расчёта.'}</p>}
    {source&&<>
      <div className="batch-source"><ModCardTitle g={source}/><p className="exact">Всего: {source.quantity} · Надето: {worn.toString()}</p></div>
      <label>Целевой уровень<select aria-label="Целевой уровень" value={targets.includes(targetTier)?targetTier:''} disabled={disabled||!targets.length} onChange={e=>{setTarget(Number(e.target.value));resetCount();}}>{targets.length?targets.map(t=><option key={t} value={t}>{t}.0</option>):<option value="">Выше 6.0 не крафтится</option>}</select></label>
      <label className="checkbox-control"><input type="checkbox" aria-label="Включить надетые" checked={includeWorn} disabled={disabled} onChange={e=>{setWorn(e.target.checked);setQuantity(undefined);resetCount();}}/>Включить надетые</label>
      <p className="note">Сначала расходуются ненадетые. Опция разрешает только экипировку выбранной группы.</p>
      <p className="exact">Доступно исходных: {available}</p>
      <label>Разрешено исходных<input inputMode="numeric" aria-label="Разрешено исходных" value={quantity??available} disabled={disabled} onChange={e=>{setQuantity(e.target.value);resetCount();}}/></label>
      <p className="exact full-number">Разрешено: {quantity??available}</p>
      {unknown&&<div className="notice" role="alert"><p>Крит этой группы неизвестен: сначала уточните его. Ноль автоматически не подставляется.</p><button disabled={disabled} onClick={()=>onRefine(source)}>Уточнить крит группы</button></div>}
      <p className="batch-maximum exact" id="batch-maximum" data-testid="batch-maximum" aria-live="polite">Максимум: {meta?.maxCount??'—'}</p>
      {meta&&<p className="exact">На один результат: {meta.inputPerResult} исходных · Разрешённый запас: {meta.permitted}</p>}
      <label>Количество результатов<input inputMode="numeric" aria-label="Количество результатов" aria-describedby="batch-maximum" pattern="[1-9][0-9]*" value={displayed} disabled={disabled||!meta||meta.maxCount==='0'} aria-invalid={!!inputError} onChange={e=>{setCount(e.target.value);setNotice('');}} onBlur={finishCount} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();finishCount();}}}/></label>
      <p className="exact full-number">Выбрано результатов: {displayed||'—'}</p>
      {notice&&<p className="soft-note" role="status">{notice}</p>}
      {inputError&&<p className="notice" role="alert">{inputError}</p>}
      {loading&&<p className="note" data-testid="batch-loading">Рассчитываем актуальный пакет…</p>}
      {serverError&&<div className="notice" role="alert"><p>{serverError}</p><button className="secondary" disabled={disabled} onClick={()=>setAttempt(n=>n+1)}>Повторить расчёт</button></div>}
      {plan&&<div className="batch-preview" data-testid="batch-preview"><h3>Предварительный расчёт</h3>
        {plan.maxCount==='0'?<p className="notice exact">Для одного мода {targetTier}.0 нужно {plan.inputPerResult} модов {displayTier(source)}, доступно {plan.permitted}. Не хватает: {plan.shortfall}.</p>:<>
          <p className="exact">Результатов: {plan.count} · {displayKind(plan.result.kind)} {displayTier(plan.result)} · +{plan.result.value}%{hasCrit(plan.result.kind)?' · Крит: '+formatCrit(plan.result.crit):''}</p>
          {plan.selected.map(s=><p className="exact" key={s.id}>Расход исходных: {s.used} · С персонажа: {s.worn} · Остаток: {s.remaining}</p>)}
          <h4>Переходы</h4>{plan.steps.map(step=><details key={step.fromTier}><summary className="exact">{displayTier({tier:step.fromTier})} → {step.toTier}.0 · ×{step.count} · {step.price} 💎</summary><p className="exact">Цена одного перехода: {step.unitPrice} 💎</p>{step.outputs.map((o,i)=><p className="exact" key={i}>{displayKind(o.kind)} {displayTier(o)} · +{o.value}%{hasCrit(o.kind)?' · крит '+formatCrit(o.crit):''} · ×{o.quantity}</p>)}</details>)}
        </>}
        <p className="batch-total exact">Полная цена: {plan.price} 💎</p><p className="note">Одна операция и одна отмена. Результат не надевается автоматически.</p>
      </div>}
      <button disabled={disabled||loading||!plan||plan.count==='0'} onClick={()=>{
        if(plan&&request)void onCommit({...request,quantity:plan.permitted,count:plan.count});
      }}>Применить пакет</button>
    </>}
  </section>;
}
