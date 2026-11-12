// The repeat check (a small movement made twice) and its first use, the shake in 10.
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate } from '../app/src/lib/engine/handshapes';
import { hasRepeat, REPEATS, RepeatTracker, type RepeatOptions } from '../app/src/lib/engine/movement';
import { CameraTyper, READABLE_NUMBERS } from '../app/src/lib/engine/reader';
import type { HandFrame } from '../app/src/lib/engine/hand';
import { buildHand } from './helpers/synthHand';
import { POSES } from './helpers/poses';

const STEP = 1000 / 30;
const OPTS: RepeatOptions = { swing: 0.12, turns: 2, windowMs: 1500, graceMs: 300 };

/** Feeds a measurement that changes over time, one camera frame at a time; says when it matched, if it did. */
function run(value: (t: number) => number | undefined, ms: number, opts = OPTS, step = STEP): number | undefined {
  const tracker = new RepeatTracker(opts);
  for (let t = 0; t < ms; t += step) if (tracker.update(value(t), t).matched) return t;
  return undefined;
}
const wave = (size: number, hz: number) => (t: number) => size * Math.sin((2 * Math.PI * hz * t) / 1000);

describe('RepeatTracker', () => {
  it('sees a shake: out, back and out again', () => {
    for (const hz of [2, 3, 4]) expect(run(wave(0.2, hz), 1500), `${hz} a second`).toBeLessThan(900);
    // A small one, and one that starts the other way.
    expect(run(wave(0.08, 3), 1500)).toBeDefined();
    expect(run((t) => -wave(0.2, 3)(t), 1500)).toBeDefined();
  });

  it('is not fooled by a still hand, jitter, a drift or a single nudge', () => {
    expect(run(() => 0.4, 3000), 'still').toBeUndefined();
    expect(run(wave(0.04, 6), 3000), 'jitter smaller than a swing').toBeUndefined();
    expect(run((t) => t / 1000, 3000), 'slow drift').toBeUndefined();
    // Out and back once: one turn.
    expect(run((t) => (t < 400 ? wave(0.2, 1.25)(t) : 0), 3000), 'one nudge').toBeUndefined();
  });

  it('wants the turns close together', () => {
    // A nudge, a long wait, then another nudge the other way.
    const twoNudges = (t: number) => (t < 400 ? wave(0.2, 1.25)(t) : t > 2600 && t < 3000 ? -wave(0.2, 1.25)(t - 2600) : 0);
    expect(run(twoNudges, 4000)).toBeUndefined();
    // Too slow to be a shake: one swing every two seconds.
    expect(run(wave(0.2, 0.25), 6000)).toBeUndefined();
  });

  it('starts again when the handshape is lost for longer than the grace time', () => {
    // Half a shake, the hand drops for half a second, then the other half: not one shake.
    const broken = (t: number) => (t < 250 ? wave(0.2, 3)(t) : t < 800 ? undefined : t < 950 ? wave(0.2, 3)(t) : 0.15);
    expect(run(broken, 2000)).toBeUndefined();
    // A flicker of a frame or two doesn't break it.
    const flicker = (t: number) => (t > 150 && t < 220 ? undefined : wave(0.2, 3)(t));
    expect(run(flicker, 1500)).toBeDefined();
  });

  it('reports progress, and matches once per shake', () => {
    const tracker = new RepeatTracker(OPTS);
    let peak = 0;
    let matches = 0;
    for (let t = 0; t < 520; t += STEP) {
      const s = tracker.update(wave(0.2, 3)(t), t);
      peak = Math.max(peak, s.progress);
      if (s.matched) matches++;
    }
    expect(peak).toBe(1);
    expect(matches).toBe(1);
  });

  it('judges a slow camera like a fast one', () => {
    for (const step of [16, 33, 66]) expect(run(wave(0.2, 2.5), 1500, OPTS, step), `${step} ms a frame`).toBeDefined();
  });
});

/** The model 10, rocked from side to side about the wrist (`twist` degrees each way) or wagged bodily (`wag` of the picture's width). */
function shaken(t: number, { twist = 0, wag = 0, hz = 3 } = {}): HandFrame {
  const s = Math.sin((2 * Math.PI * hz * t) / 1000);
  const frame = buildHand({ ...POSES['10'], transforms: [{ rotateZ: -90 + twist * s }] });
  return wag ? { ...frame, image: frame.image.map((p) => ({ ...p, x: p.x + wag * s })) } : frame;
}

describe("10's shake", () => {
  const spec = REPEATS['10'];

  it('is the only sign with a repeat so far', () => {
    expect(hasRepeat('10')).toBe(true);
    expect(hasRepeat('5')).toBe(false);
    expect(hasRepeat('j')).toBe(false);
  });

  it('is seen on a model hand, whether the wrist twists or the whole fist wags', () => {
    for (const how of [{ twist: 12 }, { twist: 6 }, { wag: 0.03 }]) {
      const tracker = new RepeatTracker(spec.options);
      let matched = false;
      for (let t = 0; t < 1200; t += STEP) {
        const frame = shaken(t, how);
        const ok = evaluate('10', computeFeatures(frame)).pass;
        expect(ok, `still a 10 while shaking: ${JSON.stringify(how)}`).toBe(true);
        matched ||= tracker.update(spec.measure(frame), t).matched;
      }
      expect(matched, JSON.stringify(how)).toBe(true);
    }
  });

  it('is not seen on a 10 held still', () => {
    const tracker = new RepeatTracker(spec.options);
    for (let t = 0; t < 3000; t += STEP) expect(tracker.update(spec.measure(shaken(t)), t).matched).toBe(false);
  });
});

describe('Sign the answer: a shaken 10', () => {
  const opts = { signs: READABLE_NUMBERS, commands: false };
  /** Plays frames through the numbers reader and returns what typed, and when. */
  function play(frameAt: (t: number) => HandFrame | undefined, ms: number, moving = false, options: object = opts) {
    const typer = new CameraTyper();
    const typed: { sign: string; at: number }[] = [];
    for (let t = 0; t < ms; t += STEP) {
      const frame = frameAt(t);
      const s = typer.update(frame, frame && computeFeatures(frame), moving, t, { ...options, raw: frame });
      if (s.typed) typed.push({ sign: s.typed, at: Math.round(t) });
    }
    return typed;
  }

  it('types as soon as the shake is seen, sooner than a still hold', () => {
    const typed = play((t) => shaken(t, { twist: 12 }), 3000);
    expect(typed.map((x) => x.sign)).toEqual(['10']);
    expect(typed[0].at).toBeLessThan(600);
  });

  it('still types a 10 held still, after the usual hold', () => {
    expect(play((t) => shaken(t), 800)).toEqual([]);
    const typed = play((t) => shaken(t), 3000);
    expect(typed.map((x) => x.sign)).toEqual(['10']);
    expect(typed[0].at).toBeGreaterThan(850);
  });

  it('types one 10 for a hold followed by a shake, and one for a long shake', () => {
    expect(play((t) => shaken(t, { twist: t > 1200 ? 12 : 0 }), 4000).map((x) => x.sign)).toEqual(['10']);
    expect(play((t) => shaken(t, { twist: 12, hz: 4 }), 5000).map((x) => x.sign)).toEqual(['10']);
  });

  it('reads the shake even when the hand counts as moving fast', () => {
    // The whole-hand speed gate would otherwise ignore every frame of a brisk shake.
    expect(play((t) => shaken(t, { twist: 12 }), 2000, true).map((x) => x.sign)).toEqual(['10']);
    // Another number moving that fast is still between signs.
    expect(play(() => buildHand(POSES['5']), 2000, true)).toEqual([]);
  });

  it('types a second 10 after the hand has dropped', () => {
    const typed = play((t) => (t > 1000 && t < 1600 ? undefined : shaken(t, { twist: 12 })), 3000);
    expect(typed.map((x) => x.sign)).toEqual(['10', '10']);
  });

  it('is left alone when reading letters: a shaken thumbs up is not a 10 in Sign Five', () => {
    expect(play((t) => shaken(t, { twist: 12 }), 2000, false, {})).toEqual([]);
  });
});
