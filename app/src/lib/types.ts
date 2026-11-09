import type { Card } from 'ts-fsrs';

export type ItemKind = 'letter' | 'number' | 'sign';

export interface FileMedia {
  src: string;
  type: 'image' | 'video';
  credit: string;
  license: string;
  angle?: 'front' | 'side' | 'signer-view';
}

export interface EmbedMedia {
  embed: string;
  start?: number;
  end?: number;
  credit: string;
}

export type Media = FileMedia | EmbedMedia;

export interface Item {
  id: string;
  gloss: string;
  answer: string;
  kind: ItemKind;
  handshape: string;
  palm?: string;
  movement?: string;
  tips?: string[];
  confusable_with?: string[];
  media?: Media[];
}

export interface Unit {
  id: string;
  order: number;
  title: string;
  description: string;
  review: { status: 'draft' | 'reviewed'; reviewed_by: string[]; notes?: string };
  items: Item[];
  practice_words?: string[];
}

/** An item with its unit, plus media resolved to URLs the browser can load. */
export interface ResolvedItem extends Item {
  unitId: string;
  /** Local image or video files, resolved to URLs. Used by receptive drills. */
  files: (FileMedia & { url: string })[];
  embeds: EmbedMedia[];
}

/** Produce: see the gloss, sign it, self-grade. Recognize: see the sign, type the answer. */
export type CardKind = 'produce' | 'recognize';

export interface StoredCard {
  id: string;
  itemId: string;
  kind: CardKind;
  introducedAt: Date;
  fsrs: Card;
}

export interface ReviewEntry {
  id?: number;
  cardId: string;
  itemId: string;
  kind: CardKind;
  rating: number;
  /** For recognize cards: whether the typed answer matched. */
  correct?: boolean;
  /** For recognize cards: what the learner typed. */
  typed?: string;
  /** For produce cards: whether the camera matched the handshape before grading. */
  camera?: boolean;
  /** FSRS state before this review (0 new, 1 learning, 2 review, 3 relearning). */
  stateBefore: number;
  at: Date;
}

export interface SpellingAttempt {
  id?: number;
  word: string;
  mode: 'receptive' | 'expressive';
  correct: boolean;
  typed?: string;
  /** Receptive: playback speed. Expressive: measured signing speed. Letters per second. */
  lettersPerSecond: number;
  replays: number;
  at: Date;
}

export interface Settings {
  newItemsPerDay: number;
  receptiveSpeed: number;
  showCameraByDefault: boolean;
  mirrorMedia: boolean;
  /** Which hand to check when both are in view. */
  dominantHand: 'Right' | 'Left';
}

export const DEFAULT_SETTINGS: Settings = {
  newItemsPerDay: 6,
  receptiveSpeed: 1.5,
  showCameraByDefault: false,
  mirrorMedia: false,
  dominantHand: 'Right',
};
