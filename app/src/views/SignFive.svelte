<script lang="ts">
  // Sign Five: guess the five-letter word in six tries by fingerspelling it.
  // Safeguards against stray letters: the camera only types held shapes, every
  // letter can be deleted, nothing submits by itself, and a guess that isn't a
  // known word asks for a second Enter (a stray letter usually makes a non-word).
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { DEFAULT_SIGN_FIVE, type SignFiveSave } from '../lib/types';
  import { loadSettings, mirrored, prefs, updateSettings } from '../lib/settings.svelte';
  import {
    ANSWERS, dailyAnswer, dayKey, isKnownWord, letterMarks, loadSignFive, MAX_GUESSES, randomAnswer, scoreGuess, todaysAnswer,
    WORD_LENGTH, type DailySource, type Mark,
  } from '../lib/guess';
  import LetterCam from '../components/LetterCam.svelte';
  import ListPicker from '../components/ListPicker.svelte';
  import { fiveLetterWords } from '../lib/lists';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';

  type Game = 'daily' | 'practice';
  const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  let store: Store;
  const settings = $derived(prefs.value);
  let game = $state<Game>('daily');
  let answer = $state('');
  let source = $state<DailySource>();
  /** Today's word, once known, so switching back from practice doesn't refetch. */
  let today = $state<{ word: string; source: DailySource }>();
  let guesses = $state<string[]>([]);
  let current = $state('');
  let confirmUnknown = $state(false);
  let toast = $state('');
  let shake = $state(false);
  let showShapes = $state(true);
  let saved = $state<SignFiveSave>(structuredClone(DEFAULT_SIGN_FIVE));
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const lists = $derived(settings?.lists ?? []);
  const chosen = $derived(lists.find((l) => l.id === settings?.fiveListId && fiveLetterWords(l.words).length));
  const fiveWords = $derived(chosen ? fiveLetterWords(chosen.words) : []);
  const useMine = $derived(fiveWords.length > 0);
  const won = $derived(!!answer && guesses.includes(answer));
  const over = $derived(won || guesses.length >= MAX_GUESSES);
  const marks = $derived(letterMarks(guesses, answer));
  const rows = $derived(
    Array.from({ length: MAX_GUESSES }, (_, r) => {
      if (r < guesses.length) {
        const g = guesses[r];
        const m = scoreGuess(g, answer);
        return { kind: 'done' as const, cells: [...g].map((c, i) => ({ c, m: m[i] as Mark | undefined })) };
      }
      const active = r === guesses.length && !over;
      const text = active ? current : '';
      return {
        kind: active ? ('active' as const) : ('empty' as const),
        cells: Array.from({ length: WORD_LENGTH }, (_, i) => ({ c: text[i] ?? '', m: undefined as Mark | undefined })),
      };
    }),
  );
  const mirror = $derived(mirrored(settings));
  const winPct = $derived(saved.stats.played ? Math.round((saved.stats.won / saved.stats.played) * 100) : 0);

  onMount(async () => {
    store = await getStore();
    await loadSettings();
    saved = await loadSignFive(store);
    await loadDaily();
  });

  /**
   * Today's word: whatever today's saved game used (so a game in progress keeps
   * its answer), else the official word, else this app's own daily pick.
   */
  async function loadDaily() {
    const key = dayKey();
    const d = saved.daily?.key === key ? saved.daily : undefined;
    if (d?.answer) today = { word: d.answer, source: d.source ?? 'local' };
    else if (d?.guesses.length) today = { word: dailyAnswer(key), source: 'local' };
    else today ??= await todaysAnswer(key);
    if (game !== 'daily') return;
    answer = today.word;
    source = today.source;
    guesses = d?.guesses ?? [];
  }

  /** Words allowed as guesses: the dictionary, your list, and the answer itself. */
  const allowed = (w: string) => isKnownWord(w) || w === answer || fiveWords.includes(w);

  function persist() {
    store?.saveSignFive($state.snapshot(saved));
  }

  function say(text: string, ms = 2400) {
    toast = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ''), ms);
  }

  function nudge() {
    shake = false;
    requestAnimationFrame(() => (shake = true));
  }

  function type(letter: string) {
    if (!answer || over || current.length >= WORD_LENGTH) return;
    current += letter.toUpperCase();
    confirmUnknown = false;
  }

  function erase() {
    if (over || !current) return;
    current = current.slice(0, -1);
    confirmUnknown = false;
  }

  function enter() {
    if (!answer || over) return;
    if (current.length < WORD_LENGTH) {
      say(`${WORD_LENGTH - current.length} more ${WORD_LENGTH - current.length === 1 ? 'letter' : 'letters'} to go`);
      nudge();
      return;
    }
    if (!allowed(current) && !confirmUnknown) {
      confirmUnknown = true;
      nudge();
      return;
    }
    guesses = [...guesses, current];
    current = '';
    confirmUnknown = false;
    if (game === 'daily') saved.daily = { key: dayKey(), guesses: [...guesses], answer, source };
    if (over) finish();
    persist();
  }

  function finish() {
    const s = saved.stats;
    s.played++;
    if (won) {
      s.won++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
      s.dist[guesses.length - 1]++;
      say(['Genius!', 'Brilliant!', 'Great!', 'Nice!', 'Good!', 'Phew!'][guesses.length - 1], 2000);
    } else {
      s.streak = 0;
    }
  }

  function newGame(g: Game) {
    game = g;
    current = '';
    confirmUnknown = false;
    if (g === 'daily') {
      answer = '';
      loadDaily();
    } else {
      answer = randomAnswer(answer, Math.random, useMine ? fiveWords : ANSWERS);
      source = undefined;
      guesses = [];
    }
  }

  async function useList(id: string) {
    await updateSettings({ fiveListId: id });
    // Start a fresh practice word from the chosen list.
    if (game === 'practice' && !guesses.length) {
      answer = randomAnswer(answer, Math.random, fiveWords.length ? fiveWords : ANSWERS);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      enter();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      erase();
    } else if (/^[a-z]$/i.test(e.key)) {
      type(e.key);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="five">
  <header class="top">
    <a class="back small" href="#/fingerspell"><Icon name="arrow-left" size={16} />Fingerspelling</a>
    <div class="title-row">
      <div>
        <h1>Sign Five</h1>
        <p class="small muted">Guess the five-letter word in six tries. Fingerspell each guess to the camera, or type it.</p>
      </div>
      <div class="segmented" role="group" aria-label="Which game">
        <button aria-pressed={game === 'daily'} onclick={() => newGame('daily')}>Daily word</button>
        <button aria-pressed={game === 'practice'} onclick={() => newGame('practice')}>Practice</button>
      </div>
    </div>
    <p class="source small">
      {#if game === 'daily'}
        {#if !answer}
          <span class="dot loading"></span>Getting today's word…
        {:else if source === 'official'}
          <span class="dot ok"></span>Today's official Wordle word, from The New York Times
        {:else}
          <span class="dot"></span>Couldn't reach the official word, so this is the app's own word of the day
        {/if}
      {:else}
        <span class="dot"></span>A random word from {chosen ? `“${chosen.name}”` : 'the built-in words'}. Play as many as you like.
      {/if}
    </p>
  </header>

  {#if game === 'practice'}
    <div class="picker">
      <ListPicker
        {lists}
        selectedId={chosen?.id ?? ''}
        builtInCount={ANSWERS.length}
        usable={fiveLetterWords}
        unit="five-letter words"
        onSelect={useList}
      />
    </div>
  {/if}

  <div class="layout">
    <section class="board-wrap" aria-label="Guesses">
      <div class="board" class:shake onanimationend={() => (shake = false)}>
        {#each rows as row, r}
          <div class="row {row.kind}" aria-label={row.kind === 'done' ? `Guess ${r + 1}: ${guesses[r]}` : undefined}>
            {#each row.cells as cell, i}
              <div
                class="tile {cell.m ?? ''}"
                class:filled={!!cell.c}
                class:cursor={row.kind === 'active' && i === current.length}
                style="--d: {i * 90}ms"
              >
                {#if cell.c}
                  {#if showShapes}
                    <span class="shape"><SignPicture id={cell.c.toLowerCase()} size="100%" {mirror} /></span>
                  {/if}
                  <span class="ch">{cell.c}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>

      <div class="status" aria-live="polite">
        {#if confirmUnknown}
          <div class="notice warn">
            <b>{current}</b> isn't in the word list. A letter may have slipped in.
            <span class="notice-actions">
              <button class="small" onclick={erase}>Fix it</button>
              <button class="small primary" onclick={enter}>Use it anyway</button>
            </span>
          </div>
        {:else if toast}
          <div class="notice">{toast}</div>
        {/if}
      </div>
    </section>

    <aside class="side">
      {#if over}
        <section class="card result-card">
          <p class="eyebrow">{won ? `Solved in ${guesses.length}` : 'Out of guesses'}</p>
          <div class="answer-word" aria-label="The word was {answer}">
            {#each answer as c}
              <span class="ans-letter">
                <span class="ans-pic"><SignPicture id={c.toLowerCase()} size="100%" {mirror} label={c} /></span>
                <b>{c}</b>
              </span>
            {/each}
          </div>
          <div class="stats">
            <div><b>{saved.stats.played}</b><span>Played</span></div>
            <div><b>{winPct}%</b><span>Won</span></div>
            <div><b>{saved.stats.streak}</b><span>Streak</span></div>
            <div><b>{saved.stats.best}</b><span>Best</span></div>
          </div>
          <div class="dist" aria-label="Guess distribution">
            {#each saved.stats.dist as n, i}
              {@const max = Math.max(1, ...saved.stats.dist)}
              <div class="bar-row">
                <span>{i + 1}</span>
                <span class="bar" class:this={won && guesses.length === i + 1} style="width: {Math.max(8, (n / max) * 100)}%">{n}</span>
              </div>
            {/each}
          </div>
          <div class="result-actions">
            <button class="primary" onclick={() => newGame('practice')}><Icon name="play" size={14} />New practice word</button>
            <a class="btn" href="#/fingerspell/spell">Spelling drills</a>
          </div>
        </section>
      {:else}
        <section class="card cam-card">
          <LetterCam
            enabled={current.length < WORD_LENGTH && !confirmUnknown}
            autostart={settings?.showCameraByDefault ?? false}
            dominantHand={settings?.dominantHand}
            onLetter={type}
          />
          <div class="cam-actions">
            <button onclick={erase} disabled={!current}><Icon name="arrow-left" size={16} />Delete letter</button>
            <button class="primary" onclick={enter} disabled={current.length < WORD_LENGTH}>Enter guess</button>
          </div>
          <p class="small muted tip">
            To repeat a letter (like the PP in APPLE), drop or change your hand between them. J and Z move, so tap those
            on the keyboard. Typed a wrong letter? Delete it before you enter.
          </p>
        </section>
      {/if}
    </aside>
  </div>

  <section class="keyboard" aria-label="Keyboard">
    {#each ROWS as krow, k}
      <div class="krow">
        {#if k === 2}<button class="key wide" onclick={enter} aria-label="Enter guess">Enter</button>{/if}
        {#each krow as c}
          <button class="key {marks.get(c) ?? ''}" onclick={() => type(c)} aria-label={c}>
            {#if showShapes}<span class="kshape"><SignPicture id={c.toLowerCase()} size="100%" {mirror} /></span>{/if}
            <span>{c}</span>
          </button>
        {/each}
        {#if k === 2}<button class="key wide" onclick={erase} aria-label="Delete letter"><Icon name="arrow-left" size={18} /></button>{/if}
      </div>
    {/each}
    <label class="shapes-toggle small muted">
      <input type="checkbox" bind:checked={showShapes} /> Show handshapes on tiles and keys
    </label>
  </section>
</div>

<style>
  .five { --m: var(--spell); --m-soft: var(--spell-soft); }
  .top { margin-bottom: 16px; }
  .back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-3); text-decoration: none; font-weight: 600; }
  .back:hover { color: var(--ink); }
  .title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
  .title-row h1 { margin: 0; }
  .title-row p { margin: 2px 0 0; }
  .source { display: flex; align-items: center; gap: 8px; margin: 10px 0 0; color: var(--ink-2); }
  .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); }
  .dot.ok { background: var(--hit); }
  .dot.loading { background: var(--m); animation: blink 1s infinite; }
  @keyframes blink { 50% { opacity: 0.3; } }
  .picker { margin: -4px 0 16px; }
  .five :global(button.primary), .five :global(.btn.primary) { background: var(--m); border-color: var(--m); }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }

  .board { display: grid; gap: 6px; width: min(100%, 360px); margin: 0 auto; }
  .board.shake .row.active { animation: shake 0.4s; }
  @keyframes shake {
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .tile {
    position: relative;
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    border: 2px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    overflow: hidden;
    font-size: clamp(1.3rem, 6vw, 1.9rem);
    font-weight: 750;
    color: var(--ink);
  }
  .tile.filled { border-color: var(--ink-3); animation: pop 0.12s; }
  .tile.cursor { border-color: var(--m); box-shadow: 0 0 0 2px var(--m-soft); }
  @keyframes pop { 50% { transform: scale(1.08); } }
  .tile:has(.shape) { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 0 3px; }
  .tile:has(.shape) { gap: 1px; }
  .shape { flex: none; width: 62%; height: 62%; overflow: hidden; display: grid; place-items: center; mix-blend-mode: multiply; }
  .shape :global(img), .shape :global(svg) { width: 100% !important; height: 100% !important; object-fit: contain; }
  .tile:has(.shape) .ch { font-size: 0.55em; line-height: 1; }
  .row.done .tile { color: #fff; border-color: transparent; animation: flip 0.45s both; animation-delay: var(--d); }
  /* On coloured tiles: draw the hand in white, and let its black background vanish. */
  .row.done .tile .shape { filter: invert(1); mix-blend-mode: screen; }
  .tile.hit { background: var(--hit); }
  .tile.near { background: var(--near); }
  .tile.miss { background: var(--miss); }
  @keyframes flip { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }

  .status { min-height: 52px; margin-top: 12px; display: grid; justify-items: center; }
  .notice {
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: #fff;
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
  }
  .notice.warn { background: var(--warn-soft); color: var(--warn-ink); border: 1px solid color-mix(in srgb, var(--warn-ink) 25%, transparent); font-weight: 400; }
  .notice-actions { display: inline-flex; gap: 6px; margin-left: 8px; }

  .cam-card { display: grid; gap: 12px; }
  .cam-actions { display: flex; gap: 8px; }
  .cam-actions button { flex: 1; }
  .tip { margin: 0; }

  .result-card { display: grid; gap: 14px; text-align: center; }
  .result-card .eyebrow { margin: 0; }
  .answer-word { display: flex; justify-content: center; gap: 6px; }
  .ans-pic { width: 100%; aspect-ratio: 1; display: grid; place-items: center; overflow: hidden; }
  .ans-pic :global(img), .ans-pic :global(svg) { width: 100% !important; height: 100% !important; object-fit: contain; }
  .ans-letter {
    flex: 1; max-width: 68px; min-width: 0;
    display: grid; justify-items: center; gap: 2px; padding: 6px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--paper);
  }
  .ans-letter b { font-size: 1.1rem; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .stats div { display: grid; }
  .stats b { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
  .stats span { font-size: 0.75rem; color: var(--ink-3); }
  .dist { display: grid; gap: 4px; text-align: left; }
  .bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; }
  .bar-row > span:first-child { width: 10px; color: var(--ink-3); }
  .bar { background: var(--surface-3); color: var(--ink-2); padding: 1px 6px; border-radius: 3px; text-align: right; }
  .bar.this { background: var(--hit); color: #fff; }
  .result-actions { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }

  .keyboard { margin-top: 18px; display: grid; gap: 6px; justify-items: center; }
  .krow { display: flex; gap: 5px; width: min(100%, 620px); justify-content: center; }
  .key {
    flex: 1;
    max-width: 54px;
    min-width: 0;
    height: 58px;
    padding: 2px;
    flex-direction: column;
    gap: 0;
    border-radius: 6px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    font-weight: 700;
    font-size: 0.95rem;
  }
  .key.wide { flex: 1.5; max-width: 80px; font-size: 0.8rem; }
  .kshape { width: 26px; height: 26px; display: grid; place-items: center; mix-blend-mode: multiply; }
  .kshape :global(img), .kshape :global(svg) { width: 100%; height: 100%; object-fit: contain; }
  .key.hit, .key.near, .key.miss { color: #fff; border-color: transparent; }
  .key.hit .kshape, .key.near .kshape, .key.miss .kshape { filter: invert(1); mix-blend-mode: screen; }
  .key.hit { background: var(--hit); }
  .key.near { background: var(--near); }
  .key.miss { background: var(--miss); }
  .shapes-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; }

  @media (max-width: 820px) {
    .layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .krow { gap: 3px; }
    .key { height: 50px; font-size: 0.85rem; }
    .kshape { width: 20px; height: 20px; }
  }
</style>
