// DOM for the typing area. `container` is #words: it holds .words-inner, which holds the word spans and the caret.

const innerOf = (container) => container.firstElementChild;

function fillWord(el, { target, typed }, finished) {
  const letters = [];
  const length = Math.max(target.length, typed.length);
  for (let i = 0; i < length; i++) {
    const span = document.createElement('span');
    const extra = i >= target.length;
    span.textContent = extra ? typed[i] : target[i];
    if (extra) span.className = 'extra';
    else if (i < typed.length) span.className = typed[i] === target[i] ? 'ok' : 'bad';
    letters.push(span);
  }
  el.replaceChildren(...letters);
  el.classList.toggle('error', finished && typed !== target);
}

// Rebuilds every word. Used on start and when more words are appended.
export function renderWords(container, engine) {
  const inner = innerOf(container);
  const caret = inner.querySelector('.caret');
  const words = engine.words.map((word, i) => {
    const el = document.createElement('span');
    el.className = 'word';
    fillWord(el, word, i < engine.wordIndex);
    return el;
  });
  inner.replaceChildren(...words, caret);
}

// Redraws one word after a keystroke.
export function updateWord(container, engine, index) {
  const el = innerOf(container).children[index];
  if (el) fillWord(el, engine.words[index], index < engine.wordIndex);
}

// Puts the caret before the next expected letter and keeps the current line as the second visible line.
export function moveCaret(container, engine) {
  const inner = innerOf(container);
  const wordEl = inner.children[engine.wordIndex];
  if (!wordEl || !wordEl.classList.contains('word')) return;
  const letter = wordEl.children[engine.words[engine.wordIndex].typed.length];
  const x = letter ? letter.offsetLeft : wordEl.offsetLeft + wordEl.offsetWidth;
  const y = wordEl.offsetTop;
  inner.querySelector('.caret').style.transform = `translate(${x}px, ${y}px)`;
  inner.style.transform = `translateY(${-Math.max(0, y - wordEl.offsetHeight)}px)`;
}

export function setTimer(el, secondsLeft) {
  el.textContent = String(secondsLeft);
}
