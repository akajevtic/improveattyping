// Maps a keydown event to what the test should do with it, or null to leave it to the browser.
export function keyAction(e, focusInTest) {
  if (!focusInTest || e.metaKey || e.isComposing) return null;
  // Ctrl or Alt alone is a shortcut (Ctrl+R must reload). Both together is AltGr, which types characters on many layouts.
  if (e.ctrlKey !== e.altKey) return null;
  if (e.key === 'Tab') return e.shiftKey ? null : { type: 'restart' }; // Shift+Tab stays as keyboard navigation
  if (e.key === 'Backspace') return { type: 'backspace' };
  if (e.key.length === 1) return { type: 'char', ch: e.key };
  return null;
}
