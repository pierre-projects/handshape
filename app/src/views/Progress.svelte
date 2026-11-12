<script lang="ts">
  import { routes } from '../lib/routes';
  // Progress (#/progress): how you're doing, on one page: signs, fingerspelling
  // and activity. It holds only that. Word lists are under Practice, where they
  // are used (views/WordLists.svelte), and settings and your data are behind the
  // gear (views/Settings.svelte).
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import { activityDates, cardCounts, dailyActivity, MATURE_DAYS, retention, streak, weakestItems } from '../lib/stats';
  import { spellingSummary } from '../lib/spelling';
  import { confusions, LEVELS, mixUpLetterCount, nextLevel, passedCount, topMixUps } from '../lib/receptive';
  import type { ReviewEntry, SignFiveSave, SpellingAttempt, StoredCard } from '../lib/types';
  import { prefs, reloadSettings } from '../lib/settings.svelte';
  import ActivityChart from '../components/ActivityChart.svelte';
  import Icon from '../components/Icon.svelte';

  let store: Store;
  let cards = $state<StoredCard[]>([]);
  let reviews = $state<ReviewEntry[]>([]);
  let attempts = $state<SpellingAttempt[]>([]);
  const settings = $derived(prefs.value);
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
  const mixed = $derived(confusions(attempts));
  const mixUps = $derived(topMixUps(mixed, 4));
  const readLevels = $derived(prefs.value?.readLevels ?? {});
  const nextRead = $derived(nextLevel(readLevels, mixUpLetterCount(mixed)));
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

  const gloss = (id: string) => content.byId.get(id)?.gloss ?? id;
</script>

<h1 class="page-title">Progress</h1>

{#if !loaded}
  <p class="muted loading-note">Loading…</p>
{:else}
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
      <a class="btn small" href={routes.practice}>Practice<Icon name="arrow-right" size={16} /></a>
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
    <p class="small reading-line">
      <a href={routes.read}><b>Reading levels:</b> {passedCount(readLevels)} of {LEVELS.length} passed</a>{#if nextRead}{' · '}next: <a href={routes.readLevel(nextRead.id)}>{nextRead.title}</a>{/if}.
      {#if mixUps.length}
        <b>Mixed up most:</b>
        {#each mixUps as m, i}{m.shown} read as {m.answered} ({m.count}×){i < mixUps.length - 1 ? ', ' : ''}{/each}.
      {/if}
    </p>
  </section>

  <section class="card panel">
    <header class="panel-head">
      <h2><span class="p-ico"><Icon name="progress" size={18} /></span>Activity</h2>
      <span class="streak"><b>{days}</b> {days === 1 ? 'day' : 'days'} in a row</span>
    </header>
    <ActivityChart data={activity} />
  </section>
{/if}


<style>
  .page-title { margin: 4px 0 18px; }
  .panel { display: grid; gap: 14px; margin-bottom: 16px; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .panel-head h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.1rem; }
  .p-ico {
    display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px;
    background: var(--m-soft, var(--accent-soft)); color: var(--m, var(--accent));
  }
  .spellpanel { --m: var(--spell); --m-soft: var(--spell-soft); }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .reading-line { margin: 12px 0 0; color: var(--ink-2); }
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

  @media (max-width: 820px) {
    .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 480px) {
    .m-value { font-size: 1.35rem; }
  }
</style>
