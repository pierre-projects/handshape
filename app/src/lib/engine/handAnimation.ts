// The moving hand for reading practice: where the model hand is at any moment
// while it spells a run of letters or digits. Each letter is held for most of
// its slot, then the hand flows into the next. J and Z are drawn in the air,
// and the second of a doubled letter is made a little to the side, as a signer
// would. The poses are the same approximations the camera guide uses.
import { lerp, type Point } from './geometry';
import type { Handedness } from './hand';
import { buildHand } from './modelHand';
import { MOVES, isMoveId, type Pt } from './movement';
import { POSES } from './poses';

/** Share of each letter's slot spent moving on to the next letter. */
export const BLEND = 0.4;
/** How far a drawn letter (J, Z) travels, and how far a doubled letter slides, in meters. */
const STROKE_SIZE = 0.07;
const DOUBLE_SLIDE = 0.035;

export interface HandMoment {
  /** 21 points in meters: x right, y down, z away from the viewer, the resting wrist at the origin. */
  points: Point[];
  /** Which letter of the run is being shown or moved away from. */
  index: number;
}

const models = new Map<string, Point[]>();

function pose(id: string, hand: Handedness): Point[] | undefined {
  if (!(id in POSES)) return undefined;
  const key = `${id}:${hand}`;
  let m = models.get(key);
  if (!m) models.set(key, (m = buildHand({ ...POSES[id], hand }).world));
  return m;
}

/** A point part-way along a path, by distance traveled. */
function along(path: Pt[], s: number): Pt {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
  let left = Math.min(Math.max(s, 0), 1) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i]) {
      const t = lengths[i] ? left / lengths[i] : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * t, y: path[i].y + (path[i + 1].y - path[i].y) * t };
    }
    left -= lengths[i];
  }
  return path[path.length - 1];
}

/**
 * How far the whole hand has moved from rest while drawing a J or Z, with the
 * letter `s` of the way done (0 to 1). A J hooks toward the thumb; a Z starts
 * toward the signer's own right, which is the viewer's left for a right hand.
 */
function strokeOffset(id: string, s: number, side: number): Pt {
  if (!isMoveId(id)) return { x: 0, y: 0 };
  const p = along(MOVES[id].template, s);
  const dir = id === 'j' ? side : -side;
  return { x: p.x * STROKE_SIZE * dir, y: p.y * STROKE_SIZE };
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** How long a run takes at this speed, in ms. */
export function handDuration(count: number, lettersPerSecond: number): number {
  return (count * 1000) / lettersPerSecond;
}

/**
 * The hand at `tMs` into spelling `ids` (content item ids: "c", "a", "t", "5").
 * Before the start it rests in the first letter; after the end it holds the
 * last. Undefined when none of the ids has a pose.
 */
export function handAt(ids: string[], lettersPerSecond: number, tMs: number, hand: Handedness = 'Right'): HandMoment | undefined {
  const known = ids.map((id, i) => ({ id, i, pose: pose(id, hand) })).filter((k) => k.pose);
  if (!known.length) return undefined;
  const side = hand === 'Right' ? 1 : -1;
  const slot = 1000 / lettersPerSecond;
  const n = known.length;
  const at = Math.min(Math.max(Math.floor(tMs / slot), 0), n - 1);
  const u = Math.min(Math.max((tMs - at * slot) / slot, 0), 1);

  // A doubled letter slides toward the signer's dominant side; a third slides again.
  const slide = (k: number) => {
    let steps = 0;
    for (let j = k; j > 0 && known[j].id === known[j - 1].id; j--) steps++;
    return -steps * DOUBLE_SLIDE * side;
  };
  /** Letter k's pose, moved by its slide and by however much of its stroke is drawn. */
  const placed = (k: number, drawn: number): Point[] => {
    const o = strokeOffset(known[k].id, drawn, side);
    const dx = o.x + slide(k);
    return known[k].pose!.map((p) => ({ x: p.x + dx, y: p.y + o.y, z: p.z }));
  };

  const hold = 1 - BLEND;
  if (u <= hold || at === n - 1) {
    // The last letter has no next one to move to, so it takes its whole slot.
    const drawn = at === n - 1 ? u : u / hold;
    return { points: placed(at, Math.min(drawn, 1)), index: known[at].i };
  }
  const from = placed(at, 1);
  const to = placed(at + 1, 0);
  const k = ease((u - hold) / BLEND);
  return { points: from.map((p, i) => lerp(p, to[i], k)), index: known[at].i };
}
