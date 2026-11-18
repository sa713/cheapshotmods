import React, {useLayoutEffect,useRef,type ReactNode} from 'react';
import {displayKind,displayTier,formatCrit,hasCrit,isRaw,type Group,type Kind} from '@chm/rules';
import {kindInfo} from './kinds.js';
export {kindInfo};

const paths={
  bolt:'m13 2-9 12h7l-1 8 10-12h-7z',
  layers:'m12 3 9 5-9 5-9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  box:'m12 3 9 5v8l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v8',
  user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  flask:'M9 3h6 M10 3v6L4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3 M7.5 15h9',
  diamond:'m6 3-4 6 10 12L22 9l-4-6z M2 9h20 M9.5 3 12 21l2.5-18',
  plus:'M12 5v14 M5 12h14',
  minus:'M5 12h14',
  close:'m6 6 12 12 M6 18 18 6',
  edit:'m15 4 5 5 M3 21l5-1L21 7l-5-5L3 15z',
  trash:'M3 6h18 M5 6l1 15h12l1-15 M9 6V3h6v3 M10 10v7 M14 10v7',
  arrow:'M5 12h14 m-6-6 6 6-6 6',
  chevron:'m9 6 6 6-6 6',
  undo:'M9 5 3 11l6 6 M3 11h11a6 6 0 0 1 0 12h-3',
  refresh:'M20 11a8 8 0 0 0-14.6-4.5L3 9 M3 4v5h5 M4 13a8 8 0 0 0 14.6 4.5L21 15 M21 20v-5h-5',
  check:'m5 12 4 4L19 6',
  help:'M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5 M12 18h.01',
  heart:'M12 20s-7.5-4.6-9-9.2C2 7.4 4.3 5 7 5c2 0 3.4 1.2 5 3 1.6-1.8 3-3 5-3 2.7 0 5 2.4 4 5.8C19.5 15.4 12 20 12 20z',
  swords:'M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2 M9.5 6.5 14 2h3v3l-4.5 4.5 M5 14l-2 2 M6 18l-2 2 M8 16l-4 4',
  target:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01',
  shirt:'M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z',
  pin:'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  logout:'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h11',
  warn:'M12 3 2 21h20z M12 10v5 M12 18h.01',
  sparkle:'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M6 18l2.5-2.5 M15.5 8.5 18 6',
};
export type IconName=keyof typeof paths;
export function Icon({name,size=20}:{name:IconName;size?:number}) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/>{name==='help'&&<circle cx="12" cy="12" r="9.5"/>}</svg>;
}
export function Brand({compact=false}:{compact?:boolean}){
  return <div className={'brand'+(compact?' compact':'')}><span className="brand-mark" aria-hidden="true"><Icon name="layers" size={18}/></span><span className="brand-name">Cheapshot<b>Mods</b></span></div>;
}
export function ModIcon({kind,size='md'}:{kind:Kind;size?:'sm'|'md'|'lg'}){
  const boxes={'raw-purple':'50 88 390 394','raw-red':'516 88 392 394','raw-green':'982 88 394 394'};
  return <span className={'mod-icon '+size+' tone-'+kindInfo[kind].tone} aria-hidden="true">{isRaw(kind)?<svg viewBox={boxes[kind]} preserveAspectRatio="xMidYMid slice"><image href="/raw-mods.jpg" width="1536" height="538"/></svg>:<span className="glyph">{displayKind(kind)}</span>}</span>;
}
/** Screen-reader and test label shared by every view: «🅾️ 1.0 · +10%». */
export function modLabel(g:Pick<Group,'kind'|'tier'|'value'>){return displayKind(g.kind)+' '+displayTier(g)+' · +'+g.value+'%';}
export function ModTitle({g,as='h3'}:{g:Pick<Group,'kind'|'tier'|'value'|'crit'>;as?:'h3'|'p'}) {
  const Tag=as;
  return <div className="mod-title-block">
    <Tag className="mod-title"><span className="sr-only">{modLabel(g)}</span><strong className="exact mod-value" aria-hidden="true">+{g.value}%</strong><span className="tier" aria-hidden="true">{displayTier(g)}</span></Tag>
    <p className="mod-meta">{isRaw(g.kind)?displayKind(g.kind):kindInfo[g.kind].effect}{hasCrit(g.kind)&&<> · <span className={g.crit==null?'crit unknown':'crit'}>крит <span className="exact">{formatCrit(g.crit)}</span></span></>}</p>
  </div>;
}
export function Modal({label,title,onClose,children,variant='dialog',subtitle}:{label:string;title:string;onClose:()=>void;children:ReactNode;variant?:'dialog'|'sheet';subtitle?:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const dialog=ref.current!,trigger=document.activeElement as HTMLElement|null,shell=document.getElementById('app-shell');
    dialog.showModal();
    // Native modal supplies the focus trap/backdrop. Explicit shell inert/ARIA
    // also prevents background actions and exposes just the active dialog to AT.
    if(shell){shell.inert=true;shell.setAttribute('aria-hidden','true');}
    dialog.querySelector<HTMLElement>('[data-autofocus],input:not([type=checkbox]),[role=combobox]')?.focus();
    return ()=>{if(shell){shell.inert=false;shell.removeAttribute('aria-hidden');}dialog.close();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className={'modal '+variant} aria-label={label} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{const d=ref.current;if(variant==='sheet'&&d&&e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}} onKeyDown={e=>{
    if(e.key!=='Tab')return;
    const items=Array.from(ref.current!.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')).filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length>0);
    const first=items[0],last=items.at(-1);
    if(first&&last&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){e.preventDefault();(e.shiftKey?last:first).focus();}
  }}>
    <div className="modal-head"><div><h2>{title}</h2>{subtitle&&<div className="modal-subtitle">{subtitle}</div>}</div><button type="button" className="icon-button ghost" aria-label="Закрыть окно" onClick={onClose}><Icon name="close"/></button></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
