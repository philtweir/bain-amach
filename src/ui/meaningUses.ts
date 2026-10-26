// Which lines end on each meaning card on the board, with the meaning each used and the side it
// arrives from. The first is the card's own line (the meaning it shows on its own); later lines can
// end on its other sides with any of its three meanings.
import type { GameState } from '../engine/types';

export type Side = 'n' | 'e' | 's' | 'w';
export interface Use {
  g: string;
  side: Side;
}

export function meaningUses(lines: GameState['lines']): Map<string, Use[]> {
  const m = new Map<string, Use[]>();
  for (const l of lines) {
    const [mx, my] = l.cells[l.cells.length - 1];
    const prev = l.cells[l.cells.length - 2];
    if (!prev) continue;
    const side: Side = prev[0] < mx ? 'w' : prev[0] > mx ? 'e' : prev[1] < my ? 'n' : 's';
    const k = mx + ',' + my;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push({ g: l.g, side });
  }
  return m;
}

/** The meanings in use, in the order first made, each with every side a line using it arrives from. */
export function byMeaning(uses: Use[]): { g: string; sides: Side[] }[] {
  const out: { g: string; sides: Side[] }[] = [];
  for (const u of uses) {
    const e = out.find((x) => x.g === u.g);
    if (e) e.sides.push(u.side);
    else out.push({ g: u.g, sides: [u.side] });
  }
  return out;
}

/** Arrow pointing towards the line, for the tap view: ← PUT OFF means its line is to the left. */
export const SIDE_ARROW: Record<Side, string> = { w: '←', e: '→', n: '↑', s: '↓' };

type Box = { left: number; top: number; w: number; h: number };
export interface Half {
  clip: string;
  box: Box;
}

const TL = '0 0', TR = '100% 0', BR = '100% 100%', BL = '0 100%';
const poly = (...pts: string[]) => `polygon(${pts.join(', ')})`;
// Diagonal halves: each a triangle against its own side, its text near the right-angle corner.
const DIAG: Record<string, Record<string, Half>> = {
  nw: { w: { clip: poly(TL, BL, BR), box: { left: 0, top: 40, w: 60, h: 60 } }, n: { clip: poly(TL, TR, BR), box: { left: 40, top: 0, w: 60, h: 60 } } },
  en: { n: { clip: poly(TL, TR, BL), box: { left: 0, top: 0, w: 60, h: 60 } }, e: { clip: poly(TR, BR, BL), box: { left: 40, top: 40, w: 60, h: 60 } } },
  es: { e: { clip: poly(TL, TR, BR), box: { left: 40, top: 0, w: 60, h: 60 } }, s: { clip: poly(TL, BL, BR), box: { left: 0, top: 40, w: 60, h: 60 } } },
  sw: { s: { clip: poly(TR, BR, BL), box: { left: 40, top: 40, w: 60, h: 60 } }, w: { clip: poly(TL, TR, BL), box: { left: 0, top: 0, w: 60, h: 60 } } },
};
const STRAIGHT: Record<Side, Half> = {
  w: { clip: poly(TL, '50% 0', '50% 100%', BL), box: { left: 0, top: 0, w: 50, h: 100 } },
  e: { clip: poly('50% 0', TR, BR, '50% 100%'), box: { left: 50, top: 0, w: 50, h: 100 } },
  n: { clip: poly(TL, TR, '100% 50%', '0 50%'), box: { left: 0, top: 0, w: 100, h: 50 } },
  s: { clip: poly('0 50%', '100% 50%', BR, BL), box: { left: 0, top: 50, w: 100, h: 50 } },
};

/**
 * Split a card between two lines so each half touches the side its line arrives from: down the
 * middle for opposite sides, along the diagonal through the shared corner for adjacent ones.
 */
export function splitHalves(a: Side, b: Side): [Half, Half] {
  const opposite = (a === 'w' && b === 'e') || (a === 'e' && b === 'w') || (a === 'n' && b === 's') || (a === 's' && b === 'n');
  if (opposite || a === b) return [STRAIGHT[a], STRAIGHT[a === b ? ({ w: 'e', e: 'w', n: 's', s: 'n' } as const)[a] : b]];
  const key = [a, b].sort().join('');
  return [DIAG[key][a], DIAG[key][b]];
}
