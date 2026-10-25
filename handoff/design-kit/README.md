# Bain Amach: design handoff

Everything needed to build the installable web app from the agreed design. "Bain Amach" is a working title; the wordmark is a placeholder until the game is named.

Read in this order:

1. `docs/handoff-v2.md`: the spec. Rules, screens, interactions, PWA requirements. **Where anything else disagrees with it, the spec wins.**
2. `screens/renders/`: every screen and state, 2x PNG, numbered in flow order.
3. `docs/behaviour-notes.md`: the board's annotations, one block per screen (what each state does, not just how it looks).
4. `design-system/brand-book.md` and `design-system/components/*.md`: tokens, components and usage rules.

## What's here

| Folder | Contents | Use it for |
| --- | --- | --- |
| `docs/` | `handoff-v2.md` (spec), `behaviour-notes.md` | What to build and how it behaves |
| `design-system/` | `tokens.json`, `tokens.css`, `fonts.css`, `components.css`, `brand-book.md`, `components/*.md`, `previews/*.html` and `previews/png/` | Drop-in CSS and the source of truth for every value |
| `fonts/` | Bricolage Grotesque (variable) and Atkinson Hyperlegible, woff2 plus ttf, with OFL licences | Self-hosting; the app must work offline, so no Google Fonts at runtime |
| `icons/cards/` | Card-type glyphs: verb, adverb, preposition, wildcard, meaning | Zoomed-out board, legends, rules screen |
| `icons/ui/` | 14 line icons, 24px grid, 2.4px stroke, `currentColor` | Buttons, toasts, the board's fit control |
| `textures/felt-grain.svg` | The table's felt grain tile (alpha mask) | Already inlined in `components.css` as `--table-grain`; here for reference |
| `app-icon/` | SVG masters (standard, maskable, monochrome), PNGs 48–1024, apple-touch-icon, `manifest.webmanifest`, `head-snippet.html` | PWA install |
| `splash/` | iOS startup images, light and dark, four device sizes, plus the HTML template that made them | `apple-touch-startup-image`; regenerate for other sizes from the template |
| `screens/renders/` | 40 board PNGs at 2x | Visual reference per screen and state |
| `screens/table-example.html` | The game table as plain static HTML using only this kit's CSS | A working example of the card, river and tray classes with no runtime |
| `screens/board-source/` | The board's `.dc.html` files and `canvas.json` | Exact markup and inline values for each screen (see note below) |

## Wiring up the CSS

```html
<link rel="stylesheet" href="design-system/fonts.css">
<link rel="stylesheet" href="design-system/tokens.css">
<link rel="stylesheet" href="design-system/components.css">
```

- Load order matters: fonts, tokens, components.
- Theme: set `data-theme="light"` or `"dark"` on `<html>`. Follow `prefers-color-scheme` by default; Settings can override.
- Every colour, size, radius and duration is a CSS custom property from `tokens.css`. `tokens.json` holds the same values for TS (deck rendering, animation timings, bots' pacing).
- Classes use the `ba-` prefix. Cards: `ba-card` plus a type (`ba-verb`, `ba-adverb`, `ba-preposition`, `ba-wild`, `ba-meaning`), a size (none = hand, `ba-river`, `ba-table`) and states (`is-lit`, `is-selected`, `is-dim`, `is-fresh`, `is-taken`, `is-shake`). `ba-v` turns a card's notches for a vertical line. Long words take `ba-l` (5–6 characters) or `ba-xl` (7+). The previews show every combination.
- Reduced motion: `components.css` has three `prefers-reduced-motion` blocks (cards, avatar pulse, LineMade rays). Settings also offers "always on", which the CSS doesn't handle yet: duplicate those three rules under a root class such as `.ba-reduce-motion`. JS-driven flights and riffles follow `brand-book.md` → Motion (120ms fade in place).

Splash, render and preview PNGs are palette-quantised (256 colours, dithered) to keep the kit small; the felt grain hides any banding. App icons are lossless. Regenerate full-colour splashes from `splash/splash-template.html` if you see artefacts on a device.

## About `screens/board-source/`

These files were authored in the design board's own format: `<x-dc>` templates with `sc-for` / `sc-if` and `dc-import` composition, which need the board runtime and won't render in a plain browser. Treat them as a reference for markup, inline spacing and scene data (`GameTable.dc.html` holds every table state as a `scene` switch). Don't port the templating; build components in your framework against `components.css`. The renders in `screens/renders/` are exactly what these files produce.

The live versions are the source of truth if anything here drifts:

- Spec (doc): https://claude.ai/artifact/SvCd28FFwuWfwJoh4NwV5G
- Design system: https://claude.ai/artifact/JuW6kkNhJFYBaXAZ4J1bHp
- Screens board: https://claude.ai/artifact/HkrC2BbKJHn4zswFcT9oDY

## Not in this kit, or not final

- **Name.** Wordmark, manifest `name`/`short_name` and splash text are placeholders. Re-run the splash template and re-export the icons only if the name lands on the icon (it currently doesn't).
- **Compound list.** Preview words come from common compounds; the final list waits on the Ulster check. Deck data is JSON generated from the card-list spreadsheet (see spec → Implementation notes), not from these designs.
- **Irish UI copy.** Screens show English (with Irish where it's fixed, e.g. language choice). Every text slot is sized for Irish running about a third longer; Phil supplies the strings.
- **Five rules added in review** are designed in but still to be confirmed (spec → Deliverables and open questions → "Added in review, confirm").
- **Sound.** Out of scope for v1. Haptics are specified in the motion notes and are optional by design.
