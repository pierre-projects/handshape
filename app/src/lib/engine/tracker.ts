// Frame-to-frame helpers: smooth out landmark jitter, and require a match to
// be held briefly so a hand passing through a shape doesn't count.
import type { Point } from './geometry';
import type { HandFrame } from './hand';

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
