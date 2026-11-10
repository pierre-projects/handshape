<script lang="ts">
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content } from '../lib/content';
  import { buildQueue } from '../lib/srs';
  import { activityDates, streak } from '../lib/stats';
  import { lettersPerSecondToWpm, readingSpeed } from '../lib/spelling';
  import HandSign from '../components/HandSign.svelte';
  import Icon from '../components/Icon.svelte';

  let loaded = $state(false);
  let due = $state(0);
  let fresh = $state(0);
  let newRemaining = $state(0);
  let days = $state(0);
  let speed = $state<number>();
  let started = $state(false);
  let learned = $state(0);

  const drafts = content.units.filter((u) => u.review.status === 'draft').length;
  const total = content.items.length;

  onMount(async () => {
    const store = await getStore();
    const [cards, settings, reviews, attempts] = await Promise.all([
      store.cards(),
      store.settings(),
      store.reviews(),
      store.attempts(),
    ]);
    const q = buildQueue(content.items, cards, { now: new Date(), newItemsPerDay: settings.newItemsPerDay });
    due = q.due.length;
    fresh = new Set(q.fresh.map((c) => c.itemId)).size;
    newRemaining = q.newRemaining;
    days = streak(activityDates(reviews, attempts), new Date());
    speed = readingSpeed(attempts);
    started = cards.size > 0;
    learned = new Set([...cards.values()].map((c) => c.itemId)).size;
    loaded = true;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todo = $derived(due + fresh);
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
        A few minutes a day is all it takes. You'll learn a handful of new signs, and they'll come back just before you'd
        forget them.
      </p>
      <a class="btn primary lg" href="#/review"><Icon name="play" size={18} />Start your first lesson</a>
      <p class="small muted">{fresh} new signs to start · about 5 minutes</p>
    {:else if todo > 0}
      <p class="eyebrow">{greeting}</p>
      <h1>{todo} {todo === 1 ? 'sign' : 'signs'} ready for you.</h1>
      <p class="lead">
        {#if due && fresh}{due} to review and {fresh} new.{:else if due}All reviews, nothing new.{:else}{fresh} new signs to meet.{/if}
      </p>
      <a class="btn primary lg" href="#/review"><Icon name="play" size={18} />Start review</a>
    {:else}
      <p class="eyebrow">{greeting}</p>
      <h1>You're all caught up.</h1>
      <p class="lead">
        Nice work. {newRemaining > 0 ? 'Want more? Learn extra signs from the review page, or' : 'Keep it fresh:'} practise
        fingerspelling.
      </p>
      <div class="row">
        <a class="btn primary lg" href="#/fingerspell"><Icon name="spell" size={18} />Practise spelling</a>
        {#if newRemaining > 0}<a class="btn lg" href="#/review">Learn more</a>{/if}
      </div>
    {/if}
  </div>
  <div class="hero-art">
    <HandSign id="5" size={130} animate={false} label="" />
  </div>
</section>

{#if loaded && started}
  <div class="stat-grid stats">
    <div class="stat"><div class="value">{days}<span class="unit"> {days === 1 ? 'day' : 'days'}</span></div><div class="label">streak</div></div>
    <div class="stat">
      <div class="value">{learned}<span class="unit">/{total}</span></div>
      <div class="label">signs started</div>
      <div class="progress" aria-hidden="true"><span style="width:{(learned / total) * 100}%"></span></div>
    </div>
    <div class="stat"><div class="value">{due}</div><div class="label">reviews due</div></div>
    {#if speed}
      <div class="stat"><div class="value">{lettersPerSecondToWpm(speed)}</div><div class="label">reading wpm</div></div>
    {/if}
  </div>
{/if}

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
  .hero .btn.lg { margin-top: 10px; }
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
  .stats { margin-bottom: 24px; }
  .stat .unit { font-size: 0.95rem; font-weight: 600; color: var(--ink-3); }
  .stat .progress { margin-top: 8px; height: 6px; }
  .footnote { margin-top: 20px; text-align: center; }
  @media (max-width: 640px) {
    .hero { grid-template-columns: 1fr; padding: 24px 20px; text-align: left; }
    .hero-art { display: none; }
    .hero h1 { font-size: 1.45rem; }
  }
</style>
