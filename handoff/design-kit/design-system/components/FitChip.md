# FitChip

Shows which player counts a custom deck can serve, live as the deck changes. Sits in the deck editor's summary card and the deck picker.

**Markup:** `<span class="ba-fit is-ok">2 players</span>` or `<span class="ba-fit is-no">3 players</span>`, in a `role="list"`.

**States:** `is-ok` is a filled chip with a tick; `is-no` is a dashed chip with a cross. Shape and icon carry the meaning, never colour alone.

**Always with a reason:** any `is-no` chip needs a plain line nearby saying what is missing ("3 players needs 5 more verbs or wildcards"). Setup only offers the player counts a deck can serve.
