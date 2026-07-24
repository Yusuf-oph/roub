# -*- coding: utf-8 -*-
"""Génère app/data/tajcur.js : le parcours de tajwid progressif par sourate
(idée d'Israa) : pour chaque sourate du curriculum (Fâtiḥa + juz 'Amma),
l'ensemble des règles de tajwid présentes (dérivé mécaniquement des spans
des données quran/*.js) et celles qui sont NOUVELLES par rapport aux
sourates précédentes dans l'ordre d'apprentissage (tools/curriculum.json,
par défaut : Fâtiḥa puis An-Nâs en remontant vers An-Naba).

    python tools/build_tajcur.py [chemin/curriculum.json]

Limites assumées (contrôlées par verifie.py section H) :
- Les fiches izhar, izhar-shafawi, lam-allah, ra-tafkhim et madd-arid ne
  sont PAS dérivables des spans (izhâr = absence de transformation, non
  balisée ; madd 'âriḍ = pause de fin de verset, non balisée ; lâm d'Allah
  et râ' non balisés par l'API) : elles n'apparaissent jamais dans les
  encarts.
- Les classes slnt, idgham_mutajanisayn et idgham_mutaqaribayn n'ont pas
  de fiche : ignorées (SANS_FICHE).
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")

SPAN2FICHE = {
    "ham_wasl": "hamzat-wasl",
    "laam_shamsiyah": "lam-shamsiyya",
    "ghunnah": "ghunna",
    "ikhafa": "ikhfa",
    "ikhafa_shafawi": "ikhfa-shafawi",
    "idgham_ghunnah": "idgham-ghunna",
    "idgham_shafawi": "idgham-shafawi",
    "idgham_wo_ghunnah": "idgham-sans-ghunna",
    "iqlab": "iqlab",
    "qalaqah": "qalqala",
    "madda_normal": "madd-tabii",
    "madda_permissible": "madd-munfasil",
    "madda_obligatory": "madd-muttasil",
    "madda_necessary": "madd-lazim",
}
SANS_FICHE = {"slnt", "idgham_mutajanisayn", "idgham_mutaqaribayn"}
HORS_CURRICULUM = {2}  # Al-Baqara : pas une sourate courte, pas d'encart


def load_data():
    """Charge QURAN et l'ordre canonique des fiches via node (regles.js est
    du JS littéral, pas du JSON)."""
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const load = f => eval(fs.readFileSync(f, 'utf8'));
load(path.join(app, 'data', 'regles.js'));
const dir = path.join(app, 'data', 'quran');
for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) load(path.join(dir, f));
process.stdout.write(JSON.stringify({
  regles: window.REGLES.map(r => r.id), QURAN: window.QURAN,
}));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def compute(quran, ordre, regles_ids):
    """parSourate = { "s": { regles: [fiche-ids, triés comme REGLES],
    nouvelles: [...] } } pour chaque sourate de `ordre` (cumul dans l'ordre).
    L'agrégation traverse tous les rubs (sourates coupées entre deux rubs)."""
    par_s = {}
    for R in quran.values():
        for v in R["verses"]:
            acc = par_s.setdefault(v["s"], set())
            for _st, _en, c in v["taj"]:
                if c in SANS_FICHE:
                    continue
                if c not in SPAN2FICHE:
                    raise ValueError(f"classe tajwid non mappée : {c} ({v['k']})")
                acc.add(SPAN2FICHE[c])
    idx = {fid: i for i, fid in enumerate(regles_ids)}
    out, vus = {}, set()
    for s in ordre:
        regles = sorted(par_s.get(s, set()), key=lambda f: idx[f])
        out[str(s)] = {"regles": regles,
                       "nouvelles": [f for f in regles if f not in vus]}
        vus.update(regles)
    return out


def main():
    cur_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "curriculum.json")
    ordre = json.load(open(cur_path, encoding="utf-8"))
    data = load_data()
    regles_ids, quran = data["regles"], data["QURAN"]
    inconnues = sorted(set(SPAN2FICHE.values()) - set(regles_ids))
    if inconnues:
        raise SystemExit(f"SPAN2FICHE renvoie vers des fiches inconnues : {inconnues}")
    surs = {v["s"] for R in quran.values() for v in R["verses"]}
    attendu = surs - HORS_CURRICULUM
    if len(ordre) != len(set(ordre)) or set(ordre) != attendu:
        raise SystemExit(f"curriculum invalide : attendu une permutation de {sorted(attendu)}")
    par = compute(quran, ordre, regles_ids)
    obj = {"ordre": ordre, "parSourate": par}
    out = os.path.join(APP, "data", "tajcur.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* Généré par tools/build_tajcur.py (ordre : tools/curriculum.json)"
                " — ne pas éditer. */\n")
        f.write("window.TAJCUR = ")
        f.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    n_new = sum(len(e["nouvelles"]) for e in par.values())
    print(f"tajcur : {len(ordre)} sourates, {n_new} introductions de règles -> {out}")


if __name__ == "__main__":
    main()
