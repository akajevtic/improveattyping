import { computeScores } from './scoring.js';

const SEGMENTS = 4;
const isLetter = (ch) => ch >= 'a' && ch <= 'z';

export const normalizeWord = (target) => target.toLowerCase().replace(/[^a-z']/g, '');

// Compact record of one finished test. Raw keystrokes are not kept.
export function summarize({ engine, durationMs, settings, date }) {
  const { words, wordIndex, keystrokes } = engine;
  const counts = { correctWordChars: 0, allChars: wordIndex, correctKeys: 0, wrongKeys: 0 };
  const keys = {};
  const pairs = {};
  const perWord = []; // by word index: { err, ms }
  const segs = Array.from({ length: SEGMENTS }, () => ({ ok: 0, all: 0 }));

  keystrokes.forEach((k, i) => {
    if (k.correct) counts.correctKeys++; else counts.wrongKeys++;

    if (k.expected !== null) {
      const key = (keys[k.expected.toLowerCase()] ??= { n: 0, miss: 0, as: {} });
      key.n++;
      if (!k.correct) {
        key.miss++;
        const typed = k.typed.toLowerCase();
        key.as[typed] = (key.as[typed] ?? 0) + 1;
      }
    }

    const prev = keystrokes[i - 1];
    if (prev && prev.correct && k.correct && prev.wordIndex === k.wordIndex) {
      const a = prev.typed.toLowerCase();
      const b = k.typed.toLowerCase();
      if (isLetter(a) && isLetter(b)) {
        const pair = (pairs[a + b] ??= { n: 0, ms: 0 });
        pair.n++;
        pair.ms += k.ms;
      }
    }

    const w = (perWord[k.wordIndex] ??= { err: 0, ms: 0 });
    if (!k.correct) w.err = 1;
    w.ms += k.ms;

    const seg = segs[Math.min(SEGMENTS - 1, Math.floor((k.t / durationMs) * SEGMENTS)) || 0];
    seg.all++;
    if (k.correct) seg.ok++;
  });

  const wordStats = {};
  words.slice(0, wordIndex + 1).forEach(({ target, typed }, i) => {
    counts.allChars += typed.length;
    if (i === wordIndex) {
      if (typed && target.startsWith(typed)) counts.correctWordChars += typed.length;
      return;
    }
    if (typed === target) counts.correctWordChars += target.length + 1;
    const name = normalizeWord(target);
    if (!name) return;
    const stat = (wordStats[name] ??= { n: 0, err: 0, ms: 0 });
    stat.n++;
    stat.err += perWord[i]?.err ?? 0;
    stat.ms += perWord[i]?.ms ?? 0;
  });

  const segmentMinutes = durationMs / SEGMENTS / 60000;
  return {
    v: 1,
    date,
    settings,
    durationMs,
    counts,
    ...computeScores(counts, durationMs),
    keys,
    pairs,
    words: wordStats,
    segments: segs.map(({ ok, all }) => ({
      wpm: segmentMinutes > 0 ? ok / 5 / segmentMinutes : 0,
      accuracy: all ? (ok / all) * 100 : null,
    })),
  };
}
