import { describe, expect, it } from 'vitest';
import { guideHand, hasGuide, screenScale } from '../app/src/lib/engine/guide';
import { SPECS } from '../app/src/lib/engine/handshapes';
import { LM, PALM_OUTLINE, PART_POINTS, type HandFrame } from '../app/src/lib/engine/hand';
import { buildHand } from './helpers/synthHand';
import { POSES } from './helpers/poses';

/** A hand as the camera would report it: somewhere in a 4:3 picture, at some size. */
function onCamera(frame: HandFrame, { x = 0.3, y = 0.7, size = 2, aspect = 4 / 3 } = {}): HandFrame {
  return {
    ...frame,
    aspect,
    image: frame.world.map((p) => ({ x: x + (p.x * size) / aspect, y: y + p.y * size, z: p.z })),
  };
}

/** Length between two points on screen, as a fraction of the picture height. */
const seen = (pts: { x: number; y: number }[], a: number, b: number, aspect: number) =>
  Math.hypot((pts[a].x - pts[b].x) * aspect, pts[a].y - pts[b].y);

describe('guide hand', () => {
  it('exists for every checkable sign', () => {
    expect([...SPECS.keys()].filter((id) => !hasGuide(id))).toEqual([]);
    expect(hasGuide('hello')).toBe(false);
    expect(guideHand('hello', onCamera(buildHand(POSES.b)))).toBeUndefined();
  });

  it('lies over a hand that already makes the sign', () => {
    for (const id of ['b', 'k', 'p', '1', '5']) {
      const user = onCamera(buildHand(POSES[id]));
      const g = guideHand(id, user)!;
      expect(g.points).toHaveLength(21);
      // Within a hundredth of the picture: a tipped hand is sized to about 1%, not exactly.
      g.points.forEach((p, i) => {
        expect(Math.abs(p.x - user.image[i].x), `${id} point ${i} x`).toBeLessThan(0.01);
        expect(Math.abs(p.y - user.image[i].y), `${id} point ${i} y`).toBeLessThan(0.01);
      });
    }
  });

  it('is pinned to the wrist, whatever the hand is doing', () => {
    const user = onCamera(buildHand(POSES.a), { x: 0.62, y: 0.4 });
    const g = guideHand('5', user)!;
    expect(g.points[LM.WRIST].x).toBeCloseTo(0.62);
    expect(g.points[LM.WRIST].y).toBeCloseTo(0.4);
  });

  it('follows the size of the hand on screen', () => {
    const near = guideHand('b', onCamera(buildHand(POSES.a), { size: 3 }))!;
    const far = guideHand('b', onCamera(buildHand(POSES.a), { size: 1.5 }))!;
    expect(near.palm / far.palm).toBeCloseTo(2);
    expect(seen(near.points, LM.WRIST, LM.MIDDLE_TIP, 4 / 3) / seen(far.points, LM.WRIST, LM.MIDDLE_TIP, 4 / 3)).toBeCloseTo(2);
  });

  it('keeps its size when the hand is tipped toward the camera', () => {
    // Tipped 80° forward, the hand's long axis all but vanishes from the picture; its width does not.
    const flat = onCamera(buildHand(POSES.b));
    const tipped = onCamera(buildHand({ ...POSES.b, transforms: [{ rotateX: 80 }] }));
    expect(seen(tipped.image, LM.WRIST, LM.MIDDLE_MCP, 4 / 3)).toBeLessThan(seen(flat.image, LM.WRIST, LM.MIDDLE_MCP, 4 / 3) * 0.3);
    // Within a few percent: no palm bone lies perfectly flat to the camera.
    expect(Math.abs(screenScale(tipped) / screenScale(flat) - 1)).toBeLessThan(0.03);
    expect(Math.abs(guideHand('b', tipped)!.palm / guideHand('b', flat)!.palm - 1)).toBeLessThan(0.03);
  });

  it('is sized to the learner’s hand, not the model’s', () => {
    const big = buildHand(POSES.a);
    big.world = big.world.map((p) => ({ x: p.x * 1.3, y: p.y * 1.3, z: p.z * 1.3 }));
    const g = guideHand('b', onCamera(big))!;
    expect(g.palm).toBeCloseTo(guideHand('b', onCamera(buildHand(POSES.a)))!.palm * 1.3);
  });

  it('mirrors for a left hand', () => {
    const right = guideHand('l', onCamera(buildHand(POSES.l), { x: 0.5 }))!;
    const left = guideHand('l', onCamera(buildHand({ ...POSES.l, hand: 'Left' }), { x: 0.5 }))!;
    right.points.forEach((p, i) => {
      expect(left.points[i].x - 0.5).toBeCloseTo(0.5 - p.x);
      expect(left.points[i].y).toBeCloseTo(p.y);
    });
    // The thumb of an L sticks out on opposite sides.
    expect(Math.sign(right.points[LM.THUMB_TIP].x - 0.5)).toBe(-Math.sign(left.points[LM.THUMB_TIP].x - 0.5));
  });

  it('shows P tipped down: the middle finger below the wrist, the index pointing at the camera', () => {
    const g = guideHand('p', onCamera(buildHand(POSES.a)))!;
    expect(g.points[LM.MIDDLE_TIP].y).toBeGreaterThan(g.points[LM.WRIST].y);
    // The index points forward (nearer the camera than the wrist, by centimeters) and across, not up.
    expect(g.points[LM.INDEX_TIP].z).toBeLessThan(g.points[LM.WRIST].z - 0.03);
    expect(Math.abs(g.points[LM.INDEX_TIP].x - g.points[LM.INDEX_MCP].x) * (4 / 3)).toBeGreaterThan(
      Math.abs(g.points[LM.INDEX_TIP].y - g.points[LM.INDEX_MCP].y),
    );
    // Seen from above, it is the back of the hand that shows.
    expect(g.back).toBe(true);
    expect(guideHand('k', onCamera(buildHand(POSES.a)))!.back).toBe(false);
    expect(guideHand('1', onCamera(buildHand(POSES.a)))!.back).toBe(true);
    expect(guideHand('1', onCamera(buildHand({ ...POSES.a, hand: 'Left' })))!.back).toBe(true);
  });
});

describe('hand parts', () => {
  it('cover every landmark between them', () => {
    const all = new Set([...PALM_OUTLINE, ...Object.values(PART_POINTS).flat()]);
    expect(all.size).toBe(21);
  });
});
