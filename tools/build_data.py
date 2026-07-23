# -*- coding: utf-8 -*-
"""Assemble app/data/quran/j*r*.js à partir du cache.

Pour chaque verset :
  - ar   : texte uthmani CANONIQUE (jamais modifié)
  - taj  : spans de coloration [[début, fin, classe], ...] obtenus en
           projetant les balises du texte tajwid de quran.com sur le texte
           uthmani par alignement de séquences (difflib). Le texte affiché
           reste byte-identique à l'uthmani ; seules les positions de
           couleur dérivent de l'alignement.
  - sci / fr : translittérations (translit.py)
  - tr   : traduction Hamidullah (appels de notes retirés)
  - audio: fichier mp3 (Husary 64 kbps)
"""
import difflib
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from translit import translit_verse  # noqa: E402

CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "app", "data", "quran")

SURAHS = {1: "Al-Fâtiḥa", 2: "Al-Baqara",
          78: "An-Naba'", 79: "An-Nâzi'ât", 80: "'Abasa", 81: "At-Takwîr",
          82: "Al-Infitâr", 83: "Al-Mutaffifîn", 84: "Al-Inshiqâq",
          85: "Al-Burûj", 86: "At-Târiq", 87: "Al-A'lâ", 88: "Al-Ghâshiya",
          89: "Al-Fajr", 90: "Al-Balad", 91: "Ash-Shams", 92: "Al-Layl",
          93: "Ad-Duhâ", 94: "Ash-Sharh", 95: "At-Tîn", 96: "Al-'Alaq",
          97: "Al-Qadr", 98: "Al-Bayyina", 99: "Az-Zalzala",
          100: "Al-'Âdiyât", 101: "Al-Qâri'a", 102: "At-Takâthur",
          103: "Al-'Asr", 104: "Al-Humaza", 105: "Al-Fîl", 106: "Quraysh",
          107: "Al-Mâ'ûn", 108: "Al-Kawthar", 109: "Al-Kâfirûn",
          110: "An-Nasr", 111: "Al-Masad", 112: "Al-Ikhlâs",
          113: "Al-Falaq", 114: "An-Nâs"}


def parse_tajweed(html):
    """-> liste de (caractère, classe|None), balises retirées."""
    html = re.sub(r"<span class=end>[^<]*</span>", "", html)
    toks = []
    cls = None
    for part in re.split(r"(<tajweed class=[\w]+>|</tajweed>)", html):
        m = re.match(r"<tajweed class=([\w]+)>", part)
        if m:
            cls = m.group(1)
        elif part == "</tajweed>":
            cls = None
        else:
            for ch in part:
                toks.append((ch, cls))
    # espaces de tête/queue
    while toks and toks[0][0].isspace():
        toks.pop(0)
    while toks and toks[-1][0].isspace():
        toks.pop()
    return toks


def project_spans(taj_html, uthmani):
    """Aligne le texte tajwid nettoyé sur l'uthmani, projette les classes."""
    toks = parse_tajweed(taj_html)
    taj_chars = [t[0] for t in toks]
    taj_cls = [t[1] for t in toks]
    uth = list(uthmani)
    sm = difflib.SequenceMatcher(None, taj_chars, uth, autojunk=False)
    cls_by_pos = [None] * len(uth)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                cls_by_pos[j1 + k] = taj_cls[i1 + k]
        elif op == "replace":
            ln_t, ln_u = i2 - i1, j2 - j1
            for k in range(ln_u):
                src = i1 + min(k, ln_t - 1) if ln_t else None
                cls_by_pos[j1 + k] = taj_cls[src] if src is not None else None
        # delete : caractères propres au texte tajwid, ignorés
        # insert : caractères propres à l'uthmani, sans classe

    # Alignement sur les grappes (lettre + marques combinantes) : un span ne
    # doit JAMAIS commencer sur une marque, sinon le navigateur la rend sur
    # un cercle pointillé de repli (marque séparée de sa base par la
    # frontière d'élément). On colore la grappe entière, comme les mushafs
    # tajwid imprimés.
    cls2 = [None] * len(uth)
    i = 0
    while i < len(uth):
        j = i + 1
        while j < len(uth) and unicodedata.category(uth[j]) in ("Mn", "Me"):
            j += 1
        c = next((cls_by_pos[p] for p in range(i, j) if cls_by_pos[p]), None)
        for p in range(i, j):
            cls2[p] = c
        i = j

    spans = []
    start = None
    cur = None
    for pos, c in enumerate(cls2):
        if c != cur:
            if cur is not None:
                spans.append([start, pos, cur])
            start, cur = pos, c
    if cur is not None:
        spans.append([start, len(uth), cur])
    return spans


def clean_trad(t):
    t = re.sub(r"<sup[^>]*>[^<]*</sup>", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", t).strip()


def main():
    verses = json.load(open(os.path.join(CACHE, "verses.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    rubs = {}
    all_classes = {}
    for v in verses:
        s, a = v["key"].split(":")
        s, a = int(s), int(a)
        sci, fr = translit_verse(v["imlaei"])
        spans = project_spans(v["tajweed"], v["uthmani"])
        for _, _, c in spans:
            all_classes[c] = all_classes.get(c, 0) + 1
        entry = {
            "k": v["key"], "s": s, "a": a,
            "ar": v["uthmani"],
            "taj": spans,
            "sci": sci, "fr": fr,
            "tr": clean_trad(v["trad"]),
            "audio": f"{s:03d}{a:03d}.mp3",
        }
        rubs.setdefault(v["rub"], []).append(entry)

    for num in sorted(rubs):
        juz = (num - 1) // 8 + 1
        rub_local = (num - 1) % 8 + 1
        rid = f"j{juz}r{rub_local}"
        vv = rubs[num]
        surahs = sorted({e["s"] for e in vv})
        obj = {
            "id": rid, "juz": juz, "rub": rub_local, "rubGlobal": num,
            "debut": vv[0]["k"], "fin": vv[-1]["k"], "n": len(vv),
            "surahs": [{"num": s, "nom": SURAHS[s]} for s in surahs],
            "verses": vv,
        }
        path = os.path.join(OUT, rid + ".js")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write("window.QURAN = window.QURAN || {};\n")
            f.write(f"window.QURAN[{json.dumps(rid)}] = ")
            f.write(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")
        print(f"{rid}: {len(vv)} versets, {os.path.getsize(path)//1024} Ko")

    print("classes tajwid:", json.dumps(all_classes, indent=0, sort_keys=True))

    # contrôle : le texte reconstruit est byte-identique à l'uthmani
    for num, vv in rubs.items():
        for e in vv:
            for st, en, c in e["taj"]:
                assert 0 <= st < en <= len(e["ar"]), (e["k"], st, en)
    print("OK: spans bornés, texte canonique intact par construction")


if __name__ == "__main__":
    main()
