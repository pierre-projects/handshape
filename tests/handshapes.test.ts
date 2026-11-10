import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate, judge, looksLike, SPECS } from '../app/src/lib/engine/handshapes';
import { HoldTimer, Smoother } from '../app/src/lib/engine/tracker';
import { content } from '../app/src/lib/content';
import { buildHand, type Pose } from './helpers/synthHand';
import { POSES, TWINS } from './helpers/poses';

const feats = (pose: Pose) => computeFeatures(buildHand(pose));
const ids = [...SPECS.keys()];

describe('handshape specs', () => {
  it('cover every letter and number in the content', () => {
    const missing = content.items.filter((i) => i.kind !== 'sign' && !SPECS.has(i.id)).map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it('have a model pose for every spec', () => {
    expect(ids.filter((id) => !POSES[id])).toEqual([]);
  });
});

describe('each model pose matches its own sign', () => {
  for (const id of Object.keys(POSES)) {
    it(id, () => {
      const e = evaluate(id, feats(POSES[id]));
      const failed = e.results.filter((r) => !r.pass).map((r) => r.id);
      expect(failed).toEqual([]);
      expect(e.passAll).toBe(true);
    });
  }
});

describe('model poses are told apart', () => {
  for (const id of Object.keys(POSES)) {
    it(`${id} matches no other sign except its twins`, () => {
      const others = looksLike(feats(POSES[id]), ids, id).filter((x) => !(TWINS[id] ?? []).includes(x));
      expect(others).toEqual([]);
    });
  }
});

describe('left hands', () => {
  for (const id of ['a', 'b', 'd', 'g', 'k', 'l', 'r', 'v', 'y', '1', '5']) {
    it(`${id} works mirrored`, () => {
      expect(evaluate(id, feats({ ...POSES[id], hand: 'Left' })).passAll).toBe(true);
    });
  }
});

describe('hints', () => {
  const hint = (target: string, pose: string) => evaluate(target, feats(POSES[pose])).hint;

  it('says what to fix for common mix-ups', () => {
    expect(hint('v', 'u')).toBe('Spread your index and middle fingers apart.');
    expect(hint('u', 'v')).toBe('Keep your index and middle fingers together.');
    expect(hint('u', 'r')).toBe('Uncross your fingers.');
    expect(hint('l', 'a')).toBe('Straighten your index finger.');
    expect(hint('d', '1')).toBe('Touch your thumb to your middle fingertip.');
    expect(hint('g', 'q')).toBe('Turn your hand so your index finger points sideways.');
    expect(hint('2', 'v')).toBe('Turn your palm to face you.');
    expect(hint('v', '2')).toBe('Turn your palm to face out, toward the camera.');
  });

  it('marks hidden thumb positions as unsure instead of failing', () => {
    const e = evaluate('n', feats(POSES.m));
    expect(e.pass).toBe(true);
    expect(e.passAll).toBe(false);
    expect(e.unsure.length).toBeGreaterThan(0);
  });

  it('flags movement signs', () => {
    expect(evaluate('j', feats(POSES.j)).movement).toMatch(/J/);
    expect(evaluate('a', feats(POSES.a)).movement).toBeUndefined();
  });
});

describe('HoldTimer', () => {
  it('reaches 1 after the hold time and forgives a short flicker', () => {
    const t = new HoldTimer(600, 2);
    expect(t.update(true, 0)).toBe(0);
    expect(t.update(true, 300)).toBeCloseTo(0.5);
    expect(t.update(false, 330)).toBeCloseTo(0.55);
    expect(t.update(true, 600)).toBe(1);
  });
  it('resets after several misses', () => {
    const t = new HoldTimer(600, 1);
    t.update(true, 0);
    t.update(false, 100);
    t.update(false, 200);
    expect(t.update(true, 300)).toBe(0);
  });
});

describe('Smoother', () => {
  it('averages successive frames of the same hand', () => {
    const sm = new Smoother(0.5);
    const a = buildHand(POSES.b);
    const b = { ...a, image: a.image.map((p) => ({ ...p, x: p.x + 0.1 })) };
    sm.push(a);
    expect(sm.push(b).image[0].x).toBeCloseTo(a.image[0].x + 0.05);
  });
});

describe('judge: one held shape cannot pass for another sign', () => {
  const still = ids.filter((i) => !SPECS.get(i)!.movement);
  for (const pose of Object.keys(POSES)) {
    it(`${pose} passes only itself and its twins`, () => {
      const f = feats(POSES[pose]);
      expect(judge(pose, f).pass).toBe(true);
      const leaks = still.filter((t) => t !== pose && !(TWINS[pose] ?? []).includes(t) && judge(t, f).pass);
      expect(leaks).toEqual([]);
    });
  }

  it('rejects M held for A and names the rival', () => {
    const j = judge('a', feats(POSES.m));
    expect(j.pass).toBe(false);
    expect(j.rivals).toContain('m');
  });

  it('rejects the fist family for each other', () => {
    for (const [held, target] of [['m', 'n'], ['n', 'm'], ['s', 'a'], ['a', 's'], ['t', 'a'], ['e', 's']]) {
      expect(judge(target, feats(POSES[held])).pass, `${held} held for ${target}`).toBe(false);
    }
  });
});
