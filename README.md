# Weak Keys

A typing test in the browser that finds the keys and words you type badly and trains exactly those. It runs entirely on your machine: no account, no server, nothing to install.

**Try it:** <https://weakkeys.netlify.app/>

## Features

- Timed tests on random common words, lowercase or with punctuation and capitals. Pick 15, 30, 60 or 120 seconds, or any custom length.
- After every test: speed, accuracy, a keyboard showing the keys you missed, what you typed instead, your slowest letter pairs, and one specific tip.
- Weak-point mode: practice built from the words you get wrong plus words that share the same tricky letter groups. Unlocks after 3 tests.
- Optional AI coach: Claude reads your whole history and tells you what is improving, what is stuck and what to drill next. Uses your own API key.
- Instant reload. Press `Tab` to restart a test.
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

- It needs your own Claude API key from the [Claude Console](https://platform.claude.com/). The API is billed per use and is separate from a Claude subscription: a Pro or Max plan does not include a key.
- A reading costs roughly 1 to 10 cents depending on the model you pick in Settings. It runs only when you press **Ask the coach**.
- The app sends Claude a compact summary of your history (per-key miss rates, slow letter pairs, missed words, recent scores). Raw keystrokes are never stored or sent.
- Your key is saved only in your browser's local storage and sent only to Claude's API. It is never included in an exported history file.
- The Anthropic SDK is loaded from `esm.sh`, pinned to one version, and only when you first ask the coach.
- On Opus and Sonnet the request turns on Claude's automatic fallback, so if the model declines to answer, the API retries on another model in the same call.

**Security note.** Browser storage is shared by every page under the same address. All project pages of one GitHub user live under `username.github.io`, so any other page you host there could read a key saved here. Only save a key on an address where you trust every page.

## Your data

Your typing history stays in your browser. Clearing site data deletes it, so use **Settings → Export history** to keep a backup. Importing a backup replaces the current history.

Each test is stored as a summary (scores, per-key misses, letter-pair times, per-word errors), not as individual keypresses.

## Credits

Word lists come from [monkeytype](https://github.com/monkeytypegame/monkeytype), which is licensed under GPL-3.0.

## License

GPL-3.0. See [LICENSE](LICENSE).
