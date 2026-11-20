// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
const saved = vi.hoisted(() => [] as ArrayBuffer[]);
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return {
    ...actual,
    jsPDF: function (options: ConstructorParameters<typeof actual.jsPDF>[0]) {
      const doc = new actual.jsPDF(options);
      doc.save = (() => {
        saved.push(doc.output("arraybuffer"));
        return doc;
      }) as typeof doc.save;
      return doc;
    },
  };
});
import {
  downloadBookingsPdf,
  downloadBookingsImage,
} from "@/features/dashboard/utils/export-bookings";
const context = { title: "برنامه آزمایشی", stamp: "۱۴۰۵/۱۰/۱۱", count: 1 };
const row = {
  schedule: "برنامه",
  name: "کاربر آزمایشی",
  phone: "۰۹۱۲۳۴۵۶۷۸۹",
  time: "۱۰:۰۰",
};
function fontFetch() {
  const font = readFileSync("public/fonts/Vazirmatn-Regular.ttf");
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => new Response(font),
  );
}
it("generates a real PDF with Persian fonts, headings and multiple pages", async () => {
  fontFetch();
  saved.length = 0;
  await downloadBookingsPdf(
    Array.from({ length: 100 }, () => row),
    { ...context, count: 100 },
  );
  const text = new TextDecoder().decode(saved[0]);
  expect(text.startsWith("%PDF-")).toBe(true);
  expect((text.match(/\/Type \/Page\b/g) || []).length).toBeGreaterThan(1);
  expect(saved[0].byteLength).toBeGreaterThan(10000);
});
it("generates an empty report and reports font failures", async () => {
  fontFetch();
  saved.length = 0;
  await downloadBookingsPdf([], context);
  expect(new TextDecoder().decode(saved[0])).toContain("%PDF-");
  vi.mocked(fetch).mockImplementation(
    async () => new Response("", { status: 404 }),
  );
  await expect(downloadBookingsPdf([], context)).rejects.toThrow(
    "PDF_FONT_LOAD_FAILED",
  );
});
it("renders image rows with wrapped text and starts a PNG download", async () => {
  const fills: unknown[] = [];
  const ctx = {
    measureText: (s: string) => ({ width: s.length * 12 }),
    scale: vi.fn(),
    fillRect: vi.fn((...args: unknown[]) => fills.push(args)),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,test",
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  await downloadBookingsImage(
    [{ ...row, schedule: "very long title ".repeat(20) }, row],
    context,
  );
  expect(fills.length).toBeGreaterThan(4);
  expect(click).toHaveBeenCalledOnce();
});
it("rejects image export if the canvas cannot be created", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  await expect(downloadBookingsImage([], context)).rejects.toThrow(
    "CANVAS_CONTEXT_FAILED",
  );
});
