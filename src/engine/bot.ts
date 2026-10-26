// Bots: the reference engine's planner, plus swaps and difficulty.
import { COMPOUNDS } from './deck';
import { apply, bestLine, isStraddle, lineMoves, loneMoves, meaningsOf, pass } from './game';
import { next } from './rng';
import type { GameState, Level, Move } from './types';

/** How often a bot spots a line through a particle already down. */
export const STRADDLE_SIGHT: Record<Level, number> = { easy: 0.25, normal: 0.6, hard: 1 };

/** Race reaction delay before a bot commits, in ms, by difficulty (before the bot-speed setting). */
export const REACTION_MS: Record<Level, [number, number]> = {
  easy: [5200, 9000],
  normal: [3200, 6000],
  hard: [1800, 3600],
};

export interface BotChoice {
  move: Move | null;
  /** Bot RNG state after the decision; store it back in the game. */
  rng: number;
}

/** The bot's play for player p, or null to pass / go Stuck. Deterministic given state.rng. */
export function botMove(s: GameState, p: number): BotChoice {
  const level = s.config.players[p]?.level ?? 'hard';
  let rngState = s.rng;
  let lines = lineMoves(s, p);
  // Lines through a particle, or onto a meaning card already down, are the harder ones to spot.
  const subtle = (l: (typeof lines)[number]) => isStraddle(l) || !!l.onto;
  if (STRADDLE_SIGHT[level] < 1 && lines.some(subtle)) {
    const [r, st] = next(rngState);
    rngState = st;
    if (r >= STRADDLE_SIGHT[level]) lines = lines.filter((l) => !subtle(l));
  }
  const line = bestLine(lines, s);
  if (line) return { move: line, rng: rngState };

  const hand = s.hands[p];
  if (s.config.botSwaps !== false && s.faceUp) {
    // Swap a dead meaning card for the face-up one when the face-up one makes a line now.
    const faceLines = lineMoves(s, p, { meanings: [s.faceUp], handSpots: 1 });
    if (faceLines.length) {
      const dead = hand.find((c) => c.k === 'M');
      if (dead) return { move: { type: 'swap', m: dead.id }, rng: rngState };
    }
  }

  const goals = new Set(hand.filter((c) => c.k === 'M').flatMap(meaningsOf));
  const lone = loneMoves(s, p).filter((m) => {
    const v = hand.find((c) => c.id === m.v)!;
    return COMPOUNDS.some((c) => c.v === v.t && goals.has(c.g));
  });
  if (lone.length && s.main.length) return { move: lone[0], rng: rngState };
  return { move: null, rng: rngState };
}

/** A random reaction delay for a race bot, and the next RNG state. */
export function reactionDelay(s: GameState, p: number, speed: number): { ms: number; rng: number } {
  const level = s.config.players[p]?.level ?? 'normal';
  const [lo, hi] = REACTION_MS[level];
  const [r, st] = next(s.rng);
  return { ms: Math.round((lo + (hi - lo) * r) / speed), rng: st };
}

/** Turn mode: the bot plays its move, or draws and passes. Returns the new state. */
export function botTurn(s: GameState, p: number): GameState {
  const { move, rng } = botMove(s, p);
  const withRng = rng === s.rng ? s : { ...s, rng };
  if (move) {
    const r = apply(withRng, p, move);
    if (r.ok) return r.state;
  }
  const r = pass(withRng, p);
  return r.ok ? r.state : withRng;
}
