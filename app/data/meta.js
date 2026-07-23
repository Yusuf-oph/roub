/* Registre des 16 rubs (juz 1-2). Étoiles = difficulté de MÉMORISATION sur
   l'échelle de tous les rubs du Qur'an (1 = facile type sourates courtes du
   juz 'Amma ; 5 = les passages législatifs les plus durs du Livre).
   Critères : longueur et régularité des versets, densité de mutashabihat
   (internes et avec d'autres sourates), rareté du vocabulaire, présence ou
   non d'une trame narrative qui soutient la mémoire. Notation éditoriale
   assumée, discutable via le widget d'avis. */
window.META = {
  rubs: [
    {
      id: "j1r1", juz: 1, rub: 1, rubGlobal: 1, debut: "1:1", fin: "2:25", n: 32,
      titre: "La Fâtiḥa · croyants, mécréants, hypocrites",
      stars: 3, dispo: true,
      starsWhy: "La Fâtiḥa est déjà connue et le début d'Al-Baqara est très écouté : la familiarité aide. Mais la longue section sur les hypocrites (2:8-20) enchaîne des accusations aux formulations proches ({2:11} vs {2:13}, finales *lâ yach'ouroûn* vs *lâ ya'lamoûn*) et deux paraboles successives (le feu, puis l'averse) dont les transitions se confondent. Moyennement difficile à l'échelle du Qur'an.",
    },
    {
      id: "j1r2", juz: 1, rub: 2, rubGlobal: 2, debut: "2:26", fin: "2:43", n: 18,
      titre: "Adam, Iblîs et l'alliance avec Israël",
      stars: 3, dispo: false,
      starsWhy: "Trame narrative forte (création d'Adam, prosternation des anges, chute) qui soutient la mémoire ; versets de longueur moyenne. Les ordres donnés aux fils d'Israël (2:40-43) ouvrent une série de rappels aux structures répétitives qu'il faudra ancrer avec soin.",
    },
    {
      id: "j1r3", juz: 1, rub: 3, rubGlobal: 3, debut: "2:44", fin: "2:59", n: 16,
      titre: "Les rappels aux fils d'Israël",
      stars: 3, dispo: false,
      starsWhy: "Épisodes courts et imagés (mer fendue, Moïse au mont, veau d'or, manne et cailles) : le récit aide. Vigilance sur les ouvertures répétées *wa-idh* (« et lorsque... ») qui se succèdent et peuvent s'intervertir.",
    },
    {
      id: "j1r4", juz: 1, rub: 4, rubGlobal: 4, debut: "2:60", fin: "2:74", n: 15,
      titre: "La vache et les cœurs endurcis",
      stars: 4, dispo: false,
      starsWhy: "Contient {2:61}, un des plus longs versets narratifs du juz, et le dialogue de la vache (2:67-71) dont les trois demandes successives des Israélites ont des formulations presque identiques (*od'ou lanâ rabbaka youbayyin lanâ...*) : terrain classique de confusion.",
    },
    {
      id: "j1r5", juz: 1, rub: 5, rubGlobal: 5, debut: "2:75", fin: "2:91", n: 17,
      titre: "Les ruptures d'alliance",
      stars: 4, dispo: false,
      starsWhy: "Polémique dense avec les fils d'Israël : versets longs ({2:85}), reprises en écho (*afatouminoûna bi-ba'ḍi l-kitâbi...*), plusieurs passages en *wa-idh* et *wa-laqad* faciles à intervertir, et des formulations proches de versets d'autres sourates.",
    },
    {
      id: "j1r6", juz: 1, rub: 6, rubGlobal: 6, debut: "2:92", fin: "2:105", n: 14,
      titre: "Soulaymân, Hâroût et Mâroût",
      stars: 4, dispo: false,
      starsWhy: "Contient {2:102}, l'un des versets les plus longs et les plus complexes syntaxiquement des deux juz (la magie, Hâroût et Mâroût, sept propositions imbriquées). Autour, un tissu polémique sans trame narrative simple.",
    },
    {
      id: "j1r7", juz: 1, rub: 7, rubGlobal: 7, debut: "2:106", fin: "2:123", n: 18,
      titre: "L'abrogation et les gens du Livre",
      stars: 4, dispo: false,
      starsWhy: "Série d'affirmations doctrinales sans fil narratif : les *wa-qâloû* (juifs, chrétiens, ignorants) s'enchaînent avec des réponses de structure semblable ; {2:120} et {2:113} demandent un ancrage précis. Le verset {2:106} (abrogation) est isolé et technique.",
    },
    {
      id: "j1r8", juz: 1, rub: 8, rubGlobal: 8, debut: "2:124", fin: "2:141", n: 18,
      titre: "Ibrâhîm et la Kaaba",
      stars: 3, dispo: false,
      starsWhy: "Récit fondateur (épreuve d'Ibrâhîm, construction de la Kaaba, invocations 2:127-129) qui porte la mémoire. Mais attention au doublon EXACT {2:134} = {2:141} (*tilka oummatoun qad khalat...*) et aux listes de prophètes ({2:136}) reprises presque à l'identique ailleurs (3:84).",
    },
    {
      id: "j2r1", juz: 2, rub: 1, rubGlobal: 9, debut: "2:142", fin: "2:157", n: 16,
      titre: "Le changement de qibla",
      stars: 4, dispo: false,
      starsWhy: "Le triplet {2:144} / {2:149} / {2:150} (*wa-min ḥaythou kharadjta...*) est l'un des mutashabihat les plus redoutés du Qur'an : trois versets quasi identiques aux suites différentes, dans le même rub. Le reste (épreuve, patience, 2:155-157) est plus fluide.",
    },
    {
      id: "j2r2", juz: 2, rub: 2, rubGlobal: 10, debut: "2:158", fin: "2:176", n: 19,
      titre: "Safâ-Marwa, le licite et l'illicite",
      stars: 4, dispo: false,
      starsWhy: "Thèmes hétérogènes sans récit (Safâ-Marwa, ceux qui taisent la révélation, tawḥîd, nourritures licites) : peu d'appuis narratifs. {2:164} est un long verset d'énumération des signes ; {2:159} et {2:174} (*inna lladhîna yaktoumoûna...*) se ressemblent dangereusement.",
    },
    {
      id: "j2r3", juz: 2, rub: 3, rubGlobal: 11, debut: "2:177", fin: "2:188", n: 12,
      titre: "La piété, le talion, le jeûne",
      stars: 5, dispo: false,
      starsWhy: "Douze versets seulement, mais parmi les plus denses du Livre : {2:177} (la piété, très longue énumération), le talion et le testament (2:178-182), puis tout le bloc du jeûne (2:183-187) avec {2:187} interminable. Législatif, technique, sans trame : niveau maximal.",
    },
    {
      id: "j2r4", juz: 2, rub: 4, rubGlobal: 12, debut: "2:189", fin: "2:202", n: 14,
      titre: "Le pèlerinage et le combat",
      stars: 4, dispo: false,
      starsWhy: "Début de la série *yas'aloûnaka* (« ils t'interrogent... ») dont les ouvertures identiques réapparaissent tout au long des deux juz : chaque réponse doit être fermement liée à sa question. Règles du combat et du hajj imbriquées, invocations finales (2:200-202) proches l'une de l'autre.",
    },
    {
      id: "j2r5", juz: 2, rub: 5, rubGlobal: 13, debut: "2:203", fin: "2:218", n: 16,
      titre: "Les questions posées au Prophète",
      stars: 4, dispo: false,
      starsWhy: "Suite des *yas'aloûnaka* (le vin et le jeu, les orphelins...) mêlée de passages doctrinaux longs ({2:213}, {2:217}) ; les thèmes alternent sans fil directeur, ce qui rend l'ordre des versets difficile à fixer.",
    },
    {
      id: "j2r6", juz: 2, rub: 6, rubGlobal: 14, debut: "2:219", fin: "2:232", n: 14,
      titre: "Le mariage et le divorce",
      stars: 5, dispo: false,
      starsWhy: "Le grand bloc législatif du divorce (2:226-232) : versets très longs ({2:228}, {2:229}, {2:231}, {2:232}), vocabulaire juridique précis ('idda, khoul', talâq), conditions et exceptions imbriquées, formulations proches à ne pas mélanger. Parmi les rubs les plus exigeants du Qur'an entier.",
    },
    {
      id: "j2r7", juz: 2, rub: 7, rubGlobal: 15, debut: "2:233", fin: "2:242", n: 10,
      titre: "L'allaitement et les veuves",
      stars: 5, dispo: false,
      starsWhy: "Dix versets seulement mais {2:233} (allaitement) est l'un des versets législatifs les plus longs du Qur'an, suivi des règles sur les veuves et la dot (2:234-237), aux conditions multiples et aux pronoms subtils. La coupure 2:238-239 (prières) au milieu du bloc juridique surprend et se perd facilement.",
    },
    {
      id: "j2r8", juz: 2, rub: 8, rubGlobal: 16, debut: "2:243", fin: "2:252", n: 10,
      titre: "Tâloût, Dâwoûd et Djâloût",
      stars: 3, dispo: false,
      starsWhy: "Retour du récit (l'armée de Tâloût, l'épreuve de la rivière, David et Goliath) : la narration guide la mémoire. Versets moyens à longs ({2:246}, {2:249}) mais à forte logique interne. Respiration bienvenue avant âyat al-koursî qui ouvre le juz 3.",
    },
  ],
};
