# -*- coding: utf-8 -*-
"""Convertit un document Markdown de travail (digest, fiche d'arbitrage) en
PDF A4 lisible, aux couleurs de Roub'.

    python tools/md2pdf.py arbitrage/DIGEST-arbitrages-Anis.md
    python tools/md2pdf.py source.md destination.pdf --titre "..." --pied "..."

Gère : titres #/##/###, listes à puces et numérotées, tableaux, séparateurs,
gras/italique, liens (rendus en texte + URL), citations >.
"""
import argparse
import os
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from reportlab.platypus import (HRFlowable, KeepTogether, Paragraph,
                                SimpleDocTemplate, Table, TableStyle)

# Helvetica ne connaît pas les lettres translittérées (ṣ, ḥ, ṭ, ā…) : sans
# police Unicode, elles sortent en carrés noirs. Segoe UI les couvre.
FONTS = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
BASE, GRAS, ITAL, GRASITAL = "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"
try:
    for nom, fichier in (("Roub", "segoeui.ttf"), ("Roub-Gras", "segoeuib.ttf"),
                         ("Roub-Ital", "segoeuii.ttf"), ("Roub-GrasItal", "segoeuiz.ttf")):
        pdfmetrics.registerFont(TTFont(nom, os.path.join(FONTS, fichier)))
    addMapping("Roub", 0, 0, "Roub")
    addMapping("Roub", 1, 0, "Roub-Gras")
    addMapping("Roub", 0, 1, "Roub-Ital")
    addMapping("Roub", 1, 1, "Roub-GrasItal")
    BASE, GRAS, ITAL, GRASITAL = "Roub", "Roub-Gras", "Roub-Ital", "Roub-GrasItal"
except Exception as e:                                    # police absente : on reste lisible
    print("police Unicode indisponible, repli sur Helvetica :", e)

INK = colors.HexColor("#1a1a1a")
ACCENT = colors.HexColor("#157a5b")      # le vert de Roub' (thème clair)
GREY = colors.HexColor("#4a4a4a")

S = {
    "title": ParagraphStyle("title", fontName=GRAS, fontSize=16,
                            leading=19, textColor=ACCENT, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName=GRAS, fontSize=12.5, leading=15,
                         textColor=ACCENT, spaceBefore=14, spaceAfter=5),
    "h3": ParagraphStyle("h3", fontName=GRAS, fontSize=10.5, leading=13,
                         textColor=INK, spaceBefore=9, spaceAfter=3),
    "body": ParagraphStyle("body", fontName=BASE, fontSize=9.4, leading=13,
                           textColor=INK, spaceBefore=3, spaceAfter=3,
                           alignment=4),                      # justifié
    "li": ParagraphStyle("li", fontName=BASE, fontSize=9.4, leading=13,
                         textColor=INK, leftIndent=15, bulletIndent=3,
                         spaceBefore=2, spaceAfter=2, alignment=4),
    "quote": ParagraphStyle("quote", fontName=ITAL, fontSize=9.2,
                            leading=12.6, textColor=GREY, leftIndent=14,
                            spaceBefore=3, spaceAfter=3),
    "note": ParagraphStyle("note", fontName=ITAL, fontSize=9,
                           leading=12, textColor=GREY, spaceBefore=3, spaceAfter=3),
    "cell": ParagraphStyle("cell", fontName=BASE, fontSize=8.6, leading=11,
                           textColor=INK),
    "cellh": ParagraphStyle("cellh", fontName=GRAS, fontSize=8.7,
                            leading=11, textColor=INK),
}


def inline(md):
    t = md.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = t.replace("→", "-&gt;").replace("⚠", "(!)")
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", t)   # lien -> texte + URL
    t = t.replace("`", "")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", t)
    return t


def make_table(rows, avail):
    n = len(rows[0])
    widths = [avail / n] * n
    data = [[Paragraph(inline(c), S["cellh" if r == 0 else "cell"]) for c in row]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c4c4c4")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6f1ec")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def recoller(md_text):
    """Markdown : un paragraphe peut s'étaler sur plusieurs lignes. On les
    recolle avant analyse, sinon un **gras** à cheval sur deux lignes n'est
    jamais reconnu (et la justification n'a plus rien à justifier)."""
    sortie, tampon = [], []

    def vider():
        if tampon:
            sortie.append(" ".join(tampon))
            tampon.clear()

    for raw in md_text.splitlines():
        st = raw.strip()
        seul = (not st or st == "---" or st.startswith("|") or st.startswith("#")
                or st.startswith("> ") or st.startswith("- ")
                or re.match(r"^\d+\.\s", st))
        if seul:
            vider()
            sortie.append(raw)
            continue
        # ligne de continuation d'une puce ou d'un paragraphe déjà commencé
        if tampon or not sortie or not (sortie[-1].strip().startswith(("- ", ">"))
                                        or re.match(r"^\d+\.\s", sortie[-1].strip())):
            tampon.append(st)
        else:
            sortie[-1] = sortie[-1].rstrip() + " " + st
    vider()
    return "\n".join(sortie)


def build_story(md_text, avail):
    md_text = recoller(md_text)
    story, table_buf, pending = [], [], []

    def emit(flowable):
        nonlocal pending
        if pending:
            story.append(KeepTogether(pending + [flowable]))
            pending = []
        else:
            story.append(flowable)

    def flush_table():
        nonlocal table_buf
        if table_buf:
            rows = [r for r in table_buf
                    if not all(re.fullmatch(r":?-{2,}:?", c) for c in r)]
            emit(make_table(rows, avail))
            table_buf = []

    for raw in md_text.splitlines():
        line = raw.rstrip()
        if line.strip().startswith("|"):
            table_buf.append([c.strip() for c in line.strip().strip("|").split("|")])
            continue
        flush_table()
        st = line.strip()
        if not st:
            continue
        if st == "---":
            story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#cccccc"),
                                    spaceBefore=8, spaceAfter=8))
        elif line.startswith("# "):
            story.append(Paragraph(inline(line[2:]), S["title"]))
        elif line.startswith("## "):
            pending.append(Paragraph(inline(line[3:]), S["h2"]))
        elif line.startswith("### "):
            pending.append(Paragraph(inline(line[4:]), S["h3"]))
        elif st.startswith("> "):
            emit(Paragraph(inline(st[2:]), S["quote"]))
        elif re.match(r"^\d+\.\s", st):
            m = re.match(r"^(\d+)\.\s+(.*)$", st)
            p = Paragraph(inline(m.group(2)), S["li"])
            p.bulletText = m.group(1) + "."
            emit(p)
        elif st.startswith("- "):
            p = Paragraph(inline(st[2:]), S["li"])
            p.bulletText = "•"
            emit(p)
        else:
            italique = st.startswith("*") and st.endswith("*") and not st.startswith("**")
            emit(Paragraph(inline(st.strip("*") if italique else st),
                           S["note"] if italique else S["body"]))
    flush_table()
    story.extend(pending)
    return story


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("destination", nargs="?")
    ap.add_argument("--titre", default=None)
    ap.add_argument("--pied", default="Roub' ۞ document de travail")
    a = ap.parse_args()

    dest = a.destination or os.path.splitext(a.source)[0] + ".pdf"
    md = open(a.source, encoding="utf-8").read()
    titre = a.titre or next((l[2:].strip() for l in md.splitlines()
                             if l.startswith("# ")), os.path.basename(a.source))

    def pied(canv, doc):
        canv.saveState()
        canv.setFont(BASE, 7.4)
        canv.setFillColor(colors.HexColor("#666666"))
        canv.drawString(1.5 * cm, 0.9 * cm, a.pied)
        canv.drawRightString(A4[0] - 1.5 * cm, 0.9 * cm, "Page %d" % doc.page)
        canv.restoreState()

    doc = SimpleDocTemplate(dest, pagesize=A4,
                            leftMargin=1.5 * cm, rightMargin=1.5 * cm,
                            topMargin=1.4 * cm, bottomMargin=1.6 * cm,
                            title=titre, author="Roub'")
    doc.build(build_story(md, A4[0] - 3 * cm), onFirstPage=pied, onLaterPages=pied)
    print(f"{dest} ({os.path.getsize(dest) // 1024} Ko)")


if __name__ == "__main__":
    main()
