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
