// Hand gestures that work a keyboard's Enter and Delete keys, for typing by
// camera: thumbs up enters, thumbs down deletes. They are everyday gestures,
// not ASL letters, and they were chosen because no letter looks like them.
// (The "OK" ring of thumb and index finger is the letter F, so it can't be Enter.)
import type { Features } from './features';
import { dist } from './geometry';
import { screenScale } from './guide';
import { FINGERS, LM, type HandFrame } from './hand';

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

/** Landmarks of the thumb's free part, left out when measuring "the rest of the hand". */
const THUMB_FREE = new Set<number>([LM.THUMB_MCP, LM.THUMB_IP, LM.THUMB_TIP]);

/**
 * The command this hand is giving, if any: a fist with the thumb held straight
 * and standing clear of it, pointing up (enter) or down (delete).
 */
export function classifyCommand(frame: HandFrame, f: Features): Command | undefined {
  if (f.thumbDirection === 'side' || f.thumbBend > GESTURE.thumbStraightMax) return undefined;
  if (FINGERS.some((finger) => f.curl[finger] < GESTURE.curledMin)) return undefined;

  // The palm's real length on screen, even when the fist points at the camera.
  const palm = screenScale(frame) * dist(frame.world[LM.WRIST], frame.world[LM.MIDDLE_MCP]);
  if (!(palm > 0)) return undefined;
  let top = Infinity;
  let bottom = -Infinity;
  frame.image.forEach((p, i) => {
    if (THUMB_FREE.has(i)) return;
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  });
  const tip = frame.image[LM.THUMB_TIP].y;
  if (f.thumbDirection === 'up' && (top - tip) / palm >= GESTURE.clearBy) return 'enter';
  if (f.thumbDirection === 'down' && (tip - bottom) / palm >= GESTURE.clearBy) return 'delete';
  return undefined;
}
