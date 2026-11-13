// Frame-to-frame helpers: smooth out landmark jitter, and require a match to
// be held briefly so a hand passing through a shape doesn't count.
import type { Point } from './geometry';
import type { HandFrame, Handedness } from './hand';

/** One of the hands the tracker found in a frame. */
export type SeenHand = Pick<HandFrame, 'image' | 'world' | 'handedness'>;

/** Wrist and the four finger knuckles: the palm, whose middle and size don't change with the handshape. */
const PALM = [0, 5, 9, 13, 17];

function palm(hand: SeenHand): { x: number; y: number; size: number } {
  const x = PALM.reduce((sum, i) => sum + hand.image[i].x, 0) / PALM.length;
  const y = PALM.reduce((sum, i) => sum + hand.image[i].y, 0) / PALM.length;
  const size = Math.hypot(hand.image[9].x - hand.image[0].x, hand.image[9].y - hand.image[0].y);
  return { x, y, size };
}

export interface FollowOptions {
  /** How long the hand may be out of sight before the next one seen counts as a new hand. */
  lostMs: number;
  /** The furthest the hand may move between frames and still be the same hand, in palm lengths. */
  jump: number;
  /** How many frames in a row the tracker must call it the other hand before that is believed. */
  flipAfter: number;
}

export const FOLLOW_DEFAULTS: FollowOptions = { lostMs: 600, jump: 2.5, flipAfter: 6 };

/**
 * Picks which hand to read when the tracker sees more than one, and stays with
 * it. The tracker says "left" or "right" for each hand in each frame, and that
 * guess flips, most of all on a phone, where the hand holding it can be in the
 * picture too. Choosing by that label afresh every frame made the reading jump
 * from one hand to the other and back. So:
 *
 *  - a new hand is chosen by the label (the signer's own signing hand), or the
 *    bigger hand when the label doesn't settle it;
 *  - after that the choice follows that hand by where it is, whatever it is
 *    called from frame to frame;
 *  - and which hand it is called changes only after several frames agree, so a
 *    one-frame flip doesn't turn "palm out" into "palm in".
 */
export class HandFollower {
  private opts: FollowOptions;
  private last?: { x: number; y: number; size: number; t: number };
  private label?: Handedness;
  private against = 0;

  constructor(opts: Partial<FollowOptions> = {}) {
    this.opts = { ...FOLLOW_DEFAULTS, ...opts };
  }

  reset(): void {
    this.last = undefined;
    this.label = undefined;
    this.against = 0;
  }

  pick(hands: SeenHand[], preferred: Handedness, now: number): SeenHand | undefined {
    if (this.last && now - this.last.t > this.opts.lostMs) this.reset();
    if (!hands.length) return undefined;

    let chosen: SeenHand | undefined;
    if (this.last) {
      const last = this.last;
      const near = hands
        .map((hand) => ({ hand, d: Math.hypot(palm(hand).x - last.x, palm(hand).y - last.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (near.d <= this.opts.jump * last.size) chosen = near.hand;
    }

    if (!chosen) {
      // A new hand: the signing hand if the tracker names just one as that, otherwise the bigger one.
      const mine = hands.filter((h) => h.handedness === preferred);
      const pool = mine.length === 1 ? mine : hands;
      chosen = [...pool].sort((a, b) => palm(b).size - palm(a).size)[0];
      this.label = chosen.handedness;
      this.against = 0;
    } else if (chosen.handedness === this.label) {
      this.against = 0;
    } else if (++this.against >= this.opts.flipAfter) {
      this.label = chosen.handedness;
      this.against = 0;
    }

    this.last = { ...palm(chosen), t: now };
    return { ...chosen, handedness: this.label ?? chosen.handedness };
  }
}

/** Exponential moving average over landmarks. Resets when the hand changes or disappears. */
export class Smoother {
  private prev?: HandFrame;

  constructor(private alpha = 0.5) {}

  reset(): void {
    this.prev = undefined;
  }

  push(frame: HandFrame): HandFrame {
    const p = this.prev;
    if (!p || p.handedness !== frame.handedness || p.image.length !== frame.image.length) {
      this.prev = frame;
      return frame;
    }
    const mix = (a: Point[], b: Point[]) =>
      b.map((q, i) => ({
        x: a[i].x + (q.x - a[i].x) * this.alpha,
        y: a[i].y + (q.y - a[i].y) * this.alpha,
        z: a[i].z + (q.z - a[i].z) * this.alpha,
      }));
    this.prev = { ...frame, image: mix(p.image, frame.image), world: mix(p.world, frame.world) };
    return this.prev;
  }
}

/**
 * Keeps what's on screen steady while readings change from frame to frame. A
 * new value replaces the shown one only once it has been asked for without a
 * break for `settleMs`, so a message doesn't flicker between "Hold still" and
 * "Hold A" as the hand wobbles. An urgent value (a match, a typed letter)
 * shows at once.
 */
export class Steady<T> {
  private shown?: { value: T };
  private next?: { value: T; since: number };

  constructor(
    private settleMs = 400,
    private same: (a: T, b: T) => boolean = Object.is,
  ) {}

  reset(): void {
    this.shown = undefined;
    this.next = undefined;
  }

  push(value: T, now: number, urgent = false): T {
    if (!this.shown || urgent || this.same(value, this.shown.value)) {
      this.shown = { value };
      this.next = undefined;
      return value;
    }
    if (!this.next || !this.same(value, this.next.value)) this.next = { value, since: now };
    else if (now - this.next.since >= this.settleMs) {
      this.shown = { value };
      this.next = undefined;
    }
    return this.shown.value;
  }
}

/**
 * Tracks how long a condition has held. A single bad frame is forgiven, so a
 * flicker in tracking doesn't restart the count.
 */
export class HoldTimer {
  private since?: number;
  private misses = 0;

  constructor(public holdMs = 600, private graceFrames = 2) {}

  reset(): void {
    this.since = undefined;
    this.misses = 0;
  }

  /** Returns progress from 0 to 1; 1 means held long enough. */
  update(ok: boolean, now: number): number {
    if (ok) {
      this.misses = 0;
      this.since ??= now;
    } else if (this.since !== undefined && ++this.misses > this.graceFrames) {
      this.reset();
    }
    if (this.since === undefined) return 0;
    return Math.min(1, (now - this.since) / this.holdMs);
  }
}
