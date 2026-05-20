import { checkSlidingWindowLimit } from "@/lib/rate-limit";

export async function guardIpRateLimit(input: {
  keyPrefix: string;
  ip: string;
  limit: number;
  windowSeconds: number;
}) {
  return checkSlidingWindowLimit({
    key: `${input.keyPrefix}:ip:${input.ip}`,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  });
}

export async function guardEntityRateLimit(input: {
  keyPrefix: string;
  entity: string;
  limit: number;
  windowSeconds: number;
}) {
  return checkSlidingWindowLimit({
    key: `${input.keyPrefix}:entity:${input.entity}`,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  });
}
