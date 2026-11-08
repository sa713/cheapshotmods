import React, {useLayoutEffect,useRef,type ReactNode} from 'react';
import {displayKind,displayTier,formatCrit,hasCrit,isRaw,type Group,type Kind} from '@chm/rules';

const paths={
  bolt:'m13 2-9 12h7l-1 8 10-12h-7z',
  box:'m12 3 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8 M7 5l10 6',
  shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',
  flask:'M9 3h6 M10 3v6L4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3 M8 14h8',
  diamond:'m6 3-5 6 11 13L23 9l-5-6z M1 9h22 M6 3l6 19L18 3',
  plus:'M12 5v14 M5 12h14',
  close:'m6 6 12 12 M6 18 18 6',
  edit:'m15 4 5 5 M3 21l5-1L21 7l-5-5L3 15z',
  trash:'M3 6h18 M5 6l1 15h12l1-15 M9 6V3h6v3 M10 10v7 M14 10v7',
  arrow:'M5 12h14 m-6-6 6 6-6 6',
  undo:'M9 5 3 11l6 6 M3 11h11a6 6 0 0 1 0 12',
  check:'m5 12 4 4L19 6',
  help:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01',
  heart:'M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2C-2 9 6 16 12 21c6-5 14-12 8-17z',
  swords:'m4 3 17 17 M3 4l1 5 5-5z M20 3 3 20 M21 4l-1 5-5-5z M2 17l5 5 M17 22l5-5',
};
export function Icon({name}:{name:keyof typeof paths}) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/>{name==='help'&&<circle cx="12" cy="12" r="9"/>}</svg>;
}
export function Brand(){return <div className="brand"><span className="brand-symbol"><Icon name="bolt"/></span><span>CHEAPSHOT<small>MODS LAB</small></span></div>;}
const colors:Partial<Record<Kind,string>>={'🅾':'orange','💢':'pink','🧿':'blue','💚':'green'};
export function ModIcon({kind}:{kind:Kind}){
  const boxes={'raw-purple':'50 88 390 394','raw-red':'516 88 392 394','raw-green':'982 88 394 394'};
  return <span className={'mod-icon '+(isRaw(kind)?'raw-icon':colors[kind])} aria-hidden="true">{isRaw(kind)?<svg viewBox={boxes[kind]}><image href="/raw-mods.jpg" width="1536" height="538"/></svg>:displayKind(kind)}</span>;
}
export function ModCardTitle({g}:{g:Pick<Group,'kind'|'tier'|'value'|'crit'>}) {
  return <div className="card-heading"><ModIcon kind={g.kind}/><div className="mod-info"><h3 className="mod-title"><span className="sr-only">{displayKind(g.kind)} {displayTier(g)} · +{g.value}%</span><strong className="exact" aria-hidden="true">+{g.value}%</strong><span className="tier-badge" aria-hidden="true">{displayTier(g)}</span></h3><p className="mod-description">{isRaw(g.kind)?displayKind(g.kind)+' · Урон':g.kind==='💚'?'Здоровье':'Урон'} · бонус к уровню</p>{hasCrit(g.kind)&&<p className="mod-crit">Крит: <span className="exact">{formatCrit(g.crit)}</span></p>}</div></div>;
}
export function Modal({label,title,onClose,children}:{label:string;title:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const dialog=ref.current!,trigger=document.activeElement as HTMLElement|null,shell=document.getElementById('app-shell');
    dialog.showModal();
    // Native modal supplies the focus trap/backdrop. Explicit shell inert/ARIA
    // also prevents background actions and exposes just the active dialog to AT.
    if(shell){shell.inert=true;shell.setAttribute('aria-hidden','true');}
    dialog.querySelector<HTMLElement>('input, select, [data-autofocus]')?.focus();
    return ()=>{if(shell){shell.inert=false;shell.removeAttribute('aria-hidden');}dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className="modal" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const items=Array.from(ref.current!.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')).filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length>0);
    const first=items[0],last=items.at(-1);
    if(first&&last&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();(e.shiftKey?last:first).focus();}
  }}><div className="modal-head"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Закрыть окно" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}
