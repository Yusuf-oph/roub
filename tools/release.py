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
    files = ["./", "index.html", "styles.css", "app.js",
             "manifest.webmanifest", "version.json",
             "fonts/UthmanicHafs.woff2"]
    for f in sorted(os.listdir(os.path.join(APP, "icons"))):
        files.append(f"icons/{f}")
    for sub in ("", "quran", "notes", "cartes"):
        d = os.path.join(APP, "data", sub)
        for f in sorted(os.listdir(d)):
            if f.endswith(".js"):
                files.append(f"data/{sub + '/' if sub else ''}{f}")
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
