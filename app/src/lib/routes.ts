// Every address in the app, in one place. Pages link with these instead of
// writing "#/…" by hand, so a route can be renamed without hunting for links.
// Addresses from older versions are redirected, so bookmarks keep working.

export const routes = {
  home: '#/',
  review: '#/review',
  /** Review with five extra new signs, straight away. */
  reviewMore: '#/review/more',
  signs: '#/signs',
  sign: (id: string) => `#/signs/${encodeURIComponent(id)}`,
  camera: '#/camera',
  cameraSign: (id: string) => `#/camera/${encodeURIComponent(id)}`,
  fingerspelling: '#/fingerspelling',
  /** Reading practice: the levels. */
  read: '#/fingerspelling/read',
  readLevel: (id: string) => `#/fingerspelling/read/${encodeURIComponent(id)}`,
  /** The open-ended reading drill, with your own word lists. */
  readFree: '#/fingerspelling/read/free',
  spell: '#/fingerspelling/spell',
  signFive: '#/fingerspelling/sign-five',
  dashboard: '#/dashboard',
  lists: '#/dashboard/lists',
  list: (id: string) => `#/dashboard/lists/${encodeURIComponent(id)}`,
  settings: '#/dashboard/settings',
  about: '#/about',
} as const;

export interface Route {
  /** First part of the address: '' (home), 'review', 'signs', 'camera', 'fingerspelling', 'dashboard'. */
  name: string;
  param?: string;
  sub?: string;
}

/** Older addresses and what they're called now. */
const RENAMED_PAGES: Record<string, string> = {
  learn: 'signs',
  practice: 'camera',
  fingerspell: 'fingerspelling',
  progress: 'dashboard',
};
const RENAMED_PARAMS: Record<string, Record<string, string>> = {
  fingerspelling: { game: 'sign-five' },
};

/**
 * Reads an address. `redirect` is set when it used an older name; the app
 * swaps the address in place so the current one shows.
 */
export function parseRoute(hash: string): Route & { redirect?: string } {
  const [rawName = '', rawParam, rawSub] = hash.replace(/^#\/?/, '').split('/');
  const dec = (s?: string) => (s ? decodeURIComponent(s) : undefined);
  const name = RENAMED_PAGES[rawName] ?? rawName;
  let param = dec(rawParam);
  if (param && RENAMED_PARAMS[name]?.[param]) param = RENAMED_PARAMS[name][param];
  const sub = dec(rawSub);
  const route = { name, param, sub };
  const canonical = toHash(route);
  const moved = name !== rawName || param !== dec(rawParam);
  return moved ? { ...route, redirect: canonical } : route;
}

export function toHash({ name, param, sub }: Route): string {
  return '#/' + [name, param, sub].filter(Boolean).map((p) => encodeURIComponent(p!)).join('/');
}

/** Short page names, for "Back to …" links. */
export function pageTitle(hash: string): string {
  const { name, param, sub } = parseRoute(hash);
  if (name === 'fingerspelling') {
    if (param === 'read') return sub === 'free' ? 'Free reading practice' : 'Reading';
    return { spell: 'Spell drill', 'sign-five': 'Sign Five' }[param ?? ''] ?? 'Fingerspelling';
  }
  return (
    { '': 'Today', review: 'Review', signs: 'Signs', camera: 'Camera practice', dashboard: 'Dashboard', about: 'About' }[name] ?? 'Today'
  );
}

// "Edit list" in a drill takes you to the dashboard; this remembers where to
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
