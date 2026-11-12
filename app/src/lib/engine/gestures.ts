// Hand gestures that work a keyboard's Enter and Delete keys, for typing by
// camera: thumbs up enters, thumbs down deletes. They are everyday gestures,
// not ASL letters, and they were chosen because no letter looks like them.
// (The "OK" ring of thumb and index finger is the letter F, so it can't be Enter.)
import type { Features } from './features';
import { FINGERS, type HandFrame } from './hand';

export type Command = 'enter' | 'delete';

export function isCommand(s: string | undefined): s is Command {
  return s === 'enter' || s === 'delete';
}

/** Tunable thresholds. */
export const GESTURE = {
  /** Least bend for each of the four fingers: a fist, allowing for fingers the camera half sees. */
  curledMin: 100,
  /** Most bend in the thumb: it must be held out straight. */
  thumbStraightMax: 65,
  /**
   * How far the thumb tip must clear the rest of the hand, above it (thumbs up)
   * or below it (thumbs down), in palm lengths as seen on screen. In the letter
   * A the thumb lies beside the fist and barely clears the knuckles.
   */
  clearBy: 0.38,
};

/**
 * The command this hand is giving, if any: a fist with the thumb held straight
 * and standing clear of it, pointing up (enter) or down (delete).
 */
export function classifyCommand(_frame: HandFrame, f: Features): Command | undefined {
  if (f.thumbDirection === 'side' || f.thumbBend > GESTURE.thumbStraightMax) return undefined;
  if (FINGERS.some((finger) => f.curl[finger] < GESTURE.curledMin)) return undefined;
  // How far the thumb clears the fist is measured with the other features (Features.thumbClear).
  if (f.thumbDirection === 'up' && f.thumbClear.up >= GESTURE.clearBy) return 'enter';
  if (f.thumbDirection === 'down' && f.thumbClear.down >= GESTURE.clearBy) return 'delete';
  return undefined;
}
