# Feature: deck editor

Players build their own decks: how many of each verb, particle and wildcard; which meanings are in play; how many meaning cards. A teacher can make a short adverbs-only deck for beginners; a fluent player can drop the easy ones.

Reference behaviour: `reference/editor/deck-tools.js` (generator, validator, deck builder) and its test. Port it to TS; match its outputs for the same inputs and seed.

## What the editor can and can't change

- **Can:** copy counts for every verb and particle (0–12 each), wildcards (0–8), the set of meanings, and the number of meaning cards (up to 60).
- **Can't:** add new compounds, meanings or words. The compound list in `deck.json` is the vetted boundary; the editor only selects from it. (Stórfhocail are outside the editor entirely; see `storfhocal.md`.)
- **Can't:** change the rules: river piles, starter verbs, lone-verb draw and meanings in hand stay as in `deck.json`. Hand size is the one thing that adapts (below).

## Rules of a custom deck

- **A meaning is available** when at least one of its compounds is buildable: the verb has a count above 0 and every particle has a count above 0. Wildcards don't count towards being buildable.
- **Compounds in play** are all the buildable compounds of the selected meanings. GIVE UP with only *éirigh* in the deck answers only *éirigh as*. The meaning card shows only the answers this deck can make.
- **Meaning cards are generated**, not hand-picked. Each card shows 3 different meanings. Each meaning's number of appearances is proportional to its buildable compounds (the default deck: 3 each, GIVE UP 6). No card shows two meanings that share a verb, unless that's impossible, in which case the editor warns. Generation is seeded: the same settings and seed give the same cards, and "Reshuffle cards" picks a new seed.
- **Hand size shrinks to fit.** The base hand size for each player count drops one card at a time until the verbs and wildcards (less the starter verbs) can deal every hand in full. Below 7 cards, that player count is unavailable for the deck. The deal stays honest: never deal short hands.
- **One count set for all player counts.** The default deck's 3–4 player verb pack doesn't exist for custom decks. "Start from default" offers the 2-player or 3–4-player counts as the starting point.

## Validation

Validation runs live as the player edits. `validateDeck()` returns three things:

- **Errors**, which block saving. Fewer than 4 different verbs; fewer than 3 meanings; too few meaning cards for each meaning to appear once; fewer particles than river piles; more than 60 meaning cards; or no player count dealable.
- **Warnings**, which allow saving but say why the deck may play badly:
  - selected meanings that the counts can't make (they're dropped);
  - verbs no chosen meaning uses (they can only be laid alone);
  - particles no chosen meaning uses (they clog the river);
  - a particle under half as common in the river as the chosen lines need it;
  - cards showing two meanings with the same verb.
- **Per player count (2, 3, 4):** whether it's dealable, the hand size, or why not.

**Test this deck** runs 50 seeded bot-vs-bot games for a chosen player count in a Web Worker, which takes about 2 s. It reports:
- lines per game;
- how often someone goes out;
- stalls per game;
- any game that doesn't finish.

Flag these results:
- under 12 lines per game: "games will be short";
- under 15% going out: "games usually end on card count";
- any unfinished game: treat as an error.

Reference figures: the default deck gives about 27 lines with 29% going out (2p). An adverbs-only learner deck of 17 verbs, 22 particles and 18 meaning cards gives about 16 lines with 26% going out at 2p, with hands of 11.

## Screens

- **Decks** (from Home, and a "Deck" row in game setup):
  - the list of decks, with Default at the top, locked;
  - per deck: Duplicate, Edit, Rename, Delete (with confirm), Export (a `.json` file plus a share sheet), Import (file picker, validated before it's saved);
  - each row shows the card total and the player counts it supports.
- **Edit deck:** sections in this order. A sticky summary bar shows the total cards, ✓/✗ for 2, 3 and 4 players, and the error and warning counts; tapping it opens the details.
  1. **Verbs:** a stepper per verb. Each shows how many selected meanings use it.
  2. **Particles:** grouped as adverbs, then prepositions. Steppers, each showing its share of the river and its share of demand.
  3. **Wildcards:** a stepper.
  4. **Meanings:** checkboxes grouped by verb, each showing its compound(s); "All" and "None" per group and overall.
     - When a count change makes a meaning unavailable, it greys out with the reason ("needs *síos*") and is deselected. If the count comes back, it is reselected. Remember the player's last choice for each meaning.
     - In hidden-answers mode the editor still shows the compounds. It is a setup screen, not play.
  5. **Meaning cards:** a stepper, with "each meaning appears about ×N". Preview the generated cards, plus a "Reshuffle cards" button.
  6. **Test this deck**, then Save.
- **Game setup:** a deck picker. Player-count options the deck can't deal are disabled, with the reason. Hand size shows when it differs from the default.
- **Presets** are worth shipping but need Phil's choice of contents, e.g. "First steps" (adverbs only) and "No easy ones". Build presets as locked custom decks.

## Data and storage

```ts
type CustomDeck = {
  id: string; name: string; createdAt: string; updatedAt: string;
  baseVersion: string;              // deck.json version it was made against
  verbs: Record<string, number>; particles: Record<string, number>; wildcards: number;
  meanings: string[];               // selected glosses (stored even if currently unavailable)
  meaningCards: number; seed: number;
  generated: { id: string; meanings: string[] }[];   // stored, so a generator change never alters a saved deck
};
```

- **Store:** custom decks go in local storage next to settings and progress, and are included in any backup and export.
- **Saved games:** a saved game embeds the full built deck. Editing or deleting a deck never breaks a game in progress.
- **Glossary progress** stays keyed by compound id and covers every deck.
- **When `deck.json` changes** (after the Ulster check), on load:
  - drop selected meanings that no longer exist and tell the player once ("2 meanings were removed from the word list");
  - leave new meanings unselected;
  - regenerate cards only if the selection changed.
- **Import:** reject a deck with unknown words, or show what was dropped. Validate the same way as when saving.

## Acceptance

- `deck-tools.test.js` ported to Vitest and passing:
  - the default settings rebuilt through the editor give 36 cards, each meaning on 3 cards (GIVE UP 6), no verb clashes, and the same cards for the same seed;
  - the broken and starved decks are caught;
  - the adverbs-only deck deals hands of 11 at 2p.
- Bot games on any deck the validator accepts finish (no hangs). Fuzz it: 200 random valid settings × 20 games each.
- A game started with a custom deck, saved, deck then deleted, game resumed: plays on unchanged.
- Export → import round-trips to an identical deck.
