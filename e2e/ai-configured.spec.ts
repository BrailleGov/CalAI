import { expect, test } from '@playwright/test';
import path from 'node:path';
import { gotoApp } from './helpers';

const API = (process.env.VITE_API_BASE ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-CalAI-Device, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

async function onboardWithAi(page: import('@playwright/test').Page) {
  await gotoApp(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Age').fill('34');
  await page.getByLabel('Height in feet').fill('5');
  await page.getByLabel('Height in inches').fill('9');
  await page.getByRole('textbox', { name: /^Weight lb$/ }).fill('170');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('switch', { name: /^Photo logging/ }).check();
  await page.getByRole('switch', { name: /^AI coach/ }).check();
  await page.getByRole('switch', { name: /^Recipe ideas/ }).check();
  await page.getByRole('checkbox', { name: /I understand AI estimates/ }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}

test('configured AI UI works against a mocked Worker', async ({ page }) => {
  test.skip(
    !process.env.VITE_API_BASE,
    'Build with VITE_API_BASE set to run the configured-AI suite; CI uses the local-first build.'
  );

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    const url = new URL(request.url());
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS,
        body: JSON.stringify(body)
      });

    if (url.pathname === '/v1/ai/recognize') {
      await json({
        items: [
          {
            name: 'Banana',
            quantityLabel: '1 medium',
            grams: 118,
            kcal: 105,
            protein: 1.3,
            carbs: 27,
            fat: 0.4,
            confidence: 0.82
          }
        ],
        note: 'One banana.',
        uncertain: false
      });
      return;
    }

    if (url.pathname === '/v1/ai/parse') {
      await json({
        items: [
          {
            name: 'Egg',
            quantityLabel: '2 eggs',
            grams: 100,
            kcal: 144,
            protein: 12.6,
            carbs: 0.8,
            fat: 9.6,
            confidence: 0.8
          }
        ],
        note: 'Two eggs.',
        uncertain: false
      });
      return;
    }

    if (url.pathname === '/v1/ai/chat') {
      await json({
        reply: 'You logged about 600 kcal over the last 7 days.',
        window: 'last 7 days',
        suggestions: ['Show my protein average'],
        proposal: {
          meal: 'lunch',
          rationale: 'A simple snack to review.',
          items: [
            {
              name: 'Apple',
              grams: 182,
              kcal: 95,
              protein: 0.5,
              carbs: 25,
              fat: 0.3,
              confidence: 0.7
            }
          ]
        }
      });
      return;
    }

    if (url.pathname === '/v1/foods/library') {
      await json({ foods: [], sources: ['ai'], cached: false });
      return;
    }

    if (url.pathname === '/v1/foods/discover') {
      await json({
        foods: [
          {
            id: 'ai-paneer-bhurji',
            name: 'Paneer bhurji',
            servingLabel: '1 cup (150 g)',
            servingGrams: 150,
            nutrients: { kcal: 300, protein: 18, carbs: 6, fat: 23 },
            source: 'ai',
            createdAt: Date.now()
          },
          {
            id: 'ai-palak-paneer',
            name: 'Palak paneer',
            servingLabel: '1 bowl (250 g)',
            servingGrams: 250,
            nutrients: { kcal: 320, protein: 16, carbs: 12, fat: 24 },
            source: 'ai',
            createdAt: Date.now()
          }
        ],
        sources: ['ai'],
        note: 'Added two matches.'
      });
      return;
    }

    if (url.pathname === '/v1/ai/recipes') {
      const body = JSON.parse(request.postData() ?? '{}') as { mode?: string };
      if (body.mode === 'suggest') {
        await json({
          picks: [{ id: 'book-chicken-rice-bowl', reason: 'High protein and quick.' }],
          note: 'One match.'
        });
      } else {
        await json({
          recipe: {
            name: 'Test chicken bowl',
            description: 'A test recipe.',
            servings: 2,
            timeMinutes: 20,
            tags: ['High protein'],
            ingredients: [
              {
                name: 'Chicken breast',
                quantityLabel: '200 g',
                grams: 200,
                kcal: 330,
                protein: 62,
                carbs: 0,
                fat: 7.2,
                confidence: 0.8
              }
            ],
            instructions: ['Cook the chicken.', 'Serve with rice.']
          },
          note: 'Estimated values.'
        });
      }
      return;
    }

    await route.fulfill({ status: 404, headers: CORS, body: '{}' });
  });

  await onboardWithAi(page);

  await page.getByRole('button', { name: /^Camera/ }).click();
  const photoDialog = page.getByRole('dialog');
  await photoDialog
    .getByLabel('Choose a meal photo')
    .setInputFiles(path.resolve('e2e/fixtures/meal.png'));
  await photoDialog.getByRole('button', { name: 'Analyse photo' }).click();
  await expect(photoDialog.getByLabel('Food name')).toHaveValue('Banana');
  await photoDialog.getByRole('button', { name: 'Breakfast', exact: true }).click();
  await photoDialog.getByRole('button', { name: 'Log 1 item to Breakfast' }).click();
  await expect(page.getByRole('button', { name: 'Edit Banana' })).toBeVisible();

  await page.getByRole('button', { name: 'Add food to Breakfast' }).click();
  const searchDialog = page.getByRole('dialog');
  await searchDialog.getByRole('button', { name: /Search or scan a barcode/ }).click();
  await searchDialog.getByRole('textbox', { name: 'Search foods' }).fill('paneer bhurji');
  await expect(searchDialog.getByText('Shared library', { exact: true })).toBeVisible();
  await expect(
    searchDialog.getByRole('button', { name: /^Paneer bhurji/ })
  ).toBeVisible();
  await searchDialog.getByRole('button', { name: /^Paneer bhurji/ }).click();
  await searchDialog.getByRole('button', { name: 'Add to Breakfast' }).click();
  await expect(page.getByRole('button', { name: 'Edit Paneer bhurji' })).toBeVisible();

  await page.getByRole('link', { name: 'Ask the AI coach' }).click();
  await expect(page.getByRole('heading', { name: 'Ask CalAI' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Message the coach' }).fill('How did I do?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('You logged about 600 kcal over the last 7 days.')).toBeVisible();
  await expect(page.getByText('Proposed entries')).toBeVisible();
  await page.getByRole('button', { name: 'Log these entries' }).click();
  await expect(page.getByText(/Logged 1 item to lunch/)).toBeVisible();

  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Apple' })).toBeVisible();

  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await page.getByRole('tab', { name: 'Discover' }).click();
  await page.getByRole('button', { name: /Personalize/ }).click();
  await expect(page.getByText('High protein and quick.')).toBeVisible();

  await page.getByRole('button', { name: /AI recipe/ }).click();
  const recipeDialog = page.getByRole('dialog');
  await recipeDialog
    .getByLabel('What do you have or want?')
    .fill('chicken and rice');
  await recipeDialog.getByRole('button', { name: /Generate recipe/ }).click();
  await expect(recipeDialog.getByLabel('Recipe name')).toHaveValue('Test chicken bowl');
  await recipeDialog.getByRole('button', { name: 'Save recipe' }).click();
  await expect(page.getByRole('heading', { name: 'Test chicken bowl' })).toBeVisible();
});
