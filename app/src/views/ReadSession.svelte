<script lang="ts">
  // One reading level (#/fingerspelling/read/<level>): ten quick reads, then a
  // summary of what was missed. Letters and numbers are picked from four
  // choices; words and digit strings are typed.
  import { onMount, tick } from 'svelte';
  import { getStore } from '../lib/app';
  import type { Store } from '../lib/db';
  import { routes } from '../lib/routes';
  import { plural, readingMaterial } from '../lib/fingerspell';
  import {
    buildSession, compare, confusions, isRight, LEVELS, levelById, levelState, lockedReason, MIXUPS_LEVEL,
    mixUpLetterCount, normalise, PASS, recordResult, scoreSession, SESSION_SIZE, TRACKS, type Answer, type SessionItem,
  } from '../lib/receptive';
  import { loadSettings, mirrored, prefs, updateSettings } from '../lib/settings.svelte';
  import type { SpellingAttempt } from '../lib/types';
  import DisplaySwitch from '../components/DisplaySwitch.svelte';
  import DrillPage from '../components/DrillPage.svelte';
  import Icon from '../components/Icon.svelte';
  import LetterStrip from '../components/LetterStrip.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import SpellPlayer from '../components/SpellPlayer.svelte';

  let { levelId }: { levelId: string } = $props();
  // The page is rebuilt for each address, so the level is fixed while it is open.
  // svelte-ignore state_referenced_locally
  const level = levelById(levelId);

  let store: Store;
  let attempts = $state<SpellingAttempt[]>([]);
  let ready = $state(false);
  let items = $state<SessionItem[]>([]);
  let answers = $state<Answer[]>([]);
  let index = $state(0);
  let phase = $state<'intro' | 'show' | 'answer' | 'feedback' | 'summary'>('intro');
  /** Bumped to play the current item again. */
  let run = $state(0);
  let slow = $state(false);
  let replays = $state(0);
  let typed = $state('');
  let last = $state<Answer>();
  /** Going over the ones missed: doesn't count toward the level. */
  let rerun = $state(false);
  let passedBefore = $state(false);
  let after: 'answer' | 'feedback' = 'answer';
  let input = $state<HTMLInputElement>();

  /** A picture that stays up while you answer, rather than something spelled or flashed. */
  const still = level?.flashMs === 0;
  const baseSpeed = level?.speed ?? (level?.flashMs ? 1000 / level.flashMs : 1);
  /** What is being read, for the wording: a letter, a word or a number. */
  const what = level?.kind ?? 'word';
  const track = TRACKS.find((t) => t.id === level?.track);

  const item = $derived(items[index]);
  const display = $derived(prefs.value?.readDisplay ?? 'pictures');
  const mirror = $derived(mirrored(prefs.value));
  const progress = $derived(prefs.value?.readLevels ?? {});
  const mixUpLetters = $derived(mixUpLetterCount(confusions(attempts)));
  const locked = $derived(!!level && levelState(level, progress, mixUpLetters) === 'locked');
  const score = $derived(scoreSession(answers, items.length || SESSION_SIZE));
  /** The level after this one in its track, to offer once this is passed. */
  const nextUp = $derived.by(() => {
    if (!level || level.id === MIXUPS_LEVEL) return undefined;
    const inTrack = LEVELS.filter((l) => l.track === level.track && l.id !== MIXUPS_LEVEL);
    return inTrack[inTrack.indexOf(level) + 1];
  });

  onMount(async () => {
    store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
    ready = true;
  });

  /** Starts a session: a fresh ten, or just the given items (the ones missed last time). */
  function start(only?: SessionItem[]) {
    if (!level) return;
    passedBefore = !!progress[level.id]?.passedAt;
    rerun = !!only;
    items = only ?? buildSession(level, readingMaterial, attempts);
    answers = [];
    index = 0;
    if (items.length) begin();
  }

  function begin() {
    replays = 0;
    typed = '';
    last = undefined;
    slow = false;
    after = 'answer';
    phase = still ? 'answer' : 'show';
    run++;
  }

  async function shown() {
    phase = after;
    after = 'answer';
    if (phase === 'answer') {
      await tick();
      input?.focus();
    }
  }

  function replay(slower: boolean) {
    replays++;
    slow = slower;
    after = 'answer';
    phase = 'show';
    run++;
  }

  function watchAgain() {
    slow = true;
    after = 'feedback';
    phase = 'show';
    run++;
  }

  async function answer(given: string) {
    if (!item || phase !== 'answer') return;
    const tidy = normalise(item, given);
    if (!tidy) return;
    const a: Answer = { item, given: tidy, correct: isRight(item, tidy), replays };
    answers = [...answers, a];
    last = a;
    phase = 'feedback';
    const attempt: SpellingAttempt = {
      word: item.answer, mode: 'receptive', drill: item.kind, correct: a.correct, typed: tidy,
      lettersPerSecond: still ? 0 : baseSpeed, replays, at: new Date(),
    };
    attempts = [...attempts, attempt];
    await store.addAttempt(attempt);
  }

  async function next() {
    if (index + 1 < items.length) {
      index++;
      begin();
      return;
    }
    phase = 'summary';
    if (level && !rerun) await updateSettings({ readLevels: recordResult(prefs.value?.readLevels ?? {}, level.id, score.correct) });
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const go = e.key === 'Enter' || e.key === ' ';
    if (phase === 'intro' && go && ready && !locked) {
      e.preventDefault();
      start();
    } else if (phase === 'feedback' && go) {
      e.preventDefault();
      next();
    } else if (phase === 'answer' && item?.choices) {
      // Press the letter or digit itself to pick it.
      const pick = item.choices.find((c) => c === e.key.toUpperCase());
      if (pick) {
        e.preventDefault();
        answer(pick);
      }
    }
  }

  /** The strip under a wrong answer: every letter with a mark on the ones missed, or the two signs that were mixed up. */
  function strip(a: Answer): { id: string; label: string; caption?: string; ok: boolean }[] {
    if (a.item.show.length === 1) {
      return [
        { id: a.item.show[0], label: a.item.answer, caption: 'shown', ok: true },
        { id: a.given.toLowerCase(), label: a.given, caption: 'your pick', ok: false },
      ];
    }
    return compare(a.item, a.given).map((c, i) => ({ id: a.item.show[i], label: c.shown, ok: c.ok }));
  }

  const pace = level?.speed
    ? `${level.speed} ${level.kind === 'number' ? 'digits' : 'letters'} a second`
    : level?.flashMs
      ? `Flashes for ${level.flashMs / 1000} s`
      : 'No time limit';
</script>

<svelte:window onkeydown={onKey} />

{#if !level}
  <section class="card">
    <h2>No such level</h2>
    <p><a href={routes.read}>Back to the reading levels</a></p>
  </section>
{:else}
  <DrillPage
    kind="read"
    title={level.title}
    subtitle="{track?.title} · {pace}"
    back={{ href: routes.read, label: 'Reading levels' }}
    lists={false}
  >
    {#if !ready}
      <p class="muted small">Loading…</p>
    {:else if locked}
      <h2>Locked</h2>
      <p>{lockedReason(level)}</p>
      <p><a class="btn" href={routes.read}>Back to the levels</a></p>
    {:else if phase === 'intro'}
      <div class="intro">
        <p class="lead">{level.blurb}</p>
        <ol class="steps">
          {#if still}
            <li><span>1</span>Look at the {what}. There is no rush.</li>
            <li><span>2</span>Pick it from the four choices, or press its key.</li>
          {:else if level.answer === 'choice'}
            <li><span>1</span>A {what} flashes up for a moment.</li>
            <li><span>2</span>Pick it from the four choices, or press its key. Replay if you need to.</li>
          {:else}
            <li><span>1</span>Watch the {what} spelled out, one {level.kind === 'number' ? 'digit' : 'letter'} at a time.</li>
            <li><span>2</span>Type what you saw. Replay if you need to, slower if it helps.</li>
          {/if}
          <li><span>3</span>{SESSION_SIZE} in a row. Get {PASS} right to pass.</li>
        </ol>
        <button class="primary lg" onclick={() => start()}><Icon name="play" size={16} />Start <kbd>Enter</kbd></button>
        {#if !items.length && answers.length === 0 && level.id === MIXUPS_LEVEL && mixUpLetters === 0}
          <p class="small muted">There is nothing to drill yet.</p>
        {/if}
      </div>
    {:else if phase === 'summary'}
      <div class="summary">
        <p class="score" class:good={score.passed}><b>{score.correct}</b> of {score.total}</p>
        <h2>
          {#if rerun}
            {score.correct === score.total ? 'All of them this time.' : 'Getting there.'}
          {:else if score.passed && !passedBefore}
            Level passed{#if nextUp}. “{nextUp.title}” is open{/if}.
          {:else if score.passed}
            Passed again.
          {:else}
            {PASS - score.correct} more to pass. Try again.
          {/if}
        </h2>
        <p class="small muted">
          {plural(score.clean, 'clean read')} with no replay{#if !rerun && progress[level.id]}{' · '}best {progress[level.id].best} of {SESSION_SIZE}{/if}
        </p>

        {#if score.missedChars.length}
          <p class="missed-chars">
            <b>Missed most:</b>
            {#each score.missedChars.slice(0, 8) as c}
              <a class="pill" href={routes.sign(c.toLowerCase())} title="Open {c}">
                <SignPicture id={c.toLowerCase()} size={28} {mirror} />{c}
              </a>
            {/each}
          </p>
        {/if}

        {#if score.missed.length && level.answer === 'type'}
          <ul class="missed-list">
            {#each answers.filter((a) => !a.correct) as a}
              <li>
                <span class="small"><b>{a.item.answer}</b> <span class="muted">you typed {a.given}</span></span>
                <LetterStrip parts={strip(a)} {mirror} />
              </li>
            {/each}
          </ul>
        {/if}

        <div class="button-row">
          {#if score.missed.length}
            <button onclick={() => start(score.missed)}>Practice the {score.missed.length === 1 ? 'one' : score.missed.length} you missed</button>
          {/if}
          <button onclick={() => start()}>Play again</button>
          {#if score.passed && nextUp && !rerun}
            <a class="btn primary" href={routes.readLevel(nextUp.id)}>Next: {nextUp.title}<Icon name="arrow-right" size={16} /></a>
          {:else}
            <a class="btn primary" href={routes.read}>Back to the levels</a>
          {/if}
        </div>
      </div>
    {:else if !item}
      <p>There is nothing to read in this level yet.</p>
      <p><a class="btn" href={routes.read}>Back to the levels</a></p>
    {:else}
      <div class="toolbar">
        <span class="count small"><b>{index + 1}</b> of {items.length}{#if rerun}{' · '}the ones you missed{/if}</span>
        <div class="progress" aria-hidden="true"><span style="width: {((index + (phase === 'feedback' ? 1 : 0)) / items.length) * 100}%"></span></div>
        {#if !still}<DisplaySwitch />{/if}
      </div>

      <div class="screen" aria-live="off">
        {#if item.hint && phase !== 'feedback'}<span class="hint">Hint: {item.hint}</span>{/if}
        {#if phase === 'show'}
          {#key run}
            <SpellPlayer ids={item.show} speed={slow ? baseSpeed / 2 : baseSpeed} {display} {mirror} onDone={shown} />
          {/key}
        {:else if still}
          <SignPicture id={item.show[0]} size={230} {mirror} />
        {:else if phase === 'answer'}
          <div class="ready">
            <p class="muted small">{level.answer === 'choice' ? `Which ${what} was that?` : `What ${what} was that?`}</p>
            {#if level.answer === 'type'}
              <div class="slots" aria-hidden="true">{#each item.show as _}<span></span>{/each}</div>
              <p class="small muted">{plural(item.show.length, level.kind === 'number' ? 'digit' : 'letter')}</p>
            {/if}
          </div>
        {:else if last}
          <div class="compare" aria-label="It was {item.answer}">
            {#each compare(item, last.given) as c}<span class:ok={c.ok} class:miss={!c.ok}>{c.shown}</span>{/each}
          </div>
        {/if}
      </div>

      {#if phase === 'answer'}
        {#if item.choices}
          <div class="choices" role="group" aria-label="Pick the {what}">
            {#each item.choices as c}
              <button class="choice" onclick={() => answer(c)}>{c}</button>
            {/each}
          </div>
          {#if !still}
            <div class="button-row">
              <button class="small" onclick={() => replay(false)}><Icon name="play" size={14} />Replay</button>
              <button class="small" onclick={() => replay(true)}>Replay slower</button>
            </div>
          {/if}
        {:else}
          <form class="answer" onsubmit={(e) => { e.preventDefault(); answer(typed); }}>
            <input bind:this={input} bind:value={typed} class="answer-input" type="text" autocomplete="off"
              autocapitalize="characters" spellcheck="false" inputmode={level.kind === 'number' ? 'numeric' : 'text'}
              placeholder={level.kind === 'number' ? 'Type the digits' : 'Type the word'} aria-label="What was spelled?" />
            <button type="button" onclick={() => replay(false)}><Icon name="play" size={14} />Replay</button>
            <button type="button" onclick={() => replay(true)}>Slower</button>
            <button class="primary" type="submit" disabled={!normalise(item, typed)}>Check</button>
          </form>
        {/if}
      {:else if phase === 'feedback' && last}
        <div class="result" class:good={last.correct} class:bad={!last.correct}>
          <Icon name={last.correct ? 'check' : 'x'} size={18} />
          <span>
            {#if last.correct}
              <b>Correct.</b>{last.replays ? ` After ${plural(last.replays, 'replay')}.` : ''}
            {:else}
              <b>It was {item.answer}.</b> You {item.choices ? 'picked' : 'typed'} {last.given}.
            {/if}
          </span>
        </div>
        {#if !last.correct}
          <LetterStrip parts={strip(last)} {mirror} />
        {/if}
        <div class="button-row">
          {#if !still}<button onclick={watchAgain}><Icon name="play" size={14} />Watch again, slowly</button>{/if}
          <button class="primary" onclick={next}>{index + 1 < items.length ? 'Next' : 'See how you did'} <kbd>Enter</kbd></button>
        </div>
      {:else if phase === 'show'}
        <div class="button-row"><span class="small muted">Watch closely</span></div>
      {/if}
    {/if}
  </DrillPage>
{/if}

<style>
  .intro { display: grid; justify-items: center; gap: 18px; padding: 8px 8px 16px; text-align: center; }
  .intro .steps { text-align: left; }
  .lead { margin: 0; font-size: 1.05rem; color: var(--ink-2); max-width: 46ch; }

  .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .toolbar .progress { flex: 1; min-width: 100px; }
  .toolbar .progress > span { background: var(--m); }
  .count { font-variant-numeric: tabular-nums; color: var(--ink-2); }

  .screen {
    position: relative; min-height: 300px; display: grid; place-items: center; overflow: hidden; padding: 8px 8px 24px;
    background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius);
  }
  .hint {
    position: absolute; top: 10px; left: 10px; z-index: 1; padding: 3px 10px; border-radius: 999px;
    background: var(--m-soft); color: var(--m); font-size: 0.8rem; font-weight: 600;
  }
  .ready { display: grid; justify-items: center; gap: 10px; text-align: center; }
  .ready p { margin: 0; }
  .slots { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .slots span { width: 28px; height: 3px; border-radius: 2px; background: var(--line-strong); }
  .compare { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
  .compare span {
    display: grid; place-items: center; min-width: 54px; height: 64px; padding: 0 8px; border: 1px solid;
    border-radius: var(--radius-sm); font-size: 2rem; font-weight: 700;
  }
  .compare .ok { background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .compare .miss { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }

  .choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .choice { min-height: 68px; font-size: 1.8rem; font-weight: 700; }
  .choice:hover { border-color: var(--m); color: var(--m); }

  .answer { display: flex; gap: 8px; }
  .answer .answer-input { flex: 1; max-width: none; min-width: 0; }
  .result { display: flex; align-items: center; gap: 10px; font-weight: 400; }
  .result :global(svg) { flex: none; }

  .summary { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 8px 0; }
  .summary h2, .summary p { margin: 0; }
  .score { font-size: 1.4rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .score b { font-size: 3.4rem; font-weight: 750; line-height: 1; color: var(--ink); }
  .score.good b { color: var(--good); }
  .missed-chars { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin-top: 6px !important; }
  .missed-chars .pill { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-weight: 700; }
  .missed-list { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 14px; width: 100%; }
  .missed-list li { display: grid; gap: 6px; justify-items: center; }
  .summary .button-row { margin-top: 10px; }

  @media (max-width: 760px) {
    .compare span { min-width: 42px; height: 50px; font-size: 1.5rem; }
    .answer { flex-wrap: wrap; }
    .answer .answer-input { flex-basis: 100%; }
    .answer button { flex: 1; }
    .choices { grid-template-columns: repeat(2, 1fr); }
  }
</style>
