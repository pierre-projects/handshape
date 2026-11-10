import { describe, expect, it } from 'vitest';
import {
  ANSWERS, dailyAnswer, dailyStatus, describeDaily, fetchOfficialAnswer, isKnownWord, letterMarks, randomAnswer, scoreGuess, shareText, shareTitle, todaysAnswer, WORDS,
} from '../app/src/lib/guess';
import { sortWords } from '../app/src/lib/spelling';
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

describe('official daily word', () => {
  const reply = (body: unknown, ok = true, type = 'application/json') =>
    (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 502, headers: { 'content-type': type } })) as unknown as typeof fetch;

  it('uses the official answer when the relay returns one', async () => {
    const r = await todaysAnswer('2026-11-10', reply({ solution: 'truce' }));
    expect(r).toEqual({ word: 'TRUCE', source: 'official' });
  });
  it('asks the relay for the right day', async () => {
    let url = '';
    const f = (async (u: string) => {
      url = u;
      return new Response('{"solution":"crane"}', { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    await fetchOfficialAnswer('2026-11-10', f, '/');
    expect(url).toBe('/api/wordle/2026-11-10.json');
  });
  it('falls back to its own word when the relay fails or answers oddly', async () => {
    const own = { word: dailyAnswer('2026-11-10'), source: 'local' };
    expect(await todaysAnswer('2026-11-10', reply({}, false))).toEqual(own);
    expect(await todaysAnswer('2026-11-10', reply({ solution: 'toolong' }))).toEqual(own);
    // A static host answers unknown paths with the app's HTML page.
    expect(await todaysAnswer('2026-11-10', reply('<html>', true, 'text/html'))).toEqual(own);
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    expect(await todaysAnswer('2026-11-10', offline)).toEqual(own);
  });
});

describe('five-letter lists', () => {
  it('only accepts five-letter words', () => {
    const s = sortWords('house, cat, water, elephant, house', ['WATER'], 5);
    expect(s.added).toEqual(['HOUSE']);
    expect(s.tooLong).toEqual(['CAT', 'ELEPHANT']);
    expect(s.duplicates).toEqual(['WATER', 'HOUSE']);
  });
  it('practice picks from your list when given one', () => {
    expect(randomAnswer(undefined, () => 0.5, ['HOUSE', 'MUSIC'])).toBe('MUSIC');
    expect(randomAnswer('HOUSE', () => 0, ['HOUSE'])).toBe('HOUSE');
  });
});

describe('daily status', () => {
  const save = (guesses: string[], answer = 'TRUCE', key = '2026-11-10') => ({
    daily: { key, guesses, answer }, stats: { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] },
  });
  it('reads today only', () => {
    expect(dailyStatus(undefined, '2026-11-10').state).toBe('unplayed');
    expect(dailyStatus(save(['CRANE'], 'TRUCE', '2026-11-09'), '2026-11-10').state).toBe('unplayed');
  });
  it('tells playing, won and lost apart', () => {
    expect(dailyStatus(save(['CRANE']), '2026-11-10')).toEqual({ state: 'playing', guesses: 1 });
    expect(dailyStatus(save(['CRANE', 'TRUCE']), '2026-11-10')).toEqual({ state: 'won', guesses: 2 });
    expect(dailyStatus(save(Array(6).fill('CRANE')), '2026-11-10').state).toBe('lost');
    expect(describeDaily({ state: 'won', guesses: 2 })).toBe("Today's word solved in 2");
  });
});

describe('sharing results', () => {
  it('titles daily and practice games', () => {
    expect(shareTitle(true, '2026-11-10')).toBe('Sign Five Nov 10');
    expect(shareTitle(false)).toBe('Sign Five practice');
  });

  it('shows coloured squares and no letters', () => {
    const text = shareText({ title: 'Sign Five Nov 10', guesses: ['CRANE', 'TRUCE'], answer: 'TRUCE', signed: 7, url: 'https://x.test/#/fingerspelling/sign-five' });
    expect(text).toBe(
      ['Sign Five Nov 10 2/6', '', '🟨🟩⬜⬜🟩', '🟩🟩🟩🟩🟩', '', '🤟 7 of 10 letters fingerspelled', 'https://x.test/#/fingerspelling/sign-five'].join('\n'),
    );
    expect(text).not.toMatch(/CRANE|TRUCE/);
  });

  it('scores a miss as X and leaves out the camera line when nothing was signed', () => {
    const text = shareText({ title: 'Sign Five practice', guesses: Array(6).fill('CRANE'), answer: 'TRUCE' });
    expect(text.split('\n')[0]).toBe('Sign Five practice X/6');
    expect(text).not.toContain('🤟');
  });
});

describe('share card', () => {
  it('names the game under the title', async () => {
    const { cardSubtitle } = await import('../app/src/lib/shareImage');
    expect(cardSubtitle('Sign Five Nov 10')).toBe('Daily word · Nov 10');
    expect(cardSubtitle('Sign Five practice')).toBe('Practice word');
  });
});
