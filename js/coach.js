import { analyze } from './analysis.js';
import { sumKeys } from './store.js';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best, default)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (cheapest)' },
];
// Pinned on purpose: this code can see the user's API key, so never load "latest".
export const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk@1.8.0';
export const COACH_MIN_TESTS = 3;
const RECENT_TESTS = 40;
const MIN_KEY_SAMPLES = 20;

export const COACH_SYSTEM = `You are a typing coach. The user message is a JSON summary of one person's whole typing-test history from an app called Weak Keys: recent tests, per-key miss rates early versus late in their history, most common wrong-key confusions, slowest letter pairs, and the words they miss most. Segment arrays split each test into four equal time slices.

Write coaching for that person. Rules:
- Every claim must cite their own data: name the key, pair or word and give the number.
- Say what is improving, what is stuck, and what is getting worse, comparing early and late rates.
- Look for behavior patterns across tests, such as accuracy or speed falling in later slices, or punctuation tests hurting specific keys. Mention a pattern only if the data shows it.
- Where a confusion suggests a physical cause, such as a neighbouring key or a weak finger, say so briefly.
- Finish with a plan for the next week: at most three drills, each with what to practice, for how long, and a target number.
- If the history is too small to support a point, say that instead of guessing.
- No generic advice. No praise without a number behind it.
- Plain text, no markdown, under 250 words. Use short paragraphs and a short numbered plan.`;

const round1 = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
const day = (iso) => iso.slice(0, 10);
const keyName = (key) => (key === ' ' ? 'space' : key);
const missRate = (k) => (k?.n ? round1((k.miss / k.n) * 100) : null);

function topConfusion(as = {}) {
  const [top] = Object.entries(as).sort((a, b) => b[1] - a[1]);
  return top ? keyName(top[0]) : null;
}

// Compact picture of the whole history. Summaries only: the raw keystrokes were never stored.
export function buildCoachPayload(tests, agg) {
  const all = sumKeys(tests);
  const half = Math.floor(tests.length / 2);
  const early = sumKeys(tests.slice(0, half));
  const late = sumKeys(tests.slice(half));
  const { confusions, slowPairs, weakWords } = analyze({ keys: all, ...agg });

  return {
    totalTests: tests.length,
    firstDate: tests.length ? day(tests[0].date) : null,
    lastDate: tests.length ? day(tests.at(-1).date) : null,
    recent: tests.slice(-RECENT_TESTS).map((t) => ({
      date: day(t.date),
      seconds: t.settings?.seconds,
      punctuation: Boolean(t.settings?.punctuation),
      weak: Boolean(t.settings?.weak),
      wpm: round1(t.wpm),
      rawWpm: round1(t.rawWpm),
      accuracy: round1(t.accuracy),
      segAccuracy: (t.segments ?? []).map((s) => round1(s.accuracy)),
      segWpm: (t.segments ?? []).map((s) => round1(s.wpm)),
    })),
    keys: Object.entries(all)
      .filter(([, k]) => k.n >= MIN_KEY_SAMPLES)
      .map(([key, k]) => ({
        key: keyName(key),
        n: k.n,
        missRate: missRate(k),
        earlyMissRate: missRate(early[key]),
        lateMissRate: missRate(late[key]),
        topConfusion: topConfusion(k.as),
      }))
      .sort((a, b) => b.missRate - a.missRate)
      .slice(0, 40),
    confusions: confusions.map((c) => ({ expected: keyName(c.expected), typed: keyName(c.typed), count: c.count })),
    slowPairs: slowPairs.map((p) => ({ pair: p.pair, avgMs: round1(p.avg), timesSlowerThanUsual: round1(p.ratio) })),
    weakWords: weakWords.map((w) => ({ word: w.word, n: w.n, err: w.err, cleanStreak: agg.words[w.word]?.ok ?? 0 })),
  };
}

// Most specific class first. `Anthropic` is the SDK's default export, which carries its error classes.
export function coachErrorMessage(err, Anthropic) {
  if (err instanceof Anthropic.AuthenticationError) return 'That API key was not accepted. Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'This key is not allowed to use that model. Pick another model in Settings.';
  if (err instanceof Anthropic.RateLimitError) return 'Rate limit reached. Wait a minute and try again.';
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach Claude. Check your internet connection.';
  if (err instanceof Anthropic.APIError) return `Claude returned an error (${err.status}). Try again later.`;
  return 'Something went wrong asking the coach. Try again.';
}

// Calls Claude with the user's own key. Rejects with an Error whose message can be shown as is.
export async function askCoach({ apiKey, model, payload, onText, loadSdk = () => import(SDK_URL) }) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await loadSdk());
  } catch {
    throw new Error('Could not load the coach. Check your internet connection.');
  }

  let message;
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      system: COACH_SYSTEM,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      // If the model declines, the API retries on a fallback model in the same call. Haiku 5.5 has no such fallback.
      ...(model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') onText(event.delta.text);
    }
    message = await stream.finalMessage();
  } catch (err) {
    throw new Error(coachErrorMessage(err, Anthropic));
  }

  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined to answer. Try again or pick another model in Settings.');
  }
  return message.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
}
