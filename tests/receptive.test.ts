import { describe, expect, it } from 'vitest';
import { content } from '../app/src/lib/content';
import { readingMaterial } from '../app/src/lib/fingerspell';
import {
  buildSession, choicesFor, compare, confusions, DIGIT_LENGTHS, digitString, isRight, LEVELS, levelById, levelState,
  levelWords, lockedReason, MIXUPS_LEVEL, mixUpLetterCount, nextLevel, normalize, PASS, passedCount, recordResult,
  scoreSession, SESSION_SIZE, topMixUps, TRACKS, type Answer, type SessionItem,
} from '../app/src/lib/receptive';
import { readingSpeed, spellingSummary } from '../app/src/lib/spelling';
import type { SpellingAttempt } from '../app/src/lib/types';

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const read = (word: string, typed: string, drill?: SpellingAttempt['drill'], lps = 2): SpellingAttempt => ({
  word, typed, drill, mode: 'receptive', correct: word === typed, lettersPerSecond: lps, replays: 0, at: new Date(),
});
const level = (id: string) => levelById(id)!;
const m = readingMaterial;

describe('levels', () => {
  it('have unique ids, and every track has some', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const t of TRACKS) expect(LEVELS.some((l) => l.track === t.id), t.id).toBe(true);
    expect(levelById('nope')).toBeUndefined();
  });

  it('are either spelled at a speed or shown for a time', () => {
    for (const l of LEVELS) {
      expect(l.speed !== undefined || l.flashMs !== undefined, l.id).toBe(true);
      if (l.answer === 'type') expect(l.speed, l.id).toBeGreaterThan(0);
    }
  });

  it('get faster through the words track', () => {
    const speeds = LEVELS.filter((l) => l.track === 'words').map((l) => l.speed!);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    expect(new Set(speeds).size).toBe(speeds.length);
  });
});

describe('reading material from the content', () => {
  it('has every letter and the numbers 0 to 10', () => {
    expect(m.letters).toHaveLength(26);
    expect([...m.numbers].sort((a, b) => +a - +b)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('keeps look-alikes to the same kind', () => {
    for (const [sign, others] of m.lookAlikes) {
      const pool = m.letters.includes(sign) ? m.letters : m.numbers;
      for (const o of others) expect(pool, `${sign} → ${o}`).toContain(o);
    }
    expect(m.lookAlikes.get('A')).toEqual(expect.arrayContaining(['S', 'T']));
    expect(m.lookAlikes.get('4')).toContain('5');
  });

  it('gives every word level at least 30 words of the right kind', () => {
    for (const l of LEVELS.filter((x) => x.kind === 'word')) {
      expect(levelWords(l, m).length, l.id).toBeGreaterThanOrEqual(30);
    }
    expect(levelWords(level('words-1'), m).every((w) => w.length <= 3)).toBe(true);
    expect(levelWords(level('words-2'), m).every((w) => w.length === 4)).toBe(true);
    expect(levelWords(level('words-3'), m).every((w) => w.length === 5)).toBe(true);
  });

  it('has a hint for every name and place', () => {
    for (const w of levelWords(level('words-4'), m)) expect(['a name', 'a place'], w).toContain(m.hints.get(w));
    expect(content.wordHints.get('PIZZA')).toBe('food or drink');
    expect(content.wordHints.get('CAT')).toBeUndefined();
  });
});

describe('buildSession', () => {
  it('makes ten different things to read for every level that needs no history', () => {
    for (const l of LEVELS.filter((x) => x.id !== MIXUPS_LEVEL)) {
      for (const seed of [1, 2, 3]) {
        const items = buildSession(l, m, [], seeded(seed));
        expect(items, l.id).toHaveLength(SESSION_SIZE);
        expect(new Set(items.map((i) => i.answer)).size, `${l.id} distinct`).toBe(SESSION_SIZE);
        for (const i of items) {
          expect(i.kind).toBe(l.kind);
          expect(i.show.join('').toUpperCase(), `${l.id} shows its answer`).toBe(i.answer);
          for (const id of i.show) expect(content.byId.has(id), `${l.id}: ${id} is a sign`).toBe(true);
        }
      }
    }
  });

  it('gives choice levels the answer once and three other signs of the same kind', () => {
    for (const id of ['letters-1', 'letters-2', 'numbers-1']) {
      for (const item of buildSession(level(id), m, [], seeded(7))) {
        const pool = item.kind === 'letter' ? m.letters : m.numbers;
        expect(item.choices).toHaveLength(4);
        expect(new Set(item.choices).size).toBe(4);
        expect(item.choices!.filter((c) => c === item.answer)).toHaveLength(1);
        for (const c of item.choices!) expect(pool).toContain(c);
      }
    }
  });

  it('gives typed levels no choices, and hints only where the level promises them', () => {
    expect(buildSession(level('words-2'), m, [], seeded()).every((i) => !i.choices && !i.hint)).toBe(true);
    expect(buildSession(level('words-4'), m, [], seeded()).every((i) => !!i.hint)).toBe(true);
  });

  it('only uses letters with look-alikes in the look-alikes level, and offers them', () => {
    for (const item of buildSession(level('letters-2'), m, [], seeded(3))) {
      const alike = m.lookAlikes.get(item.answer)!;
      expect(alike.length, item.answer).toBeGreaterThan(0);
      expect(item.choices!.some((c) => alike.includes(c)), `${item.answer}: ${item.choices}`).toBe(true);
    }
  });

  it('shows 10 as one number, not a 1 and a 0', () => {
    const ten = buildSession(level('numbers-1'), m, [], seeded(), 11).find((i) => i.answer === '10')!;
    expect(ten.show).toEqual(['10']);
  });

  it('builds digit strings of three, four, then seven digits', () => {
    const items = buildSession(level('numbers-2'), m, [], seeded(5));
    expect(items.map((i) => i.answer.length)).toEqual(DIGIT_LENGTHS);
    for (const i of items) {
      expect(i.answer).toMatch(/^[1-9]\d+$/);
      expect(i.show).toEqual(i.answer.split(''));
    }
  });

  it('brings up words with letters the learner misses more often', () => {
    const history = Array.from({ length: 12 }, () => read('QUIZ', 'XXXX'));
    const count = (attempts: SpellingAttempt[]) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        n += buildSession(level('words-2'), m, attempts, seeded(seed)).filter((i) => /[QUIZ]/.test(i.answer)).length;
      }
      return n;
    };
    expect(count(history)).toBeGreaterThan(count([]) * 1.15);
  });

  it('has nothing for the mix-ups level until there are mix-ups', () => {
    expect(buildSession(level(MIXUPS_LEVEL), m, [], seeded())).toEqual([]);
  });

  it('drills both letters of each mix-up, never the same one twice running', () => {
    const history = [read('A', 'S', 'letter'), read('A', 'S', 'letter'), read('M', 'N', 'letter')];
    const items = buildSession(level(MIXUPS_LEVEL), m, history, seeded(9));
    expect(items).toHaveLength(SESSION_SIZE);
    expect(new Set(items.map((i) => i.answer))).toEqual(new Set(['A', 'S', 'M', 'N']));
    items.slice(1).forEach((i, k) => expect(i.answer, `item ${k + 1}`).not.toBe(items[k].answer));
    // The letter it was taken for is always among the choices.
    expect(items.find((i) => i.answer === 'A')!.choices).toContain('S');
  });
});

describe('choicesFor', () => {
  it('puts the learner’s own mix-ups ahead of the usual look-alikes', () => {
    const mine = new Map([['Q', 3], ['Z', 1]]);
    const c = choicesFor('A', m.letters, ['S', 'E', 'T'], mine, seeded(2));
    expect(c).toHaveLength(4);
    expect(c).toEqual(expect.arrayContaining(['A', 'Q', 'Z']));
  });

  it('fills up from anything else when there are few look-alikes', () => {
    const c = choicesFor('B', m.letters, [], undefined, seeded(4));
    expect(new Set(c).size).toBe(4);
    expect(c).toContain('B');
  });

  it('ignores a mix-up that isn’t something that can be shown', () => {
    const c = choicesFor('7', m.numbers, ['6', '8'], new Map([['X', 9]]), seeded());
    expect(c).not.toContain('X');
    expect(c).toEqual(expect.arrayContaining(['7', '6', '8']));
  });
});

describe('digitString', () => {
  it('is digits of the length asked for, not starting with 0', () => {
    const r = seeded(11);
    for (const n of [1, 3, 4, 7]) for (let i = 0; i < 30; i++) expect(digitString(n, r)).toMatch(new RegExp(`^[1-9]\\d{${n - 1}}$`));
  });
});

describe('mix-ups', () => {
  it('counts a wrongly picked letter', () => {
    const c = confusions([read('A', 'S', 'letter'), read('A', 'S', 'letter'), read('A', 'E', 'letter'), read('B', 'B', 'letter')]);
    expect(c.get('A')!.get('S')).toBe(2);
    expect(c.get('A')!.get('E')).toBe(1);
    expect(c.has('B')).toBe(false);
  });

  it('counts each differing place in a typed word of the right length', () => {
    const c = confusions([read('CAT', 'BAT'), read('MOON', 'NOOM', 'word')]);
    expect(c.get('C')!.get('B')).toBe(1);
    expect(c.get('M')!.get('N')).toBe(1);
    expect(c.get('N')!.get('M')).toBe(1);
    expect(c.has('A')).toBe(false);
  });

  it('skips answers of another length, which can’t be lined up', () => {
    expect(confusions([read('CAT', 'CART'), read('CAT', '')]).size).toBe(0);
  });

  it('keeps letters and numbers apart', () => {
    const history = [read('7', '8', 'number'), read('5551234', '5551235', 'number'), read('10', '1', 'number'), read('A', 'S', 'letter')];
    const numbers = confusions(history, 'number');
    expect(numbers.get('7')!.get('8')).toBe(1);
    expect(numbers.get('4')!.get('5')).toBe(1);
    // 10 is one number: picking 1 for it is one mix-up, not a missed digit.
    expect(numbers.get('10')!.get('1')).toBe(1);
    expect(numbers.has('A')).toBe(false);
    expect([...confusions(history).keys()]).toEqual(['A']);
  });

  it('lists the commonest first and counts the letters involved', () => {
    const c = confusions([read('A', 'S', 'letter'), read('A', 'S', 'letter'), read('M', 'N', 'letter')]);
    expect(topMixUps(c)).toEqual([
      { shown: 'A', answered: 'S', count: 2 },
      { shown: 'M', answered: 'N', count: 1 },
    ]);
    expect(topMixUps(c, 1)).toHaveLength(1);
    expect(mixUpLetterCount(c)).toBe(4);
    expect(mixUpLetterCount(new Map())).toBe(0);
  });
});

describe('scoring', () => {
  const word = (answer: string): SessionItem => ({ kind: 'word', answer, show: answer.toLowerCase().split('') });
  const letter = (answer: string): SessionItem => ({ kind: 'letter', answer, show: [answer.toLowerCase()] });
  const ans = (item: SessionItem, given: string, replays = 0): Answer => ({ item, given, correct: isRight(item, given), replays });

  it('tidies typed answers and compares them', () => {
    expect(normalize({ kind: 'word' }, ' c-a t ')).toBe('CAT');
    expect(normalize({ kind: 'number' }, '555-1234')).toBe('5551234');
    expect(isRight(word('CAT'), 'cat')).toBe(true);
    expect(isRight(word('CAT'), 'cot')).toBe(false);
    expect(isRight({ kind: 'number', answer: '10', show: ['10'] }, '10')).toBe(true);
  });

  it('says which letters of a word were read wrongly', () => {
    expect(compare(word('CAT'), 'COT')).toEqual([{ shown: 'C', ok: true }, { shown: 'A', ok: false }, { shown: 'T', ok: true }]);
    expect(compare(word('CAT'), 'CA').map((c) => c.ok)).toEqual([true, true, false]);
    expect(compare(letter('A'), 'S')).toEqual([{ shown: 'A', ok: false }]);
    expect(compare({ kind: 'number', answer: '10', show: ['10'] }, '10')).toEqual([{ shown: '10', ok: true }]);
  });

  it('passes on eight of ten, and counts clean reads and what was missed', () => {
    const right = Array.from({ length: 8 }, (_, i) => ans(word('CAT'), 'CAT', i < 2 ? 1 : 0));
    const s = scoreSession([...right, ans(word('MOON'), 'NOON'), ans(word('MAP'), 'NAP')]);
    expect(s).toMatchObject({ correct: 8, total: 10, clean: 6, passed: true });
    expect(s.missed.map((i) => i.answer)).toEqual(['MOON', 'MAP']);
    expect(s.missedChars).toEqual(['M']);
    expect(scoreSession([...right.slice(1), ans(word('MOON'), 'NOON'), ans(word('MAP'), 'NAP'), ans(letter('A'), 'S')]).passed).toBe(false);
  });

  it('judges a short run of missed ones on the same share', () => {
    const run = [ans(letter('A'), 'A'), ans(letter('S'), 'S'), ans(letter('T'), 'M')];
    expect(scoreSession(run, 3).passed).toBe(false);
    expect(scoreSession(run.slice(0, 2), 2).passed).toBe(true);
  });
});

describe('progress', () => {
  it('opens the first level of each track and locks the rest', () => {
    expect(levelState(level('letters-1'), {})).toBe('open');
    expect(levelState(level('words-1'), {})).toBe('open');
    expect(levelState(level('numbers-1'), {})).toBe('open');
    expect(levelState(level('letters-2'), {})).toBe('locked');
    expect(levelState(level('words-5'), {})).toBe('locked');
    expect(lockedReason(level('words-2'))).toBe('Pass “Short words” first.');
  });

  it('records plays and best score, and passing opens the next level', () => {
    let p = recordResult({}, 'words-1', 6);
    expect(p['words-1']).toEqual({ best: 6, plays: 1, passedAt: undefined });
    expect(levelState(level('words-2'), p)).toBe('locked');
    p = recordResult(p, 'words-1', PASS, new Date('2026-11-10T12:00:00Z'));
    expect(p['words-1']).toEqual({ best: 8, plays: 2, passedAt: '2026-11-10T12:00:00.000Z' });
    expect(levelState(level('words-1'), p)).toBe('passed');
    expect(levelState(level('words-2'), p)).toBe('open');
    // A worse score later takes nothing away.
    p = recordResult(p, 'words-1', 3);
    expect(p['words-1']).toMatchObject({ best: 8, plays: 3, passedAt: '2026-11-10T12:00:00.000Z' });
    expect(passedCount(p)).toBe(1);
  });

  it('opens the mix-ups level when there are mix-ups, whatever else is passed', () => {
    expect(levelState(level(MIXUPS_LEVEL), {})).toBe('locked');
    expect(levelState(level(MIXUPS_LEVEL), {}, 2)).toBe('open');
    expect(lockedReason(level(MIXUPS_LEVEL))).toMatch(/mixed up/);
    // It doesn't hold up the rest of the track, and isn't what "next" points to.
    const p = recordResult({}, 'letters-1', 10);
    expect(levelState(level('letters-2'), p)).toBe('open');
    expect(nextLevel(p, 5)!.id).toBe('letters-2');
  });

  it('suggests the first open level not yet passed, then nothing', () => {
    expect(nextLevel({})!.id).toBe('letters-1');
    let p = {};
    for (const l of LEVELS.filter((x) => x.track === 'letters' && x.id !== MIXUPS_LEVEL)) p = recordResult(p, l.id, 10);
    expect(nextLevel(p)!.id).toBe('words-1');
    for (const l of LEVELS) p = recordResult(p, l.id, 10);
    expect(nextLevel(p)).toBeUndefined();
    expect(passedCount(p)).toBe(LEVELS.length);
  });
});

describe('letters and numbers read in levels', () => {
  const words = [read('CAT', 'CAT', undefined, 2), read('DOG', 'DOG', 'word', 3)];
  const others = [read('A', 'A', 'letter', 0), read('7', '7', 'number', 0), read('5551234', '5551234', 'number', 1.5)];

  it('don’t change the reading speed or the count of words read', () => {
    expect(readingSpeed([...words, ...others])).toBe(readingSpeed(words));
    const s = spellingSummary([...words, ...others]);
    expect(s.read.count).toBe(2);
    expect(s.read.wpm).toBe(spellingSummary(words).read.wpm);
    expect(s.total).toBe(5);
  });

  it('do count toward the letters misread most, numbers aside', () => {
    const missed = [read('A', 'S', 'letter'), read('A', 'S', 'letter'), read('A', 'E', 'letter'), read('7', '8', 'number'), read('7', '8', 'number'), read('7', '8', 'number')];
    expect(spellingSummary(missed).weakLetters.map(([l]) => l)).toEqual(['A']);
  });
});
