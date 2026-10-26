# Phrasal-verb candidates

A review sheet for growing the deck: which verb + river-particle compounds exist, what they mean,
and **where to go to check**. The counts are rough. The provenance and lookup links matter more:
they say where to look, so the deck itself can be written from first-hand checking, not copied.

- `candidates.xlsx`: the sheet to work in. Yellow columns are for review.
- `candidates.csv`: the same data, kept for diffs.
- `sources-public-domain.csv`: every Wikisource work read, with its size and how Ulster-leaning it
  looks. A reading list, not a verdict.
- `../../tools/phrasal/extract.py`: regenerates all three (see [Rerun](#rerun)).
  `../../tools/phrasal/fetch_wikisource.py` downloads the Wikisource texts it reads.

## Columns

| column | what it is |
|---|---|
| `compound`, `verb`, `particles` | e.g. `cuir isteach ar` |
| `status` | `in deck` (any sense already a card), `new compound` (verb already in the deck), `new verb` |
| `deck_meanings` | the senses the deck has now; drafts are marked `(draft)` |
| `wiktionary_senses` | English Wiktionary glosses for the phrasal headword (blank = no entry). Spelling and dialect forms are folded in as "also …" (*déan as* lists the Connacht *díon as* forms) instead of getting their own rows |
| `wiktionary_ulster` | a sense is tagged Ulster, or its gloss mentions Ulster |
| `ud_hits` | modern-spelling treebank sentences with this verb + particles attached (IDT, TwittIrish) |
| `ud_prestandard` | the same in Cadhan Aonair (pre-1940s spelling, 1602–1936, incl. a bardic poem and a Gospel) |
| `tatoeba_hits` | Tatoeba sentences with a form of the verb followed, within 5 words, by the particles |
| `pd_hits` | the same surface match in Wikisource's public-domain Irish (1.3 million words, pre-standard spelling) |
| `pd_ulster_hits` | of those, how many are in a work that looks Ulster-leaning (see below) |
| `examples` | up to 3 treebank, 2 Tatoeba, 1 Cadhan and 2 Wikisource sentences, each with its source and licence |
| `lookup` | links: the Wiktionary entry, the Tatoeba sentences, the Wikisource pages, and the verb's page on teanglann.ie |
| `ulster_attested`, `proposed_meaning`, `phil_verdict`, `notes` | for review |

**Which verbs.** The deck's verbs, every verb with a Wiktionary phrasal headword, the 40 commonest
verbs in the modern treebanks (minus *dar*, *arsa* and *féad*, which are never phrasal), and any
given with `--verbs`. The rerun below adds *gabh*, which the treebanks rarely use. Before
2026-10-26 only the first two groups were read. That missed common verbs that have no such
headword, including *glac*, *téigh* and *faigh*.

**Order.** Within each status, rows are sorted by modern evidence (treebank + Tatoeba hits), plus
a quarter of the public-domain hits (older spelling, looser matching), plus a boost for having a
Wiktionary sense.

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
   - Public domain, so these can be ingested, not just looked up. Little of it is Ulster:
     - [Wikisource, Category:Gaeilge](https://wikisource.org/wiki/Category:Gaeilge): **read by the
       extractor** (`pd_hits`). 57 works, 1.3 million words, Old and Middle Irish left out. Most is
       Munster (*Séadna*, *Niamh*, *Mo Sgéal Féin*, *An t-Oileánach*) or Connacht (*Deoraidheacht*,
       Hyde). *Irisleabhar na Gaedhilge* (1882–1909, 128 pages, 310,000 words) has contributors
       from every province. The Ulster-marker score (*chan*, *inteacht*, *goidé*, *tchí*, *domh*,
       *fosta*, *bhéarfainn*…) flags three Oriel/south-Ulster poems: *An Bonnán Buí* (Cathal Buí
       Mac Giolla Ghunna), *Mná na hÉireann* (Peadar Ó Doirnín) and *Róisín Dubh*. Each has a few
       hundred words, so they're a reading list, not a corpus. Works in Scottish Gaelic (by grave
       accents, or words like *tha*, *gu*, *ri*, *thu*) are marked and skipped.
     - Project Gutenberg: a handful of Irish-language titles, none of them Ulster
       ([PGDP's list](https://www.pgdp.net/wiki/Irish_Language_Projects)). Ua Laoghaire's
       *Niamh* and Ó Dubhghaill's *Prátaí Mhíchíl Thaidhg* are Munster; Hyde's *Beside the Fire*
       is Connacht.
     - E. C. Quiggin, *A Dialect of Donegal* (1906; Quiggin died in 1920). Glenties speech, with
       texts in phonetic transcription. Good evidence, but useless for word matching.
     - All of these are pre-standard spelling, often Cló Gaelach with dots for lenition. The
       extractor expands the dots and reads each old word through Kevin Scannell's
       [caighdean](https://github.com/kscanne/caighdean) word pairs (`--pairs`, GPL; used as a
       lookup, not copied). An old word with two modern readings keeps both, so these are surface
       matches. Expect some noise, and check the sentence.
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
| tabhair faoi: ATTACK | no entry | 37 / 0 | needs (d). Most Wikisource hits are *thug sé faoi deara* ("noticed"), a separate idiom and a possible NOTICE card |
| cuir amach: PUT OUT, PUBLISH | no entry | 10 / 0 | needs (d). PUT OUT means eject (*cuir amach an madadh*), not extinguish (*múch*); the card wording should make that clear |
| éirigh as: RESIGN | no entry | 10 / 3 | needs (d) |
| lig do: ALLOW | no entry | 6 / 0 | needs (d) |
| amharc ar: WATCH | no entry | 4 / 0 | needs (d). *amharc* is the Ulster verb, so (b) should settle it |
| tit amach: FALL OUT | no entry | 1 / 0 | needs (b) or (d). Wikisource has it as "happen" (*mar thuit amach dóibh*, *An t-Oileánach*), the deck's other sense; the quarrel sense still needs checking |

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

**Verbs the deck lacks: checked by reading the examples.** A common verb doesn't mean common
compounds, so these are verdicts from reading each compound's attested sentences, not from its
counts:

| verb | compound | what the examples show | take |
|---|---|---|---|
| glac (15th commonest verb, above *tóg*) | *glac le* | about 33 of 44 treebank hits and all 3 Tatoeba hits are idiomatic: ACCEPT (*ghlac Tom leis an chuireadh*, an offer, a decision) and ASSUME (*glactar leis go…*, *glacann gach duine leis gur…*) | **strong**: two senses |
| | *glac ar*, *faoi*, *de*, *do*, *ó* | noun phrases (*seilbh a ghlacadh ar*, *buíochas a ghlacadh le*), *glac X ort féin* (take on yourself), or literal "take from" | no |
| gabh (not in the treebanks' top 50) | *gabh le* | modern: formal "accompanying" (*na foirmeacha a ghabhann leis*); older: side with (*gabháil le muintir an Choibhinint*) | weak: formal register |
| | *gabh ort féin* | undertake (*gabhfaidh an tÚdarás air féin…*), formal and Biblical | weak |
| | *gabh de / do X ar Y* | beat Y with X (*gabháil de shlataibh orthu*); every hit is literary or quotes a dictionary | literary only |
| | *gabh amach*, *isteach*, *síos*, *suas* | literal go out / in / down / up, mostly from the Blasket books | literal |
| faigh | *faigh amach* | FIND OUT, nearly every treebank hit (*chun a fháil amach cad é…*) | **strong** |
| | *faigh ar*, *faigh ó* | noun phrases (*locht a fháil ar*, *taithí a fháil ar*) or literal "get from" | no |
| téigh | *téigh le* | TAKE UP (*chuaigh tú le sagartóireacht*, *chuadar leis an bpolaitíocht*); also "go with, suit" | worth a card |
| | *téigh amach le* | GO OUT WITH, as in date (*chuaigh mé amach le gealt*). Only one Tatoeba sentence, below the sheet's cut-off, so it has no row; check it in a dictionary | worth a card |
| | *téigh ar*, *isteach*, *amach*, *faoi* | literal motion, or noun idioms (*dul ar aghaidh*, *dul ar imirce*, *dul faoi uisce*) | literal |

So *glac* earns a card with two senses, *gabh* doesn't, and the bigger gap was *faigh amach* and
*téigh (amach) le*. *gabh ort féin* is under the *gabh ar* row.

**No phrasal headword is tagged Ulster in Wiktionary**, and Wikisource's Ulster material is three
short poems. Ulster evidence still has to come from Corpas Stairiúil (b) or a dictionary (d).

## Rerun

```sh
pip install duckdb openpyxl
# Gréasán bundle heads (release assets of flaxandteal/greasan-data), unzipped into one directory:
#   wiktionary-v2-full/  example-tatoeba-v2/
# UD treebanks, cloned into another:
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-IDT       ud/UD_Irish-IDT
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-TwittIrish ud/UD_Irish-TwittIrish
git clone --depth 1 https://github.com/UniversalDependencies/UD_Irish-Cadhan    ud/UD_Irish-Cadhan
# Optional: Wikisource's public-domain Irish (slow: Wikisource rate-limits; reruns resume from its cache)
python3 tools/phrasal/fetch_wikisource.py --out ws/
git clone --depth 1 https://github.com/kscanne/caighdean
python3 tools/phrasal/extract.py --bundle greasan/ --ud ud/ --deck data/deck.json --out research/phrasal-verbs \
  --texts ws/wikisource-ga.jsonl --pairs caighdean/pairs.txt --verbs gabh
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
| `www.gutenberg.org` | Gutenberg (gutenberg.org redirects there); only a handful of Irish books, none Ulster |
| `dumps.wikimedia.org` | Irish Wikipedia |
| `opus.nlpl.eu`, `object.pouta.csc.fi` | OPUS parallel corpora |
