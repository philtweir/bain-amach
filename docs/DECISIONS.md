# Decisions and open questions

Where the handoff documents disagree, the build follows the precedence in `handoff/CLAUDE.md`:
RULES.md, then deck.json, then handback-answers.md, then the design board, then design-handoff.md.
The design kit's `docs/handoff-v2.md` is newer than the build brief and calls itself the spec, so it
decides UI questions; rules questions still go to RULES.md. Each conflict below names what was built.
**Phil to confirm or overturn each one.** Every rules choice is a single constant or branch, so
changing one doesn't mean a rewrite.

## Rule changes (Phil, 2026-10-26)

Two rules beyond RULES.md, after playtesting showed hands running out of meaning cards. They're on
in every new game in the app (`APP_RULES` in `src/engine/types.ts`). Games saved before the change
keep the rules they started with. The engine default is still RULES.md as written, so the parity
and stats tests are unchanged.

1. **Refill.** If laying a line leaves you with no meaning cards, draw one from the meaning pile straight away.
2. **Lines onto a table meaning card.** A meaning card already on the table can end another line, as
   **any** of its three meanings (including the one already made there). The verb comes from your
   hand; the particles come from the river or wildcards, as usual; the line runs into a free side of
   the card, so at most three more lines can end on one card. A line can't both cross a particle and
   end on a table meaning card. The card gets the crossing marker. Tap any meaning card on the table
   to see all three of its meanings.

Still true, as Phil put it: only a verb goes down alone; every other play completes a line, using up to a
line's worth of cards (four for *cuir síos ar* [DESCRIBE]). The new play is still a complete line.

Simulated effect (300 games each, normal bots; RULES.md as written → with both changes):

| Players | Turns with no meaning card | Turns per game | Lines | Someone goes out |
|---|---|---|---|---|
| 2 | 27% → 0% | 57 → 37 | 26.4 → 26.2 | 60% → 79% |
| 3 | 33% → 2% | 74 → 51 | 32.6 → 35.5 | 31% → 72% |
| 4 | 29% → 4% | 74 → 51 | 32.3 → 34.4 | 36% → 81% |

Going out becomes the usual ending, where the design treated fewest cards as the norm. Table meanings
without the refill was too swingy (91–95% go out, fewer lines).

## Rules conflicts

| # | Question | RULES.md / handback | Design kit (handoff-v2) | Built |
|---|---|---|---|---|
| 1 | Wrong line, hidden answers, turn mode | Turn ends, **no draw** (§9, handback §2) | Draw 1, counts as a pass ("added in review, confirm") | No draw. Does count as a pass toward a stall (RULES says nothing on that). `wrongLine()` in `src/engine/game.ts` |
| 2 | When the game ends once both piles are empty | **Two stalls in a row** with no play (§8) | Stalls equal to the deepest river pile | Two stalls. `FINAL_STALLS` in `src/engine/game.ts` |
| 3 | What cancels Stuck in a race | **Touching any card or pile** (§5.2, handback §3) | Only starting a line; inspecting cards or using a screen reader doesn't | Any card or pile tap clears it. The screen-reader board list doesn't. `touch()` in `src/game/controller.ts` |
| 4 | Final-stall count after a line | "Two stalls in a row with no play between them" | — | The count resets after any line or lone verb. The reference engine never reset it; the parity test runs with `legacyStall` to match. |
| 5 | Which compound GIVE UP cards print | Either compound completes the card | — | deck.json doesn't say. The first three GIVE UP cards print *tabhair suas*, the next three *éirigh as* (`printedAnswer()` in `src/engine/deck.ts`). Either is accepted in play. |

## UI conflicts

| # | Question | Build brief (CLAUDE.md) | Design kit | Built |
|---|---|---|---|---|
| 6 | Placing a line | Ghost line, "Lay it" or tap the ghost; "Other spot" cycles | No placement step: the line lays itself at the best spot; long-press the last card to choose a spot (ringed preview, dashed outlines) | Design kit. The best spot is the one nearest where you're looking. |
| 7 | Hint timing | Hints on request | Off / on request / after 20 s | All three; "after 20 s" lights a verb after 20 s with no play |

## Numbers the brief left to the build (playtest these)

- **Bot difficulty.** Chance of spotting lines through a particle already down: easy 25%, normal 60%, hard 100%. Race reaction delay: easy 5.2–9 s, normal 3.2–6 s, hard 1.8–3.6 s, divided by the bot-speed setting (slow ×0.6, fast ×1.6). In `src/engine/bot.ts`.
- **Bot swaps.** Bots swap a meaning card for the face-up one when the face-up card would make a line now. The reference bot never swapped.
- **Stats with production rules** (300 seeded games, all hard bots; reference figures in brackets): 2 players 26.3 lines (28.2), 3 players 32.6 (31.9), 4 players 32.0 (31.3). Wildcard lines 3.6–3.7, crossing lines 1.4–2.3, no short deals, no unfinished games. The first-player edge is gone now that the first player is random (2p 52%, 3p 28%, 4p 25% of decided games). With the reference's rules switched on, the TypeScript engine plays the same games move for move (`engine.parity.test.ts`).

## Still open (Phil)

- **Name.** Wordmark, manifest name and splash are placeholders.
- **Irish UI strings.** `src/i18n/ga.json` holds only the strings fixed in the design. Everything else falls back to English. Open the app with `?ga-missing` to see the missing strings marked ⟨like this⟩. `missingIrish()` in `src/i18n/index.ts` lists their keys.
- **Compound list** (Ulster check). A new `handoff/data/deck.json` is all that's needed; nothing else hard-codes a card.
- **iOS status bar.** It uses `default` (opaque bar, dark text) so it stays readable on the light felt. `black-translucent` would let the felt run under the clock, but iOS then forces white text, which is unreadable on the light table. Worth checking on a device.
- **Sound** is a stub toggle (no audio in v1).
