import type { Point } from './geometry';

/** MediaPipe hand landmark indices. */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export type Finger = 'index' | 'middle' | 'ring' | 'pinky';
export const FINGERS: Finger[] = ['index', 'middle', 'ring', 'pinky'];

/** MCP, PIP, DIP, TIP indices per finger. */
export const FINGER_JOINTS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

/** Pairs of landmarks to draw as the hand skeleton. */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export type Handedness = 'Left' | 'Right';

/** One detected hand in one video frame. */
export interface HandFrame {
  /** 21 points, x and y normalised to 0..1 of the video frame. Not mirrored. */
  image: Point[];
  /** 21 points in metres, centred on the hand. Used for shape. */
  world: Point[];
  /** The signer's hand, as reported by the tracker. */
  handedness: Handedness;
  /** Video width divided by height, to measure image directions without distortion. */
  aspect: number;
}
