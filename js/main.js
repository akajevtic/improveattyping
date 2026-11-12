import english from './words/english.js';
import { generateWords } from './generator.js';
import { createEngine } from './engine.js';
import { summarize } from './summary.js';
import { keyAction } from './keys.js';
import {
  KEYS, loadSettings, saveSettings, clampSeconds, loadTests, loadAgg, sumKeys, saveTest, StorageFullError,
  loadCoach, saveCoach,
} from './store.js';
import { analyze } from './analysis.js';
import { weakPool, WEAK_UNLOCK_TESTS } from './weak.js';
import { renderWords, updateWord, moveCaret, setTimer } from './view-test.js';
import { renderResults, renderCoach, MIN_KEYSTROKES_TO_SAVE } from './view-results.js';
import { initSettings } from './view-settings.js';
import { MODELS, COACH_MIN_TESTS, buildCoachPayload, askCoach } from './coach.js';

const LIST_NAMES = ['english', 'english_1k', 'english_5k'];
const BATCH = 80; // words generated at a time
const AHEAD = 40; // keep at least this many untyped words

const $ = (id) => document.getElementById(id);
const el = {
  test: $('test-screen'),
  results: $('results-screen'),
  words: $('words'),
  timer: $('timer'),
  notice: $('notice'),
  punct: $('opt-punct'),
  weak: $('opt-weak'),
  list: $('opt-list'),
  custom: $('opt-custom'),
  times: [...document.querySelectorAll('[data-seconds]')],
};

// localStorage can throw when the browser blocks site data; the app then runs without saving.
function openStorage() {
  try {
    window.localStorage.getItem('wk.settings');
    return window.localStorage;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => { memory.set(k, String(v)); },
      removeItem: (k) => { memory.delete(k); },
    };
  }
}

export const storage = openStorage();

let settings = loadSettings(storage);
let engine = null;
let pool = english;
let phase = 'idle'; // idle → running → done
let screen = 'test';
let startedAt = 0;
let ticker = 0;
let run = 0;

const lists = new Map([['english', english]]);

export async function loadList(name) {
  if (!LIST_NAMES.includes(name)) return english;
  if (lists.has(name)) return lists.get(name);
  try {
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    lists.set(name, list);
    return list;
  } catch {
    return english; // offline or blocked: the default list always works
  }
}

export const unlockMessage = (missing) =>
  `Finish ${missing} more test${missing === 1 ? '' : 's'} to unlock weak-point practice.`;

const setNotice = (text) => { el.notice.textContent = text; };
const nextWords = () => generateWords(pool, BATCH, { punctuation: settings.punctuation });

function showScreen(name) {
  screen = name;
  el.test.hidden = name !== 'test';
  el.results.hidden = name !== 'results';
}

function syncModebar() {
  el.punct.setAttribute('aria-pressed', String(settings.punctuation));
  el.weak.setAttribute('aria-pressed', String(settings.weak));
  let preset = false;
  for (const button of el.times) {
    const on = Number(button.dataset.seconds) === settings.seconds;
    button.setAttribute('aria-pressed', String(on));
    preset ||= on;
  }
  el.custom.value = preset ? '' : settings.seconds;
  el.list.value = LIST_NAMES.includes(settings.list) ? settings.list : 'english';
  el.list.disabled = settings.weak; // weak-point mode builds its own word pool
}

export async function startTest() {
  const id = ++run;
  clearInterval(ticker);
  engine = null;
  phase = 'idle';
  setNotice('');
  showScreen('test');

  const tests = loadTests(storage);
  if (settings.weak && tests.length < WEAK_UNLOCK_TESTS) {
    settings = { ...settings, weak: false };
    saveSettings(settings, storage);
  }
  syncModebar();
  setTimer(el.timer, settings.seconds);
  el.timer.classList.remove('running');

  const source = settings.weak
    ? weakPool({ keys: sumKeys(tests), ...loadAgg(storage) }, await loadList('english_5k'))
    : await loadList(settings.list);
  if (id !== run) return; // a newer start replaced this one while the list loaded

  pool = source;
  engine = createEngine(nextWords());
  renderWords(el.words, engine);
  moveCaret(el.words, engine);
  el.words.classList.add('idle');
}

function begin(now) {
  phase = 'running';
  startedAt = now;
  el.words.classList.remove('idle');
  el.timer.classList.add('running');
  ticker = setInterval(tick, 100);
}

function tick() {
  const elapsed = performance.now() - startedAt;
  setTimer(el.timer, Math.max(0, Math.ceil(settings.seconds - elapsed / 1000)));
  if (elapsed >= settings.seconds * 1000) finish();
}

function finish() {
  clearInterval(ticker);
  phase = 'done';
  const { seconds, punctuation, list, weak } = settings;
  onTestFinished(summarize({
    engine,
    durationMs: seconds * 1000,
    settings: { seconds, punctuation, list, weak },
    date: new Date().toISOString(),
  }));
}

async function onTestFinished(summary) {
  const id = run;
  const previousTests = loadTests(storage);
  let saved = 'yes';
  if (summary.counts.correctKeys + summary.counts.wrongKeys < MIN_KEYSTROKES_TO_SAVE) {
    saved = 'too-short';
  } else {
    try {
      saveTest(summary, storage);
    } catch (err) {
      if (!(err instanceof StorageFullError)) throw err;
      saved = 'storage-full';
    }
  }

  const tests = loadTests(storage);
  const missing = WEAK_UNLOCK_TESTS - tests.length;
  let practice = { message: unlockMessage(missing) };
  if (missing <= 0) {
    const data = { keys: sumKeys(tests), ...loadAgg(storage) };
    const words = weakPool(data, await loadList('english_5k'));
    if (id !== run) return; // restarted while the list loaded
    practice = {
      words: [...new Set(words)].slice(0, 8),
      keys: analyze(data).weakKeys.slice(0, 3).map((k) => k.key),
    };
  }
  renderResults(el.results, { summary, previousTests, saved, practice });
  showCoach();
  showScreen('results');
}

let coachBusy = false;

function showCoach(extra = {}) {
  renderCoach(el.results, {
    hasKey: Boolean(storage.getItem(KEYS.apiKey)),
    enoughTests: loadTests(storage).length >= COACH_MIN_TESTS,
    last: loadCoach(storage),
    busy: coachBusy,
    ...extra,
  });
}

// Runs only on this click: every reading costs the user money.
async function askTheCoach() {
  const apiKey = storage.getItem(KEYS.apiKey);
  if (!apiKey || coachBusy) return;
  const model = MODELS.some((m) => m.id === settings.model) ? settings.model : MODELS[0].id;
  const output = $('coach-text');
  coachBusy = true;
  showCoach();
  output.textContent = '';
  let error;
  try {
    const text = await askCoach({
      apiKey,
      model,
      payload: buildCoachPayload(loadTests(storage), loadAgg(storage)),
      onText: (chunk) => { output.textContent += chunk; }, // textContent: model output is never parsed as HTML
    });
    saveCoach({ text, date: new Date().toISOString().slice(0, 10), model }, storage);
  } catch (err) {
    error = err.message;
  }
  coachBusy = false;
  showCoach({ error });
}

function update(patch) {
  settings = { ...settings, ...patch };
  saveSettings(settings, storage);
  document.activeElement?.blur(); // hand the keyboard back to the test
  startTest();
}

// The test owns the keyboard only when nothing else has focus and no dialog is open.
const focusInTest = () =>
  (document.activeElement === document.body || document.activeElement === null) && !document.querySelector('dialog[open]');

// shortcut: reads keydown only, so on-screen and mobile keyboards do not work; add a hidden input with beforeinput handling to support them
document.addEventListener('keydown', (e) => {
  const action = keyAction(e, focusInTest());
  if (!action) return;
  e.preventDefault();
  if (action.type === 'restart') { startTest(); return; }
  if (!engine || phase === 'done' || screen !== 'test') return;

  const index = engine.wordIndex;
  if (action.type === 'backspace') {
    engine.backspace();
  } else {
    const now = performance.now();
    engine.type(action.ch, now);
    if (phase === 'idle' && engine.keystrokes.length) begin(now);
  }

  if (engine.words.length - engine.wordIndex < AHEAD) {
    engine.addWords(nextWords());
    renderWords(el.words, engine);
  } else {
    updateWord(el.words, engine, index);
  }
  moveCaret(el.words, engine);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && phase === 'running') {
    startTest();
    setNotice('Test cancelled because the tab was hidden.');
  }
});

window.addEventListener('resize', () => { if (engine) moveCaret(el.words, engine); });

el.punct.addEventListener('click', () => update({ punctuation: !settings.punctuation }));
el.list.addEventListener('change', () => update({ list: el.list.value }));
el.custom.addEventListener('change', () => update({ seconds: clampSeconds(el.custom.value) }));
for (const button of el.times) {
  button.addEventListener('click', () => update({ seconds: Number(button.dataset.seconds) }));
}
el.weak.addEventListener('click', () => {
  const missing = WEAK_UNLOCK_TESTS - loadTests(storage).length;
  if (!settings.weak && missing > 0) {
    el.weak.blur();
    setNotice(unlockMessage(missing));
    return;
  }
  update({ weak: !settings.weak });
});

initSettings({
  storage,
  onChange({ history }) {
    settings = loadSettings(storage); // the dialog writes the model choice itself
    if (history) startTest(); // saved tests changed: results on screen and weak-point mode may be stale
    else showCoach(); // key added or removed
  },
});

$('coach-ask').addEventListener('click', askTheCoach);

$('btn-new').addEventListener('click', () => update({}));
$('btn-drill').addEventListener('click', () => update({ weak: true }));

startTest();
