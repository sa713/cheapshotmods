import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {compareGroups,displayKind,displayTier,type Group} from '@chm/rules';
import {initData} from '../helpers.js';
import {craftMode,original,pick,saved as savedUi,status,undo as undoUi,work} from './ui.js';
import {kindInfo} from '../../apps/web/src/kinds.js';
test.use({baseURL:'http://localhost:3100',hasTouch:true});
let seq=0;
async function login(page:Page){const id=(BigInt(Date.now())*1000n+BigInt(seq++)).toString();await page.context().setExtraHTTPHeaders({'x-forwarded-for':'198.51.100.'+(seq%250+1)});await page.route('https://telegram.org/**',r=>r.abort());await page.addInitScript(data=>Object.assign(window,{Telegram:{WebApp:{initData:data,ready(){},expand(){}}}}),initData(id));await page.goto('/');await saved(page);}
const saved=savedUi;
async function state(page:Page){return (await page.request.get('/api/state')).json();}
async function command(page:Page,action:Record<string,unknown>){const s=await state(page),session=await(await page.request.get('/api/session')).json(),r=await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':session.csrf,'x-chm-account':session.account},data:{key:randomUUID(),revision:s.revision,experiment:s.experiment,action}});expect(r.status(),await r.text()).toBe(200);return r.json();}
async function add(page:Page,value:string,quantity:string){return command(page,{type:'original.put',kind:'raw-green',tier:0,value,quantity});}
async function refresh(page:Page){await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await expect(status(page)).toHaveText(/^(Все изменения сохранены|Сохранённые данные загружены)$/);}
async function seed(page:Page){await add(page,'6','10');await add(page,'7','6');await add(page,'8','8');await command(page,{type:'baseline.capture',replace:false});await refresh(page);await maximum(page,'5');await craftMode(page,'Зелёные рецепты');}
async function maximum(page:Page,n:string){await expect(page.getByTestId('green-maximum')).toHaveText('Максимум рецепта: '+n);await expect(page.getByTestId('green-loading')).toHaveCount(0);}
async function price(page:Page,n:string){await expect(page.getByTestId('green-preview')).toContainText('Полная цена рецепта: '+n+' 💎');await expect(page.getByTestId('green-loading')).toHaveCount(0);}
async function inventory(page:Page,scope='work'):Promise<Group[]>{return (await(await page.request.get('/api/inventory?scope='+scope+'&limit=200')).json()).items;}
const undo=undoUi;
async function menuBounds(page:Page,width:number){
  const box=await page.getByRole('listbox').boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.y+box!.height).toBeLessThanOrEqual(1000);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  // The menu is opaque and uses the same surface token as panels and dialogs.
  expect(await page.getByRole('listbox').evaluate(el=>{const probe=document.createElement('div');probe.style.background='var(--surface)';document.body.append(probe);const surface=getComputedStyle(probe).backgroundColor;probe.remove();return getComputedStyle(el).backgroundColor===surface&&surface!=='rgba(0, 0, 0, 0)';})).toBe(true);
  expect(await page.getByRole('listbox').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
}

for(const width of [360,390,1440])test('TASK009 editor choices by keyboard and touch, focus return; source menu stays in viewport '+width,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await login(page);await original(page);await page.getByRole('button',{name:'Добавить моды',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Редактор модов'}),types=dialog.getByRole('group',{name:'Тип мода',exact:true}),checked=(group:string)=>dialog.getByRole('group',{name:group,exact:true}).locator('input:checked');
  await expect(types.locator('input[value="🅾"]')).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(checked('Тип мода')).toHaveAttribute('value','raw-green');
  await expect(dialog.getByRole('group',{name:'Уровень мода',exact:true})).toHaveCount(0);const raw=dialog.getByRole('group',{name:'Параметр сырьевого мода',exact:true});
  await raw.locator('input[value="7"]').tap();await expect(checked('Параметр сырьевого мода')).toHaveAttribute('value','7');await raw.locator('input[value="7"]').focus();await page.keyboard.press('ArrowLeft');await expect(checked('Параметр сырьевого мода')).toHaveAttribute('value','6');
  await page.screenshot({path:info.outputPath('editor-choices-'+width+'.png')});
  await types.locator('input[value="🅾"]').tap();await expect(checked('Тип мода')).toHaveAttribute('value','🅾');
  expect(await dialog.getByRole('group',{name:'Уровень мода',exact:true}).locator('input').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(['1','2','3','4','5','6']);
  const value=dialog.getByRole('group',{name:'Параметр мода',exact:true});expect(await value.locator('input').evaluateAll(nodes=>nodes.map(n=>(n as HTMLInputElement).value))).toEqual(['9','10','11','12','13','14','15']);
  await value.locator('input[value="15"]').tap();await expect(checked('Параметр мода')).toHaveAttribute('value','15');
  await page.getByRole('button',{name:'Закрыть редактор',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Закрыть окно',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Добавить моды',exact:true})).toBeFocused();expect(await page.locator('select').count()).toBe(0);
  await command(page,{type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'6'});await refresh(page);await craftMode(page,'Массовый фьюз');const source=page.getByRole('combobox',{name:'Исходная группа',exact:true});await source.focus();await page.keyboard.press('Space');await expect(source).toHaveAttribute('aria-expanded','true');await menuBounds(page,width);
  expect(await page.getByRole('listbox').evaluate(el=>{const r=el.getBoundingClientRect();return !!document.elementFromPoint(r.x+20,r.y+20)?.closest('[role=listbox]');})).toBe(true);
  await page.keyboard.press('End');await page.keyboard.press('Enter');await expect(source).not.toHaveAttribute('data-value','');await expect(source).toBeFocused();
  await source.click();await page.keyboard.press('Escape');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(source).toBeFocused();
});

for(const width of [360,390,1440])test('TASK009 both green recipes, maxima/default/partial/clamp, batch undo and snapshot '+width,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await login(page);await seed(page);const point=(await state(page)).baseline,original=await inventory(page,'original');await expect(page.getByTestId('green-maxima')).toContainText('7 + 8 + 8 — 4');await price(page,'140');
  const count=page.getByLabel('Количество результатов рецепта',{exact:true});await expect(count).toHaveValue('5');await count.fill('2');await price(page,'56');await count.fill('999');await expect(page.getByRole('button',{name:'Применить зелёный рецепт',exact:true})).toBeDisabled();await count.blur();await expect(count).toHaveValue('5');await price(page,'140');
  await page.screenshot({path:info.outputPath('green-recipe-'+width+'.png')});
  await page.getByRole('button',{name:'Применить зелёный рецепт',exact:true}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('140');await expect(page.getByTestId('green-maxima')).toContainText('7 + 8 + 8 — 1');const out=(await inventory(page)).find(g=>g.kind==='🅾')!;expect([out.tier,out.value,out.quantity,out.crit]).toEqual([1,'10','5',null]);expect(await inventory(page,'original')).toEqual(original);expect((await state(page)).baseline).toEqual(point);
  await undo(page);await maximum(page,'5');await craftMode(page,'Зелёные рецепты');await pick(page,'Зелёный рецепт','green-788');await maximum(page,'4');await price(page,'112');await expect(count).toHaveValue('4');await page.getByRole('button',{name:'Применить зелёный рецепт',exact:true}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('112');const groups=await inventory(page);expect(groups.find(g=>g.kind==='🅾')!.value).toBe('12');expect(groups.find(g=>g.kind==='raw-green'&&g.value==='7')!.quantity).toBe('2');expect(groups.some(g=>g.kind==='raw-green'&&g.value==='8')).toBe(false);await undo(page);expect(await inventory(page)).toEqual(original);expect((await state(page)).baseline).toEqual(point);
});

test('TASK009 explicit worn green permission and free-first equipment restoration',async({page})=>{
  await login(page);await add(page,'6','4');const seven=await add(page,'7','3');await command(page,{type:'equip',items:[{id:seven.createdId,quantity:'2'}]});await refresh(page);await maximum(page,'1');await craftMode(page,'Зелёные рецепты');await page.getByLabel('Включить надетое сырьё',{exact:true}).check();await maximum(page,'2');await price(page,'56');await expect(page.getByTestId('green-preview').getByRole('row',{name:/^Зелёный 7/}).getByRole('cell').nth(2)).toHaveText('1');await page.getByRole('button',{name:'Применить зелёный рецепт',exact:true}).click();await saved(page);await expect(page.getByTestId('equipped-count')).toHaveText('1 / 100');expect((await state(page)).equippedMods[0].kind).toBe('raw-green');await undo(page);await expect(page.getByTestId('equipped-count')).toHaveText('2 / 100');
});

test('TASK009 zero shortage, invalid counts and stale stock never silently apply a smaller recipe',async({page})=>{
  await login(page);await add(page,'6','1');const seven=await add(page,'7','1');await refresh(page);await maximum(page,'0');await craftMode(page,'Зелёные рецепты');await expect(page.getByTestId('green-preview')).toContainText('не хватает сырья 6: 1');await expect(page.getByRole('button',{name:'Применить зелёный рецепт',exact:true})).toBeDisabled();await add(page,'6','9');await refresh(page);await maximum(page,'1');await craftMode(page,'Зелёные рецепты');
  for(const value of ['','0','-1','1.1']){await page.getByLabel('Количество результатов рецепта',{exact:true}).fill(value);await expect(page.getByRole('button',{name:'Применить зелёный рецепт',exact:true})).toBeDisabled();}
  await page.getByLabel('Количество результатов рецепта',{exact:true}).fill('1');await price(page,'28');await command(page,{type:'original.put',id:seven.createdId,kind:'raw-green',tier:0,value:'8',quantity:'1'});await page.getByRole('button',{name:'Применить зелёный рецепт',exact:true}).click();await expect(page.getByRole('alert')).toContainText('другом окне');await expect(page.getByTestId('spent')).toHaveText('0');await refresh(page);await maximum(page,'0');await expect(page.getByTestId('green-preview')).toContainText('не хватает сырья 7: 1');
});

test('TASK009 old recipe HTTP response cannot replace the current recipe preview',async({page})=>{
  await login(page);await seed(page);let entered:()=>void=()=>{},release:()=>void=()=>{},finished:()=>void=()=>{};const entry=new Promise<void>(r=>{entered=r;}),gate=new Promise<void>(r=>{release=r;}),done=new Promise<void>(r=>{finished=r;});
  await page.route('**/api/fuse-preview',async route=>{const body=route.request().postDataJSON();if(body.fuse.recipe==='green-788'){const response=await route.fetch();entered();await gate;await route.fulfill({response});finished();}else await route.continue();});
  await pick(page,'Зелёный рецепт','green-788');await entry;await expect(page.getByRole('button',{name:'Применить зелёный рецепт',exact:true})).toBeDisabled();await pick(page,'Зелёный рецепт','green-667');await maximum(page,'5');await price(page,'140');release();await done;await page.waitForLoadState('networkidle');await maximum(page,'5');await price(page,'140');await expect(page.getByTestId('green-preview')).toContainText('6 + 6 + 7');
});

test('TASK009 lost response and reload replay the exact recipe key/payload without duplicate output',async({page})=>{
  await login(page);await seed(page);await pick(page,'Зелёный рецепт','green-788');await maximum(page,'4');let body='';
  await page.route('**/api/commands',async r=>{body=r.request().postData()!;const response=await r.fetch();expect(response.ok()).toBeTruthy();await r.abort('failed');},{times:1});await page.getByRole('button',{name:'Применить зелёный рецепт',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Ответ не получен');const current=await state(page),groups=await inventory(page);expect(current.spent).toBe('112');await page.reload();await expect(status(page)).toContainText('неподтверждённым результатом');await page.route('**/api/commands',async r=>{expect(r.request().postData()).toBe(body);await r.continue();},{times:1});await page.getByRole('button',{name:'Повторить ту же команду',exact:true}).click();await saved(page);expect(await state(page)).toEqual(current);expect(await inventory(page)).toEqual(groups);
});

test('TASK009 global sorting precedes pagination, filters, source choices and mutation refresh; green stock is off-page',async({page},info)=>{
  await page.setViewportSize({width:390,height:1000});await login(page);
  for(let value=1;value<=110;value++)await command(page,{type:'original.put',kind:'🅾',tier:6,value:String(value),quantity:'1'});
  for(const [kind,tier,value,crit] of [['🅾',1,'10',null],['💢',3,'100','10'],['💢',3,'100','0'],['💚',6,'9',null],['💚',6,'100',null],['🧿',2,'100','100'],['raw-purple',0,'5','13'],['raw-red',0,'5','13']] as const)await command(page,{type:'original.put',kind,tier,value,crit,quantity:'9'});
  await add(page,'6','10');await add(page,'7','6');await add(page,'8','8');await refresh(page);await maximum(page,'5');await expect(page.getByTestId('work-group')).toHaveCount(100);expect((await inventory(page)).slice(0,100).some(g=>g.kind==='raw-green')).toBe(false);
  const source=page.getByRole('combobox',{name:'Исходная группа',exact:true});await craftMode(page,'Массовый фьюз');await source.click();await expect(page.getByRole('option')).toHaveCount(101);await menuBounds(page,390);expect(await page.getByRole('listbox').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);await page.keyboard.press('End');await expect(page.getByRole('listbox')).toBeVisible();await page.screenshot({path:info.outputPath('long-source-menu-390.png')});await page.keyboard.press('Escape');
  await command(page,{type:'level',value:'307'});await work(page);await page.getByRole('button',{name:'Загрузить ещё группы',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Набор изменился');await expect(page.getByTestId('work-group')).toHaveCount(100);await expect(page.getByRole('button',{name:'Применить зелёный рецепт',exact:true,includeHidden:true})).toBeDisabled();await refresh(page);
  await page.getByRole('button',{name:'Загрузить ещё группы',exact:true}).click();const groups=(await inventory(page)).sort(compareGroups);await expect(page.getByTestId('work-group')).toHaveCount(groups.length);await expect(page.getByTestId('work-group').locator('.mod-title .sr-only')).toHaveText(groups.map(g=>displayKind(g.kind)+' '+displayTier(g)+' · +'+g.value+'%'));
  await page.getByRole('button',{name:'Зелёный сырьевой '+kindInfo['raw-green'].effect,exact:true}).click();await expect(page.getByTestId('work-group')).toHaveCount(3);await expect(page.getByTestId('work-group').locator('.mod-title .sr-only')).toHaveText(['8','7','6'].map(v=>'Зелёный сырьевой сырьевой · +'+v+'%'));await page.getByRole('button',{name:'Все моды',exact:true}).click();
  await command(page,{type:'original.put',kind:'🅾',tier:6,value:'9007199254740993',quantity:'1'});await refresh(page);await expect(page.getByTestId('work-group')).toHaveCount(100);await expect(page.getByTestId('work-group').first()).toContainText('+9007199254740993%');await craftMode(page,'Массовый фьюз');await source.click();const expected=(await inventory(page)).slice(0,100).map(g=>g.id);expect(await page.getByRole('option').evaluateAll(nodes=>nodes.slice(1).map(n=>n.getAttribute('data-value')))).toEqual(expected);await page.keyboard.press('Escape');
});
