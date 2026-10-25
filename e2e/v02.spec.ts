import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { completeOnboarding, logSeedFood, openAddFood } from './helpers';

const OFF_SEARCH = {
  products: [
    {
      code: '0123456789012',
      product_name: 'Mock banana bread',
      brands: 'Test Bakery',
      nutriments: {
        'energy-kcal_100g': 250,
        proteins_100g: 4,
        carbohydrates_100g: 48,
        fat_100g: 5
      }
    }
  ]
};

const OFF_PRODUCT = {
  status: 1,
  product: {
    code: '0123456789012',
    product_name: 'Mock barcode food',
    brands: 'Test Brand',
    nutriments: {
      'energy-kcal_100g': 120,
      proteins_100g: 6,
      carbohydrates_100g: 18,
      fat_100g: 2
    }
  }
};

test.describe('v0.2 features', () => {
  test('searches online foods, logs one, and keeps it offline', async ({ page }) => {
    await completeOnboarding(page);
    await page.route('**/api/v2/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(OFF_SEARCH)
      })
    );

    await openAddFood(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Search foods' }).fill('mock banana');
    await expect(dialog.getByText('Online', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Mock banana bread/ })).toBeVisible();

    await dialog.getByRole('button', { name: /Mock banana bread/ }).click();
    await expect(dialog.getByText('Test Bakery · 100 g · 250 kcal')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add to Breakfast' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mock banana bread' })).toBeVisible();

    await page.reload();
    await openAddFood(page);
    await page.getByRole('dialog').getByRole('textbox', { name: 'Search foods' }).fill('mock banana');
    const savedRow = page
      .getByRole('dialog')
      .locator('.food-row')
      .filter({ hasText: 'Mock banana bread' });
    await expect(savedRow.first()).toBeVisible();
    await expect(savedRow.first().getByText('Open Food Facts')).toBeVisible();
  });

  test('degrades to local foods when online search fails', async ({ page }) => {
    await completeOnboarding(page);
    await page.route('**/api/v2/search**', (route) => route.abort());

    await openAddFood(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Search foods' }).fill('banana');
    await expect(dialog.getByText('Local foods still work offline.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Banana/ })).toBeVisible();
  });

  test('looks up a typed barcode and logs the result', async ({ page }) => {
    await completeOnboarding(page);
    await page.route('**/api/v2/product/0123456789012.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(OFF_PRODUCT)
      })
    );

    await openAddFood(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Scan barcode' }).click();
    await dialog.getByLabel('Barcode number').fill('0123456789012');
    await dialog.getByRole('button', { name: 'Look up barcode' }).click();
    await expect(dialog.getByText('Mock barcode food')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add to Breakfast' }).click();
    await expect(page.getByRole('button', { name: 'Edit Mock barcode food' })).toBeVisible();
  });

  test('builds a recipe and logs a serving', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Recipes', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'New recipe' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Recipe name').fill('Rice bowl');
    await dialog.getByLabel('Servings in this batch').fill('2');

    await dialog.getByRole('textbox', { name: 'Search ingredients' }).fill('white rice');
    await dialog.getByRole('button', { name: /White rice, cooked/ }).click();
    await dialog.getByRole('textbox', { name: 'Search ingredients' }).fill('chicken breast');
    await dialog.getByRole('button', { name: /Chicken breast, cooked/ }).click();

    await dialog.getByRole('button', { name: 'Save recipe' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Rice bowl' })).toBeVisible();
    await expect(page.locator('.recipe-card').getByText('Per serving')).toBeVisible();

    await page.getByRole('button', { name: 'Log a serving' }).click();
    const logDialog = page.getByRole('dialog');
    await logDialog.getByRole('button', { name: 'Dinner', exact: true }).click();
    await logDialog.getByRole('button', { name: 'Add to Dinner' }).click();
    await expect(logDialog).toBeHidden();

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Rice bowl' })).toBeVisible();
  });

  test('adds and undoes water, and keeps it after reload', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByRole('heading', { name: 'Water' })).toBeVisible();

    await page.getByRole('button', { name: '+ 250 ml' }).click();
    await expect(page.getByText('250 ml / 2,000 ml')).toBeVisible();
    await page.reload();
    await expect(page.getByText('250 ml / 2,000 ml')).toBeVisible();

    await page.getByRole('button', { name: 'Undo last' }).click();
    await expect(page.getByText('0 ml / 2,000 ml')).toBeVisible();
  });

  test('logs weight and shows the 7-day average', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'History', exact: true }).click();

    await page.getByLabel('Today (kg)').fill('72.5');
    await page.getByRole('button', { name: 'Log weight' }).click();
    await expect(page.getByText('72.5 kg').first()).toBeVisible();
    await expect(page.getByText('7-day average').first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('72.5 kg').first()).toBeVisible();
  });

  test('enables reminders, shows the in-app banner, and exports .ics', async ({ page }, testInfo) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();

    const now = await page.evaluate(() => {
      const date = new Date();
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    });

    await page.getByRole('checkbox', { name: /In-app reminders/ }).check();
    await page.getByRole('checkbox', { name: 'Lunch' }).check();
    await page.getByLabel('Lunch reminder time').fill(now);
    await page.getByLabel('Quiet from').fill('00:00');
    await page.getByLabel('Quiet until').fill('00:00');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download calendar/ }).click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('calai-reminders.ics');
    await download.saveAs(path);
    const ics = await readFile(path, 'utf8');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('SUMMARY:Time to log a meal: Lunch');

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    const banner = page.getByRole('region', { name: 'Meal reminder' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Time to log lunch');
    await banner.getByRole('button', { name: 'Dismiss reminder for today' }).click();
    await expect(banner).toBeHidden();
  });

  test('keeps the recipe page free of horizontal overflow', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});

test('seeded food still logs while offline', async ({ page, context }) => {
  await completeOnboarding(page);
  await context.setOffline(true);
  await logSeedFood(page, 'Apple');
  await expect(page.getByRole('button', { name: 'Edit Apple' })).toBeVisible();
  await context.setOffline(false);
});
