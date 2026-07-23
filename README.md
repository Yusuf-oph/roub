# Roub' ۞ mémoriser le Qur'an rub par rub

Roub' (رُبْع, « le quart ») est une application web de mémorisation du
Qur'an, rub par rub (riwaya Hafs 'an 'Asim), couvrant pour l'instant les
juz 1-2 : texte du mushaf de Médine colorié tajwid, pagination exacte du
mushaf (calligraphie officielle QCF), translittération double (hybride
française / scientifique), traduction Hamidullah, audio Al-Husary verset
par verset, difficultés de mémorisation, tafsir sourcé (Ibn Kathîr,
As-Sa'dî), vocabulaire, révision espacée (+ paquets Anki), progression et
auto-évaluation des lacunes. PWA installable, fonctionne hors-ligne.

## Utiliser

- **En ligne** : ouvrir l'URL GitHub Pages du dépôt ; « Ajouter à l'écran
  d'accueil » pour l'installer. Paramètres → « Tout précharger » pour le
  hors-ligne complet.
- **En local** : `start.bat` (Windows, avec Python) ou ouvrir
  `app/index.html` directement.

## Mettre à jour (mainteneur)

1. Modifier le contenu (voir `tools/README.md` : pipeline, règles de
   rédaction, ajout d'un juz).
2. `python tools/verifie.py` (doit être TOUT VERT).
3. Éditer les `notes` de `app/version.json`, puis
   `python tools/release.py <nouvelle-version>` (SemVer : MAJOR = rupture de
   format, MINOR = fonctionnalité ou lot de contenu, PATCH = correctif).
4. Commit + push sur `main` : le workflow `pages.yml` déploie `app/`.

## Sources et licences

- Texte coranique : mushaf de Médine, Complexe du Roi Fahd (KFGQPC), via
  l'API quran.com ; polices UthmanicHafs et QCF du KFGQPC.
- Traduction française : Muhammad Hamidullah.
- Récitation : Mahmoud Khalil Al-Husary (everyayah.com), usage non
  commercial.
- Tafsir : synthèses rédigées, sourcées d'Ibn Kathîr (Tafsîr al-Qur'ân
  al-'Adhîm) et d'As-Sa'dî (Taysîr al-Karîm ar-Rahmân).

Application gratuite, sans compte ni collecte de données.
