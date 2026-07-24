/* Glossaire des termes techniques : chaque entrée est soit un renvoi vers une
   fiche de règles existante (champ `regle`), soit une définition courte
   SOURCÉE (champs `def` + `src`). Utilisé par les tutoriels : le terme devient
   cliquable et ouvre une bulle. Aucune définition inventée : les définitions
   propres viennent d'Ibn al-Jazarî, an-Nashr fî l-qirâ'ât al-'ashr, t. I,
   chapitre « Comment lit-on le Qur'an ? » (texte arabe archivé dans le projet)
   ou du matn Tuhfat al-Atfal, déjà utilisés pour les fiches de règles. */
window.GLOSSAIRE = {
  "madd": { regle: "madd-tabii" },
  "ghunna": { regle: "ghunna" },
  "qalqala": { regle: "qalqala" },
  "ikhfâ'": { regle: "ikhfa" },
  "idghâm": { regle: "idgham-ghunna" },
  "izhâr": { regle: "izhar" },
  "iqlâb": { regle: "iqlab" },

  "tajwîd": {
    def: "Science de la prononciation correcte du Qur'an. Ibn al-Jazarî la définit comme « la parure de la récitation et l'ornement de la lecture : donner aux lettres leurs droits et leur rang, ramener chaque lettre à son point d'articulation et à son origine… sans excès ni affectation ».",
    src: "Ibn al-Jazarî, an-Nashr fî l-qirâ'ât al-'ashr, t. I.",
  },
  "hamza": {
    def: "Le coup de glotte (ء), attaque brève de la voix comme dans « aïe ». Le taḥqîq exige de la « réaliser » pleinement plutôt que de l'alléger, ce que la lecture rapide (ḥadr) autorise à l'inverse.",
    src: "Ibn al-Jazarî, an-Nashr, t. I (taḥqîq al-hamza / takhfîf al-hamz).",
  },
  "gémination": {
    def: "Redoublement d'une consonne, marqué par la shadda ( ّ ) : la lettre se tient deux fois plus longtemps. Ibn al-Jazarî range « l'appui sur les redoublements » (i'timâd at-tashdîdât) parmi les exigences du taḥqîq.",
    src: "Ibn al-Jazarî, an-Nashr, t. I.",
  },
  "son dû": {
    def: "Donner à chaque lettre « son dû », selon Ibn al-Jazarî, c'est : rassasier le madd, réaliser la hamza, compléter les voyelles, appuyer l'izhâr et les redoublements, tenir pleinement les ghunna-s, et détacher nettement les lettres les unes des autres.",
    src: "Ibn al-Jazarî, an-Nashr, t. I.",
  },
  "taḥqîq": {
    def: "La lecture posée, la plus lente des trois allures. Ibn al-Jazarî : elle sert « à assouplir les langues et à redresser la prononciation », et c'est celle « qu'on recommande à celui qui apprend », sans tomber dans l'excès inverse.",
    src: "Ibn al-Jazarî, an-Nashr, t. I.",
  },
  "ḥadr": {
    def: "La lecture rapide : raccourcissement des madd, allègement de la hamza, assimilations. Elle vise « la multiplication des bonnes actions par l'abondance de la lecture », sans jamais amputer les lettres de prolongation ni faire disparaître la ghunna.",
    src: "Ibn al-Jazarî, an-Nashr, t. I.",
  },
  "tadwîr": {
    def: "L'allure intermédiaire entre le taḥqîq et le ḥadr. Ibn al-Jazarî la donne pour « le choix de la plupart des gens de la transmission ».",
    src: "Ibn al-Jazarî, an-Nashr, t. I.",
  },
  "tartîl": {
    def: "Non pas une vitesse, mais la manière commandée par le verset « et récite le Qur'an lentement et clairement » (73:4) : réciter posément, chaque mot suivant l'autre, en comprenant. Ibn 'Abbâs le glose par « rends-le distinct », Mujâhid par « prends ton temps ».",
    src: "Ibn al-Jazarî, an-Nashr, t. I ; Qur'an 73:4.",
  },
  "riwâya": {
    def: "Voie de transmission d'une lecture du Qur'an, remontant à un transmetteur nommé. Roub' suit Hafs 'an 'Âsim, la plus répandue aujourd'hui.",
    src: "Ibn al-Jazarî, an-Nashr, t. I (chaînes de transmission).",
  },
};
