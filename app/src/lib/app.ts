import { Store } from './db';

let storePromise: Promise<Store> | undefined;

/** The one IndexedDB connection the app shares. */
export function getStore(): Promise<Store> {
  return (storePromise ??= Store.open());
}

export function go(path: string): void {
  location.hash = `#/${path}`;
}
