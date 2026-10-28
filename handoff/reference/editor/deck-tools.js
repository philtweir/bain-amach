/*
 * Reference deck tools for the deck editor (spec/deck-editor.md). Plain JS, no DOM.
 * handSizes(base, custom)          -> {2|3|4: hand size or null}: base size shrunk until the deck deals it in full (min 7)
 * buildableCompounds(base, custom) -> compounds the custom counts can make
 * generateMeaningCards(base, custom) -> { cards, verbClashes }
 * validateDeck(base, custom)        -> { errors, warnings, players: {2|3|4: {ok, reason}} }
 * buildDeck(base, custom)           -> a full deck in the deck.json schema, ready for the engine
 *
 * custom = { name, verbs: {verb: n}, particles: {word: n}, wildcards, meanings: [GLOSS...], meaningCards: N, seed }
 * The behaviour is what the TS port must match; the code is not production code.
 */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const MAX_CARDS = 60, MIN_HAND = 7;

// Hand size per player count: the base deck's size, shrunk until the verbs + wildcards can deal it; null if even MIN_HAND can't.
// Deals are honest: the hand deck must cover every hand in full, so draws come from what is left.
function handSizes(base, custom) {
  const verbTotal = Object.values(custom.verbs).reduce((a, b) => a + b, 0), have = verbTotal + custom.wildcards - base.starterVerbs, out = {};
  for (const n of [2, 3, 4]) {
    const s = base.setup[String(n)]; let h = s.handSize;
    while (h >= MIN_HAND && n * (h - s.meaningsInHand) > have) h--;
    out[n] = h >= MIN_HAND ? h : null;
  }
  return out;
}

function buildableCompounds(base, custom) {
  return base.compounds.filter(c => (custom.verbs[c.verb] || 0) > 0 && c.particles.every(p => (custom.particles[p] || 0) > 0));
}

// Meanings the counts can make, each with its buildable compounds.
function availableMeanings(base, custom) {
  const out = new Map();
  for (const c of buildableCompounds(base, custom)) { if (!out.has(c.meaning)) out.set(c.meaning, []); out.get(c.meaning).push(c); }
  return out;
}

function selected(base, custom) {
  const avail = availableMeanings(base, custom);
  return custom.meanings.filter(m => avail.has(m)).map(m => ({ m, comps: avail.get(m), verbs: new Set(avail.get(m).map(c => c.verb)) }));
}

// Each selected meaning appears in proportion to how many buildable compounds answer it (GIVE UP with both answers counts double).
// No meaning twice on one card. Avoid two meanings on one card that share a verb; relax only if impossible, and report it.
function generateMeaningCards(base, custom) {
  const sel = selected(base, custom), N = custom.meaningCards, S = 3 * N;
  if (sel.length < 3 || S < sel.length) return { cards: [], verbClashes: 0, impossible: true };
  const W = sel.reduce((s, x) => s + x.comps.length, 0);
  // largest-remainder apportionment, at least 1 each, at most N each
  let t = sel.map(x => Math.max(1, Math.min(N, Math.floor(S * x.comps.length / W))));
  let rem = S - t.reduce((a, b) => a + b, 0);
  const order = sel.map((x, i) => [S * x.comps.length / W - Math.floor(S * x.comps.length / W), i]).sort((a, b) => b[0] - a[0]).map(a => a[1]);
  for (let k = 0; rem > 0 && k < 10 * S; k++) { const i = order[k % order.length]; if (t[i] < N) { t[i]++; rem--; } }
  for (let k = 0; rem < 0 && k < 10 * S; k++) { const i = order[order.length - 1 - (k % order.length)]; if (t[i] > 1) { t[i]--; rem++; } }
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng((custom.seed || 1) * 1000 + attempt);
    const cards = Array.from({ length: N }, () => []); let clashes = 0, failed = false;
    const tokens = []; sel.forEach((x, i) => { for (let k = 0; k < t[i]; k++) tokens.push(i); });
    tokens.sort((a, b) => (t[b] - t[a]) || (sel[b].verbs.size - sel[a].verbs.size) || (r() - 0.5));
    for (const i of tokens) {
      const fits = strict => cards.map((c, ci) => ci).filter(ci => cards[ci].length < 3 && !cards[ci].includes(i) &&
        (!strict || cards[ci].every(j => ![...sel[j].verbs].some(v => sel[i].verbs.has(v)))));
      let cand = fits(true); if (!cand.length) { cand = fits(false); if (cand.length) clashes++; }
      if (!cand.length) { failed = true; break; }
      const minLen = Math.min(...cand.map(ci => cards[ci].length)); cand = cand.filter(ci => cards[ci].length === minLen);
      cards[cand[Math.floor(r() * cand.length)]].push(i);
    }
    if (failed) continue;
    if (!best || clashes < best.verbClashes) best = { cards, verbClashes: clashes };
    if (clashes === 0) break;
  }
  if (!best) return { cards: [], verbClashes: 0, impossible: true };
  return { cards: best.cards.map((c, k) => ({ id: "x" + String(k + 1).padStart(2, "0"), meanings: c.map(i => sel[i].m) })), verbClashes: best.verbClashes, impossible: false };
}

function validateDeck(base, custom) {
  const errors = [], warnings = [];
  const avail = availableMeanings(base, custom), sel = selected(base, custom);
  const verbTotal = Object.values(custom.verbs).reduce((a, b) => a + b, 0);
  const partTotal = Object.values(custom.particles).reduce((a, b) => a + b, 0);
  const distinctVerbs = Object.values(custom.verbs).filter(n => n > 0).length;
  const N = custom.meaningCards;
  const dropped = custom.meanings.filter(m => !avail.has(m));
  if (dropped.length) warnings.push({ code: "W_UNBUILDABLE", meanings: dropped, text: `${dropped.length} selected meaning(s) can't be made with these counts and will be left out` });
  if (distinctVerbs < base.starterVerbs) errors.push({ code: "E_FEW_VERBS", text: `Needs at least ${base.starterVerbs} different verbs (the table starts with ${base.starterVerbs})` });
  if (sel.length < 3) errors.push({ code: "E_FEW_MEANINGS", text: "Choose at least 3 meanings (each card shows 3)" });
  if (N > MAX_CARDS) errors.push({ code: "E_TOO_MANY_CARDS", text: `At most ${MAX_CARDS} meaning cards` });
  if (sel.length >= 3 && 3 * N < sel.length) errors.push({ code: "E_FEW_CARDS", text: `${sel.length} meanings need at least ${Math.ceil(sel.length / 3)} meaning cards to appear once each` });
  if (partTotal < base.riverPiles) errors.push({ code: "E_RIVER", text: `Needs at least ${base.riverPiles} particles to fill the river` });
  if (!errors.length) {
    const g = generateMeaningCards(base, custom);
    if (g.impossible) errors.push({ code: "E_CARDS", text: "Can't make meaning cards from this selection" });
    else if (g.verbClashes) warnings.push({ code: "W_VERB_CLASH", text: `${g.verbClashes} card(s) show two meanings with the same verb` });
  }
  // dead cards: verbs and particles no selected meaning uses
  const usedV = new Set(), usedP = new Set(); sel.forEach(x => x.comps.forEach(c => { usedV.add(c.verb); c.particles.forEach(p => usedP.add(p)); }));
  const deadV = Object.keys(custom.verbs).filter(v => custom.verbs[v] > 0 && !usedV.has(v));
  const deadP = Object.keys(custom.particles).filter(p => custom.particles[p] > 0 && !usedP.has(p));
  if (deadV.length) warnings.push({ code: "W_DEAD_VERBS", items: deadV, text: `No chosen meaning uses ${deadV.join(", ")}: those cards can only be laid alone` });
  if (deadP.length) warnings.push({ code: "W_DEAD_PARTICLES", items: deadP, text: `No chosen meaning uses ${deadP.join(", ")}: they clog the river` });
  // particle supply vs demand (share of particle slots in chosen lines vs share of the river)
  if (sel.length && partTotal) {
    const demand = {}; let dTot = 0;
    sel.forEach(x => x.comps.forEach(c => c.particles.forEach(p => { demand[p] = (demand[p] || 0) + 1 / x.comps.length; dTot += 1 / x.comps.length; })));
    for (const [p, d] of Object.entries(demand)) {
      const ratio = ((custom.particles[p] || 0) / partTotal) / (d / dTot);
      if (ratio < 0.5) warnings.push({ code: "W_STARVED", items: [p], text: `${p} is in ${Math.round(100 * d / dTot)}% of the chosen lines but only ${Math.round(100 * (custom.particles[p] || 0) / partTotal)}% of the river` });
    }
  }
  const players = {}, hs = handSizes(base, custom);
  for (const n of [2, 3, 4]) {
    const s = base.setup[String(n)], have = verbTotal + custom.wildcards - base.starterVerbs;
    const needM = n * s.meaningsInHand + 2;   // hands + face-up + at least one left to draw
    if (hs[n] === null) players[n] = { ok: false, reason: `needs ${n * (MIN_HAND - s.meaningsInHand) - have} more verb or wildcard cards` };
    else if (N < needM) players[n] = { ok: false, reason: `needs at least ${needM} meaning cards` };
    else players[n] = { ok: true, handSize: hs[n], ...(hs[n] < s.handSize ? { note: `hands of ${hs[n]} instead of ${s.handSize}` } : {}) };
  }
  if (!Object.values(players).some(p => p.ok)) errors.push({ code: "E_NO_PLAYERS", text: "Too small to deal for any player count" });
  return { errors, warnings, players };
}

// A full deck object in the deck.json schema. Hand sizes stay as in the base deck; one verb set for every player count.
function buildDeck(base, custom) {
  const sel = new Set(selected(base, custom).map(x => x.m));
  const g = generateMeaningCards(base, custom);
  const hs = handSizes(base, custom), setup = {};
  for (const n of ["2", "3", "4"]) if (hs[n] !== null) setup[n] = { ...base.setup[n], verbs: "base", handSize: hs[n] };
  return {
    ...base, version: base.version, custom: { name: custom.name },
    compounds: buildableCompounds(base, custom).filter(c => sel.has(c.meaning)),
    meaningCards: g.cards,
    verbs: { base: Object.fromEntries(Object.entries(custom.verbs).filter(([, n]) => n > 0)), pack3to4: {}, baseTotal: 0, withPackTotal: 0 },
    particles: base.particles.map(p => ({ ...p, copies: custom.particles[p.word] || 0 })).filter(p => p.copies > 0),
    wildcards: custom.wildcards, setup,
  };
}

// The default deck expressed as editor settings (what "Duplicate default" starts from).
function defaultCustom(base, players = 2) {
  const verbs = { ...base.verbs.base };
  if (players > 2) for (const [v, n] of Object.entries(base.verbs.pack3to4)) verbs[v] = (verbs[v] || 0) + n;
  return { name: "Default", verbs, particles: Object.fromEntries(base.particles.map(p => [p.word, p.copies])), wildcards: base.wildcards,
    meanings: [...new Set(base.compounds.map(c => c.meaning))], meaningCards: base.meaningCards.length, seed: 1 };
}

module.exports = { handSizes, MIN_HAND, buildableCompounds, availableMeanings, generateMeaningCards, validateDeck, buildDeck, defaultCustom, MAX_CARDS };
