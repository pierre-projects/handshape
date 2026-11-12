import { describe, expect, it } from 'vitest';
import { tabFor, tabs, type TabId } from '../app/src/lib/nav';
import { parseRoute, routes } from '../app/src/lib/routes';

const tabOf = (hash: string): TabId | undefined => tabFor(parseRoute(hash));
const ids = tabs.map((t) => t.id);

describe('the main navigation', () => {
  it('has four tabs, in this order', () => {
    expect(tabs.map((t) => t.label)).toEqual(['Today', 'Learn', 'Practice', 'Progress']);
    expect(new Set(ids).size).toBe(tabs.length);
  });

  it('puts every page of the app under exactly one tab, except Settings and About', () => {
    for (const [name, value] of Object.entries(routes)) {
      if (name === 'about' || name === 'settings') continue;
      const hash = typeof value === 'function' ? value('a') : value;
      expect(ids, `${name} (${hash})`).toContain(tabOf(hash));
    }
  });

  it('highlights no tab on Settings or About, which are about the app itself', () => {
    expect(tabOf(routes.settings)).toBeUndefined();
    expect(tabOf(routes.about)).toBeUndefined();
  });

  it('highlights a tab on its own page', () => {
    for (const tab of tabs) expect(tabOf(tab.href), tab.label).toBe(tab.id);
  });

  it('keeps Review under Today, since a review is started from there', () => {
    expect(tabOf(routes.review)).toBe('today');
    expect(tabOf(routes.reviewMore)).toBe('today');
  });

  it('keeps a sign and its page under Learn', () => {
    expect(tabOf(routes.sign('a'))).toBe('learn');
    expect(tabOf(routes.sign('10'))).toBe('learn');
  });

  it('keeps every way to practice under Practice, camera practice included', () => {
    for (const hash of [
      routes.camera, routes.cameraSign('a'), routes.cameraNumbers, routes.read, routes.readLevel('letters-1'),
      routes.readFree, routes.spell, routes.signFive, routes.sums,
    ]) {
      expect(tabOf(hash), hash).toBe('practice');
    }
  });

  it('keeps word lists under Practice, where they are used', () => {
    for (const hash of [routes.lists, routes.list('l1')]) expect(tabOf(hash), hash).toBe('practice');
  });

  it('keeps Progress to itself', () => {
    expect(tabOf(routes.progress)).toBe('progress');
  });

  it('shows Today for an address it does not know', () => {
    expect(tabOf('#/nowhere')).toBe('today');
  });
});
