import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {initData} from '../helpers.js';
import type {Group} from '@chm/rules';
import {add as addGroup,apply,batchSource,capture,choose,craftMode,editOriginal,equip,group,layoutChecks,level,loggedIn,original as toOriginal,pick,refresh,reset,restore,saved,status,undoDisabled,view,work} from './ui.js';
test.use({baseURL:'http://localhost:3100'});
let seq=0;
async function login(page:Page,id=(BigInt(Date.now())*1000n+BigInt(seq++)).toString(),oidc=false){
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':'203.0.113.'+(seq%250+1)});await page.route('https://telegram.org/**',r=>r.abort());
  if(oidc){await page.route('**/auth/oidc/start',async r=>{const response=await r.fetch({maxRedirects:0}),u=new URL(response.headers().location!);u.searchParams.set('fixture_id',id);await r.fulfill({response,headers:{...response.headers(),location:'http://localhost:3101/authorize?'+u.searchParams.toString()}});});await page.goto('/');await page.getByRole('link',{name:'Войти через Telegram'}).click();}
  else{await page.addInitScript(initData=>Object.assign(window,{Telegram:{WebApp:{initData,ready(){},expand(){}}}}),initData(id));await page.goto('/');}
  await expect(loggedIn(page)).toBeVisible();await saved(page);return id;
}
async function state(page:Page){return (await page.request.get('/api/state')).json();}
async function inventory(page:Page,scope='work'):Promise<Group[]>{return (await(await page.request.get('/api/inventory?scope='+scope+'&limit=200')).json()).items;}
async function command(page:Page,action:Record<string,unknown>){const s=await state(page),session=await(await page.request.get('/api/session')).json();const r=await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':session.csrf,'x-chm-account':session.account},data:{key:randomUUID(),revision:s.revision,experiment:s.experiment,action}});expect(r.status()).toBe(200);return r.json();}
const add=(page:Page,kind='🅾',tier='1',value='10',quantity='20')=>addGroup(page,kind,tier,value,quantity);
const checks=layoutChecks;

for(const width of [360,390,1440])test('TASK008 explicit capture, batch, edit, ordinary reset and full return '+width,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await login(page);await toOriginal(page);await expect(page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true})).toBeDisabled();await expect(page.getByText('Сначала зафиксируйте исходный набор',{exact:true})).toBeVisible();
  await add(page);const original=await inventory(page,'original'),id=original[0]!.id;await capture(page);await expect(page.getByTestId('baseline-quantity')).toHaveText('20');const point=(await state(page)).baseline;
  await batchSource(page,id,3);await expect(page.getByTestId('batch-maximum')).toHaveText('Максимум: 2');await page.getByRole('button',{name:'Применить пакет',exact:true}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('1008');expect(await inventory(page,'original')).toEqual(original);expect((await state(page)).baseline).toEqual(point);
  await work(page);const g=page.getByTestId('work-group').filter({hasText:'+10%'});await equip(page,g,'2');await level(page,'307');
  await add(page,'💚','2','12','3');await editOriginal(page.getByTestId('original-group').filter({hasText:'+10%'}));await pick(page,'Параметр мода','11');await page.getByLabel('Количество модов',{exact:true}).fill('8');await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();await saved(page);const current=await inventory(page,'original');await reset(page);expect(await inventory(page)).toEqual(current);expect((await state(page)).baseline).toEqual(point);
  const before=await state(page);await toOriginal(page);await page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Моды и правки после фиксации будут удалены');await expect(page.getByRole('button',{name:'Не возвращать',exact:true})).toBeFocused();await page.keyboard.press('Escape');expect(await state(page)).toEqual(before);
  await restore(page);expect(await inventory(page,'original')).toEqual(original);expect(await inventory(page)).toEqual(original);await expect(page.getByTestId('spent')).toHaveText('0');await expect(page.getByTestId('equipped-count')).toHaveText('0 / 100');await expect(page.getByLabel('Уровень игрока',{exact:true})).toHaveValue('307');await undoDisabled(page);expect((await state(page)).baseline).toEqual(point);expect((await state(page)).experiment).not.toBe(before.experiment);
  await page.reload();await saved(page);await expect(page.getByTestId('baseline-quantity')).toHaveText('20');await checks(page,width);await page.screenshot({path:info.outputPath('baseline-return-'+width+'.png'),fullPage:true});
});

test('TASK008 empty snapshot and confirmed replacement persist without changing active experiment',async({page})=>{
  await login(page);await capture(page);await expect(page.getByTestId('baseline-quantity')).toHaveText('0');const empty=(await state(page)).baseline;await add(page,'raw-green','0','10','9');await work(page);const g=page.getByTestId('work-group');for(let i=0;i<3;i++)await g.getByRole('button',{name:'В крафт',exact:true}).click();await page.getByRole('button',{name:'Применить крафт',exact:true}).click();await saved(page);expect((await state(page)).baseline).toEqual(empty);
  const active=await state(page),working=await inventory(page);await toOriginal(page);await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();await expect(page.getByRole('button',{name:'Не заменять',exact:true})).toBeFocused();await page.getByRole('button',{name:'Не заменять',exact:true}).click();expect(await state(page)).toEqual(active);await restore(page);expect(await inventory(page)).toEqual([]);expect(await inventory(page,'original')).toEqual([]);expect((await state(page)).baseline).toEqual(empty);
  await add(page);await work(page);const id=(await inventory(page))[0]!.id;await command(page,{type:'craft',items:[{id,quantity:'3',worn:'0'}]});await refresh(page);const before=await state(page);await capture(page,true);const after=await state(page);expect({...after,revision:before.revision,baseline:before.baseline}).toEqual(before);expect(await inventory(page)).not.toEqual(working);expect(after.baseline.quantity).toBe('20');await restore(page);expect((await inventory(page))[0]!.quantity).toBe('20');
});

test('confirmed capture and apply immediately updates the single and batch craft menus',async({page})=>{
  await login(page);await add(page);await capture(page);
  await work(page);await choose(group(page));await apply(page);
  await equip(page,group(page),'2');await level(page,'307');
  await toOriginal(page);
  await editOriginal(page.getByTestId('original-group'));
  await pick(page,'Параметр мода','11');
  await page.getByLabel('Количество модов',{exact:true}).fill('9');
  await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();await saved(page);
  const fresh=(await inventory(page,'original'))[0]!,previous=await state(page);
  await craftMode(page,'Три в один');
  await expect(page.getByTestId('craft-pick')).toHaveCount(2);
  await expect(page.getByTestId('craft-pick').first()).toContainText('+15%');
  await toOriginal(page);
  await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Подтверждение фиксации набора',exact:true});
  await expect(dialog).toContainText('История крафтов, экипировка и расход обнулятся');
  await dialog.getByRole('button',{name:'Зафиксировать и обновить крафт',exact:true}).click();
  await saved(page);await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('baseline-quantity')).toHaveText('9');
  const current=await state(page);
  expect(current.level).toBe('307');expect(current.spent).toBe('0');expect(current.equipment).toEqual([]);
  expect(current.lastCraft).toBeNull();expect(current.experiment).not.toBe(previous.experiment);
  await craftMode(page,'Три в один');
  await expect(page.getByTestId('craft-pick')).toHaveCount(1);
  await expect(page.getByTestId('craft-pick')).toContainText('+11%');
  await expect(page.getByTestId('craft-pick')).toContainText('свободно 9');
  await batchSource(page,fresh.id,2);
  await expect(page.getByTestId('batch-maximum')).toHaveText('Максимум: 3');
  await page.reload();await saved(page);await craftMode(page,'Три в один');
  await expect(page.getByTestId('craft-pick')).toHaveCount(1);
  await expect(page.getByTestId('craft-pick')).toContainText('+11%');
});

test('TASK008 captures unloaded pages and huge counts; snapshot is shared between site and Mini owner',async({page,browser})=>{
  const id=await login(page),big='9'.repeat(128);for(let i=0;i<104;i++)await command(page,{type:'original.put',kind:'💚',tier:2,value:String(i+1),quantity:'1'});await command(page,{type:'original.put',kind:'💚',tier:6,value:big,quantity:big});await refresh(page);await toOriginal(page);await expect(page.getByTestId('original-group')).toHaveCount(100);await capture(page);await expect(page.getByTestId('baseline-quantity')).toHaveText((BigInt(big)+104n).toString());await checks(page,360);
  const otherContext=await browser.newContext({baseURL:'http://localhost:3100'}),site=await otherContext.newPage();try{
    await login(site,id,true);expect((await state(site)).baseline).toEqual((await state(page)).baseline);await restore(site);await page.reload();await saved(page);await toOriginal(page);await page.getByRole('button',{name:'Загрузить ещё группы',exact:true}).click();await expect(page.getByTestId('original-group')).toHaveCount(105);expect(await inventory(page,'original')).toHaveLength(105);expect(await inventory(page)).toHaveLength(105);
  }finally{await otherContext.close();}
});

test('TASK008 stale capture/restore require refresh and another confirmation; old state shape remains usable',async({page})=>{
  await login(page);await add(page);await command(page,{type:'original.put',kind:'💚',tier:2,value:'12',quantity:'3'});await toOriginal(page);await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();await expect(page.getByRole('alert')).toContainText('другом окне');expect((await state(page)).baseline).toBeNull();await refresh(page);await capture(page);await page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true}).click();await command(page,{type:'original.put',kind:'💚',tier:2,value:'13',quantity:'5'});await page.getByRole('button',{name:'Вернуть набор',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('другом окне');expect(await inventory(page,'original')).toHaveLength(3);await page.getByRole('dialog').getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await page.getByRole('button',{name:'Не возвращать',exact:true}).click();expect(await inventory(page,'original')).toHaveLength(3);await restore(page);expect(await inventory(page,'original')).toHaveLength(2);
  await page.route('**/api/state',async r=>{const response=await r.fetch(),s=await response.json();delete s.baseline;await r.fulfill({response,json:s});});await page.reload();await saved(page);await toOriginal(page);await expect(page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true})).toBeDisabled();await expect(page.getByText('Сначала зафиксируйте исходный набор',{exact:true})).toBeVisible();await view(page,'Персонаж');await expect(page.getByRole('button',{name:'Сбросить эксперимент',exact:true})).toBeEnabled();
});

for(const action of ['capture','restore'])test('TASK008 '+action+' lost response, reload and exact retry preserve subsequent changes',async({page})=>{
  await login(page);await add(page);if(action==='restore'){await capture(page);await add(page,'💚','2','12','3');}await toOriginal(page);
  let body='';await page.route('**/api/commands',async r=>{body=r.request().postData()!;expect(JSON.parse(body).action.type).toBe('baseline.'+action);await r.fetch();await r.abort('failed');},{times:1});
  if(action==='capture')await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();else{await page.getByRole('button',{name:'Сбросить набор модов к исходному',exact:true}).click();await page.getByRole('button',{name:'Вернуть набор',exact:true}).click();}
  await expect(page.getByRole('alert')).toContainText('Ответ не получен');await command(page,{type:'original.put',kind:'💚',tier:2,value:'15',quantity:'5'});if(action==='capture')await command(page,{type:'baseline.capture',replace:true});const before=await state(page),original=await inventory(page,'original');
  await page.reload();await expect(status(page)).toContainText('неподтверждённым результатом');await page.route('**/api/commands',async r=>{expect(r.request().postData()).toBe(body);await r.continue();},{times:1});await page.getByRole('button',{name:'Повторить ту же команду',exact:true}).click();await saved(page);expect(await state(page)).toEqual(before);expect(await inventory(page,'original')).toEqual(original);
});

test('TASK008 server save failure stays pending and never claims snapshot success',async({page})=>{
  await login(page);await add(page);await page.route('**/api/commands',r=>r.fulfill({status:500,json:{error:'SERVER_ERROR'}}),{times:1});await page.getByRole('button',{name:'Зафиксировать исходный набор модов',exact:true}).click();await expect(status(page)).toHaveText('Результат записи не подтверждён');expect((await state(page)).baseline).toBeNull();await expect(page.getByText('Сначала зафиксируйте исходный набор',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Повторить ту же команду',exact:true}).click();await saved(page);await expect(page.getByTestId('baseline-quantity')).toHaveText('20');
});
