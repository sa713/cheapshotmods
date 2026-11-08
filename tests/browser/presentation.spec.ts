import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {displayKind,type Group,type Kind} from '@chm/rules';
import {initData} from '../helpers.js';

test.use({baseURL:'http://localhost:3100'});
let sequence=0;
async function login(page:Page){
  const id=(BigInt(Date.now())*1000n+BigInt(sequence++)).toString();
  await page.context().setExtraHTTPHeaders({'x-forwarded-for':'198.51.100.'+(sequence%250+1)});
  await page.route('https://telegram.org/**',r=>r.abort());
  await page.addInitScript(raw=>Object.assign(window,{Telegram:{WebApp:{initData:raw,ready(){},expand(){}}}}),initData(id));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Мастерская модов',exact:true})).toBeVisible();return id;
}
async function command(page:Page,action:Record<string,unknown>){
  const state=await(await page.request.get('/api/state')).json(),session=await(await page.request.get('/api/session')).json();
  const r=await page.request.post('/api/commands',{headers:{origin:'http://localhost:3100','x-csrf-token':session.csrf,'x-chm-account':session.account},data:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action}});
  expect(r.status()).toBe(200);return r.json();
}
async function inventory(page:Page){return (await(await page.request.get('/api/inventory?scope=work&limit=200')).json()).items as Group[];}
function group(page:Page,kind='🅾',tier=1,value='10'){return page.getByTestId('work-group').filter({hasText:displayKind(kind as Kind)+' '+tier+'.0 · +'+value+'%'});}
async function seedDemo(page:Page){
  await command(page,{type:'level',value:'200'});
  for(const [kind,value,quantity] of [['🅾','10','9'],['🅾','11','3'],['🅾','12','3'],['💢','8','12'],['🧿','8','6'],['💚','20','8']])await command(page,{type:'original.put',kind,tier:1,value,quantity,...(['💢','🧿'].includes(kind!)?{crit:'0'}:{})});
  const groups=await inventory(page);
  await command(page,{type:'equip',items:groups.filter(g=>(g.kind==='🅾'&&g.value==='10')||g.kind==='💢'||g.kind==='🧿').map(g=>({id:g.id,quantity:'1'}))});
  await page.reload();await expect(page.getByTestId('damage')).toHaveText('252');await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');
}
async function noOverflow(page:Page,width:number){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const clipped=await page.locator('.exact:not(.sr-only .exact), .stat-value, .full-number').evaluateAll(nodes=>nodes.filter(n=>{
    const e=n as HTMLElement,style=getComputedStyle(e),r=e.getBoundingClientRect();
    return r.width>0&&r.height>0&&(e.scrollWidth>e.clientWidth+1&&['hidden','clip'].includes(style.overflowX)||e.scrollHeight>e.clientHeight+1&&['hidden','clip'].includes(style.overflowY));
  }).map(n=>n.className));
  expect(clipped).toEqual([]);
}
async function targets(page:Page){
  const small=await page.locator('button,a.button,input,select,summary').evaluateAll(nodes=>nodes.filter(n=>{
    const e=n as HTMLElement,r=e.getBoundingClientRect(),style=getComputedStyle(e);
    return r.width>0&&r.height>0&&style.visibility!=='hidden'&&!e.closest('[inert]')&&(r.width<43.9||r.height<43.9);
  }).map(n=>({text:n.textContent?.trim(),label:n.getAttribute('aria-label'),width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
  expect(small).toEqual([]);
}

for(const width of [1440,360,390])test('Sites reference and real app visual states '+width,async({page,browser},testInfo)=>{
  await page.setViewportSize({width,height:1000});await login(page);await seedDemo(page);
  await expect(page.getByTestId('health')).toHaveText('200');await expect(page.getByTestId('spent')).toHaveText('0');
  const tokens=JSON.parse(readFileSync('.delivery/design/sites-v1/tokens.json','utf8')) as {colors:{background:string;accent:string}};
  expect(await page.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--bg').trim())).toBe(tokens.colors.background);
  expect(await page.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--lime').trim())).toBe(tokens.colors.accent);
  const build=(await page.locator('.build-card').boundingBox())!,list=(await page.locator('.inventory-section').boundingBox())!;
  if(width===1440){expect((await page.locator('.sidebar').boundingBox())!.width).toBe(226);expect(build.width).toBe(292);expect(build.x).toBeGreaterThan(list.x+list.width);}
  else {await expect(page.locator('.sidebar')).toBeHidden();expect(build.width).toBe(list.width);expect(build.y).toBeLessThan(list.y);}
  const reference=await browser.newPage({viewport:{width,height:1000}});
  await reference.goto(pathToFileURL(resolve('.delivery/design/sites-v1/preview.html')).href);
  // Only the reference switcher is hidden; no app content/styles are modified.
  await reference.addStyleTag({content:'.reference-tools{display:none!important}'});
  const refView=async(value:string)=>reference.getByLabel('Экран эталона').evaluate((el,value)=>{(el as HTMLSelectElement).value=value;el.dispatchEvent(new Event('change'));},value);
  const states:string[]=[];
  const capture=async(name:string)=>{
    await noOverflow(page,width);await targets(page);
    await page.evaluate(()=>window.scrollTo(0,0));await reference.evaluate(()=>window.scrollTo(0,0));
    const fullPage=name!=='editor'&&name!=='reset';
    await page.screenshot({path:testInfo.outputPath('app-'+name+'.png'),fullPage});
    await reference.screenshot({path:testInfo.outputPath('reference-'+name+'.png'),fullPage});states.push(name);
  };
  const navigationRevision=(await(await page.request.get('/api/state')).json()).revision;
  if(width===1440){const nav=page.getByRole('navigation',{name:'Лаборатория',exact:true});await nav.getByRole('button',{name:'Мой инвентарь',exact:true}).click();await expect(page.getByTestId('original-group')).toHaveCount(6);await nav.getByRole('button',{name:'Примерка',exact:true}).click();await expect(page.getByTestId('work-group')).toHaveCount(6);}
  await page.getByRole('button',{name:'Исходный набор',exact:true}).click();await refView('inventory');await capture('inventory');
  await page.getByRole('button',{name:'Эксперимент',exact:true}).click();await refView('equip');await capture('equip');
  for(let i=0;i<3;i++)await group(page).getByRole('button',{name:'В крафт',exact:true}).click();
  await expect(page.getByTestId('craft-preview')).toContainText('Цена операции: 84');
  await page.getByRole('button',{name:'Крафт',exact:true}).click();await expect(page.locator('#craft-panel')).toBeFocused();
  expect((await(await page.request.get('/api/state')).json()).revision).toBe(navigationRevision);
  await refView('craft');await capture('craft');
  await page.getByRole('button',{name:'Добавить моды',exact:true}).click();
  await refView('inventory');await reference.locator('#editor').evaluate((d:HTMLDialogElement)=>d.showModal());
  await capture('editor');await page.keyboard.press('Escape');await reference.locator('#editor').evaluate((d:HTMLDialogElement)=>d.close());
  await page.getByRole('button',{name:'Эксперимент',exact:true}).click();await page.getByRole('button',{name:'Сбросить эксперимент',exact:true}).click();
  // Frozen HTML has no reset/error DOM. These two reference-only states use
  // its unchanged .modal/.confirm-text/.error-banner CSS and actual app copy.
  await refView('equip');await reference.evaluate(()=>{
    const d=document.createElement('dialog');d.className='modal';d.id='reference-confirm';
    d.innerHTML='<div class="modal-head"><h2>Начать эксперимент заново?</h2></div><p class="confirm-text">Заменить рабочий набор актуальным исходным? Экипировка, история крафтов и расход обнулятся. Уровень игрока сохранится.</p><div class="modal-actions"><button class="button primary">Подтвердить сброс</button><button class="button">Не сбрасывать</button></div>';
    document.body.append(d);d.showModal();
  });await capture('reset');
  await page.getByRole('button',{name:'Не сбрасывать',exact:true}).click();await reference.locator('#reference-confirm').evaluate((d:HTMLDialogElement)=>d.remove());
  await group(page,'🅾',1,'11').getByRole('button',{name:'В крафт',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Выберите ровно три экземпляра для крафта.');await refView('craft');
  await reference.evaluate(()=>{const b=document.createElement('div');b.className='error-banner';b.innerHTML='<strong>Выберите ровно три экземпляра для крафта.</strong>';document.querySelector('.workspace')!.prepend(b);});await capture('error');
  const emptyContext=await browser.newContext({baseURL:'http://localhost:3100',viewport:{width,height:1000}}),empty=await emptyContext.newPage();
  await login(empty);await refView('empty');await reference.locator('.error-banner').evaluate(e=>e.remove());
  await noOverflow(empty,width);await targets(empty);await empty.screenshot({path:testInfo.outputPath('app-empty.png'),fullPage:true});await reference.screenshot({path:testInfo.outputPath('reference-empty.png'),fullPage:true});states.push('empty');
  await emptyContext.close();await reference.close();
  writeFileSync(testInfo.outputPath('comparison.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><title>Sites и приложение '+width+'</title><style>body{font:16px system-ui;background:#111312;color:#f0f3ed;margin:24px}section{margin:40px 0}div{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;border:1px solid #2b302c}p{line-height:1.6}</style><h1>Sites v1 / настоящий app · '+width+'px</h1><p>Слева эталон, справа реальный React/HTTP/SQLite со signed synthetic Telegram. Одинаковые6групп/уровень200/экипировка3/252урон/200HP. Фиксированный switcher эталона скрыт. Прокрутка нормализована к началу; editor/reset сняты в viewport, прочие состояния целиком. Reset/error DOM дополнены только в reference browser с frozen CSS; эталон в Git не менялся. App actions/числа не подменялись. Отличия:44px controls/читаемые подписи, актуальные тексты и все дополнительные действия, честное количество загруженных групп. Порядок строк app следует server IDs.</p>'+states.map(name=>'<section><h2>'+name+'</h2><div><img alt="Эталон '+name+'" src="reference-'+name+'.png"><img alt="Приложение '+name+'" src="app-'+name+'.png"></div></section>').join('')+'</html>');
});

test('modal keyboard, inert background, focus restoration and pending retry inside editor',async({page})=>{
  await login(page);const before=await(await page.request.get('/api/state')).json();
  const trigger=page.getByRole('button',{name:'Добавить моды',exact:true});await trigger.click();
  const dialog=page.getByRole('dialog',{name:'Редактор модов',exact:true});await expect(dialog).toBeVisible();
  expect(await page.locator('#app-shell').evaluate(e=>(e as HTMLElement).inert)).toBe(true);
  for(const key of ['Tab','Shift+Tab'])for(let i=0;i<20;i++){await page.keyboard.press(key);expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);}
  await page.mouse.click(4,4);expect((await(await page.request.get('/api/state')).json()).revision).toBe(before.revision);
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
});

test('loaded filters keep pagination and full equipment outside the first page',async({page})=>{
  await login(page);
  for(let i=0;i<105;i++)await command(page,{type:'original.put',kind:'💚',tier:6,value:String(i+1),quantity:'10'});
  const all=await inventory(page),last=all.at(-1)!;
  await command(page,{type:'equip',items:[{id:last.id,quantity:'2'}]});await page.reload();
  await expect(page.getByTestId('work-group')).toHaveCount(100);await expect(page.getByText('Загружено групп: 100',{exact:true})).toBeVisible();
  expect(await group(page,last.kind,last.tier,last.value).count()).toBe(0);
  await page.getByText('Вся экипировка · 2 / 100',{exact:true}).click();
  await page.getByRole('button',{name:'Снять / изменить',exact:true}).click();await page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true}).fill('3');
  await page.getByRole('button',{name:'Применить экипировку',exact:true}).click();await expect(page.getByTestId('equipped-count')).toHaveText('3 / 100');
  const filters=page.getByLabel('Типы загруженных модов');await filters.getByRole('button',{name:'🅾️ Урон',exact:true}).click();
  await expect(page.getByTestId('work-group')).toHaveCount(0);await expect(page.getByText('Модов пока нет',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Среди загруженных групп такого типа нет.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Загрузить ещё группы',exact:true}).click();await expect(page.getByText('Загружено групп: 105',{exact:true})).toBeVisible();
  await filters.getByRole('button',{name:'Все моды',exact:true}).click();await expect(page.getByTestId('work-group')).toHaveCount(105);
  await group(page,last.kind,last.tier,last.value).getByRole('button',{name:'Примерить / снять',exact:true}).click();
  await expect(page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true})).toHaveValue('3');await page.keyboard.press('Escape');
});

test('128 digit inputs and 129 digit derived values stay fully visible in new layout',async({page},testInfo)=>{
  await login(page);const n='9'.repeat(128),derived=((BigInt(n)*3n+1n)/2n).toString();
  await command(page,{type:'level',value:n});await command(page,{type:'original.put',kind:'💚',tier:2,value:n,quantity:n});await page.reload();
  await group(page,'💚',2,n).getByRole('button',{name:'Примерить / снять',exact:true}).click();
  await page.getByLabel('Надеть экземпляров (0 — снять)',{exact:true}).fill('3');await page.getByRole('button',{name:'Применить экипировку',exact:true}).click();
  for(let i=0;i<3;i++)await group(page,'💚',2,n).getByRole('button',{name:'В крафт с персонажа',exact:true}).click();
  await expect(page.getByTestId('craft-preview')).toContainText('+'+derived+'%');
  for(const width of [1440,360,390]){
    await page.setViewportSize({width,height:1000});await noOverflow(page,width);await targets(page);
    await expect(page.locator('.full-number').first()).toContainText(n);
    const broken=await page.locator('.exact,.stat-value,.fusion-slot strong,.fusion-output strong').evaluateAll(nodes=>nodes.filter(n=>{
      const e=n as HTMLElement;if(e.closest('.sr-only'))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&e.scrollWidth>r.width+2;
    }).map(n=>n.className));expect(broken).toEqual([]);
    await page.screenshot({path:testInfo.outputPath('exact-values-'+width+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Добавить моды',exact:true}).click();await page.getByRole('combobox',{name:'Тип мода',exact:true}).selectOption('💚');
  await page.getByLabel('Параметр мода',{exact:true}).fill(n);await page.getByLabel('Количество модов',{exact:true}).fill(n);
  await expect(page.getByRole('dialog').locator('.full-number')).toHaveCount(2);
  await noOverflow(page,390);await targets(page);await page.screenshot({path:testInfo.outputPath('exact-editor.png'),fullPage:true});
});
