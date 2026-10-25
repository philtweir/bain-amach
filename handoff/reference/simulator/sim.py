"""
Simulation of the Ulster Irish compound-verb speed game.

Rules modelled (current design):
- Card types: VERB, PARTICLE (adverb or preposition), MEANING (English gloss).
- Shared board. A few starter verbs are laid face up, well apart.
- Verbs are hubs. Lines read OUTWARD from a verb in any of 4 directions.
- A particle must chain back to exactly one verb through particles only, and the
  chain so far must be a prefix of a real compound for that verb.
- A meaning card goes only on the outer end of a chain with >=1 particle, and must
  match that exact compound's gloss. It terminates the arm.
- No side-touching: a new card may touch only the card it extends.
- Speed: each tick, each player acts with probability SPEED. Intents are chosen
  against the same board state; if someone else gets there first, you're sniped.
- Stall: if nobody can play, everyone draws 1. Stall with empty pile = deadlock.
- Win: first player to empty their hand.

Rule variants under test:
- verb_attach: how new verbs enter the board
    'none'     -> only starter verbs ever exist (strict connection-required)
    'meaning'  -> a verb may be laid touching a placed meaning card
    'pay'      -> a verb may be laid unconnected, cost: draw 1
    'both'     -> meaning OR pay
- dump: a player stuck for DUMP_AFTER ticks returns 1 card and draws 2
"""
import random, collections, statistics, math, sys, zlib

COMPOUNDS = [
    ("bain", ("amach",), "REACH"),
    ("bain", ("as",), "GET FROM"),
    ("bain", ("de",), "TAKE OFF"),
    ("bain", ("le",), "CONCERN"),
    ("cuir", ("amach",), "THROW UP"),
    ("cuir", ("ar",), "PUT ON"),
    ("cuir", ("isteach", "ar"), "APPLY FOR"),
    ("cuir", ("suas", "le"), "PUT UP WITH"),
    ("cuir", ("síos", "ar"), "DESCRIBE"),
    ("cuir", ("as", "do"), "DISTURB"),
    ("tabhair", ("suas",), "GIVE UP"),
    ("tabhair", ("faoi",), "ATTEMPT"),
    ("tabhair", ("amach", "do"), "SCOLD"),
    ("tabhair", ("ar",), "MAKE (SOMEONE)"),
    ("déan", ("amach",), "FIGURE OUT"),
    ("déan", ("ar",), "HEAD FOR"),
    ("éirigh", ("le",), "SUCCEED"),
    ("éirigh", ("as",), "GIVE UP"),
    ("éirigh", ("amach",), "REBEL"),
    ("tit", ("amach",), "HAPPEN"),
    ("tóg", ("suas",), "PICK UP"),
    ("tóg", ("ar",), "HOLD AGAINST"),
    ("coinnigh", ("ar",), "KEEP GOING"),
    ("coinnigh", ("suas",), "KEEP UP"),
    ("fan", ("le",), "WAIT FOR"),
    ("fan", ("amach", "ó"), "STAY AWAY FROM"),
    ("lig", ("amach",), "LET OUT"),
    ("lig", ("ar",), "PRETEND"),
    ("lig", ("do",), "LEAVE ALONE"),
    ("buail", ("le",), "MEET"),
    ("buail", ("isteach",), "DROP IN"),
    ("éist", ("le",), "LISTEN TO"),
    ("amharc", ("ar",), "LOOK AT"),
    ("fág", ("amach",), "LEAVE OUT"),
    ("seas", ("le",), "STAND BY"),
    ("tar", ("ar",), "COME ACROSS"),
]

NOUN_COMPOUNDS = [
    ("tabhair", ("aire", "do"), "LOOK AFTER"),
    ("bain", ("úsáid", "as"), "MAKE USE OF"),
    ("bain", ("sult", "as"), "ENJOY"),
    ("bain", ("triail", "as"), "TRY OUT"),
    ("déan", ("dearmad", "de"), "FORGET"),
    ("cuir", ("aithne", "ar"), "GET TO KNOW"),
    ("tabhair", ("cuairt", "ar"), "VISIT"),
    ("tabhair", ("aghaidh", "ar"), "FACE"),
    ("cuir", ("suim", "i"), "TAKE AN INTEREST IN"),
    ("cuir", ("fáilte", "roimh"), "WELCOME"),
    ("tóg", ("ceann", "de"), "HEED"),
    ("cuir", ("glaoch", "ar"), "PHONE"),
    ("cuir", ("eagla", "ar"), "FRIGHTEN"),
    ("cuir", ("fearg", "ar"), "ANGER"),
]
EXTRA_COMPOUNDS = [
    ("tóg", ("amach",), "TAKE OUT"), ("tóg", ("isteach",), "TAKE IN"),
    ("lig", ("isteach",), "LET IN"), ("lig", ("síos",), "LET DOWN"),
    ("gabh", ("amach",), "GO OUT"), ("gabh", ("isteach",), "GO IN"),
    ("gabh", ("suas",), "GO UP"), ("gabh", ("síos",), "GO DOWN"),
    ("éirigh", ("suas",), "GET UP"), ("tit", ("isteach",), "FALL IN"),
    ("tit", ("síos",), "FALL DOWN"), ("seas", ("suas",), "STAND UP"),
    ("seas", ("amach",), "STAND OUT"), ("cuir", ("chuig",), "SEND TO"),
    ("scríobh", ("chuig",), "WRITE TO"), ("labhair", ("le",), "SPEAK TO"),
    ("labhair", ("faoi",), "TALK ABOUT"), ("smaoinigh", ("ar",), "THINK OF"),
    ("glac", ("le",), "ACCEPT"), ("bris", ("isteach",), "BREAK IN"),
    ("bris", ("amach",), "BREAK OUT"), ("caith", ("amach",), "THROW OUT"),
    ("ól", ("suas",), "DRINK UP"), ("ith", ("suas",), "EAT UP"),
]
NOUNS = {ps[0] for _, ps, _ in NOUN_COMPOUNDS}
ADVERBS = {"amach", "isteach", "suas", "síos"}
BASE_COMPOUNDS = list(COMPOUNDS)


def use_nouns(on, extra=False):
    """Switch the compound inventory (module-level, so set before building games)."""
    COMPOUNDS[:] = BASE_COMPOUNDS + (NOUN_COMPOUNDS if on else []) + (EXTRA_COMPOUNDS if extra else [])
    COMP_BY_VERB.clear()
    for v, p, g in COMPOUNDS:
        COMP_BY_VERB[v].append((p, g))


DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
def add(a, d, k=1): return (a[0] + k * d[0], a[1] + k * d[1])

COMP_BY_VERB = collections.defaultdict(list)
for v, p, g in COMPOUNDS:
    COMP_BY_VERB[v].append((p, g))


def opts(tok):
    return tok.split("|")


def build_deck(verb_factor=0.5, particle_extra=1.0, gloss_per_compound=1.0, flat_verbs=None, flat_particles=None, wild=0):
    deck = [("W", "*")] * wild
    for v, comps in COMP_BY_VERB.items():
        n = flat_verbs if flat_verbs else max(1, round(len(comps) * verb_factor))
        deck += [("V", v)] * n
    pc = collections.Counter(p for _, ps, _ in COMPOUNDS for p in ps if p not in NOUNS)
    for p, n in pc.items():
        k = flat_particles if flat_particles else max(1, round(n * particle_extra))
        deck += [("P", p)] * k
    nc = collections.Counter(p for _, ps, _ in COMPOUNDS for p in ps if p in NOUNS)
    for p, n in nc.items():
        deck += [("N", p)] * n
    gc = collections.Counter(g for _, _, g in COMPOUNDS)
    for g, n in gc.items():
        deck += [("M", g)] * max(1, round(n * gloss_per_compound))
    return deck


class Game:
    def __init__(self, n_players, rules, rng, bots, deck_kw=None, log=False):
        self.rng, self.rules, self.bots, self.log_on = rng, rules, bots, log
        self.logs = []
        deck = build_deck(**(deck_kw or {}))
        rng.shuffle(deck)
        self.board, self.verbs = {}, []
        self.ever = set()
        # starter verbs: distinct, spaced well apart
        starters, seen = [], set()
        for c in list(deck):
            if c[0] == "V" and c[1] not in seen and len(starters) < rules["starters"]:
                starters.append(c); seen.add(c[1]); deck.remove(c)
        for i, c in enumerate(starters):
            if rules.get("spiral"):
                self.place(self.hub_spot(), c, None, None, -1)
            else:
                self.place((i * 12, 0), c, None, None, -1)
        if rules.get("multi", 1) > 1:
            k = rules["multi"]
            gl = [t for c, t in deck if c == "M"]
            deck = [c for c in deck if c[0] != "M"]
            for _ in range(200):
                pool = gl * k; rng.shuffle(pool)
                cards = [pool[i:i + k] for i in range(0, len(pool), k)]
                if all(len(set(c)) == k for c in cards): break
            deck += [("M", "|".join(c)) for c in cards[:len(gl)]]
            rng.shuffle(deck)
        self.npiles = []
        if rules.get("noun_river"):
            nouns = [c for c in deck if c[0] == "N"]
            deck = [c for c in deck if c[0] != "N"]
            r = rules["noun_river"]
            self.npiles = [nouns[i::r] for i in range(r)]
        self.market, self.gloss_pile = [], []
        if rules.get("market"):
            self.gloss_pile = [c for c in deck if c[0] == "M"]
            deck = [c for c in deck if c[0] != "M"]
            for _ in range(rules["market"]):
                if self.gloss_pile: self.market.append(self.gloss_pile.pop())
        self.gloss_total = collections.Counter(o for k, t in deck if k == "M" for o in opts(t))
        self.mpile, self.faceup = [], []
        self.known = collections.defaultdict(collections.Counter)
        if rules.get("mpile"):
            self.mpile = [c for c in deck if c[0] in ("M", "N")]
            deck = [c for c in deck if c[0] not in ("M", "N")]
        self.pile = deck
        hs = rules["hand"][n_players]
        if rules.get("mpile"):
            ng = rules.get("deal_glosses", 3)
            self.hands = [[self.pile.pop() for _ in range(hs - ng)] + [self.mpile.pop() for _ in range(ng)]
                          for _ in range(n_players)]
            self.faceup = [self.mpile.pop() for _ in range(rules.get("river", 1))]
        else:
            self.hands = [[self.pile.pop() for _ in range(hs)] for _ in range(n_players)]
        self.stuck = [0] * n_players
        self.far = 0
        self._mover = None
        self.done = set()
        self.stats = collections.Counter()

    def log(self, s):
        if self.log_on: self.logs.append(s)

    def place(self, pos, card, verb, d, player):
        kind, tok = card
        self.board[pos] = dict(kind=kind, tok=tok, verb=verb, dir=d, player=player)
        self.ever.add(pos)
        self.peak = max(getattr(self, "peak", 0), len(self.board))
        if kind == "V": self.verbs.append(pos)
        self._slots = None

    def arm(self, v, d):
        parts, k = [], 1
        while True:
            c = add(v, d, k); cell = self.board.get(c)
            if cell is None: return parts, c, False
            if cell["verb"] == v and cell["dir"] == d:
                if cell["kind"] == "M": return parts, None, True
                parts.append(cell["tok"]); k += 1
            else:
                return parts, None, False

    SPIRAL = sorted(((x, y) for x in range(-40, 41) for y in range(-40, 41)),
                    key=lambda p: (max(abs(p[0]), abs(p[1])), abs(p[0]) + abs(p[1]), p))

    def hub_spot(self):
        """Where a sensible human would put a new hub: near the cluster, with room for arms."""
        best = None; n = 0
        for c in self.SPIRAL:
            if c in self.board: continue
            if not self.rules.get("directional") and any(add(c, d) in self.board for d in DIRS): continue
            room = sum(all(add(c, d, k) not in self.board for k in (1, 2)) for d in DIRS)
            if best is None or room > best[0]: best = (room, c)
            n += 1
            if room == 4 or n > 150: break
        return best[1]

    def free(self, c, prev):
        if c in self.board: return False
        if self.rules.get("directional"): return True
        return all(add(c, d) == prev or add(c, d) not in self.board for d in DIRS)

    def slots(self):
        if getattr(self, "_slots", None) is None:
            sl = []
            for v in self.verbs:
                vt = self.board[v]["tok"]
                for d in DIRS:
                    parts, c, term = self.arm(v, d)
                    if c is None or term: continue
                    if not self.free(c, add(c, d, -1)): continue
                    sl.append((v, vt, d, parts, c))
            mcells = []
            for m, cell in self.board.items():
                if cell["kind"] != "M": continue
                for d in DIRS:
                    c = add(m, d)
                    if self.free(c, m): mcells.append(c)
            self._played = collections.Counter(o for cl in self.board.values() if cl["kind"] == "M" for o in opts(cl["tok"]))
            self._slots = (sl, mcells)
        return self._slots

    def moves(self, card):
        kind, tok = card
        out = []
        sl, mcells = self.slots()
        if kind in ("P", "M", "N"):
            for v, vt, d, parts, c in sl:
                    if kind in ("P", "N"):
                        lim = self.rules.get("open_limit")
                        if lim and not parts and self._mover is not None and \
                                self.open_owned(self._mover) >= lim:
                            continue
                        seq = tuple(parts) + (tok,)
                        if self.rules.get("once"):
                            ok_gloss = lambda g, ps=None: (vt, ps) not in self.done
                        elif self.rules.get("orphan_kill"):
                            ok_gloss = lambda g, ps=None: self._played[g] < self.gloss_total[g]
                        else:
                            ok_gloss = lambda g, ps=None: True
                        nxt = add(c, d)
                        room = nxt not in self.board and (self.rules.get("directional") or
                                                          all(add(nxt, e) == c or add(nxt, e) not in self.board for e in DIRS))
                        if room and any(ps[:len(seq)] == seq and ok_gloss(g, ps) for ps, g in COMP_BY_VERB[vt]):
                            out.append((kind, c, v, d, vt, seq))
                    elif parts:
                        if any(ps == tuple(parts) and g in opts(tok) and not (self.rules.get("once") and (vt, ps) in self.done)
                               for ps, g in COMP_BY_VERB[vt]):
                            out.append(("M", c, v, d, vt, tuple(parts)))
        else:
            va = self.rules["verb_attach"]
            if va in ("meaning", "both"):
                for c in mcells: out.append(("V", c, None, None, tok, None))
            if va in ("pay", "both") and (not self.rules.get("empty_rule") or self.pile or self.mpile):
                out.append(("VPAY", None, None, None, tok, None))
        return out

    # ---- bot policy ----
    def score(self, pi, card, mv):
        hand = self.hands[pi]
        kind = mv[0]
        if kind == "M": return 10
        if kind in ("P", "N"):
            _, c, v, d, vt, seq = mv
            gl = {o for k, g in hand if k == "M" for o in opts(g)} | {g for _, g in self.market}
            best = 1.0
            for ps, g in COMP_BY_VERB[vt]:
                if ps[:len(seq)] == seq and g in gl:
                    rest = collections.Counter(ps[len(seq):])
                    have = collections.Counter(t for k, t in hand if k in ("P", "N"))
                    for _, t in self.faceup: have[t] += 1 if t in NOUNS else 0
                    for _, t in self.river_tops(): have[t] += 1
                    have[card[1]] -= 1
                    best = max(best, 8 if all(have[p] >= n for p, n in rest.items()) else 6)
            if self.bots[pi] == "careful" and best < 6:
                best = 0.3
            if self.bots[pi] == "reader" and best < 6 and len(seq) == 1:
                for oj, kn in self.known.items():
                    if oj == pi: continue
                    for g, n in kn.items():
                        if n > 0 and any(gg == g and v2 == vt and ps[0] != seq[0]
                                         for v2, ps, gg in COMPOUNDS):
                            best = max(best, 4)
            if self.bots[pi] == "spoiler" and best < 6:
                owner = self.board[v]["player"]
                if owner not in (pi,) and len(seq) == 1: best = 3
            return best
        tok = mv[4]
        planned = any(
            any(k == "M" and g in opts(t) for k, t in hand) and
            (("P", ps[0]) in hand or ("N", ps[0]) in hand or ("N", ps[0]) in self.river_tops())
            for ps, g in COMP_BY_VERB[tok])
        if kind == "V": return 5 if planned else 2
        return 3 if planned else 0.5  # VPAY

    def open_owned(self, pi):
        n = 0
        for v, vt, d, parts, c in self.slots()[0]:
            if parts and self.board[add(v, d)]["player"] == pi: n += 1
        return n

    def owns_unfinished(self, pi):
        for v in self.verbs:
            for d in DIRS:
                parts, c, term = self.arm(v, d)
                if parts and not term:
                    for k in range(1, len(parts) + 1):
                        if self.board[add(v, d, k)]["player"] == pi: return True
        return False

    def kill_dead(self):
        """Unfinished arms that can't be finished: blocked, or (orphan_kill) every gloss
        that could finish them is already on the board. dead_return='hand' gives the cards
        back to whoever laid them; anything else just clears them off the board."""
        if not (self.rules.get("dead_return") or self.rules.get("orphan_kill")): return
        changed = True
        while changed:
            changed = False
            played = collections.Counter(o for cl in self.board.values() if cl["kind"] == "M" for o in opts(cl["tok"]))
            for v in list(self.verbs):
                for d in DIRS:
                    parts, c, term = self.arm(v, d)
                    if not parts or term: continue
                    blocked = not (c is not None and self.free(c, add(c, d, -1)))
                    orphan = False
                    if self.rules.get("orphan_kill"):
                        vt = self.board[v]["tok"]; seq = tuple(parts)
                        if self.rules.get("once"):
                            orphan = not any(ps[:len(seq)] == seq and (vt, ps) not in self.done
                                             for ps, g in COMP_BY_VERB[vt])
                        else:
                            orphan = not any(ps[:len(seq)] == seq and played[g] < self.gloss_total[g]
                                             for ps, g in COMP_BY_VERB[vt])
                    if not (blocked or orphan): continue
                    back = self.rules.get("dead_return") == "hand"
                    for k in range(1, len(parts) + 1):
                        cell = self.board.pop(add(v, d, k))
                        if back and cell["player"] >= 0:
                            self.hands[cell["player"]].append((cell["kind"], cell["tok"]))
                    self.stats["dead_lines"] += 1
                    self._slots = None; changed = True

    def combo_cells_free(self, start, d, n):
        return all(add(start, d, k) not in self.board for k in range(n))

    def combo_intents(self, pi):
        """Lay the rest of a line in one action: final particle(s) + meaning on an existing verb,
        or (combo='all') verb + particle(s) + meaning as a brand-new hub."""
        hand = self.hands[pi]
        have = collections.Counter(hand)
        mcards = [c for c in set(hand) if c[0] == "M"]
        out = []
        if not mcards: return out
        sl, _ = self.slots()
        for v, vt, d, parts, c in sl:
            for ps, g in COMP_BY_VERB[vt]:
                if ps[:len(parts)] != tuple(parts): continue
                rest = ps[len(parts):]
                if not rest: continue
                if self.rules["combo"] == "pm" and len(rest) != 1: continue
                need = collections.Counter(("P", p) for p in rest)
                if any(have[k] < n for k, n in need.items()): continue
                if not self.combo_cells_free(c, d, len(rest) + 1): continue
                if self._played[g] >= self.gloss_total[g]: continue
                if self.rules.get("once") and (vt, ps) in self.done: continue
                for m in mcards:
                    if g in opts(m[1]):
                        out.append((12 + len(rest) + self.rng.random() * 0.1, m,
                                    ("COMBO", v, d, c, tuple(rest), m, vt, ps, None)))
                        break
        if self.rules["combo"] == "all":
            for vcard in set(c for c in hand if c[0] == "V"):
                for ps, g in COMP_BY_VERB[vcard[1]]:
                    need = collections.Counter(("P", p) for p in ps)
                    if any(have[k] < n for k, n in need.items()): continue
                    if self.gloss_total[g] - self._played[g] <= 0: continue
                    if self.rules.get("once") and (vcard[1], ps) in self.done: continue
                    m = next((m for m in mcards if g in opts(m[1])), None)
                    if not m: continue
                    out.append((12 + len(ps) + 1 + self.rng.random() * 0.1, m,
                                ("COMBO", None, None, None, ps, m, vcard[1], ps, vcard)))
        return out

    def apply_combo(self, pi, mv):
        _, v, d, c, rest, m, vt, ps, vcard = mv
        hand = self.hands[pi]
        need = collections.Counter([("P", p) for p in rest] + [m] + ([vcard] if vcard else []))
        have = collections.Counter(hand)
        if any(have[k] < n for k, n in need.items()):
            self.stats["sniped"] += 1; return False
        if vcard:
            # new hub: find a spot with a free run in some direction
            spot = None
            for cand in self.SPIRAL:
                if cand in self.board: continue
                for dd in DIRS:
                    if self.combo_cells_free(add(cand, dd), dd, len(rest) + 1):
                        spot, d = cand, dd; break
                if spot: break
            for k, n in need.items():
                for _ in range(n): hand.remove(k)
            self.place(spot, vcard, None, None, pi)
            v = spot; c = add(v, d)
            for _ in range(self.rules.get("pay_cost", 1)):
                if self.pile: hand.append(self.pile.pop())
        else:
            self._mover = pi; self._slots = None
            parts, cc, term = self.arm(v, d)
            if cc != c or term or not self.combo_cells_free(c, d, len(rest) + 1):
                self.stats["sniped"] += 1; return False
            for k, n in need.items():
                for _ in range(n): hand.remove(k)
        first_owner = None
        for k in range(1, 1 + len(self.arm(v, d)[0])):
            first_owner = self.board[add(v, d, k)]["player"]; break
        for i, p in enumerate(rest):
            self.place(add(c, d, i), ("P", p), v, d, pi)
        self.place(add(c, d, len(rest)), m, v, d, pi)
        if first_owner is not None and first_owner != pi: self.stats["captures"] += 1
        self.kill_dead()
        self.stats["completed"] += 1; self.stats["combo_plays"] += 1
        self.stats["combo_cards"] += len(rest) + 1 + (1 if vcard else 0)
        self.done.add((vt, ps))
        self.log(f"P{pi} lays {(vcard[1] + ' ') if vcard else ''}{' '.join(rest)} + meaning in one go: {vt} {' '.join(ps)} = {m[1]}")
        return True

    def river_tops(self):
        return [p[-1] for p in self.npiles if p]

    def gloss_live(self, pi, g):
        """Could this gloss plausibly be finished: an open, compatible arm on the board,
        or its verb in hand with somewhere to put it."""
        sl, mcells = self.slots()
        for v, ps, gg in COMPOUNDS:
            if gg != g: continue
            for _, vt, d, parts, c in sl:
                if vt == v and tuple(parts) == ps[:len(parts)]: return True
            if ("V", v) in self.hands[pi] and (mcells or self.rules["verb_attach"] in ("pay", "both")):
                return True
        return False

    def card_live(self, pi, card):
        if card[0] == "M": return any(self.gloss_live(pi, o) for o in opts(card[1]))
        if card[0] == "N":
            return bool(self.moves(card)) or any(("V", v) in self.hands[pi]
                                                 for v, ps, _ in COMPOUNDS if ps[0] == card[1])
        return True

    def swap_intent(self, pi):
        if not self.rules.get("mpile") or not self.faceup: return None
        if self.rules["mpile"] == "rummy" or self.rules.get("river", 1) > 1:
            pool = list(self.faceup)
        else:
            pool = [self.faceup[-1]]
        live = [c for c in pool if self.card_live(pi, c)]
        dead = [c for c in self.hands[pi] if c[0] in ("M", "N") and not self.card_live(pi, c)]
        if not live or not dead: return None
        return (4 + self.rng.random() * 0.1, dead[0], ("SWAP", live[0]))

    def draw_river(self, pi):
        h = self.hands[pi]
        live = [c for c in self.faceup if self.card_live(pi, c)]
        if live:
            c = live[0]; self.faceup.remove(c); h.append(c)
            self.known[pi][c[1]] += 1
            if self.mpile: self.faceup.append(self.mpile.pop())
        elif self.mpile:
            h.append(self.mpile.pop())

    def intent(self, pi):
        self._mover = pi; self._slots = None
        sw = self.swap_intent(pi)
        cands = [sw] if sw else []
        for card in set(self.hands[pi]):
            for mv in self.moves(card):
                cands.append((self.score(pi, card, mv) + self.rng.random() * 0.1, card, mv))
        for card in set(self.market):
            for mv in self.moves(card):
                cands.append((10 + self.rng.random() * 0.1, card, mv))
        if self.rules.get("combo"):
            cands += self.combo_intents(pi)
        for i, p in enumerate(self.npiles):
            if not p: continue
            card = p[-1]
            for mv in self.moves(card):
                sc = self.score(pi, card, mv)
                if sc >= 6:   # only lift-and-play a noun you can follow through on
                    cands.append((sc - 1 + self.rng.random() * 0.1, card, ("RIVERN", i, mv)))
        if not cands: return None
        return max(cands, key=lambda x: x[0])

    def apply(self, pi, card, mv):
        kind = mv[0]
        if kind == "COMBO":
            return self.apply_combo(pi, mv)
        if kind == "RIVERN":
            _, i, inner = mv
            p = self.npiles[i]
            self._mover = pi; self._slots = None
            if not p or p[-1] != card or inner not in self.moves(card):
                self.stats["sniped"] += 1; return False
            p.pop()
            _, c, v, d, vt, seq = inner
            self.place(c, card, v, d, pi)
            self.kill_dead()
            self.stats["river_nouns"] += 1
            self.log(f"P{pi} plays {card[1]} from the river on {vt} (chain: {' '.join(seq)})")
            return True
        if kind == "SWAP":
            top = mv[1]
            if top not in self.faceup:
                self.stats["sniped"] += 1; return False
            self.faceup.remove(top)
            self.hands[pi].remove(card); self.hands[pi].append(top)
            self.known[pi][top[1]] += 1
            if self.rules["mpile"] == "rummy":
                self.faceup.append(card)           # your discard goes face up in the river
            else:                                   # river: discard to bottom, flip the next
                self.mpile.insert(0, card)
                if self.mpile: self.faceup.append(self.mpile.pop())
            self.stats["swaps"] += 1
            self.log(f"P{pi} swaps {card[1]} for face-up {top[1]}")
            return True
        # re-validate (sniping)
        self._mover = pi; self._slots = None
        if kind != "VPAY" and mv not in self.moves(card):
            self.stats["sniped"] += 1; return False
        from_market = card[0] == "M" and self.rules.get("market")
        if from_market:
            if card not in self.market:
                self.stats["sniped"] += 1; return False
            self.market.remove(card)
            if self.gloss_pile: self.market.append(self.gloss_pile.pop())
            # reward: shed one card from hand
            h = self.hands[pi]
            if h:
                worst = min(h, key=lambda c: max([self.score(pi, c, m) for m in self.moves(c)] or [-1]))
                h.remove(worst); self.pile.insert(0, worst)
                self.stats["reward_shed"] += 1
        else:
            self.hands[pi].remove(card)
        if kind == "VPAY":
            self.far += 1
            spot = self.hub_spot() if self.rules.get("spiral") else (12 * (self.far % 4), 12 * (self.far // 4 + 1))
            self.place(spot, card, None, None, pi)
            self.stats["pay_verb"] += 1
            for _ in range(self.rules.get("pay_cost", 1)):
                if self.pile: self.hands[pi].append(self.pile.pop())
                elif self.rules.get("empty_rule") and self.mpile: self.hands[pi].append(self.mpile.pop())
            self.log(f"P{pi} lays {card[1]} as a new hub (pays a draw)")
        elif kind == "V":
            self.place(mv[1], card, None, None, pi)
            self.kill_dead()
            self.stats["verb_on_meaning"] += 1
            self.log(f"P{pi} lays verb {card[1]} off a meaning card")
        else:
            _, c, v, d, vt, seq = mv
            self.place(c, card, v, d, pi)
            self.kill_dead()
            if kind == "M":
                if self.known[pi][card[1]] > 0: self.known[pi][card[1]] -= 1
                fo = self.board[add(v, d)]["player"]
                if fo != pi: self.stats["captures"] += 1
                self.stats["completed"] += 1
                self.done.add((vt, seq))
                if seq and seq[0] in NOUNS: self.stats["noun_completed"] += 1
                self.log(f"P{pi} completes {vt} {' '.join(seq)} = {card[1]}")
            else:
                self.log(f"P{pi} lays {card[1]} on {vt} (chain: {' '.join(seq)})")
        return True

    def run(self, max_ticks=1500):
        n = len(self.hands)
        for t in range(max_ticks):
            intents = [self.intent(i) for i in range(n)]
            if all(x is None for x in intents):
                if not self.pile and not (self.rules.get("mpile_choice") and (self.mpile or self.faceup)):
                    if self.rules.get("end_score"): return self.finish_scored(t)
                    return self.finish("deadlock", t)
                before = sum(len(h) for h in self.hands)
                moved = False
                self.stats["stall"] += 1
                for p in self.npiles:
                    if len(p) > 1: p.insert(0, p.pop())   # bury each river top
                for hi, h in enumerate(self.hands):
                    if self.rules.get("stall_discard"):
                        junk = self.junk_card(hi)
                        if junk is not None:
                            h.remove(junk); self.pile.insert(0, junk); self.stats["stall_discards"] += 1
                            moved = True
                            continue
                    ng = sum(1 for k, _ in h if k in ("M", "N"))
                    if self.rules.get("mpile_choice") and (self.mpile or self.faceup) and ng < self.rules["mpile_choice"]:
                        self.draw_river(hi)                 # chose the river this time
                        continue
                    if self.pile: h.append(self.pile.pop())
                    elif self.rules.get("mpile_choice") and (self.mpile or self.faceup): self.draw_river(hi)
                    if self.rules.get("mpile") and not self.rules.get("mpile_choice") and self.mpile and ng == 0:
                        h.append(self.mpile.pop())
                if sum(len(h) for h in self.hands) == before and not moved:
                    if self.rules.get("end_score"): return self.finish_scored(t)
                    return self.finish("deadlock", t)
                self.log("-- stall: everyone draws --")
                continue
            order = list(range(n)); self.rng.shuffle(order)
            for i in order:
                if intents[i] is None:
                    self.stuck[i] += 1
                    if self.rules["dump"] and self.hands[i] and self.stuck[i] >= self.rules["dump_after"] and len(self.pile) >= 2:
                        self.dump(i); self.stuck[i] = 0
                    continue
                if self.rng.random() > self.rules["speed"]: continue
                _, card, mv = intents[i]
                if self.apply(i, card, mv): self.stuck[i] = 0
                if self.rules.get("end_score") and not self.rules.get("play_to_end") and not self.hands[i]:
                    return self.finish_scored(t)
                if self.rules.get("play_to_end"):
                    continue
                if not self.hands[i] and not (self.rules.get("clean_out") and self.owns_unfinished(i)):
                    return self.finish("win", t, i)
        return self.finish("timeout", max_ticks)

    def open_cards(self, pi):
        n = 0
        for v in self.verbs:
            for d in DIRS:
                parts, c, term = self.arm(v, d)
                if parts and not term:
                    n += sum(1 for k in range(1, len(parts) + 1) if self.board[add(v, d, k)]["player"] == pi)
        return n

    def finish_scored(self, t):
        scores = [len(h) + self.open_cards(i) for i, h in enumerate(self.hands)]
        best = min(scores)
        w = [i for i, sc in enumerate(scores) if sc == best]
        winner = self.rng.choice(w)
        self.stats["score_win"] += 1
        self.stats["score_margin"] += sorted(scores)[1] - best if len(scores) > 1 else 0
        self.stats["score_best"] += best
        return self.finish("win", t, winner)

    def junk_card(self, pi):
        h = self.hands[pi]
        gl = {o for k, t in h if k == "M" for o in opts(t)}
        for k, t in h:
            if k == "V" and not any(g in gl for _, g in COMP_BY_VERB[t]): return (k, t)
        for k, t in h:
            if k == "P" and not any(t in ps and g in gl for _, ps, g in COMPOUNDS): return (k, t)
        for k, t in h:
            if k == "M" and not self.card_live(pi, (k, t)): return (k, t)
        return None

    def dump(self, i):
        h = self.hands[i]
        if self.rules.get("mpile"):
            pref = [c for c in h if c[0] == "V"] or [c for c in h if c[0] == "P"]
            if not pref: return
        else:
            pref = [c for c in h if c[0] == "M"] or [c for c in h if c[0] == "V"] or h
        c = self.rng.choice(pref); h.remove(c); self.pile.insert(0, c)
        h += [self.pile.pop(), self.pile.pop()]
        self.stats["dump"] += 1
        self.log(f"P{i} dumps {c[1]}, draws 2")

    def finish(self, how, t, winner=None):
        left = collections.Counter()
        for i, h in enumerate(self.hands):
            if i != winner:
                for k, _ in h: left[k] += 1
        unfinished = 0
        for v in self.verbs:
            for d in DIRS:
                parts, c, term = self.arm(v, d)
                if parts and not term: unfinished += 1
        onboard = {self.board[v]["tok"] for v in self.verbs}
        gl_reason = collections.Counter()
        for i, h in enumerate(self.hands):
            if i == winner: continue
            for k, g in h:
                if k != "M": continue
                verbs = {v for v, ps, gg in COMPOUNDS if gg in opts(g)}
                if not (verbs & onboard):
                    gl_reason["verb never on board"] += 1
                    continue
                self._slots = None
                sl = self.slots()[0]
                arm_ok = False; part_missing = True
                for v2, ps, gg in COMPOUNDS:
                    if gg not in opts(g): continue
                    for _, vt, d, parts, c in sl:
                        if vt == v2 and tuple(parts) == ps[:len(parts)]:
                            arm_ok = True
                if arm_ok:
                    gl_reason["open arm, particle never came"] += 1
                else:
                    gl_reason["no usable arm"] += 1
        self.stats["unfinished"] += unfinished
        self.stats["distinct_done"] += len(self.done)
        self.stats.update({"gl:" + k: n for k, n in gl_reason.items()})
        hs = sorted(len(h) for h in self.hands)
        self.stats["end_min_cards"] += hs[0]; self.stats["end_max_cards"] += hs[-1]
        xs = [p[0] for p in self.ever]; ys = [p[1] for p in self.ever]
        self.stats["footprint"] += (max(xs) - min(xs) + 1) * (max(ys) - min(ys) + 1)
        self.stats["peak_cards"] += getattr(self, "peak", 0)
        return dict(how=how, ticks=t, winner=winner, left=left, stats=self.stats,
                    bots=self.bots, hands=[list(h) for h in self.hands])


BASE = dict(starters=4, hand={2: 12, 3: 9, 4: 7}, speed=0.6, dump=False, dump_after=4,
            verb_attach="none")


def batch(name, n_games=400, n_players=2, bots=None, deck_kw=None, **over):
    rules = dict(BASE, **over)
    rng = random.Random(zlib.crc32(name.encode()))
    import time as _t
    res, slow = [], 0
    for _ in range(n_games):
        g = Game(n_players, rules, rng, bots or ["planner"] * n_players, deck_kw)
        t0 = _t.time(); r = g.run(); dt = _t.time() - t0
        if dt > 5: slow += 1
        res.append(r)
    hows = collections.Counter(r["how"] for r in res)
    wins = [r for r in res if r["how"] == "win"]
    left = collections.Counter()
    for r in res: left.update(r["left"])
    st = collections.Counter()
    for r in res: st.update(r["stats"])
    tot_left = sum(left.values()) or 1
    out = dict(
        name=name,
        win_pct=100 * hows["win"] / n_games,
        deadlock_pct=100 * hows["deadlock"] / n_games,
        median_ticks=statistics.median(r["ticks"] for r in res),
        stalls_per_game=st["stall"] / n_games,
        sniped_per_game=st["sniped"] / n_games,
        completed_per_game=st["completed"] / n_games,
        dumps_per_game=st["dump"] / n_games,
        payverbs_per_game=st["pay_verb"] / n_games,
        loser_cards_per_game=sum(left.values()) / n_games,
        timeouts=hows["timeout"], slow_games=slow,
        unfinished_lines_at_end=st["unfinished"] / n_games,
        stuck_gloss_reason={k[3:]: round(st[k] / n_games, 2) for k in st if k.startswith("gl:")},
        distinct_compounds_done=st["distinct_done"] / n_games,
        dead_lines_per_game=st["dead_lines"] / n_games,
        swaps_per_game=st["swaps"] / n_games,
        footprint_cells=st["footprint"] / n_games,
        peak_cards=st["peak_cards"] / n_games,
        river_noun_plays=st["river_nouns"] / n_games,
        captures=st["captures"] / n_games,
        combo_plays=st["combo_plays"] / n_games,
        combo_cards=st["combo_cards"] / n_games,
        score_best=st["score_best"] / n_games, score_margin=st["score_margin"] / n_games,
        noun_compounds_done=st["noun_completed"] / n_games,
        end_cards_best_worst=(round(st["end_min_cards"] / n_games, 1), round(st["end_max_cards"] / n_games, 1)),
        leftover_mix={k: round(100 * left[k] / tot_left) for k in "VPM"},
    )
    if bots and len(set(bots)) > 1:
        bw = collections.Counter(r["bots"][r["winner"]] for r in wins)
        out["winrate_by_bot"] = {b: round(100 * bw[b] / max(1, len(wins))) for b in set(bots)}
    return out


def fmt(o):
    lines = [f"\n== {o['name']} =="]
    for k, v in o.items():
        if k == "name": continue
        lines.append(f"  {k:22s} {v if not isinstance(v, float) else round(v, 2)}")
    return "\n".join(lines)


if __name__ == "__main__":
    print("deck size:", len(build_deck()), collections.Counter(k for k, _ in build_deck()))
    M = dict(verb_attach="both", dump=True, market=5)
    BEST = dict(n_games=200, dump=True, clean_out=True, orphan_kill=True, dead_return="clear",
                deck_kw=dict(verb_factor=1.0))
    import sys
    sets = {
     "fix": [
        lambda: batch("H market (baseline)", **M),
        lambda: batch("N H + open-line limit 1", open_limit=1, **M),
        lambda: batch("O H + dead lines return", dead_return=True, **M),
        lambda: batch("P H + limit 1 + dead return", open_limit=1, dead_return=True, **M),
        lambda: batch("Q P, planner vs spoiler", open_limit=1, dead_return=True, bots=["planner", "spoiler"], **M),
        lambda: batch("R P, 3 players", n_players=3, open_limit=1, dead_return=True, **M),
        lambda: batch("S P, 4 players", n_players=4, open_limit=1, dead_return=True, **M),
     ],
     "hand": [
        lambda: batch("F hand glosses, verbs x0.5", verb_attach="both", dump=True),
        lambda: batch("T hand glosses, verbs x0.75", verb_attach="both", dump=True, deck_kw=dict(verb_factor=0.75)),
        lambda: batch("U hand glosses, verbs x1.0", verb_attach="both", dump=True, deck_kw=dict(verb_factor=1.0)),
        lambda: batch("V U, meaning-attach only", verb_attach="meaning", dump=True, deck_kw=dict(verb_factor=1.0)),
        lambda: batch("W U, planner vs spoiler", verb_attach="both", dump=True, deck_kw=dict(verb_factor=1.0), bots=["planner","spoiler"]),
        lambda: batch("X U, 3 players", n_players=3, verb_attach="both", dump=True, deck_kw=dict(verb_factor=1.0)),
        lambda: batch("Y U, 4 players", n_players=4, verb_attach="both", dump=True, deck_kw=dict(verb_factor=1.0)),
     ],
     "clean": [
        lambda: batch("Z U + clean-out rule", n_games=250, verb_attach="both", dump=True, clean_out=True, deck_kw=dict(verb_factor=1.0)),
        lambda: batch("Z careful bots", n_games=250, verb_attach="both", dump=True, clean_out=True, deck_kw=dict(verb_factor=1.0), bots=["careful"]*2),
        lambda: batch("Z planner vs spoiler", n_games=250, verb_attach="both", dump=True, clean_out=True, deck_kw=dict(verb_factor=1.0), bots=["planner","spoiler"]),
        lambda: batch("Z 4p, hand 7", n_games=250, n_players=4, verb_attach="both", dump=True, clean_out=True, deck_kw=dict(verb_factor=1.0)),
        lambda: batch("Z 4p, hand 12, 2 decks", n_games=250, n_players=4, verb_attach="both", dump=True, clean_out=True,
              hand={2: 12, 3: 12, 4: 12}, deck_kw=dict(verb_factor=2.0, particle_extra=2.0, gloss_per_compound=2.0)),
     ],
     "orphan": [
        lambda: batch("AA clean-out + orphan lines cleared", n_games=200, verb_attach="both", dump=True, clean_out=True, orphan_kill=True, dead_return="clear", deck_kw=dict(verb_factor=1.0)),
        lambda: batch("AB clean-out + orphan lines back to hand", n_games=200, verb_attach="both", dump=True, clean_out=True, orphan_kill=True, dead_return="hand", deck_kw=dict(verb_factor=1.0)),
        lambda: batch("AC no clean-out, orphans cleared", n_games=200, verb_attach="both", dump=True, orphan_kill=True, dead_return="clear", deck_kw=dict(verb_factor=1.0)),
        lambda: batch("AD AA, 4p hand 7", n_games=200, n_players=4, verb_attach="both", dump=True, clean_out=True, orphan_kill=True, dead_return="clear", deck_kw=dict(verb_factor=1.0)),
     ],
     "tax": [
        lambda: batch("T0 free new groups", **BEST, verb_attach="pay", pay_cost=0),
        lambda: batch("T1 new groups cost 1", **BEST, verb_attach="pay", pay_cost=1),
        lambda: batch("T2 new groups cost 2", **BEST, verb_attach="pay", pay_cost=2),
        lambda: batch("T1+ cost 1, or attach to meaning (best)", **BEST, verb_attach="both", pay_cost=1),
        lambda: batch("T0+ free, or attach to meaning", **BEST, verb_attach="both", pay_cost=0),
     ],
     "mpile": [
        lambda: batch("MP0 best config (glosses in main deck)", **BEST, verb_attach="both"),
        lambda: batch("MP1 meaning pile, rummy swap", **BEST, verb_attach="both", mpile="rummy"),
        lambda: batch("MP2 meaning pile, river swap", **BEST, verb_attach="both", mpile="river"),
        lambda: batch("MP3 rummy, planner vs reader", **BEST, verb_attach="both", mpile="rummy", bots=["planner", "reader"]),
        lambda: batch("MP4 river, planner vs reader", **BEST, verb_attach="both", mpile="river", bots=["planner", "reader"]),
        lambda: batch("MP5 rummy, 4p", **BEST, n_players=4, verb_attach="both", mpile="rummy"),
     ],
     "particles": [
        lambda: batch("PX1.0 best config", **BEST, verb_attach="both"),
        lambda: batch("PX1.5 particles x1.5", n_games=200, dump=True, clean_out=True, orphan_kill=True, dead_return="clear",
                      verb_attach="both", deck_kw=dict(verb_factor=1.0, particle_extra=1.5)),
        lambda: batch("PX2.0 particles x2", n_games=200, dump=True, clean_out=True, orphan_kill=True, dead_return="clear",
                      verb_attach="both", deck_kw=dict(verb_factor=1.0, particle_extra=2.0)),
     ],
     "mpile2": [
        lambda: batch("MQ1 rummy, draw meaning if <2 held", **BEST, verb_attach="both", mpile="rummy", mpile_choice=2),
        lambda: batch("MQ2 river, draw meaning if <2 held", **BEST, verb_attach="both", mpile="river", mpile_choice=2),
        lambda: batch("MQ3 rummy, draw meaning if <3 held", **BEST, verb_attach="both", mpile="rummy", mpile_choice=3),
        lambda: batch("MQ4 rummy <2, planner vs reader", **dict(BEST, n_games=400), verb_attach="both", mpile="rummy", mpile_choice=2, bots=["planner", "reader"]),
        lambda: batch("MQ5 rummy <2, particles x1.5", n_games=200, dump=True, clean_out=True, orphan_kill=True, dead_return="clear",
                      verb_attach="both", mpile="rummy", mpile_choice=2, deck_kw=dict(verb_factor=1.0, particle_extra=1.5)),
     ],
     "deck": [
        lambda: batch("P verbs x0.5 (base)", open_limit=1, dead_return=True, **M),
        lambda: batch("P verbs x0.3", open_limit=1, dead_return=True, deck_kw=dict(verb_factor=0.3), **M),
        lambda: batch("P verbs x1.0", open_limit=1, dead_return=True, deck_kw=dict(verb_factor=1.0), **M),
        lambda: batch("P verbs x1.0 vs spoiler", open_limit=1, dead_return=True, deck_kw=dict(verb_factor=1.0), bots=["planner","spoiler"], **M),
        lambda: batch("P verbs x0.3 vs spoiler", open_limit=1, dead_return=True, deck_kw=dict(verb_factor=0.3), bots=["planner","spoiler"], **M),
        lambda: batch("P market 3", open_limit=1, dead_return=True, verb_attach="both", dump=True, market=3),
        lambda: batch("P market 8", open_limit=1, dead_return=True, verb_attach="both", dump=True, market=8),
     ],
    }
    for f in sets[sys.argv[1] if len(sys.argv) > 1 else "fix"]: print(fmt(f()), flush=True)
