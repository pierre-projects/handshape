// What keeps the camera's reading steady: telling R from V by the fingertips,
// staying with one hand when two are in view, and not letting a flicker
// between two letters throw a hold away.
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate, fingersCross, T } from '../app/src/lib/engine/handshapes';
import { classifyLetter, LetterReader, READER_DEFAULTS } from '../app/src/lib/engine/reader';
import { HandFollower, type SeenHand } from '../app/src/lib/engine/tracker';
import type { Handedness } from '../app/src/lib/engine/hand';
import { buildHand, type Pose } from './helpers/synthHand';
import { POSES } from './helpers/poses';

const feats = (pose: Pose) => computeFeatures(buildHand(pose));
/** The R, U and V hand with the index and middle fingers leaning by these many degrees (positive is toward the thumb side). */
const twoFingers = (index: number, middle: number): Pose => ({
  ...POSES.v,
  fingers: { ...POSES.v.fingers, index: [0, 4, 4, index], middle: [0, 4, 4, middle] },
});

describe('R is told from V by the fingertips', () => {
  it('reads an R whose fingers lean into each other without the tips swapping sides', () => {
    for (const [index, middle] of [[-6, 6], [-5, 8], [-7, 5], [-4, 9]]) {
      const f = feats(twoFingers(index, middle));
      expect(classifyLetter(f), `index ${index}, middle ${middle}`).toBe('r');
      expect(evaluate('v', f).pass, `index ${index}, middle ${middle} is not a V`).toBe(false);
    }
  });

  it('used to call that hand a V: the fingers are at an angle, and the tips had not swapped', () => {
    const f = feats(twoFingers(-5, 8));
    expect(classifyLetter(f)).toBe('r');
    expect(f.spread.im).toBeGreaterThanOrEqual(T.spreadMin);
    expect(f.crossIM).toBeLessThan(T.crossMin);
    // What sets it apart: the tips are together.
    expect(f.tipGapIM).toBeLessThan(T.rTipGapMax);
    expect(feats(POSES.v).tipGapIM).toBeGreaterThan(T.vTipGapMin);
  });

  it('still reads V, narrow or wide, and U, and a fully crossed R', () => {
    for (const [index, middle] of [[7, -7], [8, -10], [12, -14], [18, -18]]) {
      expect(classifyLetter(feats(twoFingers(index, middle))), `V at ${index - middle} degrees`).toBe('v');
    }
    for (const [index, middle] of [[1, -1], [0, 0], [3, -3]]) {
      expect(classifyLetter(feats(twoFingers(index, middle))), `U at ${index - middle} degrees`).toBe('u');
    }
    expect(classifyLetter(feats(POSES.r))).toBe('r');
    expect(classifyLetter(feats(twoFingers(-12, 12)))).toBe('r');
  });

  it('never lets one hand be R and also V or U, however the two fingers sit', () => {
    expect(T.rTipGapMax).toBeLessThan(T.vTipGapMin);
    for (let index = -16; index <= 20; index += 2) {
      for (let middle = -20; middle <= 16; middle += 2) {
        const f = feats(twoFingers(index, middle));
        const r = evaluate('r', f).pass;
        expect(r && evaluate('v', f).pass, `R and V at ${index}, ${middle}`).toBe(false);
        expect(r && evaluate('u', f).pass, `R and U at ${index}, ${middle}`).toBe(false);
        expect(r, `crossing at ${index}, ${middle}`).toBe(fingersCross(f));
      }
    }
  });
});

/** A model hand somewhere in the picture, called left or right. */
function seen(dx: number, handedness: Handedness, scale = 1): SeenHand {
  const h = buildHand(POSES.b);
  const wrist = h.image[0];
  return {
    world: h.world,
    handedness,
    image: h.image.map((p) => ({ x: wrist.x + (p.x - wrist.x) * scale + dx, y: wrist.y + (p.y - wrist.y) * scale, z: p.z })),
  };
}
const where = (h: SeenHand | undefined) => (h ? Math.round(h.image[0].x * 100) / 100 : undefined);

describe('the camera stays with one hand', () => {
  const signing = (label: Handedness = 'Right') => seen(0, label);
  const other = (label: Handedness = 'Left') => seen(0.35, label, 0.7);
  const home = where(signing());

  it('picks the signing hand when two are in view', () => {
    const f = new HandFollower();
    expect(where(f.pick([other(), signing()], 'Right', 0))).toBe(home);
    expect(where(new HandFollower().pick([other('Right'), signing('Left')], 'Left', 0))).toBe(home);
  });

  it('picks the bigger hand when the labels do not settle it', () => {
    // Both called "Right", or neither: the hand holding the phone is the small one at the edge.
    expect(where(new HandFollower().pick([other('Right'), signing('Right')], 'Right', 0))).toBe(home);
    expect(where(new HandFollower().pick([other('Left'), signing('Left')], 'Right', 0))).toBe(home);
  });

  it('does not jump to the other hand when the tracker swaps the labels', () => {
    const f = new HandFollower();
    const picks: (number | undefined)[] = [];
    for (let i = 0; i < 30; i++) {
      // Every third frame the tracker calls the hands the wrong way round, as it does on a phone.
      const swapped = i % 3 === 2;
      const hands = [other(swapped ? 'Right' : 'Left'), signing(swapped ? 'Left' : 'Right')];
      picks.push(where(f.pick(hands, 'Right', i * 66)));
    }
    expect(new Set(picks)).toEqual(new Set([home]));
  });

  it('keeps calling it the same hand through a flicker, and changes its mind only when the tracker is sure', () => {
    const f = new HandFollower();
    const labels: Handedness[] = [];
    const feed = (label: Handedness, t: number) => labels.push(f.pick([signing(label)], 'Right', t)!.handedness);
    feed('Right', 0);
    feed('Left', 33);
    feed('Right', 66);
    feed('Left', 99);
    feed('Left', 132);
    expect(new Set(labels)).toEqual(new Set(['Right']));
    for (let i = 0; i < 8; i++) feed('Left', 165 + i * 33);
    expect(labels[labels.length - 1]).toBe('Left');
  });

  it('follows the hand as it moves, and starts again after it has been away', () => {
    const f = new HandFollower();
    f.pick([signing(), other()], 'Right', 0);
    // The signing hand drifts toward the other one; it is still the one followed.
    for (let i = 1; i <= 10; i++) {
      const moved = seen(0.02 * i, 'Right');
      expect(where(f.pick([moved, other()], 'Right', i * 33))).toBe(where(moved));
    }
    expect(f.pick([], 'Right', 400)).toBeUndefined();
    // Gone for a second: the next hand seen is a new one, chosen afresh.
    expect(where(f.pick([other('Left'), signing('Right')], 'Right', 1500))).toBe(home);
  });

  it('reads the only hand there is', () => {
    expect(where(new HandFollower().pick([other('Left')], 'Right', 0))).toBe(where(other()));
    expect(new HandFollower().pick([], 'Right', 0)).toBeUndefined();
  });
});

describe('a flicker between two letters does not throw the hold away', () => {
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

  it('types R when the reading keeps slipping to V for a moment', () => {
    const seq: [string, number][] = [];
    for (let i = 0; i < 8; i++) seq.push(['r', 260], ['v', 170]);
    expect(feed(seq)).toEqual(['r']);
  });

  it('used to lose the hold to each slip: 170 ms was enough for the other letter to take over', () => {
    expect(170).toBeGreaterThan(READER_DEFAULTS.graceMs);
    expect(170).toBeLessThan(READER_DEFAULTS.switchMs);
  });

  it('still changes letter when the new one is really being held, and gives it credit for the wait', () => {
    // R half held, then V for good: V types about 0.9 s after it first showed, not 0.9 s after it took over.
    const reader = new LetterReader();
    let typedAt: number | undefined;
    let t = 0;
    for (; t < 500; t += 33) reader.update('r', t);
    const vFrom = t;
    for (; t < 2500 && typedAt === undefined; t += 33) if (reader.update('v', t).typed === 'v') typedAt = t;
    expect(typedAt).toBeDefined();
    expect(typedAt! - vFrom).toBeLessThan(READER_DEFAULTS.holdMs + 100);
  });

  it('judges a slow camera the same', () => {
    const seq: [string, number][] = [];
    for (let i = 0; i < 8; i++) seq.push(['r', 300], ['v', 200]);
    for (const step of [33, 66, 100]) expect(feed(seq, step), `${step} ms a frame`).toEqual(['r']);
  });
});
