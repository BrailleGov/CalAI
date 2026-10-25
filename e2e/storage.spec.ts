import { expect, test } from '@playwright/test';
import { APP_PATH, completeOnboarding, logSeedFood } from './helpers';

test.describe('storage failure modes', () => {
  test('boots when localStorage is blocked and warns instead of hanging', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access denied', 'SecurityError');
        }
      });
    });

    const started = Date.now();
    await page.goto(APP_PATH);
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();
    await expect(page.locator('.storage-warning')).toContainText(
      'Storage is blocked in this browser.'
    );
    expect(Date.now() - started).toBeLessThan(10_000);
    await expect(page.getByText('Opening your diary', { exact: false })).toHaveCount(0);
  });

  test('boots when IndexedDB is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: undefined
      });
    });

    await page.goto(APP_PATH);
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();
    await expect(page.getByText('Opening your diary', { exact: false })).toHaveCount(0);
  });

  test('discards corrupt persisted JSON and falls back to onboarding', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('calai:v1', '{not valid json');
    });

    await page.goto(APP_PATH);
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('calai:v1')))
      .not.toBe('{not valid json');
  });

  test('discards a persisted document with an invalid shape', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'calai:v1',
        JSON.stringify({ state: { onboarded: true, entries: 'nope' }, version: 1 })
      );
    });

    await page.goto(APP_PATH);
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();
  });

  test('recovers a v0.1.0 IndexedDB diary into localStorage', async ({ page }) => {
    await page.goto(APP_PATH);
    await expect(page.getByRole('heading', { name: 'What are you aiming for?' })).toBeVisible();

    await page.evaluate(async () => {
      const pad = (value: number) => String(value).padStart(2, '0');
      const now = new Date();
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const state = {
        schemaVersion: 1,
        onboarded: true,
        profile: {
          sex: 'unspecified',
          age: 34,
          heightCm: 175,
          weightKg: 72,
          activity: 'moderate',
          goal: 'maintain',
          rateKgPerWeek: 0
        },
        targets: { kcal: 2200, protein: 115, carbs: 240, fat: 61 },
        customFoods: [],
        entries: [
          {
            id: 'legacy-entry',
            date,
            meal: 'breakfast',
            name: 'Legacy apple',
            servingLabel: '1 medium',
            quantity: 1,
            nutrients: { kcal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
            createdAt: Date.now()
          }
        ],
        favorites: [],
        recentFoodIds: [],
        settings: { theme: 'dark', units: 'metric' }
      };

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('keyval');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(JSON.stringify({ state, version: 1 }), 'calai:v1');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();

      localStorage.removeItem('calai:v1');
      localStorage.removeItem('calai:legacy-checked');
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Legacy apple' })).toBeVisible();

    const persisted = await page.evaluate(() => localStorage.getItem('calai:v1'));
    expect(persisted).toContain('Legacy apple');
  });

  test('does not overwrite real localStorage data during legacy recovery', async ({ page }) => {
    await completeOnboarding(page);
    await logSeedFood(page, 'Egg');
    await page.evaluate(async () => {
      localStorage.removeItem('calai:legacy-checked');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('keyval-store', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('keyval');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put('{broken', 'calai:v1');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });

    await page.reload();
    await expect(page.getByRole('button', { name: 'Edit Egg' })).toBeVisible();
  });
});
