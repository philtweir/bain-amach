/*
 * Reference rules engine for Bain Amach (working title). Plain JS, no DOM.
 * Ported from the prototype on the design board; it is the behaviour to match, not production code.
 * Load deck.json into DATA before use (see engine.test.js). Cards: {id, k: "V"|"P"|"M"|"W", t}.
 * Board cells: Map "x,y" -> card + {x, y, axis: "h"|"v"|null, owner, cross?, used? (meaning used, on M)}.
 * Not here yet: race mode, hidden-answers mode, hints, pass-and-play hand-over, persistence.
 */
let DATA = (typeof module !== "undefined") ? require("../../data/deck.json") : window.DECK;
const ADV = new Set(["amach","isteach","suas","síos"]);
const COMP = DATA.compounds.map(c => ({ id: c.id, v: c.verb, ps: c.particles, g: c.meaning }));
const ANS = {}; COMP.forEach(c => { (ANS[c.g] = ANS[c.g] || []).push(c.v + " " + c.ps.join(" ")); });
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const K = (x, y) => x + "," + y;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

class Game {
  constructor(seed = 7, nPlayers = 2) {
    const r = this.r = rng(seed);
    const setup = DATA.setup[String(nPlayers)]; if (!setup) throw new Error("2 to 4 players");
    const handSize = setup.handSize, nMeanings = setup.meaningsInHand;
    let id = 0; const card = (k, t) => ({ id: id++, k, t });
    const verbCounts = { ...DATA.verbs.base };
    if (setup.verbs.includes("pack3to4")) for (const [v, n] of Object.entries(DATA.verbs.pack3to4)) verbCounts[v] = (verbCounts[v] || 0) + n;
    const main = []; Object.entries(verbCounts).forEach(([v, n]) => { for (let i = 0; i < n; i++) main.push(card("V", v)); });
    for (let i = 0; i < DATA.wildcards; i++) main.push(card("W", "*"));
    const parts = []; DATA.particles.forEach(p => { for (let i = 0; i < p.copies; i++) parts.push(card("P", p.word)); });
    const means = DATA.meaningCards.map(m => card("M", m.meanings.join("|")));
    shuffle(main, r); shuffle(parts, r); shuffle(means, r);
    this.board = new Map(); this.lines = []; this.log = [];
    const starters = []; const seen = new Set();
    for (let i = main.length - 1; i >= 0 && starters.length < DATA.starterVerbs; i--) if (main[i].k === "V" && !seen.has(main[i].t)) { seen.add(main[i].t); starters.push(main.splice(i, 1)[0]); }
    [[0,0],[4,1],[1,4],[5,5]].forEach(([x, y], i) => this.put(x, y, starters[i], null, -1));
    const np = DATA.riverPiles; this.piles = Array.from({ length: np }, (_, i) => parts.filter((_, j) => j % np === i));
    this.main = main; this.mpile = means; this.faceUp = this.mpile.pop();
    this.hands = []; for (let p = 0; p < nPlayers; p++) { const h = []; for (let i = 0; i < handSize - nMeanings; i++) h.push(this.main.pop()); for (let i = 0; i < nMeanings; i++) h.push(this.mpile.pop()); this.hands.push(h); }
    this.turn = 0; this.passes = 0; this.over = null; this.lastPlay = null;
  }
  put(x, y, c, axis, owner) { this.board.set(K(x, y), { ...c, x, y, axis, owner }); }
  at(x, y) { return this.board.get(K(x, y)); }
  free(x, y) { return !this.board.has(K(x, y)); }
  opts(m) { return m.t.split("|"); }
  tops() { return this.piles.map(p => p.length ? p[p.length - 1] : null); }
  plan(ps, wilds) {
    const st = this.piles.map(p => p.length), src = []; let w = 0;
    for (const p of ps) {
      const i = this.piles.findIndex((pl, j) => st[j] > 0 && pl[st[j] - 1].t === p);
      if (i >= 0) { st[i]--; src.push({ river: i }); continue; }
      if (w < wilds) { w++; src.push({ wild: true }); continue; }
      return null;
    }
    return src;
  }
  bounds() { let a = [1e9, 1e9, -1e9, -1e9]; for (const c of this.board.values()) { a = [Math.min(a[0], c.x), Math.min(a[1], c.y), Math.max(a[2], c.x), Math.max(a[3], c.y)]; } return a; }
  spots(len) {
    const [x0, y0, x1, y1] = this.bounds(), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, out = [];
    for (let x = x0 - len - 2; x <= x1 + len + 2; x++) for (let y = y0 - len - 2; y <= y1 + len + 2; y++) {
      if (!this.free(x, y)) continue;
      for (const [dx, dy] of DIRS) {
        let ok = true; for (let k = 1; k <= len + 1; k++) if (!this.free(x + dx * k, y + dy * k)) { ok = false; break; }
        if (ok) out.push({ x, y, d: [dx, dy], dist: Math.abs(x + dx * (len + 1) / 2 - cx) + Math.abs(y + dy * (len + 1) / 2 - cy) });
      }
    }
    return out.sort((a, b) => a.dist - b.dist);
  }
  moves(p) {
    const hand = this.hands[p], wilds = hand.filter(c => c.k === "W").length, out = [];
    const ms = hand.filter(c => c.k === "M"), hv = hand.filter(c => c.k === "V");
    const seenV = new Set();
    for (const m of ms) for (const g of this.opts(m)) for (const c of COMP.filter(c => c.g === g)) {
      const L = c.ps.length;
      // verbs already on the table
      for (const v of this.board.values()) {
        if (v.k !== "V" || v.t !== c.v) continue;
        for (const d of DIRS) {
          let ok = true; for (let k = 1; k <= L + 1; k++) if (!this.free(v.x + d[0] * k, v.y + d[1] * k)) { ok = false; break; }
          if (!ok) continue;
          const src = this.plan(c.ps, wilds); if (!src) continue;
          out.push({ type: "line", m, g, c, verb: { table: v }, x: v.x, y: v.y, d, src });
        }
      }
      // verb from hand (a few best spots)
      const vc = hv.find(h => h.t === c.v);
      if (vc) { const src = this.plan(c.ps, wilds); if (src) this.spots(L).slice(0, 4).forEach(s => out.push({ type: "line", m, g, c, verb: { hand: vc }, x: s.x, y: s.y, d: s.d, src })); }
      // through a particle already down
      if (vc) for (const b of this.board.values()) {
        if (b.k !== "P") continue;
        c.ps.forEach((pt, i) => {
          if (pt !== b.t) return;
          for (const d of DIRS) {
            const vx = b.x - d[0] * (i + 1), vy = b.y - d[1] * (i + 1);
            let ok = true; for (let k = 0; k <= L + 1; k++) { if (k === i + 1) continue; if (!this.free(vx + d[0] * k, vy + d[1] * k)) { ok = false; break; } }
            if (!ok) continue;
            const rest = c.ps.filter((_, j) => j !== i), src0 = this.plan(rest, wilds); if (!src0) continue;
            const src = []; let q = 0; c.ps.forEach((_, j) => src.push(j === i ? { existing: true } : src0[q++]));
            out.push({ type: "line", m, g, c, verb: { hand: vc }, x: vx, y: vy, d, src, straddle: b });
          }
        });
      }
    }
    const canDraw = this.main.length > 0 || this.mpile.length > 0;   // empty-deck rule: no lone verbs once both piles are empty
    for (const v of hv) { if (!canDraw || seenV.has(v.t)) continue; seenV.add(v.t); const s = this.spots(2)[0]; if (s) out.push({ type: "lone", v, x: s.x, y: s.y }); }
    return out;
  }
  shed(mv) { return mv.type === "lone" ? 0 : 1 + (mv.verb.hand ? 1 : 0) + mv.src.filter(s => s.wild).length; }
  apply(p, mv) {
    const hand = this.hands[p], rm = c => hand.splice(hand.indexOf(c), 1);
    if (mv.type === "lone") {
      rm(mv.v); this.put(mv.x, mv.y, mv.v, null, p);
      for (let i = 0; i < DATA.loneVerbDraw; i++) this.drawOne(p, true);
      this.lastPlay = { p, cells: [K(mv.x, mv.y)], text: mv.v.t + " on its own", lone: true };
    } else {
      const [dx, dy] = mv.d, axis = dx ? "h" : "v", cells = [];
      if (mv.verb.hand) { rm(mv.verb.hand); this.put(mv.x, mv.y, mv.verb.hand, null, p); }
      cells.push(K(mv.x, mv.y));
      mv.c.ps.forEach((pt, i) => {
        const x = mv.x + dx * (i + 1), y = mv.y + dy * (i + 1), s = mv.src[i];
        if (s.existing) { const b = this.at(x, y); b.cross = true; }
        else if (s.wild) { const w = hand.find(c => c.k === "W"); rm(w); this.put(x, y, w, axis, p); }
        else { const card = this.piles[s.river].pop(); this.put(x, y, card, axis, p); }
        cells.push(K(x, y));
      });
      const L = mv.c.ps.length; rm(mv.m); this.put(mv.x + dx * (L + 1), mv.y + dy * (L + 1), { ...mv.m, used: mv.g }, axis, p);
      cells.push(K(mv.x + dx * (L + 1), mv.y + dy * (L + 1)));
      const line = { p, c: mv.c, g: mv.g, cells, wild: mv.src.some(s => s.wild), straddle: !!mv.straddle };
      this.lines.push(line);
      this.lastPlay = { p, cells, text: mv.c.v + " " + mv.c.ps.join(" ") + " · " + mv.g.toLowerCase(), line };
    }
    this.passes = 0; this.log.push(this.lastPlay);
    if (!hand.length) this.over = { winner: p, how: "out" };
  }
  drawOne(p, any) {
    const h = this.hands[p], nm = h.filter(c => c.k === "M").length;
    if (!any && nm < 2 && this.mpile.length) { h.push(this.mpile.pop()); return true; }
    if (this.main.length) { h.push(this.main.pop()); return true; }
    if (this.mpile.length) { h.push(this.mpile.pop()); return true; }
    return false;
  }
  swap(p, m) { const h = this.hands[p]; h.splice(h.indexOf(m), 1); h.push(this.faceUp); this.faceUp = m; this.lastPlay = { p, cells: [], text: "swapped a meaning card" }; }
  pass(p) {
    const drew = this.drawOne(p, false); this.passes++;
    this.lastPlay = { p, cells: [], text: drew ? "drew a card and passed" : "passed" };
    if (this.passes >= this.hands.length) {
      this.piles.forEach(pl => { if (pl.length > 1) pl.unshift(pl.pop()); });
      this.lastPlay.bury = true;
      if (!drew && !this.main.length && !this.mpile.length) {
        this.stuck = (this.stuck || 0) + 1;
        if (this.stuck >= 2) { const n = this.hands.map(h => h.length), best = Math.min(...n); const tie = n.filter(x => x === best).length > 1; this.over = { winner: tie ? null : n.indexOf(best), how: "fewest", tie, best }; }
      }
      this.passes = 0;
    }
  }
  next() { this.turn = (this.turn + 1) % this.hands.length; }
  botMove(p) {
    const mv = this.moves(p), lines = mv.filter(m => m.type === "line");
    if (lines.length) { lines.sort((a, b) => (this.shed(b) - b.src.filter(s => s.wild).length * 0.6) - (this.shed(a) - a.src.filter(s => s.wild).length * 0.6)); return lines[0]; }
    const hand = this.hands[p], gl = new Set(hand.filter(c => c.k === "M").flatMap(m => this.opts(m)));
    const lone = mv.filter(m => m.type === "lone" && COMP.some(c => c.v === m.v.t && gl.has(c.g)));
    if (lone.length && this.main.length) return lone[0];
    return null;
  }
}
if (typeof module !== "undefined") module.exports = { Game, COMP, ANS, ADV, DATA };
