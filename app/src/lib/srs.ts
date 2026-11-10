// Spaced repetition on top of FSRS. Every drill feeds this one queue.
import { fsrs, createEmptyCard, Rating, State, type Grade } from 'ts-fsrs';
import type { CardKind, ResolvedItem, ReviewEntry, StoredCard } from './types';

export { Rating, State };
export type { Grade };

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

/** Cards due within this window come back in the same session. */
export const SESSION_LOOKAHEAD_MS = 20 * 60 * 1000;
/** Cards due almost immediately are reinserted a few cards later, not at once. */
const SOON_MS = 2 * 60 * 1000;
const SOON_GAP = 3;

export function cardId(itemId: string, kind: CardKind): string {
  return `${itemId}:${kind}`;
}

/** Recognize cards need local media; produce cards work for every item. */
export function cardKindsFor(item: Pick<ResolvedItem, 'files'>): CardKind[] {
  return item.files.length > 0 ? ['recognize', 'produce'] : ['produce'];
}

export function newCard(itemId: string, kind: CardKind, now: Date): StoredCard {
  return { id: cardId(itemId, kind), itemId, kind, introducedAt: now, fsrs: createEmptyCard(now) };
}

export function gradeCard(
  card: StoredCard,
  rating: Grade,
  now: Date,
  extra: Pick<ReviewEntry, 'correct' | 'typed' | 'camera'> = {},
): { card: StoredCard; entry: ReviewEntry } {
  const result = scheduler.next(card.fsrs, now, rating);
  return {
    card: { ...card, fsrs: result.card },
    entry: {
      cardId: card.id,
      itemId: card.itemId,
      kind: card.kind,
      rating,
      stateBefore: card.fsrs.state,
      at: now,
      ...extra,
    },
  };
}

export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(now: Date): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

export interface QueueOptions {
  now: Date;
  newItemsPerDay: number;
}

export interface Queue {
  due: StoredCard[];
  fresh: StoredCard[];
  /** Items introduced today, counted against the daily budget. */
  introducedToday: number;
  /** Items still waiting to be introduced, beyond today's budget. */
  newRemaining: number;
}

/**
 * Builds today's queue: due cards first (oldest due first), then cards for new
 * items in content order, up to the daily budget. When media is added to an
 * item already being learned, its new recognize card is added without using
 * the budget.
 */
export function buildQueue(
  items: Pick<ResolvedItem, 'id' | 'files'>[],
  stored: Map<string, StoredCard>,
  { now, newItemsPerDay }: QueueOptions,
): Queue {
  const due = [...stored.values()]
    .filter((c) => c.fsrs.due.getTime() <= now.getTime())
    .sort((a, b) => a.fsrs.due.getTime() - b.fsrs.due.getTime());

  const dayStart = startOfDay(now).getTime();
  const introducedItems = new Set<string>();
  for (const c of stored.values()) {
    if (c.introducedAt.getTime() >= dayStart) introducedItems.add(c.itemId);
  }
  let budget = Math.max(0, newItemsPerDay - introducedItems.size);

  const fresh: StoredCard[] = [];
  let newRemaining = 0;
  for (const item of items) {
    const kinds = cardKindsFor(item);
    const missing = kinds.filter((k) => !stored.has(cardId(item.id, k)));
    if (missing.length === 0) continue;
    const alreadyStarted = missing.length < kinds.length;
    if (alreadyStarted) {
      for (const k of missing) fresh.push(newCard(item.id, k, now));
    } else if (budget > 0) {
      budget--;
      for (const k of missing) fresh.push(newCard(item.id, k, now));
    } else {
      newRemaining++;
    }
  }
  return { due, fresh, introducedToday: introducedItems.size, newRemaining };
}

/** Normalises a typed answer for comparison: trims, uppercases, drops spaces. */
export function normaliseAnswer(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

export function checkAnswer(expected: string, typed: string): boolean {
  return normaliseAnswer(expected) === normaliseAnswer(typed);
}

/** Grade a recognize card gets by default; the learner can override it. */
export function suggestedRating(correct: boolean): Grade {
  return correct ? Rating.Good : Rating.Again;
}

/**
 * The cards for one sitting. Answering removes the current card; if FSRS
 * schedules it again within the lookahead window it comes back later in the
 * same session, which is how learning steps play out.
 */
export class ReviewSession {
  private queue: StoredCard[];
  done = 0;

  constructor(cards: StoredCard[]) {
    this.queue = [...cards];
  }

  get current(): StoredCard | undefined {
    return this.queue[0];
  }

  get remaining(): number {
    return this.queue.length;
  }

  answer(
    rating: Grade,
    now: Date,
    extra: Pick<ReviewEntry, 'correct' | 'typed' | 'camera'> = {},
  ): { card: StoredCard; entry: ReviewEntry } {
    const current = this.queue.shift();
    if (!current) throw new Error('No card to answer');
    const result = gradeCard(current, rating, now, extra);
    this.done++;
    const wait = result.card.fsrs.due.getTime() - now.getTime();
    if (wait <= SOON_MS) {
      this.queue.splice(Math.min(this.queue.length, SOON_GAP), 0, result.card);
    } else if (wait <= SESSION_LOOKAHEAD_MS) {
      this.queue.push(result.card);
    }
    return result;
  }
}

export const GRADES: { rating: Grade; label: string; key: string }[] = [
  { rating: Rating.Again, label: 'Again', key: '1' },
  { rating: Rating.Hard, label: 'Hard', key: '2' },
  { rating: Rating.Good, label: 'Good', key: '3' },
  { rating: Rating.Easy, label: 'Easy', key: '4' },
];

/** How long until the card comes back for each grade, in milliseconds. */
export function previewIntervals(card: StoredCard, now: Date): Record<number, number> {
  const preview = scheduler.repeat(card.fsrs, now);
  const out: Record<number, number> = {};
  for (const { rating } of GRADES) out[rating] = preview[rating].card.due.getTime() - now.getTime();
  return out;
}

type Unit = 'min' | 'hour' | 'day' | 'month' | 'year';

/** A wait rounded to the largest sensible unit. */
function intervalParts(ms: number): { n: number; unit: Unit } {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return { n: min, unit: 'min' };
  const h = Math.round(min / 60);
  if (h < 24) return { n: h, unit: 'hour' };
  const d = Math.round(h / 24);
  if (d < 31) return { n: d, unit: 'day' };
  const mo = Math.round(d / 30);
  if (mo < 12) return { n: mo, unit: 'month' };
  return { n: Math.round(d / 365), unit: 'year' };
}

/** In words, e.g. "in 10 min", "tomorrow", "in 3 days". */
export function describeInterval(ms: number): string {
  const { n, unit } = intervalParts(ms);
  if (unit === 'day' && n === 1) return 'tomorrow';
  if (unit === 'min') return `in ${n} min`;
  return `in ${n} ${unit}${n === 1 ? '' : 's'}`;
}
