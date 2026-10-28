# Deck editor and Stórfhocal: feature plan

28 October 2026 · Phil

Two post-v1 features, built in this order: a **deck editor** first, then **Stórfhocal**. The deck editor is mostly data and validation on top of the v1 engine. Stórfhocal adds a new tile type, a new line shape, bot behaviour and a permanent collection with something at stake. The v1 handoff listed the deck editor as out of scope; this plan moves both into v1.1.

Both features are buildable as described. Stórfhocal has several rules that the request leaves open, and some of them can be exploited or quietly lose a player's collection if left to the builder. They were settled with Phil on 28 October; only the word list is still open.

## Decisions

| # | Question | Decision |
| --- | --- | --- |
| 1 | Which words are Stórfhocail? | Single words, usually a noun or adjective, each completing a fixed phrase: *aire* (*tabhair aire do*), *taitneamh*, *sult*, *scíth*. **Open:** Phil checks the shortlist below. A phrase must have no part that changes with the person, so *lig do scíth* ("your rest") is out, and so is any phrase that takes no object. |
| 2 | How many in hand at once? | One at a time; it can be put back unplayed for free. |
| 3 | Does an unplayed tile count against fewest cards? | No. It goes back to the bag at the end. |
| 4 | Shared win between the player and a bot? | Each side gets its own back: the player keeps their own tiles, and tiles a bot laid vanish. |
| 5 | Pass-and-play? | Stórfhocal off. |
| 6 | Quitting or restarting with a tile at stake? | The tile is lost. Discarding a saved game with tiles at stake warns first. |
| 7 | "Replay this game" on a Stórfhocal game? | Only the deal repeats. Bot choices and Stórfhocal plays are picked fresh, as in a new game, and stakes apply. |
| 8 | How does the first tile appear? | Raised odds: Hard bots play Stórfhocail at 3× the usual chance until the player has seen their first. |
| 9 | When is a phrase "seen"? | Once any bot or the player lays a tile carrying it. |
| 10 | Does the toggle remember its last setting? | Yes. Off on a new install. |
| 11 | Backing up the bag? | Restore points exist only at milestones: each time the bag reaches 10, 20, 30 tiles and so on, the app offers one to save. Restoring is allowed only into an empty bag (a new phone or cleared storage), so it recovers a lost bag but can't undo a lost game. |
| 12 | Phrases a deck can't complete? | The list is limited to phrases the Standard deck can complete. In a custom deck, tiles that can't be completed are greyed in the bag and can't be picked; tapping one explains why. Bots skip them too. |
| 13 | How does a Stórfhocal look? | It sparkles like foil. **Colour:** gold clashes with the gorse verbs, cobalt with the blue player, cyan with the lit ring. Chosen: Opal, a pearl face washed with pastel colour inside an iridescent foil rim, with the word in ink and part of speech as a small label. It moves gently: the wash drifts over 10 seconds, the rim turns every 8, and a glint crosses every 6. Nothing else on the table moves, which is what makes it stand out from the paper meaning cards. Ink-black was too heavy and read as an adverb. Under reduced motion it holds still with a heavier rim. |

## Deck editor

A custom deck is a copy of the Standard deck with four things changed: a count per verb, a count per particle, the wildcard count, and which compounds appear on meaning cards, plus how many meaning cards there are. The app generates the meaning cards from those choices. Players pick the deck on the Setup screen. The glossary, progress and Stórfhocal are unaffected by which deck is played.

**What the player sets**

- **Verbs:** a count from 0 to 8 for each verb in the master list. Standard is 22 verbs, plus the 14-card pack for 3 or 4 players. A custom deck has one set of counts and no separate pack: it serves whichever player counts it has enough verbs for.
- **Particles:** a count from 0 to 10 for each adverb and preposition. Standard is 42 in total.
- **Wildcards:** 0 to 8. Standard is 4. Not in the request, but it is one more stepper and changes difficulty a lot.
- **Compounds:** a checklist of the 36. A compound can be ticked only when its verb and every particle it needs have a count of at least 1; otherwise the row is greyed with the reason ("needs *suas*").
- **Meaning cards:** a total N. Each card carries three different meanings, so there are 3N meaning slots shared across the ticked compounds.

The Standard deck is built in and read-only. "Duplicate" makes an editable copy; custom decks can be renamed and deleted. A deck in use by a saved game can still be edited, because the game keeps its own snapshot.

**Validation**

The editor shows which player counts the deck can serve, live, as chips (2 players, 3, 4), each with its reason when it fails. Setup only offers player counts the chosen deck can serve.

| Rule | 2 players | 3 players | 4 players | Fails as |
| --- | --- | --- | --- | --- |
| Verbs + wildcards fill the starters and hands (4 + players × (hand size − 3)) | 22 | 31 | 32 | "Needs 6 more verbs or wildcards for 3 players" |
| At least 4 verbs, for the starters | 4 | 4 | 4 | "Needs 4 verbs to start" |
| Meaning cards cover the deal (3 per player + 1 face up) | 7 | 10 | 13 | "Needs 3 more meaning cards for 4 players" |
| Particles fill the river (one per pile) | 5 | 5 | 5 | "The river needs at least 5 particles" |
| At least 3 compounds ticked, so a card can hold 3 different meanings | 3 | 3 | 3 | "Tick at least 3 compounds" |
| Every ticked compound appears at least once (N ≥ compounds ÷ 3) | — | — | — | "10 cards can't show all 36 meanings; raise to 12" |

The table's numbers are for the current hand sizes (12, 12 and 10). Warnings that don't block play sit under the chips: a hand deck that will be empty straight after the deal, fewer than 20 particles in the river, or one compound on far more cards than the others.

**Generating the meaning cards**

1. Share the 3N slots across the ticked compounds as evenly as possible: every compound gets ⌊3N ÷ k⌋ copies, and the remainder go one each to compounds chosen by the deck's seed.
2. Deal the slots into cards of three, with no meaning twice on a card. GIVE UP is one meaning shared by *tabhair suas* and *éirigh as*, so it counts as one meaning here.
3. Each card's Irish answer is the compound it was dealt for. Any compound with that meaning still wins the line, as in v1.
4. Store the seed with the deck. "Shuffle the cards" draws a new seed; the same seed always gives the same cards.

The editor shows the generated cards in a scrolling strip so the player can see what they made. Standard has 36 compounds on 36 cards, so every compound appears exactly 3 times.

**Test the deck**

A "Test with bots" button plays 100 Normal-bot games in a web worker, using the v1 rules engine and bots, and reports four numbers: lines per game, how often someone goes out, stalls per game, and the compounds never made. It takes a few seconds and shows whether a deck plays, not whether it is balanced. Run it at 2 players by default, with the other valid counts on a toggle.

**Where it lives**

- Home → "Decks", always visible.
- Setup gets a deck row above Opponents: the deck name and its size ("Standard · 104 cards"); tapping it opens a picker with an "Edit decks" link.
- Saved games and "Replay this game" store a full snapshot of the deck. Editing or deleting a deck never changes a game already started.
- Not in this version: adding new compounds, editing meanings, sharing decks between devices, or printing a custom deck. Sharing by code is a small later step for classrooms.

## Stórfhocal

A Stórfhocal is a collectable word tile: a noun, adjective or other word that is not a verb or particle but completes a common phrase, such as *aire* in *tabhair aire do*. Laid in its place in the phrase, it makes a line with no meaning card. In a Stórfhocal game, Hard bots occasionally play one, and the player can play tiles from their own collection. The winner keeps every tile played, so a player who plays their own tile and loses to a bot loses it for good.

**The tile**

- **Face:** the word large, in Irish, with a small part-of-speech label ("noun", "adj"). Under it, every phrase the tile can make, each as the Irish phrase with its English meaning ("*tabhair aire do* · TAKE CARE OF").
- **In the hand** it is wide like a meaning card, so its phrases can be read. **On the table** it is square and shows only the word, like a table meaning card shows one meaning.
- **Hidden answers:** the word and the English meanings show; the Irish phrases are dotted rules, as on meaning cards.
- **Look:** it sparkles like foil, which is the cue that it is special. Its colour must avoid every card type and player colour, and it must still read at 26px zoom. Under reduced motion the sparkle is a still foil edge. Settled: Opal (see Design work and component Storfhocal).

**Making a line**

- The line is the phrase in its written order: verb, then Stórfhocal, then particles (*tabhair* · *aire* · *do*), or verb · particle · Stórfhocal (*tabhair* · *faoi* · *deara*) where the phrase puts the word last. Each phrase in the list carries its own order.
- Otherwise it follows the normal line rules: the verb comes from the table (with a free arm) or the hand; particles come from river tops, a wildcard, or a particle already down that the line runs through.
- No meaning card is used. Other lines can cross the line's verb and particles as usual, but nothing threads through the Stórfhocal itself.
- In hidden-answers mode it is checked when committed, like any line, and a wrong one is refused the same way.
- Laying one gets a richer version of the LineMade moment: the phrase, its meaning and the word "Stórfhocal". When a bot lays a tile the player doesn't own, the toast adds "Win this game to keep it".

A Stórfhocal line sheds fewer of the player's own cards than a normal line, because the tile came from the bag, not the hand. Its value to the player is a line when no meaning card fits. For a bot it is a free extra line, which is why only Hard bots get it, and rarely.

**Bots**

- Only Hard bots, and only in Stórfhocal games.
- When a Hard bot chooses a play and at least one Stórfhocal line is legal for it, it plays one with probability *p* instead of its best ordinary play. Start at *p* = 0.12, and bots never lay more than one tile beyond the number the player has laid this game. Tune with the simulator.
- The bot draws its tile from the full list, not from the player's bag, weighted 3 to 1 towards tiles the player doesn't own yet, so a collection grows. It skips tiles the current deck can't complete.
- **First tile:** until the player has seen their first Stórfhocal, Hard bots play them at 3× the usual chance (*p* = 0.36), so the feature shows itself within a few games.

**Stakes set the odds: nothing ventured, nothing gained.** A player who has tiles but never risks one shouldn't keep winning the bots' tiles.

- **No open stake:** while the player has a usable tile in their bag and none of theirs is waiting for an answer, a Hard bot's chance is slim: *p* ÷ 6, about 2%.
- **Open stake:** each tile the player lays opens a stake. The next Hard-bot chance is back at the full *p* until a bot lays a tile, which answers it.
- **Lay another:** laying a second tile, taken from the bag after the first, reopens the stake and restores the odds.
- **Empty bag:** a player with nothing usable in the bag has nothing to venture, so bots play at the full *p* (3× until their first tile, as above).
- **Telling the player:** the bag sheet says it in one line: "Lay one and the bots are far more likely to lay one back." The Rules screen explains it in full.

**The player's tiles in a game**

- A "Stórfhocail" button sits in the hand tray in Stórfhocal games when the bag holds at least one tile. It opens the bag as a sheet; tapping a tile puts it in the hand.
- One tile in hand at a time. Taking it costs no turn, and it can be put back unplayed for free.
- In a custom deck, tiles whose phrases the deck can't complete are greyed and can't be picked. Tapping one explains why ("*tabhair* isn't in this deck").
- Before it goes into the hand, a one-line warning names the stakes: "If you play *aire* and lose, Giorria keeps it." A "Don't warn me again" tick turns the warning off.
- Once a tile is laid, it is at stake. A small chip in the status strip shows the tiles on the table and who laid them.
- An unplayed tile goes back to the bag at the end and never counts against the player's card total.

**Who keeps what**

(Diagram on the plan doc: bag → hand → table → result. The table below carries the same rules.)

Nothing is at stake until a tile is laid; taking one out of the bag and putting it back is free.

A tile's fate is settled when the game ends. On a shared win, each side gets its own back.

| Tile laid by | The player wins outright | A shared win | A bot wins outright |
| --- | --- | --- | --- |
| The player, from their bag | Stays in the bag | Stays in the bag | Leaves the bag for good |
| A bot | Joins the player's bag; nothing changes if they already have it | Gone | Gone |

- **Quitting** a game with the player's own tile at stake loses the tile, which includes Restart and starting a new game over a saved one. Both warn first, as does discarding a saved game with tiles at stake. Closing the app is not quitting: the game is saved and resumes.
- **Replay this game** repeats only the deal. Bot choices and Stórfhocal plays are picked fresh, as in a new game, and stakes apply. Otherwise a player could learn a deal and farm the same bot tile from it.
- The recap lists every transfer: "You won *ceann*", "Giorria took *triail*", "You kept *aire*".

**The bag (the player's permanent store)**

- Opened from Home; the entry stays hidden until the player first owns a tile, and then stays visible even if the bag empties.
- One slot for every Stórfhocal in the list. A filled slot shows the tile; an empty one is a blank slot with no word, so the size of the set shows without spoiling it. A count shows how many slots are filled out of the full set.
- Tapping a tile shows its phrases and meanings, with a link to each in the glossary.
- Each word fills one slot, so a second copy of a tile adds nothing.

**Unlocks**

- The Stórfhocal toggle appears in Setup after 20 finished games on this device (any mode; abandoned games don't count). The 20th recap announces it in one line.
- Off for a new install. Hidden for pass-and-play.
- With no Hard bot at the table and an empty bag, the toggle stays available with a note: "Tiles appear only with a Hard bot."

**Glossary**

Stórfhocal phrases sit inline in their verb's group, marked with the tile, so searching *tabhair* finds every *tabhair* entry, Stórfhocal or not. Only phrases the player has seen appear, whether or not they own the tile; a phrase is seen when a tile carrying it is laid in one of their games. Compounds are all listed from the start so learners can study; Stórfhocail are meant to be found.

## Stórfhocal shortlist

A shortlist of 35 candidates for Phil's Ulster check. Each is one fixed word in a fixed phrase that takes an object, and uses only the deck's particles. All 35 use verbs in the Standard deck: Phil confirmed *déan*, *tóg*, *caith* and *buail* are in, so the "Needs" notes below are met, and *iontas* can carry both *cuir iontas ar* and *déan iontas de*.

**The test:** the word never changes; nothing in the phrase changes with the person (so not *lig do scíth*); it governs an object, directly (*tabhair faoi deara* X) or through its particle (*tabhair aire do* X); and its particle is one of *ar*, *le*, *do*, *as*, *de*, *faoi*, *ó* or an adverb. Out on that test: *lig do scíth* (possessive), *glac scíth* (no object), *cuir fáilte roimh*, *tóg páirt i* and *fág slán ag* (particle not in the deck).

| Word | Phrase | Meaning | Note |
| --- | --- | --- | --- |
| aire | *tabhair aire do* | take care of, mind |  |
| deara | *tabhair faoi deara* | notice | Word comes after the particle |
| cuairt | *tabhair cuairt ar* | visit |  |
| aghaidh | *tabhair aghaidh ar* | face, head for |  |
| comhairle | *tabhair comhairle do* | advise | Also *cuir comhairle ar*? |
| cead | *tabhair cead do* | allow |  |
| freagra | *tabhair freagra ar* | answer |  |
| suntas | *tabhair suntas do* | take notice of | Check for Ulster |
| cuidiú | *tabhair cuidiú do* | help | Ulster form of *cúnamh* |
| triail | *bain triail as* | try |  |
| úsáid | *bain úsáid as* | use |  |
| sult | *bain sult as* | enjoy |  |
| taitneamh | *bain taitneamh as* | enjoy | Same meaning as *sult*; keep both? |
| geit | *bain geit as* | startle |  |
| tuisle | *bain tuisle as* | trip up | Check for Ulster |
| aithne | *cuir aithne ar* | get to know |  |
| ceist | *cuir ceist ar* | ask (someone) |  |
| eagla | *cuir eagla ar* | frighten |  |
| iontas | *cuir iontas ar* | surprise | Also *déan iontas de* if *déan* comes in |
| fearg | *cuir fearg ar* | anger |  |
| moill | *cuir moill ar* | delay |  |
| cosc | *cuir cosc ar* | prevent, ban |  |
| deireadh | *cuir deireadh le* | end, put an end to |  |
| stop | *cuir stop le* | stop |  |
| dlús | *cuir dlús le* | speed up | Check for Ulster |
| glan | *fan glan ar* | keep clear of | Adjective |
| bréan | *éirigh bréan de* | get fed up with | Adjective |
| tuirseach | *éirigh tuirseach de* | get tired of | Adjective |
| dearmad | *déan dearmad de* | forget | Needs *déan* |
| magadh | *déan magadh faoi* | mock | Needs *déan* |
| gáire | *déan gáire faoi* | laugh at | Needs *déan* |
| aithris | *déan aithris ar* | imitate | Needs *déan* |
| ceann | *tóg ceann de* | heed | Needs *tóg* |
| súil | *caith súil ar* | glance over | Needs *caith* |
| cnag | *buail cnag ar* | knock on | Needs *buail* |

One English meaning may have two tiles (*sult*, *taitneamh*), which is fine: it is the word being collected, not the meaning. A tile with two phrases (*comhairle*, *iontas*) lists both on its face.

## Data and storage

Three new records, and two v1 records gain fields. Everything stays on the device; there is still no server.

| Record | Holds | Lives in |
| --- | --- | --- |
| Deck | id, name, built-in flag, counts per verb and particle, wildcards, ticked compounds, meaning-card total, seed, the generated cards, schema version | Local storage, one entry per custom deck; Standard ships with the app |
| Stórfhocal list | per word: id, the word, part of speech, and its phrases (verb, particles, word order, English meaning) | Shipped JSON, generated from your list like the card spreadsheet |
| Player record | finished-game count, Stórfhocal unlocked, the bag (a set of word ids), phrases seen, "don't warn me" flag | Local storage |
| Saved game (v1) | adds a full deck snapshot, Stórfhocal on or off, the tiles at stake and who laid each, the tile in hand | Local storage, as now |
| Replay seed (v1) | adds the deck snapshot | With the recap |

A phrase entry looks like this; `order` is the line's cards in written order, so the engine places the word where the phrase puts it:

```json
{ "id": "aire", "word": "aire", "pos": "noun",
  "phrases": [
    { "id": "tabhair-aire-do", "order": ["tabhair", "WORD", "do"], "meaning": "TAKE CARE OF" }
  ] }
```

- **Keeping the bag safe:** call `navigator.storage.persist()` when the first tile is won. Each time the bag reaches 10, 20, 30 tiles and so on, the app offers a restore point: a short text code holding the bag and phrases seen, to copy or save as a file. There is no restore point on demand, or a player could make one, lose a tile, clear storage and restore. "Restore" works only when the bag is empty, so it recovers a bag lost to cleared storage or a new phone but can't undo a lost game. Browsers can clear an installed web app's storage, and iOS has done so for sites it thinks unused.
- **Schema versions** on Deck and Player record from day one, so later changes can migrate them.
- **Engine changes:** a Stórfhocal line is a new line shape in the legal-move engine (a word card in the line, no meaning card). The checker accepts a line if its cards, in order, match a phrase's `order` with any particle stood in for by a wildcard. The board model gains a card type `storfhocal` that no other line may pass through. A helper reports which tiles the current deck can complete, for greying in the bag and for bots.

## Design work

Twelve additions to the screens board and one new card family in the design system. Everything Stórfhocal is now drawn: the Opal tile is in the design system (component Storfhocal, with the stake chip and line-made variant), and 15 boards sit under "Stórfhocal games" on the screens board. The deck editor is drawn too: 11 boards under "Deck editor", with a Decks icon on Home. The deck editor screens can be built from existing components (steppers, segmented controls, list rows), so they can be drawn alongside the build.

| Screen or component | States to draw | Feature |
| --- | --- | --- |
| Decks list | Standard only; with custom decks; deck in use by a saved game | Deck editor |
| Deck editor | Valid for all counts; invalid for 3–4 players with reasons; compound row greyed with its reason; generated-card strip; phone and tablet | Deck editor |
| Test result sheet | Running; four numbers; a deck that plays badly | Deck editor |
| Setup additions | Deck row and picker; Stórfhocal toggle (off, on, on with no Hard bot); toggle absent before unlock and in pass-and-play | Both |
| Stórfhocal tile | Wide in hand; square on table; answers hidden; at 26–96px zoom; light and dark | Stórfhocal |
| Bag sheet in game | Pick a tile; the stake warning; one already in hand | Stórfhocal |
| Stake chip in the status strip | One tile; several; who laid each | Stórfhocal |
| LineMade, Stórfhocal version | Player's tile; a bot's tile with "Win this game to keep it" | Stórfhocal |
| Recap transfers | Kept, won, lost; nothing at stake | Stórfhocal |
| The bag (store) | First tile; partly full; full set; tile detail | Stórfhocal |
| Glossary section | First phrase seen; several; hidden before any | Stórfhocal |
| Unlock and warning moments | 20th game recap line; quit or restart with a tile at stake | Stórfhocal |

The Stórfhocal family must read as special at a glance without becoming a sixth thing to decode, and Phil wants it to sparkle. Hue is the hard part: gold clashes with the gorse verbs, cobalt with the blue player colour, cyan with the lit ring. So let the sparkle carry it. Chosen on the board: Opal, a pearl face with a drifting pastel wash, a turning iridescent rim and a glint every 6 seconds; still, with a heavier rim, under reduced motion. The bag sheet, stake chip, line-made variant and the bag screen are all drawn in this finish. The "dice bag" can be a literal cloth bag on the Home entry, opening to a tray of slots.

## Build order and tests

Nine steps, each shippable on its own. The deck editor (steps 1–4) can go out before any Stórfhocal work, which needs your phrase list before step 5.

1. **Decks as data.** The engine takes a deck object instead of the built-in one; saved games and replay seeds carry a snapshot. No visible change.
2. **Validation and card generation** as pure functions, with unit tests.
3. **Deck editor and Setup picker.**
4. **Test with bots,** running the existing bots headless in a web worker.
5. **Stórfhocal data:** your list as JSON, plus the build script that checks every phrase uses only the Standard deck's verbs and particles.
6. **Engine:** the new line shape, its placement, and the hidden-mode check.
7. **Hard bot play:** the probability, the per-game cap, the weighting towards unowned tiles, the raised first-tile odds, and the stake-based odds (slim with no open stake, full when the player has laid one). Tune *p* with the simulator.
8. **Stakes:** the bag, tiles at stake, settling at the end, forfeit on quit, fresh plays in replays, restore points and recovery.
9. **Stórfhocal screens:** tile, bag sheet, stake chip, LineMade, recap, the bag screen, glossary section, unlocks.

**Tests that matter most**

- Generation: every ticked compound appears at least once; no card repeats a meaning; the same seed gives the same cards; validity matches the rules table at 2, 3 and 4 players.
- Each row and column of the "who keeps what" table, including a shared win and a game with two Hard bots.
- Quitting, restarting, and starting a new game over a saved one with a tile at stake; force-closing the app mid-game and resuming.
- A replay repeats the deal but not the bots' Stórfhocal plays.
- Restore point round trip; a restore into a non-empty bag is refused.
- A deck missing *tabhair* (or any verb) never lets a bot play a phrase that needs it.

**Still open**

- [ ] Phil's Ulster check of the Stórfhocal shortlist (déan, tóg, caith and buail are confirmed in the Standard deck)
- [x] Whether to add particles: no; the list fits the deck instead
- [x] Answers to the decisions table at the top
- [ ] Irish names for "Decks", "Test with bots", the bag, restore points and the stake warning
- [x] The Stórfhocal card family: Opal, approved and in the design system
