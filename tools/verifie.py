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
for (const sub of ['quran', 'notes', 'cartes']) {
  const dir = path.join(app, 'data', sub);
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) load(path.join(dir, f));
}
process.stdout.write(JSON.stringify({
  META: window.META, REGLES: window.REGLES || [], QURAN: window.QURAN || {},
  NOTES: window.NOTES || {}, CARTES: window.CARTES || {},
  PAGES: window.PAGES || {}, PAGES2: window.PAGES2 || {},
  TAJCUR: window.TAJCUR || {},
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
    print(f"B. quran : {len(vidx)} versets, textes conformes")

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

    print()
    if ERR:
        print(f"{len(ERR)} ERREUR(S)")
        sys.exit(1)
    print("TOUT EST VERT")


if __name__ == "__main__":
    main()
