import { describe, expect, it } from 'vitest';
import { BLEND, handAt, handDuration } from '../app/src/lib/engine/handAnimation';
import { LM } from '../app/src/lib/engine/hand';
import { dist, type Point } from '../app/src/lib/engine/geometry';
import { buildHand } from './helpers/synthHand';
import { POSES } from './helpers/poses';

const pose = (id: string, hand: 'Left' | 'Right' = 'Right') => buildHand({ ...POSES[id], hand }).world;
/** Largest distance any of the 21 points is from where it should be. */
const off = (a: Point[], b: Point[]) => Math.max(...a.map((p, i) => dist(p, b[i])));
const SLOT = 500; // ms per letter at 2 letters a second

describe('handAt', () => {
  it('holds each letter’s pose through the first part of its slot', () => {
    const ids = ['c', 'a', 't'];
    ids.forEach((id, i) => {
      for (const u of [0, 0.3, 1 - BLEND - 0.01]) {
        const m = handAt(ids, 2, (i + u) * SLOT)!;
        expect(m.index, `${id} at ${u}`).toBe(i);
        expect(off(m.points, pose(id)), `${id} at ${u}`).toBeLessThan(1e-9);
      }
    });
  });

  it('rests in the first letter before the start and holds the last after the end', () => {
    expect(off(handAt(['c', 'a', 't'], 2, -200)!.points, pose('c'))).toBeLessThan(1e-9);
    expect(off(handAt(['c', 'a', 't'], 2, 99999)!.points, pose('t'))).toBeLessThan(1e-9);
    expect(handDuration(3, 2)).toBe(1500);
  });

  it('moves smoothly from one letter to the next, with no jumps', () => {
    const ids = ['b', 'a', 'l', 'l', 'o', 'z', 'j'];
    const end = handDuration(ids.length, 2);
    let prev = handAt(ids, 2, 0)!.points;
    // At 2 ms steps nothing should move more than a couple of millimeters.
    for (let t = 2; t <= end; t += 2) {
      const now = handAt(ids, 2, t)!.points;
      expect(off(prev, now), `at ${t} ms`).toBeLessThan(0.004);
      prev = now;
    }
  });

  it('is half-way between two letters in the middle of the move', () => {
    const mid = handAt(['b', 'a'], 2, (1 - BLEND / 2) * SLOT)!.points;
    const b = pose('b');
    const a = pose('a');
    mid.forEach((p, i) => {
      expect(dist(p, b[i])).toBeCloseTo(dist(p, a[i]), 6);
    });
    expect(off(mid, b)).toBeGreaterThan(0.01);
  });

  it('draws J and Z: the hand travels, then has moved on by the next letter', () => {
    for (const id of ['j', 'z']) {
      const start = handAt([id, 'a'], 2, 0)!.points[LM.WRIST];
      const drawn = handAt([id, 'a'], 2, (1 - BLEND) * SLOT)!.points[LM.WRIST];
      expect(Math.hypot(drawn.x - start.x, drawn.y - start.y), id).toBeGreaterThan(0.03);
      expect(drawn.y, `${id} ends lower`).toBeGreaterThan(start.y + 0.03);
      // Back at rest for the next letter.
      expect(off(handAt([id, 'a'], 2, 1.2 * SLOT)!.points, pose('a'))).toBeLessThan(1e-9);
    }
    // A still letter's wrist stays put.
    const a0 = handAt(['a', 'b'], 2, 0)!.points[LM.WRIST];
    const a1 = handAt(['a', 'b'], 2, 0.5 * SLOT)!.points[LM.WRIST];
    expect(dist(a0, a1)).toBe(0);
  });

  it('hooks a J toward the thumb and starts a Z toward the signer’s right, mirrored for a left hand', () => {
    const wristX = (id: string, u: number, hand: 'Left' | 'Right') => handAt([id, 'a'], 2, u * SLOT, hand)!.points[LM.WRIST].x;
    // Right hand, seen by the viewer: thumb side is +x, the signer's right is -x.
    expect(wristX('j', 1 - BLEND, 'Right')).toBeGreaterThan(0.02);
    expect(wristX('z', 0.15, 'Right')).toBeLessThan(-0.02);
    expect(wristX('j', 1 - BLEND, 'Left')).toBeCloseTo(-wristX('j', 1 - BLEND, 'Right'));
    expect(wristX('z', 0.15, 'Left')).toBeCloseTo(-wristX('z', 0.15, 'Right'));
  });

  it('makes the second of a doubled letter to the side', () => {
    const ids = ['l', 'l', 'l', 'a'];
    const x = (i: number) => handAt(ids, 2, (i + 0.2) * SLOT)!.points[LM.WRIST].x;
    expect(x(0)).toBe(0);
    expect(x(1)).toBeLessThan(-0.02);
    expect(x(2)).toBeCloseTo(2 * x(1));
    expect(x(3)).toBe(0);
    // The handshape itself is unchanged, only moved.
    const second = handAt(ids, 2, 1.2 * SLOT)!.points;
    expect(off(second.map((p) => ({ ...p, x: p.x - x(1) })), pose('l'))).toBeLessThan(1e-9);
  });

  it('spells numbers, with 10 as one sign', () => {
    expect(off(handAt(['5', '10'], 2, 1.2 * SLOT)!.points, pose('10'))).toBeLessThan(1e-9);
  });

  it('skips anything it has no pose for, and gives nothing when there is nothing to show', () => {
    const m = handAt(['c', '?', 't'], 2, 1.2 * SLOT)!;
    expect(off(m.points, pose('t'))).toBeLessThan(1e-9);
    expect(m.index).toBe(2);
    expect(handAt(['?'], 2, 0)).toBeUndefined();
    expect(handAt([], 2, 0)).toBeUndefined();
  });
});
