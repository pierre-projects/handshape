// Fingerspelling drill logic: playback timing, adaptive speed, weak-letter targeting.
import type { SpellingAttempt } from './types';

export const MIN_SPEED = 0.5;
export const MAX_SPEED = 8;
const SPEED_UP = 1.1;
const SLOW_DOWN = 0.85;
/** Share of a letter's slot left blank before a repeated letter, so doubles read as two. */
const DOUBLE_GAP = 0.25;

export interface Frame {
  letter: string;
  index: number;
  startMs: number;
  durationMs: number;
  /** True for the second of a doubled letter; the UI shifts it sideways, like a signer would. */
  repeat: boolean;
}

/**
 * Splits a word into timed frames at the given letters per second. A list is
 * taken as it is, one frame each, for things that aren't single characters
 * (the number 10).
 */
export function buildSequence(word: string | string[], lettersPerSecond: number): Frame[] {
  const slot = 1000 / lettersPerSecond;
  const letters = Array.isArray(word) ? word : word.toUpperCase().split('');
  const frames: Frame[] = [];
  let t = 0;
  letters.forEach((letter, index) => {
    const repeat = index > 0 && letters[index - 1] === letter;
    const nextRepeats = letters[index + 1] === letter;
    const durationMs = nextRepeats ? slot * (1 - DOUBLE_GAP) : slot;
    frames.push({ letter, index, startMs: t, durationMs, repeat });
    t += slot;
  });
  return frames;
}

export function sequenceDuration(frames: Frame[]): number {
  const last = frames[frames.length - 1];
  return last ? last.startMs + last.durationMs : 0;
}

/**
 * Adaptive speed: a clean read (no replays) speeds up, a miss slows down, and
 * a correct read that needed replays holds steady. This keeps the learner near
 * the edge of what they can read.
 */
export function nextSpeed(current: number, correct: boolean, replays: number): number {
  let next = current;
  if (!correct) next = current * SLOW_DOWN;
  else if (replays === 0) next = current * SPEED_UP;
  return Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, next)) * 100) / 100;
}

/** Words per minute, using the usual five letters per word. */
export function lettersPerSecondToWpm(lps: number): number {
  return Math.round((lps * 60) / 5);
}

export function normalizeWord(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

export const MAX_WORD_LETTERS = 20;

export interface WordSort {
  /** New words to add, in order, normalized to A–Z. */
  added: string[];
  /** Already in the list, or typed twice. */
  duplicates: string[];
  /** Typed pieces with no letters in them, as typed. */
  invalid: string[];
  /** Longer than MAX_WORD_LETTERS, or not the exact length asked for. */
  tooLong: string[];
}

/**
 * Sorts typed text ("cat, dog\nO'Neil") into words for a custom list. Words
 * are separated by spaces, commas or semicolons; anything that isn't a letter
 * is dropped inside a word, so "O'Neil" becomes ONEIL.
 */
export function sortWords(text: string, existing: string[] = [], exact?: number): WordSort {
  const seen = new Set(existing);
  const out: WordSort = { added: [], duplicates: [], invalid: [], tooLong: [] };
  for (const raw of text.split(/[\s,;]+/)) {
    if (!raw) continue;
    const w = normalizeWord(raw);
    if (!w) out.invalid.push(raw);
    else if (exact ? w.length !== exact : w.length > MAX_WORD_LETTERS) out.tooLong.push(w);
    else if (seen.has(w)) out.duplicates.push(w);
    else {
      seen.add(w);
      out.added.push(w);
    }
  }
  return out;
}

export function checkWord(expected: string, typed: string): boolean {
  return normalizeWord(expected) === normalizeWord(typed);
}

export interface LetterStat {
  seen: number;
  missed: number;
  rate: number;
}

/**
 * Per-letter miss rates from receptive attempts. A letter counts as missed
 * when the typed word differs at its position, which is a simple alignment
 * that works well for the short words used here.
 */
export function letterStats(attempts: SpellingAttempt[]): Map<string, LetterStat> {
  const stats = new Map<string, LetterStat>();
  for (const a of attempts) {
    // Single letters picked from choices count too; numbers have no letters.
    if (a.mode !== 'receptive' || a.drill === 'number') continue;
    const expected = normalizeWord(a.word);
    const typed = normalizeWord(a.typed ?? '');
    for (let i = 0; i < expected.length; i++) {
      const letter = expected[i];
      const s = stats.get(letter) ?? { seen: 0, missed: 0, rate: 0 };
      s.seen++;
      if (!a.correct && typed[i] !== letter) s.missed++;
      s.rate = s.missed / s.seen;
      stats.set(letter, s);
    }
  }
  return stats;
}

/** Words whose every letter is in the available set. */
export function spellableWords(words: string[], available: Set<string>): string[] {
  return words.filter((w) => w.split('').every((l) => available.has(l)));
}

/** How much to favor a word: 1 for a word of letters never missed, up to 5 when every letter always is. */
export function wordWeight(word: string, stats: Map<string, LetterStat>): number {
  const letters = new Set(word.split(''));
  let weakness = 0;
  for (const l of letters) weakness += stats.get(l)?.rate ?? 0;
  return 1 + 4 * (weakness / letters.size);
}

/** A whole word read in a drill: not a single letter or a number. */
export function isWordRead(a: SpellingAttempt): boolean {
  return a.mode === 'receptive' && (a.drill ?? 'word') === 'word';
}

/**
 * Picks the next word, favoring words containing letters the learner misses
 * and avoiding the last few words shown.
 */
export function pickWord(
  words: string[],
  stats: Map<string, LetterStat>,
  recent: string[],
  random: () => number = Math.random,
): string | undefined {
  const avoid = new Set(recent.slice(-5));
  const pool = words.filter((w) => !avoid.has(w));
  const candidates = pool.length > 0 ? pool : words;
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((w) => wordWeight(w, stats));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/** Median speed of the most recent correct receptive reads with no replays. */
export function readingSpeed(attempts: SpellingAttempt[], window = 20): number | undefined {
  const speeds = attempts
    .filter((a) => isWordRead(a) && a.correct && a.replays === 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(-window)
    .map((a) => a.lettersPerSecond)
    .sort((a, b) => a - b);
  if (speeds.length === 0) return undefined;
  const mid = Math.floor(speeds.length / 2);
  return speeds.length % 2 ? speeds[mid] : (speeds[mid - 1] + speeds[mid]) / 2;
}

/** Share of the most recent attempts that were right, as a whole percentage. */
function recentPercent(xs: SpellingAttempt[], window = 20): number | undefined {
  if (!xs.length) return undefined;
  const recent = xs.slice(-window);
  return Math.round((recent.filter((a) => a.correct).length / recent.length) * 100);
}

export interface SpellingSummary {
  /** Every fingerspelling attempt, read or spelled. */
  total: number;
  read: { count: number; wpm?: number; accuracy?: number };
  spell: { count: number; lettersPerSecond?: number; clean?: number };
  /** Letters most often misread (seen at least 3 times), worst first. */
  weakLetters: [string, LetterStat][];
}

/** Everything the app shows about fingerspelling progress, worked out in one place. */
export function spellingSummary(attempts: SpellingAttempt[]): SpellingSummary {
  // Words only: letters and numbers picked in the reading levels aren't "words read".
  const read = attempts.filter(isWordRead);
  const spell = attempts.filter((a) => a.mode === 'expressive');
  const clean = spell.filter((a) => a.correct).slice(-10).map((a) => a.lettersPerSecond);
  const reading = readingSpeed(attempts);
  return {
    total: attempts.length,
    read: { count: read.length, wpm: reading ? lettersPerSecondToWpm(reading) : undefined, accuracy: recentPercent(read) },
    spell: {
      count: spell.length,
      lettersPerSecond: clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : undefined,
      clean: recentPercent(spell),
    },
    weakLetters: [...letterStats(attempts).entries()]
      .filter(([, s]) => s.seen >= 3 && s.missed > 0)
      .sort((a, b) => b[1].rate - a[1].rate)
      .slice(0, 5),
  };
}
