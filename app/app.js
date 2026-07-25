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

const PARAMS = Object.assign({
  theme: "dark", translit: "fr", showTl: true, showTr: true,
  taj: true, speed: 1, newLimit: 15, silentMarks: true,
  recitation: "husary64", karaoke: true,
}, store.get("quran-params", {}));

/* Affichage du texte arabe :
   - U+0652 (soukoun rond « usuel ») -> U+06E1 (petite tête de khâ'), la
     graphie du soukoun dans le mushaf de Médine ; le rond fermé ۟ (U+06DF)
     reste réservé aux lettres muettes (relevé par Anis, 2026-07-23) ;
   - option silentMarks : masquer les ronds des lettres muettes (redondants
     avec le gris tajwid). Transformation au rendu uniquement : les données
     et les index de spans restent canoniques. */
function arDisplay(s) {
  s = String(s).replace(/ْ/g, "ۡ");   // vrai soukoun -> chevron médinois (U+06E1)
  // rond muet : la police n'attache pas U+06DF (cercle pointillé de repli),
  // mais son glyphe U+0652 est un rond fermé qui s'attache parfaitement :
  // on l'utilise comme rond muet d'affichage (le vrai soukoun est déjà parti
  // en chevron à la ligne précédente, aucune collision)
  s = PARAMS.silentMarks ? s.replace(/۟/g, "ْ") : s.replace(/۟/g, "");
  return s;
}
const arEsc = s => esc(arDisplay(s));
const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
function saveParams() { store.set("quran-params", PARAMS); applyTheme(); }
function applyTheme() {
  document.documentElement.setAttribute("data-theme", PARAMS.theme);
}

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
   Alignement mot/segment vérifié verset par verset : exact partout en 64 kbps
   sauf 2:125 et 2:181, à un mot près sur une trentaine de versets dans les
   styles distants (leur découpage compte parfois un mot de plus) : d'où le
   garde-fou sur l'indice plutôt qu'une confiance aveugle. */
const MARGE_MOT = 60;
function motDebutMs(key, mot) {
  if (!(mot > 0)) return 0;
  const sg = segsOf(key);
  if (!sg || !sg.length) return 0;
  const s = sg[Math.min(mot, sg.length - 1)];
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
function clearWords() {
  $$(".wd.on, .wd.done").forEach(el => el.classList.remove("on", "done"));
}
function wordTick() {
  if (!PARAMS.karaoke || !player.curKey || player.el.paused) return;
  const sg = segsOf(player.curKey);
  if (!sg) return;
  /* petite avance : le temps que le mot s'allume et que l'œil le voie, la
     syllabe est déjà commencée ; 70 ms recale le ressenti sans anticiper */
  const t = player.el.currentTime * 1000 + KARAOKE_LEAD;
  /* mot courant = dernier mot commencé : les silences entre deux mots ne sont
     pas couverts par les segments (surtout en 128k/muallim/mujawwad), garder
     le mot précédent évite un clignotement à chaque blanc */
  let cur = -1;
  for (let i = 0; i < sg.length; i++) if (t >= sg[i][2]) cur = i;
  const els = $$(`.verse[data-k="${player.curKey}"] .wd, .mver[data-k="${player.curKey}"] .wd`);
  els.forEach(el => {
    const w = +el.dataset.w;
    el.classList.toggle("on", w === cur);
    el.classList.toggle("done", w < cur);
  });
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
  if (els[0] && defiler) els[0].scrollIntoView({ block: "center", behavior: "smooth" });
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
function arHtml(v) {
  const taj = PARAMS.taj && v.taj && v.taj.length ? v.taj : null;
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
function rubOf(key) { return VIDX[key] ? VIDX[key].rid : null; }

/* ---------------- navigation ---------------- */
function nav(hash) { location.hash = hash; }
window.addEventListener("hashchange", render);

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
  else main.innerHTML = pageHome();
  bindMain();
  verifierPolicesPages();
  window.scrollTo(0, 0);
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
      <b>Tafsir</b> le commentaire verset par verset. Les notes rédigées
      (points durs, particularités tajwid, vocabulaire, cartes) existent pour le
      roub' 1 ; ailleurs, ces onglets affichent « contenu à venir », et les
      roub' marqués <i>notes à venir</i> sur l'accueil s'ouvriront à mesure
      qu'ils seront rédigés. L'onglet <b>Révision</b> fait revenir les cartes à
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
      <span class="vref" data-tuto="sources">Bibliographie complète →</span></p>
      <p><b>Gratuit et sans compte</b> : progression et réglages restent dans ce
      navigateur. Rien n'est envoyé ailleurs, sauf si tu actives toi-même la
      synchronisation multi-appareils, qui repose sur un code secret anonyme.</p>
    </div></details>`;
}

function pageHome() {
  let h = `<div class="hero"><h1>Roub' ۞ mémoriser le Qur'an roub' par roub'</h1>
    <p>Juz 1 et 2 (Al-Fâtiḥa + Al-Baqara) et juz 'Amma (les sourates courtes,
    idéales pour débuter). Riwaya Hafs 'an 'Asim, récitation Al-Husary.
    Les étoiles notent la difficulté de mémorisation sur l'échelle de tous
    les roub' du Qur'an.</p></div>`;
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
      const dispo = r.dispo !== false;
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
          ${dispo ? "" : `<span class="badge">notes à venir</span>`}
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
  for (const n of Object.keys(PAGES2)) {
    css += `@font-face{font-family:"t${n}";src:url("fonts/qcf4/p${n}.woff2") format("woff2");font-display:block;}`;
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
    <label style="font-size:12.5px;color:var(--muted)">répéter
      <select id="audio-rep">
        ${[1, 2, 3, 5].map(n => `<option value="${n}" ${player.rep === n ? "selected" : ""}>×${n}</option>`).join("")}
      </select></label>
    <button data-audio="loop" class="${player.loopRange ? "on" : ""}" id="audio-loop" title="reboucler la plage entière">boucle</button>
    <label style="font-size:12.5px;color:var(--muted)">vitesse
      <select id="audio-speed">
        ${[0.75, 1, 1.25].map(x => `<option value="${x}" ${PARAMS.speed === x ? "selected" : ""}>${x}×</option>`).join("")}
      </select></label>
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
    ["regles", "Fiches de règles"], ["styles", "Styles de récitation"],
    ["sources", "Sources"]];
  let h = `<div class="hero"><h1>Tutoriels</h1></div><div class="tabs">` +
    pages.map(([id, lab]) => `<button data-tuto="${id}" class="${id === sub ? "on" : ""}">${lab}</button>`).join("") +
    `</div><div class="prose">`;
  if (sub === "translit") h += tutoTranslit();
  else if (sub === "tajwid") h += tutoTajwid();
  else if (sub === "styles") h += tutoStyles();
  else if (sub === "sources") h += tutoSources();
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

/* bibliographie complète : c'est LA page de référence des sources ; les
   mentions courtes ailleurs (accueil, à propos, README) y renvoient.
   Doit rester synchronisée avec SOURCES.md à la racine du dépôt. */
function tutoSources() {
  return `<h2>Sources</h2>
<p>Le détail de tout ce que l'application reprend à d'autres : édition,
version, provenance, conditions d'usage. Règle de travail : <b>rien de ce qui
touche à la religion n'est écrit sans source nommée et vérifiable</b> ; ce qui
relève de la méthode d'apprentissage est notre travail propre et n'est pas
présenté comme une position savante.</p>

<h3>Texte coranique</h3>
<p>Mushaf de Médine, riwâya Hafs 'an 'Âsim, texte de référence du <b>Complexe
du Roi Fahd</b> (KFGQPC), obtenu par l'API quran.com v4. Le texte n'est jamais
modifié : les seules transformations sont d'affichage (graphie du soukoun
propre au mushaf de Médine) et sont réversibles. Un contrôle automatique
compare, verset par verset, le texte publié à celui de la source.</p>

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
<p>Toutes du cheikh <b>Mahmoud Khalil al-Husary</b> (m. 1980), riwâya Hafs 'an
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

<h3>Licences</h3>
<p>Code sous <b>AGPL-3.0</b> ; contenu éditorial de Roub' sous
<b>CC BY-NC-SA 4.0</b> (attribution « Roub', Anis &amp; Yusuf »). Chaque
élément tiers conserve ses propres conditions : c'est pourquoi l'application
est et doit rester gratuite et non commerciale.</p>

<p class="src">Une erreur, une source mal citée, un doute :
<a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a>. Cette page correspond au
fichier SOURCES.md du dépôt.</p>`;
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

<p class="src">Sources : Ibn al-Jazarî, <i>an-Nashr fî l-qirâ'ât al-'ashr</i>,
t. I, chapitre « wa ammâ kayfa yuqra'u l-Qur'ân » (citations traduites de
l'arabe) ; premières mondiales d'enregistrement d'al-Husary : notice
biographique du cheikh ; durées comparées : mesures faites sur les fichiers
audio de l'application. Texte rédigé pour Roub' d'après ces sources.</p>`);
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
function pageParams() {
  return `<div class="hero"><h1>Paramètres</h1></div>
  <div class="param-row"><div class="lab"><b>Thème</b><span>sombre ou clair</span></div>
    <select data-param="theme">
      <option value="dark" ${PARAMS.theme === "dark" ? "selected" : ""}>Sombre</option>
      <option value="light" ${PARAMS.theme === "light" ? "selected" : ""}>Clair</option>
    </select></div>
  <div class="param-row"><div class="lab"><b>Translittération</b>
      <span>hybride française (th, dj, kh, ou...) ou scientifique stricte (ṯ, ǧ, ḫ, ū...) :
      voir le tutoriel « Lire la translittération »</span></div>
    <select data-param="translit">
      <option value="fr" ${PARAMS.translit === "fr" ? "selected" : ""}>Hybride française</option>
      <option value="sci" ${PARAMS.translit === "sci" ? "selected" : ""}>Scientifique stricte</option>
    </select></div>
  <div class="param-row"><div class="lab"><b>Couleurs tajwid</b><span>coloration des règles dans le texte arabe</span></div>
    <label class="switch"><input type="checkbox" data-param="taj" ${PARAMS.taj ? "checked" : ""}><span class="sl"></span></label></div>
  <div class="param-row"><div class="lab"><b>Ronds des lettres muettes</b>
      <span>le rond fermé ۟ du mushaf au-dessus des lettres écrites mais non prononcées ;
      redondant avec le gris tajwid, certains mushafs ne l'impriment pas</span></div>
    <label class="switch"><input type="checkbox" data-param="silentMarks" ${PARAMS.silentMarks ? "checked" : ""}><span class="sl"></span></label></div>
  <div class="param-row"><div class="lab"><b>Translittération visible</b><span>affichée par défaut sous chaque verset</span></div>
    <label class="switch"><input type="checkbox" data-param="showTl" ${PARAMS.showTl ? "checked" : ""}><span class="sl"></span></label></div>
  <div class="param-row"><div class="lab"><b>Traduction visible</b><span>Hamidullah, affichée par défaut</span></div>
    <label class="switch"><input type="checkbox" data-param="showTr" ${PARAMS.showTr ? "checked" : ""}><span class="sl"></span></label></div>
  <div class="param-row"><div class="lab"><b>Style de récitation</b>
      <span>Al-Husary dans les quatre cas. Le murattal 64 kbps est fourni avec
      l'appli (et fonctionne donc aussi depuis une copie locale) ; les autres se
      chargent depuis leur source. Dans tous les cas, ce qui a été écouté reste
      en cache sur cet appareil ; pour tout avoir d'avance, chaque style se
      précharge séparément plus bas dans cette page. Si tu utilises un bloqueur
      de publicités (uBlock Origin et consorts), autorise-lui
      <code>mirrors.quranicaudio.com</code> et <code>audio-cdn.tarteel.ai</code> :
      sinon ces trois styles restent muets, le murattal 64 kbps étant le seul
      fourni avec l'appli</span>
      <details class="aide-repli"><summary>Lequel choisir ?</summary>
    <div class="aide-styles">${gloss(`<p>Les quatre enregistrements sont du cheikh <b>Mahmoud Khalil
    al-Husary</b> (Hafs 'an 'Âsim) : ils diffèrent par l'allure, non par le texte.</p>
    <p><b>Murattal</b> — pour mémoriser : lecture mesurée, sans ornementation. Les versions
    64 et 128 kbps sont la <b>même récitation</b>, seule la finesse du son change.</p>
    <p><b>Mu'allim</b> — pour répéter derrière le cheikh : plus lente, plus détachée. Elle
    rejoint ce qu'Ibn al-Jazarî appelle le {{taḥqîq}}, « l'allure recommandée à celui qui
    apprend » (<i>an-Nashr</i>, t. I).</p>
    <p><b>Mujawwad</b> — pour écouter : solennelle et mélodique, prolongations longuement
    tenues ; sur un même verset, 13,4 secondes contre 8,0 en murattal.</p>
    <p class="src">Ibn al-Jazarî rappelle que ces allures sont toutes licites.
    <span class="vref" data-tuto="styles">Tout le tutoriel des styles →</span></p>`)}</div>
      </details></div>
    <select data-param="recitation">
      ${Object.entries(RECITS).map(([k, r]) =>
        `<option value="${k}" ${recitKey() === k ? "selected" : ""}>${esc(r.nom)}</option>`).join("")}
    </select></div>
  <div class="param-row"><div class="lab"><b>Soulignage mot à mot</b>
      <span>souligne le mot en cours de récitation dans le texte arabe</span></div>
    <label class="switch"><input type="checkbox" data-param="karaoke" ${PARAMS.karaoke ? "checked" : ""}><span class="sl"></span></label></div>
  <div class="param-row"><div class="lab"><b>Vitesse audio</b><span>récitation Husary</span></div>
    <select data-param="speed">
      ${[0.75, 1, 1.25].map(x => `<option value="${x}" ${PARAMS.speed === x ? "selected" : ""}>${x}×</option>`).join("")}
    </select></div>
  <div class="param-row"><div class="lab"><b>Nouvelles cartes par session</b><span>révision espacée</span></div>
    <select data-param="newLimit">
      ${[5, 10, 15, 20, 30].map(x => `<option value="${x}" ${PARAMS.newLimit === x ? "selected" : ""}>${x}</option>`).join("")}
    </select></div>
  <div class="param-row"><div class="lab"><b>Exporter mes avis</b>
      <span>télécharge un fichier .json avec toutes tes notes et remarques,
      à envoyer à Yusuf : <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a></span></div>
    <button class="fb-send" data-fb-export>Exporter</button></div>
  ${!SYNC_ON ? `
  <div class="param-row"><div class="lab"><b>Synchronisation multi-appareils</b>
      <span>bientôt disponible : reprendre sa progression sur un autre appareil
      grâce à un code secret anonyme</span></div>
    <button class="fb-send" disabled>Bientôt</button></div>`
  : SYNC ? `
  <div class="param-row"><div class="lab"><b>Synchronisation active</b>
      <span>ce navigateur est associé à un code de synchro.
      <span id="sync-status">${esc(syncStatus || "en attente de la première synchro")}</span></span></div>
    <span>
      <button class="fb-send" data-sync-show>Voir le code</button>
      <button class="iconbtn" data-sync-unlink title="dissocier ce navigateur (la progression locale reste)">Dissocier</button>
    </span></div>`
  : `
  <div class="param-row"><div class="lab"><b>Synchronisation multi-appareils</b>
      <span>génère un code secret sur ton premier appareil, puis saisis-le sur
      les autres : la progression (révision, journal, auto-évaluations) fusionne.
      <b>Le code est irrécupérable : garde-le en lieu sûr.</b></span></div>
    <span>
      <button class="fb-send" data-sync-create>Générer un code</button>
      <button class="iconbtn" data-sync-join>Saisir un code</button>
    </span></div>`}
  <div class="param-row"><div class="lab"><b>Précharger pour le hors-ligne</b>
      <span>le texte, les notes, le tafsir et l'interface sont déjà gardés
      hors-ligne dès la première visite ; ci-dessous, choisis ce que tu veux
      ajouter (chaque élément se télécharge séparément, inutile de tout prendre).
      Sur iPhone/iPad, le quota de cache peut limiter le préchargement.
      <span id="preload-status"></span></span>
      <div class="preload-list">
      ${[["pages", "Pages du mushaf"]].concat(Object.entries(RECITS).map(([k, r]) => [k, r.nom]))
        .map(([k, nom]) => `<div class="preload-item"><span>${esc(nom)} <b>~${PRELOAD_MO[k]} Mo</b></span>
          <button class="iconbtn" data-preload="${k}" ${("serviceWorker" in navigator) && navigator.serviceWorker.controller ? "" : "disabled title='disponible sur la version en ligne (après un premier chargement)'"}>Précharger</button></div>`).join("")}
      </div></div></div>
  <p style="color:var(--muted);font-size:13px">Version : <b id="appver">${esc(APPVER || "…")}</b><br><br>
    <b>Anis</b> (co-fondateur, docteur en mathématiques) : à l'origine de la
    méthode. <b>Yusuf</b> (co-fondateur, interne en médecine) : conception et
    réalisation. <b>Israa</b> (ostéopathe) : conseillère pédagogique.
    Avis et contact :
    <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a> · Discord
    <b>@ophtalmologie</b>.<br><br>
    Texte coranique : mushaf de Médine (Hafs), Complexe du Roi Fahd (texte et
    calligraphie des pages via quran.com et les polices QCF du KFGQPC).
    Traduction : Muhammad Hamidullah. Récitation : Mahmoud Khalil Al-Husary :
    murattal 64 kbps fourni avec l'appli, murattal 128 kbps et muallim via
    everyayah.com, mujawwad via le CDN de Tarteel ; segments mot à mot de la
    Quranic Universal Library (qul.tarteel.ai) ; usage non commercial. Tafsir
    verset par verset : « French Translation of Al-Mukhtasar in Interpreting
    the Noble Quran » (Tafsir Center for Quranic Studies, V1.0.0, via
    QuranEnc.com, texte reproduit sans modification). Cartes et tutoriels :
    sources citées au fil du texte (Ibn Kathîr, As-Sa'dî, Ibn al-Jazarî) ;
    fiches de règles d'après les matns Tuhfat al-Atfal et
    al-Muqaddima al-Jazariyya. <b>Détail complet : Tutoriels → Sources</b>
    (fichier SOURCES.md sur le dépôt). Application gratuite et non commerciale,
    sans compte : progression et réglages restent dans ce navigateur, et rien
    n'est envoyé ailleurs sauf si la synchronisation multi-appareils est activée
    (code secret anonyme, aucune donnée personnelle). Tout le contenu religieux est sourcé et vérifié contre ses
    sources ; une erreur restant toujours possible, merci de signaler tout
    doute via le widget d'avis ou dev.yusuf@pm.me. Code sous licence AGPL-3.0, contenu éditorial sous
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
  $$("[data-param]", main).forEach(el => {
    el.addEventListener("change", () => {
      const k = el.dataset.param;
      if (el.type === "checkbox") PARAMS[k] = el.checked;
      else if (k === "speed") PARAMS[k] = +el.value;
      else if (k === "newLimit") PARAMS[k] = +el.value;
      else PARAMS[k] = el.value;
      saveParams();
      if (k === "theme") applyTheme();
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
const BUILD_VERSION = "1.13.6";   // réécrit par tools/release.py
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
  // thème imposable par URL (?theme=light|dark), pratique pour partager
  const qsTheme = new URLSearchParams(location.search).get("theme");
  if (qsTheme === "light" || qsTheme === "dark") {
    PARAMS.theme = qsTheme;
    saveParams();
  }
}
applyTheme();
$("#theme-toggle").addEventListener("click", () => {
  PARAMS.theme = PARAMS.theme === "dark" ? "light" : "dark";
  saveParams();
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
