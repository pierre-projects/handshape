import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Store } from '../app/src/lib/db';
import { LEGACY_STORAGE_KEY, loadSignFive } from '../app/src/lib/guess';
import { loadSettings, prefs, updateSettings, useSettingsSource } from '../app/src/lib/settings.svelte';
import { DEFAULT_SETTINGS, type Settings, type SignFiveSave } from '../app/src/lib/types';

let n = 0;
const fresh = () => Store.open(`storage-${n++}`);
const game: SignFiveSave = {
  daily: { key: '2026-11-10', guesses: ['CRANE'], answer: 'TRUCE', source: 'official' },
  stats: { played: 3, won: 2, streak: 1, best: 2, dist: [0, 1, 1, 0, 0, 0] },
};

describe('Sign Five in the database', () => {
  it('is included in exports and restored by import', async () => {
    const a = await fresh();
    await a.saveSignFive(game);
    const json = JSON.parse(JSON.stringify(await a.exportAll()));
    expect(json.signFive.stats.played).toBe(3);

    const b = await fresh();
    await b.importAll(json);
    expect(await b.signFive()).toEqual(game);
  });

  it('is removed by "delete all" and by importing a file without it', async () => {
    const a = await fresh();
    await a.saveSignFive(game);
    await a.clearAll();
    expect(await a.signFive()).toBeUndefined();

    const old = JSON.parse(JSON.stringify(await a.exportAll()));
    const b = await fresh();
    await b.saveSignFive(game);
    await b.importAll(old);
    expect(await b.signFive()).toBeUndefined();
  });

  it('moves an older localStorage save into the database once', async () => {
    const s = await fresh();
    const mem = new Map([[LEGACY_STORAGE_KEY, JSON.stringify(game)]]);
    const storage = { getItem: (k: string) => mem.get(k) ?? null, removeItem: (k: string) => void mem.delete(k) };
    expect(await loadSignFive(s, storage)).toEqual(game);
    expect(mem.has(LEGACY_STORAGE_KEY)).toBe(false);
    expect(await s.signFive()).toEqual(game);
  });

  it('starts empty when nothing was saved', async () => {
    const save = await loadSignFive(await fresh(), undefined);
    expect(save.stats.played).toBe(0);
  });
});

describe('shared settings', () => {
  /** A settings store that another tab can change behind our back. */
  function memory(initial: Settings) {
    let stored = structuredClone(initial);
    const src = {
      settings: async () => structuredClone(stored),
      saveSettings: async (s: Settings) => void (stored = structuredClone(s)),
    };
    return { src, get: () => stored, set: (s: Settings) => (stored = s) };
  }

  it('updates the page at once and saves', async () => {
    const m = memory(DEFAULT_SETTINGS);
    useSettingsSource(async () => m.src);
    await loadSettings();
    const job = updateSettings({ newItemsPerDay: 9 });
    expect(prefs.value?.newItemsPerDay).toBe(9);
    await job;
    expect(m.get().newItemsPerDay).toBe(9);
  });

  it('does not overwrite a change made elsewhere with a stale copy', async () => {
    const m = memory(DEFAULT_SETTINGS);
    useSettingsSource(async () => m.src);
    await loadSettings();
    m.set({ ...m.get(), dominantHand: 'Left' }); // another tab
    await updateSettings({ receptiveSpeed: 2 });
    expect(m.get().dominantHand).toBe('Left');
    expect(m.get().receptiveSpeed).toBe(2);
    expect(prefs.value?.dominantHand).toBe('Left');
  });

  it('keeps every change when several are made quickly', async () => {
    const m = memory(DEFAULT_SETTINGS);
    useSettingsSource(async () => m.src);
    await loadSettings();
    await Promise.all([
      updateSettings({ newItemsPerDay: 3 }),
      updateSettings({ receptiveSpeed: 3 }),
      updateSettings({ mirrorMedia: true }),
    ]);
    expect(m.get()).toMatchObject({ newItemsPerDay: 3, receptiveSpeed: 3, mirrorMedia: true });
  });
});
