# Behaviour notes, v1.1

The board annotations for every new or changed screen in this kit, in render order. Each names its render in `screens/renders/` and its source in `screens/board-source/`. Where a note and `feature-plan-v1.1.md` disagree, the plan wins.

## Stórfhocal tile

### Stórfhocal tile: Opal chosen

`01-StorfhocalTiles.png` · `StorfhocalTiles.dc.html` · 1400×1240

- Opal is chosen. Its pastel wash drifts over 10s, the foil rim turns every 8s and a glint crosses every 6s: the only movement on the table, which is what lifts it clear of the paper meaning cards. Under reduced motion it holds still with a 3px rim. Jet (too heavy; reads as an adverb) and Kingfisher stay here for comparison. All share the twinkles and the pointed notches where the line joins. Build the tile from the design system's `.ba-sf` classes, not from this board's inline styles, which predate them.


## Stórfhocal games

### Setup: Stórfhocal on

`02-SfSetup.png` · `SfSetup.dc.html` · 390×844

- Shown after 20 finished games, never in pass-and-play. Remembers its last setting; off on a new install. Without a Hard bot it stays available, with a note that bots lay tiles only at Hard.

### Giorria lays a Stórfhocal

`03-SfBot.png` · `SfBot.dc.html` · 390×844

- A Hard bot lays tabhair · aire · do: no meaning card. Bots get the toast, not the big moment, but this toast carries the tile and, for a tile the player lacks, "Win this game to keep it". The stake chip in the status strip gains the tile with a dot in the bot’s colour.

### Taking a tile from your bag

`04-SfBag.png` · `SfBag.dc.html` · 390×844

- The Stórfhocail button in the tray opens your bag. Pick one tile; one in hand at a time, free to put back. The sub-line states the stakes rule: with tiles in your bag and none of yours waiting for an answer, Hard bots almost never lay one; lay one and their odds return to normal until a bot answers. The warning names the bot and the tile. Tiles this deck can’t complete are greyed with the reason.

### A Stórfhocal in hand

`05-SfHand.png` · `SfHand.dc.html` · 390×844

- The tile sits first in the meanings lane, wide, so its phrase reads. Selecting it lights every verb and river card that completes a phrase on it. Put back returns it to the bag at no cost.

### You lay a Stórfhocal

`06-SfMade.png` · `SfMade.dc.html` · 390×844

- Your own tile gets the full line-made moment with foil rays. The keep line says it is at stake. The stake chip now shows both tiles on the table and who laid each.

### Night table

`07-SfNight.png` · `SfNight.dc.html` · 390×844

- Night table: the tile keeps its pearl face and foil, like every card face.

### Pause with a tile at stake

`08-SfQuit.png` · `SfQuit.dc.html` · 390×844

- With your tile on the table, Restart counts as a loss and says so before you tap it. Save and quit keeps the game; closing the app is not quitting. Discarding a saved game with tiles at stake warns the same way.

### Game end: tiles change hands

`09-SfEnd.png` · `SfEnd.dc.html` · 390×844

- The result card adds a Stórfhocail block: what joins your bag, what stays, what leaves. On a shared win each side keeps its own; a bot’s tile vanishes.

### Recap: a tile lost

`10-SfRecap.png` · `SfRecap.dc.html` · 390×844

- A loss: the tile you laid goes with the bot, and the recap says so first, in plain words. Tiles a bot laid that it then keeps simply leave the game.

### Recap: unlocked at 20 games

`11-SfUnlock.png` · `SfUnlock.dc.html` · 390×844

- The 20th finished game announces Stórfhocal games once, on the recap. Nothing else changes until the player turns it on.

### Home: your bag

`12-SfHome.png` · `SfHome.dc.html` · 390×844

- The bag entry appears on Home after the first tile is won and stays even if the bag empties.

### Your bag

`13-Bag.png` · `Bag.dc.html` · 390×844

- One slot per word in the list, in a fixed order. Empty slots stay blank, so the set’s size shows without spoiling the words. Tap a tile for its detail.

### Your bag: restore point at 10

`14-SfBagMilestone.png` · `SfBagMilestone.dc.html` · 390×844

- At 10, 20, 30 tiles the bag offers a restore point: a code to save. There is no restore point on demand, and restore works only into an empty bag.

### Your bag: one tile

`15-SfBagDetail.png` · `SfBagDetail.dc.html` · 390×844

- A tile’s detail: its face at size, where it came from, how often seen, and a link to its glossary entry.

### Glossary: Stórfhocail seen

`16-SfGlossary.png` · `SfGlossary.dc.html` · 390×844

- Stórfhocal phrases sit in their verb’s group, marked with the tile, so searching tabhair finds every tabhair entry. Only phrases you have seen appear; the rest stay hidden.

## Deck editor

### Decks

`17-Decks.png` · `Decks.dc.html` · 390×844

- Home → Decks (the card-stack icon). Standard is built in and read-only: Duplicate makes an editable copy. A deck in use by a saved game says so; editing it never changes that game.

### Decks, Standard only

`18-DecksFirst.png` · `DecksFirst.dc.html` · 390×844

- Before any custom deck: Standard alone, and a primary New deck. New decks start as a copy of Standard.

### Deck editor: tiles

`19-DeckEditor.png` · `DeckEditor.dc.html` · 390×844

- The summary card is always on top: total, the three piles, and a FitChip per player count with the reason it fails. Steppers (design system) show Standard’s count wherever this deck differs. A count of 0 greys every compound that needs it.

### Deck editor: compounds

`20-DeckCompounds.png` · `DeckCompounds.dc.html` · 390×844

- Compounds by verb, ticked if they go on meaning cards. A compound that can’t be built is greyed and says why (Needs fág). Tick all usable restores every buildable one.

### Deck editor: meaning cards

`21-DeckMeanings.png` · `DeckMeanings.dc.html` · 390×844

- The total N sets 3N meaning slots, shared as evenly as possible. The strip shows the generated cards; Shuffle again draws a new seed. The same seed always gives the same cards.

### Test with bots: running

`22-DeckTestRun.png` · `DeckTestRun.dc.html` · 390×844

- 100 Normal-bot games in a web worker, a few seconds. Player counts the deck can’t serve are disabled. Editing carries on underneath.

### Test with bots: plays well

`23-DeckTestResult.png` · `DeckTestResult.dc.html` · 390×844

- Four numbers against Standard’s: lines per game, how often someone goes out, stalls, compounds never made. Sample figures; the real ones come from the simulator.

### Test with bots: plays badly

`24-DeckTestBad.png` · `DeckTestBad.dc.html` · 390×844

- A deck that plays badly: the outliers are ringed and the verdict says what to change in plain words. It never blocks saving or playing.

### Setup: deck row

`25-SetupDeck.png` · `SetupDeck.dc.html` · 390×844

- The deck row sits above Opponents, with the deck size for the current player count. Tapping opens the picker.

### Setup: choosing a deck

`26-SetupDeckPicker.png` · `SetupDeckPicker.dc.html` · 390×844

- Decks that can’t serve the table are disabled with the reason. Edit decks goes to Decks.

### Deck editor, tablet

`27-DeckTablet.png` · `DeckTablet.dc.html` · 1180×820

- Tablet: the three sections side by side under the summary card, so a change on the left shows its effect on the right at once.

## Changed v1 screens

### Home, saved game

`28-Home.png` · `Home.dc.html` · 390×844

- Home gains a Decks icon in its top row, between Rules and Settings, on every Home state. Nothing else on Home changes; the bag entry (see Home: your bag) appears only once a Stórfhocal is owned.

### Home, first visit

`29-HomeFirst.png` · `HomeFirst.dc.html` · 390×844

- Same change as Home: the Decks icon in the top row.

### Home, install nudge and update

`30-HomeReturning.png` · `HomeReturning.dc.html` · 390×844

- Same change as Home: the Decks icon in the top row.
