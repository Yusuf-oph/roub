# -*- coding: utf-8 -*-
"""Génère app/data/tajcur.js : le parcours de tajwid progressif par sourate
(idée d'Israa) : pour chaque sourate du curriculum (Fâtiḥa + juz 'Amma),
l'ensemble des règles de tajwid présentes (dérivé mécaniquement des spans
des données quran/*.js) et celles qui sont NOUVELLES par rapport aux
sourates précédentes dans l'ordre d'apprentissage (tools/curriculum.json,
par défaut : Fâtiḥa puis An-Nâs en remontant vers An-Naba).

    python tools/build_tajcur.py [chemin/curriculum.json]

Limites assumées (contrôlées par verifie.py section H) :
- Les fiches izhar, izhar-shafawi, lam-allah et ra-tafkhim ne sont PAS
  dérivables des spans (izhâr = absence de transformation, donc non balisée ;
  lâm d'Allah et râ' non balisés par l'annotation employée) : elles
  n'apparaissent jamais dans les encarts.
  ⚠ UNE fiche en est sortie le 28/07 : madd-arid, qui y était à tort (il EST
  balisé, par `madda_permissible`). madd-munfasil devait en sortir aussi grâce
  à la ressource 87 de QUL, mais elle a été écartée : elle est moins complète
  que quran.com, et c'est le mushaf officiel qui a tranché (cf. build_data.py).
  Les deux entrées `madda_obligatory_*` restent dans la table : elles ne
  coûtent rien et serviront le jour où la scission se fera proprement.
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
    # ⚠ CORRIGÉ le 28/07 : `madda_permissible` était mappé sur madd-munfasil, à
    # tort. MESURE qui tranche : ses 418 portées tombent sur le DERNIER mot du
    # verset dans 418 cas sur 418 (100 %), sur la voyelle longue qui précède la
    # dernière lettre (نُو de يُؤْمِنُونَ, حِي de ٱلرَّحِيمِ). C'est le madd
    # 'âriḍ li-s-soukoûn. Contre-épreuve : `madda_obligatory` ne touche le
    # dernier mot que 5 fois sur 463 (1,1 %). La légende TJ_LEGEND de app.js
    # disait juste depuis toujours (« 2-4-6 temps, fin de verset notamment »),
    # c'est cette table qui se trompait.
    "madda_permissible": "madd-arid",
    # `madda_obligatory` réunit le muttasil ET le munfasil : quran.com ne les
    # sépare pas (vérifié sur 2:13 ٱلسُّفَهَآءُ = muttasil et 2:4 بِمَآ أُنزِلَ =
    # munfasil, même classe). La ressource 87 de QUL, elle, les distingue
    # (`madda_obligatory_mottasel` 247 / `_monfasel` 210) : c'est la voie pour
    # rendre madd-munfasil dérivable un jour. En l'état la table étant 1:1,
    # madd-munfasil n'a pas de classe propre et rejoint les non dérivables.
    "madda_obligatory": "madd-muttasil",
    # ⚠ NE PAS y remettre `madda_obligatory_mottasel` / `_monfasel` tant que les
    # données ne les portent pas : `verifie.py` construit sa table inverse en
    # gardant la DERNIÈRE entrée, si bien que les fiches muttasil et munfasil
    # pointeraient vers des classes absentes et leurs exemples s'afficheraient
    # sans couleur. Essayé le 28/07, deux erreurs immédiates. La scission n'aura
    # lieu que le jour où l'annotation la portera vraiment (cf. build_data.py,
    # pourquoi la ressource 87 de QUL a été écartée).
    "madda_necessary": "madd-lazim",
    "idgham_mutajanisayn": "idgham-mutajanisayn",
    "slnt": "lettre-muette",
}
SANS_FICHE = {"idgham_mutaqaribayn"}
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
    # La table classe de portée -> fiche vivait ICI seulement, donc l'appli ne
    # pouvait ni colorer le nom d'une règle ni retrouver un verset qui la
    # contient. On l'émet dans le fichier généré : une seule source de vérité,
    # et le JS n'a rien à recopier. `spanFiche` va de la classe vers la fiche,
    # `ficheSpan` fait le chemin inverse, celui dont l'affichage a besoin.
    fiche_span = {}
    for classe, f in SPAN2FICHE.items():
        fiche_span.setdefault(f, classe)
    obj = {"ordre": ordre, "parSourate": par,
           "spanFiche": SPAN2FICHE, "ficheSpan": fiche_span}
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
