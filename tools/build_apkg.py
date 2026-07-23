# -*- coding: utf-8 -*-
"""Génère les paquets Anki (.apkg) du site, un par rub.

Reprend EXACTEMENT la même dérivation de cartes que app.js :
  - enchaînement : paires de versets consécutifs (même sourate) du rub
  - vocabulaire  : entrées `vocab` de data/notes/<rub>.js
  - mutashabihat / sens : cartes rédigées de data/cartes/<rub>.js
Les fichiers de données JS sont relus via node (ce sont des littéraux JS,
pas du JSON strict). Les GUID sont stables (id de carte) : réimporter un
paquet régénéré met à jour les notes sans doublons.

Usage : python tools/build_apkg.py [j1r1 j1r2 ... | all]   (défaut : j1r1)
Sortie : apkg/<rub>.apkg (audio Husary embarqué + police du mushaf)
"""
import json
import os
import re
import subprocess
import sys

import genanki

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
APP = os.path.join(ROOT, "app")
OUT = os.path.join(ROOT, "apkg")

# genanki empaquette les médias sous leur nom de fichier ; Anki ne garde que
# les médias référencés par les notes SAUF ceux préfixés « _ » (référencés
# par le CSS seulement, comme notre police) -> copie sous ce nom exact
FONT_SRC = os.path.join(APP, "fonts", "UthmanicHafs.otf")
FONT = os.path.join(HERE, "cache", "_UthmanicHafs.otf")
if not os.path.exists(FONT):
    import shutil
    os.makedirs(os.path.dirname(FONT), exist_ok=True)
    shutil.copyfile(FONT_SRC, FONT)


def load_globals():
    """Évalue les fichiers de données JS avec node et renvoie le JSON."""
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const load = f => eval(fs.readFileSync(f, 'utf8'));
load(path.join(app, 'data', 'meta.js'));
for (const sub of ['quran', 'notes', 'cartes']) {
  const dir = path.join(app, 'data', sub);
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.js')) load(path.join(dir, f));
}
process.stdout.write(JSON.stringify({
  META: window.META, QURAN: window.QURAN || {},
  NOTES: window.NOTES || {}, CARTES: window.CARTES || {},
}));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def ar_display(s):
    """Même transformation d'affichage que app.js : soukoun à la médinoise
    (U+0652 -> U+06E1) puis rond muet U+06DF rendu via le glyphe attachable
    U+0652 (la police n'attache pas U+06DF)."""
    return s.replace("ْ", "ۡ").replace("۟", "ْ")


def fmt_html(txt):
    """Mini-markdown des notes -> HTML de carte."""
    h = (txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    h = re.sub(r"\[\[([^\]]+)\]\]",
               lambda m: '<span class="qar">' + ar_display(m.group(1)) + "</span>", h)
    h = re.sub(r"\{(\d+:\d+(?:-\d+)?)\}", r"\1", h)
    h = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", h)
    h = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", h)
    return h.replace("\n", "<br>")


CSS = """
.card { font-family: "Segoe UI", sans-serif; font-size: 17px; text-align: center;
  color: #222; background: #fdfcf7; }
@font-face { font-family: "UthmanicHafs"; src: url("_UthmanicHafs.otf"); }
.qar, .ar { font-family: "UthmanicHafs", serif; font-size: 30px; line-height: 2;
  direction: rtl; }
.tl { color: #157a5b; font-size: 16px; }
.sci { color: #888; font-size: 13px; }
.tr { color: #666; font-style: italic; font-size: 14px; }
.ref { color: #999; font-size: 12px; margin-top: 8px; }
hr { border: none; border-top: 1px dashed #bbb; }
"""

MODEL_CHAIN = genanki.Model(
    1720801001, "QuranHifz Enchainement",
    fields=[{"name": "Cle"}, {"name": "Recto"}, {"name": "Verso"}, {"name": "Ref"}],
    templates=[{
        "name": "Carte",
        "qfmt": "{{Recto}}",
        "afmt": "{{Recto}}<hr>{{Verso}}<div class=ref>{{Ref}}</div>",
    }], css=CSS)

MODEL_VOCAB = genanki.Model(
    1720801002, "QuranHifz Vocabulaire",
    fields=[{"name": "Cle"}, {"name": "Recto"}, {"name": "Verso"}, {"name": "Ref"}],
    templates=[{
        "name": "Carte",
        "qfmt": "{{Recto}}",
        "afmt": "{{Recto}}<hr>{{Verso}}<div class=ref>{{Ref}}</div>",
    }], css=CSS)

MODEL_TXT = genanki.Model(
    1720801003, "QuranHifz Texte",
    fields=[{"name": "Cle"}, {"name": "Recto"}, {"name": "Verso"}, {"name": "Ref"}],
    templates=[{
        "name": "Carte",
        "qfmt": "{{Recto}}",
        "afmt": "{{Recto}}<hr>{{Verso}}<div class=ref>{{Ref}}</div>",
    }], css=CSS)


def deck_id_for(rid):
    return 1720810000 + int(rid[1]) * 100 + int(rid[3])


def note(model, cid, recto, verso, ref):
    return genanki.Note(
        model=model, fields=[cid, recto, verso, ref],
        guid=genanki.guid_for(cid), sort_field=cid)


def verse_block(v, with_tr=False, audio=True):
    h = f'<div class="ar">{ar_display(v["ar"])}</div><div class="tl">{v["fr"]}</div>' \
        f'<div class="sci">{v["sci"]}</div>'
    if with_tr:
        h += f'<div class="tr">{v["tr"]}</div>'
    if audio:
        h += f'[sound:{v["audio"]}]'
    return h


def build_rub(data, rid):
    META, QURAN, NOTES, CARTES = (data["META"], data["QURAN"],
                                  data["NOTES"], data["CARTES"])
    R = QURAN[rid]
    meta = next((m for m in META["rubs"] if m["id"] == rid), {})
    nom = f'Roub\'::Juz {R["juz"]}::Roub' {R["rub"]} · {meta.get("titre", "")}'
    deck = genanki.Deck(deck_id_for(rid), nom)
    media = {FONT: "_UthmanicHafs.otf"}
    vidx = {v["k"]: v for r in QURAN.values() for v in r["verses"]}

    vv = R["verses"]
    for i in range(len(vv) - 1):
        a, b = vv[i], vv[i + 1]
        if a["s"] != b["s"]:
            continue
        recto = (f'<div>Verset {a["k"]} :</div>' + verse_block(a)
                 + "<div><b>Quel est le verset suivant ?</b></div>")
        verso = f'<div>Verset {b["k"]} :</div>' + verse_block(b, with_tr=True)
        deck.add_note(note(MODEL_CHAIN, "ch-" + a["k"], recto, verso,
                           f'{a["k"]} → {b["k"]}'))
        for v in (a, b):
            media[os.path.join(APP, "audio", v["audio"])] = v["audio"]

    for w in (NOTES.get(rid) or {}).get("vocab", []):
        recto = (f'<div class="qar">{ar_display(w["ar"])}</div>'
                 f'<div class="tl">{w["fr"]}</div><div class="sci">{w["sci"]}</div>')
        verso = f'<div><b>{w["sens"]}</b></div>'
        refs = ", ".join(w.get("refs", []))
        deck.add_note(note(MODEL_VOCAB, "vb-" + rid + "-" + w["ar"], recto, verso, refs))

    labels = {"mutash": "Mutashabihat", "sens": "Sens du passage"}
    for c in CARTES.get(rid, []):
        recto = (f'<div class="ref">{labels.get(c["type"], c["type"])}</div>'
                 + fmt_html(c["q"])
                 + (f'<div class="qar">{c["arQ"]}</div>' if c.get("arQ") else ""))
        verso = fmt_html(c["a"])
        deck.add_note(note(MODEL_TXT, c["id"], recto, verso,
                           ", ".join(c.get("refs", []))))

    os.makedirs(OUT, exist_ok=True)
    pkg = genanki.Package(deck)
    pkg.media_files = list(media.keys())
    # noms de médias : genanki utilise le basename ; audio déjà nommé SSSVVV.mp3
    dest = os.path.join(OUT, rid + ".apkg")
    pkg.write_to_file(dest)
    n = len(deck.notes)
    print(f"{rid}: {n} notes, {len(media)} médias, "
          f"{os.path.getsize(dest) / 1e6:.1f} Mo -> {dest}")


if __name__ == "__main__":
    args = sys.argv[1:] or ["j1r1"]
    data = load_globals()
    rids = sorted(data["QURAN"].keys()) if args == ["all"] else args
    for rid in rids:
        build_rub(data, rid)
