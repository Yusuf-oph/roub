# -*- coding: utf-8 -*-
r"""Dépouille la couche de couleur tajwid OFFICIELLE (KFGQPC) des polices QCF v4
et la corrèle, mot par mot, aux portées `taj` venues de l'API quran.com.

    python tools/tajwid_kfgqpc.py            # rapport complet sur stdout
    python tools/tajwid_kfgqpc.py --json X   # dépose aussi les tables en JSON

Ce que fait l'outil, dans l'ordre :

1. Ouvre les 64 `app/fonts/qcf4/pN.woff2`, lit `COLR` (version 0) et `CPAL`, et
   construit `caractère PUA -> multiensemble d'index de palette`. Une police de
   page ne connaît que ses propres glyphes : le PUA est donc lu police par
   police, jamais globalement.
2. Relie chaque glyphe à son `(verset, index de mot)` par `app/data/pages2.js`,
   avec le MÊME compteur par verset que `pagesHtml` (app.js) : les glyphes d'un
   verset se suivent, le dernier est la marque de fin de verset et ne compte pas
   comme un mot.
3. Reconstruit, côté quran.com, `(verset, index de mot) -> {classes}` à partir
   des `taj` de `app/data/quran/*.js`, en découpant les mots comme `arHtml` :
   `/\S+/` et les mots de pause (ۖۗۘۙۚۛۜ۞۩) exclus du comptage.
4. Croise les deux et sort la table de contingence `index de palette x classe`.

⚠ Limite structurelle, à ne pas oublier en lisant les résultats : `COLR`
version 0 colorie des TRACÉS, pas des caractères. On sait donc quelles couleurs
porte un MOT, jamais sur quelle lettre. Suffisant pour établir la table
`index -> règle` et pour dénombrer, insuffisant pour remplacer les portées au
caractère près.

Session d'analyse : cet outil ne modifie rien dans l'appli.
"""
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
QCF4 = os.path.join(APP, "fonts", "qcf4")

PAUSES = "ۖۗۘۙۚۛۜ۞۩"

# Les 64 pages couvertes ne sont PAS 1-64 : ce sont les pages réelles du mushaf
# des juz 1, 2 et 30 (1-41 puis 582-604). Elles se lisent sur le disque, jamais
# en dur : le jour où un juz s'ajoute, l'outil suit tout seul.
PAGES = sorted(int(m.group(1)) for m in
               (re.fullmatch(r"p(\d+)\.woff2", f) for f in os.listdir(QCF4)) if m)


# --------------------------------------------------------------- les polices
def lire_polices():
    """{page: {caractère PUA: [index de palette, …]}} + les 6 palettes.

    Les couches d'un glyphe sont rendues dans l'ordre, la première étant le
    tracé de fond. On garde la liste complète (avec doublons) : c'est elle qui
    a servi à établir les comptes de couches du document de cadrage.
    """
    from fontTools.ttLib import TTFont

    par_page, palettes = {}, None
    for p in PAGES:
        chemin = os.path.join(QCF4, f"p{p}.woff2")
        f = TTFont(chemin)
        if palettes is None:
            palettes = [["#%02X%02X%02X" % (c.red, c.green, c.blue) for c in pal]
                        for pal in f["CPAL"].palettes]
        couches = f["COLR"].ColorLayers
        inv = {}                       # nom de glyphe -> caractère
        for cp, nom in f.getBestCmap().items():
            if cp >= 0x20:
                inv.setdefault(nom, chr(cp))
        m = {}
        for nom, layers in couches.items():
            ch = inv.get(nom)
            if ch is None:
                continue               # glyphe colorié non atteignable par le texte
            m[ch] = [r.colorID for r in layers]
        par_page[p] = m
        f.close()
    return par_page, palettes


# ----------------------------------------------------------------- les données
def lire_donnees():
    """QURAN et PAGES2, chargés par node (ce sont des .js, pas du JSON)."""
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const load = f => eval(fs.readFileSync(f, 'utf8'));
load(path.join(app, 'data', 'pages2.js'));
const dir = path.join(app, 'data', 'quran');
for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) load(path.join(dir, f));
process.stdout.write(JSON.stringify({QURAN: window.QURAN, PAGES2: window.PAGES2}));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def mots_du_verset(ar):
    """[(début, fin)] des mots RÉCITÉS, exactement comme `arHtml` les indexe :
    découpage sur /\\S+/, mots entièrement faits de marques de pause exclus."""
    out = []
    for m in re.finditer(r"\S+", ar):
        if all(c in PAUSES for c in m.group(0)):
            continue
        out.append((m.start(), m.end()))
    return out


def classes_par_mot(quran):
    """{clé de verset: [ Counter(classe -> nb de portées) par index de mot ]}.

    Le COMPTE compte : si l'index de palette i désigne bien la classe c, alors un
    mot qui porte deux portées `c` doit porter deux couches `i`. C'est ce qui
    distingue une vraie correspondance d'une simple cooccurrence."""
    out = {}
    for R in quran.values():
        for v in R["verses"]:
            mots = mots_du_verset(v["ar"])
            acc = [Counter() for _ in mots]
            for st, en, c in v.get("taj") or []:
                for i, (a, b) in enumerate(mots):
                    if st < b and en > a:      # chevauchement
                        acc[i][c] += 1
            out[v["k"]] = acc
    return out


def glyphes_par_verset(pages2, par_page):
    """{clé de verset: [ (index de palette, …) par index de mot ]} côté KFGQPC,
    plus la marque de fin de verset, retournée à part.

    Le compteur reproduit `pagesHtml` : pages triées, lignes triées, un compteur
    par verset, le DERNIER glyphe d'un verset étant la marque de fin.

    ⚠ Une entrée de PAGES2 n'est PAS toujours un seul glyphe : `g` porte parfois
    deux caractères PUA (389 cas) ou trois dont une espace (17 cas). C'est
    l'ENTRÉE qui vaut un mot — `pagesHtml` pose un `data-w` par entrée — donc les
    couches de tous ses glyphes se cumulent.
    """
    seq = defaultdict(list)            # clé -> [couches de chaque mot, dans l'ordre]
    manquants = Counter()
    for p in sorted(pages2, key=int):
        lignes = pages2[p]
        table = par_page[int(p)]
        for ln in sorted(lignes, key=int):
            for w in lignes[ln]:
                cols = []
                for ch in w["g"]:
                    if ch == " ":
                        continue
                    c = table.get(ch)
                    if c is None:
                        manquants[int(p)] += 1
                    else:
                        cols.extend(c)
                seq[w["k"]].append(tuple(cols))
    mots, fins = {}, {}
    for k, lst in seq.items():
        mots[k] = lst[:-1]
        fins[k] = lst[-1]
    return mots, fins, manquants


# ---------------------------------------------------------------- le rapport
def barre(n, total, largeur=28):
    if not total:
        return ""
    return "█" * max(1, round(n / total * largeur)) if n else ""


def main():
    sortie_json = None
    if "--json" in sys.argv:
        sortie_json = sys.argv[sys.argv.index("--json") + 1]

    par_page, palettes = lire_polices()
    data = lire_donnees()
    quran, pages2 = data["QURAN"], data["PAGES2"]

    cls_mot = classes_par_mot(quran)
    gly_mot, gly_fin, manquants = glyphes_par_verset(pages2, par_page)

    print("=" * 78)
    print("DÉPOUILLEMENT DE LA COUCHE DE COULEUR OFFICIELLE (KFGQPC, QCF v4)")
    print("=" * 78)

    # --- 1. les couches, tous glyphes confondus -----------------------------
    couches = Counter()
    glyphes_colories = 0
    for p, table in par_page.items():
        for ch, cols in table.items():
            glyphes_colories += 1
            couches.update(cols)
    print(f"\n[1] {glyphes_colories} glyphes coloriés sur {len(PAGES)} polices, "
          f"{sum(couches.values())} couches, {len(couches)} index utilisés.")
    if manquants:
        print(f"    ⚠ glyphes de PAGES2 absents de la table COLR : "
              f"{sum(manquants.values())} (pages {sorted(manquants)[:6]}…)")

    # --- 2. index sur la marque de fin de verset ---------------------------
    fin_cnt = Counter()
    for k, cols in gly_fin.items():
        fin_cnt.update(set(cols))
    print(f"\n[2] MARQUES DE FIN DE VERSET ({len(gly_fin)} versets) : index portés")
    for i, n in sorted(fin_cnt.items()):
        print(f"    index {i:>2} : {n:>4} versets ({n / len(gly_fin) * 100:.1f} %)")

    # --- 3. index sur les mots récités -------------------------------------
    mot_cnt = Counter()
    n_mots = 0
    for k, lst in gly_mot.items():
        for cols in lst:
            n_mots += 1
            mot_cnt.update(set(cols))
    print(f"\n[3] MOTS RÉCITÉS ({n_mots} mots) : index portés")
    for i, n in sorted(mot_cnt.items()):
        print(f"    index {i:>2} : {n:>5} mots")

    # --- 4. contrôle du pont glyphe/mot ------------------------------------
    ecarts = []
    for k, lst in cls_mot.items():
        g = gly_mot.get(k)
        if g is None:
            ecarts.append((k, "absent de PAGES2", len(lst), None))
        elif len(g) != len(lst):
            ecarts.append((k, "écart", len(lst), len(g)))
    print(f"\n[4] PONT glyphes ↔ mots : {len(cls_mot)} versets, "
          f"{len(ecarts)} en écart")
    for k, quoi, a, b in ecarts:
        print(f"    {k} : {quoi} (mots quran.com {a}, glyphes-1 {b})")

    # --- 5. appariement index <-> classe -----------------------------------
    # Un mot porte plusieurs couleurs et plusieurs règles : une simple
    # cooccurrence ne prouve rien (index 0, l'encre, « cooccurre » avec tout).
    # On mesure donc DEUX choses par couple (index, classe) :
    #   - Jaccard = A / (A + B + C) sur la PRÉSENCE dans le mot ;
    #   - accord de MULTIPLICITÉ : le mot porte-t-il autant de couches `index`
    #     que de portées `classe` ? Une vraie correspondance l'exige.
    A = defaultdict(Counter)           # index -> classe -> mots où les deux sont là
    seul_idx = Counter()               # index présent, classe absente (par couple)
    tot_idx, tot_cls = Counter(), Counter()
    sans_classe = Counter()            # index colorié / le mot ne porte AUCUNE portée
    sans_couleur = Counter()           # classe portée / le mot n'a AUCUNE couleur (hors encre)
    mult_ok = defaultdict(Counter)     # index -> classe -> mots où les comptes coïncident
    apparies, mots_echant = 0, []
    for k, lst in sorted(cls_mot.items()):
        g = gly_mot.get(k)
        if g is None or len(g) != len(lst):
            continue
        for i, classes in enumerate(lst):
            apparies += 1
            nl = Counter(g[i])                   # couches par index, avec multiplicité
            idxs = set(nl)
            couleur = idxs - {0}
            for ix in idxs:
                tot_idx[ix] += 1
                if not classes:
                    sans_classe[ix] += 1
            for c in classes:
                tot_cls[c] += 1
                if not couleur:
                    sans_couleur[c] += 1
            for ix in idxs:
                for c in classes:
                    A[ix][c] += 1
                    if nl[ix] == classes[c]:
                        mult_ok[ix][c] += 1
            mots_echant.append((k, i, tuple(sorted(nl.elements())), dict(classes)))

    def jaccard(ix, c):
        a = A[ix][c]
        return a / (tot_idx[ix] + tot_cls[c] - a) if a else 0.0

    print(f"\n[5] APPARIEMENT index ↔ classe, sur {apparies} mots")
    print("    J = Jaccard de présence · M = part des mots où les COMPTES coïncident")
    meilleur = {}
    for ix in sorted(tot_idx):
        cands = sorted(tot_cls, key=lambda c: -jaccard(ix, c))[:4]
        print(f"\n  ── index {ix:>2} · {tot_idx[ix]:>5} mots · "
              f"{'  '.join(p[ix] for p in palettes)}")
        for c in cands:
            j = jaccard(ix, c)
            if not j:
                continue
            m = mult_ok[ix][c] / A[ix][c] * 100 if A[ix][c] else 0
            print(f"     {c:<22} J={j:>5.1%}  M={m:>5.1f} %  "
                  f"({A[ix][c]:>4}/{tot_idx[ix]}, classe {tot_cls[c]})  "
                  f"{barre(round(j * 100), 100)}")
        if cands and jaccard(ix, cands[0]):
            meilleur[ix] = (cands[0], jaccard(ix, cands[0]))
        if sans_classe[ix]:
            print(f"     {'(aucune portée sur le mot)':<22} "
                  f"{sans_classe[ix]:>5} mots, {sans_classe[ix] / tot_idx[ix]:.1%}")

    # --- 6. le même croisement, vu depuis les classes quran.com ------------
    print(f"\n[6] VU DEPUIS LES CLASSES quran.com "
          f"(chaque classe cherche son index)")
    retenu = {}
    for c in sorted(tot_cls, key=lambda x: -tot_cls[x]):
        cands = sorted(tot_idx, key=lambda ix: -jaccard(ix, c))[:3]
        best = cands[0] if cands and jaccard(cands[0], c) else None
        print(f"\n  ── {c:<22} {tot_cls[c]:>5} mots")
        for ix in cands:
            j = jaccard(ix, c)
            if not j:
                continue
            m = mult_ok[ix][c] / A[ix][c] * 100 if A[ix][c] else 0
            print(f"     index {ix:>2}  J={j:>5.1%}  M={m:>5.1f} %  "
                  f"({A[ix][c]:>4}/{tot_cls[c]})  {barre(round(j * 100), 100)}")
        if sans_couleur[c]:
            print(f"     aucune couleur : {sans_couleur[c]} mots "
                  f"({sans_couleur[c] / tot_cls[c]:.1%})")
        if best is not None:
            retenu[c] = best

    # --- 7. bijectivité de l'appariement -----------------------------------
    print(f"\n[7] APPARIEMENT RETENU (meilleur Jaccard des deux côtés)")
    croise = {}
    for c, ix in retenu.items():
        if meilleur.get(ix, (None,))[0] == c:
            croise[ix] = c
    for ix in sorted(tot_idx):
        c = croise.get(ix)
        print(f"    index {ix:>2} → {c if c else '— (pas d’accord dans les deux sens)'}"
              + (f"   J={jaccard(ix, c):.1%}" if c else ""))
    orphelines = sorted(set(tot_cls) - set(croise.values()))
    print(f"    classes sans index apparié : {orphelines or 'aucune'}")

    if sortie_json:
        obj = {
            "palettes": palettes,
            "couches": dict(sorted(couches.items())),
            "fin_de_verset": dict(sorted(fin_cnt.items())),
            "mots_par_index": dict(sorted(mot_cnt.items())),
            "cooccurrence": {str(i): dict(c) for i, c in sorted(A.items())},
            "multiplicite_ok": {str(i): dict(c) for i, c in sorted(mult_ok.items())},
            "index_sans_portee": dict(sorted(sans_classe.items())),
            "classe_sans_couleur": dict(sorted(sans_couleur.items())),
            "appariement": {str(i): c for i, c in sorted(croise.items())},
            "totaux": {"index": dict(sorted(tot_idx.items())),
                       "classes": dict(sorted(tot_cls.items())),
                       "mots_apparies": apparies},
        }
        with open(sortie_json, "w", encoding="utf-8", newline="\n") as f:
            json.dump(obj, f, ensure_ascii=False, indent=1)
        print(f"\n→ tables déposées dans {sortie_json}")


if __name__ == "__main__":
    main()
