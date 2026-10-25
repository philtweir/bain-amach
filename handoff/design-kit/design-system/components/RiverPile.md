# RiverPile

One of the five face-up particle piles: the top card at river size, the pile edge behind it, and the count left below.

**Markup:** `<div class="ba-pile"><div class="ba-stack"><div class="ba-card ba-river ba-adverb"><span class="ba-word">suas</span></div></div><span class="ba-left">8</span></div>`. Empty pile: `ba-pile is-empty` with an empty stack and `0`.

**Use:** five in a row under the status strip (phone) or down one side (tablet). Tap a top card to add it to the line being built. Lit with `is-lit` when it completes the selected line.

**Stall:** each pile's top card slides under over `dur-stall`, then the new top fades in. Reduced motion: crossfade only.
