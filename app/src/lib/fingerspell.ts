// What the fingerspelling pages share: the letters, which of them can be shown
// on screen, and which words a drill should use.
import { content, letterMap } from './content';
import { hasIllustration } from './illustrations';
import { spellableWords } from './spelling';
import { selectedList } from './lists';
import type { Material } from './receptive';
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

const showable = (i: { id: string; files: unknown[] }) => i.files.length > 0 || hasIllustration(i.id);

/** Everything the reading levels can show, read once from the content. */
export const readingMaterial: Material = (() => {
  const signs = content.items.filter((i) => (i.kind === 'letter' || i.kind === 'number') && showable(i));
  const lookAlikes = new Map<string, string[]>();
  for (const i of signs) {
    // Only look-alikes of the same kind: a letter's choices are letters, a number's are numbers.
    const same = (i.confusable_with ?? [])
      .map((id) => content.byId.get(id))
      .filter((o) => o && o.kind === i.kind && showable(o))
      .map((o) => o!.answer.toUpperCase());
    lookAlikes.set(i.answer.toUpperCase(), same);
  }
  return {
    letters: signs.filter((i) => i.kind === 'letter').map((i) => i.answer.toUpperCase()),
    numbers: signs.filter((i) => i.kind === 'number').map((i) => i.answer),
    lookAlikes,
    words: spellableWords(builtInWords, showableLetters),
    groups: content.wordGroups,
    hints: content.wordHints,
  };
})();
