import { describe, expect, it } from 'vitest';
import type { GameState } from '../engine/types';
import { byMeaning, meaningUses, splitHalves } from './meaningUses';

const line = (g: string, cells: [number, number][]) => ({ p: 0, c: 'c01', g, cells, wild: false, straddle: false, turnNo: 1 }) as GameState['lines'][number];

describe('meaning cards with several lines', () => {
  it('finds each line ending on a card, its meaning and the side it arrives from', () => {
    const uses = meaningUses([
      line('PUT ON', [[0, 0], [1, 0], [2, 0]]), // from the left
      line('SUCCEED', [[2, -2], [2, -1], [2, 0]]), // from above
      line('PUT ON', [[4, 0], [3, 0], [2, 0]]), // from the right, same meaning
    ]);
    expect(uses.get('2,0')).toEqual([{ g: 'PUT ON', side: 'w' }, { g: 'SUCCEED', side: 'n' }, { g: 'PUT ON', side: 'e' }]);
    expect(byMeaning(uses.get('2,0')!)).toEqual([{ g: 'PUT ON', sides: ['w', 'e'] }, { g: 'SUCCEED', sides: ['n'] }]);
  });

  it('splits down the middle for opposite sides and diagonally through the shared corner otherwise', () => {
    const [w, e] = splitHalves('w', 'e');
    expect(w.box).toMatchObject({ left: 0, w: 50 });
    expect(e.box).toMatchObject({ left: 50, w: 50 });
    // Left and top share the top-left corner: the left half is the bottom-left triangle.
    const [left, top] = splitHalves('w', 'n');
    expect(left.clip).toBe('polygon(0 0, 0 100%, 100% 100%)');
    expect(top.clip).toBe('polygon(0 0, 100% 0, 100% 100%)');
  });
});
