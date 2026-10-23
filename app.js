'use strict';

const STORE_KEY = 'gimnas.sessions.v1';
const SCHEDULE_KEY = 'gimnas.schedule.v1';
const SETTINGS_KEY = 'gimnas.machine.v1'; // ajustos de cada màquina, per clau d'exercici
const META_KEY = 'gimnas.meta.v1'; // { lastExport, lastDeload, deloadWeek, deloadDismissed }
const STEPS_KEY = 'gimnas.steps.v1'; // pas de pes de cada exercici, per clau (2,5 kg si no n'hi ha)
const SWIM_KEY = 'gimnas.swim.v1'; // natació, per data: { minutes, style, meters, updated }
const BACKUP_DAYS = 14;
const KG_STEP = 2.5;
const DELOAD_WEEKS = 5; // cada quantes setmanes es proposa una descàrrega
const SKIP_REASONS = { busy: 'Màquina ocupada', time: 'Sense temps', pain: 'Molèstia', other: 'Altre' };
const ZONES = { lumbar: 'Lumbar', espatlla: 'Espatlla', genoll: 'Genoll', altre: 'Altre' };
const SWIM_STYLES = { crol: 'Crol', esquena: 'Esquena', braca: 'Braça', mixt: 'Mixt' };
const LUMBAR_MSG = 'Para si notes dolor que baixa per la cama, formigueig o dolor que dura més de 24 h. Comenta-ho amb el fisio.';
const SWIM_NOTE = 'Amb la lumbar, millor crol i esquena. La papallona i la braça amb el cap fora de l’aigua arquegen l’esquena. Si fas servir la taula de batre i notes la lumbar, deixa-la.';
// Sessió de compensació: exercicis del D5 per ordre de prioritat, bloc de core i exercicis
// pesats de cames que no es repeteixen si ahir vas fer cames.
const COMP_ORDER = ['facepull', 'lowrowwide', 'reardelt', 'straightarm', 'incline', 'armcurl', 'armext', 'calf'];
const CORE_BLOCK = [{ key: 'sideplank', sets: 2 }, { key: 'deadbug', sets: 2 }];
const HEAVY_LEGS = ['legpress', 'legpresshigh', 'hipthrust', 'hyperiso', 'hyper'];
const SESSION_MAX = 80; // minuts
const CARDIO_MIN = 20, CARDIO_MAX = 30;
const MONTHS = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
const WEEKDAYS = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];
// Setmana tipus (0 = diumenge): dilluns D1, dimarts D2, dijous D3, divendres D4, dissabte D5 (opcional).
const WEEK = { 0: 'rest', 1: 'd1', 2: 'd2', 3: 'rest', 4: 'd3', 5: 'd4', 6: 'd5' };
const OPTIONAL = 'd5';
const MAX_SETS = 10;

const DAYS = window.PLAN.days;
const dayById = (id) => DAYS.find((d) => d.id === id);
const MAIN_DAYS = DAYS.map((d) => d.id).filter((id) => id !== 'd5');

// Catàleg d'exercicis per clau (la primera definició del pla) i definició d'un dia concret.
const EX_BY_KEY = {};
for (const d of DAYS) for (const ex of d.exercises) EX_BY_KEY[ex.key] ||= ex;
const exDef = (key, from) => dayById(from)?.exercises.find((ex) => ex.key === key) || EX_BY_KEY[key];

const ICON_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

// ---------- Utilitats ----------

const pad = (n) => String(n).padStart(2, '0');
const todayISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return todayISO(d); };
const mondayOf = (iso) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
const fmtShort = (iso) => { const d = parseISO(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtDay = (iso) => { const d = parseISO(iso); return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtLong = (iso) => `${fmtDay(iso)} ${parseISO(iso).getFullYear()}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const keyOf = (date, day) => `${date}_${day}`;
const setKey = (i, ex) => `${i}:${ex.key}`;
const byRecent = (a, b) => b.date.localeCompare(a.date) || (b.updated || '').localeCompare(a.updated || '');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Afegeix el punt final, excepte si la frase ja acaba amb un mes abreviat ("oct.").
const sentence = (s) => (s.endsWith('.') ? s : `${s}.`);

// Primer número o interval de l'objectiu: "8–10" de "8–10", "30–45" de "30–45 s".
const targetReps = (ex) => (String(ex.reps).match(/^[\d–-]+/) || [''])[0];
const isTimed = (ex) => /\d\s*s\b/.test(ex.reps);
const repRange = (ex) => { const m = String(ex.reps).match(/^(\d+)(?:\s*[–-]\s*(\d+))?/); return m ? [Number(m[1]), Number(m[2] || m[1])] : null; };
const parseKg = (v) => Number.parseFloat(String(v ?? '').replace(',', '.'));
const fmtKg = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
// Descans entre sèries: el `rest` de l'exercici o, si no en té, 2 min al primer exercici del dia,
// 75 s a la resta i 45 s als de terra.
const restOf = (ex, i) => ex.rest ?? (i === 0 ? 120 : ex.weight ? 75 : 45);
// Parella de supersèrie: l'exercici del costat amb la mateixa lletra `pair`.
const pairOf = (day, i) => {
  const ex = day.exercises[i];
  if (!ex?.pair) return null;
  const other = [day.exercises[i + 1], day.exercises[i - 1]].find((o) => o?.pair === ex.pair);
  return other || null;
};
// Durada estimada d'un dia: escalfament + (sèries × (feina + descans) + canvi de màquina) + cardio.
const minutesOf = (text) => Number.parseInt(text) || 0;
const WARMUP_MIN = minutesOf(window.PLAN.warmup.time);
function strengthMinutes(day) {
  let secs = 0;
  day.exercises.forEach((ex, i) => {
    const perSide = /per (costat|cama)/.test(ex.reps);
    const work = (ex.weight ? 40 : 45) * (perSide ? 1.5 : 1);
    secs += ex.sets * (work + restOf(ex, i));
    secs += pairOf(day, i) === day.exercises[i - 1] && ex.pair ? 15 : 60;
  });
  return Math.round(secs / 60);
}
const dayMinutes = (day) => WARMUP_MIN + strengthMinutes(day) + minutesOf(day.cardio);

// ---------- Dades ----------

function loadJSON(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    alert("No s'han pogut desar les dades. Exporta una còpia des de l'Historial.");
  }
}

let sessions = loadJSON(STORE_KEY);
const persist = () => saveJSON(STORE_KEY, sessions);
const machine = loadJSON(SETTINGS_KEY);
const meta = loadJSON(META_KEY);
const steps = loadJSON(STEPS_KEY);
const swim = loadJSON(SWIM_KEY);

const hasText = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Una sessió de compensació generada es conserva encara que no s'hi hagi marcat res.
// Els nombres de sèries que només venen de la descàrrega no compten com a contingut.
function isEmpty(s) {
  return !s.warm && !s.cardio && !s.plan
    && !Object.values(s.sets || {}).some((a) => a.some(Boolean))
    && !Object.values(s.kg || {}).some(hasText)
    && !Object.values(s.reps || {}).some((a) => a.some(hasText))
    && !Object.entries(s.count || {}).some(([k, n]) => n !== defaultSets(dayOf(s)?.exercises[Number.parseInt(k)] || { sets: NaN }, s))
    && !Object.keys(s.skip || {}).length
    && !s.finished;
}

const state = {
  screen: 'train', date: todayISO(), day: 'd1', editing: false, restNote: '', week: mondayOf(todayISO()), calOpen: '', progEx: '',
  skipping: '', // clau de la targeta on s'està triant el motiu per saltar
  skipZone: false, // s'ha triat «molèstia» i falta la zona
  swimDate: '', // data del formulari de natació obert
  comp: null, // proposta de sessió de compensació en edició (encara no desada)
};

const currentKey = () => keyOf(state.date, state.day);
const getSession = () => sessions[currentKey()] || null;
// En canviar de dia o de data, es tanquen les coses a mig fer (motiu de salt, natació, compensació).
const resetTransient = () => { state.comp = null; state.swimDate = ''; state.skipping = ''; state.skipZone = false; };

function ensureSession() {
  const k = currentKey();
  if (!sessions[k]) {
    sessions[k] = { date: state.date, day: state.day, warm: false, cardio: false, sets: {}, reps: {}, count: {}, kg: {}, updated: '' };
    // En setmana de descàrrega, el nombre de sèries es desa a la sessió perquè no canviï després.
    if (isDeloadDate(state.date)) applyDeload(sessions[k]);
  }
  const s = sessions[k];
  s.sets ||= {}; s.reps ||= {}; s.count ||= {}; s.kg ||= {}; s.skip ||= {};
  return s;
}

// Desa la sessió actual. Si ha quedat buida, l'esborra perquè no surti a l'historial.
function save(s) {
  if (isEmpty(s)) delete sessions[currentKey()];
  else s.updated = new Date().toISOString();
  persist();
}

// Setmana de descàrrega: la meitat de sèries (arrodonint amunt) amb el mateix pes.
const isDeloadDate = (date) => !!meta.deloadWeek && mondayOf(date) === meta.deloadWeek;
const halfSets = (ex) => Math.max(1, Math.ceil(ex.sets / 2));
const defaultSets = (ex, s) => (isDeloadDate(s?.date || state.date) && !s?.plan ? halfSets(ex) : ex.sets);
const countOf = (s, i, ex) => s?.count?.[setKey(i, ex)] ?? defaultSets(ex, s);

// Desa (o treu) el nombre de sèries de descàrrega a les sessions d'una setmana.
function applyDeload(s, on = true) {
  if (s.plan) return;
  const day = dayById(s.day);
  if (!day) return;
  s.count ||= {};
  day.exercises.forEach((ex, i) => {
    const k = setKey(i, ex);
    const half = halfSets(ex);
    if (on) { if (s.count[k] === undefined && half !== ex.sets) s.count[k] = half; }
    else if (s.count[k] === half) delete s.count[k];
  });
}
function setDeloadWeek(monday, on) {
  for (const s of Object.values(sessions)) if (mondayOf(s.date) === monday) applyDeload(s, on);
  persist();
}

function exDone(ex, i, s) {
  const n = countOf(s, i, ex);
  const a = s?.sets?.[setKey(i, ex)];
  return n > 0 && !!a && a.length >= n && a.slice(0, n).every(Boolean);
}

const exSkipped = (ex, i, s) => !!s?.skip?.[setKey(i, ex)];
// Motiu del salt, normalitzat: els «true» antics passen a 'other'.
function skipInfo(v) {
  if (!v) return null;
  if (typeof v !== 'object') return { reason: 'other' };
  const reason = SKIP_REASONS[v.reason] ? v.reason : 'other';
  const out = { reason };
  if (reason === 'pain') { out.zone = ZONES[v.zone] ? v.zone : 'altre'; if (hasText(v.note)) out.note = String(v.note).trim(); }
  return out;
}
const skipText = (info) => (info.reason === 'pain' ? `Molèstia: ${ZONES[info.zone].toLowerCase()}` : SKIP_REASONS[info.reason]);

// Sèries marcades i planificades d'una sessió (les saltades compten com a planificades i no fetes).
function setsOfSession(s) {
  const day = dayOf(s);
  let done = 0, planned = 0;
  day.exercises.forEach((ex, i) => {
    const n = countOf(s, i, ex);
    planned += n;
    if (!exSkipped(ex, i, s)) done += (s.sets?.[setKey(i, ex)] || []).slice(0, n).filter(Boolean).length;
  });
  return { done, planned };
}

// Dia d'una sessió: el del pla o, si és de compensació, el que es va generar (s.plan).
function dayOf(s) {
  if (!s) return null;
  if (!s.plan) return dayById(s.day) || null;
  const exercises = s.plan.map((p) => {
    const def = exDef(p.key, p.from);
    if (!def) return null;
    const ex = { ...def, sets: p.sets, from: p.from };
    delete ex.pair;
    return ex;
  }).filter(Boolean);
  // El bloc de core va en supersèrie.
  exercises.forEach((ex, i) => {
    const next = exercises[i + 1];
    if (ex.key === 'sideplank' && next?.key === 'deadbug') { ex.pair = next.pair = 'Z'; ex.rest = 15; next.rest = 45; }
  });
  return { id: 'd5', kind: 'upper', short: 'Compensació', title: 'Sessió de compensació', focus: 'Del que ha faltat aquesta setmana', cardio: `${s.cardioMin || CARDIO_MIN} min en zona 2 (bicicleta, el·líptica o escaladora)`, exercises, comp: true };
}
const currentDay = () => dayOf(getSession()) || dayById(state.day);

// Els exercicis saltats no compten al total: es pot completar el dia sense fer-los.
function progressOf(day, s) {
  let skipped = 0;
  let done = (s?.warm ? 1 : 0) + (s?.cardio ? 1 : 0);
  day.exercises.forEach((ex, i) => {
    if (exSkipped(ex, i, s)) skipped++;
    else if (exDone(ex, i, s)) done++;
  });
  const total = day.exercises.length + 2 - skipped;
  return { done, total, skipped, pct: Math.round((done / total) * 100), finished: !!s?.finished };
}

// Sessions anteriors amb pes o repeticions per a aquesta clau d'exercici (la més recent
// primer), sigui quin sigui el dia del pla o només del mateix dia.
function historyFor(exKey, sameDay = false, n = 1) {
  const cur = currentKey();
  const out = [];
  for (const [k, s] of Object.entries(sessions)) {
    if (k === cur || !s || s.date > state.date || (sameDay && s.day !== state.day)) continue;
    const kg = String(s.kg?.[exKey] ?? '').trim();
    const repsKey = Object.keys(s.reps || {}).find((rk) => rk.endsWith(`:${exKey}`) && s.reps[rk].some(hasText));
    const reps = repsKey ? s.reps[repsKey].map((v) => String(v ?? '').trim()) : [];
    if (!kg && !reps.length) continue;
    out.push({ date: s.date, updated: s.updated, kg, reps });
  }
  return out.sort(byRecent).slice(0, n);
}
const lastFor = (exKey, sameDay = false) => historyFor(exKey, sameDay)[0] || null;

// Pas de pes de l'exercici (cada màquina té el seu); 2,5 kg si no s'ha canviat.
function stepOf(ex) {
  const v = parseKg(steps[ex.key]);
  return Number.isFinite(v) && v > 0 ? v : KG_STEP;
}

// Totes les sèries d'una sessió al màxim del rang.
function hitTop(ex, h) {
  const range = repRange(ex);
  const reps = (h?.reps || []).filter(hasText).map(Number).filter((n) => n > 0);
  return !!range && reps.length >= ex.sets && reps.every((r) => r >= range[1]);
}

// Doble progressió: si a l'última sessió vas arribar al màxim de repeticions a totes les
// sèries, toca pujar; si alguna va quedar per sota del mínim, mantenir. Als aïllaments
// petits (`slow`) cal arribar-hi dues sessions seguides amb el mateix pes.
function suggestion(ex, hist) {
  const last = hist?.[0];
  const range = repRange(ex);
  const kg = parseKg(last?.kg);
  if (!ex.weight || !range || isTimed(ex) || !Number.isFinite(kg)) return null;
  const reps = last.reps.filter(hasText).map(Number).filter((n) => n > 0);
  if (!reps.length) return null;
  const [lo, hi] = range;
  const assist = ex.weight === 'assist';
  const step = stepOf(ex);
  if (hitTop(ex, last)) {
    const prev = hist[1];
    const twice = !ex.slow || (prev && parseKg(prev.kg) === kg && hitTop(ex, prev));
    if (twice) {
      const next = assist ? Math.max(0, kg - step) : kg + step;
      return {
        kind: 'up', kg: fmtKg(next),
        text: `${assist ? "Baixa l'assistència" : 'Puja'}: prova ${fmtKg(next)} kg`,
        why: ex.slow ? `has fet ${hi} o més a totes les sèries dues sessions seguides` : `vas fer ${hi} o més a totes les sèries`,
      };
    }
    return { kind: 'keep', kg: fmtKg(kg), text: `Mantén ${fmtKg(kg)} kg`, why: `vas arribar a ${hi}; repeteix-ho una vegada més i puja` };
  }
  if (reps.some((r) => r < lo)) {
    return { kind: 'keep', kg: fmtKg(kg), text: `Mantén ${fmtKg(kg)} kg`, why: `alguna sèrie va quedar per sota de ${lo}; si et costa, baixa` };
  }
  return { kind: 'keep', kg: fmtKg(kg), text: `Mantén ${fmtKg(kg)} kg`, why: `intenta arribar a ${hi} a totes les sèries` };
}

// Avís de regressió al primer exercici del dia: pes o repeticions més baixos dues sessions seguides.
function regression(ex) {
  const h = historyFor(ex.key, true, 3);
  if (h.length < 3 || !ex.weight) return false;
  const score = (x) => ({ kg: parseKg(x.kg), reps: x.reps.filter(hasText).map(Number).reduce((a, b) => a + (b || 0), 0) });
  const worse = (a, b) => (ex.weight === 'assist' ? a.kg > b.kg : a.kg < b.kg) || (a.kg === b.kg && a.reps < b.reps);
  const [a, b, c] = h.map(score);
  return [a, b, c].every((x) => Number.isFinite(x.kg)) && worse(a, b) && worse(b, c);
}

// ---------- Descàrrega ----------

// 'on': aquesta setmana és de descàrrega. 'due': toca proposar-la. 'off': res.
function deloadStatus(date = todayISO()) {
  const monday = mondayOf(date);
  if (meta.deloadWeek === monday) return 'on';
  if (meta.deloadDismissed === monday) return 'off';
  const dates = Object.values(sessions).filter((s) => !s.plan || setsOfSession(s).done).map((s) => s.date).sort();
  if (!dates.length) return 'off';
  const ref = meta.lastDeload || mondayOf(dates[0]);
  return daysBetween(ref, monday) >= DELOAD_WEEKS * 7 ? 'due' : 'off';
}

function deloadBanner() {
  const st = deloadStatus();
  if (st === 'on') {
    return `<div class="banner deload"><span><b>Setmana de descàrrega.</b> La meitat de sèries amb el mateix pes.</span>
      <button type="button" class="link" data-act="deload-undo">Desfés</button></div>`;
  }
  if (st !== 'due') return '';
  const ref = meta.lastDeload ? `Fa ${Math.floor(daysBetween(meta.lastDeload, todayISO()) / 7)} setmanes de l'última descàrrega.` : `Portes ${DELOAD_WEEKS} setmanes o més entrenant sense descàrrega.`;
  return `<div class="banner deload"><span><b>${ref}</b> Vols que aquesta setmana sigui de descàrrega? La meitat de sèries amb el mateix pes.</span>
    <span class="row"><button type="button" class="btn small" data-act="deload-yes">Sí</button><button type="button" class="ghost small" data-act="deload-no">Ara no</button></span></div>`;
}

// ---------- Calendari ----------

let schedule = loadJSON(SCHEDULE_KEY); // { 'AAAA-MM-DD': 'd1'…'d5' | 'rest' } només on es canvia el pla
const persistSchedule = () => saveJSON(SCHEDULE_KEY, schedule);

const planned = (date) => schedule[date] ?? WEEK[parseISO(date).getDay()];

function setPlanned(date, value) {
  if (value === WEEK[parseISO(date).getDay()]) delete schedule[date];
  else schedule[date] = value;
}

// Aplaza un dia: l'entrenament passa a demà i els següents es mouen un dia
// fins que un dia de descans els absorbeix (com Garmin Coach).
function postpone(date) {
  let carry = planned(date);
  setPlanned(date, 'rest');
  let d = date;
  for (let i = 0; i < 7; i++) {
    d = addDays(d, 1);
    const cur = planned(d);
    setPlanned(d, carry);
    if (cur === 'rest') break;
    carry = cur;
  }
  persistSchedule();
}

// Mou a una altra data: s'intercanvia amb el que hi hagués aquell dia.
function moveTo(date, target) {
  const a = planned(date), b = planned(target);
  setPlanned(target, a);
  setPlanned(date, b);
  persistSchedule();
}

function nextWorkout(from) {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(from, i);
    if (planned(d) !== 'rest') return d;
  }
  return null;
}

// ---------- Quin dia toca ----------

function chooseToday() {
  state.date = todayISO();
  state.editing = false;
  state.restNote = '';
  resetTransient();

  const todays = Object.values(sessions).filter((s) => s.date === state.date && dayById(s.day)).sort(byRecent);
  if (todays.length) {
    state.day = todays[0].day;
    return;
  }

  const p = planned(state.date);
  if (dayById(p)) {
    state.day = p;
    return;
  }

  const next = nextWorkout(state.date);
  state.day = next ? planned(next) : 'd1';
  state.restNote = next
    ? `Avui toca descans. El pròxim entrenament és ${fmtDay(next)}: ${planned(next).toUpperCase()}. Si vols entrenar igualment, aquí el tens.`
    : 'Avui toca descans.';
}

// ---------- Elements ----------

const $ = (sel) => document.querySelector(sel);
const daysEl = $('#days');
const trainEl = $('#train');
const calendarEl = $('#calendar');
const historyEl = $('#history');
const lightbox = $('#lightbox');

// ---------- Pantalla Entrenar ----------

function renderDays() {
  daysEl.innerHTML = DAYS.map((d) => {
    const has = sessions[keyOf(state.date, d.id)] ? ' has-data' : '';
    return `<button type="button" class="day${has}" data-day="${d.id}" aria-pressed="${d.id === state.day}">
      <b>${d.id.toUpperCase()}</b><span>${esc(d.short)}</span></button>`;
  }).join('');
}

function checkItem(field, title, sub, items, on) {
  // Els elements amb animació es poden desplegar per veure com es fan.
  const item = (it) => (it.anim && window.ANIM?.has(it.anim)
    ? `<li class="has-anim"><details class="how mini"><summary>${esc(it.text)}</summary><figure class="anim" data-anim="${esc(it.anim)}"></figure></details></li>`
    : `<li>${esc(it.text ?? it)}</li>`);
  const list = items?.length ? `<ul class="check-list">${items.map(item).join('')}</ul>` : '';
  return `<div class="check${on ? ' done' : ''}" data-field="${field}">
    <button type="button" class="check-btn" data-act="toggle" data-field="${field}" aria-pressed="${on}">
      <span class="box">${ICON_CHECK}</span>
      <span class="check-text"><b>${esc(title)}</b><small>${esc(sub)}</small></span>
    </button>${list}</div>`;
}

function lastText(last, ex) {
  if (!last) return 'Primera vegada';
  const bits = [];
  if (last.kg) bits.push(`<b class="tabular">${esc(last.kg)} kg</b>`);
  const reps = last.reps.filter(Boolean);
  if (reps.length) bits.push(`<span class="tabular">${esc(reps.join('/'))}${isTimed(ex) ? ' s' : ''}</span>`);
  bits.push(fmtShort(last.date));
  return `Última: ${bits.join(' · ')}`;
}

function exerciseInner(ex, i, s) {
  const k = setKey(i, ex);
  const n = countOf(s, i, ex);
  const done = exDone(ex, i, s);
  const sets = s?.sets?.[k] || [];
  const reps = s?.reps?.[k] || [];
  const last = lastFor(ex.key);
  const target = targetReps(ex);
  const unit = isTimed(ex) ? 'Segons' : 'Repeticions';
  const day = dayOf(s) || dayById(state.day);
  const pair = pairOf(day, i);
  const fromTag = ex.from ? `<span class="from-tag">${ex.from === 'core' ? 'Core' : ex.from === 'd5' ? 'D5' : `Pendent del ${ex.from.toUpperCase()}`}</span>` : '';

  const cols = Array.from({ length: n }, (_, j) => `
    <div class="set-col">
      <button type="button" class="set" data-act="set" data-s="${j}" aria-pressed="${!!sets[j]}" aria-label="Sèrie ${j + 1}">${j + 1}</button>
      <input class="rep" data-rep="${j}" type="text" inputmode="numeric" autocomplete="off" enterkeyhint="done"
        value="${esc(reps[j] ?? '')}" placeholder="${esc(last?.reps?.[j] || target)}" aria-label="${unit} de la sèrie ${j + 1}">
    </div>`).join('');

  const thumb = ex.photo
    ? `<button type="button" class="thumb" data-act="photo" aria-label="Mostra la foto: ${esc(ex.machine)}">
        <img src="img/${ex.photo}.jpg" alt="" width="72" height="72" loading="lazy" decoding="async"></button>`
    : `<div class="thumb none" aria-hidden="true">${esc(ex.place || 'Terra')}</div>`;

  const top = `<div class="ex-top">${thumb}
      <div class="ex-info">
        <h2><span class="num">${i + 1}.</span>${esc(ex.name)}</h2>
        <p class="machine">${esc(ex.machine)}</p>
        <p class="target tabular">${ex.sets} × ${esc(ex.reps)}${fromTag}</p>
        ${pair ? `<p class="pair-tag"><span aria-hidden="true">⇄</span> Supersèrie amb <b>${esc(pair.name)}</b> · ${restOf(ex, i)} s de descans</p>` : ''}
      </div>
      <span class="tick" aria-label="Completat">${ICON_CHECK}</span>
    </div>`;

  if (exSkipped(ex, i, s)) {
    const info = skipInfo(s.skip[k]);
    const pain = info.reason === 'pain';
    return `${top}<div class="skipped-row"><span>Saltat · ${esc(skipText(info))}</span>
      <button type="button" class="ghost" data-act="unskip">Desfés</button></div>
      ${pain ? `<div class="skip-note"><input data-skipnote="${esc(k)}" type="text" autocomplete="off" enterkeyhint="done" value="${esc(info.note || '')}" placeholder="Nota (opcional): què has notat"></div>` : ''}
      ${pain && info.zone === 'lumbar' ? `<p class="warn-text">${esc(LUMBAR_MSG)}</p>` : ''}`;
  }

  if (state.skipping === k) {
    const opts = state.skipZone
      ? Object.entries(ZONES).map(([z, t]) => `<button type="button" class="chip-btn" data-act="skip-zone" data-zone="${z}">${t}</button>`).join('')
      : Object.entries(SKIP_REASONS).map(([r, t]) => `<button type="button" class="chip-btn" data-act="skip-reason" data-reason="${r}">${t}</button>`).join('');
    return `${top}<div class="skip-panel"><p>${state.skipZone ? 'On ho notes?' : 'Per què el saltes?'}</p>
      <div class="skip-opts">${opts}</div>
      <button type="button" class="ghost" data-act="skip-cancel">Cancel·la</button></div>`;
  }

  let kg = '';
  // El suggeriment es basa en el mateix dia del pla si n'hi ha (el hip thrust del D4 és més pesat que el del D2).
  const hist = historyFor(ex.key, true, 2);
  const tip = suggestion(ex, hist.length ? hist : historyFor(ex.key, false, 2));
  const regress = i === 0 && !day.comp && regression(ex);
  if (ex.weight) {
    const assist = ex.weight === 'assist';
    kg = `<div class="kg">
      <label for="kg-${i}">${assist ? 'Assistència' : 'Pes'}</label>
      <span class="kg-input"><input id="kg-${i}" data-key="${esc(ex.key)}" type="text" inputmode="decimal"
        autocomplete="off" enterkeyhint="done" value="${esc(s?.kg?.[ex.key] ?? '')}" placeholder="${esc(tip?.kg ?? last?.kg ?? '')}"><span>kg</span></span>
      ${assist ? '<p class="hint">Com menys pes d’assistència, més difícil.</p>' : ''}
    </div>`;
  }
  const deload = isDeloadDate(s?.date || state.date) && !day.comp;
  const tipHtml = (tip && !deload
    ? `<p class="tip ${tip.kind}">${tip.kind === 'up' ? '<span aria-hidden="true">↑</span> ' : ''}<b>${esc(tip.text)}</b> · ${esc(tip.why)}</p>`
    : '') + (regress ? '<p class="tip down"><b>Has baixat dues sessions seguides.</b> Dorm i menja bé; si continua, fes una setmana de descàrrega.</p>' : '');
  const settings = (ex.photo
    ? `<div class="machine-set"><label for="ms-${i}">Ajustos</label>
        <input id="ms-${i}" data-setting="${esc(ex.key)}" type="text" autocomplete="off" enterkeyhint="done"
          value="${esc(machine[ex.key] ?? '')}" placeholder="Seient, coixí, forat…"></div>`
    : '') + (ex.weight === true
    ? `<div class="machine-set"><label for="st-${i}">Pas de pes</label>
        <span class="kg-input"><input id="st-${i}" data-step="${esc(ex.key)}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
          value="${esc(steps[ex.key] ?? '')}" placeholder="${fmtKg(KG_STEP)}"><span>kg</span></span></div>`
    : '');

  const animId = ex.anim || ex.key;
  const anim = window.ANIM?.has(animId) ? `<figure class="anim" data-anim="${esc(animId)}"></figure>` : '';
  const how = ex.note || anim
    ? `<details class="how"><summary>Com fer-ho</summary>${anim}${ex.note ? `<p>${esc(ex.note)}</p>` : ''}</details>`
    : '';

  return `
    ${top}
    ${muscleRow(ex)}
    ${how}
    <div class="sets" role="group" aria-label="Sèries">${cols}</div>
    <p class="sets-label">${unit} de cada sèrie</p>
    ${kg}
    <p class="last">${lastText(last, ex)}</p>
    ${tipHtml}
    ${settings}
    <div class="ex-ctrl">
      <div class="stepper" role="group" aria-label="Nombre de sèries">
        <button type="button" data-act="less" aria-label="Treu una sèrie"${n <= 1 ? ' disabled' : ''}>−</button>
        <span class="tabular">${plural(n, 'sèrie', 'sèries')}</span>
        <button type="button" data-act="more" aria-label="Afegeix una sèrie"${n >= MAX_SETS ? ' disabled' : ''}>+</button>
      </div>
      <span class="ex-btns">
        <button type="button" class="ghost" data-act="skip">Salta</button>
        <button type="button" class="complete" data-act="complete" aria-pressed="${done}">${done ? `${ICON_CHECK} Completat` : 'Completa'}</button>
      </span>
    </div>`;
}

// ---------- Músculs ----------

const muscleNames = (ids) => ids.map((id) => window.MUSCLES?.names[id] || id).join(', ');

// Classe de cada múscul d'un exercici: 'on' els principals, 'aux' els secundaris.
function muscleHl(key) {
  const m = window.PLAN.muscles?.[key];
  const hl = {};
  if (!m) return hl;
  m.aux.forEach((id) => { hl[id] = 'aux'; });
  m.main.forEach((id) => { hl[id] = 'on'; });
  return hl;
}

function muscleRow(ex) {
  const m = window.PLAN.muscles?.[ex.key];
  if (!m || !window.MUSCLES) return '';
  return `<div class="mus-row">${window.MUSCLES.svg(muscleHl(ex.key), { cls: 'mini' })}
    <p class="mus-names"><b>${esc(muscleNames(m.main))}</b>${m.aux.length ? `<small>+ ${esc(muscleNames(m.aux))}</small>` : ''}</p></div>`;
}

// Músculs de la sessió actual, segons les sèries marcades: principals amb el nombre de sèries.
function musclesToday() {
  const s = getSession();
  const hl = {}, sets = {};
  currentDay().exercises.forEach((ex, i) => {
    const m = window.PLAN.muscles?.[ex.key];
    if (!m || exSkipped(ex, i, s)) return;
    const done = (s?.sets?.[setKey(i, ex)] || []).slice(0, countOf(s, i, ex)).filter(Boolean).length;
    if (!done) return;
    m.aux.forEach((id) => { if (hl[id] !== 'on') hl[id] = 'aux'; });
    m.main.forEach((id) => { hl[id] = 'on'; sets[id] = (sets[id] || 0) + done; });
  });
  return { hl, sets };
}

function renderMusclesToday() {
  const el = $('#muscles-today');
  if (!el || !window.MUSCLES) return;
  const { hl, sets } = musclesToday();
  const list = Object.entries(sets).sort((a, b) => b[1] - a[1]);
  const aux = Object.keys(hl).filter((id) => hl[id] === 'aux');
  el.innerHTML = `<h2>Músculs treballats avui</h2>
    ${window.MUSCLES.svg(hl, { labels: true, cls: 'big' })}
    ${list.length
      ? `<ul class="mus-list">${list.map(([id, n]) => `<li><span class="sw on"></span>${esc(window.MUSCLES.names[id])}<b class="tabular">${plural(n, 'sèrie', 'sèries')}</b></li>`).join('')}</ul>`
      : '<p class="cal-log-empty">Marca sèries i aquí veuràs què has treballat.</p>'}
    ${aux.length ? `<p class="mus-aux"><span class="sw aux"></span>Secundaris: ${esc(muscleNames(aux))}</p>` : ''}`;
}

const exerciseCard = (ex, i, s) =>
  `<li class="ex${exDone(ex, i, s) ? ' done' : ''}${exSkipped(ex, i, s) ? ' skipped' : ''}" data-i="${i}">${exerciseInner(ex, i, s)}</li>`;

// Torna a pintar una targeta i manté «Com fer-ho» obert si ho estava.
function refreshCard(card) {
  const i = Number(card.dataset.i);
  const ex = currentDay().exercises[i];
  const s = getSession();
  const wasOpen = card.querySelector('details.how')?.open;
  card.innerHTML = exerciseInner(ex, i, s);
  card.classList.toggle('done', exDone(ex, i, s));
  card.classList.toggle('skipped', exSkipped(ex, i, s));
  const how = card.querySelector('details.how');
  if (wasOpen && how) how.open = true;
}

// Bloc del final: acabar la sessió encara que no estigui tot fet, o reobrir-la.
function finishBlock(s) {
  const { done, total, skipped, pct } = progressOf(currentDay(), s);
  const skippedText = skipped ? ` · ${plural(skipped, 'saltat', 'saltats')}` : '';
  if (s?.finished) {
    return `<p class="finish-done">${ICON_CHECK} Sessió acabada · ${done} de ${total}${skippedText}</p>
      <button type="button" class="ghost" data-act="reopen">Reobre la sessió</button>`;
  }
  return `<button type="button" class="btn" data-act="finish">Acaba la sessió</button>
    <p>${done === total ? 'Tot fet. Deixa-la acabada i tanca el dia.' : `Pots acabar-la encara que no estigui tot fet: es desarà al ${pct}%${skippedText}.`}</p>`;
}

function syncCard(card) {
  const i = Number(card.dataset.i);
  const ex = currentDay().exercises[i];
  const done = exDone(ex, i, getSession());
  card.classList.toggle('done', done);
  const btn = card.querySelector('.complete');
  btn.setAttribute('aria-pressed', String(done));
  btn.innerHTML = done ? `${ICON_CHECK} Completat` : 'Completa';
}

function resetIdle() {
  return '<button type="button" class="ghost danger-text" data-act="reset">Reinicia la sessió</button>';
}

// Escalfament del dia: la llista comuna més el pas extra segons si és de tronc o de cames.
function warmupItems(day) {
  const w = window.PLAN.warmup;
  const extra = w.extra?.[day.kind];
  if (!extra) return w.items;
  const items = w.items.slice();
  items.splice(Math.max(0, items.length - 1), 0, extra);
  return items;
}

function sessionHead(day, { chip = '' } = {}) {
  return `<header class="session-head" id="session-head">
    <p class="eyebrow">${day.id.toUpperCase()} · ${fmtLong(state.date)}</p>
    <h1>${esc(day.title)}</h1>
    <p class="focus">${esc(day.focus)} <span class="dur tabular">≈ ${dayMinutes(day)} min</span>${chip}</p>
    <div class="ring" role="img" aria-label="Progrés de la sessió">
      <svg viewBox="0 0 72 72"><circle class="track" cx="36" cy="36" r="30"/><circle class="fill" id="progress-fill" cx="36" cy="36" r="30"/></svg>
      <b id="progress-pct"></b>
    </div>
    <p class="progress-text" aria-live="polite"><span id="progress-label"></span></p>
  </header>`;
}

function renderTrain() {
  const s = getSession();
  const day = dayOf(s) || dayById(state.day);
  const parts = [];

  if (state.editing) {
    parts.push(`<div class="banner"><span>Edites la sessió del <b>${fmtLong(state.date)}</b>.</span>
      <button type="button" class="link" data-act="today">Torna a avui</button></div>`);
  } else if (state.restNote && !s) {
    parts.push(`<div class="banner"><span>${esc(state.restNote)}</span></div>`);
  }
  if (!state.editing) parts.push(deloadBanner());

  // El dia 5 no és una sessió fixa: natació o sessió de compensació.
  if (state.day === OPTIONAL && !s) {
    trainEl.innerHTML = parts.join('') + renderDayFive();
    return;
  }

  if (s?.banner) parts.push(`<div class="banner"><span>${esc(s.banner)}</span></div>`);
  const deload = isDeloadDate(state.date) && !day.comp;
  parts.push(sessionHead(day, { chip: deload ? '<span class="dur">Descàrrega</span>' : '' }));

  parts.push(checkItem('warm', 'Escalfament', window.PLAN.warmup.time, warmupItems(day), !!s?.warm));
  parts.push(`<ol class="exercises">${day.exercises.map((ex, i) => exerciseCard(ex, i, s)).join('')}</ol>`);
  parts.push(checkItem('cardio', 'Cardio', day.cardio, null, !!s?.cardio));
  parts.push('<section class="card muscles-today" id="muscles-today" aria-label="Músculs treballats avui"></section>');
  parts.push('<div class="finish" id="finish"></div>');
  parts.push(`<div class="reset" id="reset">${resetIdle()}</div>`);

  trainEl.innerHTML = parts.join('');
  updateProgress();
}

function updateProgress() {
  const s = getSession();
  if (!$('#progress-label')) return;
  const { done, total, pct, skipped, finished } = progressOf(currentDay(), s);
  const skippedText = skipped ? ` · ${plural(skipped, 'saltat', 'saltats')}` : '';
  $('#progress-label').innerHTML = finished
    ? `<b>Sessió acabada</b> · ${done} de ${total}${skippedText}`
    : done === total
      ? `<b>Sessió completada</b>${skippedText}`
      : `<b>${done}</b> de ${total} completats${skippedText}`;
  $('#progress-pct').textContent = `${pct}%`;
  const C = 2 * Math.PI * 30; // perímetre del cercle de l'anell
  $('#progress-fill').style.strokeDasharray = C;
  $('#progress-fill').style.strokeDashoffset = C * (1 - pct / 100);
  $('#session-head').classList.toggle('is-complete', finished || done === total);
  const fin = $('#finish');
  if (fin) fin.innerHTML = finishBlock(s);
  renderMusclesToday();
  daysEl.querySelector(`[data-day="${state.day}"]`)?.classList.toggle('has-data', !!getSession());
}

const buzz = (pattern = 60) => { try { navigator.vibrate?.(pattern); } catch { /* sense vibració */ } };

// ---------- Natació ----------

const swimText = (w) => [`${w.minutes} min`, SWIM_STYLES[w.style] || '', w.meters ? `${fmtInt(w.meters)} m` : ''].filter(Boolean).join(' · ');
const swimInWeek = (monday) => weekDays(monday).filter((d) => swim[d]);

function swimForm(date) {
  const w = swim[date];
  return `<div class="card swim-form" data-swim-date="${date}">
    <h2>Natació · ${fmtDay(date)}</h2>
    <label class="field"><span>Minuts</span><input data-swim="minutes" type="number" inputmode="numeric" min="1" max="300" value="${w?.minutes ?? ''}" placeholder="40"></label>
    <label class="field"><span>Estil principal</span>
      <select data-swim="style">${Object.entries(SWIM_STYLES).map(([k, t]) => `<option value="${k}"${(w?.style || 'crol') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="field"><span>Metres (opcional)</span><input data-swim="meters" type="number" inputmode="numeric" min="0" step="50" value="${w?.meters ?? ''}" placeholder="1500"></label>
    <p class="hint">${esc(SWIM_NOTE)}</p>
    <p class="status err" role="status" data-swim-msg></p>
    <div class="row"><button type="button" class="btn" data-act="swim-save">Desa</button><button type="button" class="ghost" data-act="swim-cancel">Cancel·la</button></div>
  </div>`;
}

// Desa el formulari de natació del contenidor; torna false si falten els minuts.
function saveSwim(form) {
  const date = form.dataset.swimDate;
  const minutes = Math.round(Number(form.querySelector('[data-swim="minutes"]').value));
  if (!Number.isInteger(minutes) || minutes <= 0) {
    form.querySelector('[data-swim-msg]').textContent = 'Posa els minuts que has nedat.';
    return false;
  }
  const meters = Number(form.querySelector('[data-swim="meters"]').value);
  swim[date] = { minutes, style: form.querySelector('[data-swim="style"]').value, updated: new Date().toISOString() };
  if (meters > 0) swim[date].meters = meters;
  saveJSON(SWIM_KEY, swim);
  state.swimDate = '';
  return true;
}

function swimSummary(date) {
  const w = swim[date];
  return `<section class="cal-session swim-done"><header><b>Natació</b><span class="tabular full">${esc(swimText(w))}</span></header>
    <div class="row"><button type="button" class="ghost" data-act="swim-edit">Edita</button><button type="button" class="ghost danger-text" data-act="swim-delete">Esborra</button></div></section>`;
}

// ---------- Dia 5: natació o compensació ----------

// Sèries fetes aquesta setmana per múscul (principals 1, secundaris 0,5) i per clau d'exercici.
function weekSessions(monday, until = addDays(monday, 6)) {
  return Object.values(sessions).filter((s) => s.date >= monday && s.date <= until && dayOf(s) && !isEmpty(s));
}

function musclesDone(list) {
  const by = {};
  for (const s of list) {
    const day = dayOf(s);
    day.exercises.forEach((ex, i) => {
      const m = window.PLAN.muscles?.[ex.key];
      if (!m || exSkipped(ex, i, s)) return;
      const done = (s.sets?.[setKey(i, ex)] || []).slice(0, countOf(s, i, ex)).filter(Boolean).length;
      m.main.forEach((id) => { by[id] = (by[id] || 0) + done; });
      m.aux.forEach((id) => { by[id] = (by[id] || 0) + done / 2; });
    });
  }
  return by;
}

// Estat d'un dia D1–D4 dins la setmana: fet (≥ 80 % de les sèries), parcial, no fet o pendent (encara no toca).
function dayStatus(id, monday, date) {
  const list = weekSessions(monday, date).filter((s) => s.day === id && !s.plan);
  if (list.length) {
    const t = list.reduce((a, s) => { const x = setsOfSession(s); a.done += x.done; a.planned += x.planned; return a; }, { done: 0, planned: 0 });
    const pct = t.planned ? t.done / t.planned : 0;
    return { st: pct >= 0.8 ? 'fet' : pct > 0 ? 'parcial' : 'nofet', pct: Math.round(pct * 100) };
  }
  const plannedDate = weekDays(monday).find((d) => planned(d) === id);
  if (plannedDate && plannedDate >= date) return { st: 'pendent', pct: 0 };
  return { st: 'nofet', pct: 0 };
}

const lowerDayRecent = (date, except) => Object.values(sessions).some((s) => s !== except && (s.date === date || s.date === addDays(date, -1)) && dayById(s.day)?.kind === 'lower' && !isEmpty(s) && setsOfSession(s).done > 0);

// Proposta per al dia 5: o bé un dia sencer que falta, o bé una sessió composta.
function buildComp(date, { ignoreMissing = false } = {}) {
  const monday = mondayOf(date);
  const list = weekSessions(monday, date).filter((s) => !(s.date === date && s.day === OPTIONAL));
  const legsRecent = lowerDayRecent(date);

  if (!ignoreMissing) {
    const missing = MAIN_DAYS.filter((id) => dayStatus(id, monday, date).st === 'nofet');
    if (missing.length) {
      const done = musclesDone(list);
      const score = (id) => dayById(id).exercises.reduce((n, ex) => n + (window.PLAN.muscles?.[ex.key]?.main || []).reduce((a, m) => a + (done[m] || 0), 0), 0);
      const pick = missing.slice().sort((a, b) => score(a) - score(b) || (dayById(a).kind === 'upper' ? -1 : 1))[0];
      return { missing: pick, reduce: dayById(pick).kind === 'lower' && legsRecent, others: missing.filter((id) => id !== pick) };
    }
  }

  // Exercicis saltats per molèstia aquesta setmana: fora.
  const pain = new Set();
  for (const s of list) {
    const day = dayOf(s);
    day.exercises.forEach((ex, i) => { if (skipInfo(s.skip?.[setKey(i, ex)])?.reason === 'pain') pain.add(ex.key); });
  }

  // Sèries pendents dels dies D1–D4.
  const pending = {};
  for (const s of list) {
    if (s.plan || s.day === OPTIONAL) continue;
    const day = dayOf(s);
    day.exercises.forEach((ex, i) => {
      if (pain.has(ex.key) || (legsRecent && HEAVY_LEGS.includes(ex.key))) return;
      const n = countOf(s, i, ex);
      const left = exSkipped(ex, i, s) ? n : n - (s.sets?.[setKey(i, ex)] || []).slice(0, n).filter(Boolean).length;
      if (left <= 0) return;
      if (!pending[ex.key] || pending[ex.key].sets < left) pending[ex.key] = { key: ex.key, sets: left, from: s.day };
    });
  }

  const items = Object.values(pending);
  const core = CORE_BLOCK.filter((c) => !pain.has(c.key)).map((c) => ({ ...c, from: 'core' }));
  const has = (key) => items.some((p) => p.key === key) || core.some((c) => c.key === key);
  const budget = SESSION_MAX - WARMUP_MIN - CARDIO_MIN;
  const minutes = (plan) => strengthMinutes(dayOf({ plan, date }));
  // Si només amb les pendents ja es passa dels 80 min, es treuen aïllaments (els últims primer).
  while (items.length && minutes([...items, ...core]) > budget) {
    const idx = items.map((p, i) => (EX_BY_KEY[p.key]?.compound ? -1 : i)).filter((i) => i >= 0).at(-1) ?? items.length - 1;
    items.splice(idx, 1);
  }
  for (const key of COMP_ORDER) {
    if (pain.has(key) || has(key)) continue;
    const def = exDef(key, OPTIONAL);
    const candidate = [...items, { key, sets: def.sets, from: OPTIONAL }];
    if (minutes([...candidate, ...core]) > budget) continue;
    items.push(candidate.at(-1));
  }
  return finishComp(orderComp([...items, ...core]), date);
}

// Compostos primer, aïllaments després i el core al final.
function orderComp(plan) {
  const rank = (p) => (p.from === 'core' || !EX_BY_KEY[p.key]?.weight ? 2 : EX_BY_KEY[p.key]?.compound ? 0 : 1);
  return plan.map((p, i) => ({ p, i })).sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
}

// Cardio: el que sobra fins a 80 min, entre 20 i 30.
function finishComp(plan, date) {
  const strength = strengthMinutes(dayOf({ plan, date }));
  const cardioMin = Math.max(CARDIO_MIN, Math.min(CARDIO_MAX, SESSION_MAX - WARMUP_MIN - strength));
  return { plan, cardioMin, minutes: WARMUP_MIN + strength + cardioMin };
}

function renderDayFive() {
  const parts = [];
  const head = `<header class="session-head" id="session-head">
    <p class="eyebrow">D5 · ${fmtLong(state.date)}</p><h1>Dia opcional</h1>
    <p class="focus">Natació o sessió de compensació</p></header>`;

  if (state.swimDate === state.date) return head + swimForm(state.date);

  const c = state.comp;
  if (!c) {
    const w = swim[state.date];
    parts.push(head);
    parts.push(`<section class="card chooser"><h2>Què fas avui?</h2>
      ${w ? `<p class="chooser-note">${ICON_CHECK} Avui ja has nedat: <b>${esc(swimText(w))}</b>.</p>` : ''}
      <button type="button" class="choice" data-act="comp-swim"><b>${w ? 'Edita la natació' : 'He anat a nedar'}</b><small>Minuts, estil i metres. Compta com a dia 5 i com a cardio.</small></button>
      <button type="button" class="choice" data-act="comp-build"><b>Gimnàs: sessió de compensació</b><small>Recupera el més important del que ha faltat aquesta setmana, en 80 min com a màxim.</small></button>
    </section>`);
    return parts.join('');
  }

  if (c.missing) {
    const d = dayById(c.missing);
    parts.push(head);
    parts.push(`<section class="card chooser"><h2>Aquesta setmana no has fet el ${d.id.toUpperCase()} · ${esc(d.title)}</h2>
      <p>La sessió d'avui és aquell dia sencer, amb el seu escalfament i el seu cardio (≈ ${dayMinutes(d)} min).</p>
      ${c.reduce ? '<p class="chooser-note">Ahir vas fer cames: avui una sèrie menys als exercicis pesats.</p>' : ''}
      ${c.others.length ? `<p class="chooser-note">També falta: ${c.others.map((id) => id.toUpperCase()).join(', ')}. No s'acumula; queda com a no fet al resum de la setmana.</p>` : ''}
      <div class="row"><button type="button" class="btn" data-act="comp-missing-go" data-day="${d.id}">Fes el ${d.id.toUpperCase()} avui</button>
      <button type="button" class="ghost" data-act="comp-missing-skip">Prefereixo la compensació normal</button></div>
      <button type="button" class="link" data-act="comp-back">Enrere</button>
    </section>`);
    return parts.join('');
  }

  const vday = dayOf({ plan: c.plan, cardioMin: c.cardioMin, date: state.date });
  const inPlan = new Set(c.plan.map((p) => p.key));
  const options = Object.values(EX_BY_KEY).filter((ex) => !inPlan.has(ex.key)).map((ex) => `<option value="${esc(ex.key)}">${esc(ex.name)}</option>`).join('');
  const label = (p) => (p.from === 'core' ? 'Core' : p.from === OPTIONAL ? 'D5' : `Pendent del ${p.from.toUpperCase()}`);
  parts.push(head);
  parts.push(`<section class="card chooser"><h2>Sessió de compensació <span class="dur tabular">≈ ${c.minutes} min</span></h2>
    <ol class="comp-list">${vday.exercises.map((ex) => `<li data-key="${esc(ex.key)}">
      <span class="comp-main"><b>${esc(ex.name)}</b><small>${ex.sets} × ${esc(ex.reps)} · <em class="from-tag">${label(ex)}</em></small></span>
      <button type="button" class="ghost icon" data-act="comp-remove" aria-label="Treu ${esc(ex.name)}">✕</button></li>`).join('')}</ol>
    <p class="chooser-note">Escalfament ${WARMUP_MIN} min · força ${c.minutes - WARMUP_MIN - c.cardioMin} min · cardio ${c.cardioMin} min.</p>
    ${options ? `<div class="comp-add"><select data-comp-add aria-label="Afegeix un exercici">${options}</select><button type="button" class="ghost" data-act="comp-add">Afegeix</button></div>` : ''}
    <div class="row"><button type="button" class="btn" data-act="comp-start">Comença la sessió</button><button type="button" class="ghost" data-act="comp-back">Enrere</button></div>
  </section>`);
  return parts.join('');
}

// Crea la sessió d'un dia que faltava, amb una sèrie menys als pesats si ahir vas fer cames.
function startMissingDay(id, reduce) {
  setPlanned(state.date, id);
  persistSchedule();
  state.day = id;
  const s = ensureSession();
  if (reduce) {
    dayById(id).exercises.forEach((ex, i) => { if (HEAVY_LEGS.includes(ex.key) && ex.sets > 1) s.count[setKey(i, ex)] = ex.sets - 1; });
    s.banner = 'Ahir vas fer cames: avui una sèrie menys als exercicis pesats.';
    s.updated = new Date().toISOString();
    persist();
  }
  state.comp = null;
}

function startComp(c) {
  const s = ensureSession();
  s.plan = c.plan.map((p) => ({ key: p.key, sets: p.sets, from: p.from }));
  s.cardioMin = c.cardioMin;
  s.updated = new Date().toISOString();
  persist();
  state.comp = null;
}

// ---------- Temporitzador de descans ----------

// Es basa en l'hora de final, així continua bé encara que el mòbil apagui la pantalla un moment.
const timer = { end: 0, total: 0, id: 0, lock: null, doneUntil: 0 };
const timerEl = $('#timer');
const fmtClock = (s) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

async function keepAwake(on) {
  try {
    if (on && !timer.lock && navigator.wakeLock) timer.lock = await navigator.wakeLock.request('screen');
    if (!on && timer.lock) { await timer.lock.release(); timer.lock = null; }
  } catch { timer.lock = null; }
}

function startRest(seconds, label = 'Descans') {
  timer.label = label;
  timer.total = seconds * 1000;
  timer.end = Date.now() + timer.total;
  timer.doneUntil = 0;
  clearInterval(timer.id);
  timer.id = setInterval(tickRest, 250);
  keepAwake(true);
  tickRest();
}

function stopRest() {
  clearInterval(timer.id);
  timer.end = 0;
  timer.doneUntil = 0;
  timerEl.hidden = true;
  document.body.classList.remove('with-timer');
  keepAwake(false);
}

function tickRest() {
  const now = Date.now();
  if (timer.doneUntil) {
    if (now > timer.doneUntil) stopRest();
    return;
  }
  const left = Math.max(0, Math.ceil((timer.end - now) / 1000));
  timerEl.hidden = false;
  document.body.classList.add('with-timer');
  timerEl.classList.remove('finished');
  $('#timer-label').textContent = timer.label || 'Descans';
  $('#timer-time').textContent = fmtClock(left);
  $('#timer-fill').style.width = `${Math.min(100, ((timer.total - (timer.end - now)) / timer.total) * 100)}%`;
  if (left === 0) {
    timer.doneUntil = now + 5000;
    timerEl.classList.add('finished');
    $('#timer-label').textContent = 'Som-hi!';
    $('#timer-time').textContent = 'Següent sèrie';
    buzz([300, 150, 300]);
    keepAwake(false);
  }
}

timerEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-timer]');
  if (!btn) return;
  if (btn.dataset.timer === 'stop') { stopRest(); return; }
  if (timer.doneUntil) return;
  const delta = Number(btn.dataset.timer) * 1000;
  timer.end = Math.max(Date.now() + 1000, timer.end + delta);
  timer.total = Math.max(timer.total + delta, timer.end - Date.now());
  tickRest();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.end) { if (!timer.doneUntil) keepAwake(true); tickRest(); }
});

// Llista de booleans o textos ajustada al nombre de sèries.
function sized(arr, n, fill) {
  const a = (arr || []).slice(0, n);
  while (a.length < n) a.push(fill);
  return a;
}

function exerciseOf(card) {
  const i = Number(card.dataset.i);
  const ex = currentDay().exercises[i];
  return { i, ex, k: setKey(i, ex) };
}

function toggleSet(card, btn) {
  const { i, ex, k } = exerciseOf(card);
  const s = ensureSession();
  const n = countOf(s, i, ex);
  const arr = sized(s.sets[k], n, false);
  const j = Number(btn.dataset.s);
  const wasDone = exDone(ex, i, s);
  arr[j] = !arr[j];
  if (arr.some(Boolean)) s.sets[k] = arr; else delete s.sets[k];
  btn.setAttribute('aria-pressed', String(arr[j]));
  if (exDone(ex, i, s) && !wasDone) buzz();
  if (arr[j]) {
    const pair = pairOf(currentDay(), i);
    startRest(restOf(ex, i), pair ? `Ara: ${pair.name}` : 'Descans');
  }
  save(s);
  syncCard(card);
  updateProgress();
}

// «Completa» marca totes les sèries; si ja estava complet, les desmarca.
function toggleComplete(card) {
  const { i, ex, k } = exerciseOf(card);
  const s = ensureSession();
  const n = countOf(s, i, ex);
  if (exDone(ex, i, s)) {
    delete s.sets[k];
  } else {
    s.sets[k] = Array(n).fill(true);
    buzz();
  }
  save(s);
  refreshCard(card);
  updateProgress();
}

function changeCount(card, delta) {
  const { i, ex, k } = exerciseOf(card);
  const s = ensureSession();
  const n = Math.min(MAX_SETS, Math.max(1, countOf(s, i, ex) + delta));
  // En descàrrega es desa sempre, perquè el valor no depengui de quina setmana és la de descàrrega.
  if (n === ex.sets && !isDeloadDate(s.date)) delete s.count[k]; else s.count[k] = n;
  if (s.sets[k]) s.sets[k] = sized(s.sets[k], n, false);
  if (s.reps[k]) s.reps[k] = sized(s.reps[k], n, '');
  save(s);
  refreshCard(card);
  updateProgress();
}

function toggleField(field) {
  const s = ensureSession();
  s[field] = !s[field];
  const wrap = trainEl.querySelector(`.check[data-field="${field}"]`);
  wrap.classList.toggle('done', s[field]);
  wrap.querySelector('.check-btn').setAttribute('aria-pressed', String(s[field]));
  if (s[field]) buzz();
  save(s);
  updateProgress();
}

trainEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const card = btn.closest('.ex');

  if (act === 'set') toggleSet(card, btn);
  else if (act === 'complete') toggleComplete(card);
  else if (act === 'more') changeCount(card, 1);
  else if (act === 'less') changeCount(card, -1);
  else if (act === 'toggle') toggleField(btn.dataset.field);
  else if (act === 'photo') openPhoto(exerciseOf(card).ex);
  else if (act === 'anim-toggle') window.ANIM.toggle(btn.closest('.anim'));
  else if (act === 'anim-view') window.ANIM.flip(btn.closest('.anim'));
  else if (act === 'skip') {
    state.skipping = exerciseOf(card).k;
    state.skipZone = false;
    refreshCard(card);
  } else if (act === 'skip-cancel') {
    state.skipping = '';
    refreshCard(card);
  } else if (act === 'skip-reason' && btn.dataset.reason === 'pain') {
    state.skipZone = true;
    refreshCard(card);
  } else if (act === 'skip-reason' || act === 'skip-zone' || act === 'unskip') {
    const { k } = exerciseOf(card);
    const s = ensureSession();
    if (act === 'unskip') delete s.skip[k];
    else s.skip[k] = act === 'skip-zone' ? { reason: 'pain', zone: btn.dataset.zone } : { reason: btn.dataset.reason };
    state.skipping = '';
    save(s);
    refreshCard(card);
    updateProgress();
  } else if (act === 'deload-yes' || act === 'deload-no' || act === 'deload-undo') {
    const monday = mondayOf(todayISO());
    if (act === 'deload-yes') { meta.prevDeload = meta.lastDeload || ''; meta.lastDeload = monday; meta.deloadWeek = monday; setDeloadWeek(monday, true); }
    else if (act === 'deload-no') meta.deloadDismissed = monday;
    else { delete meta.deloadWeek; meta.lastDeload = meta.prevDeload || undefined; if (!meta.lastDeload) delete meta.lastDeload; meta.deloadDismissed = monday; setDeloadWeek(monday, false); }
    saveJSON(META_KEY, meta);
    renderTrain();
  } else if (act === 'comp-swim') {
    state.swimDate = state.date;
    renderTrain();
  } else if (act === 'swim-save' || act === 'swim-cancel') {
    if (act === 'swim-save' && !saveSwim(btn.closest('[data-swim-date]'))) return;
    state.swimDate = '';
    renderTrain();
  } else if (act === 'comp-build') {
    state.comp = buildComp(state.date);
    renderTrain();
  } else if (act === 'comp-missing-skip') {
    state.comp = buildComp(state.date, { ignoreMissing: true });
    renderTrain();
  } else if (act === 'comp-missing-go') {
    startMissingDay(btn.dataset.day, !!state.comp?.reduce);
    renderAll();
  } else if (act === 'comp-back') {
    state.comp = null;
    renderTrain();
  } else if (act === 'comp-remove') {
    const key = btn.closest('[data-key]').dataset.key;
    state.comp = finishComp(state.comp.plan.filter((p) => p.key !== key), state.date);
    renderTrain();
  } else if (act === 'comp-add') {
    const key = trainEl.querySelector('[data-comp-add]').value;
    const def = EX_BY_KEY[key];
    if (!def) return;
    // Els afegits a mà compten com a extra (D5) o, si són de terra, com a core.
    state.comp = finishComp(orderComp([...state.comp.plan, { key, sets: def.sets, from: def.weight ? OPTIONAL : 'core' }]), state.date);
    renderTrain();
  } else if (act === 'comp-start') {
    startComp(state.comp);
    renderAll();
  } else if (act === 'finish' || act === 'reopen') {
    const s = ensureSession();
    s.finished = act === 'finish';
    if (s.finished) { stopRest(); buzz([80, 60, 80]); }
    save(s);
    updateProgress();
    if (s.finished) $('#finish').scrollIntoView({ block: 'center' });
  } else if (act === 'reset') {
    $('#reset').innerHTML = `<p>Vols esborrar tot el que has marcat en aquesta sessió?</p>
      <div class="row"><button type="button" class="danger" data-act="reset-yes">Sí, reinicia</button>
      <button type="button" class="ghost" data-act="reset-no">Cancel·la</button></div>`;
  } else if (act === 'reset-no') {
    $('#reset').innerHTML = resetIdle();
  } else if (act === 'reset-yes') {
    delete sessions[currentKey()];
    persist();
    renderDays();
    renderTrain();
  } else if (act === 'today') {
    chooseToday();
    renderAll();
  }
});

trainEl.addEventListener('input', (e) => {
  const input = e.target;
  if (input.matches('input[data-key]')) {
    const s = ensureSession();
    const v = input.value.trim();
    if (v) s.kg[input.dataset.key] = v; else delete s.kg[input.dataset.key];
    save(s);
  } else if (input.matches('input[data-setting]')) {
    const v = input.value.trim();
    if (v) machine[input.dataset.setting] = v; else delete machine[input.dataset.setting];
    saveJSON(SETTINGS_KEY, machine);
    return;
  } else if (input.matches('input[data-step]')) {
    const v = input.value.trim();
    if (v) steps[input.dataset.step] = v; else delete steps[input.dataset.step];
    saveJSON(STEPS_KEY, steps);
    return;
  } else if (input.matches('input[data-skipnote]')) {
    const s = ensureSession();
    const k = input.dataset.skipnote;
    const info = skipInfo(s.skip[k]) || { reason: 'pain', zone: 'altre' };
    const v = input.value.trim();
    if (v) info.note = v; else delete info.note;
    s.skip[k] = info;
    save(s);
    return;
  } else if (input.matches('input[data-rep]')) {
    const card = input.closest('.ex');
    const { i, ex, k } = exerciseOf(card);
    const s = ensureSession();
    const arr = sized(s.reps[k], countOf(s, i, ex), '');
    arr[Number(input.dataset.rep)] = input.value.trim();
    if (arr.some(Boolean)) s.reps[k] = arr; else delete s.reps[k];
    save(s);
  } else {
    return;
  }
  updateProgress();
});

trainEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
});

// L'animació només corre mentre «Com fer-ho» és obert. (`toggle` no fa bombolla.)
trainEl.addEventListener('toggle', (e) => {
  const fig = e.target.querySelector?.('.anim');
  if (!fig) return;
  if (e.target.open) window.ANIM.open(fig); else window.ANIM.close(fig);
}, true);

daysEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-day]');
  if (!btn || btn.dataset.day === state.day) return;
  state.day = btn.dataset.day;
  state.restNote = '';
  resetTransient();
  renderDays();
  renderTrain();
  window.scrollTo(0, 0);
});

// ---------- Foto gran ----------

function openPhoto(ex) {
  lightbox.querySelector('img').src = `img/${ex.photo}.jpg`;
  lightbox.querySelector('p').textContent = ex.machine;
  lightbox.showModal();
  // Perquè el botó enrere d'Android tanqui la foto i no l'app.
  history.pushState({ lightbox: true }, '');
}

function closePhoto() {
  if (!lightbox.open) return;
  lightbox.close();
  if (history.state?.lightbox) history.back();
}

lightbox.addEventListener('click', closePhoto);
lightbox.addEventListener('cancel', (e) => { e.preventDefault(); closePhoto(); });
window.addEventListener('popstate', () => { if (lightbox.open) lightbox.close(); });

// ---------- Pantalla Calendari ----------

function sessionStatus(date, w, today) {
  const s = sessions[keyOf(date, w)];
  if (s) {
    const pct = progressOf(dayOf(s), s).pct;
    if (pct === 100) return { cls: 'done', text: `${ICON_CHECK} Fet` };
    if (s.finished) return { cls: 'done', text: `${ICON_CHECK} ${pct}%` };
    return { cls: 'partial', text: `${pct}%` };
  }
  if (w === OPTIONAL) {
    // La natació de qualsevol dia de la setmana compta com a dia 5.
    if (swim[date]) return { cls: 'done', text: `${ICON_CHECK} Natació` };
    const other = swimInWeek(mondayOf(date))[0];
    if (other) return { cls: 'done', text: `${ICON_CHECK} Natació ${WEEKDAYS[parseISO(other).getDay()]}` };
  }
  if (date < today) return w === OPTIONAL ? { cls: '', text: 'Opcional' } : { cls: 'missed', text: 'No fet' };
  if (date === today) return { cls: 'today', text: 'Avui' };
  return { cls: '', text: w === OPTIONAL ? 'Opcional' : '' };
}

// Resum del que es va fer: un element per exercici amb dades (pes, repeticions o sèries).
function sessionSummary(s) {
  const day = dayOf(s);
  const { pct } = progressOf(day, s);
  const items = [];
  if (s.warm) items.push({ text: 'Escalfament', done: true });
  day.exercises.forEach((ex, i) => {
    const k = setKey(i, ex);
    if (exSkipped(ex, i, s)) { items.push({ html: `${esc(ex.name)} · saltat (${esc(skipText(skipInfo(s.skip[k])).toLowerCase())})`, skipped: true }); return; }
    const n = countOf(s, i, ex);
    const doneSets = (s.sets?.[k] || []).slice(0, n).filter(Boolean).length;
    const reps = (s.reps?.[k] || []).slice(0, n).filter(hasText);
    const kg = ex.weight ? String(s.kg?.[ex.key] ?? '').trim() : '';
    if (!doneSets && !reps.length && !kg) return;
    const done = exDone(ex, i, s);
    const bits = [esc(ex.name)];
    if (kg) bits.push(`<b class="tabular">${esc(kg)} kg</b>`);
    if (reps.length) bits.push(`<span class="tabular">${esc(reps.join('/'))}${isTimed(ex) ? ' s' : ''}</span>`);
    if (!done || !reps.length) bits.push(`<span class="tabular">${doneSets}/${n} sèries</span>`);
    items.push({ html: bits.join(' · '), done });
  });
  if (s.cardio) items.push({ text: 'Cardio', done: true });

  const list = items.length
    ? `<ul class="cal-log">${items.map((it) => `<li class="${it.done ? 'done' : it.skipped ? 'skipped' : ''}">${it.done ? ICON_CHECK : it.skipped ? '<span class="dash" aria-hidden="true"></span>' : '<span class="dot" aria-hidden="true"></span>'}<span>${it.html ?? esc(it.text)}</span></li>`).join('')}</ul>`
    : '<p class="cal-log-empty">Encara no hi ha res registrat.</p>';

  return `<section class="cal-session">
    <header><b>${s.day.toUpperCase()} · ${esc(day.title)}</b><span class="tabular${pct === 100 || s.finished ? ' full' : ''}">${s.finished && pct < 100 ? 'Acabada · ' : ''}${pct}%</span></header>
    ${list}
    <button type="button" class="ghost" data-act="cal-session" data-day="${s.day}">Obre la sessió</button>
  </section>`;
}

function calActions(date, w, today) {
  const acts = [];
  const isWorkout = w !== 'rest';
  // Primer, el resum de les sessions d'aquell dia (la planificada primer).
  Object.values(sessions)
    .filter((s) => s.date === date && dayOf(s))
    .sort((a, b) => (b.day === w) - (a.day === w) || a.day.localeCompare(b.day))
    .forEach((s) => acts.push(sessionSummary(s)));
  if (date <= today) {
    if (state.swimDate === date) acts.push(swimForm(date));
    else if (swim[date]) acts.push(swimSummary(date));
  }
  if (isWorkout && date <= today && !sessions[keyOf(date, w)]) {
    acts.push(`<button type="button" class="btn" data-act="cal-train">${date === today ? 'Entrena' : 'Registra-la'}</button>`);
  }
  if (date <= today && !swim[date] && state.swimDate !== date) {
    acts.push('<button type="button" class="ghost" data-act="swim-edit">He anat a nedar</button>');
  }
  if (date >= today) {
    if (isWorkout) {
      acts.push('<button type="button" class="ghost" data-act="cal-postpone">Aplaza un dia</button>');
      acts.push(`<div class="cal-move"><label>Mou a <input type="date" min="${today}" value="${addDays(date, 1)}"></label>
        <button type="button" class="ghost" data-act="cal-move">Mou</button></div>`);
      acts.push(`<button type="button" class="ghost danger-text" data-act="cal-skip">${w === OPTIONAL ? 'Avui no el faré' : 'Salta'}</button>`);
    } else {
      acts.push(`<div class="cal-add"><span>Entrena aquest dia:</span>
        ${DAYS.map((d) => `<button type="button" class="chip" data-act="cal-add" data-day="${d.id}">${d.id.toUpperCase()}</button>`).join('')}</div>`);
    }
    if (schedule[date] !== undefined) {
      acts.push('<button type="button" class="link" data-act="cal-restore">Torna al pla original</button>');
    }
  }
  return acts.join('');
}

function renderCalendar(message = '', kind = '') {
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(state.week, i));
  const wk = weekStats(state.week);
  const optPlanned = days.some((d) => planned(d) === OPTIONAL);
  const isCurrent = state.week === mondayOf(today);
  const end = days[6];

  const rows = days.map((date) => {
    const w = planned(date);
    const day = dayById(w);
    const st = day ? sessionStatus(date, w, today) : { cls: '', text: '' };
    const extra = Object.values(sessions)
      .filter((s) => s.date === date && s.day !== w && dayOf(s))
      .map((s) => `${s.day.toUpperCase()} · ${progressOf(dayOf(s), s).pct}%`);
    if (swim[date] && w !== OPTIONAL) extra.push(`Natació · ${swimText(swim[date])}`);
    const actions = calActions(date, w, today);
    const open = state.calOpen === date && actions;
    const moved = schedule[date] !== undefined;
    const d = parseISO(date);
    const title = day && sessions[keyOf(date, w)]?.plan ? 'Sessió de compensació' : day?.title;

    return `<li class="cal-day${date === today ? ' is-today' : ''}${!day ? ' is-rest' : ''}" data-date="${date}">
      <button type="button" class="cal-row" data-act="cal-open"${actions ? ` aria-expanded="${!!open}"` : ' disabled'}>
        <span class="cal-date"><small>${WEEKDAYS[d.getDay()]}</small><b class="tabular">${d.getDate()}</b></span>
        <span class="cal-main">
          ${day
            ? `<b>${day.id.toUpperCase()} · ${esc(title)}</b><small>${esc(day.focus)} · ≈ ${dayMinutes(day)} min${moved ? ' · <em>Canviat</em>' : ''}</small>`
            : `<b class="muted">Descans</b>${moved ? '<small><em>Canviat</em></small>' : ''}`}
          ${extra.length ? `<small>${day ? 'També: ' : ''}${esc(extra.join(', '))}</small>` : ''}
        </span>
        <span class="cal-status ${st.cls}">${!day && swim[date] ? `${ICON_CHECK} Natació` : st.text}</span>
      </button>
      ${open ? `<div class="cal-actions">${actions}</div>` : ''}
    </li>`;
  }).join('');

  calendarEl.innerHTML = `
    <div class="cal-nav">
      <button type="button" class="ghost" data-act="cal-prev" aria-label="Setmana anterior">‹</button>
      <div class="cal-title"><b>${fmtShort(state.week)} – ${fmtShort(end)}</b>
        ${isCurrent ? '<small>Aquesta setmana</small>' : '<button type="button" class="link" data-act="cal-now">Torna a aquesta setmana</button>'}</div>
      <button type="button" class="ghost" data-act="cal-next" aria-label="Setmana següent">›</button>
    </div>
    <p class="cal-sum">${wk.done} de ${wk.planned} entrenaments fets${optPlanned || wk.optional ? ` · opcional: ${wk.optional ? 'fet' : 'pendent'}` : ''}</p>
    <p class="status ${kind}" role="status">${message}</p>
    <ul class="cal">${rows}</ul>
    <p class="hist-intro">Toca un dia per entrenar, aplaçar-lo, moure'l o apuntar-hi natació.</p>
    ${weekReport(state.week)}`;
}

// ---------- Resum de la setmana ----------

// Sèries planificades per múscul: els dies D1–D4 previstos aquella setmana (principals 1, secundaris 0,5).
function musclesPlanned(monday) {
  const by = {};
  for (const date of weekDays(monday)) {
    const day = dayById(planned(date));
    if (!day || day.id === OPTIONAL) continue;
    for (const ex of day.exercises) {
      const m = window.PLAN.muscles?.[ex.key];
      if (!m) continue;
      m.main.forEach((id) => { by[id] = (by[id] || 0) + ex.sets; });
      m.aux.forEach((id) => { by[id] = (by[id] || 0) + ex.sets / 2; });
    }
  }
  return by;
}

function weekReport(monday) {
  const today = todayISO();
  const end = addDays(monday, 6);
  const list = weekSessions(monday).sort((a, b) => a.date.localeCompare(b.date));
  const swims = swimInWeek(monday);
  if (!list.length && !swims.length && monday > today) return '';

  const sessionRows = list.map((s) => {
    const day = dayOf(s);
    const { done, planned: total } = setsOfSession(s);
    const skipped = [];
    day.exercises.forEach((ex, i) => { const info = skipInfo(s.skip?.[setKey(i, ex)]); if (info) skipped.push(`${ex.name} (${skipText(info).toLowerCase()})`); });
    const pct = total ? done / total : 0;
    const cls = pct >= 0.8 ? 'done' : pct > 0 ? 'partial' : 'missed';
    return `<li><span class="wr-main"><b>${s.day.toUpperCase()} · ${esc(day.short)}</b><small>${fmtDay(s.date)}${skipped.length ? ` · saltats: ${esc(skipped.join(', '))}` : ''}</small></span>
      <span class="cal-status ${cls} tabular">${done}/${total} sèries</span></li>`;
  });
  swims.forEach((d) => sessionRows.push(`<li><span class="wr-main"><b>Natació</b><small>${fmtDay(d)}</small></span><span class="cal-status done tabular">${esc(swimText(swim[d]))}</span></li>`));

  const plannedBy = musclesPlanned(monday);
  const doneBy = musclesDone(list);
  const over = end < today;
  const ids = [...new Set([...Object.keys(plannedBy), ...Object.keys(doneBy)])]
    .sort((a, b) => (plannedBy[b] || 0) - (plannedBy[a] || 0) || (doneBy[b] || 0) - (doneBy[a] || 0));
  const bars = ids.map((id) => {
    const p = plannedBy[id] || 0, d = doneBy[id] || 0;
    const low = over && p > 0 && d / p < 0.7;
    const pct = p ? Math.min(100, (d / p) * 100) : (d ? 100 : 0);
    return `<li class="${low ? 'low' : ''}"><span class="mb-name">${esc(window.MUSCLES?.names[id] || id)}</span>
      <span class="mbar"><span style="width:${pct.toFixed(0)}%"></span></span>
      <span class="mb-val tabular">${fmtKg(d)}/${fmtKg(p)}</span></li>`;
  }).join('');

  let cardio = swims.reduce((n, d) => n + swim[d].minutes, 0);
  for (const s of list) if (s.cardio) cardio += minutesOf(dayOf(s).cardio);

  const pains = [];
  for (const s of list) {
    const day = dayOf(s);
    day.exercises.forEach((ex, i) => {
      const info = skipInfo(s.skip?.[setKey(i, ex)]);
      if (info?.reason === 'pain') pains.push(`<li><b>${fmtDay(s.date)}</b> · ${esc(ex.name)} · ${esc(ZONES[info.zone])}${info.note ? ` · <em>${esc(info.note)}</em>` : ''}</li>`);
    });
  }

  return `<section class="week-report" aria-label="Resum de la setmana">
    <h2 class="sec">Resum de la setmana</h2>
    ${sessionRows.length ? `<ul class="wr-sessions">${sessionRows.join('')}</ul>` : '<p class="cal-log-empty">Encara no hi ha cap sessió aquesta setmana.</p>'}
    ${bars ? `<h3 class="wr-sub">Sèries per múscul <small>fetes / planificades${over ? ' · en taronja, menys del 70 %' : ''}</small></h3><ul class="mbars">${bars}</ul>` : ''}
    <p class="wr-line"><b>Cardio:</b> ${cardio ? `${cardio} min${swims.length ? ' (gimnàs i natació)' : ''}` : 'cap registrat'}</p>
    <p class="wr-line"><b>Molèsties:</b> ${pains.length ? '' : 'cap'}</p>
    ${pains.length ? `<ul class="wr-pains">${pains.join('')}</ul>` : ''}
  </section>`;
}

calendarEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const date = btn.closest('[data-date]')?.dataset.date;
  const w = date && planned(date);

  if (act === 'swim-edit') { state.swimDate = date; state.calOpen = date; renderCalendar(); }
  else if (act === 'swim-cancel') { state.swimDate = ''; renderCalendar(); }
  else if (act === 'swim-save') { if (saveSwim(btn.closest('[data-swim-date]'))) renderCalendar(`Natació del ${fmtDay(date)} desada.`, 'ok'); }
  else if (act === 'swim-delete') { delete swim[date]; saveJSON(SWIM_KEY, swim); renderCalendar(`Natació del ${fmtDay(date)} esborrada.`, 'ok'); }
  else if (act === 'cal-prev') { state.week = addDays(state.week, -7); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-next') { state.week = addDays(state.week, 7); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-now') { state.week = mondayOf(todayISO()); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-open') { state.calOpen = state.calOpen === date ? '' : date; renderCalendar(); }
  else if (act === 'cal-train' || act === 'cal-session') {
    state.date = date;
    state.day = act === 'cal-session' ? btn.dataset.day : w;
    state.restNote = '';
    state.editing = date !== todayISO();
    resetTransient();
    showScreen('train');
  } else if (act === 'cal-postpone') {
    postpone(date);
    state.calOpen = '';
    renderCalendar(`${sentence(`${w.toUpperCase()} passa al ${fmtDay(addDays(date, 1))}`)} Els entrenaments següents es mouen un dia fins al pròxim descans.`, 'ok');
  } else if (act === 'cal-move') {
    const target = btn.parentElement.querySelector('input[type="date"]').value;
    if (!target || target < todayISO() || target === date) {
      renderCalendar('Tria una data a partir d’avui i diferent d’aquesta.', 'err');
      return;
    }
    const other = planned(target);
    moveTo(date, target);
    state.calOpen = '';
    state.week = mondayOf(target);
    renderCalendar(sentence(`${w.toUpperCase()} mogut al ${fmtDay(target)}${dayById(other) ? `; ${other.toUpperCase()} passa al ${fmtDay(date)}` : ''}`), 'ok');
  } else if (act === 'cal-skip') {
    setPlanned(date, 'rest');
    persistSchedule();
    state.calOpen = '';
    renderCalendar(`${w.toUpperCase()} del ${fmtDay(date)}: saltat.`, 'ok');
  } else if (act === 'cal-add') {
    setPlanned(date, btn.dataset.day);
    persistSchedule();
    state.calOpen = '';
    renderCalendar(sentence(`${btn.dataset.day.toUpperCase()} afegit el ${fmtDay(date)}`), 'ok');
  } else if (act === 'cal-restore') {
    delete schedule[date];
    persistSchedule();
    state.calOpen = '';
    renderCalendar('Dia restaurat al pla original.', 'ok');
  }
});

// ---------- Estadístiques ----------

const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
const fmtInt = (n) => Math.round(n).toLocaleString('ca-ES');

// Volum = kg × repeticions de les sèries fetes (sense comptar l'assistència de les dominades).
function sessionVolume(s) {
  const day = dayOf(s);
  let volume = 0, sets = 0;
  day.exercises.forEach((ex, i) => {
    const k = setKey(i, ex);
    const n = countOf(s, i, ex);
    const kg = ex.weight === true ? parseKg(s.kg?.[ex.key]) : NaN;
    (s.sets?.[k] || []).slice(0, n).forEach((on, j) => {
      if (!on) return;
      sets++;
      const r = Number(s.reps?.[k]?.[j]);
      if (Number.isFinite(kg) && r > 0) volume += kg * r;
    });
  });
  return { volume, sets };
}

// Una setmana és completa si s'han fet tots els entrenaments principals planificats (l'opcional no compta).
function weekStats(monday) {
  const days = weekDays(monday);
  const end = days[6];
  const mainIds = [...new Set(days.map(planned).filter((w) => dayById(w) && w !== OPTIONAL))];
  const inWeek = Object.values(sessions).filter((s) => s.date >= monday && s.date <= end && dayOf(s) && !isEmpty(s));
  const doneIds = new Set(inWeek.filter((s) => !s.plan || setsOfSession(s).done > 0).map((s) => s.day));
  const done = mainIds.filter((w) => doneIds.has(w)).length;
  let volume = 0, sets = 0;
  for (const s of inWeek) { const v = sessionVolume(s); volume += v.volume; sets += v.sets; }
  // L'opcional compta amb la sessió del dia 5 o amb natació qualsevol dia de la setmana.
  return { monday, end, planned: mainIds.length, done, optional: doneIds.has(OPTIONAL) || swimInWeek(monday).length > 0, complete: mainIds.length > 0 && done >= mainIds.length, volume, sets };
}

// Setmanes completes seguides, comptant l'actual només si ja està completa.
function streak() {
  let monday = mondayOf(todayISO());
  let n = weekStats(monday).complete ? 1 : 0;
  for (let i = 0; i < 104; i++) {
    monday = addDays(monday, -7);
    if (!weekStats(monday).complete) break;
    n++;
  }
  return n;
}

function exerciseSeries(key) {
  return Object.values(sessions)
    .filter((s) => Number.isFinite(parseKg(s.kg?.[key])))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updated || '').localeCompare(b.updated || ''))
    .map((s) => {
      const rk = Object.keys(s.reps || {}).find((k) => k.endsWith(`:${key}`));
      return { date: s.date, kg: parseKg(s.kg[key]), reps: rk ? s.reps[rk].filter(hasText) : [] };
    });
}

// Exercicis amb pes, un per clau, en l'ordre del pla.
const WEIGHTED = [];
for (const d of DAYS) for (const ex of d.exercises) if (ex.weight && !WEIGHTED.some((w) => w.key === ex.key)) WEIGHTED.push(ex);

function niceStep(range) {
  for (const s of [1, 2.5, 5, 10, 20, 25, 50, 100]) if (range / s <= 4) return s;
  return 200;
}

// ---------- Pantalla Progrés ----------

const statsEl = $('#stats');
const charts = {}; // punts de cada gràfica, per al tooltip

function weeksChart(weeks) {
  const W = 320, H = 150, L = 22, R = 6, T = 10, B = 24;
  const max = Math.max(1, ...weeks.map((w) => Math.max(w.planned, w.done)));
  const band = (W - L - R) / weeks.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const grid = Array.from({ length: max + 1 }, (_, v) => `
    <line class="c-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="c-tick" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const cols = weeks.map((w, i) => {
    const cx = L + band * i + band / 2;
    const x = cx - bw / 2;
    const base = y(0);
    // Columna amb la cantonada de dalt arrodonida i la base recta.
    const column = (v, cls) => {
      const top = y(v);
      const r = Math.min(4, (base - top) / 2);
      return `<path class="${cls}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
    };
    // Al fons, els planificats en clar; a sobre, els fets.
    const target = w.planned > 0 ? column(w.planned, 'c-track') : '';
    const bar = w.done > 0 ? column(Math.min(w.done, max), `c-bar${w.complete ? ' complete' : ''}`) : '';
    const label = i === weeks.length - 1 || i === 0 ? `<text class="c-tick" x="${cx}" y="${H - 6}" text-anchor="middle">${fmtShort(w.monday)}</text>` : '';
    return `${target}${bar}${label}
      <rect class="c-hit" data-week="${i}" x="${cx - band / 2}" y="${T}" width="${band}" height="${H - T - B}"/>`;
  }).join('');
  charts.weeks = weeks;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entrenaments fets per setmana, les últimes ${weeks.length} setmanes">${grid}${cols}</svg>`;
}

function weekInfo(w) {
  return `Setmana del ${fmtShort(w.monday)}: <b>${w.done} de ${w.planned}</b>${w.optional ? ' + opcional' : ''} · ${plural(w.sets, 'sèrie', 'sèries')} · ${fmtInt(w.volume)} kg`;
}

function lineChart(series) {
  const W = 320, H = 170, L = 34, R = 44, T = 12, B = 24;
  const t0 = parseISO(series[0].date).getTime();
  const t1 = parseISO(series[series.length - 1].date).getTime();
  const kgs = series.map((p) => p.kg);
  const lo = Math.min(...kgs), hi = Math.max(...kgs);
  const step = niceStep(Math.max(hi - lo, 5));
  const ymin = Math.max(0, Math.floor((lo - step / 2) / step) * step);
  const ymax = Math.ceil((hi + step / 2) / step) * step;
  const x = (iso) => (t1 === t0 ? (L + W - R) / 2 : L + ((parseISO(iso).getTime() - t0) / (t1 - t0)) * (W - L - R));
  const y = (v) => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin));
  const ticks = [];
  for (let v = ymin; v <= ymax + 1e-9; v += step) ticks.push(v);
  const pts = series.map((p) => ({ ...p, x: x(p.date), y: y(p.kg) }));
  const last = pts[pts.length - 1];
  charts.line = pts;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolució del pes">
    ${ticks.map((v) => `<line class="c-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="c-tick" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmtKg(v)}</text>`).join('')}
    <text class="c-tick" x="${L}" y="${H - 6}">${fmtShort(series[0].date)}</text>
    ${pts.length > 1 ? `<text class="c-tick" x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(last.date)}</text>` : ''}
    <line class="c-cross" id="c-cross" x1="${last.x}" x2="${last.x}" y1="${T}" y2="${H - B}"/>
    ${pts.length > 1 ? `<polyline class="c-line" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>` : ''}
    ${pts.map((p, i) => `<circle class="c-dot" data-pt="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"/>`).join('')}
    <text class="c-end" x="${last.x + 8}" y="${last.y + 4}">${fmtKg(last.kg)} kg</text>
    <rect class="c-hit" id="c-line-hit" x="${L - 10}" y="${T}" width="${W - L - R + 20}" height="${H - T - B}"/>
  </svg>`;
}

const pointInfo = (p) => `${fmtLong(p.date)} · <b>${fmtKg(p.kg)} kg</b>${p.reps.length ? ` · ${esc(p.reps.join('/'))}` : ''}`;

function renderStats() {
  const monday = mondayOf(todayISO());
  const cur = weekStats(monday);
  const prev = weekStats(addDays(monday, -7));
  const weeks = Array.from({ length: 8 }, (_, i) => weekStats(addDays(monday, -7 * (7 - i))));
  const st = streak();
  const delta = prev.volume > 0 && cur.volume > 0 ? Math.round(((cur.volume - prev.volume) / prev.volume) * 100) : null;

  const withData = WEIGHTED.filter((ex) => exerciseSeries(ex.key).length);
  if (!withData.some((ex) => ex.key === state.progEx)) {
    // Per defecte, l'exercici amb el registre més recent.
    state.progEx = withData.map((ex) => ({ key: ex.key, d: exerciseSeries(ex.key).at(-1).date }))
      .sort((a, b) => b.d.localeCompare(a.d))[0]?.key || '';
  }
  const ex = WEIGHTED.find((e) => e.key === state.progEx);
  const series = ex ? exerciseSeries(ex.key) : [];

  let exBlock = '<p class="empty">Quan apuntis pesos, aquí veuràs com evolucionen.</p>';
  if (ex) {
    const first = series[0], last = series[series.length - 1];
    const best = series.reduce((b, p) => ((ex.weight === 'assist' ? p.kg < b.kg : p.kg > b.kg) ? p : b), first);
    const change = last.kg - first.kg;
    exBlock = `
      <label class="field"><span>Exercici</span>
        <select id="prog-ex">${withData.map((e) => `<option value="${e.key}"${e.key === ex.key ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
      </label>
      <p class="chart-title">${ex.weight === 'assist' ? 'Assistència (kg) · com menys, millor' : 'Pes (kg)'}</p>
      ${lineChart(series)}
      <p class="chart-info" id="line-info">${pointInfo(last)}</p>
      <div class="facts">
        <span>${ex.weight === 'assist' ? 'Mínim' : 'Màxim'}: <b>${fmtKg(best.kg)} kg</b> (${fmtShort(best.date)})</span>
        ${series.length > 1 ? `<span>Des del ${fmtShort(first.date)}: <b>${change > 0 ? '+' : ''}${fmtKg(change)} kg</b></span>` : '<span>Amb dues sessions o més, veuràs la línia.</span>'}
      </div>
      <table class="ptable">
        <thead><tr><th>Data</th><th>Pes</th><th>Repeticions</th></tr></thead>
        <tbody>${series.slice(-6).reverse().map((p) => `<tr><td>${fmtShort(p.date)}</td><td class="tabular">${fmtKg(p.kg)} kg</td><td class="tabular">${esc(p.reps.join('/') || '—')}</td></tr>`).join('')}</tbody>
      </table>`;
  }

  statsEl.innerHTML = `
    <h2 class="sec">Aquesta setmana</h2>
    <div class="tiles">
      <div class="tile"><span>Entrenaments</span><b>${cur.done} de ${cur.planned}</b><small>${cur.optional ? '+ opcional' : cur.complete ? 'Setmana completa' : '&nbsp;'}</small></div>
      <div class="tile"><span>Setmanes seguides</span><b>${st}</b><small>${st === 1 ? 'completa' : 'completes'}</small></div>
      <div class="tile"><span>Volum</span><b>${fmtInt(cur.volume)}</b><small class="${delta === null ? '' : delta >= 0 ? 'up' : 'down'}">${delta === null ? 'kg' : `kg · ${delta >= 0 ? '+' : ''}${delta}% vs anterior`}</small></div>
    </div>

    <h2 class="sec">Últimes 8 setmanes</h2>
    ${weeksChart(weeks)}
    <p class="chart-info" id="week-info">${weekInfo(cur)}</p>
    <p class="chart-note">Fons clar: entrenaments planificats. Columna: fets. En verd, setmanes completes. Toca una setmana per veure'n el detall.</p>

    <h2 class="sec">Progrés per exercici</h2>
    ${exBlock}`;
}

statsEl.addEventListener('change', (e) => {
  if (e.target.id === 'prog-ex') { state.progEx = e.target.value; renderStats(); }
});

statsEl.addEventListener('click', (e) => {
  const hit = e.target.closest('[data-week]');
  if (hit) $('#week-info').innerHTML = weekInfo(charts.weeks[Number(hit.dataset.week)]);
});

// Creu i tooltip: el punt més proper al dit o al ratolí.
statsEl.addEventListener('pointermove', showNearest);
statsEl.addEventListener('pointerdown', showNearest);
function showNearest(e) {
  if (e.target.id !== 'c-line-hit' || !charts.line) return;
  const svg = e.target.ownerSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const { x } = pt.matrixTransform(svg.getScreenCTM().inverse());
  const i = charts.line.reduce((best, p, j) => (Math.abs(p.x - x) < Math.abs(charts.line[best].x - x) ? j : best), 0);
  const p = charts.line[i];
  const cross = svg.querySelector('#c-cross');
  cross.setAttribute('x1', p.x); cross.setAttribute('x2', p.x);
  svg.querySelectorAll('.c-dot').forEach((d) => d.classList.toggle('active', Number(d.dataset.pt) === i));
  $('#line-info').innerHTML = pointInfo(p);
}

// ---------- Pantalla Historial ----------

function renderHistory(message = '', kind = '') {
  const list = Object.entries(sessions).sort(([, a], [, b]) => byRecent(a, b));
  const rows = list.map(([k, s]) => {
    const day = dayOf(s);
    const pct = day ? progressOf(day, s).pct : null;
    return `<li><button type="button" data-act="open" data-k="${esc(k)}">
      <span class="h-day">${esc(s.day.toUpperCase())} · ${esc(day?.short ?? 'Dia antic')}</span>
      <span class="h-date">${fmtLong(s.date)}</span>
      <span class="h-pct${pct === 100 || s.finished ? ' full' : ''}">${pct === null ? '—' : `${pct}%`}</span>
    </button></li>`;
  }).join('');

  const due = backupDue();
  const lastCopy = meta.lastExport ? `Última còpia: ${fmtLong(meta.lastExport.slice(0, 10))}.` : 'Encara no has fet cap còpia.';
  historyEl.innerHTML = `
    ${due ? `<div class="banner warn-banner"><span><b>${due === Infinity ? 'Encara no has fet cap còpia de seguretat.' : `Fa ${due} dies que no fas cap còpia de seguretat.`}</b>
      Si perds o reinicies el mòbil, perdràs les dades. Exporta-les ara.</span></div>` : ''}
    <p class="hist-intro">Les dades només es desen en aquest mòbil. ${lastCopy}</p>
    <div class="hist-actions">
      <button type="button" class="btn" data-act="export">Exporta</button>
      ${canShareFiles() ? '<button type="button" class="ghost" data-act="share">Comparteix</button>' : ''}
      <label class="ghost">Importa<input type="file" id="import-file" accept="application/json,.json" hidden></label>
    </div>
    <p class="status ${kind}" role="status">${esc(message)}</p>
    ${list.length
      ? `<ul class="hist">${rows}</ul>`
      : '<p class="empty">Encara no hi ha cap sessió. Marca alguna sèrie a «Entrenar» i apareixerà aquí.</p>'}
    <p class="version" id="app-version"></p>`;
  showVersion();
}

// La versió instal·lada és el nom de la memòria cau del service worker (gimnas-vN).
async function showVersion() {
  const el = $('#app-version');
  if (!el) return;
  try {
    const keys = (await caches.keys()).filter((k) => k.startsWith('gimnas-'));
    el.textContent = keys.length ? `Versió de l'app: ${keys.map((k) => k.replace('gimnas-', '')).join(', ')}` : 'Versió de l’app: sense memòria cau (cal connexió)';
  } catch {
    el.textContent = '';
  }
}

historyEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'export') exportData();
  else if (btn.dataset.act === 'share') shareData();
  else if (btn.dataset.act === 'open') {
    const s = sessions[btn.dataset.k];
    if (!s || !dayOf(s)) return;
    state.date = s.date;
    state.day = s.day;
    state.restNote = '';
    state.editing = s.date !== todayISO();
    resetTransient();
    showScreen('train');
  }
});

historyEl.addEventListener('change', async (e) => {
  if (e.target.id !== 'import-file' || !e.target.files[0]) return;
  try {
    const { added, updated, skipped } = mergeImport(JSON.parse(await e.target.files[0].text()));
    const bits = [plural(added, 'nova', 'noves'), plural(updated, 'actualitzada', 'actualitzades')];
    if (skipped) bits.push(plural(skipped, 'ignorada', 'ignorades'));
    renderHistory(`Importació feta: ${bits.join(', ')}.`, 'ok');
    updateBackupDot();
  } catch {
    renderHistory("No s'ha pogut llegir el fitxer. Ha de ser un JSON exportat des d'aquesta app.", 'err');
  }
});

// Dies des de l'última còpia (o des de la primera sessió si no n'hi ha cap), si en passen massa.
function backupDue() {
  const dates = Object.values(sessions).map((s) => s.date).sort();
  if (!dates.length) return 0;
  const ref = meta.lastExport ? meta.lastExport.slice(0, 10) : dates[0];
  const days = daysBetween(ref, todayISO());
  if (days < BACKUP_DAYS) return 0;
  return meta.lastExport ? days : Infinity;
}

function updateBackupDot() {
  document.querySelector('.nav [data-screen="history"]').classList.toggle('dot', !!backupDue());
}

function exportFile() {
  const payload = {
    app: 'gimnas', version: 4, exported: new Date().toISOString(), sessions, schedule, machine, steps, swim,
    meta: { lastDeload: meta.lastDeload, deloadWeek: meta.deloadWeek },
  };
  return new File([JSON.stringify(payload, null, 2)], `gimnas-${todayISO()}.json`, { type: 'application/json' });
}

function markExported() {
  meta.lastExport = new Date().toISOString();
  saveJSON(META_KEY, meta);
  updateBackupDot();
}

const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }); } catch { return false; }
};

function exportData() {
  const file = exportFile();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  markExported();
  renderHistory(`S'ha descarregat ${file.name} amb ${plural(Object.keys(sessions).length, 'sessió', 'sessions')}.`, 'ok');
}

// Comparteix el fitxer (Drive, correu, WhatsApp...) amb el menú de compartir d'Android.
async function shareData() {
  const file = exportFile();
  try {
    await navigator.share({ files: [file], title: 'Còpia de Gimnàs' });
    markExported();
    renderHistory('Còpia compartida.', 'ok');
  } catch (e) {
    if (e?.name !== 'AbortError') renderHistory("No s'ha pogut compartir. Prova amb «Exporta».", 'err');
  }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanSession(s) {
  const bools = {}, texts = {}, counts = {}, kg = {};
  for (const [k, a] of Object.entries(s.sets || {})) if (Array.isArray(a)) bools[k] = a.map(Boolean);
  for (const [k, a] of Object.entries(s.reps || {})) if (Array.isArray(a)) texts[k] = a.map((v) => (hasText(v) ? String(v).trim() : ''));
  for (const [k, n] of Object.entries(s.count || {})) if (Number.isInteger(n) && n >= 1 && n <= MAX_SETS) counts[k] = n;
  for (const [k, v] of Object.entries(s.kg || {})) if (hasText(v)) kg[k] = String(v).trim();
  const skip = {};
  for (const [k, v] of Object.entries(s.skip || {})) { const info = skipInfo(v); if (info) skip[k] = info; }
  const out = { date: s.date, day: s.day, warm: !!s.warm, cardio: !!s.cardio, sets: bools, reps: texts, count: counts, kg, skip, finished: !!s.finished, updated: String(s.updated || '') };
  // Sessió de compensació: la llista generada d'exercicis.
  if (Array.isArray(s.plan)) {
    const plan = s.plan.filter((p) => p && EX_BY_KEY[p.key] && Number.isInteger(p.sets) && p.sets >= 1 && p.sets <= MAX_SETS)
      .map((p) => ({ key: p.key, sets: p.sets, from: /^(d\d+|core)$/.test(p.from) ? p.from : OPTIONAL }));
    if (plan.length) { out.plan = plan; out.cardioMin = Number.isInteger(s.cardioMin) ? s.cardioMin : CARDIO_MIN; }
  }
  if (hasText(s.banner)) out.banner = String(s.banner).trim();
  return out;
}

const SWIM_RE = /^\d+$/;
function cleanSwim(w) {
  const minutes = Number(w?.minutes);
  if (!Number.isInteger(minutes) || minutes <= 0) return null;
  const out = { minutes, style: SWIM_STYLES[w.style] ? w.style : 'crol', updated: String(w.updated || '') };
  const meters = Number(w.meters);
  if (meters > 0) out.meters = meters;
  return out;
}

// Fusiona: les sessions noves s'afegeixen; si ja existeix, guanya la modificada més tard.
// Del calendari, només s'importen els dies que aquí no s'han canviat.
function mergeImport(data) {
  const incoming = data && typeof data.sessions === 'object' ? data.sessions : data;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('format');
  let added = 0, updated = 0, skipped = 0;
  for (const [k, s] of Object.entries(incoming)) {
    const ok = s && typeof s === 'object' && ISO_RE.test(s.date) && /^d\d+$/.test(s.day) && k === keyOf(s.date, s.day);
    if (!ok) { skipped++; continue; }
    const cur = sessions[k];
    if (!cur) { sessions[k] = cleanSession(s); added++; }
    else if (String(s.updated || '') > String(cur.updated || '')) { sessions[k] = cleanSession(s); updated++; }
  }
  persist();

  if (data && data.schedule && typeof data.schedule === 'object') {
    for (const [date, v] of Object.entries(data.schedule)) {
      if (ISO_RE.test(date) && (v === 'rest' || dayById(v)) && schedule[date] === undefined) schedule[date] = v;
    }
    persistSchedule();
  }

  if (data && data.machine && typeof data.machine === 'object') {
    for (const [k, v] of Object.entries(data.machine)) if (hasText(v) && machine[k] === undefined) machine[k] = String(v).trim();
    saveJSON(SETTINGS_KEY, machine);
  }

  // Dades de la versió 4: pas de pes, natació i descàrregues. Les còpies antigues no en tenen.
  if (data && data.steps && typeof data.steps === 'object') {
    for (const [k, v] of Object.entries(data.steps)) if (hasText(v) && steps[k] === undefined) steps[k] = String(v).trim();
    saveJSON(STEPS_KEY, steps);
  }
  if (data && data.swim && typeof data.swim === 'object') {
    for (const [date, w] of Object.entries(data.swim)) {
      const clean = ISO_RE.test(date) ? cleanSwim(w) : null;
      if (clean && (!swim[date] || clean.updated > String(swim[date].updated || ''))) swim[date] = clean;
    }
    saveJSON(SWIM_KEY, swim);
  }
  if (data && data.meta && typeof data.meta === 'object') {
    const d = data.meta;
    if (ISO_RE.test(d.lastDeload || '') && (!meta.lastDeload || d.lastDeload > meta.lastDeload)) meta.lastDeload = d.lastDeload;
    if (ISO_RE.test(d.deloadWeek || '') && !meta.deloadWeek && d.deloadWeek >= mondayOf(todayISO())) meta.deloadWeek = d.deloadWeek;
    saveJSON(META_KEY, meta);
  }
  return { added, updated, skipped };
}

// ---------- Navegació ----------

const SCREENS = { train: trainEl, calendar: calendarEl, stats: statsEl, history: historyEl };

const TITLES = { train: 'Entrenar', calendar: 'Calendari', stats: 'Progrés', history: 'Historial' };

function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.nav [data-screen]').forEach((b) => {
    if (b.dataset.screen === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  for (const [key, el] of Object.entries(SCREENS)) el.hidden = key !== name;
  $('#screen-title').textContent = TITLES[name];
  const train = name === 'train';
  daysEl.hidden = !train;
  if (train) { renderDays(); renderTrain(); }
  else if (name === 'calendar') renderCalendar();
  else if (name === 'stats') renderStats();
  else renderHistory();
  updateBackupDot();
  window.scrollTo(0, 0);
}

function renderAll() { showScreen(state.screen); }

document.querySelector('.nav').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-screen]');
  if (btn) showScreen(btn.dataset.screen);
});

// Si l'app queda oberta d'un dia per l'altre, en tornar-hi mostra el dia que toca.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !state.editing && state.date !== todayISO()) {
    chooseToday();
    state.week = mondayOf(todayISO());
    renderAll();
  }
});

// ---------- Inici ----------

chooseToday();
renderAll();

navigator.storage?.persist?.().catch(() => {});

// Quan s'activa una versió nova de l'app, avisa i ofereix recarregar.
function showUpdateToast() {
  if ($('#update-toast')) return;
  const el = document.createElement('div');
  el.id = 'update-toast';
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span>Hi ha una versió nova de l’app.</span><button type="button">Actualitza</button>';
  el.querySelector('button').addEventListener('click', () => location.reload());
  document.body.append(el);
}

if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showUpdateToast();
    hadController = true;
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  // Cada vegada que tornes a l'app, comprova si hi ha una versió nova.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
  });
}
