# Test stamp

Marks a build from `main`: the test build at `/bain-amach/main/`. Release builds never show it.

**Markup:** `<button class="ba-stamp" type="button" aria-label="Test build from main, a1b2c3d, 1 November. About this build"><b>In test</b><small>main · a1b2c3d · 1 Nov</small></button>`.

**Where:** Home only, top right, overlapping the hero cards like a rubber stamp on paper. The small line is the short commit and build date, so a playtester can say which build they mean.

**Behaviour:** it stamps in once per launch (scale down and settle, 320ms); reduced motion skips that. Tapping it opens the test build sheet: build, built, current release; Report a problem (a new GitHub issue with the build filled in); Copy my progress from the release (after a confirm); Open the release.

**Colour:** `stamp` (`#a3221d` light, `#ff8f80` night). It meets 4.5:1 on the felt in both themes. The worn-ink texture is a mask; it drops on focus so the outline reads.

**Don't:** use `stamp` for anything else, or `alert` for this. The stamp says "this isn't the release", not "something went wrong".
