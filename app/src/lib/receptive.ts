// Reading practice: the levels, what goes into a session, how it is scored, and
// the learner's own mix-ups. No UI and no content loading here; pages pass in
// what there is to read (see readingMaterial in fingerspell.ts).
import { letterStats, wordWeight } from './spelling';
import type { LevelProgress, SpellingAttempt, WordGroup } from './types';

export const SESSION_SIZE = 10;
/** Right answers needed, out of SESSION_SIZE, to pass a level. */
export const PASS = 8;

export type DrillKind = 'letter' | 'word' | 'number';
export type Track = 'letters' | 'words' | 'numbers';

export interface Level {
  id: string;
  track: Track;
  title: string;
  /** One line on what you do. */
  blurb: string;
  kind: DrillKind;
  /** Pick from four choices, or type the answer. */
  answer: 'choice' | 'type';
  /** Things spelled out (words, digit strings): letters per second. */
  speed?: number;
  /** One thing shown (a letter, a number): how long it stays up, in ms. 0 keeps it up. */
  flashMs?: number;
}

export const TRACKS: { id: Track; title: string; blurb: string }[] = [
  { id: 'letters', title: 'Letters', blurb: 'Know each handshape at a glance, and tell the look-alikes apart.' },
  { id: 'words', title: 'Words', blurb: 'Read whole words, from two letters up to names at speed.' },
  { id: 'numbers', title: 'Numbers', blurb: 'Read numbers and strings of digits.' },
];

export const MIXUPS_LEVEL = 'letters-3';

export const LEVELS: Level[] = [
  { id: 'letters-1', track: 'letters', title: 'Letters', kind: 'letter', answer: 'choice', flashMs: 0,
    blurb: 'See one letter and pick it from four.' },
  { id: 'letters-2', track: 'letters', title: 'Look-alikes', kind: 'letter', answer: 'choice', flashMs: 700,
    blurb: 'A letter flashes by. Pick it from the letters it gets mistaken for.' },
  { id: MIXUPS_LEVEL, track: 'letters', title: 'Your mix-ups', kind: 'letter', answer: 'choice', flashMs: 500,
    blurb: 'The letters you have been mixing up, flashed faster.' },
  { id: 'words-1', track: 'words', title: 'Short words', kind: 'word', answer: 'type', speed: 1.5,
    blurb: 'Two and three letters, at an easy pace.' },
  { id: 'words-2', track: 'words', title: 'Four letters', kind: 'word', answer: 'type', speed: 2,
    blurb: 'Four-letter words, a little faster.' },
  { id: 'words-3', track: 'words', title: 'Five letters', kind: 'word', answer: 'type', speed: 2.5,
    blurb: 'Five-letter words. Watch the shape of the whole word.' },
  { id: 'words-4', track: 'words', title: 'Names and places', kind: 'word', answer: 'type', speed: 3,
    blurb: 'You are told what kind of word is coming, as you would be in a conversation.' },
  { id: 'words-5', track: 'words', title: 'Up to speed', kind: 'word', answer: 'type', speed: 4,
    blurb: 'Any word, at four letters a second.' },
  { id: 'numbers-1', track: 'numbers', title: 'Numbers 0 to 10', kind: 'number', answer: 'choice', flashMs: 0,
    blurb: 'See one number and pick it from four.' },
  { id: 'numbers-2', track: 'numbers', title: 'Digit strings', kind: 'number', answer: 'type', speed: 1.5,
    blurb: 'Three digits, then four, then a phone number.' },
];

export const levelById = (id: string | undefined): Level | undefined => LEVELS.find((l) => l.id === id);

/** One thing to read in a session. */
export interface SessionItem {
  kind: DrillKind;
  /** The right answer, upper case: "A", "CAT", "10", "5551234". */
  answer: string;
  /**
   * What to show, in order, as content item ids ("c", "a", "t"). A list of ids
   * rather than letters, so a whole sign fits here later without a new shape.
   */
  show: string[];
  /** Said before it is shown, e.g. "a name". */
  hint?: string;
  /** For choice levels: the answer and three others, shuffled. */
  choices?: string[];
}

/** What there is to read, taken from the content. Letters and words are upper case. */
export interface Material {
  /** Letters that can be shown. */
  letters: string[];
  /** Numbers that can be shown: "0" to "10". */
  numbers: string[];
  /** Look-alikes of the same kind, from the content's confusable_with. */
  lookAlikes: Map<string, string[]>;
  /** Built-in words whose letters can all be shown. */
  words: string[];
  groups: WordGroup[];
  hints: Map<string, string>;
}

// ---- Mix-ups ----

/** How often each thing shown was answered as something else: shown → answered → times. */
export type Confusions = Map<string, Map<string, number>>;

/**
 * Counts mix-ups from reading attempts. A letter or number picked wrongly is a
 * mix-up outright. In a typed word or digit string of the right length, each
 * position that differs is one (typing BAT for CAT reads C as B); answers of
 * another length can't be lined up, so they are skipped.
 */
export function confusions(attempts: SpellingAttempt[], kind: 'letter' | 'number' = 'letter'): Confusions {
  const out: Confusions = new Map();
  const add = (shown: string, answered: string) => {
    if (!shown || !answered || shown === answered) return;
    const row = out.get(shown) ?? new Map<string, number>();
    row.set(answered, (row.get(answered) ?? 0) + 1);
    out.set(shown, row);
  };
  for (const a of attempts) {
    if (a.mode !== 'receptive' || a.correct) continue;
    const drill = a.drill ?? 'word';
    const typed = (a.typed ?? '').toUpperCase();
    const shown = a.word.toUpperCase();
    if (kind === 'number' ? drill !== 'number' : drill === 'number') continue;
    // "10" is one number, not two digits.
    if (drill !== 'word' && !/^\d{3,}$/.test(shown)) add(shown, typed);
    else if (typed.length === shown.length) for (let i = 0; i < shown.length; i++) add(shown[i], typed[i]);
  }
  return out;
}

export interface MixUp {
  shown: string;
  answered: string;
  count: number;
}

/** The commonest mix-ups, most frequent first. */
export function topMixUps(c: Confusions, limit = 5): MixUp[] {
  const all: MixUp[] = [];
  for (const [shown, row] of c) for (const [answered, count] of row) all.push({ shown, answered, count });
  return all
    .sort((a, b) => b.count - a.count || a.shown.localeCompare(b.shown) || a.answered.localeCompare(b.answered))
    .slice(0, limit);
}

/** Fewest different letters mixed up before the mix-ups level has enough to drill. */
export const MIXUPS_NEEDED = 2;

// ---- Building a session ----

type Random = () => number;

function shuffle<T>(xs: T[], random: Random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Up to n different items, likelier the heavier they are. */
function sample<T>(items: T[], n: number, weight: (x: T) => number, random: Random): T[] {
  const pool = items.map((x) => ({ x, w: Math.max(weight(x), 0.0001) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    let r = random() * pool.reduce((s, p) => s + p.w, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) >= 0) i++;
    out.push(pool.splice(i, 1)[0].x);
  }
  return out;
}

/**
 * Four choices for something shown: the answer and three others it could be
 * taken for. The learner's own mix-ups come first, then the known look-alikes,
 * then anything else of the same kind.
 */
export function choicesFor(
  answer: string,
  all: string[],
  lookAlikes: string[] = [],
  mixUps: Map<string, number> | undefined = undefined,
  random: Random = Math.random,
): string[] {
  const mine = [...(mixUps ?? [])].sort((a, b) => b[1] - a[1]).map(([x]) => x);
  const ordered = [...mine, ...shuffle(lookAlikes, random), ...shuffle(all, random)];
  const others: string[] = [];
  for (const x of ordered) {
    if (x !== answer && all.includes(x) && !others.includes(x)) others.push(x);
    if (others.length === 3) break;
  }
  return shuffle([answer, ...others], random);
}

/** A string of digits. Never starts with 0, so it reads as a number. */
export function digitString(length: number, random: Random = Math.random): string {
  let s = String(1 + Math.floor(random() * 9));
  while (s.length < length) s += String(Math.floor(random() * 10));
  return s;
}

/** Digits in each item of the digit-strings level: three, then four, then a phone number. */
export const DIGIT_LENGTHS = [3, 3, 3, 3, 4, 4, 4, 4, 7, 7];

/** The built-in words a word level draws from. */
export function levelWords(level: Level, m: Material): string[] {
  const named = new Set(m.groups.filter((g) => g.id === 'names' || g.id === 'places').flatMap((g) => g.words));
  switch (level.id) {
    case 'words-1': return m.words.filter((w) => w.length <= 3);
    case 'words-2': return m.words.filter((w) => w.length === 4);
    case 'words-3': return m.words.filter((w) => w.length === 5);
    case 'words-4': return m.words.filter((w) => named.has(w) && w.length >= 4);
    default: return m.words.filter((w) => w.length >= 3);
  }
}

const single = (kind: DrillKind, answer: string, choices: string[]): SessionItem => ({
  kind, answer, show: [answer.toLowerCase()], choices,
});

/**
 * Ten things to read for a level. Words and letters the learner misses come up
 * more often. Returns fewer (or none) only when the content can't fill it.
 */
export function buildSession(
  level: Level,
  m: Material,
  attempts: SpellingAttempt[] = [],
  random: Random = Math.random,
  size = SESSION_SIZE,
): SessionItem[] {
  const stats = letterStats(attempts);
  const missRate = (l: string) => stats.get(l)?.rate ?? 0;

  if (level.kind === 'word') {
    return sample(levelWords(level, m), size, (w) => wordWeight(w, stats), random).map((w) => ({
      kind: 'word',
      answer: w,
      show: w.toLowerCase().split(''),
      hint: level.id === 'words-4' ? m.hints.get(w) : undefined,
    }));
  }

  if (level.kind === 'number') {
    if (level.answer === 'type') {
      const seen = new Set<string>();
      return DIGIT_LENGTHS.slice(0, size).map((n) => {
        let s = digitString(n, random);
        // No string twice in one session.
        for (let tries = 0; seen.has(s) && tries < 20; tries++) s = digitString(n, random);
        seen.add(s);
        return { kind: 'number', answer: s, show: s.split('') };
      });
    }
    const mixed = confusions(attempts, 'number');
    return sample(m.numbers, size, () => 1, random).map((n) =>
      single('number', n, choicesFor(n, m.numbers, m.lookAlikes.get(n), mixed.get(n), random)),
    );
  }

  const mixed = confusions(attempts);
  const item = (l: string) => single('letter', l, choicesFor(l, m.letters, m.lookAlikes.get(l), mixed.get(l), random));

  if (level.id === MIXUPS_LEVEL) {
    // Both letters of each mix-up, the commonest first, round and round until the session is full.
    const pairs = topMixUps(mixed, 12).filter((p) => m.letters.includes(p.shown) && m.letters.includes(p.answered));
    const letters = [...new Set(pairs.flatMap((p) => [p.shown, p.answered]))];
    if (!letters.length) return [];
    const out: string[] = [];
    while (out.length < size) {
      // No letter twice in a row where there is a choice.
      const round = shuffle(letters, random);
      if (round.length > 1 && round[0] === out[out.length - 1]) round.push(round.shift()!);
      out.push(...round);
    }
    return out.slice(0, size).map(item);
  }

  const pool = level.id === 'letters-2' ? m.letters.filter((l) => m.lookAlikes.get(l)?.length) : m.letters;
  return sample(pool, size, (l) => 1 + 4 * missRate(l), random).map(item);
}

// ---- Scoring ----

export interface Answer {
  item: SessionItem;
  /** What the learner answered, upper case. */
  given: string;
  correct: boolean;
  replays: number;
}

export function isRight(item: SessionItem, given: string): boolean {
  return normalise(item, given) === item.answer;
}

/** Tidies a typed answer: letters only for words, digits only for numbers. */
export function normalise(item: Pick<SessionItem, 'kind'>, given: string): string {
  return item.kind === 'number' ? given.replace(/\D/g, '') : given.toUpperCase().replace(/[^A-Z]/g, '');
}

export interface SessionScore {
  correct: number;
  total: number;
  /** Right first time, with no replay. */
  clean: number;
  passed: boolean;
  missed: SessionItem[];
  /** Letters or digits answered wrongly, most often first. */
  missedChars: string[];
}

/** For each thing shown in an item, whether the answer had it right in that place. */
export function compare(item: SessionItem, given: string): { shown: string; ok: boolean }[] {
  const g = normalise(item, given);
  if (item.show.length === 1) return [{ shown: item.answer, ok: g === item.answer }];
  return item.answer.split('').map((c, i) => ({ shown: c, ok: g[i] === c }));
}

export function scoreSession(answers: Answer[], total = SESSION_SIZE): SessionScore {
  const correct = answers.filter((a) => a.correct).length;
  const counts = new Map<string, number>();
  for (const a of answers) {
    if (a.correct) continue;
    for (const c of compare(a.item, a.given)) if (!c.ok) counts.set(c.shown, (counts.get(c.shown) ?? 0) + 1);
  }
  return {
    correct,
    total,
    clean: answers.filter((a) => a.correct && a.replays === 0).length,
    // A shorter run (practising the ones missed) passes on the same share.
    passed: correct >= Math.ceil((PASS / SESSION_SIZE) * total),
    missed: answers.filter((a) => !a.correct).map((a) => a.item),
    missedChars: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c),
  };
}

// ---- Progress ----

export type Progress = Record<string, LevelProgress>;
export type LevelState = 'locked' | 'open' | 'passed';

/** Adds one played session to a level's record. */
export function recordResult(progress: Progress, levelId: string, correct: number, now = new Date()): Progress {
  const prev = progress[levelId] ?? { best: 0, plays: 0 };
  return {
    ...progress,
    [levelId]: {
      best: Math.max(prev.best, correct),
      plays: prev.plays + 1,
      passedAt: prev.passedAt ?? (correct >= PASS ? now.toISOString() : undefined),
    },
  };
}

/**
 * Whether a level can be played. The first level of each track is open, and
 * passing one opens the next. The mix-ups level is different: it opens as soon
 * as there are mix-ups to drill, whatever else has been passed.
 */
export function levelState(level: Level, progress: Progress, mixUpLetters = 0): LevelState {
  if (progress[level.id]?.passedAt) return 'passed';
  if (level.id === MIXUPS_LEVEL) return mixUpLetters >= MIXUPS_NEEDED ? 'open' : 'locked';
  const track = LEVELS.filter((l) => l.track === level.track && l.id !== MIXUPS_LEVEL);
  const i = track.indexOf(level);
  return i === 0 || progress[track[i - 1].id]?.passedAt ? 'open' : 'locked';
}

/** Why a locked level is locked, for the level card. */
export function lockedReason(level: Level): string {
  if (level.id === MIXUPS_LEVEL) return 'Fills in as you play: it needs a couple of letters you have mixed up.';
  const track = LEVELS.filter((l) => l.track === level.track && l.id !== MIXUPS_LEVEL);
  const before = track[track.indexOf(level) - 1];
  return before ? `Pass “${before.title}” first.` : '';
}

/** How many different letters appear in the learner's mix-ups. */
export function mixUpLetterCount(c: Confusions): number {
  const letters = new Set<string>();
  for (const [shown, row] of c) {
    letters.add(shown);
    for (const answered of row.keys()) letters.add(answered);
  }
  return letters.size;
}

/** The level to suggest next: the first open one not yet passed, track by track. */
export function nextLevel(progress: Progress, mixUpLetters = 0): Level | undefined {
  return LEVELS.find((l) => l.id !== MIXUPS_LEVEL && levelState(l, progress, mixUpLetters) === 'open');
}

export function passedCount(progress: Progress): number {
  return LEVELS.filter((l) => progress[l.id]?.passedAt).length;
}
