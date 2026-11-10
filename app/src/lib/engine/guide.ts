// The guide hand: the target sign's model pose, sized to the learner's own
// hand and pinned to their wrist, so the camera view can show how the sign
// should look right where they are making it.
import { cross, dist, sub, type Point } from './geometry';
import { LM, type HandFrame, type Handedness } from './hand';
import { buildHand } from './modelHand';
import { POSES } from './poses';

export interface GuideHand {
  /**
   * 21 points placed like HandFrame.image (x and y as fractions of the video
   * frame, not mirrored). z is depth in meters; smaller is nearer the camera.
   */
  points: Point[];
  /** Length of the guide's palm on screen, as a fraction of the video height. Sets how thick to draw it. */
  palm: number;
  /** True when the back of the hand faces the camera, so it can be drawn with fingernails. */
  back: boolean;
}

/** Bones of the palm, which keep their length whatever the fingers do. */
const PALM_BONES: [number, number][] = [
  [LM.WRIST, LM.INDEX_MCP],
  [LM.WRIST, LM.MIDDLE_MCP],
  [LM.WRIST, LM.PINKY_MCP],
  [LM.INDEX_MCP, LM.PINKY_MCP],
  [LM.INDEX_MCP, LM.MIDDLE_MCP],
  [LM.MIDDLE_MCP, LM.RING_MCP],
  [LM.RING_MCP, LM.PINKY_MCP],
];

const palmLength = (world: Point[]) => dist(world[LM.WRIST], world[LM.MIDDLE_MCP]) || 1;

/** Whether the back of the hand, not the palm, is turned toward the camera. */
export function backFacesCamera(world: Point[], hand: Handedness): boolean {
  // Out of the palm of a right hand; the other way for a left hand (as in features.ts).
  const n = cross(sub(world[LM.INDEX_MCP], world[LM.WRIST]), sub(world[LM.PINKY_MCP], world[LM.WRIST]));
  const palmSideZ = hand === 'Right' ? n.z : -n.z;
  // z grows away from the camera, so a palm side pointing to +z faces away.
  return palmSideZ > 0;
}

const models = new Map<string, { world: Point[]; palm: number; back: boolean }>();

function model(sign: string, hand: Handedness) {
  const key = `${sign}:${hand}`;
  let m = models.get(key);
  if (!m) {
    const { world } = buildHand({ ...POSES[sign], hand });
    m = { world, palm: palmLength(world), back: backFacesCamera(world, hand) };
    models.set(key, m);
  }
  return m;
}

export function hasGuide(sign: string): boolean {
  return sign in POSES;
}

/**
 * How much picture one meter of this hand covers, as a fraction of the video
 * height. It must not shrink when the hand tips toward the camera (as P does),
 * so it can't just measure the palm on screen.
 *
 * The tracker's 3D points share the picture's left-right and up-down axes, so
 * the scale is the best fit between where each point is in 3D (ignoring depth)
 * and where it is in the picture. If that fit looks wrong, fall back to the
 * least-foreshortened palm bone: a bone pointing at the camera looks shorter
 * than it is, so the longest-looking one is closest to the truth.
 */
export function screenScale(frame: HandFrame): number {
  const n = frame.image.length;
  let ix = 0, iy = 0, wx = 0, wy = 0;
  for (let i = 0; i < n; i++) {
    ix += frame.image[i].x * frame.aspect;
    iy += frame.image[i].y;
    wx += frame.world[i].x;
    wy += frame.world[i].y;
  }
  ix /= n; iy /= n; wx /= n; wy /= n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const ax = frame.world[i].x - wx;
    const ay = frame.world[i].y - wy;
    num += ax * (frame.image[i].x * frame.aspect - ix) + ay * (frame.image[i].y - iy);
    den += ax * ax + ay * ay;
  }
  const fit = den > 1e-9 ? num / den : 0;

  let bone = 0;
  for (const [a, b] of PALM_BONES) {
    const seen = Math.hypot((frame.image[a].x - frame.image[b].x) * frame.aspect, frame.image[a].y - frame.image[b].y);
    const real = dist(frame.world[a], frame.world[b]);
    if (real > 1e-6) bone = Math.max(bone, seen / real);
  }
  return fit > bone * 0.6 ? fit : bone;
}

/** The guide for a sign, fitted to the hand in this frame. Undefined for signs without a pose. */
export function guideHand(sign: string, frame: HandFrame): GuideHand | undefined {
  if (!hasGuide(sign)) return undefined;
  const m = model(sign, frame.handedness);
  // The guide's palm is drawn as long as the learner's own palm, whatever size the model was built at.
  const palm = screenScale(frame) * palmLength(frame.world);
  if (!(palm > 0)) return undefined;
  const k = palm / m.palm;
  const wrist = frame.image[LM.WRIST];
  return {
    points: m.world.map((p) => ({ x: wrist.x + (p.x * k) / frame.aspect, y: wrist.y + p.y * k, z: p.z })),
    palm,
    back: m.back,
  };
}
