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
