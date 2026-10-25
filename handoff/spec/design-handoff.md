# Compound verb game: design handoff

Oct 25, 2026 · @Phil

> **Superseded in part.** This was the brief for the visual design. Where it disagrees with `RULES.md` (deal sizes, deck size, the 3–4 player verb pack, stall wording), `RULES.md` and `handback-answers.md` win.

## Purpose and scope

Design the complete UI flow for an installable web app version of a fast card game that drills Ulster Irish compound verbs (*bain amach*, *cuir suas le*). Claude will build it as a PWA from your designs, so every screen, component and state needs to be specified, not just the happy path.

The game is already designed and balanced: its rules came out of thousands of simulated games and are fixed (next section). Your job is to make it feel slick, native and fun on a phone, while keeping the Irish front and centre.

**In scope for v1**

- Solo play against 1–3 bots, in race or turn mode
- Pass-and-play on one device, in turn mode
- An interactive first-game tutorial
- A glossary of the compounds, with progress
- Rules reference, settings, and a post-game recap of the compounds made

**Out of scope for v1** (design so they can slot in later)

- Online multiplayer across devices
- Accounts, sync and leaderboards
- An in-app deck editor (the deck ships as a data file; Phil edits it outside the app)

## The game in one page

Players build compound verbs as lines of cards on a shared table, and the first to empty their hand wins. Every rule below is final; the UI must make each one obvious without a manual.

**The deck (104 cards)**

| Card | Count | Where it lives |
| --- | --- | --- |
| Verb (*cuir*, *bain*, *tabhair*…) | 22 | Players' hands |
| Particle: adverb (*amach*, *suas*…) or preposition (*ar*, *le*…) | 42 | The river: 5 face-up piles, never in hands |
| Meaning card: three English meanings, each with its Irish answer printed | 36 | Meaning pile, top card face up; 3 dealt to each hand |
| Wildcard: stands in for any particle | 4 | Shuffled into the hand deck |

**Setup:** 4 starter verbs on the table. Hands of 12 cards for 2–3 players, 10 for 4.

**A play is exactly one of:**

1. **A lone verb.** Put one verb on the table; you then draw 2 cards.
2. **A full line.** A meaning card from your hand, a verb (already on the table, or from your hand), and every particle the compound needs, taken from the river pile tops. A wildcard can stand in for any particle. Two-particle compounds (*cuir suas le*) go down whole, in one play.
3. **A line through a particle already down.** Your verb on one side of an existing particle, your meaning on the other. It's still a full line.
4. **Swap** a meaning card from your hand for the face-up one.

**Reading the table.** All cards are square and share one grid. Every line runs straight from a verb to a meaning card. Particles and wildcards carry a two-ended axis stripe along their line, so a meaning's line is the particle whose stripe points into it. Lines can sit side by side without any adjacency rules; only a line laid through an existing particle crosses a stripe, and that particle gets a crossing marker.

**Stall:** when nobody can play, everyone draws 1 card (from the meaning pile if they hold fewer than 2 meanings), and every river pile moves its top card to the bottom.

**Winning:** first to empty their hand. If nothing more can be played, fewest cards wins.

**Two modes, same rules:**

- **Race:** everyone plays at once, as fast as they can.
- **Turns:** one play per turn. Can't play? Draw 1 and pass. A full round of passes triggers the river bury.

## Players and modes

Two audiences share one app: learners who need time and help, and fluent speakers who want a fast, competitive game. Settings, not separate apps, bridge them.

| Who | Typical setup | What they need from the UI |
| --- | --- | --- |
| Learner, alone | Solo, turns, 1 easy bot, answers shown | Time to scan; hints; every completed compound read back in Irish and English |
| Fluent player, alone | Solo, race, 2–3 hard bots, answers hidden | Speed: one-tap plays, no confirmation dialogs, instant feedback |
| Two at one table | Pass-and-play, turns | A clear hand-over screen that hides the last player's hand |
| Classroom or family | Pass-and-play, 3–4 players | Readable from arm's length on a tablet; large player colours |

**Settings that change the game, chosen on the setup screen**

- Mode: race or turns
- Opponents: 1–3 bots, each easy, normal or hard (hard bots react faster in race mode and spot lines through existing particles)
- Answers on meaning cards: shown (learner) or hidden until a line is completed (fluent). Hidden answers are a display choice; the rules don't change.
- Hints: off, on request, or automatic after 20 seconds without a play

Pass-and-play is turns only. Race needs one screen per player, which is online play (v2).

## Card anatomy

Five card types, each recognisable at a glance by shape and icon as well as colour. Cards appear at three sizes: in the hand (largest), in the river, and on the table (smallest, packed tight).

| Card | Face | Distinguishing marks |
| --- | --- | --- |
| Verb | The verb on all four sides (*tabhair*) | Hub card: lines leave it in any direction, so it has no stripe |
| Adverb | *amach*, *isteach*, *suas*, *síos* on all four sides | Two-ended axis stripe along its line; adverb style distinct from prepositions |
| Preposition | *ar*, *le*, *do*, *as*, *de*, *faoi*, *ó* on all four sides | Two-ended axis stripe; preposition style |
| Meaning card | Three English meanings, each with its Irish answer under it (DESCRIBE / *cuir síos ar*) | A larger square. In hand: all three, answers shown or hidden per setting. On the table: only the meaning used, the other two collapsed; any rotation |
| Wildcard | A placeholder mark, no word | Axis stripe like a particle; clearly "not a real particle"; tapping it shows which particle it stands for |

**Shape and axis:** cards are square so a particle can turn to lie along a horizontal or vertical line without breaking the grid. Each particle and wildcard shows a two-ended stripe along its line, like a road through a tile. A meaning's line is the particle whose stripe points into it; a verb's lines are the particles whose stripes point into it. **Straddles** are the one exception: a particle shared by two crossing lines shows a crossing marker (in print, a small token placed on it).

**Ownership:** a small player-colour marker on each card placed, for the recap only. No rule depends on who laid what.

**The fada problem:** *síos*, *ó*, *éirigh*, *éist* and *fág* must render cleanly at every size, including the smallest table cards. Choose type with that tested, not assumed.

## Screen flow

&#91;embedded content: screen flow · 9 screens, one main loop\]

Everything returns to Home through the recap, and the game table is the only screen used for minutes at a time. Screens and the states each needs:

| Screen | States to design |
| --- | --- |
| Choose language, Welcome | First launch only; language can be changed later in settings |
| Tutorial game | A scripted game against one bot, with prompts that point at the river, a meaning card and a verb; skippable, replayable from Rules |
| Home | First visit; saved game waiting (Continue is the primary button); returning player |
| Game setup | Solo or pass-and-play; race or turns (race disabled for pass-and-play); bots and difficulty; answers shown or hidden; hints |
| Game table | See the table and interaction sections below |
| Hand-over screen | Pass-and-play only: "Pass to Siobhán", hand hidden until she taps |
| Pause menu | Resume, rules, settings, restart, quit (with a save) |
| Recap | Winner, card counts, every compound made with its meaning, tap through to the glossary, play again |
| Glossary | All 36 compounds grouped by verb; each shows times made and when last seen |

## The game table

The table screen is where 95% of the time is spent; design it first and hardest. A typical game ends with 60–110 cards on the table, on a grid about 14 × 16 cards, so the board must pan and zoom smoothly.

**Zones, phone portrait (primary)**

1. **Status strip** (top): opponents as avatars with hand counts, the turn indicator or race clock, and a pause menu.
2. **River** (under the status strip): five piles in a row, each showing its top particle and the cards left. This is where eyes go most often in race mode; it must be scannable in under a second.
3. **Board** (middle, flexible): the table of lines. Pan, pinch-zoom, double-tap to fit. Auto-follows the latest play, without fighting the user's own panning.
4. **Meaning pile** (beside the river or the hand): face-up meaning card and the count left.
5. **Hand tray** (bottom): verbs, meaning cards and wildcards, fanned or scrollable. Meaning cards need room to show three meanings.

**Tablet landscape:** board centre, river down one side, hand along the bottom, opponents along the top. For pass-and-play round a table, consider an optional layout where the river and board stay put while the hand tray changes owner.

**Always visible:** your card count, every opponent's count, the river tops, the face-up meaning. Everything else can live one tap away.

## Interactions and feedback

A full line is up to five cards from three places (hand, river, table), so building it by dragging each card is far too slow for race mode. Design a tap-first line builder instead; drag can exist as an alternative.

**Building a full line (the core interaction)**

1. Tap a meaning card in your hand. It lifts, and every way to complete one of its three meanings lights up: verbs on the table with a free arm, verbs in your hand, matching river tops, and existing particles a line could pass through.
2. Tap a verb (table or hand). The app now knows the compound; the needed river tops pulse, and a wildcard is offered for any particle that isn't showing.
3. Tap where the line goes, or accept the suggested spot. The line animates into place and the compound is read out in Irish with its meaning.

The order should be flexible: starting from a verb or a river particle works too. If only one placement is possible, skip step 3.

**Other plays:** a lone verb (tap a verb, tap "Lay alone", see the draw-2 cost before confirming); a swap (tap a hand meaning card, tap the face-up one).

**Feedback states to design**

- A play that isn't possible: a short shake and a one-line reason ("No *suas* in the river").
- Race mode, someone else got there first: the lit target fades with a "Taken" flash, and the builder resets.
- A stall: the river visibly rotates, and the drawn cards fly to hands.
- A bot's play: the line draws in at a pace the eye can follow, with the bot's avatar pulsing.
- Game end: going out, or fewest cards when nothing can be played.

**Motion and haptics:** quick and physical (cards snap, piles riffle), never slow enough to cost a race. Light haptic on placement, a stronger one on completing a line. All motion respects reduced-motion settings.

## Visual direction

Aim for a modern card game with real tactility, rooted in the north of Ireland without leaning on tourist symbolism. Think of a well-made physical deck on a table, not a language-learning worksheet.

- **Tone:** playful and quick, confident rather than cute. The Irish is the hero; English is supporting text.
- **Palette:** take cues from the north coast and the uplands (sea greys, heather, bog brown, gorse yellow) and use them as a quiet table surface. The five card types need five clearly distinct colour families that read on that surface in light and dark modes.
- **Cards:** square tiles with physical presence (rounded corners, a subtle edge or thickness, a satisfying lift when selected), flat rather than skeuomorphic.
- **Type:** a typeface with excellent fada support and a distinctive Irish word style for card faces; a plain, highly legible face for UI and English.
- **Icons:** simple line icons; one consistent glyph per card type, used on the card and in any legend.
- **Avoid:** shamrocks, harps, Celtic knotwork as decoration, green-white-orange, and pseudo-uncial lettering. Any of these makes the app read as a souvenir, not a game.

## Accessibility and language

The interface is bilingual from day one, and no game information may depend on colour alone.

- **Language:** every UI string in Ulster Irish and English, switchable in settings and on first launch. Irish is the default. Phil will supply or vet the Irish strings, so leave room for Irish text, which often runs longer than the English.
- **Colour independence:** card type is also carried by icon and shape; player identity by initial or pattern as well as colour; a line's axis by the stripe's shape, not tint.
- **Touch targets:** at least 44 × 44 pt in the hand tray and river. Table cards can be smaller, but tapping one selects the nearest valid target, and zoom is always available.
- **Screen readers:** every card has a spoken label ("Meaning card: describe, *cuir síos ar*; get from, *bain as*; …"). Each play is announced ("B lays *cuir suas le*, put up with"). The board can be explored line by line.
- **Motion:** honour reduced motion with fades in place of flights and riffles; no information carried only by animation.
- **Race mode and access:** state clearly that race mode is timing-dependent, and keep turn mode as a full equal, not a fallback.

## Installable web app requirements

The app must install to a home screen and feel native: full screen, offline, no browser chrome. Design the pieces that make that true.

- **Offline first:** every game mode runs with no connection; bots and rules run on the device. No loading spinners in play.
- **Install:** a web app manifest, app icon in all sizes (including maskable and a monochrome version), splash screens, theme and background colours for light and dark.
- **Install prompt:** a friendly in-app nudge after the first finished game, not on first launch, plus an "Add to home screen" explainer for iOS, which has no automatic prompt.
- **Safe areas:** layouts respect notches, the home indicator and rounded corners; nothing interactive in those zones.
- **Orientation:** phone portrait is primary; tablets support both orientations; phone landscape at least works.
- **System integration:** respects light and dark mode, text size and reduced motion; haptics where the platform allows.
- **Updates:** a quiet "New version ready, restart" banner, never mid-game.

## What to deliver back

The build works directly from your artboards, so annotate behaviour as well as appearance.

- [ ] **Screens** from the flow above, phone portrait for all, plus tablet landscape for the game table, setup and recap
- [ ] **Game table states:** opening deal, mid-game dense board, line builder at each step, a stall, a "Taken" race collision, a bot playing, pass-and-play hand-over, game end (going out, and fewest cards)
- [ ] **Components** with every state: the five card types at three sizes (hand, river, table), river pile, hand tray, meaning card expanded and collapsed, player avatar with count, buttons, toasts, dialogs
- [ ] **Design tokens:** colours (light and dark, including the five card families and up to four player colours), type scale, spacing, radii, elevation, motion durations and easing
- [ ] **Motion notes** for the key moments: line placement, river take, stall rotation, bot play, win
- [ ] **App icon** and splash assets
- [ ] **Empty and error states:** no saved game, glossary with nothing learned yet, an update available
- [ ] **Copy:** every visible string in English, with space reserved for the Irish (Phil supplies it)

## Implementation notes

The app will port the existing Python simulator's rules and bots to TypeScript, so the designs only need to fit the model below.

- **Board model:** a grid of cells. Each card has a position, a type, a word, its line axis (horizontal or vertical, for particles and wildcards) and the player who laid it. Verbs are hubs; lines run outward in four directions.
- **Legal-move engine:** for the current hand, river and board, it lists every legal play. The line builder's highlights come straight from this list, so the UI never has to work out rules itself.
- **Bots:** the simulator's planner bots, with difficulty set by reaction delay (race) and by how often they spot lines through existing particles.
- **Seeded shuffles:** every game has a seed, so a game can be replayed, shared or reported. A "Replay this game" view on the recap screen is cheap to build.
- **Deck as data:** compounds, meaning-card triplets and copy counts load from a JSON file generated from the card-list spreadsheet. New sets (for example nouns like *tabhair aire do*) arrive as new data files, not new code.
- **Stack:** a web framework of the build's choosing, a service worker for offline, and local storage for settings, glossary progress and a saved game. No server in v1.

## Open questions

- [ ] **Name:** what is the game called, in Irish and in English? The icon and splash depend on it.
- [ ] **Audio:** should completed compounds be spoken? If so, recorded by a native Ulster speaker, or left out of v1?
- [ ] **Answers hidden:** in fluent mode, does a wrong guess cost anything, or is the hidden answer purely a display choice?
- [ ] **Glossary depth:** just compound and meaning, or also an example sentence and a note for each? Example sentences would need writing and vetting.
- [ ] **Physical deck:** will the printed cards share this visual system? If so, design card faces once, for both print and screen.
- [ ] **Compound list:** the 36 compounds still need Phil's Ulster check before the copy is final.
