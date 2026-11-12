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

export interface LetterReading {
  letter: string;
  /**
   * False when the letter only matched loosely: a check the camera often
   * misreads (mostly where the thumb is) failed. That is how the fist letters
   * A, E, M, N, S and T get mixed up, so such a reading has to be held longer.
   */
  sure: boolean;
}

/**
 * The one letter this hand clearly is, or undefined when it's no letter or
 * could be more than one. Strict matches win over loose ones; a tie is no answer.
 */
export function readLetter(features: Features, letters: string[] = READABLE_LETTERS): LetterReading | undefined {
  const passing = letters.map((l) => judge(l, features, letters)).filter((j) => j.pass);
  if (passing.length === 1) return { letter: passing[0].target, sure: passing[0].passAll };
  const strict = passing.filter((j) => j.passAll);
  return strict.length === 1 ? { letter: strict[0].target, sure: true } : undefined;
}

export function classifyLetter(features: Features, letters: string[] = READABLE_LETTERS): string | undefined {
  return readLetter(features, letters)?.letter;
}

export interface ReaderOptions {
  /** How long a letter must be held steady before it types. */
  holdMs: number;
  /** The longer hold for a letter that only matched loosely (see LetterReading.sure). */
  unsureHoldMs: number;
  /** After typing, how long the hand must show something else (or nothing) before the next letter. */
  releaseMs: number;
  /**
   * How long the held letter may go unread before the hold starts to drain, and
   * how long a different letter must be read before it takes over. In time, not
   * frames, so a slow camera is judged like a fast one.
   */
  graceMs: number;
  /**
   * How fast a hold drains once the letter has gone unread for longer than
   * graceMs, as a share of how fast it fills. At 1 a letter has to be read more
   * than half the time to get anywhere, so a hand that only brushes a shape
   * now and then never types it.
   */
  drain: number;
}

export const READER_DEFAULTS: ReaderOptions = { holdMs: 900, unsureHoldMs: 1300, releaseMs: 300, graceMs: 130, drain: 1 };

/** The most time one frame may add to or take from a hold, so a stalled camera can't type or wipe a letter in one step. */
const MAX_STEP_MS = 250;

export interface ReaderState {
  /** The letter being held right now, if any. */
  letter?: string;
  /** 0 to 1 toward typing it. */
  progress: number;
  /** True after a letter typed, until the hand changes. */
  waitingForRelease: boolean;
  /** Set on the one frame a letter is typed. */
  typed?: string;
  /** True while the held letter is mostly a loose match, so it is being held for longer. */
  unsure?: boolean;
}

/**
 * Turns per-frame letter readings into deliberate key presses:
 *  - a letter types once it has been read for holdMs in all;
 *  - a wobble doesn't restart the hold. While the letter goes unread the hold
 *    pauses for graceMs, then drains; when the letter comes back it carries on
 *    from what is left. Only time the letter was actually read counts;
 *  - a different letter read for longer than graceMs takes over, and starts
 *    its own hold from nothing;
 *  - after typing, nothing types until the hand changes shape or drops for
 *    releaseMs, so one long hold types one letter, and a double letter needs a
 *    small bounce;
 *  - a letter that only matched loosely needs a longer hold, in proportion to
 *    how much of the hold was loose.
 */
export class LetterReader {
  private opts: ReaderOptions;
  private candidate?: string;
  /** Time the candidate has been read, less what has drained, and how much of that was a loose match. */
  private heldMs = 0;
  private unsureMs = 0;
  /** Time since the candidate was last read. */
  private lostMs = 0;
  /** A different letter being read instead of the candidate, and for how long without the candidate in between. */
  private rival?: string;
  private rivalMs = 0;
  private rivalUnsureMs = 0;
  /** When the last frame came. */
  private last?: number;
  private lastTyped?: string;
  /** Readings that count as still holding the letter just typed. */
  private held = new Set<string>();
  private releaseSince?: number;
  private needRelease = false;

  constructor(opts: Partial<ReaderOptions> = {}) {
    this.opts = { ...READER_DEFAULTS, ...opts };
  }

  reset(): void {
    this.hold(undefined);
    this.last = undefined;
    this.needRelease = false;
    this.releaseSince = undefined;
    this.lastTyped = undefined;
  }

  /** Starts holding `letter` (or nothing), with any time it has already been read. */
  private hold(letter: string | undefined, heldMs = 0, unsureMs = 0): void {
    this.candidate = letter;
    this.heldMs = heldMs;
    this.unsureMs = unsureMs;
    this.lostMs = 0;
    this.rival = undefined;
    this.rivalMs = 0;
    this.rivalUnsureMs = 0;
  }

  /** One frame of the hold: the candidate was read, something else was, or nothing was. */
  private step(letter: string | undefined, sure: boolean, dt: number): void {
    if (!this.candidate) {
      this.hold(letter, 0, 0);
      return;
    }
    if (letter === this.candidate) {
      this.heldMs += dt;
      if (!sure) this.unsureMs += dt;
      this.lostMs = 0;
      this.rival = undefined;
      return;
    }
    this.lostMs += dt;
    if (letter) {
      if (letter === this.rival) {
        this.rivalMs += dt;
        if (!sure) this.rivalUnsureMs += dt;
      } else {
        this.rival = letter;
        this.rivalMs = 0;
        this.rivalUnsureMs = 0;
      }
      if (this.rivalMs > this.opts.graceMs) {
        this.hold(this.rival, this.rivalMs, this.rivalUnsureMs);
        return;
      }
    }
    if (this.lostMs <= this.opts.graceMs) return;
    const loose = this.heldMs > 0 ? this.unsureMs / this.heldMs : 0;
    this.heldMs -= dt * this.opts.drain;
    this.unsureMs = Math.max(0, this.heldMs) * loose;
    if (this.heldMs <= 0) this.hold(this.rival, this.rivalMs, this.rivalUnsureMs);
  }

  update(letter: string | undefined, now: number, sure = true): ReaderState {
    const dt = this.last === undefined ? 0 : Math.min(Math.max(now - this.last, 0), MAX_STEP_MS);
    this.last = now;
    if (this.needRelease) {
      if (!letter || !this.held.has(letter)) {
        this.releaseSince ??= now;
        if (now - this.releaseSince >= this.opts.releaseMs) {
          this.needRelease = false;
          this.releaseSince = undefined;
          this.hold(undefined);
        }
      } else {
        this.releaseSince = undefined;
      }
      if (this.needRelease) return { letter: this.lastTyped, progress: 0, waitingForRelease: true };
    }

    this.step(letter, sure, dt);

    if (!this.candidate) return { progress: 0, waitingForRelease: false };
    // The very first frame of a hold has no time behind it yet, so judge it by itself.
    const loose = this.heldMs > 0 ? this.unsureMs / this.heldMs : sure ? 0 : 1;
    const need = this.opts.holdMs + (this.opts.unsureHoldMs - this.opts.holdMs) * loose;
    const progress = Math.min(1, this.heldMs / need);
    if (progress < 1) return { letter: this.candidate, progress, waitingForRelease: false, unsure: loose > 0.5 };

    const typed = this.candidate;
    this.lastTyped = typed;
    this.held = new Set([typed]);
    this.needRelease = true;
    this.releaseSince = undefined;
    this.hold(undefined);
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
    this.hold(undefined);
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

    const read = moving || drawing ? undefined : readLetter(features);
    const state = this.reader.update(read?.letter, now, read?.sure ?? true);
    if (state.typed) this.lastStill = { letter: state.typed, at: now };
    return { ...state, drawing, trail };
  }
}

/**
 * Above this speed, in hand lengths a second, the hand is traveling between
 * letters and readings are ignored. (It was 0.06 a frame, which is this at 30
 * frames a second; a slower camera saw the same movement as twice as fast.)
 */
export const MOVING_SPEED = 1.8;

/** Whether the hand is traveling too fast to read, given the time between the two frames. */
export function isMoving(prev: { x: number; y: number }[] | undefined, next: { x: number; y: number }[], dtMs: number): boolean {
  if (!(dtMs > 0)) return false;
  return handMotion(prev, next) / (Math.min(dtMs, MAX_STEP_MS) / 1000) > MOVING_SPEED;
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
