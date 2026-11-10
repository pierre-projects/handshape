import { describe, expect, it } from 'vitest';
import { Steady } from '../app/src/lib/engine/tracker';

/** Pushes one value per 33 ms frame and returns what was shown each frame. */
function play(s: Steady<string>, values: string[], urgentAt: number[] = []): string[] {
  return values.map((v, i) => s.push(v, i * 33, urgentAt.includes(i)));
}

describe('Steady', () => {
  it('shows the first value at once', () => {
    expect(new Steady<string>(400).push('Hold your hand up', 0)).toBe('Hold your hand up');
  });

  it('ignores a value that flickers for a few frames', () => {
    const shown = play(new Steady<string>(400), ['Hold A', 'Hold still', 'Hold A', 'Hold still', 'Hold still', 'Hold A', 'Hold A']);
    expect(new Set(shown)).toEqual(new Set(['Hold A']));
  });

  it('switches once a new value has held for the settle time', () => {
    const values = ['Make a letter', ...Array(20).fill('Hold A')];
    const shown = play(new Steady<string>(400), values);
    const first = shown.indexOf('Hold A');
    // Asked for from frame 1 (33 ms); shown once 400 ms have passed since then.
    expect(first * 33 - 33).toBeGreaterThanOrEqual(400);
    expect(first * 33 - 33).toBeLessThan(400 + 33);
    expect(shown.slice(first).every((x) => x === 'Hold A')).toBe(true);
  });

  it('restarts the wait when the new value keeps changing', () => {
    // Alternating between two new messages: neither is steady, so the old one stays.
    const values = ['Make a letter', ...Array(30).fill(0).map((_, i) => (i % 2 ? 'Hold B' : 'Hold still'))];
    expect(new Set(play(new Steady<string>(400), values))).toEqual(new Set(['Make a letter']));
  });

  it('shows an urgent value at once', () => {
    const shown = play(new Steady<string>(400), ['Hold A', 'Hold A', 'Got it'], [2]);
    expect(shown[2]).toBe('Got it');
  });

  it('starts fresh after a reset', () => {
    const s = new Steady<string>(400);
    s.push('Hold A', 0);
    s.reset();
    expect(s.push('Hold your hand up', 10)).toBe('Hold your hand up');
  });

  it('compares with the given test, so equal messages count as the same', () => {
    type M = { tone: string; text: string };
    const s = new Steady<M>(400, (a, b) => a.text === b.text && a.tone === b.tone);
    const first = s.push({ tone: 'bad', text: 'Fold your ring finger down.' }, 0);
    // A new object with the same words doesn't count as a change, and doesn't reset a pending one.
    expect(s.push({ tone: 'bad', text: 'Fold your ring finger down.' }, 33)).toEqual(first);
    s.push({ tone: 'good', text: 'Hold it…' }, 66);
    expect(s.push({ tone: 'good', text: 'Hold it…' }, 500).text).toBe('Hold it…');
  });
});
