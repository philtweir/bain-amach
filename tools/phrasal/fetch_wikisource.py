#!/usr/bin/env python3
"""Fetch the Irish-language texts on multilingual Wikisource (Category:Gaeilge, recursively) as JSONL.

Each line: {"title", "work", "category", "text", "url"}. The text is plain text stripped from
wikitext, and pages that transclude scans (<pages index=…/>) are filled in from the Page: namespace.
Wikisource texts are public domain or freely licensed; check each work's own page for its status.

Usage:
  python3 tools/phrasal/fetch_wikisource.py --out DIR

Fetched wikitext is cached in DIR, so an interrupted run picks up where it stopped.

It is slow on purpose: the API rate-limits shared addresses hard, so it batches 50 titles a
request, pauses between requests and honours Retry-After.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://wikisource.org/w/api.php"
UA = "bain-amach-research/0.1 (https://github.com/philtweir/bain-amach)"
PAUSE = 2.0
# Old and Middle Irish are no use for modern compounds, and their scans are most of the page count.
SKIP_CATEGORIES = {"Category:Sean-Ghaeilge", "Category:Meán-Ghaeilge"}


def q(**p):
    p.update(format="json", formatversion="2", maxlag="5")
    data = urllib.parse.urlencode(p).encode()
    for _ in range(15):
        req = urllib.request.Request(API, data=data, headers={"User-Agent": UA})
        try:
            out = json.load(urllib.request.urlopen(req, timeout=60))
            time.sleep(PAUSE)
            return out
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get("retry-after") or 15) + 1
            print(f"  {e.code}, waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit("Wikisource kept refusing; try again later")


def members(root: str):
    seen, pages, todo = set(), {}, [root]
    while todo:
        c = todo.pop()
        if c in seen or c in SKIP_CATEGORIES:
            continue
        seen.add(c)
        cont: dict = {}
        while True:
            d = q(action="query", list="categorymembers", cmtitle=c, cmlimit="500", **cont)
            for m in d["query"]["categorymembers"]:
                if m["ns"] == 14:
                    todo.append(m["title"])
                elif m["ns"] == 0:
                    pages.setdefault(m["title"], c)
            if "continue" not in d:
                break
            cont = d["continue"]
    return pages


def wikitext(titles: list[str], cache_path: str) -> dict[str, str]:
    """Fetch in batches of 50, keeping everything fetched in a cache file so a rerun resumes."""
    out: dict[str, str] = {}
    if os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as fh:
            out = json.load(fh)
    todo = [t for t in titles if t not in out]
    print(f"  {len(titles) - len(todo)} cached, {len(todo)} to fetch", file=sys.stderr)
    for i in range(0, len(todo), 50):
        batch = todo[i : i + 50]
        d = q(action="query", prop="revisions", rvprop="content", rvslots="main", titles="|".join(batch), redirects="1")
        for p in d["query"]["pages"]:
            revs = p.get("revisions")
            out[p["title"]] = revs[0]["slots"]["main"]["content"] if revs else ""
        for t in batch:  # missing pages and redirects: don't ask again
            out.setdefault(t, "")
        with open(cache_path + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False)
        os.replace(cache_path + ".tmp", cache_path)
        print(f"  {min(i + 50, len(todo))}/{len(todo)}", file=sys.stderr)
    return out


PAGES_TAG = re.compile(r"<pages\s+([^>]*?)/?>", re.I)


def page_titles(tag_attrs: str) -> list[str]:
    a = dict(re.findall(r'(\w+)\s*=\s*"?([^"\s/>]+)"?', tag_attrs))
    index = a.get("index")
    if not index:
        return []
    try:
        lo, hi = int(a.get("from", 1)), int(a.get("to", a.get("from", 1)))
    except ValueError:
        return []
    return [f"Page:{index}/{n}" for n in range(lo, min(hi, lo + 400) + 1)]


def strip(wt: str) -> str:
    s = re.sub(r"<noinclude>.*?</noinclude>", " ", wt, flags=re.S)
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", " ", s, flags=re.S)
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    for _ in range(5):  # innermost templates first
        s = re.sub(r"\{\{[^{}]*\}\}", " ", s)
    s = re.sub(r"\{\|.*?\|\}", " ", s, flags=re.S)
    s = re.sub(r"\[\[(?:Category|Catagóir|File|Image|Íomhá):[^\]]*\]\]", " ", s, flags=re.I)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s*([^\]]*)\]", r"\1", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"'''?|^[=:;*#]+|=+$", "", s, flags=re.M)
    s = html.unescape(s)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", s)).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--root", default="Category:Gaeilge")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    print("listing…", file=sys.stderr)
    pages = members(a.root)
    print(f"{len(pages)} pages; fetching…", file=sys.stderr)
    wt = {t: w for t, w in wikitext(sorted(pages), f"{a.out}/cache-pages.json").items() if t in pages and w}
    scans = sorted({t for w in wt.values() for m in PAGES_TAG.finditer(w) for t in page_titles(m.group(1))})
    print(f"{len(scans)} scan pages transcluded; fetching…", file=sys.stderr)
    scan_wt = wikitext(scans, f"{a.out}/cache-scans.json") if scans else {}
    n = 0
    with open(f"{a.out}/wikisource-ga.jsonl", "w", encoding="utf-8") as fh:
        for title, w in sorted(wt.items()):
            body = PAGES_TAG.sub(lambda m: "\n".join(scan_wt.get(t, "") for t in page_titles(m.group(1))), w)
            text = strip(body)
            if len(text) < 40:
                continue
            fh.write(json.dumps({
                "title": title,
                "work": title.split("/")[0],
                "category": pages.get(title, ""),
                "text": text,
                "url": "https://wikisource.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
            }, ensure_ascii=False) + "\n")
            n += 1
    print(f"{n} texts → {a.out}/wikisource-ga.jsonl")


if __name__ == "__main__":
    main()
