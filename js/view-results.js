import { analyze, heatLevel, pickTip } from './analysis.js';

export const MIN_KEYSTROKES_TO_SAVE = 10;

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const SAVE_NOTES = {
  yes: '',
  'too-short': 'Too short to save.',
  'storage-full': 'Storage is full. This test was not saved. Export your history in Settings, then clear it.',
};

// Every number on screen goes through here so a bad value can never print as NaN.
const fmt = (value, suffix = '') => (Number.isFinite(value) ? `${Math.round(value)}${suffix}` : '-');
const keyName = (ch) => (ch === ' ' ? 'space' : ch);
const times = (n) => `${n} time${n === 1 ? '' : 's'}`;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function row(label, value) {
  const li = node('li');
  li.append(node('span', '', label), node('span', 'value', value));
  return li;
}

function difference(summary, previousTests) {
  if (!previousTests.length) return 'first test';
  const mean = previousTests.reduce((sum, t) => sum + t.wpm, 0) / previousTests.length;
  const d = Math.round(summary.wpm - mean);
  if (!Number.isFinite(d)) return '-';
  return d > 0 ? `+${d}` : String(d);
}

function keyboard(keys) {
  return ROWS.map((letters, r) => {
    const rowEl = node('div', `kb-row kb-row-${r}`);
    for (const key of letters) {
      const stat = keys[key];
      const keyEl = node('span', `key heat-${heatLevel(keys, key)}`, key);
      keyEl.title = stat ? `${key}: ${stat.miss} of ${stat.n} missed` : `${key}: not typed`;
      rowEl.append(keyEl);
    }
    return rowEl;
  });
}

// Coach box. `last` is the stored reading or null; `error` replaces the "last reading" line when a request failed.
export function renderCoach(root, { hasKey, enoughTests, last, busy, error }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const ready = hasKey && enoughTests;
  $('coach-box').hidden = false;

  const ask = $('coach-ask');
  ask.hidden = !ready;
  ask.disabled = busy;
  ask.textContent = busy ? 'Reading your history…' : 'Ask the coach';

  const meta = $('coach-meta');
  meta.classList.toggle('error', Boolean(error));
  meta.textContent = error ?? (ready && last && !busy ? `Last reading: ${last.date}` : '');

  if (busy) return; // the text is being streamed in
  $('coach-text').textContent = ready && last ? last.text : '';
  if (!ready) {
    meta.textContent = hasKey
      ? 'Finish 3 tests and the coach can read your history.'
      : 'Add a Claude API key in Settings to get coaching on your whole history.';
  }
}

// practice is { words, keys } once weak-point mode is unlocked, otherwise { message }.
export function renderResults(root, { summary, previousTests, saved, practice }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const { confusions, slowPairs } = analyze(summary);

  $('save-note').textContent = SAVE_NOTES[saved];
  $('r-wpm').textContent = fmt(summary.wpm);
  $('r-acc').textContent = fmt(summary.accuracy, '%');
  $('r-raw').textContent = fmt(summary.rawWpm);
  $('r-diff').textContent = difference(summary, previousTests);

  $('r-keyboard').replaceChildren(...keyboard(summary.keys));

  const wrong = [
    ...confusions.slice(0, 3).map((c) => row(`${keyName(c.expected)} → typed ${keyName(c.typed)}`, times(c.count))),
    ...slowPairs.slice(0, 2).map((p) => row(`slowest pair: ${p.pair}`, fmt(p.avg, ' ms'))),
  ];
  $('r-wrong').replaceChildren(...(wrong.length ? wrong : [node('li', 'empty', 'No mistakes worth listing.')]));

  $('r-tip').textContent = pickTip(summary);

  const unlocked = Array.isArray(practice.words);
  $('r-next-words').textContent = unlocked ? practice.words.join(' ') : '';
  $('r-next-note').textContent = unlocked
    ? (practice.keys.length ? `Built from your weak keys: ${practice.keys.join(', ')}` : 'Built from the words you miss most.')
    : practice.message;
  $('btn-drill').disabled = !unlocked;
}
