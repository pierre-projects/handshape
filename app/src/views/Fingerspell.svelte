<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content, letterMap } from '../lib/content';
  import {
    buildSequence, checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, normaliseWord,
    parseWords, pickWord, readingSpeed, sequenceDuration, spellableWords, type Frame,
  } from '../lib/spelling';
  import type { Settings, SpellingAttempt } from '../lib/types';
  import HandSign from '../components/HandSign.svelte';
  import HandCheck from '../components/HandCheck.svelte';
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

  // Spell mode: the camera checks one letter at a time.
  let pos = $state(0);
  let results = $state<(boolean | undefined)[]>([]);
  let round = $state(0);
  let saved = $state(false);
  const chars = $derived(normaliseWord(word).split(''));
  const got = $derived(results.filter(Boolean).length);
  /** The camera confirmed at least one letter, so its score can be trusted. */
  const scored = $derived(got > 0);

  const letters = letterMap();
  const currentId = $derived(letters.get(chars[pos] ?? '')?.id);
  // A letter can be shown if it has real media or a drawn illustration.
  const available = new Set(
    [...letters].filter(([, i]) => i.files.length > 0 || hasIllustration(i.id)).map(([l]) => l),
  );
  let hints = $state(false);
  const builtIn = content.practiceWords;
  const canRead = spellableWords(builtIn, available).length > 0;

  // Word lists: the built-in words or the learner's own.
  const customWords = $derived(settings?.customWords ?? []);
  const useCustom = $derived(settings?.wordList === 'custom' && customWords.length > 0);
  const allWords = $derived(useCustom ? customWords : builtIn);
  const receptiveWords = $derived(spellableWords(allWords, available));
  let newWords = $state('');
  let addNote = $state('');

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

  /** Starts the next word, or a specific one picked from the list. */
  function next(pick?: string) {
    clearTimers();
    const pool = mode === 'receptive' ? receptiveWords : allWords;
    word = pick ?? pickWord(pool, mode === 'receptive' ? stats : new Map(), recent) ?? pool[0];
    recent = [...recent.slice(-9), word];
    replays = 0;
    typed = '';
    if (mode === 'receptive') play();
    else startSigning();
  }

  function startSigning() {
    pos = 0;
    results = chars.map(() => undefined);
    saved = false;
    round++;
    phase = 'signing';
    startedAt = performance.now();
  }

  /** The camera matched the current letter. */
  function onLetter() {
    if (phase !== 'signing') return;
    results[pos] = true;
    advance();
  }

  function skipLetter() {
    if (phase !== 'signing') return;
    results[pos] = false;
    advance();
  }

  function advance() {
    pos++;
    round++;
    if (pos >= chars.length) finishSigning();
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
    results = chars.map((_, i) => results[i] ?? false);
    phase = 'feedback';
    // With a camera score, save it straight away; otherwise the learner grades themself.
    if (scored) record(got === chars.length);
  }

  async function record(clean: boolean) {
    if (saved) return;
    saved = true;
    const attempt: SpellingAttempt = {
      word, mode: 'expressive', correct: clean,
      lettersPerSecond: Math.round((word.length / Math.max(elapsed, 0.1)) * 100) / 100,
      replays: 0, at: new Date(),
    };
    await store.addAttempt(attempt);
    attempts = [...attempts, attempt];
  }

  async function gradeSigning(clean: boolean) {
    await record(clean);
    next();
  }

  async function saveWordSettings(patch: Partial<Settings>) {
    if (!settings) return;
    settings = { ...settings, ...patch };
    await store.saveSettings($state.snapshot(settings));
  }

  function chooseList(list: Settings['wordList']) {
    saveWordSettings({ wordList: list });
  }

  function addWords(e: Event) {
    e.preventDefault();
    const added = parseWords(newWords, customWords);
    if (!added.length) {
      addNote = newWords.trim() ? 'Nothing new to add: words must be letters only, up to 20 long.' : '';
      return;
    }
    addNote = '';
    newWords = '';
    saveWordSettings({ customWords: [...customWords, ...added], wordList: 'custom' });
  }

  function removeWord(w: string) {
    saveWordSettings({ customWords: customWords.filter((x) => x !== w) });
  }

  function clearWords() {
    if (!confirm('Remove all your words?')) return;
    saveWordSettings({ customWords: [], wordList: 'builtin' });
  }

  /** Plays one chosen word straight away in the current mode. */
  function playWord(w: string) {
    if (mode === 'receptive' && !canRead) return;
    next(w);
  }

  function adjust(factor: number) {
    const v = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed * factor)) * 100) / 100;
    saveSpeed(v);
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (phase === 'signing' && (e.key === 's' || e.key === 'S')) {
      skipLetter();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (phase === 'idle' || (phase === 'feedback' && (mode === 'receptive' || scored))) {
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

<section class="card words" aria-label="Word list">
  <div class="spread">
    <div class="row">
      <p class="eyebrow list-label">Words from</p>
      <div class="segmented">
        <button aria-pressed={!useCustom} onclick={() => chooseList('builtin')}>Built-in ({builtIn.length})</button>
        <button
          aria-pressed={useCustom}
          disabled={!customWords.length}
          title={customWords.length ? '' : 'Add some words first'}
          onclick={() => chooseList('custom')}
        >My words ({customWords.length})</button>
      </div>
    </div>
    <form class="row add" onsubmit={addWords}>
      <input
        type="text"
        bind:value={newWords}
        placeholder="Add words: cat, mom, pizza"
        aria-label="Add your own words, separated by commas or spaces"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="submit" disabled={!newWords.trim()}>Add</button>
    </form>
  </div>
  {#if addNote}<p class="small muted note">{addNote}</p>{/if}

  {#if customWords.length}
    <ul class="chips" aria-label="My words. Click one to practise it.">
      {#each customWords as w (w)}
        <li class="chip" class:active={w === word && phase !== 'idle'}>
          <button class="play" onclick={() => playWord(w)} title="Practise {w}">{w}</button>
          <button class="remove" onclick={() => removeWord(w)} aria-label="Remove {w}">×</button>
        </li>
      {/each}
      <li><button class="ghost small" onclick={clearWords}>Clear all</button></li>
    </ul>
  {:else}
    <p class="small muted note">Add your own words to practise names, places or anything you need. Click a word to play it.</p>
  {/if}
</section>

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
        <button class="primary" onclick={() => next()}>Start <kbd>Enter</kbd></button>
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
          <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
        </div>
      {/if}
    {/if}
  </section>
{:else}
  <section class="card stack">
    <h2>Spell words</h2>
    {#if phase === 'idle'}
      <p>
        A word appears. Fingerspell it letter by letter: the camera checks each one and moves on when it matches. At the
        end you'll see how many letters you got.
      </p>
      <button class="primary" onclick={() => next()}>Start <kbd>Enter</kbd></button>
    {:else}
      <div class="spell-stage">
        <div class="spell-side stack">
          <div class="word-boxes" aria-label="Letters of {word}">
            {#each chars as c, i}
              <span
                class="box"
                class:now={phase === 'signing' && i === pos}
                class:ok={results[i] === true}
                class:miss={results[i] === false}
              >{c}</span>
            {/each}
          </div>

          {#if phase === 'signing'}
            <p class="muted small center">
              Sign <b class="now-letter">{chars[pos]}</b> · letter {pos + 1} of {chars.length}
            </p>
            {#if hints}
              {#if currentId}
                <div class="hint-now">
                  <SignPicture id={currentId} size={120} mirror={settings?.dominantHand === 'Left'} label="How to sign {chars[pos]}" />
                </div>
              {/if}
            {/if}
            <div class="row center">
              <button onclick={skipLetter}>Skip letter <kbd>S</kbd></button>
              <button class="ghost" onclick={() => (hints = !hints)} aria-pressed={hints}>{hints ? 'Hide' : 'Show'} handshape</button>
              <button class="primary" onclick={finishSigning}>Done <kbd>Enter</kbd></button>
            </div>
          {:else if scored}
            <div class="result" class:good={got === chars.length} class:bad={got < chars.length}>
              {got} of {chars.length} letters right{got === chars.length ? ' · clean spelling!' : ''}
            </div>
            <p class="muted small center">
              {elapsed.toFixed(1)} s · {(chars.length / Math.max(elapsed, 0.1)).toFixed(1)} letters/s
              {#if got < chars.length}· missed {chars.filter((_, i) => !results[i]).join(', ')}{/if}
            </p>
            <div class="row center">
              <button onclick={startSigning}>Try again</button>
              <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
            </div>
          {:else}
            <p class="muted small center">
              The camera didn't confirm any letters (is it on?). {elapsed.toFixed(1)} s. Was every letter clear?
            </p>
            <div class="row center">
              <button onclick={() => gradeSigning(false)}>Stumbled</button>
              <button class="primary" onclick={() => gradeSigning(true)}>Clean</button>
            </div>
          {/if}
        </div>

        <div class="spell-camera">
          <HandCheck
            target={currentId ?? 'a'}
            {round}
            autostart={settings?.showCameraByDefault ?? false}
            dominantHand={settings?.dominantHand}
            onMatch={onLetter}
          />
        </div>
      </div>
    {/if}
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
  /* Word list */
  .words { padding: 14px 18px; }
  .list-label { margin: 0; }
  .add { flex: 1 1 260px; max-width: 420px; flex-wrap: nowrap; }
  .add input { flex: 1; min-width: 0; min-height: 38px; }
  .add button { min-height: 38px; }
  .note { margin: 8px 0 0; }
  .chips { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    overflow: hidden;
  }
  .chip button { border: 0; border-radius: 0; box-shadow: none; min-height: 32px; background: transparent; }
  .chip .play { padding: 4px 4px 4px 12px; font-weight: 650; letter-spacing: 0.04em; }
  .chip .remove { padding: 4px 10px 4px 6px; color: var(--ink-3); font-size: 1.05rem; }
  .chip .remove:hover { color: var(--bad); }
  .chip:hover { border-color: var(--accent); }
  .chip.active { background: var(--accent-soft); border-color: var(--accent); }
  .chip.active .play { color: var(--accent); }

  /* Spell mode: word on the left, camera on the right. */
  .spell-stage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; align-items: start; }
  .spell-side { align-self: center; }
  .word-boxes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .box {
    width: 52px;
    height: 60px;
    display: grid;
    place-items: center;
    font-size: 1.9rem;
    font-weight: 700;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-3);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .box.now { border: 2px solid var(--accent); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  .box.ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .box.miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
  .now-letter { color: var(--accent); font-size: 1.1rem; }
  .hint-now {
    width: 140px;
    margin: 0 auto;
    display: grid;
    place-items: center;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--paper);
  }
  .spell-side .result { justify-content: center; }
  @media (max-width: 760px) {
    .spell-stage { grid-template-columns: 1fr; }
    .box { width: 42px; height: 50px; font-size: 1.5rem; }
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
