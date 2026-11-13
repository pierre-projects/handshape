// Turns one hand frame into measurements that sign checks can reason about.
// Shape measurements use world landmarks (meters); direction and palm facing
// use image landmarks, because they are about how the hand looks to a viewer.
import { angleBetween, bendAt, cross, dist, dot, lerp, normalize, projectT, sub, type Point } from './geometry';
import { screenScale } from './guide';
import { FINGER_JOINTS, FINGERS, LM, type Finger, type HandFrame } from './hand';

export type Direction = 'up' | 'down' | 'side';
export type Facing = 'out' | 'in' | 'side';

export interface Features {
  /** Total bend of each finger in degrees: about 0 straight, 200+ in a fist. */
  curl: Record<Finger, number>;
  /** Bend at the knuckle where the finger meets the hand. */
  mcpBend: Record<Finger, number>;
  /** Bend at the two finger joints (PIP + DIP). */
  tipBend: Record<Finger, number>;
  /**
   * How straight each finger is in itself: fingertip to knuckle in a straight
   * line, over the finger's length along its bones. 1 is straight, about 0.5 a
   * fist; bending only at the knuckle doesn't change it. It holds up when the
   * camera misjudges depth, where tipBend doesn't: a joint read 1 cm too near
   * adds 30 to 50 degrees of bend but takes only 0.03 off this.
   */
  reach: Record<Finger, number>;
  /**
   * How far each fingertip reaches along the hand: 0 at the wrist, 1 at the
   * middle knuckle. A folded finger's tip sits below the knuckles (under 1); a
   * raised one, even hooked, stays above them.
   */
  tipHeight: Record<Finger, number>;
  /** Total bend of the thumb's MCP and IP joints. */
  thumbBend: number;
  /** Angle between the thumb and the hand's long axis. Small means alongside the hand. */
  thumbOut: number;
  /** Angle between the thumb and the index finger. */
  thumbIndexAngle: number;
  /** Angle between adjacent fingers, in degrees. */
  spread: { im: number; mr: number; rp: number };
  /**
   * Index fingertip to pinky fingertip, over index knuckle to pinky knuckle.
   * About 1 with the fingers together, more when they fan out. Unlike spread it
   * still works on curved fingers, whose angles say little about how far apart
   * the tips are.
   */
  tipSpan: number;
  /** Thumb tip distance to other landmarks, in palm lengths. */
  thumbTo: {
    indexTip: number;
    middleTip: number;
    ringTip: number;
    pinkyTip: number;
    indexPip: number;
    middlePip: number;
  };
  /** Thumb tip position across the knuckles: 0 at the index knuckle, 1 at the pinky knuckle. */
  thumbAcross: number;
  /** Thumb tip position along the hand: 0 at the wrist, 1 at the middle knuckle. */
  thumbAlong: number;
  /**
   * How far the thumb tip sits in front of the folded fingers' middle knuckles,
   * toward the palm side, in palm lengths. Positive means over the fingers (S),
   * negative means tucked under them (M, N, T).
   */
  thumbFront: number;
  /** Which way the thumb points in the image. */
  thumbDirection: Direction;
  /**
   * How far the thumb tip stands clear of the rest of the hand in the picture,
   * above it (up) or below it (down), in palm lengths as seen on screen.
   * Negative when it doesn't clear it. A thumbs up clears the fist by half a
   * palm; in A the thumb lies beside the fist and barely clears the knuckles,
   * and in S it lies across the front and doesn't clear them at all.
   */
  thumbClear: { up: number; down: number };
  /** Index tip lateral position minus middle tip lateral position. Positive means crossed. */
  crossIM: number;
  /**
   * Index fingertip to middle fingertip, in palm lengths. About 0.25 with the
   * two fingers side by side (U), 0.4 and up when they are spread (V), and
   * under 0.2 when they cross or lean into each other (R). The angle between
   * the fingers can't tell V from R: crossed fingers are at an angle too.
   */
  tipGapIM: number;
  /** Which way the hand points in the image (wrist to middle knuckle), and the angle (0 up, 180 down). */
  handDirection: Direction;
  handAngle: number;
  /** Which way the index and middle fingers point in the image. */
  indexDirection: Direction;
  middleDirection: Direction;
  /** Middle finger angle in the image, 0 up to 180 down. */
  middleAngle: number;
  /** Palm facing: +1 straight at the camera, -1 straight away. */
  facingScore: number;
  facing: Facing;
  /** Wrist to middle knuckle, in meters. */
  palmSize: number;
}

/** Image-space direction from a to b in degrees: 0 up, 90 or -90 sideways, 180 down. */
function imageAngle(a: Point, b: Point, aspect: number): number {
  const dx = (b.x - a.x) * aspect;
  const dy = b.y - a.y;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

export function classifyDirection(angle: number): Direction {
  const a = Math.abs(angle);
  if (a <= 45) return 'up';
  if (a >= 135) return 'down';
  return 'side';
}

/** Landmarks of the thumb's free part, left out when measuring "the rest of the hand". */
const THUMB_FREE = new Set<number>([LM.THUMB_MCP, LM.THUMB_IP, LM.THUMB_TIP]);

export function computeFeatures(frame: HandFrame): Features {
  const w = frame.world;
  const img = frame.image;
  const palmSize = dist(w[LM.WRIST], w[LM.MIDDLE_MCP]) || 1;
  const rel = (a: number, b: number) => dist(w[a], w[b]) / palmSize;

  const curl = {} as Record<Finger, number>;
  const mcpBend = {} as Record<Finger, number>;
  const tipBend = {} as Record<Finger, number>;
  const tipHeight = {} as Record<Finger, number>;
  const reach = {} as Record<Finger, number>;
  for (const f of FINGERS) {
    const [mcp, pip, dip, tip] = FINGER_JOINTS[f];
    const m = bendAt(w[LM.WRIST], w[mcp], w[pip]);
    const p = bendAt(w[mcp], w[pip], w[dip]);
    const d = bendAt(w[pip], w[dip], w[tip]);
    mcpBend[f] = m;
    tipBend[f] = p + d;
    curl[f] = m + p + d;
    reach[f] = dist(w[mcp], w[tip]) / (dist(w[mcp], w[pip]) + dist(w[pip], w[dip]) + dist(w[dip], w[tip]) || 1);
    tipHeight[f] = projectT(w[tip], w[LM.WRIST], w[LM.MIDDLE_MCP]);
  }

  const fingerDir = (f: Finger) => sub(w[FINGER_JOINTS[f][3]], w[FINGER_JOINTS[f][0]]);
  const thumbDir = sub(w[LM.THUMB_TIP], w[LM.THUMB_MCP]);
  const handAxis = sub(w[LM.MIDDLE_MCP], w[LM.WRIST]);

  // Knuckle line from index to pinky, for lateral positions.
  const iK = w[LM.INDEX_MCP];
  const pK = w[LM.PINKY_MCP];
  const lateral = (p: Point) => projectT(p, iK, pK);

  // Palm facing from the image: the hand's long axis crossed with the knuckle line.
  // For a right hand facing the camera this is positive; mirrored for a left hand.
  const u = { x: (img[LM.MIDDLE_MCP].x - img[LM.WRIST].x) * frame.aspect, y: img[LM.MIDDLE_MCP].y - img[LM.WRIST].y };
  const v = { x: (img[LM.INDEX_MCP].x - img[LM.PINKY_MCP].x) * frame.aspect, y: img[LM.INDEX_MCP].y - img[LM.PINKY_MCP].y };
  const norm = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y) || 1;
  const facingScore = ((u.x * v.y - u.y * v.x) / norm) * (frame.handedness === 'Right' ? 1 : -1);
  const facing: Facing = facingScore > 0.35 ? 'out' : facingScore < -0.35 ? 'in' : 'side';

  // Normal out of the palm side, from the knuckle triangle; flipped for a left hand.
  const n0 = normalize(cross(sub(w[LM.INDEX_MCP], w[LM.WRIST]), sub(w[LM.PINKY_MCP], w[LM.WRIST])));
  const palmSide = frame.handedness === 'Right' ? n0 : { x: -n0.x, y: -n0.y, z: -n0.z };
  const knuckleFront = lerp(w[LM.INDEX_PIP], w[LM.MIDDLE_PIP], 0.5);
  const thumbFront = dot(sub(w[LM.THUMB_TIP], knuckleFront), palmSide) / palmSize;

  // The palm's real length on screen, even when the fist points at the camera.
  const palmOnScreen = screenScale(frame) * palmSize;
  let top = Infinity;
  let bottom = -Infinity;
  img.forEach((p, i) => {
    if (THUMB_FREE.has(i)) return;
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  });
  const thumbY = img[LM.THUMB_TIP].y;
  const thumbClear =
    palmOnScreen > 0 ? { up: (top - thumbY) / palmOnScreen, down: (thumbY - bottom) / palmOnScreen } : { up: -Infinity, down: -Infinity };

  const handAngle = imageAngle(img[LM.WRIST], img[LM.MIDDLE_MCP], frame.aspect);
  const middleAngle = imageAngle(img[LM.MIDDLE_MCP], img[LM.MIDDLE_TIP], frame.aspect);

  return {
    curl,
    mcpBend,
    tipBend,
    reach,
    tipHeight,
    thumbBend: bendAt(w[LM.THUMB_CMC], w[LM.THUMB_MCP], w[LM.THUMB_IP]) + bendAt(w[LM.THUMB_MCP], w[LM.THUMB_IP], w[LM.THUMB_TIP]),
    thumbOut: angleBetween(thumbDir, handAxis),
    thumbIndexAngle: angleBetween(thumbDir, fingerDir('index')),
    spread: {
      im: angleBetween(fingerDir('index'), fingerDir('middle')),
      mr: angleBetween(fingerDir('middle'), fingerDir('ring')),
      rp: angleBetween(fingerDir('ring'), fingerDir('pinky')),
    },
    tipSpan: dist(w[LM.INDEX_TIP], w[LM.PINKY_TIP]) / (dist(w[LM.INDEX_MCP], w[LM.PINKY_MCP]) || 1),
    thumbTo: {
      indexTip: rel(LM.THUMB_TIP, LM.INDEX_TIP),
      middleTip: rel(LM.THUMB_TIP, LM.MIDDLE_TIP),
      ringTip: rel(LM.THUMB_TIP, LM.RING_TIP),
      pinkyTip: rel(LM.THUMB_TIP, LM.PINKY_TIP),
      indexPip: rel(LM.THUMB_TIP, LM.INDEX_PIP),
      middlePip: rel(LM.THUMB_TIP, LM.MIDDLE_PIP),
    },
    thumbAcross: lateral(w[LM.THUMB_TIP]),
    thumbAlong: projectT(w[LM.THUMB_TIP], w[LM.WRIST], w[LM.MIDDLE_MCP]),
    thumbFront,
    thumbDirection: classifyDirection(imageAngle(img[LM.THUMB_MCP], img[LM.THUMB_TIP], frame.aspect)),
    thumbClear,
    crossIM: lateral(w[LM.INDEX_TIP]) - lateral(w[LM.MIDDLE_TIP]),
    tipGapIM: rel(LM.INDEX_TIP, LM.MIDDLE_TIP),
    handDirection: classifyDirection(handAngle),
    handAngle,
    indexDirection: classifyDirection(imageAngle(img[LM.INDEX_MCP], img[LM.INDEX_TIP], frame.aspect)),
    middleDirection: classifyDirection(middleAngle),
    middleAngle: Math.abs(middleAngle),
    facingScore,
    facing,
    palmSize,
  };
}
