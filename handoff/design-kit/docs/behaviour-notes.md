# Behaviour notes

The annotations from the screens board, grouped by section and screen. Each screen names its board file in `screens/board-source/` and its render in `screens/renders/` where one exists. Where a note and the handoff doc disagree, the doc wins; tell Phil.

## Overview

### Screen flow

`Main.dc.html` · 1920×800


## First launch, home and setup

### Choose language

`Language.dc.html` · 390×844

- First launch only. Irish is preselected; English is one tap. The choice sets UI language, not the cards: card words are always Irish. Changeable later in Settings.

### Welcome

`Welcome.dc.html` · 390×844

- Shows a real line being laid (static). 'Play the tutorial' is primary; 'Skip to a game' goes to Setup with learner defaults (turns, 1 easy bot, answers shown, hints on request).

### Tutorial, step 2 of 6

`Tutorial.dc.html` · 390×844

- A scripted game against one bot. Six steps: meaning card, verb, river, placement, bot turn, stall. Scrim dims everything except the spotlit zone, which stays tappable; the next step starts when the player does the thing, or taps Next. Skip ends it; replay from Rules or Settings.

### Home, saved game

`Home.dc.html` · 390×844

- With a saved game, Continue is primary and shows mode, opponents and card counts. New game opens Setup prefilled with the last settings. Glossary shows progress (compounds made of 36).

### Home, first visit

`HomeFirst.dc.html` · 390×844

- First visit after the tutorial: no saved game, glossary empty. New game is primary.

### Home, install nudge and update

`HomeReturning.dc.html` · 390×844

- Install nudge appears once, after the first finished game; dismiss hides it for good. iOS shows the Add to Home Screen steps instead of a native prompt. The update banner appears only here and on Recap, never mid-game; Restart reloads with the saved game intact.

### Setup, solo

`Setup.dc.html` · 390×844

- One screen, no wizard. Opponent rows add or remove bots (1 to 3), each with its own difficulty. Deck size updates with player count: 104 for 2 players, 118 for 3 or 4. Play is always enabled; defaults are valid.

### Setup, pass-and-play

`SetupPass.dc.html` · 390×844

- Pass-and-play: Race is disabled with its reason under it. Players have editable names and pick colours; colour plus pattern plus initial stay unique. Bots can join (mixed tables).

## Game table: turns, answers shown

### Table, opening deal

`GameTable.dc.html` · 390×844

- Zones top to bottom: status strip, river (in its sunken channel), board, hand tray. The table is felt: a mid-tone baize with a lamp-pool glow at the centre and a fine grain, texture only. The board opens on the area around the latest play, at 64px cards; pan and pinch to see more, double-tap or Fit to frame it all. The face-up meaning pile sits at the start of the meanings lane, next to the cards it swaps with. Tray lanes scroll sideways.

### Line builder: meaning picked

`Build1.dc.html` · 390×844

- Tap 1: a meaning card. It lifts and every card that can finish one of its meanings rings in lit blue and pulses: table verbs with a free arm, hand verbs, river tops, the wildcard. Everything else dims. Starting from a verb or a river card works the same way.

### Line builder: two ways to finish

`Build2.dc.html` · 390×844

- Tap 2: a verb. When the line is complete it lays itself at the best spot: no confirm, no placement step. Only when the verb fits two meanings does the tray show both and ask for one more tap on a particle.

### Line builder: choose a spot (long-press)

`Build3.dc.html` · 390×844

- Optional: long-press the last card instead of tapping to choose the spot yourself. The best spot shows as a ringed preview; other legal spots are dashed outlines. Tap a spot to move the preview, tap the preview to lay it.

### Line made: the reward moment

`Made.dc.html` · 390×844

- Every line you lay: cards fly in (200ms each, 60ms apart) and get a gorse ring that fades; the compound pops large over the board for 640ms with gorse rays, then settles into the toast. First time ever: a New badge and the glossary count. Any tap dismisses it at once. Bots get the toast only.

### Lone verb

`Alone.dc.html` · 390×844

- Tap a verb in hand: it lifts and its best spot is ringed. The header asks the question and the button carries the cost (draw 2); no dialog. Disabled once both draw piles are empty.

### Bot playing

`Bot.dc.html` · 390×844

- Bot avatar pulses; its line draws in card by card at 420ms so the eye can follow. The board pans to it unless the player has panned in the last 3 seconds. Your controls stay visible but inactive in turn mode.

### Stall

`Stall.dc.html` · 390×844

- Turn mode: a full round of passes. Race: every human tapped Stuck and no bot can play. Each pile's top slides under (600ms) and the next top lands; a turn mark sits on each pile for 2s. Everyone draws 1; drawn cards fly to the hand and avatars show +1.

### Pause menu

`Pause.dc.html` · 390×844

- Bottom sheet over a scrim. Race clocks and bots stop while it is open. Quit saves the game; Restart asks once, in the sheet, because it throws away the game.

## Game table: answers hidden, race, endgame

### Answers hidden: building

`Hidden.dc.html` · 390×844

- Answers hidden: meaning cards show dotted rules instead of Irish. Nothing lights. Tapped cards take the ink selection ring and appear in 'Your line'. The ringed spot is just where it will go. Lay it checks the line.

### Answers hidden: wrong line

`Wrong.dc.html` · 390×844

- Not quite: cards shake once (320ms), hand cards return to the hand, river cards to the top of their pile. A soft ink toast, never red: a compound that doesn’t exist, or a real compound not on this card. Turn mode: draw 1, turn over, counts as a pass.

### Race

`Race.dc.html` · 390×844

- Race: no turns, a game clock instead. Stuck is a toggle; avatars show who is stuck. Starting a line (tapping a hand card) cancels your Stuck; inspecting table cards does not. Hidden answers by default for fluent players.

### Race: taken

`Taken.dc.html` · 390×844

- Another player took a card your line needed. The card shows dashed for 600ms with a 'Taken' toast naming who, then fades; your line clears. Your hand cards stay in your hand.

### Race: lockout

`Lockout.dc.html` · 390×844

- Wrong line in race: the same soft toast, plus a 3s lockout on laying lines. The ring drains on the Wait button. Stuck and Lay alone stay available.

### Dense board, zoomed out

`Dense.dc.html` · 390×844

- Below 32px a cell, cards show their type glyph only. Pinch to zoom in; words return above 32px. Taps at this size select the nearest valid target. Fit frames the whole board.

### Empty piles, final stalls

`Empty.dc.html` · 390×844

- Both draw piles at 0. Lay alone is disabled. Draw and pass becomes Pass. The tray header counts final stalls; when the count reaches the deepest river pile, the game ends on fewest cards.

### Game end: went out

`WentOut.dc.html` · 390×844

- Going out: the last card lands, strong haptic, the board dims and the result card rises. See recap is primary; Board lets players look at the final table first.

### Game end: fewest cards

`Fewest.dc.html` · 390×844

- The common ending. Standings show everyone's count, fewest first; ties share the win and say so. Same buttons as going out.

## Pass-and-play, recap and reference

### Pass-and-play hand-over

`HandOver.dc.html` · 390×844

- Pass-and-play only. The hand tray is replaced by a cover in the next player's colour and pattern; the board stays visible since it is public. The hand appears only when the named player taps. Shown after every turn.

### Recap, fewest cards

`Recap.dc.html` · 390×844

- Result first, then counts, then every compound made in this game in play order with its meaning and who laid it. Tap a compound to open it in the glossary. Up to three missed lines come last, labelled as such. Replay this game re-runs the seed.

### Recap, went out, hints used

`RecapOut.dc.html` · 390×844

- A game won with hints shows the 'Hints used' mark next to the result. Pass-and-play recaps name each player.

### Glossary

`Glossary.dc.html` · 390×844

- 36 compounds grouped by verb. Each row: compound, meaning, times made, last seen. Rows not yet made sit greyed with their meaning. Room for one example sentence per compound, empty in v1.

### Glossary, empty

`GlossaryEmpty.dc.html` · 390×844

- Before any compound is made: the list still shows every compound so learners can study; the empty state is a one-line header, not a blank screen.

### Rules

`Rules.dc.html` · 390×844

- One scrolling page with the five plays as numbered sections, each with a small diagram made from real card components. Replay the tutorial at the top.

### Settings

`Settings.dc.html` · 390×844

- Everything from the handoff's Settings list. Reset glossary progress asks once, inline. Reduced motion: follow the system, or always on.

### Night table (dark)

`NightTable.dc.html` · 390×844

- Dark theme follows the system. Card faces keep their colours; their edges lighten so they separate from the night table.

## Tablet landscape

### Table, tablet landscape

`TableTablet.dc.html` · 1180×820

- Board centre, river down the left, opponents across the top, hand along the bottom in one lane. For pass-and-play the tray changes owner while board and river stay put; type and colours are sized to read at arm's length.

### Setup, tablet landscape

`SetupTablet.dc.html` · 1180×820

- Same controls as phone setup, in two columns: game options left, players right.

### Recap, tablet landscape

`RecapTablet.dc.html` · 1180×820

- Result and standings left; the compound list right, scrollable.

## Motion, app icon and splash

### Motion notes

`Motion.dc.html` · 1400×900


### App icon and splash

`Icon.dc.html` · 1400×900

