# -*- coding: utf-8 -*-
"""Assemble app/data/pages.js : la pagination EXACTE du mushaf de Médine
(King Fahd Complex, layout v1) pour les juz 1-2 (pages 1 à 41).

Source : quran.com API v4, mot à mot avec `code_v1` (un glyphe par mot,
rendu par la police de LA page : app/fonts/qcf/QCF_P###.woff2), `v1_page`
et `line_number`. Le médaillon de fin de verset est un « mot » de type end.

Sortie : window.PAGES = { "3": { "7": [ {k:"2:11", g:"ﮑ"}, ... ], ... }, ... }
(page -> ligne -> mots dans l'ordre logique ; le moteur les rend de droite
à gauche). Cache brut dans tools/cache/words_v1.json.
"""
import json
import os
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "app", "data", "pages.js")
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
    cache_path = os.path.join(CACHE, "words_v1.json")
    if os.path.exists(cache_path):
        return json.load(open(cache_path, encoding="utf-8"))
    verses = []
    for juz in juz_list:
        page = 1
        while page:
            url = (f"{QCOM}/verses/by_juz/{juz}?words=true"
                   f"&word_fields=code_v1,line_number,v1_page&per_page=50&page={page}")
            d = get_json(url)
            for v in d["verses"]:
                verses.append({
                    "key": v["verse_key"],
                    "words": [{
                        "type": w["char_type_name"],
                        "code": w.get("code_v1", ""),
                        "page": w.get("v1_page"),
                        "line": w.get("line_number"),
                        "pos": w.get("position"),
                    } for w in v["words"]],
                })
            print(f"juz {juz} page {page}/{d['pagination']['total_pages']}", flush=True)
            page = d["pagination"]["next_page"]
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(verses, f, ensure_ascii=False)
    return verses


def main():
    import sys
    juz_list = [int(x) for x in sys.argv[1:]] or [1, 2]
    verses = fetch_words(juz_list)
    pages = {}
    for v in verses:
        for w in v["words"]:
            if not w["code"] or w["page"] is None or w["line"] is None:
                raise SystemExit(f"mot sans glyphe/page/ligne : {v['key']} pos {w['pos']}")
            line = pages.setdefault(str(w["page"]), {}).setdefault(str(w["line"]), [])
            line.append({"k": v["key"], "g": w["code"]})

    n_words = sum(len(l) for p in pages.values() for l in p.values())
    n_lines = sum(len(p) for p in pages.values())
    pnums = sorted(int(p) for p in pages)
    print(f"{len(pages)} pages ({pnums[0]}..{pnums[-1]}), {n_lines} lignes, {n_words} mots")

    # polices présentes ?
    for p in pnums:
        f = os.path.join(HERE, "..", "app", "fonts", "qcf", "QCF_P%03d.woff2" % p)
        if not os.path.exists(f):
            raise SystemExit(f"police manquante : {f}")

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("window.PAGES = ")
        f.write(json.dumps(pages, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print(f"OK -> {OUT} ({os.path.getsize(OUT)//1024} Ko)")


if __name__ == "__main__":
    main()
