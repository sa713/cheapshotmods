import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {type Group} from '@chm/rules';
import {initData} from '../helpers.js';
import {choose,craftMode,group,inCharacter,layoutChecks,loggedIn,nav,openMod,original,pickType,price,saved,status,view,work} from './ui.js';

test.use({baseURL:'http://localhost:3100'});
let sequence=0;
async function login(page:Page){
  const id=(BigInt(Date.now())*1000n+BigInt(sequence++)).toString();
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':'198.51.100.'+(sequence%250+1)});
  await page.route('https://telegram.org/**',r=>r.abort());
  await page.addInitScript(raw=>Object.assign(window,{Telegram:{WebApp:{initData:raw,ready(){},expand(){}}}}),initData(id));
  await page.goto('/');await expect(loggedIn(page)).toBeVisible();await saved(page);return id;
}
async function command(page:Page,action:Record<string,unknown>){
  const state=await(await page.request.get('/api/state')).json(),session=await(await page.request.get('/api/session')).json();
  const r=await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':session.csrf,'x-chm-account':session.account},data:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action}});
  expect(r.status()).toBe(200);return r.json();
}
async function inventory(page:Page){return (await(await page.request.get('/api/inventory?scope=work&limit=200')).json()).items as Group[];}
async function seedDemo(page:Page){
  await command(page,{type:'level',value:'200'});
  for(const [kind,value,quantity] of [['🅾','10','9'],['🅾','11','3'],['🅾','12','3'],['💢','8','12'],['🧿','8','6'],['💚','20','8']])await command(page,{type:'original.put',kind,tier:1,value,quantity,...(['💢','🧿'].includes(kind!)?{crit:'0'}:{})});
  await command(page,{type:'original.put',kind:'raw-green',tier:0,value:'6',quantity:'10'});await command(page,{type:'original.put',kind:'raw-green',tier:0,value:'7',quantity:'5'});
  const groups=await inventory(page);
  await command(page,{type:'equip',items:groups.filter(g=>(g.kind==='🅾'&&g.value==='10')||g.kind==='💢'||g.kind==='🧿').map(g=>({id:g.id,quantity:'1'}))});
  await page.reload();await saved(page);await expect(page.getByTestId('damage')).toHaveText('252');await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');
}
const visibleView=(page:Page)=>page.locator('.view:not([hidden])');

for(const width of [1440,360,390])test('redesigned layout and every main state stay usable '+width,async({page,browser},testInfo)=>{
  await page.setViewportSize({width,height:1000});await login(page);await seedDemo(page);
  await expect(page.getByTestId('health')).toHaveText('200');await expect(page.getByTestId('spent')).toHaveText('0');
  const desktop=width>=1100,content=(await page.locator('.content').boundingBox())!;
  if(desktop){
    const left=(await page.locator('.rail-left').boundingBox())!,right=(await page.locator('.rail-right').boundingBox())!;
    expect(left.x+left.width).toBeLessThanOrEqual(content.x);expect(right.x).toBeGreaterThanOrEqual(content.x+content.width);
    await expect(nav(page).getByRole('button',{name:'Персонаж',exact:true})).toBeHidden();await expect(page.locator('.stat-strip')).toHaveCount(0);
  } else {
    const bar=(await nav(page).boundingBox())!;expect(bar.y+bar.height).toBeGreaterThan(1000-80);
    await expect(page.locator('.rail-right')).toHaveCount(0);await expect(page.locator('.stat-strip')).toBeVisible();
  }
  const states:string[]=[];
  const capture=async(name:string,fullPage=true)=>{await layoutChecks(page,width);await page.screenshot({path:testInfo.outputPath(name+'.png'),fullPage});states.push(name);};
  const revision=(await(await page.request.get('/api/state')).json()).revision;
  await capture('experiment');
  for(let i=0;i<2;i++)await group(page).getByRole('button',{name:'В крафт',exact:true}).click();
  await group(page,'🅾',1,'11').getByRole('button',{name:'В крафт',exact:true}).click();
  await expect(price(page)).toHaveText('84');await expect(page.getByTestId('craft-preview')).toContainText('+16%');
  await expect(group(page,'🅾',1,'12').getByRole('button',{name:'В крафт',exact:true})).toBeDisabled();
  await capture('experiment-craft-tray',false);
  await openMod(group(page,'💢',1,'8'));await expect(page.locator('#app-shell')).toHaveAttribute('inert','');await capture('mod-sheet',false);await page.keyboard.press('Escape');
  await view(page,'Крафт');await expect(page.locator('#view-craft')).toBeFocused();await expect(nav(page).getByRole('button',{name:'Крафт',exact:true})).toHaveAttribute('aria-current','page');
  await expect(price(page)).toHaveText('84');await capture('craft-single');
  await craftMode(page,'Массовый фьюз');await capture('craft-batch');
  await craftMode(page,'Зелёные рецепты');await expect(page.getByTestId('green-preview')).toBeVisible();await capture('craft-green');
  await original(page);await capture('original');
  if(!desktop){await view(page,'Персонаж');await capture('character');}
  expect((await(await page.request.get('/api/state')).json()).revision).toBe(revision);
  await original(page);await page.getByRole('button',{name:'Добавить моды',exact:true}).click();await capture('editor',false);await page.keyboard.press('Escape');
  await inCharacter(page,async()=>{await page.getByRole('button',{name:'Сбросить эксперимент',exact:true}).click();await capture('reset-confirm',false);await page.getByRole('button',{name:'Не сбрасывать',exact:true}).click();});
  await work(page);await command(page,{type:'level',value:'201'});await page.getByRole('button',{name:'Применить крафт',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('другом окне');await expect(page.getByRole('button',{name:'Загрузить актуальные данные',exact:true})).toBeVisible();await capture('conflict',false);
  const darkContext=await browser.newContext({baseURL:'http://localhost:3100',viewport:{width,height:1000},colorScheme:'dark'}),dark=await darkContext.newPage();
  await login(dark);await seedDemo(dark);expect(await dark.evaluate(()=>getComputedStyle(document.body).backgroundColor)).not.toBe('rgb(243, 244, 246)');
  await layoutChecks(dark,width);await dark.screenshot({path:testInfo.outputPath('experiment-dark.png'),fullPage:true});states.push('experiment-dark');await darkContext.close();
  const emptyContext=await browser.newContext({baseURL:'http://localhost:3100',viewport:{width,height:1000}}),empty=await emptyContext.newPage();
  await login(empty);await expect(visibleView(empty).getByText('Модов пока нет',{exact:true})).toBeVisible();await layoutChecks(empty,width);await empty.screenshot({path:testInfo.outputPath('empty.png'),fullPage:true});states.push('empty');
  await empty.getByRole('button',{name:'Добавить первую группу',exact:true}).click();await expect(empty.getByRole('dialog',{name:'Редактор модов'})).toBeVisible();await empty.keyboard.press('Escape');
  await expect(nav(empty).getByRole('button',{name:'Исходный набор',exact:true})).toHaveAttribute('aria-current','page');await emptyContext.close();
  const loginPage=await browser.newPage({viewport:{width,height:1000}});await loginPage.route('https://telegram.org/**',r=>r.abort());await loginPage.goto('http://localhost:3100/?logged_out=1');
  await expect(loginPage.getByRole('link',{name:'Войти через Telegram'})).toBeVisible();await layoutChecks(loginPage,width);await loginPage.screenshot({path:testInfo.outputPath('login.png'),fullPage:true});states.push('login');await loginPage.close();
  writeFileSync(testInfo.outputPath('index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><title>Cheapshot Mods · '+width+'px</title><style>body{font:16px system-ui;margin:24px;background:#f3f4f6}section{margin:32px 0}img{max-width:100%;border:1px solid #ccc}</style><h1>Экраны нового интерфейса · '+width+'px</h1>'+states.map(name=>'<section><h2>'+name+'</h2><img alt="'+name+'" src="'+name+'.png"></section>').join('')+'</html>');
});

test('modal keyboard, inert background, focus restoration and pending retry inside editor',async({page})=>{
  await login(page);await original(page);const before=await(await page.request.get('/api/state')).json();
  const trigger=page.getByRole('button',{name:'Добавить моды',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Редактор модов',exact:true});await expect(dialog).toBeVisible();
  expect(await page.locator('#app-shell').evaluate(e=>(e as HTMLElement).inert)).toBe(true);
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<20;i++){await page.keyboard.press(key);expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);}
  await page.mouse.click(4,4);await expect(dialog).toBeVisible();expect((await(await page.request.get('/api/state')).json()).revision).toBe(before.revision);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  expect(await page.locator('#app-shell').evaluate(e=>(e as HTMLElement).inert)).toBe(false);
  await trigger.click();let payload='';
  await page.route('**/api/commands',async r=>{payload=r.request().postData()!;await r.fetch();await r.abort('failed');},{times:1});
  await dialog.getByRole('button',{name:'Сохранить группу',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Результат записи не подтверждён');
  await expect(dialog.getByRole('button',{name:'Сохранить группу',exact:true})).toBeDisabled();
  await page.route('**/api/commands',async r=>{expect(r.request().postData()).toBe(payload);await r.continue();},{times:1});
  await dialog.getByRole('button',{name:'Повторить ту же команду',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Все изменения сохранены');
  await dialog.getByRole('button',{name:'Закрыть редактор',exact:true}).click();await expect(page.getByTestId('original-group')).toHaveCount(1);
  const groups=await inventory(page);expect(groups).toHaveLength(1);expect(groups[0]!.quantity).toBe('1');
  // Successful commands confirm themselves without a modal; craft results offer an immediate undo.
  await work(page);await command(page,{type:'original.put',id:groups[0]!.id,kind:'🅾',tier:1,value:'10',quantity:'3'});await page.reload();await saved(page);
  await choose(group(page));await page.getByRole('button',{name:'Применить крафт',exact:true}).click();await saved(page);
  const toast=page.locator('.toast');await expect(toast).toContainText('Крафт применён');await toast.getByRole('button',{name:'Отменить',exact:true}).click();await saved(page);
  await expect(page.getByTestId('spent')).toHaveText('0');await expect(status(page)).toHaveText('Все изменения сохранены');
});

test('loaded filters keep pagination and full equipment outside the first page',async({page})=>{
  await login(page);
  for(let i=0;i<105;i++)await command(page,{type:'original.put',kind:'💚',tier:6,value:String(i+1),quantity:'10'});
  const all=await inventory(page),last=all.at(-1)!;
  await command(page,{type:'equip',items:[{id:last.id,quantity:'2'}]});await page.reload();await saved(page);
  const loaded=visibleView(page).locator('.loaded-count');
  await expect(page.getByTestId('work-group')).toHaveCount(100);await expect(loaded).toHaveText('Загружено групп: 100');
  expect(await group(page,last.kind,last.tier,last.value).count()).toBe(0);
  await inCharacter(page,async()=>{
    await page.getByText('Экипировка · 1 группа',{exact:true}).click();
    await page.getByRole('button',{name:'Снять / изменить',exact:true}).click();
  },false);
  await page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Применить экипировку',exact:true}).click();await saved(page);await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');
  await work(page);const filters=visibleView(page).getByRole('group',{name:'Типы загруженных модов'});await filters.getByRole('button',{name:'🅾️ Урон',exact:true}).click();
  await expect(visibleView(page).getByTestId('work-group')).toHaveCount(0);await expect(page.getByText('Модов пока нет',{exact:true})).toHaveCount(0);
  await expect(visibleView(page).getByText('Среди загруженных групп такого типа нет.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Загрузить ещё группы',exact:true}).click();await expect(loaded).toHaveText('Загружено групп: 105');
  await filters.getByRole('button',{name:'Все моды',exact:true}).click();await expect(page.getByTestId('work-group')).toHaveCount(105);
  await openMod(group(page,last.kind,last.tier,last.value));
  await expect(page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true})).toHaveValue('3');await page.keyboard.press('Escape');
});

test('128 digit inputs and 129 digit derived values stay fully visible in new layout',async({page},testInfo)=>{
  await login(page);const n='9'.repeat(128),derived=((BigInt(n)*3n+1n)/2n).toString();
  await command(page,{type:'level',value:n});await command(page,{type:'original.put',kind:'💚',tier:2,value:n,quantity:n});await page.reload();await saved(page);
  await openMod(group(page,'💚',2,n));
  await page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true}).fill('3');await page.getByRole('button',{name:'Применить экипировку',exact:true}).click();await saved(page);
  await choose(group(page,'💚',2,n),3,true);
  await expect(page.getByTestId('craft-preview')).toContainText('+'+derived+'%');
  for(const width of [1440,360,390]){
    await page.setViewportSize({width,height:1000});await work(page);await layoutChecks(page,width);
    await expect(page.locator('.level-form .full-number')).toContainText(n);
    const broken=async()=>page.locator('.exact,.stat-value,.slot strong').evaluateAll(nodes=>nodes.filter(n=>{
      const e=n as HTMLElement;if(e.closest('.sr-only'))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.scrollWidth>r.width+2;
    }).map(n=>n.className+':'+n.textContent!.slice(0,30)+':'+Math.round((n as HTMLElement).scrollWidth)+'/'+Math.round(n.getBoundingClientRect().width)));
    expect(await broken()).toEqual([]);
    await page.screenshot({path:testInfo.outputPath('exact-values-'+width+'.png'),fullPage:true,animations:'disabled',timeout:30000});
    await view(page,'Крафт');await layoutChecks(page,width);expect(await broken()).toEqual([]);
    await view(page,'Персонаж');await layoutChecks(page,width);expect(await broken()).toEqual([]);
  }
  await original(page);await page.getByRole('button',{name:'Добавить моды',exact:true}).click();await pickType(page,'💚');
  await page.getByLabel('Параметр мода',{exact:true}).fill(n);await page.getByLabel('Количество модов',{exact:true}).fill(n);
  await expect(page.getByRole('dialog').locator('.full-number')).toHaveCount(2);
  await layoutChecks(page,390);await page.screenshot({path:testInfo.outputPath('exact-editor.png'),fullPage:true});
});
