// Generated fingertip strokes for the movement tests: a shape drawn at some
// size, tilt and shakiness, either as a bare path or as timed camera frames.
import { resample, type Pt } from '../../app/src/lib/engine/movement';

/** Palm size in picture units, as a hand at a normal distance appears. */
export const PALM = 0.2;

export const LINE_DOWN: Pt[] = [{ x: 0, y: 0 }, { x: 0, y: 1 }];
export const LINE_ACROSS: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
/** A Z without its last stroke. */
export const SEVEN: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];

/** A small repeatable random source, so tests don't flake. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DrawOptions {
  /** Size of the drawing in palm lengths. */
  size?: number;
  /** +1 draws the shape as given, -1 mirrored left to right. */
  side?: number;
  /** Degrees the whole drawing is rotated. */
  tilt?: number;
  /** Random wobble, in palm lengths. */
  jitter?: number;
  seed?: number;
  /** How many points along the path. */
  points?: number;
}

/** The shape as a fingertip would trace it, in picture units. */
export function drawn(shape: Pt[], o: DrawOptions = {}): Pt[] {
  const { size = 1, side = 1, tilt = 0, jitter = 0, seed = 1, points = 48 } = o;
  const rnd = random(seed);
  const a = (tilt * Math.PI) / 180;
  return resample(shape, points).map((p) => {
    const x = p.x * side * size * PALM;
    const y = p.y * size * PALM;
    return {
      x: 0.5 + x * Math.cos(a) - y * Math.sin(a) + (rnd() - 0.5) * 2 * jitter * PALM,
      y: 0.3 + x * Math.sin(a) + y * Math.cos(a) + (rnd() - 0.5) * 2 * jitter * PALM,
    };
  });
}

export function circle(size = 1): Pt[] {
  return Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * Math.PI * 2;
    return { x: 0.5 + Math.cos(t) * 0.5 * size * PALM, y: 0.3 + Math.sin(t) * 0.5 * size * PALM };
  });
}

export interface Frame {
  tip: Pt | undefined;
  shapeOk: boolean;
  thumb: number;
  t: number;
}

/**
 * Camera frames (30 a second) of a hand holding still, drawing the shape over
 * `ms`, then holding still again.
 */
export function holdThenDraw(
  shape: Pt[],
  o: DrawOptions & { ms: number; holdMs?: number; thumb?: number; startAt?: number },
): Frame[] {
  const { ms, holdMs = 500, thumb = 1, startAt = 0, jitter = 0, seed = 1 } = o;
  const step = 1000 / 30;
  const n = Math.max(2, Math.round(ms / step));
  const path = drawn(shape, { ...o, jitter: 0, points: n });
  const rnd = random(seed + 7);
  const wobble = (p: Pt): Pt => ({ x: p.x + (rnd() - 0.5) * 2 * jitter * PALM, y: p.y + (rnd() - 0.5) * 2 * jitter * PALM });
  const frames: Frame[] = [];
  let t = startAt;
  const push = (p: Pt) => {
    frames.push({ tip: wobble(p), shapeOk: true, thumb, t });
    t += step;
  };
  for (let i = 0; i < holdMs / step; i++) push(path[0]);
  for (const p of path) push(p);
  for (let i = 0; i < (holdMs + 300) / step; i++) push(path[path.length - 1]);
  return frames;
}
