// The Enter and Delete gestures (thumbs up, thumbs down) on a model hand, and
// how the camera typer treats them alongside letters.
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { classifyCommand, GESTURE, isCommand } from '../app/src/lib/engine/gestures';
import { CameraTyper, classifyLetter } from '../app/src/lib/engine/reader';
import { fist4 } from '../app/src/lib/engine/poses';
import { buildHand, STRAIGHT, type Pose } from './helpers/synthHand';
import { POSES } from './helpers/poses';

// A fist turned on its side with the thumb held straight out from it: pointing up, or down.
const thumbOut = { line: [1, -0.15, 0] as [number, number, number] };
const UP: Pose = { fingers: fist4, thumb: thumbOut, transforms: [{ rotateZ: -90 }] };
const DOWN: Pose = { fingers: fist4, thumb: thumbOut, transforms: [{ rotateZ: 90 }] };

const command = (pose: Pose) => {
  const frame = buildHand(pose);
  return classifyCommand(frame, computeFeatures(frame));
};

describe('classifyCommand', () => {
  it('reads thumbs up as enter and thumbs down as delete', () => {
    expect(command(UP)).toBe('enter');
    expect(command(DOWN)).toBe('delete');
    expect(isCommand('enter')).toBe(true);
    expect(isCommand('a')).toBe(false);
  });

  it('works for a left hand, and with the fist tilted', () => {
    expect(command({ ...UP, hand: 'Left' })).toBe('enter');
    expect(command({ ...DOWN, hand: 'Left' })).toBe('delete');
    for (const tilt of [-25, 25]) {
      expect(command({ ...UP, transforms: [{ rotateZ: -90 + tilt }] }), `up tilted ${tilt}`).toBe('enter');
      expect(command({ ...DOWN, transforms: [{ rotateZ: 90 + tilt }] }), `down tilted ${tilt}`).toBe('delete');
    }
  });

  it('is no command when the thumb points sideways', () => {
    expect(command({ fingers: fist4, thumb: thumbOut })).toBeUndefined();
    expect(command({ ...UP, transforms: [{ rotateZ: -160 }] })).toBeUndefined();
  });

  it('needs a fist: an open finger is not a command', () => {
    expect(command({ ...UP, fingers: { ...fist4, index: STRAIGHT } })).toBeUndefined();
    expect(command({ ...DOWN, fingers: { ...fist4, pinky: STRAIGHT } })).toBeUndefined();
  });

  it('needs the thumb straight and standing clear of the fist', () => {
    // Bent over the fingers, as in S.
    expect(command({ ...UP, thumb: POSES.s.thumb })).toBeUndefined();
    // Lying beside the fist, as in A: it barely clears the knuckles.
    const frame = buildHand(POSES.a);
    const f = computeFeatures(frame);
    expect(f.thumbDirection).toBe('up');
    expect(classifyCommand(frame, f)).toBeUndefined();
    expect(GESTURE.clearBy).toBeGreaterThan(0.3);
  });

  it('is never read from any letter', () => {
    for (const id of 'abcdefghijklmnopqrstuvwxyz') {
      expect(command(POSES[id]), id).toBeUndefined();
      expect(command({ ...POSES[id], hand: 'Left' }), `${id} left`).toBeUndefined();
    }
  });

  it('does not read as a letter itself', () => {
    for (const pose of [UP, DOWN]) expect(classifyLetter(computeFeatures(buildHand(pose)))).toBeUndefined();
  });
});

describe('CameraTyper with commands', () => {
  const STEP = 1000 / 30;
  type Out = { letter?: string; command?: string };

  /** Holds each pose for its time (undefined is no hand in view) and returns what was typed or commanded. */
  function play(typer: CameraTyper, parts: { pose?: Pose; ms: number; letters?: boolean }[]): Out[] {
    const out: Out[] = [];
    let t = 0;
    for (const part of parts) {
      const frame = part.pose ? buildHand(part.pose) : undefined;
      for (let i = 0; i < Math.round(part.ms / STEP); i++) {
        const s = typer.update(frame, frame && computeFeatures(frame), false, t, { letters: part.letters ?? true });
        if (s.typed) out.push({ letter: s.typed });
        if (s.command) out.push({ command: s.command });
        t += STEP;
      }
    }
    return out;
  }

  it('gives a command once the gesture is held, and only once per hold', () => {
    expect(play(new CameraTyper(), [{ pose: UP, ms: 600 }])).toEqual([]);
    expect(play(new CameraTyper(), [{ pose: UP, ms: 1100 }])).toEqual([{ command: 'enter' }]);
    expect(play(new CameraTyper(), [{ pose: DOWN, ms: 4000 }])).toEqual([{ command: 'delete' }]);
  });

  it('deletes again after the hand drops and comes back', () => {
    const out = play(new CameraTyper(), [{ pose: DOWN, ms: 1100 }, { ms: 500 }, { pose: DOWN, ms: 1100 }]);
    expect(out).toEqual([{ command: 'delete' }, { command: 'delete' }]);
  });

  it('types letters and takes commands in one run', () => {
    const out = play(new CameraTyper(), [
      { pose: POSES.c, ms: 1100 }, { ms: 400 },
      { pose: POSES.b, ms: 1100 }, { ms: 400 },
      { pose: DOWN, ms: 1100 }, { ms: 400 },
      { pose: POSES.a, ms: 1100 }, { ms: 400 },
      { pose: UP, ms: 1100 },
    ]);
    expect(out).toEqual([{ letter: 'c' }, { letter: 'b' }, { command: 'delete' }, { letter: 'a' }, { command: 'enter' }]);
  });

  it('goes straight from a letter to a command without dropping the hand', () => {
    // Changing shape counts as letting go of the letter (about 0.3 s), then the gesture's own hold begins.
    const out = play(new CameraTyper(), [{ pose: POSES.l, ms: 1100 }, { pose: UP, ms: 1400 }]);
    expect(out).toEqual([{ letter: 'l' }, { command: 'enter' }]);
  });

  it('still takes commands, but no letters, when the row is full', () => {
    const out = play(new CameraTyper(), [
      { pose: POSES.b, ms: 1500, letters: false }, { ms: 400, letters: false },
      { pose: UP, ms: 1100, letters: false },
    ]);
    expect(out).toEqual([{ command: 'enter' }]);
  });

  it('does not report a command as a typed letter', () => {
    const typer = new CameraTyper();
    const frame = buildHand(UP);
    let sawTyped = false;
    let held: string | undefined;
    for (let t = 0; t < 1200; t += STEP) {
      const s = typer.update(frame, computeFeatures(frame), false, t);
      sawTyped ||= !!s.typed;
      if (s.progress > 0 && s.progress < 1) held = s.letter;
    }
    expect(sawTyped).toBe(false);
    // While it is being held, the state names the gesture so the screen can show it.
    expect(held).toBe('enter');
  });

  it('ignores the gesture while the hand is traveling', () => {
    const typer = new CameraTyper();
    const frame = buildHand(UP);
    const out: string[] = [];
    for (let t = 0; t < 1500; t += STEP) {
      const s = typer.update(frame, computeFeatures(frame), true, t);
      if (s.command) out.push(s.command);
    }
    expect(out).toEqual([]);
  });
});
