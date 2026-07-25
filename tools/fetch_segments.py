# -*- coding: utf-8 -*-
"""Récupère les segments MOT À MOT de chaque style de récitation Husary et
génère app/data/segments/<style>.js (karaoké + sélecteur de style).

Source : API publique de prévisualisation de QUL
(https://qul.tarteel.ai/api/v1/audio/ayah_segments/<id>?surah=N&from=A),
qui sert aussi l'URL du fichier audio de chaque verset : c'est elle qui fait
autorité pour savoir quels mp3 correspondent à quels segments.

Chaque segment = [i_mot_debut, i_mot_fin, debut_ms, fin_ms] (index 0-based,
fin exclue), calé sur le découpage en mots du texte uthmani.

    python tools/fetch_segments.py                # récupère tout et normalise
    python tools/fetch_segments.py --renormaliser # normalise les fichiers déjà là

NORMALISATION (voir normaliser()) : les jeux distants comptent le yâ vocatif
comme un mot à part alors que le rasm l'écrit collé (يَـٰٓأَيُّهَا) ; sans correction,
tout le reste du verset est décalé d'un cran.
"""
import json
import os
import re
import sys
import time

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


PAUSES = "ۖۗۘۙۚۛۜ۞۩"
# yâ vocatif collé au mot suivant dans le rasm : يَـٰٓأَيُّهَا, يَـٰٓـَٔادَمُ, يَـٰبَنِىٓ, يَـٰمُوسَىٰ...
# (yâ, puis tatweel et diacritiques éventuels, puis l'alif suscrit)
YA_COLLE = re.compile("^ي[ً-ْـ]*ٰ")


def mots_par_verset():
    """{'s:a': [mots récités]} avec la MÊME tokenisation que arHtml() et
    verifie.py : les marques de pause ne comptent pas comme des mots."""
    out = {}
    qdir = os.path.join(APP, "data", "quran")
    for f in sorted(os.listdir(qdir)):
        if not f.endswith(".js"):
            continue
        txt = open(os.path.join(qdir, f), encoding="utf-8").read()
        obj = json.loads(re.search(r"window\.QURAN\[\"[^\"]+\"\] = (\{.*\});", txt, re.S).group(1))
        for v in obj["verses"]:
            out[v["k"]] = [w for w in v["ar"].split()
                           if not all(c in PAUSES for c in w)]
    return out


def normaliser(cle, segs, mots):
    """Recale le découpage en mots de QUL sur le nôtre, verset par verset.

    L'invariant visé : les index de mots DÉCLARÉS par les segments (champ 0)
    couvrent exactement 0..N-1 pour un verset de N mots. Un même index peut
    revenir plusieurs fois, c'est normal : le récitateur répète (très fréquent
    en muallim), et l'appli s'appuie sur l'index déclaré, pas sur la position
    dans la liste, pour suivre ces répétitions.

    Seul écart corrigé ici : QUL compte le yâ vocatif comme un mot à part alors
    que le rasm l'écrit collé (يَـٰٓأَيُّهَا). On fusionne alors chaque paire
    (yâ, suite du mot) en un seul segment, début du premier et fin du second, et
    on décale d'un cran les index suivants. Aucun instant n'est inventé : on
    supprime une frontière, on n'en crée pas.

    Les autres écarts sont signalés et laissés tels quels : les corriger
    demanderait de découper un segment, donc de fabriquer un instant.
    """
    fusions, restants = [], []
    for k, sg in segs.items():
        m = mots.get(k)
        if not m:
            continue
        declares = set(s[0] for s in sg)
        if declares == set(range(len(m))):
            continue
        cand = [i for i, w in enumerate(m) if YA_COLLE.match(w)]
        if declares == set(range(len(m) + 1)) and len(cand) == 1:
            p = cand[0]
            out = []
            for s in sg:
                i = s[0] if s[0] <= p else s[0] - 1
                if out and s[0] == p + 1 and out[-1][0] == i:
                    out[-1] = [i, i + 1, out[-1][2], s[3]]   # yâ + suite = un mot
                else:
                    out.append([i, i + 1, s[2], s[3]])
            segs[k] = out
            fusions.append(k)
        else:
            restants.append((k, len(m), sorted(declares)[-1] + 1))
    if fusions:
        print(f"   {cle} : {len(fusions)} versets recalés sur le yâ vocatif "
              f"({', '.join(fusions[:4])}{'...' if len(fusions) > 4 else ''})")
    for k, nm, nd in restants:
        print(f"   {cle} : {k} laissé tel quel ({nm} mots dans le texte, "
              f"{nd} mots déclarés par les segments)")
    return segs


def ecrire(cle, segs, entete):
    path = os.path.join(OUT, cle + ".js")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(entete)
        f.write("window.SEGMENTS = window.SEGMENTS || {};\n")
        f.write(f"window.SEGMENTS[{json.dumps(cle)}] = ")
        f.write(json.dumps(segs, separators=(",", ":")))
        f.write(";\n")
    return path


def renormaliser():
    """Rejoue la normalisation sur les fichiers déjà générés, sans réseau."""
    mots = mots_par_verset()
    for cle in STYLES:
        path = os.path.join(OUT, cle + ".js")
        txt = open(path, encoding="utf-8").read()
        entete = txt[:txt.index("window.SEGMENTS")]
        segs = json.loads(re.search(r"window\.SEGMENTS\[\"[^\"]+\"\] = (\{.*\});",
                                    txt, re.S).group(1))
        segs = normaliser(cle, segs, mots)
        p = ecrire(cle, segs, entete)
        cales = sum(1 for k, sg in segs.items()
                    if k in mots and set(s[0] for s in sg) == set(range(len(mots[k]))))
        print(f"{cle:10} {len(segs):4} versets, dont {cales} calés au mot, "
              f"{os.path.getsize(p)//1024:4} Ko")


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
    from curl_cffi import requests            # inutile en mode --renormaliser

    versets = nos_versets()
    mots = mots_par_verset()
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
        segs = normaliser(cle, segs, mots)
        entete = (f"/* Généré par tools/fetch_segments.py — ne pas éditer.\n"
                  f"   {libelle} · segments mot à mot · source : QUL (qul.tarteel.ai),\n"
                  f"   fichiers audio : {sorted(urls)[0]}. */\n")
        path = ecrire(cle, segs, entete)
        print(f"{cle:10} {len(segs):4} versets, {os.path.getsize(path)//1024:4} Ko  <- {sorted(urls)}")


if __name__ == "__main__":
    if "--renormaliser" in sys.argv:
        renormaliser()
    else:
        main()
