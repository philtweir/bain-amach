# Stórfhocal

The collectable word tile: a fixed word (*aire*) that completes a phrase (*tabhair aire do*) and makes a line with no meaning card. Its finish is Opal: a pearl face washed with five pastel tones inside an iridescent foil rim. It is the only thing on the table that moves, which is what lifts it clear of the paper meaning cards.

**Markup:** a tile on the table is `<div class="ba-card ba-table ba-sf"><span class="ba-word">aire</span></div>`, with `ba-v` on a vertical line and `ba-l` / `ba-xl` on long words like any card. In the hand it is wide like a meaning card: `.ba-sf.ba-sf-wide` holding a `.ba-sf-head` (the word and a `.ba-sf-pos` label, "noun" or "adj") and one `.ba-sf-ph` per phrase (`.ba-ga` Irish, `.ba-en` English; `.ba-ga.is-hidden` when answers are hidden). One or two `<i class="ba-tw"></i>` add twinkles.

**Notches:** two pointed notches on the ends of its line, in `sf-notch`, so it differs in shape from adverbs (square) and prepositions (round).

**Motion:** the wash drifts over 10s (alternate), the rim turns every 8s, a glint crosses every 6s, twinkles pulse over 4s. Slow on purpose: it sits in the corner of the eye without pulling focus. Reduced motion: everything still, rim 3px.

**States:** the usual `is-lit`, `is-selected`, `is-fresh`, `is-dim`; plus `is-unusable` for a tile the current deck can't complete, shown greyed in the bag sheet with its reason beside it.

**Zoomed out:** under `.ba-zoomed` the word gives way to a four-point star, the rim thins to 1.5px, and the shimmer keeps running, so it is still the tile you spot first.

**Stake chip:** `.ba-stake` in the status strip shows the tiles laid this game, each followed by an `.ba-by` dot in the colour of whoever laid it.

**Line made:** `.ba-made.ba-made-sf` adds foil rays, a `.ba-kicker` ("Stórfhocal"), the tile itself, and a `.ba-keep` line when a bot laid a tile the player doesn't own ("Win this game to keep it").

**Don't:** use the foil or pearl tokens on anything else; put the tile in the river or the hand deck (it comes only from the player's bag or a Hard bot); or let it pass under another line: nothing threads a Stórfhocal.
