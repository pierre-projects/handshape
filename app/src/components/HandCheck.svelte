<script lang="ts">
  // Live camera check of a static handshape. Video is processed on this
  // device and never stored, except a sample you choose to save yourself.
  import { onDestroy } from 'svelte';
  import type { HandLandmarker } from '@mediapipe/tasks-vision';
  import { computeFeatures, type Features } from '../lib/engine/features';
  import { evaluate, looksLike, SPECS, type Evaluation } from '../lib/engine/handshapes';
  import { HAND_CONNECTIONS, type HandFrame, type Handedness } from '../lib/engine/hand';
  import { HoldTimer, Smoother } from '../lib/engine/tracker';
  import { content } from '../lib/content';

  let {
    target,
    autostart = false,
    dominantHand = 'Right',
    onMatch,
  }: {
    target: string;
    autostart?: boolean;
    dominantHand?: Handedness;
    onMatch?: () => void;
  } = $props();

  type Status = 'off' | 'loading' | 'running' | 'error';
  let status = $state<Status>('off');
  let error = $state('');
  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();
  let stream: MediaStream | undefined;
  let landmarker: HandLandmarker | undefined;
  let detect: typeof import('../lib/engine/landmarker').detectHand | undefined;
  let raf = 0;
  let lastVideoTime = -1;

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
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const candidates = [...SPECS.keys()];
  const gloss = (id: string) => content.byId.get(id)?.gloss ?? id.toUpperCase();
  let frameCount = 0;

  // Start fresh whenever the target sign changes.
  $effect(() => {
    void target;
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
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (e) {
      status = 'error';
      error =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can allow it in your browser settings.'
          : 'Could not start the camera.';
      return;
    }
    try {
      const m = await import('../lib/engine/landmarker');
      detect = m.detectHand;
      landmarker = await m.loadHandLandmarker();
    } catch {
      stop();
      status = 'error';
      error = 'Hand tracking could not load in this browser.';
      return;
    }
    status = 'running';
  }

  $effect(() => {
    if (status === 'running' && video && stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
  });

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!video || !landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const now = performance.now();
    let frame: HandFrame | undefined;
    try {
      frame = detectSafe(now);
    } catch {
      return;
    }
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
    evaluation = evaluate(target, features);
    progress = hold.update(evaluation.pass, now);
    if (!evaluation.pass && ++frameCount % 5 === 0) similar = looksLike(features, candidates, target).slice(0, 2);
    if (evaluation.pass) similar = [];
    if (progress >= 1 && !matched) {
      matched = true;
      onMatch?.();
    }
    draw(smooth, evaluation.pass);
  }

  function detectSafe(now: number): HandFrame | undefined {
    if (!detect || !landmarker || !video) return undefined;
    return detect(landmarker, video, now, dominantHand);
  }

  function draw(frame: HandFrame | undefined, ok: boolean) {
    if (!canvas || !video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!frame) return;
    const color = ok ? '#2fbf71' : '#f2f2f2';
    ctx.lineWidth = Math.max(2, w / 200);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(frame.image[a].x * w, frame.image[a].y * h);
      ctx.lineTo(frame.image[b].x * w, frame.image[b].y * h);
      ctx.stroke();
    }
    for (const p of frame.image) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, Math.max(3, w / 140), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
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
  <div class="row">
    <button onclick={start}>Check with camera</button>
    <span class="small muted">The camera checks your handshape. Video stays on this device.</span>
  </div>
  {#if error}<p class="small" role="alert">{error}</p>{/if}
{:else}
  <div class="check">
    <div class="view">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted class="mirror"></video>
      <canvas bind:this={canvas} class="mirror" aria-hidden="true"></canvas>
      {#if status === 'loading'}
        <div class="overlay">Loading hand tracking… The first time downloads about 22 MB, then it works offline.</div>
      {/if}
      <div class="meter" style="--p: {progress}" class:done={matched} aria-hidden="true"></div>
    </div>

    <p class="msg {message.tone}" aria-live="polite">{message.text}</p>
    {#if evaluation?.movement}
      <p class="small muted">Movement isn't checked yet. {evaluation.movement}</p>
    {/if}

    <div class="row">
      {#if matched}<button class="small" onclick={again}>Try again</button>{/if}
      <button class="small" onclick={() => (showDetails = !showDetails)} aria-expanded={showDetails}>Details</button>
      <button class="small" onclick={stop}>Camera off</button>
    </div>

    {#if showDetails && evaluation}
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
  .view { position: relative; border-radius: 10px; overflow: hidden; background: #000; aspect-ratio: 4 / 3; max-height: 360px; margin: 0 auto; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .overlay {
    position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
    color: #fff; background: rgb(0 0 0 / 0.55); text-align: center; font-size: 0.9rem;
  }
  .meter {
    position: absolute; left: 0; bottom: 0; height: 6px;
    width: calc(var(--p) * 100%);
    background: #2fbf71;
    transition: width 80ms linear;
  }
  .meter.done { height: 8px; }
  .msg { margin: 0; padding: 10px 14px; border-radius: 10px; font-weight: 600; min-height: 1.5em; }
  .msg.info { background: var(--surface-2); color: var(--ink-2); }
  .msg.good { background: var(--good-soft); color: var(--good); }
  .msg.bad { background: var(--bad-soft); color: var(--bad); }
  .details { background: var(--surface-2); border-radius: 10px; padding: 10px 14px; }
  .details ul { list-style: none; margin: 0 0 8px; padding: 0; }
  .details li { display: flex; gap: 8px; }
  .mark { width: 1em; font-weight: 700; }
  .pass .mark { color: var(--good); }
  .fail .mark { color: var(--bad); }
  .unsure .mark { color: var(--warn-ink); }
  .mono { font-variant-numeric: tabular-nums; }
</style>
