export interface Point {
  x: number;
  y: number;
  z: number;
}

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Point, b: Point): Point => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (a: Point): number => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Point, b: Point): number => length(sub(a, b));
export const normalize = (a: Point): Point => {
  const l = length(a);
  return l === 0 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / l);
};
export const lerp = (a: Point, b: Point, t: number): Point => add(a, scale(sub(b, a), t));

/** Angle between two vectors in degrees, 0 to 180. */
export function angleBetween(a: Point, b: Point): number {
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0) return 0;
  const c = Math.min(1, Math.max(-1, dot(a, b) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Bend at joint b on the chain a→b→c: 0 when straight. */
export function bendAt(a: Point, b: Point, c: Point): number {
  return angleBetween(sub(b, a), sub(c, b));
}

/** Position of p along the segment a→b: 0 at a, 1 at b. */
export function projectT(p: Point, a: Point, b: Point): number {
  const ab = sub(b, a);
  const d = dot(ab, ab);
  return d === 0 ? 0 : dot(sub(p, a), ab) / d;
}
