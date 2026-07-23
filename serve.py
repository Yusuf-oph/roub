# -*- coding: utf-8 -*-
"""Petit serveur local pour Roub' (projet quran-hifz).

Sert les fichiers statiques + une API de persistance du feedback :
  GET  /api/feedback  -> contenu de app/data/feedback.json
  POST /api/feedback  -> upsert {id, stars, text, ...} par id

Port par défaut 8768 (8765 = AnkiConnect, 8766 = ophtalmo, 8767 = CRR).
L'appli fonctionne aussi SANS serveur (double-clic sur app/index.html) :
le feedback est alors gardé en localStorage.
"""
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
FEEDBACK = os.path.join(ROOT, "app", "data", "feedback.json")


def load_json(path):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_json(path, data):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/feedback":
            return self._json(200, load_json(FEEDBACK))
        return super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] != "/api/feedback":
            return self._json(404, {"erreur": "inconnu"})
        try:
            n = int(self.headers.get("Content-Length", 0))
            entry = json.loads(self.rfile.read(n).decode("utf-8"))
            fid = str(entry.get("id", "")).strip()
            if not fid:
                return self._json(400, {"erreur": "id manquant"})
            data = load_json(FEEDBACK)
            entry["ts"] = entry.get("ts") or __import__("time").strftime("%Y-%m-%d %H:%M")
            data[fid] = entry
            save_json(FEEDBACK, data)
            return self._json(200, {"ok": True})
        except Exception as e:
            return self._json(500, {"erreur": str(e)})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8768))
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Roub' sur http://localhost:{port}/app/  (Ctrl+C pour arrêter)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
