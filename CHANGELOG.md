# Changelog

## 1.13.3 · 2026-07-25
- Correctif Firefox et dérivés (LibreWolf) : les récitations distantes ne passent plus par le service worker tant qu'elles ne sont pas en cache, car ces navigateurs refusent de lire la réponse qui en résultait ; le préchargement et la lecture hors connexion restent inchangés

## 1.13.2 · 2026-07-25
- Si une récitation distante ne répond pas, la lecture continue automatiquement avec le murattal fourni avec l'appli (le verset suivant retente le style choisi)
- Le numéro de version reste affiché même quand la vérification des mises à jour échoue

## 1.13.1 · 2026-07-25
- Correctif : plus de fausse alerte « récitation indisponible » quand une lecture est simplement interrompue (changement de verset ou de réglage) ; le message ne s'affiche qu'en cas de vraie panne, et distingue hors connexion et source injoignable

## 1.13.0 · 2026-07-25
- Les 24 roub' sont désormais accessibles : texte, tafsir verset par verset, audio, pages du mushaf et cartes d'enchaînement partout ; les notes rédigées restent signalées « notes à venir » là où elles manquent

## 1.12.3 · 2026-07-25
- Synchronisation : l'état affiché dit la vérité du moment (hors connexion, échec, ou synchronisé à telle heure, avec le dernier envoi réussi en repère)
- Un envoi qui échoue est retenté tout seul (délai croissant), au retour du réseau et au retour sur l'onglet

## 1.12.2 · 2026-07-25
- Plus d'échec muet : une récitation indisponible hors connexion, ou des pages du mushaf dont les polices manquent, sont désormais signalées avec la marche à suivre
- Téléchargement des cartes Anki réparé pour la copie locale du dépôt (ouverte en file://), où le navigateur interdit la méthode utilisée en ligne

## 1.12.1 · 2026-07-25
- Le paquet de cartes Anki est gardé hors-ligne comme le reste de l'appli : son téléchargement fonctionne désormais sans connexion

## 1.12.0 · 2026-07-25
- Les 8 roub' du juz 'Amma s'ouvrent désormais : texte, tafsir, audio, pages du mushaf et cartes d'enchaînement y sont disponibles (les notes rédigées restent à venir)
- Nouvelle page Tutoriels → Sources : la bibliographie complète (éditions, versions, provenance, conditions d'usage), reprise dans SOURCES.md
- Tutoriels justifiés et aérés ; bulles du glossaire d'un seul tenant
- Poids de préchargement corrigés et textes remis en accord avec l'application (préchargement à la carte, paquets Anki, confidentialité et synchronisation)

## 1.11.1 · 2026-07-25
- Aide « Lequel choisir ? » fusionnée dans l'encadré du style de récitation
- Crédits condensés ; documents (README, LISEZMOI, à propos) remis en cohérence, y compris le retrait du tafsir rédigé remplacé par al-Mukhtaṣar
- Glossaire : « son dû » ne répète plus la phrase et l'izhâr y figure

## 1.11.0 · 2026-07-25
- Nouveau tutoriel « Styles de récitation » : d'où viennent taḥqîq, ḥadr et tadwîr (Ibn al-Jazarî), et lequel choisir pour mémoriser
- Termes techniques cliquables dans les tutoriels : une bulle donne la définition (fiche de règle ou définition sourcée), un second clic la referme
- Aide « Lequel choisir ? » directement sous le sélecteur de récitation, avec renvoi vers le tutoriel complet
- Bloc d'accueil : comment ça marche, qui écrit, quelles sources, repliable une fois lu

## 1.10.0 · 2026-07-24
- Cartes exportables pour Anki depuis l'onglet Révision : 804 cartes en 24 sous-paquets (1,4 Mo), avec la recommandation d'utiliser le planificateur FSRS d'Anki
- Surlignage mot à mot : simple soulignement, sans halo autour du mot

## 1.9.2 · 2026-07-24
- Préchargement à la carte : pages du mushaf et chaque style de récitation se téléchargent séparément (poids indiqué), au lieu d'un bloc unique
- Surlignage mot à mot : soulignement en surbrillance qui préserve les couleurs tajwid des lettres
- Nouvel outil tools/mirror_audio.py : sauvegarde locale d'un style de récitation, hors dépôt

## 1.9.1 · 2026-07-24
- Surlignage mot à mot : ce sont les lettres qui s'allument (plus de cadre), avec 70 ms d'avance et un rafraîchissement plus fin
- « Tout précharger » met désormais hors-ligne le style de récitation choisi (et non plus seulement celui fourni avec l'appli) ; libellés corrigés : seuls le texte, les notes et l'interface sont hors-ligne dès la première visite

## 1.9.0 · 2026-07-24
- Quatre styles de récitation Al-Husary au choix dans Paramètres : murattal 64 kbps (embarqué, hors-ligne), murattal 128 kbps, muallim (enseignement), mujawwad (mélodique) ; les styles non embarqués se mettent en cache au fil de l'écoute
- Surlignage mot à mot pendant la récitation, calé sur le style choisi (activable dans Paramètres)

## 1.8.0 · 2026-07-24
- Tafsir verset par verset pour LES 24 ROUB' : « French Translation of Al-Mukhtasar in Interpreting the Noble Quran » (Tafsir Center for Quranic Studies, V1.0.0, via QuranEnc.com), reproduit sans modification
- L'onglet Tafsir n'affiche plus de synthèse rédigée : place à l'œuvre de référence, attribuée et versionnée

## 1.7.0 · 2026-07-24
- Parcours de tajwid progressif (idée d'Israa) : sous chaque sourate courte (Fâtiḥa + juz 'Amma), un encart liste les règles de tajwid présentes et signale celles qui sont nouvelles dans le parcours (Fâtiḥa puis An-Nâs → An-Naba)
- Crédits : Israa (conseillère pédagogique) rejoint l'équipe ; ligne de Yusuf allégée

## 1.6.2 · 2026-07-24
- Roub' 1 : citations d'Ibn Kathîr re-vérifiées sur son tafsir arabe intégral ; attribution précisée pour les deux paraboles (la lecture en deux catégories est d'Ibn Kathîr, la description des hésitants d'Ibn 'Abbâs)

## 1.6.1 · 2026-07-24
- « À propos » de Paramètres aligné sur le README ; thème imposable par URL (?theme=light)

## 1.6.0 · 2026-07-24
- Liens profonds vers les modes d'affichage (partager une vue précise, ex. #rub/j1r1/memoriser/pagescouleur)
- Présentation du projet enrichie : captures d'écran, crédits à jour, licences bilingues

## 1.5.8 · 2026-07-23
- Mention ajoutée : contenu sourcé et vérifié, toute erreur peut être signalée via les avis

## 1.5.7 · 2026-07-23
- Mention ajoutée : contenu sourcé et vérifié, toute erreur peut être signalée via les avis

## 1.5.6 · 2026-07-23
- Audit sourcé étendu à tout le contenu : fiches tajwid vérifiées contre Tuhfat al-Atfal et la Jazariyya (et sourcées), exception d'idghâm dans un même mot ajoutée, formulation du triplet de la qibla précisée, vocabulaire confronté à la traduction

## 1.5.5 · 2026-07-23
- Références des hadiths précisées (Sahih Muslim 395, Tirmidhî 2954), vérifiées à la source

## 1.5.4 · 2026-07-23
- Audit des sources du roub' 1 : positions des mufassirin et hadiths vérifiés contre les textes ; corrections de fidélité (2:19-20, 2:25) et degré d'authenticité ajouté

## 1.5.3 · 2026-07-23
- Vocabulaire unifié : « roub' » partout dans l'interface et la documentation

## 1.5.2 · 2026-07-23
- Licences officialisées : code AGPL-3.0, contenu éditorial CC BY-NC-SA 4.0

## 1.5.1 · 2026-07-23
- Crédits ajustés

## 1.5.0 · 2026-07-23
- Crédits des co-fondateurs (Anis & Yusuf) et contact dans Paramètres
- Les copies locales signalent désormais quand une version plus récente est en ligne

## 1.4.0 · 2026-07-23
- Le juz 'Amma (30) rejoint l'application : les sourates courtes idéales pour débuter, découpées en 8 roub' comme le reste
- Affichage de la version corrigé dans Paramètres

## 1.3.0 · 2026-07-23
- Synchronisation multi-appareils disponible : crée ton code secret dans Paramètres pour retrouver ta progression partout

## 1.2.2 · 2026-07-23
- Adresse de retour des avis : dev.yusuf@pm.me

## 1.2.1 · 2026-07-23
- Affichage adapté aux smartphones (bandeau de navigation)

## 1.2.0 · 2026-07-23
- L'application s'appelle désormais Roub' ۞
- Protection renforcée de la progression locale (stockage persistant)
- Suggestion du code de synchronisation en fin de première session

## 1.1.1 · 2026-07-23
- Rond des lettres muettes désormais attaché à sa lettre (correctif typographique)
- Soukoun à la graphie du mushaf de Médine (petite tête de khâ') et option pour masquer les ronds des lettres muettes
- Pages du mushaf : mise en page exacte de Médine (calligraphie officielle)
- Progression visible (barres, versets acquis, série de jours) et auto-évaluation des lacunes
- Application installable (PWA) avec mode hors-ligne

## 1.1.0 · 2026-07-23
- Soukoun à la graphie du mushaf de Médine (petite tête de khâ') et option pour masquer les ronds des lettres muettes
- Pages du mushaf : mise en page exacte de Médine (calligraphie officielle)
- Progression visible (barres, versets acquis, série de jours) et auto-évaluation des lacunes
- Application installable (PWA) avec mode hors-ligne
- Renvois multi-versets cliquables (« 2:21-22 »), légende tajwid clarifiée

## 1.0.0 · 2026-07-23
- Pilote : moteur complet + roub' 1 (Al-Fâtiḥa + Al-Baqara 1-25), 3 modes
  d'affichage, révision espacée, paquets Anki, feedback exportable
