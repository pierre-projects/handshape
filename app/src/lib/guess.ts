// "Sign Five": guess a five-letter word in six tries, fingerspelling each guess.
import type { Store } from './db';
import { DEFAULT_SIGN_FIVE, type SignFiveSave } from './types';
import fiveLetter from '../../../content/words/five-letter.json';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'hit' | 'near' | 'miss';

/** Every word the game knows, upper case. The list lives in content/words, checked by `npm run validate`. */
export const WORDS: string[] = fiveLetter.words.map((w) => w.toUpperCase());

/** Answers avoid J and Z, which need movement the camera can't read, so every answer can be signed. */
export const ANSWERS: string[] = WORDS.filter((w) => !/[JZ]/.test(w));

/** Colours a guess like the classic game: hits first, then nears use up the remaining letters. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const marks: Mark[] = Array(g.length).fill('miss');
  const left = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = 'hit';
    else left.set(a[i], (left.get(a[i]) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'hit') continue;
    const n = left.get(g[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(g[i], n - 1);
    }
  }
  return marks;
}

/** Best mark seen so far for each letter, for colouring the keyboard. */
export function letterMarks(guesses: string[], answer: string): Map<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
  const out = new Map<string, Mark>();
  for (const g of guesses) {
    scoreGuess(g, answer).forEach((m, i) => {
      const prev = out.get(g[i]);
      if (!prev || rank[m] > rank[prev]) out.set(g[i], m);
    });
  }
  return out;
}

export function isKnownWord(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}

/** Local calendar date as YYYY-MM-DD, the key for the daily word. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The same word for everyone on a given day. */
export function dailyAnswer(key: string = dayKey()): string {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ANSWERS[(h >>> 0) % ANSWERS.length];
}

export function randomAnswer(avoid?: string, random: () => number = Math.random, from: string[] = ANSWERS): string {
  const pool = from.length > 1 ? from.filter((w) => w !== avoid) : from.length ? from : ANSWERS;
  return pool[Math.floor(random() * pool.length)];
}

/** Where older versions kept Sign Five data, before it moved into the database. */
export const LEGACY_STORAGE_KEY = 'asl-sign-five';

/**
 * Sign Five's saved game and stats. The first time, it moves anything an older
 * version left in localStorage into the database, so exports include it.
 */
export async function loadSignFive(
  store: Pick<Store, 'signFive' | 'saveSignFive'>,
  storage: Pick<Storage, 'getItem' | 'removeItem'> | undefined = globalThis.localStorage,
): Promise<SignFiveSave> {
  const saved = await store.signFive();
  if (saved) return saved;
  let legacy: SignFiveSave | undefined;
  try {
    const raw = storage?.getItem(LEGACY_STORAGE_KEY);
    if (raw) legacy = { ...DEFAULT_SIGN_FIVE, ...JSON.parse(raw) };
  } catch {
    legacy = undefined;
  }
  if (!legacy) return structuredClone(DEFAULT_SIGN_FIVE);
  await store.saveSignFive(legacy);
  try {
    storage?.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return legacy;
}

export type DailyState = 'unplayed' | 'playing' | 'won' | 'lost';

/** How today's daily game stands, for showing on other pages. */
export function dailyStatus(save: SignFiveSave | undefined, key: string = dayKey()): { state: DailyState; guesses: number } {
  const d = save?.daily?.key === key ? save.daily : undefined;
  if (!d?.guesses.length) return { state: 'unplayed', guesses: 0 };
  const won = !!d.answer && d.guesses.includes(d.answer);
  return { state: won ? 'won' : d.guesses.length >= MAX_GUESSES ? 'lost' : 'playing', guesses: d.guesses.length };
}

/** A one-line description of today's game. */
export function describeDaily({ state, guesses }: { state: DailyState; guesses: number }): string {
  return {
    unplayed: "Today's word is waiting",
    playing: `Today's word: ${guesses} of ${MAX_GUESSES} guesses used`,
    won: `Today's word solved in ${guesses}`,
    lost: 'Out of guesses today. Try a practice word',
  }[state];
}

/** Where today's word came from. */
export type DailySource = 'official' | 'local';

/**
 * Today's official Wordle answer, through this app's relay (a Cloudflare Pages
 * Function in production, the Vite proxy in development). Undefined when it
 * can't be reached, e.g. offline or on a host without the relay.
 */
export async function fetchOfficialAnswer(
  key: string = dayKey(),
  fetcher: typeof fetch = fetch,
  base: string = import.meta.env.BASE_URL ?? '/',
): Promise<string | undefined> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetcher(`${base}api/wordle/${key}.json`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return undefined;
    const data = (await res.json()) as { solution?: unknown };
    const word = typeof data.solution === 'string' ? data.solution.toUpperCase() : '';
    return /^[A-Z]{5}$/.test(word) ? word : undefined;
  } catch {
    return undefined;
  }
}

/** Today's word: the official one when reachable, otherwise this app's own pick. */
export async function todaysAnswer(
  key: string = dayKey(),
  fetcher?: typeof fetch,
): Promise<{ word: string; source: DailySource }> {
  const official = await fetchOfficialAnswer(key, fetcher);
  return official ? { word: official, source: 'official' } : { word: dailyAnswer(key), source: 'local' };
}
