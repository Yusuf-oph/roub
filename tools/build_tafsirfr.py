# -*- coding: utf-8 -*-
"""Génère app/data/tafsirfr/jXrY.js : le tafsir français verset par verset
pour chaque rub, à partir de la base officielle QuranEnc.

Source : « French Translation of Al-Mukhtasar in Interpreting the Noble
Quran », Tafsir Center for Quranic Studies, V1.0.0 (03/10/2019), via
QuranEnc.com (tools/cache/quranenc/french_mokhtasar.sqlite).
Licence : re-publication autorisée SANS AUCUNE MODIFICATION, avec
attribution (éditeur + QuranEnc.com) et numéro de version affichés
(texte intégral archivé : arbitrage/licences/). Le texte est donc écrit
VERBATIM : toute retouche est interdite.

    python tools/build_tafsirfr.py
"""
import json
import os
import re
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
DB = os.path.join(HERE, "cache", "quranenc", "french_mokhtasar.sqlite")
OUT = os.path.join(APP, "data", "tafsirfr")

VERSION_TAFSIR = "V1.0.0 (03/10/2019)"


def load_quran_keys():
    """{rid: [clés 's:a' dans l'ordre]} depuis les app/data/quran/*.js
    (fichiers machine-générés : JSON pur après le signe =)."""
    out = {}
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        m = re.search(r"window\.QURAN\[\"([^\"]+)\"\] = (\{.*\});", txt, re.S)
        obj = json.loads(m.group(2))
        out[m.group(1)] = [v["k"] for v in obj["verses"]]
    return out


def main():
    db = sqlite3.connect(DB)
    cur = db.cursor()
    rubs = load_quran_keys()
    os.makedirs(OUT, exist_ok=True)
    total = 0
    poids = 0
    for rid, keys in rubs.items():
        d = {}
        for k in keys:
            s, a = k.split(":")
            row = cur.execute(
                "SELECT translation FROM translations WHERE sura=? AND aya=?",
                (int(s), int(a))).fetchone()
        # un trou dans la base serait une anomalie majeure : on s'arrête
            if not row or not (row[0] or "").strip():
                raise SystemExit(f"tafsir manquant pour {k}")
            d[k] = row[0]
        path = os.path.join(OUT, rid + ".js")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("/* Généré par tools/build_tafsirfr.py — NE PAS ÉDITER.\n"
                    "   « French Translation of Al-Mukhtasar in Interpreting the Noble Quran »,\n"
                    "   Tafsir Center for Quranic Studies, "
                    f"{VERSION_TAFSIR}, via QuranEnc.com.\n"
                    "   Texte reproduit sans modification (conditions : QuranEnc.com). */\n")
            f.write("window.TAFSIRFR = window.TAFSIRFR || {};\n")
            f.write(f"window.TAFSIRFR[{json.dumps(rid)}] = ")
            f.write(json.dumps(d, ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")
        total += len(d)
        poids += os.path.getsize(path)
    print(f"tafsirfr : {len(rubs)} rubs, {total} versets, {poids // 1024} Ko au total")


if __name__ == "__main__":
    main()
