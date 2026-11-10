<script lang="ts">
  // Today: one clear next step (the hero), then every way to practise with its
  // status, then a slim progress line that leads to the dashboard.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content } from '../lib/content';
  import { buildQueue } from '../lib/srs';
  import { loadSettings } from '../lib/settings.svelte';
  import { activityDates, streak } from '../lib/stats';
  import { spellingSummary, type SpellingSummary } from '../lib/spelling';
  import { dailyStatus, describeDaily, type DailyState } from '../lib/guess';
  import { routes } from '../lib/routes';
  import HandSign from '../components/HandSign.svelte';
  import Icon from '../components/Icon.svelte';

  let loaded = $state(false);
  let due = $state(0);
  let fresh = $state(0);
  let newRemaining = $state(0);
  let days = $state(0);
  let started = $state(false);
  let learned = $state(0);
  let spelling = $state<SpellingSummary>();
  let five = $state<{ state: DailyState; guesses: number }>({ state: 'unplayed', guesses: 0 });

  const drafts = content.units.filter((u) => u.review.status === 'draft').length;
  const total = content.items.length;
  const todo = $derived(due + fresh);

  onMount(async () => {
    const store = await getStore();
    const [cards, settings, reviews, attempts, signFive] = await Promise.all([
      store.cards(),
      loadSettings(),
      store.reviews(),
      store.attempts(),
      store.signFive(),
    ]);
    const q = buildQueue(content.items, cards, { now: new Date(), newItemsPerDay: settings.newItemsPerDay });
    due = q.due.length;
    fresh = new Set(q.fresh.map((c) => c.itemId)).size;
    newRemaining = q.newRemaining;
    days = streak(activityDates(reviews, attempts), new Date());
    spelling = spellingSummary(attempts);
    started = cards.size > 0;
    learned = new Set([...cards.values()].map((c) => c.itemId)).size;
    five = dailyStatus(signFive);
    loaded = true;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const minutes = $derived(Math.max(1, Math.round(todo / 4)));

  const fiveStatus = $derived(describeDaily(five));
</script>

<section class="hero card">
  <div class="hero-text">
    {#if !loaded}
      <p class="eyebrow">Loading…</p>
      <h1 class="muted">Getting your lessons ready…</h1>
    {:else if !started}
      <p class="eyebrow">Welcome</p>
      <h1>Let's learn to sign.</h1>
      <p class="lead">
        A few minutes a day is all it takes. You'll meet a handful of new signs, and they'll come back just before you'd
        forget them.
      </p>
      <div class="ctas">
        <a class="btn primary lg" href={routes.review}><Icon name="play" size={18} />Start your first lesson</a>
      </div>
      <p class="small muted">{fresh} new signs · about 5 minutes</p>
    {:else if todo > 0}
      <p class="eyebrow">{greeting}</p>
      <h1>{todo} {todo === 1 ? 'sign' : 'signs'} ready for you.</h1>
      <p class="lead">
        {#if due && fresh}{due} to review and {fresh} new.{:else if due}Reviews only, nothing new today.{:else}{fresh} new
          {fresh === 1 ? 'sign' : 'signs'} to meet.{/if}
        About {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
      </p>
      <div class="ctas">
        <a class="btn primary lg" href={routes.review}><Icon name="play" size={18} />Start review</a>
      </div>
    {:else}
      <p class="eyebrow">{greeting}</p>
      <h1>You're all caught up.</h1>
      <p class="lead">Reviews are done for today. Keep going with something below, or learn a few more signs.</p>
      <div class="ctas">
        {#if five.state === 'unplayed' || five.state === 'playing'}
          <a class="btn primary lg" href={routes.signFive}><Icon name="play" size={18} />Play today's Sign Five</a>
        {:else}
          <a class="btn primary lg" href={routes.fingerspelling}><Icon name="spell" size={18} />Practise fingerspelling</a>
        {/if}
        {#if newRemaining > 0}
          <a class="btn lg" href={routes.reviewMore}><Icon name="plus" size={18} />Learn 5 new signs</a>
        {/if}
      </div>
    {/if}
  </div>
  <div class="hero-art" aria-hidden="true">
    <HandSign id="5" size={130} animate={false} label="" />
  </div>
</section>

{#if loaded && started}
  <a class="progress-strip" href={routes.dashboard}>
    <span class="ps-item"><b>{days}</b> {days === 1 ? 'day' : 'days'} streak</span>
    <span class="ps-item grow">
      <span><b>{learned}</b> of {total} signs started</span>
      <span class="progress" aria-hidden="true"><span style="width:{(learned / total) * 100}%"></span></span>
    </span>
    <span class="ps-link">Dashboard<Icon name="arrow-right" size={16} /></span>
  </a>
{/if}

<h2 class="section-title">Practise</h2>
<div class="hub">
  <a class="hub-card" href={routes.review} style="--c: var(--accent); --s: var(--accent-soft)">
    <span class="hub-icon"><Icon name="review" size={22} /></span>
    <span class="hub-text">
      <b>Review</b>
      <span>{!loaded ? '…' : todo ? `${todo} ready now` : 'All caught up today'}</span>
    </span>
  </a>
  <a class="hub-card" href={routes.read} style="--c: var(--accent); --s: var(--accent-soft)">
    <span class="hub-icon"><Icon name="eye" size={22} /></span>
    <span class="hub-text">
      <b>Read fingerspelling</b>
      <span>{spelling?.read.wpm ? `${spelling.read.wpm} wpm reading` : 'Watch words, type what you see'}</span>
    </span>
  </a>
  <a class="hub-card" href={routes.spell} style="--c: var(--spell); --s: var(--spell-soft)">
    <span class="hub-icon"><Icon name="camera" size={22} /></span>
    <span class="hub-text">
      <b>Spell with the camera</b>
      <span>{spelling?.spell.clean !== undefined ? `${spelling.spell.clean}% clean lately` : 'Sign words letter by letter'}</span>
    </span>
  </a>
  <a class="hub-card" href={routes.signFive} style="--c: var(--spell); --s: var(--spell-soft)">
    <span class="hub-icon five" aria-hidden="true"><i>5</i></span>
    <span class="hub-text">
      <b>Sign Five</b>
      <span>{fiveStatus}</span>
    </span>
  </a>
  <a class="hub-card" href={routes.camera} style="--c: var(--good); --s: var(--good-soft)">
    <span class="hub-icon"><Icon name="check" size={22} /></span>
    <span class="hub-text">
      <b>Camera practice</b>
      <span>Sign each letter and number, get told what to fix</span>
    </span>
  </a>
  <a class="hub-card" href={routes.signs} style="--c: var(--ink-2); --s: var(--surface-2)">
    <span class="hub-icon"><Icon name="signs" size={22} /></span>
    <span class="hub-text">
      <b>All signs</b>
      <span>{total} letters and numbers, and how to make each one</span>
    </span>
  </a>
</div>

{#if drafts > 0}
  <p class="small muted footnote">
    Sign descriptions and drawings are drafts until a Deaf signer reviews them. Check with a fluent signer when you can.
  </p>
{/if}

<style>
  .hero {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 32px;
    padding: 28px 32px;
  }
  .hero-text > * + * { margin-top: 10px; }
  .hero h1 { font-size: 1.75rem; margin: 0; }
  .lead { font-size: 1rem; color: var(--ink-2); max-width: 52ch; margin-bottom: 4px; }
  .ctas { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 8px; }
  .hero-art {
    width: 160px;
    height: 160px;
    border-radius: var(--radius);
    background: var(--paper);
    border: 1px solid var(--line);
    display: grid;
    place-items: end center;
    padding: 16px 16px 0;
    overflow: hidden;
  }

  .progress-strip {
    display: flex;
    align-items: center;
    gap: 12px 24px;
    flex-wrap: wrap;
    margin-top: 12px;
    padding: 12px 18px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink-2);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .progress-strip:hover { border-color: var(--accent); }
  .ps-item b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .ps-item.grow { flex: 1; min-width: 180px; display: grid; gap: 6px; }
  .ps-item .progress { height: 6px; }
  .ps-link { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-weight: 600; margin-left: auto; }

  .section-title { font-size: 1.05rem; margin: 28px 0 12px; }
  .hub { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .hub-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
    box-shadow: var(--shadow);
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .hub-card:hover { border-color: var(--c); box-shadow: var(--shadow-lift); transform: translateY(-1px); }
  .hub-icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--s);
    color: var(--c);
  }
  .hub-icon.five i {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 5px;
    background: var(--hit);
    color: #fff;
    font-style: normal;
    font-weight: 750;
  }
  .hub-text { display: grid; gap: 2px; min-width: 0; }
  .hub-text span { font-size: 0.85rem; color: var(--ink-3); }

  .footnote { margin-top: 24px; text-align: center; }

  @media (max-width: 900px) {
    .hub { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .hero { grid-template-columns: 1fr; padding: 24px 20px; }
    .hero-art { display: none; }
    .hero h1 { font-size: 1.45rem; }
    .ctas .btn { flex: 1 1 100%; justify-content: center; }
    .hub { grid-template-columns: 1fr; }
    .hub-card { padding: 12px 14px; }
  }
</style>
