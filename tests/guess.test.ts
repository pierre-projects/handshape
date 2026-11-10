import { describe, expect, it } from 'vitest';
import { ANSWERS, dailyAnswer, isKnownWord, letterMarks, scoreGuess, WORDS } from '../app/src/lib/guess';
import { classifyLetter, handMotion, LetterReader, READABLE_LETTERS } from '../app/src/lib/engine/reader';
import { computeFeatures } from '../app/src/lib/engine/features';
import { buildHand } from './helpers/synthHand';
import { POSES } from './helpers/poses';

describe('word list', () => {
  it('has only five-letter words and plenty of answers', () => {
    expect(WORDS.every((w) => /^[A-Z]{5}$/.test(w))).toBe(true);
    expect(ANSWERS.length).toBeGreaterThan(300);
    expect(ANSWERS.some((w) => /[JZ]/.test(w))).toBe(false);
  });
  it('knows words in any case', () => {
    expect(isKnownWord('apple')).toBe(true);
    expect(isKnownWord('ABCDE')).toBe(false);
  });
  it('gives the same daily word for the same day', () => {
    expect(dailyAnswer('2026-11-10')).toBe(dailyAnswer('2026-11-10'));
    expect(ANSWERS).toContain(dailyAnswer('2026-11-10'));
  });
});

describe('scoreGuess', () => {
  it('marks hits, nears and misses', () => {
    expect(scoreGuess('CRANE', 'CRATE')).toEqual(['hit', 'hit', 'hit', 'miss', 'hit']);
    expect(scoreGuess('TRACE', 'CRATE')).toEqual(['near', 'hit', 'hit', 'near', 'hit']);
  });
  it('does not over-count repeated letters', () => {
    // One L in the answer: the hit takes it, so the other L is a miss.
    expect(scoreGuess('LLAMA', 'HELLO')).toEqual(['near', 'near', 'miss', 'miss', 'miss']);
    expect(scoreGuess('SPELL', 'LEMON')).toEqual(['miss', 'miss', 'near', 'near', 'miss']);
    expect(scoreGuess('APPLE', 'PAPER')).toEqual(['near', 'near', 'hit', 'miss', 'near']);
  });
  it('keeps the best mark per key', () => {
    const m = letterMarks(['TRACE', 'CRATE'], 'CRATE');
    expect(m.get('C')).toBe('hit');
    expect(m.get('T')).toBe('hit');
  });
});

describe('classifyLetter', () => {
  for (const l of READABLE_LETTERS) {
    it(`reads ${l.toUpperCase()}`, () => {
      expect(classifyLetter(computeFeatures(buildHand(POSES[l])))).toBe(l);
    });
  }
});

describe('LetterReader: no accidental letters', () => {
  /** Feeds one reading per 33 ms frame and returns what was typed. */
  function feed(reader: LetterReader, seq: [string | undefined, number][], t0 = 0) {
    const typed: string[] = [];
    let t = t0;
    for (const [l, ms] of seq) {
      for (let end = t + ms; t < end; t += 33) {
        const s = reader.update(l, t);
        if (s.typed) typed.push(s.typed);
      }
    }
    return typed;
  }

  it('types a letter held steadily', () => {
    expect(feed(new LetterReader(), [['a', 1000]])).toEqual(['a']);
  });
  it('ignores a shape passed through on the way to another', () => {
    expect(feed(new LetterReader(), [['s', 400], ['a', 1200]])).toEqual(['a']);
  });
  it('types one letter for one long hold', () => {
    expect(feed(new LetterReader(), [['a', 5000]])).toEqual(['a']);
  });
  it('types a double letter after a short bounce', () => {
    expect(feed(new LetterReader(), [['l', 1000], [undefined, 400], ['l', 1000]])).toEqual(['l', 'l']);
  });
  it('a one-frame drop during the bounce is not enough to repeat', () => {
    expect(feed(new LetterReader(), [['l', 1000], [undefined, 40], ['l', 2000]])).toEqual(['l']);
  });
  it('forgives a flicker while holding', () => {
    expect(feed(new LetterReader(), [['e', 500], ['s', 66], ['e', 500]])).toEqual(['e']);
  });
  it('types two different letters in a row', () => {
    expect(feed(new LetterReader(), [['c', 1000], ['a', 1300]])).toEqual(['c', 'a']);
  });
});

describe('handMotion', () => {
  it('is zero for a still hand and large for a jump', () => {
    const pts = Array.from({ length: 21 }, (_, i) => ({ x: i / 40, y: i / 40 }));
    expect(handMotion(pts, pts)).toBe(0);
    expect(handMotion(pts, pts.map((p) => ({ x: p.x + 0.2, y: p.y })))).toBeGreaterThan(0.5);
  });
});
