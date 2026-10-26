#!/usr/bin/env python3
"""Pull the bot faces out of the design tool's characters sheet, one SVG file per species and mood.

Usage:
  python3 tools/faces/extract.py SHEET.svg src/ui/faces

The sheet holds each face as a nested <svg aria-label="broc-neutral" …>. The first of each label is
written to OUT/<label>.svg as a standalone file (its own xmlns and viewBox, no position or id), with
its clip-path ids made local so that files never clash.
"""
import os
import re
import sys

SPECIES = ("broc", "corr", "giorria")
MOODS = ("neutral", "thinking", "pleased", "stuck", "beaten")


def main(sheet: str, out: str) -> None:
    src = open(sheet, encoding="utf-8").read()
    os.makedirs(out, exist_ok=True)
    found = {}
    for m in re.finditer(r'<svg id="([^"]+)" aria-label="([^"]+)"([^>]*)>(.*?)</svg>', src, flags=re.S):
        sid, label, attrs, body = m.groups()
        if label in found or not re.fullmatch(r"[a-z]+-[a-z]+", label):
            continue
        vb = re.search(r'viewBox="([^"]+)"', attrs).group(1)
        # clip-path ids are prefixed with the instance id (i2-btb00); make them local to the file.
        body = body.replace(sid.replace("-art", "") + "-", "f-")
        found[label] = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>\n'
    missing = [f"{s}-{m}" for s in SPECIES for m in MOODS if f"{s}-{m}" not in found]
    if missing:
        sys.exit("missing faces: " + ", ".join(missing))
    for label, svg in found.items():
        if label.split("-")[0] in SPECIES:
            with open(os.path.join(out, label + ".svg"), "w", encoding="utf-8") as fh:
                fh.write(svg)
    print(f"{len(found)} faces → {out}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
