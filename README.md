# Roub' ۞ mémoriser le Qur'an roub' par roub'

**Application web : https://yusuf-oph.github.io/roub/**

Roub' (رُبْع, « le quart ») aide à mémoriser le Qur'an en suivant le
découpage traditionnel du mushaf : le roub'. Couverture actuelle : **juz 1
et 2** (Al-Fâtiḥa + Al-Baqara) et **juz 'Amma** (les sourates courtes,
idéales pour débuter), soit 24 roub' et 823 versets.

Pour **chaque** roub' : texte du mushaf de Médine colorié tajwid,
**pagination exacte du mushaf** (calligraphie officielle QCF, en noir et
blanc ou en édition colorée tajwid), translittération à double style
(hybride française / scientifique), traduction Hamidullah, audio Al-Husary
verset par verset dans **quatre styles au choix** avec **soulignage mot à
mot**, difficulté notée sur 5 étoiles, **tafsir verset par verset**
(al-Mukhtaṣar, traduction française), cartes d'enchaînement, progression
visible et auto-évaluation des lacunes.

Les **24 roub' sont tous accessibles** : texte, pages du mushaf, audio, tafsir
et cartes d'enchaînement partout. Le **contenu rédigé** (points durs de
mémorisation, particularités tajwid, vocabulaire, cartes mutashabihat et de
sens) existe pour le **roub' 1** ; les autres portent la mention « notes à
venir », qui disparaîtra roub' par roub' à mesure de leur rédaction.

**Le tajwid, règle par règle.** Chaque roub' a son onglet Tajwid : les règles
qu'il contient, dérivées du texte lui-même, chacune avec son explication et un
exemple pris dans ce roub'. L'exemple montre le passage exact où la règle se
produit, sa seule couleur allumée et tout le reste en encre neutre, avec la
translittération et la traduction. Une case « déjà vue » par règle, et trois
filtres pour ne voir que ce qui reste à travailler ; l'état suit d'un appareil à
l'autre. En mode Mémoriser, chaque sourate courte annonce en plus ses propres
règles et celles qui y apparaissent pour la première fois.

Également : **révision espacée** intégrée avec export des cartes pour Anki
(planificateur FSRS) et **synchronisation multi-appareils par code
anonyme**. PWA installable ; le texte, le tafsir et l'interface fonctionnent
hors-ligne dès la première visite.

**Apparence.** Trois habillages au choix (Vélin, Ardoise, Colophon), chacun
en clair et en sombre, avec sa police, que tu peux remplacer sans
changer d'habillage. À la première visite l'application suit le réglage clair
ou sombre de ton appareil ; la bascule en haut à droite tranche ensuite, et
ton choix est retenu. Les animations se règlent aussi (elles suivent par
défaut la préférence d'accessibilité du système). Tout est dans Paramètres.
La calligraphie du texte coranique, elle, ne change jamais.

## Qui sommes-nous

Roub' est né de l'idée originale d'**Anis** (co-fondateur, docteur en
mathématiques), conceptualisé et réalisé par **Yusuf** (co-fondateur, interne
en médecine, Discord **@ophtalmologie**), avec les ajustements pédagogiques
d'**Israa** (ostéopathe).

Tout le contenu religieux (tafsir, hadiths, règles de tajwid, texte) est
sourcé et vérifié contre ses sources ; une erreur reste toujours possible :
merci de la signaler. Le tafsir verset par verset est la « French
Translation of Al-Mukhtasar in Interpreting the Noble Quran » (Tafsir
Center for Quranic Studies, V1.0.0, via QuranEnc.com), reproduite sans
modification. **Avis, bugs, suggestions : dev.yusuf@pm.me** (ou
l'export d'avis intégré à l'application, dans Paramètres).

## Utiliser

- **En ligne (recommandé)** : ouvrir l'URL ci-dessus. « Ajouter à l'écran
  d'accueil » pour l'installer comme une application. Le texte, les notes,
  le tafsir et l'interface sont gardés hors-ligne dès la première visite ;
  l'audio et les pages du mushaf se préchargent **à la carte** dans
  Paramètres, chaque style de récitation séparément. Mises à jour
  automatiques (bannière en haut de page).
- **En local, sans serveur** : Code → Download ZIP sur cette page GitHub,
  dézipper, ouvrir `app/index.html` (ou `start.bat` sous Windows avec
  Python). Tout fonctionne, audio compris ; l'application signale
  lorsqu'une version plus récente est en ligne.

### L'accueil : les 24 roub' et leur difficulté

![Accueil : les roub' des juz 1, 2 et 'Amma](docs/img/accueil-clair.png)

### Mémoriser : tajwid colorié, translittération, traduction, audio

![Mémoriser un roub' : texte colorié tajwid + translittération + audio](docs/img/memoriser-clair.png)

### Les vraies pages du mushaf de Médine (édition colorée tajwid)

![Pages exactes du mushaf, calligraphie officielle colorée](docs/img/pages-mushaf-clair.png)

### Révision espacée intégrée

![Révision espacée, à la façon d'Anki](docs/img/revision-clair.png)

## Sources et licences

**Bibliographie détaillée : [SOURCES.md](SOURCES.md)** (éditions, versions,
provenance exacte, conditions d'usage) ; résumé ci-dessous. Dans l'application :
onglet **Sources**.

- **Code : AGPL-3.0** (fichier `LICENSE`) · **Contenu éditorial :
  CC BY-NC-SA 4.0** : détails (français et anglais) dans
  `LICENSE-CONTENU.md`.
- Texte coranique : mushaf de Médine, Complexe du Roi Fahd (KFGQPC), via
  l'API quran.com ; polices UthmanicHafs et QCF du KFGQPC.
- Traduction française : Muhammad Hamidullah.
- Récitation : Mahmoud Khalil Al-Husary, quatre styles au choix : murattal
  64 kbps fourni avec l'appli, murattal 128 kbps et muallim via
  everyayah.com (miroir quranicaudio.com), mujawwad via le CDN de Tarteel ;
  les styles non fournis avec l'appli
  se mettent en cache au fil de l'écoute. Usage non commercial.
- Soulignage mot à mot : segments de la Quranic Universal Library
  (qul.tarteel.ai), un jeu par style.
- Tafsir : « French Translation of Al-Mukhtasar in Interpreting the Noble
  Quran », Tafsir Center for Quranic Studies, V1.0.0, via QuranEnc.com,
  reproduit sans modification (conditions de QuranEnc.com).
- Cartes et tutoriels : sources citées au fil du texte (Ibn Kathîr, As-Sa'dî,
  Ibn al-Jazarî, et pour le tutoriel « Obligatoire ou perfectionnement ? »
  Mullâ 'Alî al-Qârî, al-Marṣafî, Makkî Naṣr et al-Ghazâlî) ; fiches de règles
  d'après les matns Tuhfat al-Atfal et al-Muqaddima al-Jazariyya, ainsi que les
  conventions de ḍabṭ du mushaf de Médine pour les lettres écrites et non
  prononcées.

Application gratuite et non commerciale, sans compte ni collecte de
données personnelles ; la synchronisation optionnelle repose sur un code
secret anonyme. © 2026 Anis & Yusuf.

Développement et maintenance : voir `tools/README.md`.
