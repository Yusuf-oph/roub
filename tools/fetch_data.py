# -*- coding: utf-8 -*-
"""Récupère les données sources du projet quran-hifz (juz 1-2, Hafs).

Sorties dans tools/cache/ :
  - verses.json      : 259 versets {verse_key, rub_el_hizb_number, text_uthmani,
                       text_uthmani_tajweed, text_imlaei, trad (Hamidullah)}
  - quran_full.json  : Qur'an complet (uthmani + simple) pour vérifier les citations
  - translit_ref.json: translittération anglaise établie (QA de translit.py)
  - rubs.json        : bornes calculées des 16 rubs

Aucune donnée n'est réécrite à la main : tout vient des API (quran.com v4,
alquran.cloud), stocké tel quel.
"""
import json
import os
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
os.makedirs(CACHE, exist_ok=True)

QCOM = "https://api.quran.com/api/v4"
ACLOUD = "https://api.alquran.cloud/v1"
FIELDS = "text_uthmani,text_uthmani_tajweed,text_imlaei"
HAMIDULLAH = 31  # id quran.com de la traduction Muhammad Hamidullah


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


def fetch_verses(juz_list):
    verses = []
    for juz in juz_list:
        page = 1
        while page:
            url = (f"{QCOM}/verses/by_juz/{juz}?fields={FIELDS}"
                   f"&translations={HAMIDULLAH}&per_page=50&page={page}")
            d = get_json(url)
            for v in d["verses"]:
                verses.append({
                    "key": v["verse_key"],
                    "rub": v["rub_el_hizb_number"],
                    "uthmani": v["text_uthmani"],
                    "tajweed": v["text_uthmani_tajweed"],
                    "imlaei": v["text_imlaei"],
                    "trad": v["translations"][0]["text"] if v.get("translations") else "",
                })
            print(f"juz {juz} page {page}/{d['pagination']['total_pages']}", flush=True)
            page = d["pagination"]["next_page"]
    with open(os.path.join(CACHE, "verses.json"), "w", encoding="utf-8") as f:
        json.dump(verses, f, ensure_ascii=False, indent=1)
    return verses


def fetch_full_quran():
    out = {}
    for edition in ("quran-uthmani", "quran-simple"):
        print(f"Qur'an complet : {edition}...", flush=True)
        d = get_json(f"{ACLOUD}/quran/{edition}")
        text = {}
        for surah in d["data"]["surahs"]:
            for aya in surah["ayahs"]:
                text[f"{surah['number']}:{aya['numberInSurah']}"] = aya["text"]
        out[edition] = text
    with open(os.path.join(CACHE, "quran_full.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    return out


def fetch_translit_ref():
    print("Translittération de référence (en.transliteration)...", flush=True)
    d = get_json(f"{ACLOUD}/quran/en.transliteration")
    text = {}
    for surah in d["data"]["surahs"]:
        for aya in surah["ayahs"]:
            text[f"{surah['number']}:{aya['numberInSurah']}"] = aya["text"]
    with open(os.path.join(CACHE, "translit_ref.json"), "w", encoding="utf-8") as f:
        json.dump(text, f, ensure_ascii=False)


def compute_rubs(verses):
    rubs = {}
    for v in verses:
        rubs.setdefault(v["rub"], []).append(v["key"])
    table = {}
    for num, keys in sorted(rubs.items()):
        table[num] = {"debut": keys[0], "fin": keys[-1], "n": len(keys)}
    with open(os.path.join(CACHE, "rubs.json"), "w", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, indent=1)
    return table


if __name__ == "__main__":
    juz_list = [int(x) for x in sys.argv[1:]] or [1, 2]
    verses = fetch_verses(juz_list)
    print(f"{len(verses)} versets récupérés (juz {juz_list})")
    table = compute_rubs(verses)
    for num, r in table.items():
        print(f"rub {num}: {r['debut']} -> {r['fin']} ({r['n']} versets)")
    fetch_full_quran()
    fetch_translit_ref()
    print("OK")
