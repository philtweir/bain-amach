"""Turn-based version of the river rules: same plays, players take turns instead of racing.
On your turn: make one play (lone verb, or a full line incl. straddles, or swap a meaning), or draw one card
(from the meaning pile if you hold < 2 meanings) and pass. After a full round of passes, each river pile buries its top.
Game ends when someone empties their hand, or when every pile is dry and a full round passes: fewest cards wins."""
import collections, random, statistics, sys
import sim, river

class TurnGame(river.RiverGame):
    def run(self, max_ticks=3000):
        n = len(self.hands); passes = 0; turn = self.rng.randrange(n); self.first = turn
        for t in range(max_ticks):
            i = turn % n; turn += 1
            idle = getattr(self, "_idle", 0)
            if idle > 6 * n and not self.pile:
                return self.finish("deadlock", t)
            self._idle = idle + 1
            it = self.intent(i)
            if it is not None:
                _, card, mv = it
                if self.apply(i, card, mv):
                    if mv[0] == "SWAP":          # a swap uses your turn but doesn't count as progress
                        passes += 1
                        if passes >= 3 * n and not self.pile and not self.mpile:
                            return self.finish("deadlock", t)
                        continue
                    passes = 0; self._idle = 0
                    if not self.hands[i]: return self.finish("win", t, i)
                    continue
            # pass: draw one
            h = self.hands[i]
            ng = sum(1 for k, _ in h if k == "M")
            drew = False
            if ng < self.rules.get("mpile_choice", 2) and (self.mpile or self.faceup):
                before = len(h); self.draw_river(i); drew = len(h) > before
            if not drew and self.pile:
                h.append(self.pile.pop()); drew = True
            if not drew and (self.mpile or self.faceup):
                before = len(h); self.draw_river(i); drew = len(h) > before
            passes += 1
            if passes >= n:
                self.stats["stall"] += 1
                for p in self.ppiles:
                    if len(p) > 1: p.insert(0, p.pop())
                if not drew and not self.pile and not self.mpile:
                    return self.finish("deadlock", t)
                passes = 0 if drew else passes
        return self.finish("timeout", max_ticks)

def batch(label, n=300, players=2, cls=TurnGame, hand=None, **over):
    sim.use_nouns(False)
    rules = dict(sim.BASE, **dict(river.BASE, prow=5, straddle=True, **over))
    if hand: rules["hand"] = hand
    dk = dict(verb_factor=0.5, particle_extra=1.0, wild=4)
    rng = random.Random(sum(map(ord, label)) * 17)
    st = collections.Counter(); ends = []; plays = []; hows = collections.Counter(); firstwin = 0; wins = 0
    for _ in range(n):
        g = cls(players, rules, rng, ["planner"] * players, dk)
        r = g.run(); st.update(r["stats"]); hows[r["how"]] += 1
        hs = [len(h) for h in g.hands]; ends.append((min(hs), max(hs)))
        w = r["winner"] if r["how"] == "win" else (hs.index(min(hs)) if hs.count(min(hs)) == 1 else None)
        if w is not None and hasattr(g, "first"):
            wins += 1; firstwin += (w == g.first)
        plays.append(st["completed"])
    fw = f" | first player wins {100*firstwin/max(1,wins):.0f}%" if wins else ""
    print(f"{label:38s} | completed {st['completed']/n:5.1f} (straddle {st['straddles']/n:3.1f}) | go out {100*hows['win']/n:3.0f}% "
          f"| timeout {hows['timeout']} | end {tuple(round(statistics.mean(x),1) for x in zip(*ends))} | rounds of passing {st['stall']/n:5.1f}{fw}", flush=True)

if __name__ == "__main__":
    w = sys.argv[1]
    if w == "race2": batch("race, 2 players", cls=river.RiverGame)
    if w == "turn2": batch("turns, 2 players")
    if w == "turn3": batch("turns, 3 players (12 cards)", players=3)
    if w == "turn4": batch("turns, 4 players (10 cards)", players=4, hand={2: 12, 3: 12, 4: 10})
    if w == "race4": batch("race, 4 players (10 cards)", players=4, cls=river.RiverGame, hand={2: 12, 3: 12, 4: 10})
