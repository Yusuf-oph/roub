# -*- coding: utf-8 -*-
"""Assemble app/data/pages2.js : pagination du mushaf, layout v2/v4, pour le
mode « pages colorées tajwid » (polices COLRv1 officielles de quran.com,
app/fonts/qcf4/p<N>.woff2).

Même principe que build_pages.py (layout v1) mais avec mushaf=1 :
`code_v2` (un glyphe par mot) + `v2_page` + `line_number` du layout v2.
Sortie : window.PAGES2 = { "3": { "7": [ {k, g}, ... ], ... }, ... }
Cache : tools/cache/words_v2.json.
"""
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "app", "data", "pages2.js")
QCOM = "https://api.quran.com/api/v4"


def get_json(url, retries=3):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "quran-hifz/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if i == retries - 1:
                raise
            print(f"  retry {i+1} ({e})", flush=True)
            time.sleep(2)


def fetch_words(juz_list):
    cache_path = os.path.join(CACHE, "words_v2.json")
    if os.path.exists(cache_path):
        return json.load(open(cache_path, encoding="utf-8"))
    verses = []
    for juz in juz_list:
        page = 1
        while page:
            url = (f"{QCOM}/verses/by_juz/{juz}?words=true&mushaf=1"
                   f"&word_fields=code_v2,line_number,v2_page&per_page=50&page={page}")
            d = get_json(url)
            for v in d["verses"]:
                verses.append({
                    "key": v["verse_key"],
                    "words": [{
                        "code": w.get("code_v2", ""),
                        "page": w.get("v2_page"),
                        "line": w.get("line_number"),
                    } for w in v["words"]],
                })
            print(f"juz {juz} page {page}/{d['pagination']['total_pages']}", flush=True)
            page = d["pagination"]["next_page"]
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(verses, f, ensure_ascii=False)
    return verses


def main():
    juz_list = [int(x) for x in sys.argv[1:]] or [1, 2]
    verses = fetch_words(juz_list)
    pages = {}
    for v in verses:
        for w in v["words"]:
            if not w["code"] or w["page"] is None or w["line"] is None:
                raise SystemExit(f"mot sans glyphe/page/ligne : {v['key']}")
            pages.setdefault(str(w["page"]), {}).setdefault(str(w["line"]), []) \
                 .append({"k": v["key"], "g": w["code"]})

    pnums = sorted(int(p) for p in pages)
    print(f"{len(pages)} pages ({pnums[0]}..{pnums[-1]})")
    for p in pnums:
        f = os.path.join(HERE, "..", "app", "fonts", "qcf4", f"p{p}.woff2")
        if not os.path.exists(f):
            raise SystemExit(f"police colorée manquante : {f}")

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.PAGES2 = ")
        f.write(json.dumps(pages, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print(f"OK -> {OUT} ({os.path.getsize(OUT)//1024} Ko)")


if __name__ == "__main__":
    main()
