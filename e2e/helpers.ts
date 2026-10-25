import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const APP_PATH = '/CalAI/';

export async function gotoApp(page: Page) {
  await page.goto(APP_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function completeOnboarding(
  page: Page,
  options: { units?: 'metric' | 'imperial' } = {}
) {
  await gotoApp(page);

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'A few numbers.' })).toBeVisible();

  const units = options.units ?? 'imperial';
  await page.getByRole('button', { name: units === 'imperial' ? 'Imperial' : 'Metric' }).click();
  await page.getByLabel('Age').fill('34');
  if (units === 'imperial') {
    await page.getByLabel('Height in feet').fill('5');
    await page.getByLabel('Height in inches').fill('9');
    await page.getByRole('textbox', { name: /^Weight lb$/ }).fill('170');
  } else {
    await page.getByLabel('Height').fill('175');
    await page.getByRole('textbox', { name: /^Weight kg$/ }).fill('72');
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
  const consent = page.getByRole('checkbox', { name: /I understand AI estimates/ });
  if ((await consent.count()) > 0) await consent.check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Daily numbers.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}

export async function openAddFood(page: Page) {
  await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function logSeedFood(
  page: Page,
  name: string,
  portion?: { preset?: '½' | '1½' | '2' }
) {
  await openAddFood(page);
  await page.getByRole('textbox', { name: 'Search foods' }).fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  if (portion?.preset) {
    await page.getByRole('button', { name: portion.preset, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Add to Breakfast' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

export function dialog(page: Page) {
  return page.getByRole('dialog');
}
