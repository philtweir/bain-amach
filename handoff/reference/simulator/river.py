"""
Particle-river variant + 'single verb OR full line' simplification.
- A play is either: one verb on its own (new hub, costs pay_cost draws), or a full line:
  meaning from hand + verb (already on the table, or from hand: free) + all its particles.
- river=R: particles are not dealt; they sit in R face-up piles. A full line takes its particles
  from pile tops (taking a top reveals the next card). river=0: particles are in hands as before.
- Wildcards (in hand) can stand in for any particle. No covering (simplification).
- Stall: nobody can play -> everyone draws 1 (meaning pile if holding < 2 meanings) and each river pile
  buries its top card.
"""
import collections, random, statistics, sys
import sim, wild
from sim import add, DIRS, COMP_BY_VERB, opts


class RiverGame(wild.WildGame):
    def __init__(self, n_players, rules, rng, bots, deck_kw=None, log=False):
        self._prow = rules.get("prow", 0)
        super().__init__(n_players, rules, rng, bots, deck_kw, log)
        if self._prow:
            parts = [c for c in self.pile if c[0] == "P"]
            self.pile = [c for c in self.pile if c[0] != "P"]
            for h in self.hands:
                for c in [c for c in h if c[0] == "P"]:
                    h.remove(c); parts.append(c)
                while len(h) < rules["hand"][n_players] and self.pile:
                    h.append(self.pile.pop())
            rng.shuffle(parts)
            self.ppiles = [parts[i::self._prow] for i in range(self._prow)]
        else:
            self.ppiles = []

    def take_plan(self, ps, wilds_avail):
        """Which particles come from hand / river tops / wildcards. Returns (from_hand, river_idx_list, n_wild) or None."""
        have = collections.Counter(self.hands[self._mover])
        tops = [list(p) for p in self.ppiles]
        from_hand, river, nw = [], [], 0
        for p in ps:
            if have[("P", p)] > 0:
                have[("P", p)] -= 1; from_hand.append(p); continue
            idx = next((i for i, t in enumerate(tops) if t and t[-1] == ("P", p)), None)
            if idx is not None:
                tops[idx].pop(); river.append(idx); continue
            if nw < wilds_avail:
                nw += 1; continue
            return None
        return from_hand, river, nw

    def strict_intents(self, pi):
        out = self.line_intents(pi)
        if self.rules.get("straddle"): out += self.straddle_intents(pi)
        return out

    def line_intents(self, pi):
        self._mover = pi
        hand = self.hands[pi]; have = collections.Counter(hand)
        wilds = have[("W", "*")]
        mcards = sorted(set(c for c in hand if c[0] == "M"))
        out = []
        if not mcards: return out
        # full lines on verbs already on the table
        for v in self.verbs:
            vt = self.board[v]["tok"]
            for d in DIRS:
                if self.arm_state(v, d)[0] != "empty": continue
                for m in mcards:
                    for ps, g in COMP_BY_VERB[vt]:
                        if g not in opts(m[1]) or not self.run_free(v, d, len(ps) + 1): continue
                        plan = self.take_plan(ps, wilds)
                        if plan is None: continue
                        fh, rv, nw = plan
                        shed = 1 + len(fh) + nw
                        out.append((12 + shed - 0.5 * nw + self.rng.random() * .1, m, ("RLINE", v, d, ps, m, vt, None)))
        # full lines that bring their own verb
        for vc in sorted(set(c for c in hand if c[0] == "V")):
            for m in mcards:
                for ps, g in COMP_BY_VERB[vc[1]]:
                    if g not in opts(m[1]): continue
                    plan = self.take_plan(ps, wilds)
                    if plan is None: continue
                    fh, rv, nw = plan
                    shed = 2 + len(fh) + nw
                    out.append((12 + shed - 0.5 * nw + self.rng.random() * .1, m, ("RLINE", None, None, ps, m, vc[1], vc)))
        return out

    def straddle_intents(self, pi):
        """Verb + meaning (+ any other particles) laid in a straight line through a particle already on the table."""
        hand = self.hands[pi]; have = collections.Counter(hand)
        wilds = have[("W", "*")]
        vcards = set(c[1] for c in hand if c[0] == "V")
        mcards = sorted(set(c for c in hand if c[0] == "M"))
        out = []
        if not vcards or not mcards: return out
        for c, cell in list(self.board.items()):
            if cell["kind"] != "P": continue
            t = cell["tok"]
            for d in DIRS:
                for vt in vcards:
                    for ps, g in COMP_BY_VERB[vt]:
                        for i, p in enumerate(ps):
                            if p != t: continue
                            vcell = add(c, d, -(i + 1))
                            others = [(add(c, d, j - i), q) for j, q in enumerate(ps) if j != i]
                            mcell = add(c, d, len(ps) - i)
                            cells = [vcell, mcell] + [oc for oc, _ in others]
                            if any(self.occupied(x) for x in cells): continue
                            m = next((m for m in mcards if g in opts(m[1])), None)
                            if not m: continue
                            plan = self.take_plan(tuple(q for _, q in others), wilds)
                            if plan is None: continue
                            fh, rv, nw = plan
                            shed = 2 + len(fh) + nw
                            out.append((13 + shed - 0.5 * nw + self.rng.random() * .1, m,
                                        ("STRADDLE", c, d, i, ps, m, vt, g)))
        return out

    def apply(self, pi, card, mv):
        if mv[0] == "STRADDLE": return self.apply_straddle(pi, mv)
        if mv[0] != "RLINE": return super().apply(pi, card, mv)
        _, v, d, ps, m, vt, vcard = mv
        self._mover = pi
        hand = self.hands[pi]; have = collections.Counter(hand)
        plan = self.take_plan(ps, have[("W", "*")])
        if plan is None or have[m] < 1 or (vcard and have[vcard] < 1):
            self.stats["sniped"] += 1; return False
        fh, rv, nw = plan
        if vcard:
            spot = None
            for cand in self.SPIRAL:
                if self.occupied(cand): continue
                for dd in DIRS:
                    if all(not self.occupied(add(cand, dd, k)) for k in range(1, len(ps) + 2)):
                        spot, d = cand, dd; break
                if spot: break
            hand.remove(vcard); self.place(spot, vcard, None, None, pi); v = spot
        elif self.arm_state(v, d)[0] != "empty" or not self.run_free(v, d, len(ps) + 1):
            self.stats["sniped"] += 1; return False
        hand.remove(m)
        for p in fh: hand.remove(("P", p))
        for _ in range(nw): hand.remove(("W", "*"))
        # place particles in order, using hand / river / wild in the same order as the plan
        fh_c = collections.Counter(fh); rv_q = list(rv)
        tops_used = collections.Counter()
        for i, p in enumerate(ps):
            if fh_c[p] > 0:
                fh_c[p] -= 1; card_p = ("P", p)
            elif rv_q and self.ppiles[rv_q[0]] and self.ppiles[rv_q[0]][-1] == ("P", p):
                card_p = self.ppiles[rv_q.pop(0)].pop(); self.stats["river_taken"] += 1
            else:
                card_p = ("W", "*")
            self.place(add(v, d, i + 1), card_p, v, d, pi)
        self.place(add(v, d, len(ps) + 1), m, v, d, pi)
        self.claims[(v, d)] = dict(cell=add(v, d, len(ps) + 1), L=len(ps), card=m, owner=pi)
        self.stats["completed"] += 1; self.stats["wild_used"] += nw
        if len(ps) == 2: self.stats["three_part"] += 1
        if vcard: self.stats["own_verb_lines"] += 1
        self.done.add((vt, ps))
        self.log(f"P{pi} lays {vt} {' '.join(ps)} = {self.used_gloss(vt, ps, m)}" + (" (with own verb)" if vcard else "")
                 + (f" ({nw} wildcard)" if nw else ""))
        return True

    def apply_straddle(self, pi, mv):
        _, c, d, i, ps, m, vt, g = mv
        self._mover = pi
        hand = self.hands[pi]; have = collections.Counter(hand)
        cell = self.board.get(c)
        vcell = add(c, d, -(i + 1)); mcell = add(c, d, len(ps) - i)
        others = [(add(c, d, j - i), q) for j, q in enumerate(ps) if j != i]
        plan = self.take_plan(tuple(q for _, q in others), have[("W", "*")])
        if cell is None or cell["kind"] != "P" or cell["tok"] != ps[i] or plan is None or have[m] < 1 or have[("V", vt)] < 1 \
                or any(self.occupied(x) for x in [vcell, mcell] + [oc for oc, _ in others]):
            self.stats["sniped"] += 1; return False
        fh, rv, nw = plan
        hand.remove(("V", vt)); hand.remove(m)
        for p in fh: hand.remove(("P", p))
        for _ in range(nw): hand.remove(("W", "*"))
        self.place(vcell, ("V", vt), None, None, pi)
        fh_c = collections.Counter(fh); rv_q = list(rv)
        for oc, q in others:
            if fh_c[q] > 0:
                fh_c[q] -= 1; cp = ("P", q)
            elif rv_q and self.ppiles[rv_q[0]] and self.ppiles[rv_q[0]][-1] == ("P", q):
                cp = self.ppiles[rv_q.pop(0)].pop(); self.stats["river_taken"] += 1
            else:
                cp = ("W", "*")
            self.place(oc, cp, vcell, d, pi)
        self.place(mcell, m, vcell, d, pi)
        self.claims[(vcell, d)] = dict(cell=mcell, L=len(ps), card=m, owner=pi)
        self.stats["completed"] += 1; self.stats["straddles"] += 1; self.stats["wild_used"] += nw
        if len(ps) == 2: self.stats["three_part"] += 1
        self.done.add((vt, ps))
        self.log(f"P{pi} lays {vt} … {g} through the {ps[i]} already down: {vt} {' '.join(ps)} = {g}")
        return True

    def strict_cover_allowed(self): return False

    def run(self, max_ticks=1500):
        # bury river tops at each stall: hook via log
        orig = self.log
        def log(s):
            orig(s)
            if s.startswith("-- stall"):
                for p in self.ppiles:
                    if len(p) > 1: p.insert(0, p.pop())
        self.log = log
        return super().run(max_ticks)


# disable covering in WildGame intents when simplified
_orig = wild.WildGame.strict_intents
def _no_cover(self, pi):
    out = _orig(self, pi)
    if self.rules.get("no_cover"): out = [c for c in out if c[2][0] != "COVER"]
    return out
wild.WildGame.strict_intents = _no_cover


BASE = dict(wild.BASE, no_cover=True)
def batch(label, n=250, players=2, wild_n=8, particles=1.0, verbs=0.5, cls=RiverGame, **over):
    sim.use_nouns(False)
    rules = dict(sim.BASE, **dict(BASE, **over))
    dk = dict(verb_factor=verbs, particle_extra=particles, wild=wild_n)
    rng = random.Random(sum(map(ord, label)) * 13)
    st = collections.Counter(); ends = []; ticks = []; hows = collections.Counter()
    for _ in range(n):
        g = cls(players, rules, rng, ["planner"] * players, dk)
        r = g.run(); st.update(r["stats"]); ticks.append(r["ticks"]); hows[r["how"]] += 1
        hs = sorted(len(h) for h in g.hands); ends.append((hs[0], hs[-1]))
    print(f"{label:44s} | completed {st['completed']/n:5.1f} (3-part {st['three_part']/n:3.1f}, own-verb {st['own_verb_lines']/n:4.1f}, straddle {st['straddles']/n:4.1f}) "
          f"| wild {st['wild_used']/n:4.1f} | go out {100*hows['win']/n:3.0f}% | end {tuple(round(statistics.mean(x),1) for x in zip(*ends))} "
          f"| ticks {statistics.median(ticks):4.0f} | stalls {st['stall']/n:5.1f}", flush=True)

if __name__ == "__main__":
    w = sys.argv[1]
    if w == "a": batch("particles in hand (simplified, no cover)", prow=0)
    if w == "b": batch("particle river, 5 piles, 8 wild", prow=5)
    if w == "c": batch("particle river, 3 piles, 8 wild", prow=3)
    if w == "d": batch("particle river, 5 piles, no wild", prow=5, wild_n=0)
    if w == "e": batch("particle river, 5 piles, 8 wild, 4p", prow=5, players=4)
    if w == "f": batch("particle river, 7 piles, 8 wild", prow=7)
    if w == "g": batch("river 5, 4 wild", prow=5, wild_n=4)
    if w == "h": batch("river 5, 8 wild, hand 15", prow=5, hand={2: 15, 3: 12, 4: 10})
    if w == "i": batch("river 5, 4 wild, hand 15", prow=5, wild_n=4, hand={2: 15, 3: 12, 4: 10})
    if w == "j": batch("river 5, 4 wild, 4p hand 10", prow=5, wild_n=4, players=4, hand={2: 15, 3: 12, 4: 10})
    if w == "k": batch("river 5, 4 wild, 3p hand 12", prow=5, wild_n=4, players=3, hand={2: 15, 3: 12, 4: 10})
    if w == "s0": batch("river 5, 4 wild, hand 12 (no straddle)", prow=5, wild_n=4)
    if w == "s1": batch("river 5, 4 wild, hand 12, straddle", prow=5, wild_n=4, straddle=True)
    if w == "s2": batch("river 5, 4 wild, 4p hand 10, straddle", prow=5, wild_n=4, players=4, hand={2: 15, 3: 12, 4: 10}, straddle=True)
    if w == "s3": batch("river 5, 4 wild, hand 15, straddle", prow=5, wild_n=4, hand={2: 15, 3: 12, 4: 10}, straddle=True)
    if w == "s4": batch("river 5, no wild, hand 12, straddle", prow=5, wild_n=0, straddle=True)
