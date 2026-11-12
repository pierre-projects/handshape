import { describe, expect, it } from 'vitest';
import { pageTitle, parseRoute, routes, toHash } from '../app/src/lib/routes';

describe('parseRoute', () => {
  it('reads current addresses without redirecting', () => {
    expect(parseRoute('#/')).toEqual({ name: '', param: undefined, sub: undefined });
    expect(parseRoute(routes.learn)).toEqual({ name: 'learn', param: undefined, sub: undefined });
    expect(parseRoute(routes.sign('a'))).toEqual({ name: 'learn', param: 'a', sub: undefined });
    expect(parseRoute(routes.practice)).toEqual({ name: 'practice', param: undefined, sub: undefined });
    expect(parseRoute(routes.camera)).toEqual({ name: 'practice', param: 'camera', sub: undefined });
    expect(parseRoute(routes.cameraSign('10'))).toEqual({ name: 'practice', param: 'camera', sub: '10' });
    expect(parseRoute(routes.cameraNumbers)).toEqual({ name: 'practice', param: 'camera', sub: 'numbers' });
    expect(parseRoute(routes.signFive)).toEqual({ name: 'practice', param: 'sign-five', sub: undefined });
    expect(parseRoute(routes.sums)).toEqual({ name: 'practice', param: 'sums', sub: undefined });
    expect(parseRoute(routes.read)).toEqual({ name: 'practice', param: 'read', sub: undefined });
    expect(parseRoute(routes.readFree)).toEqual({ name: 'practice', param: 'read', sub: 'free' });
    expect(parseRoute(routes.readLevel('numbers-2'))).toEqual({ name: 'practice', param: 'read', sub: 'numbers-2' });
    expect(parseRoute(routes.lists)).toEqual({ name: 'practice', param: 'lists', sub: undefined });
    expect(parseRoute(routes.list('l1'))).toEqual({ name: 'practice', param: 'lists', sub: 'l1' });
    expect(parseRoute(routes.progress)).toEqual({ name: 'progress', param: undefined, sub: undefined });
    expect(parseRoute(routes.settings)).toEqual({ name: 'settings', param: undefined, sub: undefined });
  });

  it('never redirects an address the app hands out', () => {
    for (const [name, value] of Object.entries(routes)) {
      const hash = typeof value === 'function' ? value('a') : value;
      expect(parseRoute(hash).redirect, `${name} (${hash})`).toBeUndefined();
    }
  });

  it('redirects the addresses used before the four tabs', () => {
    expect(parseRoute('#/signs').redirect).toBe('#/learn');
    expect(parseRoute('#/signs/a').redirect).toBe('#/learn/a');
    expect(parseRoute('#/camera').redirect).toBe('#/practice/camera');
    expect(parseRoute('#/camera/10').redirect).toBe('#/practice/camera/10');
    expect(parseRoute('#/fingerspelling').redirect).toBe('#/practice');
    expect(parseRoute('#/fingerspelling/read/letters-1').redirect).toBe('#/practice/read/letters-1');
    expect(parseRoute('#/fingerspelling/spell').redirect).toBe('#/practice/spell');
    expect(parseRoute('#/fingerspelling/sums').redirect).toBe('#/practice/sums');
    expect(parseRoute('#/dashboard').redirect).toBe('#/progress');
    // Settings was a section of the dashboard, then of Progress; now it is its own page.
    expect(parseRoute('#/dashboard/settings').redirect).toBe('#/settings');
    expect(parseRoute('#/progress/settings').redirect).toBe('#/settings');
    // Word lists were a section of the dashboard, then of Progress; now they are under Practice.
    expect(parseRoute('#/dashboard/lists/l1').redirect).toBe('#/practice/lists/l1');
    expect(parseRoute('#/progress/lists').redirect).toBe('#/practice/lists');
    expect(parseRoute('#/progress/lists/l1').redirect).toBe('#/practice/lists/l1');
  });

  it('keeps a Sign Five link that was already shared working', () => {
    expect(parseRoute('#/fingerspelling/sign-five').redirect).toBe(routes.signFive);
    expect(parseRoute('#/fingerspell/game').redirect).toBe(routes.signFive);
  });

  it('redirects addresses from the first version', () => {
    expect(parseRoute('#/fingerspell/read').redirect).toBe('#/practice/read');
    // #/practice was camera practice then, and #/practice/a opened it on a sign.
    expect(parseRoute('#/practice/a').redirect).toBe('#/practice/camera/a');
    expect(parseRoute('#/practice/10').redirect).toBe('#/practice/camera/10');
  });

  it('lets the first names that are current again simply work', () => {
    // learn and progress mean what they first did; #/practice now opens the Practice page.
    expect(parseRoute('#/learn/a').redirect).toBeUndefined();
    expect(parseRoute('#/progress').redirect).toBeUndefined();
    expect(parseRoute('#/practice').redirect).toBeUndefined();
  });

  it('round-trips every route', () => {
    for (const r of [
      routes.review, routes.reviewMore, routes.learn, routes.sign('a'), routes.practice, routes.camera, routes.cameraSign('10'),
      routes.cameraNumbers, routes.read, routes.readFree, routes.readLevel('words-2'), routes.spell, routes.signFive, routes.sums,
      routes.progress, routes.lists, routes.list('l1'), routes.settings, routes.about,
    ]) {
      expect(toHash(parseRoute(r))).toBe(r);
    }
  });
});

describe('pageTitle', () => {
  it('gives each page its one name, for "Back to …" links', () => {
    expect(pageTitle('#/')).toBe('Today');
    expect(pageTitle(routes.review)).toBe('Review');
    expect(pageTitle(routes.learn)).toBe('Learn');
    expect(pageTitle(routes.sign('a'))).toBe('Learn');
    expect(pageTitle(routes.practice)).toBe('Practice');
    expect(pageTitle(routes.camera)).toBe('Camera practice');
    expect(pageTitle(routes.cameraNumbers)).toBe('Camera practice');
    expect(pageTitle(routes.read)).toBe('Read');
    expect(pageTitle(routes.readLevel('letters-1'))).toBe('Read');
    expect(pageTitle(routes.readFree)).toBe('Free reading');
    expect(pageTitle(routes.spell)).toBe('Spell');
    expect(pageTitle(routes.signFive)).toBe('Sign Five');
    expect(pageTitle(routes.sums)).toBe('Sign the answer');
    expect(pageTitle(routes.progress)).toBe('Progress');
    expect(pageTitle(routes.settings)).toBe('Settings');
    expect(pageTitle(routes.lists)).toBe('Word lists');
    expect(pageTitle(routes.list('l1'))).toBe('Word lists');
    expect(pageTitle(routes.about)).toBe('About');
  });

  it('names an old address by where it goes now', () => {
    expect(pageTitle('#/fingerspell/spell')).toBe('Spell');
    expect(pageTitle('#/camera/a')).toBe('Camera practice');
    expect(pageTitle('#/dashboard')).toBe('Progress');
  });
});
