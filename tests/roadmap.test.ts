import { describe, expect, it } from 'vitest';
import { FEEDBACK_URL, UPCOMING } from '../app/src/lib/roadmap';

describe("what's coming", () => {
  it('has a few items, each with a title, a line of text and a stage', () => {
    expect(UPCOMING.length).toBeGreaterThanOrEqual(3);
    for (const item of UPCOMING) {
      expect(item.title.trim().length, item.title).toBeGreaterThan(3);
      expect(item.text.trim().endsWith('.'), item.title).toBe(true);
      expect(['Next', 'Later', 'Ongoing']).toContain(item.stage);
    }
    expect(new Set(UPCOMING.map((i) => i.title)).size).toBe(UPCOMING.length);
  });

  it('promises no dates', () => {
    for (const item of UPCOMING) expect(`${item.title} ${item.text}`, item.title).not.toMatch(/\b20\d\d\b|next (week|month)|soon/i);
  });

  it('links to a Google Form over https, or to nothing yet', () => {
    if (FEEDBACK_URL) expect(FEEDBACK_URL).toMatch(/^https:\/\/(forms\.gle|docs\.google\.com\/forms)\//);
    else expect(FEEDBACK_URL).toBe('');
  });
});
