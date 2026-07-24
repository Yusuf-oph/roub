# Pipeline quran-hifz

Tout le contenu généré vient de sources vérifiables (quran.com v4,
alquran.cloud, everyayah/quranicaudio, QuranEnc.com pour le tafsir,
qul.tarteel.ai pour les segments) ; rien n'est écrit à la main. Le contenu éditorial (notes, cartes
mutashabihat/sens, meta) est rédigé puis contrôlé par `verifie.py`.

## Ajouter un juz (ex. juz 3)

```bash
# 1. versets + traduction + translittérations (efface le cache verses.json d'abord)
python tools/fetch_data.py 1 2 3
python tools/build_data.py

# 2. audio Husary du nouveau juz (adapter la liste des clés dans le one-liner
#    de téléchargement, ou réutiliser le script de la session du 2026-07-23)

# 3. pagination mushaf (effacer tools/cache/words_v1.json d'abord)
python tools/build_pages.py 1 2 3
#    + télécharger les polices QCF_P###.woff2 des nouvelles pages dans app/fonts/qcf/

# 4. déclarer les nouveaux roub' dans app/data/meta.js (+ étoiles, dispo),
#    créer les placeholders notes/cartes, ajouter dans app/index.html les
#    <script> de data/quran, data/notes, data/cartes ET data/tafsirfr

# 5. segments mot à mot des 4 styles de récitation (surlignage)
python tools/fetch_segments.py

# 6. tafsir français verset par verset (base QuranEnc déjà en cache)
python tools/build_tafsirfr.py

# 7. parcours de tajwid progressif (ordre : tools/curriculum.json)
python tools/build_tajcur.py

# 8. contrôle + paquets + export
python tools/verifie.py
python tools/build_apkg.py all          # un .apkg par roub', AVEC audio
python tools/build_apkg.py collection   # app/anki/roub-cartes.apkg, sans audio
python tools/build_export.py
```

## Les autres outils

| Script | À quoi il sert |
|---|---|
| `mirror_audio.py <style> [--tout]` | sauvegarde locale d'un style de récitation, hors dépôt (assurance si une source distante disparaît) |
| `segments_check.py` | vérifie que les segments mot à mot collent bien à NOS mp3 (dérive, couverture) |
| `fetch_tafsir_corpus.py` | constitue le corpus d'audit local (Ibn Kathîr, As-Sa'dî en arabe) |
| `tafsir_local.py <clé>` | consulte ce corpus hors ligne pendant un audit de contenu |
| `md2pdf.py <fichier.md>` | met un document de travail au propre en PDF A4 |
| `translit.py` | moteur de translittération (scientifique + hybride), utilisé par `build_data.py` |

## Règles de rédaction du contenu (rappels)

- JAMAIS de citation coranique tapée à la main : rédiger puis passer
  `fix_citations.py <roub'>` et relire son log (il remplace par la sous-chaîne
  exacte du texte uthmani), puis `verifie.py`.
- Renvois : `{2:15}` (verset) ou `{2:21-22}` (plage : le clic mène au
  premier verset). Arabe inline : `[[...]]`. Gras `**`, italique `*`.
- L'affichage transforme le soukoun U+0652 en U+06E1 (graphie de Médine) et
  peut masquer les ronds muets U+06DF : ne PAS modifier les données pour ça.
- Fichiers par rub : `app/data/notes/<roub'>.js` (difficultes/tajwid/vocab :
  la clé `tafsir` a disparu en v1.8.0, le tafsir vient d'al-Mukhtaṣar) et `app/data/cartes/<roub'>.js` (mutash/sens uniquement : les cartes
  d'enchaînement et de vocabulaire sont dérivées automatiquement).

## Publier une mise à jour (mainteneur)

1. Modifier le contenu ou le code (règles de rédaction ci-dessus).
2. `python tools/verifie.py` : doit être TOUT VERT.
3. Éditer les `notes` de `app/version.json`, puis
   `python tools/release.py <version>` (SemVer : MAJOR = rupture de format,
   MINOR = fonctionnalité ou lot de contenu, PATCH = correctif).
4. Commit + push sur `main` : le workflow `pages.yml` déploie `app/`.
