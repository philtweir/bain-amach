# Feature: Stórfhocail (collectable phrase tiles)

A stórfhocal (plural stórfhocail) is a special tile carrying a word that isn't a verb or a particle (*aire*, *greim*, *deara*, *cinnte*) and completes one or more set phrases: *tabhair **aire** do*, TAKE CARE OF. A stórfhocal line needs no meaning card, because the tile itself shows its meanings. Hard bots occasionally lay one. Win the game and you keep every stórfhocal on the table. Lay one of yours and lose, and the winner keeps it.

Data: `data/storfhocail.json`, a **draft** of 26 words and 28 phrases awaiting Phil's Ulster check, plus every tuning number. Reference simulation: `reference/storfhocal/opportunities.js`.

Items marked **[Decision]** are defaults Phil can overturn; everything else is as he asked.

## 1. Unlock and the toggle

- The setup screen shows a **Stórfhocail** toggle only once the player has finished `unlockAfterGames` (20) solo games. Finished means it reached the recap; the tutorial and quit games don't count.
- It defaults to **off** for every new game.
- **Solo only.** Hidden for pass-and-play, since the bag belongs to the device's player.
- **[Decision]** The toggle is disabled unless at least one bot is Hard, with the hint "Needs a Hard bot". Only Hard bots carry stórfhocail, so without one the player could only lose tiles.
- Works with custom decks. Words whose phrases need a verb or particle missing from the deck can't be laid in that game: the picker greys them out, and bots won't carry them.

## 2. The tile

- A new card kind, `S`: the word, its kind (noun, adjective…), and each phrase's meaning.
- **Answers shown:** each phrase is printed with the tile's place in it: *tabhair* **aire** *do*, TAKE CARE OF. **Answers hidden:** the word and the English meanings only.
- **Visual:** a new card family that reads as special. It must not use gorse, which means "usable now" and nothing else. It also needs a shape cue (e.g. a bevelled corner), since nothing may rely on colour alone. Any shimmer is static under reduced motion. **Design needed.**

## 3. Laying a stórfhocal line

The rules live in `spec/RULES-addendum.md` §12. In short:

- One play: a verb (on the table with a free run, or from hand onto any empty cell), then the phrase's cells in order. The tile goes on its cell (`~` in the data). Every other cell is a particle from a river top, or a wildcard. **No meaning card**; the line ends after its last cell.
- The phrase must be one printed on that tile.
- The tile's place varies: *cuir **fios** ar* (tile then particle), but *tabhair le **fios*** and *tabhair faoi **deara*** (particle then tile).
- It may run through a particle already down, as in RULES §4.3. Nothing may run through a stórfhocal, and a wildcard can't stand in for one.
- It counts as a completed line everywhere: the announcement, the recap, glossary progress.
- **[Decision]** Stórfhocail never count as hand cards: not in hand size, not for going out, not for fewest cards. A player whose only cards left are stórfhocail has gone out.

## 4. The player's tiles in a game

- In a stórfhocal game the table shows a bag button. It opens a picker of the player's owned tiles, with counts, and greys out any tile unplayable with this deck.
- Picking one moves it to a **pouch** slot at the end of the hand tray. It is visually separate from the hand.
- The first time per game, a brief sheet warns: "If you lay **aire** and don't win, the winner keeps it." [Bring it in] [Not now]
- Up to `playerMaxPerGame` (2) per game. **Why the cap:** a tile is a line that sheds a verb with no meaning card. Five tiles in a pouch would buy five free sheds.
- An unlaid tile can go back to the bag at any time and returns automatically at the end. **Only a laid tile is ever at risk.**
- Race mode: the picker doesn't pause the race.

## 5. Bots

Simulation result: with a free choice of all 26 words, a bot has some stórfhocal line on about 90% of its turns. A per-turn "small chance" is therefore a near-certainty per game and a bad control. The spec uses a per-game roll instead:

- **The carry roll:** at the deal, each Hard bot carries one word with probability `botCarryChance` (0.25). `botCarryChanceUntilFirstSeen` (1.0) applies instead until the player has seen a stórfhocal laid, so the first game after turning it on shows the feature.
- **Which word:** chosen with `botCarryWeights` from words playable with this deck:
  - 40% a word the player lost to a bot and doesn't now own (a chance to win it back);
  - 40% a word the player doesn't own;
  - 20% any word.
  - An empty category passes its weight to the others.
- **When it plays:** the bot rolls a target between its own turns `botPlayWindow` (3–10). From then on it lays its word at its first legal chance, ahead of its normal move. It lays it at most once and may never get to lay it (going out first, or no chance).
- **Why the window:** a carried word is playable in about 90% of games (2p 94%, 4p 89%), usually within the first few turns. Without the window, every bot would play it on turn one.
- The hardest words to lay are those needing *faoi* or *de* (one copy each in the river) and *slán*. They are playable in 50–81% of games.
- **[Decision]** A Hard bot carrying a word shows a small bag badge on its avatar ("carrying a stórfhocal"); the word stays hidden until laid. That gives the player a reason to beat that bot specifically.
- A bot's carried word doesn't count in its hand.

**Pace (for tuning):** with 0.25 carry, one Hard bot lays a word in about 20% of games (0.25 × about 90% playable, a little less when the bot goes out first). Win about 40% of those, and that's a new tile roughly every 12 stórfhocal games. Collecting all 26 takes a few hundred games, so the collection is a long tail by design. The levers: carry chance, the unowned weight, more words, or a guaranteed carry every Nth game.

## 6. Settling up at the end

`settleStorfhocail(state) → { gained, lost, vanished }` is a pure function. Storage applies the result.

| Outcome | Tiles the player laid | Tiles bots laid |
| --- | --- | --- |
| Player wins | Back to the bag | Into the bag (+1 each) |
| Any bot wins (Hard or not) | **Lost** (−1 each); recorded in `lostByPlayer` | Vanish |
| Tie, no winner **[Decision]** | Back to the bag | Vanish |
| Player quits or restarts after laying one (`lossOnQuit`) | **Lost** | Vanish |

Quitting before laying any tile loses nothing. Closing the app just saves the game: laid tiles stay in play until it ends.

**Recap:** a stórfhocal panel shows the transfer, with tiles flying into the bag or across to the winning bot ("You won *aire*", "Bot 2 keeps *greim*"). Under reduced motion it fades and shows the same text.

## 7. The bag (permanent store)

- **Counts, not single slots [Decision]:** owning two *aire* shows ×2, and losing one leaves one. With single slots, winning a word you already own would be worthless.
- **Hidden until earned:** hidden from Home until the player first owns a tile. After that it stays visible even if they lose every tile, showing empty slots.
- **Screen:** one slot per catalogue word, in a fixed order (Irish alphabetical), with a header "9 / 26". Each slot has one of three states:
  - **Owned:** the tile and its count. Tap for its phrases, meanings and times laid.
  - **Seen, not owned:** an outline with the word greyed. Tap for its phrases.
  - **Unseen:** a blank silhouette. The word isn't revealed, which keeps the glossary's no-spoiler rule.

## 8. Glossary

- A new **Stórfhocail** section lists only phrases seen laid on the table, by anyone, in any game. Each entry shows the tile word, the phrase, the meaning, times seen, and whether owned.
- Owning a tile counts as having seen its phrases, since they're printed on it.
- No total count of phrases, so nothing hints at what's unseen.

## 9. Persistence: the one thing players can lose

- **Ask for persistent storage:** call `navigator.storage.persist()` when the bag first gets a tile.
- **Backup:** add a Settings item, "Back up / restore progress": a file containing settings, progress, custom decks and the bag.
- **Reset progress:** name the bag explicitly and require a second confirmation.
- **Known limit:** iOS may still clear a home-screen web app's storage when the device is short of space. A native wrapper later would remove this; the backup file is the v1 answer.
- **Tampering:** local data is editable. It's single player with no server, so ignore it.

## 10. Data shapes

```ts
type StorfhocalProgress = {
  finishedSoloGames: number;
  bagRevealed: boolean;
  owned: Record<string, number>;                 // word id -> count
  seen: Record<string, { times: number; last: string }>;   // phrase id -> seen laid
  lostByPlayer: string[];                        // word ids lost to bots, not since regained
  history: { date: string; gained: string[]; lost: string[] }[];   // last 50 games
};
// In game state:
//   storfhocal: { on: boolean; pouch: Record<playerIdx, string[]>; botCarry: Record<playerIdx, { word: string; target: number; laid: boolean }> }
//   table card kind "S": { word, owner, phrase (id used) }
```

## 11. Engine changes

- Card kind `S`. `legalMoves` adds stórfhocal lines:
  - for a human, from the pouch;
  - for a bot, its carried word once its target turn has passed.
- Generalise line validation: a line is a verb plus pattern tokens, ending either with a meaning card (regular) or with nothing (stórfhocal). `canPlay()` in `reference/storfhocal/opportunities.js` shows the placement check against the reference engine.
- `settleStorfhocail()` as in §6.

## 12. Acceptance

- **Legality:**
  - a phrase not on the tile is refused;
  - tokens in the wrong order are refused;
  - a wildcard as the tile is refused;
  - a line through a river particle already down is accepted;
  - a line through a stórfhocal is refused;
  - particle-then-tile phrases (*tabhair le fios*, *tabhair faoi deara*) work in all four directions;
  - hidden mode refuses a wrong attempt with the usual penalty.
- **Settlement:** every row of the table in §6, including quit before and after laying a tile.
- **Unlock and visibility:**
  - the toggle is hidden at 19 finished solo games and shown at 20;
  - it is hidden in pass-and-play;
  - the bag stays hidden until the first tile, and stays visible after the last is lost.
- **Bots:** with the carry chance forced to 1 and a fixed seed:
  - the bot lays its word no earlier than its target turn;
  - it never lays more than one;
  - non-Hard bots never carry one.
- **Glossary:** a phrase appears only once it has been laid or its tile is owned.
- **Data test:** every phrase uses only verbs and particles from `deck.json`, and no stórfhocal meaning repeats a regular meaning.
