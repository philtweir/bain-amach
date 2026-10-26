// Engine types. Everything in GameState is plain JSON: no Maps, no class instances.

export type Kind = 'V' | 'P' | 'M' | 'W';

/** A card. `t` is the verb or particle word, '*' for a wildcard, or the meaning-card id (m01…) for a meaning card. */
export interface Card {
  id: number;
  k: Kind;
  t: string;
}

export type Axis = 'h' | 'v';

/** A card on the table. */
export interface Placed extends Card {
  x: number;
  y: number;
  axis: Axis | null;
  /** Player who laid it; -1 for the starter verbs. */
  owner: number;
  /** Particle shared by two crossing lines. */
  cross?: boolean;
  /** Meaning cards: which of the three meanings it is used as. */
  used?: string;
  /** Wildcards: the particle it stands for. */
  stands?: string;
}

export type Dir = [number, number];

export type Src = { river: number } | { wild: number } | { existing: true };

export type VerbSrc = { table: { x: number; y: number } } | { hand: number };

export interface LineMove {
  type: 'line';
  /** Meaning card id (card.id): from the hand, or the table card when `onto` is set. */
  m: number;
  /** The line ends on a meaning card already on the table, at this cell (rule variant tableMeanings). */
  onto?: { x: number; y: number };
  /** The meaning it is used as. */
  g: string;
  /** Compound id. */
  c: string;
  verb: VerbSrc;
  x: number;
  y: number;
  d: Dir;
  src: Src[];
}

export interface LoneMove {
  type: 'lone';
  v: number;
  x: number;
  y: number;
}

export interface SwapMove {
  type: 'swap';
  m: number;
}

export type Move = LineMove | LoneMove | SwapMove;

export type Level = 'easy' | 'normal' | 'hard';

export interface PlayerConfig {
  name: string;
  kind: 'human' | 'bot';
  level?: Level;
  /** Player colour/pattern slot, 0–3. */
  color: number;
}

export type Mode = 'turns' | 'race';
export type Answers = 'shown' | 'hidden';
export type Hints = 'off' | 'request' | 'auto';

export interface GameConfig {
  seed: number;
  players: PlayerConfig[];
  mode: Mode;
  answers: Answers;
  hints: Hints;
  /** Fixed first player (tutorial, reference parity). Random otherwise. */
  firstPlayer?: number;
  /** Bots may swap meaning cards. Off only for parity with the reference engine. */
  botSwaps?: boolean;
  /** Reference-engine stall counting (never resets after a play). Parity tests only. */
  legacyStall?: boolean;
  tutorial?: boolean;
  /** Rule variants for playtesting. All off by default (RULES.md as written). */
  rules?: RuleVariant;
}

export interface RuleVariant {
  /** Meaning cards dealt into each hand (deck.json's meaningsInHand otherwise). Hand size is unchanged. */
  meaningsInHand?: number;
  /** The "fewer than 2 meanings draws a meaning" rule also applies to a lone verb's draws. */
  meaningOnAnyDraw?: boolean;
  /** After laying a line, a player left with no meaning cards draws one from the meaning pile. */
  refillMeaning?: boolean;
  /** A line may end on a meaning card already on the table, as any of its three meanings, arriving
   *  from a free side. The verb comes from the hand; no particle on the line may be a crossing. */
  tableMeanings?: boolean;
  /** A fresh line, using no card already on the table (verb from the hand, no crossing, not onto a
   *  table meaning card), draws this many cards afterwards, like a lone verb. Touching other cards
   *  doesn't count as using them. */
  freshLineDraw?: number;
  /** Swap: your meaning card goes to the bottom of the meaning pile and the next one turns face up,
   *  so swapping again shows a new card instead of handing yours straight back. */
  swapRefresh?: boolean;
  /** Turn mode: a swap counts towards the river turning like a pass (without the draw), instead of
   *  resetting the pass count. Otherwise swapping every turn would keep the river from ever turning. */
  swapIsPass?: boolean;
  /** Experimental, not in APP_RULES: draw and pass draws nothing (a plain pass). */
  noPassDraw?: boolean;
}

/** The rules the app plays (Phil, 2026-10-26). The engine default stays RULES.md as written. */
export const APP_RULES: RuleVariant = { refillMeaning: true, tableMeanings: true, freshLineDraw: 2, swapRefresh: true, swapIsPass: true };

export interface Line {
  p: number;
  c: string;
  g: string;
  cells: [number, number][];
  wild: boolean;
  straddle: boolean;
  turnNo: number;
}

export interface Missed {
  c: string;
  g: string;
  turnNo: number;
  wild: boolean;
  /** River words that were on top and used by the line. */
  river: string[];
  verbOnTable: boolean;
}

export type GameEvent =
  | { e: 'line'; p: number; c: string; g: string; cells: [number, number][]; wild: boolean; straddle: boolean; river: number[]; turnNo: number; drew?: number[] }
  | { e: 'lone'; p: number; word: string; x: number; y: number; drew: number[]; turnNo: number }
  | { e: 'swap'; p: number; gave: number; took: number; turnNo: number }
  | { e: 'pass'; p: number; drew: number | null; turnNo: number }
  | { e: 'wrong'; p: number; turnNo: number }
  | { e: 'stuck'; p: number; on: boolean }
  | { e: 'stall'; drew: (number | null)[]; final: number | null; turnNo: number }
  | { e: 'end'; how: 'out' | 'fewest' };

export interface Over {
  how: 'out' | 'fewest';
  winners: number[];
  tie: boolean;
  counts: number[];
}

export interface GameState {
  v: 1;
  config: GameConfig;
  /** RNG state for bot decisions, so a replay with the same moves is identical. */
  rng: number;
  board: Placed[];
  lines: Line[];
  piles: Card[][];
  /** The hand deck. Top is the end of the array. */
  main: Card[];
  /** The face-down meaning pile. Top is the end of the array. */
  mpile: Card[];
  faceUp: Card | null;
  hands: Card[][];
  turn: number;
  turnNo: number;
  passes: number;
  /** Consecutive stalls with both piles empty and no line laid. */
  stalls: number;
  /** Stalls since the last line or lone verb (swapIsPass's backstop against a game nobody can move). */
  quiet?: number;
  stuck: boolean[];
  over: Over | null;
  log: GameEvent[];
  missed: Missed[][];
  hintsUsed: boolean[];
}

export type Rejection =
  | { why: 'Taken'; by: number | null; card?: { river: number } | { x: number; y: number } }
  | { why: 'NotLegal'; detail: string }
  | { why: 'WrongLine'; kind: 'NoSuchCompound'; verb: string; parts: string[] }
  | { why: 'WrongLine'; kind: 'NotOnCard'; text: string };

export type Result = { ok: true; state: GameState } | { ok: false; reason: Rejection };
