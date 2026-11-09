import { describe, expect, it } from 'vitest';
import {
  buildQueue, cardId, cardKindsFor, checkAnswer, gradeCard, newCard, Rating, ReviewSession, State, suggestedRating,
} from '../app/src/lib/srs';
import type { StoredCard } from '../app/src/lib/types';

const now = new Date('2026-11-09T10:00:00');
const withMedia = (id: string) => ({ id, files: [{ url: 'x' }] as never[] });
const noMedia = (id: string) => ({ id, files: [] });

describe('cardKindsFor', () => {
  it('adds a recognize card only when the item has local media', () => {
    expect(cardKindsFor(noMedia('a'))).toEqual(['produce']);
    expect(cardKindsFor(withMedia('a'))).toEqual(['recognize', 'produce']);
  });
});

describe('buildQueue', () => {
  const items = ['a', 'b', 'c', 'd'].map(noMedia);

  it('introduces new items in order up to the daily budget', () => {
    const q = buildQueue(items, new Map(), { now, newItemsPerDay: 2 });
    expect(q.fresh.map((c) => c.id)).toEqual(['a:produce', 'b:produce']);
    expect(q.newRemaining).toBe(2);
  });

  it('counts items introduced earlier today against the budget', () => {
    const stored = new Map([['a:produce', newCard('a', 'produce', new Date('2026-11-09T08:00:00'))]]);
    const q = buildQueue(items, stored, { now, newItemsPerDay: 2 });
    expect(q.introducedToday).toBe(1);
    expect(q.fresh.map((c) => c.itemId)).toEqual(['b']);
  });

  it('does not count items introduced yesterday', () => {
    const stored = new Map([['a:produce', newCard('a', 'produce', new Date('2026-11-08T08:00:00'))]]);
    const q = buildQueue(items, stored, { now, newItemsPerDay: 2 });
    expect(q.fresh.map((c) => c.itemId)).toEqual(['b', 'c']);
  });

  it('returns due cards oldest first and leaves future cards out', () => {
    const mk = (id: string, due: string): StoredCard => {
      const c = newCard(id, 'produce', new Date('2026-11-01'));
      return { ...c, fsrs: { ...c.fsrs, due: new Date(due) } };
    };
    const stored = new Map<string, StoredCard>([
      ['a:produce', mk('a', '2026-11-09T09:00:00')],
      ['b:produce', mk('b', '2026-11-08T09:00:00')],
      ['c:produce', mk('c', '2026-11-10T09:00:00')],
    ]);
    const q = buildQueue(items, stored, { now, newItemsPerDay: 0 });
    expect(q.due.map((c) => c.itemId)).toEqual(['b', 'a']);
  });

  it('adds a recognize card for media added later without using the budget', () => {
    const stored = new Map([['a:produce', newCard('a', 'produce', new Date('2026-11-01'))]]);
    const q = buildQueue([withMedia('a'), noMedia('b')], stored, { now, newItemsPerDay: 0 });
    expect(q.fresh.map((c) => c.id)).toEqual(['a:recognize']);
  });
});

describe('gradeCard', () => {
  it('records the state before the review and schedules forward', () => {
    const card = newCard('a', 'produce', now);
    const { card: next, entry } = gradeCard(card, Rating.Good, now);
    expect(entry.stateBefore).toBe(State.New);
    expect(entry.cardId).toBe(cardId('a', 'produce'));
    expect(next.fsrs.due.getTime()).toBeGreaterThan(now.getTime());
    expect(next.fsrs.reps).toBe(1);
  });
});

describe('ReviewSession', () => {
  it('brings a missed card back a few cards later', () => {
    const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => newCard(id, 'produce', now));
    const s = new ReviewSession(cards);
    s.answer(Rating.Again, now);
    const order: string[] = [];
    for (let i = 0; i < 4; i++) {
      order.push(s.current!.itemId);
      s.answer(Rating.Easy, now);
    }
    expect(order).toEqual(['b', 'c', 'd', 'a']);
  });

  it('drops a card once it is scheduled beyond the session', () => {
    const s = new ReviewSession([newCard('a', 'produce', now)]);
    s.answer(Rating.Easy, now);
    expect(s.remaining).toBe(0);
    expect(s.done).toBe(1);
  });
});

describe('answers', () => {
  it('ignores case and surrounding space', () => {
    expect(checkAnswer('K', ' k ')).toBe(true);
    expect(checkAnswer('10', '1 0')).toBe(true);
    expect(checkAnswer('K', 'v')).toBe(false);
  });
  it('suggests Good for correct and Again for wrong', () => {
    expect(suggestedRating(true)).toBe(Rating.Good);
    expect(suggestedRating(false)).toBe(Rating.Again);
  });
});

import { formatInterval, previewIntervals } from '../app/src/lib/srs';

describe('intervals', () => {
  it('formats durations compactly', () => {
    expect(formatInterval(30 * 1000)).toBe('1m');
    expect(formatInterval(10 * 60 * 1000)).toBe('10m');
    expect(formatInterval(3 * 3600 * 1000)).toBe('3h');
    expect(formatInterval(4 * 86400 * 1000)).toBe('4d');
    expect(formatInterval(90 * 86400 * 1000)).toBe('3mo');
    expect(formatInterval(800 * 86400 * 1000)).toBe('2y');
  });
  it('previews a shorter interval for Again than for Easy', () => {
    const p = previewIntervals(newCard('a', 'produce', now), now);
    expect(Object.keys(p)).toHaveLength(4);
    expect(p[Rating.Again]).toMatch(/m$/);
  });
});
