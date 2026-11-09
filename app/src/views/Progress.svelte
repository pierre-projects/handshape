<script lang="ts">
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import { activityDates, cardCounts, dailyActivity, MATURE_DAYS, retention, streak, weakestItems } from '../lib/stats';
  import { lettersPerSecondToWpm, readingSpeed } from '../lib/spelling';
  import type { ReviewEntry, Settings, SpellingAttempt, StoredCard } from '../lib/types';
  import ActivityChart from '../components/ActivityChart.svelte';

  let store: Store;
  let cards = $state<StoredCard[]>([]);
  let reviews = $state<ReviewEntry[]>([]);
  let attempts = $state<SpellingAttempt[]>([]);
  let settings = $state<Settings>();
  let message = $state('');
  let loaded = $state(false);

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const counts = $derived(cardCounts(cards, now));
  const kept = $derived(retention(reviews, monthAgo));
  const days = $derived(streak(activityDates(reviews, attempts), now));
  const activity = $derived(dailyActivity(activityDates(reviews, attempts), now, 14));
  const weak = $derived(weakestItems(reviews).slice(0, 6));
  const reading = $derived(readingSpeed(attempts));
  const learnedItems = $derived(new Set(cards.map((c) => c.itemId)).size);

  onMount(load);

  async function load() {
    store = await getStore();
    const [c, r, a, s] = await Promise.all([store.cards(), store.reviews(), store.attempts(), store.settings()]);
    cards = [...c.values()];
    reviews = r;
    attempts = a;
    settings = s;
    loaded = true;
  }

  async function save() {
    if (!settings) return;
    settings.newItemsPerDay = Math.max(0, Math.min(50, Math.round(Number(settings.newItemsPerDay) || 0)));
    await store.saveSettings($state.snapshot(settings));
    message = 'Settings saved.';
  }

  async function exportData() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `asl-progress-${new Date().toISOString().slice(0, 10)}.json`;
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
      await load();
      message = 'Progress imported.';
    } catch (err) {
      message = err instanceof Error ? err.message : 'Could not import that file.';
    }
  }

  async function reset() {
    if (!confirm('Delete all progress on this device? Export first if you want a backup.')) return;
    await store.clearAll();
    await load();
    message = 'All progress deleted.';
  }

  const gloss = (id: string) => content.byId.get(id)?.gloss ?? id;
</script>

<h1>Progress</h1>

{#if !loaded}
  <p class="muted">Loading…</p>
{:else}
  <section class="card stack">
    <div class="stat-grid">
      <div class="stat"><div class="value">{learnedItems}<span class="of">/{content.items.length}</span></div><div class="label">signs started</div></div>
      <div class="stat"><div class="value">{counts.mature}</div><div class="label">cards known for {MATURE_DAYS}+ days</div></div>
      <div class="stat"><div class="value">{kept === undefined ? '–' : `${Math.round(kept * 100)}%`}</div><div class="label">remembered, last 30 days</div></div>
      <div class="stat"><div class="value">{days}</div><div class="label">day streak</div></div>
      <div class="stat"><div class="value">{reading ? lettersPerSecondToWpm(reading) : '–'}</div><div class="label">fingerspelling read, wpm</div></div>
      <div class="stat"><div class="value">{counts.dueToday}</div><div class="label">due today</div></div>
    </div>
    <h2>Activity, last 14 days</h2>
    <ActivityChart data={activity} />
    {#if weak.length}
      <h2>Signs you misread most</h2>
      <p class="small">
        {#each weak as w, i}<a href="#/learn/{w.itemId}">{gloss(w.itemId)}</a> ({Math.round(w.rate * 100)}% missed){i < weak.length - 1 ? ', ' : ''}{/each}
      </p>
    {/if}
  </section>

  <section class="card stack">
    <h2>Settings</h2>
    {#if settings}
      <label class="field">
        <span>New signs per day</span>
        <input type="number" min="0" max="50" bind:value={settings.newItemsPerDay} onchange={save} />
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={settings.showCameraByDefault} onchange={save} />
        Turn the camera on automatically in drills
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={settings.mirrorMedia} onchange={save} />
        Mirror sign images and videos by default (useful if you sign left-handed)
      </label>
    {/if}
  </section>

  <section class="card stack">
    <h2>Your data</h2>
    <p class="small muted">Progress is stored only in this browser. Export it to back it up or move it to another device.</p>
    <div class="row">
      <button onclick={exportData}>Export</button>
      <label class="btn">Import<input type="file" accept="application/json,.json" onchange={importData} hidden /></label>
      <button onclick={reset}>Delete all</button>
    </div>
  </section>

  {#if message}<p class="small" role="status">{message}</p>{/if}
{/if}

<style>
  h1 { margin-bottom: 16px; }
  .of { font-size: 1rem; color: var(--ink-3); font-weight: 600; }
  .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .field input { width: 90px; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check input { margin-top: 4px; width: 18px; height: 18px; flex-shrink: 0; }
</style>
