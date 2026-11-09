import { describe, expect, it } from 'vitest';
import { cardCounts, dailyActivity, retention, streak, weakestItems } from '../app/src/lib/stats';
import { newCard, Rating, State } from '../app/src/lib/srs';
import type { ReviewEntry } from '../app/src/lib/types';

const now = new Date('2026-11-09T12:00:00');
const day = (d: number, h = 9) => new Date(2026, 10, d, h);
const review = (over: Partial<ReviewEntry>): ReviewEntry => ({
  cardId: 'a:recognize', itemId: 'a', kind: 'recognize', rating: Rating.Good, stateBefore: State.Review, at: now, ...over,
});

describe('cardCounts', () => {
  it('splits due now, due today and mature', () => {
    const base = newCard('a', 'produce', day(1));
    const cards = [
      { ...base, fsrs: { ...base.fsrs, due: day(9, 8) } },
      { ...base, fsrs: { ...base.fsrs, due: day(9, 20) } },
      { ...base, fsrs: { ...base.fsrs, due: day(30), state: State.Review, scheduled_days: 30 } },
    ];
    expect(cardCounts(cards, now)).toEqual({ dueNow: 1, dueToday: 2, learning: 2, mature: 1, total: 3 });
  });
});

describe('retention', () => {
  it('only counts reviews of learned cards in the window', () => {
    const rs = [
      review({ rating: Rating.Good }),
      review({ rating: Rating.Again }),
      review({ rating: Rating.Again, stateBefore: State.Learning }),
      review({ rating: Rating.Again, at: day(1) }),
    ];
    expect(retention(rs, day(5))).toBe(0.5);
    expect(retention([], day(5))).toBeUndefined();
  });
});

describe('streak', () => {
  it('counts back from today, or from yesterday if today is empty', () => {
    expect(streak([day(9), day(8), day(7), day(5)], now)).toBe(3);
    expect(streak([day(8), day(7)], now)).toBe(2);
    expect(streak([day(6)], now)).toBe(0);
  });
});

describe('dailyActivity', () => {
  it('returns one bucket per day, oldest first', () => {
    const a = dailyActivity([day(9), day(9), day(8)], now, 3);
    expect(a.map((x) => x.count)).toEqual([0, 1, 2]);
  });
});

describe('weakestItems', () => {
  it('ranks recognize misses, ignoring items with little data', () => {
    const rs = [
      ...Array(4).fill(0).map((_, i) => review({ itemId: 'm', correct: i > 1 })),
      ...Array(4).fill(0).map((_, i) => review({ itemId: 'n', correct: i > 0 })),
      review({ itemId: 'x', correct: false }),
    ];
    expect(weakestItems(rs).map((w) => w.itemId)).toEqual(['m', 'n']);
  });
});
