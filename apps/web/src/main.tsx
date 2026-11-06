import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {craft, inputInteger, kinds, mod, type Equipped, type Group, type Kind, type Selection} from '@chm/rules';
import type {Store} from '../../server/src/store.js';
import './style.css';

type State = ReturnType<Store['summary']>;
type Scope = 'original'|'work';
type Command = {key:string;revision:string;experiment:string;action:Record<string,unknown>};
type Page = {revision:string;items:Group[]};
type Session = {csrf:string;account:string};
type WebApp = {initData?:string;ready?:()=>void;expand?:()=>void};
class ApiError extends Error {constructor(readonly status:number, readonly code:string){super(code);}}
const explanations:Record<string,string> = {
  INVALID_INTEGER:'Введите положительное целое число без пробелов и дробной части.',
  INTEGER_TOO_LONG:'Одно поле может содержать до 128 цифр. Это технический размер ввода, не предел инвентаря.',
  INVALID_MOD:'Проверьте тип, уровень и параметр мода.',
  EQUIPMENT_LIMIT:'Можно надеть не больше 100 модов суммарно.',
  INSUFFICIENT_MODS:'В рабочем наборе недостаточно выбранных экземпляров.',
  INCOMPATIBLE_MODS:'Для крафта нужны три мода одного типа и уровня от 1.0 до 5.0.',
  SELECT_THREE:'Выберите ровно три экземпляра для крафта.',
  LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подождите минуту.',
  SERVER_ERROR:'Ошибка сервера. Изменения не подтверждены. Повторите ту же команду.',
  COMMAND_EXPIRED:'Срок хранения ответа команды истёк. Повторного применения не было; загрузите актуальные данные.',
  UNAUTHORIZED:'Сессия завершилась. Войдите через Telegram заново.',
  EXPIRED_INIT_DATA:'Данные входа Telegram устарели. Закройте Mini App и откройте его заново.',
  INVALID_INIT_DATA:'Telegram не подтвердил вход. Откройте Mini App заново.',
};
function explain(error:unknown) {return error instanceof Error ? explanations[error.message]??'Не удалось выполнить действие. Проверьте данные и соединение.' : 'Не удалось выполнить действие.';}
async function api<T>(url:string, options:RequestInit = {}):Promise<T> {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  if (!response.ok) {const body=await response.json().catch(()=>({}));throw new ApiError(response.status,body.error??'SERVER_ERROR');}
  return await response.json() as T;
}
const post=(body:unknown,csrf?:string):RequestInit=>({method:'POST',headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:JSON.stringify(body)});
function total(items:Equipped[]) {return items.reduce((n,e)=>n+BigInt(e.quantity),0n).toString();}
function NumberField({label,value,onChange,zero=false}:{label:string;value:string;onChange:(v:string)=>void;zero?:boolean}) {
  return <label>{label}<input inputMode="numeric" pattern={zero?'[0-9]+':'[1-9][0-9]*'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="off" spellCheck={false} required /></label>;
}
function ModText({g}:{g:Pick<Group,'kind'|'tier'|'value'>}) {
  return <span className="mod-text">{g.kind} <strong>{g.tier}.0</strong> · <span className="exact">+{g.value}%</span></span>;
}

function App() {
  const [config,setConfig]=useState<{oidc:boolean;mini:boolean}>();
  const [session,setSession]=useState<Session>();
  const [state,setState]=useState<State>();
  const [scope,setScope]=useState<Scope>('work');
  const [pages,setPages]=useState<Record<Scope,Group[]>>({original:[],work:[]});
  const [more,setMore]=useState<Record<Scope,boolean>>({original:false,work:false});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [message,setMessage]=useState('Подключаемся…');
  const [problem,setProblem]=useState(''), [conflict,setConflict]=useState(false), [pending,setPending]=useState<Command>();
  const [selection,setSelection]=useState<Selection[]>([]), [resetOpen,setResetOpen]=useState(false);
  const [edit,setEdit]=useState<Group|null|undefined>(), [level,setLevel]=useState('1');
  const [kind,setKind]=useState<Kind>('🅾'), [tier,setTier]=useState(1), [value,setValue]=useState('10'), [quantity,setQuantity]=useState('1');
  const [equipGroup,setEquipGroup]=useState<Group>(), [equipCount,setEquipCount]=useState('1');
  const lock=useRef(false);
  const storageKey=session?'chm_pending_'+session.account:undefined;
  const webApp=()=> (window as Window & {Telegram?:{WebApp?:WebApp}}).Telegram?.WebApp;
  const load=useCallback(async()=>{
    const current=await api<State>('/api/state');
    const [original,work]=await Promise.all([api<Page>('/api/inventory?scope=original&limit=100'),api<Page>('/api/inventory?scope=work&limit=100')]);
    if (original.revision!==current.revision || work.revision!==current.revision) throw new ApiError(409,'REVISION_CONFLICT');
    setState(current);setLevel(current.level);setPages({original:original.items,work:work.items});
    setMore({original:original.items.length===100,work:work.items.length===100});setSelection([]);
  },[]);
  useEffect(()=>{
    void(async()=>{
      webApp()?.ready?.(); webApp()?.expand?.();
      const c=await api<{oidc:boolean;mini:boolean}>('/api/config');setConfig(c);
      let s:Session|undefined;
      try {s=await api<Session>('/api/session');} catch(e) {if (!(e instanceof ApiError && e.status===401)) throw e;}
      const initData=webApp()?.initData;
      if (!s && initData && c.mini && !new URLSearchParams(location.search).has('logged_out')) {
        await api('/auth/mini',post({initData}));s=await api<Session>('/api/session');
      }
      if (s) {
        setSession(s);await load();setMessage('Все изменения сохранены');
        try {const stored=sessionStorage.getItem('chm_pending_'+s.account);if (stored) {setPending(JSON.parse(stored) as Command);setMessage('Есть команда с неподтверждённым результатом. Безопасно повторите её.');}} catch { /* Storage may be unavailable in a WebView. */ }
      } else setMessage(new URLSearchParams(location.search).get('login')==='cancelled'?'Вход отменён. Можно попробовать снова.':c.oidc?'Войдите через Telegram, чтобы открыть свои данные.':c.mini?'Для входа откройте Mini App в Telegram.':'Вход через Telegram пока не настроен. Личные данные недоступны.');
    })().catch(e=>setProblem(explain(e))).finally(()=>setLoading(false));
  },[load]);
  useEffect(()=>{
    const guard=(e:BeforeUnloadEvent)=>{if (pending) e.preventDefault();};
    window.addEventListener('beforeunload',guard);return ()=>window.removeEventListener('beforeunload',guard);
  },[pending]);
  function remember(command?:Command) {
    setPending(command);
    if (storageKey) try {if (command) sessionStorage.setItem(storageKey,JSON.stringify(command));else sessionStorage.removeItem(storageKey);} catch { /* Memory still retains the exact retry. */ }
  }
  async function send(action:Record<string,unknown>, retry?:Command) {
    if (!session || !state || lock.current || (pending&&!retry)) return false;
    const command=retry??{key:crypto.randomUUID(),revision:state.revision,experiment:state.experiment,action};
    lock.current=true;setBusy(true);setProblem('');setMessage('Сохраняем…');remember(command);
    let committed=false;
    try {
      await api('/api/commands',post(command,session.csrf));
      committed=true;
      // A replay may describe an older revision. Read current committed data.
      remember();setMessage('Изменения сохранены. Загружаем данные…');
      await load();setMessage('Все изменения сохранены');return true;
    } catch(e) {
      if (committed) {setConflict(true);setMessage('Изменения сохранены');setProblem('Не удалось загрузить обновлённый набор. Загрузите сохранённые данные перед следующим действием.');return true;}
      if (e instanceof ApiError && e.status===401) {setSession(undefined);setState(undefined);setMessage(explain(e));setProblem('После входа можно безопасно подтвердить прежнюю команду.');return false;}
      if (e instanceof ApiError && e.status<500) {
        remember();setMessage('Изменения не сохранены');
        if (e.status===409 || e.status===410) {setConflict(true);setProblem(e.status===410?explain(e):'Данные изменились в другом окне. Загрузите сохранённую версию, затем повторите действие.');}
        else setProblem(explain(e));
      } else {setMessage('Результат записи не подтверждён');setProblem('Ответ не получен. Команда могла сохраниться. Повтор использует тот же ключ и не удвоит действие.');}
      return false;
    } finally {lock.current=false;setBusy(false);}
  }
  async function refresh() {
    if (busy) return;
    setBusy(true);setProblem('');
    try {await load();setConflict(false);setMessage(pending?'Данные загружены; результат команды ещё нужно подтвердить повтором.':'Сохранённые данные загружены');}
    catch(e) {setProblem(explain(e));} finally {setBusy(false);}
  }
  async function nextPage() {
    if (!state || busy) return;setBusy(true);
    try {
      const items=pages[scope], p=await api<Page>('/api/inventory?scope='+scope+'&limit=100&after='+encodeURIComponent(items.at(-1)?.id??''));
      if (p.revision!==state.revision) {setConflict(true);throw new Error('REVISION_CONFLICT');}
      setPages(prev=>({...prev,[scope]:[...prev[scope],...p.items]}));setMore(prev=>({...prev,[scope]:p.items.length===100}));
    } catch(e) {setProblem(e instanceof Error&&e.message==='REVISION_CONFLICT'?'Набор изменился. Загрузите сохранённые данные.':explain(e));} finally {setBusy(false);}
  }
  function beginEdit(g:Group|null) {setEdit(g);setKind(g?.kind??'🅾');setTier(g?.tier??1);setValue(g?.value??'10');setQuantity(g?.quantity??'1');setProblem('');}
  function changeType(k:Kind,t:number) {setKind(k);setTier(t);if (t===1 && k!=='💚') setValue(k==='🅾'?'10':'8');}
  function choose(g:Group,worn:boolean) {
    try {
      const existing=selection.find(s=>s.id===g.id), n=BigInt(existing?.quantity??'0'), w=BigInt(existing?.worn??'0');
      const equipped=BigInt(state?.equipment.find(e=>e.id===g.id)?.quantity??'0');
      if (selection.reduce((n,s)=>n+BigInt(s.quantity),0n)>=3n) throw new Error('SELECT_THREE');
      if (worn?w>=equipped:n-w>=BigInt(g.quantity)-equipped) throw new Error('INSUFFICIENT_MODS');
      setSelection([...selection.filter(s=>s.id!==g.id),{id:g.id,quantity:(n+1n).toString(),worn:(w+(worn?1n:0n)).toString()}]);setProblem('');
    } catch(e) {setProblem(explain(e));}
  }
  const byId=new Map([...pages.work,...state?.equippedMods??[]].map(g=>[g.id,g]));
  let preview:ReturnType<typeof craft>|undefined;
  try {preview=craft(selection.flatMap(s=>Array.from({length:Number(s.quantity)},()=>byId.get(s.id)!)));} catch { /* Incomplete selections have no preview. */ }
  const disabled=busy||!!pending||conflict;
  if (!session || !state) return <main className="login"><p className="eyebrow">CHEAPSHOT MODS</p><h1>Ваш инвентарь.<br/>Ваш эксперимент.</h1><p className="mods" aria-hidden="true">🅾 💢 💚 🧿</p><p role="status">{loading?'Проверяем вход…':message}</p>{problem&&<p role="alert">{problem}</p>}{!loading&&config?.oidc&&<a className="button" href="/auth/oidc/start">Войти через Telegram</a>}{!loading&&config?.mini&&webApp()?.initData&&<button onClick={()=>{location.href='/';}}>Войти в Mini App</button>}{!loading&&<button className="secondary" onClick={()=>location.reload()}>Повторить подключение</button>}<p className="note">Внесите моды, примерьте экипировку и рассчитайте крафт. Личная работа сохраняется после входа.</p></main>;
  return <main>
    <header><div><p className="eyebrow">CHEAPSHOT MODS</p><h1>Мастерская модов</h1></div><button className="secondary" disabled={busy||!!pending} onClick={()=>void(async()=>{try {await api('/auth/logout',post({},session.csrf));if(storageKey)sessionStorage.removeItem(storageKey);location.href='/?logged_out=1';}catch(e){setProblem(explain(e));}})()}>Выйти</button></header>
    <div className="save" role="status">{message}</div>
    {problem&&<div className="notice" role="alert">{problem}</div>}
    {pending&&<button disabled={busy} onClick={()=>void send(pending.action,pending)}>Повторить ту же команду</button>}
    {(conflict||!pending)&&<button className="text-button" disabled={busy} onClick={()=>void refresh()}>Загрузить сохранённые данные</button>}
    <section className="panel" aria-label="Персонаж">
      <form className="level-form" onSubmit={e=>{e.preventDefault();try{inputInteger(level);void send({type:'level',value:level});}catch(e){setProblem(explain(e));}}}>
        <NumberField label="Уровень игрока" value={level} onChange={setLevel}/><button disabled={disabled||level===state.level}>Сохранить уровень</button>
      </form>
      <div className="stats"><div><span>Урон</span><strong className="exact" data-testid="damage">{state.stats.damage}</strong></div><div><span>Здоровье</span><strong className="exact" data-testid="health">{state.stats.health}</strong></div></div>
      <p>Надето <strong data-testid="equipped-count">{total(state.equipment)} / 100</strong> · Расход <strong className="exact" data-testid="spent">{state.spent}</strong> 💎</p>
      <details><summary>Как считаются характеристики</summary><p>+p превращается в +p% от уровня игрока. Проценты складываются; итог округляется вверх один раз. Базовые урон и здоровье равны уровню.</p></details>
    </section>
    <nav className="tabs" aria-label="Наборы"><button aria-pressed={scope==='work'} onClick={()=>setScope('work')}>Эксперимент</button><button aria-pressed={scope==='original'} onClick={()=>setScope('original')}>Исходный набор</button></nav>
    {scope==='original'?<section aria-label="Исходный инвентарь">
      <h2>Исходный инвентарь</h2><p className="note">{state.started?'Правки сохраняются отдельно. Примените их к эксперименту через сброс.':'До первой примерки или крафта правки обновляют рабочую копию.'} Количество модов в инвентаре не ограничено сотней.</p>
      <button disabled={disabled} onClick={()=>beginEdit(null)}>Добавить моды</button>
      {edit!==undefined&&<form className="panel" aria-label="Редактор модов" onSubmit={e=>{e.preventDefault();try {inputInteger(value);inputInteger(quantity);mod({kind,tier,value});void send({type:'original.put',...(edit?{id:edit.id}:{}),kind,tier,value,quantity}).then(ok=>{if(ok)setEdit(undefined);});}catch(e){setProblem(explain(e));}}}>
        <h3>{edit?'Правка группы':'Новая группа'}</h3>
        <div className="fields"><label>Тип мода<select value={kind} onChange={e=>changeType(e.target.value as Kind,tier)}>{kinds.map(k=><option key={k}>{k}</option>)}</select></label><label>Уровень мода<select value={tier} onChange={e=>changeType(kind,Number(e.target.value))}>{[1,2,3,4,5,6].map(t=><option key={t} value={t}>{t}.0</option>)}</select></label></div>
        {tier===1&&kind!=='💚'?<label>Параметр мода<select value={value} onChange={e=>setValue(e.target.value)}>{(kind==='🅾'?['10','11','12']:['8']).map(v=><option key={v}>{v}</option>)}</select></label>:<NumberField label="Параметр мода" value={value} onChange={setValue}/>}
        <NumberField label="Количество модов" value={quantity} onChange={setQuantity}/><p className="note">Числовой параметр +{value||'p'} станет +{value||'p'}%. Все числа сохраняются точно.</p>
        <div className="actions"><button disabled={disabled}>Сохранить группу</button><button type="button" className="secondary" onClick={()=>setEdit(undefined)}>Закрыть редактор</button></div>
      </form>}
      {pages.original.map(g=><article className="mod-card" key={g.id} data-testid="original-group"><ModText g={g}/><p>Количество: <strong className="exact">{g.quantity}</strong></p><div className="actions"><button className="secondary" disabled={disabled} onClick={()=>beginEdit(g)}>Изменить</button><button className="danger" disabled={disabled} onClick={()=>{if(window.confirm('Удалить эту группу из исходного набора? Начатый эксперимент сохранится.'))void send({type:'original.delete',id:g.id});}}>Удалить</button></div></article>)}
    </section>:<section aria-label="Текущий эксперимент">
      <h2>Текущий эксперимент</h2><p className="note">Крафт и примерка меняют рабочую копию. Исходные моды сохраняются.</p>
      <div className="panel" aria-label="Крафт"><h3>Крафт · {total(selection)} из 3</h3>
        {selection.length===0?<p className="note">Выберите три экземпляра одного типа и уровня. Для надетых используйте «В крафт с персонажа».</p>:selection.map(s=><p key={s.id}><ModText g={byId.get(s.id)!}/> × {s.quantity}, из надетых: {s.worn}</p>)}
        {preview?<div data-testid="craft-preview"><p>Результат: <ModText g={preview.result}/></p><p>Цена операции: <strong>{preview.price}</strong> 💎</p></div>:selection.length>0&&<p>Нужны три мода одного типа и уровня 1.0–5.0.</p>}
        <div className="actions"><button disabled={disabled||!preview} onClick={()=>void send({type:'craft',items:selection})}>Применить крафт</button><button className="secondary" disabled={busy||selection.length===0} onClick={()=>setSelection([])}>Очистить выбор</button></div>
      </div>
      <div className="actions"><button className="secondary" disabled={disabled||!state.lastCraft} onClick={()=>void send({type:'undo'})}>Отменить последний крафт{state.lastCraft?' · '+state.lastCraft.price+' 💎':''}</button><button className="danger" disabled={disabled} onClick={()=>setResetOpen(true)}>Сбросить эксперимент</button></div>
      {resetOpen&&<div className="notice" role="dialog" aria-label="Подтверждение сброса"><p>Заменить рабочий набор актуальным исходным? Экипировка, история крафтов и расход обнулятся. Уровень игрока сохранится.</p><div className="actions"><button disabled={disabled} onClick={()=>void send({type:'reset'}).then(ok=>{if(ok)setResetOpen(false);})}>Подтвердить сброс</button><button className="secondary" onClick={()=>setResetOpen(false)}>Не сбрасывать</button></div></div>}
      {state.equippedMods.length>0&&<details className="panel"><summary>Вся экипировка · {total(state.equipment)} / 100</summary>{state.equippedMods.map(g=><div className="equipped" key={g.id}><p><ModText g={g}/> × {g.quantity}</p><button className="secondary" disabled={disabled} onClick={()=>{setEquipGroup(pages.work.find(x=>x.id===g.id)??g);setEquipCount('0');}}>Снять / изменить</button></div>)}<button disabled={disabled} className="secondary" onClick={()=>void send({type:'equip',items:[]})}>Снять все моды</button></details>}
      {equipGroup&&<form className="panel" aria-label="Экипировка группы" onSubmit={e=>{e.preventDefault();try {inputInteger(equipCount,true);const items=state.equipment.filter(x=>x.id!==equipGroup.id);if(BigInt(equipCount)>0n)items.push({id:equipGroup.id,quantity:equipCount});void send({type:'equip',items}).then(ok=>{if(ok)setEquipGroup(undefined);});}catch(e){setProblem(explain(e));}}}><h3>Экипировка группы</h3><ModText g={equipGroup}/><NumberField label="Надеть экземпляров (0 — снять)" value={equipCount} onChange={setEquipCount} zero/><div className="actions"><button disabled={disabled}>Применить экипировку</button><button className="secondary" type="button" onClick={()=>setEquipGroup(undefined)}>Закрыть примерку</button></div></form>}
      {pages.work.map(g=>{const worn=state.equipment.find(e=>e.id===g.id)?.quantity??'0';return <article className="mod-card" key={g.id} data-testid="work-group"><ModText g={g}/><p>В наборе: <strong className="exact">{g.quantity}</strong> · Надето: <strong>{worn}</strong></p><div className="actions"><button className="secondary" disabled={disabled} onClick={()=>{setEquipGroup(g);setEquipCount(worn==='0'?'1':worn);}}>Примерить / снять</button><button className="secondary" disabled={disabled||g.tier===6||BigInt(g.quantity)<=BigInt(worn)} onClick={()=>choose(g,false)}>В крафт</button>{worn!=='0'&&<button className="secondary" disabled={disabled||g.tier===6} onClick={()=>choose(g,true)}>В крафт с персонажа</button>}</div></article>;})}
    </section>}
    {pages[scope].length===0&&<p className="empty">Модов пока нет. {scope==='original'?'Добавьте первую группу.':'Внесите исходные моды; для начатого эксперимента примените сброс.'}</p>}
    {more[scope]&&<button className="secondary wide" disabled={busy} onClick={()=>void nextPage()}>Загрузить ещё группы</button>}
    <footer>Один игрок · один сохранённый эксперимент. Алмазы здесь только расчётные.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
