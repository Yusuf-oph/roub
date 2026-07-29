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

# ---------------------------------------------------------------- recalage
# L'application AFFICHE l'uthmani et TRANSLITTERE l'imlaei. Les deux viennent du
# meme Complexe du Roi Fahd mais ne decoupent pas toujours les mots pareil :
#   2:21   uthmani  يَـٰٓأَيُّهَا  (1 mot)   imlaei  يَا أَيُّهَا  (2 mots)
#   2:181  uthmani  بَعْدَ مَا     (2 mots)  imlaei  بَعْدَمَا     (1 mot)
# La translittetation heritait donc du decoupage imlaei, et ne s'alignait plus
# mot a mot sur l'arabe affiche : 26 versets sur 823, ce qui obligeait l'appli a
# rendre la translittetation ENTIERE au lieu d'une coupe (cf. trancheTranslit).
#
# On recale donc les jetons de translittetation sur le decoupage UTHMANI, qui
# est celui que l'utilisateur a sous les yeux.
#
# ⚠ APPROCHE ABANDONNEE, ET POURQUOI : j'ai d'abord ecrit un aligneur GENERAL
# comparant des squelettes consonantiques normalises. Il s'est revele fragile —
# chaque regle ajoutee (alif suscrit, waw+alif suscrit de حَيَوٰة...) en cassait
# une autre, et le nombre de versets corriges OSCILLAIT au lieu de monter. Sur
# du texte coranique affiche, un aligneur qui se trompe en silence est pire que
# pas d'aligneur du tout.
# On s'en tient donc a la classe REELLE, connue et fermee : l'imlaei detache la
# particule vocative يَا, que l'uthmani soude au mot suivant. C'est verifiable
# d'un coup d'oeil et ca ne peut pas deraper ailleurs.
#
# RESTE NON TRAITE, ASSUME : 2:181, ou l'imlaei SOUDE بَعْدَمَا quand l'uthmani
# separe بَعْدَ مَا. Corriger demanderait de COUPER un jeton de translittetation
# en deux, donc de decider ou — ce qui s'invente. Ce verset garde son rendu
# entier, exactement comme avant.

# ⚠ Les MARQUES DE PAUSE sont des « mots » dans l'uthmani mais n'ont aucun
# equivalent en translittetation. L'application les exclut deja de son compte
# (`estPause`, app.js) : les compter ici faisait croire a 209 versets
# desalignes au lieu de 26.
PAUSES = "ۖۗۘۙۚۛۜ۞۩"
# la particule vocative telle que l'imlaei l'ecrit, voyelles comprises
VOCATIF = re.compile(r"^يَ?ا$")

# ⚠⚠ DESACTIVE EN ATTENTE D'UNE DECISION D'ANIS (29/07). Le recalage MARCHE et
# porte l'alignement de 797 a 822 versets sur 823, mais il ecrit « ya-'ayyouha »
# la ou DIN/Arabica ecrirait « ya 'ayyouha » : le trait d'union marque ailleurs
# dans ce projet des PROCLITIQUES reellement soudes en arabe (bi-l-gayb), alors
# qu'ici c'est l'uthmani qui soude pour des raisons calligraphiques. Faire suivre
# la translittetation au decoupage calligraphique est un CHOIX, pas une norme,
# et il touche du contenu affiche : Yusuf le renvoie donc a Anis.
# Trois sorties possibles : garder le trait d'union comme convention interne (et
# la documenter dans le tutoriel de translittetation), employer un autre signe
# moins charge, ou renoncer et laisser ces versets au rendu entier.
# Passer a True regenere tout en une commande : python tools/build_data.py
RECALER_VOCATIF = False


def mots_reels(texte):
    return [m for m in texte.split() if m and not all(c in PAUSES for c in m)]


def recale(tl, uthmani, imlaei):
    """Soude a son voisin la particule vocative que l'imlaei detache.

    Renvoie (chaine recalee, True) si le compte tombe juste ensuite,
    (chaine d'origine, False) sinon : on ne publie JAMAIS un alignement dont on
    n'est pas sur, le rendu entier deja en place vaut mieux.
    """
    if not RECALER_VOCATIF:
        return tl, False
    jt, ji, ju = tl.split(), mots_reels(imlaei), mots_reels(uthmani)
    if len(jt) != len(ji):      # translittetation deja desynchronisee : on ne touche pas
        return tl, False
    if len(ji) == len(ju):
        return tl, True         # rien a faire
    manque = len(ji) - len(ju)
    vocatifs = [n for n, m in enumerate(ji) if VOCATIF.match(m) and n + 1 < len(ji)]
    if manque <= 0 or manque != len(vocatifs):
        return tl, False        # l'ecart ne s'explique pas par les vocatifs seuls
    sort, saute = [], set()
    for n, mot in enumerate(jt):
        if n in saute:
            continue
        if n in vocatifs:
            # trait d'union : la convention deja employee par translit.py
            # pour « plusieurs mots arabes, un seul jeton » (bi-l-gayb)
            sort.append(mot + "-" + jt[n + 1])
            saute.add(n + 1)
        else:
            sort.append(mot)
    return (" ".join(sort), True) if len(sort) == len(ju) else (tl, False)

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
    # ⚠ DEUX balisages acceptés : `<tajweed>` de l'API quran.com et `<rule>` de
    # la ressource 87 de QUL, qui porte la MÊME annotation à une granularité plus
    # fine (elle sépare le madd muttasil du munfasil). Le reste du traitement est
    # identique : l'alignement se fait de toute façon sur NOTRE texte uthmani.
    for part in re.split(r"(<(?:tajweed|rule) class=[\w]+>|</(?:tajweed|rule)>)", html):
        m = re.match(r"<(?:tajweed|rule) class=([\w]+)>", part)
        if m:
            cls = m.group(1)
        elif part in ("</tajweed>", "</rule>"):
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


def source_tajwid():
    """Le balisage tajwid a projeter, et d'ou il vient.

    Priorite a la ressource 87 de QUL (« QPC Hafs Tajweed ») quand elle est
    deposee : MEME annotation que celle de quran.com, mais plus fine, elle
    separe `madda_obligatory` en `_mottasel` et `_monfasel`, ce qui rend enfin
    le madd munfasil derivable et sort sa fiche des orphelines.
    Repli sur l'API quran.com sinon : le fichier QUL n'est pas telechargeable
    sans compte, la fabrication doit rester possible sans lui.
    """
    # ⚠ ESSAYÉ LE 28/07, PUIS ÉCARTÉ SUR MESURE. La ressource 87 de QUL sépare
    # bien le madd muttasil du munfasil, ce que quran.com fond, et c'était la
    # raison d'y passer. Mais elle est MOINS COMPLÈTE, et c'est le mushaf
    # officiel qui l'a dit : sur les annotations que quran.com porte et que QUL
    # ignore, les polices du KFGQPC colorient 96 % des madd naturel (108 sur
    # 113), 100 % des lâm solaires (15/15) et 100 % des qalqala (17/17). Passer
    # à QUL aurait donc effacé 125 madd naturel, 24 hamzat wasl, 17 qalqala et
    # 15 lâm solaires que l'édition officielle confirme.
    # Les deux sources sont également EXACTES (97 à 100 % d'accord avec la
    # police sur ce qu'elles marquent) ; elles diffèrent en COMPLÉTUDE.
    # Ce qu'il faudrait pour gagner la scission sans rien perdre : garder
    # quran.com comme base et n'emprunter à QUL que l'étiquette mottasel /
    # monfasel, en appariant les portées par POSITION et non par rang (les
    # comptes diffèrent : 463 contre 457). C'est un chantier à part.
    # `parse_tajweed` accepte les deux balisages, donc l'essai est rejouable en
    # rendant simplement le dictionnaire ci-dessous.
    return {}, "quran.com (API v4, champ text_uthmani_tajweed)"


def main():
    verses = json.load(open(os.path.join(CACHE, "verses.json"), encoding="utf-8"))
    qul, provenance = source_tajwid()
    print(f"annotation tajwid : {provenance}")
    os.makedirs(OUT, exist_ok=True)
    rubs = {}
    all_classes = {}
    perdues = []
    recales, non_recales = [], []
    for v in verses:
        s, a = v["key"].split(":")
        s, a = int(s), int(a)
        sci, fr = translit_verse(v["imlaei"])
        sci2, okS = recale(sci, v["uthmani"], v["imlaei"])
        fr2, okF = recale(fr, v["uthmani"], v["imlaei"])
        if okS and okF and (sci2 != sci or fr2 != fr):
            recales.append((v["key"], fr, fr2))
            sci, fr = sci2, fr2
        elif len(fr.split()) != len(mots_reels(v["uthmani"])):
            non_recales.append((v["key"], len(mots_reels(v["uthmani"])), len(fr.split())))
        brut = qul.get(v["key"], v["tajweed"])
        spans = project_spans(brut, v["uthmani"])
        for _, _, c in spans:
            all_classes[c] = all_classes.get(c, 0) + 1
        # CONTROLE DE PROJECTION : une classe presente dans le balisage source
        # doit se retrouver dans les portees. Si elle disparait, c'est que
        # l'alignement l'a perdue, et il vaut mieux le savoir que le publier.
        attendues = set(re.findall(r"<(?:tajweed|rule) class=(\w+)>", brut))
        if attendues - {c for _, _, c in spans}:
            perdues.append((v["key"], sorted(attendues - {c for _, _, c in spans})))
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
    if perdues:
        print(f"⚠ PROJECTION : {len(perdues)} versets perdent une classe, "
              f"dont {perdues[:6]}")
    else:
        print(f"projection : aucune classe perdue sur les {len(verses)} versets")
    # RECALAGE : on dit ce qui a bougé, verset par verset, parce que ça change
    # du texte AFFICHÉ et que ça doit pouvoir se relire.
    print(f"recalage translittération : {len(recales)} versets réalignés sur "
          f"le découpage uthmani")
    for k, avant, apres in recales:
        a, b = avant.split(), apres.split()
        diff = [x for x in b if "-" in x and x not in a]
        print(f"   {k:8} {len(a):3} -> {len(b):3} jetons   {' '.join(diff[:2])}")
    if non_recales:
        print(f"⚠ {len(non_recales)} versets restent désalignés (rendu entier "
              f"conservé, aucun risque) : {non_recales}")


if __name__ == "__main__":
    main()
