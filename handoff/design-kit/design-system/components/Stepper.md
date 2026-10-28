# Stepper

A count with − and + either side, for tile counts and the meaning-card total in the deck editor.

**Markup:** `<div class="ba-stepper" role="group" aria-label="cuir"><button class="ba-dec" type="button" aria-label="One fewer cuir"></button><output>6</output><button class="ba-inc" type="button" aria-label="One more cuir"></button></div>`.

**Behaviour:** each button is a 44px target. − is disabled at the minimum (0 for tiles); + at the maximum. Holding a button repeats after 400ms. The count uses tabular numerals so the row doesn't shift.

**Beside it:** when a deck's count differs from Standard, show "Standard 2" in `ink-muted` to the left, so a change is visible at a glance.

**Don't:** use it for values with no natural step, or let the count be typed: the steppers are quick and can't produce a bad value.
