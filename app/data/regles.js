/* Fiches de règles tajwid, référencées par les onglets « Tajwid » des rubs
   (champ regles: [ids]) et affichées dans Tutoriels > Fiches de règles.
   Exemples pris dans les juz 1-2 chaque fois que possible. */
window.REGLES = [
  /* ---- noûn sakina et tanwin ---- */
  {
    id: "izhar", nom: "Izhâr (prononciation claire)", cat: "Noûn sakina et tanwin",
    texte: "Quand un **noûn sakina** (نْ) ou un **tanwin** est suivi d'une des 6 lettres de la gorge (ء ه ع ح غ خ), le n se prononce **clairement**, sans nasalisation ni fusion.",
    exemple: "مِنْ عِندِ أَنفُسِهِم", exempleNote: "2:109 : min ʿindi, le n de min reste net devant le ʿayn.",
  },
  {
    id: "idgham-ghunna", nom: "Idghâm avec ghunna", cat: "Noûn sakina et tanwin",
    texte: "Devant les lettres du mot **يَنْمُو** (ي ن م و), le noûn sakina ou le tanwin **fusionne** dans la lettre suivante avec une **nasalisation de 2 temps**. Le n écrit ne s'entend plus comme n : on passe directement à la lettre suivante doublée et nasalisée.",
    exemple: "فَمَن يَعْمَلْ", exempleNote: "prononcé « fay-yaʿmal » avec nasalisation, jamais « fan yaʿmal ».",
  },
  {
    id: "idgham-sans-ghunna", nom: "Idghâm sans ghunna", cat: "Noûn sakina et tanwin",
    texte: "Devant **ل** et **ر**, le noûn sakina ou le tanwin **disparaît complètement** dans la lettre suivante, sans nasalisation.",
    exemple: "هُدًى مِّن رَّبِّهِمْ", exempleNote: "2:5 : « houdam-mir-rabbihim » : le n de min devient r.",
  },
  {
    id: "iqlab", nom: "Iqlâb (transformation en mîm)", cat: "Noûn sakina et tanwin",
    texte: "Devant **ب**, le noûn sakina ou le tanwin se prononce comme un **mîm léger** avec nasalisation, lèvres à peine fermées. Le mushaf le signale par un petit م au-dessus de la lettre.",
    exemple: "صُمٌّۢ بُكْمٌ", exempleNote: "2:18 : « soummoum-boukmoun » : le tanwin devient m devant le bâ'.",
  },
  {
    id: "ikhfa", nom: "Ikhfâ' (dissimulation)", cat: "Noûn sakina et tanwin",
    texte: "Devant les **15 lettres restantes** (ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك), le noûn sakina ou le tanwin se prononce **entre** le izhâr et le idghâm : la langue ne touche pas le palais, le son sort par le nez pendant 2 temps.",
    exemple: "يُنفِقُونَ", exempleNote: "2:3 : le n de yunfiqoûn est « caché » devant le fâ', son nasal.",
  },
  /* ---- mîm sakina ---- */
  {
    id: "ikhfa-shafawi", nom: "Ikhfâ' shafawi", cat: "Mîm sakina",
    texte: "**Mîm sakina** (مْ) suivi de **ب** : le mîm est dissimulé, lèvres légèrement entrouvertes, avec nasalisation de 2 temps.",
    exemple: "وَمَا هُم بِمُؤْمِنِينَ", exempleNote: "2:8 : « houm bi-mou'minîn », mîm nasalisé devant bâ'.",
  },
  {
    id: "idgham-shafawi", nom: "Idghâm shafawi", cat: "Mîm sakina",
    texte: "**Mîm sakina** suivi d'un autre **م** : les deux mîm fusionnent en un mîm doublé avec ghunna de 2 temps.",
    exemple: "كَم مِّن فِئَةٍ", exempleNote: "2:249 : « kam-min » prononcé avec un seul m long nasalisé.",
  },
  {
    id: "izhar-shafawi", nom: "Izhâr shafawi", cat: "Mîm sakina",
    texte: "Mîm sakina suivi de toute lettre **autre que ب et م** : prononciation claire du mîm, sans nasalisation prolongée. Attention particulière devant و et ف (lettres proches des lèvres) : ne pas laisser traîner le mîm.",
    exemple: "عَلَيْهِمْ وَلَا", exempleNote: "1:7 : le mîm de ʿalayhim reste net devant le wâw.",
  },
  /* ---- ghunna ---- */
  {
    id: "ghunna", nom: "Ghunna mushaddada", cat: "Ghunna",
    texte: "Tout **نّ** ou **مّ** porteur de shadda se prononce avec une **nasalisation obligatoire de 2 temps** : le son passe par le nez avant de continuer.",
    exemple: "إِنَّ ٱلَّذِينَ", exempleNote: "« inna » : tenir le n dans le nez 2 temps.",
  },
  /* ---- qalqala ---- */
  {
    id: "qalqala", nom: "Qalqala (rebond)", cat: "Qalqala",
    texte: "Les 5 lettres de **قُطْبُ جَدٍ** (ق ط ب ج د) porteuses d'un **soukoun** produisent un léger **rebond sonore**, sans voyelle ajoutée. Petite en milieu de mot (*sughra*), plus marquée en fin d'arrêt (*kubra*).",
    exemple: "رَزَقْنَٰهُمْ", exempleNote: "2:3 : le قْ rebondit : « razaq-nâhoum ». Kubra : s'arrêter sur خَلَٰق (2:102).",
  },
  /* ---- madd ---- */
  {
    id: "madd-tabii", nom: "Madd naturel (ṭabî'î)", cat: "Allongements (madd)",
    texte: "Toute voyelle longue (ا و ي de prolongation) sans hamza ni soukoun derrière se tient **2 temps**, ni plus ni moins. C'est la durée par défaut des â, î, oû de la translittération.",
    exemple: "قَالُوا", exempleNote: "« qâloû » : 2 temps sur chaque longue.",
  },
  {
    id: "madd-muttasil", nom: "Madd muttasil (obligatoire)", cat: "Allongements (madd)",
    texte: "Voyelle longue suivie d'une **hamza dans le même mot** : allongement de **4 à 5 temps** (obligatoire).",
    exemple: "ٱلسُّفَهَآءُ", exempleNote: "2:13 : « as-soufahâââ'ou », tenir le â avant la hamza.",
  },
  {
    id: "madd-munfasil", nom: "Madd munfasil (permis)", cat: "Allongements (madd)",
    texte: "Voyelle longue en **fin de mot** suivie d'une **hamza au début du mot suivant** : allongement de 2, 4 ou 5 temps (Hafs le lit habituellement 4-5). ",
    exemple: "بِمَآ أُنزِلَ", exempleNote: "2:4 : « bimâââ ounzila » : le â s'étire avant la hamza du mot suivant.",
  },
  {
    id: "madd-arid", nom: "Madd 'âriḍ li-s-soukoûn", cat: "Allongements (madd)",
    texte: "Voyelle longue dans la **dernière syllabe avant une pause** (fin de verset le plus souvent) : allongement de 2, 4 ou 6 temps, au choix, mais **constant** dans une même récitation.",
    exemple: "يُؤْمِنُونَ", exempleNote: "en s'arrêtant : « you'minoûoûn », le oû final s'étire.",
  },
  {
    id: "madd-lazim", nom: "Madd lâzim (6 temps)", cat: "Allongements (madd)",
    texte: "Voyelle longue suivie d'un **soukoun ou d'une shadda inséparables** : allongement maximal de **6 temps**. C'est le cas des lettres isolées d'ouverture des sourates.",
    exemple: "الٓمٓ", exempleNote: "2:1 : « alif-lâââm-mîîîm » : lâm et mîm portent chacun 6 temps.",
  },
  /* ---- lettres et article ---- */
  {
    id: "lam-shamsiyya", nom: "Lettres solaires et lunaires", cat: "Lettres et article",
    texte: "Devant les 14 **lettres solaires** (ت ث د ذ ر ز س ش ص ض ط ظ ل ن), le **lâm de l'article** ne se prononce pas : la lettre suivante est doublée (اَلشَّمْس = ach-chams). Devant les lettres **lunaires**, le lâm s'entend (اَلْقَمَر = al-qamar).",
    exemple: "وَٱلصَّلَوٰةِ", exempleNote: "2:45 : « waṣ-ṣalât », le lâm écrit est muet, le ṣâd doublé.",
  },
  {
    id: "hamzat-wasl", nom: "Hamzat wasl (liaison)", cat: "Lettres et article",
    texte: "Le **ٱ** (alif sans hamza) ne se prononce qu'en **début de lecture**. Si on enchaîne depuis le mot précédent, il **s'efface** : وَٱتَّقُوا se lit « wat-taqoû ». La translittération note cette élision par l'absence de voyelle initiale.",
    exemple: "يُقِيمُونَ ٱلصَّلَوٰةَ", exempleNote: "2:3 : « youqîmoûna ṣ-ṣalâta » : l'alif de l'article disparaît dans la liaison.",
  },
  {
    id: "lam-allah", nom: "Le lâm du nom d'Allah", cat: "Lettres et article",
    texte: "Dans le nom **ٱللَّه**, le lâm doublé se prononce **emphatique** (sombre) après *a* ou *ou* (قَالَ ٱللَّهُ), mais **léger** (clair) après *i* (بِٱللَّهِ، لِلَّهِ).",
    exemple: "بِٱللَّهِ", exempleNote: "2:8 : « billâhi » avec lâm clair ; comparer avec « qâla llâhou », lâm sombre.",
  },
  {
    id: "ra-tafkhim", nom: "Râ' emphatique ou léger", cat: "Lettres et article",
    texte: "Le **ر** se prononce **emphatique** (sombre) quand il porte fatha ou damma, ou après a/ou ; **léger** (clair) quand il porte une kasra ou suit un i. En fin d'arrêt, c'est la voyelle précédente qui décide.",
    exemple: "رَبِّ ٱلْعَٰلَمِينَ", exempleNote: "1:2 : râ' sombre (fatha) ; dans رِزْقًا (2:22), râ' clair (kasra).",
  },
];
