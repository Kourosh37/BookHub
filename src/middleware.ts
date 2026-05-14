import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
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

