import { describe, expect, it } from 'vitest';
import { newGame } from '../engine/game';
import type { GameConfig, GameState, GameEvent, PlayerConfig } from '../engine/types';
import { botName, moodOf, speciesOf } from './critters';

const human: PlayerConfig = { name: 'You', kind: 'human', color: 0 };
const bot = (level: 'easy' | 'normal' | 'hard', color: number): PlayerConfig => ({ name: 'B', kind: 'bot', level, color });

function state(players: PlayerConfig[], mode: GameConfig['mode'] = 'turns', log: GameEvent[] = [], turn = 0): GameState {
  const s = newGame({ seed: 1, mode, answers: 'shown', hints: 'off', players, firstPlayer: 0 });
  return { ...s, log, turn };
}

describe('bot characters', () => {
  it('picks the species from the difficulty', () => {
    expect([speciesOf('easy'), speciesOf('normal'), speciesOf('hard')]).toEqual(['broc', 'corr', 'giorria']);
  });

  it('names bots by species, telling apart two of one difficulty', () => {
    const ps = [human, bot('easy', 1), bot('hard', 2), bot('easy', 3)];
    expect([1, 2, 3].map((i) => botName(ps, i))).toEqual(['Broc', 'Giorria', 'Broc Óg']);
  });

  it('thinks on its turn, and is pleased after its own line until the next play', () => {
    const ps = [human, bot('normal', 1)];
    expect(moodOf(state(ps, 'turns', [], 1), 1, null)).toBe('thinking');
    const line = { e: 'line', p: 1, c: 'c01', g: 'PUT ON', cells: [], wild: false, straddle: false, river: [], turnNo: 1 } as GameEvent;
    expect(moodOf(state(ps, 'turns', [line]), 1, null)).toBe('pleased');
    const lone = { e: 'lone', p: 0, word: 'cuir', x: 0, y: 0, drew: [], turnNo: 2 } as GameEvent;
    expect(moodOf(state(ps, 'turns', [line, lone]), 1, null)).toBe('neutral');
  });

  it('is stuck after passing, until the river turns', () => {
    const ps = [human, bot('easy', 1)];
    const passed = { e: 'pass', p: 1, drew: null, turnNo: 1 } as GameEvent;
    expect(moodOf(state(ps, 'turns', [passed]), 1, null)).toBe('stuck');
    const stall = { e: 'stall', drew: [], final: null, turnNo: 2 } as GameEvent;
    expect(moodOf(state(ps, 'turns', [passed, stall]), 1, null)).toBe('neutral');
  });

  it('is pleased if it won and beaten if not', () => {
    const ps = [human, bot('easy', 1), bot('hard', 2)];
    const s = { ...state(ps), over: { how: 'out' as const, winners: [2], tie: false, counts: [3, 2, 0] } };
    expect(moodOf(s, 1, null)).toBe('beaten');
    expect(moodOf(s, 2, null)).toBe('pleased');
  });
});
