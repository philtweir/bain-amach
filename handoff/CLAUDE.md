# CLAUDE.md: build brief for Bain Amach (working title)

An installable, offline web app: a fast card game for practising Ulster Irish compound verbs (*bain amach*, *cuir suas le*). Players build lines on a shared grid (verb, then particles taken from a face-up river, then an English meaning card) and race to empty their hands.

## Read first, in this order

1. `spec/RULES.md`: the canonical rules. **The source of truth for behaviour.**
2. `data/deck.json`: every card, count and setup number. Never hard-code these.
3. `design/bain-amach-design.html`: the design board. Open it in a browser. Section 01 is a working table prototype; section 03 has every screen. The visual and interaction reference.
4. `design/tokens.css`: colour and font tokens taken from the board.
5. `spec/handback-answers.md`: decisions on points the designer raised (deal, hidden mode, stalls, settings).
6. `spec/design-handoff.md`: the original design brief: screen list, table zones, accessibility, PWA requirements. Read it for those; its deal numbers are out of date.
7. `reference/engine/engine.js` + `engine.test.js`: a plain-JS reference engine whose behaviour (and test stats) the TypeScript port must match.
8. `reference/simulator/`: the Python research simulator. Background only; don't port it.

**Precedence when documents disagree:** RULES.md, then deck.json, then handback-answers.md, then the design board, then design-handoff.md. If something is still unclear, ask Phil rather than guess. Rules questions are his to decide.

## v1 scope

**In:**
- Solo against 1–3 bots, in race mode or turn mode.
- Pass-and-play for 2–4 humans (turn mode only), with a hand-over screen that hides the hand until the next player taps.
- Answers shown / answers hidden, and optional hints (RULES §9).
- Screens: language choice + welcome (first launch), scripted tutorial, home (with Continue), game setup, game table, pause menu, recap, glossary, rules, settings.
- Settings: language, answers default, hints default, sound (stub, no audio in v1), haptics, reduced motion, race bot speed, replay tutorial, reset progress, credits.
- Offline PWA: manifest, icons, service worker, install nudge after the first finished game, iOS add-to-home-screen explainer, "new version ready" banner (never mid-game).
- Local persistence: settings, glossary progress (times made, last seen per compound), one saved game.

**Out of v1:** online multiplayer, accounts, any server, audio, example sentences in the glossary (leave room in the layout), new card sets (the data format should allow them).

## Stack

- **Vite + TypeScript**, strict mode. UI layer of your choice; keep it light (Preact or plain TS components). The table is one custom canvas/DOM board, not a component-library job.
- **`vite-plugin-pwa`** (Workbox) for the service worker and manifest; precache everything, including **self-hosted fonts** (Bricolage Grotesque, Atkinson Hyperlegible; both OFL). The design board loads them from Google Fonts; the app must not.
- **Vitest** for engine tests, **Playwright** for a few end-to-end flows.
- **localStorage** (wrapped, try/catch, versioned schema) is enough; IndexedDB only if the save outgrows it.
- No runtime dependencies beyond the UI layer and the PWA plugin without a reason.
- Put platform calls (haptics, storage, share, wake lock) behind a small `src/platform/` interface, with the web implementation only. That keeps a later native wrapper (Tauri 2 or Capacitor, for app stores and iOS haptics) a swap-in rather than a rewrite. No wrapper in v1.

## Architecture

```
src/
  engine/     pure TS, no DOM, no timers: state, legal moves, apply, bots
  game/       controllers: turn loop, race loop (timers, bot reaction delays), pass-and-play
  ui/         table, hand tray, river, line builder, screens
  i18n/       ga.json, en.json (Irish default)
  storage/    settings, progress, saved game
data/deck.json  (imported at build time)
```

**Engine rules of thumb:**
- State is a plain serialisable object (no Maps/class instances in saved state), so save/restore and replay are `JSON.stringify` away.
- Every game has a seed; all randomness goes through the seeded RNG (the reference uses mulberry32). Same seed, same moves → same game.
- `legalMoves(state, player)` is the only source of highlights. The UI never works out rules itself.
- `apply(state, move)` re-checks legality against the current state and returns either the new state or a typed rejection (`Taken`, `WrongLine`, `NotLegal`). That one function is how race-mode commits and hidden-mode attempts are resolved.
- Keep an event log of every play, pass, stall, bury and draw: it drives the recap, the replay view, glossary progress and screen-reader announcements.

### What the reference engine doesn't do yet (you add it)

- **All placements.** The reference trims hand-verb spots to the 4 best for the bots. The line builder needs every legal spot (for "Other spot" cycling and tapping a cell). Enumerate lazily if needed.
- **Swap** as a bot move (the reference bot never swaps) and as a player move.
- **Race mode:** simultaneous play, commit-time validation → `Taken`; the "Stuck" toggle; stall when all humans are Stuck and no bot can play; bot reaction delays by difficulty.
- **Hidden mode:** `validateAttempt(meaningCard, verb, particleSources, placement)` → accept, or reject with the turn lost (turn mode) / 3-second lockout from laying lines (race mode).
- **Hints:** light one usable verb for the selected meaning card.
- **Random first player.** The reference always starts with player 0, which is part of why the test shows a first-player edge.
- **Missed plays for the recap:** when a human passes or goes Stuck while holding a legal line, record up to 3 to show on the recap.
- **Bot difficulty:** reaction delay (race) and the probability of spotting straddles (lines through a particle already down).

## Line builder (the core interaction)

Tap-first, as on the design board, section 01:
1. Tap a meaning card → light up (gorse) every verb on the table or in hand that completes one of its three meanings, plus particles a line could pass through.
2. Tap a verb → show the line as a ghost; the river tops it needs pulse; wildcards are offered for any missing particle.
3. "Lay it" or tap the ghost; "Other spot" cycles placements. Skip this step when only one placement exists.

Order is flexible (starting from a verb or a river top works too). A tapped verb with no meaning selected offers "Lay alone (draw 2)". Swap = select a hand meaning card, tap the face-up one. Gorse yellow means "usable now" and nothing else. Every completed line is announced Irish first, meaning beneath. In answers-hidden mode there is no highlighting: the player picks the cards and the engine judges on commit.

## Non-negotiables

- **No information by colour alone.** Card types also have an icon/shape; players have initials (and patterns for 3–4 players); a particle's axis is shown by the stripe's shape. Players 3 and 4 need colours: `tokens.css` only defines two.
- Touch targets ≥ 44 pt in hand and river; table taps snap to the nearest valid target; pinch-zoom/pan, double-tap to fit, auto-follow the latest play without fighting the user.
- Screen-reader labels for every card and an announcement for every play (examples in design-handoff.md → Accessibility).
- Reduced motion: fades instead of flights and riffles. Nothing communicated only by animation.
- Safe areas, light/dark, text-size scaling. Phone portrait first; tablet landscape for table, setup and recap.
- Haptics are a bonus: Android only via `navigator.vibrate`; iOS web has none. Never rely on them.
- **Bilingual UI** with Irish as the default. Phil supplies or vets the Irish strings: ship English plus clearly marked placeholders in `ga.json`, and leave room for longer Irish text.
- Deck changes are data changes. The 36 compounds are still awaiting Phil's Ulster check; expect `deck.json` to change.

## Milestones and acceptance

1. **Engine port.** TS engine + Vitest port of `engine.test.js`. Over 300 seeded bot games per player count, match the reference within noise: no short deals, no unfinished games, about 28 lines/game (2p), 32 (3p), 31 (4p); wildcard lines about 3.7–3.8; straddles about 1.4–2.0. Plus unit tests for every case in RULES §10. Determinism test: same seed + same moves → identical state.
2. **Playable table, turn mode, vs 1 bot.** Line builder, lone verb, swap, draw and pass, bury, end and recap. Matches design board section 01.
3. **Race mode** with 1–3 bots, Stuck, Taken, stall; bot speed setting.
4. **Hidden mode + hints; pass-and-play** with hand-over.
5. **Shell:** first launch, tutorial (scripted seed), home/continue, setup, pause, glossary, rules, settings, persistence.
6. **PWA + polish:** offline (test in airplane mode), install flow, update banner, icons/splash (blocked on the name), accessibility pass (axe + VoiceOver/TalkBack spot checks), Lighthouse PWA checks passing.

Playwright: a full turn-mode game vs a bot to the recap with a fixed seed; reload mid-game → Continue restores the exact state; offline reload works.

## Open items (ask Phil; don't decide)

- **Name** (Irish and English). "Bain amach" is a working title; icon and splash wait on it.
- **Compound list** Ulster check; any changes arrive as a new `deck.json`.
- **Irish UI strings.**
- **First-player edge** at 3–4 players (43% vs a fair 33%; 34% vs 25%, in reference bot games that always start with player 0). Random first player is in RULES; whether more is needed is a playtest question.
- **Hidden-mode pacing** and whether the 3-second race lockout feels right: playtest.
