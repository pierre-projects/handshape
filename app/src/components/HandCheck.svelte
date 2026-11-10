<script lang="ts">
  // Live camera check of a static handshape. Video is processed on this
  // device and never stored, except a sample you choose to save yourself.
  import { onDestroy } from 'svelte';
  import { computeFeatures, type Features } from '../lib/engine/features';
  import { judge, looksLike, SPECS, type Evaluation } from '../lib/engine/handshapes';
  import type { HandFrame, Handedness } from '../lib/engine/hand';
  import { cameraSupported, drawHand, HandTracker, problemMessage } from '../lib/engine/camera';
  import { HoldTimer, Smoother } from '../lib/engine/tracker';
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

  const smoother = new Smoother(0.5);
  const hold = new HoldTimer(600);
  const recent: HandFrame[] = [];
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
  });

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
      draw(undefined, false);
      return;
    }
    handSeen = true;
    recent.push(frame);
    if (recent.length > 30) recent.shift();
    const smooth = smoother.push(frame);
    features = computeFeatures(smooth);
    const j = judge(target, features, candidates);
    evaluation = j;
    progress = hold.update(evaluation.pass, now);
    if (j.rivals.length) similar = j.rivals.slice(0, 2);
    else if (!evaluation.pass && ++frameCount % 5 === 0) similar = looksLike(features, candidates, target).slice(0, 2);
    if (evaluation.pass) similar = [];
    if (progress >= 1 && !matched) {
      matched = true;
      onMatch?.();
    }
    draw(smooth, evaluation.pass);
  }

  function draw(frame: HandFrame | undefined, ok: boolean) {
    drawHand(canvas, video, frame, ok ? 'var(--cam-match)' : 'var(--cam-idle)');
  }

  function stop() {
    tracker.stop();
    status = 'off';
    handSeen = false;
    evaluation = undefined;
    smoother.reset();
    hold.reset();
  }

  function again() {
    matched = false;
    hold.reset();
    progress = 0;
  }

  /** Downloads the last second of landmarks, labelled with the target sign, for tuning the rules. */
  function saveSample() {
    if (!recent.length) return;
    const data = {
      sign: target,
      note: 'Landmarks only, no video. Add to fixtures/handshapes/ to help tune the checks.',
      recordedAt: new Date().toISOString(),
      frames: recent.map((f) => ({
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

  const message = $derived.by(() => {
    if (!handSeen) return { tone: 'info', text: 'Hold your hand up in view of the camera.' };
    if (matched) return { tone: 'good', text: `That's ${gloss(target)}.` };
    if (!evaluation) return { tone: 'info', text: '' };
    if (evaluation.pass) {
      return evaluation.unsure.length
        ? { tone: 'good', text: `Close. Check yourself: ${evaluation.unsure[0]}` }
        : { tone: 'good', text: 'Hold it…' };
    }
    const like = similar.length ? ` That looks like ${similar.map(gloss).join(' or ')}.` : '';
    return { tone: 'bad', text: `${evaluation.hint ?? ''}${like}` };
  });

  const r2 = (n: number) => Math.round(n * 100) / 100;
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
        <button class="small" onclick={() => (showDetails = !showDetails)} aria-expanded={showDetails}>Details</button>
        <button class="small" onclick={stop}>Camera off</button>
      </div>
      <div class="meter" style="--p: {progress}" class:done={matched} aria-hidden="true"></div>
      <p class="msg {message.tone}" aria-live="polite">{message.text}</p>

      {#if showDetails && evaluation && fill}
        <div class="details small floating">
          <ul>
            {#each evaluation.results as r}
              <li class:pass={r.pass} class:fail={!r.pass && r.reliable} class:unsure={!r.pass && !r.reliable}>
                <span class="mark">{r.pass ? '✓' : r.reliable ? '✗' : '?'}</span>
                {r.pass ? r.id.replaceAll('-', ' ') : r.hint}
              </li>
            {/each}
          </ul>
          <p class="muted">? marks thumb positions the camera often can't see. They never block a match.</p>
        </div>
      {/if}
    </div>

    {#if evaluation?.movement && !fill}
      <p class="small muted">Movement isn't checked yet. {evaluation.movement}</p>
    {/if}

    {#if matched && !fill}
      <div class="row"><button class="small" onclick={again}>Try again</button></div>
    {/if}

    {#if showDetails && evaluation && !fill}
      <div class="details small">
        <ul>
          {#each evaluation.results as r}
            <li class:pass={r.pass} class:fail={!r.pass && r.reliable} class:unsure={!r.pass && !r.reliable}>
              <span class="mark">{r.pass ? '✓' : r.reliable ? '✗' : '?'}</span>
              {r.pass ? r.id.replaceAll('-', ' ') : r.hint}
            </li>
          {/each}
        </ul>
        {#if features}
          <p class="muted mono">
            curl {Object.values(features.curl).map(Math.round).join('/')} · spread
            {Object.values(features.spread).map(Math.round).join('/')} · thumb across {r2(features.thumbAcross)} front
            {r2(features.thumbFront)} · palm {features.facing} · points {features.handDirection}
          </p>
        {/if}
        <p class="muted">? marks thumb positions the camera often can't see. They never block a match.</p>
        <div class="row">
          <button class="small" onclick={saveSample}>Save sample</button>
          <span class="muted">Help tune the checks: save a sample of a correct {gloss(target)}.</span>
        </div>
        {#if saved}<p role="status">{saved}</p>{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .check > * + * { margin-top: 10px; }
  .check.fill { height: 100%; }
  .view {
    position: relative; border-radius: var(--radius); overflow: hidden; background: #000;
    aspect-ratio: 4 / 3; max-height: 380px; margin: 0 auto;
    outline: 4px solid transparent; outline-offset: -4px; transition: outline-color 0.2s;
  }
  .fill .view { aspect-ratio: auto; height: 100%; max-height: none; }
  .view.matched { outline-color: var(--cam-match); }
  .cam-tools { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 2; }
  .cam-tools button { background: rgb(0 0 0 / 0.55); color: #fff; border-color: rgb(255 255 255 / 0.25); backdrop-filter: blur(6px); }
  .cam-tools button:hover { background: rgb(0 0 0 / 0.75); }
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
    margin: 0; padding: 8px 14px; border-radius: var(--radius-sm); font-weight: 600; font-size: 0.925rem; text-align: center;
    backdrop-filter: blur(6px);
  }
  .msg:empty { display: none; }
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
