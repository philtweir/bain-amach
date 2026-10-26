# Decisions and open questions

Where the handoff documents disagree, the build follows the precedence in `handoff/CLAUDE.md`:
RULES.md, then deck.json, then handback-answers.md, then the design board, then design-handoff.md.
The design kit's `docs/handoff-v2.md` is newer than the build brief and calls itself the spec, so it
decides UI questions; rules questions still go to RULES.md. Each conflict below names what was built.
**Phil to confirm or overturn each one.** Every rules choice is a single constant or branch, so
changing one doesn't mean a rewrite.

## Rule changes (Phil, 2026-10-26)

Rules beyond RULES.md from playtesting, numbered in the order they were agreed. They're on
in every game in the app (`APP_RULES` in `src/engine/types.ts`). A game saved before the change picks
them up when continued (it first kept its old rules, which made the app refuse a play it seemed to
offer; both rules only add options, so switching mid-game is safe). The engine default is still RULES.md as written, so the parity
and stats tests are unchanged.

1. **Refill.** If laying a line leaves you with no meaning cards, draw one from the meaning pile straight away.
2. **Lines onto a table meaning card.** A meaning card already on the table can end another line, as
   **any** of its three meanings (including the one already made there). The verb comes from your
   hand; the particles come from the river or wildcards, as usual; the line runs into a free side of
   the card, so at most three more lines can end on one card. A line can't both cross a particle and
   end on a table meaning card. The card gets the crossing marker. Tap any meaning card on the table
   to see all three of its meanings.
4. **A fresh line draws 2.** A line that uses no card already on the table (verb from the hand, no
   crossing, not onto a table meaning card) draws 2 afterwards, like a lone verb. Touching other cards
   doesn't count as using them. A fresh line that empties your hand still wins. Without this, about 40%
   of lines ignored the table; with it, about 6%. Each game makes about ten more compounds and runs
   about 25% longer, and every simulated game still finishes (2p 36 lines, 3p 45, 4p 44; someone goes
   out in 76% / 37% / 66%). A one-card draw was the softer option tested.
5. **Swap refresh.** Swapping puts your meaning card at the bottom of the meaning pile and turns the next
   card face up (RULES §4.4 put your card face up, so a second swap just handed it back). With answers
   shown, the face-up card lights when it would make a line for you now. Balance-neutral in simulation.
3. **New meaning cards pop up.** When another player puts a new meaning card down, it opens in full
   view (all three meanings) for about 2.5 s once their line lands; tap to dismiss. Several queue one
   after another. Not for your own cards, nor for lines ending on a card already down. In
   pass-and-play, cards laid while you looked away pop up when you tap "Show my hand".

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

| 8 | Spending wildcards | — | — | Never automatic. A line that can only be finished with a wildcard waits ("Use your wildcard?") until the player taps one; the tapped wildcard is the one spent. Bots are unaffected. (Phil, after playtesting) |
| 9 | Choosing a spot with a mouse | — | Long-press | Long-press is touch and pen only; with a mouse, right-click the last card does the same, so a slow click never switches into spot-choosing. |
| 10 | Bot opponents | "Bot B/C/D" | Characters proposal: one species per difficulty, five moods | Easy = Broc (badger), Normal = Corr (heron), Hard = Giorria (hare). Picking a difficulty picks the face, so setup keeps one Easy/Normal/Hard control and the face and name follow it. A second or third bot of one difficulty is "Óg" / "Mór" (Broc Óg); seat colour and pattern also tell them apart. Moods: thinking on its turn or mid-play, pleased after its line until the next play (and on winning), stuck after passing until the river turns, beaten at the end. Faces appear in the status strip, setup, line toasts, new-meaning pop-ups, the end card and the recap. The faces are the design's own, one SVG per species and mood in `src/ui/faces`, pulled from the characters sheet by `tools/faces/extract.py` (rerun it on a new export). Names and moods are derived, not saved, so older saved games show them too. |
| 11 | Three opponents on a phone | — | — | The status strip has no room for three avatars and the turn label, so below 480px the label is hidden visually (still announced) and the dot plus the avatar's turn ring show whose turn it is. |

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
- **Repeated species names.** A second or third bot of one difficulty is "Óg" / "Mór" (Broc Óg, Broc Mór). A stand-in until there are proper names.

## Draft meanings (in the app now, Phil to check)

The app deals from `data/deck.json`: the handoff deck plus 13 extra senses of existing compounds
(`c37` to `c49`, each marked `"draft": true` with a `check_note`) on 13 extra meaning cards (`m37` to
`m49`). `handoff/data/deck.json` stays as the original. Only existing verb + particle combinations got
new senses, so no verb or particle counts changed. Each new card has three senses from three different
verbs, and no card has two senses of one compound.

| Compound | Original | Draft addition |
|---|---|---|
| bain amach | REACH | ACHIEVE |
| bain as | GET FROM | CLEAR OFF |
| bain le | CONCERN | TOUCH |
| cuir amach | THROW UP | PUT OUT, PUBLISH |
| cuir ar | PUT ON | BOTHER |
| cuir isteach ar | APPLY FOR | INTERFERE WITH |
| tabhair faoi | ATTEMPT | ATTACK |
| tabhair ar | MAKE (SOMEONE) | CALL |
| éirigh as | GIVE UP | RESIGN |
| tit amach | HAPPEN | FALL OUT |
| lig do | LEAVE ALONE | ALLOW |
| amharc ar | LOOK AT | WATCH |

Home shows a note while any draft senses remain, and the glossary marks them "Draft" with a filter.
To accept one, drop its `draft` flag; to change or remove one, edit the row and its meaning cards.

Effect with all app rules (300 games, normal bots): no-meaning turns 0–1%; lines 38.5 / 48.4 / 47.1
(about a quarter use draft senses); 55 / 73 / 73 turns; someone goes out in 59% / 18% / 27%, so fewest
cards is the usual ending again at 3–4 players. The tutorial moved to seed 912 (same opening hand
as the design render). The stats test now compares against the reference engine run on this deck.

## Deck depth (Phil, open)

Each of the 36 compounds has exactly one meaning, and no verb + particles appears twice. Many phrasal
verbs have several senses, and playtesting found too little variety on the meaning cards. The data
format already supports more: add a row to the card list with the same verb and particles, a new
`id` and a new `meaning`, and put that meaning on meaning cards. The engine, the line builder,
hidden-answers judging, the glossary (one row per sense) and the recap need no changes.
The counts to keep in step are the meaning cards (three meanings each) and, if new verbs come in, the verb counts.
