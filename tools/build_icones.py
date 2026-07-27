#!/usr/bin/env python3
"""Rastérise les icônes de l'application depuis le SVG maître.

    python tools/build_icones.py

Le SVG est la SOURCE : les PNG en dérivent, ils ne sont jamais redessinés.
Aucune dépendance à installer, on se sert d'Edge en mode sans interface, la
même technique que md2pdf_ar.py et que la recette des captures.

⚠ Les navigateurs cachent les icônes de PWA PAR URL. Changer le dessin sans
changer le nom de fichier laisse les appareils déjà installés sur l'ancienne
image, parfois très longtemps. Si le dessin change, changer aussi les noms
ci-dessous, dans manifest.webmanifest, dans index.html ET dans
release.py::shell_files, faute de quoi l'icône manquera hors connexion.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "tools" / "logo" / "roub-icone-application.svg"
DEST = RACINE / "app" / "icons"

# (nom de fichier, côté en pixels)
CIBLES = [
    ("roub-192.png", 192),
    ("roub-512.png", 512),
    ("roub-touch-180.png", 180),
]

EDGE = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def edge():
    for chemin in EDGE:
        if Path(chemin).exists():
            return chemin
    trouve = shutil.which("msedge")
    if trouve:
        return trouve
    sys.exit("Edge introuvable : adapter la liste EDGE dans ce script.")


def rendre(svg, sortie, cote, navigateur):
    """Une page HTML de la taille exacte, le SVG l'occupe entièrement."""
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<style>html,body{margin:0;padding:0;background:transparent}"
        f"svg{{display:block;width:{cote}px;height:{cote}px}}</style>" + svg
    )
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "icone.html"
        page.write_text(html, encoding="utf-8")
        # un profil NEUF par rendu : deux Edge lancés sur le même profil et le
        # second ne fait rien, sans message, en laissant l'ancienne image
        subprocess.run(
            [navigateur, "--headless", "--disable-gpu", "--hide-scrollbars",
             f"--window-size={cote},{cote}",
             f"--user-data-dir={Path(tmp) / 'profil'}",
             "--virtual-time-budget=4000",
             f"--screenshot={sortie}", page.as_uri()],
            check=True, capture_output=True,
        )


def main():
    if not SOURCE.exists():
        sys.exit(f"source absente : {SOURCE}")
    svg = SOURCE.read_text(encoding="utf-8")
    navigateur = edge()
    DEST.mkdir(parents=True, exist_ok=True)
    for nom, cote in CIBLES:
        sortie = DEST / nom
        rendre(svg, sortie, cote, navigateur)
        if not sortie.exists():
            sys.exit(f"{nom} n'a pas été écrit")
        print(f"  {nom:22} {cote}x{cote}  {sortie.stat().st_size:>7} o")
    print(f"{len(CIBLES)} icônes rendues depuis {SOURCE.name}")


if __name__ == "__main__":
    main()
