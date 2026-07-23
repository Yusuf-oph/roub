# -*- coding: utf-8 -*-
"""Translittération déterministe du texte imlaei vocalisé (Hafs).

Deux sorties par verset :
  - sci : scientifique stricte (DIN/Arabica : ṯ ǧ ḥ ḫ ḏ š ṣ ḍ ṭ ẓ ʿ ġ, ā ī ū, ʾ)
  - fr  : hybride française (th dj kh dh ch gh, ou/â/î/oû, ḥ ṣ ḍ ṭ ẓ q ʿ conservés)

Principes :
  - base = texte imlaei (orthographe standard entièrement vocalisée) ;
  - lecture en continu (wasl) à l'intérieur du verset, forme pausale sur le
    dernier mot (voyelles brèves finales chues, -an -> -ā, ta marbuta -> -ah) ;
  - hamzat wasl élidée après voyelle, article assimilé devant lettre solaire
    (aṣ-ṣalāt), y compris embarqué après préfixe (bi-l-ġayb, wa-l-laḏīna) ;
  - la shadda en tête de mot (marque d'idgham inter-mots) est ignorée :
    la translittération n'encode pas les assimilations de récitation
    (ikhfa, iqlab, idgham entre mots) : rôle de la coloration tajwid + audio ;
  - tout caractère imprévu lève une erreur : rien ne passe en silence.
"""
import re

# ------------------------------------------------------------------ alphabet
# placeholders ASCII 1 char -> rendus sci/fr en fin de chaîne
LETTERS = {
    "ء": "'", "ب": "b", "ت": "t", "ث": "F", "ج": "J", "ح": "H", "خ": "X",
    "د": "d", "ذ": "D", "ر": "r", "ز": "z", "س": "s", "ش": "C", "ص": "S",
    "ض": "Z", "ط": "T", "ظ": "V", "ع": "3", "غ": "G", "ف": "f", "ق": "q",
    "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y",
}
FATHA, DAMMA, KASRA, SUKUN, SHADDA = "َ", "ُ", "ِ", "ْ", "ّ"
FATHATAN, DAMMATAN, KASRATAN = "ً", "ٌ", "ٍ"
DAGGER = "ٰ"
ALEF, ALEF_MADDA, MAKSURA, TA_MARBUTA = "ا", "آ", "ى", "ة"
HAMZA_CARRIERS = {"أ", "إ", "ؤ", "ئ"}
PAUSE_MARKS = "ۖۗۘۙۚۛۜ۞۩"
COMBINING = FATHA + DAMMA + KASRA + SUKUN + SHADDA + FATHATAN + DAMMATAN + KASRATAN + DAGGER

SUN = set("tFdDrzsCSZTVln")
VOWELS = set("aiuAIU")
TANWIN_TOKENS = ("⟨AN⟩", "⟨UN⟩", "⟨IN⟩")
PREFIXES = set("وفبكل")   # lettres pouvant précéder un article/wasl embarqué

SPECIAL_WORDS = {"الم": "alif-lAm-mIm"}   # 2:1 (lettres détachées, madd rendu)

# squelettes où préfixe + alif + shadda est un VRAI â long, pas une hamzat
# wasl (classement vérifié contre le texte uthmani : ا/آ et non ٱ)
LONG_A_WORDS = {"كافة"}   # kāffatan (2:208)

# mots à waw orthographique muette (squelette imlaei -> placeholders)
ULA = {"اولئك": "'ulA'ika", "أولئك": "'ulA'ika", "اولاء": "'ulA'i",
       "أولاء": "'ulA'i", "اولوا": "'ulU", "أولوا": "'ulU", "اولو": "'ulU",
       "أولو": "'ulU", "اولي": "'ulI", "أولي": "'ulI",
       "اولات": "'ulAt", "أولات": "'ulAt"}

# noms propres (forme scientifique finale, minuscule) -> capitalisés en sortie
NAMES_SCI = ["allāh", "ādam", "iblīs", "mūsā", "ʿīsā", "ibrāhīm", "ismāʿīl",
             "isḥāq", "yaʿqūb", "isrāʾīl", "ǧibrīl", "mīkāl", "dāwūd",
             "ǧālūt", "ṭālūt", "hārūt", "mārūt", "maryam", "ṣafā", "marwat",
             "sulaymān", "bābil", "nūḥ", "firʿawn"]


def _segments(word):
    segs = []
    for ch in word:
        if ch in COMBINING:
            if not segs:
                raise ValueError(f"marque sans base: U+{ord(ch):04X} dans {word!r}")
            segs[-1][1] += ch
        elif ch in LETTERS or ch in HAMZA_CARRIERS or ch in (ALEF, ALEF_MADDA, MAKSURA, TA_MARBUTA):
            segs.append([ch, ""])
        else:
            raise ValueError(f"caractère imprévu: U+{ord(ch):04X} dans {word!r}")
    return segs


def _vowel_of(marks):
    if DAGGER in marks:
        return "A"
    if FATHA in marks:
        return "a"
    if DAMMA in marks:
        return "u"
    if KASRA in marks:
        return "i"
    return None


def _tanwin_of(marks):
    if FATHATAN in marks:
        return "⟨AN⟩"
    if DAMMATAN in marks:
        return "⟨UN⟩"
    if KASRATAN in marks:
        return "⟨IN⟩"
    return None


def _wasl_vowel(segs, start):
    """Voyelle du wasl d'un verbe/nom : 'u' si la 1re voyelle qui suit est u."""
    for base, marks in segs[start:]:
        v = _vowel_of(marks)
        if v == "u":
            return "u"
        if v in ("a", "i", "A"):
            return "i"
    return "i"


def _translit_word(word):
    """-> (placeholders+tokens, wasl_initial: bool)"""
    skel = _skeleton(word)
    if skel in SPECIAL_WORDS:
        return SPECIAL_WORDS[skel], False
    if skel in ULA:
        return ULA[skel], False
    if skel and skel[0] in "وف" and skel[1:] in ULA:
        pre = LETTERS[skel[0]] + "a"
        return pre + ULA[skel[1:]], False

    segs = _segments(word)
    segs[0][1] = segs[0][1].replace(SHADDA, "")   # shadda d'idgham inter-mots
    out = []
    seg_starts = []          # index dans out du début de chaque segment rendu
    wasl_initial = False
    i, n = 0, len(segs)

    def emit_article(idx, elided):
        """Rend l'article/wasl commençant au segment idx (l'alif). Retourne
        le nouvel index. elided = précédé d'une voyelle (pas de voyelle wasl)."""
        nonlocal i
        j = idx + 1
        lam = segs[j] if j < n else None
        if lam and lam[0] == "ل":
            lmarks = lam[1]
            if SHADDA in lmarks:                    # الَّذين -> al-la...
                if not elided:
                    out.append("a")
                out.append("l"); out.append("-"); out.append("l")
                lv = _vowel_of(lmarks)
                if lv:
                    out.append(lv if lv != "A" else "A")
                return j + 1
            if not _vowel_of(lmarks):               # lam nu ou sukun
                nxt = segs[j + 1] if j + 1 < n else None
                if nxt and SHADDA in nxt[1] and LETTERS.get(nxt[0], "?") in SUN:
                    if not elided:
                        out.append("a")
                    out.append(LETTERS[nxt[0]]); out.append("-")
                    nxt[1] = nxt[1].replace(SHADDA, "")
                    return j + 1
                if not elided:
                    out.append("a")
                out.append("l"); out.append("-")
                return j + 1
        # wasl de verbe/nom (اهدنا, اتقوا...)
        if not elided:
            out.append(_wasl_vowel(segs, idx + 1))
        return idx + 1

    # article embarqué sans alif : لِلْمُتَّقِين, لِلنَّاس
    if n >= 2 and segs[0][0] == "ل" and _vowel_of(segs[0][1]) == "i":
        second = segs[1]
        if second[0] == "ل" and not _vowel_of(second[1]) and SHADDA not in second[1]:
            third = segs[2] if n > 2 else None
            out.append("l"); out.append("i"); out.append("-")
            if third and SHADDA in third[1] and LETTERS.get(third[0], "?") in SUN:
                out.append(LETTERS[third[0]]); out.append("-")
                third[1] = third[1].replace(SHADDA, "")
            else:
                out.append("l"); out.append("-")
            i = 2

    while i < n:
        seg_starts.append(len(out))
        base, marks = segs[i]
        shadda = SHADDA in marks
        vowel = _vowel_of(marks)
        tanwin = _tanwin_of(marks)

        if base == ALEF_MADDA:
            out.append("'"); out.append("A")
            i += 1
            continue

        if base == ALEF:
            if i == 0:
                wasl_initial = True
                i = emit_article(0, elided=False)
                continue
            # article/wasl embarqué : tous les segments précédents sont des
            # préfixes à voyelle brève (وَ فَ بِ كَ لِ)
            all_prefix = all(s[0] in PREFIXES and _vowel_of(s[1]) in ("a", "i")
                             and SHADDA not in s[1] for s in segs[:i])
            if all_prefix and not vowel and not tanwin:
                j = i + 1
                lam = segs[j] if j < n else None
                is_article = lam and lam[0] == "ل" and (
                    SHADDA in lam[1] or not _vowel_of(lam[1]))
                # wasl de verbe/nom : lettre suivante à shadda (وَٱتَّبَعُوا)
                # ou sans voyelle (وَٱسْتَعِينُوا) ; exceptions à â long
                # réel + gémination (كَافَّةً) listées par squelette
                is_verb_wasl = (not is_article and lam
                                and (SHADDA in lam[1]
                                     or (not _vowel_of(lam[1])
                                         and not _tanwin_of(lam[1])))
                                and skel not in LONG_A_WORDS)
                if is_article or is_verb_wasl:
                    # trait d'union entre les préfixes accumulés
                    rebuilt = []
                    for k, st in enumerate(seg_starts[:-1]):
                        en = seg_starts[k + 1]
                        rebuilt.extend(out[st:en])
                        rebuilt.append("-")
                    del out[:]
                    out.extend(rebuilt)
                    if is_article:
                        i = emit_article(i, elided=True)
                    else:
                        i += 1   # alif muet, la suite (lettre à shadda) suit
                    continue
            # allongement ā ou alif muet
            if not vowel and not tanwin:
                if out and out[-1] and out[-1][-1] == "a":
                    out[-1] = out[-1][:-1] + "A"
                i += 1
                continue
            i += 1
            continue

        if base == MAKSURA:
            if tanwin:
                out.append(tanwin)                  # هدًى : le ى est muet
            elif out and out[-1] in TANWIN_TOKENS:
                pass
            elif out and out[-1] and out[-1][-1] == "a":
                out[-1] = out[-1][:-1] + "A"
            else:
                out.append("A")
            i += 1
            continue

        if base == TA_MARBUTA:
            out.append("⟨T⟩")
            if vowel:
                out.append(vowel)
            if tanwin:
                out.append(tanwin)
            i += 1
            continue

        if base in HAMZA_CARRIERS or base == "ء":
            out.append("'")
            if base == "إ" and not vowel:
                out.append("i")
            elif vowel:
                out.append(vowel)
            if tanwin:
                out.append(tanwin)
            i += 1
            continue

        L = LETTERS[base]
        if base == "و" and not marks:
            if out and out[-1] and out[-1][-1] == "u":
                out[-1] = out[-1][:-1] + "U"
                i += 1
                continue
            if out and out[-1] and (out[-1][-1] in "AI" or out[-1] in TANWIN_TOKENS):
                i += 1                              # waw muette
                continue
        if base == "ي" and not marks:
            if out and out[-1] and out[-1][-1] == "i":
                out[-1] = out[-1][:-1] + "I"
                i += 1
                continue
            if out and out[-1] and out[-1][-1] == "A":
                i += 1
                continue
        out.append(L)
        if shadda:
            out.append(L)
        if vowel:
            out.append(vowel)
        if tanwin:
            out.append(tanwin)
        i += 1

    return "".join(out), wasl_initial


def _skeleton(word):
    return "".join(c for c in word if c not in COMBINING)


def _fix_allah(word_ar, t):
    """اللَّه s'écrit sans alif de prolongation : forcer le ā long."""
    if "لله" not in _skeleton(word_ar):
        return t
    for pat, rep in (("al-lah", "allAh"), ("l-lah", "llAh"), ("llah", "llAh")):
        if pat in t:
            return t.replace(pat, rep, 1)
    return t


SCI_MAP = {"F": "ṯ", "J": "ǧ", "H": "ḥ", "X": "ḫ", "D": "ḏ", "C": "š",
           "S": "ṣ", "Z": "ḍ", "T": "ṭ", "V": "ẓ", "3": "ʿ", "G": "ġ",
           "A": "ā", "I": "ī", "U": "ū", "'": "ʾ"}
FR_DIGRAPH = {"F": "th", "J": "dj", "X": "kh", "D": "dh", "C": "ch", "G": "gh"}
FR_KEEP = {"H": "ḥ", "S": "ṣ", "Z": "ḍ", "T": "ṭ", "V": "ẓ", "3": "ʿ", "'": "'"}


def _capitalize_names(s, names):
    for name in names:
        first_letter = 1 if name[0] in "ʾʿ'" else 0

        def cap(m, fl=first_letter):
            w = m.group(2)
            pre = m.group(1)
            # préfixe soudé (wa/fa/bi/ka/li/la) : trait d'union inséré
            if pre and pre[-1] not in " -ʾ'" and not pre == "":
                pre = pre + "-"
            return pre + w[:fl] + w[fl].upper() + w[fl + 1:]
        # frontières : début, espace, trait d'union, hamza/apostrophe,
        # ou préfixe monolitère soudé en début de mot
        s = re.sub(r"(^|[ \-ʾ']|(?<![\wāīūâîôûʾʿ'\-])(?:wa|fa|bi|ka|li|la))("
                   + re.escape(name) + r")", cap, s)
    return s


def translit_verse(imlaei):
    """-> (sci, fr)"""
    text = "".join(c for c in imlaei if c not in PAUSE_MARKS)
    text = re.sub(r"\s+", " ", text).strip()
    toks = []
    for w in text.split(" "):
        t, wasl = _translit_word(w)
        t = _fix_allah(w, t)
        toks.append({"t": t, "wasl": wasl})

    # élision de la hamzat wasl entre mots
    parts = []
    for k, tok in enumerate(toks):
        t = tok["t"]
        if tok["wasl"] and k > 0:
            prev = parts[-1]
            if re.search(r"([aiuAIU]|⟨(AN|UN|IN)⟩)$", prev) and t and t[0] in "aiu":
                t = t[1:]
        parts.append(t)

    # forme pausale du dernier mot
    last = parts[-1]
    last = re.sub(r"⟨AN⟩$", "A", last)
    last = re.sub(r"⟨(UN|IN)⟩$", "", last)
    last = re.sub(r"⟨T⟩[aiu]?(⟨(AN|UN|IN)⟩)?$", "h", last)
    if re.search(r"[^aiuAIU\-⟩][aiu]$", last):
        last = last[:-1]
    parts[-1] = last

    def finalize(p):
        return (p.replace("⟨AN⟩", "an").replace("⟨UN⟩", "un")
                 .replace("⟨IN⟩", "in").replace("⟨T⟩", "t"))
    joined = " ".join(finalize(p) for p in parts)

    sci = "".join(SCI_MAP.get(c, c) for c in joined)
    sci = _capitalize_names(sci, NAMES_SCI)

    fr = joined
    fr = re.sub(r"t(?=h)", "t-", fr)
    fr = re.sub(r"d(?=[hj])", "d-", fr)
    fr = re.sub(r"k(?=h)", "k-", fr)
    fr = re.sub(r"s(?=h)", "s-", fr)
    fr = re.sub(r"g(?=h)", "g-", fr)
    buf = []
    for c in fr:
        if c in FR_DIGRAPH:
            buf.append(FR_DIGRAPH[c])
        elif c == "U":
            buf.append("oû")
        elif c == "u":
            buf.append("ou")
        elif c == "A":
            buf.append("â")
        elif c == "I":
            buf.append("î")
        elif c in FR_KEEP:
            buf.append(FR_KEEP[c])
        else:
            buf.append(c)
    fr = "".join(buf)
    names_fr = []
    for nm in NAMES_SCI:
        x = nm
        for k, v in {"ṯ": "th", "ǧ": "dj", "ḫ": "kh", "ḏ": "dh", "š": "ch",
                     "ġ": "gh", "ā": "â", "ī": "î", "ū": "oû", "ʾ": "'"}.items():
            x = x.replace(k, v)
        x = re.sub(r"(?<![oô])u", "ou", x)
        names_fr.append(x)
    fr = _capitalize_names(fr, names_fr)
    return sci, fr


if __name__ == "__main__":
    import json, os, sys
    here = os.path.dirname(os.path.abspath(__file__))
    verses = json.load(open(os.path.join(here, "cache", "verses.json"), encoding="utf-8"))
    sel = sys.argv[1:] or ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7",
                           "2:1", "2:2", "2:3", "2:4", "2:5"]
    for v in verses:
        if v["key"] in sel:
            sci, fr = translit_verse(v["imlaei"])
            print(v["key"])
            print("  sci:", sci)
            print("  fr :", fr)
