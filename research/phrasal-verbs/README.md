# Phrasal-verb candidates

A review sheet for growing the deck: which verb + river-particle compounds exist, what they mean,
and **where to go to check**. The counts are rough. The provenance and lookup links matter more:
they say where to look, so the deck itself can be written from first-hand checking, not copied.

- `candidates.xlsx`: the sheet to work in. Yellow columns are for review.
- `candidates.csv`: the same data, kept for diffs.
- `../../tools/phrasal/extract.py`: regenerates both files (see [Rerun](#rerun)).

## Columns

| column | what it is |
|---|---|
| `compound`, `verb`, `particles` | e.g. `cuir isteach ar` |
| `status` | `in deck` (any sense already a card), `new compound` (verb already in the deck), `new verb` |
| `deck_meanings` | the senses the deck has now; drafts are marked `(draft)` |
| `wiktionary_senses` | English Wiktionary glosses for the phrasal headword (blank = no entry) |
| `wiktionary_ulster` | a sense is tagged Ulster, or its gloss mentions Ulster |
| `ud_hits` | modern-spelling treebank sentences with this verb + particles attached (IDT, TwittIrish) |
| `ud_prestandard` | the same in Cadhan Aonair (pre-1940s spelling, 1602–1936, incl. a bardic poem and a Gospel) |
| `tatoeba_hits` | Tatoeba sentences with a form of the verb followed, within 5 words, by the particles |
| `examples` | up to 3 treebank + 2 Tatoeba + 1 pre-standard sentence, each with its id and licence |
| `lookup` | links: the Wiktionary entry, the Tatoeba sentences, and the verb's page on teanglann.ie |
| `ulster_attested`, `proposed_meaning`, `phil_verdict`, `notes` | for review |

**Read the counts with care.** They count literal uses too. `cuir ar` = 171 is mostly
"put on" plus *cuir fáilte*, *cuir ar fáil* and so on, not the BOTHER sense. `bí ar` and `bí le`
top the list only because *bí* is everywhere. A count says a combination is common; it doesn't say
it's idiomatic.

## The four routes, and what each is for

1. **(a) Targeted online research.** For a specific doubt ("is *tit amach* = quarrel Ulster
   usage?"), look it up and write the finding in `notes` with the source. Use this for single
   facts, not bulk copying.
2. **(b) Out-of-copyright Ulster literature.** Use it to confirm a sense really is Ulster usage.
   In Ireland and the UK, copyright runs for the author's life plus 70 years. In 2026 that frees
   authors who died in 1955 or earlier. Starting points (none are machine-readable from this
   container, so they are signposts only):
   - [Corpas Stairiúil na Gaeilge 1600–1926](https://corpas.ria.ie) (Royal Irish Academy). About
     4,000 texts, searchable, including Revival-era Ulster writing. It is the best single place to
     check a compound in context. Its reuse terms for bulk text weren't confirmed here, so quote a
     line as evidence and cite it; don't harvest it.
   - Authors who should be out of copyright: Peadar Mac Fhionnlaoich, "Cú Uladh" (Donegal,
     d. 1942: stories, plays, newspaper pieces); Énrí Ó Muirgheasa (d. 1945: *Céad de Cheoltaibh
     Uladh* 1915, *Dhá Chéad de Cheoltaibh Uladh* 1934, *Dánta Diadha Uladh* 1936). Check a
     reprint's own rights before using it; a 1974 facsimile, say, may carry new ones.
   - The [Doegen Records](https://www.doegen.ie) (1928–31) include 1931 Ulster speakers with
     transcriptions. These are the speech of people born in the mid-1800s. No licence was found,
     so treat them as reference only.
3. **(c) Permissively licensed corpora** (what `extract.py` reads). These are the sources
   [flaxandteal/greasan-data](https://github.com/flaxandteal/greasan-data) signposts:
   - English Wiktionary via Kaikki: phrasal-verb headwords and glosses (CC BY-SA 4.0).
   - Tatoeba: Irish sentences with English (CC BY 2.0 FR). Some Scottish Gaelic is mixed into the
     Irish set; sentences with grave accents are dropped.
   - Universal Dependencies treebanks: [IDT](https://github.com/UniversalDependencies/UD_Irish-IDT)
     (CC BY-SA 3.0), [TwittIrish](https://github.com/UniversalDependencies/UD_Irish-TwittIrish) and
     [Cadhan](https://github.com/UniversalDependencies/UD_Irish-Cadhan) (CC BY-SA 4.0). These are
     parsed, so a particle counts only when the parser attached it to that verb.
   - Gréasán also bundles Gaois example sentences, but they are legislation and their licence
     wasn't confirmed, so they are not used.
4. **(d) Manual dictionary check (Phil).** Use `lookup` → teanglann.ie, or a paper dictionary,
   then record the outcome in `phil_verdict` and `notes` in your own words. Modern dictionaries are
   not openly licensed, so nothing from them goes into `deck.json` verbatim. A card's English
   meaning should be a short gloss you'd write anyway (`RESIGN`, `FALL OUT`).

## Licence of this folder

The sheet quotes Wiktionary glosses and treebank sentences, so `candidates.*` is a derivative of
CC BY-SA material. Share it under **CC BY-SA 4.0**, with the attributions above (each example
carries its own source id). The deck isn't a derivative as long as its meanings are written fresh,
not pasted.

## Findings so far (2026-10-26)

**The 13 draft senses** (`draft: true` in `data/deck.json`):

| draft | Wiktionary | treebank / Tatoeba | take |
|---|---|---|---|
| bain amach: ACHIEVE | yes: "to achieve" | 44 / 1 | supported |
| bain le: TOUCH | yes: "to touch, interfere with" | 97 / 0 | supported |
| tabhair ar: CALL | yes: "to call (X the name, ar the person)" | 95 / 4 (*tugtar naomh orm*) | supported |
| bain as: CLEAR OFF | yes: "to make off" (also "tease, pull someone's leg") | 96 / 7 | supported. MAKE OFF is closer; TEASE could be another card |
| cuir isteach ar: INTERFERE WITH | yes: "interrupt; annoy, disturb; affect (negatively)" | 7 / 1 | **relabel INTERRUPT or ANNOY** (also APPLY FOR, already a card) |
| cuir ar: BOTHER | only "put on (clothes)" | 171 / 20, mostly literal | needs (b) or (d) |
| tabhair faoi: ATTACK | no entry | 37 / 0 | needs (d) |
| cuir amach: PUT OUT, PUBLISH | no entry | 10 / 0 | needs (d). PUT OUT means eject (*cuir amach an madadh*), not extinguish (*múch*); the card wording should make that clear |
| éirigh as: RESIGN | no entry | 10 / 3 | needs (d) |
| lig do: ALLOW | no entry | 6 / 0 | needs (d) |
| amharc ar: WATCH | no entry | 4 / 0 | needs (d). *amharc* is the Ulster verb, so (b) should settle it |
| tit amach: FALL OUT | no entry | 1 / 0 | needs (b) or (d). The corpora barely have it |

**New candidates with a Wiktionary sense** (52 rows have one). The most promising are those with
a verb already in the deck:

- *tar le*: agree with / put up with
- *déan de*: make into
- *déan as*: make from / make off
- *cuir síos*: put on (the kettle)
- *bain do*: happen to

With new verbs:

- *taitin le*: please
- *abair le*: tell
- *cas ar*: meet
- *beir ar*: catch
- *pléigh le*: deal with
- *clis ar*: fail, let down
- *scaoil le*: let go, fire at
- *imigh as*: fade, be lost to
- *oir do*: suit

The frequent combinations with no Wiktionary entry (*tabhair do*, *cuir le*, *déan le*,
*cuir faoi*) are probably mostly literal. They are worth a glance for idioms such as *cuir le*
(add to, support) and *cuir faoi* (settle, stay).

**No phrasal headword is tagged Ulster in Wiktionary.** Ulster evidence has to come from (b) or (d).

## Rerun

```sh
pip install duckdb openpyxl
# Gréasán bundle heads (release assets of flaxandteal/greasan-data), unzipped into one directory:
#   wiktionary-v2-full/  example-tatoeba-v2/
# UD treebanks, cloned into another:
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-IDT       ud/UD_Irish-IDT
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-TwittIrish ud/UD_Irish-TwittIrish
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-Cadhan    ud/UD_Irish-Cadhan
python3 tools/phrasal/extract.py --bundle greasan/ --ud ud/ --deck data/deck.json --out research/phrasal-verbs
```

Rerunning overwrites the sheet. Copy any review columns you've filled in somewhere else first, or
merge them back by `compound`.

The script reads the Gréasán parquet tiles directly with DuckDB, using node ids from each head's
`graph.json`. [ros-madair/alizarin](https://github.com/flaxandteal) would give named fields
instead of ids, but the data underneath is the same.

**Bigger corpora** need network access that this build environment blocks. With them allowed,
the counts would grow by orders of magnitude, but they would still be mostly literal:

| domain | for |
|---|---|
| `downloads.tatoeba.org` | the full Tatoeba export |
| `dumps.wikimedia.org` | Irish Wikipedia |
| `opus.nlpl.eu`, `object.pouta.csc.fi` | OPUS parallel corpora |
