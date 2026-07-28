# -*- coding: utf-8 -*-
r"""Calcule, depuis le texte uthmani lui-même, les règles de tajwid de la
riwâya **Hafs 'an 'Âsim** telles qu'elles sont codifiées, puis les expose sous
une forme comparable aux couches de couleur des polices officielles.

RAISON D'ÊTRE : on ne devine pas ce qu'une couleur veut dire en cherchant avec
quoi elle corrèle. Les règles sont connues et fixées ; le seul inconnu est
l'encodage retenu par le KFGQPC. On calcule donc chaque règle par SA PROPRE
DÉFINITION, et on teste si un index de palette tombe dessus. Une hypothèse qui
ne coïncide pas est rejetée, jamais renommée d'après ce qui corrèle le mieux.

Sources des définitions (déjà citées dans SOURCES.md §7) :
- **al-Jamzûrî**, *Tuhfat al-Atfâl wa-l-ghilmân fî tajwîd al-Qur'ân* : les
  quatre règles du noûn sâkina et du tanwîn (v. 6), les trois de la mîm sâkina
  (v. 19), les trois du madd (v. 42), les quatre du madd lâzim (v. 48).
- **Ibn al-Jazarî** (m. 833 H), *al-Muqaddima al-Jazariyya* : qalqala, lâm du
  nom d'Allâh, râ'.
Les groupes de lettres sont ceux des matns, y compris leurs mnémoniques :
يرملون (idghâm), ينمو (avec ghunna), قطب جد (qalqala), خص ضغط قظ (isti'lâ').

⚠ Ce module ne PUBLIE rien et n'écrit rien dans l'appli : il sert au
dépouillement de `tools/tajwid_kfgqpc.py`.

⚠⚠ SON DÉTECTEUR DE MADD EST FAUX, ne pas s'y fier tel quel : il trouve 80 madd
munfasil au lieu de ~420 et 1 madd lâzim au lieu de 13. Les autres règles sont
saines, et vérifiées contre le corpus (iqlâb 66, idghâm shafawi 62, ikhfâ'
shafawi 39, identiques aux comptes de quran.com). La bonne piste pour le
réparer, trouvée mais non exploitée : **U+0653, le signe de madd, est présent
dans 100 % des mots des index 3 et 9** de la palette officielle. C'est la
convention de ḍabṭ du mushaf qui marque le madd far'î, et non une règle à
recalculer.
"""
import re

# ------------------------------------------------------------------ alphabet
CONSONNES = set("ءأإآؤئبتثجحخدذرزسشصضطظعغفقكلمنهوىيةٱ")

FATHA, DAMMA, KASRA = "َ", "ُ", "ِ"
FATHATAN, DAMMATAN, KASRATAN = "ً", "ٌ", "ٍ"
SHADDA, SUKUN = "ّ", "ْ"
SUKUN_MEDINE = "ۡ"          # tête de khâ' : graphie du mushaf de Médine
ROND_VIDE = "۟"             # lettre jamais prononcée
ROND_OVALE = "۠"            # lettre qui tombe en enchaînant seulement
ALIF_SUSCRIT = "ٰ"
PETIT_WAW, PETIT_YA = "ۥ", "ۦ"
MIM_IQLAB_HAUT, MIM_IQLAB_BAS = "ۢ", "ۭ"

TANWINS = FATHATAN + DAMMATAN + KASRATAN
VOYELLES = FATHA + DAMMA + KASRA
MARQUES = set(VOYELLES + TANWINS + SHADDA + SUKUN + SUKUN_MEDINE + ROND_VIDE
              + ROND_OVALE + ALIF_SUSCRIT + PETIT_WAW + PETIT_YA
              + MIM_IQLAB_HAUT + MIM_IQLAB_BAS + "ٕٓٔۜ"
              + "ۖۗۘۙۚۛ۝۞۩")

PAUSES = "ۖۗۘۙۚۛۜ۞۩"

# --------------------------------------------------------- groupes des matns
HALQ = set("ءأإآهعحغخ")                 # izhâr halqi (gorge)
YARMALOUN = set("يرملون")                # idghâm : ي ر م ل و ن
YANMOU = set("ينمو")                     # idghâm AVEC ghunna
SANS_GHUNNA = set("لر")                  # idghâm SANS ghunna
QALQALA = set("قطبجد")                   # قطب جد
ISTIALA = set("خصضغطقظ")                 # خص ضغط قظ : lettres d'élévation
SOLAIRES = set("تثدذرزسشصضطظلن")         # lâm shamsiyya
# Ikhfâ' = les 15 restantes, définies par soustraction et non listées à la main
IKHFA = set("بتثجحخدذرزسشصضطظعغفقكلمنهوي") - HALQ - YARMALOUN - {"ب"}


def tokens(ar):
    """Découpe le texte en [(lettre, marques, index de mot, position)].

    Les mots faits uniquement de marques de pause ne comptent pas comme mots :
    c'est la règle d'indexation de `arHtml`, il faut la suivre exactement."""
    out, wi = [], -1
    for m in re.finditer(r"\S+", ar):
        mot = m.group(0)
        if all(c in PAUSES for c in mot):
            continue
        wi += 1
        i = 0
        while i < len(mot):
            c = mot[i]
            if c not in CONSONNES:
                i += 1
                continue
            j = i + 1
            marques = ""
            while j < len(mot) and mot[j] not in CONSONNES:
                marques += mot[j]
                j += 1
            out.append((c, marques, wi, m.start() + i))
            i = j
    return out


def est_sakin(marques):
    """Lettre sans voyelle : soukoun écrit, ou aucune marque vocalique."""
    if any(v in marques for v in VOYELLES + TANWINS):
        return False
    if SHADDA in marques:
        return False
    return True


def est_muet(marques):
    """Lettre que le ḍabṭ du mushaf déclare non prononcée (rond vide ou ovale).
    Conventions de la 2e commission scientifique du mushaf de Médine, citées par
    Musāʿid aṭ-Ṭayyār, *al-Muḥarrar fī ʿulūm al-Qurʾān*, p. 292-294."""
    return ROND_VIDE in marques or ROND_OVALE in marques


# --------------------------------------------------------------- les règles
def regles_du_verset(ar):
    """{nom de règle: Counter(index de mot -> occurrences)} pour un verset.

    Chaque règle est calculée par sa définition, jamais par ressemblance. Une
    occurrence est rattachée au mot où la règle SE DÉCLENCHE (la lettre
    concernée), ce qui est la convention du coloriage : c'est la lettre qui
    change de son qui change de couleur.
    """
    from collections import Counter
    T = tokens(ar)
    R = {}

    def add(nom, wi):
        R.setdefault(nom, Counter())[wi] += 1

    for i, (c, mq, wi, _pos) in enumerate(T):
        suiv = T[i + 1] if i + 1 < len(T) else None

        # ---- noûn sâkina et tanwîn : les quatre règles (Tuhfa v. 6) --------
        porte_tanwin = any(t in mq for t in TANWINS)
        noun_sakin = (c == "ن" and est_sakin(mq) and not est_muet(mq))
        if (porte_tanwin or noun_sakin) and suiv:
            s = suiv[0]
            if s in HALQ:
                add("izhar", wi)
            elif s == "ب":
                add("iqlab", wi)
            elif s in YANMOU:
                add("idgham_ghunna", wi)
            elif s in SANS_GHUNNA:
                add("idgham_sans_ghunna", wi)
            elif s in IKHFA:
                add("ikhfa", wi)

        # ---- mîm sâkina : les trois règles (Tuhfa v. 19) ------------------
        if c == "م" and est_sakin(mq) and not est_muet(mq) and suiv:
            s = suiv[0]
            if s == "ب":
                add("ikhfa_shafawi", wi)
            elif s == "م":
                add("idgham_shafawi", wi)
            else:
                add("izhar_shafawi", wi)

        # ---- ghunna mushaddada : نّ et مّ (2 temps) -----------------------
        if c in "نم" and SHADDA in mq:
            add("ghunna_mushaddada", wi)

        # ---- qalqala : قطب جد porteuse d'un soukoun (Jazariyya) -----------
        if c in QALQALA and est_sakin(mq) and not est_muet(mq):
            add("qalqala", wi)

        # ---- isti'lâ' : خص ضغط قظ (tafkhîm systématique) ------------------
        if c in ISTIALA:
            add("istiala", wi)

        # ---- râ' (tafkhîm / tarqîq : Jazariyya) ---------------------------
        if c == "ر":
            add("ra", wi)

        # ---- lâm shamsiyya : ل de l'article assimilé ----------------------
        if c == "ل" and est_sakin(mq) and i and T[i - 1][0] == "ٱ" and suiv \
                and suiv[0] in SOLAIRES and SHADDA in suiv[1]:
            add("lam_shamsiyya", wi)

        # ---- hamzat wasl ---------------------------------------------------
        if c == "ٱ":
            add("hamzat_wasl", wi)

        # ---- lettre du ḍabṭ déclarée non prononcée -------------------------
        if est_muet(mq):
            add("lettre_muette", wi)

    return R


def marques_de_pause(ar):
    """Counter(index de mot -> nb de signes de waqf qui SUIVENT ce mot).

    Le signe de pause n'est pas un mot : dans le mushaf il se pose après le mot
    qu'il termine, et c'est à ce mot qu'il est rattaché ici."""
    from collections import Counter
    out, wi = Counter(), -1
    for m in re.finditer(r"\S+", ar):
        mot = m.group(0)
        if all(c in PAUSES for c in mot):
            if wi >= 0:
                out[wi] += len(mot)
            continue
        wi += 1
        n = sum(1 for c in mot if c in PAUSES)
        if n:
            out[wi] += n
    return out


NOMS = {
    "izhar": "Izhâr halqi (noûn/tanwîn + gorge)",
    "iqlab": "Iqlâb (noûn/tanwîn + ب)",
    "idgham_ghunna": "Idghâm bi-ghunna (ينمو)",
    "idgham_sans_ghunna": "Idghâm bilâ ghunna (ل ر)",
    "ikhfa": "Ikhfâ' haqîqî (15 lettres)",
    "ikhfa_shafawi": "Ikhfâ' shafawi (mîm + ب)",
    "idgham_shafawi": "Idghâm shafawi (mîm + مـ)",
    "izhar_shafawi": "Izhâr shafawi (mîm + reste)",
    "ghunna_mushaddada": "Ghunna mushaddada (نّ مّ)",
    "qalqala": "Qalqala (قطب جد sâkin)",
    "istiala": "Isti'lâ' / tafkhîm (خص ضغط قظ)",
    "ra": "Râ'",
    "lam_shamsiyya": "Lâm shamsiyya",
    "hamzat_wasl": "Hamzat wasl (ٱ)",
    "lettre_muette": "Lettre non prononcée (ḍabṭ)",
    "_pause": "Signe de waqf",
}
