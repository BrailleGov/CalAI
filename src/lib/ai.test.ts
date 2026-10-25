import { describe, expect, it } from 'vitest';
import { sanitizeAiItems } from './ai';

describe('AI response sanitizing', () => {
  it('clamps nutrition and confidence values', () => {
    const items = sanitizeAiItems([
      {
        name: '  Rice bowl  ',
        grams: 150,
        quantityLabel: '1 bowl',
        kcal: 9999,
        protein: 9999,
        carbs: -4,
        fat: 12,
        confidence: 2
      }
    ]);
    expect(items[0]).toMatchObject({
      name: 'Rice bowl',
      grams: 150,
      kcal: 5000,
      protein: 1000,
      carbs: 0,
      fat: 12,
      confidence: 1
    });
  });

  it('drops nameless entries and caps the list', () => {
    const items = sanitizeAiItems(
      [
        { name: '', kcal: 10 },
        ...Array.from({ length: 20 }, (_, index) => ({
          name: `Food ${index}`,
          kcal: 100,
          confidence: 0.5
        }))
      ],
      5
    );
    expect(items).toHaveLength(5);
    expect(items[0]?.name).toBe('Food 0');
  });

  it('replaces non-finite values instead of passing them through', () => {
    const items = sanitizeAiItems([{ name: 'Soup', kcal: Number.NaN, grams: 'x' }]);
    expect(items[0]?.kcal).toBe(0);
    expect(items[0]?.grams).toBeNull();
    expect(items[0]?.confidence).toBe(0.4);
  });
});
