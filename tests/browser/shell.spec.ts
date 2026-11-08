import {test,expect} from '@playwright/test';
test('mobile shell, no anonymous data or browser persistence',async({page,request})=>{
  await page.route('https://telegram.org/**',route=>route.abort());
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Вход через Telegram пока не настроен. Личные данные недоступны.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(await page.evaluate(()=>[localStorage.length,sessionStorage.length])).toEqual([0,0]);
  expect((await request.get('/api/state')).status()).toBe(401);
  expect((await request.post('/api/commands',{data:{}})).status()).toBe(401);
});
