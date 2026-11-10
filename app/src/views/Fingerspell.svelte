<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content, letterMap } from '../lib/content';
  import {
    buildSequence, checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, normaliseWord,
    pickWord, readingSpeed, sequenceDuration, spellableWords, type Frame,
  } from '../lib/spelling';
  import type { Settings, SpellingAttempt } from '../lib/types';
  import CameraMirror from '../components/CameraMirror.svelte';
  import HandSign from '../components/HandSign.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import { hasIllustration } from '../lib/illustrations';

  type Mode = 'receptive' | 'expressive';

  let store: Store;
  let settings = $state<Settings>();
  let attempts = $state<SpellingAttempt[]>([]);
  let mode = $state<Mode>('expressive');
  let phase = $state<'idle' | 'playing' | 'answer' | 'feedback' | 'signing'>('idle');
  let word = $state('');
  let recent: string[] = [];
  let frame = $state<Frame>();
  let replays = $state(0);
  let typed = $state('');
  let lastCorrect = $state(false);
  let speedBefore = $state(0);
  let startedAt = 0;
  let elapsed = $state(0);
  let input = $state<HTMLInputElement>();
  let timers: ReturnType<typeof setTimeout>[] = [];

  const letters = letterMap();
  // A letter can be shown if it has real media or a drawn illustration.
  const available = new Set(
    [...letters].filter(([, i]) => i.files.length > 0 || hasIllustration(i.id)).map(([l]) => l),
  );
  let hints = $state(false);
  const receptiveWords = spellableWords(content.practiceWords, available);
  const allWords = content.practiceWords;
  const canRead = receptiveWords.length > 0;

  const stats = $derived(letterStats(attempts));
  const weakLetters = $derived(
    [...stats.entries()].filter(([, s]) => s.seen >= 3 && s.missed > 0).sort((a, b) => b[1].rate - a[1].rate).slice(0, 5),
  );
  const reading = $derived(readingSpeed(attempts));
  const expressive = $derived(
    attempts.filter((a) => a.mode === 'expressive' && a.correct).slice(-10).map((a) => a.lettersPerSecond),
  );
  const signingSpeed = $derived(expressive.length ? expressive.reduce((a, b) => a + b, 0) / expressive.length : undefined);
  const speed = $derived(settings?.receptiveSpeed ?? 1.5);

  onMount(async () => {
    store = await getStore();
    settings = await store.settings();
    attempts = await store.attempts();
    if (canRead) mode = 'receptive';
  });

  onDestroy(clearTimers);

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function setMode(m: Mode) {
    clearTimers();
    mode = m;
    phase = 'idle';
  }

  function next() {
    const pool = mode === 'receptive' ? receptiveWords : allWords;
    word = pickWord(pool, mode === 'receptive' ? stats : new Map(), recent) ?? pool[0];
    recent = [...recent.slice(-9), word];
    replays = 0;
    typed = '';
    if (mode === 'receptive') play();
    else {
      phase = 'signing';
      startedAt = performance.now();
    }
  }

  /** Plays the word. After feedback, replaying returns to feedback instead of the answer box. */
  async function play(after: 'answer' | 'feedback' = 'answer') {
    clearTimers();
    phase = 'playing';
    frame = undefined;
    const frames = buildSequence(word, speed);
    const lead = 400;
    for (const f of frames) {
      timers.push(setTimeout(() => (frame = f), lead + f.startMs));
      timers.push(setTimeout(() => { if (frame === f) frame = undefined; }, lead + f.startMs + f.durationMs));
    }
    timers.push(
      setTimeout(async () => {
        frame = undefined;
        phase = after;
        if (after === 'answer') {
          await tick();
          input?.focus();
        }
      }, lead + sequenceDuration(frames) + 150),
    );
  }

  function replay() {
    replays++;
    play();
  }

  async function saveSpeed(v: number) {
    if (!settings) return;
    settings = { ...settings, receptiveSpeed: v };
    await store.saveSettings($state.snapshot(settings));
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!normaliseWord(typed)) return;
    lastCorrect = checkWord(word, typed);
    speedBefore = speed;
    const attempt: SpellingAttempt = {
      word, mode: 'receptive', correct: lastCorrect, typed: normaliseWord(typed),
      lettersPerSecond: speed, replays, at: new Date(),
    };
    await store.addAttempt(attempt);
    attempts = [...attempts, attempt];
    await saveSpeed(nextSpeed(speed, lastCorrect, replays));
    phase = 'feedback';
  }

  function finishSigning() {
    elapsed = (performance.now() - startedAt) / 1000;
    phase = 'feedback';
  }

  async function gradeSigning(clean: boolean) {
    const attempt: SpellingAttempt = {
      word, mode: 'expressive', correct: clean,
      lettersPerSecond: Math.round((word.length / Math.max(elapsed, 0.1)) * 100) / 100,
      replays: 0, at: new Date(),
    };
    await store.addAttempt(attempt);
    attempts = [...attempts, attempt];
    next();
  }

  function adjust(factor: number) {
    const v = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed * factor)) * 100) / 100;
    saveSpeed(v);
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (phase === 'idle' || (phase === 'feedback' && mode === 'receptive')) {
      e.preventDefault();
      next();
    } else if (phase === 'signing') {
      e.preventDefault();
      finishSigning();
    }
  }

  const media = (l: string) => letters.get(l)?.files[0];
</script>

<svelte:window onkeydown={onKey} />

<div class="spread head">
  <h1>Fingerspelling</h1>
  <div class="segmented" role="tablist">
    <button role="tab" aria-selected={mode === 'receptive'} onclick={() => setMode('receptive')}>Read</button>
    <button role="tab" aria-selected={mode === 'expressive'} onclick={() => setMode('expressive')}>Spell</button>
  </div>
</div>

{#if mode === 'receptive'}
  <section class="card stack">
    {#if !canRead}
      <h2>Read fingerspelling</h2>
      <p>
        Reading drills need an image or video for each letter. {available.size} of 26 letters have one so far, so no
        practice words can be shown yet.
      </p>
      <p class="small muted">Add letter media to the content folder (see its README) and this drill unlocks automatically.</p>
    {:else}
      <div class="spread">
        <h2>Read fingerspelling</h2>
        <div class="row small">
          <button class="small" onclick={() => adjust(0.9)} aria-label="Slower">−</button>
          <span class="mono">{speed.toFixed(1)} letters/s · {lettersPerSecondToWpm(speed)} wpm</span>
          <button class="small" onclick={() => adjust(1.1)} aria-label="Faster">+</button>
        </div>
      </div>

      <div class="stage" aria-live="off">
        {#if phase === 'playing' && frame}
          {@const m = media(frame.letter)}
          {@const id = letters.get(frame.letter)?.id}
          <div class="letter" class:shift={frame.repeat}>
            {#if m?.type === 'video'}
              <video src={m.url} autoplay muted playsinline></video>
            {:else if m}
              <img src={m.url} alt="" />
            {:else if id}
              <HandSign {id} size={200} label="" animate={false} mirror={settings?.dominantHand === 'Left'} />
            {/if}
          </div>
        {:else if phase === 'idle'}
          <p class="muted center">Watch a word, then type it. Speed adjusts as you go.</p>
        {:else if phase === 'feedback'}
          <div class="center">
            <div class="big-gloss">{word}</div>
          </div>
        {/if}
      </div>

      {#if phase === 'idle'}
        <button class="primary" onclick={next}>Start <kbd>Enter</kbd></button>
      {:else if phase === 'answer'}
        <form class="center stack" onsubmit={submit}>
          <input bind:this={input} bind:value={typed} class="answer-input" type="text" autocomplete="off"
            autocapitalize="characters" spellcheck="false" aria-label="What word was spelled?" />
          <div class="row" style="justify-content:center">
            <button type="button" onclick={replay}>Replay</button>
            <button class="primary" type="submit" disabled={!normaliseWord(typed)}>Check</button>
          </div>
        </form>
      {:else if phase === 'feedback'}
        <div class="result" class:good={lastCorrect} class:bad={!lastCorrect}>
          {#if lastCorrect}
            Correct{replays ? ` after ${replays} ${replays === 1 ? 'replay' : 'replays'}` : ''}.
          {:else}
            You typed “{normaliseWord(typed)}”.
          {/if}
          {#if speed > speedBefore} Speeding up.{:else if speed < speedBefore} Slowing down a little.{/if}
        </div>
        <div class="row">
          <button onclick={() => play('feedback')}>Watch again</button>
          <button class="primary" onclick={next}>Next word <kbd>Enter</kbd></button>
        </div>
      {/if}
    {/if}
  </section>
{:else}
  <section class="card stack">
    <h2>Spell words</h2>
    {#if phase === 'idle'}
      <p>A word appears. Fingerspell it as smoothly as you can, then press Done. Aim for a steady rhythm, not speed.</p>
      <button class="primary" onclick={next}>Start <kbd>Enter</kbd></button>
    {:else if phase === 'signing'}
      <div class="center stack">
        <div class="big-gloss">{word}</div>
        {#if hints}
          <div class="hint-strip" aria-label="Handshapes for {word}">
            {#each word.toUpperCase().split('') as l}
              {@const id = letters.get(l)?.id}
              <div class="hint-letter">
                {#if id}<SignPicture {id} size={52} mirror={settings?.dominantHand === 'Left'} />{/if}
                <span>{l}</span>
              </div>
            {/each}
          </div>
        {/if}
        <div class="row center">
          <button class="ghost" onclick={() => (hints = !hints)} aria-pressed={hints}>{hints ? 'Hide' : 'Show'} handshapes</button>
          <button class="primary lg" onclick={finishSigning}>Done <kbd>Enter</kbd></button>
        </div>
      </div>
    {:else}
      <div class="center stack">
        <div class="big-gloss">{word}</div>
        <p class="muted">{elapsed.toFixed(1)} s · {(word.length / Math.max(elapsed, 0.1)).toFixed(1)} letters/s</p>
        <p>Was every letter clear, with no restarts?</p>
        <div class="row" style="justify-content:center">
          <button onclick={() => gradeSigning(false)}>Stumbled</button>
          <button class="primary" onclick={() => gradeSigning(true)}>Clean</button>
        </div>
      </div>
    {/if}
    <CameraMirror autostart={settings?.showCameraByDefault ?? false} />
  </section>
{/if}

<section class="card stack">
  <h2>Your fingerspelling</h2>
  <div class="stat-grid">
    <div class="stat">
      <div class="value">{reading ? lettersPerSecondToWpm(reading) : '–'}</div>
      <div class="label">reading speed, wpm</div>
    </div>
    <div class="stat">
      <div class="value">{signingSpeed ? signingSpeed.toFixed(1) : '–'}</div>
      <div class="label">clean spelling, letters/s</div>
    </div>
    <div class="stat">
      <div class="value">{attempts.length}</div>
      <div class="label">words practised</div>
    </div>
  </div>
  {#if weakLetters.length}
    <p class="small">
      Letters you misread most:
      {#each weakLetters as [l, s], i}<a href="#/learn/{l.toLowerCase()}">{l}</a> ({Math.round(s.rate * 100)}%){i < weakLetters.length - 1 ? ', ' : ''}{/each}.
      Words with these letters come up more often.
    </p>
  {/if}
</section>

<style>
  .head { margin: 4px 0 16px; }
  .head h1 { margin: 0; }
  .hint-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .hint-letter {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--paper);
    color: #18181b;
    border-radius: 12px;
    padding: 6px 6px 4px;
    font-weight: 600;
  }
  .mono { font-variant-numeric: tabular-nums; }
  .stage {
    min-height: 260px;
    display: grid;
    place-items: center;
    background: var(--paper);
    border-radius: 10px;
    overflow: hidden;
  }
  .letter { width: 100%; height: 260px; display: grid; place-items: center; }
  .letter img, .letter video { max-width: 100%; max-height: 260px; object-fit: contain; }
  .letter.shift { transform: translateX(14%); }
</style>
