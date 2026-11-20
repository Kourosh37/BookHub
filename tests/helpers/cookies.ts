import { AsyncLocalStorage } from "node:async_hooks";
export type CookieJar = Map<string, string>;
const storage = new AsyncLocalStorage<CookieJar>();
let fallback = new Map<string, string>();
export function cookiesForTest() {
  const jar = storage.getStore() || fallback;
  return {
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
}
export function resetCookies() {
  fallback = new Map();
}
export function withCookies<T>(jar: CookieJar, action: () => Promise<T>) {
  return storage.run(jar, action);
}
