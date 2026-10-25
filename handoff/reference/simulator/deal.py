import sim, river, random, collections, statistics, sys
sim.use_nouns(False)
def batch(label, n, hand, vf, games=300):
    rules = dict(sim.BASE, **dict(river.BASE, prow=5, straddle=True, empty_rule=True))
    rules["hand"] = {n: hand}
    dk = dict(verb_factor=vf, particle_extra=1.0, wild=4)
    rng = random.Random(sum(map(ord, label)))
    st = collections.Counter(); hows = collections.Counter(); ends = []; deals = set(); left = []
    for _ in range(games):
        g = river.RiverGame(n, rules, rng, ["planner"] * n, dk)
        deals.add(tuple(len(h) for h in g.hands)); left.append(len(g.pile))
        r = g.run(); st.update(r["stats"]); hows[r["how"]] += 1
        hs = sorted(len(h) for h in g.hands); ends.append((hs[0], hs[-1]))
    deck = sim.build_deck(**dk); nv = sum(1 for k, _ in deck if k == "V")
    print(f"{label:30s} | verbs {nv} | dealt {sorted(deals)[0]} | deck left after deal {statistics.mean(left):.0f} | completed {st['completed']/games:5.1f} "
          f"| straddles {st['straddles']/games:3.1f} | go out {100*hows['win']/games:3.0f}% | end {tuple(round(statistics.mean(x),1) for x in zip(*ends))}", flush=True)
w = sys.argv[1]
if w == "a": batch("2p, 12 cards, 22 verbs", 2, 12, 0.5)
if w == "b": batch("3p, 9 cards, 22 verbs", 3, 9, 0.5)
if w == "c": batch("3p, 12 cards, 36 verbs", 3, 12, 1.0)
if w == "d": batch("4p, 7 cards, 22 verbs", 4, 7, 0.5)
if w == "e": batch("4p, 10 cards, 36 verbs", 4, 10, 1.0)
if w == "f": batch("3p, 10 cards, 29 verbs", 3, 10, 0.75)
