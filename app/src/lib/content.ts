import type { Unit, ResolvedItem, FileMedia, EmbedMedia } from './types';

const unitModules = import.meta.glob<Unit>('../../../content/units/*.json', {
  eager: true,
  import: 'default',
});

const mediaModules = import.meta.glob<string>(
  '../../../content/media/**/*.{png,jpg,jpeg,webp,svg,gif,mp4,webm}',
  { eager: true, query: '?url', import: 'default' },
);

const MEDIA_PREFIX = '../../../content/';

/** Map of content-relative path (e.g. "media/letters/a.webp") to a loadable URL. */
const mediaUrls = new Map<string, string>(
  Object.entries(mediaModules).map(([path, url]) => [path.slice(MEDIA_PREFIX.length), url]),
);

export interface Content {
  units: Unit[];
  items: ResolvedItem[];
  byId: Map<string, ResolvedItem>;
  practiceWords: string[];
}

export function resolveContent(units: Unit[], urls: Map<string, string> = mediaUrls): Content {
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const items: ResolvedItem[] = [];
  for (const unit of sorted) {
    for (const item of unit.items) {
      const files: ResolvedItem['files'] = [];
      const embeds: EmbedMedia[] = [];
      for (const m of item.media ?? []) {
        if ('embed' in m) {
          embeds.push(m);
        } else {
          const url = urls.get((m as FileMedia).src);
          if (url) files.push({ ...(m as FileMedia), url });
        }
      }
      items.push({ ...item, unitId: unit.id, files, embeds });
    }
  }
  const words = new Set<string>();
  for (const unit of sorted) for (const w of unit.practice_words ?? []) words.add(w);
  return {
    units: sorted,
    items,
    byId: new Map(items.map((i) => [i.id, i])),
    practiceWords: [...words],
  };
}

export const content: Content = resolveContent(Object.values(unitModules));

/** Letter items keyed by uppercase letter, for fingerspelling. */
export function letterMap(c: Content = content): Map<string, ResolvedItem> {
  return new Map(c.items.filter((i) => i.kind === 'letter').map((i) => [i.answer.toUpperCase(), i]));
}
