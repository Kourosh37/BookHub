import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
  return NextResponse.json(
    { user: session },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
