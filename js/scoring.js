const ratio = (a, b) => (b > 0 ? a / b : 0);

// monkeytype rules: wpm counts only characters of fully correct words
export function computeScores({ correctWordChars, allChars, correctKeys, wrongKeys }, durationMs) {
  const minutes = durationMs / 60000;
  return {
    wpm: ratio(correctWordChars / 5, minutes),
    rawWpm: ratio(allChars / 5, minutes),
    accuracy: ratio(correctKeys, correctKeys + wrongKeys) * 100,
  };
}
