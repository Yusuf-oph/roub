"""Découpe les polices de noms de sourates aux seules sourates couvertes.

Deux polices du Complexe du Roi Fahd, deux emplois distincts :
  - QCF_FullSurah_HD_COLOR-v1 : le nom calligraphié précédé de سُورَة, en
    couleur (tables CPAL + SVG). Sert de TITRE dans Versets, Texte continu et
    l'onglet Tafsir.
  - QCF_SurahHeader_COLOR : le bandeau orné du haut de page. Sert sur la PAGE
    IMPRIMÉE, dont il achève la reproduction. Malgré son nom il ne porte
    aucune table de couleur : il suit donc `currentColor` et prend les trois
    palettes sans réglage.

⚠ Les points de code ne suivent PAS l'ordre des sourates : U+FB51, le premier,
est la sourate 22. La table vient des fichiers de ligatures officiels de QUL,
elle n'est jamais déduite.

Le découpage est lié aux sourates RÉELLEMENT présentes dans `pages2.js` : le
jour où un juz est ajouté, rejouer ce script, sinon les nouvelles sourates
n'auront pas de glyphe.

    python tools/build_polices_noms.py
"""
import json
import re
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

RACINE = Path(__file__).resolve().parent.parent
SRC = RACINE / "tools" / "cache" / "qul"
POLICES = SRC / "polices-noms"
SORTIE = RACINE / "app" / "fonts"

# (fichier source, fichier livré, à quoi ça sert)
JEUX = [
    ("237-surah_names_v4.ttf", "QCF_FullSurahHD.woff2", "titre calligraphié"),
    ("458-QCF_SurahHeader_COLOR.ttf", "QCF_SurahHeader.woff2", "bandeau de page"),
]


def sourates_couvertes():
    """Les sourates présentes dans la pagination, seule source de vérité."""
    src = (RACINE / "app" / "data" / "pages2.js").read_text(encoding="utf-8")
    return sorted({int(m) for m in re.findall(r'"k":"(\d+):', src)})


def table_glyphes():
    """surah-N -> caractère, d'après le fichier de ligatures officiel."""
    f = SRC / "extrait" / "Surah_header_ligatures.json"
    lig = json.loads(f.read_text(encoding="utf-8"))
    return {int(k.split("-")[1]): v.strip()
            for k, v in lig.items() if k.startswith("surah-")}


def main():
    sourates = sourates_couvertes()
    glyphes = table_glyphes()

    manquantes = [n for n in sourates if n not in glyphes]
    if manquantes:
        raise SystemExit(f"pas de glyphe pour les sourates {manquantes}")

    points = {ord(glyphes[n]) for n in sourates}
    print(f"{len(sourates)} sourates couvertes, {len(points)} points de code")

    for source, livre, role in JEUX:
        chemin = POLICES / source
        if not chemin.exists():
            raise SystemExit(f"absent : {chemin}\n"
                             "  (fichiers publics sur static-cdn.tarteel.ai)")
        avant = chemin.stat().st_size
        f = TTFont(chemin)
        o = Options()
        o.layout_features = ["*"]      # les ligatures servent à d'autres appels
        o.notdef_outline = True
        s = Subsetter(options=o)
        s.populate(unicodes=points)
        s.subset(f)
        f.flavor = "woff2"
        f.save(SORTIE / livre)
        apres = (SORTIE / livre).stat().st_size
        print(f"  {livre:24} {avant/1024:6.0f} Ko -> {apres/1024:5.0f} Ko   ({role})")

    # la table que l'application lit pour savoir quel caractère écrire
    dest = RACINE / "app" / "data" / "noms-sourates.js"
    corps = json.dumps({str(n): glyphes[n] for n in sourates},
                       ensure_ascii=False, indent=0).replace("\n", "")
    dest.write_text(
        "/* Généré par tools/build_polices_noms.py — ne pas éditer.\n"
        "   Sourate -> caractère du bandeau, d'après les ligatures officielles\n"
        "   de QUL. L'ordre des points de code NE SUIT PAS celui des sourates. */\n"
        f"window.NOMS_SOURATES = {corps};\n", encoding="utf-8")
    print(f"  {dest.name:24} {len(sourates)} entrées")


if __name__ == "__main__":
    main()
