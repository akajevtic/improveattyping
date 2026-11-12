import { KEYS, loadSettings, saveSettings, exportData, importData, clearData, loadTests } from './store.js';
import { MODELS } from './coach.js';

const plural = (n) => `${n} test${n === 1 ? '' : 's'}`;

// Wires the settings dialog. onChange({ history }) fires after anything changed; history is true when saved tests changed.
export function initSettings({ storage, onChange }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('settings');
  const keyInput = $('api-key');
  const keyStatus = $('key-status');
  const model = $('model');
  const historyCount = $('history-count');
  const historyStatus = $('history-status');
  const importFile = $('import-file');

  model.replaceChildren(...MODELS.map(({ id, label }) => new Option(label, id)));

  function refresh() {
    const key = storage.getItem(KEYS.apiKey);
    keyStatus.textContent = key ? `Key saved (ends in ….${key.slice(-4)})` : 'No key saved.';
    $('remove-key').disabled = !key;
    const saved = loadSettings(storage).model;
    model.value = MODELS.some((m) => m.id === saved) ? saved : MODELS[0].id;
    const count = loadTests(storage).length;
    historyCount.textContent = `${plural(count)} saved`;
    $('export').disabled = $('clear').disabled = count === 0;
  }

  $('open-settings').addEventListener('click', () => {
    keyInput.value = '';
    historyStatus.textContent = '';
    refresh();
    dialog.showModal();
  });
  $('close-settings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click on the backdrop
  dialog.addEventListener('close', () => document.activeElement?.blur()); // give the keyboard back to the test

  $('save-key').addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) { keyStatus.textContent = 'Paste a key first.'; return; }
    try {
      storage.setItem(KEYS.apiKey, key);
    } catch {
      keyStatus.textContent = 'Could not save the key: storage is full.';
      return;
    }
    keyInput.value = '';
    refresh();
    onChange({ history: false });
  });

  $('remove-key').addEventListener('click', () => {
    storage.removeItem(KEYS.apiKey);
    refresh();
    onChange({ history: false });
  });

  model.addEventListener('change', () => {
    saveSettings({ ...loadSettings(storage), model: model.value }, storage);
    onChange({ history: false });
  });

  $('export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([exportData(storage)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `weak-keys-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    historyStatus.textContent = 'History exported.';
  });

  $('import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const [file] = importFile.files;
    importFile.value = ''; // so choosing the same file again fires change
    if (!file) return;
    const current = loadTests(storage).length;
    if (current && !confirm(`Importing replaces your current history (${plural(current)}). Continue?`)) return;
    try {
      const count = importData(await file.text(), storage);
      historyStatus.textContent = `Imported ${plural(count)}.`;
    } catch (err) {
      historyStatus.textContent = err.message;
      return;
    }
    refresh();
    onChange({ history: true });
  });

  $('clear').addEventListener('click', () => {
    const count = loadTests(storage).length;
    if (!confirm(`Delete all ${count} saved tests? This cannot be undone.`)) return;
    clearData(storage);
    historyStatus.textContent = 'History cleared.';
    refresh();
    onChange({ history: true });
  });
}
