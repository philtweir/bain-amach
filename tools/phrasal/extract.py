#!/usr/bin/env python3
"""Build a review sheet of candidate Irish phrasal verbs (verb + river particles) for the deck.

Sources, all openly licensed (see research/phrasal-verbs/README.md):
  - Gréasán's open-data bundle (flaxandteal/greasan-data release assets): English Wiktionary via
    Kaikki (CC BY-SA 4.0) for phrasal-verb headwords and senses, and Tatoeba examples
    (CC BY 2.0 FR) for Irish sentences with English.
  - Universal Dependencies Irish treebanks (IDT CC BY-SA 3.0; TwittIrish, Cadhan CC BY-SA 4.0)
    for parsed sentences: which particles attach to which verb, and how often.

Usage:
  python3 tools/phrasal/extract.py --bundle DIR --ud DIR --deck data/deck.json --out research/phrasal-verbs

  --bundle  a directory holding the unzipped heads wiktionary-v2-full/, example-tatoeba-v2/
  --ud      a directory holding UD_Irish-IDT/, UD_Irish-TwittIrish/, UD_Irish-Cadhan/ (git clones)

Needs: duckdb (pip install duckdb), openpyxl for the .xlsx (optional; the CSV is always written).
"""
from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import re
import unicodedata
import urllib.parse
from collections import Counter, defaultdict

ADVERBS = {"amach", "isteach", "suas", "síos"}
# Prepositions with their pronoun forms (and article forms), so "orm", "leis", "don" all count.
PREP_FORMS = {
    "ar": "ar orm ort air uirthi orainn oraibh orthu",
    "le": "le leis liom leat léi linn libh leo",
    "do": "do don dom duit dó di dúinn daoibh dóibh",
    "as": "as asam asat aisti asainn asaibh astu",
    "de": "de den díom díot dínn díbh díobh",
    "faoi": "faoi faoin fúm fút fúithi fúinn fúibh fúthu",
    "ó": "ó ón uaim uait uaidh uaithi uainn uaibh uathu",
}
FORM_TO_PREP = {f: p for p, fs in PREP_FORMS.items() for f in fs.split()}
# Words that turn a preposition into a compound one (ar son, ar fud, le haghaidh…), which isn't a particle.
COMPOUND_PREP_NEXT = {"son", "fud", "feadh", "nós", "aghaidh", "haghaidh", "ais", "chúl", "bun", "lorg", "réir", "dheis", "chlé", "choinne", "dtaobh", "thaobh", "dtuairim", "éis", "eis"}
# Tatoeba's Irish set has some Scottish Gaelic in it; its grave accents give it away.
GAELIC_GRAVE = re.compile(r"[àèìòùÀÈÌÒÙ]")
# Standard verbal nouns of common verbs (grammar, not dictionary text). Wiktionary's glosses cover
# only the rarer ones, and UD lemmatises a verbal noun to itself (cur, not cuir).
VERBAL_NOUNS = {
    "abair": "rá", "airigh": "aireachtáil", "amharc": "amharc", "bain": "baint", "beir": "breith",
    "bí": "bheith", "breathnaigh": "breathnú", "bris": "briseadh", "buail": "bualadh", "caith": "caitheamh",
    "cas": "casadh", "clis": "cliseadh", "clois": "cloisteáil", "croch": "crochadh", "cuimhnigh": "cuimhneamh",
    "cuir": "cur", "déan": "déanamh", "dún": "dúnadh", "éirigh": "éirí", "éist": "éisteacht", "fág": "fágáil",
    "faigh": "fáil", "fan": "fanacht", "féach": "féachaint", "feic": "feiceáil", "gabh": "gabháil",
    "glac": "glacadh", "iarr": "iarraidh", "imigh": "imeacht", "ith": "ithe", "labhair": "labhairt",
    "las": "lasadh", "leag": "leagan", "lean": "leanúint", "lig": "ligean", "múch": "múchadh", "oir": "oiriúint",
    "pléigh": "plé", "rith": "rith", "samhlaigh": "samhlú", "scaoil": "scaoileadh", "seas": "seasamh",
    "smaoinigh": "smaoineamh", "taitin": "taitneamh", "tabhair": "tabhairt", "tar": "teacht",
    "tarraing": "tarraingt", "téigh": "dul", "tit": "titim", "tóg": "tógáil", "tuig": "tuiscint",
}

LICENCES = {
    "UD_Irish-IDT": "CC BY-SA 3.0",
    "UD_Irish-TwittIrish": "CC BY-SA 4.0",
    "UD_Irish-Cadhan": "CC BY-SA 4.0",
    "Tatoeba": "CC BY 2.0 FR",
    "Wiktionary": "CC BY-SA 4.0",
}
# Cadhan is pre-standard spelling (1602–1936, incl. a bardic poem and a Gospel), so it is counted apart
# and its examples go last. Order here is the order examples are listed in.
PRESTANDARD = {"UD_Irish-Cadhan"}
EXAMPLE_ORDER = ["UD_Irish-IDT", "UD_Irish-TwittIrish", "Tatoeba", "UD_Irish-Cadhan"]

# node ids in the Gréasán graphs (see each head's graph.json)
WK = {
    "headword": "205c6fca",
    "pos": "a956278b",
    "dialect": "69fb02e1",
    "senses": "2a050c04",
    "gloss": "bb1d46fd",
    "example": "04f94351",
    "sense_dialect": "f4596e10",
    "forms": "2c080e83",
    "written_rep": "0f55623b",
    "gram_features": "7e0b4712",
}
TT = {"sentence": "d7738326", "sentence_en": "977cbd5d", "provenance": "d8eb23c3", "source_id": "1265bbc7"}


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def val(d: dict, prefix: str):
    for k, v in d.items():
        if k.startswith(prefix):
            if isinstance(v, dict) and "en" in v:
                return v["en"]["value"]
            return v
    return None


# ---------------- Wiktionary ----------------

def load_wiktionary(bundle: str):
    import duckdb

    con = duckdb.connect()
    head = f"{bundle}/wiktionary-v2-full"
    cat = dict(con.execute(f"select concept_id, label from read_parquet('{head}/concept_catalog.parquet')").fetchall())
    rows = con.execute(f"select resource_id, descriptor_name, nodegroup_id, data from read_parquet('{head}/tiles_lexical_entry.parquet')").fetchall()
    ent: dict = defaultdict(lambda: {"senses": [], "pos": set(), "dial": set(), "forms": []})
    for rid, name, ng, data in rows:
        d = json.loads(data)
        e = ent[rid]
        e["name"] = nfc(name)
        if ng.startswith(WK["senses"]):
            e["senses"].append({"gloss": val(d, WK["gloss"]), "example": val(d, WK["example"]), "dialect": cat.get(val(d, WK["sense_dialect"]) or "", "")})
        elif ng.startswith(WK["pos"]):
            e["pos"].add(cat.get(val(d, WK["pos"]) or "", ""))
        elif ng.startswith(WK["dialect"]):
            e["dial"].add(cat.get(val(d, WK["dialect"]) or "", ""))
        elif ng.startswith(WK["forms"]):
            feats = val(d, WK["gram_features"]) or []
            feats = [cat.get(f, f) for f in feats] if isinstance(feats, list) else [cat.get(feats, feats)]
            e["forms"].append((nfc(val(d, WK["written_rep"]) or ""), feats))
    irish = [e for e in ent.values() if any("Irish" in x for x in e["dial"]) or any("Irish" in s["dialect"] for s in e["senses"])]
    for e in irish:
        e["senses"] = [s for s in e["senses"] if not s["dialect"] or "Irish" in s["dialect"]]
    return irish


def fold_variants(heads: dict[str, list]) -> dict[str, list[str]]:
    """Drop headwords that are only spelling or dialect forms of another (díon as: "Connacht form of
    déan as"), returning them by the compound they belong to, e.g. {"déan as": ["díon as (Connacht form)"]}.
    Inflected variants (díonamh as) go to the same compound as their verb's bare form."""
    found: dict[str, tuple[str, str]] = {}
    for name, senses in heads.items():
        gl = [s["gloss"] for s in senses if s.get("gloss")]
        m = [re.match(r"^((?:[\w-]+ )*?(?:form|spelling)) of (.+)$", g) for g in gl]
        if gl and all(m):
            found[name] = (m[0].group(1), m[0].group(2).strip())
    verb_to = {n.split()[0]: t.split()[0] for n, (_, t) in found.items() if t in heads}
    out: dict[str, list[str]] = defaultdict(list)
    for name, (kind, target) in found.items():
        if target not in heads:
            v, tail = name.split()[0], " ".join(name.split()[1:])
            base = max((k for k in verb_to if v.startswith(k)), key=len, default=None)
            target = f"{verb_to[base]} {tail}" if base else target
        if target in heads and target not in found:
            out[target].append(f"{name} ({kind})")
            del heads[name]
    return out


def is_particle_seq(words: list[str]) -> bool:
    return 1 <= len(words) <= 2 and all(w in ADVERBS or w in PREP_FORMS for w in words) and (len(words) == 1 or (words[0] in ADVERBS and words[1] in PREP_FORMS))


def verb_lexicon(entries, verbs: set[str], ud_dir: str):
    """Verbal nouns (cur → cuir) and inflected forms for the verbs of interest.

    The bundle's Wiktionary carries no inflection tables, so forms come from the treebanks' own
    lemmatised tokens (modern spelling only) and verbal nouns from "verbal noun of X" glosses.
    """
    vn: dict[str, str] = {n: v for v, n in VERBAL_NOUNS.items()}
    for e in entries:
        for s in e["senses"]:
            m = re.search(r"verbal noun of (\w+)", s.get("gloss") or "")
            if m and "noun" in e["pos"]:
                vn.setdefault(e["name"].lower(), nfc(m.group(1)))
    forms: dict[str, set[str]] = defaultdict(set)
    for path in sorted(glob.glob(f"{ud_dir}/UD_Irish-*/*.conllu")):
        if os.path.basename(os.path.dirname(path)) in PRESTANDARD:
            continue
        for _, sent in read_conllu(path):
            for t in sent:
                if t["upos"] == "VERB" and t["lemma"] in verbs:
                    forms[t["lemma"]].add(nfc(t["form"]).lower())
                elif is_vnoun(t):
                    v = vn.get(t["lemma"].lower())
                    if v in verbs:
                        forms[v].add(nfc(t["form"]).lower())
    for n, v in vn.items():
        if v in verbs:
            forms[v].add(n)
    return vn, forms


# ---------------- UD treebanks ----------------

def is_vnoun(t: dict) -> bool:
    # IDT marks verbal nouns VerbForm=Inf; other treebanks have used Vnoun.
    return "VerbForm=Inf" in t["feats"] or "VerbForm=Vnoun" in t["feats"]


def read_conllu(path: str):
    sent, meta = [], {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                if sent:
                    yield meta, sent
                sent, meta = [], {}
            elif line.startswith("#"):
                if " = " in line:
                    k, v = line[1:].split(" = ", 1)
                    meta[k.strip()] = v
            else:
                cols = line.split("\t")
                if "-" in cols[0] or "." in cols[0]:
                    continue
                sent.append({"id": int(cols[0]), "form": cols[1], "lemma": nfc(cols[2]), "upos": cols[3], "head": int(cols[6]), "deprel": cols[7], "feats": cols[5]})
    if sent:
        yield meta, sent


def ud_compounds(ud_dir: str, vn: dict[str, str]):
    """(verb, particles…) → list of (treebank, sent_id, text). Particles are those attached to the verb."""
    hits: dict[tuple, list] = defaultdict(list)
    for path in sorted(glob.glob(f"{ud_dir}/UD_Irish-*/*.conllu")):
        bank = os.path.basename(os.path.dirname(path))
        for meta, sent in read_conllu(path):
            by_id = {t["id"]: t for t in sent}
            kids: dict[int, list] = defaultdict(list)
            for t in sent:
                kids[t["head"]].append(t)

            def fixed(p: dict) -> bool:
                nxt = by_id.get(p["id"] + 1)
                return any(c["deprel"] == "fixed" for c in kids[p["id"]]) or bool(nxt and nxt["form"].lower() in COMPOUND_PREP_NEXT)
            for t in sent:
                verb = None
                if t["upos"] == "VERB":
                    verb = t["lemma"]
                elif is_vnoun(t) and t["lemma"].lower() in vn:
                    verb = vn[t["lemma"].lower()]
                if not verb:
                    continue
                adv, preps = None, []
                for k in kids[t["id"]]:
                    if k["lemma"] in ADVERBS and k["upos"] == "ADV":
                        adv = adv or k["lemma"]
                    elif k["upos"] == "ADP" and k["deprel"].startswith("obl") and k["lemma"] in PREP_FORMS and not fixed(k):
                        preps.append((k["id"], k["lemma"]))  # prepositional pronoun: orm, leis…
                    elif k["deprel"].startswith("obl"):
                        for c in kids[k["id"]]:
                            if c["deprel"] == "case" and c["lemma"] in PREP_FORMS and not fixed(c):
                                preps.append((c["id"], c["lemma"]))
                preps.sort()
                text = meta.get("text", " ".join(x["form"] for x in sent))
                ref = (bank, meta.get("sent_id", "?"), text)
                if adv:
                    hits[(verb, adv)].append(ref)
                for _, p in preps[:1]:
                    hits[(verb, p)].append(ref)
                    if adv:
                        hits[(verb, adv, p)].append(ref)
    return hits


# ---------------- Tatoeba (surface match, with English) ----------------

def tatoeba_examples(bundle: str, forms: dict[str, set[str]]):
    import duckdb

    con = duckdb.connect()
    head = f"{bundle}/example-tatoeba-v2"
    rows = con.execute(f"select resource_id, nodegroup_id, data from read_parquet('{head}/tiles_tatoeba_example.parquet')").fetchall()
    sents: dict = defaultdict(dict)
    for rid, ng, data in rows:
        d = json.loads(data)
        if ng.startswith(TT["sentence"]):
            sents[rid]["ga"] = nfc(val(d, TT["sentence"]) or "")
        elif ng.startswith(TT["sentence_en"]):
            sents[rid]["en"] = val(d, TT["sentence_en"])
        elif ng.startswith(TT["provenance"]):
            sents[rid]["id"] = val(d, TT["source_id"])
    out: dict[tuple, list] = defaultdict(list)
    tok = re.compile(r"[\wáéíóúÁÉÍÓÚ'-]+")
    for s in sents.values():
        ga = s.get("ga")
        if not ga or GAELIC_GRAVE.search(ga):
            continue
        words = [w.lower() for w in tok.findall(ga)]
        for verb, fs in forms.items():
            for i, w in enumerate(words):
                if w not in fs:
                    continue
                window = words[i + 1 : i + 6]
                adv = next((x for x in window if x in ADVERBS), None)
                prep = next((FORM_TO_PREP[x] for j, x in enumerate(window) if x in FORM_TO_PREP and (window[j + 1 : j + 2] or [""])[0] not in COMPOUND_PREP_NEXT), None)
                ref = ("Tatoeba", s.get("id", "?"), ga, s.get("en", ""))
                if adv:
                    out[(verb, adv)].append(ref)
                if prep:
                    out[(verb, prep)].append(ref)
                    if adv:
                        out[(verb, adv, prep)].append(ref)
                break
    return out


# ---------------- public-domain texts (Wikisource, Gutenberg…) ----------------

# Cló Gaelach writes lenition as a dot over the consonant.
DOTTED = str.maketrans({c: b + "h" for c, b in zip("ḃċḋḟġṁṗṡṫḂĊḊḞĠṀṖṠṪ", "bcdfgmpstBCDFGMPST")})
# Words common in Ulster writing and rare elsewhere. A rough signpost for which texts to read, not a classifier.
ULSTER_MARKERS = {"chan", "char", "cha", "inteacht", "ínteacht", "goidé", "caidé", "tchí", "tchíonn", "tchífeá",
                  "tchífidh", "domh", "fosta", "achan", "bhéarfaidh", "bhéarfainn", "bhéarfadh", "bhéarfas", "druid"}
ULSTER_RATE = 3.0  # markers per 1,000 words for a text to count as Ulster-leaning…
ULSTER_MIN_WORDS = 150  # …given enough words for the rate to mean something
# Common in Scottish Gaelic, rare in Irish of any spelling: tells Gàidhlig without grave accents apart.
GAIDHLIG_WORDS = {"tha", "gu", "ri", "thu", "bha", "agus'", "orra", "dhomh", "leam", "leat", "mo'n"}
# Function words the spelling pairs would misread (is → as, a → ag…): always taken as written.
AS_WRITTEN = {"is", "a", "an", "na", "go", "sé", "sí", "mé", "tú", "ar", "do", "le", "de", "as", "ó", "agus"}


def load_pairs(path: str | None) -> dict[str, set[str]]:
    """Pre-standard → standard word pairs (caighdean's pairs.txt). Ambiguous words keep every option."""
    pairs: dict[str, set[str]] = defaultdict(set)
    if path:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                w = line.rstrip("\n").split(" ", 1)
                if len(w) == 2 and w[0] != w[1]:
                    pairs[nfc(w[0]).lower()].add(nfc(w[1]).lower().split()[0])
    return pairs


def pd_texts(paths: list[str], forms: dict[str, set[str]], pairs: dict[str, set[str]]):
    """Surface-match verb + particles in public-domain texts, through the pre-standard → standard pairs.

    Returns (hits, works): hits maps a compound to (work, title, url, sentence, ulster-leaning?);
    works maps a work to its size and Ulster-marker rate.
    """
    form_to_verb: dict[str, set[str]] = defaultdict(set)
    for v, fs in forms.items():
        for f in fs:
            form_to_verb[f].add(v)
    tok = re.compile(r"[\w'’-]+")
    docs = []
    for path in paths:
        with open(path, encoding="utf-8") as fh:
            docs += [json.loads(line) for line in fh if line.strip()]
    works: dict[str, dict] = defaultdict(lambda: {"pages": 0, "words": 0, "markers": 0, "grave": 0, "gd": 0, "url": ""})
    for d in docs:
        words = [w.lower().strip("'’-") for w in tok.findall(nfc(d["text"]).translate(DOTTED))]
        wk = works[d["work"]]
        wk["pages"] += 1
        wk["words"] += len(words)
        wk["markers"] += sum(w in ULSTER_MARKERS for w in words)
        wk["grave"] += sum(bool(GAELIC_GRAVE.search(w)) for w in words)
        wk["gd"] += sum(w in GAIDHLIG_WORDS for w in words)
        wk["url"] = wk["url"] or d["url"].split("/wiki/")[0] + "/wiki/" + urllib.parse.quote(d["work"].replace(" ", "_"))
    for wk in works.values():
        wk["rate"] = 1000 * wk["markers"] / max(wk["words"], 1)
        # chan / cha are Scottish Gaelic too; a work full of grave accents is Gàidhlig, not Ulster Irish.
        wk["scottish"] = wk["grave"] > 0.02 * wk["words"] or wk["gd"] > 0.015 * wk["words"]
        wk["ulster"] = wk["rate"] >= ULSTER_RATE and wk["words"] >= ULSTER_MIN_WORDS and not wk["scottish"]
    hits: dict[tuple, list] = defaultdict(list)
    for d in docs:
        if works[d["work"]]["scottish"]:
            continue
        ulster = works[d["work"]]["ulster"]
        for sent in re.split(r"(?<=[.!?])\s+|\n+", nfc(d["text"]).translate(DOTTED)):
            words = [w.lower().strip("'’-") for w in tok.findall(sent)]
            if len(words) < 3 or GAELIC_GRAVE.search(sent):
                continue
            opts = [{w} | (set() if w in AS_WRITTEN else pairs.get(w, set())) for w in words]
            for i, o in enumerate(opts):
                verbs = set().union(*(form_to_verb.get(w, set()) for w in o))
                if not verbs:
                    continue
                window = opts[i + 1 : i + 6]
                adv = next((a for ws in window for a in ws if a in ADVERBS), None)
                prep = None
                for j, ws in enumerate(window):
                    nxt = window[j + 1] if j + 1 < len(window) else set()
                    p = next((FORM_TO_PREP[x] for x in ws if x in FORM_TO_PREP), None)
                    if p and not (nxt & COMPOUND_PREP_NEXT):
                        prep = p
                        break
                ref = (d["work"], d["title"], d["url"], sent.strip()[:400], ulster)
                for v in verbs:
                    if adv:
                        hits[(v, adv)].append(ref)
                    if prep:
                        hits[(v, prep)].append(ref)
                        if adv:
                            hits[(v, adv, prep)].append(ref)
                break
    return hits, works


# ---------------- main ----------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", required=True)
    ap.add_argument("--ud", required=True)
    ap.add_argument("--deck", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--texts", action="append", default=[], help="JSONL of public-domain texts (fetch_wikisource.py); repeatable")
    ap.add_argument("--pairs", help="caighdean's pairs.txt, to read pre-standard spelling")
    a = ap.parse_args()

    deck = json.load(open(a.deck, encoding="utf-8"))
    deck_verbs = {c["verb"] for c in deck["compounds"]}
    in_deck: dict[str, list] = defaultdict(list)
    for c in deck["compounds"]:
        in_deck[" ".join([c["verb"], *c["particles"]])].append((c["meaning"], bool(c.get("draft"))))

    wk = load_wiktionary(a.bundle)
    # Phrasal-verb headwords: a verb followed by river particles (adverb, preposition, or adverb + preposition).
    heads: dict[str, list] = {}
    all_verbs = {e["name"] for e in wk if "verb" in e["pos"] and " " not in e["name"]}
    for e in wk:
        w = e["name"].split()
        if len(w) >= 2 and w[0] in all_verbs and is_particle_seq(w[1:]) and e["senses"]:
            heads.setdefault(e["name"], []).extend(e["senses"])
    variants = fold_variants(heads)
    cand_verbs = deck_verbs | {h.split()[0] for h in heads}
    vn, forms = verb_lexicon(wk, cand_verbs, a.ud)
    ud = ud_compounds(a.ud, vn)
    tt = tatoeba_examples(a.bundle, {v: forms[v] for v in cand_verbs if forms.get(v)})
    pd, works = pd_texts(a.texts, {v: forms[v] for v in cand_verbs if forms.get(v)}, load_pairs(a.pairs)) if a.texts else ({}, {})

    keys = set(heads) | set(in_deck)
    for k, refs in ud.items():
        if k[0] in cand_verbs and len(refs) >= 2:
            keys.add(" ".join(k))
    rows = []
    for key in keys:
        w = key.split()
        k = tuple(w)
        ud_refs, tt_refs = ud.get(k, []), tt.get(k, [])
        pd_refs = sorted(pd.get(k, []), key=lambda r: not r[4])  # Ulster-leaning texts first
        ud_old = [r for r in ud_refs if r[0] in PRESTANDARD]
        ud_new = [r for r in ud_refs if r[0] not in PRESTANDARD]
        senses = [s for s in heads.get(key, []) if s.get("gloss") and not s["gloss"].startswith("Used other than")]
        also = variants.get(key, [])
        deck_now = in_deck.get(key, [])
        ulster = any("Ulster" in (s.get("dialect") or "") or "Ulster" in (s.get("gloss") or "") for s in heads.get(key, []))
        status = "in deck" if any(not d for _, d in deck_now) else ("draft in deck" if deck_now else ("new compound" if w[0] in deck_verbs else "new verb"))
        refs = sorted(ud_new, key=lambda r: EXAMPLE_ORDER.index(r[0]))[:3] + [("Tatoeba", sid, f"{ga} = {en}") for _, sid, ga, en in tt_refs[:2]] + ud_old[:1]
        examples = [f"{t} [{b} {sid}{', pre-standard' if b in PRESTANDARD else ''}, {LICENCES.get(b, '?')}]" for b, sid, t in refs]
        examples += [f"{t} [Wikisource: {title}{', Ulster-leaning' if ul else ''}, pre-standard, public domain]" for _, title, _, t, ul in pd_refs[:2]]
        # Signposts: where to look this up, not copies of what's there.
        links = []
        if senses:
            links.append(f"https://en.wiktionary.org/wiki/{key.replace(' ', '_')}#Irish")
        links += [f"https://tatoeba.org/en/sentences/show/{sid}" for _, sid, _, _ in tt_refs[:2] if sid and sid != "?"]
        links += [url for _, _, url, _, _ in pd_refs[:2]]
        links.append(f"https://www.teanglann.ie/en/fgb/{w[0]}")
        rows.append({
            "compound": key,
            "verb": w[0],
            "particles": " ".join(w[1:]),
            "status": status,
            "deck_meanings": "; ".join(f"{m}{' (draft)' if d else ''}" for m, d in deck_now),
            "wiktionary_senses": " | ".join([s["gloss"] for s in senses] + (["also " + ", ".join(also)] if also else [])),
            "wiktionary_ulster": "yes" if ulster else "",
            "ud_hits": len(ud_new),
            "ud_prestandard": len(ud_old),
            "tatoeba_hits": len(tt_refs),
            "pd_hits": len(pd_refs),
            "pd_ulster_hits": sum(1 for r in pd_refs if r[4]),
            "examples": "\n".join(examples),
            "lookup": "\n".join(links),
            "ulster_attested": "",
            "proposed_meaning": "",
            "phil_verdict": "",
            "notes": "",
        })
    order = {"in deck": 0, "draft in deck": 1, "new compound": 2, "new verb": 3}
    # Modern evidence counts in full; public-domain hits a quarter (older spelling, looser matching).
    rows.sort(key=lambda r: (order[r["status"]], -(r["ud_hits"] + r["tatoeba_hits"] + r["pd_hits"] / 4 + 3 * bool(r["wiktionary_senses"])), r["compound"]))

    os.makedirs(a.out, exist_ok=True)
    cols = list(rows[0].keys())
    with open(f"{a.out}/candidates.csv", "w", newline="", encoding="utf-8") as fh:
        wr = csv.DictWriter(fh, fieldnames=cols)
        wr.writeheader()
        wr.writerows(rows)
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = "candidates"
        ws.append(cols)
        for r in rows:
            ws.append([r[c] for c in cols])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        widths = {"compound": 18, "verb": 10, "particles": 12, "status": 14, "deck_meanings": 28, "wiktionary_senses": 60, "wiktionary_ulster": 10, "ud_hits": 8, "ud_prestandard": 8, "tatoeba_hits": 8, "pd_hits": 8, "pd_ulster_hits": 8, "examples": 90, "lookup": 45, "ulster_attested": 14, "proposed_meaning": 22, "phil_verdict": 14, "notes": 30}
        for i, c in enumerate(cols):
            ws.column_dimensions[get_column_letter(i + 1)].width = widths.get(c, 14)
        yellow = PatternFill("solid", fgColor="FFF2CC")
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(wrap_text=True, vertical="top")
                if cols[cell.column - 1] in ("ulster_attested", "proposed_meaning", "phil_verdict", "notes"):
                    cell.fill = yellow
        ws.freeze_panes = "B2"
        wb.save(f"{a.out}/candidates.xlsx")
    except ImportError:
        print("openpyxl not installed: wrote CSV only")
    print(f"{len(rows)} rows → {a.out}/candidates.csv")
    by = Counter(r["status"] for r in rows)
    print(dict(by))
    if works:
        # The signpost list: which public-domain works were read, and how Ulster-leaning each looks.
        with open(f"{a.out}/sources-public-domain.csv", "w", newline="", encoding="utf-8") as fh:
            wr = csv.writer(fh)
            wr.writerow(["work", "pages", "words", "ulster_markers_per_1000", "ulster_leaning", "scottish_gaelic", "url"])
            for name, wk in sorted(works.items(), key=lambda kv: (not kv[1]["ulster"], -kv[1]["rate"])):
                wr.writerow([name, wk["pages"], wk["words"], f"{wk['rate']:.1f}", "yes" if wk["ulster"] else "", "yes" if wk["scottish"] else "", wk["url"]])
        print(f"{len(works)} public-domain works → {a.out}/sources-public-domain.csv")


if __name__ == "__main__":
    main()
