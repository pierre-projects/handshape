// Every address in the app, in one place. Pages link with these instead of
// writing "#/…" by hand, so a route can be renamed without hunting for links.
// Addresses from older versions are redirected, so bookmarks keep working.
//
// The first part of an address is the tab the page sits under (see lib/nav.ts):
// learn, practice or progress. Today is "#/", and a review ("#/review") is
// started from it. Settings ("#/settings") and About ("#/about") sit under no
// tab: they are about the app itself, and are reached from the gear and the footer.

export const routes = {
  home: '#/',
  review: '#/review',
  /** Review with five extra new signs, straight away. */
  reviewMore: '#/review/more',
  /** Learn: every sign, by unit. */
  learn: '#/learn',
  sign: (id: string) => `#/learn/${encodeURIComponent(id)}`,
  /** Practice: every way to practice, grouped by letters and words, and numbers. */
  practice: '#/practice',
  camera: '#/practice/camera',
  cameraSign: (id: string) => `#/practice/camera/${encodeURIComponent(id)}`,
  /** Camera practice, opened on the numbers. */
  cameraNumbers: '#/practice/camera/numbers',
  /** Reading practice: the levels. */
  read: '#/practice/read',
  readLevel: (id: string) => `#/practice/read/${encodeURIComponent(id)}`,
  /** The open-ended reading drill, with your own word lists. */
  readFree: '#/practice/read/free',
  spell: '#/practice/spell',
  signFive: '#/practice/sign-five',
  /** Sign the answer: sums answered by signing a number. */
  sums: '#/practice/sums',
  /** Your word lists, used by Read, Spell and Sign Five. */
  lists: '#/practice/lists',
  list: (id: string) => `#/practice/lists/${encodeURIComponent(id)}`,
  progress: '#/progress',
  /** Settings and your data, behind the gear in the top bar. */
  settings: '#/settings',
  about: '#/about',
} as const;

export interface Route {
  /** First part of the address: '' (Today), 'review', 'learn', 'practice', 'progress', 'settings', 'about'. */
  name: string;
  param?: string;
  sub?: string;
}

/**
 * Older first parts and what they're called now. The pages have been named
 * twice before: learn / practice / fingerspell / progress at first, then
 * signs / camera / fingerspelling / dashboard. "learn" and "progress" mean
 * what they first did, so those old addresses simply work again.
 */
const RENAMED_PAGES: Record<string, string> = {
  signs: 'learn',
  fingerspell: 'practice',
  fingerspelling: 'practice',
  dashboard: 'progress',
};
const RENAMED_PARAMS: Record<string, Record<string, string>> = {
  practice: { game: 'sign-five' },
};
/** The pages under #/practice. */
const PRACTICE_PAGES = ['read', 'spell', 'sign-five', 'sums', 'camera', 'lists'];

/**
 * Reads an address. `redirect` is set when it used an older name; the app
 * swaps the address in place so the current one shows.
 */
export function parseRoute(hash: string): Route & { redirect?: string } {
  const [rawName = '', rawParam, rawSub] = hash.replace(/^#\/?/, '').split('/');
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);
  const was = { name: rawName, param: dec(rawParam), sub: dec(rawSub) };
  let { name, param, sub } = was;

  if (name === 'camera') {
    // Camera practice had its own first part: #/camera/a is now #/practice/camera/a.
    [name, param, sub] = ['practice', 'camera', param];
  } else if (name === 'practice' && param && !PRACTICE_PAGES.includes(param)) {
    // In the first version #/practice was camera practice, and #/practice/a opened it on a sign.
    [param, sub] = ['camera', param];
  } else {
    name = RENAMED_PAGES[name] ?? name;
    if (param && RENAMED_PARAMS[name]?.[param]) param = RENAMED_PARAMS[name][param];
  }
  // Settings and Word lists were sections of Progress (and of the dashboard before that).
  if (name === 'progress' && param === 'settings') [name, param, sub] = ['settings', undefined, undefined];
  if (name === 'progress' && param === 'lists') name = 'practice';

  const route = { name, param, sub };
  const moved = name !== was.name || param !== was.param || sub !== was.sub;
  return moved ? { ...route, redirect: toHash(route) } : route;
}

export function toHash({ name, param, sub }: Route): string {
  return '#/' + [name, param, sub].filter(Boolean).map((p) => encodeURIComponent(p!)).join('/');
}

/** Each page's one name: what its tab, its heading and every "Back to …" link call it. */
export function pageTitle(hash: string): string {
  const { name, param, sub } = parseRoute(hash);
  if (name === 'practice') {
    if (param === 'read') return sub === 'free' ? 'Free reading' : 'Read';
    return (
      { spell: 'Spell', 'sign-five': 'Sign Five', sums: 'Sign the answer', camera: 'Camera practice', lists: 'Word lists' }[
        param ?? ''
      ] ?? 'Practice'
    );
  }
  return (
    { '': 'Today', review: 'Review', learn: 'Learn', progress: 'Progress', settings: 'Settings', about: 'About' }[name] ?? 'Today'
  );
}

// "Edit list" in a drill takes you to Word lists; this remembers where to
// come back to, for the whole browser tab (not saved anywhere else).
const RETURN_KEY = 'asl.returnTo';

export function rememberReturn(hash: string = location.hash): void {
  try {
    sessionStorage.setItem(RETURN_KEY, hash);
  } catch {
    /* private mode: no way back, which is fine */
  }
}

export function peekReturn(): { href: string; label: string } | undefined {
  try {
    const href = sessionStorage.getItem(RETURN_KEY);
    return href ? { href, label: pageTitle(href) } : undefined;
  } catch {
    return undefined;
  }
}

export function clearReturn(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
}
