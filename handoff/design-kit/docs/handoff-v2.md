# Compound verb game: design handoff v2

Oct 25, 2026 · @Phil

This handoff specifies the full UI of an installable web app for a fast card game that drills Ulster Irish compound verbs (*bain amach*, *cuir suas le*). The rules are final; the design must make each one obvious without a manual, and keep the Irish front and centre. It replaces v1 and folds in every answer from the design handback.

**In scope for v1:** solo play against 1–3 bots in race or turn mode; pass-and-play on one device in turn mode; an interactive first-game tutorial; a glossary with progress; rules, settings, and a post-game recap.

**Out of scope for v1** (design so they can slot in later): online multiplayer, accounts and leaderboards, an in-app deck editor, audio.

**What changed since v1**

| Area | v1 | v2 |
| --- | --- | --- |
| Deck | 104 cards for any player count | 104 for 2 players; a 14-card verb pack (36 verbs) for 3–4 |
| Hands | 12 / 12 / 10, untested for 3–4 | 12 / 12 / 10, re-simulated with honest deals |
| Empty hand deck | Not specified | Draw from the meaning pile; no lone verbs once both piles are empty |
| Hidden answers | Display choice only; highlights still on | No highlights until a line is committed; wrong lines cost a draw |
| Passing and stalls | Engine-detected | Players declare: "Draw and pass" (turns) or "Stuck" (race) |
| Game end | Going out, or fewest cards | Fewest cards is the common ending and gets first-class design |
| Wildcards | Unclear whether coverable | Permanent once laid |
| Physical deck | Open | Shares this visual system |

## The game

Players build compound verbs as lines of cards on a shared table; the first to empty their hand wins. Every rule here is final.

**The deck**

| Card | 2 players | 3–4 players | Where it lives |
| --- | --- | --- | --- |
| Verb (*cuir*, *bain*, *tabhair*…) | 22 | 36 (adds the 14-card verb pack, one verb per compound) | Hand deck; 4 start on the table |
| Particle: adverb (*amach*, *suas*…) or preposition (*ar*, *le*…) | 42 | 42 | The river: 5 face-up piles, never in hands |
| Meaning card: three English meanings, each with its Irish answer | 36 | 36 | Meaning pile, top card face up; 3 in each hand |
| Wildcard: stands in for any particle | 4 | 4 | Hand deck |
| **Total** | **104** | **118** |  |

There are 36 compounds, each printed on exactly three meaning cards. GIVE UP is shared by *tabhair suas* and *éirigh as*, so 35 English meanings appear in all. A line that matches a meaning with any compound for it is correct, whichever answer the card prints.

**Setup:** take 4 verbs from the verb cards and lay them on the table. Deal each player 3 meaning cards, then fill hands from the hand deck to 12 cards (2–3 players) or 10 (4 players).

**A play is exactly one of:**

1. **A lone verb.** Lay one verb on the table, then draw 2. Not allowed once the hand deck and meaning pile are both empty.
2. **A full line.** A meaning card from your hand, a verb (on the table or from your hand), and every particle the compound needs, from the river pile tops. A wildcard can stand in for any particle. Two-particle compounds go down whole, in one play.
3. **A line through a particle already down.** Your verb on one side of an existing particle, your meaning on the other.
4. **Swap** a meaning card from your hand for the face-up one.

**Drawing:** from the hand deck; when it is empty, from the meaning pile; when both are empty, draws are skipped.

**Wildcards** are permanent once laid.

**Stall:** when every player is stuck, everyone draws 1 (from the meaning pile if they hold fewer than 2 meanings), and each river pile moves its top card to the bottom.

**Winning:** the first to empty their hand wins. Once both draw piles are empty, the game also ends after a run of stalls with no line laid, long enough for every river card to have surfaced (as many stalls as the deepest pile holds). Then the fewest cards wins; ties share the win.

**Two modes, same rules:**

- **Race:** everyone plays at once. A player taps "Stuck" when they can't play; a stall happens when every human is stuck and no bot can play.
- **Turns:** one play per turn, or "Draw and pass", which is always allowed. A full round of passes is a stall.

**Simulated results, honest deals, 300 games each** (players knowing every compound; hidden-answer play will run longer):

| Players | Verbs | Hand | Hand deck after deal | Lines per game | Someone goes out |
| --- | --- | --- | --- | --- | --- |
| 2 | 22 | 12 | 4 | 24.5 | 37% |
| 3 | 36 | 12 | 9 | 31.6 | 43% |
| 4 | 36 | 10 | 8 | 30.8 | 48% |

Most games end on fewest cards, not by going out. Design that ending as the normal case.

## Players, modes and settings

One app serves teenagers learning and fluent speakers playing to unwind, so the default is calm: turns, gentle bots, answers shown, no clock. Race and hidden answers are one setting away for players who want speed.

| Who | Typical setup | What they need from the UI |
| --- | --- | --- |
| Learner, alone | Solo, turns, 1 easy bot, answers shown | Time to scan; hints; every compound read back on screen in Irish and English |
| Fluent player, alone | Solo, turns, 1–2 normal bots, answers hidden; race when they want it | One-tap plays, no confirmation dialogs, instant feedback |
| Two at one table | Pass-and-play, turns | A hand-over screen that hides the last player's hand |
| Classroom or family | Pass-and-play, 3–4 players, tablet | Readable at arm's length; large player colours |

**Chosen on the setup screen**

- Mode: race or turns. Pass-and-play is turns only.
- Opponents: 1–3 bots, each easy, normal or hard. Hard bots react faster in race and spot lines through existing particles.
- Answers on meaning cards: shown, or hidden until a line is laid. Hidden also turns off line highlighting (see Interactions).
- Hints: off, on request, or automatic after 20 seconds without a play.

The 3–4 player verb pack is added automatically; setup shows the deck size so players with a printed deck know which to use.

## Card anatomy

Five card types, each recognisable by shape and icon as well as colour, at three sizes: hand 76px, river 60px, table 64px at 100% zoom. The same faces print on the physical deck.

| Card | Face | Distinguishing marks |
| --- | --- | --- |
| Verb | The verb on all four sides | Gorse; four square notches, as lines leave it in any direction |
| Adverb | *amach*, *isteach*, *suas*, *síos* on all four sides | Deep heather; two square notches on the ends of its line |
| Preposition | *ar*, *le*, *do*, *as*, *de*, *faoi*, *ó* on all four sides | Pale heather; two round notches on the ends of its line, so it differs from adverbs in lightness and notch shape, not hue alone |
| Meaning card | Three English meanings, each with its Irish answer below | In hand: a wide card (200 × 116) showing all three at full size, answers shown or hidden per setting. On the table: only the meaning used; any rotation |
| Wildcard | A placeholder mark, no word; dashed edge | Two square notches and a dashed border; on the table it shows the particle it stands for |

**Notches:** every card shows where lines join it: four notches on a verb, two on the ends of a particle’s or wildcard’s line. A vertical line turns the notches; the word stays upright. A particle shared by two crossing lines shows a crossing marker (a token in print).

**Ownership:** a small player-colour marker on each card placed, used only by the recap.

**Fadas:** *síos*, *ó*, *éirigh*, *éist*, *fág* must render cleanly at table size. Test the typeface at the smallest size.

**Longest text:** meaning cards must fit the longest current answers (*fan amach ó*, *cuir isteach ar*) with room for one more line, because the Ulster check may lengthen some.

## Screens

Everything returns to Home through the recap; the game table is the only screen used for minutes at a time. The screen flow is drawn on the design board.

| Screen | States to design |
| --- | --- |
| Choose language, Welcome | First launch only; language changes later in Settings |
| Tutorial game | Scripted game against one bot, with prompts pointing at the river, a meaning card and a verb; skippable; replayable from Rules and Settings |
| Home | First visit; saved game waiting (Continue is primary); returning player; install nudge after the first finished game |
| Game setup | Solo or pass-and-play; race or turns (race disabled for pass-and-play); bots and difficulty; answers shown or hidden; hints; deck size shown |
| Game table | See The game table and Interactions |
| Hand-over | Pass-and-play only: "Pass to Siobhán", hand hidden until she taps |
| Pause menu | Resume, rules, settings, restart, quit (with a save) |
| Recap | Result (went out, or fewest cards); card counts; every compound made with its meaning; up to three lines you could have made; "hints used" mark; play again; replay this game |
| Glossary | 36 compounds grouped by verb; times made and when last seen; room for one example sentence, empty in v1; empty state before any compound is made |
| Rules | Full screen reference; replay tutorial |
| Settings | Language; default answers shown or hidden; default hints; sound; haptics; reduced motion (follow system, or always on); bot speed in race; replay tutorial; reset glossary progress; credits |

Irish strings often run longer than English. Every text slot needs room for that; Phil supplies the Irish.

## The game table

The table screen takes 95% of play time. A typical game ends with 60–110 cards on a grid about 14 × 16 cards, so the board pans and zooms, and opens on the area around the latest play with 64px cards.

**Phone portrait (primary), top to bottom**

1. **Status strip:** opponents as avatars with hand counts, turn indicator or race clock, pause.
2. **River:** five piles in a row, each showing its top particle and cards left. Scannable in under a second.
3. **Board:** pan, pinch-zoom, double-tap to fit. Follows the latest play without fighting the user's own panning.
4. **Meaning pile and hand deck:** the face-up pile sits at the start of the hand tray’s meanings lane, next to the cards it swaps with, with its count.
5. **Hand tray:** verbs, meaning cards and wildcards, scrollable. Holds the action bar: Lay it, Lay alone, Draw and pass (turns) or Stuck (race).

**Tablet landscape:** board centre, river down one side, hand along the bottom, opponents along the top. For pass-and-play, the hand tray changes owner while board and river stay put.

**Always visible:** your card count, every opponent's count, river tops, the face-up meaning, both pile counts.

## Interactions and feedback

A full line is up to five cards from hand, river and table, so the core interaction is a tap-first line builder. Drag is an alternative, never the only way.

**Line builder, answers shown**

1. Tap a meaning card in your hand. It lifts, and every way to complete one of its meanings lights up: table verbs with a free arm, hand verbs, matching river tops, existing particles a line could pass through.
2. Tap a verb. If the line is now complete, it lays itself. If the verb fits two meanings on the card, the tray shows both and one tap on a lit particle or the wildcard settles it.
3. No placement step by default: the line lays itself at the best spot. Long-press the last card instead to choose the spot yourself from a ringed preview and dashed outlines.

Starting from a verb or a river particle works too. Every line the player lays gets the line-made moment (640ms): the compound large in Irish over the board, gorse rays behind, then it settles into the toast. The first time a player ever makes a compound it is marked New with the glossary count; that is the game’s only progression, with no points or streaks. Any tap dismisses it. Bots get the toast only.

**Line builder, answers hidden**

Nothing lights up. You select the meaning card, verb, particles and spot yourself; a line preview fills in as you go; "Lay it" commits. The app checks the line only then.

**A wrong line** (hidden mode)

- Refused with a soft “Not quite” toast in ink, never red, and a one-line reason. Two kinds: a compound that doesn't exist ("*cuir* doesn't take *faoi*") and a real compound not on this card ("*cuir suas le* isn't on this card").
- Your hand cards return to your hand; river particles return to the top of their pile; table cards stay.
- **Turns:** costs the same as passing: draw 1, turn ends, counts as a pass toward a stall.
- **Race:** a 3-second lockout on laying another line, shown as a draining ring on the hand tray.

**Hints:** a hint lights one usable verb for the selected meaning card, nothing else. A game won with hints shows a "hints used" mark on the recap.

**Passing and Stuck**

- Turns: "Draw and pass" is always available, even with a legal play. The draw is the cost.
- Race: "Stuck" toggles on. It is cancelled only by starting a line (selecting a hand card), not by tapping table cards to inspect them or exploring the board with a screen reader.
- The app never reveals a missed play during the game, except as a requested hint.

**Other plays:** lone verb (tap a verb, tap "Lay alone", see the draw-2 cost on the button); swap (tap a hand meaning card, tap the face-up one).

**Feedback states to design**

- Impossible play: short shake and a one-line reason ("No *suas* in the river").
- Race collision: the lit target fades with a "Taken" flash and the builder resets.
- Stall: the river visibly rotates; drawn cards fly to hands.
- Bot play: the line draws in at a pace the eye can follow; the bot's avatar pulses.
- Empty piles: counters read 0; "Lay alone" disabled with a reason once both piles are empty.
- Final stalls: once both piles are empty, a quiet counter shows stalls left before the game ends on fewest cards.
- Game end: going out, or fewest cards (the common case), or a shared win.

**Motion and haptics:** quick and physical, never slow enough to cost a race. Haptics are a bonus only; iOS Safari has no web vibration, so nothing may depend on them. All motion respects reduced motion.

## Visual direction, accessibility and language

A modern card game with real tactility, rooted in the north of Ireland without tourist symbolism. The tokens, type and card components are defined in the design system that accompanies this handoff.

- **Tone:** playful and quick, confident rather than cute. The Irish is the hero; English supports it.
- **Palette:** a mid-tone sea-green baize with a soft felt grain and a lamp-pool glow; gorse verbs, deep and pale heather particles, paper meaning cards. The colours of the hills, reading in light and dark.
- **Cards:** big, chunky square tiles with physical presence: rounded corners, 4px of thickness, notches where lines join, a lift when selected. Buttons share the same edge. Fun, but quick and calm; never a slot machine. Nothing read during play is under 14px.
- **Type:** a face with excellent fada support for card words; a plain, legible face for UI and English.
- **Avoid:** shamrocks, harps, knotwork, green-white-orange, pseudo-uncial lettering.

**Accessibility**

- Bilingual UI from day one, Irish default, switchable on first launch and in Settings.
- No information by colour alone: card type also by lightness and notch shape; players also by initial and pattern.
- Touch targets at least 44 × 44 pt in hand tray and river; table taps snap to the nearest valid target; zoom always available.
- Screen readers: every card has a spoken label; every play is announced; the board can be explored line by line without cancelling "Stuck".
- Reduced motion: fades replace flights and riffles; nothing is carried only by animation.
- Race mode is timing-dependent and says so; turn mode is an equal, not a fallback.

## Installable web app requirements

The app installs to a home screen and runs full screen and offline, with no browser chrome.

- **Offline first:** every mode runs with no connection; bots and rules run on the device; no spinners in play.
- **Install:** web app manifest; icons in all sizes including maskable and monochrome; splash screens; theme and background colours for light and dark.
- **Install prompt:** a friendly nudge after the first finished game, never on first launch; an "Add to home screen" explainer for iOS.
- **Safe areas:** nothing interactive under notches, the home indicator or rounded corners.
- **Orientation:** phone portrait primary; tablets both; phone landscape works.
- **System integration:** follows light and dark, text size and reduced motion.
- **Updates:** a quiet "New version ready, restart" banner, never mid-game.

## Implementation notes

The app ports the Python simulator's rules and bots to TypeScript; the designs only need to fit this model.

- **Board model:** a grid of cells; each card has position, type, word, line axis (particles and wildcards) and the player who laid it. Verbs are hubs.
- **Legal-move engine:** lists every legal play for the current hand, river and board. Shown-answers highlights come straight from it. In hidden mode it is used only to check a committed line and to drive bots and hints.
- **Meaning matching:** a line is correct if its compound has the meaning, not only if it matches the printed answer (GIVE UP accepts *tabhair suas* and *éirigh as*).
- **Stalls:** players declare; the engine never overrules a declared pass or Stuck.
- **End of game:** once both draw piles are empty, count consecutive stalls with no line; end when the count reaches the deepest river pile's size.
- **Bots:** the simulator's planner bots; difficulty by reaction delay (race) and how often they spot lines through existing particles.
- **Seeded shuffles:** every game has a seed; the recap offers "Replay this game".
- **Deck as data:** compounds, meaning triplets, copy counts and the verb pack load from JSON generated from the card-list spreadsheet.
- **Stack:** any web framework, a service worker for offline, local storage for settings, glossary progress and a saved game. No server in v1.

## Deliverables and open questions

The build works from the design board and design system; annotations there describe behaviour as well as appearance.

- [ ] Screens from the table above, phone portrait; tablet landscape for game table, setup and recap
- [ ] Game table states: opening deal, dense mid-game board, line builder at each step (both answer modes), wrong line, stall, race collision, bot play, Stuck, empty piles, final stalls, hand-over, game end (went out, fewest cards)
- [ ] Components with every state: five card types at three sizes, river pile, hand tray and action bar, meaning card expanded and collapsed, avatar with count, buttons, toasts, dialogs
- [ ] Design tokens: colours (light and dark, five card families, four player colours), type scale, spacing, radii, elevation, motion
- [ ] Motion notes: line placement, river take, stall rotation, bot play, win
- [ ] App icon and splash, with a swappable wordmark
- [ ] Empty and error states: no saved game, empty glossary, update available
- [ ] Copy: every string in English, room for the Irish

**Open, with Phil**

- [ ] Name, in Irish and English. "Bain amach" is a working title; the wordmark is a placeholder until then.
- [ ] Ulster check of the compound list.

**Added in review, confirm**

- [ ] A wrong line in turn mode costs a draw and counts as a pass
- [ ] GIVE UP accepts either compound
- [ ] End trigger once both piles are empty: stalls equal to the deepest river pile, no line laid
- [ ] Ties on fewest cards share the win
- [ ] "Stuck" is cancelled only by starting a line
