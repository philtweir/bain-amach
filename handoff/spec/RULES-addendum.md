# RULES.md addendum (v1.1)

Append these sections to `spec/RULES.md`. They change nothing in §1–10 for a default-deck game with stórfhocail off.

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
