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
  /** More practice words, grouped by what they are, so a drill can give a hint ("a name"). */
  practice_groups?: WordGroup[];
}

export interface WordGroup {
  id: string;
  /** Shown before the word is spelled, e.g. "a name". */
  hint: string;
  words: string[];
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
  /**
   * Receptive only: what was read. A whole word (the default, and every attempt
   * saved before levels existed), one letter picked from choices, or a number
   * or digit string. `word` holds what was shown and `typed` the answer.
   */
  drill?: 'word' | 'letter' | 'number';
  correct: boolean;
  typed?: string;
  /** Receptive: playback speed. Expressive: measured signing speed. Letters per second. */
  lettersPerSecond: number;
  replays: number;
  at: Date;
}

export interface WordListDef {
  id: string;
  name: string;
  /** Upper case A–Z words. */
  words: string[];
}

/** Sign Five: today's game in progress and the running stats. */
export interface SignFiveSave {
  daily?: {
    key: string;
    guesses: string[];
    answer?: string;
    source?: 'official' | 'local';
    /** Letters in entered guesses that were fingerspelled to the camera, not typed. */
    signed?: number;
  };
  stats: { played: number; won: number; streak: number; best: number; dist: number[] };
}

export const DEFAULT_SIGN_FIVE: SignFiveSave = {
  stats: { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0] },
};

/** How a reading level has gone so far. */
export interface LevelProgress {
  /** Best score, out of the session size. */
  best: number;
  plays: number;
  /** When it was first passed, as an ISO date. */
  passedAt?: string;
}

export interface Settings {
  newItemsPerDay: number;
  receptiveSpeed: number;
  /** Reading levels played, by level id. */
  readLevels: Record<string, LevelProgress>;
  /** How spelled words are shown: letter pictures, or the moving drawn hand. */
  readDisplay: 'pictures' | 'hand';
  showCameraByDefault: boolean;
  mirrorMedia: boolean;
  /** Which hand to check when both are in view. */
  dominantHand: 'Right' | 'Left';
  /** The learner's word lists. */
  lists: WordListDef[];
  /** List the fingerspelling drills use; empty means the built-in words. */
  spellListId: string;
  /** List Sign Five practice games use (its five-letter words); empty means built-in. */
  fiveListId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  lists: [],
  spellListId: '',
  fiveListId: '',
  newItemsPerDay: 6,
  receptiveSpeed: 1.5,
  readLevels: {},
  readDisplay: 'pictures',
  showCameraByDefault: false,
  mirrorMedia: false,
  dominantHand: 'Right',
};
