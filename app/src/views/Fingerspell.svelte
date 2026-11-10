<script lang="ts">
  // Fingerspelling: a landing page with two separate drills.
  //   Read  (#/fingerspell/read):  watch a word spelled letter by letter, then type it.
  //   Spell (#/fingerspell/spell): see a word and sign it to the camera, letter by letter.
  import { onDestroy, onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content, letterMap } from '../lib/content';
  import {
    buildSequence, checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, normaliseWord,
    pickWord, readingSpeed, sequenceDuration, spellableWords, type Frame,
  } from '../lib/spelling';
  import type { Settings, SpellingAttempt } from '../lib/types';
  import HandSign from '../components/HandSign.svelte';
  import HandCheck from '../components/HandCheck.svelte';
  import ListPicker from '../components/ListPicker.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';
  import SignFive from './SignFive.svelte';
  import { hasIllustration } from '../lib/illustrations';

  let { modeParam }: { modeParam?: string } = $props();

  type Mode = 'receptive' | 'expressive';
  const mode = $derived<Mode | undefined>(modeParam === 'read' ? 'receptive' : modeParam === 'spell' ? 'expressive' : undefined);

  let store: Store;
  let settings = $state<Settings>();
  let attempts = $state<SpellingAttempt[]>([]);
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

  const stats = $derived(letterStats(attempts));
  const weakLetters = $derived(
    [...stats.entries()].filter(([, s]) => s.seen >= 3 && s.missed > 0).sort((a, b) => b[1].rate - a[1].rate).slice(0, 5),
  );
  const reading = $derived(readingSpeed(attempts));
  const readAttempts = $derived(attempts.filter((a) => a.mode === 'receptive'));
  const spellAttempts = $derived(attempts.filter((a) => a.mode === 'expressive'));
  const pctOf = (xs: SpellingAttempt[]) =>
    xs.length ? Math.round((xs.slice(-20).filter((a) => a.correct).length / Math.min(xs.length, 20)) * 100) : undefined;
  const readAccuracy = $derived(pctOf(readAttempts));
  const spellClean = $derived(pctOf(spellAttempts));
  const expressive = $derived(spellAttempts.filter((a) => a.correct).slice(-10).map((a) => a.lettersPerSecond));
  const signingSpeed = $derived(expressive.length ? expressive.reduce((a, b) => a + b, 0) / expressive.length : undefined);
  const speed = $derived(settings?.receptiveSpeed ?? 1.5);

  /** Read feedback: each letter of the word, and whether the learner typed it in that place. */
  const compare = $derived(
    chars.map((c, i) => ({ c, ok: normaliseWord(typed)[i] === c })),
  );

  onMount(async () => {
    store = await getStore();
    settings = await store.settings();
    attempts = await store.attempts();
  });

  onDestroy(clearTimers);

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  /** Starts the next word, or a specific one picked from the list. */
  function next(pick?: string) {
    if (!mode) return;
    clearTimers();
    const pool = mode === 'receptive' ? receptiveWords : allWords;
    word = pick ?? pickWord(pool, mode === 'receptive' ? stats : new Map(), recent) ?? pool[0];
    recent = [...recent.slice(-9), word];
    replays = 0;
    typed = '';
    if (mode === 'receptive') play();
    else startSigning();
  }

  function stop() {
    clearTimers();
    frame = undefined;
    phase = 'idle';
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

  /** Plays one chosen word straight away in the current mode. */
  function playWord(w: string) {
    if (!mode || (mode === 'receptive' && !canRead)) return;
    next(w);
  }

  function adjust(factor: number) {
    const v = Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed * factor)) * 100) / 100;
    saveSpeed(v);
  }

  function onKey(e: KeyboardEvent) {
    if (!mode || e.target instanceof HTMLInputElement) return;
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
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
</script>

<svelte:window onkeydown={onKey} />

{#if modeParam === 'game'}
  <SignFive />
{:else if !mode}
  <!-- Landing: pick a drill. -->
  <header class="hub-head">
    <h1>Fingerspelling</h1>
    <p class="muted">Two different skills: reading other people's spelling, and spelling clearly yourself.</p>
  </header>

  <div class="modes">
    <a class="mode-card read" href="#/fingerspell/read" class:locked={!canRead} aria-disabled={!canRead}>
      <div class="art" aria-hidden="true">
        <span class="flash">C</span><span class="flash on">A</span><span class="flash">T</span>
        <span class="art-icon"><Icon name="eye" size={22} /></span>
      </div>
      <div class="mode-body">
        <span class="kicker"><Icon name="eye" size={15} />Receptive</span>
        <h2>Read</h2>
        <p>Watch a word flash by one letter at a time, then type what you saw. Speed adapts to you.</p>
        <div class="mode-meta">
          {#if reading}<span><b>{lettersPerSecondToWpm(reading)}</b> wpm reading</span>{/if}
          <span><b>{readAttempts.length}</b> {readAttempts.length === 1 ? 'word' : 'words'} read</span>
          {#if readAccuracy !== undefined}<span><b>{readAccuracy}%</b> right</span>{/if}
        </div>
      </div>
      <span class="go">{canRead ? 'Start reading' : 'Needs letter images'}<Icon name="arrow-right" size={18} /></span>
    </a>

    <a class="mode-card spell" href="#/fingerspell/spell">
      <div class="art" aria-hidden="true">
        <span class="tile ok">C</span><span class="tile now">A</span><span class="tile">T</span>
        <span class="art-icon"><Icon name="camera" size={22} /></span>
      </div>
      <div class="mode-body">
        <span class="kicker"><Icon name="signs" size={15} />Expressive</span>
        <h2>Spell</h2>
        <p>See a word and fingerspell it to your camera. Each letter is checked as you go, and you get a score.</p>
        <div class="mode-meta">
          {#if signingSpeed}<span><b>{signingSpeed.toFixed(1)}</b> letters/s</span>{/if}
          <span><b>{spellAttempts.length}</b> {spellAttempts.length === 1 ? 'word' : 'words'} spelled</span>
          {#if spellClean !== undefined}<span><b>{spellClean}%</b> clean</span>{/if}
        </div>
      </div>
      <span class="go">Start spelling<Icon name="arrow-right" size={18} /></span>
    </a>
  </div>

  <a class="game-card" href="#/fingerspell/game">
    <span class="mini-board" aria-hidden="true">
      <i class="h">S</i><i class="n">I</i><i>G</i><i class="h">N</i><i class="n">5</i>
    </span>
    <span class="game-text">
      <b>Sign Five</b>
      <span class="small muted">A word game: guess the five-letter word in six tries by fingerspelling it to the camera.</span>
    </span>
    <span class="game-go">Play<Icon name="arrow-right" size={16} /></span>
  </a>

  <h2 class="section-title">Words to practise</h2>
  <ListPicker
    words={customWords}
    {useCustom}
    builtInCount={builtIn.length}
    onUse={(c) => saveWordSettings({ wordList: c ? 'custom' : 'builtin' })}
  />

  {#if weakLetters.length}
    <section class="card weak">
      <p class="small">
        <b>Letters you misread most:</b>
        {#each weakLetters as [l, s], i}<a href="#/learn/{l.toLowerCase()}">{l}</a> ({Math.round(s.rate * 100)}%){i < weakLetters.length - 1 ? ', ' : ''}{/each}.
        Read mode shows words with these letters more often.
      </p>
    </section>
  {/if}
{:else}
  <div class="drill {mode === 'receptive' ? 'read' : 'spell'}">
    <header class="drill-head">
      <a class="back small" href="#/fingerspell"><Icon name="arrow-left" size={16} />Fingerspelling</a>
      <div class="title-row">
        <span class="drill-icon"><Icon name={mode === 'receptive' ? 'eye' : 'camera'} size={22} /></span>
        <div class="titles">
          <h1>{mode === 'receptive' ? 'Read fingerspelling' : 'Spell with the camera'}</h1>
          <p class="small muted">
            {#if mode === 'receptive'}
              {reading ? `${lettersPerSecondToWpm(reading)} wpm reading` : 'No reading speed yet'} · {plural(readAttempts.length, 'word')} read
            {:else}
              {signingSpeed ? `${signingSpeed.toFixed(1)} letters/s` : 'No spelling speed yet'} · {plural(spellAttempts.length, 'word')} spelled
            {/if}
          </p>
        </div>
        <a class="btn ghost small switch" href="#/fingerspell/{mode === 'receptive' ? 'spell' : 'read'}">
          <Icon name={mode === 'receptive' ? 'camera' : 'eye'} size={16} />Switch to {mode === 'receptive' ? 'Spell' : 'Read'}
        </a>
      </div>
    </header>

    <ListPicker
      words={customWords}
      {useCustom}
      builtInCount={builtIn.length}
      activeWord={phase !== 'idle' ? word : undefined}
      onUse={(c) => saveWordSettings({ wordList: c ? 'custom' : 'builtin' })}
      onPlay={playWord}
    />

    {#if mode === 'receptive'}
      <section class="card drill-card">
        {#if !canRead}
          <h2>Not available yet</h2>
          <p>
            Reading drills need an image or video for each letter. {available.size} of 26 letters have one so far, so no
            practice words can be shown yet.
          </p>
        {:else}
          <div class="toolbar">
            <span class="small muted">
              {phase === 'idle' ? 'Ready' : phase === 'playing' ? 'Watch closely' : phase === 'answer' ? 'Your turn' : 'Result'}{#if replays && phase !== 'idle'} · {plural(replays, 'replay')}{/if}
            </span>
            <div class="speed" role="group" aria-label="Playback speed">
              <span class="small muted">Speed</span>
              <button class="small" onclick={() => adjust(0.9)} aria-label="Slower">−</button>
              <span class="mono small"><b>{speed.toFixed(1)}</b> letters/s · {lettersPerSecondToWpm(speed)} wpm</span>
              <button class="small" onclick={() => adjust(1.1)} aria-label="Faster">+</button>
            </div>
          </div>

          <div class="screen" aria-live="off">
            {#if phase === 'playing'}
              {#if frame}
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
              {:else}
                <div class="ready muted small">Watch…</div>
              {/if}
              <div class="ticks" aria-hidden="true">
                {#each chars as _, i}<span class:seen={frame ? i <= frame.index : false}></span>{/each}
              </div>
            {:else if phase === 'idle'}
              <div class="intro">
                <ol class="steps">
                  <li><span>1</span>Watch a word spelled one letter at a time.</li>
                  <li><span>2</span>Type the word you saw. Replay if you need to.</li>
                  <li><span>3</span>Read cleanly and it speeds up; miss and it slows down.</li>
                </ol>
                <button class="primary lg" onclick={() => next()}><Icon name="play" size={16} />Start <kbd>Enter</kbd></button>
              </div>
            {:else if phase === 'answer'}
              <div class="ready">
                <p class="muted small">What word was that?</p>
                <div class="slots" aria-hidden="true">{#each chars as _}<span></span>{/each}</div>
                <p class="small muted">{plural(chars.length, 'letter')}</p>
              </div>
            {:else if phase === 'feedback'}
              <div class="ready">
                <div class="compare" aria-label="The word was {word}">
                  {#each compare as l}<span class:ok={l.ok} class:miss={!l.ok}>{l.c}</span>{/each}
                </div>
              </div>
            {/if}
          </div>

          {#if phase === 'answer'}
            <form class="answer" onsubmit={submit}>
              <input bind:this={input} bind:value={typed} class="answer-input" type="text" autocomplete="off"
                autocapitalize="characters" spellcheck="false" placeholder="Type the word" aria-label="What word was spelled?" />
              <button type="button" onclick={replay}><Icon name="play" size={14} />Replay</button>
              <button class="primary" type="submit" disabled={!normaliseWord(typed)}>Check</button>
            </form>
          {:else if phase === 'feedback'}
            <div class="result" class:good={lastCorrect} class:bad={!lastCorrect}>
              <Icon name={lastCorrect ? 'check' : 'x'} size={18} />
              <span>
                {#if lastCorrect}
                  <b>Correct.</b>{replays ? ` After ${plural(replays, 'replay')}.` : ''}
                {:else}
                  <b>It was {word}.</b> You typed “{normaliseWord(typed)}”.
                {/if}
                {#if speed > speedBefore} Speeding up to {speed.toFixed(1)} letters/s.{:else if speed < speedBefore} Slowing down to {speed.toFixed(1)} letters/s.{/if}
              </span>
            </div>
            <div class="actions">
              <button onclick={() => play('feedback')}><Icon name="play" size={14} />Watch again</button>
              <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
            </div>
          {:else if phase === 'playing'}
            <div class="actions"><button class="ghost small" onclick={stop}>Stop</button></div>
          {/if}
        {/if}
      </section>
    {:else}
      <section class="card drill-card">
        {#if phase === 'idle'}
          <div class="spell-intro">
            <ol class="steps">
              <li><span>1</span>Turn on your camera and keep your hand in view.</li>
              <li><span>2</span>Fingerspell the word. Each letter turns green when the camera matches it.</li>
              <li><span>3</span>Stuck on a letter? Skip it or show its handshape.</li>
            </ol>
            <button class="primary lg" onclick={() => next()}><Icon name="play" size={16} />Start <kbd>Enter</kbd></button>
          </div>
        {:else}
          <div class="spell-stage">
            <div class="spell-side">
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
                {#if hints && currentId}
                  <div class="hint-now">
                    <SignPicture id={currentId} size={120} mirror={settings?.dominantHand === 'Left'} label="How to sign {chars[pos]}" />
                  </div>
                {/if}
                <div class="actions">
                  <button onclick={skipLetter}>Skip letter <kbd>S</kbd></button>
                  <button class="ghost" onclick={() => (hints = !hints)} aria-pressed={hints}>{hints ? 'Hide' : 'Show'} handshape</button>
                  <button class="primary" onclick={finishSigning}>Done <kbd>Enter</kbd></button>
                </div>
              {:else if scored}
                <div class="score" class:perfect={got === chars.length}>
                  <span class="score-num">{got}<small>/{chars.length}</small></span>
                  <span>{got === chars.length ? 'Clean spelling!' : 'letters right'}</span>
                </div>
                <p class="muted small center">
                  {elapsed.toFixed(1)} s · {(chars.length / Math.max(elapsed, 0.1)).toFixed(1)} letters/s
                  {#if got < chars.length}· missed {chars.filter((_, i) => !results[i]).join(', ')}{/if}
                </p>
                <div class="actions">
                  <button onclick={startSigning}>Try again</button>
                  <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
                </div>
              {:else}
                <p class="muted small center">
                  The camera didn't confirm any letters (is it on?). {elapsed.toFixed(1)} s. Was every letter clear?
                </p>
                <div class="actions">
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
  </div>
{/if}

<style>
  /* Each drill has its own colour so the two never look alike. */
  .read { --m: var(--accent); --m-soft: var(--accent-soft); }
  .spell { --m: #6d28d9; --m-soft: #f4f0ff; }

  /* Landing */
  .hub-head { margin: 4px 0 18px; }
  .hub-head h1 { margin: 0 0 4px; }
  .hub-head p { margin: 0; }
  .modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
  .mode-card {
    display: grid;
    grid-template-rows: auto 1fr auto;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
    overflow: hidden;
    box-shadow: var(--shadow);
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .mode-card:hover { border-color: var(--m); box-shadow: var(--shadow-lift); transform: translateY(-1px); }
  .mode-card.locked { opacity: 0.6; pointer-events: none; }
  .art {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    height: 132px;
    background: var(--m-soft);
    border-bottom: 1px solid var(--line);
  }
  .art-icon {
    position: absolute;
    top: 12px;
    left: 12px;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--surface);
    color: var(--m);
  }
  .flash { font-size: 2.6rem; font-weight: 750; color: color-mix(in srgb, var(--m) 25%, transparent); }
  .flash.on { font-size: 3.6rem; color: var(--m); }
  .tile {
    display: grid;
    place-items: center;
    width: 50px;
    height: 58px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    font-size: 1.7rem;
    font-weight: 700;
    color: var(--ink-3);
  }
  .tile.ok { border-color: var(--good); background: var(--good-soft); color: var(--good); }
  .tile.now { border: 2px solid var(--m); color: var(--m); box-shadow: 0 0 0 3px color-mix(in srgb, var(--m) 18%, transparent); }
  .mode-body { padding: 16px 18px 4px; }
  .mode-body h2 { margin: 4px 0 6px; font-size: 1.4rem; }
  .mode-body p { margin: 0; color: var(--ink-2); }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--m);
  }
  .mode-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; font-size: 0.85rem; color: var(--ink-3); }
  .mode-meta b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .go {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 14px 18px 16px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--m);
    color: #fff;
    font-weight: 650;
  }
  .game-card {
    display: flex; align-items: center; gap: 16px; margin: -12px 0 28px; padding: 14px 18px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow); transition: border-color 0.15s, box-shadow 0.15s;
  }
  .game-card:hover { border-color: #6d28d9; box-shadow: var(--shadow-lift); }
  .mini-board { display: flex; gap: 3px; flex: none; }
  .mini-board i {
    display: grid; place-items: center; width: 26px; height: 26px; border-radius: 4px; font-style: normal;
    font-weight: 750; font-size: 0.85rem; color: #fff; background: #667085;
  }
  .mini-board i.h { background: #067647; }
  .mini-board i.n { background: #b88a00; }
  .game-text { display: grid; flex: 1; min-width: 0; }
  .game-go { display: inline-flex; align-items: center; gap: 4px; font-weight: 650; color: #6d28d9; }
  @media (max-width: 560px) { .mini-board { display: none; } }
  .section-title { font-size: 1.05rem; margin: 0 0 10px; }
  .weak { margin-top: 16px; padding: 12px 16px; }
  .weak p { margin: 0; }

  /* Drill pages */
  .drill-head { margin: 0 0 16px; }
  .back { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-3); text-decoration: none; font-weight: 600; }
  .back:hover { color: var(--ink); }
  .title-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .drill-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--m-soft);
    color: var(--m);
    flex: none;
  }
  .titles { flex: 1; min-width: 200px; }
  .titles h1 { margin: 0; font-size: 1.6rem; }
  .titles p { margin: 2px 0 0; }
  .drill-card { margin-top: 14px; border-top: 3px solid var(--m); display: grid; gap: 14px; }
  .drill :global(.btn.primary), .drill :global(button.primary) { background: var(--m); border-color: var(--m); }
  .drill :global(.chip.active) { background: var(--m-soft); border-color: var(--m); }

  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .speed { display: flex; align-items: center; gap: 8px; }
  .speed button { min-width: 34px; }
  .mono { font-variant-numeric: tabular-nums; }

  .screen {
    position: relative;
    min-height: 300px;
    display: grid;
    place-items: center;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .letter { width: 100%; height: 260px; display: grid; place-items: center; }
  .letter img, .letter video { max-width: 100%; max-height: 260px; object-fit: contain; }
  .letter.shift { transform: translateX(14%); }
  .ticks { position: absolute; bottom: 14px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
  .ticks span { width: 22px; height: 4px; border-radius: 2px; background: var(--surface-3); transition: background 0.1s; }
  .ticks span.seen { background: var(--m); }
  .ready { display: grid; justify-items: center; gap: 10px; text-align: center; }
  .ready p { margin: 0; }
  .slots { display: flex; gap: 8px; }
  .slots span { width: 28px; height: 3px; border-radius: 2px; background: var(--line-strong); }
  .compare { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .compare span {
    display: grid;
    place-items: center;
    width: 54px;
    height: 64px;
    border-radius: var(--radius-sm);
    font-size: 2rem;
    font-weight: 700;
    border: 1px solid;
  }
  .compare .ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .compare .miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }

  .intro, .spell-intro { display: grid; justify-items: center; gap: 18px; padding: 16px; }
  .spell-intro { padding: 24px 16px; }
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; max-width: 440px; }
  .steps li { display: flex; align-items: flex-start; gap: 10px; color: var(--ink-2); }
  .steps span {
    flex: none;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--m-soft);
    color: var(--m);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .answer { display: flex; gap: 8px; }
  .answer .answer-input { flex: 1; max-width: none; min-width: 0; }
  .result { display: flex; align-items: center; gap: 10px; font-weight: 400; }
  .result :global(svg) { flex: none; }
  .actions { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; }

  /* Spell drill: word on the left, camera on the right. */
  .spell-stage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; align-items: start; }
  .spell-side { align-self: center; display: grid; gap: 14px; }
  .spell-side p { margin: 0; }
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
  .box.now { border: 2px solid var(--m); color: var(--m); box-shadow: 0 0 0 3px var(--m-soft); }
  .box.ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .box.miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
  .now-letter { color: var(--m); font-size: 1.1rem; }
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
  .score { display: grid; justify-items: center; gap: 2px; color: var(--ink-2); font-weight: 600; }
  .score-num { font-size: 3rem; font-weight: 750; line-height: 1; color: var(--m); font-variant-numeric: tabular-nums; }
  .score-num small { font-size: 1.4rem; color: var(--ink-3); }
  .score.perfect .score-num { color: var(--good); }

  @media (max-width: 760px) {
    .modes { grid-template-columns: 1fr; }
    .art { height: 104px; }
    .spell-stage { grid-template-columns: 1fr; }
    .box { width: 42px; height: 50px; font-size: 1.5rem; }
    .compare span { width: 42px; height: 50px; font-size: 1.5rem; }
    .switch { margin-left: 62px; }
    .answer { flex-wrap: wrap; }
    .answer .answer-input { flex-basis: 100%; }
    .answer button { flex: 1; }
  }
</style>
