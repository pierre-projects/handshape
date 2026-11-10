import { describe, expect, it } from 'vitest';
import { computeFeatures } from '../app/src/lib/engine/features';
import { evaluate, judge, looksLike, SPECS, T, thumbSticksOut } from '../app/src/lib/engine/handshapes';
import { HoldTimer, Smoother } from '../app/src/lib/engine/tracker';
import { content } from '../app/src/lib/content';
import { buildHand, STRAIGHT, type Pose } from './helpers/synthHand';
import { POSES, REAL, TWINS } from './helpers/poses';
import { classifyLetter } from '../app/src/lib/engine/reader';

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
    expect(hint('2', 'v')).toBe('Turn your palm to face you, so the camera sees the back of your hand.');
    expect(hint('v', '2')).toBe('Turn your palm to face out, toward the camera.');
  });

  it('does not say "straighten" to a finger that is straight but leaning forward', () => {
    // K's middle finger held for V: straight in itself, bent only at the knuckle.
    const e = evaluate('v', feats(POSES.k));
    expect(e.hint).toBe('Your middle finger is leaning forward at the knuckle. Lift it up in line with your palm.');
    expect(e.focus).toEqual(['middle']);
    // A finger that really is bent is still told to straighten.
    expect(hint('b', 'c')).toBe('Straighten your index finger.');
  });

  it('names the part of the hand each hint is about', () => {
    expect(evaluate('l', feats(POSES.a)).focus).toEqual(['index']);
    expect(evaluate('3', feats(POSES['2'])).focus).toEqual(['thumb']);
    expect(evaluate('2', feats(POSES.v)).focus).toEqual(['hand']);
    expect(evaluate('d', feats(POSES.z)).focus).toEqual(['thumb', 'middle']);
    expect(evaluate('a', feats(POSES.a)).focus).toEqual([]);
    // When a rival sign matches fully, the doubtful thumb check becomes the thing to fix.
    expect(judge('a', feats(POSES.m)).focus).toEqual(['thumb']);
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

describe('P is not too strict', () => {
  it('accepts P tipped part-way down, not just straight down', () => {
    for (const deg of [115, 135, 160]) {
      const e = judge('p', feats({ ...POSES.k, transforms: [{ rotateZ: deg }] }));
      expect(e.pass, `P at ${deg}°`).toBe(true);
    }
  });
  it('does not let an upright K count as P', () => {
    const j = judge('p', feats(POSES.k));
    expect(j.pass).toBe(false);
    expect(j.hint).toBe('Tip your hand down so your middle finger points toward the floor.');
  });

  it('accepts a middle finger angled far forward, which reads as a lot of total bend', () => {
    for (const [sign, name] of [['k', 'kSteep'], ['p', 'pSteep']] as const) {
      const f = feats(REAL[name]);
      // Why these used to fail: total bend counts the knuckle, and the old limit was 65.
      expect(f.curl.middle, `${name} total bend`).toBeGreaterThan(65);
      expect(f.tipBend.middle, `${name} finger's own bend`).toBeLessThan(T.straightTipMax);
      expect(judge(sign, f).pass, name).toBe(true);
      expect(looksLike(f, ids, sign), `${name} look-alikes`).toEqual([]);
    }
    expect(feats(POSES.k).curl.middle).toBeGreaterThan(65);
    expect(feats(POSES.p).curl.middle).toBeGreaterThan(65);
  });

  it('accepts P when the camera can barely see the index, ring and pinky', () => {
    const f = feats(REAL.pHidden);
    expect(f.curl.index).toBeGreaterThan(T.extendedMax.index);
    expect(f.curl.ring).toBeLessThan(T.curledMin);
    const j = judge('p', f);
    expect(j.pass).toBe(true);
    // The index is still mentioned, as advice.
    expect(j.unsure.join(' ')).toMatch(/index finger/);
  });

  it('still wants the middle finger straight and the other fingers folded', () => {
    const bentMiddle = { ...POSES.p, fingers: { ...POSES.p.fingers, middle: [70, 60, 30, -12] as [number, number, number, number] } };
    expect(judge('p', feats(bentMiddle)).hint).toBe('Keep your middle finger straight; bend it only where it meets your hand.');
    const openHand = { ...POSES.p, fingers: { ...POSES.p.fingers, ring: STRAIGHT, pinky: STRAIGHT } };
    expect(judge('p', feats(openHand)).hint).toBe('Fold your ring finger down.');
  });

  it('works left-handed', () => {
    for (const name of ['kSteep', 'pSteep', 'pHidden']) {
      const sign = name[0];
      expect(judge(sign, feats({ ...REAL[name], hand: 'Left' })).pass, name).toBe(true);
    }
  });
});

describe('numbers 1 to 5 are not too strict', () => {
  const PALM = 'Turn your palm to face you, so the camera sees the back of your hand.';
  /** The thumb test before it looked at which side of the hand the thumb is on. */
  const oldThumbOut = (f: ReturnType<typeof feats>) => f.thumbBend <= T.thumbStraightMax && f.thumbOut >= T.thumbOutMin;

  it('1: the thumb may rest right by the folded middle fingertip', () => {
    const f = feats(REAL.one);
    // The old rule wanted the thumb at least 0.4 palm lengths from that fingertip.
    expect(f.thumbTo.middleTip).toBeLessThan(0.4);
    expect(judge('1', f).pass).toBe(true);
    expect(judge('d', f).pass).toBe(false);
  });

  it('2: a thumb laid across the palm is not read as stuck out', () => {
    const f = feats(REAL.two);
    expect(oldThumbOut(f)).toBe(true);
    expect(thumbSticksOut(f)).toBe(false);
    expect(judge('2', f).pass).toBe(true);
    expect(judge('3', f).pass).toBe(false);
  });

  it('4: curved ring and pinky fingers and a thumb across the palm still count, and it is not a 5', () => {
    const f = feats(REAL.four);
    expect(f.curl.ring).toBeGreaterThan(65);
    expect(f.curl.pinky).toBeGreaterThan(65);
    expect(oldThumbOut(f)).toBe(true);
    const j = judge('4', f);
    expect(j.pass).toBe(true);
    expect(j.rivals).toEqual([]);
    expect(judge('5', f).pass).toBe(false);
  });

  it('5: the middle and ring fingers need not spread far', () => {
    const f = feats(REAL.fiveRelaxed);
    expect(f.spread.mr).toBeLessThan(T.spreadMin);
    expect(f.curl.pinky).toBeGreaterThan(65);
    expect(judge('5', f).pass).toBe(true);
    const four = judge('4', f);
    expect(four.pass).toBe(false);
    expect(four.hint).toBe('Fold your thumb across your palm.');
  });

  it('still needs the palm toward you, and says so first', () => {
    for (const [sign, name] of [['1', 'one'], ['2', 'two'], ['4', 'four'], ['5', 'fiveRelaxed']]) {
      const j = judge(sign, feats({ ...REAL[name], transforms: [] }));
      expect(j.pass, `${sign} palm out`).toBe(false);
      expect(j.hint, `${sign} palm out`).toBe(PALM);
      expect(j.focus).toEqual(['hand']);
    }
  });

  it('still needs the fingers fanned for 4 and 5', () => {
    const closed = { ...POSES['5'], fingers: POSES.b.fingers };
    expect(judge('5', feats(closed)).hint).toBe('Spread all your fingers apart.');
  });

  it('never lets one thumb count as both tucked and out', () => {
    // Sweep the thumb from across the palm round to straight out to the side.
    for (let deg = -80; deg <= 80; deg += 10) {
      const a = (deg * Math.PI) / 180;
      const thumb = { line: [Math.sin(a), -Math.cos(a) * 0.8, deg < 0 ? -0.4 : 0] as [number, number, number] };
      const two = feats({ ...REAL.two, thumb });
      expect(evaluate('2', two).pass && evaluate('3', two).pass, `2 and 3 at ${deg}`).toBe(false);
      const four = feats({ ...REAL.four, thumb });
      expect(evaluate('4', four).pass && evaluate('5', four).pass, `4 and 5 at ${deg}`).toBe(false);
      if (deg < 0) expect(thumbSticksOut(two), `across the palm at ${deg}`).toBe(false);
    }
  });

  it('works left-handed', () => {
    for (const [sign, name] of [['1', 'one'], ['2', 'two'], ['4', 'four'], ['5', 'fiveRelaxed']]) {
      expect(judge(sign, feats({ ...REAL[name], hand: 'Left' })).pass, name).toBe(true);
    }
  });
});

describe('T and X are told apart', () => {
  it('accepts a real T, with the index resting on the thumb, and never calls it X', () => {
    for (const name of ['t', 'tLoose', 'tHigh']) {
      const f = feats(REAL[name]);
      const j = judge('t', f);
      expect(j.pass, `${name} as T`).toBe(true);
      expect(j.rivals, `${name} rivals`).not.toContain('x');
      expect(judge('x', f).pass, `${name} as X`).toBe(false);
      expect(classifyLetter(f), `${name} read`).toBe('t');
    }
  });

  it('tells the learner to fold the index when an X is held for T', () => {
    const j = judge('t', feats(POSES.x));
    expect(j.pass).toBe(false);
    expect(j.hint).toBe('Fold your index finger down over your thumb, not up in a hook.');
  });

  it('still accepts X, even when the index is not raised all the way', () => {
    for (const pose of [POSES.x, REAL.xLazy]) {
      const f = feats(pose);
      expect(judge('x', f).pass).toBe(true);
      expect(judge('t', f).pass).toBe(false);
      expect(classifyLetter(f)).toBe('x');
    }
  });

  it('never lets one hand count as both', () => {
    for (let knuckle = 10; knuckle <= 90; knuckle += 5) {
      const f = feats({ ...REAL.t, fingers: { ...REAL.t.fingers, index: [knuckle, 92, 50, 0] } });
      expect(evaluate('t', f).pass && evaluate('x', f).pass, `index knuckle ${knuckle}`).toBe(false);
    }
  });
});
