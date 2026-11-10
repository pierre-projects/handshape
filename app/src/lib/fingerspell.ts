// What the fingerspelling pages share: the letters, which of them can be shown
// on screen, and which words a drill should use.
import { content, letterMap } from './content';
import { hasIllustration } from './illustrations';
import { spellableWords } from './spelling';
import { selectedList } from './lists';
import type { Settings, WordListDef } from './types';

/** Letter items keyed by upper-case letter. */
export const letters = letterMap();

/** Letters that can be shown in the Read drill: real media or a drawn illustration. */
export const showableLetters = new Set(
  [...letters].filter(([, i]) => i.files.length > 0 || hasIllustration(i.id)).map(([l]) => l),
);

export const builtInWords = content.practiceWords;

/** The Read drill needs at least one built-in word whose letters can all be shown. */
export const canRead = spellableWords(builtInWords, showableLetters).length > 0;

/** The words the Read and Spell drills draw from: the chosen list, or the built-in words. */
export function drillWords(settings: Settings | undefined): { list?: WordListDef; words: string[] } {
  const list = selectedList(settings?.lists ?? [], settings?.spellListId);
  return { list, words: list ? list.words : builtInWords };
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
