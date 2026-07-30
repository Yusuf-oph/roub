# Changelog

## 2.0.2 · 2026-07-30
- Correction d'un défaut de la 2.0.1 : une note de développement s'affichait dans la barre d'options de l'onglet Mémoriser, entre les réglages d'affichage et les boutons « Masquer ». Elle n'avait rien à faire là et a disparu

## 2.0.1 · 2026-07-30
- La ligne de Paramètres s'intitule **« Version installée »**, et le numéro de la dernière version publiée n'y apparaît plus que sous la forme d'une mise à jour proposée. Le correctif de fond datait de la 1.31.1 ; ce qui restait, c'est qu'une installation plus ancienne affichait le numéro du serveur, et que rien dans le libellé n'empêchait de le prendre pour le sien
- Bloc de bienvenue de l'accueil refait : une phrase d'introduction et une ligne par onglet au lieu d'un paragraphe compact, et le paragraphe sur l'apparence retiré (Paramètres le montre mieux que des phrases). Mesuré : 2 500 → 1 818 signes
- **Trois affirmations fausses corrigées dans les textes publics** : le bloc d'accueil annonçait les trois calligraphies puis soutenait trois paragraphes plus loin que « la calligraphie du texte coranique ne change jamais » (vrai avant la 1.19.0, et la même phrase traînait dans le LISEZMOI) ; les couleurs du tajwid étaient données comme portées par la seule calligraphie du mushaf, alors que la police de lecture les porte aussi, posées par l'application ; la page Sources revendiquait encore « le moteur de révision espacée » comme travail propre de Roub'
- **UthmanicHafs** n'est plus appelée « notre police de lecture » : elle est celle du Complexe du Roi Fahd
- Le README ne prétend plus que le choix de calligraphie vaut pour les trois présentations : la page imprimée n'en offre qu'une
- `docs/SYNC.md` décrivait un périmètre de synchronisation de trois clés en concluant que « les réglages restent par appareil » : il donne maintenant les huit clés de la charge utile et leur règle de fusion
- Captures du README refaites : elles montraient une navigation à cinq entrées sans icônes, donc antérieure à la 1.23.0 et à l'onglet Statistiques
- `tools/README.md` gagne les six scripts qui n'y figuraient pas et une section sur les bibliothèques vendorisées
- **Deux contrôles neufs qui refusent une publication**, tous deux éprouvés par injection de fautes : les empreintes SHA-256 des bibliothèques redistribuées doivent correspondre à celles publiées par leur source (une normalisation de fins de ligne les avait déjà fait diverger), et les textes publics sont confrontés à une liste de formules connues pour vieillir mal, à leurs propres chiffres et à `SOURCES.md`
- Nettoyage : deux règles CSS sans porteur retirées

## 2.0.0 · 2026-07-30
- La révision espacée passe à **FSRS-6**, l'algorithme de planification qu'emploie Anki. Les cartes ne reviennent plus à intervalle simplement croissant : elles reviennent au moment où tu es sur le point de les oublier, calculé sur ton propre historique de révisions. Le calcul se fait sur l'appareil, rien n'est envoyé nulle part
- **Deux boutons de notation au lieu de quatre** : tu dis seulement si le verset est venu ou non, ce sur quoi on ne peut pas se tromper. Les quatre restent disponibles dans Paramètres, avec une aide qui explique ce que chacun engage et pourquoi « Difficile » signifie « je l'ai su, avec peine » et jamais « je l'ai presque su »
- Trois réglages neufs dans Paramètres : le nombre de boutons, le **souvenir visé** (la part d'oubli acceptée avant qu'une carte revienne, de 80 à 96 %) et un bouton **Optimiser** qui ajuste la planification sur l'historique. Chacun est expliqué sur place, avec les avertissements de la documentation de FSRS
- Ces trois réglages **suivent d'un appareil à l'autre**, contrairement au thème ou à la police qui restent propres à chacun : sans cela, un appareil où l'on a optimisé et un autre où l'on ne l'a pas fait donneraient à la même carte des échéances différentes, d'environ 25 % d'écart. Les préférences et les poids portent chacun leur propre horodatage, de sorte que déplacer le curseur sur un appareil n'efface pas les poids calculés sur l'autre
- Effacer « l'historique et les statistiques » remet aussi les poids aux valeurs d'usine : ils se calculaient sur cet historique, et sans lui ils n'ont plus de justification
- **Numéro majeur parce que la planification change de format et repart de zéro** : celle de l'ancien moteur ne se convertit pas dans le nouveau. Les auto-évaluations de versets, la série de jours, le journal et les statistiques ne sont pas touchés
- Une carte est dite « acquise » quand l'application estime qu'on la retiendrait trois semaines, et non plus quand son intervalle atteint trois semaines. Le compte ne bouge donc plus quand on déplace le réglage du souvenir visé, mais seulement quand la mémoire bouge
- Copie locale : ouvrir `app/index.html` comme un simple fichier ne permet plus de réviser, le navigateur refusant d'y charger le planificateur. `start.bat` (ou la version en ligne) rend la révision ; tout le reste fonctionne dans les deux cas
- Sources et licences : `fsrs-browser` (BSD-3-Clause) et le fragment `wasm-bindgen-rayon` (Apache-2.0) sont redistribués avec leur texte de licence, et `SOURCES.md` gagne une section sur la planification ainsi que les notices du manuel d'Anki et de sa FAQ FSRS, désormais cités dans l'application

## 1.31.1 · 2026-07-29
- Correction : Paramètres affichait la dernière version DISPONIBLE en ligne et non celle réellement installée. On pouvait donc se croire à jour sans l'être. La ligne annonce maintenant la version installée, et signale à côté qu'une mise à jour existe quand c'est le cas

## 1.31.0 · 2026-07-29
- Paramètres gagne une section « Réinitialiser » : on peut effacer séparément la planification des cartes, les auto-évaluations de versets, les règles de tajwid cochées, ou l'historique et les statistiques. Tes réglages, tes avis et le contenu de l'application ne sont jamais touchés
- L'effacement tient : il vaut pour tous les appareils liés et ne peut plus être défait par un appareil resté en arrière, qui restaurait jusqu'ici ce qu'on venait de supprimer
- Chaque bouton nomme précisément ce qu'il efface avant de demander confirmation

## 1.30.0 · 2026-07-29
- L'application conserve désormais le détail de chaque révision, et non plus seulement un total par jour. Cet historique ne sert encore à rien de visible : il prépare le passage à un planificateur plus fin, qui s'ajuste sur les révisions passées. Il est branché dès maintenant parce qu'un historique ne se fabrique pas après coup

## 1.29.0 · 2026-07-29
- L'application enregistre désormais trois choses qu'elle ignorait : l'historique de tes auto-évaluations, le temps passé à réviser et le temps d'écoute de la récitation
- Nouveau bloc « Ce qui a bougé » : combien de versets se sont consolidés, sont devenus solides, ont été évalués pour la première fois ou sont redescendus d'un cran sur les trente derniers jours. C'est la courbe de ta mémorisation, là où le reste n'en donnait que l'état
- Nouveau bloc « Écoute » : temps d'écoute et versets écoutés, les répétitions comprises
- Le temps de révision se mesure entre deux réponses, plafonné à deux minutes par carte : une carte laissée ouverte pendant une pause ne gonfle pas le total
- Ces trois mesures commencent aujourd'hui : elles ne peuvent rien dire du travail accompli avant cette version

## 1.28.0 · 2026-07-29
- L'onglet Statistiques s'étoffe : quatre chiffres clés en tête, puis la régularité (trente derniers jours en barres, meilleure série, jours de révision, moyenne, part de réponses « à revoir »), la mémorisation (versets solides, fragiles, à revoir, part auto-évaluée, enchaînements acquis, versets annotés), l'état du paquet (neuves, en apprentissage, acquises, rechutes, intervalle moyen et le plus long, et le détail par type de carte), ce qui revient aujourd'hui, demain, sous 7 et 30 jours, et les règles de tajwid déjà vues
- Tout est calculé à partir de ce que l'application enregistre déjà : aucun compteur supplémentaire, donc aucun chiffre qui puisse diverger de la réalité

## 1.27.0 · 2026-07-29
- Nouvel onglet Statistiques, avec son icône. Il recueille « Ma progression », qui vivait jusqu'ici en bas de l'accueil, là où il fallait dérouler tout le catalogue pour la trouver
- Sur grand écran, Sources et Statistiques se regroupent à droite de la barre, contre la bascule clair/sombre : les écrans de consultation se séparent ainsi des écrans de travail. Sur téléphone, les six entrées se partagent la barre du bas à égalité

## 1.26.1 · 2026-07-29
- « Ma progression » s'affiche dès la première visite au lieu d'attendre la première carte révisée. Elle était invisible pour ceux à qui elle est le plus utile : un nouvel utilisateur ignorait que l'application suit son avancement. Tant qu'il n'y a rien à montrer, elle dit ce qu'elle attend

## 1.26.0 · 2026-07-29
- Chaque juz porte maintenant son nom, en arabe et en lettres latines : Juz 1 · alif-lâm-mîm, Juz 30 · ʿamma yatasâ'aloûn. Un juz se nomme par ses premiers mots, et ces mots sont pris dans le texte de l'application avec leur translittération, laquelle suit le système choisi dans Paramètres
- La ligne d'un juz se lit sur deux rangées : le nom au-dessus, l'étendue et les comptes en dessous

## 1.25.0 · 2026-07-29
- L'accueil se parcourt maintenant par juz : chaque juz se déplie pour montrer ses huit roub', et en ouvrir un referme le précédent. La liste tenait jusqu'ici tout entière à l'écran, ce qui deviendra impraticable à mesure que le Qur'an sera couvert
- Chaque juz annonce son étendue, son nombre de roub' et ses cartes à revoir sans qu'il soit besoin de le déplier

## 1.24.0 · 2026-07-29
- Le mode « Mushaf 1405 H » est retiré : la page imprimée n'affiche plus que l'édition en couleurs. Cette seconde édition, en noir et blanc, ne servait plus. Elle n'est pas perdue pour autant, elle est archivée dans le dépôt avec sa marche à suivre pour la rétablir
- Télécharger les pages du mushaf pour la lecture hors ligne coûte 4,5 Mo de moins, ces polices n'étant plus nécessaires
- Une fois installée sur téléphone, l'application s'ouvre maintenant en plein écran, sans la barre de l'heure. Il faut la réinstaller pour que le changement prenne effet

## 1.23.3 · 2026-07-29
- Le bandeau de la sourate se place désormais entre le cadre du titre et la page du mushaf, dont il prend exactement la largeur, collé à l'un et à l'autre. Il flottait jusqu'ici au milieu du cadre, dans un grand vide creusé par son propre interligne

## 1.23.2 · 2026-07-29
- La calligraphie des noms de sourates suit désormais la largeur de la page au lieu d'une taille fixe. Sur la page imprimée, le bandeau coiffe exactement la page du mushaf au lieu de flotter au milieu ; ailleurs, le titre grandit avec l'écran
- Un espace sépare enfin la calligraphie du nom français, qui se touchaient

## 1.23.1 · 2026-07-29
- Correction : en changeant d'écran, l'encadré de l'onglet quitté restait affiché quelques dixièmes de seconde par-dessus le nouveau, et l'on voyait deux onglets marqués à la fois. La barre du haut et celle du bas ne gardent plus d'image de leur état précédent pendant la transition

## 1.23.0 · 2026-07-29
- Les noms de sourates s'affichent en calligraphie. Dans Versets et Texte continu, c'est le nom précédé de سورة ; sur la page imprimée, c'est le bandeau orné du mushaf, comme sur le papier. Les deux dessins viennent du Complexe du Roi Fahd, comme la calligraphie du texte. Le nom français reste affiché dans tous les cas
- Les cinq entrées de la navigation portent maintenant une icône : une maison, un livre, une toque, des rouages et un livre ouvert annoté. Les libellés restent, une icône seule se devine mais ne se lit pas
- Les deux polices de noms sont découpées aux seules sourates que l'application couvre, ce qui les ramène de 2,8 Mo à 319 Ko

## 1.22.0 · 2026-07-29
- Le haut de page rend 66 px de plus au texte. Le retour vers la liste des roub' quitte l'en-tête pour la barre grise du haut, là où on le cherche, et les six onglets tiennent maintenant sur une seule ligne qui défile au doigt au lieu de deux rangées
- Un dégradé au bord des onglets signale qu'il y en a d'autres, et seulement du côté où il en reste vraiment. L'onglet ouvert est toujours ramené dans le champ, y compris le dernier
- Sur grand écran, les six onglets tiennent sans défiler et l'affichage ne change pas
- Mis bout à bout avec la version précédente, le premier verset d'un roub' remonte de 572 à 400 px sur un téléphone de 390 px de large

## 1.21.0 · 2026-07-28
- Sur téléphone, la barre d'options ne garde que les trois présentations : Versets, Texte continu et Page imprimée. L'écriture, l'affichage et le masquage passent derrière une clé, comme les réglages de la barre de récitation. La barre tombe de quatre lignes à une seule et le texte commence 106 px plus haut
- Le panneau des options recouvre le texte au lieu de le repousser, et il reste ouvert tant qu'on règle : enchaîner plusieurs réglages ne le referme plus à chaque fois
- Les groupes de réglages portent enfin leur nom, Écriture, Affichage et Masquer, là où un simple trait les séparait sans rien dire
- Sur grand écran, rien ne change : tout reste déplié et la clé n'apparaît pas

## 1.20.1 · 2026-07-28
- Correction d'une fiche de tajwid. Sur l'izhâr shafawi, la mise en garde devant les lettres و et ف disait l'inverse de celle du matn : le risque n'est pas de laisser traîner le mîm, c'est qu'il s'efface, le fâ' étant proche de son point d'articulation et le wâw le partageant

## 1.20.0 · 2026-07-28
- L'auto-évaluation d'un verset se fait désormais par trois boutons nommés : à revoir, fragile, solide. La petite pastille ronde qui tournait sur quatre états sans jamais dire lesquels a disparu de la carte du verset. Recliquer le choix actif l'annule
- Correction d'un défaut présent depuis les premières versions : dans la carte du verset, cette pastille ne changeait jamais de couleur, quel que soit le niveau choisi. Le niveau était bien enregistré, il ne se voyait simplement pas
- Le crayon des notes personnelles est maintenant toujours visible, même sur un verset non évalué, et une note peut se prendre sans avoir choisi de niveau au préalable. Il change de couleur dès qu'une note existe
- Annuler une auto-évaluation tient désormais sur tous les appareils liés : la synchronisation la rétablissait au rapprochement suivant

## 1.19.0 · 2026-07-28
- La calligraphie du texte coranique se choisit désormais : notre police de lecture, Digital Khatt (qui reprend le trait du mushaf imprimé tout en restant du vrai texte), ou les dessins de l'édition officielle du Complexe du Roi Fahd. Le choix vaut pour les trois présentations et il est retenu
- Les couleurs du tajwid sont maintenant celles du mushaf de Médine, relevées dans les polices officielles du Complexe du Roi Fahd. Elles remplacent nos anciennes teintes, qui n'avaient aucune source. Le mushaf colorie ce qui arrive au son : toutes les nasalisations partagent donc le vert, et tout ce qui ne se prononce pas partage le gris
- Sur la page imprimée, le soulignage suit enfin la récitation mot à mot ; il ne marquait jusqu'ici que le verset entier
- Correction importante de la page imprimée en couleurs : sur 38 pages, les lignes ne se coupaient pas là où le mushaf les coupe. Elles suivent désormais l'édition dont la calligraphie est tirée
- Une règle était mal nommée depuis le début : ce que l'application appelait « madd munfasil » est en réalité le madd 'âriḍ li-s-soukoûn, l'allongement de la dernière syllabe avant une pause. La légende des couleurs, elle, disait juste
- Le mode « Pages du mushaf » s'appelle désormais « Page imprimée » : ce qu'il décrit est une présentation, pas une édition

## 1.18.1 · 2026-07-28
- La présentation de l'équipe est réécrite : Roub' est né de l'idée originale d'Anis, conceptualisé et réalisé par Yusuf, avec les ajustements pédagogiques d'Israa
- Le bloc d'accueil et le LISEZMOI annonçaient encore que l'onglet Tajwid n'existait que pour le roub' 1 : c'est corrigé, il est disponible pour les 24 roub' depuis la version précédente
- L'onglet Tajwid est maintenant décrit dans le README et le LISEZMOI, avec le rappel que le détail sourate par sourate se lit dans l'onglet Mémoriser

## 1.18.0 · 2026-07-27
- L'onglet Tajwid d'un roub' est refait : les règles ne sont plus une liste de pastilles, chacune a sa place, son explication et un exemple pris dans le roub' que vous lisez
- Un sommaire à gauche liste toutes les règles du roub', suit votre lecture et vous emmène de l'une à l'autre
- Chaque exemple montre le passage exact où la règle se produit, avec sa seule couleur allumée et tout le reste en encre neutre, plus la translittération et la traduction du verset
- Une case « déjà vue » par règle, et trois filtres pour ne voir que les nouvelles ou que celles que vous avez déjà travaillées. L'état suit d'un appareil à l'autre comme le reste de votre progression
- Deux nouvelles fiches de règles : l'idghâm mutajânisayn, et les lettres écrites mais non prononcées, dont la page Sources donne désormais l'origine exacte dans les conventions du mushaf de Médine
- Les exemples des fiches sont maintenant tirés du texte du mushaf par leur référence, ce qui garantit qu'ils sont exacts au signe près

## 1.17.2 · 2026-07-27
- L'écran Paramètres est réorganisé en sections, et les habillages se choisissent sur un aperçu de leurs couleurs au lieu d'un nom dans une liste
- Deux nouveaux réglages : la taille du texte et la largeur de page, en trois crans chacun. Le réglage de police de votre navigateur reste respecté
- Les pages de lecture suivie, tutoriels et sources, resserrent leur cadre autour du texte : moins de vide à droite et des lignes plus longues, donc moins de retours à la ligne
- La largeur de lecture est recalée pour chaque habillage : elle était très inégale d'un habillage à l'autre, à cause de la largeur des lettres de chaque police
- En mode sombre, la barre du haut se détache du fond au lieu de s'y fondre
- Changer un réglage ne remonte plus la page et ne la déplace plus sous le curseur

## 1.17.1 · 2026-07-27
- La police choisie s'applique désormais à tout le texte de l'application, et plus seulement aux passages de lecture. Le réglage s'appelle simplement « Police »
- Les cartes, encadrés et blocs prennent le relief de leur habillage, et les commandes cliquables une élévation plus courte : Vélin la donne douce, Colophon nette, Ardoise presque plate
- L'état intermédiaire de l'auto-évaluation change de couleur pour une teinte plus lisible : l'ancienne était décorative et ne tenait pas le contraste sur du texte
- Le titre de l'accueil et le papier des pages du mushaf suivent enfin les valeurs de l'habillage au lieu de valeurs figées

## 1.17.0 · 2026-07-27
- Nouvelle apparence, avec trois habillages au choix : Vélin, Ardoise et Colophon, chacun en clair et en sombre. L'habillage se choisit séparément pour chaque mode
- Le mode clair devient celui par défaut, et à la première visite l'application suit le réglage clair ou sombre de votre appareil. Un choix déjà enregistré est conservé
- La police de lecture se change dans Paramètres : chaque habillage vient avec la sienne, vous pouvez en prendre une autre sans changer d'habillage
- Les pages du mushaf s'affichent enfin sur fond sombre la nuit, avec la palette sombre officielle de la calligraphie, au lieu du bloc de papier clair qui trouait l'écran
- Sur téléphone, la navigation passe en bas de l'écran, sous la portée du pouce, et la barre du haut se replie pendant la lecture. Le défilement automatique de la récitation ne la replie jamais
- Nouveau réglage « Animations », à trois états : suivre le système, réduites ou complètes. Les changements d'écran sont animés, et le soulignage de la récitation n'est jamais concerné
- Nouveau logo dessiné et nouvelles icônes d'application
- Le texte du Qur'an, sa calligraphie et ses couleurs de tajwid sont inchangés

## 1.16.3 · 2026-07-26
- Ménage interne avant la refonte graphique à venir : une règle de style et une fonction JavaScript devenues inutiles sont retirées, rien ne change à l'usage
- Le prototype de découpage audio, mis de côté depuis longtemps, ne fait plus partie du dépôt public

## 1.16.2 · 2026-07-25
- Le badge « notes à venir » réapparaît sur l'accueil : il suivait un verrou d'accès levé en 1.13.0, il suit maintenant la présence de notes rédigées
- Page Sources : les auteurs du tutoriel « Obligatoire ou perfectionnement ? » (Mullâ 'Alî al-Qârî, al-Marṣafî, Makkî Naṣr) rejoignent la bibliographie, qui dit aussi pourquoi trois liens ne passent pas par Shamela
- Page Sources : les transformations d'affichage du texte sont énoncées toutes les deux, la graphie du soukoun et celle de l'iqlâb
- Captures et documents remis en accord avec l'application (onglet Sources, cinq tutoriels, roub' tous ouverts)

## 1.16.1 · 2026-07-25
- Paramètres : la dernière adresse de contact qui restait en texte brut est cliquable comme les autres

## 1.16.0 · 2026-07-25
- Nouveau tutoriel **« Obligatoire ou perfectionnement ? »** : ce que les savants tiennent pour obligatoire dans le tajwid, ce dont ils discutent, et ce que tous disent de la capacité de chacun. Les deux positions sont exposées avec leurs auteurs et leurs textes, l'application n'arbitre pas entre elles

## 1.15.0 · 2026-07-25
- **Sources** devient un onglet à part entière, après Paramètres : ce n'est pas un tutoriel mais la référence de tout ce que l'application reprend à d'autres
- Bibliographie : les liens renvoient en priorité vers la Bibliothèque numérique Shamela, la plus consultée pour les textes classiques, et les notices gagnent leur édition scientifique, leur éditeur et leur tomaison. Les autres adresses ne subsistent que là où Shamela n'a pas l'ouvrage ou n'en sert pas le texte

## 1.14.1 · 2026-07-25
- Les crédits des Paramètres ne répètent plus la page Sources : ils y renvoient par un lien cliquable, et gardent ce qui leur est propre (équipe, confidentialité, licences)
- Les renvois cliquables se voient enfin partout : hors des fiches, ils avaient la couleur du texte et pas de curseur de lien

## 1.14.0 · 2026-07-25
- Les listes de sources sont désormais des bibliographies normalisées ISO 690 : la page Sources reçoit une section « Bibliographie » qui reprend toutes les références en notices complètes, et le tutoriel des styles cite ses sources de la même façon. La prose qui explique la provenance et les conditions d'usage est conservée, la norme ne sachant pas les porter

## 1.13.10 · 2026-07-25
- Page Sources : l'année de décès du cheikh al-Husary est retirée, elle n'apprend rien au lecteur

## 1.13.9 · 2026-07-25
- Iqlâb, graphie reprise après vérification sur la calligraphie officielle : le mushaf ne complète pas le tanwin par le petit mîm, il en remplace le second trait. Le tanwin s'affiche donc avec un seul trait, et le mîm se place du côté de la voyelle, en dessous pour une kasra, au-dessus pour une fatha ou une damma
- Corrige du même coup les deux défauts de la version précédente : un trait de trop, et le signe qui venait croiser la queue de la lettre

## 1.13.8 · 2026-07-25
- Correction d'affichage signalée par Yusuf : le petit mîm de l'iqlâb sortait en cercle autonome au milieu de la ligne dans 13 versets, dont 2:41. Le texte reprend la graphie du mushaf, tanwin aux deux traits écartés et mîm niché entre eux, dans les 46 versets concernés
- Fiche « Iqlâb » : le petit mîm est au-dessus pour un noûn sakina, une fathatan ou une dammatan, mais en dessous pour une kasratan ; la fiche ne mentionnait que le premier cas

## 1.13.7 · 2026-07-25
- Soulignage mot à mot et départ au mot double-cliqué recalés dans les récitations 128 kbps, muallim et mujawwad : sur les versets qui contiennent un « yâ » d'appel écrit collé (يَـٰٓأَيُّهَا, يَـٰٓـَٔادَمُ), la source comptait un mot de plus et tout le reste du verset décalait d'un cran
- Quand le récitateur répète un mot, ce qui est fréquent en muallim, le soulignage revient avec lui au lieu de prendre de l'avance jusqu'à la fin du verset

## 1.13.6 · 2026-07-25
- Double-clic sur un mot : la récitation démarre à ce mot précis, puis enchaîne la suite du roub'. En texte continu comme sur les pages du mushaf

## 1.13.5 · 2026-07-25
- Double-clic sur un verset : la lecture enchaîne de nouveau à partir de ce verset, en mode texte continu comme sur les pages du mushaf. Le texte ne se recentre plus quand la lecture part d'un clic, ce qui faisait tomber le second clic à côté
- Le réglage « surlignage mot à mot » devient « soulignage mot à mot », conforme à ce qu'il affiche

## 1.13.4 · 2026-07-25
- Bloqueurs de publicités : les Paramètres indiquent désormais quels domaines autoriser pour les récitations non fournies avec l'appli, et le message d'échec évoque cette cause (cas constaté avec uBlock Origin)

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
- La même mention rejoint l'« à propos » des Paramètres

## 1.5.7 · 2026-07-23
- Mention ajoutée dans le widget d'avis, le README et le LISEZMOI : contenu sourcé et vérifié, toute erreur peut être signalée

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

## 1.1.0 · 2026-07-23
- Soukoun à la graphie du mushaf de Médine (petite tête de khâ') et option pour masquer les ronds des lettres muettes
- Pages du mushaf : mise en page exacte de Médine (calligraphie officielle)
- Progression visible (barres, versets acquis, série de jours) et auto-évaluation des lacunes
- Application installable (PWA) avec mode hors-ligne
- Renvois multi-versets cliquables (« 2:21-22 »), légende tajwid clarifiée

## 1.0.0 · 2026-07-23
- Pilote : moteur complet + roub' 1 (Al-Fâtiḥa + Al-Baqara 1-25), 3 modes
  d'affichage, révision espacée, paquets Anki, feedback exportable
