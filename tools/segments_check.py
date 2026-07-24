# -*- coding: utf-8 -*-
"""Qualification des segments mot à mot de la récitation Husary
(api.quran.com, recitation id 6) CONTRE NOS PROPRES mp3.

    python tools/segments_check.py            # récupère (cache) puis contrôle

Constat de départ (2026-07-24) : l'API donne pour la récitation 6 l'URL
`everyayah/Husary_64kbps/...`, c'est-à-dire EXACTEMENT la source de nos
823 mp3 : les segments sont donc censés s'appliquer à nos fichiers sans
migration audio. Ce script le vérifie sur les faits :
  - couverture : un jeu de segments pour chaque verset ;
  - cohérence lexicale : autant de segments que de mots du texte uthmani ;
  - dérive temporelle : fin du dernier segment vs durée réelle du mp3
    (durée estimée depuis la taille : Husary_64kbps est du CBR 64 kbps).

Format d'un segment : [index, position_du_mot, début_ms, fin_ms].
"""
import io
import json
import os
import re
import sys
import time

from curl_cffi import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
CACHE = os.path.join(HERE, "cache", "segments_husary.json")
RID = 6
BITRATE = 64000  # bits/s, CBR


def verses_de_lappli():
    """[(clé, texte uthmani)] dans l'ordre, tous rubs confondus."""
    out = []
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        m = re.search(r"window\.QURAN\[\"[^\"]+\"\] = (\{.*\});", txt, re.S)
        out += [(v["k"], v["ar"]) for v in json.loads(m.group(1))["verses"]]
    return out


def fetch_segments(keys):
    data = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    chapitres = sorted({int(k.split(":")[0]) for k in keys
                        if k not in data})
    if chapitres:
        s = requests.Session(impersonate="chrome")
        for ch in chapitres:
            r = s.get(f"https://api.quran.com/api/v4/quran/recitations/{RID}"
                      f"?chapter_number={ch}&fields=segments&per_page=300", timeout=60)
            r.raise_for_status()
            for af in r.json().get("audio_files", []):
                if af.get("segments"):
                    data[af["verse_key"]] = af["segments"]
            print(f"  sourate {ch} : {len(data)} versets en cache", flush=True)
            time.sleep(0.15)
        json.dump(data, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    return data


def duree_mp3_ms(path):
    """CBR 64 kbps : durée ≈ octets utiles × 8 / débit (± tag ID3)."""
    return int(os.path.getsize(path) * 8 / BITRATE * 1000)


def main():
    verses = verses_de_lappli()
    segs = fetch_segments([k for k, _ in verses])
    manquants, mots_ko, derives = [], [], []
    for k, ar in verses:
        sg = segs.get(k)
        if not sg:
            manquants.append(k)
            continue
        # les marques de pause (ۖ ۗ ۘ ۙ ۚ ۛ ۜ) et le ۞ sont des tokens
        # isolés du texte uthmani, pas des mots récités
        n_mots = len([w for w in ar.split()
                      if w.strip(" ۖۗۘۙۚۛۜ۞۩")])
        if len(sg) != n_mots:
            mots_ko.append((k, len(sg), n_mots))
        s, a = map(int, k.split(":"))
        mp3 = os.path.join(APP, "audio", "%03d%03d.mp3" % (s, a))
        if os.path.exists(mp3):
            fin = sg[-1][3]
            derives.append((k, duree_mp3_ms(mp3) - fin))
    print(f"\n{len(verses)} versets de l'appli, {len(segs)} jeux de segments")
    print(f"manquants : {len(manquants)}" + (f" {manquants[:5]}" if manquants else ""))
    print(f"nombre de segments != nombre de mots : {len(mots_ko)}"
          + (f" {mots_ko[:5]}" if mots_ko else ""))
    if derives:
        vals = sorted(d for _, d in derives)
        pires = sorted(derives, key=lambda x: abs(x[1]))[-3:]
        print(f"dérive (durée mp3 - fin du dernier mot), ms : "
              f"min {vals[0]}, médiane {vals[len(vals)//2]}, max {vals[-1]}")
        print(f"  cas extrêmes : {pires}")
        hors = [d for d in vals if not (-200 <= d <= 3000)]
        print(f"  hors tolérance [-200, +3000] ms : {len(hors)}")


if __name__ == "__main__":
    main()
