<script lang="ts">
  // Spell (#/practice/spell): see a word and fingerspell it. The
  // camera checks one letter at a time and moves on when it matches; at the
  // end you see how many letters you got.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { normalizeWord, pickWord, spellingSummary } from '../lib/spelling';
  import { drillWords, letters, plural } from '../lib/fingerspell';
  import { loadSettings, mirrored, prefs } from '../lib/settings.svelte';
  import type { SpellingAttempt } from '../lib/types';
  import { createDemoLoop } from '../lib/demo.svelte';
  import DrillIntro from '../components/DrillIntro.svelte';
  import DrillPage from '../components/DrillPage.svelte';
  import HandCheck from '../components/HandCheck.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';

  let store: Store;
  const settings = $derived(prefs.value);
  let attempts = $state<SpellingAttempt[]>([]);
  let phase = $state<'idle' | 'signing' | 'feedback'>('idle');
  let word = $state('');
  let recent: string[] = [];
  let startedAt = 0;
  let elapsed = $state(0);
  let pos = $state(0);
  let results = $state<(boolean | undefined)[]>([]);
  /** Bumped for each letter so the camera check restarts, even for a doubled letter. */
  let round = $state(0);
  let saved = $state(false);
  let hints = $state(false);

  const chars = $derived(normalizeWord(word).split(''));
  const currentId = $derived(letters.get(chars[pos] ?? '')?.id);
  const got = $derived(results.filter(Boolean).length);
  /** The camera confirmed at least one letter, so its score can be trusted. */
  const scored = $derived(got > 0);
  const summary = $derived(spellingSummary(attempts));

  // The start screen's preview: a short word spelled a letter at a time, each
  // box turning green as its letter is matched, then the next word.
  const DEMO_WORDS = ['CAT', 'SUN', 'DOG'];
  /** One step for each letter, then one with the whole word matched. Still, it shows the word half spelled. */
  const loop = createDemoLoop(() => [1100, 1100, 1100, 1700], () => 1);
  const demoWord = $derived(DEMO_WORDS[loop.round % DEMO_WORDS.length]);
  const demoLetter = $derived(demoWord[loop.step]);

  $effect(() => {
    if (phase === 'idle') return loop.run();
  });

  onMount(async () => {
    store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
  });

  /** Starts the next word, or a word picked from the list. */
  function next(pick?: string) {
    const words = drillWords(settings).words;
    word = pick ?? pickWord(words, new Map(), recent) ?? words[0];
    recent = [...recent.slice(-9), word];
    start();
  }

  function start() {
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
    if (pos >= chars.length) finish();
  }

  function finish() {
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

  async function selfGrade(clean: boolean) {
    await record(clean);
    next();
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    if (phase === 'signing' && (e.key === 's' || e.key === 'S')) {
      skipLetter();
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (phase === 'idle' || (phase === 'feedback' && scored)) {
      e.preventDefault();
      next();
    } else if (phase === 'signing') {
      e.preventDefault();
      finish();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<DrillPage
  kind="spell"
  title="Spell"
  subtitle="{summary.spell.lettersPerSecond ? `${summary.spell.lettersPerSecond.toFixed(1)} letters/s` : 'No spelling speed yet'} · {plural(summary.spell.count, 'word')} spelled"
  activeWord={phase !== 'idle' ? word : undefined}
  onPlay={next}
>
  {#if phase === 'idle'}
    <DrillIntro label="How a word goes" caption={demoLetter ? `You sign ${demoLetter}` : 'Every letter matched'}>
      <ol class="steps">
        <li><span>1</span>Turn on your camera and keep your hand in view.</li>
        <li><span>2</span>Fingerspell the word. Each letter turns green when the camera matches it.</li>
        <li><span>3</span>Stuck on a letter? Skip it or show its handshape.</li>
      </ol>
      <button class="primary lg" onclick={() => next()}><Icon name="play" size={16} />Start <kbd>Enter</kbd></button>

      {#snippet demo()}
        <div class="word-boxes demo-boxes">
          {#each demoWord as c, i}
            <span class="box" class:ok={i < loop.step} class:now={i === loop.step}>{c}</span>
          {/each}
        </div>
        <div class="demo-frame filled">
          {#if demoLetter}
            <SignPicture id={demoLetter.toLowerCase()} size={104} mirror={mirrored(settings)} />
          {:else}
            <span class="demo-done"><Icon name="check" size={44} /></span>
          {/if}
        </div>
      {/snippet}
    </DrillIntro>
  {:else}
    <div class="stage">
      <div class="side">
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
          <p class="muted small center">Sign <b class="now-letter">{chars[pos]}</b> · letter {pos + 1} of {chars.length}</p>
          {#if hints && currentId}
            <div class="hint-now">
              <SignPicture id={currentId} size={120} mirror={mirrored(settings)} label="How to sign {chars[pos]}" />
            </div>
          {/if}
          <div class="button-row">
            <button onclick={skipLetter}>Skip letter <kbd>S</kbd></button>
            <button class="ghost" onclick={() => (hints = !hints)} aria-pressed={hints}>{hints ? 'Hide' : 'Show'} handshape</button>
            <button class="primary" onclick={finish}>Done <kbd>Enter</kbd></button>
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
          <div class="button-row">
            <button onclick={start}>Try again</button>
            <button class="primary" onclick={() => next()}>Next word <kbd>Enter</kbd></button>
          </div>
        {:else}
          <p class="muted small center">
            The camera didn't confirm any letters (is it on?). {elapsed.toFixed(1)} s. Was every letter clear?
          </p>
          <div class="button-row">
            <button onclick={() => selfGrade(false)}>Stumbled</button>
            <button class="primary" onclick={() => selfGrade(true)}>Clean</button>
          </div>
        {/if}
      </div>

      <div>
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
</DrillPage>

<style>
  /* The start screen's layout and preview frame are in DrillIntro; these are the pieces inside the preview. */
  .demo-boxes { flex-wrap: nowrap; gap: 6px; }
  .demo-boxes .box { width: 46px; height: 52px; font-size: 1.6rem; }
  .demo-done { color: var(--good); display: grid; }
  /* Word on the left, camera on the right. */
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 20px; align-items: start; }
  .side { align-self: center; display: grid; gap: 14px; }
  .side p { margin: 0; }
  .word-boxes { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .box {
    width: 52px; height: 60px; display: grid; place-items: center; font-size: 1.9rem; font-weight: 700;
    border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink-3);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .box.now { border: 2px solid var(--m); color: var(--m); box-shadow: 0 0 0 3px var(--m-soft); }
  .box.ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .box.miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
  .now-letter { color: var(--m); font-size: 1.1rem; }
  .hint-now {
    width: 140px; margin: 0 auto; display: grid; place-items: center; padding: 8px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--paper);
  }
  .score { display: grid; justify-items: center; gap: 2px; color: var(--ink-2); font-weight: 600; }
  .score-num { font-size: 3rem; font-weight: 750; line-height: 1; color: var(--m); font-variant-numeric: tabular-nums; }
  .score-num small { font-size: 1.4rem; color: var(--ink-3); }
  .score.perfect .score-num { color: var(--good); }
  @media (max-width: 760px) {
    .stage { grid-template-columns: 1fr; }
    .box { width: 42px; height: 50px; font-size: 1.5rem; }
  }
</style>
