import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { completeOnboarding, gotoApp } from './helpers';

async function expectNoViolations(page: import('@playwright/test').Page, label: string) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      try {
        animation.finish();
      } catch {
        // Ignore infinite animations.
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

test.describe('v0.3 personalization and AI surfaces', () => {
  test('collects goals and preferences during onboarding and makes them editable', async ({
    page
  }) => {
    await gotoApp(page);

    await page.getByRole('switch', { name: /Set muscle-group priorities/ }).check();
    await expect(page.getByRole('slider', { name: 'Chest' })).toBeVisible();
    await page.getByRole('slider', { name: 'Chest' }).press('ArrowRight');

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Age').fill('34');
    await page.getByLabel('Height in feet').fill('5');
    await page.getByLabel('Height in inches').fill('9');
    await page.getByRole('textbox', { name: /^Weight lb$/ }).fill('170');
    await expect(page.getByRole('switch', { name: /Set a target weight/ })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Make it yours.' })).toBeVisible();
    await page.getByRole('switch', { name: /^Photo logging/ }).check();
    await page.getByRole('checkbox', { name: /I understand AI estimates/ }).check();
    await page.getByLabel('Food preference').selectOption('vegetarian');
    await page.getByRole('button', { name: 'Asian', exact: true }).click();
    await page.getByLabel('Ingredients to avoid').fill('peanuts, shellfish');
    await expectNoViolations(page, 'personalization onboarding');

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Daily numbers.' })).toBeVisible();
    await expect(page.getByText('Shortcuts')).toBeVisible();
    await page.getByRole('button', { name: 'Start tracking' }).click();

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    const personalization = page.getByRole('region', { name: 'Personalization' });
    const summary = personalization.locator('.personalization-summary');
    await expect(summary.getByText('Vegetarian')).toBeVisible();
    await expect(summary.getByText('Asian')).toBeVisible();
    await expect(summary.getByText('Chest 5%')).toBeVisible();

    await page.getByRole('button', { name: 'Edit setup and preferences' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit personalization' })).toBeVisible();
    await expect(dialog.getByRole('switch', { name: /Set muscle-group priorities/ })).toBeChecked();
    await expectNoViolations(page, 'personalization sheet');
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('parses a described meal offline and logs the reviewed items', async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole('button', { name: /^Describe/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Log with AI' })).toBeVisible();
    await expect(dialog.getByText('AI is not configured in this build.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Breakfast', exact: true }).click();
    await dialog.getByLabel('What did you eat?').fill('2 eggs and banana');
    await dialog.getByRole('button', { name: 'Match my foods' }).click();

    await expect(dialog.getByText('Review estimates')).toBeVisible();
    await expect(dialog.getByLabel('Food name').first()).toHaveValue('Egg');
    await expectNoViolations(page, 'AI result sheet');

    await dialog.getByRole('button', { name: 'Log 2 items to Breakfast' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit Egg' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Banana' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Daily summary' })).toContainText('177');
  });

  test('browses the recipe book, saves a recipe, and shows clear AI setup states', async ({
    page
  }) => {
    await completeOnboarding(page);
    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    await page.getByRole('tab', { name: 'Discover' }).click();

    const card = page.locator('.recipe-card').filter({ hasText: 'Chicken rice bowl' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'View recipe' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Chicken rice bowl' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Method' })).toBeVisible();
    await expectNoViolations(page, 'curated recipe detail');
    await dialog.getByRole('button', { name: 'Save to my recipes' }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.locator('.recipe-card').filter({ hasText: 'Chicken rice bowl' })
    ).toBeVisible();

    await page.goto('/CalAI/#/assistant');
    await expect(page.getByRole('heading', { name: 'Ask CalAI' })).toBeVisible();
    await expect(page.getByText('The coach is not configured')).toBeVisible();
    await expectNoViolations(page, 'assistant setup state');

    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Cloud backup' }).getByText(/not configured in this build/)
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'SMS reminders' }).getByText(/not configured in this build/)
    ).toBeVisible();
    await expectNoViolations(page, 'settings with sync and SMS');
  });

  test('has no horizontal overflow on the new screens at 360 and 390 px', async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole('button', { name: /^Describe/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('link', { name: 'Recipes', exact: true }).click();
    await page.getByRole('tab', { name: 'Discover' }).click();

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `recipes overflow at ${width}px`).toBeLessThanOrEqual(1);

      await page.goto('/CalAI/#/assistant');
      const assistantOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(assistantOverflow, `assistant overflow at ${width}px`).toBeLessThanOrEqual(1);

      await page.getByRole('link', { name: 'Settings', exact: true }).click();
      const settingsOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(settingsOverflow, `settings overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
});
