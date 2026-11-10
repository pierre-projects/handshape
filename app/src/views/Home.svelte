<script lang="ts">
  // Today: a hero with the one next step and where you stand, then today's
  // plan (review, read, the daily word) ticked off as you go, then the other
  // ways to practice.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content } from '../lib/content';
  import { buildQueue } from '../lib/srs';
  import { loadSettings } from '../lib/settings.svelte';
  import { activityDates, streak } from '../lib/stats';
  import { spellingSummary, type SpellingSummary } from '../lib/spelling';
  import { dailyStatus, describeDaily, type DailyState } from '../lib/guess';
  import { confusions, LEVELS, mixUpLetterCount, nextLevel, passedCount, type Level } from '../lib/receptive';
  import { routes } from '../lib/routes';
  import Icon from '../components/Icon.svelte';
  import SignPicture from '../components/SignPicture.svelte';

  let loaded = $state(false);
  let due = $state(0);
  let fresh = $state(0);
  let newRemaining = $state(0);
  let days = $state(0);
  let started = $state(false);
  let learned = $state(0);
  let spelling = $state<SpellingSummary>();
  let nextRead = $state<Level>();
  let levelsPassed = $state(0);
  /** Whether anything has been read in reading practice today. */
  let readToday = $state(false);
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
    const now = new Date();
    const q = buildQueue(content.items, cards, { now, newItemsPerDay: settings.newItemsPerDay });
    due = q.due.length;
    fresh = new Set(q.fresh.map((c) => c.itemId)).size;
    newRemaining = q.newRemaining;
    days = streak(activityDates(reviews, attempts), now);
    spelling = spellingSummary(attempts);
    const levels = settings.readLevels ?? {};
    nextRead = nextLevel(levels, mixUpLetterCount(confusions(attempts)));
    levelsPassed = passedCount(levels);
    readToday = attempts.some((a) => a.mode === 'receptive' && a.at.toDateString() === now.toDateString());
    started = cards.size > 0;
    learned = new Set([...cards.values()].map((c) => c.itemId)).size;
    five = dailyStatus(signFive);
    loaded = true;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const minutes = $derived(Math.max(1, Math.round(todo / 4)));
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // Today's plan: three short things, in the order that works best.
  const reviewDone = $derived(started && todo === 0);
  const fiveDone = $derived(five.state === 'won' || five.state === 'lost');
  const readHref = $derived(nextRead ? routes.readLevel(nextRead.id) : routes.readFree);
  const plan = $derived([
    {
      id: 'review',
      title: 'Review your signs',
      detail: reviewDone
        ? 'Done for today'
        : !started
          ? `${plural(fresh, 'new sign')} to meet · about 5 minutes`
          : `${due && fresh ? `${due} to review, ${fresh} new` : due ? `${plural(due, 'sign')} to review` : `${plural(fresh, 'new sign')}`} · about ${plural(minutes, 'minute')}`,
      href: routes.review,
      done: reviewDone,
      icon: 'review' as const,
    },
    {
      id: 'read',
      title: 'Read some fingerspelling',
      detail: readToday
        ? `Read today${nextRead ? ` · next level: ${nextRead.title}` : ''}`
        : nextRead
          ? `${levelsPassed || nextRead.id !== LEVELS[0].id ? 'Next level' : 'Start with'}: ${nextRead.title} · ten quick reads`
          : 'Every level passed · free practice',
      href: readHref,
      done: readToday,
      icon: 'eye' as const,
    },
    {
      id: 'five',
      title: 'Play Sign Five',
      detail: describeDaily(five),
      href: routes.signFive,
      done: fiveDone,
      icon: 'spell' as const,
    },
  ]);
  const doneCount = $derived(plan.filter((p) => p.done).length);
  /** The first thing on the plan still to do. */
  const upNext = $derived(plan.find((p) => !p.done));
</script>

<section class="hero">
  <div class="hero-text">
    {#if !loaded}
      <p class="eyebrow">Loading…</p>
      <h1>Getting your lessons ready…</h1>
    {:else if !started}
      <p class="eyebrow">Welcome</p>
      <h1>Let's learn to sign.</h1>
      <p class="lead">
        A few minutes a day is all it takes. You'll meet a handful of new signs, and they'll come back just before you'd
        forget them.
      </p>
      <div class="ctas">
        <a class="cta" href={routes.review}><Icon name="play" size={18} />Start your first lesson</a>
      </div>
    {:else if todo > 0}
      <p class="eyebrow">{greeting}</p>
      <h1>{plural(todo, 'sign')} ready for you.</h1>
      <p class="lead">
        {#if due && fresh}{due} to review and {fresh} new.{:else if due}Reviews only, nothing new today.{:else}{plural(fresh, 'new sign')} to meet.{/if}
        About {plural(minutes, 'minute')}.
      </p>
      <div class="ctas">
        <a class="cta" href={routes.review}><Icon name="play" size={18} />Start review</a>
      </div>
    {:else if upNext}
      <p class="eyebrow">{greeting}</p>
      <h1>Reviews done. {upNext.id === 'read' ? 'Now read a little.' : 'One game left.'}</h1>
      <p class="lead">
        {upNext.id === 'read'
          ? 'Reading fingerspelling is the hard part, and ten quick reads a day is how it gets easy.'
          : "Guess today's five-letter word by fingerspelling it to your camera."}
      </p>
      <div class="ctas">
        <a class="cta" href={upNext.href}>
          <Icon name="play" size={18} />{upNext.id === 'read' ? (nextRead ? `Read: ${nextRead.title}` : 'Free reading practice') : five.state === 'playing' ? 'Keep playing Sign Five' : "Play today's Sign Five"}
        </a>
        {#if newRemaining > 0}
          <a class="cta ghost" href={routes.reviewMore}><Icon name="plus" size={18} />Learn 5 new signs</a>
        {/if}
      </div>
    {:else}
      <p class="eyebrow">{greeting}</p>
      <h1>That's today done.</h1>
      <p class="lead">Review, reading and today's word are all ticked off. Come back tomorrow, or keep going.</p>
      <div class="ctas">
        <a class="cta" href={routes.camera}><Icon name="camera" size={18} />Practice on camera</a>
        {#if newRemaining > 0}
          <a class="cta ghost" href={routes.reviewMore}><Icon name="plus" size={18} />Learn 5 new signs</a>
        {/if}
      </div>
    {/if}

    {#if loaded && started}
      <a class="stats" href={routes.dashboard}>
        <span><b>{days}</b> day streak</span>
        <span class="signs">
          <span><b>{learned}</b> of {total} signs started</span>
          <span class="bar" aria-hidden="true"><span style="width:{(learned / total) * 100}%"></span></span>
        </span>
        <span><b>{levelsPassed}</b> of {LEVELS.length} reading levels</span>
        <span class="more">Dashboard<Icon name="arrow-right" size={15} /></span>
      </a>
    {/if}
  </div>
  <!-- A, S and L, as you'd fingerspell them. -->
  <div class="hero-art" aria-hidden="true">
    {#each ['a', 's', 'l'] as id}
      <span class="tile"><SignPicture {id} size={74} /><b>{id.toUpperCase()}</b></span>
    {/each}
  </div>
</section>

<section class="plan" aria-labelledby="plan-title">
  <div class="plan-head">
    <h2 id="plan-title">Today's plan</h2>
    {#if loaded}<span class="small muted">{doneCount} of {plan.length} done</span>{/if}
  </div>
  <ol>
    {#each plan as step, i}
      <li>
        <a class="step" class:done={loaded && step.done} class:next={loaded && step === upNext} href={step.href}>
          <span class="mark">{#if loaded && step.done}<Icon name="check" size={16} />{:else}{i + 1}{/if}</span>
          <span class="step-text">
            <b>{step.title}</b>
            <span>{loaded ? step.detail : '…'}</span>
          </span>
          <span class="step-go">
            {#if loaded && step.done}Again{:else if loaded && step === upNext}Up next{:else}Open{/if}<Icon name="arrow-right" size={16} />
          </span>
        </a>
      </li>
    {/each}
  </ol>
</section>

<h2 class="section-title">More practice</h2>
<div class="hub">
  <a class="hub-card" href={routes.spell} style="--c: var(--spell); --s: var(--spell-soft)">
    <span class="hub-icon"><Icon name="camera" size={22} /></span>
    <span class="hub-text">
      <b>Spell with the camera</b>
      <span>{spelling?.spell.clean !== undefined ? `${spelling.spell.clean}% clean lately` : 'Sign words letter by letter'}</span>
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
  /* The hero: the app's colour, the one next step, and where you stand. */
  .hero {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 32px;
    padding: 32px 36px; border-radius: calc(var(--radius) + 4px); color: #fff;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 58%, #0b1020));
    box-shadow: 0 10px 24px -12px color-mix(in srgb, var(--accent) 70%, transparent);
  }
  .hero-text { display: grid; gap: 10px; justify-items: start; min-width: 0; }
  .hero .eyebrow { margin: 0; color: rgb(255 255 255 / 0.78); }
  .hero h1 { margin: 0; font-size: 2.1rem; line-height: 1.12; letter-spacing: -0.03em; color: #fff; }
  .lead { margin: 0; font-size: 1.02rem; color: rgb(255 255 255 / 0.9); max-width: 50ch; }
  .ctas { display: flex; flex-wrap: wrap; gap: 10px; padding-top: 8px; }
  .cta {
    display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 10px 20px;
    border-radius: var(--radius-sm); background: #fff; color: var(--accent); font-weight: 700; text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .cta:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -6px rgb(0 0 0 / 0.4); }
  .cta.ghost { background: rgb(255 255 255 / 0.14); color: #fff; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.35); }
  .cta.ghost:hover { background: rgb(255 255 255 / 0.22); }
  .cta:focus-visible, .stats:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

  .stats {
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px 22px; margin-top: 14px; padding-top: 14px;
    width: 100%; border-top: 1px solid rgb(255 255 255 / 0.2);
    color: rgb(255 255 255 / 0.85); font-size: 0.9rem; text-decoration: none;
  }
  .stats b { color: #fff; font-variant-numeric: tabular-nums; }
  .signs { display: grid; gap: 5px; min-width: 150px; }
  .bar { display: block; height: 5px; border-radius: 999px; background: rgb(255 255 255 / 0.22); overflow: hidden; }
  .bar > span { display: block; height: 100%; border-radius: inherit; background: #fff; }
  .more { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-weight: 650; color: #fff; }
  .stats:hover .more { text-decoration: underline; }

  .hero-art { display: flex; gap: 10px; align-items: center; }
  .tile {
    display: grid; justify-items: center; gap: 2px; padding: 10px 8px 6px; border-radius: 12px;
    background: var(--paper); box-shadow: 0 8px 18px -8px rgb(0 0 0 / 0.45);
  }
  .tile b { font-size: 1.05rem; color: #18181b; }
  .tile:nth-child(1) { transform: rotate(-5deg) translateY(6px); }
  .tile:nth-child(3) { transform: rotate(5deg) translateY(6px); }

  /* Today's plan */
  .plan { margin-top: 26px; }
  .plan-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .plan-head h2 { margin: 0; font-size: 1.05rem; }
  .plan ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .step {
    display: flex; align-items: center; gap: 14px; padding: 14px 16px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow);
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .step:hover { border-color: var(--accent); box-shadow: var(--shadow-lift); transform: translateY(-1px); }
  .step.next { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .mark {
    flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
    background: var(--accent-soft); color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .done .mark { background: var(--good-soft); color: var(--good); }
  .step-text { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .step-text span { font-size: 0.875rem; color: var(--ink-3); }
  .done .step-text b { color: var(--ink-2); }
  .step-go { display: inline-flex; align-items: center; gap: 4px; font-size: 0.875rem; font-weight: 650; color: var(--ink-3); white-space: nowrap; }
  .next .step-go { color: var(--accent); }

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
  .hub-text { display: grid; gap: 2px; min-width: 0; }
  .hub-text span { font-size: 0.85rem; color: var(--ink-3); }

  .footnote { margin-top: 24px; text-align: center; }

  @media (max-width: 900px) {
    .hub { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hero-art { display: none; }
    .hero { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .hero { padding: 24px 20px; }
    .hero h1 { font-size: 1.6rem; }
    .ctas { width: 100%; }
    .ctas .cta { flex: 1 1 100%; justify-content: center; }
    .more { margin-left: 0; }
    .hub { grid-template-columns: 1fr; }
    .hub-card { padding: 12px 14px; }
    .step { padding: 12px; gap: 12px; }
    .step-go { display: none; }
  }
</style>
