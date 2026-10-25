# Table

The surface everything sits on: sea-green baize (`table`) with a lamp-pool glow (`table-glow`) and a fine felt grain (`table-grain`), the river as a sunken channel (`river-bed`), and the board with no grid at all.

**Markup:** `ba-felt` on the full-screen container (it must be positioned and have `background: var(--table)`); `ba-riverbed` on the river row; `ba-board` (transparent) for the board.

**Why:** plain grey was calm but gave the eye nothing to rest on during long concentration, and contour lines were too sharp. The glow pulls focus to the middle of the board; the grain gives texture with no edges or shapes, so nothing competes with the cards. The table is a mid tone so paper, gorse and heather cards all stand off it, and every card has a 1px edge and a firm shadow.

**Don’t:** animate the grain, put text directly on contour lines without the card or panel behind it, or use the felt behind dialogs and sheets (they stay `surface-raised`).
