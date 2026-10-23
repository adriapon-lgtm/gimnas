'use strict';

const STORE_KEY = 'gimnas.sessions.v1';
const SCHEDULE_KEY = 'gimnas.schedule.v1';
const SETTINGS_KEY = 'gimnas.machine.v1'; // ajustos de cada màquina, per clau d'exercici
const META_KEY = 'gimnas.meta.v1'; // { lastExport }
const BACKUP_DAYS = 14;
const KG_STEP = 2.5;
const MONTHS = ['gen.', 'febr.', 'març', 'abr.', 'maig', 'juny', 'jul.', 'ag.', 'set.', 'oct.', 'nov.', 'des.'];
const WEEKDAYS = ['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.'];
// Setmana tipus (0 = diumenge): dilluns D1, dimarts D2, dijous D3, divendres D4, dissabte D5 (opcional).
const WEEK = { 0: 'rest', 1: 'd1', 2: 'd2', 3: 'rest', 4: 'd3', 5: 'd4', 6: 'd5' };
const OPTIONAL = 'd5';
const MAX_SETS = 10;

const DAYS = window.PLAN.days;
const dayById = (id) => DAYS.find((d) => d.id === id);

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
// Descans entre sèries: 2 min al primer exercici del dia, 75 s a la resta i 45 s als de terra.
const restOf = (ex, i) => ex.rest ?? (i === 0 ? 120 : ex.weight ? 75 : 45);

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

const hasText = (v) => v !== null && v !== undefined && String(v).trim() !== '';

function isEmpty(s) {
  return !s.warm && !s.cardio
    && !Object.values(s.sets || {}).some((a) => a.some(Boolean))
    && !Object.values(s.kg || {}).some(hasText)
    && !Object.values(s.reps || {}).some((a) => a.some(hasText))
    && !Object.keys(s.count || {}).length
    && !Object.keys(s.skip || {}).length
    && !s.finished;
}

const state = { screen: 'train', date: todayISO(), day: 'd1', editing: false, restNote: '', week: mondayOf(todayISO()), calOpen: '', progEx: '' };

const currentKey = () => keyOf(state.date, state.day);
const getSession = () => sessions[currentKey()] || null;

function ensureSession() {
  const k = currentKey();
  if (!sessions[k]) {
    sessions[k] = { date: state.date, day: state.day, warm: false, cardio: false, sets: {}, reps: {}, count: {}, kg: {}, updated: '' };
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

const countOf = (s, i, ex) => s?.count?.[setKey(i, ex)] ?? ex.sets;

function exDone(ex, i, s) {
  const n = countOf(s, i, ex);
  const a = s?.sets?.[setKey(i, ex)];
  return n > 0 && !!a && a.length >= n && a.slice(0, n).every(Boolean);
}

const exSkipped = (ex, i, s) => !!s?.skip?.[setKey(i, ex)];

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

// Última sessió anterior amb pes o repeticions per a aquesta clau d'exercici,
// sigui quin sigui el dia del pla.
function lastFor(exKey, sameDay = false) {
  const cur = currentKey();
  let best = null;
  for (const [k, s] of Object.entries(sessions)) {
    if (k === cur || !s || s.date > state.date || (sameDay && s.day !== state.day)) continue;
    const kg = String(s.kg?.[exKey] ?? '').trim();
    const repsKey = Object.keys(s.reps || {}).find((rk) => rk.endsWith(`:${exKey}`) && s.reps[rk].some(hasText));
    const reps = repsKey ? s.reps[repsKey].map((v) => String(v ?? '').trim()) : [];
    if (!kg && !reps.length) continue;
    if (!best || byRecent(s, best) < 0) best = { date: s.date, updated: s.updated, kg, reps };
  }
  return best;
}

// Doble progressió: si a l'última sessió vas arribar al màxim de repeticions a totes les
// sèries, toca pujar; si alguna va quedar per sota del mínim, mantenir.
function suggestion(ex, last) {
  const range = repRange(ex);
  const kg = parseKg(last?.kg);
  if (!ex.weight || !range || isTimed(ex) || !Number.isFinite(kg)) return null;
  const reps = last.reps.filter(hasText).map(Number).filter((n) => n > 0);
  if (!reps.length) return null;
  const [lo, hi] = range;
  const assist = ex.weight === 'assist';
  if (reps.length >= ex.sets && reps.every((r) => r >= hi)) {
    const next = assist ? Math.max(0, kg - KG_STEP) : kg + KG_STEP;
    return {
      kind: 'up', kg: fmtKg(next),
      text: `${assist ? "Baixa l'assistència" : 'Puja'}: prova ${fmtKg(next)} kg`,
      why: `vas fer ${hi} o més a totes les sèries`,
    };
  }
  if (reps.some((r) => r < lo)) {
    return { kind: 'keep', kg: fmtKg(kg), text: `Mantén ${fmtKg(kg)} kg`, why: `alguna sèrie va quedar per sota de ${lo}; si et costa, baixa` };
  }
  return { kind: 'keep', kg: fmtKg(kg), text: `Mantén ${fmtKg(kg)} kg`, why: `intenta arribar a ${hi} a totes les sèries` };
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
        <p class="target tabular">${ex.sets} × ${esc(ex.reps)}</p>
      </div>
      <span class="tick" aria-label="Completat">${ICON_CHECK}</span>
    </div>`;

  if (exSkipped(ex, i, s)) {
    return `${top}<div class="skipped-row"><span>Saltat avui</span>
      <button type="button" class="ghost" data-act="unskip">Desfés</button></div>`;
  }

  let kg = '';
  // El suggeriment es basa en el mateix dia del pla si n'hi ha (el hip thrust del D4 és més pesat que el del D2).
  const tip = suggestion(ex, lastFor(ex.key, true) || last);
  if (ex.weight) {
    const assist = ex.weight === 'assist';
    kg = `<div class="kg">
      <label for="kg-${i}">${assist ? 'Assistència' : 'Pes'}</label>
      <span class="kg-input"><input id="kg-${i}" data-key="${esc(ex.key)}" type="text" inputmode="decimal"
        autocomplete="off" enterkeyhint="done" value="${esc(s?.kg?.[ex.key] ?? '')}" placeholder="${esc(tip?.kg ?? last?.kg ?? '')}"><span>kg</span></span>
      ${assist ? '<p class="hint">Com menys pes d’assistència, més difícil.</p>' : ''}
    </div>`;
  }
  const tipHtml = tip
    ? `<p class="tip ${tip.kind}">${tip.kind === 'up' ? '<span aria-hidden="true">↑</span> ' : ''}<b>${esc(tip.text)}</b> · ${esc(tip.why)}</p>`
    : '';
  const settings = ex.photo
    ? `<div class="machine-set"><label for="ms-${i}">Ajustos</label>
        <input id="ms-${i}" data-setting="${esc(ex.key)}" type="text" autocomplete="off" enterkeyhint="done"
          value="${esc(machine[ex.key] ?? '')}" placeholder="Seient, coixí, forat…"></div>`
    : '';

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
  dayById(state.day).exercises.forEach((ex, i) => {
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
  const ex = dayById(state.day).exercises[i];
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
  const { done, total, skipped, pct } = progressOf(dayById(state.day), s);
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
  const ex = dayById(state.day).exercises[i];
  const done = exDone(ex, i, getSession());
  card.classList.toggle('done', done);
  const btn = card.querySelector('.complete');
  btn.setAttribute('aria-pressed', String(done));
  btn.innerHTML = done ? `${ICON_CHECK} Completat` : 'Completa';
}

function resetIdle() {
  return '<button type="button" class="ghost danger-text" data-act="reset">Reinicia la sessió</button>';
}

function renderTrain() {
  const day = dayById(state.day);
  const s = getSession();
  const parts = [];

  if (state.editing) {
    parts.push(`<div class="banner"><span>Edites la sessió del <b>${fmtLong(state.date)}</b>.</span>
      <button type="button" class="link" data-act="today">Torna a avui</button></div>`);
  } else if (state.restNote && !s) {
    parts.push(`<div class="banner"><span>${esc(state.restNote)}</span></div>`);
  }

  parts.push(`<header class="session-head" id="session-head">
    <p class="eyebrow">${day.id.toUpperCase()} · ${fmtLong(state.date)}</p>
    <h1>${esc(day.title)}</h1>
    <p class="focus">${esc(day.focus)}</p>
    <div class="ring" role="img" aria-label="Progrés de la sessió">
      <svg viewBox="0 0 72 72"><circle class="track" cx="36" cy="36" r="30"/><circle class="fill" id="progress-fill" cx="36" cy="36" r="30"/></svg>
      <b id="progress-pct"></b>
    </div>
    <p class="progress-text" aria-live="polite"><span id="progress-label"></span></p>
  </header>`);

  parts.push(checkItem('warm', 'Escalfament', window.PLAN.warmup.time, window.PLAN.warmup.items, !!s?.warm));
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
  const { done, total, pct, skipped, finished } = progressOf(dayById(state.day), s);
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
  $('#session-head').classList.toggle('complete', finished || done === total);
  const fin = $('#finish');
  if (fin) fin.innerHTML = finishBlock(s);
  renderMusclesToday();
  daysEl.querySelector(`[data-day="${state.day}"]`)?.classList.toggle('has-data', !!getSession());
}

const buzz = (pattern = 60) => { try { navigator.vibrate?.(pattern); } catch { /* sense vibració */ } };

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

function startRest(seconds) {
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
  $('#timer-label').textContent = 'Descans';
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
  const ex = dayById(state.day).exercises[i];
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
  if (arr[j]) startRest(restOf(ex, i));
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
  if (n === ex.sets) delete s.count[k]; else s.count[k] = n;
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
  else if (act === 'skip' || act === 'unskip') {
    const { k } = exerciseOf(card);
    const s = ensureSession();
    if (act === 'skip') s.skip[k] = true; else delete s.skip[k];
    save(s);
    refreshCard(card);
    updateProgress();
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
    const pct = progressOf(dayById(w), s).pct;
    if (pct === 100) return { cls: 'done', text: `${ICON_CHECK} Fet` };
    if (s.finished) return { cls: 'done', text: `${ICON_CHECK} ${pct}%` };
    return { cls: 'partial', text: `${pct}%` };
  }
  if (date < today) return { cls: 'missed', text: 'No fet' };
  if (date === today) return { cls: 'today', text: 'Avui' };
  return { cls: '', text: w === OPTIONAL ? 'Opcional' : '' };
}

// Resum del que es va fer: un element per exercici amb dades (pes, repeticions o sèries).
function sessionSummary(s) {
  const day = dayById(s.day);
  const { pct } = progressOf(day, s);
  const items = [];
  if (s.warm) items.push({ text: 'Escalfament', done: true });
  day.exercises.forEach((ex, i) => {
    const k = setKey(i, ex);
    if (exSkipped(ex, i, s)) { items.push({ html: `${esc(ex.name)} · saltat`, skipped: true }); return; }
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
    .filter((s) => s.date === date && dayById(s.day))
    .sort((a, b) => (b.day === w) - (a.day === w) || a.day.localeCompare(b.day))
    .forEach((s) => acts.push(sessionSummary(s)));
  if (isWorkout && date <= today && !sessions[keyOf(date, w)]) {
    acts.push(`<button type="button" class="btn" data-act="cal-train">${date === today ? 'Entrena' : 'Registra-la'}</button>`);
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
      .filter((s) => s.date === date && s.day !== w && dayById(s.day))
      .map((s) => `${s.day.toUpperCase()} · ${progressOf(dayById(s.day), s).pct}%`);
    const actions = calActions(date, w, today);
    const open = state.calOpen === date && actions;
    const moved = schedule[date] !== undefined;
    const d = parseISO(date);

    return `<li class="cal-day${date === today ? ' is-today' : ''}${!day ? ' is-rest' : ''}" data-date="${date}">
      <button type="button" class="cal-row" data-act="cal-open"${actions ? ` aria-expanded="${!!open}"` : ' disabled'}>
        <span class="cal-date"><small>${WEEKDAYS[d.getDay()]}</small><b class="tabular">${d.getDate()}</b></span>
        <span class="cal-main">
          ${day
            ? `<b>${day.id.toUpperCase()} · ${esc(day.title)}</b><small>${esc(day.focus)}${moved ? ' · <em>Canviat</em>' : ''}</small>`
            : `<b class="muted">Descans</b>${moved ? '<small><em>Canviat</em></small>' : ''}`}
          ${extra.length ? `<small>També: ${esc(extra.join(', '))}</small>` : ''}
        </span>
        <span class="cal-status ${st.cls}">${st.text}</span>
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
    <p class="hist-intro">Toca un dia per entrenar, aplaçar-lo o moure'l.</p>`;
}

calendarEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const date = btn.closest('[data-date]')?.dataset.date;
  const w = date && planned(date);

  if (act === 'cal-prev') { state.week = addDays(state.week, -7); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-next') { state.week = addDays(state.week, 7); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-now') { state.week = mondayOf(todayISO()); state.calOpen = ''; renderCalendar(); }
  else if (act === 'cal-open') { state.calOpen = state.calOpen === date ? '' : date; renderCalendar(); }
  else if (act === 'cal-train' || act === 'cal-session') {
    state.date = date;
    state.day = act === 'cal-session' ? btn.dataset.day : w;
    state.restNote = '';
    state.editing = date !== todayISO();
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
  const day = dayById(s.day);
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
  const inWeek = Object.values(sessions).filter((s) => s.date >= monday && s.date <= end && dayById(s.day) && !isEmpty(s));
  const doneIds = new Set(inWeek.map((s) => s.day));
  const done = mainIds.filter((w) => doneIds.has(w)).length;
  let volume = 0, sets = 0;
  for (const s of inWeek) { const v = sessionVolume(s); volume += v.volume; sets += v.sets; }
  return { monday, end, planned: mainIds.length, done, optional: doneIds.has(OPTIONAL), complete: mainIds.length > 0 && done >= mainIds.length, volume, sets };
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
    const day = dayById(s.day);
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
      : '<p class="empty">Encara no hi ha cap sessió. Marca alguna sèrie a «Entrenar» i apareixerà aquí.</p>'}`;
}

historyEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'export') exportData();
  else if (btn.dataset.act === 'share') shareData();
  else if (btn.dataset.act === 'open') {
    const s = sessions[btn.dataset.k];
    if (!s || !dayById(s.day)) return;
    state.date = s.date;
    state.day = s.day;
    state.restNote = '';
    state.editing = s.date !== todayISO();
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
  const payload = { app: 'gimnas', version: 3, exported: new Date().toISOString(), sessions, schedule, machine };
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
  for (const [k, v] of Object.entries(s.skip || {})) if (v) skip[k] = true;
  return { date: s.date, day: s.day, warm: !!s.warm, cardio: !!s.cardio, sets: bools, reps: texts, count: counts, kg, skip, finished: !!s.finished, updated: String(s.updated || '') };
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
