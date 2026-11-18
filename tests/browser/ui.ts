import {expect,type Locator,type Page} from '@playwright/test';
import {displayKind,type Kind} from '@chm/rules';
import {selectChoice} from './choices.js';

// Shared interactions with the redesigned interface. Scenario specs keep their
// own assertions; these helpers only encode where a control lives now.
export const status=(page:Page)=>page.locator('.sync [role=status]');
export async function saved(page:Page){await expect(status(page)).toHaveText('Все изменения сохранены');}
export const loggedIn=(page:Page)=>page.getByRole('heading',{name:'Эксперимент',level:1,exact:true});
export const nav=(page:Page)=>page.getByRole('navigation',{name:'Разделы',exact:true});
export async function view(page:Page,name:'Эксперимент'|'Крафт'|'Исходный набор'|'Персонаж'){
  const button=nav(page).getByRole('button',{name,exact:true});
  if(name==='Персонаж'&&!await button.isVisible())return; // desktop: the character rail is always visible
  await button.click();
}
export const work=(page:Page)=>view(page,'Эксперимент');
export const original=(page:Page)=>view(page,'Исходный набор');
export async function craftMode(page:Page,mode:'Три в один'|'Массовый фьюз'|'Зелёные рецепты'){await view(page,'Крафт');await page.getByRole('group',{name:'Способ крафта'}).getByRole('button',{name:mode,exact:true}).click();}
/** Character controls live in the right rail (desktop) or the «Персонаж» tab (mobile). */
export async function inCharacter<T>(page:Page,action:()=>Promise<T>,returnBack=true):Promise<T>{
  const tab=nav(page).getByRole('button',{name:'Персонаж',exact:true}),mobile=await tab.isVisible();
  const back=mobile?await nav(page).locator('[aria-current=page]').getAttribute('aria-label'):null;
  if(mobile)await tab.click();
  const result=await action();
  if(returnBack&&mobile&&back&&back!=='Персонаж')await nav(page).getByRole('button',{name:back,exact:true}).click();
  return result;
}
export async function level(page:Page,n:string,wait=true){await inCharacter(page,async()=>{await page.getByLabel('Уровень игрока',{exact:true}).fill(n);await page.getByRole('button',{name:'Сохранить уровень'}).click();if(wait)await saved(page);});}
export async function undo(page:Page){await inCharacter(page,async()=>{await page.getByRole('button',{name:/Отменить последний крафт/}).click();await saved(page);});}
export async function undoDisabled(page:Page){await inCharacter(page,()=>expect(page.getByRole('button',{name:/Отменить последний крафт/})).toBeDisabled());}
export async function reset(page:Page,confirm=true){await inCharacter(page,async()=>{await page.getByRole('button',{name:'Сбросить эксперимент',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();if(confirm){await page.getByRole('button',{name:'Подтвердить сброс',exact:true}).click();await saved(page);}else await page.getByRole('button',{name:'Не сбрасывать',exact:true}).click();});}
export async function refresh(page:Page){await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await expect(status(page)).toHaveText('Сохранённые данные загружены');}
export async function pick(page:Page|Locator,label:string,value:string){
  const group=page.getByRole('group',{name:label,exact:true});await group.locator('input[value='+JSON.stringify(value)+']').check();
  await expect(group.locator('input[value='+JSON.stringify(value)+']')).toBeChecked();
}
export const pickType=(page:Page,kind:string)=>pick(page.getByRole('dialog'),'Тип мода',kind==='🅾️'?'🅾':kind);
/** Fill the editor for a new or existing group (dialog already open). */
export async function fillMod(page:Page,kind:string,tier:string,value:string,quantity:string,crit='0'){
  await pickType(page,kind);
  if(!kind.startsWith('raw'))await pick(page,'Уровень мода',tier);
  if(kind==='raw-green')await pick(page,'Параметр сырьевого мода',value);
  else if(!kind.startsWith('raw')){
    if(tier==='1'&&kind==='🅾')await pick(page,'Параметр мода',value);
    else if(tier!=='1'||kind==='💚')await page.getByLabel('Параметр мода',{exact:true}).fill(value);
  }
  if(['💢','🧿'].includes(kind))await page.getByLabel('Крит мода',{exact:true}).fill(crit);
  await page.getByLabel('Количество модов',{exact:true}).fill(quantity);
}
export async function add(page:Page,kind='🅾',tier='1',value='10',quantity='6'){
  await original(page);await page.getByRole('button',{name:'Добавить моды',exact:true}).click();
  await fillMod(page,kind,tier,value,quantity);await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();await saved(page);
}
export function group(page:Page,kind:Kind|string='🅾',tier:number|string=1,value='10'){return page.getByTestId('work-group').filter({hasText:displayKind(kind as Kind)+' '+(Number(tier)===0?'сырьевой':tier+'.0')+' · +'+value+'%'});}
export function originalGroup(page:Page,kind:Kind|string='🅾',tier:number|string=1,value='10'){return page.getByTestId('original-group').filter({hasText:displayKind(kind as Kind)+' '+(Number(tier)===0?'сырьевой':tier+'.0')+' · +'+value+'%'});}
export async function stock(g:Locator,total:string,worn?:string){
  await expect(g.getByTestId('stock')).toHaveText(total);
  if(worn===undefined)return;
  if(worn==='0')await expect(g.getByTestId('worn')).toHaveCount(0);else await expect(g.getByTestId('worn')).toHaveText('Надето '+worn);
}
/** The floating craft tray (mobile) may cover the last rows; scroll a row to the centre first, as a user would. */
export async function reach(l:Locator){await l.evaluate(e=>e.scrollIntoView({block:'center'}));return l;}
export async function openMod(g:Locator){await (await reach(g.getByRole('button',{name:/^Открыть мод /}))).click();await expect(g.page().getByRole('dialog',{name:'Экипировка группы'})).toBeVisible();}
export async function closeMod(page:Page){await page.getByRole('button',{name:'Закрыть примерку',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
export async function equip(page:Page,g:Locator,n:string){await openMod(g);await page.getByLabel('Надеть экземпляров (0 — снять)').fill(n);await page.getByRole('button',{name:'Применить экипировку'}).click();await saved(page);await expect(page.getByRole('dialog')).toHaveCount(0);}
export async function choose(g:Locator,n=3,worn=false){
  if(!worn){for(let i=0;i<n;i++)await (await reach(g.getByRole('button',{name:'В крафт',exact:true}))).click();return;}
  const page=g.page();await openMod(g);for(let i=0;i<n;i++)await page.getByRole('dialog').getByRole('button',{name:'В крафт с персонажа',exact:true}).click();await closeMod(page);
}
export async function apply(page:Page){await page.getByRole('button',{name:'Применить крафт',exact:true}).click();await saved(page);}
export const price=(page:Page)=>page.locator('[data-testid=craft-price]:visible');
export async function editOriginal(g:Locator){await g.getByRole('button',{name:/^Изменить /}).click();await expect(g.page().getByRole('dialog',{name:'Редактор модов'})).toBeVisible();}
export async function deleteOriginal(page:Page,g:Locator){await editOriginal(g);await page.getByRole('button',{name:'Удалить группу из исходного набора',exact:true}).click();await page.getByRole('button',{name:'Удалить группу',exact:true}).click();await saved(page);}
export async function capture(page:Page,replace=false){await original(page);await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();if(replace)await page.getByRole('button',{name:'Подтвердить фиксацию',exact:true}).click();await saved(page);}
export async function restore(page:Page){await original(page);await page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true}).click();await page.getByRole('button',{name:'Вернуть набор',exact:true}).click();await saved(page);}
export async function batchSource(page:Page,id:string,tier?:number){await craftMode(page,'Массовый фьюз');await selectChoice(page.getByLabel('Исходная группа',{exact:true}),id);if(tier!==undefined)await pick(page,'Целевой уровень',String(tier));}
/** 44px targets and no horizontal overflow or clipped exact numbers in the visible UI. */
export async function layoutChecks(page:Page,width:number){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(await page.locator('button,a.button,input,select,summary').evaluateAll(nodes=>nodes.filter(n=>{
    const e=n as HTMLElement,input=e as HTMLInputElement,target=(input.type==='radio'||input.type==='checkbox')?e.parentElement!:e,r=target.getBoundingClientRect(),style=getComputedStyle(e);
    return r.width&&r.height&&style.visibility!=='hidden'&&!e.closest('[inert]')&&(r.width<43.9||r.height<43.9);
  }).map(n=>n.getAttribute('aria-label')||n.textContent?.trim()))).toEqual([]);
  expect(await page.locator('.exact,.stat-value,.full-number').evaluateAll(nodes=>nodes.filter(n=>{
    const e=n as HTMLElement,s=getComputedStyle(e),r=e.getBoundingClientRect();if(e.closest('.sr-only'))return false;
    return r.width&&r.height&&(e.scrollWidth>e.clientWidth+1&&['hidden','clip'].includes(s.overflowX)||e.scrollHeight>e.clientHeight+1&&['hidden','clip'].includes(s.overflowY));
  }).map(n=>n.textContent))).toEqual([]);
}
