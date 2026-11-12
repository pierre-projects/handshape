import { describe, expect, it } from 'vitest';
import {
  ANSWERS, dailyAnswer, dailyStatus, describeDaily, fetchOfficialAnswer, isKnownWord, letterMarks, randomAnswer, scoreGuess, shareText, shareTitle, todaysAnswer, WORDS,
} from '../app/src/lib/guess';
import { sortWords } from '../app/src/lib/spelling';
import { classifyLetter, handMotion, isMoving, LetterReader, READABLE_LETTERS, READER_DEFAULTS, readLetter } from '../app/src/lib/engine/reader';
import { computeFeatures } from '../app/src/lib/engine/features';
import { buildHand } from './helpers/synthHand';
import { POSES, REAL } from './helpers/poses';

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

describe('LetterReader: a wobble does not restart the hold', () => {
  /** Feeds one reading per frame, `step` ms apart, and returns what was typed. */
  function feed(seq: [string | undefined, number][], step = 33) {
    const reader = new LetterReader();
    const typed: string[] = [];
    let t = 0;
    for (const [l, ms] of seq) {
      for (let end = t + ms; t < end; t += step) {
        const s = reader.update(l, t);
        if (s.typed) typed.push(s.typed);
      }
    }
    return typed;
  }

  it('carries on from what is left after the reading drops out', () => {
    // 700 ms held, lost for a quarter of a second, then 400 ms more: it used to start again from nothing.
    expect(feed([['h', 700], [undefined, 250], ['h', 400]])).toEqual(['h']);
    // The same wobble as a passing misreading of a neighboring letter.
    expect(feed([['h', 700], ['u', 100], ['h', 300]])).toEqual(['h']);
  });

  it('keeps most of the hold through the wobble', () => {
    const reader = new LetterReader();
    let p = 0;
    for (let t = 0; t < 700; t += 33) p = reader.update('h', t).progress;
    const before = p;
    for (let t = 700; t < 950; t += 33) p = reader.update(undefined, t).progress;
    expect(p).toBeGreaterThan(before * 0.6);
    expect(p).toBeLessThan(before);
  });

  it('lets go of a letter that stays away', () => {
    expect(feed([['h', 500], [undefined, 800], ['h', 600]])).toEqual([]);
  });

  it('never types a letter that is read less than half the time', () => {
    const brushes: [string | undefined, number][] = [];
    for (let i = 0; i < 30; i++) brushes.push(['c', 100], [undefined, 400]);
    expect(feed(brushes)).toEqual([]);
    // Flickering one frame on, three off, used to type inside a second.
    const flicker: [string | undefined, number][] = [];
    for (let i = 0; i < 20; i++) flicker.push(['c', 33], [undefined, 99]);
    expect(feed(flicker)).toEqual([]);
  });

  it('starts a different letter from nothing', () => {
    // S was nearly there; changing to A must not finish S, or give A a head start.
    expect(feed([['s', 800], ['a', 600]])).toEqual([]);
    expect(feed([['s', 800], ['a', 1100]])).toEqual(['a']);
  });

  it('judges a slow camera like a fast one', () => {
    for (const step of [16, 33, 66, 100]) {
      expect(feed([['a', 1100]], step), `steady at ${step} ms a frame`).toEqual(['a']);
      expect(feed([['a', 700]], step), `too short at ${step} ms a frame`).toEqual([]);
      expect(feed([['h', 700], [undefined, 250], ['h', 500]], step), `wobble at ${step} ms a frame`).toEqual(['h']);
    }
  });

  it('does not let one stalled frame type or wipe a letter', () => {
    const reader = new LetterReader();
    reader.update('a', 0);
    reader.update('a', 33);
    // The camera stalls for two seconds with A still showing: that is one frame, not a two-second hold.
    expect(reader.update('a', 2033).typed).toBeUndefined();
  });
});

describe('isMoving', () => {
  const pts = Array.from({ length: 21 }, (_, i) => ({ x: i / 40, y: i / 40 }));
  const shifted = (d: number) => pts.map((p) => ({ x: p.x + d, y: p.y }));
  const size = Math.hypot(pts[0].x - pts[9].x, pts[0].y - pts[9].y);

  it('goes by speed, so the same movement reads the same on a slow camera', () => {
    // A drift of one hand length a second: slow enough to read.
    expect(isMoving(pts, shifted(size * 0.033), 33)).toBe(false);
    expect(isMoving(pts, shifted(size * 0.1), 100)).toBe(false);
    // Three hand lengths a second: traveling.
    expect(isMoving(pts, shifted(size * 0.1), 33)).toBe(true);
    expect(isMoving(pts, shifted(size * 0.3), 100)).toBe(true);
  });

  it('is false with nothing to compare against', () => {
    expect(isMoving(undefined, pts, 33)).toBe(false);
    expect(isMoving(pts, shifted(0.5), 0)).toBe(false);
  });
});

describe('a loosely matched letter is held longer', () => {
  /** Holds one letter for `ms`, every frame sure or not, and says whether it typed. */
  const types = (ms: number, sure: (frame: number) => boolean) => {
    const reader = new LetterReader();
    let typed = false;
    for (let t = 0, n = 0; t < ms; t += 33, n++) typed ||= !!reader.update('s', t, sure(n)).typed;
    return typed;
  };

  it('says whether a reading is a full match or a loose one', () => {
    expect(readLetter(computeFeatures(buildHand(POSES.a)))).toEqual({ letter: 'a', sure: true });
    // P seen from above: the index and thumb can't be checked, so it matches loosely.
    expect(readLetter(computeFeatures(buildHand(REAL.pHidden)))).toEqual({ letter: 'p', sure: false });
  });

  it('needs the longer hold when every frame is loose', () => {
    expect(READER_DEFAULTS.unsureHoldMs).toBeGreaterThan(READER_DEFAULTS.holdMs);
    expect(types(READER_DEFAULTS.holdMs + 100, () => false)).toBe(false);
    expect(types(READER_DEFAULTS.unsureHoldMs + 100, () => false)).toBe(true);
  });

  it('keeps the usual hold for a full match, and for the odd loose frame', () => {
    expect(types(READER_DEFAULTS.holdMs + 100, () => true)).toBe(true);
    expect(types(READER_DEFAULTS.holdMs + 100, (n) => n % 10 !== 0)).toBe(true);
  });

  it('says so while the hold is mostly loose', () => {
    const reader = new LetterReader();
    reader.update('s', 0, false);
    expect(reader.update('s', 33, false).unsure).toBe(true);
    const sure = new LetterReader();
    sure.update('s', 0);
    expect(sure.update('s', 33).unsure).toBe(false);
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

  it('shows colored squares and no letters', () => {
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
