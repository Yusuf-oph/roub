# -*- coding: utf-8 -*-
"""Prépare une version : SemVer + date de build (décision 2026-07-23).

  python tools/release.py            # re-stampe la version courante (date du jour)
  python tools/release.py 1.2.0     # nouvelle version (SemVer choisi à la main)

Fait :
  - version.json : champs version/date (les notes s'éditent à la main AVANT) ;
  - app/sw.js : VERSION = "x.y.z+AAAA-MM-JJ" (clé de cache) + liste SHELL
    régénérée (coquille : html/css/js/manifest/icônes/données/police texte) ;
  - CHANGELOG.md : entrée squelette si nouvelle version.
"""
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
APP = os.path.join(ROOT, "app")


def shell_files():
    files = ["./", "index.html", "roub-themes.css", "styles.css", "app.js",
             "manifest.webmanifest", "version.json",
             "fonts/UthmanicHafs.woff2"]
    # Polices latines des trois thèmes : les DIX fichiers, ~548 Ko sous-ensemblés
    # (décision de Yusuf, 27/07, contre l'avis du dessinateur qui n'en voulait
    # que deux). La raison : l'application se veut utilisable hors connexion, et
    # un sélecteur de thème qui sert une police de repli parce qu'on est dans le
    # métro est un sélecteur qui ment. 548 Ko une fois valent mieux qu'une
    # promesse tenue à moitié.
    fdir = os.path.join(APP, "fonts")
    for f in sorted(os.listdir(fdir)):
        if f.endswith(".woff2") and f != "UthmanicHafs.woff2":
            files.append(f"fonts/{f}")
    # paquet Anki proposé au téléchargement : précaché, sinon le bouton
    # échoue sans connexion (1,4 Mo, régénéré par build_apkg.py collection)
    if os.path.exists(os.path.join(APP, "anki", "roub-cartes.apkg")):
        files.append("anki/roub-cartes.apkg")
    for f in sorted(os.listdir(os.path.join(APP, "icons"))):
        files.append(f"icons/{f}")
    for sub in ("", "quran", "notes", "cartes", "tafsirfr", "segments"):
        d = os.path.join(APP, "data", sub)
        for f in sorted(os.listdir(d)):
            if f.endswith(".js"):
                files.append(f"data/{sub + '/' if sub else ''}{f}")
    # Planificateur FSRS-6 : la glu ESM, le WebAssembly, et le fragment
    # wasm-bindgen-rayon que la glu importe STATIQUEMENT. Sans lui, le module ne
    # se charge pas du tout.
    # ⚠ PARCOURS RÉCURSIF OBLIGATOIRE ICI, contrairement à tout le reste de cette
    # fonction : ce fragment vit sous snippets/…/src/, et un os.listdir non
    # récursif l'oublierait. L'application marcherait alors en ligne et casserait
    # HORS CONNEXION, c'est-à-dire le défaut le plus difficile à voir venir.
    # Les deux fichiers de licence sont volontairement exclus : ils doivent
    # accompagner la redistribution du dépôt, pas peser dans la coquille.
    vdir = os.path.join(APP, "vendor")
    for racine, _, noms in os.walk(vdir):
        for f in sorted(noms):
            if f.endswith(".txt"):
                continue
            rel = os.path.relpath(os.path.join(racine, f), APP).replace(os.sep, "/")
            files.append(rel)
    return files


def main():
    vpath = os.path.join(APP, "version.json")
    vj = json.load(open(vpath, encoding="utf-8"))
    old = vj["version"]
    new = sys.argv[1] if len(sys.argv) > 1 else old
    if not re.fullmatch(r"\d+\.\d+\.\d+", new):
        raise SystemExit(f"version invalide : {new} (attendu MAJOR.MINOR.PATCH)")
    today = time.strftime("%Y-%m-%d")
    vj["version"], vj["date"] = new, today
    with open(vpath, "w", encoding="utf-8", newline="\n") as f:
        json.dump(vj, f, ensure_ascii=False, indent=2)

    app_path = os.path.join(APP, "app.js")
    aj = open(app_path, encoding="utf-8").read()
    aj = re.sub(r'const BUILD_VERSION = "[^"]*";',
                f'const BUILD_VERSION = "{new}";', aj, count=1)
    open(app_path, "w", encoding="utf-8", newline="\n").write(aj)

    sw_path = os.path.join(APP, "sw.js")
    sw = open(sw_path, encoding="utf-8").read()
    sw = re.sub(r'const VERSION = "[^"]*";',
                f'const VERSION = "{new}+{today}";', sw)
    shell = json.dumps(shell_files(), ensure_ascii=False, indent=2)
    sw = re.sub(r"// __SHELL_START__.*?// __SHELL_END__",
                f"// __SHELL_START__\nconst SHELL = {shell};\n// __SHELL_END__",
                sw, flags=re.S)
    open(sw_path, "w", encoding="utf-8", newline="\n").write(sw)

    ch_path = os.path.join(ROOT, "CHANGELOG.md")
    ch = open(ch_path, encoding="utf-8").read() if os.path.exists(ch_path) else "# Changelog\n"
    if new != old and f"## {new}" not in ch:
        entry = f"\n## {new} · {today}\n" + "".join(f"- {n}\n" for n in vj.get("notes", []))
        ch = ch.replace("# Changelog\n", "# Changelog\n" + entry, 1)
        open(ch_path, "w", encoding="utf-8", newline="\n").write(ch)

    print(f"version {old} -> {new} ({today}), SHELL: {len(shell_files())} fichiers")


if __name__ == "__main__":
    main()
