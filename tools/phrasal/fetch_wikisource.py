#!/usr/bin/env python3
"""Fetch the Irish-language texts on multilingual Wikisource (Category:Gaeilge, recursively) as JSONL.

Each line: {"title", "work", "category", "text", "url"}. The text is plain text stripped from
wikitext, and pages that transclude scans (<pages index=…/>) are filled in from the Page: namespace.
Wikisource texts are public domain or freely licensed; check each work's own page for its status.

Usage:
  python3 tools/phrasal/fetch_wikisource.py --out DIR

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
        if c in seen:
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


def wikitext(titles: list[str]) -> dict[str, str]:
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i : i + 50]
        d = q(action="query", prop="revisions", rvprop="content", rvslots="main", titles="|".join(batch), redirects="1")
        for p in d["query"]["pages"]:
            revs = p.get("revisions")
            if revs:
                out[p["title"]] = revs[0]["slots"]["main"]["content"]
        print(f"  {min(i + 50, len(titles))}/{len(titles)}", file=sys.stderr)
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
    wt = wikitext(sorted(pages))
    scans = sorted({t for w in wt.values() for m in PAGES_TAG.finditer(w) for t in page_titles(m.group(1))})
    print(f"{len(scans)} scan pages transcluded; fetching…", file=sys.stderr)
    scan_wt = wikitext(scans) if scans else {}
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
