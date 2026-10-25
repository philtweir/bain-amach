"""
Strict variant: no dead-line rule, no ownership.
- Verbs can go down alone (new hubs still pay the tax).
- A particle may only go down together with a meaning (one play), or into the gap
  in front of a meaning that is already down on that arm.
- A meaning may go down alone on an empty verb arm, leaving a gap of exactly the
  number of particles some compound for that verb needs ("a claim").
- Gap squares are reserved: nothing else can be placed there.
- Win: first to empty your hand. Otherwise fewest cards when nobody can play and the piles are dry.
"""
import collections, random, statistics, sys
import sim
from sim import add, DIRS, COMP_BY_VERB, opts


class StrictGame(sim.Game):
    def __init__(self, *a, **k):
        self.claims = {}        # (v, d) -> dict(cell, L, card, owner)
        self.reserved = set()
        super().__init__(*a, **k)

    # ----- geometry -----
    def occupied(self, c):
        return c in self.board or c in self.reserved

    def hub_spot(self):
        best = None; n = 0
        for c in self.SPIRAL:
            if self.occupied(c): continue
            room = sum(all(not self.occupied(add(c, d, k)) for k in (1, 2)) for d in DIRS)
            if best is None or room > best[0]: best = (room, c)
            n += 1
            if room == 4 or n > 150: break
        return best[1]

    def arm_state(self, v, d):
        """Return ('empty', None) | ('claim', parts) | ('done'/'blocked', None)."""
        if (v, d) in self.claims:
            parts, k = [], 1
            while True:
                cell = self.board.get(add(v, d, k))
                if cell is None or cell["kind"] == "M": break
                parts.append(cell["tok"]); k += 1
            cl = self.claims[(v, d)]
            if len(parts) >= cl["L"]: return "done", None
            return "claim", parts
        c = add(v, d)
        if self.occupied(c): return "blocked", None
        return "empty", None

    def run_free(self, v, d, n):
        return all(not self.occupied(add(v, d, k)) for k in range(1, n + 1))

    # single-card particle/meaning moves are never legal on their own here
    def moves(self, card):
        if card[0] in ("P", "N", "M"): return []
        return super().moves(card)

    # ----- legality helpers -----
    def compounds_for(self, vt, L, mtok):
        return [(ps, g) for ps, g in COMP_BY_VERB[vt] if len(ps) == L and g in opts(mtok)]

    def gloss_live(self, pi, g):
        for v in self.verbs:
            vt = self.board[v]["tok"]
            for d in DIRS:
                st, parts = self.arm_state(v, d)
                for ps, gg in COMP_BY_VERB[vt]:
                    if gg != g: continue
                    if st == "empty" and self.run_free(v, d, len(ps) + 1): return True
        for v, ps, gg in sim.COMPOUNDS:
            if gg == g and ("V", v) in self.hands[pi]: return True
        return False

    # ----- intents -----
    def strict_intents(self, pi):
        hand = self.hands[pi]; have = collections.Counter(hand)
        mcards = sorted(set(c for c in hand if c[0] == "M"))
        out = []
        for v in self.verbs:
            vt = self.board[v]["tok"]
            for d in DIRS:
                st, parts = self.arm_state(v, d)
                if st == "empty":
                    for m in mcards:
                        for ps, g in COMP_BY_VERB[vt]:
                            if g not in opts(m[1]) or not self.run_free(v, d, len(ps) + 1): continue
                            need = collections.Counter(("P", p) for p in ps)
                            if all(have[k] >= n for k, n in need.items()):
                                out.append((12 + len(ps) + self.rng.random() * .1, m, ("SCOMBO", v, d, ps, m, vt)))
                            else:
                                # claim: lay the meaning alone, leaving the gap
                                part = sum(min(have[k], n) for k, n in need.items())
                                sc = 3 + part     # better if we hold some of the particles
                                out.append((sc + self.rng.random() * .1, m, ("CLAIM", v, d, len(ps), m, vt)))
                elif st == "claim":
                    cl = self.claims[(v, d)]
                    comps = [ps for ps, g in self.compounds_for(vt, cl["L"], cl["card"][1])
                             if ps[:len(parts)] == tuple(parts)]
                    for ps in comps:
                        rest = ps[len(parts):]
                        need = collections.Counter(("P", p) for p in rest)
                        if all(have[k] >= n for k, n in need.items()):
                            out.append((11 + len(rest) + self.rng.random() * .1, ("P", rest[0]),
                                        ("FILL", v, d, rest, vt, ps)))
                        elif have[("P", rest[0])]:
                            out.append((6 + self.rng.random() * .1, ("P", rest[0]),
                                        ("FILL", v, d, rest[:1], vt, ps)))
        return out

    def intent(self, pi):
        self._mover = pi; self._slots = None
        cands = []
        sw = self.swap_intent(pi)
        if sw: cands.append(sw)
        for card in set(self.hands[pi]):
            if card[0] == "V":
                for mv in super().moves(card):
                    sc = self.score(pi, card, mv)
                    if self.rules.get("sensible_verbs") and sc < 1: continue   # don't pay 2 for a verb you can't use
                    cands.append((sc + self.rng.random() * .1, card, mv))
        cands += self.strict_intents(pi)
        if not cands: return None
        return max(cands, key=lambda x: x[0])

    # ----- applying -----
    def apply(self, pi, card, mv):
        kind = mv[0]
        if kind not in ("SCOMBO", "CLAIM", "FILL"):
            return super().apply(pi, card, mv)
        hand = self.hands[pi]; have = collections.Counter(hand)
        if kind == "SCOMBO":
            _, v, d, ps, m, vt = mv
            need = collections.Counter([("P", p) for p in ps] + [m])
            if self.arm_state(v, d)[0] != "empty" or not self.run_free(v, d, len(ps) + 1) or \
                    any(have[k] < n for k, n in need.items()):
                self.stats["sniped"] += 1; return False
            for k, n in need.items():
                for _ in range(n): hand.remove(k)
            for i, p in enumerate(ps): self.place(add(v, d, i + 1), ("P", p), v, d, pi)
            self.place(add(v, d, len(ps) + 1), m, v, d, pi)
            self.claims[(v, d)] = dict(cell=add(v, d, len(ps) + 1), L=len(ps), card=m, owner=pi)
            self.complete(pi, vt, ps, m, own=True)
            self.log(f"P{pi} lays {' '.join(ps)} + meaning on {vt}: {vt} {' '.join(ps)} = {self.used_gloss(vt, ps, m)}")
            return True
        if kind == "CLAIM":
            _, v, d, L, m, vt = mv
            if self.arm_state(v, d)[0] != "empty" or not self.run_free(v, d, L + 1) or have[m] < 1:
                self.stats["sniped"] += 1; return False
            hand.remove(m)
            cell = add(v, d, L + 1)
            self.place(cell, m, v, d, pi)
            for k in range(1, L + 1): self.reserved.add(add(v, d, k))
            self.claims[(v, d)] = dict(cell=cell, L=L, card=m, owner=pi)
            self.stats["claims"] += 1
            self.log(f"P{pi} lays meaning {m[1]} on {vt}, leaving {L} gap(s)")
            return True
        if kind == "FILL":
            _, v, d, rest, vt, ps = mv
            st, parts = self.arm_state(v, d)
            if st != "claim" or ps[:len(parts)] != tuple(parts):
                self.stats["sniped"] += 1; return False
            need = collections.Counter(("P", p) for p in rest)
            if any(have[k] < n for k, n in need.items()):
                self.stats["sniped"] += 1; return False
            for k, n in need.items():
                for _ in range(n): hand.remove(k)
            for i, p in enumerate(rest):
                c = add(v, d, len(parts) + 1 + i)
                self.reserved.discard(c)
                self.place(c, ("P", p), v, d, pi)
            cl = self.claims[(v, d)]
            if len(parts) + len(rest) == cl["L"]:
                self.complete(pi, vt, ps, cl["card"], own=(cl["owner"] == pi))
                self.log(f"P{pi} fills {' '.join(rest)}: {vt} {' '.join(ps)} = {self.used_gloss(vt, ps, cl['card'])}")
            else:
                self.log(f"P{pi} fills {' '.join(rest)} on {vt} (meaning already down)")
            return True

    def used_gloss(self, vt, ps, m):
        return next(g for p2, g in COMP_BY_VERB[vt] if p2 == ps and g in opts(m[1]))

    def complete(self, pi, vt, ps, m, own):
        self.stats["completed"] += 1
        if not own: self.stats["captures"] += 1
        self.done.add((vt, ps))

    def finish(self, how, t, winner=None):
        open_claims = 0
        for (v, d), cl in self.claims.items():
            if self.arm_state(v, d)[0] == "claim": open_claims += 1
        self.stats["open_claims"] += open_claims
        return super().finish(how, t, winner)


BASE = dict(dump=True, clean_out=False, orphan_kill=False, dead_return=None, verb_attach="pay", pay_cost=2,
            mpile="rummy", mpile_choice=2, spiral=True, directional=True, multi=3)
DK = dict(verb_factor=1.0, particle_extra=2.0)


def batch(label, n=250, players=2, dk=None, **over):
    sim.use_nouns(False)
    rules = dict(sim.BASE, **dict(BASE, **over))
    rng = random.Random(sum(map(ord, label)))
    res = []; st = collections.Counter(); ends = []; ticks = []
    for _ in range(n):
        g = StrictGame(players, rules, rng, ["planner"] * players, dk or DK)
        r = g.run(); res.append(r); st.update(r["stats"]); ticks.append(r["ticks"])
        hs = sorted(len(h) for h in g.hands); ends.append((hs[0], hs[-1]))
    hows = collections.Counter(r["how"] for r in res)
    print(f"{label:44s} | completed {st['completed']/n:5.1f} | captures {st['captures']/n:4.1f} | claims {st['claims']/n:4.1f} "
          f"| open claims at end {st['open_claims']/n:4.1f} | go out {100*hows['win']/n:4.0f}% | timeout {hows['timeout']} "
          f"| end {tuple(round(statistics.mean(x),1) for x in zip(*ends))} | ticks {statistics.median(ticks):5.0f} "
          f"| stalls {st['stall']/n:5.1f}", flush=True)


if __name__ == "__main__":
    w = sys.argv[1]
    if w == "a": batch("strict, new verb costs 2")
    if w == "b": batch("strict, new verb costs 1", pay_cost=1)
    if w == "c": batch("strict, new verb free", pay_cost=0)
    if w == "d": batch("strict, 4 players", players=4)
