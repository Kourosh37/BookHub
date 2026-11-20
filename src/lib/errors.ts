import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function readBytes(req: Request, maxBytes = 128 * 1024) {
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "Request is too large");
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
export async function readJson(req: Request): Promise<unknown> {
  const bytes = await readBytes(req);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON payload");
  }
}

export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success)
    throw new HttpError(
      400,
      parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    );
  return parsed.data;
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.retryAfter
          ? {
              retryAfterSeconds: error.retryAfter,
              details: `Try again in ${error.retryAfter} seconds`,
            }
          : {}),
      },
      {
        status: error.status,
        headers: error.retryAfter
          ? { "Retry-After": String(error.retryAfter) }
          : undefined,
      },
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "This record already exists" },
      { status: 409 },
    );
  }
  logger.error(
    { error: error instanceof Error ? error.message : String(error) },
    "request failed",
  );
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function handleRoute(action: () => Promise<Response> | Response) {
  try {
    const response = await action();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
