import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireSession();
    const data = await prisma.schedule.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
