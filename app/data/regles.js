/* Fiches de règles tajwid, référencées par les onglets « Tajwid » des roub'
   (champ regles: [ids]) et affichées dans Tutoriels > Fiches de règles.

   Un exemple se désigne par sa RÉFÉRENCE, jamais par du texte arabe saisi :
   l'arabe est tiré de QURAN au rendu, donc exact par construction (l'encodage
   du mushaf diffère invisiblement d'une saisie, cf. tools/fix_citations.py) et
   colorable par arHtml(v, classe), qui n'allume que la règle de la fiche.
   La liste `exemples` en accepte plusieurs : la page Tajwid d'un roub' prendra
   celui qui tombe dans le roub' affiché. Exemples pris dans les juz 1-2 chaque
   fois que possible. */
window.REGLES = [
  /* ---- noûn sakina et tanwin ---- */
  {
    id: "izhar", nom: "Izhâr (prononciation claire)", cat: "Noûn sakina et tanwin",
    texte: "Quand un **noûn sakina** (نْ) ou un **tanwin** est suivi d'une des 6 lettres de la gorge (ء ه ع ح غ خ), le n se prononce **clairement**, sans nasalisation ni fusion.",
    exemples: [
      { ref: "2:109", note: "min ʿindi, le n de min reste net devant le ʿayn." },
    ],
  },
  {
    id: "idgham-ghunna", nom: "Idghâm avec ghunna", cat: "Noûn sakina et tanwin",
    texte: "Devant les lettres du mot **يَنْمُو** (ي ن م و), le noûn sakina ou le tanwin **fusionne** dans la lettre suivante avec une **nasalisation de 2 temps**. Le n écrit ne s'entend plus comme n : on passe directement à la lettre suivante doublée et nasalisée. Exception (Tuhfat al-Atfal) : quand noûn et lettre sont dans le MÊME mot ([[دنيا]], [[صنوان]], [[بنيان]], [[قنوان]]), pas de fusion : prononciation claire.",
    exemples: [
      { ref: "99:7", note: "faman yaʿmal se prononce « fay-yaʿmal » avec nasalisation, jamais « fan yaʿmal » ; le verset en donne deux, l'autre sur khayran yarah." },
    ],
  },
  {
    id: "idgham-sans-ghunna", nom: "Idghâm sans ghunna", cat: "Noûn sakina et tanwin",
    texte: "Devant **ل** et **ر**, le noûn sakina ou le tanwin **disparaît complètement** dans la lettre suivante, sans nasalisation.",
    exemples: [
      { ref: "2:5", note: "« houdam-mir-rabbihim » : le n de min devient r." },
    ],
  },
  {
    id: "iqlab", nom: "Iqlâb (transformation en mîm)", cat: "Noûn sakina et tanwin",
    texte: "Devant **ب**, le noûn sakina ou le tanwin se prononce comme un **mîm léger** avec nasalisation, lèvres à peine fermées. Le mushaf le signale par un petit م, placé du côté du signe concerné : au-dessus pour un noûn sakina, une fathatan ou une dammatan, en dessous pour une kasratan ({2:41}). Le mîm ne s'ajoute pas au tanwin : il **remplace son second trait**, si bien que le tanwin s'écrit alors avec un seul.",
    exemples: [
      { ref: "2:18", note: "« soummoum-boukmoun » : le tanwin devient m devant le bâ'." },
    ],
  },
  {
    id: "ikhfa", nom: "Ikhfâ' (dissimulation)", cat: "Noûn sakina et tanwin",
    texte: "Devant les **15 lettres restantes** (ت ث ج د ذ ز س ش ص ض ط ظ ف ق ك), le noûn sakina ou le tanwin se prononce **entre** le izhâr et le idghâm : la langue ne touche pas le palais, le son sort par le nez pendant 2 temps.",
    exemples: [
      { ref: "2:3", note: "le n de yunfiqoûn est « caché » devant le fâ', son nasal." },
    ],
  },
  /* ---- mîm sakina ---- */
  {
    id: "ikhfa-shafawi", nom: "Ikhfâ' shafawi", cat: "Mîm sakina",
    texte: "**Mîm sakina** (مْ) suivi de **ب** : le mîm est dissimulé, lèvres légèrement entrouvertes, avec nasalisation de 2 temps.",
    exemples: [
      { ref: "2:8", note: "« houm bi-mou'minîn », mîm nasalisé devant bâ'." },
    ],
  },
  {
    id: "idgham-shafawi", nom: "Idghâm shafawi", cat: "Mîm sakina",
    texte: "**Mîm sakina** suivi d'un autre **م** : les deux mîm fusionnent en un mîm doublé avec ghunna de 2 temps.",
    exemples: [
      { ref: "2:249", note: "« kam-min » prononcé avec un seul m long nasalisé." },
    ],
  },
  {
    id: "izhar-shafawi", nom: "Izhâr shafawi", cat: "Mîm sakina",
    texte: "Mîm sakina suivi de toute lettre **autre que ب et م** : prononciation claire du mîm, sans nasalisation prolongée. Attention particulière devant و et ف : le mîm risque de s'y **effacer**, car le fâ' est proche de son point d'articulation et le wâw le partage. Il doit rester nettement prononcé.",
    exemples: [
      { ref: "1:7", note: "le mîm de ʿalayhim reste net devant le wâw." },
    ],
  },
  /* ---- assimilation de deux lettres ---- */
  {
    id: "idgham-mutajanisayn", nom: "Idghâm mutajânisayn", cat: "Assimilation de deux lettres",
    texte: "Deux lettres qui **partagent le même point d'articulation** mais **diffèrent par leurs traits** fusionnent : la première, porteuse d'un soukoun, ne s'entend plus et la seconde se double. Quand la première des deux est quiescente, l'assimilation est dite **petite** (*ṣaghîr*) ; si les deux sont voyellées, **grande** (*kabîr*), et cette distinction vaut aussi pour les deux lettres identiques (*mithlân*) et les lettres voisines (*mutaqâribân*). Dans les roub' couverts, le seul cas est le **د suivi d'un ت**.",
    exemples: [
      { ref: "2:233", note: "arad-tum se prononce « arattoum » : le dâl quiescent se fond dans le tâ', qui se double, et le d ne s'entend plus." },
      { ref: "109:4", note: "même fusion dans ʿabad-tum, « ʿabattoum ». Ce sont les deux seules occurrences des 823 versets." },
    ],
  },
  /* ---- ghunna ---- */
  {
    id: "ghunna", nom: "Ghunna mushaddada", cat: "Ghunna",
    texte: "Tout **نّ** ou **مّ** porteur de shadda se prononce avec une **nasalisation obligatoire de 2 temps** : le son passe par le nez avant de continuer.",
    exemples: [
      { ref: "2:6", note: "« inna » : tenir le n dans le nez 2 temps." },
    ],
  },
  /* ---- qalqala ---- */
  {
    id: "qalqala", nom: "Qalqala (rebond)", cat: "Qalqala",
    texte: "Les 5 lettres de **قُطْبُ جَدٍ** (ق ط ب ج د) porteuses d'un **soukoun** produisent un léger **rebond sonore**, sans voyelle ajoutée. Petite en milieu de mot (*sughra*), plus marquée en fin d'arrêt (*kubra*).",
    exemples: [
      { ref: "2:3", note: "le قْ rebondit : « razaq-nâhoum ». Kubra : s'arrêter sur خَلَٰق (2:102)." },
    ],
  },
  /* ---- madd ---- */
  {
    id: "madd-tabii", nom: "Madd naturel (ṭabî'î)", cat: "Allongements (madd)",
    texte: "Toute voyelle longue (ا و ي de prolongation) sans hamza ni soukoun derrière se tient **2 temps**, ni plus ni moins. C'est la durée par défaut des â, î, oû de la translittération.",
    exemples: [
      { ref: "79:12", note: "« qâloû tilka » : 2 temps sur chaque longue. Le mot suivant ne commence pas par une hamza, sinon le oû s'étirerait (madd munfasil)." },
    ],
  },
  {
    id: "madd-muttasil", nom: "Madd muttasil (obligatoire)", cat: "Allongements (madd)",
    texte: "Voyelle longue suivie d'une **hamza dans le même mot** : allongement de **4 à 5 temps** (obligatoire).",
    exemples: [
      { ref: "2:13", note: "« as-soufahâââ'ou », tenir le â avant la hamza." },
    ],
  },
  {
    id: "madd-munfasil", nom: "Madd munfasil (permis)", cat: "Allongements (madd)",
    texte: "Voyelle longue en **fin de mot** suivie d'une **hamza au début du mot suivant** : allongement de 2, 4 ou 5 temps (Hafs le lit habituellement 4-5). ",
    exemples: [
      { ref: "2:4", note: "« bimâââ ounzila » : le â s'étire avant la hamza du mot suivant." },
    ],
  },
  {
    id: "madd-arid", nom: "Madd 'âriḍ li-s-soukoûn", cat: "Allongements (madd)",
    texte: "Voyelle longue dans la **dernière syllabe avant une pause** (fin de verset le plus souvent) : allongement de 2, 4 ou 6 temps, au choix, mais **constant** dans une même récitation.",
    exemples: [
      { ref: "84:20", note: "en s'arrêtant sur la fin du verset : « you'minoûoûn », le oû final s'étire." },
    ],
  },
  {
    id: "madd-lazim", nom: "Madd lâzim (6 temps)", cat: "Allongements (madd)",
    texte: "Voyelle longue suivie d'un **soukoun ou d'une shadda inséparables** : allongement maximal de **6 temps**. C'est le cas des lettres isolées d'ouverture des sourates.",
    exemples: [
      { ref: "2:1", note: "« alif-lâââm-mîîîm » : lâm et mîm portent chacun 6 temps." },
    ],
  },
  /* ---- lettres et article ---- */
  {
    id: "lam-shamsiyya", nom: "Lettres solaires et lunaires", cat: "Lettres et article",
    texte: "Devant les 14 **lettres solaires** (ت ث د ذ ر ز س ش ص ض ط ظ ل ن), le **lâm de l'article** ne se prononce pas : la lettre suivante est doublée (اَلشَّمْس = ach-chams). Devant les lettres **lunaires**, le lâm s'entend (اَلْقَمَر = al-qamar).",
    exemples: [
      { ref: "2:45", note: "« waṣ-ṣalât », le lâm écrit est muet, le ṣâd doublé." },
    ],
  },
  {
    id: "hamzat-wasl", nom: "Hamzat wasl (liaison)", cat: "Lettres et article",
    texte: "Le **ٱ** (alif sans hamza) ne se prononce qu'en **début de lecture**. Si on enchaîne depuis le mot précédent, il **s'efface** : وَٱتَّقُوا se lit « wat-taqoû ». La translittération note cette élision par l'absence de voyelle initiale.",
    exemples: [
      { ref: "2:3", note: "« youqîmoûna ṣ-ṣalâta » : l'alif de l'article disparaît dans la liaison." },
    ],
  },
  {
    id: "lam-allah", nom: "Le lâm du nom d'Allah", cat: "Lettres et article",
    texte: "Dans le nom **ٱللَّه**, le lâm doublé se prononce **emphatique** (sombre) après *a* ou *ou* (قَالَ ٱللَّهُ), mais **léger** (clair) après *i* (بِٱللَّهِ، لِلَّهِ).",
    exemples: [
      { ref: "2:8", note: "« billâhi » avec lâm clair ; comparer avec « qâla llâhou », lâm sombre." },
    ],
  },
  {
    id: "lettre-muette", nom: "Lettre écrite et non prononcée", cat: "Lettres et article",
    texte: "Le mushaf de Médine pose un **petit rond vide** au-dessus d'une des trois lettres de prolongation (ا و ي) **ajoutée dans le tracé** : la lettre ne se prononce alors **ni en enchaînant, ni à l'arrêt**. C'est le cas de l'alif qui suit le wâw des verbes au pluriel (*âmanoû*) et du wâw de *oulâ'ika*. Un second signe dit l'inverse : le **rond ovale vertical**, posé sur un alif suivi d'une lettre voyellée, marque une lettre qui tombe **en enchaînant seulement** et se prononce donc si l'on s'arrête, comme le *anâ* de {109:4}. Le réglage « Ronds muets » des options de lecture les affiche ou les masque. L'application grise aussi le wâw de *aṣ-ṣalât*, écrit mais lu comme un â long.",
    exemples: [
      { ref: "90:18", note: "oulâ'ika : le wâw écrit après le alif ne se prononce pas, on lit directement « oûlâ'ika »." },
      { ref: "83:34", note: "âmanoû : l'alif final des verbes au pluriel ne se prononce jamais, ni en enchaînant ni à l'arrêt." },
    ],
  },
  {
    id: "ra-tafkhim", nom: "Râ' emphatique ou léger", cat: "Lettres et article",
    texte: "Le **ر** se prononce **emphatique** (sombre) quand il porte fatha ou damma, ou après a/ou ; **léger** (clair) quand il porte une kasra ou suit un i. En fin d'arrêt, c'est la voyelle précédente qui décide. (Règle générale ; la Jazariyya détaille quelques cas particuliers, comme une lettre emphatique qui suit.)",
    exemples: [
      { ref: "1:2", note: "râ' sombre (fatha) ; dans رِزْقًا (2:22), râ' clair (kasra)." },
    ],
  },
];
