"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

function resolveNextPath(raw: string) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  if (raw === "/register" || raw.startsWith("/register?")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"phone" | "password">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      body: JSON.stringify({ mode: "login_phone", phone }),
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
    window.location.replace(nextPath);
  }

  async function loginWithPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/login-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "ورود ناموفق بود");
    window.location.replace(nextPath);
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-4 text-center">
        <div className="text-sm text-slate-400">بوک هاب</div>
      </div>
      <div className="mb-3 flex gap-2">
        <button className={`btn ${mode === "phone" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setMode("phone")} type="button">ورود با موبایل</button>
        <button className={`btn ${mode === "password" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setMode("password")} type="button">ورود با رمز</button>
      </div>
      {mode === "phone" ? (
        !codeSent ? (
          <form onSubmit={requestOtp} className="card space-y-4 p-6">
            <h1 className="text-xl font-bold">ورود با شماره موبایل</h1>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="09xxxxxxxxx"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال ارسال..." : "ارسال کد تایید"}</button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="card space-y-4 p-6">
            <h1 className="text-xl font-bold">تایید کد ورود</h1>
            <input className="input" placeholder="کد ۶ رقمی" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
            <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال بررسی..." : "ورود"}</button>
          </form>
        )
      ) : (
        <form onSubmit={loginWithPassword} className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">ورود با نام کاربری و رمز عبور</h1>
          <input className="input" placeholder="نام کاربری" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <div className="relative">
            <input className="input ps-10" type={showPassword ? "text" : "password"} placeholder="رمز عبور" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال ورود..." : "ورود"}</button>
        </form>
      )}
      <p className="mt-4 text-sm">حساب ندارید؟ <Link className="text-sky-600" href="/register">ثبت‌نام</Link></p>
    </main>
  );
}
