# Bibliographie et sources de Roub'

Toutes les sources utilisées par l'application, dans le détail : édition,
version, provenance exacte, conditions d'usage. Cette page est la référence :
les mentions plus courtes de l'application, du README et du LISEZMOI y
renvoient. Dernière révision : 25 juillet 2026.

Principe de travail : **rien de ce qui touche à la religion n'est écrit sans
source nommée et vérifiable**. Ce qui relève de la méthode d'apprentissage
(ordre de révision, points de vigilance, choix pédagogiques) est notre travail
propre et n'est pas présenté comme une position savante.

---

## 1. Texte coranique

- **Mushaf de Médine, riwâya Hafs 'an 'Âsim**, texte de référence du Complexe
  du Roi Fahd pour l'impression du Noble Coran (KFGQPC, Médine).
- Obtenu par l'**API quran.com v4** (`api.quran.com/api/v4`) : champs
  `text_uthmani` (texte affiché), `text_uthmani_tajweed` (annotations de
  règles), `text_imlaei` (base de la translittération).
- Le texte n'est **jamais modifié** : les seules transformations sont
  d'affichage (graphie du soukoun propre au mushaf de Médine) et sont
  réversibles.
- Contrôle : `tools/verifie.py` compare, verset par verset, le texte publié au
  texte de l'API.

## 2. Calligraphie et pages du mushaf

- **Polices QCF (Qur'anic Complex Fonts) du KFGQPC**, un glyphe par mot :
  version 1 en noir et blanc, version 4 en couleurs tajwid (COLRv1).
- **Police UthmanicHafs** (KFGQPC) pour le texte courant.
- Mise en page ligne à ligne reprise de l'API quran.com (`code_v1`/`code_v2`,
  numéros de page et de ligne) : les pages de l'application correspondent
  exactement aux pages du mushaf imprimé.

## 3. Traduction française

- **Muhammad Hamidullah**, *Le Noble Coran et la traduction en langue française
  de ses sens*, telle que servie par l'API quran.com (identifiant 31).
  Diffusion non commerciale.

## 4. Tafsir (commentaire verset par verset)

- **« French Translation of Al-Mukhtasar in Interpreting the Noble Quran »**,
  traduction française d'*al-Mukhtaṣar fî tafsîr al-Qur'ân al-karîm*,
  **Tafsir Center for Quranic Studies** (مركز تفسير للدراسات القرآنية),
  **version 1.0.0 du 03/10/2019**, distribuée par **QuranEnc.com**
  (Encyclopédie du Noble Coran), clé `french_mokhtasar`.
- **Reproduit sans aucune modification**, conformément aux conditions de
  QuranEnc.com : re-publication autorisée avec mention de l'éditeur et de la
  source, numéro de version affiché, contenu inchangé.
- Couvre les 6 236 versets du Qur'an ; l'application en affiche les 823 de sa
  couverture actuelle.

## 5. Récitations

Toutes du cheikh **Mahmoud Khalil al-Husary** (m. 1980), riwâya Hafs 'an 'Âsim.

| Style | Fichiers | Provenance |
|---|---|---|
| Murattal 64 kbps | fournis avec l'application | everyayah.com (Husary_64kbps) |
| Murattal 128 kbps | lus à distance | mirrors.quranicaudio.com (Husary_128kbps) |
| Mu'allim (enseignement) | lus à distance | mirrors.quranicaudio.com (Husary_Muallim_128kbps) |
| Mujawwad (mélodique) | lus à distance | audio-cdn.tarteel.ai |

Usage non commercial. Le murattal 64 et 128 kbps sont **le même
enregistrement** à deux qualités d'encodage (vérifié : durées identiques à
0,10 s près sur huit versets témoins). Le mu'allim est le premier *muṣḥaf
mu'allim* enregistré au monde (1969).

## 6. Surlignage mot à mot

- **Segments temporels de la Quranic Universal Library** (QUL,
  `qul.tarteel.ai`, projet de Tarteel AI), un jeu par style de récitation :
  pour chaque verset, l'instant de début et de fin de chaque mot récité.
- Les jeux publiés dans l'application couvrent les 823 versets, dans les quatre
  styles.

## 7. Règles de tajwid (fiches)

- **Al-Jamzûrî**, *Tuhfat al-Atfâl wa-l-ghilmân fî tajwîd al-Qur'ân* : matn de
  référence pour le noûn sakina, le tanwin, le mîm sakina, les madd.
- **Ibn al-Jazarî** (m. 833 H), *al-Muqaddima al-Jazariyya* : qalqala, lâm du
  nom d'Allah, râ'.
- Les 19 fiches de l'application s'en tiennent au contenu de ces deux matns ;
  chaque exemple cité est vérifié par script comme présent dans le texte
  coranique (`tools/verifie.py`).

## 8. Tutoriels et glossaire

- **Ibn al-Jazarî**, *an-Nashr fî l-qirâ'ât al-'ashr*, tome I, chapitre
  « wa ammâ kayfa yuqra'u l-Qur'ân » (« Comment lit-on le Qur'an ? ») : source
  des définitions du taḥqîq, du ḥadr, du tadwîr et du tartîl, ainsi que des
  entrées du glossaire (le « dû » de chaque lettre, la hamza, la gémination,
  la riwâya). Texte arabe consulté et archivé le 24/07/2026.
- Qur'an 73:4 pour le tartîl, avec les gloses d'**Ibn 'Abbâs** et de
  **Mujâhid** rapportées par Ibn al-Jazarî au même endroit.
- Éléments biographiques sur al-Husary (premières mondiales d'enregistrement) :
  notice biographique du cheikh ; à consolider par une source institutionnelle.

## 9. Notes et cartes des roub'

- **Ibn Kathîr**, *Tafsîr al-Qur'ân al-'aẓîm* : consulté dans son **texte arabe
  intégral** (et non dans son abrégé anglais) pour toute position qui lui est
  attribuée.
- **As-Sa'dî**, *Taysîr al-Karîm ar-Raḥmân fî tafsîr kalâm al-Mannân*.
- **Hadiths** : toujours avec leur collection et, quand elle est connue, leur
  appréciation (par exemple : hadith qudsi de la Fâtiḥa, *Sahih Muslim* 395 ;
  hadith de 'Adî ibn Hâtim, *Sunan at-Tirmidhî* 2954, jugé *hasan gharîb* par
  at-Tirmidhî, également rapporté par Ahmad).
- Les affirmations textuelles (« ce verset est le plus long », « ces deux
  versets sont identiques ») sont vérifiées par script contre le texte
  coranique complet, jamais de mémoire.

## 10. Ce que l'application NE reprend à personne

Le découpage roub' par roub', la notation de difficulté sur cinq étoiles, le
choix des points durs à signaler, l'ordre du parcours de tajwid progressif, la
formulation des cartes et le moteur de révision espacée sont le travail propre
de Roub'. Ce sont des choix pédagogiques, pas des positions savantes, et ils
n'engagent que nous.

---

## Licences

- **Code** : GNU AGPL-3.0 (fichier `LICENSE`).
- **Contenu éditorial de Roub'** : Creative Commons BY-NC-SA 4.0
  (fichier `LICENSE-CONTENU.md`), attribution « Roub', Anis & Yusuf ».
- **Éléments tiers** : chacun conserve ses propres conditions, détaillées
  ci-dessus et dans `LICENSE-CONTENU.md`. En raison de ces conditions,
  l'application est et doit rester **gratuite et non commerciale**.

Une erreur, une source mal citée, un doute : **dev.yusuf@pm.me**.
