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
  /** Meaning card id (card.id) from the hand. */
  m: number;
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
}

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
  | { e: 'line'; p: number; c: string; g: string; cells: [number, number][]; wild: boolean; straddle: boolean; river: number[]; turnNo: number }
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
