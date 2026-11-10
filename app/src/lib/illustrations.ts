// Poses for the drawn hand illustrations of the manual alphabet and numbers.
// These are simplified drawings, not photos: a right hand seen from the
// front, palm toward the viewer unless the sign rotates it. They give every
// letter and number a picture until real media is added to the content folder.

/** What one finger is doing. */
export type FingerState =
  | 'up' // straight
  | 'curl' // folded into the palm
  | 'bent' // bent down at the joints, tips resting low (E)
  | 'hook' // raised with the tip hooked (X)
  | 'pinch'; // folded to meet the thumb tip

/** What the thumb is doing. */
export type ThumbState =
  | 'side' // resting up along the side of the fist (A)
  | 'across' // folded across the palm
  | 'acrossHigh' // across the folded fingers (S, D, X)
  | 'acrossLow' // folded low on the palm (B, 4, E)
  | 'out' // straight out to the side (L, Y, 5)
  | 'up' // pointing straight up from a fist (10)
  | 'between' // up between index and middle (K, P)
  | 'along' // parallel with the index finger (G, Q)
  | 'pinch' // meeting a fingertip, set by the pinching finger
  | 'tuckT'
  | 'tuckN'
  | 'tuckM';

export type Motion = 'j' | 'z' | 'shake';

export interface HandPose {
  /** index, middle, ring, pinky */
  fingers: [FingerState, FingerState, FingerState, FingerState];
  /** Lean of each finger in degrees, negative toward the thumb. */
  spread?: [number, number, number, number];
  thumb: ThumbState;
  /** Whole-hand rotation in degrees, clockwise. */
  rotate?: number;
  /** A drawn shape that the finger model can't express. */
  shape?: 'c' | 'o';
  motion?: Motion;
  /** Short note shown under the drawing. */
  note?: string;
}

const C = 'curl' as const;
const U = 'up' as const;

export const POSES: Record<string, HandPose> = {
  a: { fingers: [C, C, C, C], thumb: 'side' },
  b: { fingers: [U, U, U, U], thumb: 'acrossLow' },
  c: { fingers: [C, C, C, C], thumb: 'side', shape: 'c' },
  d: { fingers: [U, C, C, C], thumb: 'acrossHigh' },
  e: { fingers: ['bent', 'bent', 'bent', 'bent'], thumb: 'acrossLow' },
  f: { fingers: ['pinch', U, U, U], spread: [0, -2, 4, 10], thumb: 'pinch' },
  g: { fingers: [U, C, C, C], thumb: 'along', rotate: 90, note: 'Points sideways' },
  h: { fingers: [U, U, C, C], spread: [-1, 1, 0, 0], thumb: 'acrossHigh', rotate: 90, note: 'Points sideways' },
  i: { fingers: [C, C, C, U], spread: [0, 0, 0, 6], thumb: 'acrossHigh' },
  j: { fingers: [C, C, C, U], spread: [0, 0, 0, 6], thumb: 'acrossHigh', motion: 'j', note: 'Trace a J with the pinky' },
  k: { fingers: [U, U, C, C], spread: [-6, 16, 0, 0], thumb: 'between' },
  l: { fingers: [U, C, C, C], thumb: 'out' },
  m: { fingers: [C, C, C, C], thumb: 'tuckM', note: 'Thumb under three fingers' },
  n: { fingers: [C, C, C, C], thumb: 'tuckN', note: 'Thumb under two fingers' },
  o: { fingers: [C, C, C, C], thumb: 'side', shape: 'o' },
  p: { fingers: [U, U, C, C], spread: [-6, 16, 0, 0], thumb: 'between', rotate: 150, note: 'Points down' },
  q: { fingers: [U, C, C, C], thumb: 'along', rotate: 160, note: 'Points down' },
  r: { fingers: [U, U, C, C], spread: [14, -13, 0, 0], thumb: 'acrossHigh', note: 'Fingers crossed' },
  s: { fingers: [C, C, C, C], thumb: 'acrossHigh' },
  t: { fingers: [C, C, C, C], thumb: 'tuckT', note: 'Thumb under the index' },
  u: { fingers: [U, U, C, C], spread: [-1, 1, 0, 0], thumb: 'acrossHigh' },
  v: { fingers: [U, U, C, C], spread: [-11, 11, 0, 0], thumb: 'acrossHigh' },
  w: { fingers: [U, U, U, C], spread: [-14, 0, 14, 0], thumb: 'acrossHigh' },
  x: { fingers: ['hook', C, C, C], thumb: 'acrossHigh' },
  y: { fingers: [C, C, C, U], spread: [0, 0, 0, 22], thumb: 'out' },
  z: { fingers: [U, C, C, C], thumb: 'acrossHigh', motion: 'z', note: 'Draw a Z in the air' },

  '0': { fingers: [C, C, C, C], thumb: 'side', shape: 'o' },
  '1': { fingers: [U, C, C, C], thumb: 'acrossHigh', note: 'Palm faces you' },
  '2': { fingers: [U, U, C, C], spread: [-11, 11, 0, 0], thumb: 'acrossHigh', note: 'Palm faces you' },
  '3': { fingers: [U, U, C, C], spread: [-8, 8, 0, 0], thumb: 'out', note: 'Palm faces you' },
  '4': { fingers: [U, U, U, U], spread: [-12, -4, 5, 14], thumb: 'acrossLow', note: 'Palm faces you' },
  '5': { fingers: [U, U, U, U], spread: [-12, -4, 5, 14], thumb: 'out', note: 'Palm faces you' },
  '6': { fingers: [U, U, U, 'pinch'], spread: [-12, 0, 12, 0], thumb: 'pinch', note: 'Thumb meets pinky' },
  '7': { fingers: [U, U, 'pinch', U], spread: [-12, -2, 0, 16], thumb: 'pinch', note: 'Thumb meets ring finger' },
  '8': { fingers: [U, 'pinch', U, U], spread: [-14, 0, 8, 16], thumb: 'pinch', note: 'Thumb meets middle finger' },
  '9': { fingers: ['pinch', U, U, U], spread: [0, -2, 4, 10], thumb: 'pinch', note: 'Thumb meets index' },
  '10': { fingers: [C, C, C, C], thumb: 'up', motion: 'shake', note: 'Shake slightly' },
};

export function hasIllustration(id: string): boolean {
  return id in POSES;
}
