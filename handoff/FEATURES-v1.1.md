# v1.1 brief: deck editor and Stórfhocail

This zip adds two features to the **existing, built** app. It holds only new material. Unzip it over the original handoff folder: the paths (`spec/`, `data/`, `reference/`) line up with it, and no existing file is replaced.

**Before writing code, read the existing codebase** and follow its structure, naming, state management, storage wrapper and i18n setup. The original `CLAUDE.md` rules all still apply: no colour-only information, Irish-first bilingual strings, reduced motion, offline, deck as data. "Hard bot" means the app's hardest bot level, whatever it is called in the code.

## Contents

| File | What it is |
| --- | --- |
| `spec/deck-editor.md` | Feature spec: custom decks |
| `spec/storfhocal.md` | Feature spec: stórfhocal tiles, bot behaviour, settlement, the bag, glossary |
| `spec/RULES-addendum.md` | New §11 (custom decks) and §12 (stórfhocail) for `spec/RULES.md`. Append it. |
| `data/storfhocail.json` | **Draft** stórfhocal catalogue (26 words, 28 phrases) + every tuning number |
| `reference/editor/deck-tools.js` (+ test) | Reference meaning-card generator, deck validator, hand-size fitting, deck builder |
| `reference/storfhocal/opportunities.js` | Simulation behind the bot carry/timing design; `canPlay()` shows the placement check |

Run the references from the handoff root (Node, no dependencies): `node reference/editor/deck-tools.test.js`, `node reference/storfhocal/opportunities.js`. Both use the existing `data/deck.json` and `reference/engine/engine.js`.

## Order of work

1. **Engine:** port `deck-tools.js` to TS with its tests. Make the engine take a deck object rather than the bundled `deck.json`, if it doesn't already. Add the hand-size fitting.
2. **Deck editor UI:** Decks screen, Edit deck, the deck picker in setup, Test this deck in a Web Worker, import/export, saved games embedding their deck.
3. **Engine, stórfhocail:**
   - card kind `S` and generalised line validation (terminator: meaning card or none);
   - stórfhocal moves for humans (pouch) and Hard bots (carry and target turn);
   - `settleStorfhocail()`;
   - the tests in `storfhocal.md` §12.
4. **Stórfhocal UI:**
   - the setup toggle (unlock count, Hard-bot requirement);
   - the in-game bag button, picker, warning and pouch slot;
   - the bot bag badge;
   - the recap transfer panel;
   - the bag screen with its three slot states;
   - the glossary section.
5. **Persistence:** the finished-solo-games counter, stórfhocal progress, `navigator.storage.persist()`, Back up / Restore in Settings, and Reset progress naming the bag.

Keep every tuning number in `data/storfhocail.json` → `settings` (unlock count, carry chances, play window, weights, pouch cap). Don't hard-code them: they'll change after playtesting.

## Needs from Phil / design

- **Ulster check of `data/storfhocail.json`:** every word, phrase, meaning and particle is a draft. Expect changes. The data test catches structural problems.
- **The stórfhocal tile's visual design** (a new card family, not gorse, with a shape cue), the bag icon and the bag screen. Until those arrive, use a placeholder style behind a single token.
- **Irish strings** for every new screen and message.
- **Contents of preset decks**, if any.
- **[Decision] items** in `storfhocal.md`: build the defaults as written, each behind a setting or constant, so a change is a one-liner.
