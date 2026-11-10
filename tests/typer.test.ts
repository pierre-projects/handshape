// The camera typer on a model hand: still letters held steady, and J and Z
// drawn in the air by moving the whole hand along the letter.
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import type { HandFrame } from '../app/src/lib/engine/hand';
import { imagePalm, MOVES, resample, type Pt } from '../app/src/lib/engine/movement';
import { CameraTyper, handMotion } from '../app/src/lib/engine/reader';
import { buildHand, type Pose } from './helpers/synthHand';
import { POSES } from './helpers/poses';

const STEP = 1000 / 30;

/** The model hand in a pose, moved by (dx, dy) in the picture. */
function handAt(pose: Pose, dx = 0, dy = 0): HandFrame {
  const f = buildHand(pose);
  return { ...f, image: f.image.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
}

type Part = { pose: Pose; ms: number; path?: Pt[]; side?: number; size?: number };

/** Plays parts (hold a pose, or move it along a path) through a typer; returns what was typed. */
function play(typer: CameraTyper, parts: Part[]) {
  const typed: { letter: string; replaces?: string }[] = [];
  let t = 0;
  let at = { x: 0, y: 0 };
  let prev: HandFrame | undefined;
  const feed = (frame: HandFrame) => {
    const moving = handMotion(prev?.image, frame.image) > 0.06;
    prev = frame;
    const s = typer.update(frame, computeFeatures(frame), moving, t);
    if (s.typed) typed.push({ letter: s.typed, ...(s.replaces ? { replaces: s.replaces } : {}) });
    t += STEP;
  };
  for (const part of parts) {
    const n = Math.max(1, Math.round(part.ms / STEP));
    if (!part.path) {
      for (let i = 0; i < n; i++) feed(handAt(part.pose, at.x, at.y));
      continue;
    }
    const palm = imagePalm(buildHand(part.pose));
    const from = at;
    for (const p of resample(part.path, n)) {
      at = { x: from.x + p.x * (part.side ?? 1) * (part.size ?? 1) * palm, y: from.y + p.y * (part.size ?? 1) * palm };
      feed(handAt(part.pose, at.x, at.y));
    }
  }
  return typed;
}

const I = POSES.i;
const J_PATH = MOVES.j.template;
const Z_PATH = MOVES.z.template;

describe('CameraTyper', () => {
  it('types a still letter held steady', () => {
    expect(play(new CameraTyper(), [{ pose: I, ms: 1200 }])).toEqual([{ letter: 'i' }]);
  });

  it('types J when it is drawn with the pinky', () => {
    const typed = play(new CameraTyper(), [
      { pose: I, ms: 400 },
      { pose: I, ms: 800, path: J_PATH },
      { pose: I, ms: 500 },
    ]);
    expect(typed).toEqual([{ letter: 'j' }]);
  });

  it('replaces an I typed just before the J from the same handshape, and adds no I after', () => {
    const typed = play(new CameraTyper(), [
      { pose: I, ms: 1200 },
      { pose: I, ms: 800, path: J_PATH },
      { pose: I, ms: 2500 },
    ]);
    expect(typed).toEqual([{ letter: 'i' }, { letter: 'j', replaces: 'i' }]);
  });

  it('types Z when it is drawn with the index finger', () => {
    const typed = play(new CameraTyper(), [
      { pose: POSES.z, ms: 400 },
      // The signer's left-to-right is the picture's right-to-left.
      { pose: POSES.z, ms: 1200, path: Z_PATH, side: -1 },
      { pose: POSES.z, ms: 400 },
    ]);
    expect(typed.map((x) => x.letter)).toEqual(['z']);
  });

  it('does not type J for a hand that just drops', () => {
    const typed = play(new CameraTyper(), [
      { pose: I, ms: 1200 },
      { pose: I, ms: 500, path: [{ x: 0, y: 0 }, { x: 0.25, y: 1.2 }] },
    ]);
    expect(typed).toEqual([{ letter: 'i' }]);
  });

  it('still types Z drawn from the D hand, in place of a D typed just before', () => {
    const typed = play(new CameraTyper(), [
      { pose: POSES.d, ms: 1200 },
      { pose: POSES.d, ms: 1200, path: Z_PATH, side: -1 },
      { pose: POSES.d, ms: 400 },
    ]);
    expect(typed).toEqual([{ letter: 'd' }, { letter: 'z', replaces: 'd' }]);
  });

  it('types nothing when there is no hand', () => {
    const typer = new CameraTyper();
    for (let t = 0; t < 2000; t += STEP) expect(typer.update(undefined, undefined, false, t).typed).toBeUndefined();
  });
});

describe('CameraTyper: a hand that sways while holding a letter', () => {
  /** A typer that also notes any letter it reported as being drawn. */
  function watched() {
    const typer = new CameraTyper();
    const drew = new Set<string>();
    const update = typer.update.bind(typer);
    typer.update = (...args: Parameters<CameraTyper['update']>) => {
      const s = update(...args);
      if (s.drawing) drew.add(s.drawing);
      return s;
    };
    return { typer, drew };
  }
  // Out a quarter of a palm and back: more than enough to start a stroke (0.18), far too small to be a letter.
  const WOBBLE = [{ x: 0, y: 0 }, { x: 0.25, y: 0 }, { x: 0, y: 0 }];
  const SWAY = [{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0, y: 0 }, { x: 0.3, y: -0.1 }, { x: 0, y: 0 }];

  it('types I and D through a wobble, without "drawing" a J or Z', () => {
    for (const id of ['i', 'd']) {
      const { typer, drew } = watched();
      const typed = play(typer, [{ pose: POSES[id], ms: 500 }, { pose: POSES[id], ms: 300, path: WOBBLE }, { pose: POSES[id], ms: 1300 }]);
      expect(typed, id).toEqual([{ letter: id }]);
      expect([...drew], id).toEqual([]);
    }
  });

  it('types I while the hand sways slowly back and forth', () => {
    const { typer, drew } = watched();
    const typed = play(typer, [{ pose: I, ms: 400 }, { pose: I, ms: 2000, path: SWAY }, { pose: I, ms: 600 }]);
    expect(typed).toEqual([{ letter: 'i' }]);
    expect([...drew]).toEqual([]);
  });

  it('types L and Y through a wobble: with the thumb out they start no stroke at all', () => {
    for (const id of ['l', 'y']) {
      const { typer, drew } = watched();
      const typed = play(typer, [{ pose: POSES[id], ms: 500 }, { pose: POSES[id], ms: 300, path: WOBBLE }, { pose: POSES[id], ms: 1300 }]);
      expect(typed, id).toEqual([{ letter: id }]);
      expect([...drew], id).toEqual([]);
    }
  });

  it('never types Z for an L hand, or J for a Y hand, even moved along the whole letter', () => {
    const l = watched();
    const z = play(l.typer, [{ pose: POSES.l, ms: 400 }, { pose: POSES.l, ms: 1200, path: Z_PATH, side: -1 }, { pose: POSES.l, ms: 400 }]);
    expect(z.map((x) => x.letter)).not.toContain('z');
    expect([...l.drew]).toEqual([]);

    const y = watched();
    const j = play(y.typer, [{ pose: POSES.y, ms: 400 }, { pose: POSES.y, ms: 800, path: J_PATH }, { pose: POSES.y, ms: 500 }]);
    expect(j.map((x) => x.letter)).not.toContain('j');
    expect([...y.drew]).toEqual([]);
  });

  it('does report a real J and a real Z as being drawn', () => {
    const j = watched();
    play(j.typer, [{ pose: I, ms: 400 }, { pose: I, ms: 800, path: J_PATH }, { pose: I, ms: 500 }]);
    expect([...j.drew]).toEqual(['j']);
    const z = watched();
    play(z.typer, [{ pose: POSES.z, ms: 400 }, { pose: POSES.z, ms: 1200, path: Z_PATH, side: -1 }, { pose: POSES.z, ms: 400 }]);
    expect([...z.drew]).toEqual(['z']);
  });
});
