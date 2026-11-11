import React,{useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';

export interface SelectOption {value:string;label:string;disabled?:boolean}
export function Select({label,value,options,onChange,disabled=false}:{label:string;value:string;options:SelectOption[];onChange:(value:string)=>void;disabled?:boolean}) {
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),list=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState<CSSProperties>({});
  const selected=options.findIndex(o=>o.value===value),enabled=options.flatMap((o,i)=>o.disabled?[]:[i]);
  const expanded=open&&!disabled&&enabled.length>0;
  const current=options[active]&&!options[active]!.disabled?active:(enabled[0]??0);
  function show(index=selected){if(disabled||!enabled.length)return;setActive(enabled.includes(index)?index:enabled[0]!);setOpen(true);}
  function choose(index:number){const option=options[index];if(!option||option.disabled)return;onChange(option.value);setOpen(false);trigger.current?.focus({preventScroll:true});}
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useLayoutEffect(()=>{
    if(!expanded)return;
    const place=()=>{
      const r=trigger.current!.getBoundingClientRect(),v=window.visualViewport,w=v?.width??innerWidth,h=v?.height??innerHeight,x=v?.offsetLeft??0,y=v?.offsetTop??0;
      const below=y+h-r.bottom-14,above=r.top-y-14,up=below<180&&above>below;
      const width=Math.min(Math.max(r.width,280),w-24),left=Math.max(x+12,Math.min(r.left,x+w-width-12));
      setPosition({position:'fixed',left,width,maxHeight:Math.max(44,Math.min(320,up?above:below)),...(up?{bottom:innerHeight-r.top+6}:{top:r.bottom+6})});
    };
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);window.visualViewport?.addEventListener('resize',place);
    const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside,true);
    return ()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);document.removeEventListener('pointerdown',outside,true);};
  },[expanded]);
  useLayoutEffect(()=>{if(!expanded)return;const frame=requestAnimationFrame(()=>list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({block:'nearest'}));return ()=>cancelAnimationFrame(frame);},[current,expanded]);
  function key(e:KeyboardEvent<HTMLButtonElement>){
    if(e.key==='Tab'){setOpen(false);return;}
    if(e.key==='Escape'&&expanded){e.preventDefault();e.stopPropagation();setOpen(false);return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();e.stopPropagation();
      if(!expanded){show(e.key==='End'?enabled.at(-1):e.key==='Home'?enabled[0]:selected);return;}
      const at=enabled.indexOf(current),next=e.key==='Home'?0:e.key==='End'?enabled.length-1:Math.max(0,Math.min(enabled.length-1,at+(e.key==='ArrowDown'?1:-1)));
      setActive(enabled[next]!);return;
    }
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(expanded)choose(current);else show();}
  }
  return <div className="select-field" ref={root}>
    <label htmlFor={id}>{label}</label>
    <button ref={trigger} id={id} type="button" className="select-trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded?id+'-list':undefined} aria-activedescendant={expanded?id+'-'+current:undefined} disabled={disabled||!enabled.length} data-value={value} onKeyDown={key} onClick={()=>expanded?setOpen(false):show()} onBlur={e=>{if(!root.current?.contains(e.relatedTarget as Node|null))setOpen(false);}}>
      <span>{options[selected]?.label??'Выберите вариант'}</span><span aria-hidden="true">⌄</span>
    </button>
    {expanded&&<div id={id+'-list'} ref={list} role="listbox" aria-label={label} className="select-list" style={position}>{options.map((o,i)=><div key={o.value} id={id+'-'+i} role="option" aria-selected={o.value===value} aria-disabled={o.disabled||undefined} data-value={o.value} data-active={i===current} className="select-option" onMouseDown={e=>e.preventDefault()} onPointerMove={()=>{if(!o.disabled)setActive(i);}} onClick={()=>choose(i)}>{o.label}{o.value===value&&<span aria-hidden="true"> ✓</span>}</div>)}</div>}
  </div>;
}
