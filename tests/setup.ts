import { afterEach, vi } from "vitest";
import { resetCookies } from "./helpers/cookies";
vi.mock("next/headers", async () => {
  const { cookiesForTest } = await import("./helpers/cookies");
  return { cookies: async () => cookiesForTest() };
});
if (typeof window !== "undefined") {
  // Node 26 exposes a non-browser localStorage; provide the browser Storage contract in jsdom.
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(String(key), String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
}
afterEach(() => {
  resetCookies();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
