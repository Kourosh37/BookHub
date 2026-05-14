import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, phone: true, username: true, avatarUrl: true },
  });
  return NextResponse.json(
    { user: user || session },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
  );
}
