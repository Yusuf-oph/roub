# -*- coding: utf-8 -*-
"""Assemble app/data/pages2.js : pagination du mushaf pour le mode « pages
colorées tajwid » (polices COLRv1 du KFGQPC, app/fonts/qcf4/p<N>.woff2).

Sortie : window.PAGES2 = { "3": { "7": [ {k, g}, ... ], ... }, ... }

⚠ DEUX SOURCES, ET C'EST VOULU (corrigé le 2026-07-28) :
- les GLYPHES viennent de l'API quran.com (`code_v2`), cache words_v2.json ;
- les LIGNES viennent de la mise en page **« QPC v4 tajweed »** de QUL,
  `tools/cache/qul/extrait/qpc-v4-tajweed-15-lines.db`.

POURQUOI. Jusqu'au 28/07 les lignes venaient de `v2_page` + `line_number` de
quran.com, c'est-à-dire de la mise en page **V2 1421 H**. Or les polices V4
tajwid sont dessinées pour une AUTRE mise en page, et l'écart est visible :
sur 38 de nos 64 pages, une ligne sur sept ne tombe pas au même endroit.
Mesuré sur huit pages, en largeur naturelle des lignes (l'imprimé est justifié,
donc les lignes d'une bonne mise en page ont toutes la même largeur) :

    découpage V2 1421 H (l'ancien) : dispersion 2,8 % en moyenne, 452 à 520 px
    découpage « QPC v4 tajweed »   : dispersion 0,41 %,           474 à 495 px

`.qline` centrant les lignes sans les justifier, une ligne trop courte rentrait
visiblement des deux côtés. Les PAGES, elles, sont identiques dans les deux
mises en page (vérifié sur les 823 versets) : seul le regroupement change, les
glyphes ne bougent pas et les index de mot `data-w` non plus, donc l'audio et
le soulignage ne sont pas concernés.

⚠ La base QUL n'est PAS récupérable sans compte : c'est un cache déposé à la
main (gitignoré comme tout tools/cache/). Elle se retéléchargera depuis
https://qul.tarteel.ai/resources/mushaf-layout (« KFGQPC V4 layout »).
quran.com ne peut pas la remplacer : son API n'expose que `v1_page` et
`v2_page`, le paramètre `mushaf` ne change pas ces champs (vérifié).
"""
import json
import os
import sqlite3
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "app", "data", "pages2.js")
QCOM = "https://api.quran.com/api/v4"
LAYOUT = os.path.join(CACHE, "qul", "extrait", "qpc-v4-tajweed-15-lines.db")
WBW = os.path.join(CACHE, "qul", "extrait", "digital-khatt-v2-wbw.db")


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


def lignes_officielles():
    """{page: [(ligne, clé de verset), …]} dans l'ordre de lecture, d'après la
    mise en page « QPC v4 tajweed » de QUL.

    Les identifiants de mot de la table de mise en page pointent dans la table
    `words` du même corpus, d'où la seconde base : elle ne sert qu'à traduire
    un identifiant en `sourate:verset`."""
    for f in (LAYOUT, WBW):
        if not os.path.exists(f):
            raise SystemExit(
                f"mise en page officielle absente : {f}\n"
                "  À déposer à la main depuis https://qul.tarteel.ai/resources"
                " (« KFGQPC V4 layout » en SQLite, et le mot à mot Digital Khatt).")
    wbw = sqlite3.connect(WBW)
    loc = {i: l.rsplit(":", 1)[0] for i, l in wbw.execute("select id,location from words")}
    lay = sqlite3.connect(LAYOUT)
    out = {}
    for pg, ln, a, b in lay.execute(
            "select page_number,line_number,first_word_id,last_word_id from pages"
            " where line_type='ayah' and first_word_id!='' order by page_number,line_number"):
        for i in range(int(a), int(b) + 1):
            if i in loc:
                out.setdefault(pg, []).append((ln, loc[i]))
    return out


def main():
    juz_list = [int(x) for x in sys.argv[1:]] or [1, 2]
    verses = fetch_words(juz_list)
    officiel = lignes_officielles()

    # nos glyphes, page par page, dans l'ordre de lecture (celui de quran.com)
    par_page = {}
    for v in verses:
        for w in v["words"]:
            if not w["code"] or w["page"] is None:
                raise SystemExit(f"mot sans glyphe ou sans page : {v['key']}")
            par_page.setdefault(int(w["page"]), []).append((v["key"], w["code"], w["line"]))

    pages, repli = {}, []
    for p, mots in par_page.items():
        off = officiel.get(p)
        if not off:
            raise SystemExit(f"page {p} absente de la mise en page officielle")
        # Appariement par RANG DANS LA PAGE : les deux mises en page portent
        # exactement les mêmes mots sur les mêmes pages (vérifié sur les 823
        # versets), donc le n-ième glyphe est le n-ième mot. Seule exception
        # connue : 2:181, où deux mots partagent un glyphe (page 27).
        if len(off) != len(mots):
            repli.append((p, len(mots), len(off)))
        for i, (k, g, ligne_v2) in enumerate(mots):
            if i < len(off) and off[i][1] == k:
                ligne = off[i][0]
            else:
                # décalage : on retombe sur la ligne du premier mot officiel de
                # ce verset, faute de mieux, et on le signale.
                cand = [l for l, kk in off if kk == k]
                ligne = cand[0] if cand else ligne_v2
            pages.setdefault(str(p), {}).setdefault(str(ligne), []) \
                 .append({"k": k, "g": g})
    if repli:
        print("⚠ pages où les comptes diffèrent (appariement dégradé) :", repli)

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
