import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/dashboard") || req.nextUrl.pathname.startsWith("/schedule/")) {
    const session = req.cookies.get("bookhub_session")?.value;
    if (!session) {
      const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/schedule/:path*"],
};
