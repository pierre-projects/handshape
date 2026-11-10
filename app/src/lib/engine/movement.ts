// Movement checks for letters drawn in the air: J (with the pinky) and Z (with
// the index finger). A fingertip is followed from frame to frame; when it has
// drawn a stroke, the stroke's shape is compared with the letter's.
//
// Points are in image space: x to the right of the camera picture, y down, with
// x already multiplied by the picture's aspect ratio so distances are true.
// The camera picture is not mirrored, so the signer's right is the picture's left.
import { LM, type HandFrame } from './hand';

export interface Pt {
  x: number;
  y: number;
}

export type MoveId = 'j' | 'z';

export interface MoveSpec {
  id: MoveId;
  /** The landmark whose tip draws the letter. */
  tip: number;
  /** Shown once the starting handshape is held. */
  prompt: string;
  /** The letter's shape, drawn left to right as below (see `expectedSide`). Any size. */
  template: Pt[];
  /** Smallest drawing that counts, in palm lengths (its longer side). */
  minSize: number;
}

export const MOVES: Record<MoveId, MoveSpec> = {
  j: {
    id: 'j',
    tip: LM.PINKY_TIP,
    prompt: 'Now draw a J with your pinky.',
    // Down, then a hook toward +x.
    template: [
      { x: 0, y: 0 }, { x: 0, y: 0.55 }, { x: 0.05, y: 0.8 }, { x: 0.2, y: 0.95 },
      { x: 0.4, y: 1 }, { x: 0.58, y: 0.9 }, { x: 0.65, y: 0.72 },
    ],
    minSize: 0.45,
  },
  z: {
    id: 'z',
    tip: LM.INDEX_TIP,
    prompt: 'Now draw a Z with your index finger.',
    // Across toward +x, diagonally back and down, across again.
    template: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    minSize: 0.6,
  },
};

export function isMoveId(id: string): id is MoveId {
  return id === 'j' || id === 'z';
}

/** A landmark's position in the units this module uses. */
export function imagePoint(frame: HandFrame, landmark: number): Pt {
  return { x: frame.image[landmark].x * frame.aspect, y: frame.image[landmark].y };
}

/** Wrist to middle knuckle in the picture, the yardstick for stroke sizes. */
export function imagePalm(frame: HandFrame): number {
  const a = imagePoint(frame, LM.WRIST);
  const b = imagePoint(frame, LM.MIDDLE_MCP);
  return Math.hypot(b.x - a.x, b.y - a.y) || 1;
}

/**
 * Which way the thumb side of the hand lies in the picture: +1 right, -1 left,
 * 0 when the hand is edge-on and it can't be told. A J hooks toward the thumb
 * side, whichever hand signs it.
 */
export function thumbSide(frame: HandFrame): number {
  const dx = imagePoint(frame, LM.INDEX_MCP).x - imagePoint(frame, LM.PINKY_MCP).x;
  return Math.abs(dx) < 0.2 * imagePalm(frame) ? 0 : Math.sign(dx);
}

/**
 * Which way the letter's template +x should point in the picture.
 * J: toward the thumb side. Z: toward the signer's right, the picture's left.
 */
export function expectedSide(move: MoveSpec, thumb: number): number {
  return move.id === 'j' ? thumb : -1;
}

// ---- Shape matching ----

const N = 32;
/** Mean point distance (in drawing sizes) at which a stroke scores zero. */
const SCORE_SPAN = 0.35;
const MIN_SCORE = 0.4;

function length(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** The same path as `n` points spaced evenly along it. */
export function resample(pts: Pt[], n = N): Pt[] {
  const total = length(pts);
  if (pts.length < 2 || total === 0) return Array.from({ length: n }, () => ({ ...(pts[0] ?? { x: 0, y: 0 }) }));
  const step = total / (n - 1);
  const out: Pt[] = [{ ...pts[0] }];
  /** Distance still to travel before the next sample. */
  let need = step;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (seg >= need && seg > 0 && out.length < n) {
      const t = need / seg;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      seg -= need;
      need = step;
    }
    need -= seg;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

function bounds(pts: Pt[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { w: maxX - minX, h: maxY - minY, size: Math.max(maxX - minX, maxY - minY) };
}

/** Centred on its middle and scaled so its longer side is 1, keeping its proportions. */
function normalise(pts: Pt[]): Pt[] {
  const { size } = bounds(pts);
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const k = size || 1;
  return pts.map((p) => ({ x: (p.x - cx) / k, y: (p.y - cy) / k }));
}

function meanDistance(a: Pt[], b: Pt[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

const TEMPLATES: Record<MoveId, Pt[]> = {
  j: normalise(resample(MOVES.j.template)),
  z: normalise(resample(MOVES.z.template)),
};

export interface StrokeResult {
  ok: boolean;
  /** 0 to 1: how closely the drawing follows the letter. */
  score: number;
  /** The shape is right but drawn the other way round. It still counts. */
  mirrored: boolean;
  /** What to change, when it didn't match. */
  hint?: string;
}

/** The structural test for J, on a path turned so its hook should go toward +x. */
function jProblem(q: Pt[]): string | undefined {
  let low = 0;
  for (let i = 1; i < q.length; i++) if (q[i].y > q[low].y) low = i;
  const drop = q[low].y - q[0].y;
  if (drop < 0.55) return 'Start by moving your pinky straight down.';
  // The downstroke should be fairly straight until it nears the bottom.
  for (let i = 0; i < q.length && q[i].y - q[0].y < drop * 0.5; i++) {
    if (Math.abs(q[i].x - q[0].x) > 0.3) return 'Start by moving your pinky straight down.';
  }
  if (low < q.length * 0.35 || q[q.length - 1].x - q[0].x < 0.22) return 'Add the hook at the bottom.';
  // A hook is a turn. A hand just dropping diagonally keeps one direction and isn't a J.
  const n = q.length;
  const start = Math.atan2(q[Math.floor(n * 0.3)].y - q[0].y, q[Math.floor(n * 0.3)].x - q[0].x);
  const end = Math.atan2(q[n - 1].y - q[Math.floor(n * 0.8)].y, q[n - 1].x - q[Math.floor(n * 0.8)].x);
  let turn = Math.abs(end - start);
  if (turn > Math.PI) turn = 2 * Math.PI - turn;
  if (turn < (55 * Math.PI) / 180) return 'Add the hook at the bottom.';
  return undefined;
}

/** The structural test for Z, on a path turned so its first stroke should go toward +x. */
function zProblem(q: Pt[]): string | undefined {
  const all = 'Draw all three strokes: across, back down, across.';
  const n = q.length;
  let i1 = 0;
  for (let i = 1; i < Math.floor(n * 0.6); i++) if (q[i].x > q[i1].x) i1 = i;
  let i2 = i1;
  for (let i = i1 + 1; i < n; i++) if (q[i].x < q[i2].x) i2 = i;
  const first = q[i1].x - q[0].x;
  const back = q[i1].x - q[i2].x;
  const last = q[n - 1].x - q[i2].x;
  if (first < 0.45 || back < 0.45) return all;
  if (last < 0.45) return 'Add the last stroke across.';
  if (q[i2].y - q[i1].y < 0.3 || q[n - 1].y - q[0].y < 0.3) return 'Bring the middle stroke down as it goes back.';
  if (Math.abs(q[i1].y - q[0].y) > 0.4 || Math.abs(q[n - 1].y - q[i2].y) > 0.4) return 'Keep the top and bottom strokes level.';
  return undefined;
}

/**
 * Compares a drawn stroke with a letter. `side` is which way the letter should
 * face in the picture (+1, -1, or 0 when unknown); a correct shape facing the
 * other way matches with `mirrored` set. `palm` converts sizes to palm lengths.
 */
export function matchStroke(points: Pt[], move: MoveSpec, side: number, palm = 1): StrokeResult {
  const none = (hint?: string): StrokeResult => ({ ok: false, score: 0, mirrored: false, hint });
  if (points.length < 4) return none();
  if (bounds(points).size / palm < move.minSize) return none('Draw it bigger.');

  const q = normalise(resample(points));
  const facing = (s: number) => q.map((p) => ({ x: p.x * s, y: p.y }));
  const tpl = TEMPLATES[move.id];
  const problem = move.id === 'j' ? jProblem : zProblem;

  // Try the letter both ways round, and keep the better fit.
  const tries = [1, -1].map((s) => {
    const turned = facing(s);
    return { s, distance: meanDistance(turned, tpl), problem: problem(turned) };
  });
  tries.sort((a, b) => Number(!!a.problem) - Number(!!b.problem) || a.distance - b.distance);
  const best = tries[0];
  const score = Math.max(0, 1 - best.distance / SCORE_SPAN);
  if (best.problem) return { ok: false, score, mirrored: false, hint: best.problem };
  if (score < MIN_SCORE) return { ok: false, score, mirrored: false, hint: 'Not quite. Draw it again, a little slower.' };
  return { ok: true, score, mirrored: side !== 0 && best.s !== side };
}

// ---- Following a fingertip ----
//
// Starts and stops are judged by distance, not speed: tracking jitter makes
// speed unreliable, and a slow, careful drawing should count as much as a fast one.

export interface StrokeOptions {
  /** How long the starting handshape must be held in one place before drawing can start. */
  readyMs: number;
  /** The tip counts as "in one place" while it stays within this many palm lengths. */
  stillRadius: number;
  /** A stroke starts once the tip has moved this far (palm lengths) from where it was held. */
  startMove: number;
  /** Staying in one place this long ends the stroke. */
  pauseMs: number;
  /** A stroke that runs longer than this is judged as it stands. */
  maxMs: number;
  /** How long the hand or handshape may be lost before the stroke is dropped. */
  graceMs: number;
}

export const STROKE_DEFAULTS: StrokeOptions = {
  readyMs: 300,
  stillRadius: 0.1,
  startMove: 0.18,
  pauseMs: 450,
  maxMs: 4000,
  graceMs: 350,
};

export interface StrokeState {
  /** idle: waiting for the handshape. ready: held, draw now. drawing: a stroke is under way. */
  phase: 'idle' | 'ready' | 'drawing';
  /** The stroke so far (or the last one), for drawing on screen. */
  trail: Pt[];
  /** 0 to 1: how closely the stroke so far follows the letter. */
  progress: number;
  /** Set on the one update a stroke matches. */
  matched?: { mirrored: boolean };
  /** Why the last stroke didn't match, until the next one starts. */
  hint?: string;
}

const apart = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Follows one fingertip and reports when it has drawn the letter.
 * Feed it every frame: the tip (undefined if no hand), the palm size in the
 * picture, whether the starting handshape is being held, and the thumb side.
 */
export class StrokeTracker {
  private opts: StrokeOptions;
  private phase: StrokeState['phase'] = 'idle';
  /** Where the tip has been resting, and since when. */
  private rest?: { p: Pt; t: number };
  private trail: Pt[] = [];
  private startedAt = 0;
  private badSince?: number;
  private scale = 1;
  private side = 0;
  private hint?: string;
  private score = 0;

  constructor(readonly move: MoveSpec, opts: Partial<StrokeOptions> = {}) {
    this.opts = { ...STROKE_DEFAULTS, ...opts };
  }

  reset(): void {
    this.toIdle();
    this.trail = [];
  }

  private state(matched?: { mirrored: boolean }): StrokeState {
    return { phase: this.phase, trail: this.trail, progress: this.phase === 'drawing' ? this.score : 0, matched, hint: this.hint };
  }

  private toIdle(hint?: string): void {
    this.phase = 'idle';
    this.rest = undefined;
    this.badSince = undefined;
    this.hint = hint;
    this.score = 0;
  }

  /** Updates the resting place; returns how long the tip has stayed within `radius` of it. */
  private restingFor(tip: Pt, radius: number, now: number): number {
    if (!this.rest || apart(tip, this.rest.p) > radius) this.rest = { p: tip, t: now };
    return now - this.rest.t;
  }

  update(tip: Pt | undefined, palm: number, shapeOk: boolean, thumb: number, now: number): StrokeState {
    const o = this.opts;
    const unit = palm || 1;

    if (this.phase === 'idle') {
      if (!tip || !shapeOk) {
        this.rest = undefined;
      } else if (this.restingFor(tip, o.stillRadius * unit, now) >= o.readyMs) {
        this.phase = 'ready';
        this.badSince = undefined;
      }
      return this.state();
    }

    if (this.phase === 'ready') {
      if (!tip || !shapeOk) {
        this.badSince ??= now;
        if (now - this.badSince > o.graceMs) this.toIdle(this.hint);
        return this.state();
      }
      this.badSince = undefined;
      const from = this.rest!.p;
      if (apart(tip, from) >= o.startMove * unit) {
        this.phase = 'drawing';
        this.scale = unit;
        this.side = expectedSide(this.move, thumb);
        this.trail = [from, tip];
        this.startedAt = now;
        this.rest = { p: tip, t: now };
        this.hint = undefined;
        this.score = 0;
      }
      return this.state();
    }

    // drawing
    if (!tip) {
      this.badSince ??= now;
      if (now - this.badSince > o.graceMs) this.toIdle();
      return this.state();
    }
    if (!shapeOk) {
      this.badSince ??= now;
      // The handshape was dropped for good: judge what was drawn.
      if (now - this.badSince > o.graceMs * 2) return this.finish();
    } else {
      this.badSince = undefined;
    }

    if (apart(tip, this.trail[this.trail.length - 1]) >= 0.02 * this.scale) this.trail.push(tip);

    const r = this.judge();
    this.score = r.score;
    if (r.ok) {
      this.toIdle();
      return this.state({ mirrored: r.mirrored });
    }
    const paused = this.restingFor(tip, o.stillRadius * this.scale, now) >= o.pauseMs;
    if (paused || now - this.startedAt > o.maxMs) {
      // Resting with the handshape still held: ready for another go straight away.
      return this.finish(r, paused && shapeOk ? this.rest : undefined);
    }
    return this.state();
  }

  /**
   * Judges the trail so far. The letter may follow a lead-in (the hand moving
   * back to where it starts), so the later parts of the trail are tried too.
   * The whole trail's result is what gets reported when nothing matches.
   */
  private judge(): StrokeResult {
    const whole = matchStroke(this.trail, this.move, this.side, this.scale);
    if (whole.ok) return whole;
    for (const from of [0.15, 0.3, 0.45]) {
      const part = matchStroke(this.trail.slice(Math.floor(this.trail.length * from)), this.move, this.side, this.scale);
      if (part.ok) return part;
    }
    return whole;
  }

  /**
   * The stroke ended without matching. A twitch that never went anywhere is
   * dropped silently. With `restingAt`, the hand is waiting in place with the
   * handshape held, so the next stroke can start from there.
   */
  private finish(r: StrokeResult = this.judge(), restingAt?: { p: Pt; t: number }): StrokeState {
    const twitch = bounds(this.trail).size < 0.3 * this.scale;
    this.toIdle(twitch ? this.hint : r.hint ?? 'Not quite. Draw it again, a little slower.');
    if (restingAt) {
      this.phase = 'ready';
      this.rest = restingAt;
    }
    return this.state();
  }
}
