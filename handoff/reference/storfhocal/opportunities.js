// How often could a Hard bot play a stórfhocal? node reference/storfhocal/opportunities.js
// Runs ordinary bot-vs-bot games with the reference engine. Player 0 stands in for the human; on each of the other players' turns,
// it counts whether any stórfhocal line could be laid (verb on the table with a free run, or a verb in hand placed anywhere, plus the
// particles from the river tops or wildcards). Then it estimates, for a few per-opportunity chances, how often the player sees at
// least one bot stórfhocal in a game. It ignores the knock-on effect of the bot's stórfhocal play on the rest of the game.
const { Game } = require("../engine/engine.js");
const SF = require("../../data/storfhocail.json");
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const PHRASES = SF.words.flatMap(w => w.phrases.map(p => ({ ...p, word: w.word, parts: p.pattern.filter(t => t !== "~") })));

function canPlay(g, p, ph) {
  const hand = g.hands[p], wilds = hand.filter(c => c.k === "W").length, L = ph.pattern.length;
  if (!g.plan(ph.parts, wilds)) return false;
  for (const v of g.board.values()) {
    if (v.k !== "V" || v.t !== ph.verb) continue;
    for (const d of DIRS) { let ok = true; for (let k = 1; k <= L; k++) if (!g.free(v.x + d[0] * k, v.y + d[1] * k)) { ok = false; break; } if (ok) return true; }
  }
  return hand.some(c => c.k === "V" && c.t === ph.verb) && g.spots(L - 1).length > 0;
}

const CHANCES = [0.05, 0.1, 0.2, 0.3];
for (const n of [2, 4]) {
  const games = 200; let oppTurns = 0, botTurns = 0, gamesWithOpp = 0; const seen = CHANCES.map(() => 0); const wordHits = {};
  for (let s = 1; s <= games; s++) {
    const g = new Game(s, n); let t = 0; const perBot = {};
    while (!g.over && t < 4000) {
      const p = g.turn;
      if (p !== 0) {
        botTurns++;
        const ok = PHRASES.filter(ph => canPlay(g, p, ph));
        if (ok.length) { oppTurns++; perBot[p] = (perBot[p] || 0) + 1; ok.forEach(ph => wordHits[ph.word] = (wordHits[ph.word] || 0) + 1); }
      }
      const mv = g.botMove(p); if (mv) g.apply(p, mv); else g.pass(p); g.next(); t++;
    }
    if (Object.keys(perBot).length) gamesWithOpp++;
    // one Hard bot (player 1), at most one stórfhocal per game
    const k = perBot[1] || 0; CHANCES.forEach((c, i) => seen[i] += 1 - Math.pow(1 - c, k));
  }
  console.log(`${n} players: a bot has a stórfhocal line on ${Math.round(100 * oppTurns / botTurns)}% of its turns; games with any chance ${Math.round(100 * gamesWithOpp / games)}%`);
  console.log("  one Hard bot, chance per opportunity -> share of games where it plays one: " + CHANCES.map((c, i) => `${c}: ${Math.round(100 * seen[i] / games)}%`).join(", "));
  const top = Object.entries(wordHits).sort((a, b) => b[1] - a[1]);
  console.log("  most playable: " + top.slice(0, 6).map(([w]) => w).join(", ") + " | least: " + top.slice(-5).map(([w]) => w).join(", ") +
    " | never: " + (SF.words.filter(w => !wordHits[w.word]).map(w => w.word).join(", ") || "none"));
}

// Per-game model (the one the spec adopts): a Hard bot carries ONE word, rolled at the deal, and plays it the first time it can.
// For each word: share of games in which a bot carrying it gets a chance, and how far into the game (median turn / game length).
for (const n of [2, 4]) {
  const games = 150, hit = {}, when = {};
  for (let s = 1; s <= games; s++) {
    const g = new Game(1000 + s, n); let t = 0; const first = {};
    while (!g.over && t < 4000) {
      const p = g.turn;
      if (p === 1) for (const w of SF.words) if (first[w.word] === undefined && w.phrases.some(ph => canPlay(g, p, { ...ph, parts: ph.pattern.filter(x => x !== "~") }))) first[w.word] = t;
      const mv = g.botMove(p); if (mv) g.apply(p, mv); else g.pass(p); g.next(); t++;
    }
    for (const [w, ft] of Object.entries(first)) { hit[w] = (hit[w] || 0) + 1; (when[w] = when[w] || []).push(ft / t); }
  }
  const rows = SF.words.map(w => [w.word, Math.round(100 * (hit[w.word] || 0) / games), when[w.word] ? Math.round(100 * when[w.word].sort((a, b) => a - b)[when[w.word].length >> 1]) : null]);
  const avg = rows.reduce((a, r) => a + r[1], 0) / rows.length;
  console.log(`${n} players, one carried word: playable in ${Math.round(avg)}% of games on average (range ${Math.min(...rows.map(r => r[1]))}–${Math.max(...rows.map(r => r[1]))}%); first chance at a median ${Math.round(rows.reduce((a, r) => a + (r[2] || 0), 0) / rows.length)}% of the way through`);
  console.log("  " + rows.sort((a, b) => a[1] - b[1]).map(r => `${r[0]} ${r[1]}%`).join(", "));
}
