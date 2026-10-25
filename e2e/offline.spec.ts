import { expect, test } from '@playwright/test';
import { completeOnboarding, logSeedFood } from './helpers';

test('offline reload is served by the service worker and keeps the diary', async ({
  page,
  context
}) => {
  await page.goto('/CalAI/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await completeOnboarding(page);
  await logSeedFood(page, 'Banana');
  await expect(page.getByRole('button', { name: 'Edit Banana' })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit Banana' })).toBeVisible();

  await context.setOffline(false);
});
