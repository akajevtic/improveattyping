import { analyze } from './analysis.js';

export const WEAK_UNLOCK_TESTS = 3;

// Word pool for weak-point mode. Repeated entries mean higher odds when the generator samples it.
export function weakPool(data, list, size = 60) {
  const { weakWords, slowPairs, weakKeys } = analyze(data);
  const missed = weakWords.map((w) => w.word);

  // letter groups that mark a word as "similar" to the user's trouble spots
  const units = new Map();
  const add = (unit, weight) => units.set(unit, (units.get(unit) ?? 0) + weight);
  for (const word of missed.slice(0, 10)) {
    for (let i = 0; i + 3 <= word.length; i++) add(word.slice(i, i + 3), 2);
  }
  for (const { pair } of slowPairs) add(pair, 1);
  for (const { key } of weakKeys.slice(0, 3)) add(key, 1);

  const skip = new Set(missed);
  const similar = list
    .filter((word) => !skip.has(word))
    .map((word) => {
      let score = 0;
      for (const [unit, weight] of units) if (word.includes(unit)) score += weight;
      return { word, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score) // stable: ties keep list (frequency) order
    .slice(0, Math.max(0, size - missed.length))
    .map((x) => x.word);

  const pool = [...missed.flatMap((w) => [w, w, w]), ...similar];
  return pool.length ? pool : list.slice(0, size);
}
