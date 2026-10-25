# PlayerAvatar

A player or bot chip: colour disc with pattern and initial, plus hand count.

**Markup:** `<span class="ba-avatar ba-p2"><span class="ba-disc">B</span><span class="ba-cnt">11</span></span>`. Player class `ba-p1` to `ba-p4` sets colour and pattern.

**States:** `is-turn` (ring and underline in the player colour; turn mode), `is-playing` (disc pulses while a bot lays a line), a `<span class="ba-tag">Stuck</span>` in race mode when that player has declared stuck.

**Do:** always show the initial; pattern and initial carry identity without colour. **Don't:** hide the count.
