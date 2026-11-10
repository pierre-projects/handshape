import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Store, parseExport } from '../app/src/lib/db';
import { gradeCard, newCard, Rating } from '../app/src/lib/srs';

let n = 0;
const fresh = () => Store.open(`test-${n++}`);

describe('Store', () => {
  it('saves a graded card with its review', async () => {
    const s = await fresh();
    const now = new Date('2026-11-09T10:00:00');
    const { card, entry } = gradeCard(newCard('a', 'produce', now), Rating.Good, now);
    await s.recordReview(card, entry);
    const cards = await s.cards();
    expect(cards.get('a:produce')!.fsrs.due).toBeInstanceOf(Date);
    expect(await s.reviews()).toHaveLength(1);
    expect(await s.reviews(new Date('2026-11-10'))).toHaveLength(0);
  });

  it('round-trips through a JSON export', async () => {
    const a = await fresh();
    const now = new Date('2026-11-09T10:00:00');
    const { card, entry } = gradeCard(newCard('a', 'recognize', now), Rating.Again, now, { correct: false, typed: 'B' });
    await a.recordReview(card, entry);
    await a.addAttempt({ word: 'CAT', mode: 'receptive', correct: true, typed: 'CAT', lettersPerSecond: 2, replays: 0, at: now });
    await a.saveSettings({ ...(await a.settings()), newItemsPerDay: 9 });
    const json = JSON.parse(JSON.stringify(await a.exportAll(now)));

    const b = await fresh();
    await b.importAll(json);
    const cards = await b.cards();
    expect(cards.get('a:recognize')!.fsrs.due.getTime()).toBe(card.fsrs.due.getTime());
    expect((await b.reviews())[0].typed).toBe('B');
    expect((await b.attempts())[0].at).toBeInstanceOf(Date);
    expect((await b.settings()).newItemsPerDay).toBe(9);
  });

  it('keeps what kind of read an attempt was, and still imports attempts saved without it', async () => {
    const a = await Store.open(`drill-${Date.now()}`);
    const at = new Date('2026-11-10T10:00:00Z');
    await a.addAttempt({ word: 'A', mode: 'receptive', drill: 'letter', correct: false, typed: 'S', lettersPerSecond: 0, replays: 0, at });
    await a.addAttempt({ word: 'CAT', mode: 'receptive', correct: true, typed: 'CAT', lettersPerSecond: 2, replays: 0, at });
    const json = JSON.parse(JSON.stringify(await a.exportAll()));
    const b = await Store.open(`drill-b-${Date.now()}`);
    await b.importAll(parseExport(json));
    const back = await b.attempts();
    expect(back.map((x) => x.drill)).toEqual(['letter', undefined]);
    expect(back[0]).toMatchObject({ word: 'A', typed: 'S', correct: false });
    expect(back[0].at).toEqual(at);
  });

  it('clears everything', async () => {
    const s = await fresh();
    const now = new Date();
    const { card, entry } = gradeCard(newCard('a', 'produce', now), Rating.Good, now);
    await s.recordReview(card, entry);
    await s.clearAll();
    expect((await s.cards()).size).toBe(0);
  });
});

describe('parseExport', () => {
  it('rejects files from other apps or newer versions', () => {
    expect(() => parseExport({ app: 'other' })).toThrow(/Not an ASL/);
    expect(() => parseExport({ app: 'asl', version: 99, cards: [], reviews: [], attempts: [] })).toThrow(/newer/);
    expect(() => parseExport(null)).toThrow();
  });
});
