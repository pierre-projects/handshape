// Sign checks for static handshapes: the letters of the manual alphabet and
// numbers 0 to 10. Each sign is a list of checks over the measured features.
// A failed check names what to fix. Thresholds are first estimates and are
// meant to be tuned against recorded samples (see fixtures/handshapes).
import type { Features } from './features';
import type { Finger, HandPart } from './hand';

export type Parameter = 'handshape' | 'orientation' | 'movement';

/** The part of the hand a check is about, so the camera view can point at it. */
export type Part = HandPart;

export interface Check {
  id: string;
  param: Parameter;
  test: (f: Features) => boolean;
  /**
   * What to tell the learner when the check fails. A function when the right
   * advice depends on what the camera sees, e.g. a finger that is straight but
   * leaning forward should not be told to straighten.
   */
  hint: string | ((f: Features) => string);
  /** Which fingers the check is about. */
  parts: Part[];
  /**
   * False for checks the camera often gets wrong, mostly thumb positions
   * hidden behind the fingers. They are reported but never block a match.
   */
  reliable: boolean;
}

export interface SignSpec {
  id: string;
  checks: Check[];
  /**
   * Signs with movement (J, Z, 10). These checks cover the starting handshape;
   * J and Z's drawn letter is checked in movement.ts, 10's shake isn't checked yet.
   */
  movement?: string;
}

/** Tunable thresholds, in degrees or palm lengths. */
export const T = {
  /** Most total bend a finger held up may have. Ring and pinky curve naturally, so they get more room. */
  extendedMax: { index: 65, middle: 65, ring: 75, pinky: 85 } as Record<Finger, number>,
  /** Most bend in the finger's own two joints for it to count as straight, whatever its knuckle does. */
  straightTipMax: 55,
  curledMin: 120,
  /** A looser fold, for fingers the camera can barely see (P's ring and pinky). */
  foldedMin: 90,
  bentMin: 35,
  bentMax: 200,
  hookTipMin: 70,
  hookMcpMax: 60,
  clawMcpMax: 55,
  fistMcpMin: 55,
  touch: 0.35,
  apart: 0.4,
  togetherMax: 10,
  spreadMin: 12,
  tightCurlMin: 170,
  closedMcpMin: 55,
  thumbStraightMax: 50,
  thumbOutMin: 50,
  /**
   * A thumb stuck out has its tip outside the index knuckle: below this on the
   * knuckle line (0 index knuckle, 1 pinky knuckle). A thumb laid across the
   * palm is just as far from the hand's long axis, but on the other side.
   */
  thumbAsideMax: -0.25,
  /** Least total spread across the four fingers (degrees) for an open, fanned hand. */
  fanMin: 20,
  thumbParallelMax: 40,
  crossMin: 0.05,
  /** Degrees from straight up; 100 is just below horizontal. */
  tippedDownMin: 100,
  /**
   * X vs T: the index "stands up" off the fist when its knuckle is this much
   * straighter than the middle finger's (degrees) and its tip reaches this much
   * higher along the hand (palm lengths).
   */
  raiseKnuckleMin: 40,
  raiseTipMin: 0.3,
};

/**
 * True when the index finger is raised off the fist, as in X's hook. In T the
 * index folds down over the thumb, which the camera reads as a looser curl but
 * not a raised finger. X requires this and T forbids it, so one hand can never
 * be both.
 */
export function indexStandsUp(f: Features): boolean {
  return (
    f.mcpBend.middle - f.mcpBend.index >= T.raiseKnuckleMin && f.tipHeight.index - f.tipHeight.middle >= T.raiseTipMin
  );
}

/**
 * True when the thumb sticks out to the side, as in L, Y, 3 and 5: straight,
 * angled away from the hand, and with its tip outside the index knuckle. Signs
 * with the thumb out require this and signs with it tucked forbid it, so a thumb
 * folded across the palm is never read as stuck out.
 */
export function thumbSticksOut(f: Features): boolean {
  return f.thumbBend <= T.thumbStraightMax && f.thumbOut >= T.thumbOutMin && f.thumbAcross <= T.thumbAsideMax;
}

const NAMES: Record<Finger, string> = { index: 'index', middle: 'middle', ring: 'ring', pinky: 'pinky' };

// ---- Check builders ----

const extended = (finger: Finger): Check => ({
  id: `${finger}-extended`,
  param: 'handshape',
  test: (f) => f.curl[finger] <= T.extendedMax[finger],
  // A finger that is straight in itself but bent at the knuckle isn't "bent" to the learner.
  hint: (f) =>
    f.tipBend[finger] <= T.straightTipMax
      ? `Your ${NAMES[finger]} finger is leaning forward at the knuckle. Lift it up in line with your palm.`
      : `Straighten your ${NAMES[finger]} finger.`,
  parts: [finger],
  reliable: true,
});

/** Straight from the middle joint to the tip, at any knuckle angle: K and P's middle finger. */
const straight = (finger: Finger): Check => ({
  id: `${finger}-straight`,
  param: 'handshape',
  test: (f) => f.tipBend[finger] <= T.straightTipMax,
  hint: `Keep your ${NAMES[finger]} finger straight; bend it only where it meets your hand.`,
  parts: [finger],
  reliable: true,
});

/** Folded down, without needing a tight curl. For fingers hidden from the camera. */
const tucked = (finger: Finger): Check => ({
  id: `${finger}-tucked`,
  param: 'handshape',
  test: (f) => f.curl[finger] >= T.foldedMin,
  hint: `Fold your ${NAMES[finger]} finger down.`,
  parts: [finger],
  reliable: true,
});

const curled = (finger: Finger): Check => ({
  id: `${finger}-curled`,
  param: 'handshape',
  test: (f) => f.curl[finger] >= T.curledMin,
  hint: `Fold your ${NAMES[finger]} finger down.`,
  parts: [finger],
  reliable: true,
});

const bent = (finger: Finger): Check => ({
  id: `${finger}-bent`,
  param: 'handshape',
  test: (f) => f.curl[finger] >= T.bentMin && f.curl[finger] <= T.bentMax,
  hint: `Curve your ${NAMES[finger]} finger, neither straight nor in a fist.`,
  parts: [finger],
  reliable: true,
});

/** Folded fully into a fist: bent at the knuckle as well as the finger joints. */
const closed = (finger: Finger): Check => ({
  id: `${finger}-closed`,
  param: 'handshape',
  test: (f) => f.curl[finger] >= T.tightCurlMin && f.mcpBend[finger] >= T.closedMcpMin,
  hint: `Close your ${NAMES[finger]} finger into a fist.`,
  parts: [finger],
  reliable: true,
});

/** Bent tightly at the finger joints, as in E. */
const tight = (finger: Finger): Check => ({
  id: `${finger}-tight`,
  param: 'handshape',
  test: (f) => f.curl[finger] >= T.tightCurlMin,
  hint: `Bend your ${NAMES[finger]} finger more tightly.`,
  parts: [finger],
  reliable: true,
});

const hooked = (finger: Finger): Check => ({
  id: `${finger}-hooked`,
  param: 'handshape',
  test: (f) => f.tipBend[finger] >= T.hookTipMin && f.mcpBend[finger] <= T.hookMcpMax,
  hint: `Raise your ${NAMES[finger]} finger and bend just the tip into a hook.`,
  parts: [finger],
  reliable: true,
});

const indexRaised: Check = {
  id: 'index-raised',
  param: 'handshape',
  test: indexStandsUp,
  hint: 'Raise your index finger off your fist, then hook it.',
  parts: ['index'],
  reliable: true,
};

const indexFolded: Check = {
  id: 'index-folded',
  param: 'handshape',
  test: (f) => !indexStandsUp(f),
  hint: 'Fold your index finger down over your thumb, not up in a hook.',
  parts: ['index'],
  reliable: true,
};

type ThumbTarget = keyof Features['thumbTo'];
const TARGET_NAMES: Record<ThumbTarget, string> = {
  indexTip: 'your index fingertip',
  middleTip: 'your middle fingertip',
  ringTip: 'your ring fingertip',
  pinkyTip: 'your pinky fingertip',
  indexPip: 'the side of your index finger',
  middlePip: 'the middle of your middle finger',
};

const TARGET_FINGER: Record<ThumbTarget, Finger> = {
  indexTip: 'index',
  middleTip: 'middle',
  ringTip: 'ring',
  pinkyTip: 'pinky',
  indexPip: 'index',
  middlePip: 'middle',
};

const thumbTouches = (target: ThumbTarget, reliable = true): Check => ({
  id: `thumb-touches-${target}`,
  param: 'handshape',
  test: (f) => f.thumbTo[target] <= T.touch,
  hint: `Touch your thumb to ${TARGET_NAMES[target]}.`,
  parts: ['thumb', TARGET_FINGER[target]],
  reliable,
});

const thumbApartFrom = (target: ThumbTarget, hint: string): Check => ({
  id: `thumb-apart-${target}`,
  param: 'handshape',
  test: (f) => f.thumbTo[target] >= T.apart,
  hint,
  parts: ['thumb'],
  reliable: true,
});

const thumbOut: Check = {
  id: 'thumb-out',
  param: 'handshape',
  test: thumbSticksOut,
  hint: 'Stick your thumb straight out to the side.',
  parts: ['thumb'],
  reliable: true,
};

const thumbIn: Check = {
  id: 'thumb-in',
  param: 'handshape',
  test: (f) => !thumbSticksOut(f),
  hint: 'Fold your thumb over your fingers instead of sticking it out.',
  parts: ['thumb'],
  reliable: true,
};

/** 4: the thumb must not stick out, or it is a 5. */
const thumbTuckedIn: Check = { ...thumbIn, id: 'thumb-tucked', hint: 'Fold your thumb across your palm.' };

const thumbParallel: Check = {
  id: 'thumb-parallel',
  param: 'handshape',
  test: (f) => f.thumbIndexAngle <= T.thumbParallelMax && f.thumbTo.indexTip >= 0.25,
  hint: 'Hold your thumb straight, parallel to your index finger, with a small gap.',
  parts: ['thumb'],
  reliable: true,
};

const thumbFolded: Check = {
  id: 'thumb-folded',
  param: 'handshape',
  test: (f) => f.thumbAcross >= 0.15 && f.thumbAlong <= 1.0,
  hint: 'Fold your thumb across your palm.',
  parts: ['thumb'],
  reliable: false,
};

const thumbOverFingers: Check = {
  id: 'thumb-over',
  param: 'handshape',
  test: (f) => f.thumbFront >= 0,
  hint: 'Your thumb should wrap over the front of your fingers, not tuck under them.',
  parts: ['thumb'],
  reliable: false,
};

const thumbUnderFingers: Check = {
  id: 'thumb-under',
  param: 'handshape',
  test: (f) => f.thumbFront < 0.05,
  hint: 'Tuck your thumb under your fingers instead of over them.',
  parts: ['thumb'],
  reliable: false,
};

const thumbAcross = (lo: number, hi: number, hint: string, id: string): Check => ({
  id,
  param: 'handshape',
  test: (f) => f.thumbAcross >= lo && f.thumbAcross <= hi,
  hint,
  parts: ['thumb'],
  reliable: false,
});

const PAIR_FINGERS: Record<keyof Features['spread'], Finger[]> = {
  im: ['index', 'middle'],
  mr: ['middle', 'ring'],
  rp: ['ring', 'pinky'],
};

const together = (pair: keyof Features['spread'], hint: string): Check => ({
  id: `together-${pair}`,
  param: 'handshape',
  test: (f) => f.spread[pair] <= T.togetherMax,
  hint,
  parts: PAIR_FINGERS[pair],
  reliable: true,
});

const apart = (pair: keyof Features['spread'], hint: string): Check => ({
  id: `apart-${pair}`,
  param: 'handshape',
  test: (f) => f.spread[pair] >= T.spreadMin,
  hint,
  parts: PAIR_FINGERS[pair],
  reliable: true,
});

/** An open hand with the fingers fanned, judged across all four rather than pair by pair. */
const fanned = (hint: string): Check => ({
  id: 'fanned',
  param: 'handshape',
  test: (f) => f.spread.im + f.spread.mr + f.spread.rp >= T.fanMin,
  hint,
  parts: ['index', 'middle', 'ring', 'pinky'],
  reliable: true,
});

const crossed: Check = {
  id: 'crossed',
  param: 'handshape',
  test: (f) => f.crossIM >= T.crossMin,
  hint: 'Cross your middle finger over your index finger.',
  parts: ['index', 'middle'],
  reliable: true,
};

const notCrossed: Check = {
  id: 'not-crossed',
  param: 'handshape',
  test: (f) => f.crossIM < T.crossMin,
  hint: 'Uncross your fingers.',
  parts: ['index', 'middle'],
  reliable: true,
};

const claw: Check = {
  id: 'claw',
  param: 'handshape',
  test: (f) => f.mcpBend.index <= T.clawMcpMax && f.mcpBend.middle <= T.clawMcpMax,
  hint: 'Bend your fingers at the middle joints so the tips rest on your thumb, not into a fist.',
  parts: ['index', 'middle'],
  reliable: false,
};

const fist: Check = {
  id: 'fist',
  param: 'handshape',
  test: (f) => f.mcpBend.index >= T.fistMcpMin && f.mcpBend.middle >= T.fistMcpMin,
  hint: 'Close your fingers into a fist.',
  parts: ['index', 'middle'],
  reliable: false,
};

const pointsUp: Check = {
  id: 'points-up',
  param: 'orientation',
  test: (f) => f.handDirection === 'up',
  hint: 'Point your fingers up.',
  parts: ['hand'],
  reliable: true,
};

const indexSideways: Check = {
  id: 'index-sideways',
  param: 'orientation',
  test: (f) => f.indexDirection === 'side',
  hint: 'Turn your hand so your index finger points sideways.',
  parts: ['hand', 'index'],
  reliable: true,
};

const indexDown: Check = {
  id: 'index-down',
  param: 'orientation',
  test: (f) => f.indexDirection === 'down',
  hint: 'Tip your hand so your index finger points down.',
  parts: ['hand', 'index'],
  reliable: true,
};

/** P: the middle finger only needs to point below horizontal, not straight down. */
const middleTippedDown: Check = {
  id: 'middle-tipped-down',
  param: 'orientation',
  test: (f) => f.middleAngle >= T.tippedDownMin,
  hint: 'Tip your hand down so your middle finger points toward the floor.',
  parts: ['hand', 'middle'],
  reliable: true,
};

/**
 * The opposite of P's tip: the middle finger is not pointing at the floor. K and
 * C require it, so a hand tipped down for P can never also be read as one of them.
 */
const middleNotDown: Check = {
  id: 'middle-not-down',
  param: 'orientation',
  test: (f) => f.middleAngle < T.tippedDownMin,
  hint: 'Hold your hand upright, not tipped down.',
  parts: ['hand'],
  reliable: true,
};

const palmOut: Check = {
  id: 'palm-out',
  param: 'orientation',
  test: (f) => f.facing === 'out',
  hint: 'Turn your palm to face out, toward the camera.',
  parts: ['hand'],
  reliable: true,
};

const palmIn: Check = {
  id: 'palm-in',
  param: 'orientation',
  test: (f) => f.facing === 'in',
  hint: 'Turn your palm to face you, so the camera sees the back of your hand.',
  parts: ['hand'],
  reliable: true,
};

const curledAll = (...fs: Finger[]) => fs.map(curled);
const extendedAll = (...fs: Finger[]) => fs.map(extended);
/** The same check as advice only: reported, never blocking. */
const advice = (c: Check): Check => ({ ...c, reliable: false });

// ---- Specs ----

const S: SignSpec[] = [
  {
    id: 'a',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      fist,
      thumbAcross(-0.8, 0.02, 'Rest your thumb against the side of your fist, not across the front.', 'thumb-beside'),
      palmOut,
    ],
  },
  {
    id: 'b',
    checks: [
      ...extendedAll('index', 'middle', 'ring', 'pinky'),
      together('im', 'Press your fingers together.'),
      together('mr', 'Press your fingers together.'),
      thumbFolded,
      pointsUp,
      palmOut,
    ],
  },
  {
    id: 'c',
    checks: [
      ...(['index', 'middle', 'ring', 'pinky'] as Finger[]).map(bent),
      thumbApartFrom('indexTip', 'Open a gap between your thumb and fingers, like holding a cup.'),
      middleNotDown,
    ],
  },
  {
    id: 'd',
    checks: [extended('index'), ...curledAll('middle', 'ring', 'pinky'), thumbTouches('middleTip'), pointsUp, palmOut],
  },
  {
    id: 'e',
    checks: [
      ...(['index', 'middle', 'ring', 'pinky'] as Finger[]).map(tight),
      claw,
      thumbAcross(0.1, 1.1, 'Tuck your thumb across your palm under your fingertips.', 'thumb-under'),
      palmOut,
    ],
  },
  {
    id: 'f',
    checks: [
      thumbTouches('indexTip'),
      bent('index'),
      ...extendedAll('middle', 'ring', 'pinky'),
      pointsUp,
      palmOut,
    ],
  },
  {
    id: 'g',
    checks: [extended('index'), ...curledAll('middle', 'ring', 'pinky'), thumbParallel, indexSideways, palmIn],
  },
  {
    id: 'h',
    checks: [
      ...extendedAll('index', 'middle'),
      together('im', 'Keep your index and middle fingers together.'),
      ...curledAll('ring', 'pinky'),
      indexSideways,
      palmIn,
    ],
  },
  { id: 'i', checks: [extended('pinky'), ...curledAll('index', 'middle', 'ring'), thumbIn, pointsUp, palmOut] },
  {
    id: 'j',
    movement: 'Draw a J with your pinky.',
    checks: [extended('pinky'), ...curledAll('index', 'middle', 'ring')],
  },
  {
    id: 'k',
    checks: [
      extended('index'),
      // Straight, but angled well forward at the knuckle, so its total bend is large.
      straight('middle'),
      apart('im', 'Angle your middle finger forward, away from your index finger.'),
      thumbTouches('middlePip'),
      ...curledAll('ring', 'pinky'),
      pointsUp,
      middleNotDown,
      palmOut,
    ],
  },
  {
    id: 'l',
    checks: [extended('index'), ...curledAll('middle', 'ring', 'pinky'), thumbOut, pointsUp, palmOut],
  },
  {
    id: 'm',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      thumbAcross(0.6, 1.3, 'Tuck your thumb under three fingers, so it peeks out by your pinky.', 'thumb-under-three'),
      thumbUnderFingers,
      palmOut,
    ],
  },
  {
    id: 'n',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      thumbAcross(0.3, 0.65, 'Tuck your thumb under two fingers, so it peeks out by your ring finger.', 'thumb-under-two'),
      thumbUnderFingers,
      palmOut,
    ],
  },
  {
    id: 'o',
    checks: [
      ...(['index', 'middle', 'ring', 'pinky'] as Finger[]).map(bent),
      thumbTouches('indexTip'),
      thumbTouches('middleTip'),
    ],
  },
  {
    id: 'p',
    checks: [
      // The tip of the hand comes first: nothing else can be right until it is.
      middleTippedDown,
      straight('middle'),
      apart('im', 'Angle your middle finger away from your index finger.'),
      // Tipped down, the camera sees the hand from above. The index points at
      // it (so its bend is a guess), the thumb hides behind the fingers, and
      // the ring and pinky are tucked out of sight.
      advice(extended('index')),
      thumbTouches('middlePip', false),
      tucked('ring'),
      tucked('pinky'),
    ],
  },
  {
    id: 'q',
    checks: [extended('index'), ...curledAll('middle', 'ring', 'pinky'), thumbParallel, indexDown],
  },
  {
    id: 'r',
    checks: [...extendedAll('index', 'middle'), crossed, ...curledAll('ring', 'pinky'), pointsUp, palmOut],
  },
  {
    id: 's',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      fist,
      thumbAcross(0.15, 0.85, 'Wrap your thumb across the front of your fingers.', 'thumb-across'),
      thumbOverFingers,
      palmOut,
    ],
  },
  {
    id: 't',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      // The index rests on the thumb, so it curls less than a fist, but it must not stand up like X.
      indexFolded,
      thumbTouches('indexPip', false),
      thumbAcross(0.05, 0.45, 'Tuck your thumb between your index and middle fingers.', 'thumb-between'),
      thumbUnderFingers,
      palmOut,
    ],
  },
  {
    id: 'u',
    checks: [
      ...extendedAll('index', 'middle'),
      notCrossed,
      together('im', 'Keep your index and middle fingers together.'),
      ...curledAll('ring', 'pinky'),
      pointsUp,
      palmOut,
    ],
  },
  {
    id: 'v',
    checks: [
      ...extendedAll('index', 'middle'),
      apart('im', 'Spread your index and middle fingers apart.'),
      notCrossed,
      thumbIn,
      thumbApartFrom('middlePip', 'Hold your thumb against your folded fingers, not between your raised ones.'),
      ...curledAll('ring', 'pinky'),
      pointsUp,
      palmOut,
    ],
  },
  {
    id: 'w',
    checks: [
      ...extendedAll('index', 'middle', 'ring'),
      apart('im', 'Spread your three fingers apart.'),
      thumbTouches('pinkyTip'),
      pointsUp,
      palmOut,
    ],
  },
  {
    id: 'x',
    checks: [hooked('index'), indexRaised, ...(['middle', 'ring', 'pinky'] as Finger[]).map(closed), palmOut],
  },
  {
    id: 'y',
    checks: [extended('pinky'), thumbOut, ...curledAll('index', 'middle', 'ring'), palmOut],
  },
  {
    id: 'z',
    movement: 'Draw a Z with your index finger.',
    checks: [extended('index'), ...curledAll('middle', 'ring', 'pinky')],
  },
  {
    id: '0',
    checks: [
      ...(['index', 'middle', 'ring', 'pinky'] as Finger[]).map(bent),
      thumbTouches('indexTip'),
      thumbTouches('middleTip'),
    ],
  },
  {
    id: '1',
    checks: [
      // For 1 to 5 the palm comes first: it is the usual mistake, and the rest is hard to read until it is right.
      palmIn,
      pointsUp,
      extended('index'),
      ...curledAll('middle', 'ring', 'pinky'),
      // D is the palm-out look-alike; here the thumb only has to stay tucked.
      thumbIn,
    ],
  },
  {
    id: '2',
    checks: [
      palmIn,
      pointsUp,
      ...extendedAll('index', 'middle'),
      apart('im', 'Spread your index and middle fingers apart.'),
      notCrossed,
      thumbIn,
      ...curledAll('ring', 'pinky'),
    ],
  },
  {
    id: '3',
    checks: [
      palmIn,
      pointsUp,
      ...extendedAll('index', 'middle'),
      apart('im', 'Spread your index and middle fingers apart.'),
      thumbOut,
      ...curledAll('ring', 'pinky'),
    ],
  },
  {
    id: '4',
    checks: [
      palmIn,
      pointsUp,
      ...extendedAll('index', 'middle', 'ring', 'pinky'),
      fanned('Spread your fingers apart.'),
      thumbTuckedIn,
      thumbFolded,
    ],
  },
  {
    id: '5',
    checks: [
      palmIn,
      pointsUp,
      ...extendedAll('index', 'middle', 'ring', 'pinky'),
      fanned('Spread all your fingers apart.'),
      thumbOut,
    ],
  },
  {
    id: '6',
    checks: [...extendedAll('index', 'middle', 'ring'), thumbTouches('pinkyTip'), pointsUp, palmOut],
  },
  {
    id: '7',
    checks: [...extendedAll('index', 'middle', 'pinky'), thumbTouches('ringTip'), pointsUp, palmOut],
  },
  {
    id: '8',
    checks: [...extendedAll('index', 'ring', 'pinky'), thumbTouches('middleTip'), pointsUp, palmOut],
  },
  {
    id: '9',
    checks: [thumbTouches('indexTip'), bent('index'), ...extendedAll('middle', 'ring', 'pinky'), pointsUp, palmOut],
  },
  {
    id: '10',
    movement: 'Shake your thumb slightly.',
    checks: [
      ...curledAll('index', 'middle', 'ring', 'pinky'),
      {
        id: 'thumb-up',
        param: 'orientation',
        test: (f) => f.thumbBend <= T.thumbStraightMax && f.thumbDirection === 'up' && f.facing !== 'out',
        hint: 'Point your thumb straight up, with your fist turned sideways.',
        parts: ['thumb', 'hand'],
        reliable: false,
      },
    ],
  },
];

export const SPECS: Map<string, SignSpec> = new Map(S.map((s) => [s.id, s]));

export function isCheckable(itemId: string): boolean {
  return SPECS.has(itemId);
}

export interface CheckResult {
  id: string;
  param: Parameter;
  pass: boolean;
  hint: string;
  parts: Part[];
  reliable: boolean;
}

export interface Evaluation {
  target: string;
  /** All reliable checks pass. */
  pass: boolean;
  /** Reliable and unreliable checks all pass. */
  passAll: boolean;
  results: CheckResult[];
  /** The first reliable failure, which is the most useful single thing to fix. */
  hint?: string;
  /** The parts of the hand that hint is about. Empty when there is no hint. */
  focus: Part[];
  /** Unreliable failures, shown as "check this yourself". */
  unsure: string[];
  movement?: string;
}

export function evaluate(target: string, features: Features): Evaluation {
  const spec = SPECS.get(target);
  if (!spec) throw new Error(`No handshape spec for "${target}"`);
  const results = spec.checks.map((c) => ({
    id: c.id,
    param: c.param,
    pass: c.test(features),
    hint: typeof c.hint === 'function' ? c.hint(features) : c.hint,
    parts: c.parts,
    reliable: c.reliable,
  }));
  const failedReliable = results.filter((r) => r.reliable && !r.pass);
  const unsure = [...new Set(results.filter((r) => !r.reliable && !r.pass).map((r) => r.hint))];
  return {
    target,
    pass: failedReliable.length === 0,
    passAll: failedReliable.length === 0 && unsure.length === 0,
    results,
    hint: failedReliable[0]?.hint,
    focus: failedReliable[0]?.parts ?? [],
    unsure,
    movement: spec.movement,
  };
}

export interface Judgement extends Evaluation {
  /** Other signs the hand matches fully while the target only matches loosely. */
  rivals: string[];
}

/**
 * Decides whether the hand counts as the target sign. Thumb checks the camera
 * often misreads don't block a match on their own, but if they fail AND the
 * hand fully matches a different sign, it's that sign, not the target. This
 * stops one fist passing for A, E, M, N, S and T alike.
 */
export function judge(target: string, features: Features, candidates: Iterable<string> = SPECS.keys()): Judgement {
  const e = evaluate(target, features);
  if (!e.pass || e.passAll) return { ...e, rivals: [] };
  const rivals = looksLike(features, candidates, target);
  if (!rivals.length) return { ...e, rivals };
  // The thumb check that failed is now the thing to fix, so point at it.
  const doubt = e.results.find((r) => !r.reliable && !r.pass);
  return { ...e, pass: false, hint: doubt?.hint ?? e.hint, focus: doubt?.parts ?? e.focus, rivals };
}

/**
 * Other signs the current hand matches fully, so feedback can say
 * "that looks like S". Signs with movement are left out.
 */
export function looksLike(features: Features, candidates: Iterable<string>, exclude?: string): string[] {
  const out: string[] = [];
  for (const id of candidates) {
    if (id === exclude) continue;
    const spec = SPECS.get(id);
    if (!spec || spec.movement) continue;
    if (evaluate(id, features).passAll) out.push(id);
  }
  return out;
}
