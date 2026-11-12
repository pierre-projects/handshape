// The four places in the main navigation, and which one each page belongs to.
// The top bar on a wide screen and the tab bar on a phone both draw from this,
// so they can never disagree, and the tests can check which tab every page
// lights up.
import { routes, type Route } from './routes';

/**
 * Organized by what you do: start the day, look a sign up, practice, see how
 * you're doing. Review is not here: it is a session started from Today.
 */
export const tabs = [
  { id: 'today', label: 'Today', href: routes.home, icon: 'home' },
  { id: 'learn', label: 'Learn', href: routes.learn, icon: 'signs' },
  { id: 'practice', label: 'Practice', href: routes.practice, icon: 'spell' },
  { id: 'progress', label: 'Progress', href: routes.progress, icon: 'progress' },
] as const;

export type TabId = (typeof tabs)[number]['id'];

/** The first part of an address, and the tab that page sits under. */
const PAGE_TAB: Record<string, TabId> = {
  '': 'today',
  // A review is part of the day's plan, started from Today.
  review: 'today',
  learn: 'learn',
  // Every way to practice, Camera practice included, is under #/practice.
  practice: 'practice',
  progress: 'progress',
};

/** Pages about the app itself, not a place to learn or practice: reached from the gear and the footer. */
const NO_TAB = new Set(['settings', 'about']);

/**
 * The tab to highlight for a page, if any. Settings and About sit under no
 * tab. An address the app doesn't know shows Today, so that is its tab.
 */
export function tabFor(route: Pick<Route, 'name'>): TabId | undefined {
  if (NO_TAB.has(route.name)) return undefined;
  return PAGE_TAB[route.name] ?? 'today';
}
