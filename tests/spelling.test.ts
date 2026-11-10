import { describe, expect, it } from 'vitest';
import {
  buildSequence, checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, pickWord,
  parseWords, readingSpeed, sequenceDuration, spellableWords,
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

describe('parseWords', () => {
  it('splits on anything that is not a letter and uppercases', () => {
    expect(parseWords('cat, dog\nMom  pie;tea')).toEqual(['CAT', 'DOG', 'MOM', 'PIE', 'TEA']);
  });
  it('drops duplicates, existing words and over-long words', () => {
    expect(parseWords('cat Cat dog', ['DOG'])).toEqual(['CAT']);
    expect(parseWords('a'.repeat(21) + ' ok')).toEqual(['OK']);
  });
  it('returns nothing for blank or symbol-only input', () => {
    expect(parseWords('  , 123 !! ')).toEqual([]);
  });
});
