import {test,expect,type Page,type Locator} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
import {initData} from '../helpers.js';
import type {Group} from '@chm/rules';

test.use({baseURL:'http://localhost:3100'});
let sequence=0;
async function login(page:Page,id=(BigInt(Date.now())*1000n+BigInt(sequence++)).toString(),oidc=false,raw?:string) {
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':'192.0.2.'+(sequence%250+1)});
  await page.route('https://telegram.org/**',r=>r.abort());
  if(oidc){
    await page.route('**/auth/oidc/start',async r=>{
      const response=await r.fetch({maxRedirects:0}),u=new URL(response.headers().location!);
      expect(u.origin).toBe('https://oauth.telegram.org');u.searchParams.set('fixture_id',id);
      // Redirect only the browser provider hop to the isolated fixture. The
      // app still creates state/nonce/PKCE and cryptographically verifies JWT.
      await r.fulfill({response,headers:{...response.headers(),location:'http://localhost:3101/authorize?'+u.searchParams.toString()}});
    });
    await page.goto('/');await page.getByRole('link',{name:'Войти через Telegram'}).click();
  } else {
    await page.addInitScript(raw=>{Object.assign(window,{Telegram:{WebApp:{initData:raw,ready(){},expand(){}}}});},raw??initData(id));
    await page.goto('/');
  }
  await expect(page.getByRole('heading',{name:'Мастерская модов'})).toBeVisible();await saved(page);
  return id;
}
async function saved(page:Page) {await expect(page.getByRole('status')).toHaveText('Все изменения сохранены');}
async function add(page:Page,kind='🅾',tier='1',value='10',quantity='6') {
  await page.getByRole('button',{name:'Исходный набор',exact:true}).click();
  await page.getByRole('button',{name:'Добавить моды',exact:true}).click();
  await page.getByRole('combobox',{name:'Тип мода',exact:true}).selectOption(kind);await page.getByRole('combobox',{name:'Уровень мода',exact:true}).selectOption(tier);
  const parameter=page.getByRole(tier==='1'&&kind!=='💚'?'combobox':'textbox',{name:'Параметр мода',exact:true});if(tier==='1'&&kind!=='💚')await parameter.selectOption(value);else await parameter.fill(value);
  await page.getByLabel('Количество модов',{exact:true}).fill(quantity);await page.getByRole('button',{name:'Сохранить группу',exact:true}).click();await saved(page);
}
async function work(page:Page){await page.getByRole('button',{name:'Эксперимент',exact:true}).click();}
function group(page:Page,kind='🅾',tier='1',value='10'){return page.getByTestId('work-group').filter({hasText:kind+' '+tier+'.0 · +'+value+'%'});}
async function equip(page:Page,g:Locator,n:string){await g.getByRole('button',{name:'Примерить / снять',exact:true}).click();await page.getByLabel('Надеть экземпляров (0 — снять)').fill(n);await page.getByRole('button',{name:'Применить экипировку'}).click();await saved(page);}
async function choose(g:Locator,n=3,worn=false){for(let i=0;i<n;i++)await g.getByRole('button',{name:worn?'В крафт с персонажа':'В крафт',exact:true}).click();}
async function apply(page:Page){await page.getByRole('button',{name:'Применить крафт',exact:true}).click();await saved(page);}
async function level(page:Page,n:string){await page.getByLabel('Уровень игрока',{exact:true}).fill(n);await page.getByRole('button',{name:'Сохранить уровень'}).click();await saved(page);}
async function reset(page:Page){await page.getByRole('button',{name:'Сбросить эксперимент',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Подтвердить сброс',exact:true}).click();await saved(page);}
async function noOverflow(page:Page,width:number){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}

for(const width of [360,390])test('S-01–06: mobile craft, equipment, repeated undo, source isolation, reset '+width,async({page},testInfo)=>{
  await page.setViewportSize({width,height:800});const id=await login(page);await level(page,'200');
  await add(page);await work(page);await choose(group(page));
  await expect(page.getByTestId('craft-preview')).toContainText('+15%');await expect(page.getByTestId('craft-preview')).toContainText('84');await apply(page);
  await expect(group(page)).toContainText('В наборе: 3');await expect(group(page,'🅾','2','15')).toContainText('В наборе: 1');await expect(page.getByTestId('spent')).toHaveText('84');
  await page.screenshot({path:testInfo.outputPath('mobile-'+width+'.png'),fullPage:true});
  await choose(group(page));await apply(page);await expect(page.getByTestId('spent')).toHaveText('168');
  await page.getByRole('button',{name:/Отменить последний крафт/}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('84');
  await page.getByRole('button',{name:/Отменить последний крафт/}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('0');
  await equip(page,group(page),'3');await choose(group(page),3,true);await apply(page);await expect(page.getByTestId('equipped-count')).toHaveText('0 / 100');
  await equip(page,group(page,'🅾','2','15'),'1');await level(page,'101');
  await page.reload();await saved(page);await expect(page.getByTestId('spent')).toHaveText('84');
  await page.request.post('http://localhost:3101/restart');await page.reload();await saved(page);await expect(page.getByTestId('equipped-count')).toHaveText('1 / 100');
  await page.getByRole('button',{name:/Отменить последний крафт/}).click();await saved(page);await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');await expect(page.getByLabel('Уровень игрока',{exact:true})).toHaveValue('101');
  await page.getByRole('button',{name:'Исходный набор',exact:true}).click();await expect(page.getByTestId('original-group')).toContainText('Количество: 6');
  await page.getByTestId('original-group').getByRole('button',{name:'Изменить',exact:true}).click();await page.getByLabel('Количество модов',{exact:true}).fill('9');await page.getByRole('button',{name:'Сохранить группу'}).click();await saved(page);await work(page);await expect(group(page)).toContainText('В наборе: 6');
  await page.getByRole('button',{name:'Сбросить эксперимент',exact:true}).click();await page.getByRole('button',{name:'Не сбрасывать',exact:true}).click();await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');
  await reset(page);await expect(group(page)).toContainText('В наборе: 9');await expect(page.getByTestId('equipped-count')).toHaveText('0 / 100');await expect(page.getByRole('button',{name:/Отменить последний крафт/})).toBeDisabled();
  await noOverflow(page,width);
  // The same verified Telegram id via a distinct OIDC session sees this work.
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await expect(page.getByRole('link',{name:'Войти через Telegram'})).toBeVisible();
  // Existing initData script runs on reload; remove it by using a fresh context below.
  const context=await page.context().browser()!.newContext({baseURL:'http://localhost:3100',viewport:{width,height:800}});const second=await context.newPage();await login(second,id,true);await expect(group(second)).toContainText('В наборе: 9');await expect(second.getByLabel('Уровень игрока',{exact:true})).toHaveValue('101');await context.close();
});

test('S-02/03/05: exact stats and 100 equipped out of inventory >100',async({page})=>{
  await login(page);await level(page,'200');await add(page,'🅾','1','10','101');await add(page,'💢','1','8','2');await add(page,'🧿','1','8','1');await work(page);
  await equip(page,group(page),'1');await equip(page,group(page,'💢','1','8'),'1');await equip(page,group(page,'🧿','1','8'),'1');await expect(page.getByTestId('damage')).toHaveText('252');await expect(page.getByTestId('health')).toHaveText('200');
  await reset(page);await equip(page,group(page),'100');await expect(page.getByTestId('damage')).toHaveText('2200');
  await group(page).getByRole('button',{name:'Примерить / снять'}).click();await page.getByLabel('Надеть экземпляров (0 — снять)').fill('101');await page.getByRole('button',{name:'Применить экипировку'}).click();await expect(page.getByRole('alert')).toContainText('не больше 100');await expect(page.getByTestId('equipped-count')).toHaveText('100 / 100');await expect(page.getByTestId('damage')).toHaveText('2200');
  await page.getByRole('button',{name:'Закрыть примерку'}).click();await reset(page);await level(page,'101');await equip(page,group(page,'💢','1','8'),'1');await expect(page.getByTestId('damage')).toHaveText('110');await equip(page,group(page,'💢','1','8'),'2');await expect(page.getByTestId('damage')).toHaveText('118');
});

test('S-04: mixed parameters, all 20 prices and tier6 cannot craft',async({page})=>{
  await login(page);await add(page,'🅾','1','10','1');await add(page,'🅾','1','11','1');await add(page,'🅾','1','12','1');await work(page);
  for(const v of ['10','11','12'])await choose(group(page,'🅾','1',v),1);
  await expect(page.getByTestId('craft-preview')).toContainText('+17%');await apply(page);
  const prices={'🅾':['84','252','756','2268','6804'],'💢':['66','198','594','1782','5346'],'💚':['54','162','486','1458','4374'],'🧿':['72','216','648','1944','5832']};
  for(const [kind,values] of Object.entries(prices))for(let tier=1;tier<=5;tier++){
    const value=tier===1?(kind==='🅾'?'10':kind==='💚'?'15':'8'):'15';
    await add(page,kind,String(tier),value,'3');await work(page);await reset(page);
    // Duplicated source groups are possible; select the newest adequate group.
    const candidates=group(page,kind,String(tier),value).filter({hasText:'В наборе: 3'});await choose(candidates.first());
    await expect(page.getByTestId('craft-preview')).toContainText('Цена операции: '+values[tier-1]);
    if(tier===2)await expect(page.getByTestId('craft-preview')).toContainText('+23%');
    await apply(page);
  }
  await expect(page.getByTestId('work-group').filter({hasText:'6.0'}).first().getByRole('button',{name:'В крафт',exact:true})).toBeDisabled();
});

test('S-01: response lost after commit, same key replay, stale conflict and real SQLite failure',async({page})=>{
  const id=await login(page);await add(page);await work(page);await choose(group(page));
  let body='';await page.route('**/api/commands',async r=>{body=r.request().postData()!;await r.fetch();await r.abort('failed');},{times:1});
  await page.getByRole('button',{name:'Применить крафт',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Результат записи не подтверждён');
  await expect(page.getByRole('button',{name:'Применить крафт',exact:true})).toBeDisabled();
  page.once('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('status')).toContainText('команда с неподтверждённым результатом');
  await page.route('**/api/commands',async r=>{expect(r.request().postData()).toBe(body);await r.continue();},{times:1});
  await page.getByRole('button',{name:'Повторить ту же команду'}).click();await saved(page);await expect(page.getByTestId('spent')).toHaveText('84');await expect(group(page)).toContainText('В наборе: 3');
  const s=await (await page.request.get('/api/state')).json(),csrf=(await(await page.request.get('/api/session')).json()).csrf;
  await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':csrf},data:{key:randomUUID(),revision:s.revision,experiment:s.experiment,action:{type:'level',value:'300'}}});
  await levelAttempt(page,'200');await expect(page.getByRole('alert')).toContainText('другом окне');await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await expect(page.getByLabel('Уровень игрока',{exact:true})).toHaveValue('300');
  const db=new Database(process.env.CHM_BROWSER_DIR!+'/browser.sqlite');db.exec("CREATE TRIGGER fail_browser BEFORE UPDATE ON players WHEN OLD.owner='"+id+"' BEGIN SELECT RAISE(ABORT,'fixture private failure'); END");
  await levelAttempt(page,'400');await expect(page.getByRole('status')).toHaveText('Результат записи не подтверждён');await expect(page.getByTestId('damage')).not.toHaveText('400');
  db.exec('DROP TRIGGER fail_browser');db.close();await page.getByRole('button',{name:'Повторить ту же команду'}).click();await saved(page);await expect(page.getByLabel('Уровень игрока',{exact:true})).toHaveValue('400');
});

test('expired session recovers via signed Mini login and retains the exact pending action',async({page})=>{
  const id=await login(page),db=new Database(process.env.CHM_BROWSER_DIR!+'/browser.sqlite');
  db.prepare('UPDATE sessions SET expires=1 WHERE owner=?').run(id);db.close();
  await levelAttempt(page,'200');await expect(page.getByRole('heading',{name:'Ваш инвентарь. Ваш эксперимент.'})).toBeVisible();
  await page.getByRole('button',{name:'Войти в Mini App',exact:true}).click();await expect(page.getByRole('button',{name:'Повторить ту же команду'})).toBeVisible();
  await page.getByRole('button',{name:'Повторить ту же команду'}).click();await saved(page);await expect(page.getByTestId('damage')).toHaveText('200');
});

test('expired session on read shows login, and logout can finish after expiry',async({page})=>{
  const id=await login(page),db=new Database(process.env.CHM_BROWSER_DIR!+'/browser.sqlite');
  const expire=()=>db.prepare('UPDATE sessions SET expires=1 WHERE owner=?').run(id);
  expire();await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();
  await expect(page.getByRole('button',{name:'Войти в Mini App',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Мастерская модов'})).toHaveCount(0);
  await page.getByRole('button',{name:'Войти в Mini App',exact:true}).click();await saved(page);
  expire();db.close();await page.getByRole('button',{name:'Выйти',exact:true}).click();
  await expect(page.getByRole('button',{name:'Войти в Mini App',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Мастерская модов'})).toHaveCount(0);
});
async function levelAttempt(page:Page,n:string){await page.getByLabel('Уровень игрока',{exact:true}).fill(n);await page.getByRole('button',{name:'Сохранить уровень'}).click();}

test('S-02: large integers and derived 129 digits survive UI/API/reload; invalid health and deletion',async({page})=>{
  await login(page);const huge='9'.repeat(128);await level(page,'9007199254740993');await add(page,'💚','2',huge,'9');await work(page);await choose(group(page,'💚','2',huge));
  const derived=((BigInt(huge)*3n+1n)/2n).toString();await expect(page.getByTestId('craft-preview')).toContainText('+'+derived+'%');await apply(page);await equip(page,group(page,'💚','3',derived),'1');
  const health=((9007199254740993n*(100n+BigInt(derived))+99n)/100n).toString();await expect(page.getByTestId('health')).toHaveText(health);
  const api=(await(await page.request.get('/api/inventory?scope=work')).json()).items as Group[];expect(api.find(g=>g.tier===3)?.value).toBe(derived);
  await page.reload();await saved(page);await expect(page.getByTestId('health')).toHaveText(health);await noOverflow(page,360);await noOverflow(page,390);
  await page.getByRole('button',{name:'Исходный набор',exact:true}).click();await page.getByRole('button',{name:'Добавить моды'}).click();await page.getByRole('combobox',{name:'Тип мода',exact:true}).selectOption('💚');await page.getByLabel('Параметр мода',{exact:true}).fill('1.5');await page.getByRole('button',{name:'Сохранить группу'}).click();await expect(page.getByTestId('original-group')).toHaveCount(1);
  await page.getByRole('button',{name:'Закрыть редактор'}).click();page.once('dialog',d=>d.accept());await page.getByTestId('original-group').getByRole('button',{name:'Удалить',exact:true}).click();await saved(page);await expect(page.getByTestId('original-group')).toHaveCount(0);await work(page);await expect(page.getByTestId('work-group')).toHaveCount(2);
});

test('S-01/02: two users isolated and inventory pages have no game limit',async({page,browser})=>{
  await login(page);const csrf=(await(await page.request.get('/api/session')).json()).csrf;
  for(let i=0;i<205;i++){
    const state=await(await page.request.get('/api/state')).json();const r=await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':csrf},data:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'original.put',kind:'💚',tier:6,value:String(i+1),quantity:'1000000'}}});expect(r.ok()).toBeTruthy();
  }
  await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await expect(page.getByTestId('work-group')).toHaveCount(100);await page.getByRole('button',{name:'Загрузить ещё группы'}).click();await expect(page.getByTestId('work-group')).toHaveCount(200);await page.getByRole('button',{name:'Загрузить ещё группы'}).click();await expect(page.getByTestId('work-group')).toHaveCount(205);await expect(page.getByRole('button',{name:'Загрузить ещё группы'})).toHaveCount(0);
  const context=await browser.newContext({baseURL:'http://localhost:3100'}),other=await context.newPage();await login(other);await expect(other.getByTestId('work-group')).toHaveCount(0);await expect(other.getByTestId('damage')).toHaveText('1');await context.close();
});

test('shared cookies cannot replace signed Mini identity or leak data into an old tab',async({page,context})=>{
  const first=await login(page);await level(page,'200');await add(page);await work(page);
  const second=await context.newPage();await login(second);await expect(second.getByTestId('damage')).toHaveText('1');await expect(second.getByTestId('work-group')).toHaveCount(0);
  await page.getByRole('button',{name:'Загрузить сохранённые данные',exact:true}).click();await expect(page.getByRole('heading',{name:'Мастерская модов'})).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Учётная запись изменилась');
  await page.getByRole('button',{name:'Войти в Mini App',exact:true}).click();await saved(page);await expect(page.getByTestId('damage')).toHaveText('200');await expect(group(page)).toContainText('В наборе: 6');
  // Same account cookie rotation in another tab must not strand a stale CSRF.
  const same=await context.newPage();await login(same,first);await level(page,'201');await expect(page.getByTestId('damage')).toHaveText('201');
});

test('stale Mini reload binds same identity only; invalid context and logged-out flag read no inventory',async({page,context})=>{
  const id=await login(page);await level(page,'200');
  const stale=await context.newPage();await login(stale,id,false,initData(id,Math.floor(Date.now()/1000)-1000));await expect(stale.getByTestId('damage')).toHaveText('200');
  const other=(BigInt(id)+1n).toString(),bad=new URLSearchParams(initData(id));bad.set('user',JSON.stringify({id:other}));
  for(const [raw,url] of [[initData(other,Math.floor(Date.now()/1000)-1000),'/'],[bad.toString(),'/'],[initData(id,Math.floor(Date.now()/1000)+120),'/'],[initData(other),'/?logged_out=1']]){
    const p=await context.newPage();await p.route('https://telegram.org/**',r=>r.abort());await p.addInitScript(initData=>Object.assign(window,{Telegram:{WebApp:{initData}}}),raw!);
    let reads=0;p.on('request',r=>{if(/\/api\/(state|inventory)/.test(r.url()))reads++;});
    await p.goto(url!);await expect(p.getByRole('button',{name:'Войти в Mini App',exact:true})).toBeVisible();await expect(p.getByRole('heading',{name:'Мастерская модов'})).toHaveCount(0);expect(reads).toBe(0);await p.close();
  }
});
