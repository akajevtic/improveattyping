const capitalize = (w) => w[0].toUpperCase() + w.slice(1);

// [chance, decorate]: checked in order, at most one applies per word
const PUNCTUATION = [
  [0.1, (w) => `${w}.`],
  [0.1, (w) => `${w},`],
  [0.02, (w) => `${w}?`],
  [0.02, (w) => `${w}!`],
  [0.01, (w) => `${w};`],
  [0.01, (w) => `${w}:`],
  [0.02, (w) => `"${w}"`],
  [0.01, (w) => `(${w})`],
];

function punctuate(word, rng) {
  let roll = rng();
  for (const [chance, decorate] of PUNCTUATION) {
    if (roll < chance) return decorate(word);
    roll -= chance;
  }
  return word;
}

export function generateWords(list, count, { punctuation = false } = {}, rng = Math.random) {
  const out = [];
  let previous = null;
  let sentenceStart = true;
  while (out.length < count) {
    const raw = list[Math.floor(rng() * list.length)];
    if (raw === previous && list.length > 1) continue;
    previous = raw;
    let word = raw;
    if (punctuation) {
      if (sentenceStart) word = capitalize(word);
      word = punctuate(word, rng);
      sentenceStart = /[.?!]$/.test(word);
    }
    out.push(word);
  }
  return out;
}
