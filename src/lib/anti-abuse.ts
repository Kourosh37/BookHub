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

// Only trust forwarded IP headers when an ingress under our control overwrites them.
export function clientIp(req: Request) {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return "untrusted-client";
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ||
    "unknown"
  );
}
