// Browser-only: loads MediaPipe Hand Landmarker from files bundled with the app.
// Video frames are processed on this device; nothing is sent anywhere.
import { HandLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import modelAssetPath from '../../../../models/hand_landmarker.task?url';
import type { HandFrame, Handedness } from './hand';
import type { HandFollower } from './tracker';

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
 * Detects hands in the current video frame and returns the one to read. With
 * more than one in view, `follower` chooses the signer's signing hand and then
 * stays with it (see HandFollower).
 */
export function detectHand(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  timestamp: number,
  preferred: Handedness,
  follower: HandFollower,
): HandFrame | undefined {
  const r = landmarker.detectForVideo(video, timestamp);
  const hands = r.landmarks.map((image, i) => ({
    image,
    world: r.worldLandmarks[i],
    handedness: (r.handedness[i]?.[0]?.categoryName as Handedness | undefined) ?? preferred,
  }));
  const hand = follower.pick(hands, preferred, timestamp);
  return hand && { ...hand, aspect: video.videoWidth / video.videoHeight || 4 / 3 };
}
