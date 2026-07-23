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
const player = {
  el: new Audio(),
  queue: [], qi: 0, rep: 1, repLeft: 1, loopRange: false, playing: false,
  play(list, start) {
    this.queue = list; this.qi = start || 0;
    this.repLeft = this.rep; this.playing = true;
    this._launch();
  },
  _launch() {
    if (!this.queue.length || this.qi >= this.queue.length) { this.stop(); return; }
    const item = this.queue[this.qi];
    this.el.src = "audio/" + item.audio;
    this.el.playbackRate = PARAMS.speed;
    this.el.play().catch(() => this.stop());
    highlightVerse(item.k);
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
  stop() {
    this.playing = false;
    this.el.pause();
    highlightVerse(null);
    updateAudioBar();
  },
};
player.el.addEventListener("ended", () => player.next());

function highlightVerse(key) {
  $$(".verse.playing, .mver.playing, .qw.playing").forEach(el => el.classList.remove("playing"));
  if (!key) return;
  const els = $$(`.verse[data-k="${key}"], .mver[data-k="${key}"], .qw[data-k="${key}"]`);
  els.forEach(el => el.classList.add("playing"));
  if (els[0]) els[0].scrollIntoView({ block: "center", behavior: "smooth" });
}
function playOneShot(audio) {
  player.stop();
  player.el.src = "audio/" + audio;
  player.el.playbackRate = PARAMS.speed;
  player.el.play().catch(() => {});
  player.playing = false;
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
function arHtml(v) {
  if (!PARAMS.taj || !v.taj || !v.taj.length) return arEsc(v.ar);
  let out = "", pos = 0;
  for (const [st, en, cls] of v.taj) {
    if (st > pos) out += arEsc(v.ar.slice(pos, st));
    out += `<span class="tj-${cls}">${arEsc(v.ar.slice(st, en))}</span>`;
    pos = en;
  }
  if (pos < v.ar.length) out += arEsc(v.ar.slice(pos));
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
  return { page: parts[0] || "home", a: parts[1], b: parts[2] };
}

function render() {
  const { page, a, b } = route();
  player.stop();
  $$(".nav button").forEach(btn =>
    btn.classList.toggle("on", btn.dataset.page === page));
  const main = $("#main");
  if (page === "rub" && QURAN[a]) main.innerHTML = pageRub(a, b || "memoriser");
  else if (page === "revision") main.innerHTML = pageRevision();
  else if (page === "tutoriels") main.innerHTML = pageTutoriels(a || "translit");
  else if (page === "params") main.innerHTML = pageParams();
  else main.innerHTML = pageHome();
  bindMain();
  window.scrollTo(0, 0);
}

/* ---------------- accueil ---------------- */
function pageHome() {
  let h = `<div class="hero"><h1>Roub' ۞ mémoriser le Qur'an roub' par roub'</h1>
    <p>Juz 1 et 2 (Al-Fâtiḥa + Al-Baqara) et juz 'Amma (les sourates courtes,
    idéales pour débuter). Riwaya Hafs 'an 'Asim, récitation Al-Husary.
    Les étoiles notent la difficulté de mémorisation sur l'échelle de tous
    les roub' du Qur'an.</p></div>`;
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
  else if (tab === "tafsir") h += secTafsir(N);
  else if (tab === "vocab") h += secVocab(N);
  else if (tab === "cartes") h += secCartes(rid);
  h += fbBox(rid);
  return h + `<div class="footer-pad"></div>`;
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
    <span class="fb-note">clic sur un verset : l'écouter ; double-clic : lecture à partir de là</span>`;
  } else {
    h += `<button class="chip ${memoState.pagesColor ? "on" : ""}" data-pgcolor
      title="calligraphie colorée tajwid (édition officielle v4) ou noir et blanc classique">Couleurs tajwid</button>
    <span class="fb-note">mise en page exacte du mushaf de Médine ·
      clic sur un mot : écouter le verset ; double-clic : lecture à partir de là ;
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
        h += `</div><div class="mushaf">`;
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
        h += `</div>`;
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
        h += `<span class="qw${inRub.has(w.k) ? "" : " dim"}" data-k="${w.k}" title="${w.k}">${w.g}</span>`;
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

function secTafsir(N) {
  if (!N || !N.tafsir) return `<div class="empty">Contenu à venir pour ce roub'.</div>`;
  let h = `<div class="note-sec"><h3>Tafsir court (synthèse sourcée Ibn Kathîr / As-Sa'dî)</h3>`;
  for (const t of N.tafsir) {
    h += `<div class="note-card"><div class="nc-head">${arEsc(t.titre)} ${(t.refs || []).map(vrefBtn).join(" ")}</div>
      ${fmt(t.texte)}${t.src ? `<div class="src">${esc(t.src)}</div>` : ""}</div>`;
  }
  return h + `</div>`;
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
      <span class="fb-note">ou l'onglet Révision pour mélanger plusieurs roub'.
      Paquets Anki (.apkg) dans le dossier <code>apkg/</code>.</span>
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
    <p>Les cartes reviennent à intervalle croissant selon tes réponses (comme Anki).
    Les paquets .apkg équivalents sont dans le dossier <code>apkg/</code> du projet.</p></div>`;
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
  const pages = [["translit", "Lire la translittération"], ["tajwid", "Légende tajwid"], ["regles", "Fiches de règles"]];
  let h = `<div class="hero"><h1>Tutoriels</h1></div><div class="tabs">` +
    pages.map(([id, lab]) => `<button data-tuto="${id}" class="${id === sub ? "on" : ""}">${lab}</button>`).join("") +
    `</div><div class="prose">`;
  if (sub === "translit") h += tutoTranslit();
  else if (sub === "tajwid") h += tutoTajwid();
  else h += tutoRegles();
  return h + `</div><div class="footer-pad"></div>`;
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
      ${esc(syncStatus || "en attente de la première synchro")}</span></div>
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
  <div class="param-row"><div class="lab"><b>Tout précharger pour le hors-ligne</b>
      <span>met en cache l'audio complet et les pages du mushaf (~85 Mo) :
      l'appli fonctionne ensuite sans connexion. Sur iPhone/iPad, le quota de
      cache peut limiter le préchargement. <span id="preload-status"></span></span></div>
    <button class="fb-send" data-preload ${("serviceWorker" in navigator) && navigator.serviceWorker.controller ? "" : "disabled title='disponible sur la version en ligne (après un premier chargement)'"}>Précharger</button></div>
  <p style="color:var(--muted);font-size:13px">Version : <b id="appver">${esc(APPVER || "…")}</b><br><br>
    <b>Roub'</b> est une application co-fondée par <b>Anis</b> (docteur en
    mathématiques), à l'origine de la méthode : le déroulé roub' par roub', la
    difficulté étoilée, les cartes façon Anki, les difficultés de mémorisation,
    les particularités tajwid, les rappels de règles, le tafsir et le
    vocabulaire ; et par <b>Yusuf</b> (interne en médecine), qui l'a conçue et
    réalisée en y ajoutant la translittération à double style, la
    distribution web, la synchronisation multi-appareils, l'auto-évaluation et
    la progression. Avis et contact :
    <a href="mailto:dev.yusuf@pm.me">dev.yusuf@pm.me</a> · Discord
    <b>@ophtalmologie</b>.<br><br>
    Texte coranique : mushaf de Médine (Hafs), Complexe du Roi Fahd (texte et
    calligraphie des pages via quran.com et les polices QCF du KFGQPC).
    Traduction : Muhammad Hamidullah. Récitation : Mahmoud Khalil Al-Husary,
    64 kbps (everyayah.com, usage non commercial). Tafsir : synthèses sourcées
    d'Ibn Kathîr et d'As-Sa'dî. Application gratuite et non commerciale, sans
    compte ni collecte de données : progression et réglages restent dans ce
    navigateur. Tout le contenu religieux est sourcé et vérifié contre ses
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
      if (ev.detail >= 2) player.play(queue, i);   // double-clic : à partir d'ici
      else player.play([queue[i]], 0);             // simple : ce verset seul
    }));
    const rubIdx = {};
    R.verses.forEach((v, i) => { rubIdx[v.k] = i; });
    $$(".qw", main).forEach(el => el.addEventListener("click", ev => {
      const k = el.dataset.k;
      if (ev.detail >= 2 && k in rubIdx) { player.play(queue, rubIdx[k]); return; }
      const hit = VIDX[k];
      if (hit) {
        player.loopRange = false;
        player.play([{ k, audio: hit.v.audio }], 0);
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
  $$("[data-preload]", main).forEach(el => el.addEventListener("click", () => {
    el.disabled = true;
    preloadAll($("#preload-status", main));
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
async function syncPull() {
  if (!SYNC_ON || !SYNC) return false;
  try {
    const r = await fetch(`${SYNC_CFG.url}/rest/v1/progress?id=eq.${SYNC.hash}&select=data`,
      { headers: syncHeaders() });
    if (!r.ok) return false;
    const rows = await r.json();
    if (rows.length) mergeRemote(rows[0].data);
    syncStatus = "synchronisé " + new Date().toLocaleTimeString("fr-FR").slice(0, 5);
    return true;
  } catch (e) { return false; }
}
async function syncPush() {
  if (!SYNC_ON || !SYNC) return false;
  try {
    const r = await fetch(`${SYNC_CFG.url}/rest/v1/progress`, {
      method: "POST",
      headers: Object.assign(syncHeaders(), { Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify([{ id: SYNC.hash, data: localPayload() }]),
    });
    if (r.ok) syncStatus = "synchronisé " + new Date().toLocaleTimeString("fr-FR").slice(0, 5);
    return r.ok;
  } catch (e) { return false; }
}
let pushTimer = null;
function schedulePush() {
  if (!SYNC_ON || !SYNC) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncPush, 4000);
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
const BUILD_VERSION = "1.5.8";   // réécrit par tools/release.py
const SITE_URL = "https://yusuf-oph.github.io/roub/";
let APPVER = "";
async function fetchVersion() {
  if (location.protocol.startsWith("http")) {
    try {
      const v = await (await fetch("version.json", { cache: "no-store" })).json();
      APPVER = `${v.version} · ${v.date}`;
    } catch (e) { APPVER = "hors-ligne"; }
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
async function preloadAll(status) {
  const urls = [];
  for (const rid of Object.keys(QURAN)) {
    for (const v of QURAN[rid].verses) urls.push("audio/" + v.audio);
  }
  for (const p of Object.keys(PAGES)) {
    urls.push("fonts/qcf/QCF_P" + String(p).padStart(3, "0") + ".woff2");
  }
  for (const p of Object.keys(PAGES2)) {
    urls.push("fonts/qcf4/p" + p + ".woff2");
  }
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
    : "tout est disponible hors-ligne ✓";
}

/* ---------------- boot ---------------- */
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
window.addEventListener("online", () => { syncPull(); schedulePush(); });
render();
