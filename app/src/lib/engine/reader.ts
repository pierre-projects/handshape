// Open letter reading for games: works out which letter the hand is making
// (not just "is it the target?") and types it only when the learner clearly
// means it. Passing shapes, wobbles and one long hold must not type letters.
import type { Features } from './features';
import { classifyCommand, isCommand, type Command } from './gestures';
import type { HandFrame } from './hand';
import { evaluate, judge, SPECS } from './handshapes';
import { imagePalm, imagePoint, MOVES, StrokeTracker, thumbSide, type MoveId, type Pt } from './movement';

/** Letters the camera can read from a still hand. J and Z are drawn in the air; see CameraTyper. */
export const READABLE_LETTERS = [...'abcdefghiklmnopqrstuvwxy'].filter((l) => SPECS.has(l));

/**
 * The one letter this hand clearly is, or undefined when it's no letter or
 * could be more than one. Strict matches win over loose ones; a tie is no answer.
 */
export function classifyLetter(features: Features, letters: string[] = READABLE_LETTERS): string | undefined {
  const passing = letters.map((l) => judge(l, features, letters)).filter((j) => j.pass);
  if (passing.length === 1) return passing[0].target;
  const strict = passing.filter((j) => j.passAll);
  return strict.length === 1 ? strict[0].target : undefined;
}

export interface ReaderOptions {
  /** How long a letter must be held steady before it types. */
  holdMs: number;
  /** After typing, how long the hand must show something else (or nothing) before the next letter. */
  releaseMs: number;
  /** Frames of a different reading forgiven while holding, for tracking flicker. */
  graceFrames: number;
}

export const READER_DEFAULTS: ReaderOptions = { holdMs: 900, releaseMs: 300, graceFrames: 3 };

export interface ReaderState {
  /** The letter being held right now, if any. */
  letter?: string;
  /** 0 to 1 toward typing it. */
  progress: number;
  /** True after a letter typed, until the hand changes. */
  waitingForRelease: boolean;
  /** Set on the one frame a letter is typed. */
  typed?: string;
}

/**
 * Turns per-frame letter readings into deliberate key presses:
 *  - a letter types only after it's held steady for holdMs;
 *  - then nothing types until the hand changes shape or drops for releaseMs,
 *    so one long hold types one letter, and a double letter needs a small bounce;
 *  - a reading that flickers for a frame or two doesn't restart the hold.
 */
export class LetterReader {
  private opts: ReaderOptions;
  private candidate?: string;
  private since = 0;
  private misses = 0;
  private lastTyped?: string;
  /** Readings that count as still holding the letter just typed. */
  private held = new Set<string>();
  private releaseSince?: number;
  private needRelease = false;

  constructor(opts: Partial<ReaderOptions> = {}) {
    this.opts = { ...READER_DEFAULTS, ...opts };
  }

  reset(): void {
    this.candidate = undefined;
    this.misses = 0;
    this.needRelease = false;
    this.releaseSince = undefined;
    this.lastTyped = undefined;
  }

  update(letter: string | undefined, now: number): ReaderState {
    if (this.needRelease) {
      if (!letter || !this.held.has(letter)) {
        this.releaseSince ??= now;
        if (now - this.releaseSince >= this.opts.releaseMs) {
          this.needRelease = false;
          this.releaseSince = undefined;
          this.candidate = undefined;
        }
      } else {
        this.releaseSince = undefined;
      }
      if (this.needRelease) return { letter: this.lastTyped, progress: 0, waitingForRelease: true };
    }

    if (letter && letter === this.candidate) {
      this.misses = 0;
    } else if (this.candidate && ++this.misses <= this.opts.graceFrames) {
      // Forgive a short flicker: keep holding the same candidate.
    } else {
      this.candidate = letter;
      this.since = now;
      this.misses = 0;
    }

    if (!this.candidate) return { progress: 0, waitingForRelease: false };
    const progress = Math.min(1, (now - this.since) / this.opts.holdMs);
    if (progress < 1) return { letter: this.candidate, progress, waitingForRelease: false };

    const typed = this.candidate;
    this.lastTyped = typed;
    this.held = new Set([typed]);
    this.needRelease = true;
    this.releaseSince = undefined;
    this.candidate = undefined;
    return { letter: typed, progress: 1, waitingForRelease: true, typed };
  }

  /**
   * A letter was typed another way (drawn in the air). Nothing else types
   * until the hand leaves that letter's handshapes, `sameAs`: after a J, the
   * still-held I handshape must not go on to type an I.
   */
  typedNow(letter: string, sameAs: string[] = []): void {
    this.lastTyped = letter;
    this.held = new Set([letter, ...sameAs]);
    this.needRelease = true;
    this.releaseSince = undefined;
    this.candidate = undefined;
    this.misses = 0;
  }
}

/** The still letters a drawn letter starts from. (L and Y have the thumb out, so they start neither.) */
const STARTS_FROM: Record<MoveId, string[]> = { j: ['i'], z: ['d'] };
/**
 * How big a fingertip's trail must be, in palm lengths, before its stroke
 * counts as a letter being drawn. Until then still letters keep being read, so
 * a hand that sways while holding I or D still types it instead of being
 * stuck on "Drawing…". Size is the longer side of the box the trail fits in:
 * a sway out and back travels a long way but covers little.
 */
export const DRAWING_MIN = 0.45;

/** The longer side of the box a trail fits in. */
function extent(trail: Pt[]): number {
  if (!trail.length) return 0;
  const xs = trail.map((p) => p.x);
  const ys = trail.map((p) => p.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
/** A drawn letter replaces its starting letter if that was typed this recently. */
const REPLACE_WINDOW_MS = 3000;

export interface TyperState extends ReaderState {
  /**
   * Set on the one frame a command gesture has been held long enough: thumbs up
   * (enter) or thumbs down (delete). While one is being held, `letter` names it.
   */
  command?: Command;
  /** The letter being drawn in the air right now, if any. */
  drawing?: MoveId;
  /** The fingertip's trail while drawing, for showing on screen. */
  trail: Pt[];
  /**
   * With `typed`: the still letter typed just before from the same handshape
   * (I before J, D before Z). The drawn letter should replace it, not follow it.
   */
  replaces?: string;
}

/**
 * Everything the camera can type: still letters held steady (LetterReader), J
 * and Z drawn in the air (StrokeTracker), and the two command gestures, thumbs
 * up for enter and thumbs down for delete (gestures.ts), which are held like a
 * letter. While a letter is being drawn, still letters don't type, and a drawn
 * letter isn't followed by its own handshape.
 */
export class CameraTyper {
  private reader: LetterReader;
  private strokes = [new StrokeTracker(MOVES.j), new StrokeTracker(MOVES.z)];
  private lastStill?: { letter: string; at: number };

  constructor(opts: Partial<ReaderOptions> = {}) {
    this.reader = new LetterReader(opts);
  }

  reset(): void {
    this.reader.reset();
    this.strokes.forEach((s) => s.reset());
    this.lastStill = undefined;
  }

  /**
   * One camera frame. `frame` and `features` are undefined when no hand is in
   * view. `moving` is true while the whole hand is traveling fast. With
   * `letters` false only the command gestures are read, for when there is no
   * room for another letter but the word still has to be entered or fixed.
   */
  update(
    frame: HandFrame | undefined,
    features: Features | undefined,
    moving: boolean,
    now: number,
    { letters = true }: { letters?: boolean } = {},
  ): TyperState {
    if (!frame || !features) {
      this.strokes.forEach((s) => s.update(undefined, 1, false, 0, now));
      return { ...this.reader.update(undefined, now), trail: [] };
    }

    // A command gesture is held like a letter, and nothing else is read while it shows.
    const command = moving ? undefined : classifyCommand(frame, features);
    if (command || !letters) {
      this.strokes.forEach((s) => s.reset());
      const state = this.reader.update(command, now);
      if (!isCommand(state.typed)) return { ...state, trail: [] };
      this.lastStill = undefined;
      return { ...state, typed: undefined, command: state.typed, trail: [] };
    }

    let drawing: MoveId | undefined;
    let trail: Pt[] = [];
    const palm = imagePalm(frame);
    for (const stroke of this.strokes) {
      const id = stroke.move.id;
      const st = stroke.update(imagePoint(frame, stroke.move.tip), palm, evaluate(id, features).pass, thumbSide(frame), now);
      if (st.matched) {
        const before = this.lastStill;
        const replaces =
          before && STARTS_FROM[id].includes(before.letter) && now - before.at <= REPLACE_WINDOW_MS ? before.letter : undefined;
        this.reader.typedNow(id, STARTS_FROM[id]);
        this.strokes.forEach((s) => s.reset());
        this.lastStill = undefined;
        return { letter: id, progress: 1, waitingForRelease: true, typed: id, replaces, trail: st.trail };
      }
      if (st.phase === 'drawing' && extent(st.trail) >= DRAWING_MIN * palm) {
        drawing = id;
        trail = st.trail;
      }
    }

    const state = this.reader.update(moving || drawing ? undefined : classifyLetter(features), now);
    if (state.typed) this.lastStill = { letter: state.typed, at: now };
    return { ...state, drawing, trail };
  }
}

/**
 * How far the hand moved since the last frame, as a share of its own size.
 * Fast movement means the hand is between letters, so readings are ignored.
 */
export function handMotion(prev: { x: number; y: number }[] | undefined, next: { x: number; y: number }[]): number {
  if (!prev || prev.length !== next.length) return 0;
  const size = Math.hypot(next[0].x - next[9].x, next[0].y - next[9].y) || 1;
  let sum = 0;
  for (let i = 0; i < next.length; i++) sum += Math.hypot(next[i].x - prev[i].x, next[i].y - prev[i].y);
  return sum / next.length / size;
}
