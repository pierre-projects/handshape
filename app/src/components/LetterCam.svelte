<script lang="ts">
  // Camera keyboard: reads whichever letter the hand makes and types it once it's
  // held steady, and types J and Z when they're drawn in the air. A thumbs up
  // held the same way is Enter, and a thumbs down is Delete. Fast movement,
  // unclear shapes and long holds don't type.
  import { onDestroy } from 'svelte';
  import { computeFeatures } from '../lib/engine/features';
  import { isCommand, type Command } from '../lib/engine/gestures';
  import type { HandFrame, Handedness } from '../lib/engine/hand';
  import { cameraSupported, drawHand, drawTrail, HandTracker, problemMessage } from '../lib/engine/camera';
  import type { MoveId, Pt } from '../lib/engine/movement';
  import { Smoother, Steady } from '../lib/engine/tracker';
  import { CameraTyper, isMoving, type TyperState } from '../lib/engine/reader';

  let {
    enabled = true,
    autostart = false,
    dominantHand = 'Right',
    letters = true,
    onLetter,
    onCommand,
    compact = false,
    confirmWord = '',
  }: {
    /** When false, nothing is read at all (game over). */
    enabled?: boolean;
    autostart?: boolean;
    dominantHand?: Handedness;
    /** When false, letters don't type but the Enter and Delete gestures still work (the row is full). */
    letters?: boolean;
    /** `replaces`: the still letter typed just before from the same handshape (I before J); swap it. */
    onLetter: (letter: string, opts?: { replaces?: string }) => void;
    /** Thumbs up (enter) or thumbs down (delete) was held. */
    onCommand?: (command: Command) => void;
    /** Phone layout: a slim strip with a small video, the status beside it. */
    compact?: boolean;
    /** The word a thumbs up would enter, shown large while the thumbs up is held. Empty when there's nothing to enter yet. */
    confirmWord?: string;
  } = $props();

  let status = $state<'off' | 'loading' | 'running' | 'error'>('off');
  let error = $state('');
  let video = $state<HTMLVideoElement>();
  let canvas = $state<HTMLCanvasElement>();
  let prevPoints: { x: number; y: number }[] | undefined;
  let prevTime = 0;

  let handSeen = $state(false);
  let moving = $state(false);
  let reading = $state<string>();
  let progress = $state(0);
  let waiting = $state(false);
  /** The held letter is a loose match, so it needs a longer hold. */
  let unsure = $state(false);
  let drawing = $state<MoveId>();
  let trail: Pt[] = [];
  let flash = $state<string>();
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const smoother = new Smoother(0.5);
  const typer = new CameraTyper();
  /** The message on screen: it changes only once a new one has held for a moment, so it doesn't flicker. */
  const steady = new Steady<string>(400);
  let shown = $state<string>();
  let typedNow = false;
  const supported = cameraSupported;
  const tracker = new HandTracker(onFrame, () => dominantHand);

  $effect(() => {
    if (autostart && supported && status === 'off') start();
  });

  // Pausing (row full, game over) forgets any half-held letter.
  $effect(() => {
    if (!enabled) {
      typer.reset();
      progress = 0;
      drawing = undefined;
      trail = [];
    }
  });

  async function start() {
    error = '';
    status = 'loading';
    const result = await tracker.start();
    if (result !== 'ok') {
      status = 'error';
      error = problemMessage(result, 'You can still type with the keyboard.');
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
      prevPoints = undefined;
      smoother.reset();
      if (enabled) apply(typer.update(undefined, undefined, false, now));
      draw(undefined);
      settle(now);
      return;
    }
    handSeen = true;
    moving = isMoving(prevPoints, frame.image, now - prevTime);
    prevPoints = frame.image;
    prevTime = now;
    const smooth = smoother.push(frame);
    if (enabled) apply(typer.update(smooth, computeFeatures(smooth), moving, now, { letters }));
    draw(smooth);
    settle(now);
  }

  /** Updates the message on screen. "Got it" after a typed letter shows at once; anything else waits until it's steady. */
  function settle(now: number) {
    shown = steady.push(message, now, typedNow);
    typedNow = false;
  }

  function apply(s: TyperState) {
    reading = s.letter;
    progress = s.progress;
    waiting = s.waitingForRelease;
    unsure = !!s.unsure;
    drawing = s.drawing;
    trail = s.trail;
    if (s.command) onCommand?.(s.command);
    else if (s.typed) onLetter(s.typed.toUpperCase(), s.replaces ? { replaces: s.replaces.toUpperCase() } : undefined);
    if (s.command || s.typed) {
      typedNow = true;
      flash = s.command ?? s.typed;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (flash = undefined), 500);
    }
  }

  /** What to show in the ring: the letter, or a key symbol for Enter and Delete. */
  const KEY: Record<Command, string> = { enter: '↵', delete: '⌫' };
  const label = (x: string | undefined) => (isCommand(x) ? KEY[x] : (x ?? '').toUpperCase());

  function draw(frame: HandFrame | undefined) {
    drawHand(canvas, video, frame, progress > 0 ? 'var(--spell-glow)' : 'rgba(255,255,255,0.85)', { joints: false });
    if (drawing) drawTrail(canvas, video, trail, 'var(--spell-glow)');
  }

  function stop() {
    tracker.stop();
    status = 'off';
    handSeen = false;
    typer.reset();
    smoother.reset();
    steady.reset();
    shown = undefined;
    drawing = undefined;
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
          ? 'Got it. Change shape or drop your hand.'
          : drawing
            ? `Drawing ${drawing.toUpperCase()}…`
            : moving
              ? 'Hold still…'
              : reading === 'enter'
                ? confirmWord
                  ? `Enter ${confirmWord}? Keep holding…`
                  : 'Thumbs up: hold to enter…'
                : reading === 'delete'
                  ? 'Thumbs down: hold to delete…'
                  : reading
                    ? unsure
                      ? `Hold ${reading.toUpperCase()} a little longer…`
                      : `Hold ${reading.toUpperCase()}…`
                    : letters
                      ? 'Make a letter'
                      : 'Thumbs up to enter, thumbs down to delete',
  );
  /** A thumbs up is being held over a full word: show the word at once, so it can be read before it enters. */
  const confirming = $derived(enabled && handSeen && !waiting && reading === 'enter' && !!confirmWord);
  /** The confirmation skips the usual settle time: the hold is short and the word must be seen during it. */
  const line = $derived(confirming ? message : (shown ?? message));
</script>

{#if !supported}
  <p class="small muted">Camera typing needs a secure (https) page. Use the keyboard instead.</p>
{:else if status === 'off' || status === 'error'}
  <div class="off" class:compact>
    <button class="primary" onclick={start}>Spell with camera</button>
    {#if !compact}<span class="small muted">Hold each letter for about a second to type it. Thumbs up enters, thumbs down deletes. Video stays on this device.</span>{/if}
    {#if error}<p class="small err" role="alert">{error}</p>{/if}
  </div>
{:else}
  <div class="wrap-cam" class:compact>
    <div class="cam">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} playsinline muted class="mirror"></video>
      <canvas bind:this={canvas} class="mirror" aria-hidden="true"></canvas>
      {#if status === 'loading'}
        <div class="overlay">{compact ? 'Loading…' : 'Loading hand tracking… The first time downloads about 22 MB.'}</div>
      {/if}
      {#if !compact}<button class="small off-btn" onclick={stop}>Camera off</button>{/if}
      <div class="reading" class:typed={!!flash} class:active={progress > 0} style="--p: {progress}" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" class="track" />
          <circle cx="32" cy="32" r="28" class="fill" pathLength="1" />
        </svg>
        <span>{label(flash ?? (waiting ? '' : reading))}</span>
      </div>
      {#if confirming && !compact}
        <div class="confirm" aria-hidden="true">
          <span>Enter this word?</span>
          <b>{confirmWord}</b>
        </div>
      {/if}
      {#if !compact}<p class="msg" aria-live="polite">{line}</p>{/if}
    </div>
    {#if compact}
      <div class="side-text">
        <p class="msg-line" aria-live="polite">{status === 'loading' ? 'Loading hand tracking…' : line}</p>
        <button class="ghost small" onclick={stop}>Camera off</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .off { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
  .off p { width: 100%; margin: 0; }
  .off.compact button { width: 100%; justify-content: center; }
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
  .reading .fill { stroke: var(--spell-glow); stroke-dasharray: 1; stroke-dashoffset: calc(1 - var(--p)); transition: stroke-dashoffset 80ms linear; }
  .reading span { position: relative; font-size: 2rem; font-weight: 750; }
  .reading.typed { background: var(--spell); transform: scale(1.12); }
  .confirm {
    position: absolute; inset: 0; z-index: 1;
    display: grid; place-content: center; justify-items: center; gap: 2px;
    background: rgb(0 0 0 / 0.5); color: #fff; text-align: center;
  }
  .confirm span { font-size: 0.85rem; font-weight: 600; opacity: 0.85; }
  .confirm b { font-size: clamp(2rem, 9vw, 3rem); font-weight: 750; letter-spacing: 0.14em; margin-right: -0.14em; line-height: 1.1; }
  /* Phone strip: small video on the left, what it's reading on the right. */
  .wrap-cam.compact { display: flex; align-items: center; gap: 12px; }
  .compact .cam { width: 112px; flex: none; max-height: none; border-radius: var(--radius-sm); }
  .compact .reading { top: auto; left: auto; right: 6px; bottom: 6px; width: 40px; height: 40px; }
  .compact .reading span { font-size: 1.15rem; }
  .compact .reading circle { stroke-width: 6; }
  /* The strip is always the same height, whatever the message says: on a phone the board is sized around it. */
  .wrap-cam.compact { height: 84px; }
  .side-text { display: grid; gap: 4px; justify-items: start; min-width: 0; }
  .msg-line {
    margin: 0; font-weight: 600; font-size: 0.875rem; line-height: 1.3; color: var(--ink);
    height: 2.6em; overflow: hidden;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
  }
  .msg {
    position: absolute; left: 10px; right: 10px; bottom: 10px; z-index: 2; margin: 0;
    padding: 6px 12px; border-radius: var(--radius-sm); text-align: center;
    background: rgb(0 0 0 / 0.6); color: #fff; font-weight: 600; font-size: 0.875rem;
  }
</style>
