import { describe, expect, it } from 'vitest';
import {
  buildSequence, checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, pickWord,
  readingSpeed, sequenceDuration, sortWords, spellableWords, spellingSummary,
} from '../app/src/lib/spelling';
import type { SpellingAttempt } from '../app/src/lib/types';

const attempt = (word: string, correct: boolean, typed: string, lps = 2, replays = 0, at = new Date()): SpellingAttempt => ({
  word, mode: 'receptive', correct, typed, lettersPerSecond: lps, replays, at,
});

describe('buildSequence', () => {
  it('gives each letter an equal slot', () => {
    const f = buildSequence('cat', 2);
    expect(f.map((x) => x.letter)).toEqual(['C', 'A', 'T']);
    expect(f.map((x) => x.startMs)).toEqual([0, 500, 1000]);
    expect(sequenceDuration(f)).toBe(1500);
  });

  it('marks and separates doubled letters', () => {
    const f = buildSequence('ZOO', 1);
    expect(f[1].durationMs).toBeLessThan(1000);
    expect(f[2].repeat).toBe(true);
    expect(f[1].repeat).toBe(false);
  });
});

describe('nextSpeed', () => {
  it('speeds up after a clean read and slows after a miss', () => {
    expect(nextSpeed(2, true, 0)).toBeCloseTo(2.2);
    expect(nextSpeed(2, false, 0)).toBeCloseTo(1.7);
    expect(nextSpeed(2, true, 1)).toBe(2);
  });
  it('stays within bounds', () => {
    expect(nextSpeed(MAX_SPEED, true, 0)).toBe(MAX_SPEED);
    expect(nextSpeed(MIN_SPEED, false, 0)).toBe(MIN_SPEED);
  });
});

describe('words', () => {
  it('compares letters only', () => {
    expect(checkWord('JAZZ', 'jazz ')).toBe(true);
    expect(checkWord('JAZZ', 'jaz')).toBe(false);
  });
  it('converts letters per second to words per minute', () => {
    expect(lettersPerSecondToWpm(2.5)).toBe(30);
  });
  it('filters to words the available letters can spell', () => {
    expect(spellableWords(['CAT', 'DOG', 'TAC'], new Set(['C', 'A', 'T']))).toEqual(['CAT', 'TAC']);
  });
});

describe('letterStats', () => {
  it('counts misses at the positions that differ', () => {
    const s = letterStats([attempt('CAT', false, 'COT'), attempt('CAT', true, 'CAT')]);
    expect(s.get('A')).toEqual({ seen: 2, missed: 1, rate: 0.5 });
    expect(s.get('C')!.missed).toBe(0);
  });
});

describe('pickWord', () => {
  it('favours words with weak letters', () => {
    const stats = letterStats([attempt('Q', false, 'P'), attempt('Q', false, 'P')]);
    let quiz = 0;
    let i = 0;
    const rng = () => ((i++ * 0.6180339887) % 1);
    for (let n = 0; n < 1000; n++) if (pickWord(['QUIZ', 'CAT'], stats, [], rng) === 'QUIZ') quiz++;
    expect(quiz).toBeGreaterThan(600);
  });
  it('avoids recently shown words when it can', () => {
    expect(pickWord(['CAT', 'DOG'], new Map(), ['CAT'], () => 0)).toBe('DOG');
    expect(pickWord(['CAT'], new Map(), ['CAT'], () => 0)).toBe('CAT');
  });
});

describe('readingSpeed', () => {
  it('takes the median of clean correct reads', () => {
    const t = (n: number) => new Date(2026, 0, 1, 0, n);
    const xs = [
      attempt('A', true, 'A', 1, 0, t(1)),
      attempt('A', true, 'A', 3, 0, t(2)),
      attempt('A', true, 'A', 2, 0, t(3)),
      attempt('A', false, 'B', 9, 0, t(4)),
      attempt('A', true, 'A', 9, 2, t(5)),
    ];
    expect(readingSpeed(xs)).toBe(2);
    expect(readingSpeed([])).toBeUndefined();
  });
});

describe('sortWords: added words', () => {
  it('splits on anything that is not a letter and uppercases', () => {
    expect(sortWords('cat, dog\nMom  pie;tea').added).toEqual(['CAT', 'DOG', 'MOM', 'PIE', 'TEA']);
  });
  it('drops duplicates, existing words and over-long words', () => {
    expect(sortWords('cat Cat dog', ['DOG']).added).toEqual(['CAT']);
    expect(sortWords('a'.repeat(21) + ' ok').added).toEqual(['OK']);
  });
  it('returns nothing for blank or symbol-only input', () => {
    expect(sortWords('  , 123 !! ').added).toEqual([]);
  });
});

describe('sortWords', () => {
  it('keeps apostrophes and hyphens inside one word', () => {
    expect(sortWords("O'Neil, x-ray").added).toEqual(['ONEIL', 'XRAY']);
  });
  it('says why typed pieces were skipped', () => {
    const s = sortWords('cat cat dog 42 ' + 'b'.repeat(25), ['DOG']);
    expect(s.added).toEqual(['CAT']);
    expect(s.duplicates).toEqual(['CAT', 'DOG']);
    expect(s.invalid).toEqual(['42']);
    expect(s.tooLong).toEqual(['B'.repeat(25)]);
  });
});

describe('spellingSummary', () => {
  const spelled = (correct: boolean, lps: number): SpellingAttempt => ({
    word: 'CAT', mode: 'expressive', correct, lettersPerSecond: lps, replays: 0, at: new Date(),
  });

  it('is empty with no attempts', () => {
    const s = spellingSummary([]);
    expect(s).toMatchObject({ total: 0, read: { count: 0 }, spell: { count: 0 }, weakLetters: [] });
    expect(s.read.wpm).toBeUndefined();
    expect(s.spell.clean).toBeUndefined();
  });

  it('splits reading from spelling', () => {
    const s = spellingSummary([
      attempt('CAT', true, 'CAT', 2),
      attempt('DOG', false, 'DIG', 2),
      spelled(true, 3),
      spelled(true, 1),
      spelled(false, 9),
    ]);
    expect(s.total).toBe(5);
    expect(s.read).toMatchObject({ count: 2, accuracy: 50, wpm: 24 });
    // Only clean spellings count towards signing speed.
    expect(s.spell).toMatchObject({ count: 3, clean: 67, lettersPerSecond: 2 });
  });

  it('names the letters misread most', () => {
    const misses = Array.from({ length: 3 }, () => attempt('BOX', false, 'BOS'));
    expect(spellingSummary(misses).weakLetters.map(([l]) => l)).toEqual(['X']);
  });
});
