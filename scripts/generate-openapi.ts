import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  requestOtpSchema,
  verifyOtpSchema,
  passwordLoginSchema,
  scheduleSchema,
  bookingSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../src/lib/validations.ts";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const okResponse = z.object({ ok: z.boolean() }).openapi("OkResponse");
const errorResponse = z
  .object({
    error: z.string(),
    details: z.string().optional(),
  })
  .openapi("ErrorResponse");

registry.registerPath({
  method: "post",
  path: "/api/auth/request-otp",
  summary: "Request OTP for login/register/password reset",
  request: { body: { content: { "application/json": { schema: requestOtpSchema } } } },
  responses: {
    200: { description: "Queued", content: { "application/json": { schema: okResponse } } },
    400: { description: "Validation Error", content: { "application/json": { schema: errorResponse } } },
    429: { description: "Rate limited", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/verify-otp",
  summary: "Verify OTP code",
  request: { body: { content: { "application/json": { schema: verifyOtpSchema } } } },
  responses: {
    200: { description: "Verified", content: { "application/json": { schema: okResponse } } },
    401: { description: "Invalid code", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login-password",
  summary: "Login with username/password",
  request: { body: { content: { "application/json": { schema: passwordLoginSchema } } } },
  responses: {
    200: { description: "Logged in", content: { "application/json": { schema: okResponse } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: errorResponse } } },
    429: { description: "Rate limited", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/schedules",
  summary: "Create schedule",
  request: { body: { content: { "application/json": { schema: scheduleSchema } } } },
  responses: {
    200: { description: "Created", content: { "application/json": { schema: z.any() } } },
    400: { description: "Validation Error", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/schedules/{shareId}/book",
  summary: "Book a slot",
  request: {
    params: z.object({ shareId: z.string() }),
    body: { content: { "application/json": { schema: bookingSchema } } },
  },
  responses: {
    200: { description: "Booked", content: { "application/json": { schema: okResponse } } },
    400: { description: "Validation Error", content: { "application/json": { schema: errorResponse } } },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/profile",
  summary: "Update profile",
  request: { body: { content: { "application/json": { schema: updateProfileSchema } } } },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: z.any() } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/profile/password/confirm",
  summary: "Change password with OTP",
  request: { body: { content: { "application/json": { schema: changePasswordSchema } } } },
  responses: {
    200: { description: "Changed", content: { "application/json": { schema: okResponse } } },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "BookHub API",
    version: "1.0.0",
    description: "OpenAPI document for BookHub endpoints.",
  },
  servers: [{ url: "http://localhost:3000" }],
});

const outDir = join(process.cwd(), "openapi");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "openapi.json"), JSON.stringify(doc, null, 2), "utf8");
console.log("openapi/openapi.json generated");
