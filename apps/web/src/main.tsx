import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {compareGroups, craft, displayKind, displayTier, isRaw, formatCrit, hasCrit, inputInteger, kinds, mod, parseCrit, type HomogeneousFusePlan, type HomogeneousFuseRequest, type GreenFusePlan, type GreenFuseRequest, type Equipped, type Group, type Kind, type Selection} from '@chm/rules';
import type {Store} from '../../server/src/store.js';
import {Brand,Icon,Modal,ModIcon,ModTitle,kindInfo,modLabel,type IconName} from './presentation.js';
import {BatchFuse} from './batch.js';
import {GreenFuse} from './green.js';
import {Choices} from './select.js';
import './style.css';

type State = ReturnType<Store['summary']>;
type Scope = 'original'|'work';
type View = 'work'|'craft'|'original'|'character';
type CraftMode = 'single'|'batch'|'green';
type Command = {key:string;revision:string;experiment:string;action:Record<string,unknown>};
type Page = {revision:string;items:Group[]};
type Session = {csrf:string;account:string};
type WebApp = {initData?:string;colorScheme?:'light'|'dark';ready?:()=>void;expand?:()=>void};
class ApiError extends Error {constructor(readonly status:number, readonly code:string){super(code);}}
const explanations:Record<string,string> = {
  INVALID_INTEGER:'Введите положительное целое число без пробелов и дробной части.',
  INTEGER_TOO_LONG:'Одно поле может содержать до 128 цифр. Это технический размер ввода, не предел инвентаря.',
  POOL_INTEGER_TOO_LONG:'Для количества из существующего запаса допускается до 256 цифр — технический размер поля.',
  CRIT_TOO_LONG:'Крит допускает до 128 целых и трёх дробных знаков — технический размер ввода.',
  FUSE_POOL_TOO_LARGE:'В одном пакете допускается до 1000 выбранных групп. Разделите пул на несколько пакетов.',
  INVALID_SELECTION:'Проверьте выбранные группы, количества и разрешённую надетую часть.',
  INVALID_TARGET:'Целевая ступень пакета должна быть от 1.0 до 6.0; у цветов — от 2.0.',
  FUSE_COUNT_OUT_OF_RANGE:'Количество результатов должно быть от 1 до доступного максимума. Загрузите актуальный расчёт.',
  HOMOGENEOUS_GROUP_REQUIRED:'Массовый фьюз допускает только одну группу полностью одинаковых модов.',
  INVALID_RECIPE:'Выберите один из двух зелёных рецептов.',
  REVISION_CONFLICT:'Набор изменился в другом окне. Загрузите сохранённые данные для нового расчёта.',
  CRIT_REQUIRED:'Для нового мода укажите крит, включая явный ноль.',
  BASELINE_REQUIRED:'Сначала зафиксируйте исходный набор.',
  BASELINE_REPLACE_REQUIRED:'Исходный набор уже зафиксирован. Загрузите данные и подтвердите его замену.',
  INVALID_CRIT:'Крит: неотрицательное десятичное число с точкой или запятой, без степени и пробелов.',
  FUSE_PLAN_TOO_COMPLEX:'План содержит слишком много разных переходов. Разделите пул на несколько пакетов.',
  INVALID_MOD:'Проверьте тип, уровень и параметр мода.',
  EQUIPMENT_LIMIT:'Можно надеть не больше 100 модов суммарно.',
  INSUFFICIENT_MODS:'В рабочем наборе недостаточно выбранных экземпляров.',
  INCOMPATIBLE_MODS:'Для крафта нужны три совместимых сырьевых мода или обычных одного типа и уровня 1.0–5.0.',
  SELECT_THREE:'Выберите ровно три экземпляра для крафта.',
  LOGIN_RATE_LIMIT:'Слишком много попыток входа. Подождите минуту.',
  SERVER_ERROR:'Ошибка сервера. Изменения не подтверждены. Повторите ту же команду.',
  COMMAND_EXPIRED:'Срок хранения ответа команды истёк. Повторного применения не было; загрузите актуальные данные.',
  UNAUTHORIZED:'Сессия завершилась. Войдите через Telegram заново.',
  SESSION_CHANGED:'Учётная запись изменилась в другом окне. Войдите заново в этом окне.',
  EXPIRED_INIT_DATA:'Данные входа Telegram устарели. Закройте Mini App и откройте его заново.',
  INVALID_INIT_DATA:'Telegram не подтвердил вход. Откройте Mini App заново.',
};
const doneText:Record<string,string>={
  level:'Уровень сохранён','original.put':'Группа сохранена','original.delete':'Группа удалена','original.crit':'Крит уточнён','work.crit':'Крит уточнён',
  equip:'Экипировка обновлена',craft:'Крафт применён',fuse:'Пакет применён',undo:'Последняя операция отменена',reset:'Эксперимент начат заново',
  'baseline.capture':'Исходный набор зафиксирован','baseline.restore':'Набор возвращён к точке возврата',
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
function useMedia(query:string) {
  const [match,setMatch]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);
  useEffect(()=>{const m=matchMedia(query),on=()=>setMatch(m.matches);on();m.addEventListener('change',on);return ()=>m.removeEventListener('change',on);},[query]);
  return match;
}
export function NumberField({label,value,onChange,zero=false,hint}:{label:string;value:string;onChange:(v:string)=>void;zero?:boolean;hint?:React.ReactNode}) {
  return <div className="field number-field"><label>{label}<input aria-label={label} inputMode="numeric" pattern={zero?'[0-9]+':'[1-9][0-9]*'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="off" spellCheck={false} required /></label>{hint&&<p className="hint">{hint}</p>}{value.length>20&&<p className="full-number"><span>Полное значение</span><span className="exact">{value}</span></p>}</div>;
}
function ModText({g}:{g:Pick<Group,'kind'|'tier'|'value'|'crit'>}) {
  return <span className="mod-text">{displayKind(g.kind)} <strong>{displayTier(g)}</strong> · <span className="exact">+{g.value}%</span>{hasCrit(g.kind)&&<span> · крит {formatCrit(g.crit)}</span>}</span>;
}
function ModInline({g}:{g:Pick<Group,'kind'|'tier'|'value'|'crit'>}) {
  return <span className="mod-inline"><span className="sr-only">{displayKind(g.kind)} </span><strong className="exact">+{g.value}%</strong> <span className="tier">{displayTier(g)}</span>{hasCrit(g.kind)&&<span className="muted"> · крит <span className="exact">{formatCrit(g.crit)}</span></span>}</span>;
}
function Filters({groups,value,onChange}:{groups:Group[];value:Kind|'all';onChange:(k:Kind|'all')=>void}) {
  const counts=new Map<Kind,number>();for(const g of groups)counts.set(g.kind,(counts.get(g.kind)??0)+1);
  return <div className="filters" role="group" aria-label="Типы загруженных модов">
    <button className="chip" aria-pressed={value==='all'} onClick={()=>onChange('all')}>Все моды<span className="chip-count" aria-hidden="true">{groups.length}</span></button>
    {kinds.map(k=><button key={k} className="chip" aria-label={displayKind(k)+' '+kindInfo[k].effect} title={displayKind(k)+' · '+kindInfo[k].effect} aria-pressed={value===k} onClick={()=>onChange(k)}><ModIcon kind={k} size="sm"/><span className="chip-count" aria-hidden="true">{counts.get(k)??0}</span></button>)}
  </div>;
}

function App() {
  const [config,setConfig]=useState<{oidc:boolean;mini:boolean}>();
  const [session,setSession]=useState<Session>();
  const [state,setState]=useState<State>();
  const [view,setView]=useState<View>('work'), [craftMode,setCraftMode]=useState<CraftMode>('single');
  const [filters,setFilters]=useState<Record<Scope,Kind|'all'>>({original:'all',work:'all'}), [helpOpen,setHelpOpen]=useState(false);
  const [pages,setPages]=useState<Record<Scope,Group[]>>({original:[],work:[]});
  const [more,setMore]=useState<Record<Scope,boolean>>({original:false,work:false});
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [message,setMessage]=useState('Подключаемся…');
  const [problem,setProblem]=useState(''), [conflict,setConflict]=useState(false), [pending,setPending]=useState<Command>();
  const [selection,setSelection]=useState<Selection[]>([]), [resetOpen,setResetOpen]=useState(false);
  const [baselineDialog,setBaselineDialog]=useState<'capture'|'restore'>(), [removal,setRemoval]=useState<Group>();
  const [edit,setEdit]=useState<Group|null|undefined>(), [level,setLevel]=useState('1');
  const [kind,setKind]=useState<Kind>('🅾'), [tier,setTier]=useState(1), [value,setValue]=useState('10'), [quantity,setQuantity]=useState('1');
  const [sheet,setSheet]=useState<Group>(), [equipCount,setEquipCount]=useState('1');
  const [crit,setCrit]=useState(''),[refine,setRefine]=useState<{g:Group;scope:Scope}>(),[refineCount,setRefineCount]=useState('1'),[refineWorn,setRefineWorn]=useState('0'),[refineCrit,setRefineCrit]=useState('');
  const [batchPreset,setBatchPreset]=useState<{id:string;nonce:number}>();
  const [toast,setToast]=useState<{text:string;undo:boolean;id:number}>();
  const lock=useRef(false);
  const wide=useMedia('(min-width: 1100px)');
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
      const app=webApp();app?.ready?.(); app?.expand?.();
      if(app?.colorScheme)document.documentElement.dataset.theme=app.colorScheme;
      const c=await api<{oidc:boolean;mini:boolean}>('/api/config');setConfig(c);
      let s:Session|undefined;
      const initData=app?.initData,loggedOut=new URLSearchParams(location.search).has('logged_out');
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
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(undefined),toast.undo?7000:3500);return ()=>clearTimeout(t);},[toast]);
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
    lock.current=true;setBusy(true);setProblem('');setToast(undefined);setMessage('Сохраняем…');remember(command);
    let committed=false;
    try {
      // Another tab may rotate the cookie for the same account; refresh CSRF
      // while the account precondition prevents adopting a different owner.
      const credentials=await api<Session>('/api/session',{headers:accountHeaders(session.account)});setSession(credentials);
      await api('/api/commands',post(command,credentials.csrf,session.account));
      committed=true;
      // A replay may describe an older revision. Read current committed data.
      remember();setMessage('Изменения сохранены. Загружаем данные…');
      await load(session);setMessage('Все изменения сохранены');
      const type=String(command.action.type);setToast({text:doneText[type]??'Изменения сохранены',undo:!retry&&(type==='craft'||type==='fuse'),id:Date.now()});
      return true;
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
  async function nextPage(scope:Scope) {
    if (!state || !session || busy) return;setBusy(true);
    try {
      const items=pages[scope], p=await api<Page>('/api/inventory?scope='+scope+'&limit=100&after='+encodeURIComponent(items.at(-1)?.id??'')+'&revision='+state.revision,{headers:accountHeaders(session.account)});
      if (p.revision!==state.revision) {setConflict(true);throw new Error('REVISION_CONFLICT');}
      setPages(prev=>({...prev,[scope]:[...prev[scope],...p.items]}));setMore(prev=>({...prev,[scope]:p.items.length===100}));
    } catch(e) {if(e instanceof Error&&e.message==='REVISION_CONFLICT'){setConflict(true);setProblem('Набор изменился. Загрузите сохранённые данные.');}else readError(e);} finally {setBusy(false);}
  }
  const batchPreview=useCallback(async(fuse:HomogeneousFuseRequest):Promise<HomogeneousFusePlan>=>{
    if(!session||!state||lock.current||pending||conflict)throw new Error('REVISION_CONFLICT');
    const credentials=await api<Session>('/api/session',{headers:accountHeaders(session.account)});
    return api<HomogeneousFusePlan>('/api/fuse-preview',post({revision:state.revision,experiment:state.experiment,fuse},credentials.csrf,session.account));
  },[session,state,pending,conflict]);
  const greenPreview=useCallback(async(fuse:GreenFuseRequest):Promise<GreenFusePlan>=>{
    if(!session||!state||lock.current||pending||conflict)throw new Error('REVISION_CONFLICT');
    const credentials=await api<Session>('/api/session',{headers:accountHeaders(session.account)});
    return api<GreenFusePlan>('/api/fuse-preview',post({revision:state.revision,experiment:state.experiment,fuse},credentials.csrf,session.account));
  },[session,state,pending,conflict]);
  const batchError=useCallback((e:unknown)=>{
    if(e instanceof ApiError&&e.status===409){setConflict(true);setProblem('Данные изменились в другом окне. Загрузите сохранённую версию для нового расчёта.');}
    else if(e instanceof ApiError&&e.status===401){setSession(undefined);setState(undefined);setMessage(explain(e));}
  },[]);
  // This preview runs in the background even without a selected homogeneous
  // source. A stale read invalidates its own plan; unrelated dialogs/commands
  // retain their own server-side revision checks and error/refresh workflow.
  const greenError=useCallback((e:unknown)=>{if(!(e instanceof ApiError&&e.status===409))batchError(e);},[batchError]);
  function beginRefine(g:Group,scope:Scope){setSheet(undefined);setRefine({g,scope});setRefineCount(g.quantity);setRefineWorn(scope==='work'?(state?.equipment.find(e=>e.id===g.id)?.quantity??'0'):'0');setRefineCrit('');setProblem('');}
  function beginEdit(g:Group|null) {setEdit(g);setKind(g?.kind??'🅾');setTier(g?.tier??1);setValue(g?.value??'10');setQuantity(g?.quantity??'1');setCrit(g?.crit==null?'':formatCrit(g.crit));setProblem('');}
  function openSheet(g:Group,count?:string){const worn=state?.equipment.find(e=>e.id===g.id)?.quantity??'0';setSheet(g);setEquipCount(count??(worn==='0'?'1':worn));setProblem('');}
  function changeType(k:Kind,t:number) {
    setKind(k);setTier(isRaw(k)?0:t===0?1:t);
    if(isRaw(k)){setValue(k==='raw-green'?'8':'5');setCrit(k==='raw-green'?'':'0,013');}
    else {if(t<=1&&k!=='💚')setValue(k==='🅾'?'10':'8');if(isRaw(kind))setCrit('');}
  }
  function choose(g:Group,worn:boolean) {
    try {
      const existing=selection.find(s=>s.id===g.id), n=BigInt(existing?.quantity??'0'), w=BigInt(existing?.worn??'0');
      const equipped=BigInt(state?.equipment.find(e=>e.id===g.id)?.quantity??'0');
      if (selection.reduce((n,s)=>n+BigInt(s.quantity),0n)>=3n) throw new Error('SELECT_THREE');
      if (worn?w>=equipped:n-w>=BigInt(g.quantity)-equipped) throw new Error('INSUFFICIENT_MODS');
      setSelection([...selection.filter(s=>s.id!==g.id),{id:g.id,quantity:(n+1n).toString(),worn:(w+(worn?1n:0n)).toString()}]);setProblem('');
    } catch(e) {setProblem(explain(e));}
  }
  function unchoose(id:string,worn:boolean) {
    setSelection(selection.flatMap(s=>{
      if(s.id!==id)return [s];
      const n=BigInt(s.quantity)-1n,w=BigInt(s.worn)-(worn?1n:0n);
      return n>0n?[{id,quantity:n.toString(),worn:(w<0n?0n:w).toString()}]:[];
    }));setProblem('');
  }
  const byId=new Map([...pages.work,...state?.equippedMods??[]].map(g=>[g.id,g]));
  const workById=new Map(pages.work.map(g=>[g.id,g]));
  let preview:ReturnType<typeof craft>|undefined;
  try {preview=craft(selection.flatMap(s=>Array.from({length:Number(s.quantity)},()=>byId.get(s.id)!)));} catch { /* Incomplete selections have no preview. */ }
  const disabled=busy||!!pending||conflict;
  const active:View=wide&&view==='character'?'work':view;
  const go=(target:View,mode?:CraftMode)=>{setView(target);if(mode)setCraftMode(mode);requestAnimationFrame(()=>{window.scrollTo({top:0});document.getElementById('view-'+target)?.focus({preventScroll:true});});};
  const selectedSlots=selection.flatMap(s=>Array.from({length:Number(s.quantity)},(_,i)=>({group:byId.get(s.id)!,worn:BigInt(i)<BigInt(s.worn)})));
  const selectedCount=Number(total(selection));
  const wornOf=(id:string)=>state?.equipment.find(e=>e.id===id)?.quantity??'0';
  const inCraft=(id:string)=>selection.find(s=>s.id===id)?.quantity??'0';
  const modalFeedback=()=> <div className="modal-feedback"><p className="save-line" role="status">{message}</p>{problem&&<p className="banner error" role="alert">{problem}</p>}{(pending||conflict)&&<div className="feedback-actions">{pending&&<button disabled={busy} onClick={()=>void send(pending.action,pending)}>Повторить ту же команду</button>}{conflict&&<button className="secondary" disabled={busy} onClick={()=>void refresh()}>Загрузить сохранённые данные</button>}</div>}</div>;

  if (!session || !state) return <main className="login">
    <div className="login-card">
      <Brand/>
      <h1>Ваши моды, примерка и крафт — в одном месте</h1>
      <p className="lead">Калькулятор Cheapshot точно считает урон, здоровье, крит и стоимость крафта — даже для очень больших чисел. Данные привязаны к вашему Telegram.</p>
      <ul className="login-points" aria-label="Что внутри">
        <li><Icon name="box"/>Исходный набор и точка возврата</li>
        <li><Icon name="layers"/>Эксперимент: примерка без риска</li>
        <li><Icon name="flask"/>Крафт 3 в 1, массовый фьюз, зелёные рецепты</li>
      </ul>
      <p role="status" className="save-line">{loading?'Проверяем вход…':message}</p>
      {problem&&<p role="alert" className="banner error">{problem}</p>}
      <div className="login-actions">
        {!loading&&config?.oidc&&<a className="button primary" href="/auth/oidc/start">Войти через Telegram<Icon name="arrow"/></a>}
        {!loading&&config?.mini&&webApp()?.initData&&<button className="primary" onClick={()=>{location.href='/';}}>Войти в Mini App</button>}
        {!loading&&<button className="secondary" onClick={()=>location.reload()}>Повторить подключение</button>}
      </div>
    </div>
  </main>;

  const navItems:{id:View;label:string;short:string;icon:IconName}[]=[
    {id:'work',label:'Эксперимент',short:'Эксперимент',icon:'layers'},
    {id:'craft',label:'Крафт',short:'Крафт',icon:'flask'},
    {id:'original',label:'Исходный набор',short:'Исходный',icon:'box'},
    {id:'character',label:'Персонаж',short:'Персонаж',icon:'user'},
  ];
  const equippedTotal=total(state.equipment);
  const logout=()=>void(async()=>{try {const current=await api<Session>('/api/session',{headers:accountHeaders(session.account)});await api('/auth/logout',post({},current.csrf,session.account));if(storageKey)sessionStorage.removeItem(storageKey);location.href='/?logged_out=1';}catch(e){if(e instanceof ApiError&&e.status===401){if(storageKey)sessionStorage.removeItem(storageKey);location.href='/?logged_out=1';}else setProblem(explain(e));}})();
  const tone=problem||conflict?'error':pending?'warn':busy?'busy':'ok';

  const groupList=(scope:Scope)=>{
    const items=pages[scope],visible=items.filter(g=>filters[scope]==='all'||g.kind===filters[scope]).sort(compareGroups);
    return <>
      <div className="list-toolbar"><Filters groups={items} value={filters[scope]} onChange={k=>setFilters(f=>({...f,[scope]:k}))}/><span className="loaded-count">Загружено групп: {items.length}</span></div>
      <ul className="mod-list" aria-label={scope==='original'?'Группы исходного набора':'Моды эксперимента'}>
        {visible.map(g=>scope==='original'?<li key={g.id} className="mod-row original-row" data-testid="original-group">
          <button className="row-main" aria-label={'Изменить '+modLabel(g)} disabled={disabled} onClick={()=>beginEdit(g)}>
            <ModIcon kind={g.kind}/><div className="row-body"><ModTitle g={g} as="p"/></div>
            <p className="stock"><span className="qty"><strong className="exact" data-testid="stock">{g.quantity}</strong> шт.</span></p>
            <Icon name="edit" size={18}/>
          </button>
          {hasCrit(g.kind)&&g.crit==null&&<button className="secondary small refine-inline" disabled={disabled} onClick={()=>beginRefine(g,'original')}>Уточнить крит</button>}
        </li>:(()=>{const worn=wornOf(g.id),free=BigInt(g.quantity)-BigInt(worn),chosen=inCraft(g.id);
          return <li key={g.id} className={'mod-row work-row'+(worn!=='0'?' is-worn':'')+(chosen!=='0'?' is-chosen':'')} data-testid="work-group">
            <button className="row-main" aria-label={'Открыть мод '+modLabel(g)} onClick={()=>openSheet(g)}>
              <ModIcon kind={g.kind}/><div className="row-body"><ModTitle g={g} as="p"/></div>
              <p className="stock"><span className="qty"><strong className="exact" data-testid="stock">{g.quantity}</strong> шт.</span>{worn!=='0'&&<span className="worn-chip" data-testid="worn">Надето {worn}</span>}{chosen!=='0'&&<span className="craft-chip">В крафте {chosen}</span>}</p>
              <Icon name="chevron"/>
            </button>
            <button className="add-button" aria-label="В крафт" title={g.tier===6?'Уровень 6.0 — максимальный':free<=0n?'Все экземпляры надеты — возьмите их с персонажа в карточке мода':'Добавить свободный экземпляр в крафт'} disabled={disabled||g.tier===6||free<=0n||selectedCount>=3} onClick={()=>choose(g,false)}><Icon name="plus"/></button>
          </li>;})())}
      </ul>
      {items.length===0&&<div className="empty-state"><span className="empty-icon"><Icon name={scope==='original'?'box':'layers'} size={28}/></span><h3>Модов пока нет</h3><p>{scope==='original'?'Внесите моды, которые есть у персонажа в игре. Количество не ограничено.':'Эксперимент — рабочая копия исходного набора. Сначала внесите свои моды.'}</p><button className="primary" disabled={disabled} onClick={()=>{if(scope==='work')go('original');beginEdit(null);}}>Добавить первую группу</button></div>}
      {items.length>0&&visible.length===0&&<p className="empty-filter">Среди загруженных групп такого типа нет. Выберите «Все моды» или загрузите следующую страницу.</p>}
      {more[scope]&&<button className="secondary load-more" disabled={busy} onClick={()=>void nextPage(scope)}>Загрузить ещё группы</button>}
    </>;
  };

  // The compact tray abbreviates very long values; the full value stays in the accessible text and in the craft view.
  const shown=(v:string,variant:'tray'|'full')=>variant==='tray'&&v.length>7?<span title={v}>{v.slice(0,3)+'…'+v.slice(-2)}</span>:<span className="exact">{v}</span>;
  const slots=(variant:'tray'|'full')=><div className={'craft-flow '+variant}>
    <div className="slots">{[0,1,2].map(i=>{const slot=selectedSlots[i];return slot?<button key={i} className="slot filled" aria-label={'Убрать из крафта: '+modLabel(slot.group)+(slot.worn?' (с персонажа)':'')} title="Убрать из крафта" disabled={busy} onClick={()=>unchoose(slot.group.id,slot.worn)}><ModIcon kind={slot.group.kind} size="sm"/><strong>+{shown(slot.group.value,variant)}%</strong><small>{displayTier(slot.group)}{slot.worn?' · надет':''}</small><span className="slot-x" aria-hidden="true"><Icon name="close" size={14}/></span></button>:<div key={i} className="slot empty" role="group" aria-label={'Вход крафта '+(i+1)}><Icon name="plus" size={16}/>{variant==='full'&&<small>Мод {i+1}</small>}</div>;})}</div>
    <span className="flow-arrow" aria-hidden="true"><Icon name="arrow"/></span>
    <div className={'slot result'+(preview?' ready':'')} role="group" aria-label="Результат крафта">{preview?<><ModIcon kind={preview.result.kind} size="sm"/><strong>+{shown(preview.result.value,variant)}%</strong><small>{displayTier(preview.result)}{hasCrit(preview.result.kind)?' · крит '+formatCrit(preview.result.crit):''}</small><span className="sr-only">Результат: <ModText g={preview.result}/></span></>:<><Icon name="sparkle" size={16}/>{variant==='full'&&<small>Результат</small>}</>}</div>
  </div>;
  const craftHint=selectedCount===0?'Выберите три экземпляра одного типа и уровня — или три сырьевых одного цвета.':!preview?(selectedCount<3?'Добавьте ещё '+(3-selectedCount)+'.':'Нужны три совместимых сырьевых мода или обычных одного типа и уровня 1.0–5.0.'):'Три выбранных экземпляра заменятся одним результатом.';
  const craftActions=(variant:'tray'|'full')=><div className="craft-actions">
    <p className="price">{variant==='tray'?'Цена':'Цена операции:'} <strong className="exact" data-testid="craft-price">{preview?.price??'—'}</strong> <span aria-hidden="true">💎</span></p>
    {variant==='tray'?<button className="icon-button" aria-label="Очистить выбор" title="Очистить выбор" disabled={busy||selection.length===0} onClick={()=>setSelection([])}><Icon name="close"/></button>:<button className="secondary" disabled={busy||selection.length===0} onClick={()=>setSelection([])}>Очистить выбор</button>}
    <button className="primary" disabled={disabled||!preview} onClick={()=>void send({type:'craft',items:selection})}><Icon name="flask"/>Применить крафт</button>
  </div>;
  const pickable=(()=>{
    const first=selectedSlots[0]?.group;
    return [...pages.work].sort(compareGroups).filter(g=>g.tier<6&&(!first||(isRaw(first.kind)?isRaw(g.kind)&&g.kind===first.kind:g.kind===first.kind&&g.tier===first.tier)));
  })();

  const character=<div className="rail-stack">
    <section className="panel character" aria-label="Персонаж">
      <div className="panel-head"><h2>Персонаж</h2><span className="live">считается сразу</span></div>
      <form className="level-form" onSubmit={e=>{e.preventDefault();try{inputInteger(level);void send({type:'level',value:level});}catch(e){setProblem(explain(e));}}}><NumberField label="Уровень игрока" value={level} onChange={setLevel}/><button className="icon-button primary" aria-label="Сохранить уровень" title="Сохранить уровень" disabled={disabled||level===state.level}><Icon name="check"/></button></form>
      <div className="stats">
        <div className="stat damage"><span className="stat-label"><Icon name="swords" size={16}/>Урон</span><strong className="stat-value exact" data-testid="damage">{state.stats.damage}</strong><span className="stat-sub exact">база {state.level}</span></div>
        <div className="stat health"><span className="stat-label"><Icon name="heart" size={16}/>Здоровье</span><strong className="stat-value exact" data-testid="health">{state.stats.health}</strong><span className="stat-sub exact">база {state.level}</span></div>
        <div className={'stat crit'+(state.stats.critIncomplete?' incomplete':'')}><span className="stat-label"><Icon name="target" size={16}/>Крит</span><strong className="stat-value exact" data-testid="crit">{state.stats.critIncomplete?'Неполный расчёт: уточните крит надетых модов':formatCrit(state.stats.crit)}</strong><span className="stat-sub">сумма крита надетых × 3, в единицах</span></div>
      </div>
      <div className="meter-line"><span>Надето модов</span><strong className="exact" data-testid="equipped-count">{equippedTotal} / 100</strong></div>
      <div className="meter" aria-hidden="true"><span style={{width:Math.min(100,Number(equippedTotal))+'%'}}/></div>
      {state.equippedMods.length>0?<details className="outfit"><summary>Экипировка · {state.equippedMods.length} {state.equippedMods.length===1?'группа':'гр.'}</summary>
        <ul>{state.equippedMods.map(g=><li key={g.id}><ModIcon kind={g.kind} size="sm"/><span className="outfit-text"><ModInline g={g}/> <b className="exact">× {g.quantity}</b></span><button className="secondary small" disabled={disabled} onClick={()=>openSheet(pages.work.find(x=>x.id===g.id)??g,'0')}>Снять / изменить</button></li>)}</ul>
        <button className="secondary" disabled={disabled} onClick={()=>void send({type:'equip',items:[]})}>Снять все моды</button>
      </details>:<p className="muted small-text">Ничего не надето. Откройте мод в эксперименте, чтобы примерить его.</p>}
    </section>
    <section className="panel experiment-card" aria-label="Состояние эксперимента">
      <div className="spent"><span className="spent-icon"><Icon name="diamond"/></span><div><span>Потрачено в эксперименте</span><strong className="exact" data-testid="spent">{state.spent}</strong></div></div>
      <p className="muted small-text">Примерка бесплатна — здесь только выполненный крафт.</p>
      {state.lastCraft&&<p className="last-op">Последняя операция: {(state.lastCraft.outputs??[state.lastCraft.output]).map((g,i)=><span key={i}><ModText g={g}/> × {g.quantity}{' '}</span>)}</p>}
      <button className="secondary" disabled={disabled||!state.lastCraft} onClick={()=>void send({type:'undo'})}><Icon name="undo"/>Отменить последний крафт{state.lastCraft?' · '+state.lastCraft.price+' 💎':''}</button>
      <button className="secondary danger-text" disabled={disabled} onClick={()=>setResetOpen(true)}><Icon name="refresh"/>Сбросить эксперимент</button>
    </section>
  </div>;

  return <>
    <div className="app-shell" id="app-shell">
      <aside className="rail-left">
        <Brand/>
        <nav className="nav" aria-label="Разделы">{navItems.map(item=><button key={item.id} className={'nav-item nav-'+item.id} aria-label={item.label} aria-current={active===item.id?'page':undefined} onClick={()=>go(item.id)}><Icon name={item.icon}/><span className="nav-label short">{item.short}</span><span className="nav-label full">{item.label}</span>{item.id==='craft'&&selectedCount>0&&<span className="nav-badge" aria-hidden="true">{selectedCount}</span>}</button>)}</nav>
        <button className="rail-link" onClick={()=>setHelpOpen(true)}><Icon name="help"/>Как это работает</button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Brand compact/>
          <div className={'sync tone-'+tone}><span className="sync-dot" aria-hidden="true"/><span role="status" className="sync-text">{message}</span></div>
          {(conflict||!pending)&&<button className="icon-button ghost" aria-label="Загрузить сохранённые данные" title="Загрузить сохранённые данные" disabled={busy} onClick={()=>void refresh()}><Icon name="refresh"/></button>}
          <button className="icon-button ghost help-top" aria-label="Справка" title="Как это работает" onClick={()=>setHelpOpen(true)}><Icon name="help"/></button>
          <button className="ghost logout" aria-label="Выйти" title="Выйти" disabled={busy||!!pending} onClick={logout}><Icon name="logout"/><span className="logout-text">Выйти</span></button>
        </header>
        {(problem||pending||conflict)&&<div className={'banner '+(problem?'error':'warn')+' page-banner'}>
          <Icon name="warn"/>
          <div className="banner-text">{problem?<p role="alert">{problem}</p>:<p>{pending?'Результат последней команды не подтверждён. Повтор безопасен: он не удвоит действие.':'Набор изменился в другом окне.'}</p>}</div>
          <div className="banner-actions">{pending&&<button className="primary" disabled={busy} onClick={()=>void send(pending.action,pending)}>Повторить ту же команду</button>}{conflict&&<button className="secondary" disabled={busy} onClick={()=>void refresh()}>Загрузить актуальные данные</button>}</div>
        </div>}
        <main className="content">
          <section id="view-work" className="view" tabIndex={-1} hidden={active!=='work'} aria-labelledby="h-work">
            <div className="view-head"><div><h1 id="h-work">Эксперимент</h1><p className="lead">Рабочая копия ваших модов. Примеряйте и крафтите — исходный набор не меняется.</p></div></div>
            {!wide&&<button className="stat-strip" onClick={()=>go('character')} aria-label={'Персонаж: урон '+state.stats.damage+', здоровье '+state.stats.health+', надето '+equippedTotal+' из 100'}>
              <span><Icon name="swords" size={16}/><b className="exact">{state.stats.damage}</b></span><span><Icon name="heart" size={16}/><b className="exact">{state.stats.health}</b></span><span><Icon name="shirt" size={16}/><b className="exact">{equippedTotal}/100</b></span><span><Icon name="diamond" size={16}/><b className="exact">{state.spent}</b></span><Icon name="chevron" size={16}/>
            </button>}
            {groupList('work')}
          </section>
          <section id="view-craft" className="view" tabIndex={-1} hidden={active!=='craft'} aria-labelledby="h-craft">
            <div className="view-head"><div><h1 id="h-craft">Крафт</h1><p className="lead">Расчёт виден до применения. Любую операцию можно отменить целиком.</p></div></div>
            <div className="segmented" role="group" aria-label="Способ крафта">{([['single','Три в один'],['batch','Массовый фьюз'],['green','Зелёные рецепты']] as const).map(([id,label])=><button key={id} aria-pressed={craftMode===id} onClick={()=>setCraftMode(id)}>{label}</button>)}</div>
            <section className="panel craft-panel" id="craft-panel" hidden={craftMode!=='single'} aria-label="Три в один" data-testid={active==='craft'&&preview?'craft-preview':undefined}>
              {slots('full')}
              <p className="hint">{craftHint}</p>
              {craftActions('full')}
              <div className="picker">
                <h3>{selectedSlots[0]?'Совместимые моды':'Моды для крафта'}</h3>
                {pickable.length===0?<p className="muted small-text">{pages.work.length?'Нет совместимых загруженных модов.':'В эксперименте пока нет модов.'}</p>:<ul>{pickable.map(g=>{const worn=wornOf(g.id),free=BigInt(g.quantity)-BigInt(worn);return <li key={g.id} className="pick-row" data-testid="craft-pick"><ModIcon kind={g.kind} size="sm"/><span className="pick-text"><ModInline g={g}/><small className="exact">свободно {free.toString()}{worn!=='0'?' · надето '+worn:''}</small></span><button className="icon-button" aria-label={'Добавить в крафт: '+modLabel(g)} title="Добавить свободный" disabled={disabled||free<=0n||selectedCount>=3} onClick={()=>choose(g,false)}><Icon name="plus"/></button>{worn!=='0'&&<button className="secondary small" aria-label={'С персонажа: '+modLabel(g)} disabled={disabled||selectedCount>=3} onClick={()=>choose(g,true)}>С персонажа</button>}</li>;})}</ul>}
              </div>
            </section>
            <div hidden={craftMode!=='batch'}><BatchFuse groups={pages.work} equipment={state.equipment} revision={state.revision} disabled={disabled} preset={batchPreset} onPreview={batchPreview} onCommit={fuse=>send({type:'fuse',fuse})} onError={batchError} errorText={explain} onRefine={g=>beginRefine(g,'work')}/></div>
            <div hidden={craftMode!=='green'}><GreenFuse revision={state.revision} experiment={state.experiment} disabled={disabled} onPreview={greenPreview} onCommit={fuse=>send({type:'fuse',fuse})} onError={greenError} errorText={explain}/></div>
          </section>
          <section id="view-original" className="view" tabIndex={-1} hidden={active!=='original'} aria-labelledby="h-original">
            <div className="view-head"><div><h1 id="h-original">Исходный набор</h1><p className="lead">{state.started?'Моды, которые есть в игре. Новые группы и пополнение тех же модов сразу попадают в эксперимент; другие правки — после сброса эксперимента.':'Моды, которые есть в игре. Пока эксперимент не начат, правки сразу обновляют рабочую копию.'}</p></div><button className="primary" disabled={disabled} onClick={()=>beginEdit(null)}><Icon name="plus"/>Добавить моды</button></div>
            <section className="panel baseline" aria-label="Точка возврата">
              <div className="baseline-icon"><Icon name="pin"/></div>
              <div className="baseline-body"><h2>Точка возврата</h2>
                <p id="baseline-status" aria-live="polite">{state.baseline?<>Зафиксировано <time dateTime={state.baseline.capturedAt}>{new Date(state.baseline.capturedAt).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'})}</time> · модов <strong className="exact" data-testid="baseline-quantity">{state.baseline.quantity}</strong> · записей <span className="exact">{state.baseline.entries}</span></>:'Сначала зафиксируйте исходный набор'}</p>
                <p className="muted small-text">Снимок всего исходного набора. Возврат к нему заменит и исходный набор, и эксперимент.</p>
              </div>
              <div className="baseline-actions">
                <button className="secondary" disabled={disabled} onClick={()=>{if(state.baseline)setBaselineDialog('capture');else void send({type:'baseline.capture',replace:false});}}>Зафиксировать исходный набор модов</button>
                <button className="secondary danger-text" aria-describedby="baseline-status" disabled={disabled||!state.baseline} onClick={()=>setBaselineDialog('restore')}>Сбросить набор модов к исходному</button>
              </div>
            </section>
            {groupList('original')}
          </section>
          <section id="view-character" className="view character-view" tabIndex={-1} hidden={active!=='character'} aria-label="Персонаж и состояние эксперимента">
            {!wide&&character}
          </section>
        </main>
      </div>
      {wide&&<aside className="rail-right" aria-label="Параметры эксперимента">{character}</aside>}
      {active==='work'&&selectedCount>0&&<section className="craft-tray" aria-label="Крафт" data-testid={preview?'craft-preview':undefined}>
        <h2 className="sr-only">Крафт · {selectedCount} из 3</h2>
        {slots('tray')}
        {!preview&&<p className="hint tray-hint">{craftHint}</p>}
        {craftActions('tray')}
      </section>}
      {toast&&<div className="toast" aria-live="polite" key={toast.id}><Icon name="check"/><span>{toast.text}</span>{toast.undo&&<button className="text-button" disabled={disabled||!state.lastCraft} onClick={()=>{setToast(undefined);void send({type:'undo'});}}>Отменить</button>}<button className="icon-button ghost" aria-label="Скрыть уведомление" onClick={()=>setToast(undefined)}><Icon name="close" size={16}/></button></div>}
    </div>

    {sheet&&(()=>{const g=workById.get(sheet.id)??sheet,worn=wornOf(g.id),free=BigInt(g.quantity)-BigInt(worn),chosen=inCraft(g.id),unknown=hasCrit(g.kind)&&g.crit==null;
      return <Modal label="Экипировка группы" variant="sheet" title={modLabel(g)} subtitle={<span className="exact">В наборе {g.quantity} · надето {worn} · свободно {free.toString()}</span>} onClose={()=>setSheet(undefined)}>
        <form className="sheet-section first" aria-label="Примерка" onSubmit={e=>{e.preventDefault();try {inputInteger(equipCount,true);const items=state.equipment.filter(x=>x.id!==g.id);if(BigInt(equipCount)>0n)items.push({id:g.id,quantity:equipCount});void send({type:'equip',items}).then(ok=>{if(ok)setSheet(undefined);});}catch(e){setProblem(explain(e));}}}>
          <h3>Примерка</h3>
          <div className="stepper">
            <button type="button" className="icon-button" aria-label="Надеть на один меньше" disabled={!/^[0-9]+$/.test(equipCount)||equipCount==='0'} onClick={()=>setEquipCount(c=>(BigInt(c)-1n).toString())}><Icon name="minus"/></button>
            <NumberField label="Надеть экземпляров (0 — снять)" value={equipCount} onChange={setEquipCount} zero/>
            <button type="button" className="icon-button" aria-label="Надеть на один больше" disabled={!/^[0-9]+$/.test(equipCount)} onClick={()=>setEquipCount(c=>(BigInt(c)+1n).toString())}><Icon name="plus"/></button>
          </div>
          <p className="hint">Сейчас надето всего {equippedTotal} из 100. Укажите точное количество этой группы или 0, чтобы снять.</p>
          <button className="primary" disabled={disabled}>Применить экипировку</button>
        </form>
        <div className="sheet-section">
          <h3>Крафт {chosen!=='0'&&<span className="craft-chip">в крафте {chosen}</span>}</h3>
          <div className="sheet-row">
            <button className="secondary" disabled={disabled||g.tier===6||free<=0n||selectedCount>=3} onClick={()=>choose(g,false)}><Icon name="plus"/>В крафт</button>
            {worn!=='0'&&<button className="secondary" disabled={disabled||g.tier===6||selectedCount>=3} onClick={()=>choose(g,true)}><Icon name="plus"/>В крафт с персонажа</button>}
          </div>
          <p className="hint">{g.tier===6?'Уровень 6.0 — максимальный.':selectedCount>=3?'Выбраны все три входа. Примените крафт или уберите мод из лотка.':'Выбрано '+selectedCount+' из 3. Надетые экземпляры берутся только явно.'}</p>
          {g.tier<6?<button className="secondary" disabled={disabled||unknown} onClick={()=>{setSheet(undefined);setBatchPreset({id:g.id,nonce:Date.now()});go('craft','batch');}}><Icon name="layers"/>Массовый фьюз этой группы</button>:null}
        </div>
        {unknown&&<div className="sheet-section"><p className="banner warn">Крит этой группы неизвестен — он не считается нулём.</p><button className="secondary" disabled={disabled} onClick={()=>beginRefine(g,'work')}>Уточнить крит</button></div>}
        {modalFeedback()}
        <div className="actions"><button type="button" className="secondary" onClick={()=>setSheet(undefined)}>Закрыть примерку</button></div>
      </Modal>;})()}

    {edit!==undefined&&<Modal label="Редактор модов" title={edit?'Правка группы':'Новая группа модов'} onClose={()=>setEdit(undefined)}><form className="mod-form" aria-label="Редактор модов" onSubmit={e=>{e.preventDefault();try {inputInteger(value);inputInteger(quantity);const critValue=hasCrit(kind)?(crit===''?null:parseCrit(crit)):null;mod({kind,tier,value,crit:critValue});void send({type:'original.put',...(edit?{id:edit.id}:{}),kind,tier,value,quantity,crit:critValue}).then(ok=>{if(ok)setEdit(undefined);});}catch(e){setProblem(explain(e));}}}>
      <fieldset className="type-picker"><legend>Тип мода</legend><div className="type-grid">{kinds.map(k=><label key={k} className={'type-option'+(kind===k?' selected':'')}><input type="radio" name="mod-kind" value={k} checked={kind===k} aria-label={displayKind(k)+' · '+kindInfo[k].effect} onChange={()=>changeType(k,tier)}/><ModIcon kind={k}/><span className="type-name">{isRaw(k)?displayKind(k).replace(' сырьевой',''):kindInfo[k].effect}<small>{isRaw(k)?'сырьё':k==='💚'?'бонус к HP':hasCrit(k)?'с критом':'без крита'}</small></span></label>)}</div></fieldset>
      {!isRaw(kind)&&<Choices label="Уровень мода" value={String(tier)} onChange={t=>changeType(kind,Number(t))} options={[1,2,3,4,5,6].map(t=>({value:String(t),label:t+'.0'}))}/>}
      {isRaw(kind)?(kind==='raw-green'?<Choices label="Параметр сырьевого мода" value={value} onChange={setValue} options={['6','7','8','9','10'].map(v=>({value:v,label:'+'+v+'%'}))}/>:<p className="fixed-param">Параметр <b>+5%</b> · крит <b>0,013</b> — фиксированы для сырьевого мода.</p>)
        :tier===1&&kind!=='💚'?(kind==='🅾'?<Choices label="Параметр мода" value={value} onChange={setValue} options={['9','10','11','12','13','14','15'].map(v=>({value:v,label:'+'+v+'%'}))}/>:<p className="fixed-param">Параметр <b>+8%</b> — единственный для {displayKind(kind)} 1.0.</p>)
        :<NumberField label="Параметр мода" value={value} onChange={setValue} hint={'Число p станет бонусом +p% от уровня.'}/>}
      {hasCrit(kind)&&!isRaw(kind)&&<label className="field">Крит мода<input aria-label="Крит мода" inputMode="decimal" value={crit} onChange={e=>setCrit(e.target.value)} required={!edit||edit.crit!=null||edit.kind!==kind} autoComplete="off"/><span className="hint">Ноль укажите явно. Больше трёх знаков округляется вверх до 0,001. {crit!==''&&(()=>{try{return 'Сохранится: '+formatCrit(parseCrit(crit))+'.';}catch{return 'Проверьте формат.';}})()}{crit===''&&edit?.crit==null&&edit?' Старый неизвестный крит можно оставить без изменения.':''}</span></label>}
      <NumberField label="Количество модов" value={quantity} onChange={setQuantity}/>
      {modalFeedback()}<div className="actions"><button className="primary" disabled={disabled}>Сохранить группу</button><button type="button" className="secondary" onClick={()=>setEdit(undefined)}>Закрыть редактор</button></div>
      {edit&&<div className="danger-zone"><button type="button" className="ghost danger-text" disabled={disabled} onClick={()=>{const g=edit;setEdit(undefined);setRemoval(g);}}><Icon name="trash" size={18}/>Удалить группу из исходного набора</button></div>}
    </form></Modal>}
    {refine&&<Modal label="Уточнение крита" title="Уточнить неизвестный крит" onClose={()=>setRefine(undefined)}><form className="mod-form" onSubmit={e=>{e.preventDefault();try{inputInteger(refineCount);const crit=parseCrit(refineCrit);if(refine.scope==='work')inputInteger(refineWorn,true);void send({type:refine.scope+'.crit',id:refine.g.id,quantity:refineCount,crit,...(refine.scope==='work'?{worn:refineWorn}:{})}).then(ok=>{if(ok)setRefine(undefined);});}catch(e){setProblem(explain(e));}}}><div className="sheet-mod"><ModIcon kind={refine.g.kind} size="lg"/><ModTitle g={refine.g} as="p"/></div><NumberField label="Уточнить экземпляров" value={refineCount} onChange={setRefineCount}/>{refine.scope==='work'&&<NumberField label="Из них надетых" value={refineWorn} onChange={setRefineWorn} zero/>}<label className="field">Уточнённый крит<input aria-label="Уточнённый крит" inputMode="decimal" value={refineCrit} onChange={e=>setRefineCrit(e.target.value)} required autoComplete="off"/></label><p className="hint">Бесплатно. История и расход сохранятся. {refine.scope==='original'?'В начатом эксперименте исходная правка не меняет рабочие моды.':'Укажите точную надетую часть выбранного количества. Экипировка сохранится.'}</p>{modalFeedback()}<div className="actions"><button className="primary" disabled={disabled}>Сохранить крит</button><button type="button" className="secondary" onClick={()=>setRefine(undefined)}>Закрыть уточнение</button></div></form></Modal>}
    {removal&&<Modal label="Подтверждение удаления" title="Удалить группу?" onClose={()=>setRemoval(undefined)}><p className="confirm-text"><ModText g={removal}/> × <span className="exact">{removal.quantity}</span> будет удалена из исходного набора. Начатый эксперимент сохранится.</p>{modalFeedback()}<div className="actions"><button className="danger" disabled={disabled} onClick={()=>void send({type:'original.delete',id:removal.id}).then(ok=>{if(ok)setRemoval(undefined);})}>Удалить группу</button><button className="secondary" data-autofocus onClick={()=>setRemoval(undefined)}>Не удалять</button></div></Modal>}
    {resetOpen&&<Modal label="Подтверждение сброса" title="Начать эксперимент заново?" onClose={()=>setResetOpen(false)}><p className="confirm-text">Заменить рабочий набор актуальным исходным? Экипировка, история крафтов и расход обнулятся. Уровень игрока сохранится.</p>{modalFeedback()}<div className="actions"><button className="danger" disabled={disabled} onClick={()=>void send({type:'reset'}).then(ok=>{if(ok)setResetOpen(false);})}>Подтвердить сброс</button><button className="secondary" data-autofocus onClick={()=>setResetOpen(false)}>Не сбрасывать</button></div></Modal>}
    {baselineDialog==='capture'&&<Modal label="Подтверждение фиксации набора" title="Заменить точку возврата?" onClose={()=>setBaselineDialog(undefined)}><p className="confirm-text">Текущий исходный набор заменит предыдущую точку возврата. Эксперимент, фьюзы, экипировка и расход сохранятся.</p>{modalFeedback()}<div className="actions"><button className="primary" disabled={disabled} onClick={()=>void send({type:'baseline.capture',replace:true}).then(ok=>{if(ok)setBaselineDialog(undefined);})}>Подтвердить фиксацию</button><button className="secondary" data-autofocus onClick={()=>setBaselineDialog(undefined)}>Не заменять</button></div></Modal>}
    {baselineDialog==='restore'&&<Modal label="Подтверждение возврата набора" title="Вернуться к точке возврата?" onClose={()=>setBaselineDialog(undefined)}><p className="confirm-text">Вернуть зафиксированный набор? Моды и правки после фиксации будут удалены из текущих наборов. Фьюзы, экипировка и расход обнулятся. Уровень игрока сохранится.</p>{modalFeedback()}<div className="actions"><button className="danger" disabled={disabled} onClick={()=>void send({type:'baseline.restore'}).then(ok=>{if(ok)setBaselineDialog(undefined);})}>Вернуть набор</button><button className="secondary" data-autofocus onClick={()=>setBaselineDialog(undefined)}>Не возвращать</button></div></Modal>}
    {helpOpen&&<Modal label="Как это работает" title="Как это работает" onClose={()=>setHelpOpen(false)}><div className="rules">
      <details open><summary>Исходный набор и эксперимент</summary><p>Исходный набор — моды, которые есть у персонажа в игре. Эксперимент — его рабочая копия: в ней вы примеряете и крафтите. До первой примерки или крафта правки исходного набора обновляют рабочую копию. После начала эксперимента новые группы и увеличение количества с теми же параметрами сразу пополняют рабочий запас. Уменьшение, удаление и изменение параметров затрагивают только исходный набор до сброса. Уточнение крита исходной записи в начатом эксперименте не меняет рабочий набор.</p></details>
      <details><summary>Точка возврата и два сброса</summary><p>Явная фиксация сохраняет весь введённый исходный набор как постоянную точку возврата. Фьюзы, примерка, добавления и правки её не меняют. Повторная фиксация заменяет её после подтверждения, не затрагивая эксперимент.</p><p>«Сбросить эксперимент» возвращает рабочие моды к введённому сейчас исходному набору. «Сбросить набор модов к исходному» возвращает и исходный набор, и рабочие моды к последней точке возврата: поздние добавления и правки удаляются. Оба действия очищают историю, экипировку и расход, сохраняя уровень игрока. Пустую точку возврата тоже можно восстановить.</p></details>
      <details><summary>Урон, здоровье и крит</summary><p>+p превращается в +p% от уровня игрока. Проценты складываются; итог округляется вверх один раз. Базовые урон и здоровье равны уровню. Надеть можно до 100 модов суммарно, включая сырьевые.</p><p>Типы: 🅾️, 💢, 🧿, 🌸 и три сырьевых: фиолетовый, красный, зелёный. Зелёный сырьевой даёт урон и не добавляет крит. Крит есть у 🧿, 💢 и фиолетовых/красных сырьевых: после крафта сумма трёх входов делится на два с округлением вверх до 0,001. Неизвестный крит старых модов не считается нулём. Крит персонажа — сумма крита надетых модов × 3, без процентов и зависимости от уровня.</p></details>
      <details><summary>Три в один</summary><p>Обычный крафт требует три мода одного типа и уровня 1.0–5.0. Три фиолетовых 5/0,013 → 🧿1.0 за 24, красных → 💢1.0 за 22, зелёных 6–10 → 🅾️1.0 за 28 алмазов; разные значения зелёных совместимы. Надетые экземпляры берутся только явно — кнопкой «В крафт с персонажа» в карточке мода. Результат и стоимость видны до применения. Отмена возвращает входы, экипировку и расход последнего крафта.</p></details>
      <details><summary>Массовый фьюз</summary><p>Выберите одну группу полностью одинаковых модов и более высокий целевой уровень. Максимум рассчитывается автоматически, количество результатов можно уменьшить. Надетые включаются только явно; свободные расходуются первыми. Другие группы и промежуточные моды не используются. Неизвестный крит сначала нужно уточнить. Расчёт ничего не записывает, применение и отмена охватывают весь пакет.</p></details>
      <details><summary>Зелёные рецепты</summary><p>6 + 6 + 7 → 🅾️1.0 по 10 и 7 + 8 + 8 → 🅾️1.0 по 12. Максимум считается по всему рабочему запасу; количество можно уменьшить. Запас зелёных 7 общий: после применения остатки пересчитываются. Каждый результат стоит 28 алмазов, одна отмена возвращает весь пакет. Исходный набор и точка возврата сохраняются.</p></details>
    </div><button className="secondary wide" onClick={()=>setHelpOpen(false)}>Понятно</button></Modal>}
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
