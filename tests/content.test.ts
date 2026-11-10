import { describe, expect, it } from 'vitest';
import { content, letterMap, resolveContent } from '../app/src/lib/content';
import { validateContent } from '../scripts/validate-content.mjs';
import type { Unit } from '../app/src/lib/types';

describe('bundled content', () => {
  it('passes validation', () => {
    const { errors } = validateContent();
    expect(errors).toEqual([]);
  });

  it('has the full alphabet and numbers 0 to 10', () => {
    expect([...letterMap().keys()].sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(content.items.filter((i) => i.kind === 'number')).toHaveLength(11);
  });

  it('only uses practice words the alphabet covers', () => {
    for (const w of content.practiceWords) expect(w).toMatch(/^[A-Z]+$/);
  });

  it('groups some practice words, with a hint for each', () => {
    expect(content.wordGroups.map((g) => g.id)).toEqual(expect.arrayContaining(['names', 'places']));
    for (const g of content.wordGroups) {
      expect(g.hint.length, g.id).toBeGreaterThan(0);
      for (const w of g.words) {
        expect(content.practiceWords, w).toContain(w);
        expect(content.wordHints.get(w), w).toBe(g.hint);
      }
    }
    expect(new Set(content.practiceWords).size).toBe(content.practiceWords.length);
  });
});

describe('word groups', () => {
  const unit = (id: string, order: number, extra: Partial<Unit>): Unit => ({
    id, order, title: id, description: id, review: { status: 'draft', reviewed_by: [] }, items: [], ...extra,
  });

  it('join the plain practice words, each word once, keeping its group’s hint', () => {
    const c = resolveContent([
      unit('one', 1, { practice_words: ['CAT', 'AMY'], practice_groups: [{ id: 'names', hint: 'a name', words: ['AMY', 'BOB'] }] }),
      unit('two', 2, { practice_groups: [{ id: 'places', hint: 'a place', words: ['ROME'] }] }),
    ]);
    expect(c.practiceWords).toEqual(['CAT', 'AMY', 'BOB', 'ROME']);
    expect(c.wordHints.get('BOB')).toBe('a name');
    expect(c.wordHints.get('ROME')).toBe('a place');
    expect(c.wordHints.has('CAT')).toBe(false);
    expect(c.wordGroups).toHaveLength(2);
  });

  it('are rejected when a word is in two groups or a group id repeats', async () => {
    const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'asl-groups-'));
    for (const d of ['schema', 'units']) mkdirSync(join(dir, d));
    copyFileSync(join('content/schema', 'unit.schema.json'), join(dir, 'schema', 'unit.schema.json'));
    const item = { id: 'a', gloss: 'A', answer: 'A', kind: 'letter', handshape: 'Fist.' };
    writeFileSync(join(dir, 'units', '01.json'), JSON.stringify({
      id: 'u', order: 1, title: 't', description: 'd', review: { status: 'draft', reviewed_by: [] }, items: [item],
      practice_groups: [
        { id: 'names', hint: 'a name', words: ['PARIS', 'AMY'] },
        { id: 'places', hint: 'a place', words: ['PARIS'] },
        { id: 'names', hint: 'a name', words: ['BOB'] },
      ],
    }));
    const { errors } = validateContent(dir);
    expect(errors.some((e: string) => e.includes('"PARIS" is in groups "names" and "places"'))).toBe(true);
    expect(errors.some((e: string) => e.includes('word group "names" also used'))).toBe(true);
  });
});

describe('resolveContent', () => {
  const unit = (id: string, order: number, media: Unit['items'][number]['media']): Unit => ({
    id, order, title: id, description: id, review: { status: 'draft', reviewed_by: [] },
    items: [{ id: `${id}-1`, gloss: 'X', answer: 'X', kind: 'sign', handshape: 'h', media }],
  });

  it('sorts units by order and resolves only media files that exist', () => {
    const c = resolveContent(
      [
        unit('second', 2, [{ src: 'media/missing.webp', type: 'image', credit: 'c', license: 'l' }]),
        unit('first', 1, [
          { src: 'media/x.webp', type: 'image', credit: 'c', license: 'l' },
          { embed: 'youtube:abcdefghijk', credit: 'c' },
        ]),
      ],
      new Map([['media/x.webp', '/assets/x.webp']]),
    );
    expect(c.units.map((u) => u.id)).toEqual(['first', 'second']);
    expect(c.byId.get('first-1')!.files[0].url).toBe('/assets/x.webp');
    expect(c.byId.get('first-1')!.embeds).toHaveLength(1);
    expect(c.byId.get('second-1')!.files).toHaveLength(0);
  });
});

describe('word list validation', () => {
  it('reports words of the wrong length, repeats and non-letters', async () => {
    const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'asl-content-'));
    for (const d of ['schema', 'units', 'words']) mkdirSync(join(dir, d));
    for (const f of ['unit.schema.json', 'wordlist.schema.json']) copyFileSync(join('content/schema', f), join(dir, 'schema', f));
    const list = (words: string[]) => JSON.stringify({ title: 't', description: 'd', length: 5, words });
    writeFileSync(join(dir, 'words', 'bad-length.json'), list(['house', 'cat']));
    writeFileSync(join(dir, 'words', 'bad-chars.json'), list(['house', 'house', 'Ho-me']));
    const { errors, wordLists } = validateContent(dir);
    expect(wordLists).toBe(2);
    expect(errors.some((e: string) => e.includes('bad-length.json: not 5 letters: cat'))).toBe(true);
    expect(errors.filter((e: string) => e.includes('bad-chars.json')).length).toBeGreaterThanOrEqual(2);
  });
});
