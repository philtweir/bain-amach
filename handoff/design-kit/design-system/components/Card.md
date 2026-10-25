# Card

A square tile for a verb, adverb, preposition or wildcard, at hand (76px), river (60px) or table (64px) size. Notches on the edges show where lines join: four square notches on a verb, two square on an adverb, two round on a preposition, two square plus a dashed border on a wildcard.

**Markup:** `<div class="ba-card ba-verb"><span class="ba-word">cuir</span></div>`. Type class: `ba-verb`, `ba-adverb`, `ba-preposition`, `ba-wild`. Size class: none (hand), `ba-river`, `ba-table`. Add `ba-v` when a particle or wildcard lies on a vertical line; the notches move to top and bottom and the word stays upright. The type glyph appears only in zoomed-out glyph mode, where words are hidden.

**States:** `is-fresh` (just laid: gorse ring and halo, fades over 600ms), `is-selected` (lifted 8px, thin ink ring), `is-lit` (thin `lit` ring with a pulsing halo: can complete the line), `is-dim` (washed out but opaque: can't be used now), `is-shake` (impossible play, 320ms). Keyboard focus draws the `focus` ring.

**Markers:** `<i class="ba-cross"></i>` on a particle shared by two crossing lines; it sits in the top-right corner, clear of the word. `<i class="ba-own ba-p2"></i>` for the player who laid it (recap only).

**Wildcard:** in the hand, `<span class="ba-star"></span>`; on the table, the particle it stands for in `<span class="ba-stands">as</span>`.

**Do:** give every card an accessible label naming type and word ("Preposition: faoi"). **Don't:** colour a card outside its family, or put two words on one card.

**On the board:** cards sit in a `ba-board` on a 66px pitch (64px card, 2px gap). Placement targets are `ba-ghost`, the suggested one `ba-ghost is-suggested`. Below 32px a cell, add `ba-zoomed` to the board: words hide and the type glyph centres. A target another racer took shows `is-taken` for 600ms, then fades.
