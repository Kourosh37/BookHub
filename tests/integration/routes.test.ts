import { beforeEach, afterAll, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { resetDatabase, disconnect } from "../helpers/db";
import { readFileSync } from "node:fs";
type Handler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;
const routes = import.meta.glob<{ [method: string]: Handler }>(
  "../../src/app/api/**/route.ts",
);
beforeEach(resetDatabase);
afterAll(disconnect);
for (const [file, load] of Object.entries(routes)) {
  const path = file
    .replace("../../src/app", "")
    .replace("/route.ts", "")
    .replace(/\[([^\]]+)\]/g, "missing");
  it("checks unauthenticated access and input at " + path, async () => {
    const handlers = await load();
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      if (!handlers[method]) continue;
      const req = new NextRequest("http://localhost" + path, {
        method,
        ...(["POST", "PATCH"].includes(method)
          ? { headers: { "content-type": "application/json" }, body: "{}" }
          : {}),
      });
      const response = await handlers[method](req, {
        params: Promise.resolve({
          scheduleId: "missing",
          bookingId: "missing",
          shareId: "missing",
          fileName: "missing.jpg",
        }),
      });
      const publicAuth =
        /\/auth\/(request-otp|register|verify-otp|login|login-password)$/.test(
          path,
        );
      const expected =
        path === "/api/health" ||
        path === "/api/openapi" ||
        path === "/api/auth/logout" ||
        path === "/api/admin/logout"
          ? 200
          : publicAuth || path === "/api/admin/login"
            ? 400
            : path.startsWith("/api/profile/avatar/file/")
              ? 404
              : 401;
      expect(response.status, `${method} ${path}`).toBe(
        path === "/api/profile" && method === "DELETE" ? 405 : expected,
      );
    }
  });
}
it("returns 400 for malformed JSON rather than an unhandled 500", async () => {
  const route = await import("@/app/api/auth/verify-otp/route");
  const response = await route.POST(
    new Request("http://localhost/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("content-type")).toContain("application/json");
});
it("the OpenAPI contract covers every implemented operation", async () => {
  const doc = JSON.parse(readFileSync("openapi/openapi.json", "utf8"));
  for (const [file, load] of Object.entries(routes)) {
    const path = file
      .replace("../../src/app", "")
      .replace("/route.ts", "")
      .replace(/\[([^\]]+)\]/g, "{$1}");
    const handlers = await load();
    for (const method of ["GET", "POST", "PATCH", "DELETE"])
      if (handlers[method])
        expect(
          doc.paths[path]?.[method.toLowerCase()],
          method + " " + path,
        ).toBeDefined();
  }
});
