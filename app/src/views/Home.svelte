<script lang="ts">
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content, letterMap } from '../lib/content';
  import { buildQueue } from '../lib/srs';
  import { activityDates, streak } from '../lib/stats';
  import { lettersPerSecondToWpm, readingSpeed } from '../lib/spelling';

  let loaded = $state(false);
  let due = $state(0);
  let fresh = $state(0);
  let newRemaining = $state(0);
  let days = $state(0);
  let speed = $state<number>();
  let started = $state(false);

  const withMedia = content.items.filter((i) => i.files.length > 0).length;
  const lettersWithMedia = [...letterMap().values()].filter((i) => i.files.length > 0).length;
  const drafts = content.units.filter((u) => u.review.status === 'draft').length;

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
    loaded = true;
  });
</script>

<section class="card stack">
  <h1>{started ? 'Today' : 'Start learning ASL'}</h1>
  {#if !loaded}
    <p class="muted">Loading…</p>
  {:else}
    {#if !started}
      <p>
        Each day you get a short review of signs you are learning, plus a few new ones. Signs come back just
        before you would forget them, so a few minutes a day goes a long way.
      </p>
    {/if}
    <div class="stat-grid">
      <div class="stat"><div class="value">{due}</div><div class="label">reviews due</div></div>
      <div class="stat"><div class="value">{fresh}</div><div class="label">new signs today</div></div>
      <div class="stat"><div class="value">{days}</div><div class="label">day streak</div></div>
      {#if speed}
        <div class="stat">
          <div class="value">{lettersPerSecondToWpm(speed)}</div>
          <div class="label">fingerspelling read, wpm</div>
        </div>
      {/if}
    </div>
    {#if due + fresh > 0}
      <a class="btn primary" href="#/review">Start review</a>
    {:else}
      <p>You're done for today.{newRemaining > 0 ? ' You can learn extra signs from the Review page.' : ''}</p>
      <a class="btn" href="#/fingerspell">Practise fingerspelling</a>
    {/if}
  {/if}
</section>

<section class="card stack">
  <h2>Ways to practise</h2>
  <ul class="ways">
    <li><a href="#/review">Review</a>: daily spaced-repetition queue. Sign each prompt, then grade yourself.</li>
    <li><a href="#/fingerspell">Fingerspell</a>: read fingerspelled words at a speed that adapts to you, or spell words yourself against a timer.</li>
    <li><a href="#/practice">Camera</a>: sign letters and numbers to your camera and get told what to fix. Moves on as soon as you get each one.</li>
    <li><a href="#/learn">Signs</a>: browse every sign with handshape, palm and movement notes.</li>
  </ul>
</section>

{#if drafts > 0 || withMedia < content.items.length}
  <section class="notice stack">
    {#if withMedia < content.items.length}
      <p>
        {withMedia} of {content.items.length} signs have an image or video, including {lettersWithMedia} of 26 letters.
        Reading drills unlock as media is added to the content folder.
      </p>
    {/if}
    {#if drafts > 0}
      <p>Sign descriptions are drafts until a Deaf signer reviews them. Check against a fluent signer when you can.</p>
    {/if}
  </section>
{/if}

<style>
  .ways { margin: 0; padding-left: 20px; }
  .ways li + li { margin-top: 6px; }
  .notice p { margin: 0; }
</style>
