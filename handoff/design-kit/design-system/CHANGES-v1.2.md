# Design system changes, v1.2

Replace `tokens.css`, `tokens.json` and `components.css`. Fonts are unchanged.

## New token

- `stamp`: `#a3221d` light, `#ff8f80` night. Only for the IN TEST stamp. Contrast is 4.8:1 on the day felt and 8:1 on the night felt.

## New components (appended to components.css)

- **Ticker** (`.ba-ticker`): one line that loops when it holds more than fits. See `components/Ticker.md`. It needs a few lines of JS: measure, duplicate the run, set `--tick-dur`, add `is-running`, and add `is-paused` while the card is picked up or off screen.
- **Test stamp** (`.ba-stamp`): see `components/TestStamp.md`.

## Fix to v1.1 (in the app's own CSS, not this file)

- `src/styles/app.css` has `.ba-sf-wide .ba-sf-ph:nth-of-type(n + 3) { display: none; }`. `nth-of-type` counts the head span too, so the rule hides the **second** phrase. Two-phrase tiles (*greim*, *fios*) show one phrase. Use `.ba-sf-wide .ba-sf-ph ~ .ba-sf-ph ~ .ba-sf-ph { display: none; }`. Two phrases fit the hand tile (see render 02).
