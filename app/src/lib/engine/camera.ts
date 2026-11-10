// Camera and hand-tracking plumbing shared by the camera components: opening
// the front camera, loading the hand tracker, running it on each new video
// frame, and drawing the tracked hand. Each component keeps only what's its
// own (checking one target sign, reading any letter, recording a take).
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS, PALM_OUTLINE, PART_POINTS, type HandFrame, type HandPart, type Handedness } from './hand';

export const cameraSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

export type CameraProblem = 'denied' | 'unavailable' | 'tracking';

/** Opens the front camera, or says why it couldn't. */
export async function openCamera(ideal?: { width: number; height: number }): Promise<MediaStream | CameraProblem> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', ...(ideal ? { width: { ideal: ideal.width }, height: { ideal: ideal.height } } : {}) },
      audio: false,
    });
  } catch (e) {
    return e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable';
  }
}

export function stopStream(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * What to tell the learner. `next` says what they can do instead (e.g. "You
 * can still type with the keyboard."); without it, a denied camera points to
 * the browser settings.
 */
export function problemMessage(problem: CameraProblem, next = ''): string {
  const base = {
    denied: 'Camera permission was denied.',
    unavailable: 'Could not start the camera.',
    tracking: 'Hand tracking could not load in this browser.',
  }[problem];
  const hint = next || (problem === 'denied' ? 'You can allow it in your browser settings.' : '');
  return hint ? `${base} ${hint}` : base;
}

/**
 * The camera plus the hand tracker. `start()` opens the camera and loads the
 * tracker (downloaded the first time, then cached). `run(video)` shows the
 * camera in the video element and calls `onFrame` with the tracked hand (or
 * undefined) for each new frame, until the function it returns is called.
 */
export class HandTracker {
  private stream?: MediaStream;
  private landmarker?: HandLandmarker;
  private detect?: typeof import('./landmarker').detectHand;

  constructor(
    private onFrame: (frame: HandFrame | undefined, now: number) => void,
    private preferredHand: () => Handedness,
  ) {}

  async start(): Promise<'ok' | CameraProblem> {
    const stream = await openCamera({ width: 640, height: 480 });
    if (typeof stream === 'string') return stream;
    this.stream = stream;
    try {
      // Loaded on demand so the tracker (about 22 MB) isn't part of the first page load.
      const m = await import('./landmarker');
      this.detect = m.detectHand;
      this.landmarker = await m.loadHandLandmarker();
    } catch {
      this.stop();
      return 'tracking';
    }
    return 'ok';
  }

  run(video: HTMLVideoElement): () => void {
    if (!this.stream) return () => {};
    video.srcObject = this.stream;
    video.play().catch(() => {});
    let raf = 0;
    let lastTime = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!this.landmarker || !this.detect || video.readyState < 2 || video.currentTime === lastTime) return;
      lastTime = video.currentTime;
      const now = performance.now();
      let frame: HandFrame | undefined;
      try {
        frame = this.detect(this.landmarker, video, now, this.preferredHand());
      } catch {
        return;
      }
      this.onFrame(frame, now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }

  stop(): void {
    stopStream(this.stream);
    this.stream = undefined;
  }
}

/**
 * A canvas can't use CSS variables, so `var(--name)` is looked up on the
 * element, keeping app.css the one place colors are defined.
 */
function resolveColor(el: Element, color: string): string {
  const m = color.match(/^var\((--[\w-]+)\)$/);
  if (!m) return color;
  return getComputedStyle(el).getPropertyValue(m[1]).trim() || '#ffffff';
}

/** Sizes the canvas to the video and wipes it. Returns the context to draw on. */
export function clearOverlay(
  canvas: HTMLCanvasElement | undefined,
  video: HTMLVideoElement | undefined,
): CanvasRenderingContext2D | undefined {
  if (!canvas || !video) return undefined;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d') ?? undefined;
  ctx?.clearRect(0, 0, w, h);
  return ctx;
}

/** Traces a line through the given points of a hand, as pixels. `close` joins the end back to the start. */
function tracePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], ids: number[], w: number, h: number, close = false): void {
  ctx.beginPath();
  ids.forEach((id, i) => (i ? ctx.lineTo(pts[id].x * w, pts[id].y * h) : ctx.moveTo(pts[id].x * w, pts[id].y * h)));
  if (close) ctx.closePath();
}

/**
 * Draws the hand over the video, sized to match it. Clears the canvas first
 * unless `clear` is false (something was drawn under it), and leaves it clear
 * when there's no hand. `highlight` picks out the parts feedback is about, in
 * the "fix this" color. Colors may be CSS colors or `var(--token)`.
 */
export function drawHand(
  canvas: HTMLCanvasElement | undefined,
  video: HTMLVideoElement | undefined,
  frame: HandFrame | undefined,
  color: string,
  { joints = true, clear = true, highlight = [] }: { joints?: boolean; clear?: boolean; highlight?: HandPart[] } = {},
): void {
  if (!canvas || !video) return;
  const ctx = clear ? clearOverlay(canvas, video) : (canvas.getContext('2d') ?? undefined);
  if (!ctx || !frame) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  const paint = resolveColor(canvas, color);
  const line = Math.max(2, w / 200);
  const dot = Math.max(3, w / 140);
  ctx.lineWidth = line;
  ctx.strokeStyle = paint;
  ctx.fillStyle = paint;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(frame.image[a].x * w, frame.image[a].y * h);
    ctx.lineTo(frame.image[b].x * w, frame.image[b].y * h);
    ctx.stroke();
  }
  if (joints) {
    for (const p of frame.image) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (!highlight.length) return;
  const fix = resolveColor(canvas, 'var(--cam-fix)');
  ctx.save();
  ctx.strokeStyle = fix;
  ctx.fillStyle = fix;
  ctx.lineWidth = line * 2.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const part of highlight) {
    if (part === 'hand') {
      tracePath(ctx, frame.image, PALM_OUTLINE, w, h, true);
      ctx.stroke();
      continue;
    }
    tracePath(ctx, frame.image, PART_POINTS[part], w, h);
    ctx.stroke();
    for (const id of PART_POINTS[part]) {
      ctx.beginPath();
      ctx.arc(frame.image[id].x * w, frame.image[id].y * h, dot * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let guideLayer: HTMLCanvasElement | undefined;

/**
 * Draws the guide hand (see guide.ts): the target sign as a pale, solid hand
 * with a dark edge, see-through so the learner's own hand shows under it. Nearer
 * fingers cover farther ones. `focus` paints the parts feedback is about in the
 * "match" color, as the place to move to. Call after clearOverlay and before
 * drawHand(…, { clear: false }).
 */
export function drawGuide(
  canvas: HTMLCanvasElement | undefined,
  video: HTMLVideoElement | undefined,
  guide: { points: { x: number; y: number; z: number }[]; palm: number; back?: boolean },
  focus: HandPart[] = [],
): void {
  if (!canvas || !video) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  // Painted solid on a spare canvas, then laid over the video half see-through,
  // so overlapping fingers don't add up to darker patches.
  guideLayer ??= document.createElement('canvas');
  if (guideLayer.width !== w) guideLayer.width = w;
  if (guideLayer.height !== h) guideLayer.height = h;
  const g = guideLayer.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  paintHand(g, guide.points.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z })), guide.palm * h, {
    back: guide.back,
    focus,
    skin: resolveColor(canvas, 'var(--cam-guide)'),
    edge: resolveColor(canvas, 'var(--cam-guide-edge)'),
    target: resolveColor(canvas, 'var(--cam-match)'),
  });

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(guideLayer, 0, 0);
  ctx.restore();
}

/** Looks up a color token (`var(--name)`) on an element, for painting on a canvas. */
export const canvasColor = resolveColor;

/**
 * Paints a model hand as a solid drawn hand: a filled palm and thick rounded
 * fingers with a dark edge, nearer parts over farther ones. Points are in
 * canvas pixels, with z as depth (smaller is nearer). `palm` is the palm's
 * length in pixels, which sets how thick the fingers are. Used by the camera
 * guide and by the moving hand in the reading drill.
 */
export function paintHand(
  g: CanvasRenderingContext2D,
  points: { x: number; y: number; z: number }[],
  palm: number,
  { back = false, focus = [], skin, edge, target = skin }: { back?: boolean; focus?: HandPart[]; skin: string; edge: string; target?: string },
): void {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const thick = palm * 0.2;
  const rim = Math.max(1.5, thick * 0.12);
  const depth = (ids: number[]) => ids.reduce((sum, id) => sum + points[id].z, 0) / ids.length;

  type Piece = { ids: number[]; z: number; palm: boolean; width: number; color: string };
  const pieces: Piece[] = [
    { ids: PALM_OUTLINE, z: depth(PALM_OUTLINE), palm: true, width: thick * 0.7, color: focus.includes('hand') ? target : skin },
    ...(Object.keys(PART_POINTS) as (keyof typeof PART_POINTS)[]).map((part) => ({
      ids: PART_POINTS[part],
      z: depth(PART_POINTS[part]),
      palm: false,
      width: part === 'thumb' ? thick * 1.1 : thick,
      color: focus.includes(part) ? target : skin,
    })),
  ];
  // Farthest first, so nearer parts are painted over them.
  pieces.sort((a, b) => b.z - a.z);
  for (const p of pieces) {
    tracePath(g, points, p.ids, 1, 1, p.palm);
    g.strokeStyle = edge;
    g.lineWidth = p.width + rim * 2;
    g.stroke();
    g.strokeStyle = p.color;
    g.fillStyle = p.color;
    g.lineWidth = p.width;
    if (p.palm) g.fill();
    g.stroke();
    if (p.palm || !back) continue;
    // A fingernail on each finger says "this is the back of the hand" at a glance.
    const a = points[p.ids[2]];
    const b = points[p.ids[3]];
    g.beginPath();
    g.moveTo(a.x + (b.x - a.x) * 0.5, a.y + (b.y - a.y) * 0.5);
    g.lineTo(b.x, b.y);
    g.strokeStyle = edge;
    g.globalAlpha = 0.3;
    g.lineWidth = p.width * 0.55;
    g.stroke();
    g.globalAlpha = 1;
  }
  g.restore();
}

/**
 * Draws a fingertip's trail (see movement.ts) on top of the hand. Points are in
 * picture units with x already multiplied by the aspect ratio. Call after
 * drawHand, which clears the canvas.
 */
export function drawTrail(
  canvas: HTMLCanvasElement | undefined,
  video: HTMLVideoElement | undefined,
  points: { x: number; y: number }[],
  color: string,
): void {
  if (!canvas || !video || points.length < 2) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const h = video.videoHeight;
  ctx.save();
  ctx.strokeStyle = resolveColor(canvas, color);
  ctx.lineWidth = Math.max(5, video.videoWidth / 90);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // x was scaled by width/height, so multiplying by the height gives pixels.
  ctx.moveTo(points[0].x * h, points[0].y * h);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * h, points[i].y * h);
  ctx.stroke();
  ctx.restore();
}
