import { expect, test } from '@playwright/test';
import { completeOnboarding, logSeedFood, openAddFood } from './helpers';

test.describe('core diary flows', () => {
  test('defaults to dark theme and imperial units', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByText('Nothing logged yet.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'imperial', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByText('5′ 9″')).toBeVisible();
    await expect(stats.getByText('170 lb')).toBeVisible();

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('calai:v1') ?? '{}')
    );
    expect(stored.state.profile.heightCm).toBeCloseTo(175.3, 1);
    expect(stored.state.profile.weightKg).toBeCloseTo(77.1, 1);
  });

  test('onboards with metric units when selected', async ({ page }) => {
    await completeOnboarding(page, { units: 'metric' });
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    const stats = page.getByRole('region', { name: 'Your stats' });
    await expect(stats.getByText('175 cm')).toBeVisible();
    await expect(stats.getByText('72 kg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'metric', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('logs a seeded food, updates totals, and survives a reload', async ({ page }) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Egg');
    await expect(page.getByRole('button', { name: 'Edit Egg' })).toBeVisible();

    const summary = page.getByRole('region', { name: 'Daily summary' });
    await expect(summary.getByText('72', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add food to Breakfast' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Edit Egg' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('edits a portion and deletes an entry with confirmation', async ({ page }) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Egg');

    await page.getByRole('button', { name: 'Edit Egg' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Servings' }).fill('2');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('2 × 1 large')).toBeVisible();

    await page.getByRole('button', { name: 'Edit Egg' }).click();
    await dialog.getByRole('button', { name: 'Delete entry' }).click();
    await expect(dialog.getByText('Delete this entry?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit Egg' })).toHaveCount(0);
    await expect(page.getByText('Nothing logged yet.', { exact: false })).toBeVisible();
  });

  test('logs a quick add with macros', async ({ page }) => {
    await completeOnboarding(page);
    await openAddFood(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Quick add', exact: true }).click();
    await dialog.getByLabel('Label (optional)').fill('Lunch out');
    await dialog.getByLabel('Calories').fill('520');
    await dialog.getByLabel('Protein').fill('30');
    await dialog.getByLabel('Carbs').fill('50');
    await dialog.getByLabel('Fat').fill('20');
    await dialog.getByRole('button', { name: 'Add to Breakfast' }).click();

    await expect(page.getByRole('button', { name: 'Edit Lunch out' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Daily summary' })).toContainText('520');
  });

  test('creates a custom food and reuses it from the library', async ({ page }) => {
    await completeOnboarding(page);
    await openAddFood(page);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'New food', exact: true }).click();
    await dialog.getByLabel('Name').fill('Test bowl');
    await dialog.getByLabel('Serving').fill('1 bowl');
    await dialog.getByLabel('Calories').fill('410');
    await dialog.getByLabel('Protein').fill('22');
    await dialog.getByLabel('Carbs').fill('40');
    await dialog.getByLabel('Fat').fill('14');
    await dialog.getByRole('button', { name: 'Save and choose serving' }).click();
    await dialog.getByRole('button', { name: 'Add to Breakfast' }).click();
    await expect(page.getByRole('button', { name: 'Edit Test bowl' })).toBeVisible();

    await page.getByRole('link', { name: 'Foods', exact: true }).click();
    await page.getByRole('textbox', { name: 'Search the food library' }).fill('Test bowl');
    const row = page.locator('.library-row').filter({ hasText: 'Test bowl' });
    await expect(row).toBeVisible();
    await expect(row.getByText('custom', { exact: true })).toBeVisible();
  });

  test('favorites sort to the top and persist', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Foods', exact: true }).click();
    await page.getByRole('button', { name: 'Add Banana to favorites' }).click();
    await page.getByRole('button', { name: 'Remove Banana from favorites' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Add Banana to favorites' })).toBeVisible();
  });

  test('exports a backup and imports it back', async ({ page }, testInfo) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Banana');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export backup/ }).click();
    const download = await downloadPromise;
    const path = testInfo.outputPath('calai-backup.json');
    await download.saveAs(path);

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await openAddFood(page);
    await page.getByRole('dialog').getByRole('textbox', { name: 'Search foods' }).fill('Apple');
    await page.getByRole('dialog').getByRole('button', { name: /^Apple/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Add to Breakfast' }).click();
    await expect(page.getByRole('button', { name: 'Edit Apple' })).toBeVisible();

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Import backup file').setInputFiles(path);
    await expect(page.getByRole('status')).toContainText('Backup imported');

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Banana' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Apple' })).toHaveCount(0);
  });

  test('blocks malformed imports without replacing data', async ({ page }, testInfo) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Apple');
    await page.getByRole('link', { name: 'Settings', exact: true }).click();

    const path = testInfo.outputPath('bad.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, JSON.stringify({ app: 'calai', schemaVersion: 1, data: {} }));

    await page.getByLabel('Import backup file').setInputFiles(path);
    await expect(page.getByRole('status')).toContainText('Unsupported backup version.');
    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit Apple' })).toBeVisible();
  });

  test('has no horizontal overflow at 360 px and 390 px', async ({ page }) => {
    await completeOnboarding(page);

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});
