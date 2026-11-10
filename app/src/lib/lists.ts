// Word lists: named lists of words the learner makes once and can pick in any
// drill or game. Lists don't belong to a feature; each feature uses the words
// that suit it (Sign Five only uses the five-letter ones).
import { DEFAULT_SETTINGS, type Settings, type WordListDef } from './types';

export const MAX_LISTS = 50;

export function newListId(now = Date.now(), random = Math.random): string {
  return `l${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`;
}

export function findList(lists: WordListDef[], id: string | undefined): WordListDef | undefined {
  return id ? lists.find((l) => l.id === id) : undefined;
}

export function fiveLetterWords(words: string[]): string[] {
  return words.filter((w) => w.length === 5);
}

/**
 * The learner's list with this id, if it has any words this feature can use
 * (e.g. Sign Five only uses five-letter words).
 */
export function selectedList(
  lists: WordListDef[],
  id: string | undefined,
  usable: (words: string[]) => string[] = (w) => w,
): WordListDef | undefined {
  return lists.find((l) => l.id === id && usable(l.words).length > 0);
}

/** A name not already taken: "My list", "My list 2", … */
export function uniqueName(base: string, lists: WordListDef[]): string {
  const taken = new Set(lists.map((l) => l.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

/**
 * Settings saved by older versions kept one fingerspelling list and one Sign
 * Five list. Those become named lists, and a selection pointing at a list that
 * no longer exists falls back to the built-in words.
 */
export function migrateSettings(raw: Record<string, unknown>): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw } as Settings & Record<string, unknown>;
  const lists: WordListDef[] = Array.isArray(raw.lists) ? [...(raw.lists as WordListDef[])] : [];

  const legacy = (wordsKey: string, choiceKey: string, name: string, pick: 'spellListId' | 'fiveListId', salt: number) => {
    const words = raw[wordsKey];
    const id = `legacy-${salt}`;
    if (Array.isArray(words) && words.length && !lists.some((l) => l.id === id)) {
      lists.push({ id, name, words: words as string[] });
      if (raw[choiceKey] === 'custom') s[pick] = id;
    }
    delete s[wordsKey];
    delete s[choiceKey];
  };
  legacy('customWords', 'wordList', 'My words', 'spellListId', 1);
  legacy('fiveWords', 'fiveList', 'Five-letter words', 'fiveListId', 2);

  s.lists = lists;
  if (!findList(lists, s.spellListId)) s.spellListId = '';
  if (!findList(lists, s.fiveListId) || !fiveLetterWords(findList(lists, s.fiveListId)!.words).length) s.fiveListId = '';
  return s;
}
