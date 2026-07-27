/* quran-hifz : moteur. Les données vivent dans data/ (globals JS), ce fichier
   ne change pas quand on ajoute du contenu. Fonctionne en file:// (partage
   zip) comme derrière serve.py (feedback persisté sur disque). */
"use strict";

/* ---------------- état global ---------------- */
const QURAN = window.QURAN || {};
const META = window.META || { rubs: [] };
const REGLES = window.REGLES || [];
const NOTES = window.NOTES || {};
const CARTES = window.CARTES || {};
const PAGES = window.PAGES || {};   // pagination mushaf de Médine (layout v1, N&B)
const PAGES2 = window.PAGES2 || {}; // layout v2/v4, polices COLRv1 colorées tajwid

const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const store = {
  get(k, dft) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dft; }
    catch (e) { return dft; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

/* Deux axes indépendants depuis la refonte (27/07) :
   - le MODE (clair/sombre) : ce que commande la bascule en haut à droite et le
     lien ?theme=light|dark ; "auto" suit la préférence du système ;
   - le THÈME (Vélin, Ardoise, Colophon) : choisi SÉPARÉMENT pour chaque mode,
     de sorte que la bascule serve la bonne paire sans rien demander.
   L'ancien champ `theme`, qui valait light/dark, est repris par migrerParams()
   pour les réglages déjà enregistrés : il ne faut perdre le choix de personne. */
const PARAMS = Object.assign({
  mode: "auto", themeClair: "velin", themeSombre: "velin",
  police: "auto", anim: "auto", taille: "normale", largeur: "normale",
  translit: "fr", showTl: true, showTr: true,
  taj: true, speed: 1, newLimit: 15, silentMarks: true,
  recitation: "husary64", karaoke: true,
}, store.get("quran-params", {}));

(function migrerParams() {
  /* un réglage enregistré avant la refonte porte `theme: "light"|"dark"` et
     aucun `mode` : c'était un mode, pas un thème. On le convertit une fois. */
  if (PARAMS.theme === "light" || PARAMS.theme === "dark") {
    if (!store.get("quran-params", {}).mode) PARAMS.mode = PARAMS.theme;
    delete PARAMS.theme;
    store.set("quran-params", PARAMS);
  }
})();

/* Affichage du texte arabe :
   - U+0652 (soukoun rond « usuel ») -> U+06E1 (petite tête de khâ'), la
     graphie du soukoun dans le mushaf de Médine ; le rond fermé ۟ (U+06DF)
     reste réservé aux lettres muettes (relevé par Anis, 2026-07-23) ;
   - option silentMarks : masquer les ronds des lettres muettes (redondants
     avec le gris tajwid) ;
   - iqlâb : le mushaf n'AJOUTE pas le petit mîm au tanwîn, il REMPLACE le
     second élément du tanwîn par lui. Vérifié le 2026-07-25 sur la calligraphie
     officielle : 2:41 كَافِرٍۭ porte un seul trait sous le rā' (pas deux) et le
     mîm à côté, 2:10 أَلِيمٌۢ un seul waw (pas deux) et le mîm au-dessus. On
     affiche donc la voyelle SIMPLE plus le mîm, et le mîm prend le côté de la
     voyelle : dessous pour une kasra, dessus pour une fatha ou une damma.
     Bénéfice second : le mîm s'attache enfin. La police n'attache ni le mîm BAS
     U+06ED (qui sortait en cercle pointillé autonome, 13 versets, signalé par
     Yusuf sur 2:41) ni le mîm après un tanwîn, mais bien U+06E2 après une
     voyelle simple.
   Transformation au rendu uniquement : les données et les index de spans
   restent canoniques. */
const VOYELLE_SIMPLE = { "ً": "َ", "ٌ": "ُ", "ٍ": "ِ" };   // U+064B-064D -> U+064E-0650
const MIM_IQLAB = "ۢ";                                    // U+06E2, le seul qui s'attache
function arDisplay(s) {
  s = String(s).replace(/ْ/g, "ۡ");   // vrai soukoun -> chevron médinois (U+06E1)
  // rond muet : la police n'attache pas U+06DF (cercle pointillé de repli),
  // mais son glyphe U+0652 est un rond fermé qui s'attache parfaitement :
  // on l'utilise comme rond muet d'affichage (le vrai soukoun est déjà parti
  // en chevron à la ligne précédente, aucune collision)
  s = PARAMS.silentMarks ? s.replace(/۟/g, "ْ") : s.replace(/۟/g, "");
  // iqlâb : voyelle simple + mîm, comme le mushaf (le mîm tient la place du
  // second élément du tanwîn), et le mîm s'attache du bon côté tout seul
  s = s.replace(/([ًٌٍ])[ۭۢ]/g, (m, t) => VOYELLE_SIMPLE[t] + MIM_IQLAB);
  return s;
}
const arEsc = s => esc(arDisplay(s));
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
function saveParams() { store.set("quran-params", PARAMS); applyTheme(); }

/* Le mode réellement affiché : le choix explicite s'il existe, sinon le
   système. Ordre de préséance complet, du plus fort au plus faible :
   ?theme= dans l'URL > réglage enregistré > prefers-color-scheme > clair. */
function modeEffectif() {
  return PARAMS.mode === "light" || PARAMS.mode === "dark"
    ? PARAMS.mode
    : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function themeEffectif() {
  return modeEffectif() === "dark" ? PARAMS.themeSombre : PARAMS.themeClair;
}
/* Le nom reste `applyTheme` : il est appelé depuis plusieurs endroits, et le
   renommer n'apporterait rien. Il pose désormais DEUX attributs. */
function applyTheme() {
  const r = document.documentElement;
  /* data-mode n'est posé QUE s'il est explicite : absent, la feuille suit
     prefers-color-scheme d'elle-même, donc le premier rendu est déjà juste,
     avant même que ce script ne s'exécute. Le poser systématiquement ferait
     clignoter la page au chargement. */
  if (PARAMS.mode === "light" || PARAMS.mode === "dark") r.setAttribute("data-mode", PARAMS.mode);
  else r.removeAttribute("data-mode");
  r.setAttribute("data-theme", themeEffectif());
  r.setAttribute("data-anim", PARAMS.anim || "auto");
  /* "auto" ne pose aucune surcharge : la police reste celle du thème. Comme
     pour le mode et les animations, on n'écrit JAMAIS dans `store` la valeur
     résolue, sinon on fige un choix que personne n'a fait. */
  r.setAttribute("data-police", PARAMS.police || "auto");
  /* deux réglages de confort, locaux comme tous les autres (la synchro ne
     transporte que la progression) : la taille agit sur la RACINE, donc sur
     tous les corps en rem à la fois, ce qui préserve les rapports entre
     titres et texte calés par la direction artistique. */
  r.setAttribute("data-taille", PARAMS.taille || "normale");
  r.setAttribute("data-largeur", PARAMS.largeur || "normale");
}
/* en mode « suivre le système », un basculement de l'OS doit changer le mode ET
   le thème associé, sans recharger */
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (PARAMS.mode !== "light" && PARAMS.mode !== "dark") { applyTheme(); render(); }
});

/* index des versets toutes roub' confondues */
const VIDX = {};
for (const rid of Object.keys(QURAN)) {
  QURAN[rid].verses.forEach((v, i) => { VIDX[v.k] = { v, rid, i }; });
}
const RUBS = (META.rubs || []).slice().sort((a, b) => a.rubGlobal - b.rubGlobal);
/* noms de sourates : dérivés des données, avec glose pour les premières */
const SURAH_NAMES = {};
for (const rid of Object.keys(QURAN)) {
  for (const s of (QURAN[rid].surahs || [])) SURAH_NAMES[s.num] = s.nom;
}
SURAH_NAMES[1] = "Al-Fâtiḥa (L'Ouverture)";
SURAH_NAMES[2] = "Al-Baqara (La Vache)";
/* la basmala ouvre chaque sourate sauf la Fâtiḥa (verset 1) et At-Tawba */
const basmalaFor = v => v.a === 1 && v.s !== 1 && v.s !== 9;

/* paquets de cartes : enchaînement + vocabulaire DÉRIVÉS des données,
   mutashabihat / sens rédigés à la main dans data/cartes/. Même dérivation
   dans tools/build_apkg.py : garder les deux en phase. */
const DECKS = {};
for (const rid of Object.keys(QURAN)) {
  const list = [];
  const vv = QURAN[rid].verses;
  for (let i = 0; i < vv.length - 1; i++) {
    if (vv[i].s === vv[i + 1].s) {
      list.push({ id: "ch-" + vv[i].k, type: "chain", from: vv[i].k, to: vv[i + 1].k });
    }
  }
  for (const w of ((NOTES[rid] || {}).vocab || [])) {
    list.push({ id: "vb-" + rid + "-" + w.ar, type: "vocab",
      ar: w.ar, sci: w.sci, fr: w.fr, sens: w.sens, refs: w.refs || [] });
  }
  for (const c of (CARTES[rid] || [])) list.push(c);
  DECKS[rid] = list;
}

/* ---------------- auto-évaluation par verset (Lot G) ---------------- */
/* {verseKey: {n: 1|2|3, note?, ts}} : 1 = à revoir, 2 = fragile, 3 = solide */
const EVAL_KEY = "quran-eval";
const EVAL = store.get(EVAL_KEY, {});
const EVAL_LABELS = ["non évalué", "à revoir", "fragile", "solide"];
function evalCycle(k) {
  const cur = (EVAL[k] || {}).n || 0;
  const next = (cur + 1) % 4;
  if (next === 0) delete EVAL[k];
  else EVAL[k] = Object.assign(EVAL[k] || {}, { n: next, ts: Date.now() });
  store.set(EVAL_KEY, EVAL);
  schedulePush();
  return next;
}
function evalNote(k) {
  const cur = EVAL[k];
  if (!cur) { alert("Choisis d'abord un niveau (clic sur la pastille)."); return; }
  const note = prompt(`Note sur ${k} (auto-évaluation « ${EVAL_LABELS[cur.n]} ») :`, cur.note || "");
  if (note === null) return;
  cur.note = note.trim();
  cur.ts = Date.now();
  store.set(EVAL_KEY, EVAL);
  schedulePush();
}
function weakSet() {
  const s = new Set();
  for (const k of Object.keys(EVAL)) if (EVAL[k].n === 1 || EVAL[k].n === 2) s.add(k);
  return s;
}
function evalBtn(k, extra) {
  const n = (EVAL[k] || {}).n || 0;
  return `<button class="evalbtn e${n}" data-eval="${k}"
    title="auto-évaluation : ${EVAL_LABELS[n]} (clic pour changer)">●</button>` +
    (extra && n ? `<button class="evalnote" data-eval-note="${k}" title="note personnelle">✎</button>` : "");
}

/* ---------------- SRS (SM-2 allégé) ---------------- */
const SRS_KEY = "quran-srs";
const SRS = store.get(SRS_KEY, {});

/* journal agrégé par jour (streak + progression, Lot E) */
const JOURNAL_KEY = "quran-journal";
function logAnswer(grade) {
  const j = store.get(JOURNAL_KEY, {});
  const day = new Date().toISOString().slice(0, 10);
  const d = j[day] || { n: 0, again: 0 };
  d.n++;
  if (grade === "again") d.again++;
  j[day] = d;
  store.set(JOURNAL_KEY, j);
}
function streak() {
  const j = store.get(JOURNAL_KEY, {});
  let n = 0;
  const day = new Date();
  // aujourd'hui compte s'il y a eu des révisions ; sinon on part d'hier
  if (!j[day.toISOString().slice(0, 10)]) day.setDate(day.getDate() - 1);
  while (j[day.toISOString().slice(0, 10)]) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}
const MATURE_DAYS = 21;
function progressOf(cards) {
  let seen = 0, mature = 0, matureChains = 0, chains = 0;
  for (const c of cards) {
    const s = SRS[c.id];
    const isSeen = s && s.reps > 0;
    const isMature = s && s.iv >= MATURE_DAYS;
    if (isSeen) seen++;
    if (isMature) mature++;
    if (c.type === "chain") {
      chains++;
      if (isMature) matureChains++;
    }
  }
  return { total: cards.length, seen, mature, chains, matureChains };
}
function srsState(id) {
  return SRS[id] || { iv: 0, ease: 2.5, due: null, reps: 0, lapses: 0 };
}
function srsAnswer(id, grade) {
  const s = srsState(id);
  const now = Date.now(), day = 86400e3;
  if (grade === "again") {
    s.ease = Math.max(1.3, s.ease - 0.2);
    if (s.reps > 0) s.lapses++;
    s.iv = 0; s.due = now + 60e3;
  } else if (grade === "hard") {
    s.ease = Math.max(1.3, s.ease - 0.15);
    s.iv = s.iv ? Math.max(1, s.iv * 1.2) : 1;
    s.due = now + s.iv * day;
  } else if (grade === "good") {
    s.iv = s.iv ? s.iv * s.ease : 1;
    s.due = now + s.iv * day;
  } else {
    s.ease += 0.15;
    s.iv = s.iv ? s.iv * s.ease * 1.3 : 2.5;
    s.due = now + s.iv * day;
  }
  s.reps++;
  SRS[id] = s; store.set(SRS_KEY, SRS);
  logAnswer(grade);
  schedulePush();
}
function deckStats(cardIds) {
  const now = Date.now();
  let due = 0, fresh = 0;
  for (const id of cardIds) {
    const s = SRS[id];
    if (!s || s.due == null) fresh++;
    else if (s.due <= now) due++;
  }
  return { due, fresh };
}

/* ---------------- audio ---------------- */
/* styles de récitation (Mahmoud Khalil Al-Husary) : le murattal 64 kbps est
   fourni avec l'appli (donc présent aussi en copie locale) ; les autres sont lus depuis
   leur source d'origine et mis en cache par le service worker au fil de
   l'écoute. Chaque style a ses propres segments mot à mot (data/segments/). */
const RECITS = {
  husary64: { nom: "Murattal 64 kbps (fourni avec l'appli)",
    url: f => "audio/" + f, local: true },
  husary128: { nom: "Murattal 128 kbps (même récitation, son plus net)",
    url: f => "https://mirrors.quranicaudio.com/everyayah/Husary_128kbps/" + f },
  muallim: { nom: "Muallim (lecture d'enseignement, lente)",
    url: f => "https://mirrors.quranicaudio.com/everyayah/Husary_Muallim_128kbps/" + f },
  mujawwad: { nom: "Mujawwad (lecture mélodique)",
    url: f => "https://audio-cdn.tarteel.ai/quran/husaryMujawwad/" + f },
};
const recitKey = () => RECITS[PARAMS.recitation] ? PARAMS.recitation : "husary64";
const audioUrl = f => RECITS[recitKey()].url(f);
/* le soulignage suit le fichier RÉELLEMENT joué : en cas de repli sur la
   récitation fournie avec l'appli, ce n'est pas le style choisi */
const segsOf = key =>
  ((window.SEGMENTS || {})[(player && player.styleAudio) || recitKey()] || {})[key] || null;
/* départ de lecture au mot visé (double-clic) : les segments donnent l'instant
   d'attaque du mot, on recule d'un cheveu pour ne pas rogner sa première lettre.
   On cherche le segment par l'index de mot qu'il DÉCLARE (champ 0), jamais par
   sa position dans la liste : un même mot peut avoir plusieurs segments quand le
   récitateur le répète (courant en muallim). En cas d'index absent (3 versets
   connus sur les 4 styles, cf. verifie.py section J), on part du mot connu le
   plus proche avant celui visé. */
const MARGE_MOT = 60;
function motDebutMs(key, mot) {
  if (!(mot > 0)) return 0;
  const sg = segsOf(key);
  if (!sg || !sg.length) return 0;
  let s = null;
  for (const seg of sg) {
    if (seg[0] === mot) { s = seg; break; }                 // 1re occurrence du mot
    if (seg[0] < mot && (!s || seg[0] > s[0])) s = seg;     // repli
  }
  return s ? Math.max(0, s[2] - MARGE_MOT) : 0;
}
/* mot visé par un clic : .wd en mode texte, .qw sur les pages du mushaf */
function motDe(cible) {
  const el = cible && cible.closest ? cible.closest("[data-w]") : null;
  return el ? +el.dataset.w : 0;
}

const player = {
  el: new Audio(),
  queue: [], qi: 0, rep: 1, repLeft: 1, loopRange: false, playing: false,
  mot: 0, depart: 0,          // départ au milieu d'un verset (double-clic sur un mot)
  /* defiler = false quand la lecture part d'un clic sur le verset lui-même :
     il est déjà sous les yeux, et le recentrer ferait fuir la cible entre les
     deux clics d'un double-clic (le second tombait à côté, d'où « ne lit qu'un
     verset »). L'enchaînement automatique, lui, défile toujours. */
  play(list, start, defiler = true, mot = 0) {
    this.queue = list; this.qi = start || 0;
    this.repLeft = this.rep; this.playing = true;
    this._launch(defiler, mot);
  },
  /* second clic sur un mot : enchaîner à partir de CE MOT, puis dérouler la
     suite du roub'. Si le verset est déjà en cours (le premier clic vient de le
     lancer), on remplace la file et on déplace la tête de lecture sans toucher
     à la source : aucun rechargement, aucun redémarrage audible. */
  enchaine(list, i, mot) {
    if (this.playing && this.curKey === list[i].k && !this.el.paused) {
      this.queue = list; this.qi = i; this.repLeft = this.rep;
      this.mot = mot | 0;
      const ms = motDebutMs(list[i].k, this.mot);
      this.depart = ms / 1000;
      if (ms) this.el.currentTime = this.depart;
      updateAudioBar();
      return;
    }
    this.play(list, i, false, mot);
  },
  _launch(defiler = true, mot = 0) {
    if (!this.queue.length || this.qi >= this.queue.length) { this.stop(); return; }
    const item = this.queue[this.qi];
    this.curKey = item.k;
    this.repli = false;              // chaque verset retente le style choisi
    this.styleAudio = null;
    this.el.src = audioUrl(item.audio);
    this.el.playbackRate = PARAMS.speed;
    /* départ au milieu du verset : tant que les métadonnées ne sont pas là,
       currentTime fixe la position de départ par défaut ; loadedmetadata la
       réapplique si le navigateur ne l'a pas retenue */
    this.mot = mot | 0;
    this.depart = motDebutMs(item.k, this.mot) / 1000;
    if (this.depart) this.el.currentTime = this.depart;
    // stop() d'abord : il repeint la barre, le message doit venir après
    this.el.play().catch(err => this.echecLecture(err));
    highlightVerse(item.k, defiler);
    updateAudioBar();
  },
  next() {
    if (this.repLeft > 1) { this.repLeft--; this._launch(); return; }
    this.qi++;
    this.repLeft = this.rep;
    if (this.qi >= this.queue.length) {
      if (this.loopRange && this.queue.length) { this.qi = 0; }
      else { this.stop(); return; }
    }
    this._launch();
  },
  toggle() {
    if (!this.playing) return;
    if (this.el.paused) this.el.play(); else this.el.pause();
    updateAudioBar();
  },
  /* play() est rejeté dans des cas parfaitement normaux : lecture interrompue
     par un autre verset, un changement de réglage ou un re-rendu (AbortError).
     Seule une vraie panne de chargement mérite un message. */
  echecLecture(err) {
    if (err && err.name === "AbortError") return;
    if (err && err.name === "NotAllowedError") {
      this.stop();
      const now = $("#audio-now");
      if (now) now.textContent = "touche « ▶ » pour lancer la lecture";
      return;
    }
    /* un style distant peut manquer à l'appel (réseau capricieux, source
       momentanément injoignable) : plutôt que d'arrêter, on bascule sur la
       récitation fournie avec l'appli, qui est toujours là */
    const item = this.queue[this.qi];
    if (item && !this.repli && !RECITS[recitKey()].local) {
      this.repli = true;
      this.styleAudio = "husary64";        // le soulignage suit le fichier joué
      this.el.src = RECITS.husary64.url(item.audio);
      /* le repli change de découpage : recalculer le départ sur ces segments */
      this.depart = motDebutMs(item.k, this.mot) / 1000;
      if (this.depart) this.el.currentTime = this.depart;
      this.el.play().then(() => {
        const now = $("#audio-now");
        if (now) {
          now.textContent = `${item.k} · source injoignable : lecture avec le murattal 64 kbps`;
          now.classList.add("audio-repli");
        }
      }).catch(e2 => { this.stop(); audioIndispo(); });
      return;
    }
    this.stop();
    audioIndispo();
  },
  stop() {
    this.playing = false;
    this.curKey = null;
    this.repli = false;
    this.styleAudio = null;
    this.mot = 0; this.depart = 0;
    this.el.pause();
    highlightVerse(null);
    clearWords();
    updateAudioBar();
  },
};
player.el.addEventListener("ended", () => player.next());
/* certains navigateurs oublient la position demandée avant le chargement */
player.el.addEventListener("loadedmetadata", () => {
  if (player.depart && player.el.currentTime < player.depart - 0.15)
    player.el.currentTime = player.depart;
});

/* soulignage mot à mot : les segments donnent [i_mot, i_fin, début_ms, fin_ms] ;
   un timer plutôt que timeupdate (déclenché trop rarement : ~4 fois/seconde) */
let wordTimer = null;
const KARAOKE_LEAD = 70;   // ms d'avance sur le temps audio (voir wordTick)

/* ---- défilement piloté par l'application ----------------------------------
   Deux choses défilent la page toutes seules : le passage au verset suivant et
   le suivi du mot récité. Il faut pouvoir les distinguer d'un geste de
   l'utilisateur (la barre du haut se replie au geste, pas au défilement
   automatique). D'où un marqueur de FIN et non d'instant : un défilement doux
   dure, le marqueur doit couvrir toute sa durée. */
let defilementAutoJusqua = 0;
function defilementEstAuto() { return Date.now() < defilementAutoJusqua; }
function defilerVers(y, duree = 900) {
  defilementAutoJusqua = Date.now() + duree;
  window.scrollTo({
    top: Math.max(0, y),
    behavior: mouvementReduit() ? "auto" : "smooth",
  });
}
const MARGE_HAUT = 72;     // barre du haut + un peu d'air

/* suivi du mot à l'intérieur d'un verset : on ne recentre PAS à chaque mot,
   l'écran tremblerait et deviendrait illisible. On ne bouge que si le mot sort
   d'une zone de confort, et on le repose alors un peu au-dessus du milieu. */
const ZONE_HAUTE = .28, ZONE_BASSE = .72, CIBLE_MOT = .42;
function suivreMot(el) {
  /* un défilement est déjà en vol (changement de verset, ou mot précédent) :
     ne pas lui courir après, les deux se battraient */
  if (!el || defilementEstAuto()) return;
  const r = el.getBoundingClientRect(), h = window.innerHeight;
  const y = r.top + r.height / 2;
  if (y >= h * ZONE_HAUTE && y <= h * ZONE_BASSE) return;
  defilerVers(window.scrollY + y - h * CIBLE_MOT, 500);
}
let motSuivi = -1;

/* ---- repli de la barre du haut --------------------------------------------
   Règle sous-jacente : ce qu'on touche en lisant reste en bas, ce qu'on ne
   touche pas se replie. La barre du haut part donc ENTIÈRE, logo compris ; un
   bandeau résiduel coûterait sa hauteur en permanence pour porter une identité
   et une bascule qui sont déjà ailleurs.

   Tout est piloté par les jetons de la direction artistique : ils valent 0 en
   large, ce qui éteint le repli sans qu'aucun test de largeur ne traîne ici.
   Les relire à chaque événement de défilement coûterait un calcul de style par
   image, d'où le cache et sa péremption au redimensionnement. */
const JETONS_CHROME = { pin: 0, cacher: 0, montrer: 0 };
function relireJetonsChrome() {
  const cs = getComputedStyle(document.documentElement);
  const px = n => parseFloat(cs.getPropertyValue(n)) || 0;
  JETONS_CHROME.pin = px("--topbar-pin-until");
  JETONS_CHROME.cacher = px("--topbar-hide-after");
  JETONS_CHROME.montrer = px("--topbar-show-after");
}

/* le réglage explicite l'emporte sur le système, dans les deux sens ; c'est la
   même mécanique que le thème, et elle sert aussi le défilement de suivi */
function mouvementReduit() {
  if (PARAMS.anim === "complete") return false;
  if (PARAMS.anim === "reduite") return true;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let dernierY = 0, cumulDefilement = 0, sensDefilement = 0, topbarRepliee = false;
function poserTopbar(replie) {
  if (topbarRepliee === replie) return;
  topbarRepliee = replie;
  document.documentElement.classList.toggle("topbar-repliee", replie);
}
function surDefilement() {
  const y = Math.max(0, window.scrollY);
  const d = y - dernierY;
  dernierY = y;   // toujours, sinon la reprise après un défilement automatique
                  // compterait tout le trajet parcouru comme un geste

  /* repli éteint : en large, ou quand un mouvement réduit est demandé. Une
     barre qui saute sans transition est pire qu'une barre fixe, et les 56 px
     de --topbar-h sont alors le prix assumé de la préférence. */
  if (!JETONS_CHROME.cacher || mouvementReduit()) { poserTopbar(false); cumulDefilement = 0; return; }

  /* 1. près du haut : posée, sans condition */
  if (y <= JETONS_CHROME.pin) { poserTopbar(false); cumulDefilement = 0; sensDefilement = 0; return; }

  /* en bout de page, la barre revient. Placé avant la lecture du sens pour que
     le rebond élastique de fin de liste ne soit pas compté comme un geste vers
     le haut, ce qu'il n'est pas. */
  const restant = document.documentElement.scrollHeight - window.innerHeight - y;
  if (restant <= 2) { poserTopbar(false); cumulDefilement = 0; sensDefilement = 0; return; }

  /* le suivi de récitation défile lui aussi : il n'alimente PAS le compteur, et
     surtout il ne le remet pas à zéro — sinon un verset long annulerait un
     repli déjà acquis. Le chrome répond au pouce, jamais au lecteur. */
  if (!d || defilementEstAuto()) return;

  /* 4. tout changement de sens repart de zéro : l'écart entre les deux seuils
     est l'hystérésis, sans laquelle la barre bat au tremblement du pouce */
  const sens = d > 0 ? 1 : -1;
  if (sens !== sensDefilement) { sensDefilement = sens; cumulDefilement = 0; }
  cumulDefilement += Math.abs(d);

  /* 2. et 3. : les seuils, volontairement asymétriques */
  if (sens > 0) { if (cumulDefilement >= JETONS_CHROME.cacher) poserTopbar(true); }
  else if (cumulDefilement >= JETONS_CHROME.montrer) poserTopbar(false);
}
/* La barre du haut porte un backdrop-filter, et une transformation dès qu'elle
   se replie : l'un comme l'autre font d'elle le BLOC CONTENEUR de ses
   descendants en position fixed. Une navigation écrite dans la barre mais fixée
   en bas se retrouve donc collée sous le logo (constaté le 27/07). On déplace
   le nœud au lieu de le dupliquer : les écouteurs le suivent, l'état actif
   reste à un seul endroit, et c'est le CSS qui décide, par --navbar-h, où il
   doit vivre — aucun point de rupture n'est recopié ici. */
function placerNav() {
  const nav = $(".nav"), bar = $(".topbar");
  if (!nav || !bar) return;
  const enBas = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--navbar-h")) > 0;
  const cible = enBas ? document.body : bar;
  if (nav.parentElement === cible) return;
  if (enBas) document.body.appendChild(nav);
  else bar.insertBefore(nav, $(".spacer", bar));
}

relireJetonsChrome();
placerNav();
addEventListener("scroll", surDefilement, { passive: true });
addEventListener("resize", () => { relireJetonsChrome(); placerNav(); surDefilement(); });

function clearWords() {
  $$(".wd.on, .wd.done").forEach(el => el.classList.remove("on", "done"));
  motSuivi = -1;
}
function wordTick() {
  if (!PARAMS.karaoke || !player.curKey || player.el.paused) return;
  const sg = segsOf(player.curKey);
  if (!sg) return;
  /* petite avance : le temps que le mot s'allume et que l'œil le voie, la
     syllabe est déjà commencée ; 70 ms recale le ressenti sans anticiper */
  const t = player.el.currentTime * 1000 + KARAOKE_LEAD;
  /* mot courant = dernier mot commencé, désigné par l'index que le segment
     DÉCLARE : si le récitateur revient en arrière pour répéter (muallim), le
     soulignage le suit. Les silences entre deux mots ne sont pas couverts par
     les segments : garder le mot précédent évite un clignotement à chaque blanc */
  let cur = -1;
  for (let i = 0; i < sg.length; i++) if (t >= sg[i][2]) cur = sg[i][0];
  const els = $$(`.verse[data-k="${player.curKey}"] .wd, .mver[data-k="${player.curKey}"] .wd`);
  let elCourant = null;
  els.forEach(el => {
    const w = +el.dataset.w;
    const on = w === cur;
    if (on) elCourant = el;
    el.classList.toggle("on", on);
    el.classList.toggle("done", w < cur);
  });
  /* au CHANGEMENT de mot seulement, pas aux 40 ms : un verset plus haut que
     l'écran sortait du champ sans que rien ne bouge jusqu'au verset suivant */
  if (cur !== motSuivi) { motSuivi = cur; suivreMot(elCourant); }
}
player.el.addEventListener("play", () => {
  clearInterval(wordTimer);
  wordTimer = setInterval(wordTick, 40);
});
player.el.addEventListener("pause", () => clearInterval(wordTimer));
player.el.addEventListener("ended", () => { clearInterval(wordTimer); clearWords(); });

function highlightVerse(key, defiler = true) {
  $$(".verse.playing, .mver.playing, .qw.playing").forEach(el => el.classList.remove("playing"));
  clearWords();
  if (!key) return;
  const els = $$(`.verse[data-k="${key}"], .mver[data-k="${key}"], .qw[data-k="${key}"]`);
  els.forEach(el => el.classList.add("playing"));
  if (els[0] && defiler) {
    const r = els[0].getBoundingClientRect(), h = window.innerHeight;
    /* un verset PLUS HAUT que l'écran ne se centre pas : le centrer poserait ses
       premiers mots au-dessus du bord, et on commencerait à lire au milieu.
       On l'aligne alors en haut, sous la barre ; le suivi du mot fera le reste. */
    defilerVers(r.height > h * .9
      ? window.scrollY + r.top - MARGE_HAUT
      : window.scrollY + r.top - (h - r.height) / 2);
  }
}
/* un style de récitation non embarqué peut manquer (hors connexion, source
   indisponible) : le dire, au lieu de s'arrêter sans explication */
function audioIndispo() {
  const local = RECITS[recitKey()].local;
  const horsLigne = navigator.onLine === false;
  const msg = local
    ? "audio indisponible : fichier manquant"
    : `récitation « ${RECITS[recitKey()].nom} » indisponible `
      + (horsLigne ? "hors connexion"
         : "(source injoignable, ou bloquée par un bloqueur de publicités)")
      + " · Paramètres → Précharger, ou choisis le murattal 64 kbps";
  const now = $("#audio-now");
  if (now) { now.textContent = msg; now.classList.add("audio-ko"); }
  else alert(msg);
  setTimeout(() => { if (now) now.classList.remove("audio-ko"); }, 8000);
}

function playOneShot(audio, key) {
  player.stop();
  player.curKey = key || null;
  player.el.src = audioUrl(audio);
  player.el.playbackRate = PARAMS.speed;
  player.el.play().catch(err => player.echecLecture(err));
  player.playing = false;
  if (key) highlightVerse(key);
}

/* ---------------- feedback ---------------- */
const API_FB = location.protocol.startsWith("http") ? "../api/feedback" : null;
let FB = store.get("quran-fb", {});
async function fetchFB() {
  if (!API_FB) return;
  try {
    const r = await fetch(API_FB, { cache: "no-store" });
    if (r.ok) { FB = Object.assign({}, FB, await r.json()); store.set("quran-fb", FB); }
  } catch (e) {}
}
async function sendFB(entry) {
  FB[entry.id] = entry; store.set("quran-fb", FB);
  if (!API_FB) return false;
  try {
    const r = await fetch(API_FB, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    return r.ok;
  } catch (e) { return false; }
}

function exportFB() {
  const saisie = prompt("Ton prénom (pour identifier ton fichier d'avis) :") || "anonyme";
  const nom = saisie.trim() || "anonyme";
  const slug = nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "anonyme";
  const data = {
    exportePar: nom,
    date: new Date().toISOString().slice(0, 16).replace("T", " "),
    avis: FB,
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `avis-roub-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return data;
}

/* ---------------- rendu : helpers ---------------- */
function starsHtml(n) {
  let h = "";
  for (let i = 1; i <= 5; i++) h += `<span class="${i <= n ? "" : "off"}">★</span>`;
  return `<span class="stars" title="difficulté ${n}/5 (échelle : tout le Qur'an)">${h}</span>`;
}
/* marques de pause : elles occupent un « mot » dans le texte mais ne sont pas
   récitées, donc elles ne comptent pas dans l'index des segments audio */
const PAUSES = "ۖۗۘۙۚۛۜ۞۩";
const estPause = w => [...w].every(c => PAUSES.includes(c));

/* rendu d'une tranche avec ses classes tajwid (une classe par caractère) */
function tajChunk(s, from, to, cls) {
  if (!cls) return arEsc(s.slice(from, to));
  let out = "", i = from;
  while (i < to) {
    const c = cls[i];
    let j = i + 1;
    while (j < to && cls[j] === c) j++;
    const txt = arEsc(s.slice(i, j));
    out += c ? `<span class="tj-${c}">${txt}</span>` : txt;
    i = j;
  }
  return out;
}

/* chaque mot récité est encapsulé (data-w = index dans les segments audio) :
   c'est le support du soulignage mot à mot pendant la récitation */
/* `seule` : ne colorer QUE cette classe de portée, tout le reste en encre
   neutre. C'est ce qui permet à un exemple d'ISOLER la règle dont il parle
   (exigence de Yusuf, 28/07). L'alternative, chercher un verset pauvre en
   règles, a été mesurée et ne suffit pas : sur le roub' 1, le meilleur candidat
   pour la qalqala porte encore quatre autres couleurs sur 109 signes. Ici on ne
   dépend plus du verset, puisque les portées déclarent leurs positions exactes.
   Le réglage « Couleurs tajwid » reste souverain : s'il est coupé, l'exemple ne
   colore rien non plus, on ne va pas contredire un choix explicite. */
function arHtml(v, seule) {
  const portees = seule && v.taj ? v.taj.filter(([, , c]) => c === seule) : v.taj;
  const taj = PARAMS.taj && portees && portees.length ? portees : null;
  let cls = null;
  if (taj) {
    cls = new Array(v.ar.length).fill(null);
    for (const [st, en, c] of taj) for (let i = st; i < en; i++) cls[i] = c;
  }
  let out = "", wi = 0, last = 0, m;
  const re = /\S+/g;
  while ((m = re.exec(v.ar))) {
    if (m.index > last) out += arEsc(v.ar.slice(last, m.index));
    const inner = tajChunk(v.ar, m.index, m.index + m[0].length, cls);
    out += estPause(m[0]) ? `<span class="wpause">${inner}</span>`
                          : `<span class="wd" data-w="${wi++}">${inner}</span>`;
    last = m.index + m[0].length;
  }
  if (last < v.ar.length) out += arEsc(v.ar.slice(last));
  return out;
}
function tlOf(v) { return PARAMS.translit === "sci" ? v.sci : v.fr; }
function vrefBtn(key) {
  return `<span class="vref" data-goto="${key}">${key}</span>`;
}

/* ---------------- navigation ---------------- */
function nav(hash) { location.hash = hash; }

/* SEUL ce chemin est animé, et c'est le point le plus important de tout le
   mouvement. `render()` est appelé depuis une vingtaine d'endroits dont la
   plupart ne sont PAS des navigations : puces d'options, enregistrement d'un
   réglage, dévoilement d'une carte, bascule de thème — et surtout `fetchFB()`
   et `syncPull()`, qui se déclenchent SEULS quand la réponse arrive. Poser la
   transition sur `render()` ferait donc clignoter l'écran entier à chaque clic
   sur une puce, et tout seul pendant qu'on lit. Les navigations, elles, passent
   toutes par `hashchange` et rien d'autre n'y passe : c'est la couture propre.
   Les durées, la courbe et le déplacement viennent des jetons de la direction
   artistique ; sous mouvement réduit ils valent 80 ms et 0 px, ce qui laisse un
   fondu net au lieu de supprimer la transition — c'est ce qui est demandé. */
window.addEventListener("hashchange", () => {
  if (!document.startViewTransition) {
    /* repli : sans l'API, l'ancien écran ne peut pas être photographié, donc
       pas de sortie. On anime la seule entrée, par une classe sur #main. */
    renderNavigation();
    const m = $("#main");
    m.classList.remove("ecran-entre");
    void m.offsetWidth;            // force le redémarrage de l'animation
    m.classList.add("ecran-entre");
    /* la retirer une fois jouée : `#main` survit aux rendus, une classe
       oubliée dessus resterait à vie et brouillerait toute mesure ultérieure */
    m.addEventListener("animationend", () => m.classList.remove("ecran-entre"), { once: true });
    return;
  }
  document.startViewTransition(renderNavigation);
});

function route() {
  const h = (location.hash || "#home").slice(1);
  const parts = h.split("/");
  return { page: parts[0] || "home", a: parts[1], b: parts[2], c: parts[3] };
}

function render() {
  const { page, a, b } = route();
  player.stop();
  $$(".nav button").forEach(btn =>
    btn.classList.toggle("on", btn.dataset.page === page));
  const main = $("#main");
  const { c } = route();
  // lien profond optionnel vers un mode d'affichage : #rub/j1r1/memoriser/pages
  if (page === "rub" && c) {
    if (["versets", "continu", "pages"].includes(c)) memoState.mode = c;
    if (c === "pagescouleur") { memoState.mode = "pages"; memoState.pagesColor = true; }
  }
  if (page === "rub" && QURAN[a]) main.innerHTML = pageRub(a, b || "memoriser");
  else if (page === "revision") main.innerHTML = pageRevision();
  else if (page === "tutoriels") main.innerHTML = pageTutoriels(a || "translit");
  else if (page === "params") main.innerHTML = pageParams();
  else if (page === "sources") main.innerHTML = pageSources();
  else main.innerHTML = pageHome();
  /* les pages de lecture suivie resserrent leur cadre autour de la colonne ;
     les autres, qu'on balaie, gardent toute la largeur (cf. styles.css) */
  main.classList.toggle("page-lecture", page === "tutoriels" || page === "sources");
  bindMain();
  verifierPolicesPages();
}

/* ⚠ Remonter en haut appartient à la NAVIGATION, pas au rendu. C'était dans
   `render()`, donc changer de thème dans Paramètres renvoyait en haut de page
   alors qu'on venait de descendre pour trouver le réglage (signalé par Yusuf le
   28/07). Or `render()` est appelé par une vingtaine de choses qui ne sont pas
   des navigations : puces d'options, réglages, et jusqu'au retour de la
   synchro, qui aurait donc pu remonter la page tout seul en pleine lecture.
   C'est exactement la couture déjà retenue pour les animations : seul
   `hashchange` est une navigation. La barre du haut suit la même règle, sinon
   elle se redéploierait à chaque réglage. */
function renderNavigation() {
  render();
  window.scrollTo(0, 0);
  dernierY = 0; cumulDefilement = 0; sensDefilement = 0;
  poserTopbar(false);
}

/* les pages du mushaf sont dessinées par des polices chargées à la demande :
   hors connexion et sans préchargement, elles s'affichent VIDES. On le dit. */
async function verifierPolicesPages() {
  const page = $(".qpage");
  if (!page || !document.fonts) return;
  const ligne = page.querySelector(".qline");
  if (!ligne) return;
  const fam = getComputedStyle(ligne).fontFamily.replace(/["']/g, "").split(",")[0].trim();
  try { await document.fonts.load(`24px "${fam}"`); } catch (e) { /* échec = non chargée */ }
  if (document.fonts.check(`24px "${fam}"`)) return;
  if ($(".pages-ko")) return;
  const avis = document.createElement("div");
  avis.className = "pages-ko";
  avis.textContent = "Les polices de ces pages ne sont pas encore sur cet appareil "
    + "et ne peuvent pas être chargées maintenant : reviens en ligne, ou "
    + "précharge « Pages du mushaf » dans Paramètres. Les autres affichages "
    + "(versets, texte continu) fonctionnent hors connexion.";
  page.parentNode.insertBefore(avis, page);
}

/* ---------------- accueil ---------------- */
/* bloc d'accueil : ce que le LISEZMOI disait, mais là où on le lit vraiment.
   Replié après la première visite ; les sources et licences complètes restent
   dans Paramètres (pas de doublon : ici l'essentiel, là-bas le détail). */
function accueilHtml() {
  const vu = store.get("quran-accueil-vu", false);
  return `<details class="accueil" ${vu ? "" : "open"}>
    <summary>Bienvenue · comment ça marche, qui écrit, quelles sources</summary>
    <div class="accueil-corps">
      <p><b>Comment ça marche.</b> Choisis un roub' ci-dessous : l'onglet
      <b>Mémoriser</b> affiche le texte (versets, texte continu ou pages exactes
      du mushaf) avec l'audio et le soulignage mot à mot, et l'onglet
      <b>Tafsir</b> le commentaire verset par verset. Les 24 roub' sont tous
      ouverts ; les notes rédigées (points durs, particularités tajwid,
      vocabulaire, cartes) existent pour le roub' 1, et ailleurs ces onglets
      affichent « contenu à venir » : c'est ce que signale le badge
      <i>notes à venir</i> de l'accueil, qui disparaîtra roub' par roub' à
      mesure de leur rédaction. L'onglet <b>Révision</b> fait revenir les cartes à
      intervalle croissant, et exporte tout pour Anki.</p>
      <p><b>Qui écrit.</b> <b>Anis</b> (co-fondateur, docteur en mathématiques) :
      à l'origine de la méthode. <b>Yusuf</b> (co-fondateur, interne en
      médecine) : conception et réalisation. <b>Israa</b> (ostéopathe) :
      conseillère pédagogique. Contact et avis :
      <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>.</p>
      <p><b>Sources.</b> Texte du mushaf de Médine (Complexe du Roi Fahd),
      traduction Hamidullah, récitation Al-Husary, tafsir verset par verset
      <i>al-Mukhtaṣar</i> (Tafsir Center, via QuranEnc.com), règles de tajwid
      d'après Tuhfat al-Atfâl et al-Muqaddima al-Jazariyya. Tout le contenu
      religieux est sourcé et vérifié ; une erreur reste possible, signale-la.
      <span class="vref" data-goto-page="sources">Bibliographie complète →</span></p>
      <p><b>Apparence.</b> Trois habillages au choix (Vélin, Ardoise, Colophon),
      chacun en clair et en sombre, avec sa police, que tu peux
      remplacer sans changer d'habillage. À la première visite l'application
      suit le réglage clair ou sombre de ton appareil ; la bascule en haut à
      droite tranche ensuite. Les animations se règlent aussi. Tout est dans
      <b>Paramètres</b>. La calligraphie du texte coranique ne change jamais.</p>
      <p><b>Gratuit et sans compte</b> : progression et réglages restent dans ce
      navigateur. Rien n'est envoyé ailleurs, sauf si tu actives toi-même la
      synchronisation multi-appareils, qui repose sur un code secret anonyme.</p>
    </div></details>`;
}

function pageHome() {
  /* L'entrelacs en tête de l'accueil, à 84 px, À CÔTÉ du titre en large et
     au-dessus en mobile : c'est la disposition de la direction artistique.
     Le titre se réduit à « Roub' », la phrase qui le complétait ouvre le
     paragraphe ; et le caractère ۞ quitte ce titre, où il ferait doublon avec
     le dessin posé juste à côté. */
  let h = `<div class="hero">
    <svg class="hero-logo" viewBox="0 0 64 64" aria-hidden="true"><use href="#logo-roub"/></svg>
    <div class="hero-txt">
    <h1>Roub'</h1>
    <p>Mémoriser le Qur'an roub' par roub'. Juz 1 et 2 (Al-Fâtiḥa + Al-Baqara)
    et juz 'Amma (les sourates courtes, idéales pour débuter). Riwaya Hafs 'an
    'Asim, récitation Al-Husary. Les étoiles notent la difficulté de
    mémorisation sur l'échelle de tous les roub' du Qur'an.</p></div></div>`;
  h += accueilHtml();
  const juzList = [...new Set(RUBS.map(r => r.juz))].sort((a, b) => a - b);
  for (const juz of juzList) {
    const rubs = RUBS.filter(r => r.juz === juz);
    h += `<div class="juz-title"><h2>Juz ${juz}${juz === 30 ? " · 'Amma" : ""}</h2>
      <span>${rubs[0].debut} → ${rubs[rubs.length - 1].fin}</span></div>`;
    h += `<div class="rub-grid">`;
    for (const r of rubs) {
      const cards = (DECKS[r.id] || []).map(c => c.id);
      const st = deckStats(cards);
      /* le badge signale l'absence de NOTES RÉDIGÉES, pas un roub' fermé :
         les 24 sont ouverts depuis la 1.13.0 (`dispo` ne sert plus qu'à la
         navigation), et se fier à lui rendait le badge invisible partout */
      const notesRedigees = !!(NOTES[r.id] && NOTES[r.id].difficultes);
      const pg = progressOf(DECKS[r.id] || []);
      const pctSeen = pg.total ? Math.round(100 * pg.seen / pg.total) : 0;
      const pctMature = pg.total ? Math.round(100 * pg.mature / pg.total) : 0;
      h += `<div class="rub-card" data-rub="${r.id}">
        <div class="head"><span class="num">Roub' ${r.rub}</span>${starsHtml(r.stars || 0)}</div>
        <div class="titre">${esc(r.titre || "")}</div>
        <div class="range">${r.debut} → ${r.fin} · ${r.n} versets</div>
        <div class="pbar" title="${pg.seen}/${pg.total} cartes vues · ${pg.mature} mûres · ${pg.matureChains}/${pg.chains} enchaînements acquis">
          <div class="pb-seen" style="width:${pctSeen}%"></div>
          <div class="pb-mature" style="width:${pctMature}%"></div>
        </div>
        <div class="foot">
          ${st.due ? `<span class="badge due">${st.due} carte${st.due > 1 ? "s" : ""} à revoir</span>`
                   : `<span class="badge">${cards.length} cartes</span>`}
          ${notesRedigees ? "" : `<span class="badge">notes à venir</span>`}
        </div></div>`;
    }
    h += `</div>`;
  }
  h += progressionHtml();
  return h + `<div class="footer-pad"></div>`;
}

function progressionHtml() {
  const all = [];
  for (const rid of Object.keys(DECKS)) {
    for (const c of DECKS[rid]) all.push(c);
  }
  const pg = progressOf(all);
  if (!pg.seen && !Object.keys(EVAL).length) return "";
  const sk = streak();
  let h = `<div class="juz-title"><h2>Ma progression</h2>
    <span>une carte est « acquise » après un intervalle de ${MATURE_DAYS} jours ou plus</span></div>
  <div class="note-card">
    <span class="badge">🔥 ${sk} jour${sk > 1 ? "s" : ""} d'affilée</span>
    <span class="badge" style="margin-left:6px">${pg.matureChains}/${pg.chains} enchaînements de versets acquis</span>
    <span class="badge" style="margin-left:6px">${pg.seen}/${pg.total} cartes vues</span>
    <span class="badge" style="margin-left:6px">${pg.mature} mûres</span>
  </div>`;
  // lacunes auto-évaluées (Lot G)
  const weak = Object.keys(EVAL).filter(k => EVAL[k].n === 1 || EVAL[k].n === 2);
  if (weak.length) {
    const byRub = {};
    for (const k of weak) {
      const hit = VIDX[k];
      if (hit) byRub[hit.rid] = (byRub[hit.rid] || []).concat(k);
    }
    h += `<div class="note-card"><div class="nc-head">Mes lacunes (auto-évaluées)</div>`;
    for (const rid of Object.keys(byRub).sort()) {
      const R = QURAN[rid];
      h += `<div style="margin:4px 0"><b>J${R.juz} R${R.rub}</b> : ` +
        byRub[rid]
          .sort((a, b) => (VIDX[a].i - VIDX[b].i))
          .map(k => `<span class="vref ${EVAL[k].n === 1 ? "weak1" : "weak2"}" data-goto="${k}"
            title="${EVAL_LABELS[EVAL[k].n]}${EVAL[k].note ? " · " + esc(EVAL[k].note) : ""}">${k}</span>`)
          .join(" ") + `</div>`;
    }
    h += `<div class="fb-note">rouge = à revoir, orange = fragile ·
      onglet Révision, chip « Mes lacunes » pour les travailler en priorité</div></div>`;
  }
  return h;
}

/* ---------------- page roub' ---------------- */
const TABS = [
  ["memoriser", "Mémoriser"], ["difficultes", "Difficultés"],
  ["tajwid", "Tajwid"], ["tafsir", "Tafsir"],
  ["vocab", "Vocabulaire"], ["cartes", "Cartes"],
];
const memoState = { maskAr: false, maskTl: false, maskTr: false,
  mode: "versets", pagesColor: false };
const anum = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);

/* polices par page du mushaf (chargées à la demande par le navigateur) */
(function injectQcfFonts() {
  let css = "";
  for (const n of Object.keys(PAGES)) {
    const f = "QCF_P" + String(n).padStart(3, "0");
    css += `@font-face{font-family:"p${n}";src:url("fonts/qcf/${f}.woff2") format("woff2");font-display:block;}`;
  }
  /* Les QCF v4 sont des polices COLRv1 : la couleur de chaque glyphe est DANS
     la police, le CSS n'y a aucune prise. Elles embarquent SIX palettes
     officielles du KFGQPC, et non une seule (relevé dans la table CPAL le
     27/07) :
       0  base noire, couleurs vives      2  base noire, seconde variante
       1  base BLANCHE, couleurs éclaircies : celle du mode sombre
       3, 5  quasi monochromes clair      4  quasi monochrome sombre
     On emploie donc la 2 en clair (moins agressive que la 0, choix de Yusuf) et
     la 1 en sombre. `override-colors` ne touche que l'entrée 0, le corps de la
     lettre, c'est-à-dire l'encre : AUCUNE couleur de règle n'est modifiée, et
     c'est l'exact équivalent du `color` déjà appliqué aux pages en noir et
     blanc. Le blanc pur de la palette 1 sur un fond très sombre donne 18,6:1,
     qui « bave » et fatigue ; l'encre adoucie sur --bg3 ramène à ~13:1.
     Le descripteur font-family est OBLIGATOIRE dans @font-palette-values : il
     faut donc une déclaration par police, d'où cette génération en boucle. */
  const ENCRE_SOMBRE = "#e9e5dd";   // moyenne des trois --text sombres
  for (const n of Object.keys(PAGES2)) {
    css += `@font-face{font-family:"t${n}";src:url("fonts/qcf4/p${n}.woff2") format("woff2");font-display:block;}`
         + `@font-palette-values --mushafClair{font-family:"t${n}";base-palette:2}`
         + `@font-palette-values --mushafSombre{font-family:"t${n}";base-palette:1;`
         + `override-colors:0 ${ENCRE_SOMBRE}}`;
  }
  if (!css) return;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();

function pageRub(rid, tab) {
  const R = QURAN[rid];
  const meta = RUBS.find(r => r.id === rid) || {};
  let h = `<div class="rub-head">
    <span class="back" data-goto-home>← Tous les roub'</span>
    <h1>Juz ${R.juz} · Roub' ${R.rub} ${starsHtml(meta.stars || 0)}</h1>
    <div class="sub">${esc(meta.titre || "")} · ${R.debut} → ${R.fin} · ${R.n} versets</div>
  </div>`;
  h += `<div class="tabs">` + TABS.map(([id, lab]) =>
    `<button data-tab="${id}" class="${id === tab ? "on" : ""}">${lab}</button>`).join("") + `</div>`;
  const N = NOTES[rid];
  if (tab === "memoriser") h += secMemoriser(R);
  else if (tab === "difficultes") h += secDifficultes(N, meta);
  else if (tab === "tajwid") h += secTajwid(N);
  else if (tab === "tafsir") h += secTafsir(R);
  else if (tab === "vocab") h += secVocab(N);
  else if (tab === "cartes") h += secCartes(rid);
  h += fbBox(rid);
  return h + `<div class="footer-pad"></div>`;
}

/* encart « tajwid de cette sourate » : parcours progressif (idée d'Israa),
   dérivé des spans par tools/build_tajcur.py ; sourates courtes seulement */
function tajCurHtml(s) {
  const TC = window.TAJCUR;
  const e = TC && TC.parSourate && TC.parSourate[s];
  if (!e || !e.regles.length) return "";
  const nouv = new Set(e.nouvelles);
  const pill = id => {
    const r = REGLES.find(x => x.id === id);
    return r ? `<span class="pill${nouv.has(id) ? " new" : ""}" data-regle="${id}">${esc(r.nom)}${nouv.has(id) ? `<b class="tag-new">nouveau</b>` : ""}</span>` : "";
  };
  const ordered = e.nouvelles.concat(e.regles.filter(id => !nouv.has(id)));
  const nR = e.regles.length, nN = e.nouvelles.length;
  return `<details class="tajcur"><summary>Tajwid de cette sourate · ${nR} règle${nR > 1 ? "s" : ""}${nN ? ` <b>dont ${nN} nouvelle${nN > 1 ? "s" : ""}</b>` : ""}</summary>
    <div class="pill-row">${ordered.map(pill).join("")}</div>
    <p class="fb-note">« nouveau » = première apparition dans le parcours (Fâtiḥa, puis les
    sourates courtes en remontant d'An-Nâs vers An-Naba) ; cliquer une règle ouvre sa fiche.</p></details>`;
}

function secMemoriser(R) {
  const mode = memoState.mode;
  let h = `<div class="memo-opts">
    <button class="chip ${mode === "versets" ? "on" : ""}" data-mode="versets">Versets</button>
    <button class="chip ${mode === "continu" ? "on" : ""}" data-mode="continu">Texte continu</button>
    <button class="chip ${mode === "pages" ? "on" : ""}" data-mode="pages">Pages du mushaf</button>
    <span style="width:10px"></span>`;
  if (mode === "versets") {
    h += `
    <button class="chip ${PARAMS.taj ? "on" : ""}" data-opt="taj">Couleurs tajwid</button>
    <button class="chip ${PARAMS.silentMarks ? "on" : ""}" data-opt="silentMarks" title="les ronds ۟ au-dessus des lettres écrites mais non prononcées">Ronds muets</button>
    <button class="chip ${PARAMS.showTl ? "on" : ""}" data-opt="showTl">Translittération</button>
    <button class="chip ${PARAMS.showTr ? "on" : ""}" data-opt="showTr">Traduction</button>
    <button class="chip ${memoState.maskAr ? "on" : ""}" data-mask="maskAr">Masquer l'arabe</button>
    <button class="chip ${memoState.maskTl ? "on" : ""}" data-mask="maskTl">Masquer la translit.</button>`;
  } else if (mode === "continu") {
    h += `<button class="chip ${PARAMS.taj ? "on" : ""}" data-opt="taj">Couleurs tajwid</button>
    <button class="chip ${PARAMS.silentMarks ? "on" : ""}" data-opt="silentMarks" title="les ronds ۟ au-dessus des lettres écrites mais non prononcées">Ronds muets</button>
    <span class="fb-note">clic sur un verset : l'écouter ; double-clic sur un mot : lecture à partir de ce mot</span>`;
  } else {
    h += `<button class="chip ${memoState.pagesColor ? "on" : ""}" data-pgcolor
      title="calligraphie colorée tajwid (édition officielle v4) ou noir et blanc classique">Couleurs tajwid</button>
    <span class="fb-note">mise en page exacte du mushaf de Médine ·
      clic sur un mot : écouter le verset ; double-clic : lecture à partir de ce mot ;
      les versets hors de ce roub' sont estompés</span>`;
  }
  h += `</div>`;
  let lastS = null;
  if (mode === "pages") {
    h += pagesHtml(R);
  } else if (mode === "continu") {
    let open = false;
    R.verses.forEach((v, i) => {
      if (v.s !== lastS) {
        lastS = v.s;
        if (open) { h += `</div>`; open = false; }
        h += `<div class="surah-head"><div class="nom">Sourate ${esc(SURAH_NAMES[v.s] || v.s)}</div>`;
        if (basmalaFor(v)) h += `<div class="basmala">${arEsc(BASMALA)}</div>`;
        h += `</div>` + tajCurHtml(v.s) + `<div class="mushaf">`;
        open = true;
      }
      h += `<span class="mver" data-k="${v.k}" data-i="${i}" title="${v.k}${(EVAL[v.k] || {}).n ? " · " + EVAL_LABELS[EVAL[v.k].n] : ""}">` +
        arHtml(v) + `<span class="vend e${(EVAL[v.k] || {}).n || 0}">${anum(v.a)}</span></span> `;
    });
    if (open) h += `</div>`;
  } else {
    R.verses.forEach((v, i) => {
      if (v.s !== lastS) {
        lastS = v.s;
        h += `<div class="surah-head"><div class="nom">Sourate ${esc(SURAH_NAMES[v.s] || v.s)}</div>`;
        if (basmalaFor(v)) h += `<div class="basmala">${arEsc(BASMALA)}</div>`;
        h += `</div>` + tajCurHtml(v.s);
      }
      h += `<div class="verse" data-k="${v.k}">
        <div class="vhead"><span class="vnum">${v.k}</span>
          <button title="écouter ce verset" data-play-one="${i}">▶</button>
          <button title="lire à partir d'ici" data-play-from="${i}">▶▶</button>
          <span class="spacer" style="flex:1"></span>
          ${evalBtn(v.k, true)}
        </div>
        <div class="ar ${memoState.maskAr ? "masked" : ""}" data-reveal>${arHtml(v)}</div>
        ${PARAMS.showTl ? `<div class="tl ${memoState.maskTl ? "masked" : ""}" data-reveal>${esc(tlOf(v))}</div>` : ""}
        ${PARAMS.showTr ? `<div class="tr">${esc(v.tr)}</div>` : ""}
      </div>`;
    });
  }
  h += `<div class="audiobar">
    <span class="now" id="audio-now">—</span>
    <button class="evalbtn e0" id="audio-eval" style="display:none"
      title="auto-évaluer le verset en cours">●</button>
    <button class="primary" data-audio="playall">▶ Tout le roub'</button>
    <button data-audio="pause" id="audio-pause">⏸</button>
    <button data-audio="stop">⏹</button>
    <span style="flex:1"></span>
    <button class="ab-reglages" data-audio="reglages" aria-expanded="false"
      title="répétition, boucle et vitesse" aria-label="répétition, boucle et vitesse"
      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" aria-hidden="true"><path
      d="M3 8.5h5M12.5 8.5H21M3 15.5h11.5M19 15.5H21"/><circle cx="10.25" cy="8.5"
      r="2.25"/><circle cx="16.75" cy="15.5" r="2.25"/></svg></button>
    <div class="ab-second">
      <label>répéter
        <select id="audio-rep">
          ${[1, 2, 3, 5].map(n => `<option value="${n}" ${player.rep === n ? "selected" : ""}>×${n}</option>`).join("")}
        </select></label>
      <button data-audio="loop" class="${player.loopRange ? "on" : ""}" id="audio-loop" title="reboucler la plage entière">boucle</button>
      <label>vitesse
        <select id="audio-speed">
          ${[0.75, 1, 1.25].map(x => `<option value="${x}" ${PARAMS.speed === x ? "selected" : ""}>${x}×</option>`).join("")}
        </select></label>
    </div>
  </div>`;
  return h;
}

function pagesHtml(R) {
  const DATA = memoState.pagesColor && Object.keys(PAGES2).length ? PAGES2 : PAGES;
  const fpfx = DATA === PAGES2 ? "t" : "p";
  const inRub = new Set(R.verses.map(v => v.k));
  const pnums = Object.keys(DATA).map(Number).sort((a, b) => a - b)
    .filter(p => Object.values(DATA[p]).some(line => line.some(w => inRub.has(w.k))));
  if (!pnums.length) return `<div class="empty">Pagination indisponible.</div>`;
  /* indice du mot dans son verset (= indice du segment audio, pour démarrer la
     lecture au mot double-cliqué) : les glyphes d'un verset se suivent dans
     l'ordre et le dernier est la marque de fin de verset, qui n'est pas récitée.
     Vérifié sur les 823 versets : glyphes = mots + 1 (seule exception 2:125). */
  const nGlyphes = {}, vus = {};
  for (const p of pnums)
    for (const ln of Object.keys(DATA[p]))
      for (const w of DATA[p][ln]) nGlyphes[w.k] = (nGlyphes[w.k] || 0) + 1;
  let h = "";
  for (const p of pnums) {
    const lines = DATA[p];
    // en-têtes des sourates qui commencent sur cette page
    const starts = [];
    for (const ln of Object.keys(lines)) {
      for (const w of lines[ln]) {
        const [s, a] = w.k.split(":").map(Number);
        if (a === 1 && !starts.includes(s)) starts.push(s);
      }
    }
    for (const s of starts.sort((a, b) => a - b)) {
      h += `<div class="surah-head"><div class="nom">Sourate ${esc(SURAH_NAMES[s] || s)}</div>`;
      if (s !== 1 && s !== 9) h += `<div class="basmala">${arEsc(BASMALA)}</div>`;
      h += `</div>`;
    }
    h += `<div class="qpage${fpfx === "t" ? " colored" : ""}">`;
    for (const ln of Object.keys(lines).map(Number).sort((a, b) => a - b)) {
      h += `<div class="qline" style="font-family:'${fpfx}${p}'">`;
      for (const w of lines[ln]) {
        const wi = (vus[w.k] = (vus[w.k] || 0) + 1) - 1;
        const dw = wi < nGlyphes[w.k] - 1 ? ` data-w="${wi}"` : "";   // pas la marque de fin
        h += `<span class="qw${inRub.has(w.k) ? "" : " dim"}" data-k="${w.k}"${dw} title="${w.k}">${w.g}</span>`;
      }
      h += `</div>`;
    }
    h += `<div class="qpage-num">· ${p} ·</div></div>`;
  }
  return h;
}

function secDifficultes(N, meta) {
  if (!N || !N.difficultes) return `<div class="empty">Contenu à venir pour ce roub'.</div>`;
  let h = "";
  if (meta.starsWhy) {
    h += `<div class="note-card"><div class="nc-head">Pourquoi ${meta.stars}/5</div>${fmt(meta.starsWhy)}</div>`;
  }
  h += `<div class="note-sec"><h3>Points durs de mémorisation</h3>`;
  for (const d of N.difficultes) {
    h += `<div class="note-card"><div class="nc-head">${arEsc(d.titre)} ${(d.refs || []).map(vrefBtn).join(" ")}</div>${fmt(d.texte)}</div>`;
  }
  return h + `</div>`;
}

function secTajwid(N) {
  if (!N || !N.tajwid) return `<div class="empty">Contenu à venir pour ce roub'.</div>`;
  let h = `<div class="note-sec"><h3>Particularités tajwid de ce roub'</h3>`;
  for (const t of N.tajwid) {
    h += `<div class="note-card"><div class="nc-head">${arEsc(t.titre)} ${(t.refs || []).map(vrefBtn).join(" ")}</div>
      ${fmt(t.texte)}
      ${t.regles && t.regles.length ? `<div class="pill-row">` + t.regles.map(id => {
        const r = REGLES.find(x => x.id === id);
        return r ? `<span class="pill" data-regle="${id}">${esc(r.nom)}</span>` : "";
      }).join("") + `</div>` : ""}
    </div>`;
  }
  h += `</div><div class="note-sec"><h3>Règles à connaître</h3><div class="pill-row">`;
  const ids = new Set();
  for (const t of N.tajwid) (t.regles || []).forEach(id => ids.add(id));
  for (const id of ids) {
    const r = REGLES.find(x => x.id === id);
    if (r) h += `<span class="pill" data-regle="${id}">${esc(r.nom)}</span>`;
  }
  h += `</div><p style="color:var(--muted);font-size:13px">Cliquer une règle ouvre sa fiche ;
    toutes les fiches sont dans l'onglet Tutoriels.</p></div>`;
  return h;
}

/* Tafsir : œuvre tierce reproduite verbatim (al-Mukhtaṣar), jamais de
   rédaction maison ici (décision éditoriale du 2026-07-24). */
function secTafsir(R) {
  let h = "";
  const TF = window.TAFSIRFR && R && window.TAFSIRFR[R.id];
  if (TF) {
    h += `<div class="note-sec"><h3>Tafsir verset par verset (al-Mukhtaṣar)</h3>
      <p class="tfr-attr">« French Translation of Al-Mukhtasar in Interpreting the Noble Quran »,
      Tafsir Center for Quranic Studies · V1.0.0 · source : QuranEnc.com ·
      texte reproduit sans modification.</p>`;
    let lastS = null;
    for (const v of R.verses) {
      const t = TF[v.k];
      if (!t) continue;
      if (v.s !== lastS) {
        lastS = v.s;
        h += `<div class="tfr-surah">Sourate ${esc(SURAH_NAMES[v.s] || v.s)}</div>`;
      }
      h += `<details class="tfr"><summary><b>${v.k}</b> <span class="tfr-apercu">${esc(t.slice(0, 110))}…</span></summary>
        <div class="tfr-body">${esc(t)}</div>
        <div class="tfr-foot">${vrefBtn(v.k)} <span class="fb-note">voir le verset dans Mémoriser</span></div>
      </details>`;
    }
    h += `</div>`;
  }
  return h || `<div class="empty">Contenu à venir pour ce roub'.</div>`;
}

function secVocab(N) {
  if (!N || !N.vocab) return `<div class="empty">Contenu à venir pour ce roub'.</div>`;
  let h = `<div class="note-sec"><h3>Vocabulaire à connaître</h3>
    <table class="vocab-table"><tr><th>Arabe</th><th>Translit.</th><th>Sens</th><th>Où</th></tr>`;
  for (const w of N.vocab) {
    h += `<tr><td class="var">${arEsc(w.ar)}</td>
      <td class="vtl">${esc(PARAMS.translit === "sci" ? w.sci : w.fr)}</td>
      <td>${esc(w.sens)}</td>
      <td>${(w.refs || []).map(vrefBtn).join(" ")}</td></tr>`;
  }
  return h + `</table></div>`;
}

function secCartes(rid) {
  const cards = DECKS[rid] || [];
  if (!cards.length) return `<div class="empty">Cartes à venir pour ce roub'.</div>`;
  const byType = {};
  for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1;
  const labels = { chain: "Enchaînement", vocab: "Vocabulaire", mutash: "Mutashabihat", sens: "Sens des passages" };
  const st = deckStats(cards.map(c => c.id));
  let h = `<div class="note-sec"><h3>Cartes de ce roub'</h3>
    <div class="note-card">${Object.keys(byType).map(t =>
      `<span class="badge" style="margin-right:6px">${labels[t] || t} : ${byType[t]}</span>`).join("")}
    <div style="margin-top:10px">
      <span class="badge due">${st.due} à revoir</span>
      <span class="badge" style="margin-left:6px">${st.fresh} nouvelles</span>
    </div>
    <div style="margin-top:12px">
      <button class="fb-send" data-start-deck="${rid}">Réviser ce roub'</button>
      <span class="fb-note">ou l'onglet Révision pour mélanger plusieurs roub'
      et télécharger les cartes pour Anki (recommandé : planificateur FSRS).</span>
    </div></div></div>`;
  return h;
}

/* ---------------- révision (flashcards) ---------------- */
const rev = { sel: new Set(), types: new Set(["chain", "vocab", "mutash", "sens"]),
  lacunes: false, session: null };

function pageRevision() {
  const avail = RUBS.filter(r => (DECKS[r.id] || []).length);
  if (rev.sel.size === 0 && avail.length) rev.sel = new Set(avail.map(r => r.id));
  if (rev.session) return revSessionHtml();
  const labels = { chain: "Enchaînement", vocab: "Vocabulaire", mutash: "Mutashabihat", sens: "Sens" };
  let pool = collectCards();
  const st = deckStats(pool.map(c => c.id));
  let h = `<div class="hero"><h1>Révision espacée</h1>
    <p>Les cartes reviennent à intervalle croissant selon tes réponses. Pour un
    vrai suivi au long cours, <b>nous recommandons Anki</b> : son planificateur
    <b>FSRS</b> (disponible depuis Anki 23.10, à activer dans les options du
    paquet) place les révisions bien plus finement que le moteur simple intégré
    ici.</p>
    <p><button class="fb-send" data-apkg>Télécharger les cartes pour Anki (.apkg)</button>
    <span class="fb-note">804 cartes, 24 sous-paquets (un par roub'), 1,4 Mo :
    enchaînements, vocabulaire, mutashabihat et sens. Sans audio : la récitation
    s'écoute ici. Un paquet avec audio (roub' 1) est disponible dans
    <code>apkg/</code> sur le dépôt.</span></p></div>`;
  h += `<div class="deck-opts">`;
  for (const r of avail) {
    h += `<button class="chip ${rev.sel.has(r.id) ? "on" : ""}" data-rev-rub="${r.id}">J${r.juz} R${r.rub}</button>`;
  }
  h += `<span style="width:14px"></span>`;
  for (const t of ["chain", "vocab", "mutash", "sens"]) {
    h += `<button class="chip ${rev.types.has(t) ? "on" : ""}" data-rev-type="${t}">${labels[t]}</button>`;
  }
  const nWeak = weakSet().size;
  h += `<span style="width:14px"></span>
    <button class="chip ${rev.lacunes ? "on" : ""}" data-rev-lacunes
      title="uniquement les cartes liées aux versets que tu as auto-évalués « à revoir » ou « fragile », toutes servies immédiatement">
      Mes lacunes${nWeak ? ` (${nWeak})` : ""}</button>`;
  h += `</div>`;
  const startable = rev.lacunes ? pool.length
    : st.due + Math.min(st.fresh, PARAMS.newLimit);
  h += `<div class="fc-stage"><div class="fc-card">
      <div class="fc-type">Sélection</div>
      <div class="fc-txt">${rev.lacunes
        ? `${pool.length} carte${pool.length > 1 ? "s" : ""} liée${pool.length > 1 ? "s" : ""} à tes lacunes, toutes servies immédiatement`
        : `${pool.length} cartes · <b>${st.due} à revoir</b> · ${st.fresh} nouvelles (max ${PARAMS.newLimit} nouvelles par session)`}</div>
      <div class="fc-actions">
        <button class="reveal" data-rev-start ${startable ? "" : "disabled"}>Démarrer la session</button>
      </div></div></div>`;
  return h + `<div class="footer-pad"></div>`;
}

function cardTouchesWeak(c, weak) {
  if (c.type === "chain") return weak.has(c.from) || weak.has(c.to);
  return (c.refs || []).some(k => weak.has(k));
}

function collectCards() {
  const weak = rev.lacunes ? weakSet() : null;
  let pool = [];
  for (const rid of rev.sel) {
    for (const c of (DECKS[rid] || [])) {
      if (!rev.types.has(c.type)) continue;
      if (weak && !cardTouchesWeak(c, weak)) continue;
      pool.push(Object.assign({ rid }, c));
    }
  }
  return pool;
}

function startSession(pool) {
  let list;
  if (rev.lacunes) {
    list = pool.slice();          // lacunes : tout, tout de suite
  } else {
    const now = Date.now();
    const due = pool.filter(c => { const s = SRS[c.id]; return s && s.due != null && s.due <= now; });
    const fresh = pool.filter(c => { const s = SRS[c.id]; return !s || s.due == null; })
      .slice(0, PARAMS.newLimit);
    list = due.concat(fresh);
  }
  if (!list.length) return;
  rev.session = { list, i: 0, shown: false, done: 0, again: [] };
  render();
}

function currentCard() {
  const s = rev.session;
  if (!s) return null;
  if (s.i < s.list.length) return s.list[s.i];
  if (s.again.length) { s.list = s.again; s.again = []; s.i = 0; return s.list[0]; }
  return null;
}

function revSessionHtml() {
  const s = rev.session;
  const c = currentCard();
  if (!c) {
    const done = s.done;
    rev.session = null;
    // fin de session : suggérer le code de synchro tant qu'il n'existe pas
    const nudge = SYNC_ON && !SYNC
      ? `<div class="fc-sub" style="margin-top:8px">💡 Ta progression n'est stockée que
          dans ce navigateur : crée ton <b>code de synchronisation</b> pour la
          protéger et la retrouver sur tes autres appareils.</div>
        <div class="fc-actions"><button class="fb-send" data-sync-create>Créer mon code</button></div>`
      : "";
    return `<div class="fc-stage"><div class="fc-card">
      <div class="fc-type">Session terminée</div>
      <div class="fc-txt">🎉 ${done} carte${done > 1 ? "s" : ""} revue${done > 1 ? "s" : ""}.</div>
      ${nudge}
      <div class="fc-actions"><button class="reveal" data-rev-back>Retour</button></div>
    </div></div>`;
  }
  const remaining = s.list.length - s.i + s.again.length;
  let h = `<div class="fc-stage">` + cardHtml(c, s.shown);
  if (!s.shown) {
    h += `<div class="fc-actions"><button class="reveal" data-rev-show>Afficher la réponse</button></div>`;
  } else {
    h += `<div class="fc-actions">
      <button class="again" data-grade="again">À revoir</button>
      <button class="hard" data-grade="hard">Difficile</button>
      <button class="good" data-grade="good">Bien</button>
      <button class="easy" data-grade="easy">Facile</button>
    </div>`;
  }
  h += `<div class="fc-meta">${remaining} restante${remaining > 1 ? "s" : ""} ·
    <a data-rev-back style="cursor:pointer">quitter</a></div></div>`;
  return h + `<div class="footer-pad"></div>`;
}

function cardHtml(c, shown) {
  const T = { chain: "Enchaînement des versets", vocab: "Vocabulaire", mutash: "Mutashabihat", sens: "Sens du passage" };
  let front = "", back = "";
  if (c.type === "chain") {
    const from = VIDX[c.from], to = VIDX[c.to];
    if (!from || !to) return `<div class="fc-card">carte invalide (${esc(c.id)})</div>`;
    front = `<div class="fc-sub">Verset ${c.from} :</div>
      <div class="ar">${arEsc(from.v.ar)}</div>
      <div class="fc-tl">${esc(tlOf(from.v))}</div>
      <button class="fc-audio-btn" data-oneshot="${from.v.audio}">🔊 Écouter</button>
      <div class="fc-sub"><b>Quel est le verset suivant ?</b></div>`;
    back = `<hr><div class="fc-sub">Verset ${c.to} :</div>
      <div class="ar">${arEsc(to.v.ar)}</div>
      <div class="fc-tl">${esc(tlOf(to.v))}</div>
      <div class="fc-sub">${esc(to.v.tr)}</div>
      <button class="fc-audio-btn" data-oneshot="${to.v.audio}">🔊 Écouter</button>`;
  } else if (c.type === "vocab") {
    front = `<div class="ar">${arEsc(c.ar)}</div>
      <div class="fc-tl">${esc(PARAMS.translit === "sci" ? c.sci : c.fr)}</div>`;
    back = `<hr><div class="fc-txt"><b>${esc(c.sens)}</b></div>
      ${(c.refs || []).length ? `<div class="fc-sub">Dans ${c.refs.map(esc).join(", ")}</div>` : ""}`;
  } else {
    front = `<div class="fc-txt">${fmt(c.q)}</div>
      ${c.arQ ? `<div class="ar">${esc(c.arQ)}</div>` : ""}`;
    back = `<hr><div class="fc-txt">${fmt(c.a)}</div>
      ${(c.refs || []).length ? `<div class="fc-sub">Voir ${c.refs.map(esc).join(", ")}</div>` : ""}`;
  }
  return `<div class="fc-card"><div class="fc-type">${T[c.type] || c.type}
      · J${QURAN[c.rid] ? QURAN[c.rid].juz : "?"} R${QURAN[c.rid] ? QURAN[c.rid].rub : "?"}</div>
    ${front}${shown ? back : ""}</div>`;
}

/* ---------------- tutoriels ---------------- */
function pageTutoriels(sub) {
  const pages = [["translit", "Lire la translittération"], ["tajwid", "Légende tajwid"],
    ["regles", "Fiches de règles"], ["obligation", "Obligatoire ou perfectionnement ?"],
    ["styles", "Styles de récitation"]];
  let h = `<div class="hero"><h1>Tutoriels</h1></div><div class="tabs">` +
    pages.map(([id, lab]) => `<button data-tuto="${id}" class="${id === sub ? "on" : ""}">${lab}</button>`).join("") +
    `</div><div class="prose">`;
  if (sub === "translit") h += tutoTranslit();
  else if (sub === "tajwid") h += tutoTajwid();
  else if (sub === "obligation") h += tutoObligation();
  else if (sub === "styles") h += tutoStyles();
  else h += tutoRegles();
  return h + `</div><div class="footer-pad"></div>`;
}

/* termes techniques cliquables : {{terme}} dans un texte de tutoriel devient
   une bulle (fiche de règle existante ou définition sourcée du glossaire) */
function gloss(txt) {
  return txt.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_, mot, cle) => {
    const k = (cle || mot).trim();
    return (window.GLOSSAIRE || {})[k]
      ? `<span class="gloss" data-gloss="${esc(k)}">${esc(mot)}</span>`
      : esc(mot);
  });
}

function glossBulle(cle) {
  const g = (window.GLOSSAIRE || {})[cle];
  if (!g) return "";
  if (g.regle) {
    const r = REGLES.find(x => x.id === g.regle);
    if (!r) return "";
    return `<div class="gloss-bulle"><b>${esc(r.nom)}</b>${fmt(r.texte)}
      <div class="src">Fiche de règle · cliquer le terme pour refermer</div></div>`;
  }
  return `<div class="gloss-bulle"><b>${esc(cle)}</b><p>${esc(g.def)}</p>
    <div class="src">${esc(g.src || "")} · cliquer le terme pour refermer</div></div>`;
}

/* page Sources : onglet à part depuis la 1.15.0, elle n'est pas un tutoriel
   mais LA référence de tout ce que l'application reprend à d'autres ; les
   mentions courtes ailleurs (accueil, à propos, README) y renvoient.
   Doit rester synchronisée avec SOURCES.md à la racine du dépôt : toute
   source citée dans un tutoriel doit avoir sa notice ici. */
function pageSources() {
  return `<div class="hero"><h1>Sources</h1></div><div class="prose">
<p>Le détail de tout ce que l'application reprend à d'autres : édition,
version, provenance, conditions d'usage. Règle de travail : <b>rien de ce qui
touche à la religion n'est écrit sans source nommée et vérifiable</b> ; ce qui
relève de la méthode d'apprentissage est notre travail propre et n'est pas
présenté comme une position savante.</p>

<h3>Texte coranique</h3>
<p>Mushaf de Médine, riwâya Hafs 'an 'Âsim, texte de référence du <b>Complexe
du Roi Fahd</b> (KFGQPC), obtenu par l'API quran.com v4. Le texte n'est jamais
modifié : les seules transformations sont d'affichage, et elles sont
réversibles. Elles sont deux : la graphie du soukoun propre au mushaf de
Médine, et celle de l'iqlâb, où le petit mîm remplace le second trait du
tanwin comme sur la page imprimée. Un contrôle automatique compare, verset par
verset, le texte publié à celui de la source.</p>

<h3>Calligraphie et pages du mushaf</h3>
<p>Polices <b>QCF</b> du KFGQPC, un glyphe par mot (version 1 en noir et blanc,
version 4 en couleurs tajwid), et police <b>UthmanicHafs</b> pour le texte
courant. La mise en page ligne à ligne reprend celle du mushaf imprimé.</p>

<h3>Traduction française</h3>
<p><b>Muhammad Hamidullah</b>, <i>Le Noble Coran et la traduction en langue
française de ses sens</i>, via quran.com. Diffusion non commerciale.</p>

<h3>Tafsir verset par verset</h3>
<p>« French Translation of Al-Mukhtasar in Interpreting the Noble Quran »,
traduction française d'<i>al-Mukhtaṣar fî tafsîr al-Qur'ân al-karîm</i>,
<b>Tafsir Center for Quranic Studies</b>, version 1.0.0 du 03/10/2019,
distribuée par <b>QuranEnc.com</b>. Texte <b>reproduit sans aucune
modification</b>, conformément aux conditions de QuranEnc.com : attribution de
l'éditeur et de la source, numéro de version affiché, contenu inchangé.</p>

<h3>Récitations</h3>
<p>Toutes du cheikh <b>Mahmoud Khalil al-Husary</b>, riwâya Hafs 'an
'Âsim : murattal 64 kbps (fourni avec l'appli) et 128 kbps, mu'allim, via
everyayah.com et quranicaudio.com ; mujawwad via le CDN de Tarteel. Usage non
commercial. Les murattal 64 et 128 kbps sont le <b>même enregistrement</b> à
deux qualités d'encodage ; le mu'allim est le premier <i>muṣḥaf mu'allim</i>
enregistré au monde (1969).</p>

<h3>Soulignage mot à mot</h3>
<p>Segments temporels de la <b>Quranic Universal Library</b> (qul.tarteel.ai) :
pour chaque verset, le début et la fin de chaque mot récité, un jeu par style.</p>

<h3>Règles de tajwid</h3>
<p><b>Al-Jamzûrî</b>, <i>Tuhfat al-Atfâl</i> (noûn sakina, tanwin, mîm sakina,
madd) et <b>Ibn al-Jazarî</b>, <i>al-Muqaddima al-Jazariyya</i> (qalqala, lâm
du nom d'Allah, râ'). Les fiches s'en tiennent au contenu de ces deux matns ;
chaque exemple cité est vérifié par script comme présent dans le Qur'an.</p>

<h3>Tutoriels et glossaire</h3>
<p><b>Ibn al-Jazarî</b> (m. 833 H), <i>an-Nashr fî l-qirâ'ât al-'ashr</i>,
tome I, chapitre « Comment lit-on le Qur'an ? » : définitions du taḥqîq, du
ḥadr, du tadwîr et du tartîl, et entrées du glossaire. Qur'an 73:4 pour le
tartîl, avec les gloses d'<b>Ibn 'Abbâs</b> et de <b>Mujâhid</b> rapportées par
Ibn al-Jazarî au même endroit.</p>
<p>Le tutoriel « Obligatoire ou perfectionnement ? » repose sur le vers
d'ouverture de la <i>Jazariyya</i> et sur ses commentateurs : <b>Mullâ ʿAlî
al-Qârî</b> et <b>al-Marṣafî</b>, qui s'opposent sur le statut du <i>laḥn
khafî</i>, <b>Makkî Naṣr</b> pour la distinction entre obligation religieuse et
obligation de métier (il rapporte aussi <b>al-Barkawî</b>), <b>Ibn al-Jazarî</b>
dans <i>an-Nashr</i> et <b>al-Ghazâlî</b> pour l'excuse de celui qui atteint le
bout de sa capacité. Les traductions françaises de ces passages sont les
nôtres, signalées comme telles, l'arabe donné en regard : aucune traduction
française libre de droit de ces ouvrages n'existe.</p>

<h3>Notes et cartes des roub'</h3>
<p><b>Ibn Kathîr</b>, <i>Tafsîr al-Qur'ân al-'aẓîm</i>, consulté dans son texte
arabe intégral (et non dans son abrégé) pour toute position qui lui est
attribuée ; <b>As-Sa'dî</b>, <i>Taysîr al-Karîm ar-Raḥmân</i>. Les hadiths sont
toujours donnés avec leur collection et, si elle est connue, leur appréciation
(hadith qudsi de la Fâtiḥa : <i>Sahih Muslim</i> 395 ; hadith de 'Adî ibn
Hâtim : <i>Tirmidhî</i> 2954, <i>hasan gharîb</i> selon at-Tirmidhî). Les
affirmations sur le texte lui-même sont vérifiées par script, jamais de
mémoire.</p>

<h3>Ce que l'application ne reprend à personne</h3>
<p>Le découpage roub' par roub', la difficulté sur cinq étoiles, le choix des
points durs, l'ordre du parcours de tajwid progressif, la formulation des
cartes et le moteur de révision espacée sont le travail propre de Roub' : des
choix pédagogiques, pas des positions savantes.</p>

<h3>Bibliographie</h3>
<p>Les mêmes sources, en notices normalisées (ISO 690), classées par auteur.
L'article arabe (<i>al-</i>, <i>as-</i>, <i>at-</i>) n'entre pas dans le
classement, selon l'usage des bibliographies d'études arabes. Les dates de
consultation sont celles des relevés qui ont servi à l'application. Les liens
mènent en priorité à la Bibliothèque numérique Shamela, la plus consultée pour
les textes classiques ; une autre adresse ne subsiste que là où Shamela n'a pas
l'ouvrage (<i>Nihâyat al-qawl al-mufîd</i>, <i>al-Minaḥ al-fikriyya</i>) ou
n'en sert pas le texte (<i>Hidâyat al-qârî</i>, dont les pages du chapitre 7
reviennent vides).</p>

<p class="biblio">COMPLEXE DU ROI FAHD POUR L'IMPRESSION DU NOBLE CORAN
(KFGQPC). <i>Al-Muṣḥaf al-sharīf</i>, riwāyat Ḥafṣ ʿan ʿĀṣim [en ligne]. Médine.
Texte obtenu par l'API quran.com v4, champs <i>text_uthmani</i>,
<i>text_uthmani_tajweed</i>, <i>text_imlaei</i>. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://api.quran.com/api/v4/</p>

<p class="biblio">COMPLEXE DU ROI FAHD POUR L'IMPRESSION DU NOBLE CORAN
(KFGQPC). <i>Polices QCF, versions 1 et 4</i>, et <i>police UthmanicHafs</i>
[polices numériques]. Médine.</p>

<p class="biblio">AL-GHAZĀLĪ, Abū Ḥāmid Muḥammad ibn Muḥammad aṭ-Ṭūsī
(m. 505 H). <i>Iḥyāʾ ʿulūm ad-dīn</i>. Beyrouth : Dār al-Maʿrifa, 4 vol. T. II,
p. 336, kitāb al-amr bi-l-maʿrūf wa-n-nahy ʿan al-munkar [en ligne]. [Consulté
le 25 juillet 2026]. Disponible à l'adresse : https://shamela.ws/book/9472/696</p>

<p class="biblio">HAMIDULLAH, Muhammad. <i>Le Noble Coran et la traduction en
langue française de ses sens</i> [en ligne]. Servie par l'API quran.com,
identifiant 31. Diffusion non commerciale. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://api.quran.com/api/v4/</p>

<p class="biblio">AL-ḤUṢARĪ, Maḥmūd Khalīl. <i>Al-Muṣḥaf al-murattal</i>, riwāyat
Ḥafṣ ʿan ʿĀṣim [enregistrement sonore en ligne]. Murattal 64 kbps :
everyayah.com ; murattal 128 kbps et muʿallim : mirrors.quranicaudio.com ;
mujawwad : audio-cdn.tarteel.ai. [Consulté le 25 juillet 2026].</p>

<p class="biblio">IBN AL-JAZARĪ, Muḥammad ibn Muḥammad (m. 833 H).
<i>Al-Muqaddima fī-mā ʿalā qāriʾ al-Qurʾān an yaʿlamah</i>, dite <i>al-Jazariyya</i>.
Édition ʿAbd al-Muḥsin ibn Muḥammad al-Qāsim. 2<sup>e</sup> éd., 1441 H / 2020,
102 p. Bāb at-tajwīd, p. 62 [en ligne]. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://shamela.ws/book/581/60</p>

<p class="biblio">IBN AL-JAZARĪ, Shams ad-Dīn Abū l-Khayr Muḥammad ibn
Muḥammad ibn Yūsuf (m. 833 H). <i>An-Nashr fī l-qirāʾāt al-ʿashr</i>. Édition
ʿAlī Muḥammad aḍ-Ḍabbāʿ (m. 1380 H). Al-Maṭbaʿa at-tijāriyya al-kubrā,
2 vol. T. I, faṣl fī t-tajwīd, p. 210 [en ligne]. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://shamela.ws/book/22642/218</p>

<p class="biblio">IBN KATHĪR, Ismāʿīl ibn ʿUmar. <i>Tafsīr al-Qurʾān
al-ʿaẓīm</i> [en ligne]. Texte arabe intégral servi par l'API quran.com,
tafsir n° 14. [Consulté le 24 juillet 2026]. Disponible à l'adresse :
https://api.quran.com/api/v4/</p>

<p class="biblio">AL-JAMZŪRĪ, Sulaymān. <i>Tuḥfat al-aṭfāl wa-l-ghilmān fī
tajwīd al-Qurʾān</i> [matn en ligne]. [Consulté le 25 juillet 2026]. Disponible
à l'adresse : https://shamela.ws/book/9632</p>

<p class="biblio">AL-MARṢAFĪ, ʿAbd al-Fattāḥ. <i>Hidāyat al-qārī ilā tajwīd
kalām al-Bārī</i>, chapitre 7 [en ligne]. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://www.islamweb.net/ar/library/content/231/9/</p>

<p class="biblio">MUSLIM IBN AL-ḤAJJĀJ. <i>Ṣaḥīḥ Muslim</i>, hadith 395
[en ligne]. [Consulté le 23 juillet 2026]. Disponible à l'adresse :
https://sunnah.com/</p>

<p class="biblio">NAṢR AL-JURAYSĪ, Muḥammad Makkī. <i>Nihāyat al-qawl al-mufīd
fī ʿilm at-tajwīd</i>, p. 26 [en ligne]. Rapporte également al-Barkawī,
<i>Sharḥ ad-Durr al-yatīm</i>. [Consulté le 25 juillet 2026]. Disponible à
l'adresse : https://ketabonline.com/ar/books/55066/</p>

<p class="biblio">AL-QĀRĪ, Mullā ʿAlī (m. 1014 H). <i>Al-Minaḥ al-fikriyya fī
sharḥ al-Muqaddima al-Jazariyya</i>, p. 29-30. Exemplaire numérisé [en ligne].
[Consulté le 25 juillet 2026]. Disponible à l'adresse :
https://archive.org/details/0743Pdf_201804</p>

<p class="biblio">AS-SAʿDĪ, ʿAbd ar-Raḥmān ibn Nāṣir. <i>Taysīr al-Karīm
ar-Raḥmān fī tafsīr kalām al-Mannān</i> [en ligne]. API quran.com, tafsir n° 91.
[Consulté le 24 juillet 2026]. Disponible à l'adresse :
https://api.quran.com/api/v4/</p>

<p class="biblio">TAFSIR CENTER FOR QURANIC STUDIES. <i>French Translation of
Al-Mukhtasar in Interpreting the Noble Quran</i>, traduction française
d'<i>al-Mukhtaṣar fī tafsīr al-Qurʾān al-karīm</i> [en ligne]. Version 1.0.0,
3 octobre 2019. Distribuée par QuranEnc.com, clé <i>french_mokhtasar</i>.
[Consulté le 24 juillet 2026]. Disponible à l'adresse : https://quranenc.com/</p>

<p class="biblio">TARTEEL AI. <i>Quranic Universal Library : segments mot à mot
des récitations</i> [jeu de données en ligne]. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://qul.tarteel.ai/</p>

<p class="biblio">AT-TIRMIDHĪ, Muḥammad ibn ʿĪsā. <i>Sunan at-Tirmidhī</i>,
hadith 2954 [en ligne]. [Consulté le 23 juillet 2026]. Disponible à l'adresse :
https://sunnah.com/</p>

<h3>Licences</h3>
<p>Code sous <b>AGPL-3.0</b> ; contenu éditorial de Roub' sous
<b>CC BY-NC-SA 4.0</b> (attribution « Roub', Anis &amp; Yusuf »). Chaque
élément tiers conserve ses propres conditions : c'est pourquoi l'application
est et doit rester gratuite et non commerciale.</p>

<p class="src">Une erreur, une source mal citée, un doute :
<a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>. Cette page correspond au
fichier SOURCES.md du dépôt.</p></div><div class="footer-pad"></div>`;
}

/* Page validée par Yusuf et Anis le 2026-07-25 (option (b) de la fiche F).
   Toutes les citations ont été vérifiées à leur source, aucune de seconde main ;
   les traductions françaises sont les nôtres, signalées comme telles, l'arabe
   donné en regard, faute de traduction française libre de droit de ces
   ouvrages. Les deux versets cités par al-Qârî sont des renvois : ils viennent
   du texte de l'application, avec la traduction Hamidullah. */
function tutoObligation() {
  const cite = (ar, fr) => `<p class="ar-cite">${arEsc(ar)}</p>` +
    `<p class="ar-trad">${fr} <span style="font-style:normal">(traduction Roub')</span></p>`;
  return gloss(`<h2>Obligatoire ou perfectionnement ?</h2>
<p>Le premier vers que rencontre celui qui apprend le {{tajwîd}} est aussi le
plus sévère. <b>Ibn al-Jazarî</b> ouvre son chapitre par :</p>
${cite("وَالأَخْذُ بِالتَّجْوِيدِ حَتْمٌ لَازِمُ … مَنْ لَمْ يُجَوِّدِ القُرْآنَ آثِمُ", "Prendre le tajwid est une obligation impérative : qui ne fait pas le tajwid du Qur'an est pécheur.")}
<p>Lu seul, ce vers donne l'impression que la moindre {{ghunna}} écourtée est une
faute grave. Les savants qui l'ont commenté, à commencer par son auteur,
distinguent en réalité trois étages, et le deuxième fait l'objet d'un désaccord
ancien entre eux. Le connaître évite deux excès symétriques : croire que rien
n'est obligatoire, ou croire que tout l'est également.</p>

<h3>Premier étage : ce qui ne se discute pas</h3>
<p>Les savants appellent <i>laḥn jalî</i>, erreur manifeste, ce qui touche à la
lettre elle-même ou à sa voyelle. <b>Al-Marṣafî</b> en donne la définition la
plus nette :</p>
${cite("فَالْجَلِيُّ: هُوَ خَلَلٌ يَطْرَأُ عَلَى الْأَلْفَاظِ فَيُخِلُّ بِعُرْفِ الْقِرَاءَةِ، سَوَاءٌ أَخَلَّ بِالْمَعْنَى أَمْ لَمْ يُخِلَّ", "Le manifeste : un défaut qui affecte les mots et rompt avec la norme de la lecture, qu'il altère le sens ou non.")}
<p>Changer une voyelle, vocaliser une lettre qui porte un {{soukoun}}, remplacer
une lettre par une autre, alléger une {{chadda}} : c'est de cela qu'il s'agit. Le
nom même le dit, ce sont des fautes que tout le monde entend, y compris qui n'a
jamais ouvert un livre de tajwid. Al-Marṣafî conclut que <b>son statut est
l'interdiction, par consensus</b>. C'est le socle, et il ne dépend d'aucune école
ni d'aucun niveau.</p>

<h3>Deuxième étage : ce dont les savants discutent</h3>
<p>Vient ensuite le <i>laḥn khafî</i>, l'erreur cachée, celle que seuls les
spécialistes de la lecture repèrent : laisser l'{{idghâm}} là où il est dû,
l'{{izhâr}}, l'{{iqlâb}}, l'{{ikhfâ'}}, alléger une lettre emphatique ou
emphatiser une lettre légère, écourter un {{madd}}, abandonner la {{ghunna}} ou
en fausser la mesure.</p>
<p><b>C'est exactement la matière des dix-neuf fiches de règles de
l'application.</b> Et c'est là que les savants ne disent pas la même chose.</p>
<p><b>Mullâ ʿAlî al-Qârî</b>, dans son commentaire de la Jazariyya, tient que cet
étage n'est pas une obligation individuelle dont l'abandon serait puni :</p>
${cite("وَلَا شَكَّ أَنَّ هَذَا النَّوْعَ مِمَّا لَيْسَ بِفَرْضِ عَيْنٍ يَتَرَتَّبُ عَلَيْهِ الْعِقَابُ الشَّدِيدُ، وَإِنَّمَا فِيهِ خَوْفُ الْعِقَابِ وَالتَّهْدِيدِ", "Nul doute que ce degré n'est pas une obligation individuelle entraînant un châtiment sévère ; il n'y a là que la crainte du châtiment et la menace.")}
<p>Il en tire la règle qui répond le plus directement à la question de cette
page :</p>
${cite("فَيَنْبَغِي أَنْ يُرَاعَى جَمِيعُ قَوَاعِدِهِمْ وُجُوبًا فِيمَا يَتَغَيَّرُ بِهِ الْمَبْنَى وَيَفْسُدُ بِهِ الْمَعْنَى، وَاسْتِحْبَابًا فِيمَا يَحْسُنُ بِهِ اللَّفْظُ وَيُسْتَحْسَنُ بِهِ النُّطْقُ حَالَ الْأَدَاءِ", "Il convient d'observer toutes leurs règles : à titre obligatoire dans ce qui change la structure du mot et corrompt le sens, à titre recommandé dans ce qui embellit le mot et rend la prononciation meilleure lors de l'exécution.")}
<p>Ce n'est pas un avis lâché en passant : il l'appuie sur deux versets,
« et Il ne vous a imposé aucune gêne dans la religion » (sourate al-Ḥajj,
verset 78) et « Allah n'impose à aucune âme une charge supérieure à sa
capacité » (sourate al-Baqara, verset 286), traduction Hamidullah, et conclut
que c'est la position qu'il faut mordre de ses molaires.</p>
<p><b>Al-Marṣafî</b>, référence majeure de la tradition égyptienne, dit
exactement le contraire, et le dit en le nommant :</p>
${cite("وَالْحُكْمُ فِي هَذَا اللَّحْنِ بِنَوْعَيْهِ التَّحْرِيمُ أَيْضًا، خِلَافًا لِمَا ذَكَرَهُ مُلَّا عَلِيٍّ الْقَارِي", "Le statut de ce laḥn, dans ses deux degrés, est aussi l'interdiction, contre ce qu'a dit Mullâ ʿAlî al-Qârî.")}
<p>Son argument mérite d'être entendu : si l'on retire l'izhâr, l'idghâm,
l'iqlâb, l'ikhfâ' et les madd, que reste-t-il des règles du tajwid, et de quel
droit appellerait-on encore la lecture correcte ? Il s'appuie aussi sur
<b>al-Barkawî</b>, pour qui ces altérations sont toutes interdites parce que,
sans toucher au sens, elles atteignent le mot, en gâtent l'éclat et en font
disparaître la beauté.</p>

<h3>Le vocabulaire des spécialistes</h3>
<p>La discipline a un mot pour ce partage, et il vaut mieux que nos
approximations. <b>Makkî Naṣr</b> le rapporte ainsi :</p>
${cite("اعْلَمْ أَنَّ الْوَاجِبَ فِي عِلْمِ التَّجْوِيدِ يَنْقَسِمُ إِلَى وَاجِبٍ شَرْعِيٍّ وَهُوَ مَا يُثَابُ عَلَى فِعْلِهِ وَيُعَاقَبُ عَلَى تَرْكِهِ، أَوْ صِنَاعِيٍّ وَهُوَ مَا يَحْسُنُ فِعْلُهُ وَيَقْبُحُ تَرْكُهُ", "Sache que l'obligatoire, dans la science du tajwid, se divise en obligation religieuse, celle dont l'accomplissement est récompensé et l'abandon puni, et en obligation de métier, celle dont l'accomplissement est beau et l'abandon laid.")}
<p>La première préserve les lettres d'un changement de structure et d'une
corruption du sens, et <b>celui qui l'abandonne pèche</b>. La seconde, ce sont
l'idghâm, l'ikhfâ', l'iqlâb, le {{tarqîq}}, le {{tafkhîm}}, et <b>celui qui
l'abandonne ne pèche pas, selon le choix des savants tardifs</b>. Le même auteur
précise que les savants anciens, eux, tenaient l'ensemble pour une obligation
religieuse.</p>
<p>Le désaccord du deuxième étage a donc un nom, deux camps et une histoire. Ce
n'est pas une zone floue, c'est une question tranchée différemment par des gens
qui savaient de quoi ils parlaient.</p>

<h3>Ce que tous disent, en revanche</h3>
<p>Aucun des deux camps ne demande l'impossible. Ibn al-Jazarî, dans
<i>an-Nashr</i>, répartit les lecteurs en trois :</p>
${cite("وَالنَّاسُ فِي ذَلِكَ بَيْنَ مُحْسِنٍ مَأْجُورٍ، وَمُسِيءٍ آثِمٍ، أَوْ مَعْذُورٍ", "Les gens s'y répartissent entre celui qui fait bien et en est récompensé, celui qui fait mal et pèche, et celui qui est excusé.")}
<p>Et il dit qui est excusé : celui dont la langue ne suit pas, ou qui ne trouve
personne pour le guider vers la prononciation juste, car Dieu n'impose à une âme
que ce qu'elle peut porter.</p>
<p><b>Al-Ghazâlî</b> va dans le même sens, et sa formulation est la plus douce de
toutes. Après avoir rappelé qu'il faut corriger celui qui lit mal, il ajoute que
si l'essentiel de la lecture est juste sans qu'on parvienne à tout égaliser, il
n'y a pas de mal à lire, à voix basse ; puis :</p>
${cite("وَلَكِنْ إِذَا كَانَ ذَلِكَ مُنْتَهَى قُدْرَتِهِ وَكَانَ لَهُ أُنْسٌ بِالْقِرَاءَةِ وَحِرْصٌ عَلَيْهَا فَلَسْتُ أَرَى بِهِ بَأْسًا", "Si c'est là le bout de sa capacité et qu'il trouve dans la lecture une intimité et un attachement, je n'y vois aucun mal.")}
<p>La ligne commune est celle-là : <b>c'est la capacité et l'accès à un
enseignant qui déterminent la responsabilité</b>, pas un barème de règles.</p>

<h3>Ce que cela change quand on mémorise</h3>
<p>Rien de ce qui précède ne dispense d'apprendre, et rien n'autorise à repousser
la mémorisation en attendant d'être parfait.</p>
<p>Les fautes du premier étage se corrigent tout de suite, parce qu'elles ne se
discutent pas et qu'elles s'entendent. C'est le premier travail.</p>
<p>Les règles des fiches s'acquièrent par l'oreille et la répétition plus que par
la théorie. Le meilleur chemin reste d'imiter la récitation, verset par verset,
plutôt que de réciter en récitant mentalement une liste de règles.</p>
<p>Une faute du deuxième étage ne vous met pas en faute grave, et ne doit pas
interrompre votre mémorisation. Elle indique un point à travailler, pas un péché
à expier.</p>
<p>Enfin, la question de savoir laquelle des deux positions suivre n'est pas
tranchée par cette application. Ce qui précède les expose, avec leurs auteurs et
leurs textes, et laisse à chacun le soin de suivre l'avis de savants auxquels il
se réfère.</p>

<h3>Sources</h3>
<p class="biblio">AL-GHAZĀLĪ, Abū Ḥāmid Muḥammad ibn Muḥammad aṭ-Ṭūsī (m. 505 H).
<i>Iḥyāʾ ʿulūm ad-dīn</i>. Beyrouth : Dār al-Maʿrifa, 4 vol. T. II, p. 336,
kitāb al-amr bi-l-maʿrūf wa-n-nahy ʿan al-munkar [en ligne]. [Consulté le
25 juillet 2026]. Disponible à l'adresse : https://shamela.ws/book/9472/696</p>
<p class="biblio">IBN AL-JAZARĪ, Muḥammad ibn Muḥammad (m. 833 H).
<i>Al-Muqaddima fī-mā ʿalā qāriʾ al-Qurʾān an yaʿlamah</i>, dite
<i>al-Jazariyya</i>. Édition ʿAbd al-Muḥsin ibn Muḥammad al-Qāsim.
2<sup>e</sup> éd., 1441 H / 2020, 102 p. Bāb at-tajwīd, p. 62 [en ligne].
[Consulté le 25 juillet 2026]. Disponible à l'adresse :
https://shamela.ws/book/581/60</p>
<p class="biblio">IBN AL-JAZARĪ, Shams ad-Dīn Abū l-Khayr Muḥammad ibn Muḥammad
ibn Yūsuf (m. 833 H). <i>An-Nashr fī l-qirāʾāt al-ʿashr</i>. Édition ʿAlī
Muḥammad aḍ-Ḍabbāʿ (m. 1380 H). Al-Maṭbaʿa at-tijāriyya al-kubrā, 2 vol. T. I,
faṣl fī t-tajwīd, p. 210 [en ligne]. [Consulté le 25 juillet 2026]. Disponible à
l'adresse : https://shamela.ws/book/22642/218</p>
<p class="biblio">AL-MARṢAFĪ, ʿAbd al-Fattāḥ. <i>Hidāyat al-qārī ilā tajwīd kalām
al-Bārī</i>, chapitre 7 [en ligne]. [Consulté le 25 juillet 2026]. Disponible à
l'adresse : https://www.islamweb.net/ar/library/content/231/9/</p>
<p class="biblio">NAṢR AL-JURAYSĪ, Muḥammad Makkī. <i>Nihāyat al-qawl al-mufīd fī
ʿilm at-tajwīd</i>, p. 26 [en ligne]. Rapporte également al-Barkawī,
<i>Sharḥ ad-Durr al-yatīm</i>. [Consulté le 25 juillet 2026]. Disponible à
l'adresse : https://ketabonline.com/ar/books/55066/</p>
<p class="biblio">AL-QĀRĪ, Mullā ʿAlī (m. 1014 H). <i>Al-Minaḥ al-fikriyya fī
sharḥ al-Muqaddima al-Jazariyya</i>, p. 29-30. Exemplaire numérisé [en ligne],
[consulté le 25 juillet 2026], disponible à l'adresse :
https://archive.org/details/0743Pdf_201804</p>
<p class="src">Les traductions françaises de ces passages ont été faites pour
Roub' : aucune traduction française libre de droit de ces ouvrages n'existe.
L'arabe est donné en regard pour que chacun puisse vérifier. Le matn de la
Jazariyya, lui, a été traduit et commenté en français par Farid Ouyalize
(éditions Sana) : c'est la lecture de référence pour aller plus loin.
<span class="vref" data-goto-page="sources">Toutes les sources de Roub' &rarr;</span></p>`);
}

function tutoStyles() {
  return gloss(`<h2>Les styles de récitation : lequel choisir ?</h2>
<p>Le Qur'an se récite à plusieurs allures, et la tradition les a nommées et
définies bien avant l'enregistrement sonore. <b>Ibn al-Jazarî</b> (m. 833 H),
dans <i>an-Nashr fî l-qirâ'ât al-'ashr</i>, chapitre « Comment lit-on le
Qur'an ? », en distingue trois, toutes valides : « Le Livre d'Allah se lit en
{{taḥqîq}}, en {{ḥadr}} et en {{tadwîr}}, qui est l'intermédiaire entre les
deux états, en récitant avec {{tartîl}} et {{tajwîd}} ».</p>

<p><b>Le {{taḥqîq}}</b> : la lecture posée, qui donne à chaque lettre
{{son dû}} : {{madd}} rassasié, {{hamza}} réalisée, voyelles complètes,
{{izhâr}} et {{gémination}} appuyés, {{ghunna}} pleinement tenue, lettres
nettement détachées les unes des autres.
Ibn al-Jazarî précise qu'elle sert « à assouplir les langues et à redresser la
prononciation », et surtout que c'est <b>l'allure recommandée à celui qui
apprend</b>, sans tomber dans l'excès inverse.</p>

<p><b>Le {{ḥadr}}</b> : la lecture rapide, allégée par le raccourcissement des
{{madd}}, l'{{idghâm}} et l'allègement de la {{hamza}}, à condition de ne
jamais amputer les lettres de prolongation ni faire disparaître la
{{ghunna}}. Elle vise « la multiplication des bonnes actions par l'abondance
de la lecture ».</p>

<p><b>Le {{tadwîr}}</b> : le juste milieu entre les deux ; Ibn al-Jazarî le
donne pour « le choix de la plupart des gens de la transmission ».</p>

<p><b>Le {{tartîl}}</b>, lui, n'est pas une quatrième vitesse mais la manière
commandée par le verset « et récite le Qur'an lentement et clairement »
(sourate 73, verset 4) : Ibn 'Abbâs le glose par « rends-le distinct »,
Mujâhid par « prends ton temps ».</p>

<h3>Ce que proposent les enregistrements de Roub'</h3>
<p>Les quatre choix de l'appli sont tous du cheikh <b>Mahmoud Khalil
al-Husary</b>, en {{riwâya}} Hafs 'an 'Âsim :</p>
<ul>
<li><b>Murattal</b> (64 ou 128 kbps : même récitation, seule la qualité sonore
change) : la lecture mesurée, régulière, sans ornementation, celle qu'on suit
pour mémoriser. Al-Husary fut le premier à enregistrer un <i>muṣḥaf
murattal</i> complet en Hafs.</li>
<li><b>Mu'allim</b> (« l'enseignant ») : la lecture d'enseignement, plus lente
et plus détachée, pensée pour être répétée après le cheikh ; c'est l'esprit
même du {{taḥqîq}} recommandé au débutant. Al-Husary a enregistré le premier
<i>muṣḥaf mu'allim</i> en 1969.</li>
<li><b>Mujawwad</b> : la lecture solennelle et mélodique, aux prolongations
longuement tenues. Sur un même verset (114:1), elle dure 13,4 secondes
contre 8,0 en murattal : magnifique à écouter, mais peu commode pour caler une
mémorisation.</li>
</ul>

<h3>En pratique</h3>
<p>Pour apprendre par cœur : <b>murattal</b>, et <b>mu'allim</b> quand un
passage résiste et qu'on veut répéter derrière le cheikh. Le <b>mujawwad</b>
se réserve à l'écoute. Le soulignage mot à mot est calé séparément sur chaque
style, et le choix se fait dans Paramètres.</p>

<h3>Sources</h3>
<p class="biblio">IBN AL-JAZARĪ, Shams ad-Dīn Abū l-Khayr Muḥammad ibn
Muḥammad ibn Yūsuf (m. 833 H). <i>An-Nashr fī l-qirāʾāt al-ʿashr</i>. Édition
ʿAlī Muḥammad aḍ-Ḍabbāʿ (m. 1380 H). Al-Maṭbaʿa at-tijāriyya al-kubrā,
2 vol. T. I, faṣl fī t-tajwīd, p. 210 [en ligne]. [Consulté le 25 juillet 2026].
Disponible à l'adresse : https://shamela.ws/book/22642/218</p>

<p class="biblio">AL-ḤUṢARĪ, Maḥmūd Khalīl. <i>Al-Muṣḥaf al-murattal</i> et
<i>al-muṣḥaf al-muʿallim</i>, riwāyat Ḥafṣ ʿan ʿĀṣim [enregistrements sonores
en ligne]. everyayah.com, mirrors.quranicaudio.com, audio-cdn.tarteel.ai.
[Consulté le 25 juillet 2026].</p>

<p class="src">Les citations d'an-Nashr sont traduites de l'arabe pour Roub'.
Les durées comparées entre styles sont des mesures faites sur les fichiers audio
de l'application. Les premières mondiales d'enregistrement attribuées au cheikh
reposent sur sa notice biographique et restent à consolider par une source
institutionnelle.</p>`);
}

const TL_TABLE = [
  ["ء", "ʾ", "'", "coup de glotte (comme l'attaque de « aïe »)"],
  ["ب", "b", "b", "b français"],
  ["ت", "t", "t", "t français"],
  ["ث", "ṯ", "th", "th anglais de « think »"],
  ["ج", "ǧ", "dj", "dj de « Djibouti »"],
  ["ح", "ḥ", "ḥ", "h soufflé profond, du fond de la gorge (≠ h simple)"],
  ["خ", "ḫ", "kh", "j espagnol / ch allemand de « Bach »"],
  ["د", "d", "d", "d français"],
  ["ذ", "ḏ", "dh", "th anglais de « this » (sonore)"],
  ["ر", "r", "r", "r roulé"],
  ["ز", "z", "z", "z français"],
  ["س", "s", "s", "s français"],
  ["ش", "š", "ch", "ch français"],
  ["ص", "ṣ", "ṣ", "s emphatique (bouche creusée, son sombre)"],
  ["ض", "ḍ", "ḍ", "d emphatique"],
  ["ط", "ṭ", "ṭ", "t emphatique"],
  ["ظ", "ẓ", "ẓ", "dh emphatique (« this » assombri)"],
  ["ع", "ʿ", "ʿ", "constriction du fond de la gorge (aucun équivalent français)"],
  ["غ", "ġ", "gh", "r parisien grasseyé"],
  ["ف", "f", "f", "f français"],
  ["ق", "q", "q", "k profond, prononcé contre la luette"],
  ["ك", "k", "k", "k français"],
  ["ل", "l", "l", "l français"],
  ["م", "m", "m", "m français"],
  ["ن", "n", "n", "n français"],
  ["ه", "h", "h", "h aspiré léger (comme en anglais « home »)"],
  ["و", "w", "w / ou", "w de « oui » ; ū/oû = ou long"],
  ["ي", "y", "y", "y de « yoga » ; ī/î = i long"],
];

function tutoTranslit() {
  let h = `<h2 class="sec">Deux styles au choix</h2>
  <p>Le site propose deux translittérations, à choisir dans Paramètres :
  la <b>scientifique stricte</b> (norme DIN/Arabica, celle des ouvrages académiques)
  et l'<b>hybride française</b> (digrammes lisibles : th, dj, kh, ch, gh, ou).
  Les deux notent les emphatiques et les longues : seule l'orthographe change.</p>
  <h2 class="sec">Les voyelles</h2>
  <ul>
    <li><b>a, i, u/ou</b> : voyelles brèves.</li>
    <li><b>ā, ī, ū</b> (scientifique) = <b>â, î, oû</b> (française) : voyelles longues,
      tenues 2 temps. Les allongements plus longs (4-6 temps) sont signalés par les
      couleurs de madd dans le texte arabe.</li>
    <li><b>ay, aw</b> : diphtongues (comme « aïe », « waouh »).</li>
  </ul>
  <h2 class="sec">Alphabet</h2>
  <table class="tuto-table"><tr><th>Lettre</th><th>Scientifique</th><th>Française</th><th>Prononciation</th></tr>`;
  for (const [ar, sci, fr, desc] of TL_TABLE) {
    h += `<tr><td class="var">${ar}</td><td><b>${esc(sci)}</b></td><td><b>${esc(fr)}</b></td><td>${esc(desc)}</td></tr>`;
  }
  h += `</table>
  <h2 class="sec">Signes et conventions</h2>
  <ul>
    <li><b>ʾ</b> (ou ') = hamza, <b>ʿ</b> = ʿayn : deux sons différents, la hamza est
      un simple arrêt, le ʿayn une compression de la gorge.</li>
    <li>Une <b>lettre doublée</b> (bb, mm, dd...) = shadda : appuyer nettement la lettre.</li>
    <li>Le <b>trait d'union</b> sépare l'article ou un préfixe : <i>bi-l-ghayb</i>,
      <i>wa-staʿînoû</i>. Devant une « lettre solaire », l'article s'assimile :
      <i>aṣ-ṣalât</i> (et non al-ṣalât).</li>
    <li>Un mot qui commence directement par deux consonnes (<i>ṣ-ṣirâṭa</i>, <i>dhâlika
      l-kitâbou</i>...) se lie au mot précédent : c'est l'élision de la hamzat wasl.</li>
    <li>En <b>fin de verset</b>, la forme pausale est notée : la voyelle finale tombe
      (<i>al-ʿâlamîn</i> et non <i>al-ʿâlamîna</i>).</li>
  </ul>
  <h2 class="sec">Ce que la translittération ne note PAS</h2>
  <p>Les assimilations de récitation entre mots (idghâm, iqlâb, ikhfâ' : par ex.
  <i>min rabbihim</i> récité « mir-rabbihim ») ne sont pas écrites : suis les
  <b>couleurs tajwid</b> du texte arabe et surtout l'<b>audio</b>, qui font autorité.</p>`;
  return h;
}

const TJ_LEGEND = [
  ["tj-gray", "Lettres muettes", "Lettre écrite mais non prononcée : hamzat wasl que la liaison efface, alif orthographique (souvent surmonté du rond fermé ۟), lam de l'article devant une lettre solaire. Masquables via l'option « ronds muets »."],
  ["tj-ghunna", "Ghunna", "Nasalisation de 2 temps sur نّ ou مّ (le son passe par le nez)."],
  ["tj-ikhfa", "Ikhfâ'", "Nûn sakina ou tanwin « caché » : nasalisation légère devant 15 lettres. Même principe pour le mîm devant ب."],
  ["tj-idgham", "Idghâm avec ghunna", "Le nûn/tanwin fusionne dans la lettre suivante (ي ن م و) avec nasalisation. Même principe pour un mîm dans un mîm."],
  ["tj-idgham-wo", "Idghâm sans ghunna", "Le nûn/tanwin fusionne dans ل ou ر, sans nasalisation : le n disparaît complètement."],
  ["tj-iqlab", "Iqlâb", "Nûn sakina ou tanwin devant ب : prononcé comme un mîm léger."],
  ["tj-qalqala", "Qalqala", "Rebond sonore sur ق ط ب ج د porteuses d'un soukoun (écrit ۡ, petite tête de khâ', comme dans le mushaf de Médine : le rond fermé, lui, signale une lettre muette)."],
  ["tj-madd2", "Madd naturel (2 temps)", "Allongement simple de la voyelle longue."],
  ["tj-madd4", "Madd permissible (2-4-6 temps)", "Allongement facultatif, souvent 4 temps (fin de verset notamment)."],
  ["tj-madd45", "Madd obligatoire (4-5 temps)", "Voyelle longue suivie d'une hamza (dans le mot ou au mot suivant)."],
  ["tj-madd6", "Madd nécessaire (6 temps)", "Allongement maximal (lettre suivie de shadda ou soukoun, lettres isolées d'ouverture)."],
  ["tj-special", "Idghâm mutajânisayn / mutaqâribayn", "Fusion de deux lettres proches (ex. د dans ت)."],
];

function tutoTajwid() {
  let h = `<p>Le texte arabe est colorié comme dans les mushafs tajwid : chaque couleur
    signale une règle à appliquer. La liste des règles présentes dans un roub', avec les
    versets exacts, est dans l'onglet « Tajwid » du roub'.</p>`;
  for (const [cls, nom, desc] of TJ_LEGEND) {
    h += `<div class="legend-item"><span class="sw" style="background:var(--${cls.replace("tj-", "tj-")})"></span>
      <span><b style="color:var(--${cls})">${esc(nom)}</b> : ${esc(desc)}</span></div>`;
  }
  h += `<p style="color:var(--muted)">Rappel : la couleur aide l'œil, mais c'est
    l'oreille qui apprend : imite l'audio de Husary, il applique chaque règle de
    façon exemplaire (c'est l'enregistrement de référence pour l'apprentissage).</p>`;
  return h;
}

function tutoRegles() {
  let h = "";
  const cats = [];
  for (const r of REGLES) if (!cats.includes(r.cat)) cats.push(r.cat);
  for (const cat of cats) {
    h += `<h2 class="sec">${esc(cat)}</h2>`;
    for (const r of REGLES.filter(x => x.cat === cat)) {
      h += `<div class="note-card" id="regle-${r.id}"><div class="nc-head">${esc(r.nom)}</div>
        ${fmt(r.texte)}
        ${r.exemple ? `<div style="margin-top:6px"><span class="ar-inline">${esc(r.exemple)}</span>
          ${r.exempleNote ? `<span style="color:var(--muted);font-size:13px"> — ${esc(r.exempleNote)}</span>` : ""}</div>` : ""}
      </div>`;
    }
  }
  h += `<p style="color:var(--muted);font-size:13px">Fiches établies d'après les
    matns classiques de référence : <b>Tuhfat al-Atfal</b> (al-Jamzûrî) et
    <b>al-Muqaddima al-Jazariyya</b> (Ibn al-Jazarî), pour la riwaya Hafs 'an
    'Asim ; exemples pris dans le texte du mushaf.</p>`;
  return h || `<div class="empty">Fiches à venir.</div>`;
}

/* ---------------- paramètres ---------------- */
/* les trois directions livrées par la refonte ; `police` est celle que le thème
   sélectionne d'office, l'utilisateur pouvant ensuite en changer */
const THEMES = [
  { id: "velin",    nom: "Vélin",    police: "Gentium Book", desc: "le livre posé",
    apercu: "Sérif, papier chaud", apercuSombre: "Brun d'encre chaud" },
  { id: "ardoise",  nom: "Ardoise",  police: "Noto Sans",    desc: "l'outil de tous les jours",
    apercu: "Sans empattement, dense", apercuSombre: "Ardoise neutre, sans bleu" },
  { id: "colophon", nom: "Colophon", police: "Charis",       desc: "l'édition savante",
    apercu: "Sérif d'édition, indigo", apercuSombre: "Nocturne indigo" },
];
/* Les trois polices de prose livrées avec la refonte, toutes sous licence SIL
   Open Font 1.1 et servies depuis le dépôt. `--font-ui` reste Noto Sans dans
   les trois directions : seule la prose change ici. */
const POLICES = [
  { id: "gentium",  nom: "Gentium Book", desc: "sérif de lecture" },
  { id: "notosans", nom: "Noto Sans",    desc: "sans empattement" },
  { id: "charis",   nom: "Charis",       desc: "sérif compacte" },
];
/* le nom de la police que le thème appliqué en ce moment choisit d'office :
   c'est ce qui rend l'option « Celle du thème » lisible plutôt qu'abstraite */
function policeDuTheme() {
  const t = THEMES.find(x => x.id === themeEffectif());
  return t ? t.police : THEMES[0].police;
}


/* ---- composants de la page Paramètres ----------------------------------
   Trois ajouts du 28/07, après comparaison avec la maquette : la page empilait
   DIX-HUIT rangées identiques, sans hiérarchie, chacune portant un paragraphe
   de 120 à 240 signes. Ce n'était pas une affaire de jetons mais de
   composition. D'où des sections nommées, un contrôle segmenté pour les choix
   courts, et des vignettes qui MONTRENT les thèmes au lieu de les nommer. */

/* choix court : on voit les options sans ouvrir quoi que ce soit */
function segment(champ, options, courant) {
  return `<div class="segment" role="group">` + options.map(([v, lab]) =>
    `<button type="button" class="${courant === v ? "on" : ""}" data-seg="${champ}" data-val="${v}"
      >${esc(lab)}</button>`).join("") + `</div>`;
}

/* Lit les couleurs d'un thème en les faisant RÉSOUDRE par le navigateur : on
   pose l'attribut sur :root le temps d'une lecture, puis on le remet. Les blocs
   de roub-themes.css visent `:root[data-theme=...]`, donc un élément imbriqué
   ne les déclencherait pas, et recopier les six palettes ici créerait une
   seconde source de vérité, exactement ce qu'on passe la journée à corriger.
   Tout est synchrone : aucun état intermédiaire n'est peint. */
function paletteDe(theme, mode) {
  const r = document.documentElement, y0 = window.scrollY;
  const t0 = r.getAttribute("data-theme"), m0 = r.getAttribute("data-mode");
  r.setAttribute("data-theme", theme);
  if (mode) r.setAttribute("data-mode", mode);
  const cs = getComputedStyle(r), p = {};
  for (const k of ["--bg", "--panel", "--border", "--text", "--muted", "--accent", "--accent2"]) {
    p[k] = cs.getPropertyValue(k).trim();
  }
  if (t0) r.setAttribute("data-theme", t0); else r.removeAttribute("data-theme");
  if (m0) r.setAttribute("data-mode", m0); else r.removeAttribute("data-mode");
  /* ⚠ essayer un thème change la HAUTEUR du document (mesuré : 2980 → 2876 px).
     Si le défilement courant dépasse le nouveau maximum, le navigateur le borne,
     et la position est perdue au retour. On la restaure : tout est synchrone,
     donc rien n'est peint entre-temps. */
  if (window.scrollY !== y0) window.scrollTo(0, y0);
  return p;
}

/* une vignette par thème : barre du haut, deux lignes de texte, les deux
   accents. On montre ce qu'on va obtenir plutôt que d'en donner le nom. */
function vignettesTheme(champ, mode) {
  const actif = modeEffectif() === mode;
  const nomMode = mode === "light" ? "clair" : "sombre";
  return `<div class="param-bloc param-bloc-large">
    <div class="lab"><b>Thème du mode ${nomMode}
      <span class="etat ${actif ? "on" : ""}">${actif ? "appliqué maintenant" : "en veille"}</span></b>
      <span>Employé quand le mode ${nomMode} est actif.</span></div>
    <div class="vignettes">${THEMES.map(th => {
      const p = paletteDe(th.id, mode), choisi = PARAMS[champ] === th.id;
      return `<button type="button" class="vignette ${choisi ? "on" : ""}"
        data-seg="${champ}" data-val="${th.id}">
        <span class="v-vue" style="background:${p["--bg"]};border-color:${p["--border"]}">
          <span class="v-barre" style="background:${p["--panel"]};border-color:${p["--border"]}"></span>
          <span class="v-t1" style="background:${p["--text"]}"></span>
          <span class="v-t2" style="background:${p["--muted"]}"></span>
          <span class="v-a1" style="background:${p["--accent"]}"></span>
          <span class="v-a2" style="background:${p["--accent2"]}"></span>
        </span>
        <span class="v-nom">${esc(th.nom)}${choisi ? "<b>choisi</b>" : ""}</span>
        <span class="v-desc">${esc(mode === "dark" ? th.apercuSombre : th.apercu)}</span>
      </button>`;
    }).join("")}</div>
  </div>`;
}

/* une rangée ordinaire : libellé, explication courte, commande à droite */
function rangee(titre, desc, commande) {
  return `<div class="param-bloc"><div class="lab"><b>${titre}</b>
    ${desc ? `<span>${desc}</span>` : ""}</div>${commande}</div>`;
}
function interrupteur(champ) {
  return `<label class="switch"><input type="checkbox" data-param="${champ}"
    ${PARAMS[champ] ? "checked" : ""}><span class="sl"></span></label>`;
}
function section(titre, contenu) {
  return `<h2 class="param-sec">${titre}</h2><div class="param-groupe">${contenu}</div>`;
}

function pageParams() {
  const listePolice = `<select data-param="police">
      <option value="auto" ${!POLICES.some(p => p.id === PARAMS.police) ? "selected" : ""}
        >Celle du thème (${policeDuTheme()})</option>
      ${POLICES.map(p => `<option value="${p.id}" ${PARAMS.police === p.id ? "selected" : ""}
        >${p.nom} · ${p.desc}</option>`).join("")}
    </select>`;

  const sync = !SYNC_ON
    ? rangee("Synchronisation multi-appareils",
        "Bientôt : reprendre sa progression sur un autre appareil, par code secret anonyme.",
        `<button class="fb-send" disabled>Bientôt</button>`)
    : SYNC
    ? rangee("Synchronisation active",
        `Ce navigateur est associé à un code. <span id="sync-status">${esc(syncStatus || "en attente de la première synchro")}</span>`,
        `<span class="param-actions">
          <button class="fb-send" data-sync-show>Voir le code</button>
          <button class="iconbtn" data-sync-unlink title="dissocier ce navigateur (la progression locale reste)">Dissocier</button>
        </span>`)
    : rangee("Synchronisation multi-appareils",
        "Un code secret sur le premier appareil, saisi sur les autres : la progression fusionne. <b>Le code est irrécupérable.</b>",
        `<span class="param-actions">
          <button class="fb-send" data-sync-create>Générer un code</button>
          <button class="iconbtn" data-sync-join>Saisir un code</button>
        </span>`);

  return `<div class="hero"><h1>Paramètres</h1></div>
  <p class="param-intro">Tout reste dans ce navigateur. Rien n'est envoyé ailleurs sans que tu l'actives.</p>

  ${section("Apparence",
    rangee("Mode", "Pilote aussi la bascule en haut à droite.",
      segment("mode", [["auto", "Suivre le système"], ["light", "Clair"], ["dark", "Sombre"]],
        PARAMS.mode === "light" || PARAMS.mode === "dark" ? PARAMS.mode : "auto"))
    + vignettesTheme("themeClair", "light")
    + vignettesTheme("themeSombre", "dark")
    + rangee("Police", "Celle du thème est prise d'office. En changer ne change pas le thème.", listePolice)
    + rangee("Taille du texte", "Agit sur toute l'application. Ton navigateur a aussi son propre réglage, qui reste respecté.",
        segment("taille", [["compacte", "Compacte"], ["normale", "Normale"], ["grande", "Grande"]],
          PARAMS.taille || "normale"))
    + rangee("Largeur de page", "La largeur des colonnes de lecture. Les écrans qu'on parcourt ne bougent pas.",
        segment("largeur", [["etroite", "Étroite"], ["normale", "Normale"], ["large", "Large"]],
          PARAMS.largeur || "normale"))
    + rangee("Animations", "Réduites : les écrans se remplacent par un fondu, sans glissement.",
        segment("anim", [["auto", "Suivre le système"], ["reduite", "Réduites"], ["complete", "Complètes"]],
          PARAMS.anim === "reduite" || PARAMS.anim === "complete" ? PARAMS.anim : "auto")))}

  ${section("Lecture",
    rangee("Translittération",
      `Hybride française (th, dj, kh, ou...) ou scientifique stricte (ṯ, ǧ, ḫ, ū...) : <span class="vref" data-tuto="translit">le tutoriel →</span>`,
      `<select data-param="translit">
        <option value="fr" ${PARAMS.translit === "fr" ? "selected" : ""}>Hybride française</option>
        <option value="sci" ${PARAMS.translit === "sci" ? "selected" : ""}>Scientifique stricte</option>
      </select>`)
    + rangee("Translittération visible", "Affichée sous chaque verset.", interrupteur("showTl"))
    + rangee("Traduction visible", "Hamidullah, sous chaque verset.", interrupteur("showTr"))
    + rangee("Couleurs tajwid", "Les douze couleurs ne changent pas avec le thème.", interrupteur("taj"))
    + rangee("Ronds des lettres muettes",
        "Le rond fermé ۟ du mushaf sur les lettres écrites mais non prononcées ; certains mushafs ne l'impriment pas.",
        interrupteur("silentMarks")))}

  ${section("Récitation",
    `<div class="param-bloc"><div class="lab"><b>Style de récitation</b>
      <span>Al-Husary dans les quatre cas. Seul le murattal 64 kbps est fourni
      avec l'appli ; les autres se chargent depuis leur source et restent en
      cache après écoute.</span>
      <details class="aide-repli"><summary>Lequel choisir ?</summary>
    <div class="aide-styles">${gloss(`<p>Les quatre enregistrements sont du cheikh <b>Mahmoud Khalil
    al-Husary</b> (Hafs 'an 'Âsim) : ils diffèrent par l'allure, non par le texte.</p>
    <p><b>Murattal</b> : pour mémoriser, lecture mesurée, sans ornementation. Les versions
    64 et 128 kbps sont la <b>même récitation</b>, seule la finesse du son change.</p>
    <p><b>Mu'allim</b> : pour répéter derrière le cheikh, plus lente et plus détachée. Elle
    rejoint ce qu'Ibn al-Jazarî appelle le {{taḥqîq}}, « l'allure recommandée à celui qui
    apprend » (<i>an-Nashr</i>, t. I).</p>
    <p><b>Mujawwad</b> : pour écouter, solennelle et mélodique, prolongations longuement
    tenues ; sur un même verset, 13,4 secondes contre 8,0 en murattal.</p>
    <p>Si tu utilises un bloqueur de publicités, autorise-lui <code>mirrors.quranicaudio.com</code>
    et <code>audio-cdn.tarteel.ai</code> : sinon ces trois styles restent muets, le murattal
    64 kbps étant le seul fourni avec l'appli.</p>
    <p class="src">Ibn al-Jazarî rappelle que ces allures sont toutes licites.
    <span class="vref" data-tuto="styles">Tout le tutoriel des styles →</span></p>`)}</div>
      </details></div>
    <select data-param="recitation">
      ${Object.entries(RECITS).map(([k, r]) =>
        `<option value="${k}" ${recitKey() === k ? "selected" : ""}>${esc(r.nom)}</option>`).join("")}
    </select></div>`
    + rangee("Soulignage mot à mot", "Souligne le mot en cours dans le texte arabe.", interrupteur("karaoke"))
    + rangee("Vitesse audio", "", `<select data-param="speed">
        ${[0.75, 1, 1.25].map(x => `<option value="${x}" ${PARAMS.speed === x ? "selected" : ""}>${x}×</option>`).join("")}
      </select>`))}

  ${section("Révision et avis",
    rangee("Nouvelles cartes par session", "Révision espacée.",
      `<select data-param="newLimit">
        ${[5, 10, 15, 20, 30].map(x => `<option value="${x}" ${PARAMS.newLimit === x ? "selected" : ""}>${x}</option>`).join("")}
      </select>`)
    + rangee("Exporter mes avis",
        `Un fichier .json avec tes notes et remarques, à envoyer à <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>`,
        `<button class="fb-send" data-fb-export>Exporter</button>`))}

  ${section("Hors connexion",
    `<div class="param-bloc param-bloc-large"><div class="lab"><b>Précharger</b>
      <span>Le texte, les notes, le tafsir et l'interface sont déjà gardés dès la
      première visite. Choisis ce que tu veux ajouter ; sur iPhone et iPad, le
      quota de cache peut limiter le préchargement.
      <span id="preload-status"></span></span></div>
      <div class="preload-list">
      ${[["pages", "Pages du mushaf"]].concat(Object.entries(RECITS).map(([k, r]) => [k, r.nom]))
        .map(([k, nom]) => `<div class="preload-item"><span>${esc(nom)} <b>~${PRELOAD_MO[k]} Mo</b></span>
          <button class="iconbtn" data-preload="${k}" ${("serviceWorker" in navigator) && navigator.serviceWorker.controller ? "" : "disabled title='disponible sur la version en ligne (après un premier chargement)'"}>Précharger</button></div>`).join("")}
      </div></div>`)}

  ${section("Synchronisation", sync)}

  <p class="param-pied">Version : <b id="appver">${esc(APPVER || "…")}</b><br><br>
    <b>Anis</b> (co-fondateur, docteur en mathématiques) : à l'origine de la
    méthode. <b>Yusuf</b> (co-fondateur, interne en médecine) : conception et
    réalisation. <b>Israa</b> (ostéopathe) : conseillère pédagogique.
    Avis et contact :
    <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a> · Discord
    <b>@ophtalmologie</b>.<br><br>
    Texte coranique, calligraphie, traduction, récitations, segments mot à mot
    et tafsir viennent de sources tierces, en usage non commercial : chacune est
    nommée avec son édition, sa version, sa provenance et ses conditions sur la
    <span class="vref" data-goto-page="sources">page Sources</span>, qui donne aussi la
    bibliographie normalisée et correspond au fichier SOURCES.md du dépôt. Application gratuite et non commerciale,
    sans compte : progression et réglages restent dans ce navigateur, et rien
    n'est envoyé ailleurs sauf si la synchronisation multi-appareils est activée
    (code secret anonyme, aucune donnée personnelle). Tout le contenu religieux est sourcé et vérifié contre ses
    sources ; une erreur restant toujours possible, merci de signaler tout
    doute via le widget d'avis ou <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>.
    Code sous licence AGPL-3.0, contenu éditorial sous
    CC BY-NC-SA 4.0 (détails sur le dépôt GitHub). © 2026 Anis &amp; Yusuf.</p>`;
}

/* ---------------- feedback ---------------- */
function fbBox(rid) {
  const cur = FB["fb-" + rid] || {};
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += `<span data-fb-star="${i}" class="${(cur.stars || 0) >= i ? "lit" : ""}">★</span>`;
  }
  return `<div class="fb-box" data-fb-rub="${rid}">
    <b>Ton avis sur ce roub'</b> <span class="fb-note">(tout le contenu est sourcé et vérifié, mais une erreur reste toujours possible : signale-la, chaque avis est lu)</span><br>
    <span class="fb-stars">${stars}</span>
    <textarea placeholder="Remarques : difficulté mal notée, tafsir à préciser, carte inutile...">${esc(cur.text || "")}</textarea><br>
    <button class="fb-send">Envoyer</button>
    <span class="fb-note" id="fb-status">${cur.ts ? "envoyé le " + esc(cur.ts) : ""}</span>
    <span class="fb-note">· <a data-fb-export style="cursor:pointer">exporter tous mes avis</a>
      (fichier à envoyer à Yusuf : <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>)</span>
  </div>`;
}

/* ---------------- mini-markdown ---------------- */
function fmt(txt) {
  /* **gras**, *italique*, retours ligne ; {2:15} ou {2:21-22} = référence
     cliquable (la plage renvoie vers le PREMIER verset cité) ;
     [[texte arabe]] = rendu en police coranique */
  let h = esc(txt);
  h = h.replace(/\[\[([^\]]+)\]\]/g, (m, ar) =>
    `<span class="ar-inline">${arDisplay(ar)}</span>`);
  h = h.replace(/\{(\d+:\d+)(?:-(\d+))?\}/g, (m, key, fin) =>
    `<span class="vref" data-goto="${key}">${key}${fin ? "-" + fin : ""}</span>`);
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/\*([^*]+)\*/g, "<i>$1</i>");
  h = h.replace(/\n/g, "<br>");
  return `<div>${h}</div>`;
}

/* ---------------- liaisons ---------------- */
function bindMain() {
  const main = $("#main");

  $$("[data-rub]", main).forEach(el => el.addEventListener("click", () => {
    const r = RUBS.find(x => x.id === el.dataset.rub);
    if (r && r.dispo !== false) nav("rub/" + el.dataset.rub);
  }));
  $$("[data-goto-home]", main).forEach(el =>
    el.addEventListener("click", () => nav("home")));
  $$("[data-goto-page]", main).forEach(el =>
    el.addEventListener("click", () => nav(el.dataset.gotoPage)));
  $$("[data-tab]", main).forEach(el => el.addEventListener("click", () => {
    const { a } = route();
    nav(`rub/${a}/${el.dataset.tab}`);
  }));
  $$("[data-tuto]", main).forEach(el =>
    el.addEventListener("click", () => nav("tutoriels/" + el.dataset.tuto)));

  /* renvois {s:a} -> onglet mémoriser, scroll + flash */
  $$("[data-goto]", main).forEach(el => el.addEventListener("click", ev => {
    ev.stopPropagation();
    gotoVerse(el.dataset.goto);
  }));
  $$("[data-regle]", main).forEach(el => el.addEventListener("click", () => {
    nav("tutoriels/regles");
    setTimeout(() => {
      const t = $("#regle-" + el.dataset.regle);
      if (t) { t.scrollIntoView({ block: "center" }); t.style.borderColor = "var(--accent)"; }
    }, 60);
  }));

  /* options mémorisation */
  $$("[data-opt]", main).forEach(el => el.addEventListener("click", () => {
    PARAMS[el.dataset.opt] = !PARAMS[el.dataset.opt];
    saveParams(); render();
  }));
  $$("[data-mask]", main).forEach(el => el.addEventListener("click", () => {
    memoState[el.dataset.mask] = !memoState[el.dataset.mask];
    render();
  }));
  $$("[data-mode]", main).forEach(el => el.addEventListener("click", () => {
    memoState.mode = el.dataset.mode;
    render();
  }));
  $$("[data-pgcolor]", main).forEach(el => el.addEventListener("click", () => {
    memoState.pagesColor = !memoState.pagesColor;
    render();
  }));

  /* auto-évaluation (mise à jour en place, sans re-render pour garder le scroll) */
  $$("[data-eval]", main).forEach(el => el.addEventListener("click", ev => {
    ev.stopPropagation();
    const k = el.dataset.eval;
    const n = evalCycle(k);
    el.className = "evalbtn e" + n;
    el.title = `auto-évaluation : ${EVAL_LABELS[n]} (clic pour changer)`;
  }));
  $$("[data-eval-note]", main).forEach(el => el.addEventListener("click", ev => {
    ev.stopPropagation();
    evalNote(el.dataset.evalNote);
  }));
  const audioEval = $("#audio-eval", main);
  if (audioEval) audioEval.addEventListener("click", () => {
    const k = audioEval.dataset.evalKey;
    if (!k) return;
    evalCycle(k);
    updateAudioBar();
    const vend = $(`.mver[data-k="${k}"] .vend`, main);
    if (vend) vend.className = "vend e" + ((EVAL[k] || {}).n || 0);
  });
  $$(".masked[data-reveal]", main).forEach(el =>
    el.addEventListener("click", () => el.classList.toggle("revealed")));

  /* audio */
  const { page, a: curRub } = route();
  if (page === "rub" && QURAN[curRub]) {
    const R = QURAN[curRub];
    const queue = R.verses.map(v => ({ k: v.k, audio: v.audio }));
    $$("[data-play-one]", main).forEach(el => el.addEventListener("click", () => {
      const i = +el.dataset.playOne;
      player.loopRange = false;
      player.play([queue[i]], 0);
    }));
    $$("[data-play-from]", main).forEach(el => el.addEventListener("click", () => {
      player.play(queue, +el.dataset.playFrom);
    }));
    $$(".mver", main).forEach(el => el.addEventListener("click", ev => {
      const i = +el.dataset.i;
      if (ev.detail >= 2) player.enchaine(queue, i, motDe(ev.target));  // double-clic : à partir de ce mot
      else player.play([queue[i]], 0, false);                           // simple : ce verset seul
    }));
    const rubIdx = {};
    R.verses.forEach((v, i) => { rubIdx[v.k] = i; });
    $$(".qw", main).forEach(el => el.addEventListener("click", ev => {
      const k = el.dataset.k;
      if (ev.detail >= 2 && k in rubIdx) { player.enchaine(queue, rubIdx[k], motDe(ev.target)); return; }
      const hit = VIDX[k];
      if (hit) {
        player.loopRange = false;
        player.play([{ k, audio: hit.v.audio }], 0, false);
      }
    }));
    $$("[data-audio]", main).forEach(el => el.addEventListener("click", () => {
      const act = el.dataset.audio;
      if (act === "playall") player.play(queue, 0);
      else if (act === "pause") player.toggle();
      else if (act === "stop") player.stop();
      else if (act === "loop") {
        player.loopRange = !player.loopRange;
        el.classList.toggle("on", player.loopRange);
      }
      /* répétition, boucle et vitesse se règlent une fois et ne se touchent pas
         en lisant : sur téléphone ils passent derrière ce bouton, ce qui rend la
         barre à une seule rangée. En large le panneau est toujours déplié et le
         bouton n'existe pas (CSS), donc ce cas n'y sert jamais. */
      else if (act === "reglages") {
        const bar = el.closest(".audiobar");
        const ouvert = bar.classList.toggle("reglages-ouverts");
        el.setAttribute("aria-expanded", ouvert ? "true" : "false");
      }
    }));
    const rep = $("#audio-rep", main);
    if (rep) rep.addEventListener("change", () => {
      player.rep = +rep.value; player.repLeft = player.rep;
    });
    const spd = $("#audio-speed", main);
    if (spd) spd.addEventListener("change", () => {
      PARAMS.speed = +spd.value; saveParams();
      player.el.playbackRate = PARAMS.speed;
    });
  }
  $$("[data-oneshot]", main).forEach(el => el.addEventListener("click", ev => {
    ev.stopPropagation();
    playOneShot(el.dataset.oneshot);
  }));

  /* révision */
  $$("[data-rev-rub]", main).forEach(el => el.addEventListener("click", () => {
    const id = el.dataset.revRub;
    if (rev.sel.has(id)) rev.sel.delete(id); else rev.sel.add(id);
    render();
  }));
  $$("[data-rev-type]", main).forEach(el => el.addEventListener("click", () => {
    const t = el.dataset.revType;
    if (rev.types.has(t)) rev.types.delete(t); else rev.types.add(t);
    render();
  }));
  $$("[data-rev-lacunes]", main).forEach(el => el.addEventListener("click", () => {
    rev.lacunes = !rev.lacunes;
    render();
  }));
  $$("[data-rev-start]", main).forEach(el =>
    el.addEventListener("click", () => startSession(collectCards())));
  $$("[data-start-deck]", main).forEach(el => el.addEventListener("click", () => {
    const rid = el.dataset.startDeck;
    rev.sel = new Set([rid]);
    rev.types = new Set(["chain", "vocab", "mutash", "sens"]);
    startSession(collectCards());
    nav("revision");
  }));
  $$("[data-rev-show]", main).forEach(el => el.addEventListener("click", () => {
    rev.session.shown = true; render();
  }));
  $$("[data-grade]", main).forEach(el => el.addEventListener("click", () => {
    const s = rev.session;
    const c = currentCard();
    srsAnswer(c.id, el.dataset.grade);
    if (el.dataset.grade === "again") s.again.push(c);
    else s.done++;
    s.i++; s.shown = false;
    render();
  }));
  $$("[data-rev-back]", main).forEach(el => el.addEventListener("click", () => {
    rev.session = null;
    nav("revision"); render();
  }));

  /* paramètres */
  /* segments et vignettes : un bouton porte le champ et sa valeur. Même
     effet qu'une liste déroulante, mais la valeur courante se lit sans ouvrir. */
  /* Un réglage n'est pas une navigation : la page ne doit pas bouger d'un pixel
     sous le curseur. `render()` reconstruit #main, dont la hauteur change d'un
     rendu à l'autre, donc on remet le défilement là où il était. Signalé par
     Yusuf le 28/07 : « à chaque fois que je clique sur un paramètre, la page
     descend un peu ». */
  const sansBouger = f => { const y = window.scrollY; f(); window.scrollTo(0, y); };
  $$("[data-seg]", main).forEach(el => el.addEventListener("click", () => {
    PARAMS[el.dataset.seg] = el.dataset.val;
    saveParams();   // saveParams appelle déjà applyTheme()
    sansBouger(render);   // l'état « appliqué maintenant / en veille » change aussi
  }));
  $$("[data-param]", main).forEach(el => {
    el.addEventListener("change", () => {
      const k = el.dataset.param;
      if (el.type === "checkbox") PARAMS[k] = el.checked;
      else if (k === "speed") PARAMS[k] = +el.value;
      else if (k === "newLimit") PARAMS[k] = +el.value;
      else PARAMS[k] = el.value;
      saveParams();   // saveParams appelle déjà applyTheme()
      /* changer de mode ou de thème change aussi le libellé « appliqué
         maintenant / en veille » des deux rangées : il faut repeindre l'écran */
      if (["mode", "themeClair", "themeSombre", "police", "anim", "taille", "largeur"].includes(k)) sansBouger(render);
    });
  });

  /* feedback + préchargement */
  $$("[data-fb-export]", main).forEach(el =>
    el.addEventListener("click", () => exportFB()));
  /* le bloc d'accueil se souvient de son état : ouvert la première fois,
     replié dès qu'on l'a replié soi-même (flèche du dépliant) */
  $$("details.accueil", main).forEach(el => el.addEventListener("toggle", () => {
    store.set("quran-accueil-vu", !el.open);
  }));

  /* glossaire : la bulle s'ouvre au clic sur le terme, se referme au reclic */
  $$("[data-gloss]", main).forEach(el => el.addEventListener("click", ev => {
    ev.stopPropagation();
    const ouverte = el.nextElementSibling && el.nextElementSibling.classList.contains("gloss-bulle");
    $$(".gloss-bulle", main).forEach(b => b.remove());
    $$(".gloss.on", main).forEach(g => g.classList.remove("on"));
    if (ouverte) return;
    el.insertAdjacentHTML("afterend", glossBulle(el.dataset.gloss));
    el.classList.add("on");
  }));

  /* le paquet est précaché avec la coquille : le téléchargement marche donc
     hors connexion. On passe quand même par fetch pour pouvoir prévenir si
     le fichier manque (cache purgé, copie locale incomplète). */
  $$("[data-apkg]", main).forEach(el => el.addEventListener("click", async () => {
    const lienDirect = (href) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = "roub-cartes.apkg";
      document.body.appendChild(a); a.click(); a.remove();
    };
    // copie locale (file://) : fetch y est interdit par le navigateur, mais le
    // fichier est là, à côté : le lien direct suffit
    if (location.protocol === "file:") { lienDirect("anki/roub-cartes.apkg"); return; }
    const initial = el.textContent;
    el.disabled = true;
    el.textContent = "préparation…";
    try {
      const r = await fetch("anki/roub-cartes.apkg");
      if (!r.ok) throw new Error(r.status);
      const url = URL.createObjectURL(await r.blob());
      lienDirect(url);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      lienDirect("anki/roub-cartes.apkg");    // dernier recours : lien brut
      el.textContent = "si rien ne se télécharge : réessaie une fois en ligne";
      setTimeout(() => { el.textContent = initial; el.disabled = false; }, 6000);
      return;
    }
    el.textContent = initial;
    el.disabled = false;
  }));
  $$("[data-preload]", main).forEach(el => el.addEventListener("click", () => {
    el.disabled = true;
    el.textContent = "en cours…";
    preloadAll($("#preload-status", main), el.dataset.preload)
      .then(() => { el.textContent = "fait ✓"; });
  }));
  $$("[data-sync-create]", main).forEach(el =>
    el.addEventListener("click", () => syncCreate()));
  $$("[data-sync-join]", main).forEach(el => el.addEventListener("click", () => {
    const raw = prompt("Code de synchronisation (ex. K7QM-4WPX-93RT) :");
    if (raw !== null) syncJoin(raw);
  }));
  $$("[data-sync-show]", main).forEach(el => el.addEventListener("click", () => {
    prompt("Ton code de synchronisation (à garder secret) :", (SYNC || {}).code || "");
  }));
  $$("[data-sync-unlink]", main).forEach(el => el.addEventListener("click", () => {
    if (confirm("Dissocier ce navigateur ? La progression locale reste ; " +
                "tu pourras te ré-associer avec le même code.")) {
      SYNC = null;
      localStorage.removeItem("quran-sync");
      render();
    }
  }));
  $$("[data-fb-rub]", main).forEach(box => {
    const rid = box.dataset.fbRub;
    let stars = (FB["fb-" + rid] || {}).stars || 0;
    $$("[data-fb-star]", box).forEach(st => st.addEventListener("click", () => {
      stars = +st.dataset.fbStar;
      $$("[data-fb-star]", box).forEach(x =>
        x.classList.toggle("lit", +x.dataset.fbStar <= stars));
    }));
    $(".fb-send", box).addEventListener("click", async () => {
      const entry = {
        id: "fb-" + rid, rub: rid, stars,
        text: $("textarea", box).value.trim(),
        ts: new Date().toISOString().slice(0, 16).replace("T", " "),
      };
      const ok = await sendFB(entry);
      $("#fb-status", box).textContent = ok
        ? "envoyé ✓" : "gardé en local (serveur absent) ✓";
    });
  });
}

function gotoVerse(key) {
  const hit = VIDX[key];
  if (!hit) return;
  const { page, a, b } = route();
  const go = () => {
    const el = $(`.verse[data-k="${key.replace(":", "\\:")}"]`);
    if (el) {
      el.scrollIntoView({ block: "center" });
      el.style.borderColor = "var(--accent2)";
      setTimeout(() => { el.style.borderColor = ""; }, 1800);
    }
  };
  if (page === "rub" && a === hit.rid && (b || "memoriser") === "memoriser") go();
  else { nav(`rub/${hit.rid}/memoriser`); setTimeout(go, 80); }
}

function updateAudioBar() {
  const now = $("#audio-now");
  if (now) {
    now.textContent = player.playing && player.queue[player.qi]
      ? player.queue[player.qi].k + (player.rep > 1 ? ` (${player.rep - player.repLeft + 1}/${player.rep})` : "")
      : "—";
  }
  const p = $("#audio-pause");
  if (p) p.textContent = player.el.paused ? "▶" : "⏸";
  const ev = $("#audio-eval");
  if (ev) {
    const item = player.queue[player.qi];
    if (player.playing && item) {
      const n = (EVAL[item.k] || {}).n || 0;
      ev.style.display = "";
      ev.className = "evalbtn e" + n;
      ev.title = `auto-évaluation de ${item.k} : ${EVAL_LABELS[n]} (clic pour changer)`;
      ev.dataset.evalKey = item.k;
    } else {
      ev.style.display = "none";
    }
  }
}

/* ---------------- synchro multi-appareils (code anonyme, Lot F) ----------
   Le code secret n'est JAMAIS envoyé : seul son hash SHA-256 sert de clé de
   ligne côté Supabase (voir docs/SYNC.md). Désactivé tant que sync-config.js
   n'est pas renseigné : tout reste local, aucun appel réseau. */
const SYNC_CFG = window.SYNC_CONFIG || { url: "", anonKey: "" };
const SYNC_ON = !!(SYNC_CFG.url && SYNC_CFG.anonKey);
let SYNC = store.get("quran-sync", null);   // {code, hash}
let syncStatus = "";
let syncDernier = "";        // heure du dernier envoi réussi (jamais effacée)

function genCode() {
  const AB = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // sans I, L, O, 0, 1
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 12; i++) {
    s += AB[buf[i] % AB.length];
    if (i === 3 || i === 7) s += "-";
  }
  return s;
}
async function hashCode(code) {
  const norm = "quran-hifz:" + code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}
const syncHeaders = () => ({
  apikey: SYNC_CFG.anonKey,
  Authorization: "Bearer " + SYNC_CFG.anonKey,
  "Content-Type": "application/json",
});
function localPayload() {
  return { v: 1, srs: SRS, journal: store.get(JOURNAL_KEY, {}), eval: EVAL };
}
function mergeRemote(remote) {
  if (!remote) return;
  for (const [id, r] of Object.entries(remote.srs || {})) {
    const l = SRS[id];
    if (!l || r.reps > l.reps || (r.reps === l.reps && (r.due || 0) > (l.due || 0))) {
      SRS[id] = r;
    }
  }
  store.set(SRS_KEY, SRS);
  const j = store.get(JOURNAL_KEY, {});
  for (const [day, d] of Object.entries(remote.journal || {})) {
    if (!j[day] || d.n > j[day].n) j[day] = d;
  }
  store.set(JOURNAL_KEY, j);
  for (const [k, e] of Object.entries(remote.eval || {})) {
    if (!EVAL[k] || (e.ts || 0) > (EVAL[k].ts || 0)) EVAL[k] = e;
  }
  store.set(EVAL_KEY, EVAL);
}
/* état de la synchro : il doit dire la VÉRITÉ du moment. Un « synchronisé
   14:32 » figé alors que les envois échouent depuis est trompeur : on
   distingue donc le dernier succès de l'état courant, et un échec le dit. */
const heure = () => new Date().toLocaleTimeString("fr-FR").slice(0, 5);
function syncOk() {
  syncDernier = heure();
  syncStatus = "synchronisé " + syncDernier;
  majSyncUI();
}
function syncKo(raison) {
  syncStatus = (navigator.onLine === false || raison === "reseau"
    ? "hors connexion : la synchro reprendra au retour du réseau"
    : "échec de la dernière synchro : nouvelle tentative automatique")
    + (syncDernier ? ` (dernier envoi réussi à ${syncDernier})` : "");
  majSyncUI();
  planifierReprise();
}
/* mise à jour en place : la page Paramètres est souvent déjà affichée */
function majSyncUI() {
  const el = $("#sync-status");
  if (el) el.textContent = syncStatus;
}

async function syncPull() {
  if (!SYNC_ON || !SYNC) return false;
  try {
    const r = await fetch(`${SYNC_CFG.url}/rest/v1/progress?id=eq.${SYNC.hash}&select=data`,
      { headers: syncHeaders() });
    if (!r.ok) { syncKo("serveur"); return false; }
    const rows = await r.json();
    if (rows.length) mergeRemote(rows[0].data);
    syncOk();
    return true;
  } catch (e) { syncKo("reseau"); return false; }
}
async function syncPush() {
  if (!SYNC_ON || !SYNC) return false;
  try {
    const r = await fetch(`${SYNC_CFG.url}/rest/v1/progress`, {
      method: "POST",
      headers: Object.assign(syncHeaders(), { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify([{ id: SYNC.hash, data: localPayload() }]),
    });
    if (r.ok) syncOk(); else syncKo("serveur");
    return r.ok;
  } catch (e) { syncKo("reseau"); return false; }
}
let pushTimer = null;
function schedulePush() {
  if (!SYNC_ON || !SYNC) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 4000);
}

/* après un échec, on retente tout seul : sinon la progression du moment
   n'est envoyée qu'au prochain changement, parfois bien plus tard */
let retryTimer = null, retryDelai = 60000;
function planifierReprise() {
  if (!SYNC_ON || !SYNC || retryTimer) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    const ok = await syncPush();
    retryDelai = ok ? 60000 : Math.min(retryDelai * 2, 15 * 60000);
    if (!ok) planifierReprise();
  }, retryDelai);
}
async function syncCreate() {
  const ok = confirm(
    "Ton code de synchronisation va être créé et affiché.\n\n" +
    "⚠️ GARDE-LE EN LIEU SÛR (gestionnaire de mots de passe, papier...) : " +
    "il est IRRÉCUPÉRABLE. Code perdu = synchronisation perdue " +
    "(la progression locale de chaque appareil reste intacte).\n\nContinuer ?");
  if (!ok) return;
  const code = genCode();
  SYNC = { code, hash: await hashCode(code) };
  store.set("quran-sync", SYNC);
  await syncPush();
  prompt("Ton code de synchronisation (copie-le MAINTENANT et range-le) :", code);
  render();
}
async function syncJoin(raw) {
  const code = (raw || "").toUpperCase().trim();
  if (code.replace(/[^A-Z0-9]/g, "").length !== 12) {
    alert("Code invalide (attendu : 12 caractères, ex. K7QM-4WPX-93RT).");
    return;
  }
  SYNC = { code, hash: await hashCode(code) };
  store.set("quran-sync", SYNC);
  const ok = await syncPull();
  await syncPush();
  alert(ok ? "Appareil associé : progression fusionnée ✓"
           : "Code enregistré ; la fusion se fera dès que le serveur répond.");
  render();
}

/* ---------------- PWA : service worker + mises à jour ---------------- */
const BUILD_VERSION = "1.17.2";   // réécrit par tools/release.py
const SITE_URL = "https://yusuf-oph.github.io/roub/";
let APPVER = "";
async function fetchVersion() {
  if (location.protocol.startsWith("http")) {
    try {
      const v = await (await fetch("version.json", { cache: "no-store" })).json();
      APPVER = `${v.version} · ${v.date}`;
    } catch (e) {
      // la version installée est connue : ne pas afficher « hors-ligne » à sa place
      APPVER = BUILD_VERSION + " (vérification des mises à jour impossible)";
    }
  } else {
    // copie locale (file://) : version embarquée + comparaison avec le site
    APPVER = BUILD_VERSION + " · copie locale";
    try {
      const v = await (await fetch(SITE_URL + "version.json", { cache: "no-store" })).json();
      if (v.version !== BUILD_VERSION && !$("#maj-banner")) {
        const b = document.createElement("div");
        b.id = "maj-banner";
        b.innerHTML = `<span>Ta copie locale (${esc(BUILD_VERSION)}) n'est plus à jour :
          la version ${esc(v.version)} est en ligne.</span>
          <button>Ouvrir le site</button>`;
        b.querySelector("button").addEventListener("click", () => {
          window.open(SITE_URL, "_blank");
        });
        document.body.appendChild(b);
      }
    } catch (e) { /* pas de réseau : silencieux */ }
  }
  const el = $("#appver");
  if (el) el.textContent = APPVER;
}
function swInit() {
  if (!("serviceWorker" in navigator) || !location.protocol.startsWith("http")) return;
  navigator.serviceWorker.register("sw.js").then(reg => {
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg); };
    check();
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (nw) nw.addEventListener("statechange", check);
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}
async function showUpdateBanner(reg) {
  if ($("#maj-banner")) return;
  let d = "";
  try {
    const v = await (await fetch("version.json", { cache: "no-store" })).json();
    d = ` · v${v.version} : ${(v.notes && v.notes[0]) || ""}`;
  } catch (e) {}
  const b = document.createElement("div");
  b.id = "maj-banner";
  b.innerHTML = `<span>Nouvelle version disponible${esc(d)}</span>
    <button>Mettre à jour</button>`;
  b.querySelector("button").addEventListener("click", () => {
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  });
  document.body.appendChild(b);
}
/* préchargement à la carte : « pages » (mushaf) ou la clé d'un style de
   récitation ; chacun se met en cache séparément, on ne paie que ce qu'on veut */
function preloadUrls(quoi) {
  const urls = [];
  if (quoi === "pages") {
    for (const p of Object.keys(PAGES)) {
      urls.push("fonts/qcf/QCF_P" + String(p).padStart(3, "0") + ".woff2");
    }
    for (const p of Object.keys(PAGES2)) urls.push("fonts/qcf4/p" + p + ".woff2");
    return urls;
  }
  const r = RECITS[quoi];
  if (!r) return urls;
  for (const rid of Object.keys(QURAN)) {
    for (const v of QURAN[rid].verses) urls.push(r.url(v.audio));
  }
  return urls;
}

async function preloadAll(status, quoi) {
  const urls = preloadUrls(quoi);
  let done = 0, fail = 0;
  const q = urls.slice();
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (q.length) {
      const u = q.shift();
      try {
        const r = await fetch(u);
        if (!r.ok) fail++;
      } catch (e) { fail++; }
      done++;
      if (done % 10 === 0 || done === urls.length) {
        status.textContent = `${done}/${urls.length}${fail ? ` · ${fail} échec(s)` : ""}`;
      }
    }
  }));
  status.textContent = fail
    ? `terminé, ${fail} fichier(s) en échec (réessaie plus tard)`
    : "disponible hors-ligne ✓";
}

/* poids indicatifs (mesurés) pour aider à choisir quoi précharger */
const PRELOAD_MO = { pages: 10, husary64: 121, husary128: 240, muallim: 265, mujawwad: 330 };

/* ---------------- boot ---------------- */
{
  /* ?theme=light|dark impose le MODE, pas le thème : ce lien est publié dans le
     README et sert aux captures, son sens ne change pas. Le thème, lui, se
     choisit par ?direction=velin|ardoise|colophon, et pour les DEUX modes à la
     fois, ce qui est le seul comportement utile pour partager une capture. */
  const q = new URLSearchParams(location.search);
  const qsTheme = q.get("theme");
  if (qsTheme === "light" || qsTheme === "dark") { PARAMS.mode = qsTheme; saveParams(); }
  const qsDir = q.get("direction");
  if (["velin", "ardoise", "colophon"].includes(qsDir)) {
    PARAMS.themeClair = PARAMS.themeSombre = qsDir;
    saveParams();
  }
}
applyTheme();
$("#theme-toggle").addEventListener("click", () => {
  /* on part du mode EFFECTIF : si l'on suivait le système, le premier clic doit
     basculer par rapport à ce qui est affiché, pas par rapport à "auto" */
  PARAMS.mode = modeEffectif() === "dark" ? "light" : "dark";
  saveParams();
  render();   // le thème associé au nouveau mode peut différer
});
$$(".nav button").forEach(btn =>
  btn.addEventListener("click", () => nav(btn.dataset.page)));
$(".logo").addEventListener("click", () => nav("home"));
swInit();
/* demande au navigateur de protéger les données du site contre ses purges
   automatiques (dont la règle des 7 jours de Safari) */
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
fetchVersion();
fetchFB().then(() => { if (route().page === "rub") render(); });
syncPull().then(ok => { if (ok) render(); });
window.addEventListener("online", () => {
  clearTimeout(retryTimer); retryTimer = null; retryDelai = 60000;
  syncPull(); schedulePush();
});
window.addEventListener("offline", () => { if (SYNC_ON && SYNC) syncKo("reseau"); });
/* de retour sur l'onglet : si le dernier envoi a échoué, on retente tout de suite */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && SYNC_ON && SYNC && syncStatus && !syncStatus.startsWith("synchronisé")) {
    syncPush();
  }
});
render();
