import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const state = vi.hoisted(() => ({
  reverse: false,
  writeFile: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readdirSync: (...args: unknown[]) => {
      const entries = Reflect.apply(actual.readdirSync, actual, args) as unknown[];
      return state.reverse ? entries.reverse() : entries;
    },
    mkdirSync: vi.fn(),
    writeFileSync: state.writeFile,
  };
});

async function generate(reverse: boolean) {
  state.reverse = reverse;
  state.writeFile.mockClear();
  vi.resetModules();
  await import("../../scripts/generate-openapi");
  expect(state.writeFile).toHaveBeenCalledOnce();
  return state.writeFile.mock.calls[0][1] as string;
}

it("generates the committed OpenAPI bytes regardless of directory enumeration order", async () => {
  const forward = await generate(false);
  const reversed = await generate(true);
  expect(reversed).toBe(forward);
  expect(forward).toBe(readFileSync("openapi/openapi.json", "utf8"));
});
