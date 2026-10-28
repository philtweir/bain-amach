Bain Amach is a fast card game for Ulster Irish compound verbs, for teenagers learning and fluent speakers playing to unwind. It should feel like a well-made physical deck: big, chunky tiles that snap, read at a glance, and reward every line laid. Fun, but quick and calm, never a slot machine. The Irish is the hero; English supports it. The same card faces print on the physical deck.

"Bain Amach" is a working title. The wordmark is set in plain type until the game is named.

## Voice

- Write UI copy short and direct, in the second person: "Pass to Siobhán", "Lay alone · draw 2", "No *suas* in the river".
- Every string exists in Ulster Irish and English. Irish is the default. Design every text slot for the Irish to run about a third longer than the English.
- Irish words on cards and in toasts are set in `answer` or the `card-*` styles; English glosses in `caption` or `meaning`, never larger than the Irish.
- Refusals say what was wrong in one line, without apology: "*cuir* doesn't take *faoi*", "*cuir suas le* isn't on this card".
- No emoji, no exclamation marks, no praise ("Great!", "Perfect!"). A completed line shows the compound and its meaning; that is the reward.

## Colour

- The app sits on `table`, sea-green baize, always with the felt treatment (`ba-felt`): a lamp-pool glow (`table-glow`) that draws the eye to the middle, and a fine felt grain (`table-grain`): soft noise with no lines or shapes to catch the eye. The river sits in a sunken channel (`river-bed`); the board itself has no grid; cards and ghost targets show where things go. Texture, never information. Panels use `surface`; toasts and dialogs `surface-raised`. Text is `ink`, secondary text `ink-muted`.
- Cards are physical objects: their faces keep the same colours in both themes. Only edges (`*-edge`) and shadows adapt, so a card separates from the dark table.
- Five card families, each also told apart by notches (and a glyph in the hand) so colour is never the only cue:

| Card | Face | Ink | Notches (where lines join) | Glyph (zoomed out only) |
| --- | --- | --- | --- | --- |
| Verb | `verb` (gorse) | `on-verb` | four square, `verb-notch` | hub: a ring with four spokes |
| Adverb | `adverb` (deep heather) | `on-adverb` | two square on the line's ends, `adverb-notch` | arrow |
| Preposition | `preposition` (pale heather) | `on-preposition` | two round on the line's ends, `preposition-notch` | open bracket |
| Meaning | `meaning-paper` | `meaning-ink`, `meaning-answer` | none | none; the card is wide in the hand |
| Wildcard | `wild` | `on-wild` | two square plus a dashed border | asterisk |

- Gorse and heather, the colours of the hills. Particles share heather: adverbs deep, prepositions pale, so they differ in lightness as well as notch shape. Notches are tone on tone, a detail rather than a clamp.

- Buttons use `action` / `on-action`, which is ink, not a card colour, so a button never reads as a card. Buttons share the cards' thickness: a 4px edge underneath that presses down 2px on tap.
- `lit` rings targets that complete the selected line (shown-answers mode only). `focus` rings keyboard focus. Both sit outside the card, after a 2px gap in the ground colour, so they reach 3:1 against any card face.
- A wrong line in play gets the soft toast ("Not quite"), in ink. `alert` / `alert-soft` are only for real errors such as a failed save, always with an icon and words.
- Players are `player-1` to `player-4` (rust, lough blue, moss, rose), always paired with a pattern (solid, stripes, dots, chevrons) and an initial.
- The Stórfhocal tile has its own finish, Opal: a pearl face washed with `sf-pearl-1` to `sf-pearl-5` inside an iridescent rim of `sf-foil-1` to `sf-foil-5`, with `sf-notch` pointed notches. It is the one thing on the table that moves (a slow drift, a turning rim, a glint), which is how it stands out from paper meaning cards without a new hue. Pearl and foil are used nowhere else.
- Never use green-white-orange, shamrocks, harps, knotwork or pseudo-uncial lettering.

## Type

- Card words and the wordmark: Bricolage Grotesque, extra bold, opsz axis at its small end. Fadas on *síos*, *ó*, *éirigh*, *éist*, *fág* stay clear at the 12px `card-table` size; test any replacement face at that size.
- Interface and English: Atkinson Hyperlegible, chosen for character distinction at small sizes and for readers learning.
- Counts use `count` with tabular numerals.

## Cards and sizes

- Three sizes: `card-hand` 76px (meaning cards `card-meaning-w` × `card-meaning-h`, 200 × 116), `card-river` 60px, `card-table` 64px at 100% board zoom. Radii follow: `radius-card-lg`, `radius-card-md`, `radius-card-sm`. Words are 22, 18 and 16px.
- The board opens on the area around the latest play rather than the whole table, and follows play. Zoom runs from 26px to 96px a cell; below 32px the word gives way to the type glyph.
- On screen a card's word is set once, always upright, even on a vertical line; the notches turn instead. Print repeats the word on all four sides.
- A meaning card in hand is wide and shows its three meanings, English capitals above, Irish answer below at 16px. With answers hidden, each answer is a dotted rule. On the table and the face-up pile it is square and shows one meaning.
- A particle shared by two crossing lines carries a small ink diamond (the crossing marker). A placed card carries its player's corner triangle, used only by the recap.
- States are a thin 2.5px ring at the card's own edge plus a soft halo, never a thick outline: `ink` when selected (lifted 8px), `lit` with a pulsing halo when it can finish the line, `verb` (gorse) just after it is laid. A card that can't be used washes out to grey but stays opaque.

## Space and shape

- Spacing steps: `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16, `space-6` 24, `space-8` 32. Screen gutters are `space-4` plus the safe-area inset.
- Touch targets are at least `touch-min` (44px) in the hand tray, river and controls. Table cards can be smaller at low zoom; a tap there picks the nearest valid target.
- Buttons are `control-height` (52px) with `radius-control`; segmented controls 44px. Nothing read during play is under 14px. Sheets and dialogs use `radius-sheet` on their top corners.

## Motion

- Quick and physical: cards snap (`dur-snap`, `ease-snap`), fly into place (`dur-place`), and bots lay lines card by card at `dur-bot`. Every line the player lays gets the LineMade moment (`dur-celebrate`): the compound large in Irish, gorse rays behind, then it settles into the toast. The first time a compound is ever made it is marked New; that is the game's only progression, so there are no points or streaks. The river rotates on a stall over `dur-stall`. Lit targets pulse over `dur-pulse`.
- Never slow enough to cost a race. Under reduced motion, every flight and riffle becomes a 120ms fade in place, and pulses become a static ring. No information is carried by motion alone.
- Haptics are a bonus: light on placement, stronger on a completed line. iOS web apps get none, so nothing may depend on them.

## Iconography

- Line icons on a 24px grid, 2.4px stroke, round caps. One glyph per card type, drawn in this system and used on the card and in any legend.
- Toast icons: a struck circle for refusals, a circled mark for "Taken".
- Placeholder words in previews come from common compounds; the final list waits on the Ulster check.
