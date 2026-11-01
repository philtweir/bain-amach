// The Original deck (the 25 October handoff) ships beside Standard: it must deal, and games on it must finish.
import { describe, expect, it } from 'vitest';
import { ORIGINAL, PRESETS, cardTotal, deckFit, deckForSetup, presetById } from './decks';
import { BASE } from '../engine/deck';
import { newGame } from '../engine/game';
import { botTurn } from '../engine/bot';
import { APP_RULES, type PlayerConfig } from '../engine/types';

const bot = (i: number): PlayerConfig => ({ name: 'B' + i, kind: 'bot', level: 'normal', color: i });

describe('Original deck', () => {
  it('is the first deck: 36 compounds on 36 cards, with today’s glosses and ids', () => {
    expect(presetById('preset:original')).toBe(PRESETS[0]);
    expect(deckForSetup('preset:original')).toBe(ORIGINAL);
    expect(ORIGINAL.compounds).toHaveLength(36);
    expect(ORIGINAL.meaningCards).toHaveLength(36);
    const base = Object.fromEntries(BASE.compounds.map((c) => [c.id, c]));
    for (const c of ORIGINAL.compounds) expect([base[c.id].verb, base[c.id].particles, base[c.id].meaning]).toEqual([c.verb, c.particles, c.meaning]);
    const glosses = new Set(ORIGINAL.compounds.map((c) => c.meaning));
    for (const m of ORIGINAL.meaningCards) for (const g of m.meanings) expect(glosses.has(g), g).toBe(true);
    expect(cardTotal(undefined, 2, ORIGINAL)).toBe(22 + 42 + 4 + 36);
    expect(cardTotal(undefined, 4, ORIGINAL)).toBe(22 + 14 + 42 + 4 + 36);
    expect(deckFit(undefined, ORIGINAL)).toEqual({ 2: 12, 3: 12, 4: 10 });
  });

  for (const n of [2, 3, 4])
    it(`plays to the end with ${n} bots`, () => {
      for (let seed = 1; seed <= 5; seed++) {
        let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players: Array.from({ length: n }, (_, i) => bot(i)), firstPlayer: 0, deck: ORIGINAL });
        for (let i = 0; i < 4000 && !s.over; i++) s = botTurn(s, s.turn);
        expect(s.over, `seed ${seed}`).toBeTruthy();
        expect(s.lines.every((l) => ORIGINAL.compounds.some((c) => c.id === l.c))).toBe(true);
      }
    });
});
