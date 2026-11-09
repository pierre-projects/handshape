// Progress numbers. Each one answers "am I getting faster?" from a different angle.
import { State, Rating } from 'ts-fsrs';
import { endOfDay, startOfDay } from './srs';
import type { ReviewEntry, SpellingAttempt, StoredCard } from './types';

export interface CardCounts {
  dueNow: number;
  dueToday: number;
  learning: number;
  mature: number;
  total: number;
}

/** Mature means FSRS expects to keep the card for three weeks or more. */
export const MATURE_DAYS = 21;

export function cardCounts(cards: Iterable<StoredCard>, now: Date): CardCounts {
  const counts: CardCounts = { dueNow: 0, dueToday: 0, learning: 0, mature: 0, total: 0 };
  const end = endOfDay(now).getTime();
  for (const c of cards) {
    counts.total++;
    const due = c.fsrs.due.getTime();
    if (due <= now.getTime()) counts.dueNow++;
    if (due < end) counts.dueToday++;
    if (c.fsrs.state === State.Review && c.fsrs.scheduled_days >= MATURE_DAYS) counts.mature++;
    else counts.learning++;
  }
  return counts;
}

/**
 * Share of reviews of already-learned cards (state Review) that were not
 * forgotten. This is the number FSRS tries to hold near its 90% target.
 */
export function retention(reviews: ReviewEntry[], since: Date): number | undefined {
  const relevant = reviews.filter((r) => r.stateBefore === State.Review && r.at >= since);
  if (relevant.length === 0) return undefined;
  return relevant.filter((r) => r.rating !== Rating.Again).length / relevant.length;
}

/** Consecutive days, ending today or yesterday, with at least one review or attempt. */
export function streak(dates: Date[], now: Date): number {
  const days = new Set(dates.map((d) => startOfDay(d).getTime()));
  const cursor = startOfDay(now);
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (days.has(cursor.getTime())) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/** Activity per day for the last `days` days, oldest first. */
export function dailyActivity(dates: Date[], now: Date, days = 14): { day: Date; count: number }[] {
  const out: { day: Date; count: number }[] = [];
  const counts = new Map<number, number>();
  for (const d of dates) {
    const k = startOfDay(d).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const cursor = startOfDay(now);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    out.push({ day: new Date(cursor), count: counts.get(cursor.getTime()) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface ItemAccuracy {
  itemId: string;
  attempts: number;
  missed: number;
  rate: number;
}

/** Recognize-card miss rates per item, worst first. Only items with enough data. */
export function weakestItems(reviews: ReviewEntry[], minAttempts = 3): ItemAccuracy[] {
  const by = new Map<string, ItemAccuracy>();
  for (const r of reviews) {
    if (r.kind !== 'recognize' || r.correct === undefined) continue;
    const a = by.get(r.itemId) ?? { itemId: r.itemId, attempts: 0, missed: 0, rate: 0 };
    a.attempts++;
    if (!r.correct) a.missed++;
    a.rate = a.missed / a.attempts;
    by.set(r.itemId, a);
  }
  return [...by.values()]
    .filter((a) => a.attempts >= minAttempts && a.missed > 0)
    .sort((a, b) => b.rate - a.rate);
}

export function activityDates(reviews: ReviewEntry[], attempts: SpellingAttempt[]): Date[] {
  return [...reviews.map((r) => r.at), ...attempts.map((a) => a.at)];
}
