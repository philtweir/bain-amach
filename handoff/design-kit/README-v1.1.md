# Bain Amach: v1.1 design handoff (delta)

This kit assumes **v1 is already built** from the v1 design handoff. It contains only what is new or changed for two features: the **deck editor** and **Stórfhocal** (collectable word tiles). Don't rebuild anything else.

Read in this order:

1. `docs/feature-plan-v1.1.md`: the spec for both features: rules, decisions, data, build order, tests. **It wins over everything else here.**
2. `screens/renders/`: every new or changed screen, 2x PNG, numbered.
3. `docs/behaviour-notes-v1.1.md`: what each of those screens does.
4. `design-system/CHANGES.md`: exactly what changed in the design system, then the three new component docs.

## What's in this kit

| Folder | Contents |
| --- | --- |
| `docs/` | `feature-plan-v1.1.md` (the spec), `behaviour-notes-v1.1.md` |
| `design-system/` | Replacement `tokens.css`, `tokens.json`, `components.css`, `brand-book.md`; `CHANGES.md`; docs, previews and preview PNGs for Storfhocal, Stepper and FitChip |
| `icons/cards/storfhocal.svg` | The zoomed-out glyph for the new tile |
| `characters/` | Corrected Broc art, five faces (see Things to know) |
| `screens/renders/` | 30 renders: the Stórfhocal tile sheet, 15 Stórfhocal screens, 11 deck editor screens, and the 3 Home states that gained a Decks icon |
| `screens/board-source/` | The design board's source for those screens and the components they import (`GameTable`, `Setup`, `Recap`, `Glossary`, `Home`, `Bag`, `DeckEditor`, `Decks`), plus `canvas.json`. Reference only: they need the board runtime |

## Applying it

- Copy `design-system/` over the v1 kit's `design-system/`. Fonts are unchanged, so `fonts.css` and `fonts/` stay as they are.
- Copy `icons/cards/storfhocal.svg` beside the other card glyphs.
- The new tile is `.ba-card` plus `.ba-sf` and a size class, like any tile; see `design-system/components/Storfhocal.md`.

## Changes to v1 screens (small)

- **Home:** a Decks icon in the top row on every state; the bag entry once a Stórfhocal is owned.
- **Setup:** a Deck row above Opponents with a picker. After 20 finished games, there's also a Stórfhocal on/off group, hidden in pass-and-play.
- **Game table:** a Stórfhocail button in the tray (Stórfhocal games only), the stake chip in the status strip, a wide tile at the start of the meanings lane, the bag sheet, the Stórfhocal line-made and toast, a warning in the pause sheet, and a Stórfhocail block on the result card.
- **Recap:** tile transfers, and a one-off "New: Stórfhocal games" line on the 20th finished game.
- **Glossary:** Stórfhocal phrases sit inline in their verb's group, marked by the tile; only phrases the player has seen appear.
- **Line made, night theme:** the progress line now stays dark on the paper card (a v1 fix; see `CHANGES.md`).

## Things to know

- **Bot characters:** Broc, Corr and Giorria are already built in v1, and these screens use them as they are. Stórfhocal games need a Hard bot, so Giorria is the one who lays and wins tiles. The characters' faces map onto Stórfhocal moments: Pleased when a bot lays a tile, Thinking while it plays, Beaten or Pleased on the result card.
- **Broc fix:** `characters/` holds the five Broc faces with the mask made symmetric. The earlier art had a lopsided left stripe. If your build's Broc came from art made before 26 October, swap these in; Corr and Giorria are unchanged.
- **Placeholders:**
  - The deck counts and the test-with-bots figures are illustrative. Only Standard's 24.5 lines per game and 37% going out come from the simulator.
  - The deck names "Ceachtanna 1" and "Na briathra móra" are placeholders.
  - The bag's "of 28" is illustrative; the slot count is the length of the final list (up to 35).
- **Copy:** English placeholders; Phil supplies the Irish.
- **Still open with Phil:** the Ulster check of the Stórfhocal word list (35 candidates in the plan, all buildable from the Standard deck). Build against the shortlist as data; the final list replaces it.

Live sources if anything here drifts:

- Feature plan (doc): https://claude.ai/artifact/8ZCcNcKiSkimGYcx8vuJyo
- Design system: https://claude.ai/artifact/JuW6kkNhJFYBaXAZ4J1bHp
- Screens board: https://claude.ai/artifact/HkrC2BbKJHn4zswFcT9oDY
