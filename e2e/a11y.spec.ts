import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { completeOnboarding, logSeedFood } from './helpers';

async function expectNoViolations(page: import('@playwright/test').Page, label: string) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        // Ignore animations that cannot be finished (for example, infinite ones).
      }
    }
  });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target.join(' '))
    })),
    label
  ).toEqual([]);
}

test.describe('accessibility', () => {
  test('onboarding has no A/AA violations', async ({ page }) => {
    await page.goto('/CalAI/');
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();
    await expectNoViolations(page, 'onboarding dark');
  });

  test('diary, foods, history, and settings have no A/AA violations', async ({ page }) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Egg');
    await expectNoViolations(page, 'today dark');

    await page.getByRole('link', { name: 'Foods' }).click();
    await expectNoViolations(page, 'foods dark');

    await page.getByRole('link', { name: 'History' }).click();
    await expectNoViolations(page, 'history dark');

    await page.getByRole('link', { name: 'Settings' }).click();
    await expectNoViolations(page, 'settings dark');
  });

  test('recipes, reminders, and barcode screens have no A/AA violations', async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    await expectNoViolations(page, 'recipes empty dark');
    await page.getByRole('button', { name: 'New recipe' }).click();
    await expectNoViolations(page, 'recipe form dark');
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('checkbox', { name: 'In-app reminders' }).check();
    await expectNoViolations(page, 'reminders on dark');

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
    await page.getByRole('button', { name: 'Scan barcode' }).click();
    await expectNoViolations(page, 'barcode screen dark');
  });

  test('light theme and open sheets have no A/AA violations', async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expectNoViolations(page, 'settings light');

    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
    await expectNoViolations(page, 'add food sheet light');
  });
});
