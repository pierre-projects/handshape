<script lang="ts">
  // Live camera check of one sign: its handshape and its movement, if it has
  // one: for J and Z the letter drawn in the air, for 10 the small shake. The finger a hint is about is picked out on the tracked
  // hand, and an optional guide hand shows the target shape over your own.
  // Video is processed on this device and never stored. On the local dev
  // server only, Details can save a sample of hand points for tuning.
  import { onDestroy } from 'svelte';
  import { computeFeatures, type Features } from '../lib/engine/features';
  import { judge, looksLike, SPECS, type Evaluation } from '../lib/engine/handshapes';
  import type { HandFrame, HandPart, Handedness } from '../lib/engine/hand';
  import { cameraSupported, clearOverlay, drawGuide, drawHand, drawTrail, HandTracker, problemMessage } from '../lib/engine/camera';
  import { guideHand, hasGuide } from '../lib/engine/guide';
  import { imagePalm, imagePoint, isMoveId, MOVES, REPEATS, RepeatTracker, StrokeTracker, thumbSide, type Pt } from '../lib/engine/movement';
  import { HoldTimer, Smoother, Steady } from '../lib/engine/tracker';
  import { content } from '../lib/content';

  let {
    target,
    autostart = false,
    dominantHand = 'Right',
    onMatch,
    fill = false,
    round = 0,
  }: {
    target: string;
    autostart?: boolean;
    dominantHand?: Handedness;
    onMatch?: () => void;
    /** Fill the parent's height, for full-screen practice. */
    fill?: boolean;
    /** Bump to ask for the same sign again (a doubled letter in a word). */
    round?: number;
  } = $props();

  type Status = 'off' | 'loading' | 'running' | 'error';
  let status = $state<Status>('off');
  let error = $state('');
  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();

  let handSeen = $state(false);
  let evaluation = $state<Evaluation>();
  let features = $state<Features>();
  let progress = $state(0);
  let matched = $state(false);
  let similar = $state<string[]>([]);
  let showDetails = $state(false);
  let saved = $state('');

  // The guide hand: the target sign drawn over your own hand. Remembered on this device.
  const GUIDE_KEY = 'asl.camera.guide';
  /** How long a sign must keep failing before the camera offers the guide. */
  const OFFER_GUIDE_MS = 4000;
  let guideOn = $state(readGuide());
  let offerGuide = $state(false);
  let failingSince: number | undefined;
  /** The parts of the hand the current hint is about. */
  let focus: HandPart[] = [];
  const canGuide = $derived(hasGuide(target));

  function readGuide(): boolean {
    try {
      return localStorage.getItem(GUIDE_KEY) === '1';
    } catch {
      return false;
    }
  }

  function setGuide(on: boolean) {
    guideOn = on;
    offerGuide = false;
    try {
      localStorage.setItem(GUIDE_KEY, on ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  }

  // J and Z: after the starting handshape is held, a fingertip is followed as it draws the letter.
  const move = $derived(isMoveId(target) ? MOVES[target] : undefined);
  let stroke: StrokeTracker | undefined;
  let trail: Pt[] = [];
  let movePhase = $state<'idle' | 'ready' | 'drawing'>('idle');
  let moveHint = $state<string>();
  let mirroredNote = $state(false);

  // 10: once the handshape is held, its small movement has to be made twice (a shake).
  const repeat = $derived(REPEATS[target]);
  let repeater: RepeatTracker | undefined;

  const smoother = new Smoother(0.5);
  const hold = new HoldTimer(600);
  type Message = { tone: string; text: string };
  /** The message on screen: it changes only once a new one has held for a moment, so it doesn't flicker as the hand wobbles. */
  const steady = new Steady<Message>(400, (a, b) => a.text === b.text && a.tone === b.tone);
  let shown = $state<Message>();
  /** Sample saving is for tuning on the local dev server; the live app leaves it out. */
  const RECORDING = import.meta.env.DEV;
  const recent: { frame: HandFrame; t: number }[] = [];
  const supported = cameraSupported;
  const tracker = new HandTracker(onFrame, () => dominantHand);
  const candidates = [...SPECS.keys()];
  const gloss = (id: string) => content.byId.get(id)?.gloss ?? id.toUpperCase();
  let frameCount = 0;

  // Start fresh whenever the target sign changes.
  $effect(() => {
    void target;
    void round;
    hold.reset();
    matched = false;
    progress = 0;
    similar = [];
    saved = '';
    failingSince = undefined;
    offerGuide = false;
    focus = [];
    steady.reset();
    shown = undefined;
    resetStroke();
  });

  function resetStroke() {
    stroke = move ? new StrokeTracker(move) : undefined;
    repeater = repeat ? new RepeatTracker(repeat.options) : undefined;
    trail = [];
    movePhase = 'idle';
    moveHint = undefined;
    mirroredNote = false;
  }

  $effect(() => {
    if (autostart && supported && status === 'off') start();
  });

  async function start() {
    error = '';
    status = 'loading';
    const result = await tracker.start();
    if (result !== 'ok') {
      status = 'error';
      error = problemMessage(result);
      return;
    }
    status = 'running';
  }

  $effect(() => {
    if (status === 'running' && video) return tracker.run(video);
  });

  function onFrame(frame: HandFrame | undefined, now: number) {
    if (!frame) {
      handSeen = false;
      smoother.reset();
      progress = hold.update(false, now);
      if (stroke && !matched) followStroke(undefined, false, now);
      repeater?.update(undefined, now);
      draw(undefined, false);
      settle(now);
      return;
    }
    handSeen = true;
    if (RECORDING) {
      recent.push({ frame, t: now });
      // About a second for a still sign; long enough to hold a whole drawn letter or a shake otherwise.
      if (recent.length > (move || repeat ? 100 : 30)) recent.shift();
    }
    const smooth = smoother.push(frame);
    features = computeFeatures(smooth);
    const j = judge(target, features, candidates);
    evaluation = j;
    focus = j.pass ? [] : j.focus;
    // Offer the guide once the same sign has kept failing for a while.
    if (j.pass || matched) failingSince = undefined;
    else failingSince ??= now;
    offerGuide = !guideOn && canGuide && failingSince !== undefined && now - failingSince >= OFFER_GUIDE_MS;
    if (j.rivals.length) similar = j.rivals.slice(0, 2);
    else if (!evaluation.pass && ++frameCount % 5 === 0) similar = looksLike(features, candidates, target).slice(0, 2);
    if (evaluation.pass) similar = [];
    if (stroke) {
      if (!matched) followStroke(smooth, evaluation.pass, now);
    } else if (repeater && repeat) {
      // Measured on the frame as the camera gave it: smoothing would flatten a quick shake.
      const st = repeater.update(evaluation.pass && !matched ? repeat.measure(frame) : undefined, now);
      if (!matched) progress = st.progress;
      if (st.matched && !matched) {
        matched = true;
        progress = 1;
        onMatch?.();
      }
    } else {
      progress = hold.update(evaluation.pass, now);
      if (progress >= 1 && !matched) {
        matched = true;
        onMatch?.();
      }
    }
    draw(smooth, evaluation.pass);
    settle(now);
  }

  /** Updates the message on screen. A match shows at once; anything else waits until it's steady. */
  function settle(now: number) {
    shown = steady.push(message, now, matched);
  }

  /** Feeds the drawing fingertip to the stroke tracker and matches when the letter is drawn. */
  function followStroke(frame: HandFrame | undefined, shapeOk: boolean, now: number) {
    if (!stroke || !move) return;
    const st = frame
      ? stroke.update(imagePoint(frame, move.tip), imagePalm(frame), shapeOk, thumbSide(frame), now)
      : stroke.update(undefined, 1, false, 0, now);
    trail = st.trail;
    movePhase = st.phase;
    moveHint = st.hint;
    progress = st.phase === 'drawing' ? Math.max(0.1, st.progress) : 0;
    if (st.matched) {
      matched = true;
      mirroredNote = st.matched.mirrored;
      progress = 1;
      onMatch?.();
    }
  }

  function draw(frame: HandFrame | undefined, ok: boolean) {
    const fix = frame && !ok && !matched ? focus : [];
    // The guide steps aside while a letter is being drawn and once the sign is made.
    const guide = guideOn && frame && !matched && movePhase !== 'drawing' ? guideHand(target, frame) : undefined;
    if (guide) {
      clearOverlay(canvas, video);
      drawGuide(canvas, video, guide, fix);
    }
    drawHand(canvas, video, frame, ok ? 'var(--cam-match)' : 'var(--cam-idle)', { clear: !guide, highlight: fix });
    if (move && (movePhase === 'drawing' || matched)) drawTrail(canvas, video, trail, matched ? 'var(--cam-match)' : 'var(--spell-glow)');
  }

  function stop() {
    tracker.stop();
    status = 'off';
    handSeen = false;
    evaluation = undefined;
    failingSince = undefined;
    offerGuide = false;
    smoother.reset();
    hold.reset();
    steady.reset();
    shown = undefined;
  }

  function again() {
    matched = false;
    hold.reset();
    progress = 0;
    resetStroke();
  }

  /** Downloads the last second of landmarks (about three for a drawn letter), labeled with the target sign, for tuning the rules. */
  function saveSample() {
    if (!recent.length) return;
    const data = {
      sign: target,
      ...(move || repeat ? { movement: true } : {}),
      note: 'Landmarks only, no video. Add to fixtures/handshapes/ to help tune the checks.',
      recordedAt: new Date().toISOString(),
      frames: recent.map(({ frame: f, t }) => ({
        t: Math.round(t - recent[0].t),
        handedness: f.handedness,
        aspect: f.aspect,
        image: f.image.map(({ x, y, z }) => [x, y, z].map((n) => Math.round(n * 1e5) / 1e5)),
        world: f.world.map(({ x, y, z }) => [x, y, z].map((n) => Math.round(n * 1e5) / 1e5)),
      })),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `${target}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    saved = 'Sample saved. It contains hand points only, no video.';
  }

  onDestroy(stop);

  const message = $derived.by((): Message => {
    if (!handSeen) return { tone: 'info', text: 'Hold your hand up in view of the camera.' };
    if (matched) {
      return { tone: 'good', text: `That's ${gloss(target)}.${mirroredNote ? ' Next time, draw it the other way round.' : ''}` };
    }
    if (!evaluation) return { tone: 'info', text: '' };
    if (move) {
      if (movePhase === 'drawing') return { tone: 'good', text: 'Keep going…' };
      if (movePhase === 'ready') return { tone: moveHint ? 'info' : 'good', text: moveHint ? `${moveHint} Try again.` : move.prompt };
      if (evaluation.pass) return { tone: 'good', text: moveHint ?? 'Hold it still…' };
    }
    if (repeat && evaluation.pass) return { tone: 'good', text: repeat.prompt };
    if (evaluation.pass) {
      return evaluation.unsure.length
        ? { tone: 'good', text: `Close. Check yourself: ${evaluation.unsure[0]}` }
        : { tone: 'good', text: 'Hold it…' };
    }
    const like = similar.length ? ` That looks like ${similar.map(gloss).join(' or ')}.` : '';
    return { tone: 'bad', text: `${evaluation.hint ?? ''}${like}` };
  });

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const display = $derived(shown ?? message);
  /** Signs with a movement the camera doesn't follow yet (10). Known from the sign itself, so the note doesn't pop in when a hand appears. */
  const unchecked = $derived(move || repeat ? undefined : SPECS.get(target)?.movement);
</script>

{#if !supported}
  <p class="small muted">Camera checking needs a secure (https) page and a browser with camera access.</p>
{:else if status === 'off' || status === 'error'}
  {#if fill}
    <div class="placeholder">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </svg>
      <p><strong>Turn on your camera</strong> and it will tell you when your handshape is right.</p>
      <button class="primary lg" onclick={start}>Turn on camera</button>
      <p class="small muted">Video stays on this device.</p>
      {#if error}<p class="small err" role="alert">{error}</p>{/if}
    </div>
  {:else}
    <div class="row">
      <button onclick={start}>Check with camera</button>
      <span class="small muted">The camera checks your handshape. Video stays on this device.</span>
    </div>
    {#if error}<p class="small" role="alert">{error}</p>{/if}
  {/if}
{:else}
  <div class="check" class:fill>
    <div class="view" class:matched>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted class="mirror"></video>
      <canvas bind:this={canvas} class="mirror" aria-hidden="true"></canvas>
      {#if status === 'loading'}
        <div class="overlay">Loading hand tracking… The first time downloads about 22 MB, then it works offline.</div>
      {/if}
      <div class="cam-tools">
        {#if canGuide}
          <button
            class="small"
            class:on={guideOn}
            onclick={() => setGuide(!guideOn)}
            aria-pressed={guideOn}
            title="Draw the handshape over your hand"
          >Guide</button>
        {/if}
        <button class="small" onclick={() => (showDetails = !showDetails)} aria-expanded={showDetails}>Details</button>
        <button class="small" onclick={stop}>Camera off</button>
      </div>
      {#if guideOn && canGuide && handSeen && !matched}
        <p class="legend small"><i class="key fix"></i>move this <i class="key goal"></i>to here</p>
      {/if}
      <div class="meter" style="--p: {progress}" class:done={matched} aria-hidden="true"></div>
      <div class="msg {display.tone}">
        <span aria-live="polite">{display.text}</span>
        {#if offerGuide && display.tone === 'bad'}
          <button class="small show-me" onclick={() => setGuide(true)}>Show me</button>
        {/if}
      </div>

      {#if showDetails && evaluation && fill}
        {@render details(true)}
      {/if}
    </div>

    {#if unchecked && !fill}
      <p class="small muted">Movement isn't checked yet. {unchecked}</p>
    {/if}

    {#if matched && !fill}
      <div class="row"><button class="small" onclick={again}>Try again</button></div>
    {/if}

    {#if showDetails && evaluation && !fill}
      {@render details(false)}
    {/if}
  </div>
{/if}

{#snippet details(floating: boolean)}
  {#if evaluation}
    <div class="details small" class:floating>
      <ul>
        {#each evaluation.results as r}
          <li class:pass={r.pass} class:fail={!r.pass && r.reliable} class:unsure={!r.pass && !r.reliable}>
            <span class="mark">{r.pass ? '✓' : r.reliable ? '✗' : '?'}</span>
            {r.pass ? r.id.replaceAll('-', ' ') : r.hint}
          </li>
        {/each}
      </ul>
      <p class="muted">? marks things the camera often can't see. They never block a match.</p>
      {#if features}
        <!-- What the camera measured, for tuning the checks against real hands. -->
        <p class="muted mono">
          bend {Object.values(features.curl).map(Math.round).join('/')} · joints
          {Object.values(features.tipBend).map(Math.round).join('/')} · straight
          {Object.values(features.reach).map(r2).join('/')} · spread
          {Object.values(features.spread).map(Math.round).join('/')} · thumb bend {Math.round(features.thumbBend)}° out
          {Math.round(features.thumbOut)}° across {r2(features.thumbAcross)} front {r2(features.thumbFront)} · palm
          {features.facing} · points {features.handDirection} · middle tilt {Math.round(features.middleAngle)}° · index raise
          {Math.round(features.mcpBend.middle - features.mcpBend.index)}° / {r2(features.tipHeight.index - features.tipHeight.middle)}
        </p>
      {/if}
      {#if RECORDING}
        <div class="row">
          <button class="small" onclick={saveSample}>Save sample</button>
          <span class="muted">Help tune the checks: {move ? `draw a correct ${gloss(target)}, then save.` : `hold a correct ${gloss(target)}, then save.`} It doesn't have to pass.</span>
        </div>
        {#if saved}<p role="status">{saved}</p>{/if}
      {/if}
    </div>
  {/if}
{/snippet}

<style>
  .check > * + * { margin-top: 10px; }
  .check.fill { height: 100%; }
  .view {
    container-type: inline-size;
    position: relative; border-radius: var(--radius); overflow: hidden; background: #000;
    aspect-ratio: 4 / 3; max-height: 380px; margin: 0 auto;
    outline: 4px solid transparent; outline-offset: -4px; transition: outline-color 0.2s;
  }
  .fill .view { aspect-ratio: auto; height: 100%; max-height: none; }
  .view.matched { outline-color: var(--cam-match); }
  .cam-tools { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 2; }
  .cam-tools button { background: rgb(0 0 0 / 0.55); color: #fff; border-color: rgb(255 255 255 / 0.25); backdrop-filter: blur(6px); }
  .cam-tools button:hover { background: rgb(0 0 0 / 0.75); }
  .cam-tools button.on { background: #fff; color: #111; border-color: #fff; }
  .legend {
    position: absolute; top: 10px; left: 10px; z-index: 2; margin: 0; padding: 5px 10px;
    display: flex; align-items: center; gap: 6px; border-radius: var(--radius-sm);
    background: rgb(0 0 0 / 0.55); color: #fff; backdrop-filter: blur(6px);
  }
  .key { width: 10px; height: 10px; border-radius: 50%; flex: none; }
  .key.fix { background: var(--cam-fix); }
  .key.goal { background: var(--cam-match); margin-left: 6px; }
  /* On a narrow camera view the buttons need the whole top row. */
  @container (max-width: 460px) { .legend { top: 50px; } }
  .placeholder {
    height: 100%; min-height: 260px; border-radius: var(--radius); border: 1px dashed var(--line-strong);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    padding: 24px; text-align: center; color: var(--ink-2); background: var(--surface);
  }
  .placeholder p { margin: 0; max-width: 34ch; }
  .placeholder svg { color: var(--accent); }
  .err { color: var(--bad); }
  .floating {
    position: absolute; top: 52px; right: 10px; left: 10px; max-height: calc(100% - 120px);
    overflow: auto; z-index: 2; box-shadow: var(--shadow-lift);
  }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .overlay {
    position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
    color: #fff; background: rgb(0 0 0 / 0.55); text-align: center; font-size: 0.9rem;
  }
  .meter {
    position: absolute; left: 0; bottom: 0; height: 6px;
    width: calc(var(--p) * 100%);
    background: var(--cam-match);
    transition: width 80ms linear;
  }
  .meter.done { height: 8px; }
  .msg {
    position: absolute; left: 10px; right: 10px; bottom: 16px; z-index: 2;
    display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 12px;
    margin: 0; padding: 8px 14px; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.925rem; text-align: center;
    backdrop-filter: blur(6px);
  }
  .msg:has(> span:empty:only-child) { display: none; }
  .show-me { background: #fff; color: #111; border-color: #fff; font-weight: 700; flex: none; }
  /* Phones: room for two lines always, so the box doesn't grow and shrink as the hint changes. */
  @media (max-width: 640px) {
    .msg { min-height: calc(2 * 1.35em + 16px); line-height: 1.35; font-size: 0.875rem; }
  }
  .msg.info { background: rgb(0 0 0 / 0.6); color: #fff; }
  .msg.good { background: rgb(35 130 77 / 0.92); color: #fff; }
  .msg.bad { background: rgb(160 50 36 / 0.9); color: #fff; }
  .details { background: var(--surface-2); border-radius: 10px; padding: 10px 14px; }
  .details ul { list-style: none; margin: 0 0 8px; padding: 0; }
  .details li { display: flex; gap: 8px; }
  .mark { width: 1em; font-weight: 700; }
  .pass .mark { color: var(--good); }
  .fail .mark { color: var(--bad); }
  .unsure .mark { color: var(--warn-ink); }
  .mono { font-variant-numeric: tabular-nums; }
</style>
