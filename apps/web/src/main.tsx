import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {craft, displayKind, formatCrit, hasCrit, inputInteger, kinds, mod, parseCrit, type FusePlan, type FuseRequest, type Equipped, type Group, type Kind, type Selection} from '@chm/rules';
import type {Store} from '../../server/src/store.js';
import {Brand,Icon,Modal,ModCardTitle,ModIcon} from './presentation.js';
import {BatchFuse} from './batch.js';
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
  POOL_INTEGER_TOO_LONG:'Для количества из существующего запаса допускается до 256 цифр — технический размер поля.',
  CRIT_TOO_LONG:'Крит допускает до 128 целых и трёх дробных знаков — технический размер ввода.',
  FUSE_POOL_TOO_LARGE:'В одном пакете допускается до 1000 выбранных групп. Разделите пул на несколько пакетов.',
  INVALID_SELECTION:'Проверьте выбранные группы, количества и разрешённую надетую часть.',
  INVALID_TARGET:'Целевая ступень пакета должна быть от 2.0 до 6.0.',
  CRIT_REQUIRED:'Для нового мода укажите крит, включая явный ноль.',
  INVALID_CRIT:'Крит: неотрицательное десятичное число с точкой или запятой, без степени и пробелов.',
  FUSE_PLAN_TOO_COMPLEX:'План содержит слишком много разных переходов. Разделите пул на несколько пакетов.',
  INVALID_MOD:'Проверьте тип, уровень и параметр мода.',
  EQUIPMENT_LIMIT:'Можно надеть не больше 100 модов суммарно.',
  INSUFFICIENT_MODS:'В рабочем наборе недостаточно выбранных экземпляров.',
  INCOMPATIBLE_MODS:'Для крафта нужны три мода одного типа и уровня от 1.0 до 5.0.',
  SELECT_THREE:'Выберите ровно три экземпляра для крафта.',
  LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подождите минуту.',
  SERVER_ERROR:'Ошибка сервера. Изменения не подтверждены. Повторите ту же команду.',
  COMMAND_EXPIRED:'Срок хранения ответа команды истёк. Повторного применения не было; загрузите актуальные данные.',
  UNAUTHORIZED:'Сессия завершилась. Войдите через Telegram заново.',
  SESSION_CHANGED:'Учётная запись изменилась в другом окне. Войдите заново в этом окне.',
  EXPIRED_INIT_DATA:'Данные входа Telegram устарели. Закройте Mini App и откройте его заново.',
  INVALID_INIT_DATA:'Telegram не подтвердил вход. Откройте Mini App заново.',
};
function explain(error:unknown) {return error instanceof Error ? explanations[error.message]??'Не удалось выполнить действие. Проверьте данные и соединение.' : 'Не удалось выполнить действие.';}
async function api<T>(url:string, options:RequestInit = {}):Promise<T> {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  if (!response.ok) {const body=await response.json().catch(()=>({}));throw new ApiError(response.status,body.error??'SERVER_ERROR');}
  return await response.json() as T;
}
const accountHeaders=(account:string)=>({'x-chm-account':account});
const post=(body:unknown,csrf?:string,account?:string):RequestInit=>({method:'POST',headers:{'content-type':'application/json',...(csrf?{'x-csrf-token':csrf}:{}),...(account?accountHeaders(account):{})},body:JSON.stringify(body)});
function total(items:Equipped[]) {return items.reduce((n,e)=>n+BigInt(e.quantity),0n).toString();}
function NumberField({label,value,onChange,zero=false}:{label:string;value:string;onChange:(v:string)=>void;zero?:boolean}) {
  return <div className="number-field"><label>{label}<input aria-label={label} inputMode="numeric" pattern={zero?'[0-9]+':'[1-9][0-9]*'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="off" spellCheck={false} required /></label>{value.length>20&&<p className="full-number"><span>Полное значение · {label}</span><span className="exact">{value}</span></p>}</div>;
}
function ModText({g}:{g:Pick<Group,'kind'|'tier'|'value'|'crit'>}) {
  return <span className="mod-text">{displayKind(g.kind)} <strong>{g.tier}.0</strong> · <span className="exact">+{g.value}%</span>{hasCrit(g.kind)&&<span> · Крит: {formatCrit(g.crit)}</span>}</span>;
}

function App() {
  const [config,setConfig]=useState<{oidc:boolean;mini:boolean}>();
  const [session,setSession]=useState<Session>();
  const [state,setState]=useState<State>();
  const [scope,setScope]=useState<Scope>('work');
  const [workView,setWorkView]=useState<'equip'|'craft'>('equip');
  const [filter,setFilter]=useState<Kind|'all'>('all'), [helpOpen,setHelpOpen]=useState(false);
  const [pages,setPages]=useState<Record<Scope,Group[]>>({original:[],work:[]});
  const [more,setMore]=useState<Record<Scope,boolean>>({original:false,work:false});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [message,setMessage]=useState('Подключаемся…');
  const [problem,setProblem]=useState(''), [conflict,setConflict]=useState(false), [pending,setPending]=useState<Command>();
  const [selection,setSelection]=useState<Selection[]>([]), [resetOpen,setResetOpen]=useState(false);
  const [edit,setEdit]=useState<Group|null|undefined>(), [level,setLevel]=useState('1');
  const [kind,setKind]=useState<Kind>('🅾'), [tier,setTier]=useState(1), [value,setValue]=useState('10'), [quantity,setQuantity]=useState('1');
  const [equipGroup,setEquipGroup]=useState<Group>(), [equipCount,setEquipCount]=useState('1');
  const [crit,setCrit]=useState(''),[refine,setRefine]=useState<{g:Group;scope:Scope}>(),[refineCount,setRefineCount]=useState('1'),[refineWorn,setRefineWorn]=useState('0'),[refineCrit,setRefineCrit]=useState('');
  const lock=useRef(false);
  const storageKey=session?'chm_pending_'+session.account:undefined;
  const webApp=()=> (window as Window & {Telegram?:{WebApp?:WebApp}}).Telegram?.WebApp;
  const load=useCallback(async(credentials:Session)=>{
    const options={headers:accountHeaders(credentials.account)},current=await api<State>('/api/state',options);
    const [original,work]=await Promise.all([api<Page>('/api/inventory?scope=original&limit=100',options),api<Page>('/api/inventory?scope=work&limit=100',options)]);
    if (original.revision!==current.revision || work.revision!==current.revision) throw new ApiError(409,'REVISION_CONFLICT');
    setState(current);setLevel(current.level);setPages({original:original.items,work:work.items});
    setMore({original:original.items.length===100,work:work.items.length===100});setSelection([]);
  },[]);
  useEffect(()=>{
    void(async()=>{
      webApp()?.ready?.(); webApp()?.expand?.();
      const c=await api<{oidc:boolean;mini:boolean}>('/api/config');setConfig(c);
      let s:Session|undefined;
      const initData=webApp()?.initData,loggedOut=new URLSearchParams(location.search).has('logged_out');
      if (!loggedOut) {
        // A valid cookie may belong to another Telegram account in a shared
        // WebView cookie jar. Bind the signed Mini context BEFORE any data.
        if (initData && c.mini) await api('/auth/mini',post({initData}));
        try {s=await api<Session>('/api/session');} catch(e) {if (!(e instanceof ApiError && e.status===401)) throw e;}
      }
      if (s) {
        setSession(s);await load(s);setMessage('Все изменения сохранены');
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
  function readError(error:unknown) {
    if (error instanceof ApiError && error.status===401) {setSession(undefined);setState(undefined);setMessage(explain(error));setProblem('Войдите, чтобы загрузить сохранённые данные.');}
    else setProblem(explain(error));
  }
  async function send(action:Record<string,unknown>, retry?:Command) {
    if (!session || !state || lock.current || (pending&&!retry)) return false;
    const command=retry??{key:crypto.randomUUID(),revision:state.revision,experiment:state.experiment,action};
    lock.current=true;setBusy(true);setProblem('');setMessage('Сохраняем…');remember(command);
    let committed=false;
    try {
      // Another tab may rotate the cookie for the same account; refresh CSRF
      // while the account precondition prevents adopting a different owner.
      const credentials=await api<Session>('/api/session',{headers:accountHeaders(session.account)});setSession(credentials);
      await api('/api/commands',post(command,credentials.csrf,session.account));
      committed=true;
      // A replay may describe an older revision. Read current committed data.
      remember();setMessage('Изменения сохранены. Загружаем данные…');
      await load(session);setMessage('Все изменения сохранены');return true;
    } catch(e) {
      if (committed) {setConflict(true);setMessage('Изменения сохранены');if(e instanceof ApiError&&e.status===401)readError(e);else setProblem('Не удалось загрузить обновлённый набор. Загрузите сохранённые данные перед следующим действием.');return true;}
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
    if (busy||!session) return;
    setBusy(true);setProblem('');
    try {await load(session);setConflict(false);setMessage(pending?'Данные загружены; результат команды ещё нужно подтвердить повтором.':'Сохранённые данные загружены');}
    catch(e) {readError(e);} finally {setBusy(false);}
  }
  async function nextPage() {
    if (!state || !session || busy) return;setBusy(true);
    try {
      const items=pages[scope], p=await api<Page>('/api/inventory?scope='+scope+'&limit=100&after='+encodeURIComponent(items.at(-1)?.id??''),{headers:accountHeaders(session.account)});
      if (p.revision!==state.revision) {setConflict(true);throw new Error('REVISION_CONFLICT');}
      setPages(prev=>({...prev,[scope]:[...prev[scope],...p.items]}));setMore(prev=>({...prev,[scope]:p.items.length===100}));
    } catch(e) {if(e instanceof Error&&e.message==='REVISION_CONFLICT')setProblem('Набор изменился. Загрузите сохранённые данные.');else readError(e);} finally {setBusy(false);}
  }
  async function batchPreview(fuse:FuseRequest):Promise<FusePlan> {
    if(!session||!state||lock.current||pending||conflict)throw new Error('REVISION_CONFLICT');
    lock.current=true;setBusy(true);setProblem('');
    try {const credentials=await api<Session>('/api/session',{headers:accountHeaders(session.account)});setSession(credentials);
      return await api<FusePlan>('/api/fuse-preview',post({revision:state.revision,experiment:state.experiment,fuse},credentials.csrf,session.account));
    }catch(e){if(e instanceof ApiError&&e.status===409)setConflict(true);throw e;}
    finally {lock.current=false;setBusy(false);}
  }
  function beginRefine(g:Group,scope:Scope){setRefine({g,scope});setRefineCount(g.quantity);setRefineWorn(scope==='work'?(state?.equipment.find(e=>e.id===g.id)?.quantity??'0'):'0');setRefineCrit('');setProblem('');}
  function beginEdit(g:Group|null) {setEdit(g);setKind(g?.kind??'🅾');setTier(g?.tier??1);setValue(g?.value??'10');setQuantity(g?.quantity??'1');setCrit(g?.crit==null?'':formatCrit(g.crit));setProblem('');}
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
  const view=scope==='original'?'inventory':workView;
  const navigate=(target:'inventory'|'equip'|'craft')=>{setScope(target==='inventory'?'original':'work');if(target!=='inventory')setWorkView(target);if(target==='craft')requestAnimationFrame(()=>{const panel=document.getElementById('craft-panel');panel?.scrollIntoView({block:'start'});panel?.focus({preventScroll:true});});};
  const visibleGroups=pages[scope].filter(g=>filter==='all'||g.kind===filter);
  const selectedSlots=selection.flatMap(s=>Array.from({length:Number(s.quantity)},(_,i)=>({group:byId.get(s.id)!,worn:BigInt(i)<BigInt(s.worn)})));
  const modalFeedback=()=> <div className="modal-feedback"><p className="save" role="status">{message}</p>{problem&&<p className="notice" role="alert">{problem}</p>}{pending&&<button disabled={busy} onClick={()=>void send(pending.action,pending)}>Повторить ту же команду</button>}{conflict&&<button className="secondary" disabled={busy} onClick={()=>void refresh()}>Загрузить сохранённые данные</button>}</div>;
  if (!session || !state) return <main className="login"><Brand/><div className="login-card"><p className="eyebrow">ЛАБОРАТОРИЯ БИЛДОВ</p><h1>Ваш инвентарь.<br/><span>Ваш эксперимент.</span></h1><div className="login-mods" aria-hidden="true">{kinds.map(kind=><ModIcon key={kind} kind={kind}/>)}</div><p role="status" className="save">{loading?'Проверяем вход…':message}</p>{problem&&<p role="alert" className="notice">{problem}</p>}{!loading&&config?.oidc&&<a className="button" href="/auth/oidc/start">Войти через Telegram<Icon name="arrow"/></a>}{!loading&&config?.mini&&webApp()?.initData&&<button onClick={()=>{location.href='/';}}>Войти в Mini App</button>}{!loading&&<button className="secondary" onClick={()=>location.reload()}>Повторить подключение</button>}<p className="note">Внесите моды, примерьте экипировку и рассчитайте крафт. Личная работа сохраняется после входа.</p></div></main>;
  return <>
    <div className="app-shell" id="app-shell">
      <aside className="sidebar"><Brand/><p className="side-section">ЛАБОРАТОРИЯ БИЛДОВ</p><nav aria-label="Лаборатория"><button className={view==='inventory'?'nav-item active':'nav-item'} aria-pressed={view==='inventory'} onClick={()=>navigate('inventory')}><Icon name="box"/>Мой инвентарь</button><button className={view==='equip'?'nav-item active':'nav-item'} aria-pressed={view==='equip'} onClick={()=>navigate('equip')}><Icon name="shield"/>Примерка</button><button className={view==='craft'?'nav-item active':'nav-item'} aria-pressed={view==='craft'} onClick={()=>navigate('craft')}><Icon name="flask"/>Крафт модов</button></nav><button className="rules-link" onClick={()=>setHelpOpen(true)}><Icon name="help"/>Как это работает</button><div className="sidebar-bottom"><div className="new-system"><span className="status-dot"/>НОВАЯ СИСТЕМА МОДОВ<p>Все бонусы — в процентах от уровня персонажа.</p></div><div className="profile"><span className="avatar"><Icon name="shield"/></span><span>Личный эксперимент<small>Ваши моды. Ваш следующий билд.</small></span></div></div></aside>
      <main className="main">
        <header className="topbar"><span className="breadcrumb">Лаборатория <span>/</span> Калькулятор модов</span><div className="mobile-brand"><Icon name="bolt"/>CHEAPSHOT <span>MODS</span></div><div className={'save-state '+(problem?'has-error':'')}><span className="status-dot"/><span role="status">{message}</span></div><button className="secondary logout" disabled={busy||!!pending} onClick={()=>void(async()=>{try {const current=await api<Session>('/api/session',{headers:accountHeaders(session.account)});await api('/auth/logout',post({},current.csrf,session.account));if(storageKey)sessionStorage.removeItem(storageKey);location.href='/?logged_out=1';}catch(e){if(e instanceof ApiError&&e.status===401){if(storageKey)sessionStorage.removeItem(storageKey);location.href='/?logged_out=1';}else setProblem(explain(e));}})()}>Выйти</button></header>
        <div className="workspace">
          <div className="page-heading"><div><p className="eyebrow"><span/>ПЛАНИРУЙ. ПРИМЕРЯЙ. УСИЛИВАЙ.</p><h1>Мастерская <span>модов</span></h1><p className="note">Ваш инвентарь. Ваш следующий билд.</p></div><button className="add-main" disabled={disabled} onClick={()=>{setScope('original');beginEdit(null);}}><Icon name="plus"/>Добавить моды</button></div>
          {problem&&<div className="notice" role="alert">{problem}</div>}
          <div className="sync-actions">{pending&&<button disabled={busy} onClick={()=>void send(pending.action,pending)}>Повторить ту же команду</button>}{(conflict||!pending)&&<button className="text-button" disabled={busy} onClick={()=>void refresh()}>Загрузить сохранённые данные</button>}</div>
          <div className="dashboard">
            <div className="inventory-column">
              <section className="section-card inventory-section" aria-label={scope==='original'?'Исходный инвентарь':'Текущий эксперимент'}>
                <nav className="tabs" aria-label="Наборы"><button aria-pressed={scope==='original'} onClick={()=>navigate('inventory')}><Icon name="box"/>Исходный набор</button><button aria-pressed={view==='equip'} onClick={()=>navigate('equip')}><Icon name="shield"/>Эксперимент</button><button aria-pressed={view==='craft'} onClick={()=>navigate('craft')}><Icon name="flask"/>Крафт</button></nav>
                <div className="inventory-intro"><div><h2>{scope==='original'?'Исходный инвентарь':'Текущий эксперимент'}</h2><p className="note">{scope==='original'?(state.started?'Новые группы и положительное пополнение с теми же параметрами сразу добавляются в эксперимент. Другие правки применяются через сброс.':'До первой примерки или крафта правки обновляют рабочую копию.'):'Крафт и примерка меняют рабочую копию. Исходные моды сохраняются.'}</p></div><span className="outline-badge">Загружено групп: {pages[scope].length}</span></div>
                <div className="filters" role="group" aria-label="Типы загруженных модов"><button className={filter==='all'?'filter active':'filter'} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>Все моды</button>{kinds.map(k=><button key={k} className={filter===k?'filter active':'filter'} aria-label={displayKind(k)+' '+(k==='💚'?'Здоровье':'Урон')} aria-pressed={filter===k} onClick={()=>setFilter(k)}>{displayKind(k)}<span>{k==='💚'?'Здоровье':'Урон'}</span></button>)}</div>
                <p className="filter-help">Фильтр по загруженным группам{scope==='original'?' · Количество модов не ограничено сотней.':''}</p>
                <div className="mod-list">
                  {visibleGroups.map(g=>scope==='original'?<article className="mod-card original-card" key={g.id} data-testid="original-group"><ModCardTitle g={g}/><p className="mod-quantity">Количество: <strong className="exact">{g.quantity}</strong></p><div className="row-actions">{hasCrit(g.kind)&&g.crit==null&&<button className="secondary" disabled={disabled} onClick={()=>beginRefine(g,'original')}>Уточнить крит</button>}<button className="icon-button" aria-label="Изменить" title="Изменить" disabled={disabled} onClick={()=>beginEdit(g)}><Icon name="edit"/></button><button className="icon-button danger" aria-label="Удалить" title="Удалить" disabled={disabled} onClick={()=>{if(window.confirm('Удалить эту группу из исходного набора? Начатый эксперимент сохранится.'))void send({type:'original.delete',id:g.id});}}><Icon name="trash"/></button></div></article>:(()=>{const worn=state.equipment.find(e=>e.id===g.id)?.quantity??'0';return <article className={'mod-card work-card '+(worn!=='0'?'mod-equipped':'')} key={g.id} data-testid="work-group"><ModCardTitle g={g}/><p className="mod-quantity">В наборе: <strong className="exact">{g.quantity}</strong> · Надето: <strong>{worn}</strong></p><div className="row-actions">{hasCrit(g.kind)&&g.crit==null&&<button className="secondary" disabled={disabled} onClick={()=>beginRefine(g,'work')}>Уточнить крит</button>}<button className="secondary" disabled={disabled} onClick={()=>{setEquipGroup(g);setEquipCount(worn==='0'?'1':worn);}}>Примерить / снять</button><button className="secondary" disabled={disabled||g.tier===6||BigInt(g.quantity)<=BigInt(worn)} onClick={()=>{choose(g,false);setWorkView('craft');}}>В крафт</button>{worn!=='0'&&<button className="secondary worn-action" disabled={disabled||g.tier===6} onClick={()=>{choose(g,true);setWorkView('craft');}}>В крафт с персонажа</button>}</div></article>;})())}
                  {pages[scope].length===0&&<div className="empty-state"><span className="empty-icon"><Icon name="box"/></span><h3>Модов пока нет</h3><p>{scope==='original'?'Добавьте первую группу. Количество модов в исходном наборе не ограничено.':'Добавьте исходные моды — они пополнят эксперимент.'}</p><button onClick={()=>{setScope('original');if(scope==='original')beginEdit(null);}}>{scope==='original'?'Добавить первую группу':'Перейти в исходный набор'}</button></div>}
                  {pages[scope].length>0&&visibleGroups.length===0&&<p className="empty">Среди загруженных групп такого типа нет. Выберите «Все моды» или загрузите следующую страницу.</p>}
                </div>
                <div className="inventory-bottom"><span><Icon name="shield"/>{scope==='original'?'Исходные моды сохраняются отдельно.':'Один игрок · один эксперимент.'}</span>{more[scope]&&<button className="secondary" disabled={busy} onClick={()=>void nextPage()}>Загрузить ещё группы</button>}</div>
              </section>
              {scope==='work'&&<section className="section-card fusion" id="craft-panel" tabIndex={-1} aria-label="Крафт" data-testid={preview?'craft-preview':undefined}>
                <div className="fusion-title"><div><p className="eyebrow">МАСТЕРСКАЯ</p><h2>Крафт · {total(selection)} из 3</h2></div><span className="outline-badge">Три в один</span></div>
                <div className="fusion-flow"><div className="fusion-inputs">{[0,1,2].map(i=>{const slot=selectedSlots[i];return <div className={'fusion-slot '+(slot?'filled':'')} key={i} role="group" aria-label={'Вход крафта '+(i+1)}>{slot?<><span aria-hidden="true">{displayKind(slot.group.kind)}</span><strong className="exact">+{slot.group.value}%</strong><small>{slot.group.tier}.0 · {slot.worn?'С персонажа':'Из набора'}</small>{hasCrit(slot.group.kind)&&<small>Крит: {formatCrit(slot.group.crit)}</small>}</>:<><Icon name="plus"/><small>Мод {i+1}</small></>}</div>;})}</div><span className="flow-arrow"><Icon name="arrow"/></span><div className={'fusion-output '+(preview?'ready':'')} role="group" aria-label="Результат крафта">{preview?<><span aria-hidden="true">{displayKind(preview.result.kind)}</span><strong className="exact">+{preview.result.value}%</strong><small>Уровень {preview.result.tier}.0</small>{hasCrit(preview.result.kind)&&<small>Крит: {formatCrit(preview.result.crit)}</small>}<span className="sr-only">Результат: <ModText g={preview.result}/></span></>:<><Icon name="flask"/><span>Результат</span><small>Выберите три мода</small></>}</div></div>
                <p className="note">{selection.length===0?'Выберите три экземпляра одного типа и уровня. Для надетых используйте «В крафт с персонажа».':!preview?'Нужны три мода одного типа и уровня 1.0–5.0.':'Три выбранных экземпляра будут заменены одним результатом.'}</p>
                <div className="fusion-footer"><div className="operation-price">Цена операции: <strong><Icon name="diamond"/>{preview?.price??'—'} 💎</strong></div><button disabled={disabled||!preview} onClick={()=>void send({type:'craft',items:selection})}><Icon name="flask"/>Применить крафт</button></div>
                <div className="actions craft-actions"><button className="secondary" disabled={busy||selection.length===0} onClick={()=>setSelection([])}>Очистить выбор</button><button className="secondary" disabled={disabled||!state.lastCraft} onClick={()=>void send({type:'undo'})}><Icon name="undo"/>Отменить последний крафт{state.lastCraft?' · '+state.lastCraft.price+' 💎':''}</button></div>
                {state.lastCraft&&<p className="last-craft">Последний {state.lastCraft.type==='batch'?'пакет':'результат'}: {(state.lastCraft.outputs??[state.lastCraft.output]).map((g,i)=><span key={i}><ModText g={g}/> × {g.quantity}{' '}</span>)}</p>}
              </section>}
              {scope==='work'&&<BatchFuse groups={pages.work} equipment={state.equipment} revision={state.revision} disabled={disabled} onPreview={batchPreview} onCommit={fuse=>send({type:'fuse',fuse})} onError={e=>setProblem(explain(e))}/>}
              <div className="bottom-explainer"><span><Icon name="shield"/>Исходный инвентарь всегда остаётся вашим.</span><button className="text-button" onClick={()=>setHelpOpen(true)}>Правила расчёта<Icon name="arrow"/></button></div>
            </div>
            <aside className="build-column" aria-label="Параметры эксперимента">
              <section className="build-card" aria-label="Персонаж"><div className="build-heading"><p className="eyebrow">ВАШ ПЕРСОНАЖ</p><span className="live-label"><span/>РАСЧЁТ</span></div>
                <form className="level-form" onSubmit={e=>{e.preventDefault();try{inputInteger(level);void send({type:'level',value:level});}catch(e){setProblem(explain(e));}}}><NumberField label="Уровень игрока" value={level} onChange={setLevel}/><button className="icon-button" aria-label="Сохранить уровень" title="Сохранить уровень" disabled={disabled||level===state.level}><Icon name="check"/></button></form>
                <div className="character-stats"><div className="stat-block damage"><span className="stat-label"><Icon name="swords"/>Урон</span><strong className="stat-value exact" data-testid="damage">{state.stats.damage}</strong><p className="stat-detail exact">Базовый урон: {state.level}</p></div><div className="stat-block health"><span className="stat-label"><Icon name="heart"/>Здоровье</span><strong className="stat-value exact" data-testid="health">{state.stats.health}</strong><p className="stat-detail exact">Базовое здоровье: {state.level}</p></div></div>
                <div className="crit-stat"><span>Крит персонажа</span><strong className="exact" data-testid="crit">{state.stats.critIncomplete?'Неполный расчёт: уточните крит надетых модов':formatCrit(state.stats.crit)}</strong><p className="note">Сумма крита надетых 🧿 и 💢 × 3. Единицы, не проценты.</p></div><p className="slot-count">Надето модов <strong data-testid="equipped-count">{total(state.equipment)} / 100</strong></p><div className="slot-meter" aria-hidden="true"><span style={{width:total(state.equipment)+'%'}}/></div><p className="slot-help">Бонусы урона и здоровья считаются от уровня и складываются между собой.</p>
                {state.equippedMods.length>0&&<details className="outfit"><summary>Вся экипировка · {total(state.equipment)} / 100</summary>{state.equippedMods.map(g=><div className="equipped" key={g.id}><p><ModText g={g}/> × {g.quantity}</p><button className="secondary" disabled={disabled} onClick={()=>{setEquipGroup(pages.work.find(x=>x.id===g.id)??g);setEquipCount('0');}}>Снять / изменить</button></div>)}<button disabled={disabled} className="secondary" onClick={()=>void send({type:'equip',items:[]})}>Снять все моды</button></details>}
                <details className="stats-help"><summary>Как считаются характеристики</summary><p>+p превращается в +p% от уровня игрока. Проценты складываются; итог округляется вверх один раз. Базовые урон и здоровье равны уровню.</p></details>
              </section>
              <section className="budget-card" aria-label="Расход эксперимента"><span className="budget-icon"><Icon name="diamond"/></span><div><span>Расход эксперимента</span><strong className="exact" data-testid="spent">{state.spent}</strong><span>алмазов</span></div><p>Примерка бесплатна. Здесь учитывается только выполненный крафт.</p></section>
              {scope==='work'&&<button className="reset-button" disabled={disabled} onClick={()=>setResetOpen(true)}><Icon name="undo"/>Сбросить эксперимент</button>}
            </aside>
          </div>
          <footer className="app-footer"><span>CHEAPSHOT MODS LAB</span><p>Один игрок · один сохранённый эксперимент. Алмазы здесь только расчётные.</p><button className="text-button" onClick={()=>setHelpOpen(true)}><Icon name="help"/>Справка</button></footer>
        </div>
      </main>
    </div>
    {edit!==undefined&&<Modal label="Редактор модов" title={edit?'Правка группы':'Новая группа'} onClose={()=>setEdit(undefined)}><form className="mod-form" aria-label="Редактор модов" onSubmit={e=>{e.preventDefault();try {inputInteger(value);inputInteger(quantity);const critValue=hasCrit(kind)?(crit===''?null:parseCrit(crit)):null;mod({kind,tier,value,crit:critValue});void send({type:'original.put',...(edit?{id:edit.id}:{}),kind,tier,value,quantity,crit:critValue}).then(ok=>{if(ok)setEdit(undefined);});}catch(e){setProblem(explain(e));}}}>
      <div className="type-options" aria-label="Быстрый выбор типа">{kinds.map(k=><button type="button" className={kind===k?'type-option selected':'type-option'} key={k} aria-label={'Выбрать тип '+displayKind(k)} aria-pressed={kind===k} onClick={()=>changeType(k,tier)}><ModIcon kind={k}/><span>{k==='💚'?'Здоровье':'Урон'}</span></button>)}</div>
      <div className="fields"><label>Тип мода<select value={kind} onChange={e=>changeType(e.target.value as Kind,tier)}>{kinds.map(k=><option key={k} value={k}>{displayKind(k)}</option>)}</select></label><label>Уровень мода<select value={tier} onChange={e=>changeType(kind,Number(e.target.value))}>{[1,2,3,4,5,6].map(t=><option key={t} value={t}>{t}.0</option>)}</select></label></div>
      {tier===1&&kind!=='💚'?<label>Параметр мода<select value={value} onChange={e=>setValue(e.target.value)}>{(kind==='🅾'?['10','11','12']:['8']).map(v=><option key={v}>{v}</option>)}</select></label>:<NumberField label="Параметр мода" value={value} onChange={setValue}/>}
      {hasCrit(kind)&&<label>Крит мода<input aria-label="Крит мода" inputMode="decimal" value={crit} onChange={e=>setCrit(e.target.value)} required={!edit||edit.crit!=null||edit.kind!==kind}/><span className="note">Ноль укажите явно. Свыше трёх знаков округляется вверх до 0,001. {crit!==''&&(()=>{try{return 'Сохранится: '+formatCrit(parseCrit(crit));}catch{return 'Проверьте формат.';}})()}{crit===''&&edit?.crit==null?' Старый неизвестный крит можно оставить без изменения.':''}</span></label>}
      <NumberField label="Количество модов" value={quantity} onChange={setQuantity}/><p className="soft-note exact">Числовой параметр +{value||'p'} станет +{value||'p'}%. Все числа сохраняются точно.</p>
      {modalFeedback()}<div className="actions"><button disabled={disabled}>Сохранить группу</button><button type="button" className="secondary" onClick={()=>setEdit(undefined)}>Закрыть редактор</button></div>
    </form></Modal>}
    {refine&&<Modal label="Уточнение крита" title="Уточнить неизвестный крит" onClose={()=>setRefine(undefined)}><form className="mod-form" onSubmit={e=>{e.preventDefault();try{inputInteger(refineCount);const crit=parseCrit(refineCrit);if(refine.scope==='work')inputInteger(refineWorn,true);void send({type:refine.scope+'.crit',id:refine.g.id,quantity:refineCount,crit,...(refine.scope==='work'?{worn:refineWorn}:{})}).then(ok=>{if(ok)setRefine(undefined);});}catch(e){setProblem(explain(e));}}}><ModCardTitle g={refine.g}/><NumberField label="Уточнить экземпляров" value={refineCount} onChange={setRefineCount}/>{refine.scope==='work'&&<NumberField label="Из них надетых" value={refineWorn} onChange={setRefineWorn} zero/>}<label>Уточнённый крит<input aria-label="Уточнённый крит" inputMode="decimal" value={refineCrit} onChange={e=>setRefineCrit(e.target.value)} required/></label><p className="note">Бесплатно. История и расход сохранятся. {refine.scope==='original'?'В начатом эксперименте исходная правка не меняет рабочие моды.':'Укажите точную надетую часть выбранного количества. Экипировка сохранится.'}</p>{modalFeedback()}<div className="actions"><button disabled={disabled}>Сохранить крит</button><button type="button" className="secondary" onClick={()=>setRefine(undefined)}>Закрыть уточнение</button></div></form></Modal>}
    {equipGroup&&<Modal label="Экипировка группы" title="Экипировка группы" onClose={()=>setEquipGroup(undefined)}><form className="mod-form" aria-label="Экипировка группы" onSubmit={e=>{e.preventDefault();try {inputInteger(equipCount,true);const items=state.equipment.filter(x=>x.id!==equipGroup.id);if(BigInt(equipCount)>0n)items.push({id:equipGroup.id,quantity:equipCount});void send({type:'equip',items}).then(ok=>{if(ok)setEquipGroup(undefined);});}catch(e){setProblem(explain(e));}}}><ModCardTitle g={equipGroup}/><NumberField label="Надеть экземпляров (0 — снять)" value={equipCount} onChange={setEquipCount} zero/><p className="soft-note">Суммарно можно надеть до 100 модов. Укажите точное количество или 0, чтобы снять эту группу.</p>{modalFeedback()}<div className="actions"><button disabled={disabled}>Применить экипировку</button><button className="secondary" type="button" onClick={()=>setEquipGroup(undefined)}>Закрыть примерку</button></div></form></Modal>}
    {resetOpen&&<Modal label="Подтверждение сброса" title="Начать эксперимент заново?" onClose={()=>setResetOpen(false)}><p className="confirm-text">Заменить рабочий набор актуальным исходным? Экипировка, история крафтов и расход обнулятся. Уровень игрока сохранится.</p>{modalFeedback()}<div className="actions"><button className="danger" disabled={disabled} onClick={()=>void send({type:'reset'}).then(ok=>{if(ok)setResetOpen(false);})}>Подтвердить сброс</button><button className="secondary" data-autofocus onClick={()=>setResetOpen(false)}>Не сбрасывать</button></div></Modal>}
    {helpOpen&&<Modal label="Как это работает" title="Планируйте. Примеряйте. Усиливайте." onClose={()=>setHelpOpen(false)}><div className="rules"><h3>Ваш инвентарь — основа</h3><p>До первой примерки или крафта правки исходного набора обновляют рабочую копию. После начала эксперимента новые группы и увеличение количества с теми же параметрами сразу пополняют рабочий запас. Уменьшение, удаление и изменение параметров затрагивают только исходный набор до сброса. Уточнение крита исходной записи в начатом эксперименте не меняет рабочий набор.</p><h3>Бонусы в процентах</h3><p>+p превращается в +p% от уровня игрока. Проценты складываются; итог округляется вверх один раз. Базовые урон и здоровье равны уровню.</p><h3>Крит и типы</h3><p>Типы: 🅾️, 💢, 🧿, 🌸. Крит есть у 🧿 и 💢: после крафта сумма трёх входов делится на два с округлением вверх до 0,001. Неизвестный крит старых модов не считается нулём. Крит персонажа — сумма крита надетых модов × 3, без процентов и зависимости от уровня.</p><h3>Пакетный фьюз</h3><p>Выберите целевую ступень, количество результатов и упорядоченный разрешённый пул. Готовые моды нужной ступени идут раньше новых промежуточных. Свободные расходуются раньше разрешённых надетых. Расчёт ничего не записывает; применение и отмена охватывают весь пакет.</p><h3>Три в один</h3><p>Для крафта нужны три мода одного типа и уровня 1.0–5.0. Для надетых используйте «В крафт с персонажа». Результат и стоимость рассчитываются перед применением. Отмена возвращает входы, экипировку и расход последнего крафта.</p></div><button className="secondary wide" onClick={()=>setHelpOpen(false)}>Вернуться в мастерскую</button></Modal>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
