# Design system changes in v1.1

Drop-in replacements for the v1 kit's `design-system/` files. Copy this folder over the v1 one; nothing is removed, so v1 screens look exactly as before (one dark-theme fix aside, below).

## tokens.css / tokens.json

12 new colour tokens, the same value in both themes because tile faces are physical objects:

| Token | Use |
| --- | --- |
| `sf-pearl-1` … `sf-pearl-5` | The Stórfhocal face wash: rose, cream, mint, sky, lilac |
| `sf-foil-1` … `sf-foil-5` | The iridescent foil rim, always all five together |
| `on-sf` | Word, phrases and glyph on the tile |
| `sf-notch` | The tile's pointed notches |

## components.css

Appended at the end; nothing above it changed except one rule (see Fixes).

| New classes | What | Docs |
| --- | --- | --- |
| `.ba-sf`, `.ba-sf-wide`, `.ba-sf-head`, `.ba-sf-pos`, `.ba-sf-ph`, `.ba-tw`, `.ba-sf.is-unusable` | The Stórfhocal tile at every size, its motion, notches, glint, twinkles and states | `components/Storfhocal.md` |
| `.ba-stake`, `.ba-by` | The stake chip in the status strip | `components/Storfhocal.md` |
| `.ba-made-sf`, `.ba-kicker`, `.ba-keep` | The Stórfhocal version of the line-made moment | `components/Storfhocal.md` |
| `.ba-stepper`, `.ba-dec`, `.ba-inc` | Count with − and + | `components/Stepper.md` |
| `.ba-fit.is-ok`, `.ba-fit.is-no` | Which player counts a deck serves | `components/FitChip.md` |

It also registers `@property --sf-a` (the rim's turning angle). Browsers without `@property` show a still rim; nothing else breaks.

## Fixes that touch v1

- `.ba-made .ba-progress` (the "15 of 36 compounds made" line under a new compound) used `ink-muted`, which turns pale in the night theme while the card stays paper. It now uses a fixed dark ink. Same fix applied to the new `.ba-kicker` and `.ba-keep`.

## brand-book.md

One added line under Colour: the Opal finish and that pearl and foil are used nowhere else.

## Also new

- `icons/cards/storfhocal.svg`: the four-point star used when the board is zoomed out.
