# -*- coding: utf-8 -*-
"""Corpus d'audit LOCAL des tafsirs (évite les allers-retours API pendant
les vérifications de contenu ; l'API reste le secours et l'arbitre).

    python tools/tafsir_local.py 2:17            # tous les corpus
    python tools/tafsir_local.py 2:17 ar_ibn     # un corpus précis
    python tools/tafsir_local.py --grep "منافق" ar_mokh   # recherche plein texte

Corpus (tools/cache/) :
  ar_ibn   Ibn Kathîr arabe intégral      (822/823 versets, API quran.com id 14)
  ar_sadi  As-Sa'dî arabe                 (808/823, API quran.com id 91)
  ar_mokh  al-Mukhtaṣar arabe             (SQLite QuranEnc arabic_mokhtasar)
  fr_mokh  al-Mukhtaṣar français V1.0.0   (SQLite QuranEnc french_mokhtasar)

Les quelques versets absents (503 persistants de l'API) sont signalés à
l'affichage : y retourner par l'API le jour où ils comptent.

Rappel de méthode ([[feedback-contenu-islamique]]) : vérifier les positions
des mufassirin sur l'ARABE original ; le français du Mukhtaṣar est une
traduction officielle, pas une preuve du propos d'un autre mufassir.
"""
import html
import io
import json
import os
import re
import sqlite3
import sys

# console Windows en cp1252 : l'arabe passe quand même
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
SQLITES = {
    "ar_mokh": os.path.join(CACHE, "quranenc", "arabic_mokhtasar.sqlite"),
    "fr_mokh": os.path.join(CACHE, "quranenc", "french_mokhtasar.sqlite"),
}
JSONS = {
    "ar_ibn": os.path.join(CACHE, "tafsir_corpus", "ar-ibn-kathir.json"),
    "ar_sadi": os.path.join(CACHE, "tafsir_corpus", "ar-as-sadi.json"),
}
_charges = {}


def _json(corpus):
    if corpus not in _charges:
        p = JSONS[corpus]
        _charges[corpus] = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    return _charges[corpus]


def strip_html(t):
    t = re.sub(r"<[^>]+>", " ", t or "")
    return re.sub(r"[ \t]+", " ", html.unescape(t)).strip()


def get(corpus, key):
    if corpus in JSONS:
        return _json(corpus).get(key)
    db = SQLITES.get(corpus)
    if not db or not os.path.exists(db):
        return None
    s, a = key.split(":")
    row = sqlite3.connect(db).execute(
        "SELECT translation FROM translations WHERE sura=? AND aya=?",
        (int(s), int(a))).fetchone()
    return row[0] if row else None


def grep(corpus, motif):
    hits = []
    if corpus in JSONS:
        for k, t in _json(corpus).items():
            if motif in t:
                i = t.index(motif)
                hits.append((k, t[max(0, i - 90):i + 160]))
        return sorted(hits, key=lambda h: tuple(map(int, h[0].split(":"))))
    db = SQLITES.get(corpus)
    if not db or not os.path.exists(db):
        return hits
    for s, a, t in sqlite3.connect(db).execute(
            "SELECT sura, aya, translation FROM translations WHERE translation LIKE ?",
            (f"%{motif}%",)):
        i = t.index(motif)
        hits.append((f"{s}:{a}", t[max(0, i - 90):i + 160]))
    return hits


def main():
    args = [a for a in sys.argv[1:]]
    if not args:
        raise SystemExit(__doc__)
    if args[0] == "--grep":
        motif = args[1]
        corpus = args[2] if len(args) > 2 else "ar_ibn"
        hits = grep(corpus, motif)
        print(f"{len(hits)} occurrence(s) de « {motif} » dans {corpus}")
        for k, ctx in hits[:20]:
            print(f"\n=== {k} ===\n{ctx}")
        return
    key = args[0]
    corpora = args[1:] or ["ar_ibn", "ar_sadi", "ar_mokh", "fr_mokh"]
    for c in corpora:
        t = get(c, key)
        print(f"\n=== {key} · {c} ===")
        print(t if t else "(absent du corpus local : passer par l'API)")


if __name__ == "__main__":
    main()
