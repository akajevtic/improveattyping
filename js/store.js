// All persistence. Every function takes `storage` (localStorage in the app, a fake in tests).
// shortcut: localStorage holds roughly 6,000 tests at ~0.7 KB each, move to IndexedDB when users report StorageFullError

export const KEYS = { tests: 'wk.tests', agg: 'wk.agg', settings: 'wk.settings', apiKey: 'wk.apiKey', coach: 'wk.coach' };
export const DEFAULT_SETTINGS = { seconds: 30, punctuation: false, list: 'english', weak: false, model: 'claude-opus-5-5' };
const APP = 'weak-keys';

export class StorageFullError extends Error {
  constructor() {
    super('Storage is full');
    this.name = 'StorageFullError';
  }
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isAgg = (v) => isObject(v) && isObject(v.pairs) && isObject(v.words);
const isTest = (v) => isObject(v) && typeof v.date === 'string' && typeof v.wpm === 'number' && isObject(v.keys);
const emptyAgg = () => ({ pairs: {}, words: {} });

// Unreadable data is copied aside before the caller treats it as empty, so nothing is lost silently.
function read(storage, key, isValid, fallback) {
  const raw = storage.getItem(key);
  if (raw === null) return fallback();
  try {
    const value = JSON.parse(raw);
    if (isValid(value)) return value;
  } catch { /* fall through to backup */ }
  try { storage.setItem(`${key}.corrupt`, raw); } catch { /* storage full: nothing more we can do */ }
  return fallback();
}

export const loadTests = (storage) => read(storage, KEYS.tests, (v) => Array.isArray(v) && v.every(isTest), () => []);
export const loadAgg = (storage) => read(storage, KEYS.agg, isAgg, emptyAgg);

export function saveTest(summary, storage) {
  const { pairs, words, ...record } = summary;
  const agg = loadAgg(storage);
  for (const [pair, { n, ms }] of Object.entries(pairs)) {
    const p = (agg.pairs[pair] ??= { n: 0, ms: 0 });
    p.n += n;
    p.ms += ms;
  }
  for (const [word, { n, err, ms }] of Object.entries(words)) {
    const w = (agg.words[word] ??= { n: 0, err: 0, ms: 0, ok: 0 });
    w.n += n;
    w.err += err;
    w.ms += ms;
    w.ok = err > 0 ? 0 : w.ok + n;
  }
  const tests = [...loadTests(storage), record];
  const previousAgg = storage.getItem(KEYS.agg);
  try {
    storage.setItem(KEYS.agg, JSON.stringify(agg));
    storage.setItem(KEYS.tests, JSON.stringify(tests));
  } catch {
    try {
      if (previousAgg === null) storage.removeItem(KEYS.agg);
      else storage.setItem(KEYS.agg, previousAgg);
    } catch { /* best effort */ }
    throw new StorageFullError();
  }
}

export function sumKeys(tests) {
  const total = {};
  for (const { keys } of tests) {
    for (const [key, { n, miss, as }] of Object.entries(keys)) {
      const k = (total[key] ??= { n: 0, miss: 0, as: {} });
      k.n += n;
      k.miss += miss;
      for (const [typed, count] of Object.entries(as ?? {})) k.as[typed] = (k.as[typed] ?? 0) + count;
    }
  }
  return total;
}

// Deliberately only tests and aggregate: never settings, never the API key.
export const exportData = (storage) =>
  JSON.stringify({ app: APP, v: 1, tests: loadTests(storage), agg: loadAgg(storage) });

export function importData(json, storage) {
  let data = null;
  try { data = JSON.parse(json); } catch { /* handled below */ }
  if (!isObject(data) || data.app !== APP || !Array.isArray(data.tests) || !data.tests.every(isTest) || !isAgg(data.agg)) {
    throw new Error('Not a Weak Keys history file');
  }
  try {
    storage.setItem(KEYS.agg, JSON.stringify(data.agg));
    storage.setItem(KEYS.tests, JSON.stringify(data.tests));
  } catch {
    throw new StorageFullError();
  }
  return data.tests.length;
}

export function clearData(storage) {
  for (const key of [KEYS.tests, KEYS.agg, KEYS.coach]) storage.removeItem(key);
}

// Last coach reading: { text, date, model }, or null.
export function loadCoach(storage) {
  try {
    const reading = JSON.parse(storage.getItem(KEYS.coach));
    return isObject(reading) && typeof reading.text === 'string' ? reading : null;
  } catch {
    return null;
  }
}

export function saveCoach(reading, storage) {
  try { storage.setItem(KEYS.coach, JSON.stringify(reading)); } catch { /* the reading stays on screen either way */ }
}

export function clampSeconds(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return DEFAULT_SETTINGS.seconds;
  const n = Math.floor(Number(value));
  return value !== '' && n >= 5 && n <= 3600 ? n : DEFAULT_SETTINGS.seconds;
}

export function loadSettings(storage) {
  let saved = null;
  try { saved = JSON.parse(storage.getItem(KEYS.settings)); } catch { /* use defaults */ }
  const merged = { ...DEFAULT_SETTINGS, ...(isObject(saved) ? saved : {}) };
  return { ...merged, seconds: clampSeconds(merged.seconds) };
}

export function saveSettings(settings, storage) {
  try { storage.setItem(KEYS.settings, JSON.stringify(settings)); } catch { /* settings are not worth an error */ }
}
