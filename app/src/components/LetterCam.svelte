<script lang="ts">
  // Camera keyboard: reads whichever letter the hand makes and types it once it's
  // held steady. Fast movement, unclear shapes and long holds don't type.
  import { onDestroy } from 'svelte';
  import type { HandLandmarker } from '@mediapipe/tasks-vision';
  import { computeFeatures } from '../lib/engine/features';
  import { HAND_CONNECTIONS, type HandFrame, type Handedness } from '../lib/engine/hand';
  import { Smoother } from '../lib/engine/tracker';
  import { classifyLetter, handMotion, LetterReader } from '../lib/engine/reader';

  let {
    enabled = true,
    autostart = false,
    dominantHand = 'Right',
    onLetter,
  }: {
    /** When false, nothing types (row full, game over). */
    enabled?: boolean;
    autostart?: boolean;
    dominantHand?: Handedness;
    onLetter: (letter: string) => void;
  } = $props();

  /** Above this, the hand is moving between letters. */
  const MOTION_LIMIT = 0.06;

  let status = $state<'off' | 'loading' | 'running' | 'error'>('off');
  let error = $state('');
  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();
  let stream: MediaStream | undefined;
  let landmarker: HandLandmarker | undefined;
  let detect: typeof import('../lib/engine/landmarker').detectHand | undefined;
  let raf = 0;
  let lastVideoTime = -1;
  let prevPoints: { x: number; y: number }[] | undefined;

  let handSeen = $state(false);
  let moving = $state(false);
  let reading = $state<string>();
  let progress = $state(0);
  let waiting = $state(false);
  let flash = $state<string>();
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const smoother = new Smoother(0.5);
  const reader = new LetterReader();
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  $effect(() => {
    if (autostart && supported && status === 'off') start();
  });

  // Pausing (row full, game over) forgets any half-held letter.
  $effect(() => {
    if (!enabled) {
      reader.reset();
      progress = 0;
    }
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
          ? 'Camera permission was denied. You can still type with the keyboard.'
          : 'Could not start the camera. You can still type with the keyboard.';
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
    if (!video || !landmarker || !detect || video.readyState < 2 || video.currentTime === lastVideoTime) return;
    lastVideoTime = video.currentTime;
    const now = performance.now();
    let frame: HandFrame | undefined;
    try {
      frame = detect(landmarker, video, now, dominantHand);
    } catch {
      return;
    }
    if (!frame) {
      handSeen = false;
      prevPoints = undefined;
      smoother.reset();
      step(undefined, now);
      draw(undefined);
      return;
    }
    handSeen = true;
    moving = handMotion(prevPoints, frame.image) > MOTION_LIMIT;
    prevPoints = frame.image;
    const smooth = smoother.push(frame);
    const letter = moving ? undefined : classifyLetter(computeFeatures(smooth));
    step(letter, now);
    draw(smooth);
  }

  function step(letter: string | undefined, now: number) {
    if (!enabled) {
      reading = letter;
      progress = 0;
      waiting = false;
      return;
    }
    const s = reader.update(letter, now);
    reading = s.letter;
    progress = s.progress;
    waiting = s.waitingForRelease;
    if (s.typed) {
      onLetter(s.typed.toUpperCase());
      flash = s.typed;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = undefined), 500);
    }
  }

  function draw(frame: HandFrame | undefined) {
    if (!canvas || !video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    if (!frame) return;
    const color = progress > 0 ? '#a78bfa' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, w / 200);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(frame.image[a].x * w, frame.image[a].y * h);
      ctx.lineTo(frame.image[b].x * w, frame.image[b].y * h);
      ctx.stroke();
    }
  }

  function stop() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
    status = 'off';
    handSeen = false;
    reader.reset();
    smoother.reset();
    progress = 0;
  }

  onDestroy(() => {
    stop();
    clearTimeout(flashTimer);
  });

  const message = $derived(
    !enabled
      ? 'Paused'
      : !handSeen
        ? 'Hold your hand up to the camera'
        : waiting
          ? 'Got it. Change shape or drop your hand for the next letter.'
          : moving
            ? 'Hold still…'
            : reading
              ? `Hold ${reading.toUpperCase()}…`
              : 'Make a letter',
  );
</script>

{#if !supported}
  <p class="small muted">Camera typing needs a secure (https) page. Use the keyboard below instead.</p>
{:else if status === 'off' || status === 'error'}
  <div class="off">
    <button class="primary" onclick={start}>Spell with camera</button>
    <span class="small muted">Hold each letter for about a second to type it. Video stays on this device.</span>
    {#if error}<p class="small err" role="alert">{error}</p>{/if}
  </div>
{:else}
  <div class="cam">
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted class="mirror"></video>
    <canvas bind:this={canvas} class="mirror" aria-hidden="true"></canvas>
    {#if status === 'loading'}
      <div class="overlay">Loading hand tracking… The first time downloads about 22 MB.</div>
    {/if}
    <button class="small off-btn" onclick={stop}>Camera off</button>

    <div class="reading" class:typed={!!flash} class:active={progress > 0} style="--p: {progress}" aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" class="track" />
        <circle cx="32" cy="32" r="28" class="fill" pathLength="1" />
      </svg>
      <span>{(flash ?? (waiting ? '' : reading) ?? '').toUpperCase()}</span>
    </div>
    <p class="msg" aria-live="polite">{message}</p>
  </div>
{/if}

<style>
  .off { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .off p { width: 100%; margin: 0; }
  .err { color: var(--bad); }
  .cam {
    position: relative;
    aspect-ratio: 4 / 3;
    max-height: 300px;
    width: 100%;
    margin: 0 auto;
    border-radius: var(--radius);
    overflow: hidden;
    background: #000;
  }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .overlay {
    position: absolute; inset: 0; display: grid; place-items: center; padding: 16px;
    color: #fff; background: rgb(0 0 0 / 0.55); text-align: center; font-size: 0.9rem;
  }
  .off-btn {
    position: absolute; top: 10px; right: 10px; z-index: 2;
    background: rgb(0 0 0 / 0.55); color: #fff; border-color: rgb(255 255 255 / 0.25);
  }
  .reading {
    position: absolute; top: 10px; left: 10px; z-index: 2;
    width: 72px; height: 72px; display: grid; place-items: center;
    border-radius: 50%; background: rgb(0 0 0 / 0.55); color: #fff;
    transition: transform 0.15s, background 0.15s;
  }
  .reading svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  .reading circle { fill: none; stroke-width: 5; }
  .reading .track { stroke: rgb(255 255 255 / 0.2); }
  .reading .fill { stroke: #a78bfa; stroke-dasharray: 1; stroke-dashoffset: calc(1 - var(--p)); transition: stroke-dashoffset 80ms linear; }
  .reading span { position: relative; font-size: 2rem; font-weight: 750; }
  .reading.typed { background: #6d28d9; transform: scale(1.12); }
  .msg {
    position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 2; margin: 0;
    padding: 6px 12px; border-radius: var(--radius-sm); text-align: center;
    background: rgb(0 0 0 / 0.6); color: #fff; font-weight: 600; font-size: 0.875rem;
  }
</style>
