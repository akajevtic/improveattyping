# Weak Keys

A typing test in the browser that finds the keys and words you type badly and trains exactly those. It runs entirely on your machine: no account, no server, nothing to install.

**Try it:** <https://weakkeys.netlify.app/>

## Features

- Timed tests on random common words, lowercase or with punctuation and capitals. Pick 15, 30, 60 or 120 seconds, or any custom length.
- After every test: speed, accuracy, a keyboard showing the keys you missed, what you typed instead, your slowest letter pairs, and one specific tip.
- Weak-point mode: practice built from the words you get wrong plus words that share the same tricky letter groups. Unlocks after 3 tests.
- Every attempt counts: if you restart or reload before the timer ends, the mistakes from that attempt still feed your weak keys, weak words and weak-point practice. Speed and accuracy history only ever use finished tests.
- Optional AI coach: Claude or Gemini reads your whole history and tells you what is improving, what is stuck and what to drill next. Uses your own API key.
- Instant reload. Press `Tab` to restart a test. Backspace goes back into a mistyped word, even after the space.
- Export, import and clear your history from Settings.

## Run it locally

The page uses JavaScript modules, so it needs a web server; opening `index.html` straight from disk will not work.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Publish on GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Your page appears at `https://<your-username>.github.io/<repository-name>/`.

There is no build step. What is in the repository is what gets served.

## The AI coach

The coach is optional. Everything else works without it.

- It needs your own API key, from Claude or from Google Gemini. Pick the model in Settings; the key field follows the model's provider, and each provider's key is stored separately.
- **Claude:** key from the [Claude Console](https://platform.claude.com/). Billed per use, roughly 1 to 10 cents per reading depending on the model. It is separate from a Claude subscription: a Pro or Max plan does not include a key.
- **Gemini:** key from [Google AI Studio](https://aistudio.google.com/apikey). Some models have a free tier; Google may use free-tier requests to improve its products.
- It runs only when you press **Ask the coach**.
- The app sends the provider a compact summary of your history (per-key miss rates, slow letter pairs, missed words, recent scores). Raw keystrokes are never stored or sent.
- Your keys are saved only in your browser's local storage and sent only to the provider you picked. They are never included in an exported history file.
- For Claude, the Anthropic SDK is loaded from `esm.sh`, pinned to one version, and only when you first ask the coach. On Opus and Sonnet the request turns on Claude's automatic fallback, so if the model declines to answer, the API retries on another model in the same call.
- For Gemini, the app calls Google's API directly, with no extra library.

**Security note.** Browser storage is shared by every page under the same address. All project pages of one GitHub user live under `username.github.io`, so any other page you host there could read a key saved here. Only save a key on an address where you trust every page.

## Your data

Your typing history stays in your browser. Clearing site data deletes it, so use **Settings → Export history** to keep a backup. Importing a backup replaces the current history.

Each test is stored as a summary (scores, per-key misses, letter-pair times, per-word errors), not as individual keypresses.

Attempts you quit early are kept apart from finished tests: their mistakes are added to the weak-key and weak-word totals, and the last 200 are logged with how long they lasted and the mistake that came right before quitting. The AI coach uses that to tell you whether you have a habit of restarting after errors.

## Credits

Word lists come from [monkeytype](https://github.com/monkeytypegame/monkeytype), which is licensed under GPL-3.0.

## License

GPL-3.0. See [LICENSE](LICENSE).
