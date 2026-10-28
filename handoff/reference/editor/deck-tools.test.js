// node reference/editor/deck-tools.test.js
const assert = require("assert");
const path = require("path");
const base = require("../../data/deck.json");
const T = require("./deck-tools.js");

// Run the reference engine on any deck object by swapping deck.json in the require cache.
function engineFor(deck) {
  const deckPath = require.resolve("../../data/deck.json"), enginePath = require.resolve("../engine/engine.js");
  const real = require.cache[deckPath];
  require.cache[deckPath] = { id: deckPath, filename: deckPath, loaded: true, exports: deck };
  delete require.cache[enginePath];
  const mod = require(enginePath);
  require.cache[deckPath] = real; delete require.cache[enginePath];
  return mod;
}
function play(deck, n, games = 100) {
  const { Game } = engineFor(deck); let lines = 0, out = 0, unfinished = 0;
  for (let s = 1; s <= games; s++) {
    const g = new Game(s, n); let t = 0;
    while (!g.over && t < 4000) { const p = g.turn, mv = g.botMove(p); if (mv) g.apply(p, mv); else g.pass(p); g.next(); t++; }
    if (!g.over) unfinished++; else { lines += g.lines.length; if (g.over.how === "out") out++; }
  }
  return { lines: +(lines / games).toFixed(1), out: Math.round(100 * out / games), unfinished };
}

// 1. The default deck, rebuilt through the editor, keeps its properties.
const def = T.defaultCustom(base, 2);
const v = T.validateDeck(base, def);
assert.deepStrictEqual(v.errors, [], JSON.stringify(v.errors));
const g = T.generateMeaningCards(base, def);
assert.strictEqual(g.cards.length, 36); assert.strictEqual(g.verbClashes, 0);
const count = {}; g.cards.forEach(c => { assert.strictEqual(new Set(c.meanings).size, 3); c.meanings.forEach(m => count[m] = (count[m] || 0) + 1); });
assert.strictEqual(count["GIVE UP"], 6);
assert(Object.entries(count).every(([m, k]) => m === "GIVE UP" || k === 3), "each single-answer meaning on 3 cards");
const d2 = T.buildDeck(base, def);
const r2 = play(d2, 2), r4 = play(T.buildDeck(base, T.defaultCustom(base, 4)), 4);
console.log("default via editor, 2p:", r2, " 4p (pack included):", r4);
assert.strictEqual(r2.unfinished, 0); assert.strictEqual(r4.unfinished, 0);

// 2. Determinism: same settings + seed -> same cards; new seed -> different cards.
assert.deepStrictEqual(T.generateMeaningCards(base, def).cards, g.cards);
assert.notDeepStrictEqual(T.generateMeaningCards(base, { ...def, seed: 2 }).cards, g.cards);

// 3. A small learner deck: adverbs only, fewer cards.
const small = { name: "Adverbs only", verbs: { cuir: 3, bain: 2, tabhair: 2, lig: 2, éirigh: 2, tar: 1, tit: 1, fág: 1, coinnigh: 1, déan: 1, tóg: 1 },
  particles: { amach: 9, isteach: 4, suas: 6, síos: 3 }, wildcards: 3, meanings: [], meaningCards: 18, seed: 1 };
small.meanings = [...T.availableMeanings(base, small).keys()];
const vs = T.validateDeck(base, small);
console.log("adverbs-only:", small.meanings.length, "meanings;", "errors", vs.errors.map(e => e.code), "warnings", vs.warnings.map(w => w.text), "players", JSON.stringify(vs.players));
assert.strictEqual(vs.players[2].ok, true); assert.strictEqual(vs.players[2].handSize, 11);
console.log("adverbs-only, 2p (hands of 11):", play(T.buildDeck(base, small), 2));
small.meanings = small.meanings.slice(0, 3); small.meaningCards = 9;   // tiniest legal selection
console.log("3 meanings, 9 cards:", T.validateDeck(base, small).errors.map(e => e.code), JSON.stringify(T.validateDeck(base, small).players[2]));

// 4. Broken decks are caught.
const broken = { ...def, verbs: { cuir: 6, bain: 4 }, meaningCards: 2 };
const vb = T.validateDeck(base, broken);
console.log("broken:", vb.errors.map(e => e.code), JSON.stringify(vb.players));
assert(vb.errors.some(e => e.code === "E_FEW_VERBS"));
const starved = { ...def, particles: { ...def.particles, le: 1 } };
assert(T.validateDeck(base, starved).warnings.some(w => w.code === "W_STARVED" && w.items[0] === "le"));
console.log("deck-tools: all assertions passed");
