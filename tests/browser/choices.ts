import {expect,type Locator} from '@playwright/test';

// Real user interaction with the shared themed combobox (also inside dialog).
export async function selectChoice(field:Locator,value:string){
  await field.click();
  const option=field.page().getByRole('listbox').locator('[role="option"][data-value='+JSON.stringify(value)+']');
  await expect(option).toBeVisible();await option.click();
  await expect(field).toHaveAttribute('data-value',value);await expect(field).toHaveAttribute('aria-expanded','false');
}
