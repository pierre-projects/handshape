<script lang="ts">
  import { routes } from '../lib/routes';
  // Dashboard: your progress at a glance, your word lists, and settings.
  //   #/dashboard                Overview: signs, fingerspelling, activity
  //   #/dashboard/lists[/<id>]   Word lists
  //   #/dashboard/settings       Settings and your data
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import { activityDates, cardCounts, dailyActivity, MATURE_DAYS, retention, streak, weakestItems } from '../lib/stats';
  import { spellingSummary } from '../lib/spelling';
  import type { ReviewEntry, Settings, SignFiveSave, SpellingAttempt, StoredCard } from '../lib/types';
  import { prefs, reloadSettings, updateSettings } from '../lib/settings.svelte';
  import ActivityChart from '../components/ActivityChart.svelte';
  import ListsManager from '../components/ListsManager.svelte';
  import Icon from '../components/Icon.svelte';

  let { section, listId }: { section?: string; listId?: string } = $props();
  const tab = $derived(section === 'lists' || section === 'settings' ? section : 'overview');
  const TABS = [
    { id: 'overview', label: 'Overview', href: routes.dashboard, icon: 'progress' },
    { id: 'lists', label: 'Word lists', href: routes.lists, icon: 'spell' },
    { id: 'settings', label: 'Settings', href: routes.settings, icon: 'edit' },
  ] as const;

  let store: Store;
  let cards = $state<StoredCard[]>([]);
  let reviews = $state<ReviewEntry[]>([]);
  let attempts = $state<SpellingAttempt[]>([]);
  const settings = $derived(prefs.value);
  let message = $state('');
  let loaded = $state(false);
  let five = $state<SignFiveSave['stats']>();

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const counts = $derived(cardCounts(cards, now));
  const kept = $derived(retention(reviews, monthAgo));
  const days = $derived(streak(activityDates(reviews, attempts), now));
  const activity = $derived(dailyActivity(activityDates(reviews, attempts), now, 14));
  const weak = $derived(weakestItems(reviews).slice(0, 6));
  const spelling = $derived(spellingSummary(attempts));
  const learnedItems = $derived(new Set(cards.map((c) => c.itemId)).size);

  onMount(load);

  async function load() {
    store = await getStore();
    const [c, r, a, f] = await Promise.all([
      store.cards(), store.reviews(), store.attempts(), store.signFive(), reloadSettings(),
    ]);
    cards = [...c.values()];
    reviews = r;
    attempts = a;
    five = f?.stats;
    loaded = true;
  }

  function patch(p: Partial<Settings>) {
    return updateSettings(p);
  }

  async function save(p: Partial<Settings>) {
    await updateSettings(p);
    message = 'Settings saved.';
  }

  const perDay = (v: string) => Math.max(0, Math.min(50, Math.round(Number(v) || 0)));

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
  <section class="card panel">
    <header class="panel-head">
      <h2><span class="p-ico"><Icon name="review" size={18} /></span>Signs</h2>
      <a class="btn small" class:primary={counts.dueToday > 0} href={routes.review}>
        {counts.dueToday ? `Review ${counts.dueToday} due` : 'Open review'}<Icon name="arrow-right" size={16} />
      </a>
    </header>
    <div class="metrics">
      <div class="metric">
        <span class="m-label">Due today</span>
        <span class="m-value">{counts.dueToday}</span>
        <span class="m-foot">{counts.dueToday ? 'ready to review' : 'all caught up'}</span>
      </div>
      <div class="metric">
        <span class="m-label">Started</span>
        <span class="m-value">{learnedItems}<small>/{content.items.length}</small></span>
        <span class="bar-track" aria-hidden="true"><span style="width:{(learnedItems / content.items.length) * 100}%"></span></span>
      </div>
      <div class="metric">
        <span class="m-label">Known well</span>
        <span class="m-value">{counts.mature}</span>
        <span class="m-foot">remembered {MATURE_DAYS}+ days</span>
      </div>
      <div class="metric">
        <span class="m-label">Recall, 30 days</span>
        {#if kept === undefined}
          <span class="m-value empty">–</span>
          <span class="m-foot">shows after a few reviews</span>
        {:else}
          <span class="m-value">{Math.round(kept * 100)}<small>%</small></span>
          <span class="m-foot">of reviews remembered</span>
        {/if}
      </div>
    </div>
    {#if weak.length}
      <p class="small weak">
        <b>Misread most:</b>
        {#each weak as w, i}<a href={routes.sign(w.itemId)}>{gloss(w.itemId)}</a> ({Math.round(w.rate * 100)}%){i < weak.length - 1 ? ', ' : ''}{/each}
      </p>
    {/if}
  </section>

  <section class="card panel spellpanel">
    <header class="panel-head">
      <h2><span class="p-ico"><Icon name="spell" size={18} /></span>Fingerspelling</h2>
      <a class="btn small" href={routes.fingerspelling}>Practise<Icon name="arrow-right" size={16} /></a>
    </header>
    <div class="metrics">
      <a class="metric link" href={routes.read}>
        <span class="m-label">Reading speed</span>
        {#if spelling.read.wpm}
          <span class="m-value">{spelling.read.wpm}<small> wpm</small></span>
          <span class="m-foot">{spelling.read.accuracy}% right lately</span>
        {:else}
          <span class="m-value empty">–</span>
          <span class="m-foot">read a few words to measure</span>
        {/if}
      </a>
      <a class="metric link" href={routes.spell}>
        <span class="m-label">Clean spelling</span>
        {#if spelling.spell.clean !== undefined}
          <span class="m-value">{spelling.spell.clean}<small>%</small></span>
          <span class="m-foot">{spelling.spell.count} {spelling.spell.count === 1 ? 'word' : 'words'} spelled</span>
        {:else}
          <span class="m-value empty">–</span>
          <span class="m-foot">spell a word to the camera</span>
        {/if}
      </a>
      <a class="metric link" href={routes.signFive}>
        <span class="m-label">Sign Five</span>
        {#if five?.played}
          <span class="m-value">{five.streak}<small> streak</small></span>
          <span class="m-foot">{five.won} of {five.played} won</span>
        {:else}
          <span class="m-value empty">–</span>
          <span class="m-foot">play today's word</span>
        {/if}
      </a>
      <a class="metric link" href={routes.lists}>
        <span class="m-label">Word lists</span>
        <span class="m-value">{settings?.lists.length ?? 0}</span>
        <span class="m-foot">{settings?.lists.length ? settings.lists.slice(0, 2).map((l) => l.name).join(', ') : 'make your own'}</span>
      </a>
    </div>
  </section>

  <section class="card panel">
    <header class="panel-head">
      <h2><span class="p-ico"><Icon name="progress" size={18} /></span>Activity</h2>
      <span class="streak"><b>{days}</b> {days === 1 ? 'day' : 'days'} in a row</span>
    </header>
    <ActivityChart data={activity} />
  </section>
{:else if tab === 'lists' && settings}
  <ListsManager {settings} {listId} onSave={patch} />
{:else if tab === 'settings' && settings}
  <section class="card stack">
    <h2>Settings</h2>
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

  .panel { display: grid; gap: 14px; margin-bottom: 16px; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .panel-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.1rem; }
  .p-ico {
    display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px;
    background: var(--m-soft, var(--accent-soft)); color: var(--m, var(--accent));
  }
  .spellpanel { --m: var(--spell); --m-soft: var(--spell-soft); }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .metric {
    display: grid; align-content: start; gap: 2px; padding: 12px 14px; border-radius: var(--radius-sm);
    background: var(--surface-2); color: var(--ink); text-decoration: none;
  }
  .metric.link { border: 1px solid transparent; transition: border-color 0.15s, background 0.15s; }
  .metric.link:hover { border-color: var(--m, var(--accent)); background: var(--surface); }
  .m-label { font-size: 0.78rem; font-weight: 650; color: var(--ink-3); }
  .m-value { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.2; }
  .m-value small { font-size: 0.85rem; color: var(--ink-3); font-weight: 600; letter-spacing: 0; margin-left: 2px; }
  .m-value.empty { color: var(--ink-3); }
  .m-foot { font-size: 0.78rem; color: var(--ink-2); }
  .bar-track { display: block; height: 6px; margin-top: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
  .bar-track span { display: block; height: 100%; background: var(--accent); border-radius: 3px; }
  .weak { margin: 0; color: var(--ink-2); }
  .streak { font-size: 0.9rem; color: var(--ink-2); }
  .streak b { color: var(--ink); }

  .field { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .field input { width: 90px; }
  .check { display: flex; gap: 10px; align-items: flex-start; }
  .check input { margin-top: 4px; width: 18px; height: 18px; flex-shrink: 0; }

  @media (max-width: 820px) {
    .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .tabs { width: 100%; }
    .tabs a { flex: 1; justify-content: center; padding: 6px 4px; font-size: 0.82rem; }
    .m-value { font-size: 1.35rem; }
  }
</style>
