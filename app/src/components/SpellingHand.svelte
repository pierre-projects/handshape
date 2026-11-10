<script lang="ts">
  // The moving hand: a drawn model hand that flows from letter to letter while
  // a word is spelled. It follows the clock it is given (`startAt`), so it stays
  // in step with the player's progress ticks.
  import { onMount } from 'svelte';
  import { canvasColor, paintHand } from '../lib/engine/camera';
  import { backFacesCamera } from '../lib/engine/guide';
  import { handAt } from '../lib/engine/handAnimation';
  import type { Handedness } from '../lib/engine/hand';

  let {
    ids,
    speed,
    startAt,
    hand = 'Right',
  }: {
    /** Content item ids to spell: "c", "a", "t". */
    ids: string[];
    /** Letters per second. */
    speed: number;
    /** When spelling began, on the performance.now() clock. Before it is set, the hand rests in the first letter. */
    startAt?: number;
    hand?: Handedness;
  } = $props();

  let canvas = $state<HTMLCanvasElement>();

  /**
   * How much of the model the canvas shows, top to bottom, in metres: room for
   * the longest finger above the wrist and for P and Q hanging below it.
   */
  const SPAN_M = 0.3;
  const PALM_M = 0.088;

  /** Paints the hand as it is `tMs` into the word. Exported so a single moment can be drawn without the clock. */
  export function paint(tMs: number) {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr) || 600;
    const h = Math.round(canvas.clientHeight * dpr) || 520;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    const moment = handAt(ids, speed, tMs, hand);
    if (!moment) return;
    // Height decides the size; a narrow phone screen only matters once it is narrower than the hand is tall.
    const scale = Math.min(h / SPAN_M, w / (SPAN_M * 0.9));
    const cx = w / 2;
    const cy = h * 0.62;
    paintHand(ctx, moment.points.map((p) => ({ x: cx + p.x * scale, y: cy + p.y * scale, z: p.z })), PALM_M * scale, {
      back: backFacesCamera(moment.points, hand),
      skin: canvasColor(canvas, 'var(--skin)'),
      edge: canvasColor(canvas, 'var(--skin-line)'),
    });
  }

  onMount(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      paint(startAt === undefined ? 0 : performance.now() - startAt);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { display: block; width: 100%; height: 100%; }
</style>
