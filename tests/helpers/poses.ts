// Test-side poses. The tidy pose for each sign lives in the app (it also draws
// the camera guide); here are the awkward ones that real hands make.
import { STRAIGHT, front, mid, type FingerPose, type Pose } from './synthHand';
import { fist4, palmIn, POSES, sThumb } from '../../app/src/lib/engine/poses';
import type { Point } from '../../app/src/lib/engine/geometry';

export { POSES };

type Pts = Record<string, Point>;
const s = (spread: number): FingerPose => [0, 4, 4, spread];
const tThumb = (p: Pts) => front(mid(p.indexPip, p.middlePip, 0.5), -0.004);
/** A fairly straight thumb laid across the palm, holding the folded fingers. */
const thumbAcrossPalm = { line: [-0.7, -0.7, -0.5] as [number, number, number] };

/**
 * Closer to real hands than the tidy poses, for look-alike and strictness tests.
 *
 * - A real T rests the index on the thumb, so its knuckle bends much less than a
 *   fist's. A lazy X doesn't raise the index all the way.
 * - In K and P the middle finger is straight but angled far forward at the knuckle.
 * - In 1 the thumb rests right by the folded middle fingertip.
 * - In 2 and 4 the thumb lies across the palm, as far from the hand's long axis as
 *   a thumb stuck out to the side.
 * - Ring and pinky fingers curve a little even when held up, and the middle and
 *   ring fingers barely separate.
 */
export const REAL: Record<string, Pose> = {
  t: { fingers: { ...fist4, index: [50, 95, 45, 0] }, thumb: { to: tThumb } },
  tLoose: { fingers: { ...fist4, index: [60, 90, 40, 0] }, thumb: { to: tThumb } },
  tHigh: { fingers: { ...fist4, index: [45, 95, 45, 0] }, thumb: { to: tThumb } },
  xLazy: { fingers: { ...fist4, index: [35, 90, 60, 0] }, thumb: { to: sThumb } },
  kSteep: { ...POSES.k, fingers: { ...POSES.k.fingers, middle: [80, 12, 8, -12] } },
  pSteep: { ...POSES.p, fingers: { ...POSES.p.fingers, middle: [85, 12, 8, -12] }, transforms: [{ rotateX: 80 }] },
  // Seen from above, the tracker under-reads the hidden ring and pinky and guesses at the index.
  pHidden: {
    fingers: { index: [15, 40, 30, 4], middle: [75, 10, 5, -12], ring: [50, 45, 15, 0], pinky: [50, 40, 15, 0] },
    thumb: POSES.p.thumb,
    transforms: [{ rotateX: 100 }],
  },
  one: {
    fingers: { ...fist4, index: STRAIGHT },
    thumb: { to: (p) => front(mid(p.middleDip, p.middleTip), 0.008) },
    transforms: palmIn,
  },
  two: { fingers: POSES['2'].fingers, thumb: thumbAcrossPalm, transforms: palmIn },
  four: {
    fingers: { index: s(12), middle: s(2), ring: [8, 32, 30, -6], pinky: [10, 38, 32, -14] },
    thumb: thumbAcrossPalm,
    transforms: palmIn,
  },
  fiveRelaxed: {
    fingers: { index: s(10), middle: s(2), ring: s(-3), pinky: [8, 35, 30, -14] },
    thumb: { line: [1, -0.6, 0] },
    transforms: palmIn,
  },
};

/** Signs that share a handshape and orientation in ASL, so they may match each other. */
export const TWINS: Record<string, string[]> = {
  o: ['0'],
  '0': ['o'],
  f: ['9'],
  '9': ['f'],
  w: ['6'],
  '6': ['w'],
  // J starts in the I handshape; its movement is what makes it J.
  j: ['i'],
};
