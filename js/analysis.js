const MIN_KEY_SAMPLES = 3;
const MIN_PAIR_SAMPLES = 2;
const SLOW_RATIO = 1.2;

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Works on one test summary or on the aggregate of all history: both carry keys, pairs, words.
export function analyze({ keys = {}, pairs = {}, words = {} }) {
  const weakKeys = Object.entries(keys)
    .filter(([key, k]) => key !== ' ' && k.n >= MIN_KEY_SAMPLES && k.miss > 0)
    .map(([key, { n, miss }]) => ({ key, n, miss, rate: miss / n }))
    .sort((a, b) => b.rate - a.rate || b.miss - a.miss)
    .slice(0, 8);

  const confusions = Object.entries(keys)
    .flatMap(([expected, k]) => Object.entries(k.as ?? {}).map(([typed, count]) => ({ expected, typed, count })))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const timed = Object.entries(pairs)
    .filter(([, p]) => p.n >= MIN_PAIR_SAMPLES)
    .map(([pair, { n, ms }]) => ({ pair, avg: ms / n }));
  const typical = timed.length ? median(timed.map((p) => p.avg)) : 0;
  const slowPairs = timed
    .map((p) => ({ ...p, ratio: typical > 0 ? p.avg / typical : 0 }))
    .filter((p) => p.ratio >= SLOW_RATIO)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  const weakWords = Object.entries(words)
    .filter(([, w]) => w.err > 0)
    // each clean typing since the last error halves the weight, so fixed words fade out
    .map(([word, { n, err, ok = 0 }]) => ({ word, n, err, score: (err / n) * 0.5 ** ok }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return { weakKeys, confusions, slowPairs, weakWords };
}

export function heatLevel(keys, key) {
  const k = keys[key];
  if (!k || !k.miss) return 0;
  const rate = k.miss / k.n;
  return rate < 0.05 ? 1 : rate < 0.15 ? 2 : 3;
}

// One tip per test, always naming something from the user's own data. First matching rule wins.
export function pickTip(summary) {
  const { confusions, slowPairs, weakKeys } = analyze(summary);
  const first = summary.segments[0]?.accuracy;
  const last = summary.segments.at(-1)?.accuracy;
  const [confusion] = confusions;
  const [slow] = slowPairs;
  const [weak] = weakKeys;

  if (confusion?.count >= 3) {
    const { expected, typed, count } = confusion;
    return `You hit "${typed}" when you want "${expected}" (${count} times). Slow down on words with "${expected}" until it lands clean.`;
  }
  if (first != null && last != null && first - last >= 5) {
    return `Your accuracy fell from ${Math.round(first)}% at the start to ${Math.round(last)}% at the end. You are rushing the finish. Hold one steady pace.`;
  }
  if (summary.accuracy < 92) {
    return `Accuracy was ${Math.round(summary.accuracy)}%. Slow down until you are above 95%. Speed follows accuracy.`;
  }
  if (slow?.ratio >= 1.5) {
    return `"${slow.pair}" takes you ${Math.round(slow.avg)} ms, ${slow.ratio.toFixed(1)}x your usual pace. Drill words with "${slow.pair}".`;
  }
  if (weak) return `Clean run. Your weakest key was "${weak.key}" (${weak.miss} of ${weak.n} missed).`;
  return 'Clean run. Nothing stood out. Try a longer test or turn on punctuation.';
}
