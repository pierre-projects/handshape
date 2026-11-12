import { describe, expect, it } from 'vitest';
import { pageTitle, parseRoute, routes, toHash } from '../app/src/lib/routes';

describe('parseRoute', () => {
  it('reads current addresses without redirecting', () => {
    expect(parseRoute('#/')).toEqual({ name: '', param: undefined, sub: undefined });
    expect(parseRoute(routes.list('l1'))).toEqual({ name: 'dashboard', param: 'lists', sub: 'l1' });
    expect(parseRoute(routes.signFive)).toEqual({ name: 'fingerspelling', param: 'sign-five', sub: undefined });
    expect(parseRoute(routes.sums)).toEqual({ name: 'fingerspelling', param: 'sums', sub: undefined });
    expect(parseRoute(routes.read)).toEqual({ name: 'fingerspelling', param: 'read', sub: undefined });
    expect(parseRoute(routes.readFree)).toEqual({ name: 'fingerspelling', param: 'read', sub: 'free' });
    expect(parseRoute(routes.readLevel('numbers-2'))).toEqual({ name: 'fingerspelling', param: 'read', sub: 'numbers-2' });
  });

  it('redirects addresses from older versions', () => {
    expect(parseRoute('#/learn/a').redirect).toBe('#/signs/a');
    expect(parseRoute('#/practice').redirect).toBe('#/camera');
    expect(parseRoute('#/fingerspell/game').redirect).toBe('#/fingerspelling/sign-five');
    expect(parseRoute('#/fingerspell/read').redirect).toBe('#/fingerspelling/read');
    expect(parseRoute('#/progress/lists/l1').redirect).toBe('#/dashboard/lists/l1');
  });

  it('round-trips every route', () => {
    for (const r of [routes.review, routes.reviewMore, routes.sign('a'), routes.cameraSign('10'), routes.read, routes.readFree, routes.readLevel('words-2'), routes.settings, routes.about]) {
      expect(toHash(parseRoute(r))).toBe(r);
    }
  });
});

describe('pageTitle', () => {
  it('names pages for "Back to …" links', () => {
    expect(pageTitle(routes.read)).toBe('Reading');
    expect(pageTitle(routes.readLevel('letters-1'))).toBe('Reading');
    expect(pageTitle(routes.readFree)).toBe('Free reading practice');
    expect(pageTitle(routes.signFive)).toBe('Sign Five');
    expect(pageTitle(routes.sums)).toBe('Sign the answer');
    expect(pageTitle('#/fingerspell/spell')).toBe('Spell drill');
    expect(pageTitle(routes.fingerspelling)).toBe('Fingerspelling');
    expect(pageTitle('#/')).toBe('Today');
    expect(pageTitle(routes.about)).toBe('About');
  });
});
