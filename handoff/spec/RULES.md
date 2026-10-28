# Rules: Bain Amach (working title)

The canonical ruleset. Where this file and any other document disagree, this file wins. Deck contents and counts live in `data/deck.json`; this file never repeats a number that the data file defines, except as an example.

## 1. Components

| Card | Where it lives | Notes |
| --- | --- | --- |
| Verb (*cuir*, *bain*, *tabhair*…) | Hand deck, then hands and table | Base set for 2 players; base + `pack3to4` for 3–4 players |
| Particle: adverb (*amach*, *isteach*, *suas*, *síos*) or preposition (*ar*, *le*, *do*, *as*, *de*, *faoi*, *ó*) | The river: face-up piles | Never in a hand |
| Meaning card | Meaning pile (one face-up card beside it), and hands | Three English meanings per card, each with its Irish answer |
| Wildcard | Hand deck, then hands and table | Stands in for any one particle |

A **compound** is a verb plus one or two particles with one English meaning, e.g. *cuir suas le* = PUT UP WITH. The list of valid compounds is `data/deck.json → compounds`. Nothing outside that list is a valid compound, even if it is good Irish.

## 2. Setup

1. Shuffle the particles and deal them face up into `riverPiles` piles (5). Only each pile's top card is visible and usable.
2. Shuffle the meaning cards into the meaning pile. Turn its top card face up beside it: the **face-up meaning**.
3. Build the hand deck: the verbs for this player count (`setup[n].verbs`) plus all wildcards. Shuffle it.
4. Take `starterVerbs` (4) **different** verbs from the hand deck and place them on the table, spaced so each has room for lines.
5. Deal each player `handSize − meaningsInHand` cards from the hand deck and `meaningsInHand` (3) from the meaning pile.

| Players | Verbs | Hand size |
| --- | --- | --- |
| 2 | base (22) | 12 |
| 3 | base + pack (36) | 12 |
| 4 | base + pack (36) | 10 |

Choose the first player at random. In turn mode, play passes to the left.

## 3. The table

- The table is an unbounded square grid. Every card occupies one cell.
- A **line** is a straight run of cells, across or down: a verb at one end, then the compound's particles in order, then a meaning card at the other end. A line may read in any of the four directions; it always starts at its verb.
- Verbs are hubs: several lines can leave one verb in different directions.
- Particles and wildcards on the table have an **axis**: the direction of their line (horizontal or vertical). A meaning card on the table records which of its three meanings it is being **used as**.
- Cards beside a line do not affect it. There is no adjacency rule.

## 4. Plays

A play is exactly one of the following.

### 4.1 Lone verb

Place one verb from your hand on any empty cell, then draw `loneVerbDraw` (2) cards (see §6). Not allowed when both the hand deck and the meaning pile are empty.

### 4.2 Full line

Place a whole line in one play:

- **Meaning:** a meaning card from your hand, used as one of its three meanings.
- **Verb:** either a verb already on the table (the line leaves it in a direction whose cells are all empty), or a verb from your hand placed on any empty cell. A verb from your hand costs no draw.
- **Particles:** every particle the compound needs, in order. Each one is either the top card of a river pile, or a wildcard from your hand. Two particles may come from the same pile: take its top, and the card underneath becomes the new top.
- **Cells:** every cell the line needs must be empty, except as in §4.3.

The compound formed (verb + particles) must be in the compound list, and its meaning must be one of the meaning card's three. A line may repeat a compound already on the table; the meaning cards limit how often (each meaning is printed on three cards).

### 4.3 Full line through a particle already down

As §4.2, but exactly one of the line's particle cells is already occupied by a particle on the table that is the right word for that position. The new line crosses it at right angles: that particle now belongs to two lines. Rules for this play:

- The verb comes from your hand. The meaning card comes from your hand. Every other cell of the new line must be empty.
- The shared cell must hold a real particle, not a wildcard.
- The shared particle is marked as a **crossing** (both axes).

### 4.4 Swap

Exchange one meaning card from your hand with the face-up meaning.

## 5. Modes

### 5.1 Turn mode

On your turn, make one play (§4) or **draw and pass** (draw 1 card, see §6). You may draw and pass even when you hold a legal play. When every player has passed in a row, the river is **buried** (§7, step 2 only: each player has already drawn while passing). The pass count resets after any play.

### 5.2 Race mode

All players play at the same time, as fast as they like, one play at a time each. A play is checked against the state at the moment it is committed. If the state changed since the player started building it (for example, the river top they needed was taken), the play is refused as **Taken**, their cards stay in their hand, and they lose nothing.

Each human has a **Stuck** toggle. Touching any card or pile clears it. A stall (§7) happens when every human is Stuck and no bot has a legal play. There is no timeout.

## 6. Drawing

Whenever a player draws (after a lone verb, when passing, at a stall):

1. When passing or at a stall, a player holding fewer than 2 meaning cards draws from the meaning pile.
2. Otherwise they draw from the hand deck.
3. If the hand deck is empty, they draw from the meaning pile instead.
4. If both are empty, nothing is drawn.

## 7. Stall

1. Every player draws 1 card (§6). (Race mode only; in turn mode the draws already happened when each player passed.)
2. **Bury:** every river pile with more than one card moves its top card to the bottom of that pile.

## 8. End of game

- A player who empties their hand wins immediately.
- Once both piles are empty, two stalls in a row with no play between them end the game (the second gives the buried river one more chance). Fewest cards in hand wins. Equal fewest is a tie.

## 9. Display modes (rules unchanged)

- **Answers shown:** meaning cards show the Irish answer under each meaning. The app highlights everything usable (see `CLAUDE.md` → Line builder).
- **Answers hidden:** meaning cards show only the English. No highlighting. The player assembles the line and the app checks it on commit. A wrong line is refused, the cards go back to the hand, and the turn ends with no draw (turn mode), or the player is locked out of laying lines for 3 seconds (race mode).
- **Hints** (optional, either display mode): a hint lights one usable verb for the selected meaning card.

## 10. Edge cases to test

- A compound with two particles where both come from the same river pile (top, then the card under it).
- A line from a verb in hand whose spot is far from other cards: legal; the grid is unbounded.
- A line through a particle whose word appears twice in the compound list for that verb (rare): the shared cell must match the particle at that exact position.
- GIVE UP: one meaning with two valid compounds (*tabhair suas*, *éirigh as*). Either completes a GIVE UP meaning card.
- Race mode: two players committing lines that need the same river top. The first commit wins; the second gets Taken.
- Both piles empty: lone verbs are no longer legal; passing still is.
- A tie on fewest cards.

## 11. Custom decks

- A custom deck sets the count of each verb, particle and wildcard, the set of meanings in play, and the number of meaning cards. It can't add compounds: it selects from `deck.json`.
- **Compounds in play:** every compound whose verb and particles all have a count above 0 and whose meaning is selected. A meaning card answers only with compounds in play.
- **Meaning cards** are generated from the selection (see `spec/deck-editor.md`).
- **Hand size:** for each player count, the base hand size, reduced until the verbs and wildcards (less the starter verbs) deal every hand in full. Below 7, that player count can't use the deck.
- Everything else (setup, plays, drawing, stall, end) is as in §2–9.

## 12. Stórfhocail (optional, solo games against bots)

**12.1 Tiles.** A stórfhocal tile carries one word and one or more phrases (`data/storfhocail.json`). Each phrase is a verb followed by a pattern: the tile's cell and particle cells, in reading order. Example: *tabhair* [**aire**] [*do*]; *tabhair* [*le*] [**fios**].

**12.2 Stórfhocal line.** A play that places, in one straight line from the verb:
- **Verb:** on the table, with a free run of cells in that direction; or from your hand onto any empty cell.
- **The tile:** from your pouch (or, for a bot, its carried word), on its cell.
- **Particles:** each from a river top or a wildcard, as in §4.2.
- **No meaning card.**
- **Phrase:** must be one printed on the tile.
- **Shared particle:** one particle cell may be a particle already on the table, under the same conditions as §4.3 (verb from hand, a real particle, right word in that position). A stórfhocal cell is never shared, and a wildcard never stands in for a stórfhocal.
- **Hidden-answers mode:** checked on commit like any line, with the same penalty when wrong (§9).

**12.3 Hand.** Stórfhocail are never hand cards. They don't count towards hand size, going out or fewest cards. A player whose hand is empty apart from stórfhocail has gone out.

**12.4 Bringing tiles in.** In a stórfhocal game a player may move up to 2 of their owned tiles into their pouch at any time, and back again unless laid. Moving a tile doesn't use a turn.

**12.5 Bots.** Only Hard bots use stórfhocail; the carry and timing rules are in `spec/storfhocal.md` §5.

**12.6 Settlement.** After the game:
- **The player wins:** every stórfhocal on the table goes to the player.
- **A bot wins:** stórfhocail the player laid are lost.
- **Tie:** the player keeps their own.
- **Bot-laid tiles:** vanish unless the player won.
- **Quitting:** quitting or restarting after laying one of your own counts as a loss of the tiles you laid.
