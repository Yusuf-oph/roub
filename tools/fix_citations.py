# -*- coding: utf-8 -*-
"""Remplace les citations arabes approximatives des fichiers notes/cartes par
la sous-chaîne EXACTE du texte uthmani affiché par le site.

Cible : les [[...]] et les champs ar: "..." du vocabulaire. La citation est
localisée par squelette consonantique (marques et variantes d'alif
normalisées), puis remplacée par le texte du verset, harakat et signes
coraniques compris. Recherche d'abord dans les versets du rub, sinon dans le
Qur'an complet (référence alquran.cloud pour les renvois hors juz 1-2).
"""
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")

DROP = set("ۖۗۘۙۚۛۜ۞۩ـ")
NORM = {"ٱ": "ا", "آ": "ا", "أ": "ا", "إ": "ا", "ى": "ي", "ة": "ه"}


def skel_map(s):
    """squelette normalisé + position d'origine de chaque caractère gardé."""
    out, pos = [], []
    for i, c in enumerate(s):
        if unicodedata.category(c) in ("Mn", "Me", "Cf") or c in DROP:
            continue
        out.append(NORM.get(c, c))
        pos.append(i)
    return "".join(out), pos


def exact_from(source, snippet):
    """Si le squelette du snippet apparaît dans source, renvoie la sous-chaîne
    exacte de source correspondante (marques suivantes incluses)."""
    sk, _ = skel_map(snippet)
    ssk, pos = skel_map(source)
    j = ssk.find(sk)
    if j < 0 or not sk:
        return None
    start = pos[j]
    end = pos[j + len(sk)] if j + len(sk) < len(pos) else len(source)
    return source[start:end].strip()


def fix_file(path, rub_verses, full_u):
    src = open(path, encoding="utf-8").read()
    changed = []

    def candidates():
        for v in rub_verses:
            yield v
        for t in full_u.values():
            yield t

    def repl_snippet(m):
        sn = m.group(1)
        if any(sn in v for v in rub_verses):
            return m.group(0)
        for v in candidates():
            ex = exact_from(v, sn)
            if ex:
                changed.append((sn, ex))
                return "[[" + ex + "]]"
        changed.append((sn, "INTROUVABLE"))
        return m.group(0)

    src = re.sub(r"\[\[([^\]]+)\]\]", repl_snippet, src)

    def repl_ar(m):
        sn = m.group(1)
        if any(sn in v for v in rub_verses):
            return m.group(0)
        for v in rub_verses:
            ex = exact_from(v, sn)
            if ex:
                changed.append((sn, ex))
                return 'ar: "' + ex + '"'
        changed.append((sn, "INTROUVABLE"))
        return m.group(0)

    src = re.sub(r'ar: "([^"]+)"', repl_ar, src)

    open(path, "w", encoding="utf-8", newline="\n").write(src)
    return changed


def main():
    full = json.load(open(os.path.join(HERE, "cache", "quran_full.json"), encoding="utf-8"))
    full_u = full["quran-uthmani"]
    targets = sys.argv[1:] or ["j1r1"]
    for rid in targets:
        qpath = os.path.join(APP, "data", "quran", rid + ".js")
        payload = open(qpath, encoding="utf-8").read().splitlines()[1].split("= ", 1)[1].rstrip(";")
        rub_verses = [v["ar"] for v in json.loads(payload)["verses"]]
        for sub in ("notes", "cartes"):
            path = os.path.join(APP, "data", sub, rid + ".js")
            if not os.path.exists(path):
                continue
            changed = fix_file(path, rub_verses, full_u)
            print(f"{sub}/{rid}.js : {len(changed)} remplacement(s)")
            for old, new in changed:
                status = "!!" if new == "INTROUVABLE" else "->"
                print(f"  {old} {status} {new}")


if __name__ == "__main__":
    main()
