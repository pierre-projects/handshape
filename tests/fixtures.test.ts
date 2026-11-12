// Runs recorded real-hand samples through the checks. See fixtures/handshapes/README.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate } from '../app/src/lib/engine/handshapes';
import { imagePalm, imagePoint, isMoveId, MOVES, REPEATS, RepeatTracker, StrokeTracker, thumbSide } from '../app/src/lib/engine/movement';
import { Smoother } from '../app/src/lib/engine/tracker';
import type { HandFrame } from '../app/src/lib/engine/hand';

const dir = join(__dirname, '..', 'fixtures', 'handshapes');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
type Raw = { t?: number; handedness: 'Left' | 'Right'; aspect: number; image: number[][]; world: number[][] };
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
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { sign: string; movement?: boolean; frames: Raw[] };
      const sm = new Smoother(0.5);
      const frames = data.frames.map((r): HandFrame => ({
        handedness: r.handedness, aspect: r.aspect, image: toPoints(r.image), world: toPoints(r.world),
      }));

      // A drawn letter (J, Z): replay the frames and expect the stroke to be recognized.
      if (data.movement && isMoveId(data.sign)) {
        const move = MOVES[data.sign];
        const tracker = new StrokeTracker(move);
        let matched = false;
        let hint: string | undefined;
        frames.forEach((raw, i) => {
          const frame = sm.push(raw);
          const ok = evaluate(data.sign, computeFeatures(frame)).pass;
          const st = tracker.update(imagePoint(frame, move.tip), imagePalm(frame), ok, thumbSide(frame), data.frames[i].t ?? i * 33);
          matched ||= !!st.matched;
          hint = st.hint ?? hint;
        });
        expect(matched, `the drawn ${data.sign.toUpperCase()} was not recognized${hint ? `: "${hint}"` : ''}`).toBe(true);
        return;
      }

      // A sign made by a repeated movement (10's shake): replay the frames and expect the movement to be seen.
      if (data.movement && REPEATS[data.sign]) {
        const spec = REPEATS[data.sign];
        const tracker = new RepeatTracker(spec.options);
        let matched = false;
        frames.forEach((raw, i) => {
          const ok = evaluate(data.sign, computeFeatures(sm.push(raw))).pass;
          matched ||= tracker.update(ok ? spec.measure(raw) : undefined, data.frames[i].t ?? i * 33).matched;
        });
        expect(matched, `the movement in ${data.sign} was not seen`).toBe(true);
        return;
      }

      const evals = frames.map((frame) => evaluate(data.sign, computeFeatures(sm.push(frame))));
      const rate = evals.filter((e) => e.pass).length / evals.length;
      const failing = [...new Set(evals.flatMap((e) => e.results.filter((r) => r.reliable && !r.pass).map((r) => r.id)))];
      expect(rate, `checks failing on real frames: ${failing.join(', ')}`).toBeGreaterThanOrEqual(MIN_PASS_RATE);
    });
  }
});
