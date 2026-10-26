# Bain Amach (working title)

An offline-first card game for practising Ulster Irish compound verbs, built as an installable web app.

- `handoff/`: the build brief, rules, deck data, reference engine and the design kit. Start with `handoff/CLAUDE.md`.
- `docs/DECISIONS.md`: where the handoff documents disagree and what was built. **Read this before playtesting.**

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/ (service worker included)
npm run preview      # serve dist/ on :4173 to try install and offline
```

## Tests

```sh
npm test             # engine unit tests and move-for-move parity with the reference engine
npm run test:stats   # 300 seeded bot games per player count (about a minute)
npm run e2e          # Playwright: full game to recap, reload then Continue, offline, axe checks
```

## Layout

```
src/engine/    rules, legal moves, bots, line-builder queries. Pure TS, serialisable state
src/game/      controller: turn loop, race loop and bot timers, pass-and-play, feedback
src/ui/        board (pan/zoom), table, tray, navigation stack, screens, tutorial
src/storage/   settings, glossary progress, saved game (localStorage, versioned)
src/i18n/      en.json, ga.json (Irish default; missing keys fall back to English)
src/platform/  haptics, storage, wake lock: swap this file for a native wrapper later
```
