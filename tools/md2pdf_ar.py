# -*- coding: utf-8 -*-
"""Markdown -> PDF pour les documents qui CITENT DE L'ARABE.

    python tools/md2pdf_ar.py arbitrage/fiche-F-tajwid-obligatoire.md
    python tools/md2pdf_ar.py source.md destination.pdf --titre "..."

Pourquoi un second convertisseur à côté de md2pdf.py : reportlab ne sait ni
former les lettres arabes (chaque lettre a 4 formes selon sa position) ni
inverser le sens de lecture. Un texte arabe en sort en bouillie. On passe donc
par HTML + impression Edge headless, qui fait les deux nativement.

Police : Segoe UI pour tout, arabe compris (comparée le 25/07 à Tahoma, Arial,
Times et à l'UthmanicHafs de l'appli : celle-ci rend la virgule arabe « ، »
comme un rond, elle est faite pour le rasm du mushaf, pas pour de la prose).

Markdown reconnu : titres #/##/###, paragraphes (lignes recollées), listes à
puces et numérotées, citations >, tableaux, gras/italique/code, liens.
"""
import argparse
import html
import os
import re
import subprocess
import sys
import time

EDGE = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
ARABE = re.compile(r"[\u0600-\u06FF]")

CSS = """
@page { size: A4; margin: 17mm 16mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", sans-serif; font-size: 10.2pt; line-height: 1.5;
       color: #1a1a1a; margin: 0; }
h1 { font-size: 17pt; color: #157a5b; margin: 0 0 2mm; }
h2 { font-size: 12.6pt; color: #157a5b; margin: 7mm 0 2mm;
     border-bottom: .4pt solid #cfe0d9; padding-bottom: 1mm; }
h3 { font-size: 11pt; margin: 5mm 0 1.5mm; }
h2, h3 { break-after: avoid; }
p { margin: 0 0 2.4mm; text-align: justify; }
ul, ol { margin: 0 0 2.4mm; padding-inline-start: 6mm; }
li { margin: 0 0 1.2mm; text-align: justify; }
code { font-family: Consolas, monospace; font-size: 9pt; background: #f2f4f3;
       padding: 0 .8mm; border-radius: 1.5pt; }
blockquote { margin: 2.5mm 0 2.5mm 0; padding: 2mm 4mm; background: #f6f8f7;
             border-inline-start: 2.2pt solid #157a5b; break-inside: avoid; }
blockquote p { margin: 0; }
blockquote + p em:first-child { color: #3d5a50; }
.ar { direction: rtl; text-align: right; font-size: 13.4pt; line-height: 2.05; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9.2pt; }
th { background: #157a5b; color: #fff; text-align: start; font-weight: 600; }
th, td { border: .4pt solid #cfe0d9; padding: 1.4mm 2mm; vertical-align: top; }
tr { break-inside: avoid; }
.pied { margin-top: 8mm; padding-top: 2mm; border-top: .4pt solid #cfe0d9;
        font-size: 8.6pt; color: #4a4a4a; }
"""


def en_ligne(t):
    """gras, italique, code, liens ; le reste est échappé.
    Ponctuation française : espace insécable avant ? ! ; : et dans les
    guillemets, sinon le signe part seul à la ligne suivante. (Insécable
    normale et non fine : Segoe UI rend la fine si serrée qu'on croit à une
    espace manquante.)"""
    t = html.escape(t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"~~([^~]+)~~", r"<s>\1</s>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![*\w])\*([^*]+)\*", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", t)
    t = re.sub(r" ([?!;:])(?=\s|$|<)", " \\1", t)
    return t.replace("« ", "« ").replace(" »", " »")


def bloc_arabe(t):
    """majoritairement arabe : à composer de droite à gauche"""
    lettres = [c for c in t if c.isalpha()]
    return bool(lettres) and sum(bool(ARABE.match(c)) for c in lettres) > len(lettres) * .5


def cellules(ligne):
    return [c.strip() for c in ligne.strip().strip("|").split("|")]


def convertir(md):
    out, i, lignes = [], 0, md.split("\n")
    while i < len(lignes):
        l = lignes[i]
        if not l.strip():
            i += 1
            continue
        if l.startswith("#"):
            n = len(l) - len(l.lstrip("#"))
            out.append(f"<h{min(n,3)}>{en_ligne(l[n:].strip())}</h{min(n,3)}>")
            i += 1
        elif l.startswith(">"):
            corps = []
            while i < len(lignes) and lignes[i].startswith(">"):
                corps.append(lignes[i].lstrip(">").strip())
                i += 1
            # une ligne vide (« > ») sépare deux citations dans un même bloc ;
            # une ligne qui porte le séparateur d'hémistiches « … » est un VERS :
            # elle garde sa propre ligne au lieu d'être recollée à la prose
            paras, cour = [], []
            for c in corps:
                if c and "…" in c:
                    if cour:
                        paras.append(" ".join(cour))
                        cour = []
                    paras.append(c)
                elif c:
                    cour.append(c)
                elif cour:
                    paras.append(" ".join(cour))
                    cour = []
            if cour:
                paras.append(" ".join(cour))
            dedans = "".join(
                f'<p class="ar">{en_ligne(p)}</p>' if bloc_arabe(p) else f"<p>{en_ligne(p)}</p>"
                for p in paras)
            out.append(f"<blockquote>{dedans}</blockquote>")
        elif l.lstrip().startswith(("- ", "* ")) or re.match(r"\s*\d+\. ", l):
            ordonnee = bool(re.match(r"\s*\d+\. ", l))
            items = []
            while i < len(lignes) and (lignes[i].lstrip().startswith(("- ", "* "))
                                       or re.match(r"\s*\d+\. ", lignes[i])
                                       or (items and lignes[i].startswith("  ") and lignes[i].strip())):
                s = lignes[i].strip()
                if s.startswith(("- ", "* ")) or re.match(r"\d+\. ", s):
                    items.append(re.sub(r"^(?:[-*] |\d+\. )", "", s))
                else:
                    items[-1] += " " + s
                i += 1
            balise = "ol" if ordonnee else "ul"
            out.append(f"<{balise}>" + "".join(f"<li>{en_ligne(x)}</li>" for x in items)
                       + f"</{balise}>")
        elif l.startswith("|"):
            tab = []
            while i < len(lignes) and lignes[i].startswith("|"):
                tab.append(lignes[i])
                i += 1
            entete = cellules(tab[0])
            corps = [cellules(x) for x in tab[1:] if not set(x) <= set("|-: ")]
            h = "<tr>" + "".join(f"<th>{en_ligne(c)}</th>" for c in entete) + "</tr>"
            for r in corps:
                h += "<tr>" + "".join(f"<td>{en_ligne(c)}</td>" for c in r) + "</tr>"
            out.append(f"<table>{h}</table>")
        elif set(l.strip()) <= set("-") and len(l.strip()) >= 3:
            out.append("<hr>")
            i += 1
        else:
            para = []
            while i < len(lignes) and lignes[i].strip() and not lignes[i].startswith(
                    ("#", ">", "|", "- ", "* ")) and not re.match(r"\s*\d+\. ", lignes[i]):
                para.append(lignes[i].strip())
                i += 1
            t = " ".join(para)
            classe = ' class="ar"' if bloc_arabe(t) else ""
            out.append(f"<p{classe}>{en_ligne(t)}</p>")
    return "\n".join(out)


def edge():
    for e in EDGE:
        if os.path.exists(e):
            return e
    sys.exit("Edge introuvable : impossible de composer l'arabe sans navigateur.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("destination", nargs="?")
    ap.add_argument("--titre", default=None)
    ap.add_argument("--pied", default=None)
    a = ap.parse_args()
    dest = a.destination or os.path.splitext(a.source)[0] + ".pdf"
    md = open(a.source, encoding="utf-8").read()
    corps = convertir(md)
    if a.pied:
        corps += f'<p class="pied">{en_ligne(a.pied)}</p>'
    titre = a.titre or os.path.basename(a.source)
    page = (f"<!doctype html><html lang=fr><head><meta charset=utf-8>"
            f"<title>{html.escape(titre)}</title><style>{CSS}</style></head>"
            f"<body>{corps}</body></html>")
    tmp = os.path.abspath(dest) + ".html"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(page)
    subprocess.run([edge(), "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={os.path.abspath(dest)}",
                    "file:///" + tmp.replace("\\", "/")],
                   check=True, capture_output=True, timeout=180)
    for _ in range(20):                       # Edge écrit de façon asynchrone
        if os.path.exists(dest) and os.path.getsize(dest) > 1000:
            break
        time.sleep(0.5)
    os.remove(tmp)
    print(f"{dest} : {os.path.getsize(dest)//1024} Ko")


if __name__ == "__main__":
    main()
