const MAX_EXTRAS = 10;
const toWord = (target) => ({ target, typed: '' });

// Typing state machine. Knows nothing about the DOM or the clock: callers pass `now`.
export function createEngine(words) {
  let firstAt = null;
  let lastAt = null;

  const engine = {
    words: words.map(toWord),
    wordIndex: 0,
    keystrokes: [],

    type(ch, now) {
      const word = engine.words[engine.wordIndex];
      if (!word) return;
      const { target, typed } = word;
      const isSpace = ch === ' ';
      if (isSpace && typed === '') return;
      if (!isSpace && typed.length >= target.length + MAX_EXTRAS) return;

      const expected = isSpace
        ? (typed.length >= target.length ? ' ' : target[typed.length])
        : (target[typed.length] ?? null);
      firstAt ??= now;
      engine.keystrokes.push({
        expected,
        typed: ch,
        correct: ch === expected,
        ms: lastAt === null ? 0 : now - lastAt,
        t: now - firstAt,
        wordIndex: engine.wordIndex,
      });
      lastAt = now;

      if (isSpace) engine.wordIndex++;
      else word.typed += ch;
    },

    backspace() {
      const word = engine.words[engine.wordIndex];
      if (!word) return;
      if (word.typed) {
        word.typed = word.typed.slice(0, -1);
        return;
      }
      // At the start of a word: undo the space and return to the previous word, but only if it is wrong (monkeytype's rule).
      const previous = engine.words[engine.wordIndex - 1];
      if (previous && previous.typed !== previous.target) engine.wordIndex--;
    },

    addWords(more) {
      engine.words.push(...more.map(toWord));
    },
  };
  return engine;
}
