// Bot-vs-bot smoke test: node reference/engine/engine.test.js
const { Game } = require("./engine.js");
for (const n of [2, 3, 4]) {
  const games = 300; let out = 0, lines = 0, straddles = 0, wild = 0, stuck = 0, firstWins = 0, bad = 0, ties = 0;
  for (let s = 1; s <= games; s++) {
    const g = new Game(s, n);
    if (g.hands.some(h => h.length !== require("../../data/deck.json").setup[n].handSize)) bad++;
    let t = 0;
    while (!g.over && t < 4000) { const p = g.turn, mv = g.botMove(p); if (mv) g.apply(p, mv); else g.pass(p); g.next(); t++; }
    if (!g.over) { stuck++; continue; }
    if (g.over.how === "out") out++; if (g.over.tie) ties++; if (g.over.winner === 0) firstWins++;
    lines += g.lines.length; straddles += g.lines.filter(l => l.straddle).length; wild += g.lines.filter(l => l.wild).length;
  }
  console.log(`${n} players: short deals ${bad}, unfinished ${stuck}, lines ${(lines / games).toFixed(1)}, straddles ${(straddles / games).toFixed(1)}, wildcard lines ${(wild / games).toFixed(1)}, someone goes out ${Math.round(100 * out / games)}%, ties ${ties}, player 1 wins ${Math.round(100 * firstWins / (games - ties))}% of decided games (fair ${Math.round(100 / n)}%)`);
}
