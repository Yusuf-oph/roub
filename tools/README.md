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

# 3. pagination mushaf : SEULE l'édition colorée (QPC v4) est employée depuis le
#    29/07. Sa pagination est app/data/pages2.js, ses polices app/fonts/qcf4/.
#    L'édition N&B de 1405 H et son script build_pages.py sont dans
#    archive/mushaf-1405H/, avec la marche à suivre pour les remettre.
#    + télécharger les polices p###.woff2 des nouvelles pages dans app/fonts/qcf4/
#    + rejouer tools/build_polices_noms.py (glyphes des noms de sourates)

# 4. déclarer les nouveaux roub' dans app/data/meta.js (+ étoiles, dispo),
#    créer les placeholders notes/cartes, ajouter dans app/index.html les
#    <script> de data/quran, data/notes, data/cartes ET data/tafsirfr

# 5. segments mot à mot des 4 styles de récitation (soulignage)
python tools/fetch_segments.py                 # récupère tout, puis normalise
python tools/fetch_segments.py --renormaliser  # rejoue la normalisation seule,
#    sans réseau ni curl_cffi, sur les fichiers déjà générés. La normalisation
#    fusionne le yâ vocatif (يَـٰٓأَيُّهَا...), que les jeux distants comptent comme un
#    mot à part alors que le rasm l'écrit collé : sans elle, tout le reste du
#    verset est décalé d'un cran (soulignage en avance, double-clic un mot trop
#    tôt). À relancer si l'on touche à la règle de fusion.

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
| `md2pdf_ar.py <fichier.md>` | idem, mais pour un document qui CITE DE L'ARABE : passe par HTML + impression Edge, seul moyen d'obtenir des lettres liées et le sens de lecture correct (reportlab ne sait pas le faire) |
| `translit.py` | moteur de translittération (scientifique + hybride), utilisé par `build_data.py` |
| `build_khatt.py` | `app/data/khatt.js` : le texte composé pour Digital Khatt, découpé en mots CALÉ sur `arHtml` (sinon l'index de mot décale l'audio et le double-clic) |
| `build_pages2.py` | `app/data/pages2.js` : la pagination de l'édition colorée QPC v4, lignes prises dans la base de mise en page officielle de QUL |
| `build_polices_noms.py` | `app/data/noms-sourates.js` : les glyphes des noms de sourates (deux polices du KFGQPC, titre et bandeau orné). À rejouer à chaque juz ajouté |
| `build_icones.py` | les trois PNG d'icônes PWA, rastérisés depuis le SVG maître par Edge sans interface (rien à installer) |
| `inspecte_police.py` | dépouille une police (tables, glyphes, palettes) pendant une enquête |
| `tajwid_kfgqpc.py` | dépouillement COLR/CPAL des polices officielles et croisement avec nos portées |
| `tajwid_regles.py` | recalcule des règles depuis le texte, **pour CONTRÔLER une hypothèse, jamais pour publier** |

## Bibliothèques vendorisées (`app/vendor/`)

Rien à générer : `fsrs-browser` (le planificateur FSRS-6) est **recopié tel quel**
depuis jsDelivr, avec les deux textes de licence. Trois pièges, tous payés :

- ce sont **quatre fichiers**, pas deux : la glu ESM importe *statiquement*
  `snippets/wasm-bindgen-rayon-…/workerHelpers.js`, et sans lui le module ne se
  charge pas du tout ;
- `release.py::shell_files` parcourt ce dossier **récursivement**, contrairement au
  reste : un fichier oublié ferait marcher l'application en ligne et casserait le
  hors connexion, seulement ;
- `.gitattributes` exclut `app/vendor/**` de la normalisation des fins de ligne.
  Sans cette exclusion, le fichier commité ne correspond plus à l'original et
  toute vérification d'intégrité devient trompeuse. `verifie.py` (section L)
  compare les empreintes SHA-256 à celles publiées par jsDelivr.

## Règles de rédaction du contenu (rappels)

- JAMAIS de citation coranique tapée à la main : rédiger puis passer
  `fix_citations.py <roub'>` et relire son log (il remplace par la sous-chaîne
  exacte du texte uthmani), puis `verifie.py`.
- Renvois : `{2:15}` (verset) ou `{2:21-22}` (plage : le clic mène au
  premier verset). Arabe inline : `[[...]]`. Gras `**`, italique `*`.
- L'affichage applique DEUX graphies du mushaf sans jamais toucher aux données :
  le soukoun U+0652 rendu en U+06E1 (graphie de Médine), et l'iqlâb, où un
  tanwîn suivi d'un petit mîm devient voyelle simple + U+06E2 (le mîm remplace
  le second trait du tanwin). Il peut en plus masquer les ronds muets U+06DF.
  Ne PAS modifier les données pour ça : `arDisplay()` (app.js) et
  `ar_display()` (build_apkg.py) portent la même règle et `verifie.py`
  (section B) refuse une release si l'une des deux perd le marqueur.
- Fichiers par rub : `app/data/notes/<roub'>.js` (difficultes/tajwid/vocab :
  la clé `tafsir` a disparu en v1.8.0, le tafsir vient d'al-Mukhtaṣar) et `app/data/cartes/<roub'>.js` (mutash/sens uniquement : les cartes
  d'enchaînement et de vocabulaire sont dérivées automatiquement).

## Refaire les captures du README (mainteneur)

Les quatre images de `docs/img/` sont prises en **thème clair**, en **1280×1100**
et **sans barre de défilement**. Démarrer le serveur local et vérifier qu'il
répond (sinon on photographie la page d'erreur, et les quatre fichiers sortent
de taille identique : signal d'alerte), puis, pour chacune :

```bash
msedge --headless --disable-gpu --hide-scrollbars --window-size=1280,1100 \
  --user-data-dir=<profil NEUF> --virtual-time-budget=8000 \
  --screenshot=<chemin ABSOLU>.png \
  "http://localhost:8768/app/index.html?theme=light#<route>"
```

| Image | route |
|---|---|
| `accueil-clair.png` | `home` |
| `memoriser-clair.png` | `rub/j1r1/memoriser/versets` |
| `pages-mushaf-clair.png` | `rub/j1r1/memoriser/pagescouleur` |
| `revision-clair.png` | `revision` |

Pièges, tous rencontrés :

- **Un `--user-data-dir` neuf par capture.** Deux Edge lancés sur le même profil :
  le second ne fait rien, sans message, et l'ancienne image reste en place.
  Contrôler la date de chaque fichier après coup.
- `--headless` seul, **pas** `--headless=new`, qui échoue ici.
- Chemin de sortie **absolu** (un chemin relatif donne « Access is denied »).
- L'écriture est asynchrone : attendre la ligne « bytes written to file ».
- Profil neuf = bloc d'accueil déplié, comme sur les captures publiées.
- **Regarder les images avant de les livrer** : elles ne déclenchent aucun test,
  et une capture périmée vieillit sans bruit (barre de navigation d'une version
  passée, libellés renommés depuis, badges qui n'existent plus).

## Publier une mise à jour (mainteneur)

1. Modifier le contenu ou le code (règles de rédaction ci-dessus).
2. `python tools/verifie.py` : doit être TOUT VERT.
3. Éditer les `notes` de `app/version.json`, puis
   `python tools/release.py <version>` (SemVer : MAJOR = rupture de format,
   MINOR = fonctionnalité ou lot de contenu, PATCH = correctif).
4. Commit + push sur `main` : le workflow `pages.yml` déploie `app/`.
