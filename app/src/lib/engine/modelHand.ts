// A simple kinematic hand. It builds 21 landmarks from finger joint angles, so
// a sign can be described as a pose. It has two jobs: the guide hand drawn over
// the camera (guide.ts), and the tests, which check each sign's rules against
// its pose without a camera. A pose passing shows the rules are consistent and
// tell signs apart; it does not prove they work on real camera data. Recorded
// samples in fixtures/handshapes do that.
//
// Coordinates follow MediaPipe: x right, y down, z away from the camera.
// The base pose is a right hand, palm facing the camera, fingers up.
import { add, lerp, normalize, scale, type Point } from './geometry';
import type { Finger, HandFrame, Handedness } from './hand';

export type FingerPose = [mcp: number, pip: number, dip: number, spread?: number];

export type ThumbPose =
  | { line: [number, number, number] }
  | { to: (pts: Record<string, Point>) => Point; bulge?: [number, number, number] };

export interface Pose {
  fingers: Record<Finger, FingerPose>;
  thumb: ThumbPose;
  /** Applied in order after building the base pose. */
  transforms?: Transform[];
  hand?: Handedness;
}

/**
 * Turns of the whole hand about the wrist, in degrees. rotateZ spins it in the
 * picture, rotateY turns it to show its other side, and rotateX tips the
 * fingers toward the camera (positive) or away.
 */
export type Transform = { rotateZ: number } | { rotateY: number } | { rotateX: number };

export const STRAIGHT: FingerPose = [0, 4, 4, 0];
export const FIST: FingerPose = [85, 100, 40, 0];

const MCP: Record<Finger, Point> = {
  index: { x: 0.026, y: -0.085, z: 0 },
  middle: { x: 0.006, y: -0.088, z: 0 },
  ring: { x: -0.013, y: -0.083, z: 0 },
  pinky: { x: -0.03, y: -0.072, z: 0 },
};
const SEGMENTS: Record<Finger, [number, number, number]> = {
  index: [0.04, 0.024, 0.02],
  middle: [0.044, 0.028, 0.021],
  ring: [0.04, 0.026, 0.02],
  pinky: [0.032, 0.019, 0.018],
};
const THUMB_CMC: Point = { x: 0.022, y: -0.018, z: -0.008 };
const PALM_SIDE: Point = { x: 0, y: 0, z: -1 };
const rad = (d: number) => (d * Math.PI) / 180;

function fingerChain(f: Finger, [mcp, pip, dip, spread = 0]: FingerPose): Point[] {
  const d0 = { x: Math.sin(rad(spread)), y: -Math.cos(rad(spread)), z: 0 };
  const dir = (deg: number) => add(scale(d0, Math.cos(rad(deg))), scale(PALM_SIDE, Math.sin(rad(deg))));
  const [l1, l2, l3] = SEGMENTS[f];
  const a = MCP[f];
  const b = add(a, scale(dir(mcp), l1));
  const c = add(b, scale(dir(mcp + pip), l2));
  const d = add(c, scale(dir(mcp + pip + dip), l3));
  return [a, b, c, d];
}

function transform(p: Point, t: Transform): Point {
  if ('rotateZ' in t) {
    const a = rad(t.rotateZ);
    return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a), z: p.z };
  }
  if ('rotateX' in t) {
    const a = rad(t.rotateX);
    return { x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) };
  }
  const a = rad(t.rotateY);
  return { x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) };
}

export function buildHand(pose: Pose): HandFrame {
  const chains = {} as Record<Finger, Point[]>;
  for (const f of ['index', 'middle', 'ring', 'pinky'] as Finger[]) chains[f] = fingerChain(f, pose.fingers[f]);
  const named: Record<string, Point> = {};
  for (const [f, [mcp, pip, dip, tip]] of Object.entries(chains)) {
    named[`${f}Mcp`] = mcp;
    named[`${f}Pip`] = pip;
    named[`${f}Dip`] = dip;
    named[`${f}Tip`] = tip;
  }

  let thumb: Point[];
  if ('line' in pose.thumb) {
    const u = normalize({ x: pose.thumb.line[0], y: pose.thumb.line[1], z: pose.thumb.line[2] });
    const m = add(THUMB_CMC, scale(u, 0.04));
    const ip = add(m, scale(u, 0.032));
    thumb = [THUMB_CMC, m, ip, add(ip, scale(u, 0.028))];
  } else {
    const tip = pose.thumb.to(named);
    const [bx, by, bz] = pose.thumb.bulge ?? [0.012, 0, -0.015];
    const bulge = { x: bx, y: by, z: bz };
    thumb = [THUMB_CMC, add(lerp(THUMB_CMC, tip, 0.4), bulge), add(lerp(THUMB_CMC, tip, 0.72), scale(bulge, 0.6)), tip];
  }

  let world: Point[] = [{ x: 0, y: 0, z: 0 }, ...thumb, ...chains.index, ...chains.middle, ...chains.ring, ...chains.pinky];
  for (const t of pose.transforms ?? []) world = world.map((p) => transform(p, t));
  const hand = pose.hand ?? 'Right';
  if (hand === 'Left') world = world.map((p) => ({ ...p, x: -p.x }));
  const image = world.map((p) => ({ x: 0.5 + p.x * 3, y: 0.6 + p.y * 3, z: p.z }));
  return { world, image, handedness: hand, aspect: 1 };
}

/** Offsets a point toward the camera (in front of the palm) or away. */
export const front = (p: Point, m: number): Point => ({ ...p, z: p.z - m });
export const mid = (a: Point, b: Point, t = 0.5): Point => lerp(a, b, t);
