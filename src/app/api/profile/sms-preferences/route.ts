import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { updateSmsPreferencesSchema } from "@/lib/validations";
import { normalizeSmsPreferences } from "@/lib/sms-preferences";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { smsPreferences: true },
    });
    return NextResponse.json(normalizeSmsPreferences(user?.smsPreferences ?? null));
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = updateSmsPreferencesSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { smsPreferences: parsed.data },
      select: { smsPreferences: true },
    });

    return NextResponse.json(normalizeSmsPreferences(updated.smsPreferences ?? null));
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
