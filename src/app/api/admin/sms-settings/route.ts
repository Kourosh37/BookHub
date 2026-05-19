import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSmsGlobalSettings, updateSmsGlobalSettings } from "@/lib/admin-sms-settings";
import { updateAdminSmsSettingsSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }

  const settings = await getSmsGlobalSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateAdminSmsSettingsSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: "داده نامعتبر است", details: issue?.message || "نامعتبر" }, { status: 400 });
  }

  const updated = await updateSmsGlobalSettings(parsed.data);
  return NextResponse.json(updated);
}
