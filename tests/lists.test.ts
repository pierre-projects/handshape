import { describe, expect, it } from 'vitest';
import { fiveLetterWords, findList, migrateSettings, newListId, uniqueName } from '../app/src/lib/lists';
import { DEFAULT_SETTINGS } from '../app/src/lib/types';

describe('migrateSettings', () => {
  it('leaves fresh settings as the defaults', () => {
    expect(migrateSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('turns the old per-feature lists into named lists and keeps them selected', () => {
    const s = migrateSettings({
      customWords: ['MOM', 'DAD'],
      wordList: 'custom',
      fiveWords: ['HOUSE'],
      fiveList: 'builtin',
    });
    expect(s.lists.map((l) => [l.name, l.words])).toEqual([
      ['My words', ['MOM', 'DAD']],
      ['Five-letter words', ['HOUSE']],
    ]);
    expect(findList(s.lists, s.spellListId)?.name).toBe('My words');
    expect(s.fiveListId).toBe('');
    expect('customWords' in s || 'wordList' in s || 'fiveWords' in s || 'fiveList' in s).toBe(false);
  });

  it('migrates an old backup even after defaults were merged in', () => {
    const s = migrateSettings({ ...DEFAULT_SETTINGS, customWords: ['MOM'], wordList: 'custom' });
    expect(s.lists).toHaveLength(1);
    expect(s.spellListId).toBe(s.lists[0].id);
  });

  it('does not migrate twice', () => {
    const once = migrateSettings({ customWords: ['MOM'], wordList: 'custom' });
    const twice = migrateSettings({ ...once, customWords: ['MOM'] });
    expect(twice.lists).toHaveLength(1);
  });

  it('drops selections of deleted lists, and Sign Five lists without five-letter words', () => {
    const lists = [{ id: 'a', name: 'Short', words: ['CAT'] }];
    const s = migrateSettings({ lists, spellListId: 'gone', fiveListId: 'a' });
    expect(s.spellListId).toBe('');
    expect(s.fiveListId).toBe('');
  });
});

describe('list helpers', () => {
  it('picks the five-letter words', () => {
    expect(fiveLetterWords(['CAT', 'HOUSE', 'MUSIC', 'ELEPHANT'])).toEqual(['HOUSE', 'MUSIC']);
  });
  it('names new lists without clashing', () => {
    const lists = [
      { id: '1', name: 'New list', words: [] },
      { id: '2', name: 'New list 2', words: [] },
    ];
    expect(uniqueName('New list', lists)).toBe('New list 3');
    expect(uniqueName('Family', lists)).toBe('Family');
  });
  it('makes different ids', () => {
    expect(newListId(1, () => 0.1)).not.toBe(newListId(1, () => 0.2));
  });
});
