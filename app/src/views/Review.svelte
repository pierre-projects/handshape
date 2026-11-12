<script lang="ts">
  import { routes } from '../lib/routes';
  import { onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import {
    buildQueue, checkAnswer, describeInterval, previewIntervals, Rating, ReviewSession, State, suggestedRating, type Grade,
  } from '../lib/srs';
  import { isCheckable } from '../lib/engine/handshapes';
  import HandCheck from '../components/HandCheck.svelte';
  import type { StoredCard } from '../lib/types';
  import { loadSettings, prefs } from '../lib/settings.svelte';
  import SignDetail from '../components/SignDetail.svelte';
  import SignMedia from '../components/SignMedia.svelte';
  import CameraMirror from '../components/CameraMirror.svelte';
  import GradeButtons from '../components/GradeButtons.svelte';
  import Icon from '../components/Icon.svelte';

  /** Opened as #/review/more: start with five extra new signs. */
  let { more = false }: { more?: boolean } = $props();

  let store: Store;
  const settings = $derived(prefs.value);
  let session = $state<ReviewSession>();
  let card = $state<StoredCard>();
  let phase = $state<'prompt' | 'answer'>('prompt');
  let typed = $state('');
  let correct = $state<boolean>();
  let gaveUp = $state(false);
  let cameraMatched = $state(false);
  let intervals = $state<Record<number, number>>({});
  let mirror = $state(false);
  let showCamera = $state(false);
  let nextDue = $state<Date>();
  let newRemaining = $state(0);
  let input = $state<HTMLInputElement>();
  /** Grades given this sitting, for the summary. */
  let tally = $state({ again: 0, hard: 0, good: 0, easy: 0 });
  let busy = false;

  const item = $derived(card ? content.byId.get(card.itemId) : undefined);
  const isNew = $derived(card?.fsrs.state === State.New);
  const total = $derived(session ? session.done + session.remaining : 0);
  const pct = $derived(total ? (session!.done / total) * 100 : 0);
  const mode = $derived(
    !card ? undefined : isNew ? 'new' : card.kind === 'recognize' ? 'read' : 'sign',
  );
  const MODES = {
    new: { label: 'New sign', icon: 'plus' },
    read: { label: 'Read it', icon: 'review' },
    sign: { label: 'Sign it', icon: 'signs' },
  } as const;
  const kindWord = $derived(item?.kind === 'sign' ? 'word' : item?.kind ?? 'sign');
  const knewIt = $derived(tally.hard + tally.good + tally.easy);
  const graded = $derived(knewIt + tally.again);

  onMount(async () => {
    store = await getStore();
    const s = await loadSettings();
    mirror = s.mirrorMedia;
    showCamera = s.showCameraByDefault;
    await start(s.newItemsPerDay, more ? 5 : 0);
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
    tally = { again: 0, hard: 0, good: 0, easy: 0 };
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
    gaveUp = false;
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

  function dontKnow() {
    if (!card) return;
    gaveUp = true;
    correct = false;
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
      const key = rating === Rating.Again ? 'again' : rating === Rating.Hard ? 'hard' : rating === Rating.Good ? 'good' : 'easy';
      tally[key]++;
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
    if (e.target instanceof HTMLInputElement) {
      if (e.key === 'Escape' && phase === 'prompt' && card?.kind === 'recognize') {
        e.preventDefault();
        dontKnow();
      }
      return;
    }
    if (phase === 'prompt' && card?.kind === 'produce' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      phase = 'answer';
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !session}
  <p class="muted loading-note">Loading…</p>
{:else if !card || !item}
  <section class="card done">
    <span class="done-icon"><Icon name="check" size={36} /></span>
    <h1>{session.done > 0 ? 'Session complete' : 'Nothing due right now'}</h1>
    {#if graded > 0}
      <p class="muted">You worked through {graded} {graded === 1 ? 'card' : 'cards'}.</p>
      <div class="summary">
        <div class="stat good"><b>{knewIt}</b><span>Knew it</span></div>
        <div class="stat bad"><b>{tally.again}</b><span>Again</span></div>
        <div class="stat"><b>{Math.round((knewIt / graded) * 100)}%</b><span>Recall</span></div>
      </div>
    {:else}
      <p class="muted">You're all caught up. New cards unlock each day.</p>
    {/if}
    {#if nextDue}
      <p class="next small">
        <Icon name="review" size={16} />Next review <b>{describeInterval(nextDue.getTime() - Date.now())}</b>
      </p>
    {/if}
    <div class="row center actions">
      {#if newRemaining > 0}
        <button class="primary" onclick={() => start(settings!.newItemsPerDay, 5)}><Icon name="plus" size={16} />Learn 5 more signs</button>
      {/if}
      <a class="btn" class:primary={newRemaining === 0} href={routes.practice}>Practice</a>
      <a class="btn ghost" href={routes.home}>Back to Today</a>
    </div>
  </section>
{:else}
  <div class="session-bar">
    <a class="btn ghost small icon-only" href={routes.home} aria-label="End session" title="End session"><Icon name="x" size={18} /></a>
    <div class="progress" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={session.done}>
      <span style="width:{pct}%"></span>
    </div>
    <span class="small count"><b>{session.remaining}</b> left</span>
  </div>

  <div class="mode-row">
    <span class="mode {mode}"><Icon name={MODES[mode!].icon} size={15} />{MODES[mode!].label}</span>
    <span class="small muted">
      {#if mode === 'new'}Copy it a few times, then grade how well it stuck.
      {:else if mode === 'read'}What does this sign mean?
      {:else}Make the sign for this {kindWord}.{/if}
    </span>
  </div>

  <section class="card stage">
    {#if card.kind === 'recognize' && phase === 'prompt'}
      <div class="read">
        <SignMedia {item} bind:mirror />
        <form class="answer-form" onsubmit={submitTyped}>
          <label for="answer">Your answer</label>
          <input
            id="answer"
            bind:this={input}
            bind:value={typed}
            class="answer-input"
            type="text"
            placeholder="Type the {kindWord}"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <div class="answer-actions">
            <button class="primary lg" type="submit" disabled={!typed.trim()}>Check <kbd>Enter</kbd></button>
            <button type="button" class="ghost" onclick={dontKnow}>I don't know <kbd>Esc</kbd></button>
          </div>
        </form>
      </div>
    {:else if phase === 'prompt'}
      <div class="sign-prompt">
        <div class="giant">{item.gloss}</div>
        <p class="muted">
          {isCheckable(item.id) ? 'Sign it to the camera below, or check yourself.' : 'Make the sign, then check yourself.'}
        </p>
        <button class="primary lg" onclick={() => (phase = 'answer')}>Show answer <kbd>Space</kbd></button>
      </div>
    {:else}
      {#if correct === true}
        <div class="result good"><Icon name="check" size={18} /><span><b>Correct.</b> It's {item.gloss}.</span></div>
      {:else if correct === false}
        <div class="result bad">
          <Icon name="x" size={18} />
          <span>
            <b>It's {item.gloss}.</b>
            {gaveUp ? 'Have a good look, it will come back soon.' : `You typed “${typed.trim().toUpperCase()}”.`}
          </span>
        </div>
      {:else if cameraMatched}
        <div class="result good"><Icon name="camera" size={18} /><span><b>Camera match.</b> Your handshape looked right.</span></div>
      {:else if !isNew}
        <div class="result neutral"><span>Compare with yours: handshape, palm and movement.</span></div>
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
    <div class="grade-dock">
      <GradeButtons
        {intervals}
        suggested={correct !== undefined ? suggestedRating(correct) : cameraMatched ? Rating.Good : undefined}
        onGrade={grade}
      />
    </div>
  {/if}
{/if}

<style>
  .session-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .session-bar .progress { flex: 1; height: 8px; }
  .icon-only { padding: 6px; min-height: 36px; min-width: 36px; }
  .count { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--ink-3); }
  .count b { color: var(--ink); }

  .mode-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 2px 10px; }
  .mode {
    flex: none;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 650;
    background: var(--surface-2);
    color: var(--ink-2);
  }
  .mode.new { background: var(--accent-soft); color: var(--accent); }
  .mode.read { background: var(--ok-soft); color: var(--ok); }
  .mode.sign { background: var(--good-soft); color: var(--good); }

  .stage { display: grid; gap: 16px; }

  .read { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 28px; align-items: center; }
  .answer-form { display: grid; gap: 10px; }
  .answer-form label { font-weight: 650; color: var(--ink-2); font-size: 0.9rem; }
  .answer-input { max-width: none; text-align: left; font-size: 1.4rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; padding: 12px 14px; }
  .answer-input::placeholder { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 1rem; }
  .answer-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .sign-prompt { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 28px 0 16px; }
  .sign-prompt p { margin: 0 0 6px; }
  .giant { font-size: clamp(4.5rem, 20vw, 7rem); font-weight: 700; line-height: 1; letter-spacing: -0.02em; }

  .result {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
  }
  .result :global(svg) { flex: none; }
  .result.good { background: var(--good-soft); color: var(--good); }
  .result.bad { background: var(--bad-soft); color: var(--bad); }
  .result.neutral { background: var(--surface-2); color: var(--ink-2); }

  .done { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 40px 24px; }
  .done h1 { margin: 6px 0 0; }
  .done p { margin: 0; }
  .done-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--good-soft);
    color: var(--good);
  }
  .summary { display: grid; grid-template-columns: repeat(3, minmax(92px, 1fr)); gap: 10px; margin: 8px 0; }
  .stat { display: grid; gap: 2px; padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); }
  .stat b { font-size: 1.5rem; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .stat span { font-size: 0.78rem; color: var(--ink-3); font-weight: 600; }
  .stat.good b { color: var(--good); }
  .stat.bad b { color: var(--bad); }
  .next { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); }
  .actions { margin-top: 10px; flex-wrap: wrap; }

  .grade-dock {
    position: sticky;
    bottom: 0;
    z-index: 5;
    margin: 12px -16px 0;
    padding: 10px 16px 12px;
    background: color-mix(in srgb, var(--bg) 90%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line);
  }
  @media (max-width: 820px) {
    .grade-dock { bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); }
    /* How far along you are stays in view while you scroll a long card. */
    .session-bar {
      position: sticky; top: 0; z-index: 6; margin: -4px -16px 8px; padding: 8px 16px;
      background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(10px);
    }
  }
  @media (max-width: 640px) {
    .read { grid-template-columns: 1fr; gap: 16px; }
    .answer-actions > * { flex: 1; }
    .mode-row { margin-bottom: 8px; gap: 4px 10px; }
    .stage { gap: 12px; }
    .sign-prompt { padding: 14px 0 6px; }
    .sign-prompt .primary { width: 100%; }
    .done { padding: 28px 16px; }
    .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }
    .stat { padding: 10px 6px; }
    .actions { width: 100%; }
    .actions > * { flex: 1 1 100%; justify-content: center; }
  }
</style>
