import { describe, expect, it } from 'vitest';
import { ANSWERS, firstTry, makeRound, makeSum, MAX_ANSWER, ROUND_LENGTH, roundMessage, sumSpoken, sumText, type SumResult } from '../app/src/lib/sums';
import { content } from '../app/src/lib/content';
import { SPECS } from '../app/src/lib/engine/handshapes';
import { CameraTyper, nearMiss, READABLE_NUMBERS, readLetter } from '../app/src/lib/engine/reader';
import { computeFeatures } from '../app/src/lib/engine/features';
import { buildHand } from './helpers/synthHand';
import { POSES, REAL } from './helpers/poses';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

describe('sums', () => {
  it('have an answer the app teaches and the camera can check', () => {
    for (const id of ANSWERS) {
      expect(content.byId.get(id)?.kind, id).toBe('number');
      expect(SPECS.has(id), id).toBe(true);
    }
    expect(READABLE_NUMBERS).toEqual(ANSWERS);
  });

  it('add up, with no zeros and nothing over ten', () => {
    const rnd = seeded(3);
    for (let n = 0; n <= MAX_ANSWER; n++) {
      for (let i = 0; i < 200; i++) {
        const s = makeSum(n, rnd);
        expect(s.answer).toBe(n);
        expect(s.op === 'plus' ? s.a + s.b : s.a - s.b, sumText(s)).toBe(n);
        for (const x of [s.a, s.b]) {
          expect(x, sumText(s)).toBeGreaterThanOrEqual(1);
          expect(x, sumText(s)).toBeLessThanOrEqual(MAX_ANSWER);
        }
      }
    }
  });

  it('use both adding and taking away where both are possible', () => {
    const rnd = seeded(5);
    const ops = new Set(Array.from({ length: 100 }, () => makeSum(5, rnd).op));
    expect(ops).toEqual(new Set(['plus', 'minus']));
    expect(new Set(Array.from({ length: 50 }, () => makeSum(0, rnd).op))).toEqual(new Set(['minus']));
    expect(new Set(Array.from({ length: 50 }, () => makeSum(10, rnd).op))).toEqual(new Set(['plus']));
  });

  it('read the same on screen and aloud', () => {
    expect(sumText({ a: 3, b: 4, op: 'plus', answer: 7 })).toBe('3 + 4');
    expect(sumText({ a: 9, b: 2, op: 'minus', answer: 7 })).toBe('9 − 2');
    expect(sumSpoken({ a: 9, b: 2, op: 'minus', answer: 7 })).toBe('9 minus 2');
  });
});

describe('a round', () => {
  it('never asks for the same number twice', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const round = makeRound(ROUND_LENGTH, seeded(seed));
      expect(round).toHaveLength(ROUND_LENGTH);
      expect(new Set(round.map((s) => s.answer)).size).toBe(ROUND_LENGTH);
    }
  });

  it('is different each time, and can cover every number', () => {
    const order = (seed: number) => makeRound(ROUND_LENGTH, seeded(seed)).map((s) => s.answer).join(',');
    expect(order(1)).not.toBe(order(2));
    expect(makeRound(99, seeded(1))).toHaveLength(ANSWERS.length);
  });

  it('counts a sum as first try only with no misses and no help', () => {
    const sum = makeSum(7, seeded(1));
    const r = (over: Partial<SumResult>): SumResult => ({ sum, misses: 0, helped: false, signed: true, ...over });
    expect(firstTry(r({}))).toBe(true);
    expect(firstTry(r({ signed: false }))).toBe(true);
    expect(firstTry(r({ misses: 1 }))).toBe(false);
    expect(firstTry(r({ helped: true }))).toBe(false);
    expect(roundMessage([r({}), r({})])).toBe('Every one, first try!');
    expect(roundMessage([r({ misses: 2 }), r({ helped: true })])).toMatch(/Good start/);
  });
});

describe('the camera reads numbers', () => {
  it('reads each number from 0 to 10 as itself when only numbers are wanted', () => {
    for (const id of READABLE_NUMBERS) {
      expect(readLetter(computeFeatures(buildHand(POSES[id])), READABLE_NUMBERS)?.letter, id).toBe(id);
    }
  });

  it('does not take a closed fist for a 10', () => {
    // A hand at rest is often a fist. Only the thumb standing up makes it a 10.
    for (const id of ['s', 'e', 'm', 'n', 't', 'x', 'a']) {
      expect(readLetter(computeFeatures(buildHand(POSES[id])), READABLE_NUMBERS), id).toBeUndefined();
    }
    // And a fist is a hand at rest: the game doesn't call it "almost 10".
    for (const id of ['s', 'e', 'a', 't']) expect(nearMiss(computeFeatures(buildHand(POSES[id])), READABLE_NUMBERS), id).toBeUndefined();
    expect(readLetter(computeFeatures(buildHand(POSES['10'])), READABLE_NUMBERS)).toEqual({ letter: '10', sure: true });
  });

  it('does not answer with a letter that shares the handshape', () => {
    // O and 0, V and 2, W and 6, F and 9 look alike; in the sums game only the number counts.
    for (const [letter, number] of [['o', '0'], ['w', '6'], ['f', '9']]) {
      expect(readLetter(computeFeatures(buildHand(POSES[letter])), READABLE_NUMBERS)?.letter, letter).toBe(number);
    }
  });
});

describe('a near miss says what to fix', () => {
  const PALM = 'Turn your palm to face you, so the camera sees the back of your hand.';
  const feats = (pose: Parameters<typeof buildHand>[0]) => computeFeatures(buildHand(pose));

  it('tells a 5 shown palm out, like its picture, to turn round', () => {
    // The usual mistake: the hand is right but the palm is toward the camera.
    for (const [sign, name] of [['5', 'fiveRelaxed'], ['1', 'one'], ['2', 'two'], ['4', 'four']]) {
      const f = feats({ ...REAL[name], transforms: [] });
      expect(readLetter(f, READABLE_NUMBERS), `${sign} palm out is not read`).toBeUndefined();
      expect(nearMiss(f, READABLE_NUMBERS), `${sign} palm out`).toEqual({ sign, hint: PALM });
    }
  });

  it('says other single fixes too, but not when two numbers are as close', () => {
    // A 6 with the thumb not quite reaching the pinky.
    const six = feats({ ...POSES['6'], thumb: { line: [-0.2, -1, -0.5] } });
    expect(nearMiss(six, READABLE_NUMBERS)).toEqual({ sign: '6', hint: 'Touch your thumb to your pinky fingertip.' });
    // A 3 with the ring finger left up is one finger from a 3 and one from a 5: no guess.
    const three = feats({ ...POSES['3'], fingers: { ...POSES['3'].fingers, ring: [0, 4, 4, -10] } });
    expect(nearMiss(three, READABLE_NUMBERS)).toBeUndefined();
  });

  it('says nothing when the hand already reads as a number', () => {
    for (const id of READABLE_NUMBERS) {
      const f = feats(POSES[id]);
      expect(readLetter(f, READABLE_NUMBERS)?.letter, id).toBe(id);
    }
  });

  it('puts a hand that is only turned wrong ahead of one that needs a finger moved', () => {
    // An open hand, palm out, is also one finger away from 6, 7 and 8. It is a 5 the wrong way round.
    const f = feats({ ...POSES['5'], transforms: [] });
    expect(nearMiss(f, ['6', '7', '8'])).toBeUndefined();
    expect(nearMiss(f, READABLE_NUMBERS)?.sign).toBe('5');
    // The same the other way: a 6 with its back to the camera.
    expect(nearMiss(feats({ ...POSES['6'], transforms: [{ rotateY: 180 }] }), READABLE_NUMBERS)).toEqual({
      sign: '6',
      hint: 'Turn your palm to face out, toward the camera.',
    });
  });

  it('says nothing when the hand is far from every number, or close to two', () => {
    // R and K: no number is close.
    for (const id of ['r', 'k']) expect(nearMiss(feats(POSES[id]), READABLE_NUMBERS), id).toBeUndefined();
    expect(nearMiss(feats({ ...POSES['5'], transforms: [] }), ['6', '7'])).toBeUndefined();
  });

  it('reaches the game through the camera reader, and stops once the number reads', () => {
    const typer = new CameraTyper();
    const opts = { signs: READABLE_NUMBERS, commands: false };
    const out = buildHand({ ...REAL.fiveRelaxed, transforms: [] });
    let state = typer.update(out, computeFeatures(out), false, 0, opts);
    for (let t = 33; t < 500; t += 33) state = typer.update(out, computeFeatures(out), false, t, opts);
    expect(state.near).toEqual({ sign: '5', hint: PALM });
    expect(state.typed).toBeUndefined();

    const turned = buildHand(REAL.fiveRelaxed);
    const typed: string[] = [];
    for (let t = 500; t < 2200; t += 33) {
      state = typer.update(turned, computeFeatures(turned), false, t, opts);
      expect(state.near).toBeUndefined();
      if (state.typed) typed.push(state.typed);
    }
    expect(typed).toEqual(['5']);
  });

  it('is left out when reading letters', () => {
    const typer = new CameraTyper();
    const out = buildHand({ ...REAL.fiveRelaxed, transforms: [] });
    expect(typer.update(out, computeFeatures(out), false, 0).near).toBeUndefined();
  });
});
