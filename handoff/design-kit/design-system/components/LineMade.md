# LineMade

The reward when a line is laid: the compound pops large in Irish over the board, holds, then settles into the compound toast.

**Timing:** `dur-celebrate` (640ms) in total: 160ms in on `ease-snap`, 320ms hold, 160ms out into the toast. It never blocks input; the next tap dismisses it at once. Strong haptic where available. Reduced motion: no rays, a 120ms fade in and out.

**First time:** the first time a player ever makes a compound, add `<span class="ba-new">New</span>` and the glossary count under the meaning. That is the game's progression: no points, no streaks.

**Markup:** `<div class="ba-made" role="status"><div class="ba-ga">cuir síos ar</div><div class="ba-en">Describe</div></div>`. Screen readers hear the toast's announcement, not this.

**Don't:** show it for a bot's line (bots get the toast only), or stack two.
