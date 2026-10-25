# Compound verb game: answers to the design handback

Oct 25, 2026 · @Phil

All three blocking items are settled, and the 3- and 4-player deal is corrected with new simulator runs. Two questions still wait on Phil: the name and the Ulster check of the compound list.

## 1. The deal

The handback was right: 3- and 4-player games can't be dealt from a 22-verb deck. The simulator dealt 2 players correctly, but for 3 and 4 it fell back to default hands of 9 and 7 cards, so the handoff's "12 for three, 10 for four" was never tested. New runs with honest deals, 300 games each:

| Players | Verbs in deck | Hand | Hand deck left after the deal | Lines per game | Someone goes out |
| --- | --- | --- | --- | --- | --- |
| 2 | 22 | 12 | 4 | 24.5 | 37% |
| 3 | 22 | 9 | 4 | 22.4 | 58% |
| 3 | 36 | 12 | 9 | 31.6 | 43% |
| 4 | 22 | 7 | 6 | 17.9 | 79% |
| 4 | 36 | 10 | 8 | 30.8 | 48% |

**Decisions**

- **Deck:** the 104-card deck for 2 players. For 3 or 4 players, add a 14-card verb pack, bringing verbs to 36, one per compound. With only 22 verbs, a 4-player game is over almost at once.
- **Hands:** 12 cards for 2 or 3 players, 10 for 4. Three of each hand are meaning cards; the rest come from the hand deck.
- **Starter verbs:** 4, taken from the verb cards before the deal.
- **Empty hand deck:** draws come from the meaning pile. When both piles are empty, a lone verb can't be played. (The simulator used to let a lone verb cost nothing at that point; fixed, and included in the runs above.)
- **Empty-deck state on the table screen:** the deck counter reads 0, and the "Lay alone" button is disabled with a one-line reason once both piles are empty.

The two-player prototype and replays are unaffected; they always used the correct 2-player deal.

## 2. Hidden answers

Hidden mode is a real test: nothing lights up until you commit a line.

- **Highlights:** none in hidden mode. You choose the meaning card, the verb, the particles and the spot; the app checks the line only when you tap "Lay it". Shown-answers mode keeps the full highlighting from the handoff.
- **A wrong line, turn mode:** refused, the cards go back to your hand, and your turn ends with no draw. The refusal says what was wrong in one line ("*cuir* doesn't take *faoi*").
- **A wrong line, race mode:** the same, plus a 3-second lockout on laying another line. Show the lockout as a draining ring on the hand tray.
- **Hints:** when hints are on, a hint lights one usable verb for the meaning card you've selected, and nothing else. A game won with hints shows a small "hints used" mark on the recap.

The simulator's players know every compound, so hidden-mode games will run slower and longer than the figures in item 1. Playtesting will tell us by how much.

## 3. Stalls and passing

The app behaves like players at a real table: you can always declare yourself stuck, and the app never tells you that you were wrong to.

- **Turn mode:** "Draw and pass" is always available, even when you hold a legal play. The draw is the cost. When every player passes in a row, each river pile turns its top card under.
- **Race mode:** a "Stuck" button. A stall happens when every human has tapped "Stuck" and no bot can play. There is no timeout. Tapping any card or a river pile cancels your "Stuck".
- **Missed plays:** never shown during the game, unless hints are on and you ask for one. The recap shows up to three lines you could have made, as a learning moment after the result is settled.

## 4. Smaller points

| Issue | Answer |
| --- | --- |
| Compound count | Consistent. 36 compounds, each printed on exactly three meaning cards: 108 slots. GIVE UP is one meaning shared by *tabhair suas* and *éirigh as*, so that meaning appears on six cards. There are 35 distinct English meanings. |
| "Read out" | Loose wording in the handoff: it means shown on screen, Irish first with the meaning under it. Audio is a separate question (item 5). |
| Rules and Settings | Both are full screens. Settings holds: language; default for answers shown or hidden; default hints; sound; haptics; reduced motion (follow the system, or always on); bot speed in race; replay the tutorial; reset glossary progress; credits. |
| iPhone haptics | A bonus only. iOS Safari doesn't support web vibration, as far as we know, so iPhone users get none and nothing may depend on it. |
| Wildcards | Dropped on purpose. With particles in the river, covering a wildcard would shed nothing from your hand, and the rule "a single verb or a full line" excludes laying one particle on its own. A wildcard stays where it is laid. |

## 5. Open questions

Four of the six are answered; the name and the compound check wait on Phil.

| Question | Answer |
| --- | --- |
| Name, in Irish and English | Open. "Bain amach" is a working title only. Icon and splash work can start on the card system and swap the wordmark in later. |
| Compound list, Ulster check | Open, with Phil. Design meaning cards for the longest answer in the current list (*fan amach ó*, *cuir isteach ar*) and allow one line more. |
| Physical deck sharing the visual system | Yes. Square cards, four-sided words, axis stripes, the same colour families. Print adds a crossing token for straddles; wildcards in print are dashed cards with no word. |
| Audio for completed compounds | Not in v1. Leave space in the line toast and the glossary entry for a play button. |
| Glossary depth | Compound, meaning, times made and when last seen in v1. Design room for one example sentence per compound; it ships empty until the sentences are written and vetted. |
| Wrong guess in hidden mode | Answered in item 2. |

## Decision checklist

- [x] Deck counts and hand sizes: 22 verbs for 2 players, 36 for 3–4; hands 12, 12, 10
- [x] Starter verbs: 4, from the verb cards, before the deal
- [x] Empty hand deck: draw from the meaning pile; no lone verbs once both piles are empty
- [x] Hidden mode highlights: none until the line is committed
- [x] Wrong line cost: turn lost (turns); turn lost plus 3-second lockout (race)
- [x] Hints in hidden mode: light one usable verb for the selected meaning card
- [x] Pass or "Stuck" with a legal play: allowed
- [x] Race stall trigger: all humans "Stuck" and no bot can play; no timeout
- [x] Missed plays: up to three, on the recap only
- [x] Rules and Settings: full screens, Settings contents as listed in item 4
- [x] Haptics: bonus only
- [x] Wildcards: permanent once laid
- [x] Physical deck: shares the visual system
- [x] Audio: not in v1
- [x] Glossary: room for an example sentence, shipped empty
- [ ] Name, in Irish and English (Phil)
- [ ] Ulster check of the compound list (Phil)
