<script lang="ts">
  // Sign the answer (#/fingerspelling/sums): a sum appears and the learner
  // signs its answer, a number from 0 to 10. There is no picture to copy, so
  // the handshape has to be recalled. The camera reads numbers only here, so a
  // 2 is never taken for a V; tapping the number works too, for when there is
  // no camera. Nothing is saved: a round is ten sums and a score at the end.
  import { onDestroy, onMount } from 'svelte';
  import { routes } from '../lib/routes';
  import { content } from '../lib/content';
  import { loadSettings, mirrored, prefs } from '../lib/settings.svelte';
  import { ANSWERS, firstTry, makeRound, ROUND_LENGTH, roundMessage, sumSpoken, sumText, type Sum, type SumResult } from '../lib/sums';
  import DrillPage from '../components/DrillPage.svelte';
  import LetterCam from '../components/LetterCam.svelte';
  import LetterTip from '../components/LetterTip.svelte';
  import { createPeek } from '../lib/peek.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';

  /** How long the right answer stays up before the next sum, and a skipped one (longer: it is new to the learner). */
  const RIGHT_MS = 1300;
  const SKIPPED_MS = 2400;
  /** After this many wrong answers the handshape is shown without being asked for. */
  const SHOW_AFTER = 2;

  const settings = $derived(prefs.value);
  const mirror = $derived(mirrored(settings));

  let phase = $state<'idle' | 'playing' | 'done'>('idle');
  let round = $state<Sum[]>([]);
  let index = $state(0);
  let results = $state<SumResult[]>([]);
  /** This sum so far: wrong answers given, and whether its handshape has been shown. */
  let wrong = $state<string[]>([]);
  let shown = $state(false);
  /** The answer's handshape was looked up on its number key. */
  let peeked = $state(false);
  /** Set once the sum is over, while its answer is on screen. */
  let reveal = $state<'right' | 'skipped'>();
  let shake = $state(false);
  let nextTimer: ReturnType<typeof setTimeout> | undefined;

  const sum = $derived(round[index]);
  const answerId = $derived(sum ? String(sum.answer) : '');
  const clean = $derived(results.filter(firstTry).length);
  const signed = $derived(results.filter((r) => r.signed).length);
  const lastWrong = $derived(wrong[wrong.length - 1]);

  // How to sign a number, on its key: hover, keyboard focus, or press and hold,
  // as on Sign Five's letter keys. Any key can be looked at; looking at the
  // answer's own key is help, like "Show handshape".
  const peek = createPeek((sign) => {
    if (phase === 'playing' && !reveal && sign === answerId) peeked = true;
  });
  /**
   * Which way the palm faces for the answer. The pictures of 1 to 5 show the
   * palm, as the signer sees their own hand, but the camera wants the back of
   * the hand, so the picture alone sends the learner the wrong way round.
   */
  const palm = $derived(content.byId.get(answerId)?.palm);
  const palmNote = $derived(
    palm === 'toward you'
      ? 'Palm faces you. The camera sees the back of your hand.'
      : palm === 'out'
        ? 'Palm faces the camera.'
        : palm
          ? `Palm ${palm}.`
          : '',
  );

  onMount(() => {
    loadSettings();
  });
  onDestroy(() => clearTimeout(nextTimer));

  function start() {
    clearTimeout(nextTimer);
    round = makeRound(ROUND_LENGTH);
    index = 0;
    results = [];
    resetSum();
    phase = 'playing';
  }

  function resetSum() {
    wrong = [];
    shown = false;
    peeked = false;
    reveal = undefined;
    shake = false;
  }

  /** A number key was pressed. A press-and-hold that showed the number's tip isn't an answer. */
  function pressNumber(n: string) {
    if (peek.wasHold()) return;
    answer(n);
  }

  /** An answer from the camera or the number keys. */
  function answer(n: string, fromCamera = false) {
    if (phase !== 'playing' || reveal || !sum) return;
    if (n === answerId) {
      finishSum('right', fromCamera);
      return;
    }
    // The same wrong number again is not another miss: the camera may still be reading a held hand.
    if (wrong.includes(n)) return;
    wrong = [...wrong, n];
    if (wrong.length >= SHOW_AFTER) shown = true;
    shake = false;
    requestAnimationFrame(() => (shake = true));
  }

  function showHandshape() {
    shown = true;
  }

  function skip() {
    if (phase !== 'playing' || reveal) return;
    finishSum('skipped', false);
  }

  function finishSum(how: 'right' | 'skipped', fromCamera: boolean) {
    results = [...results, { sum, misses: wrong.length, helped: shown || peeked || how === 'skipped', signed: how === 'right' && fromCamera }];
    reveal = how;
    clearTimeout(nextTimer);
    nextTimer = setTimeout(next, how === 'right' ? RIGHT_MS : SKIPPED_MS);
  }

  function next() {
    clearTimeout(nextTimer);
    if (index + 1 >= round.length) {
      phase = 'done';
      return;
    }
    index++;
    resetSum();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') peek.hide();
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    if (phase === 'playing' && (e.key === 's' || e.key === 'S')) {
      skip();
    } else if (e.key === 'Enter' && phase !== 'playing') {
      e.preventDefault();
      start();
    }
  }

  /** What a finished sum is called in the list at the end. */
  function verdict(r: SumResult): string {
    if (firstTry(r)) return 'First try';
    if (r.misses) return `${r.misses} ${r.misses === 1 ? 'miss' : 'misses'}`;
    return 'With help';
  }
</script>

<svelte:window onkeydown={onKey} onscroll={peek.hide} />

<DrillPage kind="spell" title="Sign the answer" subtitle="Numbers 0 to 10 · {ROUND_LENGTH} sums a round" lists={false}>
  {#if phase === 'idle'}
    <div class="intro">
      <ol class="steps">
        <li><span>1</span>Turn on your camera and keep your hand in view.</li>
        <li><span>2</span>A sum appears. Sign the answer and hold it for about a second.</li>
        <li><span>3</span>Stuck? Hover over a number to see how to sign it, or tap the number instead.</li>
      </ol>
      <p class="small muted reminder">For 1 to 5 your palm faces you. For 6 to 9 it faces the camera.</p>
      <button class="primary lg" onclick={start}><Icon name="play" size={16} />Start <kbd>Enter</kbd></button>
    </div>
  {:else if phase === 'playing' && sum}
    <div class="stage">
      <div class="side">
        <div class="progress" aria-label="Sum {index + 1} of {round.length}">
          {#each round as _, i}
            <i class:done={i < results.length} class:clean={i < results.length && firstTry(results[i])} class:now={i === index && !reveal}></i>
          {/each}
        </div>

        <p class="sum" class:shake aria-label="{sumSpoken(sum)} equals what?" onanimationend={() => (shake = false)}>
          <span aria-hidden="true">{sumText(sum)} =</span>
          <span class="slot" class:right={reveal === 'right'} class:skipped={reveal === 'skipped'} aria-hidden="true">{reveal ? sum.answer : '?'}</span>
        </p>

        <p class="feedback" class:good={reveal === 'right'} aria-live="polite">
          {#if reveal === 'right'}
            Yes, {sum.answer}!
          {:else if reveal === 'skipped'}
            It's {sum.answer}. Here's how to sign it.
          {:else if lastWrong !== undefined}
            That was {lastWrong}. Try again.
          {:else}
            Sign the answer, or tap it.
          {/if}
        </p>

        {#if shown || reveal}
          <div class="how">
            <SignPicture id={answerId} size={112} {mirror} label="How to sign {sum.answer}" />
            {#if palmNote}<p class="small muted palm">{palmNote}</p>{/if}
          </div>
        {/if}

        <div class="pad" role="group" aria-label="Tap the answer">
          {#each ANSWERS as n}
            <button
              class="num"
              onclick={() => pressNumber(n)}
              onpointerenter={(e) => peek.hover(e, n)}
              onpointerleave={peek.hide}
              onpointerdown={(e) => peek.hold(e, n)}
              onpointerup={peek.release}
              onpointercancel={peek.release}
              oncontextmenu={(e) => e.preventDefault()}
              onfocus={(e) => peek.focus(e, n)}
              onblur={peek.hide}
              disabled={!!reveal || wrong.includes(n)}
              class:hit={!!reveal && n === answerId}
              aria-describedby={peek.current?.sign === n ? 'letter-tip' : undefined}
            >{n}</button>
          {/each}
        </div>

        <div class="button-row">
          <button class="ghost" onclick={showHandshape} disabled={shown || !!reveal}>Show handshape</button>
          <button onclick={skip} disabled={!!reveal}>Skip <kbd>S</kbd></button>
        </div>
      </div>

      <div class="cam-side">
        <LetterCam
          mode="numbers"
          autostart={settings?.showCameraByDefault ?? false}
          dominantHand={settings?.dominantHand}
          onLetter={(n) => answer(n, true)}
        />
      </div>
    </div>
  {:else}
    <div class="done">
      <div class="score" class:perfect={clean === results.length}>
        <span class="score-num">{clean}<small>/{results.length}</small></span>
        <span>right first try</span>
      </div>
      <p class="center verdict">{roundMessage(results)}</p>
      {#if signed}
        <p class="small muted center">You signed {signed} of {results.length} answers to the camera.</p>
      {/if}

      <ul class="recap">
        {#each results as r}
          <li class:clean={firstTry(r)}>
            <a class="recap-pic" href={routes.sign(String(r.sum.answer))} aria-label="How to sign {r.sum.answer}">
              <SignPicture id={String(r.sum.answer)} size={44} {mirror} />
            </a>
            <span class="recap-sum">{sumText(r.sum)} = <b>{r.sum.answer}</b></span>
            <span class="recap-verdict small">{verdict(r)}</span>
          </li>
        {/each}
      </ul>

      <div class="button-row">
        <a class="btn ghost" href={routes.signs}>Look up the numbers</a>
        <button class="primary" onclick={start}><Icon name="play" size={14} />Play again <kbd>Enter</kbd></button>
      </div>
    </div>
  {/if}

  {#if peek.current}
    <LetterTip sign={peek.current.sign} anchor={peek.current.rect} {mirror} />
  {/if}
</DrillPage>

<style>
  .intro { display: grid; justify-items: center; gap: 16px; padding: 24px 16px; }
  .reminder { margin: 0; text-align: center; }

  /* The sum on the left, the camera on the right. */
  .stage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; align-items: start; }
  .side { display: grid; gap: 14px; justify-items: center; }
  .side p { margin: 0; }
  .cam-side { display: grid; gap: 10px; }

  .progress { display: flex; gap: 5px; }
  .progress i { width: 18px; height: 5px; border-radius: 3px; background: var(--surface-3); }
  .progress i.done { background: var(--ink-3); }
  .progress i.clean { background: var(--good); }
  .progress i.now { background: var(--m); }

  .sum {
    display: flex; align-items: center; gap: 12px;
    font-size: clamp(2.2rem, 7vw, 3.2rem); font-weight: 750; line-height: 1; letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums; color: var(--ink);
  }
  .sum.shake { animation: shake 0.4s; }
  @keyframes shake {
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  .slot {
    display: grid; place-items: center; min-width: 1.5em; height: 1.5em; padding: 0 0.2em;
    border: 2px solid var(--m); border-radius: var(--radius); color: var(--m);
    box-shadow: 0 0 0 3px var(--m-soft); transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .slot.right { background: var(--good); border-color: var(--good); color: #fff; box-shadow: none; animation: pop 0.2s; }
  .slot.skipped { background: var(--surface-2); border-color: var(--line-strong); color: var(--ink-2); box-shadow: none; }
  @keyframes pop { 50% { transform: scale(1.12); } }

  .feedback { min-height: 1.5em; font-weight: 600; color: var(--ink-2); text-align: center; }
  .feedback.good { color: var(--good); }

  .how .palm { max-width: 200px; margin: 6px 0 2px; text-align: center; }
  .how {
    display: grid; place-items: center; padding: 8px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--paper);
  }

  .pad { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; width: min(100%, 340px); }
  /* Press and hold shows the number's tip, so don't let the phone select text or open a menu. */
  .num { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
  .num {
    min-height: 44px; padding: 0; justify-content: center;
    background: var(--surface-2); border-color: var(--line); font-weight: 700; font-size: 1rem; font-variant-numeric: tabular-nums;
  }
  .num.hit:disabled { opacity: 1; background: var(--good-soft); border-color: var(--good); color: var(--good); }
  .button-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }

  .done { display: grid; gap: 12px; justify-items: center; padding: 12px 0 4px; }
  .done p { margin: 0; }
  .score { display: grid; justify-items: center; gap: 2px; color: var(--ink-2); font-weight: 600; }
  .score-num { font-size: 3rem; font-weight: 750; line-height: 1; color: var(--m); font-variant-numeric: tabular-nums; }
  .score-num small { font-size: 1.4rem; color: var(--ink-3); }
  .score.perfect .score-num { color: var(--good); }
  .verdict { font-weight: 600; }
  .recap {
    list-style: none; margin: 4px 0; padding: 0; width: min(100%, 520px);
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px;
  }
  .recap li {
    display: flex; align-items: center; gap: 10px; padding: 6px 10px;
    border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface);
  }
  .recap li.clean { border-color: color-mix(in srgb, var(--good) 35%, var(--line)); background: var(--good-soft); }
  .recap-pic { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 6px; background: var(--paper); overflow: hidden; }
  .recap-sum { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .recap-verdict { color: var(--ink-3); white-space: nowrap; }
  .recap li.clean .recap-verdict { color: var(--good); }

  @media (prefers-reduced-motion: reduce) {
    .sum.shake, .slot.right { animation: none; }
  }
  @media (max-width: 760px) {
    .stage { grid-template-columns: 1fr; }
    /* The camera goes above the sum, so the video and the sum are on screen together and the number keys sit below. */
    .cam-side { order: -1; }
    .recap { grid-template-columns: 1fr; }
  }
</style>
