# Bain Amach (working title): build handoff

Everything needed to build the app. Start with `CLAUDE.md`.

```
CLAUDE.md                       build brief: scope, stack, architecture, milestones, open items
spec/RULES.md                   canonical rules (source of truth)
spec/handback-answers.md        decisions on the designer's questions
spec/design-handoff.md          original design brief (screens, a11y, PWA); deal numbers superseded
data/deck.json                  cards, counts, setup by player count (what the app loads)
data/card-list.xlsx             the same deck for human review; yellow columns await Phil's Ulster check
design/bain-amach-design.html   design board: playable table prototype, card system, every screen
design/tokens.css               colour and font tokens from the board
reference/engine/               plain-JS reference engine + bot-vs-bot test (node reference/engine/engine.test.js)
reference/simulator/            Python research simulator (background only)
```

The design output from the design board is the visual reference. Where a design file and `spec/RULES.md` disagree on behaviour, the rules win.
