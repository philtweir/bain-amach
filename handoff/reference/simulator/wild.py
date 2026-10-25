"""
Wildcard variant (no claims, no dead lines, no ownership):
- Verbs can go down alone (new hubs pay the tax).
- Particles only go down as part of a full line with its meaning, in one play.
- A wildcard can stand in for any particle in that play.
- Anyone holding the right particle can later cover a wildcard with it (sheds one card).
- maxp limits how many particles one play may contain (2 = allows cuir suas le in one go).
"""
import collections, random, statistics, sys
import sim, strict
from sim import add, DIRS, COMP_BY_VERB, opts

THREE_PART = None

class WildGame(strict.StrictGame):
    def moves(self, card):
        if card[0] == "W": return []
        return super().moves(card)

    def line_cells(self, v, d):
        out, k = [], 1
        while True:
            c = add(v, d, k); cell = self.board.get(c)
            if cell is None or cell["verb"] != v or cell["dir"] != d: return out, None
            if cell["kind"] == "M": return out, cell
            out.append((c, cell)); k += 1

    def strict_intents(self, pi):
        hand = self.hands[pi]; have = collections.Counter(hand)
        wilds = have[("W", "*")]
        mcards = sorted(set(c for c in hand if c[0] == "M"))
        maxp = self.rules.get("maxp", 2)
        out = []
        for v in self.verbs:
            vt = self.board[v]["tok"]
            for d in DIRS:
                st, _ = self.arm_state(v, d)
                if st == "empty":
                    for m in mcards:
                        for ps, g in COMP_BY_VERB[vt]:
                            if g not in opts(m[1]) or len(ps) > maxp or not self.run_free(v, d, len(ps) + 1): continue
                            need = collections.Counter(ps)
                            missing = sum(max(0, n - have[("P", p)]) for p, n in need.items())
                            if missing > wilds: continue
                            if missing and not self.rules.get("wild_ok", True): continue
                            out.append((12 + len(ps) - 2 * missing + self.rng.random() * .1, m,
                                        ("WCOMBO", v, d, ps, m, vt, missing)))
                elif st == "done":
                    cells, mcell = self.line_cells(v, d)
                    if mcell is None: continue
                    toks = [c["tok"] for _, c in cells]
                    if "*" not in toks: continue
                    valid = [ps for ps, g in COMP_BY_VERB[vt] if len(ps) == len(toks) and g in opts(mcell["tok"])
                             and all(t == "*" or t == p for t, p in zip(toks, ps))]
                    for i, (c, cell) in enumerate(cells):
                        if cell["kind"] != "W": continue
                        for ps in valid:
                            if have[("P", ps[i])]:
                                out.append((9 + self.rng.random() * .1, ("P", ps[i]), ("COVER", v, d, c, ps[i], vt)))
                                break
        return out

    def apply(self, pi, card, mv):
        kind = mv[0]
        if kind not in ("WCOMBO", "COVER"): return super().apply(pi, card, mv)
        hand = self.hands[pi]; have = collections.Counter(hand)
        if kind == "WCOMBO":
            _, v, d, ps, m, vt, missing = mv
            need = collections.Counter(("P", p) for p in ps)
            real = collections.Counter({k: min(n, have[k]) for k, n in need.items()})
            miss = sum(need.values()) - sum(real.values())
            if self.arm_state(v, d)[0] != "empty" or not self.run_free(v, d, len(ps) + 1) or \
                    have[m] < 1 or have[("W", "*")] < miss:
                self.stats["sniped"] += 1; return False
            hand.remove(m)
            for _ in range(miss): hand.remove(("W", "*"))
            used = collections.Counter()
            for i, p in enumerate(ps):
                if used[("P", p)] < real[("P", p)]:
                    hand.remove(("P", p)); used[("P", p)] += 1
                    self.place(add(v, d, i + 1), ("P", p), v, d, pi)
                else:
                    self.place(add(v, d, i + 1), ("W", "*"), v, d, pi)
            self.place(add(v, d, len(ps) + 1), m, v, d, pi)
            self.claims[(v, d)] = dict(cell=add(v, d, len(ps) + 1), L=len(ps), card=m, owner=pi)
            self.stats["completed"] += 1; self.stats["wild_used"] += miss
            if len(ps) == 2: self.stats["three_part"] += 1
            self.done.add((vt, ps))
            self.log(f"P{pi} lays {vt} {' '.join(p if i < 99 else '' for i, p in enumerate(ps))} = "
                     f"{self.used_gloss(vt, ps, m)}" + (f" ({miss} wildcard)" if miss else ""))
            return True
        if kind == "COVER":
            _, v, d, c, p, vt = mv
            cell = self.board.get(c)
            if cell is None or cell["kind"] != "W" or have[("P", p)] < 1:
                self.stats["sniped"] += 1; return False
            hand.remove(("P", p))
            self.board[c] = dict(kind="P", tok=p, verb=v, dir=d, player=pi); self._slots = None
            self.stats["wild_covered"] += 1
            self.log(f"P{pi} covers a wildcard on {vt} with {p}")
            return True

    def finish(self, how, t, winner=None):
        self.stats["wild_left"] += sum(1 for c in self.board.values() if c["kind"] == "W")
        return super().finish(how, t, winner)


BASE = dict(strict.BASE, sensible_verbs=True)
def batch(label, n=250, players=2, wild=0, particles=2.0, verbs=1.0, **over):
    sim.use_nouns(False)
    rules = dict(sim.BASE, **dict(BASE, **over))
    dk = dict(verb_factor=verbs, particle_extra=particles, wild=wild)
    rng = random.Random(sum(map(ord, label)) * 7)
    st = collections.Counter(); ends = []; ticks = []; hows = collections.Counter()
    for _ in range(n):
        g = WildGame(players, rules, rng, ["planner"] * players, dk)
        r = g.run(); st.update(r["stats"]); ticks.append(r["ticks"]); hows[r["how"]] += 1
        hs = sorted(len(h) for h in g.hands); ends.append((hs[0], hs[-1]))
    print(f"{label:40s} | completed {st['completed']/n:5.1f} (3-part {st["three_part"]/n:3.1f}) | wild used {st['wild_used']/n:4.1f} "
          f"covered {st['wild_covered']/n:4.1f} left {st['wild_left']/n:4.1f} | go out {100*hows['win']/n:3.0f}% "
          f"| end {tuple(round(statistics.mean(x),1) for x in zip(*ends))} | ticks {statistics.median(ticks):4.0f} | stalls {st['stall']/n:5.1f}", flush=True)

if __name__ == "__main__":
    w = sys.argv[1]
    if w == "a": batch("no wildcards, up to 2 particles per play")
    if w == "b": batch("no wildcards, 1 particle per play", maxp=1)
    if w == "c": batch("4 wildcards, up to 2 particles", wild=4)
    if w == "d": batch("8 wildcards, up to 2 particles", wild=8)
    if w == "e": batch("8 wildcards, 1 particle per play", wild=8, maxp=1)
    if w == "f": batch("8 wildcards, particles x1.5", wild=8, particles=1.5)
    if w == "g": batch("8 wildcards, particles x1.0", wild=8, particles=1.0)
    if w == "h": batch("8 wildcards, particles x1.25", wild=8, particles=1.25)
    if w == "i": batch("12 wildcards, particles x1.25", wild=12, particles=1.25)
    if w == "j": batch("no wildcards, particles x1.25", wild=0, particles=1.25)
    if w == "k": batch("8 wildcards, x1.25, 4 players", wild=8, particles=1.25, players=4)
    if w == "s1": batch("sensible verbs: 8 wild, x1.25", wild=8, particles=1.25)
    if w == "s2": batch("sensible verbs: 12 wild, x1.25", wild=12, particles=1.25)
    if w == "s3": batch("sensible verbs: 8 wild, x1.25, verb costs 1", wild=8, particles=1.25, pay_cost=1)
    if w == "s4": batch("sensible verbs: 8 wild, x1.25, 4 players", wild=8, particles=1.25, players=4)
    if w == "t1": batch("verbs x0.5, particles x1.25, 8 wild", wild=8, particles=1.25, verbs=0.5)
    if w == "t2": batch("verbs x0.5, particles x1.0, 8 wild", wild=8, particles=1.0, verbs=0.5)
    if w == "t3": batch("verbs x0.35, particles x1.0, 8 wild", wild=8, particles=1.0, verbs=0.35)
    if w == "t4": batch("verbs x0.35, particles x1.25, 8 wild", wild=8, particles=1.25, verbs=0.35)
    if w == "t5": batch("verbs x0.5, particles x1.0, no wild", wild=0, particles=1.0, verbs=0.5)
    if w == "t6": batch("verbs x0.5, particles x1.0, 8 wild, 4p", wild=8, particles=1.0, verbs=0.5, players=4)
    if w == "u1": batch("stall discard: verbs x0.5, part x1.0, 8 wild", wild=8, particles=1.0, verbs=0.5, stall_discard=True)
    if w == "u2": batch("stall discard: verbs x0.5, part x1.25, 8 wild", wild=8, particles=1.25, verbs=0.5, stall_discard=True)
    if w == "u3": batch("stall discard: verbs x1.0, part x1.25, 8 wild", wild=8, particles=1.25, verbs=1.0, stall_discard=True)
    if w == "u4": batch("stall discard: verbs x0.5, part x1.0, no wild", wild=0, particles=1.0, verbs=0.5, stall_discard=True)
    if w == "u5": batch("stall discard: verbs x0.5, part x1.0, 8 wild, 4p", wild=8, particles=1.0, verbs=0.5, stall_discard=True, players=4)
