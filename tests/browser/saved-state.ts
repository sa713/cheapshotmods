import {expect,type Page} from '@playwright/test';

export async function reloadSavedState(page:Page) {
  await page.reload();
  await expect(page.locator('.save-state [role=status]')).toHaveText('Все изменения сохранены');
}

export async function recoverSavedState(page:Page) {
  const reload=page.locator('.sync-actions').getByRole('button',{name:'Загрузить сохранённые данные',exact:true});
  await reload.click();
  await expect(page.locator('.save-state [role=status]')).toHaveText('Сохранённые данные загружены');
  await expect(reload).toHaveCount(0);
}
