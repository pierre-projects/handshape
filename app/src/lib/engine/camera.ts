// Camera and hand-tracking plumbing shared by the camera components: opening
// the front camera, loading the hand tracker, running it on each new video
// frame, and drawing the tracked hand. Each component keeps only what's its
// own (checking one target sign, reading any letter, recording a take).
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { HAND_CONNECTIONS, type HandFrame, type Handedness } from './hand';

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
 * element, keeping app.css the one place colours are defined.
 */
function resolveColor(el: Element, color: string): string {
  const m = color.match(/^var\((--[\w-]+)\)$/);
  if (!m) return color;
  return getComputedStyle(el).getPropertyValue(m[1]).trim() || '#ffffff';
}

/**
 * Draws the hand over the video, sized to match it. Clears the canvas when
 * there's no hand. `color` may be a CSS colour or `var(--token)`.
 */
export function drawHand(
  canvas: HTMLCanvasElement | undefined,
  video: HTMLVideoElement | undefined,
  frame: HandFrame | undefined,
  color: string,
  { joints = true }: { joints?: boolean } = {},
): void {
  if (!canvas || !video) return;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (!frame) return;
  const paint = resolveColor(canvas, color);
  ctx.lineWidth = Math.max(2, w / 200);
  ctx.strokeStyle = paint;
  ctx.fillStyle = paint;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(frame.image[a].x * w, frame.image[a].y * h);
    ctx.lineTo(frame.image[b].x * w, frame.image[b].y * h);
    ctx.stroke();
  }
  if (!joints) return;
  for (const p of frame.image) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, Math.max(3, w / 140), 0, Math.PI * 2);
    ctx.fill();
  }
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
