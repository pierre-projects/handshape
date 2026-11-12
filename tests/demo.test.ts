import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoLoop } from '../app/src/lib/demo.svelte';

describe('a drill preview loop', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows each step for its time, then goes round again with the next example', () => {
    const loop = createDemoLoop(() => [1000, 2000], () => 1);
    const stop = loop.run();
    expect([loop.step, loop.round]).toEqual([0, 0]);
    vi.advanceTimersByTime(999);
    expect(loop.step).toBe(0);
    vi.advanceTimersByTime(1);
    expect(loop.step).toBe(1);
    vi.advanceTimersByTime(1999);
    expect([loop.step, loop.round]).toEqual([1, 0]);
    vi.advanceTimersByTime(1);
    expect([loop.step, loop.round]).toEqual([0, 1]);
    stop();
  });

  it('stops when told to, and starts again from the first step', () => {
    const loop = createDemoLoop(() => [500, 500, 500], () => 2);
    const stop = loop.run();
    vi.advanceTimersByTime(1100);
    expect(loop.step).toBe(2);
    stop();
    vi.advanceTimersByTime(5000);
    expect([loop.step, loop.round]).toEqual([2, 0]);
    loop.run();
    expect(loop.step).toBe(0);
  });

  it('stays on one finished step when the device asks for less motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    const loop = createDemoLoop(() => [1000, 2000], () => 1);
    loop.run();
    expect(loop.step).toBe(1);
    vi.advanceTimersByTime(10000);
    expect([loop.step, loop.round]).toEqual([1, 0]);
  });
});
