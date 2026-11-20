export function positiveInt(
  value: string | undefined,
  fallback: number,
  max = 1_000_000,
) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max
    ? parsed
    : fallback;
}

export function secretKey(name: string) {
  const value = process.env[name];
  if (!value || value.length < 32 || /^(change[-_]|dev[_-])/i.test(value)) {
    throw new Error(
      `${name} must be a random secret of at least 32 characters`,
    );
  }
  return new TextEncoder().encode(value);
}

export function secureCookies() {
  return (
    process.env.NEXTAUTH_URL?.startsWith("https://") ??
    process.env.NODE_ENV === "production"
  );
}
