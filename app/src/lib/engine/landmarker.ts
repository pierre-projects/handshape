// Browser-only: loads MediaPipe Hand Landmarker from files bundled with the app.
// Video frames are processed on this device; nothing is sent anywhere.
import { HandLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import modelAssetPath from '../../../../models/hand_landmarker.task?url';
import type { HandFrame, Handedness } from './hand';

let instance: Promise<HandLandmarker> | undefined;

function create(delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> {
  return HandLandmarker.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    },
  );
}

/** Loads the tracker once and shares it. Falls back to CPU if the GPU path fails. */
export function loadHandLandmarker(): Promise<HandLandmarker> {
  instance ??= create('GPU').catch(() => create('CPU'));
  instance.catch(() => (instance = undefined));
  return instance;
}

/**
 * Detects hands in the current video frame and returns the preferred hand,
 * or the only hand if just one is visible.
 */
export function detectHand(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  timestamp: number,
  preferred: Handedness,
): HandFrame | undefined {
  const r = landmarker.detectForVideo(video, timestamp);
  if (!r.landmarks.length) return undefined;
  const labels = r.handedness.map((h) => h[0]?.categoryName as Handedness);
  let i = labels.indexOf(preferred);
  if (i < 0) i = 0;
  return {
    image: r.landmarks[i],
    world: r.worldLandmarks[i],
    handedness: labels[i] ?? preferred,
    aspect: video.videoWidth / video.videoHeight || 4 / 3,
  };
}
