import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.string().optional(),
  details: z.string().optional(),
});

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<TSchema extends z.ZodTypeAny>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const res = await fetch(input, init);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const parsedError = apiErrorSchema.safeParse(json);
    const message = parsedError.success
      ? parsedError.data.details ||
        parsedError.data.error ||
        "درخواست ناموفق بود"
      : "درخواست ناموفق بود";
    throw new ApiError(res.status, message);
  }

  return schema.parse(json);
}

export const authMeResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    phone: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  }),
});

export const simpleOkSchema = z
  .object({ ok: z.boolean().optional() })
  .passthrough();
