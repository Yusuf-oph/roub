"""Lit la table `name` et la liste des tables d'un TTF, sans dépendance.

Sert à répondre à deux questions avant d'intégrer quoi que ce soit : qui signe
la police et sous quelle licence (la page QUL n'en dit rien), et par quels
caractères on l'adresse (les noms de sourates passent par des ligatures ou des
codes réservés, pas par du texte arabe).
"""
import struct
import sys
from pathlib import Path

# les identifiants de la table `name` qui nous intéressent
NOMS = {0: "copyright", 1: "famille", 2: "style", 3: "identifiant", 4: "nom complet",
        5: "version", 7: "marque", 8: "fabricant", 9: "dessinateur",
        13: "licence", 14: "url licence"}


def lire(chemin):
    d = chemin.read_bytes()
    nb = struct.unpack(">H", d[4:6])[0]
    tables = {}
    for i in range(nb):
        o = 12 + i * 16
        tag = d[o:o + 4].decode("latin-1")
        deb, lg = struct.unpack(">II", d[o + 8:o + 16])
        tables[tag] = (deb, lg)

    res = {"fichier": chemin.name, "tables": sorted(tables), "noms": {}, "cmap": None}

    if "name" in tables:
        deb, _ = tables["name"]
        compte, offchaines = struct.unpack(">HH", d[deb + 2:deb + 6])
        for i in range(compte):
            o = deb + 6 + i * 12
            pid, eid, lid, nid, lg, off = struct.unpack(">HHHHHH", d[o:o + 12])
            if nid not in NOMS:
                continue
            brut = d[deb + offchaines + off: deb + offchaines + off + lg]
            try:
                txt = brut.decode("utf-16-be" if pid == 3 else "latin-1", "replace")
            except Exception:
                continue
            txt = txt.strip()
            if txt and NOMS[nid] not in res["noms"]:
                res["noms"][NOMS[nid]] = txt

    # cmap : combien de caractères, et lesquels — c'est ce qui dit comment on
    # adresse une sourate donnée
    if "cmap" in tables:
        deb, _ = tables["cmap"]
        n = struct.unpack(">H", d[deb + 2:deb + 4])[0]
        points = set()
        for i in range(n):
            o = deb + 4 + i * 8
            pid, eid, off = struct.unpack(">HHI", d[o:o + 8])
            sdeb = deb + off
            fmt = struct.unpack(">H", d[sdeb:sdeb + 2])[0]
            if fmt == 4:
                segx2 = struct.unpack(">H", d[sdeb + 6:sdeb + 8])[0]
                seg = segx2 // 2
                fins = struct.unpack(">%dH" % seg, d[sdeb + 14:sdeb + 14 + segx2])
                dbs = struct.unpack(">%dH" % seg, d[sdeb + 16 + segx2:sdeb + 16 + segx2 * 2])
                for a, b in zip(dbs, fins):
                    if b == 0xFFFF:
                        continue
                    points.update(range(a, min(b, a + 400) + 1))
            elif fmt == 12:
                ng = struct.unpack(">I", d[sdeb + 12:sdeb + 16])[0]
                for g in range(min(ng, 200)):
                    o2 = sdeb + 16 + g * 12
                    a, b, _ = struct.unpack(">III", d[o2:o2 + 12])
                    points.update(range(a, min(b, a + 400) + 1))
        pts = sorted(points)
        res["cmap"] = {
            "nb": len(pts),
            "min": hex(pts[0]) if pts else None,
            "max": hex(pts[-1]) if pts else None,
            "extrait": [hex(p) for p in pts[:14]],
        }
    return res


if __name__ == "__main__":
    for c in sorted(Path(sys.argv[1]).glob("*.ttf")):
        r = lire(c)
        print("=" * 68)
        print(r["fichier"])
        print("  tables :", " ".join(r["tables"]))
        for k, v in r["noms"].items():
            print(f"  {k:12} : {v[:150]}")
        if r["cmap"]:
            c2 = r["cmap"]
            print(f"  cmap         : {c2['nb']} points, de {c2['min']} à {c2['max']}")
            print(f"  premiers     : {' '.join(c2['extrait'])}")
