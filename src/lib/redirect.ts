export function resolveNextPath(raw: string | null | undefined) {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(raw)
  )
    return "/dashboard";
  try {
    const base = "https://bookhub.invalid";
    const url = new URL(raw, base);
    if (url.origin !== base || /^\/(login|register)(\/|$)/.test(url.pathname))
      return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}
