"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

function resolveNextPath(raw: string) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  if (raw === "/register" || raw.startsWith("/register?")) return "/dashboard";
  return raw;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);
  const nextPath = useMemo(() => resolveNextPath(nextParam), [nextParam]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => {
      if (r.ok) window.location.replace(nextPath);
    });
  }, [nextPath]);

  async function requestOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "ارسال کد ناموفق بود");
    setCodeSent(true);
    toast.success("کد تایید ارسال شد");
  }

  async function verifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "کد تایید نامعتبر است");
    toast.success("حساب شما آماده است");
    window.location.replace(nextPath);
  }

  const loginHref = nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : "/login";

  return (
    <main className="mx-auto max-w-md p-6">
      {!codeSent ? (
        <form onSubmit={requestOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">ثبت‌نام با شماره موبایل</h1>
          <input
            className="input"
            name="phone"
            inputMode="numeric"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال ارسال..." : "ارسال کد تایید"}</button>
          <p className="text-sm">حساب دارید؟ <Link className="text-sky-600" href={loginHref}>ورود</Link></p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">تایید شماره موبایل</h1>
          <p className="text-sm text-slate-400" dir="ltr">{phone}</p>
          <input
            className="input"
            name="code"
            inputMode="numeric"
            dir="ltr"
            placeholder="کد ۶ رقمی"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال بررسی..." : "تایید و ورود"}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => setCodeSent(false)} disabled={loading}>
            تغییر شماره
          </button>
        </form>
      )}
    </main>
  );
}
