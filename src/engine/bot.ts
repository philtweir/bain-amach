// Bots: the reference engine's planner, plus swaps and difficulty.
import { COMPOUNDS } from './deck';
import { apply, bestLine, isFresh, isStraddle, lineMoves, lineScore, loneMoves, meaningsOf, pass } from './game';
import { next } from './rng';
import type { GameState, Level, LineMove, Move } from './types';

/** How often a bot spots a line through a particle already down. */
export const STRADDLE_SIGHT: Record<Level, number> = { easy: 0.25, normal: 0.6, hard: 1 };

/** In turn mode, how often a bot with no play swaps its least useful meaning card instead of
 *  drawing and passing. A swap costs the turn but, unlike a pass, adds no card. */
export const SWAP_FOR_PASS: Record<Level, number> = { easy: 0, normal: 0.5, hard: 1 };

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
  const line = level === 'easy' ? riverFirst(lines) : bestLine(lines, s);
  if (line) return { move: line, rng: rngState };

  const hand = s.hands[p];
  if (s.config.botSwaps !== false && s.faceUp) {
    // Swap a dead meaning card for the face-up one when the face-up one makes a line now.
    const faceLines = lineMoves(s, p, { meanings: [s.faceUp], handSpots: 1 });
    if (faceLines.length) {
      // Under the app's rules give away the least useful card; RULES.md play keeps the reference
      // engine's choice (the first one), so the stats test still compares like with like.
      const dead = s.config.rules?.swapIsPass ? leastUseful(s, p) : (hand.find((c) => c.k === 'M')?.id ?? null);
      if (dead !== null) return { move: { type: 'swap', m: dead }, rng: rngState };
    }
  }

  const goals = new Set(hand.filter((c) => c.k === 'M').flatMap(meaningsOf));
  const lone = loneMoves(s, p).filter((m) => {
    const v = hand.find((c) => c.id === m.v)!;
    return COMPOUNDS.some((c) => c.v === v.t && goals.has(c.g));
  });
  if (lone.length && s.main.length) return { move: lone[0], rng: rngState };

  // Swap rather than draw, giving away the meaning card that's least use with the verbs in reach.
  // Only where a swap counts towards turning the river (swapIsPass); otherwise swapping every turn
  // can keep the river from ever turning. Turn mode only: in a race, no play means Stuck.
  const share = SWAP_FOR_PASS[level];
  if (share > 0 && s.config.mode === 'turns' && s.config.rules?.swapIsPass && s.faceUp) {
    const worst = leastUseful(s, p);
    if (worst) {
      let go = share >= 1;
      if (!go) {
        const [r, st] = next(rngState);
        rngState = st;
        go = r < share;
      }
      if (go) return { move: { type: 'swap', m: worst }, rng: rngState };
    }
  }
  return { move: null, rng: rngState };
}

/** The hand meaning card with the fewest meanings a verb in hand or on the table could make. */
function leastUseful(s: GameState, p: number): number | null {
  const verbs = new Set([...s.hands[p], ...s.board].filter((c) => c.k === 'V').map((c) => c.t));
  let best: { id: number; live: number } | null = null;
  for (const m of s.hands[p]) {
    if (m.k !== 'M') continue;
    const live = meaningsOf(m).filter((g) => COMPOUNDS.some((c) => c.g === g && verbs.has(c.v))).length;
    if (!best || live < best.live) best = { id: m.id, live };
  }
  return best?.id ?? null;
}

/**
 * Easy's pick: the line that sheds most from its hand, blind to the fresh-line draw, and given the choice
 * it takes the particle from the river rather than building on the table (Phil: easy always goes river,
 * hard always table; the cases where the river's 2-card cost pays are niche).
 */
function riverFirst(lines: LineMove[]): LineMove | null {
  return [...lines].sort((a, b) => lineScore(b) - lineScore(a) || Number(isFresh(b)) - Number(isFresh(a)))[0] ?? null;
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
