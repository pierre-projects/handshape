<script lang="ts">
  // Free reading (#/practice/read/free): watch a word spelled one
  // letter at a time, then type it, word after word. Speed adapts: clean reads
  // speed up, misses slow down. Uses the built-in words or one of your lists.
  import { onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { content } from '../lib/content';
  import { routes } from '../lib/routes';
  import {
    checkWord, letterStats, lettersPerSecondToWpm, MAX_SPEED, MIN_SPEED, nextSpeed, normalizeWord, pickWord,
    spellableWords, spellingSummary,
  } from '../lib/spelling';
  import { canRead, drillWords, plural, showableLetters } from '../lib/fingerspell';
  import { loadSettings, mirrored, prefs, updateSettings } from '../lib/settings.svelte';
  import type { SpellingAttempt } from '../lib/types';
  import DisplaySwitch from '../components/DisplaySwitch.svelte';
  import DrillPage from '../components/DrillPage.svelte';
  import Icon from '../components/Icon.svelte';
  import LetterStrip from '../components/LetterStrip.svelte';
  import SpellPlayer from '../components/SpellPlayer.svelte';

  let store: Store;
  const settings = $derived(prefs.value);
  let attempts = $state<SpellingAttempt[]>([]);
  let phase = $state<'idle' | 'playing' | 'answer' | 'feedback'>('idle');
  let word = $state('');
  let recent: string[] = [];
  /** Bumped to play the word again. */
  let run = $state(0);
  let slow = $state(false);
  let after: 'answer' | 'feedback' = 'answer';
  let replays = $state(0);
  let typed = $state('');
  let lastCorrect = $state(false);
  let speedBefore = $state(0);
  let input = $state<HTMLInputElement>();

  const chars = $derived(normalizeWord(word).split(''));
  const chosen = $derived(drillWords(settings));
  const words = $derived(spellableWords(chosen.words, showableLetters));
  const stats = $derived(letterStats(attempts));
  const summary = $derived(spellingSummary(attempts));
  const speed = $derived(settings?.receptiveSpeed ?? 1.5);
  /** Feedback: each letter of the word, and whether it was typed in that place. */
  const compare = $derived(chars.map((c, i) => ({ c, ok: normalizeWord(typed)[i] === c })));
  /** What kind of word is coming ("a name"), for the built-in words that say. */
  const hint = $derived(chosen.list ? undefined : content.wordHints.get(word));

  onMount(async () => {
    store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
  });

  /** Starts the next word (favoring letters often misread), or a word picked from the list. */
  function next(pick?: string) {
    word = pick ?? pickWord(words, stats, recent) ?? words[0];
    recent = [...recent.slice(-9), word];
    replays = 0;
    typed = '';
    play();
  }

  function stop() {
    phase = 'idle';
  }

  /** Plays the word. After feedback, replaying returns to feedback instead of the answer box. */
  function play(then: 'answer' | 'feedback' = 'answer', slower = false) {
    after = then;
    slow = slower;
    phase = 'playing';
    run++;
  }

  async function played() {
    phase = after;
    if (phase === 'answer') {
      await tick();
      input?.focus();
    }
  }

  function replay(slower: boolean) {
    replays++;
    play('answer', slower);
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!normalizeWord(typed)) return;
    lastCorrect = checkWord(word, typed);
    speedBefore = speed;
    const attempt: SpellingAttempt = {
      word, mode: 'receptive', drill: 'word', correct: lastCorrect, typed: normalizeWord(typed),
      lettersPerSecond: speed, replays, at: new Date(),
    };
    await store.addAttempt(attempt);
    attempts = [...attempts, attempt];
    await updateSettings({ receptiveSpeed: nextSpeed(speed, lastCorrect, replays) });
    phase = 'feedback';
  }

  function adjust(factor: number) {
    updateSettings({ receptiveSpeed: Math.round(Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed * factor)) * 100) / 100 });
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (canRead && (phase === 'idle' || phase === 'feedback')) {
      e.preventDefault();
      next();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<DrillPage
  kind="read"
  title="Free reading"
  subtitle="{summary.read.wpm ? `${summary.read.wpm} wpm reading` : 'No reading speed yet'} · {plural(summary.read.count, 'word')} read"
  activeWord={phase !== 'idle' ? word : undefined}
  onPlay={canRead ? next : undefined}
  back={{ href: routes.read, label: 'Read' }}
>
  {#if !canRead}
    <h2>Not available yet</h2>
    <p>
      Reading drills need an image or video for each letter. {showableLetters.size} of 26 letters have one so far, so no
      practice words can be shown yet.
    </p>
  {:else}
    <div class="toolbar">
      <span class="small muted">
        {phase === 'idle' ? 'Ready' : phase === 'playing' ? 'Watch closely' : phase === 'answer' ? 'Your turn' : 'Result'}{#if replays && phase !== 'idle'} · {plural(replays, 'replay')}{/if}
      </span>
      <DisplaySwitch />
      <div class="speed" role="group" aria-label="Playback speed">
        <span class="small muted">Speed</span>
        <button class="small" onclick={() => adjust(0.9)} aria-label="Slower">−</button>
        <span class="mono small"><b>{speed.toFixed(1)}</b> letters/s · {lettersPerSecondToWpm(speed)} wpm</span>
        <button class="small" onclick={() => adjust(1.1)} aria-label="Faster">+</button>
      </div>
    </div>

    <div class="screen" aria-live="off">
      {#if hint && (phase === 'playing' || phase === 'answer')}<span class="hint">Hint: {hint}</span>{/if}
      {#if phase === 'playing'}
        {#key run}
          <SpellPlayer
            ids={chars.map((c) => c.toLowerCase())}
            speed={slow ? speed / 2 : speed}
            display={settings?.readDisplay ?? 'pictures'}
            mirror={mirrored(settings)}
            onDone={played}
          />
        {/key}
      {:else if phase === 'idle'}
        <div class="intro">
          <ol class="steps">
            <li><span>1</span>Watch a word spelled one letter at a time.</li>
            <li><span>2</span>Type the word you saw. Replay if you need to, slower if it helps.</li>
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
      {:else}
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
        <button type="button" onclick={() => replay(false)}><Icon name="play" size={14} />Replay</button>
        <button type="button" onclick={() => replay(true)}>Slower</button>
        <button class="primary" type="submit" disabled={!normalizeWord(typed)}>Check</button>
      </form>
    {:else if phase === 'feedback'}
      <div class="result" class:good={lastCorrect} class:bad={!lastCorrect}>
        <Icon name={lastCorrect ? 'check' : 'x'} size={18} />
        <span>
          {#if lastCorrect}
            <b>Correct.</b>{replays ? ` After ${plural(replays, 'replay')}.` : ''}
          {:else}
            <b>It was {word}.</b> You typed “{normalizeWord(typed)}”.
          {/if}
          {#if speed > speedBefore} Speeding up to {speed.toFixed(1)} letters/s.{:else if speed < speedBefore} Slowing down to {speed.toFixed(1)} letters/s.{/if}
        </span>
      </div>
      {#if !lastCorrect}
        <LetterStrip parts={compare.map((l) => ({ id: l.c.toLowerCase(), label: l.c, ok: l.ok }))} mirror={mirrored(settings)} />
      {/if}
      <div class="button-row">
        <button onclick={() => play('feedback', true)}><Icon name="play" size={14} />Watch again, slowly</button>
        <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
      </div>
    {:else if phase === 'playing'}
      <div class="button-row"><button class="ghost small" onclick={stop}>Stop</button></div>
    {/if}
  {/if}
</DrillPage>

<style>
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .speed { display: flex; align-items: center; gap: 8px; }
  .speed button { min-width: 34px; }
  .mono { font-variant-numeric: tabular-nums; }

  .screen {
    position: relative; min-height: 300px; display: grid; place-items: center; overflow: hidden; padding: 8px 8px 24px;
    background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius);
  }
  .hint {
    position: absolute; top: 10px; left: 10px; z-index: 1; padding: 3px 10px; border-radius: 999px;
    background: var(--m-soft); color: var(--m); font-size: 0.8rem; font-weight: 600;
  }
  .intro { display: grid; justify-items: center; gap: 18px; padding: 16px; }
  .ready { display: grid; justify-items: center; gap: 10px; text-align: center; }
  .ready p { margin: 0; }
  .slots { display: flex; gap: 8px; }
  .slots span { width: 28px; height: 3px; border-radius: 2px; background: var(--line-strong); }
  .compare { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .compare span {
    display: grid; place-items: center; width: 54px; height: 64px; border: 1px solid;
    border-radius: var(--radius-sm); font-size: 2rem; font-weight: 700;
  }
  .compare .ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .compare .miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }

  .answer { display: flex; gap: 8px; }
  .answer .answer-input { flex: 1; max-width: none; min-width: 0; }
  .result { display: flex; align-items: center; gap: 10px; font-weight: 400; }
  .result :global(svg) { flex: none; }

  @media (max-width: 760px) {
    .compare span { width: 42px; height: 50px; font-size: 1.5rem; }
    .answer { flex-wrap: wrap; }
    .answer .answer-input { flex-basis: 100%; }
    .answer button { flex: 1; }
  }
</style>
