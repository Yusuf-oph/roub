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

Les **24 roub' sont tous accessibles** : texte, page imprimée du mushaf, audio, tafsir
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

**Révision espacée par FSRS-6.** Les cartes reviennent au moment où l'on est sur
le point de les oublier, et non à intervalle fixe : la planification est confiée
à l'algorithme qu'emploie Anki, dans son implémentation de référence, exécuté sur
l'appareil. Deux boutons de notation par défaut (venu / pas venu), quatre au
choix, un réglage de « souvenir visé » et un bouton qui ajuste le modèle sur
l'historique de celui qui révise. Les cartes s'exportent aussi **pour Anki** si
l'on préfère réviser là-bas.

**Suivre son avancement.** L'accueil regroupe les roub' **par juz**, chacun nommé
par ses premiers mots. L'onglet **Statistiques** donne la série de jours, les
cartes acquises, les versets jugés solides, la régularité sur trente jours, ce
qui a bougé, l'écoute et l'état du paquet. Paramètres permet de **remettre à zéro
une partie de sa progression** (cartes, auto-évaluations, tajwid, historique)
sans toucher au reste.

Également : **synchronisation multi-appareils par code anonyme**. PWA
installable ; le texte, le tafsir et l'interface fonctionnent hors-ligne dès la
première visite.

**Apparence.** Trois habillages au choix (Vélin, Ardoise, Colophon), chacun
en clair et en sombre, avec sa police, que tu peux remplacer sans
changer d'habillage. À la première visite l'application suit le réglage clair
ou sombre de ton appareil ; la bascule en haut à droite tranche ensuite, et
ton choix est retenu. Les animations se règlent aussi (elles suivent par
défaut la préférence d'accessibilité du système). Tout est dans Paramètres.
**La calligraphie du texte coranique se choisit** : **UthmanicHafs**, la police de
lecture du KFGQPC ; **Digital Khatt**, qui reprend le trait du mushaf imprimé tout
en restant du vrai texte ; ou les **dessins de l'édition officielle du KFGQPC**, un
par mot. Les **couleurs du tajwid** s'affichent avec UthmanicHafs, où
l'application les pose elle-même, et avec les dessins officiels, où elles sont dans
la police ; Digital Khatt ne les porte pas. Ce choix vaut pour
le verset par verset et le texte continu ; la page imprimée, dont toute la raison
d'être est de reproduire le mushaf, n'offre que la calligraphie officielle.

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
  l'audio et la calligraphie du mushaf se préchargent **à la carte** dans
  Paramètres, chaque style de récitation séparément. Mises à jour
  automatiques (bannière en haut de page).
- **En local** : Code → Download ZIP sur cette page GitHub, dézipper, puis
  lancer `start.bat` (Windows) ou `python serve.py`. Tout fonctionne, audio
  compris ; l'application signale lorsqu'une version plus récente est en
  ligne. Ouvrir `app/index.html` directement, sans serveur, reste possible
  pour lire et écouter, mais **la révision espacée n'y fonctionne pas** : son
  planificateur est un module que le navigateur refuse de charger depuis un
  simple fichier, la même restriction qui y empêche déjà la synchronisation.

### L'accueil : les roub' par juz, avec leur difficulté

![Accueil : les roub' regroupés par juz, chaque juz nommé par ses premiers mots](docs/img/accueil-clair.png)

### Mémoriser : présentation et calligraphie au choix, tajwid, audio

![Mémoriser un roub' : texte colorié tajwid + translittération + audio](docs/img/memoriser-clair.png)

### La page imprimée du mushaf de Médine, telle quelle

![La page imprimée du mushaf, calligraphie officielle colorée](docs/img/pages-mushaf-clair.png)

### Révision espacée, planifiée par FSRS-6

![Révision espacée : choix des roub' et des types de cartes, session à démarrer](docs/img/revision-clair.png)

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
- Planification des révisions : **FSRS-6** par la bibliothèque `fsrs-browser`
  (Open Spaced Repetition, BSD-3-Clause, © 2023 Alex Nguyen), qui embarque un
  fragment de `wasm-bindgen-rayon` (© Google, Apache-2.0) ; les deux textes de
  licence accompagnent les fichiers dans `app/vendor/`. Les avertissements des
  réglages reprennent la documentation d'Anki, attribuée et non traduite.
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
