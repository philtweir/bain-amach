# Button

Actions, the hand tray's play bar, and segmented setup controls.

**Variants:** `ba-btn-primary` (one per view: Lay it, Play, Continue), `ba-btn-secondary` (Lay alone, Draw and pass), `ba-btn-quiet` (Rules, Skip), `ba-btn-stuck` (race mode toggle, `aria-pressed`). Disabled: the `disabled` attribute, plus a one-line reason nearby.

**Costs on the button:** a play that draws cards says so on the button: "Lay alone · draw 2". No confirmation dialog follows.

**Lockout:** after a wrong line in race mode the primary button shows a draining `ba-ring` and "Wait 2s" for 3 seconds.

**Segmented control:** `ba-seg` with `aria-pressed` buttons, for Mode, Answers and Hints on the setup screen.
