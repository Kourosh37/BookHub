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
  const [form, setForm] = useState({ username: "", phone: "", password: "", confirmPassword: "", code: "" });
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
      body: JSON.stringify({
        mode: "register",
        phone: form.phone,
        username: form.username,
        password: form.password,
        confirmPassword: form.confirmPassword,
      }),
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
      body: JSON.stringify({ phone: form.phone, code: form.code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "کد تایید نامعتبر است");
    toast.success("حساب شما ساخته شد");
    window.location.replace(nextPath);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-4 text-center">
        <div className="text-sm text-slate-400">بوک هاب</div>
      </div>
      {!codeSent ? (
        <form onSubmit={requestOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">ثبت‌نام</h1>
          <input className="input" placeholder="نام کاربری" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} required />
          <input
            className="input"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="tel"
            enterKeyHint="next"
            placeholder="09xxxxxxxxx"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            dir="ltr"
          />
          <input className="input" type="password" placeholder="رمز عبور" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
          <input className="input" type="password" placeholder="تکرار رمز عبور" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} required />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال ارسال..." : "ارسال کد تایید"}</button>
          <p className="text-sm">حساب دارید؟ <Link className="text-sky-600" href="/login">ورود</Link></p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">تایید کد</h1>
          <input className="input" placeholder="کد ۶ رقمی" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required dir="ltr" />
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال بررسی..." : "تایید و ورود"}</button>
        </form>
      )}
    </main>
  );
}
