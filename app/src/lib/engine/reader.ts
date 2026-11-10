// Open letter reading for games: works out which letter the hand is making
// (not just "is it the target?") and types it only when the learner clearly
// means it. Passing shapes, wobbles and one long hold must not type letters.
import type { Features } from './features';
import { judge, SPECS } from './handshapes';

/** Letters the camera can read from a still hand. J and Z need movement, so they're typed by key. */
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
  /** 0 to 1 towards typing it. */
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
      if (letter !== this.lastTyped) {
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
    this.needRelease = true;
    this.releaseSince = undefined;
    this.candidate = undefined;
    return { letter: typed, progress: 1, waitingForRelease: true, typed };
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
