# Bain Amach: v1.2 handoff (delta)

This kit assumes **v1.1 is built**: commit `faa5d6a` on `claude/gifted-bell-4sxvja`, with Stórfhocal and the deck editor. It holds only what is new or changed. Don't rebuild anything else.

Read in this order:

1. `docs/changes-v1.2.md`: every change, where it lives in the v1.1 code, and how to tell it's done. **It wins over everything else here.**
2. `code/`: two ready patches and one regression test (below).
3. `screens/renders/`: the new and changed screens, 2x PNG, numbered.
4. `design-system/CHANGES.md`, then the two new component docs.

## What's in this kit

| Folder | Contents |
| --- | --- |
| `docs/changes-v1.2.md` | The spec for this round |
| `code/0001-Release-and-test-channels-on-one-Pages-site.patch` | Release at `/bain-amach/`, test build at `/bain-amach/main/`: workflow, Vite config, storage prefix, test icons. Verified on a local two-channel build |
| `code/0002-Original-deck-the-first-deck-built-in-beside-Standar.patch` | The Original deck built in beside Standard, with tests |
| `code/storfhocail.cross.test.ts` | Regression test: a Stórfhocal line's particle can be crossed. Put it in `src/engine/` |
| `design-system/` | Replacement `tokens.css`, `tokens.json`, `components.css`; `CHANGES.md`; Ticker and TestStamp docs, previews and preview PNGs |
| `icons-test/` | The stamped icon set (also inside patch 0001, as `public/icons-test/`) |
| `screens/renders/` | 15 renders: 9 new screens, the sorted glossary, and 4 screens whose copy changed |
| `screens/board-source/` | The design board's source for those screens, plus `canvas.json`. Reference only: they need the board runtime |

## Applying it

```
git checkout -b v1.2 claude/gifted-bell-4sxvja
git am code/0001-*.patch code/0002-*.patch
cp code/storfhocail.cross.test.ts src/engine/
```

Both patches apply cleanly to `faa5d6a`; unit tests pass (98) and `tsc` is clean. Then copy `design-system/` over the kit's design system, and build the rest of `docs/changes-v1.2.md`.

## Before the first deploy (Phil, on GitHub)

1. Rename the default branch `claude/gifted-bell-4sxvja` to `main` (Settings → General → Default branch). Agent branches then merge into `main`.
2. Settings → Environments → `github-pages` → Deployment branches and tags: add a tag rule `v*`. Without it, tag pushes are refused.
3. After merging, tag the first release: `git tag v1.2.0 && git push origin v1.2.0`. The workflow refuses any tag from before the channels existed.

Until a tag exists, the release slot gets a build of `main` and the run shows a warning.

Live sources if anything here drifts:

- Feature plan (doc), section "v1.2": https://claude.ai/artifact/8ZCcNcKiSkimGYcx8vuJyo
- Design system: https://claude.ai/artifact/JuW6kkNhJFYBaXAZ4J1bHp
- Screens board, row "Playtest fixes and test builds (v1.2)": https://claude.ai/artifact/HkrC2BbKJHn4zswFcT9oDY
