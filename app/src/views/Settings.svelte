<script lang="ts">
  // Settings (#/settings), behind the gear in the top bar: how the app behaves
  // (preferences), your data (export, import, delete), and the way to the pages
  // about the app itself. It sits under no tab: a tab is somewhere you go to
  // learn or practice, and this is a utility.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { routes } from '../lib/routes';
  import { FEEDBACK_URL } from '../lib/roadmap';
  import type { Settings } from '../lib/types';
  import { prefs, reloadSettings, updateSettings } from '../lib/settings.svelte';
  import Icon from '../components/Icon.svelte';

  let store: Store;
  const settings = $derived(prefs.value);
  let message = $state('');

  onMount(async () => {
    store = await getStore();
    await reloadSettings();
  });

  async function save(p: Partial<Settings>) {
    await updateSettings(p);
    message = 'Saved.';
  }

  const perDay = (v: string) => Math.max(0, Math.min(50, Math.round(Number(v) || 0)));

  async function exportData() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `handshape-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    message = 'Progress exported.';
  }

  async function importData(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    if (!confirm('Replace all progress on this device with the contents of this file?')) return;
    try {
      await store.importAll(JSON.parse(await file.text()));
      await reloadSettings();
      message = 'Progress imported.';
    } catch (err) {
      message = err instanceof Error ? err.message : 'Could not import that file.';
    }
  }

  async function reset() {
    if (!confirm('Delete all progress on this device? Export first if you want a backup.')) return;
    await store.clearAll();
    await reloadSettings();
    message = 'All progress deleted.';
  }
</script>

<div class="settings">
  <h1>Settings</h1>

  {#if settings}
    <section class="card stack">
      <h2>Preferences</h2>
      <label class="field">
        <span>New signs per day</span>
        <input
          type="number" min="0" max="50" value={settings.newItemsPerDay}
          onchange={(e) => {
            const n = perDay(e.currentTarget.value);
            e.currentTarget.value = String(n);
            save({ newItemsPerDay: n });
          }}
        />
      </label>
      <label class="field">
        <span>Signing hand</span>
        <select
          value={settings.dominantHand}
          onchange={(e) => save({ dominantHand: e.currentTarget.value as Settings['dominantHand'] })}
        >
          <option value="Right">Right</option>
          <option value="Left">Left</option>
        </select>
      </label>
      <label class="check">
        <input
          type="checkbox" checked={settings.showCameraByDefault}
          onchange={(e) => save({ showCameraByDefault: e.currentTarget.checked })}
        />
        Turn the camera on automatically in drills
      </label>
      <label class="check">
        <input
          type="checkbox" checked={settings.mirrorMedia}
          onchange={(e) => save({ mirrorMedia: e.currentTarget.checked })}
        />
        Mirror sign images and videos by default (useful if you sign left-handed)
      </label>
    </section>

    <section class="card stack">
      <h2>Your data</h2>
      <p class="small muted">
        Progress and word lists are stored only in this browser. Export them to back up or move to another device.
      </p>
      <div class="row">
        <button onclick={exportData}>Export</button>
        <label class="btn">Import<input type="file" accept="application/json,.json" onchange={importData} hidden /></label>
        <button onclick={reset}>Delete all</button>
      </div>
    </section>
  {/if}

  <section class="card stack">
    <h2>About</h2>
    <ul class="links">
      <li>
        <a href={routes.about}>
          <span><b>About Handshape</b><small>What it is, how the camera works, your privacy, and what's coming</small></span>
          <Icon name="arrow-right" size={18} />
        </a>
      </li>
      {#if FEEDBACK_URL}
        <li>
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">
            <span><b>Send feedback</b><small>Opens a Google Form in a new tab</small></span>
            <Icon name="arrow-right" size={18} />
          </a>
        </li>
      {/if}
    </ul>
  </section>

  {#if message}<p class="small" role="status">{message}</p>{/if}
</div>

<style>
  .settings { max-width: 760px; margin: 0 auto; }
  h1 { margin: 4px 0 18px; }
  h2 { margin: 0; font-size: 1.1rem; }
  .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .field input { width: 90px; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check input { margin-top: 4px; width: 18px; height: 18px; flex-shrink: 0; }

  .links { list-style: none; margin: 10px 0 0; padding: 0; display: grid; }
  .links li + li { border-top: 1px solid var(--line); }
  .links a {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 2px;
    color: var(--ink); text-decoration: none;
  }
  .links a:hover b { color: var(--accent); }
  .links span { display: grid; gap: 2px; }
  .links small { color: var(--ink-3); font-size: 0.85rem; }
  .links a :global(svg) { flex: none; color: var(--ink-3); }
</style>
