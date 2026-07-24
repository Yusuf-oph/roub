# -*- coding: utf-8 -*-
"""Récupère les segments MOT À MOT de chaque style de récitation Husary et
génère app/data/segments/<style>.js (karaoké + sélecteur de style).

Source : API publique de prévisualisation de QUL
(https://qul.tarteel.ai/api/v1/audio/ayah_segments/<id>?surah=N&from=A),
qui sert aussi l'URL du fichier audio de chaque verset : c'est elle qui fait
autorité pour savoir quels mp3 correspondent à quels segments.

Chaque segment = [i_mot_debut, i_mot_fin, debut_ms, fin_ms] (index 0-based,
fin exclue), calé sur le découpage en mots du texte uthmani.

    python tools/fetch_segments.py
"""
import json
import os
import re
import sys
import time

from curl_cffi import requests

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
OUT = os.path.join(APP, "data", "segments")
API = "https://qul.tarteel.ai/api/v1/audio/ayah_segments/{aid}?surah={s}&from={a}"
HEADERS = {"Referer": "https://qul.tarteel.ai/resources/recitation/110"}

# clé interne -> (id d'API QUL, libellé, motif d'URL audio attendu)
STYLES = {
    "husary64":  (6,  "Murattal 64 kbps (embarqué)", "everyayah/Husary_64kbps"),
    "husary128": (20, "Murattal 128 kbps",           "quran/husary"),
    "muallim":   (22, "Muallim (enseignement)",      "quran/husaryMuallim"),
    "mujawwad":  (21, "Mujawwad (mélodique)",        "quran/husaryMujawwad"),
}


def nos_versets():
    """{sourate: [numéros de versets]} du contenu de l'appli."""
    out = {}
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        obj = json.loads(re.search(r"window\.QURAN\[\"[^\"]+\"\] = (\{.*\});", txt, re.S).group(1))
        for v in obj["verses"]:
            out.setdefault(v["s"], []).append(v["a"])
    return {s: sorted(a) for s, a in out.items()}


def fetch_style(sess, aid, versets):
    """{'s:a': [segments]} + l'ensemble des motifs d'URL audio rencontrés."""
    segs, urls = {}, set()
    for s, ayat in sorted(versets.items()):
        a, restants = min(ayat), set(ayat)
        while restants:
            r = sess.get(API.format(aid=aid, s=s, a=a), timeout=90, headers=HEADERS)
            r.raise_for_status()
            page = r.json().get("segments") or {}
            if not page:
                break
            for k, v in page.items():
                num = int(k.split(":")[1])
                if num in restants:
                    segs[k] = v["segments"]
                    urls.add(re.sub(r"/\d+\.mp3$", "", v["audio_url"]))
                    restants.discard(num)
            a = max(int(k.split(":")[1]) for k in page) + 1
            if a > max(ayat):
                break
            time.sleep(0.05)
    return segs, urls


def main():
    versets = nos_versets()
    attendu = sum(len(v) for v in versets.values())
    os.makedirs(OUT, exist_ok=True)
    sess = requests.Session(impersonate="chrome")
    for cle, (aid, libelle, motif) in STYLES.items():
        segs, urls = fetch_style(sess, aid, versets)
        manquants = attendu - len(segs)
        if manquants:
            raise SystemExit(f"{cle} : {manquants} versets sans segments")
        if not any(motif in u for u in urls):
            raise SystemExit(f"{cle} : URL audio inattendue {urls} (attendu {motif})")
        path = os.path.join(OUT, cle + ".js")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(f"/* Généré par tools/fetch_segments.py — ne pas éditer.\n"
                    f"   {libelle} · segments mot à mot · source : QUL (qul.tarteel.ai),\n"
                    f"   fichiers audio : {sorted(urls)[0]}. */\n")
            f.write("window.SEGMENTS = window.SEGMENTS || {};\n")
            f.write(f"window.SEGMENTS[{json.dumps(cle)}] = ")
            f.write(json.dumps(segs, separators=(",", ":")))
            f.write(";\n")
        print(f"{cle:10} {len(segs):4} versets, {os.path.getsize(path)//1024:4} Ko  <- {sorted(urls)}")


if __name__ == "__main__":
    main()
