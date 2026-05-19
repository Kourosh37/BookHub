import { NextResponse } from "next/server";
import { getAdminUsername, isAdminSession } from "@/lib/admin-auth";

export async function GET() {
  const username = getAdminUsername();
  if (!username) {
    return NextResponse.json({ ok: false, configured: false }, { status: 500 });
  }

  if (!isAdminSession()) {
    return NextResponse.json({ ok: false, configured: true }, { status: 401 });
  }

  return NextResponse.json({ ok: true, configured: true, username });
}
