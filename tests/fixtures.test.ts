// Runs recorded real-hand samples through the checks. See fixtures/handshapes/README.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate } from '../app/src/lib/engine/handshapes';
import { Smoother } from '../app/src/lib/engine/tracker';
import type { HandFrame } from '../app/src/lib/engine/hand';

const dir = join(__dirname, '..', 'fixtures', 'handshapes');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
type Raw = { handedness: 'Left' | 'Right'; aspect: number; image: number[][]; world: number[][] };
const toPoints = (xs: number[][]) => xs.map(([x, y, z]) => ({ x, y, z }));

/** Share of frames that must pass. Tracking flickers, so not every frame has to. */
const MIN_PASS_RATE = 0.6;

describe('recorded samples', () => {
  if (files.length === 0) {
    it.skip('no samples recorded yet', () => {});
    return;
  }
  for (const file of files) {
    it(file, () => {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { sign: string; frames: Raw[] };
      const sm = new Smoother(0.5);
      const evals = data.frames.map((r) => {
        const frame: HandFrame = { handedness: r.handedness, aspect: r.aspect, image: toPoints(r.image), world: toPoints(r.world) };
        return evaluate(data.sign, computeFeatures(sm.push(frame)));
      });
      const rate = evals.filter((e) => e.pass).length / evals.length;
      const failing = [...new Set(evals.flatMap((e) => e.results.filter((r) => r.reliable && !r.pass).map((r) => r.id)))];
      expect(rate, `checks failing on real frames: ${failing.join(', ')}`).toBeGreaterThanOrEqual(MIN_PASS_RATE);
    });
  }
});
