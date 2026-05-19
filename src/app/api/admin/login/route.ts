import { NextResponse } from "next/server";
import { assertAdminConfig, setAdminCookie, verifyAdminCredentials } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    assertAdminConfig();
  } catch {
    return NextResponse.json({ error: "تنظیمات ادمین کامل نیست" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور ناقص است" }, { status: 400 });
  }

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setAdminCookie(res);
  return res;
}
