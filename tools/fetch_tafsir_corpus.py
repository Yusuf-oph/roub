# -*- coding: utf-8 -*-
"""Constitue le corpus d'audit LOCAL des tafsirs arabes intégraux, pour les
versets couverts par l'appli (823), via l'API publique quran.com.

    python tools/fetch_tafsir_corpus.py            # Ibn Kathîr + As-Sa'dî
    python tools/fetch_tafsir_corpus.py 14         # un seul id

Écrit tools/cache/tafsir_corpus/<slug>.json : {"s:a": "texte", ...}.
Les gros tafsirs (Ibn Kathîr) pèsent quelques Mo : cache gitignoré,
régénérable. Reprise automatique si le fichier existe déjà (on ne
re-télécharge que les clés manquantes).

Note : QUL propose ces mêmes textes en un seul fichier, mais le
téléchargement exige un compte connecté (401) : voie non empruntée.
"""
import json
import os
import re
import sys
import time

from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
OUT = os.path.join(HERE, "cache", "tafsir_corpus")

TAFSIRS = {14: "ar-ibn-kathir", 91: "ar-as-sadi", 15: "ar-at-tabari"}


def keys_de_lappli():
    out = []
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        m = re.search(r"window\.QURAN\[\"[^\"]+\"\] = (\{.*\});", txt, re.S)
        out += [v["k"] for v in json.loads(m.group(1))["verses"]]
    return out


def strip_html(t):
    t = re.sub(r"<[^>]+>", " ", t or "")
    return re.sub(r"[ \t]{2,}", " ", t).strip()


def main():
    ids = [int(a) for a in sys.argv[1:]] or list(TAFSIRS)
    os.makedirs(OUT, exist_ok=True)
    keys = keys_de_lappli()
    s = requests.Session(impersonate="chrome")
    for tid in ids:
        slug = TAFSIRS.get(tid, str(tid))
        path = os.path.join(OUT, slug + ".json")
        data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
        todo = [k for k in keys if k not in data]
        print(f"{slug} : {len(data)} déjà en cache, {len(todo)} à récupérer", flush=True)
        for i, k in enumerate(todo, 1):
            try:
                r = s.get(f"https://api.quran.com/api/v4/tafsirs/{tid}/by_ayah/{k}",
                          timeout=60)
                r.raise_for_status()
                data[k] = strip_html(r.json().get("tafsir", {}).get("text", ""))
            except Exception as e:  # réseau : on garde ce qui est acquis
                print(f"  échec {k} : {str(e)[:80]}", flush=True)
                continue
            if i % 50 == 0:
                json.dump(data, open(path, "w", encoding="utf-8"),
                          ensure_ascii=False)
                print(f"  {i}/{len(todo)}", flush=True)
            time.sleep(0.12)
        json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False)
        print(f"{slug} : {len(data)} versets, {os.path.getsize(path)//1024} Ko",
              flush=True)


if __name__ == "__main__":
    main()
