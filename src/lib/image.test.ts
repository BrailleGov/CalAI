import { describe, expect, it } from 'vitest';
import { targetDimensions } from './image';

describe('image sizing', () => {
  it('keeps small images unchanged', () => {
    expect(targetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales the longest edge to 1024', () => {
    expect(targetDimensions(2048, 1024)).toEqual({ width: 1024, height: 512 });
    expect(targetDimensions(600, 2400)).toEqual({ width: 256, height: 1024 });
  });

  it('handles invalid dimensions without throwing', () => {
    expect(targetDimensions(0, 0)).toEqual({ width: 0, height: 0 });
  });
});
