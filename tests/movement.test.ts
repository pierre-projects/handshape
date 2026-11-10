import { describe, expect, it } from 'vitest';
import { matchStroke, MOVES, resample, StrokeTracker, type Pt } from '../app/src/lib/engine/movement';
import { circle, drawn, holdThenDraw, LINE_ACROSS, LINE_DOWN, PALM, SEVEN } from './helpers/strokes';

const J = MOVES.j;
const Z = MOVES.z;
/** In the picture a Z's first stroke goes left (the signer's right); a J hooks to the thumb side. */
const Z_SIDE = -1;
const THUMB = 1;

describe('matchStroke', () => {
  it('accepts a J and a Z drawn the right way round', () => {
    const j = matchStroke(drawn(J.template, { side: THUMB }), J, THUMB, PALM);
    const z = matchStroke(drawn(Z.template, { side: Z_SIDE }), Z, Z_SIDE, PALM);
    expect(j).toMatchObject({ ok: true, mirrored: false });
    expect(z).toMatchObject({ ok: true, mirrored: false });
  });

  it('accepts different sizes, tilts and shaky hands', () => {
    for (const move of [J, Z]) {
      const side = move === J ? THUMB : Z_SIDE;
      for (const size of [0.7, 1, 1.6]) {
        for (const tilt of [-15, 0, 15]) {
          for (const seed of [1, 2, 3]) {
            const r = matchStroke(drawn(move.template, { side, size, tilt, jitter: 0.04, seed }), move, side, PALM);
            expect(r.ok, `${move.id} size ${size} tilt ${tilt} seed ${seed}: ${r.hint}`).toBe(true);
            expect(r.mirrored).toBe(false);
          }
        }
      }
    }
  });

  it('counts a mirrored letter, and says it was mirrored', () => {
    expect(matchStroke(drawn(J.template, { side: -THUMB }), J, THUMB, PALM)).toMatchObject({ ok: true, mirrored: true });
    expect(matchStroke(drawn(Z.template, { side: -Z_SIDE }), Z, Z_SIDE, PALM)).toMatchObject({ ok: true, mirrored: true });
  });

  it('does not call a J mirrored when the hand is edge-on and the thumb side is unknown', () => {
    expect(matchStroke(drawn(J.template, { side: -1 }), J, 0, PALM)).toMatchObject({ ok: true, mirrored: false });
  });

  it('rejects strokes that are not the letter, and says what is missing', () => {
    const no = (pts: Pt[], move = J, side = THUMB) => matchStroke(pts, move, side, PALM);
    expect(no(drawn(LINE_DOWN))).toMatchObject({ ok: false, hint: 'Add the hook at the bottom.' });
    expect(no(drawn(LINE_ACROSS)).ok).toBe(false);
    expect(no(circle()).ok).toBe(false);
    expect(no(drawn(Z.template, { side: Z_SIDE })).ok).toBe(false);

    expect(no(drawn(SEVEN, { side: Z_SIDE }), Z, Z_SIDE)).toMatchObject({ ok: false, hint: 'Add the last stroke across.' });
    expect(no(drawn(LINE_ACROSS), Z, Z_SIDE).ok).toBe(false);
    expect(no(circle(), Z, Z_SIDE).ok).toBe(false);
    expect(no(drawn(J.template, { side: THUMB }), Z, Z_SIDE).ok).toBe(false);
  });

  it('does not take a hand dropping diagonally for a J', () => {
    for (const tilt of [-35, -25, -15, 15, 25, 35]) {
      for (const side of [1, -1]) {
        expect(matchStroke(drawn(LINE_DOWN, { tilt, side }), J, THUMB, PALM).ok, `tilt ${tilt}`).toBe(false);
      }
    }
  });

  it('asks for a bigger drawing when it is tiny', () => {
    expect(matchStroke(drawn(Z.template, { side: Z_SIDE, size: 0.3 }), Z, Z_SIDE, PALM)).toMatchObject({
      ok: false,
      hint: 'Draw it bigger.',
    });
  });

  it('resamples a path to evenly spaced points', () => {
    const r = resample([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5);
    expect(r.map((p) => Math.round(p.x * 100) / 100)).toEqual([0, 2.5, 5, 7.5, 10]);
  });
});

describe('StrokeTracker', () => {
  /** Runs frames through a tracker; returns what matched, the phases seen and the last hint. */
  function run(tracker: StrokeTracker, frames: ReturnType<typeof holdThenDraw>) {
    let matched: { mirrored: boolean } | undefined;
    let hint: string | undefined;
    const phases = new Set<string>();
    for (const f of frames) {
      const s = tracker.update(f.tip, PALM, f.shapeOk, f.thumb, f.t);
      phases.add(s.phase);
      matched ??= s.matched;
      hint = s.hint;
    }
    return { matched, hint, phases: [...phases] };
  }

  it('matches a J drawn after holding the handshape', () => {
    const r = run(new StrokeTracker(J), holdThenDraw(J.template, { side: THUMB, ms: 800 }));
    expect(r.matched).toEqual({ mirrored: false });
    expect(r.phases).toEqual(['idle', 'ready', 'drawing']);
  });

  it('matches a Z drawn fast, slowly, and with a shaky hand', () => {
    for (const ms of [700, 1500, 3000]) {
      const r = run(new StrokeTracker(Z), holdThenDraw(Z.template, { side: Z_SIDE, ms, jitter: 0.03 }));
      expect(r.matched, `Z in ${ms} ms: ${r.hint}`).toEqual({ mirrored: false });
    }
  });

  it('needs the starting handshape first', () => {
    const frames = holdThenDraw(J.template, { side: THUMB, ms: 800 }).map((f) => ({ ...f, shapeOk: false }));
    const r = run(new StrokeTracker(J), frames);
    expect(r.matched).toBeUndefined();
    expect(r.phases).toEqual(['idle']);
  });

  it('forgives the handshape flickering mid-stroke', () => {
    const frames = holdThenDraw(J.template, { side: THUMB, ms: 900 });
    const mid = frames.findIndex((f) => f.t > 900);
    for (let i = mid; i < mid + 5; i++) frames[i] = { ...frames[i], shapeOk: false };
    expect(run(new StrokeTracker(J), frames).matched).toEqual({ mirrored: false });
  });

  it('explains a stroke that was not the letter, then is ready again', () => {
    const tracker = new StrokeTracker(J);
    const r = run(tracker, holdThenDraw(LINE_DOWN, { ms: 600 }));
    expect(r.matched).toBeUndefined();
    expect(r.hint).toBe('Add the hook at the bottom.');
    // Holding still again makes it ready for another try, and the next J counts.
    const again = run(tracker, holdThenDraw(J.template, { side: THUMB, ms: 800, startAt: 5000 }));
    expect(again.matched).toEqual({ mirrored: false });
  });

  it('still matches when the hand first moves up to where the letter starts', () => {
    const leadIn = [{ x: 0, y: 0.8 }, ...J.template];
    expect(run(new StrokeTracker(J), holdThenDraw(leadIn, { side: THUMB, ms: 1200 })).matched).toEqual({ mirrored: false });
  });

  it('ignores a hand that only trembles', () => {
    const still = holdThenDraw([{ x: 0, y: 0 }, { x: 0.02, y: 0.02 }], { ms: 1500, jitter: 0.03 });
    const r = run(new StrokeTracker(Z), still);
    expect(r.matched).toBeUndefined();
    expect(r.hint).toBeUndefined();
  });

  it('gives up on a stroke when the hand disappears', () => {
    const frames = holdThenDraw(Z.template, { side: Z_SIDE, ms: 1200 });
    const cut = frames.findIndex((f) => f.t > 900);
    const lost = frames.map((f, i) => (i >= cut ? { ...f, tip: undefined } : f));
    const r = run(new StrokeTracker(Z), lost);
    expect(r.matched).toBeUndefined();
    expect(r.hint).toBeUndefined();
  });
});
