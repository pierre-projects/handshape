<script lang="ts">
  // Dashboard: your progress at a glance, your word lists, and settings.
  //   #/progress           Overview
  //   #/progress/lists     Word lists (fingerspelling and Sign Five)
  //   #/progress/settings  Settings and your data
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import { activityDates, cardCounts, dailyActivity, MATURE_DAYS, retention, streak, weakestItems } from '../lib/stats';
  import { lettersPerSecondToWpm, readingSpeed } from '../lib/spelling';
  import type { ReviewEntry, Settings, SpellingAttempt, StoredCard } from '../lib/types';
  import ActivityChart from '../components/ActivityChart.svelte';
  import ListsManager from '../components/ListsManager.svelte';
  import Icon from '../components/Icon.svelte';

  let { section, listId }: { section?: string; listId?: string } = $props();
  const tab = $derived(section === 'lists' || section === 'settings' ? section : 'overview');
  const TABS = [
    { id: 'overview', label: 'Overview', href: '#/progress', icon: 'progress' },
    { id: 'lists', label: 'Word lists', href: '#/progress/lists', icon: 'spell' },
    { id: 'settings', label: 'Settings', href: '#/progress/settings', icon: 'edit' },
  ] as const;

  let store: Store;
  let cards = $state<StoredCard[]>([]);
  let reviews = $state<ReviewEntry[]>([]);
  let attempts = $state<SpellingAttempt[]>([]);
  let settings = $state<Settings>();
  let message = $state('');
  let loaded = $state(false);
  let five = $state<{ played: number; won: number; streak: number }>();

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
    try {
      five = JSON.parse(localStorage.getItem('asl-sign-five') ?? 'null')?.stats;
    } catch {
      five = undefined;
    }
    loaded = true;
  }

  async function patch(p: Partial<Settings>) {
    if (!settings) return;
    settings = { ...settings, ...p };
    await store.saveSettings($state.snapshot(settings));
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

<header class="dash-head">
  <h1>Dashboard</h1>
  <nav class="tabs" aria-label="Dashboard sections">
    {#each TABS as t}
      <a href={t.href} aria-current={tab === t.id ? 'page' : undefined}><Icon name={t.icon} size={16} />{t.label}</a>
    {/each}
  </nav>
</header>

{#if !loaded}
  <p class="muted">Loading…</p>
{:else if tab === 'overview'}
  <div class="tiles">
    <a class="tile" href="#/review">
      <span class="t-label">Due today</span>
      <span class="t-value">{counts.dueToday}</span>
      <span class="t-foot">{counts.dueToday ? 'Start review' : 'All caught up'}<Icon name="arrow-right" size={14} /></span>
    </a>
    <div class="tile">
      <span class="t-label">Day streak</span>
      <span class="t-value">{days}</span>
      <span class="t-foot">{days === 1 ? 'day' : 'days'} in a row</span>
    </div>
    <div class="tile">
      <span class="t-label">Signs started</span>
      <span class="t-value">{learnedItems}<small>/{content.items.length}</small></span>
      <span class="t-foot">{counts.mature} known for {MATURE_DAYS}+ days</span>
    </div>
    <div class="tile">
      <span class="t-label">Remembered</span>
      <span class="t-value">{kept === undefined ? '–' : `${Math.round(kept * 100)}%`}</span>
      <span class="t-foot">last 30 days</span>
    </div>
    <a class="tile" href="#/fingerspell/read">
      <span class="t-label">Fingerspelling read</span>
      <span class="t-value">{reading ? lettersPerSecondToWpm(reading) : '–'}<small> wpm</small></span>
      <span class="t-foot">{attempts.length} words practised<Icon name="arrow-right" size={14} /></span>
    </a>
    <a class="tile" href="#/fingerspell/game">
      <span class="t-label">Sign Five</span>
      <span class="t-value">{five?.streak ?? 0}<small> streak</small></span>
      <span class="t-foot">{five?.played ? `${five.won} of ${five.played} won` : 'Play today\'s word'}<Icon name="arrow-right" size={14} /></span>
    </a>
  </div>

  <section class="card stack">
    <h2>Activity, last 14 days</h2>
    <ActivityChart data={activity} />
    {#if weak.length}
      <h2>Signs you misread most</h2>
      <p class="small">
        {#each weak as w, i}<a href="#/learn/{w.itemId}">{gloss(w.itemId)}</a> ({Math.round(w.rate * 100)}% missed){i < weak.length - 1 ? ', ' : ''}{/each}
      </p>
    {/if}
  </section>

  <a class="card lists-link" href="#/progress/lists">
    <span class="ll-ico"><Icon name="spell" size={20} /></span>
    <span class="ll-text">
      <b>Your word lists</b>
      <span class="small muted">
        {settings?.lists.length ?? 0} {settings?.lists.length === 1 ? 'list' : 'lists'}{settings?.lists.length ? ': ' + settings.lists.slice(0, 3).map((l) => l.name).join(', ') + (settings.lists.length > 3 ? '…' : '') : '. Make one to practise your own words.'}
      </span>
    </span>
    <Icon name="arrow-right" size={18} />
  </a>
{:else if tab === 'lists' && settings}
  <ListsManager {settings} {listId} onSave={patch} />
{:else if tab === 'settings' && settings}
  <section class="card stack">
    <h2>Settings</h2>
    <label class="field">
      <span>New signs per day</span>
      <input type="number" min="0" max="50" bind:value={settings.newItemsPerDay} onchange={save} />
    </label>
    <label class="field">
      <span>Signing hand</span>
      <select bind:value={settings.dominantHand} onchange={save}>
        <option value="Right">Right</option>
        <option value="Left">Left</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={settings.showCameraByDefault} onchange={save} />
      Turn the camera on automatically in drills
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={settings.mirrorMedia} onchange={save} />
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

{#if message}<p class="small" role="status">{message}</p>{/if}

<style>
  .dash-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .dash-head h1 { margin: 0; }
  .tabs { display: flex; gap: 4px; padding: 4px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; }
  .tabs a {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px;
    color: var(--ink-2); text-decoration: none; font-weight: 600; font-size: 0.9rem; white-space: nowrap;
  }
  .tabs a:hover { color: var(--ink); }
  .tabs a[aria-current='page'] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgb(16 24 40 / 0.1); }

  .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  .tile {
    display: grid; gap: 2px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--surface); color: var(--ink); text-decoration: none; box-shadow: var(--shadow);
  }
  a.tile:hover { border-color: var(--accent); box-shadow: var(--shadow-lift); }
  .t-label { font-size: 0.8rem; font-weight: 600; color: var(--ink-3); }
  .t-value { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .t-value small { font-size: 0.9rem; color: var(--ink-3); font-weight: 600; letter-spacing: 0; margin-left: 3px; }
  .t-foot { display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--ink-2); }
  a.tile .t-foot { color: var(--accent); font-weight: 600; }

  .lists-link { display: flex; align-items: center; gap: 12px; margin-top: 16px; text-decoration: none; color: var(--ink); }
  .lists-link:hover { border-color: var(--accent); }
  .ll-ico { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); }
  .ll-text { flex: 1; display: grid; }


  .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .field input { width: 90px; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check input { margin-top: 4px; width: 18px; height: 18px; flex-shrink: 0; }

  @media (max-width: 820px) {
    .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .tabs { width: 100%; }
    .tabs a { flex: 1; justify-content: center; padding: 6px 4px; font-size: 0.82rem; }
    .t-value { font-size: 1.5rem; }
  }
</style>
