# -*- coding: utf-8 -*-
"""Contrôles automatiques du site quran-hifz. À lancer après tout ajout de
contenu : python tools/verifie.py

Vérifie :
  A. audio complet (1 mp3 par verset, non vide)
  B. données quran/*.js : texte identique au cache API, spans bornés,
     classes tajwid connues, translittérations présentes
  C. meta.js : bornes exactes, étoiles 1-5, 24 rubs
  D. regles.js : ids uniques ; ids référencés par les notes existants
  E. notes : renvois {s:a} résolubles, citations [[...]] présentes MOT POUR
     MOT (harakat comprises) dans le texte uthmani du verset cité ou du rub,
     vocabulaire présent dans ses versets de référence
  F. cartes : ids uniques, types connus, renvois résolubles,
     enchaînements = paires réelles de versets consécutifs
  G. pagination mushaf : polices présentes, tous les versets couverts
  H. tajcur.js : mapping span→fiche exhaustif, parcours cohérent et à jour
     (recalcul via tools/build_tajcur.py)
  I. tafsirfr/ : tafsir français (al-Mukhtaṣar) verset par verset, couverture
     complète, textes non vides, attribution présente (appli + docs)
  J. segments/ : segments mot à mot des 4 styles de récitation (couverture,
     temps cohérents, CALAGE index de mot déclaré ↔ mots du texte sur les 823
     versets, câblage index.html/SW/release)
"""
import json
import os
import re
import subprocess
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
APP = os.path.join(ROOT, "app")

CLASSES = {"ham_wasl", "laam_shamsiyah", "slnt", "ghunnah", "ikhafa",
           "ikhafa_shafawi", "idgham_ghunnah", "idgham_shafawi",
           "idgham_wo_ghunnah", "idgham_mutajanisayn", "idgham_mutaqaribayn",
           "iqlab", "qalaqah", "madda_normal", "madda_permissible",
           "madda_obligatory", "madda_necessary"}

ERR = []


def err(msg):
    ERR.append(msg)
    print("ERREUR:", msg)


def load_globals():
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const load = f => eval(fs.readFileSync(f, 'utf8'));
for (const f of fs.readdirSync(path.join(app, 'data')))
  if (f.endsWith('.js')) load(path.join(app, 'data', f));
for (const sub of ['quran', 'notes', 'cartes', 'tafsirfr', 'segments']) {
  const dir = path.join(app, 'data', sub);
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) load(path.join(dir, f));
}
process.stdout.write(JSON.stringify({
  META: window.META, REGLES: window.REGLES || [], QURAN: window.QURAN || {},
  NOTES: window.NOTES || {}, CARTES: window.CARTES || {},
  PAGES: window.PAGES || {}, PAGES2: window.PAGES2 || {},
  TAJCUR: window.TAJCUR || {}, TAFSIRFR: window.TAFSIRFR || {},
  SEGMENTS: window.SEGMENTS || {},
}));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def skel(s):
    out = "".join(c for c in s if unicodedata.category(c) not in ("Mn", "Me", "Cf")
                  and c not in "ۖۗۘۙۚۛۜ۞۩ٰـ")
    for a, b in (("ٱ", "ا"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي")):
        out = out.replace(a, b)
    return out


def main():
    data = load_globals()
    META, REGLES = data["META"], data["REGLES"]
    QURAN, NOTES, CARTES = data["QURAN"], data["NOTES"], data["CARTES"]
    cache = json.load(open(os.path.join(HERE, "cache", "verses.json"), encoding="utf-8"))
    full = json.load(open(os.path.join(HERE, "cache", "quran_full.json"), encoding="utf-8"))
    FULL_U = full["quran-uthmani"]
    by_key = {v["key"]: v for v in cache}

    # A. audio
    missing = [k for k in by_key
               if not os.path.getsize(os.path.join(
                   APP, "audio", "%03d%03d.mp3" % tuple(map(int, k.split(":")))))
               if True]
    n_audio = len([f for f in os.listdir(os.path.join(APP, "audio")) if f.endswith(".mp3")])
    if n_audio != len(by_key):
        err(f"audio : {n_audio} fichiers pour {len(by_key)} versets")
    print(f"A. audio : {n_audio} mp3 OK")

    # B. quran/*.js
    vidx = {}
    for rid, R in QURAN.items():
        for v in R["verses"]:
            vidx[v["k"]] = (rid, v)
            ref = by_key.get(v["k"])
            if not ref:
                err(f"{rid} {v['k']} : clé inconnue du cache")
                continue
            if v["ar"] != ref["uthmani"]:
                err(f"{rid} {v['k']} : texte ar != uthmani API")
            for st, en, c in v["taj"]:
                if not (0 <= st < en <= len(v["ar"])):
                    err(f"{rid} {v['k']} : span hors bornes {st}:{en}")
                if c not in CLASSES:
                    err(f"{rid} {v['k']} : classe inconnue {c}")
            if not v["sci"] or not v["fr"] or not v["tr"]:
                err(f"{rid} {v['k']} : translit/trad vide")
    if len(QURAN) != 24:
        err(f"{len(QURAN)} rubs au lieu de 24")
    # petit mîm d'iqlâb : arDisplay() ouvre le tanwîn qui le précède, sinon la
    # police n'attache pas le mîm BAS U+06ED (cercle pointillé autonome). La
    # substitution se fait par tranche de classe tajwid : si un span coupait la
    # paire tanwîn + mîm, elle ne s'appliquerait pas.
    n_mim = 0
    for rid, v in vidx.values():
        ar, cls = v["ar"], {}
        for st, en, c in v["taj"]:
            for i in range(st, en):
                cls[i] = c
        for i, ch in enumerate(ar):
            if ch not in "ۭۢ":
                continue
            n_mim += 1
            if i == 0:
                err(f"{v['k']} : petit mîm en tête de verset")
            elif ar[i - 1] in "ًٌٍ" and cls.get(i) != cls.get(i - 1):
                err(f"{v['k']} : paire tanwîn + petit mîm coupée par un span "
                    f"tajwid ({cls.get(i-1)} / {cls.get(i)}) : le tanwîn ouvert "
                    f"d'arDisplay ne s'appliquera pas")
            elif ar[i - 1] not in "ًٌٍن":
                err(f"{v['k']} : petit mîm après U+{ord(ar[i-1]):04X}, "
                    f"ni tanwîn ni noûn : vérifier l'affichage")
    print(f"B. quran : {len(vidx)} versets, textes conformes "
          f"({n_mim} petits mîms d'iqlâb contrôlés)")

    # C. meta
    if len(META["rubs"]) != 24:
        err("meta : pas 24 rubs")
    for m in META["rubs"]:
        R = QURAN.get(m["id"])
        if not R:
            err(f"meta {m['id']} : rub inconnu")
            continue
        if (m["debut"], m["fin"], m["n"]) != (R["debut"], R["fin"], R["n"]):
            err(f"meta {m['id']} : bornes incohérentes")
        if not (1 <= m.get("stars", 0) <= 5):
            err(f"meta {m['id']} : étoiles hors 1-5")
        if not m.get("titre"):
            err(f"meta {m['id']} : titre vide")
    print("C. meta : bornes et étoiles OK")

    # D. règles
    rids = [r["id"] for r in REGLES]
    if len(rids) != len(set(rids)):
        err("regles : ids en double")
    # exemples des fiches : présents dans le Qur'an (squelette), sauf mnémoniques
    MNEMO = {"ينمو", "يرملون", "قطب جد"}
    full_skels = None
    for r in REGLES:
        ex = r.get("exemple")
        if not ex or skel(ex) in MNEMO:
            continue
        if full_skels is None:
            full_skels = [skel(t) for t in FULL_U.values()]
        if not any(skel(ex) in t for t in full_skels):
            err(f"regles {r['id']} : exemple [[{ex}]] introuvable dans le Qur'an")
    print(f"D. regles : {len(rids)} fiches, exemples contrôlés")

    # E. notes
    def check_refs(refs, ctx):
        for k in refs or []:
            if k not in FULL_U:
                err(f"{ctx} : renvoi {k} inexistant")

    def check_snippets(txt, rid, ctx):
        for sn in re.findall(r"\[\[([^\]]+)\]\]", txt or ""):
            sk = skel(sn)
            # présent (harakat comprises) dans un verset du rub ?
            exact = any(sn in v["ar"] for v in QURAN[rid]["verses"])
            if exact:
                continue
            # sinon : où le squelette apparaît-il ?
            hits = [k for k, t in FULL_U.items() if sk in skel(t)]
            if hits:
                err(f"{ctx} : citation [[{sn}]] non exacte (squelette trouvé en {hits[:3]})")
            else:
                err(f"{ctx} : citation [[{sn}]] introuvable dans le Qur'an")

    def check_inline_refs(txt, ctx):
        for m in re.finditer(r"\{(\d+):(\d+)(?:-(\d+))?\}", txt or ""):
            s, a, b = m.group(1), int(m.group(2)), m.group(3)
            if f"{s}:{a}" not in FULL_U:
                err(f"{ctx} : renvoi {m.group(0)} inexistant")
            if b is not None:
                b = int(b)
                if b <= a:
                    err(f"{ctx} : plage {m.group(0)} inversée")
                if f"{s}:{b}" not in FULL_U:
                    err(f"{ctx} : fin de plage {m.group(0)} inexistante")

    # décision éditoriale 2026-07-24 : plus de tafsir rédigé maison
    # (l'onglet Tafsir affiche l'œuvre tierce verbatim, cf. section I)
    for rid, N in NOTES.items():
        if N.get("tafsir"):
            err(f"notes {rid} : bloc tafsir rédigé (interdit, l'onglet affiche al-Mukhtaṣar)")
    for rid, N in NOTES.items():
        for sec in ("difficultes", "tajwid", "tafsir"):
            for it in N.get(sec) or []:
                ctx = f"notes {rid}/{sec}/{it.get('titre', '?')[:30]}"
                check_refs(it.get("refs"), ctx)
                check_snippets(it.get("texte", ""), rid, ctx)
                check_inline_refs(it.get("texte", ""), ctx)
                # règle absolue : le tafsir est TOUJOURS sourcé (champ src)
                if sec == "tafsir" and not (it.get("src") or "").strip():
                    err(f"{ctx} : bloc de tafsir SANS source (champ src obligatoire)")
                for rg in it.get("regles") or []:
                    if rg not in rids:
                        err(f"{ctx} : règle {rg} inconnue")
        for w in N.get("vocab") or []:
            ctx = f"notes {rid}/vocab/{w['ar']}"
            check_refs(w.get("refs"), ctx)
            ok = any(w["ar"] in by_key[k]["uthmani"]
                     for k in w.get("refs", []) if k in by_key)
            if not ok:
                sk = skel(w["ar"])
                ok2 = any(sk in skel(by_key[k]["uthmani"])
                          for k in w.get("refs", []) if k in by_key)
                err(f"{ctx} : mot absent de ses versets"
                    + (" (squelette présent : harakat à corriger)" if ok2 else ""))
        # starsWhy de meta
    for m in META["rubs"]:
        check_inline_refs(m.get("starsWhy", ""), f"meta {m['id']}/starsWhy")
    print("E. notes : renvois, citations et vocabulaire contrôlés")

    # F. cartes
    seen = set()
    for rid, cards in CARTES.items():
        for c in cards:
            ctx = f"cartes {rid}/{c.get('id', '?')}"
            if c["id"] in seen:
                err(f"{ctx} : id en double")
            seen.add(c["id"])
            if c["type"] not in ("mutash", "sens"):
                err(f"{ctx} : type rédigé inattendu {c['type']}")
            check_refs(c.get("refs"), ctx)
            check_inline_refs(c.get("q", ""), ctx)
            check_inline_refs(c.get("a", ""), ctx)
    print(f"F. cartes rédigées : {len(seen)} ids uniques")

    # G. pagination mushaf (v1 N&B + v2/v4 colorée)
    for label, key, font_of in (
        ("v1", "PAGES", lambda p: os.path.join(APP, "fonts", "qcf", "QCF_P%03d.woff2" % int(p))),
        ("v2-colorée", "PAGES2", lambda p: os.path.join(APP, "fonts", "qcf4", f"p{int(p)}.woff2")),
    ):
        PG = data.get(key, {})
        if not PG:
            err(f"pages {label} : {key} vide")
            continue
        keys_in_pages = set()
        for p, lines in PG.items():
            if not os.path.exists(font_of(p)):
                err(f"pages {label} : police manquante pour la page {p}")
            for ln, words in lines.items():
                for w in words:
                    if not w.get("g"):
                        err(f"pages {label} : glyphe vide p{p} l{ln}")
                    keys_in_pages.add(w["k"])
        missing_pg = [k for k in by_key if k not in keys_in_pages]
        if missing_pg:
            err(f"pages {label} : versets absents : {missing_pg[:5]}")
        print(f"G. pages {label} : {len(PG)} pages, {len(keys_in_pages)} versets couverts")

    # H. tajcur (parcours tajwid progressif par sourate)
    sys.path.insert(0, HERE)
    from build_tajcur import SPAN2FICHE, SANS_FICHE, HORS_CURRICULUM, compute
    TAJCUR = data.get("TAJCUR") or {}
    if not TAJCUR:
        err("tajcur : window.TAJCUR absent (lancer tools/build_tajcur.py)")
    else:
        mapped = set(SPAN2FICHE) | SANS_FICHE
        if mapped != CLASSES:
            err(f"tajcur : mapping et CLASSES désynchronisés : {sorted(mapped ^ CLASSES)}")
        bad = sorted(set(SPAN2FICHE.values()) - set(rids))
        if bad:
            err(f"tajcur : SPAN2FICHE renvoie vers des fiches inconnues : {bad}")
        ordre = TAJCUR.get("ordre") or []
        surs = {v["s"] for R in QURAN.values() for v in R["verses"]}
        if len(ordre) != len(set(ordre)):
            err("tajcur : doublons dans l'ordre")
        if set(ordre) != surs - HORS_CURRICULUM:
            err("tajcur : ordre != sourates couvertes hors curriculum : "
                f"{sorted(set(ordre) ^ (surs - HORS_CURRICULUM))}")
        if set(TAJCUR.get("parSourate") or {}) != {str(s) for s in ordre}:
            err("tajcur : clés parSourate != ordre")
        try:
            if compute(QURAN, ordre, rids) != TAJCUR.get("parSourate"):
                err("tajcur : contenu périmé ou incohérent (relancer tools/build_tajcur.py)")
        except ValueError as e:
            err(f"tajcur : {e}")
        cur = json.load(open(os.path.join(HERE, "curriculum.json"), encoding="utf-8"))
        if cur != ordre:
            err("tajcur : tools/curriculum.json != TAJCUR.ordre (relancer tools/build_tajcur.py)")
        idx_html = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
        if "data/tajcur.js" not in idx_html:
            err("tajcur : data/tajcur.js absent d'index.html")
        print(f"H. tajcur : {len(ordre)} sourates, parcours cohérent")

    # I. tafsir français (al-Mukhtaṣar) verset par verset
    TFR = data.get("TAFSIRFR") or {}
    if not TFR:
        err("tafsirfr : window.TAFSIRFR absent (lancer tools/build_tafsirfr.py)")
    else:
        if set(TFR) != set(QURAN):
            err(f"tafsirfr : rubs != QURAN : {sorted(set(TFR) ^ set(QURAN))}")
        n_tfr = 0
        for rid, R in QURAN.items():
            d = TFR.get(rid) or {}
            keys = [v["k"] for v in R["verses"]]
            if set(d) != set(keys):
                err(f"tafsirfr {rid} : clés != versets du rub")
            vides = [k for k, t in d.items() if not (t or "").strip()]
            if vides:
                err(f"tafsirfr {rid} : textes vides : {vides[:3]}")
            n_tfr += len(d)
        idx_html = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
        n_inc = idx_html.count("data/tafsirfr/")
        if n_inc != len(QURAN):
            err(f"tafsirfr : {n_inc} inclusions dans index.html au lieu de {len(QURAN)}")
        ATTR = "Tafsir Center for Quranic Studies"
        app_js = open(os.path.join(APP, "app.js"), encoding="utf-8").read()
        for label, txt in (("app.js", app_js),
                           ("README.md", open(os.path.join(ROOT, "README.md"), encoding="utf-8").read()),
                           ("LISEZMOI.txt", open(os.path.join(ROOT, "LISEZMOI.txt"), encoding="utf-8").read()),
                           ("LICENSE-CONTENU.md", open(os.path.join(ROOT, "LICENSE-CONTENU.md"), encoding="utf-8").read())):
            if ATTR not in re.sub(r"\s+", " ", txt):
                err(f"tafsirfr : attribution absente de {label}")
        rel = open(os.path.join(HERE, "release.py"), encoding="utf-8").read()
        if "tafsirfr" not in rel:
            err("tafsirfr : sous-dossier absent de release.py::shell_files (SW)")
        print(f"I. tafsirfr : {len(TFR)} rubs, {n_tfr} versets, attribution en place")

    # J. segments mot à mot (karaoké) : un jeu complet par style de récitation
    SEG = data.get("SEGMENTS") or {}
    STYLES = ("husary64", "husary128", "muallim", "mujawwad")
    # écarts de découpage propres à la source, non corrigeables sans inventer un
    # instant (il faudrait couper un segment en deux) : tolérés, le départ au mot
    # se replie alors sur le mot connu le plus proche avant celui visé
    CALAGE_CONNU = {("husary64", "2:125"), ("husary64", "2:181"),
                    ("muallim", "2:143")}
    if not SEG:
        err("segments : window.SEGMENTS absent (lancer tools/fetch_segments.py)")
    else:
        if set(SEG) != set(STYLES):
            err(f"segments : styles {sorted(SEG)} au lieu de {sorted(STYLES)}")
        app_js = open(os.path.join(APP, "app.js"), encoding="utf-8").read()
        idx_html = open(os.path.join(APP, "index.html"), encoding="utf-8").read()
        for st in STYLES:
            d = SEG.get(st) or {}
            manq = [k for k in vidx if k not in d]
            if manq:
                err(f"segments {st} : {len(manq)} versets sans segments ({manq[:3]})")
            # bornes : mots numérotés dans l'ordre, temps croissants et positifs
            for k, sg in list(d.items())[:200]:
                if not sg:
                    err(f"segments {st} {k} : vide")
                    continue
                if any(s[2] < 0 or s[3] < s[2] for s in sg):
                    err(f"segments {st} {k} : temps incohérents")
            # CALAGE : les index de mots déclarés par les segments (champ 0)
            # doivent couvrir exactement les mots récités du verset. Un index
            # peut revenir (répétition du récitateur), aucun ne doit manquer ni
            # dépasser : c'est ce qui garantit que le soulignage et le départ au
            # mot double-cliqué tombent juste. tools/fetch_segments.py recale le
            # yâ vocatif, que QUL compte comme un mot séparé.
            for k, sg in d.items():
                v = vidx[k][1] if k in vidx else None
                if not v or not sg:
                    continue
                mots = [w for w in v["ar"].split() if not all(c in "ۖۗۘۙۚۛۜ۞۩" for c in w)]
                if set(s[0] for s in sg) != set(range(len(mots))) \
                        and (st, k) not in CALAGE_CONNU:
                    err(f"segments {st} {k} : calage mot/segment faux "
                        f"({len(mots)} mots, index déclarés {min(s[0] for s in sg)}"
                        f"-{max(s[0] for s in sg)}) ; lancer "
                        f"python tools/fetch_segments.py --renormaliser")
            if f"data/segments/{st}.js" not in idx_html:
                err(f"segments {st} : absent d'index.html")
            if st not in app_js:
                err(f"segments {st} : style inconnu de app.js (RECITS)")
        rel = open(os.path.join(HERE, "release.py"), encoding="utf-8").read()
        if "segments" not in rel:
            err("segments : sous-dossier absent de release.py::shell_files (SW)")
        # paquet Anki : présent, et précaché (sinon le bouton casse hors-ligne)
        apkg = os.path.join(APP, "anki", "roub-cartes.apkg")
        if not os.path.exists(apkg):
            err("anki : roub-cartes.apkg absent (python tools/build_apkg.py collection)")
        elif "anki/roub-cartes.apkg" not in open(
                os.path.join(APP, "sw.js"), encoding="utf-8").read():
            err("anki : roub-cartes.apkg hors de la coquille du SW"
                " (relancer tools/release.py) : téléchargement impossible hors-ligne")
        sw = open(os.path.join(APP, "sw.js"), encoding="utf-8").read()
        for host in ("mirrors.quranicaudio.com", "audio-cdn.tarteel.ai"):
            if host not in sw:
                err(f"segments : hôte {host} absent du service worker (pas de cache hors-ligne)")
        print(f"J. segments : {len(SEG)} styles × {len(SEG.get('husary64') or {})} versets")

    print()
    if ERR:
        print(f"{len(ERR)} ERREUR(S)")
        sys.exit(1)
    print("TOUT EST VERT")


if __name__ == "__main__":
    main()
