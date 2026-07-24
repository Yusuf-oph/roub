# -*- coding: utf-8 -*-
"""Sauvegarde locale d'un style de récitation (assurance contre la disparition
d'une source distante). Les fichiers vont HORS du dépôt par défaut, dans
`sauvegarde-audio/<style>/` à côté du dossier quran-hifz : ils ne doivent
jamais être commités (le site publié est plafonné à 1 Go par GitHub Pages).

    python tools/mirror_audio.py husary128            # notre périmètre (823 v)
    python tools/mirror_audio.py mujawwad --tout      # Qur'an entier (6236 v)
    python tools/mirror_audio.py muallim --dest D:/sauvegardes

Styles : husary64, husary128, muallim, mujawwad (mêmes clés que l'appli).
Reprise possible : un fichier déjà présent et non vide est sauté.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

# volontairement SANS dépendance externe : n'importe quel Python 3 suffit
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) roub-mirror"}


def telecharger(url, timeout=120, essais=3):
    """Renvoie les octets, ou lève la dernière erreur après plusieurs essais."""
    for n in range(essais):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception:
            if n == essais - 1:
                raise
            time.sleep(2 * (n + 1))

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")

STYLES = {
    "husary64": "https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/{}.mp3",
    "husary128": "https://mirrors.quranicaudio.com/everyayah/Husary_128kbps/{}.mp3",
    "muallim": "https://mirrors.quranicaudio.com/everyayah/Husary_Muallim_128kbps/{}.mp3",
    "mujawwad": "https://audio-cdn.tarteel.ai/quran/husaryMujawwad/{}.mp3",
}
# nombre de versets par sourate (mushaf de Médine, Hafs)
VERSETS = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99,
           128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
           34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38,
           29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18,
           12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29,
           19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8,
           11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6]


def cles_appli():
    out = []
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        obj = json.loads(re.search(r"window\.QURAN\[\"[^\"]+\"\] = (\{.*\});", txt, re.S).group(1))
        out += [v["audio"][:-4] for v in obj["verses"]]
    return out


def cles_completes():
    return [f"{s:03d}{a:03d}" for s, n in enumerate(VERSETS, 1) for a in range(1, n + 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("style", choices=sorted(STYLES))
    ap.add_argument("--tout", action="store_true", help="Qur'an entier au lieu du périmètre de l'appli")
    ap.add_argument("--dest", default=os.path.join(HERE, "..", "..", "Récitations"))
    a = ap.parse_args()

    cles = cles_completes() if a.tout else cles_appli()
    dossier = os.path.join(a.dest, a.style)
    os.makedirs(dossier, exist_ok=True)
    faits = sautes = echecs = 0
    octets = 0
    t0 = time.time()
    for i, k in enumerate(cles, 1):
        cible = os.path.join(dossier, k + ".mp3")
        if os.path.exists(cible) and os.path.getsize(cible) > 1024:
            sautes += 1
            continue
        try:
            data = telecharger(STYLES[a.style].format(k))
            if len(data) > 1024:
                open(cible, "wb").write(data)
                faits += 1
                octets += len(data)
            else:
                echecs += 1
                print(f"  échec {k} : fichier trop court", file=sys.stderr)
        except Exception as e:
            echecs += 1
            print(f"  échec {k} : {e}", file=sys.stderr)
        if i % 50 == 0 or i == len(cles):
            print(f"{i}/{len(cles)} · {octets/1024/1024:.0f} Mo · {time.time()-t0:.0f}s"
                  f" · {sautes} déjà là · {echecs} échec(s)")
    print(f"\n{a.style} -> {dossier}\n{faits} téléchargés, {sautes} sautés, {echecs} échecs, "
          f"{octets/1024/1024:.0f} Mo")


if __name__ == "__main__":
    main()
