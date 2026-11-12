<script lang="ts">
  import { routes } from '../lib/routes';
  // Sign Five: guess the five-letter word in six tries by fingerspelling it.
  // Safeguards against stray letters: the camera only types held shapes, every
  // letter can be deleted, and nothing submits by itself. Any five letters are
  // accepted as a guess: the app doesn't have Wordle's own word list, so it
  // can't say which words that game would turn down. Instead it helps the
  // learner check the word before entering it: a dot marks each letter the
  // camera typed, a thumbs up shows the word while it's held, and a word that
  // isn't in the app's own list gets a quiet note (Enter still works).
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { DEFAULT_SIGN_FIVE, type SignFiveSave } from '../lib/types';
  import { loadSettings, mirrored, prefs, updateSettings } from '../lib/settings.svelte';
  import {
    ANSWERS, dailyAnswer, dayKey, isKnownWord, letterMarks, loadSignFive, MAX_GUESSES, randomAnswer, scoreGuess, shareText, shareTitle, todaysAnswer,
    WORD_LENGTH, type DailySource, type Mark,
  } from '../lib/guess';
  import LetterCam from '../components/LetterCam.svelte';
  import ShareDialog from '../components/ShareDialog.svelte';
  import ListPicker from '../components/ListPicker.svelte';
  import { fiveLetterWords, selectedList } from '../lib/lists';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';
  import LetterTip from '../components/LetterTip.svelte';

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
  let toast = $state('');
  let shake = $state(false);
  let showShapes = $state(true);
  let saved = $state<SignFiveSave>(structuredClone(DEFAULT_SIGN_FIVE));
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** Which letters of the current row came from the camera: dotted on the board, and counted for sharing. */
  let currentSigned = $state<boolean[]>([]);
  /** Letters fingerspelled to the camera in this game's entered guesses. */
  let signed = $state(0);
  /** The share pop-up. It opens by itself when a game ends, and from "Share results". */
  let shareOpen = $state(false);
  let shareTimer: ReturnType<typeof setTimeout> | undefined;

  // "How to sign this letter": hover a key or tile with a mouse, focus a key
  // from the keyboard, or press and hold a key on a touch screen.
  let peek = $state<{ letter: string; rect: DOMRect }>();
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  /** Set when a press-and-hold opened the tip, so letting go doesn't also type the letter. */
  let heldOpen = false;
  const HOVER_MS = 300;
  const HOLD_MS = 450;

  // Phones get a one-screen layout: the board sized to fit, with the keyboard
  // and a slim camera strip pinned above the tab bar.
  let phone = $state(false);
  let boardEl = $state<HTMLElement>();
  let dock = $state<HTMLElement>();
  let boardWidth = $state<number>();

  const lists = $derived(settings?.lists ?? []);
  const chosen = $derived(selectedList(lists, settings?.fiveListId, fiveLetterWords));
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
        return { kind: 'done' as const, cells: [...g].map((c, i) => ({ c, m: m[i] as Mark | undefined, cam: false })) };
      }
      const active = r === guesses.length && !over;
      const text = active ? current : '';
      return {
        kind: active ? ('active' as const) : ('empty' as const),
        cells: Array.from({ length: WORD_LENGTH }, (_, i) => ({
          c: text[i] ?? '',
          m: undefined as Mark | undefined,
          cam: active && !!currentSigned[i],
        })),
      };
    }),
  );
  const mirror = $derived(mirrored(settings));
  const winPct = $derived(saved.stats.played ? Math.round((saved.stats.won / saved.stats.played) * 100) : 0);

  onMount(() => {
    const mq = matchMedia('(max-width: 640px)');
    const update = () => (phone = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });

  /** On a phone, size the board so it and the pinned keyboard fit on one screen. */
  $effect(() => {
    if (!phone || !boardEl || !dock) {
      boardWidth = undefined;
      return;
    }
    const board = boardEl;
    const pinned = dock;
    // A phone browser's address bar slides away as you scroll, which changes the
    // window height. Following it would resize the board mid-game, so the board
    // only ever shrinks to fit, and starts afresh when the width changes (turning the phone).
    let width = window.innerWidth;
    let height = window.innerHeight;
    const fit = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        height = window.innerHeight;
      } else {
        height = Math.min(height, window.innerHeight);
      }
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 60;
      const top = board.getBoundingClientRect().top + window.scrollY;
      const room = height - top - pinned.offsetHeight - nav - 12;
      const gap = 5;
      const tile = (room - gap * 5) / 6;
      boardWidth = Math.round(Math.max(170, Math.min(340, tile * 5 + gap * 4)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(pinned);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  });

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
    signed = d?.signed ?? 0;
  }

  /** Words the app knows: its dictionary, your list, and the answer itself. Only used for a note; any word can be entered. */
  const listed = (w: string) => isKnownWord(w) || w === answer || fiveWords.includes(w);
  const full = $derived(current.length === WORD_LENGTH);
  const unlisted = $derived(full && !over && !listed(current));

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

  /** `replaces`: a drawn J or Z takes the place of the still letter the camera typed from the same handshape. */
  function type(letter: string, fromCamera = false, replaces?: string) {
    if (!answer || over) return;
    if (replaces && current.endsWith(replaces) && currentSigned[currentSigned.length - 1]) {
      current = current.slice(0, -1) + letter.toUpperCase();
      return;
    }
    if (current.length >= WORD_LENGTH) return;
    current += letter.toUpperCase();
    currentSigned = [...currentSigned, fromCamera];
  }

  function erase() {
    if (over || !current) return;
    current = current.slice(0, -1);
    currentSigned = currentSigned.slice(0, -1);
  }

  function enter() {
    if (!answer || over) return;
    if (current.length < WORD_LENGTH) {
      say(`${WORD_LENGTH - current.length} more ${WORD_LENGTH - current.length === 1 ? 'letter' : 'letters'} to go`);
      nudge();
      return;
    }
    guesses = [...guesses, current];
    current = '';
    signed += currentSigned.filter(Boolean).length;
    currentSigned = [];
    if (game === 'daily') saved.daily = { key: dayKey(), guesses: [...guesses], answer, source, signed };
    if (over) finish();
    persist();
  }

  const shareData = $derived({
    card: {
      title: shareTitle(game === 'daily'),
      guesses,
      answer,
      signed,
      stats: game === 'daily' ? saved.stats : undefined,
      mirror,
    },
    text: shareText({
      title: shareTitle(game === 'daily'),
      guesses,
      answer,
      signed,
      url: typeof location === 'undefined' ? undefined : `${location.origin}${location.pathname}${routes.signFive}`,
    }),
    fileName: game === 'daily' ? `sign-five-${dayKey()}.png` : 'sign-five-practice.png',
  });

  function finish() {
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => (shareOpen = true), 1500);
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
    currentSigned = [];
    clearTimeout(shareTimer);
    shareOpen = false;
    if (g === 'daily') {
      answer = '';
      loadDaily();
    } else {
      answer = randomAnswer(answer, Math.random, useMine ? fiveWords : ANSWERS);
      signed = 0;
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

  function showTip(letter: string, el: Element) {
    clearTimeout(peekTimer);
    peek = { letter, rect: el.getBoundingClientRect() };
  }

  function hideTip() {
    clearTimeout(peekTimer);
    peek = undefined;
  }

  /** Mouse hover: a short wait, unless a tip is already open (then moving along the keys is instant). */
  function hoverTip(e: PointerEvent, letter: string) {
    if (e.pointerType !== 'mouse' || !letter) return;
    const el = e.currentTarget as Element;
    clearTimeout(peekTimer);
    if (peek) showTip(letter, el);
    else peekTimer = setTimeout(() => showTip(letter, el), HOVER_MS);
  }

  function holdTip(e: PointerEvent, letter: string) {
    if (e.pointerType === 'mouse') return;
    heldOpen = false;
    const el = e.currentTarget as Element;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      heldOpen = true;
      showTip(letter, el);
    }, HOLD_MS);
  }

  function releaseTip(e: PointerEvent) {
    if (e.pointerType !== 'mouse') hideTip();
  }

  function focusTip(e: FocusEvent, letter: string) {
    const el = e.currentTarget as Element;
    if (el.matches(':focus-visible')) showTip(letter, el);
  }

  function pressKey(letter: string) {
    if (heldOpen) {
      heldOpen = false;
      return;
    }
    type(letter);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') hideTip();
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

<svelte:window onkeydown={onKey} onscroll={hideTip} />

<div class="five" class:phone>
  <header class="top">
    <a class="back-link small" href={routes.fingerspelling}><Icon name="arrow-left" size={16} />Fingerspelling</a>
    <div class="title-row">
      <div>
        <h1>Sign Five</h1>
        <p class="small muted desc">Guess the five-letter word in six tries. Fingerspell each guess to the camera, or type it.</p>
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
          <span class="dot ok"></span><span class="src-text">Today's official Wordle word<span class="long">, from The New York Times</span></span>
        {:else}
          <span class="dot"></span><span class="src-text">The app's own word of the day<span class="long"> (couldn't reach the official one)</span></span>
        {/if}
      {:else}
        <span class="dot"></span><span class="src-text">A random word from {chosen ? `“${chosen.name}”` : 'the built-in words'}<span class="long">. Play as many as you like.</span></span>
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
      <div class="board" class:shake bind:this={boardEl} style:width={boardWidth ? `${boardWidth}px` : undefined} onanimationend={() => (shake = false)}>
        {#each rows as row, r}
          <div class="row {row.kind}" aria-label={row.kind === 'done' ? `Guess ${r + 1}: ${guesses[r]}` : undefined}>
            {#each row.cells as cell, i}
              <div
                class="tile {cell.m ?? ''}"
                class:filled={!!cell.c}
                class:cursor={row.kind === 'active' && i === current.length}
                class:cam={cell.cam}
                style="--d: {i * 90}ms"
                role="presentation"
                onpointerenter={(e) => hoverTip(e, cell.c)}
                onpointerleave={hideTip}
              >
                {#if cell.c}
                  {#if showShapes}
                    <span class="shape"><SignPicture id={cell.c.toLowerCase()} size="100%" {mirror} /></span>
                  {/if}
                  <span class="ch">{cell.c}</span>
                  {#if cell.cam}<span class="cam-dot" aria-hidden="true"></span>{/if}
                {/if}
              </div>
            {/each}
          </div>
        {/each}
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
            <button class="primary" onclick={() => (shareOpen = true)}><Icon name="arrow-right" size={14} />Share results</button>
            <button onclick={() => newGame('practice')}><Icon name="play" size={14} />New practice word</button>
            <a class="btn ghost" href={routes.spell}>Spelling drills</a>
          </div>
          {#if signed}<p class="small muted signed-note">🤟 You fingerspelled {signed} of {guesses.length * WORD_LENGTH} letters to the camera.</p>{/if}

        </section>
      {:else if !phone}
        <section class="card cam-card">
          <LetterCam
            letters={!full}
            confirmWord={full ? current : ''}
            autostart={settings?.showCameraByDefault ?? false}
            dominantHand={settings?.dominantHand}
            onLetter={(l, o) => type(l, true, o?.replaces)}
            onCommand={(c) => (c === 'enter' ? enter() : erase())}
          />
          <div class="cam-actions">
            <button onclick={erase} disabled={!current}><span class="gesture" aria-hidden="true">👎</span>Delete letter</button>
            <button class="primary" onclick={enter} disabled={current.length < WORD_LENGTH}><span class="gesture" aria-hidden="true">👍</span>Enter guess</button>
          </div>
          <p class="small muted tip">
            Hold a <b>thumbs up</b> to enter your guess and a <b>thumbs down</b> to delete a letter. To repeat a letter
            (like the PP in APPLE), drop or change your hand between them. For J and Z, hold the handshape, then draw
            the letter in the air.
          </p>
        </section>
      {/if}
    </aside>
  </div>

  <div class="dock" class:pinned={phone && !over} bind:this={dock}>
    <div class="status" aria-live="polite">
      {#if toast}
        <div class="notice">{toast}</div>
      {:else if unlisted}
        {#key current}
          <p class="note small"><b>{current}</b> isn't in our word list. You can still enter it.</p>
        {/key}
      {/if}
    </div>

    {#if phone && !over}
      <div class="cam-strip">
        <LetterCam
          compact
          letters={!full}
          confirmWord={full ? current : ''}
          autostart={settings?.showCameraByDefault ?? false}
          dominantHand={settings?.dominantHand}
          onLetter={(l, o) => type(l, true, o?.replaces)}
          onCommand={(c) => (c === 'enter' ? enter() : erase())}
        />
      </div>
    {/if}

  <section class="keyboard" aria-label="Keyboard">
    {#each ROWS as krow, k}
      <div class="krow">
        {#if k === 2}<button class="key wide" onclick={enter} aria-label="Enter guess, or hold a thumbs up to the camera">Enter</button>{/if}
        {#each krow as c}
          <button
            class="key {marks.get(c) ?? ''}"
            onclick={() => pressKey(c)}
            onpointerenter={(e) => hoverTip(e, c)}
            onpointerleave={hideTip}
            onpointerdown={(e) => holdTip(e, c)}
            onpointerup={releaseTip}
            onpointercancel={releaseTip}
            oncontextmenu={(e) => e.preventDefault()}
            onfocus={(e) => focusTip(e, c)}
            onblur={hideTip}
            aria-label={c}
            aria-describedby={peek?.letter === c ? 'letter-tip' : undefined}
          >
            {#if showShapes}<span class="kshape"><SignPicture id={c.toLowerCase()} size="100%" {mirror} /></span>{/if}
            <span>{c}</span>
          </button>
        {/each}
        {#if k === 2}<button class="key wide" onclick={erase} aria-label="Delete letter, or hold a thumbs down to the camera"><Icon name="arrow-left" size={18} /></button>{/if}
      </div>
    {/each}
  </section>
  </div>

  <details class="howto">
    <summary>How to play</summary>
    <ul class="small">
      <li>Fingerspell each letter to the camera and hold it for about a second, or tap the keys.</li>
      <li>Green: right letter, right place. Gold: in the word, wrong place. Gray: not in the word.</li>
      <li>To repeat a letter (like the PP in APPLE), drop or change your hand between them.</li>
      <li>For J and Z, hold the handshape, then draw the letter in the air (or tap the key).</li>
      <li>👍 Hold a thumbs up to enter your guess. 👎 Hold a thumbs down to delete the last letter. Or tap Enter and the back arrow.</li>
      <li>Typed a wrong letter? Delete it before you enter. A purple dot marks each letter the camera typed, and a thumbs up shows your word while you hold it.</li>
      <li>Any five letters count as a guess. If a word isn't in our list you'll see a note, and you can still enter it.</li>
      <li>Not sure how to make a letter? Hover over its key to see how, or press and hold the key on a phone.</li>
    </ul>
    <label class="shapes-toggle small">
      <input type="checkbox" bind:checked={showShapes} /> Show handshapes on tiles and keys
    </label>
  </details>

  {#if peek}
    <LetterTip letter={peek.letter} anchor={peek.rect} {mirror} />
  {/if}

  {#if over}
    <ShareDialog bind:open={shareOpen} {...shareData} />
  {/if}
</div>

<style>
  .five { --m: var(--spell); --m-soft: var(--spell-soft); }
  .top { margin-bottom: 16px; }
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
  /* A letter the camera typed: worth a second look before entering. */
  .cam-dot { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border-radius: 50%; background: var(--m); }
  @keyframes pop { 50% { transform: scale(1.08); } }
  .tile:has(.shape) { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 0 3px; }
  .tile:has(.shape) { gap: 1px; }
  .shape { flex: none; width: 62%; height: 62%; overflow: hidden; display: grid; place-items: center; mix-blend-mode: multiply; }
  .shape :global(img), .shape :global(svg) { width: 100% !important; height: 100% !important; object-fit: contain; }
  .tile:has(.shape) .ch { font-size: 0.55em; line-height: 1; }
  .row.done .tile { color: #fff; border-color: transparent; animation: flip 0.45s both; animation-delay: var(--d); }
  /* On colored tiles: draw the hand in white, and let its black background vanish. */
  .row.done .tile .shape { filter: invert(1); mix-blend-mode: screen; }
  .tile.hit { background: var(--hit); }
  .tile.near { background: var(--near); }
  .tile.miss { background: var(--miss); }
  @keyframes flip { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }

  .status { min-height: 52px; margin-top: 12px; display: grid; justify-items: center; }
  .dock { margin-top: 6px; }
  .notice {
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: #fff;
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
  }

  .note { margin: 0; align-self: center; color: var(--ink-3); text-align: center; }
  .note b { color: var(--ink-2); font-weight: 600; }
  /* On a phone messages float over the foot of the board, so the note steps aside after a moment. */
  .phone .note {
    padding: 6px 12px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--line);
    box-shadow: var(--shadow-lift); animation: note-out 0.3s 2.6s forwards;
  }
  @keyframes note-out { to { opacity: 0; visibility: hidden; } }

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
  .signed-note { margin: 0; }
  .gesture { font-size: 1.05rem; line-height: 1; }

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
  /* Press and hold shows the letter's tip, so don't let the phone select text or open a menu. */
  .key { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
  .key.wide { flex: 1.5; max-width: 80px; font-size: 0.8rem; }
  .kshape { width: 26px; height: 26px; display: grid; place-items: center; mix-blend-mode: multiply; }
  .kshape :global(img), .kshape :global(svg) { width: 100%; height: 100%; object-fit: contain; }
  .key.hit, .key.near, .key.miss { color: #fff; border-color: transparent; }
  .key.hit .kshape, .key.near .kshape, .key.miss .kshape { filter: invert(1); mix-blend-mode: screen; }
  .key.hit { background: var(--hit); }
  .key.near { background: var(--near); }
  .key.miss { background: var(--miss); }
  .shapes-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--ink-2); }
  .howto { margin-top: 18px; padding: 10px 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
  .howto summary { cursor: pointer; font-weight: 600; color: var(--ink-2); }
  .howto ul { margin: 8px 0 4px; padding-left: 18px; color: var(--ink-2); display: grid; gap: 4px; }

  @media (max-width: 820px) {
    .layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 480px) {
    .krow { gap: 4px; }
    .key { height: 50px; font-size: 1rem; }
    /* Too small to read on a phone; the tiles show each typed letter's handshape instead. */
    .kshape { display: none; }
  }

  /* Phone: one screen. Compact header, board sized in script, dock pinned above the tab bar. */
  .phone .top { margin-bottom: 8px; }
  /* The Spelling tab already leads back to Fingerspelling. */
  .phone .top .back-link { display: none; }
  .phone .title-row { margin-top: 4px; align-items: center; }
  .phone .title-row h1 { font-size: 1.35rem; }
  .phone .desc, .phone .long { display: none; }
  .phone .source { margin-top: 6px; font-size: 0.8rem; }
  .phone .src-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .phone .segmented button { padding: 6px 12px; font-size: 0.85rem; }
  .phone .picker { margin: 0 0 8px; }
  .phone .board { gap: 5px; }
  .phone .row { gap: 5px; }
  .phone .layout { gap: 12px; }
  .dock.pinned {
    position: sticky;
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
    z-index: 6;
    margin: 8px -16px 0;
    padding: 8px 16px 10px;
    background: color-mix(in srgb, var(--bg) 94%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--line);
  }
  /* Messages float just above the dock so the board doesn't jump. */
  .phone .status { position: absolute; left: 16px; right: 16px; bottom: 100%; margin: 0 0 8px; min-height: 0; pointer-events: none; }
  .phone .status .notice { pointer-events: auto; box-shadow: var(--shadow-lift); }
  .phone .dock:not(.pinned) .status { position: static; margin-top: 8px; }
  .phone .keyboard { margin-top: 0; gap: 6px; }
  .cam-strip { margin-bottom: 8px; }
  .phone .howto { margin-top: 12px; }
  /* Short phones: shorter keys and camera button so the board keeps its room. */
  @media (max-height: 700px) {
    .phone .key { height: 42px; }
    .phone .cam-strip :global(button.primary) { min-height: 36px; padding-top: 6px; padding-bottom: 6px; }
    .phone .source { margin-top: 2px; }
  }
</style>
