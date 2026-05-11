import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { updateScheduleTitleSchema } from "@/lib/validations";

export async function PATCH(req: Request, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await requireSession();
    const body = await req.json();

    const parsed = updateScheduleTitleSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const message = firstIssue?.message || "Invalid payload";
      return NextResponse.json({ error: "Invalid data", details: message }, { status: 400 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        id: params.scheduleId,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const updated = await prisma.schedule.update({
      where: { id: params.scheduleId },
      data: { title: parsed.data.title },
      select: { id: true, title: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await requireSession();

    const schedule = await prisma.schedule.findFirst({
      where: {
        id: params.scheduleId,
        userId: session.userId,
      },
      select: { id: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    await prisma.schedule.delete({
      where: { id: params.scheduleId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
