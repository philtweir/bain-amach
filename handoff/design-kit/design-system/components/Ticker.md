# Ticker

One line that loops when it holds more than fits. Used for a meaning with more than one answer on a meaning card in the hand (GIVE UP: *éirigh as*, *tabhair suas*), and for a Stórfhocal phrase too long for its tile.

**Markup:** `<span class="ba-ga ba-ticker" aria-label="éirigh as, or tabhair suas"><span class="ba-tick" aria-hidden="true"><span class="ba-run"><span>éirigh as</span><span>tabhair suas</span></span></span><span class="ba-more" aria-hidden="true">+1</span></span>`. The items are separated by a middle dot drawn in CSS.

**Behaviour:**
- Measure after layout. If the run fits, leave it still: everything shows with dots between.
- If it overflows, copy `.ba-run` once more inside `.ba-tick`, set `--tick-dur` to the run's width ÷ 32px a second, and add `is-running`. It holds at the start for a moment, then laps once, seamlessly.
- Add `is-paused` while the card is picked up or dragged, and while the lane is off screen (IntersectionObserver).
- Never on table cards, river cards or the zoomed-out table: those show the printed answer only.
- Reduced motion: no movement; the first item and a `+1` chip.
- The accessible name lists every item ("éirigh as, or tabhair suas"); the moving copy is hidden from screen readers.

**Don't:** use it for prose, for anything the player must read in a hurry, or for more than three items. If a line regularly overflows by a lot, the card needs another layout.
