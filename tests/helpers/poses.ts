// Model-hand poses for each checkable sign, used by the handshape tests.
import { FIST, STRAIGHT, front, mid, type FingerPose, type Pose } from './synthHand';
import type { Point } from '../../app/src/lib/engine/geometry';

type Pts = Record<string, Point>;
const fist4 = { index: FIST, middle: FIST, ring: FIST, pinky: FIST };
const s = (spread: number): FingerPose => [0, 4, 4, spread];
/** Thumb across the front of the folded index and middle fingers, as in S. */
const sThumb = (p: Pts) => front(mid(mid(p.indexPip, p.indexDip), mid(p.middlePip, p.middleDip), 0.6), 0.012);
const palmThumb = () => ({ x: -0.005, y: -0.06, z: -0.015 });
const sideways = [{ rotateZ: 90 }, { rotateY: 180 }];
const palmIn = [{ rotateY: 180 }];

const g: Pose = { fingers: { ...fist4, index: STRAIGHT }, thumb: { line: [0.05, -1, 0] }, transforms: sideways };
const k: Pose = {
  fingers: { index: s(4), middle: [35, 10, 5, -12], ring: FIST, pinky: FIST },
  thumb: { to: (p) => front(p.middlePip, 0.006) },
};
const o: Pose = {
  fingers: { index: [45, 60, 35, 2], middle: [45, 60, 35, 0], ring: [45, 60, 35, -2], pinky: [45, 60, 35, -4] },
  thumb: { to: (p) => front(mid(p.indexTip, p.middleTip), 0.004) },
};
const f: Pose = {
  fingers: { index: [40, 60, 30, 0], middle: s(0), ring: s(-6), pinky: s(-12) },
  thumb: { to: (p) => front(p.indexTip, 0.006) },
};
const v: Pose = {
  fingers: { index: s(8), middle: s(-10), ring: FIST, pinky: FIST },
  thumb: { to: (p) => front(p.ringPip, 0.01) },
};
const w: Pose = {
  fingers: { index: s(14), middle: s(0), ring: s(-14), pinky: FIST },
  thumb: { to: (p) => front(p.pinkyTip, 0.006) },
};
const a: Pose = { fingers: fist4, thumb: { line: [0.15, -1, 0] } };
const one: Pose = { fingers: { ...fist4, index: STRAIGHT }, thumb: { to: sThumb }, transforms: palmIn };

export const POSES: Record<string, Pose> = {
  a,
  b: { fingers: { index: s(2), middle: s(0), ring: s(-2), pinky: s(-4) }, thumb: { to: palmThumb } },
  c: {
    fingers: { index: [40, 40, 20, 2], middle: [40, 40, 20, 0], ring: [40, 40, 20, -2], pinky: [40, 40, 20, -4] },
    thumb: { to: (p) => ({ ...p.indexTip, y: p.indexTip.y + 0.045 }) },
  },
  d: {
    fingers: { index: STRAIGHT, middle: [60, 80, 40, 0], ring: FIST, pinky: FIST },
    thumb: { to: (p) => front(p.middleTip, 0.006) },
  },
  e: {
    fingers: { index: [25, 110, 70, 0], middle: [25, 110, 70, 0], ring: [25, 110, 70, 0], pinky: [25, 110, 70, 0] },
    thumb: { to: (p) => front({ ...mid(p.indexTip, p.ringTip), y: mid(p.indexTip, p.ringTip).y + 0.01 }, 0.008) },
  },
  f,
  g,
  h: {
    fingers: { index: s(1), middle: s(-1), ring: FIST, pinky: FIST },
    thumb: { to: (p) => front(p.ringPip, 0.01) },
    transforms: sideways,
  },
  i: { fingers: { ...fist4, pinky: STRAIGHT }, thumb: { to: sThumb } },
  j: { fingers: { ...fist4, pinky: STRAIGHT }, thumb: { to: sThumb } },
  k,
  l: { fingers: { ...fist4, index: STRAIGHT }, thumb: { line: [1, -0.15, 0] } },
  m: { fingers: fist4, thumb: { to: (p) => front(mid(p.ringPip, p.pinkyPip), -0.004) } },
  n: { fingers: fist4, thumb: { to: (p) => front(mid(p.middlePip, p.ringPip), -0.004) } },
  o,
  p: { ...k, transforms: [{ rotateZ: 180 }] },
  q: { fingers: { ...fist4, index: STRAIGHT }, thumb: { line: [0.05, -1, 0] }, transforms: [{ rotateZ: 180 }] },
  r: {
    fingers: { index: s(-8), middle: s(10), ring: FIST, pinky: FIST },
    thumb: { to: (p) => front(p.ringPip, 0.01) },
  },
  s: { fingers: fist4, thumb: { to: sThumb } },
  t: { fingers: fist4, thumb: { to: (p) => front(mid(p.indexPip, p.middlePip, 0.5), -0.004) } },
  u: {
    fingers: { index: s(1), middle: s(-1), ring: FIST, pinky: FIST },
    thumb: { to: (p) => front(p.ringPip, 0.01) },
  },
  v,
  w,
  x: { fingers: { ...fist4, index: [20, 90, 60, 0] }, thumb: { to: sThumb } },
  y: { fingers: { ...fist4, pinky: s(-15) }, thumb: { line: [1, -0.3, 0] } },
  z: { fingers: { ...fist4, index: STRAIGHT }, thumb: { to: sThumb } },
  '0': o,
  '1': one,
  '2': { ...v, transforms: palmIn },
  '3': {
    fingers: { index: s(12), middle: s(-6), ring: FIST, pinky: FIST },
    thumb: { line: [1, -0.4, 0] },
    transforms: palmIn,
  },
  '4': { fingers: { index: s(16), middle: s(0), ring: s(-10), pinky: s(-20) }, thumb: { to: palmThumb }, transforms: palmIn },
  '5': { fingers: { index: s(20), middle: s(2), ring: s(-14), pinky: s(-28) }, thumb: { line: [1, -0.3, 0] }, transforms: palmIn },
  '6': w,
  '7': {
    fingers: { index: s(8), middle: s(0), ring: [50, 70, 30, -4], pinky: s(-14) },
    thumb: { to: (p) => front(p.ringTip, 0.006) },
  },
  '8': {
    fingers: { index: s(8), middle: [50, 70, 30, 0], ring: s(-6), pinky: s(-14) },
    thumb: { to: (p) => front(p.middleTip, 0.006) },
  },
  '9': f,
  '10': { ...a, transforms: [{ rotateY: 90 }] },
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
