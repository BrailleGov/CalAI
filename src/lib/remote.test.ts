import { describe, expect, it } from 'vitest';
import { barcodeFoodFromOff, isRemoteSource } from './remote';

describe('remote food normalisation', () => {
  it('builds a 100 g food from an Open Food Facts product', () => {
    const food = barcodeFoodFromOff({
      code: '0123456789012',
      product_name: 'Oat drink',
      brands: 'Oatly, Other',
      nutriments: {
        'energy-kcal_100g': 46,
        proteins_100g: 1,
        carbohydrates_100g: 6.7,
        fat_100g: 1.5
      }
    });

    expect(food).toMatchObject({
      id: 'off-0123456789012',
      barcode: '0123456789012',
      brand: 'Oatly',
      servingLabel: '100 g',
      source: 'off'
    });
    expect(food?.nutrients).toEqual({ kcal: 46, protein: 1, carbs: 6.7, fat: 1.5 });
  });

  it('falls back to kilojoules', () => {
    const food = barcodeFoodFromOff({
      product_name: 'Juice',
      nutriments: { energy_100g: 418.4 }
    });
    expect(food?.nutrients.kcal).toBe(100);
  });

  it('rejects unusable products', () => {
    expect(barcodeFoodFromOff({})).toBeNull();
    expect(
      barcodeFoodFromOff({
        product_name: 'Impossible',
        nutriments: { 'energy-kcal_100g': 5000 }
      })
    ).toBeNull();
  });

  it('treats shared AI foods as remote library entries', () => {
    expect(isRemoteSource('ai')).toBe(true);
    expect(isRemoteSource('off')).toBe(true);
    expect(isRemoteSource('custom')).toBe(false);
  });
});
