// The learner's settings, shared by every page.
//
// Pages read `prefs.value` and change settings with `updateSettings(patch)`.
// A change is merged into the latest saved settings (not a page's own copy),
// and changes are saved one at a time, so a stale copy can't overwrite a newer
// change made elsewhere.
import { getStore } from './app';
import type { Settings } from './types';

type Source = {
  settings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
};

/** The current settings; undefined until loadSettings() resolves. */
export const prefs = $state<{ value?: Settings }>({});

let source: () => Promise<Source> = getStore;
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
/** Saves queued and not yet finished. */
let pending = 0;

/** Loads settings once; later calls reuse them. */
export async function loadSettings(): Promise<Settings> {
  loading ??= source()
    .then((s) => s.settings())
    .then((v) => {
      prefs.value = v;
    });
  await loading;
  return prefs.value!;
}

/** Re-reads settings, e.g. after importing a backup or deleting all data. */
export function reloadSettings(): Promise<Settings> {
  loading = undefined;
  return loadSettings();
}

/** Saves a change. The page updates at once; the save follows in order. */
export function updateSettings(patch: Partial<Settings>): Promise<void> {
  if (prefs.value) prefs.value = { ...prefs.value, ...patch };
  pending++;
  const job = queue
    .then(async () => {
      const store = await source();
      const next = $state.snapshot({ ...(await store.settings()), ...patch }) as Settings;
      await store.saveSettings(next);
      // Once the last queued save lands, show exactly what's stored (it may
      // include changes made in another tab).
      if (pending === 1) prefs.value = next;
    })
    .finally(() => pending--);
  queue = job.catch(() => {});
  return job;
}

/** Whether pictures should be mirrored for a left-handed signer. */
export function mirrored(s: Settings | undefined = prefs.value): boolean {
  return s?.dominantHand === 'Left';
}

/** For tests: read and write settings somewhere other than the app database. */
export function useSettingsSource(s: () => Promise<Source>): void {
  source = s;
  loading = undefined;
  queue = Promise.resolve();
  pending = 0;
  prefs.value = undefined;
}
