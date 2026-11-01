# v1.2: playtest fixes, a rule, test builds and the Original deck

From Phil's playtest notes on 1 November. Each item says where it lives in the v1.1 code (`faa5d6a`) and how to tell it's done. The screens are in `screens/renders/`, and on the board in the row "Playtest fixes and test builds (v1.2)".

Items 9 and 10 are already written: they are patches 0001 and 0002 in `code/`. Everything else is yours.

---

## 1. Glossary order

**Now:** the verb groups are sorted, but within a verb the entries keep deck order, and Stórfhocal phrases come after the compounds (`src/ui/screens/glossary.tsx`, `groups`).

**Change:** verbs A–Z, then every entry in a verb A–Z by its Irish, with Stórfhocal phrases mixed in among the compounds. Fadas don't affect the order. Use one collator for both levels: `new Intl.Collator('ga', { sensitivity: 'base' })`. The same order applies to search results.

**Done when:** *tabhair aire do*, *tabhair faoi deara* and *tabhair suas* appear in that order (render 10), and *cuir isteach ar* comes before *cuir síos ar* (render 11).

## 2. Every answer on a meaning card in the hand

**Now:** the tap view shows "also *éirigh as*" (`MeaningCard` with `alts`, `src/ui/cards.tsx`), but the card in the hand shows only the printed answer. A learner never learns the other answer.

**Change:** in the hand, a meaning with more than one answer shows all of them on its answer line, using the Ticker (`design-system/components/Ticker.md`):
- Measure after layout. If they fit, show them still, with dots between (tablet, usually).
- If they overflow, loop them: hold about 1s, then one lap at roughly 32px a second.
- Pause while the card is selected or being dragged, and while the lane is off screen.
- Never on the table, in the river or zoomed out. Those keep the printed answer.
- Hidden-answers mode: no change (the line stays dotted).
- Reduced motion: the first answer and a `+1` chip.
- Accessible name: "éirigh as, or tabhair suas".

Today only GIVE UP has two answers, but don't special-case it: use `answersFor(g)`.

**Done when:** render 01 matches (the ticker is caught mid-lap there), and with reduced motion on, the card shows `éirigh as` `+1`.

## 3. A tile taken from the bag scrolls into view

**Now:** the tile goes first in the meanings lane (`HandTile` inside `.lane-m .lane-scroll`, `src/ui/table.tsx`), but the lane keeps its scroll position. The tile ends up off screen to the left and looks as if it wasn't added.

**Change:** after a tile is taken (`pouchPut` succeeds), scroll the meanings lane to its start once the tile has rendered: smooth, or instant under reduced motion. The tile glints once, using the existing `is-fresh` ring for about 1.2s. Also set `overflow-anchor: none` on `.lane-scroll`, so inserting a card never shifts the lane by itself.

**Done when:** with the lane scrolled to its far right, taking a tile from the bag leaves the tile fully visible (render 02).

## 4. Tiles show every phrase

**Now:** `src/styles/app.css` has `.ba-sf-wide .ba-sf-ph:nth-of-type(n + 3) { display: none; }`. The head is a `<span>` too, so the rule hides the **second** phrase. *greim* and *fios* show one of their two.

**Change:** use `.ba-sf-wide .ba-sf-ph ~ .ba-sf-ph ~ .ba-sf-ph { display: none; }`. That allows up to two phrases, and two fit in the hand tile.

**Done when:** *greim* in the hand shows *bain greim as* and *coinnigh greim ar* (render 02).

## 5. Restore points wait to be saved

**Now:**
- `restoreDue()` works from the current bag size.
- "Not now" sets `restoreSeen` and the point is gone.
- `restoreCode()` encodes the bag at save time.

So a dismissed or failed save loses the point for good. Saving at 12 after losing one tile is the loophole Phil wants closed. Up to 10 tiles at risk is the intended cost.

**Change** (`src/engine/storfhocail.ts`, `src/ui/screens/bag.tsx`):
- Add `restorePoint?: { at: number; code: string; reached: string; saved: boolean }` to `SfProgress`, and migrate from `restoreSeen`.
- At settlement, if the bag now holds at least the next multiple of 10 above `restorePoint.at`, take a snapshot. A jump from 9 to 12 counts as reaching 10. The snapshot is the bag at that moment, trimmed to exactly `at` tiles by dropping the tiles won last in that game. Encode it then. A new snapshot replaces the old one only at a higher milestone.
- The card stays on the bag screen while `saved` is false. **Later** hides it for this visit only. Losing tiles afterwards doesn't remove it.
- **Save restore point** copies the stored code and sets `saved: true`. A small "Restore point · 10 · saved 30 Oct · Show code" row stays, so the code can be copied again.
- The strip of mini tiles shows what the point holds. Tiles that have left the bag since are faded (render 05).
- Restore stays as it is: only into an empty bag.

**Done when:** reach 10, tap Later, lose a tile to a bot, reopen the bag: the card is still there with the same code. That code restores the 10, not 9. Reaching 12 in one game gives a 10-tile code.

## 6. Long-press always offers placement

**Now:** long-press only reaches `afterPick(..., long)` from hand verbs, river cards, table cards and the board. It's lost when the card that completes the line is a **meaning card** (`table.tsx:138`, no long handler), a **wildcard** (`table.tsx:147` passes `undefined` for `W`), or a **Stórfhocal tile** (`storfhocal.tsx:203`, `onTap` only). It's also lost when the line goes through the **two-compound choice** (`table.tsx:418`, `onClick` → `chooseCompound` lays at `pls[0]`) or the **which-particle choice**, and on **Lay it** in hidden-answers mode.

**Change:** every one of those takes a long-press, and a long-press that completes a line opens the spot chooser, even when there's only one legal spot. The simplest way: record `long` on the selection when any long-press starts a line or adds to it. Then wherever a line is about to be laid (`afterPick`, `chooseCompound`, the source choice, Lay it), open `spot` instead of calling `layWay`.

**Done when:** for each of meaning card, wildcard, Stórfhocal tile, choice button, particle choice and Lay it, a long-press as the last step opens the spot chooser.

## 7. Crossing a Stórfhocal particle

Phil saw a particle in a Stórfhocal line refuse to be crossed. On `faa5d6a` it can be crossed, by the player (`ways` with `cross`) and by the bots (`lineMoves`). Add `code/storfhocail.cross.test.ts` to `src/engine/`; it passes. If it happens again, note the phrase and the line. A particle that was already crossed once (`cross: true`) can't be crossed again, and that is correct.

## 8. Rules: claiming the bots' tiles, and phrases draw nothing

**Claiming (new):** on an outright win, the player claims the bots' laid tiles only if they laid at least as many as the bots did this game, **or** had no usable tile left to lay at the end: an empty bag, nothing usable with this deck, or every usable tile already laid. Otherwise the bots' tiles go back. The player's own laid tiles stay theirs either way. A shared win and a bot win are unchanged.

This works alongside the stakes odds; it doesn't replace them. The odds make an unanswered bot tile rare. The claim rule gives a reason to stake after a bot has laid, when before, staking only added risk. Change `settleStorfhocail` and add tests for:
- 0 laid against 1 laid, bag usable: the bot's tile goes back;
- 0 against 1, bag empty: claimed;
- 1 against 1: claimed;
- 1 against 2: neither of the bot's tiles is claimed;
- 2 against 2 after taking a second tile: claimed.

**Telling the player:**
- Bag sheet sub: "Win, and you claim the bots' tiles if you've laid as many as they have. Lay one and they're far more likely to lay one back." (render 13)
- The bot's toast, when it lays a tile and the player has a usable tile left: "Lay one of yours and win, and it's yours" if the player hasn't laid one yet (render 12), and "Bots 2, you 1: lay another to claim them" once they have (render 03). With nothing usable left, the toast says "Win this game to claim it".
- Tray sub-line while the bots are ahead and the player has a usable tile: "Bots have laid 2, you 1. Lay 1 more to claim theirs." (render 03)
- Result card, when tiles go back: "aire goes back to Giorria · You won, but laid none to their 1. Lay as many as the bots to claim theirs." (render 04). When claimed: "Giorria laid it. You laid one too and won, so you claim it." (render 14)
- Rules screen: a short paragraph with the same rule.

**Phrases draw nothing (unchanged, now stated):** laying a whole Stórfhocal phrase needs no meaning card and draws nothing. A lone tile can't be played, just like a meaning card. Add both to the Rules screen, because they are a reason to play tiles rather than hoard them.

## 9. Test builds (patch 0001)

`philtweir.github.io/bain-amach/` serves the **release**, the newest `vX.Y.Z` tag. `/bain-amach/main/` serves the **test build**, the tip of `main`. Each deploy builds both into one Pages upload.

**What the patch does:**
- `.github/workflows/pages.yml`:
  - triggers on a push to `main`, a `v*` tag push, or a manual run;
  - finds the newest tag, then unit-tests, e2e-tests and builds `main`, and builds the tag in a worktree;
  - deploys both together;
  - on a tag push, creates the GitHub Release; pre-release tags (`-rc.1`) are marked pre-release and never replace the release.
- `vite.config.ts`: `APP_CHANNEL=main` gives the test build its own app:
  - manifest `id` `/bain-amach/main/`, name "Bain Amach (test)", short name "BA test", stamped icons from `public/icons-test/`, and the iOS title and touch icon;
  - the release keeps `id: './'`, which resolves to the origin, so existing installs stay the same app.
- Service workers:
  - the release worker ignores navigations under `/main/` (`navigateFallbackDenylist`), or a player with the release installed who opens `/main/` gets the release, and the test build never registers;
  - `cleanupOutdatedCaches` is off: Workbox deletes every precache whose name contains its scope, and the test build's cache name contains the release's scope.
- `src/platform/index.ts`: the test build prefixes storage keys with `ba-main:`, so it can't touch a playtester's real data. `copyReleaseData()` copies the release's keys in, for the build sheet.
- Defines: `__APP_CHANNEL__`, `__APP_COMMIT__`, `__APP_BUILT__`, `__APP_RELEASE__`. A release shows its tag as the version.

**Verified locally:** with the release installed and controlling its scope, opening `/main/` loads the test build. It registers its own worker at `/bain-amach/main/`, keeps its own `ba-main:` keys beside the release's, and gets its own precache.

**Still to build (UI):**
- The IN TEST stamp on Home: `components/TestStamp.md`, renders 06 and 08. Only when `__APP_CHANNEL__ === 'main'`.
- The build sheet (render 07):
  - Build: `main · __APP_COMMIT__`; Built: `__APP_BUILT__`; Release: `__APP_RELEASE__` (the newest tag when the build was made).
  - **Report a problem** opens `https://github.com/philtweir/bain-amach/issues/new` with the title and body filled in: build, commit, user agent.
  - **Copy my progress from the release**: a confirm ("Replace this build's games, glossary and bag with a copy of the release's?"), then `copyReleaseData()` and a reload.
  - **Open the release** goes to `../`.

**One-off GitHub setup (Phil):** see the README.

## 10. Original deck (patch 0002)

Phil liked the first deck best. It ships built in beside Standard as **Original**: the 25 October handoff deck, with 36 compounds on 36 meaning cards, 22 verbs plus the 14-verb pack, and 42 particles. That's 104 cards for 2 players and 118 for 3 or 4.

- `data/decks/original.json`: the handoff deck with today's gloss names. Its compound and meaning-card ids match the bundled deck, so glossary progress carries over.
- `src/app/decks.ts`: `PRESETS`, `presetById`; `deckForSetup` deals it as shipped; `deckFit` and `cardTotal` take a deck's data; `duplicateDeck` copies a preset and keeps its cards.
- Setup picker and Decks screen: listed under Standard as "Original · Built in", with Duplicate.
- `src/app/presets.test.ts`: data checks, and games that finish at 2, 3 and 4 players.

Stórfhocal tiles whose verbs aren't in it (*caith*, *téigh* and the other later verbs) are greyed in its games, as for any deck. New strings: `decks.original`, `decks.originalLine`, `decks.originalSub` (English; Phil supplies the Irish).

---

## Still with Phil

- Irish for the new copy: the claim lines, the restore-point card, the test build sheet and the Original deck.
- The Ulster check of the Stórfhocal shortlist (unchanged from v1.1).
