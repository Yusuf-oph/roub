# -*- coding: utf-8 -*-
"""Génère app/data/export/vocab.json : le vocabulaire coranique de tous les
rubs disponibles, destiné aux autres applis (apprentissage de l'arabe A1)
via fetch same-origin sur <compte>.github.io.

Format stable : {"genere": "AAAA-MM-JJ", "source": "quran-hifz",
                 "vocab": [{"ar", "sci", "fr", "sens", "refs", "rub"}]}
À relancer après chaque lot de contenu (avec build_apkg, verifie...).
"""
import json
import os
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app")
OUT_DIR = os.path.join(APP, "data", "export")


def load_notes():
    script = r"""
const fs = require('fs'), path = require('path');
global.window = {};
const app = process.argv[1];
const dir = path.join(app, 'data', 'notes');
for (const f of fs.readdirSync(dir)) if (f.endsWith('.js'))
  eval(fs.readFileSync(path.join(dir, f), 'utf8'));
process.stdout.write(JSON.stringify(window.NOTES || {}));
"""
    r = subprocess.run(["node", "-e", script, APP], capture_output=True)
    if r.returncode != 0:
        raise SystemExit("échec node : " + r.stderr.decode("utf-8", "replace"))
    return json.loads(r.stdout.decode("utf-8"))


def main():
    notes = load_notes()
    vocab = []
    for rid in sorted(notes):
        for w in notes[rid].get("vocab", []):
            vocab.append({
                "ar": w["ar"], "sci": w["sci"], "fr": w["fr"],
                "sens": w["sens"], "refs": w.get("refs", []), "rub": rid,
            })
    os.makedirs(OUT_DIR, exist_ok=True)
    out = {
        "genere": time.strftime("%Y-%m-%d"),
        "source": "quran-hifz",
        "vocab": vocab,
    }
    path = os.path.join(OUT_DIR, "vocab.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{len(vocab)} mots -> {path}")


if __name__ == "__main__":
    main()
