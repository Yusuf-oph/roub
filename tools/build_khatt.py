# -*- coding: utf-8 -*-
"""Assemble app/data/khatt.js : le texte coranique dans l'orthographe de la
police **Digital Khatt**, mot par mot, pour le rendu du même nom.

    python tools/build_khatt.py

Sortie : window.KHATT = { "2:142": ["وَٱلْمَغْرِبُ", …], … }
Un tableau de MOTS par verset, la marque de fin de verset EXCLUE.

POURQUOI mot par mot et pas verset entier. Le soulignage pendant la récitation
et le double-clic « lecture à partir d'ici » s'appuient sur un index de mot
(`data-w`) qui doit coïncider avec celui des segments audio, lequel suit le
découpage de `arHtml` (`/\\S+/`, marques de pause exclues). Servir le verset en
un bloc obligerait à le redécouper à l'affichage, avec le risque de diverger.
**Vérifié avant d'écrire ce script : les 823 versets ont le MÊME nombre de mots
des deux côtés, 823 sur 823.** Le contrôle est rejoué par `verifie.py`.

⚠ Ce n'est PAS le texte uthmani du dépôt : c'est l'orthographe que la police
Digital Khatt attend, publiée avec elle. Les deux ne diffèrent que par des
détails de ḍabṭ (l'alif suscrit y est U+0670 nu là où notre uthmani porte un
tatweel devant), mais mélanger les deux donnerait un rendu faux. Le texte
canonique du dépôt n'est pas touché.

SOURCE : Quranic Universal Library (QUL, Tarteel), ressource « Digital Khatt V2 »
mot à mot, déposée dans tools/cache/qul/extrait/ (gitignoré comme tout le cache).
Elle n'est pas téléchargeable sans compte : si le fichier manque, le script dit
où le reprendre. Police : Amine Anane, SIL Open Font License 1.1.
"""
import json
import os
import re
import sqlite3
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
WBW = os.path.join(HERE, "cache", "qul", "extrait", "digital-khatt-v2-wbw.db")
OUT = os.path.join(APP, "data", "khatt.js")

PAUSES = "ۖۗۘۙۚۛۜ۞۩"
# marque de fin de verset : U+06DD suivi du numéro en chiffres arabes
FIN = re.compile("[۝٠-٩]")


def mots_du_verset(ar):
    """Le découpage de `arHtml` : /\\S+/, mots de pause exclus du comptage."""
    return [m.group(0) for m in re.finditer(r"\S+", ar)
            if not all(c in PAUSES for c in m.group(0))]


def charger_quran():
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const dir = path.join(app, 'data', 'quran');
for (const f of fs.readdirSync(dir))
  if (f.endsWith('.js')) eval(fs.readFileSync(path.join(dir, f), 'utf8'));
process.stdout.write(JSON.stringify(window.QURAN));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def main():
    if not os.path.exists(WBW):
        raise SystemExit(
            f"texte Digital Khatt absent : {WBW}\n"
            "  À déposer à la main depuis https://qul.tarteel.ai/resources/quran-script\n"
            "  (« Digital Khatt V2 », format mot à mot, SQLite).")
    con = sqlite3.connect(WBW)
    par_verset = {}
    for su, ay, _w, txt in con.execute(
            "select surah, ayah, word, text from words order by surah, ayah, word"):
        par_verset.setdefault(f"{su}:{ay}", []).append(txt)

    quran = charger_quran()
    out, manquants, ecarts = {}, [], []
    for R in quran.values():
        for v in R["verses"]:
            k = v["k"]
            brut = par_verset.get(k)
            if not brut:
                manquants.append(k)
                continue
            mots = [m for m in brut if not FIN.search(m)]
            attendu = len(mots_du_verset(v["ar"]))
            if len(mots) != attendu:
                ecarts.append((k, attendu, len(mots)))
            out[k] = mots

    if manquants:
        raise SystemExit(f"versets absents du texte Digital Khatt : {manquants[:8]}")
    if ecarts:
        # bloquant : un écart casserait l'index de mot, donc l'audio et le
        # double-clic. Mieux vaut ne rien produire que produire un décalage.
        raise SystemExit(
            "découpage en mots divergent de celui de arHtml sur "
            f"{len(ecarts)} versets : {ecarts[:6]}")

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Généré par tools/build_khatt.py — ne pas éditer.\n"
                "   Texte Digital Khatt V2 (QUL), mot par mot, marque de fin exclue.\n"
                "   Police : Amine Anane, SIL Open Font License 1.1. */\n")
        f.write("window.KHATT = ")
        f.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    n = sum(len(x) for x in out.values())
    print(f"khatt : {len(out)} versets, {n} mots -> {OUT} "
          f"({os.path.getsize(OUT) // 1024} Ko)")


if __name__ == "__main__":
    main()
