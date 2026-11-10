import { describe, expect, it } from 'vitest';
import { pageTitle, parseRoute, routes, toHash } from '../app/src/lib/routes';

describe('parseRoute', () => {
  it('reads current addresses without redirecting', () => {
    expect(parseRoute('#/')).toEqual({ name: '', param: undefined, sub: undefined });
    expect(parseRoute(routes.list('l1'))).toEqual({ name: 'dashboard', param: 'lists', sub: 'l1' });
    expect(parseRoute(routes.signFive)).toEqual({ name: 'fingerspelling', param: 'sign-five', sub: undefined });
  });

  it('redirects addresses from older versions', () => {
    expect(parseRoute('#/learn/a').redirect).toBe('#/signs/a');
    expect(parseRoute('#/practice').redirect).toBe('#/camera');
    expect(parseRoute('#/fingerspell/game').redirect).toBe('#/fingerspelling/sign-five');
    expect(parseRoute('#/fingerspell/read').redirect).toBe('#/fingerspelling/read');
    expect(parseRoute('#/progress/lists/l1').redirect).toBe('#/dashboard/lists/l1');
  });

  it('round-trips every route', () => {
    for (const r of [routes.review, routes.reviewMore, routes.sign('a'), routes.cameraSign('10'), routes.read, routes.settings]) {
      expect(toHash(parseRoute(r))).toBe(r);
    }
  });
});

describe('pageTitle', () => {
  it('names pages for "Back to …" links', () => {
    expect(pageTitle(routes.read)).toBe('Read drill');
    expect(pageTitle(routes.signFive)).toBe('Sign Five');
    expect(pageTitle('#/fingerspell/spell')).toBe('Spell drill');
    expect(pageTitle(routes.fingerspelling)).toBe('Fingerspelling');
    expect(pageTitle('#/')).toBe('Today');
  });
});
