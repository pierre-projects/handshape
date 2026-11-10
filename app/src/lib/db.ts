// All learner data lives in IndexedDB on this device. Export/import is a plain JSON file.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { migrateSettings } from './lists';
import { DEFAULT_SETTINGS, type ReviewEntry, type Settings, type SpellingAttempt, type StoredCard } from './types';

interface AslDB extends DBSchema {
  cards: { key: string; value: StoredCard };
  reviews: { key: number; value: ReviewEntry; indexes: { at: Date } };
  attempts: { key: number; value: SpellingAttempt; indexes: { at: Date } };
  settings: { key: string; value: { key: string; value: Settings } };
}

export const EXPORT_VERSION = 1;

export interface ExportFile {
  app: 'asl';
  version: number;
  exportedAt: string;
  settings: Settings;
  cards: StoredCard[];
  reviews: ReviewEntry[];
  attempts: SpellingAttempt[];
}

export class Store {
  private constructor(private db: IDBPDatabase<AslDB>) {}

  static async open(name = 'asl'): Promise<Store> {
    const db = await openDB<AslDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('cards', { keyPath: 'id' });
        db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
        db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
    return new Store(db);
  }

  close(): void {
    this.db.close();
  }

  async cards(): Promise<Map<string, StoredCard>> {
    const all = await this.db.getAll('cards');
    return new Map(all.map((c) => [c.id, c]));
  }

  /** Saves a graded card and its review entry in one transaction. */
  async recordReview(card: StoredCard, entry: ReviewEntry): Promise<void> {
    const tx = this.db.transaction(['cards', 'reviews'], 'readwrite');
    await Promise.all([tx.objectStore('cards').put(card), tx.objectStore('reviews').add(entry), tx.done]);
  }

  async reviews(since?: Date): Promise<ReviewEntry[]> {
    if (!since) return this.db.getAll('reviews');
    return this.db.getAllFromIndex('reviews', 'at', IDBKeyRange.lowerBound(since));
  }

  async addAttempt(attempt: SpellingAttempt): Promise<void> {
    await this.db.add('attempts', attempt);
  }

  async attempts(since?: Date): Promise<SpellingAttempt[]> {
    if (!since) return this.db.getAll('attempts');
    return this.db.getAllFromIndex('attempts', 'at', IDBKeyRange.lowerBound(since));
  }

  async settings(): Promise<Settings> {
    const row = await this.db.get('settings', 'settings');
    return migrateSettings((row?.value ?? {}) as Record<string, unknown>);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.put('settings', { key: 'settings', value: settings });
  }

  async exportAll(now = new Date()): Promise<ExportFile> {
    const [settings, cards, reviews, attempts] = await Promise.all([
      this.settings(),
      this.db.getAll('cards'),
      this.db.getAll('reviews'),
      this.db.getAll('attempts'),
    ]);
    return { app: 'asl', version: EXPORT_VERSION, exportedAt: now.toISOString(), settings, cards, reviews, attempts };
  }

  /** Replaces all learner data with the contents of an export file. */
  async importAll(raw: unknown): Promise<void> {
    const data = parseExport(raw);
    const tx = this.db.transaction(['cards', 'reviews', 'attempts', 'settings'], 'readwrite');
    const cards = tx.objectStore('cards');
    const reviews = tx.objectStore('reviews');
    const attempts = tx.objectStore('attempts');
    await Promise.all([cards.clear(), reviews.clear(), attempts.clear()]);
    await Promise.all([
      ...data.cards.map((c) => cards.put(c)),
      ...data.reviews.map((r) => reviews.put(r)),
      ...data.attempts.map((a) => attempts.put(a)),
      tx.objectStore('settings').put({ key: 'settings', value: data.settings }),
    ]);
    await tx.done;
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(['cards', 'reviews', 'attempts', 'settings'], 'readwrite');
    await Promise.all([
      tx.objectStore('cards').clear(),
      tx.objectStore('reviews').clear(),
      tx.objectStore('attempts').clear(),
      tx.objectStore('settings').clear(),
      tx.done,
    ]);
  }
}

function toDate(v: unknown, field: string): Date {
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date in ${field}`);
  return d;
}

/**
 * Validates an export file (as parsed from JSON) and turns its date strings
 * back into Date objects. Throws with a readable message on bad input.
 */
export function parseExport(raw: unknown): ExportFile {
  const d = raw as Partial<ExportFile> | null;
  if (!d || typeof d !== 'object' || d.app !== 'asl') throw new Error('Not an ASL progress file.');
  if (typeof d.version !== 'number' || d.version > EXPORT_VERSION) {
    throw new Error('This progress file is from a newer version of the app.');
  }
  if (!Array.isArray(d.cards) || !Array.isArray(d.reviews) || !Array.isArray(d.attempts)) {
    throw new Error('Progress file is missing data.');
  }
  return {
    app: 'asl',
    version: d.version,
    exportedAt: String(d.exportedAt ?? ''),
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
    cards: d.cards.map((c) => ({
      ...c,
      introducedAt: toDate(c.introducedAt, 'card'),
      fsrs: {
        ...c.fsrs,
        due: toDate(c.fsrs.due, 'card due'),
        last_review: c.fsrs.last_review ? toDate(c.fsrs.last_review, 'card last_review') : undefined,
      },
    })),
    reviews: d.reviews.map((r) => ({ ...r, at: toDate(r.at, 'review') })),
    attempts: d.attempts.map((a) => ({ ...a, at: toDate(a.at, 'attempt') })),
  };
}
