import { describe, expect, it } from 'vitest';
import { botTurn } from './bot';
import { judgeSf } from './builder';
import { BASE } from './deck';
import { DIRS, apply, check, newGame, pouchPut, sfMoves, sfThroughMoves, wrongLine } from './game';
import { botMove } from './bot';
import { emptySelection, ways } from './builder';
import { SF, SF_PHRASE, SF_SETTINGS, applyRestore, applySettlement, botSfChance, emptySfProgress, migrateSfProgress, phraseSeen, pickBotWord, restoreCode, settleStorfhocail, sfUnlocked, wordSeen, type SfDeal, type SfProgress } from './storfhocail';
import { APP_RULES, type Card, type GameState, type LineMove, type PlayerConfig, type Placed, type SfMove } from './types';

let nid = 5000;
const V = (t: string): Card => ({ id: nid++, k: 'V', t });
const P = (t: string): Card => ({ id: nid++, k: 'P', t });
const at = (c: Card, x: number, y: number, axis: Placed['axis'] = null, extra: Partial<Placed> = {}): Placed => ({ ...c, x, y, axis, owner: -1, ...extra });

const you: PlayerConfig = { name: 'You', kind: 'human', color: 0 };
const hardBot: PlayerConfig = { name: 'B', kind: 'bot', level: 'hard', color: 1 };

function position(o: { board?: Placed[]; piles: string[][]; hand: Card[]; pouch?: string[] }): GameState {
  const s = structuredClone(newGame({ seed: 1, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players: [you, hardBot], firstPlayer: 0, sf: { on: true, owned: [], seenAny: true, layChance: 0 } }));
  s.board = o.board ?? [at(V('cuir'), 0, 0)];
  s.piles = o.piles.map((p) => p.map(P));
  s.hands = [o.hand, [V('tóg'), V('fan')]];
  s.sf = { pouch: { 0: o.pouch ?? [] }, laid: [], stake: false };
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

  it('a tile is never a particle: no ordinary line runs through it, nor does a different tile\'s phrase', () => {
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

describe('a line through a stórfhocal on the table', () => {
  // A bot laid tabhair · aire · do across the top; aire sits at (1, 0).
  const tableTile = (hand: Card[], piles: string[][] = [['do']]) => {
    const s = position({
      board: [at(V('tabhair'), 0, 0), at({ id: 100000, k: 'S', t: 's01' }, 1, 0, 'h', { owner: 1, phrase: 's01a' }), at(P('do'), 2, 0, 'h', { owner: 1 })],
      piles,
      hand,
    });
    s.sf!.laid = [{ word: 's01', phrase: 's01a', p: 1 }];
    return s;
  };

  it('runs down through the tile with a verb from the hand: no tile from the bag, nothing laid, the tile shared once', () => {
    const s = tableTile([V('tabhair'), V('fan')]);
    const mvs = sfThroughMoves(s, 0);
    expect(mvs.map((m) => [m.x, m.y, m.d[1]])).toEqual(expect.arrayContaining([[1, -1, 1], [1, 1, -1]]));
    const r = apply(s, 0, mvs.find((m) => m.d[1] === 1)!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.state;
    expect(t.board.filter((b) => b.k === 'S')).toHaveLength(1);
    expect(t.board.find((b) => b.k === 'S')!.cross).toBe(true);
    expect(t.sf!.laid).toEqual(s.sf!.laid);
    expect(t.hands[0].map((c) => c.t)).toEqual(['fan']);
    expect(t.lines.at(-1)).toMatchObject({ p: 0, c: 's01a', sf: true });
    expect(sfThroughMoves({ ...t, turn: 0 }, 0)).toEqual([]);
  });

  it('needs a verb from the hand, the tile where the phrase puts it, and no second shared card', () => {
    const s = tableTile([V('tabhair'), V('fan')]);
    const mv = sfThroughMoves(s, 0)[0];
    expect(check(s, 0, { ...mv, verb: { table: { x: 0, y: 0 } } })).toMatchObject({ why: 'NotLegal' });
    expect(check(s, 0, { ...mv, on: { x: 2, y: 0 } })).toMatchObject({ why: 'NotLegal' });
    expect(check(s, 0, mv)).toBeNull();
  });

  it('the builder offers it once the tile is picked, and a bot takes it when it has no other line', () => {
    const s = tableTile([V('tabhair'), V('fan')]);
    const ws = ways(s, 0, { ...emptySelection(), through: { x: 1, y: 0 } });
    expect(ws.length).toBeGreaterThan(0);
    expect(ws.every((w) => w.on && w.on.x === 1 && w.on.y === 0)).toBe(true);
    const b = structuredClone(s);
    b.hands = [[V('fan')], [V('tabhair')]];
    b.turn = 1;
    const choice = botMove(b, 1);
    expect(choice.move).toMatchObject({ type: 'sf', on: { x: 1, y: 0 } });
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
    expect(settleStorfhocail(ended(laid, { how: 'out', winners: [0], tie: false, counts: [0, 3] }))).toEqual({ gained: ['s05'], lost: [], vanished: [], returned: [] });
  });
  it('a bot wins: the player’s laid tiles are lost, bots’ vanish', () => {
    expect(settleStorfhocail(ended(laid, { how: 'fewest', winners: [1], tie: false, counts: [4, 2] }))).toEqual({ gained: [], lost: ['s01'], vanished: ['s05'], returned: [] });
  });
  it('a tie: the player keeps theirs, bots’ vanish', () => {
    expect(settleStorfhocail(ended(laid, { how: 'fewest', winners: [0, 1], tie: true, counts: [2, 2] }))).toEqual({ gained: [], lost: [], vanished: ['s05'], returned: [] });
  });
  it('quitting after laying one loses it; before laying, nothing is lost', () => {
    expect(settleStorfhocail(ended(laid, null), true)).toEqual({ gained: [], lost: ['s01'], vanished: ['s05'], returned: [] });
    expect(settleStorfhocail(ended([{ word: 's05', p: 1 }], null), true)).toEqual({ gained: [], lost: [], vanished: ['s05'], returned: [] });
  });

  // The claim: on an outright win, the bots' tiles come only if the player laid as many, or had nothing usable left.
  const won = (laid0: { word: string; p: number }[], bag: string[]) => {
    const s = ended(laid0, { how: 'out', winners: [0], tie: false, counts: [0, 3] });
    s.config = { ...s.config, sf: { on: true, owned: bag, seenAny: true } };
    return settleStorfhocail(s);
  };
  it('claim: 0 laid to their 1 with a usable tile in the bag: the bot’s tile goes back', () => {
    expect(won([{ word: 's05', p: 1 }], ['s02'])).toEqual({ gained: [], lost: [], vanished: [], returned: ['s05'] });
  });
  it('claim: 0 to 1 with an empty bag: claimed', () => {
    expect(won([{ word: 's05', p: 1 }], []).gained).toEqual(['s05']);
  });
  it('claim: 1 to 1: claimed', () => {
    expect(won([{ word: 's01', p: 0 }, { word: 's05', p: 1 }], ['s01', 's02']).gained).toEqual(['s05']);
  });
  it('claim: 1 to 2 with a tile left: neither of the bots’ tiles is claimed', () => {
    expect(won([{ word: 's01', p: 0 }, { word: 's05', p: 1 }, { word: 's06', p: 1 }], ['s01', 's02'])).toMatchObject({ gained: [], returned: ['s05', 's06'] });
  });
  it('claim: 2 to 2 after taking a second tile: claimed', () => {
    expect(won([{ word: 's01', p: 0 }, { word: 's05', p: 1 }, { word: 's02', p: 0 }, { word: 's06', p: 1 }], ['s01', 's02', 's03']).gained).toEqual(['s05', 's06']);
  });
  it('claim: every usable tile already laid counts as nothing left', () => {
    expect(won([{ word: 's01', p: 0 }, { word: 's05', p: 1 }, { word: 's06', p: 1 }], ['s01']).gained).toEqual(['s05', 's06']);
  });
});

describe('bots and stórfhocail', () => {
  const game = (sf: SfDeal, laid: { word: string; p: number }[] = [], stake = false) => {
    const s = newGame({ seed: 3, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players: [you, hardBot], sf });
    s.sf!.laid = laid.map((l) => ({ ...l, phrase: l.word + 'a' }));
    s.sf!.stake = stake;
    return s;
  };
  const p = SF_SETTINGS.botLayChance;

  it('the odds follow the stakes: raised until the first is seen, slim with an unrisked bag, full once you lay one', () => {
    expect(botSfChance(game({ on: true, owned: [], seenAny: false }))).toBeCloseTo(p * SF_SETTINGS.firstTileMultiplier);
    expect(botSfChance(game({ on: true, owned: [], seenAny: true }))).toBeCloseTo(p);
    // A usable tile in the bag and nothing of yours on the table: about 2%.
    expect(botSfChance(game({ on: true, owned: ['s01'], seenAny: true }))).toBeCloseTo(p / SF_SETTINGS.noStakeDivisor);
    // You laid one: full odds until a bot answers it.
    expect(botSfChance(game({ on: true, owned: ['s01', 's02'], seenAny: true }, [{ word: 's01', p: 0 }], true))).toBeCloseTo(p);
    expect(botSfChance(game({ on: true, owned: ['s01', 's02'], seenAny: true }, [{ word: 's01', p: 0 }, { word: 's05', p: 1 }], false))).toBeCloseTo(p / SF_SETTINGS.noStakeDivisor);
    // Your only tile is on the table: nothing left to venture, full odds.
    expect(botSfChance(game({ on: true, owned: ['s01'], seenAny: true }, [{ word: 's01', p: 0 }, { word: 's05', p: 1 }], false))).toBeCloseTo(p);
  });

  it('bots never lay more than one tile beyond the number you have laid', () => {
    expect(botSfChance(game({ on: true, owned: [], seenAny: true }, [{ word: 's05', p: 1 }]))).toBe(0);
    expect(botSfChance(game({ on: true, owned: [], seenAny: true }, [{ word: 's01', p: 0 }, { word: 's05', p: 1 }]))).toBeGreaterThan(0);
  });

  it('a bot leans 3 to 1 towards words you don’t own', () => {
    const deal: SfDeal = { on: true, owned: ['s01'], seenAny: true };
    const n = 4000;
    let mine = 0;
    for (let i = 0; i < n; i++) if (pickBotWord(['s01', 's02'], deal, i / n) === 's01') mine++;
    expect(mine / n).toBeCloseTo(SF_SETTINGS.botWeights.owned / (SF_SETTINGS.botWeights.owned + SF_SETTINGS.botWeights.unowned), 2);
  });

  it('only Hard bots lay one; with the chance forced to 1 they do, within the cap', () => {
    let laid = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const players: PlayerConfig[] = [{ ...hardBot, color: 0, level: 'normal' }, { ...hardBot, name: 'C' }];
      let s = newGame({ seed, mode: 'turns', answers: 'shown', hints: 'off', rules: APP_RULES, players, sf: { on: true, owned: [], seenAny: true, layChance: 1 } });
      let t = 0;
      while (!s.over && t < 4000) {
        s = botTurn(s, s.turn);
        t++;
      }
      expect(s.over).not.toBeNull();
      // Only the Hard bot lays tiles (the Normal one may still run a line through one on the table).
      expect(s.sf!.laid.filter((l) => l.p === 0)).toEqual([]);
      // No human at the table has laid any, so the cap holds the bots to one.
      expect(s.sf!.laid.length).toBeLessThanOrEqual(1);
      laid += s.sf!.laid.length;
    }
    expect(laid).toBeGreaterThan(20);
  });

  it('a bot never lays a phrase this deck can’t complete', () => {
    const s = game({ on: true, owned: [], seenAny: true });
    s.config = { ...s.config, deck: { ...BASE, verbs: { base: { ...BASE.verbs.base, tabhair: 0 }, pack3to4: { ...BASE.verbs.pack3to4, tabhair: 0 } } } };
    s.hands[1] = [{ id: 9001, k: 'V', t: 'tabhair' }, ...s.hands[1]];
    newGame(s.config); // makes the custom deck active
    for (const w of ['s01', 's13', 's14', 's15', 's16', 's17', 's18']) expect(sfMoves(s, 1, w, 4)).toEqual([]);
    newGame({ ...s.config, deck: undefined });
  });

  it('turning stórfhocail on never changes the deal; a replay deals the same but rolls afresh', () => {
    const cfg = { seed: 77, mode: 'turns' as const, answers: 'shown' as const, hints: 'off' as const, rules: APP_RULES, players: [you, hardBot] };
    const a = newGame(cfg),
      b = newGame({ ...cfg, sf: { on: true, owned: [], seenAny: false, roll: 1 } }),
      c = newGame({ ...cfg, sf: { on: true, owned: [], seenAny: false, roll: 2 } });
    for (const x of [b, c]) {
      expect(x.hands).toEqual(a.hands);
      expect(x.piles).toEqual(a.piles);
      expect(x.board).toEqual(a.board);
    }
    expect(b.rng).not.toBe(c.rng);
  });

  it('one tile in hand at a time; another once the first is laid or put back', () => {
    const s = game({ on: true, owned: ['s01', 's02'], seenAny: true });
    const r = pouchPut(s, 0, 's01');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(pouchPut(r.state, 0, 's02').ok).toBe(false);
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
  it('a settlement fills and empties slots (a second copy adds nothing); a lost word is remembered until won back', () => {
    let pr: SfProgress = { ...emptySfProgress(), owned: { s01: 1 } };
    pr = applySettlement(pr, { gained: ['s05'], lost: ['s01'], vanished: [], returned: [] }, ['s01'], '2026-10-28');
    expect(pr.owned).toEqual({ s05: 1 });
    expect(pr.lostByPlayer).toEqual(['s01']);
    expect(pr.laid).toEqual({ s01: 1 });
    pr = applySettlement(pr, { gained: ['s01', 's05'], lost: [], vanished: [], returned: [] }, [], '2026-10-29', { s01: 'Giorria' });
    expect(pr.owned).toEqual({ s05: 1, s01: 1 });
    expect(pr.wonFrom.s01).toEqual({ name: 'Giorria', date: '2026-10-29' });
    expect(pr.lostByPlayer).toEqual([]);
    expect(pr.history.map((h) => h.date)).toEqual(['2026-10-28', '2026-10-29']);
  });

  it('the bag shows from the first tile and stays after the last is lost', () => {
    let pr = emptySfProgress();
    expect(pr.bagRevealed).toBe(false);
    pr = applySettlement(pr, { gained: ['s02'], lost: [], vanished: [], returned: [] }, [], 'd');
    expect(pr.bagRevealed).toBe(true);
    pr = applySettlement(pr, { gained: [], lost: ['s02'], vanished: [], returned: [] }, ['s02'], 'd');
    expect(pr.owned).toEqual({});
    expect(pr.bagRevealed).toBe(true);
  });

  it('unlocks at the set number of finished games, or by the secret; earlier progress carries over', () => {
    const n = SF_SETTINGS.unlockAfterGames;
    expect(sfUnlocked({ ...emptySfProgress(), finishedGames: n - 1 })).toBe(false);
    expect(sfUnlocked({ ...emptySfProgress(), finishedGames: n })).toBe(true);
    expect(sfUnlocked({ ...emptySfProgress(), unlocked: true })).toBe(true);
    const old = migrateSfProgress({ finishedSoloGames: 7, owned: { s01: 2 } } as Partial<SfProgress>);
    expect(old.finishedGames).toBe(7);
    expect(old.owned).toEqual({ s01: 1 });
  });

  it('a restore code round-trips, and restores only into an empty bag', () => {
    const ten = Object.fromEntries(SF.words.slice(0, 10).map((w) => [w.id, 1]));
    const pr: SfProgress = { ...emptySfProgress(), owned: ten, seen: { s01a: { times: 3, last: 'd' } } };
    const code = restoreCode(pr);
    expect(code).toMatch(/^BA1-/);
    const back = applyRestore(emptySfProgress(), code, 'd');
    expect(back.progress!.owned).toEqual(ten);
    expect(back.progress!.seen.s01a.times).toBe(3);
    expect(back.progress!.restorePoint).toMatchObject({ at: 10, saved: true });
    expect(applyRestore({ ...emptySfProgress(), owned: { s02: 1 } }, code, 'd').error).toBe('notEmpty');
    expect(applyRestore(emptySfProgress(), code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'), 'd').error).toBe('badCode');
    expect(applyRestore(emptySfProgress(), 'hello', 'd').error).toBe('badCode');
  });

  it('a restore point is taken when the bag reaches 10, waits to be saved, and survives a lost tile', () => {
    const ids = SF.words.map((w) => w.id);
    const nine: SfProgress = { ...emptySfProgress(), owned: Object.fromEntries(ids.slice(0, 9).map((w) => [w, 1])) };
    expect(applySettlement(nine, { gained: [], lost: [], vanished: [], returned: [] }, [], 'd').restorePoint).toBeUndefined();
    let pr = applySettlement(nine, { gained: [ids[9]], lost: [], vanished: [], returned: [] }, [], '2026-10-30');
    const rp = pr.restorePoint!;
    expect(rp).toMatchObject({ at: 10, saved: false, reached: '2026-10-30' });
    expect(rp.words.sort()).toEqual(ids.slice(0, 10).sort());
    // Later, then a tile lost to a bot: the point and its code stay, and still restore the 10.
    pr = applySettlement(pr, { gained: [], lost: [ids[0]], vanished: [], returned: [] }, [ids[0]], 'd');
    expect(pr.restorePoint).toEqual(rp);
    expect(Object.keys(applyRestore(emptySfProgress(), rp.code, 'd').progress!.owned).length).toBe(10);
  });

  it('a jump from 9 to 12 takes a 10-tile point, without the tiles won last', () => {
    const ids = SF.words.map((w) => w.id);
    const nine: SfProgress = { ...emptySfProgress(), owned: Object.fromEntries(ids.slice(0, 9).map((w) => [w, 1])) };
    const pr = applySettlement(nine, { gained: [ids[9], ids[10], ids[11]], lost: [], vanished: [], returned: [] }, [], 'd');
    expect(pr.restorePoint!.at).toBe(10);
    expect(pr.restorePoint!.words.sort()).toEqual(ids.slice(0, 10).sort());
    // Saved, then 20: a new point replaces it; going back below 10 and up again doesn't.
    const saved = { ...pr, restorePoint: { ...pr.restorePoint!, saved: true } };
    const again = applySettlement(saved, { gained: [], lost: [ids[0]], vanished: [], returned: [] }, [], 'd');
    expect(applySettlement(again, { gained: [ids[0]], lost: [], vanished: [], returned: [] }, [], 'd').restorePoint!.saved).toBe(true);
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
