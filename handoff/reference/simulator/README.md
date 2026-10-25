# Python simulator (reference only)

The research tool used to tune the rules. **Do not port it.** It carries every rule variant tried along the way (dead lines, claims, taxes, noun rivers…), switched on by option flags. The design is final, and the JS engine in `../engine/` implements only that version.

Use it to answer "why is the rule like this?" or to re-run a balance question after changing the deck.

| File | What it adds |
| --- | --- |
| `sim.py` | Base game, compound list (hard-coded here, **not** read from `data/deck.json`), planner bots, rule flags |
| `strict.py` | The "particle needs a meaning" variant with claims (rejected) |
| `wild.py` | Wildcards and the meaning answers printed on cards |
| `river.py` | **Final shape:** particle river, single verb OR full line, straddles. Race mode. |
| `turns.py` | Turn mode on top of `river.py`, with pass/stall/bury |
| `deal.py` | Deal-size and verb-count sweeps by player count |

Run from this folder (Python 3, standard library only):

```
python3 turns.py turn2     # turn mode, 2 players
python3 turns.py turn4     # turn mode, 4 players, hand 10
python3 turns.py race2     # race mode, 2 players
python3 river.py <letter>  # older river batches; see __main__ at the bottom
```

Headline numbers it produced (honest deals): 2 players about 24.5 lines per game, 37% of games end with someone going out; 3 players 31.6 lines, 43%; 4 players 30.8 lines, 48%. The Python race bots go out more often than the JS engine's simple bot. That gap is about bot skill, not rules.
