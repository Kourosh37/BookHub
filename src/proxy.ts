import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    const origin = req.headers.get("origin");
    const allowed = new URL(process.env.NEXTAUTH_URL || req.url).origin;
    if (
      (origin && origin !== allowed) ||
      req.headers.get("sec-fetch-site") === "cross-site"
    ) {
      return NextResponse.json(
        { error: "Cross-site request rejected" },
        { status: 403 },
      );
    }
  }
  const supplied = req.headers.get("x-request-id") || "";
  const requestId = /^[a-zA-Z0-9_-]{1,64}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({
    request: {
      headers: reqHeaders,
    },
  });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
