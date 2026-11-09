<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import {
    buildQueue, checkAnswer, formatInterval, previewIntervals, Rating, ReviewSession, State, suggestedRating, type Grade,
  } from '../lib/srs';
  import { isCheckable } from '../lib/engine/handshapes';
  import HandCheck from '../components/HandCheck.svelte';
  import type { Settings, StoredCard } from '../lib/types';
  import SignDetail from '../components/SignDetail.svelte';
  import SignMedia from '../components/SignMedia.svelte';
  import CameraMirror from '../components/CameraMirror.svelte';
  import GradeButtons from '../components/GradeButtons.svelte';

  let store: Store;
  let settings = $state<Settings>();
  let session = $state<ReviewSession>();
  let card = $state<StoredCard>();
  let phase = $state<'prompt' | 'answer'>('prompt');
  let typed = $state('');
  let correct = $state<boolean>();
  let cameraMatched = $state(false);
  let intervals = $state<Record<number, string>>({});
  let mirror = $state(false);
  let showCamera = $state(false);
  let nextDue = $state<Date>();
  let newRemaining = $state(0);
  let input = $state<HTMLInputElement>();
  let busy = false;

  const item = $derived(card ? content.byId.get(card.itemId) : undefined);
  const isNew = $derived(card?.fsrs.state === State.New);

  onMount(async () => {
    store = await getStore();
    settings = await store.settings();
    mirror = settings.mirrorMedia;
    showCamera = settings.showCameraByDefault;
    await start(settings.newItemsPerDay);
  });

  async function start(newItemsPerDay: number, extra = 0) {
    const cards = await store.cards();
    const now = new Date();
    const q = buildQueue(content.items, cards, { now, newItemsPerDay: extra ? 0 : newItemsPerDay });
    let fresh = q.fresh;
    if (extra) fresh = buildQueue(content.items, cards, { now, newItemsPerDay: q.introducedToday + extra }).fresh;
    newRemaining = extra ? Math.max(0, q.newRemaining - extra) : q.newRemaining;
    const known = (c: StoredCard) => content.byId.has(c.itemId);
    session = new ReviewSession([...q.due.filter(known), ...fresh.filter(known)]);
    nextDue = await nextDueDate();
    await show();
  }

  async function nextDueDate(): Promise<Date | undefined> {
    const now = Date.now();
    const dues = [...(await store.cards()).values()].map((c) => c.fsrs.due).filter((d) => d.getTime() > now);
    return dues.sort((a, b) => a.getTime() - b.getTime())[0];
  }

  async function show() {
    card = session?.current;
    typed = '';
    correct = undefined;
    cameraMatched = false;
    if (!card) return;
    phase = card.fsrs.state === State.New ? 'answer' : 'prompt';
    intervals = previewIntervals(card, new Date());
    await tick();
    input?.focus();
  }

  function submitTyped(e: Event) {
    e.preventDefault();
    if (!card || !typed.trim()) return;
    correct = checkAnswer(content.byId.get(card.itemId)!.answer, typed);
    phase = 'answer';
  }

  async function grade(rating: Grade) {
    if (!session || !card || busy || phase !== 'answer') return;
    busy = true;
    try {
      const extra =
        card.kind === 'recognize' && correct !== undefined
          ? { correct, typed: typed.trim() }
          : card.kind === 'produce' && cameraMatched
            ? { camera: true }
            : {};
      const { card: updated, entry } = session.answer(rating, new Date(), extra);
      await store.recordReview(updated, entry);
      await show();
      if (!card) nextDue = await nextDueDate();
    } finally {
      busy = false;
    }
  }

  function onCameraMatch() {
    cameraMatched = true;
    if (phase === 'prompt') phase = 'answer';
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (phase === 'prompt' && card?.kind === 'produce' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      phase = 'answer';
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !session}
  <p class="muted">Loading…</p>
{:else if !card || !item}
  <section class="card stack center">
    <h1>Done for now</h1>
    {#if session.done > 0}<p>You reviewed {session.done} {session.done === 1 ? 'card' : 'cards'}.</p>{/if}
    {#if nextDue}
      <p class="muted">Next review in {formatInterval(nextDue.getTime() - Date.now())}.</p>
    {/if}
    <div class="row" style="justify-content:center">
      {#if newRemaining > 0}
        <button onclick={() => start(settings!.newItemsPerDay, 5)}>Learn 5 more signs</button>
      {/if}
      <a class="btn primary" href="#/fingerspell">Practise fingerspelling</a>
    </div>
  </section>
{:else}
  <div class="spread small muted bar">
    <span>{session.remaining} left</span>
    <span>
      {#if isNew}<span class="badge new">New sign</span>{/if}
      {card.kind === 'recognize' ? 'What is this sign?' : 'Sign it'}
    </span>
  </div>

  <section class="card stack">
    {#if card.kind === 'recognize'}
      {#if phase === 'prompt'}
        <SignMedia {item} bind:mirror />
        <form class="center stack" onsubmit={submitTyped}>
          <label for="answer" class="muted">Type what this sign means</label>
          <input
            id="answer"
            bind:this={input}
            bind:value={typed}
            class="answer-input"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <div><button class="primary" type="submit" disabled={!typed.trim()}>Check</button></div>
        </form>
      {:else}
        {#if correct !== undefined}
          <div class="result" class:good={correct} class:bad={!correct}>
            {correct ? 'Correct' : `Not quite. You typed “${typed.trim().toUpperCase()}”.`}
          </div>
        {/if}
        <SignDetail {item} bind:mirror />
      {/if}
    {:else if phase === 'prompt'}
      <div class="center stack">
        <p class="muted">Sign this {item.kind === 'sign' ? 'word' : item.kind}:</p>
        <div class="big-gloss">{item.gloss}</div>
        <div><button class="primary" onclick={() => (phase = 'answer')}>Show answer <kbd>Space</kbd></button></div>
      </div>
    {:else}
      {#if cameraMatched}
        <div class="result good">The camera matched your handshape.</div>
      {:else if !isNew}
        <p class="muted small">Did your sign match? Check handshape, palm and movement.</p>
      {/if}
      <SignDetail {item} bind:mirror />
    {/if}
  </section>

  {#if card.kind === 'produce'}
    <section class="card">
      {#if isCheckable(item.id)}
        <HandCheck target={item.id} autostart={showCamera} dominantHand={settings?.dominantHand} onMatch={onCameraMatch} />
      {:else}
        <CameraMirror autostart={showCamera} />
      {/if}
    </section>
  {/if}

  {#if phase === 'answer'}
    <GradeButtons
      {intervals}
      suggested={correct !== undefined ? suggestedRating(correct) : cameraMatched ? Rating.Good : undefined}
      onGrade={grade}
    />
    <p class="small muted center hint">
      {isNew ? 'Practise it a few times, then grade how well you know it.' : 'Again if you missed it, Good if you got it.'}
    </p>
  {/if}
{/if}

<style>
  .bar { margin-bottom: 8px; }
  .hint { margin-top: 10px; }
</style>
