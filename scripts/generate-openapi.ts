import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import {
  requestOtpSchema,
  verifyOtpSchema,
  passwordLoginSchema,
  scheduleSchema,
  bookingSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateSmsPreferencesSchema,
  updateAdminSmsSettingsSchema,
  updateScheduleTitleSchema,
} from "../src/lib/validations";
extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();
const ok = registry.register("OkResponse", z.object({ ok: z.boolean() }));
const user = z
  .object({
    id: z.string(),
    phone: z.string().nullable(),
    username: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  })
  .passthrough();
const slot = z.object({
  id: z.string(),
  scheduleId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  isBooked: z.boolean(),
});
const booking = z
  .object({
    id: z.string(),
    timeSlotId: z.string(),
    scheduleId: z.string(),
    status: z.enum(["CONFIRMED", "CANCELED"]),
    answers: z.array(z.string()),
    bookedAt: z.string(),
  })
  .passthrough();
const schedule = z
  .object({ id: z.string(), shareId: z.string(), title: z.string() })
  .passthrough();
const error = registry.register(
  "ErrorResponse",
  z.object({
    error: z.string(),
    details: z.string().optional(),
    retryAfterSeconds: z.number().optional(),
  }),
);
const bodySchemas: Record<string, z.ZodType> = {
  "post /api/auth/request-otp": requestOtpSchema,
  "post /api/auth/register": requestOtpSchema,
  "post /api/auth/verify-otp": verifyOtpSchema,
  "post /api/auth/login": verifyOtpSchema,
  "post /api/auth/login-password": passwordLoginSchema,
  "post /api/schedules": scheduleSchema,
  "post /api/schedules/{shareId}/book": bookingSchema,
  "patch /api/schedules/id/{scheduleId}": updateScheduleTitleSchema,
  "patch /api/profile": updateProfileSchema,
  "post /api/profile/password/confirm": changePasswordSchema,
  "post /api/profile/delete/confirm": z.object({
    code: verifyOtpSchema.shape.code,
  }),
  "patch /api/profile/sms-preferences": updateSmsPreferencesSchema,
  "patch /api/admin/sms-settings": updateAdminSmsSettingsSchema,
  "post /api/admin/login": z.object({
    username: z.string(),
    password: z.string(),
  }),
};
const responses: Record<string, z.ZodType> = {
  "post /api/auth/request-otp": z.object({
    ok: z.boolean(),
    expiresInSeconds: z.number(),
    resendAfterSeconds: z.number(),
    sms: z.object({ sent: z.boolean() }),
  }),
  "post /api/auth/register": z.object({
    ok: z.boolean(),
    expiresInSeconds: z.number(),
    resendAfterSeconds: z.number(),
    sms: z.object({ sent: z.boolean() }),
  }),
  "post /api/auth/verify-otp": z.object({
    ok: z.boolean(),
    id: z.string(),
    phone: z.string(),
  }),
  "post /api/auth/login": z.object({
    ok: z.boolean(),
    id: z.string(),
    phone: z.string(),
  }),
  "get /api/auth/me": z.object({ user }),
  "get /api/profile": user,
  "patch /api/profile": user,
  "post /api/schedules": schedule,
  "get /api/schedules/my": z.array(schedule),
  "get /api/schedules/{shareId}": schedule,
  "get /api/schedules/{shareId}/slots": z.array(slot),
  "post /api/schedules/{shareId}/book": booking,
  "get /api/bookings/my": z.array(booking),
  "get /api/bookings/mine": z.array(booking),
  "get /api/profile/sms-preferences": updateSmsPreferencesSchema,
  "patch /api/profile/sms-preferences": updateSmsPreferencesSchema,
  "get /api/admin/sms-settings": updateAdminSmsSettingsSchema,
  "patch /api/admin/sms-settings": updateAdminSmsSettingsSchema,
};
function walk(dir: string): string[] {
  // Use code-point ordering; filesystem order and locale vary across platforms.
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((e) =>
      e.isDirectory()
        ? walk(join(dir, e.name))
        : e.name === "route.ts"
          ? [join(dir, e.name)]
          : [],
    );
}
const root = join(process.cwd(), "src", "app");
for (const file of walk(join(root, "api"))) {
  const path =
    "/" +
    relative(root, file)
      .replaceAll("\\", "/")
      .replace(/\/route\.ts$/, "")
      .replace(/\[([^\]]+)\]/g, "{$1}");
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /export async function (GET|POST|PATCH|DELETE)\(/g,
  )) {
    const method = match[1].toLowerCase() as
        "get" | "post" | "patch" | "delete",
      key = method + " " + path;
    const params = Object.fromEntries(
      [...path.matchAll(/\{([^}]+)\}/g)].map((m) => [m[1], z.string()]),
    );
    const isPublic =
      /^\/api\/auth\/(request-otp|register|verify-otp|login|login-password|logout)$/.test(
        path,
      ) ||
      path === "/api/admin/login" ||
      path === "/api/openapi" ||
      path === "/api/health" ||
      path.startsWith("/api/profile/avatar/file/");
    const success =
      responses[key] || (method === "get" ? z.object({}).passthrough() : ok);
    registry.registerPath({
      method,
      path,
      summary: key,
      operationId: key.replace(/[^a-zA-Z0-9]/g, "_"),
      ...(isPublic
        ? {}
        : {
            security: [
              {
                [path.startsWith("/api/admin/")
                  ? "adminSession"
                  : path.startsWith("/api/internal/")
                    ? "cronBearer"
                    : "userSession"]: [],
              },
            ],
          }),
      request: {
        ...(Object.keys(params).length ? { params: z.object(params) } : {}),
        ...(bodySchemas[key]
          ? {
              body: {
                content: { "application/json": { schema: bodySchemas[key] } },
              },
            }
          : {}),
        ...(path.endsWith("/slots")
          ? {
              query: z.object({
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              }),
            }
          : {}),
        ...(path === "/api/profile/avatar" && method === "post"
          ? {
              body: {
                content: {
                  "multipart/form-data": {
                    schema: z.object({
                      file: z
                        .string()
                        .openapi({ type: "string", format: "binary" }),
                    }),
                  },
                },
              },
            }
          : {}),
      },
      responses: {
        200: {
          description: "Success",
          content: {
            [path.endsWith("/export")
              ? "text/csv"
              : path.startsWith("/api/profile/avatar/file/")
                ? "image/jpeg"
                : "application/json"]: { schema: success },
          },
        },
        ...Object.fromEntries(
          [400, 401, 403, 404, 409, 413, 429, 500, 502, 503].map((status) => [
            status,
            {
              description: "Error",
              content: { "application/json": { schema: error } },
            },
          ]),
        ),
      },
    });
  }
}
const doc = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: "3.0.3",
  info: { title: "BookHub API", version: "2.0.0" },
  servers: [{ url: "/" }],
});
doc.components = {
  ...doc.components,
  securitySchemes: {
    userSession: { type: "apiKey", in: "cookie", name: "bookhub_session" },
    adminSession: { type: "apiKey", in: "cookie", name: "bookhub_admin" },
    cronBearer: { type: "http", scheme: "bearer" },
  },
};
mkdirSync("openapi", { recursive: true });
writeFileSync(
  "openapi/openapi.json",
  JSON.stringify(doc, null, 2) + "\n",
  "utf8",
);
