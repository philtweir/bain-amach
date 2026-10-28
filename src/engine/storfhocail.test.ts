import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { judgeSf } from './builder';
import { BASE } from './deck';
import { DIRS, apply, check, newGame, sfMoves, wrongLine } from './game';
import { SF, SF_PHRASE, SF_SETTINGS, applySettlement, emptySfProgress, ownTurn, phraseSeen, settleStorfhocail, sfUnlocked, wordSeen, type SfProgress } from './storfhocail';
import { APP_RULES, type Card, type GameState, type LineMove, type PlayerConfig, type Placed, type SfMove } from './types';

let nid = 5000;
const V = (t: string): Card => ({ id: nid++, k: 'V', t });
const P = (t: string): Card => ({ id: nid++, k: 'P', t });
const at = (c: Card, x: number, y: number, axis: Placed['axis'] = null, extra: Partial<Placed> = {}): Placed => ({ ...c, x, y, axis, owner: -1, ...extra });

const you: PlayerConfig = { name: 'You', kind: 'human', color: 0 };
const hardBot: PlayerConfig = { name: 'B', kind: 'bot', level: 'hard', color: 1 };

function position(o: { board?: Placed[]; piles: string[][]; hand: Card[]; pouch?: string[] }): GameState {
  const s = structuredClone(newGame({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players: [you, hardBot], firstPlayer: 0, sf: { on: true, lost: [], owned: [], seenAny: true, carryChance: 0 } }));
  s.board = o.board ?? [at(V('cuir'), 0, 0)];
  s.piles = o.piles.map((p) => p.map(P));
  s.hands = [o.hand, [V('tóg'), V('fan')]];
  s.sf = { pouch: { 0: o.pouch ?? [] }, carry: {}, laid: [] };
  s.turn = 0;
  return structuredClone(s);
}
const pile = (s: GameState, word: string) => s.piles.findIndex((p) => p[p.length - 1]?.t === word);

describe('stórfhocal lines', () => {
  it('a phrase that is not on the tile is refused', () => {
    const tabhair = V('tabhair');
    const s = position({ piles: [['do'], ['as'], ['ar'], ['le'], ['amach']], hand: [tabhair], pouch: ['s01'] });
    const mv: SfMove = { type: 'sf', word: 's01', phrase: 's02a', verb: { hand: tabhair.id }, x: 0, y: 3, d: [1, 0], src: [{ river: 0 }] };
    expect(check(s, 0, mv)).toMatchObject({ why: 'NotLegal', detail: 'that phrase is not on this tile' });
  });

  it('lays aire with tabhair from the hand: tile then particle, no meaning card, and the tile leaves the pouch', () => {
    const tabhair = V('tabhair');
    const s = position({ piles: [['do'], ['as'], ['ar'], ['le'], ['amach']], hand: [tabhair, V('fan')], pouch: ['s01'] });
    const mv = sfMoves(s, 0, 's01').find((m) => 'hand' in m.verb)!;
    const r = apply(s, 0, mv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const line = r.state.lines.at(-1)!;
    expect(line).toMatchObject({ c: 's01a', g: 'TAKE CARE OF', sf: true });
    expect(line.cells).toHaveLength(3);
    const [, tile, part] = line.cells.map(([x, y]) => r.state.board.find((b) => b.x === x && b.y === y)!);
    expect(tile).toMatchObject({ k: 'S', t: 's01', phrase: 's01a' });
    expect(part).toMatchObject({ k: 'P', t: 'do' });
    expect(r.state.sf!.pouch[0]).toEqual([]);
    expect(r.state.sf!.laid).toEqual([{ word: 's01', phrase: 's01a', p: 0 }]);
    expect(r.state.hands[0].map((c) => c.t)).toEqual(['fan']);
  });

  it('particle-then-tile phrases (tabhair le fios, tabhair faoi deara) work in all four directions', () => {
    for (const [word, phrase, part] of [['s08', 's08b', 'le'], ['s18', 's18a', 'faoi']] as const)
      for (const d of DIRS) {
        const s = position({ board: [at(V('tabhair'), 0, 0)], piles: [[part], ['as'], ['ar'], ['do'], ['amach']], hand: [V('fan')], pouch: [word] });
        const mv: SfMove = { type: 'sf', word, phrase, verb: { table: { x: 0, y: 0 } }, x: 0, y: 0, d, src: [{ river: 0 }] };
        const r = apply(s, 0, mv);
        expect(r.ok, `${phrase} ${d}`).toBe(true);
        if (!r.ok) continue;
        const cell = (k: number) => r.state.board.find((b) => b.x === d[0] * k && b.y === d[1] * k);
        expect(cell(1)).toMatchObject({ k: 'P', t: part });
        expect(cell(2)).toMatchObject({ k: 'S', t: word });
      }
  });

  it('may run through a particle already down (verb from the hand)', () => {
    const tabhair = V('tabhair');
    const s = position({ board: [at(V('cuir'), 0, 0), at(P('do'), 1, 0, 'h'), at(V('lig'), 5, 5)], piles: [['as'], ['ar'], ['le'], ['amach'], ['suas']], hand: [tabhair, V('fan')], pouch: ['s01'] });
    const through = sfMoves(s, 0, 's01').filter((m) => m.src.some((x) => 'existing' in x));
    expect(through.length).toBeGreaterThan(0);
    const r = apply(s, 0, through[0]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.board.find((b) => b.x === 1 && b.y === 0)!.cross).toBe(true);
  });

  it('nothing runs through a stórfhocal: not a regular line, not another stórfhocal line', () => {
    const eist = V('éist');
    const tile = at({ id: 100000, k: 'S', t: 's11' }, 2, 0, 'h', { phrase: 's11a' });
    const s = position({ board: [at(V('cuir'), 0, 0), tile], piles: [['le'], ['as'], ['ar'], ['do'], ['amach']], hand: [eist, { id: nid++, k: 'M', t: 'm01' }, V('tabhair')], pouch: ['s01'] });
    // éist le, the 'le' cell being the tile's cell.
    const line: LineMove = { type: 'line', m: s.hands[0][1].id, g: 'LISTEN TO', c: 'c32', verb: { hand: eist.id }, x: 2, y: -1, d: [0, 1], src: [{ existing: true }] };
    expect(check(s, 0, line)).toMatchObject({ why: 'NotLegal' });
    const sf: SfMove = { type: 'sf', word: 's01', phrase: 's01a', verb: { hand: s.hands[0][2].id }, x: 2, y: -2, d: [0, 1], src: [{ existing: true }] };
    expect(check(s, 0, sf)).not.toBeNull();
    expect(sfMoves(s, 0, 's01').every((m) => !m.src.some((x) => 'existing' in x))).toBe(true);
  });

  it('hidden mode: the tile in the wrong place, or a wildcard as the tile, is refused; then the usual penalty', () => {
    const tabhair = V('tabhair');
    const wild: Card = { id: nid++, k: 'W', t: '*' };
    const s = position({ board: [at(V('cuir'), 0, 0)], piles: [['le'], ['do'], ['ar'], ['as'], ['amach']], hand: [tabhair, wild, V('fan')], pouch: ['s08', 's01'] });
    // tabhair le fios: particle then tile. Tile first is wrong.
    expect(judgeSf(s, 0, { word: 's08', verb: { hand: tabhair.id }, parts: [{ tile: true }, { river: pile(s, 'le') }] })).toMatchObject({ ok: false, reason: { why: 'WrongLine' } });
    const good = judgeSf(s, 0, { word: 's08', verb: { hand: tabhair.id }, parts: [{ river: pile(s, 'le') }, { tile: true }] });
    expect(good.ok).toBe(true);
    if (good.ok) expect(apply(s, 0, good.move).ok).toBe(true);
    // A wildcard can't be the tile.
    expect(judgeSf(s, 0, { word: 's01', verb: { hand: tabhair.id }, parts: [{ wild: wild.id }, { river: pile(s, 'do') }] }).ok).toBe(false);
    // The penalty for a wrong line: the turn ends, counting as a pass.
    const w = wrongLine(s, 0);
    expect(w.ok && w.state.turn).toBe(1);
  });

  it('a stórfhocal is never a hand card: a hand emptied with a tile still in the pouch has gone out', () => {
    const tabhair = V('tabhair');
    const s = position({ piles: [['do'], ['as'], ['ar'], ['le'], ['amach']], hand: [tabhair], pouch: ['s01', 's05'] });
    const r = apply(s, 0, sfMoves(s, 0, 's01').find((m) => 'hand' in m.verb)!);
    expect(r.ok && r.state.over).toMatchObject({ how: 'out', winners: [0] });
  });
});

describe('settling up', () => {
  const ended = (laid: { word: string; p: number }[], over: GameState['over']): GameState => {
    const s = position({ piles: [['do']], hand: [V('fan')] });
    s.sf!.laid = laid.map((l) => ({ ...l, phrase: SF.words.find((w) => w.id === l.word)!.phrases[0].id }));
    s.over = over;
    return s;
  };
  const laid = [
    { word: 's01', p: 0 },
    { word: 's05', p: 1 },
  ];
  it('the player wins: bots’ tiles come to the bag, the player’s go back', () => {
    expect(settleStorfhocail(ended(laid, { how: 'out', winners: [0], tie: false, counts: [0, 3] }))).toEqual({ gained: ['s05'], lost: [], vanished: [] });
  });
  it('a bot wins: the player’s laid tiles are lost, bots’ vanish', () => {
    expect(settleStorfhocail(ended(laid, { how: 'fewest', winners: [1], tie: false, counts: [4, 2] }))).toEqual({ gained: [], lost: ['s01'], vanished: ['s05'] });
  });
  it('a tie: the player keeps theirs, bots’ vanish', () => {
    expect(settleStorfhocail(ended(laid, { how: 'fewest', winners: [0, 1], tie: true, counts: [2, 2] }))).toEqual({ gained: [], lost: [], vanished: ['s05'] });
  });
  it('quitting after laying one loses it; before laying, nothing is lost', () => {
    expect(settleStorfhocail(ended(laid, null), true)).toEqual({ gained: [], lost: ['s01'], vanished: ['s05'] });
    expect(settleStorfhocail(ended([{ word: 's05', p: 1 }], null), true)).toEqual({ gained: [], lost: [], vanished: ['s05'] });
  });
});

describe('bots and stórfhocail', () => {
  it('only Hard bots carry one; with the chance forced to 1 every Hard bot does', () => {
    const players: PlayerConfig[] = [you, { ...hardBot, level: 'easy' }, { ...hardBot, level: 'normal', color: 2 }, { ...hardBot, color: 3 }];
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players, sf: { on: true, lost: [], owned: [], seenAny: true, carryChance: 1 } });
      expect(Object.keys(s.sf!.carry)).toEqual(['3']);
      const c = s.sf!.carry[3];
      expect(c.target).toBeGreaterThanOrEqual(3);
      expect(c.target).toBeLessThanOrEqual(10);
    }
  });

  it('a Hard bot lays its word no earlier than its target turn, and never more than one', () => {
    let laidSome = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const players: PlayerConfig[] = [{ ...hardBot, color: 0 }, { ...hardBot, name: 'C' }];
      let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players, sf: { on: true, lost: [], owned: [], seenAny: true, carryChance: 1 } });
      let t = 0;
      while (!s.over && t < 4000) {
        const p = s.turn;
        const turnNo = ownTurn(s, p);
        const before = s.lines.filter((l) => l.sf && l.p === p).length;
        s = botTurn(s, p);
        const after = s.lines.filter((l) => l.sf && l.p === p).length;
        if (after > before) {
          laidSome++;
          expect(turnNo).toBeGreaterThanOrEqual(s.sf!.carry[p].target);
        }
        t++;
      }
      expect(s.over).not.toBeNull();
      for (const p of [0, 1]) expect(s.lines.filter((l) => l.sf && l.p === p).length).toBeLessThanOrEqual(1);
    }
    expect(laidSome).toBeGreaterThan(20);
  });

  it('turning stórfhocail on never changes the deal', () => {
    const cfg = { seed: 77, mode: 'turns' as const, answers: 'shown' as const, hints: 'off' as const, rules: APP_RULES, players: [you, hardBot] };
    const a = newGame(cfg),
      b = newGame({ ...cfg, sf: { on: true, lost: [], owned: [], seenAny: false } });
    expect(b.hands).toEqual(a.hands);
    expect(b.piles).toEqual(a.piles);
    expect(b.board).toEqual(a.board);
  });
});

describe('stórfhocal data', () => {
  const verbs = new Set([...Object.keys(BASE.verbs.base), ...Object.keys(BASE.verbs.pack3to4)]);
  const parts = new Set(BASE.particles.map((p) => p.word));
  const meanings = new Set(BASE.compounds.map((c) => c.meaning));
  it('every phrase uses only verbs and particles from deck.json, with exactly one tile cell', () => {
    for (const ph of Object.values(SF_PHRASE)) {
      expect(verbs.has(ph.verb), ph.id).toBe(true);
      expect(ph.pattern.filter((t) => t === '~').length, ph.id).toBe(1);
      for (const t of ph.pattern) if (t !== '~') expect(parts.has(t), `${ph.id} ${t}`).toBe(true);
    }
  });
  it('no stórfhocal meaning repeats a regular meaning, and ids are unique', () => {
    for (const ph of Object.values(SF_PHRASE)) expect(meanings.has(ph.meaning), `${ph.id} ${ph.meaning}`).toBe(false);
    const ids = SF.words.flatMap((w) => [w.id, ...w.phrases.map((p) => p.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the bag and progress', () => {
  it('a settlement moves counts: +1 won, −1 lost; a lost word is remembered until won back', () => {
    let pr: SfProgress = { ...emptySfProgress(), owned: { s01: 1 } };
    pr = applySettlement(pr, { gained: ['s05'], lost: ['s01'], vanished: [] }, ['s01'], '2026-10-28');
    expect(pr.owned).toEqual({ s05: 1 });
    expect(pr.lostByPlayer).toEqual(['s01']);
    expect(pr.laid).toEqual({ s01: 1 });
    pr = applySettlement(pr, { gained: ['s01', 's05'], lost: [], vanished: [] }, [], '2026-10-29');
    expect(pr.owned).toEqual({ s05: 2, s01: 1 });
    expect(pr.lostByPlayer).toEqual([]);
    expect(pr.history.map((h) => h.date)).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('the bag shows from the first tile and stays after the last is lost', () => {
    let pr = emptySfProgress();
    expect(pr.bagRevealed).toBe(false);
    pr = applySettlement(pr, { gained: ['s02'], lost: [], vanished: [] }, [], 'd');
    expect(pr.bagRevealed).toBe(true);
    pr = applySettlement(pr, { gained: [], lost: ['s02'], vanished: [] }, ['s02'], 'd');
    expect(pr.owned).toEqual({});
    expect(pr.bagRevealed).toBe(true);
  });

  it('unlocks at the set number of finished solo games, or by the secret', () => {
    const n = SF_SETTINGS.unlockAfterGames;
    expect(sfUnlocked({ ...emptySfProgress(), finishedSoloGames: n - 1 })).toBe(false);
    expect(sfUnlocked({ ...emptySfProgress(), finishedSoloGames: n })).toBe(true);
    expect(sfUnlocked({ ...emptySfProgress(), unlocked: true })).toBe(true);
  });

  it('a phrase is seen once laid, or once its tile is owned (printed on it)', () => {
    const pr = { ...emptySfProgress(), seen: { s05a: { times: 1, last: 'd' } }, owned: { s06: 1 } };
    expect(phraseSeen(pr, 's05a')).toBe(true);
    expect(phraseSeen(pr, 's06a')).toBe(true);
    expect(phraseSeen(pr, 's06b')).toBe(true);
    expect(phraseSeen(pr, 's01a')).toBe(false);
    expect(wordSeen(pr, 's05')).toBe(true);
    expect(wordSeen(pr, 's01')).toBe(false);
  });
});
